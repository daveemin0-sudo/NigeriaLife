// Where a car is meant to go, it can: between residential streets and the main roads, into and out
// of Banana Island's estate, out of a built compound's gate, into the forecourts, the motor park and
// the roads to the great places, in Lagos, Abuja and Port Harcourt. And the pavements beside those
// ways in still stop a car. (A16, 12 Nov 2026: the pavement of Martins Street stood across the mouth
// of Banana Island Road, and Banana Island Road's across the estate avenue.)
import { open, newPlayer, closeDialogs } from './lib.mjs';

/** Steers the car through way points (4 m/s, 14 km/h, unless told: a driveway is turned into at 9 km/h); where it got to */
const drive = (page, route, speed = 4, seconds = 150) => page.evaluate((route, speed, seconds) => {
  const g = window.game;
  const v = g.player.currentVehicle;
  const kerbs = g.kerbsHere();
  v.mesh.position.set(route[0][0], 0, route[0][1]);
  v.mesh.rotation.y = Math.atan2(route[1][0] - route[0][0], route[1][1] - route[0][1]);
  v.currentSpeed = 0;
  let k = 1;
  let stuck = 0;
  let onPavement = 0;
  for (let t = 0; t < seconds && k < route.length; t += 1 / 30) {
    const p = v.mesh.position;
    const [tx, tz] = route[k];
    if (Math.hypot(tx - p.x, tz - p.z) < 1.5) { k++; continue; }
    // Turned toward the next point no faster than a car turns at a crawl
    const want = Math.atan2(tx - p.x, tz - p.z);
    let d = want - v.mesh.rotation.y;
    d = Math.atan2(Math.sin(d), Math.cos(d));
    v.mesh.rotation.y += Math.max(-0.08, Math.min(0.08, d));
    v.currentSpeed = Math.abs(d) > 0.6 ? 1.5 : speed;
    const before = p.clone();
    g.step(1 / 30);
    if (kerbs.at(p.x, p.z, 0)) onPavement++;
    stuck = p.distanceTo(before) < 0.005 ? stuck + 1 : 0;
    if (stuck > 60) break;
  }
  const p = v.mesh.position;
  return { through: k >= route.length, wayPoint: k, of: route.length, end: [+p.x.toFixed(1), +p.z.toFixed(1)], framesOnPavement: onPavement };
}, route, speed, seconds);

/** Drives slowly straight at a pavement: how far onto it the car got */
const intoPavement = (page, start, yaw, seconds = 4) => page.evaluate((start, yaw, seconds) => {
  const g = window.game;
  const v = g.player.currentVehicle;
  const kerbs = g.kerbsHere();
  v.mesh.position.set(start[0], 0, start[1]);
  v.mesh.rotation.y = yaw;
  let worst = 0;
  for (let t = 0; t < seconds; t += 1 / 30) {
    v.currentSpeed = 2.5;
    v.mesh.rotation.y = yaw;
    g.step(1 / 30);
    const p = v.mesh.position;
    const pts = [0, 1.6, -1.6].map((r) => [p.x + Math.sin(yaw) * r, p.z + Math.cos(yaw) * r]);
    worst = Math.max(worst, pts.filter(([x, z]) => kerbs.at(x, z, 0)).length);
  }
  const p = v.mesh.position;
  return { end: [+p.x.toFixed(1), +p.z.toFixed(1)], worstPointsOnPavement: worst };
}, start, yaw, seconds);

/** At the wheel of the city's sedan, other traffic and people out of the way */
const atTheWheel = (page) => page.evaluate(() => {
  const g = window.game;
  const v = g.world.vehicles.drivableVehicles.find((c) => c.id === 'veh-sedan');
  v.constructor.ignoreBodies = true;
  g.checkpointPassAt = Date.now() + 3_600_000;
  if (g.player.isDriving) g.exitVehicle();
  v.city = g.world.cityManager.currentCityId;
  v.mesh.position.copy(g.player.position);
  g.enterVehicle(v);
  return !!g.player.isDriving;
});

