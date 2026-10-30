import * as THREE from 'three';
import { Builder, signBoard } from '../kit/ArchKit';
import { HumanMeshBuilder, type HumanConfig } from '../../graphics/HumanMeshBuilder';
import { bakeToGeometry } from '../../graphics/MeshBaker';
import { neutralJoints, poseTargets, writeJoints, type PoseState } from '../../interactions/Poses';
import { Sequence, steps, type Step } from '../../interactions/Sequence';
import { PlaceActions, type PlaceHost } from '../../destinations/PlaceActions';
import type { Obstruction } from '../plan/CityPlan';
import type { InteractiveObject } from '../World';
import { EXPRESS } from './layout';

/**
 * The Red Line: a railway on a viaduct over the middle of Ikorodu Road, from Oyingbo at the
 * mainland end of the bridge up through Yaba, Mushin, Oshodi and Ikeja to Agege. Each station is
 * a pair of raised platforms either side of the tracks, a concourse across the road at its south
 * end, and stairs down to both pavements. Six trains of four cars go round one loop: north on the
 * east track, across at Agege, south on the west track, across at Oyingbo.
 *
 * The player taps their card at the gate at the foot of the stairs (the fare is taken then),
 * climbs, crosses to the platform for the way they are going, waits for the train, steps on,
 * rides standing in the second car (its roof comes off so they can be seen in it) to the station
 * they chose, steps off and goes down to the road there.
 */

export const STATIONS: Array<{ id: string; name: string; z: number }> = [
  { id: 'oyingbo', name: 'Oyingbo', z: 2990 },
  { id: 'yaba', name: 'Yaba', z: 3470 },
  { id: 'mushin', name: 'Mushin', z: 4200 },
  { id: 'oshodi', name: 'Oshodi', z: 5000 },
  { id: 'ikeja', name: 'Ikeja', z: 5800 },
  { id: 'agege', name: 'Agege', z: 6600 },
];
/** The top of the viaduct's deck, and the floor of the cars and the platforms, level with each other */
const DECK = 8.6;
const FLOOR = DECK + 0.95;
const TRACK = 2.1;
const PLATFORM = { inner: 3.7, outer: 7.0, half: 52 };
/**
 * The concourse crosses the road under the viaduct, south of the platforms, high enough for a
 * lorry under it: stairs come up to it from both pavements, and a flight goes on up from it to
 * each platform.
 */
const CONCOURSE = { at: -PLATFORM.half - 10, half: 2, y: 5.8 };
const STAIR = { x: EXPRESS.half + 2.6, steps: 24, run: 0.42, half: 1.1 };
const UP = { steps: 16, half: 1.1 };
const CAR = { length: 18, width: 2.9, gap: 0.6 };
const CARS = 4;
const TRAIN_LENGTH = CARS * CAR.length + (CARS - 1) * CAR.gap;
/** The middle of a car, from the front of the train; a door of it, and where the player stands in it */
const carMid = (c: number) => -(c * (CAR.length + CAR.gap) + CAR.length / 2);
const doorOf = (c: number) => carMid(c) + 5;
const standIn = (c: number) => carMid(c) + 2;
const RUN = { top: 22, accel: 1.1, dwell: 16 };
const TRAINS = 6;
const LINE_FROM = STATIONS[0].z - 160;
const LINE_TO = STATIONS[STATIONS.length - 1].z + 160;
const FARE_BASE = 500;
const FARE_PER_STOP = 250;
const DRAW = 900;
const PEOPLE = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.7 });

export const fareBetween = (a: number, b: number) => FARE_BASE + FARE_PER_STOP * Math.abs(a - b);
const stairFoot = (st: { z: number }, side: number) => new THREE.Vector3(side * STAIR.x, 0, st.z + CONCOURSE.at - CONCOURSE.half - STAIR.steps * STAIR.run);
const stairTop = (st: { z: number }, side: number) => new THREE.Vector3(side * STAIR.x, CONCOURSE.y, st.z + CONCOURSE.at - CONCOURSE.half + 0.3);
/** The foot and head of the flight up to each platform from the concourse */
const UP_X = 5.75;
const upFoot = (st: { z: number }, side: number) => new THREE.Vector3(side * UP_X, CONCOURSE.y, st.z + CONCOURSE.at + CONCOURSE.half - 0.3);
const upTop = (st: { z: number }, side: number) => new THREE.Vector3(side * UP_X, FLOOR, st.z - PLATFORM.half + 0.6);
/** Where the front of a train stands at a station on a heading */
const stopAt = (i: number, heading: 1 | -1) => STATIONS[i].z + heading * (PLATFORM.half - 4);

// --- The timetable: one loop round both tracks, the same for every train ----------------------

