import type { Rect, Zone } from './CityPlan';

/**
 * The pavements a driven car may not go onto, at any speed.
 *
 * A car keeps to the carriageway. At speed the kerb already turned it back (DrivableVehicle.onRoad),
 * but below about 11 km/h it could be eased up onto the pavement and driven along it, between the
 * buildings and into the spaces behind them. Now every pavement is a barrier like a wall: a car
 * scrapes along the kerb and cannot mount it. It may cross only at a way in made for vehicles: the
 * mouth of a forecourt, a motor park's gate, the gate of a compound, the frontage of a place on the
 * expressway. Junctions are not pavement (the city plan cuts the pavements there).
 *
 * A car that is already on a pavement (left there in an old save, or set down there) may always
 * drive off it: towards the road, never further from it.
 *
 * The ways across are cut out of the pavements themselves, so what is left is exactly the pavement
 * a car may not touch. (They used to be checked point by point, and a point just short of a way in
 * still caught the pavement beyond its edge by the car's width: at the mouth of Banana Island Road
 * the car stopped two metres before Martins Street, both ways.)
 */
export interface KerbSet {
  /** Is anything within `r` of (x, z) pavement a car may not drive on? */
  at(x: number, z: number, r: number): boolean;
  /** How far (x, z) is from the nearest carriageway, metres (0 on one) */
  offRoad(x: number, z: number): number;
  /** The pavements and the ways across them, for tests and the map */
  readonly pavements: readonly Rect[];
  readonly openings: readonly Rect[];
  /** The mouths of the roads where they meet another across its pavement: road, at any speed (the rest of the openings are driveways, to be turned into slowly) */
  readonly junctions: readonly Rect[];
}

const inside = (r: Rect, x: number, z: number, pad: number) => x >= r.minX - pad && x <= r.maxX + pad && z >= r.minZ - pad && z <= r.maxZ + pad;

/** How far each side of a road's mouth the kerb is dropped, for the corner a turning car cuts */
export const MOUTH_CORNER = 1.5;

/** A way in for vehicles: `width` wide, centred on (x, z) at the edge of the place it leads into, running `reach` metres along (dx, dz) toward the road and `into` metres the other way */
export function wayIn(x: number, z: number, dx: number, dz: number, width: number, reach = 14, into = 2): Rect {
  const ax = x + dx * reach;
  const az = z + dz * reach;
  const bx = x - dx * into;
  const bz = z - dz * into;
  const half = width / 2;
  return {
    minX: Math.min(ax, bx) - (dz !== 0 ? half : 0),
    maxX: Math.max(ax, bx) + (dz !== 0 ? half : 0),
    minZ: Math.min(az, bz) - (dx !== 0 ? half : 0),
    maxZ: Math.max(az, bz) + (dx !== 0 ? half : 0),
  };
}

/** Rects overlap (more than touching) */
const overlaps = (a: Rect, b: Rect) => a.minX < b.maxX && a.maxX > b.minX && a.minZ < b.maxZ && a.maxZ > b.minZ;

/**
 * Where a road ends at the pavement of another road, a T-junction: the road carries on across that
 * pavement to the other carriageway (Odunlami and Kakawa Streets meet Nnamdi Azikiwe Street so, with
 * its pavement drawn across their mouths). Each road end is carried up to 8 m on, as wide as the road
 * and a dropped corner either side, and is an opening where that reaches another carriageway.
 */
function roadMouths(roads: readonly Zone[]): Rect[] {
  const mouths: Rect[] = [];
  const REACH = 8;
  for (const road of roads) {
    const ends: Rect[] = road.axis === 'z'
      ? [{ minX: road.minX, maxX: road.maxX, minZ: road.minZ - REACH, maxZ: road.minZ + 0.1 }, { minX: road.minX, maxX: road.maxX, minZ: road.maxZ - 0.1, maxZ: road.maxZ + REACH }]
      : [{ minX: road.minX - REACH, maxX: road.minX + 0.1, minZ: road.minZ, maxZ: road.maxZ }, { minX: road.maxX - 0.1, maxX: road.maxX + REACH, minZ: road.minZ, maxZ: road.maxZ }];
    for (const end of ends) {
      if (!roads.some((other) => other !== road && overlaps(end, other))) continue;
      const C = MOUTH_CORNER;
      mouths.push(road.axis === 'z' ? { ...end, minX: end.minX - C, maxX: end.maxX + C } : { ...end, minZ: end.minZ - C, maxZ: end.maxZ + C });
    }
  }
  return mouths;
}

/** What is left of `a` with `b` taken out of it: up to four rects */
function without(a: Rect, b: Rect): Rect[] {
  if (!overlaps(a, b)) return [a];
  const out: Rect[] = [];
  if (b.minX > a.minX) out.push({ minX: a.minX, maxX: b.minX, minZ: a.minZ, maxZ: a.maxZ });
  if (b.maxX < a.maxX) out.push({ minX: b.maxX, maxX: a.maxX, minZ: a.minZ, maxZ: a.maxZ });
  const minX = Math.max(a.minX, b.minX);
  const maxX = Math.min(a.maxX, b.maxX);
  if (b.minZ > a.minZ) out.push({ minX, maxX, minZ: a.minZ, maxZ: b.minZ });
  if (b.maxZ < a.maxZ) out.push({ minX, maxX, minZ: b.maxZ, maxZ: a.maxZ });
  return out.filter((r) => r.maxX - r.minX > 0.05 && r.maxZ - r.minZ > 0.05);
}

/**
 * `extraRoads`: carriageways a car drives on that are not streets of the city plan (Banana Island's
 * estate avenue and its closes): they cut the pavements they cross like any road, and meet them at a mouth.
 */
export function kerbsFrom(zones: readonly Zone[], extraPavements: readonly Rect[], ways: readonly Rect[], extraRoads: readonly Zone[] = []): KerbSet {
  const roads = [...zones.filter((z) => z.kind === 'carriageway'), ...extraRoads];
  // Where a pavement is laid over a carriageway (the end of a side street under the pavement of the
  // street it meets), the road wins: that part is not pavement
  let pavements: Rect[] = [...zones.filter((z) => z.kind === 'walkway'), ...extraPavements];
  for (const road of roads) pavements = pavements.flatMap((walk) => without(walk, road));
  const junctions = roadMouths(roads);
  const openings = [...ways, ...junctions];
  // And where a way crosses a pavement, that part is not pavement either
  for (const way of openings) pavements = pavements.flatMap((walk) => without(walk, way));
  return {
    pavements,
    openings,
    junctions,
    at(x, z, r) {
      for (const walk of pavements) if (inside(walk, x, z, r)) return true;
      return false;
    },
    offRoad(x, z) {
      let best = Infinity;
      for (const road of roads) {
        const dx = Math.max(road.minX - x, 0, x - road.maxX);
        const dz = Math.max(road.minZ - z, 0, z - road.maxZ);
        const d = Math.hypot(dx, dz);
        if (d < best) best = d;
      }
      return best;
    },
  };
}
