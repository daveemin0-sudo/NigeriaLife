import * as THREE from 'three';
import type { Builder } from '../kit/ArchKit';
import { buildKitCar } from '../vehicles/KitCar';
import { bakeToGeometry } from '../../graphics/MeshBaker';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/**
 * The terminal as it is seen from the city: one building, the way in to everything (check-in,
 * security, the gates, arrivals), so there is never a second door that leads somewhere else.
 *
 * A long glass hall under one great white vaulted roof, its underside warm timber; the airport's
 * name along the front. Two levels, as at Murtala Muhammed: the departures drive comes up a ramp
 * from the west onto a deck along the upper floor, with its own doors and cars dropping off, and
 * the arrivals kerb runs underneath it at street level, with the doors people walk in by, a
 * pick-up lane and the taxis. Flags along the median; a multi-storey car park beside the ramp; a
 * car park of real cars in front. All in the airport's drawn coordinates.
 */

/** The terminal's front (the glass), its back, its ends and its middle, as drawn */
export const TERMINAL = { front: -103, back: -115.2, west: -150, east: -66, mid: -108, height: 12 };
/** The roof: an arc across the building, from over the kerb to over the apron */
const ROOF = { front: -96.2, back: -117.6, peak: 17.2, edge: 13.6, west: -152.5, east: -63.5 };
/** The departures deck along the upper floor: its top, its outer edge, and the ramp's foot in the west */
export const DECK = { top: 6, edge: -96, rampFoot: -181 };
/** The multi-storey car park beside the ramp */
export const CAR_PARK = { west: -181, east: -155, north: -92, south: -68, levels: 4, storey: 3.1 };

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

/** A board with writing on it, where it stands and which way it reads (as signBoard draws them) */
export interface SignSpec {
  lines: string[];
  width: number;
  height: number;
  bg: string;
  ink: string;
  at: THREE.Vector3;
  turn?: number;
}

/**
 * Many boards drawn as one: each board's writing is painted once into a shared picture (boards that
 * say the same thing share theirs) and every board is a quad showing its part of it. One draw call
 * however many signs a place has.
 */
