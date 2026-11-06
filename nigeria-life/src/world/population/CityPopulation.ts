import * as THREE from 'three';
import { BUS_STOPS, stopAt } from '../../transit/Fares';
import { HumanMeshBuilder, type HumanConfig } from '../../graphics/HumanMeshBuilder';
import { bakeToGeometry, seededRandom, simplifyByClustering } from '../../graphics/MeshBaker';
import type { StreetSpot, WalkRun } from '../density/CityFabric';
import { MAIN_ROAD, isInJunctionGap } from '../density/StreetLayout';
import { isAbroad } from '../StreetLife';
import type { PersonBody } from '../Bodies';

type Mode = 'walk' | 'idle' | 'talk';

/** One baked Character 2.0 appearance: a body mesh plus four separately swinging limbs */
interface Variant {
  bodyGeo: THREE.BufferGeometry;
  limbGeos: THREE.BufferGeometry[];
  pivots: THREE.Vector3[];
  /** Height of the shoe soles in rig space, so feet land exactly on the ground */
  footY: number;
  count: number;
  /** Instances written this frame (only pedestrians in view are drawn) */
  drawn: number;
  body?: THREE.InstancedMesh;
  limbs: THREE.InstancedMesh[];
  /** The same person simplified, for beyond NEAR_DISTANCE */
  farBodyGeo: THREE.BufferGeometry;
  farLimbGeos: THREE.BufferGeometry[];
  drawnFar: number;
  farBody?: THREE.InstancedMesh;
  farLimbs: THREE.InstancedMesh[];
}

interface Agent {
  variant: number;
  mode: Mode;
  x: number;
  z: number;
  yaw: number;
  scale: number;
  phase: number;
  // Walkers pace back and forth along one axis
  axis: 'x' | 'z';
  dir: number;
  speed: number;
  min: number;
  max: number;
  /** Walks Broad Street's sidewalk, which drops to road level at junctions */
  onMainWalk: boolean;
  /** The bus stop this person is queueing at, if any (index into BUS_STOPS) */
  stop?: number;
  /** Walking to a bus door: where it is, and what happens when they step in */
  boarding?: { x: number; z: number; done: () => boolean };
  /** Seconds until someone who has ridden off comes back to the queue (0 or absent: here) */
  away?: number;
  /** How far they have stepped aside from where they would be, to let someone pass */
  ox?: number;
  oz?: number;
  /** A step aside they must keep for a while (out of a hooting car's way): where to, and for how long */
  fx?: number;
  fz?: number;
  ft?: number;
  /** A shop or buka on their side of Broad Street. They walk in, stay a while, and come back out. */
  errand?: { doorX: number; doorZ: number; homeX: number; phase: 'pace' | 'approach' | 'in' | 'out'; left: number; cool: number };
  /** While set, they are crossing to this sidewalk x at the junction */
  crossing?: number;
  /** Seconds before they will cross again */
  crossCool?: number;
  /** This walker crosses at the junction instead of staying on one pavement */
  willCross?: boolean;
}

// Where people wait for a danfo (src/transit/Fares.ts, shared with the game server)
export { BUS_STOPS };
/** How long a rider is gone before someone takes their place at the back of the queue, seconds */
const RIDER_AWAY = 120;
const BOARDING_SPEED = 1.7;

const SKIN_TONES = ['#3b2416', '#4a2c1d', '#5c3722', '#6b4226', '#7a4a2b', '#8d5a3b'];
const TROUSERS = [0x1e293b, 0x1f2937, 0x334155, 0x57534e, 0x1e3a8a, 0x292524];

/** Pedestrians further than this from the player are simulated but not drawn */
const DRAW_DISTANCE = 90;
/** Nearer than this a pedestrian is drawn in full; further away, simplified (no one can see the fingers at 20 m) */
const NEAR_DISTANCE = 22;
/** Size of the cubes the far model's vertices are gathered into, metres */
const FAR_CELL = 0.045;

/**
 * Where a city's crowd walks: its avenue (along z, either side of x = 0), how many walk it and
 * stand gisting by the shops, whether it has Lagos's bus-stop queues, where its pavement opens
 * for a road across, and where a knot of people must not stand. Lagos's (Broad Street) is the default.
 */
export interface CrowdPlan {
  avenue: { halfRoad: number; walk: number; from: number; to: number; top: number };
  walkers: number;
  groups: number;
  busStops: boolean;
  gap: (z: number) => boolean;
  keepClear: (x: number, z: number) => boolean;
  seed?: number;
}

