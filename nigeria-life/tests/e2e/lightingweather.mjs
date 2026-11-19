// Lighting + weather immersion slice: day / golden hour / night / rain on Broad Street.
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
  await page.screenshot({ path: `${SHOTS}/lightingweather-${name}.png` });
};

const setScene = (page, { hour, weather }) => page.evaluate(({ hour: h, weather: w }) => {
  const g = window.game;
  g.graphics.choose('balanced');
  g.player.stopMoving();
  g.player.mesh.position.set(-2, 0, 6);
  g.player.position.copy(g.player.mesh.position);
  g.cameraManager.setMode('street');
  g.cameraManager.setPreset('street');
  g.world.skyEnvironment.clockMode = 'SIMULATED_TIME';
  g.world.skyEnvironment.setHour(h);
  for (let i = 0; i < 8; i++) g.world.skyEnvironment.update(0.2, g.player.position);
  // Match World.update immersion hooks
  g.world.roads.setLampIntensityForHour(h);
  g.cameraManager.snapToPlayer(g.player);
  if (w) {
    g.world.weather.setWeather(w);
    for (let i = 0; i < 50; i++) g.world.weather.update(0.25, g.player.position);
  } else {
    g.world.weather.setWeather('sunny');
    for (let i = 0; i < 25; i++) g.world.weather.update(0.25, g.player.position);
  }
  g.render();
  const sky = g.world.skyEnvironment;
  return {
    hour: +sky.currentHour.toFixed(2),
    period: sky.currentPeriod,
    sun: +sky.sunLight.intensity.toFixed(2),
    hemi: +sky.hemiLight.intensity.toFixed(2),
    exposure: +g.renderer.toneMappingExposure.toFixed(2),
    lamp: +g.world.roads.streetGlowMaterial.opacity.toFixed(2),
    weather: g.world.weather.currentWeather,
  };
}, { hour, weather });

export async function run(browser, check) {
  const ctx = await newPlayer(browser);
  const { page, log } = await open(ctx, { w: 1280, h: 720 });
  await closeDialogs(page);

  const midday = await setScene(page, { hour: 12.5, weather: 'sunny' });
  await snap(page, '01-midday');
  check('lightingweather: midday is bright with lamps off',
    midday.sun > 1.5 && midday.lamp < 0.1 && midday.period === 'midday',
    midday);

  const golden = await setScene(page, { hour: 18.4, weather: 'sunny' });
  await snap(page, '02-golden-hour');
  check('lightingweather: golden hour warms the key light and begins street glow',
    golden.period === 'golden_hour' && golden.lamp > 0.15 && golden.sun > 1.0,
    golden);

  const night = await setScene(page, { hour: 21.5, weather: 'sunny' });
  await snap(page, '03-night');
  check('lightingweather: night keeps street lamps strong while sun is dim',
    night.period === 'night' && night.lamp > 0.6 && night.sun < 1.0,
    night);

  const rain = await setScene(page, { hour: 14.0, weather: 'rainy' });
  await snap(page, '04-rain');
  const rainState = await page.evaluate(() => {
    const g = window.game;
    const asphalt = g.world.roads.asphaltMat;
    return {
      weather: g.world.weather.currentWeather,
      roughness: +asphalt.roughness.toFixed(2),
      metalness: +asphalt.metalness.toFixed(2),
      colorR: +asphalt.color.r.toFixed(2),
      puddles: g.world.atmosphere.puddlesGroup.visible,
      rainVisible: g.world.weather.rainParticles?.visible === true,
    };
  });
  check('lightingweather: rain darkens/glosses asphalt and shows puddles',
    rain.weather === 'rainy' && rainState.roughness < 0.5 && rainState.colorR < 0.85 && rainState.puddles,
    { rain, rainState });

  check('lightingweather: no page errors', log.errors.length === 0, log.errors.slice(0, 4));
}
