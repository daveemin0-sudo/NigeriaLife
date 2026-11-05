// Home: in through the compound gate, sleep in the bed, watch TV from the sofa, eat from
// the fridge, bathe at the drum, and back out to the same gate. Each is acted out in the room.
import { open, wait, newPlayer, advance, playUntil, closeDialogs, leaveByDoor } from './lib.mjs';

const state = (page) => page.evaluate(() => {
  const g = window.game;
  const actor = g.player.actor;
  const data = g.hud.backend.getData();
  return {
    inside: g.world.interiorManager.currentInterior?.type ?? null,
    lying: actor.pose.legs === 'lie',
    sitting: actor.pose.legs === 'sit',
    held: actor.hold !== null,
    scripted: actor.scripted,
    doing: actor.sequence?.name ?? null,
    energy: data.stats.energy,
    health: data.stats.health,
    hunger: data.stats.hunger,
    food: data.inventory.filter((i) => i.category === 'food').reduce((n, i) => n + i.quantity, 0),
    activity: g.world.interiorManager.residence.life.status()?.activity ?? null,
    statusShown: document.getElementById('home-activity-status').style.display !== 'none',
  };
});
const setStats = (page, stats) => page.evaluate((s) => Object.assign(window.game.hud.backend.data.stats, s), stats);
const free = (s) => !s.held && !s.scripted && !s.doing && !s.activity;

/** Uses something at home the way a player does: its shortcut, then the button on its card. */
const use = async (page, id) => {
  await closeDialogs(page);
  await page.click(`#place-card .place-chip[data-spot="${id}"]`);
  const reached = await playUntil(page, (spot) => (window.game.hud.currentActiveObject?.id === spot ? true : null), 30, id);
  if (reached) await page.click('#card-action-btn');
  return !!reached;
};