/**
 * From the city's main road, over the roads and the ways in made for vehicles only (not across open
 * ground), as the car feels the pavement (nose, middle and tail, never further onto it) and the
 * solids: which of the places a car is meant to reach can it reach?
 */
const reach = (page) => page.evaluate(() => {
  const g = window.game;
  const city = g.world.cityManager.currentCityId;
  const kerbs = g.kerbsHere();
  const solids = g.solidsHere();
  const D = g.player.currentVehicle.constructor;
  const roads = D.roads().filter((z) => z.kind === 'carriageway' && z.maxZ <= 400);
  const B = { minX: Infinity, maxX: -Infinity, minZ: Infinity, maxZ: -Infinity };
  for (const r of roads) { B.minX = Math.min(B.minX, r.minX - 20); B.maxX = Math.max(B.maxX, r.maxX + 20); B.minZ = Math.min(B.minZ, r.minZ - 20); B.maxZ = Math.max(B.maxZ, r.maxZ + 20); }
  const seedRoad = roads.reduce((a, r) => (Math.max(r.maxX - r.minX, r.maxZ - r.minZ) > Math.max(a.maxX - a.minX, a.maxZ - a.minZ) ? r : a));
  const W = Math.ceil(B.maxX - B.minX);
  const H = Math.ceil(B.maxZ - B.minZ);
  const cx = (i) => B.minX + i + 0.5;
  const cz = (j) => B.minZ + j + 0.5;
  const inWay = (x, z) => kerbs.openings.some((o) => x >= o.minX && x <= o.maxX && z >= o.minZ && z <= o.maxZ);
  const blocked = new Uint8Array(W * H);
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) blocked[j * W + i] = solids.at(cx(i), cz(j), 0.95) || !(D.onRoad(cx(i), cz(j)) || inWay(cx(i), cz(j))) ? 1 : 0;
  const W2 = 2 * W;
  const H2 = 2 * H;
  const kerb = new Uint8Array(W2 * H2);
  for (let j = 0; j < H2; j++) for (let i = 0; i < W2; i++) kerb[j * W2 + i] = kerbs.at(B.minX + (i + 0.5) / 2, B.minZ + (j + 0.5) / 2, 0.33) ? 1 : 0;
  const kAt = (x, z) => { const i = Math.floor((x - B.minX) * 2); const j = Math.floor((z - B.minZ) * 2); return i >= 0 && j >= 0 && i < W2 && j < H2 ? kerb[j * W2 + i] : 0; };
  const points = (x, z, di, dj) => kAt(x, z) + kAt(x + di * 1.6, z + dj * 1.6) + kAt(x - di * 1.6, z - dj * 1.6);
  const seen = new Uint8Array(W * H);
  const q = [];
  for (let x = Math.max(seedRoad.minX, B.minX) + 0.5; x < Math.min(seedRoad.maxX, B.maxX); x += 1) for (let z = Math.max(seedRoad.minZ, B.minZ) + 0.5; z < Math.min(seedRoad.maxZ, B.maxZ); z += 1) {
    const k = Math.floor(z - B.minZ) * W + Math.floor(x - B.minX);
    if (!seen[k] && !blocked[k]) { seen[k] = 1; q.push(k); }
  }
  while (q.length) {
    const k = q.pop();
    const i = k % W;
    const j = (k - i) / W;
    for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const ni = i + di;
      const nj = j + dj;
      if (ni < 0 || nj < 0 || ni >= W || nj >= H) continue;
      const n = nj * W + ni;
      if (seen[n] || blocked[n] || points(cx(ni), cz(nj), di, dj) > points(cx(i), cz(j), di, dj)) continue;
      seen[n] = 1;
      q.push(n);
    }
  }
  const near = (x, z, m = 2) => {
    for (let dz = -m; dz <= m; dz++) for (let dx = -m; dx <= m; dx++) {
      const i = Math.floor(x + dx - B.minX);
      const j = Math.floor(z + dz - B.minZ);
      if (i >= 0 && j >= 0 && i < W && j < H && seen[j * W + i]) return true;
    }
    return false;
  };
  const targets = [];
  for (const r of roads) {
    const mx = (r.minX + r.maxX) / 2;
    const mz = (r.minZ + r.maxZ) / 2;
    const pts = r.axis === 'z' ? [[mx, r.minZ + 2], [mx, mz], [mx, r.maxZ - 2]] : [[r.minX + 2, mz], [mx, mz], [r.maxX - 2, mz]];
    pts.forEach(([x, z], n) => targets.push({ kind: 'road', name: `${r.street} (${['one end', 'middle', 'other end'][n]})`, x, z }));
  }
  for (const plot of g.land.plots(city)) {
    const r = plot.rect;
    const fr = plot.frontage;
    const gate = g.plotWorld.compounds.get(plot.id)?.drawing.centre;
    const gx = gate ? gate.x : fr === 'east' ? r.maxX : fr === 'west' ? r.minX : (r.minX + r.maxX) / 2;
    const gz = gate ? gate.z : fr === 'north' ? r.minZ : fr === 'south' ? r.maxZ : (r.minZ + r.maxZ) / 2;
    const ix = fr === 'east' ? -1.5 : fr === 'west' ? 1.5 : 0;
    const iz = fr === 'south' ? -1.5 : fr === 'north' ? 1.5 : 0;
    targets.push({ kind: 'plot gate', name: plot.name, x: gx + ix, z: gz + iz });
  }
  const park = g.world.motorParkOf(city);
  if (park) targets.push({ kind: 'motor park', name: 'the motor park gate', x: park.gate.x - park.leaves.x * 1.5, z: park.gate.z - park.leaves.z * 1.5 });
  if (city === 'lagos') {
    const E = { minZ: -150, cols: 11, pitch: 20 };
    g.world.estate.houses.forEach((h, n) => {
      const lane = E.minZ + 4 + Math.floor(n / E.cols) * E.pitch;
      targets.push({ kind: 'estate house', name: h.address, x: h.x - 1.5, z: lane + 2 });
    });
    targets.push({ kind: 'forecourt', name: 'NaijaPetro, Broad Street', x: -15, z: 78.2 });
    targets.push({ kind: 'forecourt', name: "God's Grace Auto Works", x: -15, z: 109 });
  }
  const missed = targets.filter((t) => !near(t.x, t.z)).map((t) => `${t.kind}: ${t.name} (${t.x.toFixed(1)}, ${t.z.toFixed(1)})`);
  const kinds = {};
  for (const t of targets) kinds[t.kind] = (kinds[t.kind] ?? 0) + 1;
  return { city, from: seedRoad.street, targets: targets.length, kinds, missed };
});

