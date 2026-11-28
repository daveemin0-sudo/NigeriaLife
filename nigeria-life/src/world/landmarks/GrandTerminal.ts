import * as THREE from 'three';
import type { Builder } from '../kit/ArchKit';
import { signBoard } from '../kit/ArchKit';
import { buildKitCar } from '../vehicles/KitCar';
import { bakeToGeometry } from '../../graphics/MeshBaker';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/**
 * The terminal as it is seen from the city: one building, the way in to everything (check-in,
 * security, the gates, arrivals), so there is never a second door that leads somewhere else.
 *
 * A long glass hall under one great white vaulted roof that sweeps out over the kerb on slim
 * branching columns, its underside warm timber; the airport's name along the front; doors for
 * Departures and Arrivals; flags, palms and planters along the kerb; a set-down lane with taxis
 * and cars dropping off; a car park of real cars. All in the airport's drawn coordinates.
 */

/** The terminal's front (the glass), its back, its ends and its middle, as drawn */
export const TERMINAL = { front: -103, back: -115.2, west: -114, east: -66, mid: -90, height: 12 };
/** The roof: an arc across the building, from over the kerb to over the apron */
const ROOF = { front: -96.2, back: -117.6, peak: 17.2, edge: 13.6, west: -116.5, east: -63.5 };

const GLASS = 0x2c5878;
const LIT = 0xd4ecfa;
const WHITE = 0xf8fafc;
const GREEN = 0x0b7a43;
const STONE = 0xd6d3d1;
const PALM = 0x166534;
const TRUNK = 0x8b6b4a;

/** The heights of the roof's arc at a point across it (z as drawn) */
function roofCircle() {
  const chord = ROOF.front - ROOF.back;
  const sag = ROOF.peak - ROOF.edge;
  const radius = (chord * chord) / 4 / (2 * sag) + sag / 2;
  const middle = (ROOF.front + ROOF.back) / 2;
  const centreY = ROOF.peak - radius;
  return { radius, middle, centreY, half: Math.asin(chord / 2 / radius) };
}
export function roofUnderside(z: number): number {
  const c = roofCircle();
  const d = z - c.middle;
  return c.centreY + Math.sqrt(Math.max(0, c.radius * c.radius - d * d)) - 0.45;
}

/** A palm: a leaning ringed trunk and a crown of drooping fronds */
export function palm(b: Builder, x: number, z: number, height = 7, turn = 0): void {
  b.cylinder(TRUNK, 0.2, height, x, 0, z, { topRadius: 0.15, sides: 8, solid: true });
  for (let r = 1; r < height; r += 0.9) b.cylinder(0x6b5236, 0.215, 0.12, x, r, z, { sides: 8, solid: false });
  for (let i = 0; i < 7; i++) {
    const yaw = turn + (i / 7) * Math.PI * 2;
    b.box(PALM, 0.55, 0.05, 2.9, x + Math.sin(yaw) * 1.25, height - 0.15, z + Math.cos(yaw) * 1.25, { yaw, pitch: 0.42, solid: false });
    b.box(0x15803d, 0.35, 0.05, 1.6, x + Math.sin(yaw) * 2.55, height - 0.95, z + Math.cos(yaw) * 2.55, { yaw, pitch: 0.95, solid: false });
  }
  b.dome(0x4d7c0f, 0.4, x, height - 0.2, z, { solid: false });
}

/** A flagpole with Nigeria's green-white-green */
function flag(b: Builder, x: number, z: number): void {
  b.cylinder(0xe5e7eb, 0.07, 9, x, 0, z, { solid: true });
  b.box(GREEN, 0.55, 1.1, 0.04, x + 0.33, 7.7, z, { solid: false }).box(WHITE, 0.55, 1.1, 0.04, x + 0.88, 7.7, z, { solid: false }).box(GREEN, 0.55, 1.1, 0.04, x + 1.43, 7.7, z, { solid: false });
}

