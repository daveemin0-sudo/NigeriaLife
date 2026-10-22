import * as THREE from 'three';
import { Builder } from '../world/kit/ArchKit';

/**
 * Furniture that reads as furniture, made with the building kit: a sofa has a seat, a back,
 * arms and cushions; a bed has a frame, a mattress, pillows and a cover; a television has a
 * screen in a frame on a stand. Each is built facing +z, on the floor, round its own middle.
 */

/** What a piece is for, beyond being looked at. */
export type FurnitureUse =
  | 'seat'
  | 'tv'
  | 'bed'
  | 'cook'
  | 'power'
  | 'bath'
  | 'game'
  | 'work'
  | 'music'
  | 'snooker'
  | 'fitness'
  | 'drink'
  | 'clean'
  | 'none';

/** Where a piece is attached in a room: standing on the floor or mounted on a wall */
export type FurnitureMount = 'floor' | 'wall';

export interface FurnitureKind {
  /** People walk round it. A rug is walked over. Wall furniture hangs above head height. */
  solid: boolean;
  use: FurnitureUse;
  mount?: FurnitureMount;
  /** Height in metres above floor level for wall-mounted items */
  elevation?: number;
  /** Where someone sits on it, measured on the piece (a seat only) */
  seat?: { x: number; z: number };
  /** Where someone lies on it (a bed only): where their feet are, how high the mattress is, and how far out from its middle its side is */
  bed?: { x: number; z: number; top: number; side: number };
}

