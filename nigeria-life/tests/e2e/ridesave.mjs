// Rides and saving (A16 repair step 1). A ride in the city, booked as the Ride app books it, played to
// the end or skipped, in Lagos, Abuja and Port Harcourt, to places beyond 400 m from the centre:
// - the arrival is saved the moment the player is set down, and a reload right after opens the game there;
// - a reload in the middle of the ride does not lose it: the game opens where it was going, and the
//   fare is taken once, not twice and not lost;
// - a map cab does the same, and a ride never plays behind an open map;
// - signing in on a cleared browser brings the player back where the ride left them;
// - Chrome killing the tab (a renderer crash: no page-hide, no last save) mid-ride, in every city;
// - on an A16-sized phone (320 x 607, touch, CPU 4x slower, real time), booked by tapping the Ride
//   app, the tab killed straight after arriving and again mid-ride;
// - the fare once on the game server's own ledger, not only in the game.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { open, newPlayer, closeDialogs, wait, advance, playUntil, reload, GAME_URL } from './lib.mjs';

/** Where the player is, what is saved, the ride's state and the money */
const state = (page, name = '') => page.evaluate((placeName) => {
  const g = window.game;
  const p = g.player.position;
  const d = g.hud.backend.getData();
  const ws = d.worldState;
  return {
    city: g.world.cityManager.currentCityId,
    x: +p.x.toFixed(2),
    z: +p.z.toFixed(2),
    where: g.whereabouts(),
    ride: g.rides.ride?.stage ?? null,
    active: g.roadRideExperience.isActive,
    saved: ws ? { city: ws.cityId, x: ws.x, z: ws.z, rideTo: ws.rideTo ?? null } : null,
    money: d.walletCash + d.bank.balance,
    // Ledger lines for this ride
    charged: placeName ? (d.transactionHistory || []).filter((t) => t.description.includes(placeName)).length : 0,
    toasts: (window.__toasts ?? []).join(' | '),
  };
}, name);

/** Run before every load: keeps the words of every toast shown on this page load */
const KEEP_TOASTS = `
  window.__toasts = [];
  document.addEventListener('DOMContentLoaded', () => {
    new MutationObserver((list) => {
      for (const m of list) for (const n of m.addedNodes) if (n.classList?.contains('game-toast')) window.__toasts.push(n.textContent.trim());
    }).observe(document.body, { childList: true, subtree: true });
  });
`;

const near = (a, b, metres = 3) => !!a && !!b && Math.hypot(a.x - b.x, a.z - b.z) <= metres;

/** Books a taxi on the phone to the farthest place the Ride app lists in this city */
const bookFarthest = (page) => page.evaluate(() => {
  const g = window.game;
  const p = g.player.position;
  const far = (d) => Math.hypot(d.streetPosition.x - p.x, d.streetPosition.z - p.z);
  const dest = g.rides.destinations().filter((d) => g.rides.vehiclesFor(d).some((v) => v.mode === 'taxi')).sort((a, b) => far(b) - far(a))[0];
  const spot = g.setDownSpot(dest);
  const money = g.hud.backend.getData().walletCash + g.hud.backend.getData().bank.balance;
  const chargedBefore = (g.hud.backend.getData().transactionHistory || []).filter((t) => t.description.includes(dest.name)).length;
  const booked = g.rides.book(dest.id, 'taxi');
  return { ...booked, name: dest.name, spot, chargedBefore, from: { x: +p.x.toFixed(2), z: +p.z.toFixed(2) }, fare: g.rides.ride?.fare ?? null, money, beyond400: Math.abs(spot.x) > 400 || Math.abs(spot.z) > 400 };
});

const rideStarts = (page) => playUntil(page, () => (window.game.roadRideExperience.isActive ? true : null), 20);

