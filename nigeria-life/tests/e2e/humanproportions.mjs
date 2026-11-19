// Neck length + shoulder blend + everyday polo wardrobe.
import { open, newPlayer, closeDialogs, wait } from './lib.mjs';
import { mkdirSync } from 'node:fs';

const SHOTS = process.env.SHOTS || '/opt/cursor/artifacts';
mkdirSync(SHOTS, { recursive: true });

export async function run(browser, check) {
  const ctx = await newPlayer(browser);
  const { page, log } = await open(ctx, { w: 1100, h: 1100 });
  await closeDialogs(page);

  const state = await page.evaluate(async () => {
    const g = window.game;
    g.graphics.choose('high');
    g.postProcessing?.setEnabled?.(false);
    g.cameraManager.update = () => {};
    g.player.stopMoving();
    g.player.mesh.visible = false;
    const px = 90, pz = 90;
    g.player.mesh.position.set(px, 0, pz);
    g.player.position.set(px, 0, pz);
    g.world.cityPopulation.group.visible = false;
    g.world.trafficSpawner.group.visible = false;
    g.world.skyEnvironment.clockMode = 'SIMULATED_TIME';
    g.world.skyEnvironment.timeScale = 0;
    g.world.skyEnvironment.setHour(14);
    for (let i = 0; i < 6; i++) g.world.skyEnvironment.update(0.2, g.player.position);
    if (g.scene.fog) g.scene.fog.density = 0.0008;

    const { HumanMeshBuilder } = await import('/src/graphics/HumanMeshBuilder.ts');
    const { WARDROBE_CATALOGUE } = await import('/src/player/CharacterCustomization.ts');
    const { createHumanForConfig } = await import('/src/player/HumanFromConfig.ts');

    const polo = HumanMeshBuilder.createHuman({
      gender: 'male',
      username: '',
      outfit: 'polo_shirt',
      outfitColor: 0x1e3a8a,
      trousersColor: 0x1e3a5f,
      skinTone: '#6b4430',
      hairstyle: 'fade',
      build: 'average',
      lod: 'detailed',
      headShape: 'oval',
    });
    polo.nameTag.visible = false;
    polo.group.position.set(px, 0, pz);
    polo.group.rotation.y = Math.PI * 0.08;
    g.world.scene.add(polo.group);

    // Measure neck: head.y − torso top-ish, and neck mesh height
    const headY = polo.head.position.y;
    const torsoY = polo.torso.position.y;
    let neckH = 0;
    polo.head.traverse((o) => {
      if (o.isMesh && o.geometry?.boundingBox === null) o.geometry.computeBoundingBox?.();
      if (o.isMesh && o.geometry?.boundingBox) {
        const bb = o.geometry.boundingBox;
        const h = bb.max.y - bb.min.y;
        // Neck is the tallish thin lathe under the skull — take the mesh whose center is below skull
        if (o.position.y < 0.02 && h > 0.08 && h < 0.35) neckH = Math.max(neckH, h);
      }
    });
    const polos = WARDROBE_CATALOGUE.filter((i) => i.styleKey === 'polo_shirt' && i.category === 'top');
    const tees = WARDROBE_CATALOGUE.filter((i) => i.styleKey === 'tshirt' && i.category === 'top');
    const shirts = WARDROBE_CATALOGUE.filter((i) => i.styleKey === 'button_shirt' && i.category === 'top');
    const jeans = WARDROBE_CATALOGUE.filter((i) => i.styleKey === 'jeans' && i.category === 'bottom');

    const fromWardrobe = createHumanForConfig({
      name: 'Test',
      gender: 'male',
      skinTone: '#6b4430',
      attire: 'senator_navy',
      headwear: 'none',
      topId: 'top_polo_white',
      bottomId: 'bottom_blue_jeans',
      shoesId: 'shoes_white_sneakers',
      ownedClothingIds: ['top_polo_white', 'bottom_blue_jeans', 'shoes_white_sneakers'],
    });

    const cam = g.cameraManager.camera;
    cam.position.set(px + 0.15, 1.45, pz + 1.15);
    cam.lookAt(px, 1.35, pz);
    document.body.classList.add('lx-clean');
    document.querySelectorAll('.hud,#hud,.quest,.game-toast,#game-dialogue-overlay').forEach((e) => {
      e.style.display = 'none';
    });
    g.render();

    return {
      headY: +headY.toFixed(3),
      torsoY: +torsoY.toFixed(3),
      neckSpan: +(headY - torsoY).toFixed(3),
      neckH: +neckH.toFixed(3),
      poloCount: polos.length,
      teeCount: tees.length,
      shirtCount: shirts.length,
      jeansCount: jeans.length,
      wardrobeOutfit: fromWardrobe.group.children.length > 0,
      defaultTopIsPolo: true,
    };
  });

  await wait(350);
  await page.screenshot({ path: `${SHOTS}/human-AFTER-polo-closeup.png` });

  await page.evaluate(() => {
    const g = window.game;
    const p = g.player.position;
    const cam = g.cameraManager.camera;
    cam.position.set(p.x + 0.25, 1.25, p.z + 2.5);
    cam.lookAt(p.x, 1.0, p.z);
    g.render();
  });
  await wait(200);
  await page.screenshot({ path: `${SHOTS}/human-AFTER-polo-body.png` });

  // Head should sit closer to torso (was ~1.7 vs 1.14 → span 0.56; target span ≤ 0.42)
  check('humanproportions: head sits closer to torso (span ≤ 0.42)', state.neckSpan <= 0.42, state);
  check('humanproportions: wardrobe has ≥3 polos', state.poloCount >= 3, state);
  check('humanproportions: wardrobe has tees + button shirts + jeans', state.teeCount >= 2 && state.shirtCount >= 2 && state.jeansCount >= 1, state);
  check('humanproportions: wardrobe equip builds a human', state.wardrobeOutfit === true, state);
  check('humanproportions: no unexpected page errors',
    log.errors.filter((e) => !/models\/vehicles\/.*\.glb/.test(e) && !/THREE is not defined/.test(e)).length === 0,
    log.errors.slice(0, 4));
}
