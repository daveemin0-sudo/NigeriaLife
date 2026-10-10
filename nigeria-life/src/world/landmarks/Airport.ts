import * as THREE from 'three';
import { Builder, signBoard } from '../kit/ArchKit';
import { clickBox, figure, type Landmark } from './Landmark';

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

const WHITE = 0xf8fafc;
const LIVERY_GREEN = 0x0b7a43;
const LIVERY_GOLD = 0xf2b705;
const DARK = 0x1f2937;

export const AIRLINE = 'NigeriaLife Air';

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

/** An airliner in the airline's colours, nose toward +x, standing on its wheels. */
function airliner(): THREE.Group {
  const b = new Builder();
  const body = 2;
  b.tube(WHITE, 1.1, 1.1, 9.5, 0.25, body, 0).tube(WHITE, 1.1, 0.28, 2.4, 6.2, body, 0).tube(WHITE, 0.3, 1.1, 3.6, -6.3, body + 0.12, 0);
  b.box(DARK, 0.9, 0.34, 1.5, 5.75, body + 0.3, 0);
  // A green line down each side below the windows
  b.box(LIVERY_GREEN, 9.5, 0.28, 2.06, 0.25, body - 0.64, 0).box(LIVERY_GOLD, 9.5, 0.08, 2.1, 0.25, body - 0.36, 0);
  b.box(0x0c4a6e, 8.2, 0.2, 2.19, 0.6, body + 0.13, 0);
  // Wings, swept back, with green tips
  b.box(0xe5e7eb, 2.6, 0.22, 6.6, -0.6, 1.45, 3.6, { yaw: -0.32 }).box(0xe5e7eb, 2.6, 0.22, 6.6, -0.6, 1.45, -3.6, { yaw: 0.32 });
  b.box(LIVERY_GREEN, 0.9, 0.9, 0.12, -1.85, 1.5, 6.78).box(LIVERY_GREEN, 0.9, 0.9, 0.12, -1.85, 1.5, -6.78);
  for (const side of [-1, 1]) {
    b.tube(0xe5e7eb, 0.5, 0.56, 2, 0.5, 0.98, side * 2.9).tube(DARK, 0.44, 0.44, 0.08, 1.52, 0.98, side * 2.9);
    b.box(0xe5e7eb, 1.2, 0.36, 0.2, 0.2, 1.25, side * 2.9);
    b.box(0xe5e7eb, 1.5, 0.14, 2.7, -7, body + 0.5, side * 1.75, { yaw: side * -0.35 });
    b.box(0x9ca3af, 0.15, 1, 0.15, -0.8, 0.4, side * 1.6).box(DARK, 0.7, 0.62, 0.4, -0.8, 0, side * 1.6);
  }
  // The fin, in the airline's green with a gold sun on it
  b.box(LIVERY_GREEN, 2.3, 3.4, 0.22, -7.1, body + 0.9, 0, { roll: 0.4 });
  b.cylinder(LIVERY_GOLD, 0.62, 0.28, -7.55, body + 2.6 - 0.14, 0, { pitch: Math.PI / 2, sides: 20 });
  b.box(0x9ca3af, 0.15, 0.9, 0.15, 4.6, 0.3, 0).box(DARK, 0.5, 0.5, 0.34, 4.6, 0, 0);
  const plane = b.build('airliner');

  const name = signBoard([AIRLINE], 4.4, 0.62, '#f8fafc', '#0b7a43');
  name.position.set(1.6, body + 0.72, 0.95);
  name.rotation.x = -0.52;
  const otherSide = new THREE.Group();
  otherSide.rotation.y = Math.PI;
  const mirrored = name.clone();
  mirrored.position.set(-1.6, body + 0.72, 0.95);
  otherSide.add(mirrored);
  plane.add(name, otherSide);
  return plane;
}

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

const STAND = { x: -90, z: -127 };
const RUNWAY_Z = -146;

