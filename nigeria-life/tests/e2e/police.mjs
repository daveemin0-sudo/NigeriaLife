// The police (src/life/Police.ts, src/life/Offences.ts): stopped at the checkpoint with no papers
// the player is arrested, taken to Area Command and locked in its cell for real minutes; the door
// will not open; bail is paid from the cell (not without the money); out of the cell, the bank
// will not take them on but the port will; a second charge is longer and dearer; an envelope is
// refused (a new charge) or taken (out); time served lets them out; a reload puts them back in the
// cell; the record lapses after thirty days.
import { open, newPlayer, closeDialogs, reload, wait, advance, playUntil, money } from './lib.mjs';

const state = (page) =>
  page.evaluate(() => {
    const g = window.game;
    const P = g.modules.Police.get();
    const im = g.world.interiorManager;
    const o = im.currentInterior?.interiorOrigin;
    const p = g.player.position;
    return {
      custody: P.custody(),
      record: P.record().map((r) => r.offence),
      room: im.currentInterior?.type ?? null,
      inCell: !!o && im.currentInterior?.type === 'police' && Math.hypot(p.x - (o.x + 6), p.z - (o.z - 5.4)) < 2,
      banner: document.getElementById('custody-banner')?.textContent ?? null,
    };
  });
const choices = (page) => page.evaluate(() => [...document.querySelectorAll('#game-dialogue-overlay button')].map((b) => b.textContent.replace(/\s+/g, ' ').trim()));
const choose = (page, text) => page.evaluate((t) => [...document.querySelectorAll('#game-dialogue-overlay button')].find((b) => b.textContent.includes(t))?.click(), text);
const said = (page, pattern) => page.evaluate((source) => new RegExp(source).test(document.body.innerText), pattern);
const setMoney = (page, cash, bank) => page.evaluate(([c, b]) => { const be = window.game.hud.backend; be.data.walletCash = c; be.data.bank.balance = b; be.saveData(); }, [cash, bank]);

/** Stands at a thing (in the street or in the room) and presses its card's button */
async function use(page, id) {
  await page.evaluate((key) => {
    const g = window.game;
    const list = g.world.interiorManager.isPlayerInside() ? g.world.interiorManager.getActiveInteractiveObjects() : g.world.interactiveObjects;
    const o = list.find((x) => x.id === key);
    document.getElementById('game-dialogue-overlay')?.remove();
    g.hud.hideInteractionCard();
    g.player.stopMoving();
    if (!g.world.interiorManager.isPlayerInside()) g.player.mesh.position.set(o.interactionPoint.x, 0, o.interactionPoint.z);
    g.hud.showInteractionCard(o);
  }, id);
  await page.evaluate(() => document.getElementById('card-action-btn')?.click());
  // The player walks up and speaks or reaches first; the choices come after
  for (let i = 0; i < 16; i++) {
    await advance(page, 0.5);
    if (await page.evaluate(() => document.querySelectorAll('#game-dialogue-overlay button').length > 0)) break;
  }
}