/** The parts of the terminal and its forecourt that are made of the city's ordinary pieces */
export function buildGrandTerminal(b: Builder, rows: 1 | 2): void {
  const T = TERMINAL;
  const width = T.east - T.west;
  const depth = T.front - T.back;
  // The hall itself (what nobody walks through), its ends in pale stone
  b.box(0xeef2f6, width, T.height, depth, T.mid, 0, (T.front + T.back) / 2, { solid: true });
  b.box(STONE, 0.6, T.height, depth + 0.4, T.west - 0.2, 0, (T.front + T.back) / 2);
  b.box(STONE, 0.6, T.height, depth + 0.4, T.east + 0.2, 0, (T.front + T.back) / 2);

  // The glass front, lit from within: a curtain wall of tall panes between slim white mullions
  b.box(GLASS, width - 1, T.height - 0.6, 0.12, T.mid, 0.2, T.front + 0.08, { solid: false });
  b.windows(LIT, 20, 2, width - 2, 0.4, T.height - 1.2, T.mid, T.front + 0.16, 0, { glow: true });
  for (let x = T.west + 0.6; x <= T.east - 0.6; x += 2.4) b.box(WHITE, 0.16, T.height - 0.3, 0.32, x, 0.1, T.front + 0.2, { solid: false });
  for (const y of [4.2, 8.2]) b.box(WHITE, width - 1, 0.18, 0.3, T.mid, y, T.front + 0.22, { solid: false });
  // The back, onto the apron, the same
  b.box(GLASS, width - 1, T.height - 0.6, 0.12, T.mid, 0.2, T.back - 0.08, { solid: false });
  b.windows(LIT, 20, 2, width - 2, 0.4, T.height - 1.2, T.mid, T.back - 0.16, Math.PI, { glow: true });
  for (let x = T.west + 0.6; x <= T.east - 0.6; x += 2.4) b.box(WHITE, 0.16, T.height - 0.3, 0.3, x, 0.1, T.back - 0.2, { solid: false });

  // The east end, seen from the road: glass as well, between its stone piers
  const midZ = (T.front + T.back) / 2;
  b.box(GLASS, 0.1, T.height - 3.4, depth - 1.6, T.east + 0.56, 0.2, midZ, { solid: false });
  b.windows(LIT, 5, 2, depth - 2.4, 0.5, T.height - 4.4, T.east + 0.63, midZ, Math.PI / 2, { glow: true });

  // A fascia above the glass, for the name
  b.box(0x0f172a, width + 0.6, 1.9, 0.5, T.mid, T.height - 0.2, T.front + 0.3, { solid: false });
  b.box(GREEN, width + 0.6, 0.18, 0.55, T.mid, T.height - 0.32, T.front + 0.32, { solid: false });

  // The doors: Arrivals (west) and Departures (east), each a bay of sliding glass in a green frame
  for (const x of [-100, -80]) {
    b.box(GREEN, 6.2, 0.5, 0.6, x, 3.6, T.front + 0.35, { solid: false });
    b.box(GREEN, 0.4, 3.6, 0.6, x - 2.9, 0, T.front + 0.35, { solid: false }).box(GREEN, 0.4, 3.6, 0.6, x + 2.9, 0, T.front + 0.35, { solid: false });
    for (const side of [-1, 1]) b.box(0x93c5fd, 2.5, 3.3, 0.08, x + side * 1.35, 0, T.front + 0.42, { solid: false, glow: true });
    // A mat before each door
    b.ground(0x27272a, 6, 2.2, x, 0.028, T.front + 1.4);
  }

  // The kerb: a broad pale pavement under the roof, bollards along its edge
  b.ground(0xe7e5e4, width + 4, 5.2, T.mid, 0.024, T.front + 2.6);
  for (let x = T.west; x <= T.east; x += 2.2) if (Math.abs(x + 80) > 3.5 && Math.abs(x + 100) > 3.5) b.cylinder(0x9ca3af, 0.11, 0.9, x, 0, T.front + 5.0, { solid: true });
  // Planters of palms and flowers along the kerb, between the doors
  for (const x of [-110, -90, -70]) {
    b.box(STONE, 3.2, 0.6, 1.3, x, 0, T.front + 3.2, { solid: true });
    b.box(0x3f6212, 3.0, 0.12, 1.1, x, 0.6, T.front + 3.2, { solid: false });
    for (let i = 0; i < 6; i++) b.box([0xdc2626, 0xfacc15, 0xf97316][i % 3], 0.25, 0.25, 0.25, x - 1.2 + i * 0.48, 0.68, T.front + 3.0 + (i % 2) * 0.35, { solid: false });
  }

  // The columns that hold the roof out over the kerb: slim, white, each branching in two near the top
  const outer = T.front + 6.2;
  for (let x = T.west + 2; x <= T.east - 2; x += 8) {
    const top = roofUnderside(outer);
    b.cylinder(WHITE, 0.32, top - 3.2, x, 0, outer, { topRadius: 0.24, sides: 14, solid: true });
    for (const side of [-1, 1]) b.box(WHITE, 0.24, 4.2, 0.24, x + side * 1.0, top - 4.0, outer, { roll: side * -0.5, solid: false });
    b.box(WHITE, 0.24, 3.4, 0.24, x, top - 3.4, outer - 0.9, { pitch: -0.45, solid: false });
  }

  // The set-down lane and the car park beyond it, with a planted median between
  b.ground(0x3f3f46, width + 6, 4.2, T.mid, 0.022, -96);
  for (let x = T.west - 2; x < T.east + 2; x += 6) b.ground(WHITE, 2.4, 0.14, x, 0.03, -96);
  b.ground(0xe7e5e4, width + 6, 0.35, T.mid, 0.03, -98.1);
  b.ground(0x4d7c0f, 31, 1.6, -98.5, 0.026, -93.2);
  b.ground(0x4d7c0f, 8, 1.6, -71, 0.026, -93.2);
  for (const x of [-112, -106, -100, -94, -88]) palm(b, x, -93.2, 6.5 + ((x * 7) % 3) * 0.4, x * 0.3);
  for (const x of [-74, -68]) palm(b, x, -93.2, 6.8, x);
  // (clear of the approach road and its pavements, x -84.8 to -75.2)
  for (const x of [-88.6, -87, -73.4, -71.8]) flag(b, x, -93.3);
  // The car park: bays marked out on dark tarmac, a lamp to light each run. Two rows facing each other
  // across an aisle where the approach road leaves room for them (Lagos); one row where it comes closer
  const two = rows === 2;
  const lotDepth = two ? 14 : 6.6;
  const middle = -92.1 + lotDepth / 2;
  b.ground(0x27272a, 28, lotDepth, -99.5, 0.02, middle);
  b.ground(0x27272a, 8.4, lotDepth, -70.8, 0.02, middle);
  for (const [from, to] of [[-113, -86.4], [-74.5, -67.5]] as const) {
    for (let x = from; x <= to + 0.01; x += 2.6) for (const z of PARK_ROWS.slice(0, rows)) b.ground(WHITE, 0.1, 4.4, x, 0.03, z);
  }
  if (two) for (let x = -112; x < -87; x += 4) b.ground(0xf8fafc, 0.5, 2.2, x, 0.03, -85);
  const lampZ = two ? -85 : -86.2;
  for (const x of [-113.6, -99, -86.6, -66.6]) {
    b.cylinder(0x9ca3af, 0.1, 7.5, x, 0, lampZ, { solid: true });
    b.box(0x334155, 1.6, 0.18, 0.5, x, 7.5, lampZ, { solid: false });
    b.box(0xfff7d6, 1.4, 0.06, 0.4, x, 7.45, lampZ, { solid: false, glow: true });
  }
}

