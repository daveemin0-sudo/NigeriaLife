import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

export interface BakeOptions {
  /** Subtrees to leave out of the bake */
  exclude?: THREE.Object3D[];
  /** Return false to skip a mesh, or a colour to override its material colour */
  filter?: (mesh: THREE.Mesh, material: THREE.Material) => boolean | THREE.Color;
  /** Object whose local space the baked vertices are expressed in (defaults to root) */
  space?: THREE.Object3D;
}

/**
 * Flattens a hierarchy of meshes into ONE vertex-coloured geometry so that many copies
 * can be drawn with a single InstancedMesh instead of dozens of draw calls each.
 */
export function bakeToGeometry(root: THREE.Object3D, opts: BakeOptions = {}): THREE.BufferGeometry | null {
  root.updateWorldMatrix(true, true);
  const space = opts.space ?? root;
  const inverse = new THREE.Matrix4().copy(space.matrixWorld).invert();
  const excluded = new Set(opts.exclude ?? []);
  const local = new THREE.Matrix4();
  const parts: THREE.BufferGeometry[] = [];

  const visit = (obj: THREE.Object3D): void => {
    if (excluded.has(obj) || !obj.visible) return;

    const mesh = obj as THREE.Mesh;
    if (mesh.isMesh && mesh.geometry) {
      const material = (Array.isArray(mesh.material) ? mesh.material[0] : mesh.material) as any;
      const isGhost = !material || (material.transparent && material.opacity < 0.6);
      const verdict = isGhost ? false : opts.filter ? opts.filter(mesh, material) : true;

      if (verdict !== false) {
        const src = mesh.geometry.index ? mesh.geometry.toNonIndexed() : mesh.geometry.clone();
        src.applyMatrix4(local.multiplyMatrices(inverse, mesh.matrixWorld));
        if (!src.getAttribute('normal')) src.computeVertexNormals();

        const color: THREE.Color = verdict instanceof THREE.Color ? verdict : (material.color ?? new THREE.Color(0xffffff));
        const count = src.getAttribute('position').count;
        const colors = new Float32Array(count * 3);
        for (let i = 0; i < count; i++) {
          colors[i * 3] = color.r;
          colors[i * 3 + 1] = color.g;
          colors[i * 3 + 2] = color.b;
        }

        const part = new THREE.BufferGeometry();
        part.setAttribute('position', src.getAttribute('position'));
        part.setAttribute('normal', src.getAttribute('normal'));
        part.setAttribute('color', new THREE.BufferAttribute(colors, 3));
        parts.push(part);
      }
    }

    for (const child of obj.children) visit(child);
  };

  visit(root);
  if (parts.length === 0) return null;

  const merged = mergeGeometries(parts, false);
  merged.computeBoundingBox();
  merged.computeBoundingSphere();
  return merged;
}

/**
 * A cheaper copy of a baked geometry for drawing far away: every vertex inside the same
 * `cell`-sized cube with the same colour becomes one vertex, and triangles that collapse
 * are dropped. Linear in the vertex count, so it is quick enough to run at start-up.
 * Keeping colours apart keeps the edges between skin, clothes and hair where they were.
 */
export function simplifyByClustering(geometry: THREE.BufferGeometry, cell: number): THREE.BufferGeometry {
  const pos = geometry.getAttribute('position');
  const nor = geometry.getAttribute('normal');
  const col = geometry.getAttribute('color');
  const index = geometry.index;
  const vertexCount = pos.count;

  const clusterOf = new Int32Array(vertexCount);
  const keys = new Map<string, number>();
  const sums: number[] = []; // per cluster: x y z nx ny nz r g b n
  for (let i = 0; i < vertexCount; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const r = col ? col.getX(i) : 1;
    const g = col ? col.getY(i) : 1;
    const b = col ? col.getZ(i) : 1;
    const key = `${Math.floor(x / cell)},${Math.floor(y / cell)},${Math.floor(z / cell)},${Math.round(r * 15)},${Math.round(g * 15)},${Math.round(b * 15)}`;
    let c = keys.get(key);
    if (c === undefined) {
      c = keys.size;
      keys.set(key, c);
      sums.push(0, 0, 0, 0, 0, 0, 0, 0, 0, 0);
    }
    clusterOf[i] = c;
    const o = c * 10;
    sums[o] += x;
    sums[o + 1] += y;
    sums[o + 2] += z;
    if (nor) {
      sums[o + 3] += nor.getX(i);
      sums[o + 4] += nor.getY(i);
      sums[o + 5] += nor.getZ(i);
    }
    sums[o + 6] += r;
    sums[o + 7] += g;
    sums[o + 8] += b;
    sums[o + 9] += 1;
  }

  const clusters = keys.size;
  const positions = new Float32Array(clusters * 3);
  const normals = new Float32Array(clusters * 3);
  const colors = new Float32Array(clusters * 3);
  for (let c = 0; c < clusters; c++) {
    const o = c * 10;
    const n = sums[o + 9];
    positions.set([sums[o] / n, sums[o + 1] / n, sums[o + 2] / n], c * 3);
    const len = Math.hypot(sums[o + 3], sums[o + 4], sums[o + 5]) || 1;
    normals.set([sums[o + 3] / len, sums[o + 4] / len, sums[o + 5] / len], c * 3);
    colors.set([sums[o + 6] / n, sums[o + 7] / n, sums[o + 8] / n], c * 3);
  }

  const triangles: number[] = [];
  const seen = new Set<string>();
  const corners = index ? index.count : vertexCount;
  for (let t = 0; t + 2 < corners; t += 3) {
    const a = clusterOf[index ? index.getX(t) : t];
    const b = clusterOf[index ? index.getX(t + 1) : t + 1];
    const c = clusterOf[index ? index.getX(t + 2) : t + 2];
    if (a === b || b === c || a === c) continue;
    const key = [a, b, c].sort((p, q) => p - q).join(',');
    if (seen.has(key)) continue;
    seen.add(key);
    triangles.push(a, b, c);
  }

  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
  if (col) out.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  out.setIndex(triangles);
  out.computeBoundingBox();
  out.computeBoundingSphere();
  return out;
}

/** Small deterministic PRNG so the generated city is identical on every load */
export function seededRandom(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
