// Getting about: the player's own car is a ride like any other, free, their driver at the wheel
// of their own car (in the phone's Ride app and on a place's sheet on the map); and the Red Line
// train is taken from the phone: from across town a keke to the nearest station first, then the
// gate, the platform, the train, and off at the station chosen.
import { open, newPlayer, closeDialogs, advance, wait, playUntil, money } from './lib.mjs';

const play = async (page, seconds) => { for (let t = 0; t < seconds; t += 0.5) { await advance(page, 0.5); await wait(10); } };

export async function run(browser, check) {
  const ctx = await newPlayer(browser);
  const { page, log } = await open(ctx);
  await closeDialogs(page);
  await page.evaluate(async () => {
    const g = window.game;
    g.world.skyEnvironment.setHour(10);
    const b = g.hud.backend; b.data.bank.balance += 200_000_000; b.data.walletCash += 60_000; b.saveData();
    await g.garage.buyNew('lexus_rx');
  });
  await wait(600);

  // ------------------------------------------------------------------ Your own car, from the phone
  await page.evaluate(() => { window.game.hud.phoneModal.open(); window.game.hud.phoneModal.openApp('ride'); });
  await wait(500);
  const tabs = await page.evaluate(() => [...document.querySelectorAll('#ride-tabs .nl-chip')].map((b) => b.textContent.trim()));
  const dest = await page.evaluate(() => document.querySelector('#ride-places [data-place]')?.dataset.place);
  await page.evaluate((id) => window.game.hud.phoneModal.openApp('ride', `d:${id}`), dest);
  await wait(500);
  const offer = await page.evaluate(() => {
    const rows = [...document.querySelectorAll('#ride-vehicles [data-ride]')];
    const own = rows.find((r) => r.dataset.ride === 'car');
    return { first: rows[0]?.dataset.ride, own: own?.textContent.replace(/\s+/g, ' ').trim() ?? null };
  });
  check('getting about: the Ride app has tabs for rides, the train and flights; with a car of their own it is offered first, as theirs and free',
    tabs.some((t) => /Rides/.test(t)) && tabs.some((t) => /Train/.test(t)) && tabs.some((t) => /Flights/.test(t)) && offer.first === 'car' && /Your Lexus/.test(offer.own ?? '') && /Free/.test(offer.own ?? ''), { tabs, offer });

  const m0 = await money(page);
  await page.evaluate(() => document.querySelector('#ride-vehicles [data-ride="car"]')?.click());
  await wait(300);
  const riding = await playUntil(page, () => (window.game.roadRideExperience?.isActive ? window.game.roadRideExperience.currentRide : null), 20);
  const m1 = await money(page);
  check('getting about: their driver brings their own car round and the trip is played in it, their own Lexus in its own paint, and nothing is paid',
    !!riding && riding.vehicleType === 'car' && riding.car?.body === 'lexus_rx' && m0.total === m1.total, { riding, paid: m0.total - m1.total });
  const arrived = await playUntil(page, () => (!window.game.roadRideExperience?.isActive && !window.game.rides.ride ? true : null), 40);
  check('getting about: the trip ends at the place, the player on the street there', !!arrived, { arrived });

  // ------------------------------------------------------------------ Your own car, from the map
  await page.evaluate(() => document.getElementById('nav-btn-map')?.click());
  await play(page, 1.5);
  // A place with rides to it, its sheet open on the map (the University of Lagos)
  const placeId = await page.evaluate(() => {
    const g = window.game;
    const reg = g.modules.DestinationRegistry.getInstance();
    const lms = g.modules.WorldDataManager.getInstance().getLandmarks();
    const lm = lms.find((l) => { const d = reg.getById(l.id); return d && d.city === 'lagos' && d.transportAvailability.some((t) => t.mode === 'taxi') && d.name !== g.player.lastArrival; });
    g.hud.worldMapUI.goToPlace(lm.id, 'lagos');
    return lm.id;
  });
  await wait(700);
  const tile = await page.evaluate(() => { const t = document.querySelector('.transport-tile[data-mode="car"]'); t?.click(); return { tile: t?.textContent.replace(/\s+/g, ' ').trim() ?? null, go: document.getElementById('btn-card-go')?.textContent ?? '' }; });
  const m2 = await money(page);
  await page.evaluate(() => document.getElementById('btn-card-go')?.click());
  const mapRide = await playUntil(page, () => (window.game.roadRideExperience?.isActive ? window.game.roadRideExperience.currentRide.car?.body ?? 'none' : null), 15);
  check('getting about: on a place’s sheet on the map their own car is a way there, free, and going by it plays the trip in it',
    /Your Lexus/.test(tile.tile ?? '') && /Free/.test(tile.go) && mapRide === 'lexus_rx' && (await money(page)).total === m2.total, { placeId, tile, mapRide });
  await playUntil(page, () => (!window.game.roadRideExperience?.isActive ? true : null), 40);
  await play(page, 1);

  // ------------------------------------------------------------------ The Red Line from the phone
  await page.evaluate(() => { window.game.hud.phoneModal.open(); window.game.hud.phoneModal.openApp('ride', 'train'); });
  await wait(500);
  const board = await page.evaluate(() => ({
    hero: document.getElementById('train-hero')?.textContent.replace(/\s+/g, ' ').trim() ?? '',
    rows: [...document.querySelectorAll('#train-stations [data-station]')].map((r) => r.textContent.replace(/\s+/g, ' ').trim()),
  }));
  check('getting about: the Train tab shows the nearest station, the keke there when it is far, and every station the line goes to with its fare and the next train',
    /From Oyingbo/.test(board.hero) && /keke/i.test(board.hero) && board.rows.length === 5 && board.rows.every((r) => /₦/.test(r) && /next train in \d+ min/.test(r)), board);

  const m3 = await money(page);
  await page.evaluate(() => document.querySelector('#train-stations [data-station="Yaba"]')?.click());
  const keke = await playUntil(page, () => (window.game.roadRideExperience?.isActive ? window.game.roadRideExperience.currentRide.vehicleType : null), 15);
  await playUntil(page, () => (!window.game.roadRideExperience?.isActive ? true : null), 40);
  const atGate = await page.evaluate(() => { const g = window.game; const gate = g.world.expressway.redLine.gate(0, -1); const gate2 = g.world.expressway.redLine.gate(0, 1); const p = g.player.position; return Math.min(Math.hypot(p.x - gate.x, p.z - gate.z), Math.hypot(p.x - gate2.x, p.z - gate2.z)); });
  check('getting about: from across town a keke takes the player to Oyingbo station (₦500) and sets them down at the gate', keke === 'keke' && atGate < 6, { keke, atGate: +atGate.toFixed(1) });

  // On to the train: through the gate, up, the platform, the train to Yaba
  let onTrain = false;
  let rodeIn = false;
  for (let i = 0; i < 120 && !rodeIn; i++) {
    await play(page, 4);
    const s = await page.evaluate(() => ({ seq: window.game.player.actor.sequence?.name ?? null, step: (() => { const q = window.game.player.actor.sequence; return q ? q.steps[q.index]?.name ?? null : null; })(), y: window.game.player.position.y, z: window.game.player.position.z }));
    if (/riding the Red Line/.test(s.step ?? '')) onTrain = true;
    if (onTrain && !s.seq) rodeIn = true;
  }
  const end = await page.evaluate(() => ({ z: window.game.player.position.z, y: window.game.player.position.y }));
  const m4 = await money(page);
  check('getting about: the player taps in, rides the Red Line and gets off at Yaba, down on the road there; ₦500 for the keke and ₦750 for the train',
    onTrain && rodeIn && Math.abs(end.z - 3470) < 140 && end.y < 0.5 && m3.total - m4.total === 1250, { onTrain, rodeIn, end, paid: m3.total - m4.total });

  check('getting about: no errors in the page', log.errors.length === 0, log.errors.slice(0, 5));
  await ctx.close();
}