export const FURNITURE: Record<string, FurnitureKind> = {
  // Comfort & Seating
  sofa_emerald: { solid: true, use: 'seat', seat: { x: 0, z: 0.08 } },
  sectional_sofa: { solid: true, use: 'seat', seat: { x: 0, z: 0.1 } },
  armchair: { solid: true, use: 'seat', seat: { x: 0, z: 0.06 } },
  chaise_longue: { solid: true, use: 'seat', seat: { x: 0, z: 0.08 } },
  ottoman: { solid: true, use: 'seat', seat: { x: 0, z: 0 } },
  velvet_looveseat: { solid: true, use: 'seat', seat: { x: 0, z: 0.08 } },

  // Bedroom & Sleep
  king_bed: { solid: true, use: 'bed', bed: { x: 0, z: 0.75, top: 0.7, side: 1.05 } },
  queen_canopy_bed: { solid: true, use: 'bed', bed: { x: 0, z: 0.75, top: 0.75, side: 1.0 } },
  bunk_bed: { solid: true, use: 'bed', bed: { x: 0, z: 0.65, top: 0.65, side: 0.7 } },
  single_bed: { solid: true, use: 'bed', bed: { x: 0, z: 0.65, top: 0.6, side: 0.65 } },
  wardrobe: { solid: true, use: 'none' },
  walkin_closet: { solid: true, use: 'none' },
  nightstand: { solid: true, use: 'none' },

  // Dining & Kitchen
  dining_table_6: { solid: true, use: 'seat', seat: { x: 0, z: 0.8 } },
  dining_table_10: { solid: true, use: 'seat', seat: { x: 0, z: 1.2 } },
  kitchen_island: { solid: true, use: 'seat', seat: { x: 0, z: 0.6 } },
  cooker: { solid: true, use: 'cook' },
  kerosene_stove: { solid: true, use: 'cook' },
  freezer: { solid: true, use: 'none' },
  double_door_fridge: { solid: true, use: 'drink' },
  microwave_oven: { solid: true, use: 'cook' },
  blender_toaster: { solid: true, use: 'cook' },

  // Bathroom & Spa
  bathtub: { solid: true, use: 'bath' },
  rain_shower: { solid: true, use: 'bath' },
  jacuzzi_spa: { solid: true, use: 'bath' },
  toilet_wc: { solid: true, use: 'seat', seat: { x: 0, z: 0 } },
  bathroom_vanity: { solid: true, use: 'bath' },
  towel_rack: { solid: false, use: 'none', mount: 'wall', elevation: 1.6 },
  washing_machine: { solid: true, use: 'clean' },

  // Entertainment & Music
  tv_75: { solid: true, use: 'tv' },
  ps5_station: { solid: true, use: 'game', seat: { x: 0, z: 0.5 } },
  home_cinema: { solid: true, use: 'tv' },
  snooker_table: { solid: true, use: 'snooker' },
  grand_piano: { solid: true, use: 'music', seat: { x: 0, z: 0.5 } },
  hifi_soundbar: { solid: true, use: 'music' },

  // Work, Studio & Skills
  executive_desk: { solid: true, use: 'work', seat: { x: 0, z: 0.55 } },
  ergonomic_chair: { solid: true, use: 'seat', seat: { x: 0, z: 0 } },
  dual_pc_setup: { solid: true, use: 'work', seat: { x: 0, z: 0.5 } },
  creator_ringlight: { solid: true, use: 'work' },
  bookshelf: { solid: true, use: 'work' },

  // Decor, Rugs & Lighting
  rug_circle: { solid: false, use: 'none' },
  persian_rug: { solid: false, use: 'none' },
  bronze_ife_head: { solid: true, use: 'none' },
  crystal_chandelier: { solid: false, use: 'none', mount: 'wall', elevation: 2.8 },
  floor_lamp: { solid: true, use: 'none' },
  wall_art: { solid: false, use: 'none', mount: 'wall', elevation: 2.0 },
  wall_mirror: { solid: false, use: 'none', mount: 'wall', elevation: 1.8 },
  wall_clock: { solid: false, use: 'none', mount: 'wall', elevation: 2.1 },
  potted_plant: { solid: true, use: 'none' },
  curtains_velvet: { solid: false, use: 'none', mount: 'wall', elevation: 2.4 },

  // Nigerian Power & Household Essentials
  generator_small: { solid: true, use: 'power' },
  generator_big: { solid: true, use: 'power' },
  solar_inverter: { solid: true, use: 'power' },
  standing_fan: { solid: true, use: 'power' },
  split_ac: { solid: false, use: 'power', mount: 'wall', elevation: 2.3 },
  drum_bucket: { solid: true, use: 'bath' },

  // Luxury & Outdoor
  pool_lounger: { solid: true, use: 'seat', seat: { x: 0, z: 0.2 } },
  outdoor_fountain: { solid: true, use: 'none' },
  wine_wall: { solid: true, use: 'drink' },
  home_gym: { solid: true, use: 'fitness' },
  massage_chair: { solid: true, use: 'seat', seat: { x: 0, z: 0.05 } },
  private_helicopter: { solid: true, use: 'none' },
  drinks_trolley: { solid: true, use: 'drink' },
  vintage_gramophone: { solid: true, use: 'music' },
  calabar_chest: { solid: true, use: 'none' },
  benin_bronze_leopard: { solid: true, use: 'none' },
  smart_mirror: { solid: false, use: 'clean', mount: 'wall', elevation: 1.55 },
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

function splitAc(): THREE.Group {
  const b = new Builder();
  // Sleek white indoor split AC unit: body, louver, LED temperature readout
  b.box(0xf8fafc, 1.4, 0.42, 0.28, 0, 0, 0)
    .box(0xe2e8f0, 1.36, 0.08, 0.04, 0, -0.16, 0.14) // bottom air outlet louver
    .box(0x38bdf8, 0.1, 0.04, 0.02, 0.48, 0.05, 0.14, { glow: true }) // cool blue digital temperature glow
    .box(0x1e293b, 0.08, 0.02, 0.01, -0.48, 0.05, 0.14); // subtle brand badge
  return b.build('split_ac');
}

function wallClock(): THREE.Group {
  const b = new Builder();
  // Round brass wall clock
  b.cylinder(0xd4af37, 0.38, 0.06, 0, 0, 0, { sides: 24, pitch: Math.PI / 2 }) // brass outer bezel
    .cylinder(0xffffff, 0.33, 0.02, 0, 0, 0.025, { sides: 24, pitch: Math.PI / 2 }) // white clock face
    .box(0x18181b, 0.02, 0.18, 0.01, 0, 0.08, 0.04) // minute hand pointing up
    .box(0x18181b, 0.12, 0.025, 0.01, 0.05, 0, 0.04) // hour hand pointing at 3
    .cylinder(0xdc2626, 0.02, 0.02, 0, 0, 0.045, { sides: 8, pitch: Math.PI / 2 }); // central red pivot
  return b.build('wall_clock');
}

function wallArt(): THREE.Group {
  const b = new Builder();
  // Framed Benin bronze heritage canvas artwork
  b.box(0x451a03, 1.6, 1.2, 0.06, 0, 0, 0) // rich mahogany frame
    .box(0xfef3c7, 1.44, 1.04, 0.02, 0, 0, 0.025) // textured canvas mount
    .box(0xb45309, 0.6, 0.7, 0.03, 0, 0, 0.04) // bronze relief figure
    .box(0x78350f, 0.3, 0.18, 0.02, 0, 0.38, 0.05) // crown headdress
    .box(0xd97706, 0.9, 0.04, 0.01, 0, -0.4, 0.04); // gold inscribed title plaque
  return b.build('wall_art');
}

function wallMirror(): THREE.Group {
  const b = new Builder();
  // Gilded ornate accent wall mirror
  b.box(0xd4af37, 1.1, 1.5, 0.06, 0, 0, 0) // gold gilded frame
    .box(0xe0f2fe, 0.94, 1.34, 0.02, 0, 0, 0.025) // mirror glass pane
    .box(0xf59e0b, 1.16, 0.08, 0.08, 0, 0.77, 0) // top ornate crest
    .box(0xf59e0b, 1.16, 0.08, 0.08, 0, -0.77, 0); // bottom decorative scroll
  return b.build('wall_mirror');
}

function sectionalSofa(): THREE.Group {
  const b = new Builder();
  b.box(0x18181b, 2.6, 0.42, 1.0, 0, 0, 0)
    .box(0x27272a, 2.6, 0.78, 0.24, 0, 0.42, -0.38)
    .box(0x18181b, 1.1, 0.42, 1.4, 0.75, 0, 1.2)
    .box(0x27272a, 0.24, 0.78, 1.4, 1.18, 0.42, 1.2);
  for (let i = 0; i < 3; i++) {
    b.box(0x3f3f46, 0.76, 0.16, 0.72, -0.8 + i * 0.8, 0.42, 0.08)
      .box(0xf59e0b, 0.72, 0.42, 0.14, -0.8 + i * 0.8, 0.6, -0.2, { pitch: -0.16 });
  }
  b.box(0x3f3f46, 0.94, 0.16, 1.3, 0.75, 0.42, 1.2);
  return b.build('sectional_sofa');
}

function canopyBed(): THREE.Group {
  const b = new Builder();
  const wood = 0x451a03;
  b.box(wood, 2.2, 0.36, 2.4, 0, 0.1, 0)
    .box(wood, 2.24, 1.3, 0.16, 0, 0, -1.16)
    .box(0xf8fafc, 2.08, 0.28, 2.2, 0, 0.46, 0.04);
  for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    b.cylinder(wood, 0.05, 2.4, x * 1.05, 0, z * 1.15, { sides: 8 });
  }
  b.box(wood, 2.2, 0.06, 0.06, 0, 2.37, -1.15)
    .box(wood, 2.2, 0.06, 0.06, 0, 2.37, 1.15)
    .box(wood, 0.06, 0.06, 2.36, -1.05, 2.37, 0)
    .box(wood, 0.06, 0.06, 2.36, 1.05, 2.37, 0)
    .box(0xfef08a, 2.22, 0.22, 2.38, 0, 2.26, 0);
  for (const x of [-0.55, 0.55]) b.box(0xffffff, 0.78, 0.18, 0.46, x, 0.74, -0.74);
  b.box(0xb45309, 2.12, 0.08, 1.4, 0, 0.74, 0.45);
  return b.build('queen_canopy_bed');
}