export function signSheet(signs: SignSpec[]): THREE.Mesh {
  const W = 1024;
  const key = (s: SignSpec) => `${s.lines.join('|')}#${s.width}x${s.height}#${s.bg}#${s.ink}`;
  const regions = new Map<string, { y: number; h: number }>();
  let used = 0;
  for (const sign of signs) {
    const k = key(sign);
    if (regions.has(k)) continue;
    const h = Math.max(40, Math.round((W * sign.height) / sign.width));
    regions.set(k, { y: used, h });
    used += h + 6;
  }
  const H = THREE.MathUtils.ceilPowerOfTwo(Math.max(64, used));
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d')!;
  const drawn = new Set<string>();
  for (const sign of signs) {
    const k = key(sign);
    if (drawn.has(k)) continue;
    drawn.add(k);
    const { y, h } = regions.get(k)!;
    ctx.fillStyle = sign.bg;
    ctx.fillRect(0, y, W, h);
    ctx.fillStyle = sign.ink;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    sign.lines.forEach((line, index) => {
      let size = Math.round((h / sign.lines.length) * (index === 0 ? 0.62 : 0.44));
      ctx.font = `800 ${size}px system-ui, sans-serif`;
      while (ctx.measureText(line).width > W - 40 && size > 12) {
        size -= 2;
        ctx.font = `800 ${size}px system-ui, sans-serif`;
      }
      ctx.fillText(line, W / 2, y + ((index + 0.5) * h) / sign.lines.length);
    });
  }
  const quads = signs.map((sign) => {
    const { y, h } = regions.get(key(sign))!;
    const g = new THREE.PlaneGeometry(sign.width, sign.height);
    const uv = g.getAttribute('uv');
    const top = 1 - (y + 1) / H;
    const bottom = 1 - (y + h - 1) / H;
    for (let i = 0; i < uv.count; i++) uv.setY(i, bottom + uv.getY(i) * (top - bottom));
    g.rotateY(sign.turn ?? 0);
    g.translate(sign.at.x, sign.at.y, sign.at.z);
    return g;
  });
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  const mesh = new THREE.Mesh(mergeGeometries(quads, false), new THREE.MeshBasicMaterial({ map: texture }));
  mesh.name = 'signs';
  mesh.userData.surface = true;
  return mesh;
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
  b.windows(LIT, 35, 2, width - 2, 0.4, T.height - 1.2, T.mid, T.front + 0.16, 0, { glow: true });
  for (let x = T.west + 0.6; x <= T.east - 0.6; x += 2.4) b.box(WHITE, 0.16, T.height - 0.3, 0.32, x, 0.1, T.front + 0.2, { solid: false });
  for (const y of [4.2, 8.6]) b.box(WHITE, width - 1, 0.18, 0.3, T.mid, y, T.front + 0.22, { solid: false });
  // The back, onto the apron, the same
  b.box(GLASS, width - 1, T.height - 0.6, 0.12, T.mid, 0.2, T.back - 0.08, { solid: false });
  b.windows(LIT, 35, 2, width - 2, 0.4, T.height - 1.2, T.mid, T.back - 0.16, Math.PI, { glow: true });
  for (let x = T.west + 0.6; x <= T.east - 0.6; x += 2.4) b.box(WHITE, 0.16, T.height - 0.3, 0.3, x, 0.1, T.back - 0.2, { solid: false });

  // The ends: glass as well, between their stone piers
  const midZ = (T.front + T.back) / 2;
  for (const [x, face, out] of [[T.east + 0.56, Math.PI / 2, 1], [T.west - 0.56, -Math.PI / 2, -1]] as const) {
    b.box(GLASS, 0.1, T.height - 3.4, depth - 1.6, x, 0.2, midZ, { solid: false });
    b.windows(LIT, 5, 2, depth - 2.4, 0.5, T.height - 4.4, x + out * 0.07, midZ, face, { glow: true });
  }

  // A fascia above the glass, for the name
  b.box(0x0f172a, width + 0.6, 1.9, 0.5, T.mid, T.height - 0.2, T.front + 0.3, { solid: false });
  b.box(GREEN, width + 0.6, 0.18, 0.55, T.mid, T.height - 0.32, T.front + 0.32, { solid: false });

  // --- Street level: the arrivals kerb, under the deck ---
  // The doors people walk in by, each a bay of sliding glass in a green frame, a mat before it
  for (const x of GROUND_DOORS) {
    b.box(GREEN, 6.2, 0.5, 0.6, x, 3.6, T.front + 0.35, { solid: false });
    b.box(GREEN, 0.4, 3.6, 0.6, x - 2.9, 0, T.front + 0.35, { solid: false }).box(GREEN, 0.4, 3.6, 0.6, x + 2.9, 0, T.front + 0.35, { solid: false });
    for (const side of [-1, 1]) b.box(0x93c5fd, 2.5, 3.3, 0.08, x + side * 1.35, 0, T.front + 0.42, { solid: false, glow: true });
    b.ground(0x27272a, 6, 1.6, x, 0.028, T.front + 1.1);
  }
  // The kerb: a pale pavement, bollards along its edge (not before the doors)
  b.ground(0xe7e5e4, width + 4, 3.2, T.mid, 0.024, T.front + 1.6);
  for (let x = T.west; x <= T.east; x += 2.2) if (GROUND_DOORS.every((d) => Math.abs(x - d) > 3.5)) b.cylinder(0x9ca3af, 0.11, 0.9, x, 0, T.front + 3.0, { solid: true });
  // The pick-up lane, under the deck's edge
  b.ground(0x3f3f46, width + 6, 3.4, T.mid, 0.022, -98.3);
  for (let x = T.west - 2; x < T.east + 2; x += 6) b.ground(WHITE, 2.4, 0.14, x, 0.03, -98.3);

  // --- The departures deck: a road along the upper floor, on piers, up a ramp from the west ---
  const deckZ = (T.front + DECK.edge) / 2;
  const deckD = DECK.edge - T.front;
  b.box(0xa8a29e, width, 0.55, deckD, T.mid, DECK.top - 0.55, deckZ, { solid: false });
  b.box(0x3f3f46, width, 0.04, deckD - 2.2, T.mid, DECK.top, deckZ + 1.1, { solid: false });
  b.box(0xe7e5e4, width, 0.16, 2.2, T.mid, DECK.top, T.front + 1.1, { solid: false });
  for (let x = T.west + 2; x < T.east - 2; x += 6) b.box(WHITE, 2.4, 0.02, 0.14, x, DECK.top + 0.04, deckZ + 1.1, { solid: false });
  // Its parapet: a white concrete edge with a glass rail
  b.box(WHITE, width, 0.9, 0.3, T.mid, DECK.top - 0.75, DECK.edge - 0.15, { solid: false });
  b.box(0x7dd3fc, width, 0.75, 0.05, T.mid, DECK.top + 0.15, DECK.edge - 0.12, { solid: false });
  b.box(0x94a3b8, width, 0.07, 0.1, T.mid, DECK.top + 0.9, DECK.edge - 0.12, { solid: false });
  // The piers under the outer edge, clear of the lane
  for (let x = T.west + 6; x <= T.east - 4; x += 12) b.box(0xd6d3d1, 0.8, DECK.top - 0.55, 0.8, x, 0, DECK.edge - 0.2, { solid: true });
  // The departures doors on the deck, and their mats
  for (const x of UPPER_DOORS) {
    b.box(GREEN, 5.2, 0.4, 0.5, x, DECK.top + 3.1, T.front + 0.3, { solid: false });
    for (const side of [-1, 1]) b.box(0x93c5fd, 2.1, 3.0, 0.08, x + side * 1.12, DECK.top + 0.1, T.front + 0.4, { solid: false, glow: true });
    b.box(0x27272a, 5, 0.02, 1.4, x, DECK.top + 0.16, T.front + 1.0, { solid: false });
  }
  // The ramp: from the ground in the west up to the deck, with its parapets, on two pairs of piers
  const rise = DECK.top;
  const run = T.west - DECK.rampFoot;
  const slope = Math.atan2(rise, run);
  const along = Math.hypot(run, rise);
  const rampX = (T.west + DECK.rampFoot) / 2;
  b.box(0xa8a29e, along, 0.5, deckD, rampX, rise / 2 - 0.5, deckZ, { roll: slope, solid: false });
  b.box(0x3f3f46, along, 0.04, deckD - 1.0, rampX, rise / 2 + 0.01, deckZ, { roll: slope, solid: false });
  for (const z of [T.front + 0.15, DECK.edge - 0.15]) b.box(WHITE, along, 0.9, 0.3, rampX, rise / 2 + 0.1, z, { roll: slope, solid: false });
  for (const x of [T.west - 10, T.west - 20]) {
    const h = (rise * (x - DECK.rampFoot)) / run - 0.55;
    for (const z of [T.front + 0.8, DECK.edge - 0.8]) b.box(0xd6d3d1, 0.8, h, 0.8, x, 0, z, { solid: true });
  }
  // Where it is too low to walk under, nobody does
  b.occupy(DECK.rampFoot, DECK.rampFoot + run * 0.4, T.front, DECK.edge, rise * 0.4);
  // The road on to the ramp from the west
  b.ground(0x3f3f46, 4, deckD, DECK.rampFoot - 1.5, 0.022, deckZ);

  // The columns that hold the roof out over the deck: slim, white, each branching in two near the top
  const outer = DECK.edge - 0.7;
  for (let x = T.west + 2; x <= T.east - 2; x += 8) {
    const top = roofUnderside(outer);
    b.cylinder(WHITE, 0.3, top - DECK.top - 3.2, x, DECK.top, outer, { topRadius: 0.22, sides: 14, solid: false });
    for (const side of [-1, 1]) b.box(WHITE, 0.22, 4.0, 0.22, x + side * 1.0, top - 3.8, outer, { roll: side * -0.5, solid: false });
  }

  // --- The median, with the flags; the car parks beyond ---
  b.ground(0xe7e5e4, width + 6, 0.35, T.mid, 0.03, -96.4);
  b.ground(0x4d7c0f, 66, 2.4, -118, 0.026, -94.4);
  b.ground(0x4d7c0f, 10, 2.4, -70, 0.026, -94.4);
  // (clear of the approach road and its pavements, x -84.8 to -75.2)
  for (const x of [-140, -126, -112, -98, -88.6, -87, -73.4, -71.8]) flag(b, x, -94.4);
  // The big car park, west of the approach road: three rows of bays, two aisles, lamps over the aisles
  b.ground(0x27272a, 65, 24.4, -118.5, 0.02, -80.2);
  for (let x = -150; x <= -87; x += 2.6) for (const z of WEST_ROWS) b.ground(WHITE, 0.1, 4.4, x, 0.03, z);
  for (let x = -148; x < -88; x += 4) for (const z of [-85, -71]) b.ground(0xf8fafc, 0.5, 2.2, x, 0.03, z);
  for (const x of [-147, -132, -117, -102, -89]) {
    for (const z of [-85, -70.9]) {
      b.cylinder(0x9ca3af, 0.1, 7.5, x, 0, z, { solid: true });
      b.box(0x334155, 1.6, 0.18, 0.5, x, 7.5, z, { solid: false });
      b.box(0xfff7d6, 1.4, 0.06, 0.4, x, 7.45, z, { solid: false, glow: true });
    }
  }
  // The small one east of it: two rows where the approach road leaves room (Lagos), one where it comes closer
  const two = rows === 2;
  const lotDepth = two ? 14 : 6.6;
  b.ground(0x27272a, 8.4, lotDepth, -70.8, 0.02, -92.1 + lotDepth / 2);
  for (let x = -74.5; x <= -67.49; x += 2.6) for (const z of PARK_ROWS.slice(0, rows)) b.ground(WHITE, 0.1, 4.4, x, 0.03, z);
  const lampZ = two ? -85 : -86.2;
  b.cylinder(0x9ca3af, 0.1, 7.5, -66.6, 0, lampZ, { solid: true });
  b.box(0x334155, 1.6, 0.18, 0.5, -66.6, 7.5, lampZ, { solid: false });
  b.box(0xfff7d6, 1.4, 0.06, 0.4, -66.6, 7.45, lampZ, { solid: false, glow: true });
  // Palms along the big car park's ends
  for (const x of [-151.6, -85.8]) for (const z of [-90, -80, -70]) palm(b, x, z, 6.4 + Math.abs((x * z) % 3) * 0.3, x + z);

  // --- The multi-storey car park: four decks of bare concrete, open sides, cars on every level ---
  const P = CAR_PARK;
  const pw = P.east - P.west;
  const pd = P.south - P.north;
  const px = (P.west + P.east) / 2;
  const pz = (P.north + P.south) / 2;
  for (let level = 1; level <= P.levels; level++) {
    const y = level * P.storey;
    b.box(0xb8b5ae, pw, 0.35, pd, px, y - 0.35, pz, { solid: false });
    // The upturned edge of each deck, so the decks read from the road
    b.box(0xd6d3d1, pw + 0.2, 1.0, 0.25, px, y, P.north, { solid: false }).box(0xd6d3d1, pw + 0.2, 1.0, 0.25, px, y, P.south, { solid: false });
    b.box(0xd6d3d1, 0.25, 1.0, pd, P.west, y, pz, { solid: false }).box(0xd6d3d1, 0.25, 1.0, pd, P.east, y, pz, { solid: false });
    b.box(GREEN, pw + 0.24, 0.12, 0.28, px, y + 0.7, P.south, { solid: false });
  }
  for (let x = P.west + 0.4; x <= P.east; x += 6.4) for (const z of [P.north + 0.4, pz, P.south - 0.4]) b.box(0xc4c0b8, 0.5, P.levels * P.storey + 1, 0.5, x, 0, z, { solid: false });
  // The lift and stair core at its north-east corner, the big P on it
  b.box(0xd6d3d1, 4.2, P.levels * P.storey + 3, 4.2, P.east - 2.4, 0, P.north + 2.4, { solid: false });
  b.box(0x1d4ed8, 2.8, 2.8, 0.1, P.east - 2.4, P.levels * P.storey - 0.4, P.north - 0.06, { solid: false, glow: true });
  // Its way in, from the car park's aisle
  b.ground(0x3f3f46, 6, 4, P.east + 2, 0.022, P.south - 6);
  b.occupy(P.west, P.east, P.north, P.south, P.levels * P.storey + 1);
}

