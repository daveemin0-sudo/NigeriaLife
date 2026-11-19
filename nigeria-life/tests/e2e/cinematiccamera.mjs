// Cinematic camera slice: eased preset/FOV transitions, street look-ahead, chase framing.
import { open, newPlayer, closeDialogs, wait, advance } from './lib.mjs';
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
  await page.screenshot({ path: `${SHOTS}/cinematiccamera-${name}.png` });
};

export async function run(browser, check) {
  const ctx = await newPlayer(browser);
  const { page, log } = await open(ctx, { w: 1280, h: 720 });
  await closeDialogs(page);

  const street = await page.evaluate(() => {
    const g = window.game;
    g.player.stopMoving();
    g.player.mesh.position.set(-2, 0, 6);
    g.player.position.copy(g.player.mesh.position);
    g.cameraManager.setMode('street');
    g.cameraManager.setPreset('street');
    g.cameraManager.snapToPlayer(g.player);
    g.render();
    return g.cameraManager.framing;
  });
  await snap(page, '01-street');
  check('cinematiccamera: street preset targets cinematic framing (~0.46 pitch, ~8.8 m)',
    Math.abs(street.targetPitch - 0.46) < 0.02 && Math.abs(street.targetDistance - 8.8) < 0.15
      && Math.abs(street.fovTarget - 55) < 0.5, street);

  const transition = await page.evaluate(() => {
    const g = window.game;
    const cam = g.cameraManager;
    cam.setPreset('street');
    cam.pitch = 0.46;
    cam.distance = 8.8;
    // Force live values away from aerial, then ask for aerial and sample mid-ease
    const before = { pitch: cam.pitch, distance: cam.distance };
    cam.setPreset('aerial');
    const target = { pitch: cam.framing.targetPitch, distance: cam.framing.targetDistance };
    for (let i = 0; i < 4; i++) cam.update(g.player, 1 / 60);
    const mid = { pitch: cam.pitch, distance: cam.distance };
    for (let i = 0; i < 90; i++) cam.update(g.player, 1 / 60);
    const after = { pitch: cam.pitch, distance: cam.distance, fov: cam.camera.fov };
    g.render();
    return { before, mid, after, target };
  });
  await snap(page, '02-aerial-ease');
  const midBetween =
    transition.mid.pitch > transition.before.pitch + 0.05
    && transition.mid.pitch < transition.target.pitch - 0.02
    && transition.mid.distance > transition.before.distance + 1
    && transition.mid.distance < transition.target.distance - 0.5;
  const settled =
    Math.abs(transition.after.pitch - transition.target.pitch) < 0.05
    && Math.abs(transition.after.distance - transition.target.distance) < 0.4;
  check('cinematiccamera: preset change eases pitch/distance (mid-frame between start and target)',
    midBetween, transition);
  check('cinematiccamera: preset ease settles on aerial targets',
    settled, transition);

  // Restore street and walk look-ahead
  const walk = await page.evaluate(() => {
    const g = window.game;
    const cam = g.cameraManager;
    cam.setPreset('street');
    for (let i = 0; i < 60; i++) cam.update(g.player, 1 / 60);
    g.player.mesh.rotation.y = 0;
    g.player.isMoving = true;
    cam.update(g.player, 1 / 30);
    cam.update(g.player, 1 / 30);
    const look = cam.currentLookAt.clone();
    g.player.isMoving = false;
    return {
      lookZ: +look.z.toFixed(3),
      playerZ: +g.player.position.z.toFixed(3),
      ahead: look.z - g.player.position.z,
    };
  });
  check('cinematiccamera: walking look-at leads slightly ahead of the player',
    walk.ahead > 0.15 && walk.ahead < 1.2, walk);

  // Chase framing behind a parked/enterable vehicle
  const chase = await page.evaluate(() => {
    const g = window.game;
    const v = g.world.vehicles.drivableVehicles.find((x) => x.type === 'sedan' || x.type === 'suv' || x.type === 'danfo');
    if (!v) return { ok: false };
    g.enterVehicle(v);
    v.mesh.position.set(-1.8, 0, 20);
    v.mesh.rotation.y = 0;
    v.currentSpeed = 12;
    g.cameraManager.driveView = 'chase';
    g.cameraManager.hasInitializedVehCam = false;
    for (let i = 0; i < 40; i++) g.cameraManager.update(g.player, 1 / 60);
    const cam = g.cameraManager.camera.position;
    const behind = cam.z < v.mesh.position.z - 4;
    const above = cam.y > v.mesh.position.y + 3;
    g.render();
    return {
      ok: true,
      behind,
      above,
      cam: { x: +cam.x.toFixed(2), y: +cam.y.toFixed(2), z: +cam.z.toFixed(2) },
      carZ: +v.mesh.position.z.toFixed(2),
    };
  });
  await snap(page, '03-chase');
  check('cinematiccamera: chase view sits behind and above the driven vehicle',
    chase.ok && chase.behind && chase.above, chase);

  await page.evaluate(() => {
    const g = window.game;
    if (g.player.isDriving) g.exitVehicle();
  });

  check('cinematiccamera: no page errors', log.errors.length === 0, log.errors.slice(0, 4));
}
