import * as THREE from 'three';
import { HumanMeshBuilder, type HumanConfig } from '../../graphics/HumanMeshBuilder';
import { bakeToGeometry, seededRandom } from '../../graphics/MeshBaker';
import type { StreetSpot, WalkRun } from '../density/CityFabric';
import { MAIN_ROAD, isInJunctionGap } from '../density/StreetLayout';

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
}

const SKIN_TONES = ['#3b2416', '#4a2c1d', '#5c3722', '#6b4226', '#7a4a2b', '#8d5a3b'];
const TROUSERS = [0x1e293b, 0x1f2937, 0x334155, 0x57534e, 0x1e3a8a, 0x292524];

/** Pedestrians further than this from the player are simulated but not drawn */
const DRAW_DISTANCE = 90;

/**
 * CityPopulation
 * The Lagos street crowd. Every pedestrian uses the Character 2.0 human rig, but each
 * distinct look is baked once and drawn with InstancedMesh (body + 4 animated limbs),
 * so hundreds of walking, chatting and trading people cost ~130 draw calls in total.
 */
export class CityPopulation {
  public group: THREE.Group;
  public count = 0;

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
    const looks: HumanConfig[] = [];
    const male = (cfg: Partial<HumanConfig>) =>
      looks.push({ gender: 'male', username: '', skinTone: this.pick(SKIN_TONES), trousersColor: this.pick(TROUSERS), ...cfg });
    const female = (cfg: Partial<HumanConfig>) =>
      looks.push({ gender: 'female', username: '', skinTone: this.pick(SKIN_TONES), ...cfg });

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
    const stops = [
      { z: -20, side: -1 },
      { z: 60, side: -1 },
      { z: 40, side: 1 },
      { z: -90, side: 1 },
    ];
    for (const stop of stops) {
      const queue = 6 + Math.floor(this.rand() * 4);
      for (let i = 0; i < queue; i++) {
        this.addAgent({
          mode: this.rand() < 0.3 ? 'talk' : 'idle',
          x: stop.side * (MAIN_ROAD.halfRoad + 0.9 + this.rand() * 0.8),
          z: stop.z - i * 0.85 * stop.side + (this.rand() - 0.5) * 0.3,
          yaw: stop.side < 0 ? Math.PI / 2 : -Math.PI / 2,
        });
      }
    }
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
    }

    // One shared contact-shadow blob under every pedestrian
    const blobGeo = new THREE.CircleGeometry(0.5, 12).rotateX(-Math.PI / 2);
    const blobMat = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.3, depthWrite: false });
    this.shadows = new THREE.InstancedMesh(blobGeo, blobMat, Math.max(1, this.agents.length));
    this.shadows.frustumCulled = false;
    this.group.add(this.shadows);
  }

  // =========================================================================
  // SIMULATION
  // =========================================================================
  public update(delta: number, playerPos?: THREE.Vector3, frustum?: THREE.Frustum): void {
    const { base, limb, out, pos, quat, scl, euler, sphere } = this;
    for (const variant of this.variants) variant.drawn = 0;
    let shadowCount = 0;

    for (let i = 0; i < this.agents.length; i++) {
      const a = this.agents[i];
      const variant = this.variants[a.variant];
      if (!variant.body) continue;

      // Limb rotations: [leftArm, rightArm, leftLeg, rightLeg] as (x, z) pairs
      let lax = 0, laz = 0, rax = 0, raz = 0, llx = 0, rlx = 0, bob = 0;

      if (a.mode === 'walk') {
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

      // Everyone keeps walking, but only pedestrians the camera can see are drawn
      if (playerPos) {
        const dx = a.x - playerPos.x;
        const dz = a.z - playerPos.z;
        if (dx * dx + dz * dz > DRAW_DISTANCE * DRAW_DISTANCE) continue;
      }
      if (frustum) {
        sphere.center.set(a.x, 1, a.z);
        if (!frustum.intersectsSphere(sphere)) continue;
      }
      const slot = variant.drawn++;

      // Broad Street's sidewalk drops to road level where a side street cuts through
      const ground = a.onMainWalk && isInJunctionGap(a.z) ? 0.02 : MAIN_ROAD.sidewalkTop;

      pos.set(a.x, ground - variant.footY * a.scale + bob, a.z);
      quat.setFromAxisAngle(CityPopulation.UP, a.yaw);
      scl.setScalar(a.scale);
      base.compose(pos, quat, scl);
      variant.body.setMatrixAt(slot, base);

      const rx = [lax, rax, llx, rlx];
      const rz = [laz, raz, 0, 0];
      for (let l = 0; l < 4; l++) {
        limb.makeRotationFromEuler(euler.set(rx[l], 0, rz[l]));
        limb.setPosition(variant.pivots[l]);
        out.multiplyMatrices(base, limb);
        variant.limbs[l].setMatrixAt(slot, out);
      }

      if (this.shadows) {
        base.makeScale(a.scale, 1, a.scale);
        base.setPosition(a.x, ground + 0.015, a.z);
        this.shadows.setMatrixAt(shadowCount++, base);
      }
    }

    for (const variant of this.variants) {
      if (!variant.body) continue;
      variant.body.count = variant.drawn;
      variant.body.instanceMatrix.needsUpdate = true;
      for (const mesh of variant.limbs) {
        mesh.count = variant.drawn;
        mesh.instanceMatrix.needsUpdate = true;
      }
    }
    if (this.shadows) {
      this.shadows.count = shadowCount;
      this.shadows.instanceMatrix.needsUpdate = true;
    }
  }
}
