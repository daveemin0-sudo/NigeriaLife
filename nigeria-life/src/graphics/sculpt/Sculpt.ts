/**
 * Sculpt — NigeriaLife's signed-distance sculpting engine.
 *
 * Characters and vehicle bodies are described as smooth blends of rounded primitives
 * (ellipsoids, round cones, rounded boxes...). The engine turns that description into ONE
 * continuous, watertight mesh using narrow-band Surface Nets, then projects every vertex
 * back onto the exact surface and takes its normal from the field gradient. The result is
 * organic, seam-free geometry with real anatomy (no more glued-on spheres and boxes),
 * which can then be skinned to a skeleton or used rigidly.
 *
 * Everything here is pure maths with no three.js dependency so it can be cached, unit
 * tested, or moved to a worker later.
 */

export const PrimType = {
  Sphere: 0,
  Ellipsoid: 1,
  RoundCone: 2,
  RoundBox: 3,
  Torus: 4,
  Cylinder: 5,
  /** Custom displacement applied to the running distance (cloth shells, folds, hair curls) */
  Displace: 6,
} as const;
export type PrimType = typeof PrimType[keyof typeof PrimType];

export const Op = {
  Union: 0,
  Subtract: 1,
  Intersect: 2,
} as const;
export type Op = typeof Op[keyof typeof Op];

/** Prim flags */
export const FLAG_SKIRT = 1;

export type DisplaceFn = (x: number, y: number, z: number) => number;

export interface Prim {
  type: PrimType;
  op: Op;
  k: number;
  region: number;
  bone: number;
  flags: number;
  /** Primitive parameters (meaning depends on type) */
  a: Float64Array;
  /** world -> local rotation (row-major 3x3) or null */
  m: Float64Array | null;
  /** Bounding sphere */
  bx: number;
  by: number;
  bz: number;
  br: number;
  fn?: DisplaceFn;
}

export type Vec3 = [number, number, number];

// ---------------------------------------------------------------------------
// Rotation helpers
// ---------------------------------------------------------------------------

/** Build a world->local matrix from Euler angles (XYZ order, radians). */
export function eulerToLocal(rx: number, ry: number, rz: number): Float64Array {
  const cx = Math.cos(rx), sx = Math.sin(rx);
  const cy = Math.cos(ry), sy = Math.sin(ry);
  const cz = Math.cos(rz), sz = Math.sin(rz);
  // local->world R = Rx * Ry * Rz (three.js XYZ order); world->local = R^T
  const r00 = cy * cz, r01 = -cy * sz, r02 = sy;
  const r10 = cx * sz + sx * sy * cz, r11 = cx * cz - sx * sy * sz, r12 = -sx * cy;
  const r20 = sx * sz - cx * sy * cz, r21 = sx * cz + cx * sy * sz, r22 = cx * cy;
  return new Float64Array([r00, r10, r20, r01, r11, r21, r02, r12, r22]);
}

/** Build world->local from three orthonormal local axes expressed in world space. */
export function axesToLocal(ux: Vec3, uy: Vec3, uz: Vec3): Float64Array {
  return new Float64Array([ux[0], ux[1], ux[2], uy[0], uy[1], uy[2], uz[0], uz[1], uz[2]]);
}

// ---------------------------------------------------------------------------
// The sculpt description
// ---------------------------------------------------------------------------

export class SculptField {
  public prims: Prim[] = [];

  private push(p: Prim): Prim {
    this.prims.push(p);
    return p;
  }

  private base(type: PrimType, op: Op, k: number, region: number, bone: number, a: number[], m: Float64Array | null, bounds: [number, number, number, number]): Prim {
    return this.push({
      type, op, k, region, bone, flags: 0,
      a: new Float64Array(a), m,
      bx: bounds[0], by: bounds[1], bz: bounds[2], br: bounds[3],
    });
  }

  sphere(c: Vec3, r: number, o: PrimOpts = {}): Prim {
    return this.base(PrimType.Sphere, o.op ?? Op.Union, o.k ?? 0, o.region ?? -1, o.bone ?? -1, [c[0], c[1], c[2], r], null, [c[0], c[1], c[2], r]);
  }

