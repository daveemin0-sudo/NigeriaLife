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
  check('the plan covers the whole city: every street, every building, every door', city.roads === 6 && city.walks >= 14 && city.buildings > 150 && city.doors >= 8 && city.things > 400,
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
    // The other cities are built the first time someone goes there
    g.world.cityManager.initAbuja();
    g.world.cityManager.initPortHarcourt();
    const hits = (a, b) => a.minX < b.maxX && a.maxX > b.minX && a.minZ < b.maxZ && a.maxZ > b.minZ;
    const list = g.land.plots();
    const problems = [];
    const cities = {};
    for (const city of ['lagos', 'abuja', 'port_harcourt']) {
      const zones = g.modules.zonesFor(city);
      const things = g.standingIn(city);
      const inCity = list.filter((p) => p.city === city);
      cities[city] = { plots: inCity.length, buildings: things.filter((t) => t.structure).length };
      for (const plot of inCity) {
        const r = plot.rect;
        for (const zone of zones) if (hits(zone, r)) problems.push(`${plot.id} is on ${zone.street}`);
        for (const t of things) if (t.structure && hits(t, r)) problems.push(`${plot.id} has ${t.owner} on it`);
        for (const other of inCity) if (other !== plot && hits(other.rect, r)) problems.push(`${plot.id} overlaps ${other.id}`);
        // Its frontage is beside a pavement of the street it is named for
        const grown = { minX: r.minX - 2.6, maxX: r.maxX + 2.6, minZ: r.minZ - 2.6, maxZ: r.maxZ + 2.6 };
        if (!zones.some((zone) => zone.kind === 'walkway' && zone.street === plot.street && hits(zone, grown))) problems.push(`${plot.id} does not front ${plot.street}`);
      }
    }
    return { count: list.length, ids: new Set(list.map((p) => p.id)).size, problems, cities, banana: g.land.plot('lag-banana-e1').neighbourhood };
  });
  check('every plot of land, in all three cities, is clear of roads, pavements, buildings and other plots, and fronts the street it is named for',
    plots.count === 29 && plots.ids === 29 && plots.problems.length === 0 && plots.cities.lagos.plots === 20 && plots.cities.abuja.plots === 5 && plots.cities.port_harcourt.plots === 4
      && plots.cities.abuja.buildings >= 3 && plots.cities.port_harcourt.buildings >= 1, { problems: plots.problems.slice(0, 6), cities: plots.cities });
  check('Banana Island is a district on the map with its own estate road', plots.banana === 'Banana Island' && city.roads === 6, plots.banana);

  // ------------------------------------------------------------------ Abuja and Port Harcourt are held to the same plan
  const others = await page.evaluate(() => {
    const g = window.game;
    const brief = (list) => list.map((v) => `${v.rule}: ${v.what} at (${v.at.x}, ${v.at.z})`);
    const tower = { owner: 'Test tower', structure: true, height: 12, minX: -3, maxX: 4, minZ: 20, maxZ: 27 };
    const kiosk = { owner: 'Test kiosk', structure: false, height: 2, minX: 9, maxX: 13.5, minZ: 60, maxZ: 62 };
    const abuja = g.world.cityManager.abujaCity;
    let road = null;
    abuja.group.traverse((obj) => { if (!road && obj.isMesh && obj.geometry.type === 'PlaneGeometry' && obj.geometry.parameters.width === 20) { obj.geometry.computeBoundingBox(); const b = obj.geometry.boundingBox.clone().applyMatrix4(obj.matrixWorld); road = { from: +b.min.z.toFixed(1), to: +b.max.z.toFixed(1) }; } });
    const lookout = abuja.interactiveList.find((i) => /Aso Rock/.test(i.name));
    return {
      abuja: brief(g.validateCity('abuja')),
      ph: brief(g.validateCity('port_harcourt')),
      abujaTower: brief(g.validateCity('abuja', [tower])),
      phKiosk: brief(g.validateCity('port_harcourt', [kiosk])),
      doors: { abuja: abuja.interactiveList.length, ph: g.world.cityManager.portHarcourtCity.interactiveList.length },
      road,
      lookoutZ: lookout.interactionPoint.z,
    };
  });
  check('Abuja and Port Harcourt pass the same plan: road clear, pavements walkable, nothing overlapping, every landmark reachable on foot',
    others.abuja.length === 0 && others.ph.length === 0 && others.doors.abuja >= 5 && others.doors.ph >= 4, { abuja: others.abuja, ph: others.ph });
  check('and the plan catches faults there too: a tower on Shehu Shagari Way, a kiosk across the Aba Road pavement',
    others.abujaTower.some((v) => v.startsWith('building-on-road: Test tower')) && others.phKiosk.some((v) => v.startsWith('walkway-blocked') && v.includes('Test kiosk')), { abujaTower: others.abujaTower, phKiosk: others.phKiosk });
  check('Shehu Shagari Way stops at the Aso Rock lookout instead of running on under the rock', others.road && others.road.from === -88 && others.road.to === 130 && others.lookoutZ <= others.road.from, { road: others.road, lookoutZ: others.lookoutZ });

  check('plan: no console errors', log.errors.length === 0, log.errors.slice(0, 6));
  await ctx.close();
}
