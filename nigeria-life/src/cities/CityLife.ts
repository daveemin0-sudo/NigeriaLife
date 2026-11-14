import * as THREE from 'three';
import { TrafficSpawner, type TrafficPlan } from '../world/traffic/TrafficSpawner';
import { CityPopulation, type CrowdPlan } from '../world/population/CityPopulation';
import { ABUJA_AVENUE, PORT_HARCOURT_AVENUE } from '../world/plan/CityPlan';
import { ABUJA_ROADS, PH_ROADS, gridTraffic, gridWalkRuns, junctionsOf, type GridRoad } from '../world/plan/GridRoads';
import type { Crossing } from '../world/population/CityPopulation';
import { shareAbroad } from '../world/StreetLife';
import type { CarBody, PersonBody } from '../world/Bodies';
import { StreetStalls, type StallSells, type StallSpot } from '../world/street/StreetStalls';
import type { OpeningHours } from '../destinations/Hours';

/**
 * Where each city's roadside traders set up: by the places that draw them (a market, the offices,
 * a hotel's evening trade), on the building edge of the avenue's pavement. A believable few in
 * orderly Abuja; Aba Road in Port Harcourt busy with them.
 */
interface StallAnchor {
  /** The door they gather by (its name) */
  near: RegExp;
  sells: StallSells;
  count: number;
  /** How far up and down the pavement from the door they may stand, metres */
  spread: number;
}
const STALL_ANCHORS: Record<'abuja' | 'port_harcourt', StallAnchor[]> = {
  abuja: [
    { near: /wuse farmers market/i, sells: 'goods', count: 3, spread: 18 },
    { near: /^central area offices$/i, sells: 'food', count: 1, spread: 12 },
    { near: /federal secretariat/i, sells: 'food', count: 1, spread: 12 },
    { near: /central area supermarket/i, sells: 'food', count: 1, spread: 10 },
    { near: /unity fountain hotel/i, sells: 'suya', count: 1, spread: 12 },
    { near: /central area offices 2/i, sells: 'suya', count: 1, spread: 12 },
  ],
  // Aba Road: traders all along the market stretch, food by the offices and the motor park, suya
  // by Bole King and the hotel of an evening
  port_harcourt: [
    { near: /mile 1 creek market/i, sells: 'goods', count: 8, spread: 42 },
    { near: /aba road supermarket/i, sells: 'goods', count: 3, spread: 24 },
    { near: /^aba road offices$/i, sells: 'food', count: 2, spread: 20 },
    { near: /^aba road offices 2$/i, sells: 'food', count: 2, spread: 20 },
    { near: /^aba road offices 3$/i, sells: 'food', count: 1, spread: 20 },
    { near: /waterlines motor park, good/i, sells: 'food', count: 2, spread: 24 },
    { near: /bole king/i, sells: 'suya', count: 2, spread: 30 },
    { near: /garden city hotel/i, sells: 'suya', count: 2, spread: 18 },
  ],
};

/** The roadside stalls of a city's avenue, placed by its anchors, clear of doors, crossings, side roads and each other */
function roadsideStalls(city: 'abuja' | 'port_harcourt', streets: CityStreets, doors: ReadonlyArray<{ name: string; x: number; z: number }>): StallSpot[] {
  const av = streets.avenue;
  const narrow = av.walk < 3.2;
  const edge = av.halfRoad + av.walk - (narrow ? 0.32 : 0.55);
  const gaps = spineGaps(streets);
  const spots: StallSpot[] = [];
  const free = (x: number, z: number) =>
    z > av.from + 8 && z < av.to - 8 &&
    !streets.keepClear(x, z) &&
    Math.abs(z - streets.crossing) > 5 &&
    !gaps.some((g) => z > g.from - 3 && z < g.to + 3) &&
    // Not in front of anyone's door, and not on top of another stall
    !doors.some((d) => Math.sign(d.x) === Math.sign(x) && Math.abs(d.x) < av.halfRoad + av.walk + 6 && Math.abs(d.z - z) < 3.5) &&
    !spots.some((s) => Math.sign(s.x) === Math.sign(x) && Math.abs(s.z - z) < 6);
  for (const anchor of STALL_ANCHORS[city]) {
    const door = doors.find((d) => anchor.near.test(d.name));
    if (!door) continue;
    const side = Math.sign(door.x) || 1;
    const x = side * edge;
    let placed = 0;
    // Outward from the door, a few metres at a time, either way
    for (let k = 1; placed < anchor.count && k * 3 <= anchor.spread; k++) {
      for (const dir of [1, -1]) {
        const z = door.z + dir * k * 3;
        if (placed >= anchor.count || !free(x, z)) continue;
        // Facing the road
        spots.push({ x, z, yaw: side > 0 ? -Math.PI / 2 : Math.PI / 2, sells: anchor.sells, narrow });
        placed++;
      }
    }
  }
  return spots;
}

