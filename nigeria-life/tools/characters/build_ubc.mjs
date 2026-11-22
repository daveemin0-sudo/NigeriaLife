// Builds a NigeriaLife player GLB from Quaternius's Universal Base Characters (CC0):
//   the body split into regions (so clothes can cover them), hair and eyebrows on the same skeleton,
//   clothing shells cut from the body itself (they bend exactly with it), compact WebP textures,
//   and (optionally) animation clips from the Universal Animation Library renamed to the game's names.
//
//   node build_ubc.mjs <male|female> <out.glb> [animations.gltf|glb]
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS, KHRMaterialsSheen } from '@gltf-transform/extensions';
import { mergeDocuments, prune, dedup, textureCompress, resample } from '@gltf-transform/functions';
import sharp from 'sharp';
import path from 'node:path';
import fs from 'node:fs';

const [gender, out, animFile] = process.argv.slice(2);
// The unzipped Universal Base Characters [Standard] folder (free, CC0, from quaternius.com or itch.io)
const PACK = process.env.UBC_PACK;
if (!PACK) throw new Error('Set UBC_PACK to the unzipped "Universal Base Characters[Standard]" folder');
const BODY = path.join(PACK, 'Base Characters/Godot - UE', gender === 'female' ? 'Superhero_Female_FullBody.gltf' : 'Superhero_Male_FullBody.gltf');
const HAIRDIR = path.join(PACK, 'Hairstyles/Rigged to Head Bone/glTF (Godot -Unreal)');
// A short, everyday Nigerian look: buzzed hair for him, buns for her (more styles can be added as variants)
const HAIR = gender === 'female' ? ['Hair_Buns.gltf'] : ['Hair_Buzzed.gltf'];

const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const KEEP = new Set(['POSITION', 'NORMAL', 'TEXCOORD_0', 'JOINTS_0', 'WEIGHTS_0']);
const slim = (doc) => {
  for (const mesh of doc.getRoot().listMeshes()) for (const prim of mesh.listPrimitives()) for (const s of prim.listSemantics()) if (!KEEP.has(s)) prim.setAttribute(s, null);
};

const doc = await io.read(BODY);
slim(doc);
const root = doc.getRoot();
const scene = root.listScenes()[0];
const skin = root.listSkins()[0];
const jointNames = skin.listJoints().map((j) => j.getName());

// ---------------------------------------------------------------- hair onto the same skeleton
for (const file of HAIR) {
  const hairDoc = await io.read(path.join(HAIRDIR, file));
  slim(hairDoc);
  const hairJoints = hairDoc.getRoot().listSkins()[0].listJoints().map((j) => j.getName());
  const same = hairJoints.length === jointNames.length && hairJoints.every((n, i) => n === jointNames[i]);
  if (!same) throw new Error(`${file}: skeleton differs from the body's`);
  mergeDocuments(doc, hairDoc);
  const extraScene = root.listScenes()[1];
  const hairNode = root.listNodes().find((n) => n.getName() === file.replace('.gltf', '') && n.getMesh());
  const extraSkin = hairNode.getSkin();
  hairNode.setSkin(skin);
  scene.addChild(hairNode);
  extraSkin.dispose();
  for (const n of extraScene.listChildren()) n.dispose();
  extraScene.dispose();
}

// ---------------------------------------------------------------- materials named for the game
for (const m of root.listMaterials()) {
  const n = m.getName();
  if (/Superhero/i.test(n)) m.setName('Skin_Body');
  else if (/Hair/i.test(n)) m.setName('Hair');
  else if (/Eye/i.test(n)) m.setName('Eyes');
}

// ---------------------------------------------------------------- where the joints are (bind pose)
const joints = skin.listJoints();
const ibm = skin.getInverseBindMatrices();
const jointPos = {};
{
  const m = new Array(16);
  // The translation of a 4x4 matrix's inverse (column-major): where the joint sits in the bind pose
  const invTranslation = (a) => {
    const [a00, a01, a02, a03, a10, a11, a12, a13, a20, a21, a22, a23, a30, a31, a32, a33] = a;
    const b00 = a00 * a11 - a01 * a10, b01 = a00 * a12 - a02 * a10, b02 = a00 * a13 - a03 * a10, b03 = a01 * a12 - a02 * a11, b04 = a01 * a13 - a03 * a11, b05 = a02 * a13 - a03 * a12;
    const b06 = a20 * a31 - a21 * a30, b07 = a20 * a32 - a22 * a30, b08 = a20 * a33 - a23 * a30, b09 = a21 * a32 - a22 * a31, b10 = a21 * a33 - a23 * a31, b11 = a22 * a33 - a23 * a32;
    const det = 1 / (b00 * b11 - b01 * b10 + b02 * b09 + b03 * b08 - b04 * b07 + b05 * b06);
    return [(-a10 * b09 + a11 * b07 - a12 * b06) * det, (a00 * b09 - a01 * b07 + a02 * b06) * det, (-a30 * b03 + a31 * b01 - a32 * b00) * det];
  };
  joints.forEach((j, i) => { ibm.getElement(i, m); jointPos[j.getName()] = invTranslation(m); });
}

// ---------------------------------------------------------------- the body's vertices
const bodyNode = root.listNodes().find((n) => n.getMesh()?.listPrimitives()[0]?.getMaterial()?.getName() === 'Skin_Body');
const bodyPrim = bodyNode.getMesh().listPrimitives()[0];
const pos = bodyPrim.getAttribute('POSITION');
const nor = bodyPrim.getAttribute('NORMAL');
const uv = bodyPrim.getAttribute('TEXCOORD_0');
const jnt = bodyPrim.getAttribute('JOINTS_0');
const wgt = bodyPrim.getAttribute('WEIGHTS_0');
const idx = bodyPrim.getIndices().getArray();
const vCount = pos.getCount();
const P0 = [], N0 = [];
{
  const p3 = [0, 0, 0], n3 = [0, 0, 0];
  for (let v = 0; v < vCount; v++) { pos.getElement(v, p3); nor.getElement(v, n3); P0.push([...p3]); N0.push([...n3]); }
}
let minY = Infinity, maxY = -Infinity;
for (const p of P0) { minY = Math.min(minY, p[1]); maxY = Math.max(maxY, p[1]); }
const height = maxY - minY;
const J = (n) => jointPos[n];
const along = (p, a, b) => { // 0 at joint a, 1 at joint b
  const A = J(a), B = J(b);
  const d = [B[0] - A[0], B[1] - A[1], B[2] - A[2]];
  return ((p[0] - A[0]) * d[0] + (p[1] - A[1]) * d[1] + (p[2] - A[2]) * d[2]) / (d[0] * d[0] + d[1] * d[1] + d[2] * d[2]);
};
const sideOf = (p) => {
  const l = J('upperarm_l'), r = J('upperarm_r');
  return Math.abs(p[0] - l[0]) < Math.abs(p[0] - r[0]) ? 'l' : 'r';
};

// ---------------------------------------------------------------- an everyday build, not a superhero's
// The free pack only has the very muscular body. Limbs and chest are drawn in toward the bones, and the
// sculpted muscle is smoothed away; head, hands and feet are left exactly as they are.
{
  // An everyday Nigerian build: a man strong but not bulky, a woman shapely and slim
  const SLIM = gender === 'female'
    ? { upperarm: 0.82, lowerarm: 0.9, thigh: 0.86, calf: 0.9, chest: 0.92, front: 0.95, back: 0.93, waist: 0.95, neck: 0.9 }
    : { upperarm: 0.76, lowerarm: 0.86, thigh: 0.76, calf: 0.83, chest: 0.82, front: 0.7, back: 0.86, waist: 0.92, neck: 0.82 };
  const jn = (v) => { const j4 = [0, 0, 0, 0], w4 = [0, 0, 0, 0]; jnt.getElement(v, j4); wgt.getElement(v, w4); let b = 0; for (let k = 1; k < 4; k++) if (w4[k] > w4[b]) b = k; return jointNames[j4[b]]; };
  const toward = (p, a, b, f) => { // radially toward the bone a->b
    const A = J(a), B = J(b);
    const d = [B[0] - A[0], B[1] - A[1], B[2] - A[2]];
    const t = ((p[0] - A[0]) * d[0] + (p[1] - A[1]) * d[1] + (p[2] - A[2]) * d[2]) / (d[0] * d[0] + d[1] * d[1] + d[2] * d[2]);
    const q = [A[0] + d[0] * t, A[1] + d[1] * t, A[2] + d[2] * t];
    return [q[0] + (p[0] - q[0]) * f, q[1] + (p[1] - q[1]) * f, q[2] + (p[2] - q[2]) * f];
  };
  const keep = /^(Head|hand_|index|middle|pinky|ring|thumb|foot|ball)/;
  const moveable = new Array(vCount);
  for (let v = 0; v < vCount; v++) {
    const j = jn(v);
    moveable[v] = !keep.test(j);
    const p = P0[v];
    let m = /^upperarm_([lr])/.exec(j);
    if (m) { P0[v] = toward(p, `upperarm_${m[1]}`, `lowerarm_${m[1]}`, SLIM.upperarm); continue; }
    m = /^lowerarm_([lr])/.exec(j);
    if (m) { P0[v] = toward(p, `lowerarm_${m[1]}`, `hand_${m[1]}`, SLIM.lowerarm); continue; }
    m = /^thigh_([lr])/.exec(j);
    if (m) { P0[v] = toward(p, `thigh_${m[1]}`, `calf_${m[1]}`, SLIM.thigh); continue; }
    m = /^calf_([lr])/.exec(j);
    if (m) { P0[v] = toward(p, `calf_${m[1]}`, `foot_${m[1]}`, SLIM.calf); continue; }
    // Chest, back and waist drawn in toward the spine; the neck toward its own bone
    const ring = /^(spine_03|clavicle_)/.test(j) ? ['spine_03', SLIM.chest]
      : j === 'spine_02' ? ['spine_02', SLIM.back]
      : j === 'spine_01' ? ['spine_01', SLIM.waist]
      : j === 'neck_01' ? ['neck_01', SLIM.neck] : null;
    if (ring) {
      const c = J(ring[0]);
      // The chest's front (the pecs) comes in further than its sides
      const fz = ring[0] === 'spine_03' && p[2] > c[2] ? ring[1] * SLIM.front : ring[1];
      P0[v] = [c[0] + (p[0] - c[0]) * ring[1], p[1], c[2] + (p[2] - c[2]) * fz];
    }
  }
  // Smoothing over the welded surface (UV seams split vertices; welding keeps the skin closed)
  const wkey = (p) => p.map((x) => Math.round(x * 1e4)).join(',');
  const weldOf = new Array(vCount), groups = new Map();
  for (let v = 0; v < vCount; v++) { const k = wkey(P0[v]); if (!groups.has(k)) groups.set(k, groups.size); weldOf[v] = groups.get(k); }
  const W = groups.size;
  let wp = Array.from({ length: W }, () => [0, 0, 0]);
  const cnt = new Array(W).fill(0), canMove = new Array(W).fill(true);
  for (let v = 0; v < vCount; v++) { const w = weldOf[v]; wp[w][0] += P0[v][0]; wp[w][1] += P0[v][1]; wp[w][2] += P0[v][2]; cnt[w]++; if (!moveable[v]) canMove[w] = false; }
  wp = wp.map((p, w) => p.map((x) => x / cnt[w]));
  const nb = Array.from({ length: W }, () => new Set());
  for (let t = 0; t < idx.length; t += 3) {
    const a = weldOf[idx[t]], b = weldOf[idx[t + 1]], c = weldOf[idx[t + 2]];
    nb[a].add(b).add(c); nb[b].add(a).add(c); nb[c].add(a).add(b);
  }
  for (let it = 0; it < 8; it++) {
    for (const lambda of [0.5, -0.53]) {
      wp = wp.map((p, w) => {
        if (!canMove[w] || !nb[w].size) return p;
        const avg = [0, 0, 0];
        for (const n of nb[w]) { avg[0] += wp[n][0]; avg[1] += wp[n][1]; avg[2] += wp[n][2]; }
        return p.map((x, k) => x + lambda * (avg[k] / nb[w].size - x));
      });
    }
  }
  // New normals where the skin moved; head, hands and feet keep their own
  const wn = Array.from({ length: W }, () => [0, 0, 0]);
  for (let t = 0; t < idx.length; t += 3) {
    const a = weldOf[idx[t]], b = weldOf[idx[t + 1]], c = weldOf[idx[t + 2]];
    const A = wp[a], B = wp[b], C = wp[c];
    const e1 = [B[0] - A[0], B[1] - A[1], B[2] - A[2]], e2 = [C[0] - A[0], C[1] - A[1], C[2] - A[2]];
    const fn = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]];
    for (const w of [a, b, c]) { wn[w][0] += fn[0]; wn[w][1] += fn[1]; wn[w][2] += fn[2]; }
  }
  for (let v = 0; v < vCount; v++) {
    const w = weldOf[v];
    P0[v] = [...wp[w]];
    pos.setElement(v, P0[v]);
    if (canMove[w]) {
      let n = wn[w];
      const len = Math.hypot(n[0], n[1], n[2]) || 1;
      n = n.map((x) => x / len);
      if (n[0] * N0[v][0] + n[1] * N0[v][1] + n[2] * N0[v][2] < 0) n = n.map((x) => -x);
      N0[v] = n;
      nor.setElement(v, n);
    }
  }
  // The painted muscle shading is softened too (it lives in the skin's normal map)
  bodyPrim.getMaterial().getNormalTextureInfo() && bodyPrim.getMaterial().setNormalScale(0.45);
}

// What each garment covers, as tests on a point of the body (heights measured from the skeleton)
const waistY = J('pelvis')[1] + 0.06 * height;  // a tee's hem, just below the waist
const beltY = J('pelvis')[1] + 0.115 * height;   // trousers' top, under the hem
const ankleY = J('foot_l')[1] + 0.025 * height; // trouser hem and the top of the shoe
const neckY = J('neck_01')[1] + 0.012 * height; // a crew neck at the base of the neck
// In the bind pose the arms stand straight out at shoulder height: only there is a point part of an arm
const inArm = (p) => { const s = sideOf(p); return Math.abs(p[0]) > Math.abs(J(`upperarm_${s}`)[0]) - 0.01 * height && p[1] > J('spine_03')[1] - 0.06 * height; };
const armT = (p) => { const s = sideOf(p); const t1 = along(p, `upperarm_${s}`, `lowerarm_${s}`); return t1 <= 1 ? t1 : 1 + along(p, `lowerarm_${s}`, `hand_${s}`); };
const COVER = {
  TopShort: (p) => p[1] > waistY && p[1] < neckLineY(p[0], p[2]) + 0.012 * height && !inNeck(p) && (!inArm(p) || armT(p) < 0.55),
  TopLong: (p) => p[1] > waistY && p[1] < neckLineY(p[0], p[2]) + 0.012 * height && !inNeck(p) && (!inArm(p) || armT(p) < 1.92),
  BottomLong: (p) => p[1] < beltY && p[1] > ankleY - 0.012 * height && !inArm(p), // a little over the shoe
  BottomShort: (p) => p[1] < beltY && p[1] > J('calf_l')[1] + 0.03 * height && !inArm(p),
  Shoes: (p) => p[1] <= ankleY,
};
const KINDS = Object.keys(COVER);
const vJointName = (v) => { const j4 = [0, 0, 0, 0], w4 = [0, 0, 0, 0]; jnt.getElement(v, j4); wgt.getElement(v, w4); let b = 0; for (let k = 1; k < 4; k++) if (w4[k] > w4[b]) b = k; return jointNames[j4[b]]; };
// The neck's axis and girth (just above the base of the neck): a top's neckline is a ring round it, a little out
// from the skin, at whatever height the shoulders reach it (a flat cut at one height would open wide at the sides)
const NECK = (() => {
  const y = J('neck_01')[1] + 0.016 * height;
  const pts = P0.filter((q, v) => vJointName(v) === 'neck_01' && Math.abs(q[1] - y) < 0.008 * height);
  const cx = pts.reduce((sum, q) => sum + q[0], 0) / pts.length, cz = pts.reduce((sum, q) => sum + q[2], 0) / pts.length;
  const r = pts.map((q) => Math.hypot(q[0] - cx, q[2] - cz)).sort((a, b) => a - b);
  return { cx, cz, r: r[Math.floor(r.length * 0.6)] };
})();
const NECK_CUT = NECK.r + 0.01 * height;
const neckTop = () => J('spine_03')[1];
const inNeck = (p) => p[1] > neckTop() && Math.hypot(p[0] - NECK.cx, p[2] - NECK.cz) < NECK_CUT;
const NECK_BINS = 48;
const binOf = (x, z) => (Math.atan2(z - NECK.cz, x - NECK.cx) + Math.PI) / (2 * Math.PI) * NECK_BINS;
const NECK_LINE = (() => {
  const top = new Array(NECK_BINS).fill(-Infinity);
  P0.forEach((q, v) => {
    const d = Math.hypot(q[0] - NECK.cx, q[2] - NECK.cz);
    if (Math.abs(d - NECK_CUT) > 0.014 * height || q[1] < J('spine_03')[1] - 0.04 * height || q[1] > J('neck_01')[1] + 0.03 * height) return;
    if (!/^(spine|clavicle)/.test(vJointName(v))) return;
    const b = Math.floor(binOf(q[0], q[2])) % NECK_BINS;
    top[b] = Math.max(top[b], q[1]);
  });
  // Bins with nothing in them take their neighbours' height; then smoothed round the ring
  let line = top.map((y, b) => (Number.isFinite(y) ? y : null));
  for (let pass = 0; pass < NECK_BINS && line.some((y) => y === null); pass++)
    line = line.map((y, b) => y ?? line[(b + 1) % NECK_BINS] ?? line[(b + NECK_BINS - 1) % NECK_BINS]);
  for (let it = 0; it < 6; it++) line = line.map((y, b) => (line[(b + NECK_BINS - 1) % NECK_BINS] + 2 * y + line[(b + 1) % NECK_BINS]) / 4);
  return line;
})();
const neckLineY = (x, z) => {
  const f = binOf(x, z) - 0.5, b0 = ((Math.floor(f) % NECK_BINS) + NECK_BINS) % NECK_BINS, t = f - Math.floor(f);
  return NECK_LINE[b0] * (1 - t) + NECK_LINE[(b0 + 1) % NECK_BINS] * t;
};
// Hands and head are never covered (a sleeve stops at the wrist; the neck is open)
const never = (t) => [idx[t], idx[t + 1], idx[t + 2]].every((v) => /^(Head|hand_|index|middle|pinky|ring|thumb)/.test(vJointName(v)));
/** Whether a kind of garment's cloth covers body triangle t. A top leaves the neck open: no triangle with a
 *  corner inside the ring round the neck (`band` widens that ring) */
