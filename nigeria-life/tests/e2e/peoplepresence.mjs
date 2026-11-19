// People presence slice: more fashion variants, idle variety, Low near-detail bump.
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
  await page.screenshot({ path: `${SHOTS}/peoplepresence-${name}.png` });
};

export async function run(browser, check) {
  const ctx = await newPlayer(browser);
  const { page, log } = await open(ctx, { w: 1280, h: 720 });
  await closeDialogs(page);

  const state = await page.evaluate(() => {
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
    // Noon: most people abroad
    g.world.cityPopulation.setClock?.(12.5, g.world.skyEnvironment.day, 1);
    for (let i = 0; i < 30; i++) {
      g.world.cityPopulation.update(0.05, g.player.position, null);
    }
    g.cameraManager.snapToPlayer(g.player);
    g.render();
    const crowd = g.world.cityPopulation;
    return {
      looks: crowd.lookCount,
      agents: crowd.count,
      seen: crowd.seenNow,
      near: crowd.nearDistance,
      draw: crowd.drawDistance,
    };
  });
  await snap(page, '01-noon-crowd');

  check('peoplepresence: fashion look variants expanded beyond the old ~28 set',
    state.looks >= 35, state);
  check('peoplepresence: crowd has a substantial agent pool on Broad Street',
    state.agents >= 150, state);
  check('peoplepresence: people are drawn near the player at noon',
    state.seen >= 5, state);

  const low = await page.evaluate(() => {
    const g = window.game;
    g.graphics.choose('low');
    return {
      near: g.world.cityPopulation.nearDistance,
      draw: g.world.cityPopulation.drawDistance,
      level: g.graphics.level,
    };
  });
  check('peoplepresence: Low keeps tight draw distance but fuller near detail (≥10 m)',
    low.level === 'low' && low.draw === 36 && low.near >= 10, low);

  await snap(page, '02-low-near');

  check('peoplepresence: no page errors', log.errors.length === 0, log.errors.slice(0, 4));
}
