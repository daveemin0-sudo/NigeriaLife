// A vehicle stands in one city: brought round in Abuja it is drawn and driven in Abuja, it is
// not drawn in Lagos when the player goes back, and after a reload it is still in Abuja where
// it was left. Old records without a city are in Lagos.
import { open, reload, wait, newPlayer, closeDialogs, advance } from './lib.mjs';

const PHONE = '#smartphone-wrapper';
const openApp = async (page, id, route = '') => {
  const wasOpen = await page.evaluate(({ id, route }) => { const phone = window.game.hud.phoneModal; const open = phone.isOpen; phone.openApp(id, route); return open; }, { id, route });
  await wait(wasOpen ? 150 : 650);
};
const tap = async (page, selector) => {
  const pressed = await page.evaluate((sel) => {
    const el = document.querySelector(sel);
    if (!el || el.disabled) return false;
    el.scrollIntoView({ block: 'center' });
    el.click();
    return true;
  }, `${PHONE} ${selector}`);
  await wait(200);
  return pressed;
};

/** Where the player's vehicle is, whether it and every parent are drawn, and whether its card can be used here. */
const where = (page, id) =>
  page.evaluate((id) => {
    const g = window.game;
    const v = g.world.vehicles.drivableVehicles.find((x) => x.id === `veh-own-${id}`);
    if (!v) return null;
    let drawn = true;
    for (let o = v.mesh; o; o = o.parent) if (!o.visible) drawn = false;
    const record = g.garage.mine().find((r) => r.id === id);
    return {
      city: v.city,
      here: g.world.cityManager.currentCityId,
      drawn,
      card: g.world.interactiveObjects.some((o) => o.id === v.id),
      x: +v.mesh.position.x.toFixed(1),
      z: +v.mesh.position.z.toFixed(1),
      near: +Math.hypot(v.mesh.position.x - g.player.position.x, v.mesh.position.z - g.player.position.z).toFixed(1),
      parked: record?.parkedAt ?? null,
      clear: g.world.cityManager.currentCityId === v.city ? !g.solidsHere()?.at(v.mesh.position.x, v.mesh.position.z, 1.0) : null,
    };
  }, id);

