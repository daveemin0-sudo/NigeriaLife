// Getting around without the keyboard: the room view shows the whole room, every station has a
// shortcut you can tap, and the map's pins lead to a sheet whose Go button takes you there.
import { open, wait, money, newPlayer, enterInterior, leaveInterior, leaveByDoor } from './lib.mjs';

const TYPES = ['hospital', 'bank', 'restaurant', 'police', 'residence', 'university', 'airport'];

/** Is this world point inside the picture the player sees? */
const onScreenFn = `(v) => { const cam = window.game.cameraManager.camera; cam.updateMatrixWorld(true); const p = v.clone(); p.y = 1; p.project(cam); return Math.abs(p.x) <= 1 && Math.abs(p.y) <= 1 && p.z < 1; }`;

export async function run(browser, check) {
  const ctx = await newPlayer(browser);
  const { page, log } = await open(ctx);

  // --- Room view and shortcuts in every interior
  for (const type of TYPES) {
    await enterInterior(page, type);
    await wait(1800);

    const view = await page.evaluate((onScreenSrc) => {
      const onScreen = eval(onScreenSrc);
      const g = window.game;
      const objects = g.world.interiorManager.getActiveInteractiveObjects();
      const chips = [...document.querySelectorAll('#place-card .place-chip')].map((c) => c.dataset.spot);
      return {
        playerVisible: onScreen(g.player.position),
        hidden: objects.filter((o) => !onScreen(o.interactionPoint)).map((o) => o.id),
        missingChips: objects.filter((o) => o.id !== 'interior_exit_door' && !chips.includes(o.id)).map((o) => o.id),
        cardShown: document.getElementById('place-card').style.display !== 'none',
      };
    }, onScreenFn);
    check(`${type}: on entering, the player and every station are in view`, view.playerVisible && view.hidden.length === 0, view.hidden.length ? view.hidden : undefined);
    check(`${type}: the place card lists a shortcut for everything in the room`, view.cardShown && view.missingChips.length === 0, view.missingChips.length ? view.missingChips : undefined);
    await leaveInterior(page);
  }

  // --- A shortcut walks the player to its station and opens it, with mouse clicks only
  await enterInterior(page, 'hospital');
  await wait(1500);
  const m0 = await money(page);
  await page.click('#place-card .place-chip[data-spot="hosp_pharmacy"]');
  let opened = null;
  for (let i = 0; i < 40 && opened !== 'hosp_pharmacy'; i++) {
    await wait(300);
    opened = await page.evaluate(() => window.game.hud.currentActiveObject?.id || null);
  }
  check('tapping the Pharmacy shortcut walks there and opens the pharmacy', opened === 'hosp_pharmacy', { opened });
  await page.click('#card-action-btn');
  await wait(400);
  const m1 = await money(page);
  check('the pharmacy purchase then works by mouse alone (₦1,800)', m0.cash - m1.cash === 1800, { paid: m0.cash - m1.cash });
  await page.evaluate(() => document.getElementById('dialogue-confirm-btn')?.click());
  await leaveByDoor(page);
  const left = await page.evaluate(() => ({ inside: window.game.world.interiorManager.isPlayerInside(), card: document.getElementById('place-card').style.display }));
  check('the Leave button exits and the place card goes away', !left.inside && left.card === 'none', left);

  // --- Map pins
  await page.click('#nav-btn-map');
  await wait(2500);
  const pins = await page.evaluate(async () => {
    const { WorldDataManager } = await import('/src/world/data/WorldDataManager.ts');
    const landmarks = WorldDataManager.getInstance().getLandmarks().length;
    const all = [...document.querySelectorAll('.map-pin')];
    return { landmarks, pins: all.length, named: all.every((p) => p.querySelector('.map-pin-name').textContent.length > 2), areas: document.querySelectorAll('.map-area-name').length };
  });
  check('the map has a named pin for every landmark, and area names', pins.pins === pins.landmarks && pins.pins > 0 && pins.named && pins.areas > 0, pins);

  await page.click('#btn-map-names');
  const namesOff = await page.evaluate(() => getComputedStyle(document.querySelector('.map-pin-name')).display);
  await page.click('#btn-map-names');
  const namesOn = await page.evaluate(() => getComputedStyle(document.querySelector('.map-pin-name')).display);
  check('the Names button hides and shows the place names', namesOff === 'none' && namesOn !== 'none', { namesOff, namesOn });

  // --- Destination sheet: fits the screen, pick transport, Go pays and walks you in
  await page.click('.map-pin[data-place="st_nicholas_hospital"]');
  await wait(600);
  const sheet = await page.evaluate(() => {
    const r = document.getElementById('map-context-card').getBoundingClientRect();
    return { fits: r.top >= 0 && r.left >= 0 && r.bottom <= innerHeight && r.right <= innerWidth, tiles: document.querySelectorAll('.transport-tile').length };
  });
  check('the destination sheet fits on screen and offers transport choices', sheet.fits && sheet.tiles >= 2, sheet);

  const before = await money(page);
  await page.click('.transport-tile[data-mode="keke"]');
  await page.click('#btn-card-go');
  await wait(3200);
  const after = await money(page);
  const arrived = await page.evaluate(() => ({ inside: window.game.world.interiorManager.currentInterior?.type || null, mapOpen: window.game.world.worldMap.isActive }));
  check('Go by keke charges the ₦400 fare and takes the player inside the hospital', before.cash - after.cash === 400 && arrived.inside === 'hospital' && !arrived.mapOpen, { fare: before.cash - after.cash, ...arrived });
  await leaveByDoor(page);

  // --- A fare the player cannot afford keeps them on the map
  await page.evaluate(() => { const be = window.game.hud.backend; be.depositToBank(be.getData().walletCash); });
  await page.click('#nav-btn-map');
  await wait(2000);
  await page.click('.map-pin[data-place="st_nicholas_hospital"]');
  await wait(500);
  await page.click('.transport-tile[data-mode="taxi"]');
  await page.click('#btn-card-go');
  await wait(600);
  const broke = await page.evaluate(() => ({ mapOpen: window.game.world.worldMap.isActive, inside: window.game.world.interiorManager.isPlayerInside() }));
  check('an unaffordable fare is refused and the player stays on the map', broke.mapOpen && !broke.inside, broke);
  await page.evaluate(() => document.getElementById('dialogue-confirm-btn')?.click());
  await page.evaluate(() => window.game.hud.backend.withdrawFromATM(20000));
  await page.click('#map-card-close');
  await wait(300);

  // --- A landmark with no interior lands the player at its spot on the street
  await page.click('.map-pin[data-place="quilox_vi"]');
  await wait(500);
  await page.click('#btn-card-go');
  await wait(2000);
  const quilox = await page.evaluate(() => ({ card: window.game.hud.currentActiveObject?.id || null, mapOpen: window.game.world.worldMap.isActive }));
  check('Go on a street landmark (Quilox) arrives there with its card open', quilox.card === 'quilox-club' && !quilox.mapOpen, quilox);

  // --- The chat no longer covers the game
  const chat = await page.evaluate(() => { const r = document.getElementById('street-chat-box').getBoundingClientRect(); return { w: Math.round(r.width), h: Math.round(r.height) }; });
  check('the chat starts as a small pill instead of a panel', chat.h < 60 && chat.w < 220, chat);

  check('places: no console errors', log.errors.length === 0, log.errors.slice(0, 5));
  await ctx.close();
}
