import * as THREE from 'three';
import { mergeVertices, toCreasedNormals } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/**
 * Car bodies that read as cars: each is drawn as a side profile (bumpers, bonnet, glass, roof,
 * boot and wheel arches), pushed out across the car's width with rounded edges, narrowed toward
 * the roof and rounded at the corners in plan, with glass, pillars, lights, a grille and
 * mirrors on it. One recipe makes a saloon, an SUV, a box-shaped off-roader or a low sports car.
 * Wheels are added by whoever owns the car (they turn and steer).
 *
 * Distances are metres. The car faces +z, stands on y = 0, centred on x = 0 and z = 0.
 */

export type BodyStyle = 'sedan' | 'suv' | 'boxy' | 'sports' | 'fastback';

export interface CarSpec {
  style: BodyStyle;
  length: number;
  width: number;
  /** Height of the bottom of the body above the ground */
  clearance: number;
  /** Where the glass starts (top of the doors) */
  belt: number;
  /** Top of the roof */
  roof: number;
  /** Top of the bonnet at its front edge, and of the boot at its back edge */
  noseTop: number;
  tailTop: number;
  /** Along the car, from its middle: foot of the windscreen, top of the windscreen, top of the back glass, foot of the back glass */
  screenFoot: number;
  screenTop: number;
  backTop: number;
  backFoot: number;
  /** Wheel centres along the car, and their size */
  frontAxle: number;
  rearAxle: number;
  wheelRadius: number;
  /** How much narrower the roof is than the body (0 to 0.3) */
  tumblehome: number;
  /** How round the corners are seen from above (0 square to 1 very round) */
  roundness: number;
  paint: number;
  /** Pillars and roof in black, as a "floating roof" */
  blackRoof?: boolean;
  grille: 'chrome' | 'black' | 'mesh' | 'closed';
  lamps: 'slim' | 'round' | 'square';
  /** A full-width light bar at the back */
  tailBar?: boolean;
  /** A wing on the boot lid */
  wing?: boolean;
  /** A spare wheel on the tailgate */
  spare?: boolean;
  /** Bulging wheel arches */
  flares?: boolean;
}

const BEVEL = 0.07;

/** Turns a profile drawn as (along the car, height) into a solid of the car's width, narrowed and rounded */
function extrudeProfile(shape: THREE.Shape, width: number, spec: CarSpec, curve = 10, narrowFrom = spec.belt): THREE.BufferGeometry {
  const depth = Math.max(0.1, width - 2 * BEVEL);
  const geometry = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: true, bevelThickness: BEVEL, bevelSize: BEVEL * 0.8, bevelSegments: 3, curveSegments: curve });
  const position = geometry.attributes.position as THREE.BufferAttribute;
  const halfL = spec.length / 2;
  const r = Math.max(0.2, spec.length * 0.16 * (0.4 + spec.roundness));
  for (let i = 0; i < position.count; i++) {
    const along = position.getX(i);
    const up = position.getY(i);
    let across = position.getZ(i) - depth / 2;
    // Narrower toward the roof
    if (up > narrowFrom) across *= 1 - spec.tumblehome * Math.min(1, (up - narrowFrom) / Math.max(0.2, spec.roof - narrowFrom));
    // Rounded doors: a little fuller at the waist than at the sill
    const waist = (spec.clearance + spec.belt) / 2;
    const span = Math.max(0.2, (spec.belt - spec.clearance) / 2);
    if (up <= spec.belt) across *= 1 - 0.035 * Math.min(1, ((up - waist) / span) ** 2);
    // Round corners seen from above
    const end = Math.abs(along) - (halfL - r);
    if (end > 0) across *= 1 - 0.1 * spec.roundness * Math.min(1, end / r) ** 2;
    position.setXYZ(i, across, up, along);
  }
  geometry.deleteAttribute('normal');
  geometry.deleteAttribute('uv');
  const merged = mergeVertices(geometry, 1e-4);
  geometry.dispose();
  return toCreasedNormals(merged, Math.PI / 4.5);
}

