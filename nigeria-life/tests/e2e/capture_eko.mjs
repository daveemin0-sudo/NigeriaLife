// Eko Grand Hotel lobby evidence: phone eye + desktop play camera, perf VL/balanced.
import fs from 'node:fs';
import path from 'node:path';
import { launch, open, newPlayer, closeDialogs, wait, playUntil, advance, makeOpen } from './lib.mjs';

const outRoot = process.argv[2] || 'docs/evidence/eko-hotel';
fs.mkdirSync(outRoot, { recursive: true });

const play = async (page, seconds) => {
  for (let t = 0; t < seconds; t += 0.5) {
    await advance(page, 0.5);
    await wait(15);
  }
};

const enterEko = async (page) => {
  await page.evaluate(() => {
    const g = window.game;
    g.world.skyEnvironment.setHour(15);
    if (g.world.interiorManager.isPlayerInside()) {
      g.world.interiorManager.exitCurrentInterior(g.player, g.cameraManager, g.hud, g.world);
    }
  });
  await wait(800);
  await page.evaluate(() => {
    const g = window.game;
    const card = g.world.interactiveObjects.find((o) => o.id === 'roadside-eko-grand-hotel');
    g.player.stopMoving();
    g.player.mesh.position.set(card.interactionPoint.x, 0, card.interactionPoint.z);
    g.hud.showInteractionCard(card);
    document.getElementById('card-action-btn')?.click();
  });
  await playUntil(page, () => {
    const im = window.game.world.interiorManager;
    return im.currentInterior?.id === 'interior_place_eko-grand-hotel' && !im.isTransitioning ? true : null;
  }, 60);
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
    const o = g.world.interiorManager.currentInterior.interiorOrigin;
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

const verifyStations = async (page) => page.evaluate(() => {
  const ids = [
    'place_eko-grand-hotel_restaurant',
    'place_eko-grand-hotel_pool',
    'place_eko-grand-hotel_reception',
    'place_eko-grand-hotel_lift',
  ];
  const g = window.game;
  return ids.map((id) => {
    const o = g.world.interiorManager.getActiveInteractiveObjects().find((x) => x.id === id);
    return { id, ok: !!o };
  });
});

const browser = await launch();

{
  const ctx = await newPlayer(browser);
  const { page } = await open(ctx, { w: 390, h: 844 });
  await closeDialogs(page);
  await page.evaluate(() => window.game.cameraManager.setInteriorEye(true));
  await makeOpen(page, 'eko-grand-hotel');
  await enterEko(page);
  await standEye(page, -4, -4.5, Math.PI);
  await page.screenshot({ path: path.join(outRoot, 'phone-reception-390x844.png') });
  await standEye(page, -5, 2.5, 0.4);
  await page.screenshot({ path: path.join(outRoot, 'phone-restaurant-390x844.png') });
  const stations = await verifyStations(page);
  fs.writeFileSync(path.join(outRoot, 'stations.json'), JSON.stringify(stations, null, 2));
  await ctx.close();
}

{
  const ctx = await newPlayer(browser);
  const { page } = await open(ctx, { w: 1280, h: 800 });
  await closeDialogs(page);
  await page.evaluate(() => {
    window.game.cameraManager.setInteriorEye(false);
    window.game.world.skyEnvironment.setHour(15);
  });
  await makeOpen(page, 'eko-grand-hotel');
  await enterEko(page);
  await standPlay(page, -3, -2, Math.PI);
  await page.screenshot({ path: path.join(outRoot, 'desktop-reception-1280x800.png') });
  await standPlay(page, 2, 4, -0.3);
  await page.screenshot({ path: path.join(outRoot, 'desktop-lounge-pool-1280x800.png') });
  const veryLow = await samplePerf(page, 'veryLow');
  const medium = await samplePerf(page, 'balanced');
  const perf = {
    measuredAt: new Date().toISOString().slice(0, 16) + 'Z',
    method: 'graphics.choose(level) then 2 rAF sample; Medium = balanced',
    place: 'Eko Grand Hotel lobby',
    veryLow,
    medium,
  };
  fs.writeFileSync(path.join(outRoot, 'perf.json'), JSON.stringify(perf, null, 2));
  await ctx.close();
}

await browser.close();
console.log('Eko Grand evidence written to', outRoot);