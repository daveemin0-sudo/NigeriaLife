// A brand-new player on a phone, from the first screen through the first five minutes, with real
// taps and no game server (the guide must not need one). The title welcomes them; in the street
// one slim line says the next thing worth doing: walk, greet Chief Alabi (who asks their name and
// remembers how they answered), ask Amaka for work, lay a course of blocks (the wall grows) and
// be paid, buy something to eat, look at the rooms they can afford. Each step is ticked by what
// was really done. The page is loaded again part-way three times and the guide carries on from
// the same step. Afterwards: the guide is gone for good, a second new player who does things in
// another order is not held back, ✕ is remembered, and a life already under way never sees it.
import { newPlayer, wait, GAME_URL } from './lib.mjs';

const PHONE = { viewport: { width: 316, height: 700, isMobile: true, hasTouch: true, deviceScaleFactor: 2 }, userAgent: 'Mozilla/5.0 (Linux; Android 14; SM-A165F) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36' };

async function phone(browser, { guide = true, title = true, hour = 10 } = {}) {
  const ctx = await newPlayer(browser);
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message.slice(0, 200)));
  await page.emulate(PHONE);
  // The title and the guide are on, as they are for a real visitor; the site keeps day hours, so it is morning
  await page.evaluateOnNewDocument((on, withTitle, at) => {
    window.__titleOn = withTitle;
    window.__firstStepsOn = on;
    const t = setInterval(() => { const sky = window.game?.world?.skyEnvironment; if (!sky) return; clearInterval(t); sky.setHour(at); }, 10);
  }, guide, title, hour);
  const load = async (again = false) => {
    if (again) await page.reload({ waitUntil: 'load', timeout: 240000 });
    else await page.goto(GAME_URL, { waitUntil: 'load', timeout: 240000 });
    await page.waitForFunction('window.game && (window.titleScreen || !window.__titleOn)', { timeout: 240000 });
    await page.waitForFunction(() => !document.getElementById('nl-splash'), { timeout: 240000 });
    await wait(1500);
  };
  await load();
  const centre = (sel) => page.evaluate((s) => {
    const e = [...document.querySelectorAll(s)].find((x) => { const r = x.getBoundingClientRect(); return r.width > 0 && getComputedStyle(x).display !== 'none' && getComputedStyle(x).visibility !== 'hidden'; });
    if (!e) return null;
    e.scrollIntoView({ block: 'center' });
    const r = e.getBoundingClientRect();
    const x = r.left + r.width / 2, y = r.top + r.height / 2;
    const top = document.elementFromPoint(x, y);
    return { x, y, reachable: top === e || e.contains(top), inView: r.left >= 0 && r.right <= innerWidth && r.top >= 0 && r.bottom <= innerHeight, text: e.textContent.trim().slice(0, 40) };
  }, sel);
  const tap = async (sel) => {
    const c = await centre(sel);
    if (c) await page.touchscreen.tap(c.x, c.y);
    await wait(500);
    return c;
  };
  const guideLine = () => page.evaluate(() => {
    const e = document.getElementById('nl-first-steps');
    if (!e || getComputedStyle(e).display === 'none') return null;
    const r = e.getBoundingClientRect();
    const buttons = [...e.querySelectorAll('button')];
    return {
      step: e.dataset.step, n: e.querySelector('.fs-n')?.textContent ?? '', text: e.querySelector('.fs-text')?.textContent ?? '',
      buttons: buttons.map((b) => b.textContent.trim()),
      inView: r.left >= 0 && r.right <= innerWidth && buttons.every((b) => { const q = b.getBoundingClientRect(); return q.left >= 0 && q.right <= innerWidth; }),
    };
  });
  const until = async (fn, seconds) => {
    const end = Date.now() + seconds * 1000;
    while (Date.now() < end) {
      const v = await fn();
      if (v) return v;
      await wait(250);
    }
    return null;
  };
  const morning = () => page.evaluate((at) => window.game.world.skyEnvironment.setHour(at), hour);
  const adv = async (seconds) => { for (let s = 0; s < seconds; s += 0.5) { await page.evaluate(() => window.game.advance(0.5)); await wait(25); } };
  const card = () => page.evaluate(() => { const c = document.getElementById('interaction-card'); return c && getComputedStyle(c).display !== 'none' ? { title: document.getElementById('card-title')?.textContent ?? '', action: document.getElementById('card-action-btn')?.textContent.trim() ?? '' } : null; });
  const dialogue = () => page.evaluate(() => document.getElementById('game-dialogue-overlay')?.innerText.replace(/\s+/g, ' ') ?? null);
  /** The line's own button ("Take me", or what is done there once beside it), then the walk, until the card is up */
  const go = async (seconds = 90) => {
    await morning();
    const pressed = await tap('#nl-first-steps .fs-go, #nl-first-steps .fs-there');
    for (let s = 0; s < seconds; s += 2) {
      await adv(2);
      if (await card()) break;
    }
    await wait(500);
    return { pressed, card: await card() };
  };
  const stepIs = (id, seconds = 8) => until(async () => ((await guideLine())?.step === id ? guideLine() : null), seconds);
  const life = () => page.evaluate(() => {
    const g = window.game;
    const d = g.hud.backend.getData();
    return {
      name: d.username, shown: g.player.config.name, money: d.walletCash + d.bank.balance, paid: d.career.completedGigs,
      steps: localStorage.getItem('nl_first_steps_v1'), elder: JSON.parse(localStorage.getItem('nl_chief_alabi_v1') || 'null'),
      signIn: !!document.getElementById('nl-signin'), creator: g.hud.creatorModal.isOpen === true,
      toasts: [...document.querySelectorAll('.game-toast')].map((t) => t.textContent).join(' | '),
    };
  });
  const greetElder = async () => {
    let asks = null;
    for (let tries = 0; tries < 2 && !asks; tries++) {
      if (!(await card())) await go();
      await tap('#card-action-btn');
      await adv(3);
      asks = await until(dialogue, 10);
    }
    return asks;
  };
  return { ctx, page, errors, load, centre, tap, guideLine, until, morning, adv, card, dialogue, go, stepIs, life, greetElder };
}

