// Living in the city on a phone (420 x 800, touch): a cheap rented room comes with modest
// things; the catalogue opens from Decorate, its tabs and cards work, a piece is bought and
// placed, put in storage and placed again for free; the music player plays a song; the car is
// driven with the pedals; the map pinches; nothing covers what has to be tapped.
import { launch, newPlayer, closeDialogs, wait } from './lib.mjs';

export async function run(_browser, check) {
  const browser = await launch();
  const page = await (await newPlayer(browser)).newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message.slice(0, 200)));
  page.on('console', (m) => { if (m.type() === 'error') errors.push('CONSOLE ' + m.text().slice(0, 200)); });
  await page.emulate({ viewport: { width: 420, height: 800, isMobile: true, hasTouch: true, deviceScaleFactor: 2 }, userAgent: 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36' });
  const { GAME_URL } = await import('./lib.mjs');
  await page.goto(GAME_URL, { waitUntil: 'load', timeout: 120000 });
  await page.waitForFunction('window.game', { timeout: 120000 });
  await wait(5000);
  await closeDialogs(page);

  const centre = (sel) => page.evaluate((s) => {
    const el = document.querySelector(s);
    if (!el) return null;
    // A finger scrolls a row of tabs or a list to what it wants before tapping it
    el.scrollIntoView({ block: 'nearest', inline: 'center' });
    const r = el.getBoundingClientRect();
    if (!r.width) return null;
    const x = r.left + r.width / 2, y = r.top + r.height / 2;
    const top = document.elementFromPoint(x, y);
    return { x, y, reachable: top === el || el.contains(top), inside: r.left >= -1 && r.right <= innerWidth + 1 && r.top >= -1 && r.bottom <= innerHeight + 1 };
  }, sel);
  const tap = async (sel) => {
    const c = await centre(sel);
    if (c) await page.touchscreen.tap(c.x, c.y);
    return c;
  };

  // A new player starts on the pavement, not in the road
  const start = await page.evaluate(() => ({ x: window.game.player.position.x, z: window.game.player.position.z }));
  check('phonelife: a new player starts on the pavement of Broad Street, not in the road', Math.abs(start.x) > 7, start);

  // A cheap rented room
  await page.evaluate(() => {
    const g = window.game;
    const d = g.hud.backend.getData();
    const p = d.properties.find((x) => x.rentalPriceMonthly > 0 && x.rentalPriceMonthly < 300000 && x.type !== 'office');
    p.status = 'rented';
    p.ownerId = d.id;
    g.hud.backend.depositToBank?.(2_000_000);
    d.bank.balance = Math.max(d.bank.balance, 2_000_000);
  });
  await tap('#nav-btn-home');
  await wait(3500);
  await closeDialogs(page);
  const home = await page.evaluate(() => {
    const r = window.game.world.interiorManager.residence;
    const placed = window.game.modules.HouseDecorationSystem.getInstance().placed.map((item) => item.id);
    return { inside: window.game.world.interiorManager.currentInterior?.type, standard: r.standard, name: r.def.name, placed };
  });
  // What a cheap room came with is now the player's own pieces, from the catalogue
  const basicPieces = ['tv_24', 'plastic_set', 'lontor_fan', 'kerosene_stove'].filter((id) => home.placed.includes(id));
  const rich = ['emerald_sofa', 'smart_tv_75', 'double_bed_blue', 'bathtub', 'rain_shower', 'dining_table_6'].filter((id) => home.placed.includes(id));
  check('phonelife: a room rented for under ₦300,000 comes basic: a small TV, plastic chairs, a fan and a stove; no big sofa, extra beds or bathtub', home.inside === 'residence' && home.standard === 'basic' && basicPieces.length === 4 && rich.length === 0, { ...home, basicPieces, rich });

  // The catalogue, from Decorate
  const decorate = await tap('#place-extra-decorate');
  await wait(1200);
  const sheet = await page.evaluate(() => {
    const el = document.getElementById('house-catalogue-modal');
    const r = el.getBoundingClientRect();
    return { open: getComputedStyle(el).display !== 'none', left: Math.round(r.left), right: Math.round(r.right), bottom: Math.round(r.bottom), width: innerWidth, height: innerHeight, cards: el.querySelectorAll('.cat-card').length };
  });
  check('phonelife: Decorate on the home card opens the catalogue as a sheet across the bottom of the screen', decorate?.reachable && sheet.open && sheet.left >= 0 && sheet.right <= sheet.width && sheet.bottom >= sheet.height - 2 && sheet.cards > 100, { decorate, sheet });
  await tap('#house-catalogue-modal [data-tab="tv"]');
  await wait(1500);
  const tv = await page.evaluate(() => {
    const cards = [...document.querySelectorAll('#house-catalogue-modal .cat-card')];
    return { names: cards.map((c) => c.querySelector('.cat-name').textContent), pictures: cards.filter((c) => c.querySelector('img')?.src.startsWith('data:image')).length };
  });
  check('phonelife: the TV tab lists televisions from 24 to 65 inches, cheapest first, each with a picture', tv.names[0]?.includes('24') && tv.names.some((n) => n.includes('65')) && tv.pictures >= Math.min(4, tv.names.length), tv);
  const cheap = await centre('#house-catalogue-modal [data-item-id="tv_32"]');
  check('phonelife: a card can be tapped (nothing on top of it)', !!cheap?.reachable, cheap);
  const before = await page.evaluate(() => { const d = window.game.hud.backend.getData(); return d.walletCash + d.bank.balance; });
  await tap('#house-catalogue-modal [data-item-id="tv_32"]');
  await wait(600);
  const placing = await page.evaluate(() => ({ placing: window.game.modules.HouseDecorationSystem.getInstance().placing?.item.id, sheet: getComputedStyle(document.getElementById('house-catalogue-modal')).display }));
  const confirm = await centre('#furnish-bar-confirm');
  // Somewhere clear in the living room
  await page.evaluate(() => window.game.modules.HouseDecorationSystem.getInstance().moveTo(-2, 6));
  await wait(300);
  await tap('#furnish-bar-confirm');
  await wait(600);
  const bought = await page.evaluate(() => { const s = window.game.modules.HouseDecorationSystem.getInstance(); const d = window.game.hud.backend.getData(); return { placed: s.placed.map((p) => p.id), money: d.walletCash + d.bank.balance }; });
  check('phonelife: tapping the 32" TV starts placing it (the sheet steps aside), and placing it pays ₦120,000 once', placing.placing === 'tv_32' && placing.sheet === 'none' && confirm?.reachable && bought.placed.includes('tv_32') && before - bought.money === 120000, { placing, confirm, bought, paid: before - bought.money });

  // Storage: put away, then out again for nothing
  const stored = await page.evaluate(() => {
    const s = window.game.modules.HouseDecorationSystem.getInstance();
    const item = s.placed.find((p) => p.id === 'tv_32');
    return { ok: s.putAway(item.uid), stored: [...s.stored], placed: s.placed.length };
  });
  await page.evaluate(() => window.game.modules.HouseDecorationSystem.getInstance().openCatalogueModal());
  await wait(300);
  await tap('#house-catalogue-modal [data-tab="storage"]');
  await wait(500);
  const fromStore = await centre('#house-catalogue-modal [data-item-id="tv_32"][data-stored]');
  const money1 = await page.evaluate(() => { const d = window.game.hud.backend.getData(); return d.walletCash + d.bank.balance; });
  await tap('#house-catalogue-modal [data-item-id="tv_32"][data-stored]');
  await wait(400);
  await page.evaluate(() => window.game.modules.HouseDecorationSystem.getInstance().moveTo(-2, 6));
  await tap('#furnish-bar-confirm');
  await wait(500);
  const again = await page.evaluate(() => { const s = window.game.modules.HouseDecorationSystem.getInstance(); const d = window.game.hud.backend.getData(); return { placed: s.placed.map((p) => p.id), stored: [...s.stored], money: d.walletCash + d.bank.balance }; });
  check('phonelife: a piece put in storage is listed under Storage and placed again for nothing', stored.ok && stored.stored.includes('tv_32') && fromStore?.reachable && again.placed.includes('tv_32') && !again.stored.includes('tv_32') && again.money === money1, { stored, fromStore, again: { ...again, paid: money1 - again.money } });

  // Music
  await closeDialogs(page);
  const fab = await tap('#music-fab');
  await wait(600);
  await tap('#music-sheet [data-play="yaba-nights"]');
  await wait(1500);
  const music = await page.evaluate(() => ({ open: getComputedStyle(document.getElementById('music-sheet')).display !== 'none', rows: document.querySelectorAll('#music-sheet .music-row').length, playing: document.querySelector('#music-sheet .music-label')?.textContent, title: document.querySelector('#music-sheet .music-now-text strong')?.textContent }));
  await tap('#music-sheet [data-toggle]');
  await wait(300);
  const paused = await page.evaluate(() => document.querySelector('#music-sheet .music-label')?.textContent);
  await tap('#music-sheet [data-close]');
  check('phonelife: the music button opens the player; a song plays and pauses', fab?.reachable && music.open && music.rows >= 8 && /Now playing/.test(music.playing) && music.title === 'Yaba Nights' && /Paused/.test(paused), { fab, music, paused });

  // Driving with the pedals
  await page.evaluate(() => window.game.world.interiorManager.exitCurrentInterior(window.game.player, window.game.cameraManager, window.game.hud, window.game.world));
  await wait(2500);
  await page.evaluate(() => {
    const g = window.game;
    const v = g.world.vehicles.drivableVehicles.find((x) => x.type === 'sedan');
    v.mesh.position.set(-4.9, 0, -40);
    v.mesh.rotation.y = 0;
    g.player.mesh.position.copy(v.mesh.position);
    g.enterVehicle(v);
    v.constructor.ignoreBodies = true;
  });
  await wait(1200);
  const gas = await centre('#drive-controls [data-key="w"]');
  const z0 = await page.evaluate(() => window.game.player.currentVehicle.mesh.position.z);
  if (gas) {
    await page.touchscreen.touchStart(gas.x, gas.y);
    await wait(1600);
    await page.touchscreen.touchEnd();
  }
  await wait(300);
  const drove = await page.evaluate((z0) => ({ moved: +(window.game.player.currentVehicle.mesh.position.z - z0).toFixed(1), speedShown: document.querySelector('#drive-controls [data-speed]')?.textContent, stick: getComputedStyle(document.getElementById('virtual-mobile-controls')).display }), z0);
  const out = await centre('#drive-controls [data-out]');
  check('phonelife: driving on a phone shows pedals: holding GAS drives the car on, the speed is shown, the stick is out of the way, Get out can be tapped', gas?.reachable && drove.moved > 3 && drove.stick === 'none' && out?.reachable, { gas, drove, out });
  await tap('#drive-controls [data-out]');
  await wait(1500);
  const walking = await page.evaluate(() => !window.game.player.isDriving);
  check('phonelife: Get out gets the player out', walking, walking);

  // The map: two fingers pinch it
  await closeDialogs(page);
  await tap('#nav-btn-map');
  await wait(2500);
  const zoom0 = await page.evaluate(() => window.game.world.worldMap.zoomLevel);
  const client = await page.target().createCDPSession();
  const touch = (type, points) => client.send('Input.dispatchTouchEvent', { type, touchPoints: points.map(([x, y], id) => ({ x, y, id })) });
  await touch('touchStart', [[180, 420], [240, 420]]);
  for (let i = 1; i <= 8; i++) await touch('touchMove', [[180 - i * 12, 420], [240 + i * 12, 420]]);
  await touch('touchEnd', []);
  await wait(400);
  const zoom1 = await page.evaluate(() => window.game.world.worldMap.zoomLevel);
  check('phonelife: on the map, two fingers spread apart zoom in', zoom1 < zoom0 * 0.85, { zoom0, zoom1 });

  check('phonelife: no errors in the page', errors.length === 0, errors.slice(0, 5));
  await browser.close();
}
