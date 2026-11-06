import * as THREE from 'three';
import { Builder, signBoard } from '../world/kit/ArchKit';
import type { Obstruction, Rect } from '../world/plan/CityPlan';
import type { TownBuilding } from '../world/kit/Townscape';
import { ABUJA_ROADS } from '../world/plan/GridRoads';
import { fillFrontages, type District } from './BlockFiller';
import { ABUJA_BUILDINGS } from './Townscapes';

/**
 * Abuja beyond the Central Area: the districts along its avenues and the places the city is
 * known for. The Three Arms Zone's National Assembly under its green dome; Transcorp Hilton in
 * Maitama; in the Central Business District Eagle Square, the Central Bank, the NNPC Towers and
 * the Millennium Tower over everything; Wuse Market; Jabi Lake and its mall; Millennium Park;
 * the National Hospital in Garki; villas in Maitama and Asokoro, estate houses in Gwarinpa.
 * North is -z: Aso Rock stands at the north end of Shehu Shagari Way.
 */

const WHITE = 0xf8fafc;
const CREAM = 0xf5f0e6;
const STONE = 0xd6d3d1;
const SAND = 0xe8d9b5;
const SAGE = 0xc7d2b8;
const SKY = 0xcfe3f1;
const ROSE = 0xe9c7c0;
const TERRACOTTA = 0xd9a066;
const GLASS = 0x1e3a5f;
const GREEN = 0x0b7a43;

/** Where nothing ordinary is built: the Central Area, the airport, Aso Rock, the landmarks, the park and the lake */
export const ABUJA_KEEP_OUT: Rect[] = [
  { minX: -78, maxX: 78, minZ: -100, maxZ: 136 },
  { minX: -168, maxX: -52, minZ: 28, maxZ: 128 },
  { minX: -92, maxX: -6, minZ: 104, maxZ: 126 },
  { minX: -170, maxX: 170, minZ: -300, maxZ: -96 },
  // The landmarks' ground
  { minX: 258, maxX: 372, minZ: -58, maxZ: 28 },
  { minX: 236, maxX: 324, minZ: 100, maxZ: 162 },
  { minX: 18, maxX: 152, minZ: 180, maxZ: 312 },
  { minX: 163, maxX: 228, minZ: 180, maxZ: 244 },
  { minX: 243, maxX: 347, minZ: 180, maxZ: 264 },
  { minX: 200, maxX: 250, minZ: 366, maxZ: 422 },
  { minX: -244, maxX: -106, minZ: 180, maxZ: 274 },
  { minX: -560, maxX: -390, minZ: 180, maxZ: 422 },
  { minX: 18, maxX: 374, minZ: 436, maxZ: 684 },
  { minX: -324, maxX: -216, minZ: 436, maxZ: 502 },
];

const D = (name: string, rect: Rect, kinds: District['kinds'], colours: number[], trims: number[], setback: [number, number], gap: [number, number]): District => ({ name, rect, kinds, colours, trims, setback, gap });

