import * as THREE from 'three';
import { bakeToGeometry, seededRandom } from '../../graphics/MeshBaker';
import type { Vehicles } from '../Vehicles';
import type { StreetSpot } from '../density/CityFabric';
import { CROSS_STREET_Z, MAIN_CORRIDOR_HALF, MAIN_ROAD, SIDE_STREETS } from '../density/StreetLayout';

type VehicleKind =
  | 'danfo' | 'keke' | 'okada' | 'sedan' | 'suv' | 'taxi' | 'police'
  | 'brt' | 'tanker' | 'truck' | 'delivery_van' | 'pickup';

interface KindSpec {
  kind: VehicleKind;
  /** Relative share of the traffic mix */
  weight: number;
  cruise: number;
  /** Body paint is tinted per vehicle */
  tinted: boolean;
  /** Pulls over at bus stops to load passengers */
  stopsForPassengers: boolean;
  parkable: boolean;
}

const KINDS: KindSpec[] = [
  { kind: 'danfo', weight: 20, cruise: 11.5, tinted: false, stopsForPassengers: true, parkable: false },
  { kind: 'keke', weight: 14, cruise: 8.5, tinted: false, stopsForPassengers: true, parkable: true },
  { kind: 'okada', weight: 12, cruise: 13.5, tinted: false, stopsForPassengers: false, parkable: true },
  { kind: 'sedan', weight: 18, cruise: 12, tinted: true, stopsForPassengers: false, parkable: true },
  { kind: 'suv', weight: 11, cruise: 12.5, tinted: true, stopsForPassengers: false, parkable: true },
  { kind: 'taxi', weight: 8, cruise: 11.5, tinted: false, stopsForPassengers: false, parkable: true },
  { kind: 'pickup', weight: 5, cruise: 11.5, tinted: true, stopsForPassengers: false, parkable: true },
  { kind: 'delivery_van', weight: 4, cruise: 11, tinted: false, stopsForPassengers: false, parkable: true },
  { kind: 'brt', weight: 3, cruise: 10, tinted: false, stopsForPassengers: true, parkable: false },
  { kind: 'truck', weight: 2.5, cruise: 9, tinted: false, stopsForPassengers: false, parkable: false },
  { kind: 'tanker', weight: 1.5, cruise: 8.5, tinted: false, stopsForPassengers: false, parkable: false },
  { kind: 'police', weight: 1, cruise: 13, tinted: false, stopsForPassengers: false, parkable: false },
];

const PAINTS = [0xf8fafc, 0xe5e7eb, 0x9ca3af, 0x18181b, 0x111827, 0x7f1d1d, 0x1e3a8a, 0xb45309, 0x14532d, 0xd1d5db, 0x475569];
/** Sentinel paint colour used to find the tintable body panels of a prototype */
const PAINT_KEY = 0xfe01fd;

type SignalGroup = 'main' | 'cross';
type LampSet = { red: THREE.MeshBasicMaterial; amber: THREE.MeshBasicMaterial; green: THREE.MeshBasicMaterial };

interface Lane {
  axis: 'x' | 'z';
  fixed: number;
  dir: 1 | -1;
  /** Progress range along the direction of travel (u = dir * coordinate) */
  uMin: number;
  uMax: number;
  stops: Array<{ u: number; group: SignalGroup }>;
  busStops: number[];
  /** Ordered leader first */
  cars: Car[];
}

interface Car {
  kind: number;
  paint: THREE.Color;
  u: number;
  v: number;
  cruise: number;
  length: number;
  dwell: number;
}

interface Batch {
  spec: KindSpec;
  length: number;
  bodyGeo: THREE.BufferGeometry;
  paintGeo: THREE.BufferGeometry | null;
  count: number;
  /** Instances written this frame (only vehicles in view are drawn) */
  drawn: number;
  body?: THREE.InstancedMesh;
  paint?: THREE.InstancedMesh;
}

interface ParkedCar {
  kind: number;
  paint: THREE.Color;
  matrix: THREE.Matrix4;
  x: number;
  z: number;
}

/** Vehicles further than this from the player are simulated but not drawn */
const DRAW_DISTANCE = 150;

