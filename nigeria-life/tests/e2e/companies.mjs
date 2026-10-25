// A business run as a company: people taken on into its roles, seen at work at the shop front,
// lifting the takings; branches opened in other parts of Lagos; and each day closed with a
// report of takings, wages, rent and tax, the takings banked by a manager, and staff walking
// out if they cannot be paid.
import { open, newPlayer, closeDialogs, advance, wait, playUntil, money } from './lib.mjs';

const BIZ = 'biz_mama_put';
const be = (page, fn, arg) => page.evaluate(fn, arg);
const tap = async (page, selector) => { await page.evaluate((s) => document.querySelector(s)?.click(), selector); await wait(350); };
const company = (page, id = BIZ) => page.evaluate((b) => {
  const c = window.game.companies;
  const biz = window.game.hud.backend.getData().businesses.find((x) => x.id === b);
  return { staff: c.staff(b).map((s) => ({ ...s })), outlets: c.outlets(b), lift: c.lift(b), wages: c.wages(b), rent: c.rent(b), reports: c.reports(b).map((r) => ({ ...r })), pending: biz.pendingRevenue, base: biz.baseIncomePerCycle, price: biz.purchasePrice, managed: c.managed(b) };
}, id);
/** One payout comes due now */
const payout = (page) => page.evaluate(() => { const b = window.game.hud.backend; b.data.lastRevenueAt = Date.now() - 45000; b.saveData(); b.accrueBusinessRevenue(); });

