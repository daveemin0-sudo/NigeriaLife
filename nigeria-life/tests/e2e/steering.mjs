// How a car answers the keyboard: it holds its lane without weaving, a tap is a small
// correction, it turns like a car at low speed and cannot out-turn its tyres at high speed,
// and it does the same thing at 20, 60 and 144 frames a second.
//
// The vehicle is stepped directly with a fixed time step inside one page.evaluate, so the game
// loop does not run in between and the numbers are exact. One check at the end drives it with
// real key presses through the running game.
import { open, newPlayer, closeDialogs, wait } from './lib.mjs';

export async function run(browser, check) {
  const ctx = await newPlayer(browser);
  const { page, log } = await open(ctx);
  await closeDialogs(page);

  const ready = await page.evaluate(() => {
    const g = window.game;
    const veh = g.world.vehicles.drivableVehicles.find((v) => v.type === 'sedan');
    if (!veh) return { ok: false };
    g.player.stopMoving();
    g.player.mesh.position.copy(veh.mesh.position);
    g.enterVehicle(veh);
    // One function, used by every scenario below: put the car somewhere and drive it with held keys
    window.__drive = (setup, seconds, dt, keysAt, sample = 0.1) => {
      const V = veh.constructor;
      const v = g.player.currentVehicle;
      v.mesh.position.set(setup.x, 0, setup.z);
      v.mesh.rotation.y = setup.heading;
      v.currentSpeed = setup.speed;
      v.steerInput = 0;
      v.velocityDirection.set(Math.sin(setup.heading), Math.cos(setup.heading));
      const savedSolids = V.solids;
      if (setup.noSolids) V.solids = null;
      // Handling is measured on an empty road: other traffic and people are not in the way
      V.ignoreBodies = true;
      const out = [];
      let next = 0;
      const steps = Math.round(seconds / dt);
      for (let i = 0; i <= steps; i++) {
        const t = i * dt;
        if (t >= next - 1e-9) {
          out.push({ t, x: v.mesh.position.x, z: v.mesh.position.z, h: v.mesh.rotation.y, s: v.currentSpeed, w: v.steerInput, a: v.turnAngle });
          next += sample;
        }
        if (setup.holdSpeed !== undefined) v.currentSpeed = setup.holdSpeed;
        v.update(dt, keysAt(t));
      }
      V.solids = savedSolids;
      V.ignoreBodies = false;
      return out;
    };
    const V = veh.constructor;
    const roads = V.roads ? V.roads() : [];
    const cross = roads.find((r) => r.id === 'cross:road');
    return { ok: g.player.isDriving, cross: cross ? { minZ: cross.minZ, maxZ: cross.maxZ } : null };
  });
  check('steering: the player is driving a sedan', ready.ok, ready);
  if (!ready.ok) return;

  // Broad Street: two lanes each way between the centre line and the kerb, where the traffic drives
  // (centres 1.86 m and 4.89 m out). Going south (+z) the driver's right is -x.
  const LANE = -(0.35 + 1.5 * ((7 - 0.35 - 0.6) / 2));

  // ---------------------------------------------------------------------------------------
  // 1. Let go of the wheel 1 m out of lane and 4 degrees off line, foot down: it settles, no weave
  // ---------------------------------------------------------------------------------------
  const settle = (dt) =>
    page.evaluate(
      (dt, LANE) => window.__drive({ x: LANE + 1.0, z: -110, heading: 0.07, speed: 12 }, 6, dt, () => ({ arrowup: true })),
      dt,
      LANE
    );
  const runs = { 20: await settle(1 / 20), 60: await settle(1 / 60), 144: await settle(1 / 144) };
  const at60 = runs[60];
  const errors = at60.map((p) => p.x - LANE);
  const crossings = errors.slice(1).filter((e, i) => Math.sign(e) !== Math.sign(errors[i]) && Math.abs(e) > 0.02).length;
  const overshoot = Math.max(0, ...errors.map((e) => -e)); // started on the + side
  const last = at60[at60.length - 1];
  check(
    'steering: let go out of lane, the car settles into the lane centre without weaving (no more than one crossing, overshoot under 0.15 m, within 0.2 m and 1 degree by the end)',
    crossings <= 1 && overshoot < 0.15 && Math.abs(last.x - LANE) < 0.2 && Math.abs(last.h) < 0.0175,
    { crossings, overshoot: +overshoot.toFixed(3), endOff: +(last.x - LANE).toFixed(3), endHeadingDeg: +((last.h * 180) / Math.PI).toFixed(2), endSpeed: +last.s.toFixed(1), travelled: +(last.z + 110).toFixed(1) }
  );
  check(
    'steering: it gathers speed gradually but briskly (16 to 27 m/s after 2 s of full throttle from 12 m/s)',
    at60[20].s > 16 && at60[20].s < 27,
    { after2s: +at60[20].s.toFixed(1) }
  );

  const ends = Object.fromEntries(Object.entries(runs).map(([fps, r]) => [fps, r[r.length - 1]]));
  const spread = Math.max(
    Math.hypot(ends[20].x - ends[144].x, ends[20].z - ends[144].z),
    Math.hypot(ends[60].x - ends[144].x, ends[60].z - ends[144].z)
  );
  check(
    'steering: the same drive ends in the same place at 20, 60 and 144 frames a second (within 0.6 m after about 130 m)',
    spread < 0.6,
    { spread: +spread.toFixed(3), ends: Object.fromEntries(Object.entries(ends).map(([k, p]) => [k, { x: +p.x.toFixed(2), z: +p.z.toFixed(2) }])) }
  );

  // ---------------------------------------------------------------------------------------
  // 2. A tap is a small correction, and the car does not rock after it
  // ---------------------------------------------------------------------------------------
  const tap = (assist) =>
    page.evaluate(
      (LANE, assist) => {
        const V = window.game.player.currentVehicle.constructor;
        const saved = V.laneAssistStrength;
        V.laneAssistStrength = assist;
        const out = window.__drive({ x: LANE, z: -110, heading: 0, speed: 20, holdSpeed: 20 }, 4, 1 / 60, (t) => ({ arrowleft: t < 0.15 }), 1 / 60);
        V.laneAssistStrength = saved;
        return out;
      },
      LANE,
      assist
    );
  const describeTap = (r) => {
    const peak = Math.max(...r.map((p) => Math.abs(p.h)));
    const rates = r.slice(1).map((p, i) => (p.h - r[i].h) / (p.t - r[i].t));
    const flips = rates.slice(1).filter((q, i) => Math.abs(q) > 0.01 && Math.abs(rates[i]) > 0.01 && Math.sign(q) !== Math.sign(rates[i])).length;
    const wheelBack = r.find((p) => p.t > 0.15 && p.w === 0);
    return { peakDeg: +((peak * 180) / Math.PI).toFixed(2), turnFlips: flips, endDeg: +((r[r.length - 1].h * 180) / Math.PI).toFixed(2), wheelCentredAfter: wheelBack ? +(wheelBack.t - 0.15).toFixed(2) : null };
  };
  const tapOff = describeTap(await tap(0));
  check(
    'steering: a 0.15 s tap at 20 m/s with no assist turns the car a little (0.3 to 4 degrees), the wheel is back in the middle within 0.3 s, and the car then runs straight (never turns back on its own)',
    tapOff.peakDeg > 0.3 && tapOff.peakDeg < 4 && tapOff.turnFlips === 0 && tapOff.wheelCentredAfter !== null && tapOff.wheelCentredAfter <= 0.3,
    tapOff
  );
  const tapOn = describeTap(await tap(0.85));
  check(
    'steering: with the road assist on, the same tap is straightened back to the road line without rocking (at most one change of turning direction, within 1 degree at the end)',
    tapOn.turnFlips <= 1 && Math.abs(tapOn.endDeg) < 1,
    tapOn
  );

  // ---------------------------------------------------------------------------------------
  // 3. Turning like a car: tight but not on the spot when slow, held by the tyres when fast
  // ---------------------------------------------------------------------------------------
  const turning = await page.evaluate(() => {
    const full = () => ({ arrowleft: true });
    const rate = (r) => {
      const a = r[Math.floor(r.length / 2)];
      const b = r[r.length - 1];
      return (b.h - a.h) / (b.t - a.t);
    };
    const slow = window.__drive({ x: 0, z: 0, heading: 0, speed: 4, holdSpeed: 4, noSolids: true }, 3, 1 / 60, full);
    const crawl = window.__drive({ x: 0, z: 0, heading: 0, speed: 0.3, holdSpeed: 0.3, noSolids: true }, 3, 1 / 60, full);
    const fast = window.__drive({ x: 0, z: 0, heading: 0, speed: 28, holdSpeed: 28, noSolids: true }, 2, 1 / 60, full);
    const back = window.__drive({ x: 0, z: 0, heading: 0, speed: -4, holdSpeed: -4, noSolids: true }, 2, 1 / 60, full);
    return { slowRadius: 4 / rate(slow), crawlRate: rate(crawl), fastLateral: 28 * rate(fast), reverseRate: rate(back) };
  });
  check('steering: at 4 m/s on full lock the car turns in a car-like circle (radius 3.5 to 7 m)', turning.slowRadius > 3.5 && turning.slowRadius < 7, turning);
  check('steering: at 0.3 m/s it cannot spin on the spot (under 0.15 rad/s)', Math.abs(turning.crawlRate) < 0.15, turning);
  check('steering: at 28 m/s on full lock the turn is held by the tyres (sideways acceleration at most 8.5 m/s²)', turning.fastLateral > 3 && turning.fastLateral <= 8.6, turning);
  check('steering: reversing with left lock swings the car the other way, like a car', turning.reverseRate < -0.1, turning);

  // ---------------------------------------------------------------------------------------
  // 4. Lifting off coasts; it is not an emergency stop
  // ---------------------------------------------------------------------------------------
  const coast = await page.evaluate((LANE) => window.__drive({ x: LANE, z: -110, heading: 0, speed: 25 }, 14, 1 / 60, () => ({})), LANE);
  check(
    'steering: lifting off at 25 m/s still leaves at least 19 m/s a second later, and the car rolls to a stop within 14 s',
    coast[10].s > 19 && coast[coast.length - 1].s === 0,
    { after1s: +coast[10].s.toFixed(1), after5s: +coast[50].s.toFixed(1), end: coast[coast.length - 1].s }
  );

  // ---------------------------------------------------------------------------------------
  // 5. The assist works on side streets too, not only Broad Street
  // ---------------------------------------------------------------------------------------
  if (ready.cross) {
    const mid = (ready.cross.minZ + ready.cross.maxZ) / 2;
    const half = (ready.cross.maxZ - ready.cross.minZ) / 2;
    // Going east (+x, heading pi/2) the driver's right is +z: one lane each way, between the centre line and the kerb
    const target = mid + 0.35 + (half - 0.35 - 0.6) / 2;
    const side = await page.evaluate(
      (z0) => window.__drive({ x: 14, z: z0, heading: Math.PI / 2 + 0.05, speed: 10, holdSpeed: 10, noSolids: true }, 6, 1 / 60, () => ({})),
      target - 0.8
    );
    const end = side[side.length - 1];
    const errs = side.map((p) => p.z - target);
    const flips = errs.slice(1).filter((e, i) => Math.sign(e) !== Math.sign(errs[i]) && Math.abs(e) > 0.02).length;
    check(
      'steering: on Martins Street (an east-west side street) a car let go off-line settles into its lane too, without weaving',
      Math.abs(end.z - target) < 0.2 && flips <= 1 && Math.abs(end.h - Math.PI / 2) < 0.02,
      { endOff: +(end.z - target).toFixed(3), flips, endHeadingDeg: +((end.h * 180) / Math.PI).toFixed(2) }
    );
  }

  // ---------------------------------------------------------------------------------------
  // 6. Striking a wall at a glancing angle slides along it instead of sticking
  // ---------------------------------------------------------------------------------------
  const wall = await page.evaluate(() => {
    const g = window.game;
    const solids = g.solidsHere();
    // Find a solid edge east of Broad Street: step east from the kerb until something is solid
    let wallX = null;
    for (let x = 8; x < 40; x += 0.25) {
      if (solids.at(x, 30, 1.2)) {
        wallX = x;
        break;
      }
    }
    if (wallX === null) return { wallX };
    const r = window.__drive({ x: wallX - 3, z: 30, heading: 0.35, speed: 8, holdSpeed: 8 }, 3, 1 / 60, () => ({}));
    const end = r[r.length - 1];
    return { wallX, travelledZ: end.z - 30, endX: end.x, inside: solids.at(end.x, end.z, 0.2), speed: end.s };
  });
  check(
    'steering: a car driven into a building at a glancing angle slides along it (keeps moving, never ends up inside)',
    wall.wallX !== null && wall.travelledZ > 6 && !wall.inside,
    wall
  );

  // ---------------------------------------------------------------------------------------
  // 7. Real keys through the running game
  // ---------------------------------------------------------------------------------------
  await page.evaluate((LANE) => {
    const v = window.game.player.currentVehicle;
    v.mesh.position.set(LANE, 0, -100);
    v.mesh.rotation.y = 0;
    v.currentSpeed = 0;
    v.steerInput = 0;
  }, LANE);
  await page.bringToFront();
  await page.keyboard.down('ArrowUp');
  // However slowly this machine draws, the car should be on its way within a few seconds
  const started = Date.now();
  while (Date.now() - started < 12000) {
    await wait(250);
    if (await page.evaluate(() => window.game.player.currentVehicle.mesh.position.z > -90)) break;
  }
  await page.keyboard.up('ArrowUp');
  const keyed = await page.evaluate((LANE) => {
    const v = window.game.player.currentVehicle;
    return { z: v.mesh.position.z, x: v.mesh.position.x, speed: v.currentSpeed, off: v.mesh.position.x - LANE };
  }, LANE);
  keyed.seconds = (Date.now() - started) / 1000;
  check('steering: holding the real up-arrow key drives the car forward down its lane', keyed.z > -90 && Math.abs(keyed.off) < 0.3, keyed);

  check('steering: no errors in the page', log.errors.length === 0, log.errors.slice(0, 5));
  await ctx.close();
}
