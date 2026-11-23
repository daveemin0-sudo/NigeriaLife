import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/**
 * Shared Lagos keke (passenger tricycle) and okada (commuter motorcycle) bodies.
 *
 * Static parts are merged by material into at most six meshes, and the merged
 * geometries plus materials are shared across every copy. Wheels and steering
 * stay separate so they can turn. No manufacturer names or logos.
 *
 * Layout matches the ride attachment points Claude Code relies on:
 *   keke driver (0, 0.74, 0.3), passengers (±) on the rear bench,
 *   okada driver (0, 0.88, -0.03) pitched 0.12, passenger (0, 0.92, -0.52).
 */

// ------------------------------------------------------------------------------------------
// Layout constants (do not move — seated people and boarding hang on these)
// ------------------------------------------------------------------------------------------

export const KEKE_LAYOUT = {
  wheelRadius: 0.25,
  frontWheel: { x: 0, y: 0.25, z: 1.12 },
  rearWheel: { y: 0.25, z: -0.78, halfTrack: 0.6 },
  steer: { x: 0, y: 1.02, z: 0.74, pitch: -0.35 },
  gripHalf: 0.29,
  driver: { x: 0, y: 0.74, z: 0.3 },
  passengerL: { x: -0.3, y: 0.7, z: -0.62 },
  passengerR: { x: 0.34, y: 0.7, z: -0.62 },
} as const;

export const OKADA_LAYOUT = {
  wheelRadius: 0.3,
  frontWheel: { x: 0, y: 0.3, z: 0.68 },
  rearWheel: { x: 0, y: 0.3, z: -0.64 },
  steer: { x: 0, y: 1.08, z: 0.5, pitch: -0.4 },
  gripHalf: 0.32,
  driver: { x: 0, y: 0.88, z: -0.03, pitch: 0.12 },
  passenger: { x: 0, y: 0.92, z: -0.52 },
} as const;

// ------------------------------------------------------------------------------------------
// Shared materials (≤6 per vehicle; singletons reused by every copy)
// ------------------------------------------------------------------------------------------

const KEKE_MATS = {
  /** Yellow + green body parts via vertex colours */
  body: new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.32,
    metalness: 0.18,
  }),
  canvas: new THREE.MeshStandardMaterial({
    color: 0x18181b,
    roughness: 0.94,
    metalness: 0.02,
    side: THREE.DoubleSide,
  }),
  interior: new THREE.MeshStandardMaterial({
    color: 0x1c1c1f,
    roughness: 0.78,
    metalness: 0.05,
  }),
  metal: new THREE.MeshStandardMaterial({
    color: 0xd4d4d8,
    roughness: 0.28,
    metalness: 0.88,
  }),
  glass: new THREE.MeshStandardMaterial({
    color: 0xbfe3ff,
    transparent: true,
    opacity: 0.38,
    roughness: 0.06,
    metalness: 0.2,
    side: THREE.DoubleSide,
    depthWrite: false,
  }),
  lamp: new THREE.MeshStandardMaterial({
    color: 0xfffbe6,
    emissive: 0xfff3c4,
    emissiveIntensity: 1.15,
    roughness: 0.25,
    metalness: 0.2,
  }),
  /** Rear brake / tail lamps only (shared across copies) */
  tail: new THREE.MeshStandardMaterial({
    color: 0xb91c1c,
    emissive: 0xef4444,
    emissiveIntensity: 1.6,
    roughness: 0.35,
    metalness: 0.1,
  }),
} as const;

const OKADA_MATS = {
  paint: new THREE.MeshPhysicalMaterial({
    color: 0xb91c1c,
    roughness: 0.28,
    metalness: 0.55,
    clearcoat: 0.75,
    clearcoatRoughness: 0.2,
  }),
  dark: new THREE.MeshStandardMaterial({
    color: 0x18181b,
    roughness: 0.45,
    metalness: 0.7,
  }),
  engine: new THREE.MeshStandardMaterial({
    color: 0x6b7280,
    roughness: 0.5,
    metalness: 0.75,
  }),
  rubber: new THREE.MeshStandardMaterial({
    color: 0x0c0c0e,
    roughness: 0.88,
    metalness: 0.05,
  }),
  chrome: new THREE.MeshStandardMaterial({
    color: 0xe8eaed,
    roughness: 0.18,
    metalness: 0.92,
  }),
  lamp: new THREE.MeshStandardMaterial({
    color: 0xfffbeb,
    emissive: 0xffe8a3,
    emissiveIntensity: 1.2,
    roughness: 0.2,
    metalness: 0.15,
  }),
  /** Rear brake / tail lamps only (shared across copies) */
  tail: new THREE.MeshStandardMaterial({
    color: 0xb91c1c,
    emissive: 0xef4444,
    emissiveIntensity: 1.6,
    roughness: 0.35,
    metalness: 0.1,
  }),
} as const;

const courierBoxMats = new Map<number, THREE.MeshPhysicalMaterial>();

function courierBoxMaterial(hex: number): THREE.MeshPhysicalMaterial {
  let mat = courierBoxMats.get(hex);
  if (!mat) {
    mat = new THREE.MeshPhysicalMaterial({
      color: hex,
      roughness: 0.4,
      metalness: 0.15,
      clearcoat: 0.55,
    });
    courierBoxMats.set(hex, mat);
  }
  return mat;
}

