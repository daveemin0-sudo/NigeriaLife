// The map of Lagos with its rail of stops and its water; billboards and lamps on the road (scratch capture)
import { launch, newPlayer, wait, advance } from './lib.mjs';
const out = process.argv[2];
const browser = await launch();
const ctx = await newPlayer(browser);
const page = await ctx.newPage();
await page.setViewport({ width: 420, height: 816, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
await page.goto(process.env.GAME_URL, { waitUntil: 'load', timeout: 120000 });
await page.waitForFunction('window.game', { timeout: 120000 });
await wait(8000);
await page.evaluate(() => { document.getElementById('dialogue-confirm-btn')?.click(); window.game.world.skyEnvironment.setHour(17); });
const shot = async (name) => { await advance(page, 0.6); await wait(400); await page.screenshot({ path: `${out}/map-${name}.png` }); };
await page.click('#nav-btn-map');
await wait(1800);
await shot('open');
await page.evaluate(() => document.querySelector('.map-rail-stop[data-z="1950"]')?.click());
await advance(page, 2.5);
await shot('lagoon');
await page.evaluate(() => document.querySelector('.map-rail-stop[data-z="4400"]')?.click());
await advance(page, 2.5);
await shot('ikeja');
// Search for a roadside place
await page.evaluate(() => { const i = document.getElementById('map-search-input'); i.value = 'grand'; i.dispatchEvent(new Event('input')); });
await wait(400);
await shot('search');
await page.evaluate(() => document.getElementById('btn-map-close')?.click());
await wait(800);
// Out on the road: a billboard and the lamps under the viaduct
for (const [name, z, yaw] of [['billboard', 310, 0.9], ['viaduct', 3470, 0.4]]) {
  await page.evaluate(([z, yaw]) => { const g = window.game; g.player.stopMoving(); g.player.mesh.position.set(-13, 0.28, z); g.cameraManager.rotate?.(yaw); }, [z, yaw]);
  await advance(page, 1.5);
  await shot(name);
}
await browser.close();
