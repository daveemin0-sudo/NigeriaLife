// Passport offices in Abuja and Port Harcourt issue the same Nigerian passport booklet.
import { open, newPlayer, closeDialogs, advance, wait, playUntil, money } from './lib.mjs';

const use = async (page, stationId, choice) => {
  await page.evaluate((id) => {
    const g = window.game;
    const o = g.world.interiorManager.getActiveInteractiveObjects().find((x) => x.id === id);
    if (!o) throw new Error(`no station ${id}`);
    g.player.stopMoving();
    g.player.mesh.position.set(o.interactionPoint.x, 0, o.interactionPoint.z);
    g.hud.showInteractionCard(o);
    document.getElementById('card-action-btn')?.click();
  }, stationId);
  await wait(300);
  await page.evaluate((t) => [...document.querySelectorAll('#game-dialogue-overlay button')].find((b) => b.textContent.includes(t))?.click(), choice);
  await playUntil(page, () => (window.game.player.actor.sequence ? null : true), 25);
  await advance(page, 0.5);
};

const leave = (page) => page.evaluate(() => {
  const g = window.game;
  return g.world.interiorManager.exitCurrentInterior(g.player, g.cameraManager, g.hud, g.world);
});

const enterDoor = async (page, doorId) => {
  await page.evaluate((id) => {
    const g = window.game;
    const card = g.world.interactiveObjects.find((o) => o.id === id);
    if (!card) throw new Error(`no ${id}`);
    g.player.stopMoving();
    g.player.mesh.position.set(card.interactionPoint.x, 0, card.interactionPoint.z);
    g.hud.showInteractionCard(card);
    document.getElementById('card-action-btn')?.click();
  }, doorId);
  return playUntil(page, () => (window.game.world.interiorManager.currentInterior && !window.game.world.interiorManager.isTransitioning ? window.game.world.interiorManager.currentInterior.name : null), 25);
};

const switchCity = async (page, city) => {
  await page.evaluate((c) => {
    const g = window.game;
    g.world.cityManager.switchCity(c, g.player, (objs) => {
      g.world.interactiveObjects = objs;
    });
  }, city);
  await advance(page, 1);
  await wait(500);
};

export async function run(browser, check) {
  const ctx = await newPlayer(browser);
  const { page, log } = await open(ctx);
  await closeDialogs(page);
  await page.evaluate(() => {
    const be = window.game.hud.backend;
    be.data.walletCash += 500000;
    be.saveData();
    window.game.world.skyEnvironment.setHour(11);
  });

  // --- Abuja ---
  await switchCity(page, 'abuja');
  const abujaDoor = await page.evaluate(() => !!window.game.world.interactiveObjects.find((o) => o.id === 'roadside-abuja-passport'));
  check('citypapers: Federal Passport Office door stands in Abuja', abujaDoor, { abujaDoor });

  const inAbuja = await enterDoor(page, 'roadside-abuja-passport');
  const m0 = await money(page);
  await use(page, 'place_abuja-passport_apply', 'Apply and collect my Nigerian passport');
  const bagAbuja = await page.evaluate(() => window.game.hud.backend.getData().inventory.map((i) => i.id));
  const m1 = await money(page);
  check('citypapers: Abuja passport office issues ng_passport for ₦70,000',
    /Passport Office/.test(inAbuja || '') && bagAbuja.includes('ng_passport') && m0.total - m1.total === 70000,
    { inAbuja, bagAbuja, paid: m0.total - m1.total });
  await leave(page);
  await wait(600);

  // Domestic ABV booking only needs the passport (already in bag)
  const abujaGate = await page.evaluate(() => {
    const flights = window.game.flights;
    const route = flights.routesFrom('abuja').find((r) => r.to === 'lagos');
    return { ok: !flights.cannotBook(route, 'abuja'), reason: flights.cannotBook(route, 'abuja') };
  });
  check('citypapers: with Abuja passport, NL 205 Abuja→Lagos can be booked',
    abujaGate.ok, abujaGate);

  // Clear passport to prove PH office also issues one
  await page.evaluate(() => window.game.hud.backend.removeItem('ng_passport'));

  // --- Port Harcourt ---
  await switchCity(page, 'port_harcourt');
  const phDoor = await page.evaluate(() => !!window.game.world.interactiveObjects.find((o) => o.id === 'roadside-ph-passport'));
  check('citypapers: Federal Passport Office door stands in Port Harcourt', phDoor, { phDoor });

  const inPh = await enterDoor(page, 'roadside-ph-passport');
  const m2 = await money(page);
  await use(page, 'place_ph-passport_apply', 'Apply and collect my Nigerian passport');
  const bagPh = await page.evaluate(() => window.game.hud.backend.getData().inventory.map((i) => i.id));
  const m3 = await money(page);
  check('citypapers: Port Harcourt passport office issues ng_passport for ₦70,000',
    /Passport Office/.test(inPh || '') && bagPh.includes('ng_passport') && m2.total - m3.total === 70000,
    { inPh, bagPh, paid: m2.total - m3.total });

  const phGate = await page.evaluate(() => {
    const flights = window.game.flights;
    const route = flights.routesFrom('port_harcourt').find((r) => r.to === 'lagos');
    return { ok: !flights.cannotBook(route, 'port_harcourt'), reason: flights.cannotBook(route, 'port_harcourt') };
  });
  check('citypapers: with PH passport, NL 311 Port Harcourt→Lagos can be booked',
    phGate.ok, phGate);

  check('citypapers: no page errors', log.errors.length === 0, log.errors.slice(0, 4));
}