export async function run(browser, check) {
  const ctx = await newPlayer(browser);
  const { page, log } = await open(ctx);
  await closeDialogs(page);
  await page.evaluate(() => { const b = window.game.hud.backend; b.data.bank.balance += 30_000_000; b.saveData(); window.game.world.skyEnvironment.setHour(12); });

  // ------------------------------------------------------------------ Bought, at a real price, with real takings
  await page.evaluate((id) => window.game.hud.backend.buyBusiness(id), BIZ);
  let c = await company(page);
  check('companies: Mama Put costs ₦8m and takes about 1.6% of that in a game day (₦9,600 a payout), not its whole price', c.price === 8_000_000 && c.base === 9600, { price: c.price, base: c.base });

  // ------------------------------------------------------------------ Taking people on from the phone
  await page.evaluate((id) => window.game.hud.phoneModal.openApp('business', `b:${id}`), BIZ);
  await wait(500);
  const roles = await page.evaluate(() => [...document.querySelectorAll('#company-roles [data-act="hire"]')].map((b) => b.dataset.arg.split('|')[1]));
  await tap(page, `#company-roles [data-act="hire"][data-arg="${BIZ}|cook"]`);
  await tap(page, `#company-roles [data-act="hire"][data-arg="${BIZ}|server"]`);
  c = await company(page);
  const listed = await page.evaluate(() => document.getElementById('company-staff')?.innerText ?? '');
  const cookFull = await page.evaluate((id) => document.querySelector(`#company-roles [data-act="hire"][data-arg="${id}|cook"]`)?.disabled, BIZ);
  check('companies: the buka\'s roles are cook, server, cashier, cleaner and manager; a cook and a server are taken on by name, on their day\'s wage, and one cook fills the one shop',
    roles.join() === 'cook,server,cashier,cleaner,manager' && c.staff.length === 2 && c.staff.every((s) => listed.includes(s.name)) && c.wages === 8500 && cookFull === true, { roles, staff: c.staff.map((s) => `${s.name} ${s.role} ${s.wage}`), cookFull });
  await closeDialogs(page);

  // ------------------------------------------------------------------ At work at the shop front, and spoken to
  await advance(page, 0.5);
  const front = await page.evaluate(() => {
    const g = window.game;
    const door = g.world.interactiveObjects.find((o) => o.id === 'mama-put').interactionPoint;
    const staff = g.companyStaff.group.children.map((m) => ({ visible: m.visible, away: +Math.hypot(m.position.x - door.x, m.position.z - door.z).toFixed(1) }));
    const cards = g.world.interactiveObjects.filter((o) => o.id.startsWith('staff_')).map((o) => o.id);
    return { staff, cards, shown: g.companyStaff.group.visible && !!g.companyStaff.group.parent };
  });
  check('companies: the two of them stand at Mama Put\'s front while it is open, each one a card to tap', front.shown && front.staff.length === 2 && front.staff.every((s) => s.visible && s.away < 4) && front.cards.length === 2, front);

  const card = front.cards[0];
  await page.evaluate((id) => { const g = window.game; const o = g.world.interactiveObjects.find((x) => x.id === id); g.player.stopMoving(); g.player.mesh.position.set(o.interactionPoint.x, 0, o.interactionPoint.z); g.hud.showInteractionCard(o); document.getElementById('card-action-btn')?.click(); }, card);
  const talk = await playUntil(page, () => document.getElementById('game-dialogue-overlay')?.innerText.match(/Taken so far today/) ? document.getElementById('game-dialogue-overlay').innerText : null, 10);
  check('companies: talking to one of them is acted out, and they say how the day is going', !!talk && /a day, since/.test(talk), (talk ?? '').slice(0, 200));
  await closeDialogs(page);

  // ------------------------------------------------------------------ Their lift on the takings
  const p0 = (await company(page)).pending;
  await payout(page);
  c = await company(page);
  const boost = await page.evaluate(() => window.game.hud.backend.constructor.revenueBoost());
  check('companies: a payout is the shop\'s own takings lifted by its staff (cook +18%, server +8%)', Math.abs(c.lift - 1.26) < 1e-9 && c.pending - p0 === Math.round(9600 * 1.26 * boost), { lift: c.lift, paid: c.pending - p0, expect: Math.round(9600 * 1.26 * boost) });

  // ------------------------------------------------------------------ A manager, and the close of the day
  await page.evaluate((id) => { window.game.companies.hire(id, 'manager'); const b = window.game.hud.backend; b.data.businesses.find((x) => x.id === id).pendingRevenue = 100000; b.data.lastRevenueAt = Date.now(); b.saveData(); }, BIZ);
  c = await company(page);
  const m0 = await money(page);
  const day = await page.evaluate(() => window.game.world.skyEnvironment.day);
  const took = await page.evaluate((id) => window.game.companies.takenToday(id), BIZ);
  await page.evaluate((d) => window.game.companies.closeDay(d), day);
  const m1 = await money(page);
  const after = await company(page);
  const r = after.reports[0];
  const toast = await page.evaluate(() => /📊 Mama Put Special Bukateria, /.test(document.body.innerText));
  check('companies: the day closes with a report (takings, wages ₦23,500, no tax for a small company); the wages come out of the till and the manager banks the rest',
    r && r.day === day && r.takings === took && r.wages === 23500 && r.tax === 0 && r.profit === took - 23500 && after.pending === 0 && r.banked === c.pending - 23500 && m1.total - m0.total === r.banked && toast,
    { r, pendingBefore: c.pending, bank: m1.total - m0.total, toast });

  // ------------------------------------------------------------------ A branch
  await page.evaluate((id) => window.game.hud.phoneModal.openApp('business', `b:${id}`), BIZ);
  await wait(400);
  const b0 = await money(page);
  await tap(page, `#company-branches [data-act="branch"][data-arg="${BIZ}|yaba"]`);
  await page.evaluate(() => [...document.querySelectorAll('button')].find((b) => /^Open it$/.test(b.textContent.trim()))?.click());
  await wait(500);
  const b1 = await money(page);
  c = await company(page);
  const cookAgain = await page.evaluate((id) => document.querySelector(`#company-roles [data-act="hire"][data-arg="${id}|cook"]`)?.disabled, BIZ);
  check('companies: a branch in Yaba costs 60% of the business (₦4.8m), pays rent by the day, and makes room for a second of each role (the staff\'s lift is now spread over two shops)',
    b0.total - b1.total === 4_800_000 && c.outlets === 2 && c.rent === Math.round((4_800_000 * 0.15) / 365) && cookAgain === false && Math.abs(c.lift - 1.18) < 1e-9 && !c.managed,
    { paid: b0.total - b1.total, outlets: c.outlets, rent: c.rent, lift: c.lift, cookAgain });
  await closeDialogs(page);
  const own = await page.evaluate((id) => { const biz = window.game.hud.backend.getData().businesses.find((x) => x.id === id); return biz.baseIncomePerCycle + biz.upgrades.filter((u) => u.purchased).reduce((s, u) => s + u.bonusIncomePerCycle, 0); }, BIZ);
  const per = await page.evaluate(({ id, own }) => window.game.companies.perCycle(window.game.hud.backend.getData().businesses.find((x) => x.id === id), own), { id: BIZ, own });
  check('companies: with the branch, a payout is the first shop plus 90% of it from Yaba, lifted by the staff', per === Math.round((own + 9600 * 0.9) * c.lift), { per, expect: Math.round((own + 9600 * 0.9) * c.lift) });

  // ------------------------------------------------------------------ Letting someone go: a day's pay
  const server = c.staff.find((s) => s.role === 'server');
  const d0 = await money(page);
  const gone = await page.evaluate(({ id, sid }) => window.game.companies.dismiss(id, sid), { id: BIZ, sid: server.id });
  const d1 = await money(page);
  check('companies: someone let go is paid a day\'s wage and leaves the front of the shop', gone.ok && d0.total - d1.total === 3500 && (await company(page)).staff.length === 2 && (await page.evaluate(() => window.game.companies.staff('biz_mama_put').length === window.game.companies.staff('biz_mama_put').length && window.game.world.interactiveObjects.filter((o) => o.id.startsWith('staff_')).length)) === 2, { paid: d0.total - d1.total });

  // ------------------------------------------------------------------ A big company pays tax
  await page.evaluate(() => { const b = window.game.hud.backend; b.data.bank.balance += 500_000_000; b.saveData(); b.buyBusiness('biz_oando'); window.game.companies.hire('biz_oando', 'attendant'); });
  await page.evaluate(() => window.game.companies.took('biz_oando', 6_000_000));
  await page.evaluate((d) => window.game.companies.closeDay(d), day);
  const big = (await company(page, 'biz_oando')).reports[0];
  check('companies: a filling station turning over ₦2bn a year pays company income tax, 30% of the day\'s profit', big && big.tax === Math.round((big.takings - big.wages - big.rent) * 0.3) && big.tax > 0, big);

  // ------------------------------------------------------------------ Nothing to pay them with
  await page.evaluate(() => { const b = window.game.hud.backend; b.data.bank.balance = 0; b.data.walletCash = 0; for (const x of b.data.businesses) x.pendingRevenue = 0; b.saveData(); });
  await page.evaluate((d) => window.game.companies.closeDay(d), day + 1);
  c = await company(page);
  await advance(page, 0.3);
  const fronts = await page.evaluate(() => window.game.world.interactiveObjects.filter((o) => o.id.startsWith('staff_') && o.id.includes('biz_mama_put')).length);
  check('companies: when there is not enough in the till or the bank for the wages, the staff walk out unpaid, the report says so, and they are gone from the shop front',
    c.staff.length === 0 && /walked out/.test(c.reports[0].note ?? '') && fronts === 0, { staff: c.staff.length, note: c.reports[0].note, fronts });

  // ------------------------------------------------------------------ Midnight closes the day by itself
  await page.evaluate(() => { const b = window.game.hud.backend; b.data.bank.balance = 5_000_000; b.saveData(); window.game.companies.hire('biz_mama_put', 'cook'); window.game.world.skyEnvironment.day += 2; window.game.world.skyEnvironment.setHour(23.9); });
  const before = (await company(page)).reports.length;
  await playUntil(page, () => (window.game.world.skyEnvironment.currentHour < 1 ? true : null), 30);
  await advance(page, 0.5);
  const night = await company(page);
  check('companies: at midnight the day closes by itself and its report is added', night.reports.length === before + 1 && night.reports[0].wages === 5000, { before, after: night.reports.length, last: night.reports[0] });

  // ------------------------------------------------------------------ Kept
  await page.reload({ waitUntil: 'load' });
  await page.waitForFunction('window.game && window.game.companies', { timeout: 120000 });
  await wait(2500);
  const kept = await company(page);
  check('companies: staff, branches and reports are kept across a reload', kept.staff.length === 1 && kept.outlets === 2 && kept.reports.length === night.reports.length, { staff: kept.staff.length, outlets: kept.outlets, reports: kept.reports.length });

  check('companies: no errors in the page', log.errors.length === 0, log.errors.slice(0, 5));
  await ctx.close();
}