function gasCooker(): THREE.Group {
  const b = new Builder();
  b.box(0x475569, 0.95, 0.88, 0.75, 0, 0.05, 0)
    .box(0x1e293b, 0.75, 0.5, 0.04, 0, 0.35, 0.38)
    .box(0x94a3b8, 0.65, 0.05, 0.06, 0, 0.65, 0.4)
    .box(0x334155, 0.96, 0.06, 0.76, 0, 0.93, 0);
  for (const [x, z] of [[-0.24, -0.18], [0.24, -0.18], [-0.24, 0.18], [0.24, 0.18]]) {
    b.cylinder(0x09090b, 0.09, 0.02, x, 0.96, z, { sides: 12 });
  }
  for (let k = -3; k <= 3; k += 2) {
    b.cylinder(0x0f172a, 0.025, 0.03, k * 0.12, 0.85, 0.39, { sides: 8, pitch: Math.PI / 2 });
  }
  b.cylinder(0xea580c, 0.2, 0.62, 0.72, 0, 0, { sides: 16 })
    .cylinder(0xea580c, 0.14, 0.12, 0.72, 0.62, 0, { sides: 16 })
    .cylinder(0xd4af37, 0.03, 0.06, 0.72, 0.74, 0, { sides: 8 });
  return b.build('cooker');
}

