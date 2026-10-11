// A job at a real workplace: go to the port, be taken on by the foreman, do the work with
// your hands, be paid once for each piece of it at the rate of your grade, move up a grade
// as the work adds up, and find all of that on the phone and still there tomorrow.
import { open, reload, newPlayer, closeDialogs, advance, playUntil, money, wait, untilStopped } from './lib.mjs';

const port = (page) => page.evaluate(() => window.game.world.landmarks.status()['apapa-port']);
const career = (page) => page.evaluate(() => ({ ...window.game.hud.backend.getData().career }));
const energy = (page) => page.evaluate(() => window.game.hud.backend.getData().stats.energy);
const choices = (page) => page.evaluate(() => [...document.querySelectorAll('#game-dialogue-overlay button')].map((b) => b.textContent.replace(/\s+/g, ' ').trim()).filter((t) => t && !/^(ok|close|continue)$/i.test(t)));
const choose = (page, text) => page.evaluate((t) => [...document.querySelectorAll('#game-dialogue-overlay button')].find((b) => b.textContent.includes(t))?.click(), text);
const asked = (page) => page.evaluate(() => document.getElementById('game-dialogue-overlay')?.innerText ?? '');
const said = (page, pattern) => page.evaluate((source) => new RegExp(source, 'i').test(document.body.innerText), pattern);

/** Stands at a thing at the port, opens its card, returns what the button says and presses it. */
async function use(page, id) {
  const label = await page.evaluate(async (key) => {
    const g = window.game;
    const o = g.world.interactiveObjects.find((x) => x.id === key);
    if (!o) return 'not-found';
    document.getElementById('game-dialogue-overlay')?.remove();
    g.hud.hideInteractionCard();
    g.player.stopMoving();
    g.player.mesh.position.set(o.interactionPoint.x, 0, o.interactionPoint.z);
    await g.advance(0.1);
    g.hud.showInteractionCard(o);
    return document.getElementById('card-action-btn')?.textContent ?? null;
  }, id);
  await page.evaluate(() => document.getElementById('card-action-btn')?.click());
  await wait(300);
  return label;
}

/** Loads one lorry from start to pay, and waits for the next lorry to be in the bay. */
async function loadOne(page) {
  await page.evaluate(() => window.game.hud.backend.restoreEnergy(100));
  const before = await money(page);
  const label = await use(page, 'apapa-port-loading-bay');
  await playUntil(page, () => (window.game.world.landmarks.status()['apapa-port'].bay === 'leaving' ? true : null), 90);
  const paid = (await money(page)).total - before.total;
  // What the foreman says as he pays, while it is still on the screen
  const told = await page.evaluate(() => [...document.querySelectorAll('body *')].filter((el) => el.children.length === 0 && /The foreman pays you/.test(el.textContent)).map((el) => el.textContent).pop() ?? '');
  await playUntil(page, () => (window.game.world.landmarks.status()['apapa-port'].bay === 'ready' ? true : null), 80);
  return { label, paid, told };
}