/** The ride ends (played through, or skipped) and, in the same moment, where the player is and what is saved */
const finish = async (page, how) => {
  if (how === 'skip') {
    await advance(page, 1);
    return page.evaluate(() => {
      const g = window.game;
      g.roadRideExperience.skipRide();
      const p = g.player.position, ws = g.hud.backend.getData().worldState;
      return { x: p.x, z: p.z, saved: ws ? { x: ws.x, z: ws.z, rideTo: ws.rideTo ?? null } : null, active: g.roadRideExperience.isActive };
    });
  }
  return playUntil(page, () => {
    const g = window.game;
    if (g.roadRideExperience.isActive) return null;
    const p = g.player.position, ws = g.hud.backend.getData().worldState;
    return { x: p.x, z: p.z, saved: ws ? { x: ws.x, z: ws.z, rideTo: ws.rideTo ?? null } : null, active: false };
  }, 90);
};

/**
 * Chrome kills the tab, as Android does when the phone is short of memory: the page crashes, with no
 * page-hide and no chance to save, and the game is opened again in a new tab (the same browser storage).
 */
async function killAndReopen(ctx, page, opts = {}) {
  const cdp = await page.createCDPSession();
  await cdp.send('Page.crash').catch(() => {});
  await wait(800);
  await page.close().catch(() => {});
  const fresh = await ctx.newPage();
  fresh.__errors = [];
  fresh.on('pageerror', (e) => fresh.__errors.push('PAGEERR ' + String(e.message || e).slice(0, 200)));
  await fresh.setViewport(opts.viewport ?? { width: 1366, height: 768 });
  await fresh.evaluateOnNewDocument(KEEP_TOASTS);
  if (opts.cpu) await (await fresh.createCDPSession()).send('Emulation.setCPUThrottlingRate', { rate: opts.cpu });
  await fresh.goto(GAME_URL, { waitUntil: 'load', timeout: 600000 });
  await fresh.waitForFunction('window.game && window.game.hud', { timeout: 600000 });
  await fresh.waitForFunction(() => !document.getElementById('nl-splash'), { timeout: 600000 }).catch(() => {});
  await wait(opts.settle ?? 3000);
  await closeDialogs(fresh);
  return fresh;
}

const toCity = async (page, city) => {
  if (city === 'lagos') return;
  await page.evaluate((c) => window.game.arriveInCity(c), city);
  await wait(4500);
  await closeDialogs(page);
  await advance(page, 6); // an autosave in the new city
};

/** RIDESAVE_ONLY=cities,phone,map,account runs only those parts (all by default) */
const part = (name) => !process.env.RIDESAVE_ONLY || process.env.RIDESAVE_ONLY.split(',').includes(name);

