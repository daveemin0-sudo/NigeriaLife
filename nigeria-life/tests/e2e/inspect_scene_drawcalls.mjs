import { launch, open, closeDialogs } from './lib.mjs';

async function main() {
  const browser = await launch();
  const ctx = await browser.createBrowserContext();
  const { page } = await open(ctx);
  await closeDialogs(page);

  const breakdown = await page.evaluate(() => {
    const g = window.game;
    const scene = g.scene;
    const renderer = g.renderer;

    let shadowCasters = 0;
    let shadowReceivers = 0;
    let totalMeshes = 0;
    let instancedMeshes = 0;
    let groupCounts = {};

    scene.traverse((obj) => {
      if (obj.isMesh || obj.isInstancedMesh) {
        totalMeshes++;
        if (obj.isInstancedMesh) instancedMeshes++;
        if (obj.castShadow) shadowCasters++;
        if (obj.receiveShadow) shadowReceivers++;

        // Find top-level owner group in scene.children
        let top = obj;
        while (top.parent && top.parent !== scene) {
          top = top.parent;
        }
        const name = top.name || top.constructor.name || 'unnamed';
        groupCounts[name] = (groupCounts[name] || 0) + 1;
      }
    });

    // Check lights
    const lights = [];
    scene.traverse((obj) => {
      if (obj.isLight) {
        lights.push({
          type: obj.type,
          castShadow: obj.castShadow,
          shadowMapSize: obj.shadow?.mapSize ? { w: obj.shadow.mapSize.width, h: obj.shadow.mapSize.height } : null,
          shadowCamera: obj.shadow?.camera ? {
            near: obj.shadow.camera.near,
            far: obj.shadow.camera.far,
            left: obj.shadow.camera.left,
            right: obj.shadow.camera.right,
            top: obj.shadow.camera.top,
            bottom: obj.shadow.camera.bottom,
          } : null
        });
      }
    });

    // Check renderer shadowMap
    const shadowMapEnabled = renderer.shadowMap.enabled;
    const shadowMapType = renderer.shadowMap.type;
    const shadowAutoUpdate = renderer.shadowMap.autoUpdate;

    // Check Frustum culling settings on meshes
    let nonFrustumCulled = 0;
    scene.traverse((obj) => {
      if ((obj.isMesh || obj.isInstancedMesh) && obj.frustumCulled === false) {
        nonFrustumCulled++;
      }
    });

    return {
      rendererCalls: renderer.info.render.calls,
      rendererTriangles: renderer.info.render.triangles,
      totalMeshes,
      instancedMeshes,
      shadowCasters,
      shadowReceivers,
      nonFrustumCulled,
      shadowMap: { shadowMapEnabled, shadowMapType, shadowAutoUpdate },
      lights,
      groupCounts
    };
  });

  console.log('Scene Diagnostic Breakdown:', JSON.stringify(breakdown, null, 2));
  await browser.close();
}

main().catch(console.error);
