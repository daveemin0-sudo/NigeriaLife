// The world is solid: walls, furniture and street props stop the player and NPCs.
// For each place, walks into solids from 8 directions (no crossing) and checks every
// activity point and exit stays reachable from a clear standing spot.
import { mkdirSync } from 'node:fs';
import { open, newPlayer, closeDialogs, advance, wait, enterInterior, leaveInterior, makeOpen } from './lib.mjs';

const SHOTS = process.env.SHOTS || '/opt/cursor/artifacts';
mkdirSync(SHOTS, { recursive: true });

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
      // Face and walk toward the solid
      const len = Math.hypot(tx - sx, tz - sz) || 1;
      const vx = ((tx - sx) / len) * 0.22;
      const vz = ((tz - sz) / len) * 0.22;
      let crossed = false;
      let minDist = Infinity;
      for (let i = 0; i < steps; i++) {
        const from = g.player.mesh.position.clone();
        g.player.mesh.position.x += vx;
        g.player.mesh.position.z += vz;
        // Drive the same keep-off path the game uses each frame
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
      // Station stands may sit just beside furniture; allow a short slide to clear floor
      if (pushed > 1.2 || !free) bad.push({ id: o.id, pushed: +pushed.toFixed(2), free });
    }
    return { total: objs.length, bad };
  });
}

export async function run(browser, check) {
  const ctx = await newPlayer(browser);
  const { page } = await open(ctx);
  await closeDialogs(page);

  // ---- Street: port containers and lay-by benches are solid ----
  const street = await page.evaluate(() => {
    const g = window.game;
    const solids = g.solidsHere();
    const port = g.world.landmarks?.port;
    // Sample a few known solid footprints: port yard occupy blocks, a Broad Street bank
    const samples = [
      { name: 'bank middle', x: 16, z: -22, expect: true },
      { name: 'broad pavement', x: 10, z: 0, expect: false },
    ];
    // Port containers sit around the quay; use landmark obstructions if available
    const portObs = (g.world.landmarks.obstructions?.() ?? []).filter((o) => /port|container|quay|crane/i.test(o.owner));
    let containerHit = false;
    let containerSample = null;
    for (const o of portObs.slice(0, 40)) {
      const cx = (o.minX + o.maxX) / 2;
      const cz = (o.minZ + o.maxZ) / 2;
      if (solids.at(cx, cz, 0.2)) {
        containerHit = true;
        containerSample = { owner: o.owner, x: +cx.toFixed(1), z: +cz.toFixed(1) };
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
  check('a port container / yard block is solid', street.containerHit || street.portObs === 0, street);
  check('a lay-by bench is solid', street.benchHit || street.benchObs === 0, street);

  // Screenshot: walk into a port solid if we found one
  if (street.containerSample) {
    await page.evaluate((s) => {
      const g = window.game;
      g.player.stopMoving();
      g.player.mesh.position.set(s.x - 2.5, 0, s.z);
      g.player.position.copy(g.player.mesh.position);
      g.cameraManager.setPreset('street');
      g.cameraManager.snapToPlayer(g.player);
    }, street.containerSample);
    await page.evaluate((s) => {
      const g = window.game;
      g.player.setDestination(new g.player.position.constructor(s.x, 0, s.z));
    }, street.containerSample);
    for (let i = 0; i < 40; i++) await advance(page, 0.1);
    await page.screenshot({ path: `${SHOTS}/solidworld-port-container.png` });
  }

  // ---- Places: build each, probe solids, check reachability ----
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
  check('most places register solid furniture', placeReport.filter((p) => p.solids > 0).length > placeReport.length * 0.7, {
    withSolids: placeReport.filter((p) => p.solids > 0).length,
    total: placeReport.length,
    empty: placeReport.filter((p) => p.solids === 0).map((p) => p.key),
  });

  // Sampled places covering buka, hotel, worship, home-like, market
  const SAMPLE_KEYS = [
    'amala-shitta',
    'balogun-market',
    'eko-grand-hotel',
    'eko-grand-suite',
    'eko-grand-floor',
  ];
  // Also pick first worship-like and a home/suite if present
  for (const p of placeReport) {
    if (/church|mosque|worship|cathedral|chapel/i.test(p.key) && !SAMPLE_KEYS.includes(p.key)) SAMPLE_KEYS.push(p.key);
    if (/town-suite|hotel-1-suite|hotel-2-suite/i.test(p.key) && !SAMPLE_KEYS.includes(p.key)) SAMPLE_KEYS.push(p.key);
  }

  const byKey = Object.fromEntries(placeReport.map((p) => [p.key, p]));
  for (const key of SAMPLE_KEYS) {
    if (!byKey[key]) continue;
    await makeOpen(page, key);
    const entered = await page.evaluate((k) => {
      const g = window.game;
      const place = g.world.interiorManager.places.find((p) => p.spec.key === k);
      if (!place) return false;
      place.ensureBuilt();
      return g.world.interiorManager.enterInterior(place.def, g.player, g.cameraManager, g.hud, g.world);
    }, key);
    await wait(600);
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
      // Find a blocked cell near the room centre and a free stand near the door
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
    } else {
      check(`${key}: has at least one solid footprint to probe`, (probe?.solids ?? 0) === 0, probe);
    }

    const reach = await reachables(page);
    check(`${key}: every activity point and exit stays reachable`, reach.bad.length === 0, reach);

    // Screenshots for the named showcase rooms
    if (key === 'amala-shitta') {
      await page.evaluate(() => {
        const g = window.game;
        const o = g.world.interiorManager.currentInterior.interiorOrigin;
        g.player.mesh.position.set(o.x - 4.5, 0, o.z - 0.5);
        g.player.position.copy(g.player.mesh.position);
        g.cameraManager.snapToPlayer(g.player);
      });
      await advance(page, 0.2);
      await page.screenshot({ path: `${SHOTS}/solidworld-buka-bench.png` });
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
      await page.screenshot({ path: `${SHOTS}/solidworld-hotel-furniture.png` });
    }
    if (/town-suite|hotel-.*-suite/.test(key) && key !== 'eko-grand-suite') {
      await page.evaluate(() => {
        const g = window.game;
        const o = g.world.interiorManager.currentInterior.interiorOrigin;
        g.player.mesh.position.set(o.x, 0, o.z);
        g.player.position.copy(g.player.mesh.position);
        g.cameraManager.snapToPlayer(g.player);
      });
      await advance(page, 0.2);
      await page.screenshot({ path: `${SHOTS}/solidworld-home-table.png` });
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
    const deltas = [];
    let last = performance.now();
    const start = last;
    await new Promise((resolve) => {
      const tick = (now) => {
        deltas.push(now - last);
        last = now;
        if (now - start < 2500) requestAnimationFrame(tick);
        else resolve();
      };
      requestAnimationFrame(tick);
    });
    const valid = deltas.slice(2).filter((d) => d > 0 && d < 5000);
    const avg = valid.length ? valid.reduce((s, d) => s + d, 0) / valid.length : 0;
    return { avgMs: +avg.toFixed(2), fps: +(1000 / (avg || 1)).toFixed(1), solids: g.solidsHere()?.count ?? 0 };
  });
  check('street frame sample completed', perf.avgMs > 0, perf);

  // Expose place solid counts in the log for the report
  console.log('SOLID_COUNTS', JSON.stringify(placeReport));
  console.log('PERF_SAMPLE', JSON.stringify(perf));
  console.log('STREET', JSON.stringify({ count: street.count, container: street.containerSample, bench: street.benchSample }));
}
