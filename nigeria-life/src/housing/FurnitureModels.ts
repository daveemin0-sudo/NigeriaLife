import * as THREE from 'three';
import { Builder } from '../world/kit/ArchKit';

/**
 * Furniture that reads as furniture, made with the building kit: a sofa has a seat, a back,
 * arms and cushions; a bed has a frame, a mattress, pillows and a cover; a television has a
 * screen in a frame on a stand. Each is built facing +z, on the floor, round its own middle.
 */

/** What a piece is for, beyond being looked at. */
export type FurnitureUse = 'seat' | 'tv' | 'none';

export interface FurnitureKind {
  /** People walk round it. A rug is walked over. */
  solid: boolean;
  use: FurnitureUse;
  /** Where someone sits on it, measured on the piece (a seat only) */
  seat?: { x: number; z: number };
}

export const FURNITURE: Record<string, FurnitureKind> = {
  sofa_emerald: { solid: true, use: 'seat', seat: { x: 0, z: 0.08 } },
  armchair: { solid: true, use: 'seat', seat: { x: 0, z: 0.06 } },
  tv_75: { solid: true, use: 'tv' },
  king_bed: { solid: true, use: 'none' },
  bookshelf: { solid: true, use: 'none' },
  wardrobe: { solid: true, use: 'none' },
  floor_lamp: { solid: true, use: 'none' },
  solar_inverter: { solid: true, use: 'none' },
  generator_small: { solid: true, use: 'none' },
  generator_big: { solid: true, use: 'none' },
  standing_fan: { solid: true, use: 'none' },
  freezer: { solid: true, use: 'none' },
  drum_bucket: { solid: true, use: 'none' },
  cooker: { solid: true, use: 'none' },
  potted_plant: { solid: true, use: 'none' },
  rug_circle: { solid: false, use: 'none' },
};

/** The name a television's picture goes by inside its model. */
export const TV_SCREEN = 'tv_screen';

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
  for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) b.box(0x1c1917, 0.1, 0.08, 0.1, x * (width / 2 - 0.1), -0.0, z * 0.42);
  return b.build('sofa');
}

function television(): THREE.Group {
  const b = new Builder();
  // A low console with two doors, and the set standing on it
  b.box(0x292524, 2, 0.5, 0.46, 0, 0.08, 0).box(0x44403c, 0.94, 0.4, 0.03, -0.49, 0.13, 0.24).box(0x44403c, 0.94, 0.4, 0.03, 0.49, 0.13, 0.24);
  for (const x of [-0.9, 0.9]) b.box(0x1c1917, 0.08, 0.08, 0.4, x, 0, 0);
  b.box(0x0a0a0a, 0.5, 0.04, 0.26, 0, 0.58, 0).box(0x0a0a0a, 0.08, 0.14, 0.06, 0, 0.62, 0);
  b.box(0x0a0a0a, 1.76, 1.02, 0.06, 0, 0.74, 0).box(0x18181b, 1.2, 0.1, 0.12, 0, 0.6, 0.16);
  b.box(0x22c55e, 0.03, 0.03, 0.01, 0.8, 0.77, 0.035, { glow: true });
  const group = b.build('television');
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(1.66, 0.92), new THREE.MeshBasicMaterial({ color: 0x06080c }));
  screen.name = TV_SCREEN;
  screen.position.set(0, 1.25, 0.034);
  group.add(screen);
  return group;
}

function bed(): THREE.Group {
  const b = new Builder();
  const wood = 0x78350f;
  b.box(wood, 2.1, 0.34, 2.3, 0, 0.1, 0).box(0x5b2c0a, 2.14, 1.2, 0.14, 0, 0, -1.12).box(0x5b2c0a, 2.14, 0.5, 0.1, 0, 0, 1.13);
  for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) b.box(0x3f1d06, 0.12, 0.1, 0.12, x * 0.96, 0, z * 1.05);
  b.box(0xf8fafc, 1.98, 0.26, 2.12, 0, 0.44, 0.02);
  for (const x of [-0.5, 0.5]) b.box(0xffffff, 0.76, 0.16, 0.44, x, 0.7, -0.74);
  b.box(0x1d4ed8, 2.02, 0.07, 1.3, 0, 0.7, 0.42).box(0x93c5fd, 2.02, 0.07, 0.24, 0, 0.71, -0.3);
  return b.build('bed');
}

