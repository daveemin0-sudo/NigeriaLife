import * as THREE from 'three';
import { Builder } from '../world/kit/ArchKit';
import type { FurnitureKind } from './FurnitureModels';

/**
 * More furniture, for every pocket: the small television a first flat starts with and the big
 * ones it grows into, a foam mattress, plastic chairs, a washing machine that is a washing
 * machine, walls to split a room, and sofas and beds in more colours than one.
 * Each is built facing +z, on the floor, round its own middle, like the rest of the kit.
 */

const SCREEN = 'tv_screen';

/** A television of a given size (the diagonal, in inches) standing on something that fits it */
function sizedTelevision(inches: number): THREE.Group {
  const b = new Builder();
  const w = inches * 0.0221;
  const h = w * 0.5625;
  const small = inches <= 32;
  const stand = Math.max(0.8, w + 0.3);
  let top: number;
  if (small) {
    // A small wooden side table, the way a first television stands
    b.box(0x8b5a2b, stand, 0.05, 0.46, 0, 0.55, 0);
    for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) b.box(0x6b4423, 0.05, 0.55, 0.05, x * (stand / 2 - 0.05), 0, z * 0.18);
    top = 0.6;
  } else {
    // A low console with two doors
    b.box(0x292524, stand, 0.5, 0.46, 0, 0.08, 0).box(0x44403c, stand / 2 - 0.06, 0.4, 0.03, -stand / 4, 0.13, 0.24).box(0x44403c, stand / 2 - 0.06, 0.4, 0.03, stand / 4, 0.13, 0.24);
    for (const x of [-1, 1]) b.box(0x1c1917, 0.08, 0.08, 0.4, x * (stand / 2 - 0.1), 0, 0);
    top = 0.58;
  }
  b.box(0x0a0a0a, Math.min(0.5, w * 0.4), 0.04, 0.22, 0, top, 0).box(0x0a0a0a, 0.07, 0.12, 0.05, 0, top + 0.04, 0);
  const frame = top + 0.14;
  b.box(0x0a0a0a, w + 0.06, h + 0.06, 0.05, 0, frame, 0);
  b.box(0x22c55e, 0.025, 0.025, 0.01, w / 2 - 0.04, frame + 0.015, 0.03, { glow: true });
  const group = b.build(`television ${inches} in`);
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: 0x06080c }));
  screen.name = SCREEN;
  screen.position.set(0, frame + 0.03 + h / 2, 0.028);
  group.add(screen);
  return group;
}

function sofa(seats: number, cloth: number, cushion: number, frame: number): THREE.Group {
  const b = new Builder();
  const each = 0.74;
  const inside = seats * each;
  const width = inside + 0.48;
  b.box(frame, width, 0.42, 1, 0, 0, 0).box(cloth, width, 0.78, 0.24, 0, 0.42, -0.38);
  for (const side of [-1, 1]) b.box(frame, 0.24, 0.7, 1, side * (width / 2 - 0.12), 0, 0).box(cloth, 0.28, 0.08, 1.02, side * (width / 2 - 0.12), 0.7, 0);
  for (let i = 0; i < seats; i++) {
    const x = -inside / 2 + (i + 0.5) * each;
    b.box(cushion, each - 0.04, 0.16, 0.7, x, 0.42, 0.1).box(cushion, each - 0.06, 0.46, 0.14, x, 0.6, -0.2, { pitch: -0.16 });
  }
  for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) b.box(0x1c1917, 0.1, 0.08, 0.1, x * (width / 2 - 0.1), 0, z * 0.42);
  return b.build('sofa');
}

/** A bed of a given width, its cover in a colour, with a headboard and pillows */
function bedIn(width: number, cover: number, trim: number, wood: number): THREE.Group {
  const b = new Builder();
  const dark = new THREE.Color(wood).multiplyScalar(0.7).getHex();
  b.box(wood, width, 0.34, 2.3, 0, 0.1, 0).box(dark, width + 0.04, 1.2, 0.14, 0, 0, -1.12).box(dark, width + 0.04, 0.5, 0.1, 0, 0, 1.13);
  for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) b.box(0x3f1d06, 0.1, 0.1, 0.1, x * (width / 2 - 0.08), 0, z * 1.05);
  b.box(0xf8fafc, width - 0.12, 0.26, 2.12, 0, 0.44, 0.02);
  const pillows = width > 1.3 ? [-width / 4, width / 4] : [0];
  for (const x of pillows) b.box(0xffffff, Math.min(0.76, width / pillows.length - 0.12), 0.16, 0.44, x, 0.7, -0.74);
  b.box(cover, width - 0.08, 0.07, 1.3, 0, 0.7, 0.42).box(trim, width - 0.08, 0.07, 0.24, 0, 0.71, -0.3);
  return b.build('bed');
}