/** The lower body: bumpers, bonnet, doors, boot, with the wheel arches cut out */
function lowerProfile(s: CarSpec): THREE.Shape {
  const front = s.length / 2;
  const back = -s.length / 2;
  const g = s.clearance;
  const arch = s.wheelRadius + 0.07;
  const wy = s.wheelRadius;
  const nose = s.style === 'boxy' ? 0.08 : s.style === 'sports' ? 0.32 : 0.22;
  const tail = s.style === 'boxy' ? 0.08 : 0.18;
  const shape = new THREE.Shape();
  shape.moveTo(back + 0.12, g);
  // Along the sill to the back arch, over it, on to the front arch, over it
  for (const axle of [s.rearAxle, s.frontAxle]) {
    shape.lineTo(axle - arch, g);
    shape.lineTo(axle - arch, wy);
    shape.absarc(axle, wy, arch, Math.PI, 0, true);
    shape.lineTo(axle + arch, g);
  }
  // Up the front: bumper, then the bonnet's leading edge
  shape.lineTo(front - 0.12, g);
  shape.quadraticCurveTo(front, g, front, g + 0.14);
  shape.lineTo(front, s.noseTop - nose * 0.6);
  shape.quadraticCurveTo(front, s.noseTop, front - nose, s.noseTop);
  // The bonnet rises a little to the foot of the windscreen
  shape.lineTo(s.screenFoot, s.belt);
  // Along the waist to the foot of the back glass, then the boot
  shape.lineTo(s.backFoot, s.belt);
  shape.lineTo(back + tail, s.tailTop);
  shape.quadraticCurveTo(back, s.tailTop, back, s.tailTop - tail * 0.7);
  shape.lineTo(back, g + 0.14);
  shape.quadraticCurveTo(back, g, back + 0.12, g);
  return shape;
}

/** The glasshouse: windscreen, side windows and back glass */
function glassProfile(s: CarSpec, inset = 0): THREE.Shape {
  const round = s.style === 'boxy' ? 0.06 : 0.22;
  const top = s.roof - 0.05 - inset;
  const shape = new THREE.Shape();
  shape.moveTo(s.backFoot - inset, s.belt - 0.02);
  shape.lineTo(s.screenFoot + inset, s.belt - 0.02);
  // Up the windscreen, round on to the roof
  const ux = s.screenTop - s.screenFoot;
  const uy = top - s.belt;
  const k = round / Math.hypot(ux, uy);
  shape.lineTo(s.screenTop - ux * k + inset, top - uy * k);
  shape.quadraticCurveTo(s.screenTop + inset * 0.5, top, s.screenTop - round, top);
  shape.lineTo(s.backTop + round, top);
  const bx = s.backTop - s.backFoot;
  const by = top - s.belt;
  const kb = round / Math.hypot(bx, by);
  shape.quadraticCurveTo(s.backTop - inset * 0.5, top, s.backTop - bx * kb - inset, top - by * kb);
  shape.lineTo(s.backFoot - inset, s.belt - 0.02);
  return shape;
}

/** The roof panel over the glass */
function roofProfile(s: CarSpec): THREE.Shape {
  const t = 0.07;
  const shape = new THREE.Shape();
  const ux = s.screenTop - s.screenFoot;
  const bx = s.backTop - s.backFoot;
  const rise = s.roof - s.belt;
  // Where the windscreen and the back glass are `t` below the roof
  const front = s.screenTop - (ux * t) / rise;
  const back = s.backTop - (bx * t) / rise;
  shape.moveTo(back, s.roof - t);
  shape.lineTo(front, s.roof - t);
  shape.quadraticCurveTo(s.screenTop, s.roof, s.screenTop - 0.18, s.roof);
  shape.lineTo(s.backTop + 0.18, s.roof);
  shape.quadraticCurveTo(s.backTop, s.roof, back, s.roof - t);
  return shape;
}

function box(material: THREE.Material, w: number, h: number, d: number, x: number, y: number, z: number, rx = 0): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
  mesh.position.set(x, y, z);
  mesh.rotation.x = rx;
  return mesh;
}

/** Half the width of the glasshouse at a height, as the tumblehome narrows it */
function glassHalfWidth(s: CarSpec, y: number): number {
  const half = s.width / 2 - 0.04;
  const t = Math.min(1, Math.max(0, (y - s.belt) / Math.max(0.2, s.roof - s.belt)));
  return half * (1 - s.tumblehome * t);
}

