// Stage 0D: stalls / bins / kerb props stay clear of zebra crossings; night lamps light the ground.
import { open, newPlayer, closeDialogs, wait } from './lib.mjs';
import { mkdirSync } from 'node:fs';

const SHOTS = process.env.SHOTS || '/opt/cursor/artifacts';
mkdirSync(SHOTS, { recursive: true });

const ZEBRA_ZS = [10, -62];
const CLEAR = 6.5;

export async function run(browser, check) {
  const ctx = await newPlayer(browser);
  const { page, log } = await open(ctx, { w: 390, h: 844, realClock: true });
  await closeDialogs(page);

  const day = await page.evaluate((zebras, clear) => {
    const g = window.game;
    g.graphics.choose('balanced');
    g.world.skyEnvironment.clockMode = 'SIMULATED_TIME';
    g.world.skyEnvironment.setHour(12.5);
    for (let i = 0; i < 6; i++) g.world.skyEnvironment.update(0.2, g.player.position);

    const stallZs = [];
    g.world.roads.group.children.forEach((c) => {
      if (c.type !== 'Group') return;
      if (c.name?.startsWith('roadside-stall') || (c.children.length >= 6 && c.children.length <= 12 && Math.abs(c.position.x) > 8)) {
        stallZs.push(+c.position.z.toFixed(2));
      }
    });
    // Prefer named stalls when present
    const named = [];
    g.world.roads.group.traverse((o) => {
      if (o.name?.startsWith('roadside-stall')) named.push(+o.position.z.toFixed(2));
    });
    const zs = named.length ? named : stallZs;

    const tooClose = zs.filter((z) => zebras.some((zebra) => Math.abs(z - zebra) < clear));
    const fabricNear = (g.world.cityDensity?.fabric?.stallSpots || [])
      .filter((s) => zebras.some((zebra) => Math.abs(s.z - zebra) < clear))
      .map((s) => ({ x: +s.x.toFixed(1), z: +s.z.toFixed(1) }));

    // Solids that sit on the Broad Street zebra paint (road x within ±7, z near 10)
    const onPaint = g.world.standingOnTheGround().filter((o) =>
      o.minZ < 10 + 2.3 && o.maxZ > 10 - 2.3 && o.minX > -7 && o.maxX < 7 && !/asphalt|kerb|Road furniture #/i.test(o.owner)
    );

    return {
      stallCount: zs.length,
      stallZs: zs.slice().sort((a, b) => a - b),
      tooClose,
      fabricNear,
      onPaint: onPaint.slice(0, 6).map((o) => o.owner.slice(0, 48)),
    };
  }, ZEBRA_ZS, CLEAR);

  check('streetclear: ≥9 roadside stalls after zebra/bridge filters', day.stallCount >= 9, day);
  check('streetclear: no roadside stall within 6.5 m of a Broad Street zebra', day.tooClose.length === 0, day);
  check('streetclear: no fabric stall centre within 6.5 m of a zebra', day.fabricNear.length === 0, day);
  check('streetclear: no solid sitting on Broad Street zebra paint', day.onPaint.length === 0, day);

  // Night: lamp glow pools visible and bright enough
  const night = await page.evaluate(() => {
    const g = window.game;
    g.player.stopMoving();
    g.player.mesh.position.set(2, 0, 0);
    g.player.position.copy(g.player.mesh.position);
    g.cameraManager.setMode('street');
    g.world.skyEnvironment.setHour(22.0);
    for (let i = 0; i < 10; i++) g.world.skyEnvironment.update(0.25, g.player.position);
    g.world.roads.setLampIntensityForHour(22);
    g.render();
    const glow = g.world.roads.streetGlowMaterial;
    const bulbs = g.world.roads.streetBulbMaterials || [];
    const bulbMax = bulbs.reduce((m, mat) => Math.max(m, mat.emissiveIntensity || 0), 0);
    return {
      hour: +g.world.skyEnvironment.currentHour.toFixed(2),
      glowOpacity: +glow.opacity.toFixed(2),
      glowVisible: (g.world.roads.streetGlows || []).some((m) => m.visible) || glow.opacity > 0,
      bulbMax: +bulbMax.toFixed(2),
      exposure: +((g.renderer || g.world.renderer)?.toneMappingExposure ?? 0).toFixed?.(2),
    };
  });

  await page.evaluate(() => {
    document.body.classList.add('lx-clean');
    document.querySelectorAll('.game-toast, #game-toast-container').forEach((el) => el.remove());
    const g = window.game;
    const cam = g.cameraManager.camera;
    cam.position.set(12, 7, 18);
    cam.lookAt(0, 0.3, 0);
    g.cameraManager.update = () => {};
    g.render();
  });
  await wait(250);
  await page.screenshot({ path: `${SHOTS}/streetclear-night-phone.png` });

  check('streetclear: night lamp ground glow is on (opacity ≥ 0.85)', night.glowOpacity >= 0.85, night);
  check('streetclear: night bulb emissive is strong (≥ 3)', night.bulbMax >= 3, night);
  const realErrors = log.errors.filter((e) => !/403 \(Forbidden\).*fontsource|Failed to load resource.*\.woff/i.test(e));
  check('streetclear: no page errors', realErrors.length === 0, realErrors.slice(0, 4));
}
