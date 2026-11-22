// Extended garment geometry (clothing Stage 4.5): skirts, dresses and gowns, the iro and buba with a gele, ankara
// two-pieces, the agbada over its inner garments, kaftans, senator tops and traditional caps, as models of their own.
//
// 1. Each new garment on both bodies: its own model is worn (never trouser legs under a skirt or gown, never a top
//    under a dress), the agbada over a top and trousers, the iro with the buba and gele as three pieces; hair under
//    headwear hidden; every garment has a far-away copy; built in its usual cloth.
// 2. In motion: walking, running and sitting, the legs stay under hanging cloth (poke-through measured on the posed
//    model, vertex by vertex), and nothing of it floats off the body.
//    Hands stay outside it: each hand point against the nearest cloth surface and its outward side, so a hand resting
//    on a lap counts as on the cloth. Pictures of every garment in each motion are still looked at (SHOTS).
// 3. Customisation: colour, cloth, ankara print, thread and condition reach each new garment's materials; dressing in
//    all of them makes no new shader programs once each has been seen.
// 4. Saved outfits: an owambe outfit (peplum, pencil skirt, gele) saved, changed out of, worn again, and still there
//    after a reload, on the player's own model.
// 5. The street: the NPC wardrobe dresses people in the new garments (skirts, gowns, iro and buba, agbada), the near
//    models wear them and the far figures are baked with them.
// SHOTS=<dir> saves pictures (each garment standing, walking, running and sitting, close-ups) for the review page.
import fs from 'node:fs';
import path from 'node:path';
import { newPlayer, open, closeDialogs, wait, reload } from './lib.mjs';

const SHOTS = process.env.SHOTS || '';
function saveShot(name, dataUrl) {
  if (!SHOTS || !dataUrl) return;
  fs.mkdirSync(SHOTS, { recursive: true });
  fs.writeFileSync(path.join(SHOTS, `${name}.jpg`), Buffer.from(dataUrl.split(',')[1], 'base64'));
}
function saveJson(name, data) {
  if (!SHOTS) return;
  fs.mkdirSync(SHOTS, { recursive: true });
  fs.writeFileSync(path.join(SHOTS, `${name}.json`), JSON.stringify(data, null, 1));
}

// [name, kind of the new model, variant, the street look, bodies]
const LOOKS = [
  ['mini skirt', 'Skirt', 'mini', { outfit: 'casual_tee', outfitColor: 0xf43f5e, bottom: 'mini_skirt', trousersColor: 0x1e3a8a, shoes: 'sneakers' }, ['female', 'male']],
  ['knee skirt', 'Skirt', 'knee', { outfit: 'casual_blouse', outfitColor: 0xf8fafc, bottom: 'knee_skirt', trousersColor: 0x7f1d1d, shoes: 'heels' }, ['female', 'male']],
  ['maxi skirt', 'Skirt', 'maxi', { outfit: 'casual_blouse', outfitColor: 0x0f766e, bottom: 'maxi_skirt', trousersColor: 0xf5f0e6, shoes: 'sandals' }, ['female', 'male']],
  ['pleated skirt', 'Skirt', 'pleated', { outfit: 'polo_shirt', outfitColor: 0xf8fafc, bottom: 'pleated_skirt', trousersColor: 0x1e3a5f, shoes: 'sneakers' }, ['female', 'male']],
  ['pencil skirt', 'Skirt', 'pencil', { outfit: 'button_shirt', outfitColor: 0xdbeafe, bottom: 'pencil_skirt', trousersColor: 0x111827, shoes: 'heels' }, ['female', 'male']],
  ['iro and buba with gele', 'Skirt', 'iro', { outfit: 'buba', outfitColor: 0x1e3a8a, bottom: 'iro', trousersColor: 0x0d9488, hat: 'gele', hatColor: 0x1e3a8a, shoes: 'sandals', styles: { bottom: { colour: '#0d9488', pattern: { kind: 'ankara', colour2: '#f8fafc', colour3: '#facc15', scale: 1 } } } }, ['female', 'male']],
  ['sundress', 'Dress', 'sundress', { outfit: 'sundress', outfitColor: 0xfacc15, shoes: 'sandals' }, ['female', 'male']],
  ['evening gown', 'Dress', 'evening', { outfit: 'evening_gown', outfitColor: 0x7f1d1d, shoes: 'heels' }, ['female', 'male']],
  ['ankara gown', 'Dress', 'gown', { outfit: 'ankara_gown', outfitColor: 0xea580c, shoes: 'heels', hat: 'gele', hatColor: 0xea580c, styles: { top: { colour: '#ea580c', pattern: { kind: 'ankara', colour2: '#16a34a', colour3: '#facc15', scale: 1 } } } }, ['female', 'male']],
  ['ankara two-piece', 'Top_Short', 'peplum', { outfit: 'peplum_top', outfitColor: 0xdb2777, bottom: 'pencil_skirt', trousersColor: 0xdb2777, shoes: 'heels', styles: { top: { colour: '#db2777', pattern: { kind: 'ankara', colour2: '#fde68a', colour3: '#1d4ed8' } }, bottom: { colour: '#db2777', pattern: { kind: 'ankara', colour2: '#fde68a', colour3: '#1d4ed8' } } } }, ['female', 'male']],
  ['agbada with fila', 'Robe', 'agbada', { outfit: 'agbada', outfitColor: 0xf5f5f4, bottom: 'chinos', trousersColor: 0xf5f5f4, hat: 'fila', hatColor: 0x7f1d1d, shoes: 'loafers' }, ['male', 'female']],
  ['kaftan with kufi', 'Top_Long', 'kaftan', { outfit: 'kaftan', outfitColor: 0x1e3a8a, bottom: 'chinos', trousersColor: 0x1e3a8a, hat: 'kufi', hatColor: 0xf8fafc, shoes: 'sandals' }, ['male', 'female']],
  ['senator', 'Top_Long', 'senator', { outfit: 'senator', outfitColor: 0x7f1d1d, bottom: 'chinos', trousersColor: 0x7f1d1d, shoes: 'oxfords' }, ['male', 'female']],
];

