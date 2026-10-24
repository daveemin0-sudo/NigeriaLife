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
  check('expressway: it is built in pieces, with twelve places along it, all of them in the world', layout.pieces > 30 && layout.places.length === 12 && layout.inWorld, layout);
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
  check('expressway: the beach has a card with something to do there', /Lagoon Beach/.test(card.title ?? '') && /beach/i.test(card.action ?? ''), card);

  check('expressway: no errors in the page', log.errors.length === 0, log.errors.slice(0, 5));
  await ctx.close();
}