// ------------------------------------------------------------------------------------------
// Geometry bag: place parts, then merge by material once into shared prototypes
// ------------------------------------------------------------------------------------------

type MatKey = string;

class GeoBag {
  private bags = new Map<MatKey, { mat: THREE.Material; parts: THREE.BufferGeometry[] }>();
  private readonly matrix = new THREE.Matrix4();
  private readonly euler = new THREE.Euler();
  private readonly quat = new THREE.Quaternion();
  private readonly pos = new THREE.Vector3();
  private readonly scl = new THREE.Vector3(1, 1, 1);
  private readonly colour = new THREE.Color();

  add(
    key: MatKey,
    mat: THREE.Material,
    geometry: THREE.BufferGeometry,
    x: number,
    y: number,
    z: number,
    opts: {
      pitch?: number;
      yaw?: number;
      roll?: number;
      sx?: number;
      sy?: number;
      sz?: number;
      /** Vertex colour for materials with vertexColors: true */
      hex?: number;
    } = {},
  ): void {
    const flat = geometry.index ? geometry.toNonIndexed() : geometry.clone();
    flat.deleteAttribute('uv');
    this.euler.set(opts.pitch ?? 0, opts.yaw ?? 0, opts.roll ?? 0, 'YXZ');
    this.pos.set(x, y, z);
    this.scl.set(opts.sx ?? 1, opts.sy ?? 1, opts.sz ?? 1);
    this.matrix.compose(this.pos, this.quat.setFromEuler(this.euler), this.scl);
    flat.applyMatrix4(this.matrix);
    if (!flat.getAttribute('normal')) flat.computeVertexNormals();

    if (opts.hex !== undefined && (mat as THREE.MeshStandardMaterial).vertexColors) {
      this.colour.setHex(opts.hex);
      const count = flat.getAttribute('position').count;
      const colours = new Float32Array(count * 3);
      for (let i = 0; i < count; i++) {
        colours[i * 3] = this.colour.r;
        colours[i * 3 + 1] = this.colour.g;
        colours[i * 3 + 2] = this.colour.b;
      }
      flat.setAttribute('color', new THREE.BufferAttribute(colours, 3));
    }

    let bag = this.bags.get(key);
    if (!bag) {
      bag = { mat, parts: [] };
      this.bags.set(key, bag);
    }
    bag.parts.push(flat);
    if (flat !== geometry) geometry.dispose();
  }

  box(
    key: MatKey,
    mat: THREE.Material,
    w: number,
    h: number,
    d: number,
    x: number,
    y: number,
    z: number,
    opts: Parameters<GeoBag['add']>[6] = {},
  ): void {
    this.add(key, mat, new THREE.BoxGeometry(w, h, d), x, y, z, opts);
  }

  cyl(
    key: MatKey,
    mat: THREE.Material,
    rTop: number,
    rBot: number,
    h: number,
    x: number,
    y: number,
    z: number,
    sides: number,
    opts: Parameters<GeoBag['add']>[6] = {},
  ): void {
    this.add(key, mat, new THREE.CylinderGeometry(rTop, rBot, h, sides), x, y, z, opts);
  }

  /** Merge each material bag into one shared geometry. */
  bake(): Array<{ geometry: THREE.BufferGeometry; material: THREE.Material }> {
    const out: Array<{ geometry: THREE.BufferGeometry; material: THREE.Material }> = [];
    for (const { mat, parts } of this.bags.values()) {
      if (parts.length === 0) continue;
      const merged = mergeGeometries(parts, false);
      for (const p of parts) p.dispose();
      if (merged) out.push({ geometry: merged, material: mat });
    }
    this.bags.clear();
    return out;
  }
}

function attachBaked(
  parent: THREE.Object3D,
  baked: Array<{ geometry: THREE.BufferGeometry; material: THREE.Material }>,
  castShadow = true,
): void {
  for (const { geometry, material } of baked) {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.castShadow = castShadow;
    mesh.receiveShadow = true;
    parent.add(mesh);
  }
}

// ------------------------------------------------------------------------------------------
// Keke prototype
// ------------------------------------------------------------------------------------------

const YELLOW = 0xf6c90e;
const GREEN = 0x15803d;
const BODY_DARK = 0x1f2937;

let kekeShell: Array<{ geometry: THREE.BufferGeometry; material: THREE.Material }> | null = null;
let kekeGlass: Array<{ geometry: THREE.BufferGeometry; material: THREE.Material }> | null = null;
let kekeLamps: Array<{ geometry: THREE.BufferGeometry; material: THREE.Material }> | null = null;

