// Gives each hanging garment a seated shape, as a morph target named `Seated`, solved here and not at run time.
//
// Bones alone cannot lay cloth over a lap. This takes the seated pose as the game plays it (seated_pose.json, from
// measure_seated_pose.mjs), starts each hanging garment from where the cloth bones put it with what is below the knee
// hanging as a curtain, and lets it settle under gravity: edges keep their length, and the cloth stays outside the
// legs, hips and whatever is worn under it, and rests on a seat. The settled
// shape is stored as a difference from the standing garment, so the standing geometry is untouched and the game blends
// to it as the thighs come up (src/graphics/people/ClothRig.ts). Only garments on the cloth skin are touched.
//
//   node add_seated.mjs <in.glb> <out.glb> <male|female>     (after add_lod.mjs: the far-away copies get the shape too)
import fs from 'node:fs';
import { NodeIO, Accessor } from '@gltf-transform/core';
import { ALL_EXTENSIONS, KHRMeshQuantization } from '@gltf-transform/extensions';

const [input, output, gender] = process.argv.slice(2);
const pose = JSON.parse(fs.readFileSync(new URL('./seated_pose.json', import.meta.url), 'utf8'))[gender];
if (!pose) throw new Error(`no seated pose for ${gender}`);
const S = pose.S;

const SETTLE = 170, ITERATIONS = 5, GRAVITY = 0.00055, DAMPING = 0.9;
const STRETCH = 0.85, COMPRESS = 0.22, BEND = 0.1;
/** Round the body cloth gives: a narrow skirt spans thighs set apart by stretching across, not by sliding off one */
const HOOP_GIVE = 1.5;
/** How far a tunic's body comes down over its skirt part when seated, so the waist join stays covered */
const JOIN_DROP = 0.035;
const BODY_GAP = 0.007, CLOTH_GAP = 0.005, CELL = 0.012;
const ARM = /^(upperarm|lowerarm|hand|clavicle|neck|Head|index|middle|pinky|ring|thumb)/;
const LEG_OR_HIP = /^(pelvis|spine_01|spine_02|thigh|calf|foot|ball)/;

// In the order they are solved: what is worn over something else comes after it
const GARMENTS = [
  ['Outfit_Skirt__mini', 'skirt'], ['Outfit_Skirt__knee', 'skirt'], ['Outfit_Skirt__maxi', 'skirt'], ['Outfit_Skirt__pleated', 'skirt'],
  ['Outfit_Skirt__pencil', 'skirt'], ['Outfit_Skirt__iro', 'skirt'],
  ['Outfit_Dress__sundress', 'dress'], ['Outfit_Dress__evening', 'dress'], ['Outfit_Dress__gown', 'dress'],
  ['Outfit_Top_Short__peplum', 'over', ['Outfit_Skirt__pencil']], ['Outfit_Top_Short__buba', 'over', ['Outfit_Skirt__iro']],
  ['Outfit_Top_Long__kaftan', 'tunic'], ['Outfit_Top_Long__senator', 'tunic'],
  ['Outfit_Robe__agbada', 'tunic'],
];
/** Tops a skirt is worn over: its waist has to stay outside them when the body bends */
const TUCKED = ['Outfit_Top_Short', 'Outfit_Top_Long', 'Outfit_Top_Short__tee', 'Outfit_Top_Short__polo', 'Outfit_Top_Long__shirt'];

const smooth01 = (x) => { const t = Math.max(0, Math.min(1, x)); return t * t * (3 - 2 * t); };

const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const doc = await io.read(input);
const nodes = new Map(doc.getRoot().listNodes().map((n) => [n.getName(), n]));
const restOf = (name) => nodes.get(name).getWorldTranslation();

/** A primitive's vertices as plain arrays, with each vertex's blended skinning matrix (3x4) */
const readPrim = (prim) => {
  const P = prim.getAttribute('POSITION').getArray(), N = prim.getAttribute('NORMAL')?.getArray() ?? null;
  const J = prim.getAttribute('JOINTS_0').getArray(), W = prim.getAttribute('WEIGHTS_0').getArray();
  const count = P.length / 3, M = new Float64Array(count * 12), main = new Int16Array(count);
  for (let v = 0; v < count; v++) {
    let best = 0;
    for (let k = 0; k < 4; k++) {
      const w = W[v * 4 + k];
      if (w > W[v * 4 + best]) best = k;
      if (!w) continue;
      const s = S[J[v * 4 + k]];
      for (let c = 0; c < 4; c++) for (let r = 0; r < 3; r++) M[v * 12 + c * 3 + r] += w * s[c * 4 + r];
    }
    main[v] = J[v * 4 + best];
  }
  return { P, N, M, main, count, I: prim.getIndices().getArray() };
};
const apply = (M, v, x, y, z, out, o) => {
  const b = v * 12;
  out[o] = M[b] * x + M[b + 3] * y + M[b + 6] * z + M[b + 9];
  out[o + 1] = M[b + 1] * x + M[b + 4] * y + M[b + 7] * z + M[b + 10];
  out[o + 2] = M[b + 2] * x + M[b + 5] * y + M[b + 8] * z + M[b + 11];
};
/** The rest-pose point that a posed point comes from, through a vertex's blended matrix */
const unapply = (M, v, x, y, z, out) => {
  const b = v * 12;
  const [a, d, g, e, h, k, c, f, i] = [M[b], M[b + 3], M[b + 6], M[b + 1], M[b + 4], M[b + 7], M[b + 2], M[b + 5], M[b + 8]];
  const A = h * i - k * f, B = k * c - e * i, C = e * f - h * c;
  let det = a * A + d * B + g * C;
  if (Math.abs(det) < 0.05) det = det < 0 ? -0.05 : 0.05;
  const tx = x - M[b + 9], ty = y - M[b + 10], tz = z - M[b + 11];
  out[0] = (A * tx + (g * f - d * i) * ty + (d * k - g * h) * tz) / det;
  out[1] = (B * tx + (a * i - g * c) * ty + (g * e - a * k) * tz) / det;
  out[2] = (C * tx + (d * c - a * f) * ty + (a * h - d * e) * tz) / det;
};

