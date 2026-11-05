// Driving for Eko Rides: online from the Ride tab while in a car; a request names someone waiting
// at a bus stop and where they are going; arrows on the road lead there; pulled up at the kerb, the
// one at the front of the queue walks to the car and gets in; arrows lead on to their place; stopped
// there, they get out and walk off, and the fare is paid, once. Leaving the car goes offline.
import { open, newPlayer, closeDialogs, playUntil, wait } from './lib.mjs';

export async function run(browser, check) {
  const ctx = await newPlayer(browser);
  const { page, log } = await open(ctx);
  await closeDialogs(page);

  const setup = await page.evaluate(() => {
    const g = window.game;
    g.world.skyEnvironment.setHour(12);
    const car = g.world.vehicles.drivableVehicles.find((v) => v.type === 'sedan' && v.city === 'lagos' && !v.driver);
    if (!car) return { ok: false };
    g.player.stopMoving();
    g.player.mesh.position.copy(car.mesh.position);
    g.enterVehicle(car);
    window.__park = (x, z, yaw = 0) => {
      const v = g.player.currentVehicle;
      v.mesh.position.set(x, 0, z);
      v.mesh.rotation.y = yaw;
      v.currentSpeed = 0;
      v.steerInput = 0;
    };
    window.__money = () => g.hud.backend.getData().walletCash + g.hud.backend.getData().bank.balance;
    return { ok: g.player.isDriving };
  });
  check('ridehail: the player is at the wheel of a car', setup.ok, setup);
  if (!setup.ok) return;

  // Online from the phone
  await page.evaluate(() => { window.game.hud.phoneModal.open(); window.game.hud.phoneModal.openApp('ride'); });
  await wait(500);
  const card = await page.evaluate(() => document.getElementById('ride-hail')?.innerText ?? null);
  await page.evaluate(() => document.getElementById('ride-hail-btn')?.click());
  await wait(300);
  const online = await page.evaluate(() => ({ online: window.game.rideHail.online, phoneOpen: !!document.querySelector('.phone-modal.open, #phone-modal.open, .nl-phone.is-open') }));
  check('ridehail: the Ride tab offers driving for Eko Rides, and Go online puts the player online', !!card && /Eko Rides/.test(card) && online.online, { card: card?.slice(0, 120), online });

  // A request, with the arrows to the stop
  const request = await playUntil(page, () => {
    const g = window.game;
    const t = g.rideHail.current;
    return t && g.rideHail.where === 'pickup' ? { who: t.who, stop: t.stop, to: t.to.name, fare: t.fare, guide: g.routeGuide.active, toward: g.routeGuide.destination } : null;
  }, 20);
  check('ridehail: a request comes in, someone at a bus stop going somewhere, with a fare; arrows on the road lead to the stop',
    !!request && request.fare > 0 && request.guide && /Pick up/.test(request.toward ?? ''), request);
  if (!request) return;

  // Pulled up at that stop: they come to the car and get in
  const before = await page.evaluate(() => window.__money());
  await page.evaluate((stop) => window.__park(stop.x, stop.z, stop.x < 0 ? Math.PI : 0), request.stop);
  const boarded = await playUntil(page, () => {
    const g = window.game;
    return g.rideHail.where === 'riding' ? { guide: g.routeGuide.active, toward: g.routeGuide.destination } : null;
  }, 40);
  check('ridehail: pulled up at the kerb by the stop, the one at the front of the queue walks to the car and gets in; the arrows now lead to their place',
    !!boarded && boarded.guide && new RegExp(request.to.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).test(boarded.toward ?? ''), { boarded, to: request.to });
  const paidEarly = (await page.evaluate(() => window.__money())) - before;

  // At their place: stopped, they get out, the fare is paid once
  await page.evaluate(() => {
    const g = window.game;
    const t = g.rideHail.current;
    window.__park(t.to.x, t.to.z);
  });
  const done = await playUntil(page, () => {
    const g = window.game;
    return g.rideHail.where === 'finding' && g.rideHail.trips === 1 ? { trips: g.rideHail.trips, earned: g.rideHail.earned, guide: g.routeGuide.active } : null;
  }, 15);
  await page.evaluate(() => window.game.advance(1));
  const after = await page.evaluate(() => window.__money());
  const rider = await page.evaluate(() => {
    const r = window.game.riderOut;
    return r ? { shown: r.root.visible, walking: r.walking } : null;
  });
  check('ridehail: stopped at their place, they get out and walk off, and the fare is paid to the player once, not before',
    !!done && paidEarly === 0 && after - before === request.fare && done.earned === request.fare && !done.guide && !!rider && rider.shown, { done, paidEarly, paid: after - before, fare: request.fare, rider });

  // Out of the car: offline
  await page.evaluate(() => window.game.exitVehicle?.());
  await page.evaluate(() => window.game.advance(10));
  const off = await page.evaluate(() => ({ online: window.game.rideHail.online, driving: window.game.player.isDriving }));
  check('ridehail: out of the car for a while, the player goes offline', !off.driving && !off.online, off);

  check('ridehail: no errors in the page', log.errors.length === 0, log.errors.slice(0, 5));
  await ctx.close();
}