const DISTRICTS: District[] = [
  D('Maitama', { minX: 18, maxX: 374, minZ: -62, maxZ: 164 }, [
    { kind: 'duplex', weight: 4, width: [14, 18], depth: [12, 15] },
    { kind: 'house', weight: 2, width: [13, 16], depth: [11, 14] },
    { kind: 'office', weight: 1.5, width: [16, 22], depth: [14, 18], floors: [2, 4] },
  ], [WHITE, CREAM, SAND, STONE], [0x1e3a5f, 0x7c2d12, 0x14532d], [8, 14], [10, 18]),
  D('Asokoro', { minX: 386, maxX: 562, minZ: -62, maxZ: 164 }, [
    { kind: 'duplex', weight: 5, width: [16, 20], depth: [13, 16] },
    { kind: 'house', weight: 1, width: [14, 17], depth: [12, 14] },
  ], [WHITE, CREAM, ROSE], [0x1e3a5f, 0x7c2d12], [10, 16], [12, 20]),
  D('Gwarinpa', { minX: -562, maxX: -386, minZ: -62, maxZ: 164 }, [
    { kind: 'bungalow', weight: 3, width: [11, 13], depth: [10, 12] },
    { kind: 'house', weight: 3, width: [11, 13], depth: [10, 12] },
    { kind: 'duplex', weight: 2, width: [12, 14], depth: [10, 12] },
  ], [CREAM, SAND, WHITE, ROSE, TERRACOTTA], [0x9a3412, 0x7c2d12, 0x1e3a5f], [4, 7], [4, 8]),
  D('Garki Area 1', { minX: -374, maxX: -18, minZ: -62, maxZ: 164 }, [
    { kind: 'flats', weight: 3, width: [16, 22], depth: [14, 18], floors: [3, 5] },
    { kind: 'shops', weight: 2, width: [14, 20], depth: [12, 14] },
    { kind: 'office', weight: 1.5, width: [14, 20], depth: [14, 18], floors: [3, 6] },
  ], [SAND, CREAM, SAGE, STONE], [0x475569, 0x57534e], [4, 8], [6, 12]),
  D('Central Business District', { minX: 18, maxX: 374, minZ: 178, maxZ: 424 }, [
    { kind: 'office', weight: 5, width: [20, 30], depth: [18, 26], floors: [6, 12] },
    { kind: 'bank', weight: 1.2, width: [16, 22], depth: [16, 20], floors: [5, 8] },
    { kind: 'hotel', weight: 1, width: [20, 26], depth: [18, 22], floors: [8, 12] },
  ], [SKY, STONE, WHITE, 0xbfd4e6], [GLASS, 0x0f172a, 0x7f1d1d], [6, 10], [10, 18]),
  D('Wuse', { minX: -374, maxX: -18, minZ: 178, maxZ: 424 }, [
    { kind: 'shops', weight: 4, width: [14, 24], depth: [12, 16] },
    { kind: 'flats', weight: 2.5, width: [16, 22], depth: [14, 18], floors: [4, 7] },
    { kind: 'office', weight: 2, width: [16, 22], depth: [14, 18], floors: [3, 6] },
    { kind: 'bank', weight: 0.6, width: [14, 18], depth: [14, 16], floors: [4, 5] },
  ], [SAND, CREAM, STONE, SAGE, ROSE], [0x475569, 0x15803d, 0x7f1d1d], [3, 6], [4, 8]),
  D('Utako', { minX: 386, maxX: 562, minZ: 178, maxZ: 762 }, [
    { kind: 'office', weight: 2, width: [16, 24], depth: [14, 20], floors: [4, 8] },
    { kind: 'flats', weight: 2, width: [16, 22], depth: [14, 18], floors: [4, 6] },
    { kind: 'shops', weight: 2, width: [14, 20], depth: [12, 14] },
  ], [STONE, SAND, CREAM, SKY], [0x334155, 0x475569], [5, 9], [6, 12]),
  D('Jabi', { minX: -562, maxX: -386, minZ: 422, maxZ: 762 }, [
    { kind: 'flats', weight: 3, width: [16, 22], depth: [14, 18], floors: [3, 6] },
    { kind: 'house', weight: 2, width: [12, 15], depth: [11, 13] },
    { kind: 'shops', weight: 1, width: [14, 18], depth: [12, 14] },
  ], [CREAM, SAGE, SAND, WHITE], [0x57534e, 0x1e3a5f], [5, 9], [6, 12]),
  D('Garki', { minX: -374, maxX: -18, minZ: 436, maxZ: 762 }, [
    { kind: 'house', weight: 3, width: [12, 15], depth: [11, 13] },
    { kind: 'duplex', weight: 2, width: [13, 16], depth: [11, 14] },
    { kind: 'flats', weight: 2, width: [16, 20], depth: [14, 16], floors: [3, 4] },
    { kind: 'shops', weight: 1.5, width: [14, 20], depth: [12, 14] },
  ], [CREAM, SAND, TERRACOTTA, WHITE, ROSE], [0x9a3412, 0x1e3a5f, 0x57534e], [4, 8], [5, 10]),
  D('Durumi', { minX: 18, maxX: 374, minZ: 684, maxZ: 762 }, [
    { kind: 'flats', weight: 2, width: [16, 22], depth: [14, 18], floors: [3, 5] },
    { kind: 'house', weight: 2, width: [12, 15], depth: [11, 13] },
  ], [CREAM, SAND, STONE], [0x57534e, 0x9a3412], [5, 8], [6, 12]),
];

