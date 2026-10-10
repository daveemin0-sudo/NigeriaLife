// The city plan: roads stay clear, pavements can be walked end to end, buildings do not overlap,
// every door can be reached, and the validator really does catch each of those when it is broken.
import { open, newPlayer, closeDialogs } from './lib.mjs';

export async function run(browser, check) {
  const ctx = await newPlayer(browser);
  const { page, log } = await open(ctx);
  await closeDialogs(page);

  // ------------------------------------------------------------------ The city as built
  const city = await page.evaluate(() => {
    const w = window.game.world;
    const input = w.planInput();
    return {
      violations: w.validateCityPlan(),
      things: input.obstructions.length,
      buildings: input.obstructions.filter((t) => t.structure).length,
      roads: input.zones.filter((z) => z.kind === 'carriageway').length,
      walks: input.zones.filter((z) => z.kind === 'walkway').length,
      doors: input.doors.length,
      gaps: w.cityDensity.fabric.roadGaps,
    };
  });
  check('Lagos passes its own city plan: nothing on a road, every pavement walkable, no buildings overlapping, every door reachable',
    city.violations.length === 0, city.violations.slice(0, 6).map((v) => `${v.rule}: ${v.what} at (${v.at.x}, ${v.at.z})`));
  check('the plan covers the whole city: every street, every building, every door', city.roads === 5 && city.walks >= 12 && city.buildings > 150 && city.doors >= 8 && city.things > 400,
    { roads: city.roads, walks: city.walks, buildings: city.buildings, doors: city.doors, things: city.things });
  check('every side street was laid along its whole planned length', city.gaps.length === 0, city.gaps);

  // ------------------------------------------------------------------ The validator catches what it should
  const found = (extra) => page.evaluate((things) => window.game.world.validateCityPlan(things).map((v) => ({ rule: v.rule, what: v.what, detail: v.detail })), extra);
  const thing = (owner, minX, maxX, minZ, maxZ, structure = true, height = 9) => ({ owner, structure, height, minX, maxX, minZ, maxZ });

  let v = await found([thing('Test tower', -2, 4, 60, 66)]);
  check('a building put on Broad Street is reported as standing on the road', v.some((x) => x.rule === 'building-on-road' && x.what === 'Test tower'), v);

  v = await found([thing('Test kiosk', 7, 13.5, 0, 2, false, 2.2)]);
  check('a kiosk across the whole pavement is reported as blocking the walkway', v.some((x) => x.rule === 'walkway-blocked' && x.what.includes('Test kiosk')), v);

  // Nothing stands at z = 97 on the east pavement, so a stall there is judged on its own
  v = await found([thing('Test stall', 11.6, 13.4, 96, 98, false, 1.1)]);
  check('a stall against the buildings, leaving the pavement open, is allowed', v.length === 0, v);

  v = await found([thing('Test checkpoint', 3.4, 7, 100, 101.5, false, 1.2)]);
  const lane = v.length === 0;
  v = await found([thing('Test barricade', -7, 7, 100, 101.5, false, 1.2)]);
  check('a checkpoint that takes one lane is allowed; a barricade across the whole road is reported', lane && v.some((x) => x.rule === 'building-on-road' && x.what.includes('Test barricade')), { lane, v });

  v = await found([thing('Test annexe', 14, 20, -26, -18)]);
  check('a building standing inside another is reported as an overlap', v.some((x) => x.rule === 'buildings-overlap' && x.what.includes('Test annexe') && x.what.includes('Eko Commercial Bank')), v);

  v = await found([thing('Test wall', 5.5, 11.5, -25.5, -18.5)]);
  check('a door that has been walled in is reported as unreachable', v.some((x) => x.rule === 'door-unreachable' && x.what.includes('Eko Commercial Bank')), v.map((x) => `${x.rule}: ${x.what}`));

  // ------------------------------------------------------------------ Particular faults that were found and fixed
  const fixed = await page.evaluate(() => {
    const w = window.game.world;
    const things = w.standingOnTheGround();
    const road = { minX: -7, maxX: 7 };
    const onRoad = things.filter((t) => t.structure && t.maxX > road.minX + 0.5 && t.minX < road.maxX - 0.5 && t.minZ > -120 && t.maxZ < 120 && !t.owner.startsWith('Generated')).map((t) => t.owner);
    // A speed bump lies across the road, not along it
    let bump = null;
    w.roads.group.traverse((obj) => { if (obj.userData.surface && !bump) { obj.geometry.computeBoundingBox(); const b = obj.geometry.boundingBox.clone().applyMatrix4(obj.matrixWorld); bump = { across: +(b.max.x - b.min.x).toFixed(1), along: +(b.max.z - b.min.z).toFixed(1), high: +b.max.y.toFixed(2) }; } });
    const reg = window.game.modules.DestinationRegistry;
    return { onRoad, bump, reg: !!reg };
  });
  check('no hand-built landmark stands in the Broad Street carriageway (the CMS tower did)', fixed.onRoad.length === 0, fixed.onRoad);
  check('speed bumps lie across the road as low humps (they lay along the centre line)', fixed.bump && fixed.bump.across > 12 && fixed.bump.along < 3 && fixed.bump.high < 0.6, fixed.bump);

  // ------------------------------------------------------------------ Plots sit inside the plan
  const plots = await page.evaluate(() => {
    const g = window.game;
    const input = g.world.planInput();
    const hits = (a, b) => a.minX < b.maxX && a.maxX > b.minX && a.minZ < b.maxZ && a.maxZ > b.minZ;
    const list = g.land.plots();
    const problems = [];
    for (const plot of list) {
      const r = plot.rect;
      for (const zone of input.zones) if (hits(zone, r)) problems.push(`${plot.id} is on ${zone.street}`);
      for (const t of input.obstructions) if (t.structure && hits(t, r)) problems.push(`${plot.id} has ${t.owner} on it`);
      for (const other of list) if (other !== plot && hits(other.rect, r)) problems.push(`${plot.id} overlaps ${other.id}`);
      // Its frontage is beside a pavement of the street it is named for
      const grown = { minX: r.minX - 2.6, maxX: r.maxX + 2.6, minZ: r.minZ - 2.6, maxZ: r.maxZ + 2.6 };
      if (!input.zones.some((zone) => zone.kind === 'walkway' && zone.street === plot.street && hits(zone, grown))) problems.push(`${plot.id} does not front ${plot.street}`);
    }
    return { count: list.length, ids: new Set(list.map((p) => p.id)).size, problems };
  });
  check('every plot of land is clear of roads, pavements, buildings and other plots, and fronts the street it is named for',
    plots.count === 16 && plots.ids === 16 && plots.problems.length === 0, plots.problems.slice(0, 6));

  check('plan: no console errors', log.errors.length === 0, log.errors.slice(0, 6));
  await ctx.close();
}
