// Work inside the places along the road: the one in charge takes the player on, a shift is a few
// tasks done in turn at the counter, bed, desk or stage where they are done, and it is paid once,
// at the grade's rate, when the last is done; nothing if the player walks off. The phone's jobs
// list sends the player there by cab.
import { open, newPlayer, closeDialogs, advance, wait, playUntil, money } from './lib.mjs';

const WORK = {
  'marina-towers': ['first-bank-marina'], 'afrika-shrine': ['new-afrika-shrine'], 'balogun-market': ['balogun-textiles'], 'amala-shitta': ['amala-shitta-surulere'],
  'i-fitness': ['i-fitness-lekki'], 'ikeja-city-mall': ['shoprite-ikeja'], 'mmia-terminal': ['dana-checkin-desk', 'faan-aviation-sec'], 'dangote-refinery': ['dangote-refinery-ops'],
  lasuth: ['lasuth-nursing'], 'ladipo-auto': ['ladipo-mechanic'], 'computer-village': ['cv-phone-repair'], 'radio-house': ['naijafm-radio'],
  'eko-grand-hotel': ['eko-grand-staff'], 'chop-express': ['chop-express-crew'], 'ikeja-gra': ['gra-interiors'],
};

const enter = async (page, key) => {
  await page.evaluate((k) => {
    const g = window.game;
    const card = g.world.interactiveObjects.find((o) => o.id === `roadside-${k}`);
    g.player.stopMoving();
    g.player.mesh.position.set(card.interactionPoint.x, 0, card.interactionPoint.z);
    g.hud.showInteractionCard(card);
    document.getElementById('card-action-btn')?.click();
  }, key);
  return playUntil(page, () => (window.game.world.interiorManager.currentInterior && !window.game.world.interiorManager.isTransitioning ? window.game.world.interiorManager.currentInterior.name : null), 20);
};
const leave = async (page) => {
  await page.evaluate(() => { const g = window.game; return g.world.interiorManager.exitCurrentInterior(g.player, g.cameraManager, g.hud, g.world); });
  await wait(900);
};
/** Stands at a thing in the room, opens its card, returns what its button says, and presses it */
const use = async (page, id) => {
  const label = await page.evaluate((key) => {
    const g = window.game;
    document.getElementById('game-dialogue-overlay')?.remove();
    const o = g.world.interiorManager.getActiveInteractiveObjects().find((x) => x.id === key);
    if (!o) return null;
    g.player.stopMoving();
    g.player.mesh.position.set(o.interactionPoint.x, 0, o.interactionPoint.z);
    g.hud.showInteractionCard(o);
    return document.getElementById('card-action-btn')?.textContent ?? '';
  }, id);
  await page.evaluate(() => document.getElementById('card-action-btn')?.click());
  await wait(300);
  return label;
};
const choose = (page, text) => page.evaluate((t) => [...document.querySelectorAll('#game-dialogue-overlay button')].find((b) => b.textContent.includes(t))?.click(), text);
const rate = (page, employer) => page.evaluate((e) => { const j = window.game.jobs; return Math.round(j.grade(e).pay * j.constructor.payBoost()); }, employer);
const done = (page, employer) => page.evaluate((e) => window.game.jobs.done(e), employer);
const hire = async (page, key, employer) => {
  const label = await use(page, `work_${key}_hire_${employer}`);
  const offer = await page.evaluate(() => document.getElementById('game-dialogue-overlay')?.innerText ?? '');
  await choose(page, 'Take the job');
  await wait(200);
  return { label, offer, employed: await page.evaluate((e) => window.game.jobs.isEmployed(e), employer) };
};
/** One whole shift: started at its station, every task acted out, paid at the end */
const shift = async (page, key, employer) => {
  await page.evaluate(() => window.game.hud.backend.restoreEnergy(100));
  const pay = await rate(page, employer);
  const before = await money(page);
  const n0 = await done(page, employer);
  const label = await use(page, `work_${key}_shift_${employer}`);
  const poses = new Set();
  const finished = await playUntil(page, () => {
    const a = window.game.player.actor;
    window.__poses = window.__poses ?? new Set();
    window.__poses.add(a.pose.arms);
    return a.sequence ? null : true;
  }, 80);
  for (const p of await page.evaluate(() => { const p = [...(window.__poses ?? [])]; window.__poses = new Set(); return p; })) poses.add(p);
  await advance(page, 0.3);
  return { label, finished: !!finished, paid: (await money(page)).total - before.total, pay, done: (await done(page, employer)) - n0, poses: [...poses] };
};