function ensureKekePrototype(): void {
  if (kekeShell) return;

  const body = new GeoBag();
  const canvas = new GeoBag();
  const interior = new GeoBag();
  const metal = new GeoBag();
  const glass = new GeoBag();
  const lamp = new GeoBag();

  // --- Curved nose cowl (side profile extruded across width) ---
  const nose = new THREE.Shape();
  nose.moveTo(0.5, 0.32);
  nose.lineTo(1.18, 0.32);
  nose.quadraticCurveTo(1.4, 0.36, 1.46, 0.55);
  nose.quadraticCurveTo(1.48, 0.78, 1.36, 0.95);
  nose.quadraticCurveTo(1.22, 1.08, 0.95, 1.1);
  nose.lineTo(0.5, 1.08);
  nose.lineTo(0.5, 0.32);
  const noseGeo = new THREE.ExtrudeGeometry(nose, {
    depth: 0.82,
    bevelEnabled: true,
    bevelThickness: 0.06,
    bevelSize: 0.055,
    bevelSegments: 3,
    curveSegments: 12,
  });
  noseGeo.translate(0, 0, -0.41);
  noseGeo.rotateY(-Math.PI / 2);
  body.add('body', KEKE_MATS.body, noseGeo, 0, 0, 0.06, { hex: YELLOW });
  // Bonnet scoop / headlamp brow
  body.box('body', KEKE_MATS.body, 0.55, 0.06, 0.28, 0, 0.98, 1.15, { pitch: -0.25, hex: YELLOW });
  body.box('body', KEKE_MATS.body, 0.7, 0.05, 0.08, 0, 0.78, 1.42, { hex: GREEN });

  // Floor pan + undertray ribs
  body.box('body', KEKE_MATS.body, 1.2, 0.05, 2.05, 0, 0.33, -0.18, { hex: BODY_DARK });
  for (const z of [0.4, 0.0, -0.4, -0.8]) {
    body.box('body', KEKE_MATS.body, 1.05, 0.03, 0.04, 0, 0.3, z, { hex: BODY_DARK });
  }

  // Side sills + green stripe + open entry lips
  for (const side of [-1, 1]) {
    body.box('body', KEKE_MATS.body, 0.07, 0.36, 1.72, side * 0.615, 0.52, -0.12, { hex: YELLOW });
    body.box('body', KEKE_MATS.body, 0.075, 0.09, 1.72, side * 0.615, 0.72, -0.12, { hex: GREEN });
    body.box('body', KEKE_MATS.body, 0.05, 0.08, 0.55, side * 0.62, 0.4, 0.35, { hex: YELLOW });
    // Running-board step
    body.box('body', KEKE_MATS.body, 0.14, 0.03, 0.7, side * 0.72, 0.28, 0.05, { hex: BODY_DARK });
    // Rear wheel arch flare
    body.box('body', KEKE_MATS.body, 0.08, 0.22, 0.45, side * 0.68, 0.45, -0.78, { hex: YELLOW });
  }

  // Rear engine cover / boot with rounded top lip
  body.box('body', KEKE_MATS.body, 1.3, 0.62, 0.48, 0, 0.58, -1.1, { hex: YELLOW });
  body.box('body', KEKE_MATS.body, 1.32, 0.09, 0.5, 0, 0.92, -1.1, { hex: GREEN });
  body.box('body', KEKE_MATS.body, 1.18, 0.08, 0.2, 0, 0.95, -1.28, { pitch: 0.2, hex: YELLOW });
  for (let i = 0; i < 5; i++) {
    body.box('body', KEKE_MATS.body, 0.95, 0.014, 0.02, 0, 0.52 + i * 0.07, -1.34, { hex: BODY_DARK });
  }
  // Rear bumper corners
  for (const side of [-1, 1]) {
    body.box('body', KEKE_MATS.body, 0.12, 0.1, 0.08, side * 0.58, 0.4, -1.34, { hex: YELLOW });
  }

  // Front mudguard arch over the front wheel
  const fender = new THREE.CylinderGeometry(0.36, 0.34, 0.22, 16, 1, false, 0, Math.PI);
  body.add('body', KEKE_MATS.body, fender, 0, 0.42, 1.12, { roll: Math.PI / 2, hex: YELLOW });
  body.box('body', KEKE_MATS.body, 0.24, 0.04, 0.48, 0, 0.58, 1.02, { hex: YELLOW });
  body.box('body', KEKE_MATS.body, 0.18, 0.03, 0.2, 0, 0.5, 1.28, { pitch: 0.35, hex: YELLOW });

  // Number plate (rear)
  body.box('body', KEKE_MATS.body, 0.36, 0.13, 0.02, 0, 0.48, -1.36, { hex: 0xf8fafc });

  // --- Canvas roof (curved), side rolls, rear curtain ---
  const roofGeo = new THREE.CylinderGeometry(0.68, 0.68, 2.35, 16, 1, true, -Math.PI / 2, Math.PI);
  roofGeo.rotateX(-Math.PI / 2);
  canvas.add('canvas', KEKE_MATS.canvas, roofGeo, 0, 1.68, -0.22, { sy: 0.28 });
  // Roof edge rails (valance)
  canvas.box('canvas', KEKE_MATS.canvas, 1.28, 0.04, 2.2, 0, 1.62, -0.2);
  for (const side of [-1, 1]) {
    canvas.box('canvas', KEKE_MATS.canvas, 0.04, 0.14, 2.15, side * 0.64, 1.55, -0.2);
    // Rolled side curtain under the roof edge (horizontal along z)
    canvas.cyl('canvas', KEKE_MATS.canvas, 0.045, 0.045, 1.45, side * 0.63, 1.5, 0.02, 8, {
      pitch: Math.PI / 2,
    });
    // Rear quarter canvas panels
    canvas.box('canvas', KEKE_MATS.canvas, 0.04, 0.95, 0.52, side * 0.64, 1.05, -1.0);
  }
  // Rear canvas wall + small rear window surround
  canvas.box('canvas', KEKE_MATS.canvas, 1.28, 0.7, 0.04, 0, 1.15, -1.32);
  canvas.box('canvas', KEKE_MATS.canvas, 0.55, 0.22, 0.03, 0, 1.35, -1.325);

  // --- Interior: floor mats, dash, seats ---
  interior.box('interior', KEKE_MATS.interior, 1.1, 0.02, 1.9, 0, 0.37, -0.15);
  // Ribbed floor mat strips
  for (let i = 0; i < 6; i++) {
    interior.box('interior', KEKE_MATS.interior, 1.0, 0.01, 0.04, 0, 0.385, 0.5 - i * 0.22);
  }
  // Dashboard shelf behind the windscreen
  interior.box('interior', KEKE_MATS.interior, 0.95, 0.08, 0.28, 0, 0.95, 0.72, { pitch: -0.2 });
  interior.box('interior', KEKE_MATS.interior, 0.35, 0.06, 0.12, 0, 1.0, 0.7);
  interior.box('interior', KEKE_MATS.interior, 0.22, 0.1, 0.06, 0, 1.02, 0.68);
  // Speedo / switch blanks on the dash
  interior.cyl('interior', KEKE_MATS.interior, 0.04, 0.04, 0.02, -0.12, 1.0, 0.66, 10, { pitch: Math.PI / 2 });
  interior.cyl('interior', KEKE_MATS.interior, 0.03, 0.03, 0.02, 0.1, 1.0, 0.66, 8, { pitch: Math.PI / 2 });
  // Driver saddle + backrest (hip at y=0.74)
  interior.box('interior', KEKE_MATS.interior, 0.48, 0.1, 0.4, 0, 0.62, 0.3);
  interior.box('interior', KEKE_MATS.interior, 0.42, 0.04, 0.36, 0, 0.68, 0.3);
  interior.box('interior', KEKE_MATS.interior, 0.4, 0.22, 0.07, 0, 0.78, 0.08, { pitch: -0.18 });
  // Rear bench + backrest (hips at y=0.7, z=-0.62)
  interior.box('interior', KEKE_MATS.interior, 1.14, 0.12, 0.44, 0, 0.56, -0.62);
  interior.box('interior', KEKE_MATS.interior, 1.1, 0.04, 0.4, 0, 0.63, -0.62);
  interior.box('interior', KEKE_MATS.interior, 1.14, 0.46, 0.1, 0, 0.78, -0.88, { pitch: -0.12 });
  // Bench divider / grab bar mounts
  for (const side of [-1, 1]) {
    interior.box('interior', KEKE_MATS.interior, 0.04, 0.08, 0.35, side * 0.28, 0.64, -0.62);
    interior.box('interior', KEKE_MATS.interior, 0.08, 0.04, 0.7, side * 0.35, 0.4, 0.15);
  }

  // --- Metal frame, forks, mirrors, wipers ---
  // Roof underside sits at y ≈ 1.55 (valance); posts must end there (keke ≤ 1.92 m overall)
  const roofUnder = 1.55;
  for (const side of [-1, 1]) {
    // Front A-pillars (top ends at roof underside)
    metal.cyl('metal', KEKE_MATS.metal, 0.02, 0.02, 0.55, side * 0.52, 1.22, 0.88, 6, { pitch: -0.18 });
    // Mid and rear roof posts: sill → underside of roof
    const postH = roofUnder - 0.72;
    const postY = (roofUnder + 0.72) / 2;
    metal.cyl('metal', KEKE_MATS.metal, 0.02, 0.02, postH, side * 0.62, postY, -0.05, 6);
    metal.cyl('metal', KEKE_MATS.metal, 0.02, 0.02, postH, side * 0.62, postY, -0.85, 6);
    // Roof longitudinal rail under the canvas edge
    metal.cyl('metal', KEKE_MATS.metal, 0.016, 0.016, 1.9, side * 0.6, roofUnder, -0.15, 6, {
      pitch: Math.PI / 2,
    });
  }
  // Windscreen frame
  metal.box('metal', KEKE_MATS.metal, 1.02, 0.04, 0.04, 0, 1.08, 0.98);
  metal.box('metal', KEKE_MATS.metal, 1.02, 0.04, 0.04, 0, roofUnder, 0.86);
  for (const side of [-1, 1]) {
    metal.box('metal', KEKE_MATS.metal, 0.04, 0.48, 0.04, side * 0.5, 1.3, 0.92, { pitch: -0.18 });
  }
  // Front fork legs to the axle
  for (const side of [-1, 1]) {
    metal.cyl('metal', KEKE_MATS.metal, 0.018, 0.018, 0.55, side * 0.09, 0.48, 1.12, 6, { pitch: -0.05 });
  }
  metal.box('metal', KEKE_MATS.metal, 0.22, 0.04, 0.04, 0, 0.72, 1.12);
  // Wiper arms on the windscreen
  metal.box('metal', KEKE_MATS.metal, 0.01, 0.01, 0.42, -0.12, 1.4, 0.93, { pitch: -0.35, yaw: 0.15 });
  metal.box('metal', KEKE_MATS.metal, 0.01, 0.01, 0.38, 0.18, 1.38, 0.94, { pitch: -0.3, yaw: -0.1 });
  // Side mirrors on A-pillars
  for (const side of [-1, 1]) {
    metal.cyl('metal', KEKE_MATS.metal, 0.008, 0.008, 0.14, side * 0.58, 1.15, 0.95, 5, {
      yaw: side * 0.4,
    });
    metal.box('metal', KEKE_MATS.metal, 0.1, 0.07, 0.02, side * 0.7, 1.18, 0.98, { yaw: side * 0.35 });
  }
  // Rear grab / bumper bar
  metal.cyl('metal', KEKE_MATS.metal, 0.015, 0.015, 1.05, 0, 0.7, -1.35, 6, { yaw: Math.PI / 2 });
  // Exhaust out the rear-right
  metal.cyl('metal', KEKE_MATS.metal, 0.022, 0.028, 0.4, 0.45, 0.28, -1.15, 6, { pitch: Math.PI / 2 });
  metal.cyl('metal', KEKE_MATS.metal, 0.03, 0.03, 0.08, 0.45, 0.28, -1.38, 6, { pitch: Math.PI / 2 });
  // Steering column tube down to the floor
  metal.cyl('metal', KEKE_MATS.metal, 0.025, 0.03, 0.55, 0, 0.72, 0.78, 6, { pitch: -0.45 });

  // --- Glass windscreen ---
  glass.add(
    'glass',
    KEKE_MATS.glass,
    new THREE.PlaneGeometry(0.94, 0.58),
    0,
    1.36,
    0.92,
    { pitch: -0.18 },
  );
  // Tiny rear window pane
  glass.add(
    'glass',
    KEKE_MATS.glass,
    new THREE.PlaneGeometry(0.5, 0.18),
    0,
    1.35,
    -1.34,
  );

  // --- Lamps ---
  const tail = new GeoBag();
  // Cyclops headlamp (proud of the nose) — white
  metal.cyl('metal', KEKE_MATS.metal, 0.13, 0.13, 0.06, 0, 0.64, 1.48, 14, { pitch: Math.PI / 2 });
  lamp.cyl('lamp', KEKE_MATS.lamp, 0.11, 0.11, 0.045, 0, 0.64, 1.52, 14, { pitch: Math.PI / 2 });
  // Front indicators (white/amber-ish via headlamp material)
  for (const side of [-1, 1]) {
    lamp.box('lamp', KEKE_MATS.lamp, 0.09, 0.055, 0.045, side * 0.36, 0.9, 1.4);
  }
  // Rear tail lamps + centre brake — red
  for (const side of [-1, 1]) {
    tail.box('tail', KEKE_MATS.tail, 0.16, 0.08, 0.04, side * 0.52, 0.86, -1.37);
  }
  tail.box('tail', KEKE_MATS.tail, 0.22, 0.045, 0.035, 0, 0.98, -1.37);

  kekeShell = [...body.bake(), ...canvas.bake(), ...interior.bake(), ...metal.bake()];
  kekeGlass = glass.bake();
  kekeLamps = [...lamp.bake(), ...tail.bake()];
}