interface Leg {
  t0: number;
  seconds: number;
  /** The front of the train: z and the track's x at the start and the end */
  z0: number;
  z1: number;
  x0: number;
  x1: number;
  /** Standing at this station, or on the move */
  station?: number;
  heading: 1 | -1;
}

/** Time to run a distance from a stand to a stand, speeding up and slowing down */
const runTime = (d: number) => {
  const reach = (RUN.top * RUN.top) / RUN.accel;
  return d >= reach ? d / RUN.top + RUN.top / RUN.accel : 2 * Math.sqrt(d / RUN.accel);
};
/** How far along a run of length d it is, t seconds in */
const runAt = (d: number, t: number) => {
  const total = runTime(d);
  const reach = (RUN.top * RUN.top) / RUN.accel;
  const top = d >= reach ? RUN.top : Math.sqrt(d * RUN.accel);
  const ta = top / RUN.accel;
  const tt = Math.min(Math.max(t, 0), total);
  if (tt < ta) return 0.5 * RUN.accel * tt * tt;
  if (tt > total - ta) { const r = total - tt; return d - 0.5 * RUN.accel * r * r; }
  return 0.5 * RUN.accel * ta * ta + top * (tt - ta);
};

const LOOP: Leg[] = (() => {
  const legs: Leg[] = [];
  let t = 0;
  const dwell = (i: number, heading: 1 | -1, x: number) => {
    const z = stopAt(i, heading);
    legs.push({ t0: t, seconds: RUN.dwell, z0: z, z1: z, x0: x, x1: x, station: i, heading });
    t += RUN.dwell;
  };
  const run = (z0: number, z1: number, x0: number, x1: number, heading: 1 | -1) => {
    const seconds = Math.max(4, runTime(Math.abs(z1 - z0)));
    legs.push({ t0: t, seconds, z0, z1, x0, x1, heading });
    t += seconds;
  };
  const last = STATIONS.length - 1;
  for (let i = 0; i <= last; i++) {
    dwell(i, 1, TRACK);
    if (i < last) run(stopAt(i, 1), stopAt(i + 1, 1), TRACK, TRACK, 1);
  }
  // Across at Agege: on over the crossover to the end of the line, then into the west platform the other way
  run(stopAt(last, 1), LINE_TO, TRACK, -TRACK, 1);
  run(LINE_TO - TRAIN_LENGTH, stopAt(last, -1), -TRACK, -TRACK, -1);
  for (let i = last; i >= 0; i--) {
    dwell(i, -1, -TRACK);
    if (i > 0) run(stopAt(i, -1), stopAt(i - 1, -1), -TRACK, -TRACK, -1);
  }
  run(stopAt(0, -1), LINE_FROM, -TRACK, TRACK, -1);
  run(LINE_FROM + TRAIN_LENGTH, stopAt(0, 1), TRACK, TRACK, 1);
  return legs;
})();
export const LOOP_SECONDS = LOOP.reduce((s, l) => s + l.seconds, 0);

/** Where a train is, `t` seconds into the loop */
function trainAt(t: number): { z: number; x: number; heading: 1 | -1; station: number | null; into: number } {
  const tt = ((t % LOOP_SECONDS) + LOOP_SECONDS) % LOOP_SECONDS;
  let leg = LOOP[0];
  for (const l of LOOP) { if (tt >= l.t0) leg = l; else break; }
  const into = tt - leg.t0;
  if (leg.station !== undefined) return { z: leg.z0, x: leg.x0, heading: leg.heading, station: leg.station, into };
  const d = Math.abs(leg.z1 - leg.z0);
  const along = d > 0 ? runAt(d, into) / d : 1;
  // Over a crossover the train moves across from one track to the other in the middle of the run
  const across = Math.min(1, Math.max(0, (along - 0.3) / 0.4));
  return { z: leg.z0 + (leg.z1 - leg.z0) * along, x: leg.x0 + (leg.x1 - leg.x0) * across, heading: leg.heading, station: null, into };
}

function posed(look: HumanConfig, pose: PoseState, time = 0): THREE.BufferGeometry | null {
  const rig = HumanMeshBuilder.createHuman({ lod: 'street', ...look, username: '' });
  rig.nameTag.visible = false;
  if (rig.phoneMesh) rig.phoneMesh.visible = false;
  const holder = new THREE.Group();
  holder.add(rig.group);
  writeJoints(rig, poseTargets(pose, time, neutralJoints()), rig.torso.position.y);
  return bakeToGeometry(holder);
}

interface Train {
  group: THREE.Group;
  /** How far behind the first train it runs, in seconds of the loop */
  offset: number;
  roofs: THREE.Object3D[];
  doors: THREE.Object3D[];
}

