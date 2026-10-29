import * as THREE from 'three';

/**
 * A whole flight from stand to stand, as a timeline: at the gate with the jet bridge on, pushed
 * back by the tug, taxied to the runway, the take-off roll and rotation, the climb through the
 * cloud, the cruise, the descent, the approach with its flare, the touchdown and roll-out with
 * the reversers, and the taxi in. Everything is a function of the time since boarding, so the
 * game can be stepped or skipped and the aircraft is always where it should be.
 *
 * The departure airport's runway starts at the origin and runs along +z; the arrival airport is
 * the same layout put down further along, where the descent ends.
 */

export type Stage = 'gate' | 'pushback' | 'taxi' | 'takeoff' | 'climb' | 'cruise' | 'descent' | 'final' | 'rollout' | 'taxi-in';

export interface Pose {
  stage: Stage;
  /** Seconds into the stage, and how long the stage lasts */
  inStage: number;
  stageLength: number;
  /** Where the main wheels are: y is their height above the runway */
  position: THREE.Vector3;
  /** The way the nose points: (sin yaw, cos yaw) on the ground */
  yaw: number;
  pitch: number;
  roll: number;
  /** Ground speed, m/s */
  speed: number;
  /** 1 down, 0 up */
  gear: number;
  /** 0 clean to 1 full flap */
  flaps: number;
  spoilers: number;
  /** 0 idle to 1 take-off power */
  thrust: number;
  reverse: number;
  /** 1 on the aircraft door, 0 pulled back */
  bridge: number;
  /** The tug is on the nose wheel */
  tug: boolean;
  seatbelt: boolean;
  /** The engines are running */
  engines: boolean;
}

export const CRUISE_ALTITUDE = 1700;
const FINAL_ALTITUDE = 85;

/** The departure stand and the way to the runway, in the airport's own layout */
export const STAND = { position: new THREE.Vector3(-230, 0, 140), yaw: -Math.PI / 2 };
const TAXI_OUT = new THREE.CatmullRomCurve3([
  new THREE.Vector3(-175, 0, 118), new THREE.Vector3(-168, 0, 70), new THREE.Vector3(-130, 0, 10), new THREE.Vector3(-70, 0, -25),
  new THREE.Vector3(-18, 0, -18), new THREE.Vector3(0, 0, 12), new THREE.Vector3(0, 0, 32),
]);
/** From the high-speed exit off the runway towards the arrival stands, measured from where the roll-out ends */
const TAXI_IN = new THREE.CatmullRomCurve3([
  new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, 15), new THREE.Vector3(-10, 0, 32), new THREE.Vector3(-28, 0, 43), new THREE.Vector3(-45, 0, 46),
]);

/** Where the arrival runway's threshold is, past the departure one, and where the touchdown is on it */
export const TOUCHDOWN_PAST_THRESHOLD = 350;

export const taxiOutCurve = TAXI_OUT;
export const taxiInCurve = TAXI_IN;

const ease = (u: number) => u * u * (3 - 2 * u);
const clamp01 = (u: number) => Math.max(0, Math.min(1, u));

/** The heading equal to `angle` that is nearest to `near` */
function nearest(angle: number, near: number): number {
  let a = angle;
  while (a - near > Math.PI) a -= Math.PI * 2;
  while (near - a > Math.PI) a += Math.PI * 2;
  return a;
}
const headingOf = (t: THREE.Vector3) => Math.atan2(t.x, t.z);

export class FlightPlan {
  public readonly total: number;
  /** When each stage starts */
  public readonly starts: Record<Stage, number>;
  public readonly order: Stage[] = ['gate', 'pushback', 'taxi', 'takeoff', 'climb', 'cruise', 'descent', 'final', 'rollout', 'taxi-in'];
  /** z of the arrival threshold */
  public readonly arrivalThreshold: number;
  public readonly touchdownZ: number;

  private readonly taxiOutLength = TAXI_OUT.getLength();
  private readonly taxiInLength = TAXI_IN.getLength();
  private readonly pushYaw: number;
  private readonly liftoff: number;
  private readonly climbLength: number;
  private readonly z: Record<'takeoff' | 'climb' | 'cruise' | 'descent' | 'final' | 'rollout', number>;

