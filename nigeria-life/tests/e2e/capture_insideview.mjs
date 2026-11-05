// The inside view in a few rooms (scratch capture, not a suite)
import { launch, open, newPlayer, closeDialogs, wait, playUntil, advance } from './lib.mjs';
const out = process.argv[2];
const browser = await launch();
const ctx = await newPlayer(browser);
const { page } = await open(ctx, { w: 1366, h: 768 });
await closeDialogs(page);
const play = async (seconds) => { for (let t = 0; t < seconds; t += 0.5) { await advance(page, 0.5); await wait(15); } };
const enter = async (key) => {
  await page.evaluate((k) => {
    const g = window.game;
    g.world.skyEnvironment.setHour(11);
    if (g.world.interiorManager.isPlayerInside()) g.world.interiorManager.exitCurrentInterior(g.player, g.cameraManager, g.hud, g.world);
  }, key);
  await wait(1500);
  await page.evaluate((k) => {
    const g = window.game;
    const card = g.world.interactiveObjects.find((o) => o.id === `roadside-${k}`);
    g.player.mesh.position.set(card.interactionPoint.x, 0, card.interactionPoint.z);
    g.hud.showInteractionCard(card);
    document.getElementById('card-action-btn')?.click();
  }, key);
  await playUntil(page, () => (window.game.world.interiorManager.currentInterior && !window.game.world.interiorManager.isTransitioning ? true : null), 20);
};
const stand = (x, z, yaw) => page.evaluate(({ x, z, yaw }) => {
  const g = window.game;
  const o = g.world.interiorManager.currentInterior.interiorOrigin;
  g.player.stopMoving();
  g.player.mesh.position.set(o.x + x, 0, o.z + z);
  g.player.mesh.rotation.y = yaw;
  g.cameraManager.eyeYaw = yaw;
}, { x, z, yaw });

await page.evaluate(() => window.game.cameraManager.setInteriorEye(true));
await enter('faith-arena');
await page.evaluate(() => window.game.modules.Worship.get('faith-arena').skipTo('praise'));
await stand(0, 3, Math.PI);
await play(3);
await wait(500);
await page.screenshot({ path: `${out}/eye-arena.png` });
await enter('central-mosque');
await page.evaluate(() => window.game.modules.Worship.get('central-mosque').skipTo('salah', 15));
await stand(-0.2, 1.2, Math.PI);
await play(1.5);
await wait(500);
await page.screenshot({ path: `${out}/eye-mosque.png` });
await enter('redemption-cathedral');
await page.evaluate(() => window.game.modules.Worship.get('redemption-cathedral').skipTo('hymn'));
await stand(0, 6, Math.PI);
await play(2);
await wait(500);
await page.screenshot({ path: `${out}/eye-cathedral.png` });
await enter('eko-grand-hotel');
await stand(0, 6, Math.PI);
await play(1.5);
await wait(500);
await page.screenshot({ path: `${out}/eye-lobby.png` });
await browser.close();
