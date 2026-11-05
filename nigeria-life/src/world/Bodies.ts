import * as THREE from 'three';

/**
 * The people and vehicles in the street, as things that take up room. Buildings and walls are
 * in `Solids`; these move, so whoever owns them says where they are at the moment of asking.
 *
 * A person is a circle on the ground. A vehicle is a box turned to its heading.
 */

export interface PersonBody {
  x: number;
  z: number;
  r: number;
}

export interface CarBody {
  x: number;
  z: number;
  /** Heading: 0 faces +z */
  yaw: number;
  halfWidth: number;
  halfLength: number;
  /** Standing still where it is (a parked car): someone on foot walks round it */
  parked?: boolean;
  /** Pulling over for a siren (a convoy coming through) */
  yielding?: boolean;
}

export interface BodySource {
  /** People within `range` of a point, written into `out` (which is emptied first) */
  people?(x: number, z: number, range: number, out: PersonBody[]): void;
  /** Vehicles within `range` of a point, written into `out` (which is NOT emptied: sources add to it) */
  cars?(x: number, z: number, range: number, out: CarBody[]): void;
}

const sources: BodySource[] = [];
const people: PersonBody[] = [];
const scratchPeople: PersonBody[] = [];
const cars: CarBody[] = [];

export const Bodies = {
  add(source: BodySource): void {
    if (!sources.includes(source)) sources.push(source);
  },
  remove(source: BodySource): void {
    const i = sources.indexOf(source);
    if (i >= 0) sources.splice(i, 1);
  },
  /** Everyone near a point. The array is reused: read it before asking again. */
  peopleNear(x: number, z: number, range: number): readonly PersonBody[] {
    people.length = 0;
    for (const source of sources) {
      if (!source.people) continue;
      source.people(x, z, range, scratchPeople);
      for (const p of scratchPeople) people.push(p);
    }
    return people;
  },
  /** Every vehicle near a point. The array is reused: read it before asking again. */
  carsNear(x: number, z: number, range: number): readonly CarBody[] {
    cars.length = 0;
    for (const source of sources) source.cars?.(x, z, range, cars);
    return cars;
  },
};

/**
 * Where a circle of radius `r` at (x, z) ends up once moved out of a vehicle's box, or null if it
 * does not touch it. It is moved the shortest way out.
 */
export function outOfCar(x: number, z: number, r: number, car: CarBody): { x: number; z: number } | null {
  const c = Math.cos(car.yaw);
  const s = Math.sin(car.yaw);
  const dx = x - car.x;
  const dz = z - car.z;
  // Into the car's own frame: `side` across it, `along` from tail to nose
  const side = dx * c - dz * s;
  const along = dx * s + dz * c;
  const w = car.halfWidth + r;
  const l = car.halfLength + r;
  if (Math.abs(side) >= w || Math.abs(along) >= l) return null;
  // Round the corners a little, so a person slides off a bumper instead of catching on it
  const overSide = w - Math.abs(side);
  const overAlong = l - Math.abs(along);
  let ns = side;
  let na = along;
  if (overSide < overAlong) ns = Math.sign(side || 1) * w;
  else na = Math.sign(along || 1) * l;
  return { x: car.x + ns * c + na * s, z: car.z - ns * s + na * c };
}

/** Does a circle at (x, z) overlap this vehicle? */
export function touchesCar(x: number, z: number, r: number, car: CarBody): boolean {
  const c = Math.cos(car.yaw);
  const s = Math.sin(car.yaw);
  const dx = x - car.x;
  const dz = z - car.z;
  return Math.abs(dx * c - dz * s) < car.halfWidth + r && Math.abs(dx * s + dz * c) < car.halfLength + r;
}

/** Where a circle of radius `r` at (x, z) ends up once moved out of a person, or null if clear. */
export function outOfPerson(x: number, z: number, r: number, person: PersonBody): { x: number; z: number } | null {
  const dx = x - person.x;
  const dz = z - person.z;
  const min = r + person.r;
  const d2 = dx * dx + dz * dz;
  if (d2 >= min * min) return null;
  const d = Math.sqrt(d2);
  if (d < 1e-4) return { x: person.x + min, z: person.z };
  return { x: person.x + (dx / d) * min, z: person.z + (dz / d) * min };
}

/** Depth of a circle at (x, z) inside a vehicle's box: 0 when it does not touch */
export function depthIntoCar(x: number, z: number, r: number, car: CarBody): number {
  const c = Math.cos(car.yaw);
  const s = Math.sin(car.yaw);
  const dx = x - car.x;
  const dz = z - car.z;
  const overSide = car.halfWidth + r - Math.abs(dx * c - dz * s);
  const overAlong = car.halfLength + r - Math.abs(dx * s + dz * c);
  return overSide > 0 && overAlong > 0 ? Math.min(overSide, overAlong) : 0;
}

export interface Outline {
  /** Width and length */
  w: number;
  l: number;
  /** Where its middle is from its origin, with it facing +z */
  cx: number;
  cz: number;
}

const outlines = new WeakMap<THREE.Object3D, Outline>();