/** Every ordinary building in Abuja: the Central Area's, by hand, and the districts', along their avenues */
export function abujaBuildings(): { core: TownBuilding[]; districts: Array<{ name: string; buildings: TownBuilding[] }> } {
  const all = fillFrontages(ABUJA_ROADS, DISTRICTS, ABUJA_KEEP_OUT, 2026, ABUJA_BUILDINGS);
  // Drawn by district, so the camera leaves out what it is not looking at
  const groups = new Map<string, TownBuilding[]>();
  for (const b of all) {
    const d = DISTRICTS.find((x) => b.x >= x.rect.minX - 30 && b.x <= x.rect.maxX + 30 && b.z >= x.rect.minZ - 30 && b.z <= x.rect.maxZ + 30)?.name ?? 'Abuja';
    groups.set(d, [...(groups.get(d) ?? []), b]);
  }
  return { core: ABUJA_BUILDINGS, districts: [...groups.entries()].map(([name, buildings]) => ({ name, buildings })) };
}

// --- The places Abuja is known for ---------------------------------------------------------------

/** A door to walk up to on the street, and the room it leads into */
export interface AbujaPlace {
  key: string;
  name: string;
  category: string;
  description: string;
  /** The front of the building, and where on the ground in front of it the player stands */
  door: { x: number; z: number };
  stand: { x: number; z: number };
  /** Gone into (a room of its own), or only walked up to */
  inside: boolean;
}

export interface Landmarks {
  group: THREE.Group;
  obstructions: Obstruction[];
  places: AbujaPlace[];
}

function sign(group: THREE.Group, lines: string[], w: number, h: number, x: number, y: number, z: number, yaw: number, bg = '#0f172a', ink = '#f8fafc'): void {
  const s = signBoard(lines, w, h, bg, ink);
  s.position.set(x, y, z);
  s.rotation.y = yaw;
  group.add(s);
}

/** The national flag on a pole: green, white, green */
function flag(b: Builder, x: number, z: number, height: number, size = 3): void {
  b.cylinder(0xe5e7eb, 0.12, height, x, 0, z, { sides: 8, solid: true });
  for (let i = 0; i < 3; i++) b.box(i === 1 ? WHITE : GREEN, size / 3, size * 0.6, 0.04, x + 0.1 + size / 6 + (i * size) / 3, height - size * 0.65, z);
}

