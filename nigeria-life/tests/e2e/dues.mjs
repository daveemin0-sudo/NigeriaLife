// Weekly dues (src/life/Dues.ts): Lapo and bank loans taken a week at a time with late fees, rent
// every Saturday after the first four weeks, a quit notice pinned inside the front door and paid
// from it, eviction a week later, days away settled in order on return, nothing charged twice
// across tabs, and a save from before weekly dues charged nothing for the past.
import { open, newPlayer, closeDialogs, advance, reload, wait, enterInterior, leaveInterior, playUntil } from './lib.mjs';

const state = (page) =>
  page.evaluate(() => {
    const be = window.game.hud.backend;
    const d = be.getData();
    const threads = {};
    for (const [k, t] of Object.entries(d.threads ?? {})) if (k.startsWith('dues:')) threads[k] = t.messages.map((m) => m.text);
    return {
      cash: d.walletCash, bank: d.bank.balance, loan: d.activeLoan ?? null, leases: d.leases ?? {}, duesDay: d.duesDay,
      evicted: d.evicted ?? null, credit: d.credit ?? null, cred: d.stats.streetCred, home: be.hasHome(), threads,
      kinds: d.transactionHistory.slice(-6).map((t) => t.type),
    };
  });
const setMoney = (page, cash, bank) =>
  page.evaluate(([c, b]) => { const be = window.game.hud.backend; be.data.walletCash = c; be.data.bank.balance = b; be.saveData(); }, [cash, bank]);
/** The calendar moved on to this day, and the dues settled up to it: the kinds of what happened */
const goTo = (page, day) =>
  page.evaluate((d) => {
    const g = window.game;
    g.world.skyEnvironment.setDay(d);
    return g.modules.Dues.get().settleTo(d).map((e) => e.kind);
  }, day);
const isSaturday = (day) => new Date(2026, 9, 7 + day).getDay() === 6;
const nextSaturday = (from) => { let d = from; while (!isSaturday(d)) d++; return d; };
const count = (list, kind) => list.filter((k) => k === kind).length;

