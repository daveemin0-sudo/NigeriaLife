import type { TrafficPlan } from '../traffic/TrafficSpawner';
import type { WalkRun } from '../density/CityFabric';
import type { Zone } from './CityPlan';

/**
 * The road grid of a planned city (Abuja, Port Harcourt): avenues that run north-south and
 * east-west across each other, each a carriageway with a pavement either side, crossing at
 * junctions with lights. From one list of roads come the city plan's zones (where cars drive,
 * where people walk, cut at the junctions), the traffic's lanes with a stop line before every
 * junction, and the pavements the crowd walks. The drawing is src/cities/CityGrid.ts.
 *
 * Coordinates are world metres. A road along z runs north-south at x = `fixed`; a road along x
 * runs east-west at z = `fixed`. Traffic keeps to the right: going +z the driver's right is -x.
 */

/** As the city plan's: a lane's clear width, and a pavement's */
const CLEAR_LANE = 3.2;
const CLEAR_WALKWAY = 1.2;

export interface GridRoad {
  id: string;
  name: string;
  axis: 'x' | 'z';
  fixed: number;
  from: number;
  to: number;
  /** Half the carriageway, both ways together */
  halfRoad: number;
  walk: number;
  /** Lane centres each way, metres out from the middle */
  lanes: readonly number[];
  /** Half the width of a raised median; 0 for a painted line */
  median: number;
  /** Cars on it (the airport's own road has none) */
  traffic?: boolean;
  /** Drawn by something else (an airport's approach): only its zones come from here */
  drawn?: boolean;
  /** Open road between one car and the next when it is busy, metres */
  gap?: number;
  /** Lamps every so many metres; 0 for none */
  lampEvery?: number;
}


export interface Junction {
  x: number;
  z: number;
  /** The road along z and the road along x */
  ns: GridRoad;
  ew: GridRoad;
}

const near = (v: number, a: number, b: number, pad: number) => v >= Math.min(a, b) - pad && v <= Math.max(a, b) + pad;

/** Where two roads cross (or one meets the other): its middle, and the two roads */
export function junctionsOf(roads: readonly GridRoad[]): Junction[] {
  const out: Junction[] = [];
  for (const ns of roads) {
    if (ns.axis !== 'z') continue;
    for (const ew of roads) {
      if (ew.axis !== 'x') continue;
      if (near(ew.fixed, ns.from, ns.to, ew.halfRoad + ew.walk) && near(ns.fixed, ew.from, ew.to, ns.halfRoad + ns.walk)) out.push({ x: ns.fixed, z: ew.fixed, ns, ew });
    }
  }
  return out;
}

/** The stretches of a road between the junctions on it, as [from, to] along it, leaving out each crossing carriageway */
export function between(road: GridRoad, junctions: readonly Junction[], pad = 0): Array<[number, number]> {
  const cuts = junctions
    .filter((j) => j.ns === road || j.ew === road)
    .map((j) => {
      const other = j.ns === road ? j.ew : j.ns;
      const at = road.axis === 'z' ? j.z : j.x;
      return [at - other.halfRoad - pad, at + other.halfRoad + pad] as [number, number];
    })
    .sort((a, b) => a[0] - b[0]);
  const out: Array<[number, number]> = [];
  let start = Math.min(road.from, road.to);
  const end = Math.max(road.from, road.to);
  for (const [a, b] of cuts) {
    if (a > start) out.push([start, Math.min(a, end)]);
    start = Math.max(start, b);
  }
  if (end > start) out.push([start, end]);
  return out.filter(([a, b]) => b - a > 0.5);
}

/** A rectangle along a road: from `a` to `b` along it, from `c` to `d` across it (from its middle) */
export function strip(road: GridRoad, a: number, b: number, c: number, d: number) {
  const lo = Math.min(c, d);
  const hi = Math.max(c, d);
  return road.axis === 'z'
    ? { minX: road.fixed + lo, maxX: road.fixed + hi, minZ: Math.min(a, b), maxZ: Math.max(a, b) }
    : { minX: Math.min(a, b), maxX: Math.max(a, b), minZ: road.fixed + lo, maxZ: road.fixed + hi };
}