export async function run(browser, check) {
  const ctx = await newPlayer(browser);
  const { page, log } = await open(ctx);
  await closeDialogs(page);

  // ------------------------------------------------------------------ To the workplace
  await page.click('#nav-btn-map');
  await wait(1800);
  await page.evaluate(() => document.querySelector('.map-pin[data-place="apapa_port"]')?.click());
  await wait(600);
  const sheet = await page.evaluate(() => document.body.innerText);
  await page.evaluate(() => document.getElementById('btn-card-go')?.click());
  await wait(400);
  // On foot from the map is a walk by the streets
  await untilStopped(page, 60);
  const arrived = await page.evaluate(() => {
    const g = window.game;
    const gate = g.world.interactiveObjects.find((o) => o.id === 'apapa-port').interactionPoint;
    return { mapOpen: g.world.worldMap.isActive, fromGate: Math.hypot(g.player.position.x - gate.x, g.player.position.z - gate.z) };
  });
  check('the port is chosen on the map and Go walks the player to its gate on Wharf Road', /Apapa Port/.test(sheet) && !arrived.mapOpen && arrived.fromGate < 3, arrived);

  // ------------------------------------------------------------------ Not taken on, no work
  const start = await money(page);
  const startCareer = await career(page);
  const closedLabel = await use(page, 'apapa-port-loading-bay');
  await advance(page, 3);
  let state = await port(page);
  check('the loading bay is for the port\'s own hands: someone the foreman has not taken on is turned away and nothing is paid',
    /ask the foreman/i.test(closedLabel || '') && state.bay === 'ready' && !state.employed && (await said(page, 'Ask me for work first')) && (await money(page)).total === start.total, { closedLabel, state });

  // ------------------------------------------------------------------ Taken on
  const foremanLabel = await use(page, 'apapa-port-foreman');
  const terms = await asked(page);
  const offered = await choices(page);
  await choose(page, 'Take the job');
  await wait(300);
  state = await port(page);
  const day = await page.evaluate(() => ({ today: window.game.world.skyEnvironment.day, since: window.game.jobs.since('apapa-port') }));
  check('the foreman says what the work pays at each grade, and taking the job makes the player a casual hand at the port from today',
    /Ask the foreman for work/.test(foremanLabel || '') && /6,000/.test(terms) && /9,000/.test(terms) && /12,000/.test(terms) && offered.some((o) => /Take the job/.test(o)) && state.employed && state.grade === 'Casual hand' && state.rate === 6000 && state.loads === 0 && day.since === day.today,
    { foremanLabel, offered, state, day });

  await page.evaluate(() => window.game.hud.phoneModal.openApp('jobs'));
  await wait(900);
  const onPhone = await page.evaluate(() => document.getElementById('jobs-employment')?.innerText ?? '');
  await page.evaluate(() => window.game.hud.phoneModal.close());
  await wait(300);
  check('the phone\'s Jobs app shows the job: Apapa Port, casual hand, what the work is and what it pays', /Apapa Port/.test(onPhone) && /Casual hand/.test(onPhone) && /6,000/.test(onPhone) && /Dock hand at 3/.test(onPhone), onPhone);

  // ------------------------------------------------------------------ The work, and the pay
  const tiredAt = await energy(page);
  const first = await loadOne(page);
  state = await port(page);
  const afterFirst = await career(page);
  check('a lorry is loaded by hand and paid for once at the casual rate, ₦6,000; it counts as a job done and toward the career',
    /Load the lorry/.test(first.label || '') && /6,000/.test(first.label || '') && first.paid === 6000 && state.loads === 1 && state.paidRuns === 1 && afterFirst.completedGigs === startCareer.completedGigs + 1 && afterFirst.xp === startCareer.xp + 20,
    { first, loads: state.loads, career: afterFirst, tiredAt });

  const second = await loadOne(page);
  const third = await loadOne(page);
  state = await port(page);
  const promoted = /makes you dock hand: ₦9,000 a load/.test(third.told) && !/makes you/.test(second.told);
  check('after three lorries the foreman makes the player a dock hand', second.paid === 6000 && third.paid === 6000 && state.loads === 3 && state.grade === 'Dock hand' && state.rate === 9000 && promoted, { second, third, state, promoted });

  const fourth = await loadOne(page);
  state = await port(page);
  const ledger = await page.evaluate(() => window.game.hud.backend.getData().transactionHistory.filter((t) => t.type === 'JOB_SALARY' && /Apapa Port/.test(t.description)).map((t) => t.amount));
  check('the next lorry is paid at the dock hand\'s rate, ₦9,000: four loads, four payments, each once',
    /9,000/.test(fourth.label || '') && fourth.paid === 9000 && state.loads === 4 && JSON.stringify(ledger.slice().sort()) === JSON.stringify([6000, 6000, 6000, 9000]), { fourth, ledger });

  // ------------------------------------------------------------------ Still there tomorrow
  const purse = await money(page);
  const careerNow = await career(page);
  await reload(page);
  await closeDialogs(page);
  state = await port(page);
  const careerAfter = await career(page);
  check('after closing the game and coming back the player is still a dock hand with four loads behind them, the career is as it was, and nothing was paid again',
    state.employed && state.grade === 'Dock hand' && state.loads === 4 && careerAfter.xp === careerNow.xp && careerAfter.completedGigs === careerNow.completedGigs && (await money(page)).total === purse.total, { state, careerAfter });

  // ------------------------------------------------------------------ Leaving the job
  const mine = await use(page, 'apapa-port-foreman');
  const book = await asked(page);
  await choose(page, 'Leave the job');
  await wait(300);
  state = await port(page);
  const shut = await use(page, 'apapa-port-loading-bay');
  await advance(page, 2);
  check('the foreman knows where the player stands (dock hand, four loaded, four more to gang leader); leaving the job shuts the bay to them again',
    /Dock hand: 4 loaded/.test(mine || '') && /4 more/.test(book) && /gang leader/i.test(book) && !state.employed && /ask the foreman/i.test(shut || '') && (await port(page)).bay === 'ready', { mine, state, shut });

  check('no errors were logged at any of it', log.errors.length === 0, log.errors.slice(0, 5));
  await ctx.close();
}