export async function run(browser, check) {
  const ctx = await newPlayer(browser);
  const { page, log } = await open(ctx, { w: 1280, h: 760 });
  await closeDialogs(page);
  await page.evaluate(() => {
    const g = window.game;
    g.world.skyEnvironment.timeScale = 0;
    g.world.skyEnvironment.setHour(11);
    const be = g.hud.backend;
    be.data.stats.streetCred = 0;
    be.data.inventory = be.data.inventory.filter((i) => i.category !== 'document' && !/docket|clearance/.test(i.id));
    be.saveData();
  });
  let s = await state(page);
  check('police: a new player has a clean record and is in no cell', s.record.length === 0 && !s.custody, s);

  // ------------------------------------------------------------------ Stopped with no papers
  await use(page, 'street-checkpoint');
  const atCheckpoint = await choices(page);
  await choose(page, 'Present Expired Papers');
  await wait(600);
  const arrestSaid = await said(page, 'You are under arrest for driving without vehicle papers');
  await playUntil(page, () => (window.game.world.interiorManager.currentInterior?.type === 'police' && !window.game.world.interiorManager.isTransitioning ? true : null), 20);
  await wait(500);
  s = await state(page);
  check('police: at the checkpoint with no papers and nobody who knows them, the player is arrested ("under arrest for driving without vehicle papers"), driven to Area Command and put in its cell: five minutes, ₦20,000 bail, shown across the top',
    atCheckpoint.some((c) => /Expired Papers/.test(c)) && arrestSaid && s.room === 'police' && s.inCell && s.custody?.bail === 20_000 && Math.abs(s.custody.until - s.custody.since - 5 * 60_000) < 2000
      && /In the cell at Area Command · \d+ min left · bail ₦20,000/.test(s.banner ?? '') && s.record.join() === 'no-papers',
    { atCheckpoint, arrestSaid, s });
  await closeDialogs(page);

  await page.evaluate(() => { const g = window.game; return g.world.interiorManager.exitCurrentInterior(g.player, g.cameraManager, g.hud, g.world); });
  await wait(600);
  const locked = { room: (await state(page)).room, told: await said(page, 'The cell is locked') };
  check('police: the door will not open: leaving is refused with the time left and the bail', locked.room === 'police' && locked.told, locked);

  // ------------------------------------------------------------------ Bail from the cell
  await setMoney(page, 0, 5_000);
  await use(page, 'police_holding_cell');
  const cell = await choices(page);
  await choose(page, 'Pay my bail');
  await wait(600);
  const short = { still: !!(await state(page)).custody, told: await said(page, 'Bail is ₦20,000 and you do not have it') };
  check('police: the cell\'s card offers bail, an envelope or waiting; without the money the bail is refused and the player stays in',
    cell.some((c) => /Pay my bail · ₦20,000/.test(c)) && cell.some((c) => /Push ₦10,000 through the bars/.test(c)) && cell.some((c) => /Sit and wait/.test(c)) && short.still && short.told,
    { cell, short });
  await closeDialogs(page);
  await setMoney(page, 10_000, 15_000);
  const before = await money(page);
  await use(page, 'police_holding_cell');
  await choose(page, 'Pay my bail');
  await wait(800);
  const after = await money(page);
  s = await state(page);
  check('police: with the money, bail of ₦20,000 is paid (bank, then cash), the cell is unlocked and the player stands outside it; the strip is gone',
    before.total - after.total === 20_000 && !s.custody && s.room === 'police' && !s.inCell && s.banner === null && await said(page, 'Bail paid'),
    { paid: before.total - after.total, s });
  await page.evaluate(() => { const g = window.game; return g.world.interiorManager.exitCurrentInterior(g.player, g.cameraManager, g.hud, g.world); });
  await wait(900);
  const out = (await state(page)).room;
  check('police: out of the cell the player can walk out of the station', out === null, { out });

  // ------------------------------------------------------------------ A record: vetted jobs refuse
  const jobs = await page.evaluate(() => {
    const E = window.game.jobs;
    return { bank: E.apply('first-bank-marina'), port: E.apply('apapa-port') };
  });
  check('police: with a record standing, the bank will not take the player on (it checks records) and the port will',
    !jobs.bank.ok && /check police records, and yours is not clear: it clears on/.test(jobs.bank.reason ?? '') && jobs.port.ok, jobs);

  // ------------------------------------------------------------------ Again: longer and dearer, and an envelope
  await page.evaluate(() => window.game.modules.Police.get().arrest('no-papers'));
  await playUntil(page, () => (window.game.world.interiorManager.currentInterior?.type === 'police' && !window.game.world.interiorManager.isTransitioning ? true : null), 20);
  await wait(400);
  await closeDialogs(page);
  s = await state(page);
  check('police: a second charge with the first still on the record is half as long again and dearer: 8 minutes, ₦30,000', s.inCell && s.custody.bail === 30_000 && Math.abs(s.custody.until - s.custody.since - 8 * 60_000) < 2000, s.custody);

  await setMoney(page, 50_000, 0);
  await page.evaluate(() => { window.__random = Math.random; Math.random = () => 0.9; });
  await use(page, 'police_holding_cell');
  await choose(page, 'Push ₦10,000');
  await wait(800);
  await page.evaluate(() => { Math.random = window.__random; });
  const refused = await state(page);
  check('police: an envelope the officer will not take is a charge of its own: still in, more time, bail up to ₦90,000, and it is on the record',
    refused.inCell && refused.custody.bail === 30_000 + 60_000 && refused.record.filter((r) => r === 'bribery').length === 1 && await said(page, 'You want to bribe an officer'),
    refused);
  await closeDialogs(page);
  await page.evaluate(() => { window.__random = Math.random; Math.random = () => 0.1; });
  await use(page, 'police_holding_cell');
  await choose(page, 'Push ₦10,000');
  await wait(800);
  await page.evaluate(() => { Math.random = window.__random; });
  s = await state(page);
  check('police: an envelope the officer takes lets the player out', !s.custody && !s.inCell && await said(page, 'pockets the envelope'), s);
  await closeDialogs(page);

  // ------------------------------------------------------------------ Time served, and back after a reload
  await page.evaluate(() => window.game.modules.Police.get().arrest('no-papers'));
  await wait(1500);
  await closeDialogs(page);
  await reload(page);
  await closeDialogs(page);
  await playUntil(page, () => (window.game.world.interiorManager.currentInterior?.type === 'police' && !window.game.world.interiorManager.isTransitioning ? true : null), 20);
  await wait(500);
  s = await state(page);
  check('police: closing the game does not open the cell: after a reload the player is back in it, with the time still running', s.inCell && !!s.custody && s.custody.until > Date.now(), s);
  await page.evaluate(() => { const P = window.game.modules.Police.get(); P.held.until = Date.now() - 1000; });
  await advance(page, 2.5);
  await wait(300);
  s = await state(page);
  check('police: when the time is served the sergeant unlocks the cell and the player stands outside it', !s.custody && !s.inCell && s.room === 'police' && await said(page, 'Time served'), s);

  // ------------------------------------------------------------------ The record lapses
  const lapsed = await page.evaluate(() => {
    const P = window.game.modules.Police.get();
    const was = P.record().length;
    P.entries = P.entries.map((r) => ({ ...r, at: Date.now() - 31 * 24 * 3_600_000 }));
    window.game.jobs.resign('first-bank-marina');
    return { was, now: P.record().length, bank: window.game.jobs.apply('first-bank-marina') };
  });
  check('police: thirty days on with nothing new, the record has lapsed and the bank takes the player on', lapsed.was >= 4 && lapsed.now === 0 && lapsed.bank.ok, lapsed);

  check('police: no errors', log.errors.length === 0, log.errors.slice(0, 5));
}
