// A place in another city is reached only by a flight, a coach, or the player's own jet.
// From each of Lagos, Abuja and Port Harcourt, on a phone: the map, a search, a cab, a phone
// ride, Home, a delivery, a job, the hospital, a quest, and a reload. Then one coach, one
// flight and one jet, each landing in the city it was going to.
import { open, reload, newPlayer, closeDialogs, advance, playUntil, wait, useStation } from './lib.mjs';

const where = (page) => page.evaluate(() => {
  const g = window.game;
  const spot = g.player.position;
  return {
    city: g.world.cityManager.currentCityId,
    x: +spot.x.toFixed(1),
    z: +spot.z.toFixed(1),
    inside: g.world.interiorManager.currentInterior?.id ?? null,
    type: g.world.interiorManager.currentInterior?.type ?? null,
    name: g.world.interiorManager.currentInterior?.name ?? null,
  };
});
const dialogue = (page) => page.evaluate(() => (document.getElementById('game-dialogue-overlay')?.innerText ?? '').replace(/\s+/g, ' ').trim());
const tap = (page, selector) => page.evaluate((s) => { const el = document.querySelector(s); el?.click(); return !!el; }, selector);
const choose = (page, text) => page.evaluate((t) => {
  const btn = [...document.querySelectorAll('#game-dialogue-overlay button')].find((b) => b.textContent.includes(t));
  btn?.click();
  return !!btn;
}, text);
const near = (a, b, within) => Math.hypot(a.x - b.x, a.z - b.z) < within;

async function leave(page) {
  if (!(await where(page)).inside) return;
  await page.evaluate(() => {
    const g = window.game;
    return g.world.interiorManager.exitCurrentInterior(g.player, g.cameraManager, g.hud, g.world);
  });
  await playUntil(page, () => (!window.game.world.interiorManager.currentInterior && !window.game.world.interiorManager.busy ? true : null), 15);
}

async function stand(page, city) {
  await leave(page);
  await page.evaluate(() => { document.getElementById('game-dialogue-overlay')?.remove(); window.game.hud.phoneModal.close(); window.game.hud.interstateModal.close(); });
  return page.evaluate((city) => {
    const g = window.game;
    g.arriveInCity(city);
    g.player.stopMoving();
    const doors = g.world.interactiveObjects ?? [];
    const door = doors.find((o) => String(o.id).startsWith(city === 'lagos' ? 'roadside-' : `door-${city}-`));
    const at = door?.interactionPoint ?? { x: 0, z: 8 };
    g.player.mesh.position.set(at.x + 8, 0, at.z + 8);
    g.player.position.copy(g.player.mesh.position);
    g.cameraManager.snapToPlayer(g.player, 'street');
    return { city: g.world.cityManager.currentCityId, x: g.player.position.x, z: g.player.position.z, door: door?.name ?? null };
  }, city);
}

/** Opens the map and takes a cab to a pin whose name matches. The ride is skipped once it has started. */
async function cabTo(page, pattern) {
  await page.evaluate(() => { document.getElementById('game-dialogue-overlay')?.remove(); window.game.hud.phoneModal.close(); if (window.game.roadRideExperience.isActive) window.game.roadRideExperience.skipRide(); });
  await tap(page, '#nav-btn-map');
  await wait(1600);
  const pin = await page.evaluate((source) => {
    const re = new RegExp(source, 'i');
    const pins = [...document.querySelectorAll('.map-pin')];
    const el = pins.find((p) => p.classList.contains('map-pin-road') && re.test(p.textContent || ''))
      || pins.find((p) => re.test(p.textContent || ''));
    if (!el) return null;
    el.click();
    return (el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 90);
  }, pattern);
  await wait(500);
  const how = await page.evaluate(() => {
    const taxi = document.querySelector('.transport-tile[data-mode="taxi"]');
    if (taxi) {
      taxi.click();
      document.getElementById('btn-card-go')?.click();
      return 'tile';
    }
    const cab = [...document.querySelectorAll('#game-dialogue-overlay button')].find((b) => /cab/i.test(b.textContent));
    cab?.click();
    return cab ? 'dialogue' : 'none';
  });
  await playUntil(page, () => (window.game.roadRideExperience.isActive ? true : null), 8);
  const ride = await page.evaluate(() => ({ to: window.game.roadRideExperience.currentRide?.destinationCityId ?? null, on: window.game.roadRideExperience.isActive }));
  if (ride.on) {
    await page.evaluate(() => window.game.roadRideExperience.skipRide());
    await wait(400);
  }
  await page.evaluate(() => document.getElementById('btn-map-back-street')?.click());
  await wait(300);
  return { pin, how, ride, here: await where(page) };
}

