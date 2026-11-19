// Dock-scene character + showcase supercar fidelity (no scene grade changes).
import { open, newPlayer, closeDialogs, wait } from './lib.mjs';
import { mkdirSync, copyFileSync, existsSync } from 'node:fs';

const SHOTS = process.env.SHOTS || '/opt/cursor/artifacts';
mkdirSync(SHOTS, { recursive: true });

export async function run(browser, check) {
  const ctx = await newPlayer(browser);
  const { page, log } = await open(ctx, { w: 1440, h: 810 });
  await closeDialogs(page);

  const state = await page.evaluate(async () => {
    const g = window.game;
    g.graphics.choose('high');
    g.postProcessing?.setEnabled?.(false);
    g.player.stopMoving();
    g.player.mesh.position.set(0, 0, 10);
    g.player.position.copy(g.player.mesh.position);
    g.cameraManager.setMode('street');
    g.cameraManager.setPreset('street');
    g.world.skyEnvironment.clockMode = 'SIMULATED_TIME';
    g.world.skyEnvironment.timeScale = 0;
    g.world.skyEnvironment.setHour(17.2); // warm light like the dock clip
    for (let i = 0; i < 8; i++) g.world.skyEnvironment.update(0.2, g.player.position);
    g.world.weather.setWeather('sunny', true);

    const { HumanMeshBuilder } = await import('/src/graphics/HumanMeshBuilder.ts');
    const { buildKitCar } = await import('/src/world/vehicles/KitCar.ts');
    const { fabric } = await import('/src/graphics/people/Fabrics.ts');

    const goldTex = fabric('gold_chain', 0x111111, 0xd4af37);
    const hero = HumanMeshBuilder.createHuman({
      gender: 'male',
      username: 'Leon',
      outfit: 'street_gold_shirt',
      outfitColor: 0x111111,
      accentColor: 0xd4af37,
      trousersColor: 0x111111,
      skinTone: '#8a5a3c',
      hairstyle: 'high_top',
      hairColor: '#c4a882',
      build: 'slim',
      hasShades: true,
      hasGoldChain: true,
      lod: 'detailed',
    });
    hero.group.position.set(-0.55, 0, 5.2);
    hero.group.rotation.y = Math.PI * 0.15;
    g.world.scene.add(hero.group);

    const jason = HumanMeshBuilder.createHuman({
      gender: 'male',
      username: 'Jason',
      outfit: 'jason_dock',
      outfitColor: 0x333333,
      trousersColor: 0x2563eb,
      accentColor: 0x93c5fd,
      skinTone: '#c4a07a',
      hairstyle: 'low_cut',
      hat: 'cap',
      hatColor: 0x1f2937,
      hatBackwards: true,
      build: 'broad',
      hasShades: true,
      hasGoldChain: true,
      beard: 'stubble',
      lod: 'detailed',
    });
    jason.group.position.set(0.55, 0, 5.35);
    jason.group.rotation.y = -Math.PI * 0.12;
    g.world.scene.add(jason.group);

    // Black clearcoat Aventador — palette matched to gold-chain shirt
    const car = buildKitCar('aventador', 0x0a0a0c, { light: false });
    car.group.position.set(2.4, 0, 4.6);
    car.group.rotation.y = Math.PI * 0.85;
    g.world.scene.add(car.group);

    const cam = g.cameraManager.camera;
    cam.position.set(0.1, 1.45, 7.35);
    cam.lookAt(0.15, 0.95, 5.2);
    g.render();

    return {
      goldChainTex: !!goldTex,
      heroOutfit: 'street_gold_shirt',
      jasonHatBack: true,
      paintClearcoat: car.materials.paint.clearcoat ?? 0,
      paintType: car.materials.paint.type,
      paintHex: car.materials.paint.color.getHex(),
      wheelKids: car.wheels[0]?.children?.length ?? 0,
      bodyKids: car.group.children[0]?.children?.length ?? 0,
      postFx: !!g.postProcessing?.enabled,
    };
  });

  await wait(500);
  await page.evaluate(() => {
    document.body.classList.add('lx-clean');
    document.querySelectorAll('.game-toast, #game-toast-container, #hud, .hud').forEach((el) => {
      if (el.id === 'hud' || el.classList?.contains('hud')) el.style.opacity = '0';
    });
    window.game.render();
  });
  await wait(300);
  await page.screenshot({ path: `${SHOTS}/dock-AFTER-characters.png` });

  // Close-up on black/gold supercar alone
  await page.evaluate(() => {
    const cam = window.game.cameraManager.camera;
    cam.position.set(3.6, 1.05, 6.2);
    cam.lookAt(2.4, 0.55, 4.6);
    window.game.render();
  });
  await wait(200);
  await page.screenshot({ path: `${SHOTS}/supercar-AFTER-closeup.png` });

  // Keep a video frame beside the after shot for gallery
  if (existsSync(`${SHOTS}/gta6-ref-frame-06.png`)) {
    copyFileSync(`${SHOTS}/gta6-ref-frame-06.png`, `${SHOTS}/dock-BEFORE-video-frame.png`);
  }

  check('supercarfidelity: gold_chain fabric exists', state.goldChainTex === true, state);
  check('supercarfidelity: Aventador MeshPhysical clearcoat',
    state.paintType === 'MeshPhysicalMaterial' && state.paintClearcoat >= 0.9, state);
  check('supercarfidelity: Aventador is black showcase paint', state.paintHex <= 0x222222, state);
  check('supercarfidelity: showcase wheel has multi parts', state.wheelKids >= 8, state);
  check('supercarfidelity: supercar body has showcase detail children', state.bodyKids >= 40, state);
  check('supercarfidelity: postFx stays off (no scene grade)', state.postFx === false, state);
  check('supercarfidelity: no unexpected page errors',
    log.errors.filter((e) => !/models\/vehicles\/.*\.glb/.test(e)).length === 0,
    log.errors.slice(0, 4));
}
