// A measuring tool, not a suite: the game as a budget phone runs it. A phone-sized touch screen,
// the processor slowed (CPU_SLOW, default 4 times), and for the load a slow mobile network.
//
//   GAME_URL=http://localhost:4206/ node tests/e2e/perf_lowend.mjs [out.json]
//
// For each scene (street standing, walking, driving, at home, the map, the phone open) and each
// graphics level it reports frames a second (the average and the slowest one in a hundred), how
// long the game's own work takes each frame against the drawing, what is drawn (calls, triangles),
// and memory. The work of each frame is split by part, so the costly ones can be named.
//
// The graphics card cannot be slowed: these numbers are for this machine's (see the report).
import fs from 'node:fs';
import { launch, newPlayer, closeDialogs, wait, playUntil, GAME_URL } from './lib.mjs';

const SLOW = Number(process.env.CPU_SLOW || 4);
const LEVELS = (process.env.LEVELS || 'balanced,low').split(',');
const out = process.argv[2];
const browser = await launch();
const result = { url: GAME_URL, cpuSlow: SLOW, load: {}, scenes: [] };

const PHONE = { viewport: { width: 360, height: 780, isMobile: true, hasTouch: true, deviceScaleFactor: 2 }, userAgent: 'Mozilla/5.0 (Linux; Android 14; SM-A165F) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36' };

// ------------------------------------------------------------------ Loading
async function load(label, { cpu, network }) {
  const ctx = await newPlayer(browser);
  const page = await ctx.newPage();
  await page.emulate(PHONE);
  const cdp = await page.createCDPSession();
  await cdp.send('Network.enable');
  await cdp.send('Network.setCacheDisabled', { cacheDisabled: true });
  if (network) await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: network.latency, downloadThroughput: (network.down * 1024 * 1024) / 8, uploadThroughput: (network.up * 1024 * 1024) / 8 });
  if (cpu > 1) await cdp.send('Emulation.setCPUThrottlingRate', { rate: cpu });
  let bytes = 0, requests = 0;
  const byType = {};
  cdp.on('Network.loadingFinished', (e) => { bytes += e.encodedDataLength; requests += 1; });
  cdp.on('Network.responseReceived', (e) => { byType[e.requestId] = e.type; });
  const sizes = {};
  cdp.on('Network.loadingFinished', (e) => { const t = byType[e.requestId] ?? 'Other'; sizes[t] = (sizes[t] ?? 0) + e.encodedDataLength; });
  const t0 = Date.now();
  await page.goto(GAME_URL, { waitUntil: 'domcontentloaded', timeout: 600000 });
  const dom = Date.now() - t0;
  await page.waitForFunction('window.game', { timeout: 600000, polling: 100 });
  const game = Date.now() - t0;
  // The first frames are slow while shaders compile: playable is the first second with ten frames in it
  const playable = await page.evaluate(() => new Promise((resolve) => {
    const start = performance.now();
    let frames = [];
    const tick = (now) => {
      frames.push(now);
      frames = frames.filter((f) => now - f < 1000);
      if (frames.length >= 10 || now - start > 120000) resolve(now - start);
      else requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }));
  const mem = await page.evaluate(() => ({ heapMB: +(performance.memory.usedJSHeapSize / 1048576).toFixed(0), geometries: window.game.renderer.info.memory.geometries, textures: window.game.renderer.info.memory.textures }));
  result.load[label] = { domSeconds: +(dom / 1000).toFixed(1), gameSeconds: +(game / 1000).toFixed(1), playableSeconds: +((game + playable) / 1000).toFixed(1), requests, transferredMB: +(bytes / 1048576).toFixed(2), byTypeMB: Object.fromEntries(Object.entries(sizes).map(([k, v]) => [k, +(v / 1048576).toFixed(2)])), ...mem };
  console.log('load', label, JSON.stringify(result.load[label]));
  await ctx.close();
}

