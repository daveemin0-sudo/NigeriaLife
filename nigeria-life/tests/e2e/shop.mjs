// Shopping that is seen to happen: in through the door, a basket from the stack, things taken
// off the shelves, the cashier ringing them up, and money and goods changing hands once.
import { open, wait, money, newPlayer, advance, playUntil, closeDialogs, leaveByDoor } from './lib.mjs';

const ROOM = { x: 260, z: 540 };

/** Where things stand in the shop, read from the game so the test follows the room if it is rearranged. */
const readLayout = (page) => page.evaluate(() => {
  const layout = window.game.world.interiorManager.shop.service.layout;
  const xz = (v) => ({ x: v.x, z: v.z });
  const shelves = Object.fromEntries(Object.entries(layout.shelves).map(([id, v]) => [id, { ...xz(v), stand: { x: v.x, z: v.z + 1.15 } }]));
  return {
    shelves,
    baskets: xz(layout.baskets.stand),
    till: xz(layout.till.customer),
    // shelves and the till, as [centre x, centre z, half width, half length]
    solid: [...Object.values(layout.shelves).map((v) => [v.x, v.z, 2.2, 0.35]), [layout.till.position.x, layout.till.position.z, 1.7, 0.45]],
  };
});

const snapshot = (page) => page.evaluate((room) => {
  const g = window.game;
  const service = g.world.interiorManager.shop.service;
  const actor = g.player.actor;
  const data = g.hud.backend.getData();
  const cashier = g.interactions.actorFor('interior_npc_npc_shop_cashier');
  const sale = service.sale;
  return {
    inside: g.world.interiorManager.currentInterior?.type ?? null,
    x: +(g.player.position.x - room.x).toFixed(2),
    z: +(g.player.position.z - room.z).toFixed(2),
    lines: service.lines.map((line) => line.product.id),
    total: service.total,
    busy: service.busy,
    sale: sale ? { scanned: sale.scanned, count: sale.count, running: sale.running, settled: sale.settled, method: sale.method } : null,
    receipt: service.receipt,
    cash: data.walletCash,
    bank: data.bank.balance,
    bills: data.transactionHistory.filter((t) => t.type === 'SHOP_PURCHASE').length,
    goods: Object.fromEntries(data.inventory.filter((item) => item.id.startsWith('shop_')).map((item) => [item.id.slice(5), item.quantity])),
    hasBasket: !!service.basket,
    basketInHands: !!service.basket && actor.carried === service.basket.group,
    bagInHand: !!g.player.mesh.getObjectByName('shop_bag'),
    doing: actor.sequence?.name ?? null,
    scripted: actor.scripted,
    arms: actor.pose.arms,
    cashierDoing: cashier.sequence?.name ?? null,
    cashierHome: Math.abs(Math.atan2(Math.sin(cashier.yaw - cashier.homeYaw), Math.cos(cashier.yaw - cashier.homeYaw))) < 0.1,
    water: service.stockLeft('water'),
    malt: service.stockLeft('malt'),
    bread: service.stockLeft('bread'),
    tillTaken: g.interactions.isTaken('shop:till'),
  };
}, ROOM);

/** Nobody mid-action: the player free, the cashier back facing her till. */
const idle = (s) => !s.doing && !s.scripted && !s.busy && !s.sale && !s.cashierDoing && s.cashierHome && !s.tillTaken;
const untilIdle = async (page, seconds = 40) => {
  for (let played = 0; played < seconds; played += 0.5) {
    const s = await snapshot(page);
    if (idle(s)) return s;
    await advance(page, 0.5);
    await wait(30);
  }
  return snapshot(page);
};

const setCash = (page, amount) => page.evaluate((target) => {
  const be = window.game.hud.backend;
  const cash = be.getData().walletCash;
  if (cash > target) be.depositToBank(cash - target);
  else if (cash < target) be.withdrawFromATM(target - cash);
  return be.getData().walletCash;
}, amount);

