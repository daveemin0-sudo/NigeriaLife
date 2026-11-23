// The world is solid: walls, furniture and street props stop the player and NPCs.
// For each place, walks into solids from 8 directions (no crossing) and checks every
// activity point and exit stays reachable from a clear standing spot.
//
// Honesty rules: checks must not pass when the solid is missing. Port containers and
// lay-by benches must exist, register in Solids, and stop the player. Every place with
// physical furniture must register solids (exceptions listed by name with a reason).
import { mkdirSync, writeFileSync } from 'node:fs';
import { open, newPlayer, closeDialogs, advance, wait, enterInterior, leaveInterior, makeOpen } from './lib.mjs';

const SHOTS = process.env.SHOTS || '/opt/cursor/artifacts';
mkdirSync(SHOTS, { recursive: true });
const shot = async (page, name) => {
  try { await page.screenshot({ path: `${SHOTS}/${name}` }); } catch { /* artifact store flake */ }
};

/**
 * Places that intentionally have no floor-standing furniture mass in their Builder footprints.
 * Every other PlaceSpec must register solids > 0 after ensureBuilt().
 */
const NO_FURNITURE_EXCEPTIONS = [
  // Keep empty until a real exception is proven; do not use this list to hide missing solids.
];

const DIRS = [
  [1, 0], [-1, 0], [0, 1], [0, -1],
  [0.707, 0.707], [0.707, -0.707], [-0.707, 0.707], [-0.707, -0.707],
];

/** Walk from a free stand into a solid centre along one direction; return whether the centre was crossed. */
async function probeSolid(page, solidLocal, standLocal, steps = 18) {
  return page.evaluate(({ solidLocal, standLocal, dirs, steps }) => {
    const g = window.game;
    const im = g.world.interiorManager;
    const origin = im.currentInterior.interiorOrigin;
    const nav = im.getActiveNav();
    const results = [];
    for (const [dx, dz] of dirs) {
      const sx = origin.x + standLocal.x;
      const sz = origin.z + standLocal.z;
      const tx = origin.x + solidLocal.x;
      const tz = origin.z + solidLocal.z;
      g.player.stopMoving();
      g.player.mesh.position.set(sx, 0, sz);
      g.player.position.copy(g.player.mesh.position);
      const len = Math.hypot(tx - sx, tz - sz) || 1;
      const vx = ((tx - sx) / len) * 0.22;
      const vz = ((tz - sz) / len) * 0.22;
      let crossed = false;
      let minDist = Infinity;
      for (let i = 0; i < steps; i++) {
        const from = g.player.mesh.position.clone();
        g.player.mesh.position.x += vx;
        g.player.mesh.position.z += vz;
        im.update(0.05, g.player);
        g.player.position.copy(g.player.mesh.position);
        const p = g.player.mesh.position;
        const dist = Math.hypot(p.x - tx, p.z - tz);
        if (dist < minDist) minDist = dist;
        if (dist < 0.25) crossed = true;
        if (Math.hypot(p.x - from.x, p.z - from.z) < 1e-4 && i > 2) break;
      }
      const inside = nav ? !nav.isFree(tx, tz) : true;
      results.push({ dx, dz, crossed, minDist: +minDist.toFixed(2), solidBlocked: inside });
    }
    return results;
  }, { solidLocal, standLocal, dirs: DIRS, steps });
}

/** Can the player stand at every activity / exit interaction point without being shoved into furniture? */
async function reachables(page) {
  return page.evaluate(() => {
    const g = window.game;
    const im = g.world.interiorManager;
    const nav = im.getActiveNav();
    const objs = im.getActiveInteractiveObjects();
    const bad = [];
    for (const o of objs) {
      const x = o.interactionPoint.x;
      const z = o.interactionPoint.z;
      g.player.stopMoving();
      g.player.mesh.position.set(x, 0, z);
      g.player.position.copy(g.player.mesh.position);
      im.update(0.05, g.player);
      const p = g.player.mesh.position;
      const pushed = Math.hypot(p.x - x, p.z - z);
      const free = nav ? nav.isFree(p.x, p.z) : true;
      if (pushed > 2.0 || !free) bad.push({ id: o.id, pushed: +pushed.toFixed(2), free });
    }
    return { total: objs.length, bad };
  });
}

