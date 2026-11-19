// Materials & textures slice: walls/roofs/glass gloss in rain without wiping maps.
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
  await page.screenshot({ path: `${SHOTS}/materialsresponse-${name}.png` });
};

export async function run(browser, check) {
  const ctx = await newPlayer(browser);
  const { page, log } = await open(ctx, { w: 1280, h: 720 });
  await closeDialogs(page);

  const dry = await page.evaluate(() => {
    const g = window.game;
    g.graphics.choose('balanced');
    g.player.stopMoving();
    g.player.mesh.position.set(-2, 0, 6);
    g.player.position.copy(g.player.mesh.position);
    g.cameraManager.setMode('street');
    g.cameraManager.setPreset('street');
    g.world.skyEnvironment.clockMode = 'SIMULATED_TIME';
    g.world.skyEnvironment.setHour(13);
    for (let i = 0; i < 6; i++) g.world.skyEnvironment.update(0.2, g.player.position);
    g.world.weather.setWeather('sunny', true);
    g.cameraManager.snapToPlayer(g.player);
    g.render();
    const mats = g.world.buildings.matLib;
    return {
      plasterR: +mats.wallPlasterCream.roughness.toFixed(2),
      plasterMap: !!mats.wallPlasterCream.map,
      roofR: +mats.corrugatedRoofRusty.roughness.toFixed(2),
      roofMap: !!mats.corrugatedRoofRusty.map,
      glassR: +mats.glassReflectiveMaterial.roughness.toFixed(2),
      glassMetal: +mats.glassReflectiveMaterial.metalness.toFixed(2),
    };
  });
  await snap(page, '01-dry');
  check('materialsresponse: dry plaster keeps its map and high roughness',
    dry.plasterMap && dry.plasterR >= 0.8, dry);
  check('materialsresponse: rusty roof has corrugated map',
    dry.roofMap && dry.roofR >= 0.65, dry);
  check('materialsresponse: glass is glossy and metallic',
    dry.glassR <= 0.15 && dry.glassMetal >= 0.8, dry);

  const wet = await page.evaluate(() => {
    const g = window.game;
    const mats = g.world.buildings.matLib;
    const beforeColor = mats.wallPlasterCream.color.getHex();
    const beforeMap = mats.wallPlasterCream.map;
    g.world.weather.setWeather('rainy', true);
    for (let i = 0; i < 12; i++) g.world.weather.update(0.25, g.player.position);
    g.render();
    return {
      weather: g.world.weather.currentWeather,
      plasterR: +mats.wallPlasterCream.roughness.toFixed(2),
      plasterMetal: +mats.wallPlasterCream.metalness.toFixed(2),
      plasterColor: mats.wallPlasterCream.color.getHex(),
      plasterMapSame: mats.wallPlasterCream.map === beforeMap,
      colorUnchanged: mats.wallPlasterCream.color.getHex() === beforeColor,
      roofR: +mats.corrugatedRoofRusty.roughness.toFixed(2),
      glassR: +mats.glassReflectiveMaterial.roughness.toFixed(2),
      asphaltR: +g.world.roads.asphaltMat.roughness.toFixed(2),
    };
  });
  await snap(page, '02-wet');
  check('materialsresponse: rain glazes plaster without wiping colour/map',
    wet.weather === 'rainy' && wet.plasterR < dry.plasterR && wet.plasterMapSame && wet.colorUnchanged,
    { dry, wet });
  check('materialsresponse: roof and glass get wetter (lower roughness) in rain',
    wet.roofR < dry.roofR && wet.glassR <= dry.glassR && wet.asphaltR < 0.5,
    { dry, wet });

  check('materialsresponse: no page errors', log.errors.length === 0, log.errors.slice(0, 4));
}