const triCovered = (t, kind, band = 0) => {
  const a = P0[idx[t]], b = P0[idx[t + 1]], c = P0[idx[t + 2]];
  const nearNeck = (p) => p[1] > neckTop() && Math.hypot(p[0] - NECK.cx, p[2] - NECK.cz) < NECK_CUT + band * height;
  if (kind.startsWith('Top') && (nearNeck(a) || nearNeck(b) || nearNeck(c))) return false;
  return COVER[kind]([(a[0] + b[0] + c[0]) / 3, (a[1] + b[1] + c[1]) / 3, (a[2] + b[2] + c[2]) / 3]);
};
/** The skin hidden under a kind: as the cloth covers, but under a top a band of skin past the neckline is kept
 *  (unseen under the cloth, it closes the gap that would show between the neck and the collar) */
const skinHidden = (t, kind) => triCovered(t, kind, kind.startsWith('Top') ? 0.025 : 0);
/** The cloth of a kind of garment: the body triangles it is made from */
const clothOf = (t, kind) => (kind.startsWith('Top') ? triCovered(t, kind) : masks[t / 3][kIndex[kind]] === '1');

// ---------------------------------------------------------------- the body in pieces, by what can cover them
// Each piece is named Body_c<mask>, one digit per garment kind (TopShort TopLong BottomLong BottomShort Shoes):
// the game hides a piece when any garment it shows has a 1 in that piece's mask.
const groups = new Map();
const masks = [];
for (let t = 0; t < idx.length; t += 3) {
  const mask = never(t) ? '00000' : KINDS.map((k) => (skinHidden(t, k) ? '1' : '0')).join('');
  if (!groups.has(mask)) groups.set(mask, []);
  groups.get(mask).push(idx[t], idx[t + 1], idx[t + 2]);
  masks[t / 3] = mask;
}
const buffer = root.listBuffers()[0];
const accessor = (name, type, array) => doc.createAccessor(name).setType(type).setArray(array).setBuffer(buffer);
const bodyMat = bodyPrim.getMaterial();
for (const [mask, tris] of groups) {
  const prim = doc.createPrimitive().setMaterial(bodyMat).setIndices(accessor(`Body_c${mask}_idx`, 'SCALAR', new Uint32Array(tris)));
  for (const s of bodyPrim.listSemantics()) prim.setAttribute(s, bodyPrim.getAttribute(s));
  scene.addChild(doc.createNode(`Body_c${mask}`).setMesh(doc.createMesh(`Body_c${mask}`).addPrimitive(prim)).setSkin(skin));
}
bodyNode.getMesh().dispose();
bodyNode.dispose();

// ---------------------------------------------------------------- clothing shells: smoothed, loosened copies of what they cover
const sheen = doc.createExtension(KHRMaterialsSheen);
const cloth = (name, color, rough, sheenTint) => {
  const m = doc.createMaterial(name).setBaseColorFactor([...color, 1]).setRoughnessFactor(rough).setMetallicFactor(0).setDoubleSided(true);
  m.setExtension('KHR_materials_sheen', sheen.createSheen().setSheenColorFactor(sheenTint).setSheenRoughnessFactor(0.9));
  return m;
};
const topMat = cloth('Cloth_Top', [0.92, 0.92, 0.92], 0.88, [0.12, 0.12, 0.12]);
const bottomMat = cloth('Cloth_Bottom', [0.035, 0.045, 0.09], 0.9, [0.05, 0.05, 0.06]);
const shoeMat = doc.createMaterial('Cloth_Shoes').setBaseColorFactor([0.05, 0.05, 0.055, 1]).setRoughnessFactor(0.42).setMetallicFactor(0).setDoubleSided(true);
// Positions welded by place (UV seams split vertices), so smoothing does not tear the cloth open
const key = (p) => p.map((x) => Math.round(x * 1e4)).join(',');
const SHELLS = [
  { kind: 'TopShort', name: 'Outfit_Top_Short', mat: topMat, off: 0.017, smooth: 10, lap: 2 },
  { kind: 'TopLong', name: 'Outfit_Top_Long', mat: topMat, off: 0.017, smooth: 10, lap: 2 },
  { kind: 'BottomLong', name: 'Outfit_Bottom_Long', mat: bottomMat, off: 0.012, smooth: 14, lap: 6 },
  { kind: 'BottomShort', name: 'Outfit_Bottom_Short', mat: bottomMat, off: 0.012, smooth: 14, lap: 6 },
  { kind: 'Shoes', name: 'Outfit_Shoes', mat: shoeMat, off: 0.022, smooth: 10, lap: 30 },
];
const kIndex = Object.fromEntries(KINDS.map((k, i) => [k, i]));
const uv2 = [0, 0], j4 = [0, 0, 0, 0], w4 = [0, 0, 0, 0];
/**
 * A garment's shell: the body's triangles it covers (pick(t), by triangle start index), welded, smoothed
 * (muscle out, edges pinned), and set out from the body by `off` (a fraction of the body's height) plus
 * offAt(p) at each point p of the body (a silhouette: a leg that does not taper, a sleeve that opens).
 */
/** The skin weights of the nearest point of the body to q among those mostly on the joints `re` names
 *  (by default the chest, back and shoulders) */
const torsoSkinAt = (q, re = /^(spine|clavicle)/) => {
  let best = -1, bd = Infinity;
  for (let v = 0; v < P0.length; v++) {
    const d = (P0[v][0] - q[0]) ** 2 + (P0[v][1] - q[1]) ** 2 + (P0[v][2] - q[2]) ** 2;
    if (d < bd && re.test(vJointName(v))) { bd = d; best = v; }
  }
  const j = [0, 0, 0, 0], w = [0, 0, 0, 0];
  jnt.getElement(best, j); wgt.getElement(best, w);
  return { j, w };
};
function makeShell(pick, spec) {
  const tris = [];
  for (let t = 0; t < idx.length; t += 3) {
    if (!pick(t)) continue;
    // A top's neck stays open: no triangle with a corner inside the ring round the neck
    if (spec.hem?.neck && (inNeck(P0[idx[t]]) || inNeck(P0[idx[t + 1]]) || inNeck(P0[idx[t + 2]]))) continue;
    tris.push(idx[t], idx[t + 1], idx[t + 2]);
  }
  const local = new Map();
  const order = [];
  for (const v of tris) if (!local.has(v)) { local.set(v, order.length); order.push(v); }
  const weldId = new Map();
  const wOf = order.map((v) => { const k = key(P0[v]); if (!weldId.has(k)) weldId.set(k, weldId.size); return weldId.get(k); });
  const W = weldId.size;
  let wp = Array.from({ length: W }, () => [0, 0, 0]);
  const cnt = new Array(W).fill(0);
  order.forEach((v, i) => { const w = wOf[i]; wp[w][0] += P0[v][0]; wp[w][1] += P0[v][1]; wp[w][2] += P0[v][2]; cnt[w]++; });
  wp = wp.map((p, w) => p.map((x) => x / cnt[w]));
  // Hems cut straight: whatever of the cloth lies past a hem line (a sleeve's end, a top's or a leg's hem,
  // the neckline) is brought back onto it, so the edge runs level, not zig-zag along the body's triangles
  const nb = Array.from({ length: W }, () => new Set());
  const edgeUse = new Map();
  for (let t = 0; t < tris.length; t += 3) {
    const a = wOf[local.get(tris[t])], b = wOf[local.get(tris[t + 1])], c = wOf[local.get(tris[t + 2])];
    nb[a].add(b).add(c); nb[b].add(a).add(c); nb[c].add(a).add(b);
    for (const [x, y] of [[a, b], [b, c], [c, a]]) { const k = x < y ? `${x}_${y}` : `${y}_${x}`; edgeUse.set(k, (edgeUse.get(k) ?? 0) + 1); }
  }
  // The garment's edges (hems, cuffs, neckline) are held where the body is, so smoothing cannot open a gap
  const pinned = new Set();
  for (const [k, n] of edgeUse) if (n === 1) for (const w of k.split('_')) pinned.add(+w);
  // (and remember which way each was brought back: it is set out from the body only square to that, below).
  // An edge point near a hem line is put on it too, so the edge runs along the line, not up and down beside it
  const hemmed = new Array(W).fill(-1);
  const dirs = new Array(W).fill(null);
  const reskin = new Array(W).fill(null);
  if (spec.hem) wp = wp.map((p, w) => {
    const q = spec.hem(p, pinned.has(w));
    if (q.pin) pinned.add(w);
    if (q.dir) dirs[w] = q;
    else if (q.skinFrom) reskin[w] = q;
    if (q[1] !== p[1]) hemmed[w] = 1;
    else if (q[0] !== p[0]) hemmed[w] = 0;
    return q;
  });
  const relax = (lambda) => {
    wp = wp.map((p, w) => {
      if (!nb[w].size || pinned.has(w)) return p;
      const avg = [0, 0, 0];
      for (const n of nb[w]) { avg[0] += wp[n][0]; avg[1] += wp[n][1]; avg[2] += wp[n][2]; }
      return p.map((x, k) => x + lambda * (avg[k] / nb[w].size - x));
    });
  };
  for (let it = 0; it < (spec.lap ?? 0); it++) relax(0.5);
  for (let it = 0; it < spec.smooth; it++) { relax(0.5); relax(-0.53); }
  const wn = Array.from({ length: W }, () => [0, 0, 0]);
  for (let t = 0; t < tris.length; t += 3) {
    const a = wOf[local.get(tris[t])], b = wOf[local.get(tris[t + 1])], c = wOf[local.get(tris[t + 2])];
    const A = wp[a], B = wp[b], C = wp[c];
    const e1 = [B[0] - A[0], B[1] - A[1], B[2] - A[2]], e2 = [C[0] - A[0], C[1] - A[1], C[2] - A[2]];
    const fn = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]];
    for (const w of [a, b, c]) { wn[w][0] += fn[0]; wn[w][1] += fn[1]; wn[w][2] += fn[2]; }
  }
  const P = [], N = [], U = [], JJ = [], WW = [];
  order.forEach((v, i) => {
    const w = wOf[i];
    let n = wn[w];
    const len = Math.hypot(n[0], n[1], n[2]) || 1;
    n = n.map((x) => x / len);
    if (n[0] * N0[v][0] + n[1] * N0[v][1] + n[2] * N0[v][2] < 0) n = n.map((x) => -x);
    if (dirs[w]) n = dirs[w].dir;
    else if (hemmed[w] >= 0) {
      // On a hem line: out from the body only across the line, so the hem runs level
      const m = n.slice();
      m[hemmed[w]] = 0;
      const ml = Math.hypot(m[0], m[1], m[2]) || 1;
      n = m.map((x) => x / ml);
    }
    let o = spec.off + (spec.offAt ? spec.offAt(P0[v]) : 0);
    // A waist that sits close (trousers under a top's hem), the cloth easing out below it
    if (spec.snugAbove !== undefined) {
      const t = Math.max(0, Math.min(1, (P0[v][1] - spec.snugAbove) / (0.035 * height)));
      o += (Math.min(o, 0.009) - o) * t;
    }
    // Trouser legs end over the shoe, never inside it (no notch where they meet)
    if (spec.ankleMin !== undefined) {
      const t = Math.max(0, Math.min(1, (ankleY + 0.045 * height - P0[v][1]) / (0.045 * height)));
      o = Math.max(o, o + (spec.ankleMin - o) * t);
    }
    o *= height;
    const out = [wp[w][0] + n[0] * o, wp[w][1] + n[1] * o, wp[w][2] + n[2] * o];
    // A top's cloth, set out from the shoulders, never rises above its neckline near the neck (it would stand
    // up past the rib as a step inside the collar)
    if (spec.hem?.neck && Math.hypot(out[0] - NECK.cx, out[2] - NECK.cz) < NECK_CUT + 0.08 * height) out[1] = Math.min(out[1], neckLineY(out[0], out[2]) + 0.003 * height);
    P.push(...out);
    N.push(...n);
    uv.getElement(v, uv2); jnt.getElement(v, j4); wgt.getElement(v, w4);
    // A point brought onto the neckline from inside the neck rides the chest and shoulders there, not the neck
    // (with the neck's weights it would swing with the head and tear away from the rest of the collar)
    if (dirs[w]) { const near = torsoSkinAt(dirs[w]); U.push(...uv2); JJ.push(...near.j); WW.push(...near.w); return; }
    if (reskin[w]) { const near = torsoSkinAt(reskin[w], reskin[w].skinFrom); U.push(...uv2); JJ.push(...near.j); WW.push(...near.w); return; }
    U.push(...uv2); JJ.push(...j4); WW.push(...w4);
  });
  // Triangles that folded over where a hem pulled points onto its line (their face turned against the cloth's
  // own normals) or shrank to nothing are left out: drawn, their back shows as a dark notch in the cloth
  const I = [];
  for (let t = 0; t < tris.length; t += 3) {
    const k = [local.get(tris[t]), local.get(tris[t + 1]), local.get(tris[t + 2])];
    // Cloth from past a sleeve's end (the wrist and hand) all pushed back onto the end: it would lie flat across
    // the opening as a star of slivers; the sleeve is left open there, its cuff finishing it
    if (k.every((i) => reskin[wOf[i]])) continue;
    const A = k.map((i) => [P[i * 3], P[i * 3 + 1], P[i * 3 + 2]]);
    const e1 = [A[1][0] - A[0][0], A[1][1] - A[0][1], A[1][2] - A[0][2]], e2 = [A[2][0] - A[0][0], A[2][1] - A[0][1], A[2][2] - A[0][2]];
    const fn = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]];
    const area = Math.hypot(fn[0], fn[1], fn[2]);
    if (area < 1e-12) continue;
    const vn = [0, 1, 2].map((c) => N[k[0] * 3 + c] + N[k[1] * 3 + c] + N[k[2] * 3 + c]);
    if (fn[0] * vn[0] + fn[1] * vn[1] + fn[2] * vn[2] < 0) continue;
    I.push(...k);
  }
  return { P, N, U, JJ, WW, I };
}

/** Several parts as one (their vertices end to end, their triangles renumbered) */
function mergeParts(geos) {
  const out = { P: [], N: [], U: [], JJ: [], WW: [], I: [] };
  for (const g of geos) {
    const base = out.P.length / 3;
    out.P.push(...g.P); out.N.push(...g.N); out.U.push(...g.U); out.JJ.push(...g.JJ); out.WW.push(...g.WW);
    out.I.push(...g.I.map((i) => i + base));
  }
  return out;
}

