import * as THREE from 'three';
import { Builder } from '../world/kit/ArchKit';
import { HumanMeshBuilder, type HumanConfig, type HumanRig } from '../graphics/HumanMeshBuilder';
import { buildKitCar, plainWheel } from '../world/vehicles/KitCar';
import { bakeToGeometry } from '../graphics/MeshBaker';
import type { CarSpec } from '../world/vehicles/CarBodyKit';

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
  const body = bakeToGeometry(rig.group, { exclude: [...arms, rig.head] });
  const head = bakeToGeometry(rig.head, { space: rig.head });
  const uppers = arms.map((arm, i) => bakeToGeometry(arm, { space: arm, exclude: forearms[i] ? [forearms[i]!] : [] }));
  const lowers = forearms.map((f) => (f ? bakeToGeometry(f, { space: f }) : null));
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
  const box = new THREE.Box3().setFromObject(rig.head);
  const size = box.getSize(new THREE.Vector3());
  const top = new THREE.Vector3(0, box.max.y, 0);
  rig.head.worldToLocal(top);
  const radius = (Math.max(size.x, size.z) / rig.group.scale.x) * 0.62;
  const helmet = new THREE.Mesh(new THREE.SphereGeometry(radius, 18, 12, 0, Math.PI * 2, 0, Math.PI * 0.6), new THREE.MeshStandardMaterial({ color: colour, roughness: 0.3, metalness: 0.1 }));
  helmet.position.set(0, top.y - radius * 0.62, 0.0);
  const visor = new THREE.Mesh(new THREE.BoxGeometry(radius * 1.5, radius * 0.18, radius * 0.5), new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.4 }));
  visor.position.set(0, top.y - radius * 0.5, radius * 0.9);
  rig.head.add(helmet, visor);
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
  // Floor and roof lining
  b.box(0x26272b, s.width - 0.24, 0.04, cabinFront - cabinBack, 0, floorY, (cabinFront + cabinBack) / 2);
  b.box(taxi ? 0x6f675d : 0x7a756c, s.width * (1 - s.tumblehome) - 0.18, 0.04, s.screenTop - s.backTop - 0.1, 0, s.roof - 0.12, (s.screenTop + s.backTop) / 2);
  // The dome light and the grab handles
  b.box(0xfef9c3, 0.22, 0.03, 0.12, 0, s.roof - 0.15, (s.screenTop + s.backTop) / 2 + 0.2, { glow: true });
  for (const side of [-1, 1]) b.box(0x3f3f46, 0.03, 0.03, 0.2, side * (s.width * (1 - s.tumblehome) / 2 - 0.16), s.roof - 0.22, rearHipZ + 0.1);
  // The dashboard: the deck under the windscreen, the face toward the driver, the hood over the dials
  b.box(trim, s.width - 0.12, 0.34, 0.55, 0, s.belt - 0.32, s.screenFoot - 0.24);
  b.box(trim, s.width - 0.2, 0.3, 0.3, 0, floorY + 0.12, s.screenFoot - 0.3);
  b.box(0x101114, 0.48, 0.09, 0.22, driverX, s.belt + 0.01, dashBack + 0.1, { pitch: -0.2 });
  // Dials, the screen in the middle, the vents
  for (const dx of [-0.1, 0.1]) b.cylinder(0x9ad8ff, 0.065, 0.01, driverX + dx, s.belt - 0.12, dashBack - 0.002, { pitch: Math.PI / 2, glow: true, sides: 18 });
  b.box(0x38bdf8, 0.26, 0.15, 0.02, 0, s.belt - 0.16, dashBack - 0.01, { glow: true });
  for (const dx of [-0.42, -0.14, 0.14, 0.42]) b.box(0x0a0a0a, 0.13, 0.05, 0.02, dx * (s.width / 1.8), s.belt - 0.06, dashBack - 0.012);
  // The console between the front seats, the gear lever, the handbrake
  b.box(trim, 0.24, 0.26, 0.75, 0, floorY, hipZ + 0.3);
  b.cylinder(0x3f3f46, 0.015, 0.18, 0, floorY + 0.26, hipZ + 0.5).cylinder(0x18181b, 0.035, 0.05, 0, floorY + 0.44, hipZ + 0.5);
  // Seats: two in front, a bench behind, each with a back and a headrest
  const seat = (x: number, z: number, w: number) => {
    b.box(fabric, w, 0.13, 0.5, x, seatY - 0.13, z + 0.05);
    b.box(fabric, w, 0.64, 0.13, x, seatY - 0.02, z - 0.27, { pitch: -0.2 });
  };
  seat(driverX, hipZ, 0.5);
  seat(-driverX, hipZ, 0.5);
  for (const x of [driverX, -driverX]) b.box(fabric, 0.24, 0.16, 0.1, x, seatY + 0.66, hipZ - 0.42, { pitch: -0.2 });
  seat(0, rearHipZ, s.width - 0.36);
  // Door cards with an armrest and a handle, one each side
  for (const side of [-1, 1]) {
    const x = side * (s.width / 2 - 0.2);
    b.box(trim, 0.05, s.belt - floorY - 0.02, cabinFront - cabinBack - 0.1, x, floorY, (cabinFront + cabinBack) / 2);
    b.box(fabric, 0.1, 0.05, 0.6, x - side * 0.05, seatY + 0.2, hipZ + 0.05);
    b.box(0xd4d4d8, 0.03, 0.03, 0.12, x - side * 0.03, s.belt - 0.12, hipZ + 0.4);
  }
  // The sills along the bottom of the windows, from the door cards out to the body
  for (const side of [-1, 1]) b.box(trim, 0.24, 0.035, cabinFront - cabinBack + 0.2, side * (s.width / 2 - 0.13), s.belt - 0.04, (cabinFront + cabinBack) / 2);
  // The mirror, and the rosary and the little green tree hanging from it
  b.box(0x18181b, 0.03, 0.08, 0.03, 0, s.roof - 0.2, s.screenTop - 0.05);
  b.box(0x111111, 0.26, 0.075, 0.035, 0, s.roof - 0.27, s.screenTop - 0.08);
  for (let i = 0; i < 7; i++) b.box(0x7c2d12, 0.016, 0.016, 0.016, -0.03 + Math.abs(i - 3) * 0.012 * (i < 3 ? -1 : 1), s.roof - 0.3 - Math.min(i, 6 - i) * 0.03, s.screenTop - 0.08);
  b.box(0x16a34a, 0.035, 0.05, 0.006, 0.05, s.roof - 0.4, s.screenTop - 0.08);
  // Sun visors
  for (const x of [driverX, -driverX]) b.box(trim, 0.42, 0.02, 0.18, x, s.roof - 0.16, s.screenTop - 0.14);
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

  const eye = seatY + (tall ? 0.78 : 0.72);
  return {
    body, wheels: car.wheels, wheelRadius: s.wheelRadius, steer,
    grips: [new THREE.Vector3(0.155, 0.06, 0.0), new THREE.Vector3(-0.155, 0.06, 0.0)],
    driver, passenger, hideInside: [passenger],
    views: {
      // From the back seat, between the front seats: the driver at the wheel, the road through the windscreen
      inside: view([-0.05, eye + 0.06, rearHipZ + 0.2], [driverX * 2, eye - 0.3, 7], 70),
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

const YELLOW = 0xf6c90e;
const GREEN = 0x15803d;

/** Lagos's yellow tricycle: a rounded nose, a windscreen, a canvas roof on a frame, open sides */
export function buildRideKeke(): RideVehicle {
  const body = new THREE.Group();
  const b = new Builder();
  // The nose, as a side profile pushed out to its width and rounded off
  const nose = new THREE.Shape();
  nose.moveTo(0.72, 0.36);
  nose.lineTo(1.3, 0.36);
  nose.quadraticCurveTo(1.46, 0.42, 1.44, 0.66);
  nose.quadraticCurveTo(1.4, 0.95, 1.12, 1.06);
  nose.lineTo(0.72, 1.08);
  nose.lineTo(0.72, 0.36);
  const noseGeo = new THREE.ExtrudeGeometry(nose, { depth: 0.8, bevelEnabled: true, bevelThickness: 0.07, bevelSize: 0.06, bevelSegments: 3, curveSegments: 10 });
  noseGeo.translate(0, 0, -0.4);
  noseGeo.rotateY(-Math.PI / 2);
  b.shape(YELLOW, noseGeo, 0, 0, 0);
  // The floor, the sills down the sides with their green stripe, the body over the engine at the back
  b.box(0x1f2937, 1.22, 0.06, 2.1, 0, 0.34, -0.2);
  for (const side of [-1, 1]) {
    b.box(YELLOW, 0.06, 0.34, 1.75, side * 0.62, 0.36, -0.15);
    b.box(GREEN, 0.065, 0.08, 1.75, side * 0.62, 0.56, -0.15);
    // The back quarters, canvas, from the sill to the roof
    b.box(0x16161a, 0.04, 1.0, 0.55, side * 0.645, 0.7, -1.02);
  }
  b.box(YELLOW, 1.32, 0.66, 0.46, 0, 0.36, -1.12);
  b.box(GREEN, 1.33, 0.08, 0.47, 0, 0.82, -1.12);
  // The back wall, canvas, with its little window
  b.box(0x16161a, 1.3, 0.66, 0.04, 0, 1.02, -1.33);
  b.box(0x0f172a, 0.6, 0.24, 0.05, 0, 1.3, -1.33);
  // Tail lamps and the number plate
  for (const side of [-1, 1]) b.box(0xef4444, 0.16, 0.08, 0.03, side * 0.52, 0.86, -1.36, { glow: true });
  b.box(0xf8fafc, 0.34, 0.12, 0.02, 0, 0.5, -1.36);
  // The frame that carries the roof: posts at the corners, rails along the top
  for (const side of [-1, 1]) {
    b.cylinder(0x27272a, 0.022, 0.62, side * 0.6, 1.07, 0.86);
    b.cylinder(0x27272a, 0.022, 0.98, side * 0.63, 0.7, -0.76);
    // A rolled-up side curtain under the roof's edge
    b.tube(0x16161a, 0.05, 0.05, 1.5, side * 0.63, 1.62, 0.02, { yaw: Math.PI / 2, sides: 10 });
  }
  // The windscreen's frame
  b.box(0x18181b, 1.0, 0.05, 0.05, 0, 1.06, 0.98).box(0x18181b, 1.0, 0.05, 0.05, 0, 1.66, 0.86);
  for (const side of [-1, 1]) b.box(0x18181b, 0.05, 0.62, 0.05, side * 0.5, 1.06, 0.92, { pitch: -0.18 });
  // Seats: the driver's saddle, the bench for three behind
  b.box(0x111111, 0.5, 0.11, 0.42, 0, 0.62, 0.3).box(0x111111, 0.42, 0.22, 0.06, 0, 0.8, 0.07, { pitch: -0.15 });
  b.box(0x1c1c1f, 1.16, 0.13, 0.46, 0, 0.56, -0.62).box(0x1c1c1f, 1.16, 0.48, 0.1, 0, 0.7, -0.9, { pitch: -0.15 });
  // The headlamp on the nose, the indicators, the mudguard over the front wheel
  b.cylinder(0xd4d4d8, 0.13, 0.05, 0, 0.62, 1.48, { pitch: Math.PI / 2, sides: 20 });
  b.cylinder(0xfffbe6, 0.1, 0.02, 0, 0.62, 1.5, { pitch: Math.PI / 2, glow: true, sides: 20 });
  for (const side of [-1, 1]) b.box(0xf59e0b, 0.08, 0.05, 0.04, side * 0.32, 0.88, 1.4, { glow: true });
  b.box(YELLOW, 0.24, 0.05, 0.5, 0, 0.6, 1.12);
  b.box(0x9ca3af, 0.05, 0.42, 0.05, 0.1, 0.2, 1.12).box(0x9ca3af, 0.05, 0.42, 0.05, -0.1, 0.2, 1.12);
  // A sticker in the back window
  b.box(0xfacc15, 0.18, 0.06, 0.055, 0, 1.38, -1.33);
  body.add(b.build('keke', { roughness: 0.45, metalness: 0.15 }));

  // The canvas roof, curved, seen from under it as well as over it
  const roofGeo = new THREE.CylinderGeometry(0.69, 0.69, 2.4, 18, 1, true, -Math.PI / 2, Math.PI);
  roofGeo.rotateX(-Math.PI / 2);
  roofGeo.scale(1, 0.3, 1);
  const roof = new THREE.Mesh(roofGeo, new THREE.MeshStandardMaterial({ color: 0x18181b, roughness: 0.95, side: THREE.DoubleSide }));
  roof.position.set(0, 1.68, -0.24);
  body.add(roof);
  const glass = new THREE.Mesh(new THREE.PlaneGeometry(0.96, 0.6), new THREE.MeshStandardMaterial({ color: 0xbfe3ff, transparent: true, opacity: 0.18, roughness: 0.05, metalness: 0.2, side: THREE.DoubleSide, depthWrite: false }));
  glass.position.set(0, 1.37, 0.92);
  glass.rotation.x = -0.18;
  body.add(glass);

  // The handlebars on their column, turning about it
  const steer = new THREE.Group();
  steer.position.set(0, 1.02, 0.74);
  steer.rotation.x = -0.35;
  const chrome = new THREE.MeshStandardMaterial({ color: 0xd4d4d8, metalness: 0.9, roughness: 0.25 });
  const grip = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.8 });
  const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.66, 8), chrome);
  bar.rotation.z = Math.PI / 2;
  steer.add(bar);
  for (const side of [-1, 1]) {
    const g = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.12, 8), grip);
    g.rotation.z = Math.PI / 2;
    g.position.x = side * 0.3;
    steer.add(g);
  }
  const pod = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.1, 0.08), grip);
  pod.position.set(0, 0.04, 0.04);
  steer.add(pod);
  body.add(steer);

  const wheels: THREE.Object3D[] = [];
  const front = plainWheel(0.25, 0.14);
  front.position.set(0, 0.25, 1.12);
  body.add(front);
  wheels.push(front);
  for (const side of [-1, 1]) {
    const w = plainWheel(0.25, 0.16);
    w.position.set(side * 0.6, 0.25, -0.78);
    body.add(w);
    wheels.push(w);
  }

  const driver = seatFigure(person(DRIVERS[0]), 0.9, 'bench');
  driver.root.position.set(0, 0.74, 0.3);
  body.add(driver.root);
  const passenger = new THREE.Group();
  passenger.position.set(-0.3, 0.7, -0.62);
  body.add(passenger);
  // Someone else on the bench too
  const other = seatFigure(person({ gender: 'female', outfit: 'peplum_skirt', outfitColor: 0x0d9488, hairstyle: 'gele', skinTone: '#4a2c1d' }), 0.88, 'bench');
  other.root.position.set(0.34, 0.7, -0.62);
  other.rig.leftArm.rotation.x = other.rig.rightArm.rotation.x = -0.5;
  body.add(other.root);

  return {
    body, wheels, wheelRadius: 0.25, steer,
    grips: [new THREE.Vector3(0.29, 0, 0), new THREE.Vector3(-0.29, 0, 0)],
    driver, passenger, hideInside: [passenger],
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
  const b = new Builder();
  const RED = 0xb91c1c;
  // The engine, its fins, the exhaust down the right side
  b.box(0x52525b, 0.26, 0.3, 0.38, 0, 0.26, 0.06);
  for (let i = 0; i < 4; i++) b.box(0x71717a, 0.3, 0.02, 0.2, 0, 0.36 + i * 0.05, 0.2);
  b.tube(0xd4d4d8, 0.035, 0.035, 0.9, -0.15, 0.3, -0.3, { yaw: Math.PI / 2, sides: 10 });
  b.tube(0xd4d4d8, 0.05, 0.05, 0.32, -0.15, 0.36, -0.62, { yaw: Math.PI / 2, sides: 12 });
  // The frame from the headstock down to the engine, and under the seat
  b.box(0x18181b, 0.06, 0.06, 0.62, 0, 0.55, 0.32, { pitch: 0.75 });
  b.box(0x18181b, 0.05, 0.05, 0.8, 0, 0.68, -0.32, { pitch: -0.1 });
  // The tank, the side panels, the long seat, the carrier
  const tank = new THREE.SphereGeometry(0.2, 16, 12);
  tank.scale(0.95, 0.7, 1.6);
  b.shape(RED, tank, 0, 0.86, 0.24);
  b.box(0xf8fafc, 0.02, 0.05, 0.16, 0.18, 0.84, 0.24);
  b.box(0xf8fafc, 0.02, 0.05, 0.16, -0.18, 0.84, 0.24);
  b.box(RED, 0.24, 0.2, 0.36, 0, 0.62, -0.2);
  b.box(0x0c0c0e, 0.27, 0.09, 0.82, 0, 0.8, -0.3);
  b.box(0xa1a1aa, 0.3, 0.03, 0.34, 0, 0.88, -0.8);
  // Mudguards, the tail lamp, the plate, the footrests
  b.box(0x18181b, 0.14, 0.03, 0.42, 0, 0.6, -0.68, { pitch: 0.25 });
  b.box(0x18181b, 0.12, 0.03, 0.36, 0, 0.58, 0.72, { pitch: -0.2 });
  b.box(0xef4444, 0.1, 0.05, 0.04, 0, 0.82, -0.98, { glow: true });
  b.box(0xf8fafc, 0.2, 0.1, 0.01, 0, 0.66, -0.94);
  for (const side of [-1, 1]) b.box(0x27272a, 0.14, 0.025, 0.04, side * 0.17, 0.3, 0.05).box(0x27272a, 0.12, 0.025, 0.04, side * 0.16, 0.36, -0.42);
  // The forks up to the lamp
  for (const side of [-1, 1]) b.box(0xa1a1aa, 0.035, 0.66, 0.035, side * 0.07, 0.3, 0.62, { pitch: -0.42 });
  b.box(0x18181b, 0.24, 0.2, 0.16, 0, 0.88, 0.56).cylinder(0xfffbe6, 0.07, 0.02, 0, 0.98, 0.64, { pitch: Math.PI / 2, glow: true, sides: 16 });
  body.add(b.build('okada', { roughness: 0.4, metalness: 0.3 }));

  const steer = new THREE.Group();
  steer.position.set(0, 1.08, 0.5);
  steer.rotation.x = -0.4;
  const chrome = new THREE.MeshStandardMaterial({ color: 0xd4d4d8, metalness: 0.9, roughness: 0.25 });
  const grip = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.8 });
  const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.72, 8), chrome);
  bar.rotation.z = Math.PI / 2;
  steer.add(bar);
  for (const side of [-1, 1]) {
    const g = new THREE.Mesh(new THREE.CylinderGeometry(0.019, 0.019, 0.12, 8), grip);
    g.rotation.z = Math.PI / 2;
    g.position.x = side * 0.33;
    const stalk = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.26, 6), chrome);
    stalk.position.set(side * 0.24, 0.13, 0);
    const mirror = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.015, 12), grip);
    mirror.rotation.x = Math.PI / 2;
    mirror.position.set(side * 0.25, 0.27, 0);
    steer.add(g, stalk, mirror);
  }
  body.add(steer);

  const wheels: THREE.Object3D[] = [];
  for (const z of [0.68, -0.64]) {
    const w = plainWheel(0.3, 0.1);
    w.position.set(0, 0.3, z);
    body.add(w);
    wheels.push(w);
  }

  const driver = seatFigure(person({ gender: 'male', outfit: 'engineer_vest', outfitColor: 0x16a34a, trousersColor: 0x1e293b, hairstyle: 'short_crop', skinTone: '#3b2416' }), 0.9, 'bike');
  driver.root.position.set(0, 0.88, -0.03);
  driver.root.rotation.x = 0.12;
  body.add(driver.root);
  body.updateMatrixWorld(true);
  helmetOn(driver.rig, 0xfacc15);
  const passenger = new THREE.Group();
  passenger.position.set(0, 0.92, -0.52);
  body.add(passenger);

  return {
    body, wheels, wheelRadius: 0.3, steer,
    grips: [new THREE.Vector3(0.32, 0, 0), new THREE.Vector3(-0.32, 0, 0)],
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
  return seated;
}