  ellipsoid(c: Vec3, r: Vec3, o: PrimOpts & { rot?: Float64Array } = {}): Prim {
    const br = Math.max(r[0], r[1], r[2]);
    return this.base(PrimType.Ellipsoid, o.op ?? Op.Union, o.k ?? 0, o.region ?? -1, o.bone ?? -1, [c[0], c[1], c[2], r[0], r[1], r[2]], o.rot ?? null, [c[0], c[1], c[2], br]);
  }

  /** Round cone (tapered capsule) between a and b. */
  cone(a: Vec3, b: Vec3, r1: number, r2: number, o: PrimOpts = {}): Prim {
    const bax = b[0] - a[0], bay = b[1] - a[1], baz = b[2] - a[2];
    const l2 = bax * bax + bay * bay + baz * baz;
    const len = Math.sqrt(l2);
    // keep the cone well-formed
    let rr = r1 - r2;
    if (Math.abs(rr) > len * 0.95) {
      const s = (len * 0.95) / Math.abs(rr);
      rr *= s;
      r2 = r1 - rr;
    }
    const a2 = l2 - rr * rr;
    return this.base(
      PrimType.RoundCone, o.op ?? Op.Union, o.k ?? 0, o.region ?? -1, o.bone ?? -1,
      [a[0], a[1], a[2], bax, bay, baz, r1, r2, l2, rr, a2, 1 / l2],
      null,
      [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2, len / 2 + Math.max(r1, r2)],
    );
  }

  box(c: Vec3, half: Vec3, round: number, o: PrimOpts & { rot?: Float64Array } = {}): Prim {
    const br = Math.hypot(half[0], half[1], half[2]);
    return this.base(PrimType.RoundBox, o.op ?? Op.Union, o.k ?? 0, o.region ?? -1, o.bone ?? -1,
      [c[0], c[1], c[2], half[0], half[1], half[2], round], o.rot ?? null, [c[0], c[1], c[2], br]);
  }

  torus(c: Vec3, R: number, r: number, o: PrimOpts & { rot?: Float64Array } = {}): Prim {
    return this.base(PrimType.Torus, o.op ?? Op.Union, o.k ?? 0, o.region ?? -1, o.bone ?? -1,
      [c[0], c[1], c[2], R, r], o.rot ?? null, [c[0], c[1], c[2], R + r]);
  }

  /** Rounded capped cylinder along local Y. */
  cylinder(c: Vec3, radius: number, halfH: number, round: number, o: PrimOpts & { rot?: Float64Array } = {}): Prim {
    return this.base(PrimType.Cylinder, o.op ?? Op.Union, o.k ?? 0, o.region ?? -1, o.bone ?? -1,
      [c[0], c[1], c[2], radius, halfH, round], o.rot ?? null, [c[0], c[1], c[2], Math.hypot(radius, halfH)]);
  }

  /**
   * Displacement: d -= fn(p). Positive fn inflates (cloth thickness), negative carves.
   * If `region` >= 0 and fn(p) > 0 the surface region becomes `region`.
   */
  displace(center: Vec3, radius: number, fn: DisplaceFn, o: { region?: number } = {}): Prim {
    const p = this.base(PrimType.Displace, Op.Union, 0, o.region ?? -1, -1, [], null, [center[0], center[1], center[2], radius]);
    p.fn = fn;
    return p;
  }
}

export interface PrimOpts {
  op?: Op;
  k?: number;
  region?: number;
  bone?: number;
}

// ---------------------------------------------------------------------------
// Distance evaluation
// ---------------------------------------------------------------------------

const BIG = 1e3;

/** Result scratch for evaluation */
export interface EvalOut {
  d: number;
  region: number;
  flags: number;
}

