import * as THREE from 'three';
import { MAIN_ROAD, SIDE_STREETS, MAIN_JUNCTION_GAPS, splitAroundJunctions, type SideStreet } from '../density/StreetLayout';

/**
 * The city plan: what each piece of ground in Lagos is for.
 *
 * Roads, walkways, building plots and public ground are separate things with separate rules,
 * and everything that puts something in the city (the hand-built landmarks, the generated
 * streets of tenements, and what players build on their own land) is checked against the
 * same plan:
 *
 *   1. nothing permanent stands on a carriageway;
 *   2. every walkway keeps a clear way through, however many stalls and bus stops are on it;
 *   3. buildings do not overlap each other;
 *   4. every door opens onto ground a person can reach on foot;
 *   5. what a player builds stays inside their plot.
 *
 * Coordinates are world metres, x east-west and z north-south, as everywhere else in the game.
 */

export interface Rect {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

export type ZoneKind = 'carriageway' | 'walkway';

export interface Zone extends Rect {
  id: string;
  kind: ZoneKind;
  /** The street it belongs to */
  street: string;
  /** Which way the street runs */
  axis: 'x' | 'z';
  /** How wide a way through must stay clear along its whole length */
  clear: number;
}

/** Something standing on the ground that a person or a car cannot pass through. */
export interface Obstruction extends Rect {
  /** What it belongs to, for reports */
  owner: string;
  /** A building body, as opposed to a stall, a pole, a bin or a bus shelter */
  structure: boolean;
  height: number;
}

export const rectArea = (r: Rect) => Math.max(0, r.maxX - r.minX) * Math.max(0, r.maxZ - r.minZ);

export function intersection(a: Rect, b: Rect): Rect | null {
  const minX = Math.max(a.minX, b.minX);
  const maxX = Math.min(a.maxX, b.maxX);
  const minZ = Math.max(a.minZ, b.minZ);
  const maxZ = Math.min(a.maxZ, b.maxZ);
  return maxX > minX && maxZ > minZ ? { minX, maxX, minZ, maxZ } : null;
}

export const contains = (outer: Rect, inner: Rect, slack = 0) =>
  inner.minX >= outer.minX - slack && inner.maxX <= outer.maxX + slack && inner.minZ >= outer.minZ - slack && inner.maxZ <= outer.maxZ + slack;

export const grow = (r: Rect, by: number): Rect => ({ minX: r.minX - by, maxX: r.maxX + by, minZ: r.minZ - by, maxZ: r.maxZ + by });

/** How wide a clear way a back-street walkway must keep: two people passing. */
export const CLEAR_WALKWAY = 1.2;
/** Broad Street's pavements carry crowds: twice that */
export const CLEAR_MAIN_WALKWAY = 2.0;
/** A lane of traffic. Every road keeps at least this much open, whatever is parked or set up on it. */
export const CLEAR_LANE = 3.2;
/** How far a building must stand back from the edge of its plot */
export const SETBACK = 1.0;

function streetRect(axis: 'x' | 'z', fixed: number, from: number, to: number, inner: number, outer: number): Rect {
  const lo = Math.min(inner, outer);
  const hi = Math.max(inner, outer);
  return axis === 'z'
    ? { minX: fixed + lo, maxX: fixed + hi, minZ: from, maxZ: to }
    : { minX: from, maxX: to, minZ: fixed + lo, maxZ: fixed + hi };
}

/** Removes the stretches in `cuts` from [from, to], leaving the pieces between them. */
function without(from: number, to: number, cuts: Array<[number, number]>): Array<[number, number]> {
  const out: Array<[number, number]> = [];
  let start = from;
  for (const [a, b] of [...cuts].sort((p, q) => p[0] - q[0])) {
    if (b <= start || a >= to) continue;
    if (a > start) out.push([start, a]);
    start = Math.max(start, b);
  }
  if (start < to) out.push([start, to]);
  return out.filter(([a, b]) => b - a > 0.5);
}

/** Where a side street's pavements stop because another street crosses: its own pavement gives way to the crossing. */
function crossings(st: SideStreet): Array<[number, number]> {
  const cuts: Array<[number, number]> = [];
  // Broad Street runs north-south down the middle. Its corridor reaches a little past its ends.
  if (st.axis === 'x' && st.fixed > MAIN_ROAD.zMin - 9 && st.fixed < MAIN_ROAD.zMax + 1) {
    const half = MAIN_ROAD.halfRoad + MAIN_ROAD.walk;
    cuts.push([-half, half]);
  }
  for (const other of SIDE_STREETS) {
    if (other === st || other.axis === st.axis) continue;
    // Does the other street reach as far as this one?
    if (st.fixed < other.from - other.halfRoad || st.fixed > other.to + other.halfRoad) continue;
    const half = other.halfRoad + other.walk;
    cuts.push([other.fixed - half, other.fixed + half]);
  }
  return cuts;
}

function zonesForSideStreet(st: SideStreet): Zone[] {
  const zones: Zone[] = [
    {
      id: `${st.id}:road`, kind: 'carriageway', street: st.name, axis: st.axis, clear: Math.min(CLEAR_LANE, st.halfRoad * 2 - 0.5),
      ...streetRect(st.axis, st.fixed, st.from, st.to, -st.halfRoad, st.halfRoad),
    },
  ];
  const pieces = without(st.from, st.to, crossings(st));
  pieces.forEach(([from, to], part) => {
    for (const sign of [-1, 1]) {
      zones.push({
        id: `${st.id}:walk:${sign < 0 ? 'a' : 'b'}:${part}`, kind: 'walkway', street: st.name, axis: st.axis, clear: CLEAR_WALKWAY,
        ...streetRect(st.axis, st.fixed, from, to, sign * st.halfRoad, sign * (st.halfRoad + st.walk)),
      });
    }
  });
  return zones;
}

/** The streets of Lagos Island as zones. Read from the one street layout everything else uses. */
export function lagosZones(): Zone[] {
  const zones: Zone[] = [
    { id: 'broad:road', kind: 'carriageway', street: 'Broad Street', axis: 'z', clear: CLEAR_LANE * 2, minX: -MAIN_ROAD.halfRoad, maxX: MAIN_ROAD.halfRoad, minZ: MAIN_ROAD.zMin, maxZ: MAIN_ROAD.zMax },
  ];
  // Broad Street's pavements stop for the junction and start again on the far side
  let part = 0;
  for (const [from, to] of splitAroundJunctions(MAIN_ROAD.zMin, MAIN_ROAD.zMax)) {
    for (const sign of [-1, 1]) {
      zones.push({
        id: `broad:walk:${sign < 0 ? 'west' : 'east'}:${part}`, kind: 'walkway', street: 'Broad Street', axis: 'z', clear: CLEAR_MAIN_WALKWAY,
        ...streetRect('z', 0, from, to, sign * MAIN_ROAD.halfRoad, sign * (MAIN_ROAD.halfRoad + MAIN_ROAD.walk)),
      });
    }
    part++;
  }
  for (const st of SIDE_STREETS) zones.push(...zonesForSideStreet(st));
  return zones;
}

export const JUNCTION_GAPS = MAIN_JUNCTION_GAPS;

/** One straight avenue with a verge either side: the shape of Abuja's and Port Harcourt's main roads. */
function avenue(id: string, street: string, halfRoad: number, walk: number, half: number): Zone[] {
  return [
    { id: `${id}:road`, kind: 'carriageway', street, axis: 'z', clear: CLEAR_LANE * 2, minX: -halfRoad, maxX: halfRoad, minZ: -half, maxZ: half },
    { id: `${id}:walk:west`, kind: 'walkway', street, axis: 'z', clear: CLEAR_WALKWAY, minX: -halfRoad - walk, maxX: -halfRoad, minZ: -half, maxZ: half },
    { id: `${id}:walk:east`, kind: 'walkway', street, axis: 'z', clear: CLEAR_WALKWAY, minX: halfRoad, maxX: halfRoad + walk, minZ: -half, maxZ: half },
  ];
}

/** The streets of a city, as zones. */
export function zonesFor(city: string): Zone[] {
  if (city === 'abuja') return avenue('shagari', 'Shehu Shagari Way', 10, 3, 130);
  if (city === 'port_harcourt') return avenue('aba', 'Aba Road', 9, 3.5, 130);
  return lagosZones();
}

// ================================================================================================
// What is standing on the ground
// ================================================================================================

const scratch = new THREE.Box3();
const instanceMatrix = new THREE.Matrix4();

/** Does a box this shape stop someone walking? Paving, kerbs and anything overhead do not. */
function blocksTheWay(min: THREE.Vector3, max: THREE.Vector3): boolean {
  // Its top is above the knee and its underside is below the head
  return max.y > 0.6 && min.y < 1.6;
}

function addBox(out: Obstruction[], box: THREE.Box3, owner: string): void {
  if (!blocksTheWay(box.min, box.max)) return;
  const width = box.max.x - box.min.x;
  const depth = box.max.z - box.min.z;
  if (width > 150 || depth > 150) return; // sky domes, terrain skirts
  const height = box.max.y - Math.max(0, box.min.y);
  out.push({
    owner,
    minX: box.min.x, maxX: box.max.x, minZ: box.min.z, maxZ: box.max.z,
    height,
    // A body with walls: big enough to stand inside and taller than a person
    structure: width * depth >= 9 && Math.min(width, depth) >= 2 && height >= 2.4 && box.min.y < 0.9,
  });
}

/**
 * Everything under `root` that stands on the ground, as boxes. Each direct child of `root` is
 * taken to be one thing (one building, one stall) unless `owner` names the whole lot.
 */
export function obstructionsUnder(root: THREE.Object3D, label: string, owner?: (child: THREE.Object3D, index: number) => string): Obstruction[] {
  root.updateWorldMatrix(true, true);
  return obstructionsOf(root.children, label, owner);
}

/** The same, for a chosen set of things. Their world matrices must be up to date. */
export function obstructionsOf(things: THREE.Object3D[], label: string, owner?: (child: THREE.Object3D, index: number) => string): Obstruction[] {
  const out: Obstruction[] = [];
  things.forEach((child, index) => {
    const name = owner ? owner(child, index) : child.name || `${label} #${index} near (${Math.round(child.position.x)}, ${Math.round(child.position.z)})`;
    child.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (!mesh.isMesh || !mesh.geometry || !mesh.visible) return;
      // Part of the ground itself (a speed bump), or trim fixed to a wall (awnings, cornices, signs)
      if (mesh.userData.surface || mesh.name.startsWith('facade_')) return;
      if (!mesh.geometry.boundingBox) mesh.geometry.computeBoundingBox();
      const local = mesh.geometry.boundingBox!;
      const instanced = obj as THREE.InstancedMesh;
      if (instanced.isInstancedMesh) {
        for (let i = 0; i < instanced.count; i++) {
          instanced.getMatrixAt(i, instanceMatrix);
          instanceMatrix.premultiply(mesh.matrixWorld);
          scratch.copy(local).applyMatrix4(instanceMatrix);
          addBox(out, scratch, name);
        }
        return;
      }
      scratch.copy(local).applyMatrix4(mesh.matrixWorld);
      addBox(out, scratch, name);
    });
  });
  return out;
}

