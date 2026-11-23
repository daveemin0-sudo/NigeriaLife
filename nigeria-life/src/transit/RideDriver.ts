import * as THREE from 'three';
import { applyStreetLook, loadSkinnedCharacter, type SkinnedCharacterHandle, type StreetLook } from '../graphics/people/SkinnedCharacter';
import type { RideVehicle } from './RideModels';

export type RideDriverKind = 'taxi' | 'keke' | 'okada' | 'car';

const SKIN = '#4a2c1d';
const LOOKS: Record<RideDriverKind, StreetLook> = {
  taxi: { gender: 'male', skinTone: SKIN, outfit: 'casual_tee', outfitColor: 0x1e40af, bottom: 'chinos', trousersColor: 0x1f2937, shoes: 'loafers' },
  keke: { gender: 'male', skinTone: '#5a3825', outfit: 'casual_tee', outfitColor: 0xf8fafc, bottom: 'jeans', trousersColor: 0x1e293b, shoes: 'sandals' },
  okada: { gender: 'male', skinTone: '#3b2416', outfit: 'casual_tee', outfitColor: 0x16a34a, bottom: 'jeans', trousersColor: 0x1f2937, shoes: 'sneakers' },
  car: { gender: 'male', skinTone: SKIN, outfit: 'senator', outfitColor: 0x7c2d12, trousersColor: 0x7c2d12, shoes: 'loafers' },
};

/** The size of the person at each kind of controls */
const SCALE: Record<RideDriverKind, number> = { taxi: 0.94, keke: 0.94, okada: 0.96, car: 0.96 };
/** From the wrist to the middle of the palm, which is what closes on the grip */
const PALM = 0.07;

interface Arm {
  upper: THREE.Bone;
  lower: THREE.Bone;
  hand: THREE.Bone;
  upperRest: THREE.Quaternion;
  lowerRest: THREE.Quaternion;
  /** Which side of the vehicle it is on (+1 or -1) */
  side: number;
}

const s = new THREE.Vector3();
const e = new THREE.Vector3();
const w = new THREE.Vector3();
const t = new THREE.Vector3();
const dir = new THREE.Vector3();
const pole = new THREE.Vector3();
const elbow = new THREE.Vector3();
const from = new THREE.Vector3();
const to = new THREE.Vector3();
const gripA = new THREE.Vector3();
const gripB = new THREE.Vector3();
const turn = new THREE.Quaternion();
const own = new THREE.Quaternion();
const parent = new THREE.Quaternion();
const UP = new THREE.Vector3(0, 1, 0);

/** Turns a bone, in world space, so that what pointed along `a` points along `b` */
function swing(bone: THREE.Bone, a: THREE.Vector3, b: THREE.Vector3): void {
  turn.setFromUnitVectors(a, b);
  bone.getWorldQuaternion(own);
  bone.parent!.getWorldQuaternion(parent);
  bone.quaternion.copy(parent.invert().multiply(turn).multiply(own));
  bone.updateWorldMatrix(false, true);
}

/**
 * The one who drives a booked ride: the real character model, seated at the controls of whichever
 * vehicle is out, both hands on the wheel or the bars and following them as they turn, looking about.
 * One model serves every ride, since only one is out at a time. Until it has loaded, the vehicle's
 * still figure stays in the seat.
 */
export class RideDriver {
  private handle: SkinnedCharacterHandle | null = null;
  private loading: Promise<void> | null = null;
  private readonly holder = new THREE.Group();
  private ride: RideVehicle | null = null;
  private kind: RideDriverKind = 'taxi';
  private attached: RideVehicle | null = null;
  private arms: Arm[] = [];
  private head: THREE.Bone | null = null;
  private readonly headRest = new THREE.Quaternion();
  private helmet: THREE.Group | null = null;

  constructor() {
    this.holder.name = 'ride driver';
  }

  /** Puts the driver at the controls of this vehicle */
  public seat(ride: RideVehicle, kind: RideDriverKind): void {
    this.ride = ride;
    this.kind = kind;
    if (this.handle) {
      this.attach();
      return;
    }
    this.loading ??= loadSkinnedCharacter('male', { gender: 'male' } as Parameters<typeof loadSkinnedCharacter>[1]).then((handle) => {
      if (!handle) return;
      this.handle = handle;
      this.holder.add(handle.root);
      this.findBones(handle);
    }).catch(() => undefined);
    void this.loading.then(() => {
      if (this.handle && this.ride === ride) this.attach();
    });
  }

  private findBones(handle: SkinnedCharacterHandle): void {
    const bone = (name: string) => handle.root.getObjectByName(name) as THREE.Bone | undefined;
    this.arms = [];
    for (const key of ['l', 'r']) {
      const upper = bone(`upperarm_${key}`), lower = bone(`lowerarm_${key}`), hand = bone(`hand_${key}`);
      if (upper && lower && hand) this.arms.push({ upper, lower, hand, upperRest: new THREE.Quaternion(), lowerRest: new THREE.Quaternion(), side: 1 });
    }
    this.head = bone('Head') ?? null;
  }

