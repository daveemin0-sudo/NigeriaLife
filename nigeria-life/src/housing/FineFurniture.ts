import * as THREE from 'three';
import { Builder } from '../world/kit/ArchKit';
import { basin, curvedPanel, duvet, pillow, soft, turned } from '../world/kit/SoftKit';
import { fabric, floorSurface, repeated } from '../graphics/Surfaces';

/**
 * Furniture made to look like the real thing, not like boxes: rounded edges everywhere, a padded
 * headboard with its panel and posts, a mattress with soft corners, plump pillows, a duvet in a
 * damask cloth that drapes over the sides of the bed in folds, sofas with rounded arms and loose
 * cushions, turned wooden legs, a porcelain bath and toilet that curve, a stone worktop, a sink
 * you can see into, a fan with a cage and blades, a lamp with a cloth shade.
 *
 * Each piece faces +z, stands on the floor (y = 0) round its own middle, and is a Group, as the
 * catalogue's makers return. Most of it is merged by the building kit into one vertex-coloured
 * mesh; the cloth of a bed and the stone of a worktop are their own meshes, for their textures.
 */

const GOLD = 0xc9a227;
const CHROME = 0xd1d5db;
const PORCELAIN = 0xf8fafc;

/** Short turned wooden legs: a bun foot, a waist, a collar */
const LEG = (h: number): Array<[number, number]> => [[0.028, 0], [0.04, 0.02], [0.034, h * 0.35], [0.026, h * 0.6], [0.036, h * 0.85], [0.032, h], [0.001, h]];

/** A cloth for a bed: damask, dyed `colour`, repeated over the duvet */
function clothMaterial(colour: number, kind: 'damask' | 'quilt' | 'weave' = 'damask'): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({ color: colour, roughness: 0.88, metalness: 0, map: fabric(kind) ?? undefined, side: THREE.DoubleSide });
}

/**
 * A bed `width` across (1.0 single, 1.6 double, 2.1 king) and 2.3 long: posts and a panelled
 * headboard in wood, a footboard, turned legs, a deep mattress with rounded corners, pillows
 * (two on a wide bed), a folded-back sheet and a damask duvet hanging over three sides.
 * The mattress top is at 0.7 m (where the sleeper lies).
 */
export function fineBed(width: number, cover: number, trim: number, wood: number): THREE.Group {
  const b = new Builder();
  const dark = new THREE.Color(wood).multiplyScalar(0.72).getHex();
  const hl = 1.15;
  // The frame: side rails and end rails, rounded, on four turned legs
  b.shape(wood, soft(width + 0.04, 0.24, 2.24, 0.03), 0, 0.26, 0);
  for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) b.shape(dark, turned(LEG(0.16), 12), x * (width / 2 - 0.05), 0, z * (hl - 0.07));
  // The headboard: two posts with round finials, a top rail, a raised panel between them
  const headH = width > 1.3 ? 1.32 : 1.1;
  // (Everything inside the old bed's outline, width + 0.04 by 2.3: the room's plan is laid out round it)
  for (const side of [-1, 1]) {
    b.shape(dark, soft(0.12, headH, 0.12, 0.025), side * (width / 2 - 0.04), headH / 2, -hl + 0.06);
    b.shape(dark, new THREE.SphereGeometry(0.06, 12, 8), side * (width / 2 - 0.04), headH + 0.04, -hl + 0.06);
  }
  b.shape(dark, soft(width + 0.02, 0.12, 0.12, 0.03), 0, headH - 0.04, -hl + 0.06);
  b.shape(wood, soft(width - 0.06, headH - 0.42, 0.06, 0.02), 0, 0.42 + (headH - 0.46) / 2, -hl + 0.03);
  b.shape(dark, soft(width - 0.32, headH - 0.7, 0.03, 0.015), 0, 0.56 + (headH - 0.74) / 2, -hl + 0.07);
  // The footboard, lower, with its own posts
  for (const side of [-1, 1]) b.shape(dark, soft(0.11, 0.62, 0.11, 0.022), side * (width / 2 - 0.035), 0.31, hl - 0.06);
  b.shape(wood, soft(width - 0.12, 0.34, 0.06, 0.02), 0, 0.4, hl - 0.06);
  // The mattress, deep and soft-cornered, and the sheet folded back over the duvet's head
  b.shape(0xf4f1ea, soft(width - 0.08, 0.24, 2.1, 0.07, 4), 0, 0.58, 0.02);
  b.shape(0xfbfaf7, soft(width - 0.02, 0.045, 0.24, 0.02), 0, 0.735, -0.36);
  // The pillows, plump, leaning a little on the headboard
  const pillows = width > 1.3 ? [-(width / 4 + 0.02), width / 4 + 0.02] : [0];
  const pw = Math.min(0.72, width / pillows.length - 0.14);
  for (const x of pillows) {
    b.shape(0xffffff, pillow(pw, 0.2, 0.46), x, 0.8, -0.82, { pitch: -0.32 });
    b.shape(trim, pillow(pw * 0.78, 0.15, 0.34), x, 0.78, -0.6, { pitch: -0.18 });
  }
  const group = b.build('bed', { roughness: 0.65 });
  // The duvet: its own cloth, over the bottom three quarters of the bed and down its sides
  // Its foot ends inside the footboard, its sides inside the posts
  const cloth = new THREE.Mesh(duvet(width - 0.18, 1.42, 0.28, { folds: 6, puff: 0.05, seed: width * 3 }), clothMaterial(cover));
  cloth.name = 'bed duvet';
  cloth.position.set(0, 0.712, -0.42 + 1.42 / 2);
  cloth.castShadow = true;
  cloth.receiveShadow = true;
  group.add(cloth);
  return group;
}