/** Opens a shelf in the sheet and taps one product on it. Returns the note the sheet shows. */
const take = async (page, section, product) => {
  await page.evaluate((id) => window.game.shopUI.openShelf(id), section);
  await wait(120);
  await page.click(`#shop-sheet .buka-dish[data-product="${product}"]`);
  await wait(120);
  const note = await page.evaluate(() => document.getElementById('shop-sheet-note')?.textContent ?? null);
  await page.evaluate(() => window.game.shopUI.close());
  return note;
};
/** Takes something and plays on until it is in the basket (or the attempt is over). */
const takeAndWait = async (page, section, product) => {
  const before = (await snapshot(page)).lines.length;
  const note = await take(page, section, product);
  await playUntil(page, (n) => { const s = window.game.world.interiorManager.shop.service; return !s.busy && (s.lines.length > n || !window.game.player.actor.sequence) ? true : null; }, 25, before);
  return note;
};
const pay = async (page, method) => {
  await page.evaluate(() => window.game.shopUI.openBasket());
  await wait(120);
  await page.click(method === 'card' ? '#shop-pay-card' : '#shop-pay-cash');
  await wait(120);
  return page.evaluate(() => ({ note: document.getElementById('shop-sheet-note')?.textContent ?? null, open: window.game.shopUI.isOpen }));
};

