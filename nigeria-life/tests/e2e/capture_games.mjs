// Screenshots of the Ayo board and the Whot table on a phone (scratch capture, not a suite)
import { launch, open, newPlayer, closeDialogs, wait } from './lib.mjs';
const out = process.argv[2];
const browser = await launch();
const ctx = await newPlayer(browser);
const { page } = await open(ctx, { life: true, w: 412, h: 860 });
await closeDialogs(page);
await page.evaluate(() => window.game.hud.phoneModal.openApp('games'));
await wait(600);
await page.screenshot({ path: `${out}/gm-lobby.png` });
await page.evaluate(() => document.querySelector('[data-act="ayo-new"]')?.click());
await wait(2500);
await page.screenshot({ path: `${out}/gm-ayo.png` });
await page.evaluate(() => window.game.hud.phoneModal.openApp('games'));
await wait(300);
await page.evaluate(() => document.querySelector('[data-act="whot-new"]')?.click());
await wait(800);
await page.screenshot({ path: `${out}/gm-whot.png` });
await browser.close();