export function buildLandmarks(): Landmarks {
  const group = new THREE.Group();
  group.name = 'Abuja landmarks';
  const b = new Builder();
  const lit = new Builder();
  const places: AbujaPlace[] = [];

  // --- The National Assembly: a white hall on a podium, a colonnade facing the crescent, the green dome
  {
    const cx = 312;
    const cz = -15;
    b.box(STONE, 46, 1.4, 74, cx, 0, cz, { solid: true });
    b.box(WHITE, 36, 12, 62, cx, 1.4, cz, { solid: true });
    // Wings, lower, north and south
    b.box(WHITE, 30, 8, 14, cx - 2, 1.4, cz - 38).box(WHITE, 30, 8, 14, cx - 2, 1.4, cz + 38);
    b.box(STONE, 34, 1.2, 16, cx - 2, 0, cz - 38, { solid: true }).box(STONE, 34, 1.2, 16, cx - 2, 0, cz + 38, { solid: true });
    for (let z = cz - 28; z <= cz + 28; z += 4) b.cylinder(WHITE, 0.7, 11, cx + 19.5, 1.4, z, { sides: 12 });
    b.box(WHITE, 4, 1.4, 62, cx + 19.5, 12.4, cz);
    // Steps up from the forecourt
    for (let i = 0; i < 4; i++) b.box(STONE, 3, 0.35, 30 - i * 2, cx + 24.5 - i, i * 0.35, cz);
    // The drum and the dome
    b.cylinder(WHITE, 13, 4.5, cx, 13.4, cz, { sides: 28 });
    for (let a = 0; a < Math.PI * 2; a += Math.PI / 10) b.box(GLASS, 1.4, 2.6, 0.2, cx + Math.sin(a) * 13.05, 14.2, cz + Math.cos(a) * 13.05, { yaw: a });
    b.dome(0x15803d, 13, cx, 17.9, cz);
    b.cylinder(WHITE, 1.6, 2.4, cx, 30.6, cz, { sides: 12 }).cone(0xd4af37, 1.8, 2.2, cx, 33, cz, 12);
    // Flags across the forecourt, and its lawn
    b.ground(0x4d9a3a, 18, 70, cx + 34, 0.03, cz);
    for (const z of [cz - 24, cz - 8, cz + 8, cz + 24]) flag(b, cx + 40, z, 14, 3.2);
    sign(group, ['NATIONAL ASSEMBLY', 'FEDERAL REPUBLIC OF NIGERIA'], 14, 1.6, cx + 26, 1.4, cz + 32, Math.PI / 2, '#14532d', '#fde68a');
    places.push({ key: 'national-assembly', name: 'National Assembly', category: 'Government', description: 'The Senate and the House of Representatives, under the green dome. The public gallery is open when they sit.', door: { x: cx + 22, z: cz }, stand: { x: cx + 30, z: cz }, inside: true });
  }

  // --- Transcorp Hilton, Maitama: a long white slab of rooms over the porte-cochere on Ahmadu Bello Way
  {
    const cx = 280;
    const cz = 140;
    b.box(STONE, 60, 6, 26, cx, 0, cz, { solid: true });
    b.box(0xf5f5f4, 52, 40, 18, cx, 6, cz - 2, { solid: true });
    lit.windows(0xfef3c7, 18, 12, 50, 7, 38, cx, cz + 7.05, 0, { glow: true });
    lit.windows(0xfef3c7, 18, 12, 50, 7, 38, cx, cz - 11.05, Math.PI, { glow: true });
    b.box(0x0c4a6e, 54, 1.2, 20, cx, 46, cz - 2);
    // The porte-cochere over the drive, on four pillars
    b.box(WHITE, 24, 0.6, 7, cx, 5.2, cz + 16);
    for (const x of [cx - 10, cx + 10]) for (const z of [cz + 14, cz + 18]) b.cylinder(WHITE, 0.35, 5.2, x, 0, z, { solid: true });
    sign(group, ['TRANSCORP HILTON', 'ABUJA'], 20, 2.4, cx, 43, cz + 7.2, 0, '#0c4a6e', '#ffffff');
    places.push({ key: 'transcorp-hilton', name: 'Transcorp Hilton Abuja', category: 'Hotel', description: 'Rooms, the lobby bar, the pool and the buffet, where Abuja does its business.', door: { x: cx, z: cz + 13 }, stand: { x: cx, z: cz + 17 }, inside: true });
  }

  // --- Eagle Square: a great paved square, the grandstand on its east side, flags and the eagle
  {
    const cx = 86;
    const cz = 247;
    b.ground(0xd6d3d1, 120, 112, cx, 0.03, cz);
    for (let x = cx - 56; x <= cx + 56; x += 8) b.ground(0xbfb9b0, 0.25, 112, x, 0.035, cz);
    // The grandstand: tiers of seats under a white canopy
    for (let i = 0; i < 6; i++) b.box(i % 2 ? 0x0b7a43 : WHITE, 3, 0.9 + i * 0.9, 76, cx + 52 + i * 1.6, 0, cz, { solid: i === 0 });
    b.box(WHITE, 14, 0.6, 80, cx + 55, 9.2, cz);
    for (let z = cz - 36; z <= cz + 36; z += 12) b.cylinder(0x94a3b8, 0.3, 9.2, cx + 61, 0, z, { solid: true });
    // The eagle on its column, and the flags along the avenue
    b.box(STONE, 6, 1.2, 6, cx - 30, 0, cz, { solid: true }).cylinder(WHITE, 1.1, 14, cx - 30, 1.2, cz, { sides: 16 });
    b.box(0x78350f, 5, 1.6, 1.2, cx - 30, 15.2, cz).cone(0x78350f, 0.9, 2.2, cx - 30, 15.2, cz + 0.4, 6);
    flag(b, cx - 54, cz - 50, 26, 6);
    for (let z = cz - 44; z <= cz + 44; z += 11) flag(b, cx - 58, z, 11, 2.2);
    sign(group, ['EAGLE SQUARE'], 16, 1.8, cx + 48, 10.4, cz - 40.5, Math.PI, '#14532d', '#fde68a');
    places.push({ key: 'eagle-square', name: 'Eagle Square', category: 'Landmark', description: 'Where the nation marches on Independence Day and presidents are sworn in.', door: { x: cx - 40, z: cz }, stand: { x: cx - 44, z: cz }, inside: false });
  }

  // --- The Central Bank: a dark glass tower held by four white piers, a crown over it
  {
    const cx = 196;
    const cz = 213;
    b.box(STONE, 44, 1, 44, cx, 0, cz, { solid: true });
    b.box(0x1f2937, 30, 64, 30, cx, 1, cz, { solid: true });
    for (const [px, pz] of [[-15, -15], [15, -15], [-15, 15], [15, 15]]) b.box(WHITE, 5, 70, 5, cx + px, 1, cz + pz, { solid: true });
    b.box(WHITE, 38, 4, 38, cx, 68, cz);
    for (const [yaw, dx, dz] of [[Math.PI, 0, -15.06], [0, 0, 15.06], [Math.PI / 2, 15.06, 0], [-Math.PI / 2, -15.06, 0]] as Array<[number, number, number]>) lit.windows(0x7dd3fc, 9, 18, 24, 3, 60, cx + dx, cz + dz, yaw, { glow: true });
    sign(group, ['CENTRAL BANK OF NIGERIA'], 20, 1.6, cx, 3.5, cz - 22.2, Math.PI, '#0f172a', '#fde68a');
    places.push({ key: 'cbn-abuja', name: 'Central Bank of Nigeria', category: 'Bank', description: 'Where the Naira is minted and watched. Its visitors centre shows how.', door: { x: cx, z: cz - 16 }, stand: { x: cx, z: cz - 24 }, inside: true });
  }

  // --- The NNPC Towers: four green glass towers on one podium
  {
    const cx = 295;
    const cz = 222;
    b.box(0xe5e7eb, 78, 7, 56, cx, 0, cz, { solid: true });
    for (const [px, pz] of [[-22, -15], [22, -15], [-22, 15], [22, 15]]) {
      b.box(0x0e7490, 15, 46, 15, cx + px, 7, cz + pz);
      b.box(WHITE, 16, 2, 16, cx + px, 53, cz + pz);
      for (const [yaw, dx, dz] of [[Math.PI, 0, -7.56], [0, 0, 7.56]] as Array<[number, number, number]>) lit.windows(0xbae6fd, 5, 12, 13, 8, 44, cx + px + dx, cz + pz + dz, yaw, { glow: true });
    }
    sign(group, ['NNPC TOWERS'], 14, 1.6, cx, 4.2, cz - 28.2, Math.PI, '#065f46', '#ffffff');
  }

  // --- The Millennium Tower: a slender concrete shaft, a glass pod near the top, a spire over the whole city
  {
    const cx = 225;
    const cz = 394;
    b.box(WHITE, 26, 8, 26, cx, 0, cz, { solid: true });
    b.cylinder(0xe7e5e4, 4.2, 104, cx, 8, cz, { topRadius: 2.6, sides: 16 });
    b.cylinder(0x0f766e, 9.5, 7, cx, 100, cz, { sides: 24 });
    lit.cylinder(0x99f6e4, 9.6, 2.2, cx, 102.5, cz, { sides: 24, glow: true });
    b.cylinder(WHITE, 10.5, 0.8, cx, 107, cz, { sides: 24 }).cone(0xe5e7eb, 1.6, 34, cx, 107.8, cz, 10);
    lit.cylinder(0xef4444, 0.4, 0.8, cx, 141.6, cz, { glow: true });
    sign(group, ['MILLENNIUM TOWER', 'OBSERVATION DECK · 102 M'], 16, 1.8, cx, 4.5, cz + 13.2, 0, '#0f766e', '#ffffff');
    places.push({ key: 'millennium-tower', name: 'Millennium Tower', category: 'Landmark', description: 'Up the lift to the glass deck at the top: all of Abuja, out to Aso Rock.', door: { x: cx, z: cz + 13 }, stand: { x: cx, z: cz + 18 }, inside: true });
  }

  // --- Wuse Market: long sheds of stalls under tin roofs, umbrellas, and the gate
  {
    const cx = -175;
    const cz = 228;
    for (const dz of [-18, 0, 18]) {
      b.box(0xd6c7a1, 110, 4, 12, cx, 0, cz + dz, { solid: true });
      b.box(0x9ca3af, 112, 0.25, 7, cx, 4.6, cz + dz - 3.1, { pitch: 0.28 }).box(0x9ca3af, 112, 0.25, 7, cx, 4.6, cz + dz + 3.1, { pitch: -0.28 });
    }
    const umbrellas = [0xdc2626, 0xfacc15, 0x2563eb, 0x16a34a, 0xf97316];
    for (let i = 0; i < 18; i++) {
      const x = cx - 52 + i * 6;
      lit.cylinder(0x57534e, 0.05, 2.1, x, 0, cz - 33).cone(umbrellas[i % 5], 1.6, 0.7, x, 2.1, cz - 33, 8);
    }
    b.box(GREEN, 1.2, 7, 1.2, cx - 8, 0, cz - 38, { solid: true }).box(GREEN, 1.2, 7, 1.2, cx + 8, 0, cz - 38, { solid: true }).box(GREEN, 18, 1.6, 1.4, cx, 6, cz - 38);
    sign(group, ['WUSE MARKET'], 14, 1.4, cx, 6.1, cz - 38.8, Math.PI, '#14532d', '#fde68a');
    places.push({ key: 'wuse-market', name: 'Wuse Market', category: 'Market', description: 'Foodstuff, fabric, phones and everything else, sold in a thousand stalls.', door: { x: cx, z: cz - 38 }, stand: { x: cx, z: cz - 42 }, inside: true });
  }

  // --- Jabi Lake and the mall on its shore
  {
    b.box(0x1d6fa5, 150, 0.06, 176, -475, 0, 280);
    b.ground(0x8b7d5e, 156, 182, -475, 0.01, 280);
    // Reeds along the south shore
    for (let i = 0; i < 40; i++) b.cone(0x4d7c0f, 0.4, 1.4, -548 + i * 3.7, 0.02, 190 + (i % 3) * 0.8, 5);
    // A boardwalk out over the water
    b.box(0x92400e, 3, 0.3, 40, -440, 0.2, 350);
    // The mall: long, white and glass, its front on Independence Avenue
    b.box(WHITE, 100, 13, 30, -475, 0, 397, { solid: true });
    lit.windows(0xbae6fd, 20, 2, 96, 1, 11, -475, 412.06, 0, { glow: true });
    b.box(0xdc2626, 102, 1.4, 31, -475, 13, 397);
    sign(group, ['JABI LAKE MALL'], 22, 2.2, -475, 9.6, 412.3, 0, '#dc2626', '#ffffff');
    places.push({ key: 'jabi-lake-mall', name: 'Jabi Lake Mall', category: 'Mall', description: 'Shoprite, the food court, the cinema and the lake view.', door: { x: -475, z: 412.5 }, stand: { x: -475, z: 416 }, inside: true });
  }

  // --- Millennium Park: lawns, paths, a fountain in the middle, benches
  {
    const cx = 196;
    const cz = 560;
    b.ground(0x5aa83f, 350, 240, cx, 0.02, cz);
    b.ground(0xe7e5e4, 6, 240, cx, 0.03, cz).ground(0xe7e5e4, 350, 6, cx, 0.03, cz);
    b.ground(0xe7e5e4, 5, 200, cx - 110, 0.03, cz).ground(0xe7e5e4, 5, 200, cx + 110, 0.03, cz);
    b.cylinder(STONE, 14, 0.9, cx, 0, cz, { sides: 32, solid: true });
    lit.cylinder(0x7dd3fc, 13, 0.1, cx, 0.85, cz, { sides: 32, glow: true });
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      lit.cylinder(0xe0f2fe, 0.25, 3.5, cx + Math.sin(a) * 7, 0.9, cz + Math.cos(a) * 7, { topRadius: 0.05, glow: true });
    }
    lit.cylinder(0xe0f2fe, 0.6, 6, cx, 0.9, cz, { topRadius: 0.1, glow: true });
    for (let i = 0; i < 16; i++) b.box(0x78350f, 2.2, 0.45, 0.6, cx - 100 + i * 13, 0, cz + (i % 2 ? 5 : -5));
    sign(group, ['MILLENNIUM PARK'], 14, 1.6, cx, 2.2, 444.5, Math.PI, '#14532d', '#fde68a');
    places.push({ key: 'millennium-park', name: 'Millennium Park', category: 'Park', description: 'Lawns, shade and the fountain: Abuja\'s Sunday afternoon.', door: { x: cx, z: 444 }, stand: { x: cx, z: 446 }, inside: false });
  }

  // --- The National Hospital, Garki
  {
    const cx = -270;
    const cz = 468;
    b.box(WHITE, 84, 18, 34, cx, 0, cz, { solid: true });
    lit.windows(0x93c5fd, 20, 4, 80, 2, 15, cx, cz - 17.06, Math.PI, { glow: true });
    b.box(0xdc2626, 3, 9, 0.3, cx + 30, 6, cz - 17.3).box(0xdc2626, 9, 3, 0.3, cx + 30, 9, cz - 17.3);
    b.box(WHITE, 18, 0.5, 7, cx - 20, 4, cz - 20.5);
    for (const x of [cx - 28, cx - 12]) b.cylinder(0x94a3b8, 0.25, 4, x, 0, cz - 23.5, { solid: true });
    sign(group, ['NATIONAL HOSPITAL ABUJA'], 22, 1.8, cx - 6, 15.6, cz - 17.4, Math.PI, '#0f172a', '#ffffff');
    places.push({ key: 'national-hospital-abuja', name: 'National Hospital Abuja', category: 'Hospital', description: 'Emergency, clinics and the pharmacy, open day and night.', door: { x: cx - 20, z: cz - 17 }, stand: { x: cx - 20, z: cz - 25 }, inside: true });
  }

  group.add(b.build('Abuja landmarks', { roughness: 0.6 }), lit.build('Abuja landmarks lit', { roughness: 0.3 }));
  landmarkDoors.length = 0;
  for (const p of places) landmarkDoors.push({ name: p.name, x: p.stand.x, z: p.stand.z });
  // Nobody walks into Jabi Lake
  const lake: Obstruction = { owner: 'Jabi Lake', minX: -550, maxX: -400, minZ: 192, maxZ: 368, structure: false, height: 1 };
  return { group, obstructions: [...b.obstructions('Abuja landmark', 0, 0), ...lit.obstructions('Abuja landmark', 0, 0), lake], places };
}

