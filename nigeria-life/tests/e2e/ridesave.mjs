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
// - the fare once on the game server's own ledger, not only in the game;
// - "Turn back" sets the player down where the ride was booked, the fare kept (as its button says);
//   a coach has no Turn back;
// - signed in, a journey's start and end reach the account at once: the browser's data wiped 0.3 s
//   after a ride, a coach or a flight starts or ends, signing in again finds the player where they
//   should be; and the page closed within 2 s of a move still sends its last copy.
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
  const fresh = await ctx.newPage(); await fresh.evaluateOnNewDocument(() => { window.__nlInstantPickup = true; });
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

/** RIDESAVE_ONLY=cities,phone,turnback,map,account runs only those parts (all by default) */
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
  if (part('turnback')) await turnBackRun(browser, check);

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
const ADMIN = 'ridesave-admin';
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
  const page = await ctx.newPage(); await page.evaluateOnNewDocument(() => { window.__nlInstantPickup = true; });
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
    env: { ...process.env, PORT: String(PORT), NL_DATA: dataDir, NL_DEV: '1', NL_BACKUP_DIR: path.join(dataDir, 'backups'), NL_GUESTS_PER_HOUR: '1000', NL_ADMIN_KEY: ADMIN },
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
    const deadline = Date.now() + 240000; // several full loads on a busy laptop
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

    // One device at a time, as a player plays: another device still open and saving would (rightly)
    // make a newly signed-in one step aside as "Playing on another device"
    await first.ctx.close().catch(() => {});
    await second.ctx.close().catch(() => {});
    await recoveries(browser, check, contexts, m.spot);
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
  let page = await ctx.newPage(); await page.evaluateOnNewDocument(() => { window.__nlInstantPickup = true; });
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

// --------------------------------------------------------------------------------------------- L2: at once to the account
/**
 * Signs in on a brand-new browser and waits until the game stands still at `want(view)` (a test run
 * in the page on what it sees: name, city, where the player is, and the city's park and apron).
 */
/**
 * After loading the account's copy a device stays quiet for 20 s (CloudSyncService.apply): what is
 * saved then is sent when that ends. Journeys are tested as a player plays, past that moment, unless
 * `quietToo` asks for the quiet moment itself.
 */
const QUIET_MS = 20_000;

async function signInFresh(browser, contexts, want, quietToo = false) {
  const fresh = await openOnline(browser);
  contexts.push(fresh.ctx);
  await fresh.page.evaluate((u, p) => window.game.modules.OnlineAccount.get().login(u, p), USER, PASS).catch(() => null);
  let last = null;
  let steady = 0;
  const deadline = Date.now() + 240000; // several full loads on a busy laptop
  while (Date.now() < deadline && steady < 3) {
    try {
      last = await fresh.page.evaluate((u) => {
        const g = window.game;
        if (!g?.hud) return null;
        const online = g.modules.OnlineAccount.get();
        const city = g.world.cityManager.currentCityId;
        const p = g.player.position;
        const park = g.world.motorParkOf(city)?.setDown;
        const apron = g.world.airportOf(city)?.apron?.steps;
        return { signedIn: online?.account?.name === u, city, x: +p.x.toFixed(2), z: +p.z.toFixed(2), park: park ? { x: park.x, z: park.z } : null, apron: apron ? { x: apron.x, z: apron.z } : null };
      }, USER);
      steady = last?.signedIn && want(last) ? steady + 1 : 0;
    } catch {
      steady = 0; // loading again
    }
    await wait(500);
  }
  if (steady >= 3 && !quietToo) await wait(QUIET_MS + 1000);
  return { ...fresh, last, ok: steady >= 3 };
}

/** Every bit of this browser's data gone a moment after `ms`: the context (storage, tabs, requests) is closed */
async function wipeAfter(ctx, ms) {
  await wait(ms);
  await ctx.close().catch(() => {});
}