/** The two rows of the car park (z of the bays' middles, as drawn), the aisle between them */
const PARK_ROWS = [-89.7, -80.3] as const;

type Parked = { x: number; z: number; yaw: number; car: string; paint: number };
/** Where the parked and stopping cars stand: x, z, which way they face, and what they are */
function parked(rows: 1 | 2): Parked[] {
  const out: Parked[] = [];
  const models = ['camry', 'corolla_2020', 'lexus_rx', 'highlander', 'accord', 'range_rover', 'corolla_2008', 'gwagon', 'bmw_7', 'suv'];
  const paints = [0xf8fafc, 0x111827, 0x9ca3af, 0x1e3a8a, 0x7f1d1d, 0xe5e7eb, 0x374151, 0x14532d];
  let n = 11;
  // (the high bits: the low bits of this generator repeat every few calls, and every car came out white)
  const roll = (m: number) => ((n = (n * 1103515245 + 12345) & 0x7fffffff) >>> 16) % m;
  // Runs of bays, nose in; some bays empty
  for (const [from, to] of [[-111.7, -87.2], [-73.2, -68.5]] as const) {
    for (let x = from; x <= to; x += 2.6) {
      for (const [z, yaw] of ([[PARK_ROWS[0], 0], [PARK_ROWS[1], Math.PI]] as const).slice(0, rows)) {
        if (roll(10) < 3) continue;
        out.push({ x, z, yaw, car: models[roll(models.length)], paint: paints[roll(paints.length)] });
      }
    }
  }
  // Dropping off at the kerb
  out.push({ x: -104, z: -96.8, yaw: Math.PI / 2, car: 'camry', paint: 0xf8fafc });
  out.push({ x: -95, z: -96.8, yaw: Math.PI / 2, car: 'taxi', paint: 0xfacc15 });
  out.push({ x: -71, z: -96.8, yaw: Math.PI / 2, car: 'lexus_rx', paint: 0x111827 });
  return out;
}

