// Flying between the cities, as a passenger does it: a ticket bought once, check-in, security,
// the gate, out to the apron, up the steps of the aircraft on the stand, the flight, and off
// at the other end on that city's apron. Lagos to Abuja, Abuja to Port Harcourt, and back.
import { open, newPlayer, closeDialogs, advance, playUntil, money, wait, useStation } from './lib.mjs';

const ticket = (page) => page.evaluate(() => window.game.flights.status());
/** Everything paid for travel so far. Quests pay out on arrival, so the purse alone does not show what a fare took. */
const fares = (page) => page.evaluate(() => window.game.hud.backend.getData().transactionHistory.filter((t) => t.type === 'TRAVEL_COST').reduce((sum, t) => sum + t.amount, 0));
const where = (page) => page.evaluate(() => {
  const g = window.game;
  return { city: g.world.cityManager.currentCityId, inside: g.world.interiorManager.currentInterior?.type ?? null, hall: g.world.interiorManager.currentInterior?.name ?? null, x: g.player.position.x, z: g.player.position.z, shown: g.player.mesh.visible };
});
const airport = (page, city) => page.evaluate((c) => {
  const a = window.game.world.airportOf(c);
  return a ? { ...a.status(), kerb: { x: a.kerb.x, z: a.kerb.z }, door: { x: a.apron.door.x, z: a.apron.door.z }, steps: { x: a.apron.steps.x, z: a.apron.steps.z } } : null;
}, city);
const said = (page, pattern) => page.evaluate((source) => new RegExp(source, 'i').test(document.body.innerText), pattern);
const choices = (page) => page.evaluate(() => [...document.querySelectorAll('#game-dialogue-overlay button')].map((b) => b.textContent.replace(/\s+/g, ' ').trim()).filter((t) => t && !/^(ok|close|continue)$/i.test(t)));
const choose = (page, text) => page.evaluate((t) => [...document.querySelectorAll('#game-dialogue-overlay button')].find((b) => b.textContent.includes(t))?.click(), text);
const near = (a, b, within = 1.5) => Math.hypot(a.x - b.x, a.z - b.z) < within;

/** Uses a desk, the scanner or a gate in the hall, as a player does, and waits for whatever it brings up. */
async function at(page, id) {
  await page.evaluate(() => document.getElementById('game-dialogue-overlay')?.remove());
  const used = await useStation(page, id, true);
  await wait(250);
  return used;
}

/** Stands at something outside, opens its card and returns what the button says. */
async function cardFor(page, id) {
  const prompt = await page.evaluate(async (key) => {
    const g = window.game;
    const o = g.world.interactiveObjects.find((x) => x.id === key);
    if (!o) return 'not-found';
    document.getElementById('game-dialogue-overlay')?.remove();
    g.hud.hideInteractionCard();
    g.player.stopMoving();
    g.player.mesh.position.set(o.interactionPoint.x, 0, o.interactionPoint.z);
    await g.advance(0.1);
    g.hud.showInteractionCard(o);
    return document.getElementById('card-action-btn')?.textContent ?? null;
  }, id);
  return prompt;
}
const press = (page) => page.evaluate(() => document.getElementById('card-action-btn')?.click());

/** Plays on until the aircraft of this city is on its stand with the door open. */
async function untilOnStand(page, city) {
  for (let i = 0; i < 80; i++) {
    if (await page.evaluate((c) => window.game.world.airportOf(c).atStand(), city)) return true;
    await advance(page, 2);
  }
  return false;
}

/** From the hall: desk, check-in, security and the right gate, for the flight to `to`. Leaves the player on the apron. */
async function throughTheHall(page, to, gateId) {
  await at(page, 'airport_checkin_desk');
  await choose(page, `to ${to}`);
  await wait(300);
  await at(page, 'airport_checkin_desk');
  await choose(page, 'Check in');
  await wait(300);
  await at(page, 'airport_security_gate');
  await at(page, gateId);
  return playUntil(page, () => (!window.game.world.interiorManager.currentInterior && !window.game.world.interiorManager.busy ? true : null), 20);
}

