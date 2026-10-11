// Finding the way. A walk across the city goes round buildings and through gates, by the
// pavement for choice. The map finds a place by name, draws the way to it along the streets
// and says how far it is; choosing to walk there is a walk, not a jump; and nothing on the
// map of another city can be gone to without travelling to that city.
import { open, newPlayer, closeDialogs, advance, playUntil, money, wait, untilStopped } from './lib.mjs';

const put = (page, x, z) => page.evaluate(({ x, z }) => { const p = window.game.player; p.stopMoving(); p.onBridge = false; p.mesh.position.set(x, 0, z); }, { x, z });
const at = (page) => page.evaluate(() => { const p = window.game.player; return { x: +p.position.x.toFixed(2), z: +p.position.z.toFixed(2), y: +p.position.y.toFixed(2), moving: p.isMoving }; });

/** Sends the player walking and follows them: every place they were, and whether any of it was inside something solid. */
async function follow(page, x, z, seconds = 90) {
  await page.evaluate(({ x, z }) => { const g = window.game; g.player.setDestination(new g.player.position.constructor(x, 0, z)); }, { x, z });
  const trail = [];
  for (let t = 0; t < seconds; t += 0.2) {
    await advance(page, 0.2);
    const now = await page.evaluate(() => {
      const g = window.game;
      const p = g.player.position;
      return { x: +p.x.toFixed(2), z: +p.z.toFixed(2), y: +p.y.toFixed(2), moving: g.player.isMoving, inside: g.solidsHere().at(p.x, p.z, 0), on: g.waysHere().groundAt(p.x, p.z) };
    });
    trail.push(now);
    if (!now.moving) break;
  }
  return trail;
}

