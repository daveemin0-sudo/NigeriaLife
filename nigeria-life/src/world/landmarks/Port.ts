import * as THREE from 'three';
import { Builder, signBoard } from '../kit/ArchKit';
import { clickBox, figure, Route, type Landmark, type LandmarkHost } from './Landmark';
import { RENDER_LAYERS } from '../../interiors/InteriorTypes';
import { Employment } from '../../jobs/Employment';
import { createHandWork } from '../../jobs/HandWork';

/**
 * A container port: a quay with a cargo ship alongside, gantry cranes that lift boxes off
 * it, a yard of stacked containers with a tractor going round, a shed, an office and a gate.
 * By the gate is a loading bay where a lorry waits to be loaded by hand. That is a job: the
 * foreman takes hands on, and each lorry loaded is paid at the rate of the grade reached.
 *
 * Everything is measured from the middle of the site. The water is to the west and the
 * gate is in the east fence.
 */

const HALF_X = 42.5;
const HALF_Z = 36;
/** Where the land stops and the water starts */
const QUAY_X = -16.5;
/** The gate in the east fence */
const GATE_FROM = -33;
const GATE_TO = -23;
const GATE_Z = (GATE_FROM + GATE_TO) / 2;
/** The lane the lorry stands in to be loaded, and the one it comes in by */
const BAY_Z = -22;
const INBOUND_Z = -30;
const BAY_X = 23;

const CRATES = 3;

const BOX_COLOURS = [0x1d4ed8, 0xb91c1c, 0x15803d, 0xea580c, 0x64748b, 0xe5e7eb, 0xca8a04, 0x0e7490];
const BOX_W = 2.44;
const BOX_H = 2.6;
const BOX_L = 6.1;

function seeded(start: number): () => number {
  let seed = start;
  return () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };
}

/** The ship, built round its own middle with its bow to the south. */
function cargoShip(name: string): THREE.Group {
  const random = seeded(911);
  const b = new Builder();
  const NAVY = 0x1e293b;
  const RED = 0x991b1b;
  b.box(RED, 10, 1, 40, 0, 0, 0).box(NAVY, 10, 4, 40, 0, 1, 0);
  b.box(RED, 7.07, 1, 7.07, 0, 0, 20, { yaw: Math.PI / 4 }).box(NAVY, 7.07, 4, 7.07, 0, 1, 20, { yaw: Math.PI / 4 });
  b.box(0x57534e, 9.6, 0.2, 40, 0, 5, 0).box(0xf8fafc, 10.1, 0.25, 40.1, 0, 4.2, 0);
  // The accommodation block and bridge at the stern
  b.box(0xf8fafc, 8.6, 7.4, 6, 0, 5.2, -16).box(0xf8fafc, 10.6, 1.7, 2.6, 0, 11.1, -14.6);
  b.box(0x93c5fd, 8.2, 0.7, 0.1, 0, 11.7, -13.28, { glow: true });
  b.windows(0x38bdf8, 5, 3, 8, 5.6, 5.4, 0, -12.97, 0);
  b.box(0x0b7a43, 2.6, 3.6, 2.8, 0, 12.6, -17.4).box(0xf2b705, 2.7, 0.7, 2.9, 0, 14.4, -17.4);
  b.cylinder(0xe5e7eb, 0.1, 4.5, 0, 12.8, -14.2).box(0xe5e7eb, 2.4, 0.1, 0.1, 0, 16, -14.2);
  // Boxes on deck. The stacks nearest the cranes are part unloaded.
  for (let row = 0; row < 4; row++) {
    for (let column = 0; column < 3; column++) {
      const high = row === 1 ? Math.floor(random() * 2) : 1 + Math.floor(random() * 3);
      for (let level = 0; level < high; level++) {
        b.box(BOX_COLOURS[Math.floor(random() * BOX_COLOURS.length)], BOX_W, BOX_H, BOX_L, (column - 1) * 2.7, 5.2 + level * BOX_H, -8.6 + row * 6.5);
      }
    }
  }
  const ship = b.build('cargo ship');
  const plate = signBoard([name], 8, 0.9, '#1e293b', '#f8fafc');
  plate.position.set(5.04, 3.9, 12);
  plate.rotation.y = Math.PI / 2;
  ship.add(plate);
  return ship;
}

