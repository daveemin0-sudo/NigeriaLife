// PAYE and VAT (src/life/Tax.ts): the Nigeria Tax Act 2025's bands, worked out on the month's
// wages so far and taken by the employer before paying; rent relief; the foreman says it as he
// pays; a payslip for each wage and none for a gig; VAT inside shop prices shown on receipts and
// none on basic food, rent or fares; the Tax page in the Bank, drawn; a new month and year; reload.
import { open, newPlayer, closeDialogs, reload, wait, playUntil, money } from './lib.mjs';

const book = (page) => page.evaluate(() => window.game.hud.backend.tax());
const lastTx = (page) => page.evaluate(() => window.game.hud.backend.getData().transactionHistory[0]);
/** This month's tax book set to these figures (wages and PAYE already paid this month) */
const seed = (page, gross, paye, rent = 0) =>
  page.evaluate(([g, p, r]) => {
    const be = window.game.hud.backend;
    const now = be.tax();
    be.data.tax = { ...now, gross: g, paye: p, rent: r };
    be.saveData();
  }, [gross, paye, rent]);

/** Stands at a thing, opens its card and presses its button (as the jobs suite does) */
async function use(page, id) {
  await page.evaluate(async (key) => {
    const g = window.game;
    const o = g.world.interactiveObjects.find((x) => x.id === key);
    document.getElementById('game-dialogue-overlay')?.remove();
    g.hud.hideInteractionCard();
    g.player.stopMoving();
    g.player.mesh.position.set(o.interactionPoint.x, 0, o.interactionPoint.z);
    await g.advance(0.1);
    g.hud.showInteractionCard(o);
  }, id);
  await page.evaluate(() => document.getElementById('card-action-btn')?.click());
  await wait(300);
}