/**
 * Adds the shared keke shell (merged by material) into `parent`.
 * Does not add wheels, steer, or people — callers attach those.
 */
export function addKekeBody(parent: THREE.Object3D): void {
  ensureKekePrototype();
  attachBaked(parent, kekeShell!);
  attachBaked(parent, kekeGlass!, false);
  attachBaked(parent, kekeLamps!, false);
}

/** Handlebar column for the keke; grips sit at ±KEKE_LAYOUT.gripHalf on local x. */
export function buildKekeSteer(): THREE.Group {
  const steer = new THREE.Group();
  const L = KEKE_LAYOUT.steer;
  steer.position.set(L.x, L.y, L.z);
  steer.rotation.x = L.pitch;

  const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.64, 8), KEKE_MATS.metal);
  bar.rotation.z = Math.PI / 2;
  steer.add(bar);

  const gripMat = KEKE_MATS.interior;
  for (const side of [-1, 1]) {
    const g = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.12, 8), gripMat);
    g.rotation.z = Math.PI / 2;
    g.position.x = side * KEKE_LAYOUT.gripHalf;
    steer.add(g);
  }
  const pod = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.09, 0.07), gripMat);
  pod.position.set(0, 0.04, 0.03);
  steer.add(pod);

  // Mirror stalks on the bars
  for (const side of [-1, 1]) {
    const stalk = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.18, 5), KEKE_MATS.metal);
    stalk.position.set(side * 0.22, 0.1, 0);
    const glass = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.012, 10), KEKE_MATS.interior);
    glass.rotation.x = Math.PI / 2;
    glass.position.set(side * 0.24, 0.2, 0);
    steer.add(stalk, glass);
  }
  return steer;
}