/** A flat-bed lorry, built round the middle of its length with its cab toward +x. */
function flatbed(): THREE.Group {
  return new Builder()
    .box(0x374151, 7.2, 0.3, 2.3, -0.3, 0.75, 0)
    .box(0x78716c, 5.4, 0.12, 2.4, -1.3, 1.05, 0)
    .box(0x0b7a43, 1.9, 2.1, 2.3, 2.45, 0.75, 0)
    .box(0x93c5fd, 0.1, 0.8, 1.9, 3.42, 1.8, 0)
    .box(0x111827, 0.9, 0.9, 2.5, 2.3, 0, 0)
    .box(0x111827, 0.9, 0.9, 2.5, -2.4, 0, 0)
    .box(0x111827, 0.9, 0.9, 2.5, -3.4, 0, 0)
    .build('flatbed lorry');
}

/** The yard tractor with a box on its trailer. */
function yardTractor(): THREE.Group {
  return new Builder()
    .box(0xfacc15, 1.8, 1.9, 2.2, 3.6, 0.6, 0)
    .box(0x1f2937, 0.1, 0.7, 1.8, 4.52, 1.6, 0)
    .box(0x374151, 8.4, 0.3, 2.2, -0.4, 0.7, 0)
    .box(0xea580c, BOX_L, BOX_H, BOX_W, -1, 1, 0)
    .box(0x111827, 0.9, 0.9, 2.4, 3.4, 0, 0)
    .box(0x111827, 0.9, 0.9, 2.4, -3, 0, 0)
    .box(0x111827, 0.9, 0.9, 2.4, -4, 0, 0)
    .build('yard tractor');
}

export interface PortOptions {
  id: string;
  name: string;
  /** The middle of the site */
  x: number;
  z: number;
  ship: string;
}

