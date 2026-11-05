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

    const topLevelChildren = [];
    for (const child of scene.children) {
      let meshCount = 0;
      let vertexCount = 0;
      let shadowCasterCount = 0;
      let visible = child.visible;
      let layers = child.layers.mask;

      child.traverse((obj) => {
        if (obj.isMesh || obj.isInstancedMesh) {
          meshCount++;
          if (obj.castShadow) shadowCasterCount++;
          if (obj.geometry && obj.geometry.attributes && obj.geometry.attributes.position) {
            vertexCount += obj.geometry.attributes.position.count;
          }
        }
      });

      topLevelChildren.push({
        name: child.name || '(unnamed)',
        type: child.type,
        visible,
        layers,
        meshCount,
        shadowCasterCount,
        vertexCount
      });
    }

    return {
      totalDrawCalls: renderer.info.render.calls,
      totalTriangles: renderer.info.render.triangles,
      topLevelChildren
    };
  });

  console.log('Top level children breakdown:\n', JSON.stringify(breakdown, null, 2));
  await browser.close();
}

main().catch(console.error);