export async function run(browser, check) {
  const ctx = await newPlayer(browser);
  const { page } = await open(ctx, { w: 1366, h: 768 });
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error' && /shader|program|webgl|glsl/i.test(m.text())) errors.push(m.text().slice(0, 240)); });
  await closeDialogs(page);

  // Helpers in the page: dress the preview's model, pose it, and measure what of the legs comes through hanging cloth
  const helpers = () => page.evaluate(() => {
    const g = window.game;
    const THREE = g.modules.THREE;
    const api = g.modules.SkinnedCharacterApi;
    window.__g45 = {
      async model(gender, look, clip = 'idle', focus = 'full', yaw = -0.35) {
        const url = await api.LookPreview.shootClothes({ gender }, yaw, focus, (root) => api.applyStreetLook(root, { gender, ...look }), clip);
        const handle = await api.LookPreview.models[gender];
        return { url, handle };
      },
      parts(root) {
        const shown = [];
        let hairShown = false;
        const lod = [];
        root.traverse((o) => {
          const name = /^(LOD_)?Outfit_/.test(o.parent?.name ?? '') ? o.parent.name : /^(LOD_)?Outfit_/.test(o.name) ? o.name : null;
          if (o.isMesh && name && !name.startsWith('LOD_') && o.visible && (o.parent?.visible ?? true)) shown.push(name);
          if (o.name.startsWith('LOD_Outfit_')) lod.push(o.name.slice(4));
          if (o.isMesh && /^Hair/.test(o.name) && o.visible) hairShown = true;
        });
        return { shown: [...new Set(shown)], hairShown, lod: [...new Set(lod)] };
      },
      fabrics(root, kindRe) {
        const out = [];
        root.traverse((o) => {
          const name = /^Outfit_/.test(o.parent?.name ?? '') ? o.parent.name : /^Outfit_/.test(o.name) ? o.name : '';
          if (o.isMesh && kindRe.test(name) && o.visible) for (const m of [].concat(o.material)) {
            const u = api.fabricUniforms(m);
            out.push({ name, material: m.name, fabric: m.userData.fabric, colour: m.color?.getHexString(), pat: u?.uPat?.value, dirt: u?.uDirt?.value });
          }
        });
        return out;
      },
      /**
       * Hands in the cloth: posed, each hand point is compared with the nearest surface of the hanging cloth and that
       * surface's outward side. A hand on a lap or against a skirt is on the outer side and does not count; only hand
       * points more than 15 mm inside the cloth do. Sleeves are left out (a hand comes out of its own sleeve).
       */
      hands(root, clothRe) {
        root.updateMatrixWorld(true);
        const v = new THREE.Vector3(), P = [], T = [], H = [];
        const main = (o, i) => {
          const si = o.geometry.getAttribute('skinIndex'), sw = o.geometry.getAttribute('skinWeight');
          let b = 0;
          for (let k = 1; k < 4; k++) if (sw.getComponent(i, k) > sw.getComponent(i, b)) b = k;
          return o.skeleton.bones[si.getComponent(i, b)]?.name ?? '';
        };
        root.traverse((o) => {
          if (!o.isSkinnedMesh || !o.visible || o.name.startsWith('LOD_') || o.parent?.name?.startsWith('LOD_')) return;
          const name = /^Outfit_/.test(o.parent?.name ?? '') ? o.parent.name : o.name;
          const pos = o.geometry.getAttribute('position');
          if (clothRe.test(name)) {
            const base = P.length / 3, keep = new Uint8Array(pos.count);
            for (let i = 0; i < pos.count; i++) {
              keep[i] = /^(upperarm|lowerarm|hand|clavicle|neck|Head)/.test(main(o, i)) ? 0 : 1;
              o.getVertexPosition(i, v);
              P.push(v.x, v.y, v.z);
            }
            const idx = o.geometry.index.array;
            for (let t = 0; t < idx.length; t += 3) if (keep[idx[t]] && keep[idx[t + 1]] && keep[idx[t + 2]]) T.push(base + idx[t], base + idx[t + 1], base + idx[t + 2]);
          } else if (/^Body_c/.test(name)) {
            for (const i of new Set(o.geometry.index.array)) {
              if (!/^(hand_|index|middle|pinky|ring|thumb)/.test(main(o, i))) continue;
              o.getVertexPosition(i, v);
              H.push(v.x, v.y, v.z);
            }
          }
        });
        const n = P.length / 3;
        if (!n || !H.length) return { hands: H.length / 3, deep: 0 };
        const N = new Float32Array(n * 3), on = new Uint8Array(n);
        for (let t = 0; t < T.length; t += 3) {
          const [a, b, c] = [T[t], T[t + 1], T[t + 2]];
          const ux = P[b * 3] - P[a * 3], uy = P[b * 3 + 1] - P[a * 3 + 1], uz = P[b * 3 + 2] - P[a * 3 + 2];
          const wx = P[c * 3] - P[a * 3], wy = P[c * 3 + 1] - P[a * 3 + 1], wz = P[c * 3 + 2] - P[a * 3 + 2];
          const fx = uy * wz - uz * wy, fy = uz * wx - ux * wz, fz = ux * wy - uy * wx;
          for (const i of [a, b, c]) { N[i * 3] += fx; N[i * 3 + 1] += fy; N[i * 3 + 2] += fz; on[i] = 1; }
        }
        const CELL = 0.035, grid = new Map(), key = (x, y, z) => `${x},${y},${z}`;
        for (let i = 0; i < n; i++) if (on[i]) { const k = key(Math.floor(P[i * 3] / CELL), Math.floor(P[i * 3 + 1] / CELL), Math.floor(P[i * 3 + 2] / CELL)); (grid.get(k) ?? grid.set(k, []).get(k)).push(i); }
        let deep = 0;
        for (let h = 0; h < H.length; h += 3) {
          const x = H[h], y = H[h + 1], z = H[h + 2], cx = Math.floor(x / CELL), cy = Math.floor(y / CELL), cz = Math.floor(z / CELL);
          let best = -1, bd = Infinity;
          for (let reach = 1; reach <= 4 && best < 0; reach++) for (let a = -reach; a <= reach; a++) for (let b = -reach; b <= reach; b++) for (let c = -reach; c <= reach; c++) {
            for (const i of grid.get(key(cx + a, cy + b, cz + c)) ?? []) { const d = (P[i * 3] - x) ** 2 + (P[i * 3 + 1] - y) ** 2 + (P[i * 3 + 2] - z) ** 2; if (d < bd) { bd = d; best = i; } }
          }
          if (best < 0) continue;
          const l = Math.hypot(N[best * 3], N[best * 3 + 1], N[best * 3 + 2]) || 1;
          if (((x - P[best * 3]) * N[best * 3] + (y - P[best * 3 + 1]) * N[best * 3 + 1] + (z - P[best * 3 + 2]) * N[best * 3 + 2]) / l < -0.015) deep++;
        }
        return { hands: H.length / 3, deep };
      },
      /**
       * Legs through cloth. Which leg points the garment is meant to cover is decided on the standing model, where a
       * garment is as cut: above its hem in that direction (by 4 cm) and below the top of its hanging part there (by 6 cm). A knee beyond a
       * short hem is therefore not counted, however the leg is posed, nor is a leg point lower than all the posed cloth
       * in its direction (below the hem as it hangs now); a thigh or knee under the cloth always is, drawn or hidden (a
       * hidden leg left uncovered is a hole). Then, posed: from each such point, looking outward along its own
       * surface (sideways for a point facing the ground, which no camera sees from below), is there hanging cloth within
       * 50 cm (the chest of a tunic above a lap does not count for a thigh or knee; a point of the hips may instead lie
       * within 10 cm under the garment's own bodice or the top worn with it, or under the belly folded over it when
       * seated, as the top of a thigh at the groin also can be), or the legs or hips themselves in the way? If neither, that point is out in the open by more than 1 cm: through the fabric,
       * or the fabric has left it.
       */
      poke(root, clothRe) {
        root.updateMatrixWorld(true);
        const v = new THREE.Vector3(), w = new THREE.Vector3();
        const P = [], T = [], R = [], legs = [], B = [], UP = [], UT = [];
        let centre = null, posedCentre = null;
        const main = (o, i) => {
          const si = o.geometry.getAttribute('skinIndex'), sw = o.geometry.getAttribute('skinWeight');
          let b = 0;
          for (let k = 1; k < 4; k++) if (sw.getComponent(i, k) > sw.getComponent(i, b)) b = k;
          return o.skeleton.bones[si.getComponent(i, b)]?.name ?? '';
        };
        root.traverse((o) => {
          if (!o.isSkinnedMesh || o.name.startsWith('LOD_') || o.parent?.name?.startsWith('LOD_')) return;
          const name = /^Outfit_/.test(o.parent?.name ?? '') ? o.parent.name : o.name;
          const isCloth = o.visible && clothRe.test(name), isBody = /^Body_c/.test(name), isTrouser = o.visible && /^Outfit_Bottom/.test(name);
          // What is worn on the body above the hips, for the points up there (not its sleeves)
          if (o.visible && (o.parent?.visible ?? true) && /^Outfit_(Top|Dress|Robe)/.test(name)) {
            const up = o.geometry.getAttribute('position'), idx = o.geometry.index.array, base = UP.length / 3, body = new Uint8Array(up.count);
            for (let i = 0; i < up.count; i++) { body[i] = /^(upperarm|lowerarm|hand|clavicle|neck|Head)/.test(main(o, i)) ? 0 : 1; o.getVertexPosition(i, v); UP.push(v.x, v.y, v.z); }
            for (let t = 0; t < idx.length; t += 3) if (body[idx[t]] && body[idx[t + 1]] && body[idx[t + 2]]) UT.push(base + idx[t], base + idx[t + 1], base + idx[t + 2]);
          }
          if (!isCloth && !isBody && !isTrouser) return;
          if (!centre) {
            const at = o.skeleton.bones.findIndex((b) => b.name === 'pelvis');
            centre = new THREE.Vector3().setFromMatrixPosition(o.skeleton.boneInverses[at].clone().invert());
            posedCentre = new THREE.Vector3().setFromMatrixPosition(o.skeleton.bones[at].matrixWorld).applyMatrix4(o.bindMatrixInverse);
          }
          const pos = o.geometry.getAttribute('position'), nor = o.geometry.getAttribute('normal');
          if (isCloth) {
            const base = P.length / 3, keep = new Uint8Array(pos.count);
            for (let i = 0; i < pos.count; i++) {
              keep[i] = /^(upperarm|lowerarm|hand|clavicle|neck|Head)/.test(main(o, i)) ? 0 : 1;
              o.getVertexPosition(i, v);
              P.push(v.x, v.y, v.z);
              R.push(pos.getX(i), pos.getY(i), pos.getZ(i), keep[i]);
            }
            const idx = o.geometry.index.array;
            const hanging = (k) => keep[k] && pos.getY(k) < centre.y + 0.12;
            for (let t = 0; t < idx.length; t += 3) if (hanging(idx[t]) && hanging(idx[t + 1]) && hanging(idx[t + 2])) T.push(base + idx[t], base + idx[t + 1], base + idx[t + 2]);
          } else {
            if (isBody) for (let i = 0; i < pos.count; i++) {
              const bone = main(o, i), trunk = /^spine/.test(bone);
              if (!trunk && !/^(thigh|calf|pelvis)/.test(bone)) continue;
              o.getVertexPosition(i, v);
              B.push(v.x, v.y, v.z, trunk ? 2 : 1);
            }
            for (let i = 0; i < pos.count; i += 2) {
              if (!/^(thigh|calf|pelvis)/.test(main(o, i))) continue;
              o.getVertexPosition(i, v);
              w.set(pos.getX(i) + nor.getX(i) * 0.02, pos.getY(i) + nor.getY(i) * 0.02, pos.getZ(i) + nor.getZ(i) * 0.02);
              o.applyBoneTransform(i, w);
              w.sub(v).normalize();
              legs.push({ x: v.x, y: v.y, z: v.z, nx: w.x, ny: w.y, nz: w.z, rx: pos.getX(i), ry: pos.getY(i), rz: pos.getZ(i), hip: /^pelvis/.test(main(o, i)) });
            }
          }
        });
        const count = P.length / 3;
        if (!count || !T.length) return { cloth: 0, points: new Float32Array(0) };
        // What the garment covers, on the standing model
        const BINS = 36, lo = new Float32Array(BINS).fill(Infinity), hi = new Float32Array(BINS).fill(-Infinity);
        const binOf = (x, z) => Math.floor(((Math.atan2(z - centre.z, x - centre.x) + Math.PI) / (2 * Math.PI)) * BINS) % BINS;
        for (let i = 0; i < count; i++) {
          if (!R[i * 4 + 3]) continue;
          const b = binOf(R[i * 4], R[i * 4 + 2]);
          lo[b] = Math.min(lo[b], R[i * 4 + 1]);
          hi[b] = Math.max(hi[b], R[i * 4 + 1]);
        }
        // How low the cloth hangs now, in each direction round the hips
        const hem = new Float32Array(BINS).fill(Infinity);
        const posedBin = (x, z) => Math.floor(((Math.atan2(z - posedCentre.z, x - posedCentre.x) + Math.PI) / (2 * Math.PI)) * BINS) % BINS;
        for (let i = 0; i < count; i++) if (R[i * 4 + 3]) { const b = posedBin(P[i * 3], P[i * 3 + 2]); hem[b] = Math.min(hem[b], P[i * 3 + 1]); }
        // The posed cloth as a thin shell in a grid
        const CELL = 0.006, box = [Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity];
        for (let i = 0; i < count; i++) for (let k = 0; k < 3; k++) { box[k] = Math.min(box[k], P[i * 3 + k]); box[k + 3] = Math.max(box[k + 3], P[i * 3 + k]); }
        const nx = Math.ceil((box[3] - box[0]) / CELL) + 3, ny = Math.ceil((box[4] - box[1]) / CELL) + 3, nz = Math.ceil((box[5] - box[2]) / CELL) + 3;
        const grid = new Uint8Array(nx * ny * nz);
        const mark = (x, y, z) => {
          const a = Math.floor((x - box[0]) / CELL) + 1, b = Math.floor((y - box[1]) / CELL) + 1, c = Math.floor((z - box[2]) / CELL) + 1;
          const at = a + nx * (b + ny * c);
          grid[at] = 1; grid[at - 1] = 1; grid[at + 1] = 1; grid[at - nx] = 1; grid[at + nx] = 1; grid[at - nx * ny] = 1; grid[at + nx * ny] = 1;
        };
        for (let t = 0; t < T.length; t += 3) {
          const a = T[t] * 3, b = T[t + 1] * 3, c = T[t + 2] * 3;
          const edge = Math.max(Math.hypot(P[a] - P[b], P[a + 1] - P[b + 1], P[a + 2] - P[b + 2]), Math.hypot(P[b] - P[c], P[b + 1] - P[c + 1], P[b + 2] - P[c + 2]), Math.hypot(P[c] - P[a], P[c + 1] - P[a + 1], P[c + 2] - P[a + 2]));
          const steps = Math.min(40, Math.ceil(edge / (CELL * 0.8)));
          for (let u = 0; u <= steps; u++) for (let q = 0; q <= steps - u; q++) {
            const f = u / steps, g = q / steps, h = 1 - f - g;
            mark(P[a] * h + P[b] * f + P[c] * g, P[a + 1] * h + P[b + 1] * f + P[c + 1] * g, P[a + 2] * h + P[b + 2] * f + P[c + 2] * g);
          }
        }
        const hit = (x, y, z) => {
          const a = Math.floor((x - box[0]) / CELL) + 1, b = Math.floor((y - box[1]) / CELL) + 1, c = Math.floor((z - box[2]) / CELL) + 1;
          return a >= 0 && b >= 0 && c >= 0 && a < nx && b < ny && c < nz && grid[a + nx * (b + ny * c)] === 1;
        };
        // The same shell of what is worn above the hips
        const ub = [Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity];
        for (let i = 0; i < UP.length; i += 3) for (let k = 0; k < 3; k++) { ub[k] = Math.min(ub[k], UP[i + k]); ub[k + 3] = Math.max(ub[k + 3], UP[i + k]); }
        const ux = Math.ceil((ub[3] - ub[0]) / CELL) + 3, uy = Math.ceil((ub[4] - ub[1]) / CELL) + 3, uz = Math.ceil((ub[5] - ub[2]) / CELL) + 3;
        const upper = UT.length ? new Uint8Array(ux * uy * uz) : null;
        if (upper) for (let t = 0; t < UT.length; t += 3) {
          const a = UT[t] * 3, b = UT[t + 1] * 3, c = UT[t + 2] * 3;
          const edge = Math.max(Math.hypot(UP[a] - UP[b], UP[a + 1] - UP[b + 1], UP[a + 2] - UP[b + 2]), Math.hypot(UP[b] - UP[c], UP[b + 1] - UP[c + 1], UP[b + 2] - UP[c + 2]), Math.hypot(UP[c] - UP[a], UP[c + 1] - UP[a + 1], UP[c + 2] - UP[a + 2]));
          const steps = Math.min(40, Math.ceil(edge / (CELL * 0.8)));
          for (let e = 0; e <= steps; e++) for (let q = 0; q <= steps - e; q++) {
            const f = e / steps, g = q / steps, h = 1 - f - g;
            const at = Math.floor((UP[a] * h + UP[b] * f + UP[c] * g - ub[0]) / CELL) + 1 + ux * (Math.floor((UP[a + 1] * h + UP[b + 1] * f + UP[c + 1] * g - ub[1]) / CELL) + 1 + uy * (Math.floor((UP[a + 2] * h + UP[b + 2] * f + UP[c + 2] * g - ub[2]) / CELL) + 1));
            upper[at] = 1; upper[at - 1] = 1; upper[at + 1] = 1; upper[at - ux] = 1; upper[at + ux] = 1; upper[at - ux * uy] = 1; upper[at + ux * uy] = 1;
          }
        }
        const underTop = (x, y, z) => {
          if (!upper) return false;
          const a = Math.floor((x - ub[0]) / CELL) + 1, b = Math.floor((y - ub[1]) / CELL) + 1, c = Math.floor((z - ub[2]) / CELL) + 1;
          return a >= 0 && b >= 0 && c >= 0 && a < ux && b < uy && c < uz && upper[a + ux * (b + uy * c)] === 1;
        };
        // The body, coarsely: what a line from a leg point runs into before it gets outside
        const SOLID = 0.014, sb = [Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity];
        for (let i = 0; i < B.length; i += 4) for (let k = 0; k < 3; k++) { sb[k] = Math.min(sb[k], B[i + k]); sb[k + 3] = Math.max(sb[k + 3], B[i + k]); }
        const sx = Math.ceil((sb[3] - sb[0]) / SOLID) + 3, sy = Math.ceil((sb[4] - sb[1]) / SOLID) + 3, sz = Math.ceil((sb[5] - sb[2]) / SOLID) + 3;
        const solid = new Uint8Array(sx * sy * sz);
        // 1: legs and hips, which block any line; 2: the trunk, which only a point of the hips can lie under
        for (let i = 0; i < B.length; i += 4) {
          const at = Math.floor((B[i] - sb[0]) / SOLID) + 1 + sx * (Math.floor((B[i + 1] - sb[1]) / SOLID) + 1 + sy * (Math.floor((B[i + 2] - sb[2]) / SOLID) + 1));
          for (const c of [at, at - 1, at + 1, at - sx, at + sx, at - sx * sy, at + sx * sy]) solid[c] = solid[c] === 1 || B[i + 3] === 1 ? 1 : 2;
        }
        const inBody = (x, y, z) => {
          const a = Math.floor((x - sb[0]) / SOLID) + 1, b = Math.floor((y - sb[1]) / SOLID) + 1, c = Math.floor((z - sb[2]) / SOLID) + 1;
          return a >= 0 && b >= 0 && c >= 0 && a < sx && b < sy && c < sz ? solid[a + sx * (b + sy * c)] : 0;
        };
        let inRange = 0, out = 0;
        for (const l of legs) {
          const b = binOf(l.rx, l.rz);
          if (l.ry < lo[b] + 0.04 || l.ry > Math.min(hi[b], centre.y + 0.12) - 0.06) continue;
          if (l.y < hem[posedBin(l.x, l.z)]) continue;
          let dx = l.nx, dy = l.ny, dz = l.nz;
          if (dy < 0) {
            dy = 0;
            const flat = Math.hypot(dx, dz);
            if (flat < 0.05) continue; // straight down: nothing to judge it by
            dx /= flat; dz /= flat;
          }
          inRange++;
          let covered = false;
          for (let d = -0.004; d < 0.5 && !covered; d += 0.003) {
            const px = l.x + dx * d, py = l.y + dy * d, pz = l.z + dz * d;
            covered = hit(px, py, pz) || (l.hip && d < 0.1 && underTop(px, py, pz));
            if (!covered && d > 0.035) { const s = inBody(px, py, pz); covered = s === 1 || (s === 2 && (l.hip || d < 0.1)); }
          }
          // Inside the garment: worn cloth all round it at its own height (a thigh through a lap has open air beside it)
          if (!covered) {
            let round = 0;
            for (let k = 0; k < 8; k++) {
              const ax = Math.cos((k * Math.PI) / 4), az = Math.sin((k * Math.PI) / 4);
              for (let e = 0; e < 0.3; e += 0.003) if (hit(l.x + ax * e, l.y, l.z + az * e) || underTop(l.x + ax * e, l.y, l.z + az * e)) { round++; break; }
            }
            covered = round >= 7;
          }
          if (!covered) out++;
        }
        const legPoints = new Float32Array(legs.length * 3);
        legs.forEach((l, i) => { legPoints[i * 3] = l.x; legPoints[i * 3 + 1] = l.y; legPoints[i * 3 + 2] = l.z; });
        return { cloth: count, legs: inRange, out, share: inRange ? out / inRange : 0, points: Float32Array.from(P), legPoints };
      },
    };
  });

  await helpers();

  // ------------------------------------------------------------------ 1. Each garment on both bodies
  const fit = await page.evaluate(async (LOOKS) => {
    const g = window.game;
    const choices = g.modules.ClothingStyleApi.FABRIC_CHOICES;
    const rows = [];
    for (const [name, kind, variant, look, bodies] of LOOKS) {
      for (const gender of bodies) {
        const { handle } = await window.__g45.model(gender, look);
        const parts = window.__g45.parts(handle.root);
        const want = `Outfit_${kind}__${variant}`;
        const fabrics = window.__g45.fabrics(handle.root, new RegExp(`^${want}$`));
        rows.push({
          name, gender, want, plainTop: gender === 'female' && /^(agbada|kaftan|senator)$/.test(variant), shown: parts.shown, hairShown: parts.hairShown,
          worn: parts.shown.includes(want),
          trouserLegs: parts.shown.filter((s) => /^Outfit_Bottom/.test(s)),
          tops: parts.shown.filter((s) => /^Outfit_Top/.test(s)),
          lod: parts.lod.includes(want),
          builtFabric: fabrics[0]?.fabric, usual: choices[variant]?.[0],
        });
      }
    }
    return rows;
  }, LOOKS);
  const fitBad = fit.filter((r) => {
    // Not cut for this body: the plain long-sleeved top stands in, with the trousers, and the garment itself is not drawn
    if (r.plainTop) return r.worn || !r.tops.includes('Outfit_Top_Long') || r.tops.length !== 1 || !r.trouserLegs.length || r.shown.some((s) => /^Outfit_Robe/.test(s));
    if (!r.worn || !r.lod || r.builtFabric !== r.usual) return true;
    if (/Skirt|Dress/.test(r.want) && r.trouserLegs.length) return true;
    if (/Dress/.test(r.want) && r.tops.length) return true;
    if (/Robe/.test(r.want) && (!r.tops.length || !r.trouserLegs.length)) return true;
    if (/iro/.test(r.want) && !(r.shown.includes('Outfit_Top_Short__buba') && r.shown.includes('Outfit_Hat__gele') && !r.hairShown)) return true;
    return false;
  });
  saveJson('fit', fit);
  check('garments45: every new garment is its own model on both bodies (no trouser legs under skirts or gowns, no top under a dress; the agbada over a top and trousers; iro, buba and gele as three pieces with the hair under the gele), each with a far-away copy, built in its usual cloth',
    fit.length === LOOKS.length * 2 && fitBad.length === 0, { bad: fitBad.map((r) => ({ name: r.name, gender: r.gender, worn: r.worn, lod: r.lod, legs: r.trouserLegs, tops: r.tops, fabric: [r.builtFabric, r.usual] })) });

  // ------------------------------------------------------------------ 2. In motion: legs stay under hanging cloth
  const motion = await page.evaluate(async (LOOKS) => {
    const out = [];
    for (const [name, kind, variant, look, bodies] of LOOKS) {
      const gender = bodies[0];
      const clothRe = new RegExp(`^Outfit_(${kind === 'Top_Short' ? 'Skirt' : kind})__(${kind === 'Top_Short' ? 'pencil' : variant})$`);
      const row = { name, gender };
      for (const clip of ['idle', 'walk', 'run', 'sit']) {
        const { handle } = await window.__g45.model(gender, look, clip);
        let worst = 0, legs = 0, out2 = 0;
        // Several moments of each clip
        for (let k = 0; k < (clip === 'idle' || clip === 'sit' ? 2 : 8); k++) {
          handle.update(0.11);
          const m = window.__g45.poke(handle.root, clothRe);
          legs += m.legs ?? 0;
          out2 += m.out ?? 0;
          worst = Math.max(worst, m.share ?? 0);
        }
        row[clip] = { share: legs ? +(out2 / legs).toFixed(4) : 0, worst: +worst.toFixed(4), legs };
      }
      // Sitting down and standing up, frame by frame as the game blends them: legs still covered, and no jump in the
      // cloth: from the frame before the change, the furthest any cloth point moves in a frame, beyond the furthest any
      // leg point moves in that frame (the everyday stance can move the whole body in one frame; cloth going with it is
      // not a jump in the cloth)
      const moved = (a, b) => { let m = 0; for (let i = 0; i < a.length; i += 3) m = Math.max(m, (a[i] - b[i]) ** 2 + (a[i + 1] - b[i + 1]) ** 2 + (a[i + 2] - b[i + 2]) ** 2); return Math.sqrt(m); };
      for (const [key, from, to] of [['sitDown', 'idle', 'sit'], ['standUp', 'sit', 'idle']]) {
        const { handle } = await window.__g45.model(gender, look, from);
        handle.update(0.4);
        handle.play(to, 0.3);
        const first = window.__g45.poke(handle.root, clothRe);
        let last = first.points, lastLegs = first.legPoints, legs = 0, off = 0, step = 0, bodyStep = 0;
        for (let f = 0; f < 16; f++) {
          handle.update(1 / 30);
          const m = window.__g45.poke(handle.root, clothRe);
          legs += m.legs ?? 0;
          off += m.out ?? 0;
          const body = moved(m.legPoints, lastLegs);
          bodyStep = Math.max(bodyStep, body);
          step = Math.max(step, moved(m.points, last) - body);
          last = m.points;
          lastLegs = m.legPoints;
        }
        row[key] = { share: legs ? +(off / legs).toFixed(4) : 0, legs, step: +Math.max(0, step).toFixed(3), bodyStep: +bodyStep.toFixed(3) };
      }
      // The control: the same seated pose with the cloth left hanging as if standing. The thighs then really are through
      // it, so a measurement that cannot see that is broken (it must read at least 5%, and twice the garment's own reading;
      // a short tunic reads lowest, since the top of the thigh stays inside it even hanging)
      {
        const { handle } = await window.__g45.model(gender, look, 'sit');
        handle.update(0.2);
        handle.root.traverse((o) => {
          if (o.isBone && /^cloth_/.test(o.name)) o.quaternion.identity();
          if (o.isMesh && o.morphTargetDictionary?.Seated !== undefined) o.morphTargetInfluences[o.morphTargetDictionary.Seated] = 0;
        });
        const m = window.__g45.poke(handle.root, clothRe);
        row.control = +(m.share ?? 0).toFixed(4);
        handle.update(0);
      }
      out.push(row);
    }
    return out;
  }, LOOKS);
  saveJson('motion', motion);
  const limits = { idle: 0.01, walk: 0.03, run: 0.06, sit: 0.08 };
  // How much further than the legs any cloth point may move in one frame while sitting down or standing up
  const STEP_LIMIT = 0.2;
  const motionBad = motion.filter((r) => Object.entries(limits).some(([clip, lim]) => r[clip].share > lim)
    || r.sitDown.share > limits.sit || r.standUp.share > limits.sit || r.sitDown.step > STEP_LIMIT || r.standUp.step > STEP_LIMIT || r.control < 0.05 || r.control <= 2 * r.sit.share);
  check('garments45: standing, walking, running, sitting and in the sit-to-stand blends, the legs a garment covers stay under it (coming through on average under 1% standing, 3% walking, 6% running, 8% sitting and blending, no jump in the cloth, and the cloth left hanging on a seated body is caught)',
    motion.length === LOOKS.length && motionBad.length === 0 && motion.every((r) => r.walk.legs > 0 && r.sit.legs > 0), { bad: motionBad, all: motion.map((r) => `${r.name}: idle ${r.idle.share} walk ${r.walk.share} run ${r.run.share} sit ${r.sit.share} sitDown ${r.sitDown.share}/${r.sitDown.step} standUp ${r.standUp.share}/${r.standUp.step} control ${r.control} bodyJump ${r.standUp.bodyStep}`) });

  // ------------------------------------------------------------------ 2b. Hands: outside the cloth, on the bodies each garment is for
  const handRows = await page.evaluate(async (LOOKS) => {
    const HANG = /^Outfit_(Skirt|Dress|Robe)__|^Outfit_Top_Short__(buba|peplum)$|^Outfit_Top_Long__(kaftan|senator)$/;
    const measure = async (gender, look, re) => {
      const row = {};
      for (const clip of ['idle', 'walk', 'run', 'sit']) {
        const { handle } = await window.__g45.model(gender, look, clip);
        let deep = 0, hands = 0;
        for (let k = 0; k < (clip === 'idle' || clip === 'sit' ? 2 : 6); k++) { handle.update(0.13); const m = window.__g45.hands(handle.root, re); deep += m.deep; hands += m.hands; }
        row[clip] = hands ? +(deep / hands).toFixed(3) : 0;
      }
      return row;
    };
    const rows = [];
    // The comparison: how far hands already go into ordinary trousers
    for (const gender of ['female', 'male']) rows.push({ name: 'chinos (existing)', gender, baseline: true, ...(await measure(gender, { outfit: 'casual_tee', bottom: 'chinos', trousersColor: 0x334155, shoes: 'sneakers' }, /^Outfit_Bottom_/)) });
    for (const [name, , , look, bodies] of LOOKS) rows.push({ name, gender: bodies[0], ...(await measure(bodies[0], look, HANG)) });
    return rows;
  }, LOOKS);
  saveJson('hands', handRows);
  const handLimits = { idle: 0.1, walk: 0.2, run: 0.05, sit: 0.3 };
  const handBad = handRows.filter((r) => !r.baseline && Object.entries(handLimits).some(([clip, lim]) => r[clip] > lim));
  check('garments45: hands stay out of skirts, gowns, tunics and the agbada on the body each is for (hand points over 15 mm inside the cloth: under 10% standing, 20% walking, 5% running, 30% sitting, where a hand on the lap is on the cloth and does not count)',
    handRows.length === LOOKS.length + 2 && handBad.length === 0, { bad: handBad, all: handRows.map((r) => `${r.name} ${r.gender}: idle ${r.idle} walk ${r.walk} run ${r.run} sit ${r.sit}`) });

  // ------------------------------------------------------------------ 3. Customisation on the new garments; programs
  const custom = await page.evaluate(async (LOOKS) => {
    const g = window.game;
    const choices = g.modules.ClothingStyleApi.FABRIC_CHOICES;
    const rows = [];
    for (const [name, kind, variant, look, bodies] of LOOKS) {
      const slot = kind === 'Skirt' || (kind === 'Top_Short' && false) ? 'bottom' : 'top';
      const want = `Outfit_${kind}__${variant}`;
      const fabric = choices[variant]?.[1] ?? choices[variant]?.[0];
      const styled = { ...look, styles: { ...(look.styles ?? {}), [slot]: { colour: '#2563eb', fabric, pattern: { kind: 'ankara', colour2: '#facc15', colour3: '#dc2626' }, stitch: '#facc15', condition: 'dirty' } } };
      const { handle } = await window.__g45.model(bodies[0], styled);
      const f = window.__g45.fabrics(handle.root, new RegExp(`^${want}$`));
      const body = f.find((x) => x.fabric === fabric) ?? f[0];
      rows.push({ name, ok: !!body && body.fabric === fabric && body.colour === '2563eb' && body.pat > 0 && body.dirt > 0.5, body, fabric });
    }
    // Every new garment seen once now: dressing in all of them again (other colours) makes no new programs
    const before = g.renderer.info.programs?.length ?? 0;
    for (const [, , , look, bodies] of LOOKS) for (const gender of bodies) await window.__g45.model(gender, { ...look, outfitColor: 0x16a34a, trousersColor: 0x7c3aed }, 'walk');
    return { rows, programsAdded: (g.renderer.info.programs?.length ?? 0) - before };
  }, LOOKS);
  check('garments45: colour, cloth, ankara print, thread and condition reach every new garment, and dressing in all of them again makes no new shader programs',
    custom.rows.every((r) => r.ok) && custom.programsAdded === 0 && errors.length === 0, { bad: custom.rows.filter((r) => !r.ok), programsAdded: custom.programsAdded, errors });

  // ------------------------------------------------------------------ Pictures
  if (SHOTS) {
    for (const [name, kind, variant, look, bodies] of LOOKS) {
      const key = variant === 'peplum' ? 'two_piece' : variant;
      for (const clip of ['idle', 'walk', 'run', 'sit']) {
        const url = await page.evaluate(async (g, look, clip) => (await window.__g45.model(g, look, clip)).url, bodies[0], look, clip);
        saveShot(`${key}_${clip}`, url);
      }
      const close = await page.evaluate(async (g, look, kind) => (await window.__g45.model(g, look, 'idle', kind === 'Skirt' ? 'bottom' : 'top', -0.6)).url, bodies[0], look, kind);
      saveShot(`${key}_close`, close);
      const other = await page.evaluate(async (g, look) => (await window.__g45.model(g, look, 'walk')).url, bodies[1], look);
      saveShot(`${key}_other_${bodies[1]}`, other);
      const back = await page.evaluate(async (g, look) => (await window.__g45.model(g, look, 'idle', 'full', Math.PI - 0.4)).url, bodies[0], look);
      saveShot(`${key}_back`, back);
    }
    for (const [name, gender, look] of [['gele_close', 'female', LOOKS[5][3]], ['fila_close', 'male', LOOKS[10][3]], ['kufi_close', 'male', LOOKS[11][3]]]) {
      const url = await page.evaluate(async (g, look) => (await window.__g45.model(g, look, 'idle', 'hat', -0.7)).url, gender, look);
      saveShot(name, url);
    }
  }

  // ------------------------------------------------------------------ 4. Saved outfits with the new garments, across a reload
  const saved = await page.evaluate(async () => {
    const g = window.game;
    const CS = g.modules.ClothingStyleApi;
    const p = g.player;
    const ids = ['top_peplum_ankara', 'bottom_pencil_black', 'head_gele_gold', 'top_white_tee', 'bottom_mini_denim'];
    let cfg = { ...p.config, gender: 'female', ownedClothingIds: [...new Set([...(p.config.ownedClothingIds ?? []), ...ids])], topId: 'top_peplum_ankara', bottomId: 'bottom_pencil_black', headwearId: 'head_gele_gold',
      clothingStyles: { top: { colour: '#db2777', pattern: { kind: 'ankara', colour2: '#fde68a', colour3: '#1d4ed8' } }, bottom: { colour: '#db2777', pattern: { kind: 'ankara', colour2: '#fde68a', colour3: '#1d4ed8' } } } };
    const r = CS.saveOutfit(cfg, 'Owambe Saturday');
    cfg = r.cfg;
    p.restyle(cfg);
    await new Promise((res) => setTimeout(res, 1500));
    // Out of it into a tee and a mini skirt, then the outfit again
    p.restyle({ ...p.config, topId: 'top_white_tee', bottomId: 'bottom_mini_denim', headwearId: undefined, clothingStyles: {} });
    await new Promise((res) => setTimeout(res, 1200));
    const changed = window.__g45.parts(p.skinned?.root ?? p.mesh).shown;
    const eq = CS.equipOutfit(p.config, r.outfit.id);
    p.restyle(eq.cfg);
    await new Promise((res) => setTimeout(res, 1500));
    return { changed, worn: window.__g45.parts(p.skinned?.root ?? p.mesh).shown, missing: eq.missing, outfits: p.config.outfits?.map((o) => o.name) };
  });
  await reload(page, 4000);
  await closeDialogs(page);
  await wait(1500);
  const afterReload = await page.evaluate(() => {
    const p = window.game.player;
    const shown = [];
    (p.skinned?.root ?? p.mesh).traverse((o) => {
      const name = /^Outfit_/.test(o.parent?.name ?? '') ? o.parent.name : /^Outfit_/.test(o.name) ? o.name : null;
      if (o.isMesh && name && o.visible) shown.push(name);
    });
    return { shown: [...new Set(shown)], outfits: p.config.outfits?.map((o) => o.name), top: p.config.topId, pattern: p.config.clothingStyles?.bottom?.pattern?.kind };
  });
  const wantWorn = ['Outfit_Top_Short__peplum', 'Outfit_Skirt__pencil', 'Outfit_Hat__gele'];
  check('garments45: an owambe outfit (ankara peplum, pencil skirt, gele) saved, changed out of (tee and mini skirt), worn again, and still worn and saved after a reload',
    saved.changed.includes('Outfit_Skirt__mini') && wantWorn.every((w) => saved.worn.includes(w)) && saved.missing.length === 0 && afterReload.outfits?.includes('Owambe Saturday') && wantWorn.every((w) => afterReload.shown.includes(w)) && afterReload.pattern === 'ankara',
    { saved, afterReload });

  // ------------------------------------------------------------------ 5. The street wears them
  await helpers();
  await page.evaluate(() => { const g = window.game; g.world.weather.setWeather('partly_cloudy', true); g.world.skyEnvironment.setHour(10); for (let i = 0; i < 6; i++) g.advance(0.25); });
  await wait(2500);
  const street = await page.evaluate(() => {
    const g = window.game;
    const crowd = g.world.cityPopulation;
    const A = g.modules.NpcWardrobeApi;
    const tally = (day, weekday) => {
      crowd.wardrobe.reset();
      const m = {};
      for (const a of crowd.agents) {
        const e = crowd.wardrobe.dress(a.id, () => crowd.personOf(a, crowd.variants[a.variant]), 10, day, weekday, 'partly_cloudy', false);
        m[e.outfit.template] = (m[e.outfit.template] ?? 0) + 1;
      }
      return m;
    };
    const tue = tally(30, 2), fri = tally(33, 5), sun = tally(35, 0);
    const pick = (m, ids) => ids.reduce((s, id) => s + (m[id] ?? 0), 0);
    const NEW = ['iro_buba', 'ankara_gown', 'ankara_two_piece', 'sundress', 'evening_gown', 'office_skirt_f', 'skirt_casual_f', 'pleated_student_f', 'mini_f', 'agbada'];
    // The near models and the far figures: dressed by the crowd, wearing skirts and gowns where the outfit has one
    const models = (crowd.models.slots ?? []).filter((s) => s.id >= 0 && s.handle && s.holder.visible).map((s) => window.__g45.parts(s.handle.root).shown);
    const cuts = [...crowd.baked.constructor.cuts.keys()];
    return {
      people: crowd.agents.length, tuesday: pick(tue, NEW), friday: pick(fri, ['iro_buba', 'ankara_gown', 'ankara_two_piece', 'agbada', 'senator', 'kaftan']), sunday: pick(sun, ['iro_buba', 'ankara_gown', 'agbada', 'senator', 'kaftan']),
      sundayIro: sun.iro_buba ?? 0, sundayAgbada: sun.agbada ?? 0, officeSkirts: tue.office_skirt_f ?? 0, students: tue.pleated_student_f ?? 0,
      models: models.length, modelsWithNew: models.filter((s) => s.some((n) => /Outfit_(Skirt|Dress|Robe)|__(peplum|buba|kaftan|senator|gele|fila|kufi)/.test(n))).length,
      bakedCuts: cuts.length, bakedWithNew: cuts.filter((k) => /\|(mini|knee|maxi)\||\|(sundress|evening|gown)\||agbada|gele|kufi/.test(k)).length,
      tueTop: Object.entries(tue).sort((a, b) => b[1] - a[1]).slice(0, 12),
    };
  });
  saveJson('street', street);
  check('garments45: the NPC wardrobe dresses the street in the new garments (office pencil skirts and school pleats on weekdays, native wear on Friday, iro and buba, gowns and agbada on Sunday), and the far figures are baked in them',
    street.tuesday > street.people * 0.08 && street.officeSkirts > 0 && street.sundayIro > 0 && street.sundayAgbada > 0 && street.sunday > street.tuesday * 0.3 && street.bakedWithNew > 0, street);

  check('garments45: no shader errors anywhere in the run', errors.length === 0, errors);
  await ctx.close();
}
