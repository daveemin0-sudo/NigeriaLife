// A business's days (src/business/Companies.ts dayLuck): most are ordinary, some bad (rain, the
// road dug up), some good (an owambe on the street), and some bring officials for a levy paid
// from the till at close; the same on every device; the day's report says what happened. A test
// browser leaves luck out unless the test turns it on, so other suites see ordinary days.
import { open, newPlayer, closeDialogs, wait } from './lib.mjs';

const BIZ = 'biz_mama_put';

export async function run(browser, check) {
  const ctx = await newPlayer(browser);
  const { page, log } = await open(ctx, { w: 1280, h: 760 });
  await closeDialogs(page);
  await page.evaluate((id) => {
    const g = window.game;
    g.world.skyEnvironment.timeScale = 0;
    const be = g.hud.backend;
    be.data.bank.balance += 50_000_000;
    be.saveData();
    be.buyBusiness(id);
  }, BIZ);

  const off = await page.evaluate((id) => {
    const c = window.game.companies;
    const kinds = new Set();
    for (let d = 0; d < 60; d++) kinds.add(c.luck(id, d).kind);
    return [...kinds];
  }, BIZ);
  check('bizdays: in a test browser luck is left out unless asked for, so every day is ordinary for the other suites', off.length === 1 && off[0] === 'ordinary', off);

  await page.evaluate(() => { window.__luckOn = true; });
  const days = await page.evaluate((id) => {
    const c = window.game.companies;
    const count = { ordinary: 0, bad: 0, good: 0, officials: 0 };
    const first = {};
    for (let d = 0; d < 400; d++) {
      const l = c.luck(id, d);
      count[l.kind] += 1;
      if (first[l.kind] === undefined) first[l.kind] = d;
    }
    const again = JSON.stringify(c.luck(id, first.bad)) === JSON.stringify(c.luck(id, first.bad));
    return { count, first, again, badText: c.luck(id, first.bad).text, goodText: c.luck(id, first.good).text };
  }, BIZ);
  check('bizdays: over 400 days about one in ten is bad, one in ten good and one in twelve brings officials; the rest are ordinary, and a day is the same each time it is asked',
    days.count.bad > 20 && days.count.bad < 65 && days.count.good > 20 && days.count.good < 65 && days.count.officials > 15 && days.count.officials < 55 && days.count.ordinary > 250 && days.again,
    days);

  const takings = await page.evaluate(([id, first]) => {
    const g = window.game;
    const c = g.companies;
    const biz = g.hud.backend.getData().businesses.find((b) => b.id === id);
    const at = (d) => { g.world.skyEnvironment.setDay(d); return c.perCycle(biz, biz.baseIncomePerCycle); };
    return { ordinary: at(first.ordinary), bad: at(first.bad), good: at(first.good) };
  }, [BIZ, days.first]);
  check('bizdays: on a bad day the business takes six tenths of an ordinary day, on a good day thirteen tenths',
    Math.abs(takings.bad - takings.ordinary * 0.6) <= 1 && Math.abs(takings.good - takings.ordinary * 1.3) <= 1, takings);

  // An officials' day: their levy comes out of the till at close and the report says so
  const closed = await page.evaluate(([id, day]) => {
    const g = window.game;
    const c = g.companies;
    g.world.skyEnvironment.setDay(day);
    c.took(id, 200_000);
    const out = c.closeDay(day);
    return out.find((o) => o.business.id === id)?.report ?? null;
  }, [BIZ, days.first.officials]);
  check('bizdays: on an officials\' day a "signage levy" of a twentieth of the takings (₦10,000 of ₦200,000) is paid from the till at close, and the day\'s report says so',
    closed && closed.levy === 10_000 && /signage levy.*₦10,000 from the till/.test(closed.event ?? '') && closed.profit < closed.takings - closed.wages - closed.rent,
    closed);

  await page.evaluate((id) => { window.game.hud.phoneModal.open(); window.game.hud.phoneModal.openApp('business', `b:${id}`); }, BIZ);
  await wait(700);
  const shown = await page.evaluate(() => document.querySelector('.nlphone')?.innerText ?? '');
  await page.evaluate(() => window.game.hud.phoneModal.close());
  check('bizdays: the Business app\'s day report shows what kind of day it was', /signage levy/.test(shown), shown.slice(0, 300));

  check('bizdays: no errors', log.errors.length === 0, log.errors.slice(0, 5));
}
