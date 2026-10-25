// The expressway: Broad Street carries on south for four kilometres, over the lagoon, to a
// roundabout. A car can be driven its length; the toll is paid once passing the plaza; nobody
// walks onto it; the places along it each have something to do; the traffic is out on it.
import { open, newPlayer, closeDialogs, advance, wait } from './lib.mjs';

export async function run(browser, check) {
  const ctx = await newPlayer(browser);
  const { page, log } = await open(ctx);
  await closeDialogs(page);
  await page.evaluate(() => window.game.world.skyEnvironment.setHour(12));

  const layout = await page.evaluate(() => {
    const g = window.game;
    const roads = g.world.expressway;
    const zones = g.waysHere ? null : null;
    const traffic = [];
    g.world.trafficSpawner.cars(0, 2000, 2200, traffic);
    return {
      pieces: roads.group.children.length,
      places: roads.roadside.interactive.map((o) => o.id),
      inWorld: roads.roadside.interactive.every((o) => g.world.interactiveObjects.includes(o)),
      carsOut: traffic.filter((c) => c.z > 300 && !c.parked).length,
      barrier: g.solidsHere().at(0, 600, 0),
      lane: !g.solidsHere().at(-4.9, 600, 1.2),
    };
  });
  check('expressway: it is built in pieces, with its 28 places along it (25 to visit, 3 filling stations), all of them in the world', layout.pieces > 30 && layout.places.length === 28 && layout.inWorld, layout);
  check('expressway: traffic is out on it, the barrier down the middle is solid and the lanes are clear', layout.carsOut > 50 && layout.barrier && layout.lane, layout);

  // Drive from Broad Street past the toll and over the bridge, on an empty road
  const drive = await page.evaluate(async () => {
    const g = window.game;
    const v = g.world.vehicles.drivableVehicles.find((x) => x.type === 'sedan');
    g.player.stopMoving();
    g.player.mesh.position.copy(v.mesh.position);
    g.enterVehicle(v);
    v.constructor.ignoreBodies = true;
    v.mesh.position.set(-4.9, 0, 700);
    v.mesh.rotation.y = 0;
    v.velocityDirection.set(0, 1);
    const before = g.hud.backend.getData();
    const money0 = before.walletCash + before.bank.balance;
    g.input.keys.w = true;
    for (let i = 0; i < 110; i++) await g.advance(0.25);
    g.input.keys.w = false;
    const after = g.hud.backend.getData();
    return { z: +v.mesh.position.z.toFixed(1), x: +v.mesh.position.x.toFixed(2), paid: money0 - (after.walletCash + after.bank.balance), overWater: v.mesh.position.z > 1300 };
  });
  check('expressway: a car driven from before the toll goes on down the expressway and out over the lagoon, keeping its lane', drive.z > 1300 && Math.abs(drive.x + 4.9) < 1.5, drive);
  check('expressway: passing the toll plaza pays ₦400, once', drive.paid === 400, drive);

  // Out of the car on the shoulder: no walking across
  const walk = await page.evaluate(async () => {
    const g = window.game;
    g.exitVehicle?.();
    await g.advance(0.5);
    g.player.stopMoving();
    g.player.mesh.position.set(-13, 0.28, 520);
    g.player.targetPosition = new (g.player.mesh.position.constructor)(5, 0.28, 520);
    g.player.isMoving = true;
    g.player.nearest = Infinity;
    g.player.sinceNearer = 0;
    for (let i = 0; i < 12; i++) await g.advance(0.25);
    return { x: +g.player.position.x.toFixed(2), told: /pedestrian bridge/i.test(document.body.innerText) };
  });
  check('expressway: on foot the player cannot walk onto it, and is told to use the footbridge', walk.x < -10.6 && walk.told, walk);

  // A place: the beach's card has things to do
  const card = await page.evaluate(() => {
    const g = window.game;
    const o = g.world.interactiveObjects.find((x) => x.id === 'roadside-lagoon-beach');
    g.player.mesh.position.set(o.interactionPoint.x, 0.28, o.interactionPoint.z);
    g.hud.showInteractionCard(o);
    return { title: document.getElementById('interaction-card')?.innerText.slice(0, 80), action: document.getElementById('card-action-btn')?.textContent };
  });
  check('expressway: the beach has a card with something to do there', /Elegushi Beach/.test(card.title ?? '') && /beach/i.test(card.action ?? ''), card);

  // The places the phone and the map name: each has a building and a card where they send you
  const placed = await page.evaluate(() => {
    const g = window.game;
    const ids = ['dest_lagos_marina_towers', 'dest_lagos_freedom_park', 'dest_lagos_ivory_rooftop', 'dest_lagos_the_library', 'dest_lagos_ifitness', 'dest_lagos_lekki_conservation', 'dest_lagos_refinery', 'dest_lagos_radio', 'dest_lagos_balogun_market', 'dest_lagos_amala_shitta', 'dest_lagos_mama_bisi_salon', 'dest_lagos_polling_unit', 'dest_lagos_afrika_shrine', 'dest_lagos_chapel', 'dest_lagos_central_mosque', 'dest_lagos_elegushi_beach', 'dest_lagos_palms_lekki'];
    const registry = g.modules.DestinationRegistry.getInstance();
    const cards = g.world.interactiveObjects.filter((o) => o.id.startsWith('roadside-'));
    const bad = [];
    for (const id of ids) {
      const d = registry.getById(id);
      const card = d && cards.find((o) => Math.hypot(o.interactionPoint.x - d.streetPosition.x, o.interactionPoint.z - d.streetPosition.z) < 2.5);
      const building = card && g.world.expressway.roadside.group.getObjectByName(card.id.replace('roadside-', ''));
      let meshes = 0;
      building?.traverse((o) => { if (o.isMesh && o.geometry?.attributes.position?.count > 100) meshes++; });
      if (!d || !card || card.name !== d.name || meshes < 1) bad.push({ id, name: d?.name, card: card?.name ?? null, meshes });
    }
    return { count: ids.length, bad };
  });
  check('expressway: every place the phone names (church, shrine, market, refinery, polling unit and the rest) is built, with its card at the spot a ride or a pin takes you to', placed.bad.length === 0, placed);

  const rode = await page.evaluate(async () => {
    const g = window.game;
    g.hud.backend.performGig(100000, 0, 'test: fare');
    g.player.mesh.position.set(9, 0, 40);
    const booked = g.rides.book('dest_lagos_amala_shitta', 'taxi');
    for (let i = 0; i < 80 && (g.rides.ride || g.roadRideExperience.isActive || !booked.ok); i++) {
      await g.advance(0.5);
      if (g.roadRideExperience.isActive) g.roadRideExperience.skipRide();
    }
    const card = g.world.interactiveObjects.find((o) => o.id === 'roadside-amala-shitta');
    await g.advance(0.5);
    const shop = g.world.expressway.roadside.group.getObjectByName('amala-shitta');
    return { booked: booked.ok, away: +Math.hypot(g.player.position.x - card.interactionPoint.x, g.player.position.z - card.interactionPoint.z).toFixed(1), shown: !!shop?.visible };
  });
  check('expressway: a taxi booked to Amala Shitta leaves the player at its door, with the buka there in front of them', rode.booked && rode.away < 3 && rode.shown, rode);

  // A footbridge over the expressway is climbed from the foot of its stairs, crossed, and come down on the far side
  const crossed = await page.evaluate(async () => {
    const g = window.game;
    const p = g.player;
    const z = 800;
    const S = { stairX: 13.2, foot: z - 1.3 - 12 * 0.7, top: z - 1.3 };
    p.stopMoving();
    p.onBridge = false;
    p.mesh.position.set(-S.stairX, 0, S.foot - 1);
    const go = async (x, zz, seconds) => {
      p.setDestination(new p.position.constructor(x, 0, zz));
      let highest = 0;
      for (let i = 0; i < seconds * 10 && p.isMoving; i++) {
        await g.advance(0.1);
        highest = Math.max(highest, p.mesh.position.y);
      }
      return highest;
    };
    const up = await go(-S.stairX, z, 12);
    const onDeck = { x: +p.position.x.toFixed(1), y: +p.mesh.position.y.toFixed(2), on: p.onBridge };
    await go(S.stairX, z, 14);
    const across = { x: +p.position.x.toFixed(1), y: +p.mesh.position.y.toFixed(2) };
    await go(S.stairX, S.foot - 2, 14);
    const down = { x: +p.position.x.toFixed(1), z: +p.position.z.toFixed(1), y: +p.mesh.position.y.toFixed(2), on: p.onBridge };
    return { up, onDeck, across, down };
  });
  check('expressway: its footbridge is climbed from the stairs on the pavement, crossed over the traffic, and come down on the other side',
    crossed.onDeck.y > 6 && crossed.onDeck.on && crossed.across.x > 10 && crossed.across.y > 6 && crossed.down.x > 10 && crossed.down.y < 0.5 && !crossed.down.on, crossed);

  check('expressway: no errors in the page', log.errors.length === 0, log.errors.slice(0, 5));
  await ctx.close();
}
