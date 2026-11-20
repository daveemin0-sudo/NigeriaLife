import * as THREE from 'three';
import { RigRegistry, type RigEntry } from './RigRegistry';
import { SkinnedCrowd } from './SkinnedCrowd';
import { BakedPeople, type BakedMode } from './BakedPeople';
import { clipForPose, type StreetLook } from './SkinnedCharacter';
import type { PoseState } from '../../interactions/Poses';

/** How long what a rig was told (an animation, a pose) holds before its movement decides instead */
const FRESH_MS = 450;

type Doing = 'walk' | 'idle' | 'talk' | 'dance';

const SEATED: PoseState = { legs: 'sit', arms: 'rest' };

/** The rig's own animation names, as what a character model does */
const doingOf = (state: string): Doing =>
  state === 'walk' || state === 'run' ? 'walk' : state === 'talk' || state === 'phone_call' || state === 'call' ? 'talk' : state === 'dance' ? 'dance' : 'idle';

/** A pose (from an interaction) as the action a far-off model is baked in */
const bakedOf = (pose: PoseState): BakedMode => {
  const clip = clipForPose(pose);
  return clip === 'sit' || clip === 'sit_talk' ? 'sit' : clip === 'walk' || clip === 'push' ? 'walk' : clip === 'talk' ? 'talk' : clip === 'dance' ? 'dance' : 'idle';
};

interface Seen {
  entry: RigEntry;
  group: THREE.Object3D;
  mask: number;
  pose: PoseState | null;
  doing: Doing;
}

/**
 * Every procedural person out in the world (shopkeepers, diners, guests, staff, congregations, riders,
 * performers...) drawn as the new character models: the few nearest the player as full models, posed
 * as the rig is posed; everyone else in less detail (BakedPeople). The rigs' own figures are never
 * drawn. Systems with their own way of doing this (the street crowd, the named street characters)
 * hide their rigs, and are left alone here.
 */
export class StandIns {
  private readonly models: SkinnedCrowd;
  private readonly baked = new Map<number, BakedPeople>();
  private readonly holder = new THREE.Group();
  private readonly frustum = new THREE.Frustum();
  private readonly viewProj = new THREE.Matrix4();
  private readonly sphere = new THREE.Sphere(new THREE.Vector3(), 1.2);
  private readonly at = new THREE.Vector3();
  private readonly scale = new THREE.Vector3();
  private readonly turn = new THREE.Quaternion();
  private readonly facing = new THREE.Euler();
  private readonly seen: Seen[] = [];
  private clock = 0;
  private readonly scene: THREE.Scene;
  /** Rigs under these are someone else's business (the player's own body) */
  private readonly exclude: () => Array<THREE.Object3D | null | undefined>;

  constructor(scene: THREE.Scene, exclude: () => Array<THREE.Object3D | null | undefined>) {
    this.scene = scene;
    this.exclude = exclude;
    this.holder.name = 'stand-in models';
    scene.add(this.holder);
    this.models = new SkinnedCrowd(this.holder);
  }

  /** Is this rig out in the world, shown, and not someone else's business? */
  private shown(group: THREE.Object3D, excluded: Array<THREE.Object3D | null | undefined>): boolean {
    let n: THREE.Object3D | null = group;
    while (n) {
      if (!n.visible) return false;
      if (excluded.includes(n)) return false;
      if (n === this.scene) return true;
      n = n.parent;
    }
    return false;
  }

  private bakedFor(mask: number): BakedPeople {
    let b = this.baked.get(mask);
    if (!b) {
      const group = new THREE.Group();
      group.name = `stand-in people ${mask}`;
      group.layers.mask = mask;
      this.scene.add(group);
      b = new BakedPeople(group);
      this.baked.set(mask, b);
    }
    return b;
  }

  public update(delta: number, camera: THREE.Camera, playerPos: THREE.Vector3): void {
    this.clock += delta;
    const now = performance.now();
    const excluded = this.exclude();
    this.viewProj.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
    this.frustum.setFromProjectionMatrix(this.viewProj);
    const seen = this.seen;
    seen.length = 0;

    for (const entry of RigRegistry.live()) {
      const rig = entry.rig.deref();
      if (!rig) continue;
      const group = rig.group;
      if (!this.shown(group, excluded)) {
        entry.last = null;
        continue;
      }
      // Its own figure is never drawn (what it holds goes with it, for now)
      let mask = 0;
      for (const child of group.children) {
        if (child === rig.nameTag || child.name.startsWith('crowd_model_')) continue;
        if (!mask) child.traverse((o) => { if (!mask && (o as THREE.Mesh).isMesh) mask = o.layers.mask; });
        child.visible = false;
      }
      if (!mask) mask = group.layers.mask;

      group.getWorldPosition(this.at);
      if (entry.last) {
        const moved = Math.hypot(this.at.x - entry.last.x, this.at.z - entry.last.z) / Math.max(delta, 1e-3);
        entry.speed += (moved - entry.speed) * Math.min(1, delta * 6);
        entry.last.copy(this.at);
      } else {
        entry.last = this.at.clone();
        entry.speed = 0;
      }
      // Posed by an interaction; or sat down by its owner directly (legs raised: drivers, diners, an audience)
      const seated = (rig.leftLeg.rotation.x + rig.rightLeg.rotation.x) / 2 < -0.9;
      const pose = entry.pose && now - entry.poseAt < FRESH_MS ? entry.pose : seated ? SEATED : null;
      const told = now - entry.stateAt < FRESH_MS ? doingOf(entry.state) : null;
      const doing: Doing = told === 'talk' || told === 'dance' ? told : entry.speed > 0.35 ? 'walk' : told ?? 'idle';
      seen.push({ entry, group, mask, pose, doing });

      const dx = this.at.x - playerPos.x;
      const dz = this.at.z - playerPos.z;
      const d2 = dx * dx + dz * dz;
      if (d2 < this.models.reach2) {
        this.models.offer({ id: entry.id, look: entry.look as StreetLook, lookKey: entry.id, x: 0, y: 0, z: 0, yaw: 0, scale: 1, mode: pose ? null : doing, d2, parent: group, layers: mask });
      }
    }
    this.models.sync(delta);

    for (const b of this.baked.values()) b.begin();
    for (const s of seen) {
      const handle = this.models.handleOf(s.entry.id);
      if (handle) {
        if (s.pose) handle.applyPose(s.pose);
        continue;
      }
      s.group.getWorldPosition(this.at);
      this.sphere.center.set(this.at.x, this.at.y + 0.9, this.at.z);
      if (!this.frustum.intersectsSphere(this.sphere)) continue;
      s.group.getWorldQuaternion(this.turn);
      s.group.getWorldScale(this.scale);
      const yaw = this.facing.setFromQuaternion(this.turn, 'YXZ').y;
      const mode: BakedMode = s.pose ? bakedOf(s.pose) : s.doing;
      const cycle = mode === 'walk' ? this.clock * 1.15 + s.entry.id * 0.37 : this.clock / 3 + s.entry.id * 0.37;
      this.bakedFor(s.mask).draw(s.entry.id, s.entry.look as StreetLook, s.entry.id, this.at.x, this.at.y, this.at.z, yaw, this.scale.y, mode, cycle);
    }
    for (const b of this.baked.values()) b.end();
  }
}