/** One whole flight, there and back, as the places the aircraft is moved to in turn. */
const FLIGHT: Leg[] = [
  { state: 'Boarding', seconds: 18, x: STAND.x, y: 0, z: STAND.z, heading: 180 },
  { state: 'Pushback', seconds: 8, x: -80, y: 0, z: STAND.z, heading: 180, ease: 'both' },
  { state: 'Pushback', seconds: 4, x: -79, y: 0, z: -128, heading: 270, ease: 'both' },
  { state: 'Taxiing', seconds: 7, x: -78, y: 0, z: -144.5, heading: 270, ease: 'both' },
  { state: 'Taxiing', seconds: 4, x: -80, y: 0, z: RUNWAY_Z, heading: 180, ease: 'both' },
  { state: 'Taking off', seconds: 9, x: -136, y: 0, z: RUNWAY_Z, heading: 180, ease: 'in' },
  { state: 'Taking off', seconds: 9, x: -330, y: 58, z: RUNWAY_Z, heading: 180, pitch: 0.24, ease: 'climb' },
  { state: 'In flight', seconds: 20, x: -340, y: 52, z: RUNWAY_Z, heading: 0, away: true },
  { state: 'Approaching', seconds: 9, x: -150, y: 0, z: RUNWAY_Z, heading: 0, pitch: 0.07, ease: 'descend' },
  { state: 'Landing', seconds: 10, x: -86, y: 0, z: RUNWAY_Z, heading: 0, ease: 'out' },
  { state: 'Taxiing to the stand', seconds: 4, x: -78, y: 0, z: -144, heading: 90, ease: 'both' },
  { state: 'Taxiing to the stand', seconds: 6, x: -78, y: 0, z: -129, heading: 90, ease: 'both' },
  { state: 'Taxiing to the stand', seconds: 4, x: -80, y: 0, z: STAND.z, heading: 180, ease: 'both' },
  { state: 'Taxiing to the stand', seconds: 4, x: STAND.x, y: 0, z: STAND.z, heading: 180, ease: 'out' },
  { state: 'Arrived', seconds: 12, x: STAND.x, y: 0, z: STAND.z, heading: 180 },
];
const FLIGHT_SECONDS = FLIGHT.reduce((total, leg) => total + leg.seconds, 0);

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
  name: string;
  code: string;
  /** Where the drawing's origin goes. Leave out to stand where it was drawn. */
  x?: number;
  z?: number;
  routes: Array<{ flight: string; back: string; to: string }>;
}

export interface AirportLandmark extends Landmark {
  /** The flight's clock, in seconds: set it to put the aircraft anywhere in its round */
  flight: { clock: number; readonly seconds: number };
}

