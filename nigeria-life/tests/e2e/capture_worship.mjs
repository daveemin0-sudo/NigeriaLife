// Pictures of the services in the churches and the mosque (scratch capture, not a suite)
import { launch, open, newPlayer, closeDialogs, wait, playUntil, advance } from './lib.mjs';
const out = process.argv[2];
const browser = await launch();
const ctx = await newPlayer(browser);
const { page } = await open(ctx, { w: 1366, h: 768 });
await closeDialogs(page);

const enter = async (key) => {
  await page.evaluate((k) => {
    const g = window.game;
    const card = g.world.interactiveObjects.find((o) => o.id === `roadside-${k}`);
    g.world.skyEnvironment.setHour(10);
    g.player.mesh.position.set(card.interactionPoint.x, 0, card.interactionPoint.z);
    g.hud.showInteractionCard(card);
    document.getElementById('card-action-btn')?.click();
  }, key);
  await playUntil(page, () => (window.game.world.interiorManager.currentInterior && !window.game.world.interiorManager.isTransitioning ? true : null), 20);
  await advance(page, 0.5);
};
const play = async (seconds) => { for (let t = 0; t < seconds; t += 0.5) { await advance(page, 0.5); await wait(15); } };
const shot = async (name, key, part, offset, at, yaw, pitch, distance, seconds = 2) => {
  await page.evaluate(({ k, p, o }) => window.game.modules.Worship.get(k).skipTo(p, o), { k: key, p: part, o: offset });
  await page.evaluate(({ at, yaw, pitch, distance }) => {
    const g = window.game;
    const room = g.world.interiorManager.currentInterior;
    const o = g.world.interiorManager.places.find((pl) => pl.def.id === room.id).group.position;
    g.player.stopMoving();
    g.player.mesh.position.set(o.x + at[0], 0, o.z + at[1]);
    g.cameraManager.interiorYaw = yaw;
    g.cameraManager.interiorPitch = pitch;
    g.cameraManager.interiorDistance = distance;
  }, { at, yaw, pitch, distance });
  await play(seconds);
  await wait(700);
  await page.screenshot({ path: `${out}/${name}.png` });
};

await enter('faith-arena');
await shot('arena-praise', 'faith-arena', 'praise', 0, [0, 8], 0, 0.45, 16, 3);
await shot('arena-praise-close', 'faith-arena', 'praise', 0, [0, -5], 0, 0.3, 8, 1);
await shot('arena-sermon', 'faith-arena', 'sermon', 0, [0, 0], 0, 0.4, 12, 7);
await shot('arena-offering', 'faith-arena', 'offering', 0, [0, -2], 0.6, 0.45, 11, 12);
await page.evaluate(() => { const g = window.game; g.world.interiorManager.exitCurrentInterior(g.player, g.cameraManager, g.hud, g.world); });
await wait(1500);

await enter('central-mosque');
await shot('mosque-qiyam', 'central-mosque', 'salah', 3, [7, -3.6], Math.PI / 2, 0.3, 11, 1.5);
await shot('mosque-ruku', 'central-mosque', 'salah', 9, [7, -3.6], Math.PI / 2, 0.3, 11, 1.5);
await shot('mosque-sujud', 'central-mosque', 'salah', 15, [7, -3.6], Math.PI / 2, 0.3, 11, 1.5);
await shot('mosque-sit', 'central-mosque', 'salah', 18, [7, -3.6], Math.PI / 2, 0.3, 11, 1.2);
await shot('mosque-back', 'central-mosque', 'salah', 15, [0, 4], 0, 0.5, 12, 1.5);
await shot('mosque-lesson', 'central-mosque', 'lesson', 2, [0, 2], Math.PI, 0.45, 10, 2);
await page.evaluate(() => { const g = window.game; g.world.interiorManager.exitCurrentInterior(g.player, g.cameraManager, g.hud, g.world); });
await wait(1500);

await enter('redemption-cathedral');
await shot('cathedral-hymn', 'redemption-cathedral', 'hymn', 0, [0, 7], 0, 0.42, 14, 2);
await shot('cathedral-prayer', 'redemption-cathedral', 'prayer', 0, [8, 0], Math.PI / 2, 0.35, 10, 2);
await browser.close();