/**
 * The life of Abuja's and Port Harcourt's streets: traffic on the avenue that keeps to the right
 * and stops at the lights by the market, and people on both pavements, as busy as the hour.
 * The same systems as Lagos's (the same baked vehicles and people, the same shaders), fed each
 * city's own road. Lagos's own traffic and crowd are built once in World; these are built with
 * the city, the first time it is visited.
 */

type Avenue = { halfRoad: number; walk: number; from: number; to: number; lanes: readonly number[] };

interface CityStreets {
  avenue: Avenue;
  /** The pavement's height */
  top: number;
  /** Where the zebra crossing with its lights is, along the avenue */
  crossing: number;
  /** How the traffic differs from Lagos's */
  mix: TrafficPlan['mix'];
  /** Most open road between one vehicle and the next when the lanes are filled */
  gap: number;
  walkers: number;
  groups: number;
  /** Where people must not stand gisting: the motor park's gate, the cash machine, the airport road */
  keepClear: (x: number, z: number) => boolean;
  seed: number;
  /** A city of many roads: all of them, the avenue among them */
  roads?: readonly GridRoad[];
  /** On the other roads' pavements, a walker every so many metres */
  walkEvery?: number;
}

const STREETS: Record<'abuja' | 'port_harcourt', CityStreets> = {
  // Shehu Shagari Way: wide, orderly, a city of jeeps and saloons; no okadas or kekes in the centre
  // (they are banned there), no yellow Lagos danfos, and the police about
  abuja: {
    avenue: ABUJA_AVENUE,
    top: 0.26,
    crossing: 15.5,
    mix: { okada: 0, keke: 0, brt: 0, taxi: 0, danfo: 0, suv: 2.2, sedan: 1.3, police: 2.5, tanker: 0.4, truck: 0.5, delivery_van: 0.8 },
    gap: 24,
    walkers: 80,
    groups: 6,
    keepClear: (x, z) => Math.abs(z - 15.5) < 3 || (x > 0 && Math.abs(z - 35) < 10) || (x > 0 && Math.abs(z + 8.6) < 2.5) || (x < 0 && z < -72),
    seed: 5150,
    roads: ABUJA_ROADS,
    walkEvery: 40,
  },
  // Aba Road: busier and rougher, kekes everywhere (okadas are banned in the city), tankers and
  // lorries for the oil and the port
  port_harcourt: {
    avenue: PORT_HARCOURT_AVENUE,
    top: 0.3,
    crossing: 15.5,
    mix: { okada: 0, brt: 0, taxi: 0, keke: 1.4, danfo: 0.8, tanker: 2.5, truck: 1.6, pickup: 1.6 },
    gap: 16,
    walkers: 120,
    groups: 10,
    keepClear: (x, z) => Math.abs(z - 15.5) < 3 || (x > 0 && Math.abs(z - 38) < 10) || (x > 0 && Math.abs(z + 22.4) < 2.5) || (x < 0 && z < -70 && z > -86),
    seed: 6270,
    roads: PH_ROADS,
    walkEvery: 26,
  },
};

