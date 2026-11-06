// The road as a driver meets it: traffic keeps to the right and stops at red whoever is near,
// cars parked by the expressway stand in lay-bys off the road, a horn makes the car in front
// hurry on or move over, the road assist keeps to the lanes the traffic drives in, a supercar
// at full speed cannot go into or through a building, it holds a bend like a driving game's
// car, the chase camera keeps up with it, and in a room the mouse moves the body, not the view.
//
// The vehicle and the traffic are stepped directly inside page.evaluate, so the game loop does
// not run in between and the numbers are exact; the last checks use the real mouse.
import { open, newPlayer, closeDialogs, wait, enterInterior } from './lib.mjs';

export async function run(browser, check) {
  const ctx = await newPlayer(browser);
  const { page, log } = await open(ctx);
  await closeDialogs(page);
  await page.evaluate(() => window.game.world.skyEnvironment.setHour(12));

  // ------------------------------------------------------------------ Every lane on the right-hand side
  const sides = await page.evaluate(() => {
    const lanes = window.game.world.trafficSpawner.lanes;
    // Going +z the driver's right is -x; going +x it is +z (Martins Street runs along x at z = -62)
    const wrong = lanes.filter((l) => (l.axis === 'z' ? Math.sign(l.fixed) !== -l.dir : Math.sign(l.fixed + 62) !== l.dir)).map((l) => `${l.axis} ${l.fixed} ${l.dir}`);
    return { lanes: lanes.length, wrong };
  });
  check('roads: every lane of traffic (Broad Street, the expressway, Martins Street) drives on the right-hand side', sides.lanes >= 10 && sides.wrong.length === 0, sides);

  // ------------------------------------------------------------------ The lights run whoever is near, and red holds the traffic
  const lights = await page.evaluate(() => {
    const g = window.game;
    const t = g.world.trafficSpawner;
    t.abroad = 1;
    // On foot in the middle of Broad Street by the junction (where the lights used to be held green for the player)
    g.player.stopMoving();
    g.player.mesh.position.set(0, 0, -55);
    const at = g.player.mesh.position;
    const seen = new Set();
    let crossGo = null;
    for (let s = 0; s < 80; s += 0.1) {
      t.signalTime = s;
      const main = t.signalState('main');
      const cross = t.signalState('cross');
      seen.add(`${main}/${cross}`);
      if (crossGo === null && cross === 'go') crossGo = s;
    }
    if (crossGo === null) return { seen: [...seen] };
    // Just after Martins Street gets its green: Broad Street is on red for the next ten seconds
    t.signalTime = crossGo + 0.1;
    const main = t.lanes.filter((l) => l.axis === 'z' && l.stops.length);
    const waiting = [];
    for (const lane of main) {
      const stop = lane.stops[0].u;
      for (const car of lane.cars) {
        const front = car.u + car.length / 2;
        // Those that were already too close to stop when it changed (let through) are left out
        if (front <= stop + 0.1 && !car.committed) waiting.push({ lane, car, stop });
      }
    }
    const cross = t.lanes.filter((l) => l.axis === 'x');
    const before = new Map(cross.flatMap((l) => l.cars.map((c) => [c, c.u])));
    for (let i = 0; i < 300; i++) t.update(1 / 30, at);
    const ranRed = waiting.filter(({ car, stop }) => car.u + car.length / 2 > stop + 0.7).length;
    const stillMain = t.signalState('main');
    // Martins Street traffic went over the junction on its green
    const crossed = cross.flatMap((l) => l.cars.filter((c) => before.has(c) && before.get(c) < -14 && c.u > 0)).length;
    return { seen: [...seen], waiting: waiting.length, ranRed, stillMain, crossed };
  });
  check('roads: with the player standing at the junction the lights still change: Broad Street gets red and Martins Street green in turn',
    lights.seen?.includes('stop/go') && lights.seen?.includes('go/stop'), lights);
  check('roads: on red, not one Broad Street car waiting at the line goes over it, while Martins Street traffic crosses on its green',
    lights.waiting > 4 && lights.ranRed === 0 && lights.stillMain === 'stop' && lights.crossed > 0, lights);

  // ------------------------------------------------------------------ Parked by the expressway: in a lay-by, off the road
  const bays = await page.evaluate(() => {
    const obs = window.game.world.expressway.obstructions;
    const cars = obs.filter((o) => o.owner === 'Parked car');
    const posts = obs.filter((o) => o.owner === 'Lay-by shade post');
    const onRoad = cars.filter((o) => Math.min(Math.abs(o.minX), Math.abs(o.maxX)) < 11);
    const shaded = cars.filter((o) => posts.some((p) => Math.abs((p.minZ + p.maxZ) / 2 - (o.minZ + o.maxZ) / 2) < 3 && Math.sign(p.minX) === Math.sign(o.minX)));
    return { cars: cars.length, onRoad: onRoad.length, shaded: shaded.length };
  });
  check('roads: the cars parked along the expressway stand in lay-bys cut into the pavement, none on the road, each with a bench under a shade',
    bays.cars > 5 && bays.onRoad === 0 && bays.shaded === bays.cars, bays);

  // ------------------------------------------------------------------ Into the supercar
  const ready = await page.evaluate(() => {
    const g = window.game;
    const veh = g.world.vehicles.drivableVehicles.find((v) => v.type === 'sports_car');
    if (!veh) return { ok: false };
    g.player.stopMoving();
    g.player.mesh.position.copy(veh.mesh.position);
    g.enterVehicle(veh);
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
      V.ignoreBodies = setup.bodies !== true;
      const out = [];
      let next = 0;
      const steps = Math.round(seconds / dt);
      for (let i = 0; i <= steps; i++) {
        const t = i * dt;
        if (setup.camera) g.cameraManager.update(g.player, dt);
        if (t >= next - 1e-9) {
          const cam = g.cameraManager.camera.position;
          out.push({ t, x: v.mesh.position.x, z: v.mesh.position.z, h: v.mesh.rotation.y, s: v.currentSpeed, cam: Math.hypot(cam.x - v.mesh.position.x, cam.z - v.mesh.position.z) });
          next += sample;
        }
        if (setup.holdSpeed !== undefined) v.currentSpeed = setup.holdSpeed;
        v.update(dt, keysAt(t));
      }
      V.solids = savedSolids;
      V.ignoreBodies = false;
      return out;
    };
    return { ok: g.player.isDriving, top: veh.config.maxSpeed };
  });
  check('roads: the player is at the wheel of a supercar', ready.ok, ready);
  if (!ready.ok) return;

  // ------------------------------------------------------------------ The horn: the okada or car in front hurries on, or moves over
  const horn = await page.evaluate(() => {
    const g = window.game;
    const t = g.world.trafficSpawner;
    t.abroad = 1;
    const lane = t.lanes.find((l) => l.axis === 'z' && l.fixed === -1.8 && l.dir === 1);
    // A vehicle on the Third Mainland Bridge in the fast lane, with open road in front of it
    let pick = null;
    let best = 0;
    for (let i = 1; i < lane.cars.length; i++) {
      const car = lane.cars[i];
      const ahead = lane.cars[i - 1];
      const gap = ahead.u - ahead.length / 2 - (car.u + car.length / 2);
      if (car.u > 1400 && car.u < 2400 && gap > 30 && gap > best) {
        pick = car;
        best = gap;
      }
    }
    if (!pick) return { found: false };
    const v = g.player.currentVehicle;
    const speed = Math.max(6, pick.v);
    v.mesh.position.set(-1.8, 0, pick.u - pick.length / 2 - 9);
    v.mesh.rotation.y = 0;
    v.currentSpeed = speed;
    const before = { v: +pick.v.toFixed(1), aside: pick.aside ?? 0, gap: Math.round(best) };
    v.honk();
    const heard = pick.hooted ?? 0;
    let fastest = pick.v;
    for (let i = 0; i < 90; i++) {
      v.mesh.position.z += speed / 30;
      t.update(1 / 30, v.mesh.position);
      fastest = Math.max(fastest, pick.v);
    }
    return { found: true, heard, before, after: { fastest: +fastest.toFixed(1), aside: +(pick.aside ?? 0).toFixed(2) } };
  });
  check('roads: hooting at a vehicle in the fast lane with free road in front of it makes it hurry on and move over toward the kerb',
    horn.found && horn.heard > 0 && horn.after.fastest > horn.before.v + 1 && horn.after.aside > 0.8, horn);

  // ------------------------------------------------------------------ The road assist keeps to the lanes the traffic drives in
  const assist = await page.evaluate(() => window.__drive({ x: -8.6, z: 400, heading: 0, speed: 35, holdSpeed: 35 }, 7, 1 / 60, () => ({})));
  const assistEnd = assist[assist.length - 1];
  check('roads: let go in the outer lane of the expressway, the assist settles the car on that lane line (8.0 m out, where the traffic drives), clear of the lay-bys',
    Math.abs(assistEnd.x + 8.0) < 0.3, { endX: +assistEnd.x.toFixed(2), endHeadingDeg: +((assistEnd.h * 180) / Math.PI).toFixed(2) });

  // ------------------------------------------------------------------ Full throttle at a building: never in it, never through it
  const wall = await page.evaluate(() => {
    const solids = window.game.solidsHere();
    for (let x = 8; x < 40; x += 0.1) if (solids.at(x, 30, 0)) return x;
    return null;
  });
  if (wall !== null) {
    const crashes = [];
    for (const dt of [1 / 15, 1 / 60]) {
      for (const heading of [Math.PI / 2, Math.PI / 2 - 0.5, Math.PI / 2 + 0.5]) {
        const r = await page.evaluate(
          (wall, dt, heading) => {
            const g = window.game;
            const solids = g.solidsHere();
            const v = g.player.currentVehicle;
            const out = window.__drive({ x: 0, z: 30 - Math.cos(heading) * 10, heading, speed: 55 }, 3, dt, () => ({ arrowup: true }), dt);
            const half = 2.2;
            let deepest = -Infinity;
            let inside = 0;
            // Every frame, and every point on the way between frames, nose and middle: never in anything solid
            for (let i = 0; i < out.length; i++) {
              const p = out[i];
              const q = out[Math.max(0, i - 1)];
              for (let k = 0; k <= 8; k++) {
                const x = q.x + ((p.x - q.x) * k) / 8;
                const z = q.z + ((p.z - q.z) * k) / 8;
                const noseX = x + Math.sin(p.h) * half;
                const noseZ = z + Math.cos(p.h) * half;
                if (solids.at(x, z, 0.2) || solids.at(noseX, noseZ, 0.2)) inside += 1;
                if (Math.abs(z - 30) < 1.5) deepest = Math.max(deepest, noseX - wall);
              }
            }
            void v;
            const end = out[out.length - 1];
            return { dt: Math.round(1 / dt), headingDeg: Math.round((heading * 180) / Math.PI), deepest: +deepest.toFixed(2), inside, endX: +end.x.toFixed(1), endSpeed: +end.s.toFixed(1) };
          },
          wall,
          dt,
          heading
        );
        crashes.push(r);
      }
    }
    check('roads: a supercar driven flat out at a building, straight on or at an angle, at 15 or 60 frames a second, never goes into it or through it',
      crashes.every((c) => c.inside === 0) && crashes.filter((c) => c.headingDeg === 90).every((c) => c.deepest < 0.35 && c.endX < wall), { wall: +wall.toFixed(1), crashes });
  }

  // ------------------------------------------------------------------ It holds a bend at speed, like a driving game's car
  const bend = await page.evaluate(() => window.__drive({ x: -4.9, z: 1600, heading: 0, speed: 45, holdSpeed: 45, noSolids: true }, 3, 1 / 60, () => ({ arrowleft: true })));
  const late = bend.filter((p) => p.t >= 1.5);
  const rate = (late[late.length - 1].h - late[0].h) / (late[late.length - 1].t - late[0].t);
  const lateral = rate * 45;
  check('roads: on full lock at 45 m/s (162 km/h) the supercar turns a real bend (about two g, a radius under 120 m), not a lazy drift wide',
    lateral > 14 && lateral <= 20.2 && 45 / rate < 120, { lateralG: +(lateral / 9.81).toFixed(2), radius: Math.round(45 / rate) });

  // ------------------------------------------------------------------ The chase camera keeps up at top speed
  const chase = await page.evaluate(() => window.__drive({ x: -4.9, z: 500, heading: 0, speed: 55, holdSpeed: 55, camera: true, noSolids: true }, 4, 1 / 30, () => ({})));
  const far = Math.max(...chase.filter((p) => p.t > 1).map((p) => p.cam));
  check('roads: at 55 m/s the chase camera stays right behind the car (within 15 m), instead of falling back and swinging',
    far < 15, { furthest: +far.toFixed(1) });

  // ------------------------------------------------------------------ In a room the mouse moves the body; the view turns with the right button
  await page.evaluate(() => {
    const g = window.game;
    g.exitVehicle?.();
    // A home to go into: a rented house
    g.world.interiorManager.residence.constructor.briefNow = () => ({ kind: 'house', bedrooms: 3, carport: true });
    const be = g.hud.backend;
    be.rentProperty(be.getData().properties[0].id);
  });
  await wait(300);
  await enterInterior(page, 'residence');
  await wait(1500);
  const vp = page.viewport() ?? { width: 1280, height: 720 };
  const before = await page.evaluate(() => { const g = window.game; return { yaw: g.cameraManager.interiorYaw, x: g.player.position.x, z: g.player.position.z }; });
  const cx = vp.width / 2;
  const cy = vp.height / 2;
  await page.mouse.move(cx + 60, cy + 40);
  await page.mouse.down({ button: 'left' });
  for (let i = 1; i <= 12; i++) {
    await page.mouse.move(cx + 60 + i * 14, cy + 40 + i * 6);
    await wait(60);
  }
  await wait(1200);
  await page.mouse.up({ button: 'left' });
  const afterLeft = await page.evaluate(() => { const g = window.game; return { yaw: g.cameraManager.interiorYaw, x: g.player.position.x, z: g.player.position.z }; });
  const walked = Math.hypot(afterLeft.x - before.x, afterLeft.z - before.z);
  check('roads: in the home, dragging with the left mouse button walks the body after the pointer and leaves the view of the house where it was',
    Math.abs(afterLeft.yaw - before.yaw) < 1e-6 && walked > 0.5, { yawTurned: +(afterLeft.yaw - before.yaw).toFixed(4), walked: +walked.toFixed(2) });
  await page.mouse.move(cx, cy);
  await page.mouse.down({ button: 'right' });
  for (let i = 1; i <= 10; i++) await page.mouse.move(cx + i * 15, cy);
  await page.mouse.up({ button: 'right' });
  const afterRight = await page.evaluate(() => window.game.cameraManager.interiorYaw);
  check('roads: in the home, the view still turns with the right mouse button held and moved', Math.abs(afterRight - afterLeft.yaw) > 0.1, { turned: +(afterRight - afterLeft.yaw).toFixed(3) });

  check('roads: no errors in the page', log.errors.length === 0, log.errors.slice(0, 5));
}
