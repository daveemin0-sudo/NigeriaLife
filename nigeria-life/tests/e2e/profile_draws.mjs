// Dev profiling tool (not part of the suite): where do the street's draw calls come from?
// Stands the player on Broad Street, then hides each top-level group in turn and measures
// how many draw calls and triangles it was costing, with and without the shadow pass.
//   node tests/e2e/profile_draws.mjs [x z]
import { launch, open, closeDialogs, wait } from './lib.mjs';

const [x = 0, z = 5] = process.argv.slice(2).map(Number);

const browser = await launch();
const ctx = await browser.createBrowserContext();
const { page } = await open(ctx, { settle: 3500 });
await closeDialogs(page);
await page.evaluate(({ x, z }) => { const p = window.game.player; p.stopMoving(); p.mesh.position.set(x, 0, z); }, { x, z });
await page.evaluate(() => window.game.advance(0.5));
await wait(500);

const report = await page.evaluate(() => {
  const g = window.game;
  const r = g.renderer;
  const cam = g.cameraManager.camera;
  r.info.autoReset = false;
  const measure = () => { r.info.reset(); r.render(g.scene, cam); return { calls: r.info.render.calls, tris: r.info.render.triangles }; };

  const nameOf = (o, i) => o.name || `${o.type}#${i}`;
  const all = measure();
  const shadowWas = r.shadowMap.enabled;
  r.shadowMap.enabled = false;
  const noShadow = measure();
  r.shadowMap.enabled = shadowWas;

  // Candidate groups: scene children, plus the world's children one level down
  const groups = [];
  g.scene.children.forEach((c, i) => groups.push({ label: `scene/${nameOf(c, i)}`, obj: c }));
  for (const c of g.scene.children) {
    if (c.children.length > 8) c.children.forEach((cc, i) => groups.push({ label: `scene/${nameOf(c, 0)}/${nameOf(cc, i)}`, obj: cc }));
  }

  const rows = [];
  for (const { label, obj } of groups) {
    if (!obj.visible) continue;
    let meshes = 0, shadowCasters = 0, instanced = 0;
    obj.traverse((m) => { if (m.isMesh) { meshes++; if (m.castShadow) shadowCasters++; if (m.isInstancedMesh) instanced++; } });
    obj.visible = false;
    const without = measure();
    obj.visible = true;
    const cost = all.calls - without.calls;
    if (cost > 20) rows.push({ label, drawCost: cost, triCost: all.tris - without.tris, meshes, shadowCasters, instanced });
  }
  rows.sort((a, b) => b.drawCost - a.drawCost);

  const lights = [];
  g.scene.traverse((o) => { if (o.isLight && o.visible) lights.push({ type: o.type, shadow: !!o.castShadow, size: o.shadow?.mapSize?.x }); });
  r.info.autoReset = true;
  return {
    all, noShadow,
    pixelRatio: r.getPixelRatio(), size: [r.domElement.width, r.domElement.height],
    shadowType: r.shadowMap.type, lights, rows: rows.slice(0, 30),
  };
});

console.log(JSON.stringify(report, null, 2));
await browser.close();