/**
 * A sofa of `seats` seats (1 is an armchair): a rounded base, rolled arms, a back rail, loose seat
 * and back cushions that dip at the middle, piping, and short turned legs.
 */
export function fineSofa(seats: number, cloth: number, cushion: number, frame: number): THREE.Group {
  const b = new Builder();
  const each = 0.74;
  const inside = seats * each;
  const arm = 0.22;
  const width = inside + arm * 2;
  const darker = new THREE.Color(cloth).multiplyScalar(0.85).getHex();
  // The base and the back, upholstered
  b.shape(cloth, soft(width, 0.32, 0.96, 0.07, 4), 0, 0.26, 0);
  b.shape(cloth, soft(width, 0.62, 0.22, 0.09, 4), 0, 0.62, -0.38);
  // Rolled arms
  for (const side of [-1, 1]) {
    b.shape(cloth, soft(arm, 0.5, 0.98, 0.08, 4), side * (width / 2 - arm / 2), 0.38, 0);
    b.shape(cloth, new THREE.CylinderGeometry(arm * 0.6, arm * 0.6, 0.98, 18).rotateX(Math.PI / 2), side * (width / 2 - arm / 2), 0.63, 0);
  }
  // Cushions: on the seat and against the back, each its own, a little apart
  for (let i = 0; i < seats; i++) {
    const x = -inside / 2 + (i + 0.5) * each;
    b.shape(cushion, soft(each - 0.03, 0.17, 0.72, 0.07, 4), x, 0.5, 0.08);
    b.shape(cushion, pillow(each - 0.06, 0.2, 0.5), x, 0.78, -0.21, { pitch: -1.35 });
  }
  // The piping round the base, and the legs
  b.shape(darker, soft(width + 0.01, 0.03, 0.97, 0.015), 0, 0.11, 0);
  for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) b.shape(frame, turned(LEG(0.1), 10), x * (width / 2 - 0.09), 0, z * 0.4);
  return b.build('sofa', { roughness: 0.85 });
}

/** A two-door wardrobe: a rounded carcass on a plinth, raised panel doors, a mirror on one, brass handles, a cornice */
export function fineWardrobe(): THREE.Group {
  const b = new Builder();
  const wood = 0x7c5a3a;
  const dark = 0x5b4027;
  b.shape(dark, soft(1.84, 0.1, 0.62, 0.015), 0, 0.05, 0);
  b.shape(wood, soft(1.8, 2.06, 0.6, 0.02), 0, 0.1 + 1.03, 0);
  b.shape(dark, soft(1.86, 0.09, 0.64, 0.02), 0, 2.2, 0);
  for (const x of [-0.45, 0.45]) {
    b.shape(0x8b6a47, soft(0.86, 1.94, 0.03, 0.012), x, 0.14 + 0.97, 0.305);
    b.shape(0x7a5b3c, soft(0.66, 0.72, 0.02, 0.01), x, 1.62, 0.322);
    b.shape(0x7a5b3c, soft(0.66, 0.72, 0.02, 0.01), x, 0.66, 0.322);
    b.shape(GOLD, new THREE.CylinderGeometry(0.012, 0.012, 0.26, 8), x - Math.sign(x) * 0.36, 1.14, 0.328);
  }
  b.shape(0xd8e2ea, soft(0.5, 1.2, 0.01, 0.005), -0.45, 1.14, 0.335);
  return b.build('wardrobe', { roughness: 0.55 });
}