  constructor(totalSeconds: number) {
    this.total = Math.max(96, totalSeconds);
    const T = this.total;
    this.starts = {
      gate: 0, pushback: 9, taxi: 16, takeoff: 29, climb: 38, cruise: 51,
      descent: T - 36, final: T - 19, rollout: T - 11, 'taxi-in': T - 6,
    };
    this.pushYaw = nearest(headingOf(TAXI_OUT.getTangentAt(0)), STAND.yaw - Math.PI / 2);
    this.liftoff = this.starts.takeoff + 8.3;
    this.climbLength = this.starts.cruise - this.liftoff;
    // Where each airborne stage begins along the runway's line
    const cruiseSeconds = this.starts.descent - this.starts.cruise;
    const takeoffStart = 32;
    const climbStart = takeoffStart + 5 * 9 * 9;
    const cruiseStart = climbStart + 90 * 13 + (40 / 13) * 13 * 13;
    const descentStart = cruiseStart + 170 * cruiseSeconds;
    const finalStart = descentStart + 170 * 17 - (55 / 17 / 2) * 17 * 17;
    const rolloutStart = finalStart + 115 * 8 - (33 / 8 / 2) * 8 * 8;
    this.z = { takeoff: takeoffStart, climb: climbStart, cruise: cruiseStart, descent: descentStart, final: finalStart, rollout: rolloutStart };
    this.touchdownZ = rolloutStart;
    this.arrivalThreshold = rolloutStart - TOUCHDOWN_PAST_THRESHOLD;
  }

  public stageAt(t: number): Stage {
    let stage: Stage = 'gate';
    for (const s of this.order) if (t >= this.starts[s]) stage = s;
    return stage;
  }

  private length(stage: Stage): number {
    const i = this.order.indexOf(stage);
    return (i + 1 < this.order.length ? this.starts[this.order[i + 1]] : this.total) - this.starts[stage];
  }

