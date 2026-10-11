// One city at a time is what is drawn: its street outdoors, the room indoors, the city itself
// on its map. In Abuja and Port Harcourt the rooms behind doors are drawn as they are in
// Lagos, Lagos is not drawn over them, and the map of each city is that city as built, with a
// pin over every real place and none over a place that is not there.
import { open, newPlayer, closeDialogs, advance, playUntil, wait, leaveByDoor } from './lib.mjs';

const drawn = (page) => page.evaluate(() => {
  const g = window.game;
  const w = g.world;
  const shown = (object) => { for (let at = object; at; at = at.parent) if (!at.visible) return false; return true; };
  const bank = w.cityManager.lagosInteractiveObjects.find((o) => o.id === 'lagos-bank');
  return {
    city: w.cityManager.currentCityId,
    inside: w.interiorManager.currentInterior?.type ?? null,
    lagos: { roads: w.roads.group.visible, buildings: w.buildings.group.visible, landmarks: w.landmarks.group.visible, ground: w.groundMesh.visible, people: w.cityPopulation.group.visible, traffic: w.trafficSpawner.group.visible, bank: !!bank && shown(bank.mesh) },
    abuja: w.cityManager.abujaCity?.group.visible ?? false,
    portHarcourt: w.cityManager.portHarcourtCity?.group.visible ?? false,
    rooms: w.interiorManager.group.visible,
  };
});
const noneOfLagos = (d) => !d.lagos.roads && !d.lagos.buildings && !d.lagos.landmarks && !d.lagos.ground && !d.lagos.people && !d.lagos.traffic && !d.lagos.bank;
const allOfLagos = (d) => d.lagos.roads && d.lagos.buildings && d.lagos.landmarks && d.lagos.ground && d.lagos.people && d.lagos.traffic && d.lagos.bank;

/** Draws a frame and counts the different colours in it: an empty void is a handful, a furnished room is many. */
const colours = (page) => page.evaluate(() => {
  const g = window.game;
  g.render();
  const small = document.createElement('canvas');
  small.width = 160;
  small.height = 90;
  const ctx = small.getContext('2d');
  ctx.drawImage(g.renderer.domElement, 0, 0, 160, 90);
  const data = ctx.getImageData(0, 0, 160, 90).data;
  const seen = new Set();
  for (let i = 0; i < data.length; i += 4) seen.add(((data[i] >> 4) << 8) | ((data[i + 1] >> 4) << 4) | (data[i + 2] >> 4));
  return seen.size;
});

/** Goes in at the front door of the city's airport, as a player does. */
async function intoTheTerminal(page, doorId) {
  await page.evaluate((id) => {
    const g = window.game;
    const o = g.world.interactiveObjects.find((x) => x.id === id);
    document.getElementById('game-dialogue-overlay')?.remove();
    g.player.stopMoving();
    g.player.mesh.position.set(o.interactionPoint.x, 0, o.interactionPoint.z);
    g.hud.showInteractionCard(o);
    document.getElementById('card-action-btn').click();
  }, doorId);
  const inside = await playUntil(page, () => (window.game.world.interiorManager.currentInterior?.type === 'airport' && !window.game.world.interiorManager.busy ? true : null), 20);
  await advance(page, 0.5);
  return inside === true;
}

const mapPins = (page) => page.evaluate(() => {
  const g = window.game;
  const city = [...document.querySelectorAll('.city-nav-tab')].find((t) => t.classList.contains('active'))?.getAttribute('data-city');
  const things = g.world.cityManager.thingsIn(city);
  const pins = g.hud.worldMapUI.pinPlaces();
  return {
    viewing: city,
    real: g.world.worldMap.showingRealWorld,
    pins: pins.map((p) => p.id),
    // Every pin stands where something that can be walked up to really is
    onRealThings: pins.every((p) => p.real && (city === 'lagos' || things.some((o) => Math.hypot(o.interactionPoint.x - p.x, o.interactionPoint.z - p.z) < 0.5))),
    youAreHere: g.world.worldMap.renderer.playerIsHere,
  };
});