function primDist(p: Prim, x: number, y: number, z: number): number {
  const a = p.a;
  let px = x, py = y, pz = z;
  switch (p.type) {
    case PrimType.Sphere: {
      const dx = x - a[0], dy = y - a[1], dz = z - a[2];
      return Math.sqrt(dx * dx + dy * dy + dz * dz) - a[3];
    }
    case PrimType.Ellipsoid: {
      px = x - a[0]; py = y - a[1]; pz = z - a[2];
      if (p.m) {
        const m = p.m;
        const lx = m[0] * px + m[1] * py + m[2] * pz;
        const ly = m[3] * px + m[4] * py + m[5] * pz;
        const lz = m[6] * px + m[7] * py + m[8] * pz;
        px = lx; py = ly; pz = lz;
      }
      const qx = px / a[3], qy = py / a[4], qz = pz / a[5];
      const k0 = Math.sqrt(qx * qx + qy * qy + qz * qz);
      const rx = qx / a[3], ry = qy / a[4], rz = qz / a[5];
      const k1 = Math.sqrt(rx * rx + ry * ry + rz * rz);
      if (k1 < 1e-9) return -Math.min(a[3], a[4], a[5]);
      return (k0 * (k0 - 1)) / k1;
    }
    case PrimType.RoundCone: {
      const pax = x - a[0], pay = y - a[1], paz = z - a[2];
      const bax = a[3], bay = a[4], baz = a[5];
      const r1 = a[6], r2 = a[7], l2 = a[8], rr = a[9], a2 = a[10], il2 = a[11];
      const yy = pax * bax + pay * bay + paz * baz;
      const zz = yy - l2;
      const vx = pax * l2 - bax * yy, vy = pay * l2 - bay * yy, vz = paz * l2 - baz * yy;
      const x2 = vx * vx + vy * vy + vz * vz;
      const y2 = yy * yy * l2;
      const z2 = zz * zz * l2;
      const k = Math.sign(rr) * rr * rr * x2;
      if (Math.sign(zz) * a2 * z2 > k) return Math.sqrt(x2 + z2) * il2 - r2;
      if (Math.sign(yy) * a2 * y2 < k) return Math.sqrt(x2 + y2) * il2 - r1;
      return (Math.sqrt(x2 * a2 * il2) + yy * rr) * il2 - r1;
    }
    case PrimType.RoundBox: {
      px = x - a[0]; py = y - a[1]; pz = z - a[2];
      if (p.m) {
        const m = p.m;
        const lx = m[0] * px + m[1] * py + m[2] * pz;
        const ly = m[3] * px + m[4] * py + m[5] * pz;
        const lz = m[6] * px + m[7] * py + m[8] * pz;
        px = lx; py = ly; pz = lz;
      }
      const r = a[6];
      const qx = Math.abs(px) - a[3] + r, qy = Math.abs(py) - a[4] + r, qz = Math.abs(pz) - a[5] + r;
      const mx = Math.max(qx, 0), my = Math.max(qy, 0), mz = Math.max(qz, 0);
      return Math.sqrt(mx * mx + my * my + mz * mz) + Math.min(Math.max(qx, Math.max(qy, qz)), 0) - r;
    }
    case PrimType.Torus: {
      px = x - a[0]; py = y - a[1]; pz = z - a[2];
      if (p.m) {
        const m = p.m;
        const lx = m[0] * px + m[1] * py + m[2] * pz;
        const ly = m[3] * px + m[4] * py + m[5] * pz;
        const lz = m[6] * px + m[7] * py + m[8] * pz;
        px = lx; py = ly; pz = lz;
      }
      const qx = Math.sqrt(px * px + pz * pz) - a[3];
      return Math.sqrt(qx * qx + py * py) - a[4];
    }
    case PrimType.Cylinder: {
      px = x - a[0]; py = y - a[1]; pz = z - a[2];
      if (p.m) {
        const m = p.m;
        const lx = m[0] * px + m[1] * py + m[2] * pz;
        const ly = m[3] * px + m[4] * py + m[5] * pz;
        const lz = m[6] * px + m[7] * py + m[8] * pz;
        px = lx; py = ly; pz = lz;
      }
      const rb = a[5];
      const dx = Math.sqrt(px * px + pz * pz) - a[3] + rb;
      const dy = Math.abs(py) - a[4] + rb;
      const mx = Math.max(dx, 0), my = Math.max(dy, 0);
      return Math.min(Math.max(dx, dy), 0) + Math.sqrt(mx * mx + my * my) - rb;
    }
  }
  return BIG;
}

