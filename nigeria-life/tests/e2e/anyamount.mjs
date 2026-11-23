// Typing any amount of money: the cash machine, the bureau de change, offerings, tithes, sadaqah and spraying, up to
// trillions, on a keyboard and at phone width. What cannot be paid is refused, and the money moved is exactly what was typed.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { open, newPlayer, closeDialogs, advance, wait, playUntil, money } from './lib.mjs';

const enter = async (page, key) => {
  await page.evaluate((k) => {
    const g = window.game;
    const card = g.world.interactiveObjects.find((o) => o.id === `roadside-${k}`);
    g.player.stopMoving();
    g.player.mesh.position.set(card.interactionPoint.x, 0, card.interactionPoint.z);
    g.hud.showInteractionCard(card);
    document.getElementById('card-action-btn')?.click();
  }, key);
  await playUntil(page, () => (window.game.world.interiorManager.currentInterior && !window.game.world.interiorManager.isTransitioning ? true : null), 30);
  await advance(page, 0.5);
};
const leave = async (page) => {
  await page.evaluate(() => { const g = window.game; return g.world.interiorManager.exitCurrentInterior(g.player, g.cameraManager, g.hud, g.world); });
  await wait(1000);
};
const station = async (page, id, choice) => {
  await closeDialogs(page);
  await page.evaluate((cid) => {
    const g = window.game;
    const o = g.world.interiorManager.getActiveInteractiveObjects().find((x) => x.id === cid);
    if (!o) throw new Error(`no station ${cid}`);
    g.player.stopMoving();
    g.player.mesh.position.set(o.interactionPoint.x, 0, o.interactionPoint.z);
    g.hud.showInteractionCard(o);
    document.getElementById('card-action-btn')?.click();
  }, id);
  await wait(300);
  await page.evaluate((t) => [...document.querySelectorAll('#game-dialogue-overlay button')].find((b) => b.textContent.includes(t))?.click(), choice);
  await page.waitForSelector('#amount-input', { timeout: 8000 });
};
const typeIn = async (page, text) => {
  await page.evaluate(() => { const i = document.getElementById('amount-input'); i.value = ''; i.dispatchEvent(new Event('input', { bubbles: true })); i.focus(); });
  await page.keyboard.type(text);
  return page.evaluate(() => ({ line: document.getElementById('amount-readout').textContent, ready: !document.querySelector('.amount-go').disabled, button: document.querySelector('.amount-go').textContent }));
};
const submit = async (page) => {
  await page.keyboard.press('Enter');
  await wait(150);
  await playUntil(page, () => (window.game.player.actor.sequence ? null : true), 40);
  await advance(page, 0.4);
};
const setMoney = (page, cash, bank, usd = 0, gbp = 0) => page.evaluate((c, b, u, p) => {
  const be = window.game.hud.backend;
  be.data.walletCash = c; be.data.bank.balance = b; be.data.walletUsd = u; be.data.walletGbp = p;
  be.saveData();
}, cash, bank, usd, gbp);

