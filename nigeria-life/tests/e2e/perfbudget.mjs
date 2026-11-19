// Performance budget & baseline measurement suite (M1 Package 1).
// Measures startup stages, instrumentation overhead, first-use freezes, and per-city steady-state
// metrics (Lagos, Abuja, Port Harcourt) at both A16 emulation (320x607, touch, 4x CPU) and Desktop (1366x768).
import { newPlayer, open, closeDialogs, wait, GAME_URL } from './lib.mjs';

const withQuery = (q) => GAME_URL + (GAME_URL.includes('?') ? '&' : '?') + q;

async function setupA16(page) {
  await page.emulate({
    viewport: { width: 320, height: 607, isMobile: true, hasTouch: true, deviceScaleFactor: 3 },
    userAgent: 'Mozilla/5.0 (Linux; Android 14; SM-A165F) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36',
  });
  const cdp = await page.createCDPSession();
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  return cdp;
}

async function sampleWindow(page, durationMs = 5000) {
  return page.evaluate(async (ms) => {
    return new Promise((resolve) => {
      const deltas = [];
      const mem = performance.memory;
      let lastHeap = mem ? mem.usedJSHeapSize : 0;
      let allocBytes = 0;
      let last = performance.now();
      const start = last;

      const tick = (now) => {
        const d = now - last;
        last = now;
        deltas.push(d);
        if (mem) {
          const cur = mem.usedJSHeapSize;
          if (cur > lastHeap) allocBytes += cur - lastHeap;
          lastHeap = cur;
        }
        if ((now - start < ms || deltas.length < 6) && (now - start < 9000)) {
          requestAnimationFrame(tick);
        } else {
          const valid = deltas.slice(1);
          const sorted = [...valid].sort((a, b) => a - b);
          const total = valid.reduce((s, v) => s + v, 0);
          const g = window.game;
          const info = g?.renderer?.info;
          let sceneObjects = 0;
          g?.scene?.traverse(() => { sceneObjects++; });
          resolve({
            frames: valid.length,
            fps: valid.length && total > 0 ? +((valid.length * 1000) / total).toFixed(1) : 0,
            p95: sorted.length ? +sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95))].toFixed(1) : 0,
            worst: sorted.length ? +sorted[sorted.length - 1].toFixed(1) : 0,
            avgMs: valid.length ? +(total / valid.length).toFixed(1) : 0,
            calls: info?.render?.calls ?? 0,
            triangles: info?.render?.triangles ?? 0,
            geometries: info?.memory?.geometries ?? 0,
            textures: info?.memory?.textures ?? 0,
            programs: info?.programs?.length ?? 0,
            sceneObjects,
            heapMB: mem ? Math.round(mem.usedJSHeapSize / 1048576) : null,
            allocMBps: mem && total > 0 ? +((allocBytes / 1048576) / (total / 1000)).toFixed(2) : null,
          });
        }
      };
      requestAnimationFrame(tick);
    });
  }, durationMs);
}

async function measureAction(page, fn, settleMs = 3500) {
  const beforePrograms = await page.evaluate(() => window.game?.renderer?.info?.programs?.length ?? 0);
  const done = page.evaluate(async (ms) => {
    return new Promise((resolve) => {
      let worst = 0;
      let last = performance.now();
      const start = last;
      const tick = (now) => {
        const d = now - last;
        last = now;
        if (d > worst) worst = d;
        if (now - start < ms) requestAnimationFrame(tick);
        else resolve(Math.round(worst));
      };
      requestAnimationFrame(tick);
    });
  }, settleMs);
  await page.evaluate(fn);
  const worstMs = await done;
  const afterPrograms = await page.evaluate(() => window.game?.renderer?.info?.programs?.length ?? 0);
  return { worstMs, programsBefore: beforePrograms, programsAfter: afterPrograms, programsDelta: afterPrograms - beforePrograms };
}