export async function run(browser, check) {
  // ------------------------------------------------------------------ Each city: played through, skipped, and a reload mid-ride
  for (const city of part('cities') ? ['lagos', 'abuja', 'port_harcourt'] : []) {
    const ctx = await newPlayer(browser);
    const opened = await open(ctx, { before: KEEP_TOASTS });
    let page = opened.page;
    const log = opened.log;
    await closeDialogs(page);
    await toCity(page, city);

    for (const how of ['played', 'skip']) {
      const b = await bookFarthest(page);
      const started = await rideStarts(page);
      const end = started ? await finish(page, how) : null;
      check(`ridesave ${city} (${how}): the ride to ${b.name} sets the player down at its door and saves that spot in the same moment`,
        b.ok && !!started && !!end && near(end, b.spot) && near(end.saved, b.spot, 0.05) && end.saved.rideTo === null,
        { booked: b, end });
      await reload(page, 3000);
      await closeDialogs(page);
      const after = await state(page, b.name);
      check(`ridesave ${city} (${how}): reloaded straight after, the player is still at ${b.name}${b.beyond400 ? ' (beyond the old 400 m limit)' : ''}, not where the ride began`,
        after.city === city && near(after, b.spot) && !near(after, b.from, 50), { spot: b.spot, from: b.from, after });
      check(`ridesave ${city} (${how}): the fare was taken once (₦${b.fare})`,
        after.money === b.money - b.fare && after.charged === b.chargedBefore + 1, { before: b.money, fare: b.fare, after: after.money, charged: after.charged, chargedBefore: b.chargedBefore });
    }

    // A reload in the middle of the ride
    const b = await bookFarthest(page);
    const started = await rideStarts(page);
    await advance(page, 2);
    const mid = await state(page, b.name);
    check(`ridesave ${city} (mid-ride): while riding, the save already holds where the ride sets down`,
      !!started && mid.active && near(mid.saved, b.spot, 0.05) && mid.saved.rideTo === b.name, { booked: b, mid });
    await reload(page, 3000);
    await closeDialogs(page);
    const back = await state(page, b.name);
    check(`ridesave ${city} (mid-ride): reloaded during the ride, the game opens at ${b.name}, the ride over and the player told`,
      back.city === city && near(back, b.spot) && !back.active && back.ride === null && back.where === 'street' && /You have arrived at/.test(back.toasts) && back.saved?.rideTo === null,
      { spot: b.spot, from: b.from, back });
    await advance(page, 12);
    const later = await state(page, b.name);
    check(`ridesave ${city} (mid-ride): the fare was taken once, not again after the reload and not lost`,
      later.money === b.money - b.fare && later.charged === b.chargedBefore + 1 && near(later, b.spot), { before: b.money, fare: b.fare, now: later.money, charged: later.charged, chargedBefore: b.chargedBefore });
    check(`ridesave ${city}: no errors in the page`, log.errors.length === 0, log.errors.slice(0, 4));

    // Chrome kills the tab in the middle of a ride: no page-hide, no last save
    {
      const k = await bookFarthest(page);
      const go = await rideStarts(page);
      await advance(page, 2);
      page = await killAndReopen(ctx, page);
      const back = await state(page, k.name);
      check(`ridesave ${city} (tab killed mid-ride): opened again in a new tab, the player is at ${k.name}, told, the ride over, the fare taken once`,
        !!go && back.city === city && near(back, k.spot) && !back.active && back.ride === null && /You have arrived at/.test(back.toasts) && back.money === k.money - k.fare && back.charged === k.chargedBefore + 1,
        { booked: k, back });
      check(`ridesave ${city} (tab killed mid-ride): no errors in the new tab`, page.__errors.length === 0, page.__errors.slice(0, 4));
    }
    await ctx.close();
  }

  // ------------------------------------------------------------------ An A16-sized phone, by touch, CPU 4x slower, real time
  if (part('phone')) await phoneRun(browser, check);

  // ------------------------------------------------------------------ A map cab beyond 400 m (Port Harcourt), and no ride behind an open map (Abuja)
  if (part('map')) {
    const ctx = await newPlayer(browser);
    const { page, log } = await open(ctx, { before: KEEP_TOASTS });
    await closeDialogs(page);
    await toCity(page, 'port_harcourt');
    const cab = await page.evaluate(() => {
      const g = window.game;
      const o = g.world.interactiveObjects.filter((x) => x.interactionPoint && (Math.abs(x.interactionPoint.x) > 400 || Math.abs(x.interactionPoint.z) > 400)).sort((a, b) => Math.abs(b.interactionPoint.x) - Math.abs(a.interactionPoint.x))[0];
      const money = g.hud.backend.getData().walletCash + g.hud.backend.getData().bank.balance;
      g.hud.onRideTo(o.interactionPoint.clone(), o.name, 4500);
      return { name: o.name, spot: { x: o.interactionPoint.x, z: o.interactionPoint.z }, money, fare: 4500 };
    });
    await advance(page, 2);
    const mid = await state(page);
    await reload(page, 3000);
    await closeDialogs(page);
    const back = await state(page, cab.name);
    check(`ridesave map cab (Port Harcourt, beyond 400 m): reloaded mid-ride, the player is at ${cab.name}, charged once`,
      mid.active && near(mid.saved, cab.spot, 0.05) && back.city === 'port_harcourt' && near(back, cab.spot) && !back.active && back.money === cab.money - cab.fare,
      { cab, mid: { active: mid.active, saved: mid.saved }, back });

    await toCity(page, 'abuja');
    const b = await bookFarthest(page);
    // The map opened while the driver is on the way
    await page.evaluate(() => document.querySelector('#nav-btn-map')?.click());
    await wait(800);
    const mapOpen = await page.evaluate(() => window.game.world.worldMap.isActive);
    const started = await rideStarts(page);
    await wait(600);
    const during = await page.evaluate(() => ({ map: window.game.world.worldMap.isActive, nav: window.game.hud.currentNavMode, rideHud: getComputedStyle(document.getElementById('transit-hud-root') ?? document.body).display }));
    const end = started ? await finish(page, 'played') : null;
    check('ridesave: a ride that starts while the map is open is seen from the street, the map closed, and still sets down at the door',
      mapOpen && !!started && !during.map && during.nav === 'street' && !!end && near(end, b.spot), { mapOpen, during, end, spot: b.spot });
    check('ridesave: no errors in the page (map cab, map open)', log.errors.length === 0, log.errors.slice(0, 4));
    await ctx.close();
  }

  // ------------------------------------------------------------------ Signing back in on a cleared browser
  if (part('account')) await signedIn(browser, check);
}