export interface CarMaterials {
  paint: THREE.MeshStandardMaterial;
  glass: THREE.MeshStandardMaterial;
  trim: THREE.MeshStandardMaterial;
  chrome: THREE.MeshStandardMaterial;
  lamp: THREE.MeshStandardMaterial;
  tail: THREE.MeshStandardMaterial;
  plate: THREE.MeshStandardMaterial;
}

export function carMaterials(paint: number): CarMaterials {
  return {
    paint: new THREE.MeshStandardMaterial({ color: paint, metalness: 0.55, roughness: 0.28 }),
    glass: new THREE.MeshStandardMaterial({ color: 0x1b2a3c, metalness: 0.7, roughness: 0.08 }),
    trim: new THREE.MeshStandardMaterial({ color: 0x0f1115, metalness: 0.2, roughness: 0.65 }),
    chrome: new THREE.MeshStandardMaterial({ color: 0xe5e7eb, metalness: 1, roughness: 0.12 }),
    lamp: new THREE.MeshStandardMaterial({ color: 0xf8fafc, emissive: 0xf1f5f9, emissiveIntensity: 1.3, roughness: 0.2 }),
    tail: new THREE.MeshStandardMaterial({ color: 0xdc2626, emissive: 0xb91c1c, emissiveIntensity: 1.1, roughness: 0.3 }),
    plate: new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.5 }),
  };
}