const LAGOS_CROWD: CrowdPlan = {
  avenue: { halfRoad: MAIN_ROAD.halfRoad, walk: MAIN_ROAD.walk, from: MAIN_ROAD.zMin, to: MAIN_ROAD.zMax, top: MAIN_ROAD.sidewalkTop },
  walkers: 190,
  groups: 14,
  busStops: true,
  gap: isInJunctionGap,
  // The footbridge stairs and the doorways on Broad Street
  keepClear: (cx, cz) => isInJunctionGap(cz) || (cx > 8.0 && cz > 98 && cz < 108) || (cx > 8.0 && cz > -28 && cz < -18) || (cx < -8.0 && cz > -62 && cz < -50) || (cx < -8.0 && cz > -8 && cz < 2),
};

/** The shapes of the crowd's looks, baked once (by Lagos's crowd, the first) and shared by every city's */
type Shape = Pick<Variant, 'bodyGeo' | 'limbGeos' | 'farBodyGeo' | 'farLimbGeos' | 'pivots' | 'footY'>;

/**
 * CityPopulation
 * The Lagos street crowd. Every pedestrian uses the Character 2.0 human rig, but each
 * distinct look is baked once and drawn with InstancedMesh (body + 4 animated limbs),
 * so hundreds of walking, chatting and trading people cost ~130 draw calls in total.
 */
export class CityPopulation {
  public group: THREE.Group;
  public count = 0;
  /** The share of them who are out at this hour: the rest are at home, and not drawn */
  public abroad = 1;
  /** How far away pedestrians are drawn at all, and drawn in full (the graphics setting changes these) */
  public drawDistance = DRAW_DISTANCE;
  public nearDistance = NEAR_DISTANCE;
  /** Who the walkers step round this frame: the player, or the vehicle the player is driving */
  public avoid: Array<{ x: number; z: number; r: number }> = [];
  private bodyPool: PersonBody[] = [];

  private rand = seededRandom(90210);
  private variants: Variant[] = [];
  private plan: CrowdPlan;
  private static shapes: Shape[] | null = null;
  private static material: THREE.MeshStandardMaterial | null = null;
  private static blobMaterial: THREE.MeshBasicMaterial | null = null;
  private agents: Agent[] = [];
  private shadows?: THREE.InstancedMesh;

  // Scratch objects reused every frame
  private base = new THREE.Matrix4();
  private limb = new THREE.Matrix4();
  private out = new THREE.Matrix4();
  private pos = new THREE.Vector3();
  private quat = new THREE.Quaternion();
  private scl = new THREE.Vector3();
  private euler = new THREE.Euler();
  private sphere = new THREE.Sphere(new THREE.Vector3(), 1.9);
  private limbX = [0, 0, 0, 0];
  private limbZ = [0, 0, 0, 0];
  private static readonly UP = new THREE.Vector3(0, 1, 0);

  constructor(walkRuns: WalkRun[] = [], stallSpots: StreetSpot[] = [], plan: CrowdPlan = LAGOS_CROWD) {
    this.group = new THREE.Group();
    this.plan = plan;
    if (plan.seed) this.rand = seededRandom(plan.seed);

    if (CityPopulation.shapes) {
      this.variants = CityPopulation.shapes.map((shape) => ({ ...shape, count: 0, drawn: 0, limbs: [], drawnFar: 0, farLimbs: [] }));
    } else {
      this.bakeVariants();
      CityPopulation.shapes = this.variants.map(({ bodyGeo, limbGeos, farBodyGeo, farLimbGeos, pivots, footY }) => ({ bodyGeo, limbGeos, farBodyGeo, farLimbGeos, pivots, footY }));
    }
    this.spawnMainStreetWalkers();
    this.spawnSideStreetWalkers(walkRuns);
    if (plan.busStops) this.spawnBusStopQueues();
    this.spawnChatGroups();
    this.spawnStallTraders(stallSpots);

    this.createInstancedMeshes();
    this.count = this.agents.length;
    this.update(0);
  }

  // =========================================================================
  // APPEARANCE VARIANTS
  // =========================================================================
  private pick<T>(list: T[]): T {
    return list[Math.floor(this.rand() * list.length)];
  }