export async function run(browser, check) {
  const ctx = await newPlayer(browser);
  const { page, log } = await open(ctx, { w: 390, h: 780 });
  await closeDialogs(page);
  await page.evaluate(() => window.game.hud.backend.performGig(80_000_000, 0, 'test: fare money'));

  const found = [];
  for (const city of ['lagos', 'abuja', 'port_harcourt']) {
    const stood = await stand(page, city);
    const before = await where(page);

    const cab = await cabTo(page, city === 'lagos' ? 'supermarket|Naija Fresh' : 'supermarket');
    check(`${city}: a map cab to a supermarket stays in ${city} and sets the player down there`,
      !!cab.pin && cab.how !== 'none' && cab.ride.to === city && cab.here.city === city, { stood, before, cab });
    found.push({ city, cab: cab.pin, rideCity: cab.ride.to, after: cab.here.city });
    await stand(page, city);

    await tap(page, '#nav-btn-map');
    await wait(1200);
    await page.evaluate(() => {
      document.getElementById('map-card-elsewhere')?.remove();
      const actions = document.getElementById('map-card-actions');
      if (actions) actions.innerHTML = '';
    });
    const query = city === 'abuja' ? 'murtala' : 'aso rock';
    await page.evaluate(() => document.querySelector('.map-search-ico')?.click());
    await wait(200);
    await page.evaluate(() => { const input = document.getElementById('map-search-input'); input.value = ''; input.focus(); });
    await page.type('#map-search-input', query);
    await wait(400);
    const hits = await page.evaluate(() => [...document.querySelectorAll('.map-search-hit')].map((h) => ({ place: h.dataset.place, text: h.innerText.replace(/\s+/g, ' ').trim() })));
    await page.evaluate(() => document.querySelector('.map-search-hit')?.click());
    await wait(700);
    const card = await page.evaluate(() => ({
      viewing: document.querySelector('.city-nav-tab.active')?.getAttribute('data-city'),
      note: document.getElementById('map-card-elsewhere')?.textContent ?? '',
      interstate: !!document.getElementById('btn-card-interstate'),
      go: !!document.getElementById('btn-card-go'),
      tiles: document.querySelectorAll('.transport-tile').length,
      city: window.game.world.cityManager.currentCityId,
    }));
    check(`${city}: searching for a place in another city offers a flight or a coach and does not move the player`,
      hits.length >= 1 && /In /.test(hits[0].text) && card.interstate && !card.go && card.tiles === 0 && card.city === city, { query, hits: hits.slice(0, 3), card });
    await tap(page, '#btn-card-interstate');
    await wait(400);
    const sheet = await page.evaluate(() => document.getElementById('interstate-modal')?.style.display !== 'none' && window.game.hud.interstateModal.currentOriginCityId);
    check(`${city}: that card opens the flights terminal for the city the player is standing in`, sheet === city, { sheet });
    await page.evaluate(() => window.game.hud.interstateModal.close());
    await tap(page, '#btn-map-back-street');
    await wait(400);

    await page.evaluate(() => window.game.hud.phoneModal.openApp('ride'));
    await wait(400);
    const listed = await page.evaluate(() => [...document.querySelectorAll('#ride-places [data-place]')].map((el) => el.getAttribute('data-place')));
    const otherId = city === 'lagos' ? 'dest_abuja_garki_hospital' : 'dest_lagos_hospital';
    const refused = await page.evaluate((id) => window.game.rides.book(id, 'taxi'), otherId);
    const same = listed[0];
    let booked = null;
    if (same) {
      await page.evaluate((id) => document.querySelector(`#ride-places [data-place="${id}"]`)?.click(), same);
      await wait(300);
      booked = await page.evaluate(() => {
        const btn = document.querySelector('#ride-vehicles [data-act="book"]');
        const arg = btn?.getAttribute('data-arg') ?? null;
        btn?.click();
        return arg;
      });
      await playUntil(page, () => (window.game.roadRideExperience.isActive ? true : null), 12);
      await page.evaluate(() => { if (window.game.roadRideExperience.isActive) window.game.roadRideExperience.skipRide(); });
      await wait(300);
    }
    const afterRide = await where(page);
    check(`${city}: the phone lists this city's rides, refuses one in another city, and a booked ride stays here`,
      refused.ok === false && /air or by coach/.test(refused.reason ?? '') && afterRide.city === city && (!booked || afterRide.city === city),
      { listed: listed.length, refused, booked, afterRide });
    await page.evaluate(() => window.game.hud.phoneModal.close());

    await tap(page, '#nav-btn-home');
    await wait(500);
    const home = await dialogue(page);
    const homeWhere = await where(page);
    check(`${city}: Home with no home here does not enter a house in another city`,
      /rent or buy/i.test(home) && /hotel/i.test(home) && !homeWhere.inside && homeWhere.city === city, { home: home.slice(0, 220), homeWhere });
    await choose(page, 'Check into a hotel here');
    const lobby = await playUntil(page, () => {
      const g = window.game;
      const name = g.world.interiorManager.currentInterior?.name ?? '';
      return !g.world.interiorManager.busy && /hotel|suite/i.test(name) ? name : null;
    }, 15);
    const inLobby = await where(page);
    check(`${city}: Check into a hotel here opens a hotel in ${city}`, !!lobby && inLobby.city === city && /hotel|suite/i.test(lobby), { lobby, inLobby });
    await leave(page);

    await page.evaluate(() => window.game.hud.phoneModal.openApp('shopping'));
    await wait(400);
    const ordered = await page.evaluate(() => {
      document.querySelector('[data-add]')?.click();
      return !!document.querySelector('[data-add]');
    });
    await wait(250);
    await page.evaluate(() => document.getElementById('shopping-order-btn')?.click());
    await wait(200);
    const order = await page.evaluate(() => window.game.deliveries.order ? { total: window.game.deliveries.order.total, eta: window.game.deliveries.order.eta } : null);
    const spot = await where(page);
    if (order) {
      await playUntil(page, () => (window.game.deliveries.order ? null : true), 40);
    }
    const delivered = await where(page);
    check(`${city}: a delivery comes to the player and does not take them to another city`,
      ordered && order && delivered.city === city && near(delivered, spot, 3), { order, spot, delivered });
    await page.evaluate(() => window.game.hud.phoneModal.close());

    await page.evaluate(() => window.game.hud.phoneModal.openApp('jobs'));
    await wait(400);
    const job = await page.evaluate(() => {
      const btn = document.querySelector('[data-act="work-go"]');
      const arg = btn?.getAttribute('data-arg') ?? null;
      const label = btn?.textContent?.replace(/\s+/g, ' ').trim() ?? null;
      btn?.click();
      return { arg, label };
    });
    await wait(500);
    const jobWhere = await where(page);
    const flightsOpen = await page.evaluate(() => document.getElementById('interstate-modal')?.style.display !== 'none');
    const jobSaid = await dialogue(page);
    const jobStayed = jobWhere.city === city && near(jobWhere, delivered, 30);
    check(`${city}: Go to work for a workplace in another city offers the flight and stays put`,
      city === 'lagos' ? jobStayed : (flightsOpen || /Fly or take the coach/.test(jobSaid)) && jobStayed,
      { job, flightsOpen, jobSaid: jobSaid.slice(0, 180), jobWhere });
    if (await page.evaluate(() => window.game.roadRideExperience.isActive)) {
      await page.evaluate(() => window.game.roadRideExperience.skipRide());
      await wait(300);
    }
    await page.evaluate(() => { window.game.hud.interstateModal.close(); window.game.hud.phoneModal.close(); document.getElementById('game-dialogue-overlay')?.remove(); });

    await page.evaluate(() => window.game.hud.phoneModal.openApp('health'));
    await wait(300);
    const health = await page.evaluate(() => ({
      hospital: [...document.querySelectorAll('[data-route]')].map((el) => el.getAttribute('data-route')),
      police: document.querySelector('[data-act="to-lagos"]')?.textContent?.replace(/\s+/g, ' ').trim() ?? null,
    }));
    const localHospital = city === 'lagos' ? 'dest_lagos_hospital' : city === 'abuja' ? 'dest_abuja_garki_hospital' : 'dest_ph_upth';
    check(`${city}: Health offers this city's hospital, and the Lagos police station only from Lagos`,
      health.hospital.some((id) => id === `d:${localHospital}`) && !health.hospital.some((id) => id?.includes('dest_lagos') && city !== 'lagos') && (city === 'lagos' ? !health.police : /Lagos/.test(health.police || '')),
      health);
    await page.evaluate(() => {
      const d = window.game.hud.backend.getData();
      d.stats.health = 12;
      d.stats.hunger = 40;
      window.game.hud.phoneModal.openApp('health');
    });
    await wait(400);
    const called = await page.evaluate(() => {
      const btn = document.getElementById('health-ambulance');
      if (!btn || btn.disabled) return { clicked: false, disabled: btn?.disabled ?? null };
      btn.click();
      return { clicked: true, disabled: false };
    });
    if (city !== 'port_harcourt') {
      await playUntil(page, () => (!window.game.world.interiorManager.busy && window.game.world.interiorManager.currentInterior ? true : null), 12);
    }
    await wait(400);
    const ward = await where(page);
    const rightWard = city === 'lagos' ? ward.type === 'hospital' : city === 'abuja' ? /National Hospital/.test(ward.name || '') : !ward.inside;
    check(`${city}: the ambulance treats the player in ${city} and does not drive them to Lagos`, called.clicked && ward.city === city && rightWard, { called, ward });
    await leave(page);
    await page.evaluate(() => {
      const d = window.game.hud.backend.getData();
      d.stats.health = 80;
      d.stats.hunger = 80;
    });

    await page.evaluate(() => window.game.hud.questModal.open());
    await wait(300);
    const quest = await page.evaluate(() => {
      const g = window.game;
      const before = { x: g.player.position.x, z: g.player.position.z, city: g.world.cityManager.currentCityId };
      const btn = document.querySelector('.btn-track-quest');
      btn?.click();
      return { had: !!btn, before, city: g.world.cityManager.currentCityId, x: g.player.position.x, z: g.player.position.z };
    });
    check(`${city}: Track on a quest does not move the player`, quest.city === city && Math.hypot(quest.x - quest.before.x, quest.z - quest.before.z) < 0.1, quest);
    await page.evaluate(() => window.game.hud.questModal.close?.());
    await page.keyboard.press('Escape');

    await page.evaluate(() => window.game.hud.phoneModal.openApp('ride', 'train'));
    await wait(300);
    const train = await page.evaluate(() => document.getElementById('phone-screen-content')?.innerText?.replace(/\s+/g, ' ').slice(0, 240) ?? '');
    const trainWhere = await where(page);
    check(`${city}: the train ${city === 'lagos' ? 'is the Red Line' : 'says it runs in Lagos and does not take the player there'}`,
      trainWhere.city === city && (city === 'lagos' ? /Red Line/.test(train) : /No trains here/.test(train)), { train });
    await page.evaluate(() => window.game.hud.phoneModal.close());
  }

  // A Lagos house, looked at from Abuja and from Port Harcourt
  await stand(page, 'lagos');
  const rented = await page.evaluate(() => {
    const be = window.game.hud.backend;
    const r = be.rentProperty('prop_mushin_room');
    return { ok: r.success, message: r.message };
  });
  await stand(page, 'abuja');
  const beforeHome = await where(page);
  await tap(page, '#nav-btn-home');
  await wait(500);
  const away = await dialogue(page);
  const still = await where(page);
  check('Home in Abuja, with a house only in Lagos, says where it is and offers fly back or a hotel here',
    rented.ok && /Your home is in Lagos/.test(away) && /Olosha/.test(away) && /Fly back/.test(away) && /hotel/i.test(away) && !still.inside && still.city === 'abuja' && near(still, beforeHome, 1),
    { rented, away: away.slice(0, 280), still });
  await choose(page, 'Fly back');
  await wait(300);
  const origin = await page.evaluate(() => window.game.hud.interstateModal.isOpen && window.game.hud.interstateModal.currentOriginCityId);
  check('Fly back opens the flights terminal in Abuja, and the player is still in Abuja', origin === 'abuja' && (await where(page)).city === 'abuja', { origin });
  await page.evaluate(() => window.game.hud.interstateModal.close());

  await page.evaluate(() => window.game.modules.TownStay.get('abuja-town-hotel').checkIn(1, 72000));
  await tap(page, '#nav-btn-home');
  const suite = await playUntil(page, () => {
    const name = window.game.world.interiorManager.currentInterior?.name ?? '';
    return !window.game.world.interiorManager.busy && /room|suite/i.test(name) ? name : null;
  }, 15);
  const inSuite = await where(page);
  check('Home with a hotel room checked into in Abuja goes into that room, still in Abuja', !!suite && inSuite.city === 'abuja', { suite, inSuite });
  await leave(page);

  const abujaHome = await page.evaluate(() => window.game.hud.backend.rentProperty('prop_gwarinpa_duplex'));
  await tap(page, '#nav-btn-home');
  const house = await playUntil(page, () => (window.game.world.interiorManager.currentInterior?.type === 'residence' && !window.game.world.interiorManager.busy ? true : null), 15);
  const inHouse = await where(page);
  check('Home with a house in Abuja goes into it, and the player is still in Abuja', abujaHome.success && house === true && inHouse.city === 'abuja' && inHouse.type === 'residence', { abujaHome, inHouse });
  await leave(page);

  await stand(page, 'port_harcourt');
  await tap(page, '#nav-btn-home');
  await wait(400);
  const phAway = await dialogue(page);
  const phStill = await where(page);
  check('Home in Port Harcourt does not open the Abuja or Lagos house', /Your home is in /.test(phAway) && !/Port Harcourt/.test(phAway.split('Your home is in ')[1] || '') && !phStill.inside && phStill.city === 'port_harcourt', { phAway: phAway.slice(0, 240), phStill });
  await page.evaluate(() => document.getElementById('game-dialogue-overlay')?.remove());
  const phHome = await page.evaluate(() => window.game.hud.backend.rentProperty('prop_gra_duplex'));
  await tap(page, '#nav-btn-home');
  const phHouse = await playUntil(page, () => (window.game.world.interiorManager.currentInterior?.type === 'residence' && !window.game.world.interiorManager.busy ? true : null), 15);
  check('Home with a house in Port Harcourt goes into it, still in Port Harcourt', phHome.success && phHouse === true && (await where(page)).city === 'port_harcourt', { phHome });
  await leave(page);

  await stand(page, 'port_harcourt');
  const reloadFrom = await where(page);
  await reload(page);
  await closeDialogs(page);
  const back = await where(page);
  check('reloading brings the player back in the city they left', back.city === 'port_harcourt' && near(back, reloadFrom, 30), { reloadFrom, back });

  // Coach Lagos → Abuja, flight Abuja → Port Harcourt, jet Port Harcourt → Lagos
  await page.evaluate(() => {
    const d = window.game.hud.backend.getData();
    d.bank.balance = 200_000_000_000;
    window.game.hud.backend.saveData();
  });
  await stand(page, 'lagos');
  await page.evaluate(() => window.game.fleetSheet.open('jet'));
  await wait(300);
  await tap(page, '#fleet-sheet [data-choose="challenger"]');
  await tap(page, '#fleet-sheet [data-buy]');
  await wait(400);
  await page.evaluate(() => window.game.fleetSheet.close());

  const ticketWindow = await page.evaluate(async () => {
    const g = window.game;
    document.getElementById('game-dialogue-overlay')?.remove();
    const o = g.world.interactiveObjects.find((x) => x.id === 'jibowu-park-tickets');
    if (!o) return 'missing';
    g.player.stopMoving();
    g.player.mesh.position.set(o.interactionPoint.x, 0, o.interactionPoint.z);
    g.player.position.copy(g.player.mesh.position);
    await g.advance(0.1);
    g.hud.hideInteractionCard();
    g.hud.showInteractionCard(o);
    document.getElementById('place-fold-btn')?.click();
    document.getElementById('card-action-btn')?.click();
    return document.getElementById('card-action-btn')?.textContent ?? 'no-button';
  });
  await wait(500);
  const coachChoices = await page.evaluate(() => [...document.querySelectorAll('#game-dialogue-overlay button')].map((b) => b.textContent.replace(/\s+/g, ' ').trim()));
  await choose(page, 'Abuja');
  const coachTicket = await playUntil(page, () => (window.game.coaches.status().active ? window.game.coaches.status() : null), 15);
  await page.evaluate(async () => {
    const g = window.game;
    const o = g.world.interactiveObjects.find((x) => x.id === 'jibowu-park-coach');
    if (!o) return;
    g.player.stopMoving();
    g.player.mesh.position.set(o.interactionPoint.x, 0, o.interactionPoint.z);
    g.player.position.copy(g.player.mesh.position);
    await g.advance(0.1);
    g.hud.showInteractionCard(o);
    document.getElementById('place-fold-btn')?.click();
    document.getElementById('card-action-btn')?.click();
  });
  const boarded = await playUntil(page, () => (window.game.coaches.status().state === 'boarded' ? true : null), 15);
  const riding = await playUntil(page, () => {
    const g = window.game;
    if (g.world.cityManager.currentCityId === 'abuja') return 'arrived';
    if (g.roadRideExperience.isActive && g.coaches.status().state === 'boarded') return 'riding';
    return null;
  }, 30);
  if (riding === 'riding') {
    await page.evaluate(() => window.game.roadRideExperience.skipRide());
    await wait(600);
  }
  const utako = await page.evaluate(() => {
    const g = window.game;
    const p = g.world.motorParkOf('abuja');
    return { city: g.world.cityManager.currentCityId, x: g.player.position.x, z: g.player.position.z, setDown: { x: p.setDown.x, z: p.setDown.z }, name: p.name };
  });
  check('the coach from Lagos sets the player down at Utako Motor Park in Abuja',
    !!coachTicket && coachTicket.from === 'lagos' && coachTicket.to === 'abuja' && boarded === true && utako.city === 'abuja' && near(utako, utako.setDown, 2),
    { ticketWindow, coachChoices, coachTicket, boarded, utako });

  const airportDoor = await page.evaluate(async () => {
    const g = window.game;
    const o = (g.world.interactiveObjects ?? []).find((x) => x.id === 'abuja-airport');
    if (!o) return 'missing';
    g.player.stopMoving();
    g.player.mesh.position.set(o.interactionPoint.x, 0, o.interactionPoint.z);
    g.player.position.copy(g.player.mesh.position);
    await g.advance(0.1);
    g.hud.showInteractionCard(o);
    document.getElementById('place-fold-btn')?.click();
    document.getElementById('card-action-btn')?.click();
    return document.getElementById('card-action-btn')?.textContent ?? 'no-button';
  });
  const inHall = await playUntil(page, () => (window.game.world.interiorManager.currentInterior?.type === 'airport' && !window.game.world.interiorManager.busy ? true : null), 20);
  await useStation(page, 'airport_checkin_desk', true);
  await choose(page, 'Port Harcourt');
  await wait(400);
  const ticket = await page.evaluate(() => window.game.flights.status());
  check('the Abuja desk sells a ticket to Port Harcourt, and the player is still in Abuja', ticket.from === 'abuja' && ticket.to === 'port_harcourt' && (await where(page)).city === 'abuja', { airportDoor, inHall, ticket });
  await useStation(page, 'airport_checkin_desk', true);
  await choose(page, 'Check in');
  await wait(300);
  await useStation(page, 'airport_security_gate', true);
  await useStation(page, 'airport_flight_ph', true);
  await playUntil(page, () => (!window.game.world.interiorManager.currentInterior && !window.game.world.interiorManager.busy ? true : null), 20);
  await page.evaluate(async () => {
    const g = window.game;
    const o = (g.world.interactiveObjects ?? []).find((x) => x.id === 'abuja-airport-steps');
    if (!o) return;
    g.player.stopMoving();
    g.player.mesh.position.set(o.interactionPoint.x, 0, o.interactionPoint.z);
    g.player.position.copy(g.player.mesh.position);
    await g.advance(0.1);
    g.hud.showInteractionCard(o);
    document.getElementById('place-fold-btn')?.click();
    document.getElementById('card-action-btn')?.click();
  });
  await playUntil(page, () => (window.game.flightExperience.isActive ? true : null), 20);
  await page.evaluate(() => window.game.flightExperience.skipFlight());
  await wait(500);
  const apron = await page.evaluate((hall) => {
    const g = window.game;
    const steps = g.world.airportOf('port_harcourt')?.apron?.steps;
    return { city: g.world.cityManager.currentCityId, x: g.player.position.x, z: g.player.position.z, steps: steps ? { x: steps.x, z: steps.z } : null, hall };
  }, inHall === true);
  check('the flight from Abuja lands on the apron at Port Harcourt airport', apron.city === 'port_harcourt' && apron.steps && near(apron, apron.steps, 8), { airportDoor, apron });

  await page.evaluate(() => window.game.hud.interstateModal.open(window.game.world.cityManager.currentCityId));
  await wait(300);
  const jetBtn = await page.evaluate(() => {
    const btn = document.querySelector('#interstate-own-jets .btn-own-jet[data-to="lagos"]');
    btn?.click();
    return !!btn;
  });
  const landed = await page.evaluate(() => new Promise((resolve) => {
    const start = performance.now();
    const tick = () => {
      const g = window.game;
      const city = g.world.cityManager.currentCityId;
      if (city !== 'lagos' && performance.now() - start < 8000) { setTimeout(tick, 100); return; }
      const steps = g.world.airportOf('lagos')?.apron?.steps;
      const pos = g.player.position;
      let nearJet = null;
      g.world.expressway.roadside.craft.forEach((mesh) => {
        const home = mesh.userData.home;
        if (!home) return;
        const d = Math.hypot(pos.x - home.x, pos.z - home.z);
        nearJet = nearJet === null ? d : Math.min(nearJet, d);
      });
      resolve({ city, nearSteps: steps ? Math.hypot(pos.x - steps.x, pos.z - steps.z) : null, nearJet });
    };
    tick();
  }));
  check('the player\'s own jet from Port Harcourt lands in Lagos, on the apron or beside the jet',
    jetBtn && landed.city === 'lagos' && ((landed.nearSteps !== null && landed.nearSteps < 12) || (landed.nearJet !== null && landed.nearJet < 14)),
    { jetBtn, landed });

  // The yacht desk's cruise must not sail an Abuja player onto the Lagos lagoon
  await stand(page, 'abuja');
  const yachtBefore = await where(page);
  await page.evaluate(() => window.game.world.expressway.roadside.hooks.cruise('no-such-yacht'));
  await wait(300);
  const yacht = await where(page);
  const yachtSaid = await dialogue(page);
  check('a cruise, asked for from Abuja, offers the flight to Lagos and leaves the player where they stand', yacht.city === 'abuja' && near(yacht, yachtBefore, 1) && /Lagos/.test(yachtSaid) && /air or by coach/.test(yachtSaid), { yachtSaid: yachtSaid.slice(0, 200), yacht });

  check('crosscity: no errors in the page', log.errors.length === 0, log.errors.slice(0, 6));
}
