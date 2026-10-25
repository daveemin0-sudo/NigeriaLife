import { EXPRESS } from '../expressway/layout';
/**
 * StreetLayout
 * Single source of truth for the Lagos street grid around Broad Street.
 * Roads, city fabric, traffic and pedestrians all read these values.
 */

/**
 * The footbridge over Broad Street, in one place: the road furniture is built from it and
 * whoever walks over it is carried by it. The deck crosses the road; a flight of stairs
 * comes up to it from the pavement on each side, climbing northward to the deck's south edge.
 */
export const FOOTBRIDGE = {
  /** Where the deck crosses, along the road */
  z: 28,
  /** Half the deck's length across the road, and half its width along it */
  halfSpan: 12,
  halfWidth: 1.6,
  /** The walking surface of the deck, above the road */
  top: 5.65,
  /** The stairs: where each stands across the road, half its width, and how it runs along the road */
  stairX: 11.2,
  stairHalfWidth: 0.75,
  steps: 14,
  run: 0.85,
};
/** Every footbridge over Broad Street, by where its deck crosses (all the same shape as FOOTBRIDGE) */
export const FOOTBRIDGES: number[] = [FOOTBRIDGE.z, -33, -110, 116];

export type BridgeShape = Omit<typeof FOOTBRIDGE, 'z'>;

/**
 * The expressway's footbridges: wider, higher, their stairs on the pavement beyond the kerb.
 * They are climbed the same way: from the foot of the stairs, northward, up to the deck.
 */
export const EXPRESS_BRIDGE: BridgeShape = { halfSpan: EXPRESS.half + 3.5, halfWidth: 1.3, top: 6.55, stairX: EXPRESS.half + 2.2, stairHalfWidth: 1.0, steps: 12, run: 0.7 };
export const EXPRESS_BRIDGES: number[] = (() => {
  const out: number[] = [];
  for (let z = 400; z < EXPRESS.to; z += 400) {
    const water = z > EXPRESS.lagoonFrom - 20 && z < EXPRESS.lagoonTo + 20;
    if (z > EXPRESS.from + 100 && Math.abs(z - EXPRESS.toll) > 60 && !water) out.push(z);
  }
  return out;
})();

const ALL_BRIDGES: Array<{ z: number; shape: BridgeShape }> = [
  ...FOOTBRIDGES.map((z) => ({ z, shape: FOOTBRIDGE as BridgeShape })),
  ...EXPRESS_BRIDGES.map((z) => ({ z, shape: EXPRESS_BRIDGE })),
];

/** The footbridge a point is at or nearest to: where its deck crosses, where its stairs start and reach the deck, and its shape */
export function bridgeNear(z: number): { z: number; top: number; bottom: number; shape: BridgeShape } {
  let best = ALL_BRIDGES[0];
  // Measured from the middle of bridge and stairs together
  const middle = (b: { z: number; shape: BridgeShape }) => b.z - (b.shape.steps * b.shape.run) / 2;
  for (const b of ALL_BRIDGES) if (Math.abs(middle(b) - z) < Math.abs(middle(best) - z)) best = b;
  const top = best.z - best.shape.halfWidth;
  return { z: best.z, top, bottom: top - best.shape.steps * best.shape.run, shape: best.shape };
}

/** Where the stairs start at the pavement and where they reach the deck, along the road */
export const FOOTBRIDGE_STAIR = {
  top: FOOTBRIDGE.z - FOOTBRIDGE.halfWidth,
  bottom: FOOTBRIDGE.z - FOOTBRIDGE.halfWidth - FOOTBRIDGE.steps * FOOTBRIDGE.run,
};

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
  // The estate road of Banana Island, off the east end of Martins Street
  { id: 'banana', name: 'Banana Island Road', axis: 'z', fixed: 112, from: -55, to: 14, halfRoad: 4, walk: 2.2, traffic: false },
  // The ways in to the great places on the west side: each runs from a street to a gate
  { id: 'stadium', name: 'Stadium Road', axis: 'x', fixed: 5, from: -42, to: -14, halfRoad: 3, walk: 1.8, traffic: false },
  { id: 'wharf', name: 'Wharf Road', axis: 'x', fixed: 48, from: -44.5, to: -13.5, halfRoad: 3, walk: 1.8, traffic: false },
  { id: 'airport', name: 'Airport Road', axis: 'z', fixed: -80, from: -90, to: -62, halfRoad: 3, walk: 1.8, traffic: false },
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
