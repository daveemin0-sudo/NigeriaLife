import * as THREE from 'three';
import type { CharacterConfig } from '../player/CharacterCustomization';
import { loadSkinnedCharacter, type SkinnedCharacterHandle } from '../graphics/people/SkinnedCharacter';
import type { RideVehicle } from './RideModels';
import { flattenFoot, reachTwoBone, type TwoBone } from './RideDriver';

/** From the ankle bone to the sole that rests on the mat (body/shoe mesh hangs below the bone) */
const SOLE = 0.18;
const SCALE = 0.9;

const s = new THREE.Vector3();
const e = new THREE.Vector3();
const t = new THREE.Vector3();
const footTarget = new THREE.Vector3();
const poleWorld = new THREE.Vector3();
const parent = new THREE.Quaternion();

/**
 * The player in the back of a taxi or their own car: the real character model in their own clothes,
 * seated with bent knees and hands in the lap. Until it has loaded, the vehicle's still figure stays
 * in the seat. One model serves every car ride; keke and okada keep their baked passengers.
 */
export class RidePassenger {
  private handle: SkinnedCharacterHandle | null = null;
  private gender: 'male' | 'female' | null = null;
  private loading: Promise<void> | null = null;
  private readonly holder = new THREE.Group();
  private ride: RideVehicle | null = null;
  private config: CharacterConfig | null = null;
  private attached: RideVehicle | null = null;
  private legs: TwoBone[] = [];
  private arms: TwoBone[] = [];

  constructor() {
    this.holder.name = 'ride passenger';
  }

  /** Sits the player's look in this car; no-op when there is no cabin (keke / okada) */
  public seat(ride: RideVehicle, config: CharacterConfig | null): void {
    this.ride = ride;
    this.config = config;
    if (!config || !ride.cabin) {
      this.detach();
      return;
    }
    const gender = config.gender === 'female' ? 'female' : 'male';
    if (this.handle && this.gender === gender) {
      this.attach();
      return;
    }
    // A different body: drop the old one and load again
    if (this.handle && this.gender !== gender) {
      this.holder.remove(this.handle.root);
      this.handle.dispose();
      this.handle = null;
      this.legs = [];
      this.arms = [];
    }
    this.gender = gender;
    const wanted = config;
    this.loading = loadSkinnedCharacter(gender, wanted).then((handle) => {
      if (!handle || this.config !== wanted) return;
      this.handle = handle;
      this.holder.add(handle.root);
      this.findBones(handle);
    }).catch(() => undefined);
    void this.loading.then(() => {
      if (this.handle && this.ride === ride && this.config === wanted) this.attach();
    });
  }

  /** Leaves the car seat; the baked figure shows again if it is still there */
  public clear(): void {
    this.ride = null;
    this.config = null;
    this.detach();
  }

  private detach(): void {
    if (this.attached) {
      for (const child of this.attached.passenger.children) {
        if (child !== this.holder) child.visible = true;
      }
      this.holder.removeFromParent();
      this.attached = null;
    }
  }

  private findBones(handle: SkinnedCharacterHandle): void {
    const bone = (name: string) => handle.root.getObjectByName(name) as THREE.Bone | undefined;
    this.legs = [];
    this.arms = [];
    for (const key of ['l', 'r']) {
      const thigh = bone(`thigh_${key}`), calf = bone(`calf_${key}`), foot = bone(`foot_${key}`);
      if (thigh && calf && foot) this.legs.push({ upper: thigh, lower: calf, end: foot, upperRest: new THREE.Quaternion(), lowerRest: new THREE.Quaternion(), endRest: new THREE.Quaternion(), side: 1 });
      const upper = bone(`upperarm_${key}`), lower = bone(`lowerarm_${key}`), hand = bone(`hand_${key}`);
      if (upper && lower && hand) this.arms.push({ upper, lower, end: hand, upperRest: new THREE.Quaternion(), lowerRest: new THREE.Quaternion(), endRest: new THREE.Quaternion(), side: 1 });
    }
  }

