// Nothing in the street is see-through: a person on foot is stopped by parked cars, lamp posts
// and other people, and walkers step round someone standing in their way; a car being driven is
// stopped by other cars and by people, and a horn sends the people ahead to the side.
import { open, newPlayer, closeDialogs, wait } from './lib.mjs';

export async function run(browser, check) {
  const ctx = await newPlayer(browser);
  const { page, log } = await open(ctx);
  await closeDialogs(page);
  await page.evaluate(() => {
    const g = window.game;
    g.world.skyEnvironment.setHour(12);
    // In the car's own frame: how far (x, z) is across it and along it
    window.__local = (car, x, z) => {
      const c = Math.cos(car.yaw), s = Math.sin(car.yaw);
      const dx = x - car.x, dz = z - car.z;
      return { side: dx * c - dz * s, along: dx * s + dz * c };
    };
    window.__into = (car, x, z, r) => {
      const l = window.__local(car, x, z);
      const a = car.halfWidth + r - Math.abs(l.side), b = car.halfLength + r - Math.abs(l.along);
      return a > 0 && b > 0 ? Math.min(a, b) : 0;
    };
  });
  await wait(500);

  // 1. Walking into a parked car
  await closeDialogs(page);
  const parked = await page.evaluate(async () => {
    const g = window.game;
    const ts = g.world.trafficSpawner;
    const solids = g.solidsHere();
    const out = [];
    ts.cars(0, 0, 400, out);
    const parkedSet = ts.parked.map((p) => `${p.x.toFixed(2)},${p.z.toFixed(2)}`);
    const cars = out.filter((c) => parkedSet.includes(`${c.x.toFixed(2)},${c.z.toFixed(2)}`)).map((c) => ({ ...c }));
    for (const car of cars) {
      // Stand 2.5 m off its side, on open ground
      for (const sign of [1, -1]) {
        const off = car.halfWidth + 2.5;
        const x = car.x + Math.cos(car.yaw) * off * sign;
        const z = car.z - Math.sin(car.yaw) * off * sign;
        if (solids.at(x, z, 0.5)) continue;
        return { car, x, z };
      }
    }
    return null;
  });
  check('bodies: there is a parked car with open ground beside it', !!parked, parked);
  if (parked) {
    await page.evaluate((p) => {
      const g = window.game;
      g.player.stopMoving();
      g.player.mesh.position.set(p.x, 0.28, p.z);
      g.player.setDestination(new (g.player.mesh.position.constructor)(p.car.x, 0.28, p.car.z));
    }, parked);
    await wait(3500);
    const r = await page.evaluate((p) => {
      const pos = window.game.player.position;
      return { into: +window.__into(p.car, pos.x, pos.z, 0.3).toFixed(3), local: window.__local(p.car, pos.x, pos.z) };
    }, parked);
    check('bodies: walking at a parked car stops at its side; the player does not go into it', r.into < 0.05, r);
  }

  // 2. Walking into a lamp post
  const pole = await page.evaluate(() => {
    const g = window.game;
    const solids = g.solidsHere();
    for (const p of g.world.cityDensity.fabric.poles) {
      for (const [dx, dz] of [[2.2, 0], [-2.2, 0], [0, 2.2], [0, -2.2]]) {
        const x = p.x + dx, z = p.z + dz;
        let clear = true;
        for (let t = 0.25; t <= 1; t += 0.05) if (solids.at(p.x + dx * t, p.z + dz * t, 0.32)) clear = false;
        if (clear) return { pole: p, x, z, solid: solids.at(p.x, p.z, 0) };
      }
    }
    return null;
  });
  check('bodies: street lamp posts are solid', !!pole && pole.solid, pole);
  if (pole) {
    await closeDialogs(page);
    await page.evaluate((p) => {
      const g = window.game;
      g.player.stopMoving();
      g.player.mesh.position.set(p.x, 0.28, p.z);
      // Straight at it, with no way round worked out: a pole is met, not routed round
      g.player.targetPosition = new (g.player.mesh.position.constructor)(p.pole.x, 0.28, p.pole.z);
      g.player.isMoving = true;
      g.player.nearest = Infinity;
      g.player.sinceNearer = 0;
    }, pole);
    await wait(2500);
    const d = await page.evaluate((p) => Math.hypot(window.game.player.position.x - p.pole.x, window.game.player.position.z - p.pole.z), pole);
    check('bodies: walking straight at a lamp post brings the player up against it, and no further', d >= 0.4 && d < 0.75, { distance: +d.toFixed(2) });
  }

  // 3. Walking into a person waiting at the bus stop
  const queuer = await page.evaluate(() => {
    const g = window.game;
    const crowd = g.world.cityPopulation;
    const solids = g.solidsHere();
    const i = crowd.agents.findIndex((a) => a.stop !== undefined && !a.away && a.mode === 'idle');
    if (i < 0) return null;
    const a = crowd.agents[i];
    for (const [dx, dz] of [[0, 3], [0, -3], [3, 0], [-3, 0]]) if (!solids.at(a.x + dx, a.z + dz, 0.5)) return { i, x: a.x, z: a.z, from: { x: a.x + dx, z: a.z + dz } };
    return null;
  });
  check('bodies: someone is queueing at a bus stop', !!queuer, queuer);
  if (queuer) {
    await page.evaluate((q) => {
      const g = window.game;
      g.player.stopMoving();
      g.player.mesh.position.set(q.from.x, 0.28, q.from.z);
      g.player.targetPosition = new (g.player.mesh.position.constructor)(q.x, 0.28, q.z);
      g.player.isMoving = true;
      g.player.nearest = Infinity;
      g.player.sinceNearer = 0;
    }, queuer);
    let nearest = Infinity;
    for (let i = 0; i < 25; i++) {
      await wait(100);
      const d = await page.evaluate(() => {
        const g = window.game;
        const out = [];
        g.world.cityPopulation.people(g.player.position.x, g.player.position.z, 3, out);
        return Math.min(9, ...out.map((p) => Math.hypot(p.x - g.player.position.x, p.z - g.player.position.z)));
      });
      nearest = Math.min(nearest, d);
    }
    check('bodies: walking into someone at the bus stop: the player never goes through them (stays 0.45 m or more from everyone)', nearest >= 0.45, { nearest: +nearest.toFixed(2) });
  }

  // 4. Walkers going along Broad Street step round the player standing in their way
  const standing = await page.evaluate(async () => {
    const g = window.game;
    const crowd = g.world.cityPopulation;
    const w = crowd.agents.find((a) => a.mode === 'walk' && a.onMainWalk && a.axis === 'z' && !a.away);
    if (!w) return null;
    // Two metres ahead of them, on their line
    g.player.stopMoving();
    g.player.mesh.position.set(w.x, 0.28, w.z + w.dir * 2.5);
    return { x: w.x, z: w.z };
  });
  if (standing) {
    let nearest = Infinity;
    for (let i = 0; i < 40; i++) {
      await wait(100);
      const d = await page.evaluate(() => {
        const g = window.game;
        const out = [];
        g.world.cityPopulation.people(g.player.position.x, g.player.position.z, 3, out);
        return Math.min(9, ...out.map((p) => Math.hypot(p.x - g.player.position.x, p.z - g.player.position.z)));
      });
      nearest = Math.min(nearest, d);
    }
    check('bodies: a walker coming along the pavement steps round the player standing there (nobody walks through them)', nearest >= 0.45, { nearest: +nearest.toFixed(2) });
  }

  // 5. Driving into a parked car, and into people, and the horn
  const drive = await page.evaluate(async () => {
    const g = window.game;
    const veh = g.world.vehicles.drivableVehicles.find((v) => v.type === 'sedan');
    g.player.stopMoving();
    g.player.mesh.position.copy(veh.mesh.position);
    g.enterVehicle(veh);
    const v = g.player.currentVehicle;
    const V = v.constructor;
    const ts = g.world.trafficSpawner;
    const out = [];
    ts.cars(0, 0, 400, out);
    const parkedSet = ts.parked.map((p) => `${p.x.toFixed(2)},${p.z.toFixed(2)}`);
    const solids = g.solidsHere();
    const cars = out.filter((c) => parkedSet.includes(`${c.x.toFixed(2)},${c.z.toFixed(2)}`)).map((c) => ({ ...c }));
    // Behind a parked car, on clear ground, heading straight at it
    let setup = null;
    for (const car of cars) {
      const back = car.halfLength + 7;
      const x = car.x - Math.sin(car.yaw) * back, z = car.z - Math.cos(car.yaw) * back;
      let clear = true;
      for (let t = 0; t <= 1; t += 0.1) if (solids.at(car.x - Math.sin(car.yaw) * back * t * 0.8 - Math.sin(car.yaw) * back * 0.2, car.z - Math.cos(car.yaw) * back * t * 0.8 - Math.cos(car.yaw) * back * 0.2, 1.2)) clear = false;
      const others = [];
      ts.cars(x, z, 6, others);
      if (clear && others.length === 0) { setup = { car, x, z }; break; }
    }
    if (!setup) return { ok: false };
    v.mesh.position.set(setup.x, 0, setup.z);
    v.mesh.rotation.y = setup.car.yaw;
    v.currentSpeed = 6;
    v.velocityDirection.set(Math.sin(setup.car.yaw), Math.cos(setup.car.yaw));
    const savedRoads = V.roads;
    V.roads = null;
    for (let i = 0; i < 240; i++) v.update(1 / 60, { w: true });
    V.roads = savedRoads;
    const me = { x: 0, z: 0, yaw: 0, halfWidth: 0, halfLength: 0 };
    // The driven car's box, from the game's own measure
    const { x, z } = v.mesh.position;
    const along = window.__local(setup.car, x, z).along;
    return { ok: true, speed: +v.currentSpeed.toFixed(2), gapAlong: +(Math.abs(along) - setup.car.halfLength).toFixed(2), toast: document.getElementById('game-toast-container')?.innerText ?? document.body.innerText.match(/Motor dey your front[^\n]*/)?.[0] ?? null };
  });
  check('bodies: a car driven at a parked car stops behind it, and the driver is told to reverse or go round', drive.ok && drive.gapAlong > 1.5 && drive.speed === 0 && /Motor dey your front/.test(drive.toast ?? ''), drive);

  const horn = await page.evaluate(async () => {
    const g = window.game;
    const v = g.player.currentVehicle;
    const crowd = g.world.cityPopulation;
    // Put the car on Broad Street facing a bus stop queue from 7 m, then hoot
    const i = crowd.agents.findIndex((a) => a.stop !== undefined && !a.away && a.mode === 'idle');
    const a = crowd.agents[i];
    const heading = Math.PI / 2 * (a.x > 0 ? 1 : -1);
    v.mesh.position.set(a.x - Math.sin(heading) * 7, 0, a.z);
    v.mesh.rotation.y = heading;
    v.currentSpeed = 0;
    const lateral = () => Math.abs((a.z + (a.oz ?? 0)) - a.z);
    const before = lateral();
    v.honk();
    return { i, before, heading };
  });
  await wait(1500);
  const afterHorn = await page.evaluate((h) => {
    const a = window.game.world.cityPopulation.agents[h.i];
    return { moved: +Math.hypot(a.ox ?? 0, a.oz ?? 0).toFixed(2), told: /comot|jam me|dey pass|horn sef|road dey/.test(document.body.innerText) };
  }, horn);
  check('bodies: a horn sends the person in front of the car to the side, and they say so', afterHorn.moved > 0.8 && afterHorn.told, afterHorn);

  check('bodies: no errors in the page', log.errors.length === 0, log.errors.slice(0, 5));
}