/** A node for a garment: one primitive per material (cloth, trim), all on the body's skin */
function addGarment(name, given) {
  const mesh = doc.createMesh(name);
  // Parts of the same material drawn as one (a shell and its collar, pockets and hems: one draw)
  const byMat = new Map();
  for (const { mat, geo } of given) byMat.set(mat, [...(byMat.get(mat) ?? []), geo]);
  const parts = [...byMat].map(([mat, geos]) => ({ mat, geo: geos.length === 1 ? geos[0] : mergeParts(geos) }));
  parts.forEach(({ mat, geo }, i) => {
    const tag = `${name}_${i}`;
    mesh.addPrimitive(doc.createPrimitive().setMaterial(mat)
      .setIndices(accessor(`${tag}_idx`, 'SCALAR', new Uint32Array(geo.I)))
      .setAttribute('POSITION', accessor(`${tag}_pos`, 'VEC3', new Float32Array(geo.P)))
      .setAttribute('NORMAL', accessor(`${tag}_nor`, 'VEC3', new Float32Array(geo.N)))
      .setAttribute('TEXCOORD_0', accessor(`${tag}_uv`, 'VEC2', new Float32Array(geo.U)))
      .setAttribute('JOINTS_0', accessor(`${tag}_j`, 'VEC4', new Uint8Array(geo.JJ)))
      .setAttribute('WEIGHTS_0', accessor(`${tag}_w`, 'VEC4', new Float32Array(geo.WW))));
  });
  // Only cloth that hangs from the cloth rig uses its skin; everything else stays on the character's own
  const onRig = parts.some(({ geo }) => geo.JJ.some((j) => j >= clothRig.firstJoint));
  scene.addChild(doc.createNode(name).setMesh(mesh).setSkin(onRig ? clothRig.skin : skin));
}

const plainShells = () => {
const HEMS = {
  TopShort: () => topHems(0.55, waistY),
  TopLong: () => topHems(1.92, waistY),
  BottomLong: () => legHemsAt(ankleY - 0.012 * height),
  BottomShort: () => legHemsAt(J('calf_l')[1] + 0.03 * height),
  Shoes: () => (p, edge) => [p[0], edge && p[1] > ankleY - 0.03 * height ? ankleY : Math.min(ankleY, p[1]), p[2]],
};
for (const shell of SHELLS) {
  const geo = makeShell((t) => !never(t) && clothOf(t, shell.kind), { ...shell, hem: HEMS[shell.kind]() });
  addGarment(shell.name, [{ mat: shell.mat, geo }]);
}
};

// ---------------------------------------------------------------- garments of their own: shapes, collars, pockets, caps
// Every garment below is a real model on the shared skeleton: a shell with its own silhouette (a crew-neck tee's
// opening sleeves, an oversized tee's dropped shoulders, jeans that are slim, straight or baggy), and the parts that
// make it what it is (a polo's collar and placket, a shirt's collar points, buttons and cuffs, a hoodie's hood and
// pocket, a waistband with belt loops and back pockets, cargo pockets with flaps, caps that sit on the head). Each
// covers at least what its kind covers, so the body pieces hidden under it are the same as for the plain shell.
const H = height;
const jIndex = (name) => jointNames.indexOf(name);
const geoOf = () => ({ P: [], N: [], U: [], JJ: [], WW: [], I: [] });
const pushV = (g, p, n, ji) => { g.P.push(...p); g.N.push(...n); g.U.push(0, 0); g.JJ.push(ji, 0, 0, 0); g.WW.push(1, 0, 0, 0); return g.P.length / 3 - 1; };
const norm3 = (v) => { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; };
const add3 = (a, b, s = 1) => [a[0] + b[0] * s, a[1] + b[1] * s, a[2] + b[2] * s];
const merge = (...gs) => { const out = geoOf(); for (const g of gs) { const base = out.P.length / 3; out.P.push(...g.P); out.N.push(...g.N); out.U.push(...g.U); out.JJ.push(...g.JJ); out.WW.push(...g.WW); out.I.push(...g.I.map((i) => i + base)); } return out; };

/**
 * A band of cloth round an axis w (a collar, a cuff, a waistband): rings from s = 0 to s = len along w, of radii
 * radii(s) = [ru, rv] along u and v; `skip` leaves an opening between two angles (a polo's open front).
 */
function band(ji, centre, u, v, w, len, radii, { seg = 28, rings = 3, skip = null } = {}) {
  const g = geoOf();
  const cols = [];
  for (let k = 0; k <= seg; k++) {
    const a = (k / seg) * Math.PI * 2;
    if (skip && a > skip[0] && a < skip[1]) { cols.push(null); continue; }
    const col = [];
    for (let r = 0; r <= rings; r++) {
      const s = r / rings;
      const [ru, rv] = radii(s);
      const radial = add3(add3([0, 0, 0], u, Math.cos(a) * ru), v, Math.sin(a) * rv);
      col.push(pushV(g, add3(add3(centre, w, s * len), radial), norm3(add3(add3([0, 0, 0], u, Math.cos(a) / ru), v, Math.sin(a) / rv)), ji));
    }
    cols.push(col);
  }
  for (let k = 0; k < seg; k++) {
    const A = cols[k], B = cols[k + 1];
    if (!A || !B) continue;
    for (let r = 0; r < rings; r++) g.I.push(A[r], B[r], A[r + 1], B[r], B[r + 1], A[r + 1]);
  }
  return g;
}

/** A box (a pocket, a placket, a button, a belt loop), its middle at c, sizes along x, y, z, turned by yaw */
function box(ji, c, [sx, sy, sz], yaw = 0) {
  const g = geoOf();
  const cy = Math.cos(yaw), sn = Math.sin(yaw);
  const turn = (p) => [p[0] * cy + p[2] * sn, p[1], -p[0] * sn + p[2] * cy];
  const faces = [[[1, 0, 0], [0, 1, 0], [0, 0, 1]], [[-1, 0, 0], [0, 1, 0], [0, 0, -1]], [[0, 1, 0], [0, 0, 1], [1, 0, 0]], [[0, -1, 0], [0, 0, -1], [1, 0, 0]], [[0, 0, 1], [1, 0, 0], [0, 1, 0]], [[0, 0, -1], [-1, 0, 0], [0, 1, 0]]];
  const half = [sx / 2, sy / 2, sz / 2];
  for (const [n, a, b] of faces) {
    const base = g.P.length / 3;
    for (const [i, j] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
      const p = [0, 1, 2].map((k) => n[k] * half[k] + a[k] * i * half[k] + b[k] * j * half[k]);
      pushV(g, add3(c, turn(p)), turn(n), ji);
    }
    g.I.push(base, base + 1, base + 2, base, base + 2, base + 3);
  }
  return g;
}

/** A dome over a centre (a cap's crown, a beanie): radii rx, ry, rz, from the top down to polar angle tMax */
function dome(ji, c, rx, ry, rz, tMax, { seg = 28, rings = 10, tilt = 0 } = {}) {
  const g = geoOf();
  const grid = [];
  for (let r = 0; r <= rings; r++) {
    const t = (r / rings) * tMax;
    const row = [];
    for (let k = 0; k <= seg; k++) {
      const a = (k / seg) * Math.PI * 2;
      let p = [rx * Math.sin(t) * Math.sin(a), ry * Math.cos(t), rz * Math.sin(t) * Math.cos(a)];
      // Tipped back a little (a cap sits further down at the back than over the brow)
      p = [p[0], p[1] * Math.cos(tilt) - p[2] * Math.sin(tilt), p[1] * Math.sin(tilt) + p[2] * Math.cos(tilt)];
      row.push(pushV(g, add3(c, p), norm3([p[0] / (rx * rx), p[1] / (ry * ry), p[2] / (rz * rz)]), ji));
    }
    grid.push(row);
  }
  for (let r = 0; r < rings; r++) for (let k = 0; k < seg; k++) g.I.push(grid[r][k], grid[r + 1][k], grid[r][k + 1], grid[r][k + 1], grid[r + 1][k], grid[r + 1][k + 1]);
  return g;
}

/** A brim: a ring of cloth from radius r0 out to r1 (scaled by sx, sz), dropping by `drop`, over angles a0..a1 (0 = front) */
function brim(ji, c, r0, r1, sx, sz, drop, a0, a1, seg = 24) {
  const g = geoOf();
  const inner = [], outer = [];
  for (let k = 0; k <= seg; k++) {
    const a = a0 + ((a1 - a0) * k) / seg;
    const dir = [Math.sin(a) * sx, 0, Math.cos(a) * sz];
    inner.push(pushV(g, add3(c, dir, r0), [0, 1, 0], ji));
    outer.push(pushV(g, add3(add3(c, dir, r1), [0, -drop, 0]), [0, 1, 0], ji));
  }
  for (let k = 0; k < seg; k++) g.I.push(inner[k], outer[k], inner[k + 1], inner[k + 1], outer[k], outer[k + 1]);
  return g;
}

// ---- the body, measured for the parts (in the bind pose: standing, arms straight out to the sides)
const vJoint = vJointName;
const ringAt = (filter, y, tol) => {
  const pts = P0.filter((p, v) => Math.abs(p[1] - y) < tol && filter(v, p));
  const cx = pts.reduce((s, p) => s + p[0], 0) / pts.length;
  const cz = pts.reduce((s, p) => s + p[2], 0) / pts.length;
  const xs = pts.map((p) => Math.abs(p[0] - cx)).sort((a, b) => a - b);
  const zs = pts.map((p) => Math.abs(p[2] - cz)).sort((a, b) => a - b);
  return { cx, cz, rx: xs[Math.floor(xs.length * 0.92)], rz: zs[Math.floor(zs.length * 0.92)] };
};
const torso = (v) => /^(neck_01|spine_0|clavicle_|pelvis|thigh_)/.test(vJoint(v));
// The neck itself (its own bone's skin, just above where a neckline sits), not the shoulders round it
const neck = ringAt((v) => vJoint(v) === 'neck_01', neckY + 0.004 * H, 0.008 * H);
const waist = ringAt((v, p) => torso(v) && !inArm(p), beltY + 0.004 * H, 0.008 * H);
const headPts = P0.filter((p, v) => vJoint(v) === 'Head');
const headBox = { min: [0, 1, 2].map((k) => Math.min(...headPts.map((p) => p[k]))), max: [0, 1, 2].map((k) => Math.max(...headPts.map((p) => p[k]))) };
const head = { c: [0, 1, 2].map((k) => (headBox.min[k] + headBox.max[k]) / 2), r: [0, 1, 2].map((k) => (headBox.max[k] - headBox.min[k]) / 2) };
/** Where the wrist is on an arm (side s), and the ring of the forearm there (the arm lies along x) */
const wristRing = (s, t) => {
  const A = J(`lowerarm_${s}`), B = J(`hand_${s}`);
  const at = [A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t, A[2] + (B[2] - A[2]) * t];
  const pts = P0.filter((p, v) => vJoint(v) === `lowerarm_${s}` && Math.abs(p[0] - at[0]) < 0.012 * H);
  const cy = pts.reduce((sum, p) => sum + p[1], 0) / pts.length;
  const cz = pts.reduce((sum, p) => sum + p[2], 0) / pts.length;
  const ry = Math.max(...pts.map((p) => Math.abs(p[1] - cy)));
  const rz = Math.max(...pts.map((p) => Math.abs(p[2] - cz)));
  return { at: [at[0], cy, cz], ry, rz };
};
/** The outside of a thigh (side s) at a fraction down from hip to knee: its outer x, and the middle front to back */
const thighSide = (s, t) => {
  const A = J(`thigh_${s}`), B = J(`calf_${s}`);
  const y = A[1] + (B[1] - A[1]) * t;
  const pts = P0.filter((p, v) => vJoint(v) === `thigh_${s}` && Math.abs(p[1] - y) < 0.01 * H);
  const sign = Math.sign(A[0]) || 1;
  // The thigh's outer side (a high percentile, not the single outermost point: a stray vertex would set a pocket off the leg)
  const xs = pts.map((p) => sign * p[0]).sort((a, b) => a - b);
  const outer = xs.length ? sign * xs[Math.floor(xs.length * 0.85)] : A[0];
  const cz = pts.reduce((sum, p) => sum + p[2], 0) / pts.length;
  const back = Math.min(...pts.map((p) => p[2]));
  return { sign, x: outer, y, cz, back };
};
const kneeY = (J('calf_l')[1] + J('calf_r')[1]) / 2;
const hipY = (J('thigh_l')[1] + J('thigh_r')[1]) / 2;
const sp3 = jIndex('spine_03'), sp2 = jIndex('spine_02'), sp1 = jIndex('spine_01'), pel = jIndex('pelvis'), hd = jIndex('Head');
const X = [1, 0, 0], Y = [0, 1, 0], Z = [0, 0, 1];

// ---- the parts
const crewRib = () => band(sp3, [neck.cx, neckY - 0.012 * H, neck.cz], X, Z, Y, 0.014 * H, (s) => [neck.rx + (0.012 - 0.003 * s) * H, neck.rz + (0.012 - 0.003 * s) * H]);
/** A turned-down collar: a band standing up at the back and sides, then out and down; open at the front */
const foldedCollar = (points) => merge(
  band(sp3, [NECK.cx, neckY - 0.03 * H, NECK.cz], X, Z, Y, 0.042 * H, (s) => [NECK_CUT - NECK.r + neck.rx + (0.012 + 0.002 * s) * H, NECK_CUT - NECK.r + neck.rz + (0.012 + 0.002 * s) * H], { skip: [Math.PI / 2 - 0.42, Math.PI / 2 + 0.42] }),
  band(sp3, [NECK.cx, neckY + 0.012 * H, NECK.cz], X, Z, Y, -0.03 * H, (s) => [NECK_CUT - NECK.r + neck.rx + (0.016 + 0.012 * s) * H, NECK_CUT - NECK.r + neck.rz + (0.016 + 0.012 * s) * H], { skip: [Math.PI / 2 - (points ? 0.25 : 0.42), Math.PI / 2 + (points ? 0.25 : 0.42)] }),
);
const chestFront = (y) => ringAt((v, p) => torso(v) && !inArm(p), y, 0.008 * H);
const placket = (count) => {
  const top = neckY - 0.03 * H;
  const parts = [];
  const ring = chestFront(top - 0.03 * H);
  const z = ring.cz + ring.rz + 0.021 * H;
  if (count === 0) parts.push(box(sp3, [ring.cx, top - 0.032 * H, z - 0.002 * H], [0.016 * H, 0.06 * H, 0.002 * H]));
  for (let k = 0; k < count; k++) parts.push(box(sp3, [ring.cx, top - 0.012 * H - k * 0.025 * H, z + 0.003 * H], [0.007 * H, 0.007 * H, 0.004 * H]));
  return merge(...parts);
};
const buttonLine = () => {
  const parts = [];
  for (let y = neckY - 0.04 * H; y > waistY + 0.02 * H; y -= 0.045 * H) {
    const ring = chestFront(y);
    const ji = y > J('spine_03')[1] ? sp3 : y > J('spine_02')[1] ? sp2 : sp1;
    parts.push(box(ji, [ring.cx, y, ring.cz + ring.rz + 0.021 * H], [0.008 * H, 0.008 * H, 0.004 * H]));
  }
  return merge(...parts);
};
/** The strip the buttons are sewn on, in the shirt's own cloth */
const buttonStrip = () => {
  const yTop = neckY - 0.02 * H, yBot = waistY + 0.01 * H;
  const ring = chestFront((yTop + yBot) / 2);
  return box(sp2, [ring.cx, (yTop + yBot) / 2, ring.cz + ring.rz + 0.0195 * H], [0.02 * H, yTop - yBot, 0.002 * H]);
};
const cuffs = (t, thick) => merge(...['l', 'r'].map((s) => {
  const w = wristRing(s, t);
  const dir = Math.sign(J(`hand_${s}`)[0] - J(`lowerarm_${s}`)[0]);
  return band(jIndex(`lowerarm_${s}`), [w.at[0] - dir * 0.02 * H, w.at[1], w.at[2]], Y, Z, [dir, 0, 0], 0.035 * H, () => [w.ry + thick * H, w.rz + thick * H]);
}));
const ribHem = () => topHem(waistY, 0.028, 0.034, 0.12);
const hood = () => {
  const back = neck.cz - neck.rz;
  return dome(sp3, [neck.cx, neckY - 0.03 * H, back - 0.025 * H], 0.07 * H, 0.05 * H, 0.045 * H, 1.5, { tilt: -1.2 });
};
const kangaroo = () => {
  const y = waistY + 0.06 * H;
  const ring = chestFront(y);
  return pillow(sp1, [ring.cx, y, ring.cz + ring.rz + 0.03 * H], X, Y, Z, 0.075 * H, 0.033 * H, 0.007 * H, 0.35);
};
const waistband = (extra) => band(pel, [waist.cx, beltY - 0.024 * H, waist.cz], X, Z, Y, 0.022 * H, () => [waist.rx + (0.012 + extra) * H, waist.rz + (0.012 + extra) * H]);
const beltLoops = (extra) => {
  const parts = [];
  for (const a of [0.5, 1.4, 2.4, Math.PI, 3.9, 4.9, 5.8]) {
    const x = waist.cx + Math.sin(a) * (waist.rx + (0.017 + extra) * H);
    const z = waist.cz + Math.cos(a) * (waist.rz + (0.017 + extra) * H);
    parts.push(box(pel, [x, beltY - 0.012 * H, z], [0.006 * H, 0.026 * H, 0.004 * H], a));
  }
  return merge(...parts);
};
/** A part skinned as the body under it (each point takes the nearest body point's joints and weights), so it moves
 *  with the cloth it is sewn on instead of riding one bone (a pocket would swing off the hip as the thigh turns) */
