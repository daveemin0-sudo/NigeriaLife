/**
 * How a driven vehicle answers its controls. Kept apart from the models so the rules can be
 * tested on their own and are the same for every vehicle.
 *
 * Steering is a bicycle model: the front wheels are turned by an angle, and the vehicle turns
 * about its rear axle as fast as its speed and wheelbase allow (v · tan δ / L). So a stopped car
 * cannot spin on the spot, a slow one turns tightly, and a fast one turns gently. The tyres can
 * only hold so much sideways force, so the turn is also capped by grip (v · ω ≤ grip).
 *
 * The keyboard is all-or-nothing, so the wheel itself is what is smoothed: held keys turn it at
 * a set rate (slower at speed), released keys bring it back to the middle at a set rate. A tap
 * is a small correction, not a swerve.
 *
 * The road assist keeps a car that is going straight in its lane. It acts only when the driver
 * is not steering, on a carriageway the car is running along (not at a junction, not mid-turn),
 * and its gains are chosen so it settles without overshoot at every speed: the lateral error
 * shrinks like e^(-0.6 t) whatever the speed, and the two loops together are critically damped (ζ ≈ 1.04).
 */
import type { Zone } from './plan/CityPlan';

export type HandlingKind =
  | 'danfo'
  | 'keke'
  | 'suv'
  | 'okada'
  | 'sedan'
  | 'luxury_sedan'
  | 'gwagon'
  | 'sports_car'
  | 'electric_car'
  | 'ambulance';

/** Distance between the axles in metres: what sets how tight a vehicle turns at walking pace. */
const WHEELBASE: Record<HandlingKind, number> = {
  danfo: 3.2,
  keke: 1.9,
  okada: 1.35,
  suv: 2.85,
  gwagon: 2.85,
  sedan: 2.7,
  luxury_sedan: 2.9,
  sports_car: 2.5,
  electric_car: 2.7,
  ambulance: 3.3,
};

/** The most sideways acceleration the tyres hold, m/s². A tall bus leans and slides sooner than a sports car. */
const GRIP: Record<HandlingKind, number> = {
  danfo: 6.0,
  keke: 5.0,
  okada: 7.5,
  suv: 7.5,
  gwagon: 7.5,
  sedan: 8.5,
  luxury_sedan: 8.5,
  sports_car: 10.5,
  electric_car: 8.5,
  ambulance: 6.5,
};

/** Full lock at walking pace, radians (about 35 degrees). */
const LOCK = 0.61;
/** Speed at which full lock has come down to about 70 per cent, m/s. */
const LOCK_FADE_SPEED = 12;
/** How fast held keys turn the wheel, lock-widths per second at a standstill. */
const WHEEL_TURN_RATE = 2.6;
/** How fast the wheel comes back when the keys are let go. */
const WHEEL_RETURN_RATE = 4.5;
/** How fast it swings over when the other key is pressed. */
const WHEEL_SWAP_RATE = 6.0;

/** Road assist: how hard the heading is pulled to the one wanted, and how hard the lane centre pulls on that. */
const ASSIST_HEADING_GAIN = 2.6;
const ASSIST_LANE_GAIN = 0.6;
/** The steepest angle the assist will steer back into a lane at, radians (about 7 degrees). */
const ASSIST_MAX_ANGLE = 0.12;
/** The fastest it may turn the car, rad/s: always gentler than the driver can. */
const ASSIST_MAX_RATE = 0.35;
/** It lets go when the car is this far off the road's line (turning, or crossing the road). */
const ASSIST_CAPTURE = (25 * Math.PI) / 180;
/** The wheel position (of 1) above which the driver is steering and the assist stays out of it. */
export const ASSIST_HANDS_ON = 0.15;
/** A lane is about this wide. */
const LANE_WIDTH = 3.0;
/** Road kept clear beside the painted centre line, and beside the kerb and drain, metres. */
const CENTRE_LINE_MARGIN = 0.35;
const KERB_MARGIN = 0.6;

const clamp = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v);
const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));

/**
 * The wheel after `dt` seconds with the keys as they are. `held` is +1 for left, -1 for right,
 * 0 for neither; the wheel runs from -1 (full right) to +1 (full left).
 */
export function turnWheel(wheel: number, held: -1 | 0 | 1, speed: number, dt: number): number {
  if (held === 0) {
    const back = WHEEL_RETURN_RATE * dt;
    return Math.abs(wheel) <= back ? 0 : wheel - Math.sign(wheel) * back;
  }
  const swapping = wheel !== 0 && Math.sign(wheel) !== held;
  // At speed a held key brings the wheel round more slowly, so holding it is a lane change, not a swerve
  const rate = swapping ? WHEEL_SWAP_RATE : WHEEL_TURN_RATE / (1 + Math.abs(speed) / 18);
  return clamp(wheel + held * rate * dt, -1, 1);
}