/** The outline of a building: the box round all of its bodies. */
export function footprintOf(parts: Obstruction[]): Rect | null {
  const bodies = parts.filter((part) => part.structure);
  if (bodies.length === 0) return null;
  return {
    minX: Math.min(...bodies.map((b) => b.minX)),
    maxX: Math.max(...bodies.map((b) => b.maxX)),
    minZ: Math.min(...bodies.map((b) => b.minZ)),
    maxZ: Math.max(...bodies.map((b) => b.maxZ)),
  };
}

// ================================================================================================
// Checking
// ================================================================================================

export type Rule = 'building-on-road' | 'walkway-blocked' | 'buildings-overlap' | 'door-unreachable' | 'outside-plot' | 'road-cut';

export interface Violation {
  rule: Rule;
  /** Who is at fault, in words */
  what: string;
  /** Where to go and look */
  at: { x: number; z: number };
  detail: string;
}

export interface PlanInput {
  zones: Zone[];
  obstructions: Obstruction[];
  /** Doors and entrances that people must be able to walk to */
  doors: Array<{ name: string; x: number; z: number }>;
  /** A point known to be on open walkable ground, to measure reachability from */
  start: { x: number; z: number };
  /** Stretches of planned road that were never laid, because something was in the way */
  roadGaps?: Array<{ street: string; from: number; to: number; axis: 'x' | 'z'; fixed: number }>;
}