export async function run(browser, check) {
  const ctx = await newPlayer(browser);
  const { page, log } = await open(ctx);
  await closeDialogs(page);

  let now = await drawn(page);
  check('in Lagos the street of Lagos is what is drawn', now.city === 'lagos' && allOfLagos(now) && !now.abuja && !now.portHarcourt, now);

  // ------------------------------------------------------------------ Abuja: the street, the terminal, the street again
  await page.evaluate(() => window.game.arriveInCity('abuja'));
  await advance(page, 0.5);
  now = await drawn(page);
  check('in Abuja the street of Abuja is drawn and nothing of Lagos', now.city === 'abuja' && now.abuja && noneOfLagos(now) && !now.portHarcourt, now);

  const wentIn = await intoTheTerminal(page, 'abuja-airport');
  const hall = await drawn(page);
  const furnished = await colours(page);
  // What the same view looks like with the rooms put away, for comparison
  const empty = await page.evaluate(() => { window.game.world.interiorManager.group.visible = false; });
  const bare = await colours(page);
  await page.evaluate(() => { window.game.world.interiorManager.group.visible = true; });
  void empty;
  const label = await page.evaluate(() => ({ name: window.game.world.interiorManager.currentInterior?.name, district: window.game.world.interiorManager.currentInterior?.districtName, card: document.getElementById('place-card')?.innerText ?? '' }));
  check('inside the terminal at Abuja the hall is drawn: its desks, its gates and its people are on the screen (the room was not drawn at all in Abuja or Port Harcourt: the player stood in an empty sky)',
    wentIn && hall.inside === 'airport' && hall.rooms && !hall.abuja && noneOfLagos(hall) && furnished > 30 && furnished > bare * 2, { hall, coloursWithTheRoom: furnished, coloursWithout: bare });
  check('and it says it is in Abuja, not in Ikeja', /Nnamdi Azikiwe Airport/.test(label.name || '') && /Abuja/.test(label.district || '') && !/Ikeja/.test(label.card), label);

  await leaveByDoor(page);
  await advance(page, 0.5);
  now = await drawn(page);
  check('walking out of the terminal, the street of Abuja is back and Lagos is not drawn over it (it was: Broad Street, its traffic and its crowds, on top of Abuja)',
    now.city === 'abuja' && now.inside === null && now.abuja && noneOfLagos(now), now);

  // ------------------------------------------------------------------ The map of Abuja is Abuja
  await page.click('#nav-btn-map');
  await wait(1800);
  const abujaMap = await mapPins(page);
  const underMap = await drawn(page);
  const fake = ['transcorp_hilton', 'jabi_lake_mall', 'national_hospital_abuja', 'central_bank_abuja', 'novare_mall_wuse', 'national_assembly'];
  check('the map of Abuja is Abuja as built: the city itself under the map, a pin over each real place (the mosque, the Christian centre, the secretariat, Aso Rock, the cab rank, the motor park, the airport), and none for the hotel, malls, hospital and bank that were drawn on the old map and are not there',
    abujaMap.viewing === 'abuja' && abujaMap.real && abujaMap.onRealThings && abujaMap.youAreHere && abujaMap.pins.length === 7 && ['national_mosque', 'ecumenical_centre', 'federal_secretariat', 'aso_rock', 'abuja_cab_rank', 'utako_motor_park', 'abuja_airport'].every((id) => abujaMap.pins.includes(id))
      && !fake.some((id) => abujaMap.pins.includes(id)) && underMap.abuja && noneOfLagos(underMap), { abujaMap, underMap });

  await page.evaluate(() => window.game.hud.worldMapUI.goToPlace('utako_motor_park', 'abuja'));
  await wait(600);
  const way = await page.evaluate(() => ({ note: document.getElementById('map-card-way')?.textContent ?? '', line: window.game.world.routeLine.group.visible, points: window.game.world.routeLine.points.length, go: document.getElementById('btn-card-go')?.textContent ?? '' }));
  check('a place on it has the way drawn to it and the distance on foot, as in Lagos', /\d+ m on foot/.test(way.note) && way.line && way.points >= 2 && /Walk there/.test(way.go), way);

  // ------------------------------------------------------------------ Another city's map, looked at from here
  await page.evaluate(() => document.querySelector('.city-nav-tab[data-city="lagos"]').click());
  await wait(1200);
  const lagosFromAbuja = await mapPins(page);
  const lagosUnder = await drawn(page);
  check('from Abuja, the map of Lagos is Lagos: its streets and buildings under the map with its pins on them, without its people and traffic, with no "you are here", and Abuja put away',
    lagosFromAbuja.viewing === 'lagos' && lagosFromAbuja.real && lagosFromAbuja.pins.length >= 10 && !lagosFromAbuja.youAreHere && lagosUnder.lagos.roads && lagosUnder.lagos.buildings && lagosUnder.lagos.landmarks && lagosUnder.lagos.bank
      && !lagosUnder.lagos.people && !lagosUnder.lagos.traffic && !lagosUnder.abuja && lagosUnder.city === 'abuja', { lagosFromAbuja, lagosUnder });

  await page.click('#btn-map-back-street');
  await wait(900);
  await advance(page, 0.5);
  now = await drawn(page);
  check('putting the map away, the player is in Abuja as before: Abuja drawn, Lagos not', now.city === 'abuja' && now.abuja && noneOfLagos(now), now);

  // ------------------------------------------------------------------ Port Harcourt, before ever going there, and then there
  await page.evaluate(() => window.game.arriveInCity('lagos'));
  await advance(page, 0.5);
  now = await drawn(page);
  const backInLagos = now.city === 'lagos' && allOfLagos(now) && !now.abuja;
  await page.click('#nav-btn-map');
  await wait(1800);
  await page.evaluate(() => document.querySelector('.city-nav-tab[data-city="port_harcourt"]').click());
  await wait(1200);
  const phMap = await mapPins(page);
  const phUnder = await drawn(page);
  await page.type('#map-search-input', 'motor park');
  await wait(400);
  const parks = await page.evaluate(() => [...document.querySelectorAll('.map-search-hit')].map((h) => h.innerText.replace(/\s*\n\s*/g, ' / ')));
  await page.evaluate(() => { document.getElementById('map-search-input').value = ''; });
  await page.type('#map-search-input', 'zoo');
  await wait(400);
  const zoo = await page.evaluate(() => document.getElementById('map-search-results').innerText);
  check('from Lagos, the map of Port Harcourt is Port Harcourt as built, though the player has never been: the refinery, the bole spot, the university, the motor park and the airport, each pinned where it stands',
    backInLagos && phMap.viewing === 'port_harcourt' && phMap.real && phMap.onRealThings && phMap.pins.length === 5 && phMap.pins.includes('waterlines_motor_park') && phUnder.portHarcourt && !phUnder.lagos.roads && phUnder.city === 'lagos', { backInLagos, phMap, phUnder });
  check('searching finds the three motor parks, one in each city, and nothing for the zoo that was only ever on the old drawing',
    parks.length === 3 && parks.some((p) => /Waterlines/.test(p)) && parks.some((p) => /Jibowu/.test(p) && /In Lagos/.test(p)) && parks.some((p) => /Utako/.test(p) && /In Abuja/.test(p)) && /Nothing called/.test(zoo), { parks, zoo });
  await page.click('#btn-map-back-street');
  await wait(900);
  await advance(page, 0.5);
  now = await drawn(page);
  check('and back in the street it is Lagos again, with its people and traffic', now.city === 'lagos' && allOfLagos(now) && !now.abuja && !now.portHarcourt, now);

  await page.evaluate(() => window.game.arriveInCity('port_harcourt'));
  await advance(page, 0.5);
  const inPhTerminal = await intoTheTerminal(page, 'ph-airport');
  const phHall = await drawn(page);
  const phColours = await colours(page);
  await leaveByDoor(page);
  await advance(page, 0.5);
  now = await drawn(page);
  check('in Port Harcourt too the terminal is drawn inside, and outside it the street of Port Harcourt and no other',
    inPhTerminal && phHall.rooms && !phHall.portHarcourt && phColours > 30 && now.city === 'port_harcourt' && now.portHarcourt && noneOfLagos(now) && !now.abuja, { phHall, phColours, now });

  check('no errors were logged at any of it', log.errors.length === 0, log.errors.slice(0, 5));
  await wait(100);
  await ctx.close();
}