/** The angle of the front wheels, radians, for a wheel position at a speed. `handling` scales lock (1 = standard). */
export function wheelAngle(wheel: number, speed: number, handling: number): number {
  const lock = (LOCK * handling) / Math.sqrt(1 + (speed / LOCK_FADE_SPEED) ** 2);
  // A little softer round the middle, so small corrections are small
  return Math.sign(wheel) * Math.pow(Math.abs(wheel), 1.3) * lock;
}

/** How fast the vehicle turns, rad/s (positive = to the left), for a front-wheel angle at a speed (negative in reverse). */
export function yawRate(kind: HandlingKind, angle: number, speed: number): number {
  const rate = (speed * Math.tan(angle)) / WHEELBASE[kind];
  const most = GRIP[kind] / Math.max(Math.abs(speed), 0.1);
  return clamp(rate, -most, most);
}

/** Handling from a vehicle's old `turnSpeed` setting (3 = standard), so nimble vehicles stay nimble. */
export function handlingOf(turnSpeed: number, sensitivity: number): number {
  return clamp(turnSpeed / 3, 0.75, 1.35) * sensitivity;
}

/** Speed after `dt` seconds. Pulls away briskly and tails off near top speed; coasting slows gradually. */
export function nextSpeed(
  speed: number,
  dt: number,
  pedals: { gas: boolean; brake: boolean },
  c: { maxSpeed: number; reverseSpeed: number; acceleration: number; braking: number; friction: number }
): number {
  // A sedan does 0 to 100 km/h in about four and a half seconds
  const pull = c.acceleration * 0.45;
  if (pedals.gas) {
    if (speed < 0) return Math.min(0, speed + c.braking * 0.55 * dt);
    const ease = 1 - 0.8 * (speed / c.maxSpeed) ** 2;
    return Math.min(c.maxSpeed, speed + pull * ease * dt);
  }
  if (pedals.brake) {
    if (speed > 0.5) return Math.max(0, speed - c.braking * 0.55 * dt);
    return Math.max(-c.reverseSpeed, speed - pull * 0.6 * dt);
  }
  // Rolling resistance and air: a few m/s² at town speeds, so lifting off is not an emergency stop
  const drag = c.friction * 1.3 + 0.0025 * speed * speed;
  const slowed = Math.abs(speed) - drag * dt;
  return slowed <= 0 ? 0 : Math.sign(speed) * slowed;
}

/** The carriageway under a point, or null at a junction (two roads) or off the road. */
export function roadUnder(zones: readonly Zone[], x: number, z: number): Zone | null {
  let found: Zone | null = null;
  for (const zone of zones) {
    if (zone.kind !== 'carriageway') continue;
    if (x < zone.minX || x > zone.maxX || z < zone.minZ || z > zone.maxZ) continue;
    if (found) return null;
    found = zone;
  }
  return found;
}

/**
 * The turn the road assist adds, rad/s, for a vehicle at (x, z) heading `heading` (forward is
 * (sin, cos)) at `speed`, on `road`. Zero when it should stay out of it.
 */
export function assistYawRate(road: Zone | null, x: number, z: number, heading: number, speed: number): number {
  if (!road || speed < 3) return 0;
  // Which way along the road the car is going
  const along = road.axis === 'z' ? [0, Math.PI] : [Math.PI / 2, -Math.PI / 2];
  const roadHeading = Math.abs(wrap(heading - along[0])) <= Math.abs(wrap(heading - along[1])) ? along[0] : along[1];
  const headingError = wrap(heading - roadHeading);
  if (Math.abs(headingError) > ASSIST_CAPTURE) return 0;

  // Sideways position across the road, measured to the driver's right (Nigeria drives on the right)
  const rightX = -Math.cos(roadHeading);
  const rightZ = Math.sin(roadHeading);
  const centreX = (road.minX + road.maxX) / 2;
  const centreZ = (road.minZ + road.maxZ) / 2;
  const across = (x - centreX) * rightX + (z - centreZ) * rightZ;
  const half = road.axis === 'z' ? (road.maxX - road.minX) / 2 : (road.maxZ - road.minZ) / 2;

  // The nearest lane centre, on either side: a car in the wrong lane is straightened, not dragged across.
  // Lanes share the road between the centre line and the kerb, where the traffic drives (1.8 and 4.9 m out on Broad Street)
  const usable = Math.max(1, half - CENTRE_LINE_MARGIN - KERB_MARGIN);
  const lanes = Math.max(1, Math.round(usable / LANE_WIDTH));
  const width = usable / lanes;
  const index = clamp(Math.floor((Math.abs(across) - CENTRE_LINE_MARGIN) / width), 0, lanes - 1);
  const target = Math.sign(across || 1) * (CENTRE_LINE_MARGIN + (index + 0.5) * width);
  const offLane = across - target;

  // Sideways speed is -v·sin(headingError): to close the gap at a rate set by the lane gain, aim this far off the line
  const wanted = Math.asin(clamp((ASSIST_LANE_GAIN * offLane) / Math.max(speed, 4), -ASSIST_MAX_ANGLE, ASSIST_MAX_ANGLE));
  return clamp(ASSIST_HEADING_GAIN * (wanted - headingError), -ASSIST_MAX_RATE, ASSIST_MAX_RATE);
}