/** Evaluate a list of primitives at a point. */
export function evalPrims(list: Prim[], x: number, y: number, z: number, out?: EvalOut): number {
  let d = BIG;
  let region = 0;
  let flags = 0;
  for (let i = 0; i < list.length; i++) {
    const p = list[i];
    if (p.type === PrimType.Displace) {
      const amt = p.fn!(x, y, z);
      if (amt !== 0) {
        d -= amt;
        if (amt > 0 && p.region >= 0) region = p.region;
      }
      continue;
    }
    const b = primDist(p, x, y, z);
    const k = p.k;
    if (p.op === Op.Union) {
      if (k > 0) {
        const h = Math.max(k - Math.abs(d - b), 0) / k;
        if (b < d) { if (p.region >= 0) region = p.region; flags = p.flags; }
        d = Math.min(d, b) - h * h * k * 0.25;
      } else if (b < d) {
        d = b;
        if (p.region >= 0) region = p.region;
        flags = p.flags;
      }
    } else if (p.op === Op.Subtract) {
      const nb = -b;
      if (k > 0) {
        const h = Math.max(k - Math.abs(d - nb), 0) / k;
        if (nb > d && p.region >= 0) region = p.region;
        d = Math.max(d, nb) + h * h * k * 0.25;
      } else if (nb > d) {
        d = nb;
        if (p.region >= 0) region = p.region;
      }
    } else {
      if (k > 0) {
        const h = Math.max(k - Math.abs(d - b), 0) / k;
        d = Math.max(d, b) + h * h * k * 0.25;
      } else d = Math.max(d, b);
    }
  }
  if (out) {
    out.d = d;
    out.region = region;
    out.flags = flags;
  }
  return d;
}

// ---------------------------------------------------------------------------
// Narrow-band Surface Nets mesher
// ---------------------------------------------------------------------------

export interface MeshBox {
  min: Vec3;
  max: Vec3;
  /** Voxel size in metres */
  cell: number;
  /** Keep only triangles whose centroid passes this test */
  keep?: (x: number, y: number, z: number) => boolean;
}

export interface RawMesh {
  positions: Float32Array;
  normals: Float32Array;
  regions: Uint8Array;
  flags: Uint8Array;
  indices: Uint32Array;
}

const BLOCK = 6;

class BlockIndex {
  readonly lists: Prim[][];
  readonly ox: number;
  readonly oy: number;
  readonly oz: number;
  readonly size: number;
  readonly bnx: number;
  readonly bny: number;
  readonly bnz: number;
  constructor(
    prims: Prim[],
    ox: number, oy: number, oz: number,
    size: number,
    bnx: number, bny: number, bnz: number,
    margin: number,
  ) {
    this.ox = ox; this.oy = oy; this.oz = oz;
    this.size = size;
    this.bnx = bnx; this.bny = bny; this.bnz = bnz;
    this.lists = new Array(bnx * bny * bnz);
    const half = size * 0.5;
    const rad = Math.sqrt(3) * half;
    for (let k = 0; k < bnz; k++) {
      for (let j = 0; j < bny; j++) {
        for (let i = 0; i < bnx; i++) {
          const cx = ox + i * size + half, cy = oy + j * size + half, cz = oz + k * size + half;
          const list: Prim[] = [];
          for (const p of prims) {
            const dx = cx - p.bx, dy = cy - p.by, dz = cz - p.bz;
            const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
            if (dist < p.br + rad + p.k + margin) list.push(p);
          }
          this.lists[i + bnx * (j + bny * k)] = list;
        }
      }
    }
  }
  listAt(x: number, y: number, z: number): Prim[] {
    let i = Math.floor((x - this.ox) / this.size);
    let j = Math.floor((y - this.oy) / this.size);
    let k = Math.floor((z - this.oz) / this.size);
    i = i < 0 ? 0 : i >= this.bnx ? this.bnx - 1 : i;
    j = j < 0 ? 0 : j >= this.bny ? this.bny - 1 : j;
    k = k < 0 ? 0 : k >= this.bnz ? this.bnz - 1 : k;
    return this.lists[i + this.bnx * (j + this.bny * k)];
  }
}

/**
 * Mesh one box region of the field. `displaceMargin` should cover the largest positive
 * displacement in the field so blocks are not culled too eagerly.
 */