// ------------------------------------------------------------------------------------------
// Okada prototype
// ------------------------------------------------------------------------------------------

let okadaShell: Array<{ geometry: THREE.BufferGeometry; material: THREE.Material }> | null = null;
let okadaLamps: Array<{ geometry: THREE.BufferGeometry; material: THREE.Material }> | null = null;
let okadaCourierGeo: THREE.BufferGeometry | null = null;

function ensureOkadaPrototype(): void {
  if (okadaShell) return;

  const paint = new GeoBag();
  // Frame + engine share one dark-metal material so a courier box can use the 6th slot
  const dark = new GeoBag();
  const rubber = new GeoBag();
  const chrome = new GeoBag();
  const lamp = new GeoBag();

  // --- Fuel tank (teardrop from two scaled spheres + filler neck) ---
  const tankMain = new THREE.SphereGeometry(0.2, 16, 12);
  tankMain.scale(0.95, 0.7, 1.35);
  paint.add('paint', OKADA_MATS.paint, tankMain, 0, 0.86, 0.2);
  const tankNose = new THREE.SphereGeometry(0.12, 12, 10);
  tankNose.scale(0.9, 0.75, 1.4);
  paint.add('paint', OKADA_MATS.paint, tankNose, 0, 0.84, 0.42);
  // Side knee panels / shrouds
  paint.box('paint', OKADA_MATS.paint, 0.22, 0.2, 0.36, 0, 0.6, -0.18);
  for (const side of [-1, 1]) {
    paint.box('paint', OKADA_MATS.paint, 0.045, 0.12, 0.28, side * 0.17, 0.78, 0.16);
    paint.box('paint', OKADA_MATS.paint, 0.03, 0.14, 0.2, side * 0.2, 0.58, -0.15);
  }

  // --- Frame tubes ---
  dark.box('dark', OKADA_MATS.dark, 0.05, 0.05, 0.7, 0, 0.58, 0.28, { pitch: 0.7 });
  dark.box('dark', OKADA_MATS.dark, 0.045, 0.045, 0.85, 0, 0.7, -0.28, { pitch: -0.12 });
  dark.box('dark', OKADA_MATS.dark, 0.04, 0.04, 0.5, 0, 0.42, -0.1, { pitch: 0.15 });
  dark.cyl('dark', OKADA_MATS.dark, 0.035, 0.035, 0.16, 0, 0.95, 0.52, 8, { pitch: -0.35 });
  // Down tubes beside the engine
  for (const side of [-1, 1]) {
    dark.box('dark', OKADA_MATS.dark, 0.03, 0.03, 0.4, side * 0.1, 0.5, 0.15, { pitch: 0.55 });
    dark.box('dark', OKADA_MATS.dark, 0.03, 0.03, 0.45, side * 0.08, 0.38, -0.4, { pitch: 0.08 });
  }
  // Rear shock bodies
  for (const side of [-1, 1]) {
    chrome.cyl('chrome', OKADA_MATS.chrome, 0.018, 0.022, 0.28, side * 0.1, 0.55, -0.55, 6, { pitch: 0.35 });
  }

  // --- Engine block + fins + cases ---
  dark.box('dark', OKADA_MATS.dark, 0.24, 0.28, 0.36, 0, 0.4, 0.08);
  dark.box('dark', OKADA_MATS.dark, 0.2, 0.12, 0.2, 0, 0.58, 0.12);
  for (let i = 0; i < 6; i++) {
    dark.box('dark', OKADA_MATS.dark, 0.28, 0.014, 0.2, 0, 0.46 + i * 0.032, 0.2);
  }
  dark.cyl('dark', OKADA_MATS.dark, 0.08, 0.09, 0.14, 0.1, 0.36, 0.05, 8, { yaw: Math.PI / 2 });
  dark.box('dark', OKADA_MATS.dark, 0.12, 0.1, 0.14, -0.12, 0.5, 0.0);
  dark.cyl('dark', OKADA_MATS.dark, 0.05, 0.05, 0.08, -0.14, 0.42, 0.12, 8, { yaw: Math.PI / 2 });
  for (let i = 0; i < 6; i++) {
    chrome.box('chrome', OKADA_MATS.chrome, 0.285, 0.005, 0.17, 0, 0.465 + i * 0.032, 0.2);
  }

  // --- Exhaust (right side) ---
  chrome.cyl('chrome', OKADA_MATS.chrome, 0.028, 0.032, 0.55, 0.14, 0.28, -0.15, 8, {
    pitch: Math.PI / 2,
    yaw: 0.05,
  });
  chrome.cyl('chrome', OKADA_MATS.chrome, 0.045, 0.04, 0.38, 0.15, 0.32, -0.55, 10, {
    pitch: Math.PI / 2,
  });
  chrome.cyl('chrome', OKADA_MATS.chrome, 0.05, 0.048, 0.08, 0.15, 0.34, -0.78, 10, {
    pitch: Math.PI / 2,
  });

  // --- Seat (long two-up) + grab rail ---
  // Contoured saddle: front hump + flat pillion
  rubber.box('rubber', OKADA_MATS.rubber, 0.26, 0.09, 0.42, 0, 0.82, -0.08);
  rubber.box('rubber', OKADA_MATS.rubber, 0.28, 0.08, 0.4, 0, 0.8, -0.48);
  rubber.box('rubber', OKADA_MATS.rubber, 0.24, 0.06, 0.12, 0, 0.86, -0.28);
  // Grab rail behind pillion
  chrome.box('chrome', OKADA_MATS.chrome, 0.3, 0.025, 0.03, 0, 0.9, -0.72);
  for (const side of [-1, 1]) {
    chrome.box('chrome', OKADA_MATS.chrome, 0.02, 0.08, 0.02, side * 0.14, 0.86, -0.7);
  }
  // Carrier plate under grab rail
  chrome.box('chrome', OKADA_MATS.chrome, 0.28, 0.02, 0.28, 0, 0.78, -0.78);

  // --- Mudguards ---
  const rearFender = new THREE.CylinderGeometry(0.34, 0.34, 0.12, 12, 1, false, 0, Math.PI * 0.7);
  dark.add('dark', OKADA_MATS.dark, rearFender, 0, 0.42, -0.64, { roll: Math.PI / 2, pitch: 0.15 });
  const frontFender = new THREE.CylinderGeometry(0.32, 0.32, 0.1, 12, 1, false, 0, Math.PI * 0.65);
  dark.add('dark', OKADA_MATS.dark, frontFender, 0, 0.48, 0.68, { roll: Math.PI / 2, pitch: -0.25 });

  // --- Forks (static lower tubes; steer group has bars) ---
  for (const side of [-1, 1]) {
    chrome.cyl('chrome', OKADA_MATS.chrome, 0.016, 0.018, 0.62, side * 0.065, 0.55, 0.62, 6, {
      pitch: -0.4,
    });
  }
  // Triple tree / yoke
  chrome.box('chrome', OKADA_MATS.chrome, 0.2, 0.04, 0.06, 0, 0.95, 0.52, { pitch: -0.35 });

  // --- Footrests + side stand ---
  for (const side of [-1, 1]) {
    // Rider pegs
    chrome.box('chrome', OKADA_MATS.chrome, 0.12, 0.02, 0.035, side * 0.18, 0.3, 0.05);
    // Pillion pegs
    chrome.box('chrome', OKADA_MATS.chrome, 0.1, 0.02, 0.03, side * 0.16, 0.36, -0.4);
  }
  // Side stand (left)
  chrome.cyl('chrome', OKADA_MATS.chrome, 0.01, 0.01, 0.32, -0.12, 0.2, 0.05, 5, {
    pitch: 0.55,
    roll: 0.35,
  });

  // --- Chain guard ---
  dark.box('dark', OKADA_MATS.dark, 0.04, 0.08, 0.42, 0.12, 0.36, -0.25);

  // --- Number plate (blank white face, no real registration marks) ---
  chrome.box('chrome', OKADA_MATS.chrome, 0.18, 0.1, 0.012, 0, 0.55, -0.95);
  // Slightly proud lighter face
  chrome.box('chrome', OKADA_MATS.chrome, 0.16, 0.08, 0.006, 0, 0.55, -0.958);

  // --- Headlamp housing + indicators + tail ---
  const tail = new GeoBag();
  dark.box('dark', OKADA_MATS.dark, 0.22, 0.18, 0.14, 0, 0.9, 0.58);
  lamp.cyl('lamp', OKADA_MATS.lamp, 0.065, 0.065, 0.03, 0, 0.92, 0.66, 12, { pitch: Math.PI / 2 });
  // Front indicators — white
  for (const side of [-1, 1]) {
    lamp.box('lamp', OKADA_MATS.lamp, 0.05, 0.035, 0.03, side * 0.14, 0.88, 0.6);
  }
  // Rear indicators / tail / brake — red
  for (const side of [-1, 1]) {
    tail.box('tail', OKADA_MATS.tail, 0.05, 0.035, 0.03, side * 0.1, 0.78, -0.92);
  }
  tail.box('tail', OKADA_MATS.tail, 0.1, 0.05, 0.03, 0, 0.8, -0.94);

  // Tank badge stripe (fictional, no logo) — thin white slash via chrome
  chrome.box('chrome', OKADA_MATS.chrome, 0.015, 0.04, 0.14, 0.17, 0.84, 0.22);
  chrome.box('chrome', OKADA_MATS.chrome, 0.015, 0.04, 0.14, -0.17, 0.84, 0.22);
  // Fuel cap
  chrome.cyl('chrome', OKADA_MATS.chrome, 0.035, 0.035, 0.02, 0, 1.02, 0.22, 10);

  okadaShell = [...paint.bake(), ...dark.bake(), ...rubber.bake(), ...chrome.bake()];
  okadaLamps = [...lamp.bake(), ...tail.bake()];
  okadaCourierGeo = new THREE.BoxGeometry(0.48, 0.42, 0.42);
}

