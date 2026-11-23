// A booked ride really comes: up the road to the kerb by the player, waits there, and is got into and paid for at the door.
import { open, newPlayer, closeDialogs, advance, playUntil, wait, money } from './lib.mjs';

const rich = (page) => page.evaluate(() => {
  const be = window.game.hud.backend;
  be.data.walletCash = 500000;
  be.saveData();
});

const book = (page, mode) => page.evaluate((m) => {
  const g = window.game;
  const me = g.player.position;
  const far = (d) => Math.hypot(d.streetPosition.x - me.x, d.streetPosition.z - me.z);
  const place = g.rides.destinations().filter((d) => g.rides.vehiclesFor(d).some((v) => v.mode === m)).sort((a, b) => far(b) - far(a))[0];
  if (!place) return { ok: false, reason: 'no place offers it' };
  const result = g.rides.book(place.id, m);
  const fare = g.rides.ride?.fare ?? 0;
  const body = g.rideAtKerb.vehicle?.body;
  return { ...result, fare, name: place.name, id: place.id, sent: !!body, at: body ? { x: body.position.x, z: body.position.z } : null, eta: g.rides.ride?.eta ?? 0 };
}, mode);

/** Plays until the vehicle has stopped, watching that it stays on a road and moves smoothly */
const watchArrival = async (page) => {
  await page.evaluate(() => {
    const p = window.game.rideAtKerb;
    if (window.__motion) { window.__motion.fastest = 0; window.__motion.backward = 0; return; }
    const motion = (window.__motion = { fastest: 0, backward: 0 });
    const was = p.update.bind(p);
    p.update = (delta) => {
      const body = p.vehicle?.body, x = body?.position.x, z = body?.position.z, left = p.left;
      was(delta);
      if (!body || !p.vehicle || delta <= 0) return;
      motion.fastest = Math.max(motion.fastest, Math.hypot(body.position.x - x, body.position.z - z) / delta);
      if (p.left > left + 1e-6) motion.backward++;
    };
  });
  const track = [];
  for (let t = 0; t < 30; t += 0.25) {
    const s = await page.evaluate(() => {
      const g = window.game, body = g.rideAtKerb.vehicle?.body;
      if (!body) return null;
      const { x, z } = body.position;
      return { x, z, yaw: body.rotation.y, stage: g.rides.ride?.stage ?? null };
    });
    if (!s) return { track, gone: true };
    track.push(s);
    if (s.stage === 'driver_here') break;
    await advance(page, 0.25);
    await wait(15);
  }
  return { track };
};