  private attach(): void {
    const { handle, ride } = this;
    if (!handle || !ride) return;
    if (this.attached && this.attached !== ride) this.attached.driver.rig.group.visible = true;
    this.attached = ride;
    applyStreetLook(handle.root, LOOKS[this.kind]);
    ride.driver.rig.group.visible = false;
    ride.driver.root.add(this.holder);
    this.holder.scale.setScalar(SCALE[this.kind]);
    this.holder.position.set(0, 0, 0);
    handle.play('sit', 0);
    handle.update(0.25);
    ride.body.updateMatrixWorld(true);
    // Hips where the seat wants them
    const pelvis = handle.root.getObjectByName('pelvis');
    if (pelvis) {
      pelvis.getWorldPosition(s);
      ride.driver.root.worldToLocal(s);
      this.holder.position.copy(s).multiplyScalar(-1);
      // In a car, sat up to the wheel so both arms reach it with the elbows bent
      if (this.kind === 'taxi' || this.kind === 'car') this.holder.position.z += 0.08;
      ride.body.updateMatrixWorld(true);
    }
    for (const arm of this.arms) {
      arm.upperRest.copy(arm.upper.quaternion);
      arm.lowerRest.copy(arm.lower.quaternion);
      arm.upper.getWorldPosition(s);
      ride.body.worldToLocal(s);
      arm.side = s.x >= ride.driver.root.position.x ? 1 : -1;
    }
    if (this.head) this.headRest.copy(this.head.quaternion);
    this.wearHelmet(this.kind === 'okada');
    this.pose(0);
  }

  /** An okada rider's helmet, on the head itself so that it turns with it */
  private wearHelmet(on: boolean): void {
    if (!on) {
      if (this.helmet) this.helmet.visible = false;
      return;
    }
    if (!this.head) return;
    if (!this.helmet) {
      const helmet = new THREE.Group();
      const shell = new THREE.Mesh(new THREE.SphereGeometry(0.135, 18, 12, 0, Math.PI * 2, 0, Math.PI * 0.62), new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.3, metalness: 0.1 }));
      const visor = new THREE.Mesh(new THREE.BoxGeometry(0.19, 0.022, 0.07), new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.4 }));
      visor.position.set(0, 0.015, 0.125);
      helmet.add(shell, visor);
      this.head.add(helmet);
      this.helmet = helmet;
    }
    const helmet = this.helmet;
    helmet.visible = true;
    // Upright and at world size, whatever the head bone's own axes and scale
    this.head.updateWorldMatrix(true, false);
    this.head.getWorldQuaternion(own);
    this.ride!.body.getWorldQuaternion(parent);
    helmet.quaternion.copy(own.invert().multiply(parent));
    const size = this.head.getWorldScale(s);
    helmet.scale.setScalar(this.holder.scale.x * 1 / (size.x || 1));
    // A little above the bone, which sits at the base of the skull
    const up = t.set(0, 0.105, 0.012).applyQuaternion(parent).add(this.head.getWorldPosition(e));
    this.head.worldToLocal(up);
    helmet.position.copy(up);
  }

  /** Each frame: the body's breathing, the hands on the controls, the head. False if the model is not at them. */
  public pose(delta: number, look = 0): boolean {
    const { handle, attached: ride } = this;
    if (!handle || !ride || ride !== this.ride) return false;
    handle.update(delta);
    for (const arm of this.arms) {
      arm.upper.quaternion.copy(arm.upperRest);
      arm.lower.quaternion.copy(arm.lowerRest);
    }
    if (this.head) this.head.quaternion.copy(this.headRest);
    ride.body.updateMatrixWorld(true);
    ride.steer.localToWorld(gripA.copy(ride.grips[0]));
    ride.steer.localToWorld(gripB.copy(ride.grips[1]));
    // The grip further to +x in the vehicle goes to the arm on that side
    const aOnPlus = ride.body.worldToLocal(s.copy(gripA)).x >= ride.body.worldToLocal(e.copy(gripB)).x;
    let worst = 0;
    for (const arm of this.arms) {
      const grip = (arm.side > 0) === aOnPlus ? gripA : gripB;
      worst = Math.max(worst, this.reach(arm, grip, ride));
    }
    ride.gripError = worst;
    if (this.head && look) {
      ride.body.getWorldQuaternion(parent);
      to.copy(UP).applyQuaternion(parent);
      turn.setFromAxisAngle(to, look);
      this.head.getWorldQuaternion(own);
      this.head.parent!.getWorldQuaternion(parent);
      this.head.quaternion.copy(parent.invert().multiply(turn).multiply(own));
      this.head.updateWorldMatrix(false, true);
    }
    return true;
  }

  /** Two bones to the grip, the elbow down and out; how far the palm ends up from it */
  private reach(arm: Arm, grip: THREE.Vector3, ride: RideVehicle): number {
    arm.upper.getWorldPosition(s);
    arm.lower.getWorldPosition(e);
    arm.hand.getWorldPosition(w);
    const upperLength = e.distanceTo(s);
    const lowerLength = w.distanceTo(e);
    // The wrist stops a palm short of the grip, on the side the arm comes from
    t.copy(s).sub(grip).normalize().multiplyScalar(PALM * this.holder.scale.x).add(grip);
    dir.copy(t).sub(s);
    const reachFor = Math.min(Math.max(dir.length(), 0.05), (upperLength + lowerLength) * 0.995);
    dir.normalize();
    const along = (upperLength * upperLength - lowerLength * lowerLength + reachFor * reachFor) / (2 * reachFor);
    const out = Math.sqrt(Math.max(upperLength * upperLength - along * along, 0));
    ride.body.getWorldQuaternion(parent);
    pole.set(arm.side * 0.65, -1, -0.25).applyQuaternion(parent);
    pole.addScaledVector(dir, -pole.dot(dir)).normalize();
    elbow.copy(s).addScaledVector(dir, along).addScaledVector(pole, out);
    swing(arm.upper, from.copy(e).sub(s).normalize(), to.copy(elbow).sub(s).normalize());
    arm.lower.getWorldPosition(e);
    arm.hand.getWorldPosition(w);
    swing(arm.lower, from.copy(w).sub(e).normalize(), to.copy(t).sub(e).normalize());
    arm.hand.getWorldPosition(w);
    return w.distanceTo(t);
  }
}
