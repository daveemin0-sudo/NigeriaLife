// Restaurant interior evidence: Chop Express, Mai Suya, Mama Put — phone eye + desktop play camera.
import fs from 'node:fs';
import path from 'node:path';
import { launch, open, newPlayer, closeDialogs, wait, playUntil, advance, makeOpen, enterInterior } from './lib.mjs';

const outRoot = process.argv[2] || 'docs/evidence/restaurants';
fs.mkdirSync(outRoot, { recursive: true });

const play = async (page, seconds) => {
  for (let t = 0; t < seconds; t += 0.5) {
    await advance(page, 0.5);
    await wait(15);
  }
};

const enterRoadside = async (page, key) => {
  await page.evaluate(() => {
    const g = window.game;
    g.world.skyEnvironment.setHour(18);
    if (g.world.interiorManager.isPlayerInside()) {
      g.world.interiorManager.exitCurrentInterior(g.player, g.cameraManager, g.hud, g.world);
    }
  });
  await wait(800);
  await page.evaluate((k) => {
    const g = window.game;
    const card = g.world.interactiveObjects.find((o) => o.id === `roadside-${k}`);
    g.player.stopMoving();
    g.player.mesh.position.set(card.interactionPoint.x, 0, card.interactionPoint.z);
    g.hud.showInteractionCard(card);
    document.getElementById('card-action-btn')?.click();
  }, key);
  await playUntil(page, () => (window.game.world.interiorManager.currentInterior && !window.game.world.interiorManager.isTransitioning ? true : null), 40);
  await play(page, 1.5);
};

const enterMamaPut = async (page) => {
  await page.evaluate(() => {
    const g = window.game;
    g.world.skyEnvironment.setHour(13);
    if (g.world.interiorManager.isPlayerInside()) {
      g.world.interiorManager.exitCurrentInterior(g.player, g.cameraManager, g.hud, g.world);
    }
  });
  await wait(800);
  await page.evaluate(() => {
    const g = window.game;
    g.player.stopMoving();
    g.player.mesh.position.set(-9, 0, -6.5);
  });
  await wait(200);
  await enterInterior(page, 'mama-put');
  await playUntil(page, () => (window.game.world.interiorManager.currentInterior?.type === 'restaurant' && !window.game.world.interiorManager.isTransitioning ? true : null), 40);
  await play(page, 1.5);
};

const standEye = async (page, x, z, yaw) => {
  await page.evaluate(({ x, z, yaw }) => {
    const g = window.game;
    const o = g.world.interiorManager.currentInterior.interiorOrigin;
    g.player.stopMoving();
    g.player.mesh.position.set(o.x + x, 0, o.z + z);
    g.player.mesh.rotation.y = yaw;
    g.cameraManager.eyeYaw = yaw;
    g.cameraManager.setInteriorEye(true);
  }, { x, z, yaw });
  await play(page, 0.8);
  await wait(400);
};

const standPlay = async (page, x, z, yaw) => {
  await page.evaluate(({ x, z, yaw }) => {
    const g = window.game;
    const im = g.world.interiorManager.currentInterior;
    const o = im.interiorOrigin ?? im.group?.position;
    g.player.stopMoving();
    g.player.mesh.position.set(o.x + x, 0, o.z + z);
    g.player.mesh.rotation.y = yaw;
    g.cameraManager.setInteriorEye(false);
  }, { x, z, yaw });
  await play(page, 1.2);
  await wait(400);
};

const samplePerf = async (page, level) => {
  await page.evaluate((lvl) => window.game.graphics.choose(lvl), level);
  await wait(500);
  return page.evaluate(() => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(() => {
    const i = window.game.renderer.info.render;
    done({ calls: i.calls, tris: i.triangles });
  }))));
};

const verifyStations = async (page, ids) => page.evaluate((stationIds) => {
  const g = window.game;
  return stationIds.map((id) => {
    const o = g.world.interiorManager.getActiveInteractiveObjects().find((x) => x.id === id);
    return { id, ok: !!o };
  });
}, ids);

const browser = await launch();

