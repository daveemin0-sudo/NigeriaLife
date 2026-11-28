/**
 * Plan-key dressing for Nigerian home interiors: clutter, signage, and zone props
 * without moving furniture spots or station anchors.
 */
import * as THREE from 'three';
import { Builder, signBoard } from '../../world/kit/ArchKit';
import type { HomePlan, PlanRoom } from '../../housing/HomePlan';
import type { HomeStandard } from '../../housing/HomeStandard';

export interface DressFootprint {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  height: number;
}

export interface HomeDressResult {
  group: THREE.Group;
  footprints: DressFootprint[];
}

const SACHET = 0x38bdf8;
const CRATE = 0xd97706;
const WOOD = 0x78350f;
const PLASTIC = 0xdc2626;
const TEAL = 0x0f766e;

function roomCentre(r: PlanRoom): { x: number; z: number } {
  return { x: (r.minX + r.maxX) / 2, z: (r.minZ + r.maxZ) / 2 };
}

function sachetCrate(b: Builder, x: number, z: number): void {
  b.box(CRATE, 0.55, 0.42, 0.38, x, 0, z, { solid: false });
  for (let i = 0; i < 6; i++) {
    b.box(SACHET, 0.08, 0.22, 0.14, x - 0.18 + (i % 3) * 0.18, 0.43, z - 0.08 + Math.floor(i / 3) * 0.16, { solid: false });
  }
}

function shoeMat(b: Builder, x: number, z: number): void {
  b.box(0x57534e, 0.75, 0.02, 0.45, x, 0.01, z, { solid: false });
  for (const [sx, sz] of [[-0.22, 0.08], [0.05, -0.06], [0.28, 0.05]] as const) {
    b.box(0x1c1917, 0.22, 0.08, 0.32, x + sx, 0.05, z + sz, { solid: false });
  }
}

function prepaidMeter(b: Builder, x: number, z: number, yaw = 0): void {
  b.box(0xf8fafc, 0.35, 0.55, 0.14, x, 0.28, z, { yaw, solid: false });
  b.box(0xfacc15, 0.28, 0.18, 0.04, x, 0.52, z + (yaw ? 0.06 : 0.06), { glow: true, yaw, solid: false });
  b.box(0x1e293b, 0.22, 0.14, 0.02, x, 0.38, z + (yaw ? 0.07 : 0.07), { solid: false, yaw });
}

function wallCalendar(b: Builder, x: number, z: number, yaw = 0): void {
  b.box(0xfef3c7, 0.38, 0.52, 0.03, x, 1.45, z, { yaw, solid: false });
  b.box(0xdc2626, 0.32, 0.08, 0.02, x, 1.62, z + 0.02, { yaw, solid: false });
}

function kitchenProps(b: Builder, room: PlanRoom, basic: boolean): void {
  const { x } = roomCentre(room);
  const backZ = room.minZ + 0.55;
  b.box(WOOD, 0.9, 0.55, 0.32, room.minX + 1.1, 0, backZ, { solid: false });
  for (let i = 0; i < 3; i++) b.cylinder(PLASTIC, 0.12, 0.16, room.minX + 0.7 + i * 0.22, 0.56, backZ - 0.35, { solid: false });
  b.box(0x57534e, 0.38, 0.55, 0.38, room.maxX - 0.85, 0, backZ + 0.2, { solid: false });
  if (basic) {
    b.cylinder(0x1e293b, 0.16, 0.42, room.maxX - 0.85, 0.21, backZ + 0.2, { solid: false });
    b.box(0xf97316, 0.12, 0.08, 0.12, room.maxX - 0.85, 0.48, backZ + 0.2, { glow: true, solid: false });
  } else {
    b.box(0x94a3b8, 0.42, 0.08, 0.32, x, 0.92, room.maxZ - 0.55, { solid: false });
    for (let i = 0; i < 4; i++) b.box([0xdc2626, 0x16a34a, 0xfacc15, 0x7c3aed][i], 0.08, 0.14, 0.08, room.maxX - 1.2, 1.02, backZ + 0.35 + i * 0.14, { solid: false });
  }
}