export interface OkadaBodyOptions {
  /** When set, adds a QuickChop-style courier box in this colour (shared material per hex). */
  courierBox?: number;
  /** Override tank / panel paint colour for this instance only (clones the shared paint mat). */
  tankColor?: number;
}

/**
 * Adds the shared okada shell into `parent`.
 * Optional courier box for traffic / drivable bikes.
 */
export function addOkadaBody(parent: THREE.Object3D, opts: OkadaBodyOptions = {}): void {
  ensureOkadaPrototype();
  if (opts.tankColor !== undefined && opts.tankColor !== 0xb91c1c) {
    // Remesh paint parts with a tinted clone; other shared geos stay shared.
    const tint = OKADA_MATS.paint.clone();
    tint.color.setHex(opts.tankColor);
    for (const { geometry, material } of okadaShell!) {
      const mat = material === OKADA_MATS.paint ? tint : material;
      const mesh = new THREE.Mesh(geometry, mat);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      parent.add(mesh);
    }
  } else {
    attachBaked(parent, okadaShell!);
  }
  attachBaked(parent, okadaLamps!, false);

  if (opts.courierBox !== undefined) {
    const box = new THREE.Mesh(okadaCourierGeo!, courierBoxMaterial(opts.courierBox));
    box.position.set(0, 1.05, -0.78);
    box.castShadow = true;
    parent.add(box);
  }
}