// Signal cycle (seconds)
const MAIN_GREEN = 17;
const CROSS_GREEN = 9;
const AMBER = 2;
const ALL_RED = 1.6;

/**
 * TrafficSpawner
 * Lagos go-slow: vehicles on Broad Street and Martins Street with car-following,
 * a signalised junction and danfos pulling over at bus stops, plus parked cars on the
 * back streets. Each vehicle type is baked to one geometry and drawn as an InstancedMesh.
 */
export class TrafficSpawner {
  public group: THREE.Group;
  public vehicleCount = 0;

  private rand = seededRandom(7741);
  private batches: Batch[] = [];
  private lanes: Lane[] = [];
  private parked: ParkedCar[] = [];
  private sphere = new THREE.Sphere(new THREE.Vector3(), 6.5);
  private signalTime = 0;
  private signalLamps: Record<SignalGroup, LampSet>;
  private dummy = new THREE.Object3D();

  constructor(vehicles: Vehicles, parkingSpots: StreetSpot[] = []) {
    this.group = new THREE.Group();
    this.signalLamps = { main: this.createLampSet(), cross: this.createLampSet() };

    this.bakePrototypes(vehicles);
    this.createLanes();

    this.populateLanes();
    for (const spot of parkingSpots) {
      const kind = this.pickKind((k) => k.parkable);
      this.batches[kind].count++;
      this.dummy.position.set(spot.x, 0, spot.z);
      this.dummy.rotation.set(0, spot.yaw + (this.rand() - 0.5) * 0.08, 0);
      this.dummy.updateMatrix();
      this.parked.push({ kind, paint: this.randomPaint(), matrix: this.dummy.matrix.clone(), x: spot.x, z: spot.z });
    }

    this.createInstancedMeshes();
    this.buildTrafficLights();
    this.update(0);
  }

  // =========================================================================
  // PROTOTYPES → BAKED INSTANCED GEOMETRY
  // =========================================================================
  private bakePrototypes(vehicles: Vehicles): void {
    const fromGarage = new Set<VehicleKind>(['danfo', 'keke', 'okada', 'sedan', 'suv', 'taxi', 'police']);
    const paintKey = new THREE.Color(PAINT_KEY);
    const isPaint = (material: THREE.Material) => {
      const c = (material as THREE.MeshStandardMaterial).color;
      return !!c && Math.abs(c.r - paintKey.r) + Math.abs(c.g - paintKey.g) + Math.abs(c.b - paintKey.b) < 0.01;
    };
    const white = new THREE.Color(0xffffff);

    for (const spec of KINDS) {
      const proto = fromGarage.has(spec.kind)
        ? vehicles.buildTrafficVehicle(spec.kind, spec.tinted ? PAINT_KEY : undefined).group
        : this.buildHeavyVehicle(spec.kind);

      const bodyGeo = bakeToGeometry(proto, { filter: (_m, mat) => !(spec.tinted && isPaint(mat)) });
      const paintGeo = spec.tinted ? bakeToGeometry(proto, { filter: (_m, mat) => (isPaint(mat) ? white : false) }) : null;
      if (!bodyGeo) continue;

      const box = bodyGeo.boundingBox!.clone();
      if (paintGeo) box.union(paintGeo.boundingBox!);

      this.batches.push({ spec, length: box.max.z - box.min.z, bodyGeo, paintGeo, count: 0, drawn: 0 });
    }
  }