/** The city plan's zones: a carriageway for each road, its pavements cut where other roads cross */
export function gridZones(roads: readonly GridRoad[]): Zone[] {
  const junctions = junctionsOf(roads);
  const zones: Zone[] = [];
  for (const road of roads) {
    // A road that meets another reaches into it, so a car turns off one straight onto the other
    const reach = junctions.filter((j) => j.ns === road || j.ew === road).map((j) => (road.axis === 'z' ? j.z : j.x));
    const lo = Math.min(road.from, road.to, ...reach);
    const hi = Math.max(road.from, road.to, ...reach);
    // A narrow road (an airport's own) keeps clear what it is wide, less a little
    zones.push({ id: `${road.id}:road`, kind: 'carriageway', street: road.name, axis: road.axis, clear: Math.min(CLEAR_LANE * 2, road.halfRoad * 2 - 0.4), lanes: road.lanes, ...strip(road, lo, hi, -road.halfRoad, road.halfRoad) });
    between(road, junctions).forEach(([a, b], i) => {
      for (const side of [-1, 1]) {
        zones.push({
          id: `${road.id}:walk:${side < 0 ? 'a' : 'b'}:${i}`, kind: 'walkway', street: road.name, axis: road.axis, clear: CLEAR_WALKWAY,
          ...strip(road, a, b, side * road.halfRoad, side * (road.halfRoad + road.walk)),
        });
      }
    });
  }
  return zones;
}

/** Each pavement as a run for the crowd to walk, a walker every `every` metres */
export function gridWalkRuns(roads: readonly GridRoad[], every: number, skip: (road: GridRoad) => boolean = () => false): WalkRun[] {
  const junctions = junctionsOf(roads);
  const runs: WalkRun[] = [];
  for (const road of roads) {
    if (skip(road) || road.drawn) continue;
    for (const [a, b] of between(road, junctions, 1)) {
      for (const side of [-1, 1]) runs.push({ axis: road.axis, fixed: road.fixed + side * (road.halfRoad + road.walk / 2), from: a, to: b, every });
    }
  }
  return runs;
}

/** The traffic: each lane each way of each road, with a stop line before every junction on it and the lights' posts */
export function gridTraffic(roads: readonly GridRoad[], extra: { stops?: (road: GridRoad, dir: 1 | -1) => number[] } = {}): Pick<TrafficPlan, 'lanes' | 'signals'> {
  const junctions = junctionsOf(roads).filter((j) => j.ns.traffic !== false && j.ew.traffic !== false);
  const lanes: TrafficPlan['lanes'] = [];
  const signals: TrafficPlan['signals'] = [];
  for (const road of roads) {
    if (road.traffic === false) continue;
    const group = road.axis === 'z' ? 'main' : 'cross';
    const mine = junctions.filter((j) => j.ns === road || j.ew === road);
    const outer = road.lanes[road.lanes.length - 1];
    for (const lane of road.lanes) {
      for (const dir of [1, -1] as const) {
        // Going +along: along z the driver's right is -x; along x (east, +x) it is +z
        const side = road.axis === 'z' ? -dir : dir;
        const at = (j: Junction) => (road.axis === 'z' ? j.z : j.x);
        const crossing = (j: Junction) => (j.ns === road ? j.ew : j.ns);
        const stops = mine.map((j) => ({ u: dir * at(j) - crossing(j).halfRoad - crossing(j).walk - 1.5, group: group as 'main' | 'cross' }));
        for (const u of extra.stops?.(road, dir) ?? []) stops.push({ u, group });
        lanes.push({
          axis: road.axis,
          fixed: road.fixed + side * lane,
          dir,
          uMin: dir > 0 ? road.from - 4 : -(road.to + 4),
          uMax: dir > 0 ? road.to + 4 : -(road.from - 4),
          stops: stops.sort((a, b) => a.u - b.u),
          busStops: [],
          heavy: lane === outer,
          keke: lane === outer,
          gap: road.gap ?? 40,
        });
      }
    }
    // A post at the kerb on the right of each way, before each junction, facing the traffic coming
    for (const j of mine) {
      const other = road === j.ns ? j.ew : j.ns;
      const off = other.halfRoad + other.walk + 1.2;
      const kerb = road.halfRoad + 0.6;
      if (road.axis === 'z') {
        signals.push({ x: j.x - kerb, z: j.z - off, yaw: Math.PI, group });
        signals.push({ x: j.x + kerb, z: j.z + off, yaw: 0, group });
      } else {
        signals.push({ x: j.x - off, z: j.z + kerb, yaw: -Math.PI / 2, group });
        signals.push({ x: j.x + off, z: j.z - kerb, yaw: Math.PI / 2, group });
      }
    }
  }
  return { lanes, signals };
}