const skinToBody = (g) => {
  const j4 = [0, 0, 0, 0], w4 = [0, 0, 0, 0];
  for (let i = 0; i < g.P.length / 3; i++) {
    const q = [g.P[i * 3], g.P[i * 3 + 1], g.P[i * 3 + 2]];
    let best = -1, bd = Infinity;
    for (let v = 0; v < P0.length; v++) {
      const d = (P0[v][0] - q[0]) ** 2 + (P0[v][1] - q[1]) ** 2 + (P0[v][2] - q[2]) ** 2;
      if (d < bd && !/^(hand|lowerarm|upperarm|index|middle|pinky|ring|thumb)/.test(vJointName(v))) { bd = d; best = v; }
    }
    if (best < 0) continue;
    jnt.getElement(best, j4); wgt.getElement(best, w4);
    for (let k = 0; k < 4; k++) { g.JJ[i * 4 + k] = j4[k]; g.WW[i * 4 + k] = w4[k]; }
  }
  return g;
};
const backPockets = (extra) => skinToBody(merge(...[-1, 1].map((s) => {
  const th = thighSide(s > 0 ? (J('thigh_l')[0] > 0 ? 'l' : 'r') : (J('thigh_l')[0] > 0 ? 'r' : 'l'), 0.05);
  const turn = -s * 0.3;
  return pillow(pel, [s * 0.04 * H + waist.cx, hipY - 0.008 * H, th.back - (0.0075 + extra) * H], [Math.cos(turn), 0, -Math.sin(turn)], Y, [-Math.sin(turn), 0, -Math.cos(turn)], 0.026 * H, 0.03 * H, 0.0025 * H, 0.3, 7);
})));
/** Where a garment's own cloth is outermost on one side at height y: the pocket is sewn on that, not on the body
 *  (the body's outer thigh can lie wider than the cloth over it, and a pocket set from it stands off the leg) */
const clothSide = (shell, sign, y, near) => {
  const pts = [];
  for (let i = 0; i < shell.P.length; i += 3) {
    const x = shell.P[i], py = shell.P[i + 1], z = shell.P[i + 2];
    if (Math.abs(py - y) < 0.012 * H && sign * x > 0.03 * H && Math.abs(z - near) < 0.06 * H) pts.push([x, z]);
  }
  if (pts.length < 3) return null;
  pts.sort((a, b) => sign * b[0] - sign * a[0]);
  const top = pts.slice(0, Math.max(2, Math.ceil(pts.length * 0.1)));
  return { x: top.reduce((m, p) => m + p[0], 0) / top.length, z: top.reduce((m, p) => m + p[1], 0) / top.length };
};
/** A flat part bent round a leg: its width (along z) follows the leg's curve about the axis at (ax, az), so a wide
 *  pocket lies on the thigh all across instead of touching it only at its widest point */
const wrapRound = (g, ax, az, sign, x0, z0) => {
  // The pocket's centre line sits at angle f0 round the axis, R out from it; a point u along the pocket's width
  // goes to angle f0 + u / R, and d out from the pocket's back to R + d from the axis
  const R = Math.hypot(x0 - ax, z0 - az), f0 = Math.atan2(z0 - az, sign * (x0 - ax));
  for (let i = 0; i < g.P.length; i += 3) {
    const d = sign * (g.P[i] - x0), u = g.P[i + 2] - z0, turn = u / R, a = f0 + turn, r = R + d;
    g.P[i] = ax + sign * r * Math.cos(a);
    g.P[i + 2] = az + r * Math.sin(a);
    const c = Math.cos(turn), sn = Math.sin(turn), nx = sign * g.N[i], nz = g.N[i + 2];
    g.N[i] = sign * (nx * c - nz * sn);
    g.N[i + 2] = nx * sn + nz * c;
  }
  return g;
};
const cargoPockets = (t, extra, shell) => skinToBody(merge(...['l', 'r'].map((s) => {
  const th = thighSide(s, t);
  const ji = jIndex(`thigh_${s}`);
  const on = shell ? clothSide(shell, th.sign, th.y, th.cz) : null;
  // The pocket half sunk into the cloth, the flap lying over its top
  const x = on ? on.x - th.sign * 0.0015 * H : th.x + th.sign * (0.019 + extra) * H;
  const z = on ? on.z : th.cz;
  const parts = merge(
    pillow(ji, [x, th.y, z], Z, Y, [th.sign, 0, 0], 0.04 * H, 0.048 * H, 0.0055 * H, 0.3),
    pillow(ji, [x + th.sign * 0.0045 * H, th.y + 0.042 * H, z], Z, Y, [th.sign, 0, 0], 0.043 * H, 0.014 * H, 0.0025 * H, 0.3, 7),
  );
  // Bent round the thigh's own axis there (between the hip and knee joints)
  const A = J(`thigh_${s}`), B = J(`calf_${s}`);
  const k = (th.y - A[1]) / (B[1] - A[1]);
  return wrapRound(parts, A[0] + (B[0] - A[0]) * k, A[2] + (B[2] - A[2]) * k, th.sign, x, z);
})));
// Caps, over the head; the brim reaches forward (+z, the face's side) from over the brow
// The crown of the head: the skull above the brow (the head's box runs down to the jaw)
const skull = { c: [head.c[0], head.c[1] + head.r[1] * 0.25, head.c[2] - head.r[2] * 0.08], rx: head.r[0] * 0.98, ry: head.r[1] * 0.78, rz: head.r[2] * 0.95 };
const capCrown = () => dome(hd, skull.c, skull.rx * 1.06, skull.ry * 1.0, skull.rz * 1.05, 1.5, { tilt: 0.1 });
const capBrim = () => brim(hd, [skull.c[0], skull.c[1] + skull.ry * 0.03, skull.c[2]], skull.rz * 1.03, skull.rz * 1.03 + 0.042 * H, 1.0, 1.0, 0.01 * H, -1.05, 1.05);
const capButton = () => box(hd, [skull.c[0], skull.c[1] + skull.ry * 1.0, skull.c[2] - skull.rz * 0.1], [0.012 * H, 0.006 * H, 0.012 * H]);
const bucketCrown = () => dome(hd, [skull.c[0], skull.c[1] - skull.ry * 0.05, skull.c[2]], skull.rx * 1.1, skull.ry * 1.02, skull.rz * 1.1, 1.52, { tilt: 0.04 });
const bucketBrim = () => brim(hd, [skull.c[0], skull.c[1] - skull.ry * 0.05, skull.c[2]], skull.rz * 1.08, skull.rz * 1.08 + 0.032 * H, 1.04, 1.0, 0.018 * H, -Math.PI, Math.PI, 40);
const beanie = () => merge(
  dome(hd, [skull.c[0], skull.c[1] - skull.ry * 0.1, skull.c[2]], skull.rx * 1.06, skull.ry * 1.12, skull.rz * 1.05, 1.55, { tilt: 0.08 }),
  band(hd, [skull.c[0], skull.c[1] - skull.ry * 0.16, skull.c[2]], X, Z, Y, 0.028 * H, () => [skull.rx * 1.09, skull.rz * 1.08]),
);

// ---- hem lines: where each kind of garment ends, cut straight
/** A point on an arm brought back to armT t if it lies past it (the arm lies along x in the bind pose) */
const armStop = (p, t, edge = false) => {
  if (!inArm(p) || armT(p) <= t - (edge ? 0.14 : 0)) return p;
  const s = sideOf(p);
  const [a, b, u] = t <= 1 ? [`upperarm_${s}`, `lowerarm_${s}`, t] : [`lowerarm_${s}`, `hand_${s}`, t - 1];
  const q = [J(a)[0] + (J(b)[0] - J(a)[0]) * u, p[1], p[2]];
  // (brought back to the sleeve's end from further down the arm or the hand: it moves with the arm where it now is)
  q.skinFrom = new RegExp(`^(upperarm|lowerarm)_${s}`);
  return q;
};
/** Hems for a top: sleeves end at armT `sleeve`, the body at `bottom`, the neckline at neckY */
const topHems = (sleeve, bottom) => Object.assign((p, edge) => {
  // (a sleeve stops at its end; near the neck, arm points meet the neckline as the body's do)
  const arm = inArm(p) ? armStop(p, sleeve, edge) : null;
  if (arm && Math.hypot(p[0] - NECK.cx, p[2] - NECK.cz) > NECK_CUT + 0.07 * height) return arm;
  let y = arm ? arm[1] : Math.max(bottom, p[1]);
  // Edge points just above the hem onto the line
  if (!arm && edge && y < bottom + 0.035 * height) y = bottom;
  let x = arm ? arm[0] : p[0], z = arm ? arm[2] : p[2];
  // The neckline: on the ring round the neck, at the line's height there (edge points near it too)
  const dx = x - NECK.cx, dz = z - NECK.cz, d = Math.hypot(dx, dz);
  if (y > neckTop() - 0.02 * height && (d < NECK_CUT || (edge && d < NECK_CUT + 0.035 * height))) {
    const k = NECK_CUT / (d || 1);
    x = NECK.cx + dx * k;
    z = NECK.cz + dz * k;
    y = neckLineY(x, z);
    // (held there: smoothing must not pull the neckline back into the neck)
    const q = [x, y, z];
    q.pin = true;
    // (and set out from it straight away from the neck, whatever the squeezed triangles' normals say)
    q.dir = [dx / (d || 1), 0, dz / (d || 1)];
    return q;
  } else if (d < NECK_CUT + 0.07 * height) {
    // Near the neck nothing of the cloth rises above the neckline (no points left standing up into the neck)
    y = Math.min(y, neckLineY(x, z));
  }
  return [x, y, z];
}, { neck: true });
/** Hems for trousers or shorts: the waist at beltY, the legs at `leg` */
const legHemsAt = (leg) => (p, edge) => {
  let y = Math.min(beltY, Math.max(leg, p[1]));
  if (edge && y < leg + 0.035 * height) y = leg;
  if (edge && y > beltY - 0.03 * height) y = beltY;
  return [p[0], y, p[2]];
};

// ---- finished edges: every hem a band of cloth, so no cut edge shows
/** The ring of an arm (side s) at armT t (0 shoulder, 1 elbow, 2 wrist): its middle and radii (the arm lies along x) */
const armRing = (s, t) => {
  const [a, b, u] = t <= 1 ? [`upperarm_${s}`, `lowerarm_${s}`, t] : [`lowerarm_${s}`, `hand_${s}`, t - 1];
  const A = J(a), B = J(b);
  const at = [A[0] + (B[0] - A[0]) * u, A[1] + (B[1] - A[1]) * u, A[2] + (B[2] - A[2]) * u];
  const pts = P0.filter((p, v) => /^(upperarm_|lowerarm_)/.test(vJoint(v)) && sideOf(p) === s && Math.abs(p[0] - at[0]) < 0.01 * H);
  const cy = pts.reduce((sum, p) => sum + p[1], 0) / pts.length;
  const cz = pts.reduce((sum, p) => sum + p[2], 0) / pts.length;
  return { at: [at[0], cy, cz], ry: Math.max(...pts.map((p) => Math.abs(p[1] - cy))), rz: Math.max(...pts.map((p) => Math.abs(p[2] - cz))), dir: Math.sign(B[0] - A[0]) || 1, ji: jIndex(t <= 1 ? `upperarm_${s}` : `lowerarm_${s}`) };
};
/** A sleeve's hem: a band round the arm where the sleeve ends, standing out by `out` */
const sleeveHems = (t, out, len = 0.028) => merge(...['l', 'r'].map((s) => {
  const r = armRing(s, t);
  return band(r.ji, [r.at[0] - r.dir * len * 0.6 * H, r.at[1], r.at[2]], Y, Z, [r.dir, 0, 0], len * H, () => [r.ry + out * H, r.rz + out * H]);
}));
/** A top's hem round the hips */
const topHem = (y, out, len = 0.03, above = 0.5) => {
  const r = ringAt((v, p) => torso(v) && !inArm(p), y, 0.01 * H);
  return band(sp1, [r.cx, y - len * (1 - above) * H, r.cz], X, Z, Y, len * H, () => [r.rx + out * H, r.rz + out * H]);
};
/** The hems of a pair of short legs (shorts), round each thigh where the leg ends */
const legHems = (y, out, len = 0.03) => merge(...['l', 'r'].map((s) => {
  const r = ringAt((v) => vJoint(v) === `thigh_${s}` || vJoint(v) === `calf_${s}`, y, 0.01 * H);
  return band(jIndex(`thigh_${s}`), [r.cx, y - len * 0.4 * H, r.cz], X, Z, Y, len * H, () => [r.rx + out * H, r.rz + out * H]);
}));
const shortLegY = J('calf_l')[1] + 0.03 * H;

// ---- the silhouettes
const ramp = (x, a, b) => Math.max(0, Math.min(1, (x - a) / (b - a)));
/** A sleeve that opens toward its hem (short sleeves hang off the arm) */
const sleeveOpen = (from, to, by) => (p) => (inArm(p) ? ramp(armT(p), from, to) * by : 0);
/** Trouser legs that stop tapering below the knee (straight), or widen (baggy) */
const belowKnee = (by) => (p) => (inArm(p) ? 0 : ramp(kneeY + 0.04 * H - p[1], 0, kneeY - ankleY + 0.04 * H) * by);
const hatMat = cloth('Cloth_Hat', [0.08, 0.08, 0.1], 0.85, [0.1, 0.1, 0.1]);
const trimMat = doc.createMaterial('Cloth_Trim').setBaseColorFactor([0.92, 0.9, 0.85, 1]).setRoughnessFactor(0.4).setMetallicFactor(0.1);
const KIND_HEMS = { TopShort: () => topHems(0.55, waistY), TopLong: () => topHems(1.92, waistY), BottomLong: () => legHemsAt(ankleY - 0.012 * H), BottomShort: () => legHemsAt(shortLegY) };
const shellOf = (kind, extraCover, spec) => makeShell((t) => (!never(t) && clothOf(t, kind)) || (extraCover ? triCoveredBy(t, extraCover) : false), { hem: KIND_HEMS[kind](), ...(kind.startsWith('Bottom') ? { snugAbove: waistY - 0.03 * H } : {}), ...spec });
const triCoveredBy = (t, test) => {
  if (never(t)) return false;
  const a = P0[idx[t]], b = P0[idx[t + 1]], c = P0[idx[t + 2]];
  return test([(a[0] + b[0] + c[0]) / 3, (a[1] + b[1] + c[1]) / 3, (a[2] + b[2] + c[2]) / 3]);
};
// ---- fabrics: each garment part names its cloth (Cloth_<role>:<fabric>); the game draws each fabric's weave
const fabricMats = new Map();
const fab = (role, kind) => {
  const name = `${role}:${kind}`;
  if (!fabricMats.has(name)) {
    const base = { Cloth_Top: [[0.92, 0.92, 0.92], 0.88], Cloth_Bottom: [[0.035, 0.045, 0.09], 0.9], Cloth_Hat: [[0.08, 0.08, 0.1], 0.85], Cloth_Shoes: [[0.08, 0.08, 0.09], 0.6], Sole: [[0.92, 0.92, 0.9], 0.7] }[role];
    // Each fabric its own material, marked as such (identical ones would otherwise be merged into one when the file is tidied)
    const m = cloth(name, base[0], base[1] + fabricMats.size * 0.0005, [0.1, 0.1, 0.1]);
    m.setExtras({ fabric: kind });
    fabricMats.set(name, m);
  }
  return fabricMats.get(name);
};
/** Smooth normals for a part built without them (a pillow) */
const withNormals = (g) => {
  const n = new Array(g.P.length).fill(0);
  for (let t = 0; t < g.I.length; t += 3) {
    const [a, b, c] = [g.I[t], g.I[t + 1], g.I[t + 2]];
    const A = g.P.slice(a * 3, a * 3 + 3), B = g.P.slice(b * 3, b * 3 + 3), C = g.P.slice(c * 3, c * 3 + 3);
    const e1 = [B[0] - A[0], B[1] - A[1], B[2] - A[2]], e2 = [C[0] - A[0], C[1] - A[1], C[2] - A[2]];
    const f = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]];
    for (const i of [a, b, c]) for (let k = 0; k < 3; k++) n[i * 3 + k] += f[k];
  }
  for (let i = 0; i < n.length; i += 3) { const l = Math.hypot(n[i], n[i + 1], n[i + 2]) || 1; g.N[i] = n[i] / l; g.N[i + 1] = n[i + 1] / l; g.N[i + 2] = n[i + 2] / l; }
  return g;
};
/**
 * A rounded pillow of cloth (a patch pocket, a flap, a sole): a superquadric su x sv x sw along u, v, w (w out
 * from the garment), its corners rounded by `e` (0 a box, 1 an egg)
 */
