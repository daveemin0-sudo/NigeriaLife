// Vehicles & traffic slice: denser Lagos mix, paint variety, night lamp overlay, Low draw cull.
import { open, newPlayer, closeDialogs, wait } from './lib.mjs';
import { mkdirSync } from 'node:fs';

const SHOTS = process.env.SHOTS || '/opt/cursor/artifacts';
mkdirSync(SHOTS, { recursive: true });

const snap = async (page, name) => {
  await page.evaluate(() => {
    document.body.classList.add('lx-clean');
    document.querySelectorAll('.game-toast, #game-toast-container').forEach((el) => el.remove());
    window.game.render();
  });
  await wait(300);
  await page.screenshot({ path: `${SHOTS}/vehicletraffic-${name}.png` });
};

export async function run(browser, check) {
  const ctx = await newPlayer(browser);
  const { page, log } = await open(ctx, { w: 1280, h: 720 });
  await closeDialogs(page);

  const noon = await page.evaluate(() => {
    const g = window.game;
    g.graphics.choose('balanced');
    g.player.stopMoving();
    g.player.mesh.position.set(-2, 0, 8);
    g.player.position.copy(g.player.mesh.position);
    g.cameraManager.setMode('street');
    g.cameraManager.setPreset('street');
    g.world.skyEnvironment.clockMode = 'SIMULATED_TIME';
    g.world.skyEnvironment.setHour(12.5);
    for (let i = 0; i < 6; i++) g.world.skyEnvironment.update(0.2, g.player.position);
    g.world.trafficSpawner.abroad = 1;
    g.world.trafficSpawner.setHour(12.5);
    for (let i = 0; i < 40; i++) {
      g.world.trafficSpawner.update(0.05, g.player.position, null);
    }
    g.cameraManager.snapToPlayer(g.player);
    g.render();
    const t = g.world.trafficSpawner;
    const moving = t.moving;
    return {
      kinds: t.kindVariety,
      paints: t.paintCount,
      fleet: t.vehicleCount,
      movingNow: moving.now,
      movingByDay: moving.byDay,
      drawn: t.drawnNow,
      night: t.nightLights,
      draw: t.drawDistance,
    };
  });
  await snap(page, '01-noon-broad');

  check('vehicletraffic: Lagos mix has more body recipes than the old ~20 set',
    noon.kinds >= 23, noon);
  check('vehicletraffic: paint palette expanded for street variety',
    noon.paints >= 20, noon);
  check('vehicletraffic: substantial traffic fleet on Broad Street lanes',
    noon.fleet >= 80 && noon.movingByDay >= 60, noon);
  check('vehicletraffic: vehicles are drawn near the player at noon',
    noon.drawn >= 4 && noon.night < 0.1, noon);

  const night = await page.evaluate(() => {
    const g = window.game;
    g.world.skyEnvironment.setHour(21.0);
    for (let i = 0; i < 6; i++) g.world.skyEnvironment.update(0.2, g.player.position);
    g.world.trafficSpawner.setHour(21.0);
    for (let i = 0; i < 20; i++) {
      g.world.trafficSpawner.update(0.05, g.player.position, null);
    }
    g.render();
    const t = g.world.trafficSpawner;
    return {
      night: t.nightLights,
      drawn: t.drawnNow,
    };
  });
  await snap(page, '02-night-lamps');

  check('vehicletraffic: night enables head/tail lamp overlay',
    night.night >= 0.9 && night.drawn >= 2, night);

  const low = await page.evaluate(() => {
    const g = window.game;
    g.graphics.choose('low');
    return {
      draw: g.world.trafficSpawner.drawDistance,
      level: g.graphics.level,
    };
  });
  check('vehicletraffic: Low tightens traffic draw distance (≤80 m)',
    low.level === 'low' && low.draw <= 80, low);

  check('vehicletraffic: no page errors', log.errors.length === 0, log.errors.slice(0, 4));
}
