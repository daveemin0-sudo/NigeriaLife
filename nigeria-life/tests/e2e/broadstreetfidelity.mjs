// Broad Street fidelity leap: richer people, supercars in the mix, denser crowd.
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
  await page.screenshot({ path: `${SHOTS}/${name}.png` });
};

export async function run(browser, check) {
  const ctx = await newPlayer(browser);
  const { page, log } = await open(ctx, { w: 1440, h: 810 });
  await closeDialogs(page);

  const state = await page.evaluate(() => {
    const g = window.game;
    g.graphics.choose('high');
    g.player.stopMoving();
    // Same Broad Street angle as the production "before" midday shot
    g.player.mesh.position.set(-2, 0, 6);
    g.player.position.copy(g.player.mesh.position);
    g.cameraManager.setMode('street');
    g.cameraManager.setPreset('street');
    g.world.skyEnvironment.clockMode = 'SIMULATED_TIME';
    g.world.skyEnvironment.timeScale = 0;
    g.world.skyEnvironment.setHour(12.5);
    for (let i = 0; i < 8; i++) g.world.skyEnvironment.update(0.2, g.player.position);
    g.world.weather.setWeather('sunny', true);
    g.world.trafficSpawner.setHour?.(12.5);
    g.cameraManager.snapToPlayer(g.player);
    for (let i = 0; i < 4; i++) {
      try { g.world.update?.(0.05, g.input?.keys ?? {}, g.player.position, g.player); } catch { /* ignore */ }
      g.render();
    }

    const t = g.world.trafficSpawner;
    const bodies = t.bodyIds ?? [];
    const look = g.world.cityPopulation.lookCount;
    return {
      looks: look,
      paints: t.paintCount,
      fleet: t.vehicleCount,
      kinds: t.kindVariety,
      bodies,
      hasAventador: bodies.includes('aventador'),
      hasHuracan: bodies.includes('huracan'),
      walkers: g.world.cityPopulation.count ?? null,
    };
  });

  // Pull a lime supercar into the shot so the leap is unmistakable
  await page.evaluate(() => {
    const g = window.game;
    const t = g.world.trafficSpawner;
    const batches = t.batches || [];
    let superIdx = batches.findIndex((b) => /aventador|huracan/i.test(b?.spec?.body ?? b?.spec?.kind ?? ''));
    if (superIdx < 0) superIdx = batches.findIndex((b) => b?.spec?.kind === 'sedan');
    // Place one instance near the camera via the first lane's lead car if API allows
    try {
      for (const lane of t.lanes || []) {
        for (const car of lane.cars || []) {
          if (car.kind === superIdx || (batches[car.kind]?.spec?.body === 'aventador')) {
            // Nudge progress so it sits in frame around z≈4–8
            car.u = 6;
            car.v = 0;
          }
        }
      }
    } catch { /* ignore */ }
    g.render();
  });

  await snap(page, 'broadstreet-AFTER-midday');

  // Close-up people + supercar framing
  await page.evaluate(() => {
    const g = window.game;
    g.player.mesh.position.set(-1.2, 0, 4.5);
    g.player.position.copy(g.player.mesh.position);
    g.cameraManager.snapToPlayer(g.player);
    g.render();
  });
  await snap(page, 'broadstreet-AFTER-people-supercar');

  check('broadstreetfidelity: fashion look variants expanded well past 35',
    state.looks >= 50, state);
  check('broadstreetfidelity: supercar body present in traffic bake (aventador/huracan)',
    state.bodies.includes('aventador') || state.bodies.includes('huracan') || state.hasAventador, state);
  check('broadstreetfidelity: paint palette includes supercar accents (≥24)',
    state.paints >= 24, state);
  check('broadstreetfidelity: no unexpected page errors',
    log.errors.filter((e) => !/models\/vehicles\/.*\.glb/.test(e)).length === 0,
    log.errors.slice(0, 4));
}