function doubleDoorFridge(): THREE.Group {
  const b = new Builder();
  b.box(0x94a3b8, 1.1, 1.95, 0.85, 0, 0.04, 0)
    .box(0x64748b, 0.53, 1.25, 0.04, -0.27, 0.72, 0.44)
    .box(0x64748b, 0.53, 1.25, 0.04, 0.27, 0.72, 0.44)
    .box(0x475569, 1.08, 0.6, 0.04, 0, -0.22, 0.44)
    .box(0x0f172a, 0.28, 0.38, 0.02, -0.27, 0.95, 0.47)
    .box(0x38bdf8, 0.2, 0.08, 0.01, -0.27, 1.18, 0.48, { glow: true });
  return b.build('double_door_fridge');
}

function diningTable(seats: 6 | 10): THREE.Group {
  const b = new Builder();
  const len = seats === 10 ? 3.4 : 2.2;
  const marbleColor = seats === 10 ? 0xf8fafc : 0x78350f;
  b.box(marbleColor, 1.1, 0.08, len, 0, 0.74, 0);
  for (const [x, z] of [[-0.45, -len / 2 + 0.2], [0.45, -len / 2 + 0.2], [-0.45, len / 2 - 0.2], [0.45, len / 2 - 0.2]]) {
    b.box(0x1c1917, 0.09, 0.74, 0.09, x, 0, z);
  }
  const chairCountEachSide = seats === 10 ? 4 : 2;
  const step = (len - 0.6) / (chairCountEachSide - 1 || 1);
  for (let c = 0; c < chairCountEachSide; c++) {
    const cz = -len / 2 + 0.3 + c * step;
    for (const side of [-1, 1]) {
      b.box(0x18181b, 0.42, 0.44, 0.42, side * 0.75, 0, cz)
        .box(0x0284c7, 0.44, 0.08, 0.44, side * 0.75, 0.44, cz)
        .box(0x18181b, 0.08, 0.52, 0.44, side * 0.92, 0.52, cz);
    }
  }
  return b.build(`dining_table_${seats}`);
}

function bathtub(): THREE.Group {
  const b = new Builder();
  b.box(0xf8fafc, 1.8, 0.62, 0.88, 0, 0.05, 0)
    .box(0x0284c7, 1.6, 0.48, 0.72, 0, 0.16, 0, { glow: true })
    .cylinder(0xe2e8f0, 0.04, 0.85, 0.85, 0, 0, { sides: 12 });
  return b.build('bathtub');
}

function jacuzzi(): THREE.Group {
  const b = new Builder();
  b.cylinder(0x78350f, 1.35, 0.85, 0, 0, 0, { sides: 8 })
    .cylinder(0xf8fafc, 1.15, 0.86, 0, 0.02, 0, { sides: 16 })
    .cylinder(0x38bdf8, 0.98, 0.68, 0, 0.18, 0, { sides: 16, glow: true });
  for (let a = 0; a < 6; a++) {
    const rad = (a * Math.PI) / 3;
    b.cylinder(0xe2e8f0, 0.04, 0.04, Math.cos(rad) * 0.98, 0.55, Math.sin(rad) * 0.98, { sides: 8 });
  }
  return b.build('jacuzzi_spa');
}

function toiletWc(): THREE.Group {
  const b = new Builder();
  b.box(0xf8fafc, 0.44, 0.44, 0.65, 0, 0, 0.05)
    .box(0xf8fafc, 0.44, 0.48, 0.28, 0, 0.44, -0.22)
    .cylinder(0xe2e8f0, 0.035, 0.02, 0, 0.92, -0.22, { sides: 12 });
  return b.build('toilet_wc');
}

function ps5Station(): THREE.Group {
  const b = new Builder();
  b.box(0x09090b, 1.5, 0.74, 0.75, 0, 0, 0)
    .box(0x6366f1, 1.48, 0.03, 0.03, 0, 0.74, -0.36, { glow: true })
    .box(0x18181b, 0.85, 0.52, 0.05, 0, 0.78, -0.2)
    .box(0xf8fafc, 0.12, 0.38, 0.28, 0.55, 0.75, -0.1)
    .box(0x3b82f6, 0.02, 0.36, 0.02, 0.55, 0.76, 0.04, { glow: true });
  return b.build('ps5_station');
}

