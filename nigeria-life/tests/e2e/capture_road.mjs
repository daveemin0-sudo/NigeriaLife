// A billboard and parked cars on the expressway, at street level (scratch capture)
import { launch, newPlayer, wait, advance } from './lib.mjs';
const out = process.argv[2];
const browser = await launch();
const ctx = await newPlayer(browser);
const page = await ctx.newPage();
await page.setViewport({ width: 420, height: 816, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
await page.goto(process.env.GAME_URL, { waitUntil: 'load', timeout: 120000 });
await page.waitForFunction('window.game', { timeout: 120000 });
await wait(8000);
await page.evaluate(() => { document.getElementById('dialogue-confirm-btn')?.click(); window.game.world.skyEnvironment.setHour(18.6); });
for (const [name, z] of [['billboard', 280], ['frontage', 1000], ['viaduct', 3480]]) {
  await page.evaluate((z) => { const g = window.game; g.player.stopMoving(); g.player.mesh.position.set(-13.5, 0.28, z); g.player.mesh.rotation.y = 0; }, z);
  await advance(page, 2);
  await wait(400);
  await page.screenshot({ path: `${out}/road-${name}.png` });
}
await browser.close();
