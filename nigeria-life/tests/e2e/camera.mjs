// Package 7: Portrait/desktop FOV, street-level first-person view ('eye'), ride views,
// and camera wall/car collision checks across Lagos, Abuja, and Port Harcourt.
import { open, wait, newPlayer, closeDialogs, advance } from './lib.mjs';

const horizFovDeg = (vfovDeg, aspect) =>
  (2 * Math.atan(Math.tan((vfovDeg * Math.PI) / 360) * aspect) * 180) / Math.PI;

/**
 * Find a clear sidewalk spot ~0.95 m outside a solid wall box in the current city,
 * and return the camera yaw that points the third-person camera straight into that wall.
 */
async function probeWallCollision(page) {
  return page.evaluate(() => {
    const g = window.game;
    const solids = g.solidsHere();
    if (!solids) return { ok: false, reason: 'no solids' };
    // Sample around spawn or city roads to find a wall edge with clear sidewalk beside it
    const p0 = g.player.position;
    let found = null;
    for (let radius = 8; radius <= 180 && !found; radius += 8) {
      for (let a = 0; a < 16 && !found; a++) {
        const ang = (a / 16) * Math.PI * 2;
        const wx = p0.x + Math.cos(ang) * radius;
        const wz = p0.z + Math.sin(ang) * radius;
        if (!solids.wallAt(wx, wz, 0.4)) continue;
        // Walk outward along 4 cardinal directions to find the exterior sidewalk face
        for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          for (let step = 1; step <= 40; step++) {
            const sx = wx + dx * step;
            const sz = wz + dz * step;
            if (!solids.wallAt(sx, sz, 0.45)) {
              // Step back toward the wall to sit ~0.95m from the wall face
              const px = sx - dx * 0.2;
              const pz = sz - dz * 0.2;
              if (!solids.wallAt(px, pz, 0.35) && solids.wallAt(px - dx * 3.0, pz - dz * 3.0, 0.1)) {
                // In Camera.ts, camera offset is (+sin(yaw), y, +cos(yaw)) from player.
                // To place camera at (px - dx*d, pz - dz*d) inside the wall, set yaw = atan2(-dx, -dz).
                const yawIntoWall = Math.atan2(-dx, -dz);
                found = { px, pz, yawIntoWall, wallX: px - dx * 3.0, wallZ: pz - dz * 3.0 };
                break;
              }
            }
          }
          if (found) break;
        }
      }
    }
    if (!found) return { ok: false, reason: 'no wall edge found' };
    g.player.stopMoving();
    g.player.mesh.position.set(found.px, 0, found.pz);
    g.cameraManager.setMode('street');
    g.cameraManager.setPreset('street');
    g.cameraManager.yaw = found.yawIntoWall;
    g.cameraManager.pitch = 0.25;
    g.cameraManager.snapToPlayer(g.player, 'street');
    return { ok: true, ...found };
  });
}

