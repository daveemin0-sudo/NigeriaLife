import * as THREE from 'three';
import { Builder, signBoard } from '../world/kit/ArchKit';
import type { Obstruction, Rect } from '../world/plan/CityPlan';
import type { TownBuilding } from '../world/kit/Townscape';
import { PH_CREEK, PH_ROADS } from '../world/plan/GridRoads';
import { fillFrontages, type District } from './BlockFiller';
import { PORT_HARCOURT_BUILDINGS } from './Townscapes';
import type { AbujaPlace as CityPlace } from './AbujaDistricts';

/**
 * Port Harcourt beyond Aba Road's first stretch: the Garden City's districts and its known places.
 * The leafy GRA with its villas; Rumuokoro and Diobu, close-built and busy; D-Line and Old
 * Township with their shops; Mile 1 Market on Ikwerre Road; Port Harcourt Mall on Azikiwe Road;
 * Pleasure Park and its big wheel; Government House (the Brick House); and across the creek
 * Trans-Amadi, the industrial layout, its warehouses and tank farm, with the waterfront jetty on
 * the bank. North is -z (the airport is to the north-west); the creek runs down the east side.
 */

const WHITE = 0xf8fafc;
const CREAM = 0xf5f0e6;
const STONE = 0xd6d3d1;
const SAND = 0xe8d9b5;
const SAGE = 0xc7d2b8;
const SKY = 0xcfe3f1;
const ROSE = 0xe9c7c0;
const TERRACOTTA = 0xd9a066;
const OCHRE = 0xe3b25f;
const GREY = 0x9ca3af;

/** Where nothing ordinary is built: Aba Road's first stretch, the airport, the creek, the landmarks */
export const PH_KEEP_OUT: Rect[] = [
  { minX: -56, maxX: 52, minZ: -142, maxZ: 142 },
  { minX: -168, maxX: -58, minZ: -168, maxZ: -68 },
  { minX: -92, maxX: -6, minZ: -88, maxZ: -68 },
  { minX: PH_CREEK.minX - 3, maxX: PH_CREEK.maxX + 3, minZ: PH_CREEK.from, maxZ: PH_CREEK.to },
  // The landmarks' ground
  { minX: -270, maxX: -152, minZ: 184, maxZ: 272 },
  { minX: -238, maxX: -122, minZ: 384, maxZ: 436 },
  { minX: -516, maxX: -304, minZ: 186, maxZ: 374 },
  { minX: -412, maxX: -328, minZ: -194, maxZ: -134 },
  { minX: 79, maxX: 116, minZ: 222, maxZ: 358 },
  { minX: 316, maxX: 414, minZ: 30, maxZ: 150 },
];

const D = (name: string, rect: Rect, kinds: District['kinds'], colours: number[], trims: number[], setback: [number, number], gap: [number, number]): District => ({ name, rect, kinds, colours, trims, setback, gap });

