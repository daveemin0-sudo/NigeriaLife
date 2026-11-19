// Trade between cities (src/travel/Trade.ts, TradeDesk.ts, the Trade app): away from a shed the
// app shows today's prices in every city; the goods shed at Jibowu Motor Park is walked up to and
// opens the app; goods are bought there and weigh on the player (120 kg at most); sold back in the
// same city they lose (nine tenths); in another city they cannot be sold before they could have got
// there, and then they sell for more; what is carried is kept through a reload.
import { open, newPlayer, closeDialogs, advance, wait, money, reload } from './lib.mjs';

const desk = (page, fn, arg) => page.evaluate(fn, arg);

export async function run(browser, check) {
  const ctx = await newPlayer(browser);
  const { page, log } = await open(ctx, { w: 1280, h: 760 });
  await closeDialogs(page);
  await page.evaluate(() => { const be = window.game.hud.backend; be.data.bank.balance = 2_000_000; be.data.walletCash = 50_000; be.saveData(); window.game.world.skyEnvironment.timeScale = 0; window.game.world.skyEnvironment.setHour(11); });

  // ------------------------------------------------------------------ Away from a shed
  await page.evaluate(() => { window.game.hud.phoneModal.open(); window.game.hud.phoneModal.openApp('trade'); });
  await wait(600);
  const away = await page.evaluate(() => ({ hint: !!document.getElementById('trade-away'), rows: document.querySelectorAll('#trade-prices [data-good]').length, buttons: document.querySelectorAll('#trade-prices [data-act="buy"]').length, text: document.getElementById('trade-prices')?.innerText ?? '' }));
  await page.evaluate(() => window.game.hud.phoneModal.close());
  check('trade: away from a shed the Trade app shows today\'s prices for the eight goods and where each sells best, but nothing can be bought',
    away.hint && away.rows === 8 && away.buttons === 0 && /best price today in/.test(away.text), { ...away, text: away.text.slice(0, 160) });

  // ------------------------------------------------------------------ The goods shed at Jibowu
  await page.evaluate(() => {
    const g = window.game;
    const o = g.world.interactiveObjects.find((x) => x.id === 'jibowu-park-goods');
    g.player.stopMoving();
    g.player.mesh.position.set(o.interactionPoint.x, 0, o.interactionPoint.z);
    g.hud.showInteractionCard(o);
  });
  const label = await page.evaluate(() => document.getElementById('card-action-btn')?.textContent ?? '');
  await page.evaluate(() => document.getElementById('card-action-btn')?.click());
  for (let i = 0; i < 10; i++) {
    await advance(page, 0.5);
    if (await page.evaluate(() => document.querySelectorAll('#trade-prices [data-act="buy"]').length > 0)) break;
  }
  await wait(400);
  const at = await page.evaluate(() => ({ shed: window.game.modules.TradeDesk.get().shedHere(), hero: document.getElementById('trade-hero')?.innerText ?? '', buttons: document.querySelectorAll('#trade-prices [data-act="buy"]').length }));
  check('trade: the goods shed at Jibowu Motor Park is walked up to, the traders spoken to, and the Trade app opens on it with goods to buy',
    /Goods shed: buy and sell/.test(label) && at.shed === 'lagos' && /Jibowu Motor Park goods shed/.test(at.hero) && at.buttons === 8, { label, at });

  const before = await money(page);
  const price = await desk(page, () => window.game.modules.TradeDesk.get().prices('lagos').find((p) => p.good.id === 'ankara').buy);
  await page.evaluate(() => document.querySelector('#trade-prices [data-good="ankara"] [data-act="buy"]')?.click());
  await wait(600);
  const after = await money(page);
  const carrying = await desk(page, () => { const d = window.game.modules.TradeDesk.get(); return { kg: d.kg(), cargo: d.cargo().map((l) => ({ ...l })), shown: document.getElementById('trade-kg')?.textContent }; });
  await page.evaluate(() => window.game.hud.phoneModal.close());
  check('trade: a bale of Ankara bought at the shed costs its Lagos price, and the player now carries 8 kg of it',
    before.total - after.total === price && carrying.kg === 8 && carrying.cargo[0]?.good === 'ankara' && carrying.cargo[0].qty === 1 && /8 of 120 kg/.test(carrying.shown ?? ''), { price, paid: before.total - after.total, carrying });

  const heavy = await desk(page, () => window.game.modules.TradeDesk.get().buy('beans', 3));
  check('trade: three 50 kg bags of beans on top is more than a player can carry (120 kg)', !heavy.ok && /120 kg/.test(heavy.message), heavy);

  // Sold back where it was bought: nine tenths, a loss
  await desk(page, () => window.game.modules.TradeDesk.get().buy('ankara', 1));
  const sameCity = await desk(page, () => window.game.modules.TradeDesk.get().sell('ankara', 1));
  check('trade: sold back at the same shed the goods lose (the shed buys at nine tenths): the profit is in the journey', sameCity.ok && sameCity.profit < 0 && /loss/.test(sameCity.message), sameCity);

  // ------------------------------------------------------------------ Another city
  const abuja = await page.evaluate(async () => {
    const d = window.game.modules.TradeDesk.get();
    // At Utako Motor Park's shed, in Abuja (the journey itself is the coaches suite's)
    d.where = () => ({ city: 'abuja', x: 15, z: 35 });
    const tooSoon = await d.sell('ankara', 1);
    d.cargo()[0].at = Date.now() - 5 * 60_000;
    const price = d.prices('abuja').find((p) => p.good.id === 'ankara').sell;
    const sold = await d.sell('ankara', 1);
    return { tooSoon, sold, price, left: d.cargo().length };
  });
  check('trade: in Abuja the bale cannot be sold before it could have got there; once it has, Utako\'s shed pays more than it cost in Lagos',
    !abuja.tooSoon.ok && /could not have got here yet/.test(abuja.tooSoon.message) && abuja.sold.ok && abuja.sold.profit > 0 && abuja.left === 0, abuja);

  // ------------------------------------------------------------------ Kept
  await page.evaluate(async () => {
    const d = window.game.modules.TradeDesk.get();
    d.where = () => ({ city: 'lagos', x: 92.5, z: -69.6 });
    await d.buy('accessories', 2);
  });
  await reload(page);
  await closeDialogs(page);
  const kept = await desk(page, () => window.game.modules.TradeDesk.get().cargo().map((l) => ({ good: l.good, qty: l.qty })));
  check('trade: what the player carries is kept through a reload', kept.length === 1 && kept[0].good === 'accessories' && kept[0].qty === 2, kept);

  check('trade: no errors', log.errors.length === 0, log.errors.slice(0, 5));
}
