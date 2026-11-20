import * as THREE from 'three';
import type { CarMaterials, CarSpec } from './CarBodyKit';

/**
 * Showcase detail for supercars (Aventador / Huracán / 911 / Chiron / Urus / sports_car).
 * Adds the pieces that make a procedural body read as a real car at a glance:
 * Y-LED lamps, honeycomb intakes, carbon splitter/diffuser, exhausts, side blades,
 * and reflective glass panels — without changing scene lighting.
 */

export const SUPER_BODY_IDS = new Set([
  'aventador',
  'huracan',
  'chiron',
  'urus',
  'porsche_911',
  'sports_car',
]);

export function isSupercarSpec(spec: CarSpec, bodyId?: string): boolean {
  if (bodyId && SUPER_BODY_IDS.has(bodyId)) return true;
  if (spec.style === 'sports') return true;
  return spec.brand === 'lamborghini' || spec.brand === 'bugatti' || spec.brand === 'porsche';
}

const CARBON = new THREE.MeshStandardMaterial({ color: 0x1a1a1c, metalness: 0.35, roughness: 0.55 });
const LENS = new THREE.MeshPhysicalMaterial({
  color: 0xe8f4ff,
  metalness: 0.05,
  roughness: 0.08,
  transparent: true,
  opacity: 0.55,
  envMapIntensity: 1.6,
});
const BRAKE_DISC = new THREE.MeshStandardMaterial({ color: 0x8a8a90, metalness: 0.9, roughness: 0.28 });
const CALIPER = new THREE.MeshStandardMaterial({ color: 0xb91c1c, metalness: 0.4, roughness: 0.45 });
const TIRE = new THREE.MeshStandardMaterial({ color: 0x0c0c0e, roughness: 0.92, metalness: 0.02 });
const SIDEWALL = new THREE.MeshStandardMaterial({ color: 0x1c1c1e, roughness: 0.85 });
const RIM = new THREE.MeshPhysicalMaterial({
  color: 0xd4d8de,
  metalness: 0.95,
  roughness: 0.18,
  clearcoat: 0.55,
  clearcoatRoughness: 0.2,
  envMapIntensity: 1.3,
});
const HUB = new THREE.MeshStandardMaterial({ color: 0x27272a, metalness: 0.7, roughness: 0.35 });

function box(
  mat: THREE.Material,
  w: number,
  h: number,
  d: number,
  x: number,
  y: number,
  z: number,
): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  m.castShadow = true;
  return m;
}

/** Multi-spoke Y-rim with tire bead, brake disc and red caliper — turns as one group about X. */
export function showcaseWheel(radius: number, width: number, spokes = 10): THREE.Group {
  const wheel = new THREE.Group();
  const tyre = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, width, 28), TIRE);
  tyre.rotation.z = Math.PI / 2;
  tyre.castShadow = true;
  // Sidewall bead rings
  for (const side of [-1, 1]) {
    const bead = new THREE.Mesh(
      new THREE.TorusGeometry(radius * 0.92, radius * 0.05, 8, 28),
      SIDEWALL,
    );
    bead.rotation.y = Math.PI / 2;
    bead.position.x = side * (width * 0.48);
    wheel.add(bead);
  }
  // Outer rim lip + barrel
  const lip = new THREE.Mesh(new THREE.CylinderGeometry(radius * 0.72, radius * 0.72, width + 0.04, 24), RIM);
  lip.rotation.z = Math.PI / 2;
  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(radius * 0.48, radius * 0.55, width * 0.7, 20), RIM);
  barrel.rotation.z = Math.PI / 2;
  // Brake disc + caliper (static relative to hub look)
  const disc = new THREE.Mesh(new THREE.CylinderGeometry(radius * 0.42, radius * 0.42, 0.03, 24), BRAKE_DISC);
  disc.rotation.z = Math.PI / 2;
  const caliper = box(CALIPER, width * 0.35, radius * 0.22, radius * 0.28, 0, radius * 0.28, 0);
  // Y-spokes
  for (let i = 0; i < spokes; i++) {
    const a = (i / spokes) * Math.PI * 2;
    const spoke = new THREE.Mesh(new THREE.BoxGeometry(width * 0.55, radius * 0.07, radius * 0.78), RIM);
    spoke.rotation.x = a;
    spoke.position.set(0, Math.sin(a) * radius * 0.02, Math.cos(a) * radius * 0.02);
    wheel.add(spoke);
  }
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(radius * 0.16, radius * 0.16, width + 0.06, 12), HUB);
  hub.rotation.z = Math.PI / 2;
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(radius * 0.1, radius * 0.1, width + 0.08, 10), RIM);
  cap.rotation.z = Math.PI / 2;
  wheel.add(tyre, lip, barrel, disc, caliper, hub, cap);
  return wheel;
}

