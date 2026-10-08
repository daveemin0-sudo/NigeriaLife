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