/** Walk the player into a world-space solid centre using the real Player solids path; must not reach the centre. */
async function assertPlayerStopped(page, check, sample, label) {
  const result = await page.evaluate((s) => {
    const g = window.game;
    const solids = g.solidsHere();
    if (!solids) return { ok: false, reason: 'no-solids' };
    // Stand a few metres out on a free cell, then step toward the centre each frame
    let sx = s.x - 3.2;
    let sz = s.z;
    for (const [dx, dz] of [[-3.2, 0], [3.2, 0], [0, -3.2], [0, 3.2], [-2.4, -2.4], [2.4, 2.4]]) {
      if (!solids.at(s.x + dx, s.z + dz, 0.35)) {
        sx = s.x + dx;
        sz = s.z + dz;
        break;
      }
    }
    g.player.stopMoving();
    g.player.mesh.position.set(sx, 0, sz);
    g.player.position.copy(g.player.mesh.position);
    g.cameraManager.snapToPlayer?.(g.player);
    let minDist = Infinity;
    let stopped = false;
    for (let i = 0; i < 55; i++) {
      const from = { x: g.player.mesh.position.x, z: g.player.mesh.position.z };
      const dx = s.x - from.x;
      const dz = s.z - from.z;
      const d = Math.hypot(dx, dz) || 1;
      g.player.mesh.position.x += (dx / d) * 0.28;
      g.player.mesh.position.z += (dz / d) * 0.28;
      // Same keep-off path the game uses on foot
      g.player.update?.(1 / 30);
      g.player.position.copy(g.player.mesh.position);
      // Also drive solids.step directly if update did not run stayOnTheWay (headless / idle)
      const step = solids.step(from.x, from.z, g.player.mesh.position.x, g.player.mesh.position.z, 0.35);
      g.player.mesh.position.set(step.x, 0, step.z);
      g.player.position.copy(g.player.mesh.position);
      const dist = Math.hypot(g.player.mesh.position.x - s.x, g.player.mesh.position.z - s.z);
      if (dist < minDist) minDist = dist;
      if (step.stopped || Math.hypot(g.player.mesh.position.x - from.x, g.player.mesh.position.z - from.z) < 1e-4) {
        stopped = true;
        break;
      }
    }
    const finalDist = Math.hypot(g.player.mesh.position.x - s.x, g.player.mesh.position.z - s.z);
    return {
      ok: finalDist > 0.45 && (stopped || finalDist > 0.7),
      finalDist: +finalDist.toFixed(2),
      minDist: +minDist.toFixed(2),
      stopped,
      start: { x: +sx.toFixed(1), z: +sz.toFixed(1) },
      target: { x: s.x, z: s.z },
    };
  }, sample);
  check(`${label}: player is stopped by the solid (never reaches its centre)`, !!result.ok, result);
  return result;
}

