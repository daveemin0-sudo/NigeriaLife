// A measuring tool, not a suite: two builds compared fairly on a machine whose speed wanders.
// They are measured in turn, A B A B ..., each from a fresh load, in the same scenes, so whatever
// else the machine is doing falls on both alike. Reported: the median of the rounds.
//
//   node tests/e2e/perf_ab.mjs http://localhost:4205/ http://localhost:4206/ [rounds] [out.json]
//
// Per scene: frames a second, the slowest frame in a hundred, the game's own work per frame,
// and the time to load (to the first second with ten frames drawn).
import fs from 'node:fs';
import { launch, newPlayer, closeDialogs, wait } from './lib.mjs';

const [A, B] = [process.argv[2], process.argv[3]];
const ROUNDS = Number(process.argv[4] || 3);
const out = process.argv[5];
const SLOW = Number(process.env.CPU_SLOW || 4);
const LEVEL = process.env.LEVEL || 'balanced';
const PHONE = { viewport: { width: 360, height: 780, isMobile: true, hasTouch: true, deviceScaleFactor: 2 }, userAgent: 'Mozilla/5.0 (Linux; Android 14; SM-A165F) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36' };
const browser = await launch();

async function once(url) {
  const ctx = await newPlayer(browser);
  const page = await ctx.newPage();
  // Emulated before the first load: changing it afterwards reloads the page
  await page.emulate(PHONE);
  const cdp = await page.createCDPSession();
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: SLOW });
  const t0 = Date.now();
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 600000 });
  await page.waitForFunction('window.game', { timeout: 600000, polling: 200 });
  const playable = await page.evaluate(() => new Promise((resolve) => {
    const start = performance.now();
    let frames = [];
    const tick = (now) => { frames.push(now); frames = frames.filter((f) => now - f < 1000); if (frames.length >= 10 || now - start > 120000) resolve(now - start); else requestAnimationFrame(tick); };
    requestAnimationFrame(tick);
  }));
  const loadSeconds = (Date.now() - t0) / 1000;
  await wait(4000);
  await closeDialogs(page);
  await page.evaluate((lvl) => window.game.graphics.choose(lvl), LEVEL);
  await page.evaluate(() => {
    const g = window.game;
    const P = (window.__ab = { on: false, frames: [], step: 0, n: 0 });
    const step = g.step.bind(g);
    g.step = (dt) => { const t = performance.now(); step(dt); if (P.on) { P.step += performance.now() - t; P.n += 1; } };
    let last = 0;
    const frame = (now) => { requestAnimationFrame(frame); if (P.on && last) P.frames.push(now - last); last = now; };
    requestAnimationFrame(frame);
  });
  const sample = async (seconds) => {
    await page.evaluate(() => { const P = window.__ab; P.frames = []; P.step = 0; P.n = 0; P.on = true; });
    await wait(seconds * 1000);
    return page.evaluate(() => {
      const P = window.__ab; P.on = false;
      const f = [...P.frames].sort((a, b) => a - b);
      const sum = f.reduce((a, b) => a + b, 0);
      return { fps: f.length / (sum / 1000), worst1pcMs: f[Math.floor(f.length * 0.99)], stepMs: P.step / Math.max(1, P.n) };
    });
  };
  const row = { loadSeconds };
  await wait(2500);
  row.street = await sample(7);
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
  await wait(2000);
  row.driving = await sample(7);
  await page.evaluate(() => { clearInterval(window.__cruise); const g = window.game; g.player.currentVehicle.currentSpeed = 0; g.exitVehicle(); });
  await page.evaluate(() => { const g = window.game; g.hud.backend.performGig(5_000_000, 0, 'perf'); g.hud.backend.rentProperty('prop_mainland_apt'); g.hud.onEnterInterior('residence:prop_mainland_apt'); });
  await wait(6000);
  row.home = await sample(5);
  await ctx.close();
  return row;
}

const runs = { A: [], B: [] };
for (let i = 0; i < ROUNDS; i++) {
  for (const [label, url] of i % 2 === 0 ? [['A', A], ['B', B]] : [['B', B], ['A', A]]) {
    try {
      const r = await once(url);
      runs[label].push(r);
      console.log(`round ${i + 1} ${label}`, JSON.stringify({ load: +r.loadSeconds.toFixed(1), street: +r.street.fps.toFixed(1), driving: +r.driving.fps.toFixed(1), home: +r.home.fps.toFixed(1), streetStepMs: +r.street.stepMs.toFixed(1) }));
    } catch (e) {
      console.log(`round ${i + 1} ${label} failed: ${String(e.message).slice(0, 120)}`);
    }
  }
}
await browser.close();
const median = (xs) => { const s = [...xs].sort((a, b) => a - b); return s.length ? s[Math.floor((s.length - 1) / 2)] : null; };
const summary = {};
for (const label of ['A', 'B']) {
  const rs = runs[label];
  summary[label] = { url: label === 'A' ? A : B, rounds: rs.length, loadSeconds: median(rs.map((r) => r.loadSeconds)) };
  for (const scene of ['street', 'driving', 'home']) summary[label][scene] = { fps: median(rs.map((r) => r[scene].fps)), worst1pcMs: median(rs.map((r) => r[scene].worst1pcMs)), stepMs: median(rs.map((r) => r[scene].stepMs)) };
}
console.log(`\nMedians (processor slowed ${SLOW}x, ${LEVEL}, 360 x 780 touch):`);
for (const label of ['A', 'B']) {
  const s = summary[label];
  console.log(`${label} ${s.url}  load ${s.loadSeconds?.toFixed(1)} s` + ['street', 'driving', 'home'].map((k) => ` | ${k} ${s[k].fps?.toFixed(1)} fps, 1% ${s[k].worst1pcMs?.toFixed(0)} ms, work ${s[k].stepMs?.toFixed(1)} ms`).join(''));
}
if (out) fs.writeFileSync(out, JSON.stringify({ slow: SLOW, level: LEVEL, runs, summary }, null, 1));