function snookerTable(): THREE.Group {
  const b = new Builder();
  b.box(0x5b2c0a, 1.5, 0.78, 2.7, 0, 0, 0)
    .box(0x15803d, 1.34, 0.05, 2.54, 0, 0.78, 0)
    .box(0x78350f, 1.54, 0.08, 0.12, 0, 0.82, -1.34)
    .box(0x78350f, 1.54, 0.08, 0.12, 0, 0.82, 1.34)
    .box(0x78350f, 0.12, 0.08, 2.76, -0.74, 0.82, 0)
    .box(0x78350f, 0.12, 0.08, 2.76, 0.74, 0.82, 0)
    .box(0xdc2626, 0.24, 0.04, 0.24, 0, 0.83, 0.45);
  return b.build('snooker_table');
}

function grandPiano(): THREE.Group {
  const b = new Builder();
  b.box(0x09090b, 1.45, 0.42, 1.6, 0, 0.65, 0)
    .box(0x09090b, 1.48, 0.05, 1.65, 0, 1.05, 0, { pitch: 0.22 })
    .box(0xffffff, 1.15, 0.06, 0.22, 0, 0.72, 0.75);
  for (let k = -5; k <= 5; k++) {
    b.box(0x050505, 0.045, 0.04, 0.14, k * 0.09, 0.76, 0.73);
  }
  b.cylinder(0x09090b, 0.04, 0.65, -0.65, 0, 0.65, { sides: 8 })
    .cylinder(0x09090b, 0.04, 0.65, 0.65, 0, 0.65, { sides: 8 })
    .cylinder(0x09090b, 0.04, 0.65, 0, 0, -0.72, { sides: 8 });
  return b.build('grand_piano');
}

function executiveDesk(): THREE.Group {
  const b = new Builder();
  b.box(0x451a03, 1.8, 0.08, 0.95, 0, 0.74, 0)
    .box(0x311302, 0.45, 0.74, 0.9, -0.65, 0, 0)
    .box(0x311302, 0.45, 0.74, 0.9, 0.65, 0, 0)
    .box(0x18181b, 0.75, 0.01, 0.55, 0, 0.78, 0)
    .cylinder(0xd4af37, 0.06, 0.32, -0.65, 0.78, -0.25, { sides: 12 });
  return b.build('executive_desk');
}

function dualPcSetup(): THREE.Group {
  const b = new Builder();
  b.box(0x18181b, 1.8, 0.74, 0.85, 0, 0, 0)
    .box(0x0f172a, 0.72, 0.44, 0.04, -0.42, 0.78, -0.22, { yaw: 0.12 })
    .box(0x0f172a, 0.72, 0.44, 0.04, 0.42, 0.78, -0.22, { yaw: -0.12 })
    .box(0x22c55e, 0.65, 0.38, 0.01, -0.42, 0.8, -0.2, { yaw: 0.12, glow: true })
    .box(0x38bdf8, 0.65, 0.38, 0.01, 0.42, 0.8, -0.2, { yaw: -0.12, glow: true })
    .box(0x09090b, 0.28, 0.48, 0.48, 0.75, 0.76, 0.1)
    .box(0xa855f7, 0.02, 0.42, 0.42, 0.88, 0.78, 0.1, { glow: true });
  return b.build('dual_pc_setup');
}

function bronzeIfeHead(): THREE.Group {
  const b = new Builder();
  b.box(0x064e3b, 0.44, 0.85, 0.44, 0, 0, 0)
    .cylinder(0xb45309, 0.16, 0.42, 0, 0.85, 0, { sides: 16 })
    .cylinder(0xd97706, 0.18, 0.18, 0, 1.25, 0, { sides: 16 })
    .box(0xfacc15, 0.28, 0.08, 0.02, 0, 0.45, 0.23);
  return b.build('bronze_ife_head');
}