/** How many rows of bays fit between the kerb and an approach road along this z (as drawn) */
export function parkRows(approachZ: number | undefined): 1 | 2 {
  return approachZ === undefined || approachZ >= -72 ? 2 : 1;
}

/** The parked cars, for anything that keeps people and cars out of them: their footprints, as drawn */
export function parkedFootprints(rows: 1 | 2): Array<{ minX: number; maxX: number; minZ: number; maxZ: number }> {
  return parked(rows).map((p) => {
    const across = Math.abs(Math.sin(p.yaw)) > 0.5;
    return across ? { minX: p.x - 2.35, maxX: p.x + 2.35, minZ: p.z - 0.95, maxZ: p.z + 0.95 } : { minX: p.x - 0.95, maxX: p.x + 0.95, minZ: p.z - 2.35, maxZ: p.z + 2.35 };
  });
}

/**
 * What is not made of the ordinary pieces: the vaulted roof, its timber underside, the name along
 * the front, the Departures and Arrivals signs, and the cars (real models, one batch per model).
 * `local` turns a drawn point into the group's own space.
 */
export function grandTerminalExtras(name: string, code: string, local: (x: number, y: number, z: number) => THREE.Vector3, rows: 1 | 2): THREE.Group {
  const group = new THREE.Group();
  group.name = 'grand terminal';

  // The roof: one arc across, from the kerb to the apron, the whole length of the hall and past it
  const c = roofCircle();
  const steps = 28;
  const make = (lift: number, colour: number, rough: number, metal: number, under: boolean) => {
    const positions: number[] = [];
    const normals: number[] = [];
    const index: number[] = [];
    for (let i = 0; i <= steps; i++) {
      const a = -c.half + (2 * c.half * i) / steps;
      const z = c.middle + Math.sin(a) * c.radius;
      const y = c.centreY + Math.cos(a) * c.radius - lift;
      const n = new THREE.Vector3(0, Math.cos(a), Math.sin(a)).multiplyScalar(under ? -1 : 1);
      for (const x of [ROOF.west, ROOF.east]) {
        const p = local(x, y, z);
        positions.push(p.x, p.y, p.z);
        normals.push(n.x, n.y, n.z);
      }
    }
    for (let i = 0; i < steps; i++) {
      const k = i * 2;
      if (under) index.push(k, k + 1, k + 2, k + 1, k + 3, k + 2);
      else index.push(k, k + 2, k + 1, k + 1, k + 2, k + 3);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geo.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
    geo.setIndex(index);
    const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: colour, roughness: rough, metalness: metal }));
    mesh.castShadow = !under;
    mesh.receiveShadow = true;
    return mesh;
  };
  group.add(make(0, 0xf1f5f9, 0.35, 0.35, false), make(0.42, 0xc8955c, 0.7, 0, true));
  // The roof's edges (a thick white rim along the front and the back, and short straight pieces
  // following the arc at each end) and the skylights along the ridge: one mesh
  const parts: THREE.BufferGeometry[] = [];
  const place = (geo: THREE.BufferGeometry, at: THREE.Vector3, tilt = 0, stretch = 1) => {
    const g = geo.clone();
    g.applyMatrix4(new THREE.Matrix4().compose(at, new THREE.Quaternion().setFromEuler(new THREE.Euler(tilt, 0, 0)), new THREE.Vector3(1, 1, stretch)));
    parts.push(g);
  };
  const long = new THREE.BoxGeometry(ROOF.east - ROOF.west, 0.55, 0.5);
  for (const a of [-c.half, c.half]) {
    place(long, local((ROOF.west + ROOF.east) / 2, c.centreY + Math.cos(a) * c.radius - 0.2, c.middle + Math.sin(a) * c.radius));
  }
  const segment = new THREE.BoxGeometry(0.5, 0.55, 1);
  for (const x of [ROOF.west, ROOF.east]) {
    for (let i = 0; i < steps; i++) {
      const a0 = -c.half + (2 * c.half * i) / steps;
      const a1 = -c.half + (2 * c.half * (i + 1)) / steps;
      const z0 = c.middle + Math.sin(a0) * c.radius, y0 = c.centreY + Math.cos(a0) * c.radius - 0.2;
      const z1 = c.middle + Math.sin(a1) * c.radius, y1 = c.centreY + Math.cos(a1) * c.radius - 0.2;
      place(segment, local(x, (y0 + y1) / 2, (z0 + z1) / 2), -Math.atan2(y1 - y0, z1 - z0), Math.hypot(z1 - z0, y1 - y0) + 0.04);
    }
  }
  const skylight = new THREE.BoxGeometry(3.2, 0.12, 1.6);
  for (let x = ROOF.west + 4; x < ROOF.east - 3; x += 6) place(skylight, local(x, ROOF.peak + 0.05, c.middle));
  const rims = new THREE.Mesh(mergeGeometries(parts.map((g) => (g.index ? g.toNonIndexed() : g)), false), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.4, metalness: 0.3 }));
  rims.castShadow = true;
  group.add(rims);

  // The name along the front, big enough to read from the road; and on the east end, to the road
  const T = TERMINAL;
  const title = signBoard([`${name.toUpperCase()}  ·  ${code}`], 40, 1.6, '#0f172a', '#facc15');
  title.position.copy(local(T.mid, T.height + 0.75, T.front + 0.58));
  const endSign = signBoard([name.toUpperCase(), code], 11, 2.4, '#0f172a', '#facc15');
  endSign.position.copy(local(T.east + 0.72, T.height - 1.7, (T.front + T.back) / 2));
  endSign.rotation.y = Math.PI / 2;
  group.add(title, endSign);
  for (const [x, words, colour] of [[-100, '⬇  ARRIVALS', '#0369a1'], [-80, '⬆  DEPARTURES', '#0b7a43']] as const) {
    const sign = signBoard([words], 5.6, 0.9, colour, '#ffffff');
    sign.position.copy(local(x, 4.55, T.front + 0.7));
    group.add(sign);
  }

  // The cars, real models in their own paint, all in one mesh (each model made once, copied to each bay)
  const made = new Map<string, THREE.BufferGeometry | null>();
  const cars: THREE.BufferGeometry[] = [];
  const turn = new THREE.Quaternion();
  const up = new THREE.Vector3(0, 1, 0);
  const one = new THREE.Vector3(1, 1, 1);
  for (const p of parked(rows)) {
    const key = `${p.car}|${p.paint}`;
    if (!made.has(key)) {
      const model = p.car === 'taxi' ? buildKitCar('corolla_2008', undefined, { taxi: true, light: true }) : buildKitCar(p.car, p.paint, { light: true });
      made.set(key, bakeToGeometry(model.group));
    }
    const geo = made.get(key);
    if (!geo) continue;
    const copy = geo.clone();
    copy.applyMatrix4(new THREE.Matrix4().compose(local(p.x, 0, p.z), turn.setFromAxisAngle(up, p.yaw), one));
    cars.push(copy);
  }
  if (cars.length) {
    const lot = new THREE.Mesh(mergeGeometries(cars, false), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.32, metalness: 0.35 }));
    lot.name = 'parked cars';
    lot.castShadow = true;
    lot.receiveShadow = true;
    group.add(lot);
  }
  return group;
}