// --------------------------------------------------------------------------------------------- the account part
const PORT = 9100 + Math.floor(Math.random() * 150);
const SERVER = `http://127.0.0.1:${PORT}`;
const USER = 'Ride_Save1';
const PASS = 'lagos-life';

async function serverUp(tries = 60) {
  for (let i = 0; i < tries; i++) {
    try {
      const response = await fetch(`${SERVER}/health`);
      if (response.ok) return true;
    } catch {
      // not up yet
    }
    await wait(150);
  }
  return false;
}

async function openOnline(browser) {
  const ctx = await newPlayer(browser);
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e.message || e).slice(0, 240)));
  await page.setViewport({ width: 1100, height: 700 });
  await page.goto(`${GAME_URL}?server=${encodeURIComponent(SERVER)}`, { waitUntil: 'load', timeout: 120000 });
  await page.waitForFunction('window.game && window.game.hud', { timeout: 120000 });
  await wait(1500);
  await closeDialogs(page);
  await page.waitForFunction(() => window.game.modules.OnlineAccount.get()?.id, { timeout: 60000 });
  return { ctx, page, errors };
}

/** The game server's ledger lines for this place, and its wallet against the game's own figures */
const serverLedger = (page, name) => page.evaluate(async (placeName) => {
  const g = window.game;
  const res = await g.modules.OnlineAccount.get().request('/money/ledger');
  const d = g.hud.backend.getData();
  return {
    lines: (res.ledger || []).filter((row) => String(row.memo).includes(placeName)).length,
    serverTotal: res.wallet ? res.wallet.cash + res.wallet.bank : null,
    gameTotal: d.walletCash + d.bank.balance,
  };
}, name);

