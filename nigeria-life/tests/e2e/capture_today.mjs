// Screenshots of the Today panel and an agama, at phone size (scratch capture, not a suite)
import { launch, open, newPlayer, closeDialogs, advance, wait } from './lib.mjs';
const out = process.argv[2];
const browser = await launch();
const ctx = await newPlayer(browser);
const { page } = await open(ctx, { life: true, w: 412, h: 860 });
await closeDialogs(page);
await page.evaluate(() => {
  const g = window.game;
  g.world.skyEnvironment.setHour(11);
  const be = g.hud.backend;
  be.performGig(30_000, 1, 'Morning shift');
  be.consumeFood('Amala', 40, 5, 5, 1500);
  g.modules.Album.get().addPacks(1, 'Test');
});
await advance(page, 1);
await wait(600);
await page.screenshot({ path: `${out}/td-street.png` });
for (const tab of ['today', 'ladder', 'album', 'season']) {
  await page.evaluate((t) => window.game.today.open(t), tab);
  await wait(500);
  await page.screenshot({ path: `${out}/td-${tab}.png` });
}
await page.evaluate(() => document.getElementById('tp-open-pack')?.click());
await wait(1800);
await page.screenshot({ path: `${out}/td-pack.png` });
await page.evaluate(() => { document.getElementById('tp-reveal-done')?.click(); window.game.today.close(); });
await page.evaluate(() => {
  const g = window.game;
  const o = g.world.interactiveObjects.find((x) => x.id === 'agama-central-mosque');
  g.player.stopMoving();
  g.player.mesh.position.set(o.interactionPoint.x + (o.interactionPoint.x > 0 ? -2.5 : 2.5), 0, o.interactionPoint.z - 3); g.player.mesh.rotation.y = Math.atan2(o.interactionPoint.x > 0 ? 1 : -1, 1);
});
await advance(page, 1.5);
await wait(600);
await page.screenshot({ path: `${out}/td-agama.png` });
await browser.close();
