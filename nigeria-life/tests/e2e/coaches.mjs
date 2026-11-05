// Going between the cities by road, as a passenger does it: to the motor park, a ticket at
// the window, the conductor at the coach in the middle bay, the coach pulling out through the
// gate with the passenger on it, the road, and down at the motor park of the other city.
// A ticket bought on the sheet is only a ticket: the coach is still boarded at the park.
import { open, reload, newPlayer, closeDialogs, advance, playUntil, money, wait, untilStopped } from './lib.mjs';

const ticket = (page) => page.evaluate(() => window.game.coaches.status());
/** Everything paid for travel so far. Quests pay out on arrival, so the purse alone does not show what a fare took. */
const fares = (page) => page.evaluate(() => window.game.hud.backend.getData().transactionHistory.filter((t) => t.type === 'TRAVEL_COST').reduce((sum, t) => sum + t.amount, 0));
const where = (page) => page.evaluate(() => {
  const g = window.game;
  return { city: g.world.cityManager.currentCityId, x: +g.player.position.x.toFixed(1), z: +g.player.position.z.toFixed(1), shown: g.player.mesh.visible, road: g.roadRideExperience.isActive };
});
const park = (page, city) => page.evaluate((c) => {
  const p = window.game.world.motorParkOf(c);
  const coach = p.coach.getWorldPosition(new (window.game.player.position.constructor)());
  return { ...p.status(), name: p.name, zone: p.zone, gate: p.doors[0], setDown: { x: p.setDown.x, z: p.setDown.z }, coach: { x: +coach.x.toFixed(1), z: +coach.z.toFixed(1), shown: p.coach.visible }, things: p.interactive.map((o) => o.id) };
}, city);
const said = (page, pattern) => page.evaluate((source) => new RegExp(source, 'i').test(document.body.innerText), pattern);
const choices = (page) => page.evaluate(() => [...document.querySelectorAll('#game-dialogue-overlay button')].map((b) => b.textContent.replace(/\s+/g, ' ').trim()).filter((t) => t && !/^(ok|close|continue)$/i.test(t)));
const choose = (page, text) => page.evaluate((t) => [...document.querySelectorAll('#game-dialogue-overlay button')].find((b) => b.textContent.includes(t))?.click(), text);
const inside = (zone, p) => p.x > zone.minX && p.x < zone.maxX && p.z > zone.minZ && p.z < zone.maxZ;