export async function run(browser, check) {
  const ctx = await newPlayer(browser);
  const { page, log } = await open(ctx);
  const gate = () => page.evaluate(() => {
    const g = window.game;
    const d = g.world.buildings.placeDoors.find((x) => x.buildingId === 'villa-compound');
    return { open: d.door.openAmount, fromGate: +Math.hypot(g.player.position.x - d.outside.x, g.player.position.z - d.outside.z).toFixed(2) };
  });

  // ------------------------------------------------------------------ No home, no entry
  await page.click('#nav-btn-home');
  await wait(600);
  let refused = await page.evaluate(() => ({ dialogue: document.getElementById('game-dialogue-overlay')?.innerText ?? '', inside: window.game.world.interiorManager.isPlayerInside() }));
  check('without a home, the Home button explains and takes the player nowhere', /rent or buy/i.test(refused.dialogue) && !refused.inside, { inside: refused.inside });
  await closeDialogs(page);

  await page.evaluate(() => { const g = window.game; const d = g.world.buildings.placeDoors.find((x) => x.buildingId === 'villa-compound'); g.player.mesh.position.set(d.outside.x + 1, 0, d.outside.z + 1); });
  await advance(page, 0.4);
  const prompt = await page.evaluate(() => window.game.hud.currentInteractionTarget?.label ?? null);
  await page.keyboard.press('e');
  await advance(page, 1.5);
  refused = await page.evaluate(() => ({ dialogue: document.getElementById('game-dialogue-overlay')?.innerText ?? '', inside: window.game.world.interiorManager.isPlayerInside(), walking: window.game.player.actor.scripted }));
  check('the compound gate also stays shut for someone who does not live there',
    !!prompt && /rent or buy/i.test(refused.dialogue) && !refused.inside && !refused.walking && (await gate()).open === 0, { prompt, ...refused });
  await closeDialogs(page);

  // ------------------------------------------------------------------ Rent, then in through the gate
  const rented = await page.evaluate(() => { const be = window.game.hud.backend; const r = be.rentProperty(be.getData().properties[0].id); return { ok: r.success, home: be.hasHome() }; });
  await page.keyboard.press('e');
  const rolled = await playUntil(page, () => {
    const g = window.game;
    const d = g.world.buildings.placeDoors.find((x) => x.buildingId === 'villa-compound');
    return d.door.openAmount > 0.6 && !g.world.interiorManager.currentInterior ? { locked: g.player.actor.sequence?.interruptible === false } : null;
  }, 20);
  const inside = await playUntil(page, () => {
    const g = window.game;
    return g.world.interiorManager.currentInterior?.type === 'residence' && !g.world.interiorManager.busy && !g.player.actor.sequence ? true : null;
  }, 25);
  check('after renting, E at the gate rolls it open and the player walks in to their apartment', rented.ok && rented.home && rolled && rolled.locked && !!inside, { rented, rolled });
  check('the gate rolls shut again behind them', !!(await playUntil(page, () => window.game.world.buildings.placeDoors.find((x) => x.buildingId === 'villa-compound').door.isClosed, 6)));

  // From here on, note any step taken through a wall or a piece of furniture
  await page.evaluate(() => {
    const g = window.game;
    const director = g.interactions;
    const update = director.update.bind(director);
    const nav = g.world.interiorManager.residence.life.nav;
    window.__through = 0;
    director.update = (delta) => {
      update(delta);
      const a = g.player.actor;
      // Where each walk set off from, to tell a step through something from a start inside it
      if (a.sequence && a.sequence !== window.__seq) { window.__seq = a.sequence; window.__from = [+(g.player.position.x - 260).toFixed(2), +(g.player.position.z - 440).toFixed(2)]; }
      if (a.pose.legs === 'walk' && a.sequence && g.world.interiorManager.currentInterior?.type === 'residence' && !g.world.interiorManager.busy) {
        if (!nav.isFree(g.player.position.x, g.player.position.z)) { window.__through++; (window.__where ??= []).push([+(g.player.position.x - 260).toFixed(2), +(g.player.position.z - 440).toFixed(2), a.sequence.name, 'from', ...window.__from]); }
      }
    };
  });

  // ------------------------------------------------------------------ Bed
  await setStats(page, { energy: 20, health: 60 });
  let before = await state(page);
  check('the bed is reached by walking through the doorways', await use(page, 'flat-bed'));
  const asleep = await playUntil(page, () => (window.game.world.interiorManager.residence.life.status()?.activity === 'sleeping' ? true : null), 20);
  let s = await state(page);
  check('the player lies down on the bed and the status line shows them sleeping', asleep && s.lying && s.held && s.statusShown, { lying: s.lying, status: s.statusShown });

  const samples = [];
  for (let i = 0; i < 4; i++) { await advance(page, 1); samples.push((await state(page)).energy); }
  check('energy comes back gradually while asleep, not all at once',
    samples.every((e, i) => e > (i ? samples[i - 1] : before.energy)) && samples[0] - before.energy < 25 && samples[3] < 100, samples.map((e) => +e.toFixed(1)));

  await page.evaluate(() => document.querySelector('#home-activity-status-stop')?.click());
  await playUntil(page, () => (!window.game.player.actor.scripted ? true : null), 5);
  s = await state(page);
  check('getting up early keeps what was rested and leaves the player standing and free', free(s) && !s.lying && s.energy > before.energy + 20 && s.energy < 100 && !s.statusShown, { energy: +s.energy.toFixed(1), free: free(s) });

  await use(page, 'flat-bed');
  await playUntil(page, () => (window.game.world.interiorManager.residence.life.status()?.activity === 'sleeping' ? true : null), 20);
  const rested = await playUntil(page, () => (/Fully rested · lying in/.test(document.getElementById('home-activity-status')?.innerText ?? '') ? true : null), 30);
  await page.evaluate(() => window.game.advance(5));
  const stillIn = await state(page);
  await page.evaluate(() => [...document.querySelectorAll('#home-activity-status button')].find((b) => /Get up/.test(b.textContent))?.click());
  const woke = await playUntil(page, () => (!window.game.player.actor.scripted && !window.game.player.actor.hold ? true : null), 10);
  s = await state(page);
  check('sleeping on, the player is told when fully rested and stays in bed, lying in, till they choose to get up',
    rested && stillIn.lying && stillIn.held && woke && free(s) && s.energy > 99.5 && s.health > 99.5, { rested, lyingIn: stillIn.lying, energy: s.energy, health: s.health });

  // ------------------------------------------------------------------ Sofa and TV
  await setStats(page, { energy: 40 });
  await use(page, 'flat-tv');
  const watching = await playUntil(page, () => {
    const g = window.game;
    if (g.world.interiorManager.residence.life.status()?.activity !== 'watching_tv') return null;
    // Facing the TV on the left wall means facing -X
    return { sitting: g.player.actor.pose.legs === 'sit', facingTv: Math.abs(Math.sin(g.player.actor.yaw) + 1) < 0.05 };
  }, 20);
  check('the player walks to the sofa and sits down facing the TV', watching && watching.sitting && watching.facingTv, watching);
  await advance(page, 5);
  const partWay = (await state(page)).energy;
  await advance(page, 20);
  s = await state(page);
  check('relaxing there restores a little energy and then stops: +30 at most', partWay > 45 && partWay < 60 && Math.abs(s.energy - 70) < 1 && s.sitting, { after5s: +partWay.toFixed(1), after25s: +s.energy.toFixed(1) });
  await page.keyboard.down('d');
  await advance(page, 0.3);
  await page.keyboard.up('d');
  await playUntil(page, () => (!window.game.player.actor.scripted ? true : null), 5);
  s = await state(page);
  check('pressing a movement key stands the player up from the sofa', free(s) && !s.sitting && !s.statusShown, { free: free(s) });

  // ------------------------------------------------------------------ Fridge
  // Opened, it shows what is in it; the food in the bag goes in; something is taken out and eaten sitting down
  const inFridge = () => page.evaluate(() => window.game.modules.Fridge.get().count());
  const fridgeChoices = () => page.evaluate(() => [...document.querySelectorAll('#dialogue-choices-row .dialogue-choice-btn')].map((b) => b.innerText.replace(/\s+/g, ' ').trim()));
  const pickInFridge = (pattern) => page.evaluate((re) => {
    const btn = [...document.querySelectorAll('#dialogue-choices-row .dialogue-choice-btn')].find((b) => new RegExp(re).test(b.innerText));
    btn?.click();
    return !!btn;
  }, pattern);
  await setStats(page, { hunger: 30 });
  before = await state(page);
  const fridgeBefore = await inFridge();
  await use(page, 'flat-fridge');
  await wait(300);
  const firstLook = await fridgeChoices();
  const stocked = await pickInFridge('Put the food from your bag');
  await wait(300);
  const afterStock = { bag: (await state(page)).food, fridge: await inFridge() };
  check('the fridge opens on what is in it, and the food in the bag goes into it',
    before.food > 0 && firstLook.some((c) => /Put the food from your bag/.test(c)) && stocked && afterStock.bag === 0 && afterStock.fridge === fridgeBefore + before.food,
    { foodBefore: before.food, firstLook, afterStock });

  await use(page, 'flat-fridge');
  await wait(300);
  const menu = await fridgeChoices();
  const picked = await page.evaluate(() => {
    const btn = document.querySelector('#dialogue-choices-row .dialogue-choice-btn');
    const name = btn?.innerText ?? '';
    btn?.click();
    return name.replace(/\s+/g, ' ').trim();
  });
  const eating = await playUntil(page, () => {
    const a = window.game.player.actor;
    return a.pose.arms === 'eat' && a.carried && a.pose.legs === 'sit' ? true : null;
  }, 25);
  await playUntil(page, () => (!window.game.player.actor.scripted ? true : null), 12);
  s = await state(page);
  const fridgeAfter = await inFridge();
  check('something chosen from the fridge is taken out, carried to the sofa and eaten sitting down: one less in the fridge, hunger eased',
    menu.length >= 3 && !!picked && !!eating && fridgeAfter === afterStock.fridge - 1 && s.food === 0 && s.hunger > before.hunger && free(s) && !(await page.evaluate(() => !!window.game.player.actor.carried)),
    { menu, picked, eating, fridge: [afterStock.fridge, fridgeAfter], hungerGain: +(s.hunger - before.hunger).toFixed(1) });

  // Changing their mind on the way: nothing is eaten
  before = await state(page);
  const fridgeMid = await inFridge();
  await use(page, 'flat-fridge');
  await wait(300);
  await page.evaluate(() => document.querySelector('#dialogue-choices-row .dialogue-choice-btn')?.click());
  await playUntil(page, () => (window.game.player.actor.sequence ? true : null), 3);
  await advance(page, 0.2);
  await page.keyboard.down('w');
  await advance(page, 0.3);
  await page.keyboard.up('w');
  await advance(page, 5);
  s = await state(page);
  const kept = (await inFridge()) + s.food;
  check('walking away before eating uses nothing: it is still in the fridge or in the hand', free(s) && kept === fridgeMid + before.food && s.hunger <= before.hunger + 0.5,
    { before: fridgeMid + before.food, kept });

  // Nothing in the fridge or the bag: it says so, and offers groceries
  await page.evaluate(() => {
    const d = window.game.hud.backend.data;
    d.inventory = d.inventory.filter((i) => i.category !== 'food');
    const f = window.game.modules.Fridge.get();
    for (const item of f.contents()) for (let k = 0; k < item.quantity; k++) f.takeOut(item.id);
    d.inventory = d.inventory.filter((i) => i.category !== 'food');
  });
  await use(page, 'flat-fridge');
  await wait(300);
  const emptyLook = await page.evaluate(() => document.getElementById('game-dialogue-overlay')?.innerText ?? '');
  const emptyChoices = await fridgeChoices();
  await closeDialogs(page);
  s = await state(page);
  check('an empty fridge says it is empty and offers to order groceries; nothing happens', free(s) && /empty/i.test(emptyLook) && emptyChoices.some((c) => /Order groceries/.test(c)) && !emptyChoices.some((c) => /×/.test(c)),
    { emptyLook: emptyLook.slice(0, 120), emptyChoices });

  // ------------------------------------------------------------------ Bath
  await setStats(page, { energy: 30, health: 50 });
  await use(page, 'flat-drum');
  await playUntil(page, () => (window.game.player.actor.pose.arms === 'reach' ? true : null), 20);
  const midBath = await state(page);
  await playUntil(page, () => (!window.game.player.actor.scripted ? true : null), 10);
  s = await state(page);
  check('a bucket bath is acted out at the drum and refreshes once: energy +30, health +20',
    Math.abs(midBath.energy - 30) < 1 && Math.abs(s.energy - 60) < 1 && Math.abs(s.health - 70) < 1 && free(s), { energy: +s.energy.toFixed(1), health: +s.health.toFixed(1) });

  check('all that walking went around the walls and furniture, through the doorways', (await page.evaluate(() => window.__through)) === 0, { stepsThroughSomething: await page.evaluate(() => window.__where ?? []) });

  // ------------------------------------------------------------------ Out again
  await use(page, 'flat-tv');
  await playUntil(page, () => (window.game.player.actor.hold ? true : null), 20);
  const out = await leaveByDoor(page);
  const after = await gate();
  s = await state(page);
  check('Leave from the sofa stands the player up, walks them out and brings them out at the compound gate', out && !s.inside && free(s) && after.fromGate < 0.3, { ...after, free: free(s) });
  check('the gate closes behind them', !!(await playUntil(page, () => window.game.world.buildings.placeDoors.find((x) => x.buildingId === 'villa-compound').door.isClosed, 6)));

  await page.click('#nav-btn-home');
  const homeAgain = await playUntil(page, () => (window.game.world.interiorManager.currentInterior?.type === 'residence' && !window.game.world.interiorManager.busy ? true : null), 10);
  check('with a home, the Home button takes the player straight there', !!homeAgain);

  check('home: no console errors', log.errors.length === 0, log.errors.slice(0, 5));
  await ctx.close();
}
