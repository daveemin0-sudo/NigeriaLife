import * as THREE from 'three';
import { buildGrandTerminal, grandTerminalExtras, parkedFootprints, parkRows, TERMINAL } from './GrandTerminal';
import { flyingAirliner, parkedAirliners } from './OutdoorAirliner';
import { LIVERIES } from '../../interiors/airport/Airliner';
import { Builder } from '../kit/ArchKit';
import { createCashMachine } from '../kit/CashMachine';
import { clickBox, figure, type Landmark, type LandmarkHost } from './Landmark';
import { Sequence, steps, type Step } from '../../interactions/Sequence';
import type { Actor } from '../../interactions/Actor';
import { FlightService, AIRLINE, AIRPORTS, ROUTES, type FlightCity } from '../../travel/Flights';
import { townDrop } from '../../travel/AirportHall';
import { Greeters, Talk, goodDay, naira, oga, ogaMi, sir, tipChoices } from '../../interactions/Talk';
import type { PlaceHost } from '../../destinations/PlaceActions';

export { AIRLINE };

/**
 * An airport: a terminal with a kerbside canopy, a control tower, an apron with parked
 * aircraft and ground equipment, a hangar, and a runway. One airliner works a flight round
 * and round: it boards, is pushed back, taxies, takes off, is away for a while, comes back
 * down the approach, lands and taxies in.
 *
 * It was drawn for the north-west corner of Lagos and its parts are given in those
 * coordinates; `x` and `z` say where the drawing's origin goes, so it can stand elsewhere.
 * The runway runs east-west along the north side and aircraft come and go over the open
 * ground to the west, never over the city.
 *
 * The airline, its name and its colours are made up for the game.
 */

const DRAWN = { x: -100, z: -125 };
/** The terminal's door to the apron, by the stand the flight works from (x as drawn) */
const APRON_DOOR_X = -70;
/** Where a cab from the kerb goes in each city, and the places a driver shouts out */
const TOWN: Record<FlightCity, { name: string; calls: string; fare: number }> = {
  lagos: { name: 'Lagos Island (Broad Street)', calls: 'Island, Lekki, VI, Ikeja', fare: 8_000 },
  abuja: { name: 'Abuja city centre', calls: 'Wuse, Maitama, Garki', fare: 6_000 },
  port_harcourt: { name: 'Port Harcourt town', calls: 'GRA, Rumuokoro, Trans-Amadi', fare: 6_000 },
  ibadan: { name: 'Ibadan town', calls: 'Dugbe, Bodija', fare: 5_000 },
};

/** What the terminal says to those who have just landed, over the apron */
const WELCOME: Partial<Record<FlightCity, string[]>> = {
  lagos: ['WELCOME TO LAGOS', 'EKO O NI BAJE!'],
  abuja: ['WELCOME TO ABUJA', 'CENTRE OF UNITY'],
  port_harcourt: ['WELCOME TO PORT HARCOURT', 'THE GARDEN CITY'],
};

const WHITE = 0xf8fafc;
const DARK = 0x1f2937;

export type FlightState =
  | 'Boarding'
  | 'Pushback'
  | 'Taxiing'
  | 'Taking off'
  | 'In flight'
  | 'Approaching'
  | 'Landing'
  | 'Taxiing to the stand'
  | 'Arrived';

interface Leg {
  state: FlightState;
  seconds: number;
  x: number;
  y: number;
  z: number;
  /** Which way the nose points when the leg ends, in degrees: 0 east, 90 south, 180 west, 270 north */
  heading: number;
  pitch?: number;
  ease?: 'line' | 'in' | 'out' | 'both' | 'climb' | 'descend';
  /** Out of sight for the whole of this leg */
  away?: boolean;
}

/**
 * The stand the flight works from, nose in to the terminal: the middle of the aircraft. Its nose
 * stops a little short of the glass, and its forward door (on its east side) is where the steps go.
 */
const STAND = { x: -79, z: -131.1 };
/** The two other stands, each with an aircraft at its jet bridge */
const PARKED_STANDS = [-108, -137];
const RUNWAY_Z = -159.6;
/** The aircraft: an ATR 72 at its real size (27 m long, 27 m across the wings) */
const HALF_LENGTH = 13.6;
const HALF_SPAN = 13.4;
/** The forward door, on the stand: its sill, and where it is (the steps' top) */
const DOOR = { sill: 1.37, x: STAND.x + 1.3, z: STAND.z + HALF_LENGTH - 3.2 };

