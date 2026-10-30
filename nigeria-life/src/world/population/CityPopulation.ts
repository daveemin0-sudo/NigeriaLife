import * as THREE from 'three';
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
}

/** Where people wait for a danfo: on the kerb of Broad Street, west side for southbound, east for northbound */
export const BUS_STOPS: ReadonlyArray<{ z: number; side: -1 | 1 }> = [
  { z: -20, side: -1 },
  { z: 60, side: -1 },
  { z: 40, side: 1 },
  { z: -90, side: 1 },
];
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

  constructor(walkRuns: WalkRun[] = [], stallSpots: StreetSpot[] = []) {
    this.group = new THREE.Group();

    this.bakeVariants();
    this.spawnMainStreetWalkers();
    this.spawnSideStreetWalkers(walkRuns);
    this.spawnBusStopQueues();
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

  /** Broad Street: a steady two-way stream on both sidewalks */
  private spawnMainStreetWalkers(): void {
    const inner = MAIN_ROAD.halfRoad + 1.2;
    const outer = MAIN_ROAD.halfRoad + MAIN_ROAD.walk - 1.3;
    for (let i = 0; i < 190; i++) {
      const side = i % 2 === 0 ? -1 : 1;
      const x = side * (inner + this.rand() * (outer - inner));
      this.addWalker('z', x, MAIN_ROAD.zMin + 2, MAIN_ROAD.zMax - 2, true);
    }
  }

  /** Side streets: density proportional to sidewalk length */
  private spawnSideStreetWalkers(runs: WalkRun[]): void {
    for (const run of runs) {
      const length = run.to - run.from;
      if (length < 10) continue;
      const walkers = Math.round(length / 9);
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
    return BUS_STOPS.findIndex((stop) => Math.sign(x) === stop.side && Math.abs(x) > 3 && Math.abs(z - stop.z) < 9);
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
    for (let g = 0; g < 14; g++) {
      const side = g % 2 === 0 ? -1 : 1;
      const cx = side * (MAIN_ROAD.halfRoad + MAIN_ROAD.walk - 0.9);
      const cz = MAIN_ROAD.zMin + 12 + this.rand() * (MAIN_ROAD.zMax - MAIN_ROAD.zMin - 24);
      if (isInJunctionGap(cz)) continue;
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
    const material = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.65, metalness: 0.03 });

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
    const blobMat = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.3, depthWrite: false });
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
        a.phase += delta * (a.speed / 1.35);
        const along = (a.axis === 'x' ? a.x : a.z) + a.dir * a.speed * delta;
        if (along > a.max) a.dir = -1;
        else if (along < a.min) a.dir = 1;
        if (a.axis === 'x') a.x = along;
        else a.z = along;
        a.yaw = a.axis === 'z' ? (a.dir > 0 ? 0 : Math.PI) : a.dir > 0 ? Math.PI / 2 : -Math.PI / 2;

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
      const ground = a.onMainWalk && isInJunctionGap(a.z) ? 0.02 : MAIN_ROAD.sidewalkTop;

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
      // Everyone steps round the player, those walking to a bus door too
      for (const o of this.avoid) {
        const room = o.r + 0.75;
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
