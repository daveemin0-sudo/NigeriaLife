// A taxi, a keke and an okada, ridden: a real vehicle with a driver holding the wheel or the
// handlebars as they turn, the player sitting in it as themselves, a Lagos road going by with
// real traffic that never drives into the ride, and the three camera views each framing it.
import { open, newPlayer, closeDialogs, advance, playUntil } from './lib.mjs';

const MODES = [
  { mode: 'taxi', label: 'taxi' },
  { mode: 'keke', label: 'keke' },
  { mode: 'bike', label: 'okada' },
];

export async function run(browser, check) {
  const ctx = await newPlayer(browser);
  const { page } = await open(ctx);
  await closeDialogs(page);

  for (const { mode, label } of MODES) {
    const booked = await page.evaluate((m) => {
      const g = window.game;
      const place = g.rides.destinations().find((d) => d.transportAvailability.some((o) => o.mode === m));
      if (!place) return { ok: false, reason: 'no place offers it' };
      return { ...g.rides.book(place.id, m), place: place.id };
    }, mode);
    const started = await playUntil(page, () => (window.game.roadRideExperience.isActive ? true : null), 20);
    if (!booked.ok || !started) {
      check(`a ${label} can be booked and the ride starts`, false, { booked, started });
      continue;
    }
    // Long enough to look round it properly
    await page.evaluate(() => { window.game.roadRideExperience.totalDuration = 120; });
    await advance(page, 1);

    const body = await page.evaluate(() => {
      const r = window.game.roadRideExperience;
      const v = r.ride;
      let driverMeshes = 0;
      v.driver.root.traverseVisible((o) => { if (o.isMesh) driverMeshes++; });
      return { shown: v.body.visible && r.group.visible, driver: driverMeshes, passenger: v.passenger.children.length, lane: v.lane, kind: v.body.children[0]?.name ?? '' };
    });
    check(`the ${label} is drawn with its driver in it and the player sitting in it as themselves`, body.shown && body.driver >= 5 && body.passenger === 1, body);

    // Ride along for a while, watching the hands, the wheel, the road and the traffic
    const watch = await page.evaluate(async () => {
      const g = window.game;
      const r = g.roadRideExperience;
      const v = r.ride;
      const street = r.street;
      let worstGrip = 0;
      let closest = Infinity;
      let minSteer = Infinity;
      let maxSteer = -Infinity;
      const from = r.distance;
      for (let i = 0; i < 100; i++) {
        await g.advance(0.1);
        worstGrip = Math.max(worstGrip, v.gripError ?? 1);
        const turn = v.lane === 'kerb' ? v.steer.rotation.y : v.steer.rotation.z;
        minSteer = Math.min(minSteer, turn);
        maxSteer = Math.max(maxSteer, turn);
        for (const car of street.traffic) {
          if (car.oncoming || Math.abs(car.x - street.laneX) > 0.5) continue;
          closest = Math.min(closest, Math.abs(car.z) - car.length / 2);
        }
      }
      return { worstGrip: +worstGrip.toFixed(3), turned: +(maxSteer - minSteer).toFixed(3), went: +(r.distance - from).toFixed(1), closest: +closest.toFixed(2) };
    });
    check(`the ${label} driver's hands stay on the ${label === 'taxi' ? 'wheel' : 'handlebars'} as they turn, the vehicle goes down the road, and no traffic drives into it`,
      watch.worstGrip < 0.06 && watch.turned > 0.04 && watch.went > 3 && watch.closest > 2, watch);

    // The three views
    const views = {};
    for (const view of ['inside', 'chase', 'side']) {
      await page.evaluate((v) => window.game.roadRideExperience.setCameraView(v), view);
      await advance(page, 0.3);
      views[view] = await page.evaluate(() => {
        const g = window.game;
        const r = g.roadRideExperience;
        const v = r.ride;
        const cam = r.rideCamera;
        const THREE = window.game.modules.THREE;
        const box = new THREE.Box3().setFromObject(v.body);
        const inside = box.containsPoint(cam.position);
        const centre = box.getCenter(new THREE.Vector3());
        const p = centre.clone().project(cam);
        // What the camera sees first in the vehicle's direction: the vehicle itself, not something in front of it
        const ray = new THREE.Raycaster();
        ray.setFromCamera(new THREE.Vector2(p.x, p.y), cam);
        const shown = (o) => { for (; o; o = o.parent) if (!o.visible) return false; return true; };
        const hits = ray.intersectObjects(r.group.children, true).filter((h) => shown(h.object) && !(h.object.material?.transparent));
        let first = hits[0]?.object ?? null;
        let ours = false;
        while (first) { if (first === v.body) { ours = true; break; } first = first.parent; }
        g.renderer.render(g.scene, cam);
        return { inside, onScreen: Math.abs(p.x) < 1 && Math.abs(p.y) < 1 && p.z < 1, ours, passengerShown: v.passenger.visible, calls: g.renderer.info.render.calls };
      });
    }
    check(`the ${label}'s inside view is from a seat in it, with the player's own figure out of the way`, views.inside.inside && !views.inside.passengerShown, views.inside);
    check(`the ${label}'s chase and side views frame the vehicle from outside, nothing in front of it, the player seen riding`,
      ['chase', 'side'].every((v) => !views[v].inside && views[v].onScreen && views[v].ours && views[v].passengerShown), { chase: views.chase, side: views.side });
    check(`the ${label} ride stays light enough for a phone (under 220 draws a frame)`, Object.values(views).every((v) => v.calls < 220), Object.fromEntries(Object.entries(views).map(([k, v]) => [k, v.calls])));

    await page.evaluate(() => window.game.roadRideExperience.skipRide());
    const done = await playUntil(page, () => (!window.game.roadRideExperience.isActive && !window.game.rides.ride ? { shown: window.game.player.mesh.visible } : null), 20);
    await closeDialogs(page);
    check(`the ${label} ride ends with the player back on their feet`, done && done.shown, done);
  }
}
