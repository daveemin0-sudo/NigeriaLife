// Pavements are for people: a car driven slowly at the kerb does not get onto the pavement, on
// Broad Street, a side street, the expressway, in Abuja and in Port Harcourt. Every lane of every
// road stays drivable, the ways in made for vehicles (a forecourt, a motor park gate) still let a
// car in, and a car that is already on a pavement can always be driven off it, back to the road.
import { open, newPlayer, closeDialogs } from './lib.mjs';

/** Drives the car at a crawl (9 km/h, under the old kerb speed) on a fixed heading for some seconds; how far onto a pavement it got */
const crawl = (page, start, yaw, seconds = 4, speed = 2.5) => page.evaluate((start, yaw, seconds, speed) => {
  const g = window.game;
  const v = g.player.currentVehicle;
  v.mesh.position.set(start.x, 0, start.z);
  v.mesh.rotation.y = yaw;
  v.currentSpeed = 0;
  const kerbs = g.kerbsHere();
  let worst = 0;
  let frames = 0;
  let onPavement = 0;
  const reach = 1.6;
  for (let t = 0; t < seconds; t += 1 / 30) {
    v.currentSpeed = speed;
    v.mesh.rotation.y = yaw;
    g.step(1 / 30);
    frames += 1;
    const p = v.mesh.position;
    const fx = Math.sin(yaw) * reach;
    const fz = Math.cos(yaw) * reach;
    const pts = [[p.x, p.z], [p.x + fx, p.z + fz], [p.x - fx, p.z - fz]];
    const hits = pts.filter(([x, z]) => kerbs.at(x, z, 0)).length;
    if (hits) onPavement += 1;
    worst = Math.max(worst, hits);
  }
  const p = v.mesh.position;
  return { end: { x: +p.x.toFixed(2), z: +p.z.toFixed(2) }, moved: +Math.hypot(p.x - start.x, p.z - start.z).toFixed(2), framesOnPavement: onPavement, worstPoints: worst, frames, offRoad: +kerbs.offRoad(p.x, p.z).toFixed(2) };
}, start, yaw, seconds, speed);

/** A stretch of pavement in this city well clear of any way in, and a start on the road beside it, heading into it at 45 degrees */
const testSpot = (page, pick) => page.evaluate((pick) => {
  const g = window.game;
  const kerbs = g.kerbsHere();
  const D = g.player.currentVehicle.constructor;
  const near = (x, z, m) => kerbs.openings.some((o) => x > o.minX - m && x < o.maxX + m && z > o.minZ - m && z < o.maxZ + m);
  const cands = kerbs.pavements.filter((w) => {
    const len = Math.max(w.maxX - w.minX, w.maxZ - w.minZ);
    const thin = Math.min(w.maxX - w.minX, w.maxZ - w.minZ) < (pick.thinner ?? 99);
    return len > 30 && thin && (pick.zFrom === undefined || (w.minZ >= pick.zFrom && w.maxZ <= pick.zTo));
  });
  for (const w of cands) {
    const alongZ = w.maxZ - w.minZ > w.maxX - w.minX;
    const mid = alongZ ? (w.minZ + w.maxZ) / 2 : (w.minX + w.maxX) / 2;
    for (const side of [-1, 1]) {
      // The road is on one side of the pavement: try both
      const edge = alongZ ? (side < 0 ? w.minX : w.maxX) : (side < 0 ? w.minZ : w.maxZ);
      const sx = alongZ ? edge + side * 3 : mid;
      const sz = alongZ ? mid : edge + side * 3;
      if (!D.onRoad(sx, sz) || near(sx, sz, 14)) continue;
      // Heading back at the pavement (the opposite of `side`), 45 degrees along it
      const toward = -side;
      const yaw = alongZ ? Math.atan2(toward, 1) : Math.atan2(1, toward);
      return { start: { x: sx, z: sz }, yaw, pavement: w };
    }
  }
  return null;
}, pick);

