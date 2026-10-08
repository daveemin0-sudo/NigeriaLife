/**
 * StreetLayout
 * Single source of truth for the Lagos street grid around Broad Street.
 * Roads, city fabric, traffic and pedestrians all read these values.
 */

export interface SideStreet {
  id: string;
  name: string;
  /** Axis the street runs along */
  axis: 'x' | 'z';
  /** Coordinate on the other axis */
  fixed: number;
  from: number;
  to: number;
  halfRoad: number;
  walk: number;
  /** Carries moving traffic (otherwise parked cars and pedestrians only) */
  traffic: boolean;
}

export const MAIN_ROAD = {
  halfRoad: 7,
  walk: 6.5,
  zMin: -120,
  zMax: 120,
  sidewalkTop: 0.28,
};

/** Outer edge of the Broad Street sidewalks */
export const MAIN_CORRIDOR_HALF = MAIN_ROAD.halfRoad + MAIN_ROAD.walk;

export const CROSS_STREET_Z = -62;

export const SIDE_STREETS: SideStreet[] = [
  { id: 'cross', name: 'Martins Street', axis: 'x', fixed: CROSS_STREET_Z, from: -116, to: 116, halfRoad: 4.5, walk: 2.5, traffic: true },
  { id: 'north_cap', name: 'Nnamdi Azikiwe Street', axis: 'x', fixed: -124, from: -52, to: 116, halfRoad: 4, walk: 2.2, traffic: false },
  { id: 'back_west', name: 'Odunlami Street', axis: 'z', fixed: -46, from: -120, to: -8, halfRoad: 3.5, walk: 2, traffic: false },
  { id: 'back_east', name: 'Kakawa Street', axis: 'z', fixed: 44, from: -120, to: 94, halfRoad: 3.5, walk: 2, traffic: false },
];

/** Z ranges where Broad Street's sidewalks, kerbs and gutters open for a junction */
export const MAIN_JUNCTION_GAPS: Array<[number, number]> = [[CROSS_STREET_Z - 4.5, CROSS_STREET_Z + 4.5]];

export function isInJunctionGap(z: number): boolean {
  return MAIN_JUNCTION_GAPS.some(([a, b]) => z >= a && z <= b);
}

/** Splits [from, to] into the stretches that are not inside a junction gap */
export function splitAroundJunctions(from: number, to: number): Array<[number, number]> {
  const out: Array<[number, number]> = [];
  let start = from;
  for (const [a, b] of [...MAIN_JUNCTION_GAPS].sort((p, q) => p[0] - q[0])) {
    if (b <= start || a >= to) continue;
    if (a > start) out.push([start, a]);
    start = Math.max(start, b);
  }
  if (start < to) out.push([start, to]);
  return out;
}
