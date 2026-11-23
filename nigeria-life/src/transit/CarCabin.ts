import * as THREE from 'three';
import type { Builder } from '../world/kit/ArchKit';
import type { CarSpec } from '../world/vehicles/CarBodyKit';

export interface CabinLayout {
  floorY: number;
  seatY: number;
  driverX: number;
  dashBack: number;
  hipZ: number;
  rearHipZ: number;
  cabinFront: number;
  cabinBack: number;
  /** Dashboard, console and door plastics */
  trim: number;
  /** Seat cloth or leather */
  fabric: number;
  /** The panel down the middle of each seat */
  insert: number;
  /** The ceiling */
  lining: number;
}

const CHROME = 0xc9ccd2;
const SOFT_BLACK = 0x15171b;

/** A smooth closed outline through these points: every corner becomes a curve */
function smooth(points: ReadonlyArray<readonly [number, number]>): THREE.Shape {
  const shape = new THREE.Shape();
  const mid = (a: readonly [number, number], b: readonly [number, number]): [number, number] => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  const n = points.length;
  shape.moveTo(...mid(points[n - 1], points[0]));
  for (let i = 0; i < n; i++) {
    const next = mid(points[i], points[(i + 1) % n]);
    shape.quadraticCurveTo(points[i][0], points[i][1], next[0], next[1]);
  }
  return shape;
}

/** An outline drawn from the side (z along, y up), carried across the car's width, its edges softened */
function across(points: ReadonlyArray<readonly [number, number]>, width: number, soft = 0.014): THREE.BufferGeometry {
  const depth = Math.max(0.002, width - soft * 2);
  const geo = new THREE.ExtrudeGeometry(smooth(points), { depth, bevelEnabled: soft > 0, bevelThickness: soft, bevelSize: soft, bevelOffset: -soft, bevelSegments: 2, curveSegments: 4 });
  geo.translate(0, 0, -depth / 2);
  geo.rotateY(-Math.PI / 2);
  return geo;
}

/** An outline drawn from the front (x across, y up), carried along the car */
function along(points: ReadonlyArray<readonly [number, number]>, length: number): THREE.BufferGeometry {
  const geo = new THREE.ExtrudeGeometry(smooth(points), { depth: length, bevelEnabled: false, curveSegments: 5 });
  geo.translate(0, 0, -length / 2);
  return geo;
}

/** A disc facing the back of the car, at this point */
const disc = (b: Builder, hex: number, radius: number, x: number, y: number, z: number, glow = false, thick = 0.012) =>
  b.cylinder(hex, radius, thick, x, y - thick / 2, z, { pitch: Math.PI / 2, glow, sides: 22 });

/**
 * The inside of a car, as the person in the back sees it: shaped seats with stitched panels and
 * headrests, a moulded dashboard with lit dials and a screen, vents, a console with its gear lever,
 * door cards, a soft ceiling and a proper mirror. All of it one mesh and one draw.
 */
