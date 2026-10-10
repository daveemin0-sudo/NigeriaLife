// The same walk-up, face, do-it, effect-part-way pattern, used for more than restaurants:
// a street seller handing something over, a cash machine, a bank desk, a car door.
import { open, wait, newPlayer, enterInterior, leaveInterior, advance, playUntil, closeDialogs, useStation } from './lib.mjs';

const state = (page) => page.evaluate(() => {
  const g = window.game;
  const d = g.hud.backend.getData();
  const hawker = g.interactions.actorFor('npc-hawker');
  const at = hawker.worldPosition();
  return {
    cash: d.walletCash,
    bank: d.bank.balance,
    ledger: d.transactionHistory.length,
    gala: d.inventory.find((i) => i.id === 'gala_snack')?.quantity ?? 0,
    water: d.inventory.find((i) => i.id === 'water_sachet')?.quantity ?? 0,
    me: { scripted: g.player.actor.scripted, doing: g.player.actor.sequence?.name ?? null, arms: g.player.actor.pose.arms, carrying: g.player.actor.carried?.name ?? null },
    hawker: { scripted: hawker.scripted, doing: hawker.sequence?.name ?? null, arms: hawker.pose.arms, carrying: hawker.carried?.name ?? null, z: +at.z.toFixed(2) },
    apart: +Math.hypot(g.player.position.x - at.x, g.player.position.z - at.z).toFixed(2),
  };
});

const setCash = (page, amount) => page.evaluate((target) => {
  const be = window.game.hud.backend;
  const cash = be.getData().walletCash;
  if (cash > target) be.depositToBank(cash - target);
  else if (cash < target) be.withdrawFromATM(target - cash);
  return be.getData().walletCash;
}, amount);

/** Stands the player near the hawker and opens his list, the way clicking him and pressing the button does. */
const openHawker = async (page) => {
  await closeDialogs(page);
  await page.evaluate(() => {
    const g = window.game;
    const at = g.interactions.actorFor('npc-hawker').worldPosition();
    g.player.mesh.position.set(at.x + 3, 0, at.z + 1.5);
    g.hud.showInteractionCard(g.world.interactiveObjects.find((o) => o.id === 'npc-hawker'));
  });
  const label = await page.evaluate(() => document.getElementById('card-action-btn').textContent);
  await page.click('#card-action-btn');
  await wait(200);
  return label;
};