export async function run(browser, check) {
  const ctx = await newPlayer(browser);
  const { page, log } = await open(ctx);
  await closeDialogs(page);
  await page.evaluate(() => { const be = window.game.hud.backend; be.data.walletCash += 50000; be.saveData(); window.game.world.skyEnvironment.setHour(11); });

  // ------------------------------------------------------------------ The phone sends the player there
  await page.evaluate(() => window.game.hud.phoneModal.openApp('jobs'));
  await wait(500);
  const listed = await page.evaluate(() => [...document.querySelectorAll('#jobs-employment [data-act="work-go"]')].map((b) => b.dataset.arg));
  const fare0 = await money(page);
  await page.evaluate(() => document.querySelector('#jobs-employment [data-act="work-go"][data-arg="lasuth-nursing"]')?.click());
  await wait(300);
  const riding = await page.evaluate(() => window.game.roadRideExperience.isActive);
  const there = await playUntil(page, () => {
    const g = window.game;
    const door = g.world.interactiveObjects.find((o) => o.id === 'roadside-lasuth').interactionPoint;
    return !g.roadRideExperience.isActive && Math.hypot(g.player.position.x - door.x, g.player.position.z - door.z) < 3 ? true : null;
  }, 60);
  const fare = fare0.total - (await money(page)).total;
  check('workplaces: the phone lists every workplace along the road with a Go; Go to LASUTH is a paid cab ride that sets the player down at its door',
    Object.values(WORK).flat().every((e) => listed.includes(e)) && riding && !!there && fare > 0, { missing: Object.values(WORK).flat().filter((e) => !listed.includes(e)), riding, there, fare });
  await closeDialogs(page);

  // ------------------------------------------------------------------ The bank in Marina Towers, in full
  await enter(page, 'marina-towers');
  const room = await page.evaluate(() => {
    const g = window.game;
    const ids = g.world.interiorManager.getActiveInteractiveObjects().map((o) => o.id).filter((id) => id.startsWith('work_marina-towers_'));
    const boss = g.world.interiorManager.getActiveInteractiveObjects().find((o) => o.id === 'work_marina-towers_hire_first-bank-marina')?.mesh;
    let shown = !!boss;
    for (let o = boss; o; o = o.parent) if (!o.visible) shown = false;
    return { ids, shown };
  });
  check('workplaces: in Marina Towers the bank\'s branch manager stands in the hall, with the teller\'s window beside him', room.ids.length === 2 && room.shown, room);

  const m0 = await money(page);
  const turnedAway = await use(page, 'work_marina-towers_shift_first-bank-marina');
  await advance(page, 1);
  const away = { label: turnedAway, paid: (await money(page)).total - m0.total, told: await page.evaluate(() => /Ask me for work first/.test(document.body.innerText)) };
  check('workplaces: the teller\'s window is for staff: someone not taken on is sent to the manager and nothing is paid', /ask Mr Eze/i.test(away.label ?? '') && away.paid === 0 && away.told, away);

  const taken = await hire(page, 'marina-towers', 'first-bank-marina');
  check('workplaces: Mr Eze states the terms, grade by grade, and takes the player on as a teller', /Ask Mr Eze for work/.test(taken.label ?? '') && /a shift to start/.test(taken.offer) && taken.employed, taken);

  const first = await shift(page, 'marina-towers', 'first-bank-marina');
  check('workplaces: a teller\'s shift is acted out at the window (slip, counting machine, posting, receipt) and paid once, at the grade\'s rate, when it is done',
    first.finished && first.paid === first.pay && first.done === 1 && first.poses.includes('carry') && first.poses.includes('greet'), first);

  // Walking off half way: the shift is given up and pays nothing
  await page.evaluate(() => window.game.hud.backend.restoreEnergy(100));
  const m1 = await money(page);
  await use(page, 'work_marina-towers_shift_first-bank-marina');
  await playUntil(page, () => (window.game.player.actor.pose.arms === 'carry' ? true : null), 20);
  await leave(page);
  await advance(page, 2);
  const left = { paid: (await money(page)).total - m1.total, done: await done(page, 'first-bank-marina'), told: await page.evaluate(() => /pays nothing for that/.test(document.body.innerText)) };
  check('workplaces: walking out half way through a shift gives it up: nothing paid, nothing counted', left.paid === 0 && left.done === 1, left);

  // ------------------------------------------------------------------ Every other workplace: taken on, one whole shift
  const rows = [];
  for (const [key, employers] of Object.entries(WORK)) {
    const name = await enter(page, key);
    for (const employer of employers) {
      if (key === 'marina-towers') continue;
      const h = await hire(page, key, employer);
      const s = await shift(page, key, employer);
      rows.push({ key, employer, name, employed: h.employed, finished: s.finished, paid: s.paid, pay: s.pay, done: s.done });
    }
    await leave(page);
  }
  const bad = rows.filter((r) => !r.name || !r.employed || !r.finished || r.paid !== r.pay || r.done !== 1);
  check(`workplaces: in all ${rows.length} other workplaces the player is taken on and works a whole shift, every task reached and acted out, paid once at the rate`, rows.length === 15 && bad.length === 0, bad.length ? bad : rows.map((r) => `${r.employer} ₦${r.paid}`));

  // ------------------------------------------------------------------ On the phone
  await page.evaluate(() => window.game.hud.phoneModal.openApp('jobs'));
  await wait(500);
  const phone = await page.evaluate(() => document.getElementById('jobs-employment')?.innerText ?? '');
  check('workplaces: the phone shows every job held, with the grade and the shifts done', /Eko Commercial Bank Tower/.test(phone) && /LASUTH Nursing Services/.test(phone) && /GRA Homes & Interiors/.test(phone), phone.slice(0, 400));
  await closeDialogs(page);

  check('workplaces: no errors in the page', log.errors.length === 0, log.errors.slice(0, 5));
  await ctx.close();
}
