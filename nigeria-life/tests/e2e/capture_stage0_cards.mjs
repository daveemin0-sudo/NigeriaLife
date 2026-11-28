/**
 * Stage 0C evidence: street HUD, ride card, driving HUD, place interior, phone,
 * map, Dangote Lekki arrival, and separate Apapa depot — at the requested phone
 * sizes plus one landscape. Writes PNGs under SHOTS and a JSON overlap report.
 *
 * Not a substitute for a physical phone. Chromium mobile emulation only.
 */
import fs from 'node:fs';
import path from 'node:path';
import { launch, newPlayer, closeDialogs, wait, advance, playUntil } from './lib.mjs';

const SHOTS = process.env.SHOTS || '/tmp/nl-stage0-cards';
const GAME = process.env.GAME_URL || 'http://127.0.0.1:5173/NigeriaLife/';
fs.mkdirSync(SHOTS, { recursive: true });

const PHONES = [
  [320, 568, 'p'],
  [360, 800, 'p'],
  [390, 844, 'p'],
  [430, 932, 'p'],
  [844, 390, 'l'], // landscape of 390x844
];

const SCENES = [
  'street-hud',
  'ride-card',
  'driving-hud',
  'inside-place',
  'phone',
  'map',
  'dangote-lekki',
  'apapa-depot',
];

function overlaps(page) {
  return page.evaluate(() => {
    const W = innerWidth, H = innerHeight;
    const visible = (e) => {
      const s = getComputedStyle(e);
      return s.display !== 'none' && s.visibility !== 'hidden' && +s.opacity > 0.05;
    };
    const name = (e) =>
      (e.id ? '#' + e.id : '') +
      (typeof e.className === 'string' && e.className
        ? '.' + e.className.trim().split(/\s+/).slice(0, 2).join('.')
        : '') || e.tagName.toLowerCase();
    const all = [...document.querySelectorAll('body *')];
    const fixed = all.filter((e) => {
      const s = getComputedStyle(e);
      if (s.position !== 'fixed' || !visible(e)) return false;
      const r = e.getBoundingClientRect();
      return r.width > 16 && r.height > 14 && r.width * r.height < W * H * 0.5 && r.bottom > 0 && r.top < H
        && !e.closest('#game-dialogue-overlay');
    });
    const hits = [];
    for (let i = 0; i < fixed.length; i++) {
      for (let j = i + 1; j < fixed.length; j++) {
        if (fixed[i].contains(fixed[j]) || fixed[j].contains(fixed[i])) continue;
        const a = fixed[i].getBoundingClientRect(), b = fixed[j].getBoundingClientRect();
        const ox = Math.min(a.right, b.right) - Math.max(a.left, b.left);
        const oy = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
        const pair = name(fixed[i]) + ' × ' + name(fixed[j]);
        if (/phone-close-floating-pill/.test(pair) && /hud-/.test(pair)) continue;
        if (ox > 6 && oy > 6) hits.push(pair);
      }
    }
    const off = [];
    for (const e of all) {
      if (e.closest('svg') && e.tagName.toLowerCase() !== 'svg') continue;
      const r = e.getBoundingClientRect();
      if (r.width < 4 || r.height < 4 || r.bottom < 0 || r.top > H) continue;
      if (!(r.right > W + 1 || r.left < -1)) continue;
      if (!visible(e)) continue;
      if (e.closest('.map-pin, .map-area-name, .map-labels, #world-map-labels')) continue;
      off.push(`${name(e)} ${Math.round(r.left)}..${Math.round(r.right)}`);
      if (off.length >= 12) break;
    }
    return { overlaps: hits.slice(0, 20), offscreen: off };
  });
}

async function shot(page, tag, scene) {
  const file = path.join(SHOTS, `${tag}-${scene}.png`);
  await page.screenshot({ path: file });
  const report = await overlaps(page);
  return { file, ...report };
}

async function prep(page) {
  await page.evaluate(() => {
    const g = window.game;
    g.world.skyEnvironment.setHour(12.5);
    const b = g.hud.backend;
    b.data.bank.balance += 50_000_000;
    b.saveData();
  });
  await closeDialogs(page);
}

