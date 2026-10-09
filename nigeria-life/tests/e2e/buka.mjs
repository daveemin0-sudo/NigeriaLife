// One place that feels real: walk in off the street through the door, order, sit, be served
// at the table, eat, pay once, and walk back out to the same spot. Plus waving at people.
import { open, reload, wait, money, quest, newPlayer, enterInterior, advance, playUntil, useStation, closeDialogs } from './lib.mjs';

const ROOM = { x: 260, z: 240 };

/** Everything worth knowing about the buka at this instant. */
const snapshot = (page) => page.evaluate((room) => {
  const g = window.game;
  const service = g.world.interiorManager.restaurant.service;
  const actor = g.player.actor;
  const data = g.hud.backend.getData();
  const order = service.order;
  const meals = [];
  g.world.interiorManager.restaurant.group.traverse((o) => { if (o.name.startsWith('meal_')) meals.push(o.name); });
  const waiterPos = service.waiter.worldPosition();
  return {
    inside: g.world.interiorManager.currentInterior?.type ?? null,
    x: +(g.player.position.x - room.x).toFixed(2),
    z: +(g.player.position.z - room.z).toFixed(2),
    seated: actor.hold !== null,
    scripted: actor.scripted,
    doing: actor.sequence?.name ?? null,
    legs: actor.pose.legs,
    arms: actor.pose.arms,
    order: order ? { dish: order.dish.id, stage: order.stage, paid: order.paid, bitesLeft: order.bitesLeft } : null,
    progress: service.progress(),
    cash: data.walletCash,
    hunger: data.stats.hunger,
    foodBills: data.transactionHistory.filter((t) => t.type === 'FOOD_PURCHASE').length,
    meals: meals.length,
    waiterDoing: service.waiter.sequence?.name ?? null,
    waiterCarrying: service.waiter.carried !== null,
    waiterAtPost: Math.hypot(waiterPos.x - room.x - 1.0, waiterPos.z - room.z + 2.4) < 0.3,
    cookDoing: service.cook.sequence?.name ?? null,
    seatsTaken: [...g.interactions.reservations.entries()].filter(([spot]) => spot.startsWith('buka:')).map(([spot, who]) => `${spot}=${who}`),
  };
}, ROOM);

/** The room is back to rest: nobody mid-task, no plate in transit, the player free. */
const settled = (s) => !s.order && !s.doing && !s.seated && !s.scripted && !s.waiterDoing && !s.cookDoing && !s.waiterCarrying && s.waiterAtPost && s.meals === 3;
const untilSettled = async (page, seconds = 60) => {
  for (let played = 0; played < seconds; played += 0.5) {
    const s = await snapshot(page);
    if (settled(s)) return s;
    await advance(page, 0.5);
    await wait(30);
  }
  return snapshot(page);
};

const openMenu = async (page) => {
  await closeDialogs(page);
  const used = await useStation(page, 'buka_food_counter');
  await wait(200);
  return { used, open: await page.evaluate(() => window.game.bukaUI.isOpen) };
};
const orderDish = async (page, dish) => {
  const menu = await openMenu(page);
  if (!menu.open) throw new Error(`the menu did not open for ${dish}: ${JSON.stringify(menu)} ${JSON.stringify(await snapshot(page))}`);
  await page.click(`.buka-dish[data-dish="${dish}"]`);
  await wait(150);
};
const setCash = (page, amount) => page.evaluate((target) => {
  const be = window.game.hud.backend;
  const cash = be.getData().walletCash;
  if (cash > target) be.depositToBank(cash - target);
  else if (cash < target) be.withdrawFromATM(target - cash);
  return be.getData().walletCash;
}, amount);