function bookshelf(): THREE.Group {
  const b = new Builder();
  const wood = 0x92400e;
  b.box(wood, 1.6, 2, 0.04, 0, 0, -0.17).box(wood, 0.05, 2, 0.38, -0.78, 0, 0).box(wood, 0.05, 2, 0.38, 0.78, 0, 0);
  const spines = [0xb91c1c, 0x1d4ed8, 0x15803d, 0xca8a04, 0x7c3aed, 0xf8fafc, 0x0e7490, 0xea580c];
  let n = 0;
  for (let shelf = 0; shelf < 5; shelf++) {
    const y = shelf * 0.48;
    b.box(wood, 1.56, 0.04, 0.36, 0, y, 0);
    if (shelf === 4) continue;
    // Books, some leaning, and a gap where one has been taken
    for (let x = -0.68; x < 0.66; x += 0.1) {
      if ((n + shelf) % 9 === 4) { n++; continue; }
      const tall = 0.28 + ((n * 7) % 5) * 0.025;
      b.box(spines[n % spines.length], 0.08, tall, 0.24, x, y + 0.04, 0.02, n % 11 === 3 ? { roll: 0.2 } : {});
      n++;
    }
  }
  return b.build('bookshelf');
}

function wardrobe(): THREE.Group {
  const b = new Builder();
  b.box(0x7c5a3a, 1.8, 2.1, 0.6, 0, 0.06, 0).box(0x5b4027, 1.86, 0.08, 0.66, 0, 2.16, 0).box(0x3f2a17, 1.7, 0.06, 0.5, 0, 0, 0);
  for (const x of [-0.45, 0.45]) b.box(0x8b6a47, 0.86, 1.96, 0.03, x, 0.13, 0.3).box(0xd4af37, 0.03, 0.22, 0.03, x - Math.sign(x) * 0.36, 1.05, 0.33);
  b.box(0xcbd5e1, 0.5, 1.2, 0.01, -0.45, 0.6, 0.32);
  return b.build('wardrobe');
}

function armchair(): THREE.Group {
  return sofa(1, 0x92400e, 0xd97706, 0x78350f);
}

function floorLamp(): THREE.Group {
  const b = new Builder();
  b.cylinder(0x1c1917, 0.2, 0.04, 0, 0, 0, { sides: 16 }).cylinder(0x44403c, 0.025, 1.5, 0, 0.04, 0);
  b.cylinder(0xfef3c7, 0.24, 0.36, 0, 1.5, 0, { topRadius: 0.15, sides: 16, glow: true });
  return b.build('floor lamp');
}

function inverter(): THREE.Group {
  const b = new Builder();
  b.box(0xe5e7eb, 0.7, 0.9, 0.4, 0, 0.1, 0).box(0x1f2937, 0.5, 0.2, 0.02, 0, 0.7, 0.21).box(0x22c55e, 0.06, 0.06, 0.02, -0.2, 0.55, 0.21, { glow: true });
  for (const x of [-0.5, 0.5]) b.box(0x111827, 0.34, 0.5, 0.5, x + Math.sign(x) * 0.25, 0, 0).box(0xdc2626, 0.06, 0.06, 0.06, x + Math.sign(x) * 0.25, 0.5, 0.1);
  return b.build('inverter');
}

function freezer(): THREE.Group {
  const b = new Builder();
  // A chest freezer: a white body on feet, a lid with a lip and a handle, a grille low on the front
  b.box(0xf1f5f9, 1.5, 0.78, 0.7, 0, 0.06, 0).box(0xe2e8f0, 1.54, 0.09, 0.74, 0, 0.84, 0).box(0x94a3b8, 0.5, 0.04, 0.05, 0, 0.84, 0.39);
  b.box(0x334155, 0.5, 0.16, 0.02, 0.4, 0.14, 0.36).box(0x22c55e, 0.04, 0.04, 0.02, -0.6, 0.6, 0.36, { glow: true });
  for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) b.box(0x1f2937, 0.1, 0.06, 0.1, x * 0.66, 0, z * 0.28);
  return b.build('freezer');
}

const MAKERS: Record<string, () => THREE.Group> = {
  sofa_emerald: () => sofa(3, 0x065f46, 0x10b981, 0x064e3b),
  armchair,
  tv_75: television,
  king_bed: bed,
  bookshelf,
  wardrobe,
  floor_lamp: floorLamp,
  solar_inverter: inverter,
  freezer,
};

/** A piece of furniture of this kind, or null if the kit has no design for it. */
export function buildFurniture(modelType: string): THREE.Group | null {
  return MAKERS[modelType]?.() ?? null;
}