  private bakeVariants(): void {
    // The street model, as the other walkers use: the detailed one (jointed fingers, sculpted face) cost
    // about 14,000 triangles a pedestrian, over a million for the crowd in view, which no one can see at street distance
    const looks: HumanConfig[] = [];
    const male = (cfg: Partial<HumanConfig>) =>
      looks.push({ gender: 'male', username: '', lod: 'street', skinTone: this.pick(SKIN_TONES), trousersColor: this.pick(TROUSERS), ...cfg });
    const female = (cfg: Partial<HumanConfig>) =>
      looks.push({ gender: 'female', username: '', lod: 'street', skinTone: this.pick(SKIN_TONES), ...cfg });

    // Everyday Lagos men
    for (const color of [0x10b981, 0xdc2626, 0xf8fafc, 0xfacc15, 0x38bdf8]) {
      male({ outfit: 'casual_tee', outfitColor: color, hairstyle: this.pick(['fade', 'short_crop', 'afro']) });
    }
    for (const color of [0x1e3a8a, 0xf5f5f4, 0x7f1d1d]) {
      male({ outfit: 'senator', outfitColor: color, trousersColor: color, hairstyle: this.pick(['fila', 'short_crop']) });
    }
    for (const color of [0xf8fafc, 0x065f46]) {
      male({ outfit: 'agbada', outfitColor: color, trousersColor: color, hairstyle: 'fila' });
    }
    male({ outfit: 'student_casual', outfitColor: 0x1d4ed8, hairstyle: 'afro', hasBackpack: true });
    male({ outfit: 'engineer_vest', outfitColor: 0xf97316, hairstyle: 'hardhat', trousersColor: 0x1e3a8a });
    male({ outfit: 'mechanic_overalls', outfitColor: 0x1e40af, trousersColor: 0x1e40af, hairstyle: 'short_crop' });
    male({ outfit: 'security_uniform', outfitColor: 0x0f172a, trousersColor: 0x0f172a, hairstyle: 'police_cap' });
    male({ outfit: 'lecturer_suit', outfitColor: 0x374151, trousersColor: 0x374151, hairstyle: 'fade', hasTie: true });

    // Everyday Lagos women
    for (const color of [0x2563eb, 0xdb2777, 0xf59e0b, 0x16a34a]) {
      female({ outfit: 'blue_dress', outfitColor: color, hairstyle: this.pick(['bob_wig', 'braids', 'ponytail']) });
    }
    for (const color of [0xdc2626, 0x0d9488, 0xfbbf24]) {
      female({ outfit: 'peplum_skirt', outfitColor: color, hairstyle: this.pick(['braids', 'gele']) });
    }
    for (const color of [0xd97706, 0xec4899, 0xf8fafc]) {
      female({ outfit: 'casual_blouse', outfitColor: color, hairstyle: this.pick(['gele', 'afro', 'ponytail']) });
    }
    female({ outfit: 'nurse_scrubs', outfitColor: 0x5eead4, hairstyle: 'ponytail' });
    female({ outfit: 'student_casual', outfitColor: 0xf43f5e, hairstyle: 'braids', hasBackpack: true });

    for (const look of looks) {
      const rig = HumanMeshBuilder.createHuman(look);
      rig.updateAnimation(0, 'walk'); // neutral limbs, phone hidden
      const limbs = [rig.leftArm, rig.rightArm, rig.leftLeg, rig.rightLeg];

      const bodyGeo = bakeToGeometry(rig.group, { exclude: limbs });
      const limbGeos = limbs.map((limb) => bakeToGeometry(limb, { space: limb }));
      if (!bodyGeo || limbGeos.some((g) => !g)) continue;

      const legGeo = limbGeos[2]!;
      this.variants.push({
        bodyGeo,
        limbGeos: limbGeos as THREE.BufferGeometry[],
        farBodyGeo: simplifyByClustering(bodyGeo, FAR_CELL),
        farLimbGeos: (limbGeos as THREE.BufferGeometry[]).map((geo) => simplifyByClustering(geo, FAR_CELL)),
        drawnFar: 0,
        farLimbs: [],
        pivots: limbs.map((limb) => limb.position.clone()),
        footY: rig.leftLeg.position.y + legGeo.boundingBox!.min.y,
        count: 0,
        drawn: 0,
        limbs: [],
      });

      // The prototype rig is only a mould; release its GPU-side resources
      rig.nameTag.material.map?.dispose();
      for (const m of rig.materials) m.dispose();
    }
  }

  // =========================================================================
  // SPAWNING
  // =========================================================================
  private addAgent(partial: Partial<Agent> & { x: number; z: number }): Agent {
    const variant = Math.floor(this.rand() * this.variants.length);
    this.variants[variant].count++;
    const agent: Agent = {
      variant,
      mode: 'idle',
      yaw: 0,
      scale: 0.93 + this.rand() * 0.14,
      phase: this.rand() * 20,
      axis: 'z',
      dir: 1,
      speed: 0,
      min: 0,
      max: 0,
      onMainWalk: false,
      ...partial,
    };
    this.agents.push(agent);
    return agent;
  }

