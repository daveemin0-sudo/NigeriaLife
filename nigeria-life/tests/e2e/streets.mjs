// The footbridge over Broad Street is a bridge: its stairs come up to its deck, the player
// climbs them, crosses above the traffic and comes down on the other side, is held by its
// rails while up there, and walks underneath it at street level like anyone else.
// And buildings are solid: nobody walks or drives through a wall, a fence or a stand, though
// every gate and door that is meant to be a way in still is.
import { open, newPlayer, closeDialogs, advance, wait } from './lib.mjs';

const here = (page) => page.evaluate(() => {
  const p = window.game.player;
  return { x: +p.position.x.toFixed(2), y: +p.position.y.toFixed(2), z: +p.position.z.toFixed(2), up: p.onBridge, moving: p.isMoving };
});
const put = (page, x, z) => page.evaluate(({ x, z }) => { const p = window.game.player; p.stopMoving(); p.onBridge = false; p.mesh.position.set(x, 0, z); }, { x, z });

/** Sends the player walking to a point and follows them there, noting how high they were on the way. */
async function walk(page, x, z, seconds = 40, step = 0.25) {
  await page.evaluate(({ x, z }) => { const g = window.game; g.player.setDestination(new g.player.position.constructor(x, 0, z)); }, { x, z });
  const heights = [];
  for (let t = 0; t < seconds; t += step) {
    await advance(page, step);
    const now = await here(page);
    heights.push(now);
    if (!now.moving) break;
  }
  return heights;
}

