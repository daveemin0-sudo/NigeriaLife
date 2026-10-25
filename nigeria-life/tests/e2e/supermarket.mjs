// A supermarket to run: before it is sold a shopper takes things off its full shelves and pays;
// bought, it is empty, and the owner orders stock to the stockroom, lays out the shelves and
// carries the cartons out; customers buy from what is on the shelves; shelf stackers keep them
// filled; and the day's report counts the stock bought.
import { open, newPlayer, closeDialogs, advance, wait, playUntil, money } from './lib.mjs';

const enter = async (page) => {
  await page.evaluate(() => {
    const g = window.game;
    const card = g.world.interactiveObjects.find((o) => o.id === 'roadside-naija-fresh');
    g.player.stopMoving();
    g.player.mesh.position.set(card.interactionPoint.x, 0, card.interactionPoint.z);
    g.hud.showInteractionCard(card);
    document.getElementById('card-action-btn')?.click();
  });
  return playUntil(page, () => (window.game.world.interiorManager.currentInterior && !window.game.world.interiorManager.isTransitioning ? window.game.world.interiorManager.currentInterior.name : null), 20);
};
const use = async (page, id) => {
  const label = await page.evaluate((key) => {
    const g = window.game;
    document.getElementById('game-dialogue-overlay')?.remove();
    const o = g.world.interiorManager.getActiveInteractiveObjects().find((x) => x.id === key);
    if (!o) return null;
    g.player.stopMoving();
    g.player.mesh.position.set(o.interactionPoint.x, 0, o.interactionPoint.z);
    g.hud.showInteractionCard(o);
    return document.getElementById('card-action-btn')?.textContent ?? '';
  }, id);
  await page.evaluate(() => document.getElementById('card-action-btn')?.click());
  await wait(300);
  return label;
};
const choose = async (page, text) => { await page.evaluate((t) => [...document.querySelectorAll('#game-dialogue-overlay button')].find((b) => b.textContent.includes(t))?.click(), text); await wait(300); };
const idle = (page, seconds = 30) => playUntil(page, () => (window.game.player.actor.sequence ? null : true), seconds);
const state = (page) => page.evaluate(() => {
  const s = window.game.supermarket;
  return { bays: s.bays().map((b) => ({ ...b })), back: Object.fromEntries(['drinks', 'noodles'].map((k) => [k, s.inBack(k)])), owned: s.owned() };
});
const goods = (page) => page.evaluate(() => {
  const room = window.game.world.interiorManager.currentInterior ? window.game.scene.getObjectByName('supermarket goods') : null;
  if (!room) return -1;
  let n = 0;
  room.traverse((o) => { if (o.isMesh) n += o.geometry.attributes.position.count; });
  return n;
});

