import * as THREE from 'three';
import { fabric, type Pattern } from './Fabrics';

/**
 * Stylized-realism skin and cloth response (ART-BIBLE):
 * - Skin: MeshPhysical sheen as a warm subsurface stand-in + pore/microvariation maps
 * - Cloth: pattern maps + sheen/satin for aso-oke / gold_chain; matte cotton for ankara
 * - Folds: soft ridge meshes that can sway in updateAnimation
 */

const skinCache = new Map<string, THREE.CanvasTexture>();

/** Warm melanin undertone for sheen (SSS-style rim in stylized PBR) */
function warmUnder(hex: string | number): THREE.Color {
  const base = new THREE.Color(hex);
  return base.clone().lerp(new THREE.Color(0xffb089), 0.45);
}

/** Fine pore + melanin micro-variation — cheap canvas, scaled for HD 620 / A16 */
function skinDetailMaps(hex: string | number): { map: THREE.CanvasTexture; bump: THREE.CanvasTexture } | null {
  if (typeof document === 'undefined') return null;
  const key = `skin:${new THREE.Color(hex).getHexString()}`;
  const knownMap = skinCache.get(`${key}:map`);
  const knownBump = skinCache.get(`${key}:bump`);
  if (knownMap && knownBump) return { map: knownMap, bump: knownBump };

  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  const base = new THREE.Color(hex);
  ctx.fillStyle = `#${base.getHexString()}`;
  ctx.fillRect(0, 0, size, size);
  // Soft melanin mottling
  for (let i = 0; i < 900; i++) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    const r = 1 + Math.random() * 3;
    const light = Math.random() > 0.55;
    const c = base.clone().offsetHSL(0, light ? -0.02 : 0.03, light ? 0.04 : -0.05);
    ctx.fillStyle = `rgba(${(c.r * 255) | 0},${(c.g * 255) | 0},${(c.b * 255) | 0},${0.08 + Math.random() * 0.12})`;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  const map = new THREE.CanvasTexture(canvas);
  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = map.wrapT = THREE.RepeatWrapping;
  map.repeat.set(3, 3);
  map.anisotropy = 2;

  const bumpCanvas = document.createElement('canvas');
  bumpCanvas.width = size;
  bumpCanvas.height = size;
  const bctx = bumpCanvas.getContext('2d');
  if (!bctx) return null;
  bctx.fillStyle = '#808080';
  bctx.fillRect(0, 0, size, size);
  for (let i = 0; i < 2200; i++) {
    const g = (100 + Math.random() * 55) | 0;
    bctx.fillStyle = `rgb(${g},${g},${g})`;
    bctx.fillRect(Math.random() * size, Math.random() * size, 1 + (Math.random() > 0.85 ? 1 : 0), 1);
  }
  const bump = new THREE.CanvasTexture(bumpCanvas);
  bump.wrapS = bump.wrapT = THREE.RepeatWrapping;
  bump.repeat.set(6, 6);
  bump.anisotropy = 2;

  skinCache.set(`${key}:map`, map);
  skinCache.set(`${key}:bump`, bump);
  return { map, bump };
}

export function makeSkinMaterial(hex: string | number): THREE.MeshPhysicalMaterial {
  const details = skinDetailMaps(hex);
  return new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(hex),
    map: details?.map,
    bumpMap: details?.bump,
    bumpScale: 0.012,
    roughness: 0.48,
    metalness: 0.0,
    sheen: 0.72,
    sheenRoughness: 0.38,
    sheenColor: warmUnder(hex),
    envMapIntensity: 0.5,
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
  const cottony = pattern === 'pique' || pattern === 'cotton' || pattern === 'knit';
  const pique = pattern === 'pique';
  // Map already carries dye colour — keep material tint near-white so weave contrast survives
  const tint = map && cottony ? new THREE.Color(0xffffff) : new THREE.Color(colour);
  return new THREE.MeshPhysicalMaterial({
    color: tint,
    map: map ?? undefined,
    roughness: opts.roughness ?? (satin ? 0.42 : pique ? 0.88 : cottony ? 0.84 : pattern === 'ankara' || pattern === 'denim' ? 0.85 : 0.72),
    metalness: satin && pattern === 'gold_chain' ? 0.12 : 0.0,
    sheen: satin ? 0.85 : pique ? 0.18 : cottony ? 0.24 : 0.22,
    sheenRoughness: satin ? 0.28 : pique ? 0.82 : cottony ? 0.72 : 0.72,
    sheenColor: satin
      ? new THREE.Color(accent).lerp(new THREE.Color(0xffe6a8), 0.35)
      : cottony
        ? new THREE.Color(colour).lerp(new THREE.Color(0xffffff), 0.12)
        : new THREE.Color(0xffffff),
    envMapIntensity: satin ? 0.9 : pique ? 0.22 : cottony ? 0.28 : 0.45,
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
    /** Soft knit ridges (polo/tee) — thinner, less plastic armor look */
    soft?: boolean;
  },
): THREE.Mesh[] {
  const n = opts.count ?? 5;
  const soft = opts.soft === true;
  const folds: THREE.Mesh[] = [];
  for (let i = 0; i < n; i++) {
    const t = n === 1 ? 0.5 : i / (n - 1);
    const y = opts.y0 + (opts.y1 - opts.y0) * t;
    const w = opts.width * (0.72 + 0.28 * Math.sin(t * Math.PI));
    const fold = makeFoldRidge(material, w, soft ? 0.01 : 0.018, soft ? 0.005 : 0.012);
    fold.position.set(0, y, opts.z + Math.sin(t * Math.PI) * (soft ? 0.003 : 0.006));
    fold.rotation.x = (soft ? -0.08 : -0.15) + t * 0.06;
    fold.userData.baseY = fold.position.y;
    fold.userData.baseZ = fold.position.z;
    fold.userData.baseRotX = fold.rotation.x;
    fold.userData.sway = soft ? 0.45 + t * 0.35 : 0.7 + t * 0.5;
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
