import * as THREE from 'three';
import { Builder } from '../world/kit/ArchKit';
import { HumanMeshBuilder, type HumanConfig, type HumanRig } from '../graphics/HumanMeshBuilder';
import { buildKitCar, plainWheel } from '../world/vehicles/KitCar';
import {
  addKekeBody,
  addOkadaBody,
  buildKekeSteer,
  buildOkadaSteer,
  buildSpokedWheel,
  liftKekePassengerToDeck,
  KEKE_LAYOUT,
  OKADA_LAYOUT,
} from '../world/vehicles/KekeOkadaModels';
import { bakeToGeometry, bakingPeopleAsModels } from '../graphics/MeshBaker';
import type { CarSpec } from '../world/vehicles/CarBodyKit';
import { buildCarCabin } from './CarCabin';

/**
 * What a ride is made of: the vehicle, the driver sitting in it with his hands on the wheel
 * (or the handlebars), and the passenger. Every vehicle faces +z; the driver sits on the left
 * (+x) as in Nigeria.
 */

// ------------------------------------------------------------------------------------------
// People sitting down
// ------------------------------------------------------------------------------------------

export interface Seated {
  /** Stands at the hips; lean it back and turn it as a whole */
  root: THREE.Group;
  rig: HumanRig;
  scale: number;
}

/** A person sitting, hips at the root's origin, thighs forward and shins down */
export function seatFigure(rig: HumanRig, scale = 0.92, legs: 'car' | 'bike' | 'bench' = 'car'): Seated {
  const root = new THREE.Group();
  rig.group.scale.setScalar(scale);
  rig.group.position.y = -0.77 * scale;
  rig.nameTag.visible = false;
  if (rig.phoneMesh) rig.phoneMesh.visible = false;
  const thigh = legs === 'bike' ? -1.15 : -1.42;
  const knee = legs === 'bike' ? 1.55 : legs === 'bench' ? 1.4 : 1.15;
  const spread = legs === 'bike' ? 0.22 : 0.06;
  rig.leftLeg.rotation.set(thigh, 0, -spread);
  rig.rightLeg.rotation.set(thigh, 0, spread);
  if (rig.leftLowerLeg) rig.leftLowerLeg.rotation.x = knee;
  if (rig.rightLowerLeg) rig.rightLowerLeg.rotation.x = knee;
  root.add(rig.group);
  bakeFigure(rig);
  return { root, rig, scale };
}

const FIGURE = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.62 });

/**
 * A detailed person is a hundred meshes or more. Seated in a vehicle only the head and the
 * arms move, so the rest is merged into one mesh, and the head, each upper arm and each
 * forearm into one each: seven draws for a person, the joints still free to turn.
 */
function bakeFigure(rig: HumanRig): void {
  const arms = [rig.leftArm, rig.rightArm];
  const forearms = [rig.leftForearm, rig.rightForearm];
  rig.group.updateWorldMatrix(true, true);
  // With the character models loaded, the whole person is the model, seated, in one piece (its own
  // arms and head are not turned apart); before then, as before
  const whole = bakingPeopleAsModels();
  const body = whole ? bakeToGeometry(rig.group) : bakeToGeometry(rig.group, { exclude: [...arms, rig.head] });
  const head = whole ? null : bakeToGeometry(rig.head, { space: rig.head });
  const uppers = arms.map((arm, i) => (whole ? null : bakeToGeometry(arm, { space: arm, exclude: forearms[i] ? [forearms[i]!] : [] })));
  const lowers = forearms.map((f) => (f && !whole ? bakeToGeometry(f, { space: f }) : null));
  const keepOnly = (parent: THREE.Object3D, keep: Array<THREE.Object3D | undefined>, geo: THREE.BufferGeometry | null) => {
    for (const child of [...parent.children]) if (!keep.includes(child)) parent.remove(child);
    if (geo) {
      const mesh = new THREE.Mesh(geo, FIGURE);
      mesh.castShadow = true;
      parent.add(mesh);
    }
  };
  keepOnly(rig.group, [...arms, rig.head], body);
  keepOnly(rig.head, [], head);
  arms.forEach((arm, i) => keepOnly(arm, [forearms[i]], uppers[i]));
  forearms.forEach((f, i) => f && keepOnly(f, [], lowers[i]));
  rig.phoneMesh = undefined;
}