export async function run(browser, check) {
  const p = await phone(browser);
  const { page } = p;

  // ------------------------------------------------------------------ The first screen
  const title = await page.evaluate(() => {
    const c = document.getElementById('title-card');
    return { text: c?.innerText.replace(/\s+/g, ' ') ?? '', buttons: [...(c?.querySelectorAll('button') ?? [])].map((b) => b.textContent.trim()) };
  });
  check('onboarding: a first visit is welcomed and offered "Start your life": no made-up life to continue, no name that is not theirs',
    /Welcome/.test(title.text) && title.buttons.length === 1 && title.buttons[0] === 'Start your life' && !/Bayo/.test(title.text), title);
  const start = await p.tap('#title-continue');
  await wait(2500);

  // ------------------------------------------------------------------ In the street at once
  const first = await p.until(p.guideLine, 8);
  const arrived = await p.life();
  check('onboarding: Start puts them in the street at once: no sign-up screen, no look editor, one slim line about walking, inside the screen',
    !!start?.reachable && !!first && first.step === 'move' && /stick/i.test(first.text) && first.inView && !arrived.signIn && !arrived.creator, { start, first, arrived });

  const stick = await p.centre('.v-joystick-base');
  if (stick) {
    await page.touchscreen.touchStart(stick.x, stick.y);
    await page.touchscreen.touchMove(stick.x, stick.y - 40);
    await p.until(async () => (await p.guideLine())?.step !== 'move', 25);
    await page.touchscreen.touchEnd();
  }
  await wait(700);
  const called = await p.guideLine();
  const marker = await page.evaluate(() => {
    const g = window.game;
    const m = g.world.scene.getObjectByName('guide-marker');
    const elder = g.world.interactiveObjects.find((o) => o.id === 'community-elder');
    return m && elder ? { visible: m.visible, off: +Math.hypot(m.position.x - elder.mesh.position.x, m.position.z - elder.mesh.position.z).toFixed(1), high: +m.position.y.toFixed(1) } : null;
  });
  check('onboarding: a few steps with the stick and Chief Alabi is calling: the line says so with how far and "Take me", and a marker floats over his head',
    !!stick && !!called && called.step === 'elder' && /Chief Alabi/.test(called.text) && /\d+ m/.test(called.text) && called.buttons.includes('Take me') && called.inView && !!marker && marker.visible && marker.off < 1 && marker.high > 2, { called, marker });

  // ------------------------------------------------------------------ Loaded again: the same step
  await wait(1500);
  await p.load(true);
  const backTitle = await page.evaluate(() => [...(document.getElementById('title-card')?.querySelectorAll('button') ?? [])].map((b) => b.textContent.trim()));
  await p.tap('#title-continue');
  const resumed = await p.stepIs('elder', 10);
  check('onboarding: the page loaded again before meeting him: the title offers to carry on and the line is still about Chief Alabi, not about walking again',
    backTitle.includes('Continue') && !!resumed && resumed.step === 'elder', { backTitle, resumed });

  // ------------------------------------------------------------------ Chief Alabi
  const toElder = await p.go();
  const greet = await p.tap('#card-action-btn');
  await p.adv(3);
  const asks = await p.until(p.dialogue, 8);
  const nameField = await p.tap('#dialogue-name-input');
  await page.type('#dialogue-name-input', 'Tunde');
  await wait(300);
  const replies = await page.$$('.dialogue-choice-btn');
  check('onboarding: "Take me" walks up to him and his card offers to greet him; greeted, he asks who they are, with a place to say a name and three ways to answer',
    !!toElder.pressed?.reachable && /Chief Alabi/.test(toElder.card?.title ?? '') && /Greet/.test(toElder.card?.action ?? '') && !!greet?.reachable && /Who are you/.test(asks ?? '') && !!nameField?.reachable && replies.length === 3, { toElder, asks });
  if (replies[1]) await replies[1].tap();
  await wait(900);
  const answer = await p.dialogue();
  await p.tap('.dialogue-choice-btn');
  await wait(900);
  const roof = await p.dialogue();
  await p.tap('#dialogue-confirm-btn');
  await wait(900);
  const met = await p.life();
  const next = await p.stepIs('hire');
  check('onboarding: he answers the way they spoke ("How far, Chief!"), calls them by the name they gave, tells them of Amaka\'s site and of rooms to let; the name is theirs now',
    /How far, Chief/.test(answer ?? '') && /Tunde/.test(answer ?? '') && /Amaka/.test(answer ?? '') && /rooms/.test(roof ?? '') && met.name === 'Tunde' && met.shown === 'Tunde' && met.elder?.answer === 'street' && met.elder?.told === true, { answer, roof, met });
  check('onboarding: with him met the line moves to the work he spoke of: Supervisor Amaka, with how far and "Take me"',
    !!next && /Amaka/.test(next.text) && next.buttons.includes('Take me') && next.inView, next);

  // ------------------------------------------------------------------ Loaded again: he remembers, the step stands
  await wait(1500);
  await p.load(true);
  await p.tap('#title-continue');
  const resumed2 = await p.stepIs('hire', 10);
  const remembered = await page.evaluate(() => window.game.world.interactiveObjects.find((o) => o.id === 'community-elder')?.description ?? '');
  check('onboarding: loaded again after meeting him: the line is still about Amaka, and his card now speaks of the first meeting by their name',
    !!resumed2 && /Tunde/.test(remembered) && /how far Chief/i.test(remembered), { resumed2, remembered });

  // ------------------------------------------------------------------ Taken on
  const toSite = await p.go(120);
  const ask = await p.tap('#card-action-btn');
  await p.adv(4);
  const offer = await p.until(p.dialogue, 8);
  await p.tap('.dialogue-choice-btn');
  await wait(1200);
  if (await p.dialogue()) await p.tap('#dialogue-confirm-btn');
  const work = await p.stepIs('work');
  check('onboarding: "Take me" walks to Supervisor Amaka, she offers the block work at ₦5,000 a course, and taken on the line says to lay a course, with "Start work"',
    /Amaka/.test(toSite.card?.title ?? '') && !!ask?.reachable && /5,000/.test(offer ?? '') && !!work && /course/i.test(work.text) && work.buttons.includes('Start work'), { toSite, offer, work });

  // ------------------------------------------------------------------ Loaded again: still taken on
  await wait(1500);
  await p.load(true);
  await p.tap('#title-continue');
  const resumed3 = await p.stepIs('work', 10);
  check('onboarding: loaded again after being taken on: the line is still about laying the course', !!resumed3, resumed3);

  // ------------------------------------------------------------------ The work, the wall, the pay
  const before = await page.evaluate(() => ({ ...window.game.world.landmarks.buildingSite.status(), money: window.game.hud.backend.getData().walletCash }));
  const toPallet = await p.go(60);
  const lay = await p.tap('#card-action-btn');
  let half = null;
  for (let s = 0; s < 300; s += 3) {
    await p.morning();
    await p.adv(3);
    const st = await page.evaluate(() => window.game.world.landmarks.buildingSite.status());
    if (!half && st.inWall >= 3) half = { ...st, line: await p.guideLine(), cam: await page.evaluate(() => { const c = window.game.cameraManager.camera.position; return { x: +c.x.toFixed(1), z: +c.z.toFixed(1) }; }) };
    if (!st.working && st.paidRuns > before.paidRuns) break;
  }
  await wait(1200);
  const after = await page.evaluate(() => ({ ...window.game.world.landmarks.buildingSite.status(), money: window.game.hud.backend.getData().walletCash, paid: window.game.hud.backend.getData().career.completedGigs }));
  const eat = await p.stepIs('eat');
  check('onboarding: the pallet\'s card starts the course and the work is seen: blocks leave the pallet and the wall grows block by block (0 to 6), with no button on the line while carrying',
    /Pallet/.test(toPallet.card?.title ?? '') && !!lay?.reachable && before.inWall === 0 && !!half && half.inWall >= 3 && half.inWall < 6 && half.onPallet < 6 && !(half.line?.buttons ?? []).includes('Start work') && after.inWall === 6 && after.courses === 1, { before, half, after });
  // They walked down from Chief Alabi, so the camera came in behind them from the north, where it would
  // stand over a floor of the unfinished building and its slab would hide the wall
  const overTheFrame = !!half && half.cam.x > 13.5 && half.cam.x < 24.5 && half.cam.z > 48.8 && half.cam.z < 60.8;
  check('onboarding: while the blocks go down the view is from the open side of the yard, not from over the unfinished building, so the wall is seen growing', !!half && !overTheFrame, half?.cam);
  check('onboarding: the course is paid at the labourer\'s rate, ₦5,000 in the pocket and one job done, and the line turns to something to eat with "Not hungry" beside it',
    after.money === before.money + 5000 && after.paid === 1 && !!eat && /suya/i.test(eat.text) && eat.buttons.includes('Not hungry') && eat.buttons.includes('Take me') && eat.inView, { before: before.money, after: after.money, eat });

  // ------------------------------------------------------------------ Something to eat, bought with the pay
  const beforeSuya = (await p.life()).money;
  const toSuya = await p.go(120);
  await p.tap('#card-action-btn');
  await p.adv(3);
  await wait(800);
  const dish = await p.tap('.buka-menu .buka-dish');
  for (let s = 0; s < 30; s += 2) { await p.adv(2); if ((await p.guideLine())?.step === 'home') break; }
  const fed = await p.life();
  const home = await p.stepIs('home');
  check('onboarding: "Take me" walks to Mallam Bisi, suya is bought from him with the pay, and the line turns to somewhere to sleep',
    /Bisi/.test(toSuya.card?.title ?? '') && !!dish?.reachable && fed.money < beforeSuya && !!home && /rooms/i.test(home.text), { toSuya, dish, beforeSuya, fed: fed.money, home });

  // ------------------------------------------------------------------ A room within their means
  const toEstate = await p.go(120);
  await page.evaluate(() => document.getElementById('card-close')?.click());
  await wait(400);
  const see = await p.tap('#nl-first-steps .fs-there');
  await wait(1500);
  const rooms = await page.evaluate(() => {
    const d = window.game.hud.backend.getData();
    const funds = d.walletCash + d.bank.balance;
    const rows = [...document.querySelectorAll('#property-list [data-property]')].map((r) => d.properties.find((x) => x.id === r.dataset.property));
    return { app: window.game.hud.phoneModal.currentAppId, n: rows.length, rents: rows.map((r) => r.rentalPriceMonthly), allWithin: rows.every((r) => r.rentalPriceMonthly <= funds), homes: rows.every((r) => !['shop', 'office', 'business', 'land', 'commercial'].includes(r.type)), funds };
  });
  check('onboarding: at the estate the line offers "See rooms": the homes to let that they can pay for now, cheapest first, and only homes',
    /Estate/.test(toEstate.card?.title ?? '') && !!see?.reachable && rooms.app === 'property' && rooms.n >= 2 && rooms.allWithin && rooms.homes && rooms.rents.every((r, i) => i === 0 || r >= rooms.rents[i - 1]), { toEstate, rooms });
  const stillOpen = await page.evaluate(() => !!document.getElementById('nl-first-steps'));
  await page.evaluate(() => window.game.hud.phoneModal.close());
  const over = await p.until(async () => ((await p.life()).steps === 'done' ? p.life() : null), 8);
  const gone = await p.guideLine();
  check('onboarding: with no game server there is no account to offer: back in the street the guide ends with a word about what is next, and is gone (not while the list was still being read)',
    stillOpen && !!over && gone === null && /first day in Lagos/i.test(over.toasts), { stillOpen, over, gone });

  // ------------------------------------------------------------------ Coming back
  await wait(1500);
  await p.load(true);
  const back = await page.evaluate(() => { const c = document.getElementById('title-card'); return { text: c?.innerText.replace(/\s+/g, ' ') ?? '', buttons: [...(c?.querySelectorAll('button') ?? [])].map((b) => b.textContent.trim()) }; });
  await p.tap('#title-continue');
  await wait(3000);
  const again = await p.guideLine();
  check('onboarding: after a reload the title offers to continue their own life by their own name, and the guide does not come back',
    back.buttons.includes('Continue') && /Tunde/.test(back.text) && !/Welcome\./.test(back.text) && again === null, { back, again });
  check('onboarding: no errors in the page (the whole five minutes)', p.errors.length === 0, p.errors.slice(0, 4));
  await p.ctx.close();

  // ------------------------------------------------------------------ Another order: work first
  const q = await phone(browser);
  await q.tap('#title-continue');
  await wait(2500);
  // They ignore the line and walk straight to the site (a tap on Amaka herself)
  await q.morning();
  await q.page.evaluate(() => { const g = window.game; g.input.approachAndInteract(g.world.interactiveObjects.find((o) => o.id === 'eko-plaza-site-supervisor')); });
  for (let s = 0; s < 120; s += 2) { await q.adv(2); if (await q.card()) break; }
  await q.tap('#card-action-btn');
  await q.adv(4);
  await q.until(q.dialogue, 8);
  await q.tap('.dialogue-choice-btn');
  await wait(1200);
  if (await q.dialogue()) await q.tap('#dialogue-confirm-btn');
  const order = await q.guideLine();
  const kept = await q.life();
  check('onboarding: a player who goes straight to Amaka is taken on all the same; the line still only suggests Chief Alabi (the first thing not done) and the work is kept as done',
    !!order && order.step === 'elder' && /"hire"/.test(kept.steps ?? '') && (await q.page.evaluate(() => window.game.modules.Employment.get().isEmployed('eko-plaza-site'))), { order, kept: kept.steps });
  // Chief Alabi, greeted now, knows they have work already and the line skips past it
  const reached = await q.go();
  const asked = await q.greetElder();
  await q.tap('.dialogue-choice-btn');
  await wait(900);
  const said = await q.dialogue();
  await q.tap('.dialogue-choice-btn');
  await wait(900);
  await q.tap('#dialogue-confirm-btn');
  const skipsOn = await q.stepIs('work');
  check('onboarding: once he is greeted the line goes straight to the course they were already taken on for (not back to asking for work)', !!skipsOn && /course/i.test(skipsOn.text), { skipsOn, reached, asked: asked?.slice(0, 80), said: said?.slice(0, 120), line: await q.guideLine(), life: await q.life() });

  // ------------------------------------------------------------------ ✕ is remembered
  const skip = await q.tap('#nl-first-steps .fs-skip');
  await wait(600);
  const skipped = { line: await q.guideLine(), kept: (await q.life()).steps, marker: await q.page.evaluate(() => window.game.world.scene.getObjectByName('guide-marker')?.visible ?? false) };
  await wait(1200);
  await q.load(true);
  await q.tap('#title-continue');
  await wait(3500);
  const afterSkip = { line: await q.guideLine(), kept: (await q.life()).steps };
  check('onboarding: ✕ ends the guide at once (line and marker gone) and it is still gone after the page loads again',
    !!skip?.reachable && skipped.line === null && skipped.kept === 'skipped' && skipped.marker === false && afterSkip.line === null && afterSkip.kept === 'skipped', { skipped, afterSkip });
  check('onboarding: no errors in the page (another order, skipping)', q.errors.length === 0, q.errors.slice(0, 4));
  await q.ctx.close();

  // ------------------------------------------------------------------ At night: the port
  const n = await phone(browser, { hour: 21 });
  await n.tap('#title-continue');
  await wait(2500);
  await n.page.evaluate(() => window.game.guide?.tick('move'));
  await n.stepIs('elder');
  await n.go();
  const nightAsks = await n.greetElder();
  await n.tap('.dialogue-choice-btn');
  await wait(900);
  const nightAnswer = await n.dialogue();
  await n.tap('.dialogue-choice-btn');
  await wait(900);
  await n.tap('#dialogue-confirm-btn');
  const toPort = await n.stepIs('hire');
  check('onboarding: at nine at night Chief Alabi says the site has knocked off and sends them to Foreman Sunday at the port, and the line follows him',
    !!nightAsks && /knocked off/.test(nightAnswer ?? '') && /Foreman Sunday/.test(nightAnswer ?? '') && !!toPort && /Foreman Sunday/.test(toPort.text) && toPort.buttons.includes('Take me'), { nightAnswer: nightAnswer?.slice(0, 260), toPort });
  const atPort = await n.go(180);
  await n.tap('#card-action-btn');
  await n.adv(4);
  const portOffer = await n.until(n.dialogue, 10);
  await n.tap('.dialogue-choice-btn');
  await wait(1200);
  if (await n.dialogue()) await n.tap('#dialogue-confirm-btn');
  const load = await n.stepIs('work');
  const portBefore = await n.page.evaluate(() => ({ ...window.game.world.landmarks.port.status(), money: window.game.hud.backend.getData().walletCash }));
  const atBay = await n.go(120);
  await n.tap('#card-action-btn');
  for (let s = 0; s < 300; s += 3) {
    await n.morning();
    await n.adv(3);
    const st = await n.page.evaluate(() => window.game.world.landmarks.port.status());
    if (st.paidRuns > portBefore.paidRuns) break;
  }
  await wait(1200);
  const portAfter = await n.page.evaluate(() => ({ ...window.game.world.landmarks.port.status(), money: window.game.hud.backend.getData().walletCash, paid: window.game.hud.backend.getData().career.completedGigs }));
  const nightEat = await n.stepIs('eat');
  check('onboarding: the foreman takes them on at night, the line says to load the lorry, the load is carried and paid (₦6,000 at the port), and the line moves on',
    /Foreman/.test(atPort.card?.title ?? '') && /6,000/.test(portOffer ?? '') && !!load && /lorry/i.test(load.text) && !!atBay.card && portAfter.paidRuns === portBefore.paidRuns + 1 && portAfter.money === portBefore.money + 6000 && portAfter.paid === 1 && !!nightEat, { atPort, load, atBay, before: portBefore, after: portAfter, nightEat });
  check('onboarding: no errors in the page (at night)', n.errors.length === 0, n.errors.slice(0, 4));
  await n.ctx.close();

  // ------------------------------------------------------------------ A life already under way
  const r = await phone(browser, { guide: false, title: false });
  await wait(1500);
  // A life from before the guide existed: it has been paid for work and has no record of the guide
  await r.page.evaluate(() => { window.game.hud.backend.addJobExperience(10); localStorage.removeItem('nl_first_steps_v1'); });
  await wait(1500);
  await r.page.evaluateOnNewDocument(() => { window.__firstStepsOn = true; window.__titleOn = true; });
  await r.load(true);
  const oldTitle = await r.page.evaluate(() => [...(document.getElementById('title-card')?.querySelectorAll('button') ?? [])].map((b) => b.textContent.trim()));
  await r.tap('#title-continue');
  await wait(4000);
  const oldLife = { line: await r.guideLine(), kept: (await r.life()).steps, paid: (await r.life()).paid };
  check('onboarding: a life already under way (paid before, no record of the guide) is offered Continue and never sees the guide',
    oldTitle.includes('Continue') && oldLife.line === null && oldLife.paid >= 1, { oldTitle, oldLife });
  await r.ctx.close();
}
