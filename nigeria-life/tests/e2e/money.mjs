// Money can only be earned, never conjured: every former free-money hole stays closed.
import { open, wait, money, newPlayer, enterInterior, leaveInterior, closeDialogs, useStation } from './lib.mjs';

export async function run(browser, check) {
  const ctx = await newPlayer(browser);
  const { page, log } = await open(ctx);
  const backend = (fn, ...args) => page.evaluate(({ fn, args }) => window.game.hud.backend[fn](...args), { fn, args });
  const setEnergy = (value) => page.evaluate((v) => { window.game.hud.backend.data.stats.energy = v; }, value);

  let m0 = await money(page);
  const negative = await backend('spendCash', -50000);
  const nan = await backend('addCash', NaN);
  const negativeAdd = await backend('addCash', -5);
  const infinite = await backend('spendCash', Infinity);
  let m1 = await money(page);
  check('negative, NaN and infinite amounts are rejected', !negative && !nan && !negativeAdd && !infinite && m1.total === m0.total, { delta: m1.total - m0.total });

  // --- Bank branch
  await enterInterior(page, 'bank');
  m0 = await money(page);
  for (let i = 0; i < 3; i++) {
    await useStation(page, 'bank_atm_station');
    await page.evaluate(() => window.game.hud.atmModal.close());
    await wait(150);
  }
  m1 = await money(page);
  check('bank ATM pressed 3 times creates no money', m1.total === m0.total, { delta: m1.total - m0.total });
  await useStation(page, 'bank_atm_station');
  check('bank ATM opens the real withdraw/deposit screen', await page.evaluate(() => window.game.hud.atmModal.isOpen));
  await page.evaluate(() => window.game.hud.atmModal.close());

  m0 = await money(page);
  await useStation(page, 'bank_teller_station');
  await closeDialogs(page);
  const afterFirst = await money(page);
  await useStation(page, 'bank_teller_station');
  await closeDialogs(page);
  await useStation(page, 'bank_teller_station');
  await closeDialogs(page);
  const afterThird = await money(page);
  check('teller remittance pays ₦25,000 once, not on every press', afterFirst.total - m0.total === 25000 && afterThird.total === afterFirst.total, { first: afterFirst.total - m0.total, afterThree: afterThird.total - m0.total });

  m0 = await money(page);
  await useStation(page, 'bank_manager_desk');
  await closeDialogs(page);
  const borrowed = await money(page);
  const loan = await page.evaluate(() => window.game.hud.backend.getData().activeLoan);
  check('loan desk lends ₦50,000 and records a ₦55,000 debt', borrowed.total - m0.total === 50000 && loan && loan.amount === 55000, { got: borrowed.total - m0.total, loan });
  await useStation(page, 'bank_manager_desk');
  await closeDialogs(page);
  const repaid = await money(page);
  const loanAfter = await page.evaluate(() => window.game.hud.backend.getData().activeLoan || null);
  check('a second visit repays the loan with interest (net -₦5,000) instead of paying out again', repaid.total - m0.total === -5000 && loanAfter === null, { net: repaid.total - m0.total, loanAfter });
  await leaveInterior(page);

  // --- Daily gem hunt badge
  m0 = await money(page);
  for (let i = 0; i < 3; i++) {
    await page.evaluate(() => document.getElementById('badge-gem-hunt')?.click());
    await wait(200);
    await closeDialogs(page);
  }
  m1 = await money(page);
  check('gem hunt pays once per day, not per click', m1.total - m0.total === 3000, { delta: m1.total - m0.total });

  // --- Hustles that used to pay for nothing now cost energy
  await setEnergy(10);
  m0 = await money(page);
  const tired = await useStation(page, 'ajah-estate', false);
  await closeDialogs(page);
  m1 = await money(page);
  check('site labour is refused when exhausted', tired.ok && m1.total === m0.total, { tired, delta: m1.total - m0.total });
  await setEnergy(100);
  await useStation(page, 'ajah-estate', false);
  await closeDialogs(page);
  const m2 = await money(page);
  const energy = await page.evaluate(() => window.game.hud.backend.getData().stats.energy);
  check('site labour pays ₦8,500, costs 25 energy and is recorded', m2.cash - m1.cash === 8500 && energy <= 75.5 && m2.ledger > m1.ledger, { paid: m2.cash - m1.cash, energy });
  for (let i = 0; i < 4; i++) {
    await useStation(page, 'ajah-estate', false);
    await closeDialogs(page);
  }
  const paidShifts = ((await money(page)).cash - m1.cash) / 8500;
  check('it cannot be repeated indefinitely: 5 attempts on a full bar pay for at most 4', paidShifts >= 3 && paidShifts <= 4, { paidShifts });
  await setEnergy(100);

  // --- Furniture with a short wallet: wallet + bank must drop by exactly the price
  const item = await page.evaluate(async () => {
    const mod = await import('/src/housing/HouseDecorationSystem.ts');
    const be = window.game.hud.backend;
    be.depositToBank(be.getData().walletCash - 20000); // leave ₦20,000 in the wallet
    const pick = mod.CATALOGUE_ITEMS.find((i) => i.price > 20000);
    return { id: pick.id, price: pick.price };
  });
  m0 = await money(page);
  await page.evaluate(async (id) => { const mod = await import('/src/housing/HouseDecorationSystem.ts'); mod.HouseDecorationSystem.getInstance().purchaseAndPlace(id); }, item.id);
  await wait(300);
  m1 = await money(page);
  check(`furniture (₦${item.price.toLocaleString()}) bought with a short wallet charges the full price`, m0.total - m1.total === item.price && m1.cash >= 0 && m1.bank >= 0, { charged: m0.total - m1.total, wallet: m1.cash, bank: m1.bank });

  // --- Transfer to someone who is not there
  m0 = await money(page);
  const sent = await page.evaluate(() => window.game.network.sendP2PTransfer('naija_nobody', 5000, 'test'));
  m1 = await money(page);
  check('transfer to an unknown player is refused and not debited', sent.success === false && m1.total === m0.total, { sent, delta: m1.total - m0.total });

  const ledger = await page.evaluate(() => {
    const history = window.game.hud.backend.getData().transactionHistory;
    return { types: [...new Set(history.map((t) => t.type))], bad: history.filter((t) => !(t.amount > 0) || !Number.isFinite(t.amount)).length };
  });
  check('every balance change above is in the ledger, with positive finite amounts',
    ledger.bad === 0 && ['LOAN_DISBURSEMENT', 'LOAN_REPAYMENT', 'BONUS', 'JOB_SALARY', 'ATM_DEPOSIT', 'SHOP_PURCHASE'].every((t) => ledger.types.includes(t)), ledger);

  // --- Origin destiny (sets the starting balances) can be picked once
  const first = await backend('applyOriginDestiny', 'lapo');
  const afterPick = await money(page);
  const second = await backend('applyOriginDestiny', 'nepo');
  const afterSecond = await money(page);
  check('origin destiny applies once; a second pick is refused and changes nothing', first.applied === true && second.applied === false && afterSecond.total === afterPick.total, { first: first.applied, second: second.applied });

  check('money: no console errors', log.errors.length === 0, log.errors.slice(0, 5));
  await ctx.close();
}