export class RedLine {
  public readonly group = new THREE.Group();
  public readonly obstructions: Obstruction[] = [];
  public readonly interactive: InteractiveObject[] = [];
  private readonly segments: Array<{ group: THREE.Group; z: number }> = [];
  private readonly trains: Train[] = [];
  private clock = 0;
  private built = false;
  private ridden: Train | null = null;
  /** Others riding: one set, put into whichever car the player boards */
  private readonly riders: THREE.Mesh[] = [];
  public rides = 0;

  constructor() {
    this.group.name = 'Red Line';
    this.buildLine();
    STATIONS.forEach((st, i) => this.buildStation(i, st));
  }

  // --- The viaduct and the stations, drawn near the player -------------------------------------

  private segment(z: number): THREE.Group {
    const key = Math.floor(z / 300) * 300;
    let seg = this.segments.find((s) => s.z === key);
    if (!seg) {
      seg = { group: new THREE.Group(), z: key };
      seg.group.visible = false;
      seg.group.name = `Red Line ${key}`;
      this.segments.push(seg);
      this.group.add(seg.group);
    }
    return seg.group;
  }

  private solid(owner: string, minX: number, maxX: number, minZ: number, maxZ: number, height: number): void {
    this.obstructions.push({ owner, minX, maxX, minZ, maxZ, height, structure: false });
  }

  private buildLine(): void {
    for (let z0 = LINE_FROM; z0 < LINE_TO; z0 += 300) {
      const z1 = Math.min(LINE_TO, z0 + 300);
      const mid = (z0 + z1) / 2;
      const len = z1 - z0;
      const b = new Builder();
      // The deck with its parapets; ballast, sleepers and rails for both tracks
      b.box(0xbdbdbd, 9, 0.9, len, 0, DECK - 0.9, mid).box(0x9e9e9e, 0.25, 0.9, len, -4.4, DECK, mid).box(0x9e9e9e, 0.25, 0.9, len, 4.4, DECK, mid);
      for (const tx of [-TRACK, TRACK]) {
        b.box(0x57534e, 2.6, 0.12, len, tx, DECK, mid);
        for (const r of [-0.72, 0.72]) b.box(0x71717a, 0.08, 0.14, len, tx + r, DECK + 0.12, mid);
      }
      for (let z = z0; z < z1; z += 3) for (const tx of [-TRACK, TRACK]) b.box(0x44403c, 2.3, 0.08, 0.25, tx, DECK + 0.04, z);
      // Columns on the median every 30 m, each with a cap
      for (let z = Math.ceil(z0 / 30) * 30; z < z1; z += 30) {
        b.cylinder(0xa8a29e, 0.55, DECK - 1.3, 0, 0, z, { sides: 12 }).box(0xa8a29e, 3.4, 0.6, 1.6, 0, DECK - 1.5, z);
        this.solid('Red Line column', -0.6, 0.6, z - 0.6, z + 0.6, DECK);
      }
      for (let z = z0 + 15; z < z1; z += 60) for (const sx of [-4.4, 4.4]) b.box(0xfde68a, 0.2, 0.25, 0.4, sx, DECK + 0.9, z, { glow: true });
      this.segment(mid).add(b.build(`Red Line viaduct ${z0}`, { roughness: 0.8 }));
    }
  }

