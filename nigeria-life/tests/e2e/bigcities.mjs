// Abuja and Port Harcourt as whole cities. Each is a grid of roads, not one straight avenue:
// junctions with lights, every carriageway drivable (the car keeps to the road through each
// junction), districts of buildings along every road, and the places each city is known for,
// each with a door: gone into and come back out of at that door. The corner of the screen names
// the road and the district. In Port Harcourt the creek runs down the east side, crossed on foot
// and by car only over its bridges. Both cities still pass their plans.
import { open, newPlayer, closeDialogs, wait, playUntil } from './lib.mjs';

const ABUJA_PLACES = ['national-assembly', 'transcorp-hilton', 'cbn-abuja', 'millennium-tower', 'wuse-market', 'jabi-lake-mall', 'national-hospital-abuja'];
const PH_PLACES = ['mile-one-market', 'ph-mall', 'rivers-govt-house'];

export async function run(browser, check) {
  const ctx = await newPlayer(browser);
  const { page, log } = await open(ctx);
  await closeDialogs(page);

  const survey = (city) => page.evaluate((c) => {
    const g = window.game;
    if (g.world.cityManager.currentCityId !== c) g.arriveInCity(c);
    const zones = g.modules.zonesFor(c);
    const roads = zones.filter((z) => z.kind === 'carriageway');
    const names = [...new Set(roads.map((z) => z.street))];
    const inst = c === 'abuja' ? g.world.cityManager.abujaCity : g.world.cityManager.portHarcourtCity;
    const bodies = inst.standing.filter((o) => o.structure).length;
    const life = g.world.cityManager.lifeHere();
    const axes = new Set(life.traffic.lanes.map((l) => l.axis));
    // Every junction of two driven roads: the car is on the road at its middle and on each arm
    const ns = roads.filter((z) => z.axis === 'z');
    const ew = roads.filter((z) => z.axis === 'x');
    let junctions = 0;
    let offRoad = 0;
    for (const a of ns) for (const b of ew) {
      const x = (a.minX + a.maxX) / 2;
      const z = (b.minZ + b.maxZ) / 2;
      if (x < b.minX || x > b.maxX || z < a.minZ || z > a.maxZ) continue;
      junctions++;
      // The middle of the junction, and each arm where its road carries on past it
      const arms = [[0, 0]];
      if (a.maxZ > z + 20) arms.push([0, 20]);
      if (a.minZ < z - 20) arms.push([0, -20]);
      if (b.maxX > x + 20) arms.push([20, 0]);
      if (b.minX < x - 20) arms.push([-20, 0]);
      for (const [dx, dz] of arms) if (!roads.some((q) => x + dx > q.minX && x + dx < q.maxX && z + dz > q.minZ && z + dz < q.maxZ)) offRoad++;
    }
    return { roads: names.length, names, junctions, offRoad, bodies, lanes: life.traffic.lanes.length, axes: [...axes], plan: g.validateCity(c).map((v) => `${v.rule}: ${v.what} ${v.detail ?? ''}`).slice(0, 6) };
  }, city);

  // ------------------------------------------------------------------ Abuja
  const abuja = await survey('abuja');
  await wait(1500);
  check('bigcities: Abuja is a grid of roads (Shehu Shagari Way, Ahmadu Bello Way, Independence Avenue and more), with junctions that are road all the way across, and traffic both ways on both kinds',
    abuja.roads >= 10 && ['Shehu Shagari Way', 'Ahmadu Bello Way', 'Independence Avenue', 'Herbert Macaulay Way', 'Aminu Kano Crescent'].every((n) => abuja.names.includes(n)) && abuja.junctions >= 9 && abuja.offRoad === 0 && abuja.axes.length === 2 && abuja.lanes >= 28, abuja);
  check('bigcities: Abuja has hundreds of buildings along its roads, every one solid, and still passes its plan', abuja.bodies > 250 && abuja.plan.length === 0, { bodies: abuja.bodies, plan: abuja.plan });

  const where = await page.evaluate(() => {
    const g = window.game;
    const at = (x, z) => g.world.getDistrictAtPosition(new g.modules.THREE.Vector3(x, 0, z));
    return { cbd: at(120, 174), wuse: at(-190, 300), park: at(196, 560), rock: at(0, -150), shagari: at(0, 600), market: at(-175, 186) };
  });
  check('bigcities: the corner of the screen names where the player is in Abuja: the road and the district, the place at its door',
    where.cbd.name === 'Ahmadu Bello Way' && /Central Business District|Maitama/.test(where.cbd.sub) && /Wuse/.test(where.wuse.name + where.wuse.sub) && /Millennium Park/.test(where.park.name) && where.rock.name === 'Aso Rock' && where.shagari.name === 'Shehu Shagari Way' && where.market.name === 'Wuse Market', where);

  // Each place: its door on the street, into its room, back out at the door
  const visit = async (key) => {
    const door = await page.evaluate((k) => {
      const g = window.game;
      const o = g.world.interactiveObjects.find((x) => x.id === `roadside-${k}`);
      if (!o) return null;
      g.player.mesh.position.set(o.interactionPoint.x, 0, o.interactionPoint.z);
      return { x: o.interactionPoint.x, z: o.interactionPoint.z };
    }, key);
    if (!door) return { key, door: false };
    await page.evaluate((k) => window.game.hud.onEnterInterior(`roadside-${k}`), key);
    const inside = await playUntil(page, () => (window.game.world.interiorManager.currentInterior && !window.game.world.interiorManager.busy ? window.game.world.interiorManager.currentInterior.name : null), 20);
    const room = await page.evaluate(() => ({ stations: window.game.world.interiorManager.getActiveInteractiveObjects().length }));
    await page.evaluate(() => { const g = window.game; return g.world.interiorManager.exitCurrentInterior(g.player, g.cameraManager, g.hud, g.world); });
    await playUntil(page, () => (!window.game.world.interiorManager.currentInterior && !window.game.world.interiorManager.busy ? true : null), 20);
    const out = await page.evaluate(() => ({ x: window.game.player.position.x, z: window.game.player.position.z, city: window.game.world.cityManager.currentCityId }));
    return { key, door: true, inside, stations: room.stations, backAtDoor: Math.hypot(out.x - door.x, out.z - door.z) < 6, city: out.city };
  };
  const abujaVisits = [];
  for (const key of ABUJA_PLACES) abujaVisits.push(await visit(key));
  check('bigcities: every Abuja place has a door on its street; each is gone into (its own room, with things to do) and come back out of at that door',
    abujaVisits.every((v) => v.door && v.inside && v.stations >= 3 && v.backAtDoor && v.city === 'abuja'), abujaVisits);

  // ------------------------------------------------------------------ Port Harcourt
  const ph = await survey('port_harcourt');
  await wait(1500);
  check('bigcities: Port Harcourt is its own grid: Aba Road, Ikwerre Road, Trans-Amadi Road and the roads across, junctions road all the way, traffic both ways',
    ph.roads >= 10 && ['Aba Road', 'Ikwerre Road', 'Trans-Amadi Road', 'Olu Obasanjo Road', 'Azikiwe Road', 'Rumuola Road'].every((n) => ph.names.includes(n)) && ph.junctions >= 9 && ph.offRoad === 0 && ph.axes.length === 2, ph);
  check('bigcities: Port Harcourt has hundreds of buildings, every one solid, and passes its plan', ph.bodies > 250 && ph.plan.length === 0, { bodies: ph.bodies, plan: ph.plan });

  const creek = await page.evaluate(() => {
    const g = window.game;
    const ways = g.waysHere();
    const solids = g.solidsHere();
    // Over the bridge on Olu Obasanjo Road's pavement; and straight across the water away from any bridge
    const bridge = ways.route(30, 189, 100, 189);
    return { bridge: !!bridge?.reaches, water: solids.at(65, 0, 0) || solids.at(65, 100, 0), onBridge: !solids.at(65, 189, 0), carOver: !!g.modules.DrivableVehicle?.onRoad?.(65, 184) || g.modules.zonesFor('port_harcourt').some((q) => q.kind === 'carriageway' && 65 > q.minX && 65 < q.maxX && 184 > q.minZ && 184 < q.maxZ) };
  });
  check('bigcities: in Port Harcourt the creek is water, crossed only over the bridges, on foot and by car', creek.bridge && creek.water && creek.onBridge && creek.carOver, creek);

  const phVisits = [];
  for (const key of PH_PLACES) phVisits.push(await visit(key));
  check('bigcities: every Port Harcourt place has its door, its room, and the way back out at the door',
    phVisits.every((v) => v.door && v.inside && v.stations >= 2 && v.backAtDoor && v.city === 'port_harcourt'), phVisits);

  check('bigcities: no errors in the page', log.errors.length === 0, log.errors.slice(0, 5));
  await ctx.close();
}