function homeGym(): THREE.Group {
  const b = new Builder();
  b.box(0x18181b, 0.75, 0.2, 1.6, -0.5, 0, 0)
    .box(0x09090b, 0.55, 0.02, 1.3, -0.5, 0.2, 0)
    .box(0x27272a, 0.65, 1.15, 0.1, -0.5, 0.2, 0.75)
    .box(0xef4444, 0.35, 0.15, 0.02, -0.5, 1.1, 0.8, { glow: true })
    .box(0x3f3f46, 0.95, 0.85, 0.45, 0.55, 0, 0);
  return b.build('home_gym');
}

function drumBucket(): THREE.Group {
  const b = new Builder();
  b.cylinder(0x0284c7, 0.45, 0.95, 0, 0, 0, { sides: 20 })
    .cylinder(0x0f172a, 0.46, 0.06, 0, 0.95, 0, { sides: 20 })
    .cylinder(0xdc2626, 0.16, 0.24, 0.55, 0, 0.3, { sides: 14 });
  return b.build('drum_bucket');
}

function smallGen(): THREE.Group {
  const b = new Builder();
  b.box(0x18181b, 0.8, 0.65, 0.55, 0, 0.05, 0)
    .box(0xdc2626, 0.72, 0.22, 0.48, 0, 0.7, 0)
    .cylinder(0x09090b, 0.06, 0.04, 0, 0.92, 0, { sides: 12 })
    .cylinder(0xf59e0b, 0.11, 0.08, 0.42, 0.38, 0, { sides: 12, roll: Math.PI / 2 });
  return b.build('generator_small');
}

function bigGen(): THREE.Group {
  const b = new Builder();
  b.box(0x15803d, 2.4, 1.55, 1.25, 0, 0.08, 0)
    .box(0x09090b, 0.5, 0.3, 0.02, 0.8, 1.0, 0.64)
    .cylinder(0x18181b, 0.1, 0.75, 0.85, 1.6, 0, { sides: 12 });
  return b.build('generator_big');
}

function standingFan(): THREE.Group {
  const b = new Builder();
  b.cylinder(0x0284c7, 0.35, 0.08, 0, 0, 0, { sides: 16 })
    .cylinder(0x0f172a, 0.035, 1.35, 0, 0.08, 0, { sides: 8 })
    .cylinder(0x38bdf8, 0.42, 0.08, 0, 1.45, 0.05, { sides: 16, pitch: Math.PI / 2 });
  return b.build('standing_fan');
}

function rugCircle(): THREE.Group {
  const b = new Builder();
  // Concentric circular woven African rug with border rings and central medallion
  b.cylinder(0xf97316, 1.8, 0.015, 0, 0.008, 0, { sides: 32 })
    .cylinder(0xd97706, 1.3, 0.018, 0, 0.010, 0, { sides: 32 })
    .cylinder(0xfef3c7, 0.7, 0.021, 0, 0.012, 0, { sides: 32 })
    .cylinder(0x92400e, 0.25, 0.024, 0, 0.014, 0, { sides: 24 });
  return b.build('rug_circle');
}

function persianRug(): THREE.Group {
  const b = new Builder();
  // Ornate rectangular rug with multiple layered borders and center medallion
  b.box(0x991b1b, 2.4, 0.015, 3.6, 0, 0.008, 0)
    .box(0x1e3a8a, 2.1, 0.018, 3.3, 0, 0.010, 0)
    .box(0xfef08a, 1.6, 0.021, 2.6, 0, 0.012, 0)
    .box(0x991b1b, 1.1, 0.024, 1.8, 0, 0.014, 0)
    .box(0xd4af37, 0.5, 0.027, 0.9, 0, 0.016, 0);
  return b.build('persian_rug');
}