  private addWalker(axis: 'x' | 'z', fixed: number, from: number, to: number, onMainWalk: boolean): void {
    const along = from + this.rand() * (to - from);
    this.addAgent({
      mode: 'walk',
      axis,
      x: axis === 'x' ? along : fixed,
      z: axis === 'x' ? fixed : along,
      dir: this.rand() < 0.5 ? 1 : -1,
      speed: 1.0 + this.rand() * 0.9,
      min: from,
      max: to,
      onMainWalk,
    });
  }

  /** The avenue (Broad Street in Lagos): a steady two-way stream on both pavements */
  private spawnMainStreetWalkers(): void {
    const road = this.plan.avenue;
    const inner = road.halfRoad + Math.min(1.2, road.walk * 0.3);
    const outer = road.halfRoad + road.walk - Math.min(1.3, road.walk * 0.3);
    for (let i = 0; i < this.plan.walkers; i++) {
      const side = i % 2 === 0 ? -1 : 1;
      const x = side * (inner + this.rand() * (outer - inner));
      this.addWalker('z', x, road.from + 2, road.to - 2, true);
    }
  }

  /** Side streets: density proportional to sidewalk length */
  private spawnSideStreetWalkers(runs: WalkRun[]): void {
    for (const run of runs) {
      const length = run.to - run.from;
      if (length < 10) continue;
      const walkers = Math.round(length / (run.every ?? 9));
      for (let i = 0; i < walkers; i++) {
        this.addWalker(run.axis, run.fixed + (this.rand() - 0.5) * 1.0, run.from + 1, run.to - 1, false);
      }
    }
  }

  /** Commuters queueing at the kerb for danfo and BRT */
  private spawnBusStopQueues(): void {
    BUS_STOPS.forEach((stop, index) => {
      const queue = 6 + Math.floor(this.rand() * 4);
      for (let i = 0; i < queue; i++) {
        this.addAgent({
          stop: index,
          mode: this.rand() < 0.3 ? 'talk' : 'idle',
          x: stop.side * (MAIN_ROAD.halfRoad + 0.9 + this.rand() * 0.8),
          z: stop.z - i * 0.85 * stop.side + (this.rand() - 0.5) * 0.3,
          yaw: stop.side < 0 ? Math.PI / 2 : -Math.PI / 2,
        });
      }
    });
  }

  // =========================================================================
  // RIDERS
  // =========================================================================
  /** The bus stop a vehicle at (x, z) is pulled up at, or -1: in the kerb lane, alongside the queue. */
  public stopAt(x: number, z: number): number {
    return stopAt(x, z);
  }

  /** How many are waiting at a stop now. */
  public waitingAt(stop: number): number {
    let n = 0;
    for (let i = 0; i < this.agents.length; i++) {
      const a = this.agents[i];
      if (a.stop === stop && !a.away && !a.boarding && isAbroad(i, this.abroad)) n++;
    }
    return n;
  }

  /**
   * The one at the front of the queue at `stop` walks along the kerb to a door at (doorX, doorZ)
   * and steps in; `onBoard` runs at that moment and says whether the vehicle was still there to
   * get into (if not, they stay at the stop). False if nobody is waiting.
   */
  public board(stop: number, doorX: number, doorZ: number, onBoard: () => boolean): boolean {
    let front: Agent | null = null;
    for (let i = 0; i < this.agents.length; i++) {
      const a = this.agents[i];
      if (a.stop !== stop || a.away || a.boarding || !isAbroad(i, this.abroad)) continue;
      // The front of the queue is the end nearest the stop sign
      if (!front || Math.abs(a.z - BUS_STOPS[stop].z) < Math.abs(front.z - BUS_STOPS[stop].z)) front = a;
    }
    if (!front) return false;
    const kerbX = BUS_STOPS[stop].side * (MAIN_ROAD.halfRoad + 0.25);
    front.boarding = { x: Math.abs(doorX) > Math.abs(kerbX) ? doorX : kerbX, z: doorZ, done: onBoard };
    front.mode = 'walk';
    return true;
  }