/** One whole flight, there and back, as the places the aircraft is moved to in turn. */
const FLIGHT: Leg[] = [
  { state: 'Boarding', seconds: 18, x: STAND.x, y: 0, z: STAND.z, heading: 90 },
  // Pushed back off the stand, tail first, and turned on to the runway facing west
  { state: 'Pushback', seconds: 9, x: STAND.x, y: 0, z: -150, heading: 90, ease: 'both' },
  { state: 'Pushback', seconds: 5, x: -76, y: 0, z: RUNWAY_Z, heading: 180, ease: 'both' },
  { state: 'Taxiing', seconds: 4, x: -82, y: 0, z: RUNWAY_Z, heading: 180, ease: 'both' },
  { state: 'Taking off', seconds: 9, x: -142, y: 0, z: RUNWAY_Z, heading: 180, ease: 'in' },
  { state: 'Taking off', seconds: 9, x: -330, y: 58, z: RUNWAY_Z, heading: 180, pitch: 0.24, ease: 'climb' },
  { state: 'In flight', seconds: 20, x: -340, y: 52, z: RUNWAY_Z, heading: 0, away: true },
  { state: 'Approaching', seconds: 9, x: -150, y: 0, z: RUNWAY_Z, heading: 0, pitch: 0.07, ease: 'descend' },
  { state: 'Landing', seconds: 10, x: -84, y: 0, z: RUNWAY_Z, heading: 0, ease: 'out' },
  // Off the runway and nose in to the stand
  { state: 'Taxiing to the stand', seconds: 5, x: STAND.x, y: 0, z: -150, heading: 90, ease: 'both' },
  { state: 'Taxiing to the stand', seconds: 7, x: STAND.x, y: 0, z: STAND.z, heading: 90, ease: 'out' },
  { state: 'Arrived', seconds: 12, x: STAND.x, y: 0, z: STAND.z, heading: 90 },
];
const FLIGHT_SECONDS = FLIGHT.reduce((total, leg) => total + leg.seconds, 0);
/** When in the round each state begins, in seconds */
const startOf = (state: FlightState): number => {
  let at = 0;
  for (const leg of FLIGHT) {
    if (leg.state === state) return at;
    at += leg.seconds;
  }
  return 0;
};
const BOARDING_ENDS = FLIGHT[0].seconds;
const AWAY_FROM = startOf('In flight');
const APPROACH_FROM = startOf('Approaching');
const ARRIVED_FROM = startOf('Arrived');

/** Up a flight of steps: across the ground and up at once, which walking alone cannot do. */
function climb(actor: Actor, to: () => THREE.Vector3, rise: number, seconds: number): Step {
  const from = new THREE.Vector3();
  let t = 0;
  return {
    name: 'climb the steps',
    begin() {
      actor.worldPosition(from);
      t = 0;
      actor.pose = { legs: 'walk', arms: 'swing' };
    },
    tick(delta) {
      t = Math.min(1, t + delta / seconds);
      const top = to();
      actor.setWorldPosition(from.x + (top.x - from.x) * t, from.z + (top.z - from.z) * t);
      actor.root.position.y = rise * t;
      return t >= 1;
    },
  };
}

const EASE: Record<NonNullable<Leg['ease']>, (t: number) => number> = {
  line: (t) => t,
  in: (t) => t * t,
  out: (t) => 1 - (1 - t) * (1 - t),
  both: (t) => t * t * (3 - 2 * t),
  // Already rolling when the leg starts, and still gathering speed
  climb: (t) => 0.55 * t + 0.45 * t * t,
  descend: (t) => 1 - (0.55 * (1 - t) + 0.45 * (1 - t) * (1 - t)),
};

export interface FlightPose {
  state: FlightState;
  x: number;
  y: number;
  z: number;
  heading: number;
  pitch: number;
  away: boolean;
}

/** Where the aircraft is, `seconds` into its round, in the coordinates the airport was drawn in. */
export function flightAt(seconds: number): FlightPose {
  let left = ((seconds % FLIGHT_SECONDS) + FLIGHT_SECONDS) % FLIGHT_SECONDS;
  for (let i = 0; i < FLIGHT.length; i++) {
    const leg = FLIGHT[i];
    if (left > leg.seconds && i < FLIGHT.length - 1) {
      left -= leg.seconds;
      continue;
    }
    const from = FLIGHT[(i + FLIGHT.length - 1) % FLIGHT.length];
    const t = EASE[leg.ease ?? 'line'](Math.min(1, left / leg.seconds));
    const turn = ((leg.heading - from.heading + 540) % 360) - 180;
    // A pitched leg holds its nose up through the middle and levels at both ends
    const pitch = leg.pitch ? leg.pitch * Math.min(1, Math.sin(Math.PI * Math.min(1, left / leg.seconds)) * 2.2) : 0;
    return {
      state: leg.state,
      x: from.x + (leg.x - from.x) * t,
      y: from.y + (leg.y - from.y) * t,
      z: from.z + (leg.z - from.z) * t,
      heading: from.heading + turn * t,
      pitch,
      away: !!leg.away,
    };
  }
  throw new Error('flight has no legs');
}

export interface AirportOptions {
  /** The ids its entrance answers to */
  ids: string[];
  /** The city whose flights leave from here */
  city: FlightCity;
  /** Where the drawing's origin goes. Leave out to stand where it was drawn. */
  x?: number;
  z?: number;
  /** This airport opens its own front door. Left out where the door is already something else's to open. */
  ownDoor?: boolean;
  /** A road of its own from the forecourt: south to this z, then east to this x (both as drawn) */
  approach?: { alongZ: number; toX: number };
}

export interface AirportLandmark extends Landmark {
  city: FlightCity;
  /** The flight's clock, in seconds: set it to put the aircraft anywhere in its round */
  flight: { clock: number; readonly seconds: number };
  /** Outside the front door, at the kerb */
  kerb: THREE.Vector3;
  /** On the apron: outside the terminal's door to it, and at the foot of the aircraft steps */
  apron: { door: THREE.Vector3; steps: THREE.Vector3 };
  /** Is the aircraft on the stand with its door open? */
  atStand(): boolean;
  /** Puts the aircraft on the stand as one that has just come in, for passengers to get off */
  receive(): void;
}