/** A surface to stay outside: posed points with outward normals and how far to keep from them */
const surfaceOf = (name, keep) => {
  const node = nodes.get(name), X = [], Nn = [], out = [0, 0, 0];
  if (!node?.getMesh()) return { X, Nn };
  for (const prim of node.getMesh().listPrimitives()) {
    const g = readPrim(prim);
    for (let v = 0; v < g.count; v++) {
      if (!keep(pose.joints[g.main[v]] ?? '')) continue;
      apply(g.M, v, g.P[v * 3], g.P[v * 3 + 1], g.P[v * 3 + 2], out, 0);
      X.push(out[0], out[1], out[2]);
      const b = v * 12, [nx, ny, nz] = [g.N[v * 3], g.N[v * 3 + 1], g.N[v * 3 + 2]];
      const ax = g.M[b] * nx + g.M[b + 3] * ny + g.M[b + 6] * nz, ay = g.M[b + 1] * nx + g.M[b + 4] * ny + g.M[b + 7] * nz, az = g.M[b + 2] * nx + g.M[b + 5] * ny + g.M[b + 8] * nz;
      const l = Math.hypot(ax, ay, az) || 1;
      Nn.push(ax / l, ay / l, az / l);
    }
  }
  return { X, Nn };
};

/** For any point near the body: the nearest surface point (a grid filled by two sweeps each way, so a lookup is one read) */
const makeField = (surfaces) => {
  const X = [], Nn = [], gap = [];
  for (const [s, g] of surfaces) { for (const x of s.X) X.push(x); for (const n of s.Nn) Nn.push(n); for (let i = 0; i < s.X.length / 3; i++) gap.push(g); }
  const count = X.length / 3, lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < count; i++) for (let k = 0; k < 3; k++) { lo[k] = Math.min(lo[k], X[i * 3 + k]); hi[k] = Math.max(hi[k], X[i * 3 + k]); }
  for (let k = 0; k < 3; k++) { lo[k] -= 0.12; hi[k] += 0.12; }
  const nx = Math.ceil((hi[0] - lo[0]) / CELL), ny = Math.ceil((hi[1] - lo[1]) / CELL), nz = Math.ceil((hi[2] - lo[2]) / CELL);
  const seed = new Int32Array(nx * ny * nz).fill(-1), at = (x, y, z) => x + nx * (y + ny * z);
  for (let i = 0; i < count; i++) seed[at(Math.floor((X[i * 3] - lo[0]) / CELL), Math.floor((X[i * 3 + 1] - lo[1]) / CELL), Math.floor((X[i * 3 + 2] - lo[2]) / CELL))] = i;
  const OFF = [];
  for (let z = -1; z <= 0; z++) for (let y = -1; y <= 1; y++) for (let x = -1; x <= 1; x++) if (z < 0 || y < 0 || (y === 0 && x < 0)) OFF.push([x, y, z]);
  const dist = (i, cx, cy, cz) => (X[i * 3] - cx) ** 2 + (X[i * 3 + 1] - cy) ** 2 + (X[i * 3 + 2] - cz) ** 2;
  const visit = (x, y, z, sign) => {
    const c = at(x, y, z), cx = lo[0] + (x + 0.5) * CELL, cy = lo[1] + (y + 0.5) * CELL, cz = lo[2] + (z + 0.5) * CELL;
    let best = seed[c], bd = best < 0 ? Infinity : dist(best, cx, cy, cz);
    for (const [a, b, d] of OFF) {
      const px = x + sign * a, py = y + sign * b, pz = z + sign * d;
      if (px < 0 || py < 0 || pz < 0 || px >= nx || py >= ny || pz >= nz) continue;
      const q = seed[at(px, py, pz)];
      if (q < 0 || q === best) continue;
      const e = dist(q, cx, cy, cz);
      if (e < bd) { bd = e; best = q; }
    }
    seed[c] = best;
  };
  for (let pass = 0; pass < 2; pass++) {
    for (let z = 0; z < nz; z++) for (let y = 0; y < ny; y++) for (let x = 0; x < nx; x++) visit(x, y, z, 1);
    for (let z = nz - 1; z >= 0; z--) for (let y = ny - 1; y >= 0; y--) for (let x = nx - 1; x >= 0; x--) visit(x, y, z, -1);
  }
  return {
    X, Nn, gap,
    nearest(px, py, pz) {
      const x = Math.floor((px - lo[0]) / CELL), y = Math.floor((py - lo[1]) / CELL), z = Math.floor((pz - lo[2]) / CELL);
      return x < 0 || y < 0 || z < 0 || x >= nx || y >= ny || z >= nz ? -1 : seed[at(x, y, z)];
    },
  };
};