/** Hexagonal-ish LED headlamp housings with clear lenses and Y-blade inserts. */
function addShowcaseLamps(car: THREE.Group, s: CarSpec, m: CarMaterials): void {
  const front = s.length / 2;
  const back = -s.length / 2;
  const halfW = s.width / 2;
  const lampY = s.noseTop - 0.12;

  for (const side of [-1, 1]) {
    const x = side * (halfW - 0.32);
    // Housing recess
    const housing = box(m.trim, 0.48, 0.16, 0.12, x, lampY, front - 0.02);
    housing.rotation.y = side * 0.22;
    car.add(housing);
    // Main LED strip
    const strip = box(m.lamp, 0.4, 0.045, 0.04, x, lampY + 0.02, front + 0.04);
    strip.rotation.y = side * 0.22;
    car.add(strip);
    // Y-blade secondary (Lamborghini-style)
    const blade = box(m.lamp, 0.18, 0.03, 0.035, x + side * 0.06, lampY - 0.04, front + 0.045);
    blade.rotation.y = side * 0.35;
    blade.rotation.z = side * 0.4;
    car.add(blade);
    // Clear lens cover
    const lens = box(LENS, 0.46, 0.14, 0.03, x, lampY, front + 0.07);
    lens.rotation.y = side * 0.22;
    car.add(lens);
  }

  // Tail: hexagon blades + outer chrome ring
  const tailY = s.tailTop - 0.1;
  if (s.tailBar) {
    car.add(box(m.tail, s.width - 0.28, 0.07, 0.05, 0, tailY, back + 0.03));
    car.add(box(m.chrome, s.width - 0.26, 0.02, 0.02, 0, tailY + 0.05, back + 0.05));
  } else {
    for (const side of [-1, 1]) {
      const x = side * (halfW - 0.28);
      car.add(box(m.trim, 0.42, 0.18, 0.08, x, tailY, back + 0.02));
      car.add(box(m.tail, 0.36, 0.06, 0.04, x, tailY + 0.03, back + 0.055));
      car.add(box(m.tail, 0.2, 0.05, 0.035, x + side * 0.05, tailY - 0.04, back + 0.055));
      car.add(box(m.chrome, 0.4, 0.02, 0.02, x, tailY + 0.08, back + 0.06));
    }
  }
}

function addHoneycombGrille(car: THREE.Group, s: CarSpec, m: CarMaterials): void {
  const front = s.length / 2;
  const y = s.clearance + 0.22;
  const w = s.width * 0.72;
  const h = 0.22;
  car.add(box(m.trim, w, h, 0.06, 0, y, front + 0.01));
  const cols = 9;
  const rows = 3;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const cx = -w / 2 + ((c + 0.5) * w) / cols;
      const cy = y - h / 2 + ((r + 0.5) * h) / rows;
      car.add(box(m.chrome, w / cols - 0.02, h / rows - 0.02, 0.02, cx, cy, front + 0.04));
    }
  }
}

function addSplitterDiffuserExhaust(car: THREE.Group, s: CarSpec, m: CarMaterials): void {
  const front = s.length / 2;
  const back = -s.length / 2;
  // Carbon front splitter
  car.add(box(CARBON, s.width * 0.92, 0.03, 0.28, 0, s.clearance + 0.02, front + 0.06));
  for (const side of [-1, 1]) {
    car.add(box(CARBON, 0.04, 0.08, 0.22, side * (s.width / 2 - 0.08), s.clearance + 0.06, front + 0.02));
  }
  // Rear diffuser fins
  car.add(box(CARBON, s.width * 0.85, 0.04, 0.32, 0, s.clearance + 0.04, back + 0.08));
  for (let i = -3; i <= 3; i++) {
    car.add(box(CARBON, 0.025, 0.1, 0.26, i * 0.12, s.clearance + 0.08, back + 0.1));
  }
  // Dual / quad exhausts
  const exhaustMat = m.chrome;
  const n = s.brand === 'bugatti' || s.brand === 'lamborghini' ? 4 : 2;
  for (let i = 0; i < n; i++) {
    const x = n === 4 ? -0.28 + i * 0.18 : (i === 0 ? -0.22 : 0.22);
    const tip = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.05, 0.1, 14), exhaustMat);
    tip.rotation.x = Math.PI / 2;
    tip.position.set(x, s.clearance + 0.16, back - 0.02);
    car.add(tip);
    car.add(box(m.trim, 0.07, 0.07, 0.04, x, s.clearance + 0.16, back + 0.04));
  }
}

