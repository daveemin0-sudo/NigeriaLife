import type { Rect } from '../world/plan/CityPlan';
import type { Facing, TownBuilding } from '../world/kit/Townscape';
import { between, junctionsOf, type GridRoad } from '../world/plan/GridRoads';

/**
 * Lines a planned city's avenues with buildings: along each side of each road, between its
 * junctions, set back from the pavement, one after another with a gap between, each chosen from
 * what that district builds (towers in a business district, shops and flats in a market quarter,
 * villas in a leafy one). Nothing is put where it would stand in another building, a landmark's
 * ground, a park or a lake. The same seed gives the same streets every time.
 */

export interface BuildKind {
  kind: TownBuilding['kind'];
  weight: number;
  width: [number, number];
  depth: [number, number];
  floors?: [number, number];
}

export interface District {
  name: string;
  /** The ground it covers: a frontage belongs to the district its middle is in */
  rect: Rect;
  kinds: BuildKind[];
  colours: number[];
  trims: number[];
  /** Back from the pavement, and the gap between one building and the next */
  setback: [number, number];
  gap: [number, number];
}

function seeded(seed: number): () => number {
  let s = seed >>> 0 || 1;
  return () => {
    s = (Math.imul(s ^ (s >>> 15), 2246822507) + 0x6d2b79f5) >>> 0;
    s = Math.imul(s ^ (s >>> 13), 3266489909) >>> 0;
    return ((s ^ (s >>> 16)) >>> 0) / 4294967296;
  };
}

const inside = (r: Rect, x: number, z: number) => x >= r.minX && x <= r.maxX && z >= r.minZ && z <= r.maxZ;
const overlaps = (a: Rect, b: Rect, pad = 0) => a.minX < b.maxX + pad && a.maxX > b.minX - pad && a.minZ < b.maxZ + pad && a.maxZ > b.minZ - pad;

export function fillFrontages(roads: readonly GridRoad[], districts: District[], keepOut: Rect[], seed: number, already: TownBuilding[] = []): TownBuilding[] {
  const rand = seeded(seed);
  const pick = <T,>(list: T[]) => list[Math.floor(rand() * list.length) % list.length];
  const between2 = (r: [number, number]) => r[0] + rand() * (r[1] - r[0]);
  const junctions = junctionsOf(roads);
  const placed: Rect[] = already.map((b) => footprintOf(b));
  const out: TownBuilding[] = [];
  for (const road of roads) {
    if (road.drawn) continue;
    for (const [a, b] of between(road, junctions, 14)) {
      for (const side of [-1, 1] as const) {
        let u = a + 2;
        while (u < b - 8) {
          // Which district this stretch of frontage is in
          const edge = road.halfRoad + road.walk;
          const probe = road.axis === 'z' ? { x: road.fixed + side * (edge + 10), z: u + 6 } : { x: u + 6, z: road.fixed + side * (edge + 10) };
          const district = districts.find((d) => inside(d.rect, probe.x, probe.z));
          if (!district) {
            u += 12;
            continue;
          }
          const total = district.kinds.reduce((s, k) => s + k.weight, 0);
          let roll = rand() * total;
          const kind = district.kinds.find((k) => (roll -= k.weight) <= 0) ?? district.kinds[0];
          const width = Math.round(between2(kind.width));
          const depth = Math.round(between2(kind.depth));
          if (u + width > b - 2) break;
          const setback = between2(district.setback);
          const front = edge + setback;
          const mid = u + width / 2;
          // Facing the road: a building east of a north-south road looks west, south of an east-west road looks north
          const faces: Facing = road.axis === 'z' ? (side > 0 ? 'west' : 'east') : side > 0 ? 'north' : 'south';
          const centre = road.axis === 'z'
            ? { x: road.fixed + side * (front + depth / 2), z: mid }
            : { x: mid, z: road.fixed + side * (front + depth / 2) };
          const one: TownBuilding = {
            kind: kind.kind,
            x: +centre.x.toFixed(2),
            z: +centre.z.toFixed(2),
            width,
            depth,
            faces,
            colour: pick(district.colours),
            trim: pick(district.trims),
            ...(kind.floors ? { floors: Math.round(between2(kind.floors)) } : {}),
          };
          const rect = footprintOf(one);
          if (keepOut.some((k) => overlaps(k, rect, 2)) || placed.some((p) => overlaps(p, rect, 3))) {
            u += 10;
            continue;
          }
          placed.push(rect);
          out.push(one);
          u += width + between2(district.gap);
        }
      }
    }
  }
  return out;
}

/** The ground a building stands on, turned the way it faces */
export function footprintOf(b: TownBuilding): Rect {
  const alongX = b.faces === 'north' || b.faces === 'south';
  const w = alongX ? b.width : b.depth;
  const d = alongX ? b.depth : b.width;
  return { minX: b.x - w / 2, maxX: b.x + w / 2, minZ: b.z - d / 2, maxZ: b.z + d / 2 };
}