async function sceneStreet(page) {
  await page.evaluate(() => {
    const g = window.game;
    g.player.stopMoving();
    g.player.mesh.position.set(-9, 0.28, -60);
    g.player.position.set(-9, 0.28, -60);
    g.cameraManager?.setPreset?.('street');
    g.cameraManager?.snapToPlayer?.(g.player);
  });
  await advance(page, 0.5);
  await wait(400);
}

async function sceneRideCard(page) {
  await page.evaluate(() => {
    window.game.hud.phoneModal.open();
  });
  await wait(400);
  await page.evaluate(() => window.game.hud.phoneModal.openApp('ride'));
  await wait(700);
}

async function sceneDriving(page) {
  await page.evaluate(() => window.game.hud.phoneModal?.close?.());
  await wait(200);
  await page.evaluate(() => {
    const g = window.game;
    const v = g.world.vehicles.drivableVehicles.find((x) => x.type === 'sedan')
      || g.world.vehicles.drivableVehicles[0];
    if (!v) return;
    g.player.mesh.position.copy(v.mesh.position);
    g.player.position.copy(g.player.mesh.position);
    g.enterVehicle(v);
  });
  await advance(page, 1.5);
  await wait(500);
}

async function scenePlace(page) {
  await page.evaluate(() => {
    const g = window.game;
    if (g.player.inVehicle || g.world.vehicles?.current) {
      try { g.exitVehicle(); } catch { /* already out */ }
    }
  });
  await wait(300);
  await page.evaluate(() => {
    const g = window.game;
    const sky = g.world.skyEnvironment;
    sky.setHour(12);
    return g.world.interiorManager.enterInterior('amala-shitta', g.player, g.cameraManager, g.hud, g.world);
  });
  await wait(900);
  await advance(page, 0.5);
}

async function leaveVehicleAndInterior(page) {
  await page.evaluate(() => {
    const g = window.game;
    try {
      if (g.player?.inVehicle || document.body.dataset.uiMode === 'driving') g.exitVehicle();
    } catch { /* already out */ }
    try {
      if (g.world.interiorManager.isPlayerInside?.() || g.world.interiorManager.currentInterior) {
        g.world.interiorManager.exitCurrentInterior(g.player, g.cameraManager, g.hud, g.world);
      }
    } catch { /* already out */ }
  });
  await wait(500);
}

async function scenePhone(page) {
  await leaveVehicleAndInterior(page);
  await page.evaluate(() => window.game.hud.phoneModal.open());
  await wait(500);
}

async function sceneMap(page) {
  await leaveVehicleAndInterior(page);
  await page.evaluate(() => window.game.hud.phoneModal?.close?.());
  await wait(200);
  await page.evaluate(() => document.getElementById('nav-btn-map')?.click());
  await advance(page, 1);
  await wait(600);
}

async function closeMap(page) {
  await page.evaluate(() => {
    document.getElementById('btn-map-close')?.click();
    document.querySelector('[data-action="close-map"]')?.click();
    document.querySelector('.map-back, .btn-map-back, #map-back-btn')?.click();
    // Prefer the labelled back control from the map chrome
    const back = [...document.querySelectorAll('button')].find((b) => /back to street/i.test(b.textContent || ''));
    back?.click();
  });
  await wait(400);
}

async function sceneDangote(page) {
  await closeMap(page);
  await page.evaluate(() => {
    const g = window.game;
    const registry = g.modules.DestinationRegistry.getInstance();
    const dest = registry.getById('dest_lagos_refinery')
      || registry.getAllForCity('lagos').find((d) => /dangote/i.test(d.name || ''));
    const p = dest?.streetPosition || { x: 14, z: 3500 };
    g.player.mesh.position.set(p.x, 0.3, p.z + 8);
    g.player.position.copy(g.player.mesh.position);
    g.cameraManager?.setPreset?.('street');
    g.cameraManager?.snapToPlayer?.(g.player);
  });
  await advance(page, 1.5);
  await wait(600);
}