function drinksTrolley(): THREE.Group {
  const b = new Builder();
  b.cylinder(0xd4af37, 0.02, 0.75, -0.35, 0.02, -0.22, { sides: 8 })
    .cylinder(0xd4af37, 0.02, 0.75, 0.35, 0.02, -0.22, { sides: 8 })
    .cylinder(0xd4af37, 0.02, 0.75, -0.35, 0.02, 0.22, { sides: 8 })
    .cylinder(0xd4af37, 0.02, 0.75, 0.35, 0.02, 0.22, { sides: 8 })
    .cylinder(0x18181b, 0.04, 0.02, -0.35, 0.01, -0.22, { roll: Math.PI / 2, sides: 12 })
    .cylinder(0x18181b, 0.04, 0.02, 0.35, 0.01, -0.22, { roll: Math.PI / 2, sides: 12 })
    .cylinder(0x18181b, 0.04, 0.02, -0.35, 0.01, 0.22, { roll: Math.PI / 2, sides: 12 })
    .cylinder(0x18181b, 0.04, 0.02, 0.35, 0.01, 0.22, { roll: Math.PI / 2, sides: 12 })
    .box(0xd4af37, 0.8, 0.02, 0.52, 0, 0.18, 0)
    .box(0x1e293b, 0.74, 0.015, 0.46, 0, 0.2, 0)
    .box(0xd4af37, 0.8, 0.02, 0.52, 0, 0.72, 0)
    .box(0x1e293b, 0.74, 0.015, 0.46, 0, 0.74, 0)
    .cylinder(0xd4af37, 0.02, 0.48, -0.42, 0.80, 0, { yaw: Math.PI / 2, sides: 8 })
    .cylinder(0x047857, 0.035, 0.2, -0.15, 0.75, 0.08, { sides: 8 })
    .cylinder(0xb45309, 0.04, 0.22, 0.05, 0.75, 0.05, { sides: 8 })
    .cylinder(0xe2e8f0, 0.045, 0.18, 0.2, 0.75, -0.05, { sides: 6 });
  return b.build('drinks_trolley');
}

function vintageGramophone(): THREE.Group {
  const b = new Builder();
  b.box(0x451a03, 0.44, 0.24, 0.44, 0, 0, 0)
    .box(0xd4af37, 0.46, 0.02, 0.46, 0, 0.02, 0)
    .box(0xd4af37, 0.46, 0.02, 0.46, 0, 0.23, 0)
    .cylinder(0xd4af37, 0.16, 0.02, 0, 0.24, 0, { sides: 16 })
    .cylinder(0x09090b, 0.15, 0.008, 0, 0.26, 0, { sides: 16 })
    .cylinder(0xd4af37, 0.03, 0.01, 0, 0.268, 0, { sides: 16 })
    .cylinder(0xd4af37, 0.008, 0.14, 0.1, 0.28, 0.06, { pitch: Math.PI / 4, sides: 8 })
    .cylinder(0xd4af37, 0.015, 0.28, -0.14, 0.24, -0.12, { sides: 8 })
    .cylinder(0xeab308, 0.03, 0.18, -0.1, 0.45, -0.06, { pitch: Math.PI / 4, sides: 12 })
    .cylinder(0xd4af37, 0.12, 0.14, -0.04, 0.55, 0.02, { pitch: Math.PI / 4, sides: 16 });
  return b.build('vintage_gramophone');
}

function calabarChest(): THREE.Group {
  const b = new Builder();
  b.box(0x451a03, 0.95, 0.42, 0.55, 0, 0.04, 0)
    .cylinder(0x27170a, 0.05, 0.04, -0.4, 0, -0.2, { sides: 10 })
    .cylinder(0x27170a, 0.05, 0.04, 0.4, 0, -0.2, { sides: 10 })
    .cylinder(0x27170a, 0.05, 0.04, -0.4, 0, 0.2, { sides: 10 })
    .cylinder(0x27170a, 0.05, 0.04, 0.4, 0, 0.2, { sides: 10 })
    .box(0x5c2408, 0.97, 0.08, 0.57, 0, 0.46, 0)
    .box(0xd4af37, 0.04, 0.44, 0.56, -0.3, 0.04, 0)
    .box(0xd4af37, 0.04, 0.44, 0.56, 0.3, 0.04, 0)
    .box(0xd4af37, 0.08, 0.1, 0.02, 0, 0.25, 0.28);
  return b.build('calabar_chest');
}

function beninBronzeLeopard(): THREE.Group {
  const b = new Builder();
  b.box(0x18181b, 0.4, 0.12, 0.24, 0, 0, 0)
    .box(0x92400e, 0.26, 0.12, 0.12, 0, 0.24, 0)
    .cylinder(0xb45309, 0.025, 0.14, -0.09, 0.12, -0.04, { sides: 8 })
    .cylinder(0xb45309, 0.025, 0.14, 0.09, 0.12, -0.04, { sides: 8 })
    .cylinder(0xb45309, 0.025, 0.14, -0.09, 0.12, 0.04, { sides: 8 })
    .cylinder(0xb45309, 0.025, 0.14, 0.09, 0.12, 0.04, { sides: 8 })
    .box(0xb45309, 0.09, 0.09, 0.1, 0.14, 0.28, 0)
    .cylinder(0x92400e, 0.015, 0.03, 0.15, 0.36, -0.03, { sides: 6 })
    .cylinder(0x92400e, 0.015, 0.03, 0.15, 0.36, 0.03, { sides: 6 })
    .cylinder(0x92400e, 0.018, 0.18, -0.16, 0.26, 0, { pitch: -0.6, sides: 8 });
  return b.build('benin_bronze_leopard');
}

