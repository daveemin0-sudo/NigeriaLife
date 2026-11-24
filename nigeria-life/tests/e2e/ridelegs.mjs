// Car seating: in a taxi and the player's own car, the live driver and passenger keep their feet
// on the cabin floor (not through it), knees clear of the dash and the seat in front, the driver's
// hands on the wheel as it turns, and the passenger hidden inside but seen outside in their own clothes.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { open, newPlayer, closeDialogs, advance, playUntil, wait } from './lib.mjs';

const SHOTS = path.join(path.dirname(fileURLToPath(import.meta.url)), 'ridelegs-shots');
fs.mkdirSync(SHOTS, { recursive: true });

const MODES = [
  { mode: 'taxi', label: 'taxi' },
  { mode: 'car', label: 'own car' },
];

async function waitLive(page, who) {
  return playUntil(page, (w) => {
    const r = window.game.roadRideExperience;
    const v = r.ride;
    if (!v) return null;
    const root = w === 'driver' ? v.driver.root : v.passenger;
    let live = false;
    root.traverse((o) => { if (o.isSkinnedMesh && o.visible && !o.name.startsWith('LOD_')) live = true; });
    return live ? true : null;
  }, 25, who);
}

async function inspect(page, label) {
  return page.evaluate(async (tag) => {
    const g = window.game;
    const THREE = g.modules.THREE;
    const r = g.roadRideExperience;
    const v = r.ride;
    const cabin = v.cabin;
    const floorY = cabin.floorY;
    const dashBack = cabin.dashBack;
    const body = v.body;

    const shown = (o) => {
      for (let p = o; p; p = p.parent) if (!p.visible) return false;
      return true;
    };

    const measure = (root) => {
      body.updateMatrixWorld(true);
      root.updateMatrixWorld(true);
      const inv = body.matrixWorld.clone().invert();
      const vec = new THREE.Vector3();
      const local = new THREE.Vector3();
      let minY = Infinity, maxY = -Infinity, minZ = Infinity, maxZ = -Infinity, minX = Infinity, maxX = -Infinity, count = 0;
      root.traverse((o) => {
        if (!o.isSkinnedMesh || !shown(o) || o.name.startsWith('LOD_')) return;
        o.skeleton?.update();
        const n = o.geometry?.attributes?.position?.count ?? 0;
        for (let i = 0; i < n; i++) {
          o.getVertexPosition(i, vec);
          local.copy(vec).applyMatrix4(inv);
          minY = Math.min(minY, local.y); maxY = Math.max(maxY, local.y);
          minZ = Math.min(minZ, local.z); maxZ = Math.max(maxZ, local.z);
          minX = Math.min(minX, local.x); maxX = Math.max(maxX, local.x);
          count++;
        }
      });
      return { minY, maxY, minZ, maxZ, minX, maxX, count };
    };

    const boneLocal = (root, name) => {
      const b = root.getObjectByName(name);
      if (!b || !shown(b)) return null;
      const p = new THREE.Vector3();
      b.getWorldPosition(p);
      body.worldToLocal(p);
      return { x: +p.x.toFixed(3), y: +p.y.toFixed(3), z: +p.z.toFixed(3) };
    };

    // Live figures only — the baked fallback under the seat also has foot bones, and stays hidden
    const driverLive = v.driver.root.getObjectByName('ride driver') ?? v.driver.root;
    const passLive = v.passenger.getObjectByName('ride passenger') ?? v.passenger;

    // Advance a little with the wheel turned so gripError is measured under motion
    let worstGrip = 0;
    for (let i = 0; i < 30; i++) {
      await g.advance(0.05);
      worstGrip = Math.max(worstGrip, v.gripError ?? 1);
    }

    const driverMesh = measure(driverLive);
    const passengerMesh = measure(passLive);
    const seatD = v.driver.root.position;
    const seatP = v.passenger.position;
    const feet = {
      driverL: boneLocal(driverLive, 'foot_l'),
      driverR: boneLocal(driverLive, 'foot_r'),
      passL: boneLocal(passLive, 'foot_l'),
      passR: boneLocal(passLive, 'foot_r'),
    };
    const knees = {
      driverL: boneLocal(driverLive, 'calf_l'),
      driverR: boneLocal(driverLive, 'calf_r'),
      passL: boneLocal(passLive, 'calf_l'),
      passR: boneLocal(passLive, 'calf_r'),
    };

    // Live characters under the ride (skinned roots named ride driver / ride passenger)
    let live = 0;
    v.body.traverse((o) => { if (o.name === 'ride driver' || o.name === 'ride passenger') live++; });

    g.renderer.info.reset();
    g.renderer.render(g.scene, r.rideCamera);
    const draws = g.renderer.info.render.calls;
    const tris = g.renderer.info.render.triangles;

    // Passenger clothes: live figure present, and the player's outfit pieces show on it
    const cfg = g.player.config;
    let garments = 0;
    v.passenger.traverse((o) => {
      if (!o.isSkinnedMesh || !o.visible) return;
      if (/Outfit_|Cloth_|Shoes|Hat|Body/.test(o.name)) garments++;
    });

    return {
      tag,
      floorY,
      dashBack,
      seatD: { x: +seatD.x.toFixed(3), y: +seatD.y.toFixed(3), z: +seatD.z.toFixed(3) },
      seatP: { x: +seatP.x.toFixed(3), y: +seatP.y.toFixed(3), z: +seatP.z.toFixed(3) },
      driverMesh: {
        minY: +driverMesh.minY.toFixed(3), maxY: +driverMesh.maxY.toFixed(3),
        minZ: +driverMesh.minZ.toFixed(3), maxZ: +driverMesh.maxZ.toFixed(3),
        minX: +driverMesh.minX.toFixed(3), maxX: +driverMesh.maxX.toFixed(3), count: driverMesh.count,
      },
      passengerMesh: {
        minY: +passengerMesh.minY.toFixed(3), maxY: +passengerMesh.maxY.toFixed(3),
        minZ: +passengerMesh.minZ.toFixed(3), maxZ: +passengerMesh.maxZ.toFixed(3),
        minX: +passengerMesh.minX.toFixed(3), maxX: +passengerMesh.maxX.toFixed(3), count: passengerMesh.count,
      },
      feet, knees,
      worstGrip: +worstGrip.toFixed(3),
      live,
      draws, tris,
      garments,
      gender: cfg.gender,
      skinTone: cfg.skinTone,
    };
  }, label);
}