// --- Abuja ------------------------------------------------------------------------------------

/** Abuja's avenues off the spine: two lanes each way either side of a planted median */
const ABUJA_AVENUE_ROAD = { halfRoad: 8, walk: 3, lanes: [2.4, 5.9] as readonly number[], median: 0.9, gap: 170, lampEvery: 40 };
/** A street inside a district: a lane each way, a painted line, a narrower pavement */
const ABUJA_STREET = { halfRoad: 4.2, walk: 2.4, lanes: [2.1] as readonly number[], median: 0, traffic: false, lampEvery: 32 };

/**
 * Abuja, planned as it is: Shehu Shagari Way runs south from the lookout under Aso Rock through
 * the Central Area to the city's south edge, with Herbert Macaulay Way to the west and Aminu Kano
 * Crescent to the east; Ahmadu Bello Way, Independence Avenue and Constitution Avenue cross all
 * three from west to east. Between them lie the districts: the Central Business District, Wuse,
 * Maitama, Garki, Millennium Park and Jabi Lake. North is -z (Aso Rock is at the north end).
 */
export const ABUJA_ROADS: GridRoad[] = [
  { id: 'shagari', name: 'Shehu Shagari Way', axis: 'z', fixed: 0, from: -88, to: 760, halfRoad: 10, walk: 3, lanes: [3.3, 7.75], median: 1.1, gap: 44, lampEvery: 30 },
  { id: 'macaulay', name: 'Herbert Macaulay Way', axis: 'z', fixed: -380, from: -60, to: 760, ...ABUJA_AVENUE_ROAD },
  { id: 'aminu', name: 'Aminu Kano Crescent', axis: 'z', fixed: 380, from: -60, to: 760, ...ABUJA_AVENUE_ROAD },
  { id: 'bello', name: 'Ahmadu Bello Way', axis: 'x', fixed: 170, from: -560, to: 560, ...ABUJA_AVENUE_ROAD },
  { id: 'independence', name: 'Independence Avenue', axis: 'x', fixed: 430, from: -560, to: 560, ...ABUJA_AVENUE_ROAD },
  { id: 'constitution', name: 'Constitution Avenue', axis: 'x', fixed: 690, from: -560, to: 560, ...ABUJA_AVENUE_ROAD },
  // Through streets across the business district and Wuse, with traffic
  { id: 'shodeinde', name: 'Ralph Shodeinde Street', axis: 'x', fixed: 318, from: 0, to: 380, ...ABUJA_STREET, traffic: true, gap: 220 },
  { id: 'ademola', name: 'Adetokunbo Ademola Crescent', axis: 'x', fixed: 318, from: -380, to: 0, ...ABUJA_STREET, traffic: true, gap: 220 },
  // The quiet streets inside the districts: houses, shops and offices on both sides, no through traffic
  { id: 'gana', name: 'Gana Street', axis: 'x', fixed: 60, from: 90, to: 380, ...ABUJA_STREET },
  { id: 'usuma', name: 'Usuma Street', axis: 'z', fixed: -280, from: 170, to: 430, ...ABUJA_STREET },
  { id: 'garki-road', name: 'Garki Road', axis: 'x', fixed: 560, from: -380, to: 0, ...ABUJA_STREET },
  { id: 'lagos-street', name: 'Lagos Street', axis: 'z', fixed: -190, from: 430, to: 690, ...ABUJA_STREET },
  { id: 'utako-street', name: 'Utako Street', axis: 'z', fixed: 470, from: 170, to: 690, ...ABUJA_STREET },
  { id: 'gwarinpa-1st', name: 'Gwarinpa 1st Avenue', axis: 'z', fixed: -470, from: -60, to: 170, ...ABUJA_STREET },
  { id: 'asokoro-close', name: 'Asokoro Close', axis: 'z', fixed: 470, from: -60, to: 170, ...ABUJA_STREET },
  { id: 'jabi-road', name: 'Jabi Road', axis: 'z', fixed: -470, from: 430, to: 690, ...ABUJA_STREET },
  // The airport's own road, out of its forecourt and round to Shehu Shagari Way (the airport draws it)
  { id: 'abv-forecourt', name: 'Airport Road', axis: 'z', fixed: -80, from: 103, to: 119, halfRoad: 3, walk: 1.8, lanes: [1.5], median: 0, traffic: false, drawn: true },
  { id: 'abv-approach', name: 'Airport Road', axis: 'x', fixed: 116, from: -83, to: -10, halfRoad: 3, walk: 1.8, lanes: [1.5], median: 0, traffic: false, drawn: true },
];