/** A tall two-door fridge: rounded steel body, a seam between the doors, long chrome handles, a water display */
export function fineFridge(): THREE.Group {
  const b = new Builder();
  b.shape(0xbfc6cf, soft(1.1, 1.95, 0.82, 0.05, 4), 0, 0.975 + 0.02, 0);
  b.shape(0x9aa3ae, soft(0.012, 1.86, 0.02, 0.004), 0, 1.0, 0.411);
  for (const x of [-0.06, 0.06]) b.shape(CHROME, soft(0.035, 0.9, 0.05, 0.015), x, 1.12, 0.45);
  b.shape(0x0f172a, soft(0.22, 0.32, 0.02, 0.02), -0.3, 1.25, 0.412);
  b.box(0x38bdf8, 0.14, 0.05, 0.01, -0.3, 1.32, 0.423, { glow: true });
  b.shape(0x1f2937, soft(1.06, 0.06, 0.78, 0.02), 0, 0.03, 0);
  return b.build('double_door_fridge', { roughness: 0.3 });
}

/** A freestanding porcelain bath, its inside curving down to the bottom, with a chrome mixer and a drain */
export function fineBathtub(): THREE.Group {
  const b = new Builder();
  b.shape(PORCELAIN, basin(1.78, 0.86, 0.6, 0.1, 48), 0, 0, 0);
  // Four clawed feet, gilt
  for (const [x, z] of [[-0.66, -0.28], [0.66, -0.28], [-0.66, 0.28], [0.66, 0.28]]) b.shape(GOLD, new THREE.SphereGeometry(0.05, 10, 8), x, 0.02, z);
  // The mixer at the head, standing on the rim, and the drain
  b.shape(CHROME, new THREE.CylinderGeometry(0.02, 0.025, 0.24, 10), -0.78, 0.6, 0);
  b.shape(CHROME, new THREE.TorusGeometry(0.08, 0.016, 8, 16, Math.PI), -0.72, 0.84, 0, { pitch: 0, roll: Math.PI / 2 });
  b.shape(0x9ca3af, new THREE.CylinderGeometry(0.035, 0.035, 0.005, 12), 0.55, 0.07, 0);
  return b.build('bathtub', { roughness: 0.18 });
}

/** A close-coupled toilet: a pedestal and an oval pan you can see into, a seat and lid, the cistern and its button */
export function fineToilet(): THREE.Group {
  const b = new Builder();
  // The pedestal, turned and stretched to an oval
  const foot = turned([[0.13, 0], [0.12, 0.05], [0.1, 0.2], [0.13, 0.32], [0.001, 0.32]], 24);
  foot.scale(1, 1, 1.35);
  b.shape(PORCELAIN, foot, 0, 0, 0.05);
  b.shape(PORCELAIN, basin(0.38, 0.5, 0.12, 0.12, 32), 0, 0.3, 0.08);
  // The seat ring and the lid, raised against the cistern
  const ring = new THREE.TorusGeometry(0.17, 0.025, 8, 28);
  ring.rotateX(Math.PI / 2);
  ring.scale(1, 1, 1.3);
  b.shape(0xffffff, ring, 0, 0.43, 0.09);
  b.shape(0xffffff, soft(0.38, 0.46, 0.03, 0.015), 0, 0.66, -0.14, { pitch: -0.12 });
  // The cistern, and the chrome button on its top
  b.shape(PORCELAIN, soft(0.44, 0.4, 0.2, 0.04, 4), 0, 0.62, -0.24);
  b.shape(CHROME, new THREE.CylinderGeometry(0.035, 0.035, 0.015, 14), 0, 0.825, -0.24);
  return b.build('toilet_wc', { roughness: 0.18 });
}

