// Cinematic street presentation: High postFx (bloom + Lagos grade) + clearcoat traffic.
import { open, newPlayer, closeDialogs, wait } from './lib.mjs';
import { mkdirSync } from 'node:fs';

const SHOTS = process.env.SHOTS || '/opt/cursor/artifacts';
mkdirSync(SHOTS, { recursive: true });

export async function run(browser, check) {
  const ctx = await newPlayer(browser);
  const { page, log } = await open(ctx, { w: 1440, h: 810 });
  await closeDialogs(page);

  const state = await page.evaluate(() => {
    const g = window.game;
    g.graphics.choose('high');
    g.player.stopMoving();
    g.player.mesh.position.set(-2, 0, 6);
    g.player.position.copy(g.player.mesh.position);
    g.cameraManager.setMode('street');
    g.cameraManager.setPreset('street');
    g.world.skyEnvironment.clockMode = 'SIMULATED_TIME';
    g.world.skyEnvironment.timeScale = 0;
    g.world.skyEnvironment.setHour(12.5);
    for (let i = 0; i < 10; i++) g.world.skyEnvironment.update(0.2, g.player.position);
    g.world.weather.setWeather('sunny', true);
    g.cameraManager.snapToPlayer(g.player);
    // Hero clearcoat Aventador in frame
    return (async () => {
      const { buildKitCar } = await import('/src/world/vehicles/KitCar.ts');
      const car = buildKitCar('aventador', 0x84cc16, { light: false });
      car.group.position.set(1.2, 0, 3.2);
      car.group.rotation.y = Math.PI * 0.92;
      g.world.scene.add(car.group);
      g.render();
      const paint = car.materials.paint;
      return {
        postFx: g.postProcessing.enabled,
        grade: g.postProcessing.grade,
        bloomOn: g.postProcessing.enabled,
        sun: +g.world.skyEnvironment.sunLight.intensity.toFixed(2),
        envIntensity: g.scene.environmentIntensity ?? null,
        paintClearcoat: paint.clearcoat ?? 0,
        paintType: paint.type,
        period: g.world.skyEnvironment.currentPeriod,
      };
    })();
  });

  await wait(400);
  await page.evaluate(() => {
    document.body.classList.add('lx-clean');
    document.querySelectorAll('.game-toast, #game-toast-container').forEach((el) => el.remove());
    window.game.render();
  });
  await wait(250);
  await page.screenshot({ path: `${SHOTS}/broadstreet-CINEMATIC-after.png` });

  check('cinematicstreet: High quality enables postFx composer', state.postFx === true, state);
  check('cinematicstreet: Lagos grade is punched (contrast ≥ 1.15)', state.grade.contrast >= 1.15, state.grade);
  check('cinematicstreet: midday sun is hard equatorial (≥ 3.0)', state.sun >= 3.0 && state.period === 'midday', state);
  check('cinematicstreet: kit paint uses MeshPhysical clearcoat',
    state.paintType === 'MeshPhysicalMaterial' && state.paintClearcoat >= 0.7, state);
  check('cinematicstreet: no unexpected page errors',
    log.errors.filter((e) => !/models\/vehicles\/.*\.glb/.test(e)).length === 0,
    log.errors.slice(0, 4));
}