/** The traffic of an avenue: two lanes each way on the right, heavy vehicles and kekes in the kerb lane, lights at the crossing */
function trafficPlan(streets: CityStreets): TrafficPlan {
  const { avenue, crossing } = streets;
  if (streets.roads) {
    // Every road of the grid, stopping at every junction; the avenue at the zebra by the market as well
    const spine = streets.roads[0];
    const grid = gridTraffic(streets.roads, { stops: (road, dir) => (road === spine ? [dir * crossing - 3.5] : []) });
    const post = avenue.halfRoad + 0.6;
    return {
      lanes: grid.lanes,
      signals: [...grid.signals, { x: -post, z: crossing - 4.5, yaw: Math.PI, group: 'main' }, { x: post, z: crossing + 4.5, yaw: 0, group: 'main' }],
      mix: streets.mix,
      // North-south and east-west take turns at every junction; the zebra goes with the cross roads
      cycle: { mainGreen: 26, crossGreen: 20 },
      seed: streets.seed,
    };
  }
  const lanes: TrafficPlan['lanes'] = [];
  const [inner, outer] = avenue.lanes;
  for (const x of [-outer, -inner, inner, outer]) {
    // Going +z the driver's right is -x
    const dir: 1 | -1 = x < 0 ? 1 : -1;
    const kerb = Math.abs(x) === outer;
    lanes.push({
      axis: 'z',
      fixed: x,
      dir,
      uMin: dir > 0 ? avenue.from - 4 : -(avenue.to + 4),
      uMax: dir > 0 ? avenue.to + 4 : -(avenue.from - 4),
      // The stop line 3.5 m before the zebra, for each way
      stops: [{ u: dir * crossing - 3.5, group: 'main' }],
      busStops: [],
      heavy: kerb,
      keke: kerb,
      gap: streets.gap,
    });
  }
  const post = avenue.halfRoad + 0.6;
  return {
    lanes,
    // A post on the right of each way, before the crossing, facing the traffic coming
    signals: [
      { x: -post, z: crossing - 4.5, yaw: Math.PI, group: 'main' },
      { x: post, z: crossing + 4.5, yaw: 0, group: 'main' },
    ],
    mix: streets.mix,
    // The lights give the crossing its turn: people walk while the avenue waits
    cycle: { mainGreen: 40, crossGreen: 10 },
    seed: streets.seed,
  };
}

function crowdPlan(streets: CityStreets): CrowdPlan {
  const { avenue } = streets;
  return {
    avenue: { halfRoad: avenue.halfRoad, walk: avenue.walk, from: avenue.from, to: avenue.to, top: streets.top },
    walkers: streets.walkers,
    groups: streets.groups,
    busStops: false,
    // The pavements here do not drop at a side road: people on them are drawn at pavement height
    gap: () => false,
    // The roads that cut across the avenue's pavements, each with the lights of its junction (if it has them)
    gaps: spineGaps(streets),
    // The zebra by the market, on the avenue's own lights: people go over while the avenue waits
    zebras: [{ z: streets.crossing, kind: 'major', group: 'main' }],
    link: streets.roads ? (axis, fixed, from, to) => crossingBetween(streets.roads!, axis, fixed, from, to) : undefined,
    keepClear: streets.keepClear,
    seed: streets.seed + 1,
  };
}

/** What a road is to someone crossing it: lights where two roads with traffic meet, otherwise a street to look both ways on */
function crossingOf(along: GridRoad, across: GridRoad): Crossing {
  const lights = along.traffic !== false && across.traffic !== false;
  return lights ? { kind: 'junction', group: across.axis === 'z' ? 'main' : 'cross' } : { kind: 'street' };
}

/** The road between two stretches of the same pavement, if there is one */
function crossingBetween(roads: readonly GridRoad[], axis: 'x' | 'z', fixed: number, from: number, to: number): Crossing | null {
  for (const j of junctionsOf(roads)) {
    const along = axis === 'z' ? j.ns : j.ew;
    const across = axis === 'z' ? j.ew : j.ns;
    const at = axis === 'z' ? j.z : j.x;
    if (at > from && at < to && Math.abs(fixed - along.fixed) < along.halfRoad + along.walk + 1) return crossingOf(along, across);
  }
  return null;
}

/** Where the other roads cut across the avenue's pavements */
function spineGaps(streets: CityStreets): Array<{ from: number; to: number } & Crossing> {
  const spine = streets.roads?.[0];
  if (!spine || !streets.roads) return [];
  return junctionsOf(streets.roads)
    .filter((j) => j.ns === spine && j.z > streets.avenue.from + 4 && j.z < streets.avenue.to - 4)
    .map((j) => ({ from: j.z - j.ew.halfRoad, to: j.z + j.ew.halfRoad, ...crossingOf(spine, j.ew) }));
}

export class CityLife {
  public readonly group = new THREE.Group();
  public readonly traffic: TrafficSpawner;
  public readonly crowd: CityPopulation;

  public readonly city: 'abuja' | 'port_harcourt';
  /** The avenue's roadside stalls (set up once the city's doors are known) */
  public stalls: StreetStalls | null = null;
  private readonly streets: CityStreets;