// ------------------------------------------------------------------ Frames
async function scenes(level) {
  const ctx = await newPlayer(browser);
  const page = await ctx.newPage();
  await page.emulate(PHONE);
  const cdp = await page.createCDPSession();
  await page.goto(GAME_URL, { waitUntil: 'load', timeout: 600000 });
  await page.waitForFunction('window.game', { timeout: 600000 });
  await wait(6000);
  await closeDialogs(page);
  await page.evaluate((lvl) => window.game.graphics.choose(lvl), level);
  await wait(2500);
  // The game's work each frame, and each part of it, timed
  await page.evaluate(() => {
    const g = window.game;
    const P = (window.__perf = { on: false, frames: [], step: 0, render: 0, parts: {}, n: 0 });
    const wrap = (obj, name, key) => {
      if (!obj || typeof obj[name] !== 'function') return;
      const original = obj[name].bind(obj);
      obj[name] = (...args) => { if (!P.on) return original(...args); const t = performance.now(); const r = original(...args); P.parts[key] = (P.parts[key] ?? 0) + performance.now() - t; return r; };
    };
    const step = g.step.bind(g), render = g.render.bind(g);
    g.step = (dt) => { const t = performance.now(); step(dt); if (P.on) P.step += performance.now() - t; };
    g.render = () => { const t = performance.now(); render(); if (P.on) { P.render += performance.now() - t; P.n += 1; } };
    const w = g.world;
    wrap(g.player, 'update', 'player');
    wrap(g.cameraManager, 'update', 'camera');
    wrap(w.skyEnvironment, 'update', 'sky');
    wrap(w.interiorManager, 'update', 'interior');
    wrap(w.interiorManager, 'updateCutaway', 'cutaway');
    wrap(w.landmarks, 'update', 'landmarks');
    wrap(w.cityManager, 'update', 'city');
    wrap(w.weather, 'update', 'weather');
    wrap(w.vehicles, 'update', 'vehicles');
    wrap(w.trafficSpawner, 'update', 'traffic');
    wrap(w.expressway, 'update', 'expressway');
    wrap(w.npcs, 'update', 'npcs');
    wrap(w.cityPopulation, 'update', 'crowd');
    wrap(w.lagoon, 'update', 'lagoon');
    wrap(w.agamas, 'update', 'agamas');
    wrap(g.plotWorld, 'tick', 'plots');
    wrap(g.plotWorld, 'refresh', 'plotsRefresh');
    wrap(g.hud, 'refreshNearby', 'hudNearby');
    wrap(g.hud, 'update', 'hud');
    wrap(g.rides, 'update', 'rides');
    wrap(g.rideHail, 'update', 'rideHail');
    wrap(g.miniMap, 'update', 'miniMap');
    wrap(g.viewPicker, 'update', 'viewPicker');
    wrap(g.routeGuide, 'update', 'routeGuide');
    let last = 0;
    const frame = (now) => { requestAnimationFrame(frame); if (P.on && last) P.frames.push(now - last); last = now; };
    requestAnimationFrame(frame);
  });
  const sample = async (name, seconds = 8) => {
    await page.evaluate(() => { const P = window.__perf; P.frames = []; P.step = 0; P.render = 0; P.parts = {}; P.n = 0; P.on = true; });
    await wait(seconds * 1000);
    const m = await page.evaluate(() => {
      const P = window.__perf; P.on = false;
      const g = window.game;
      const f = [...P.frames].sort((a, b) => a - b);
      const sum = f.reduce((a, b) => a + b, 0);
      const info = g.renderer.info;
      const parts = Object.entries(P.parts).map(([k, v]) => [k, +(v / Math.max(1, P.n)).toFixed(2)]).filter(([, v]) => v >= 0.05).sort((a, b) => b[1] - a[1]);
      return {
        fps: +(f.length / (sum / 1000)).toFixed(1), frameMs: +(sum / f.length).toFixed(0), worst1pcMs: +f[Math.floor(f.length * 0.99)].toFixed(0), worstMs: +f[f.length - 1].toFixed(0),
        stepMs: +(P.step / Math.max(1, P.n)).toFixed(1), renderMs: +(P.render / Math.max(1, P.n)).toFixed(1), parts: Object.fromEntries(parts.slice(0, 8)),
        calls: info.render.calls, triangles: info.render.triangles, geometries: info.memory.geometries, textures: info.memory.textures, heapMB: +(performance.memory.usedJSHeapSize / 1048576).toFixed(0),
        pixels: `${g.renderer.domElement.width}x${g.renderer.domElement.height}`, level: g.graphics.level,
      };
    });
    const row = { level, cpu: null, scene: name, ...m };
    return row;
  };
  const both = async (name, seconds) => {
    for (const cpu of [1, SLOW]) {
      await cdp.send('Emulation.setCPUThrottlingRate', { rate: cpu });
      await wait(1500);
      const row = await sample(name, seconds);
      row.cpu = cpu;
      result.scenes.push(row);
      console.log(`${level} cpu/${cpu} ${name}:`, JSON.stringify({ fps: row.fps, worst1pcMs: row.worst1pcMs, stepMs: row.stepMs, renderMs: row.renderMs, calls: row.calls, tris: row.triangles, heapMB: row.heapMB, parts: row.parts }));
    }
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
  };

  await both('street, standing');
  // Walking down the pavement with the stick
  const stick = await page.evaluate(() => { const e = document.querySelector('.v-joystick-base'); if (!e) return null; const r = e.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
  if (stick) {
    const finger = await page.touchscreen.touchStart(stick.x, stick.y);
    await finger.move(stick.x, stick.y - 40);
    await both('street, walking');
    await finger.end();
  }
  // Driving down Broad Street at about 60 km/h (the police at the checkpoint are left out of it)
  await page.evaluate(() => {
    const g = window.game;
    g.checkpointPassAt = Date.now() + 3_600_000;
    const v = g.world.vehicles.drivableVehicles.find((c) => c.type === 'sedan');
    v.constructor.ignoreBodies = true;
    v.mesh.position.set(-4.9, 0, -100);
    v.mesh.rotation.y = 0;
    g.player.mesh.position.copy(v.mesh.position);
    g.enterVehicle(v);
    window.__cruise = setInterval(() => { const c = g.player.currentVehicle; if (!c) return; c.currentSpeed = 16.7; c.fuel = 100; if (c.mesh.position.z > 150) c.mesh.position.z = -100; }, 100);
  });
  await wait(1500);
  await both('driving at 60 km/h');
  await page.evaluate(() => { clearInterval(window.__cruise); const g = window.game; g.player.currentVehicle.currentSpeed = 0; g.exitVehicle(); });
  await wait(1500);
  // The map
  await page.evaluate(() => document.getElementById('nav-btn-map').click());
  await wait(3000);
  await both('the map', 6);
  await page.evaluate(() => document.getElementById('btn-map-back-street')?.click());
  await wait(2000);
  // The phone open over the street
  await page.evaluate(() => document.getElementById('nav-btn-phone').click());
  await wait(1500);
  await both('phone open', 6);
  await page.evaluate(() => window.game.hud.phoneModal.close());
  await wait(800);
  // At home
  await page.evaluate(() => { const g = window.game; g.hud.backend.performGig(5_000_000, 0, 'perf'); g.hud.backend.rentProperty('prop_mainland_apt'); g.hud.onEnterInterior('residence:prop_mainland_apt'); });
  await playUntil(page, () => (window.game.world.interiorManager.currentInterior?.type === 'residence' && !window.game.world.interiorManager.busy ? true : null), 25);
  await wait(2500);
  await both('at home', 6);
  await ctx.close();
}

if (!process.env.SKIP_LOAD) {
  await load('this machine, fast network', { cpu: 1, network: null });
  await load(`processor /${SLOW}, fast network`, { cpu: SLOW, network: null });
  await load(`processor /${SLOW}, slow 4G (4 Mbit/s, 150 ms)`, { cpu: SLOW, network: { down: 4, up: 1.5, latency: 150 } });
}
for (const level of LEVELS) await scenes(level);
await browser.close();
if (out) fs.writeFileSync(out, JSON.stringify(result, null, 1));
