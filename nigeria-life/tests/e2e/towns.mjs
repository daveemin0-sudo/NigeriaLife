// Abuja and Port Harcourt: each shop, office, hotel, bank and market door has its own name,
// the named places are on the map's search, and the room has the real activity.
import { open, newPlayer, closeDialogs, wait, playUntil } from './lib.mjs';
import { mkdirSync } from 'node:fs';

const SHOTS = process.env.SHOTS || '/opt/cursor/artifacts';

const doorsOf = (page, city) => page.evaluate((id) => {
  const list = window.game.world.cityManager.thingsIn(id).filter((o) => o.id.startsWith(`door-${id}-`));
  const names = list.map((o) => o.name);
  const unique = new Set(names).size === names.length;
  const kinds = {};
  for (const o of list) kinds[o.category] = (kinds[o.category] ?? 0) + 1;
  return { n: list.length, unique, kinds, sample: names.slice(0, 8) };
}, city);

const enterDoor = async (page, city, category) => {
  const door = await page.evaluate(([id, cat]) => {
    const found = window.game.world.cityManager.thingsIn(id).find((o) => o.id.startsWith(`door-${id}-`) && o.category === cat);
    if (!found) return null;
    const g = window.game;
    g.player.stopMoving();
    g.player.mesh.position.set(found.interactionPoint.x, 0, found.interactionPoint.z);
    g.hud.hideInteractionCard();
    g.hud.showInteractionCard(found);
    return { id: found.id, name: found.name };
  }, [city, category]);
  await page.evaluate(() => document.getElementById('card-action-btn')?.click());
  await playUntil(page, () => (window.game.world.interiorManager.currentInterior && !window.game.world.interiorManager.busy ? true : null), 25);
  await wait(400);
  const inside = await page.evaluate(() => {
    const g = window.game;
    const things = g.world.interiorManager.getActiveInteractiveObjects().map((o) => `${o.id} ${o.name}`);
    const room = g.world.interiorManager.currentInterior?.name ?? g.world.interiorManager.currentInterior?.id ?? null;
    return { room, names: things.slice(0, 24) };
  });
  return { door, inside };
};

/** On a phone the room's card starts folded, so its buttons are hidden until it is opened. */
const unfold = (page) => page.evaluate(() => {
  const card = document.getElementById('place-card');
  if (card?.classList.contains('is-folded')) document.getElementById('place-fold-btn')?.click();
  return document.getElementById('place-card')?.innerText ?? '';
});

/** Opens a spot's card and presses its button in one turn, before the game can swap the card. */
const useSpot = (page, pattern) => page.evaluate((source) => {
  const g = window.game;
  const re = new RegExp(source);
  const card = g.world.interiorManager.getActiveInteractiveObjects().find((o) => re.test(`${o.id} ${o.name}`));
  if (!card) return { ok: false, names: g.world.interiorManager.getActiveInteractiveObjects().map((o) => o.name).slice(0, 16) };
  g.player.stopMoving();
  g.hud.showInteractionCard(card);
  document.getElementById('card-action-btn')?.click();
  return { ok: true, name: card.name, dialogue: document.getElementById('game-dialogue-overlay')?.innerText?.slice(0, 280) ?? '' };
}, pattern);

const leave = async (page) => {
  await page.evaluate(() => {
    const g = window.game;
    return g.world.interiorManager.exitCurrentInterior(g.player, g.cameraManager, g.hud, g.world);
  });
  await playUntil(page, () => (!window.game.world.interiorManager.currentInterior && !window.game.world.interiorManager.busy ? true : null), 20);
};