export function createPort(options: PortOptions): Landmark {
  const site = { x: options.x, z: options.z };
  const at = (x: number, z: number) => new THREE.Vector3(site.x + x, 0, site.z + z);
  const random = seeded(2718);
  const b = new Builder();

  // --- Ground: water, the quay and the yard -------------------------------------------------
  const landWidth = HALF_X - QUAY_X;
  b.ground(0x1b5873, QUAY_X + HALF_X, HALF_Z * 2, (QUAY_X - HALF_X) / 2, 0.05, 0);
  b.ground(0x8f8f8b, landWidth, HALF_Z * 2, QUAY_X + landWidth / 2, 0.02, 0);
  b.box(0xa8a29e, 1.4, 0.5, HALF_Z * 2, QUAY_X + 0.7, 0, 0);
  b.ground(0xfacc15, 0.3, HALF_Z * 2, QUAY_X + 2, 0.03, 0);
  for (let z = -HALF_Z + 4; z < HALF_Z; z += 8) b.cylinder(0x1f2937, 0.3, 0.7, QUAY_X + 0.7, 0.5, z, { topRadius: 0.4 });
  for (const x of [-13.5, -5.5]) b.ground(0x44403c, 0.3, 62, x, 0.03, 4);
  // The road in from the gate, and the ground the lorries turn on
  b.ground(0x3f3f46, HALF_X - 5, 15, (HALF_X + 5) / 2, 0.03, -25.5);
  for (let x = 8; x < HALF_X - 2; x += 5) b.ground(0xf8fafc, 2.4, 0.16, x, 0.04, -26);
  b.ground(0xfacc15, 9, 0.2, BAY_X - 0.6, 0.04, BAY_Z + 1.6).ground(0xfacc15, 9, 0.2, BAY_X - 0.6, 0.04, BAY_Z - 1.6);

  // --- The two gantry cranes ----------------------------------------------------------------
  const CRANE = 0x1d4ed8;
  const BOOM_Y = 21;
  const craneAt = [2, 22];
  for (const zc of craneAt) {
    for (const x of [-13.5, -5.5]) {
      for (const dz of [-5, 5]) b.box(CRANE, 0.9, 20, 0.9, x, 0, zc + dz, { solid: true });
      b.box(CRANE, 0.7, 0.7, 10.9, x, 4.6, zc).box(CRANE, 0.7, 0.7, 10.9, x, 13, zc);
    }
    for (const dz of [-5, 5]) b.box(CRANE, 8.9, 1, 0.9, -9.5, 19.5, zc + dz);
    // The girder out over the ship, and its back end over the yard
    b.box(0xfacc15, 40, 1.3, 1.5, -16, BOOM_Y - 0.6, zc).box(0xfacc15, 40, 0.2, 2.6, -16, BOOM_Y - 0.9, zc);
    b.box(0xe5e7eb, 6, 3, 4.4, -3, BOOM_Y + 0.7, zc).windows(0x38bdf8, 3, 1, 5, BOOM_Y + 1.4, 1.8, -3, zc + 2.22, 0);
    b.box(CRANE, 0.6, 9, 0.6, -9.5, BOOM_Y + 0.7, zc);
    b.box(CRANE, 25.8, 0.16, 0.16, -21.75, BOOM_Y + 5.1, zc, { roll: 0.316 }).box(CRANE, 15.5, 0.16, 0.16, -3.2, BOOM_Y + 5.1, zc, { roll: -0.62 });
    b.box(0xdc2626, 0.3, 0.3, 0.3, -9.5, BOOM_Y + 9.7, zc, { glow: true });
  }
  // The second crane is at rest, its trolley parked over the quay
  b.box(0x374151, 2.4, 0.8, 2.2, -9.5, BOOM_Y - 1.9, craneAt[1]).box(0x111827, 0.1, 5, 0.1, -9.5, BOOM_Y - 6.9, craneAt[1]).box(0xfacc15, 2.6, 0.3, 6.3, -9.5, BOOM_Y - 7.2, craneAt[1]);

  // --- The container yard -------------------------------------------------------------------
  for (const blockX of [2, 11, 20]) {
    for (let row = 0; row < 6; row++) {
      for (const dx of [-1.3, 1.3]) {
        const high = random() < 0.12 ? 0 : 1 + Math.floor(random() * 4);
        const z = -12 + 3.05 + row * 6.35;
        for (let level = 0; level < high; level++) {
          b.box(BOX_COLOURS[Math.floor(random() * BOX_COLOURS.length)], BOX_W, BOX_H, BOX_L, blockX + dx, level * BOX_H, z);
        }
      }
    }
    b.occupy(blockX - 2.55, blockX + 2.55, -12, 26.1, BOX_H * 2);
  }

  // --- The shed and the office --------------------------------------------------------------
  const shed = { x: 31.5, z: 26 };
  b.box(0xd4d4d8, 16, 6, 12, shed.x, 0, shed.z, { solid: true });
  b.box(0x64748b, 16.8, 0.25, 6.9, shed.x, 6.85, shed.z - 3.1, { pitch: -0.3 }).box(0x64748b, 16.8, 0.25, 6.9, shed.x, 6.85, shed.z + 3.1, { pitch: 0.3 });
  for (const end of [-8, 8]) b.box(0xd4d4d8, 0.3, 0.95, 8, shed.x + end, 6, shed.z).box(0xd4d4d8, 0.3, 0.8, 4, shed.x + end, 6.95, shed.z);
  for (const dz of [-4, 0, 4]) b.box(0x334155, 0.14, 4.2, 3.2, shed.x - 8.02, 0, shed.z + dz);
  const office = { x: 34.5, z: -11 };
  b.box(0xe7e5e4, 10, 10.5, 9, office.x, 0, office.z, { solid: true }).box(0x0b7a43, 10.4, 0.6, 9.4, office.x, 10.5, office.z);
  b.windows(0x38bdf8, 4, 3, 9.4, 0.6, 9.6, office.x, office.z - 4.52, Math.PI).windows(0x38bdf8, 4, 3, 9.4, 0.6, 9.6, office.x, office.z + 4.52, 0);
  b.windows(0x38bdf8, 4, 3, 8.4, 0.6, 9.6, office.x - 5.02, office.z, -Math.PI / 2);
  b.box(0x1f2937, 1.6, 2.3, 0.14, office.x, 0, office.z - 4.54);

  // --- The fence and the gate ---------------------------------------------------------------
  const FENCE = 0x475569;
  b.box(FENCE, landWidth, 2.6, 0.25, QUAY_X + landWidth / 2, 0, -HALF_Z + 0.2, { solid: true }).box(FENCE, landWidth, 2.6, 0.25, QUAY_X + landWidth / 2, 0, HALF_Z - 0.2, { solid: true });
  const northFence = GATE_FROM + HALF_Z;
  const southFence = HALF_Z - GATE_TO;
  b.box(FENCE, 0.25, 2.6, northFence, HALF_X - 0.2, 0, -HALF_Z + northFence / 2, { solid: true });
  b.box(FENCE, 0.25, 2.6, southFence, HALF_X - 0.2, 0, GATE_TO + southFence / 2, { solid: true });
  for (const z of [GATE_FROM - 0.5, GATE_TO + 0.5]) b.box(0xe5e7eb, 1, 5.8, 1, HALF_X - 0.2, 0, z, { solid: true });
  b.box(0x0b7a43, 1, 1.3, GATE_TO - GATE_FROM + 2, HALF_X - 0.2, 5.8, GATE_Z);
  b.box(0xf1f5f9, 3, 2.8, 3, HALF_X - 3, 0, GATE_TO + 2.6, { solid: true }).box(0x1f2937, 3.5, 0.2, 3.5, HALF_X - 3, 2.8, GATE_TO + 2.6);
  b.box(0xfef9c3, 0.1, 0.9, 1.8, HALF_X - 4.52, 1.2, GATE_TO + 2.6, { glow: true });
  // Barriers, raised
  for (const z of [GATE_FROM + 0.4, GATE_TO - 0.4]) {
    b.box(0xf1f5f9, 0.3, 1.1, 0.3, HALF_X - 1.6, 0, z).box(0xdc2626, 0.12, 0.12, 4.2, HALF_X - 1.6, 2.6, z + (z < GATE_Z ? 1.1 : -1.1), { pitch: z < GATE_Z ? -0.95 : 0.95 });
  }
  // Tall lamps over the yard
  for (const [x, z] of [[-3, -30], [-3, 32], [26, 8]]) {
    b.cylinder(0x94a3b8, 0.3, 17, x, 0, z, { topRadius: 0.18, solid: true }).box(0xfff7c2, 2.6, 0.5, 1.2, x, 17, z, { glow: true });
  }
  // The pallet the crates wait on
  const pallet = { x: 13, z: -19.5 };
  b.box(0x92400e, 2.6, 0.14, 1.1, pallet.x, 0, pallet.z);

  const group = b.build(options.id);
  group.position.set(site.x, 0, site.z);
  // Working here is a job, with a record of its own
  const jobs = Employment.get();
  const employer = jobs.employer(options.id);
  const rate = () => jobs.grade(options.id)?.pay ?? employer?.grades[0].pay ?? 0;
  const effort = employer?.energy ?? 30;

  const gateSign = signBoard([options.name.toUpperCase(), 'Container Terminal  ·  Gate 1'], 10.6, 1.7, '#0b3d24');
  gateSign.position.set(HALF_X + 0.34, 6.45, GATE_Z);
  gateSign.rotation.y = Math.PI / 2;
  const officeSign = signBoard(['TERMINAL OFFICE'], 6, 0.8, '#0b3d24');
  officeSign.position.set(office.x, 9.9, office.z - 4.6);
  officeSign.rotation.y = Math.PI;
  const shedSign = signBoard(['SHED 4  ·  GENERAL CARGO'], 9, 0.9, '#1f2937');
  shedSign.position.set(shed.x - 8.1, 5.2, shed.z);
  shedSign.rotation.y = -Math.PI / 2;
  const guard = figure(0x1e3a8a, 0x111827, 0x5b3a1e, 0x111827);
  guard.position.set(HALF_X - 5.2, 0, GATE_TO + 1.2);
  guard.rotation.y = -Math.PI / 2;
  const foreman = figure(0xf97316, 0x1f2937, 0x6b4226, 0xfacc15);
  foreman.position.set(pallet.x + 3.4, 0, pallet.z + 1.2);
  foreman.rotation.y = Math.PI;
  group.add(gateSign, officeSign, shedSign, guard, foreman);

  // --- The ship ----------------------------------------------------------------------------
  const ship = cargoShip(options.ship);
  const shipX = QUAY_X - 5.9;
  ship.position.set(shipX, 0, 4);
  group.add(ship);

  // --- The working crane: a trolley that fetches boxes off the ship -------------------------
  const zc = craneAt[0];
  const trolley = new Builder().box(0x374151, 2.4, 0.8, 2.2, 0, 0, 0).box(0x93c5fd, 1.2, 1.2, 1.4, 0, -1.2, 1.6).build('crane trolley');
  trolley.position.set(-9.5, BOOM_Y - 1.9, zc);
  const cable = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1, 0.12), new THREE.MeshStandardMaterial({ color: 0x111827 }));
  cable.userData.surface = true;
  const spreader = new Builder().box(0xfacc15, 2.6, 0.3, 6.3, 0, 0, 0).build('spreader');
  const lifted = new Builder().box(0xb91c1c, BOX_W, BOX_H, BOX_L, 0, -BOX_H, 0).build('lifted box');
  spreader.add(lifted);
  group.add(trolley, cable, spreader);
  /** Over the stack on the ship nearest the quay */
  const shipSide = shipX + 2.7;
  const quaySide = -9.5;
  const HIGH = 16;
  const ON_SHIP = 5.2 + BOX_H * 2;
  const ON_QUAY = BOX_H + 1;
  const CRANE_CYCLE = 26;

  // --- The yard tractor --------------------------------------------------------------------
  const tractor = yardTractor();
  const round = new Route([[-2.2, -16], [-2.2, 29.6], [15.5, 29.6], [15.5, -16]], true);
  group.add(tractor);

  // --- The loading bay ---------------------------------------------------------------------
  const lorry = flatbed();
  lorry.position.set(BAY_X, 0, BAY_Z);
  group.add(lorry);
  const wayOut = new Route([[BAY_X, BAY_Z], [32, BAY_Z], [38, GATE_Z + 1.5], [HALF_X + 34, GATE_Z + 1.5]]);
  const wayIn = new Route([[HALF_X + 34, INBOUND_Z], [12, INBOUND_Z], [9.2, INBOUND_Z + 1.2], [8, -26], [9.2, BAY_Z - 1.2], [12, BAY_Z], [BAY_X, BAY_Z]]);
  const crateShape = new THREE.BoxGeometry(0.56, 0.5, 0.56);
  const crateLook = new THREE.MeshStandardMaterial({ color: 0xb45309, roughness: 0.85 });
  const crates: THREE.Mesh[] = [];
  const onPallet = (index: number) => new THREE.Vector3(pallet.x + (index - 1) * 0.72, 0.39, pallet.z);
  /** Where each crate goes on the lorry's bed, measured on the lorry */
  const onBed = (index: number) => new THREE.Vector3(-3 + index * 0.9, 1.42, 0);
  const streetLayer = (object: THREE.Object3D) => object.traverse((child) => child.layers.set(RENDER_LAYERS.STREET));
  for (let i = 0; i < CRATES; i++) {
    const crate = new THREE.Mesh(crateShape, crateLook);
    crate.castShadow = true;
    crate.userData.surface = true;
    crates.push(crate);
  }
  const putCratesBack = (host?: LandmarkHost) => {
    if (host && crates.includes(host.actor.carried as THREE.Mesh)) host.actor.letGo();
    crates.forEach((crate, index) => {
      crate.removeFromParent();
      group.add(crate);
      crate.position.copy(onPallet(index));
      crate.rotation.set(0, 0, 0);
      streetLayer(crate);
    });
  };
  putCratesBack();

  type Bay = 'ready' | 'loading' | 'leaving' | 'away' | 'arriving';
  let bay: Bay = 'ready';
  let bayClock = 0;

  const loading = createHandWork({
    employerId: options.id,
    name: 'load the lorry',
    words: {
      boss: 'Foreman Sunday',
      theBoss: 'the foreman',
      says: 'Foreman',
      role: `Loading bay, ${options.name}`,
      offer: 'We take hands on by the lorry',
      ready: 'The lorry is at the bay.',
      piece: 'load',
      done: 'loaded',
    },
    count: CRATES,
    lift: (i) => ({
      stand: at(onPallet(i).x, pallet.z - 1),
      face: 0,
      take: (actor) => {
        crates[i].removeFromParent();
        actor.carry(crates[i]);
      },
    }),
    set: (i) => ({
      stand: at(BAY_X + onBed(i).x, BAY_Z + 1.85),
      face: Math.PI,
      put: (actor) => {
        actor.letGo();
        lorry.add(crates[i]);
        crates[i].position.copy(onBed(i));
        streetLayer(crates[i]);
      },
    }),
    cannotStart: () => (bay !== 'ready' ? 'Foreman: "That one is full. Wait for the next lorry."' : null),
    began: () => { bay = 'loading'; },
    ended: (paid, host) => {
      if (paid) {
        bay = 'leaving';
        bayClock = 0;
        return;
      }
      // Walked away, or too tired to finish: the crates go back and nothing is paid
      putCratesBack(host);
      bay = 'ready';
    },
  });

  const foremanBox = clickBox(1.2, 2, 1.2);
  foremanBox.position.set(foreman.position.x, 1, foreman.position.z);
  group.add(foremanBox);
  const foremanId = `${options.id}-foreman`;

  const bayBox = clickBox(16, 3.4, 5);
  bayBox.position.set((pallet.x + BAY_X) / 2 + 1, 1.7, BAY_Z + 1);
  const gateBox = clickBox(3, 6, GATE_TO - GATE_FROM + 2);
  gateBox.position.set(HALF_X - 0.2, 3, GATE_Z);
  group.add(bayBox, gateBox);

  let time = 0;
  const bayId = `${options.id}-loading-bay`;

  return {
    id: options.id,
    name: options.name,
    zone: { minX: site.x - HALF_X, maxX: site.x + HALF_X + 0.5, minZ: site.z - HALF_Z, maxZ: site.z + HALF_Z },
    group,
    obstructions: b.obstructions(options.name, site.x, site.z),
    interactive: [
      {
        mesh: gateBox,
        id: options.id,
        name: options.name,
        category: 'Seaport',
        description: `The container terminal. The ${options.ship} is alongside and being unloaded. The foreman at the loading bay, just inside the gate, takes hands on.`,
        interactionPoint: at(HALF_X + 1.6, GATE_Z),
      },
      {
        mesh: bayBox,
        id: bayId,
        name: 'Loading bay',
        category: 'Seaport · Work',
        description: `Carry ${CRATES} crates from the pallet to the lorry. Paid when the last one is on, at the rate of your grade, and it takes ${effort}% of your energy. For those the foreman has taken on.`,
        interactionPoint: at(pallet.x, pallet.z - 1.6),
      },
      {
        mesh: foremanBox,
        id: foremanId,
        name: 'Foreman Sunday',
        category: 'Seaport · Work',
        description: `Runs the loading bay. He takes hands on: ${loading.terms()}.`,
        interactionPoint: at(foreman.position.x, foreman.position.z - 1.3),
      },
    ],
    actions: {
      [options.id]: {
        label: () => '🚢 Ask at the gate about work',
        run: (host) => host.say(jobs.isEmployed(options.id) ? 'Guard: "Morning. The bay is straight in, on your left."' : 'Guard: "They want hands at the loading bay. See the foreman: straight in, on your left."', 'info'),
      },
      [foremanId]: {
        label: () => loading.bossLabel(),
        run: (host) => loading.askBoss(host),
      },
      [bayId]: {
        label: () => {
          if (!jobs.isEmployed(options.id)) return '📦 Hands wanted: ask the foreman';
          if (bay === 'ready') return `📦 Load the lorry: ${CRATES} crates (₦${rate().toLocaleString()})`;
          if (bay === 'loading') return `📦 Loading: ${loading.setDown} of ${CRATES} on`;
          return '🚚 The next lorry is on its way';
        },
        run: (host) => loading.start(host),
      },
    },
    doors: [{ name: `Gate of ${options.name}`, x: site.x + HALF_X + 1.6, z: site.z + GATE_Z }],
    update(delta) {
      time += delta;
      ship.position.y = Math.sin(time * 0.7) * 0.1;
      ship.rotation.z = Math.sin(time * 0.45) * 0.008;
      round.place(tractor, (time * 4.5) % round.length);

      // The crane: up off the ship, across, down onto the quay, and back empty
      const u = (time % CRANE_CYCLE) / CRANE_CYCLE;
      const ease = (t: number) => t * t * (3 - 2 * t);
      const span = (from: number, to: number) => ease(Math.max(0, Math.min(1, (u - from) / (to - from))));
      let x = shipSide;
      let y = ON_SHIP;
      if (u < 0.15) y = ON_SHIP + (HIGH - ON_SHIP) * span(0, 0.15);
      else if (u < 0.4) { x = shipSide + (quaySide - shipSide) * span(0.15, 0.4); y = HIGH; }
      else if (u < 0.55) { x = quaySide; y = HIGH + (ON_QUAY - HIGH) * span(0.4, 0.55); }
      else if (u < 0.6) { x = quaySide; y = ON_QUAY; }
      else if (u < 0.7) { x = quaySide; y = ON_QUAY + (HIGH - ON_QUAY) * span(0.6, 0.7); }
      else if (u < 0.9) { x = quaySide + (shipSide - quaySide) * span(0.7, 0.9); y = HIGH; }
      else y = HIGH + (ON_SHIP - HIGH) * span(0.9, 1);
      lifted.visible = u < 0.57;
      trolley.position.x = x;
      spreader.position.set(x, y, zc);
      const drop = trolley.position.y - 0.4 - y;
      cable.position.set(x, y + drop / 2, zc);
      cable.scale.y = Math.max(0.1, drop);

      // The lorry: away when loaded, and another in its place a while later
      if (bay === 'leaving') {
        bayClock += delta;
        wayOut.place(lorry, bayClock * 6);
        if (bayClock * 6 >= wayOut.length) {
          bay = 'away';
          bayClock = 0;
          lorry.visible = false;
          putCratesBack();
        }
      } else if (bay === 'away') {
        bayClock += delta;
        if (bayClock > 20) {
          bay = 'arriving';
          bayClock = 0;
          lorry.visible = true;
          lorry.rotation.y = Math.PI;
        }
      } else if (bay === 'arriving') {
        bayClock += delta;
        wayIn.place(lorry, bayClock * 6);
        if (bayClock * 6 >= wayIn.length) {
          bay = 'ready';
          lorry.position.set(BAY_X, 0, BAY_Z);
          lorry.rotation.y = 0;
        }
      }
    },
    status: () => ({
      bay,
      loaded: loading.setDown,
      paidRuns: loading.paid,
      employed: jobs.isEmployed(options.id),
      grade: jobs.grade(options.id)?.title ?? null,
      rate: rate(),
      loads: jobs.done(options.id),
      cratesOnLorry: crates.filter((crate) => crate.parent === lorry).length,
      lorry: { x: site.x + lorry.position.x, z: site.z + lorry.position.z, visible: lorry.visible },
      ship: options.ship,
    }),
  };
}