  /** Small knots of people gisting outside the shopfronts */
  private spawnChatGroups(): void {
    const road = this.plan.avenue;
    for (let g = 0; g < this.plan.groups; g++) {
      const side = g % 2 === 0 ? -1 : 1;
      const cx = side * (road.halfRoad + road.walk - 0.9);
      const cz = road.from + 12 + this.rand() * (road.to - road.from - 24);
      if (this.plan.keepClear(cx, cz)) continue;
      const people = 2 + Math.floor(this.rand() * 3);
      for (let i = 0; i < people; i++) {
        const angle = (i / people) * Math.PI * 2 + this.rand() * 0.6;
        const radius = 0.55 + this.rand() * 0.25;
        this.addAgent({
          mode: 'talk',
          x: cx + Math.sin(angle) * radius,
          z: cz + Math.cos(angle) * radius,
          yaw: angle + Math.PI, // face the middle of the circle
        });
      }
    }
  }

  /**
   * Some Broad Street walkers have a place to go: the barbershop, Mama Put, the supermarket,
   * the phone shop. They peel off the pavement at that door, spend a few seconds inside
   * (not drawn), and come back out onto the same pavement. A few others cross at the junction.
   */
  public giveErrands(doors: Array<{ x: number; z: number }>): void {
    const walkers = this.agents.filter((a) => a.mode === 'walk' && a.onMainWalk && a.axis === 'z' && a.stop === undefined);
    const used = new Set<Agent>();
    for (const door of doors) {
      const side = Math.sign(door.x) || 1;
      const near = walkers.filter((a) => !used.has(a) && Math.sign(a.x) === side && door.z > a.min + 4 && door.z < a.max - 4);
      for (let n = 0; n < 4 && near.length; n++) {
        const a = near.splice(Math.floor(this.rand() * near.length), 1)[0];
        used.add(a);
        a.errand = { doorX: door.x, doorZ: door.z, homeX: a.x, phase: 'pace', left: 0, cool: this.rand() * 8 };
      }
    }
    let i = 0;
    for (const a of walkers) {
      if (a.errand) continue;
      if (i++ % 8 === 0) a.willCross = true;
    }
  }

  /** A trader behind every umbrella stall, and a customer haggling at most of them */
  private spawnStallTraders(stalls: StreetSpot[]): void {
    for (const stall of stalls) {
      const fx = Math.sin(stall.yaw);
      const fz = Math.cos(stall.yaw);
      this.addAgent({ mode: 'idle', x: stall.x - fx * 0.75, z: stall.z - fz * 0.75, yaw: stall.yaw });
      if (this.rand() < 0.6) {
        this.addAgent({ mode: 'talk', x: stall.x + fx * 0.95, z: stall.z + fz * 0.95, yaw: stall.yaw + Math.PI });
      }
    }
  }