export function meshField(field: SculptField, box: MeshBox, displaceMargin = 0.03): RawMesh {
  const h = box.cell;
  const nx = Math.max(2, Math.ceil((box.max[0] - box.min[0]) / h) + 1);
  const ny = Math.max(2, Math.ceil((box.max[1] - box.min[1]) / h) + 1);
  const nz = Math.max(2, Math.ceil((box.max[2] - box.min[2]) / h) + 1);
  const ox = box.min[0], oy = box.min[1], oz = box.min[2];

  const bsize = BLOCK * h;
  const bnx = Math.ceil(nx / BLOCK), bny = Math.ceil(ny / BLOCK), bnz = Math.ceil(nz / BLOCK);
  const index = new BlockIndex(field.prims, ox, oy, oz, bsize, bnx, bny, bnz, displaceMargin + 2 * h);

  // ---- 1. sample the field, block by block, skipping blocks far from the surface
  const vals = new Float32Array(nx * ny * nz);
  const blockRad = Math.sqrt(3) * bsize * 0.5;
  for (let bk = 0; bk < bnz; bk++) {
    for (let bj = 0; bj < bny; bj++) {
      for (let bi = 0; bi < bnx; bi++) {
        const list = index.lists[bi + bnx * (bj + bny * bk)];
        const i0 = bi * BLOCK, j0 = bj * BLOCK, k0 = bk * BLOCK;
        const i1 = Math.min(i0 + BLOCK, nx), j1 = Math.min(j0 + BLOCK, ny), k1 = Math.min(k0 + BLOCK, nz);
        let fill = NaN;
        if (list.length === 0) fill = BIG;
        else {
          const cx = ox + (i0 + i1 - 1) * 0.5 * h, cy = oy + (j0 + j1 - 1) * 0.5 * h, cz = oz + (k0 + k1 - 1) * 0.5 * h;
          const dc = evalPrims(list, cx, cy, cz);
          if (Math.abs(dc) > blockRad * 1.6 + displaceMargin) fill = dc;
        }
        for (let k = k0; k < k1; k++) {
          const z = oz + k * h;
          for (let j = j0; j < j1; j++) {
            const y = oy + j * h;
            let s = i0 + nx * (j + ny * k);
            for (let i = i0; i < i1; i++, s++) {
              vals[s] = fill === fill ? fill : evalPrims(list, ox + i * h, y, z);
            }
          }
        }
      }
    }
  }

  // ---- 2. one vertex per surface cell (average of edge crossings)
  const cnx = nx - 1, cny = ny - 1, cnz = nz - 1;
  const cellVert = new Int32Array(cnx * cny * cnz).fill(-1);
  const pos: number[] = [];
  const cornerOff = [
    [0, 0, 0], [1, 0, 0], [0, 1, 0], [1, 1, 0],
    [0, 0, 1], [1, 0, 1], [0, 1, 1], [1, 1, 1],
  ];
  const edges = [
    [0, 1], [2, 3], [4, 5], [6, 7],
    [0, 2], [1, 3], [4, 6], [5, 7],
    [0, 4], [1, 5], [2, 6], [3, 7],
  ];
  const cv = new Float64Array(8);
  for (let k = 0; k < cnz; k++) {
    for (let j = 0; j < cny; j++) {
      for (let i = 0; i < cnx; i++) {
        let mask = 0;
        for (let c = 0; c < 8; c++) {
          const o = cornerOff[c];
          const v = vals[i + o[0] + nx * (j + o[1] + ny * (k + o[2]))];
          cv[c] = v;
          if (v < 0) mask |= 1 << c;
        }
        if (mask === 0 || mask === 255) continue;
        let sx = 0, sy = 0, sz = 0, n = 0;
        for (const [a, b] of edges) {
          const va = cv[a], vb = cv[b];
          if ((va < 0) === (vb < 0)) continue;
          const t = va / (va - vb);
          const oa = cornerOff[a], ob = cornerOff[b];
          sx += oa[0] + (ob[0] - oa[0]) * t;
          sy += oa[1] + (ob[1] - oa[1]) * t;
          sz += oa[2] + (ob[2] - oa[2]) * t;
          n++;
        }
        cellVert[i + cnx * (j + cny * k)] = pos.length / 3;
        pos.push(ox + (i + sx / n) * h, oy + (j + sy / n) * h, oz + (k + sz / n) * h);
      }
    }
  }

  // ---- 3. quads across every sign-changing edge
  const tris: number[] = [];
  const cidx = (i: number, j: number, k: number) => cellVert[i + cnx * (j + cny * k)];
  const quad = (a: number, b: number, c: number, d: number, flip: boolean) => {
    if (a < 0 || b < 0 || c < 0 || d < 0) return;
    if (flip) { const t = b; b = d; d = t; }
    // split along the shorter diagonal
    const d1 = dist2(pos, a, c), d2 = dist2(pos, b, d);
    if (d1 <= d2) tris.push(a, b, c, a, c, d);
    else tris.push(a, b, d, b, c, d);
  };
  for (let k = 0; k < nz; k++) {
    for (let j = 0; j < ny; j++) {
      for (let i = 0; i < nx; i++) {
        const v0 = vals[i + nx * (j + ny * k)];
        const in0 = v0 < 0;
        if (i < nx - 1 && j > 0 && k > 0 && j < cny && k < cnz) {
          const v1 = vals[i + 1 + nx * (j + ny * k)];
          if (in0 !== (v1 < 0)) quad(cidx(i, j - 1, k - 1), cidx(i, j, k - 1), cidx(i, j, k), cidx(i, j - 1, k), !in0);
        }
        if (j < ny - 1 && i > 0 && k > 0 && i < cnx && k < cnz) {
          const v1 = vals[i + nx * (j + 1 + ny * k)];
          if (in0 !== (v1 < 0)) quad(cidx(i - 1, j, k - 1), cidx(i - 1, j, k), cidx(i, j, k), cidx(i, j, k - 1), !in0);
        }
        if (k < nz - 1 && i > 0 && j > 0 && i < cnx && j < cny) {
          const v1 = vals[i + nx * (j + ny * (k + 1))];
          if (in0 !== (v1 < 0)) quad(cidx(i - 1, j - 1, k), cidx(i, j - 1, k), cidx(i, j, k), cidx(i - 1, j, k), !in0);
        }
      }
    }
  }

  // ---- 4. project vertices onto the exact surface; gradient normals; regions
  const vcount = pos.length / 3;
  const positions = new Float32Array(vcount * 3);
  const normals = new Float32Array(vcount * 3);
  const regions = new Uint8Array(vcount);
  const flags = new Uint8Array(vcount);
  const e = h * 0.35;
  const out: EvalOut = { d: 0, region: 0, flags: 0 };
  for (let v = 0; v < vcount; v++) {
    let x = pos[v * 3], y = pos[v * 3 + 1], z = pos[v * 3 + 2];
    const list = index.listAt(x, y, z);
    let gx = 0, gy = 0, gz = 1;
    for (let it = 0; it < 3; it++) {
      const d = evalPrims(list, x, y, z);
      gx = evalPrims(list, x + e, y, z) - evalPrims(list, x - e, y, z);
      gy = evalPrims(list, x, y + e, z) - evalPrims(list, x, y - e, z);
      gz = evalPrims(list, x, y, z + e) - evalPrims(list, x, y, z - e);
      const gl = Math.sqrt(gx * gx + gy * gy + gz * gz) || 1;
      gx /= gl; gy /= gl; gz /= gl;
      // limit the step so thin features never jump across
      const step = Math.max(-h, Math.min(h, d));
      x -= gx * step; y -= gy * step; z -= gz * step;
      if (Math.abs(d) < h * 0.02) break;
    }
    evalPrims(list, x, y, z, out);
    positions[v * 3] = x; positions[v * 3 + 1] = y; positions[v * 3 + 2] = z;
    normals[v * 3] = gx; normals[v * 3 + 1] = gy; normals[v * 3 + 2] = gz;
    regions[v] = out.region;
    flags[v] = out.flags;
  }

  // ---- 5. crop
  let indices: number[] = tris;
  if (box.keep) {
    const keep = box.keep;
    indices = [];
    for (let t = 0; t < tris.length; t += 3) {
      const a = tris[t] * 3, b = tris[t + 1] * 3, c = tris[t + 2] * 3;
      const cx = (positions[a] + positions[b] + positions[c]) / 3;
      const cy = (positions[a + 1] + positions[b + 1] + positions[c + 1]) / 3;
      const cz = (positions[a + 2] + positions[b + 2] + positions[c + 2]) / 3;
      if (keep(cx, cy, cz)) indices.push(tris[t], tris[t + 1], tris[t + 2]);
    }
  }

  return compact({ positions, normals, regions, flags, indices: new Uint32Array(indices) });
}