export async function run(browser, check) {
  // ------------------------------------------------------------------ 1. A16 Emulation: Startup, Overhead, Freezes & 3 Cities
  {
    const ctx = await newPlayer(browser);
    const page = await ctx.newPage();
    await setupA16(page);
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto(withQuery('perf=1'), { waitUntil: 'domcontentloaded', timeout: 240000 });
    await page.waitForFunction(() => {
      try { return JSON.parse(localStorage.getItem('nl_load_times_v1') || '[]').length > 0; } catch { return false; }
    }, { timeout: 240000, polling: 500 });
    await closeDialogs(page);
    await page.waitForFunction(() => window.game && !window.game.idleWarming, { timeout: 25000, polling: 200 }).catch(() => null);
    await wait(1000);

    const a16Load = await page.evaluate(() => JSON.parse(localStorage.getItem('nl_load_times_v1') || '[]')[0] || null);
    const a16OnLagos = await sampleWindow(page, 4000);

    // Measure instrumentation overhead in the same settled page by toggling PerfReadout OFF via Settings > Graphics
    await page.evaluate(() => {
      document.querySelector('#nav-btn-phone')?.click();
      document.querySelector('[data-app="settings"]')?.click();
    });
    await page.waitForSelector('[data-act="toggle-perf-readout"]', { timeout: 10000 });
    await page.evaluate(() => {
      document.querySelector('[data-act="toggle-perf-readout"]')?.click();
      document.querySelector('.phone-close-btn, #phone-close-btn, [data-act="close-phone"]')?.click();
    });
    await closeDialogs(page);
    await wait(500);
    const a16OffLagos = await sampleWindow(page, 4000);
    // Turn readout back ON for the rest of the run
    await page.evaluate(() => {
      document.querySelector('#nav-btn-phone')?.click();
      document.querySelector('[data-app="settings"]')?.click();
    });
    await page.waitForSelector('[data-act="toggle-perf-readout"]', { timeout: 10000 });
    await page.evaluate(() => {
      document.querySelector('[data-act="toggle-perf-readout"]')?.click();
      document.querySelector('.phone-close-btn, #phone-close-btn, [data-act="close-phone"]')?.click();
    });
    await closeDialogs(page);
    await wait(500);

    const overhead = {
      fpsOff: a16OffLagos.fps,
      fpsOn: a16OnLagos.fps,
      avgMsOff: a16OffLagos.avgMs,
      avgMsOn: a16OnLagos.avgMs,
      heapDiffMB: (a16OnLagos.heapMB ?? 0) - (a16OffLagos.heapMB ?? 0),
    };
    console.log('[perfbudget] A16 Load:', JSON.stringify(a16Load));
    console.log('[perfbudget] A16 Instrumentation Overhead:', JSON.stringify(overhead));

    // Readout placement at 320x607: must be top-right, never cover center third (player) or key controls
    const layout = await page.evaluate(() => {
      const p = document.getElementById('nl-perf-readout');
      if (!p) return { present: false };
      const r = p.getBoundingClientRect();
      const centerThird = { left: innerWidth / 3, right: (innerWidth * 2) / 3, top: innerHeight / 3, bottom: (innerHeight * 2) / 3 };
      const overlaps = (a, b) => !(a.right <= b.left || a.left >= b.right || a.bottom <= b.top || a.top >= b.bottom);
      const coversCenter = overlaps(r, centerThird);
      const controls = ['#hud-run-btn', '#nav-btn-phone', '#nav-btn-map', '#card-action-btn']
        .map((sel) => {
          const el = document.querySelector(sel);
          if (!el) return null;
          const cr = el.getBoundingClientRect();
          if (cr.width === 0 || cr.height === 0) return null;
          return { sel, overlap: overlaps(r, cr) };
        })
        .filter(Boolean);
      const toggle = p.querySelector('button[aria-label*="Collapse"], button[aria-label*="Expand"]');
      const beforeW = Math.round(r.width);
      const beforeH = Math.round(r.height);
      toggle?.click();
      const rCol = p.getBoundingClientRect();
      toggle?.click();
      const rExp = p.getBoundingClientRect();
      return {
        present: true,
        top: Math.round(r.top),
        right: Math.round(r.right),
        width: beforeW,
        height: beforeH,
        collapsedHeight: Math.round(rCol.height),
        expandedHeight: Math.round(rExp.height),
        inside: r.left >= 0 && r.right <= innerWidth && r.top >= 0 && r.bottom <= innerHeight,
        topRight: r.top <= 16 && r.right >= innerWidth - 16,
        coversCenter,
        overlapsControl: controls.some((c) => c.overlap),
        controls,
      };
    });
    check('perfbudget: 320x607 readout is top-right, collapsible, and never covers the player or key controls',
      layout.present && layout.inside && layout.topRight && !layout.coversCenter && !layout.overlapsControl && layout.collapsedHeight < layout.expandedHeight,
      layout);

    // Measure all 3 cities steady-state cleanly BEFORE first-use freezes
    const builtAtStart = await page.evaluate(() => window.game.world.cityManager.builtCities());

    const tAbuja0 = Date.now();
    await page.evaluate(() => window.game.arriveInCity('abuja'));
    await wait(2000);
    const abujaSwitchMs = Date.now() - tAbuja0;
    const builtAfterAbuja = await page.evaluate(() => window.game.world.cityManager.builtCities());
    const a16Abuja = await sampleWindow(page, 4000);

    const tPh0 = Date.now();
    await page.evaluate(() => window.game.arriveInCity('port_harcourt'));
    await wait(2000);
    const phSwitchMs = Date.now() - tPh0;
    const builtAfterPh = await page.evaluate(() => window.game.world.cityManager.builtCities());
    const a16Ph = await sampleWindow(page, 4000);

    // Return to Lagos for first-use freezes (map, room, ride, flight)
    await page.evaluate(() => window.game.arriveInCity('lagos'));
    await page.waitForFunction(() => window.game && !window.game.idleWarming, { timeout: 15000, polling: 200 }).catch(() => null);
    await wait(1000);
    const firstMap = await measureAction(page, () => { document.getElementById('nav-btn-map')?.click(); }, 3500);
    await page.evaluate(() => { document.getElementById('btn-map-back-street')?.click(); });
    await wait(800);
    const firstRoom = await measureAction(page, () => {
      void window.game.world.interiorManager.enterInterior('mama-put', window.game.player, window.game.cameraManager, window.game.hud, window.game.world);
    }, 3500);
    await page.evaluate(() => {
      void window.game.world.interiorManager.exitCurrentInterior?.(window.game.player, window.game.cameraManager, window.game.hud, window.game.world);
    });
    await wait(1200);
    const firstRide = await measureAction(page, () => {
      const dest = window.game.modules?.DestinationRegistry?.getByCity?.('lagos')?.[0];
      if (dest) window.game.hud.onRideTo?.({ x: dest.x, z: dest.z }, dest.name, 500);
    }, 3500);
    await page.evaluate(() => { window.game.roadRideExperience?.skipRide?.(); });
    await wait(1200);
    const firstFlight = await measureAction(page, () => {
      window.game.world.setStreetModeVisibility(false);
      window.game.flightExperience.startFlight({
        flightCode: 'NL 101', airlineName: 'Air Peace', originId: 'lagos', originName: 'Lagos',
        destinationId: 'abuja', destinationName: 'Abuja', durationSeconds: 120, travelClass: 'Economy',
      });
    }, 3500);
    await page.evaluate(() => {
      window.game.flightExperience.skipFlight();
      window.game.world.setStreetModeVisibility(true);
      window.game.arriveInCity('lagos');
    });
    await wait(800);

    console.log('[perfbudget] A16 First-Use Freezes:', JSON.stringify({ firstMap, firstRoom, firstRide, firstFlight }));
    console.log('[perfbudget] A16 Lagos:', JSON.stringify(a16OnLagos));
    console.log('[perfbudget] A16 Abuja (switch ' + abujaSwitchMs + 'ms):', JSON.stringify(a16Abuja));
    console.log('[perfbudget] A16 Port Harcourt (switch ' + phSwitchMs + 'ms):', JSON.stringify(a16Ph));

    // Evidence-based baseline regression guards & Package 2/3 acceptance
    const playableSec = a16Load?.stages?.playable ?? 999;
    check('perfbudget: A16 startup completes within baseline budget (<= 45 s)', playableSec > 0 && playableSec <= 45, a16Load);
    check('perfbudget: A16 cities are built lazily only when first visited',
      builtAtStart.length === 1 && builtAtStart[0] === 'lagos'
      && builtAfterAbuja.length === 2 && builtAfterAbuja.includes('abuja') && !builtAfterAbuja.includes('port_harcourt')
      && builtAfterPh.length === 3 && builtAfterPh.includes('port_harcourt'),
      { builtAtStart, builtAfterAbuja, builtAfterPh });
    check('perfbudget: A16 first map, room, ride and flight have no synchronous shader-compile freeze (>500 ms with +shaders)',
      (firstMap.programsDelta === 0 || firstMap.worstMs <= 500)
      && (firstRoom.programsDelta === 0 || firstRoom.worstMs <= 500)
      && (firstRide.programsDelta === 0 || firstRide.worstMs <= 500)
      && (firstFlight.programsDelta === 0 || firstFlight.worstMs <= 500),
      { firstMap, firstRoom, firstRide, firstFlight });
    check('perfbudget: A16 instrumentation overhead stays within budget (avgMs delta <= 25 ms)',
      (overhead.avgMsOn - overhead.avgMsOff) <= 25,
      { ...overhead, sceneObjectsOff: a16OffLagos.sceneObjects, sceneObjectsOn: a16OnLagos.sceneObjects });
    check('perfbudget: A16 all 3 cities render valid frames within baseline draw/triangle/object budgets',
      a16OnLagos.fps > 0 && a16Abuja.fps > 0 && a16Ph.fps > 0
      && a16OnLagos.calls <= 600 && a16Abuja.calls <= 220 && a16Ph.calls <= 250
      && a16OnLagos.triangles <= 220000 && a16Abuja.triangles <= 230000 && a16Ph.triangles <= 250000
      && a16OnLagos.sceneObjects <= 13500 && a16Abuja.sceneObjects <= 16000 && a16Ph.sceneObjects <= 16000,
      {
        lagos: { fps: a16OnLagos.fps, calls: a16OnLagos.calls, tris: a16OnLagos.triangles, objs: a16OnLagos.sceneObjects },
        abuja: { fps: a16Abuja.fps, calls: a16Abuja.calls, tris: a16Abuja.triangles, objs: a16Abuja.sceneObjects },
        ph: { fps: a16Ph.fps, calls: a16Ph.calls, tris: a16Ph.triangles, objs: a16Ph.sceneObjects },
      });
    check('perfbudget: A16 no page errors during perf run', errors.length === 0, errors);
    await ctx.close();
  }

  // ------------------------------------------------------------------ 2. Desktop (1366x768) Baseline
  {
    const ctx = await newPlayer(browser);
    const { page, log } = await open(ctx, { w: 1366, h: 768, url: withQuery('perf=1') });
    await closeDialogs(page);
    await page.waitForFunction(() => {
      try { return JSON.parse(localStorage.getItem('nl_load_times_v1') || '[]').length > 0 && !window.game?.idleWarming; } catch { return false; }
    }, { timeout: 30000, polling: 300 }).catch(() => null);
    await wait(1000);
    const deskLoad = await page.evaluate(() => JSON.parse(localStorage.getItem('nl_load_times_v1') || '[]')[0] || null);
    const deskLagos = await sampleWindow(page, 3500);
    await page.evaluate(() => window.game.arriveInCity('abuja'));
    await wait(2500);
    const deskAbuja = await sampleWindow(page, 3500);
    await page.evaluate(() => window.game.arriveInCity('port_harcourt'));
    await wait(2500);
    const deskPh = await sampleWindow(page, 3500);

    console.log('[perfbudget] Desktop Load:', JSON.stringify(deskLoad));
    console.log('[perfbudget] Desktop Lagos:', JSON.stringify(deskLagos));
    console.log('[perfbudget] Desktop Abuja:', JSON.stringify(deskAbuja));
    console.log('[perfbudget] Desktop Port Harcourt:', JSON.stringify(deskPh));

    check('perfbudget: Desktop all 3 cities render smoothly (>= 10 fps) with no errors',
      deskLagos.fps >= 10 && deskAbuja.fps >= 10 && deskPh.fps >= 10 && log.errors.length === 0,
      { deskLagos: deskLagos.fps, deskAbuja: deskAbuja.fps, deskPh: deskPh.fps, errors: log.errors });
    await ctx.close();
  }
}