export async function run(browser, check) {
  const ctx = await newPlayer(browser);
  const { page, log } = await open(ctx);
  await closeDialogs(page);

  // ------------------------------------------------------------------ A street seller
  const walking = await page.evaluate(async () => {
    const hawker = window.game.interactions.actorFor('npc-hawker');
    const z0 = hawker.worldPosition().z;
    await window.game.advance(1);
    return Math.abs(hawker.worldPosition().z - z0);
  });
  const label = await openHawker(page);
  const list = await page.evaluate(() => ({
    open: window.game.vendorUI.isOpen,
    goods: [...document.querySelectorAll('#vendor-sheet .buka-dish')].map((row) => ({ id: row.dataset.good, price: row.querySelector('.buka-dish-price').textContent })),
  }));
  check('the hawker walks his beat, and his card opens a list of what he is carrying, with prices',
    walking > 0.5 && /Chidi is selling/.test(label) && list.open && list.goods.map((g) => g.id).join() === 'water_sachet,gala_snack' && list.goods[1].price === '₦250', { walking: +walking.toFixed(2), label, list });

  let before = await state(page);
  await page.click('#vendor-sheet .buka-dish[data-good="gala_snack"]');
  await advance(page, 0.2);
  const holding = await playUntil(page, () => {
    const g = window.game;
    const hawker = g.interactions.actorFor('npc-hawker');
    return hawker.carried ? { cash: g.hud.backend.getData().walletCash, apart: Math.hypot(g.player.position.x - hawker.worldPosition().x, g.player.position.z - hawker.worldPosition().z), hawkerArms: hawker.pose.arms } : null;
  }, 15);
  check('picking the sausage roll: the player walks up, the hawker stops, takes one out and holds it out; nothing is paid yet',
    holding && holding.cash === before.cash && holding.apart > 0.8 && holding.apart < 1.4, holding);
  const handed = await playUntil(page, () => (window.game.player.actor.carried?.name === 'vendor_good_gala_snack' ? true : null), 10);
  let s = await state(page);
  check('the player takes it from his hand, and at that moment pays ₦250 once and has one more in the bag',
    handed && before.cash - s.cash === 250 && s.gala === before.gala + 1 && s.ledger === before.ledger + 1 && s.hawker.carrying === null, { paid: before.cash - s.cash, gala: s.gala - before.gala, ledger: s.ledger - before.ledger });
  await playUntil(page, () => { const g = window.game; return !g.player.actor.sequence && !g.interactions.actorFor('npc-hawker').sequence ? true : null; }, 10);
  const z1 = (await state(page)).hawker.z;
  await advance(page, 1.5);
  s = await state(page);
  check('then both carry on: hands empty, the player free, the hawker back on his beat, and no second charge',
    !s.me.scripted && !s.hawker.scripted && s.me.carrying === null && Math.abs(s.hawker.z - z1) > 0.5 && before.cash - s.cash === 250, { hawkerMoved: +Math.abs(s.hawker.z - z1).toFixed(2), paid: before.cash - s.cash });

  // Not enough money: refused before anything starts
  const startCash = s.cash;
  await setCash(page, 100);
  before = await state(page);
  await openHawker(page);
  await page.click('#vendor-sheet .buka-dish[data-good="gala_snack"]');
  await wait(150);
  const refused = await page.evaluate(() => ({ note: document.getElementById('vendor-sheet-note')?.textContent ?? null, open: window.game.vendorUI.isOpen }));
  await advance(page, 1);
  s = await state(page);
  check('without the money the hawker is not even stopped: the list says how much is missing and nothing changes',
    refused.open && /₦150 more/.test(refused.note || '') && s.cash === 100 && s.gala === before.gala && !s.me.scripted && !s.hawker.scripted, { note: refused.note });
  await page.click('#vendor-sheet-close');

  // The money goes between asking and taking: no sale
  await setCash(page, startCash);
  before = await state(page);
  await openHawker(page);
  await page.click('#vendor-sheet .buka-dish[data-good="water_sachet"]');
  await playUntil(page, () => (window.game.interactions.actorFor('npc-hawker').carried ? true : null), 15);
  await setCash(page, 0);
  await playUntil(page, () => { const g = window.game; return !g.player.actor.sequence && !g.interactions.actorFor('npc-hawker').sequence ? true : null; }, 12);
  s = await state(page);
  check('if the cash is gone when the hand reaches for it, he keeps it: no charge, nothing in the bag, nobody left holding it',
    s.cash === 0 && s.water === before.water && s.me.carrying === null && s.hawker.carrying === null && !s.me.scripted && !s.hawker.scripted, { cash: s.cash, water: s.water - before.water });
  await setCash(page, startCash);

  // Walking off before it changes hands
  before = await state(page);
  await openHawker(page);
  await page.click('#vendor-sheet .buka-dish[data-good="water_sachet"]');
  await playUntil(page, () => (window.game.interactions.actorFor('npc-hawker').carried ? true : null), 15);
  await page.keyboard.down('s');
  await advance(page, 0.4);
  await page.keyboard.up('s');
  await advance(page, 1);
  s = await state(page);
  check('walking off while he is holding it out drops the sale: no charge, and he goes back to his beat',
    s.cash === before.cash && s.water === before.water && !s.me.scripted && !s.hawker.scripted && s.hawker.carrying === null, { paid: before.cash - s.cash, hawker: s.hawker });

  // ------------------------------------------------------------------ The cash machine in the bank
  await enterInterior(page, 'bank');
  await advance(page, 0.5);
  await closeDialogs(page);
  await page.click('#place-card .place-chip[data-spot="bank_atm_station"]');
  await playUntil(page, () => (window.game.hud.currentActiveObject?.id === 'bank_atm_station' ? true : null), 20);
  await page.click('#card-action-btn');
  const pressing = await playUntil(page, () => {
    const g = window.game;
    return g.player.actor.pose.arms === 'reach' && g.player.actor.sequence?.name === 'use bank_atm_station'
      ? { modal: document.getElementById('atm-modal').style.display }
      : null;
  }, 6);
  check('using the cash machine: the player reaches for it first, and the screen is not up yet', pressing && pressing.modal === 'none', pressing);
  const screen = await playUntil(page, () => (document.getElementById('atm-modal').style.display === 'flex' ? true : null), 5);
  check('then the machine\'s screen opens', !!screen);
  before = await state(page);
  await page.evaluate(() => document.querySelector('#atm-modal [data-withdraw]').click());
  const taking = await playUntil(page, () => (window.game.player.actor.sequence?.name === 'atm cash' && window.game.player.actor.pose.arms === 'reach' ? true : null), 3);
  s = await state(page);
  check('a withdrawal moves the money from bank to wallet once, and the player is seen taking the notes',
    taking && s.cash > before.cash && before.bank - s.bank === s.cash - before.cash && s.ledger === before.ledger + 1, { toWallet: s.cash - before.cash, fromBank: before.bank - s.bank });
  await page.keyboard.press('Escape');
  await advance(page, 1.5);

  // A desk with someone behind it
  before = await state(page);
  await closeDialogs(page);
  await page.click('#place-card .place-chip[data-spot="bank_teller_station"]');
  await playUntil(page, () => (window.game.hud.currentActiveObject?.id === 'bank_teller_station' ? true : null), 20);
  await page.click('#card-action-btn');
  const talking = await playUntil(page, () => {
    const g = window.game;
    return g.player.actor.pose.arms === 'talk' && g.player.actor.sequence?.name === 'use bank_teller_station'
      ? { cash: g.hud.backend.getData().walletCash, dialogue: !!document.getElementById('game-dialogue-overlay') }
      : null;
  }, 6);
  check('at the teller, the player is seen speaking to her before anything is paid out', talking && talking.cash === before.cash && !talking.dialogue, talking);
  await playUntil(page, () => (document.getElementById('game-dialogue-overlay') ? true : null), 5);
  s = await state(page);
  check('and the remittance is then paid over the counter, once', s.cash - before.cash === 25000 && s.ledger === before.ledger + 1, { paid: s.cash - before.cash });
  await closeDialogs(page);
  // Asking again straight away is acted out too, and pays nothing
  const again = await useStation(page, 'bank_teller_station');
  s = await state(page);
  check('asking again is acted out as well and pays nothing more', again.ok && s.cash - before.cash === 25000, { paid: s.cash - before.cash });
  await closeDialogs(page);
  await leaveInterior(page);

  // ------------------------------------------------------------------ Getting into a vehicle
  const car = await page.evaluate(() => {
    const g = window.game;
    const v = g.world.vehicles.getNearestDrivableVehicle(g.player.position, 1e9);
    const door = { x: v.mesh.position.x + Math.cos(v.mesh.rotation.y) * -2.2, z: v.mesh.position.z - Math.sin(v.mesh.rotation.y) * -2.2 };
    g.player.mesh.position.set(v.mesh.position.x + 3.5, 0, v.mesh.position.z + 3);
    return { door, id: v.id };
  });
  await advance(page, 0.3);
  await page.keyboard.press('f');
  const walkingToDoor = await playUntil(page, () => {
    const g = window.game;
    return g.player.actor.sequence?.name === 'get in vehicle' ? { driving: g.player.isDriving, visible: g.player.mesh.visible } : null;
  }, 3);
  check('pressing F beside a vehicle does not put the player in the seat at once: they walk to the driver\'s door', walkingToDoor && !walkingToDoor.driving && walkingToDoor.visible, walkingToDoor);
  const atDoor = await playUntil(page, (door) => {
    const g = window.game;
    return g.player.actor.pose.arms === 'reach' && !g.player.isDriving ? { fromDoor: +Math.hypot(g.player.position.x - door.x, g.player.position.z - door.z).toFixed(2) } : null;
  }, 8, car.door);
  check('they reach for the door at the driver\'s side', atDoor && atDoor.fromDoor < 0.4, atDoor);
  const driving = await playUntil(page, () => (window.game.player.isDriving ? true : null), 4);
  const seat = await page.evaluate(() => ({ driving: window.game.player.isDriving, scripted: window.game.player.actor.scripted, hud: document.getElementById('driving-hud').style.display }));
  check('and are then at the wheel, with the driving controls', driving && seat.driving && !seat.scripted && seat.hud === 'flex', seat);
  await page.keyboard.press('f');
  await advance(page, 0.5);
  const out = await page.evaluate(() => ({ driving: window.game.player.isDriving, visible: window.game.player.mesh.visible, free: !window.game.player.actor.scripted }));
  check('pressing F again gets them out, standing beside it', !out.driving && out.visible && out.free, out);

  check('actions: no console errors', log.errors.length === 0, log.errors.slice(0, 5));
  await ctx.close();
}