/** A helmet on top of whatever head it is put on */
function helmetOn(rig: HumanRig, colour: number): void {
  let box = new THREE.Box3().setFromObject(rig.head);
  // A character model is baked in one piece, its head part of the body: the head is then the top of the figure
  const whole = box.isEmpty();
  if (whole) box = topOfFigure(rig.group);
  if (box.isEmpty()) return;
  const holder = whole ? rig.group : rig.head;
  const size = box.getSize(new THREE.Vector3());
  const middle = box.getCenter(new THREE.Vector3());
  const top = holder.worldToLocal(new THREE.Vector3(middle.x, box.max.y, middle.z));
  const radius = (Math.max(size.x, size.z) / rig.group.scale.x) * 0.62;
  const helmet = new THREE.Mesh(new THREE.SphereGeometry(radius, 18, 12, 0, Math.PI * 2, 0, Math.PI * 0.6), new THREE.MeshStandardMaterial({ color: colour, roughness: 0.3, metalness: 0.1 }));
  helmet.position.set(top.x, top.y - radius * 0.62, top.z);
  const visor = new THREE.Mesh(new THREE.BoxGeometry(radius * 1.5, radius * 0.18, radius * 0.5), new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.4 }));
  visor.position.set(top.x, top.y - radius * 0.5, top.z + radius * 0.9);
  holder.add(helmet, visor);
}

/** The top 20 cm of a figure, in world space */
function topOfFigure(figure: THREE.Object3D): THREE.Box3 {
  figure.updateWorldMatrix(true, true);
  const v = new THREE.Vector3();
  let highest = -Infinity;
  const each = (visit: (point: THREE.Vector3) => void) => figure.traverse((o) => {
    const mesh = o as THREE.Mesh;
    const position = mesh.isMesh ? mesh.geometry.getAttribute('position') : null;
    if (!position) return;
    for (let i = 0; i < position.count; i++) visit(v.fromBufferAttribute(position, i).applyMatrix4(mesh.matrixWorld));
  });
  each((p) => { highest = Math.max(highest, p.y); });
  const box = new THREE.Box3();
  each((p) => { if (p.y > highest - 0.2) box.expandByPoint(p); });
  return box;
}

export function person(config: Partial<HumanConfig> & { gender: 'male' | 'female' }): HumanRig {
  return HumanMeshBuilder.createHuman({ username: '', ...config } as HumanConfig);
}

const tmp = {
  s: new THREE.Vector3(), t: new THREE.Vector3(), dir: new THREE.Vector3(), pole: new THREE.Vector3(), perp: new THREE.Vector3(),
  u: new THREE.Vector3(), e: new THREE.Vector3(), f: new THREE.Vector3(), x: new THREE.Vector3(), y: new THREE.Vector3(), z: new THREE.Vector3(),
  m: new THREE.Matrix4(),
};

function boneLengths(forearm: THREE.Group | undefined): [number, number] {
  const upper = forearm ? Math.abs(forearm.position.y) : 0.3;
  let lower = 0.27;
  if (forearm) {
    for (const child of forearm.children) if ((child as THREE.Group).isGroup && Math.abs(child.position.y) > 0.1) lower = Math.abs(child.position.y);
  }
  // To the middle of the palm, which is what holds the wheel
  return [upper, lower + 0.07];
}

/**
 * Puts one hand where it is wanted (a point in world space) by turning the shoulder and
 * bending the elbow, the elbow falling down and out as people's do.
 */
