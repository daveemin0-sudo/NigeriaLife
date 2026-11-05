// The nightclub: a place that keeps hours, with a door, a gate fee paid once a night, a bar
// where a drink is made and paid for at the hand-over, a dance floor and a lounge.
import { open, newPlayer, closeDialogs, advance, playUntil, money, wait } from './lib.mjs';

const club = (page) => page.evaluate(() => window.game.world.interiorManager.club.service.status());
const stats = (page) => page.evaluate(() => ({ ...window.game.hud.backend.getData().stats }));
const setHour = (page, hour) => page.evaluate((h) => window.game.world.skyEnvironment.setHour(h), hour);
const inside = (page) => page.evaluate(() => window.game.world.interiorManager.currentInterior?.type ?? null);
const idle = (page, seconds = 30) => playUntil(page, () => (window.game.player.actor.sequence ? null : true), seconds);

/** Stands at a thing (in the street or in the room), opens its card and returns what the button says. */
async function cardFor(page, id, indoors) {
  const prompt = await page.evaluate(async ({ id, indoors }) => {
    const g = window.game;
    const list = indoors ? g.world.interiorManager.getActiveInteractiveObjects() : g.world.interactiveObjects;
    const o = list.find((x) => x.id === id);
    if (!o) return 'not-found';
    document.getElementById('game-dialogue-overlay')?.remove();
    g.hud.hideInteractionCard();
    g.player.actor.hold?.release(true);
    g.player.stopMoving();
    g.player.mesh.position.set(o.interactionPoint.x, 0, o.interactionPoint.z);
    await g.advance(0.1);
    return g.hud.currentInteractionTarget?.id || 'no-prompt';
  }, { id, indoors });
  if (prompt !== id) return { prompt, label: null };
  await page.keyboard.press('e');
  await wait(350);
  const label = await page.evaluate(() => (window.game.hud.currentActiveObject ? document.getElementById('card-action-btn')?.textContent : null));
  return { prompt, label };
}
const press = (page) => page.evaluate(() => document.getElementById('card-action-btn')?.click());
const choices = (page) => page.evaluate(() => [...document.querySelectorAll('#game-dialogue-overlay button')].map((b) => b.textContent.replace(/\s+/g, ' ').trim()).filter((t) => /₦/.test(t)));
const choose = (page, text) => page.evaluate((t) => [...document.querySelectorAll('#game-dialogue-overlay button')].find((b) => b.textContent.includes(t))?.click(), text);