  private attach(): void {
    const { handle, ride, config } = this;
    if (!handle || !ride || !config || !ride.cabin) return;
    this.detach();
    this.attached = ride;
    handle.applyAppearance(config);
    for (const child of ride.passenger.children) child.visible = false;
    ride.passenger.add(this.holder);
    this.holder.visible = true;
    this.holder.scale.setScalar(SCALE);
    this.holder.position.set(0, 0, 0);
    handle.play('sit', 0);
    handle.update(0.25);
    ride.body.updateMatrixWorld(true);
    const pelvis = handle.root.getObjectByName('pelvis');
    if (pelvis) {
      pelvis.getWorldPosition(s);
      ride.passenger.worldToLocal(s);
      this.holder.position.copy(s).multiplyScalar(-1);
      ride.body.updateMatrixWorld(true);
    }
    for (const leg of this.legs) {
      leg.upperRest.copy(leg.upper.quaternion);
      leg.lowerRest.copy(leg.lower.quaternion);
      leg.endRest.copy(leg.end.quaternion);
      leg.upper.getWorldPosition(s);
      ride.body.worldToLocal(s);
      leg.side = s.x >= ride.passenger.position.x ? 1 : -1;
    }
    for (const arm of this.arms) {
      arm.upperRest.copy(arm.upper.quaternion);
      arm.lowerRest.copy(arm.lower.quaternion);
      arm.endRest.copy(arm.end.quaternion);
      arm.upper.getWorldPosition(s);
      ride.body.worldToLocal(s);
      arm.side = s.x >= ride.passenger.position.x ? 1 : -1;
    }
    this.pose(0);
  }

  /** Each frame: sit clip, then legs in the footwell and hands on the thighs. False if not seated. */
  public pose(delta: number): boolean {
    const { handle, attached: ride } = this;
    if (!handle || !ride || ride !== this.ride || !ride.cabin) return false;
    handle.update(delta);
    for (const leg of this.legs) {
      leg.upper.quaternion.copy(leg.upperRest);
      leg.lower.quaternion.copy(leg.lowerRest);
      leg.end.quaternion.copy(leg.endRest);
    }
    for (const arm of this.arms) {
      arm.upper.quaternion.copy(arm.upperRest);
      arm.lower.quaternion.copy(arm.lowerRest);
      arm.end.quaternion.copy(arm.endRest);
    }
    ride.body.updateMatrixWorld(true);
    this.poseLegs(ride);
    this.poseHands(ride);
    return true;
  }

  private poseLegs(ride: RideVehicle): void {
    const cabin = ride.cabin!;
    const seat = ride.passenger.position;
    ride.body.getWorldQuaternion(parent);
    // Front seat back is roughly ahead of the rear hip by the seat cushion depth
    const seatAhead = ride.driver.root.position.z - 0.32;
    for (const leg of this.legs) {
      leg.upper.updateWorldMatrix(true, false);
      leg.upper.getWorldPosition(s);
      ride.body.worldToLocal(s);
      footTarget.set(
        seat.x + leg.side * 0.12,
        cabin.floorY + SOLE,
        Math.min(seat.z + 0.38, seatAhead - 0.1),
      );
      footTarget.x = THREE.MathUtils.clamp(footTarget.x, s.x - 0.05, s.x + leg.side * 0.18);
      ride.body.localToWorld(footTarget);
      poleWorld.set(leg.side * 0.25, 1.1, 0.2).applyQuaternion(parent);
      reachTwoBone(leg, footTarget, poleWorld, 0);
      flattenFoot(leg.end, ride.body);
    }
  }

  /** Hands resting on the thighs */
  private poseHands(ride: RideVehicle): void {
    ride.body.getWorldQuaternion(parent);
    for (const arm of this.arms) {
      const thigh = this.legs.find((l) => l.side === arm.side)?.upper;
      if (!thigh) continue;
      thigh.getWorldPosition(s);
      const calf = this.legs.find((l) => l.side === arm.side)?.lower;
      if (calf) calf.getWorldPosition(e);
      else e.copy(s);
      // Mid-thigh, a little above the cloth
      t.copy(s).lerp(e, 0.45);
      t.y += 0.04 * this.holder.scale.x;
      poleWorld.set(arm.side * 0.2, -0.4, 0.1).applyQuaternion(parent);
      reachTwoBone(arm, t, poleWorld, 0.05 * this.holder.scale.x);
    }
  }
}