async function sceneApapa(page) {
  await closeMap(page);
  await page.evaluate(() => {
    const g = window.game;
    const registry = g.modules.DestinationRegistry.getInstance();
    const dest = registry.getById('dest_lagos_apapa_fuel_depot')
      || registry.getAllForCity('lagos').find((d) => /apapa.*depot|fuel depot/i.test(d.name || ''));
    const p = dest?.streetPosition || { x: -90, z: 80 };
    g.player.mesh.position.set(p.x, 0.3, p.z + 8);
    g.player.position.copy(g.player.mesh.position);
    g.cameraManager?.setPreset?.('street');
    g.cameraManager?.snapToPlayer?.(g.player);
  });
  await advance(page, 1.5);
  await wait(600);
}

const runners = {
  'street-hud': sceneStreet,
  'ride-card': sceneRideCard,
  'driving-hud': sceneDriving,
  'inside-place': scenePlace,
  'phone': scenePhone,
  'map': sceneMap,
  'dangote-lekki': sceneDangote,
  'apapa-depot': sceneApapa,
};

const browser = await launch();
const report = { game: GAME, takenAt: new Date().toISOString(), phones: [], failedModels: [], vehicleGlbRequests: [] };
try {
  for (const [w, h, orient] of PHONES) {
    const tag = `${w}x${h}-${orient}`;
    const ctx = await newPlayer(browser);
    const page = await ctx.newPage();
    const failedModels = [];
    const vehicleGlbs = [];
    page.on('response', (r) => {
      const u = r.url();
      if (u.includes('/models/') && !r.ok()) failedModels.push({ url: u, status: r.status() });
      if (u.includes('/models/vehicles/')) vehicleGlbs.push({ url: u, status: r.status() });
    });
    await page.emulate({
      viewport: { width: w, height: h, isMobile: true, hasTouch: true, deviceScaleFactor: 2 },
      userAgent:
        'Mozilla/5.0 (Linux; Android 14; SM-A165F) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36',
    });
    await page.goto(GAME, { waitUntil: 'load', timeout: 180000 });
    await page.waitForFunction('window.game', { timeout: 180000 });
    await wait(2800);
    await prep(page);

    const phoneReport = { tag, w, h, orient, scenes: {} };
    for (const scene of SCENES) {
      try {
        await runners[scene](page);
        phoneReport.scenes[scene] = await shot(page, tag, scene);
      } catch (e) {
        phoneReport.scenes[scene] = { error: String(e).slice(0, 240) };
      }
    }
    phoneReport.failedModels = failedModels;
    phoneReport.vehicleGlbRequests = vehicleGlbs;
    report.phones.push(phoneReport);
    report.failedModels.push(...failedModels);
    report.vehicleGlbRequests.push(...vehicleGlbs);
    await ctx.close();
  }
} finally {
  await browser.close();
}

const out = path.join(SHOTS, 'overlap-report.json');
fs.writeFileSync(out, JSON.stringify(report, null, 2));
console.log('Wrote', out);
const badOverlaps = report.phones.flatMap((p) =>
  Object.entries(p.scenes).flatMap(([scene, s]) =>
    (s.overlaps || []).map((o) => `${p.tag}/${scene}: ${o}`),
  ),
);
const badOff = report.phones.flatMap((p) =>
  Object.entries(p.scenes).flatMap(([scene, s]) =>
    (s.offscreen || []).slice(0, 3).map((o) => `${p.tag}/${scene} off: ${o}`),
  ),
);
console.log('Overlaps:', badOverlaps.length ? badOverlaps.join('\n') : 'none');
console.log('Offscreen samples:', badOff.length ? badOff.slice(0, 20).join('\n') : 'none');
console.log('Failed model requests:', report.failedModels.length);
console.log('Vehicle GLB requests:', report.vehicleGlbRequests.length);
process.exit(badOverlaps.length || report.failedModels.some((m) => /characters|required/i.test(m.url || '')) ? 1 : 0);