/** The doors at street level, under the deck, where people walk in (x as drawn) */
export const GROUND_DOORS = [-140, -120, -100, -80] as const;
/** The departures doors on the deck */
const UPPER_DOORS = [-136, -114, -92, -74] as const;
/** The rows of the big car park west of the approach road (z of the bays' middles) */
const WEST_ROWS = [-89.7, -80.3, -75.7] as const;

/** The two rows of the car park (z of the bays' middles, as drawn), the aisle between them */
const PARK_ROWS = [-89.7, -80.3] as const;

type Parked = { x: number; z: number; yaw: number; car: string; paint: number; y?: number };
/** Where the parked and stopping cars stand: x, z, which way they face, and what they are */
function parked(rows: 1 | 2): Parked[] {
  const out: Parked[] = [];
  const models = ['camry', 'corolla_2020', 'lexus_rx', 'highlander', 'accord', 'range_rover', 'corolla_2008', 'gwagon', 'bmw_7', 'suv'];
  const paints = [0xf8fafc, 0x111827, 0x9ca3af, 0x1e3a8a, 0x7f1d1d, 0xe5e7eb, 0x374151, 0x14532d];
  let n = 11;
  // (the high bits: the low bits of this generator repeat every few calls, and every car came out white)
  const roll = (m: number) => ((n = (n * 1103515245 + 12345) & 0x7fffffff) >>> 16) % m;
  const car = (x: number, z: number, yaw: number, y = 0) => out.push({ x, z, yaw, y, car: models[roll(models.length)], paint: paints[roll(paints.length)] });
  // The big car park: three rows, nose in, some bays empty
  for (let x = -148.7; x <= -88.3; x += 2.6) {
    for (const [z, yaw] of [[WEST_ROWS[0], 0], [WEST_ROWS[1], Math.PI], [WEST_ROWS[2], 0]] as const) if (roll(10) >= 3) car(x, z, yaw);
  }
  // The small one east of the approach road
  for (let x = -73.2; x <= -68.5; x += 2.6) {
    for (const [z, yaw] of ([[PARK_ROWS[0], 0], [PARK_ROWS[1], Math.PI]] as const).slice(0, rows)) if (roll(10) >= 3) car(x, z, yaw);
  }
  // On every deck of the multi-storey, the ground floor too, seen through its open sides
  const P = CAR_PARK;
  for (let level = 0; level <= P.levels; level++) {
    for (let x = P.west + 2.2; x <= P.east - 5; x += 2.6) {
      for (const [z, yaw] of [[P.north + 3, 0], [P.south - 3, Math.PI]] as const) if (roll(10) >= 4) car(x, z, yaw, level * P.storey);
    }
  }
  // Picking up at the arrivals kerb, under the deck
  out.push({ x: -126, z: -98.3, yaw: Math.PI / 2, car: 'camry', paint: 0xf8fafc });
  out.push({ x: -95, z: -98.3, yaw: Math.PI / 2, car: 'taxi', paint: 0xfacc15 });
  out.push({ x: -89, z: -98.3, yaw: Math.PI / 2, car: 'taxi', paint: 0xfacc15 });
  out.push({ x: -71, z: -98.3, yaw: Math.PI / 2, car: 'lexus_rx', paint: 0x111827 });
  // Dropping off on the deck, at the departures doors
  for (const [x, model, paint] of [[-138, 'lexus_rx', 0x111827], [-131, 'taxi', 0xfacc15], [-111, 'camry', 0x9ca3af], [-95, 'gwagon', 0x111827], [-90, 'taxi', 0xfacc15], [-77, 'highlander', 0xf8fafc]] as const) {
    out.push({ x, z: -98.2, yaw: Math.PI / 2, car: model, paint, y: DECK.top });
  }
  return out;
}