export async function run(browser, check) {
  const ctx = await newPlayer(browser);
  const { page } = await open(ctx, { w: 1366, h: 768 });
  await closeDialogs(page);
  await page.evaluate(() => window.game.world.skyEnvironment.setHour(10));

  // ------------------------------------------------------------------ The cash machine
  await setMoney(page, 1_000, 5_000_000_000_000);
  await page.evaluate(() => { window.game.hud.atmModal.open(); document.getElementById('atm-any-withdraw').click(); });
  await page.waitForSelector('#amount-input');
  const refused = {};
  for (const bad of ['abc', '0', '1.5', '-500', '6 trillion']) refused[bad] = (await typeIn(page, bad)).ready;
  const before = await page.evaluate(() => { const p = window.game.player.mesh.position; return [p.x, p.z]; });
  const typed = await typeIn(page, '2.5 trillion');
  const after = await page.evaluate(() => { const p = window.game.player.mesh.position; return [p.x, p.z]; });
  check('anyamount: nonsense, zero, part of a naira, a minus and more than the balance are refused, and typing does not walk the player',
    Object.values(refused).every((r) => r === false) && before[0] === after[0] && before[1] === after[1], { refused, before, after });
  await submit(page);
  let m = await money(page);
  check('anyamount: ₦2.5 trillion typed at the cash machine comes out, exactly, and is read back in words first',
    m.cash === 2_500_000_001_000 && m.bank === 2_500_000_000_000 && /2,500,000,000,000/.test(typed.line) && /2\.5 trillion/.test(typed.line), { m, typed });
  await page.evaluate(() => document.getElementById('atm-any-deposit').click());
  await page.waitForSelector('#amount-input');
  await typeIn(page, '3');
  await page.evaluate(() => [...document.querySelectorAll('.amount-shortcuts button')].find((b) => b.textContent === 'Billion').click());
  const shortcut = await page.evaluate(() => document.getElementById('amount-input').value);
  await page.evaluate(() => document.querySelector('[data-all]').click());
  const all = await page.evaluate(() => document.getElementById('amount-input').value);
  await typeIn(page, '1,234,567');
  await submit(page);
  m = await money(page);
  check('anyamount: the Billion and All shortcuts fill in the amount, and a deposit with commas pays in exactly that',
    shortcut === '3000000000' && all === '2500000001000' && m.cash === 2_499_998_766_433 && m.bank === 2_500_001_234_567, { shortcut, all, m });
  await page.evaluate(() => window.game.hud.atmModal.close());

  // ------------------------------------------------------------------ The bureau
  await setMoney(page, 100_000_000, 0);
  await enter(page, 'bureau-fx');
  await station(page, 'place_bureau-fx_buy', 'Buy any amount of dollars');
  const quote = await typeIn(page, '12345');
  await submit(page);
  m = await money(page);
  const bought = m.usd === 12_345 && m.total === 100_000_000 - 12_345 * 1_600;
  await station(page, 'place_bureau-fx_sell', 'Sell any amount of dollars');
  const tooMany = await typeIn(page, '12346');
  await typeIn(page, '2345');
  await submit(page);
  m = await money(page);
  check('anyamount: at the bureau any number of dollars is bought and sold at the day\'s rates, and no more than is in the pocket can be sold',
    bought && /₦19,752,000/.test(quote.line) && !tooMany.ready && m.usd === 10_000 && m.total === 100_000_000 - 12_345 * 1_600 + 2_345 * 1_520, { m, quote, tooMany });
  await station(page, 'place_bureau-fx_buy', 'Buy any amount of pounds');
  await typeIn(page, '777');
  await submit(page);
  m = await money(page);
  check('anyamount: pounds too', m.gbp === 777, m);
  await leave(page);

  // ------------------------------------------------------------------ Spraying dollars on the roof
  await setMoney(page, 1_000, 0, 5_000, 0);
  await page.evaluate(() => window.game.world.skyEnvironment.setHour(21));
  await enter(page, 'ivory-rooftop');
  await station(page, 'place_ivory-rooftop_spray', 'Spray any amount of dollars');
  await typeIn(page, '1234');
  await submit(page);
  m = await money(page);
  check('anyamount: any number of dollars is sprayed at Ivory Rooftop', m.usd === 3_766, m);
  await leave(page);
  await page.evaluate(() => window.game.world.skyEnvironment.setHour(10));

  // ------------------------------------------------------------------ Giving
  await setMoney(page, 10_000_000_000, 0);
  await enter(page, 'faith-arena');
  await station(page, 'place_faith-arena_offering', 'Give any amount');
  await typeIn(page, '1.5b');
  await submit(page);
  m = await money(page);
  const offered = m.total === 8_500_000_000;
  await station(page, 'place_faith-arena_tithe', 'Pay a different amount');
  await typeIn(page, '250000');
  await submit(page);
  m = await money(page);
  check('anyamount: an offering of ₦1.5 billion goes into the basket and a tithe of any amount is recorded', offered && m.total === 8_499_750_000, m);
  await leave(page);
  await enter(page, 'central-mosque');
  await station(page, 'place_central-mosque_sadaqah', 'Give any amount');
  await typeIn(page, '333333');
  await submit(page);
  m = await money(page);
  check('anyamount: sadaqah of any amount goes into the charity box', m.total === 8_499_416_667, m);
  await leave(page);

  // ------------------------------------------------------------------ The club
  await setMoney(page, 50_000_000, 0);
  await page.evaluate(() => window.game.world.skyEnvironment.setHour(22));
  await advance(page, 0.3);
  await page.evaluate(async () => {
    const g = window.game;
    await g.world.interiorManager.enterInterior('club', g.player, g.cameraManager, g.hud, g.world);
  });
  await playUntil(page, () => (window.game.world.interiorManager.currentInterior?.type === 'club' && !window.game.world.interiorManager.isTransitioning ? true : null), 30);
  await page.evaluate(() => {
    const s = window.game.world.interiorManager.club.service;
    s.turnedAway = () => false;
    Object.defineProperty(s, 'hasTable', { configurable: true, get: () => true });
  });
  await station(page, 'club_lounge', 'Spray any amount');
  const tooSmall = await typeIn(page, '500');
  await typeIn(page, '7654321');
  await submit(page);
  m = await money(page);
  check('anyamount: at the club any amount from ₦1,000 is sprayed', !tooSmall.ready && m.total === 42_345_679, { m, tooSmall });
  await page.evaluate(() => { const g = window.game; return g.world.interiorManager.exitCurrentInterior(g.player, g.cameraManager, g.hud, g.world); });
  await wait(800);

  // ------------------------------------------------------------------ Sending money from the phone
  const sent = {};
  await page.evaluate(() => {
    const g = window.game;
    g.network.getOnlinePlayersList = () => [{ id: 'friend', name: 'Friend', isLocal: false }];
    g.network.sendTransfer = (to, amount) => { window.__sent = amount; return { success: true, message: 'Sent' }; };
    const phone = g.hud.phoneModal;
    if (!phone.isOpen) phone.open?.();
    phone.openApp?.('bank', 'send');
  });
  await page.waitForSelector('#bank-amount', { timeout: 8000 });
  for (const [typedAmount, want] of [['2.5m', 2_500_000], ['3 billion', 3_000_000_000], ['12,500', 12_500]]) {
    await page.evaluate(() => { window.__sent = null; if (!document.getElementById('bank-amount')) window.game.hud.phoneModal.openApp?.('bank', 'send'); });
    await page.waitForSelector('#bank-amount', { timeout: 8000 });
    await page.click('#bank-amount', { clickCount: 3 });
    await page.keyboard.type(typedAmount);
    await page.evaluate(() => document.getElementById('bank-send-btn').click());
    await wait(250);
    sent[typedAmount] = (await page.evaluate(() => window.__sent)) === want;
  }
  await page.evaluate(() => window.game.hud.phoneModal.close?.());
  check('anyamount: Send Money reads 2.5m, 3 billion and 12,500 as those amounts', Object.values(sent).length === 3 && Object.values(sent).every(Boolean), sent);

  // ------------------------------------------------------------------ On a small phone
  const phoneCtx = await newPlayer(browser);
  const phonePage = await phoneCtx.newPage();
  await phonePage.emulate({ viewport: { width: 316, height: 640, isMobile: true, hasTouch: true, deviceScaleFactor: 2 }, userAgent: 'Mozilla/5.0 (Linux; Android 13) Mobile' });
  await phonePage.goto(process.env.GAME_URL || 'http://localhost:5173/', { waitUntil: 'load', timeout: 180000 });
  await phonePage.waitForFunction('window.game', { timeout: 180000 });
  await phonePage.waitForFunction(() => !document.getElementById('nl-splash'), { timeout: 240000 });
  await closeDialogs(phonePage);
  await setMoney(phonePage, 1_000, 999_000_000_000_000);
  const fit = await phonePage.evaluate(() => {
    window.game.hud.atmModal.open();
    document.getElementById('atm-any-withdraw').click();
    const input = document.getElementById('amount-input');
    input.value = '999000000000000';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    const parts = ['.amount-card', '#amount-input', '.amount-go', '.amount-cancel', ...[...document.querySelectorAll('.amount-shortcuts button')].map((_, i) => `.amount-shortcuts button:nth-child(${i + 1})`)];
    const over = [];
    for (const sel of parts) {
      const r = document.querySelector(sel).getBoundingClientRect();
      if (r.left < 0 || r.right > innerWidth + 0.5 || r.bottom > innerHeight + 0.5 || r.width < 1) over.push(sel);
    }
    const go = document.querySelector('.amount-go').getBoundingClientRect();
    const top = document.elementFromPoint(go.left + go.width / 2, go.top + go.height / 2);
    return { over, onTop: !!top?.closest('.amount-go'), wide: document.querySelector('.amount-card').scrollWidth <= document.querySelector('.amount-card').clientWidth + 1, ready: !document.querySelector('.amount-go').disabled };
  });
  check('anyamount: at 316 px the sheet fits with ₦999 trillion typed, and its button is the thing under a finger', fit.over.length === 0 && fit.onTop && fit.wide && fit.ready, fit);
  await phonePage.close();

  // ------------------------------------------------------------------ The server's books
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'nl-anyamount-'));
  const { openStore } = await import('../../server/store.ts');
  const { Accounts } = await import('../../server/accounts.ts');
  const { Economy } = await import('../../server/economy.ts');
  const db = openStore(dir);
  const accounts = new Accounts(db, { send: async () => {} }, 'http://localhost', true);
  const id = accounts.createGuest('Trader', '127.0.0.1').account.id;
  const economy = new Economy(db, () => null);
  economy.credit(id, 10_000_000, 'test', 'test money', 'test-money-1');
  const start = economy.wallet(id);
  const paid = economy.report(id, { cash: -1_600_000, memo: 'FX_PURCHASE: Bureau: buy $1,000 @ ₦1,600', idem: 'fx-buy-0001' });
  const sold = economy.report(id, { cash: 1_520_000, memo: 'FX_SALE: Bureau: sell $1,000 @ ₦1,520', idem: 'fx-sell-0001' });
  const again = economy.report(id, { cash: 1_520_000, memo: 'FX_SALE: Bureau: sell $1,000 @ ₦1,520', idem: 'fx-sell-0002' });
  const end = economy.wallet(id);
  db.close?.();
  check('anyamount: the server pays a bureau sale at once while it is within what was paid in there, and holds a sale past that',
    paid.ok && sold.ok && !again.ok && end.cash === start.cash - 80_000, { paid: paid.ok, sold: sold.ok, again: again.ok, reason: again.reason, start, end });
}