  /** Large commercial vehicles that the drivable garage does not model */
  private buildHeavyVehicle(kind: VehicleKind): THREE.Group {
    const group = new THREE.Group();
    const add = (geo: THREE.BufferGeometry, color: number, x: number, y: number, z: number) => {
      const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color }));
      mesh.position.set(x, y, z);
      group.add(mesh);
      return mesh;
    };
    const wheels = (xs: number[], zs: number[], radius: number) => {
      const geo = new THREE.CylinderGeometry(radius, radius, 0.3, 12);
      for (const x of xs) {
        for (const z of zs) add(geo, 0x18181b, x, radius, z).rotation.z = Math.PI / 2;
      }
    };
    const glass = 0x0f172a;

    switch (kind) {
      case 'brt': {
        // High-capacity blue BRT bus with white roof and window band
        add(new THREE.BoxGeometry(2.6, 2.4, 9.2), 0x1d4ed8, 0, 1.6, 0);
        add(new THREE.BoxGeometry(2.64, 0.75, 8.2), glass, 0, 2.05, 0.1);
        add(new THREE.BoxGeometry(2.5, 1.0, 0.1), glass, 0, 2.0, 4.6);
        add(new THREE.BoxGeometry(2.62, 0.18, 9.25), 0xf8fafc, 0, 2.86, 0);
        add(new THREE.BoxGeometry(2.64, 0.3, 9.0), 0xdc2626, 0, 1.0, 0);
        add(new THREE.BoxGeometry(0.4, 0.2, 0.08), 0xfef08a, -0.9, 0.9, 4.62);
        add(new THREE.BoxGeometry(0.4, 0.2, 0.08), 0xfef08a, 0.9, 0.9, 4.62);
        wheels([-1.3, 1.3], [-3.0, 3.1], 0.48);
        break;
      }
      case 'tanker': {
        add(new THREE.BoxGeometry(2.4, 2.2, 2.4), 0xdc2626, 0, 1.6, 3.3);
        add(new THREE.BoxGeometry(2.2, 0.8, 0.1), glass, 0, 2.1, 4.52);
        add(new THREE.BoxGeometry(2.3, 0.5, 9.0), 0x374151, 0, 0.85, -0.3);
        const tank = add(new THREE.CylinderGeometry(1.2, 1.2, 6.4, 16), 0xd1d5db, 0, 2.3, -1.4);
        tank.rotation.x = Math.PI / 2;
        add(new THREE.BoxGeometry(2.42, 0.4, 5.6), 0x15803d, 0, 2.3, -1.4);
        wheels([-1.2, 1.2], [-3.8, -2.5, 3.2], 0.5);
        break;
      }
      case 'truck': {
        add(new THREE.BoxGeometry(2.4, 2.2, 2.3), 0x15803d, 0, 1.6, 2.9);
        add(new THREE.BoxGeometry(2.2, 0.8, 0.1), glass, 0, 2.1, 4.07);
        add(new THREE.BoxGeometry(2.5, 0.35, 5.4), 0x78350f, 0, 0.95, -1.2);
        for (const sx of [-1.22, 1.22]) add(new THREE.BoxGeometry(0.1, 1.2, 5.4), 0x92400e, sx, 1.7, -1.2);
        // Stacked cargo: bags of cement / crates
        add(new THREE.BoxGeometry(2.1, 1.0, 2.2), 0xd6d3d1, 0, 1.65, -0.2);
        add(new THREE.BoxGeometry(2.0, 1.3, 2.4), 0xa16207, 0, 1.8, -2.6);
        wheels([-1.2, 1.2], [-2.9, -1.4, 2.9], 0.5);
        break;
      }
      case 'delivery_van': {
        add(new THREE.BoxGeometry(2.1, 1.9, 4.8), 0xf8fafc, 0, 1.4, 0);
        add(new THREE.BoxGeometry(1.9, 0.75, 0.1), glass, 0, 1.85, 2.42);
        add(new THREE.BoxGeometry(2.14, 0.6, 1.2), glass, 0, 1.85, 1.5);
        add(new THREE.BoxGeometry(2.14, 0.35, 2.6), 0xdc2626, 0, 1.3, -0.9);
        wheels([-1.05, 1.05], [-1.5, 1.5], 0.4);
        break;
      }
      default: {
        // Hilux-style pickup: tintable cab + open bed
        add(new THREE.BoxGeometry(2.0, 0.8, 5.0), PAINT_KEY, 0, 0.95, 0);
        add(new THREE.BoxGeometry(1.9, 0.75, 2.0), PAINT_KEY, 0, 1.7, 0.5);
        add(new THREE.BoxGeometry(1.94, 0.5, 1.7), glass, 0, 1.75, 0.5);
        add(new THREE.BoxGeometry(1.7, 0.5, 0.1), glass, 0, 1.75, 1.52);
        add(new THREE.BoxGeometry(1.8, 0.06, 1.9), 0x1f2937, 0, 1.36, -1.5);
        wheels([-1.0, 1.0], [-1.6, 1.5], 0.42);
        break;
      }
    }
    return group;
  }

  // =========================================================================
  // LANES & POPULATION
  // =========================================================================
  private createLanes(): void {
    const cross = SIDE_STREETS.find((s) => s.traffic)!;
    const stopBefore = cross.halfRoad + 5.2;

    // Broad Street: Nigeria drives on the right, so the +Z flow uses the -X lanes
    for (const x of [-4.9, -1.8, 1.8, 4.9]) {
      const dir: 1 | -1 = x < 0 ? 1 : -1;
      const outer = Math.abs(x) > 3;
      this.lanes.push({
        axis: 'z',
        fixed: x,
        dir,
        uMin: -(MAIN_ROAD.zMax + 6),
        uMax: MAIN_ROAD.zMax + 6,
        stops: [{ u: dir * CROSS_STREET_Z - stopBefore, group: 'main' }],
        busStops: outer ? (dir > 0 ? [-20, 60] : [-40, 90]) : [],
        cars: [],
      });
    }

    // Martins Street: one lane each way
    for (const dir of [1, -1] as const) {
      this.lanes.push({
        axis: 'x',
        fixed: cross.fixed + dir * 2.2,
        dir,
        uMin: cross.from - 4,
        uMax: cross.to + 4,
        stops: [{ u: -(MAIN_CORRIDOR_HALF + 1.2), group: 'cross' }],
        busStops: [],
        cars: [],
      });
    }
  }

  private pickKind(allow: (spec: KindSpec) => boolean = () => true): number {
    let total = 0;
    for (const b of this.batches) if (allow(b.spec)) total += b.spec.weight;
    let roll = this.rand() * total;
    for (let i = 0; i < this.batches.length; i++) {
      if (!allow(this.batches[i].spec)) continue;
      roll -= this.batches[i].spec.weight;
      if (roll <= 0) return i;
    }
    return 0;
  }

  private randomPaint(): THREE.Color {
    return new THREE.Color(PAINTS[Math.floor(this.rand() * PAINTS.length)]);
  }

  /** Fills every lane at Lagos density */
  private populateLanes(): void {
    for (const lane of this.lanes) {
      const isMain = lane.axis === 'z';
      const outer = isMain && Math.abs(lane.fixed) > 3;
      let u = lane.uMax - this.rand() * 6;

      while (u > lane.uMin) {
        // Heavy vehicles keep to the kerbside lane; okadas and saloons take the fast lane
        const kind = this.pickKind((k) => {
          const heavy = k.kind === 'brt' || k.kind === 'tanker' || k.kind === 'truck';
          if (!isMain) return !heavy;
          if (heavy || k.kind === 'keke') return outer;
          return true;
        });
        const batch = this.batches[kind];
        u -= batch.length / 2;
        batch.count++;
        lane.cars.push({
          kind,
          paint: this.randomPaint(),
          u,
          v: 0,
          cruise: batch.spec.cruise * (0.85 + this.rand() * 0.3),
          length: batch.length,
          dwell: 0,
        });
        u -= batch.length / 2 + 3.5 + this.rand() * (isMain ? 13 : 19);
      }
    }
  }

  private createInstancedMeshes(): void {
    const bodyMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.45, metalness: 0.15 });
    const paintMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.3, metalness: 0.35 });

    for (const batch of this.batches) {
      if (batch.count === 0) continue;
      batch.body = new THREE.InstancedMesh(batch.bodyGeo, bodyMat, batch.count);
      batch.body.castShadow = true;
      batch.body.frustumCulled = false;
      this.group.add(batch.body);

      if (batch.paintGeo) {
        batch.paint = new THREE.InstancedMesh(batch.paintGeo, paintMat, batch.count);
        batch.paint.castShadow = true;
        batch.paint.frustumCulled = false;
        this.group.add(batch.paint);
      }
    }
    this.vehicleCount = this.batches.reduce((sum, b) => sum + b.count, 0);
  }

  /** Writes one vehicle into the next free instance slot of its batch, if the camera can see it */
  private draw(
    kind: number,
    matrix: THREE.Matrix4,
    paint: THREE.Color,
    x: number,
    z: number,
    playerPos?: THREE.Vector3,
    frustum?: THREE.Frustum
  ): void {
    if (playerPos) {
      const dx = x - playerPos.x;
      const dz = z - playerPos.z;
      if (dx * dx + dz * dz > DRAW_DISTANCE * DRAW_DISTANCE) return;
    }
    if (frustum) {
      this.sphere.center.set(x, 1.4, z);
      if (!frustum.intersectsSphere(this.sphere)) return;
    }

    const batch = this.batches[kind];
    if (!batch.body) return;
    const slot = batch.drawn++;
    batch.body.setMatrixAt(slot, matrix);
    if (batch.paint) {
      batch.paint.setMatrixAt(slot, matrix);
      batch.paint.setColorAt(slot, paint);
    }
  }

  // =========================================================================
  // TRAFFIC SIGNALS
  // =========================================================================
  private createLampSet(): LampSet {
    return {
      red: new THREE.MeshBasicMaterial({ color: 0x3f0d0d }),
      amber: new THREE.MeshBasicMaterial({ color: 0x3f2a05 }),
      green: new THREE.MeshBasicMaterial({ color: 0x06310f }),
    };
  }

  private buildTrafficLights(): void {
    const cross = SIDE_STREETS.find((s) => s.traffic)!;
    const poleMat = new THREE.MeshStandardMaterial({ color: 0x1f2937, roughness: 0.6 });
    const hoodMat = new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.6 });
    const lampGeo = new THREE.SphereGeometry(0.17, 10, 8);

    // yaw points the lamp face at the approaching traffic
    const posts: Array<{ x: number; z: number; yaw: number; group: SignalGroup }> = [
      { x: -7.7, z: CROSS_STREET_Z - cross.halfRoad - 4.4, yaw: Math.PI, group: 'main' },
      { x: 7.7, z: CROSS_STREET_Z + cross.halfRoad + 4.4, yaw: 0, group: 'main' },
      { x: -(MAIN_CORRIDOR_HALF + 0.6), z: CROSS_STREET_Z + cross.halfRoad + 0.6, yaw: -Math.PI / 2, group: 'cross' },
      { x: MAIN_CORRIDOR_HALF + 0.6, z: CROSS_STREET_Z - cross.halfRoad - 0.6, yaw: Math.PI / 2, group: 'cross' },
    ];

    for (const post of posts) {
      const g = new THREE.Group();
      g.position.set(post.x, 0, post.z);
      g.rotation.y = post.yaw;

      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.13, 4.6, 8), poleMat);
      pole.position.y = 2.3;
      pole.castShadow = true;
      g.add(pole);

      const head = new THREE.Mesh(new THREE.BoxGeometry(0.5, 1.5, 0.4), hoodMat);
      head.position.y = 4.4;
      g.add(head);

      const lamps = this.signalLamps[post.group];
      [lamps.red, lamps.amber, lamps.green].forEach((mat, i) => {
        const lamp = new THREE.Mesh(lampGeo, mat);
        lamp.position.set(0, 4.85 - i * 0.45, 0.2);
        g.add(lamp);
      });

      this.group.add(g);
    }
  }

  /** State of a signal group at the current point in the cycle */
  private signalState(group: SignalGroup): 'go' | 'amber' | 'stop' {
    const cycle = MAIN_GREEN + CROSS_GREEN + 2 * (AMBER + ALL_RED);
    let t = this.signalTime % cycle;

    if (t < MAIN_GREEN) return group === 'main' ? 'go' : 'stop';
    t -= MAIN_GREEN;
    if (t < AMBER) return group === 'main' ? 'amber' : 'stop';
    t -= AMBER + ALL_RED;
    if (t < 0) return 'stop';
    if (t < CROSS_GREEN) return group === 'cross' ? 'go' : 'stop';
    t -= CROSS_GREEN;
    if (t < AMBER) return group === 'cross' ? 'amber' : 'stop';
    return 'stop';
  }

  private updateLamps(): void {
    for (const group of ['main', 'cross'] as const) {
      const state = this.signalState(group);
      const lamps = this.signalLamps[group];
      lamps.red.color.setHex(state === 'stop' ? 0xff2a2a : 0x3f0d0d);
      lamps.amber.color.setHex(state === 'amber' ? 0xffb020 : 0x3f2a05);
      lamps.green.color.setHex(state === 'go' ? 0x2dff6a : 0x06310f);
    }
  }

  // =========================================================================
  // SIMULATION
  // =========================================================================
  public update(delta: number, playerPos?: THREE.Vector3, frustum?: THREE.Frustum): void {
    this.signalTime += delta;
    this.updateLamps();
    for (const batch of this.batches) batch.drawn = 0;

    const open: Record<SignalGroup, boolean> = {
      main: this.signalState('main') === 'go',
      cross: this.signalState('cross') === 'go',
    };

    for (const lane of this.lanes) {
      let leaderRear = Infinity;

      // Drivers brake for the player (on foot or in a vehicle) standing in their lane
      let playerU = Infinity;
      if (playerPos) {
        const across = lane.axis === 'z' ? playerPos.x : playerPos.z;
        if (Math.abs(across - lane.fixed) < 1.4) playerU = (lane.axis === 'z' ? playerPos.z : playerPos.x) * lane.dir;
      }

      for (const car of lane.cars) {
        // Furthest point this car may reach: behind its leader, the player, or a red stop line
        let limit = leaderRear - 1.8 - car.length / 2;
        if (car.u + car.length / 2 <= playerU) limit = Math.min(limit, playerU - 2.6 - car.length / 2);
        for (const stop of lane.stops) {
          if (!open[stop.group] && car.u + car.length / 2 <= stop.u + 0.6) {
            limit = Math.min(limit, stop.u - car.length / 2);
          }
        }

        const room = limit - car.u;
        let target = room <= 0 ? 0 : Math.min(car.cruise, Math.sqrt(2 * 4.5 * room));

        if (car.dwell > 0) {
          car.dwell -= delta;
          target = 0;
        }

        car.v += THREE.MathUtils.clamp(target - car.v, -11 * delta, 3.2 * delta);
        if (car.v < 0.02 && target === 0) car.v = 0;

        const before = car.u;
        car.u = Math.min(car.u + car.v * delta, Math.max(car.u, limit));

        // Danfos, kekes and BRT buses pull up at bus stops to load passengers
        if (car.dwell <= 0 && this.batches[car.kind].spec.stopsForPassengers) {
          for (const stop of lane.busStops) {
            if (before < stop && car.u >= stop && this.rand() < 0.55) car.dwell = 2.5 + this.rand() * 4;
          }
        }

        leaderRear = car.u - car.length / 2;
      }

      // Recycle the leader to the back of the queue once it leaves the map
      const lead = lane.cars[0];
      if (lead && lead.u > lane.uMax) {
        const tail = lane.cars[lane.cars.length - 1];
        lane.cars.shift();
        lead.u = Math.min(lane.uMin, tail.u - tail.length / 2 - lead.length / 2 - 5 - this.rand() * 10);
        lead.v = lead.cruise * 0.7;
        lane.cars.push(lead);
      }

      const yaw = lane.axis === 'z' ? (lane.dir > 0 ? 0 : Math.PI) : lane.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
      this.dummy.rotation.set(0, yaw, 0);
      for (const car of lane.cars) {
        const along = car.u * lane.dir;
        const x = lane.axis === 'z' ? lane.fixed : along;
        const z = lane.axis === 'z' ? along : lane.fixed;
        this.dummy.position.set(x, 0, z);
        this.dummy.updateMatrix();
        this.draw(car.kind, this.dummy.matrix, car.paint, x, z, playerPos, frustum);
      }
    }

    for (const car of this.parked) this.draw(car.kind, car.matrix, car.paint, car.x, car.z, playerPos, frustum);

    for (const batch of this.batches) {
      if (!batch.body) continue;
      batch.body.count = batch.drawn;
      batch.body.instanceMatrix.needsUpdate = true;
      if (batch.paint) {
        batch.paint.count = batch.drawn;
        batch.paint.instanceMatrix.needsUpdate = true;
        if (batch.paint.instanceColor) batch.paint.instanceColor.needsUpdate = true;
      }
    }
  }
}