function addSideBlades(car: THREE.Group, s: CarSpec, m: CarMaterials): void {
  const halfW = s.width / 2;
  for (const side of [-1, 1]) {
    // Side air scoop
    const scoop = box(m.trim, 0.08, 0.18, 0.55, side * (halfW + 0.02), (s.clearance + s.belt) / 2 + 0.05, -0.15);
    scoop.rotation.y = side * 0.08;
    car.add(scoop);
    car.add(box(CARBON, 0.04, 0.12, 0.4, side * (halfW + 0.05), (s.clearance + s.belt) / 2 + 0.05, -0.1));
    // Character line
    car.add(box(m.chrome, 0.012, 0.015, s.length * 0.45, side * (halfW + 0.015), s.belt - 0.08, 0.15));
    // Door handle
    car.add(box(m.chrome, 0.03, 0.025, 0.12, side * (halfW + 0.02), s.belt - 0.14, 0.35));
  }
}

function addGlassPanels(car: THREE.Group, s: CarSpec, m: CarMaterials): void {
  // Thin windshield plane that catches env reflections better than a solid extrude
  const screenH = Math.max(0.25, s.roof - s.belt - 0.08);
  const screenL = Math.hypot(s.screenTop - s.screenFoot, screenH);
  const screen = new THREE.Mesh(
    new THREE.PlaneGeometry(s.width * 0.72, screenL * 0.92),
    m.glass,
  );
  const midZ = (s.screenFoot + s.screenTop) / 2;
  const midY = (s.belt + s.roof - 0.05) / 2;
  screen.position.set(0, midY, midZ + 0.02);
  screen.rotation.x = -Math.atan2(s.screenFoot - s.screenTop, screenH);
  car.add(screen);

  // Side windows
  for (const side of [-1, 1]) {
    const win = new THREE.Mesh(new THREE.PlaneGeometry(s.length * 0.28, screenH * 0.7), m.glass);
    win.position.set(side * (s.width / 2 - 0.02), s.belt + screenH * 0.35, 0.1);
    win.rotation.y = side * (Math.PI / 2);
    car.add(win);
  }
}

function addBrandExtras(car: THREE.Group, s: CarSpec, m: CarMaterials): void {
  const front = s.length / 2;
  if (s.brand === 'lamborghini') {
    // Hexagon badge plate
    car.add(box(m.gold, 0.1, 0.08, 0.025, 0, s.noseTop + 0.01, front - 0.08));
    car.add(box(m.trim, 0.07, 0.05, 0.03, 0, s.noseTop + 0.01, front - 0.07));
    // Hexagon fuel door
    car.add(box(m.paint, 0.12, 0.1, 0.02, s.width / 2 + 0.01, s.belt - 0.2, -0.6));
  } else if (s.brand === 'porsche') {
    car.add(box(m.chrome, 0.16, 0.04, 0.02, 0, s.belt + 0.02, -s.length / 2 + 0.08));
  } else if (s.brand === 'bugatti') {
    car.add(box(m.red, 0.14, 0.05, 0.02, 0, s.noseTop + 0.02, front - 0.1));
    car.add(box(m.chrome, 0.1, 0.02, 0.025, 0, s.noseTop + 0.02, front - 0.095));
  }
  // Aggressive rear wing endplates for winged cars
  if (s.wing) {
    const back = -s.length / 2;
    for (const side of [-1, 1]) {
      car.add(box(m.trim, 0.03, 0.22, 0.28, side * (s.width / 2 - 0.12), s.tailTop + 0.22, back + 0.28));
    }
    car.add(box(CARBON, s.width - 0.28, 0.025, 0.3, 0, s.tailTop + 0.32, back + 0.28));
  }
}

/**
 * Layer showcase detail onto an already-built body group.
 * Safe to call for sports / supercar specs only.
 */
export function decorateSupercar(car: THREE.Group, spec: CarSpec, materials: CarMaterials): void {
  addShowcaseLamps(car, spec, materials);
  addHoneycombGrille(car, spec, materials);
  addSplitterDiffuserExhaust(car, spec, materials);
  addSideBlades(car, spec, materials);
  addGlassPanels(car, spec, materials);
  addBrandExtras(car, spec, materials);
}

/** Stronger paint response for showcase cars (still MeshPhysical clearcoat). */
export function tuneSupercarPaint(materials: CarMaterials, paint: number): void {
  materials.paint.color.setHex(paint);
  materials.paint.metalness = 0.72;
  materials.paint.roughness = 0.14;
  materials.paint.clearcoat = 1.0;
  materials.paint.clearcoatRoughness = 0.06;
  materials.paint.envMapIntensity = 1.75;
  materials.glass.metalness = 0.9;
  materials.glass.roughness = 0.03;
  materials.glass.opacity = 0.55;
  materials.glass.envMapIntensity = 1.8;
}