export async function run(browser, check) {
  const ctx = await newPlayer(browser);
  const { page, log } = await open(ctx);
  await closeDialogs(page);

  // Buy a motorbike at the dealer on the phone, with enough in the bank
  await page.evaluate(() => { const bk = window.game.hud.backend; bk.data.bank.balance += 500000; bk.saveData(); });
  await openApp(page, 'garage');
  await tap(page, '[data-set="garage.tab"][data-value="dealer"]');
  await tap(page, '[data-model="okada"]');
  // The phone asks to confirm the purchase
  await wait(120);
  await page.evaluate(() => document.getElementById('phone-confirm-yes')?.click());
  await page.waitForFunction(() => { const phone = window.game.hud.phoneModal; return !phone.busy && document.getElementById('phone-confirm')?.hidden; }, { timeout: 10000 }).catch(() => wait(600));
  const id = await page.evaluate(() => window.game.garage.mine()[0]?.id ?? null);
  check('vehicles: the player owns a motorbike', !!id, { id });
  if (!id) return;
  // (Bought on the phone, it has not been parked anywhere yet: it is delivered wherever its owner is)

  // Off to Abuja, and have it brought round there
  await page.evaluate(() => { const g = window.game; g.hud.phoneModal.close(); g.arriveInCity('abuja'); g.player.stopMoving(); g.player.mesh.position.set(-14, 0, 20); });
  await advance(page, 0.5);
  await openApp(page, 'garage', `car:${id}`);
  const button = await page.evaluate(() => { const b = document.querySelector('#smartphone-wrapper #garage-bring'); return b ? { disabled: b.disabled, text: b.textContent.trim() } : document.querySelector('#smartphone-wrapper')?.innerText.slice(0, 200); });
  const brought = await tap(page, '#garage-bring');
  await wait(400);
  await page.evaluate(() => window.game.hud.phoneModal.close());
  const inAbuja = await where(page, id);
  check(
    'vehicles: in Abuja it is brought round to the kerb near the player, clear of anything solid, drawn, clickable, and recorded as parked in Abuja',
    brought && inAbuja && inAbuja.city === 'abuja' && inAbuja.here === 'abuja' && inAbuja.drawn && inAbuja.card && inAbuja.near < 12 && inAbuja.clear && inAbuja.parked?.city === 'abuja',
    { inAbuja, button, brought }
  );

  // Driven in Abuja (the street of Abuja used to move no vehicles at all)
  const drive = await page.evaluate(async (id) => {
    const g = window.game;
    const v = g.world.vehicles.drivableVehicles.find((x) => x.id === `veh-own-${id}`);
    g.enterVehicle(v);
    v.mesh.rotation.y = 0;
    const from = v.mesh.position.clone();
    g.input.keys['w'] = true;
    await g.advance(3);
    g.input.keys['w'] = false;
    await g.advance(3);
    const moved = Math.hypot(v.mesh.position.x - from.x, v.mesh.position.z - from.z);
    g.exitVehicle();
    await g.advance(0.5);
    return { driving: true, moved: +moved.toFixed(1) };
  }, id);
  await wait(600);
  const leftAt = await where(page, id);
  check(
    'vehicles: driven up Shehu Shagari Way it moves, and where it is left is recorded, in Abuja',
    drive.moved > 5 && leftAt.parked?.city === 'abuja' && Math.abs(leftAt.parked.z - leftAt.z) < 0.2,
    { drive, leftAt }
  );

  // Back in Lagos it is not drawn there, cannot be walked up to there, and cannot be fetched from Abuja
  await page.evaluate(() => window.game.arriveInCity('lagos'));
  await advance(page, 0.5);
  const fromLagos = await where(page, id);
  const fetch = await page.evaluate((id) => window.game.ownedVehicles.bringRound(id), id);
  const stillAbuja = await where(page, id);
  check(
    'vehicles: back in Lagos, the motorbike left in Abuja is not drawn, cannot be used in Lagos, and cannot be brought round from 700 km away',
    fromLagos && fromLagos.city === 'abuja' && !fromLagos.drawn && !fromLagos.card && /parked in Abuja/.test(fetch || '') && stillAbuja.city === 'abuja' && stillAbuja.x === leftAt.x,
    { fromLagos, fetch }
  );

  // After a reload it is still in Abuja, where it was left
  await reload(page);
  await closeDialogs(page);
  const reloaded = await where(page, id);
  // (Vehicles more than 48 m off are not drawn: walk over to where it was left first)
  await page.evaluate((at) => { const g = window.game; g.arriveInCity('abuja'); g.player.stopMoving(); g.player.mesh.position.set(at.x - 3, 0, at.z); }, leftAt);
  await advance(page, 0.5);
  const again = await where(page, id);
  check(
    'vehicles: after a reload it is still parked in Abuja at the same spot, drawn when the player is there again, and not standing inside anything solid',
    reloaded && reloaded.city === 'abuja' && !reloaded.drawn && again && again.drawn && again.card && again.clear && Math.abs(again.z - leftAt.z) < 0.2 && Math.abs(again.x - leftAt.x) < 0.2,
    { reloaded, again }
  );
  const afterReload = await page.evaluate(async (id) => {
    const g = window.game;
    const v = g.world.vehicles.drivableVehicles.find((x) => x.id === `veh-own-${id}`);
    g.enterVehicle(v);
    v.mesh.rotation.y = Math.PI;
    const from = v.mesh.position.clone();
    g.input.keys['w'] = true;
    await g.advance(2);
    g.input.keys['w'] = false;
    await g.advance(2);
    return +Math.hypot(v.mesh.position.x - from.x, v.mesh.position.z - from.z).toFixed(1);
  }, id);
  check('vehicles: after the reload it can still be driven away (it is not stuck in itself)', afterReload > 5, { moved: afterReload });

  check('vehicles: no errors in the page', log.errors.length === 0, log.errors.slice(0, 5));
  await ctx.close();
}