const bodySurfaces = [...nodes.keys()].filter((n) => /^Body_c/.test(n) && nodes.get(n).getMesh()).map((n) => [surfaceOf(n, (j) => LEG_OR_HIP.test(j)), BODY_GAP]);
const clothSurface = (n) => [surfaceOf(n, (j) => !ARM.test(j)), CLOTH_GAP];

// Where the seat is: just under the thighs and hips, from behind the hips to a little short of the knees
const point = (name) => { const r = restOf(name), j = pose.joints.indexOf(name), s = S[j]; return [0, 1, 2].map((k) => s[k] * r[0] + s[4 + k] * r[1] + s[8 + k] * r[2] + s[12 + k]); };
const pelvisRest = restOf('pelvis'), pelvis = point('pelvis'), knee = [point('calf_l'), point('calf_r')];
const kneeZ = Math.min(knee[0][2], knee[1][2]);
let seatY = Infinity;
for (const n of nodes.keys()) {
  if (!/^Body_c/.test(n) || !nodes.get(n).getMesh()) continue;
  const s = surfaceOf(n, (j) => /^(pelvis|thigh)/.test(j));
  for (let i = 0; i < s.X.length; i += 3) if (s.X[i + 2] < kneeZ - 0.1) seatY = Math.min(seatY, s.X[i + 1]);
}
let rear = Infinity;
for (const n of nodes.keys()) {
  if (!/^Body_c/.test(n) || !nodes.get(n).getMesh()) continue;
  const b = surfaceOf(n, (j) => /^(pelvis|thigh)/.test(j));
  for (let i = 0; i < b.X.length; i += 3) if (b.X[i + 1] < pelvis[1] + 0.05) rear = Math.min(rear, b.X[i + 2]);
}
const SEAT = { y: seatY - 0.008, x: 0.25, rear: rear - 0.008, front: kneeZ - 0.07 };

const fields = new Map();
/** How high the tops of the thighs are, over the floor plan: the front of the cloth lies on them, never under them */
const LAP_CELL = 0.012;
const lapOf = (names) => {
  const pts = [];
  for (const n of names) {
    if (!nodes.get(n)?.getMesh()) continue;
    // The thighs, and the front of the hips they run into (a short skirt lies wholly on that part)
    const b = surfaceOf(n, (j) => /^(thigh|pelvis)/.test(j));
    for (let i = 0; i < b.X.length; i += 3) if (b.X[i + 2] > pelvis[2] && b.X[i + 1] < pelvis[1] + 0.07) pts.push(b.X[i], b.X[i + 1], b.X[i + 2]);
  }
  const x0 = pelvis[0] - 0.4, z0 = pelvis[2] - 0.1, w = Math.ceil(0.8 / LAP_CELL), d = Math.ceil(0.9 / LAP_CELL);
  let top = new Float32Array(w * d).fill(-Infinity);
  for (let i = 0; i < pts.length; i += 3) {
    const a = Math.floor((pts[i] - x0) / LAP_CELL), b = Math.floor((pts[i + 2] - z0) / LAP_CELL);
    if (a >= 0 && b >= 0 && a < w && b < d) top[a + w * b] = Math.max(top[a + w * b], pts[i + 1]);
  }
  // Holes between vertices closed, then eased so the cloth does not take the mesh's steps
  for (let pass = 0; pass < 3; pass++) {
    const was = top.slice();
    for (let b = 1; b < d - 1; b++) for (let a = 1; a < w - 1; a++) {
      if (was[a + w * b] !== -Infinity) continue;
      const near = [was[a - 1 + w * b], was[a + 1 + w * b], was[a + w * (b - 1)], was[a + w * (b + 1)]].filter((v) => v !== -Infinity);
      if (near.length >= 2) top[a + w * b] = near.reduce((u, v) => u + v, 0) / near.length;
    }
  }
  for (let pass = 0; pass < 2; pass++) {
    const was = top.slice();
    for (let b = 1; b < d - 1; b++) for (let a = 1; a < w - 1; a++) {
      if (was[a + w * b] === -Infinity) continue;
      const near = [was[a - 1 + w * b], was[a + 1 + w * b], was[a + w * (b - 1)], was[a + w * (b + 1)]].filter((v) => v !== -Infinity);
      top[a + w * b] = (was[a + w * b] * 2 + near.reduce((u, v) => u + v, 0)) / (2 + near.length);
    }
  }
  return (px, pz) => {
    const a = Math.floor((px - x0) / LAP_CELL), b = Math.floor((pz - z0) / LAP_CELL);
    return a < 0 || b < 0 || a >= w || b >= d ? -Infinity : top[a + w * b];
  };
};
const bodyNames = [...nodes.keys()].filter((n) => /^Body_c/.test(n));
const lapBare = lapOf(bodyNames), lapTrousers = lapOf([...bodyNames, 'Outfit_Bottom_Long__chinos']);
const fieldOf = (key, make) => fields.get(key) ?? fields.set(key, makeField([make()])).get(key);