/** A car body to these measurements. Wheels are not included. */
export function buildCarBody(spec: CarSpec, m: CarMaterials = carMaterials(spec.paint)): THREE.Group {
  const car = new THREE.Group();
  car.name = 'car body';
  const s = spec;
  const lower = new THREE.Mesh(extrudeProfile(lowerProfile(s), s.width, s, 12), m.paint);
  lower.castShadow = true;
  car.add(lower);
  // The glass sits just inside the body line; the roof sits on it
  const glass = new THREE.Mesh(extrudeProfile(glassProfile(s), s.width - 0.1, s, 8, s.belt - 0.05), m.glass);
  car.add(glass);
  const roof = new THREE.Mesh(extrudeProfile(roofProfile(s), s.width - 0.06, s, 8, s.belt - 0.05), s.blackRoof ? m.trim : m.paint);
  roof.castShadow = true;
  car.add(roof);

  // Pillars: the windscreen's, one between the doors, and the back
  const pillarMat = s.blackRoof ? m.trim : m.paint;
  const pillar = (fromZ: number, fromY: number, toZ: number, toY: number, thick: number) => {
    for (const side of [-1, 1]) {
      const midY = (fromY + toY) / 2;
      const len = Math.hypot(toZ - fromZ, toY - fromY);
      const p = box(pillarMat, 0.05, len, thick, side * (glassHalfWidth(s, midY) + 0.012), midY, (fromZ + toZ) / 2);
      p.rotation.x = Math.atan2(toZ - fromZ, toY - fromY);
      car.add(p);
    }
  };
  pillar(s.screenFoot, s.belt, s.screenTop, s.roof - 0.05, 0.08);
  pillar(s.backFoot, s.belt, s.backTop, s.roof - 0.05, s.style === 'suv' || s.style === 'boxy' ? 0.16 : 0.12);
  const bZ = s.screenTop + (s.backTop - s.screenTop) * (s.style === 'sports' ? 0.95 : 0.45);
  pillar(bZ, s.belt, bZ, s.roof - 0.05, 0.1);

  const front = s.length / 2;
  const back = -s.length / 2;
  const halfW = s.width / 2;

  // Lamps
  const lampY = s.noseTop - (s.style === 'boxy' ? 0.24 : 0.14);
  for (const side of [-1, 1]) {
    if (s.lamps === 'round') {
      const ring = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.06, 24), m.chrome);
      ring.rotation.x = Math.PI / 2;
      ring.position.set(side * (halfW - 0.3), lampY, front + 0.03);
      const lens = new THREE.Mesh(new THREE.CircleGeometry(0.105, 24), m.lamp);
      lens.position.set(side * (halfW - 0.3), lampY, front + 0.065);
      car.add(ring, lens);
    } else {
      const w = s.lamps === 'slim' ? 0.42 : 0.34;
      const h = s.lamps === 'slim' ? 0.075 : 0.14;
      const lamp = box(m.lamp, w, h, 0.05, side * (halfW - 0.28 - (s.roundness * 0.08)), lampY, front - 0.05 - s.roundness * 0.12);
      lamp.rotation.y = side * 0.25 * s.roundness;
      car.add(lamp);
    }
  }
  // Grille
  const grilleW = s.grille === 'closed' ? 0.7 : s.style === 'boxy' ? 0.9 : 0.78;
  if (s.grille !== 'closed') {
    const grille = box(s.grille === 'chrome' ? m.chrome : m.trim, grilleW, s.style === 'boxy' ? 0.3 : 0.18, 0.05, 0, lampY - (s.style === 'boxy' ? 0.02 : 0.06), front + (s.style === 'boxy' ? 0.03 : -0.04));
    car.add(grille);
    if (s.grille === 'chrome' || s.grille === 'mesh') {
      for (let i = 0; i < (s.style === 'boxy' ? 3 : 4); i++) car.add(box(m.trim, grilleW - 0.06, 0.018, 0.02, 0, lampY - 0.12 + i * 0.05, front - 0.01 + (s.style === 'boxy' ? 0.05 : 0)));
    }
  }
  // Lower intake and number plates
  car.add(box(m.trim, s.width * 0.55, 0.1, 0.05, 0, s.clearance + 0.12, front - 0.02));
  car.add(box(m.plate, 0.44, 0.11, 0.02, 0, s.clearance + 0.26, front + 0.015));
  car.add(box(m.plate, 0.44, 0.11, 0.02, 0, s.clearance + 0.3, back - 0.015));
  // Tail lamps
  const tailY = s.tailTop - 0.13;
  if (s.tailBar) {
    car.add(box(m.tail, s.width - 0.3, 0.06, 0.04, 0, tailY, back + 0.02));
  } else {
    for (const side of [-1, 1]) car.add(box(m.tail, s.lamps === 'round' ? 0.16 : 0.34, s.lamps === 'round' ? 0.3 : 0.1, 0.04, side * (halfW - 0.25), tailY - (s.lamps === 'round' ? 0.1 : 0), back + 0.02 + s.roundness * 0.05));
  }
  // Mirrors, at the foot of the windscreen
  for (const side of [-1, 1]) {
    const arm = box(pillarMat, 0.16, 0.05, 0.06, side * (halfW + 0.04), s.belt + 0.04, s.screenFoot - 0.12);
    const cap = box(m.paint, 0.1, 0.11, 0.16, side * (halfW + 0.13), s.belt + 0.07, s.screenFoot - 0.14);
    car.add(arm, cap);
  }
  // Door seams and handles
  for (const side of [-1, 1]) {
    const x = side * (halfW + 0.01);
    car.add(box(m.trim, 0.012, s.belt - s.clearance - 0.12, 0.012, x, (s.belt + s.clearance) / 2, bZ));
    for (const z of [bZ + 0.55, bZ - 0.35]) car.add(box(m.chrome, 0.02, 0.03, 0.16, side * (halfW + 0.02), s.belt - 0.12, z));
  }
  // Black sills and, on off-roaders, arches that stand out
  for (const side of [-1, 1]) car.add(box(m.trim, 0.03, 0.08, (s.frontAxle - s.rearAxle) - 2 * (s.wheelRadius + 0.07), side * (halfW - 0.005), s.clearance + 0.05, (s.frontAxle + s.rearAxle) / 2));
  if (s.flares) {
    for (const axle of [s.frontAxle, s.rearAxle]) {
      for (const side of [-1, 1]) {
        const flare = new THREE.Mesh(new THREE.TorusGeometry(s.wheelRadius + 0.1, 0.05, 6, 16, Math.PI), m.trim);
        flare.rotation.y = Math.PI / 2;
        flare.position.set(side * (halfW + 0.02), s.wheelRadius, axle);
        car.add(flare);
      }
    }
  }
  if (s.wing) {
    const wing = box(m.trim, s.width - 0.2, 0.04, 0.32, 0, s.tailTop + 0.28, back + 0.28);
    car.add(wing);
    for (const side of [-1, 1]) car.add(box(m.trim, 0.04, 0.26, 0.12, side * 0.5, s.tailTop + 0.14, back + 0.3));
  }
  if (s.spare) {
    const spare = new THREE.Mesh(new THREE.CylinderGeometry(s.wheelRadius * 0.95, s.wheelRadius * 0.95, 0.26, 24), m.trim);
    spare.rotation.x = Math.PI / 2;
    spare.position.set(0, (s.clearance + s.belt) / 2 + 0.15, back - 0.15);
    const cover = new THREE.Mesh(new THREE.CircleGeometry(s.wheelRadius * 0.7, 24), m.paint);
    cover.position.set(0, spare.position.y, back - 0.285);
    cover.rotation.y = Math.PI;
    car.add(spare, cover);
  }
  return car;
}