async function signedIn(browser, check) {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nl-ridesave-'));
  const log = fs.openSync(path.join(dataDir, 'server.log'), 'a');
  const server = spawn(process.execPath, ['server/game-server.ts'], {
    env: { ...process.env, PORT: String(PORT), NL_DATA: dataDir, NL_DEV: '1', NL_BACKUP_DIR: path.join(dataDir, 'backups'), NL_GUESTS_PER_HOUR: '1000' },
    stdio: ['ignore', log, log],
  });
  const contexts = [];
  try {
    if (!(await serverUp())) {
      check('ridesave account: the test server started', false, { dataDir });
      return;
    }
    const first = await openOnline(browser);
    contexts.push(first.ctx);
    const page = first.page;
    const made = await page.evaluate((u, p) => window.game.modules.OnlineAccount.get().register(u, p), USER, PASS);
    const b = await bookFarthest(page);
    const started = await rideStarts(page);
    const end = started ? await finish(page, 'played') : null;
    const pushed = await page.evaluate(() => window.game.modules.CloudSyncService.getInstance().pushNow());
    check('ridesave account: a signed-up player rides to the airport, is set down there, and the save reaches the account',
      made?.ok && b.ok && !!end && near(end, b.spot) && pushed === true, { made, booked: b, end, pushed });
    const onServer = await serverLedger(page, b.name);
    check(`ridesave account: the game server's own ledger has the fare to ${b.name} exactly once, and its wallet matches the game`,
      onServer.lines === 1 && onServer.serverTotal === onServer.gameTotal && onServer.gameTotal === b.money - b.fare, { onServer, before: b.money, fare: b.fare });

    // A reload in the middle of a second ride, signed in: still once on the server
    const m = await page.evaluate(() => {
      const g = window.game;
      const dest = g.rides.destinations().find((d) => /Computer Village/.test(d.name));
      const spot = g.setDownSpot(dest);
      const money = g.hud.backend.getData().walletCash + g.hud.backend.getData().bank.balance;
      return { ...g.rides.book(dest.id, 'taxi'), name: dest.name, spot, money, fare: g.rides.ride?.fare ?? null };
    });
    await rideStarts(page);
    await advance(page, 2);
    await wait(2500); // the fare's report to the server is on its way
    await reload(page, 3000);
    await closeDialogs(page);
    await wait(3000);
    const after = await state(page, m.name);
    const onServer2 = await serverLedger(page, m.name);
    check(`ridesave account: reloaded mid-ride while signed in, the player is at ${m.name} and the server has that fare exactly once, its wallet matching the game`,
      m.ok && near(after, m.spot) && onServer2.lines === 1 && onServer2.serverTotal === onServer2.gameTotal && onServer2.gameTotal === m.money - m.fare, { booked: m, after: { x: after.x, z: after.z }, onServer2 });

    // A cleared browser, signed in again
    const second = await openOnline(browser);
    contexts.push(second.ctx);
    await second.page.evaluate((u, p) => window.game.modules.OnlineAccount.get().login(u, p), USER, PASS).catch(() => null);
    let last = null;
    let steady = 0;
    const deadline = Date.now() + 120000;
    while (Date.now() < deadline && steady < 3) {
      try {
        last = await second.page.evaluate((u) => {
          const g = window.game;
          if (!g?.hud) return null;
          const online = g.modules.OnlineAccount.get();
          const p = g.player.position;
          return { name: online?.account?.name ?? null, x: p.x, z: p.z, city: g.world.cityManager.currentCityId, signedIn: online?.account?.name === u };
        }, USER);
        steady = last?.signedIn && near(last, m.spot) ? steady + 1 : 0;
      } catch {
        steady = 0; // loading again
      }
      await wait(500);
    }
    check(`ridesave account: signing in on a cleared browser brings the player back where the last ride set them down (${m.name}), not at an earlier spot`,
      steady >= 3 && last.city === 'lagos' && near(last, m.spot) && !near(last, b.spot, 50) && !near(last, b.from, 50), { spot: m.spot, earlier: [b.from, b.spot], last, errors: second.errors.slice(0, 3) });
  } finally {
    for (const c of contexts) await c.close().catch(() => {});
    await new Promise((resolve) => {
      if (server.exitCode !== null) return resolve();
      server.once('exit', resolve);
      server.kill('SIGTERM');
      setTimeout(() => { if (server.exitCode === null) server.kill('SIGKILL'); resolve(); }, 4000);
    });
    fs.rmSync(dataDir, { recursive: true, force: true });
  }
}

// --------------------------------------------------------------------------------------------- the A16-sized phone
const PHONE = { width: 320, height: 607, deviceScaleFactor: 2, isMobile: true, hasTouch: true };

/** Taps an element by touch; the phone redraws its screen often, so a vanished element is found again */
async function tapOn(page, selector) {
  for (let i = 0; i < 6; i++) {
    try {
      await page.waitForSelector(selector, { visible: true, timeout: 15000 });
      await page.tap(selector);
      return true;
    } catch (e) {
      if (!/detached|not clickable|not an Element|Node is/.test(String(e?.message))) throw e;
      await wait(400);
    }
  }
  return false;
}

/** Phone › Ride › search › the place › Taxi, by tapping, as on the A16 */
async function tapRide(page, search, placeRe) {
  await tapOn(page, '#nav-btn-phone');
  await wait(1200);
  await tapOn(page, '[data-app="ride"]');
  await wait(1500);
  await tapOn(page, '#ride-search');
  await page.type('#ride-search', search, { delay: 40 });
  await wait(1500);
  const id = await page.evaluate((re) => [...document.querySelectorAll('[data-place]')].find((el) => new RegExp(re).test(el.textContent))?.dataset.place ?? null, placeRe);
  if (!id) return { ok: false, reason: 'place not listed' };
  await tapOn(page, `[data-place="${id}"]`);
  await wait(1500);
  const before = await page.evaluate((destId) => {
    const g = window.game;
    const dest = g.rides.destinations().find((d) => d.id === destId);
    const d = g.hud.backend.getData();
    return { name: dest.name, spot: g.setDownSpot(dest), money: d.walletCash + d.bank.balance, chargedBefore: (d.transactionHistory || []).filter((t) => t.description.includes(dest.name)).length, from: { x: g.player.position.x, z: g.player.position.z } };
  }, id);
  await tapOn(page, '[data-ride="taxi"]');
  await wait(500);
  const fare = await page.evaluate(() => window.game.rides.ride?.fare ?? null);
  return { ok: fare !== null, fare, ...before };
}

