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
/**
 * A garment's shell: the body's triangles it covers (pick(t), by triangle start index), welded, smoothed
 * (muscle out, edges pinned), and set out from the body by `off` (a fraction of the body's height) plus
 * offAt(p) at each point p of the body (a silhouette: a leg that does not taper, a sleeve that opens).
 */
function makeShell(pick, spec) {
  const tris = [];
  for (let t = 0; t < idx.length; t += 3) if (pick(t)) tris.push(idx[t], idx[t + 1], idx[t + 2]);
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
  if (spec.hem) wp = wp.map((p, w) => {
    const q = spec.hem(p, pinned.has(w));
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
    if (hemmed[w] >= 0) {
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
    o *= height;
    P.push(wp[w][0] + n[0] * o, wp[w][1] + n[1] * o, wp[w][2] + n[2] * o);
    N.push(...n);
    uv.getElement(v, uv2); jnt.getElement(v, j4); wgt.getElement(v, w4);
    U.push(...uv2); JJ.push(...j4); WW.push(...w4);
  });
  return { P, N, U, JJ, WW, I: tris.map((v) => local.get(v)) };
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
  scene.addChild(doc.createNode(name).setMesh(mesh).setSkin(skin));
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
  const geo = makeShell((t) => masks[t / 3][kIndex[shell.kind]] === '1', { ...shell, hem: HEMS[shell.kind]() });
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
  const outer = pts.reduce((m, p) => (sign * p[0] > sign * m ? p[0] : m), A[0]);
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
  band(sp3, [neck.cx, neckY - 0.014 * H, neck.cz], X, Z, Y, 0.024 * H, (s) => [neck.rx + (0.009 + 0.002 * s) * H, neck.rz + (0.009 + 0.002 * s) * H], { skip: [Math.PI / 2 - 0.42, Math.PI / 2 + 0.42] }),
  band(sp3, [neck.cx, neckY + 0.01 * H, neck.cz], X, Z, Y, -0.026 * H, (s) => [neck.rx + (0.013 + 0.012 * s) * H, neck.rz + (0.013 + 0.012 * s) * H], { skip: [Math.PI / 2 - (points ? 0.25 : 0.42), Math.PI / 2 + (points ? 0.25 : 0.42)] }),
);
const chestFront = (y) => ringAt((v, p) => torso(v) && !inArm(p), y, 0.008 * H);
const placket = (count) => {
  const top = neckY - 0.03 * H;
  const parts = [];
  const ring = chestFront(top - 0.03 * H);
  const z = ring.cz + ring.rz + 0.021 * H;
  parts.push(box(sp3, [ring.cx, top - 0.032 * H, z - 0.002 * H], [0.016 * H, 0.06 * H, 0.002 * H]));
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
  // The strip the buttons are sewn on
  const yTop = neckY - 0.02 * H, yBot = waistY + 0.01 * H;
  const ring = chestFront((yTop + yBot) / 2);
  parts.push(box(sp2, [ring.cx, (yTop + yBot) / 2, ring.cz + ring.rz + 0.0195 * H], [0.02 * H, yTop - yBot, 0.002 * H]));
  return merge(...parts);
};
const cuffs = (t, thick) => merge(...['l', 'r'].map((s) => {
  const w = wristRing(s, t);
  const dir = Math.sign(J(`hand_${s}`)[0] - J(`lowerarm_${s}`)[0]);
  return band(jIndex(`lowerarm_${s}`), [w.at[0] - dir * 0.02 * H, w.at[1], w.at[2]], Y, Z, [dir, 0, 0], 0.035 * H, () => [w.ry + thick * H, w.rz + thick * H]);
}));
const ribHem = () => topHem(waistY, 0.028, 0.034);
const hood = () => {
  const back = neck.cz - neck.rz;
  return dome(sp3, [neck.cx, neckY - 0.03 * H, back - 0.025 * H], 0.07 * H, 0.05 * H, 0.045 * H, 1.5, { tilt: -1.2 });
};
const kangaroo = () => {
  const y = waistY + 0.06 * H;
  const ring = chestFront(y);
  return box(sp1, [ring.cx, y, ring.cz + ring.rz + 0.027 * H], [0.15 * H, 0.065 * H, 0.004 * H]);
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
const backPockets = (extra) => merge(...[-1, 1].map((s) => {
  const th = thighSide(s > 0 ? (J('thigh_l')[0] > 0 ? 'l' : 'r') : (J('thigh_l')[0] > 0 ? 'r' : 'l'), 0.05);
  return box(pel, [s * 0.04 * H + waist.cx, hipY - 0.008 * H, th.back - (0.012 + extra) * H], [0.052 * H, 0.06 * H, 0.003 * H], -s * 0.3);
}));
const cargoPockets = (t, extra) => merge(...['l', 'r'].map((s) => {
  const th = thighSide(s, t);
  const ji = jIndex(`thigh_${s}`);
  return merge(
    box(ji, [th.x + th.sign * (0.023 + extra) * H, th.y, th.cz], [0.01 * H, 0.095 * H, 0.08 * H]),
    box(ji, [th.x + th.sign * (0.029 + extra) * H, th.y + 0.043 * H, th.cz], [0.004 * H, 0.028 * H, 0.084 * H]),
  );
}));
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
  return [J(a)[0] + (J(b)[0] - J(a)[0]) * u, p[1], p[2]];
};
/** Hems for a top: sleeves end at armT `sleeve`, the body at `bottom`, the neckline at neckY */
const topHems = (sleeve, bottom) => (p, edge) => {
  if (inArm(p)) return armStop(p, sleeve, edge);
  let y = Math.min(neckY, Math.max(bottom, p[1]));
  // Edge points just above the hem, or just under the neckline, onto the line
  if (edge && y < bottom + 0.035 * height) y = bottom;
  if (edge && y > neckY - 0.03 * height) y = neckY;
  return [p[0], y, p[2]];
};
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
const topHem = (y, out, len = 0.03) => {
  const r = ringAt((v, p) => torso(v) && !inArm(p), y, 0.01 * H);
  return band(sp1, [r.cx, y - len * 0.5 * H, r.cz], X, Z, Y, len * H, () => [r.rx + out * H, r.rz + out * H]);
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
const shellOf = (kind, extraCover, spec) => makeShell((t) => masks[t / 3][kIndex[kind]] === '1' || (extraCover ? triCoveredBy(t, extraCover) : false), { hem: KIND_HEMS[kind](), ...(kind.startsWith('Bottom') ? { snugAbove: waistY - 0.03 * H } : {}), ...spec });
const triCoveredBy = (t, test) => {
  if (never(t)) return false;
  const a = P0[idx[t]], b = P0[idx[t + 1]], c = P0[idx[t + 2]];
  return test([(a[0] + b[0] + c[0]) / 3, (a[1] + b[1] + c[1]) / 3, (a[2] + b[2] + c[2]) / 3]);
};
const GARMENTS2 = [
  // Tops, short sleeves
  ['Outfit_Top_Short__tee', () => [{ mat: topMat, geo: shellOf('TopShort', null, { off: 0.018, smooth: 12, lap: 3, offAt: sleeveOpen(0.25, 0.55, 0.011) }) }, { mat: topMat, geo: crewRib() }]],
  ['Outfit_Top_Short__tee_oversized', () => [{ mat: topMat, geo: shellOf('TopShort', (p) => p[1] > waistY - 0.04 * H && p[1] < neckY && (!inArm(p) || armT(p) < 0.8), { hem: topHems(0.8, waistY - 0.04 * H), off: 0.026, smooth: 16, lap: 6, offAt: (p) => (inArm(p) ? 0.008 + ramp(armT(p), 0.2, 0.8) * 0.016 : 0.004) }) }, { mat: topMat, geo: band(sp3, [neck.cx, neckY - 0.014 * H, neck.cz], X, Z, Y, 0.014 * H, (s) => [neck.rx + (0.02 - 0.004 * s) * H, neck.rz + (0.02 - 0.004 * s) * H]) }]],
  ['Outfit_Top_Short__polo', () => [{ mat: topMat, geo: shellOf('TopShort', null, { off: 0.016, smooth: 12, lap: 3, offAt: sleeveOpen(0.3, 0.55, 0.007) }) }, { mat: topMat, geo: foldedCollar(false) }, { mat: topMat, geo: placket(0) }, { mat: trimMat, geo: placket(2) }]],
  // Tops, long sleeves
  ['Outfit_Top_Long__shirt', () => [{ mat: topMat, geo: shellOf('TopLong', null, { off: 0.019, smooth: 12, lap: 3, offAt: (p) => (inArm(p) ? 0.004 : 0) }) }, { mat: topMat, geo: foldedCollar(true) }, { mat: topMat, geo: cuffs(0.86, 0.022) }, { mat: trimMat, geo: buttonLine() }]],
  ['Outfit_Top_Long__hoodie', () => [{ mat: topMat, geo: shellOf('TopLong', null, { off: 0.024, smooth: 18, lap: 8, offAt: (p) => (inArm(p) ? 0.004 : 0.002) }) }, { mat: topMat, geo: hood() }, { mat: topMat, geo: kangaroo() }, { mat: topMat, geo: cuffs(0.88, 0.02) }, { mat: topMat, geo: ribHem() }]],
  // Trousers
  ['Outfit_Bottom_Long__jeans_slim', () => [{ mat: bottomMat, geo: shellOf('BottomLong', null, { off: 0.011, smooth: 14, lap: 6 }) }, { mat: bottomMat, geo: backPockets(0) }]],
  ['Outfit_Bottom_Long__jeans_straight', () => [{ mat: bottomMat, geo: shellOf('BottomLong', null, { off: 0.013, smooth: 16, lap: 8, offAt: belowKnee(0.018) }) }, { mat: bottomMat, geo: backPockets(0.002) }]],
  ['Outfit_Bottom_Long__jeans_baggy', () => [{ mat: bottomMat, geo: shellOf('BottomLong', null, { off: 0.022, smooth: 20, lap: 12, offAt: (p) => 0.006 + belowKnee(0.026)(p) }) }, { mat: bottomMat, geo: backPockets(0.012) }]],
  ['Outfit_Bottom_Long__cargo', () => [{ mat: bottomMat, geo: shellOf('BottomLong', null, { off: 0.018, smooth: 18, lap: 10, offAt: belowKnee(0.012) }) }, { mat: bottomMat, geo: cargoPockets(0.55, 0.0) }, { mat: bottomMat, geo: backPockets(0.008) }]],
  ['Outfit_Bottom_Long__chinos', () => [{ mat: bottomMat, geo: shellOf('BottomLong', null, { off: 0.014, smooth: 16, lap: 8, offAt: belowKnee(0.01) }) }, ]],
  // Shorts
  ['Outfit_Bottom_Short__shorts', () => [{ mat: bottomMat, geo: shellOf('BottomShort', null, { off: 0.016, smooth: 14, lap: 6, offAt: (p) => ramp(hipY - p[1], 0, hipY - kneeY) * 0.014 }) }]],
  ['Outfit_Bottom_Short__cargo_shorts', () => [{ mat: bottomMat, geo: shellOf('BottomShort', null, { off: 0.022, smooth: 16, lap: 8, offAt: (p) => ramp(hipY - p[1], 0, hipY - kneeY) * 0.012 }) }, { mat: bottomMat, geo: cargoPockets(0.6, 0.004) }]],
  // Headwear
  ['Outfit_Hat__cap', () => [{ mat: hatMat, geo: capCrown() }, { mat: hatMat, geo: capBrim() }, { mat: hatMat, geo: capButton() }]],
  ['Outfit_Hat__bucket', () => [{ mat: hatMat, geo: bucketCrown() }, { mat: hatMat, geo: bucketBrim() }]],
  ['Outfit_Hat__beanie', () => [{ mat: hatMat, geo: beanie() }]],
];
plainShells();
for (const [name, make] of GARMENTS2) addGarment(name, make());

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