function pillow(ji, c, u, v, w, su, sv, sw, e = 0.3, seg = 9) {
  const g = geoOf();
  const sp = (x, k) => Math.sign(x) * Math.abs(x) ** k;
  const rows = [];
  for (let r = 0; r <= seg; r++) {
    const th = -Math.PI / 2 + (r / seg) * Math.PI;
    const row = [];
    for (let k = 0; k <= seg * 2; k++) {
      const ph = -Math.PI + (k / (seg * 2)) * Math.PI * 2;
      const a = su * sp(Math.cos(th), e) * sp(Math.cos(ph), e);
      const b = sv * sp(Math.sin(th), e);
      const d = sw * sp(Math.cos(th), e) * sp(Math.sin(ph), e);
      row.push(pushV(g, add3(add3(add3(c, u, a), v, b), w, d), [0, 1, 0], ji));
    }
    rows.push(row);
  }
  for (let r = 0; r < seg; r++) for (let k = 0; k < seg * 2; k++) g.I.push(rows[r][k], rows[r + 1][k], rows[r][k + 1], rows[r][k + 1], rows[r + 1][k], rows[r + 1][k + 1]);
  return withNormals(g);
}
/** A crew neck's rib, set on the shell's own neckline (so the neckline is finished all round, with no edge showing) */
const neckRibOn = (off, thick = 0.0035, len = 0.016) => {
  const g = geoOf();
  const cols = [];
  for (let k = 0; k < NECK_BINS; k++) {
    const a = ((k + 0.5) / NECK_BINS) * 2 * Math.PI - Math.PI, dx = Math.cos(a), dz = Math.sin(a);
    const x = NECK.cx + dx * NECK_CUT, z = NECK.cz + dz * NECK_CUT, y = neckLineY(x, z);
    const r = (off + thick) * H;
    cols.push([pushV(g, [x + dx * r, y - len * 0.7 * H, z + dz * r], [dx, 0, dz], sp3), pushV(g, [x + dx * (r - 0.002 * H), y + len * 0.3 * H, z + dz * (r - 0.002 * H)], [dx, 0.4, dz], sp3)]);
  }
  for (let k = 0; k < cols.length; k++) {
    const A = cols[k], B = cols[(k + 1) % cols.length];
    g.I.push(A[0], A[1], B[0], B[0], A[1], B[1]);
  }
  return g;
};
const neckRibOnFlat = (shell, thick = 0.0035, len = 0.016) => {
  const pts = [];
  for (let i = 0; i < shell.P.length; i += 3) if (Math.abs(shell.P[i + 1] - neckY) < 1e-5 * H && Math.abs(shell.P[i] - neck.cx) < neck.rx * 3) pts.push([shell.P[i], shell.P[i + 2]]);
  // The neckline is the innermost of them all round (shoulder tops cut flat to the same height lie further out)
  const bins = new Array(36).fill(null);
  for (const q of pts) {
    const a = Math.atan2(q[1] - neck.cz, q[0] - neck.cx), r = Math.hypot(q[0] - neck.cx, q[1] - neck.cz);
    const b = Math.floor(((a + Math.PI) / (2 * Math.PI)) * 36) % 36;
    if (!bins[b] || r < bins[b][2]) bins[b] = [q[0], q[1], r];
  }
  const inner = bins.filter(Boolean);
  const cx = inner.reduce((sum, q) => sum + q[0], 0) / inner.length, cz = inner.reduce((sum, q) => sum + q[1], 0) / inner.length;
  const rx = Math.max(...inner.map((q) => Math.abs(q[0] - cx))), rz = Math.max(...inner.map((q) => Math.abs(q[1] - cz)));
  return band(sp3, [cx, neckY - len * 0.75 * H, cz], X, Z, Y, len * H, (s) => [rx + (thick - 0.002 * s) * H, rz + (thick - 0.002 * s) * H], { seg: 40 });
};
/** Splits a shell in two by height: the part below `y` (a shoe's sole) and the rest (its upper) */
const splitBelow = (geo, y) => {
  const lo = { ...geo, I: [] }, hi = { ...geo, I: [] };
  for (let t = 0; t < geo.I.length; t += 3) {
    const cy = (geo.P[geo.I[t] * 3 + 1] + geo.P[geo.I[t + 1] * 3 + 1] + geo.P[geo.I[t + 2] * 3 + 1]) / 3;
    (cy < y ? lo : hi).I.push(geo.I[t], geo.I[t + 1], geo.I[t + 2]);
  }
  return [lo, hi];
};
const groundY = Math.min(...P0.map((q) => q[1]));
/** A foot (side s) measured near the ground: middle, half-width and half-length (the foot points along +z) */
const footOf = (s) => {
  const pts = P0.filter((q, v) => /^(foot_|ball_)/.test(vJoint(v)) && vJoint(v).endsWith(`_${s}`) && q[1] < groundY + 0.035 * H);
  const xs = pts.map((q) => q[0]), zs = pts.map((q) => q[2]);
  return { c: [(Math.min(...xs) + Math.max(...xs)) / 2, groundY, (Math.min(...zs) + Math.max(...zs)) / 2], hw: (Math.max(...xs) - Math.min(...xs)) / 2, hl: (Math.max(...zs) - Math.min(...zs)) / 2, ball: J(`ball_${s}`) };
};
/** Slides: a moulded sole under each foot and a broad strap over the instep; the foot itself is seen */
const slides = () => merge(...['l', 'r'].map((s) => {
  const f = footOf(s);
  const ji = jIndex(`foot_${s}`);
  return merge(
    pillow(ji, [f.c[0], groundY + 0.0035 * H, f.c[2] + 0.004 * H], X, Y, Z, f.hw + 0.006 * H, 0.0055 * H, f.hl + 0.008 * H, 0.25),
    band(ji, [f.c[0], groundY + 0.006 * H, f.ball[2] - 0.035 * H], X, Y, Z, 0.032 * H, () => [f.hw + 0.006 * H, 0.03 * H], { skip: [Math.PI, Math.PI * 2], seg: 32 }),
  );
}));
const SHOE_HEM = (top) => (p, edge) => [p[0], edge && p[1] > top - 0.03 * H ? top : Math.min(top, p[1]), p[2]];
/** A shoe: the upper and its sole, cut where the sole ends */
const shoe = (upper, sole, soleTop, spec, extraCover = null, top = ankleY) => {
  const geo = makeShell((t) => masks[t / 3][kIndex.Shoes] === '1' || (extraCover ? triCoveredBy(t, extraCover) : false), { hem: SHOE_HEM(top), ...spec });
  void sole; void soleTop;
  return [{ mat: upper, geo }];
};

// ---------------------------------------------------------------- flowing cloth: skirts, dresses, gowns, tunics, robes
// Cloth that hangs free of the legs is not cut from the body: it is a tube round the hips and legs, as wide at each
// height as the body is there (bridging the gap between the legs, and never narrower than above it), eased out,
// flared toward the hem and finished with a turned-up hem that gives the cloth its thickness. It is skinned to the
// hips above and shared between both thighs (and, low down, the calves) by how far to each side it hangs: it swings
// with the stride and lies over the lap when the wearer sits.
const sideSign = Math.sign(J('thigh_l')[0]) || 1; // the side thigh_l is on
const trunkPts = P0.filter((p, v) => !inArm(p) && !/^(hand_|Head|neck|index|middle|pinky|ring|thumb)/.test(vJointName(v)));
const DRAPE_BINS = 48;
/** How far the body reaches from the centre line at height y, in DRAPE_BINS directions round it (bin 0 at -x) */
const hullAt = (y, tol = 0.012 * H) => {
  let r = new Array(DRAPE_BINS).fill(0);
  for (const p of trunkPts) {
    if (Math.abs(p[1] - y) > tol) continue;
    const dx = p[0] - waist.cx, dz = p[2] - waist.cz;
    const b = Math.floor(((Math.atan2(dz, dx) + Math.PI) / (2 * Math.PI)) * DRAPE_BINS) % DRAPE_BINS;
    r[b] = Math.max(r[b], Math.hypot(dx, dz));
  }
  // Below the hips, across the gap between the legs (the widest within a few bins either way); round the waist
  // and hips it keeps the body's own line, so it stays under the hem of whatever top is worn over it. Then smoothed
  const reach = y > hipY + 0.012 * H ? 1 : y > hipY - 0.03 * H ? 3 : 5;
  r = r.map((_, b) => { let m = 0; for (let k = -reach; k <= reach; k++) m = Math.max(m, r[(b + k + DRAPE_BINS) % DRAPE_BINS]); return m; });
  for (let it = 0; it < 4; it++) r = r.map((x, b) => (r[(b + DRAPE_BINS - 1) % DRAPE_BINS] + 2 * x + r[(b + 1) % DRAPE_BINS]) / 4);
  return r;
};
const hullRadius = (r, a) => {
  const f = ((a + Math.PI) / (2 * Math.PI)) * DRAPE_BINS - 0.5, b0 = ((Math.floor(f) % DRAPE_BINS) + DRAPE_BINS) % DRAPE_BINS, t = f - Math.floor(f);
  return r[b0] * (1 - t) + r[(b0 + 1) % DRAPE_BINS] * t;
};
/** Several joints' shares as the four largest, adding to 1 */
const mixWeights = (pairs) => {
  const m = new Map();
  for (const [j, w] of pairs) if (w > 1e-4 && j >= 0) m.set(j, (m.get(j) ?? 0) + w);
  const top = [...m].sort((a, b) => b[1] - a[1]).slice(0, 4);
  const sum = top.reduce((s, [, w]) => s + w, 0) || 1;
  const j = [0, 0, 0, 0], w = [0, 0, 0, 0];
  top.forEach(([jj, ww], k) => { j[k] = jj; w[k] = ww / sum; });
  return { j, w };
};
const smooth01 = (x) => { const t = Math.max(0, Math.min(1, x)); return t * t * (3 - 2 * t); };
// The cloth rig: bones under the pelvis for hanging cloth only: the front and the back of it, and its left and right
// sides, each with a lower part from the knees down. They have no animation of their own: the game turns them every
// frame (src/graphics/people/ClothRig.ts). The front follows whichever leg is forward, the back whichever is behind,
// each side its own leg once it swings from standing. They live in a skin of their own, used only by the garments
// that hang from them: the character's skin, its joints and its animation are exactly as they were.
const clothRig = (() => {
  const pelIBM = new Array(16);
  ibm.getElement(jIndex('pelvis'), pelIBM);
  const local = (p) => [pelIBM[0] * p[0] + pelIBM[4] * p[1] + pelIBM[8] * p[2] + pelIBM[12], pelIBM[1] * p[0] + pelIBM[5] * p[1] + pelIBM[9] * p[2] + pelIBM[13], pelIBM[2] * p[0] + pelIBM[6] * p[1] + pelIBM[10] * p[2] + pelIBM[14]];
  const mid = (a, b) => [(J(a)[0] + J(b)[0]) / 2, (J(a)[1] + J(b)[1]) / 2, (J(a)[2] + J(b)[2]) / 2];
  const tHip = local(mid('thigh_l', 'thigh_r'));
  const tKnee = local(mid('calf_l', 'calf_r'));
  const pelvisNode = joints[jIndex('pelvis')];
  const ibmAt = (t) => { const m = pelIBM.slice(); m[12] -= t[0]; m[13] -= t[1]; m[14] -= t[2]; return m; };
  const firstJoint = joints.length;
  const added = [];
  const rigNodes = [];
  const addBone = (name, parent, t, total) => {
    const n = doc.createNode(name).setTranslation(t);
    parent.addChild(n);
    rigNodes.push(n);
    jointNames.push(name);
    added.push(ibmAt(total));
    return n;
  };
  const down = [tKnee[0] - tHip[0], tKnee[1] - tHip[1], tKnee[2] - tHip[2]];
  const front = addBone('cloth_front', pelvisNode, tHip, tHip);
  addBone('cloth_front_low', front, down, tKnee);
  const back = addBone('cloth_back', pelvisNode, tHip, tHip);
  addBone('cloth_back_low', back, down, tKnee);
  // Each side turns at its own hip and bends at its own knee
  for (const s of ['l', 'r']) {
    const hip = local(J(`thigh_${s}`)), knee = local(J(`calf_${s}`));
    const side = addBone(`cloth_side_${s}`, pelvisNode, hip, hip);
    addBone(`cloth_side_${s}_low`, side, [knee[0] - hip[0], knee[1] - hip[1], knee[2] - hip[2]], knee);
  }
  const old = ibm.getArray();
  const arr = new Float32Array(old.length + added.length * 16);
  arr.set(old);
  added.forEach((m, k) => arr.set(m, old.length + k * 16));
  const rigSkin = doc.createSkin('Cloth_Skin').setInverseBindMatrices(doc.createAccessor('Cloth_Skin_ibm').setType('MAT4').setArray(arr).setBuffer(root.listBuffers()[0]));
  for (const j of joints) rigSkin.addJoint(j);
  for (const n of rigNodes) rigSkin.addJoint(n);
  if (skin.getSkeleton()) rigSkin.setSkeleton(skin.getSkeleton());
  return { skin: rigSkin, firstJoint, f: jIndex('cloth_front'), fl: jIndex('cloth_front_low'), b: jIndex('cloth_back'), bl: jIndex('cloth_back_low'),
    side: { l: jIndex('cloth_side_l'), r: jIndex('cloth_side_r') }, sideLow: { l: jIndex('cloth_side_l_low'), r: jIndex('cloth_side_r_low') } };
})();
/** How a point of hanging cloth rides the skeleton (see above): the hips above, the cloth rig below, front to back
 *  by where round the body it hangs, each side on its own side bone, upper to lower at the knees */
const drapeSkin = (p, spec) => {
  const leg = ramp(hipY + 0.03 * H - p[1], 0, hipY + 0.03 * H - kneeY) * (spec.legMax ?? 0.92);
  const dz = (p[2] - waist.cz) / (Math.hypot(p[0] - waist.cx, p[2] - waist.cz) || 1);
  const f = Math.max(0, Math.min(1, 0.5 + 0.8 * dz)); // the face is toward +z
  const low = ramp(kneeY + 0.02 * H - p[1], 0, 0.09 * H);
  // At the sides the cloth rides that side's own cloth bone, from high on the thigh down (those bones do not move
  // while standing, so the standing line and the print stay as they are)
  const across = (p[0] - waist.cx) / (Math.hypot(p[0] - waist.cx, p[2] - waist.cz) || 1);
  const a01 = Math.max(0, Math.min(1, (Math.abs(across) - 0.4) / 0.4));
  const onSide = spec.room === false ? 0 : a01 * a01 * (3 - 2 * a01);
  const legSide = across * sideSign > 0 ? 'l' : 'r';
  const reach = Math.max(1e-3, 0.5 * (hipY + 0.03 * H - kneeY));
  const high = Math.max(0, Math.min(1, (hipY + 0.03 * H - p[1]) / reach));
  const sideLeg = (high * high * (3 - 2 * high)) * ((spec.legMax ?? 0.92) < 0.6 ? spec.legMax : 1);
  const toSide = Math.max(leg, sideLeg) * onSide, toCloth = leg * (1 - onSide);
  const pairs = [[clothRig.f, toCloth * f * (1 - low)], [clothRig.fl, toCloth * f * low], [clothRig.b, toCloth * (1 - f) * (1 - low)], [clothRig.bl, toCloth * (1 - f) * low],
    [clothRig.side[legSide], toSide * (1 - low)], [clothRig.sideLow[legSide], toSide * low]];
  // Above the hip joints it rides as the body under it does (the waist bends with the spine)
  const body = torsoSkinAt(p, /^(pelvis|spine_0)/);
  const share = Math.max(0, 1 - toSide - toCloth);
  for (let k = 0; k < 4; k++) pairs.push([body.j[k], body.w[k] * share]);
  return mixWeights(pairs);
};
// The legs as they really stand, measured in the game's own pose (tools/characters/measure_hand_room.mjs, relative to the
// pelvis). The T-pose legs stand wider than that, so cloth shaped on them would swallow the hands hanging beside the
// hips. From the hips to the fingertips hanging cloth falls straight, one smooth section round the legs as they stand;
// below the fingertips it is free to flare. There are no pockets carved for the hands: the line stays clean.
const ROOM = (() => {
  const all = JSON.parse(fs.readFileSync(new URL('./hand_room.json', import.meta.url), 'utf8'));
  const { top, step, bins, rows } = all;
  const own = all[gender];
  const around = (b) => ((b % bins) + bins) % bins;
  const from = Math.max(0, Math.floor((top - 0.02) / step));
  const to = Math.min(rows - 1, Math.floor((top - own.fingertip) / step));
  // The furthest the legs reach in each direction between the hips and the fingertips
  let column = new Array(bins).fill(0);
  for (let row = from; row <= to; row++) own.legs[row].forEach((x, b) => { column[b] = Math.max(column[b], x ?? 0); });
  // The tightest smooth section round both legs: their convex outline (straight across the gap between them, so no
  // lobes or notches, and no wider over the front of the thighs, where the fingers rest), its corners softened
  const angle = (i) => ((i + 0.5) / bins) * 2 * Math.PI - Math.PI;
  const pts = column.map((r, i) => [Math.cos(angle(i)) * r, Math.sin(angle(i)) * r]).filter(([x, z]) => x || z).sort((p, q) => p[0] - q[0] || p[1] - q[1]);
  const turn = (o, p, q) => (p[0] - o[0]) * (q[1] - o[1]) - (p[1] - o[1]) * (q[0] - o[0]);
  const chain = (list) => { const h = []; for (const q of list) { while (h.length > 1 && turn(h[h.length - 2], h[h.length - 1], q) <= 0) h.pop(); h.push(q); } h.pop(); return h; };
  const hull = [...chain(pts), ...chain([...pts].reverse())];
  column = column.map((_, i) => {
    const dx = Math.cos(angle(i)), dz = Math.sin(angle(i));
    let far = 0;
    hull.forEach((p, e) => {
      const q = hull[(e + 1) % hull.length], ex = q[0] - p[0], ez = q[1] - p[1], det = dx * ez - dz * ex;
      if (Math.abs(det) < 1e-9) return;
      const t = (p[0] * ez - p[1] * ex) / det, u = (p[0] * dz - p[1] * dx) / det;
      if (t > 0 && u >= -1e-6 && u <= 1 + 1e-6) far = Math.max(far, t);
    });
    return far;
  });
  for (let it = 0; it < 3; it++) column = column.map((x, b) => (column[around(b - 1)] + 2 * x + column[around(b + 1)]) / 4);
  return { bins, column, fingertips: J('pelvis')[1] + own.fingertip };
})();
/**
 * The radius of hanging cloth at height y and direction a. At the sides, where the hands hang, it falls from the hips
 * round the legs as they stand (`gap` off them) and its own flare is added only from the fingertips down, so a pencil
 * skirt stays straight and an A-line opens below the hands. The front and back keep their natural fall. `flare` scales
 * the garment's flare; `sidesOnly` narrows the fit to the very sides (a peplum).
 */