/**
 * Shade trees down the avenues' pavements and over Millennium Park, as two instanced meshes. Not
 * solid: a trunk at the back of a pavement is walked past, and none stands in a doorway or a road.
 */
export function plantTrees(points: Array<{ x: number; z: number; s: number }>, kind: 'shade' | 'palm' = 'shade', name = 'Abuja trees'): THREE.Group {
  const group = new THREE.Group();
  group.name = name;
  // A shade tree: a short trunk and a round crown. A palm: a tall thin trunk and a flat spray of fronds
  const palm = kind === 'palm';
  const trunk = palm ? new THREE.CylinderGeometry(0.14, 0.22, 6, 6) : new THREE.CylinderGeometry(0.18, 0.26, 3, 6);
  trunk.translate(0, palm ? 3 : 1.5, 0);
  const crown = palm ? new THREE.ConeGeometry(2.6, 1.3, 8, 1, true) : new THREE.IcosahedronGeometry(2.4, 0);
  if (palm) {
    crown.rotateX(Math.PI);
    crown.translate(0, 6.3, 0);
  } else crown.translate(0, 4.4, 0);
  const trunks = new THREE.InstancedMesh(trunk, new THREE.MeshStandardMaterial({ color: 0x6b4f35, roughness: 0.9 }), points.length);
  const crowns = new THREE.InstancedMesh(crown, new THREE.MeshStandardMaterial({ color: palm ? 0x3f7d20 : 0x2f7d32, roughness: 0.85, flatShading: true, side: palm ? THREE.DoubleSide : THREE.FrontSide }), points.length);
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const one = new THREE.Vector3();
  points.forEach((p, i) => {
    q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), (i * 2.399) % (Math.PI * 2));
    one.set(p.s, p.s, p.s);
    m.compose(new THREE.Vector3(p.x, 0, p.z), q, one);
    trunks.setMatrixAt(i, m);
    crowns.setMatrixAt(i, m);
  });
  crowns.castShadow = true;
  group.add(trunks, crowns);
  return group;
}

