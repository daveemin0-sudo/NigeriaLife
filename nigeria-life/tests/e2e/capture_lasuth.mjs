// LASUTH interior evidence: phone + desktop eye camera, perf at veryLow and balanced.
import fs from 'node:fs';
import path from 'node:path';
import { launch, open, newPlayer, closeDialogs, wait, playUntil, advance, makeOpen } from './lib.mjs';

const outRoot = process.argv[2] || 'docs/evidence/lasuth';
fs.mkdirSync(outRoot, { recursive: true });

const play = async (page, seconds) => {
  for (let t = 0; t < seconds; t += 0.5) {
    await advance(page, 0.5);
    await wait(15);
  }
};

const enterLasuth = async (page) => {
  await page.evaluate(() => {
    const g = window.game;
    g.world.skyEnvironment.setHour(11);
    if (g.world.interiorManager.isPlayerInside()) {
      g.world.interiorManager.exitCurrentInterior(g.player, g.cameraManager, g.hud, g.world);
    }
  });
  await wait(800);
  await page.evaluate(() => {
    const g = window.game;
    const card = g.world.interactiveObjects.find((o) => o.id === 'roadside-lasuth');
    g.player.stopMoving();
    g.player.mesh.position.set(card.interactionPoint.x, 0, card.interactionPoint.z);
    g.hud.showInteractionCard(card);
    document.getElementById('card-action-btn')?.click();
  });
  await playUntil(page, () => (window.game.world.interiorManager.currentInterior && !window.game.world.interiorManager.isTransitioning ? true : null), 25);
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

const samplePerf = async (page, level) => {
  await page.evaluate((lvl) => window.game.graphics.choose(lvl), level);
  await wait(500);
  return page.evaluate(() => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(() => {
    const i = window.game.renderer.info.render;
    done({ calls: i.calls, tris: i.triangles });
  }))));
};

const verifyStations = async (page) => page.evaluate(() => {
  const ids = ['place_lasuth_clinic', 'place_lasuth_pharmacy', 'place_lasuth_ward'];
  const g = window.game;
  const found = ids.map((id) => {
    const o = g.world.interiorManager.getActiveInteractiveObjects().find((x) => x.id === id);
    return { id, ok: !!o };
  });
  return found;
});

const browser = await launch();

// Phone — waiting gallery
{
  const ctx = await newPlayer(browser);
  const { page } = await open(ctx, { w: 390, h: 844 });
  await closeDialogs(page);
  await page.evaluate(() => window.game.cameraManager.setInteriorEye(true));
  await makeOpen(page, 'lasuth');
  await enterLasuth(page);
  await standEye(page, 0, 5.5, Math.PI);
  await page.screenshot({ path: path.join(outRoot, 'phone-waiting-390x844.png') });
  await standEye(page, -5, 0.5, 0.6);
  await page.screenshot({ path: path.join(outRoot, 'phone-ward-corridor-390x844.png') });
  const stations = await verifyStations(page);
  fs.writeFileSync(path.join(outRoot, 'stations.json'), JSON.stringify(stations, null, 2));
  await ctx.close();
}

// Desktop — pharmacy wing
{
  const ctx = await newPlayer(browser);
  const { page } = await open(ctx, { w: 1280, h: 800 });
  await closeDialogs(page);
  await page.evaluate(() => window.game.cameraManager.setInteriorEye(true));
  await makeOpen(page, 'lasuth');
  await enterLasuth(page);
  await standEye(page, 3, -1.5, -0.4);
  await page.screenshot({ path: path.join(outRoot, 'desktop-reception-1280x800.png') });
  await standEye(page, 5, -2.5, Math.PI / 2);
  await page.screenshot({ path: path.join(outRoot, 'desktop-pharmacy-1280x800.png') });
  const veryLow = await samplePerf(page, 'veryLow');
  const medium = await samplePerf(page, 'balanced');
  const perf = {
    measuredAt: new Date().toISOString().slice(0, 16) + 'Z',
    method: 'graphics.choose(level) then 2 rAF sample; Medium = balanced',
    place: 'LASUTH',
    veryLow,
    medium,
  };
  fs.writeFileSync(path.join(outRoot, 'perf.json'), JSON.stringify(perf, null, 2));
  await ctx.close();
}

await browser.close();
console.log('LASUTH evidence written to', outRoot);