export function reach(rig: HumanRig, side: 'left' | 'right', target: THREE.Vector3): number {
  const arm = side === 'left' ? rig.leftArm : rig.rightArm;
  const forearm = side === 'left' ? rig.leftForearm : rig.rightForearm;
  const [l1, l2] = boneLengths(forearm);
  // Work in the body's own space, where the arm hangs
  const t = tmp.t.copy(target);
  rig.group.worldToLocal(t);
  const s = tmp.s.copy(arm.position);
  const out = Math.sign(s.x) || 1;
  const dir = tmp.dir.subVectors(t, s);
  const d = Math.min(Math.max(dir.length(), 0.05), (l1 + l2) * 0.995);
  dir.normalize();
  const pole = tmp.pole.set(out * 0.7, -1, -0.25).normalize();
  const perp = tmp.perp.copy(pole).addScaledVector(dir, -pole.dot(dir)).normalize();
  const a = Math.acos(THREE.MathUtils.clamp((l1 * l1 + d * d - l2 * l2) / (2 * l1 * d), -1, 1));
  const u = tmp.u.copy(dir).multiplyScalar(Math.cos(a)).addScaledVector(perp, Math.sin(a));
  const e = tmp.e.copy(s).addScaledVector(u, l1);
  const f = tmp.f.copy(s).addScaledVector(dir, d).sub(e).normalize();
  // The arm's own axes: down it is the upper arm, across it is what the elbow bends about
  const y = tmp.y.copy(u).negate();
  const x = tmp.x.crossVectors(u, f);
  if (x.lengthSq() < 1e-6) x.set(1, 0, 0);
  x.normalize();
  let z = tmp.z.crossVectors(x, y);
  if (f.dot(z) < 0) {
    x.negate();
    z = tmp.z.crossVectors(x, y);
  }
  arm.quaternion.setFromRotationMatrix(tmp.m.makeBasis(x, y, z));
  if (!forearm) return 0;
  forearm.rotation.set(Math.atan2(-f.dot(z), -f.dot(y)), 0, 0);
  // How far the palm ended up from where it was sent, in metres
  forearm.updateWorldMatrix(true, false);
  const palm = forearm.localToWorld(tmp.e.set(0, -l2, 0));
  return palm.distanceTo(target);
}

// ------------------------------------------------------------------------------------------
// The vehicles
// ------------------------------------------------------------------------------------------

export interface RideVehicle {
  /** The whole vehicle; it sways and rolls a little as it goes */
  body: THREE.Group;
  wheels: THREE.Object3D[];
  wheelRadius: number;
  /** Turns with the driver's hands: the steering wheel, or the handlebars */
  steer: THREE.Group;
  /** Where the hands hold it, in the steering part's own space */
  grips: [THREE.Vector3, THREE.Vector3];
  driver: Seated;
  /** The player, where they sit */
  passenger: THREE.Group;
  /** Hidden when the camera is inside, so nothing comes between it and the road */
  hideInside: THREE.Object3D[];
  /** The camera for each view, in the vehicle's own space: where it is and where it looks */
  views: Record<'inside' | 'chase' | 'side', { at: THREE.Vector3; look: THREE.Vector3; fov: number }>;
  /** The lane it keeps to */
  lane: 'inner' | 'kerb';
  /** How far the driver's palms are from the grips, after the last pose (metres) */
  gripError?: number;
  /** The passenger's door, shown when it opens at the kerb, and the dark of the doorway behind it */
  door?: { hinge: THREE.Group; gap: THREE.Mesh };
}

const view = (at: [number, number, number], look: [number, number, number], fov: number) => ({ at: new THREE.Vector3(...at), look: new THREE.Vector3(...look), fov });

const DRIVERS: Array<Partial<HumanConfig> & { gender: 'male' }> = [
  { gender: 'male', outfit: 'casual_tee', outfitColor: 0x1e40af, trousersColor: 0x1f2937, hairstyle: 'short_crop', skinTone: '#4a2c1d' },
  { gender: 'male', outfit: 'senator', outfitColor: 0x7c2d12, trousersColor: 0x7c2d12, hairstyle: 'fila', skinTone: '#3b2416' },
  { gender: 'male', outfit: 'casual_tee', outfitColor: 0xf8fafc, trousersColor: 0x1e293b, hairstyle: 'fade', skinTone: '#5a3825' },
];