function dist2(p: number[], a: number, b: number): number {
  const dx = p[a * 3] - p[b * 3], dy = p[a * 3 + 1] - p[b * 3 + 1], dz = p[a * 3 + 2] - p[b * 3 + 2];
  return dx * dx + dy * dy + dz * dz;
}

/** Drop unreferenced vertices */
function compact(m: RawMesh): RawMesh {
  const n = m.regions.length;
  const remap = new Int32Array(n).fill(-1);
  let count = 0;
  for (let i = 0; i < m.indices.length; i++) {
    const v = m.indices[i];
    if (remap[v] < 0) remap[v] = count++;
  }
  const positions = new Float32Array(count * 3);
  const normals = new Float32Array(count * 3);
  const regions = new Uint8Array(count);
  const flags = new Uint8Array(count);
  for (let v = 0; v < n; v++) {
    const r = remap[v];
    if (r < 0) continue;
    positions.set(m.positions.subarray(v * 3, v * 3 + 3), r * 3);
    normals.set(m.normals.subarray(v * 3, v * 3 + 3), r * 3);
    regions[r] = m.regions[v];
    flags[r] = m.flags[v];
  }
  const indices = new Uint32Array(m.indices.length);
  for (let i = 0; i < indices.length; i++) indices[i] = remap[m.indices[i]];
  return { positions, normals, regions, flags, indices };
}