export async function run(browser, check) {
  const ctx = await newPlayer(browser);
  const { page, log } = await open(ctx);
  await closeDialogs(page);
  await page.evaluate(() => window.game.player.mesh.position.set(112, 0, -20));
  await atTheWheel(page);

  // 1. The A16 report: Banana Island Road and Martins Street, both ways
  const out = await drive(page, [[112, 0], [112, -45], [112, -62], [92, -62]]);
  const back = await drive(page, [[92, -62.5], [108, -62], [112, -52], [112, 0]]);
  check('access: from Banana Island Road a car drives out onto Martins Street, and back in (the pavement no longer stands across the mouth)',
    out.through && back.through && out.framesOnPavement === 0 && back.framesOnPavement === 0, { out, back });

  // 2. Into Banana Island's estate and out again: the avenue, a close, a house's gate
  const inEstate = await drive(page, [[112, -10], [112, 10], [140, 10], [166, 10], [166, -66], [230, -66], [233.3, -64.5]]);
  const outEstate = await drive(page, [[233.3, -64.5], [230, -66], [166, -66], [166, 10], [140, 10], [112, 8], [112, -45], [112, -62], [92, -62]]);
  check('access: a car drives from Banana Island Road along the estate avenue to a house in a close, and from there out to Martins Street',
    inEstate.through && outEstate.through && inEstate.framesOnPavement === 0 && outEstate.framesOnPavement === 0, { inEstate, outEstate });

  // 3. A house built at 1 Banana Island Road and at 2 Banana Island Road: out of the compound, through the gate, to Martins Street
  const built = await page.evaluate(async () => {
    const g = window.game;
    const b = g.hud.backend;
    b.data.bank.balance = 20_000_000_000;
    b.saveData();
    const out = {};
    for (const [plotId, x, z, turns] of [['lag-banana-w1', 92, -36, 3], ['lag-banana-e1', 137, -32, 1]]) {
      const buy = await g.land.buyFromState(plotId);
      let build = await g.land.startBuilding(plotId, 'duplex', x, z, turns);
      if (!build.ok && build.levy) { await g.land.payLevy?.(plotId); build = await g.land.startBuilding(plotId, 'duplex', x, z, turns); }
      await g.registry.transact((state) => { const bld = state.buildings[plotId]; if (bld) bld.startedAt = Date.now() - 360000000; return { ok: true }; });
      out[plotId] = { buy: buy.ok ?? buy, build: build.ok ? true : build.reason };
    }
    g.plotWorld.refresh();
    for (const plotId of ['lag-banana-w1', 'lag-banana-e1']) g.plotWorld.openGate(plotId);
    for (let i = 0; i < 90; i++) g.step(1 / 30);
    const shape = (plotId) => {
      const c = g.plotWorld.compounds.get(plotId);
      if (!c) return null;
      return { gate: [c.drawing.centre.x, c.drawing.centre.z], bay: c.drawing.parkingBays[0] ? [c.drawing.parkingBays[0].x, c.drawing.parkingBays[0].z] : null, open: c.progress };
    };
    return { out, w1: shape('lag-banana-w1'), e1: shape('lag-banana-e1') };
  });
  const fromCompound = async (c, toward) => {
    if (!c?.bay) return null;
    const [gx, gz] = c.gate;
    return drive(page, [c.bay, [gx - toward * 3, gz], [gx + toward * 3, gz], [112, gz], [112, -45], [112, -62], [92, -62]], 2.5);
  };
  const w1 = await fromCompound(built.w1, 1);
  const e1 = await fromCompound(built.e1, -1);
  check('access: from a house built at 1 Banana Island Road, and one across the road at No. 2, a car drives out of the yard, through the gate and across the pavement, to Martins Street',
    !!w1?.through && !!e1?.through, { built, w1, e1 });

  // 4. The ways to the great places and the T-junctions of the quiet streets, at 14 km/h: a junction is road, not a driveway
  const routes = {
    'Wharf Road, from Broad Street to its gate': [[-3.5, 40], [-3.5, 48], [-20, 48], [-43, 48]],
    'Stadium Road, from Broad Street to its gate': [[-3.5, 0], [-3.5, 5], [-20, 5], [-41, 5]],
    'Airport Road, from Martins Street to its gate': [[-60, -61], [-80, -62], [-80, -88]],
    'Odunlami Street, into Nnamdi Azikiwe Street': [[-46, -100], [-46, -124], [-30, -124]],
    'Kakawa Street, into Nnamdi Azikiwe Street': [[44, -100], [44, -124], [60, -124]],
  };
  const ways = {};
  for (const [name, route] of Object.entries(routes)) ways[name] = await drive(page, route);
  check('access: the roads to the wharf, the stadium and the airport are driven in from the street they leave, and Odunlami and Kakawa Streets turn into Nnamdi Azikiwe Street',
    Object.values(ways).every((r) => r.through), ways);

  // 5. Forecourts and the motor park: in and back out
  const petrolIn = await drive(page, [[-3.5, 70], [-6, 78.2], [-20, 78.2]], 2.5);
  const petrolOut = await drive(page, [[-20, 78.2], [-6, 78.2], [-3.5, 90]], 2.5);
  const mechanic = await drive(page, [[-3.5, 100], [-6, 109], [-18, 109], [-6, 109], [-3.5, 118]], 2.5);
  const park = await page.evaluate(() => { const p = window.game.world.motorParkOf('lagos'); return { gate: p.gate, leaves: p.leaves }; });
  const outside = [park.gate.x + park.leaves.x * 8, park.gate.z + park.leaves.z * 8];
  const inside = [park.gate.x - park.leaves.x * 6, park.gate.z - park.leaves.z * 6];
  const parkRun = await drive(page, [outside, [park.gate.x, park.gate.z], inside, [park.gate.x, park.gate.z], outside], 2.5);
  check('access: a car drives onto the NaijaPetro forecourt and off it, into God\'s Grace Auto Works and out, and in and out of Jibowu motor park\'s gate',
    petrolIn.through && petrolOut.through && mechanic.through && parkRun.through, { petrolIn, petrolOut, mechanic, park, parkRun });

  // 6. A street car left half up on the pavement drives off it to the road
  const offKerb = await page.evaluate(() => {
    const g = window.game;
    return g.world.vehicles.drivableVehicles.filter((v) => v.city === 'lagos' && g.kerbsHere().at(v.mesh.position.x, v.mesh.position.z, 0)).map((v) => ({ id: v.id, at: [v.mesh.position.x, v.mesh.position.z] }));
  });
  const offRuns = [];
  for (const car of offKerb.slice(0, 4)) {
    const toRoad = car.at[0] > 0 ? -1 : 1;
    offRuns.push({ id: car.id, run: await drive(page, [car.at, [car.at[0] + toRoad * 6, car.at[1] + 6], [car.at[0] + toRoad * 7, car.at[1] + 20]]) });
  }
  check('access: a car parked half up on the pavement is driven off it, back onto the road', offRuns.every((r) => r.run.through), { offKerb, offRuns });

  // 7. The pavements beside those ways in still stop a car: Martins Street's either side of Banana Island Road's mouth, Banana Island Road's own
  const besideMouth = await intoPavement(page, [100, -61], 0);
  const roadOwn = await intoPavement(page, [110.5, -20], -Math.PI / 2);
  const eastOwn = await intoPavement(page, [113.5, -30], Math.PI / 2);
  // Nose already on the pavement, middle still on the road: it cannot creep further on
  const creep = await page.evaluate(() => {
    const g = window.game;
    const v = g.player.currentVehicle;
    v.mesh.position.set(100, 0, -58.9);
    v.mesh.rotation.y = 0;
    const z0 = v.mesh.position.z;
    for (let t = 0; t < 3; t += 1 / 30) { v.currentSpeed = 2; v.mesh.rotation.y = 0; g.step(1 / 30); }
    return { from: z0, to: +v.mesh.position.z.toFixed(2) };
  });
  check('access: the pavements beside a way in still stop a car (Martins Street beside the mouth of Banana Island Road, Banana Island Road\'s own pavements)',
    besideMouth.worstPointsOnPavement === 0 && roadOwn.worstPointsOnPavement === 0 && eastOwn.worstPointsOnPavement === 0 && creep.to <= creep.from + 0.05, { besideMouth, roadOwn, eastOwn, creep });

  // 8. Everywhere a car is meant to go, in every city: every road, every plot's gate, every estate house, the forecourts, the motor park
  const lagos = await reach(page);
  check(`access: in Lagos every road, every plot's gate, every house of the estate, the forecourts and the motor park are reached by car from ${lagos.from} (${lagos.targets} places)`,
    lagos.missed.length === 0 && lagos.targets > 250, lagos);
  for (const city of ['abuja', 'port_harcourt']) {
    await page.evaluate((city) => { const g = window.game; if (g.player.isDriving) g.exitVehicle(); g.arriveInCity(city); }, city);
    await page.evaluate(() => window.game.advance(0.5));
    await atTheWheel(page);
    const there = await reach(page);
    check(`access: in ${city === 'abuja' ? 'Abuja' : 'Port Harcourt'} every road, every plot's gate and the motor park are reached by car from ${there.from} (${there.targets} places)`,
      there.missed.length === 0 && there.targets > 20, there);
  }
  check('access: no errors in the page', log.errors.length === 0, log.errors.slice(0, 4));
  await ctx.close();
}
