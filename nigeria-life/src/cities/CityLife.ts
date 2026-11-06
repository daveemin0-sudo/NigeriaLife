import * as THREE from 'three';
import { TrafficSpawner, type TrafficPlan } from '../world/traffic/TrafficSpawner';
import { CityPopulation, type CrowdPlan } from '../world/population/CityPopulation';
import { ABUJA_AVENUE, PORT_HARCOURT_AVENUE } from '../world/plan/CityPlan';
import { ABUJA_ROADS, PH_ROADS, gridTraffic, gridWalkRuns, type GridRoad } from '../world/plan/GridRoads';
import { shareAbroad } from '../world/StreetLife';
import type { CarBody, PersonBody } from '../world/Bodies';

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
    // Nobody walks out into the avenue here (the crossing waits for its own work)
    gap: () => false,
    keepClear: streets.keepClear,
    seed: streets.seed + 1,
  };
}

export class CityLife {
  public readonly group = new THREE.Group();
  public readonly traffic: TrafficSpawner;
  public readonly crowd: CityPopulation;

  public readonly city: 'abuja' | 'port_harcourt';

  constructor(city: 'abuja' | 'port_harcourt') {
    this.city = city;
    const streets = STREETS[city];
    this.group.name = `${city} street life`;
    this.group.userData.streetLife = true;
    this.traffic = new TrafficSpawner(null, [], trafficPlan(streets));
    // The avenue's pavements have their own stream of walkers; the other roads', a walker every so often
    const spine = streets.roads?.[0];
    const runs = streets.roads ? gridWalkRuns(streets.roads, streets.walkEvery ?? 18).filter((run) => !(spine && run.axis === spine.axis && Math.abs(run.fixed - spine.fixed) < spine.halfRoad + spine.walk + 1 && run.to <= streets.avenue.to + 2)) : [];
    this.crowd = new CityPopulation(runs, [], crowdPlan(streets));
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
    const abroad = shareAbroad(hour);
    this.traffic.abroad = abroad;
    this.crowd.abroad = abroad;
    this.traffic.playerHalfWidth = player.halfWidth;
    this.traffic.playerHalfLength = player.halfLength;
    this.crowd.avoid = avoid;
    this.traffic.update(delta, playerPos, frustum);
    this.crowd.update(delta, playerPos, frustum);
  }

  /** Who is in the way here: people and vehicles near a point (for walking and driving) */
  public people(x: number, z: number, range: number, out: PersonBody[]): void {
    this.crowd.people(x, z, range, out);
  }

  public cars(x: number, z: number, range: number, out: CarBody[]): void {
    this.traffic.cars(x, z, range, out);
  }
}