function bunkBed(): THREE.Group {
  const b = new Builder();
  const wood = 0x92400e;
  for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) b.box(wood, 0.08, 1.9, 0.08, x * 0.48, 0, z * 1.05);
  for (const y of [0.25, 1.25]) {
    b.box(wood, 1.02, 0.1, 2.2, 0, y, 0).box(0xf8fafc, 0.92, 0.16, 2.05, 0, y + 0.1, 0).box(y < 1 ? 0x2563eb : 0xdc2626, 0.94, 0.05, 1.2, 0, y + 0.26, 0.4);
    b.box(0xffffff, 0.6, 0.12, 0.36, 0, y + 0.26, -0.78);
  }
  b.box(wood, 1.02, 0.1, 0.06, 0, 1.72, -1.08).box(wood, 1.02, 0.1, 0.06, 0, 1.72, 1.08);
  for (let i = 0; i < 4; i++) b.box(wood, 0.36, 0.04, 0.05, 0.3, 0.45 + i * 0.3, 1.12);
  return b.build('bunk bed');
}

/** A foam mattress on the floor: where most people in Lagos sleep in their first room */
function foamMattress(): THREE.Group {
  const b = new Builder();
  b.box(0xe2e8f0, 1.4, 0.2, 1.95, 0, 0, 0).box(0xfbbf24, 1.42, 0.03, 1.3, 0, 0.2, 0.3).box(0xf97316, 1.42, 0.035, 0.18, 0, 0.2, -0.3);
  b.box(0xffffff, 0.6, 0.12, 0.38, 0, 0.2, -0.7);
  return b.build('foam mattress');
}

/** A white or red plastic table with two plastic chairs in front of it */
function plasticSet(colour: number): THREE.Group {
  const b = new Builder();
  // Table
  b.box(colour, 0.8, 0.04, 0.8, 0, 0.7, -0.2);
  for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) b.box(colour, 0.05, 0.7, 0.05, x * 0.36, 0, -0.2 + z * 0.36);
  // Two chairs, one each side of the front
  for (const x of [-0.36, 0.36]) {
    b.box(colour, 0.44, 0.04, 0.42, x, 0.44, 0.45);
    b.box(colour, 0.44, 0.42, 0.04, x, 0.48, 0.66, { pitch: 0.12 });
    for (const [lx, lz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) b.box(colour, 0.04, 0.44, 0.04, x + lx * 0.19, 0, 0.45 + lz * 0.18);
  }
  return b.build('plastic table and chairs');
}

function washingMachine(): THREE.Group {
  const b = new Builder();
  b.box(0xf8fafc, 0.62, 0.86, 0.62, 0, 0, 0).box(0xe2e8f0, 0.62, 0.1, 0.02, 0, 0.74, 0.31);
  b.box(0x334155, 0.16, 0.05, 0.01, -0.15, 0.77, 0.325).cylinder(0x94a3b8, 0.035, 0.02, 0.2, 0.77, 0.32, { sides: 12 });
  // The round door: a steel ring and glass
  b.cylinder(0x94a3b8, 0.22, 0.03, 0, 0.38, 0.31, { sides: 24, pitch: Math.PI / 2 });
  b.cylinder(0x1e293b, 0.17, 0.035, 0, 0.38, 0.31, { sides: 24, pitch: Math.PI / 2 });
  return b.build('washing machine');
}

function microwave(): THREE.Group {
  const b = new Builder();
  // On a small kitchen trolley
  b.box(0x9ca3af, 0.6, 0.04, 0.42, 0, 0.82, 0).box(0x9ca3af, 0.6, 0.04, 0.42, 0, 0.3, 0);
  for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) b.box(0x6b7280, 0.03, 0.86, 0.03, x * 0.28, 0, z * 0.19);
  b.box(0xe5e7eb, 0.52, 0.3, 0.38, 0, 0.86, 0).box(0x111827, 0.32, 0.22, 0.01, -0.06, 0.9, 0.19).box(0x374151, 0.1, 0.22, 0.01, 0.2, 0.9, 0.19);
  b.box(0x22c55e, 0.05, 0.02, 0.01, 0.2, 1.08, 0.196, { glow: true });
  return b.build('microwave');
}