export async function run(browser, check) {
  const ctx = await newPlayer(browser);
  const { page, log } = await open(ctx);
  await closeDialogs(page);
  const L = await readLayout(page);
  const near = (s, spot, within = 0.5) => Math.hypot(s.x - spot.x, s.z - spot.z) < within;

  // ------------------------------------------------------------------ In through the street door
  const door = await page.evaluate(() => {
    const g = window.game;
    const d = g.world.buildings.placeDoors.find((entry) => entry.buildingId === 'supermarket');
    g.player.mesh.position.set(d.outside.x - 1.5, 0, d.outside.z + 1);
    return { outside: [d.outside.x, d.outside.z], closed: d.door.isClosed };
  });
  await advance(page, 0.4);
  const prompt = await page.evaluate(() => window.game.hud.currentInteractionTarget?.label ?? null);
  check('on the street, Everyday Supermarket has a closed door and an "Enter" prompt beside it', door.closed && /Everyday Supermarket/.test(prompt || ''), { prompt, door });

  await page.keyboard.press('e');
  const opened = await playUntil(page, () => {
    const g = window.game;
    const d = g.world.buildings.placeDoors.find((entry) => entry.buildingId === 'supermarket');
    return d.door.openAmount > 0.6 && !g.world.interiorManager.currentInterior ? { atDoor: Math.hypot(g.player.position.x - d.outside.x, g.player.position.z - d.outside.z) < 0.4 } : null;
  }, 15);
  check('pressing E walks the player to the door and it swings open before they go in', opened && opened.atDoor, opened);
  const arrived = await playUntil(page, () => {
    const g = window.game;
    return g.world.interiorManager.currentInterior?.type === 'shop' && !g.world.interiorManager.busy && !g.player.actor.sequence ? true : null;
  }, 20);
  let s = await snapshot(page);
  check('the player is inside the shop, free to move, with nothing in hand', arrived && s.inside === 'shop' && !s.scripted && !s.hasBasket && s.lines.length === 0, { x: s.x, z: s.z });

  const room = await page.evaluate(() => {
    const g = window.game;
    const shop = g.world.interiorManager.shop;
    let units = 0;
    shop.group.traverse((o) => { if (o.name.startsWith('product_') && o.visible) units++; });
    return {
      units,
      spots: shop.interactiveList.map((o) => o.id),
      chips: [...document.querySelectorAll('#place-card .place-chip')].map((c) => c.dataset.spot),
      card: document.getElementById('place-card').textContent,
    };
  });
  check('the shop has four stocked shelves, a till, a cashier and another customer',
    room.units === 96 && ['shop_shelf_drinks', 'shop_shelf_food', 'shop_shelf_snacks', 'shop_shelf_household', 'shop_checkout', 'interior_npc_npc_shop_cashier', 'interior_npc_npc_shop_customer'].every((id) => room.spots.includes(id) && room.chips.includes(id)),
    { units: room.units, spots: room.spots.length });

  // ------------------------------------------------------------------ Browse a shelf the way a player does
  await page.click('#place-card .place-chip[data-spot="shop_shelf_drinks"]');
  const atFridge = await playUntil(page, () => (window.game.hud.currentActiveObject?.id === 'shop_shelf_drinks' ? true : null), 20);
  s = await snapshot(page);
  check('tapping the drinks chip walks the player to the fridge', atFridge && near(s, L.shelves.drinks.stand, 0.6), { x: s.x, z: s.z });
  await page.click('#card-action-btn');
  await wait(200);
  const shelf = await page.evaluate(() => ({
    open: window.game.shopUI.isOpen,
    products: [...document.querySelectorAll('#shop-sheet .buka-dish')].map((row) => ({ id: row.dataset.product, price: row.querySelector('.buka-dish-price').textContent })),
    tabs: [...document.querySelectorAll('#shop-sheet .shop-tab')].length,
  }));
  check('the fridge opens a list of what is on it, with prices',
    shelf.open && shelf.products.map((p) => p.id).join() === 'water,malt,zobo,cola' && shelf.products.every((p) => /^₦[\d,]+$/.test(p.price)) && shelf.tabs === 5, shelf);
  await page.evaluate(() => window.game.shopUI.close());

  // Record where the player walks from here on, to check they go round the shelves and the till
  await page.evaluate(({ room, solid }) => {
    const g = window.game;
    const director = g.interactions;
    const update = director.update.bind(director);
    window.__shopTrail = { inside: 0, worst: Infinity };
    director.update = (delta) => {
      update(delta);
      const actor = g.player.actor;
      if (actor.pose.legs !== 'walk' || g.world.interiorManager.currentInterior?.type !== 'shop') return;
      const x = g.player.position.x - room.x;
      const z = g.player.position.z - room.z;
      for (const [cx, cz, hw, hl] of solid) {
        const gap = Math.max(Math.abs(x - cx) - hw, Math.abs(z - cz) - hl);
        if (gap < window.__shopTrail.worst) window.__shopTrail.worst = gap;
        if (gap < 0) window.__shopTrail.inside++;
      }
    };
  }, { room: ROOM, solid: L.solid });

  // ------------------------------------------------------------------ A basket, then things off the shelves
  const start = await snapshot(page);
  await take(page, 'drinks', 'water');
  const fetching = await playUntil(page, () => {
    const g = window.game;
    const service = g.world.interiorManager.shop.service;
    return service.basket && g.player.actor.carried === service.basket.group && service.lines.length === 0
      ? { x: +(g.player.position.x - 260).toFixed(2), z: +(g.player.position.z - 540).toFixed(2) }
      : null;
  }, 20);
  check('the first thing the player does is walk to the stack by the door and pick up a basket', fetching && near(fetching, L.baskets), fetching);
  const reaching = await playUntil(page, (standZ) => {
    const g = window.game;
    return g.player.actor.pose.arms === 'reach' && g.world.interiorManager.shop.service.basket && Math.abs(g.player.position.z - 540 - standZ) < 0.3 ? true : null;
  }, 20, L.shelves.drinks.stand.z);
  await playUntil(page, () => (window.game.world.interiorManager.shop.service.lines.length === 1 ? true : null), 5);
  s = await untilIdle(page);
  check('then they carry it to the fridge, reach in, and the water is in the basket and gone from the shelf',
    !!reaching && s.lines.join() === 'water' && s.water === 5 && s.basketInHands, { lines: s.lines, water: s.water });
  check('nothing has been charged and nothing is in the bag yet: it is only in the basket',
    s.cash === start.cash && s.bills === start.bills && Object.keys(s.goods).length === 0, { cash: s.cash, goods: s.goods });
  check('the status line shows the basket and what it comes to',
    await page.evaluate(() => { const el = document.getElementById('shop-status'); return el.style.display !== 'none' && /Basket · 1 item/.test(el.textContent) && /₦300/.test(el.textContent); }));

  await takeAndWait(page, 'drinks', 'malt');
  await takeAndWait(page, 'food', 'bread');
  s = await untilIdle(page);
  check('more things can be taken from this shelf and from another one', s.lines.join() === 'water,malt,bread' && s.total === 2300 && s.malt === 5 && s.bread === 5, { lines: s.lines, total: s.total });

  // Walking about freely with the basket: hands stay on it
  await page.keyboard.down('d');
  await advance(page, 0.5);
  const carrying = await page.evaluate(() => {
    const g = window.game;
    return { scripted: g.player.actor.scripted, armX: +g.player.humanRig.leftArm.rotation.x.toFixed(2), basket: g.player.actor.carried?.name };
  });
  await page.keyboard.up('d');
  await advance(page, 0.2);
  check('walking about with the keys, the basket stays in both hands', !carrying.scripted && carrying.basket === 'shop_basket' && carrying.armX < -1, carrying);

  // ------------------------------------------------------------------ Putting something back
  await page.evaluate(() => window.game.shopUI.openBasket());
  await wait(120);
  const basketView = await page.evaluate(() => ({
    rows: [...document.querySelectorAll('#shop-sheet .shop-line')].length,
    total: document.getElementById('shop-total-amount')?.textContent,
  }));
  await page.click('#shop-sheet .shop-line:nth-child(2)');
  await wait(120);
  await page.evaluate(() => window.game.shopUI.close());
  await playUntil(page, () => (window.game.world.interiorManager.shop.service.lines.length === 2 ? true : null), 25);
  s = await untilIdle(page);
  check('the basket lists what is in it and the total; tapping the malt walks it back to the fridge',
    basketView.rows === 3 && basketView.total === '₦2,300' && s.lines.join() === 'water,bread' && s.malt === 6 && s.total === 1700 && near(s, L.shelves.drinks.stand),
    { basketView, lines: s.lines, malt: s.malt, z: s.z });

  // ------------------------------------------------------------------ Not enough money
  const startCash = s.cash;
  await setCash(page, 500);
  let attempt = await pay(page, 'cash');
  await advance(page, 1.5);
  s = await snapshot(page);
  check('paying cash without enough cash is refused with the amounts, and nothing happens',
    attempt.open && /₦1,700/.test(attempt.note || '') && /₦500/.test(attempt.note || '') && !s.sale && s.cash === 500 && s.bills === start.bills && s.lines.length === 2,
    { note: attempt.note, sale: s.sale });
  await page.evaluate(() => window.game.shopUI.close());
  await setCash(page, startCash);

  // ------------------------------------------------------------------ The till
  let before = await snapshot(page);
  attempt = await pay(page, 'cash');
  check('with the money, "Pay cash" closes the sheet and starts the trip to the till', !attempt.open && (await snapshot(page)).sale !== null, attempt);
  const second = await page.evaluate(() => window.game.world.interiorManager.shop.service.checkout('cash'));
  check('asking to pay again while already paying is refused', second.ok === false, second);

  const onCounter = await playUntil(page, () => {
    const g = window.game;
    const service = g.world.interiorManager.shop.service;
    return service.basket && service.basket.group.parent === g.world.interiorManager.shop.group
      ? { x: +(g.player.position.x - 260).toFixed(2), z: +(g.player.position.z - 540).toFixed(2), carried: g.player.actor.carried !== null }
      : null;
  }, 25);
  check('the player walks to the till and puts the basket on the counter', onCounter && near(onCounter, L.till, 0.3) && !onCounter.carried, onCounter);

  const ringing = await playUntil(page, () => {
    const g = window.game;
    const sale = g.world.interiorManager.shop.service.sale;
    const cashier = g.interactions.actorFor('interior_npc_npc_shop_cashier');
    return sale && sale.scanned === 1 ? { running: sale.running, cashierReaching: cashier.pose.arms === 'reach', cash: g.hud.backend.getData().walletCash } : null;
  }, 15);
  check('the cashier rings the things up one at a time, and the money is not taken while she does',
    ringing && ringing.running === 300 && ringing.cashierReaching && ringing.cash === before.cash, ringing);
  check('the status line follows the till',
    await page.evaluate(() => { const el = document.getElementById('shop-status'); return el.style.display !== 'none' && /At the till/.test(el.textContent) && /rung up 1 of 2/.test(el.textContent) && !!document.getElementById('shop-status-cancel'); }));

  const bagged = await playUntil(page, () => {
    const g = window.game;
    const shop = g.world.interiorManager.shop;
    const bag = shop.group.getObjectByName('shop_bag');
    return bag && !shop.service.sale?.settled ? { cash: g.hud.backend.getData().walletCash, goods: g.hud.backend.getData().inventory.filter((i) => i.id.startsWith('shop_')).length } : null;
  }, 20);
  check('she packs a bag on the counter; it is still not paid for, and not the player\'s yet', bagged && bagged.cash === before.cash && bagged.goods === 0, bagged);

  const settled = await playUntil(page, () => (window.game.world.interiorManager.shop.service.receipt ? true : null), 15);
  s = await snapshot(page);
  check('she hands the bag over, and at that moment the money is taken once and the goods are the player\'s',
    settled && before.cash - s.cash === 1700 && s.bills === before.bills + 1 && s.goods.water === 1 && s.goods.bread === 1 && Object.keys(s.goods).length === 2 && s.bagInHand,
    { paid: before.cash - s.cash, bills: s.bills - before.bills, goods: s.goods, bag: s.bagInHand });
  s = await untilIdle(page);
  await advance(page, 8);
  const later = await snapshot(page);
  check('afterwards the basket is gone, the player and the cashier are free, and nothing more is charged',
    idle(later) && !later.hasBasket && later.lines.length === 0 && before.cash - later.cash === 1700 && later.bills === before.bills + 1 && !later.receipt,
    { idle: idle(later), basket: later.hasBasket, paid: before.cash - later.cash, cashierDoing: later.cashierDoing });
  const trail = await page.evaluate(() => window.__shopTrail);
  check('the player walked round the shelves and the till the whole time, never through them', trail.inside === 0 && trail.worst > 0.1, { closest: +trail.worst.toFixed(2), framesInside: trail.inside });

  // What was bought is real: it can be eaten from the bag
  const ate = await page.evaluate(() => {
    const be = window.game.hud.backend;
    be.data.stats.hunger = 40;
    const used = be.useItem('shop_bread');
    return { ok: used.success, hunger: be.getData().stats.hunger, left: be.getData().inventory.find((i) => i.id === 'shop_bread')?.quantity ?? 0 };
  });
  check('the bread from the bag can be eaten: it fills the player and is used up', ate.ok && ate.hunger > 40 && ate.left === 0, ate);

  // ------------------------------------------------------------------ Stepping away from the till
  await takeAndWait(page, 'snacks', 'gala');
  await takeAndWait(page, 'snacks', 'chinchin');
  before = await untilIdle(page);
  check('the carrier bag is put away when the player takes a new basket', !before.bagInHand && before.basketInHands && before.lines.join() === 'gala,chinchin', { bag: before.bagInHand, lines: before.lines });
  await pay(page, 'cash');
  await playUntil(page, () => (window.game.world.interiorManager.shop.service.sale?.scanned >= 1 ? true : null), 30);
  await page.click('#shop-status-cancel');
  await advance(page, 0.3);
  s = await untilIdle(page);
  check('cancelling at the till charges nothing and puts everything back in the basket, in the player\'s hands',
    idle(s) && s.cash === before.cash && s.bills === before.bills && s.lines.join() === 'gala,chinchin' && s.basketInHands && !s.bagInHand && Object.keys(s.goods).join() === 'water',
    { cash: s.cash - before.cash, lines: s.lines, hands: s.basketInHands, goods: s.goods });

  // Walking off with a movement key does the same
  await pay(page, 'cash');
  await playUntil(page, () => (window.game.world.interiorManager.shop.service.sale?.scanned >= 2 ? true : null), 30);
  await page.keyboard.down('a');
  await advance(page, 0.5);
  await page.keyboard.up('a');
  s = await untilIdle(page);
  check('walking away from the till mid-sale also leaves everything unpaid and in the basket',
    idle(s) && s.cash === before.cash && s.bills === before.bills && s.lines.length === 2 && s.basketInHands, { lines: s.lines, paid: before.cash - s.cash });

  // ------------------------------------------------------------------ The money goes before the bag is handed over
  await pay(page, 'cash');
  await playUntil(page, () => { const sale = window.game.world.interiorManager.shop.service.sale; return sale && sale.scanned === sale.count ? true : null; }, 30);
  await setCash(page, 200);
  await playUntil(page, () => (window.game.world.interiorManager.shop.service.sale ? null : true), 20);
  s = await untilIdle(page);
  check('if the cash is gone by the time it is due, the sale is off: no charge, no goods, basket back in hand',
    idle(s) && s.cash === 200 && s.bills === before.bills && s.lines.length === 2 && s.basketInHands && Object.keys(s.goods).join() === 'water' && !s.bagInHand,
    { cash: s.cash, bills: s.bills - before.bills, goods: s.goods });

  // ------------------------------------------------------------------ Paying by card
  before = await snapshot(page);
  attempt = await pay(page, 'card');
  const cardDone = await playUntil(page, () => (window.game.world.interiorManager.shop.service.receipt ? true : null), 40);
  s = await untilIdle(page);
  check('paying by card takes the money from the bank account, not the wallet, once',
    !attempt.open && cardDone && before.bank - s.bank === 1000 && s.cash === before.cash && s.bills === before.bills + 1 && s.goods.gala === 1 && s.goods.chinchin === 1,
    { fromBank: before.bank - s.bank, fromCash: before.cash - s.cash, goods: s.goods });
  await setCash(page, startCash);

  // ------------------------------------------------------------------ A sold-out shelf, and a full basket
  for (let i = 0; i < 6; i++) await takeAndWait(page, 'drinks', 'cola');
  s = await untilIdle(page);
  const soldOut = await take(page, 'drinks', 'cola');
  check('a product that has all been taken is sold out, and says so', s.lines.filter((id) => id === 'cola').length === 6 && /sold out/i.test(soldOut || ''), { colas: s.lines.length, note: soldOut });
  await takeAndWait(page, 'drinks', 'zobo');
  await takeAndWait(page, 'drinks', 'zobo');
  const full = await take(page, 'drinks', 'zobo');
  s = await untilIdle(page);
  check('the basket takes eight things and then says it is full', s.lines.length === 8 && /full/i.test(full || ''), { lines: s.lines.length, note: full });

  // ------------------------------------------------------------------ Walking out without paying
  before = await snapshot(page);
  const out = await leaveByDoor(page);
  await advance(page, 0.5);
  s = await snapshot(page);
  check('leaving with an unpaid basket leaves it behind: nothing charged, nothing kept',
    out && s.inside === null && s.cash === before.cash && s.bills === before.bills && JSON.stringify(s.goods) === JSON.stringify(before.goods) && !s.hasBasket && s.lines.length === 0 && !s.scripted,
    { inside: s.inside, paid: before.cash - s.cash, goods: s.goods, basket: s.hasBasket });
  const back = await page.evaluate(() => {
    const g = window.game;
    const d = g.world.buildings.placeDoors.find((entry) => entry.buildingId === 'supermarket');
    return { fromDoor: +Math.hypot(g.player.position.x - d.outside.x, g.player.position.z - d.outside.z).toFixed(2), carrying: g.player.actor.carried !== null, status: document.getElementById('shop-status').style.display };
  });
  check('they come out at the shop door with empty hands', back.fromDoor < 0.3 && !back.carrying && back.status === 'none', back);

  // Going back in: the shelves are full again
  await page.keyboard.press('e');
  await playUntil(page, () => (window.game.world.interiorManager.currentInterior?.type === 'shop' && !window.game.world.interiorManager.busy && !window.game.player.actor.sequence ? true : null), 30);
  s = await snapshot(page);
  check('going back in finds the shelves restocked and no basket in hand', s.inside === 'shop' && s.water === 6 && s.malt === 6 && s.bread === 6 && !s.hasBasket && idle(s), { water: s.water, basket: s.hasBasket });

  // ------------------------------------------------------------------ Shelves are solid
  const gondola = L.shelves.snacks;
  await page.evaluate((spot) => { const g = window.game; g.player.mesh.position.set(260 + spot.x, 0, 540 + spot.z + 1.5); g.cameraManager.interiorYaw = 0; }, gondola);
  await advance(page, 0.2);
  await page.keyboard.down('w');
  let deepest = Infinity;
  for (let i = 0; i < 12; i++) {
    await advance(page, 0.15);
    deepest = Math.min(deepest, await page.evaluate(() => window.game.player.position.z - 540));
  }
  await page.keyboard.up('w');
  await advance(page, 0.2);
  check('walking straight at a shelf with the keys stops at it instead of passing through', deepest > gondola.z + 0.35, { nearestToShelfCentre: +(deepest - gondola.z).toFixed(2) });

  // ------------------------------------------------------------------ From the map
  await leaveByDoor(page);
  await advance(page, 0.5);
  await page.click('#nav-btn-map');
  await wait(1500);
  await page.click('.map-pin[data-place="everyday_supermarket"]');
  await wait(500);
  const sheet = await page.evaluate(() => document.getElementById('map-card-name')?.textContent ?? null);
  await page.click('#btn-card-go');
  const viaMap = await playUntil(page, () => {
    const g = window.game;
    return g.world.interiorManager.currentInterior?.type === 'shop' && !g.world.interiorManager.busy && !g.player.actor.sequence ? true : null;
  }, 30);
  check('the map has a pin for the supermarket, and its Go button brings the player in through the shop door',
    /Everyday Supermarket/.test(sheet || '') && !!viaMap, { sheet, viaMap });

  check('shop: no console errors', log.errors.length === 0, log.errors.slice(0, 5));
  await ctx.close();
}
