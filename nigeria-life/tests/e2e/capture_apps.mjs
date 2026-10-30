// Every app on the phone, one picture each, at a phone's size (scratch capture for the design)
import { launch, newPlayer, wait } from './lib.mjs';
const out = process.argv[2];
const tag = process.argv[3] ?? 'apps';
const browser = await launch();
const ctx = await newPlayer(browser);
const page = await ctx.newPage();
if (process.env.DARK) await page.evaluateOnNewDocument(() => localStorage.setItem('nl_theme_v1', 'dark'));
await page.setViewport({ width: 420, height: 816, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
await page.goto(process.env.GAME_URL, { waitUntil: 'load', timeout: 120000 });
await page.waitForFunction('window.game', { timeout: 120000 });
await wait(9000);
await page.evaluate(() => document.getElementById('dialogue-confirm-btn')?.click());
await page.evaluate(() => document.getElementById('nav-btn-phone')?.click());
await wait(1200);
const ids = await page.evaluate(() => [...document.querySelectorAll('#phone-apps .nlphone-app')].map((b) => b.dataset.app));
const clip = await page.evaluate(() => { const r = document.querySelector('.nlphone').getBoundingClientRect(); return { x: r.left, y: r.top, width: r.width, height: r.height }; });
await page.screenshot({ path: `${out}/${tag}-home.png`, clip });
for (const id of ids) {
  await page.evaluate((app) => document.querySelector(`#phone-apps .nlphone-app[data-app="${app}"]`)?.click(), id);
  await wait(700);
  await page.screenshot({ path: `${out}/${tag}-${id}.png`, clip });
  await page.evaluate(() => document.getElementById('phone-home-bar')?.click());
  await wait(400);
}
console.log(ids.join(' '));
await browser.close();