export async function run(browser, check) {
  const ctx = await newPlayer(browser);
  const { page, log } = await open(ctx, { w: 390, h: 844 });
  await closeDialogs(page);
  // The clock stands still at noon: no midnight passes by itself while this runs
  const today = await page.evaluate(() => { const sky = window.game.world.skyEnvironment; sky.timeScale = 0; sky.setHour(12); return sky.day; });
  let s = await state(page);
  check('dues: a new game starts its weekly dues from today, owing nothing', s.duesDay === today && !s.loan && Object.keys(s.leases).length === 0, { today, duesDay: s.duesDay });

  // ------------------------------------------------------------------ The Lapo loan, week by week
  await page.evaluate(() => window.game.hud.backend.applyOriginDestiny('lapo'));
  s = await state(page);
  check('dues: a Lapo start owes ₦50,000 at ₦7,500 a week, the first a week from today', s.loan?.amount === 50000 && s.loan.weeklyRepayment === 7500 && s.loan.nextDueDay === today + 7, s.loan);
  await setMoney(page, 0, 20000);
  const early = await goTo(page, today + 6);
  s = await state(page);
  check('dues: nothing is taken before the week is up', early.length === 0 && s.bank === 20000 && s.loan.amount === 50000, { early, bank: s.bank });
  const week1 = await goTo(page, today + 7);
  s = await state(page);
  check('dues: a week on, Lapo takes ₦7,500 from the bank and ₦42,500 is left; the next is a week later',
    week1.includes('instalment-paid') && s.bank === 12500 && s.loan.amount === 42500 && s.loan.nextDueDay === today + 14 && s.kinds.includes('LOAN_INSTALMENT'),
    { week1, bank: s.bank, loan: s.loan, kinds: s.kinds });

  await setMoney(page, 0, 0);
  const credBefore = s.cred;
  const week2 = await goTo(page, today + 14);
  s = await state(page);
  check('dues: a week the player cannot pay is missed: a ₦750 late fee is added, street cred drops, and the credit officer texts',
    week2.includes('instalment-missed') && s.loan.amount === 43250 && s.loan.missed === 1 && s.loan.lateFees === 750 && s.loan.nextDueDay === today + 21 && s.cred === Math.max(0, credBefore - 5) && /late fee/.test(s.threads['dues:lapo']?.at(-1) ?? ''),
    { week2, loan: s.loan, cred: [credBefore, s.cred], text: s.threads['dues:lapo'] });

  // In the Bank app: what is owed, when the next is taken, and paying a week
  await page.evaluate(() => { window.game.hud.phoneModal.open(); window.game.hud.phoneModal.openApp('bank'); });
  await wait(700);
  const card = await page.evaluate(() => ({ text: document.getElementById('bank-loan')?.innerText ?? '', week: !!document.getElementById('bank-pay-week'), all: !!document.getElementById('bank-repay-all') }));
  check('dues: the Bank app shows the loan, the ₦7,500 a week, the next date, the missed week, and buttons to pay a week or all of it',
    /43,250/.test(card.text) && /7,500/.test(card.text) && /every week/.test(card.text) && /missed/.test(card.text) && card.week && card.all, card);
  await setMoney(page, 0, 20000);
  await page.evaluate(() => document.getElementById('bank-pay-week')?.click());
  await wait(300);
  s = await state(page);
  const catchUp = { amount: s.loan.amount, missed: s.loan.missed, next: s.loan.nextDueDay };
  await page.evaluate(() => document.getElementById('bank-pay-week')?.click());
  await wait(300);
  s = await state(page);
  check('dues: paying a week after a missed one catches up that week; paying again skips the next one',
    catchUp.amount === 35750 && catchUp.missed === 0 && catchUp.next === today + 21 && s.loan.amount === 28250 && s.loan.nextDueDay === today + 28,
    { catchUp, after: { amount: s.loan.amount, next: s.loan.nextDueDay } });
  await page.evaluate(() => window.game.hud.phoneModal.close());

  // Late fees stop after four on one loan
  await setMoney(page, 0, 0);
  await goTo(page, today + 28 + 7 * 5);
  s = await state(page);
  check('dues: six weeks missed in a row add four late fees at most (₦3,000)', s.loan.lateFees === 3000 && s.loan.missed === 6, { lateFees: s.loan.lateFees, missed: s.loan.missed });
  await setMoney(page, 0, 100000);
  const cleared = await page.evaluate(() => window.game.hud.backend.repayLoan());
  s = await state(page);
  const offerAfterLate = await page.evaluate(() => window.game.modules.Dues.get().bankOffer());
  check('dues: paid off with weeks missed on it, the record does not improve: the bank still offers ₦50,000',
    cleared.success && !s.loan && (s.credit?.cleanLoans ?? 0) === 0 && offerAfterLate.principal === 50000, { cleared, credit: s.credit, offerAfterLate });

  // ------------------------------------------------------------------ Rent, Saturday by Saturday
  let day = today + 63;
  await goTo(page, day);
  const prop = await page.evaluate(() => {
    const be = window.game.hud.backend;
    const p = be.getData().properties.find((x) => x.id === 'prop_mushin_room') ?? be.getData().properties.find((x) => x.rentalPriceMonthly > 0);
    return { id: p.id, name: p.name };
  });
  await setMoney(page, 0, 5_000_000);
  const leased = await page.evaluate((id) => window.game.hud.backend.rentProperty(id), prop.id);
  s = await state(page);
  const weekly = await page.evaluate((id) => window.game.modules.Dues.get().leaseOf(id)?.weekly ?? 0, prop.id);
  check('dues: a new lease is paid four weeks ahead', leased.success && s.leases[prop.id]?.paidUntil === day + 28 && s.leases[prop.id].arrears === 0 && weekly > 0, { leased, lease: s.leases[prop.id], weekly });
  const covered = await goTo(page, day + 27);
  const firstRent = nextSaturday(day + 28);
  const bankBefore = (await state(page)).bank;
  const paidSat = await goTo(page, firstRent);
  s = await state(page);
  check('dues: no rent is taken while the first four weeks run; the first Saturday after, the week\'s rent comes out of the bank',
    count(covered, 'rent-paid') === 0 && count(paidSat, 'rent-paid') === 1 && s.bank === bankBefore - weekly && s.leases[prop.id].paidUntil === firstRent + 7,
    { covered, paidSat, bank: [bankBefore, s.bank], weekly, lease: s.leases[prop.id] });

  // The Houses app says when the next rent is
  await page.evaluate((id) => { window.game.hud.phoneModal.open(); window.game.hud.phoneModal.openApp('property', `p:${id}`); }, prop.id);
  await wait(700);
  const rentCard = await page.evaluate(() => document.getElementById('property-rent')?.innerText ?? '');
  check('dues: the Houses app shows the weekly rent and the next Saturday it is due', /every Saturday/.test(rentCard) && /Next rent on Sat/.test(rentCard), rentCard);
  await page.evaluate(() => window.game.hud.phoneModal.close());

  // A Saturday the rent is not there: a quit notice, and a week to pay
  await setMoney(page, 0, 0);
  const missedSat = firstRent + 7;
  const missed = await goTo(page, missedSat);
  s = await state(page);
  check('dues: a Saturday the rent cannot be paid, the landlord serves a quit notice with a week to pay, and texts it',
    missed.includes('rent-missed') && s.leases[prop.id].arrears === weekly && s.leases[prop.id].noticeDay === missedSat && s.home && /QUIT NOTICE/.test(s.threads['dues:landlord']?.at(-1) ?? ''),
    { missed, lease: s.leases[prop.id], text: s.threads['dues:landlord'] });

  // Pinned inside the front door, and paid from there
  await enterInterior(page, 'residence');
  await wait(600);
  const pinned = await page.evaluate(() => {
    const g = window.game;
    const res = g.world.interiorManager.residence;
    const shown = g.modules.QuitNotice.shown();
    const mesh = res.group.getObjectByName('home_quit_notice');
    return { shown, inGroup: !!mesh, groupVisible: res.group.visible, card: !!res.interactiveList.find((o) => o.id === 'home_quit_notice'), inside: g.world.interiorManager.isPlayerInside() };
  });
  check('dues: inside the home the quit notice is on the wall by the front door, saying what is owed and by when',
    pinned.inside && pinned.inGroup && pinned.groupVisible && pinned.shown?.visible && pinned.shown.owed === weekly && /^Sat/.test(pinned.shown.deadline) && pinned.card, pinned);
  await setMoney(page, 0, 1_000_000);
  await page.evaluate(() => {
    const g = window.game;
    const card = g.world.interiorManager.residence.interactiveList.find((o) => o.id === 'home_quit_notice');
    g.hud.showInteractionCard(card);
    document.getElementById('card-action-btn')?.click();
  });
  const asked = await playUntil(page, () => [...document.querySelectorAll('#game-dialogue-overlay button')].some((b) => /Send him/.test(b.textContent)) || null, 20);
  await page.evaluate(() => [...document.querySelectorAll('#game-dialogue-overlay button')].find((b) => /Send him/.test(b.textContent))?.click());
  await wait(400);
  s = await state(page);
  const down = await page.evaluate(() => window.game.modules.QuitNotice.shown());
  check('dues: walking up to the notice and paying from it clears what is owed and takes the notice down',
    !!asked && s.leases[prop.id].arrears === 0 && s.leases[prop.id].noticeDay === undefined && down === null && s.bank === 1_000_000 - weekly,
    { asked, lease: s.leases[prop.id], down, bank: s.bank });
  await closeDialogs(page);

  // Not paid within the week: put out, at home or not
  await setMoney(page, 0, 0);
  const second = firstRent + 14;
  await goTo(page, second);
  const servedWhileHome = await page.evaluate(() => window.game.modules.QuitNotice.shown());
  const out = await goTo(page, second + 7);
  await wait(1500);
  s = await state(page);
  const after = await page.evaluate((id) => {
    const g = window.game;
    const d = g.hud.backend.getData();
    const p = d.properties.find((x) => x.id === id);
    return { status: p.status, key: d.inventory.some((i) => i.id === `key_${id}`), inside: g.world.interiorManager.isPlayerInside(), dialogue: document.getElementById('game-dialogue-overlay')?.innerText ?? '' };
  }, prop.id);
  check('dues: a notice served while the player is at home goes up on the wall at once', servedWhileHome?.visible === true, servedWhileHome);
  check('dues: a week after the notice, still unpaid, the player is put out: the lease ends, the key is taken, they are on the street and told why',
    out.includes('evicted') && after.status === 'available' && !after.key && !after.inside && !s.home && s.evicted?.propId === prop.id && /locks/.test(after.dialogue) && /locks/.test(s.threads['dues:landlord']?.at(-1) ?? ''),
    { out, after, evicted: s.evicted });
  await closeDialogs(page);
  await page.evaluate(() => document.getElementById('nav-btn-home')?.click());
  await wait(500);
  const locked = await page.evaluate(() => ({ dialogue: document.getElementById('game-dialogue-overlay')?.innerText ?? '', inside: window.game.world.interiorManager.isPlayerInside() }));
  check('dues: going home afterwards, the landlord says the locks were changed', /locks/.test(locked.dialogue) && !locked.inside, locked);
  await closeDialogs(page);

  // ------------------------------------------------------------------ Away for weeks: settled in order on return
  day = second + 8;
  await goTo(page, day);
  await setMoney(page, 0, 5_000_000);
  const both = await page.evaluate((id) => {
    const be = window.game.hud.backend;
    return { lease: be.rentProperty(id).success, loan: be.takeLoan('Eko Commercial Bank', 50000, 55000).success };
  }, prop.id);
  const away = await goTo(page, day + 42);
  s = await state(page);
  let saturdays = 0;
  for (let d = day + 28; d <= day + 42; d++) if (isSaturday(d)) saturdays++;
  check('dues: six weeks away are settled on return, in order: six instalments, and rent for each Saturday after the first four weeks',
    both.lease && both.loan && count(away, 'instalment-paid') === 6 && count(away, 'rent-paid') === saturdays && s.loan.amount === 55000 - 6 * 6875,
    { both, away, saturdays, loan: s.loan });

  // Reloaded, nothing is lost and nothing is charged again
  const before = await state(page);
  await reload(page);
  await closeDialogs(page);
  await page.evaluate((d) => { const sky = window.game.world.skyEnvironment; sky.timeScale = 0; sky.setDay(d); }, day + 42);
  const reloaded = await state(page);
  const again = await goTo(page, day + 42);
  check('dues: a reload keeps the lease, the loan and the day settled, and settling the same day again takes nothing',
    reloaded.duesDay === before.duesDay && reloaded.loan?.amount === before.loan.amount && reloaded.loan.nextDueDay === before.loan.nextDueDay && reloaded.leases[prop.id]?.paidUntil === before.leases[prop.id].paidUntil && again.length === 0 && reloaded.bank === before.bank,
    { before: { duesDay: before.duesDay, loan: before.loan }, reloaded: { duesDay: reloaded.duesDay, loan: reloaded.loan }, again });

  // A second tab on the same save does not take the same week again
  const tabB = await ctx.newPage();
  await tabB.goto(page.url(), { waitUntil: 'load' });
  await tabB.waitForFunction('window.game && window.game.modules.Dues', { timeout: 120000 });
  await wait(2000);
  const startTwo = await state(page);
  const nextDue = startTwo.loan.nextDueDay;
  // Both tabs reach the same day at once: storage reaches the other tab a moment late, so each may
  // settle it, but the payment has the same name in both and is kept once
  const settleHere = (p, d) => p.evaluate((day) => {
    const g = window.game;
    g.world.skyEnvironment.timeScale = 0;
    g.world.skyEnvironment.setDay(day);
    const events = g.modules.Dues.get().settleTo(day);
    return { kinds: events.map((e) => e.kind), paid: events.reduce((sum, e) => sum + (e.kind === 'rent-paid' || e.kind === 'instalment-paid' ? e.amount : 0), 0) };
  }, d);
  const [a, b] = await Promise.all([settleHere(page, nextDue), settleHere(tabB, nextDue)]);
  const inA = a.kinds;
  const inB = b.kinds;
  const charged = a.paid;
  await wait(3000);
  const two = await Promise.all([page, tabB].map((p) => p.evaluate((d) => {
    const data = window.game.hud.backend.getData();
    return { bank: data.bank.balance, owed: data.activeLoan?.amount ?? 0, records: data.transactionHistory.filter((t) => t.id.includes(`:${d}_`) && t.id.includes('due:loan')).length };
  }, nextDue)));
  check('dues: two tabs on one save reaching the same week together take it once: same balance in both, one record of it',
    inA.includes('instalment-paid') && two[0].bank === startTwo.bank - charged && two[1].bank === two[0].bank && two[0].owed === startTwo.loan.amount - startTwo.loan.weeklyRepayment && two[1].owed === two[0].owed && two[0].records === 1 && two[1].records === 1,
    { inA, inB, charged, start: { bank: startTwo.bank, owed: startTwo.loan.amount }, two });
  await tabB.close();

  // Cleared without missing a week: the bank lends more
  await setMoney(page, 0, 5_000_000);
  for (let i = 0; i < 3 && (await state(page)).loan; i++) await page.evaluate(() => window.game.modules.Dues.get().payInstalmentNow());
  s = await state(page);
  const offer = await page.evaluate(() => window.game.modules.Dues.get().bankOffer());
  check('dues: a loan cleared without a missed week counts in the player\'s favour: the bank now offers ₦150,000', !s.loan && s.credit?.cleanLoans === 1 && offer.principal === 150000, { loan: s.loan, credit: s.credit, offer });

  // ------------------------------------------------------------------ A save from before weekly dues
  const migrated = await page.evaluate((id) => {
    const g = window.game;
    const be = g.hud.backend;
    const raw = JSON.parse(JSON.stringify(be.getData()));
    raw.schemaVersion = 3;
    delete raw.duesDay;
    delete raw.leases;
    delete raw.credit;
    raw.activeLoan = { lender: 'Lapo Microfinance Bank', amount: 20000, weeklyRepayment: 7500 };
    const p = raw.properties.find((x) => x.id === id);
    p.status = 'rented';
    p.ownerId = raw.id;
    raw.activeHousingId = id;
    raw.bank.balance = 80000;
    raw.walletCash = 0;
    be.replaceAccount(raw);
    const day = g.world.skyEnvironment.day;
    const events = g.modules.Dues.get().settleTo(day + 3).map((e) => e.kind);
    const d = be.getData();
    return { day, events, bank: d.bank.balance, duesDay: d.duesDay, version: d.schemaVersion, lease: d.leases?.[id], loan: d.activeLoan };
  }, prop.id);
  check('dues: a save from before weekly dues is charged nothing for the past: its lease is due on the coming Saturday and its loan a week on',
    migrated.version === 4 && migrated.events.length === 0 && migrated.bank === 80000 && migrated.duesDay === migrated.day + 3 && migrated.lease?.paidUntil === migrated.day + 4 && migrated.loan?.nextDueDay === migrated.day + 10,
    migrated);

  check('dues: no errors', log.errors.length === 0, log.errors.slice(0, 5));
  void advance;
  void leaveInterior;
  await ctx.close();
}