const fitToRoom = (base, t, y, a, spec) => {
  const easeNow = spec.ease(t, a);
  const free = base + easeNow * H;
  if (spec.room === false) return free;
  const pelvis = J('pelvis');
  const c = Math.cos(a), sn = Math.sin(a);
  const f = ((Math.atan2(sn, c) + Math.PI) / (2 * Math.PI)) * ROOM.bins - 0.5;
  const b0 = ((Math.floor(f) % ROOM.bins) + ROOM.bins) % ROOM.bins, u = f - Math.floor(f);
  const reach = ROOM.column[b0] * (1 - u) + ROOM.column[(b0 + 1) % ROOM.bins] * u;
  // The section is measured round the pelvis, the cloth round the waist's middle
  const standing = reach - ((waist.cx - pelvis[0]) * c + (waist.cz - pelvis[2]) * sn) + (spec.gap ?? 0.007);
  // The garment's own flare, counted from the fingertips down
  const tf = Math.max(0, Math.min(1, (spec.top - ROOM.fingertips) / (spec.top - spec.hem)));
  const grow = t > tf ? Math.max(0, easeNow - spec.ease(tf, a)) * smooth01((t - tf) / Math.max(1e-3, 1 - tf)) : 0;
  const fitted = standing + grow * H * (spec.flare ?? 1);
  const above = 1 - smooth01((y - (pelvis[1] + 0.02)) / 0.07);
  // How far round from the side this direction is: the whole fit at the sides, none at the middle of the front and back
  const fromSide = Math.min(Math.abs(a), Math.PI - Math.abs(a));
  const side = spec.sidesOnly ? c * c : 1 - smooth01((fromSide - 0.96) / 0.52);
  const out = free + (fitted - free) * above * side;
  if (!spec.join) return out;
  // Joined to the bodice above it: just inside its hem, easing away below it, so there is no ledge at the waist
  const joined = hullRadius(spec.join, a) - 0.0015 * H;
  return out + (joined - out) * (1 - smooth01(((spec.joinY ?? waistY) - y) / ((spec.joinFade ?? 0.07) * H)));
};
/** How far out a top's cloth stands round the body at height y (arms apart): what the cloth hanging from it joins */
const hemProfile = (shell, y) => {
  let r = new Array(DRAPE_BINS).fill(0);
  for (let i = 0; i < shell.P.length; i += 3) {
    const q = [shell.P[i], shell.P[i + 1], shell.P[i + 2]];
    if (Math.abs(q[1] - y) > 0.014 * H || inArm(q)) continue;
    const dx = q[0] - waist.cx, dz = q[2] - waist.cz;
    const b = Math.floor(((Math.atan2(dz, dx) + Math.PI) / (2 * Math.PI)) * DRAPE_BINS) % DRAPE_BINS;
    r[b] = Math.max(r[b], Math.hypot(dx, dz));
  }
  for (let pass = 0; pass < DRAPE_BINS && r.some((x) => !x); pass++) r = r.map((x, b) => x || r[(b + 1) % DRAPE_BINS] || r[(b + DRAPE_BINS - 1) % DRAPE_BINS]);
  for (let it = 0; it < 3; it++) r = r.map((x, b) => (r[(b + DRAPE_BINS - 1) % DRAPE_BINS] + 2 * x + r[(b + 1) % DRAPE_BINS]) / 4);
  return r;
};
/**
 * A tube of hanging cloth from height `top` down to `hem`: spec.ease(t) (in body heights; t 0 at the top, 1 at the
 * hem) out from the body, pleats { n, depth }, an arc [a0, a1] for a panel that does not go all round,
 * legMax (how much of the legs' swing it takes at the knee: less for wide cloth, which has room), seg, rings.
 */
function drape(given) {
  // Cloth joined to a bodice starts at the bodice's hem (the waist narrows above it: it would stand out there)
  const spec = given.join ? { ...given, top: (given.joinY ?? waistY) + 0.002 * H } : given;
  const g = geoOf();
  const seg = spec.seg ?? 64, rows = spec.rings ?? 22;
  const arc = spec.arc ?? null;
  const thick = (spec.thick ?? 0.004) * H, lip = (spec.lip ?? 0.022) * H;
  // Rings from the top to the hem, then the hem turned up inside (its thickness)
  const rings = [];
  let prev = null;
  for (let k = 0; k <= rows; k++) {
    const t = k / rows;
    const y = spec.top + (spec.hem - spec.top) * t;
    let r = hullAt(Math.max(y, groundY + 0.03 * H));
    if (prev && spec.free !== false) r = r.map((x, b) => Math.max(x, prev[b]));
    prev = r;
    rings.push({ y, t, r, inset: 0 });
  }
  const last = rings[rings.length - 1];
  rings.push({ y: last.y, t: 1, r: last.r, inset: thick }, { y: last.y + lip, t: 1, r: last.r, inset: thick });
  const grid = rings.map(({ y, t, r, inset }) => {
    const row = [];
    for (let k = 0; k <= seg; k++) {
      if (!arc && k === seg) { row.push(row[0]); break; }
      const a = arc ? arc[0] + ((arc[1] - arc[0]) * k) / seg : -Math.PI + (k / seg) * 2 * Math.PI;
      let rad = fitToRoom(hullRadius(r, a), t, y, a, spec) - inset;
      if (spec.pleats) {
        const f = (k / seg) * spec.pleats.n;
        rad += spec.pleats.depth * H * ramp(t, 0.04, 0.25) * (Math.abs((f % 1) - 0.5) * 2 - 0.5);
      }
      const p = [waist.cx + Math.cos(a) * rad, y, waist.cz + Math.sin(a) * rad];
      const sk = drapeSkin(p, spec);
      g.P.push(...p); g.N.push(Math.cos(a), 0, Math.sin(a)); g.U.push(0, 0); g.JJ.push(...sk.j); g.WW.push(...sk.w);
      row.push(g.P.length / 3 - 1);
    }
    return row;
  });
  for (let r = 0; r < grid.length - 1; r++) for (let k = 0; k < grid[r].length - 1; k++) {
    const a = grid[r][k], b = grid[r][k + 1], c = grid[r + 1][k], d = grid[r + 1][k + 1];
    g.I.push(a, c, b, b, c, d);
  }
  // Every face turned outward (away from the centre line), except the turned-up hem inside
  for (let t = 0; t < g.I.length; t += 3) {
    const [i0, i1, i2] = [g.I[t], g.I[t + 1], g.I[t + 2]];
    const A = g.P.slice(i0 * 3, i0 * 3 + 3), B = g.P.slice(i1 * 3, i1 * 3 + 3), C = g.P.slice(i2 * 3, i2 * 3 + 3);
    const e1 = [B[0] - A[0], B[1] - A[1], B[2] - A[2]], e2 = [C[0] - A[0], C[1] - A[1], C[2] - A[2]];
    const fn = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]];
    const out = [(A[0] + B[0] + C[0]) / 3 - waist.cx, 0, (A[2] + B[2] + C[2]) / 3 - waist.cz];
    if (fn[0] * out[0] + fn[2] * out[2] < 0) { g.I[t + 1] = i2; g.I[t + 2] = i1; }
  }
  return withNormals(g);
}
/** A skirt's top: just inside the hem of any top worn over it */
const skirtTop = waistY + 0.012 * H;
const miniHemY = hipY - 0.5 * (hipY - kneeY);
const kneeHemY = kneeY - 0.035 * H;
const floorHemY = ankleY - 0.004 * H;
const midThighY = hipY - 0.4 * (hipY - kneeY);
/** The top of a dress's or tunic's skirt: tucked up under the bodice's hem */
const tuckTop = waistY + 0.035 * H;
/** Closes the small gaps a shell cut from the body can have (a wide sleeve pulls them open). Hems, cuffs and necks are far longer */
const closeSmallHoles = (g, most = 6) => {
  const count = g.P.length / 3, weld = new Map(), wid = new Int32Array(count), first = [];
  for (let i = 0; i < count; i++) {
    const k = `${Math.round(g.P[i * 3] * 1e4)},${Math.round(g.P[i * 3 + 1] * 1e4)},${Math.round(g.P[i * 3 + 2] * 1e4)}`;
    if (!weld.has(k)) { weld.set(k, first.length); first.push(i); }
    wid[i] = weld.get(k);
  }
  const uses = new Map();
  for (let t = 0; t < g.I.length; t += 3) for (const [a, b] of [[g.I[t], g.I[t + 1]], [g.I[t + 1], g.I[t + 2]], [g.I[t + 2], g.I[t]]]) {
    const x = wid[a], y = wid[b];
    if (x === y) continue;
    const k = x < y ? `${x}_${y}` : `${y}_${x}`;
    uses.set(k, (uses.get(k) ?? 0) + 1);
  }
  const next = new Map();
  for (const [k, n] of uses) {
    if (n !== 1) continue;
    const [x, y] = k.split('_').map(Number);
    (next.get(x) ?? next.set(x, []).get(x)).push(y);
    (next.get(y) ?? next.set(y, []).get(y)).push(x);
  }
  const seen = new Set();
  for (const start of next.keys()) {
    if (seen.has(start)) continue;
    const loop = [start];
    seen.add(start);
    for (let cur = start; ;) {
      const go = next.get(cur).find((w) => !seen.has(w));
      if (go === undefined) break;
      seen.add(go);
      loop.push(go);
      cur = go;
    }
    if (loop.length < 3 || loop.length > most || !next.get(loop[loop.length - 1]).includes(start) || loop.some((w) => next.get(w).length !== 2)) continue;
    const v = loop.map((w) => first[w]);
    const nor = [0, 1, 2].map((k) => v.reduce((sum, i) => sum + g.N[i * 3 + k], 0));
    for (let i = 1; i < v.length - 1; i++) {
      const [a, b, c] = [v[0], v[i], v[i + 1]];
      const u = [0, 1, 2].map((k) => g.P[b * 3 + k] - g.P[a * 3 + k]), w = [0, 1, 2].map((k) => g.P[c * 3 + k] - g.P[a * 3 + k]);
      const f = [u[1] * w[2] - u[2] * w[1], u[2] * w[0] - u[0] * w[2], u[0] * w[1] - u[1] * w[0]];
      if (f[0] * nor[0] + f[1] * nor[1] + f[2] * nor[2] < 0) g.I.push(a, c, b);
      else g.I.push(a, b, c);
    }
  }
  return g;
};
/** The narrowest height of the torso above a tee's hem: a seam there follows the body instead of turning at the hips */
const narrowestWaist = () => {
  let best = waistY, least = Infinity;
  for (let y = waistY; y < waistY + 0.12 * H; y += 0.004 * H) {
    let r = 0;
    for (const q of trunkPts) if (Math.abs(q[1] - y) < 0.006 * H) r = Math.max(r, Math.hypot(q[0] - NECK.cx, q[2] - NECK.cz));
    if (r && r < least) { least = r; best = y; }
  }
  return best;
};
/**
 * A sleeveless bodice cut for itself, not from the body's triangles: a front and a back panel laid over the torso, each
 * as wide as the torso up to the armpit and then curving in to the neck, so the armholes are one clean line. It stands
 * `off` from the body and rides the chest and back as the skin under it does.
 */
const halterBodice = (off, low = waistY - 0.002 * H) => {
  const under = J('upperarm_l')[1] - 0.05 * H;
  const BINS = 72, ROWS = 32, COLS = 26;
  const cache = new Map();
  const torsoAt = (y) => {
    const key = Math.round(y / (0.004 * H));
    if (cache.has(key)) return cache.get(key);
    let r = new Array(BINS).fill(0);
    for (const q of trunkPts) {
      if (Math.abs(q[1] - y) > 0.012 * H) continue;
      const dx = q[0] - NECK.cx, dz = q[2] - NECK.cz;
      const b = Math.floor(((Math.atan2(dz, dx) + Math.PI) / (2 * Math.PI)) * BINS) % BINS;
      r[b] = Math.max(r[b], Math.hypot(dx, dz));
    }
    for (let pass = 0; pass < BINS && r.some((x) => !x); pass++) r = r.map((x, b) => x || r[(b + 1) % BINS] || r[(b + BINS - 1) % BINS]);
    for (let it = 0; it < 3; it++) r = r.map((x, b) => (r[(b + BINS - 1) % BINS] + 2 * x + r[(b + 1) % BINS]) / 4);
    cache.set(key, r);
    return r;
  };
  const radiusAt = (r, a) => {
    const f = ((a + Math.PI) / (2 * Math.PI)) * BINS - 0.5, b0 = ((Math.floor(f) % BINS) + BINS) % BINS, t = f - Math.floor(f);
    return r[b0] * (1 - t) + r[(b0 + 1) % BINS] * t;
  };
  const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
  const sideAt = (y) => { const r = torsoAt(y); return Math.max(radiusAt(r, 0), radiusAt(r, Math.PI)); };
  const wide = sideAt(under), neckWide = NECK_CUT + 0.016 * H;
  const panel = (centre) => {
    const rad = [], ys = [], angs = [];
    for (let i = 0; i <= ROWS; i++) {
      const v = i / ROWS;
      const rRow = [], yRow = [], aRow = [];
      for (let k = 0; k <= COLS; k++) {
        const u = k / COLS;
        const ringA = centre + (Math.PI / 2) * (2 * u - 1);
        const top = neckLineY(NECK.cx + Math.cos(ringA) * NECK_CUT, NECK.cz + Math.sin(ringA) * NECK_CUT);
        const y = low + (top - low) * v;
        const r = torsoAt(y);
        // Full width to the armpit; above it the panel's edge curves in to the side of the neck
        let half = Math.PI / 2;
        if (y > under) {
          const s = Math.min(1, (y - under) / Math.max(1e-3, top - under));
          const limit = neckWide + (wide - neckWide) * (1 - s) ** 1.6;
          half = Math.asin(Math.min(1, limit / Math.max(1e-3, sideAt(y))));
          // The foot of the armhole is round, not a V between the two panels
          const R = 0.03 * H, dy = y - under;
          if (dy < R) half = Math.min(half, Math.PI / 2 - Math.sqrt(Math.max(0, R * R - (R - dy) * (R - dy))) / Math.max(1e-3, sideAt(y)));
          half += (Math.PI / 2 - half) * smooth01((v - 0.88) / 0.12);
        }
        const a = wrap(centre + half * (2 * u - 1));
        const body = radiusAt(r, a) + off * H;
        rRow.push(body + (NECK_CUT + off * H - body) * smooth01((v - 0.78) / 0.22));
        yRow.push(y);
        aRow.push(a);
      }
      rad.push(rRow); ys.push(yRow); angs.push(aRow);
    }
    // The armhole as one smooth line: no corner where it leaves the side seam or on its way up to the neck
    const across = angs.map((row) => row.map((a) => wrap(a - centre)));
    for (let it = 0; it < 4; it++) {
      const was = across.map((row) => row.slice());
      for (let i = 1; i < ROWS; i++) for (let k = 0; k <= COLS; k++) {
        if (ys[i][k] > under) across[i][k] = (was[i - 1][k] + 2 * was[i][k] + was[i + 1][k]) / 4;
      }
    }
    for (let i = 0; i <= ROWS; i++) for (let k = 0; k <= COLS; k++) angs[i][k] = wrap(centre + across[i][k]);
    // Eased over the body's small bumps, the neck edge left where it is
    for (let it = 0; it < 4; it++) {
      const was = rad.map((row) => row.slice());
      for (let i = 1; i < ROWS; i++) for (let k = 1; k < COLS; k++) rad[i][k] = (was[i - 1][k] + was[i + 1][k] + was[i][k - 1] + was[i][k + 1] + 2 * was[i][k]) / 6;
    }
    return { rad, ys, angs };
  };
  const front = panel(Math.PI / 2), back = panel(-Math.PI / 2);
  // Where the panels meet down the sides, one line
  for (let i = 0; i <= ROWS; i++) {
    if (front.ys[i][0] > under) continue;
    const a = (front.rad[i][0] + back.rad[i][COLS]) / 2, b = (front.rad[i][COLS] + back.rad[i][0]) / 2;
    front.rad[i][0] = a; back.rad[i][COLS] = a;
    front.rad[i][COLS] = b; back.rad[i][0] = b;
    back.ys[i][COLS] = front.ys[i][0]; back.ys[i][0] = front.ys[i][COLS];
    back.angs[i][COLS] = front.angs[i][0]; back.angs[i][0] = front.angs[i][COLS];
  }
  const g = geoOf();
  for (const { rad, ys, angs } of [front, back]) {
    const grid = rad.map((row, i) => row.map((r, k) => {
      const q = [NECK.cx + Math.cos(angs[i][k]) * r, ys[i][k], NECK.cz + Math.sin(angs[i][k]) * r];
      const sk = torsoSkinAt(q);
      g.P.push(...q); g.N.push(Math.cos(angs[i][k]), 0, Math.sin(angs[i][k])); g.U.push(0, 0); g.JJ.push(...sk.j); g.WW.push(...sk.w);
      return g.P.length / 3 - 1;
    }));
    for (let i = 0; i < ROWS; i++) for (let k = 0; k < COLS; k++) {
      const q = [grid[i][k], grid[i][k + 1], grid[i + 1][k], grid[i][k + 1], grid[i + 1][k + 1], grid[i + 1][k]];
      for (let t = 0; t < 6; t += 3) {
        const [i0, i1, i2] = [q[t], q[t + 1], q[t + 2]];
        const A = g.P.slice(i0 * 3, i0 * 3 + 3), B = g.P.slice(i1 * 3, i1 * 3 + 3), C = g.P.slice(i2 * 3, i2 * 3 + 3);
        const e1 = [B[0] - A[0], B[1] - A[1], B[2] - A[2]], e2 = [C[0] - A[0], C[1] - A[1], C[2] - A[2]];
        const fn = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]];
        const out = [(A[0] + B[0] + C[0]) / 3 - NECK.cx, 0, (A[2] + B[2] + C[2]) / 3 - NECK.cz];
        if (fn[0] * out[0] + fn[2] * out[2] < 0) g.I.push(i0, i2, i1);
        else g.I.push(i0, i1, i2);
      }
    }
  }
  return withNormals(g);
};
/** The inside of a high neck: a facing from the collar in to the neck, so no gap shows between them at the back */
const neckFacing = (off) => {
  const g = geoOf(), cols = [];
  for (let k = 0; k < NECK_BINS; k++) {
    const a = ((k + 0.5) / NECK_BINS) * 2 * Math.PI - Math.PI, dx = Math.cos(a), dz = Math.sin(a);
    const y = neckLineY(NECK.cx + dx * NECK_CUT, NECK.cz + dz * NECK_CUT) - 0.003 * H;
    const at = (r) => [NECK.cx + dx * r, y, NECK.cz + dz * r];
    cols.push([pushV(g, at(NECK_CUT + off * H), [0, 1, 0], sp3), pushV(g, at(NECK.r - 0.004 * H), [0, 1, 0], sp3)]);
  }
  for (let k = 0; k < cols.length; k++) {
    const A = cols[k], B = cols[(k + 1) % cols.length];
    g.I.push(A[0], A[1], B[0], B[0], A[1], B[1]);
  }
  return g;
};
/**
 * A clean finished edge round a sleeveless top's armholes: the edge left by the cut is smoothed along itself, then
 * bound with a narrow strip of the same cloth rolled over it (it moves with the cloth it is sewn on).
 */