const solved = new Map();
const report = [];

/** Lets one garment settle on the posed body, and returns its posed points by welded point */
const settle = (name, kind, over = []) => {
  const node = nodes.get(name), prims = node.getMesh().listPrimitives().map(readPrim);
  // Welded points (a seam's two copies move as one)
  const key = (x, y, z) => `${Math.round(x * 2e4)},${Math.round(y * 2e4)},${Math.round(z * 2e4)}`;
  const ids = new Map(), rest = [], start = [], armed = [], out = [0, 0, 0], maps = [];
  for (const g of prims) {
    const map = new Int32Array(g.count);
    for (let v = 0; v < g.count; v++) {
      const [x, y, z] = [g.P[v * 3], g.P[v * 3 + 1], g.P[v * 3 + 2]], k = key(x, y, z);
      let id = ids.get(k);
      if (id === undefined) {
        id = rest.length / 3;
        ids.set(k, id);
        rest.push(x, y, z);
        apply(g.M, v, x, y, z, out, 0);
        start.push(out[0], out[1], out[2]);
        armed.push(ARM.test(pose.joints[g.main[v]] ?? '') ? 1 : 0);
      }
      map[v] = id;
    }
    maps.push(map);
  }
  const n = rest.length / 3;
  // How free each point is: held at the waist and on the arms, free from the hips down
  const top = pelvisRest[1] + 0.04, free = new Float64Array(n), hits = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    if (armed[i]) continue;
    free[i] = smooth01((top - rest[i * 3 + 1]) / 0.09);
    hits[i] = free[i] > 0 || (kind === 'skirt' && rest[i * 3 + 1] < pelvisRest[1] + 0.17) ? 1 : 0;
  }
  // Edges keep their length; pairs across an edge keep the cloth from creasing sharply
  const seen = new Map(), tris = [];
  const edge = (a, b, c) => { const k = a < b ? a * n + b : b * n + a; (seen.get(k) ?? seen.set(k, { a, b, opp: [] }).get(k)).opp.push(c); };
  prims.forEach((g, p) => {
    const m = maps[p];
    for (let t = 0; t < g.I.length; t += 3) {
      const [a, b, c] = [m[g.I[t]], m[g.I[t + 1]], m[g.I[t + 2]]];
      if (a === b || b === c || a === c) continue;
      tris.push(a, b, c);
      edge(a, b, c); edge(b, c, a); edge(c, a, b);
    }
  });
  const standing = Float64Array.from(start);
  if (kind === 'tunic') {
    const root = Int32Array.from({ length: n }, (_, i) => i);
    const find = (a) => { while (root[a] !== a) { root[a] = root[root[a]]; a = root[a]; } return a; };
    for (let t = 0; t < tris.length; t += 3) { root[find(tris[t])] = find(tris[t + 1]); root[find(tris[t + 1])] = find(tris[t + 2]); }
    let low = 0;
    for (let i = 1; i < n; i++) if (rest[i * 3 + 1] < rest[low * 3 + 1]) low = i;
    const hanging = find(low);
    let hemOfBody = Infinity;
    for (let i = 0; i < n; i++) if (find(i) !== hanging && !armed[i]) hemOfBody = Math.min(hemOfBody, rest[i * 3 + 1]);
    if (hemOfBody !== Infinity) for (let i = 0; i < n; i++) {
      if (find(i) === hanging || armed[i]) continue;
      start[i * 3 + 1] -= JOIN_DROP * smooth01((hemOfBody + 0.06 - rest[i * 3 + 1]) / 0.06);
    }
  }
  const len = (a, b) => Math.hypot(rest[a * 3] - rest[b * 3], rest[a * 3 + 1] - rest[b * 3 + 1], rest[a * 3 + 2] - rest[b * 3 + 2]);
  const links = [], bends = [], hoops = [];
  const across = (a, b) => Math.abs(rest[a * 3 + 1] - rest[b * 3 + 1]) < 0.5 * len(a, b);
  for (const e of seen.values()) {
    if (free[e.a] || free[e.b]) (across(e.a, e.b) ? hoops : links).push(e.a, e.b, len(e.a, e.b));
    if (e.opp.length >= 2 && (free[e.opp[0]] || free[e.opp[1]])) (across(e.opp[0], e.opp[1]) ? hoops : bends).push(e.opp[0], e.opp[1], len(e.opp[0], e.opp[1]));
  }
  // Each layer on its own, so a point inside a top is still seen as inside it and not as outside the body beneath
  const layers = [{ field: fieldOf('body', () => {
    const X = [], Nn = [];
    for (const [b] of bodySurfaces) { for (const v of b.X) X.push(v); for (const v of b.Nn) Nn.push(v); }
    return [{ X, Nn }, BODY_GAP];
  }), waist: false }];
  if (kind === 'skirt') for (const t of TUCKED) layers.push({ field: fieldOf(t, () => clothSurface(t)), waist: true });
  if (kind === 'tunic') layers.push({ field: fieldOf('chinos', () => clothSurface('Outfit_Bottom_Long__chinos')), waist: false });
  // The robe goes over the long-sleeved top worn under it
  if (/Robe/.test(name)) layers.push({ field: fieldOf('Outfit_Top_Long', () => clothSurface('Outfit_Top_Long')), waist: false });
  for (const o of over) { const u = solved.get(o); if (u) layers.push({ field: fieldOf(`solved_${o}`, () => [u.surface, CLOTH_GAP]), waist: false }); }
  const lap = kind === 'tunic' ? lapTrousers : lapBare, lapGap = kind === 'tunic' ? CLOTH_GAP : BODY_GAP;
  const onFront = new Uint8Array(n), kneeLine = (restOf('calf_l')[1] + restOf('calf_r')[1]) / 2 + 0.02;
  for (let i = 0; i < n; i++) {
    const a = rest[i * 3] - pelvisRest[0], b = rest[i * 3 + 2] - pelvisRest[2];
    onFront[i] = (free[i] || (kind === 'skirt' && hits[i])) && b / (Math.hypot(a, b) || 1) > 0.05 && rest[i * 3 + 1] > kneeLine ? 1 : 0;
  }
  const nearWaist = new Uint8Array(n);
  for (let i = 0; i < n; i++) nearWaist[i] = rest[i * 3 + 1] > pelvisRest[1] - 0.06 ? 1 : 0;
  // The start: where the bones put it, and below the knee a curtain from the cloth at the knee, in front of the seat's
  // edge (bones fold that part up, and a folded start stays tangled)
  const x = Float64Array.from(start);
  const kneeRest = (restOf('calf_l')[1] + restOf('calf_r')[1]) / 2, BINS = 64, ring = new Array(BINS).fill(null);
  const around = (i) => [rest[i * 3] - pelvisRest[0], rest[i * 3 + 2] - pelvisRest[2]];
  const binOf = (i) => { const [a, b] = around(i); return Math.floor(((Math.atan2(b, a) + Math.PI) / (2 * Math.PI)) * BINS) % BINS; };
  for (let i = 0; i < n; i++) {
    if (!free[i]) continue;
    const off = Math.abs(rest[i * 3 + 1] - kneeRest), b = binOf(i);
    if (off < 0.035 && (!ring[b] || off < ring[b].off)) ring[b] = { off, i };
  }
  let lowest = Infinity;
  for (let i = 0; i < n; i++) if (free[i]) lowest = Math.min(lowest, rest[i * 3 + 1]);
  // Floor length: the back falls from the hips as a closed curtain, since there is no leg to see behind it
  const floorLength = lowest < 0.2 * kneeRest / 0.54;
  const fill = (list) => { for (let pass = 0; pass < BINS && list.some((r) => !r); pass++) for (let b = 0; b < BINS; b++) list[b] = list[b] ?? list[(b + 1) % BINS] ?? list[(b + BINS - 1) % BINS]; };
  if (ring.some(Boolean) && lowest < kneeRest - 0.05) {
    fill(ring);
    const hipLevel = pelvisRest[1] - 0.07, hips = new Array(BINS).fill(null);
    for (let i = 0; i < n; i++) {
      if (!free[i]) continue;
      const off = Math.abs(rest[i * 3 + 1] - hipLevel), b = binOf(i);
      if (off < 0.035 && (!hips[b] || off < hips[b].off)) hips[b] = { off, i };
    }
    fill(hips);
    for (let i = 0; i < n; i++) {
      if (!free[i]) continue;
      const [ax, az] = around(i), ra = Math.hypot(ax, az) || 1, y = rest[i * 3 + 1], b = binOf(i);
      const front = [start[i * 3], start[i * 3 + 1], start[i * 3 + 2]];
      if (y < kneeRest - 0.035) {
        const j = ring[b].i, [jx, jz] = around(j), flare = ra - Math.hypot(jx, jz);
        front[0] = start[j * 3] + (ax / ra) * flare;
        front[1] = Math.min(start[j * 3 + 1], SEAT.y) - (rest[j * 3 + 1] - y);
        front[2] = Math.max(start[j * 3 + 2], SEAT.front) + (az / ra) * flare;
      }
      let share = 1;
      if (floorLength && hips[b] && y < hipLevel) share = smooth01(0.5 + 0.9 * (az / ra));
      if (share < 1) {
        const h = hips[b].i, [hx, hz] = around(h), flare = ra - Math.hypot(hx, hz);
        const back = [start[h * 3] + (ax / ra) * flare, start[h * 3 + 1] - (rest[h * 3 + 1] - y), Math.max(start[h * 3 + 2], SEAT.rear) + (az / ra) * flare];
        for (let k = 0; k < 3; k++) x[i * 3 + k] = back[k] + (front[k] - back[k]) * share;
      } else for (let k = 0; k < 3; k++) x[i * 3 + k] = front[k];
    }
  }
  // The front starts laid out along the thighs at its full length, then over the knees: the bones leave it bunched at
  // the hips, nothing pulls cloth forward along a level thigh, and an even start settles evenly on both legs
  // (not the robe: it is far wider than the legs, and settles better from where the bones hold it)
  if (lowest < pelvisRest[1] - 0.08 && !/Robe/.test(name)) {
    const hipLevel = pelvisRest[1] - 0.04, hips = new Array(BINS).fill(null);
    for (let i = 0; i < n; i++) {
      if (!free[i]) continue;
      const off = Math.abs(rest[i * 3 + 1] - hipLevel), b = binOf(i);
      if (off < 0.035 && (!hips[b] || off < hips[b].off)) hips[b] = { off, i };
    }
    fill(hips);
    const along = ['l', 'r'].map((c) => { const h = point(`thigh_${c}`), k = point(`calf_${c}`), d = [k[0] - h[0], k[1] - h[1], k[2] - h[2]], l = Math.hypot(...d); return { x: h[0], l, d: d.map((v) => v / l) }; });
    const [right, left] = along[0].x < along[1].x ? along : [along[1], along[0]];
    for (let i = 0; i < n; i++) {
      if (!free[i] || rest[i * 3 + 1] >= hipLevel || !hips[binOf(i)]) continue;
      const [ax, az] = around(i), share = smooth01((az / (Math.hypot(ax, az) || 1) - 0.05) / 0.45);
      if (!share) continue;
      const h = hips[binOf(i)].i, drop = rest[h * 3 + 1] - rest[i * 3 + 1], u = smooth01((start[h * 3] - right.x) / (left.x - right.x));
      const dir = [0, 1, 2].map((k) => right.d[k] + (left.d[k] - right.d[k]) * u), dl = Math.hypot(...dir), run = Math.min(drop, (right.l + left.l) / 2);
      const [hx, hz] = around(h), flare = Math.max(0, Math.hypot(ax, az) - Math.hypot(hx, hz)) * (ax / (Math.hypot(ax, az) || 1));
      const laid = [start[h * 3] + (dir[0] / dl) * run + flare, start[h * 3 + 1] + (dir[1] / dl) * run - (drop - run), start[h * 3 + 2] + (dir[2] / dl) * run];
      for (let k = 0; k < 3; k++) x[i * 3 + k] += (laid[k] - x[i * 3 + k]) * share;
    }
  }
  const prev = Float64Array.from(x);

  const relax = (list, stretch, squeeze, give = 1) => {
    for (let c = 0; c < list.length; c += 3) {
      const a = list[c] * 3, b = list[c + 1] * 3, wa = free[list[c]], wb = free[list[c + 1]], total = wa + wb;
      if (!total) continue;
      const dx = x[b] - x[a], dy = x[b + 1] - x[a + 1], dz = x[b + 2] - x[a + 2], l = Math.hypot(dx, dy, dz) || 1e-6;
      const rl = list[c + 2], e = l > rl * give ? (l - rl * give) / l : l < rl ? (l - rl) / l : 0, k = (e > 0 ? stretch : squeeze) * e;
      if (!k) continue;
      const fa = (k * wa) / total, fb = (k * wb) / total;
      x[a] += dx * fa; x[a + 1] += dy * fa; x[a + 2] += dz * fa;
      x[b] -= dx * fb; x[b + 1] -= dy * fb; x[b + 2] -= dz * fb;
    }
  };
  const collide = () => {
    for (let i = 0; i < n; i++) {
      if (!hits[i]) continue;
      const p = i * 3;
      for (const { field, waist } of layers) {
        if (waist && !nearWaist[i]) continue;
        const q = field.nearest(x[p], x[p + 1], x[p + 2]);
        if (q < 0) continue;
        const dx = x[p] - field.X[q * 3], dy = x[p + 1] - field.X[q * 3 + 1], dz = x[p + 2] - field.X[q * 3 + 2];
        if (dx * dx + dy * dy + dz * dz > 0.0121) continue;
        const nx = field.Nn[q * 3], ny = field.Nn[q * 3 + 1], nz = field.Nn[q * 3 + 2], d = dx * nx + dy * ny + dz * nz, want = field.gap[q];
        if (d < want) { const m = want - d; x[p] += nx * m; x[p + 1] += ny * m; x[p + 2] += nz * m; }
      }
    }
  };
  // On the seat, off its back, and the front of the cloth on top of the thighs
  const seatRules = (level) => {
    for (let i = 0; i < n; i++) {
      const p = i * 3;
      if (onFront[i]) {
        const h = lap(x[p], x[p + 2]);
        if (h !== -Infinity && x[p + 1] < h + lapGap) x[p + 1] = h + lapGap;
      }
      if (!free[i]) continue;
      if (Math.abs(x[p] - pelvis[0]) > SEAT.x) continue;
      if (x[p + 1] < pelvis[1] - 0.03 && x[p + 2] < SEAT.rear) x[p + 2] = SEAT.rear;
      // Cloth from above the knee rests on the seat; what is longer goes over its front edge and hangs
      if (!floorLength && x[p + 1] < level && x[p + 2] < SEAT.front) {
        if (rest[p + 1] > kneeLine) x[p + 1] = level;
        else x[p + 2] = SEAT.front;
      }
    }
  };
  let low = Infinity;
  for (let i = 0; i < n; i++) if (free[i] && Math.abs(x[i * 3] - pelvis[0]) < SEAT.x && x[i * 3 + 2] < SEAT.front) low = Math.min(low, x[i * 3 + 1]);
  if (low === Infinity) low = SEAT.y;

  for (let step = 0; step < SETTLE; step++) {
    // The seat comes up under the cloth over the first steps, so nothing is thrown about
    const level = Math.min(low, SEAT.y) + (SEAT.y - Math.min(low, SEAT.y)) * smooth01(step / 50);
    for (let i = 0; i < n; i++) {
      if (!free[i]) continue;
      const p = i * 3;
      for (let k = 0; k < 3; k++) { const v = (x[p + k] - prev[p + k]) * DAMPING; prev[p + k] = x[p + k]; x[p + k] += v; }
      x[p + 1] -= GRAVITY * free[i];
    }
    for (let it = 0; it < ITERATIONS; it++) {
      relax(links, STRETCH, COMPRESS);
      relax(hoops, STRETCH, COMPRESS, HOOP_GIVE);
      relax(bends, BEND, BEND);
      collide();
      seatRules(level);
    }
    // What is held and collides goes back to where it is held
    if (step < SETTLE - 1) for (let i = 0; i < n; i++) if (!free[i]) for (let k = 0; k < 3; k++) x[i * 3 + k] = start[i * 3 + k];
  }
  // Eased, so no single point stands out, then back outside what it lies on
  const neighbours = Array.from({ length: n }, () => []);
  for (const e of seen.values()) { neighbours[e.a].push(e.b); neighbours[e.b].push(e.a); }
  for (let pass = 0, passes = /Robe/.test(name) ? 5 : 3; pass < passes; pass++) {
    const was = Float64Array.from(x);
    for (let i = 0; i < n; i++) {
      const ease = armed[i] ? 0 : Math.max(free[i], hits[i] && nearWaist[i] ? 0.6 : 0);
      if (!ease || !neighbours[i].length) continue;
      for (let k = 0; k < 3; k++) {
        let sum = 0;
        for (const b of neighbours[i]) sum += was[b * 3 + k];
        x[i * 3 + k] += (sum / neighbours[i].length - was[i * 3 + k]) * 0.5 * ease;
      }
    }
    collide();
    seatRules(SEAT.y);
  }
  // Normals of the settled shape
  const nor = new Float64Array(n * 3);
  for (let t = 0; t < tris.length; t += 3) {
    const [a, b, c] = [tris[t] * 3, tris[t + 1] * 3, tris[t + 2] * 3];
    const ux = x[b] - x[a], uy = x[b + 1] - x[a + 1], uz = x[b + 2] - x[a + 2], vx = x[c] - x[a], vy = x[c + 1] - x[a + 1], vz = x[c + 2] - x[a + 2];
    const fx = uy * vz - uz * vy, fy = uz * vx - ux * vz, fz = ux * vy - uy * vx;
    for (const o of [a, b, c]) { nor[o] += fx; nor[o + 1] += fy; nor[o + 2] += fz; }
  }
  for (let i = 0; i < n; i++) { const l = Math.hypot(nor[i * 3], nor[i * 3 + 1], nor[i * 3 + 2]) || 1; nor[i * 3] /= l; nor[i * 3 + 1] /= l; nor[i * 3 + 2] /= l; }
  const surface = { X: [], Nn: [] };
  for (let i = 0; i < n; i++) if (!armed[i]) { surface.X.push(x[i * 3], x[i * 3 + 1], x[i * 3 + 2]); surface.Nn.push(nor[i * 3], nor[i * 3 + 1], nor[i * 3 + 2]); }
  solved.set(name, { surface });

  // Stored as a difference from the standing garment, through each vertex's own matrix
  const q = [0, 0, 0], r = [0, 0, 0];
  let most = 0;
  node.getMesh().listPrimitives().forEach((prim, pi) => {
    const g = prims[pi], map = maps[pi], dP = new Int16Array(g.count * 3), dN = new Int8Array(g.count * 3);
    for (let v = 0; v < g.count; v++) {
      const id = map[v] * 3;
      unapply(g.M, v, x[id], x[id + 1], x[id + 2], q);
      const moved = Math.hypot(x[id] - standing[id], x[id + 1] - standing[id + 1], x[id + 2] - standing[id + 2]);
      for (let k = 0; k < 3; k++) {
        const d = moved < 1e-4 ? 0 : q[k] - g.P[v * 3 + k];
        most = Math.max(most, Math.abs(d));
        dP[v * 3 + k] = Math.round(Math.max(-1, Math.min(1, d)) * 32767);
      }
      const fade = smooth01(moved / 0.008);
      if (fade > 0) {
        unapply(g.M, v, x[id] + nor[id] + 0, x[id + 1] + nor[id + 1], x[id + 2] + nor[id + 2], r);
        const a = r[0] - q[0], b = r[1] - q[1], c = r[2] - q[2], l = Math.hypot(a, b, c) || 1;
        const off = [a / l - g.N[v * 3], b / l - g.N[v * 3 + 1], c / l - g.N[v * 3 + 2]];
        for (let k = 0; k < 3; k++) dN[v * 3 + k] = Math.round(Math.max(-1, Math.min(1, off[k] * fade)) * 127);
      }
    }
    const target = doc.createPrimitiveTarget('Seated');
    target.setAttribute('POSITION', doc.createAccessor(`${name}_seated`).setType(Accessor.Type.VEC3).setArray(dP).setNormalized(true).setBuffer(prim.getAttribute('POSITION').getBuffer()));
    target.setAttribute('NORMAL', doc.createAccessor(`${name}_seated_n`).setType(Accessor.Type.VEC3).setArray(dN).setNormalized(true).setBuffer(prim.getAttribute('POSITION').getBuffer()));
    prim.addTarget(target);
  });
  node.getMesh().setWeights([0]).setExtras({ ...node.getMesh().getExtras(), targetNames: ['Seated'] });

  // The far-away copy takes the same shape, point for point
  const lod = nodes.get(`LOD_${name}`);
  if (lod?.getMesh()) {
    for (const prim of lod.getMesh().listPrimitives()) {
      const g = readPrim(prim), dP = new Int16Array(g.count * 3);
      for (let v = 0; v < g.count; v++) {
        const [px, py, pz] = [g.P[v * 3], g.P[v * 3 + 1], g.P[v * 3 + 2]];
        let id = ids.get(key(px, py, pz));
        if (id === undefined) {
          let bd = Infinity;
          for (let i = 0; i < n; i++) { const e = (rest[i * 3] - px) ** 2 + (rest[i * 3 + 1] - py) ** 2 + (rest[i * 3 + 2] - pz) ** 2; if (e < bd) { bd = e; id = i; } }
        }
        unapply(g.M, v, x[id * 3], x[id * 3 + 1], x[id * 3 + 2], q);
        for (let k = 0; k < 3; k++) dP[v * 3 + k] = Math.round(Math.max(-1, Math.min(1, q[k] - g.P[v * 3 + k])) * 32767);
      }
      const target = doc.createPrimitiveTarget('Seated');
      target.setAttribute('POSITION', doc.createAccessor(`LOD_${name}_seated`).setType(Accessor.Type.VEC3).setArray(dP).setNormalized(true).setBuffer(prim.getAttribute('POSITION').getBuffer()));
      prim.addTarget(target);
    }
    lod.getMesh().setWeights([0]).setExtras({ ...lod.getMesh().getExtras(), targetNames: ['Seated'] });
  }
  report.push(`${name.replace('Outfit_', '').padEnd(22)} ${String(n).padStart(5)} points, moved at most ${(most * 100).toFixed(1)} cm${floorLength ? ', to the floor' : ''}, hem ${lowest.toFixed(3)}`);
};

const t0 = Date.now();
for (const [name, kind, over] of GARMENTS) {
  if (!nodes.get(name)?.getMesh()) throw new Error(`missing ${name}`);
  if (nodes.get(name).getSkin()?.getName() !== 'Cloth_Skin') throw new Error(`${name} is not on the cloth skin`);
  settle(name, kind, over);
}
const onRig = doc.getRoot().listNodes().filter((n) => n.getSkin()?.getName() === 'Cloth_Skin' && !n.getName().startsWith('LOD_')).map((n) => n.getName());
const missed = onRig.filter((n) => !GARMENTS.some(([g]) => g === n));
if (missed.length) throw new Error(`no seated shape for ${missed.join(', ')}`);
doc.createExtension(KHRMeshQuantization).setRequired(true);
await io.write(output, doc);
console.log(report.join('\n'));
console.log(`${gender}: ${GARMENTS.length} seated shapes in ${((Date.now() - t0) / 1000).toFixed(0)} s, seat at ${SEAT.y.toFixed(3)}, ${(fs.statSync(output).size / 1e6).toFixed(2)} MB`);