export async function run(browser, check) {
  const ctx = await newPlayer(browser);
  const { page } = await open(ctx);
  await closeDialogs(page);

  // ---- Street: ensure expressway lay-bys exist, rebuild Solids, then prove containers + benches ----
  const street = await page.evaluate(() => {
    const g = window.game;
    // Build expressway chunks that carry lay-bys (z > 165), then invalidate Solids cache
    g.world.expressway.ensureChunksNear(220);
    g.world.expressway.ensureChunksNear(320);
    g.world.expressway.ensureChunksNear(420);
    g.solidsByCity?.clear?.();
    g.waysByCity?.clear?.();
    g.kerbsByCity?.clear?.();
    const solids = g.solidsHere();
    const samples = [
      { name: 'bank middle', x: 16, z: -22, expect: true },
      { name: 'broad pavement', x: 10, z: 0, expect: false },
    ];
    const portObs = (g.world.landmarks.obstructions?.() ?? []).filter((o) => /port|container|quay|crane|apapa/i.test(o.owner));
    let containerHit = false;
    let containerSample = null;
    for (const o of portObs) {
      if (o.height < 0.65) continue;
      const cx = (o.minX + o.maxX) / 2;
      const cz = (o.minZ + o.maxZ) / 2;
      // Prefer compact yard blocks (containers), not the whole quay slab
      const w = o.maxX - o.minX;
      const d = o.maxZ - o.minZ;
      if (Math.max(w, d) > 40) continue;
      if (solids.at(cx, cz, 0.2)) {
        containerHit = true;
        containerSample = { owner: o.owner, x: +cx.toFixed(1), z: +cz.toFixed(1), w: +w.toFixed(1), d: +d.toFixed(1), height: o.height };
        break;
      }
    }
    const benchObs = (g.world.expressway?.obstructions ?? []).filter((o) => /bench/i.test(o.owner));
    let benchHit = false;
    let benchSample = null;
    for (const o of benchObs) {
      const cx = (o.minX + o.maxX) / 2;
      const cz = (o.minZ + o.maxZ) / 2;
      if (solids.at(cx, cz, 0.15)) {
        benchHit = true;
        benchSample = { owner: o.owner, x: +cx.toFixed(1), z: +cz.toFixed(1) };
        break;
      }
    }
    return {
      count: solids.count,
      samples: samples.map((s) => ({ ...s, hit: solids.at(s.x, s.z, 0.3) })),
      containerHit,
      containerSample,
      benchHit,
      benchSample,
      benchObs: benchObs.length,
      portObs: portObs.length,
    };
  });
  check('street Solids grid is built', street.count > 100, street);
  for (const s of street.samples) {
    check(`street ${s.name}: solid=${s.expect}`, s.hit === s.expect, s);
  }
  // Honest: must find real footprints and they must register in Solids (no "|| count === 0" escape)
  check('port yard has container/occupy footprints', street.portObs > 0, { portObs: street.portObs });
  check('a port container / yard block is solid in the Solids grid', street.containerHit === true && !!street.containerSample, street);
  check('lay-by benches exist on the expressway', street.benchObs > 0, { benchObs: street.benchObs });
  check('a lay-by bench is solid in the Solids grid', street.benchHit === true && !!street.benchSample, street);

  if (street.containerSample) {
    await assertPlayerStopped(page, check, street.containerSample, 'port container');
    await page.evaluate((s) => {
      const g = window.game;
      g.cameraManager.setPreset?.('street');
      g.cameraManager.snapToPlayer?.(g.player);
    }, street.containerSample);
    await advance(page, 0.2);
    await shot(page, 'solidworld-port-container.png');
  }

  if (street.benchSample) {
    await assertPlayerStopped(page, check, street.benchSample, 'lay-by bench');
    await advance(page, 0.2);
    await shot(page, 'solidworld-layby-bench.png');
  }

  // Crowd steers around a stall: place player near a solid street prop, advance, assert walkers stay outside it
  const crowd = await page.evaluate(() => {
    const g = window.game;
    const solids = g.solidsHere();
    const standing = g.standingIn('lagos');
    let sample = null;
    for (const o of standing) {
      if (!/stall|kiosk|bench|pole|lamp|shade|post/i.test(o.owner || '')) continue;
      if (o.structure && Math.max(o.maxX - o.minX, o.maxZ - o.minZ) >= 4) continue;
      const cx = (o.minX + o.maxX) / 2;
      const cz = (o.minZ + o.maxZ) / 2;
      if (Math.abs(cx) < 7 || Math.abs(cx) > 20) continue;
      if (!solids?.at(cx, cz, 0.2)) continue;
      sample = { x: +cx.toFixed(1), z: +cz.toFixed(1), owner: o.owner };
      break;
    }
    if (!sample) {
      for (const o of g.world.expressway?.obstructions ?? []) {
        if (!/stall|shade|post|bench|kiosk/i.test(o.owner || '')) continue;
        const cx = (o.minX + o.maxX) / 2;
        const cz = (o.minZ + o.maxZ) / 2;
        if (!solids?.at(cx, cz, 0.15)) continue;
        sample = { x: +cx.toFixed(1), z: +cz.toFixed(1), owner: o.owner };
        break;
      }
    }
    if (!sample) return { ok: false, reason: 'no-stall-sample' };
    g.player.mesh.position.set(sample.x + 4, 0, sample.z);
    g.player.position.copy(g.player.mesh.position);
    g.world.cityPopulation.drawDistance = 90;
    let inside = 0;
    let near = 0;
    for (let f = 0; f < 90; f++) {
      g.advance(1 / 30);
      for (const a of g.world.cityPopulation.agents) {
        if (a.life?.state === 'home' || a.life?.state === 'in') continue;
        const d = Math.hypot(a.x - sample.x, a.z - sample.z);
        if (d >= 8) continue;
        near += 1;
        if (solids.at(a.x, a.z, 0.15)) inside += 1;
      }
    }
    return { ok: inside === 0 && near > 0, inside, nearFrames: near, sample };
  });
  check('crowd walkers stay outside a solid street prop (stall/bench/pole)', crowd.ok === true, crowd);
  if (crowd.sample) {
    await page.evaluate((s) => {
      const g = window.game;
      g.player.mesh.position.set(s.x + 3.5, 0, s.z);
      g.player.position.copy(g.player.mesh.position);
      g.cameraManager.snapToPlayer?.(g.player);
    }, crowd.sample);
    await advance(page, 0.5);
    await shot(page, 'solidworld-crowd-around-stall.png');
  }

  // ---- Places: build each, require solids unless named exception ----
  const placeReport = await page.evaluate(() => {
    const im = window.game.world.interiorManager;
    const out = [];
    for (const place of im.places) {
      place.ensureBuilt();
      out.push({ key: place.spec.key, name: place.spec.name, solids: place.solidCount, hasNav: !!place.nav });
    }
    return out;
  });
  check('every roadside place has a NavGrid after build', placeReport.every((p) => p.hasNav), placeReport.filter((p) => !p.hasNav));

  const exceptionKeys = new Set(NO_FURNITURE_EXCEPTIONS.map((e) => e.key));
  const expectedFurniture = placeReport.filter((p) => !exceptionKeys.has(p.key));
  const missingSolids = expectedFurniture.filter((p) => p.solids <= 0);
  check('every place with physical furniture registers solids (100%)', missingSolids.length === 0, {
    missing: missingSolids.map((p) => p.key),
    withSolids: expectedFurniture.filter((p) => p.solids > 0).length,
    totalExpected: expectedFurniture.length,
    exceptions: NO_FURNITURE_EXCEPTIONS,
  });
  if (NO_FURNITURE_EXCEPTIONS.length) {
    console.log('SOLID_EXCEPTIONS', JSON.stringify(NO_FURNITURE_EXCEPTIONS));
  }

  // Sampled places covering buka, hotel, worship, home-like, market
  const SAMPLE_KEYS = [
    'amala-shitta',
    'balogun-market',
    'eko-grand-hotel',
    'eko-grand-suite',
    'eko-grand-floor',
  ];
  for (const p of placeReport) {
    if (/cathedral|mosque/i.test(p.key) && !SAMPLE_KEYS.some((k) => /cathedral|mosque/i.test(k))) SAMPLE_KEYS.push(p.key);
    if (/town-suite$/i.test(p.key) && !SAMPLE_KEYS.some((k) => /town-suite$/i.test(k))) SAMPLE_KEYS.push(p.key);
  }

  const byKey = Object.fromEntries(placeReport.map((p) => [p.key, p]));
  for (const key of SAMPLE_KEYS) {
    if (!byKey[key]) continue;
    await makeOpen(page, key);
    const entered = await page.evaluate(async (k) => {
      const g = window.game;
      const place = g.world.interiorManager.places.find((p) => p.spec.key === k);
      if (!place) return false;
      place.ensureBuilt();
      return g.world.interiorManager.enterInterior(place.def.id, g.player, g.cameraManager, g.hud, g.world);
    }, key);
    await wait(900);
    if (!entered) {
      check(`${key}: enter`, false);
      continue;
    }

    const probe = await page.evaluate(() => {
      const g = window.game;
      const place = g.world.interiorManager.places.find((p) => p.def === g.world.interiorManager.currentInterior);
      const nav = g.world.interiorManager.getActiveNav();
      if (!nav || !place?.spec) return null;
      const { width, length } = place.spec.room;
      let solid = null;
      for (let z = -length / 2 + 1; z < length / 2 - 1 && !solid; z += 0.5) {
        for (let x = -width / 2 + 1; x < width / 2 - 1; x += 0.5) {
          const wx = place.group.position.x + x;
          const wz = place.group.position.z + z;
          if (!nav.isFree(wx, wz)) {
            solid = { x, z };
            break;
          }
        }
      }
      const stand = { x: 0, z: length / 2 - 1.8 };
      return { solid, stand, solids: place.solidCount };
    });

    if (probe?.solid) {
      const results = await probeSolid(page, probe.solid, probe.stand);
      const crossed = results.filter((r) => r.crossed);
      check(`${key}: walking into furniture from 8 dirs never crosses the solid`, crossed.length === 0, { solids: probe.solids, crossed, results });
    } else if (exceptionKeys.has(key)) {
      check(`${key}: listed as no-furniture exception`, true, probe);
    } else {
      check(`${key}: has a solid footprint to probe`, false, probe);
    }

    const reach = await reachables(page);
    check(`${key}: every activity point and exit stays reachable`, reach.bad.length === 0, reach);

    if (key === 'amala-shitta') {
      await page.evaluate(() => {
        const g = window.game;
        const o = g.world.interiorManager.currentInterior.interiorOrigin;
        g.player.mesh.position.set(o.x - 4.5, 0, o.z - 0.5);
        g.player.position.copy(g.player.mesh.position);
        g.cameraManager.snapToPlayer(g.player);
      });
      await advance(page, 0.2);
      await shot(page, 'solidworld-buka-bench.png');
    }
    if (key === 'eko-grand-suite') {
      await page.evaluate(() => {
        const g = window.game;
        const o = g.world.interiorManager.currentInterior.interiorOrigin;
        g.player.mesh.position.set(o.x + 1.2, 0, o.z - 2.5);
        g.player.position.copy(g.player.mesh.position);
        g.cameraManager.snapToPlayer(g.player);
      });
      await advance(page, 0.2);
      await shot(page, 'solidworld-hotel-furniture.png');
    }
    if (/town-suite$/i.test(key)) {
      await page.evaluate(() => {
        const g = window.game;
        const o = g.world.interiorManager.currentInterior.interiorOrigin;
        g.player.mesh.position.set(o.x, 0, o.z);
        g.player.position.copy(g.player.mesh.position);
        g.cameraManager.snapToPlayer(g.player);
      });
      await advance(page, 0.2);
      await shot(page, 'solidworld-home-table.png');
    }

    await leaveInterior(page);
  }

  // ---- Simulated interiors (hospital etc.) have nav ----
  for (const type of ['hospital', 'bank', 'police', 'university', 'airport', 'restaurant', 'residence']) {
    await makeOpen(page, type);
    await enterInterior(page, type);
    await wait(500);
    const info = await page.evaluate(() => {
      const nav = window.game.world.interiorManager.getActiveNav();
      return { hasNav: !!nav };
    });
    check(`${type}: has active NavGrid`, info.hasNav, info);
    const reach = await reachables(page);
    check(`${type}: activity points and exit reachable`, reach.bad.length === 0, reach);
    await leaveInterior(page);
  }

  // ---- Frame-cost sample (relative; software WebGL) ----
  const perf = await page.evaluate(async () => {
    const g = window.game;
    g.player.stopMoving();
    g.player.mesh.position.set(10, 0, 0);
    g.player.position.copy(g.player.mesh.position);
    const times = [];
    for (let i = 0; i < 40; i++) {
      const t0 = performance.now();
      await g.advance(1 / 30);
      times.push(performance.now() - t0);
    }
    const avg = times.reduce((s, d) => s + d, 0) / times.length;
    return { avgMs: +avg.toFixed(2), fps: +(1000 / (avg || 1)).toFixed(1), solids: g.solidsHere()?.count ?? 0, samples: times.length };
  });
  check('street frame sample completed', perf.avgMs > 0 && perf.samples >= 20, perf);

  const report = {
    places: placeReport,
    perf,
    street: { count: street.count, container: street.containerSample, bench: street.benchSample },
    exceptions: NO_FURNITURE_EXCEPTIONS,
    crowd,
  };
  console.log('SOLID_COUNTS', JSON.stringify(placeReport));
  console.log('PERF_SAMPLE', JSON.stringify(perf));
  console.log('STREET', JSON.stringify(report.street));
  console.log('CROWD', JSON.stringify(crowd));
  try { writeFileSync(`${SHOTS}/solidworld-report.json`, JSON.stringify(report, null, 2)); } catch { /* flake */ }
}
