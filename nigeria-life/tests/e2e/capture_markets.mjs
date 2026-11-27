// Lagos market + mall interiors: Balogun, Computer Village, Palms, Ikeja City Mall — phone + desktop evidence.
import fs from 'node:fs';
import path from 'node:path';
import { launch, open, newPlayer, closeDialogs, wait, playUntil, advance, makeOpen } from './lib.mjs';

const outRoot = process.argv[2] || 'docs/evidence/markets';
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
    g.world.skyEnvironment.setHour(14);
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
  await playUntil(page, () => (window.game.world.interiorManager.currentInterior && !window.game.world.interiorManager.isTransitioning ? true : null), 45);
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
  await play(page, 0.9);
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

const verifyStations = async (page, ids) => page.evaluate((stationIds) => {
  const g = window.game;
  return stationIds.map((id) => {
    const o = g.world.interiorManager.getActiveInteractiveObjects().find((x) => x.id === id);
    return { id, ok: !!o };
  });
}, ids);

const SHOTS = [
  {
    key: 'balogun-market',
    phone: [
      { file: 'phone-balogun-aisle-390x844.png', x: -3, z: 2, yaw: Math.PI * 0.55 },
      { file: 'phone-balogun-pepper-390x844.png', x: -10, z: -5, yaw: 0 },
    ],
    desktop: [
      { file: 'desktop-balogun-stalls-1280x800.png', x: -2, z: -3, yaw: Math.PI * 0.85 },
      { file: 'desktop-balogun-goatpen-1280x800.png', x: 8, z: 7, yaw: -2.2 },
    ],
    stations: ['place_balogun-market_pepper', 'place_balogun-market_cloth', 'place_balogun-market_goats'],
    perfPlace: 'Balogun Market',
  },
  {
    key: 'computer-village',
    phone: [
      { file: 'phone-cv-phones-390x844.png', x: -8, z: -3, yaw: 0 },
      { file: 'phone-cv-repair-390x844.png', x: -6, z: 3.5, yaw: 0.6 },
    ],
    desktop: [
      { file: 'desktop-cv-row-1280x800.png', x: 2, z: -2, yaw: Math.PI },
      { file: 'desktop-cv-banners-1280x800.png', x: -12, z: -6, yaw: 0.4 },
    ],
    stations: ['place_computer-village_phones', 'place_computer-village_repair', 'place_computer-village_consoles'],
    perfPlace: 'Computer Village',
  },
  {
    key: 'shopwell-mall',
    phone: [
      { file: 'phone-palms-shelves-390x844.png', x: -4, z: -4, yaw: 0 },
      { file: 'phone-palms-foodcourt-390x844.png', x: 6, z: 2, yaw: -0.8 },
    ],
    desktop: [
      { file: 'desktop-palms-atrium-1280x800.png', x: 0, z: 0, yaw: Math.PI * 0.7 },
      { file: 'desktop-palms-cinema-1280x800.png', x: -4, z: 6, yaw: Math.PI },
    ],
    stations: ['place_shopwell-mall_shelves', 'place_shopwell-mall_food', 'place_shopwell-mall_cinema'],
    perfPlace: 'The Palms Mall',
  },
  {
    key: 'ikeja-city-mall',
    phone: [
      { file: 'phone-ikeja-mall-grocery-390x844.png', x: -5, z: -5, yaw: 0.2 },
      { file: 'phone-ikeja-mall-food-390x844.png', x: 7, z: 0, yaw: -0.5 },
    ],
    desktop: [
      { file: 'desktop-ikeja-mall-atrium-1280x800.png', x: -1, z: 1, yaw: Math.PI * 0.65 },
      { file: 'desktop-ikeja-mall-cinema-1280x800.png', x: -5, z: 6.5, yaw: Math.PI },
    ],
    stations: ['place_ikeja-city-mall_groceries', 'place_ikeja-city-mall_food', 'place_ikeja-city-mall_cinema'],
    perfPlace: 'Ikeja City Mall',
  },
];

const browser = await launch();
const allStations = [];
const perfByPlace = {};

for (const venue of SHOTS) {
  {
    const ctx = await newPlayer(browser);
    const { page } = await open(ctx, { w: 390, h: 844 });
    await closeDialogs(page);
    await page.evaluate(() => window.game.cameraManager.setInteriorEye(true));
    await makeOpen(page, venue.key);
    await enterRoadside(page, venue.key);
    for (const shot of venue.phone) {
      await standEye(page, shot.x, shot.z, shot.yaw);
      await page.screenshot({ path: path.join(outRoot, shot.file) });
    }
    allStations.push(...(await verifyStations(page, venue.stations)));
    await ctx.close();
  }
}

{
  const ctx = await newPlayer(browser);
  const { page } = await open(ctx, { w: 1280, h: 800 });
  await closeDialogs(page);
  await page.evaluate(() => {
    window.game.cameraManager.setInteriorEye(false);
    window.game.world.skyEnvironment.setHour(14);
  });
  for (const venue of SHOTS) {
    await makeOpen(page, venue.key);
    await enterRoadside(page, venue.key);
    for (const shot of venue.desktop) {
      await standPlay(page, shot.x, shot.z, shot.yaw);
      await page.screenshot({ path: path.join(outRoot, shot.file) });
    }
    const veryLow = await samplePerf(page, 'veryLow');
    const medium = await samplePerf(page, 'balanced');
    perfByPlace[venue.key] = { place: venue.perfPlace, veryLow, medium };
  }
  const perf = {
    measuredAt: new Date().toISOString().slice(0, 16) + 'Z',
    method: 'graphics.choose(level) then 2 rAF sample; Medium = balanced',
    venues: perfByPlace,
  };
  fs.writeFileSync(path.join(outRoot, 'perf.json'), JSON.stringify(perf, null, 2));
  await ctx.close();
}

fs.writeFileSync(path.join(outRoot, 'stations.json'), JSON.stringify(allStations, null, 2));
await browser.close();
console.log('Markets evidence written to', outRoot);