async function recoveries(browser, check, contexts, standing) {
  // Signed in on a new browser, the only one open (and past its quiet moment)
  const start = await signInFresh(browser, contexts, (v) => v.city === 'lagos' && near(v, standing));
  check('ridesave L2: signed in on a new browser, the only device open, the player is where the last ride left them', start.ok, { standing, last: start.last });
  // 1. A ride played to the end; the browser's data wiped 0.3 s later; signed in on a new browser
  let page = start.page;
  const a = await bookFarthest(page);
  await rideStarts(page);
  const landed = await finish(page, 'played');
  await wipeAfter(start.ctx, 300);
  const one = await signInFresh(browser, contexts, (v) => v.city === 'lagos' && near(v, a.spot));
  check(`ridesave L2: a ride to ${a.name} ends and the browser's data is wiped 0.3 s later: signed in again, the player is at ${a.name}`,
    !!landed && near(landed, a.spot) && one.ok, { spot: a.spot, landed, last: one.last });

  // 2. The tab closed (all data wiped) 0.3 s into a ride: the account already holds where it sets down
  page = one.page;
  const before = await serverLedger(page, 'Computer Village');
  const c = await page.evaluate(() => {
    const g = window.game;
    const dest = g.rides.destinations().find((d) => /Computer Village/.test(d.name));
    return { ...g.rides.book(dest.id, 'taxi'), name: dest.name, spot: g.setDownSpot(dest) };
  });
  await rideStarts(page);
  await advance(page, 0.5);
  await wipeAfter(one.ctx, 300);
  const two = await signInFresh(browser, contexts, (v) => v.city === 'lagos' && near(v, c.spot));
  const after = two.ok ? await serverLedger(two.page, 'Computer Village') : null;
  check(`ridesave L2: the browser wiped 0.3 s into a ride: signed in again, the player is at ${c.name}, and the server has that fare once`,
    c.ok && two.ok && after?.lines === before.lines + 1 && after.serverTotal === after.gameTotal, { spot: c.spot, last: two.last, before, after });

  // 3. A coach boarded at Jibowu for Abuja; the browser wiped 0.3 s later: signed in again, they have arrived at Utako
  page = two.page;
  const coach = await page.evaluate(() => {
    const g = window.game;
    const route = g.coaches.routesFrom('lagos').find((r) => r.to === 'abuja');
    const bought = g.coaches.buy(route, 'lagos');
    const boarded = g.coaches.board('lagos');
    return { bought: bought.ok, boarded: boarded.ok, reason: bought.reason ?? boarded.reason ?? null };
  });
  await wipeAfter(two.ctx, 300);
  const three = await signInFresh(browser, contexts, (v) => v.city === 'abuja' && !!v.park && near(v, v.park));
  check('ridesave L2: a coach boarded for Abuja and the browser wiped 0.3 s later: signed in again, the player has arrived at Utako Motor Park',
    coach.bought && coach.boarded && three.ok, { coach, last: three.last });

  // 4. A coach on from Abuja to Port Harcourt, ridden to the end; the browser wiped 0.3 s after it pulls in
  page = three.page;
  const coach2 = await page.evaluate(() => {
    const g = window.game;
    const route = g.coaches.routesFrom('abuja').find((r) => r.to === 'port_harcourt');
    const bought = g.coaches.buy(route, 'abuja');
    const boarded = g.coaches.board('abuja');
    return { bought: bought.ok, boarded: boarded.ok, reason: bought.reason ?? boarded.reason ?? null };
  });
  const onRoad = await playUntil(page, () => (window.game.roadRideExperience.isActive ? true : null), 60);
  if (onRoad) await page.evaluate(() => window.game.roadRideExperience.skipRide());
  const pulledIn = await playUntil(page, () => (window.game.world.cityManager.currentCityId === 'port_harcourt' && !window.game.roadRideExperience.isActive ? true : null), 30);
  await wipeAfter(three.ctx, 300);
  const four = await signInFresh(browser, contexts, (v) => v.city === 'port_harcourt' && !!v.park && near(v, v.park));
  check('ridesave L2: a coach to Port Harcourt pulls in and the browser is wiped 0.3 s later: signed in again, the player is at Waterlines Motor Park',
    coach2.bought && coach2.boarded && !!onRoad && !!pulledIn && four.ok, { coach2, onRoad, pulledIn, last: four.last });

  // 5. A flight boarded in Port Harcourt for Lagos; the browser wiped 0.3 s later: signed in again, landed in Lagos
  page = four.page;
  const accountId = await page.evaluate(() => window.game.modules.OnlineAccount.get().id);
  const granted = await (await fetch(`${SERVER}/admin/grant`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-nl-admin': ADMIN }, body: JSON.stringify({ id: accountId, amount: 10_000_000, memo: 'test: flights' }) })).json().catch(() => ({}));
  const flight = await page.evaluate(async () => {
    const g = window.game;
    await g.modules.OnlineAccount.get().request('/money/ledger'); // the server's wallet, with the grant, reaches the game
    await new Promise((r) => setTimeout(r, 500));
    const route = g.flights.routesFrom ? g.flights.routesFrom('port_harcourt').find((r) => r.to === 'lagos') : null;
    if (!route) return { ok: false, reason: 'no route' };
    const booked = g.flights.book(route, 'port_harcourt');
    g.flights.checkIn('port_harcourt');
    g.flights.clearSecurity('port_harcourt');
    const boarded = g.flights.board('port_harcourt');
    return { ok: booked.ok && boarded.ok, reason: booked.reason ?? boarded.reason ?? null };
  });
  // The first flight of a visit is drawn for the first time as it boards: the page is frozen for a
  // moment (about 2 s here) and nothing, the save included, can be sent until it draws its next frame
  // (the first-time freeze, repair step 2). The browser is wiped 0.3 s after that frame.
  const frozenFor = await page.evaluate(() => { const t = performance.now(); return new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r(Math.round(performance.now() - t))))); });
  await wipeAfter(four.ctx, 300);
  const five = await signInFresh(browser, contexts, (v) => v.city === 'lagos' && !!v.apron && near(v, v.apron));
  check('ridesave L2: a flight boarded for Lagos and the browser wiped 0.3 s after the page draws again: signed in again, the player has landed at the Lagos apron',
    granted.ok && flight.ok && five.ok, { granted: granted.ok, flight, frozenForMs: frozenFor, last: five.last });

  // 6. A flight on from Lagos to Abuja, flown to the end; the browser wiped 0.3 s after landing
  page = five.page;
  const flight2 = await page.evaluate(async () => {
    const g = window.game;
    const route = g.flights.routesFrom('lagos').find((r) => r.to === 'abuja');
    const booked = g.flights.book(route, 'lagos');
    g.flights.checkIn('lagos');
    g.flights.clearSecurity('lagos');
    const boarded = g.flights.board('lagos');
    return { ok: booked.ok && boarded.ok, reason: booked.reason ?? boarded.reason ?? null };
  });
  const flying = await playUntil(page, () => (window.game.flightExperience.isActive ? true : null), 30);
  if (flying) await page.evaluate(() => window.game.flightExperience.skipFlight());
  const landedAbuja = await playUntil(page, () => (window.game.world.cityManager.currentCityId === 'abuja' && !window.game.flightExperience.isActive ? true : null), 30);
  await wipeAfter(five.ctx, 300);
  const six = await signInFresh(browser, contexts, (v) => v.city === 'abuja' && !!v.apron && near(v, v.apron));
  check('ridesave L2: a flight to Abuja lands and the browser is wiped 0.3 s later: signed in again, the player is on the Abuja apron',
    flight2.ok && !!flying && !!landedAbuja && six.ok, { flight2, flying, landedAbuja, last: six.last });

  // 7. The page closed straight after a move (before the usual 2 s wait): the last copy is sent as it goes
  page = six.page;
  const moved = await page.evaluate(() => {
    const g = window.game;
    const online = g.modules.OnlineAccount.get();
    const p = g.player;
    p.stopMoving();
    p.mesh.position.set(p.position.x + 7, 0, p.position.z + 5);
    const sync = g.modules.CloudSyncService.getInstance();
    return { x: +p.position.x.toFixed(2), z: +p.position.z.toFixed(2), token: online.authorization, size: JSON.stringify(sync.collect()).length };
  });
  await page.close({ runBeforeUnload: false });
  await wait(2500);
  const stored = await (await fetch(`${SERVER}/me/save`, { headers: { authorization: `Bearer ${moved.token}` } })).json().catch(() => ({}));
  let ws = null;
  try { ws = JSON.parse(stored?.doc?.bags?.nigeria_life_account_data_v1 ?? 'null')?.worldState ?? null; } catch { /* none */ }
  check(`ridesave L2: the page closed within 2 s of a move: the last copy (${Math.round(moved.size / 1024)} KB) reaches the account as the page goes`,
    moved.size <= 60000 && !!ws && Math.abs(ws.x - moved.x) < 0.1 && Math.abs(ws.z - moved.z) < 0.1, { moved: { x: moved.x, z: moved.z, size: moved.size }, stored: ws });

  // 7b. The same browser opened again: the copy it sent as it closed is its own, so it loads once,
  //     is not told it was behind, and stands where it left off
  {
    const again = await six.ctx.newPage(); await again.evaluateOnNewDocument(() => { window.__nlInstantPickup = true; });
    let loads = 0;
    again.on('framenavigated', (f) => { if (f === again.mainFrame()) loads += 1; });
    await again.setViewport({ width: 1100, height: 700 });
    await again.evaluateOnNewDocument(KEEP_TOASTS);
    await again.goto(`${GAME_URL}?server=${encodeURIComponent(SERVER)}`, { waitUntil: 'load', timeout: 120000 });
    await again.waitForFunction('window.game && window.game.hud', { timeout: 120000 });
    await wait(12000);
    const view = await again.evaluate(() => ({ x: +window.game.player.position.x.toFixed(2), z: +window.game.player.position.z.toFixed(2), toasts: (window.__toasts ?? []).join(' | ') })).catch(() => null);
    check('ridesave L2: the same browser opened again after sending its last copy as it closed: one load, not told it was behind, standing where it left off',
      loads === 1 && !!view && !/was behind/.test(view.toasts) && near(view, moved), { loads, view, moved: { x: moved.x, z: moved.z } });
    await again.close().catch(() => {});
  }

  // 8. A ride in the quiet moment straight after signing in: the arrival is not dropped, it reaches
  //    the account as soon as the quiet moment ends
  const seven = await signInFresh(browser, contexts, (v) => v.city === 'abuja', true);
  const q = await seven.page.evaluate(() => {
    const g = window.game;
    const p = g.player.position;
    const far = (d) => Math.hypot(d.streetPosition.x - p.x, d.streetPosition.z - p.z);
    const dest = g.rides.destinations().filter((d) => g.rides.vehiclesFor(d).some((v) => v.mode === 'taxi')).sort((a, b) => far(b) - far(a))[0];
    return { ...g.rides.book(dest.id, 'taxi'), name: dest.name, spot: g.setDownSpot(dest), token: g.modules.OnlineAccount.get().authorization };
  });
  await rideStarts(seven.page);
  const qEnd = await finish(seven.page, 'skip');
  const readStored = async () => {
    const doc = await (await fetch(`${SERVER}/me/save`, { headers: { authorization: `Bearer ${q.token}` } })).json().catch(() => ({}));
    try { return JSON.parse(doc?.doc?.bags?.nigeria_life_account_data_v1 ?? 'null')?.worldState ?? null; } catch { return null; }
  };
  let reached = null;
  const until = Date.now() + QUIET_MS + 15000;
  while (Date.now() < until) {
    const w = await readStored();
    if (w && near(w, q.spot)) { reached = w; break; }
    await wait(1000);
  }
  check(`ridesave L2: a ride taken in the quiet moment straight after signing in: the arrival at ${q.name} reaches the account as soon as that moment ends`,
    q.ok && !!qEnd && near(qEnd, q.spot) && !!reached, { spot: q.spot, end: qEnd, reached });
}