export async function run(browser, check) {
  const ctx = await newPlayer(browser);
  const { page, log } = await open(ctx, { w: 390, h: 780 });
  await closeDialogs(page);
  await page.evaluate(() => { window.game.hud.backend.data.walletCash += 2_000_000; });

  const abuja = await doorsOf(page, 'abuja');
  const ph = await doorsOf(page, 'port_harcourt');
  const named = (d) => d.unique && d.kinds.Hotel > 0 && d.kinds.Shop > 0 && d.kinds.Bank > 0 && d.kinds.Market > 0 && d.kinds.Office > 0;
  check('towns: every Abuja and Port Harcourt door has its own name, one of each kind',
    named(abuja) && named(ph) && abuja.n > 100 && ph.n > 100, { abuja, ph });

  await page.evaluate(() => document.querySelector('.city-tab[data-city="abuja"]')?.click());
  await wait(400);
  const found = await page.evaluate(() => window.game.hud.worldMapUI.findPlaces('Suites Hotel').map((h) => ({ name: h.name, city: h.city, here: h.here })));
  const garki = await page.evaluate(() => window.game.hud.worldMapUI.findPlaces('Supermarket').filter((h) => h.city === 'abuja').map((h) => h.name));
  check('towns: the named Abuja places come up in the map search',
    found.some((h) => h.city === 'abuja' && h.here && /Suites Hotel/.test(h.name)) && garki.length > 0,
    { found, garki: garki.slice(0, 6) });

  mkdirSync(SHOTS, { recursive: true });
  await page.evaluate(() => {
    const ui = window.game.hud.worldMapUI;
    ui.open();
    const box = document.getElementById('map-search');
    box?.classList.add('is-open');
    const input = document.getElementById('map-search-input');
    if (input) {
      input.value = 'Wuse';
      input.dispatchEvent(new Event('input', { bubbles: true }));
    }
  });
  await wait(600);
  await page.screenshot({ path: `${SHOTS}/towns-abuja-search.png` });
  await page.evaluate(() => window.game.hud.worldMapUI.close());
  await wait(200);

  const hotel = await enterDoor(page, 'abuja', 'Hotel');
  const hotelText = await unfold(page);
  check('towns: an Abuja hotel has a front desk to check in, and a room',
    /Check in|Reception/.test(hotelText) && /Your room/.test(hotelText), { door: hotel.door, hotelText: hotelText.slice(0, 400) });
  await playUntil(page, () => (window.game.player.actor.scripted ? null : true), 12);
  const desk = await useSpot(page, 'place_.*_reception');
  await playUntil(page, () => ([...document.querySelectorAll('#game-dialogue-overlay button')].some((b) => /Tonight/.test(b.textContent)) ? true : null), 8);
  await page.evaluate(() => [...document.querySelectorAll('#game-dialogue-overlay button')].find((b) => /Tonight/.test(b.textContent))?.click());
  await playUntil(page, () => {
    const s = window.game.modules.TownStay?.get?.('abuja-town-hotel')?.current?.();
    if (s) return true;
    return window.game.player.actor.scripted ? null : 'idle';
  }, 12);
  await closeDialogs(page);
  const stay = await page.evaluate(() => {
    const s = window.game.modules.TownStay?.get?.('abuja-town-hotel')?.current?.();
    const key = window.game.hud.backend.getData().inventory.find((i) => /town_key_/.test(i.id));
    return { room: s?.room ?? null, key: key?.name ?? null };
  });
  check('towns: checking in at the Abuja hotel pays for a room and puts the key card in the bag', !!stay.room && /key card/i.test(stay.key ?? ''), { ...stay, desk });
  await useSpot(page, 'Your room');
  await playUntil(page, () => (/suite/.test(window.game.world.interiorManager.currentInterior?.id ?? '') && !window.game.world.interiorManager.busy ? true : null), 20);
  await wait(400);
  const room = await unfold(page);
  await page.screenshot({ path: `${SHOTS}/towns-abuja-room.png` });
  check('towns: the key opens a room with a bed', /Sleep|bed/i.test(room), room.slice(0, 240));
  await leave(page);

  const bank = await enterDoor(page, 'abuja', 'Bank');
  check('towns: an Abuja bank is the teller and the ATM',
    bank.inside.names.some((n) => /ATM/i.test(n)) && bank.inside.names.some((n) => /Teller/i.test(n)), bank.inside);
  await page.screenshot({ path: `${SHOTS}/towns-abuja-bank.png` });
  await leave(page);

  const shop = await enterDoor(page, 'abuja', 'Shop');
  check('towns: an Abuja supermarket has shelves and a till',
    shop.inside.names.some((n) => /shop_shelf_/.test(n)) && shop.inside.names.some((n) => /shop_checkout|Till/.test(n)), shop.inside);
  await page.screenshot({ path: `${SHOTS}/towns-abuja-shop.png` });
  await leave(page);

  const market = await enterDoor(page, 'port_harcourt', 'Market');
  const marketText = await unfold(page);
  check('towns: a Port Harcourt market has stalls to buy from',
    /Foodstuff|Rice|Ankara|Palm oil/.test(marketText), { door: market.door, marketText: marketText.slice(0, 400) });
  await page.screenshot({ path: `${SHOTS}/towns-ph-market.png` });
  await leave(page);

  const office = await enterDoor(page, 'port_harcourt', 'Office');
  const officeText = await unfold(page);
  const jobsDesk = await useSpot(page, 'Front desk|Reception');
  check('towns: a Port Harcourt office has work, and the Jobs app',
    /Jobs|manager|shift|openings|CV/i.test(`${officeText}\n${jobsDesk.dialogue ?? ''}`),
    { door: office.door, officeText: officeText.slice(0, 400), jobsDesk });
  await page.screenshot({ path: `${SHOTS}/towns-ph-office.png` });
  await leave(page);

  // Three office / shop / bank layouts per city so neighbouring doors are not clones.
  const layouts = await page.evaluate(() => {
    const templates = window.game.world.interiorManager.templates
      || window.game.world.interiorManager.getIdleWarmTargets?.()
      || [];
    const ids = templates.map((t) => t.def?.streetBuildingId || t.def?.id || t.def?.type || t.id).filter(Boolean);
    const need = (city, kind) => [
      `roadside-${city}-town-${kind}`,
      `roadside-${city}-town-${kind}-1`,
      `roadside-${city}-town-${kind}-2`,
    ];
    const present = (keys) => keys.filter((k) => ids.includes(k));
    const abuja = {
      office: present(need('abuja', 'office')),
      shops: present(need('abuja', 'shops')),
      bank: present(need('abuja', 'bank')),
    };
    const ph = {
      office: present(need('port_harcourt', 'office')),
      shops: present(need('port_harcourt', 'shops')),
      bank: present(need('port_harcourt', 'bank')),
    };
    return { abuja, ph, n: ids.length };
  });
  check('towns: Abuja and Port Harcourt each have three office, shop and bank room layouts',
    layouts.abuja.office.length === 3 && layouts.abuja.shops.length === 3 && layouts.abuja.bank.length === 3
      && layouts.ph.office.length === 3 && layouts.ph.shops.length === 3 && layouts.ph.bank.length === 3,
    layouts);

  // Ride drop-off: Trukadero street coords match the map pin (not the old grass-by-park spot).
  const drop = await page.evaluate(() => {
    const g = window.game;
    g.arriveInCity('abuja');
    const dest = g.rides.destinations().find((d) => /Trukadero/i.test(d.name));
    if (!dest) return { ok: false, reason: 'not listed' };
    const spot = g.setDownSpot(dest);
    const map = dest.mapPosition;
    const street = dest.streetPosition;
    const drift = Math.hypot(map.x - street.x, map.z - street.z);
    const toMap = Math.hypot(spot.x - map.x, spot.z - map.z);
    // Old buggy street was around (-11.5, -75); map pin is near (-42, 35).
    const toOldGrass = Math.hypot(spot.x - (-11.5), spot.z - (-75));
    return {
      ok: drift < 1 && toMap < 30 && toOldGrass > 40,
      name: dest.name,
      spot: { x: +spot.x.toFixed(1), z: +spot.z.toFixed(1) },
      map: { x: map.x, z: map.z },
      street: { x: street.x, z: street.z },
      drift, toMap, toOldGrass,
    };
  });
  check('towns: a ride to Trukadero sets down at the bowling pin, not the old grass spot',
    drop.ok === true, drop);

  check('towns: no errors in the page', log.errors.length === 0, log.errors.slice(0, 6));
  await ctx.close();
}
