// What the handover left unfinished or unchecked, as a player would meet it:
// a bought generator stands outside (beside the front of a flat, in the compound of a house);
// a taxi ride in Abuja and Port Harcourt wears that city's shop signs;
// the chase camera stays a steady distance behind the car when frame time jumps, as it does on a phone;
// Port Harcourt's street doors are there; a jet flown from Abuja lands in Lagos.
import { open, newPlayer, closeDialogs, wait, enterInterior } from './lib.mjs';

export async function run(browser, check) {
  const ctx = await newPlayer(browser);
  const { page, log } = await open(ctx);
  await closeDialogs(page);

  await enterInterior(page, 'residence');
  await wait(400);
  const flat = await page.evaluate(() => {
    const g = window.game;
    const decor = g.modules.HouseDecorationSystem.getInstance();
    const plan = g.world.interiorManager.residence.plan;
    const indoors = (x, z) => plan.rooms.some((r) => x > r.minX && x < r.maxX && z > r.minZ && z < r.maxZ)
      || (plan.upper?.rooms ?? []).some((r) => x > r.minX && x < r.maxX && z > r.minZ && z < r.maxZ);
    decor.adopt([{ uid: 'out_mikano', id: 'mikano_gen', x: 0, z: 0, turns: 0 }]);
    decor.adopt([{ uid: 'out_tiger', id: 'tiger_gen', x: 1, z: 1, turns: 0 }]);
    const at = (uid) => decor.placed.find((p) => p.uid === uid);
    const mik = at('out_mikano');
    const tig = at('out_tiger');
    return {
      carport: plan.carport,
      frontZ: plan.frontZ,
      mik: mik && { x: mik.x, z: mik.z, in: indoors(mik.x, mik.z) },
      tig: tig && { x: tig.x, z: tig.z, in: indoors(tig.x, tig.z) },
      apart: mik && tig ? Math.hypot(mik.x - tig.x, mik.z - tig.z) : 0,
    };
  });
  check('generator: in a flat the Mikano and the Tiger stand outside the side wall, not in a room, and not on top of each other',
    flat.carport === false && flat.mik && flat.tig && !flat.mik.in && !flat.tig.in && flat.apart > 2
      && Math.abs(flat.mik.x) > 1 && Math.abs(flat.tig.x) > 1,
    flat);

  const bought = await page.evaluate(() => {
    const g = window.game;
    const decor = g.modules.HouseDecorationSystem.getInstance();
    g.hud.backend.data.bank.balance = 5_000_000;
    decor.beginPlacing('mikano_gen');
    decor.moveTo(0, 0);
    const why = decor.blocked();
    const at = decor.placing ? { x: decor.placing.x, z: decor.placing.z } : null;
    const done = decor.confirm();
    const plan = g.world.interiorManager.residence.plan;
    const placed = decor.placed.filter((p) => p.modelType === 'generator_big');
    const hw = plan.width / 2;
    const outsideOf = (p) => Math.abs(p.x) > hw - 0.05 || p.z > plan.frontZ;
    return { why, at, done, outside: placed.every(outsideOf) };
  });
  check('generator: choosing a Mikano and pointing at the parlour floor still puts it outside, and it can be paid for',
    bought.why === null && bought.done.ok && bought.at && bought.outside, bought);

  await page.evaluate(async () => {
    const g = window.game;
    const rooms = g.world.interiorManager;
    if (rooms.isPlayerInside()) await rooms.exitCurrentInterior(g.player, g.cameraManager, g.hud, g.world);
  });
  await page.evaluate(() => {
    const g = window.game;
    g.hud.backend.data.bank.balance = 80_000_000;
    g.hud.backend.rentProperty('prop_lekki_duplex');
    g.hud.onEnterInterior('residence:prop_lekki_duplex');
  });
  await wait(500);
  const house = await page.evaluate(() => {
    const g = window.game;
    const decor = g.modules.HouseDecorationSystem.getInstance();
    const plan = g.world.interiorManager.residence.plan;
    // The flat's generators come with the player. A house only gains another if a pad is still free.
    const gens = () => decor.placed.filter((p) => p.modelType === 'generator_big' || p.modelType === 'generator_small');
    const taken = gens().some((p) => p.modelType === 'generator_big') ? 0 : decor.adopt([{ uid: 'yard_mikano', id: 'mikano_gen', x: 0, z: 0, turns: 0 }]);
    const hw = plan.width / 2;
    const list = gens().map((p) => ({
      id: p.modelType,
      x: +p.x.toFixed(2),
      z: +p.z.toFixed(2),
      indoors: plan.rooms.some((r) => p.x > r.minX && p.x < r.maxX && p.z > r.minZ && p.z < r.maxZ),
      outside: Math.abs(p.x) > hw + 0.4,
    }));
    return { carport: plan.carport, hw, taken, list };
  });
  check('generator: in a house the Mikano stands in the compound, outside the side wall, not in a room',
    house.carport === true && house.list.length > 0 && house.list.every((item) => item.outside && !item.indoors), house);

  // The street of the ride, and the words on its shops
  const signs = await page.evaluate(() => {
    const g = window.game;
    const read = (city) => {
      g.roadRideExperience.skipRide();
      g.roadRideExperience.startRide({
        vehicleName: 'Taxi', vehicleType: 'taxi', originName: 'Here', destinationName: 'There',
        durationSeconds: 4, trafficCondition: 'Clear', weatherCondition: 'Sunny', destinationCityId: city,
      });
      const found = { shops: null, boards: null };
      g.roadRideExperience.group.traverse((o) => {
        if (o.userData && o.userData.shops) found.shops = o.userData.shops;
        if (o.userData && o.userData.boards) found.boards = o.userData.boards;
      });
      g.roadRideExperience.skipRide();
      return found;
    };
    return { abuja: read('abuja'), ph: read('port_harcourt'), lagos: read('lagos') };
  });
  const has = (list, word) => Array.isArray(list) && list.some((name) => name.includes(word));
  check('ride: an Abuja taxi shows Abuja shops and billboards, not Iya Basira or Eko Bank',
    has(signs.abuja.shops, 'GARKI') && has(signs.abuja.shops, 'WUSE') && !has(signs.abuja.shops, 'IYA BASIRA') && has(signs.abuja.boards, 'UNITY TRUST') && !has(signs.abuja.boards, 'EKO'),
    signs.abuja);
  check('ride: a Port Harcourt taxi shows Garden City shops, not the Lagos row',
    has(signs.ph.shops, 'MILE 1') && has(signs.ph.shops, 'RUMUOLA') && !has(signs.ph.shops, 'IYA BASIRA') && has(signs.ph.boards, 'RIVERS TRUST'),
    signs.ph);
  check('ride: a Lagos taxi still shows the Lagos shops', has(signs.lagos.shops, 'IYA BASIRA') && has(signs.lagos.boards, 'EKO'), signs.lagos);

  // Chase camera: uneven frame times, the sort a phone produces, must not throw the camera.
  const camera = await page.evaluate(() => new Promise((resolve) => {
    const g = window.game;
    g.roadRideExperience.skipRide();
    const rooms = g.world.interiorManager;
    const started = performance.now();
    const go = () => {
      if (rooms.isPlayerInside()) {
        if (performance.now() - started > 5000) {
          resolve({
            ok: false,
            why: 'still inside',
            transitioning: !!rooms.isTransitioning,
            busy: !!rooms.busy,
            usingDoor: !!rooms.usingDoor,
            held: rooms.constructor.holdIn?.() ?? null,
          });
          return;
        }
        if (!rooms.isTransitioning) void rooms.exitCurrentInterior(g.player, g.cameraManager, g.hud, g.world);
        setTimeout(go, 200);
        return;
      }
      runDrive(resolve);
    };
    const runDrive = (done) => {
      const veh = g.world.vehicles.drivableVehicles.find((v) => v.type === 'sedan');
      if (!veh) { done({ ok: false, why: 'no sedan' }); return; }
      g.player.stopMoving();
      g.player.mesh.position.copy(veh.mesh.position);
      g.enterVehicle(veh);
      const v = g.player.currentVehicle;
      v.mesh.position.set(-4, 0, -80);
      v.mesh.rotation.y = 0;
      v.currentSpeed = 16;
      v.steerInput = 0;
      if (v.velocityDirection) v.velocityDirection.set(0, 1);
      const cam = g.cameraManager;
      cam.driveView = 'chase';
      const deltas = [1 / 60, 1 / 60, 0.05, 0.008, 0.048, 0.011, 1 / 30, 0.016, 0.05, 0.013];
      const dist = [];
      for (const dt of deltas) {
        v.update(dt, { arrowup: true, arrowleft: dt > 0.04 });
        cam.update(g.player, dt);
        dist.push(cam.camera.position.distanceTo(v.mesh.position));
      }
      const jumps = dist.slice(1).map((d, i) => Math.abs(d - dist[i]));
      g.exitVehicle();
      done({ ok: true, dist: dist.map((d) => +d.toFixed(2)), maxJump: +Math.max(...jumps).toFixed(2) });
    };
    go();
  }));
  check('driving: when frame time jumps, the chase camera stays a steady distance behind the car (no jump over 1.2 m)',
    camera.ok && camera.maxJump < 1.2 && camera.dist.every((d) => d > 8 && d < 16), camera);

  const doors = await page.evaluate(() => {
    const g = window.game;
    const count = (city) => {
      g.arriveInCity(city);
      const prefix = `door-${city}-`;
      return (g.world.interactiveObjects ?? []).filter((o) => String(o.id).startsWith(prefix)).length;
    };
    return { abuja: count('abuja'), ph: count('port_harcourt') };
  });
  check('doors: Port Harcourt has a door on its shops, offices, hotels, banks and markets, as Abuja does',
    doors.abuja >= 100 && doors.ph >= 40, doors);

  // Own jet, from Abuja back to Lagos: the button's path, waited out to the landing
  await page.evaluate(() => {
    const g = window.game;
    g.arriveInCity('lagos');
    const d = g.hud.backend.getData();
    d.bank.balance = 200_000_000_000;
    g.hud.backend.saveData();
  });
  await page.evaluate(() => window.game.fleetSheet.open('jet'));
  await wait(300);
  await page.click('#fleet-sheet [data-choose="challenger"]');
  await page.click('#fleet-sheet [data-buy]');
  await wait(400);
  const flown = await page.evaluate(() => {
    const g = window.game;
    g.fleetSheet.close();
    const jet = g.world.expressway.roadside.hooks.mine('jet')[0];
    if (!jet) return { ok: false, why: 'no jet' };
    g.arriveInCity('abuja');
    g.hud.interstateModal.open('abuja');
    const btn = document.querySelector('#interstate-own-jets .btn-own-jet[data-to="lagos"]');
    if (!btn) return { ok: false, why: 'no fly button', jets: document.getElementById('interstate-own-jets')?.textContent?.slice(0, 180) };
    const bank = g.hud.backend.getData().bank.balance;
    btn.click();
    return { ok: true, from: g.world.cityManager.currentCityId, bank, ride: !!g.ride, uid: btn.dataset.jet };
  });
  // The landing is a real timer. Wait for it in the page so a frozen tab cannot skip it.
  const landed = await page.evaluate((uid) => new Promise((resolve) => {
    const start = performance.now();
    const tick = () => {
      const g = window.game;
      const city = g.world.cityManager.currentCityId;
      const waited = performance.now() - start;
      if (city !== 'lagos' && waited < 6000) {
        setTimeout(tick, 100);
        return;
      }
      const airport = g.world.airportOf('lagos');
      const steps = airport?.apron?.steps;
      const pos = g.player.position;
      const home = g.world.expressway.roadside.craft.get(uid)?.userData?.home;
      resolve({
        city,
        ms: Math.round(waited),
        nearSteps: steps ? Math.hypot(pos.x - steps.x, pos.z - steps.z) : null,
        nearJet: home ? Math.hypot(pos.x - home.x, pos.z - home.z) : null,
        ride: !!g.ride,
      });
    };
    tick();
  }), flown.uid);
  const onTheGround = landed.city === 'lagos' && ((landed.nearSteps !== null && landed.nearSteps < 8) || (landed.nearJet !== null && landed.nearJet < 12));
  check('jet: flown from Abuja, it lands the player in Lagos, on the apron or beside the jet',
    flown.ok && onTheGround, { flown, landed });

  check('outdoor: no errors in the page', log.errors.length === 0, log.errors.slice(0, 5));
  await ctx.close();
}
