// Environmental realism slice: Broad Street façade variation, kerb clutter, gutter puddles.
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
  await wait(250);
  await page.screenshot({ path: `${SHOTS}/streetenviro-${name}.png` });
};

export async function run(browser, check) {
  const ctx = await newPlayer(browser);
  const { page, log } = await open(ctx, { w: 1280, h: 720 });
  await closeDialogs(page);

  const day = await page.evaluate(() => {
    const g = window.game;
    g.graphics.choose('balanced');
    g.player.stopMoving();
    g.player.mesh.position.set(-2, 0, 6);
    g.player.position.copy(g.player.mesh.position);
    g.cameraManager.setMode('street');
    g.cameraManager.setPreset('street');
    g.world.skyEnvironment.clockMode = 'SIMULATED_TIME';
    g.world.skyEnvironment.setHour(12.5);
    for (let i = 0; i < 6; i++) g.world.skyEnvironment.update(0.2, g.player.position);
    g.world.weather.setWeather('sunny', true);
    g.cameraManager.snapToPlayer(g.player);
    g.render();

    // Count Broad Street density signals
    let facadeDetail = 0;
    let stalls = g.world.roads.roadsideStalls?.length ?? 0;
    g.world.buildings.group.traverse((o) => {
      if (o.name === 'facade_detail') facadeDetail += 1;
    });
    const densKids = g.world.cityDensity?.group?.children?.length ?? 0;
    const puddles = g.world.atmosphere.puddlesGroup.children.length;
    const aptPlaster = [];
    g.world.buildings.group.traverse((o) => {
      if (!o.isMesh || o.geometry?.type !== 'BoxGeometry') return;
      const mat = o.material;
      const map = mat?.map;
      if (map && mat.roughness >= 0.85) aptPlaster.push(true);
    });
    return {
      facadeDetail,
      stalls,
      densKids,
      puddles,
      plasterMeshes: aptPlaster.length,
    };
  });

  await snap(page, '01-midday-street');
  check('streetenviro: dressed façades exist on Broad Street buildings',
    day.facadeDetail >= 8, day);
  check('streetenviro: roadside umbrella stalls denser than the old 7',
    day.stalls >= 9, day);
  check('streetenviro: density props group has kerb clutter',
    day.densKids >= 20, day);
  check('streetenviro: more gutter puddles for rain read',
    day.puddles >= 8, day);
  check('streetenviro: weathered plaster materials are in use',
    day.plasterMeshes >= 3, day);

  // Rain: puddles visible + wet asphalt (environment reacts)
  const rain = await page.evaluate(() => {
    const g = window.game;
    g.world.weather.setWeather('rainy', true);
    for (let i = 0; i < 8; i++) g.world.weather.update(0.25, g.player.position);
    g.render();
    const asphalt = g.world.roads.asphaltMat;
    return {
      weather: g.world.weather.currentWeather,
      puddles: g.world.atmosphere.puddlesGroup.visible,
      roughness: +asphalt.roughness.toFixed(2),
      colorR: +asphalt.color.r.toFixed(2),
    };
  });
  await snap(page, '02-rain-street');
  check('streetenviro: rain shows puddles and wetter asphalt on the denser street',
    rain.weather === 'rainy' && rain.puddles && rain.roughness < 0.5 && rain.colorR < 0.85,
    rain);

  check('streetenviro: no page errors', log.errors.length === 0, log.errors.slice(0, 4));
}