export async function run(browser, check) {
  const ctx = await newPlayer(browser);
  const { page, log } = await open(ctx);
  await closeDialogs(page);
  await page.evaluate(() => { const b = window.game.hud.backend; b.data.walletCash += 60_000; b.saveData(); window.game.world.skyEnvironment.setHour(11); });

  // ------------------------------------------------------------------ Somebody else's shop, full
  const name = await enter(page);
  const full = await goods(page);
  const label = await use(page, 'supermarket_bay_0');
  await idle(page);
  const bag = await page.evaluate(() => window.game.hud.backend.getData().inventory.some((i) => i.id === 'nf_drinks'));
  const desk = await use(page, 'supermarket_desk');
  const sale = await page.evaluate(() => document.getElementById('game-dialogue-overlay')?.innerText ?? '');
  check('supermarket: Naija Fresh on Ikorodu Road is gone into; before it is sold its shelves are full, a can is taken off the shelf and paid for, and the office says it is for sale',
    name === 'Naija Fresh Supermarket' && full > 1000 && /take one \(₦800\)/.test(label ?? '') && bag && /for sale/.test(desk ?? '') && /₦20,000,000/.test(sale), { name, full, label, bag, desk });
  await closeDialogs(page);

  // ------------------------------------------------------------------ Bought: empty, the owner's to stock
  await page.evaluate(() => { const b = window.game.hud.backend; b.data.bank.balance += 40_000_000; b.saveData(); b.buyBusiness('biz_supermarket'); });
  await advance(page, 0.3);
  let s = await state(page);
  const empty = await goods(page);
  check('supermarket: bought, it is the owner\'s and its shelves are bare', s.owned && s.bays.every((b) => !b.line && b.units === 0) && empty < full / 4, { owned: s.owned, empty });

  // ------------------------------------------------------------------ Stock ordered at the desk
  const m0 = await money(page);
  await use(page, 'supermarket_desk');
  await choose(page, 'Soft drinks');
  await choose(page, '4 cartons');
  await idle(page);
  const m1 = await money(page);
  s = await state(page);
  const piles = await page.evaluate(() => { const b = window.game.scene.getObjectByName('supermarket stockroom'); let n = 0; b?.traverse((o) => { if (o.isMesh) n += o.geometry.attributes.position.count; }); return n; });
  check('supermarket: four packs of drinks ordered from the wholesaler (₦57,600) are stacked in the stockroom', m0.total - m1.total === 57_600 && s.back.drinks === 96 && piles > 200, { paid: m0.total - m1.total, back: s.back, piles });

  // ------------------------------------------------------------------ Laid out, and a carton carried out
  const bare = await use(page, 'supermarket_bay_0');
  await choose(page, 'Soft drinks');
  let carried = false;
  for (let i = 0; i < 80 && !carried; i++) { await advance(page, 0.1); carried = await page.evaluate(() => !!window.game.player.actor.carried); }
  await idle(page);
  s = await state(page);
  const stocked = await goods(page);
  const labelNow = await page.evaluate(() => { const o = window.game.world.interiorManager.getActiveInteractiveObjects().find((x) => x.id === 'supermarket_bay_0'); window.game.hud.showInteractionCard(o); return document.getElementById('card-action-btn')?.textContent ?? ''; });
  check('supermarket: the owner gives shelf 1 (by the tills) to drinks and carries a carton out from the stockroom in their arms: the shelf fills, and says so',
    /choose what goes here/.test(bare ?? '') && carried && s.bays[0].line === 'drinks' && s.bays[0].units === 24 && s.back.drinks === 72 && stocked > empty && /1 of 8 cartons/.test(labelNow), { bare, carried, bay: s.bays[0], back: s.back, labelNow });
  await page.evaluate(() => window.game.hud.hideInteractionCard());

  // A second carton, from the shelf's own menu
  await use(page, 'supermarket_bay_0');
  await choose(page, 'Carry a carton out');
  await idle(page);
  s = await state(page);
  check('supermarket: another carton from the shelf\'s own menu: two of eight', s.bays[0].units === 48, s.bays[0]);

  // ------------------------------------------------------------------ Customers buy what is on the shelves
  const before = await page.evaluate(() => window.game.hud.backend.getData().businesses.find((b) => b.id === 'biz_supermarket').pendingRevenue);
  await page.evaluate(() => { const b = window.game.hud.backend; b.data.lastRevenueAt = Date.now() - 45000; b.saveData(); b.accrueBusinessRevenue(); });
  const after = await page.evaluate(() => window.game.hud.backend.getData().businesses.find((b) => b.id === 'biz_supermarket').pendingRevenue);
  s = await state(page);
  const boost = await page.evaluate(() => window.game.hud.backend.constructor.revenueBoost());
  const sold = 48 - s.bays[0].units;
  check('supermarket: in a payout customers buy drinks off the shelf, and the till takes ₦800 a can for what was sold; the empty shelves sell nothing',
    sold > 0 && after - before === Math.round(sold * 800 * boost), { sold, took: after - before });

  // ------------------------------------------------------------------ Shelf stackers keep it filled
  await page.evaluate(() => {
    const g = window.game;
    g.companies.hire('biz_supermarket', 'stacker');
    g.supermarket.order('noodles', 4);
    g.supermarket.layOut(5, 'noodles');
  });
  const stackers = await page.evaluate(() => ({ a: window.game.companies.hire('biz_supermarket', 'stacker').ok, b: window.game.companies.hire('biz_supermarket', 'stacker').ok, c: window.game.companies.hire('biz_supermarket', 'stacker').ok }));
  await page.evaluate(() => { const b = window.game.hud.backend; b.data.lastRevenueAt = Date.now() - 45000; b.saveData(); b.accrueBusinessRevenue(); });
  s = await state(page);
  const inside = await page.evaluate(() => window.game.world.interiorManager.currentInterior ? window.game.scene.getObjectByName('place naija-fresh').children.filter((o) => o.name === 'supermarket stacker').length : -1);
  check('supermarket: three shelf stackers can be taken on (not a fourth), they carry the noodles out to shelf 6 as it sells, and they are seen at work in the shop',
    stackers.a && stackers.b && !stackers.c && s.bays[5].line === 'noodles' && s.back.noodles < 160 && inside === 3, { stackers, bay: s.bays[5], back: s.back, inside });

  // ------------------------------------------------------------------ The day's report counts the stock
  const day = await page.evaluate(() => window.game.world.skyEnvironment.day);
  await page.evaluate((d) => window.game.companies.closeDay(d), day);
  const report = await page.evaluate(() => ({ ...window.game.companies.reports('biz_supermarket')[0] }));
  check('supermarket: the day\'s report counts the stock bought (₦57,600 + ₦44,800) as a cost of the trade', report.stock === 57_600 + 44_800 && report.profit === report.takings - report.wages - report.stock - report.tax, report);

  // ------------------------------------------------------------------ Kept
  await page.reload({ waitUntil: 'load' });
  await page.waitForFunction('window.game && window.game.supermarket', { timeout: 120000 });
  await wait(2500);
  const kept = await state(page);
  check('supermarket: the shelves and the stockroom are kept across a reload', kept.owned && kept.bays[0].line === 'drinks' && kept.bays[5].line === 'noodles' && kept.back.drinks === s.back.drinks, { bays: kept.bays.slice(0, 6), back: kept.back });

  check('supermarket: no errors in the page', log.errors.length === 0, log.errors.slice(0, 5));
  await ctx.close();
}