const finishArmholes = (g, above = waistY + 0.04 * H) => {
  const count = g.P.length / 3, weld = new Map(), wid = new Int32Array(count), members = [];
  for (let i = 0; i < count; i++) {
    const k = `${Math.round(g.P[i * 3] * 1e4)},${Math.round(g.P[i * 3 + 1] * 1e4)},${Math.round(g.P[i * 3 + 2] * 1e4)}`;
    if (!weld.has(k)) { weld.set(k, members.length); members.push([]); }
    wid[i] = weld.get(k);
    members[wid[i]].push(i);
  }
  const at = (w) => { const i = members[w][0]; return [g.P[i * 3], g.P[i * 3 + 1], g.P[i * 3 + 2]]; };
  const uses = new Map();
  for (let t = 0; t < g.I.length; t += 3) for (const [a, b] of [[g.I[t], g.I[t + 1]], [g.I[t + 1], g.I[t + 2]], [g.I[t + 2], g.I[t]]]) {
    const x = wid[a], y = wid[b], k = x < y ? `${x}_${y}` : `${y}_${x}`;
    uses.set(k, (uses.get(k) ?? 0) + 1);
  }
  const onArmhole = (w) => { const q = at(w); return q[1] > above && Math.hypot(q[0] - NECK.cx, q[2] - NECK.cz) > NECK_CUT + 0.035 * H; };
  const next = new Map();
  for (const [k, n] of uses) {
    if (n !== 1) continue;
    const [x, y] = k.split('_').map(Number);
    if (!onArmhole(x) || !onArmhole(y)) continue;
    (next.get(x) ?? next.set(x, []).get(x)).push(y);
    (next.get(y) ?? next.set(y, []).get(y)).push(x);
  }
  const seen = new Set(), loops = [];
  for (const start of next.keys()) {
    if (seen.has(start)) continue;
    const loop = [start];
    seen.add(start);
    for (let cur = start; ;) {
      const go = next.get(cur).find((w) => !seen.has(w));
      if (go === undefined) break;
      seen.add(go);
      loop.push(go);
      cur = go;
    }
    if (loop.length >= 8) loops.push(loop);
  }
  const strip = geoOf();
  for (const loop of loops) {
    const n = loop.length, closed = next.get(loop[n - 1]).includes(loop[0]);
    let pts = loop.map(at);
    for (let it = 0; it < 14; it++) pts = pts.map((q, i) => (!closed && (i === 0 || i === n - 1) ? q : [0, 1, 2].map((k) => (pts[(i + n - 1) % n][k] + 2 * q[k] + pts[(i + 1) % n][k]) / 4)));
    loop.forEach((w, i) => { for (const v of members[w]) { g.P[v * 3] = pts[i][0]; g.P[v * 3 + 1] = pts[i][1]; g.P[v * 3 + 2] = pts[i][2]; } });
    const rows = pts.map((q, i) => {
      const v = members[loop[i]][0];
      const nor = norm3([g.N[v * 3], g.N[v * 3 + 1], g.N[v * 3 + 2]]);
      const prev = closed ? pts[(i + n - 1) % n] : pts[Math.max(0, i - 1)], nxt = closed ? pts[(i + 1) % n] : pts[Math.min(n - 1, i + 1)], tan = norm3([nxt[0] - prev[0], nxt[1] - prev[1], nxt[2] - prev[2]]);
      // An open run's binding narrows away at its two ends
      const taper = closed ? 1 : smooth01(Math.min(i, n - 1 - i) / 4);
      let inward = norm3([nor[1] * tan[2] - nor[2] * tan[1], nor[2] * tan[0] - nor[0] * tan[2], nor[0] * tan[1] - nor[1] * tan[0]]);
      if (inward[0] * (waist.cx - q[0]) + inward[2] * (waist.cz - q[2]) < 0) inward = inward.map((x) => -x);
      const add = (d0, o0) => { const d = d0 * taper, o = o0 * taper; return [q[0] + inward[0] * d * H + nor[0] * o * H, q[1] + inward[1] * d * H + nor[1] * o * H, q[2] + inward[2] * d * H + nor[2] * o * H]; };
      const j = [g.JJ[v * 4], g.JJ[v * 4 + 1], g.JJ[v * 4 + 2], g.JJ[v * 4 + 3]], ww = [g.WW[v * 4], g.WW[v * 4 + 1], g.WW[v * 4 + 2], g.WW[v * 4 + 3]];
      return [add(0.007, 0.0012), add(0.003, 0.0026), add(-0.0012, 0.0018), add(-0.0016, -0.0004)].map((c) => {
        strip.P.push(...c); strip.N.push(...nor); strip.U.push(0, 0); strip.JJ.push(...j); strip.WW.push(...ww);
        return strip.P.length / 3 - 1;
      });
    });
    for (let i = 0; i < (closed ? n : n - 1); i++) for (let r = 0; r < 3; r++) {
      const a = rows[i][r], b = rows[(i + 1) % n][r], c = rows[i][r + 1], d = rows[(i + 1) % n][r + 1];
      strip.I.push(a, c, b, b, c, d);
    }
  }
  return withNormals(strip);
};
/** A standing collar (a senator's or kaftan's band round the neck) */
const bandCollar = (h = 0.03, out = 0.02) => band(sp3, [NECK.cx, neckY - 0.022 * H, NECK.cz], X, Z, Y, h * H, (s) => [NECK_CUT - NECK.r + neck.rx + (out - 0.004 * s) * H, NECK_CUT - NECK.r + neck.rz + (out - 0.004 * s) * H], { seg: 40 });
/** Buttons down one side of the chest (a senator's offset fastening) */
const sideButtons = (n = 5) => {
  const parts = [];
  for (let k = 0; k < n; k++) {
    const y = neckY - 0.035 * H - k * 0.042 * H;
    const ring = chestFront(y);
    const x = ring.cx + sideSign * -0.05 * H;
    parts.push(box(y > J('spine_02')[1] ? sp3 : sp2, [x, y, ring.cz + ring.rz * 0.93 + 0.022 * H], [0.008 * H, 0.008 * H, 0.004 * H]));
  }
  return merge(...parts);
};
/** The wrapper's waist roll (an iro tucked and rolled at the waist) */
const waistRoll = () => drape({ top: skirtTop - 0.004 * H, hem: skirtTop - 0.03 * H, ease: (t) => 0.0125 + 0.004 * Math.sin(t * Math.PI), rings: 5, legMax: 0.1, lip: 0.004, thick: 0.002 });
// Traditional headwear: a gele (a stiff wrap fanned up and out at the back), an abeti-aja fila (a soft tall cap
// leaning to one side, its flaps folded up over the ears), a kufi (a low round cap)
const gele = () => {
  const parts = [
    dome(hd, [skull.c[0], skull.c[1] - skull.ry * 0.08, skull.c[2] - skull.rz * 0.04], skull.rx * 1.14, skull.ry * 1.16, skull.rz * 1.12, 1.6, { tilt: 0.12 }),
    band(hd, [skull.c[0], skull.c[1] - skull.ry * 0.2, skull.c[2] - skull.rz * 0.04], X, Z, Y, 0.032 * H, (s) => [skull.rx * (1.16 + 0.03 * s), skull.rz * (1.14 + 0.03 * s)], { seg: 36 }),
  ];
  // The fan: folds standing up round the back and sides of the crown, leaning out
  for (let i = 0; i < 9; i++) {
    const f = -1 + (2 * i) / 8;
    const phi = f * 1.25 + Math.PI; // round the back
    const dir = [Math.sin(phi), 0, Math.cos(phi)];
    const lean = 0.55 + 0.25 * Math.abs(f);
    const up = norm3([dir[0] * lean, 1, dir[2] * lean]);
    const across = norm3([Math.cos(phi), 0, -Math.sin(phi)]);
    const out = norm3([up[1] * dir[0], -lean, up[1] * dir[2]]);
    const c = add3(add3([skull.c[0], skull.c[1] + skull.ry * (0.72 - 0.18 * Math.abs(f)), skull.c[2] - skull.rz * 0.1], dir, skull.rx * 0.62), up, 0.045 * H);
    parts.push(pillow(hd, c, across, up, out, 0.034 * H, 0.06 * H * (1 - 0.25 * Math.abs(f)), 0.005 * H, 0.45, 7));
  }
  return merge(...parts);
};
const fila = () => {
  const g = merge(
    dome(hd, [skull.c[0], skull.c[1] - skull.ry * 0.05, skull.c[2]], skull.rx * 1.08, skull.ry * 1.5, skull.rz * 1.07, 1.5, { tilt: 0.06 }),
    band(hd, [skull.c[0], skull.c[1] - skull.ry * 0.12, skull.c[2]], X, Z, Y, 0.03 * H, () => [skull.rx * 1.1, skull.rz * 1.09], { seg: 36 }),
    // The flaps, folded up at each side over the ears
    ...[-1, 1].map((s) => pillow(hd, [skull.c[0] + s * skull.rx * 1.1, skull.c[1] + skull.ry * 0.02, skull.c[2] + skull.rz * 0.2], norm3([0, 0.35, 1]), norm3([0, 1, -0.35]), [s, 0, 0], 0.022 * H, 0.016 * H, 0.0025 * H, 0.15, 7)),
  );
  // The soft top falls over to one side
  for (let i = 0; i < g.P.length; i += 3) {
    const rise = Math.max(0, g.P[i + 1] - (skull.c[1] + skull.ry * 0.5));
    g.P[i] += sideSign * rise * 1.4;
    g.P[i + 1] -= rise * 0.45;
  }
  return withNormals(g);
};
const kufi = () => merge(
  band(hd, [skull.c[0], skull.c[1] - skull.ry * 0.12, skull.c[2] - skull.rz * 0.05], X, Z, Y, 0.06 * H, () => [skull.rx * 1.08, skull.rz * 1.07], { seg: 40 }),
  dome(hd, [skull.c[0], skull.c[1] - skull.ry * 0.12 + 0.06 * H, skull.c[2] - skull.rz * 0.05], skull.rx * 1.08, skull.ry * 0.32, skull.rz * 1.07, Math.PI / 2, { seg: 40 }),
);

