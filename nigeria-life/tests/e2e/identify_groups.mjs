import { launch, open, closeDialogs } from './lib.mjs';

async function main() {
  const browser = await launch();
  const ctx = await browser.createBrowserContext();
  const { page } = await open(ctx);
  await closeDialogs(page);

  const res = await page.evaluate(() => {
    const g = window.game;
    const scene = g.scene;

    const list = [];
    for (let i = 0; i < scene.children.length; i++) {
      const child = scene.children[i];
      let meshCount = 0;
      let instancedCount = 0;
      let nonInstancedCount = 0;
      let castShadowCount = 0;
      const subCategories = {};

      child.traverse((obj) => {
        if (obj.isMesh || obj.isInstancedMesh) {
          meshCount++;
          if (obj.isInstancedMesh) instancedCount++;
          else nonInstancedCount++;
          if (obj.castShadow) castShadowCount++;

          const matName = obj.material ? (Array.isArray(obj.material) ? obj.material.map(m => m.type).join(',') : obj.material.type) : 'none';
          subCategories[matName] = (subCategories[matName] || 0) + 1;
        }
      });

      if (meshCount > 50) {
        // Try to identify what this group is in game or world
        let identity = 'unknown';
        if (child === g.world.roads.group) identity = 'world.roads';
        else if (child === g.world.buildings.group) identity = 'world.buildings';
        else if (child === g.world.vehicles.group) identity = 'world.vehicles';
        else if (child === g.world.npcs.group) identity = 'world.npcs';
        else if (child === g.world.districts.group) identity = 'world.districts';
        else if (child === g.world.landmarks.group) identity = 'world.landmarks';
        else if (child === g.world.interiorManager.group) identity = 'world.interiorManager';
        else if (child === g.world.cityDensity.group) identity = 'world.cityDensity';
        else if (child === g.world.trafficSpawner.group) identity = 'world.trafficSpawner';
        else if (child === g.world.cityPopulation.group) identity = 'world.cityPopulation';
        else if (child === g.world.worldMap.group) identity = 'world.worldMap';
        else if (child === g.world.cityManager.currentCity?.group) identity = 'world.cityManager';
        else if (child === g.qualityShowcase?.group) identity = 'qualityShowcase';
        else if (child === g.player.mesh) identity = 'player';

        list.push({
          index: i,
          name: child.name,
          identity,
          meshCount,
          instancedCount,
          nonInstancedCount,
          castShadowCount,
          visible: child.visible,
          layers: child.layers.mask,
        });
      }
    }

    return list;
  });

  console.log('Heavy Scene Groups:\n', JSON.stringify(res, null, 2));
  await browser.close();
}

main().catch(console.error);
