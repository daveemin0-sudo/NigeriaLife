// Airport arrivals services: telecom SIM / airtime and cab pickup to town.
import { open, newPlayer, closeDialogs, advance, playUntil, money, wait, useStation } from './lib.mjs';

const choose = (page, text) => page.evaluate((t) => [...document.querySelectorAll('#game-dialogue-overlay button')].find((b) => b.textContent.includes(t))?.click(), text);
const choices = (page) => page.evaluate(() => [...document.querySelectorAll('#game-dialogue-overlay button')].map((b) => b.textContent.replace(/\s+/g, ' ').trim()));

async function at(page, id) {
  await page.evaluate(() => document.getElementById('game-dialogue-overlay')?.remove());
  await useStation(page, id, true);
  await wait(250);
}

async function enterAirport(page) {
  await page.evaluate(() => { const g = window.game; g.player.stopMoving(); g.player.mesh.position.set(-14, 0, 6320); });
  await advance(page, 0.5);
  await page.click('#nav-btn-map');
  await wait(1500);
  await page.evaluate(() => document.querySelector('.map-pin[data-place="airport_los"]')?.click());
  await wait(500);
  await page.evaluate(() => document.getElementById('btn-card-go')?.click());
  return playUntil(page, () => (window.game.world.interiorManager.currentInterior?.type === 'airport' && !window.game.world.interiorManager.busy ? true : null), 30);
}

export async function run(browser, check) {
  const ctx = await newPlayer(browser);
  const { page, log } = await open(ctx);
  await closeDialogs(page);
  await page.evaluate(() => window.game.hud.backend.performGig(500_000, 0, 'test: arrivals money'));

  await enterAirport(page);
  const hall = await page.evaluate(() => window.game.world.interiorManager.currentInterior?.name ?? '');
  check('arrivals: map Go opens Murtala Muhammed terminal', /Murtala Muhammed/.test(hall), { hall });

  const stations = await page.evaluate(() => {
    const objs = window.game.world.interiorManager.getActiveInteractiveObjects?.()
      ?? window.game.world.interiorManager.airport?.interactiveList
      ?? [];
    const ids = objs.map((o) => o.id);
    return {
      telecom: ids.includes('airport_telecom_desk'),
      cab: ids.includes('airport_cab_pickup'),
      bags: ids.includes('airport_baggage_carousel'),
    };
  });
  check('arrivals: telecom desk, cab pickup and baggage claim stand in the hall',
    stations.telecom && stations.cab && stations.bags, stations);

  // SIM purchase
  const m0 = await money(page);
  await at(page, 'airport_telecom_desk');
  const telecomChoices = await choices(page);
  await choose(page, 'Buy a prepaid local SIM');
  await wait(400);
  const bag = await page.evaluate(() => window.game.hud.backend.getData().inventory.map((i) => i.id));
  const m1 = await money(page);
  check('arrivals: prepaid SIM costs ₦3,000 and goes in the bag',
    bag.includes('airport_sim') && m0.total - m1.total === 3000 && telecomChoices.some((c) => /SIM/i.test(c)),
    { bag, paid: m0.total - m1.total, telecomChoices: telecomChoices.slice(0, 4) });

  // Cab into town
  await at(page, 'airport_cab_pickup');
  const cabChoices = await choices(page);
  await choose(page, 'Cab into Lagos');
  await wait(800);
  await playUntil(page, () => (!window.game.world.interiorManager.currentInterior && !window.game.world.interiorManager.busy ? true : null), 20);
  const after = await page.evaluate(() => {
    const g = window.game;
    return {
      inside: !!g.world.interiorManager.currentInterior,
      x: g.player.position.x,
      z: g.player.position.z,
    };
  });
  const m2 = await money(page);
  check('arrivals: cab into Lagos costs ₦8,500 and drops the player on the street in town',
    !after.inside && m1.total - m2.total === 8500 && Math.hypot(after.x, after.z - 5) < 40
      && cabChoices.some((c) => /Cab into Lagos|Walk out to the kerb/i.test(c)),
    { after, paid: m1.total - m2.total, cabChoices: cabChoices.slice(0, 4) });

  check('arrivals: no page errors', log.errors.length === 0, log.errors.slice(0, 4));
}