/** The size of a vehicle on the ground, measured once with it facing +z (light cones and glows left out) */
export function outlineOf(object: THREE.Object3D): Outline {
  let outline = outlines.get(object);
  if (outline) return outline;
  const yaw = object.rotation.y;
  const shown = object.visible;
  object.rotation.y = 0;
  object.visible = true;
  object.updateMatrixWorld(true);
  const box = new THREE.Box3();
  const part = new THREE.Box3();
  // Hidden parts (a horn sign over the roof) are not the vehicle
  object.traverseVisible((child) => {
    const mesh = child as THREE.Mesh;
    if (!mesh.isMesh || !mesh.geometry) return;
    const material = (Array.isArray(mesh.material) ? mesh.material[0] : mesh.material) as THREE.MeshBasicMaterial;
    if (material?.transparent && material.opacity < 0.6) return;
    if (!mesh.geometry.boundingBox) mesh.geometry.computeBoundingBox();
    part.copy(mesh.geometry.boundingBox!).applyMatrix4(mesh.matrixWorld);
    box.union(part);
  });
  object.rotation.y = yaw;
  object.visible = shown;
  object.updateMatrixWorld(true);
  const at = object.getWorldPosition(new THREE.Vector3());
  outline = box.isEmpty()
    ? { w: 1.9, l: 4.4, cx: 0, cz: 0 }
    : { w: Math.min(3, box.max.x - box.min.x), l: Math.min(13, box.max.z - box.min.z), cx: (box.min.x + box.max.x) / 2 - at.x, cz: (box.min.z + box.max.z) / 2 - at.z };
  outlines.set(object, outline);
  return outline;
}

/** A vehicle's box on the ground where it stands now (or at another spot and heading) */
export function bodyOf(object: THREE.Object3D, into: CarBody, x = object.position.x, z = object.position.z, yaw = object.rotation.y): CarBody {
  const o = outlineOf(object);
  into.x = x + o.cx * Math.cos(yaw) + o.cz * Math.sin(yaw);
  into.z = z - o.cx * Math.sin(yaw) + o.cz * Math.cos(yaw);
  into.yaw = yaw;
  into.halfWidth = o.w / 2;
  into.halfLength = o.l / 2;
  return into;
}

/**
 * The ways round a standing vehicle from A to B on foot, keeping `clear` metres from its sides:
 * each a list of corners to walk to, the shorter first. Empty if the straight line from A to B
 * does not touch the vehicle.
 */
export function waysRoundCar(ax: number, az: number, bx: number, bz: number, car: CarBody, clear: number): Array<Array<{ x: number; z: number }>> {
  const c = Math.cos(car.yaw);
  const s = Math.sin(car.yaw);
  const local = (x: number, z: number) => ({ u: (x - car.x) * c - (z - car.z) * s, v: (x - car.x) * s + (z - car.z) * c });
  const world = (u: number, v: number) => ({ x: car.x + u * c + v * s, z: car.z - u * s + v * c });
  // Someone already close beside it goes round it as close as they are
  const startAt = local(ax, az);
  const outside = Math.max(Math.abs(startAt.u) - car.halfWidth, Math.abs(startAt.v) - car.halfLength);
  if (outside <= 0.02) return [];
  const room = Math.min(clear, outside - 0.02);
  const W = car.halfWidth + room;
  const L = car.halfLength + room;
  /** Does the line from p to q pass through the box (shrunk a little, so walking along its edge is not "through")? */
  const crosses = (p: { u: number; v: number }, q: { u: number; v: number }, shrink = 0.05) => {
    const w = W - shrink;
    const l = L - shrink;
    let t0 = 0;
    let t1 = 1;
    const du = q.u - p.u;
    const dv = q.v - p.v;
    for (const [d, lo, hi, at] of [[du, -w, w, p.u], [dv, -l, l, p.v]] as Array<[number, number, number, number]>) {
      if (Math.abs(d) < 1e-9) {
        if (at <= lo || at >= hi) return false;
        continue;
      }
      let ta = (lo - at) / d;
      let tb = (hi - at) / d;
      if (ta > tb) [ta, tb] = [tb, ta];
      t0 = Math.max(t0, ta);
      t1 = Math.min(t1, tb);
      if (t0 >= t1) return false;
    }
    return true;
  };
  const A = local(ax, az);
  const B = local(bx, bz);
  if (!crosses(A, B)) return [];
  const corners = [{ u: W, v: L }, { u: -W, v: L }, { u: -W, v: -L }, { u: W, v: -L }];
  const ways: Array<{ points: Array<{ u: number; v: number }>; length: number }> = [];
  for (const dir of [1, -1]) {
    // Start at the nearest corner that can be walked to straight
    let start = -1;
    let best = Infinity;
    corners.forEach((k, i) => {
      if (crosses(A, k)) return;
      const d = Math.hypot(k.u - A.u, k.v - A.v);
      if (d < best) {
        best = d;
        start = i;
      }
    });
    if (start < 0) continue;
    const points = [corners[start]];
    let i = start;
    for (let n = 0; n < 3 && crosses(corners[i], B); n++) {
      i = (i + dir + 4) % 4;
      points.push(corners[i]);
    }
    let length = Math.hypot(points[0].u - A.u, points[0].v - A.v);
    for (let k = 1; k < points.length; k++) length += Math.hypot(points[k].u - points[k - 1].u, points[k].v - points[k - 1].v);
    length += Math.hypot(B.u - points[points.length - 1].u, B.v - points[points.length - 1].v);
    ways.push({ points, length });
  }
  ways.sort((a, b) => a.length - b.length);
  return ways.map((way) => way.points.map((p) => world(p.u, p.v)));
}