/** Handlebars for the okada; grips at ±OKADA_LAYOUT.gripHalf. */
export function buildOkadaSteer(): THREE.Group {
  const steer = new THREE.Group();
  const L = OKADA_LAYOUT.steer;
  steer.position.set(L.x, L.y, L.z);
  steer.rotation.x = L.pitch;

  const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.7, 8), OKADA_MATS.chrome);
  bar.rotation.z = Math.PI / 2;
  steer.add(bar);

  for (const side of [-1, 1]) {
    const g = new THREE.Mesh(new THREE.CylinderGeometry(0.019, 0.019, 0.12, 8), OKADA_MATS.rubber);
    g.rotation.z = Math.PI / 2;
    g.position.x = side * OKADA_LAYOUT.gripHalf;
    const stalk = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.26, 5), OKADA_MATS.chrome);
    stalk.position.set(side * 0.24, 0.13, 0);
    const mirror = new THREE.Mesh(new THREE.CylinderGeometry(0.048, 0.048, 0.014, 10), OKADA_MATS.rubber);
    mirror.rotation.x = Math.PI / 2;
    mirror.position.set(side * 0.25, 0.27, 0);
    // Lever stubs
    const lever = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.012, 0.012), OKADA_MATS.chrome);
    lever.position.set(side * 0.2, -0.02, 0.02);
    steer.add(g, stalk, mirror, lever);
  }
  return steer;
}