const centre = (r: Rect) => ({ x: +((r.minX + r.maxX) / 2).toFixed(1), z: +((r.minZ + r.maxZ) / 2).toFixed(1) });

/** Free stretches across a walkway at one station along it, given what stands there. */
function clearGaps(lo: number, hi: number, blocked: Array<[number, number]>): Array<[number, number]> {
  const sorted = blocked.filter(([a, b]) => b > lo && a < hi).sort((p, q) => p[0] - q[0]);
  const gaps: Array<[number, number]> = [];
  let cursor = lo;
  for (const [a, b] of sorted) {
    if (a > cursor) gaps.push([cursor, Math.min(a, hi)]);
    cursor = Math.max(cursor, b);
  }
  if (cursor < hi) gaps.push([cursor, hi]);
  return gaps;
}

/**
 * Checks a city against the plan and returns everything that breaks it. An empty list means
 * the roads are clear, the pavements can be walked from end to end and every door can be reached.
 */
export function validatePlan(input: PlanInput): Violation[] {
  const violations: Violation[] = [];
  const { zones, obstructions } = input;
  const roads = zones.filter((zone) => zone.kind === 'carriageway');
  const walks = zones.filter((zone) => zone.kind === 'walkway');

  // 1. No building on a carriageway. One report per building per road.
  const seen = new Set<string>();
  for (const road of roads) {
    for (const thing of obstructions) {
      if (!thing.structure) continue;
      const over = intersection(road, thing);
      if (!over || rectArea(over) < 0.25) continue;
      const key = `${road.id}|${thing.owner}`;
      if (seen.has(key)) continue;
      seen.add(key);
      violations.push({
        rule: 'building-on-road', what: thing.owner, at: centre(over),
        detail: `A building stands ${rectArea(over).toFixed(1)} m² into the carriageway of ${road.street}`,
      });
    }
  }

  // 2. Every walkway keeps a clear way through, and that way joins up along its length.
  //    Roads are held to the same test: a checkpoint or a broken-down bus may take a lane, never the road.
  for (const walk of [...walks, ...roads]) {
    const alongZ = walk.axis === 'z';
    const from = alongZ ? walk.minZ : walk.minX;
    const to = alongZ ? walk.maxZ : walk.maxX;
    const lo = alongZ ? walk.minX : walk.minZ;
    const hi = alongZ ? walk.maxX : walk.maxZ;
    const near = obstructions.filter((thing) => intersection(walk, thing));
    let previous: Array<[number, number]> | null = null;
    let badFrom: number | null = null;
    let culprit = '';
    const close = (end: number) => {
      if (badFrom === null) return;
      const mid = (badFrom + end) / 2;
      const across = (lo + hi) / 2;
      violations.push({
        rule: walk.kind === 'walkway' ? 'walkway-blocked' : 'building-on-road', what: culprit,
        at: alongZ ? { x: +across.toFixed(1), z: +mid.toFixed(1) } : { x: +mid.toFixed(1), z: +across.toFixed(1) },
        detail: walk.kind === 'walkway'
          ? `The ${walk.street} walkway has no clear ${walk.clear} m way through for ${(end - badFrom).toFixed(1)} m`
          : `${walk.street} has no clear ${walk.clear} m of road for ${(end - badFrom).toFixed(1)} m`,
      });
      badFrom = null;
    };
    for (let s = from + 0.25; s < to; s += 0.5) {
      const here = near.filter((thing) => (alongZ ? thing.minZ <= s && thing.maxZ >= s : thing.minX <= s && thing.maxX >= s));
      const blocked = here.map((thing) => (alongZ ? [thing.minX, thing.maxX] : [thing.minZ, thing.maxZ]) as [number, number]);
      let gaps = clearGaps(lo, hi, blocked).filter(([a, b]) => b - a >= walk.clear - 0.001);
      // The way through here must be reachable from the way through one step back
      if (previous && gaps.length > 0) {
        const before: Array<[number, number]> = previous;
        const joined = gaps.filter(([a, b]) => before.some(([c, d]) => Math.min(b, d) - Math.max(a, c) >= walk.clear * 0.5));
        if (joined.length > 0) gaps = joined;
        else gaps = [];
      }
      if (gaps.length === 0) {
        if (badFrom === null) {
          badFrom = s - 0.25;
          culprit = Array.from(new Set(here.map((thing) => thing.owner))).slice(0, 3).join(', ') || 'unknown';
        }
        previous = null;
      } else {
        close(s - 0.25);
        previous = gaps;
      }
    }
    close(to);
  }

  // 3. Buildings do not stand in each other
  const byOwner = new Map<string, Obstruction[]>();
  for (const thing of obstructions) {
    if (!thing.structure) continue;
    const list = byOwner.get(thing.owner) ?? [];
    list.push(thing);
    byOwner.set(thing.owner, list);
  }
  const owners = Array.from(byOwner.keys());
  for (let i = 0; i < owners.length; i++) {
    for (let j = i + 1; j < owners.length; j++) {
      let worst: Rect | null = null;
      for (const a of byOwner.get(owners[i])!) {
        for (const b of byOwner.get(owners[j])!) {
          const over = intersection(a, b);
          if (over && rectArea(over) > 1 && (!worst || rectArea(over) > rectArea(worst))) worst = over;
        }
      }
      if (worst) {
        violations.push({ rule: 'buildings-overlap', what: `${owners[i]} and ${owners[j]}`, at: centre(worst), detail: `They share ${rectArea(worst).toFixed(1)} m² of ground` });
      }
    }
  }

  // 4. Every door can be walked to. People walk anywhere that is not inside something.
  const CELL = 0.5;
  const all = obstructions;
  const minX = Math.min(input.start.x, ...input.doors.map((d) => d.x), ...zones.map((z) => z.minX)) - 6;
  const maxX = Math.max(input.start.x, ...input.doors.map((d) => d.x), ...zones.map((z) => z.maxX)) + 6;
  const minZ = Math.min(input.start.z, ...input.doors.map((d) => d.z), ...zones.map((z) => z.minZ)) - 6;
  const maxZ = Math.max(input.start.z, ...input.doors.map((d) => d.z), ...zones.map((z) => z.maxZ)) + 6;
  const cols = Math.ceil((maxX - minX) / CELL);
  const rows = Math.ceil((maxZ - minZ) / CELL);
  const solid = new Uint8Array(cols * rows);
  for (const thing of all) {
    // Thin posts and rails do not stop someone walking round them at this scale
    if (thing.maxX - thing.minX < 0.45 && thing.maxZ - thing.minZ < 0.45) continue;
    const c0 = Math.max(0, Math.floor((thing.minX - minX) / CELL));
    const c1 = Math.min(cols - 1, Math.floor((thing.maxX - minX) / CELL));
    const r0 = Math.max(0, Math.floor((thing.minZ - minZ) / CELL));
    const r1 = Math.min(rows - 1, Math.floor((thing.maxZ - minZ) / CELL));
    for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) solid[r * cols + c] = 1;
  }
  const cellOf = (x: number, z: number) => ({ c: Math.floor((x - minX) / CELL), r: Math.floor((z - minZ) / CELL) });
  const reached = new Uint8Array(cols * rows);
  const queue: number[] = [];
  const seed = cellOf(input.start.x, input.start.z);
  queue.push(seed.r * cols + seed.c);
  reached[seed.r * cols + seed.c] = 1;
  for (let head = 0; head < queue.length; head++) {
    const index = queue[head];
    const c = index % cols;
    const r = (index - c) / cols;
    for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nc = c + dc;
      const nr = r + dr;
      if (nc < 0 || nr < 0 || nc >= cols || nr >= rows) continue;
      const next = nr * cols + nc;
      if (reached[next] || solid[next]) continue;
      reached[next] = 1;
      queue.push(next);
    }
  }
  for (const door of input.doors) {
    // A door is in a wall: the ground just outside it is what must be reachable
    let ok = false;
    for (let dr = -3; dr <= 3 && !ok; dr++) {
      for (let dc = -3; dc <= 3 && !ok; dc++) {
        const { c, r } = cellOf(door.x + dc * CELL, door.z + dr * CELL);
        if (c >= 0 && r >= 0 && c < cols && r < rows && reached[r * cols + c]) ok = true;
      }
    }
    if (!ok) {
      violations.push({ rule: 'door-unreachable', what: door.name, at: { x: +door.x.toFixed(1), z: +door.z.toFixed(1) }, detail: 'No way to walk to this entrance from the street' });
    }
  }

  // 5. Planned road that was never laid because a building sits where it should run
  for (const gap of input.roadGaps ?? []) {
    const mid = (gap.from + gap.to) / 2;
    violations.push({
      rule: 'road-cut', what: gap.street, at: gap.axis === 'x' ? { x: +mid.toFixed(1), z: gap.fixed } : { x: gap.fixed, z: +mid.toFixed(1) },
      detail: `${(gap.to - gap.from).toFixed(0)} m of ${gap.street} could not be laid: something stands on its line`,
    });
  }

  return violations;
}

/**
 * Can a building with this footprint go here? Used for what players build: the same rules as
 * the rest of the city, plus staying inside the plot and back from its edges.
 */
export function cannotBuild(footprint: Rect, plot: Rect, zones: Zone[], others: Rect[]): string | null {
  if (!contains(plot, footprint)) return 'The building would cross the boundary of the plot.';
  if (!contains(grow(plot, -SETBACK), footprint, 0.001)) return `The building must stand at least ${SETBACK} m back from the edge of the plot.`;
  for (const zone of zones) {
    if (intersection(zone, footprint)) return zone.kind === 'carriageway' ? `That would stand on ${zone.street}.` : `That would block the ${zone.street} walkway.`;
  }
  for (const other of others) {
    if (intersection(other, footprint)) return 'Something is already standing there.';
  }
  return null;
}
