// Stage 0D evidence: zebra clear of stalls + night street readability on phone sizes.
import { launch, newPlayer, open, closeDialogs, wait } from './lib.mjs';
import { mkdirSync, copyFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dir = dirname(fileURLToPath(import.meta.url));
const TAG = process.env.SHOT_TAG || 'after';
const OUT = process.env.SHOTS || join(__dir, `../../docs/evidence/street-night/${TAG}`);
const ART = process.env.ARTIFACTS || `/opt/cursor/artifacts/street-0d-${TAG}`;
mkdirSync(OUT, { recursive: true });
mkdirSync(ART, { recursive: true });

const save = async (page, name) => {
  await page.evaluate(() => {
    document.body.classList.add('lx-clean');
    document.querySelectorAll('.game-toast, #game-toast-container').forEach((el) => el.remove());
    window.game.render();
  });
  await wait(200);
  const path = join(OUT, `${name}.png`);
  await page.screenshot({ path });
  copyFileSync(path, join(ART, `${name}.png`));
  console.log('shot', name);
};

async function main() {
  const browser = await launch();
  const ctx = await newPlayer(browser);
  const { page, log } = await open(ctx, { w: 390, h: 844, realClock: true, settle: 4000 });
  await closeDialogs(page);

  // Probe stall / zebra geometry before framing
  const probe = await page.evaluate(() => {
    const g = window.game;
    const zebraZ = 10;
    const zs = [];
    g.world.roads.group.traverse((o) => {
      if (o.name?.startsWith('roadside-stall')) {
        zs.push({ x: +o.position.x.toFixed(2), z: +o.position.z.toFixed(2), distZebra: +Math.abs(o.position.z - zebraZ).toFixed(2) });
      }
    });
    const fabric = (g.world.cityDensity?.fabric?.stallSpots || []).map((s, i) => ({
      i, x: +s.x.toFixed(2), z: +s.z.toFixed(2), distZebra: +Math.abs(s.z - zebraZ).toFixed(2), distCross: +Math.abs(s.z + 62).toFixed(2),
    }));
    const nearZebra = zs.filter((s) => s.distZebra < 6.5);
    const fabricNear = fabric.filter((s) => s.distZebra < 6.5 || s.distCross < 6.5);
    const onZebra = g.world.standingOnTheGround().filter((o) =>
      o.minZ < zebraZ + 2.3 && o.maxZ > zebraZ - 2.3 && o.minX > -7 && o.maxX < 7
    ).map((o) => o.owner.slice(0, 48));
    return {
      stalls: zs.sort((a, b) => a.z - b.z),
      nearZebra,
      fabricNear,
      onZebra: onZebra.slice(0, 8),
      stallCount: zs.length,
      glowOpacity: g.world.roads.streetGlowMaterial.opacity,
    };
  });
  writeFileSync(join(OUT, `probe-${TAG}.json`), JSON.stringify(probe, null, 2));
  console.log('probe', JSON.stringify(probe, null, 2));

  // Frame zebra crossing at night (phone)
  await page.evaluate(() => {
    const g = window.game;
    g.graphics.choose('balanced');
    g.player.stopMoving();
    // Stand on the zebra looking north along Broad Street
    g.player.mesh.position.set(0, 0, 10);
    g.player.position.copy(g.player.mesh.position);
    g.player.mesh.rotation.y = 0;
    g.cameraManager.setMode('street');
    g.cameraManager.setPreset('street');
    g.world.skyEnvironment.clockMode = 'SIMULATED_TIME';
    g.world.skyEnvironment.setHour(22.0);
    for (let i = 0; i < 10; i++) g.world.skyEnvironment.update(0.25, g.player.position);
    g.world.roads.setLampIntensityForHour(22);
    g.world.roads.setNightLighting('night');
    g.world.cityDensity.setNightLighting('night');
    g.world.weather.setWeather('clear', true);
    g.cameraManager.snapToPlayer(g.player);
    // Pull camera back so zebra + kerb stalls read
    const cam = g.cameraManager.camera;
    cam.position.set(6.5, 4.2, 18);
    cam.lookAt(0, 0.4, 10);
    g.cameraManager.update = () => {};
    g.render();
  });
  await wait(400);
  await save(page, `01-zebra-night-phone-${TAG}`);

  // Closer kerb view near z=10 (where stall used to sit)
  await page.evaluate(() => {
    const g = window.game;
    const cam = g.cameraManager.camera;
    cam.position.set(4.2, 2.4, 12.5);
    cam.lookAt(8.5, 0.6, 11);
    g.render();
  });
  await wait(300);
  await save(page, `02-kerb-near-zebra-${TAG}`);

  // Night readability: player + pavement + lamps, phone (open kerb, not into a wall)
  await page.evaluate(() => {
    const g = window.game;
    g.player.mesh.position.set(8.4, 0.28, -4);
    g.player.position.copy(g.player.mesh.position);
    g.player.mesh.rotation.y = 0;
    const cam = g.cameraManager.camera;
    cam.position.set(11.2, 2.35, 2.8);
    cam.lookAt(8.0, 1.05, -6);
    g.render();
  });
  await wait(300);
  await save(page, `03-night-pavement-player-${TAG}`);

  // Wider night street for lamp pools on asphalt
  await page.evaluate(() => {
    const g = window.game;
    g.player.mesh.position.set(2, 0, 0);
    g.player.position.copy(g.player.mesh.position);
    const cam = g.cameraManager.camera;
    cam.position.set(14, 8, 22);
    cam.lookAt(0, 0, 0);
    g.render();
  });
  await wait(300);
  await save(page, `04-night-street-lamps-${TAG}`);

  // Day zebra clear check (phone)
  await page.evaluate(() => {
    const g = window.game;
    g.world.skyEnvironment.setHour(12.5);
    for (let i = 0; i < 8; i++) g.world.skyEnvironment.update(0.2, g.player.position);
    g.player.mesh.position.set(0, 0, 10);
    g.player.position.copy(g.player.mesh.position);
    const cam = g.cameraManager.camera;
    cam.position.set(6.5, 4.2, 18);
    cam.lookAt(0, 0.4, 10);
    g.render();
  });
  await wait(300);
  await save(page, `05-zebra-day-phone-${TAG}`);

  writeFileSync(join(OUT, `log-${TAG}.json`), JSON.stringify({ errors: log.errors.slice(0, 8) }, null, 2));
  await browser.close();
  console.log('DONE', TAG, OUT);
}

main().catch((e) => { console.error(e); process.exit(1); });
