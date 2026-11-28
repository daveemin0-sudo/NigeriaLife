import fs from 'node:fs';
import path from 'node:path';
import { launch, open, newPlayer, closeDialogs, wait, playUntil, advance, makeOpen } from './lib.mjs';

const outRoot = process.argv[2] || 'docs/evidence/lasuth';
fs.mkdirSync(outRoot, { recursive: true });
const play = async (page, s) => { for (let t = 0; t < s; t += 0.5) { await advance(page, 0.5); await wait(15); } };
const browser = await launch();
const ctx = await newPlayer(browser);
const { page } = await open(ctx, { w: 1280, h: 800 });
await closeDialogs(page);
await page.evaluate(() => {
  window.game.graphics.choose('veryLow');
  window.game.cameraManager.setInteriorEye(true);
  window.game.world.skyEnvironment.setHour(11);
});
await makeOpen(page, 'lasuth');
await page.evaluate(() => {
  const g = window.game;
  const card = g.world.interactiveObjects.find((o) => o.id === 'roadside-lasuth');
  g.player.mesh.position.set(card.interactionPoint.x, 0, card.interactionPoint.z);
  g.hud.showInteractionCard(card);
  document.getElementById('card-action-btn')?.click();
});
await playUntil(page, () => (window.game.world.interiorManager.currentInterior ? true : null), 25);
await play(page, 2);
const stand = (x, z, yaw) => page.evaluate(({ x, z, yaw }) => {
  const g = window.game;
  const o = g.world.interiorManager.currentInterior.interiorOrigin;
  g.player.mesh.position.set(o.x + x, 0, o.z + z);
  g.player.mesh.rotation.y = yaw;
  g.cameraManager.eyeYaw = yaw;
}, { x, z, yaw });
await stand(3, -1.5, -0.4);
await play(page, 0.6);
await page.screenshot({ path: path.join(outRoot, 'desktop-reception-1280x800.png') });
await stand(5, -2.5, Math.PI / 2);
await play(page, 0.6);
await page.screenshot({ path: path.join(outRoot, 'desktop-pharmacy-1280x800.png') });
const veryLow = await page.evaluate(() => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(() => {
  const i = window.game.renderer.info.render;
  done({ calls: i.calls, tris: i.triangles });
}))));
await page.evaluate(() => window.game.graphics.choose('balanced'));
await wait(400);
const medium = await page.evaluate(() => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(() => {
  const i = window.game.renderer.info.render;
  done({ calls: i.calls, tris: i.triangles });
}))));
fs.writeFileSync(path.join(outRoot, 'perf.json'), JSON.stringify({
  measuredAt: new Date().toISOString().slice(0, 16) + 'Z',
  method: 'graphics.choose(level) then 2 rAF sample; Medium = balanced',
  place: 'LASUTH',
  veryLow,
  medium,
}, null, 2));
await ctx.close();
await browser.close();
console.log('desktop + perf ok');