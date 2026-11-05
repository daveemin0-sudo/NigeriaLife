// Lagos State House: a player stands for governor (paying the nomination fee), holds rallies,
// votes at the polling unit, and when the week turns wins the office: their law is in force for
// everyone and their pay is collected at Government House.
import { open, newPlayer, closeDialogs, wait, money } from './lib.mjs';

const sheet = (page) => page.evaluate(() => {
  const el = document.getElementById('state-house');
  return el && el.style.display !== 'none' ? { text: el.innerText.replace(/\s+/g, ' '), buttons: [...el.querySelectorAll('button')].map((b) => b.textContent.trim()) } : null;
});
const click = (page, sel) => page.evaluate((s) => { const el = document.querySelector(`#state-house ${s}`); if (!el) return false; el.click(); return true; }, sel);

export async function run(browser, check) {
  const ctx = await newPlayer(browser);
  const { page, log } = await open(ctx);
  await closeDialogs(page);
  await page.evaluate(() => { const be = window.game.hud.backend; be.data.bank.balance += 60_000_000; be.saveData(); });

  await page.evaluate(() => window.game.stateHouse.open('view'));
  await wait(400);
  let shown = await sheet(page);
  check('politics: the State House shows governor, senator and president, the law in force or that the first election is on, and this week\'s candidates',
    !!shown && /Governor/.test(shown.text) && /Senator/.test(shown.text) && /President/.test(shown.text) && /ELECTION/.test(shown.text) && /Kunle Adeyemi/.test(shown.text) && /Polling Unit 001/.test(shown.text), shown);

  // Standing
  const m0 = await money(page);
  await click(page, '[data-run]');
  await page.evaluate(() => { const el = document.querySelector('#state-house [data-slogan]'); el.value = 'Work must pay more'; el.dispatchEvent(new Event('input', { bubbles: true })); });
  await click(page, '[data-policy="min_wage"]');
  await click(page, '[data-stand]');
  await wait(800);
  const m1 = await money(page);
  const standing = await page.evaluate(() => window.game.politics.isStanding('governor'));
  check('politics: standing for governor costs the ₦50,000,000 nomination form, once, and puts the player on the ballot', standing && m0.total - m1.total === 50_000_000, { standing, paid: m0.total - m1.total });

  for (let i = 0; i < 2; i++) {
    await click(page, '[data-rally]');
    await wait(700);
  }
  const m2 = await money(page);
  const votes = await page.evaluate(() => window.game.politics.candidates('governor').find((c) => c.slogan === 'Work must pay more')?.votes ?? 0);
  check('politics: two rallies cost ₦500,000 each and win ten votes', m1.total - m2.total === 1_000_000 && votes === 10, { paid: m1.total - m2.total, votes });

  // Voting, only at the polling unit
  shown = await sheet(page);
  const noVoteHere = !shown.buttons.includes('Vote');
  await page.evaluate(() => window.game.stateHouse.open('polling'));
  await wait(300);
  shown = await sheet(page);
  const ballot = shown.buttons.filter((b) => b === 'Vote').length;
  await page.evaluate(() => {
    const rows = [...document.querySelectorAll('#state-house .pump-row')];
    const mine = rows.find((r) => /Work must pay more/.test(r.textContent));
    mine.querySelector('[data-vote]').click();
  });
  await wait(800);
  shown = await sheet(page);
  const voted = await page.evaluate(() => window.game.politics.hasVoted('governor'));
  check('politics: votes are cast at the polling unit only, one a week: the ballot offers each candidate, and after voting there is nothing more to press',
    noVoteHere && ballot >= 3 && voted && !shown.buttons.includes('Vote') && /You have voted/.test(shown.text), { noVoteHere, ballot, voted });

  // The week turns
  await page.evaluate(async () => {
    const p = window.game.politics;
    const was = p.now;
    p.now = () => was() + 7 * 24 * 3600 * 1000;
    await p.refresh();
  });
  await wait(300);
  const office = await page.evaluate(() => {
    const p = window.game.politics;
    const h = p.holder('governor');
    return { name: h?.name, slogan: h?.slogan, law: p.has('min_wage'), menu: (() => { window.game.topMenu?.open?.(); return document.getElementById('top-menu')?.innerText ?? ''; })() };
  });
  check('politics: when the week turns the votes are counted: the player is Governor of Lagos and their minimum wage raise is the law', office.slogan === 'Work must pay more' && office.law, office);

  await page.evaluate(() => window.game.stateHouse.open('house'));
  await wait(400);
  shown = await sheet(page);
  const m3 = await money(page);
  await click(page, '[data-collect]');
  await wait(800);
  const m4 = await money(page);
  shown = await sheet(page);
  check('politics: at Government House the governor collects their pay for the week, once', m4.total - m3.total === 15_000_000 && !shown.buttons.some((b) => /Collect/.test(b)), { got: m4.total - m3.total });

  check('politics: no errors in the page', log.errors.length === 0, log.errors.slice(0, 5));
  await ctx.close();
}