/** A car from the body kit with its cabin: dashboard, wheel, seats, door cards, the driver */
export function buildRideCar(specId: string, paint: number | undefined, taxi: boolean, look = 0): RideVehicle {
  const car = buildKitCar(specId, paint, { taxi });
  const s: CarSpec = car.spec;
  // See-through glass from outside, so the people in it can be seen
  car.materials.glass.transparent = true;
  car.materials.glass.opacity = 0.42;
  car.materials.glass.depthWrite = false;
  const body = new THREE.Group();
  body.add(car.group);
  hollowCabin(car.group, car.spec);

  const tall = s.style === 'suv' || s.style === 'boxy';
  const floorY = s.clearance + 0.1;
  const seatY = s.clearance + (tall ? 0.3 : 0.25);
  const driverX = s.width * 0.21;
  const dashBack = s.screenFoot - 0.5;
  const wheelZ = dashBack - 0.14;
  const wheelY = s.belt - 0.02;
  const hipZ = wheelZ - 0.5;
  const rearHipZ = hipZ - 0.86;
  const cabinFront = s.screenFoot - 0.2;
  const cabinBack = Math.max(s.backFoot + 0.25, rearHipZ - 0.45);
  const trim = taxi ? 0x2a2a2e : 0x1c1f24;
  const fabric = taxi ? 0x4a3f36 : tall ? 0x3b2a20 : 0x2f3238;
  const b = new Builder();
  buildCarCabin(b, s, {
    floorY, seatY, driverX, dashBack, hipZ, rearHipZ, cabinFront, cabinBack, trim, fabric,
    insert: taxi ? 0x5d5247 : tall ? 0x4b3527 : 0x24262b,
    lining: taxi ? 0xb7b0a4 : 0xc4beb2,
  });
  const cabin = b.build('cabin', { roughness: 0.7 });
  body.add(cabin);

  // The steering wheel on its column, tilted toward the driver
  const steer = new THREE.Group();
  const tilt = new THREE.Group();
  tilt.position.set(driverX, wheelY, wheelZ);
  tilt.rotation.x = 0.42;
  tilt.add(steer);
  const leather = new THREE.MeshStandardMaterial({ color: 0x121214, roughness: 0.6 });
  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.18, 0.022, 10, 32), leather);
  const boss = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.065, 0.06, 16), leather);
  boss.rotation.x = Math.PI / 2;
  const spokes = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.035, 0.02), leather);
  const lower = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.16, 0.02), leather);
  lower.position.y = -0.09;
  const badge = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.065, 12), new THREE.MeshStandardMaterial({ color: 0xd4d4d8, metalness: 0.9, roughness: 0.2 }));
  badge.rotation.x = Math.PI / 2;
  steer.add(rim, boss, spokes, lower, badge);
  const column = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, 0.36, 10), new THREE.MeshStandardMaterial({ color: 0x18181b, roughness: 0.6 }));
  column.rotation.x = Math.PI / 2;
  column.position.z = 0.2;
  tilt.add(column);
  body.add(tilt);

  // The driver, a little reclined, both hands on the wheel at ten to two
  const driver = seatFigure(person(DRIVERS[look % DRIVERS.length]), tall ? 0.95 : 0.9, 'car');
  driver.root.position.set(driverX, seatY + 0.05, hipZ);
  driver.root.rotation.x = -0.12;
  body.add(driver.root);

  const passenger = new THREE.Group();
  passenger.position.set(-driverX - 0.02, seatY - 0.02, rearHipZ);
  passenger.rotation.x = -0.1;
  body.add(passenger);

  // The passenger's door on the kerb side, hinged at its front edge
  let door: RideVehicle['door'];
  if (s.style !== 'sports') {
    const doorFoot = s.clearance + 0.12;
    const doorHeight = s.belt - doorFoot;
    const doorLength = 0.92;
    const hinge = new THREE.Group();
    hinge.position.set(-s.width / 2 - 0.012, 0, rearHipZ + 0.5);
    const skin = new THREE.Mesh(new THREE.BoxGeometry(0.04, doorHeight, doorLength), car.materials.paint);
    skin.position.set(0, doorFoot + doorHeight / 2, -doorLength / 2);
    const card = new THREE.Mesh(new THREE.BoxGeometry(0.02, doorHeight - 0.08, doorLength - 0.08), new THREE.MeshStandardMaterial({ color: trim, roughness: 0.75 }));
    card.position.set(0.03, doorFoot + doorHeight / 2, -doorLength / 2);
    hinge.add(skin, card);
    hinge.visible = false;
    const gap = new THREE.Mesh(new THREE.BoxGeometry(0.012, doorHeight, doorLength), new THREE.MeshBasicMaterial({ color: 0x08090b }));
    gap.position.set(-s.width / 2 - 0.004, doorFoot + doorHeight / 2, rearHipZ + 0.5 - doorLength / 2);
    gap.visible = false;
    body.add(hinge, gap);
    door = { hinge, gap };
  }

  const eye = seatY + (tall ? 0.78 : 0.72);
  return {
    body, wheels: car.wheels, wheelRadius: s.wheelRadius, steer,
    grips: [new THREE.Vector3(0.155, 0.06, 0.0), new THREE.Vector3(-0.155, 0.06, 0.0)],
    driver, passenger, hideInside: [passenger], door,
    views: {
      // From the back seat, between the front seats: the driver at the wheel, the road through the windscreen
      inside: view([-0.05, eye + 0.03, rearHipZ + 0.08], [driverX * 1.5, eye - 0.3, 7], 58),
      chase: view([0, s.roof + 1.9, -s.length / 2 - 5.2], [0, 1.0, 5], 58),
      side: view([-(s.length / 2 + 0.6) / Math.tan(0.4), 1.5, 0.6], [0, 0.95, 0.2], 50),
    },
    lane: 'inner',
  };
}

