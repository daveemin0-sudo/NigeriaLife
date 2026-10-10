// The great places of Lagos: the stadium, the port and the airport are built as places, stand
// clear of the city round them, and what is done at each is acted out and settled exactly once.
import { open, newPlayer, closeDialogs, advance, playUntil, money, wait, useStation } from './lib.mjs';

const status = (page, id) => page.evaluate((key) => window.game.world.landmarks.status()[key], id);
const energy = (page) => page.evaluate(() => window.game.hud.backend.getData().stats.energy);
const setHour = (page, hour) => page.evaluate((h) => window.game.world.skyEnvironment.setHour(h), hour);

/** Stands at a thing in the street, opens its card and returns what its button says, without pressing it. */
async function cardFor(page, id) {
  const prompt = await page.evaluate(async (key) => {
    const g = window.game;
    const o = g.world.interactiveObjects.find((x) => x.id === key);
    if (!o) return 'not-found';
    g.hud.hideInteractionCard();
    g.player.actor.hold?.release();
    g.player.stopMoving();
    g.player.mesh.position.set(o.interactionPoint.x, 0, o.interactionPoint.z);
    await g.advance(0.1);
    return g.hud.currentInteractionTarget?.id || 'no-prompt';
  }, id);
  if (prompt !== id) return { prompt, label: null };
  await page.keyboard.press('e');
  await wait(350);
  const label = await page.evaluate(() => (window.game.hud.currentActiveObject ? document.getElementById('card-action-btn')?.textContent : null));
  return { prompt, label };
}
const press = (page) => page.evaluate(() => document.getElementById('card-action-btn')?.click());