export function createAirport(options: AirportOptions): AirportLandmark {
  const site = { x: options.x ?? DRAWN.x, z: options.z ?? DRAWN.z };
  const move = { x: site.x - DRAWN.x, z: site.z - DRAWN.z };
  const at = (x: number, z: number) => new THREE.Vector3(x + move.x, 0, z + move.z);
  const b = new Builder().around(DRAWN.x, DRAWN.z);

  // --- Ground -----------------------------------------------------------------------------
  b.ground(0x6b8f47, 89, 66, -113.5, 0.012, -123);
  b.ground(0xa3a3a3, 60, 27, -100, 0.02, -128.5);
  b.ground(0x27272a, 86, 8, -113, 0.026, RUNWAY_Z);
  b.ground(0xbdb5a8, 43, 5, -90.5, 0.02, -100.5);
  // The forecourt: a set-down road along the kerb and a row of parked cars beyond it
  b.ground(0x3f3f46, 41, 4, -90.5, 0.022, -96).ground(0x52525b, 41, 4, -90.5, 0.02, -92);
  for (let x = -110; x <= -71; x += 3) b.ground(WHITE, 0.12, 3.6, x, 0.03, -92);
  const CARS = [0xb91c1c, 0xf8fafc, 0x1e3a8a, 0x111827, 0xfacc15, 0x9ca3af, 0x14532d];
  [-108.5, -105.5, -99.5, -96.5, -90.5, -87.5, -74.5, -71.5].forEach((x, index) => {
    const hex = CARS[index % CARS.length];
    b.box(hex, 1.8, 0.75, 3.4, x, 0.3, -92.1, { solid: true }).box(0x1f2937, 1.6, 0.55, 1.8, x, 1.05, -92.3).box(0x111827, 1.9, 0.5, 0.6, x, 0, -93.2).box(0x111827, 1.9, 0.5, 0.6, x, 0, -91);
  });
  for (const x of [-86, -74]) {
    b.cylinder(0xe5e7eb, 0.07, 8, x, 0, -94.1, { solid: true });
    b.box(0x0b7a43, 0.6, 1, 0.04, x + 0.37, 6.9, -94.1).box(0xffffff, 0.6, 1, 0.04, x + 0.97, 6.9, -94.1).box(0x0b7a43, 0.6, 1, 0.04, x + 1.57, 6.9, -94.1);
  }
  for (let x = -150; x <= -76; x += 6) b.ground(WHITE, 3, 0.3, x, 0.036, RUNWAY_Z);
  for (const end of [-153.5, -72.5]) {
    for (let k = -3; k <= 3; k++) if (k !== 0) b.ground(WHITE, 3, 0.45, end, 0.036, RUNWAY_Z + k);
  }
  for (let x = -154; x <= -72; x += 8) {
    b.box(0xfef08a, 0.22, 0.2, 0.22, x, 0, RUNWAY_Z - 4.3, { glow: true }).box(0xfef08a, 0.22, 0.2, 0.22, x, 0, RUNWAY_Z + 4.3, { glow: true });
  }
  // Taxi lines, and where each aircraft stops
  const TAXI = 0xfacc15;
  b.ground(TAXI, 0.25, 15, -78, 0.036, -134.5).ground(TAXI, 42, 0.25, -99, 0.036, STAND.z);
  for (const x of [STAND.x, -112]) b.ground(TAXI, 0.25, 5, x - 7, 0.036, STAND.z);

  // --- The terminal -----------------------------------------------------------------------
  b.box(0xf1f5f9, 40, 8, 12, -90, 0, -109, { solid: true });
  b.box(0x0c4a6e, 36.4, 5.6, 0.1, -90, 1.2, -102.96).windows(0x7dd3fc, 14, 2, 36, 1.2, 5.6, -90, -102.9, 0);
  b.box(0x0c4a6e, 36.4, 5.6, 0.1, -90, 1.2, -115.04).windows(0x7dd3fc, 14, 2, 36, 1.2, 5.6, -90, -115.1, Math.PI);
  b.box(0xe2e8f0, 42, 0.4, 14.6, -90, 8, -109, { pitch: 0.04 }).box(LIVERY_GREEN, 42, 0.7, 0.3, -90, 7.5, -101.75);
  b.box(WHITE, 18, 2.2, 6, -90, 8.3, -109).windows(0xfef9c3, 8, 1, 17, 8.5, 1.8, -90, -105.96, 0, { glow: true });
  b.box(0xe2e8f0, 19, 0.3, 7, -90, 10.5, -109);
  // The way in, under a canopy at the kerb
  b.box(0x0f172a, 4.6, 3.3, 0.2, -80, 0, -102.92).box(0x93c5fd, 3.8, 2.9, 0.26, -80, 0, -102.92);
  b.box(WHITE, 26, 0.3, 4.8, -84, 4.3, -100.5).box(LIVERY_GREEN, 26, 0.45, 0.2, -84, 4.2, -98.2);
  for (const x of [-96.5, -90, -85, -75, -71.5]) b.cylinder(0x94a3b8, 0.18, 4.3, x, 0, -98.5, { solid: true });
  // Posts for the name on the roof
  for (const x of [-98, -82]) b.box(0x94a3b8, 0.2, 1.2, 0.2, x, 8.4, -102.6);
  b.box(0x0f172a, 20.3, 2.5, 0.14, -90, 9.5, -102.6);
  // Doors onto the apron
  for (const x of [-98, -84]) b.box(0x0f172a, 3, 2.8, 0.2, x, 0, -115.08);

  // --- The control tower ------------------------------------------------------------------
  const tower = { x: -120, z: -108 };
  b.box(0xe5e7eb, 7, 3.2, 6, tower.x, 0, tower.z, { solid: true }).windows(0x7dd3fc, 3, 1, 6, 0.8, 2, tower.x, tower.z + 3.02, 0);
  b.cylinder(0xf1f5f9, 1.8, 16.5, tower.x, 0, tower.z, { topRadius: 1.5 });
  b.cylinder(0xe2e8f0, 2.5, 0.4, tower.x, 16.1, tower.z, { sides: 10 });
  b.cylinder(0x0c4a6e, 2.4, 2.6, tower.x, 16.5, tower.z, { topRadius: 3, sides: 10 });
  b.cylinder(0x7dd3fc, 2.5, 1.5, tower.x, 17.2, tower.z, { topRadius: 2.85, sides: 10, glow: true });
  b.cylinder(0xe2e8f0, 3.25, 0.4, tower.x, 19.1, tower.z, { sides: 10 });
  b.cylinder(0x94a3b8, 0.08, 4, tower.x + 1.4, 19.5, tower.z).box(0xdc2626, 0.3, 0.3, 0.3, tower.x + 1.4, 23.5, tower.z, { glow: true });

  // --- The hangar -------------------------------------------------------------------------
  const hangar = { x: -144, z: -122 };
  b.box(0xcbd5e1, 16, 8, 14, hangar.x, 0, hangar.z, { solid: true });
  b.box(0x94a3b8, 16.6, 0.25, 7.5, hangar.x, 8.8, hangar.z - 3.55, { pitch: -0.25 }).box(0x94a3b8, 16.6, 0.25, 7.5, hangar.x, 8.8, hangar.z + 3.55, { pitch: 0.25 });
  b.box(0xcbd5e1, 0.3, 1, 9, hangar.x + 8, 8, hangar.z).box(0xcbd5e1, 0.3, 1, 9, hangar.x - 8, 8, hangar.z);
  b.box(0x334155, 0.14, 6.2, 11, hangar.x + 8.04, 0, hangar.z);

  // --- Ground equipment -------------------------------------------------------------------
  // Steps up to the forward door of the aircraft on the stand
  const stairs = { x: STAND.x - 4.5, top: STAND.z + 1.4 };
  for (let step = 0; step < 6; step++) {
    b.box(0xe5e7eb, 1.3, 1.5 - step * 0.25, 0.55, stairs.x, 0, stairs.top + 0.28 + step * 0.55);
  }
  b.box(0xfacc15, 1.5, 0.5, 1.6, stairs.x, 0, stairs.top + 3.9).box(0x94a3b8, 0.06, 1, 3.3, stairs.x - 0.65, 1.1, stairs.top + 1.65, { pitch: 0.42 });
  // A tug with a train of baggage carts
  b.box(0xf97316, 1.8, 1, 1.2, -79.5, 0.2, -117).box(DARK, 1.2, 0.6, 1.1, -79.8, 1.2, -117);
  for (let cart = 0; cart < 3; cart++) {
    const x = -82 - cart * 2.3;
    b.box(0x64748b, 1.9, 0.2, 1.2, x, 0.45, -117).box(cart === 1 ? 0x1d4ed8 : 0x7c2d12, 1.5, 0.7, 1, x, 0.65, -117).box(DARK, 1.6, 0.4, 1.3, x, 0, -117);
  }
  // A fuel bowser by the parked aircraft
  b.box(0xdc2626, 1.6, 1.8, 2, -104.8, 0.4, -120.5).tube(0xe5e7eb, 0.9, 0.9, 3, -107.3, 1.5, -120.5).box(DARK, 4.6, 0.5, 2, -106.4, 0, -120.5);
  for (const [x, z] of [[-128.5, -116.5], [-71, -116.5]]) {
    b.cylinder(0x94a3b8, 0.26, 15, x, 0, z, { topRadius: 0.16, solid: true }).box(0xfff7c2, 2.6, 0.5, 1.1, x, 15, z - 0.4, { glow: true });
  }
  // A windsock
  b.cylinder(0xe5e7eb, 0.07, 5, -131, 0, -134).tube(0xf97316, 0.42, 0.16, 1.9, -130, 4.9, -134);

  // --- The fence between the street and the airfield --------------------------------------
  const FENCE = 0x64748b;
  b.box(FENCE, 46, 2.4, 0.2, -135, 0, -90.4, { solid: true }).box(FENCE, 0.2, 2.4, 12.6, -112, 0, -96.7, { solid: true }).box(FENCE, 2, 2.4, 0.2, -111, 0, -103, { solid: true });
  b.box(FENCE, 0.2, 2.4, 40.5, -69.4, 0, -135.25, { solid: true }).box(FENCE, 89, 2.4, 0.2, -113.5, 0, -155.5, { solid: true });
  b.box(FENCE, 0.2, 2.4, 65.1, -157.9, 0, -122.95, { solid: true });

  const group = b.build(options.ids[0]);
  group.position.set(site.x, 0, site.z);
  const local = (x: number, y: number, z: number) => new THREE.Vector3(x - DRAWN.x, y, z - DRAWN.z);

  const nameSign = signBoard([options.name.toUpperCase(), `Domestic Terminal  ·  ${options.code}`], 20, 2.3, '#0f172a');
  nameSign.position.copy(local(-90, 10.75, -102.5));
  const gates = signBoard(['GATES 1 - 2'], 6, 0.8, '#0f172a', '#facc15');
  gates.position.copy(local(-91, 4.6, -115.14));
  gates.rotation.y = Math.PI;
  const hangarSign = signBoard([AIRLINE, 'Engineering'], 8, 1.5, '#f8fafc', '#0b7a43');
  hangarSign.position.copy(local(hangar.x + 8.14, 7.1, hangar.z));
  hangarSign.rotation.y = Math.PI / 2;
  const marshal = figure(0xfacc15, 0x1f2937, 0x5b3a1e, 0xf97316);
  marshal.position.copy(local(STAND.x - 10.5, 0, STAND.z + 2.6));
  marshal.rotation.y = Math.PI / 2;
  const porter = figure(0x1d4ed8, 0x1f2937, 0x6b4226);
  porter.position.copy(local(-77.6, 0, -99.6));
  group.add(nameSign, gates, hangarSign, marshal, porter);

  // The radar turns
  const radar = new Builder().box(0xf97316, 3.2, 0.5, 0.14, 0, 0.5, 0).box(0x94a3b8, 0.14, 0.5, 0.14, 0, 0, 0).build('radar');
  radar.position.copy(local(tower.x - 1, 19.5, tower.z));
  group.add(radar);

  // --- The aircraft -----------------------------------------------------------------------
  const parked = airliner();
  parked.position.copy(local(-112, 0, STAND.z));
  parked.rotation.y = Math.PI;
  const working = airliner();
  group.add(parked, working);

  // --- The departures board, on the front of the terminal ----------------------------------
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 320;
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const board = new THREE.Mesh(new THREE.PlaneGeometry(9, 2.8), new THREE.MeshBasicMaterial({ map: texture }));
  board.position.copy(local(-104, 4.2, -102.8));
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
    ctx.fillText(`${AIRLINE.toUpperCase()}  ·  ${options.code}`, 28, 48);
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

  const door = clickBox(30, 6, 6);
  door.position.copy(local(-84, 3, -101));
  group.add(door);
  const entrance = at(-80, -101.2);
  const description = `${AIRLINE} flies from here to ${options.routes.map((route) => route.to).join(' and ')}. Check in inside; the aircraft outside are the ones you board.`;

  const flight = { clock: 0, seconds: FLIGHT_SECONDS };
  let pose = flightAt(0);
  let round = 0;

  const landmark: AirportLandmark = {
    id: options.ids[0],
    name: options.name,
    flight,
    zone: { minX: -158 + move.x, maxX: -69 + move.x, minZ: -156 + move.z, maxZ: -90 + move.z },
    group,
    obstructions: b.obstructions(options.name, site.x, site.z),
    interactive: options.ids.map((id) => ({
      mesh: door,
      id,
      name: `${options.name} (${options.code})`,
      category: 'Airport',
      description,
      interactionPoint: entrance,
    })),
    actions: {},
    doors: [{ name: `Way in to ${options.name}`, x: entrance.x, z: entrance.z }],
    update(delta) {
      flight.clock += delta;
      round = Math.floor(flight.clock / FLIGHT_SECONDS);
      pose = flightAt(flight.clock);
      working.visible = !pose.away;
      working.position.set(pose.x - DRAWN.x, pose.y, pose.z - DRAWN.z);
      working.rotation.set(0, (-pose.heading * Math.PI) / 180, pose.pitch);
      radar.rotation.y += delta * 1.6;
      const route = options.routes[round % options.routes.length];
      show([
        ['DEPARTURE', route.flight, route.to.toUpperCase(), DEPARTING[pose.state]],
        ['ARRIVAL', route.back, route.to.toUpperCase(), ARRIVING[pose.state]],
      ]);
    },
    status: () => {
      const turned = (pose.heading * Math.PI) / 180;
      // The box round the aircraft as it stands: half its length one way, half its span the other
      const halfX = Math.abs(Math.cos(turned)) * 8.1 + Math.abs(Math.sin(turned)) * 6.9;
      const halfZ = Math.abs(Math.sin(turned)) * 8.1 + Math.abs(Math.cos(turned)) * 6.9;
      const x = pose.x + move.x;
      const z = pose.z + move.z;
      return {
        airline: AIRLINE,
        state: pose.state,
        route: options.routes[round % options.routes.length],
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
