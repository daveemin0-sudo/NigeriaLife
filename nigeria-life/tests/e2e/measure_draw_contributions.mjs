import { launch, open, closeDialogs } from './lib.mjs';

async function main() {
  const browser = await launch();
  const ctx = await browser.createBrowserContext();
  const { page } = await open(ctx);
  await closeDialogs(page);

  const results = await page.evaluate(() => {
    const g = window.game;
    const renderer = g.renderer;
    const scene = g.scene;
    const camera = g.cameraManager.camera;

    function renderOnce() {
      renderer.info.reset();
      renderer.render(scene, camera);
      return {
        calls: renderer.info.render.calls,
        triangles: renderer.info.render.triangles,
      };
    }

    const baseline = renderOnce();

    // Test 1: Disable shadow map
    const origShadow = renderer.shadowMap.enabled;
    renderer.shadowMap.enabled = false;
    const noShadow = renderOnce();
    renderer.shadowMap.enabled = origShadow;

    // Test 2: Hide NPCs
    g.world.npcs.group.visible = false;
    const noNpc = renderOnce();
    g.world.npcs.group.visible = true;

    // Test 3: Hide Vehicles
    g.world.vehicles.group.visible = false;
    const noVehicles = renderOnce();
    g.world.vehicles.group.visible = true;

    // Test 4: Hide Buildings
    g.world.buildings.group.visible = false;
    const noBuildings = renderOnce();
    g.world.buildings.group.visible = true;

    // Test 5: Hide Roads
    g.world.roads.group.visible = false;
    const noRoads = renderOnce();
    g.world.roads.group.visible = true;

    // Test 6: Remove QualityShowcase from scene
    const showcaseParent = g.qualityShowcase?.group?.parent;
    if (showcaseParent) showcaseParent.remove(g.qualityShowcase.group);
    const noShowcase = renderOnce();
    if (showcaseParent) showcaseParent.add(g.qualityShowcase.group);

    // Test 7: Remove interiorManager from scene
    const interiorParent = g.world.interiorManager?.group?.parent;
    if (interiorParent) interiorParent.remove(g.world.interiorManager.group);
    const noInterior = renderOnce();
    if (interiorParent) interiorParent.add(g.world.interiorManager.group);

    // Test 8: Hide BOTH NPCs and Vehicles without shadow
    renderer.shadowMap.enabled = false;
    g.world.npcs.group.visible = false;
    g.world.vehicles.group.visible = false;
    const minimal = renderOnce();
    renderer.shadowMap.enabled = origShadow;
    g.world.npcs.group.visible = true;
    g.world.vehicles.group.visible = true;

    return {
      baseline,
      noShadow,
      noNpc,
      noVehicles,
      noBuildings,
      noRoads,
      noShowcase,
      noInterior,
      minimal,
    };
  });

  console.log('Component draw call contribution:\n', JSON.stringify(results, null, 2));
  await browser.close();
}

main().catch(console.error);