  constructor(city: 'abuja' | 'port_harcourt') {
    this.city = city;
    const streets = STREETS[city];
    this.streets = streets;
    this.group.name = `${city} street life`;
    this.group.userData.streetLife = true;
    this.traffic = new TrafficSpawner(null, [], trafficPlan(streets));
    // The avenue's pavements have their own stream of walkers; the other roads', a walker every so often
    const spine = streets.roads?.[0];
    const runs = streets.roads ? gridWalkRuns(streets.roads, streets.walkEvery ?? 18).filter((run) => !(spine && run.axis === spine.axis && Math.abs(run.fixed - spine.fixed) < spine.halfRoad + spine.walk + 1 && run.to <= streets.avenue.to + 2)) : [];
    this.crowd = new CityPopulation(runs, [], crowdPlan(streets));
    // The crowd reads the lights the traffic keeps, and the traffic stops for whoever is crossing
    this.crowd.walkTime = (group) => this.traffic.walkTime(group);
    this.traffic.walkers = this.crowd.onRoad;
    this.group.add(this.traffic.group, this.crowd.group, CityLife.zebra(streets));
  }

  /** The zebra crossing painted over the avenue at the lights */
  private static zebra(streets: CityStreets): THREE.Object3D {
    const { avenue, crossing } = streets;
    const stripes = new THREE.Group();
    stripes.name = 'zebra crossing';
    const geometry = new THREE.PlaneGeometry(0.6, 3.2);
    const material = new THREE.MeshBasicMaterial({ color: 0xf8fafc });
    for (let x = -avenue.halfRoad + 0.6; x < avenue.halfRoad - 0.4; x += 1.2) {
      const stripe = new THREE.Mesh(geometry, material);
      stripe.rotation.x = -Math.PI / 2;
      stripe.position.set(x, 0.03, crossing);
      stripes.add(stripe);
    }
    // The stop lines before it, either way
    const line = new THREE.PlaneGeometry(avenue.halfRoad - 1.2, 0.3);
    for (const side of [-1, 1]) {
      const stop = new THREE.Mesh(line, material);
      stop.rotation.x = -Math.PI / 2;
      stop.position.set(side * (avenue.halfRoad / 2 + 0.6), 0.03, crossing - side * 3.5);
      stripes.add(stop);
    }
    return stripes;
  }

  /** Runs the street for a frame: the share of people and vehicles out is the hour's */
  public update(delta: number, playerPos: THREE.Vector3 | undefined, frustum: THREE.Frustum | undefined, hour: number, player: { halfWidth: number; halfLength: number }, avoid: Array<{ x: number; z: number; r: number }>): void {
    // (The hour may come with the days before it: hours since the clock began)
    const day = Math.floor(hour / 24);
    const abroad = shareAbroad(hour - day * 24);
    this.traffic.abroad = abroad;
    this.crowd.abroad = abroad;
    this.crowd.setClock(hour - day * 24, day, delta);
    this.traffic.playerHalfWidth = player.halfWidth;
    this.traffic.playerHalfLength = player.halfLength;
    this.crowd.avoid = avoid;
    this.traffic.update(delta, playerPos, frustum);
    this.crowd.update(delta, playerPos, frustum);
  }

  /**
   * Stage 3: the crowd's people get their days, going to these doors (the city's own list) in the
   * hours they keep. Called by the city once its doors are all built.
   */
  public giveLives(cityId: string, doors: ReadonlyArray<{ id: string; name: string; category: string; interactionPoint: THREE.Vector3; moving?: boolean }>, hoursOf?: (id: string) => OpeningHours | undefined | null): void {
    const ground = doors.filter((o) => o.interactionPoint.y < 1.5 && !o.moving).map((o) => ({ id: o.id, name: o.name, category: o.category, x: o.interactionPoint.x, z: o.interactionPoint.z }));
    // The roadside stalls, kept by the city's own people (the crowd finds them traders)
    const spots = roadsideStalls(this.city, this.streets, ground);
    if (spots.length) {
      this.stalls = new StreetStalls(spots);
      this.group.add(this.stalls.group);
      this.crowd.onStall = (i, open) => this.stalls?.setOpen(i, open);
    }
    this.crowd.giveLives(cityId, ground, hoursOf, undefined, undefined, spots);
  }

  /** What is solid of the street life: the stalls' tables (traffic and people are bodies, not things on the ground) */
  public obstructions(): Array<{ owner: string; structure: boolean; height: number; minX: number; maxX: number; minZ: number; maxZ: number }> {
    return (this.stalls?.boxes ?? []).map((b, i) => ({ owner: `Roadside stall #${i}`, structure: false, height: 1.1, ...b }));
  }

  /** Who is in the way here: people and vehicles near a point (for walking and driving) */
  public people(x: number, z: number, range: number, out: PersonBody[]): void {
    this.crowd.people(x, z, range, out);
  }

  public cars(x: number, z: number, range: number, out: CarBody[]): void {
    this.traffic.cars(x, z, range, out);
  }
}
