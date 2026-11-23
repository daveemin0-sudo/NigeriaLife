import * as THREE from 'three';
import { holdOn, type RideVehicle } from './RideModels';

export interface KerbSpot {
  x: number;
  z: number;
  yaw: number;
}

/** How far back along the road a driver comes from, at most and at least */
export const PICKUP_APPROACH = 52;
export const PICKUP_LEAST_ROAD = 14;
/** How far from the player the kerb it comes to may be */
export const PICKUP_REACH = 110;
/** The last stretch: out of the lane and in to the kerb */
const PULL_IN = 13;
/** How far out from the kerb the lane is */
const LANE_OUT = 1.7;
/** The distance over which it slows to a stop */
const BRAKING = 9;
const DOOR_OPEN = 1.05;
const DOOR_SECONDS = 0.5;

const smooth = (u: number) => u * u * (3 - 2 * u);

/**
 * The booked vehicle coming up the road to the player: along the lane, in to the kerb, stopped
 * with its driver at the wheel, then the door opening for them. It is the same vehicle the ride
 * is then ridden in, lent to the street until the player gets in.
 */
export class RidePickup {
  public readonly group = new THREE.Group();
  public vehicle: RideVehicle | null = null;
  private kerb: KerbSpot = { x: 0, z: 0, yaw: 0 };
  private left = 0;
  private cruise = 9;
  private speed = 0;
  private door = 0;
  private opening: (() => void) | null = null;

  constructor() {
    this.group.name = 'ride pickup';
  }

  /** Sends it from `room` metres back along the road (at most the usual approach); the seconds until it stops */
  public start(vehicle: RideVehicle, kerb: KerbSpot, room: number, cruise: number): number {
    this.release();
    this.vehicle = vehicle;
    this.kerb = kerb;
    this.left = Math.min(PICKUP_APPROACH, room);
    this.cruise = cruise;
    this.speed = cruise;
    this.door = 0;
    this.group.add(vehicle.body);
    vehicle.body.visible = true;
    this.setDoor(0);
    this.place(0);
    return this.eta;
  }

  /** Seconds until it has stopped at the kerb */
  public get eta(): number {
    if (!this.vehicle || this.left <= 0) return 0;
    return this.left > BRAKING ? (this.left - BRAKING) / this.cruise + (2 * BRAKING) / this.cruise : (2 * this.left) / this.cruise;
  }

  public get arrived(): boolean {
    return !!this.vehicle && this.left <= 0;
  }

  /** Where someone stands to get in: beside the passenger's seat, on the kerb side */
  public doorSpot(): { x: number; z: number; faceYaw: number } | null {
    const v = this.vehicle;
    if (!v) return null;
    // Half the vehicle's width and a step: from a car's door, or a keke's or a bike's known width
    const across = v.door ? Math.abs(v.door.hinge.position.x) + 0.62 : v.wheels.length <= 2 ? 0.85 : 1.3;
    const { yaw } = this.kerb;
    const seat = v.passenger.position.z;
    const x = this.kerb.x - Math.cos(yaw) * across + Math.sin(yaw) * seat;
    const z = this.kerb.z + Math.sin(yaw) * across + Math.cos(yaw) * seat;
    return { x, z, faceYaw: Math.atan2(this.kerb.x + Math.sin(yaw) * seat - x, this.kerb.z + Math.cos(yaw) * seat - z) };
  }

  /** The door swings open (a keke or a bike has none to open), then `done` */
  public openDoor(done: () => void): void {
    if (!this.vehicle?.door) {
      done();
      return;
    }
    this.vehicle.door.hinge.visible = true;
    this.vehicle.door.gap.visible = true;
    this.opening = done;
  }

  public update(delta: number): void {
    const v = this.vehicle;
    if (!v) return;
    if (this.left > 0) {
      this.speed = this.left > BRAKING ? this.cruise : Math.max(0.7, this.cruise * Math.sqrt(this.left / BRAKING));
      const step = Math.min(this.left, this.speed * delta);
      this.left -= step;
      if (this.left < 0.03) this.left = 0;
      for (const wheel of v.wheels) wheel.rotation.x += step / v.wheelRadius;
      this.place(delta);
    }
    if (this.opening) {
      this.door = Math.min(1, this.door + delta / DOOR_SECONDS);
      this.setDoor(this.door);
      if (this.door >= 1) {
        const done = this.opening;
        this.opening = null;
        done();
      }
    }
  }

  /** The street gives the vehicle back */
  public release(): void {
    const v = this.vehicle;
    this.opening = null;
    this.vehicle = null;
    if (!v) return;
    this.door = 0;
    if (v.door) {
      v.door.hinge.rotation.y = 0;
      v.door.hinge.visible = false;
      v.door.gap.visible = false;
    }
    v.steer.rotation.set(0, 0, 0);
    v.body.position.set(0, 0, 0);
    v.body.rotation.set(0, 0, 0);
    v.body.removeFromParent();
  }

  private setDoor(open: number): void {
    const door = this.vehicle?.door;
    if (door) door.hinge.rotation.y = DOOR_OPEN * smooth(open);
  }

  /** On the road, this far back from the kerb spot: out in the lane until the last stretch, then easing in */
  private place(delta: number): void {
    const v = this.vehicle!;
    const { x, z, yaw } = this.kerb;
    const u = Math.min(1, this.left / PULL_IN);
    const out = LANE_OUT * smooth(u);
    const slope = (LANE_OUT * 6 * u * (1 - u)) / PULL_IN;
    const turn = -Math.atan(slope);
    v.body.position.set(x - Math.sin(yaw) * this.left + Math.cos(yaw) * out, 0, z - Math.cos(yaw) * this.left - Math.sin(yaw) * out);
    v.body.rotation.set(0, yaw + turn, 0);
    if (v.lane === 'kerb') v.steer.rotation.set(v.steer.rotation.x, turn * 1.4, 0);
    else v.steer.rotation.z = turn * 3;
    if (delta > 0 || this.left <= 0) holdOn(v);
  }
}