/** Concatenate several raw meshes */
export function mergeRaw(parts: RawMesh[]): RawMesh {
  let vc = 0, ic = 0;
  for (const p of parts) { vc += p.regions.length; ic += p.indices.length; }
  const positions = new Float32Array(vc * 3);
  const normals = new Float32Array(vc * 3);
  const regions = new Uint8Array(vc);
  const flags = new Uint8Array(vc);
  const indices = new Uint32Array(ic);
  let vo = 0, io = 0;
  for (const p of parts) {
    positions.set(p.positions, vo * 3);
    normals.set(p.normals, vo * 3);
    regions.set(p.regions, vo);
    flags.set(p.flags, vo);
    for (let i = 0; i < p.indices.length; i++) indices[io + i] = p.indices[i] + vo;
    vo += p.regions.length;
    io += p.indices.length;
  }
  return { positions, normals, regions, flags, indices };
}

/**
 * Ambient occlusion per vertex, sampled along the normal. Darkens armpits, the gap
 * between fingers, under the chin, inside folds and under wheel arches.
 */
export function bakeAO(field: SculptField, mesh: RawMesh, strength = 1): Float32Array {
  const n = mesh.regions.length;
  const ao = new Float32Array(n);
  const steps = [0.012, 0.03, 0.06, 0.11];
  const weights = [0.35, 0.3, 0.2, 0.15];
  // coarse spatial index for speed
  let minx = Infinity, miny = Infinity, minz = Infinity, maxx = -Infinity, maxy = -Infinity, maxz = -Infinity;
  for (let i = 0; i < n; i++) {
    const x = mesh.positions[i * 3], y = mesh.positions[i * 3 + 1], z = mesh.positions[i * 3 + 2];
    if (x < minx) minx = x; if (y < miny) miny = y; if (z < minz) minz = z;
    if (x > maxx) maxx = x; if (y > maxy) maxy = y; if (z > maxz) maxz = z;
  }
  const size = 0.08;
  const pad = 0.12;
  const bnx = Math.max(1, Math.ceil((maxx - minx + 2 * pad) / size));
  const bny = Math.max(1, Math.ceil((maxy - miny + 2 * pad) / size));
  const bnz = Math.max(1, Math.ceil((maxz - minz + 2 * pad) / size));
  const index = new BlockIndex(field.prims, minx - pad, miny - pad, minz - pad, size, bnx, bny, bnz, 0.14);
  for (let i = 0; i < n; i++) {
    const x = mesh.positions[i * 3], y = mesh.positions[i * 3 + 1], z = mesh.positions[i * 3 + 2];
    const nx = mesh.normals[i * 3], ny = mesh.normals[i * 3 + 1], nz = mesh.normals[i * 3 + 2];
    let occ = 0;
    for (let s = 0; s < steps.length; s++) {
      const hh = steps[s];
      const px = x + nx * hh, py = y + ny * hh, pz = z + nz * hh;
      const d = evalPrims(index.listAt(px, py, pz), px, py, pz);
      occ += weights[s] * Math.max(0, (hh - d) / hh);
    }
    ao[i] = Math.max(0.25, 1 - occ * strength);
  }
  return ao;
}

/**
 * Per-bone surface distances at a point, for skin weighting.
 * Returns the nearest union primitive distance per bone.
 */
export function boneDistances(prims: Prim[], _boneCount: number, x: number, y: number, z: number, out: Float64Array): void {
  out.fill(BIG);
  for (const p of prims) {
    if (p.bone < 0 || p.op !== Op.Union || p.type === PrimType.Displace) continue;
    const d = primDist(p, x, y, z);
    if (d < out[p.bone]) out[p.bone] = d;
  }
}