function pottedPlant(): THREE.Group {
  const b = new Builder();
  b.cylinder(0xb45309, 0.22, 0.42, 0, 0, 0, { topRadius: 0.27, sides: 14 }).cylinder(0x3f2a14, 0.24, 0.03, 0, 0.4, 0, { sides: 14 });
  b.cylinder(0x4d7c0f, 0.03, 0.5, 0, 0.42, 0, { sides: 6 });
  const leaf = [0x15803d, 0x16a34a, 0x22c55e];
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2;
    b.box(leaf[i % 3], 0.12, 0.04, 0.5, Math.sin(a) * 0.22, 0.7 + (i % 3) * 0.16, Math.cos(a) * 0.22, { yaw: a, pitch: -0.5 });
  }
  return b.build('potted plant');
}

function keroseneStove(): THREE.Group {
  const b = new Builder();
  // A wooden stool, and on it the stove: a blue tank, a ring of wicks, a pot of stew
  b.box(0x8b5a2b, 0.5, 0.04, 0.5, 0, 0.42, 0);
  for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) b.box(0x6b4423, 0.04, 0.42, 0.04, x * 0.21, 0, z * 0.21);
  b.cylinder(0x1d4ed8, 0.2, 0.14, 0, 0.46, 0, { sides: 16 }).cylinder(0x374151, 0.14, 0.12, 0, 0.6, 0, { sides: 16 });
  b.cylinder(0xf97316, 0.1, 0.02, 0, 0.72, 0, { sides: 16, glow: true });
  b.cylinder(0x9ca3af, 0.17, 0.18, 0, 0.74, 0, { sides: 16 }).cylinder(0xb91c1c, 0.15, 0.01, 0, 0.92, 0, { sides: 16 });
  return b.build('kerosene stove');
}

function nightstand(): THREE.Group {
  const b = new Builder();
  b.box(0x78350f, 0.5, 0.55, 0.42, 0, 0.04, 0).box(0x5b2c0a, 0.44, 0.2, 0.02, 0, 0.33, 0.21).box(0x5b2c0a, 0.44, 0.2, 0.02, 0, 0.09, 0.21);
  b.box(0xd4af37, 0.08, 0.02, 0.02, 0, 0.42, 0.225).box(0xd4af37, 0.08, 0.02, 0.02, 0, 0.18, 0.225);
  for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) b.box(0x3f1d06, 0.04, 0.04, 0.04, x * 0.22, 0, z * 0.18);
  b.cylinder(0xfef3c7, 0.08, 0.16, 0.1, 0.59, 0, { topRadius: 0.05, sides: 12, glow: true });
  return b.build('nightstand');
}

/** A length of wall to split a room: plastered, painted, with a skirting board */
function partition(length: number): THREE.Group {
  const b = new Builder();
  b.box(0xf1e4c8, length, 2.6, 0.12, 0, 0, 0).box(0x78350f, length + 0.01, 0.1, 0.14, 0, 0, 0);
  return b.build('partition wall');
}

function soundbar(): THREE.Group {
  const b = new Builder();
  b.box(0x111827, 1.0, 0.1, 0.12, 0, 0.0, 0).box(0x374151, 0.96, 0.06, 0.005, 0, 0.02, 0.062);
  b.box(0x111827, 0.34, 0.42, 0.34, 0.8, 0, 0).cylinder(0x374151, 0.1, 0.01, 0.8, 0.2, 0.17, { sides: 16, pitch: Math.PI / 2 });
  return b.build('soundbar');
}

/** A colour each piece can be had in */
export interface Finish {
  id: string;
  name: string;
  cloth: number;
  cushion: number;
  frame: number;
}

export const SOFA_FINISHES: Finish[] = [
  { id: 'navy', name: 'Navy', cloth: 0x1e3a8a, cushion: 0x3b82f6, frame: 0x0f172a },
  { id: 'mustard', name: 'Mustard', cloth: 0xb45309, cushion: 0xf59e0b, frame: 0x78350f },
  { id: 'grey', name: 'Grey', cloth: 0x4b5563, cushion: 0x9ca3af, frame: 0x1f2937 },
  { id: 'cream', name: 'Cream', cloth: 0xd6c7a1, cushion: 0xf5ecd6, frame: 0x8b7355 },
  { id: 'leather', name: 'Black leather', cloth: 0x18181b, cushion: 0x27272a, frame: 0x09090b },
  { id: 'brown', name: 'Brown leather', cloth: 0x5c2e0e, cushion: 0x7c3f16, frame: 0x3b1d08 },
  { id: 'pink', name: 'Blush pink', cloth: 0xbe185d, cushion: 0xf472b6, frame: 0x831843 },
  { id: 'teal', name: 'Teal', cloth: 0x0f766e, cushion: 0x2dd4bf, frame: 0x134e4a },
];