const DISTRICTS: District[] = [
  D('GRA Phase 2', { minX: -272, maxX: -12, minZ: -192, maxZ: 172 }, [
    { kind: 'duplex', weight: 4, width: [14, 18], depth: [12, 15] },
    { kind: 'house', weight: 2, width: [13, 16], depth: [11, 14] },
    { kind: 'bungalow', weight: 1.5, width: [12, 15], depth: [11, 13] },
  ], [WHITE, CREAM, SAND], [0x14532d, 0x7c2d12, 0x1e3a5f], [7, 12], [10, 16]),
  D('Rumuokoro', { minX: -532, maxX: -288, minZ: -192, maxZ: 172 }, [
    { kind: 'house', weight: 3, width: [11, 13], depth: [10, 12] },
    { kind: 'shops', weight: 3, width: [12, 18], depth: [11, 13] },
    { kind: 'flats', weight: 1.5, width: [14, 18], depth: [12, 15], floors: [2, 4] },
  ], [OCHRE, TERRACOTTA, SAND, ROSE, CREAM, SAGE], [0x7c2d12, 0x475569, 0x15803d], [2, 5], [3, 6]),
  D('Rumuola', { minX: -532, maxX: 520, minZ: -262, maxZ: -208 }, [
    { kind: 'shops', weight: 3, width: [12, 20], depth: [11, 14] },
    { kind: 'flats', weight: 2, width: [14, 20], depth: [12, 16], floors: [3, 4] },
    { kind: 'office', weight: 1, width: [14, 18], depth: [12, 16], floors: [2, 4] },
  ], [SAND, OCHRE, CREAM, STONE], [0x475569, 0x7f1d1d], [3, 6], [4, 8]),
  D('D-Line', { minX: -272, maxX: -12, minZ: 188, maxZ: 372 }, [
    { kind: 'shops', weight: 4, width: [12, 22], depth: [11, 15] },
    { kind: 'office', weight: 2, width: [14, 20], depth: [14, 18], floors: [3, 6] },
    { kind: 'bank', weight: 0.8, width: [12, 16], depth: [12, 16], floors: [3, 5] },
    { kind: 'hotel', weight: 0.5, width: [16, 22], depth: [16, 20], floors: [5, 8] },
    { kind: 'flats', weight: 1.5, width: [14, 20], depth: [12, 16], floors: [3, 5] },
  ], [SAND, CREAM, STONE, SKY, ROSE], [0x475569, 0x15803d, 0x7f1d1d, 0x0c4a6e], [2, 5], [3, 7]),
  D('Diobu', { minX: -532, maxX: -288, minZ: 388, maxZ: 542 }, [
    { kind: 'house', weight: 3, width: [10, 12], depth: [10, 12] },
    { kind: 'flats', weight: 2, width: [12, 16], depth: [12, 14], floors: [2, 4] },
    { kind: 'shops', weight: 2, width: [10, 16], depth: [10, 12] },
  ], [OCHRE, TERRACOTTA, SAND, ROSE, SAGE], [0x7c2d12, 0x475569], [2, 4], [2, 5]),
  D('Old Township', { minX: -272, maxX: -12, minZ: 388, maxZ: 542 }, [
    { kind: 'shops', weight: 4, width: [10, 18], depth: [10, 14] },
    { kind: 'flats', weight: 2, width: [12, 18], depth: [12, 16], floors: [2, 4] },
    { kind: 'market', weight: 0.6, width: [10, 14], depth: [14, 16] },
  ], [OCHRE, SAND, CREAM, TERRACOTTA, STONE], [0x15803d, 0x475569, 0x7c2d12], [2, 4], [2, 5]),
  D('Aba Road', { minX: 12, maxX: 50, minZ: 142, maxZ: 542 }, [
    { kind: 'shops', weight: 3, width: [12, 18], depth: [11, 14] },
    { kind: 'office', weight: 2, width: [14, 20], depth: [12, 16], floors: [3, 6] },
    { kind: 'bank', weight: 0.8, width: [12, 16], depth: [12, 14], floors: [3, 4] },
  ], [SAND, STONE, SKY, CREAM], [0x475569, 0x0c4a6e], [2, 5], [3, 6]),
  D('Aba Road west', { minX: -50, maxX: -12, minZ: 142, maxZ: 542 }, [
    { kind: 'shops', weight: 3, width: [12, 18], depth: [11, 14] },
    { kind: 'flats', weight: 1.5, width: [14, 18], depth: [12, 14], floors: [3, 5] },
  ], [SAND, OCHRE, CREAM], [0x475569, 0x7f1d1d], [2, 5], [3, 6]),
  D('Trans-Amadi', { minX: 82, maxX: 522, minZ: -262, maxZ: 542 }, [
    { kind: 'market', weight: 3, width: [24, 36], depth: [18, 24] },
    { kind: 'office', weight: 2, width: [16, 24], depth: [14, 18], floors: [2, 5] },
    { kind: 'shops', weight: 1, width: [14, 22], depth: [12, 16] },
  ], [GREY, STONE, SKY, 0xcbd5e1], [0x1e3a5f, 0x334155, 0x7f1d1d], [6, 12], [8, 14]),
];