async function shot(page, name) {
  const dataUrl = await page.evaluate(() => {
    const g = window.game;
    g.renderer.render(g.scene, g.roadRideExperience.rideCamera);
    return g.renderer.domElement.toDataURL('image/jpeg', 0.85);
  });
  fs.writeFileSync(path.join(SHOTS, `${name}.jpg`), Buffer.from(dataUrl.split(',')[1], 'base64'));
}

export async function run(browser, check) {
  const ctx = await newPlayer(browser);
  const { page, log } = await open(ctx);
  await closeDialogs(page);
  const owned = await page.evaluate(async () => {
    const g = window.game;
    g.world.skyEnvironment.setHour(12);
    const b = g.hud.backend; b.data.bank.balance += 200_000_000; b.data.walletCash += 80_000; b.saveData();
    const bought = await g.garage.buyNew('lexus_rx');
    return { bought, own: g.ownedVehicles?.ownCar?.() ?? null };
  });
  const ownReady = owned.own ?? await playUntil(page, () => {
    const car = window.game.ownedVehicles?.ownCar?.();
    return car ? { body: car.body, name: car.name } : null;
  }, 10);
  check('ridelegs: the player has their own car for the car ride', !!ownReady, { owned, ownReady });
  await wait(400);

  const reports = [];

  for (const { mode, label } of MODES) {
    const booked = await page.evaluate((m) => {
      const g = window.game;
      const place = g.rides.destinations().find((d) => d.transportAvailability.some((o) => o.mode === 'taxi'));
      if (!place) return { ok: false, reason: 'no place' };
      if (m === 'car' && !g.ownedVehicles?.ownCar?.()) return { ok: false, reason: 'no own car' };
      return { ...g.rides.book(place.id, m), place: place.id };
    }, mode);
    const started = await playUntil(page, () => (window.game.roadRideExperience.isActive ? true : null), 20);
    if (!booked.ok || !started) {
      check(`ridelegs: a ${label} can be booked and the ride starts`, false, { booked, started });
      continue;
    }
    await page.evaluate(() => { window.game.roadRideExperience.totalDuration = 180; });
    await advance(page, 0.5);
    const driverLive = await waitLive(page, 'driver');
    const passLive = await waitLive(page, 'passenger');
    check(`ridelegs: the ${label} has a live driver and a live passenger`, !!driverLive && !!passLive, { driverLive, passLive });

    // Pose a moment so IK settles
    await page.evaluate(async () => { for (let i = 0; i < 20; i++) await window.game.advance(0.05); });

    await page.evaluate(() => window.game.roadRideExperience.setCameraView('side'));
    await advance(page, 0.2);
    const beforeHide = await page.evaluate(() => {
      const g = window.game;
      g.renderer.info.reset();
      g.renderer.render(g.scene, g.roadRideExperience.rideCamera);
      return { draws: g.renderer.info.render.calls, tris: g.renderer.info.render.triangles };
    });

    const data = await inspect(page, label);
    reports.push({ label, ...data, sideDraws: beforeHide.draws, sideTris: beforeHide.tris });

    const tol = 0.02;
    const floorOk = data.driverMesh.minY >= data.floorY - tol && data.passengerMesh.minY >= data.floorY - tol;
    check(`ridelegs: in the ${label}, no driver or passenger vertex is below the cabin floor`, floorOk, {
      floorY: data.floorY, driverMinY: data.driverMesh.minY, passengerMinY: data.passengerMesh.minY, tol,
    });

    const footIn = (f, seat) => f && f.y >= data.floorY - tol && f.y < seat.y + 0.15 && f.z > seat.z + 0.05
      && Math.abs(f.x - seat.x) < 0.45;
    const feetOk = footIn(data.feet.driverL, data.seatD) && footIn(data.feet.driverR, data.seatD)
      && footIn(data.feet.passL, data.seatP) && footIn(data.feet.passR, data.seatP);
    check(`ridelegs: in the ${label}, both feet of each person are inside the cabin and in front of their seat`, feetOk, data.feet);

    const kneeClear = (k, isDriver) => {
      if (!k) return false;
      if (isDriver) return k.z < data.dashBack - 0.02 && k.y > data.floorY + 0.08;
      // Passenger: knee behind the front seat back (driver hip minus cushion)
      return k.z < data.seatD.z - 0.2 && k.y > data.floorY + 0.08;
    };
    const kneesOk = kneeClear(data.knees.driverL, true) && kneeClear(data.knees.driverR, true)
      && kneeClear(data.knees.passL, false) && kneeClear(data.knees.passR, false);
    check(`ridelegs: in the ${label}, no knee passes through the dashboard or the seat in front`, kneesOk, data.knees);

    check(`ridelegs: in the ${label}, the driver's hands stay on the wheel while it turns`, data.worstGrip < 0.06, { gripError: data.worstGrip });

    // Camera visibility of the passenger
    const views = {};
    for (const view of ['inside', 'chase', 'side']) {
      await page.evaluate((v) => window.game.roadRideExperience.setCameraView(v), view);
      await advance(page, 0.25);
      views[view] = await page.evaluate(() => {
        const r = window.game.roadRideExperience;
        const v = r.ride;
        let liveShown = false;
        v.passenger.traverse((o) => {
          if (!o.isSkinnedMesh || o.name.startsWith('LOD_')) return;
          let shown = o.visible;
          for (let p = o.parent; p && shown; p = p.parent) if (!p.visible) shown = false;
          if (shown) liveShown = true;
        });
        window.game.renderer.info.reset();
        window.game.renderer.render(window.game.scene, r.rideCamera);
        return { passengerGroup: v.passenger.visible, liveShown, calls: window.game.renderer.info.render.calls };
      });
      await shot(page, `${mode}-${view}`);
    }
    check(`ridelegs: in the ${label}, the passenger is hidden in the inside view`, !views.inside.passengerGroup && !views.inside.liveShown, views.inside);
    check(`ridelegs: in the ${label}, the passenger is visible in chase and side views in the player's clothes`,
      views.chase.liveShown && views.side.liveShown && data.garments > 0, { chase: views.chase, side: views.side, garments: data.garments });

    check(`ridelegs: the ${label} ride adds at most one extra live character (driver + passenger) and stays under 220 draws`,
      data.live <= 2 && Object.values(views).every((v) => v.calls < 220), { live: data.live, calls: Object.fromEntries(Object.entries(views).map(([k, v]) => [k, v.calls])), draws: data.draws, tris: data.tris });

    // Close side view with the car body shell hidden so legs can be judged
    await page.evaluate(() => {
      const v = window.game.roadRideExperience.ride;
      window.game.roadRideExperience.setCameraView('side');
      v.body.traverse((o) => {
        if (o.name === 'car body' || o.name === 'cabin') o.visible = false;
      });
    });
    await advance(page, 0.2);
    await shot(page, `${mode}-legs-xray`);
    await page.evaluate(() => {
      const v = window.game.roadRideExperience.ride;
      v.body.traverse((o) => { if (o.name === 'car body' || o.name === 'cabin') o.visible = true; });
    });

    await page.evaluate(() => window.game.roadRideExperience.skipRide());
    await playUntil(page, () => (!window.game.roadRideExperience.isActive && !window.game.rides.ride ? true : null), 20);
    await closeDialogs(page);
  }

  // Print draw/triangle report for the acceptance write-up
  for (const r of reports) {
    console.log(`ridelegs report [${r.label}]: live=${r.live} side draws=${r.sideDraws} tris=${r.sideTris} grip=${r.worstGrip} driverMinY=${r.driverMesh.minY} passMinY=${r.passengerMesh.minY}`);
  }

  // Optional GLBs are not in this checkout; procedural fallbacks cover them
  const realErrors = log.errors.filter((e) => !/\/models\/(vehicles|aircraft)\/.*\.(glb|gltf)/i.test(e));
  check('ridelegs: no errors in the page', realErrors.length === 0, realErrors.slice(0, 5));
  await ctx.close();
}