/** Waits in real time (the phone's own frames) until `test` in the page is true */
async function realTime(page, test, seconds) {
  const end = Date.now() + seconds * 1000;
  while (Date.now() < end) {
    if (await page.evaluate(test).catch(() => false)) return true;
    await wait(250);
  }
  return false;
}

async function phoneRun(browser, check) {
  const ctx = await newPlayer(browser);
  let page = await ctx.newPage();
  page.__errors = [];
  page.on('pageerror', (e) => page.__errors.push('PAGEERR ' + String(e.message || e).slice(0, 200)));
  await page.setViewport(PHONE);
  await page.evaluateOnNewDocument(KEEP_TOASTS);
  await (await page.createCDPSession()).send('Emulation.setCPUThrottlingRate', { rate: 4 });
  await page.goto(GAME_URL, { waitUntil: 'load', timeout: 600000 });
  await page.waitForFunction('window.game && window.game.hud', { timeout: 600000 });
  await page.waitForFunction(() => !document.getElementById('nl-splash'), { timeout: 600000 });
  await wait(8000);
  await closeDialogs(page);

  // 1. To the airport, played to the end in real time; the tab killed the moment the player is set down
  const a = await tapRide(page, 'Murtala', 'Murtala');
  const rode = await realTime(page, () => window.game.roadRideExperience.isActive, 90);
  const landed = rode && (await realTime(page, () => !window.game.roadRideExperience.isActive && window.game.rides.ride === null, 240));
  const atLanding = await state(page, a.name);
  page = await killAndReopen(ctx, page, { viewport: PHONE, cpu: 4, settle: 8000 });
  const afterKill = await state(page, a.name);
  check('ridesave phone (A16 size, touch, CPU 4x): booked by tapping, the ride to the airport plays to the end and sets the player down there',
    a.ok && rode && landed && near(atLanding, a.spot), { booked: a, rode, landed, atLanding });
  check('ridesave phone: the tab killed the moment the player arrived, the game opens again at the airport (6.3 km out), the fare taken once',
    afterKill.city === 'lagos' && near(afterKill, a.spot) && !near(afterKill, a.from, 50) && afterKill.money === a.money - a.fare && afterKill.charged === a.chargedBefore + 1,
    { spot: a.spot, from: a.from, afterKill });

  // 2. From the airport to Computer Village; the tab killed in the middle of the ride
  const c = await tapRide(page, 'Computer', 'Computer Village');
  const riding = await realTime(page, () => window.game.roadRideExperience.isActive, 90);
  await wait(1500);
  const mid = await state(page, c.name);
  page = await killAndReopen(ctx, page, { viewport: PHONE, cpu: 4, settle: 8000 });
  const back = await state(page, c.name);
  check('ridesave phone: the tab killed mid-ride, the game opens again at Computer Village, not the airport, and says the player has arrived',
    c.ok && riding && mid.active && back.city === 'lagos' && near(back, c.spot) && !near(back, c.from, 50) && !back.active && /You have arrived at/.test(back.toasts),
    { booked: c, mid: { active: mid.active, saved: mid.saved }, back });
  await wait(8000);
  const later = await state(page, c.name);
  check('ridesave phone: that fare was taken exactly once (not again after reopening, not lost)',
    later.money === c.money - c.fare && later.charged === c.chargedBefore + 1, { before: c.money, fare: c.fare, now: later.money, charged: later.charged, chargedBefore: c.chargedBefore });
  check('ridesave phone: no errors in the page', page.__errors.length === 0, page.__errors.slice(0, 4));
  await ctx.close();
}