// --- Chop Express ---
{
  const ctx = await newPlayer(browser);
  const { page } = await open(ctx, { w: 390, h: 844 });
  await closeDialogs(page);
  await page.evaluate(() => window.game.cameraManager.setInteriorEye(true));
  await makeOpen(page, 'chop-express');
  await enterRoadside(page, 'chop-express');
  await standEye(page, 0, -1.5, Math.PI);
  await page.screenshot({ path: path.join(outRoot, 'phone-chop-express-counter-390x844.png') });
  await standEye(page, -2, 3, 0.4);
  await page.screenshot({ path: path.join(outRoot, 'phone-chop-express-seating-390x844.png') });
  const stations = await verifyStations(page, ['place_chop-express_counter']);
  fs.writeFileSync(path.join(outRoot, 'stations-chop-express.json'), JSON.stringify(stations, null, 2));
  await ctx.close();
}
{
  const ctx = await newPlayer(browser);
  const { page } = await open(ctx, { w: 1280, h: 800 });
  await closeDialogs(page);
  await makeOpen(page, 'chop-express');
  await enterRoadside(page, 'chop-express');
  await standPlay(page, -1, -0.5, Math.PI);
  await page.screenshot({ path: path.join(outRoot, 'desktop-chop-express-counter-1280x800.png') });
  await standPlay(page, 0, 2.5, -0.2);
  await page.screenshot({ path: path.join(outRoot, 'desktop-chop-express-seating-1280x800.png') });
  const veryLow = await samplePerf(page, 'veryLow');
  const medium = await samplePerf(page, 'balanced');
  fs.writeFileSync(path.join(outRoot, 'perf-chop-express.json'), JSON.stringify({
    measuredAt: new Date().toISOString().slice(0, 16) + 'Z',
    method: 'graphics.choose(level) then 2 rAF sample; Medium = balanced',
    place: 'Chop Express',
    veryLow,
    medium,
  }, null, 2));
  await ctx.close();
}

// --- Mai Suya (Allen Avenue) ---
{
  const ctx = await newPlayer(browser);
  const { page } = await open(ctx, { w: 390, h: 844 });
  await closeDialogs(page);
  await page.evaluate(() => window.game.cameraManager.setInteriorEye(true));
  await makeOpen(page, 'allen-suya');
  await enterRoadside(page, 'allen-suya');
  await standEye(page, 0, -1.2, Math.PI);
  await page.screenshot({ path: path.join(outRoot, 'phone-allen-suya-grill-390x844.png') });
  await standEye(page, 0, 2.5, Math.PI);
  await page.screenshot({ path: path.join(outRoot, 'phone-allen-suya-seating-390x844.png') });
  const stations = await verifyStations(page, ['place_allen-suya_grill']);
  fs.writeFileSync(path.join(outRoot, 'stations-allen-suya.json'), JSON.stringify(stations, null, 2));
  await ctx.close();
}
{
  const ctx = await newPlayer(browser);
  const { page } = await open(ctx, { w: 1280, h: 800 });
  await closeDialogs(page);
  await makeOpen(page, 'allen-suya');
  await enterRoadside(page, 'allen-suya');
  await standPlay(page, 0, -0.5, Math.PI);
  await page.screenshot({ path: path.join(outRoot, 'desktop-allen-suya-grill-1280x800.png') });
  await standPlay(page, -2, 2, 0.6);
  await page.screenshot({ path: path.join(outRoot, 'desktop-allen-suya-seating-1280x800.png') });
  const veryLow = await samplePerf(page, 'veryLow');
  const medium = await samplePerf(page, 'balanced');
  fs.writeFileSync(path.join(outRoot, 'perf-allen-suya.json'), JSON.stringify({
    measuredAt: new Date().toISOString().slice(0, 16) + 'Z',
    method: 'graphics.choose(level) then 2 rAF sample; Medium = balanced',
    place: 'Mai Suya Spot',
    veryLow,
    medium,
  }, null, 2));
  await ctx.close();
}

// --- Mama Put / Broad Street buka ---
{
  const ctx = await newPlayer(browser);
  const { page } = await open(ctx, { w: 390, h: 844 });
  await closeDialogs(page);
  await page.evaluate(() => window.game.cameraManager.setInteriorEye(true));
  await enterMamaPut(page);
  await standEye(page, -2, -2, 0.6);
  await page.screenshot({ path: path.join(outRoot, 'phone-mama-put-counter-390x844.png') });
  await standEye(page, 3, 1.5, -1);
  await page.screenshot({ path: path.join(outRoot, 'phone-mama-put-seating-390x844.png') });
  const stations = await verifyStations(page, ['buka_food_counter', 'buka_table_vip']);
  fs.writeFileSync(path.join(outRoot, 'stations-mama-put.json'), JSON.stringify(stations, null, 2));
  await ctx.close();
}
{
  const ctx = await newPlayer(browser);
  const { page } = await open(ctx, { w: 1280, h: 800 });
  await closeDialogs(page);
  await enterMamaPut(page);
  await standPlay(page, -1, -1.5, 0.5);
  await page.screenshot({ path: path.join(outRoot, 'desktop-mama-put-counter-1280x800.png') });
  await standPlay(page, 4, 0.5, Math.PI);
  await page.screenshot({ path: path.join(outRoot, 'desktop-mama-put-seating-1280x800.png') });
  const veryLow = await samplePerf(page, 'veryLow');
  const medium = await samplePerf(page, 'balanced');
  fs.writeFileSync(path.join(outRoot, 'perf-mama-put.json'), JSON.stringify({
    measuredAt: new Date().toISOString().slice(0, 16) + 'Z',
    method: 'graphics.choose(level) then 2 rAF sample; Medium = balanced',
    place: 'Mama Put Buka',
    veryLow,
    medium,
  }, null, 2));
  await ctx.close();
}

await browser.close();
console.log('Restaurant evidence written to', outRoot);