function parlourProps(b: Builder, room: PlanRoom, plan: HomePlan, standard: HomeStandard): void {
  const hw = plan.width / 2;
  const basic = standard === 'basic';
  shoeMat(b, plan.entrance.x - 0.9, plan.frontZ - 0.85);
  prepaidMeter(b, plan.entrance.x + 1.55, plan.frontZ - 0.25);
  const leftX = room.minX + 0.35;
  wallCalendar(b, leftX, (room.minZ + room.maxZ) / 2, Math.PI / 2);
  sachetCrate(b, room.maxX - 0.95, room.minZ + 1.0);
  b.box(TEAL, 0.42, 0.85, 0.22, room.minX + 0.85, 0, room.maxZ - 1.1, { solid: false });
  b.box(0x15803d, 0.35, 0.08, 0.35, room.minX + 0.85, 0.86, room.maxZ - 1.1, { solid: false });
  if (!basic) {
    b.box(0x1c1917, 1.1, 0.45, 0.32, room.maxX - 1.6, 0, room.maxZ - 0.85, { solid: false });
    b.occupy(room.maxX - 2.15, room.maxX - 1.05, room.maxZ - 1.05, room.maxZ - 0.65, 0.5);
    b.cylinder(0x44403c, 0.22, 1.0, room.minX + 1.5, 0, room.minZ + 1.8, { sides: 12, solid: false });
  }
  if (standard === 'luxury') {
    b.box(0xd4af37, 0.65, 0.12, 0.4, -hw + 0.5, 2.35, room.maxZ - 0.25, { solid: false });
    b.box(0xf8fafc, 0.55, 0.42, 0.08, room.maxX - 2.2, 0.21, room.minZ + 1.4, { solid: false });
  }
}

function bedroomProps(b: Builder, room: PlanRoom, standard: HomeStandard): void {
  const sideX = room.minX + 0.55;
  const backZ = room.minZ + 0.7;
  b.box(WOOD, 0.55, 1.75, 0.38, sideX, 0, backZ);
  b.occupy(sideX - 0.3, sideX + 0.3, backZ - 0.22, backZ + 0.22, 1.8);
  for (let i = 0; i < 4; i++) b.box([0x1d4ed8, 0x7c3aed, 0x0f766e, 0xfacc15][i], 0.38, 0.02, 0.28, sideX, 0.55 + i * 0.38, backZ + 0.02, { solid: false });
  b.box(0xf8fafc, 0.42, 0.08, 0.35, room.maxX - 0.75, 0.52, room.maxZ - 0.65, { solid: false });
  if (standard !== 'basic') {
    b.box(0x57534e, 0.38, 0.55, 0.28, room.maxX - 0.75, 0, room.maxZ - 0.65, { solid: false });
    b.box(0x1c1917, 0.32, 0.06, 0.22, room.maxX - 0.75, 0.56, room.maxZ - 0.65, { solid: false });
  }
}

function bathroomProps(b: Builder, room: PlanRoom): void {
  const { x } = roomCentre(room);
  b.box(0xf8fafc, 0.52, 0.85, 0.22, room.maxX - 0.45, 0, room.minZ + 0.55, { solid: false });
  for (let i = 0; i < 3; i++) b.box([0x38bdf8, 0xf472b6, 0x86efac][i], 0.1, 0.22, 0.1, room.maxX - 0.55, 0.64 + i * 0.2, room.minZ + 0.55, { solid: false });
  b.box(0xe2e8f0, 0.35, 0.02, 0.55, x, 0.01, room.maxZ - 0.35, { solid: false });
}

function corridorProps(b: Builder, room: PlanRoom): void {
  b.box(WOOD, 1.8, 0.04, 0.75, roomCentre(room).x, 0.01, room.minZ + 0.55, { solid: false });
  for (const side of [-1, 1]) {
    b.box(0x1c1917, 0.22, 0.08, 0.32, room.minX + 0.35, 0.05, roomCentre(room).z + side * 0.65, { solid: false });
    b.box(0x1c1917, 0.22, 0.08, 0.32, room.maxX - 0.35, 0.05, roomCentre(room).z + side * 0.65, { solid: false });
  }
}

function welcomeSign(group: THREE.Group, plan: HomePlan): void {
  const board = signBoard(['WELCOME', 'NEPA • PREPAID'], 1.1, 0.42, '#0f172a', '#facc15');
  board.position.set(plan.entrance.x - 1.35, 1.65, plan.frontZ - 0.22);
  board.rotation.y = Math.PI;
  group.add(board);
}

function dressZones(b: Builder, plan: HomePlan, standard: HomeStandard): void {
  for (const room of plan.rooms) {
    if (room.kind === 'parlour' || room.kind === 'studio') parlourProps(b, room, plan, standard);
    else if (room.kind === 'kitchen') kitchenProps(b, room, standard === 'basic');
    else if (room.kind === 'bedroom') bedroomProps(b, room, standard);
    else if (room.kind === 'bathroom' || room.kind === 'ensuite') bathroomProps(b, room);
    else if (room.kind === 'corridor') corridorProps(b, room);
  }
}