/**
 * The body kit draws the lower body as one solid, its top at the waist; a car to sit in needs
 * that top open between the windscreen and the back glass, or it is a floor at window height.
 */
function hollowCabin(car: THREE.Group, s: CarSpec): void {
  const lower = car.getObjectByName('car body')?.children[0] as THREE.Mesh | undefined;
  if (!lower?.isMesh) return;
  const source = lower.geometry.index ? lower.geometry.toNonIndexed() : lower.geometry;
  const pos = source.getAttribute('position') as THREE.BufferAttribute;
  const nrm = source.getAttribute('normal') as THREE.BufferAttribute;
  const keepPos: number[] = [];
  const keepNrm: number[] = [];
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), n = new THREE.Vector3();
  for (let i = 0; i < pos.count; i += 3) {
    a.fromBufferAttribute(pos, i);
    b.fromBufferAttribute(pos, i + 1);
    c.fromBufferAttribute(pos, i + 2);
    n.subVectors(b, a).cross(c.clone().sub(a)).normalize();
    const y = (a.y + b.y + c.y) / 3;
    const z = (a.z + b.z + c.z) / 3;
    const cap = n.y > 0.6 && y > s.belt - 0.09 && z > s.backFoot + 0.04 && z < s.screenFoot - 0.04;
    if (cap) continue;
    for (const k of [i, i + 1, i + 2]) {
      keepPos.push(pos.getX(k), pos.getY(k), pos.getZ(k));
      keepNrm.push(nrm.getX(k), nrm.getY(k), nrm.getZ(k));
    }
  }
  const open = new THREE.BufferGeometry();
  open.setAttribute('position', new THREE.Float32BufferAttribute(keepPos, 3));
  open.setAttribute('normal', new THREE.Float32BufferAttribute(keepNrm, 3));
  lower.geometry = open;
}

/** Lagos's yellow tricycle: a rounded nose, a windscreen, a canvas roof on a frame, open sides */
export function buildRideKeke(): RideVehicle {
  const body = new THREE.Group();
  body.name = 'keke';
  const { sideCurtains } = addKekeBody(body);

  const steer = buildKekeSteer();
  body.add(steer);

  const wheels: THREE.Object3D[] = [];
  const front = plainWheel(KEKE_LAYOUT.wheelRadius, 0.14);
  front.position.set(KEKE_LAYOUT.frontWheel.x, KEKE_LAYOUT.frontWheel.y, KEKE_LAYOUT.frontWheel.z);
  body.add(front);
  wheels.push(front);
  for (const side of [-1, 1]) {
    const w = plainWheel(KEKE_LAYOUT.wheelRadius, 0.16);
    w.position.set(side * KEKE_LAYOUT.rearWheel.halfTrack, KEKE_LAYOUT.rearWheel.y, KEKE_LAYOUT.rearWheel.z);
    body.add(w);
    wheels.push(w);
  }

  const driver = seatFigure(person(DRIVERS[0]), 0.9, 'bench');
  driver.root.position.set(KEKE_LAYOUT.driver.x, KEKE_LAYOUT.driver.y, KEKE_LAYOUT.driver.z);
  body.add(driver.root);
  const passenger = new THREE.Group();
  passenger.position.set(KEKE_LAYOUT.passengerL.x, KEKE_LAYOUT.passengerL.y, KEKE_LAYOUT.passengerL.z);
  body.add(passenger);
  // Someone else on the bench too
  const other = seatFigure(person({ gender: 'female', outfit: 'peplum_skirt', outfitColor: 0x0d9488, hairstyle: 'gele', skinTone: '#4a2c1d' }), 0.88, 'bench');
  other.root.position.set(KEKE_LAYOUT.passengerR.x, KEKE_LAYOUT.passengerR.y, KEKE_LAYOUT.passengerR.z);
  other.rig.leftArm.rotation.x = other.rig.rightArm.rotation.x = -0.5;
  body.add(other.root);
  // Sit-animation shoes hang below the deck — lift this figure's own verts only
  liftKekePassengerToDeck(other.root);

  return {
    body, wheels, wheelRadius: KEKE_LAYOUT.wheelRadius, steer,
    grips: [new THREE.Vector3(KEKE_LAYOUT.gripHalf, 0, 0), new THREE.Vector3(-KEKE_LAYOUT.gripHalf, 0, 0)],
    driver, passenger, hideInside: [passenger, sideCurtains],
    views: {
      // From the bench: the driver's back, his hands on the bars, Lagos through the windscreen
      inside: view([-0.42, 1.5, -0.66], [0.05, 1.12, 8], 72),
      chase: view([0, 2.9, -6.2], [0, 0.9, 4], 58),
      // From the lane beside, kept clear for it: the pavement has poles and umbrellas in the way
      side: view([5.4, 1.4, 0.1], [0, 0.95, 0], 50),
    },
    lane: 'kerb',
  };
}