/** Stands at something in the street, opens its card and returns what the button says. */
async function cardFor(page, id) {
  return page.evaluate(async (key) => {
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
}
const press = (page) => page.evaluate(() => document.getElementById('card-action-btn')?.click());

/** At the window: asks for a ticket to `to` and waits until it is in hand (or it is plain that it will not be). */
async function buyAtTheWindow(page, windowId, to) {
  await cardFor(page, windowId);
  await press(page);
  await wait(300);
  const offered = await choices(page);
  await choose(page, to);
  const reached = await playUntil(page, () => (window.game.player.actor.pose.arms === 'reach' ? { held: window.game.coaches.status().active } : null), 8);
  await playUntil(page, () => (window.game.coaches.status().active ? true : null), 5);
  await advance(page, 1.2);
  return { offered, reached };
}

/** At the coach: shows the ticket and goes aboard. Follows the coach out of the park and returns what was seen. */
async function boardTheCoach(page, coachId, city) {
  const before = await park(page, city);
  await cardFor(page, coachId);
  const label = await page.evaluate(() => document.getElementById('card-action-btn')?.textContent ?? '');
  await press(page);
  const showing = await playUntil(page, () => (window.game.player.actor.pose.arms === 'reach' && window.game.player.actor.sequence?.name === 'board the coach' ? true : null), 8);
  await playUntil(page, () => (window.game.coaches.status().state === 'boarded' ? true : null), 6);
  // The coach pulls out: where it and its passenger are, a few times on the way to the gate
  const trail = [];
  for (let i = 0; i < 40; i++) {
    const now = await page.evaluate((c) => {
      const g = window.game;
      const p = g.world.motorParkOf(c);
      const at = p.coach.getWorldPosition(new (g.player.position.constructor)());
      return { coach: { x: +at.x.toFixed(1), z: +at.z.toFixed(1) }, player: { x: +g.player.position.x.toFixed(1), z: +g.player.position.z.toFixed(1) }, shown: g.player.mesh.visible, road: g.roadRideExperience.isActive, leaving: p.status().leaving };
    }, city);
    trail.push(now);
    if (now.road) break;
    await advance(page, 0.25);
  }
  return { before, label, showing: !!showing, trail };
}

export async function run(browser, check) {
  const ctx = await newPlayer(browser);
  const { page, log } = await open(ctx);
  await closeDialogs(page);
  await page.evaluate(() => window.game.hud.backend.performGig(600000, 0, 'test: travelling money'));

  // ------------------------------------------------------------------ The parks
  const lagos = await park(page, 'lagos');
  const built = await page.evaluate(() => {
    const g = window.game;
    const p = g.world.motorParkOf('lagos');
    let meshes = 0;
    let triangles = 0;
    p.group.traverse((o) => { if (o.isMesh) { meshes += 1; triangles += (o.geometry.index ? o.geometry.index.count : o.geometry.attributes.position.count) / 3; } });
    const ways = g.waysHere();
    const reach = p.interactive.map((o) => ways.route(10, 0, o.interactionPoint.x, o.interactionPoint.z)?.reaches ?? false);
    const fenced = ways.route(10, 0, p.zone.minX + 3, p.zone.minZ + 3);
    const registry = g.modules.zonesFor ? true : false;
    const rows = Object.fromEntries(['lagos', 'abuja', 'port_harcourt'].map((city) => [city, g.coaches.routesFrom(city).map((r) => `${r.coach} ${r.to} ${r.fare}`)]));
    return { meshes, triangles: Math.round(triangles), reach, throughTheGate: !!fenced && fenced.points.some((pt) => Math.abs(pt.x - p.doors[0].x) < 4.5 && Math.abs(pt.z - p.doors[0].z) < 3), plan: g.validateCity('lagos').map((v) => `${v.rule}: ${v.what}`), generatedInIt: g.world.standingOnTheGround().filter((o) => /^Generated building/.test(o.owner) && o.maxX > p.zone.minX && o.minX < p.zone.maxX && o.maxZ > p.zone.minZ && o.minZ < p.zone.maxZ).length, registry, rows };
  });
  check('Jibowu Motor Park stands on Martins Street: a yard of over a thousand triangles in a handful of meshes, with a ticket window and a coach to board, both reached on foot through its gate, and Lagos still passes its plan with nothing generated on its ground',
    lagos.name === 'Jibowu Motor Park' && built.triangles > 1000 && built.meshes <= 10 && built.reach.every(Boolean) && built.throughTheGate && built.plan.length === 0 && built.generatedInIt === 0 && lagos.coachInBay && lagos.coach.shown, { lagos: { name: lagos.name, things: lagos.things }, built });
  check('there is a coach each way on every road between the three cities, from one timetable',
    built.rows.lagos.length === 2 && built.rows.abuja.length === 2 && built.rows.port_harcourt.length === 2 && built.rows.lagos.includes('SR 12 abuja 42000') && built.rows.port_harcourt.includes('SR 42 abuja 36000'), built.rows);

  // ------------------------------------------------------------------ No ticket, no coach
  const start = await fares(page);
  const noTicket = await cardFor(page, 'jibowu-park-coach');
  await press(page);
  await advance(page, 1.5);
  const turnedBack = { told: await said(page, 'wants to see a ticket'), state: (await ticket(page)).active, road: (await where(page)).road };
  check('the conductor lets nobody on without a ticket: the coach card says so and pressing it goes nowhere', /passengers with a ticket/.test(noTicket ?? '') && turnedBack.told && !turnedBack.state && !turnedBack.road, { noTicket, turnedBack });

  // ------------------------------------------------------------------ The sheet sells a ticket, and only a ticket
  const stood = await where(page);
  await page.evaluate(() => window.game.hud.interstateModal.open('lagos'));
  await wait(400);
  const sheet = await page.evaluate(() => [...document.querySelectorAll('.route-card')].filter((c) => /coach/i.test(c.innerText)).map((c) => c.innerText.replace(/\s*\n\s*/g, ' | ')));
  await page.evaluate(() => [...document.querySelectorAll('.btn-book-route')].find((b) => /Coach/i.test(b.textContent) && b.getAttribute('data-dest-id') === 'abuja')?.click());
  await wait(600);
  await advance(page, 1);
  const afterSheet = { ...(await where(page)), ticket: await ticket(page), charged: (await fares(page)) - start };
  check('the sheet lists the coaches from Lagos with their park and fare, and buying one there takes ₦42,000 for a ticket and moves nobody (it used to start the journey from wherever the player stood)',
    sheet.length === 2 && sheet.some((row) => /SR 12/.test(row) && /Jibowu Motor Park/.test(row) && /42,000/.test(row)) && afterSheet.city === 'lagos' && !afterSheet.road && afterSheet.shown
      && Math.hypot(afterSheet.x - stood.x, afterSheet.z - stood.z) < 0.5 && afterSheet.ticket.active && afterSheet.ticket.state === 'booked' && afterSheet.ticket.coach === 'SR 12' && afterSheet.charged === 42000, { sheet, afterSheet });

  // A second ticket is refused; the first can be handed back at the window for four fifths
  const purse = await money(page);
  const second = await page.evaluate(() => { const c = window.game.coaches; return c.buy(c.routesFrom('lagos')[1], 'lagos'); });
  const held = await cardFor(page, 'jibowu-park-tickets');
  await press(page);
  await wait(300);
  const offeredBack = await choices(page);
  await choose(page, 'Hand the ticket back');
  await playUntil(page, () => (window.game.coaches.status().active ? null : true), 8);
  await advance(page, 1.2);
  const handedBack = { ticket: await ticket(page), back: (await money(page)).total - purse.total };
  check('a second ticket cannot be bought while one is held; at the window the one held is handed back for four fifths of its fare',
    !second.ok && /Your ticket: SR 12 to Abuja/.test(held ?? '') && offeredBack.some((c) => /Hand the ticket back/.test(c) && /33,600/.test(c)) && !handedBack.ticket.active && handedBack.back === 33600, { second, held, offeredBack, handedBack });

  // ------------------------------------------------------------------ By the map to the park, and a ticket at the window
  await page.evaluate(() => { const p = window.game.player; p.stopMoving(); p.mesh.position.set(46, 0, -62); });
  await page.evaluate(() => { const g = window.game; const gate = g.world.motorParkOf('lagos').doors[0]; g.player.setDestination(new g.player.position.constructor(gate.x, 0, gate.z)); });
  const atGate = await untilStopped(page, 40);
  const before = await fares(page);
  const bought = await buyAtTheWindow(page, 'jibowu-park-tickets', 'Abuja');
  const now = await ticket(page);
  check('walking in at the gate and asking at the window: the clerk offers Abuja and Port Harcourt with fares and hours, the player reaches for the ticket before it is theirs, and ₦42,000 is taken once',
    !!atGate && Math.hypot(atGate.x - lagos.gate.x, atGate.z - lagos.gate.z) < 1 && bought.offered.some((c) => /Abuja, SR 12/.test(c) && /42,000/.test(c) && /10 hours/.test(c)) && bought.offered.some((c) => /Port Harcourt, SR 14/.test(c))
      && !!bought.reached && bought.reached.held === false && now.active && now.state === 'booked' && now.from === 'lagos' && now.to === 'abuja' && (await fares(page)) - before === 42000, { atGate, bought, now, charged: (await fares(page)) - before });

  // ------------------------------------------------------------------ The wrong park is no use
  const wrongPark = await page.evaluate(() => window.game.coaches.board('abuja'));
  check('a ticket from Lagos is no use at another city\'s park', !wrongPark.ok && /leaves from Jibowu Motor Park/.test(wrongPark.reason ?? ''), wrongPark);

  // ------------------------------------------------------------------ Aboard, out through the gate, and on to the road
  const ride = await boardTheCoach(page, 'jibowu-park-coach', 'lagos');
  const first = ride.trail[0];
  const last = ride.trail[ride.trail.length - 1];
  const moving = ride.trail.filter((s) => s.leaving);
  check('with a ticket the conductor is shown it and the player goes aboard; the coach pulls out of its bay and through the gate with them on it, and only then is the journey on the road',
    /Board SR 12 to Abuja/.test(ride.label) && ride.showing && moving.length >= 3 && moving.every((s) => !s.shown && !s.road && Math.hypot(s.player.x - s.coach.x, s.player.z - s.coach.z) < 0.6)
      && moving[moving.length - 1].coach.z > first.coach.z + 6 && last.road, { label: ride.label, showing: ride.showing, first, moving: moving.length, lastMoving: moving[moving.length - 1], last });

  // ------------------------------------------------------------------ Down at Utako
  await page.evaluate(() => window.game.roadRideExperience.skipRide());
  await wait(2500);
  await advance(page, 0.5);
  const there = await where(page);
  const utako = await park(page, 'abuja');
  const used = await ticket(page);
  check('the coach pulls in at Utako Motor Park in Abuja: the player gets down beside it in the middle bay, inside the park, the ticket used, with nothing more to pay',
    there.city === 'abuja' && there.shown && !there.road && Math.hypot(there.x - utako.setDown.x, there.z - utako.setDown.z) < 1 && inside(utako.zone, there) && utako.coachInBay && utako.coach.shown && used.state === 'arrived' && !used.active
      && (await fares(page)) - before === 42000 && (await said(page, 'pulled in at Utako Motor Park')), { there, utako: { name: utako.name, coach: utako.coach, things: utako.things }, used });

  await page.evaluate(() => { const g = window.game; const gate = g.world.motorParkOf('abuja').doors[0]; g.player.setDestination(new g.player.position.constructor(gate.x - 2, 0, gate.z)); });
  const out = await untilStopped(page, 30);
  check('and they walk out through its gate to Shehu Shagari Way', !!out && out.x < utako.zone.minX && Math.abs(out.z - utako.gate.z) < 2, { out, gate: utako.gate });

  // ------------------------------------------------------------------ Abuja to Port Harcourt, bought at the window that used to be a box
  const abujaWindow = await page.evaluate(() => { const o = window.game.world.interactiveObjects.find((x) => x.id === 'abuja-interstate-hub'); return o ? { name: o.name, inPark: true } : null; });
  const before2 = await fares(page);
  const bought2 = await buyAtTheWindow(page, 'abuja-interstate-hub', 'Port Harcourt');
  const ride2 = await boardTheCoach(page, 'utako-park-coach', 'abuja');
  const moving2 = ride2.trail.filter((s) => s.leaving);
  await page.evaluate(() => window.game.roadRideExperience.skipRide());
  await wait(2500);
  await advance(page, 0.5);
  const inPh = await where(page);
  const waterlines = await park(page, 'port_harcourt');
  check('what was a dark box called a coach park in Abuja is now the ticket window of Utako Motor Park; a ticket to Port Harcourt bought there (₦36,000) takes the coach out of its west gate and down at Waterlines Motor Park',
    !!abujaWindow && /Utako Motor Park, ticket window/.test(abujaWindow.name) && bought2.offered.some((c) => /Port Harcourt, SR 24/.test(c)) && (await fares(page)) - before2 === 36000 && moving2.length >= 3
      && moving2[moving2.length - 1].coach.x < ride2.trail[0].coach.x - 6 && inPh.city === 'port_harcourt' && inside(waterlines.zone, inPh) && waterlines.things.includes('ph-transit-hub'), { abujaWindow, inPh, lastMoving: moving2[moving2.length - 1] });

  // ------------------------------------------------------------------ The coach left behind comes back to its bay
  await page.evaluate(() => window.game.arriveInCity('lagos'));
  await advance(page, 0.5);
  const lagosAgain = await park(page, 'lagos');
  check('back in Lagos by any way, there is a coach in the middle bay of Jibowu again', lagosAgain.coachInBay && lagosAgain.coach.shown && Math.hypot(lagosAgain.coach.x - lagos.coach.x, lagosAgain.coach.z - lagos.coach.z) < 0.2, { coach: lagosAgain.coach });

  // ------------------------------------------------------------------ Closing the game on the road
  await page.evaluate(() => { const c = window.game.coaches; c.buy(c.routesFrom('lagos')[1], 'lagos'); });
  const ride3 = await boardTheCoach(page, 'jibowu-park-coach', 'lagos');
  const onTheRoad = ride3.trail[ride3.trail.length - 1].road;
  await reload(page);
  await closeDialogs(page);
  const resumed = await where(page);
  const phPark = await park(page, 'port_harcourt');
  const afterReload = await ticket(page);
  check('a game closed while the coach is on the road opens with the passenger down at the park it was going to, ticket used',
    onTheRoad && resumed.city === 'port_harcourt' && resumed.shown && inside(phPark.zone, resumed) && afterReload.state === 'arrived' && !afterReload.active, { onTheRoad, resumed, afterReload });

  check('no errors were logged at any of it', log.errors.length === 0, log.errors.slice(0, 5));
  await wait(100);
  await ctx.close();
}