/** A standing fan: a weighted base, a stem, the motor, three blades behind a round cage */
export function fineFan(colour = 0x0284c7): THREE.Group {
  const b = new Builder();
  b.shape(colour, turned([[0.3, 0], [0.31, 0.02], [0.28, 0.05], [0.08, 0.07], [0.001, 0.07]], 28), 0, 0, 0);
  b.shape(0x1f2937, new THREE.CylinderGeometry(0.02, 0.025, 1.3, 10), 0, 0.72, 0);
  b.shape(0x1f2937, soft(0.14, 0.14, 0.2, 0.06), 0, 1.42, -0.06);
  // A new blade each time: the kit moves a part in place, so one shape cannot be put down twice
  for (let k = 0; k < 3; k++) {
    const a = (k * Math.PI * 2) / 3;
    b.shape(colour, soft(0.22, 0.012, 0.1, 0.005), Math.cos(a) * 0.13, 1.45 + Math.sin(a) * 0.13, 0.06, { pitch: Math.PI / 2, roll: a });
  }
  for (const z of [0.02, 0.1]) {
    const cage = new THREE.TorusGeometry(0.29, 0.006, 6, 40);
    b.shape(0x94a3b8, cage, 0, 1.45, z);
  }
  for (let k = 0; k < 12; k++) {
    const a = (k * Math.PI * 2) / 12;
    b.shape(0x94a3b8, new THREE.CylinderGeometry(0.004, 0.004, 0.29, 4), Math.cos(a) * 0.145, 1.45 + Math.sin(a) * 0.145, 0.11, { roll: a + Math.PI / 2 });
  }
  return b.build('standing_fan', { roughness: 0.45 });
}

/** A floor lamp: a turned base, a slim stem, a pleated cloth shade glowing warm */
export function fineLamp(): THREE.Group {
  const b = new Builder();
  b.shape(0x1c1917, turned([[0.17, 0], [0.18, 0.02], [0.14, 0.05], [0.04, 0.08], [0.02, 0.1], [0.001, 0.1]], 24), 0, 0, 0);
  b.shape(0xb08d57, new THREE.CylinderGeometry(0.014, 0.014, 1.42, 8), 0, 0.8, 0);
  b.shape(0xfff1d0, new THREE.CylinderGeometry(0.15, 0.24, 0.38, 24, 1, true), 0, 1.66, 0, { glow: true });
  b.shape(0xb08d57, new THREE.TorusGeometry(0.24, 0.006, 6, 24).rotateX(Math.PI / 2), 0, 1.47, 0);
  return b.build('floor lamp', { roughness: 0.6 });
}

/** A dining table with a rounded top on turned legs, and chairs with curved backs and padded seats */
export function fineDining(seats: 6 | 10, top: number, seat: number): THREE.Group {
  const b = new Builder();
  const len = seats === 10 ? 3.4 : 2.2;
  b.shape(top, soft(1.1, 0.06, len, 0.03), 0, 0.75, 0);
  b.shape(new THREE.Color(top).multiplyScalar(0.8).getHex(), soft(0.96, 0.08, len - 0.16, 0.02), 0, 0.68, 0);
  for (const [x, z] of [[-0.45, -len / 2 + 0.2], [0.45, -len / 2 + 0.2], [-0.45, len / 2 - 0.2], [0.45, len / 2 - 0.2]]) b.shape(0x3f2a17, turned(LEG(0.72), 12), x, 0, z);
  const each = seats === 10 ? 4 : 2;
  const step = (len - 0.6) / (each - 1 || 1);
  for (let c = 0; c < each; c++) {
    const cz = -len / 2 + 0.3 + c * step;
    for (const side of [-1, 1]) {
      const cx = side * 0.74;
      for (const [lx, lz] of [[-0.17, -0.17], [0.17, -0.17], [-0.17, 0.17], [0.17, 0.17]]) b.shape(0x3f2a17, new THREE.CylinderGeometry(0.018, 0.016, 0.44, 8), cx + lx, 0.22, cz + lz);
      b.shape(seat, soft(0.44, 0.07, 0.44, 0.03), cx, 0.47, cz);
      // The back, curved toward the sitter, on the side away from the table
      b.shape(0x3f2a17, curvedPanel(0.44, 0.46, 0.04, 0.05, 0.02), cx + side * 0.19, 0.76, cz, { yaw: side * Math.PI / 2 });
    }
  }
  return b.build(`dining_table_${seats}`, { roughness: 0.5 });
}

/**
 * A run of kitchen base units `w` long and `d` deep: a carcass on a recessed plinth, shaker doors
 * with brushed handles, a stone worktop (its own mesh, for the granite), and wall units above.
 */
