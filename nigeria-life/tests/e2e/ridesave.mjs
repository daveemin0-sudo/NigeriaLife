// Rides and saving (A16 repair step 1). A ride in the city, booked as the Ride app books it, played to
// the end or skipped, in Lagos, Abuja and Port Harcourt, to places beyond 400 m from the centre:
// - the arrival is saved the moment the player is set down, and a reload right after opens the game there;
// - a reload in the middle of the ride does not lose it: the game opens where it was going, and the
//   fare is taken once, not twice and not lost;
// - a map cab does the same, and a ride never plays behind an open map;
// - signing in on a cleared browser brings the player back where the ride left them.
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

const toCity = async (page, city) => {
  if (city === 'lagos') return;
  await page.evaluate((c) => window.game.arriveInCity(c), city);
  await wait(4500);
  await closeDialogs(page);
  await advance(page, 6); // an autosave in the new city
};

export async function run(browser, check) {
  // ------------------------------------------------------------------ Each city: played through, skipped, and a reload mid-ride
  for (const city of ['lagos', 'abuja', 'port_harcourt']) {
    const ctx = await newPlayer(browser);
    const { page, log } = await open(ctx, { before: KEEP_TOASTS });
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
    await ctx.close();
  }

  // ------------------------------------------------------------------ A map cab beyond 400 m (Port Harcourt), and no ride behind an open map (Abuja)
  {
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
  await signedIn(browser, check);
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
        steady = last?.signedIn && near(last, b.spot) ? steady + 1 : 0;
      } catch {
        steady = 0; // loading again
      }
      await wait(500);
    }
    check(`ridesave account: signing in on a cleared browser brings the player back at ${b.name}, not where the ride began`,
      steady >= 3 && last.city === 'lagos' && near(last, b.spot) && !near(last, b.from, 50), { spot: b.spot, from: b.from, last, errors: second.errors.slice(0, 3) });
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