/** How many rows of bays fit between the kerb and an approach road along this z (as drawn) */
export function parkRows(approachZ: number | undefined): 1 | 2 {
  return approachZ === undefined || approachZ >= -72 ? 2 : 1;
}

/** The parked cars, for anything that keeps people and cars out of them: their footprints, as drawn */
export function parkedFootprints(rows: 1 | 2): Array<{ minX: number; maxX: number; minZ: number; maxZ: number }> {
  return parked(rows).filter((p) => !p.y && !(p.x > CAR_PARK.west - 1 && p.x < CAR_PARK.east + 1 && p.z > CAR_PARK.north - 1 && p.z < CAR_PARK.south + 1)).map((p) => {
    const across = Math.abs(Math.sin(p.yaw)) > 0.5;
    return across ? { minX: p.x - 2.35, maxX: p.x + 2.35, minZ: p.z - 0.95, maxZ: p.z + 0.95 } : { minX: p.x - 0.95, maxX: p.x + 0.95, minZ: p.z - 2.35, maxZ: p.z + 2.35 };
  });
}

/**
 * What is not made of the ordinary pieces: the vaulted roof, its timber underside, the name along
 * the front, the Departures and Arrivals signs, and the cars (real models, one batch per model).
 * `local` turns a drawn point into the group's own space.
 */
