// Naija Rich List: the player's net worth, everything counted, and their place among Lagos's big
// names; who is next and what it takes to pass them; a business bought counts at what it cost.
import { open, newPlayer, closeDialogs, wait } from './lib.mjs';

const read = (page) => page.evaluate(() => {
  const hero = document.getElementById('rich-hero');
  const rows = [...document.querySelectorAll('#rich-list .rl-row')];
  const meAt = rows.findIndex((r) => r.id === 'rich-me') + 1;
  return { total: Number(hero?.dataset.total), rank: Number(hero?.dataset.rank), meAt, rows: rows.length, next: hero?.querySelector('.rl-next')?.textContent ?? '', worth: window.game.modules.RichList.total() };
});

export async function run(browser, check) {
  const ctx = await newPlayer(browser);
  const { page, log } = await open(ctx);
  await closeDialogs(page);
  await page.evaluate(() => { const g = window.game; g.hud.phoneModal.open(); g.hud.phoneModal.openApp('rich'); });
  await wait(900);
  const start = await read(page);
  check('rich: a new player is worth their cash and bank, at the foot of the Lagos list, with the next name to pass shown', start.total === 175000 && start.worth === 175000 && start.rank === 18 && start.meAt === 18 && start.rows === 18 && /Segun Bamidele/.test(start.next), start);

  await page.evaluate(() => { const b = window.game.hud.backend; b.data.bank.balance += 100_000_000; b.saveData(); });
  await wait(1300);
  const richer = await read(page);
  check('rich: ₦100m more in the bank passes the POS king and the betting shop: #16, Musa Yakasai next', richer.total === 100_175_000 && richer.rank === 16 && richer.meAt === 16 && /Musa Yakasai/.test(richer.next), richer);

  const biz = await page.evaluate(() => {
    const b = window.game.hud.backend;
    const firm = b.data.businesses.find((x) => (x.purchasePrice ?? 0) > 0);
    firm.owned = true;
    b.saveData();
    return { price: firm.purchasePrice, parts: window.game.modules.RichList.worth().businesses };
  });
  await wait(1300);
  const owner = await read(page);
  check('rich: a business owned counts at what it cost', biz.parts === biz.price && owner.total === 100_175_000 + biz.price, { biz, owner });

  check('rich: no errors in the page', log.errors.length === 0, log.errors.slice(0, 5));
  await ctx.close();
}