/** On the apron: up the steps and through the aircraft door. Returns whether the player was seen to climb. */
async function boardAtTheSteps(page, stepsId) {
  await cardFor(page, stepsId);
  await press(page);
  const climbed = await playUntil(page, () => (window.game.player.mesh.position.y > 0.6 ? true : null), 20);
  await playUntil(page, () => (window.game.flightExperience.isActive ? true : null), 15);
  return !!climbed;
}

export async function run(browser, check) {
  const ctx = await newPlayer(browser);
  const { page, log } = await open(ctx);
  await closeDialogs(page);
  await page.evaluate(() => window.game.hud.backend.performGig(400000, 0, 'test: travelling money'));
  const start = await money(page);

  // ------------------------------------------------------------------ From the map into the terminal
  await page.click('#nav-btn-map');
  await wait(1800);
  await page.evaluate(() => document.querySelector('.map-pin[data-place="airport_los"]')?.click());
  await wait(600);
  const sheet = await page.evaluate(() => document.getElementById('map-info-card')?.innerText ?? document.body.innerText);
  await page.evaluate(() => document.getElementById('btn-card-go')?.click());
  await playUntil(page, () => (window.game.world.interiorManager.currentInterior?.type === 'airport' && !window.game.world.interiorManager.busy ? true : null), 30);
  let here = await where(page);
  check('the airport is chosen on the map, its sheet says what it is, and Go takes the player into the terminal of Murtala Muhammed Airport',
    /Murtala Muhammed/.test(sheet) && here.inside === 'airport' && /Murtala Muhammed Airport \(LOS\)/.test(here.hall || ''), { here });

  // ------------------------------------------------------------------ Nothing without a ticket
  await at(page, 'airport_flight_abuja');
  const gateShut = (await where(page)).inside === 'airport' && (await said(page, 'gates are for passengers'));
  await at(page, 'airport_security_gate');
  const noPass = (await ticket(page)).active === false;
  check('without a ticket the gate lets nobody through and security wants a boarding pass: nothing is charged',
    gateShut && noPass && (await money(page)).total === start.total, { gateShut, noPass });

  // ------------------------------------------------------------------ The ticket, bought once
  await at(page, 'airport_checkin_desk');
  const offered = await choices(page);
  await choose(page, 'to Abuja');
  await wait(300);
  let held = await ticket(page);
  let paid = start.total - (await money(page)).total;
  check('the desk lists the flights from Lagos with their fares, and a ticket for NL 204 to Abuja is bought for ₦35,000',
    offered.some((o) => /NL 204 to Abuja/.test(o) && /35,000/.test(o)) && offered.some((o) => /NL 310 to Port Harcourt/.test(o) && /38,000/.test(o)) && held.active && held.flight === 'NL 204' && held.state === 'booked' && held.status === 'Scheduled' && paid === 35000,
    { offered, held, paid });

  // A second ticket cannot be bought while one is held, by any route
  await page.evaluate(() => window.game.hud.interstateModal.open('lagos'));
  await wait(400);
  await page.evaluate(() => document.querySelector('[data-dest-id="port_harcourt"]')?.click());
  await wait(400);
  await page.evaluate(() => window.game.hud.interstateModal.close());
  const direct = await page.evaluate(() => { const f = window.game.flights; return f.book(f.routesFrom('lagos')[0], 'lagos'); });
  check('while a ticket is held a second cannot be bought, at the desk or on the phone: the fare has been taken once',
    !direct.ok && /already hold a ticket/.test(direct.reason) && (await ticket(page)).flight === 'NL 204' && start.total - (await money(page)).total === 35000, { direct });

  // ------------------------------------------------------------------ In the right order
  await at(page, 'airport_security_gate');
  const tooSoon = (await ticket(page)).state === 'booked' && (await said(page, 'Check in at the desk first'));
  await at(page, 'airport_checkin_desk');
  const checkInOffered = await choices(page);
  await choose(page, 'Check in');
  await wait(300);
  held = await ticket(page);
  check('security will not pass a passenger who has not checked in; the desk then checks them in and gives a seat and a gate',
    tooSoon && checkInOffered.some((o) => /Check in/.test(o)) && checkInOffered.some((o) => /Hand the ticket back/.test(o)) && held.state === 'checked-in' && /^\d+[ACDF]$/.test(held.seat), { tooSoon, checkInOffered, held });

  await at(page, 'airport_flight_abuja');
  const notYet = (await where(page)).inside === 'airport';
  await at(page, 'airport_security_gate');
  held = await ticket(page);
  await at(page, 'airport_flight_ph');
  const wrongGate = (await where(page)).inside === 'airport' && (await said(page, 'leaves from Gate 1'));
  check('the gate is shut until security is cleared, and the other gate turns the passenger back to their own', notYet && held.state === 'cleared' && wrongGate, { notYet, held, wrongGate });

  await at(page, 'airport_flight_abuja');
  await playUntil(page, () => (!window.game.world.interiorManager.currentInterior && !window.game.world.interiorManager.busy ? true : null), 20);
  here = await where(page);
  let los = await airport(page, 'lagos');
  check('Gate 1 leads out on to the apron, in Lagos, with the aircraft held for its passenger', here.city === 'lagos' && !here.inside && near(here, los.door, 2) && los.waiting, { here, door: los.door, waiting: los.waiting });

  // ------------------------------------------------------------------ Boarding and the flight
  const onStand = await untilOnStand(page, 'lagos');
  const label = await cardFor(page, 'dest_lagos_airport-steps');
  const climbed = await boardAtTheSteps(page, 'dest_lagos_airport-steps');
  held = await ticket(page);
  here = await where(page);
  check('with the aircraft on the stand the steps offer "Board NL 204 to Abuja": the player walks up them and through the door, and the flight begins',
    onStand && /Board NL 204 to Abuja/.test(label || '') && climbed && held.state === 'boarded' && !here.shown && (await page.evaluate(() => window.game.flightExperience.isActive)), { onStand, label, climbed, held });

  const seen = [];
  for (let i = 0; i < 120; i++) {
    const status = (await ticket(page)).status;
    if (seen[seen.length - 1] !== status) seen.push(status);
    if (status === 'Arrived') break;
    await advance(page, 0.5);
    await wait(30);
  }
  await wait(1500);
  const order = ['Boarding closed', 'Taxiing', 'Taking off', 'In flight', 'Approaching', 'Landing', 'Arrived'];
  const departed = await airport(page, 'lagos');
  check('the flight goes through its states in order: boarding closed, taxiing, taking off, in flight, approaching, landing, arrived',
    JSON.stringify(seen) === JSON.stringify(order), seen);

  // ------------------------------------------------------------------ Abuja
  here = await where(page);
  held = await ticket(page);
  const abv = await airport(page, 'abuja');
  const things = await page.evaluate(() => window.game.world.interactiveObjects.map((o) => o.id));
  check('the player is in Abuja, at the foot of the steps of the aircraft that brought them, on the apron of Nnamdi Azikiwe Airport: the ticket is used and the fare was taken once',
    here.city === 'abuja' && here.shown && !here.inside && !!abv && near(here, abv.steps, 1) && abv.atStand && held.state === 'arrived' && !held.active && start.total - (await money(page)).total === 35000 && things.includes('abuja-airport') && !things.includes('surulere-stadium'),
    { here, held, steps: abv?.steps, lagosAircraft: departed.state });

  await cardFor(page, 'abuja-airport-apron-door');
  await press(page);
  await playUntil(page, () => (window.game.world.interiorManager.currentInterior?.type === 'airport' && !window.game.world.interiorManager.busy ? true : null), 20);
  const arrivals = await where(page);
  await page.evaluate(() => { const g = window.game; return g.world.interiorManager.exitCurrentInterior(g.player, g.cameraManager, g.hud, g.world); });
  await wait(1200);
  here = await where(page);
  check('from the apron the terminal is entered (it is Nnamdi Azikiwe Airport inside too) and left by its front door, which is on the street in Abuja',
    arrivals.inside === 'airport' && /Nnamdi Azikiwe Airport \(ABV\)/.test(arrivals.hall || '') && !here.inside && here.city === 'abuja' && near(here, abv.kerb, 1.5), { arrivals, here, kerb: abv.kerb });

  // What is nearby is Abuja's, with real distances, and is walked to
  await advance(page, 1.2);
  await wait(1200);
  const nearby = await page.evaluate(() => {
    const g = window.game;
    const pills = [...document.querySelectorAll('#radar-pills .radar-pill')];
    const first = g.world.interactiveObjects.find((o) => o.id === pills[0]?.dataset.place);
    return {
      title: document.getElementById('radar-loc-title')?.textContent,
      pills: pills.map((p) => p.textContent),
      real: first ? Math.abs(Math.hypot(first.interactionPoint.x - g.player.position.x, first.interactionPoint.z - g.player.position.z) - parseInt(pills[0].textContent.split('·').pop(), 10)) < 6 : false,
      second: pills[1]?.dataset.place ?? null,
    };
  });
  const stoodAt = await where(page);
  await page.evaluate(() => document.querySelectorAll('#radar-pills .radar-pill')[1]?.click());
  await advance(page, 0.6);
  const walking = await page.evaluate(() => ({ x: window.game.player.position.x, z: window.game.player.position.z }));
  const stepped = Math.hypot(walking.x - stoodAt.x, walking.z - stoodAt.z);
  await page.evaluate(() => { window.game.player.stopMoving(); window.game.hud.hideInteractionCard(); });
  check('the bar of nearby places now shows those of Abuja, with the real distance to each, and pressing one walks the player toward it instead of jumping there',
    /^Abuja/.test(nearby.title || '') && nearby.pills.length >= 3 && nearby.pills.some((p) => /Nnamdi Azikiwe/.test(p)) && !nearby.pills.some((p) => /CcHub|Quilox|Stadium|Apapa/.test(p)) && nearby.real && stepped > 0.3 && stepped < 8,
    { nearby, stepped });

  const plans = await page.evaluate(() => ({ abuja: window.game.validateCity('abuja').map((v) => `${v.rule}: ${v.what}`) }));
  check('Abuja with its airport still passes the city plan: the terminal door can be walked to from Shehu Shagari Way', plans.abuja.length === 0, plans.abuja);

  // ------------------------------------------------------------------ Abuja to Port Harcourt
  let before = await fares(page);
  const frontDoor = await cardFor(page, 'abuja-airport');
  await press(page);
  await playUntil(page, () => (window.game.world.interiorManager.currentInterior?.type === 'airport' && !window.game.world.interiorManager.busy ? true : null), 20);
  await at(page, 'airport_checkin_desk');
  const fromAbuja = await choices(page);
  await page.evaluate(() => document.getElementById('game-dialogue-overlay')?.remove());
  await throughTheHall(page, 'Port Harcourt', 'airport_flight_ph');
  here = await where(page);
  check('the terminal in Abuja sells Abuja\'s flights (NL 205 to Lagos, NL 420 to Port Harcourt), and Gate 2 leads out to Abuja\'s apron',
    /Go into the terminal/.test(frontDoor || '') && fromAbuja.some((o) => /NL 205 to Lagos/.test(o)) && fromAbuja.some((o) => /NL 420 to Port Harcourt/.test(o) && /36,000/.test(o)) && here.city === 'abuja' && near(here, abv.door, 2) && (await ticket(page)).state === 'cleared',
    { frontDoor, fromAbuja, here });

  await untilOnStand(page, 'abuja');
  await boardAtTheSteps(page, 'abuja-airport-steps');
  await page.evaluate(() => window.game.flightExperience.skipFlight());
  await wait(2000);
  here = await where(page);
  const phc = await airport(page, 'port_harcourt');
  check('NL 420 lands in Port Harcourt: the player is on the apron of its airport, charged ₦36,000 once',
    here.city === 'port_harcourt' && !!phc && near(here, phc.steps, 1) && (await fares(page)) - before === 36000 && (await ticket(page)).state === 'arrived', { here, charged: (await fares(page)) - before });

  // ------------------------------------------------------------------ And back to Lagos
  before = await fares(page);
  await cardFor(page, 'ph-airport-apron-door');
  await press(page);
  await playUntil(page, () => (window.game.world.interiorManager.currentInterior?.type === 'airport' && !window.game.world.interiorManager.busy ? true : null), 20);
  const phHall = (await where(page)).hall;
  await throughTheHall(page, 'Lagos', 'airport_flight_abuja');
  await untilOnStand(page, 'port_harcourt');
  await boardAtTheSteps(page, 'ph-airport-steps');
  await page.evaluate(() => window.game.flightExperience.skipFlight());
  await wait(2000);
  here = await where(page);
  los = await airport(page, 'lagos');
  const home = await page.evaluate(() => ({ lagosShown: window.game.world.landmarks.group.visible, things: window.game.world.interactiveObjects.some((o) => o.id === 'surulere-stadium') }));
  check('the return is flown from Port Harcourt\'s own airport (NL 311): the player lands back on the apron in Lagos, with Lagos round them again, charged ₦38,000 once',
    /Port Harcourt Airport \(PHC\)/.test(phHall || '') && here.city === 'lagos' && near(here, los.steps, 1) && home.lagosShown && home.things && (await fares(page)) - before === 38000, { phHall, here, home, charged: (await fares(page)) - before });

  const ph = await page.evaluate(() => window.game.validateCity('port_harcourt').map((v) => `${v.rule}: ${v.what}`));
  const lagos = await page.evaluate(() => window.game.validateCity('lagos').map((v) => `${v.rule}: ${v.what}`));
  check('Port Harcourt with its airport, and Lagos, pass the city plan', ph.length === 0 && lagos.length === 0, { ph, lagos });

  // ------------------------------------------------------------------ Handing a ticket back
  const purse = await money(page);
  const refund = await page.evaluate(() => {
    const f = window.game.flights;
    const sold = f.book(f.routesFrom('lagos')[1], 'lagos');
    const back = f.cancel();
    const again = f.book(f.routesFrom('lagos')[0], 'lagos');
    f.checkIn('lagos');
    const late = f.cancel();
    return { sold, back, again, late, state: f.status().state };
  });
  const net = purse.total - (await money(page)).total;
  check('a ticket handed back before check-in returns four fifths of the fare; once checked in it cannot be handed back',
    refund.sold.ok && refund.back.ok && refund.again.ok && !refund.late.ok && refund.state === 'checked-in' && net === 38000 - 30400 + 35000, { refund, net });

  // A ticket is for its own airport
  const elsewhere = await page.evaluate(() => { const f = window.game.flights; return { checkIn: f.checkIn('abuja'), board: f.board('abuja') }; });
  check('a ticket from Lagos is no use at another city\'s airport', !elsewhere.checkIn.ok && !elsewhere.board.ok, elsewhere);

  // ------------------------------------------------------------------ A coach still goes by road
  await page.evaluate(() => { const f = window.game.flights; f.clearSecurity('lagos'); f.board('lagos'); });
  await wait(800);
  await page.evaluate(() => window.game.flightExperience.skipFlight());
  await wait(2000);
  before = await fares(page);
  await page.evaluate(() => window.game.hud.interstateModal.open('abuja'));
  await wait(400);
  await page.evaluate(() => [...document.querySelectorAll('.btn-book-route')].find((b) => /Coach/i.test(b.textContent))?.click());
  await wait(800);
  const riding = await page.evaluate(() => ({ road: window.game.roadRideExperience.isActive, air: window.game.flightExperience.isActive }));
  await page.evaluate(() => window.game.roadRideExperience.skipRide());
  await wait(2500);
  here = await where(page);
  check('a coach is still a journey of its own, by road: Abuja to Lagos for its fare, with no aircraft in it',
    riding.road && !riding.air && here.city === 'lagos' && (await fares(page)) - before === 12000 && !(await ticket(page)).active, { riding, here, charged: (await fares(page)) - before });

  check('no errors were logged at any of it', log.errors.length === 0, log.errors.slice(0, 5));
  await ctx.close();
}