export function createAirport(options: AirportOptions): AirportLandmark {
  const flights = FlightService.get();
  const name = AIRPORTS[options.city].name;
  const code = AIRPORTS[options.city].code;
  const site = { x: options.x ?? DRAWN.x, z: options.z ?? DRAWN.z };
  const move = { x: site.x - DRAWN.x, z: site.z - DRAWN.z };
  const at = (x: number, z: number) => new THREE.Vector3(x + move.x, 0, z + move.z);
  const b = new Builder().around(DRAWN.x, DRAWN.z);

  // --- Ground -----------------------------------------------------------------------------
  // Mown grass over the airport's own grounds, under everything else (the airfield, the forecourt, the car park)
  b.ground(0x5f8f32, 124, 103, -121.5, 0.006, -117.5);
  b.ground(0x4d7c0f, 121, 52, -121.5, 0.012, -142);
  // The apron behind the terminal, the runway along the north, and the taxiway between them
  b.ground(0xa1a1aa, 91, 32, -106.5, 0.02, -132);
  b.ground(0x18181b, 120, 11, -122, 0.026, RUNWAY_Z);
  b.ground(0x27272a, 16, 7, STAND.x, 0.024, -151);
  b.ground(0x27272a, 16, 7, -137, 0.024, -151);

  // Runway: the piano keys at each end, the centre line, the edge lights, the green threshold lights
  for (const end of [-178, -66]) {
    for (let k = -4; k <= 4; k++) if (k !== 0) b.ground(WHITE, 3.6, 0.45, end, 0.036, RUNWAY_Z + k * 1.05);
  }
  for (let x = -172; x <= -72; x += 6) b.ground(WHITE, 3.2, 0.35, x, 0.036, RUNWAY_Z);
  for (let x = -181; x <= -63; x += 7) {
    b.box(0xfef08a, 0.22, 0.25, 0.22, x, 0, RUNWAY_Z - 5.2, { glow: true }).box(0xfef08a, 0.22, 0.25, 0.22, x, 0, RUNWAY_Z + 5.2, { glow: true });
  }
  for (let k = -4.5; k <= 4.5; k += 1.2) {
    b.box(0x22c55e, 0.22, 0.22, 0.22, -181.5, 0, RUNWAY_Z + k, { glow: true });
    b.box(0x22c55e, 0.22, 0.22, 0.22, -62.5, 0, RUNWAY_Z + k, { glow: true });
  }

  // On the apron: a yellow lead-in line to each stand and the bar its nose wheel stops at; a red box round each
  const TAXI = 0xfacc15;
  b.ground(TAXI, 0.3, 36.5, STAND.x, 0.036, -136.5);
  for (const x of PARKED_STANDS) b.ground(TAXI, 0.3, 30, x, 0.036, -133.3);
  for (const x of [STAND.x, ...PARKED_STANDS]) {
    b.ground(TAXI, 3, 0.35, x, 0.036, STAND.z + HALF_LENGTH - 2.4);
    b.ground(0xdc2626, 28, 0.28, x, 0.036, -116.7).ground(0xdc2626, 28, 0.28, x, 0.036, -146);
    b.ground(0xdc2626, 0.28, 29.3, x - 14, 0.036, -131.35).ground(0xdc2626, 0.28, 29.3, x + 14, 0.036, -131.35);
  }
  // Blue lights along the taxiway edges
  for (const z of [-148.5, -153.5]) {
    for (const x of [STAND.x - 8, STAND.x + 8, -145, -129]) b.box(0x38bdf8, 0.18, 0.2, 0.18, x, 0, z, { glow: true });
  }

  // A road of its own, where the city has none that comes this way: out of the forecourt and round to the avenue
  if (options.approach) {
    const { alongZ, toX } = options.approach;
    const down = alongZ + 90;
    const across = toX + 83;
    b.ground(0x3f3f46, 6, down + 3, -80, 0.022, -90 + (down + 3) / 2).ground(0x3f3f46, across, 6, -83 + across / 2, 0.022, alongZ);
    for (const side of [-1, 1]) {
      b.ground(0xbdb5a8, 1.8, down - 3, -80 + side * 3.9, 0.02, -90 + (down - 3) / 2);
      b.ground(0xbdb5a8, across - 3.9, 1.8, -83 + 3.9 + (across - 3.9) / 2, 0.02, alongZ + side * 3.9);
    }
    for (let x = -76; x < toX - 2; x += 6) b.ground(WHITE, 2.6, 0.16, x, 0.03, alongZ);
  }

  // --- The terminal: one great glass hall under a vaulted roof (see GrandTerminal) ---------
  const rows = parkRows(options.approach?.alongZ);
  buildGrandTerminal(b, rows);
  for (const f of parkedFootprints(rows)) b.occupy(f.minX, f.maxX, f.minZ, f.maxZ, 1.5);
  // The door onto the apron, by the stand the flight works from
  b.box(0x0f172a, 3.2, 2.8, 0.2, APRON_DOOR_X, 0, TERMINAL.back - 0.18, { solid: false });
  b.box(0x0b7a43, 3.8, 0.4, 0.3, APRON_DOOR_X, 2.8, TERMINAL.back - 0.2, { solid: false });

  // The parked aircraft's bodies, and the main wheels under their wings: nobody walks through them
  for (const x of PARKED_STANDS) {
    b.occupy(x - 1.45, x + 1.45, STAND.z - HALF_LENGTH + 1, STAND.z + HALF_LENGTH - 0.4, 4.2);
    b.occupy(x - 2.6, x + 2.6, STAND.z + 0.6, STAND.z + 2.4, 1.2);
  }

  // --- Jet bridges: from the terminal's upper floor out to the forward door of each parked aircraft ---
  for (const x of PARKED_STANDS) {
    const tx = x + 3.4;
    const doorZ = STAND.z + HALF_LENGTH - 3.2;
    // The tunnel, glazed along its side, on a wheeled leg; and the cab that meets the door
    b.box(0xe2e8f0, 2.1, 2.4, doorZ - TERMINAL.back + 1.6, tx, 1.25, (TERMINAL.back + doorZ) / 2 - 0.6, { solid: false });
    b.box(0x7dd3fc, 0.06, 0.7, doorZ - TERMINAL.back, tx + 1.07, 2.4, (TERMINAL.back + doorZ) / 2 - 0.6, { solid: false, glow: true });
    b.box(0xcbd5e1, 2.0, 2.5, 2.4, x + 2.0, 1.2, doorZ, { solid: false });
    b.box(0x334155, 0.3, 2.3, 2.2, x + 1.15, 1.3, doorZ, { solid: false });
    b.cylinder(0x94a3b8, 0.16, 1.25, tx, 0, doorZ - 1.4, { solid: false });
    b.tube(DARK, 0.32, 0.32, 0.7, tx, 0.32, doorZ - 1.4, { sides: 12 });
  }

  // --- The control tower ------------------------------------------------------------------
  const tower = { x: -172.5, z: -140.5 };
  b.box(0xe5e7eb, 8.5, 3.6, 7.5, tower.x, 0, tower.z, { solid: true });
  b.windows(0x7dd3fc, 4, 1, 7.2, 1.0, 2.2, tower.x, tower.z + 3.77, 0, { glow: true });
  b.cylinder(0xf1f5f9, 2.2, 17.5, tower.x, 0, tower.z, { topRadius: 1.8, sides: 18 });
  b.box(0x94a3b8, 0.3, 17.0, 4.8, tower.x, 0, tower.z);
  b.box(0x94a3b8, 4.8, 17.0, 0.3, tower.x, 0, tower.z);
  b.cylinder(0xe2e8f0, 3.0, 0.5, tower.x, 17.1, tower.z, { sides: 12 });
  b.cylinder(0x64748b, 3.1, 0.9, tower.x, 17.6, tower.z, { topRadius: 3.1, sides: 12 });
  b.cylinder(0x0c4a6e, 2.8, 2.8, tower.x, 17.6, tower.z, { topRadius: 3.4, sides: 12 });
  b.cylinder(0x7dd3fc, 2.9, 1.8, tower.x, 18.2, tower.z, { topRadius: 3.3, sides: 12, glow: true });
  b.cylinder(0xe2e8f0, 3.6, 0.45, tower.x, 20.4, tower.z, { sides: 12 });
  b.dome(0xf8fafc, 0.8, tower.x - 1.2, 20.85, tower.z + 1.0);
  b.cylinder(0x94a3b8, 0.08, 4.8, tower.x + 1.4, 20.85, tower.z);
  b.box(0xef4444, 0.35, 0.35, 0.35, tower.x + 1.4, 25.65, tower.z, { glow: true });

  // --- The hangar -------------------------------------------------------------------------
  const hangar = { x: -169, z: -125 };
  b.box(0xcbd5e1, 18, 9.2, 14, hangar.x, 0, hangar.z, { solid: true });
  b.box(0x94a3b8, 18.6, 0.3, 8.5, hangar.x, 10.0, hangar.z - 4.1, { pitch: -0.22 });
  b.box(0x94a3b8, 18.6, 0.3, 8.5, hangar.x, 10.0, hangar.z + 4.1, { pitch: 0.22 });
  b.box(0xcbd5e1, 0.3, 1.2, 10, hangar.x + 9, 9.2, hangar.z);
  b.box(0xcbd5e1, 0.3, 1.2, 10, hangar.x - 9, 9.2, hangar.z);
  b.box(0x1e293b, 0.18, 7.2, 13, hangar.x + 9.04, 0, hangar.z);

  // --- Ground equipment -------------------------------------------------------------------
  // Steps up to the forward door of the aircraft on the stand, from the east
  const stairs = { x: DOOR.x, z: DOOR.z };
  for (let step = 0; step < 6; step++) {
    b.box(0xe5e7eb, 0.55, DOOR.sill - step * 0.228, 1.3, stairs.x + 0.28 + step * 0.55, 0, stairs.z);
  }
  b.box(0xfacc15, 1.8, 0.52, 1.6, stairs.x + 3.9, 0, stairs.z);
  b.box(0x94a3b8, 3.4, 1.0, 0.06, stairs.x + 1.65, 1.0, stairs.z - 0.65, { roll: -0.4 });
  b.box(0x94a3b8, 3.4, 1.0, 0.06, stairs.x + 1.65, 1.0, stairs.z + 0.65, { roll: -0.4 });

  // The pushback tug, waiting beside the nose
  b.box(0xf97316, 1.5, 1.1, 2.2, STAND.x - 5, 0.2, -118.6);
  b.box(DARK, 1.4, 0.7, 1.5, STAND.x - 5, 1.3, -118.9);
  for (const [dx, dz] of [[-0.8, -0.8], [0.8, -0.8], [-0.8, 0.8], [0.8, 0.8]]) b.tube(DARK, 0.45, 0.45, 0.32, STAND.x - 5 + dx, 0.45, -118.6 + dz, { sides: 12 });

  // The baggage tractor and its train of carts, under the west wing by the hold
  b.box(0xf97316, 1.2, 1.0, 1.8, STAND.x - 5.5, 0.2, -133).box(DARK, 1.1, 0.6, 1.2, STAND.x - 5.5, 1.2, -133.3);
  for (let cart = 0; cart < 3; cart++) {
    const z = -135.5 - cart * 2.3;
    b.box(0x64748b, 1.2, 0.2, 1.9, STAND.x - 5.5, 0.45, z);
    b.box(cart === 1 ? 0x1d4ed8 : cart === 2 ? 0x15803d : 0xb91c1c, 1, 0.7, 1.5, STAND.x - 5.5, 0.65, z);
    b.box(DARK, 1.3, 0.4, 1.6, STAND.x - 5.5, 0, z);
  }

  // The fuel bowser, under the east wing
  b.box(0xdc2626, 2.2, 1.8, 1.8, STAND.x + 7, 0.4, -129.5);
  b.box(DARK, 2.1, 0.8, 0.8, STAND.x + 7, 1.4, -129.5);
  b.tube(0xe5e7eb, 0.95, 0.95, 3.4, STAND.x + 7, 1.55, -132.2, { yaw: Math.PI / 2 });
  b.box(DARK, 2.2, 0.5, 5.0, STAND.x + 7, 0, -131.2);

  // Apron high-mast floodlight towers
  for (const [x, z] of [[-122.5, -116.4], [-93.5, -116.4], [-63.8, -116.4]]) {
    b.cylinder(0x94a3b8, 0.28, 16, x, 0, z, { topRadius: 0.16, solid: true });
    b.box(0x475569, 3.2, 0.8, 0.4, x, 16.0, z - 0.2);
    b.box(0xfff7c2, 3.0, 0.6, 0.15, x, 16.0, z - 0.4, { glow: true });
  }

  // Windsock on swivel mast
  b.cylinder(0xe5e7eb, 0.08, 5.5, -155, 0, -141);
  b.tube(0xf97316, 0.45, 0.18, 2.1, -154, 5.4, -141);
  b.tube(WHITE, 0.35, 0.28, 0.7, -154, 5.4, -141);

  // --- The fence between the street and the airfield --------------------------------------
  const FENCE = 0x64748b;
  // Round the airfield: north beyond the runway, west and east; and across from the terminal's west end, airside from the car parks
  b.box(FENCE, 121, 2.4, 0.2, -121.5, 0, -168, { solid: true });
  b.box(FENCE, 0.2, 2.4, 51, -182, 0, -142.5, { solid: true });
  b.box(FENCE, 0.2, 2.4, 52, -61, 0, -142, { solid: true });
  b.box(FENCE, 31.4, 2.4, 0.2, -166.3, 0, -117, { solid: true });
  b.box(FENCE, 4.4, 2.4, 0.2, -63.2, 0, -116, { solid: true });

  const group = b.build(options.ids[0]);
  group.position.set(site.x, 0, site.z);
  const local = (x: number, y: number, z: number) => new THREE.Vector3(x - DRAWN.x, y, z - DRAWN.z);

  const hangarSign = { lines: [AIRLINE, 'Aircraft Maintenance & Engineering'], width: 10, height: 1.6, bg: '#f8fafc', ink: '#0b7a43', at: local(hangar.x + 9.14, 7.2, hangar.z), turn: Math.PI / 2 };
  const marshal = figure(0xfacc15, 0x1f2937, 0x5b3a1e, 0xf97316);
  marshal.position.copy(local(STAND.x - 3.5, 0, -117.6));
  marshal.rotation.y = Math.PI;
  const porter = figure(0x1d4ed8, 0x1f2937, 0x6b4226);
  porter.position.copy(local(-77.6, 0, -100.6));
  group.add(marshal, porter, grandTerminalExtras(name, code, local, rows, WELCOME[options.city] ?? [`WELCOME TO ${AIRPORTS[options.city].city.toUpperCase()}`], [hangarSign]));

  // The radar turns
  const radar = new Builder().box(0xf97316, 3.2, 0.5, 0.14, 0, 0.5, 0).box(0x94a3b8, 0.14, 0.5, 0.14, 0, 0, 0).build('radar');
  radar.position.copy(local(tower.x - 1, 19.5, tower.z));
  group.add(radar);

  // --- The aircraft -----------------------------------------------------------------------
  // Two at their jet bridges, nose in, merged into one; and the one that flies
  const noseIn = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), -Math.PI / 2);
  const parked = parkedAirliners('atr', LIVERIES.eko, PARKED_STANDS.map((x) => new THREE.Matrix4().compose(local(x, 0, STAND.z), noseIn, new THREE.Vector3(1, 1, 1))));
  const plane = flyingAirliner('atr', LIVERIES.nigerialife);
  const working = plane.group;
  group.add(parked, working);

  // --- The departures board, on the front of the terminal ----------------------------------
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 320;
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const board = new THREE.Mesh(new THREE.PlaneGeometry(9, 2.8), new THREE.MeshBasicMaterial({ map: texture }));
  board.position.copy(local(-103, 9.2, -102.62));
  board.userData.surface = true;
  group.add(board);
  let shown = '';
  const show = (rows: Array<[string, string, string, string]>) => {
    const key = rows.map((row) => row.join(' ')).join('|');
    if (key === shown) return;
    shown = key;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#020617';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';
    ctx.fillStyle = '#facc15';
    ctx.font = '800 44px system-ui, sans-serif';
    ctx.fillText(`${AIRLINE.toUpperCase()}  ·  ${code}`, 28, 48);
    rows.forEach(([kind, flight, place, status], index) => {
      const y = 140 + index * 96;
      ctx.fillStyle = '#94a3b8';
      ctx.font = '700 30px system-ui, sans-serif';
      ctx.fillText(kind, 28, y - 34);
      ctx.fillStyle = '#f8fafc';
      ctx.font = '800 50px system-ui, sans-serif';
      ctx.fillText(`${flight}  ${place}`, 28, y + 12);
      ctx.textAlign = 'right';
      ctx.fillStyle = '#4ade80';
      ctx.fillText(status, canvas.width - 28, y + 12);
      ctx.textAlign = 'left';
    });
    texture.needsUpdate = true;
  };

  const DEPARTING: Record<FlightState, string> = {
    'Boarding': 'BOARDING',
    'Pushback': 'GATE CLOSED',
    'Taxiing': 'TAXIING',
    'Taking off': 'TAKING OFF',
    'In flight': 'DEPARTED',
    'Approaching': 'DEPARTED',
    'Landing': 'DEPARTED',
    'Taxiing to the stand': 'NEXT FLIGHT SOON',
    'Arrived': 'CHECK-IN OPEN',
  };
  const ARRIVING: Record<FlightState, string> = {
    'Boarding': 'ARRIVED',
    'Pushback': 'ARRIVED',
    'Taxiing': 'SCHEDULED',
    'Taking off': 'SCHEDULED',
    'In flight': 'EXPECTED',
    'Approaching': 'APPROACHING',
    'Landing': 'LANDING',
    'Taxiing to the stand': 'LANDED',
    'Arrived': 'ARRIVED',
  };

  // The front of the terminal is the way in, all but its east end, where the cash machine is in the wall
  const door = clickBox(30, 7, 6);
  door.position.copy(local(-90, 3.5, -101));
  group.add(door);
  const machine = createCashMachine({ id: `airport-${code.toLowerCase()}`, name, x: -68.3 + move.x, z: -102.6 + move.z, facing: 0 });
  machine.group.position.copy(local(-68.3, 0, -102.6));
  group.add(machine.group);
  const entrance = at(-80, -101.2);

  // --- At the kerb, two who speak first: a taxi driver by his cab, and an officer by the doors ---
  const driver = figure(0xf8fafc, 0x1f2937, 0x5b3a1e);
  driver.position.copy(local(-93.5, 0, -100.1));
  driver.rotation.y = Math.PI;
  const officer = figure(0x1f2937, 0x1f2937, 0x6b4226, 0x1f2937);
  officer.position.copy(local(-86.5, 0, -101.6));
  group.add(driver, officer);
  const driverId = `${options.ids[0]}-cab-driver`;
  const officerId = `${options.ids[0]}-officer`;
  const driverAt = at(-93.5, -101.3);
  const officerAt = at(-86.5, -100.4);
  const town = TOWN[options.city];
  const ride = (host: PlaceHost, fare: number) => {
    const drop = townDrop();
    if (!drop || !Talk.rideTo) {
      host.say(`Emeka: "Ah, ${oga().toLowerCase()}, the road is blocked now. Try the cab desk inside."`, 'info');
      return;
    }
    host.say(`Emeka: "Enter, ${oga().toLowerCase()}! Make we go."`, 'success');
    Talk.rideTo(drop, town.name, fare);
  };
  const cabDriver = (host: PlaceHost) => {
    const who = 'Emeka';
    const role = 'Taxi driver · Arrivals kerb';
    const decline = () => host.ask({
      who, role,
      text: `No wahala, ${oga().toLowerCase()}. But find me something now, make I take guide. Fuel money!`,
      choices: tipChoices(host, who, [200, 500], `${oga()}, God bless you! Safe journey.`, `Okay o, ${oga().toLowerCase()}. Next time!`),
    });
    host.ask({
      who, role,
      text: `${oga()}! Welcome to ${AIRPORTS[options.city].city}! Where you dey go? ${town.calls}? Make I carry you. My motor clean, AC dey work well well!`,
      choices: [
        { label: `🚕 Take me to ${town.name}`, note: naira(town.fare), pick: () => ride(host, town.fare) },
        {
          label: 'Ah, that price is too much',
          pick: () => host.ask({
            who, role,
            text: `${oga()}, fuel price na wahala o! But because of you: ${naira(town.fare - 1_000)}. Last price!`,
            choices: [
              { label: `Okay, ${naira(town.fare - 1_000)}. Let's go`, pick: () => ride(host, town.fare - 1_000) },
              { label: 'No, thank you', pick: decline },
            ],
          }),
        },
        { label: 'No, I have a ride', pick: decline },
      ],
    });
  };
  const officerTalk = (host: PlaceHost) => {
    host.ask({
      who: 'Sergeant Bello',
      role: 'FAAN Aviation Security · Kerb',
      text: `${goodDay()}, ${sir()}! Welcome to ${name}. Departures is upstairs on the deck; arrivals and the way in are right here. ${ogaMi()}, anything for the boys? We dey here since morning o.`,
      choices: [
        ...tipChoices(host, 'Sergeant Bello', [500, 1_000], `${oga()}, you be correct person! God go bless you.`, `No wahala, ${oga().toLowerCase()}. Enjoy yourself!`),
        { label: 'Where do I get a cab?', pick: () => host.say(`Sergeant Bello: "The registered cab desk is inside, by the belt, ${sir()}. Or talk to the drivers by the taxis here."`, 'info') },
      ],
    });
  };
  const kerbTalk = new Greeters([
    { id: driverId, x: driverAt.x, z: driverAt.z, radius: 1.3, open: cabDriver },
    { id: officerId, x: officerAt.x, z: officerAt.z, radius: 1.3, open: officerTalk },
  ]);
  /** Only greet in the city the player is in: the airport's group is drawn only there */
  const inThisCity = () => {
    for (let n: THREE.Object3D | null = group; n; n = n.parent) if (!n.visible) return false;
    return true;
  };
  const leaving = flights.routesFrom(options.city);
  const description = `${AIRLINE} flies from here to ${leaving.map((route) => AIRPORTS[route.to].city).join(' and ')}. Buy a ticket and check in inside, then walk out to the aircraft.`;

  const flight = { clock: 0, seconds: FLIGHT_SECONDS };
  let pose = flightAt(0);
  let round = 0;
  const atStand = () => pose.state === 'Boarding' || pose.state === 'Arrived';

  // --- On the apron: the door from the terminal, and the steps up to the aircraft -----------
  const apronDoor = at(APRON_DOOR_X, TERMINAL.back - 2.2);
  const stepsFoot = at(stairs.x + 4.4, stairs.z);
  const cabinDoor = at(stairs.x - 0.05, stairs.z);
  const doorBox = clickBox(4, 3, 2.4);
  doorBox.position.copy(local(APRON_DOOR_X, 1.5, TERMINAL.back - 0.9));
  const stepsBox = clickBox(5.4, 3, 2.6);
  stepsBox.position.copy(local(stairs.x + 2.2, 1.5, stairs.z));
  group.add(doorBox, stepsBox);
  const stepsId = `${options.ids[0]}-steps`;
  const apronDoorId = `${options.ids[0]}-apron-door`;
  /** The flight the board shows: the one a checked-in passenger is waiting for, or the next in turn */
  const showing = () => {
    const held = flights.booking;
    return held && held.route.from === options.city ? held.route : leaving[round % leaving.length];
  };

  const landmark: AirportLandmark = {
    id: options.ids[0],
    name,
    city: options.city,
    flight,
    kerb: entrance,
    apron: { door: apronDoor, steps: stepsFoot },
    atStand,
    receive() {
      flight.clock = Math.floor(flight.clock / FLIGHT_SECONDS) * FLIGHT_SECONDS + ARRIVED_FROM + 0.05;
      landmark.update?.(0, 12);
    },
    zone: { minX: -183 + move.x, maxX: -60 + move.x, minZ: -169 + move.z, maxZ: -66 + move.z },
    group,
    obstructions: b.obstructions(name, site.x, site.z),
    interactive: [
      machine.interactive,
      ...options.ids.map((id) => ({
        mesh: door,
        id,
        name: `${name} (${code})`,
        category: 'Airport',
        description,
        interactionPoint: entrance,
      })),
      { mesh: driver, id: driverId, name: 'Emeka (taxi driver)', category: 'Airport · Arrivals kerb', description: 'A cab into town, if the price is right.', interactionPoint: driverAt },
      { mesh: officer, id: officerId, name: 'Sergeant Bello (FAAN)', category: 'Airport · Kerb', description: 'Keeps an eye on the doors.', interactionPoint: officerAt },
      {
        mesh: stepsBox,
        id: stepsId,
        name: 'Aircraft steps',
        category: 'Airport · Boarding',
        description: 'The way on to the aircraft on the stand, for passengers who have checked in and been through security.',
        interactionPoint: stepsFoot,
      },
      {
        mesh: doorBox,
        id: apronDoorId,
        name: 'Terminal, from the apron',
        category: 'Airport · Arrivals',
        description: 'Through the terminal to the street.',
        interactionPoint: apronDoor,
      },
    ],
    actions: {
      ...(options.ownDoor
        ? Object.fromEntries(options.ids.map((id) => [id, { label: () => '🚪 Go into the terminal', run: (host: LandmarkHost) => host.enter('airport', entrance) }]))
        : {}),
      [driverId]: { label: () => '💬 Talk to Emeka', run: (host: PlaceHost) => { kerbTalk.open(driverId); void host; } },
      [officerId]: { label: () => '💬 Talk to Sergeant Bello', run: (host: PlaceHost) => { kerbTalk.open(officerId); void host; } },
      [apronDoorId]: {
        label: () => '🚪 Into the terminal, and through to the street',
        run: (host) => host.enter('airport', entrance),
      },
      [stepsId]: {
        label: () => {
          const held = flights.booking;
          if (!held || held.route.from !== options.city) return '✈️ Boarding is for passengers with a ticket';
          if (held.state === 'booked' || held.state === 'checked-in') return '🎫 Check in and clear security in the terminal first';
          return atStand() ? `🛫 Board ${held.route.flight} to ${AIRPORTS[held.route.to].city}` : '⏳ Your aircraft is on its way to the stand';
        },
        run: (host) => {
          const held = flights.booking;
          if (!held || held.route.from !== options.city) {
            host.say('Boarding is for passengers with a ticket. The ticket desk is in the terminal.', 'info');
            return;
          }
          if (held.state !== 'cleared') {
            host.say('Check in at the desk and go through security first. Both are in the terminal.', 'info');
            return;
          }
          if (!atStand()) {
            host.say('Your aircraft is coming in. Boarding starts when it is on the stand.', 'info');
            return;
          }
          const actor = host.actor;
          if (host.director.interrupt(actor) === 'locked') return;
          const board = new Sequence('board the aircraft', [actor]).add(
            steps.walk(actor, stepsFoot, { speed: 4 }),
            steps.face(actor, cabinDoor),
            climb(actor, () => cabinDoor, DOOR.sill, 2.2),
            steps.call('through the door', () => {
              const result = flights.board(options.city);
              if (!result.ok) {
                host.say(result.reason ?? 'You cannot board.', 'warning');
                return false;
              }
            })
          );
          // Back on the ground, however it ends: whoever takes the passenger on from here places them
          board.onEnd(() => { actor.root.position.y = 0; });
          host.director.run(board);
        },
      },
    },
    doors: [{ name: `Way in to ${name}`, x: entrance.x, z: entrance.z }],
    update(delta) {
      let next = flight.clock + delta;
      if (flights.expectedAt(options.city)) {
        const within = ((flight.clock % FLIGHT_SECONDS) + FLIGHT_SECONDS) % FLIGHT_SECONDS;
        const base = flight.clock - within;
        // A flight waits on the stand for a passenger who has checked in, and one that is away comes straight back for them
        if (within < BOARDING_ENDS) next = Math.min(next, base + BOARDING_ENDS - 0.3);
        else if (within >= AWAY_FROM && within < APPROACH_FROM) next = base + APPROACH_FROM;
      }
      flight.clock = next;
      round = Math.floor(flight.clock / FLIGHT_SECONDS);
      pose = flightAt(flight.clock);
      working.visible = !pose.away;
      working.position.set(pose.x - DRAWN.x, pose.y, pose.z - DRAWN.z);
      working.rotation.set(0, (-pose.heading * Math.PI) / 180, pose.pitch);
      if (!pose.away && pose.state !== 'Boarding' && pose.state !== 'Arrived') for (const prop of plane.props) prop.rotation.x += delta * 28;
      radar.rotation.y += delta * 1.6;
      if (inThisCity()) kerbTalk.tick(delta);
      const route = showing();
      const back = ROUTES.find((other) => other.from === route.to && other.to === route.from);
      show([
        ['DEPARTURE', route.flight, AIRPORTS[route.to].city.toUpperCase(), DEPARTING[pose.state]],
        ['ARRIVAL', back?.flight ?? '', AIRPORTS[route.to].city.toUpperCase(), ARRIVING[pose.state]],
      ]);
    },
    status: () => {
      const turned = (pose.heading * Math.PI) / 180;
      // The box round the aircraft as it stands: half its length one way, half its span the other
      const halfX = Math.abs(Math.cos(turned)) * HALF_LENGTH + Math.abs(Math.sin(turned)) * HALF_SPAN;
      const halfZ = Math.abs(Math.sin(turned)) * HALF_LENGTH + Math.abs(Math.cos(turned)) * HALF_SPAN;
      const x = pose.x + move.x;
      const z = pose.z + move.z;
      return {
        airline: AIRLINE,
        state: pose.state,
        route: { flight: showing().flight, to: AIRPORTS[showing().to].city },
        atStand: atStand(),
        waiting: flights.expectedAt(options.city),
        x, y: pose.y, z,
        heading: pose.heading,
        visible: !pose.away,
        box: { minX: x - halfX, maxX: x + halfX, minZ: z - halfZ, maxZ: z + halfZ },
        seconds: FLIGHT_SECONDS,
        clock: flight.clock,
      };
    },
  };
  return landmark;
}
