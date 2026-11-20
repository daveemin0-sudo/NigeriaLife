// Bold procedural character realism: skin sheen, face topo, body mass, cloth sway.
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
    // Park far from spawn NPCs
    const px = 80, pz = 80;
    g.player.mesh.position.set(px, 0, pz);
    g.player.position.set(px, 0, pz);
    g.world.cityPopulation.group.visible = false;
    g.world.trafficSpawner.group.visible = false;
    g.world.skyEnvironment.clockMode = 'SIMULATED_TIME';
    g.world.skyEnvironment.timeScale = 0;
    g.world.skyEnvironment.setHour(14.0);
    for (let i = 0; i < 8; i++) g.world.skyEnvironment.update(0.2, g.player.position);
    if (g.scene.fog) g.scene.fog.density = 0.0008;

    const { HumanMeshBuilder } = await import('/src/graphics/HumanMeshBuilder.ts');
    const hero = HumanMeshBuilder.createHuman({
      gender: 'male',
      username: '',
      outfit: 'street_gold_shirt',
      outfitColor: 0x111111,
      accentColor: 0xd4af37,
      trousersColor: 0x111111,
      skinTone: '#8a5a3c',
      hairstyle: 'high_top',
      hairColor: '#c4a882',
      build: 'slim',
      hasShades: false,
      hasGoldChain: true,
      lod: 'detailed',
      headShape: 'oval',
    });
    hero.nameTag.visible = false;
    hero.group.position.set(px, 0, pz);
    hero.group.rotation.y = Math.PI * 0.08;
    g.world.scene.add(hero.group);

    // Advance cloth sway a few frames
    for (let t = 0; t < 1.2; t += 0.05) hero.updateAnimation(t, false);

    const skin = hero.materials.find((m) => m.type === 'MeshPhysicalMaterial' && m.sheen > 0.4 && !m.map);
    const cloth = hero.materials.find((m) => m.type === 'MeshPhysicalMaterial' && m.map);
    const skullSegs = (() => {
      let max = 0;
      hero.head.traverse((o) => {
        const mesh = o;
        if (mesh.isMesh && mesh.geometry?.attributes?.position) {
          max = Math.max(max, mesh.geometry.attributes.position.count);
        }
      });
      return max;
    })();

    const cam = g.cameraManager.camera;
    cam.position.set(px + 0.12, 1.62, pz + 0.95);
    cam.lookAt(px, 1.56, pz);
    document.body.classList.add('lx-clean');
    document.querySelectorAll('.hud,#hud,.quest,.game-toast,#game-dialogue-overlay').forEach((e) => {
      e.style.display = 'none';
    });
    g.render();

    return {
      skinPhysical: skin?.type === 'MeshPhysicalMaterial',
      skinSheen: skin?.sheen ?? 0,
      clothPhysical: cloth?.type === 'MeshPhysicalMaterial',
      clothSheen: cloth?.sheen ?? 0,
      skullVerts: skullSegs,
      postFx: !!g.postProcessing?.enabled,
      matCount: hero.materials.length,
    };
  });

  await wait(400);
  await page.screenshot({ path: `${SHOTS}/character-AFTER-face.png` });

  // Full body same character
  await page.evaluate(() => {
    const g = window.game;
    const p = g.player.position;
    const cam = g.cameraManager.camera;
    cam.position.set(p.x + 0.2, 1.35, p.z + 2.4);
    cam.lookAt(p.x, 1.05, p.z);
    g.render();
  });
  await wait(200);
  await page.screenshot({ path: `${SHOTS}/character-AFTER-body.png` });

  check('characterrealism: skin uses MeshPhysical sheen (SSS stand-in)', state.skinPhysical && state.skinSheen >= 0.5, state);
  check('characterrealism: cloth uses MeshPhysical with map/sheen', state.clothPhysical && state.clothSheen >= 0.2, state);
  check('characterrealism: higher-res head topology (≥800 verts on a head mesh)', state.skullVerts >= 800, state);
  check('characterrealism: postFx stays off', state.postFx === false, state);
  check('characterrealism: no unexpected page errors',
    log.errors.filter((e) => !/models\/vehicles\/.*\.glb/.test(e)).length === 0,
    log.errors.slice(0, 4));
}
