import type { TownBuilding } from '../world/kit/Townscape';

/**
 * The ordinary buildings of Abuja and Port Harcourt, set out by hand along each city's
 * avenue and in the streets behind it: where each stands, how big it is, which way it faces.
 * They keep clear of the landmarks, the motor parks, the airports and their roads, and the
 * plots of land that are for sale. The city plan checks that they do.
 */

const CREAM = 0xf5f0e6;
const SAND = 0xe8d9b5;
const STONE = 0xd6d3d1;
const WHITE = 0xf8fafc;
const TERRACOTTA = 0xd9a066;
const SAGE = 0xc7d2b8;
const SKY = 0xcfe3f1;
const ROSE = 0xe9c7c0;

/** Abuja: Shehu Shagari Way runs north and south at x = 0. East fronts start at x = 15, west fronts end at x = -15. */
export const ABUJA_BUILDINGS: TownBuilding[] = [
  // East side, south to north
  // (The north end of the boulevard is the foot of Aso Rock, which overhangs it: only low shops stand there)
  { kind: 'shops', x: 25, z: -69, width: 7, depth: 14, faces: 'west', colour: SAND, trim: 0x475569 },
  { kind: 'office', x: 25, z: -4.5, width: 12, depth: 16, faces: 'west', floors: 5, colour: STONE, trim: 0x7f1d1d, name: 'Savanna Bank' },
  { kind: 'shops', x: 26, z: 15.5, width: 6, depth: 16, faces: 'west', colour: CREAM, trim: 0x475569 },
  { kind: 'flats', x: 26, z: 78, width: 14, depth: 16, faces: 'west', floors: 4, colour: SAND, trim: 0x78716c },
  { kind: 'hotel', x: 27, z: 99, width: 18, depth: 18, faces: 'west', floors: 8, colour: WHITE, trim: 0x0f5132, name: 'Unity Fountain Hotel' },
  // West side, south to north
  { kind: 'office', x: -25, z: -70, width: 9, depth: 16, faces: 'east', floors: 4, colour: STONE, trim: 0x334155 },
  { kind: 'office', x: -27, z: 100, width: 16, depth: 18, faces: 'east', floors: 6, colour: SKY, trim: 0x1e3a5f },
  { kind: 'shops', x: -25, z: 17, width: 8, depth: 18, faces: 'east', colour: SAND, trim: 0x475569 },
  { kind: 'office', x: -25, z: 46, width: 7, depth: 18, faces: 'east', floors: 3, colour: CREAM, trim: 0x475569 },
  { kind: 'flats', x: -26, z: 80, width: 16, depth: 18, faces: 'east', floors: 5, colour: SAGE, trim: 0x57534e },
  // The streets behind, east: houses in rows
  { kind: 'house', x: 46, z: -58, width: 10, depth: 9, faces: 'west', colour: ROSE, trim: 0x7c2d12 },
  { kind: 'house', x: 46, z: -44, width: 10, depth: 9, faces: 'west', colour: WHITE, trim: 0x9a3412 },
  { kind: 'house', x: 62, z: -30, width: 10, depth: 9, faces: 'west', colour: SAND, trim: 0x1e3a5f },
  { kind: 'house', x: 62, z: -58, width: 10, depth: 9, faces: 'west', colour: CREAM, trim: 0x9a3412 },
  { kind: 'house', x: 62, z: -44, width: 10, depth: 9, faces: 'west', colour: SAGE, trim: 0x7c2d12 },
  { kind: 'house', x: 46, z: 64, width: 10, depth: 9, faces: 'west', colour: WHITE, trim: 0x1e3a5f },
  { kind: 'house', x: 46, z: 78, width: 10, depth: 9, faces: 'west', colour: TERRACOTTA, trim: 0x7c2d12 },
  { kind: 'house', x: 46, z: 92, width: 10, depth: 9, faces: 'west', colour: CREAM, trim: 0x9a3412 },
  // The streets behind, west
  { kind: 'house', x: -62, z: -60, width: 10, depth: 9, faces: 'east', colour: SAND, trim: 0x9a3412 },
  { kind: 'house', x: -48, z: -60, width: 10, depth: 9, faces: 'east', colour: WHITE, trim: 0x7c2d12 },
  { kind: 'house', x: -48, z: -46, width: 10, depth: 9, faces: 'east', colour: ROSE, trim: 0x1e3a5f },
  { kind: 'house', x: -48, z: 12, width: 10, depth: 9, faces: 'east', colour: CREAM, trim: 0x9a3412 },
  { kind: 'flats', x: -50, z: 30, width: 14, depth: 12, faces: 'east', floors: 3, colour: TERRACOTTA, trim: 0x57534e },
];

