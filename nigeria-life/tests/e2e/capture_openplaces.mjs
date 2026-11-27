// Open-air parks: phone 390×844 + desktop 1280×800 play camera, VL/balanced perf per venue.
import fs from 'node:fs';
import path from 'node:path';
import { launch, open, newPlayer, closeDialogs, wait, playUntil, advance, makeOpen } from './lib.mjs';

const venueKey = process.argv[2];
const outRoot = process.argv[3] || `docs/evidence/${venueKey}`;
if (!venueKey) {
  console.error('Usage: node capture_openplaces.mjs <venue-key> [out-dir]');
  process.exit(1);
}
fs.mkdirSync(outRoot, { recursive: true });

const play = async (page, seconds) => {
  for (let t = 0; t < seconds; t += 0.5) {
    await advance(page, 0.5);
    await wait(15);
  }
};

const VENUES = {
  'lekki-conservation': {
    city: 'lagos',
    placeName: 'Lekki Conservation',
    phone: [
      { file: 'phone-canopy-390x844.png', x: 4, z: 0, y: 11.85, yaw: Math.PI * 0.5 },
      { file: 'phone-boardwalk-390x844.png', x: 0, z: 2, yaw: 0.3 },
    ],
    desktop: [
      { file: 'desktop-canopy-1280x800.png', x: -6, z: 0, y: 11.85, yaw: Math.PI * 0.55 },
      { file: 'desktop-forest-1280x800.png', x: -10, z: 10, yaw: 0.8 },
    ],
  },
  'jabi-lake-park': {
    city: 'abuja',
    placeName: 'Jabi Lake Park',
    phone: [
      { file: 'phone-boardwalk-390x844.png', x: 0, z: -6, yaw: Math.PI },
      { file: 'phone-lakeside-390x844.png', x: 8, z: 4, yaw: -1.1 },
    ],
    desktop: [
      { file: 'desktop-boardwalk-1280x800.png', x: -2, z: -10, yaw: 0.2 },
      { file: 'desktop-boats-1280x800.png', x: -6, z: -16, yaw: Math.PI * 0.45 },
    ],
  },
  'millennium-park': {
    city: 'abuja',
    placeName: 'Millennium Park',
    phone: [
      { file: 'phone-fountain-390x844.png', x: 4, z: 0, yaw: -2.4 },
      { file: 'phone-lawns-390x844.png', x: -10, z: 10, yaw: 0.5 },
    ],
    desktop: [
      { file: 'desktop-fountain-1280x800.png', x: 8, z: -4, yaw: -2.6 },
      { file: 'desktop-shade-1280x800.png', x: -14, z: 12, yaw: 0.9 },
    ],
  },
  'ikeja-golf': {
    city: 'lagos',
    placeName: 'Ikeja Golf Club',
    phone: [
      { file: 'phone-green-390x844.png', x: -9, z: -2, yaw: 0.6 },
      { file: 'phone-fairway-390x844.png', x: 2, z: -12, yaw: Math.PI * 0.85 },
    ],
    desktop: [
      { file: 'desktop-clubhouse-1280x800.png', x: 12, z: -6, yaw: -2.2 },
      { file: 'desktop-fairway-1280x800.png', x: -6, z: -14, yaw: 0.4 },
    ],
  },
  'pleasure-park': {
    city: 'port_harcourt',
    placeName: 'Pleasure Park',
    phone: [
      { file: 'phone-wheel-390x844.png', x: 6, z: -8, yaw: -2.5 },
      { file: 'phone-lawn-390x844.png', x: -8, z: 10, yaw: 0.4 },
    ],
    desktop: [
      { file: 'desktop-wheel-1280x800.png', x: 10, z: -10, yaw: -2.8 },
      { file: 'desktop-paths-1280x800.png', x: 0, z: 2, yaw: Math.PI * 0.7 },
    ],
  },
};

const spec = VENUES[venueKey];
if (!spec) {
  console.error('Unknown venue:', venueKey);
  process.exit(1);
}

const enterPlace = async (page) => {
  await page.evaluate(({ key, city }) => {
    const g = window.game;
    g.world.skyEnvironment.setHour(14);
    if (g.world.cityManager.currentCityId !== city) g.arriveInCity(city);
    if (g.world.interiorManager.isPlayerInside()) {
      g.world.interiorManager.exitCurrentInterior(g.player, g.cameraManager, g.hud, g.world);
    }
  }, { key: venueKey, city: spec.city });
  await wait(900);
  await makeOpen(page, venueKey);
  const enterId = `roadside-${venueKey}`;
  const entered = await page.evaluate(async (id) => {
    const g = window.game;
    g.cameraManager.setInteriorEye(false);
    return g.world.interiorManager.enterInterior(id, g.player, g.cameraManager, g.hud, g.world);
  }, enterId);
  if (!entered) throw new Error(`enterInterior failed for ${enterId}`);
  await playUntil(
    page,
    () => {
      const im = window.game.world.interiorManager;
      return im.currentInterior && !im.isTransitioning ? im.currentInterior.name : null;
    },
    50,
  );
  await play(page, 1.5);
};

const standPlay = async (page, x, z, yaw, y = 0) => {
  await page.evaluate(({ x, z, yaw, y }) => {
    const g = window.game;
    const o = g.world.interiorManager.currentInterior.interiorOrigin;
    g.player.stopMoving();
    g.player.mesh.position.set(o.x + x, y, o.z + z);
    g.player.mesh.rotation.y = yaw;
    g.cameraManager.setInteriorEye(false);
  }, { x, z, yaw, y });
  await play(page, 1.2);
  await wait(450);
};

const samplePerf = async (page, level) => {
  await page.evaluate((lvl) => window.game.graphics.choose(lvl), level);
  await wait(500);
  return page.evaluate(() => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(() => {
    const i = window.game.renderer.info.render;
    done({ calls: i.calls, tris: i.triangles });
  }))));
};

const browser = await launch();

{
  const ctx = await newPlayer(browser);
  const { page } = await open(ctx, { w: 390, h: 844 });
  await closeDialogs(page);
  await page.evaluate(() => window.game.cameraManager.setInteriorEye(false));
  await enterPlace(page);
  for (const shot of spec.phone) {
    await standPlay(page, shot.x, shot.z, shot.yaw, shot.y ?? 0);
    await page.screenshot({ path: path.join(outRoot, shot.file) });
  }
  await ctx.close();
}

{
  const ctx = await newPlayer(browser);
  const { page } = await open(ctx, { w: 1280, h: 800 });
  await closeDialogs(page);
  await page.evaluate(() => window.game.cameraManager.setInteriorEye(false));
  await enterPlace(page);
  for (const shot of spec.desktop) {
    await standPlay(page, shot.x, shot.z, shot.yaw, shot.y ?? 0);
    await page.screenshot({ path: path.join(outRoot, shot.file) });
  }
  const veryLow = await samplePerf(page, 'veryLow');
  const medium = await samplePerf(page, 'balanced');
  const perf = {
    measuredAt: new Date().toISOString().slice(0, 16) + 'Z',
    method: 'graphics.choose(level) then 2 rAF sample; Medium = balanced',
    place: spec.placeName,
    veryLow,
    medium,
  };
  fs.writeFileSync(path.join(outRoot, 'perf.json'), JSON.stringify(perf, null, 2));
  await ctx.close();
}

await browser.close();
console.log('Open-place evidence written to', outRoot, 'for', venueKey);