/** Spoked motorcycle wheel — torus tyre so spokes stay visible. Shared geos/mats. */
const SPOKE_TYRE = new THREE.MeshStandardMaterial({ color: 0x151517, roughness: 0.9 });
const SPOKE_METAL = new THREE.MeshStandardMaterial({ color: 0xc8ccd2, metalness: 0.85, roughness: 0.28 });

let spokeWheelTyre: THREE.BufferGeometry | null = null;
let spokeWheelMetal: THREE.BufferGeometry | null = null;

function ensureSpokeWheel(radius: number, width: number, spokes = 12): void {
  if (spokeWheelTyre) return;
  const bag = new GeoBag();
  // Torus tyre (open centre) so the rim and spokes read from three-quarter views
  const tube = Math.max(0.035, width * 0.42);
  const tyre = new THREE.TorusGeometry(radius - tube, tube, 8, 20);
  tyre.rotateY(Math.PI / 2);
  bag.add('tyre', SPOKE_TYRE, tyre, 0, 0, 0);
  const rim = new THREE.CylinderGeometry(radius * 0.55, radius * 0.55, width * 0.35, 14);
  rim.rotateZ(Math.PI / 2);
  bag.add('metal', SPOKE_METAL, rim, 0, 0, 0);
  const hub = new THREE.CylinderGeometry(radius * 0.12, radius * 0.12, width * 0.55, 8);
  hub.rotateZ(Math.PI / 2);
  bag.add('metal', SPOKE_METAL, hub, 0, 0, 0);
  for (let i = 0; i < spokes; i++) {
    // Slightly thicker than the tyre so tips peek through the faces
    const spoke = new THREE.BoxGeometry(width * 0.7, radius * 0.78, 0.008);
    bag.add('metal', SPOKE_METAL, spoke, 0, 0, 0, { pitch: (i / spokes) * Math.PI });
  }
  const baked = bag.bake();
  for (const part of baked) {
    if (part.material === SPOKE_TYRE) spokeWheelTyre = part.geometry;
    else spokeWheelMetal = part.geometry;
  }
}

export function buildSpokedWheel(radius = 0.3, width = 0.1, spokes = 12): THREE.Group {
  ensureSpokeWheel(radius, width, spokes);
  const wheel = new THREE.Group();
  wheel.add(new THREE.Mesh(spokeWheelTyre!, SPOKE_TYRE));
  wheel.add(new THREE.Mesh(spokeWheelMetal!, SPOKE_METAL));
  return wheel;
}

/** Triangle / draw-call / unique-material stats for a rooted vehicle (honours visibility). */
export function vehicleMeshStats(root: THREE.Object3D): {
  triangles: number;
  drawCalls: number;
  materials: number;
} {
  let triangles = 0;
  let drawCalls = 0;
  const mats = new Set<THREE.Material>();
  root.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (!(mesh as THREE.Mesh & { isMesh?: boolean }).isMesh) return;
    let p: THREE.Object3D | null = obj;
    while (p) {
      if (!p.visible) return;
      p = p.parent;
    }
    drawCalls++;
    const g = mesh.geometry;
    if (g?.index) triangles += g.index.count / 3;
    else if (g?.attributes.position) triangles += g.attributes.position.count / 3;
    const m = mesh.material;
    if (Array.isArray(m)) m.forEach((x) => mats.add(x));
    else if (m) mats.add(m);
  });
  return { triangles: Math.round(triangles), drawCalls, materials: mats.size };
}