export async function run(browser, check) {
  const ctx = await newPlayer(browser);
  const { page, log } = await open(ctx);
  await closeDialogs(page);
  await setHour(page, 14);
  await advance(page, 0.5);

  // ------------------------------------------------------------------ Built as places, on ground of their own
  const built = await page.evaluate(() => {
    const w = window.game.world;
    const out = {};
    for (const landmark of w.landmarks.list) {
      let triangles = 0;
      let meshes = 0;
      landmark.group.traverse((node) => {
        if (!node.isMesh) return;
        meshes += 1;
        const g = node.geometry;
        triangles += (g.index ? g.index.count : g.attributes.position.count) / 3 * (node.isInstancedMesh ? node.count : 1);
      });
      const z = landmark.zone;
      const inZone = w.cityDensity.fabric.footprints.filter((lot) => lot.maxX > z.minX && lot.minX < z.maxX && lot.maxZ > z.minZ && lot.minZ < z.maxZ).length;
      out[landmark.id] = { name: landmark.name, triangles: Math.round(triangles), meshes, bodies: landmark.obstructions.filter((o) => o.structure).length, inZone, doors: landmark.doors.length };
    }
    const zones = w.planInput().zones;
    return {
      landmarks: out,
      plan: w.validateCityPlan().map((v) => `${v.rule}: ${v.what} at (${v.at.x}, ${v.at.z})`),
      gaps: w.cityDensity.fabric.roadGaps,
      roads: [...new Set(zones.filter((zone) => zone.kind === 'carriageway').map((zone) => zone.street))],
      old: w.interactiveObjects.filter((o) => /Teslim Balogun/.test(o.name)).length,
    };
  });
  const places = Object.values(built.landmarks);
  check('the stadium, the port, the airport and the nightclub are each built from many parts, not a box: a thousand triangles or more in a handful of draw calls',
    places.length >= 4 && places.every((p) => p.triangles > 1000 && p.meshes <= 24 && p.bodies >= 1), built.landmarks);
  check('nothing of the generated city stands on the ground of any of them', places.every((p) => p.inZone === 0), built.landmarks);
  check('each has a road of its own to its gate: Stadium Road, Wharf Road and Airport Road, laid their whole length',
    ['Stadium Road', 'Wharf Road', 'Airport Road'].every((road) => built.roads.includes(road)) && built.gaps.length === 0, { roads: built.roads, gaps: built.gaps });
  check('with them in it, Lagos still passes its city plan: roads clear, pavements walkable, nothing overlapping, every gate reachable on foot', built.plan.length === 0, built.plan.slice(0, 6));
  check('the old white box of a stadium is gone', built.old === 0, built.old);

  // ------------------------------------------------------------------ The stadium: a match, a ticket, a seat
  const kickOff = await status(page, 'surulere-stadium');
  await advance(page, 20);
  const later = await status(page, 'surulere-stadium');
  check('a match is being played at the stadium in front of a crowd: the clock runs and the ball moves',
    kickOff.open && later.minute > kickOff.minute && kickOff.crowd > 500 && (later.ball.x !== kickOff.ball.x || later.ball.z !== kickOff.ball.z), { kickOff, later });

  await setHour(page, 3);
  await advance(page, 0.3);
  let before = await money(page);
  let card = await cardFor(page, 'surulere-stadium');
  await press(page);
  await advance(page, 3);
  const shut = await status(page, 'surulere-stadium');
  check('at three in the morning the stadium is closed: the card says so and no ticket can be bought',
    !shut.open && /Closed/.test(card.label || '') && !shut.hasTicket && (await money(page)).cash === before.cash, { card, shut });
  await setHour(page, 14);
  await advance(page, 0.3);

  // Too poor for a ticket
  await page.evaluate(() => { const b = window.game.hud.backend; b.spendCash(b.getData().walletCash - 1000, 'test: nearly broke'); });
  before = await money(page);
  card = await cardFor(page, 'surulere-stadium');
  await press(page);
  await playUntil(page, () => (window.game.player.actor.sequence ? null : true), 12);
  let seat = await status(page, 'surulere-stadium');
  check('with ₦1,000 the ₦1,500 ticket is refused and nothing is taken', /Buy a ticket/.test(card.label || '') && !seat.hasTicket && (await money(page)).cash === before.cash, { card, seat });

  await page.evaluate(() => window.game.hud.backend.performGig(8000, 0, 'test: paid'));
  before = await money(page);
  card = await cardFor(page, 'surulere-stadium');
  await press(page);
  // The player walks to the booth and the ticket changes hands there
  const walked = await playUntil(page, () => (window.game.player.actor.sequence ? true : null), 2);
  await playUntil(page, () => (window.game.world.landmarks.status()['surulere-stadium'].hasTicket ? true : null), 14);
  await playUntil(page, () => (window.game.player.actor.sequence ? null : true), 6);
  seat = await status(page, 'surulere-stadium');
  let after = await money(page);
  check('a ticket is bought at the booth: the player walks to it, and ₦1,500 is taken once', !!walked && seat.hasTicket && before.cash - after.cash === 1500, { walked, seat, paid: before.cash - after.cash });

  card = await cardFor(page, 'surulere-stadium');
  await press(page);
  const seated = await playUntil(page, () => {
    const g = window.game;
    const a = g.player.actor;
    return a.hold && a.pose.legs === 'sit' ? { x: g.player.mesh.position.x, z: g.player.mesh.position.z } : null;
  }, 30);
  const afterSeat = await money(page);
  check('with the ticket the card offers the seat, and the player walks in through Gate A and sits at the pitch side, charged nothing more',
    /take your seat/.test(card.label || '') && !!seated && seated.x < -46.5 && seated.x > -55 && afterSeat.cash === after.cash, { card, seated, paid: after.cash - afterSeat.cash });
  await page.evaluate(() => window.game.player.actor.hold?.release());
  const up = await page.evaluate(() => { const a = window.game.player.actor; return !a.hold && a.pose.legs !== 'sit'; });
  check('the player gets up from the seat and is free to walk again', up, up);

  // ------------------------------------------------------------------ The port: paid work, carried by hand
  let bay = await status(page, 'apapa-port');
  card = await cardFor(page, 'apapa-port-loading-bay');
  before = await money(page);
  const energyBefore = await energy(page);
  await press(page);
  const carrying = await playUntil(page, () => (window.game.player.actor.carried ? true : null), 12);
  // Pressing again while at work starts nothing new
  await press(page);
  const midway = await status(page, 'apapa-port');
  const done = await playUntil(page, () => (window.game.world.landmarks.status()['apapa-port'].bay === 'leaving' ? true : null), 90);
  const loaded = await status(page, 'apapa-port');
  after = await money(page);
  const energyAfter = await energy(page);
  check('at the loading bay the player carries three crates, one at a time, from the pallet to the lorry',
    bay.bay === 'ready' && /Load the lorry/.test(card.label || '') && !!carrying && midway.bay === 'loading' && !!done && loaded.cratesOnLorry === 3, { bay, card, carrying, midway, loaded });
  check('the load is paid for once, when the last crate is on: ₦9,000, and it costs 30% energy',
    after.cash - before.cash === 9000 && loaded.paidRuns === 1 && Math.round(energyBefore - energyAfter) === 30, { paid: after.cash - before.cash, runs: loaded.paidRuns, energy: energyBefore - energyAfter });

  card = await cardFor(page, 'apapa-port-loading-bay');
  await press(page);
  await advance(page, 2);
  const gone = await playUntil(page, () => { const s = window.game.world.landmarks.status()['apapa-port']; return s.bay === 'away' && !s.lorry.visible ? s : null; }, 30);
  const back = await playUntil(page, () => { const s = window.game.world.landmarks.status()['apapa-port']; return s.bay === 'ready' ? s : null; }, 60);
  check('the loaded lorry drives out of the gate and there is no work until the next one has come in',
    /next lorry/.test(card.label || '') && !!gone && !!back && back.cratesOnLorry === 0 && back.paidRuns === 1 && (await money(page)).cash === after.cash, { card, gone, back });

  // Walking away part-way through pays nothing and leaves nothing on the lorry
  before = await money(page);
  await cardFor(page, 'apapa-port-loading-bay');
  await press(page);
  await playUntil(page, () => (window.game.world.landmarks.status()['apapa-port'].loaded >= 1 ? true : null), 40);
  await page.evaluate(() => window.game.player.actor.sequence?.cancel());
  await advance(page, 0.5);
  const dropped = await status(page, 'apapa-port');
  const hands = await page.evaluate(() => !!window.game.player.actor.carried);
  check('walking off with the job half done pays nothing: the crates go back on the pallet and the bay is ready again',
    dropped.bay === 'ready' && dropped.cratesOnLorry === 0 && !hands && dropped.paidRuns === 1 && (await money(page)).cash === before.cash, { dropped, hands });

  // Too tired to work
  await page.evaluate(() => window.game.hud.backend.performGig(1, 65, 'test: worn out'));
  before = await money(page);
  const tired = await energy(page);
  await cardFor(page, 'apapa-port-loading-bay');
  await press(page);
  await advance(page, 3);
  const refused = await status(page, 'apapa-port');
  check('a player without the energy for it is not given the work', tired < 30 && refused.bay === 'ready' && (await money(page)).cash === before.cash, { tired, refused });

  // ------------------------------------------------------------------ The airport: an aircraft that works a flight
  const flight = await page.evaluate(() => {
    const w = window.game.world;
    const airport = w.landmarks.airport;
    const solid = w.standingOnTheGround().filter((o) => o.structure);
    const seen = [];
    const hits = [];
    let overCity = 0;
    let highest = 0;
    for (let t = 0; t < airport.flight.seconds; t += 0.5) {
      airport.flight.clock = t;
      airport.update(0, 12);
      const s = airport.status();
      if (seen[seen.length - 1] !== s.state) seen.push(s.state);
      highest = Math.max(highest, s.y);
      if (!s.visible) continue;
      // In the air it is only ever over the open ground to the west
      if (s.y > 0.5 && s.box.maxX > -125) overCity += 1;
      for (const o of solid) {
        if (o.height <= s.y) continue;
        if (o.maxX > s.box.minX && o.minX < s.box.maxX && o.maxZ > s.box.minZ && o.minZ < s.box.maxZ) hits.push(`${s.state} at ${t}s: ${o.owner}`);
      }
    }
    airport.flight.clock = 0;
    airport.update(0, 12);
    const s = airport.status();
    return { seen, hits: [...new Set(hits)].slice(0, 6), overCity, highest, airline: s.airline, route: s.route };
  });
  const order = ['Boarding', 'Pushback', 'Taxiing', 'Taking off', 'In flight', 'Approaching', 'Landing', 'Taxiing to the stand', 'Arrived'];
  check('an airliner works a whole flight at the airport, in order: boarding, pushback, taxi, take-off, away, approach, landing, taxi in, arrived',
    JSON.stringify(flight.seen) === JSON.stringify(order) && flight.highest > 30, flight);
  check('from stand to runway and back it never passes through a building, and in the air it is only ever over the open ground west of the city',
    flight.hits.length === 0 && flight.overCity === 0, { hits: flight.hits, overCity: flight.overCity });
  check('the airline is the game\'s own: NigeriaLife Air, flying to Abuja', flight.airline === 'NigeriaLife Air' && flight.route.to === 'Abuja', flight.route);

  const terminal = await useStation(page, 'dest_lagos_airport', false);
  await playUntil(page, () => (window.game.world.interiorManager.isPlayerInside() ? true : null), 20);
  const inside = await page.evaluate(() => window.game.world.interiorManager.isPlayerInside());
  check('the way in to the terminal is where it was, and still leads inside', terminal.ok && inside, { terminal, inside });
  if (inside) {
    await page.evaluate(() => { const g = window.game; return g.world.interiorManager.exitCurrentInterior(g.player, g.cameraManager, g.hud, g.world); });
    await wait(900);
  }

  // ------------------------------------------------------------------ Looking at a map is not travelling
  const start = await page.evaluate(() => { const g = window.game; g.player.mesh.position.set(10, 0, 0); return { city: g.world.cityManager.currentCityId, things: g.world.interactiveObjects.length }; });
  before = await money(page);
  await page.click('#nav-btn-map');
  await wait(1500);

  // The map of Lagos is Lagos itself, seen from above
  const seen = () => page.evaluate(() => {
    const g = window.game;
    const w = g.world;
    const pins = g.hud.worldMapUI.pinPlaces();
    const doors = [...g.rides.destinations().map((d) => d.streetPosition), ...w.interactiveObjects.map((o) => o.interactionPoint)];
    const nearest = (p) => Math.min(...doors.map((d) => Math.hypot(d.x - p.x, d.z - p.z)));
    // A place the size of a stadium is pinned in its middle
    const onLandmark = (p) => w.landmarks.list.some((l) => p.x > l.zone.minX && p.x < l.zone.maxX && p.z > l.zone.minZ && p.z < l.zone.maxZ);
    return {
      real: w.worldMap.renderer.realWorld,
      buildings: w.buildings.group.visible,
      streets: w.cityDensity.group.visible,
      landmarks: w.landmarks.group.visible,
      people: w.cityPopulation.group.visible,
      model: w.worldMap.renderer.group.visible,
      pins: pins.length,
      drawnOnly: pins.filter((p) => !p.real).map((p) => p.id),
      astray: pins.filter((p) => p.real && nearest(p) > 1 && !onLandmark(p)).map((p) => p.id),
      onLandmarks: pins.filter((p) => onLandmark(p)).map((p) => p.id),
    };
  });
  const lagosMap = await seen();
  check('the map of Lagos is the real city seen from above: its own streets, buildings and landmarks, without the crowd',
    lagosMap.real && lagosMap.buildings && lagosMap.streets && lagosMap.landmarks && !lagosMap.people, lagosMap);
  check('every pin on it stands over a real place in the city: a door a ride would drop you at, or the thing itself',
    lagosMap.pins >= 12 && lagosMap.drawnOnly.length === 0 && lagosMap.astray.length === 0 && ['airport_los', 'apapa_port', 'national_stadium'].every((id) => lagosMap.onLandmarks.includes(id)),
    { pins: lagosMap.pins, drawnOnly: lagosMap.drawnOnly, astray: lagosMap.astray, onLandmarks: lagosMap.onLandmarks });
  const clockBefore = await page.evaluate(() => window.game.world.landmarks.airport.flight.clock);
  await advance(page, 2);
  const clockAfter = await page.evaluate(() => window.game.world.landmarks.airport.flight.clock);
  check('what moves in the city moves on the map: the aircraft carries on with its flight', clockAfter > clockBefore, { clockBefore, clockAfter });

  await page.evaluate(() => document.querySelector('.city-nav-tab[data-city="abuja"]')?.click());
  await wait(900);
  const abujaMap = await seen();
  check('the map of another city is still a drawing, and Lagos is put away while it is up', !abujaMap.real && !abujaMap.buildings && !abujaMap.landmarks && abujaMap.model, abujaMap);
  const looking = await page.evaluate(() => {
    const g = window.game;
    return {
      city: g.world.cityManager.currentCityId,
      things: g.world.interactiveObjects.length,
      header: document.getElementById('map-ui-city-name')?.textContent,
      here: [...document.querySelectorAll('.city-nav-tab')].find((tab) => /you are here/.test(tab.textContent))?.getAttribute('data-city'),
      x: g.player.mesh.position.x,
    };
  });
  await page.evaluate(() => document.querySelector('.city-tab[data-city="port_harcourt"]')?.click());
  await wait(600);
  const second = await page.evaluate(() => window.game.world.cityManager.currentCityId);
  await page.evaluate(() => document.getElementById('btn-map-back-street')?.click());
  await wait(900);
  const closed = await page.evaluate(() => {
    const w = window.game.world;
    return { city: w.cityManager.currentCityId, lagosShown: w.cityDensity.group.visible && w.landmarks.group.visible && w.cityPopulation.group.visible, mapAway: !w.worldMap.renderer.group.visible };
  });
  check('choosing Abuja or Port Harcourt on the map shows that city\'s map and takes the player nowhere: they are still in Lagos, and nothing was paid',
    start.city === 'lagos' && looking.city === 'lagos' && second === 'lagos' && closed.city === 'lagos' && closed.lagosShown && closed.mapAway && looking.things === start.things && /Abuja/i.test(looking.header || '') && looking.here === 'lagos' && (await money(page)).total === before.total,
    { start, looking, second, closed });

  check('no errors were logged at any of it', log.errors.length === 0, log.errors.slice(0, 5));
  await ctx.close();
}