export async function run(browser, check) {
  const ctx = await newPlayer(browser);
  const { page, log } = await open(ctx);

  // ------------------------------------------------------------------ In through the street door
  await page.evaluate(() => { const g = window.game; g.hud.backend.data.stats.hunger = 30; g.player.mesh.position.set(-8, 0, -6.5); });
  await advance(page, 0.4);
  const street = await page.evaluate(() => {
    const g = window.game;
    const door = g.world.buildings.placeDoors.find((d) => d.buildingId === 'mama-put');
    return { prompt: g.hud.currentInteractionTarget?.label ?? null, doorClosed: door.door.isClosed, outside: [door.outside.x, door.outside.z] };
  });
  check('on the street, the buka has a closed door and an "Enter" prompt beside it', street.doorClosed && /Mama Put/.test(street.prompt || ''), street);

  await page.keyboard.press('e');
  const opened = await playUntil(page, () => {
    const g = window.game;
    const door = g.world.buildings.placeDoors[0];
    return door.door.openAmount > 0.6 && !g.world.interiorManager.currentInterior
      ? { atDoor: Math.hypot(g.player.position.x - door.outside.x, g.player.position.z - door.outside.z) < 0.4, locked: g.player.actor.sequence?.interruptible === false }
      : null;
  }, 15);
  check('pressing E walks the player to the door and the door swings open before they go in', opened && opened.atDoor && opened.locked, opened);

  const arrived = await playUntil(page, () => {
    const g = window.game;
    return g.world.interiorManager.currentInterior?.type === 'restaurant' && !g.world.interiorManager.busy && !g.player.actor.sequence ? true : null;
  }, 20);
  let s = await snapshot(page);
  check('the player walks through and is inside Mama Put, free to move', arrived && s.inside === 'restaurant' && !s.scripted && Math.abs(s.x) < 0.5 && s.z > 7.5, { x: s.x, z: s.z, scripted: s.scripted });
  const doorsShut = await playUntil(page, () => {
    const g = window.game;
    const inner = g.world.interiorManager.restaurant.group.getObjectByName('interior_exit_door').userData.door;
    return inner.isClosed && g.world.buildings.placeDoors[0].door.isClosed;
  }, 5);
  check('both sides of the door are shut again behind them', !!doorsShut);
  check('the room has a waiter, a cook and three seated customers, each on their own chair',
    s.seatsTaken.length === 3 && new Set(s.seatsTaken.map((t) => t.split('=')[0])).size === 3 && s.meals === 3, s.seatsTaken);

  // ------------------------------------------------------------------ The menu
  const menu = await openMenu(page);
  const dishes = await page.evaluate(() => [...document.querySelectorAll('.buka-dish')].map((d) => ({ id: d.dataset.dish, price: d.querySelector('.buka-dish-price').textContent })));
  check('the counter opens a menu of jollof, fried rice, amala, eba and suya with prices',
    menu.open && dishes.map((d) => d.id).join() === 'jollof_rice,fried_rice,amala,eba,suya' && dishes.every((d) => /^₦[\d,]+$/.test(d.price)), dishes);
  await page.click('#buka-menu-close');

  // ------------------------------------------------------------------ Cannot afford it
  const startCash = (await money(page)).cash;
  await setCash(page, 1000);
  let before = await snapshot(page);
  await orderDish(page, 'amala');
  const refused = await page.evaluate(() => ({ note: document.getElementById('buka-menu-note')?.textContent ?? null, stillOpen: window.game.bukaUI.isOpen }));
  await advance(page, 2);
  s = await snapshot(page);
  check('a dish the player cannot afford is refused with the reason, and nothing happens',
    !!refused.note && /₦1,200 more/.test(refused.note) && refused.stillOpen && !s.order && s.cash === 1000 && s.foodBills === 0 && s.seatsTaken.length === 3 && !s.waiterDoing && !s.cookDoing,
    { note: refused.note, order: s.order, cash: s.cash });
  await page.click('#buka-menu-close');
  await setCash(page, startCash);

  // ------------------------------------------------------------------ Order, sit, be served, eat, pay
  before = await snapshot(page);
  // Record where everyone walks from here on, to check nobody cuts through the furniture
  await page.evaluate((room) => {
    const g = window.game;
    const service = g.world.interiorManager.restaurant.service;
    const director = g.interactions;
    const update = director.update.bind(director);
    window.__trail = { worst: Infinity, who: '', counter: 0 };
    const tables = [[4, 2], [4, -4], [-4, 4]];
    director.update = (delta) => {
      update(delta);
      for (const [who, actor] of [['player', g.player.actor], ['waiter', service.waiter], ['cook', service.cook]]) {
        if (actor.pose.legs !== 'walk') continue;
        const p = actor.worldPosition();
        const x = p.x - room.x;
        const z = p.z - room.z;
        for (const [tx, tz] of tables) {
          const gap = Math.hypot(x - tx, z - tz) - 1.05; // distance outside the table top
          if (gap < window.__trail.worst) { window.__trail.worst = gap; window.__trail.who = who; }
        }
        // Inside the serving counter's footprint
        if (Math.abs(x + 4) < 2.4 && Math.abs(z + 5) < 0.7) window.__trail.counter++;
      }
    };
  }, ROOM);
  await orderDish(page, 'jollof_rice');
  s = await snapshot(page);
  check('ordering jollof starts the order without charging anything yet', s.order?.dish === 'jollof_rice' && s.cash === before.cash && s.foodBills === 0 && !(await page.evaluate(() => window.game.bukaUI.isOpen)), s.order);

  const seated = await playUntil(page, () => (window.game.player.actor.hold ? true : null), 20);
  s = await snapshot(page);
  const mySeat = s.seatsTaken.find((t) => t.endsWith('=player'));
  check('the player walks to a free chair and sits down', seated && s.seated && s.legs === 'sit' && !!mySeat && s.seatsTaken.length === 4, { seat: mySeat, x: s.x, z: s.z });
  check('the status line shows the order and offers to cancel it',
    await page.evaluate(() => { const el = document.getElementById('buka-order-status'); return el.style.display !== 'none' && /Jollof/.test(el.textContent) && /Cancel order/.test(el.textContent); }));

  const carrying = await playUntil(page, () => {
    const service = window.game.world.interiorManager.restaurant.service;
    return service.waiter.carried && service.waiter.pose.legs === 'walk' && !service.order.paid
      ? { cash: window.game.hud.backend.getData().walletCash }
      : null;
  }, 25);
  check('the waiter walks the plate across the room in his hands, and it is not paid for yet', carrying && carrying.cash === before.cash, carrying);

  const served = await playUntil(page, () => {
    const service = window.game.world.interiorManager.restaurant.service;
    const order = service.order;
    if (!order || order.stage !== 'eating') return null;
    const plate = order.meal.group.position;
    return { onTable: order.meal.group.parent === service.group && Math.hypot(plate.x - order.seat.plate.x, plate.z - order.seat.plate.z) < 0.01, inHands: service.waiter.carried !== null };
  }, 25);
  s = await snapshot(page);
  check('he sets it down at the player\'s place, and that is when they pay: once, the menu price',
    served && served.onTable && !served.inHands && before.cash - s.cash === 1800 && s.foodBills === 1 && s.order.paid, { paid: before.cash - s.cash, bills: s.foodBills });
  check('the player eats: the eating animation plays at the table', s.arms === 'eat' && s.legs === 'sit' && s.seated);

  // Hunger and the food on the plate change together, a mouthful at a time
  const bites = [];
  for (let i = 0; i < 80 && (bites.length === 0 || bites[bites.length - 1].left > 0); i++) {
    const now = await page.evaluate(() => {
      const order = window.game.world.interiorManager.restaurant.service.order;
      if (!order || !order.meal) return null;
      let showing = 0;
      order.meal.group.traverse((o) => { if (o.isMesh && o.visible && o.parent !== order.meal.group) showing += o.scale.y; });
      return { left: order.bitesLeft, showing: +showing.toFixed(2), hunger: window.game.hud.backend.getData().stats.hunger };
    });
    if (!now) break;
    if (bites.length === 0 || bites[bites.length - 1].left !== now.left) bites.push(now);
    await advance(page, 0.4);
  }
  const foodGoesDown = bites.every((b, i) => i === 0 || b.showing < bites[i - 1].showing);
  const hungerGoesUp = bites.every((b, i) => i === 0 || b.hunger > bites[i - 1].hunger);
  check('with every mouthful there is less on the plate and the player is less hungry',
    bites.length >= 6 && bites[bites.length - 1].left === 0 && foodGoesDown && hungerGoesUp,
    bites.map((b) => `${b.left}: food ${b.showing}, hunger ${b.hunger.toFixed(1)}`));

  s = await untilSettled(page);
  check('when the plate is clean the player stands, the seat is free again and the waiter clears the table',
    settled(s) && s.seatsTaken.length === 3, { order: s.order, doing: s.doing, waiter: s.waiterDoing, meals: s.meals, seats: s.seatsTaken.length });
  check('the whole meal was charged exactly once, and it filled the player up',
    before.cash - s.cash === 1800 && s.foodBills === 1 && s.hunger - before.hunger > 45, { paid: before.cash - s.cash, bills: s.foodBills, hungerGain: +(s.hunger - before.hunger).toFixed(1) });
  const trail = await page.evaluate(() => window.__trail);
  check('everyone walked around the tables and the counter, never through them', trail.worst > 0.1 && trail.counter === 0, { closestToATable: +trail.worst.toFixed(2), who: trail.who, framesInsideCounter: trail.counter });
  check('eating at the buka counts for the "eat" quest objective', (await quest(page, 'quest_lagos_1')).obj.obj_l1_eat === true);

  // ------------------------------------------------------------------ Order again, then cancel before it arrives
  before = await snapshot(page);
  await orderDish(page, 'suya');
  await playUntil(page, () => (window.game.world.interiorManager.restaurant.service.waiter.carried ? true : null), 25);
  await page.click('#buka-order-stop');
  s = await untilSettled(page);
  check('ordering again works, and cancelling while the food is on its way costs nothing and leaves the room tidy',
    settled(s) && s.cash === before.cash && s.foodBills === 1 && s.seatsTaken.length === 3,
    { settled: settled(s), paid: before.cash - s.cash, bills: s.foodBills, waiter: s.waiterDoing, meals: s.meals, seated: s.seated });

  // ------------------------------------------------------------------ Walking off mid-order
  await orderDish(page, 'eba');
  await playUntil(page, () => (window.game.player.actor.sequence?.name === 'sit at table' ? true : null), 5);
  await advance(page, 0.6);
  await page.keyboard.down('s');
  await advance(page, 0.5);
  await page.keyboard.up('s');
  s = await snapshot(page);
  check('pressing a movement key on the way to the table drops the order and gives control straight back', !s.order && !s.scripted && !s.seated, { order: s.order, doing: s.doing });
  s = await untilSettled(page);
  check('nothing was charged for it and nobody is left holding a plate', settled(s) && s.cash === before.cash && s.foodBills === 1, { paid: before.cash - s.cash, meals: s.meals, waiter: s.waiterDoing });

  // ------------------------------------------------------------------ The money runs out before the plate arrives
  before = await snapshot(page);
  await orderDish(page, 'fried_rice');
  await playUntil(page, () => (window.game.world.interiorManager.restaurant.service.waiter.carried ? true : null), 25);
  await setCash(page, 500);
  await playUntil(page, () => (window.game.world.interiorManager.restaurant.service.order ? null : true), 30);
  s = await untilSettled(page);
  check('if the cash is gone when the plate arrives, it goes back to the kitchen: no charge, no meal, nobody stuck',
    settled(s) && s.cash === 500 && s.foodBills === 1, { settled: settled(s), cash: s.cash, bills: s.foodBills, meals: s.meals, doing: s.doing, waiter: s.waiterDoing });
  await setCash(page, before.cash);

  // ------------------------------------------------------------------ Standing up half-way through a meal
  before = await snapshot(page);
  await orderDish(page, 'amala');
  await playUntil(page, () => { const o = window.game.world.interiorManager.restaurant.service.order; return o && o.stage === 'eating' && o.bitesLeft <= 5 ? true : null; }, 60);

  // Waving from the table: no getting up, and the meal carries on afterwards
  await page.evaluate(() => { const g = window.game; g.hud.showInteractionCard(g.world.interiorManager.getActiveInteractiveObjects().find((o) => o.id === 'interior_npc_npc_kunle')); });
  await page.click('#card-wave-btn');
  const seatedWave = await playUntil(page, () => {
    const g = window.game;
    return g.player.actor.pose.arms === 'wave' ? { seated: g.player.actor.hold !== null, legs: g.player.actor.pose.legs } : null;
  }, 3);
  const kunleWaved = await playUntil(page, () => (window.game.interactions.actorFor('interior_npc_npc_kunle').pose.arms === 'wave' ? true : null), 5);
  const backToEating = await playUntil(page, () => {
    const g = window.game;
    return !g.player.actor.sequence && g.player.actor.pose.arms === 'eat' && g.player.actor.hold ? true : null;
  }, 6);
  check('the player can wave to another table from their seat, gets a wave back, and goes on eating',
    seatedWave && seatedWave.seated && seatedWave.legs === 'sit' && !!kunleWaved && !!backToEating, { seatedWave, kunleWaved, backToEating });

  await playUntil(page, () => { const o = window.game.world.interiorManager.restaurant.service.order; return o && o.stage === 'eating' && o.bitesLeft <= 4 ? true : null; }, 60);
  await page.click('#buka-order-stop');
  s = await untilSettled(page);
  check('standing up half-way keeps what was paid and eaten, and the table is cleared',
    settled(s) && before.cash - s.cash === 2200 && s.foodBills === 2 && s.hunger > before.hunger, { settled: settled(s), paid: before.cash - s.cash, bills: s.foodBills, hungerGain: +(s.hunger - before.hunger).toFixed(1) });

  // ------------------------------------------------------------------ Waving
  const wave = async (spot, clickSelector) => {
    await closeDialogs(page);
    await page.click(clickSelector);
    await playUntil(page, (id) => (window.game.hud.currentActiveObject?.id === id ? true : null), 20, spot);
    const offered = await page.evaluate(() => getComputedStyle(document.getElementById('card-wave-btn')).display !== 'none');
    await page.click('#card-wave-btn');
    const home = await page.evaluate((id) => window.game.interactions.actorFor(id).homeYaw, spot);
    const seen = { player: false, them: false, facedPlayer: false };
    for (let i = 0; i < 40; i++) {
      const now = await page.evaluate((id) => {
        const g = window.game;
        const them = g.interactions.actorFor(id);
        const here = them.worldPosition();
        const toPlayer = Math.atan2(g.player.position.x - here.x, g.player.position.z - here.z);
        const off = Math.atan2(Math.sin(toPlayer - them.yaw), Math.cos(toPlayer - them.yaw));
        return { player: g.player.actor.pose.arms === 'wave', them: them.pose.arms === 'wave' && them.scripted, facing: Math.abs(off) < 0.2, seated: them.hold !== null };
      }, spot);
      seen.player ||= now.player;
      seen.them ||= now.them;
      seen.facedPlayer ||= now.them && (now.facing || now.seated);
      await advance(page, 0.15);
    }
    await advance(page, 3);
    const after = await page.evaluate((id) => {
      const g = window.game;
      const them = g.interactions.actorFor(id);
      return { playerFree: !g.player.actor.scripted, themDone: !them.sequence, themYaw: them.yaw, themSeated: them.hold !== null, themLegs: them.pose.legs };
    }, spot);
    const backToNormal = after.playerFree && after.themDone && (after.themSeated ? after.themLegs === 'sit' : Math.abs(Math.atan2(Math.sin(after.themYaw - home), Math.cos(after.themYaw - home))) < 0.1);
    return { offered, ...seen, backToNormal };
  };

  let w = await wave('interior_npc_npc_waiter_segun', '#place-card .place-chip[data-spot="interior_npc_npc_waiter_segun"]');
  check('waving at Segun: the player turns and waves, he turns to face them and waves back, then goes back to his post',
    w.offered && w.player && w.them && w.facedPlayer && w.backToNormal, w);
  w = await wave('interior_npc_npc_baba_tunde', '#place-card .place-chip[data-spot="interior_npc_npc_baba_tunde"]');
  check('waving at Baba Tunde: he waves back from his seat and carries on eating', w.offered && w.player && w.them && w.backToNormal, w);

  // ------------------------------------------------------------------ Out through the door, back to the same spot
  await page.click('#place-leave-btn');
  const leaving = await playUntil(page, () => {
    const g = window.game;
    const inner = g.world.interiorManager.restaurant.group.getObjectByName('interior_exit_door').userData.door;
    return inner.openAmount > 0.6 && g.world.interiorManager.currentInterior ? { atDoor: g.player.position.z - 240 > 9 } : null;
  }, 25);
  check('Leave walks the player to the door, which opens for them', leaving && leaving.atDoor, leaving);
  const out = await playUntil(page, () => {
    const g = window.game;
    return !g.world.interiorManager.currentInterior && !g.world.interiorManager.busy && !g.player.actor.sequence ? true : null;
  }, 20);
  const back = await page.evaluate(() => {
    const g = window.game;
    const door = g.world.buildings.placeDoors[0];
    return {
      inside: g.world.interiorManager.isPlayerInside(),
      fromDoor: +Math.hypot(g.player.position.x - door.outside.x, g.player.position.z - door.outside.z).toFixed(2),
      free: !g.player.actor.scripted,
      card: document.getElementById('place-card').style.display,
      status: document.getElementById('buka-order-status').style.display,
    };
  });
  check('they come out on Broad Street at the same door they went in by, in control again',
    out && !back.inside && back.fromDoor < 0.3 && back.free && back.card === 'none' && back.status === 'none', back);
  check('the street door closes behind them', !!(await playUntil(page, () => window.game.world.buildings.placeDoors[0].door.isClosed, 5)));

  // A street character waves back too
  await page.evaluate(() => { const g = window.game; g.player.mesh.position.set(-11.5, 0, 4.5); });
  await advance(page, 0.3);
  const streetWave = await page.evaluate(async () => {
    const g = window.game;
    const obj = g.world.interactiveObjects.find((o) => o.id === 'bet-customer');
    g.hud.showInteractionCard(obj);
    return getComputedStyle(document.getElementById('card-wave-btn')).display !== 'none';
  });
  await page.click('#card-wave-btn');
  const streetReply = await playUntil(page, () => {
    const them = window.game.interactions.actorFor('bet-customer');
    return them.pose.arms === 'wave' && them.scripted ? true : null;
  }, 6);
  await advance(page, 4);
  const streetAfter = await page.evaluate(() => ({ playerFree: !window.game.player.actor.scripted, themFree: !window.game.interactions.actorFor('bet-customer').scripted }));
  check('on the street, waving at Segun the odds expert gets a wave back too', streetWave && streetReply && streetAfter.playerFree && streetAfter.themFree, { streetWave, streetReply, ...streetAfter });

  // ------------------------------------------------------------------ Going back in, and closing the game mid-meal
  // Arriving by the map: the trip ends at the door, and the player walks in through it
  await page.click('#nav-btn-map');
  await wait(1500);
  await page.click('.map-pin[data-place="mama_put_buka"]');
  await wait(500);
  await page.click('#btn-card-go');
  const mapArrival = await playUntil(page, () => {
    const g = window.game;
    const door = g.world.buildings.placeDoors[0];
    return g.player.actor.sequence?.name === 'enter by street door'
      ? { fromDoor: +Math.hypot(g.player.position.x - door.outside.x, g.player.position.z - door.outside.z).toFixed(2) }
      : null;
  }, 5);
  check('a map trip to the buka arrives on the pavement at its door, not somewhere inside the walls', mapArrival && mapArrival.fromDoor < 1, mapArrival);
  const again = await playUntil(page, () => (window.game.world.interiorManager.currentInterior?.type === 'restaurant' && !window.game.world.interiorManager.busy && !window.game.player.actor.sequence ? true : null), 30);
  s = await snapshot(page);
  check('walking back in a second time works and the room is as it should be', again && settled(s) && s.seatsTaken.length === 3, { settled: settled(s), seats: s.seatsTaken.length });

  before = await snapshot(page);
  await orderDish(page, 'suya');
  await playUntil(page, () => { const o = window.game.world.interiorManager.restaurant.service.order; return o && o.stage === 'eating' && o.bitesLeft <= 3 ? true : null; }, 60);
  await page.evaluate(() => window.game.hud.backend.saveData());
  await reload(page);
  const resumed = await page.evaluate(() => {
    const g = window.game;
    const door = g.world.buildings.placeDoors[0];
    const data = g.hud.backend.getData();
    return {
      inside: g.world.interiorManager.isPlayerInside(),
      fromDoor: +Math.hypot(g.player.position.x - door.outside.x, g.player.position.z - door.outside.z).toFixed(2),
      free: !g.player.actor.scripted,
      cash: data.walletCash,
      bills: data.transactionHistory.filter((t) => t.type === 'FOOD_PURCHASE').length,
    };
  });
  check('closing the game mid-meal brings the player back at the buka door, charged once for that meal',
    !resumed.inside && resumed.fromDoor < 1 && resumed.free && before.cash - resumed.cash === 1200 && resumed.bills === before.foodBills + 1, resumed);

  // The plain enter/leave used by other shortcuts (Home, Map) still cleans up a meal in progress
  await enterInterior(page, 'restaurant');
  await orderDish(page, 'jollof_rice');
  await playUntil(page, () => (window.game.player.actor.hold ? true : null), 20);
  await page.evaluate(() => window.game.hud.onNavigateMode('home'));
  await wait(900);
  await advance(page, 0.5);
  const home = await page.evaluate(() => {
    const g = window.game;
    const service = g.world.interiorManager.restaurant.service;
    return { where: g.world.interiorManager.currentInterior?.type, free: !g.player.actor.scripted && !g.player.actor.hold, order: !!service.order, waiterBusy: service.waiter.busy, legs: g.player.actor.pose.legs };
  });
  check('pressing Home from a buka chair takes the player home standing, with the order dropped', home.where === 'residence' && home.free && !home.order && !home.waiterBusy && home.legs === 'stand', home);

  check('buka: no console errors', log.errors.length === 0, log.errors.slice(0, 5));
  await ctx.close();
}