export async function run(browser, check) {
  const ctx = await newPlayer(browser);
  const { page, log } = await open(ctx);
  await closeDialogs(page);

  // ------------------------------------------------------------------ The way itself
  const found = await page.evaluate(() => {
    const g = window.game;
    const ways = g.waysHere();
    const solids = g.solidsHere();
    /** Walks a way in half-metre steps and counts the steps that brush something solid */
    const brushes = (fromX, fromZ, way) => {
      let hits = 0;
      let px = fromX;
      let pz = fromZ;
      for (const point of way.points) {
        const length = Math.hypot(point.x - px, point.z - pz);
        for (let d = 0; d <= length; d += 0.5) if (solids.at(px + ((point.x - px) * d) / (length || 1), pz + ((point.z - pz) * d) / (length || 1), 0.3)) hits += 1;
        px = point.x;
        pz = point.z;
      }
      return hits;
    };
    const timed = (a, b, c, d) => { const t = performance.now(); const way = ways.route(a, b, c, d); return { way, ms: performance.now() - t }; };
    const stadium = timed(10, 0, -60, 20);
    const quay = timed(10, 0, -60, 70);
    const across = timed(112, 0, -50, 48);
    const airside = timed(-80, -70, -125, -110);
    const straight = Math.hypot(-60 - 10, 20 - 0);
    const end = (way) => way.points[way.points.length - 1];
    return {
      stadium: { metres: +stadium.way.metres.toFixed(1), straight: +straight.toFixed(1), reaches: stadium.way.reaches, brushes: brushes(10, 0, stadium.way), byTheGate: stadium.way.points.some((p) => p.x < -42 && p.x > -54 && Math.abs(p.z - 5) < 4), ms: +stadium.ms.toFixed(1) },
      quay: { reaches: quay.way.reaches, brushes: brushes(10, 0, quay.way), byTheGate: quay.way.points.some((p) => p.x < -42 && p.x > -50 && Math.abs(p.z - 48) < 4.5) },
      across: { reaches: across.way.reaches, brushes: brushes(112, 0, across.way), metres: +across.way.metres.toFixed(1), ms: +across.ms.toFixed(1) },
      airside: { reaches: airside.way.reaches, end: end(airside.way), endsOutside: end(airside.way).z > -103, insideFence: solids.at(-125, -110, 0) },
    };
  });
  check('the way from Broad Street to a seat inside the stadium goes round its wall and in at Gate A: it reaches, it is longer than the crow flies, and no step of it touches a wall',
    found.stadium.reaches && found.stadium.byTheGate && found.stadium.brushes === 0 && found.stadium.metres > found.stadium.straight + 3, found.stadium);
  check('the way to the quay goes in at the port gate, and the way from Banana Island to the port crosses the whole city without touching a wall, found in well under a quarter of a second',
    found.quay.reaches && found.quay.byTheGate && found.quay.brushes === 0 && found.across.reaches && found.across.brushes === 0 && found.across.ms < 250, { quay: found.quay, across: found.across });
  check('a place behind the airport fence cannot be walked to: the way says so and ends outside the fence', !found.airside.reaches && found.airside.endsOutside, found.airside);

  // ------------------------------------------------------------------ Walking it
  await put(page, 10, 0);
  const toSeat = await follow(page, -60, 20);
  const seat = toSeat[toSeat.length - 1];
  check('sent from the east pavement to a spot inside the stadium, the player walks there by the gate, never inside a wall on the way',
    Math.hypot(seat.x + 60, seat.z - 20) < 0.5 && toSeat.every((s) => !s.inside) && toSeat.some((s) => s.x < -42 && s.x > -54 && Math.abs(s.z - 5) < 4), { seat, steps: toSeat.length, inside: toSeat.filter((s) => s.inside).length });

  await put(page, 10, -100);
  const along = await follow(page, 10, 100);
  const alongEnd = along[along.length - 1];
  const onPavement = along.filter((s) => s.on === 'pavement').length / along.length;
  check('a long walk down Broad Street keeps to the pavement, steps into the road only where a side street crosses, and stays on the ground under the footbridge',
    Math.hypot(alongEnd.x - 10, alongEnd.z - 100) < 0.5 && onPavement > 0.85 && along.every((s) => !s.inside && s.y < 0.05), { alongEnd, onPavement: +onPavement.toFixed(2), steps: along.length });

  await put(page, 8.5, -22);
  const atBank = await follow(page, 16, -22, 20);
  const bankEnd = atBank[atBank.length - 1];
  check('a spot in the middle of the bank is not somewhere to walk to: the player stops outside it', atBank.every((s) => !s.inside) && !bankEnd.moving && bankEnd.x < 10.5, bankEnd);

  // ------------------------------------------------------------------ The map: finding a place
  await put(page, 9, 0);
  const cash = (await money(page)).cash;
  await page.click('#nav-btn-map');
  await wait(1800);
  const header = await page.evaluate(() => document.querySelector('.map-top-bar').innerText);
  check('the map shows no made-up numbers (it used to claim 85,420 players online and 98% happiness)', !/Online|Happiness|85,420/.test(header), header.replace(/\n/g, ' | '));

  await page.type('#map-search-input', 'stad');
  await wait(400);
  const stadiumHits = await page.evaluate(() => [...document.querySelectorAll('.map-search-hit')].map((h) => h.innerText.replace(/\s*\n\s*/g, ' / ')));
  await page.evaluate(() => { document.getElementById('map-search-input').value = ''; });
  await page.type('#map-search-input', 'loading work');
  await wait(400);
  const byService = await page.evaluate(() => [...document.querySelectorAll('.map-search-hit')].map((h) => h.dataset.place));
  await page.evaluate(() => { document.getElementById('map-search-input').value = ''; });
  await page.type('#map-search-input', 'zzqx');
  await wait(400);
  const nothing = await page.evaluate(() => document.getElementById('map-search-results').innerText);
  check('typing in the map finds places by name ("stad" finds the National Stadium) and by what is done there ("loading work" finds the port), and says so when there is nothing',
    stadiumHits.length >= 1 && /National Stadium/.test(stadiumHits[0]) && byService.includes('apapa_port') && /Nothing called/.test(nothing), { stadiumHits, byService, nothing });

  // ------------------------------------------------------------------ The map: the way to a place
  await page.evaluate(() => { document.getElementById('map-search-input').value = ''; });
  await page.type('#map-search-input', 'hospital');
  await wait(400);
  await page.click('.map-search-hit[data-place="st_nicholas_hospital"]');
  await wait(600);
  const card = await page.evaluate(() => {
    const g = window.game;
    const note = document.getElementById('map-card-way')?.textContent ?? '';
    const way = g.wayTo(8.8, 75);
    const line = g.world.routeLine;
    const first = line.points[0];
    const last = line.points[line.points.length - 1];
    // Where the two ends of the line come out on screen, and where the card stands
    const camera = g.world.worldMap.mapCamera;
    camera.updateMatrixWorld();
    const onScreen = (p) => { const v = new g.player.position.constructor(p.x, 0, p.z).project(camera); return { x: Math.round(((v.x + 1) / 2) * innerWidth), y: Math.round(((1 - v.y) / 2) * innerHeight) }; };
    const cardBox = document.getElementById('map-context-card').getBoundingClientRect();
    const go = document.getElementById('btn-card-go').getBoundingClientRect();
    return {
      name: document.getElementById('map-card-name').textContent,
      note,
      metres: Math.round(way.metres),
      shown: line.group.visible,
      points: line.points.length,
      startsAtPlayer: Math.hypot(first.x - g.player.position.x, first.z - g.player.position.z) < 0.1,
      endsAtDoor: Math.hypot(last.x - 8.8, last.z - 75) < 0.6,
      ends: [onScreen(first), onScreen(last)],
      cardLeft: Math.round(cardBox.left),
      goInView: go.top >= cardBox.top && go.bottom <= Math.min(innerHeight, cardBox.bottom) + 1,
      car: document.querySelectorAll('.transport-tile[data-mode="car"]').length,
      tiles: document.querySelectorAll('.transport-tile').length,
      searchClosed: document.getElementById('map-search-results').style.display === 'none',
    };
  });
  check('choosing the hospital from the search opens its card, which says how far it is on foot, the same distance the way-finder gives',
    /St\. Nicholas/.test(card.name) && card.note.includes(`${card.metres.toLocaleString()} m on foot`) && card.searchClosed, { name: card.name, note: card.note, metres: card.metres });
  check('the way is drawn on the map from where the player stands to the hospital door, and both its ends are in view clear of the card',
    card.shown && card.points >= 2 && card.startsAtPlayer && card.endsAtDoor && card.ends.every((p) => p.x > 0 && p.x < card.cardLeft && p.y > 0 && p.y < 768) && card.goInView, card);
  check('the card no longer offers a free ride in a personal car to people who may not own one: a car is driven, not summoned', card.car === 0 && card.tiles >= 4, { car: card.car, tiles: card.tiles });

  // ------------------------------------------------------------------ Walking there from the map
  const before = await at(page);
  await page.click('.transport-tile[data-mode="walk"]');
  await page.click('#btn-card-go');
  await wait(500);
  await advance(page, 0.5);
  const setOff = await page.evaluate(() => {
    const g = window.game;
    return { x: +g.player.position.x.toFixed(2), z: +g.player.position.z.toFixed(2), moving: g.player.isMoving, mapOpen: g.world.worldMap.isActive, inside: g.world.interiorManager.isPlayerInside(), line: g.world.routeLine.group.visible };
  });
  check('Go on foot puts the map away and sets the player walking from where they were: they are not moved to the door (they used to be, at once and for nothing)',
    !setOff.mapOpen && setOff.moving && !setOff.inside && !setOff.line && Math.hypot(setOff.x - before.x, setOff.z - before.z) < 20 && Math.hypot(setOff.x - 8.8, setOff.z - 75) > 50, { before, setOff });
  const inHospital = await playUntil(page, () => {
    const g = window.game;
    return g.world.interiorManager.currentInterior?.type === 'hospital' && !g.world.interiorManager.busy ? true : null;
  }, 60);
  check('they walk the whole way and go in at the hospital door, and it has cost nothing', inHospital === true && (await money(page)).cash === cash, { inHospital, cash: (await money(page)).cash });

  // ------------------------------------------------------------------ A district, and a place with no inside
  await page.click('#nav-btn-map');
  await wait(1800);
  const outside = await at(page);
  await page.evaluate(() => [...document.querySelectorAll('.district-chip-btn')].find((b) => /Surulere/.test(b.textContent))?.click());
  await wait(500);
  await page.evaluate(() => document.getElementById('btn-card-travel-dest')?.click());
  await wait(500);
  await advance(page, 0.4);
  const toDistrict = await at(page);
  check('choosing a district and walking its streets is a walk there too, not a jump', toDistrict.moving && Math.hypot(toDistrict.x - outside.x, toDistrict.z - outside.z) < 20, { outside, toDistrict });
  await page.evaluate(() => window.game.player.stopMoving());

  // ------------------------------------------------------------------ Another city is not a walk away
  await page.click('#nav-btn-map');
  await wait(1800);
  await page.type('#map-search-input', 'aso rock');
  await wait(400);
  const abujaHit = await page.evaluate(() => [...document.querySelectorAll('.map-search-hit')].map((h) => ({ place: h.dataset.place, text: h.innerText.replace(/\s*\n\s*/g, ' / ') })));
  await page.click('.map-search-hit');
  await wait(900);
  const elsewhere = await page.evaluate(() => {
    const g = window.game;
    return {
      viewing: document.querySelector('.city-nav-tab.active')?.getAttribute('data-city'),
      here: g.world.cityManager.currentCityId,
      note: document.getElementById('map-card-elsewhere')?.textContent ?? '',
      go: !!document.getElementById('btn-card-go'),
      tiles: document.querySelectorAll('.transport-tile').length,
      interstate: !!document.getElementById('btn-card-interstate'),
      line: g.world.routeLine.group.visible,
    };
  });
  check('searching for Aso Rock from Lagos finds it in Abuja and puts the map of Abuja up; its card offers no ride and no walk, only how to travel to Abuja',
    abujaHit.length >= 1 && /In Abuja/.test(abujaHit[0].text) && elsewhere.viewing === 'abuja' && elsewhere.here === 'lagos' && /This is in Abuja\. You are in Lagos/.test(elsewhere.note) && !elsewhere.go && elsewhere.tiles === 0 && elsewhere.interstate && !elsewhere.line, { abujaHit, elsewhere });

  const stood = await at(page);
  const forced = await page.evaluate(() => {
    const g = window.game;
    const ui = g.hud.worldMapUI;
    const dest = g.modules.DestinationRegistry.getInstance().getById('dest_lagos_hospital');
    const walk = dest.transportAvailability.find((t) => t.mode === 'walk');
    const taxi = dest.transportAvailability.find((t) => t.mode === 'taxi');
    const before = g.hud.backend.getData().walletCash;
    const results = [ui.onTravelWithTransport(dest, walk, true), ui.onTravelWithTransport(dest, taxi, true)];
    ui.onTravelToDistrict(g.modules.WorldDataManager.getInstance().getDistricts()[0]);
    return { results, paid: before - g.hud.backend.getData().walletCash, mapOpen: g.world.worldMap.isActive, moving: g.player.isMoving, city: g.world.cityManager.currentCityId };
  });
  const still = await at(page);
  check('with the map of another city up, nothing takes the player anywhere or takes a fare, however it is asked for',
    forced.results.every((r) => r === false) && forced.paid === 0 && forced.mapOpen && !forced.moving && forced.city === 'lagos' && Math.hypot(still.x - stood.x, still.z - stood.z) < 0.1, { forced, stood, still });

  await page.click('#btn-card-interstate');
  await wait(500);
  const sheetUp = await page.evaluate(() => document.getElementById('interstate-modal')?.style.display !== 'none');
  check('the card leads to the flights and coaches instead', sheetUp, sheetUp);
  await page.evaluate(() => document.getElementById('interstate-close-btn')?.click());
  await page.click('#btn-map-back-street');
  await wait(600);

  // ------------------------------------------------------------------ Other cities have ways of their own, and no footbridge
  const abuja = await page.evaluate(() => {
    const g = window.game;
    g.arriveInCity('abuja');
    g.player.stopMoving();
    g.player.mesh.position.set(-11.2, 0, 10);
    const ways = g.waysHere();
    const way = ways.route(-11.2, 10, -11.2, 34);
    return { city: g.world.cityManager.currentCityId, solids: g.solidsHere().count, reaches: way?.reaches ?? false, metres: way ? +way.metres.toFixed(1) : null, on: ways.groundAt(-11.2, 20), road: ways.groundAt(0, 20) };
  });
  const inAbuja = await follow(page, -11.2, 34, 20);
  const abujaEnd = inAbuja[inAbuja.length - 1];
  check('in Abuja the way-finder knows that city: its pavement, its road and its buildings', abuja.city === 'abuja' && abuja.solids > 5 && abuja.reaches && abuja.on === 'pavement' && abuja.road === 'road', abuja);
  check('walking the west pavement of Abuja stays on the ground: the stairs of the Lagos footbridge are not there to climb (they were, unseen)',
    inAbuja.every((s) => s.y < 0.05) && Math.hypot(abujaEnd.x + 11.2, abujaEnd.z - 34) < 0.5, { abujaEnd, highest: Math.max(...inAbuja.map((s) => s.y)) });

  check('no errors were logged at any of it', log.errors.length === 0, log.errors.slice(0, 5));
  await wait(100);
  await ctx.close();
}
