// Screenshots of the Gist Times on a phone (scratch capture, not a suite)
import { launch, open, newPlayer, closeDialogs, wait } from './lib.mjs';
const out = process.argv[2];
const browser = await launch();
const ctx = await newPlayer(browser);
const { page } = await open(ctx, { life: true, w: 412, h: 860 });
await closeDialogs(page);
await page.evaluate(() => { const b = window.game.hud.backend; b.data.bank.balance += 5_000_000; b.saveData(); b.pay(2_500_000, 'a Toyota Camry from Sankofa Motors', 'ASSET_PURCHASE'); window.game.hud.phoneModal.openApp('gist'); });
await wait(800);
await page.screenshot({ path: `${out}/gt-1.png` });
await page.evaluate(() => { const s = document.querySelector('#gist-times')?.closest('.nlphone-screen, .nlphone-body, [class*="screen"]') || document.querySelector('#gist-times').parentElement; s.scrollTop = 700; });
await wait(300);
await page.screenshot({ path: `${out}/gt-2.png` });
await browser.close();
