// The phone: every app does something real in the game, once, and says so when it cannot.
import { open, reload, wait, money, newPlayer, advance, playUntil, closeDialogs, enterInterior, leaveInterior, quest } from './lib.mjs';

const PHONE = '#smartphone-wrapper';

const openApp = async (page, id, route = '') => {
  const wasOpen = await page.evaluate(({ id, route }) => { const phone = window.game.hud.phoneModal; const open = phone.isOpen; phone.openApp(id, route); return open; }, { id, route });
  // A phone coming out of the pocket slides up the screen: wait until it has stopped
  await wait(wasOpen ? 150 : 650);
};
/** Presses something on the phone the way a finger does: it has to be there and not disabled. */
const tap = async (page, selector) => {
  const pressed = await page.evaluate((sel) => {
    const el = document.querySelector(sel);
    if (!el || el.disabled) return false;
    el.scrollIntoView({ block: 'center' });
    el.click();
    return true;
  }, `${PHONE} ${selector}`);
  await wait(160);
  return pressed;
};
/** A real mouse click on something on the phone, at the place it is on the screen. */
const click = async (page, selector, options = {}) => {
  const at = await page.evaluate((sel) => {
    const el = document.querySelector(sel);
    if (!el) return null;
    el.scrollIntoView({ block: 'center' });
    const box = el.getBoundingClientRect();
    return { x: box.left + box.width / 2, y: box.top + box.height / 2 };
  }, `${PHONE} ${selector}`);
  if (!at) throw new Error(`Nothing on the phone matches ${selector}`);
  await page.mouse.click(at.x, at.y, options);
  await wait(200);
  return at;
};
const has = (page, selector) => page.evaluate((sel) => !!document.querySelector(sel), `${PHONE} ${selector}`);
const text = (page, selector) => page.evaluate((sel) => document.querySelector(sel)?.textContent.replace(/\s+/g, ' ').trim() ?? null, `${PHONE} ${selector}`);
const title = (page) => text(page, '#phone-title');
const notice = (page) => page.evaluate(() => { const el = document.getElementById('phone-notice'); return el && !el.hidden ? el.textContent : null; });
/** Types into a field with the real keyboard. */
const type = async (page, selector, value) => {
  await click(page, selector);
  await page.keyboard.down('Control');
  await page.keyboard.press('a');
  await page.keyboard.up('Control');
  await page.keyboard.press('Backspace');
  if (value) await page.keyboard.type(value);
  await wait(160);
};
const ledger = (page, kind) => page.evaluate((type) => window.game.hud.backend.getData().transactionHistory.filter((tx) => tx.type === type).length, kind);
const give = (page, bank) => page.evaluate((amount) => { const b = window.game.hud.backend; b.data.bank.balance = amount; b.saveData(); }, bank);