/** An okada: a Boxer-type bike, the rider in his vest and helmet, the passenger behind */
export function buildRideOkada(): RideVehicle {
  const body = new THREE.Group();
  body.name = 'okada';
  addOkadaBody(body);

  const steer = buildOkadaSteer();
  body.add(steer);

  const wheels: THREE.Object3D[] = [];
  for (const axle of [OKADA_LAYOUT.frontWheel, OKADA_LAYOUT.rearWheel]) {
    const w = buildSpokedWheel(OKADA_LAYOUT.wheelRadius, 0.1);
    w.position.set(axle.x, axle.y, axle.z);
    body.add(w);
    wheels.push(w);
  }

  const driver = seatFigure(person({ gender: 'male', outfit: 'engineer_vest', outfitColor: 0x16a34a, trousersColor: 0x1e293b, hairstyle: 'short_crop', skinTone: '#3b2416' }), 0.9, 'bike');
  driver.root.position.set(OKADA_LAYOUT.driver.x, OKADA_LAYOUT.driver.y, OKADA_LAYOUT.driver.z);
  driver.root.rotation.x = OKADA_LAYOUT.driver.pitch;
  body.add(driver.root);
  body.updateMatrixWorld(true);
  helmetOn(driver.rig, 0xfacc15);
  const passenger = new THREE.Group();
  passenger.position.set(OKADA_LAYOUT.passenger.x, OKADA_LAYOUT.passenger.y, OKADA_LAYOUT.passenger.z);
  body.add(passenger);

  return {
    body, wheels, wheelRadius: OKADA_LAYOUT.wheelRadius, steer,
    grips: [new THREE.Vector3(OKADA_LAYOUT.gripHalf, 0, 0), new THREE.Vector3(-OKADA_LAYOUT.gripHalf, 0, 0)],
    driver, passenger, hideInside: [passenger],
    views: {
      // Over the rider's shoulder, from the back of the seat
      inside: view([-0.48, 1.88, -0.9], [0.08, 1.0, 8], 72),
      chase: view([0, 2.6, -5.4], [0, 0.95, 4], 58),
      side: view([4.6, 1.3, 0.05], [0, 0.95, 0], 50),
    },
    lane: 'kerb',
  };
}

/** Puts the driver's hands on the wheel or the bars, wherever they have been turned to */
export function holdOn(ride: RideVehicle): void {
  ride.body.updateMatrixWorld(true);
  const [right, left] = ride.grips;
  const at = new THREE.Vector3();
  const a = reach(ride.driver.rig, 'right', ride.steer.localToWorld(at.copy(right)));
  const b = reach(ride.driver.rig, 'left', ride.steer.localToWorld(at.copy(left)));
  ride.gripError = Math.max(a, b);
}

/** Sits the player's own figure in the passenger's place */
export function seatPassenger(ride: RideVehicle, rig: HumanRig | null, kind: 'car' | 'bike' | 'bench'): Seated | null {
  ride.passenger.clear();
  if (!rig) return null;
  const seated = seatFigure(rig, kind === 'car' ? 0.85 : 0.92, kind);
  // Hands in the lap, or on the rider's waist on a bike
  rig.leftArm.rotation.set(kind === 'bike' ? -0.9 : -0.55, 0, kind === 'bike' ? -0.2 : 0);
  rig.rightArm.rotation.set(kind === 'bike' ? -0.9 : -0.55, 0, kind === 'bike' ? 0.2 : 0);
  if (rig.leftForearm) rig.leftForearm.rotation.x = -0.5;
  if (rig.rightForearm) rig.rightForearm.rotation.x = -0.5;
  ride.passenger.add(seated.root);
  if (kind === 'bench') liftKekePassengerToDeck(seated.root);
  return seated;
}
