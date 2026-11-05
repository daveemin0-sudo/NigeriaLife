import * as THREE from 'three';
import { bakeToGeometry, seededRandom } from '../graphics/MeshBaker';
import { MaterialLibrary } from '../materials/MaterialLibrary';

export type BuildingStyle = 'bank' | 'shop' | 'flats' | 'house' | 'eatery';

export interface FacadeSpec {
  style: BuildingStyle;
  /** Which way the street front faces, as a turn about Y: π/2 faces +X, -π/2 faces -X, 0 faces +Z */
  facing: number;
  /** Storeys; worked out from the height when left out */
  floors?: number;
  /** Paint of the lower band of the walls, awnings and other touches of colour */
  accent: number;
  /** Colour of bands, frames, columns and copings */
  trim?: number;
  /** Windows across the front on each floor; 0 where a signboard or glazing already fills the front */
  frontBays?: number;
  /** Front windows start no lower than this, and end no higher than `frontTop` (to clear a signboard that is already there) */
  frontFrom?: number;
  frontTop?: number;
  /** The ground floor front is already a shopfront or glass wall: leave it clear */
  openGround?: boolean;
  /** A flat roof with a parapet and what collects on roofs; false where there is already a pitched roof */
  flatRoof?: boolean;
  /** How far along the front, from its middle, an existing door is; the wall detail leaves a gap for it */
  doorAt?: number;
}

const solidMaterial = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85 });
const paints = new Map<number, THREE.MeshStandardMaterial>();
const paint = (color: number) => {
  let material = paints.get(color);
  if (!material) {
    material = new THREE.MeshStandardMaterial({ color });
    paints.set(color, material);
  }
  return material;
};

const IRON = 0x1f2937;
const TANK = 0x111827;
const STEEL = 0x94a3b8;
const WOOD = 0x6b3f1d;
const DOOR_GAP = 2.2;

/** The largest plain block in a building: its walls are what get dressed. */
function mainBlock(group: THREE.Object3D): { size: THREE.Vector3; center: THREE.Vector3 } | null {
  let best: THREE.Mesh | null = null;
  let bestVolume = 0;
  for (const child of group.children) {
    const mesh = child as THREE.Mesh;
    const params = (mesh.geometry as THREE.BoxGeometry | undefined)?.parameters;
    if (!mesh.isMesh || mesh.geometry?.type !== 'BoxGeometry' || !params) continue;
    const volume = params.width * params.height * params.depth;
    if (volume > bestVolume) {
      bestVolume = volume;
      best = mesh;
    }
  }
  if (!best) return null;
  const params = (best.geometry as THREE.BoxGeometry).parameters;
  return { size: new THREE.Vector3(params.width, params.height, params.depth), center: best.position.clone() };
}

/**
 * Gives a plain block of a building its architecture: a painted lower band, floor bands and
 * corner piers, framed windows with sills, hoods and burglar bars, balconies, a porch or
 * shop awning to suit what it is, and a roof with a parapet, a water tank and a dish.
 * All of it is baked into two meshes (walls-and-trim, and glass), so a building costs two
 * draw calls more however much detail it carries.
 */