export function fineCounter(w: number, d: number): THREE.Group {
  const b = new Builder();
  const carcass = 0x6f4a2f;
  const door = 0x7b5434;
  b.shape(0x2a2018, soft(w - 0.04, 0.1, d - 0.08, 0.01), 0, 0.05, -0.03);
  b.shape(carcass, soft(w, 0.76, d - 0.03, 0.012), 0, 0.1 + 0.38, -0.015);
  const doors = Math.max(1, Math.round(w / 0.6));
  const dw = w / doors;
  for (let i = 0; i < doors; i++) {
    const x = -w / 2 + (i + 0.5) * dw;
    b.shape(door, soft(dw - 0.04, 0.68, 0.022, 0.008), x, 0.12 + 0.34, d / 2 - 0.02);
    b.shape(new THREE.Color(door).multiplyScalar(0.88).getHex(), soft(dw - 0.18, 0.5, 0.01, 0.005), x, 0.46, d / 2 - 0.005);
    b.shape(CHROME, soft(0.12, 0.014, 0.022, 0.006), x, 0.72, d / 2 + 0.012);
  }
  // Wall units above the worktop
  b.shape(carcass, soft(w, 0.62, 0.34, 0.012), 0, 1.6 + 0.31, -d / 2 + 0.17);
  for (let i = 0; i < doors; i++) {
    const x = -w / 2 + (i + 0.5) * dw;
    b.shape(door, soft(dw - 0.04, 0.56, 0.02, 0.008), x, 1.91, -d / 2 + 0.345);
    b.shape(CHROME, soft(0.014, 0.1, 0.022, 0.006), x + dw / 2 - 0.08, 1.7, -d / 2 + 0.36);
  }
  const group = b.build('kitchen counter', { roughness: 0.55 });
  // The worktop: polished granite
  const granite = floorSurface('grey_granite').map;
  const top = new THREE.Mesh(soft(w + 0.04, 0.045, d + 0.03, 0.012), new THREE.MeshStandardMaterial({ color: 0x8d8f94, roughness: 0.22, map: repeated(granite, w / 1.2, d / 1.2) ?? undefined }));
  top.position.set(0, 0.885, 0);
  top.name = 'worktop';
  group.add(top);
  return group;
}

/** A sink set into the worktop: a ceramic basin you see into, and a swan-neck mixer tap */
export function fineSink(): THREE.Group {
  const b = new Builder();
  b.shape(PORCELAIN, basin(0.56, 0.4, 0.2, 0.08, 36), 0, 0.72, 0.02);
  b.shape(CHROME, new THREE.CylinderGeometry(0.022, 0.026, 0.06, 12), 0, 0.92, -0.17);
  b.shape(CHROME, new THREE.CylinderGeometry(0.014, 0.014, 0.26, 10), 0, 1.06, -0.17);
  b.shape(CHROME, new THREE.TorusGeometry(0.07, 0.014, 8, 16, Math.PI), 0, 1.19, -0.1, { yaw: Math.PI / 2 });
  b.shape(CHROME, soft(0.06, 0.02, 0.03, 0.008), 0.06, 0.96, -0.17);
  return b.build('kitchen sink', { roughness: 0.2 });
}

/** A basin on a pedestal, with a mirror over it */
export function fineBasin(wallBack: number): THREE.Group {
  const b = new Builder();
  const ped = turned([[0.1, 0], [0.11, 0.04], [0.07, 0.3], [0.06, 0.6], [0.09, 0.72], [0.001, 0.72]], 20);
  ped.scale(1, 1, 0.8);
  b.shape(PORCELAIN, ped, 0, 0, -0.02);
  b.shape(PORCELAIN, basin(0.54, 0.42, 0.16, 0.1, 36), 0, 0.7, 0);
  b.shape(CHROME, new THREE.CylinderGeometry(0.016, 0.02, 0.14, 10), 0, 0.86, -0.15);
  b.shape(CHROME, soft(0.02, 0.02, 0.1, 0.008), 0, 0.92, -0.11);
  b.shape(0xd8e6f0, soft(0.5, 0.66, 0.02, 0.03), 0, 1.36, wallBack);
  b.shape(0xb08d57, soft(0.56, 0.72, 0.015, 0.035), 0, 1.36, wallBack - 0.012);
  return b.build('basin', { roughness: 0.2 });
}