function smartMirror(): THREE.Group {
  const b = new Builder();
  b.box(0x0f172a, 0.72, 1.12, 0.04, 0, 0, 0)
    .box(0x38bdf8, 0.76, 1.16, 0.015, 0, 0, -0.015)
    .box(0xe2e8f0, 0.66, 1.04, 0.015, 0, 0, 0.02)
    .box(0x0284c7, 0.24, 0.06, 0.018, -0.16, 0.38, 0.025)
    .box(0xf59e0b, 0.18, 0.04, 0.018, 0.16, 0.38, 0.025);
  return b.build('smart_mirror');
}

const MAKERS: Record<string, () => THREE.Group> = {
  // Comfort
  sofa_emerald: () => sofa(3, 0x065f46, 0x10b981, 0x064e3b),
  sectional_sofa: sectionalSofa,
  armchair,
  chaise_longue: () => sofa(1, 0x7c2d12, 0xf59e0b, 0x451a03),
  ottoman: () => sofa(1, 0x1e3a8a, 0x3b82f6, 0x0f172a),
  velvet_looveseat: () => sofa(2, 0x991b1b, 0xef4444, 0x450a0a),

  // Bedroom
  king_bed: bed,
  queen_canopy_bed: canopyBed,
  bunk_bed: bed,
  single_bed: bed,
  wardrobe,
  walkin_closet: wardrobe,
  nightstand: () => executiveDesk(),

  // Kitchen & Dining
  dining_table_6: () => diningTable(6),
  dining_table_10: () => diningTable(10),
  kitchen_island: () => diningTable(6),
  cooker: gasCooker,
  kerosene_stove: gasCooker,
  freezer,
  double_door_fridge: doubleDoorFridge,
  microwave_oven: freezer,
  blender_toaster: freezer,

  // Bath & Spa
  bathtub,
  rain_shower: bathtub,
  jacuzzi_spa: jacuzzi,
  toilet_wc: toiletWc,
  bathroom_vanity: () => executiveDesk(),
  towel_rack: splitAc,
  washing_machine: freezer,

  // Entertainment
  tv_75: television,
  ps5_station: ps5Station,
  home_cinema: television,
  snooker_table: snookerTable,
  grand_piano: grandPiano,
  hifi_soundbar: splitAc,

  // Work & Skills
  executive_desk: executiveDesk,
  ergonomic_chair: armchair,
  dual_pc_setup: dualPcSetup,
  creator_ringlight: floorLamp,
  bookshelf,

  // Decor & Lighting
  rug_circle: rugCircle,
  persian_rug: persianRug,
  bronze_ife_head: bronzeIfeHead,
  crystal_chandelier: floorLamp,
  floor_lamp: floorLamp,
  wall_art: wallArt,
  wall_mirror: wallMirror,
  wall_clock: wallClock,
  potted_plant: floorLamp,
  curtains_velvet: wallArt,

  // Nigerian Power & Household
  generator_small: smallGen,
  generator_big: bigGen,
  solar_inverter: inverter,
  standing_fan: standingFan,
  split_ac: splitAc,
  drum_bucket: drumBucket,

  // Luxury & Outdoor
  pool_lounger: () => sofa(1, 0x0284c7, 0x38bdf8, 0x0f172a),
  outdoor_fountain: jacuzzi,
  wine_wall: bookshelf,
  home_gym: homeGym,
  massage_chair: () => sofa(1, 0x18181b, 0xd4af37, 0x09090b),
  private_helicopter: bigGen,
  drinks_trolley: drinksTrolley,
  vintage_gramophone: vintageGramophone,
  calabar_chest: calabarChest,
  benin_bronze_leopard: beninBronzeLeopard,
  smart_mirror: smartMirror,
};

/** A piece of furniture of this kind, or null if the kit has no design for it. */
export function buildFurniture(modelType: string): THREE.Group | null {
  return MAKERS[modelType]?.() ?? null;
}