/** In the city's sedan, at the wheel */
const intoTheSedan = (page) => page.evaluate(() => {
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

/** Every lane of every road of the city the game is in, sampled every 2 m: none on a pavement */
const lanes = (page) => page.evaluate(() => {
  const g = window.game;
  const kerbs = g.kerbsHere();
  const zones = g.modules.zonesFor(g.world.cityManager.currentCityId);
  const blocked = [];
  let samples = 0;
  for (const road of zones.filter((z) => z.kind === 'carriageway')) {
    const alongZ = road.axis === 'z';
    const mid = alongZ ? (road.minX + road.maxX) / 2 : (road.minZ + road.maxZ) / 2;
    const [a, b] = alongZ ? [road.minZ, road.maxZ] : [road.minX, road.maxX];
    for (const lane of road.lanes ?? [0]) {
      for (const s of [-1, 1]) {
        for (let t = a + 1; t < b - 1; t += 2) {
          const x = alongZ ? mid + s * lane : t;
          const z = alongZ ? t : mid + s * lane;
          samples += 1;
          if (kerbs.at(x, z, 0.5) && blocked.length < 6) blocked.push(`${road.id} ${x.toFixed(1)},${z.toFixed(1)}`);
        }
      }
    }
  }
  return { samples, blocked, pavements: kerbs.pavements.length, openings: kerbs.openings.length };
});

export async function run(browser, check) {
  const ctx = await newPlayer(browser);
  const { page, log } = await open(ctx);
  await closeDialogs(page);
  await page.evaluate(() => window.game.player.mesh.position.set(-4.9, 0, -100));
  await intoTheSedan(page);

  // 1. Every lane of every road in Lagos is clear of the pavements
  const lagosLanes = await lanes(page);
  check('kerbs: in Lagos (the island and the expressway) no lane of any road is on a pavement: every road can still be driven', lagosLanes.blocked.length === 0 && lagosLanes.samples > 3000 && lagosLanes.pavements > 40, lagosLanes);

  // 2. Broad Street, both sides: a car crawling at the pavement at 9 km/h stays off it
  const east = await crawl(page, { x: 3.5, z: -95 }, Math.PI / 4);
  const west = await crawl(page, { x: -3.5, z: -95 }, -Math.PI / 4);
  check('kerbs: on Broad Street a car crawling at the pavement (9 km/h, 45 degrees) is kept off it, on either side, and slides along the kerb instead', east.framesOnPavement === 0 && west.framesOnPavement === 0 && east.moved > 3 && west.moved > 3, { east, west });
  const straight = await crawl(page, { x: 3.5, z: -38 }, Math.PI / 2, 3);
  check('kerbs: driven square at the pavement, the car stops at the kerb (it does not climb it)', straight.framesOnPavement === 0 && straight.end.x < 7, straight);

  // 3. A side street of the island (a narrow pavement: Broad Street's are 6.5 m)
  const side = await testSpot(page, { zFrom: -130, zTo: 120, thinner: 3 });
  const sideRun = side ? await crawl(page, side.start, side.yaw) : null;
  check('kerbs: on a side street of the island too the car is kept off the pavement', !!sideRun && sideRun.framesOnPavement === 0 && sideRun.moved > 2, { side: side && { start: side.start, pavement: side.pavement }, sideRun });

  // 4. The expressway
  const express = await testSpot(page, { zFrom: 400, zTo: 1100 });
  const expressRun = express ? await crawl(page, express.start, express.yaw) : null;
  check('kerbs: on the expressway the car is kept off the pavement (lay-bys and the places that take cars stay open)', !!expressRun && expressRun.framesOnPavement === 0 && expressRun.moved > 2, { start: express?.start, expressRun });

  // 5. The ways in still let a car in: the NaijaPetro forecourt and Jibowu motor park's gate
  const forecourt = await crawl(page, { x: -5, z: 78.2 }, -Math.PI / 2, 5);
  check('kerbs: a car can still turn off Broad Street into the NaijaPetro forecourt, across the pavement at its mouth', forecourt.end.x < -15, forecourt);
  const park = await page.evaluate(() => { const p = window.game.world.motorParkOf('lagos'); return { gate: p.gate, leaves: p.leaves }; });
  const startAt = { x: park.gate.x + park.leaves.x * 7, z: park.gate.z + park.leaves.z * 7 };
  const intoPark = await crawl(page, startAt, Math.atan2(-park.leaves.x, -park.leaves.z), 6);
  const inBy = -((intoPark.end.x - park.gate.x) * park.leaves.x + (intoPark.end.z - park.gate.z) * park.leaves.z);
  check('kerbs: and through the gate of Jibowu motor park from Martins Street', inBy > 3, { park, startAt, intoPark, inBy: +inBy.toFixed(2) });

  // 6. Already on the pavement (an old save, a car set down there): it drives off toward the road, never further on
  const back = await crawl(page, { x: 10, z: -95 }, -Math.PI / 2, 3);
  const deeper = await crawl(page, { x: 10, z: -95 }, Math.PI / 2, 3);
  check('kerbs: a car standing on the pavement can always be driven off it, back to the road, but not further onto it', back.end.x < 7 && deeper.end.x <= 10.05, { back, deeper });

  // 7. Abuja and Port Harcourt
  for (const city of ['abuja', 'port_harcourt']) {
    await page.evaluate((city) => { const g = window.game; if (g.player.isDriving) g.exitVehicle(); g.arriveInCity(city); }, city);
    await page.evaluate(() => window.game.advance(0.5));
    await intoTheSedan(page);
    const cityLanes = await lanes(page);
    const spot = await testSpot(page, {});
    const cityRun = spot ? await crawl(page, spot.start, spot.yaw) : null;
    const name = city === 'abuja' ? 'Abuja' : 'Port Harcourt';
    check(`kerbs: in ${name} every lane is clear of the pavements, and a car crawling at a pavement is kept off it`, cityLanes.blocked.length === 0 && cityLanes.samples > 300 && !!cityRun && cityRun.framesOnPavement === 0 && cityRun.moved > 2, { cityLanes, start: spot?.start, cityRun });
  }
  check('kerbs: no errors in the page', log.errors.length === 0, log.errors.slice(0, 4));
  await ctx.close();
}
