// The Red Line: a train over Ikorodu Road, a station, and riding in the car (scratch capture, not a suite)
import { launch, open, newPlayer, closeDialogs, wait, playUntil, advance } from './lib.mjs';
const out = process.argv[2];
const browser = await launch();
const ctx = await newPlayer(browser);
const { page } = await open(ctx, { w: 1366, h: 768 });
await closeDialogs(page);
const play = async (seconds) => { for (let t = 0; t < seconds; t += 0.5) { await advance(page, 0.5); await wait(15); } };
const cam = (yaw, pitch, distance) => page.evaluate(({ yaw, pitch, distance }) => { const c = window.game.cameraManager; c.yaw = yaw; c.pitch = pitch; c.distance = distance; }, { yaw, pitch, distance });

await page.evaluate(() => { const g = window.game; g.hud.backend.data.walletCash += 50_000; g.world.skyEnvironment.setHour(11); g.player.mesh.position.set(14, 0, 3400); });
await play(1);
// Wait for a train to stand at Yaba, then look at it from the pavement
await page.evaluate(() => { const r = window.game.world.expressway.redLine; r.skip(Math.max(0, r.nextAt(1, 1) + 3)); });
await cam(-0.9, 0.18, 14);
await play(1);
await wait(800);
await page.screenshot({ path: `${out}/redline-station.png` });
await cam(-1.6, 0.35, 30);
await play(0.5);
await wait(600);
await page.screenshot({ path: `${out}/redline-wide.png` });

await page.evaluate(() => {
  const g = window.game;
  const o = g.world.interactiveObjects.find((x) => x.id === 'redline-yaba-e');
  g.player.mesh.position.set(o.interactionPoint.x, 0, o.interactionPoint.z);
  g.hud.showInteractionCard(o);
  document.getElementById('card-action-btn')?.click();
});
await wait(300);
await page.evaluate(() => [...document.querySelectorAll('#game-dialogue-overlay button')].find((b) => /To Oshodi/.test(b.textContent))?.click());
await playUntil(page, () => { const q = window.game.player.actor.sequence; return q && q.steps?.[q.index]?.name === 'waiting for the train' ? true : null; }, 60);
await play(1);
await cam(-2.2, 0.3, 9);
await wait(600);
await page.screenshot({ path: `${out}/redline-platform.png` });
await page.evaluate(() => { const r = window.game.world.expressway.redLine; r.skip(Math.max(0, r.nextAt(1, 1) - 2)); });
await playUntil(page, () => (window.game.world.expressway.redLine.state().riding ? true : null), 30);
await play(22);
await cam(Math.PI, 0.55, 10);
await wait(800);
await page.screenshot({ path: `${out}/redline-ride.png` });
await browser.close();