/** Where in Abuja a point is, for the corner of the screen: the road (or the place) and the district */
/** Where each of the places stands, for naming the ground in front of it (kept when the city is built) */
const landmarkDoors: Array<{ name: string; x: number; z: number }> = [];

export function abujaWhere(x: number, z: number): { name: string; sub: string } {
  // The district: the one the point is in, or the nearest, as the avenues between them belong to both
  const gap = (r: Rect) => Math.hypot(Math.max(r.minX - x, 0, x - r.maxX), Math.max(r.minZ - z, 0, z - r.maxZ));
  const nearest = [...DISTRICTS].sort((a, b) => gap(a.rect) - gap(b.rect))[0];
  const district =
    x > -78 && x < 78 && z > -100 && z < 136 ? 'Central Area'
      : x > 18 && x < 374 && z > 436 && z < 684 ? 'Millennium Park'
        : x > -560 && x < -390 && z > 180 && z < 380 ? 'Jabi Lake'
          : nearest && gap(nearest.rect) < 40 ? nearest.name : 'Abuja';
  if (z < -96 && Math.abs(x) < 170) return { name: 'Aso Rock', sub: 'Three Arms Zone · the lookout' };
  // At one of the places: its name
  const at = landmarkDoors.find((p) => Math.hypot(p.x - x, p.z - z) < 22);
  if (at) return { name: at.name, sub: `${district} · Abuja` };
  // On a road, or its pavement: the road's name
  const road = ABUJA_ROADS.find((r) => {
    const across = r.axis === 'z' ? x - r.fixed : z - r.fixed;
    const along = r.axis === 'z' ? z : x;
    return Math.abs(across) <= r.halfRoad + r.walk + 2 && along >= Math.min(r.from, r.to) - 2 && along <= Math.max(r.from, r.to) + 2;
  });
  if (road) return { name: road.name, sub: `${district} · Abuja` };
  return { name: district, sub: 'Abuja FCT' };
}