  private buildStation(index: number, st: { id: string; name: string; z: number }): void {
    const b = new Builder();
    const z = st.z;
    const cz = z + CONCOURSE.at;
    for (const side of [-1, 1]) {
      const cx = (side * (PLATFORM.inner + PLATFORM.outer)) / 2;
      const w = PLATFORM.outer - PLATFORM.inner;
      // The platform: a slab at the cars' floor, the yellow line, a canopy on posts, benches, a rail at the back
      b.box(0xd6d3d1, w, 1.1, PLATFORM.half * 2, cx, FLOOR - 1.1, z).box(0xfacc15, 0.25, 0.02, PLATFORM.half * 2, side * (PLATFORM.inner + 0.3), FLOOR, z);
      b.box(0xc8102e, w + 0.4, 0.2, PLATFORM.half * 2 - 6, cx, FLOOR + 3.9, z).box(0xe5e7eb, w + 0.6, 0.12, PLATFORM.half * 2 - 6, cx, FLOOR + 4.1, z);
      for (let dz = -PLATFORM.half + 8; dz < PLATFORM.half - 4; dz += 14) {
        b.cylinder(0x52525b, 0.12, 3.9, side * (PLATFORM.outer - 0.5), FLOOR, z + dz, { sides: 8 });
        b.box(0x7c2d12, 0.5, 0.45, 2.2, side * (PLATFORM.outer - 0.6), FLOOR, z + dz + 6);
      }
      b.box(0x9e9e9e, 0.2, 1.1, PLATFORM.half * 2, side * PLATFORM.outer, FLOOR, z);
      // Carried on beams out to piers at the road's edge, so the road beneath stays clear
      for (const dz of [-PLATFORM.half + 6, 0, PLATFORM.half - 6]) {
        b.box(0xa8a29e, EXPRESS.half + 1.1 - 4.4, 0.8, 1.0, side * (4.4 + (EXPRESS.half + 1.1 - 4.4) / 2), FLOOR - 1.9, z + dz);
        b.box(0xa8a29e, 0.8, FLOOR - 1.1, 0.8, side * (EXPRESS.half + 0.7), 0, z + dz);
        this.solid('Red Line station pier', side * (EXPRESS.half + 0.7) - 0.45, side * (EXPRESS.half + 0.7) + 0.45, z + dz - 0.45, z + dz + 0.45, FLOOR);
      }
    }
    // The concourse across the road under the viaduct, glass sides, and the stairs to both pavements
    const cw = (STAIR.x + STAIR.half + 0.3) * 2;
    b.box(0xe7e5e4, cw, 0.4, CONCOURSE.half * 2, 0, CONCOURSE.y - 0.4, cz).box(0xc8102e, cw, 0.3, 0.12, 0, CONCOURSE.y - 0.4, cz - CONCOURSE.half).box(0xc8102e, cw, 0.3, 0.12, 0, CONCOURSE.y - 0.4, cz + CONCOURSE.half);
    for (const e of [-1, 1]) b.box(0x93c5fd, cw, 1.1, 0.06, 0, CONCOURSE.y, cz + e * (CONCOURSE.half - 0.03));
    for (const side of [-1, 1]) {
      // A flight on up from the concourse to the platform, over the road's edge lanes
      const ux = side * UP_X;
      const from = cz + CONCOURSE.half;
      const to = z - PLATFORM.half;
      const urun = (to - from) / UP.steps;
      const urise = (FLOOR - CONCOURSE.y) / UP.steps;
      for (let k = 0; k < UP.steps; k++) b.box(0x94a3b8, UP.half * 2, 0.3, urun, ux, CONCOURSE.y + urise * (k + 1) - 0.3, from + (k + 0.5) * urun).box(0xe2e8f0, UP.half * 2, 0.03, urun, ux, CONCOURSE.y + urise * (k + 1), from + (k + 0.5) * urun);
    }
    for (const side of [-1, 1]) {
      const sx = side * STAIR.x;
      const rise = CONCOURSE.y / STAIR.steps;
      for (let s = 0; s < STAIR.steps; s++) {
        const zz = cz - CONCOURSE.half - (STAIR.steps - s - 0.5) * STAIR.run;
        b.box(0x94a3b8, STAIR.half * 2, rise * (s + 1), STAIR.run, sx, 0, zz).box(0xe2e8f0, STAIR.half * 2, 0.03, STAIR.run, sx, rise * (s + 1), zz);
      }
      const foot = stairFoot(st, side);
      this.solid('Red Line stairs', sx - STAIR.half - 0.1, sx + STAIR.half + 0.1, foot.z, cz + CONCOURSE.half, CONCOURSE.y);
      // The ticket gate at the foot: two posts and a reader
      b.box(0x1f2937, 0.3, 1.0, 0.3, sx - STAIR.half, 0, foot.z - 0.6).box(0x1f2937, 0.3, 1.0, 0.3, sx + STAIR.half, 0, foot.z - 0.6).box(0x16a34a, 0.25, 0.12, 0.25, sx - STAIR.half, 1.0, foot.z - 0.6, { glow: true });
    }
    this.segment(z).add(b.build(`${st.name} station`, { roughness: 0.75 }));
    for (const side of [-1, 1]) {
      const name = signBoard([`🚆 ${st.name.toUpperCase()}`, 'Red Line · Lagos Rail Mass Transit'], 6, 1.1, '#c8102e', '#ffffff');
      name.position.set(side * (PLATFORM.outer - 0.12), FLOOR + 2.8, z);
      name.rotation.y = (-side * Math.PI) / 2;
      this.segment(z).add(name);
      const foot = stairFoot(st, side);
      const over = signBoard([`🚆 RED LINE · ${st.name.toUpperCase()}`, 'Trains to Oyingbo and to Agege'], 3.6, 0.9, '#c8102e', '#ffffff');
      over.position.set(side * STAIR.x, 3.2, foot.z - 1.0);
      over.rotation.y = Math.PI;
      this.segment(z).add(over);
      // The gate the player goes to, on this pavement
      const id = `redline-${st.id}-${side < 0 ? 'w' : 'e'}`;
      const stand = new THREE.Vector3(foot.x, 0, foot.z - 1.6);
      const marker = new THREE.Mesh(new THREE.BoxGeometry(1.4, 1.6, 1.4), new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }));
      marker.position.set(stand.x, 0.8, stand.z + 0.9);
      this.segment(z).add(marker);
      this.interactive.push({ mesh: marker, id, name: `🚆 ${st.name} station`, category: 'Red Line', description: 'Trains to Oyingbo, Yaba, Mushin, Oshodi, Ikeja and Agege.', interactionPoint: stand });
      PlaceActions.register(id, { label: () => `🚆 Red Line · ${st.name}: take the train`, run: (host) => this.ask(host, index, side as -1 | 1) });
    }
  }

  // --- The trains -------------------------------------------------------------------------------

  private build(): void {
    if (this.built) return;
    this.built = true;
    const riders: HumanConfig[] = [
      { gender: 'female', username: '', outfit: 'blue_dress', outfitColor: 0x7c3aed, hairstyle: 'gele' },
      { gender: 'male', username: '', outfit: 'senator', outfitColor: 0xf8fafc, trousersColor: 0xf8fafc, hairstyle: 'fila' },
      { gender: 'male', username: '', outfit: 'lecturer_suit', outfitColor: 0x1e3a8a, trousersColor: 0x1f2937, hasTie: true, hairstyle: 'short_crop' },
    ];
    const seat = 0.85 - 0.17 + 0.1;
    const placed: Array<[THREE.BufferGeometry | null, number, number, number, number]> = [
      [posed(riders[0], { legs: 'sit', arms: 'rest' }), -0.95, -7.5, Math.PI / 2, seat],
      [posed(riders[1], { legs: 'sit', arms: 'rest' }), 0.95, 1.5, -Math.PI / 2, seat],
      [posed(riders[2], { legs: 'stand', arms: 'reach' }), 0.3, -3.4, Math.PI, 0.85],
      [posed(riders[0], { legs: 'stand', arms: 'reach' }), -0.3, 3.4, 0, 0.85],
    ];
    for (const [geo, x, dz, yaw, y] of placed) {
      if (!geo) continue;
      const m = new THREE.Mesh(geo, PEOPLE);
      m.position.set(x, y, dz);
      m.rotation.y = yaw;
      m.userData.at = { x, y, dz };
      m.visible = false;
      m.name = 'Red Line rider';
      this.riders.push(m);
    }
    const doorMat = new THREE.MeshStandardMaterial({ color: 0xe5e7eb, roughness: 0.4, metalness: 0.4 });
    for (let k = 0; k < TRAINS; k++) {
      const group = new THREE.Group();
      group.name = `Red Line train ${k + 1}`;
      const roofs: THREE.Object3D[] = [];
      const doors: THREE.Object3D[] = [];
      for (let c = 0; c < CARS; c++) {
        const b = new Builder();
        // The front of the train is the group's origin; cars run back from it (-z)
        const cz = -(c * (CAR.length + CAR.gap) + CAR.length / 2);
        b.box(0x3f3f46, CAR.width, 0.3, CAR.length, 0, 0.55, cz);
        for (const side of [-1, 1]) {
          const wx = side * (CAR.width / 2 - 0.05);
          b.box(0xc8102e, 0.1, 1.0, CAR.length, wx, 0.85, cz).box(0xf8fafc, 0.11, 0.18, CAR.length, wx, 1.85, cz).box(0x0f172a, 0.11, 1.0, CAR.length - 1, wx, 2.03, cz).box(0xc8102e, 0.1, 0.35, CAR.length, wx, 3.03, cz);
          for (const dz of [-5, 5]) {
            const door = new THREE.Mesh(new THREE.BoxGeometry(0.12, 2.3, 1.4), doorMat);
            door.position.set(wx * 1.01, 2.0, cz + dz);
            door.name = 'train door';
            group.add(door);
            doors.push(door);
          }
        }
        for (const side of [-1, 1]) for (const dz of [-7.5, -1.5, 1.5, 7.5]) b.box(0x1e3a8a, 0.55, 0.5, 2.4, side * (CAR.width / 2 - 0.4), 0.85, cz + dz);
        for (const dz of [-3, 0, 3]) b.cylinder(0xd4d4d8, 0.04, 2.5, 0, 0.85, cz + dz, { sides: 6 });
        if (c === 0) b.box(0xc8102e, CAR.width, 2.6, 0.6, 0, 0.85, cz + CAR.length / 2 + 0.3).box(0x0f172a, CAR.width - 0.4, 1.0, 0.1, 0, 2.0, cz + CAR.length / 2 + 0.62).box(0xfde68a, 0.4, 0.2, 0.1, -0.9, 1.2, cz + CAR.length / 2 + 0.62, { glow: true }).box(0xfde68a, 0.4, 0.2, 0.1, 0.9, 1.2, cz + CAR.length / 2 + 0.62, { glow: true });
        if (c === CARS - 1) b.box(0xc8102e, CAR.width, 2.6, 0.6, 0, 0.85, cz - CAR.length / 2 - 0.3).box(0xdc2626, 0.4, 0.2, 0.1, -0.9, 1.2, cz - CAR.length / 2 - 0.62, { glow: true }).box(0xdc2626, 0.4, 0.2, 0.1, 0.9, 1.2, cz - CAR.length / 2 - 0.62, { glow: true });
        for (const dz of [-6, 6]) b.box(0x1c1917, 2.2, 0.5, 2.6, 0, 0.05, cz + dz);
        group.add(b.build(`car ${c + 1}`, { roughness: 0.5 }));
        const r = new Builder();
        r.box(0xe5e7eb, CAR.width, 0.25, CAR.length, 0, 3.38, cz).box(0x9ca3af, 1.2, 0.35, 2.4, 0, 3.6, cz);
        const carRoof = r.build(`car ${c + 1} roof`);
        group.add(carRoof);
        roofs.push(carRoof);
        if (c === 0 || c === CARS - 1) for (const side of [-1, 1]) {
          const name = signBoard(['RED LINE', 'LAGOS'], 3.2, 0.6, '#c8102e', '#ffffff');
          name.position.set(side * (CAR.width / 2 + 0.02), 2.95, cz);
          name.rotation.y = (side * Math.PI) / 2;
          group.add(name);
        }
      }
      this.group.add(group);
      this.trains.push({ group, offset: (k * LOOP_SECONDS) / TRAINS, roofs, doors });
    }
  }

  /** Each frame: the stretch of line near the player drawn, the trains moved by the timetable */
  public update(delta: number, player: THREE.Vector3, outside: boolean): void {
    this.clock += delta;
    const z = player.z;
    for (const seg of this.segments) seg.group.visible = outside && Math.abs(seg.z + 150 - z) < DRAW;
    const near = (outside && z > LINE_FROM - DRAW && z < LINE_TO + DRAW && Math.abs(player.x) < 500) || !!this.ridden;
    if (!near) {
      for (const t of this.trains) t.group.visible = false;
      return;
    }
    this.build();
    for (const t of this.trains) {
      const at = trainAt(this.clock + t.offset);
      // The group's origin is the floor line under the front of the train
      t.group.position.set(at.x, FLOOR - 0.85, at.z);
      t.group.rotation.y = at.heading > 0 ? 0 : Math.PI;
      t.group.visible = Math.abs(at.z - z) < DRAW + TRAIN_LENGTH;
      // The doors open a moment after it stops, and close a little before it goes
      const open = at.station !== null && at.into > 1.5 && at.into < RUN.dwell - 2.5;
      for (const d of t.doors) d.visible = !open;
    }
  }

  /** The car whose door stops nearest the head of the platform's stairs: the one a passenger boards */
  private carFor(station: number, heading: 1 | -1): number {
    const head = STATIONS[station].z - PLATFORM.half;
    let best = 0;
    for (let c = 1; c < CARS; c++) if (Math.abs(stopAt(station, heading) + heading * doorOf(c) - head) < Math.abs(stopAt(station, heading) + heading * doorOf(best) - head)) best = c;
    return best;
  }

  /** Into a car of a train with the player: its roof off, others in it */
  private boardCar(t: Train, c: number): void {
    t.roofs[c].visible = false;
    for (const m of this.riders) {
      const at = m.userData.at as { x: number; y: number; dz: number };
      t.group.add(m);
      m.position.set(at.x, at.y, carMid(c) + at.dz);
      m.visible = true;
    }
  }

  private leaveCar(t: Train | null): void {
    if (!t) return;
    for (const r of t.roofs) r.visible = true;
    for (const m of this.riders) { m.visible = false; this.group.add(m); }
  }

  /** A train standing at a station on a heading with its doors open, if there is one */
  private standing(station: number, heading: 1 | -1): Train | null {
    for (const t of this.trains) {
      const at = trainAt(this.clock + t.offset);
      if (at.station === station && at.heading === heading && at.into > 1.5 && at.into < RUN.dwell - 4) return t;
    }
    return null;
  }

  /** How long until the next train on a heading opens its doors at a station, in seconds */
  public nextAt(station: number, heading: 1 | -1): number {
    const leg = LOOP.find((l) => l.station === station && l.heading === heading)!;
    let best = Infinity;
    for (const t of this.trains) {
      const now = (((this.clock + t.offset) % LOOP_SECONDS) + LOOP_SECONDS) % LOOP_SECONDS;
      let wait = leg.t0 + 1.5 - now;
      if (wait < -(RUN.dwell - 5)) wait += LOOP_SECONDS;
      best = Math.min(best, Math.max(0, wait));
    }
    return best;
  }

  // --- A ride -----------------------------------------------------------------------------------

  private ask(host: PlaceHost, from: number, side: -1 | 1): void {
    host.ask({
      who: `${STATIONS[from].name} station`, role: 'Red Line · Lagos Rail Mass Transit',
      text: 'Where are you going? Tap your card at the gate.',
      choices: [
        ...STATIONS.map((st, i) => ({ st, i })).filter(({ i }) => i !== from).map(({ st, i }) => ({
          label: `To ${st.name}`,
          note: `₦${fareBetween(from, i).toLocaleString()} · ${Math.abs(i - from)} stop${Math.abs(i - from) === 1 ? '' : 's'}`,
          pick: () => this.ride(host, from, i, side),
        })),
        { label: 'Not now', pick: () => undefined },
      ],
    });
  }

  /** The player moved in a straight line from one point to another, up or down too, at a pace */
  private move(actor: PlaceHost['actor'], a: () => THREE.Vector3, b: () => THREE.Vector3, speed: number, name: string): Step {
    let t = 0;
    let from = new THREE.Vector3();
    let to = new THREE.Vector3();
    let seconds = 1;
    return {
      name,
      begin: () => {
        t = 0;
        from = a();
        to = b();
        seconds = Math.max(0.25, from.distanceTo(to) / speed);
        actor.pose = { legs: 'walk', arms: 'swing' };
      },
      tick: (delta) => {
        t = Math.min(1, t + delta / seconds);
        actor.setWorldPosition(from.x + (to.x - from.x) * t, from.z + (to.z - from.z) * t);
        actor.root.position.y = from.y + (to.y - from.y) * t;
        if (Math.hypot(to.x - from.x, to.z - from.z) > 0.05) actor.turnToward(Math.atan2(to.x - from.x, to.z - from.z), delta);
        if (t >= 1) actor.pose = { legs: 'stand', arms: 'rest' };
        return t >= 1;
      },
    };
  }

  private ride(host: PlaceHost, from: number, to: number, side: -1 | 1): void {
    if (host.director.interrupt(host.actor) === 'locked') return;
    this.build();
    const actor = host.actor;
    const heading: 1 | -1 = to > from ? 1 : -1;
    /** The east platform serves trains going north, the west going south */
    const platform = heading > 0 ? 1 : -1;
    const st = STATIONS[from];
    const end = STATIONS[to];
    const fare = fareBetween(from, to);
    const terminus = STATIONS[heading > 0 ? STATIONS.length - 1 : 0].name;
    const v = (x: number, y: number, z: number) => () => new THREE.Vector3(x, y, z);
    const edge = platform * (PLATFORM.inner + 0.9);
    const car = this.carFor(from, heading);
    // Where the door of the player's car stops, at each end (the same car all the way)
    const doorAt = (i: number) => stopAt(i, heading) + heading * doorOf(car);
    const foot = stairFoot(st, side);
    const top = stairTop(st, side);
    const aTop = stairTop(end, platform);
    const aFoot = stairFoot(end, platform);
    const up0 = upFoot(st, platform);
    const up1 = upTop(st, platform);
    const down1 = upTop(end, platform);
    const down0 = upFoot(end, platform);
    let train: Train | null = null;
    let waited = 0;
    let riding = 0;
    const carried = new THREE.Vector3();

    const wait: Step = {
      name: 'waiting for the train',
      begin: () => {
        waited = 0;
        const next = this.nextAt(from, heading);
        host.say(`🚆 Platform for ${terminus}. The next train ${next < 45 ? 'is coming in now' : `is ${Math.ceil(next / 60)} min away`}. Stand behind the yellow line.`, 'info');
      },
      tick: (delta) => {
        waited += delta;
        actor.yaw = platform > 0 ? -Math.PI / 2 : Math.PI / 2;
        train = this.standing(from, heading);
        if (train) return true;
        return waited > 420 ? 'fail' : false;
      },
    };
    const board: Step = {
      name: 'onto the train',
      tick: () => {
        if (!train) return 'fail';
        this.ridden = train;
        this.boardCar(train, car);
        return true;
      },
    };
    const ride: Step = {
      name: 'riding the Red Line',
      begin: () => { riding = 0; actor.pose = { legs: 'stand', arms: 'reach' }; },
      tick: (delta) => {
        riding += delta;
        const t = this.ridden;
        if (!t) return 'fail';
        // Standing in the second car holding the pole, carried with it
        t.group.updateMatrixWorld();
        carried.set(0.35, 0.85, standIn(car)).applyMatrix4(t.group.matrixWorld);
        actor.setWorldPosition(carried.x, carried.z);
        actor.root.position.y = FLOOR;
        actor.yaw = t.group.rotation.y + Math.PI / 2;
        const at = trainAt(this.clock + t.offset);
        if (at.station === to && riding > 5) return at.into > 1.6;
        return riding > 480 ? 'fail' : false;
      },
    };
    const off: Step = {
      name: 'off the train',
      tick: () => {
        this.leaveCar(this.ridden);
        this.ridden = null;
        // Off by the door they got on by
        actor.setWorldPosition(edge, doorAt(to));
        actor.root.position.y = FLOOR;
        actor.pose = { legs: 'stand', arms: 'rest' };
        return true;
      },
    };

    const show = new Sequence('ride the Red Line', [actor]);
    show.maxSeconds = 900;
    show.add(
      steps.walk(actor, new THREE.Vector3(foot.x, 0, foot.z - 1.6), { speed: 2.8 }),
      steps.face(actor, new THREE.Vector3(foot.x, 0, foot.z + 2)),
      // The card on the gate's reader: the fare goes as it beeps
      steps.animate(actor, { arms: 'reach' }, 0.9, [{
        at: 0.6, run: () => {
          if (!host.backend.pay(fare, `Red Line: ${st.name} to ${end.name}`, 'TRAVEL_COST')) {
            host.say(`The fare to ${end.name} is ₦${fare.toLocaleString()}. Top up your card.`, 'warning');
            return false;
          }
          host.say(`🚆 Beep. ₦${fare.toLocaleString()}, ${st.name} to ${end.name}. Up the stairs.`, 'success');
          return true;
        },
      }]),
      this.move(actor, v(foot.x, 0, foot.z - 0.6), v(foot.x, 0, foot.z), 1.6, 'through the gate'),
      this.move(actor, () => foot.clone(), () => top.clone(), 1.5, 'up the station stairs'),
      this.move(actor, () => top.clone(), () => up0.clone(), 2.4, 'across the concourse'),
      this.move(actor, () => up0.clone(), () => up1.clone(), 1.4, 'up to the platform'),
      this.move(actor, () => up1.clone(), v(edge, FLOOR, doorAt(from)), 2.6, 'along the platform'),
      wait,
      steps.call('mind the gap', () => host.say(`🚆 This train is for ${terminus}. Mind the gap.`, 'info')),
      this.move(actor, v(edge, FLOOR, doorAt(from)), v(platform * TRACK * 0.5, FLOOR, doorAt(from)), 1.6, 'through the doors'),
      board,
      ride,
      off,
      steps.call('arrived', () => {
        host.say(`🚆 ${end.name}. Thank you for riding the Red Line.`, 'success');
        host.backend.modifyNeed('fun', 6);
        this.rides += 1;
      }),
      this.move(actor, v(edge, FLOOR, doorAt(to)), () => down1.clone(), 2.6, 'along the platform to the way out'),
      this.move(actor, () => down1.clone(), () => down0.clone(), 1.4, 'down to the concourse'),
      this.move(actor, () => down0.clone(), () => aTop.clone(), 2.4, 'across to the stairs'),
      this.move(actor, () => aTop.clone(), () => aFoot.clone(), 1.6, 'down to the road'),
      this.move(actor, () => aFoot.clone(), v(aFoot.x, 0, aFoot.z - 1.6), 1.6, 'out of the gate'),
    );
    show.onEnd((reason) => {
      this.leaveCar(this.ridden);
      this.ridden = null;
      if (reason !== 'done') {
        // Cut short anywhere on the line: put down on the pavement by the nearest station's stairs, not left in the air
        const here = actor.worldPosition(new THREE.Vector3());
        if (here.y > 0.5 || actor.root.position.y > 0.5) {
          const near = STATIONS.reduce((a, s) => (Math.abs(s.z - here.z) < Math.abs(a.z - here.z) ? s : a), STATIONS[0]);
          const f = stairFoot(near, here.x < 0 ? -1 : 1);
          actor.root.position.y = 0;
          actor.setWorldPosition(f.x, f.z - 1.6);
        }
      }
      actor.root.position.y = 0;
    });
    host.director.run(show);
  }

  /** For the tests */
  public state(): Record<string, unknown> {
    return {
      built: this.built, trains: this.trains.length, loop: Math.round(LOOP_SECONDS), rides: this.rides, riding: !!this.ridden,
      positions: this.trains.map((t) => [+t.group.position.x.toFixed(1), +t.group.position.z.toFixed(1), t.group.visible]),
      stations: STATIONS.map((s) => s.name),
    };
  }

  /** Moves the trains' clock on (for the tests) */
  public skip(seconds: number): void {
    this.clock += seconds;
  }
}
