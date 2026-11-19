import * as THREE from 'three';
import { fabric, type Pattern } from './Fabrics';

/**
 * Stylized-realism skin and cloth response (ART-BIBLE):
 * - Skin: MeshPhysical sheen as a warm subsurface stand-in (no scene lighting changes)
 * - Cloth: pattern maps + sheen/satin for aso-oke / gold_chain; matte cotton for ankara
 * - Folds: soft ridge meshes that can sway in updateAnimation
 */

/** Warm melanin undertone for sheen (SSS-style rim in stylized PBR) */
function warmUnder(hex: string | number): THREE.Color {
  const base = new THREE.Color(hex);
  return base.clone().lerp(new THREE.Color(0xffb089), 0.45);
}

export function makeSkinMaterial(hex: string | number): THREE.MeshPhysicalMaterial {
  return new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(hex),
    roughness: 0.52,
    metalness: 0.0,
    sheen: 0.65,
    sheenRoughness: 0.42,
    sheenColor: warmUnder(hex),
    envMapIntensity: 0.55,
  });
}

export function makeClothMaterial(
  colour: number,
  pattern: Pattern,
  accent: number,
  opts: { satin?: boolean; roughness?: number } = {},
): THREE.MeshPhysicalMaterial {
  const map = fabric(pattern, colour, accent, 0x111827);
  const satin = opts.satin ?? (pattern === 'aso_oke' || pattern === 'gold_chain' || pattern === 'lace');
  return new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(colour),
    map: map ?? undefined,
    roughness: opts.roughness ?? (satin ? 0.42 : (pattern === 'ankara' || pattern === 'denim' ? 0.82 : 0.72)),
    metalness: satin && pattern === 'gold_chain' ? 0.12 : 0.02,
    sheen: satin ? 0.85 : 0.25,
    sheenRoughness: satin ? 0.28 : 0.7,
    sheenColor: satin ? new THREE.Color(accent).lerp(new THREE.Color(0xffe6a8), 0.35) : new THREE.Color(0xffffff),
    envMapIntensity: satin ? 0.9 : 0.45,
  });
}

/** Soft cloth ridge — parent keeps it out of merge; sway via userData.base* */
export function makeFoldRidge(
  material: THREE.Material,
  width: number,
  height: number,
  depth: number,
): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), material);
  mesh.castShadow = true;
  return mesh;
}

/**
 * Horizontal drape ridges across a torso front (shirt / kaftan / tee).
 * Returns meshes to exclude from mergeParts and to sway each frame.
 */
export function addFrontFolds(
  parent: THREE.Object3D,
  material: THREE.Material,
  opts: {
    count?: number;
    z: number;
    y0: number;
    y1: number;
    width: number;
    amplitude?: number;
  },
): THREE.Mesh[] {
  const n = opts.count ?? 5;
  const folds: THREE.Mesh[] = [];
  for (let i = 0; i < n; i++) {
    const t = n === 1 ? 0.5 : i / (n - 1);
    const y = opts.y0 + (opts.y1 - opts.y0) * t;
    const w = opts.width * (0.72 + 0.28 * Math.sin(t * Math.PI));
    const fold = makeFoldRidge(material, w, 0.018, 0.012);
    fold.position.set(0, y, opts.z + Math.sin(t * Math.PI) * 0.006);
    fold.rotation.x = -0.15 + t * 0.08;
    fold.userData.baseY = fold.position.y;
    fold.userData.baseZ = fold.position.z;
    fold.userData.baseRotX = fold.rotation.x;
    fold.userData.sway = 0.7 + t * 0.5;
    parent.add(fold);
    folds.push(fold);
  }
  return folds;
}

/** Side drape panels (kaftan / agbada / open gold shirt) */
export function addSideDrape(
  parent: THREE.Object3D,
  material: THREE.Material,
  side: -1 | 1,
  opts: { x: number; y0: number; y1: number; z: number },
): THREE.Mesh {
  const h = Math.abs(opts.y1 - opts.y0);
  const panel = new THREE.Mesh(new THREE.PlaneGeometry(0.08, h, 1, 4), material);
  (panel.material as THREE.Material & { side?: number }).side = THREE.DoubleSide;
  panel.position.set(opts.x, (opts.y0 + opts.y1) / 2, opts.z);
  panel.rotation.y = side * 0.55;
  panel.userData.baseY = panel.position.y;
  panel.userData.baseRotY = panel.rotation.y;
  panel.userData.sway = 1.1;
  parent.add(panel);
  return panel;
}

/** Advance fold/drape sway — call from updateAnimation */
export function swayCloth(folds: THREE.Object3D[], time: number, walking: boolean): void {
  const amp = walking ? 0.012 : 0.006;
  const speed = walking ? 5.5 : 2.4;
  for (let i = 0; i < folds.length; i++) {
    const f = folds[i];
    const s = (f.userData.sway as number) || 1;
    if (f.userData.baseY !== undefined) {
      f.position.y = f.userData.baseY + Math.sin(time * speed + i * 0.9) * amp * s;
    }
    if (f.userData.baseZ !== undefined) {
      f.position.z = f.userData.baseZ + Math.cos(time * speed * 0.8 + i) * amp * 0.4 * s;
    }
    if (f.userData.baseRotX !== undefined) {
      f.rotation.x = f.userData.baseRotX + Math.sin(time * speed + i) * 0.05 * s;
    }
    if (f.userData.baseRotY !== undefined) {
      f.rotation.y = f.userData.baseRotY + Math.sin(time * speed * 0.7 + i) * 0.08 * s;
    }
  }
}
