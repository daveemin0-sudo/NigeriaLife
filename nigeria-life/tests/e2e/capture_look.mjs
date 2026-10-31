// The look editor on a phone screen, before and after a few choices (scratch capture)
import { launch, newPlayer, wait, advance } from './lib.mjs';
const out = process.argv[2];
const browser = await launch();
const ctx = await newPlayer(browser);
const page = await ctx.newPage();
await page.setViewport({ width: 420, height: 816, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
await page.goto(process.env.GAME_URL, { waitUntil: 'load', timeout: 120000 });
await page.waitForFunction('window.game', { timeout: 120000 });
await wait(8000);
await page.evaluate(() => { document.getElementById('dialogue-confirm-btn')?.click(); window.game.hud.creatorModal.open('look'); });
await wait(1200);
await page.screenshot({ path: `${out}/look-1.png` });
for (const [k, v] of [['headShape', 'square'], ['hair', 'waves'], ['beard', 'full'], ['skinTone', '#8d5a3b']]) {
  await page.evaluate(([k, v]) => document.querySelector(`.look-opt[data-key="${k}"][data-value="${v}"]`)?.click(), [k, v]);
  await wait(500);
}
await page.screenshot({ path: `${out}/look-2.png` });
await page.evaluate(() => document.querySelector('.dialog-body')?.scrollTo(0, 400));
await wait(300);
await page.screenshot({ path: `${out}/look-3.png` });
await browser.close();
