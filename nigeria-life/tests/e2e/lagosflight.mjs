// Lagos MMIA flights path: papers required → buy ticket → check-in → security → board.
// Does not add cities, yellow card, or FX. Uses existing NL 204 LOS→ABV route.
import { open, newPlayer, closeDialogs, advance, playUntil, money, wait, useStation } from './lib.mjs';

const ticket = (page) => page.evaluate(() => window.game.flights.status());
const choose = (page, text) => page.evaluate((t) => [...document.querySelectorAll('#game-dialogue-overlay button')].find((b) => b.textContent.includes(t))?.click(), text);
const choices = (page) => page.evaluate(() => [...document.querySelectorAll('#game-dialogue-overlay button')].map((b) => b.textContent.replace(/\s+/g, ' ').trim()));

async function at(page, id) {
  await page.evaluate(() => document.getElementById('game-dialogue-overlay')?.remove());
  await useStation(page, id, true);
  await wait(250);
}

async function untilOnStand(page) {
  for (let i = 0; i < 80; i++) {
    if (await page.evaluate(() => window.game.world.airportOf('lagos').atStand())) return true;
    await advance(page, 2);
  }
  return false;
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
  await page.evaluate(() => window.game.hud.backend.performGig(40_000_000, 0, 'test: lagos flight money'));

  await enterAirport(page);
  const hall = await page.evaluate(() => window.game.world.interiorManager.currentInterior?.name ?? '');
  check('lagosflight: map Go opens Murtala Muhammed terminal', /Murtala Muhammed/.test(hall), { hall });

  // Without a passport: desk refuses domestic ticket, no charge
  const m0 = await money(page);
  await at(page, 'airport_checkin_desk');
  const offeredBare = await choices(page);
  await choose(page, 'to Abuja');
  await wait(400);
  const bare = await ticket(page);
  const m1 = await money(page);
  const refused = await page.evaluate(() => /passport|Passport Office/i.test(document.body.innerText));
  check('lagosflight: without a passport the desk will not sell a domestic ticket',
    !bare.active && m1.total === m0.total && refused && offeredBare.some((o) => /NL 204 to Abuja/.test(o)),
    { bare, paid: m0.total - m1.total, refused, offeredBare: offeredBare.slice(0, 4) });

  // Domestic hop needs passport only (visa / yellow card are for the Ibadan papers-gated hop)
  await page.evaluate(() => {
    const be = window.game.hud.backend;
    if (!be.getData().inventory.some((i) => i.id === 'ng_passport')) {
      be.addItem({ id: 'ng_passport', name: 'Nigerian passport', icon: '🛂', price: 70000, category: 'document', usable: false, description: 'test' });
    }
  });
  await at(page, 'airport_checkin_desk');
  await choose(page, 'to Abuja');
  await wait(400);
  let held = await ticket(page);
  const m2 = await money(page);
  check('lagosflight: with a passport, NL 204 to Abuja is sold for ₦95,000',
    held.active && held.flight === 'NL 204' && held.state === 'booked' && m0.total - m2.total === 95_000,
    { held, paid: m0.total - m2.total });

  await at(page, 'airport_checkin_desk');
  await choose(page, 'Check in');
  await wait(300);
  held = await ticket(page);
  check('lagosflight: check-in accepts papers and issues the boarding gate',
    held.state === 'checked-in', held);

  await at(page, 'airport_security_gate');
  held = await ticket(page);
  check('lagosflight: security clears the passenger', held.state === 'cleared', held);

  await at(page, 'airport_flight_abuja');
  await playUntil(page, () => (!window.game.world.interiorManager.currentInterior && !window.game.world.interiorManager.busy ? true : null), 20);
  const onStand = await untilOnStand(page);
  check('lagosflight: aircraft is on the Lagos apron stand', onStand, { onStand });

  await page.evaluate(() => {
    const g = window.game;
    const o = g.world.interactiveObjects.find((x) => x.id === 'dest_lagos_airport-steps');
    g.player.stopMoving();
    g.player.mesh.position.set(o.interactionPoint.x, 0, o.interactionPoint.z);
    g.hud.showInteractionCard(o);
  });
  const boardLabel = await page.evaluate(() => document.getElementById('card-action-btn')?.textContent ?? '');
  await page.evaluate(() => document.getElementById('card-action-btn')?.click());
  await playUntil(page, () => (window.game.flightExperience.isActive ? true : null), 20);
  const flying = await page.evaluate(() => ({
    flightOn: window.game.flightExperience.isActive,
    state: window.game.flights.status().state,
  }));
  check('lagosflight: boarding NL 204 starts the flight from Lagos',
    /Board NL 204|Abuja/i.test(boardLabel) && flying.flightOn && flying.state === 'boarded',
    { boardLabel, flying });

  await page.evaluate(() => window.game.flightExperience.skipFlight?.());
  await wait(500);

  check('lagosflight: no page errors', log.errors.length === 0, log.errors.slice(0, 4));
}
