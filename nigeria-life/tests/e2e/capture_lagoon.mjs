// The lagoon from the bridge and from the canoe (scratch capture, not a suite)
import { launch, open, newPlayer, closeDialogs, wait, playUntil, advance } from './lib.mjs';
const out = process.argv[2];
const browser = await launch();
const ctx = await newPlayer(browser);
const { page } = await open(ctx, { w: 1366, h: 768 });
await closeDialogs(page);
const play = async (seconds) => { for (let t = 0; t < seconds; t += 0.5) { await advance(page, 0.5); await wait(15); } };
const cam = (yaw, pitch, distance) => page.evaluate(({ yaw, pitch, distance }) => { const c = window.game.cameraManager; c.yaw = yaw; c.pitch = pitch; c.distance = distance; }, { yaw, pitch, distance });

await page.evaluate(() => { const g = window.game; g.hud.backend.data.walletCash += 100_000; g.world.skyEnvironment.setHour(16); g.player.mesh.position.set(-13, 0, 2470); g.player.mesh.rotation.y = -Math.PI / 2; });
await cam(Math.PI / 2, 0.25, 16);
await play(3);
await wait(800);
await page.screenshot({ path: `${out}/lagoon-bridge.png` });
await cam(Math.PI / 2 + 0.6, 0.5, 40);
await play(1);
await wait(600);
await page.screenshot({ path: `${out}/lagoon-wide.png` });

await page.evaluate(() => {
  const g = window.game;
  const o = g.world.interactiveObjects.find((x) => x.id === 'makoko-canoe');
  g.player.mesh.position.set(o.interactionPoint.x, 0, o.interactionPoint.z);
  g.hud.showInteractionCard(o);
  document.getElementById('card-action-btn')?.click();
});
await playUntil(page, () => (window.game.player.position.y < -2.5 ? true : null), 20);
await cam(Math.PI * 0.8, 0.3, 9);
await play(12);
await wait(600);
await page.screenshot({ path: `${out}/lagoon-canoe.png` });
await playUntil(page, () => [...document.querySelectorAll('#game-dialogue-overlay button')].some((b) => /smoked fish/i.test(b.textContent)) || null, 60);
await wait(600);
await page.screenshot({ path: `${out}/lagoon-market.png` });
await browser.close();