export function dressBuilding(group: THREE.Group, spec: FacadeSpec): void {
  const block = mainBlock(group);
  if (!block) return;

  const facesX = Math.abs(Math.sin(spec.facing)) > 0.5;
  const W = facesX ? block.size.z : block.size.x; // across the street front
  const D = facesX ? block.size.x : block.size.z; // front to back
  const H = block.size.y;
  const base = block.center.y - H / 2;
  const floors = spec.floors ?? Math.max(1, Math.round(H / 3.4));
  const floorH = H / floors;
  const trim = spec.trim ?? 0xe7e2d6;
  const random = seededRandom(Math.round(W * 131 + D * 71 + H * 17 + spec.accent));

  // Everything is laid out facing +Z and turned to the street afterwards
  const frame = new THREE.Group();
  frame.position.set(block.center.x, base, block.center.z);
  frame.rotation.y = spec.facing;
  group.add(frame);
  const solid = new THREE.Group();
  const glass = new THREE.Group();
  frame.add(solid, glass);

  const box = (into: THREE.Object3D, color: number, w: number, h: number, d: number, x: number, y: number, z: number): THREE.Mesh => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), paint(color));
    mesh.position.set(x, y, z);
    into.add(mesh);
    return mesh;
  };

  /** A spot on one of the four walls, as a group whose +Z points out of the wall. */
  type Side = 'front' | 'back' | 'left' | 'right';
  const onWall = (side: Side, along: number, y: number): THREE.Group => {
    const spot = new THREE.Group();
    if (side === 'front') spot.position.set(along, y, D / 2);
    else if (side === 'back') { spot.position.set(-along, y, -D / 2); spot.rotation.y = Math.PI; }
    else if (side === 'right') { spot.position.set(W / 2, y, -along); spot.rotation.y = Math.PI / 2; }
    else { spot.position.set(-W / 2, y, along); spot.rotation.y = -Math.PI / 2; }
    solid.add(spot);
    return spot;
  };
  const wallLength = (side: Side) => (side === 'front' || side === 'back' ? W : D);
  const doorAt = spec.doorAt ?? 0;

  // --- Painted lower band, floor bands, corner piers --------------------------------------
  const dadoH = Math.min(1.05, floorH * 0.34);
  for (const side of ['front', 'back', 'left', 'right'] as Side[]) {
    const length = wallLength(side);
    if (side === 'front' && spec.openGround) continue;
    if (side === 'front') {
      // Leave the doorway clear
      const left = doorAt - DOOR_GAP / 2 + W / 2;
      const right = W / 2 - (doorAt + DOOR_GAP / 2);
      if (left > 0.3) box(onWall(side, -W / 2 + left / 2, dadoH / 2), spec.accent, left, dadoH, 0.05, 0, 0, 0);
      if (right > 0.3) box(onWall(side, W / 2 - right / 2, dadoH / 2), spec.accent, right, dadoH, 0.05, 0, 0, 0);
    } else {
      box(onWall(side, 0, dadoH / 2), spec.accent, length + 0.05, dadoH, 0.05, 0, 0, 0);
    }
  }
  for (let floor = 1; floor < floors; floor++) {
    for (const side of ['front', 'back', 'left', 'right'] as Side[]) {
      box(onWall(side, 0, floor * floorH), trim, wallLength(side) + 0.16, 0.16, 0.14, 0, 0, 0);
    }
  }
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      box(solid, trim, 0.42, H, 0.42, sx * (W / 2 - 0.14), H / 2, sz * (D / 2 - 0.14));
    }
  }

  // --- Windows ---------------------------------------------------------------------------
  const homely = spec.style === 'flats' || spec.style === 'house' || spec.style === 'eatery';
  const winW = homely ? 1.25 : 1.7;
  const winH = Math.min(homely ? 1.3 : 1.55, floorH * 0.46);

  const windowAt = (side: Side, along: number, y: number, width = winW, height = winH): void => {
    const spot = onWall(side, along, y);
    const pane = new THREE.Mesh(new THREE.BoxGeometry(width, height, 0.04), paint(0x1b2a38));
    const paneSpot = new THREE.Group();
    paneSpot.position.copy(spot.position);
    paneSpot.rotation.copy(spot.rotation);
    glass.add(paneSpot);
    pane.position.z = 0.03;
    paneSpot.add(pane);

    box(spot, trim, width + 0.18, 0.09, 0.12, 0, height / 2 + 0.045, 0.06);
    box(spot, trim, width + 0.18, 0.09, 0.12, 0, -height / 2 - 0.045, 0.06);
    for (const sx of [-1, 1]) box(spot, trim, 0.09, height, 0.12, sx * (width / 2 + 0.045), 0, 0.06);
    box(spot, trim, 0.05, height, 0.07, 0, 0, 0.065);
    // Sill, and the concrete hood that keeps the rain and the sun off
    box(spot, trim, width + 0.36, 0.07, 0.24, 0, -height / 2 - 0.12, 0.12);
    if (homely) {
      box(spot, trim, width + 0.4, 0.08, 0.34, 0, height / 2 + 0.16, 0.17);
      // Burglar bars
      for (let i = 1; i <= 4; i++) box(spot, IRON, 0.025, height, 0.025, -width / 2 + (width * i) / 5, 0, 0.11);
      box(spot, IRON, width, 0.025, 0.025, 0, 0, 0.11);
    } else {
      box(spot, trim, width, 0.05, 0.07, 0, height * 0.18, 0.065);
    }
    // A split-unit compressor under some of them
    if (random() < 0.3) {
      box(spot, 0xe5e7eb, 0.82, 0.55, 0.34, width * 0.2, -height / 2 - 0.55, 0.19);
      box(spot, 0x475569, 0.5, 0.4, 0.02, width * 0.2 + 0.08, -height / 2 - 0.55, 0.365);
    }
  };

  const balconyFront = spec.style === 'flats';
  const frontBays = spec.frontBays ?? Math.max(2, Math.round(W / 3.4));
  for (let floor = 0; floor < floors; floor++) {
    const y = floor * floorH + floorH * 0.56;
    // Front
    const clearOfSign = y - winH / 2 >= (spec.frontFrom ?? 0) && y + winH / 2 <= (spec.frontTop ?? Infinity);
    if (frontBays > 0 && clearOfSign && !(floor === 0 && spec.openGround)) {
      for (let bay = 0; bay < frontBays; bay++) {
        const along = -W / 2 + (W * (bay + 0.5)) / frontBays;
        if (floor === 0 && Math.abs(along - doorAt) < DOOR_GAP / 2 + winW / 2) continue;
        if (floor > 0 && balconyFront && Math.abs(along) < 0.9) continue; // the balcony door is there
        windowAt('front', along, y);
      }
    }
    // Sides and back: fewer, and none on a ground floor that backs onto a yard wall
    const sideBays = Math.max(1, Math.round(D / 4.2));
    for (const side of ['left', 'right'] as Side[]) {
      for (let bay = 0; bay < sideBays; bay++) windowAt(side, -D / 2 + (D * (bay + 0.5)) / sideBays, y);
    }
    if (floor > 0) {
      const backBays = Math.max(1, Math.round(W / 4.5));
      for (let bay = 0; bay < backBays; bay++) windowAt('back', -W / 2 + (W * (bay + 0.5)) / backBays, y, winW * 0.8, winH * 0.8);
    }
  }

  // --- Balconies (blocks of flats) -------------------------------------------------------
  if (balconyFront) {
    const span = W * 0.62;
    for (let floor = 1; floor < floors; floor++) {
      const y = floor * floorH;
      const deck = onWall('front', 0, y);
      box(deck, trim, span, 0.14, 1.2, 0, 0.02, 0.6);
      box(deck, IRON, span, 0.06, 0.06, 0, 0.98, 1.17);
      for (const sx of [-1, 1]) box(deck, IRON, 0.06, 0.06, 1.2, sx * (span / 2 - 0.03), 0.98, 0.6);
      const balusters = Math.floor(span / 0.24);
      for (let i = 0; i <= balusters; i++) box(deck, IRON, 0.03, 0.9, 0.03, -span / 2 + (span * i) / balusters, 0.5, 1.17);
      for (const sx of [-1, 1]) {
        for (let i = 1; i < 5; i++) box(deck, IRON, 0.03, 0.9, 0.03, sx * (span / 2 - 0.03), 0.5, i * 0.24);
      }
      // The door onto it
      box(deck, WOOD, 0.95, 2.1, 0.08, 0, 1.12, 0.05);
      box(deck, trim, 1.15, 0.1, 0.12, 0, 2.22, 0.06);
      // Washing hung out on some of them
      if (random() < 0.6) {
        const washing = [0xdc2626, 0xf8fafc, 0x2563eb, 0xfacc15, 0x16a34a];
        for (let i = 0; i < 4; i++) box(deck, washing[Math.floor(random() * washing.length)], 0.42, 0.6, 0.02, -span * 0.3 + i * 0.55 + span * 0.12, 0.62, 1.06);
      }
    }
    // Stair core behind a screen of pierced concrete blocks
    const screenX = -W / 2 + 1.5;
    const screen = onWall('front', screenX, H / 2);
    box(screen, 0x3f3a36, 1.5, H - 1.2, 0.04, 0, 0, 0.02);
    const rows = Math.floor((H - 1.4) / 0.34);
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < 4; col++) {
        if ((row + col) % 2 === 0) box(screen, trim, 0.28, 0.24, 0.12, -0.54 + col * 0.36, -(H - 1.4) / 2 + row * 0.34 + 0.17, 0.07);
      }
    }
  }

  // --- The way in ------------------------------------------------------------------------
  if (spec.style === 'bank') {
    // A portico: four square columns carrying a deep slab, up three steps
    const portico = onWall('front', doorAt, 0);
    const colH = Math.min(4.4, floorH * 1.15);
    const span = Math.min(5.2, W * 0.5);
    for (const x of [-span * 0.42, -span * 0.14, span * 0.14, span * 0.42]) {
      box(portico, trim, 0.5, colH, 0.5, x, colH / 2, 1.2);
      box(portico, trim, 0.68, 0.16, 0.68, x, 0.08, 1.2);
      box(portico, trim, 0.68, 0.18, 0.68, x, colH - 0.09, 1.2);
    }
    box(portico, trim, span, 0.45, 1.7, 0, colH + 0.22, 0.85);
    box(portico, spec.accent, span + 0.06, 0.12, 1.76, 0, colH + 0.5, 0.85);
    for (let step = 0; step < 2; step++) box(portico, 0xbdb6a8, span + step * 0.5, 0.14, 0.4, 0, 0.07 + (1 - step) * 0.14, 1.5 + step * 0.4);
    // A flagpole on the roof
    const pole = onWall('front', W * 0.3, H);
    box(pole, STEEL, 0.06, 3.2, 0.06, 0, 1.6, -0.4);
    for (const [i, color] of [0x008751, 0xffffff, 0x008751].entries()) box(pole, color, 0.42, 0.8, 0.02, 0.24 + i * 0.42, 2.75, -0.4);
  } else if (spec.style === 'shop') {
    const front = onWall('front', 0, 0);
    // Striped awning over the shopfront
    const stripes = Math.max(6, Math.round(W / 0.9));
    const awningY = Math.min(3.05, floorH * 0.8);
    for (let i = 0; i < stripes; i++) {
      const stripe = box(front, i % 2 === 0 ? spec.accent : 0xf8fafc, (W * 0.94) / stripes, 0.07, 1.7, -W * 0.47 + (W * 0.94 * (i + 0.5)) / stripes, awningY, 0.85);
      stripe.rotation.x = 0.2;
    }
    box(front, spec.accent, W * 0.94, 0.24, 0.05, 0, awningY - 0.3, 1.66);
    for (const sx of [-1, 1]) box(front, IRON, 0.05, 0.05, 1.6, sx * W * 0.46, awningY - 0.12, 0.8);
    // A step up from the pavement, and crates stacked beside the door
    box(front, 0xbdb6a8, W * 0.8, 0.12, 0.9, 0, 0.06, 0.45);
    const crates = [0xdc2626, 0x2563eb, 0xfacc15, 0x15803d];
    for (let i = 0; i < 3; i++) {
      box(front, crates[Math.floor(random() * crates.length)], 0.5, 0.34, 0.36, W * 0.4 - 0.1, 0.29 + i * 0.35, 0.5);
    }
    if (!spec.openGround) {
      // A proper shop door where the front was a blank wall
      const way = onWall('front', doorAt, 0);
      box(way, 0x1b2a38, 1.3, 2.3, 0.06, 0, 1.27, 0.04);
      for (const sx of [-1, 1]) box(way, trim, 0.1, 2.4, 0.12, sx * 0.7, 1.32, 0.06);
      box(way, trim, 1.5, 0.1, 0.12, 0, 2.47, 0.06);
      box(way, STEEL, 0.04, 0.5, 0.05, 0.45, 1.25, 0.09);
    }
  } else if (spec.style === 'house') {
    const porch = onWall('front', doorAt, 0);
    for (const sx of [-1, 1]) box(porch, trim, 0.32, 2.7, 0.32, sx * 1.5, 1.35, 1.5);
    box(porch, trim, 3.6, 0.22, 2.0, 0, 2.81, 0.95);
    box(porch, spec.accent, 3.7, 0.1, 2.1, 0, 2.97, 0.95);
    box(porch, 0xbdb6a8, 3.4, 0.14, 1.9, 0, 0.07, 0.95);
    box(porch, WOOD, 1.05, 2.15, 0.08, 0, 1.2, 0.05);
    box(porch, trim, 1.3, 0.1, 0.12, 0, 2.32, 0.06);
  } else if (spec.style === 'eatery') {
    // A bench against the wall and a board with the day's food chalked on it
    const beside = doorAt + 2.2 < W / 2 - 1 ? doorAt + 2.2 : doorAt - 2.2;
    const wall = onWall('front', beside, 0);
    box(wall, WOOD, 1.7, 0.08, 0.4, 0, 0.46, 0.3);
    for (const sx of [-1, 1]) box(wall, WOOD, 0.08, 0.46, 0.36, sx * 0.75, 0.23, 0.3);
    box(wall, 0x111827, 1.1, 0.8, 0.05, 0, 1.75, 0.04);
    box(wall, trim, 1.2, 0.06, 0.07, 0, 2.18, 0.05);
    for (let i = 0; i < 4; i++) box(wall, 0xf8fafc, 0.6 + random() * 0.3, 0.035, 0.01, -0.05, 2.0 - i * 0.15, 0.07);
  } else {
    // Flats: a canopy over the common entrance
    const entrance = onWall('front', doorAt, 0);
    box(entrance, WOOD, 1.2, 2.2, 0.08, 0, 1.1, 0.05);
    box(entrance, trim, 2.6, 0.16, 1.3, 0, 2.5, 0.65);
    box(entrance, 0xbdb6a8, 2.4, 0.14, 1.1, 0, 0.07, 0.55);
  }

  // --- Roof ------------------------------------------------------------------------------
  if (spec.flatRoof !== false) {
    const roof = new THREE.Group();
    roof.position.y = H;
    solid.add(roof);
    // Parapet with a coping
    box(roof, trim, W + 0.2, 0.62, 0.2, 0, 0.31, D / 2);
    box(roof, trim, W + 0.2, 0.62, 0.2, 0, 0.31, -D / 2);
    box(roof, trim, 0.2, 0.62, D + 0.2, W / 2, 0.31, 0);
    box(roof, trim, 0.2, 0.62, D + 0.2, -W / 2, 0.31, 0);
    box(roof, 0xcfc8ba, W + 0.4, 0.08, 0.36, 0, 0.66, D / 2);
    box(roof, 0xcfc8ba, W + 0.4, 0.08, 0.36, 0, 0.66, -D / 2);
    box(roof, 0xcfc8ba, 0.36, 0.08, D + 0.4, W / 2, 0.66, 0);
    box(roof, 0xcfc8ba, 0.36, 0.08, D + 0.4, -W / 2, 0.66, 0);

    // The stair head, with its door
    const headX = -W / 2 + 1.7;
    const headZ = -D / 2 + 1.9;
    box(roof, trim, 2.3, 2.3, 2.7, headX, 1.15, headZ);
    box(roof, 0xcfc8ba, 2.6, 0.12, 3.0, headX, 2.36, headZ);
    box(roof, WOOD, 0.9, 1.9, 0.06, headX, 0.95, headZ + 1.38);

    // A water tank on a steel stand
    const tankX = W / 2 - 1.7;
    const tankZ = -D / 2 + 1.8;
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) box(roof, STEEL, 0.08, 1.5, 0.08, tankX + sx * 0.7, 0.75, tankZ + sz * 0.7);
    }
    box(roof, STEEL, 1.7, 0.08, 1.7, tankX, 1.54, tankZ);
    const tank = new THREE.Mesh(new THREE.CylinderGeometry(0.82, 0.86, 1.7, 14), paint(TANK));
    tank.position.set(tankX, 2.43, tankZ);
    roof.add(tank);
    const lid = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.82, 0.25, 14), paint(TANK));
    lid.position.set(tankX, 3.4, tankZ);
    roof.add(lid);

    // A dish pointed at the sky, and condensers along the parapet
    const dish = new THREE.Mesh(new THREE.SphereGeometry(0.55, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2.6), paint(0xe2e8f0));
    dish.position.set(W / 2 - 1.2, 1.25, D / 2 - 1.3);
    dish.rotation.set(Math.PI - 0.7, 0.6, 0);
    roof.add(dish);
    box(roof, STEEL, 0.06, 0.9, 0.06, W / 2 - 1.2, 0.45, D / 2 - 1.3);
    for (let i = 0; i < 2; i++) {
      box(roof, 0xe5e7eb, 0.95, 0.7, 0.42, -W * 0.1 + i * 1.5, 0.35, D / 2 - 0.7);
    }
    if (spec.style === 'bank' || spec.style === 'shop') {
      // Solar panels for when the light goes
      for (let i = 0; i < 3; i++) {
        const panel = box(roof, 0x1e3a8a, 1.3, 0.05, 2.1, -1.6 + i * 1.5, 0.55, 0.4);
        panel.rotation.x = -0.32;
      }
    }
  }

  // --- Bake ------------------------------------------------------------------------------
  const solidGeometry = bakeToGeometry(solid, { space: frame });
  const glassGeometry = bakeToGeometry(glass, { space: frame });
  frame.remove(solid, glass);
  for (const temp of [solid, glass]) {
    temp.traverse((child) => {
      const mesh = child as THREE.Mesh;
      if (mesh.isMesh) mesh.geometry.dispose();
    });
  }
  if (solidGeometry) {
    const mesh = new THREE.Mesh(solidGeometry, solidMaterial);
    mesh.name = 'facade_detail';
    mesh.castShadow = false;
    mesh.receiveShadow = true;
    frame.add(mesh);
  }
  if (glassGeometry) {
    const mesh = new THREE.Mesh(glassGeometry, MaterialLibrary.getInstance().glassReflectiveMaterial);
    mesh.name = 'facade_glass';
    mesh.receiveShadow = true;
    frame.add(mesh);
  }
}