/** Port Harcourt: Aba Road runs north and south at x = 0. East fronts start at x = 15, west fronts end at x = -15. */
export const PORT_HARCOURT_BUILDINGS: TownBuilding[] = [
  // East side, south to north
  { kind: 'office', x: 25, z: -98, width: 16, depth: 16, faces: 'west', floors: 6, colour: SKY, trim: 0x1e3a5f },
  { kind: 'flats', x: 25, z: -72, width: 16, depth: 16, faces: 'west', floors: 4, colour: SAND, trim: 0x78716c },
  { kind: 'office', x: 24, z: -19, width: 10, depth: 14, faces: 'west', floors: 4, colour: STONE, trim: 0x7f1d1d, name: 'Delta Bank' },
  { kind: 'shops', x: 25, z: 15.5, width: 9, depth: 16, faces: 'west', colour: CREAM, trim: 0x475569 },
  { kind: 'hotel', x: 27, z: 92, width: 18, depth: 18, faces: 'west', floors: 7, colour: WHITE, trim: 0x0c4a6e, name: 'Garden City Hotel' },
  // West side, south to north
  { kind: 'flats', x: -26, z: -60, width: 16, depth: 18, faces: 'east', floors: 4, colour: SAGE, trim: 0x57534e },
  { kind: 'office', x: -25, z: 2.5, width: 11, depth: 16, faces: 'east', floors: 5, colour: STONE, trim: 0x334155 },
  { kind: 'shops', x: -27, z: 30, width: 14, depth: 14, faces: 'east', colour: SAND, trim: 0x475569 },
  { kind: 'flats', x: -26, z: 74, width: 16, depth: 18, faces: 'east', floors: 5, colour: TERRACOTTA, trim: 0x57534e },
  { kind: 'office', x: -26, z: 98, width: 16, depth: 16, faces: 'east', floors: 3, colour: CREAM, trim: 0x475569 },
  // The streets behind, east: houses, between the road and the creek
  { kind: 'house', x: 42, z: -98, width: 10, depth: 9, faces: 'west', colour: CREAM, trim: 0x9a3412 },
  { kind: 'house', x: 42, z: -84, width: 10, depth: 9, faces: 'west', colour: WHITE, trim: 0x1e3a5f },
  { kind: 'house', x: 42, z: -70, width: 10, depth: 9, faces: 'west', colour: ROSE, trim: 0x7c2d12 },
  { kind: 'house', x: 42, z: -22, width: 10, depth: 9, faces: 'west', colour: SAND, trim: 0x9a3412 },
  { kind: 'house', x: 42, z: -8, width: 10, depth: 9, faces: 'west', colour: CREAM, trim: 0x7c2d12 },
  { kind: 'house', x: 42, z: 6, width: 10, depth: 9, faces: 'west', colour: SAGE, trim: 0x9a3412 },
  { kind: 'house', x: 42, z: 66, width: 10, depth: 9, faces: 'west', colour: WHITE, trim: 0x9a3412 },
  { kind: 'house', x: 42, z: 80, width: 10, depth: 9, faces: 'west', colour: TERRACOTTA, trim: 0x1e3a5f },
  // The streets behind, west
  { kind: 'house', x: -50, z: -58, width: 10, depth: 9, faces: 'east', colour: WHITE, trim: 0x7c2d12 },
  { kind: 'house', x: -50, z: -16, width: 10, depth: 9, faces: 'east', colour: CREAM, trim: 0x9a3412 },
  { kind: 'house', x: -50, z: -2, width: 10, depth: 9, faces: 'east', colour: ROSE, trim: 0x1e3a5f },
  { kind: 'house', x: -50, z: 26, width: 10, depth: 9, faces: 'east', colour: SAND, trim: 0x9a3412 },
  { kind: 'house', x: -50, z: 40, width: 10, depth: 9, faces: 'east', colour: SAGE, trim: 0x7c2d12 },
  { kind: 'house', x: -50, z: 74, width: 10, depth: 9, faces: 'east', colour: CREAM, trim: 0x9a3412 },
];