/** The ordinary buildings of Port Harcourt beyond its first stretch, along its roads */
export function phBuildings(): TownBuilding[] {
  return fillFrontages(PH_ROADS, DISTRICTS, PH_KEEP_OUT, 6270, PORT_HARCOURT_BUILDINGS);
}

export interface PhLandmarks {
  group: THREE.Group;
  obstructions: Obstruction[];
  places: CityPlace[];
}

function sign(group: THREE.Group, lines: string[], w: number, h: number, x: number, y: number, z: number, yaw: number, bg = '#0f172a', ink = '#f8fafc'): void {
  const s = signBoard(lines, w, h, bg, ink);
  s.position.set(x, y, z);
  s.rotation.y = yaw;
  group.add(s);
}

const placeDoors: Array<{ name: string; x: number; z: number }> = [];

export function buildPhLandmarks(): PhLandmarks {
  const group = new THREE.Group();
  group.name = 'Port Harcourt landmarks';
  const b = new Builder();
  const lit = new Builder();
  const places: CityPlace[] = [];
  const extra: Obstruction[] = [];

  // --- Mile 1 Market: rows of sheds under rusted zinc, umbrellas along the road, the gate
  {
    const cx = -211;
    const cz = 228;
    for (const dz of [-18, 0, 18]) {
      b.box(0xc8b48a, 96, 3.6, 12, cx, 0, cz + dz, { solid: true });
      b.box(0x9a7b5c, 98, 0.25, 7, cx, 4.2, cz + dz - 3.1, { pitch: 0.28 }).box(0xa1866a, 98, 0.25, 7, cx, 4.2, cz + dz + 3.1, { pitch: -0.28 });
    }
    const umbrellas = [0xdc2626, 0xfacc15, 0x2563eb, 0x16a34a, 0xf97316];
    for (let i = 0; i < 16; i++) lit.cylinder(0x57534e, 0.05, 2.1, cx - 45 + i * 6, 0, cz - 32).cone(umbrellas[i % 5], 1.6, 0.7, cx - 45 + i * 6, 2.1, cz - 32, 8);
    b.box(0x0b7a43, 1.2, 7, 1.2, cx - 8, 0, cz - 35, { solid: true }).box(0x0b7a43, 1.2, 7, 1.2, cx + 8, 0, cz - 35, { solid: true }).box(0x0b7a43, 18, 1.6, 1.4, cx, 6, cz - 35);
    sign(group, ['MILE ONE MARKET'], 14, 1.4, cx, 6.1, cz - 35.8, Math.PI, '#14532d', '#fde68a');
    places.push({ key: 'mile-one-market', name: 'Mile 1 Market', category: 'Market', description: 'Periwinkle, crayfish, plantain, fabric: the great market of Diobu.', door: { x: cx, z: cz - 35 }, stand: { x: cx, z: cz - 39 }, inside: true });
  }

  // --- Port Harcourt Mall, Azikiwe Road
  {
    const cx = -180;
    const cz = 409;
    b.box(WHITE, 100, 12, 32, cx, 0, cz, { solid: true });
    lit.windows(0xbae6fd, 20, 2, 96, 1, 10, cx, cz - 16.06, Math.PI, { glow: true });
    b.box(0x0c4a6e, 102, 1.4, 33, cx, 12, cz);
    sign(group, ['PORT HARCOURT MALL'], 22, 2.2, cx, 9.4, cz - 16.3, Math.PI, '#0c4a6e', '#ffffff');
    places.push({ key: 'ph-mall', name: 'Port Harcourt Mall', category: 'Mall', description: 'Shoprite, the food court and the cinema, on Azikiwe Road.', door: { x: cx, z: cz - 16.5 }, stand: { x: cx, z: cz - 20 }, inside: true });
  }

  // --- Pleasure Park: lawns, the big wheel, the gate on Olu Obasanjo Road
  {
    const cx = -410;
    const cz = 280;
    b.ground(0x5aa83f, 200, 170, cx, 0.02, cz);
    b.ground(0xe7e5e4, 6, 170, cx, 0.03, cz).ground(0xe7e5e4, 200, 6, cx, 0.03, cz);
    // The big wheel: a ring of spokes on two A-frames, cabins round its rim
    const wx = cx + 50;
    const wz = cz + 30;
    for (const dz of [-2.5, 2.5]) for (const s of [-1, 1]) b.box(0x64748b, 0.6, 22, 0.6, wx + s * 5, 0, wz + dz, { roll: s * 0.22, solid: true });
    const rim = 16;
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2;
      const x = wx + Math.cos(a) * rim;
      const y = 21 + Math.sin(a) * rim;
      b.box(0xf8fafc, 0.25, rim, 0.25, wx + Math.cos(a) * rim / 2, 21 + Math.sin(a) * rim / 2 - rim / 2, wz, { roll: a - Math.PI / 2 });
      lit.box([0xdc2626, 0xfacc15, 0x2563eb, 0x16a34a][i % 4], 1.6, 1.4, 1.6, x, y - 1.4, wz, { glow: true });
    }
    b.cylinder(0xf8fafc, 1.2, 1.4, wx, 20.3, wz, { sides: 12 });
    // Benches, a kiosk, the gate
    for (let i = 0; i < 10; i++) b.box(0x78350f, 2.2, 0.45, 0.6, cx - 80 + i * 16, 0, cz + (i % 2 ? 5 : -5));
    b.box(0xfacc15, 6, 3, 4, cx - 40, 0, cz - 50, { solid: true });
    b.box(0x16a34a, 1, 6, 1, cx - 9, 0, cz - 83, { solid: true }).box(0x16a34a, 1, 6, 1, cx + 9, 0, cz - 83, { solid: true }).box(0x16a34a, 20, 1.4, 1.2, cx, 5, cz - 83);
    sign(group, ['PLEASURE PARK'], 14, 1.4, cx, 5.1, cz - 83.7, Math.PI, '#14532d', '#fde68a');
    places.push({ key: 'pleasure-park', name: 'Pleasure Park', category: 'Park', description: 'The big wheel, the lawns and the Sunday crowd.', door: { x: cx, z: cz - 82 }, stand: { x: cx, z: cz - 86 }, inside: false });
  }

  // --- Government House, the Brick House, on Rumuola Road
  {
    const cx = -370;
    const cz = -164;
    b.box(0xb45309, 70, 14, 30, cx, 0, cz, { solid: true });
    b.box(0x92400e, 72, 1, 32, cx, 14, cz);
    lit.windows(0xfef3c7, 14, 3, 64, 2, 11, cx, cz - 15.06, Math.PI, { glow: true });
    for (let x = cx - 12; x <= cx + 12; x += 4) b.cylinder(WHITE, 0.6, 12, x, 0, cz - 18, { sides: 10, solid: true });
    b.box(WHITE, 30, 1.2, 6, cx, 12, cz - 18);
    for (const x of [cx - 26, cx + 26]) {
      b.cylinder(0xe5e7eb, 0.12, 14, x, 0, cz - 24, { sides: 8, solid: true });
      for (let i = 0; i < 3; i++) b.box(i === 1 ? WHITE : 0x0b7a43, 1.1, 1.9, 0.04, x + 0.65 + i * 1.1, 11.7, cz - 24);
    }
    sign(group, ['GOVERNMENT HOUSE', 'RIVERS STATE'], 16, 1.8, cx, 13.4, cz - 15.3, Math.PI, '#7c2d12', '#fde68a');
    places.push({ key: 'rivers-govt-house', name: 'Rivers State Government House', category: 'Government', description: 'The Brick House: the governor\'s office, petitions and appointments.', door: { x: cx, z: cz - 15 }, stand: { x: cx, z: cz - 26 }, inside: true });
  }

  // --- UPTH, the teaching hospital: a real ward in Port Harcourt, not a ride to Lagos
  {
    const cx = 120;
    const cz = -40;
    b.box(0xf8fafc, 70, 14, 28, cx, 0, cz, { solid: true });
    b.box(0x0e7490, 70, 2, 28, cx, 14, cz);
    lit.windows(0x99f6e4, 16, 3, 64, 2, 10, cx, cz - 14.06, Math.PI, { glow: true });
    b.box(0x0e7490, 2.2, 7, 0.25, cx + 22, 5, cz - 14.3).box(0x0e7490, 7, 2.2, 0.25, cx + 22, 7.4, cz - 14.3);
    sign(group, ['UPTH', 'TEACHING HOSPITAL'], 18, 1.8, cx - 8, 12.2, cz - 14.4, Math.PI, '#0e7490', '#ffffff');
    places.push({ key: 'upth', name: 'University of Port Harcourt Teaching Hospital', category: 'Hospital', description: 'Emergency, the wards and the pharmacy. Port Harcourt, not Lagos.', door: { x: cx, z: cz - 14 }, stand: { x: cx, z: -65 }, inside: true });
  }

  // --- Rivers State Police Command
  {
    const cx = 200;
    const cz = 40;
    b.box(0x14532d, 32, 9, 16, cx, 0, cz, { solid: true });
    lit.windows(0xfde68a, 6, 2, 26, 2, 6, cx, cz - 8.06, Math.PI, { glow: true });
    sign(group, ['RIVERS STATE', 'POLICE COMMAND'], 14, 1.6, cx, 7.4, cz - 8.2, Math.PI, '#14532d', '#fde68a');
    places.push({ key: 'ph-police', name: 'Rivers State Police Command', category: 'Police', description: 'Reports, a character certificate and the cells. Port Harcourt, not Lagos.', door: { x: cx, z: cz - 8 }, stand: { x: 200, z: 20 }, inside: true });
  }

  // --- The waterfront: a promenade on the creek's east bank, a jetty out over the water, boats at it
  {
    const cx = 97;
    const cz = 290;
    b.ground(0xd6d3d1, 34, 130, cx, 0.03, cz);
    b.box(0x92400e, 22, 0.4, 5, PH_CREEK.maxX - 9, 0.15, cz);
    for (let i = 0; i < 4; i++) b.cylinder(0x57534e, 0.18, 1.2, PH_CREEK.maxX - 18 + i * 5, -0.6, cz + 2.6);
    for (const [dz, colour] of [[-7, 0x2563eb], [7, 0xdc2626], [14, 0xf8fafc]] as Array<[number, number]>) {
      b.box(colour, 7, 0.8, 2.4, PH_CREEK.maxX - 14, 0, cz + dz).box(WHITE, 2.6, 1, 1.8, PH_CREEK.maxX - 13, 0.8, cz + dz);
    }
    for (let i = 0; i < 8; i++) b.box(0x78350f, 2.2, 0.45, 0.6, cx + 6, 0, cz - 56 + i * 15);
    sign(group, ['PORT HARCOURT WATERFRONT'], 18, 1.6, cx + 12, 3.4, cz, -Math.PI / 2, '#0c4a6e', '#ffffff');
    b.box(0x334155, 0.3, 3.4, 0.3, cx + 12, 0, cz - 9, { solid: true }).box(0x334155, 0.3, 3.4, 0.3, cx + 12, 0, cz + 9, { solid: true });
    places.push({ key: 'waterfront', name: 'Port Harcourt Waterfront', category: 'Landmark', description: 'Boats to the islands, fresh fish off the jetty, the breeze off the creek.', door: { x: PH_CREEK.maxX + 3, z: cz }, stand: { x: PH_CREEK.maxX + 6, z: cz }, inside: false });
  }

  // --- Trans-Amadi tank farm: white tanks behind a fence, pipes between them
  {
    const cx = 365;
    const cz = 90;
    for (let i = 0; i < 6; i++) {
      const x = cx - 30 + (i % 3) * 30;
      const z = cz - 22 + Math.floor(i / 3) * 44;
      b.cylinder(0xf1f5f9, 11, 13, x, 0, z, { sides: 24, solid: true }).cylinder(0xe2e8f0, 11.3, 0.5, x, 13, z, { sides: 24 });
      b.box(0x0c4a6e, 1, 1, 22, x, 13.5, z);
    }
    b.box(0x94a3b8, 90, 1.2, 0.8, cx, 3, cz).box(0x94a3b8, 0.8, 1.2, 80, cx, 3.6, cz);
    sign(group, ['TRANS-AMADI TANK FARM'], 16, 1.6, cx - 46, 4, cz, -Math.PI / 2, '#334155', '#facc15');
  }

  // The creek, the whole length of the city, crossed only by the bridges
  {
    const water = new THREE.Mesh(new THREE.PlaneGeometry(PH_CREEK.maxX - PH_CREEK.minX, PH_CREEK.to - PH_CREEK.from), new THREE.MeshStandardMaterial({ color: 0x0284c7, roughness: 0.12, metalness: 0.3 }));
    water.rotation.x = -Math.PI / 2;
    water.position.set((PH_CREEK.minX + PH_CREEK.maxX) / 2, 0.004, (PH_CREEK.from + PH_CREEK.to) / 2);
    water.name = 'Port Harcourt creek';
    group.add(water);
    const bridges = PH_ROADS.filter((r) => r.axis === 'x' && r.from < PH_CREEK.minX && r.to > PH_CREEK.maxX);
    let from = PH_CREEK.from;
    for (const road of [...bridges].sort((a, c) => a.fixed - c.fixed)) {
      const half = road.halfRoad + road.walk;
      extra.push({ owner: 'The creek', structure: false, height: 2, minX: PH_CREEK.minX, maxX: PH_CREEK.maxX, minZ: from, maxZ: road.fixed - half });
      from = road.fixed + half;
      // The bridge: a concrete edge each side, and a rail along each pavement over the water
      for (const s of [-1, 1]) {
        b.box(0xa8a29e, PH_CREEK.maxX - PH_CREEK.minX + 2, 0.9, 0.6, (PH_CREEK.minX + PH_CREEK.maxX) / 2, -0.6, road.fixed + s * (half + 0.3));
        b.box(0xe5e7eb, PH_CREEK.maxX - PH_CREEK.minX + 2, 1.1, 0.18, (PH_CREEK.minX + PH_CREEK.maxX) / 2, 0.3, road.fixed + s * (half - 0.1), { solid: true });
      }
    }
    extra.push({ owner: 'The creek', structure: false, height: 2, minX: PH_CREEK.minX, maxX: PH_CREEK.maxX, minZ: from, maxZ: PH_CREEK.to });
  }

  group.add(b.build('Port Harcourt landmarks', { roughness: 0.6 }), lit.build('Port Harcourt landmarks lit', { roughness: 0.3 }));
  placeDoors.length = 0;
  for (const p of places) placeDoors.push({ name: p.name, x: p.stand.x, z: p.stand.z });
  return { group, obstructions: [...b.obstructions('Port Harcourt landmark', 0, 0), ...lit.obstructions('Port Harcourt landmark', 0, 0), ...extra], places };
}

