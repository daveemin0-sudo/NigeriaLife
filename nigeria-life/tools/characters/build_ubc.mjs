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
  TopShort: (p) => p[1] > waistY && p[1] < neckY && (!inArm(p) || armT(p) < 0.55),
  TopLong: (p) => p[1] > waistY && p[1] < neckY && (!inArm(p) || armT(p) < 1.92),
  BottomLong: (p) => p[1] < beltY && p[1] > ankleY - 0.012 * height && !inArm(p), // a little over the shoe
  BottomShort: (p) => p[1] < beltY && p[1] > J('calf_l')[1] + 0.03 * height && !inArm(p),
  Shoes: (p) => p[1] <= ankleY,
};
const KINDS = Object.keys(COVER);
const vJointName = (v) => { const j4 = [0, 0, 0, 0], w4 = [0, 0, 0, 0]; jnt.getElement(v, j4); wgt.getElement(v, w4); let b = 0; for (let k = 1; k < 4; k++) if (w4[k] > w4[b]) b = k; return jointNames[j4[b]]; };
// Hands and head are never covered (a sleeve stops at the wrist; the neck is open)
const never = (t) => [idx[t], idx[t + 1], idx[t + 2]].every((v) => /^(Head|hand_|index|middle|pinky|ring|thumb)/.test(vJointName(v)));
const triCovered = (t, kind) => {
  const a = P0[idx[t]], b = P0[idx[t + 1]], c = P0[idx[t + 2]];
  return COVER[kind]([(a[0] + b[0] + c[0]) / 3, (a[1] + b[1] + c[1]) / 3, (a[2] + b[2] + c[2]) / 3]);
};

// ---------------------------------------------------------------- the body in pieces, by what can cover them
// Each piece is named Body_c<mask>, one digit per garment kind (TopShort TopLong BottomLong BottomShort Shoes):
// the game hides a piece when any garment it shows has a 1 in that piece's mask.
const groups = new Map();
const masks = [];
for (let t = 0; t < idx.length; t += 3) {
  const mask = never(t) ? '00000' : KINDS.map((k) => (triCovered(t, k) ? '1' : '0')).join('');
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
for (const shell of SHELLS) {
  const tris = [];
  for (let t = 0; t < idx.length; t += 3) if (masks[t / 3][kIndex[shell.kind]] === '1') tris.push(idx[t], idx[t + 1], idx[t + 2]);
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
  const nb = Array.from({ length: W }, () => new Set());
  for (let t = 0; t < tris.length; t += 3) {
    const a = wOf[local.get(tris[t])], b = wOf[local.get(tris[t + 1])], c = wOf[local.get(tris[t + 2])];
    nb[a].add(b).add(c); nb[b].add(a).add(c); nb[c].add(a).add(b);
  }
  // The garment's edges (hems, cuffs, neckline) are held where the body is, so smoothing cannot open a gap
  const edgeUse = new Map();
  for (let t = 0; t < tris.length; t += 3) {
    const a = wOf[local.get(tris[t])], b = wOf[local.get(tris[t + 1])], c = wOf[local.get(tris[t + 2])];
    for (const [x, y] of [[a, b], [b, c], [c, a]]) { const k = x < y ? `${x}_${y}` : `${y}_${x}`; edgeUse.set(k, (edgeUse.get(k) ?? 0) + 1); }
  }
  const pinned = new Set();
  for (const [k, n] of edgeUse) if (n === 1) for (const w of k.split('_')) pinned.add(+w);
  // Plain smoothing first where shape should go entirely (toes in a shoe, knees in trousers), then Taubin
  for (let it = 0; it < (shell.lap ?? 0); it++) {
    wp = wp.map((p, w) => {
      if (!nb[w].size || pinned.has(w)) return p;
      const avg = [0, 0, 0];
      for (const n of nb[w]) { avg[0] += wp[n][0]; avg[1] += wp[n][1]; avg[2] += wp[n][2]; }
      return p.map((x, k) => x + 0.5 * (avg[k] / nb[w].size - x));
    });
  }
  // Taubin smoothing: takes the muscle detail out without shrinking the garment
  for (let it = 0; it < shell.smooth; it++) {
    for (const lambda of [0.5, -0.53]) {
      wp = wp.map((p, w) => {
        if (!nb[w].size || pinned.has(w)) return p;
        const avg = [0, 0, 0];
        for (const n of nb[w]) { avg[0] += wp[n][0]; avg[1] += wp[n][1]; avg[2] += wp[n][2]; }
        return p.map((x, k) => x + lambda * (avg[k] / nb[w].size - x));
      });
    }
  }
  const wn = Array.from({ length: W }, () => [0, 0, 0]);
  for (let t = 0; t < tris.length; t += 3) {
    const a = wOf[local.get(tris[t])], b = wOf[local.get(tris[t + 1])], c = wOf[local.get(tris[t + 2])];
    const A = wp[a], B = wp[b], C = wp[c];
    const e1 = [B[0] - A[0], B[1] - A[1], B[2] - A[2]], e2 = [C[0] - A[0], C[1] - A[1], C[2] - A[2]];
    const fn = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]];
    for (const w of [a, b, c]) { wn[w][0] += fn[0]; wn[w][1] += fn[1]; wn[w][2] += fn[2]; }
  }
  const P = [], N = [], U = [], JJ = [], WW = [];
  const off = shell.off * height;
  order.forEach((v, i) => {
    const w = wOf[i];
    let n = wn[w];
    const len = Math.hypot(n[0], n[1], n[2]) || 1;
    n = n.map((x) => x / len);
    // Facing out, as the body's own normal does
    if (n[0] * N0[v][0] + n[1] * N0[v][1] + n[2] * N0[v][2] < 0) n = n.map((x) => -x);
    P.push(wp[w][0] + n[0] * off, wp[w][1] + n[1] * off, wp[w][2] + n[2] * off);
    N.push(...n);
    uv.getElement(v, uv2); jnt.getElement(v, j4); wgt.getElement(v, w4);
    U.push(...uv2); JJ.push(...j4); WW.push(...w4);
  });
  const outIdx = new Uint32Array(tris.map((v) => local.get(v)));
  const prim = doc.createPrimitive().setMaterial(shell.mat)
    .setIndices(accessor(`${shell.name}_idx`, 'SCALAR', outIdx))
    .setAttribute('POSITION', accessor(`${shell.name}_pos`, 'VEC3', new Float32Array(P)))
    .setAttribute('NORMAL', accessor(`${shell.name}_nor`, 'VEC3', new Float32Array(N)))
    .setAttribute('TEXCOORD_0', accessor(`${shell.name}_uv`, 'VEC2', new Float32Array(U)))
    .setAttribute('JOINTS_0', accessor(`${shell.name}_j`, 'VEC4', new Uint8Array(JJ)))
    .setAttribute('WEIGHTS_0', accessor(`${shell.name}_w`, 'VEC4', new Float32Array(WW)));
  scene.addChild(doc.createNode(shell.name).setMesh(doc.createMesh(shell.name).addPrimitive(prim)).setSkin(skin));
}
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
  for (const sk of root.listSkins()) if (sk !== skin) sk.dispose();
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