const GARMENTS3 = [
  // Skirts (on the bottom's cloth): their tube hangs from the waistband, free of the legs
  ['Outfit_Skirt__mini', () => [{ mat: fab('Cloth_Bottom', 'denim'), geo: merge(drape({ top: skirtTop, hem: miniHemY, ease: (t) => 0.011 + 0.025 * t, rings: 12, legMax: 0.85 })) }]],
  ['Outfit_Skirt__knee', () => [{ mat: fab('Cloth_Bottom', 'cotton'), geo: merge(drape({ top: skirtTop, hem: kneeHemY, ease: (t) => 0.011 + 0.045 * t * t + 0.011 * t, rings: 18, legMax: 0.8 })) }]],
  ['Outfit_Skirt__maxi', () => [{ mat: fab('Cloth_Bottom', 'cotton'), geo: merge(drape({ top: skirtTop, hem: floorHemY, ease: (t) => 0.011 + 0.07 * t * t + 0.013 * t, rings: 26, legMax: 0.8 })) }]],
  ['Outfit_Skirt__pleated', () => [{ mat: fab('Cloth_Bottom', 'twill'), geo: merge(drape({ top: skirtTop, hem: kneeHemY, ease: (t) => 0.012 + 0.044 * t, rings: 16, seg: 120, legMax: 0.8, pleats: { n: 30, depth: 0.007 } })) }]],
  ['Outfit_Skirt__pencil', () => [{ mat: fab('Cloth_Bottom', 'twill'), geo: merge(drape({ top: skirtTop, hem: kneeHemY, ease: (t) => 0.011 + 0.009 * t, rings: 18, legMax: 0.95 })) }]],
  ['Outfit_Skirt__iro', () => [{ mat: fab('Cloth_Bottom', 'cotton'), geo: merge(
    drape({ top: skirtTop, hem: floorHemY, ease: (t) => 0.011 + 0.05 * t * t + 0.013 * t, rings: 26, legMax: 0.8 }),
    // The wrapper's end, lapped over the front from the waist to the hem
    drape({ top: skirtTop, hem: floorHemY, ease: (t) => 0.0165 + 0.05 * t * t + 0.013 * t, rings: 26, legMax: 0.8, gap: 0.017, arc: [0.15 * sideSign > 0 ? 0.2 : Math.PI - 1.4, 0.15 * sideSign > 0 ? 1.4 : Math.PI - 0.2], seg: 18 }),
    waistRoll(),
  ) }]],
  // Dresses and gowns (all on the top's cloth: one garment, one look): a bodice from the body, a skirt that hangs free
  ['Outfit_Dress__sundress', () => [{ mat: fab('Cloth_Top', 'cotton'), geo: merge(
    ...(() => { const top = shellOf('TopShort', null, { off: 0.016, smooth: 12, lap: 3, offAt: sleeveOpen(0.3, 0.55, 0.009) }); return [top, drape({ top: tuckTop, hem: kneeHemY, ease: (t) => 0.011 + 0.05 * t * t + 0.012 * t, rings: 20, legMax: 0.8 , join: hemProfile(top, waistY) })]; })(),
    neckRibOn(0.016),
  ) }]],
  ['Outfit_Dress__evening', () => [{ mat: fab('Cloth_Top', 'jersey'), geo: merge(
    ...(() => { const seam = narrowestWaist(), bodice = halterBodice(0.013, seam - 0.002 * H), edge = finishArmholes(bodice, seam + 0.04 * H); return [bodice, edge,
      // Close over the hips and thighs, flaring out below the knee to the floor
      drape({ top: tuckTop, hem: floorHemY, ease: (t) => 0.009 + 0.006 * ramp(t, 0, 0.5) + 0.075 * ramp(t, 0.55, 1) ** 2, rings: 28, legMax: 0.88, join: hemProfile(bodice, seam), joinY: seam, joinFade: 0.09 })]; })(),
    neckRibOn(0.013, 0.003, 0.012),
    neckFacing(0.013),
  ) }]],
  ['Outfit_Dress__gown', () => [{ mat: fab('Cloth_Top', 'cotton'), geo: merge(
    ...(() => { const top = shellOf('TopLong', null, { off: 0.018, smooth: 12, lap: 3, offAt: (p) => (inArm(p) ? 0.004 + ramp(armT(p), 1.2, 1.92) * 0.022 : 0) }); return [top, drape({ top: tuckTop, hem: floorHemY, ease: (t) => 0.013 + 0.075 * t * t + 0.012 * t, rings: 28, legMax: 0.8 , join: hemProfile(top, waistY) })]; })(),
    neckRibOn(0.018),
  ) }]],
  // Tops that reach below the waist: a peplum blouse, a buba (wide sleeves to below the elbow, hanging over the hips),
  // a kaftan (a tunic to below the knee) and a senator top (to mid-thigh, standing collar, buttoned at the side)
  ['Outfit_Top_Short__peplum', () => [{ mat: fab('Cloth_Top', 'cotton'), geo: merge(
    shellOf('TopShort', null, { off: 0.015, smooth: 12, lap: 3, offAt: sleeveOpen(0.3, 0.55, 0.006) }),
    drape({ top: waistY + 0.02 * H, hem: waistY - 0.075 * H, ease: (t) => 0.024 + 0.03 * t, rings: 8, legMax: 0.3, lip: 0.012, gap: 0.018, sidesOnly: true }),
    neckRibOn(0.015),
  ) }]],
  ['Outfit_Top_Short__buba', () => [{ mat: fab('Cloth_Top', 'cotton'), geo: merge(
    shellOf('TopShort', (p) => p[1] > waistY && p[1] < neckY && inArm(p) && armT(p) < 1.45, { hem: topHems(1.45, waistY), off: 0.022, smooth: 16, lap: 6, offAt: (p) => (inArm(p) ? 0.004 + ramp(armT(p), 0.35, 1.45) * 0.04 : 0.003) }),
    drape({ top: tuckTop - 0.01 * H, hem: hipY - 0.03 * H, ease: (t) => 0.019 + 0.008 * Math.min(1, t / 0.2) + 0.012 * t, rings: 10, legMax: 0.5, lip: 0.014, gap: 0.02  }),
    neckRibOn(0.022, 0.004, 0.016),
  ) }]],
  ['Outfit_Top_Long__kaftan', () => [{ mat: fab('Cloth_Top', 'cotton'), geo: merge(
    ...(() => { const top = shellOf('TopLong', null, { off: 0.021, smooth: 14, lap: 5, offAt: (p) => (inArm(p) ? 0.006 : 0.003) }); return [top, drape({ top: tuckTop, hem: kneeY - 0.05 * H, ease: (t) => 0.018 + 0.014 * Math.min(1, t / 0.15) + 0.022 * t, rings: 22, gap: 0.032 , join: hemProfile(top, waistY) })]; })(),
    neckRibOn(0.021, 0.004, 0.016),
    placket(0),
  ) }]],
  ['Outfit_Top_Long__senator', () => [{ mat: fab('Cloth_Top', 'cotton'), geo: merge(
    ...(() => { const top = shellOf('TopLong', null, { off: 0.02, smooth: 12, lap: 4, offAt: (p) => (inArm(p) ? 0.004 : 0.002) }); return [top, drape({ top: tuckTop, hem: midThighY, ease: (t) => 0.017 + 0.014 * Math.min(1, t / 0.15) + 0.01 * t, rings: 14, gap: 0.032 , join: hemProfile(top, waistY) })]; })(),
    bandCollar(),
    cuffs(0.86, 0.022),
  ) }, { mat: trimMat, geo: sideButtons() }]],
  // The agbada: the great outer robe, worn over a top and trousers. Wide sleeves fall from the shoulders to the
  // wrists; the robe hangs to mid-calf
  ['Outfit_Robe__agbada', () => [{ mat: fab('Cloth_Top', 'cotton'), geo: merge(
    ...(() => { const top = closeSmallHoles(shellOf('TopLong', null, { hem: topHems(1.7, waistY), off: 0.04, smooth: 18, lap: 8, offAt: (p) => (inArm(p) ? 0.008 + ramp(armT(p), 0.15, 1.6) * 0.056 : 0.004) })); return [top, drape({ top: tuckTop + 0.01 * H, hem: kneeY - 0.13 * H, ease: (t) => 0.036 + 0.012 * Math.min(1, t / 0.15) + 0.056 * t, rings: 24, legMax: 0.55, gap: 0.036, flare: 1.6 , join: hemProfile(top, waistY) })]; })(),
    bandCollar(0.024, 0.044),
  ) }]],
  // Traditional headwear
  ['Outfit_Hat__gele', () => [{ mat: fab('Cloth_Hat', 'canvas'), geo: gele() }]],
  ['Outfit_Hat__fila', () => [{ mat: fab('Cloth_Hat', 'twill'), geo: fila() }]],
  ['Outfit_Hat__kufi', () => [{ mat: fab('Cloth_Hat', 'rib'), geo: kufi() }]],
];

const GARMENTS2 = [
  // Tops, short sleeves: cotton jersey tees, a piqué polo
  ['Outfit_Top_Short__tee', () => { const sh = shellOf('TopShort', null, { off: 0.018, smooth: 12, lap: 3, offAt: sleeveOpen(0.25, 0.55, 0.011) }); return [{ mat: fab('Cloth_Top', 'jersey'), geo: sh }, { mat: fab('Cloth_Top', 'rib'), geo: neckRibOn(0.018) }]; }],
  ['Outfit_Top_Short__tee_oversized', () => { const sh = shellOf('TopShort', (p) => p[1] > waistY - 0.04 * H && p[1] < neckY && (!inArm(p) || armT(p) < 0.8), { hem: topHems(0.8, waistY - 0.04 * H), off: 0.026, smooth: 16, lap: 6, offAt: (p) => (inArm(p) ? 0.008 + ramp(armT(p), 0.2, 0.8) * 0.016 : 0.004) }); return [{ mat: fab('Cloth_Top', 'jersey'), geo: sh }, { mat: fab('Cloth_Top', 'rib'), geo: neckRibOn(0.026, 0.004, 0.02) }]; }],
  ['Outfit_Top_Short__polo', () => [{ mat: fab('Cloth_Top', 'pique'), geo: shellOf('TopShort', null, { off: 0.016, smooth: 12, lap: 3, offAt: sleeveOpen(0.3, 0.55, 0.007) }) }, { mat: fab('Cloth_Top', 'rib'), geo: foldedCollar(false) }, { mat: fab('Cloth_Top', 'pique'), geo: placket(0) }, { mat: trimMat, geo: placket(2) }]],
  // Tops, long sleeves: an oxford shirt, a fleece hoodie with rib cuffs and hem
  ['Outfit_Top_Long__shirt', () => [{ mat: fab('Cloth_Top', 'oxford'), geo: shellOf('TopLong', null, { off: 0.019, smooth: 12, lap: 3, offAt: (p) => (inArm(p) ? 0.004 : 0) }) }, { mat: fab('Cloth_Top', 'oxford'), geo: merge(foldedCollar(true), cuffs(0.86, 0.022), buttonStrip()) }, { mat: trimMat, geo: buttonLine() }]],
  ['Outfit_Top_Long__hoodie', () => { const sh = shellOf('TopLong', null, { off: 0.024, smooth: 18, lap: 8, offAt: (p) => (inArm(p) ? 0.004 : 0.002) }); return [{ mat: fab('Cloth_Top', 'fleece'), geo: merge(sh, hood(), kangaroo()) }, { mat: fab('Cloth_Top', 'rib'), geo: merge(cuffs(0.88, 0.02), ribHem(), neckRibOn(0.026, 0.004, 0.02)) }]; }],
  // Trousers: denim jeans, cotton twill cargo trousers and chinos; every leg ends over the shoe
  ['Outfit_Bottom_Long__jeans_slim', () => [{ mat: fab('Cloth_Bottom', 'denim'), geo: merge(shellOf('BottomLong', null, { off: 0.011, smooth: 14, lap: 6, ankleMin: 0.03 }), backPockets(0)) }]],
  ['Outfit_Bottom_Long__jeans_straight', () => [{ mat: fab('Cloth_Bottom', 'denim'), geo: merge(shellOf('BottomLong', null, { off: 0.013, smooth: 16, lap: 8, offAt: belowKnee(0.018), ankleMin: 0.032 }), backPockets(0.002)) }]],
  ['Outfit_Bottom_Long__jeans_baggy', () => [{ mat: fab('Cloth_Bottom', 'denim'), geo: merge(shellOf('BottomLong', null, { off: 0.022, smooth: 20, lap: 12, offAt: (p) => 0.006 + belowKnee(0.026)(p), ankleMin: 0.036 }), backPockets(0.012)) }]],
  ['Outfit_Bottom_Long__cargo', () => { const sh = shellOf('BottomLong', null, { off: 0.018, smooth: 18, lap: 10, offAt: belowKnee(0.012), ankleMin: 0.032 }); return [{ mat: fab('Cloth_Bottom', 'twill'), geo: merge(sh, cargoPockets(0.55, 0.0, sh), backPockets(0.008)) }]; }],
  ['Outfit_Bottom_Long__chinos', () => [{ mat: fab('Cloth_Bottom', 'twill'), geo: shellOf('BottomLong', null, { off: 0.014, smooth: 16, lap: 8, offAt: belowKnee(0.01), ankleMin: 0.031 }) }]],
  // Shorts: cotton twill
  ['Outfit_Bottom_Short__shorts', () => [{ mat: fab('Cloth_Bottom', 'twill'), geo: shellOf('BottomShort', null, { off: 0.016, smooth: 14, lap: 6, offAt: (p) => ramp(hipY - p[1], 0, hipY - kneeY) * 0.014 }) }]],
  ['Outfit_Bottom_Short__cargo_shorts', () => { const sh = shellOf('BottomShort', null, { off: 0.022, smooth: 16, lap: 8, offAt: (p) => ramp(hipY - p[1], 0, hipY - kneeY) * 0.012 }); return [{ mat: fab('Cloth_Bottom', 'twill'), geo: merge(sh, cargoPockets(0.6, 0.004, sh)) }]; }],
  // Headwear: a twill cap and bucket hat, a rib-knit beanie
  ['Outfit_Hat__cap', () => [{ mat: fab('Cloth_Hat', 'twill'), geo: merge(capCrown(), capBrim(), capButton()) }]],
  ['Outfit_Hat__bucket', () => [{ mat: fab('Cloth_Hat', 'twill'), geo: merge(bucketCrown(), bucketBrim()) }]],
  ['Outfit_Hat__beanie', () => [{ mat: fab('Cloth_Hat', 'rib'), geo: beanie() }]],
  // Footwear: canvas sneakers on a thick white sole, leather shoes on a thin one, leather boots up the ankle, and slides
  ['Outfit_Shoes__sneaker', () => shoe(fab('Cloth_Shoes', 'canvas'), fab('Sole', 'rubber'), 0.016, { off: 0.024, smooth: 12, lap: 26 })],
  ['Outfit_Shoes__formal', () => shoe(fab('Cloth_Shoes', 'leather'), fab('Sole', 'leather'), 0.008, { off: 0.016, smooth: 16, lap: 34 })],
  ['Outfit_Shoes__boot', () => shoe(fab('Cloth_Shoes', 'leather'), fab('Sole', 'rubber'), 0.012, { off: 0.022, smooth: 14, lap: 24, offAt: (p) => (p[1] > ankleY - 0.01 * H ? -0.004 - 0.006 * ramp(p[1], ankleY, ankleY + 0.026 * H) : 0) }, (p) => !inArm(p) && p[1] < ankleY + 0.026 * H && p[1] > groundY && p[1] < kneeY, ankleY + 0.026 * H)],
  ['Outfit_Feet__slides', () => [{ mat: fab('Cloth_Shoes', 'rubber'), geo: slides() }]],
];
plainShells();
for (const [name, make] of [...GARMENTS2, ...GARMENTS3]) addGarment(name, make());

// Everyday colours baked in (the game tints them per player): very dark brown hair, warm brown skin
for (const m of root.listMaterials()) {
  if (m.getName() === 'Hair') m.setBaseColorFactor([0.09, 0.065, 0.05, 1]);
  if (m.getName() === 'Skin_Body') m.setBaseColorFactor([0.62, 0.44, 0.33, 1]);
}
const regions = Object.fromEntries(groups);

// ---------------------------------------------------------------- animations, renamed to the game's clip names
if (animFile) {
  const WANT = JSON.parse(process.env.CLIPS ?? '{}'); // { gameName: sourceClipName }
  const animDoc = await io.read(animFile);
  const animRoot = animDoc.getRoot();
  const keep = new Set(Object.values(WANT));
  for (const a of animRoot.listAnimations()) if (!keep.has(a.getName())) { for (const smp of a.listSamplers()) smp.dispose(); for (const ch of a.listChannels()) ch.dispose(); a.dispose(); }
  // Where the animation skeleton's hips rest: hip tracks are applied as movement from there
  const animRest = Object.fromEntries(animRoot.listNodes().filter((n) => /^(root|pelvis)$/.test(n.getName())).map((n) => [n.getName(), n.getTranslation()]));
  const before = new Set(root.listAnimations());
  mergeDocuments(doc, animDoc);
  const byName = new Map(skin.listJoints().map((j) => [j.getName(), j]));
  for (const node of root.listNodes()) if (!byName.has(node.getName()) && node.getName() === 'root') byName.set('root', node);
  for (const a of root.listAnimations()) {
    if (before.has(a)) continue;
    const gameName = Object.entries(WANT).find(([, src]) => src === a.getName())?.[0];
    a.setName(gameName ?? a.getName());
    for (const ch of a.listChannels()) {
      const target = byName.get(ch.getTargetNode()?.getName());
      const path = ch.getTargetPath();
      if (!target || path === 'scale' || (path === 'translation' && !/^(root|pelvis)$/.test(target.getName()))) { const smp = ch.getSampler(); ch.dispose(); smp?.dispose(); }
      else {
        ch.setTargetNode(target);
        // The hips move as the animation's do, from this body's own rest height, not to the animation mannequin's
        if (path === 'translation' && animRest[target.getName()]) {
          const restA = animRest[target.getName()], restB = target.getTranslation();
          const out = ch.getSampler().getOutput();
          const arr = out.getArray().slice();
          for (let i = 0; i < arr.length; i += 3) for (let k = 0; k < 3; k++) arr[i + k] = restB[k] + (arr[i + k] - restA[k]);
          ch.getSampler().setOutput(doc.createAccessor().setType('VEC3').setArray(arr).setBuffer(root.listBuffers()[0]));
        }
      }
    }
  }
  // Everything the animation file brought besides its clips goes: its scene, its skeleton, its mannequin
  const disposeTree = (n) => { for (const c of n.listChildren()) disposeTree(c); n.dispose(); };
  for (const s of root.listScenes().slice(1)) { for (const n of s.listChildren()) disposeTree(n); s.dispose(); }
  for (const sk of root.listSkins()) if (sk !== skin && sk !== clothRig.skin) sk.dispose();
}

// ---------------------------------------------------------------- compact textures and tidy
await doc.transform(
  textureCompress({ encoder: sharp, targetFormat: 'webp', slots: /baseColor/, resize: [1024, 1024], quality: 85 }),
  textureCompress({ encoder: sharp, targetFormat: 'webp', slots: /normal/, resize: [1024, 1024], quality: 90 }),
  textureCompress({ encoder: sharp, targetFormat: 'webp', slots: /metallicRoughness|occlusion/, resize: [512, 512], quality: 85 }),
  resample({ tolerance: 1e-4 }),
  dedup(),
  prune(),
);
for (const b of root.listBuffers().slice(1)) { for (const a of root.listAccessors()) if (a.getBuffer() === b) a.setBuffer(buffer); b.dispose(); }
// Data left without a user by the steps above (old keyframes, merged leftovers) is dropped last
for (const acc of root.listAccessors()) if (!acc.listParents().some((p) => p.propertyType !== 'Root')) acc.dispose();
await doc.transform(prune());
await io.write(out, doc);
console.log(`wrote ${out}: height ${height.toFixed(3)} (model units), regions ${Object.entries(regions).map(([k, v]) => `${k}:${v.length / 3}`).join(' ')}, animations ${root.listAnimations().map((a) => a.getName()).join(',') || 'none'}`);