  /** Where the aircraft is, and how it is set up, this many seconds after the doors closed */
  public at(time: number, out: Pose): Pose {
    const t = Math.max(0, Math.min(this.total, time));
    const stage = this.stageAt(t);
    const s = t - this.starts[stage];
    out.stage = stage;
    out.inStage = s;
    out.stageLength = this.length(stage);
    out.roll = 0;
    out.pitch = 0;
    out.spoilers = 0;
    out.reverse = 0;
    out.tug = false;
    out.bridge = 0;
    out.engines = true;
    out.seatbelt = true;

    // Gear and flap through the flight
    const gearUp = clamp01((t - (this.liftoff + 2.5)) / 3);
    const gearDown = clamp01((t - (this.starts.descent + 11)) / 3);
    out.gear = t < this.starts.descent ? 1 - gearUp : gearDown;
    if (t < this.starts.taxi) out.flaps = 0;
    else if (t < this.starts.climb + 4) out.flaps = 0.4 * clamp01((t - this.starts.taxi - 4) / 4);
    else if (t < this.starts.descent) out.flaps = 0.4 * (1 - clamp01((t - this.starts.climb - 4) / 5));
    else if (t < this.starts['taxi-in']) out.flaps = clamp01((t - this.starts.descent - 4) / 12);
    else out.flaps = 1 - clamp01((t - this.starts['taxi-in'] - 1) / 4);

    switch (stage) {
      case 'gate': {
        out.position.copy(STAND.position);
        out.yaw = STAND.yaw;
        out.speed = 0;
        out.thrust = 0;
        out.engines = s > 6.5;
        out.bridge = 1 - clamp01((s - 5.5) / 3);
        out.tug = s > 6;
        break;
      }
      case 'pushback': {
        const u = ease(clamp01(s / 6.4));
        const end = TAXI_OUT.getPointAt(0);
        out.position.lerpVectors(STAND.position, end, u);
        out.yaw = THREE.MathUtils.lerp(STAND.yaw, this.pushYaw, u);
        out.speed = 3;
        out.thrust = 0.06;
        out.tug = s < 6.6;
        break;
      }
      case 'taxi': {
        const u = clamp01(ease(s / out.stageLength));
        out.position.copy(TAXI_OUT.getPointAt(u));
        out.yaw = nearest(headingOf(TAXI_OUT.getTangentAt(u)), this.pushYaw);
        out.speed = (this.taxiOutLength / out.stageLength) * 1.4 * Math.sin(Math.PI * clamp01(s / out.stageLength));
        out.thrust = 0.2;
        break;
      }
      case 'takeoff': {
        out.position.set(0, 0, this.z.takeoff + 5 * s * s);
        out.yaw = 0;
        out.speed = 10 * s;
        out.thrust = Math.min(1, 0.3 + s * 0.5);
        out.pitch = 0.17 * ease(clamp01((s - 7.2) / 1.4));
        out.position.y = this.climbAltitude(t);
        break;
      }
      case 'climb': {
        out.position.set(0, this.climbAltitude(t), this.z.climb + 90 * s + (40 / 13) * s * s);
        out.yaw = 0;
        out.speed = 90 + (80 / 13) * s;
        out.thrust = 0.88;
        out.pitch = THREE.MathUtils.lerp(0.17, 0.04, ease(clamp01(s / 13)));
        out.roll = 0.05 * Math.sin(s * 0.5);
        break;
      }
      case 'cruise': {
        out.position.set(0, CRUISE_ALTITUDE, this.z.cruise + 170 * s);
        out.yaw = 0;
        out.speed = 170;
        out.thrust = 0.6;
        out.pitch = 0.035;
        out.roll = 0.015 * Math.sin(s * 0.4);
        out.seatbelt = s < 1.5 || s > out.stageLength - 0.5;
        break;
      }
      case 'descent': {
        const u = ease(clamp01(s / 17));
        out.position.set(0, THREE.MathUtils.lerp(CRUISE_ALTITUDE, FINAL_ALTITUDE, u), this.z.descent + 170 * s - (55 / 17 / 2) * s * s);
        out.yaw = 0;
        out.speed = 170 - (55 / 17) * s;
        out.thrust = 0.25;
        out.pitch = 0.012;
        out.roll = 0.03 * Math.sin(s * 0.6);
        break;
      }
      case 'final': {
        const u = clamp01(s / 8);
        out.position.set(0, FINAL_ALTITUDE * Math.pow(1 - u, 1.25), this.z.final + 115 * s - (33 / 8 / 2) * s * s);
        out.yaw = 0;
        out.speed = 115 - (33 / 8) * s;
        out.thrust = 0.4;
        out.pitch = 0.05 + 0.05 * ease(clamp01((s - 6.4) / 1.6));
        out.roll = 0.012 * Math.sin(s * 1.1) * (1 - u);
        break;
      }
      case 'rollout': {
        out.position.set(0, 0, this.z.rollout + 82 * s - 6.8 * s * s);
        out.yaw = 0;
        out.speed = 82 - 13.6 * s;
        out.pitch = 0.1 * (1 - ease(clamp01(s / 1.3)));
        out.spoilers = clamp01(s / 0.4);
        out.reverse = s > 0.6 && s < 3.6 ? 1 : 0;
        out.thrust = out.reverse ? 0.9 : 0.12;
        break;
      }
      case 'taxi-in': {
        const ends = this.z.rollout + 82 * 5 - 6.8 * 25;
        const len = this.taxiInLength;
        const a = (2 * (14 * out.stageLength - len)) / (out.stageLength * out.stageLength);
        const u = clamp01((14 * s - 0.5 * a * s * s) / len);
        out.position.copy(TAXI_IN.getPointAt(u)).add(new THREE.Vector3(0, 0, ends));
        out.yaw = nearest(headingOf(TAXI_IN.getTangentAt(u)), 0);
        out.speed = 14 - a * s;
        out.spoilers = 1 - clamp01(s / 2);
        out.thrust = 0.15;
        out.seatbelt = s < out.stageLength - 1;
        break;
      }
    }
    return out;
  }

  /** Height after the wheels leave the runway: a smooth climb that levels off at cruise */
  private climbAltitude(t: number): number {
    const c = t - this.liftoff;
    if (c <= 0) return 0;
    const u = Math.min(1, c / this.climbLength);
    return (CRUISE_ALTITUDE * (1 - Math.cos(Math.PI * u))) / 2;
  }

  public static blank(): Pose {
    return {
      stage: 'gate', inStage: 0, stageLength: 1, position: new THREE.Vector3(), yaw: 0, pitch: 0, roll: 0, speed: 0,
      gear: 1, flaps: 0, spoilers: 0, thrust: 0, reverse: 0, bridge: 1, tug: false, seatbelt: true, engines: false,
    };
  }
}