/** The shapes of the cars the game sells, by vehicle type */
export const CAR_SPECS: Record<string, Omit<CarSpec, 'paint'> & { paint?: number }> = {
  sedan: {
    style: 'sedan', length: 4.6, width: 1.8, clearance: 0.2, belt: 0.98, roof: 1.46, noseTop: 0.8, tailTop: 0.98,
    screenFoot: 0.95, screenTop: 0.2, backTop: -0.95, backFoot: -1.5, frontAxle: 1.35, rearAxle: -1.33, wheelRadius: 0.32,
    tumblehome: 0.16, roundness: 0.7, grille: 'chrome', lamps: 'slim', paint: 0x9ca3af,
  },
  luxury_sedan: {
    style: 'sedan', length: 5.3, width: 1.95, clearance: 0.2, belt: 1.02, roof: 1.5, noseTop: 0.88, tailTop: 1.02,
    screenFoot: 1.12, screenTop: 0.3, backTop: -1.15, backFoot: -1.72, frontAxle: 1.6, rearAxle: -1.55, wheelRadius: 0.36,
    tumblehome: 0.15, roundness: 0.6, grille: 'chrome', lamps: 'slim', tailBar: true, paint: 0x23272e,
  },
  electric_car: {
    style: 'fastback', length: 4.95, width: 1.95, clearance: 0.16, belt: 0.92, roof: 1.42, noseTop: 0.72, tailTop: 0.95,
    screenFoot: 1.0, screenTop: 0.1, backTop: -0.7, backFoot: -1.85, frontAxle: 1.48, rearAxle: -1.47, wheelRadius: 0.35,
    tumblehome: 0.18, roundness: 0.95, grille: 'closed', lamps: 'slim', tailBar: true, paint: 0xe5e7eb,
  },
  sports_car: {
    style: 'sports', length: 4.55, width: 1.9, clearance: 0.12, belt: 0.82, roof: 1.27, noseTop: 0.62, tailTop: 0.9,
    screenFoot: 0.75, screenTop: -0.1, backTop: -0.6, backFoot: -1.75, frontAxle: 1.3, rearAxle: -1.2, wheelRadius: 0.34,
    tumblehome: 0.22, roundness: 1, grille: 'mesh', lamps: 'round', wing: true, paint: 0xb91c1c,
  },
  suv: {
    style: 'suv', length: 4.85, width: 1.9, clearance: 0.3, belt: 1.18, roof: 1.86, noseTop: 1.06, tailTop: 1.22,
    screenFoot: 1.05, screenTop: 0.45, backTop: -2.15, backFoot: -2.3, frontAxle: 1.45, rearAxle: -1.35, wheelRadius: 0.39,
    tumblehome: 0.1, roundness: 0.45, grille: 'chrome', lamps: 'square', spare: true, flares: true, paint: 0x2b3340,
  },
  gwagon: {
    style: 'boxy', length: 4.7, width: 1.95, clearance: 0.32, belt: 1.25, roof: 1.98, noseTop: 1.12, tailTop: 1.3,
    screenFoot: 1.0, screenTop: 0.78, backTop: -2.25, backFoot: -2.3, frontAxle: 1.45, rearAxle: -1.4, wheelRadius: 0.4,
    tumblehome: 0.04, roundness: 0.12, grille: 'black', lamps: 'round', spare: true, flares: true, paint: 0x2a2b2f,
  },
};