export const BED_FINISHES: Array<{ id: string; name: string; cover: number; trim: number; wood: number }> = [
  { id: 'blue', name: 'Blue', cover: 0x1d4ed8, trim: 0x93c5fd, wood: 0x78350f },
  { id: 'ankara', name: 'Ankara orange', cover: 0xea580c, trim: 0xfacc15, wood: 0x78350f },
  { id: 'purple', name: 'Royal purple', cover: 0x581c87, trim: 0xc084fc, wood: 0x451a03 },
  { id: 'green', name: 'Green and white', cover: 0x15803d, trim: 0xf8fafc, wood: 0x92400e },
  { id: 'grey', name: 'Grey', cover: 0x4b5563, trim: 0xd1d5db, wood: 0x1f2937 },
  { id: 'red', name: 'Red', cover: 0xb91c1c, trim: 0xfca5a5, wood: 0x5b2c0a },
];

export const TV_SIZES = [24, 32, 43, 55, 65] as const;

export const MORE_MAKERS: Record<string, () => THREE.Group> = {
  foam_mattress: foamMattress,
  plastic_set: () => plasticSet(0xf8fafc),
  plastic_set_red: () => plasticSet(0xdc2626),
  washing_machine: washingMachine,
  microwave_oven: microwave,
  potted_plant: pottedPlant,
  kerosene_stove: keroseneStove,
  nightstand,
  bunk_bed: bunkBed,
  single_bed: () => bedIn(1.0, 0x1d4ed8, 0x93c5fd, 0x78350f),
  partition_wall: () => partition(2),
  partition_wall_short: () => partition(1),
  hifi_soundbar: soundbar,
  ...Object.fromEntries(TV_SIZES.map((inches) => [`tv_${inches}`, () => sizedTelevision(inches)])),
  ...Object.fromEntries(SOFA_FINISHES.flatMap((f) => [
    [`sofa3_${f.id}`, () => sofa(3, f.cloth, f.cushion, f.frame)],
    [`sofa2_${f.id}`, () => sofa(2, f.cloth, f.cushion, f.frame)],
    [`armchair_${f.id}`, () => sofa(1, f.cloth, f.cushion, f.frame)],
  ])),
  ...Object.fromEntries(BED_FINISHES.flatMap((f) => [
    [`double_bed_${f.id}`, () => bedIn(1.6, f.cover, f.trim, f.wood)],
    [`king_bed_${f.id}`, () => bedIn(2.1, f.cover, f.trim, f.wood)],
  ])),
};

export const MORE_KINDS: Record<string, FurnitureKind> = {
  foam_mattress: { solid: true, use: 'bed', bed: { x: 0, z: 0.6, top: 0.25, side: 0.75 } },
  plastic_set: { solid: true, use: 'seat', seat: { x: -0.36, z: 0.45 } },
  plastic_set_red: { solid: true, use: 'seat', seat: { x: -0.36, z: 0.45 } },
  partition_wall: { solid: true, use: 'none' },
  partition_wall_short: { solid: true, use: 'none' },
  potted_plant: { solid: true, use: 'none' },
  ...Object.fromEntries(TV_SIZES.map((inches) => [`tv_${inches}`, { solid: true, use: 'tv' } as FurnitureKind])),
  ...Object.fromEntries(SOFA_FINISHES.flatMap((f) => [
    [`sofa3_${f.id}`, { solid: true, use: 'seat', seat: { x: 0, z: 0.08 } } as FurnitureKind],
    [`sofa2_${f.id}`, { solid: true, use: 'seat', seat: { x: 0, z: 0.08 } } as FurnitureKind],
    [`armchair_${f.id}`, { solid: true, use: 'seat', seat: { x: 0, z: 0.06 } } as FurnitureKind],
  ])),
  ...Object.fromEntries(BED_FINISHES.flatMap((f) => [
    [`double_bed_${f.id}`, { solid: true, use: 'bed', bed: { x: 0, z: 0.75, top: 0.7, side: 0.85 } } as FurnitureKind],
    [`king_bed_${f.id}`, { solid: true, use: 'bed', bed: { x: 0, z: 0.75, top: 0.7, side: 1.05 } } as FurnitureKind],
  ])),
};