export async function run(browser, check) {
  const ctx = await newPlayer(browser);
  const { page, log } = await open(ctx);
  await closeDialogs(page);

  // ------------------------------------------------------------------ Built as a bridge
  const built = await page.evaluate(() => {
    const g = window.game;
    const box = new (g.player.position.constructor)();
    const stairs = { west: [], east: [] };
    let deck = null;
    g.world.roads.group.updateWorldMatrix(true, true);
    g.world.roads.group.traverse((node) => {
      if (!node.isMesh || !node.geometry) return;
      if (!node.geometry.boundingBox) node.geometry.computeBoundingBox();
      const b = node.geometry.boundingBox.clone().applyMatrix4(node.matrixWorld);
      const cx = (b.min.x + b.max.x) / 2;
      const width = b.max.x - b.min.x;
      const depth = b.max.z - b.min.z;
      // The deck: a slab right across the road
      // (Broad Street has several footbridges: this looks at the first, whose deck crosses at z = 28)
      const nearFirst = Math.abs((b.min.z + b.max.z) / 2 - 28) < 20;
      if (!nearFirst) return;
      if (width > 20 && depth > 3 && depth < 3.4 && b.max.y > 5 && b.max.y < 6 && b.min.y > 4.5) deck = { minZ: b.min.z, maxZ: b.max.z, top: b.max.y, minX: b.min.x, maxX: b.max.x };
      // A step: as wide as a flight, less than a metre deep, standing on the ground beside the road
      if (Math.abs(width - 1.5) < 0.05 && Math.abs(depth - 0.85) < 0.05 && Math.abs(Math.abs(cx) - 11.2) < 0.1 && b.min.y < 0.05) (cx < 0 ? stairs.west : stairs.east).push({ z: (b.min.z + b.max.z) / 2, top: b.max.y, maxZ: b.max.z });
    });
    void box;
    const flight = (steps) => {
      const sorted = steps.slice().sort((a, b) => a.z - b.z);
      return { count: sorted.length, rising: sorted.every((s, i) => i === 0 || s.top > sorted[i - 1].top), lowest: sorted[0]?.top, highest: sorted[sorted.length - 1]?.top, reaches: sorted[sorted.length - 1]?.maxZ };
    };
    return { deck, west: flight(stairs.west), east: flight(stairs.east), plan: g.world.validateCityPlan().map((v) => `${v.rule}: ${v.what}`) };
  });
  const meets = (f) => f.count === 14 && f.rising && f.lowest < 0.5 && Math.abs(f.highest - built.deck.top) < 0.05 && Math.abs(f.reaches - built.deck.minZ) < 0.05;
  check('each flight of stairs climbs from the pavement to the deck and arrives against it at the deck\'s own height (they used to climb away from it)',
    !!built.deck && meets(built.west) && meets(built.east), built);
  check('with the stairs standing on the pavement as solid flights, Lagos still passes its city plan', built.plan.length === 0, built.plan);

  // ------------------------------------------------------------------ Up, over and down
  await put(page, -11.2, 13.4);
  // Sampled finely: on a busy machine a quarter second can carry the player over most of the flight
  const up = await walk(page, -11.2, 27.6, 40, 0.1);
  const top = up[up.length - 1];
  const climbing = up.filter((s) => s.z > 15 && s.z < 26);
  check('walking at the foot of the west stairs and on up them, the player climbs: higher at every step until they are on the deck above the road',
    climbing.length >= 2 && climbing.every((s, i) => i === 0 || s.y >= climbing[i - 1].y - 0.01) && climbing[climbing.length - 1].y > 4 && Math.abs(top.y - 5.65) < 0.1 && top.up && Math.abs(top.z - 27.6) < 0.3,
    { top, count: climbing.length, drops: climbing.filter((s, i) => i > 0 && s.y < climbing[i - 1].y - 0.01).map((s) => `${s.x},${s.z}:${s.y}`), sample: climbing.filter((_, i) => i % 3 === 0).map((s) => `${s.z}:${s.y}`) });

  const over = await walk(page, 11.2, 27.6);
  const middle = over.filter((s) => Math.abs(s.x) < 6);
  const far = over[over.length - 1];
  check('they cross the road on the deck, above the traffic all the way', middle.length >= 1 && middle.every((s) => Math.abs(s.y - 5.65) < 0.1) && Math.abs(far.x - 11.2) < 0.3 && far.up, { far, middle: middle.length });

  // Held by the rails
  await walk(page, 0, 27.8);
  const offNorth = await walk(page, 0, 40, 8);
  const northEnd = offNorth[offNorth.length - 1];
  const offSouth = await walk(page, 0, 15, 8);
  const southEnd = offSouth[offSouth.length - 1];
  check('up there the rails hold: the player cannot step off either side of the deck into the air',
    northEnd.z < 29.5 && Math.abs(northEnd.y - 5.65) < 0.1 && southEnd.z > 26.4 && Math.abs(southEnd.y - 5.65) < 0.1 && southEnd.up, { northEnd, southEnd });

  await walk(page, 11.2, 27.6);
  const down = await walk(page, 11.2, 13.2);
  const foot = down[down.length - 1];
  const descending = down.filter((s) => s.z > 15 && s.z < 26);
  check('and they come down the east stairs to the pavement on the other side of the road',
    descending.every((s, i) => i === 0 || s.y <= descending[i - 1].y + 0.01) && foot.y < 0.3 && !foot.up && Math.abs(foot.x - 11.2) < 0.4 && foot.z < 14, { foot });

  // ------------------------------------------------------------------ The street underneath
  await put(page, 9, 20);
  const under = await walk(page, 9, 36);
  const underRoad = await (async () => { await put(page, 0, 20); return walk(page, 0, 36); })();
  check('someone walking along the pavement or the road passes under the bridge at street level',
    under.every((s) => s.y < 0.05 && !s.up) && under[under.length - 1].z > 35 && underRoad.every((s) => s.y < 0.05) && underRoad[underRoad.length - 1].z > 35, { end: under[under.length - 1] });

  await put(page, -8.6, 21);
  const side = await walk(page, -13.4, 21, 8);
  const stopped = side[side.length - 1];
  check('the side of a flight is a wall of concrete: walking into it from the pavement does not put the player half-way up the stairs',
    side.every((s) => s.y < 0.05) && stopped.x > -10.5, { stopped });

  // ------------------------------------------------------------------ Buildings are solid
  // Walked straight at, as the keys walk: the way-finder (which would go round by the gate) is left out of it here.
  // What it does is in the ways suite.
  await page.evaluate(() => { const p = window.game.player; window.__wayfinder = p.wayfinder; p.wayfinder = null; });
  const bank = await page.evaluate(() => {
    const all = window.game.world.standingOnTheGround().filter((o) => /Eko Commercial Bank/.test(o.owner) && o.structure && o.maxZ < 500);
    return { minX: Math.min(...all.map((o) => o.minX)), maxX: Math.max(...all.map((o) => o.maxX)), minZ: Math.min(...all.map((o) => o.minZ)), maxZ: Math.max(...all.map((o) => o.maxZ)), solids: window.game.solidsHere().count };
  });
  const midZ = (bank.minZ + bank.maxZ) / 2;
  await put(page, 8.5, midZ);
  const atWall = (await walk(page, (bank.minX + bank.maxX) / 2, midZ, 10)).pop();
  check('walking at the front of the bank stops at its wall: the player does not pass into the building',
    bank.solids > 150 && atWall.x < bank.minX && !atWall.moving, { atWall, front: bank.minX });

  await put(page, 10, bank.minZ - 12);
  const past = (await walk(page, 10, bank.maxZ + 12, 40)).pop();
  check('walking along the pavement past it, they step round what juts out and carry on to where they were going', Math.abs(past.x - 10) < 0.3 && Math.abs(past.z - (bank.maxZ + 12)) < 0.3, past);

  await put(page, -40, 20);
  const stand = (await walk(page, -60, 20, 12)).pop();
  await put(page, -40, 5);
  const gate = (await walk(page, -56, 5, 12)).pop();
  check('the wall of the stadium keeps people out, and Gate A lets them in', stand.x > -46.6 && Math.abs(gate.x + 56) < 0.3 && Math.abs(gate.z - 5) < 0.3, { stand, gate });

  // (The airport has moved up to Ikeja: its fence is checked in the ways suite)
  await put(page, -40, 70);
  const quay = (await walk(page, -52, 70, 12)).pop();
  await put(page, -40, 48);
  const portGate = (await walk(page, -52, 48, 12)).pop();
  check('the fence of the port keeps people off the quay, and the gate of the port is open',
    quay.x > -45 && Math.abs(portGate.x + 52) < 0.3, { quay, portGate });

  // Someone set down inside a building is not trapped in it
  await put(page, (bank.minX + bank.maxX) / 2, midZ);
  const out = (await walk(page, 8.5, midZ, 12)).pop();
  check('someone who finds themselves inside a building can always walk out of it', Math.abs(out.x - 8.5) < 0.3, out);

  await page.evaluate(() => { window.game.player.wayfinder = window.__wayfinder; });

  // Driving
  const car = await page.evaluate(async ({ z }) => {
    const g = window.game;
    const v = g.world.vehicles.getVehicleById(g.world.vehicles.interactiveList.find((o) => o.id.startsWith('veh-')).id);
    g.player.stopMoving();
    g.player.mesh.position.set(4, 0, z);
    v.mesh.position.set(2, 0, z);
    v.mesh.rotation.y = Math.PI / 2;
    g.enterVehicle(v);
    // The wall is what is being tried: nobody parked or passing is in the way
    v.constructor.ignoreBodies = true;
    return { id: v.config?.id ?? null, driving: g.player.isDriving };
  }, { z: midZ });
  await page.keyboard.down('w');
  for (let i = 0; i < 16; i++) await advance(page, 0.25);
  await page.keyboard.up('w');
  const crashed = await page.evaluate(() => { const g = window.game; const v = g.player.currentVehicle; return v ? { x: +v.mesh.position.x.toFixed(2), speed: +Math.abs(v.currentSpeed).toFixed(2) } : null; });
  await page.evaluate(() => { window.game.world.vehicles.drivableVehicles[0].constructor.ignoreBodies = false; });
  await page.keyboard.press('f');
  await advance(page, 0.5);
  check('a vehicle driven at the bank stops against its wall', car.driving && !!crashed && crashed.x > 4 && crashed.x < bank.minX - 0.9 && crashed.speed < 0.5, { car, crashed, front: bank.minX });

  // In a vehicle the bridge is something driven under
  const driven = await page.evaluate(() => { const p = window.game.player; const was = p.isDriving; p.isDriving = true; p.onBridge = true; const h = p.calculateWalkableHeight(0, 28); p.isDriving = was; p.onBridge = false; return h; });
  check('a vehicle goes under the deck, not up on to it', driven === 0, driven);

  check('no errors were logged at any of it', log.errors.length === 0, log.errors.slice(0, 5));
  await wait(100);
  await ctx.close();
}