export async function run(browser, check) {
  const ctx = await newPlayer(browser);
  const { page, log } = await open(ctx, { w: 1366, h: 768, realPickup: true });
  await closeDialogs(page);
  await rich(page);
  const m0 = await money(page);
  const home = await page.evaluate(() => ({ x: window.game.player.position.x, z: window.game.player.position.z }));
  const backHome = () => page.evaluate((h) => {
    const g = window.game;
    g.player.stopMoving();
    g.player.mesh.position.set(h.x, 0, h.z);
    g.player.position.copy(g.player.mesh.position);
    g.cameraManager.snapToPlayer(g.player, 'street');
  }, home);

  const booked = await book(page, 'taxi');
  const start = await page.evaluate(() => {
    const g = window.game, body = g.rideAtKerb.vehicle?.body, me = g.player.position;
    let meshes = 0;
    body?.traverseVisible((o) => { if (o.isMesh) meshes++; });
    return { inScene: !!body?.parent?.parent, visible: !!body?.visible, meshes, away: body ? Math.hypot(body.position.x - me.x, body.position.z - me.z) : 0, active: g.roadRideExperience.isActive };
  });
  const m1 = await money(page);
  check('ridepickup: booking sends a real vehicle up the road, nothing is charged, and the trip has not started',
    booked.ok && booked.sent && start.inScene && start.visible && start.meshes > 3 && start.away > 10 && !start.active && m1.total === m0.total, { booked, start });

  const { track } = await watchArrival(page);
  const motion = await page.evaluate(() => window.__motion);
  const stop = await page.evaluate(() => {
    const g = window.game, body = g.rideAtKerb.vehicle?.body, me = g.player.position;
    const bar = document.getElementById('ride-getin');
    const r = bar?.getBoundingClientRect();
    const top = r && r.width ? document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2) : null;
    return { stage: g.rides.ride?.stage, near: body ? Math.hypot(body.position.x - me.x, body.position.z - me.z) : -1, button: !!r?.width, tappable: top === bar, inView: !!r && r.left >= 0 && r.right <= innerWidth && r.top >= 0 };
  });
  check('ridepickup: it drives smoothly to the kerb near the player and stops there, with a Get in button that can be tapped',
    stop.stage === 'driver_here' && track.length > 8 && motion.fastest > 5 && motion.fastest < 10 && motion.backward === 0 && stop.near < 42 && stop.button && stop.tappable && stop.inView, { steps: track.length, motion, stop });

  await advance(page, 4);
  const waits = await page.evaluate(() => ({ stage: window.game.rides.ride?.stage, active: window.game.roadRideExperience.isActive }));
  const m2 = await money(page);
  check('ridepickup: it waits at the kerb for the player, still unpaid', waits.stage === 'driver_here' && !waits.active && m2.total === m0.total, { waits, charged: m0.total - m2.total });

  // Getting in: the player walks to the door, it opens, and the fare is taken then
  await page.evaluate(() => {
    const g = window.game;
    window.__door = { opened: false };
    const was = g.rideAtKerb.openDoor.bind(g.rideAtKerb);
    g.rideAtKerb.openDoor = (done) => {
      const spot = g.rideAtKerb.doorSpot();
      const me = g.player.position;
      window.__door = { opened: true, hadDoor: !!g.rideAtKerb.vehicle?.door, fromDoor: spot ? Math.hypot(spot.x - me.x, spot.z - me.z) : -1, paidYet: g.rides.ride?.paid };
      was(done);
    };
    document.getElementById('ride-getin').click();
  });
  const inRide = await playUntil(page, () => (window.game.roadRideExperience.isActive ? true : null), 45);
  const door = await page.evaluate(() => window.__door);
  const riding = await page.evaluate(() => {
    const g = window.game, r = g.roadRideExperience, v = r.ride;
    return { stage: g.rides.ride?.stage, inRideGroup: v?.body.parent === r.vehicleGroup, x: v?.body.position.x, z: v?.body.position.z, passenger: v?.passenger.children.length, doorHidden: !v?.door || (!v.door.hinge.visible && !v.door.gap.visible), streetEmpty: g.rideAtKerb.vehicle === null };
  });
  const m3 = await money(page);
  check('ridepickup: Get in walks the player to the door, it opens, and they are seated with the fare paid once',
    !!inRide && door.opened && door.hadDoor && door.fromDoor < 1.6 && !door.paidYet && riding.stage === 'on_trip' && riding.inRideGroup && riding.x === 0 && riding.z === 0 && riding.passenger === 1 && riding.doorHidden && riding.streetEmpty && m0.total - m3.total === booked.fare,
    { door, riding, paid: m0.total - m3.total, fare: booked.fare });
  await page.evaluate(() => window.game.roadRideExperience.skipRide());
  await playUntil(page, () => (!window.game.rides.ride ? true : null), 8);
  await closeDialogs(page);

  // A keke and an okada come too, from the map's way of asking, and are paid at the kerb
  for (const mode of ['keke', 'bike']) {
    await backHome();
    await rich(page);
    const before = await money(page);
    const asked = await page.evaluate((m) => {
      const g = window.game;
      const me = g.player.position;
      const place = g.rides.destinations().filter((d) => d.transportAvailability.some((o) => o.mode === m)).sort((a, b) => Math.hypot(b.streetPosition.x - me.x, b.streetPosition.z - me.z) - Math.hypot(a.streetPosition.x - me.x, a.streetPosition.z - me.z))[0];
      const vehicle = place.transportAvailability.find((o) => o.mode === m);
      window.__arrived = false;
      const ok = g.hud.onJourney(place, vehicle, () => { window.__arrived = true; });
      return { ok, fare: vehicle.fare, sent: !!g.rideAtKerb.vehicle, stage: g.rides.ride?.stage };
    }, mode);
    const beforeKerb = await money(page);
    const here = await playUntil(page, () => (window.game.rides.ride?.stage === 'driver_here' ? true : null), 25);
    const gotIn = await page.evaluate(() => { const g = window.game, r = g.rides.getIn(), d = g.rideAtKerb.doorSpot(), p = g.player.position, ride = g.rides.ride; return { ...r, stage: ride?.stage, boarding: ride?.boarding, limit: ride?.boardingLimit, door: d && { x: +d.x.toFixed(1), z: +d.z.toFixed(1) }, me: { x: +p.x.toFixed(1), z: +p.z.toFixed(1) } }; });
    const going = await playUntil(page, () => (window.game.roadRideExperience.isActive ? true : null), 45);
    const stuck = going ? null : await page.evaluate(() => { const g = window.game, ride = g.rides.ride, p = g.player.position; return { stage: ride?.stage ?? null, boarding: ride?.boarding, boardingFor: ride?.boardingFor, me: { x: +p.x.toFixed(1), z: +p.z.toFixed(1) }, inside: g.world.interiorManager.isPlayerInside(), driving: g.player.isDriving, toast: document.querySelector('.game-toast, .nl-toast')?.textContent?.slice(0, 100) ?? null }; });
    const after = await money(page);
    await page.evaluate(() => window.game.roadRideExperience.skipRide());
    await playUntil(page, () => (window.__arrived ? true : null), 8);
    await closeDialogs(page);
    check(`ridepickup: a ${mode === 'bike' ? 'okada' : 'keke'} booked from the map comes to the kerb and is paid only on getting in`,
      asked.ok && asked.sent && beforeKerb.total === before.total && !!here && !!going && before.total - after.total === asked.fare, { asked, here, going, gotIn, stuck, paid: before.total - after.total });
  }

  // Cancelled at the kerb, or left waiting too long: gone, and nothing charged
  await backHome();
  await rich(page);
  const m4 = await money(page);
  await book(page, 'taxi');
  await playUntil(page, () => (window.game.rides.ride?.stage === 'driver_here' ? true : null), 25);
  await page.evaluate(() => document.getElementById('ride-bar-cancel').click());
  await advance(page, 1);
  const cancelled = await page.evaluate(() => ({ ride: window.game.rides.ride, vehicle: window.game.rideAtKerb.vehicle, group: window.game.rideAtKerb.group.children.length, bar: document.getElementById('ride-bar').hidden }));
  await book(page, 'taxi');
  await playUntil(page, () => (window.game.rides.ride?.stage === 'driver_here' ? true : null), 25);
  await page.evaluate(() => { window.game.rides.ride.waited = 89.5; });
  await advance(page, 1);
  const left = await page.evaluate(() => ({ ride: window.game.rides.ride, vehicle: window.game.rideAtKerb.vehicle }));
  const m5 = await money(page);
  check('ridepickup: cancelled at the kerb or kept waiting too long, the vehicle goes and nothing is charged',
    cancelled.ride === null && cancelled.vehicle === null && cancelled.group === 0 && cancelled.bar && left.ride === null && left.vehicle === null && m5.total === m4.total, { cancelled, left, charged: m4.total - m5.total });

  // Not enough money by the time it arrives
  await book(page, 'taxi');
  await playUntil(page, () => (window.game.rides.ride?.stage === 'driver_here' ? true : null), 25);
  const broke = await page.evaluate(() => {
    const g = window.game, be = g.hud.backend;
    be.data.walletCash = 0;
    be.data.bank.balance = 0;
    const r = g.rides.getIn();
    return { ok: r.ok, reason: r.reason, stage: g.rides.ride?.stage, active: g.roadRideExperience.isActive };
  });
  check('ridepickup: with no money left at the door the player is told and does not get in', !broke.ok && /fare/i.test(broke.reason ?? '') && broke.stage === 'driver_here' && !broke.active, broke);
  await page.evaluate(() => window.game.rides.cancel());

  // Somewhere no vehicle can come up to: the trip still happens, without a Get in that nothing answers
  await rich(page);
  const noRoad = await page.evaluate(() => {
    const g = window.game;
    window.__kerb = g.roadKerbNear;
    g.roadKerbNear = () => null;
    return { ...g.rides.book(g.rides.destinations().find((d) => d.transportAvailability.some((o) => o.mode === 'taxi')).id, 'taxi'), sent: !!g.rideAtKerb.vehicle };
  });
  const started = await playUntil(page, () => (window.game.roadRideExperience.isActive ? true : null), 12);
  await page.evaluate(() => { const g = window.game; g.roadKerbNear = window.__kerb; delete g.roadKerbNear; if (g.roadRideExperience.isActive) g.roadRideExperience.skipRide(); });
  check('ridepickup: where no road is near, no vehicle is pretended and the trip simply starts', noRoad.ok && !noRoad.sent && !!started, { noRoad, started });

  check('ridepickup: no errors in the page', log.errors.length === 0, log.errors.slice(0, 5));

  // On a phone the bar is clear of everything at the top of the screen and Get in can be tapped
  const phoneCtx = await newPlayer(browser);
  const { page: phone } = await open(phoneCtx, { w: 360, h: 740, realPickup: true });
  await closeDialogs(phone);
  await rich(phone);
  await book(phone, 'keke');
  await playUntil(phone, () => (window.game.rides.ride?.stage === 'driver_here' ? true : null), 25);
  const fit = await phone.evaluate(() => {
    const bar = document.getElementById('ride-bar'), r = bar.getBoundingClientRect();
    const points = [0.04, 0.25, 0.5, 0.75, 0.96].map((u) => [r.left + r.width * u, r.top + r.height / 2]);
    const covered = points.filter(([x, y]) => !bar.contains(document.elementFromPoint(x, y))).length;
    const go = document.getElementById('ride-getin').getBoundingClientRect();
    return { left: r.left, right: r.right, top: r.top, covered, tappable: document.elementFromPoint(go.left + go.width / 2, go.top + go.height / 2)?.id, goHeight: go.height };
  });
  check('ridepickup: on a phone the ride bar fits the screen, nothing covers it, and Get in can be tapped',
    fit.left >= 8 && fit.right <= 352 && fit.covered === 0 && fit.tappable === 'ride-getin' && fit.goHeight >= 32, fit);
}
