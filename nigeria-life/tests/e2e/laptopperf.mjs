// Laptop / HD-620-oriented graphics compare at 1280×720.
// Measures High vs Low: FPS, frame time, draw calls, triangles, heap, drawing-buffer size.
// Cloud/CI uses software WebGL — treat numbers as relative, not EliteBook claims.
import { open, newPlayer, closeDialogs, wait, playUntil } from './lib.mjs';
import { mkdirSync, writeFileSync } from 'node:fs';

const SHOTS = process.env.SHOTS || '/opt/cursor/artifacts';
mkdirSync(SHOTS, { recursive: true });

const sample = (page, ms = 4000) => page.evaluate(async (duration) => {
  const g = window.game;
  const deltas = [];
  let last = performance.now();
  const start = last;
  await new Promise((resolve) => {
    const tick = (now) => {
      deltas.push(now - last);
      last = now;
      if (now - start < duration) requestAnimationFrame(tick);
      else resolve();
    };
    requestAnimationFrame(tick);
  });
  // Software WebGL frames can exceed 250ms — keep slow frames in the sample
  const valid = deltas.slice(2).filter((d) => d > 0 && d < 5000);
  valid.sort((a, b) => a - b);
  const avg = valid.length ? valid.reduce((s, d) => s + d, 0) / valid.length : 0;
  const p95 = valid.length ? valid[Math.min(valid.length - 1, Math.floor(valid.length * 0.95))] : 0;
  const info = g.renderer.info.render;
  const THREE = g.modules.THREE;
  const size = g.renderer.getDrawingBufferSize(new THREE.Vector2());
  return {
    fps: +(1000 / avg).toFixed(1),
    avgMs: +avg.toFixed(2),
    p95Ms: +p95.toFixed(2),
    calls: info.calls,
    tris: info.triangles,
    heapMB: performance.memory ? +(performance.memory.usedJSHeapSize / 1048576).toFixed(1) : null,
    drawW: size.x,
    drawH: size.y,
    level: g.graphics.level,
    label: g.graphics.label,
    renderScale: +g.graphics.renderScale.toFixed(3),
    wetMetalMax: g.world.weather.wetMetalnessMax,
  };
}, ms);

export async function run(browser, check) {
  const ctx = await newPlayer(browser);
  const { page, log } = await open(ctx, { w: 1280, h: 720 });
  await closeDialogs(page);
  await wait(2500);

  // Warm shaders once at High
  await page.evaluate(() => window.game.graphics.choose('high'));
  await wait(1500);
  for (let i = 0; i < 30; i++) await page.evaluate(() => window.game.advance?.(0.05));
  await wait(800);

  const high = await sample(page, 4500);
  await page.screenshot({ path: `${SHOTS}/laptopperf-high-street.png` });

  await page.evaluate(() => window.game.graphics.choose('low'));
  await wait(1200);
  const low = await sample(page, 4500);
  await page.screenshot({ path: `${SHOTS}/laptopperf-low-street.png` });

  // Dense-ish: noon Broad Street standing
  await page.evaluate(() => {
    const g = window.game;
    g.world.skyEnvironment.setHour(12);
    g.player.stopMoving();
    g.player.mesh.position.set(0, 0, 8);
    g.player.position.copy(g.player.mesh.position);
    g.cameraManager.setPreset('street');
    g.cameraManager.snapToPlayer(g.player);
  });
  await wait(600);
  const lowDense = await sample(page, 3500);

  // Interior on Low
  await page.evaluate(() => {
    const be = window.game.hud.backend;
    be.performGig(5_000_000, 0, 'laptopperf');
    be.rentProperty('prop_mainland_apt');
  });
  await page.evaluate(() => window.game.hud.onEnterInterior('residence:prop_mainland_apt'));
  await playUntil(page, () => (window.game.world.interiorManager.currentInterior?.type === 'residence' && !window.game.world.interiorManager.busy ? true : null), 25);
  await wait(800);
  const lowHome = await sample(page, 3500);
  await page.screenshot({ path: `${SHOTS}/laptopperf-low-home.png` });

  await page.evaluate(() => {
    const g = window.game;
    return g.world.interiorManager.exitCurrentInterior(g.player, g.cameraManager, g.hud, g.world);
  });
  await wait(800);

  // Night slice on Low for lighting demo
  await page.evaluate(() => {
    window.game.graphics.choose('balanced');
    window.game.world.skyEnvironment.setHour(21.5);
    window.game.world.roads?.setNightLighting?.('night');
    window.game.modules && null;
  });
  // Material night via sky hour tick
  await page.evaluate(() => {
    const sky = window.game.world.skyEnvironment;
    sky.setHour(21.5);
    for (let i = 0; i < 10; i++) sky.update?.(0.1);
    window.game.render();
  });
  await wait(500);
  await page.screenshot({ path: `${SHOTS}/visualslice-lagos-night.png` });

  await page.evaluate(() => {
    const sky = window.game.world.skyEnvironment;
    sky.setHour(12);
    for (let i = 0; i < 10; i++) sky.update?.(0.1);
    window.game.render();
  });
  await wait(400);
  await page.screenshot({ path: `${SHOTS}/visualslice-lagos-day.png` });

  const report = { high, low, lowDense, lowHome, note: 'Software/WebGL relative; not HD 620 device claim' };
  writeFileSync(`${SHOTS}/laptopperf-report.json`, JSON.stringify(report, null, 2));

  check('laptopperf: Low drawing buffer is smaller than High at 1280×720',
    low.drawW * low.drawH < high.drawW * high.drawH && low.drawH <= 720,
    { high: { w: high.drawW, h: high.drawH }, low: { w: low.drawW, h: low.drawH } });

  check('laptopperf: Low wet-road metalness cap is stricter than High',
    low.wetMetalMax < high.wetMetalMax,
    { high: high.wetMetalMax, low: low.wetMetalMax });

  check('laptopperf: Low crowd/district settings applied (label Low)',
    low.level === 'low' && low.label === 'Low',
    low);

  // Relative cost: Low should draw fewer triangles / calls than High on the same street
  check('laptopperf: Low draws fewer or equal triangles than High on the street',
    low.tris <= high.tris && low.calls <= high.calls,
    { highCalls: high.calls, lowCalls: low.calls, highTris: high.tris, lowTris: low.tris, highFps: high.fps, lowFps: low.fps });

  check('laptopperf: interior on Low still runs (fps + draw stats)',
    lowHome.fps > 1 && lowHome.calls > 0 && lowHome.tris > 0,
    lowHome);

  check('laptopperf: no page errors', log.errors.length === 0, log.errors.slice(0, 4));

  console.log('laptopperf report', JSON.stringify(report));
}
