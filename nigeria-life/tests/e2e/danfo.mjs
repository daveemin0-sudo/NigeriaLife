// Driving a danfo for fares: the money comes from people really waiting at a bus stop, each one
// pays as they step in, and nothing is earned parked anywhere else.
import { open, newPlayer, closeDialogs } from './lib.mjs';

export async function run(browser, check) {
  const ctx = await newPlayer(browser);
  const { page, log } = await open(ctx);
  await closeDialogs(page);

  const setup = await page.evaluate(() => {
    const g = window.game;
    g.world.skyEnvironment.setHour(12); // midday: the queues are full
    const danfo = g.world.vehicles.drivableVehicles.find((v) => v.type === 'danfo');
    if (!danfo) return { ok: false };
    g.player.stopMoving();
    g.player.mesh.position.copy(danfo.mesh.position);
    g.enterVehicle(danfo);
    window.__park = (x, z) => {
      const v = g.player.currentVehicle;
      v.mesh.position.set(x, 0, z);
      v.mesh.rotation.y = 0;
      v.currentSpeed = 0;
      v.steerInput = 0;
    };
    window.__cash = () => g.hud.backend.getData().walletCash;
    return { ok: g.player.isDriving && g.player.currentVehicle === danfo };
  });
  check('danfo: the player is driving the street danfo', setup.ok, setup);
  if (!setup.ok) return;

  // 1. Parked in the road away from any stop: nobody gets on, nothing is earned
  const idle = await page.evaluate(async () => {
    const g = window.game;
    window.__park(-4.9, 10);
    const before = window.__cash();
    await g.advance(20);
    return { earned: window.__cash() - before, aboard: g.player.currentVehicle.passengers };
  });
  check('danfo: parked away from a bus stop for 20 s, no passenger boards and no fare is paid', idle.earned === 0 && idle.aboard === 0, idle);

  // 1b. Stopped in traffic with the hawker at the window: H honks and costs nothing, J buys the water
  await page.bringToFront();
  const hawkerHere = await page.evaluate(() => document.getElementById('driving-hawker-pill')?.style.display === 'flex');
  const beforeHonk = await page.evaluate(() => window.__cash());
  await page.keyboard.press('h');
  await page.evaluate(() => window.game.advance(0.3));
  const afterHonk = await page.evaluate(() => window.__cash());
  await page.keyboard.press('j');
  await page.evaluate(() => window.game.advance(0.3));
  const afterWater = await page.evaluate(() => window.__cash());
  check(
    'danfo: in slow traffic with the hawker at the window, H honks without buying anything, and J buys one pure water for ₦100',
    hawkerHere && afterHonk === beforeHonk && afterWater === beforeHonk - 100,
    { hawkerHere, beforeHonk, afterHonk, afterWater }
  );

  // 2. Pulled up at the stop at z = 60 (west kerb, southbound): the queue gets on, one fare each
  const stop = await page.evaluate(async () => {
    const g = window.game;
    const crowd = g.world.cityPopulation;
    window.__park(-4.9, 60);
    const v = g.player.currentVehicle;
    const index = crowd.stopAt(-4.9, 60);
    const waitingBefore = crowd.waitingAt(index);
    const before = window.__cash();
    // Watch one boarding happen: someone walks towards the door before any money changes hands
    let walkingSeen = false;
    let paidBeforeArriving = false;
    for (let i = 0; i < 60 && v.passengers < 3; i++) {
      await g.advance(0.25);
      const walker = crowd.agents.find((a) => a.boarding);
      if (walker) walkingSeen = true;
      if (walker && v.passengers === 0 && window.__cash() !== before) paidBeforeArriving = true;
    }
    return {
      index,
      waitingBefore,
      waitingAfter: crowd.waitingAt(index),
      aboard: v.passengers,
      earned: window.__cash() - before,
      fare: v.fareRate,
      walkingSeen,
      paidBeforeArriving,
    };
  });
  check(
    'danfo: at the bus stop, people from the queue walk to the door and get on, and each pays one fare as they step in',
    stop.index >= 0 && stop.aboard >= 3 && stop.earned === stop.aboard * stop.fare && stop.walkingSeen && !stop.paidBeforeArriving,
    stop
  );
  check('danfo: everyone who got on has left the queue', stop.waitingBefore - stop.waitingAfter >= stop.aboard, stop);

  // 3. Pull away while someone is walking to the door: they stay behind and pay nothing
  const missed = await page.evaluate(async () => {
    const g = window.game;
    const crowd = g.world.cityPopulation;
    const v = g.player.currentVehicle;
    let walker = null;
    for (let i = 0; i < 40 && !walker; i++) {
      await g.advance(0.1);
      walker = crowd.agents.find((a) => a.boarding);
    }
    if (!walker) return { walker: false };
    const aboard = v.passengers;
    const before = window.__cash();
    v.mesh.position.z += 12; // gone down the road
    await g.advance(8);
    return { walker: true, newAboard: v.passengers - aboard, earned: window.__cash() - before, stillThere: !walker.away };
  });
  check('danfo: driving off before someone reaches the door leaves them at the stop, with no fare taken', missed.walker && missed.newAboard === 0 && missed.earned === 0 && missed.stillThere, missed);

  // 4. At the next stop those aboard get down before anyone new gets on
  const next = await page.evaluate(async () => {
    const g = window.game;
    const v = g.player.currentVehicle;
    const aboard = v.passengers;
    window.__park(-4.9, -20);
    const before = window.__cash();
    let lowest = aboard;
    for (let i = 0; i < 80; i++) {
      await g.advance(0.25);
      lowest = Math.min(lowest, v.passengers);
    }
    return { aboard, lowest, earnedWhileUnloading: lowest === 0 ? null : window.__cash() - before };
  });
  check('danfo: at the next stop the passengers aboard get down', next.aboard > 0 && next.lowest === 0, next);

  // 5. An ambulance is not a bus
  const ambulance = await page.evaluate(async () => {
    const g = window.game;
    const amb = g.world.vehicles.drivableVehicles.find((v) => v.type === 'ambulance');
    if (!amb) return { found: false };
    g.exitVehicle();
    g.player.mesh.position.copy(amb.mesh.position);
    g.enterVehicle(amb);
    window.__park(-4.9, 60);
    const before = window.__cash();
    await g.advance(15);
    return { found: true, earned: window.__cash() - before, commercial: amb.isCommercialTransit };
  });
  check('danfo: an ambulance stopped at a bus stop takes no fares', ambulance.found && ambulance.earned === 0 && !ambulance.commercial, ambulance);

  check('danfo: no errors in the page', log.errors.length === 0, log.errors.slice(0, 5));
  await ctx.close();
}