export function buildCarCabin(b: Builder, s: CarSpec, a: CabinLayout): void {
  const { floorY, seatY, driverX, dashBack, hipZ, rearHipZ, cabinFront, cabinBack, trim, fabric, insert, lining } = a;
  const innerRoof = s.width * (1 - s.tumblehome) - 0.14;
  const cabinMiddle = (cabinFront + cabinBack) / 2;

  // Floor with its mats
  b.box(0x202226, s.width - 0.24, 0.04, cabinFront - cabinBack, 0, floorY, cabinMiddle);
  for (const x of [driverX, -driverX]) {
    b.box(0x121316, 0.46, 0.012, 0.52, x, floorY + 0.04, hipZ + 0.42);
    b.box(0x121316, 0.46, 0.012, 0.4, x, floorY + 0.04, rearHipZ + 0.42);
  }

  // The ceiling: a shallow crown from side to side, with its dome light and grab handles
  const ceilingLength = s.screenTop - s.backTop - 0.04;
  const ceilingMiddle = (s.screenTop + s.backTop) / 2;
  const half = innerRoof / 2;
  b.shape(lining, along([[-half, -0.05], [-half * 0.75, 0.035], [0, 0.07], [half * 0.75, 0.035], [half, -0.05], [half * 0.8, -0.075], [0, -0.03], [-half * 0.8, -0.075]], ceilingLength), 0, s.roof - 0.12, ceilingMiddle);
  b.box(0xd8d2c6, 0.3, 0.018, 0.16, 0, s.roof - 0.145, ceilingMiddle + 0.2);
  b.box(0xfff4cf, 0.2, 0.012, 0.09, 0, s.roof - 0.155, ceilingMiddle + 0.2, { glow: true });
  for (const side of [-1, 1]) {
    b.box(0x8d8a84, 0.022, 0.03, 0.2, side * (half - 0.06), s.roof - 0.22, rearHipZ + 0.1);
    for (const dz of [-0.09, 0.09]) b.box(0x8d8a84, 0.05, 0.05, 0.02, side * (half - 0.04), s.roof - 0.2, rearHipZ + 0.1 + dz);
  }

  // Inner trim over the windscreen pillars, so the paint does not show inside
  const pillarRun = Math.hypot(s.screenTop - s.screenFoot, s.roof - s.belt);
  const pillarPitch = Math.atan2(s.screenTop - s.screenFoot, s.roof - s.belt);
  const pillarZ = (s.screenFoot + s.screenTop) / 2 - 0.05;
  const pillarY = (s.belt + s.roof) / 2 - 0.05;
  for (const side of [-1, 1]) {
    const x = side * ((s.width + innerRoof) / 4 - 0.035);
    b.box(0xa39f97, 0.08, pillarRun * 0.92, 0.1, x, pillarY - (pillarRun * 0.92) / 2, pillarZ, { pitch: pillarPitch, roll: side * 0.14 });
  }

  // The dashboard, moulded in one sweep from the windscreen to the knees
  const top = s.belt + 0.035;
  const dashWidth = s.width - 0.13;
  b.shape(trim, across([
    [s.screenFoot + 0.02, s.belt - 0.03], [s.screenFoot - 0.12, top + 0.01], [dashBack + 0.1, top + 0.015], [dashBack - 0.015, top - 0.03],
    [dashBack - 0.035, s.belt - 0.16], [dashBack + 0.0, s.belt - 0.3], [dashBack + 0.14, floorY + 0.26], [s.screenFoot - 0.05, floorY + 0.16], [s.screenFoot + 0.04, s.belt - 0.3],
  ], dashWidth, 0.022), 0, 0, 0);
  // A softer top pad and a bright line across it
  b.shape(0x2c2f35, across([[s.screenFoot - 0.03, top - 0.018], [s.screenFoot - 0.12, top + 0.025], [dashBack + 0.1, top + 0.03], [dashBack + 0.02, top - 0.012], [dashBack + 0.18, top - 0.022]], dashWidth - 0.05, 0.008), 0, 0, 0);
  b.box(0x6f737b, dashWidth - 0.16, 0.006, 0.008, 0, s.belt - 0.145, dashBack - 0.036);

  // The instruments under their hood
  const dialY = s.belt - 0.075;
  const dialZ = dashBack - 0.04;
  b.shape(0x101114, across([[dashBack + 0.16, top - 0.015], [dashBack + 0.08, top + 0.055], [dashBack - 0.03, top + 0.045], [dashBack - 0.075, top - 0.012], [dashBack - 0.02, top - 0.03]], 0.5, 0.014), driverX, 0, 0);
  b.box(0x07080b, 0.43, 0.135, 0.012, driverX, dialY - 0.07, dialZ + 0.012);
  for (const dx of [-0.11, 0.11]) {
    disc(b, CHROME, 0.067, driverX + dx, dialY, dialZ + 0.006);
    disc(b, 0x0b1626, 0.059, driverX + dx, dialY, dialZ, true);
    for (let tick = 0; tick < 9; tick++) {
      const angle = -2.3 + (tick / 8) * 4.6;
      b.box(0xdfefff, 0.003, 0.012, 0.003, driverX + dx + Math.sin(angle) * 0.047, dialY + Math.cos(angle) * 0.047 - 0.006, dialZ - 0.008, { roll: -angle, glow: true });
    }
    b.box(0xff5a36, 0.004, 0.044, 0.003, driverX + dx + 0.013, dialY - 0.004, dialZ - 0.011, { roll: -0.62, glow: true });
    disc(b, 0x30343b, 0.011, driverX + dx, dialY, dialZ - 0.013);
  }

  // The middle of the dash: vents, the screen, the buttons
  const stackZ = dashBack - 0.036;
  b.box(0x1a1c20, 0.42, 0.34, 0.014, 0, s.belt - 0.45, stackZ + 0.01);
  for (const dx of [-0.11, 0.11]) {
    b.box(CHROME, 0.17, 0.066, 0.008, dx, s.belt - 0.138, stackZ);
    b.box(0x08090b, 0.152, 0.05, 0.009, dx, s.belt - 0.13, stackZ - 0.002);
    for (let slat = 0; slat < 3; slat++) b.box(0x3b3f46, 0.146, 0.004, 0.006, dx, s.belt - 0.122 + slat * 0.014, stackZ - 0.006);
  }
  b.box(0x050608, 0.25, 0.135, 0.008, 0, s.belt - 0.315, stackZ - 0.001);
  b.box(0x123a63, 0.232, 0.118, 0.004, 0, s.belt - 0.307, stackZ - 0.006, { glow: true });
  b.box(0x38bdf8, 0.13, 0.012, 0.003, -0.035, s.belt - 0.235, stackZ - 0.009, { glow: true });
  b.box(0xe0f2fe, 0.08, 0.008, 0.003, -0.06, s.belt - 0.256, stackZ - 0.009, { glow: true });
  for (let bar = 0; bar < 6; bar++) b.box(0x7dd3fc, 0.012, 0.015 + (bar % 3) * 0.012, 0.003, 0.035 + bar * 0.016, s.belt - 0.286, stackZ - 0.009, { glow: true });
  for (const dx of [-0.15, 0.15]) {
    disc(b, CHROME, 0.024, dx, s.belt - 0.385, stackZ - 0.002);
    disc(b, 0x24272c, 0.018, dx, s.belt - 0.385, stackZ - 0.008);
  }
  for (const dx of [-0.066, -0.022, 0.022, 0.066]) b.box(0x34383f, 0.034, 0.02, 0.006, dx, s.belt - 0.396, stackZ - 0.003);
  b.box(0xdc2626, 0.018, 0.01, 0.004, 0, s.belt - 0.391, stackZ - 0.008, { glow: true });
  // Vent at each end, and the glovebox's line on the passenger's side
  for (const side of [-1, 1]) {
    b.box(CHROME, 0.11, 0.06, 0.008, side * (dashWidth / 2 - 0.1), s.belt - 0.135, dashBack - 0.03);
    b.box(0x08090b, 0.094, 0.044, 0.009, side * (dashWidth / 2 - 0.1), s.belt - 0.127, dashBack - 0.033);
  }
  b.box(0x101115, 0.44, 0.006, 0.006, -driverX - 0.02, s.belt - 0.22, dashBack - 0.04);
  b.box(0x101115, 0.44, 0.006, 0.006, -driverX - 0.02, s.belt - 0.42, dashBack - 0.01);
  b.box(CHROME, 0.09, 0.012, 0.012, -driverX - 0.02, s.belt - 0.27, dashBack - 0.042);

  // The console between the front seats, its lever in a leather boot, cup holders and handbrake
  const consoleZ = hipZ + 0.2;
  b.shape(trim, across([[consoleZ + 0.56, floorY + 0.28], [consoleZ + 0.42, floorY + 0.36], [consoleZ - 0.5, floorY + 0.34], [consoleZ - 0.56, floorY + 0.25], [consoleZ - 0.56, floorY + 0.02], [consoleZ + 0.56, floorY + 0.02]], 0.27, 0.018), 0, 0, 0);
  b.box(0x34373d, 0.15, 0.006, 0.34, 0, floorY + 0.36, consoleZ + 0.22);
  b.cone(0x1b1c20, 0.075, 0.13, 0, floorY + 0.36, consoleZ + 0.26, 12);
  b.cylinder(0x4a4d53, 0.012, 0.07, 0, floorY + 0.45, consoleZ + 0.26);
  b.dome(0x101114, 0.034, 0, floorY + 0.51, consoleZ + 0.26);
  b.cylinder(0x101114, 0.034, 0.012, 0, floorY + 0.5, consoleZ + 0.26, { sides: 14 });
  b.box(CHROME, 0.014, 0.003, 0.03, 0, floorY + 0.538, consoleZ + 0.26);
  for (const dz of [-0.03, 0.06]) {
    b.cylinder(0x08090b, 0.038, 0.004, 0.055, floorY + 0.357, consoleZ - 0.14 + dz, { sides: 14 });
    b.cylinder(CHROME, 0.042, 0.002, 0.055, floorY + 0.354, consoleZ - 0.14 + dz, { sides: 14 });
  }
  b.box(0x1b1c20, 0.035, 0.03, 0.2, -0.05, floorY + 0.37, consoleZ - 0.13, { pitch: 0.22 });
  b.box(CHROME, 0.022, 0.008, 0.012, -0.05, floorY + 0.405, consoleZ - 0.045, { pitch: 0.22 });

  // A seat: a cushion and a back with a shaped side view, a stitched panel down the middle, a headrest on two posts
  const seat = (x: number, z: number, w: number, heads: number[]) => {
    b.shape(fabric, across([[z - 0.27, seatY - 0.14], [z + 0.3, seatY - 0.13], [z + 0.335, seatY - 0.035], [z + 0.26, seatY + 0.022], [z - 0.21, seatY - 0.015], [z - 0.3, seatY - 0.08]], w, 0.03), x, 0, 0);
    b.shape(fabric, across([[z - 0.32, seatY - 0.12], [z - 0.19, seatY - 0.08], [z - 0.2, seatY + 0.16], [z - 0.255, seatY + 0.5], [z - 0.285, seatY + 0.63], [z - 0.39, seatY + 0.62], [z - 0.415, seatY + 0.2]], w, 0.035), x, 0, 0);
    const panel = w * 0.6;
    b.shape(insert, across([[z - 0.17, seatY + 0.012], [z + 0.235, seatY + 0.02], [z + 0.25, seatY + 0.035], [z - 0.17, seatY + 0.022]], panel, 0.004), x, 0, 0);
    b.shape(insert, across([[z - 0.188, seatY + 0.03], [z - 0.178, seatY + 0.05], [z - 0.238, seatY + 0.52], [z - 0.25, seatY + 0.52]], panel, 0.004), x, 0, 0);
    for (const dx of [-panel / 2, panel / 2]) b.box(0xb9b0a0, 0.004, 0.5, 0.004, x + dx, seatY + 0.04, z - 0.222, { pitch: -0.13 });
    for (const hx of heads) {
      for (const dx of [-0.055, 0.055]) b.cylinder(CHROME, 0.007, 0.09, hx + dx, seatY + 0.6, z - 0.335, { sides: 8 });
      b.shape(fabric, across([[z - 0.285, seatY + 0.68], [z - 0.28, seatY + 0.8], [z - 0.32, seatY + 0.86], [z - 0.39, seatY + 0.83], [z - 0.395, seatY + 0.68]], 0.215, 0.026), hx, 0, 0);
    }
  };
  seat(driverX, hipZ, 0.52, [driverX]);
  seat(-driverX, hipZ, 0.52, [-driverX]);
  seat(0, rearHipZ, s.width - 0.34, [driverX, -driverX]);
  // A shelf behind the back seat
  b.box(0x17181b, s.width - 0.3, 0.025, 0.28, 0, s.belt - 0.09, cabinBack + 0.12);

  // Door cards: the panel, a padded armrest, a chrome handle, a map pocket and a speaker
  const cardLength = cabinFront - cabinBack - 0.1;
  for (const side of [-1, 1]) {
    const x = side * (s.width / 2 - 0.19);
    b.box(trim, 0.05, s.belt - floorY - 0.02, cardLength, x, floorY, cabinMiddle);
    b.box(fabric, 0.012, 0.14, cardLength - 0.14, x - side * 0.03, seatY + 0.2, cabinMiddle);
    for (const z of [hipZ, rearHipZ]) {
      b.shape(0x34373c, along(side > 0 ? [[-0.09, 0], [-0.08, 0.05], [0.04, 0.055], [0.05, 0]] : [[-0.05, 0], [-0.04, 0.055], [0.08, 0.05], [0.09, 0]], 0.46), x - side * 0.05, seatY + 0.14, z + 0.06);
      b.box(CHROME, 0.016, 0.026, 0.12, x - side * 0.04, s.belt - 0.13, z + 0.3);
      b.box(0x101114, 0.02, 0.05, 0.42, x - side * 0.03, floorY + 0.12, z + 0.08);
      b.cylinder(0x0c0d10, 0.062, 0.006, x - side * 0.029, floorY + 0.27, z + 0.3, { roll: Math.PI / 2, sides: 14 });
      b.cylinder(0x3a3d43, 0.024, 0.008, x - side * 0.031, floorY + 0.27, z + 0.3, { roll: Math.PI / 2, sides: 10 });
    }
    // The sill under the window
    b.box(SOFT_BLACK, 0.2, 0.03, cabinFront - cabinBack + 0.16, side * (s.width / 2 - 0.13), s.belt - 0.04, cabinMiddle);
  }

  // The mirror on its stem, with a rosary and a little green air freshener
  const mirrorZ = s.screenTop - 0.075;
  const mirrorY = s.roof - 0.255;
  b.box(0x1b1c20, 0.022, 0.09, 0.022, 0, s.roof - 0.21, s.screenTop - 0.03, { pitch: 0.35 });
  const mirror = new THREE.ExtrudeGeometry(smooth([[-0.125, -0.036], [0.125, -0.036], [0.135, 0.036], [-0.135, 0.036]]), { depth: 0.022, bevelEnabled: false, curveSegments: 4 });
  b.shape(0x101114, mirror, 0, mirrorY, mirrorZ);
  const glass = new THREE.ExtrudeGeometry(smooth([[-0.112, -0.026], [0.112, -0.026], [0.122, 0.026], [-0.122, 0.026]]), { depth: 0.002, bevelEnabled: false, curveSegments: 4 });
  b.shape(0x9ab4c4, glass, 0, mirrorY, mirrorZ - 0.0015);
  for (let i = 0; i < 9; i++) {
    const u = i / 8;
    b.box(0x7c2d12, 0.011, 0.011, 0.011, Math.sin(u * Math.PI * 2) * 0.026, mirrorY - 0.05 - Math.sin(u * Math.PI) * 0.06, mirrorZ + 0.005);
  }
  b.box(0x16a34a, 0.032, 0.046, 0.005, 0.045, mirrorY - 0.105, mirrorZ + 0.005);

  // Sun visors, folded up against the ceiling
  for (const x of [driverX, -driverX]) {
    b.shape(lining, along([[-0.21, -0.008], [-0.2, 0.008], [0.2, 0.008], [0.21, -0.008]], 0.17), x, s.roof - 0.145, s.screenTop - 0.16);
    b.box(0x8d8a84, 0.02, 0.012, 0.03, x + (x > 0 ? 0.2 : -0.2), s.roof - 0.14, s.screenTop - 0.09);
  }
}
