// Measures how the legs really stand and how low the hands hang, in the game's own pose, for build_ubc.mjs.
//
// The build shapes garments on the T-pose body, but the game brings the legs in and the arms down (Posture.ts), so a
// skirt shaped on the T-pose legs would stand wider than the real legs and swallow the hands hanging beside them. This
// records, relative to the pelvis, in height bands and directions round it, how far the legs reach when standing, and
// the height of the fingertips. Nothing in the game changes.
//
//   GAME_URL=http://localhost:<port>/NigeriaLife/ node tools/characters/measure_hand_room.mjs
import fs from 'node:fs';
import { launch, newPlayer, open, closeDialogs } from '../../tests/e2e/lib.mjs';

const OUT = new URL('./hand_room.json', import.meta.url);
const TOP = 0.16, BOTTOM = -0.56, STEP = 0.02, BINS = 48;
const guard = setTimeout(() => { console.log('timed out'); process.exit(3); }, 300000);
const browser = await launch();
const ctx = await newPlayer(browser);
const { page } = await open(ctx, { w: 1366, h: 768 });
await closeDialogs(page);
const room = await page.evaluate(async (TOP, BOTTOM, STEP, BINS) => {
  const g = window.game, THREE = g.modules.THREE, api = g.modules.SkinnedCharacterApi;
  const rows = Math.round((TOP - BOTTOM) / STEP);
  const out = { top: TOP, step: STEP, bins: BINS, rows };
  for (const gender of ['female', 'male']) {
    await api.LookPreview.shootClothes({ gender }, 0, 'full', (root) => api.applyStreetLook(root, { gender, outfit: 'casual_tee', bottom: 'chinos' }), 'idle');
    const handle = await api.LookPreview.models[gender];
    const root = handle.root;
    const meshes = [];
    let pelvis = null;
    root.traverse((o) => {
      if (o.isSkinnedMesh && /^Body_c/.test(o.name)) meshes.push(o);
      if (o.isBone && o.name === 'pelvis') pelvis = o;
    });
    const parts = meshes.map((m) => {
      const si = m.geometry.getAttribute('skinIndex'), sw = m.geometry.getAttribute('skinWeight'), bones = m.skeleton.bones, hand = [], leg = [];
      for (const i of new Set(m.geometry.index.array)) {
        let b = 0;
        for (let k = 1; k < 4; k++) if (sw.getComponent(i, k) > sw.getComponent(i, b)) b = k;
        const n = bones[si.getComponent(i, b)]?.name ?? '';
        if (/^(hand_|index|middle|pinky|ring|thumb)/.test(n)) hand.push(i);
        else if (/^(thigh|calf|pelvis)/.test(n)) leg.push(i);
      }
      return { m, hand, leg };
    });
    const grid = () => Array.from({ length: rows }, () => new Array(BINS).fill(null));
    const legs = grid();
    let fingertip = Infinity;
    const v = new THREE.Vector3(), c = new THREE.Vector3(), inv = new THREE.Matrix4();
    const cell = (p) => {
      const row = Math.floor((TOP - p.y) / STEP);
      if (row < 0 || row >= rows) return null;
      return [row, Math.floor(((Math.atan2(p.z, p.x) + Math.PI) / (2 * Math.PI)) * BINS) % BINS, Math.hypot(p.x, p.z)];
    };
    const sample = () => {
      root.updateMatrixWorld(true);
      inv.copy(meshes[0].matrixWorld).invert();
      c.setFromMatrixPosition(pelvis.matrixWorld).applyMatrix4(inv);
      for (const { m, hand, leg } of parts) {
        for (const i of hand) { m.getVertexPosition(i, v).sub(c); fingertip = Math.min(fingertip, v.y); }
        for (const i of leg) { m.getVertexPosition(i, v).sub(c); const q = cell(v); if (q) legs[q[0]][q[1]] = Math.max(legs[q[0]][q[1]] ?? 0, q[2]); }
      }
    };
    handle.play('idle', 0);
    for (let f = 0; f < 8; f++) { handle.update(0.25); sample(); }
    const pack = (m) => m.map((r) => r.map((x) => (x === null ? null : +x.toFixed(3))));
    out[gender] = { legs: pack(legs), fingertip: +fingertip.toFixed(3) };
  }
  return out;
}, TOP, BOTTOM, STEP, BINS);
fs.writeFileSync(OUT, `${JSON.stringify(room)}\n`);
console.log('wrote hand_room.json', fs.statSync(OUT).size, 'bytes');
clearTimeout(guard);
setTimeout(() => process.exit(0), 1200);
browser.close().catch(() => {});
