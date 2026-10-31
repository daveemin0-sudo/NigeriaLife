// Sign-in on a phone screen: register a name, then sign in with it from a second phone (scratch capture)
// GAME_URL must be a game served with a world server (?server=... is added)
import { launch, wait } from './lib.mjs';
const out = process.argv[2];
const server = process.env.WORLD_SERVER;
const browser = await launch();
const phone = async () => {
  const ctx = await browser.createBrowserContext();
  const page = await ctx.newPage();
  await page.setViewport({ width: 400, height: 820, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
  await page.evaluateOnNewDocument(() => { window.__signInOn = true; });
  await page.goto(`${process.env.GAME_URL}?server=${encodeURIComponent(server)}`, { waitUntil: 'load', timeout: 120000 });
  await page.waitForFunction('window.game', { timeout: 120000 });
  const shown = await page.waitForSelector('#nl-signin', { timeout: 60000 }).then(() => true).catch(() => false);
  return { ctx, page, shown };
};
const name = `Tester_${Math.floor(Math.random() * 9000 + 1000)}`;
const a = await phone();
await wait(800);
await a.page.screenshot({ path: `${out}/signin-1.png` });
await a.page.type('#nl-signin-user', name);
await a.page.type('#nl-signin-pass', 'secret123');
await a.page.click('[data-gender="female"]');
await a.page.click('#nl-signin-go');
await a.page.waitForFunction(() => !document.getElementById('nl-signin'), { timeout: 20000 }).catch(() => null);
console.log('after go:', await a.page.evaluate(() => ({ open: !!document.getElementById('nl-signin'), error: document.getElementById('nl-signin-error')?.textContent ?? null, button: document.getElementById('nl-signin-go')?.textContent ?? null })));
await wait(1500);
const first = await a.page.evaluate(() => ({ name: window.game.player.config.name, gender: window.game.player.config.gender, account: window.game.modules.OnlineAccount?.get?.()?.account ?? null, look: !!document.querySelector('.look-studio') }));
await a.page.screenshot({ path: `${out}/signin-2.png` });
// A second phone: sign in to the same account
const b = await phone();
await b.page.click('[data-mode="login"]');
await b.page.type('#nl-signin-user', name.toLowerCase());
await b.page.type('#nl-signin-pass', 'secret123');
await b.page.click('#nl-signin-go');
await b.page.waitForFunction(() => !document.getElementById('nl-signin'), { timeout: 20000 }).catch(() => null);
await wait(1500);
const second = await b.page.evaluate(() => ({ name: window.game.player.config.name, account: window.game.modules.OnlineAccount?.get?.()?.account ?? null }));
console.log(JSON.stringify({ shownA: a.shown, shownB: b.shown, name, first, second }));
await browser.close();
