// Naija Odds at phone size: the live match, the next kick-offs with a pick on the slip, my bets,
// and the big screen at Oga Sunday's (scratch capture). node capture_odds.mjs <out dir>
import { launch, open, newPlayer, closeDialogs, wait, enterInterior } from './lib.mjs';
const out = process.argv[2] || '.';
const browser = await launch();
const ctx = await newPlayer(browser);
const { page } = await open(ctx);
await page.setViewport({ width: 400, height: 820, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
await wait(2500);
await closeDialogs(page);
await page.evaluate(() => {
  const g = window.game;
  g.hud.backend.data.bank.balance = 2_500_000;
  g.hud.backend.saveData();
  g.hud.phoneModal.open();
});
await wait(900);
await page.screenshot({ path: `${out}/odds-home.png` });
await page.evaluate(() => window.game.hud.phoneModal.openApp('odds'));
await wait(1200);
await page.screenshot({ path: `${out}/odds-live.png` });
await page.evaluate(() => document.querySelector('#odds-fixtures [data-fixture]:nth-child(2) [data-pick="2"]')?.click());
await wait(400);
await page.evaluate(() => document.querySelector('#odds-slip [data-value="50000"]')?.click());
await wait(400);
await page.evaluate(() => document.getElementById('odds-slip')?.scrollIntoView({ block: 'end' }));
await wait(300);
await page.screenshot({ path: `${out}/odds-slip.png` });
await page.evaluate(() => document.getElementById('odds-place')?.click());
await wait(800);
await page.evaluate(() => document.querySelector('[data-set="odds.tab"][data-value="bets"]')?.click());
await wait(600);
await page.screenshot({ path: `${out}/odds-bets.png` });
await page.evaluate(() => window.game.hud.phoneModal.close());
await enterInterior(page, 'interior_place_viewing-centre');
await wait(3000);
await page.screenshot({ path: `${out}/odds-viewing.png` });
await browser.close();