// --------------------------------------------------------------------------------------------- L1: Turn back
async function turnBackRun(browser, check) {
  for (const city of ['lagos', 'abuja', 'port_harcourt']) {
    const ctx = await newPlayer(browser);
    const { page, log } = await open(ctx, { before: KEEP_TOASTS });
    await closeDialogs(page);
    await toCity(page, city);
    const b = await bookFarthest(page);
    const started = await rideStarts(page);
    const button = await page.evaluate(() => {
      const el = document.getElementById('btn-ride-back');
      return { shown: !!el && getComputedStyle(el).display !== 'none', text: el?.textContent ?? '', title: el?.title ?? '' };
    });
    await advance(page, 1);
    const turned = await page.evaluate(() => {
      document.getElementById('btn-ride-back').click();
      const g = window.game, p = g.player.position, ws = g.hud.backend.getData().worldState;
      return { x: p.x, z: p.z, active: g.roadRideExperience.isActive, ride: g.rides.ride?.stage ?? null, saved: ws ? { x: ws.x, z: ws.z, rideTo: ws.rideTo ?? null } : null };
    });
    await advance(page, 2);
    const now = await state(page, b.name);
    // Label is "↩ Turn back"; the no-refund + destination wording lives on the button title (tooltip), not the visible text.
    check(`ridesave turn back ${city}: the ride card offers "Turn back", saying the fare is not refunded and naming where it goes back to`,
      !!started && button.shown && /Turn back/.test(button.text) && /Turn back to .+\. The fare is not refunded\./.test(button.title), { button });
    check(`ridesave turn back ${city}: pressed, the player is set down where the ride was booked (not at ${b.name}), the ride over and that spot saved at once`,
      near(turned, b.from) && !near(turned, b.spot, 20) && !turned.active && turned.ride === null && near(turned.saved, b.from, 0.05) && turned.saved.rideTo === null && /You turned back to .+ The fare is not refunded/.test(now.toasts),
      { from: b.from, spot: b.spot, turned, toasts: now.toasts });
    check(`ridesave turn back ${city}: the fare stays paid, once`, now.money === b.money - b.fare && now.charged === b.chargedBefore + 1, { before: b.money, fare: b.fare, now: now.money, charged: now.charged });
    await reload(page, 3000);
    await closeDialogs(page);
    const after = await state(page, b.name);
    check(`ridesave turn back ${city}: reloaded, the player is still where the ride was booked, and a new ride can be booked`,
      after.city === city && near(after, b.from) && (await page.evaluate(() => window.game.rides.cannotBook())) === null, { from: b.from, after });

    if (city === 'lagos') {
      // A coach has no Turn back (it does not turn round for one passenger); Skip still works
      const coach = await page.evaluate(() => {
        const g = window.game;
        const route = g.coaches.routesFrom('lagos').find((r) => r.to === 'abuja');
        return { bought: g.coaches.buy(route, 'lagos').ok, boarded: g.coaches.board('lagos').ok };
      });
      const onRoad = await playUntil(page, () => (window.game.roadRideExperience.isActive ? true : null), 60);
      const coachButton = await page.evaluate(() => { const el = document.getElementById('btn-ride-back'); return !!el && getComputedStyle(el).display !== 'none'; });
      await page.evaluate(() => window.game.roadRideExperience.skipRide());
      const arrived = await playUntil(page, () => (window.game.world.cityManager.currentCityId === 'abuja' ? true : null), 30);
      check('ridesave turn back: a coach journey offers no "Turn back", and skipping it still arrives in Abuja',
        coach.bought && coach.boarded && !!onRoad && !coachButton && !!arrived, { coach, onRoad, coachButton, arrived });
    }
    check(`ridesave turn back ${city}: no errors in the page`, log.errors.length === 0, log.errors.slice(0, 4));
    await ctx.close();
  }
}
