// Lagos-only yellow card path: Port Health on Airport Road.
// Jab + stamp needs a Nigerian passport in the bag. No FX / other cities.
import { open, newPlayer, closeDialogs, advance, wait, playUntil, money } from './lib.mjs';

const enter = async (page, key) => {
  await page.evaluate((k) => {
    const g = window.game;
    const card = g.world.interactiveObjects.find((o) => o.id === `roadside-${k}`);
    if (!card) throw new Error(`no roadside-${k}`);
    g.player.stopMoving();
    g.player.mesh.position.set(card.interactionPoint.x, 0, card.interactionPoint.z);
    g.hud.showInteractionCard(card);
    document.getElementById('card-action-btn')?.click();
  }, key);
  return playUntil(page, () => (window.game.world.interiorManager.currentInterior && !window.game.world.interiorManager.isTransitioning ? window.game.world.interiorManager.currentInterior.name : null), 20);
};

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

const bag = (page) => page.evaluate(() => window.game.hud.backend.getData().inventory.map((i) => i.id));

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

  const door = await page.evaluate(() => {
    const o = window.game.world.interactiveObjects.find((x) => x.id === 'roadside-port-health');
    if (!o) return null;
    window.game.hud.showInteractionCard(o);
    return { found: true, label: document.getElementById('card-action-btn')?.textContent ?? '', z: o.interactionPoint.z };
  });
  await page.evaluate(() => window.game.hud.hideInteractionCard());
  check('yellowcard: Port Health stands on Airport Road before MMIA',
    !!door?.found && /Go inside/.test(door.label) && door.z > 6100 && door.z < 6220,
    door);

  // Without passport: refuse, no charge
  const inHealth = await enter(page, 'port-health');
  const m0 = await money(page);
  await use(page, 'place_port-health_yellow', 'Register, jab, and collect my yellow card');
  const blocked = await page.evaluate(() => ({
    bag: window.game.hud.backend.getData().inventory.map((i) => i.id),
    said: document.getElementById('game-toast')?.innerText?.slice(0, 160)
      || document.body.innerText.match(/document in your bag|passport|Alagbon/i)?.[0]
      || '',
  }));
  const m1 = await money(page);
  check('yellowcard: Port Health refuses without a Nigerian passport in the bag',
    /Port Health|Yellow Card/.test(inHealth || '') && !blocked.bag.includes('yellow_card') && m1.total === m0.total,
    { inHealth, blocked, paid: m0.total - m1.total });
  await leave(page);
  await wait(800);

  // Collect passport at Alagbon, then yellow card succeeds
  await enter(page, 'nis-passport');
  await use(page, 'place_nis-passport_apply', 'Apply and collect my Nigerian passport');
  await leave(page);
  await wait(800);

  await enter(page, 'port-health');
  const m2 = await money(page);
  await use(page, 'place_port-health_yellow', 'Register, jab, and collect my yellow card');
  const after = await bag(page);
  const m3 = await money(page);
  check('yellowcard: with a passport, Port Health issues a yellow fever card for ₦25,000',
    after.includes('ng_passport') && after.includes('yellow_card') && m2.total - m3.total === 25000,
    { after, paid: m2.total - m3.total });

  // Duplicate refused
  await leave(page);
  await wait(800);
  await enter(page, 'port-health');
  const m4 = await money(page);
  await use(page, 'place_port-health_yellow', 'Register, jab, and collect my yellow card');
  const m5 = await money(page);
  const count = await page.evaluate(() => window.game.hud.backend.getData().inventory.find((i) => i.id === 'yellow_card')?.quantity ?? 0);
  check('yellowcard: a second yellow card is refused once you already hold one',
    m5.total === m4.total && count === 1,
    { paid: m4.total - m5.total, count });

  // Flights gate: passport + visa alone still blocked without yellow card
  await page.evaluate(() => {
    const be = window.game.hud.backend;
    if (!be.getData().inventory.some((i) => i.id === 'travel_visa')) {
      be.addItem({ id: 'travel_visa', name: 'Travel visa stamp', icon: '🧾', price: 45000, category: 'document', usable: false, description: 'test' });
    }
  });
  // Drop yellow card from bag to prove the flight gate
  await page.evaluate(() => window.game.hud.backend.removeItem('yellow_card'));
  const gate = await page.evaluate(() => {
    const flights = window.game.flights;
    const route = flights.routesFrom('lagos').find((r) => r.to === 'abuja');
    return flights.cannotBook(route, 'lagos');
  });
  check('yellowcard: MMIA will not sell a ticket without the yellow fever card',
    /yellow fever|Port Health|yellow card/i.test(gate || ''),
    { gate });

  check('yellowcard: no page errors', log.errors.length === 0, log.errors.slice(0, 4));
}