export async function run(browser, check) {
  const ctx = await newPlayer(browser);
  const { page, log } = await open(ctx);
  await closeDialogs(page);

  // ------------------------------------------------------------------ In the street
  const street = await page.evaluate(() => {
    const g = window.game;
    const w = g.world;
    const landmark = w.landmarks.club;
    let triangles = 0;
    landmark.group.traverse((node) => { if (node.isMesh) triangles += (node.geometry.index ? node.geometry.index.count : node.geometry.attributes.position.count) / 3; });
    const door = w.landmarks.streetDoors().find((d) => d.buildingId === 'quilox-club');
    return {
      triangles: Math.round(triangles),
      door: door ? { closed: door.door.isClosed, x: door.outside.x, z: door.outside.z } : null,
      oldBox: w.districts.interactiveList.some((o) => o.id === 'quilox-club'),
      ride: g.rides.destinations().some((d) => d.name === 'Quilox Nightclub'),
      plan: w.validateCityPlan().map((v) => `${v.rule}: ${v.what}`),
    };
  });
  check('the nightclub stands on Victoria Island as a building with a real door, in place of the old black box, and rides go to it',
    street.triangles > 400 && !!street.door && street.door.closed && !street.oldBox && street.ride && street.plan.length === 0, street);

  // Shut through the day
  await setHour(page, 15);
  await advance(page, 0.3);
  /** Stands at the club's door, as someone walking up to it does, and reads the prompt and the card. */
  const atTheDoor = () => page.evaluate(async () => {
    const g = window.game;
    const o = g.world.interactiveObjects.find((x) => x.id === 'quilox-club');
    g.hud.hideInteractionCard();
    g.player.stopMoving();
    g.player.mesh.position.set(o.interactionPoint.x, 0, o.interactionPoint.z);
    await g.advance(0.1);
    const prompt = g.hud.currentInteractionTarget?.label ?? null;
    g.hud.showInteractionCard(o);
    const card = document.getElementById('card-action-btn')?.textContent ?? null;
    g.hud.hideInteractionCard();
    return { prompt, card };
  });
  let door = await atTheDoor();
  await page.keyboard.press('e');
  await advance(page, 3);
  const told = await page.evaluate(() => /Quilox is closed\. It opens at 8 pm/.test(document.body.innerText));
  const refused = await page.evaluate(async () => {
    const g = window.game;
    return { direct: await g.world.interiorManager.enterInterior('club', g.player, g.cameraManager, g.hud, g.world), open: g.world.interiorManager.isOpenNow('club') };
  });
  await wait(600);
  check('at three in the afternoon it is shut: the prompt and the card say so, pressing E is answered with when it opens, and it cannot be got into any other way either',
    /closed/i.test(door.prompt || '') && /Closed/.test(door.card || '') && /8 pm/.test(door.card || '') && told && (await inside(page)) === null && refused.direct === false && !refused.open, { door, told, refused });

  // Open at night, in through the door
  await setHour(page, 22);
  await advance(page, 0.3);
  door = await atTheDoor();
  await page.keyboard.press('e');
  const swung = await playUntil(page, () => {
    const g = window.game;
    const door = g.world.landmarks.streetDoors().find((d) => d.buildingId === 'quilox-club');
    return door.door.openAmount > 0.6 && !g.world.interiorManager.currentInterior ? true : null;
  }, 15);
  await playUntil(page, () => (window.game.world.interiorManager.currentInterior?.type === 'club' && !window.game.player.actor.sequence ? true : null), 30);
  const room = await page.evaluate(() => {
    const g = window.game;
    const objects = g.world.interiorManager.getActiveInteractiveObjects();
    return {
      type: g.world.interiorManager.currentInterior?.type ?? null,
      stations: objects.filter((o) => o.id.startsWith('club_')).map((o) => o.id),
      people: objects.filter((o) => o.id.startsWith('interior_npc_')).length,
      music: g.world.interiorManager.club.startedMusic,
      chips: [...document.querySelectorAll('#place-card button, .place-card button')].map((b) => b.textContent.trim()).filter(Boolean).length,
    };
  });
  check('at ten at night the prompt and the card say "Go in", the door swings open and the player walks through into the club, where the music is on',
    /Go in/.test(door.prompt || '') && /Go in/.test(door.card || '') && !!swung && room.type === 'club' && room.music, { door, swung, room });
  check('inside are a door desk, a bar, a dance floor and a lounge, with a room full of people',
    ['club_door_desk', 'club_bar', 'club_dance_floor', 'club_lounge'].every((id) => room.stations.includes(id)) && room.people >= 12, room);

  const lively = async () => page.evaluate(() => {
    const interior = window.game.world.interiorManager.club;
    const colour = [];
    interior.tiles.getColorAt(3, { r: 0, g: 0, b: 0, setRGB() {}, fromArray(a, o) { colour.push(a[o], a[o + 1], a[o + 2]); return this; } });
    return { dancer: interior.dancers.map((d) => +d.npc.group.position.y.toFixed(3)), turn: +interior.dancers[0].npc.group.rotation.y.toFixed(3), tile: colour.map((c) => +c.toFixed(3)).join(',') };
  });
  const before1 = await lively();
  await advance(page, 0.83);
  const before2 = await lively();
  check('the crowd on the floor is dancing and the floor changes with the beat',
    JSON.stringify(before1.dancer) !== JSON.stringify(before2.dancer) && before1.turn !== before2.turn && before1.tile !== before2.tile, { before1, before2 });

  // ------------------------------------------------------------------ Nothing without the gate fee
  let cash = await money(page);
  let card = await cardFor(page, 'club_bar', true);
  await press(page);
  await advance(page, 1);
  const noMenu = (await choices(page)).length === 0;
  card = await cardFor(page, 'club_dance_floor', true);
  await press(page);
  await advance(page, 1.5);
  let state = await club(page);
  check('before the gate fee is paid there is no bar and no dance floor, and nothing is charged', noMenu && !state.dancing && !state.paid && (await money(page)).total === cash.total, { noMenu, state });

  // Too poor for the gate
  await page.evaluate(() => { const b = window.game.hud.backend; const d = b.getData(); b.pay(d.walletCash + d.bank.balance - 30000, 'test: nearly broke'); });
  cash = await money(page);
  card = await cardFor(page, 'club_door_desk', true);
  await press(page);
  await idle(page);
  state = await club(page);
  check('with ₦30,000 the ₦500,000 gate fee is refused and nothing is taken', /Pay the gate fee/.test(card.label || '') && !state.paid && (await money(page)).total === cash.total, { card, state });

  await page.evaluate(() => window.game.hud.backend.performGig(320_000_000, 0, 'test: balling money'));
  cash = await money(page);
  card = await cardFor(page, 'club_door_desk', true);
  await press(page);
  await playUntil(page, () => (window.game.world.interiorManager.club.service.paid ? true : null), 20);
  await idle(page);
  let after = await money(page);
  card = await cardFor(page, 'club_door_desk', true);
  await press(page);
  await advance(page, 2);
  state = await club(page);
  check('the gate fee is paid at the desk, ₦500,000 once: asking again takes nothing more',
    state.paid && cash.total - after.total === 500000 && /in for the night/.test(card.label || '') && (await money(page)).total === after.total, { paid: cash.total - after.total, card, state });

  // ------------------------------------------------------------------ The bar
  await page.evaluate(() => window.game.hud.backend.depleteEnergy(40));
  const tired = await stats(page);
  cash = await money(page);
  card = await cardFor(page, 'club_bar', true);
  await press(page);
  await wait(400);
  const menu = await choices(page);
  await choose(page, 'Chapman');
  // A second tap while it is being made orders nothing more
  await page.evaluate(() => { const s = window.game.world.interiorManager.club.service; return s.serving; });
  const glass = await playUntil(page, () => (window.game.player.actor.carried ? true : null), 25);
  await page.evaluate(() => {
    const interior = window.game.world.interiorManager.club;
    interior.service.order({ actor: window.game.player.actor, say() {}, ask() {}, emote() {}, enter() {}, look() {}, hour: () => 22, backend: window.game.hud.backend, director: window.game.interactions }, { id: 'malt', name: 'Cold malt', price: 1500, energy: 10, cred: 0, colour: 0 });
  });
  await idle(page, 25);
  await advance(page, 0.5);
  after = await money(page);
  const refreshed = await stats(page);
  const emptyHands = await page.evaluate(() => !window.game.player.actor.carried);
  check('the bar lists what there is with prices; a Chapman is made by the barman, paid for once as he hands it over (₦50,000), drunk, and the glass is gone',
    menu.length >= 3 && menu.some((m) => /Chapman/.test(m) && /50,000/.test(m)) && !!glass && cash.total - after.total === 50000 && Math.round(refreshed.energy - tired.energy) === 14 && emptyHands,
    { menu, glass, paid: cash.total - after.total, energy: refreshed.energy - tired.energy, emptyHands });

  // ------------------------------------------------------------------ The floor
  const cred = (await stats(page)).streetCred;
  const energyBefore = (await stats(page)).energy;
  card = await cardFor(page, 'club_dance_floor', true);
  await press(page);
  const onFloor = await playUntil(page, () => (window.game.world.interiorManager.club.service.status().dancing ? { emote: window.game.player.currentEmote } : null), 20);
  await playUntil(page, () => (window.game.world.interiorManager.club.service.status().dancing ? null : true), 20);
  const danced = await stats(page);
  state = await club(page);
  check('on the dance floor the player dances a song through, and it counts: street cred +3, energy -6',
    !!onFloor && onFloor.emote === 'zanku' && danced.streetCred - cred === 3 && Math.round(energyBefore - danced.energy) === 6 && state.dancesCounted === 1, { onFloor, cred: danced.streetCred - cred, energy: energyBefore - danced.energy, state });

  for (let i = 0; i < 4; i++) {
    await cardFor(page, 'club_dance_floor', true);
    await press(page);
    await playUntil(page, () => (window.game.world.interiorManager.club.service.status().dancing ? true : null), 20);
    await playUntil(page, () => (window.game.world.interiorManager.club.service.status().dancing ? null : true), 20);
  }
  const worn = await stats(page);
  state = await club(page);
  check('only four dances a night count for anything', state.dancesCounted === 4 && worn.streetCred - cred === 12, { counted: state.dancesCounted, cred: worn.streetCred - cred });

  // ------------------------------------------------------------------ The lounge
  card = await cardFor(page, 'club_lounge', true);
  await press(page);
  await advance(page, 2);
  const kept = await page.evaluate(() => !window.game.player.actor.hold);
  check('the lounge is for those with a table: without one the VIP host offers tables, and the player is not seated', /VIP tables/.test(card.label || '') && kept, { card, kept });
  await page.evaluate(() => document.getElementById('game-dialogue-overlay')?.remove());

  cash = await money(page);
  await cardFor(page, 'club_bar', true);
  await press(page);
  await wait(400);
  await choose(page, 'Moët');
  await playUntil(page, () => (window.game.world.interiorManager.club.service.hasTable ? true : null), 30);
  await idle(page, 25);
  after = await money(page);
  card = await cardFor(page, 'club_lounge', true);
  await press(page);
  await wait(300);
  await choose(page, 'Sit at your table');
  const seated = await playUntil(page, () => { const a = window.game.player.actor; return a.hold && a.pose.legs === 'sit' ? true : null; }, 25);
  check('a bottle of Moët (₦6,000,000, once) buys a table: the lounge then seats the player', cash.total - after.total === 6_000_000 && /Your table/.test(card.label || '') && !!seated, { paid: cash.total - after.total, card, seated });
  await page.evaluate(() => window.game.player.actor.hold?.release());
  await advance(page, 0.3);

  // ------------------------------------------------------------------ Balling: pop the bottle, spray money, host the club
  await cardFor(page, 'club_lounge', true);
  await press(page);
  await wait(300);
  await choose(page, 'Pop a bottle');
  await playUntil(page, () => (window.game.player.actor.sequence ? null : true), 20);
  const popped = await page.evaluate(() => ({ bottles: window.game.world.interiorManager.club.service.bottles, told: /POP!/.test(document.body.innerText) }));
  const s0 = await money(page);
  await cardFor(page, 'club_lounge', true);
  await press(page);
  await wait(300);
  await choose(page, 'Spray ₦5,000,000');
  const raining = await playUntil(page, () => (window.game.world.interiorManager.club.service.balling.notes > 20 ? window.game.world.interiorManager.club.service.balling.notes : null), 20);
  const hailed = await page.evaluate(() => /BIG BOSS IN THE BUILDING/.test(document.getElementById('club-celebrate')?.innerText ?? ''));
  await playUntil(page, () => (window.game.player.actor.sequence ? null : true), 20);
  const s1 = await money(page);
  await cardFor(page, 'club_lounge', true);
  await press(page);
  await wait(300);
  await choose(page, 'Platinum');
  await playUntil(page, () => (window.game.world.interiorManager.club.service.hosting ? true : null), 20);
  const host = await page.evaluate(() => /HOSTING THE CLUB TONIGHT/.test(document.getElementById('club-celebrate')?.innerText ?? ''));
  const s2 = await money(page);
  check('balling: a bottle is popped at the table, ₦5m is sprayed in notes that rain over the floor (the club hails the big boss), and ₦200m hosts the club tonight',
    popped.bottles === 0 && popped.told && !!raining && hailed && s0.total - s1.total === 5_000_000 && host && s1.total - s2.total === 200_000_000,
    { popped, raining, hailed, sprayed: s0.total - s1.total, host, platinum: s1.total - s2.total });
  await advance(page, 1);

  // ------------------------------------------------------------------ Closing time, and the next night
  await setHour(page, 5.05);
  const out = await playUntil(page, () => (!window.game.world.interiorManager.currentInterior && !window.game.player.actor.sequence ? { x: window.game.player.position.x, z: window.game.player.position.z } : null), 40);
  const quiet = await page.evaluate(() => ({ music: window.game.world.interiorManager.club.startedMusic, radio: window.game.sound?.isRadioActive?.() ?? null }));
  check('at five in the morning the club closes: the player is walked out to the street by its door, and the music stops',
    !!out && Math.hypot(out.x - street.door.x, out.z - street.door.z) < 4 && !quiet.music, { out, quiet });

  await page.evaluate(() => { const sky = window.game.world.skyEnvironment; sky.setDay(sky.day + 1); sky.setHour(21); });
  await advance(page, 0.3);
  state = await club(page);
  check('the gate fee and the table were for that night: the next evening both are to be paid for again', state.open && !state.paid && !state.table, state);

  check('no errors were logged at any of it', log.errors.length === 0, log.errors.slice(0, 5));
  await ctx.close();
}