// --- Port Harcourt ------------------------------------------------------------------------------

/** Port Harcourt's roads: no median, a yellow line down the middle, two lanes each way */
const PH_ROAD = { halfRoad: 7.5, walk: 3, lanes: [1.9, 5.5] as readonly number[], median: 0, gap: 130, lampEvery: 36 };
/** A street off them: a lane each way, an open drain under the kerb */
const PH_STREET = { halfRoad: 3.8, walk: 2.1, lanes: [1.9] as readonly number[], median: 0, traffic: false, lampEvery: 34 };

/**
 * Port Harcourt, the Garden City: Aba Road runs north and south through the middle with Ikwerre
 * Road to the west; the creek runs down the east side, and beyond it Trans-Amadi, the industrial
 * layout, with its own road. Rumuola Road, Olu Obasanjo Road and Azikiwe Road cross the whole city
 * from west to east, over the creek on bridges. North is -z (the airport is to the north-west).
 */
export const PH_ROADS: GridRoad[] = [
  { id: 'aba', name: 'Aba Road', axis: 'z', fixed: 0, from: -260, to: 540, halfRoad: 9, walk: 3.5, lanes: [2.25, 6.6], median: 0, gap: 34, lampEvery: 30 },
  { id: 'ikwerre', name: 'Ikwerre Road', axis: 'z', fixed: -280, from: -260, to: 540, ...PH_ROAD, gap: 90 },
  { id: 'trans-amadi', name: 'Trans-Amadi Road', axis: 'z', fixed: 300, from: -260, to: 540, ...PH_ROAD },
  { id: 'rumuola', name: 'Rumuola Road', axis: 'x', fixed: -200, from: -540, to: 520, ...PH_ROAD },
  { id: 'olu-obasanjo', name: 'Olu Obasanjo Road', axis: 'x', fixed: 180, from: -540, to: 520, ...PH_ROAD, gap: 100 },
  { id: 'azikiwe', name: 'Azikiwe Road', axis: 'x', fixed: 380, from: -540, to: 520, ...PH_ROAD },
  // The streets inside the districts
  { id: 'tombia', name: 'Tombia Street', axis: 'z', fixed: -190, from: -200, to: 180, ...PH_STREET },
  { id: 'forces', name: 'Forces Avenue', axis: 'x', fixed: 20, from: -280, to: -60, ...PH_STREET },
  { id: 'aggrey', name: 'Aggrey Road', axis: 'x', fixed: 280, from: -280, to: 0, ...PH_STREET },
  { id: 'ojoto', name: 'Ojoto Street', axis: 'z', fixed: -80, from: 380, to: 540, ...PH_STREET },
  { id: 'diobu', name: 'Diobu Road', axis: 'z', fixed: -420, from: -200, to: 180, ...PH_STREET },
  { id: 'diobu-south', name: 'Diobu Road', axis: 'z', fixed: -420, from: 380, to: 540, ...PH_STREET },
  { id: 'woji', name: 'Woji Road', axis: 'z', fixed: 430, from: -200, to: 540, ...PH_STREET },
  { id: 'industrial', name: 'Industrial Layout Road', axis: 'x', fixed: -20, from: 300, to: 520, ...PH_STREET },
  // The airport's own road (the airport draws it)
  { id: 'phc-forecourt', name: 'Airport Road', axis: 'z', fixed: -80, from: -93, to: -75, halfRoad: 3, walk: 1.8, lanes: [1.5], median: 0, traffic: false, drawn: true },
  { id: 'phc-approach', name: 'Airport Road', axis: 'x', fixed: -78, from: -83, to: -9, halfRoad: 3, walk: 1.8, lanes: [1.5], median: 0, traffic: false, drawn: true },
];

/** Where the creek runs: down the east side, crossed only by the bridges */
export const PH_CREEK = { minX: 51, maxX: 79, from: -270, to: 550 };