function dressSelfContain(b: Builder, plan: HomePlan, standard: HomeStandard): void {
  const studio = plan.rooms.find((r) => r.kind === 'studio');
  if (studio) parlourProps(b, studio, plan, standard);
  const bath = plan.rooms.find((r) => r.kind === 'bathroom');
  if (bath) bathroomProps(b, bath);
  b.box(WOOD, 0.85, 0.55, 0.32, plan.spots.cooker.x + 0.5, 0, plan.spots.cooker.z, { solid: false });
  sachetCrate(b, studio ? studio.minX + 1.0 : -3, studio ? studio.maxZ - 0.9 : 2);
}

function dressRoomParlour(b: Builder, plan: HomePlan, standard: HomeStandard): void {
  dressZones(b, plan, standard);
}

function dressFlat(b: Builder, plan: HomePlan, standard: HomeStandard): void {
  dressZones(b, plan, standard);
}

function dressHouse(b: Builder, plan: HomePlan, standard: HomeStandard): void {
  dressZones(b, plan, standard);
  if (plan.carport) {
    const hw = plan.width / 2;
    b.box(0x57534e, 0.35, 0.55, 0.32, hw + 3.8, 0, 0.6, { solid: false });
    b.box(0x1c1917, 0.22, 0.08, 0.42, hw + 3.5, 0.05, -0.45, { solid: false });
    b.cylinder(0xf97316, 0.18, 0.35, hw + 4.2, 0.18, -0.5, { solid: false });
  }
}

function dressDuplex(b: Builder, plan: HomePlan, standard: HomeStandard): void {
  dressHouse(b, plan, standard);
  const stair = plan.stairs;
  if (stair) {
    b.box(WOOD, 0.45, 0.12, 1.8, (stair.x0 + stair.x1) / 2, 0.06, stair.minZ - 0.35, { solid: false });
    const railPosts = 4;
    for (let i = 0; i < railPosts; i++) {
      const t = i / (railPosts - 1);
      const px = stair.x0 + (stair.x1 - stair.x0) * t;
      b.box(0x44403c, 0.06, 0.95, 0.06, px, 0, stair.maxZ + 0.55, { solid: false });
    }
    b.box(0x44403c, stair.x1 - stair.x0 + 0.1, 0.05, 0.05, (stair.x0 + stair.x1) / 2, 0.92, stair.maxZ + 0.55, { solid: false });
  }
}

export function buildHomeDressing(plan: HomePlan, standard: HomeStandard): HomeDressResult {
  const b = new Builder();
  const key = plan.key;
  if (key.startsWith('self-contain')) dressSelfContain(b, plan, standard);
  else if (key.startsWith('room-parlour')) dressRoomParlour(b, plan, standard);
  else if (key.includes(':2s')) dressDuplex(b, plan, standard);
  else if (plan.brief.kind === 'house') dressHouse(b, plan, standard);
  else dressFlat(b, plan, standard);
  const group = b.build('home dressing', { roughness: 0.82 });
  group.name = 'home_clutter';
  welcomeSign(group, plan);
  group.traverse((child) => {
    if (child instanceof THREE.Mesh && child.material instanceof THREE.MeshBasicMaterial) child.userData.surface = true;
  });
  return { group, footprints: [...b.footprints] };
}

/** Upstairs clutter for duplex plans (bedrooms / landing only). */
export function buildHomeDressingUpper(plan: HomePlan, standard: HomeStandard): HomeDressResult {
  const up = plan.upper;
  if (!up) return { group: new THREE.Group(), footprints: [] };
  const b = new Builder();
  for (const room of up.rooms) {
    if (room.kind === 'bedroom') bedroomProps(b, room, standard);
    else if (room.kind === 'bathroom' || room.kind === 'ensuite') bathroomProps(b, room);
    else if (room.kind === 'corridor') corridorProps(b, room);
    else if (room.kind === 'parlour') {
      b.box(TEAL, 0.55, 0.75, 0.28, room.minX + 1.0, 0, room.minZ + 1.0, { solid: false });
      wallCalendar(b, room.maxX - 0.35, roomCentre(room).z, -Math.PI / 2);
    }
  }
  const group = b.build('home dressing upper', { roughness: 0.82 });
  group.name = 'home_clutter_upper';
  return { group, footprints: [...b.footprints] };
}