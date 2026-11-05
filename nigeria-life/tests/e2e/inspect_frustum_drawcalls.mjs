import { launch, open, closeDialogs } from './lib.mjs';

async function main() {
  const browser = await launch();
  const ctx = await browser.createBrowserContext();
  const { page } = await open(ctx);
  await closeDialogs(page);

  const drawCallAnalysis = await page.evaluate(() => {
    const g = window.game;
    const renderer = g.renderer;
    const scene = g.scene;
    const camera = g.cameraManager.camera;

    // Track which objects get rendered by overriding onBeforeRender on meshes
    const renderedGroups = {};
    const renderedMaterials = {};
    const shadowRendered = {};

    let currentPass = 'color';

    // Hook WebGLRenderer render
    const origRender = renderer.render.bind(renderer);
    
    // We can inspect the frustum culled visible objects
    const frustum = new THREE.Frustum();
    const projScreenMatrix = new THREE.Matrix4();
    projScreenMatrix.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
    frustum.setFromProjectionMatrix(projScreenMatrix);

    let inFrustumCount = 0;
    let outFrustumCount = 0;
    let culledByLayer = 0;
    let culledByVisible = 0;
    const inFrustumByOwner = {};

    scene.traverse((obj) => {
      if (obj.isMesh || obj.isInstancedMesh) {
        if (!obj.visible) {
          culledByVisible++;
          return;
        }
        // Check layer mask
        if ((obj.layers.mask & camera.layers.mask) === 0) {
          culledByLayer++;
          return;
        }

        if (obj.geometry) {
          if (!obj.geometry.boundingSphere) {
            obj.geometry.computeBoundingSphere();
          }
          const sphere = obj.geometry.boundingSphere.clone().applyMatrix4(obj.matrixWorld);
          if (frustum.intersectsSphere(sphere)) {
            inFrustumCount++;
            let top = obj;
            while (top.parent && top.parent !== scene) top = top.parent;
            const key = top.name || top.constructor.name || 'unnamed';
            inFrustumByOwner[key] = (inFrustumByOwner[key] || 0) + 1;
          } else {
            outFrustumCount++;
          }
        }
      }
    });

    // Also check the shadow camera frustum!
    const shadowFrustum = new THREE.Frustum();
    const sun = g.world.sunLight;
    let inShadowFrustum = 0;
    const inShadowByOwner = {};
    if (sun && sun.shadow && sun.shadow.camera) {
      const shadowCam = sun.shadow.camera;
      const sMat = new THREE.Matrix4().multiplyMatrices(shadowCam.projectionMatrix, shadowCam.matrixWorldInverse);
      shadowFrustum.setFromProjectionMatrix(sMat);

      scene.traverse((obj) => {
        if ((obj.isMesh || obj.isInstancedMesh) && obj.castShadow && obj.visible) {
          if (obj.geometry) {
            if (!obj.geometry.boundingSphere) obj.geometry.computeBoundingSphere();
            const sphere = obj.geometry.boundingSphere.clone().applyMatrix4(obj.matrixWorld);
            if (shadowFrustum.intersectsSphere(sphere)) {
              inShadowFrustum++;
              let top = obj;
              while (top.parent && top.parent !== scene) top = top.parent;
              const key = top.name || top.constructor.name || 'unnamed';
              inShadowByOwner[key] = (inShadowByOwner[key] || 0) + 1;
            }
          }
        }
      });
    }

    return {
      totalCalls: renderer.info.render.calls,
      inFrustumCount,
      outFrustumCount,
      culledByLayer,
      culledByVisible,
      inFrustumByOwner,
      inShadowFrustum,
      inShadowByOwner,
    };
  });

  console.log('Draw Call Analysis:', JSON.stringify(drawCallAnalysis, null, 2));
  await browser.close();
}

main().catch(console.error);