export async function run(browser, check) {
  const ctx = await newPlayer(browser);
  const { page, log } = await open(ctx);
  await closeDialogs(page);

  // ------------------------------------------------------------------ Home screen and navigation
  const standing = () => page.evaluate(() => {
    const g = window.game;
    return { x: g.player.position.x, z: g.player.position.z, moving: g.player.isMoving, yaw: g.cameraManager.yaw, distance: g.cameraManager.distance };
  });
  const before = await standing();
  await page.click('#nav-btn-phone');
  await wait(500);
  const home = await page.evaluate(() => {
    const tiles = Array.from(document.querySelectorAll('#phone-apps [data-app]'));
    return {
      open: window.game.hud.phoneModal.isOpen,
      apps: tiles.map((tile) => tile.dataset.app),
      named: tiles.every((tile) => tile.textContent.trim().length > 2),
      smallest: Math.min(...tiles.map((tile) => Math.min(tile.getBoundingClientRect().width, tile.getBoundingClientRect().height))),
      wallet: document.querySelector('#smartphone-wrapper .nlphone-wallet')?.textContent.replace(/\s+/g, ' ').trim(),
      clock: document.getElementById('phone-status-time').textContent,
    };
  });
  check('the phone opens on a home screen with the time, the money really held, and a named tile for each app',
    home.open && home.apps.length === 12 && home.named && home.smallest >= 44 && /150,000/.test(home.wallet) && /25,000/.test(home.wallet) && home.clock.length > 3, home);

  // Every tile opens a screen of its own, and nothing on any screen is a button that does nothing
  const visited = [];
  for (const app of home.apps) {
    await click(page, `#phone-apps [data-app="${app}"]`);
    const screen = await page.evaluate(() => {
      const wired = '[data-app],[data-go],[data-set],[data-act],[data-shortcut],[data-phone-back],[data-phone-home],[data-phone-close],[type="submit"]';
      const buttons = Array.from(document.querySelectorAll('#phone-screen-content button'));
      return {
        title: document.getElementById('phone-title').textContent,
        back: !document.getElementById('app-back-btn').closest('.nlphone-bar').hidden,
        content: document.getElementById('phone-screen-content').textContent.trim().length,
        dead: buttons.filter((button) => !button.disabled && !button.matches(wired)).map((button) => button.textContent.trim().slice(0, 30)),
        top: document.getElementById('phone-screen-content').scrollTop,
      };
    });
    await click(page, '#app-back-btn');
    visited.push({ app, ...screen, home: await has(page, '#phone-apps') });
  }
  check('each app opens its own screen and Back returns to the home screen',
    visited.every((v) => v.title.length > 2 && v.back && v.content > 40 && v.home && v.top === 0), visited.map((v) => `${v.app}:${v.title}`));
  check('no app has a button that is not wired to anything', visited.every((v) => v.dead.length === 0), visited.filter((v) => v.dead.length).map((v) => ({ app: v.app, dead: v.dead })));

  // Deeper screens: back goes up one at a time, the home bar goes all the way, Escape is the back button
  await click(page, '#phone-apps [data-app="invest"]');
  await click(page, '[data-share="DNGC"]');
  const deep = await title(page);
  await page.keyboard.press('Escape');
  await wait(200);
  const upOne = await title(page);
  await click(page, '[data-share="FGNB"]');
  await click(page, '#phone-home-bar');
  const atHome = await has(page, '#phone-apps');

  // The home screen is redrawn as the clock and the character's needs change. A press that is
  // under way when that happens must still land on the tile it started on.
  const tile = await page.evaluate(() => { const box = document.querySelector('#phone-apps [data-app="jobs"]').getBoundingClientRect(); return { x: box.left + box.width / 2, y: box.top + box.height / 2 }; });
  await page.mouse.move(tile.x, tile.y);
  await page.mouse.down();
  const redrawn = await page.evaluate(() => {
    const g = window.game;
    const firstTile = document.querySelector('#phone-apps [data-app]');
    g.hud.backend.data.stats.hunger -= 9;
    g.hud.backend.saveData();
    g.hud.phoneModal.refresh();
    return { sameTile: firstTile === document.querySelector('#phone-apps [data-app]'), hunger: g.hud.backend.getData().stats.hunger };
  });
  await page.mouse.up();
  await wait(250);
  const landed = await title(page);
  const caughtUp = await page.evaluate(() => { window.game.hud.phoneModal.home(); return document.querySelector('#smartphone-wrapper .nlphone-needs').innerHTML; });
  check('a tile being pressed while the home screen updates still opens its app, and the update shows afterwards',
    redrawn.sameTile && landed === 'Jobs' && caughtUp.length > 0, { redrawn, landed });
  await page.keyboard.press('Escape');
  await wait(250);
  const closed = await page.evaluate(() => !window.game.hud.phoneModal.isOpen);
  check('a share opens from the list, Escape goes back one screen, the home bar goes home, and Escape from home puts the phone away',
    deep !== upOne && upOne === 'Invest' && atHome && closed, { deep, upOne, atHome, closed });

  await advance(page, 0.5);
  const after = await standing();
  check('none of that tapping moved the character or the camera',
    Math.hypot(after.x - before.x, after.z - before.z) < 0.05 && !after.moving && after.yaw === before.yaw && after.distance === before.distance, { before, after });

  // ------------------------------------------------------------------ Bank
  await openApp(page, 'bank');
  let rows = await page.evaluate(() => document.querySelectorAll('#bank-history .nl-row').length);
  const balance = await text(page, '#bank-balance');
  await tap(page, '[data-set="bank.filter"][data-value="out"]');
  const outRows = await page.evaluate(() => document.querySelectorAll('#bank-history .nl-row').length);
  const emptyState = await has(page, '#bank-history .nl-empty');
  await tap(page, '[data-set="bank.filter"][data-value="all"]');
  await type(page, '#bank-search', 'zzzz');
  const searched = await page.evaluate(() => ({ rows: document.querySelectorAll('#bank-history .nl-row').length, focused: document.activeElement?.id, value: document.activeElement?.value }));
  await type(page, '#bank-search', '');
  check('the bank shows the real balance and the real history; filters and search narrow it and the search box keeps the keyboard',
    balance === '₦150,000' && rows >= 1 && outRows === 0 && emptyState && searched.rows === 0 && searched.focused === 'bank-search' && searched.value === 'zzzz',
    { balance, rows, outRows, emptyState, searched });

  await tap(page, '[data-go="send"]');
  const alone = await page.evaluate(() => ({ send: !!document.querySelector('#bank-send-btn:not([disabled])'), text: document.getElementById('phone-screen-content').textContent.replace(/\s+/g, ' ').trim().slice(0, 160) }));
  check('with nobody else online, sending money explains why it cannot be done instead of offering a button', !alone.send && /online/i.test(alone.text), alone);

  // ------------------------------------------------------------------ Invest
  let m0 = await money(page);
  await openApp(page, 'invest', 's:DNGC');
  // Digits typed with the screen redrawing in between stay in the order they were typed
  await type(page, '#invest-units', '1');
  await wait(1300);
  await page.keyboard.type('2');
  await wait(1300);
  await page.keyboard.type('5');
  await wait(150);
  const slowly = await page.evaluate(() => document.getElementById('invest-units').value);
  check('a number typed slowly while the prices update keeps its digits in order', slowly === '125', slowly);
  await type(page, '#invest-units', '3');
  // The price moves with the game clock, so the quote is read at the moment of buying
  const quote = await page.evaluate(() => {
    const g = window.game;
    const share = g.market.share('DNGC');
    return { cost3: g.market.costToBuy(share, 3), back3: g.market.proceedsFromSale(share, 3), price: g.market.price(share) };
  });
  const offered = await text(page, '#invest-buy-btn');
  const cannotSellYet = await page.evaluate(() => document.getElementById('invest-sell-btn').disabled);
  await tap(page, '#invest-buy-btn');
  let m1 = await money(page);
  let held = await page.evaluate(() => window.game.hud.backend.getData().investments.DNGC);
  check('buying 3 shares takes exactly the quoted cost (price plus the fee) once, and the shares are held',
    m0.total - m1.total === quote.cost3 && quote.cost3 > quote.price * 3 && held?.units === 3 && offered.includes(quote.cost3.toLocaleString()) && cannotSellYet && (await ledger(page, 'INVESTMENT_PURCHASE')) === 1,
    { paid: m0.total - m1.total, quote, held, offered });

  await reload(page);
  await closeDialogs(page);
  held = await page.evaluate(() => window.game.hud.backend.getData().investments.DNGC);
  check('the shares are still held after the game is closed and opened again', held?.units === 3, held);

  await openApp(page, 'invest', 's:DNGC');
  await type(page, '#invest-units', '5');
  const oversell = await page.evaluate(() => document.getElementById('invest-sell-btn').disabled);
  const typedFive = await page.evaluate(() => document.getElementById('invest-units').value);
  await type(page, '#invest-units', '3');
  m0 = await money(page);
  const back = await page.evaluate(() => { const g = window.game; return g.market.proceedsFromSale(g.market.share('DNGC'), 3); });
  await tap(page, '#invest-sell-btn');
  await tap(page, '#invest-sell-btn'); // a second press has nothing left to sell
  m1 = await money(page);
  held = await page.evaluate(() => window.game.hud.backend.getData().investments.DNGC ?? null);
  check('more shares than are held cannot be sold; selling pays the quoted amount once and a second press pays nothing',
    oversell && m1.total - m0.total === back && (!held || held.units === 0) && (await ledger(page, 'INVESTMENT_SALE')) === 1, { oversell, typedFive, got: m1.total - m0.total, back, held });

  await type(page, '#invest-units', '999999');
  m0 = await money(page);
  const pressed = await tap(page, '#invest-buy-btn');
  const refusal = await notice(page);
  m1 = await money(page);
  check('buying more than can be afforded is refused with the reason, and takes nothing', m1.total === m0.total && (!pressed || /costs .* has/i.test(refusal ?? '')), { pressed, refusal });

  // ------------------------------------------------------------------ Rides
  await page.evaluate(() => window.game.hud.phoneModal.close());
  await enterInterior(page, 'bank');
  await openApp(page, 'ride');
  const indoors = await page.evaluate(() => ({ note: document.getElementById('ride-blocked')?.textContent ?? null }));
  await tap(page, '[data-place]');
  const indoorsCar = await page.evaluate(() => ({ any: document.querySelectorAll('#ride-vehicles button').length, open: document.querySelectorAll('#ride-vehicles button:not([disabled])').length }));
  check('indoors, the ride app says to step outside and none of the vehicles can be booked', /outside/i.test(indoors.note ?? '') && indoorsCar.any > 0 && indoorsCar.open === 0, { indoors, indoorsCar });
  await page.evaluate(() => window.game.hud.phoneModal.close());
  await leaveInterior(page);

  const trip = await page.evaluate(() => {
    const g = window.game;
    const here = g.player.position;
    // Somewhere a keke goes that is a proper distance from here
    const options = g.rides.destinations()
      .map((dest) => ({ dest, vehicle: g.rides.vehiclesFor(dest)[0], far: Math.hypot(dest.streetPosition.x - here.x, dest.streetPosition.z - here.z) }))
      .filter((o) => o.vehicle && o.far > 30)
      .sort((a, b) => b.far - a.far);
    const pick = options[0];
    return { id: pick.dest.id, name: pick.dest.name, mode: pick.vehicle.mode, fare: pick.vehicle.fare, x: pick.dest.streetPosition.x, z: pick.dest.streetPosition.z };
  });
  m0 = await money(page);
  await openApp(page, 'ride');
  await tap(page, `[data-place="${trip.id}"]`);
  await tap(page, `[data-ride="${trip.mode}"]`);
  let ride = await page.evaluate(() => ({ stage: window.game.rides.ride?.stage ?? null, card: document.getElementById('ride-status')?.dataset.stage ?? null }));
  m1 = await money(page);
  check('booking a ride puts a driver on the way and takes no money yet', ride.stage === 'driver_coming' && ride.card === 'driver_coming' && m1.total === m0.total, { ride, trip });

  await advance(page, 2);
  await tap(page, '#ride-cancel');
  await advance(page, 8);
  ride = await page.evaluate(() => window.game.rides.ride);
  m1 = await money(page);
  check('cancelling before the driver arrives costs nothing and no driver turns up afterwards', ride === null && m1.total === m0.total && (await ledger(page, 'TRAVEL_COST')) === 0, { ride, delta: m1.total - m0.total });

  await openApp(page, 'ride');
  await tap(page, `[data-place="${trip.id}"]`);
  await tap(page, `[data-ride="${trip.mode}"]`);
  const second = await page.evaluate(({ id, mode }) => window.game.rides.book(id, mode), trip);
  await advance(page, 6.5);
  const picked = await page.evaluate(() => ({ stage: window.game.rides.ride?.stage ?? null, phone: window.game.hud.phoneModal.isOpen, where: window.game.roadRideExperience.isActive }));
  m1 = await money(page);
  check('a second booking is refused while one is under way; when the driver arrives the fare is taken once and the trip starts',
    !second.ok && picked.stage === 'on_trip' && picked.where && m0.total - m1.total === trip.fare && (await ledger(page, 'TRAVEL_COST')) === 1, { second, picked, paid: m0.total - m1.total, fare: trip.fare });

  const arrived = await playUntil(page, () => {
    const g = window.game;
    return !g.rides.ride && !g.roadRideExperience.isActive ? { x: g.player.position.x, z: g.player.position.z, visible: g.player.mesh.visible } : null;
  }, 40);
  await closeDialogs(page);
  m1 = await money(page);
  check('the ride ends with the character standing at the place that was booked, and the fare was still only paid once',
    arrived && arrived.visible && Math.hypot(arrived.x - trip.x, arrived.z - trip.z) < 2 && m0.total - m1.total === trip.fare && (await ledger(page, 'TRAVEL_COST')) === 1, { arrived, trip });

  // ------------------------------------------------------------------ Shopping
  await openApp(page, 'shopping');
  await tap(page, '[data-set="shopping.tab"][data-value="food"]');
  await tap(page, '[data-add="jollof_pack"]');
  await tap(page, '[data-add="jollof_pack"]');
  await tap(page, '[data-add="moimoi_pap"]');
  const basket = await text(page, '#shopping-basket .nl-bar-text');
  m0 = await money(page);
  const bag0 = await page.evaluate(() => window.game.hud.backend.getData().inventory.reduce((sum, item) => sum + item.quantity, 0));
  await tap(page, '#shopping-order-btn');
  let order = await page.evaluate(() => window.game.deliveries.order && { total: window.game.deliveries.order.total, card: !!document.getElementById('shopping-order') });
  m1 = await money(page);
  check('ordering food sends a rider and takes no money until it arrives', order && order.total === 4500 * 2 + 2200 + 400 && order.card && m1.total === m0.total && /3 items/.test(basket), { order, basket });

  await tap(page, '#shopping-cancel');
  await advance(page, 22);
  m1 = await money(page);
  let bag1 = await page.evaluate(() => window.game.hud.backend.getData().inventory.reduce((sum, item) => sum + item.quantity, 0));
  check('a cancelled order is never charged and never delivered', m1.total === m0.total && bag1 === bag0 && (await page.evaluate(() => window.game.deliveries.order)) === null, { delta: m1.total - m0.total, bag0, bag1 });

  await tap(page, '[data-add="jollof_pack"]');
  await tap(page, '[data-add="jollof_pack"]');
  await tap(page, '#shopping-order-btn');
  await tap(page, '#shopping-order-btn'); // a second press while the rider is out orders nothing more
  const foodBefore = await ledger(page, 'FOOD_PURCHASE');
  await advance(page, 22);
  m1 = await money(page);
  const delivered = await page.evaluate(() => window.game.hud.backend.getData().inventory.find((item) => item.name.toLowerCase().includes('jollof') && item.name.toLowerCase().includes('pack')) ?? null);
  check('when the rider arrives the order is paid for once and the food is in the bag',
    m0.total - m1.total === 9400 && delivered?.quantity === 2 && (await ledger(page, 'FOOD_PURCHASE')) === foodBefore + 1, { paid: m0.total - m1.total, delivered });

  const hungry = await page.evaluate(() => { const b = window.game.hud.backend; b.data.stats.hunger = 30; return b.getData().stats.hunger; });
  const ate = await page.evaluate((id) => window.game.hud.backend.useItem(id), delivered.id);
  const fed = await page.evaluate(() => window.game.hud.backend.getData().stats.hunger);
  const eatQuest = await quest(page, 'quest_lagos_1');
  check('eating the delivered food fills the character up and counts for the story', ate.success && fed > hungry && eatQuest.obj.obj_l1_eat === true, { ate, hungry, fed });

  // Selling: what the bag really holds, for what the app says, once
  await openApp(page, 'shopping');
  await tap(page, '[data-set="shopping.tab"][data-value="sell"]');
  const forSale = await page.evaluate(() => {
    const b = window.game.hud.backend;
    const item = b.getData().inventory.find((entry) => b.resaleValue(entry) > 0 && entry.price < 20000);
    return item ? { id: item.id, quantity: item.quantity, worth: b.resaleValue(item) } : null;
  });
  m0 = await money(page);
  await tap(page, `[data-act="sell"][data-arg="${forSale.id}"]`);
  m1 = await money(page);
  const left = await page.evaluate((id) => window.game.hud.backend.getData().inventory.find((entry) => entry.id === id)?.quantity ?? 0, forSale.id);
  check('selling something from the bag pays what the app quoted and takes one of it away', m1.total - m0.total === forSale.worth && left === forSale.quantity - 1 && (await ledger(page, 'ITEM_SALE')) === 1, { forSale, got: m1.total - m0.total, left });

  // ------------------------------------------------------------------ Jobs
  await openApp(page, 'jobs');
  const jobs = await page.evaluate(() => {
    const b = window.game.hud.backend;
    const rank = b.getData().career.rankLevel;
    const locked = b.getJobs().find((job) => job.requiredLevel > rank);
    const button = locked ? document.querySelector(`#smartphone-wrapper [data-start-job="${locked.id}"]`) : null;
    return { rank, locked: locked?.id ?? null, offered: !!button, refused: locked ? b.startJobShift(locked.id) : null, working: !!b.getActiveJobShift() };
  });
  check('a shift above the character\'s rank is shown locked, is not offered, and the game refuses it too',
    jobs.locked && !jobs.offered && jobs.refused && !jobs.refused.success && !jobs.working, jobs);

  m0 = await money(page);
  await tap(page, '[data-go^="gig:"]');
  const gigPay = await page.evaluate(() => Number(document.getElementById('phone-screen-content').textContent.match(/Pays ₦([\d,]+)/)[1].replace(/,/g, '')));
  await page.evaluate(() => { window.game.hud.backend.data.stats.energy = 100; });
  const paidBefore = await ledger(page, 'JOB_SALARY');
  const steps = [];
  for (let i = 0; i < 4; i++) {
    steps.push(await tap(page, '[data-act="gig-step"]'));
    steps.push((await ledger(page, 'JOB_SALARY')) - paidBefore);
  }
  const lastPay = await page.evaluate(() => window.game.hud.backend.getData().transactionHistory.filter((tx) => tx.type === 'JOB_SALARY').sort((a, b) => b.timestamp - a.timestamp)[0]?.amount ?? null);
  check('a three-step job pays once, after the third step, and not again for extra presses',
    steps[1] === 0 && steps[3] === 0 && steps[5] === 1 && steps[7] === 1 && gigPay > 0, { steps, gigPay, lastPay });

  // ------------------------------------------------------------------ Property
  await openApp(page, 'property');
  const flat = await page.evaluate(() => {
    const list = window.game.hud.backend.getData().properties.filter((p) => p.rentalPriceMonthly > 0 && p.status === 'available').sort((a, b) => a.rentalPriceMonthly - b.rentalPriceMonthly);
    return { id: list[0].id, rent: list[0].rentalPriceMonthly, price: list[0].purchasePrice };
  });
  m0 = await money(page);
  await tap(page, `[data-property="${flat.id}"]`);
  await tap(page, `[data-act="rent"][data-arg="${flat.id}"]`);
  const asked = await page.evaluate(() => !document.getElementById('phone-confirm').hidden);
  m1 = await money(page);
  const notYet = m1.total === m0.total;
  await tap(page, '#phone-confirm-yes');
  m1 = await money(page);
  let status = await page.evaluate((id) => { const b = window.game.hud.backend; return { status: b.getData().properties.find((p) => p.id === id).status, home: b.hasHome(), goHome: !!document.getElementById('property-go-home') }; }, flat.id);
  check('renting asks first, then takes the rent once and the flat is the character\'s home',
    asked && notYet && m0.total - m1.total === flat.rent && status.status === 'rented' && status.home && status.goHome, { asked, notYet, paid: m0.total - m1.total, flat, status });

  await tap(page, `[data-act="leave"][data-arg="${flat.id}"]`);
  await tap(page, '#phone-confirm-no');
  const stayed = await page.evaluate((id) => window.game.hud.backend.getData().properties.find((p) => p.id === id).status, flat.id);
  await tap(page, `[data-act="leave"][data-arg="${flat.id}"]`);
  await tap(page, '#phone-confirm-yes');
  status = await page.evaluate((id) => { const b = window.game.hud.backend; return { status: b.getData().properties.find((p) => p.id === id).status, home: b.hasHome() }; }, flat.id);
  check('moving out asks first: Cancel keeps the flat, Yes gives it up', stayed === 'rented' && status.status === 'available' && !status.home, { stayed, status });

  await give(page, flat.price + 1000);
  await openApp(page, 'property', `p:${flat.id}`);
  m0 = await money(page);
  await tap(page, `[data-act="buy"][data-arg="${flat.id}"]`);
  await tap(page, '#phone-confirm-yes');
  m1 = await money(page);
  const owned = await page.evaluate((id) => window.game.hud.backend.getData().properties.find((p) => p.id === id).status, flat.id);
  await tap(page, `[data-act="sell"][data-arg="${flat.id}"]`);
  await tap(page, '#phone-confirm-yes');
  const m2 = await money(page);
  const sold = await page.evaluate((id) => window.game.hud.backend.getData().properties.find((p) => p.id === id).status, flat.id);
  check('buying a home takes its price once; selling it pays back 80% once and it is on the market again',
    m0.total - m1.total === flat.price && (owned === 'owned' || owned === 'purchased') && m2.total - m1.total === Math.round(flat.price * 0.8) && sold === 'available' && (await ledger(page, 'PROPERTY_SALE')) === 1,
    { paid: m0.total - m1.total, owned, back: m2.total - m1.total, sold });

  // ------------------------------------------------------------------ Businesses
  await give(page, 400000);
  await openApp(page, 'business');
  await tap(page, '[data-go="b:biz_pos_kiosk"]');
  m0 = await money(page);
  await tap(page, '[data-act="buy"][data-arg="biz_pos_kiosk"]');
  if (await page.evaluate(() => !document.getElementById('phone-confirm').hidden)) await tap(page, '#phone-confirm-yes');
  m1 = await money(page);
  const kiosk = await page.evaluate(() => window.game.hud.backend.getData().businesses.find((b) => b.id === 'biz_pos_kiosk'));
  check('buying a business takes its price once and it is owned', m0.total - m1.total === kiosk.purchasePrice && kiosk.owned, { paid: m0.total - m1.total, price: kiosk.purchasePrice, owned: kiosk.owned });

  await page.evaluate(() => { const b = window.game.hud.backend; b.data.businesses.find((x) => x.id === 'biz_pos_kiosk').pendingRevenue = 7300; b.saveData(); b.notifyListeners?.(); });
  await openApp(page, 'business');
  m0 = await money(page);
  const pendingShown = await text(page, '#business-pending');
  await tap(page, '[data-act="collect"]');
  const again = await tap(page, '[data-act="collect"]');
  m1 = await money(page);
  check('takings are collected into the bank once; with nothing left to collect the button is off',
    pendingShown === '₦7,300' && m1.bank - m0.bank === 7300 && !again, { pendingShown, got: m1.bank - m0.bank, again });

  // ------------------------------------------------------------------ Health
  await openApp(page, 'health');
  const well = await page.evaluate(() => document.getElementById('health-ambulance').disabled);
  await page.evaluate(() => { const b = window.game.hud.backend; b.data.stats.health = 18; b.saveData(); b.notifyListeners?.(); });
  await openApp(page, 'health');
  m0 = await money(page);
  await tap(page, '#health-ambulance');
  if (await page.evaluate(() => !document.getElementById('phone-confirm').hidden)) await tap(page, '#phone-confirm-yes');
  await wait(1200);
  await advance(page, 1);
  m1 = await money(page);
  const treated = await page.evaluate(() => ({ health: window.game.hud.backend.getData().stats.health, where: window.game.world.interiorManager.currentInterior?.type ?? null }));
  check('an ambulance cannot be called when well; when badly hurt it takes the character to hospital, treats them and bills ₦3,500 once',
    well && treated.where === 'hospital' && treated.health >= 70 && m0.total - m1.total === 3500 && (await ledger(page, 'MEDICAL_BILL')) === 1, { well, treated, paid: m0.total - m1.total });
  await closeDialogs(page);
  await leaveInterior(page);

  // ------------------------------------------------------------------ Settings
  await openApp(page, 'settings');
  const sound0 = await page.evaluate(() => ({ muted: window.game.modules.SoundEngine.getInstance().isMuted, shown: document.getElementById('settings-sound').getAttribute('aria-checked') }));
  await tap(page, '#settings-sound');
  const sound1 = await page.evaluate(() => ({ muted: window.game.modules.SoundEngine.getInstance().isMuted, shown: document.getElementById('settings-sound').getAttribute('aria-checked') }));
  await tap(page, '#settings-sound');
  check('the sound switch really turns the game sound off and on, and shows which',
    sound0.muted !== sound1.muted && sound0.shown === String(!sound0.muted) && sound1.shown === String(!sound1.muted), { sound0, sound1 });

  // ------------------------------------------------------------------ Messages with people in the city
  await openApp(page, 'messages');
  const strangers = await page.evaluate(() => document.querySelectorAll('#people-list [data-contact]').length);
  const who = await page.evaluate(() => { const g = window.game; const actor = g.interactions.actorFor('bet-customer'); g.hud.backend.addFamiliarity(actor.id, 30); return { id: actor.id, name: actor.name.split('(')[0].trim() }; });
  await openApp(page, 'messages');
  const listed = await page.evaluate((id) => !!document.querySelector(`#people-list [data-contact="${id}"]`), who.id);
  await tap(page, `[data-contact="${who.id}"]`);
  await click(page, '#chat-input');
  await page.keyboard.type('How far? Any work today?');
  await page.keyboard.press('Enter');
  await wait(200);
  const sent = await page.evaluate((id) => ({ thread: window.game.hud.backend.thread(id).messages.map((m) => m.from), field: document.getElementById('chat-input').value, focused: document.activeElement?.id }), who.id);
  await advance(page, 3);
  await wait(200);
  const replied = await page.evaluate((id) => ({ thread: window.game.hud.backend.thread(id).messages.map((m) => m.from), bubbles: document.querySelectorAll('#chat-thread .nl-bubble').length, unread: window.game.messages.unread() }), who.id);
  check('only people the character has met are contacts; a message is sent, the box clears and keeps the keyboard, and they answer a moment later',
    strangers === 0 && listed && sent.thread.join() === 'me' && sent.field === '' && sent.focused === 'chat-input' && replied.thread.join() === 'me,them' && replied.bubbles === 2 && replied.unread === 0,
    { strangers, listed, sent, replied, who });

  // A reply that arrives while looking at something else is counted on the app's tile
  await page.keyboard.type('Thank you');
  await page.keyboard.press('Enter');
  await wait(150);
  await click(page, '#phone-home-bar');
  await advance(page, 3);
  await wait(250);
  const badge = await page.evaluate(() => document.querySelector('#phone-apps [data-app="messages"] .nlphone-badge')?.dataset.badge ?? null);
  await reload(page);
  await closeDialogs(page);
  const kept = await page.evaluate((id) => ({ thread: window.game.hud.backend.thread(id).messages.length, unread: window.game.messages.unread() }), who.id);
  await openApp(page, 'messages', `c:${who.id}`);
  const read = await page.evaluate(() => window.game.messages.unread());
  check('an unread reply shows as a badge on the Messages tile, the conversation is saved, and opening it clears the badge',
    badge === '1' && kept.thread === 4 && kept.unread === 1 && read === 0, { badge, kept, read });
  await page.evaluate(() => window.game.hud.phoneModal.close());

  // ------------------------------------------------------------------ Two players: money and private messages
  const other = await ctx.newPage();
  await other.setViewport({ width: 1000, height: 700 });
  // A second player: their own saved game, in the same browser
  await other.goto(`${page.url().split('?')[0]}?player=tunde`, { waitUntil: 'load', timeout: 120000 });
  await other.waitForFunction('window.game', { timeout: 120000 });
  await wait(2500);
  await other.evaluate(() => document.getElementById('dialogue-confirm-btn')?.click());
  for (let i = 0; i < 6; i++) {
    await advance(page, 0.2);
    await wait(120);
    await advance(other, 0.2);
    await wait(120);
  }
  await page.bringToFront(); // the keyboard goes to the tab in front
  const themId = await page.evaluate(() => [...window.game.network.remotePlayers.keys()][0] ?? null);
  await give(page, 90000);
  const mine0 = await money(page);
  const theirs0 = await money(other);

  await openApp(page, 'bank', 'send');
  await tap(page, `[data-set="bank.to"][data-value="${themId}"]`);
  await type(page, '#bank-amount', '999999999');
  await tap(page, '#bank-send-btn');
  const tooMuch = await notice(page);
  const untouched = (await money(page)).total === mine0.total && (await money(other)).total === theirs0.total;
  await type(page, '#bank-amount', '12500');
  await tap(page, '#bank-send-btn');
  await wait(400);
  await advance(other, 0.2);
  const mine1 = await money(page);
  const theirs1 = await money(other);
  check('sending more than the account holds is refused and nothing moves', /not enough/i.test(tooMuch ?? '') && untouched, { tooMuch, untouched });
  check('a transfer leaves the sender\'s bank account once and arrives in the other player\'s bank account once',
    themId && mine0.bank - mine1.bank === 12500 && mine1.cash === mine0.cash && theirs1.bank - theirs0.bank === 12500 && theirs1.cash === theirs0.cash
      && (await ledger(page, 'TRANSFER_OUT')) === 1 && (await ledger(other, 'TRANSFER_IN')) === 1,
    { sent: mine0.bank - mine1.bank, received: theirs1.bank - theirs0.bank });
  const afterSend = await page.evaluate(() => ({ title: document.getElementById('phone-title').textContent, amount: window.game.hud.phoneModal.memory?.get?.('bank.amount') ?? '' }));
  check('after sending, the app is back on the account with the amount box cleared, so a second press cannot repeat it', afterSend.title === 'Bank' && afterSend.amount === '', afterSend);

  await openApp(page, 'messages', `c:player:${themId}`);
  await click(page, '#chat-input');
  await page.keyboard.type('Check your account');
  await page.keyboard.press('Enter');
  await wait(400);
  const dm = await other.evaluate(() => { const g = window.game; const c = g.messages.contacts().find((entry) => entry.kind === 'player'); return c ? { unread: c.unread, last: c.last?.text ?? null, street: document.getElementById('chat-messages-list')?.textContent.includes('Check your account') ?? false } : null; });
  check('a private message reaches the other player\'s phone and does not appear in street chat', dm && dm.unread === 1 && dm.last === 'Check your account' && !dm.street, dm);
  await other.close();

  check('phone: no console errors', log.errors.length === 0, log.errors.slice(0, 6));
  await ctx.close();
}