  private createInstancedMeshes(): void {
    const material = (CityPopulation.material ??= new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.65, metalness: 0.03 }));

    for (const variant of this.variants) {
      if (variant.count === 0) continue;
      variant.body = new THREE.InstancedMesh(variant.bodyGeo, material, variant.count);
      variant.body.frustumCulled = false;
      this.group.add(variant.body);

      variant.limbs = variant.limbGeos.map((geo) => {
        const mesh = new THREE.InstancedMesh(geo, material, variant.count);
        mesh.frustumCulled = false;
        this.group.add(mesh);
        return mesh;
      });

      variant.farBody = new THREE.InstancedMesh(variant.farBodyGeo, material, variant.count);
      variant.farBody.frustumCulled = false;
      this.group.add(variant.farBody);
      variant.farLimbs = variant.farLimbGeos.map((geo) => {
        const mesh = new THREE.InstancedMesh(geo, material, variant.count);
        mesh.frustumCulled = false;
        this.group.add(mesh);
        return mesh;
      });
    }

    // One shared contact-shadow blob under every pedestrian
    const blobGeo = new THREE.CircleGeometry(0.5, 12).rotateX(-Math.PI / 2);
    const blobMat = (CityPopulation.blobMaterial ??= new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.3, depthWrite: false }));
    this.shadows = new THREE.InstancedMesh(blobGeo, blobMat, Math.max(1, this.agents.length));
    this.shadows.frustumCulled = false;
    this.group.add(this.shadows);
  }

  /** How many of them are out now. */
  public get outNow(): number {
    let out = 0;
    for (let i = 0; i < this.agents.length; i++) if (isAbroad(i, this.abroad)) out += 1;
    return out;
  }

  /** Step toward a point on the pavement. Returns true once they are there. */
  private stepToward(a: Agent, x: number, z: number, delta: number): boolean {
    const dx = x - a.x;
    const dz = z - a.z;
    const d = Math.hypot(dx, dz);
    if (d < 0.22) {
      a.x = x;
      a.z = z;
      return true;
    }
    const step = Math.min(d, Math.max(0.4, a.speed) * delta);
    a.x += (dx / d) * step;
    a.z += (dz / d) * step;
    a.yaw = Math.atan2(dx, dz);
    a.phase += delta * (Math.max(0.4, a.speed) / 1.35);
    return false;
  }

  /**
   * A Broad Street walker: along the pavement, across at the junction, or into a shop and back out.
   * True when they are inside and should not be drawn.
   */
  private advanceWalker(a: Agent, delta: number): boolean {
    const e = a.errand;
    if (e?.phase === 'in') {
      e.left -= delta;
      if (e.left > 0) return true;
      e.phase = 'out';
      a.x = e.doorX;
      a.z = e.doorZ;
    }
    if (e?.phase === 'out') {
      if (this.stepToward(a, e.homeX, e.doorZ, delta)) {
        e.phase = 'pace';
        e.cool = 35 + this.rand() * 20;
      }
      return false;
    }
    if (e?.phase === 'approach') {
      if (this.stepToward(a, e.doorX, e.doorZ, delta)) {
        e.phase = 'in';
        e.left = 8 + this.rand() * 14;
        return true;
      }
      return false;
    }
    if (a.crossing !== undefined) {
      if (this.stepToward(a, a.crossing, a.z, delta)) {
        a.crossing = undefined;
        a.crossCool = 45;
      }
      return false;
    }

    a.phase += delta * (a.speed / 1.35);
    let along = (a.axis === 'x' ? a.x : a.z) + a.dir * a.speed * delta;
    if (along > a.max) {
      a.dir = -1;
      along = a.max;
    } else if (along < a.min) {
      a.dir = 1;
      along = a.min;
    }
    if (a.axis === 'x') a.x = along;
    else a.z = along;
    a.yaw = a.axis === 'z' ? (a.dir > 0 ? 0 : Math.PI) : a.dir > 0 ? Math.PI / 2 : -Math.PI / 2;

    if (e && e.phase === 'pace' && a.axis === 'z') {
      e.cool = Math.max(0, e.cool - delta);
      if (e.cool === 0 && Math.abs(a.z - e.doorZ) < 1.15 && Math.sign(a.x) === Math.sign(e.doorX || 1)) {
        e.phase = 'approach';
      }
    } else if (a.willCross && a.axis === 'z' && !e) {
      a.crossCool = Math.max(0, (a.crossCool ?? 0) - delta);
      if (a.crossCool === 0 && this.plan.gap(a.z)) a.crossing = -a.x;
    }
    return false;
  }

  // =========================================================================
  // SIMULATION
  // =========================================================================
  public update(delta: number, playerPos?: THREE.Vector3, frustum?: THREE.Frustum): void {
    const { base, limb, out, pos, quat, scl, euler, sphere } = this;
    for (const variant of this.variants) {
      variant.drawn = 0;
      variant.drawnFar = 0;
    }
    let shadowCount = 0;

    for (let i = 0; i < this.agents.length; i++) {
      const a = this.agents[i];
      const variant = this.variants[a.variant];
      if (!variant.body) continue;

      // Limb rotations: [leftArm, rightArm, leftLeg, rightLeg] as (x, z) pairs
      let lax = 0, laz = 0, rax = 0, raz = 0, llx = 0, rlx = 0, bob = 0;

      if (a.away) {
        a.away = Math.max(0, a.away - delta);
        if (a.away > 0) continue;
        // Someone else turns up at the back of the queue
        const stop = BUS_STOPS[a.stop ?? 0];
        a.mode = 'idle';
        a.x = stop.side * (MAIN_ROAD.halfRoad + 0.9 + this.rand() * 0.8);
        a.z = stop.z - (5 + this.rand() * 3) * 0.85 * stop.side;
        a.yaw = stop.side < 0 ? Math.PI / 2 : -Math.PI / 2;
      }

      if (a.boarding) {
        const dx = a.boarding.x - a.x;
        const dz = a.boarding.z - a.z;
        const d = Math.hypot(dx, dz);
        const step = BOARDING_SPEED * delta;
        if (d <= step) {
          const done = a.boarding.done;
          a.boarding = undefined;
          a.mode = 'idle';
          if (done()) {
            a.away = RIDER_AWAY;
            continue;
          }
        }
        a.x += (dx / d) * step;
        a.z += (dz / d) * step;
        a.yaw = Math.atan2(dx, dz);
        a.phase += delta * (BOARDING_SPEED / 1.35);
        const stride = Math.sin(a.phase * 8);
        llx = stride * 0.6;
        rlx = -stride * 0.6;
        lax = -stride * 0.5;
        rax = stride * 0.5;
        bob = Math.abs(stride) * 0.035;
      } else if (a.mode === 'walk') {
        if (this.advanceWalker(a, delta)) continue;
        const stride = Math.sin(a.phase * 8);
        llx = stride * 0.6;
        rlx = -stride * 0.6;
        lax = -stride * 0.5;
        rax = stride * 0.5;
        bob = Math.abs(Math.sin(a.phase * 8)) * 0.035;
      } else if (a.mode === 'talk') {
        a.phase += delta;
        lax = -0.4 + Math.sin(a.phase * 4) * 0.2;
        laz = -0.2;
        rax = -0.75 + Math.cos(a.phase * 3) * 0.25;
        raz = 0.25;
      } else {
        a.phase += delta;
        lax = Math.sin(a.phase * 2) * 0.03;
        rax = -lax;
      }

      // Those who are at home at this hour are not in the street
      if (!isAbroad(i, this.abroad)) continue;
      this.sidestep(a, delta);
      const ax = a.x + (a.ox ?? 0);
      const az = a.z + (a.oz ?? 0);
      // Everyone keeps walking, but only pedestrians the camera can see are drawn
      let far = false;
      if (playerPos) {
        const dx = ax - playerPos.x;
        const dz = az - playerPos.z;
        const d2 = dx * dx + dz * dz;
        if (d2 > this.drawDistance * this.drawDistance) continue;
        far = d2 > this.nearDistance * this.nearDistance;
      }
      if (frustum) {
        sphere.center.set(ax, 1, az);
        if (!frustum.intersectsSphere(sphere)) continue;
      }
      const slot = far ? variant.drawnFar++ : variant.drawn++;
      const bodyMesh = far ? variant.farBody! : variant.body;
      const limbMeshes = far ? variant.farLimbs : variant.limbs;

      // Broad Street's sidewalk drops to road level where a side street cuts through
      const ground = a.onMainWalk && this.plan.gap(a.z) ? 0.02 : this.plan.avenue.top;

      pos.set(ax, ground - variant.footY * a.scale + bob, az);
      quat.setFromAxisAngle(CityPopulation.UP, a.yaw);
      scl.setScalar(a.scale);
      base.compose(pos, quat, scl);
      bodyMesh.setMatrixAt(slot, base);

      const rx = this.limbX;
      const rz = this.limbZ;
      rx[0] = lax;
      rx[1] = rax;
      rx[2] = llx;
      rx[3] = rlx;
      rz[0] = laz;
      rz[1] = raz;
      for (let l = 0; l < 4; l++) {
        limb.makeRotationFromEuler(euler.set(rx[l], 0, rz[l]));
        limb.setPosition(variant.pivots[l]);
        out.multiplyMatrices(base, limb);
        limbMeshes[l].setMatrixAt(slot, out);
      }

      if (this.shadows) {
        base.makeScale(a.scale, 1, a.scale);
        base.setPosition(ax, ground + 0.015, az);
        this.shadows.setMatrixAt(shadowCount++, base);
      }
    }

    // A mesh with nobody in it this frame is hidden, so it costs no draw call
    const settle = (mesh: THREE.InstancedMesh, count: number) => {
      mesh.count = count;
      mesh.visible = count > 0;
      if (count > 0) mesh.instanceMatrix.needsUpdate = true;
    };
    for (const variant of this.variants) {
      if (!variant.body) continue;
      settle(variant.body, variant.drawn);
      for (const mesh of variant.limbs) settle(mesh, variant.drawn);
      settle(variant.farBody!, variant.drawnFar);
      for (const mesh of variant.farLimbs) settle(mesh, variant.drawnFar);
    }
    if (this.shadows) {
      this.shadows.count = shadowCount;
      this.shadows.instanceMatrix.needsUpdate = true;
    }
  }

  // =========================================================================
  // MAKING ROOM
  // =========================================================================
  /**
   * A walker who would bump into the player steps to the side and back again once past; someone
   * standing about leans out of the way. A step aside ordered by a horn is kept for a while.
   */
  private sidestep(a: Agent, delta: number): void {
    let tx = 0;
    let tz = 0;
    if (a.ft && a.ft > 0) {
      a.ft -= delta;
      tx = a.fx ?? 0;
      tz = a.fz ?? 0;
    } else {
      if (a.axis === 'z') {
        if (a.x > 9.0 && a.z > 97 && a.z < 109) tx -= 0.8; // Quilox VIP Red Carpet
        else if (a.x > 9.5 && a.z > -27 && a.z < -19) tx -= 0.75; // Eko Commercial Bank
        else if (a.x < -9.5 && a.z > -8 && a.z < 0) tx += 0.75; // Everyday Supermarket
        else if (a.x < -9.5 && a.z > -60 && a.z < -52) tx += 0.75; // Chop Life Buka
      }
      // Everyone steps round the player, those walking to a bus door too
      for (const o of this.avoid) {
        const room = o.r + 0.22;
        if (a.mode === 'walk' && !a.boarding) {
          const ahead = (a.axis === 'z' ? o.z - a.z : o.x - a.x) * a.dir;
          if (ahead < -0.8 - o.r || ahead > 2.4 + o.r) continue;
          const lateral = a.axis === 'z' ? a.x - o.x : a.z - o.z;
          if (Math.abs(lateral) >= room) continue;
          const sign = Math.abs(lateral) > 0.05 ? Math.sign(lateral) : a.variant % 2 ? 1 : -1;
          const need = sign * room - lateral;
          if (a.axis === 'z') tx += need;
          else tz += need;
        } else {
          const dx = a.x - o.x;
          const dz = a.z - o.z;
          if (Math.abs(dx) > room || Math.abs(dz) > room) continue;
          const d = Math.hypot(dx, dz);
          if (d >= room) continue;
          const k = d > 1e-3 ? (room - d) / d : 1;
          tx += d > 1e-3 ? dx * k : room;
          tz += dz * k;
        }
      }
    }
    const ox = a.ox ?? 0;
    const oz = a.oz ?? 0;
    if (tx === 0 && tz === 0 && ox === 0 && oz === 0) return;
    const step = 2.6 * delta;
    a.ox = ox + THREE.MathUtils.clamp(tx - ox, -step, step);
    a.oz = oz + THREE.MathUtils.clamp(tz - oz, -step, step);
    // Leaning out of the way never swings them into the one they are making room for
    for (const o of this.avoid) {
      const bx = a.x + a.ox - o.x;
      const bz = a.z + a.oz - o.z;
      const d = Math.hypot(bx, bz);
      const gap = o.r + 0.3;
      if (d >= gap || d < 1e-3) continue;
      a.ox += (bx / d) * (gap - d);
      a.oz += (bz / d) * (gap - d);
    }
    if (Math.abs(a.ox) < 1e-3 && Math.abs(a.oz) < 1e-3 && !(a.ft && a.ft > 0)) a.ox = a.oz = 0;
  }

  /**
   * A horn: everyone standing in front of (x, z), in the direction (dirX, dirZ), within `range`
   * metres and in the vehicle's path, hurries to the side. Returns how many moved.
   */
  public scatter(x: number, z: number, dirX: number, dirZ: number, range: number, halfWidth = 1.4): number {
    const len = Math.hypot(dirX, dirZ) || 1;
    const fx = dirX / len;
    const fz = dirZ / len;
    // To the right of the direction of travel
    const px = fz;
    const pz = -fx;
    const clear = halfWidth + 1.1;
    let moved = 0;
    for (let i = 0; i < this.agents.length; i++) {
      const a = this.agents[i];
      if (a.away || a.boarding || !isAbroad(i, this.abroad)) continue;
      const rx = a.x + (a.ox ?? 0) - x;
      const rz = a.z + (a.oz ?? 0) - z;
      const ahead = rx * fx + rz * fz;
      if (ahead < 0 || ahead > range) continue;
      const lateral = rx * px + rz * pz;
      if (Math.abs(lateral) >= clear) continue;
      const side = Math.abs(lateral) > 0.05 ? Math.sign(lateral) : i % 2 ? 1 : -1;
      const shift = side * clear - lateral;
      a.fx = (a.ox ?? 0) + px * shift;
      a.fz = (a.oz ?? 0) + pz * shift;
      a.ft = 5;
      moved += 1;
    }
    return moved;
  }

  /** The people within `range` of a point, as circles on the ground, for whoever must not walk or drive through them */
  public people(x: number, z: number, range: number, out: PersonBody[]): void {
    out.length = 0;
    let used = 0;
    for (let i = 0; i < this.agents.length; i++) {
      const a = this.agents[i];
      if (a.away || !isAbroad(i, this.abroad)) continue;
      const ax = a.x + (a.ox ?? 0);
      const az = a.z + (a.oz ?? 0);
      if (Math.abs(ax - x) > range || Math.abs(az - z) > range) continue;
      const body = this.bodyPool[used] ?? (this.bodyPool[used] = { x: 0, z: 0, r: 0 });
      used += 1;
      body.x = ax;
      body.z = az;
      body.r = 0.28 * a.scale;
      out.push(body);
    }
  }
}