export function grandTerminalExtras(name: string, code: string, local: (x: number, y: number, z: number) => THREE.Vector3, rows: 1 | 2, welcome: string[], more: SignSpec[] = []): THREE.Group {
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

  // Every board as one sheet: the name along the front and on each end, which door is which on
  // each level, the multi-storey's P, and the city's welcome over the apron
  const T = TERMINAL;
  const signs: SignSpec[] = [
    { lines: [`${name.toUpperCase()}  ·  ${code}`], width: 40, height: 1.6, bg: '#0f172a', ink: '#facc15', at: local(T.mid, T.height + 0.75, T.front + 0.58) },
    { lines: [name.toUpperCase(), code], width: 11, height: 2.4, bg: '#0f172a', ink: '#facc15', at: local(T.east + 0.72, T.height - 1.7, (T.front + T.back) / 2), turn: Math.PI / 2 },
    { lines: [name.toUpperCase(), code], width: 11, height: 2.4, bg: '#0f172a', ink: '#facc15', at: local(T.west - 0.72, T.height - 1.7, (T.front + T.back) / 2), turn: -Math.PI / 2 },
    ...GROUND_DOORS.map((x): SignSpec => ({ lines: [x > -110 ? 'TERMINAL ENTRANCE  ·  ARRIVALS' : '⬇  ARRIVALS'], width: 5.6, height: 0.8, bg: '#0369a1', ink: '#ffffff', at: local(x, 4.55, T.front + 0.7) })),
    ...UPPER_DOORS.map((x): SignSpec => ({ lines: ['⬆  DEPARTURES'], width: 5, height: 0.8, bg: '#0b7a43', ink: '#ffffff', at: local(x, DECK.top + 3.95, T.front + 0.6) })),
    ...[-138, -108, -78].map((x): SignSpec => ({ lines: ['✈  DEPARTURES · UPPER LEVEL      ARRIVALS · STREET LEVEL'], width: 18, height: 0.75, bg: '#0f172a', ink: '#facc15', at: local(x, DECK.top - 0.3, DECK.edge + 0.02) })),
    { lines: ['P  ·  MULTI-STOREY CAR PARK'], width: 14, height: 1.2, bg: '#1d4ed8', ink: '#ffffff', at: local((CAR_PARK.west + CAR_PARK.east) / 2, CAR_PARK.levels * CAR_PARK.storey + 1.8, CAR_PARK.south + 0.2) },
    { lines: welcome, width: 24, height: 4.4, bg: '#0b7a43', ink: '#ffffff', at: local(-80, 7.9, T.back - 0.45), turn: Math.PI },
    ...more,
  ];
  group.add(signSheet(signs));

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
    copy.applyMatrix4(new THREE.Matrix4().compose(local(p.x, p.y ?? 0, p.z), turn.setFromAxisAngle(up, p.yaw), one));
    cars.push(copy);
  }
  if (cars.length) {
    const lot = new THREE.Mesh(mergeGeometries(cars, false), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.32, metalness: 0.35 }));
    lot.name = 'parked cars';
    // Measured for the city plan through each car's own footprint, not through the box round them all
    lot.userData.surface = true;
    lot.castShadow = true;
    lot.receiveShadow = true;
    group.add(lot);
  }
  return group;
}