export async function run(browser, check) {
  // 1. Desktop (1366x768): unchanged FOV, street first-person ('eye'), and city/car wall checks
  {
    const ctx = await newPlayer(browser);
    const { page, log } = await open(ctx);
    await closeDialogs(page);

    const desk = await page.evaluate(() => ({
      fov: window.game.cameraManager.camera.fov,
      aspect: window.game.cameraManager.camera.aspect,
    }));
    check('camera: desktop street FOV stays 55 deg', Math.abs(desk.fov - 55) < 0.1, desk);

    // Street first-person view ('eye')
    await page.evaluate(() => {
      const g = window.game;
      g.player.stopMoving();
      g.player.mesh.rotation.y = 0;
      g.cameraManager.setPreset('eye');
    });
    await advance(page, 0.3);
    const eyeInfo = await page.evaluate(() => {
      const g = window.game;
      const dir = new g.modules.THREE.Vector3();
      g.cameraManager.camera.getWorldDirection(dir);
      return {
        preset: g.cameraManager.currentPreset,
        meshVisible: g.player.mesh.visible,
        camY: +g.cameraManager.camera.position.y.toFixed(2),
        playerY: +g.player.position.y.toFixed(2),
        fov: g.cameraManager.camera.fov,
        dirZ: +dir.z.toFixed(2),
      };
    });
    check(
      'camera: street eye view is at head height, hides player mesh, and keeps 62 deg FOV on desktop',
      eyeInfo.preset === 'eye' && eyeInfo.meshVisible === false && eyeInfo.camY > 1.4 && eyeInfo.camY < 2.0 && eyeInfo.fov === 62,
      eyeInfo
    );

    // Walking forward with W in street eye view moves in camera direction
    const p0 = await page.evaluate(() => ({ x: window.game.player.position.x, z: window.game.player.position.z, yaw: window.game.cameraManager.eyeYaw }));
    await page.keyboard.down('w');
    for (let i = 0; i < 10; i++) { await advance(page, 0.1); await wait(20); }
    await page.keyboard.up('w');
    const p1 = await page.evaluate(() => ({ x: window.game.player.position.x, z: window.game.player.position.z }));
    const dist = Math.hypot(p1.x - p0.x, p1.z - p0.z);
    check('camera: W walks forward in street first-person view', dist > 0.4, { dist: +dist.toFixed(2) });

    // Switching back to 'street' restores player mesh visibility
    await page.evaluate(() => window.game.cameraManager.setPreset('street'));
    await advance(page, 0.2);
    const restored = await page.evaluate(() => ({
      preset: window.game.cameraManager.currentPreset,
      meshVisible: window.game.player.mesh.visible,
    }));
    check('camera: leaving street eye restores player mesh visibility', restored.preset === 'street' && restored.meshVisible === true, restored);

    // Lagos wall collision check
    const lagosProbe = await probeWallCollision(page);
    for (let i = 0; i < 6; i++) await advance(page, 0.1);
    const lagosCam = await page.evaluate(() => {
      const g = window.game;
      const c = g.cameraManager.camera.position;
      return {
        x: +c.x.toFixed(2),
        z: +c.z.toFixed(2),
        inWall: g.solidsHere()?.wallAt(c.x, c.z, 0.15) ?? false,
      };
    });
    check('camera: Lagos street camera never ends up inside a building wall', lagosProbe.ok && !lagosCam.inWall, { lagosProbe, lagosCam });

    // Lagos parked/drivable vehicle collision check
    const carSetup = await page.evaluate(() => {
      const g = window.game;
      const v = g.world.vehicles.drivableVehicles.find((x) => x.mesh.visible);
      if (!v) return { ok: false };
      v.mesh.updateMatrixWorld(true);
      const box = new g.modules.THREE.Box3().setFromObject(v.mesh);
      const cx = (box.min.x + box.max.x) / 2;
      const cz = (box.min.z + box.max.z) / 2;
      const px = box.max.x + 1.0;
      const pz = cz;
      g.player.stopMoving();
      g.player.mesh.position.set(px, 0, pz);
      g.cameraManager.setPreset('street');
      // Point camera toward the car (-X)
      g.cameraManager.yaw = -Math.PI / 2;
      g.cameraManager.pitch = 0.2;
      g.cameraManager.snapToPlayer(g.player, 'street');
      return { ok: true, cx, cz, boxMin: [box.min.x, box.min.z], boxMax: [box.max.x, box.max.z] };
    });
    for (let i = 0; i < 8; i++) await advance(page, 0.1);
    const carCam = await page.evaluate(() => {
      const g = window.game;
      const v = g.world.vehicles.drivableVehicles.find((x) => x.mesh.visible);
      const box = new g.modules.THREE.Box3().setFromObject(v.mesh);
      const c = g.cameraManager.camera.position;
      const inside = c.x > box.min.x + 0.05 && c.x < box.max.x - 0.05 && c.z > box.min.z + 0.05 && c.z < box.max.z - 0.05 && c.y < box.max.y - 0.05;
      return { cam: [+c.x.toFixed(2), +c.y.toFixed(2), +c.z.toFixed(2)], inside };
    });
    check('camera: Lagos street camera does not sit inside a parked car', carSetup.ok && !carCam.inside, { carSetup, carCam });

    // Abuja wall collision check
    await page.evaluate(() => window.game.arriveInCity('abuja'));
    await wait(500);
    const abujaProbe = await probeWallCollision(page);
    for (let i = 0; i < 6; i++) await advance(page, 0.1);
    const abujaCam = await page.evaluate(() => {
      const g = window.game;
      const c = g.cameraManager.camera.position;
      return {
        city: g.world.cityManager.currentCityId,
        x: +c.x.toFixed(2),
        z: +c.z.toFixed(2),
        inWall: g.solidsHere()?.wallAt(c.x, c.z, 0.15) ?? false,
      };
    });
    check('camera: Abuja street camera never ends up inside a building wall', abujaProbe.ok && abujaCam.city === 'abuja' && !abujaCam.inWall, { abujaProbe, abujaCam });

    // Port Harcourt wall collision check
    await page.evaluate(() => window.game.arriveInCity('port_harcourt'));
    await wait(500);
    const phProbe = await probeWallCollision(page);
    for (let i = 0; i < 6; i++) await advance(page, 0.1);
    const phCam = await page.evaluate(() => {
      const g = window.game;
      const c = g.cameraManager.camera.position;
      return {
        city: g.world.cityManager.currentCityId,
        x: +c.x.toFixed(2),
        z: +c.z.toFixed(2),
        inWall: g.solidsHere()?.wallAt(c.x, c.z, 0.15) ?? false,
      };
    });
    check('camera: Port Harcourt street camera never ends up inside a building wall', phProbe.ok && phCam.city === 'port_harcourt' && !phCam.inWall, { phProbe, phCam });

    check('camera: no page errors on desktop run', log.errors.length === 0, log.errors);
    await ctx.close();
  }

  // 2. Portrait phone (320x607): horizontal FOV >= 55 deg on street and >= 50 deg on ride views
  {
    const ctx = await newPlayer(browser);
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.emulate({
      viewport: { width: 320, height: 607, isMobile: true, hasTouch: true, deviceScaleFactor: 2 },
      userAgent: 'Mozilla/5.0 (Linux; Android 14; SM-A165F) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36',
    });
    await page.goto(process.env.GAME_URL || 'http://localhost:4173/', { waitUntil: 'load', timeout: 240000 });
    await page.waitForFunction('window.game', { timeout: 240000 });
    await wait(3000);
    await closeDialogs(page);

    const port = await page.evaluate(() => ({
      vfov: window.game.cameraManager.camera.fov,
      aspect: window.game.cameraManager.camera.aspect,
    }));
    const hFov = horizFovDeg(port.vfov, port.aspect);
    check('camera: at 320x607 portrait street horizontal FOV >= 55 deg', hFov >= 55, { ...port, hFov: +hFov.toFixed(1) });

    // Ride views at 320x607
    const rideFovs = await page.evaluate(() => {
      const g = window.game;
      g.roadRideExperience.startRide({
        vehicleName: 'Mercedes G-Wagon',
        originName: 'Ikeja',
        destinationName: 'Victoria Island',
        trafficCondition: 'Smooth',
        weatherCondition: 'Sunny',
        durationSec: 20,
      });
      const out = {};
      for (const v of ['inside', 'chase', 'side']) {
        g.roadRideExperience.setCameraView(v);
        const c = g.roadRideExperience.rideCamera;
        out[v] = { vfov: +c.fov.toFixed(1), aspect: +c.aspect.toFixed(3) };
      }
      g.roadRideExperience.skipRide();
      return out;
    });
    const rideHoriz = Object.fromEntries(
      Object.entries(rideFovs).map(([k, v]) => [k, +horizFovDeg(v.vfov, v.aspect).toFixed(1)])
    );
    check(
      'camera: at 320x607 ride views (inside, chase, side) keep horizontal FOV >= 50 deg',
      Object.values(rideHoriz).every((h) => h >= 50),
      { rideFovs, rideHoriz }
    );
    check('camera: no page errors on 320x607 portrait run', errors.length === 0, errors);
    await ctx.close();
  }
}
