// Records the seated pose as the game really plays it, for add_seated.mjs.
//
// The seated shape of hanging cloth is solved against the posed body, so it needs the bones exactly where the game puts
// them: the sit clip, then the cloth rig. This stores, for each body, the skinning matrix of every joint of the cloth
// skin (the 65 shared joints, then the 8 cloth bones), and how far the thighs are raised. Nothing in the game changes.
//
//   GAME_URL=http://localhost:<port>/NigeriaLife/ node tools/characters/measure_seated_pose.mjs
import fs from 'node:fs';
import { launch, newPlayer, open, closeDialogs } from '../../tests/e2e/lib.mjs';

const OUT = new URL('./seated_pose.json', import.meta.url);
const guard = setTimeout(() => { console.log('timed out'); process.exit(3); }, 200000);
const browser = await launch();
const ctx = await newPlayer(browser);
const { page } = await open(ctx, { w: 1366, h: 768 });
await closeDialogs(page);
const pose = await page.evaluate(async () => {
  const g = window.game, THREE = g.modules.THREE, api = g.modules.SkinnedCharacterApi;
  const out = {};
  for (const gender of ['female', 'male']) {
    const look = { gender, outfit: 'casual_tee', bottom: 'maxi_skirt', shoes: 'sandals' };
    await api.LookPreview.shootClothes({ gender }, 0, 'full', (root) => api.applyStreetLook(root, look), 'sit');
    const handle = await api.LookPreview.models[gender];
    handle.update(0.22);
    const root = handle.root;
    root.updateMatrixWorld(true);
    let mesh = null;
    root.traverse((o) => { if (!mesh && o.isSkinnedMesh && !o.name.startsWith('LOD_') && o.skeleton.bones.some((b) => b.name === 'cloth_front')) mesh = o; });
    if (!mesh) throw new Error('no mesh on the cloth skin');
    const { bones, boneInverses } = mesh.skeleton;
    const m = new THREE.Matrix4();
    const S = [];
    for (let j = 0; j < bones.length; j++) {
      m.multiplyMatrices(mesh.bindMatrixInverse, bones[j].matrixWorld).multiply(boneInverses[j]).multiply(mesh.bindMatrix);
      S.push(m.elements.map((x) => +x.toFixed(6)));
    }
    const angle = (name) => {
      const hip = new THREE.Vector3().setFromMatrixPosition(root.getObjectByName(`thigh_${name}`).matrixWorld);
      const knee = new THREE.Vector3().setFromMatrixPosition(root.getObjectByName(`calf_${name}`).matrixWorld);
      const d = knee.sub(hip).normalize();
      return +Math.acos(Math.max(-1, Math.min(1, -d.y))).toFixed(3);
    };
    out[gender] = { joints: bones.map((b) => b.name), thighLift: [angle('l'), angle('r')], S };
  }
  return out;
});
fs.writeFileSync(OUT, JSON.stringify(pose));
for (const k of Object.keys(pose)) console.log(k, 'joints', pose[k].joints.length, 'thigh lift', pose[k].thighLift.join(' '));
clearTimeout(guard);
setTimeout(() => process.exit(0), 1200);
browser.close().catch(() => {});