export async function run(browser, check) {
  const ctx = await newPlayer(browser);
  const { page, log } = await open(ctx, { w: 390, h: 844 });
  await closeDialogs(page);
  const today = await page.evaluate(() => { const sky = window.game.world.skyEnvironment; sky.timeScale = 0; sky.setHour(10); return sky.day; });

  // ------------------------------------------------------------------ The law's numbers
  const law = await page.evaluate(() => {
    const T = window.game.modules.Tax;
    const none = { gross: 0, paye: 0, rent: 0 };
    return {
      years: [800_000, 3_000_000, 12_000_000, 25_000_000, 50_000_000, 60_000_000].map((n) => Math.round(T.yearlyPaye(n))),
      bands: T.monthBands().map((b) => [b.from, b.upTo === Infinity ? null : b.upTo, b.rate]),
      a: T.workPayslip(50_000, none),
      b: T.workPayslip(50_000, { gross: 50_000, paye: 0, rent: 0 }),
      one: T.workPayslip(100_000, none),
      relief: [T.monthRelief(100_000), T.monthRelief(10_000_000)],
      vat: {
        shop: T.vatIn('SHOP_PURCHASE', 'Boutique Purchase: Agbada', 10_750),
        buka: T.vatIn('FOOD_PURCHASE', 'Amala and ewedu', 2_000),
        lounge: T.vatIn('FOOD_PURCHASE', 'Spark date with Ada at the Shiro lounge', 21_500),
        rent: T.vatIn('RENT_PAYMENT', 'Saturday rent: Room in Mushin', 10_000),
        shopRent: T.vatIn('RENT_PAYMENT', "A week's rent for the shop at Plot 4", 10_750),
        car: T.vatIn('ASSET_PURCHASE', 'New Toyota Corolla from Ojota Motors', 10_750_000),
        land: T.vatIn('ASSET_PURCHASE', 'Bought Plot 3, Lekki from the state', 10_750_000),
        private: T.vatIn('ASSET_PURCHASE', 'Bought Toyota Camry from Tunde', 10_750_000),
        fare: T.vatIn('TRAVEL_COST', 'Danfo to CMS', 500),
        drugs: T.vatIn('SHOP_PURCHASE', 'Pharmacy: malaria drugs', 5_000),
      },
    };
  });
  check("tax: a year's PAYE is the Nigeria Tax Act 2025's: nothing on ₦800,000, ₦330,000 on ₦3m, ₦1.95m on ₦12m, ₦4.68m on ₦25m, ₦10.43m on ₦50m, 25% above",
    JSON.stringify(law.years) === JSON.stringify([0, 330_000, 1_950_000, 4_680_000, 10_430_000, 12_930_000]), law.years);
  check('tax: a month has a twelfth of each band: the first ₦66,667 free, 15% to ₦250,000, 18% to ₦1m, then 21%, 23%, 25%',
    JSON.stringify(law.bands) === JSON.stringify([[0, 66_667, 0], [66_667, 250_000, 0.15], [250_000, 1_000_000, 0.18], [1_000_000, 2_083_333, 0.21], [2_083_333, 4_166_667, 0.23], [4_166_667, null, 0.25]]), law.bands);
  check('tax: two ₦50,000 wages in a month are taxed as one ₦100,000: nothing on the first, ₦5,000 on the second; rent relief is a fifth of the rent, at most ₦41,667 a month',
    law.a.paye === 0 && law.a.net === 50_000 && law.b.paye === 5_000 && law.one.paye === 5_000 && law.b.monthPaye === 5_000 && law.relief[0] === 20_000 && law.relief[1] === 41_667, { a: law.a, b: law.b, one: law.one, relief: law.relief });
  const v = law.vat;
  check('tax: VAT is the 7.5% inside a shop price (₦750 of ₦10,750), a lounge and a new car; none on buka food, home rent, land, a private sale, fares or medicine; a shop\'s rent carries it',
    v.shop === 750 && v.lounge === 1_500 && v.car === 750_000 && v.shopRent === 750 && v.buka === 0 && v.rent === 0 && v.land === 0 && v.private === 0 && v.fare === 0 && v.drugs === 0, v);

  // ------------------------------------------------------------------ A wage paid here, after PAYE
  await page.evaluate(() => { const g = window.game; g.jobs.apply('apapa-port'); g.hud.backend.restoreEnergy(100); });
  // Earlier this month: ₦300,000 of wages and the ₦36,500 PAYE on them
  await seed(page, 300_000, 36_500);
  const before = await money(page);
  const paid = await page.evaluate(() => {
    const g = window.game;
    const res = g.jobs.complete('apapa-port');
    const expect = g.modules.Tax.workPayslip(res.pay, { gross: 300_000, paye: 36_500, rent: 0 });
    return { res, expect };
  });
  const after = await money(page);
  let b = await book(page);
  let tx = await lastTx(page);
  check('tax: a shift at the port after ₦300,000 this month has PAYE at 18% taken before it is paid: the pocket gets the rest, the receipt and the payslip say so, and the month adds up',
    paid.res.ok && paid.res.slip.paye === paid.expect.paye && paid.expect.paye > 0 && paid.res.slip.rate === 0.18 && after.total - before.total === paid.expect.net
    && tx.type === 'JOB_SALARY' && tx.amount === paid.expect.net && tx.paye === paid.expect.paye
    && b.gross === 300_000 + paid.res.pay && b.paye === 36_500 + paid.expect.paye && b.slips.at(-1).employer && /Lagos State Internal Revenue/.test(b.slips.at(-1).office),
    { paid, gained: after.total - before.total, tx, book: { gross: b.gross, paye: b.paye, slip: b.slips.at(-1) } });

  // ------------------------------------------------------------------ The foreman says it as he pays
  // Just under the free part: this load is the first wage of the month with PAYE on it
  await seed(page, 66_000, 0);
  await page.evaluate(() => window.game.hud.backend.restoreEnergy(100));
  await use(page, 'apapa-port-loading-bay');
  await playUntil(page, () => (window.game.world.landmarks.status()['apapa-port'].bay === 'leaving' ? true : null), 90);
  const told = await page.evaluate(() => [...document.querySelectorAll('body *')].filter((el) => el.children.length === 0 && /The foreman pays you/.test(el.textContent)).map((el) => el.textContent).pop() ?? '');
  let noted = false;
  for (let i = 0; i < 25 && !noted; i++) {
    await wait(200);
    noted = await page.evaluate(() => /was tax-free\. PAYE is now taken at 15%/.test(document.body.innerText));
  }
  b = await book(page);
  check('tax: in the world, the foreman pays the load "after ₦… PAYE", and the first PAYE of the month is explained once (the free part used up, 15% from here)',
    /The foreman pays you ₦[\d,]+ after ₦[\d,]+ PAYE/.test(told) && noted && b.slips.at(-1).paye > 0 && b.slips.at(-1).monthPaye === b.slips.at(-1).paye,
    { told, noted, slip: b.slips.at(-1) });

  // ------------------------------------------------------------------ A career shift is a wage; a gig is cash in hand
  const career = await page.evaluate(() => {
    const be = window.game.hud.backend;
    be.data.activeJobShift = { jobId: 'job_shop_assistant', startTime: Date.now() - 600_000, duration: 10, completed: false };
    be.saveData();
    const slips = be.tax().slips.length;
    const done = be.completeJobShift();
    return { done, slip: be.tax().slips.at(-1), more: be.tax().slips.length - slips };
  });
  const gig = await page.evaluate(() => {
    const be = window.game.hud.backend;
    const was = be.tax();
    const res = be.performGig(12_000, 0, 'Remote Tech Sprint');
    const now = be.tax();
    const h = be.getData().transactionHistory;
    return { res, slips: now.slips.length - was.slips.length, gross: now.gross - was.gross, tx: h[0] };
  });
  check('tax: a Life-app career shift comes with a payslip from its employer and PAYE; a gig is paid whole, with no payslip and nothing on the month\'s wages',
    career.done.success && career.more === 1 && career.slip.employer === 'Balogun Wholesale Market' && career.slip.paye > 0 && /PAYE/.test(career.done.message)
    && gig.res.success && gig.slips === 0 && gig.gross === 0 && gig.tx.amount === 12_000 && !gig.tx.paye,
    { career, gig });

  // ------------------------------------------------------------------ Rent relief and VAT on receipts
  await seed(page, 300_000, 36_500, 0);
  const relief = await page.evaluate(() => {
    const be = window.game.hud.backend;
    be.data.bank.balance = 1_000_000;
    be.data.walletCash = 50_000;
    be.saveData();
    be.processTransaction({ type: 'RENT_PAYMENT', amount: 100_000, description: 'Saturday rent: Room in Mushin', source: 'bank' });
    be.processTransaction({ type: 'RENT_PAYMENT', amount: 5_000, description: 'Home Staff Wage: Cook (Cook)', source: 'bank' });
    const rent = be.tax().rent;
    be.restoreEnergy(100);
    const res = window.game.jobs.complete('apapa-port');
    const T = window.game.modules.Tax;
    return { rent, slip: res.slip, withRelief: T.workPayslip(res.pay, { gross: 300_000, paye: 36_500, rent: 100_000 }), without: T.workPayslip(res.pay, { gross: 300_000, paye: 36_500, rent: 0 }) };
  });
  check('tax: home rent paid this month (not a staff wage) takes a fifth off the taxed wages, so the next payslip has ₦20,000 relief and less PAYE',
    relief.rent === 100_000 && relief.slip.relief === 20_000 && relief.slip.paye === relief.withRelief.paye && relief.slip.paye < relief.without.paye,
    relief);

  const vat = await page.evaluate(() => {
    const be = window.game.hud.backend;
    const was = be.tax().yearVat;
    be.processTransaction({ type: 'SHOP_PURCHASE', amount: 10_750, description: 'Boutique Purchase: Agbada', source: 'wallet' });
    const h = be.getData().transactionHistory;
    const shop = h[0];
    be.processTransaction({ type: 'FOOD_PURCHASE', amount: 2_000, description: 'Amala and ewedu', source: 'wallet' });
    const food = be.getData().transactionHistory[0];
    return { shop, food, added: be.tax().yearVat - was };
  });
  check('tax: a ₦10,750 agbada costs ₦10,750 and its receipt says ₦750 of it was VAT; buka food has none; the year\'s VAT adds it',
    vat.shop.amount === 10_750 && vat.shop.vat === 750 && !vat.food.vat && vat.added === 750, vat);

  // ------------------------------------------------------------------ The Tax page, drawn
  await page.evaluate(() => { document.getElementById('game-dialogue-overlay')?.remove(); window.game.hud.phoneModal.open(); window.game.hud.phoneModal.openApp('bank'); });
  await wait(700);
  const history = await page.evaluate(() => document.getElementById('bank-history')?.innerText ?? '');
  await page.evaluate(() => document.getElementById('bank-tax')?.click());
  await wait(700);
  b = await book(page);
  const screen = await page.evaluate(() => {
    const el = (id) => document.getElementById(id);
    const hero = el('tax-hero')?.getBoundingClientRect();
    const mid = hero ? document.elementFromPoint(hero.x + hero.width / 2, hero.y + hero.height / 2) : null;
    return {
      paye: el('tax-month-paye')?.textContent ?? '',
      bands: el('tax-bands')?.querySelectorAll('[data-band]').length ?? 0,
      current: el('tax-bands')?.querySelector('[aria-current="true"]')?.getAttribute('data-band') ?? null,
      rate: el('tax-rate')?.textContent ?? '',
      relief: el('tax-relief-amount')?.textContent ?? '',
      vat: el('tax-year-vat')?.textContent ?? '',
      slips: el('tax-slips')?.querySelectorAll('[data-slip]').length ?? 0,
      text: el('tax-slips')?.innerText ?? '',
      shown: !!hero && hero.width > 200 && hero.height > 60 && hero.top >= 0 && hero.bottom <= innerHeight && !!mid && el('tax-hero').contains(mid),
    };
  });
  if (process.env.SHOTS) {
    await page.screenshot({ path: `${process.env.SHOTS}/tax_page.png` });
    await page.evaluate(() => document.getElementById('tax-slips')?.scrollIntoView({ block: 'start' }));
    await wait(300);
    await page.screenshot({ path: `${process.env.SHOTS}/tax_page2.png` });
  }
  check('tax: the Bank lists the wage with "PAYE … taken" and the agbada with "incl. VAT ₦750"',
    /PAYE ₦[\d,]+ taken/.test(history) && /incl\. VAT ₦750/.test(history), history.slice(0, 400));
  check('tax: the Tax page shows this month\'s PAYE, the six bands with the 18% one marked, the rent relief, the year\'s VAT and each payslip, and it is on screen',
    screen.paye === `₦${b.paye.toLocaleString()}` && screen.bands === 6 && screen.current === '2' && screen.rate === '18%' && screen.relief === '₦20,000'
    && screen.vat === `₦${b.yearVat.toLocaleString()}` && screen.slips === b.slips.length && /Balogun Wholesale Market/.test(screen.text) && screen.shown,
    { screen, paye: b.paye, slips: b.slips.length, yearVat: b.yearVat });
  await page.evaluate(() => window.game.hud.phoneModal.close());

  // ------------------------------------------------------------------ Kept, and a new month and year
  const kept = await book(page);
  await reload(page);
  await closeDialogs(page);
  const back = await book(page);
  check('tax: a reload keeps the month, the year and the payslips',
    back.month === kept.month && back.gross === kept.gross && back.paye === kept.paye && back.rent === kept.rent && back.yearVat === kept.yearVat && back.slips.length === kept.slips.length, { kept: { ...kept, slips: kept.slips.length }, back: { ...back, slips: back.slips.length } });

  const turn = await page.evaluate((start) => {
    const g = window.game;
    const T = g.modules.Tax;
    const sky = g.world.skyEnvironment;
    sky.timeScale = 0;
    const month = T.monthOfDay(start);
    let d = start;
    while (T.monthOfDay(d) === month) d++;
    sky.setDay(d);
    const nextMonth = g.hud.backend.tax();
    let y = d;
    while (T.monthOfDay(y).slice(0, 4) === month.slice(0, 4)) y++;
    sky.setDay(y);
    const nextYear = g.hud.backend.tax();
    return { month, nextMonth, nextYear };
  }, today);
  check('tax: a new month starts its wages, PAYE and rent from nothing and keeps the year\'s; a new year starts the year\'s too',
    turn.nextMonth.month !== turn.month && turn.nextMonth.gross === 0 && turn.nextMonth.paye === 0 && turn.nextMonth.rent === 0 && turn.nextMonth.yearPaye === back.yearPaye && turn.nextMonth.yearVat === back.yearVat
    && turn.nextYear.year !== back.year && turn.nextYear.yearPaye === 0 && turn.nextYear.yearVat === 0 && turn.nextYear.slips.length === back.slips.length,
    { month: turn.month, nextMonth: { ...turn.nextMonth, slips: undefined }, nextYear: { ...turn.nextYear, slips: undefined } });

  check('tax: no errors', log.errors.length === 0, log.errors.slice(0, 5));
}