/** Where in Port Harcourt a point is, for the corner of the screen */
export function phWhere(x: number, z: number): { name: string; sub: string } {
  const gap = (r: Rect) => Math.hypot(Math.max(r.minX - x, 0, x - r.maxX), Math.max(r.minZ - z, 0, z - r.maxZ));
  const nearest = [...DISTRICTS].sort((a, c) => gap(a.rect) - gap(c.rect))[0];
  const district = x > -56 && x < 52 && z > -142 && z < 142 ? 'Aba Road' : x > PH_CREEK.minX && x < PH_CREEK.maxX ? 'The creek' : nearest && gap(nearest.rect) < 40 ? nearest.name : 'Port Harcourt';
  const at = placeDoors.find((p) => Math.hypot(p.x - x, p.z - z) < 22);
  if (at) return { name: at.name, sub: `${district} · Port Harcourt` };
  const road = PH_ROADS.find((r) => {
    const across = r.axis === 'z' ? x - r.fixed : z - r.fixed;
    const along = r.axis === 'z' ? z : x;
    return Math.abs(across) <= r.halfRoad + r.walk + 2 && along >= Math.min(r.from, r.to) - 2 && along <= Math.max(r.from, r.to) + 2;
  });
  if (road) return { name: road.name, sub: `${district} · Port Harcourt` };
  return { name: district, sub: 'Port Harcourt' };
}
