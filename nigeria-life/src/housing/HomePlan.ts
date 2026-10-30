/**
 * The plan of a home, from what kind of home it is.
 *
 * A self-contain is one room with its own toilet and shower in a corner and a kitchen counter in
 * another. A room and parlour is a parlour with the bedroom and the kitchen off it. A flat or a
 * house of two bedrooms or more has a parlour and a kitchen at the front, a corridor from the
 * parlour with a guest toilet at its end, and every bedroom off that corridor with a toilet and
 * shower of its own. No room is reached through another.
 *
 * Everything is measured in metres from the middle of the home. The front of the home is +z (the
 * camera's side, left open so the rooms can be seen); its front wall is low, with the door in it.
 * A piece "turned" 0 faces the front: a bed's head is against the wall behind it.
 */

export type HomeKind = 'self-contain' | 'room-parlour' | 'flat' | 'house';

export interface HomeBrief {
  kind: HomeKind;
  bedrooms: number;
  /** Only a house has a carport: not a room, not a flat */
  carport: boolean;
}

export interface Rect {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

export type RoomKind = 'studio' | 'parlour' | 'corridor' | 'bedroom' | 'ensuite' | 'kitchen' | 'toilet';

export interface PlanRoom extends Rect {
  id: string;
  kind: RoomKind;
  name: string;
}

/** A wall along x (at z, from `from` to `to` in x) or along z (at x, from `from` to `to` in z), with doorways centred at `doors` */
export interface PlanWall {
  axis: 'x' | 'z';
  at: number;
  from: number;
  to: number;
  doors: number[];
}

export interface PlanDoor {
  id: string;
  name: string;
  x: number;
  z: number;
  /** 0 in a wall along x, a quarter turn in a wall along z */
  yaw: number;
  swing: 1 | -1;
}

export type FixtureKind = 'wc' | 'shower' | 'basin' | 'counter' | 'sink';

/** Part of the building, not furniture: it stays when the furniture is moved */
export interface Fixture {
  kind: FixtureKind;
  x: number;
  z: number;
  /** Size on the floor, as it stands */
  width: number;
  depth: number;
  /** Which way it faces, as a step along the floor */
  face: { x: number; z: number };
}

export interface Spot {
  x: number;
  z: number;
  turns: number;
}

export interface HomePlan {
  /** The same plan has the same key: furniture laid out for one key fits it */
  key: string;
  brief: HomeBrief;
  width: number;
  length: number;
  /** Where the front wall stands; in front of it is the step */
  frontZ: number;
  rooms: PlanRoom[];
  walls: PlanWall[];
  doors: PlanDoor[];
  fixtures: Fixture[];
  /** The front door, in the front wall */
  entrance: { x: number; z: number };
  /** Where the player stands on coming in */
  spawn: { x: number; z: number };
  /** Windows in the outer walls: where along which wall */
  windows: Array<{ wall: 'back' | 'left' | 'right'; at: number }>;
  /** A light over the middle of each room */
  lights: Array<{ x: number; z: number }>;
  /** Where what the home comes with stands */
  spots: {
    bed: Spot;
    /** The other bedrooms' beds */
    beds: Spot[];
    sofa: Spot;
    tv: Spot;
    fridge: Spot;
    drum: Spot;
    cooker: Spot;
    /** A table to eat at, when there is room for one */
    dining: Spot | null;
    /** A fan, a plant, a rug: things that make a room lived in */
    extras: Array<Spot & { what: 'fan' | 'plant' | 'rug' | 'chairs' }>;
  };
  carport: boolean;
}

const T = 0.4;
const HALF_T = T / 2;
const BATH_W = 2.4;
const BATH_D = 2.2;
const BEDROOM_W = 4.6;
const BACK_D = 4.8;
const CORRIDOR = 1.8;
const FRONT_D = 5.2;
const KITCHEN_W = 3.6;
const PARLOUR_MIN = 6.8;
const GUEST_WC_W = 2.8;
const STEP = 1.0;

/** What kind of home a property is, from what it is called and how many bedrooms it has */
export function briefOf(home: { type?: string; bedrooms?: number; name?: string } | null): HomeBrief {
  if (!home) return { kind: 'flat', bedrooms: 3, carport: false };
  const type = String(home.type ?? '').toLowerCase();
  const name = String(home.name ?? '');
  const bedrooms = Math.max(1, Math.min(6, Math.round(home.bedrooms ?? 1)));
  if (type === 'room' || type === 'self-contained' || /self[- ]?contain|studio/i.test(name)) return { kind: 'self-contain', bedrooms: 1, carport: false };
  const house = type === 'house' || type === 'duplex' || /\b(mansion|villa|palace|duplex|terrace|bungalow|detached)\b/i.test(name);
  if (bedrooms === 1) return { kind: house ? 'house' : 'room-parlour', bedrooms: 1, carport: house };
  return { kind: house ? 'house' : 'flat', bedrooms, carport: house };
}

/** A house the player built on their own land */
export function briefOfBuilding(typeId: string): HomeBrief {
  return { kind: 'house', bedrooms: typeId === 'duplex' ? 4 : 3, carport: true };
}

export function planFor(brief: HomeBrief): HomePlan {
  if (brief.kind === 'self-contain') return selfContain(brief);
  if (brief.bedrooms <= 1) return roomAndParlour(brief);
  return withCorridor(brief);
}

// --- Shared pieces -----------------------------------------------------------------------------

/** A toilet and shower in a corner of a room: walls on the two open sides, a door in one */
function bathroom(
  plan: Builder,
  id: string,
  name: string,
  box: Rect,
  /** Which side of the box the door is on, and where along it */
  door: { side: 'minX' | 'maxX' | 'minZ' | 'maxZ'; at: number },
  /** Which of its sides are walls already (outer walls, other rooms' walls) */
  closed: Array<'minX' | 'maxX' | 'minZ' | 'maxZ'>
): void {
  plan.rooms.push({ id, kind: 'ensuite', name, ...box });
  for (const side of ['minX', 'maxX', 'minZ', 'maxZ'] as const) {
    if (closed.includes(side)) continue;
    const alongX = side === 'minZ' || side === 'maxZ';
    plan.walls.push({
      axis: alongX ? 'x' : 'z',
      at: box[side],
      from: alongX ? box.minX : box.minZ,
      to: alongX ? box.maxX : box.maxZ,
      doors: door.side === side ? [door.at] : [],
    });
  }
  const dx = door.side === 'minX' || door.side === 'maxX' ? door.at : 0;
  plan.doors.push({
    id: `home_door_${id}`,
    name: `${name} door`,
    x: door.side === 'minX' ? box.minX : door.side === 'maxX' ? box.maxX : door.at,
    z: door.side === 'minZ' ? box.minZ : door.side === 'maxZ' ? box.maxZ : dx,
    yaw: door.side === 'minZ' || door.side === 'maxZ' ? 0 : Math.PI / 2,
    swing: door.side === 'maxZ' || door.side === 'maxX' ? -1 : 1,
  });
  // The toilet against the wall furthest from the door, the shower in the far corner, a basin by the door
  const inX = (box.minX + box.maxX) / 2;
  const inZ = (box.minZ + box.maxZ) / 2;
  const doorOnZ = door.side === 'minZ' || door.side === 'maxZ';
  if (doorOnZ) {
    const backZ = door.side === 'maxZ' ? box.minZ : box.maxZ;
    const inward = door.side === 'maxZ' ? 1 : -1;
    // Toilet and shower along the wall opposite the door, side by side
    const showerLeft = door.at > inX;
    plan.fixtures.push({ kind: 'shower', x: showerLeft ? box.minX + HALF_T + 0.5 : box.maxX - HALF_T - 0.5, z: backZ + inward * (HALF_T + 0.5), width: 1.0, depth: 1.0, face: { x: 0, z: inward } });
    plan.fixtures.push({ kind: 'wc', x: showerLeft ? box.maxX - HALF_T - 0.45 : box.minX + HALF_T + 0.45, z: backZ + inward * (HALF_T + 0.42), width: 0.5, depth: 0.76, face: { x: 0, z: inward } });
    plan.fixtures.push({ kind: 'basin', x: showerLeft ? box.maxX - HALF_T - 0.3 : box.minX + HALF_T + 0.3, z: inZ + inward * 0.15, width: 0.5, depth: 0.5, face: { x: showerLeft ? -1 : 1, z: 0 } });
  } else {
    const backX = door.side === 'maxX' ? box.minX : box.maxX;
    const inward = door.side === 'maxX' ? 1 : -1;
    const showerBack = door.at > inZ;
    plan.fixtures.push({ kind: 'shower', x: backX + inward * (HALF_T + 0.5), z: showerBack ? box.minZ + HALF_T + 0.5 : box.maxZ - HALF_T - 0.5, width: 1.0, depth: 1.0, face: { x: inward, z: 0 } });
    plan.fixtures.push({ kind: 'wc', x: backX + inward * (HALF_T + 0.42), z: showerBack ? box.maxZ - HALF_T - 0.45 : box.minZ + HALF_T + 0.45, width: 0.76, depth: 0.5, face: { x: inward, z: 0 } });
  }
}

interface Builder {
  rooms: PlanRoom[];
  walls: PlanWall[];
  doors: PlanDoor[];
  fixtures: Fixture[];
}

function begin(): Builder {
  return { rooms: [], walls: [], doors: [], fixtures: [] };
}

/** A kitchen counter with a sink along a wall: from `a` to `b` along it, its back to the wall at `wall` */
function counter(plan: Builder, along: 'x' | 'z', wall: number, inward: 1 | -1, a: number, b: number): void {
  const depth = 0.62;
  const mid = (a + b) / 2;
  const length = Math.abs(b - a);
  if (along === 'x') {
    const z = wall + inward * (HALF_T + depth / 2);
    plan.fixtures.push({ kind: 'counter', x: mid, z, width: length, depth, face: { x: 0, z: inward } });
    plan.fixtures.push({ kind: 'sink', x: mid - length * 0.18, z, width: 0.6, depth: 0.45, face: { x: 0, z: inward } });
  } else {
    const x = wall + inward * (HALF_T + depth / 2);
    plan.fixtures.push({ kind: 'counter', x, z: mid, width: depth, depth: length, face: { x: inward, z: 0 } });
    plan.fixtures.push({ kind: 'sink', x, z: mid - length * 0.18, width: 0.45, depth: 0.6, face: { x: inward, z: 0 } });
  }
}

function lightsOf(rooms: PlanRoom[]): Array<{ x: number; z: number }> {
  return rooms.filter((r) => r.kind !== 'corridor').map((r) => ({ x: (r.minX + r.maxX) / 2, z: (r.minZ + r.maxZ) / 2 }));
}

function keyOf(brief: HomeBrief): string {
  return `${brief.kind}:${brief.bedrooms}:${brief.carport ? 'c' : '-'}:v1`;
}

// --- A self-contain: one room -----------------------------------------------------------------

function selfContain(brief: HomeBrief): HomePlan {
  const width = 8.4;
  const depth = 7.0;
  const length = depth + STEP;
  const hw = width / 2;
  const back = -length / 2;
  const frontZ = back + depth;
  const p = begin();
  p.rooms.push({ id: 'studio', kind: 'studio', name: 'Room', minX: -hw, maxX: hw, minZ: back, maxZ: frontZ });
  // The toilet and shower: the back right corner, its door on the room
  bathroom(p, 'bathroom', 'Bathroom', { minX: hw - BATH_W, maxX: hw, minZ: back, maxZ: back + BATH_D }, { side: 'maxZ', at: hw - BATH_W / 2 }, ['maxX', 'minZ']);
  // The kitchen corner: back left, a counter along the back wall
  counter(p, 'x', back, 1, -hw + HALF_T, -hw + 1.7);
  const entrance = { x: 0.6, z: frontZ };
  return {
    key: keyOf(brief),
    brief,
    width,
    length,
    frontZ,
    ...p,
    entrance,
    spawn: { x: entrance.x, z: frontZ - 1.2 },
    windows: [{ wall: 'back', at: -0.6 }, { wall: 'left', at: 2.0 }],
    lights: [{ x: -0.6, z: back + depth / 2 }],
    spots: {
      bed: { x: hw - HALF_T - 1.2, z: 0.6, turns: 3 },
      beds: [],
      sofa: { x: -0.9, z: 0.9, turns: 3 },
      tv: { x: -hw + HALF_T + 0.3, z: 0.9, turns: 1 },
      fridge: { x: -hw + HALF_T + 0.5, z: back + 2.1, turns: 1 },
      drum: { x: hw - BATH_W - HALF_T - 0.65, z: back + HALF_T + 0.55, turns: 0 },
      cooker: { x: -hw + 2.45, z: back + HALF_T + 0.45, turns: 0 },
      dining: null,
      extras: [{ what: 'chairs', x: -2.3, z: frontZ - 0.85, turns: 0 }, { what: 'fan', x: hw - 0.7, z: frontZ - 0.6, turns: 2 }],
    },
    carport: brief.carport,
  };
}

// --- A room and parlour --------------------------------------------------------------------------

function roomAndParlour(brief: HomeBrief): HomePlan {
  const width = 9.6;
  const depth = FRONT_D + BACK_D;
  const length = depth + STEP;
  const hw = width / 2;
  const back = -length / 2;
  const split = back + BACK_D;
  const frontZ = back + depth;
  const kitchenX = hw - 4.0;
  const p = begin();
  p.rooms.push({ id: 'parlour', kind: 'parlour', name: 'Parlour', minX: -hw, maxX: hw, minZ: split, maxZ: frontZ });
  p.rooms.push({ id: 'bedroom1', kind: 'bedroom', name: 'Bedroom', minX: -hw, maxX: kitchenX, minZ: back, maxZ: split });
  p.rooms.push({ id: 'kitchen', kind: 'kitchen', name: 'Kitchen', minX: kitchenX, maxX: hw, minZ: back, maxZ: split });
  const bedroomDoor = kitchenX - 1.0;
  const kitchenDoor = kitchenX + 1.0;
  // The parlour's back wall, with a door into the bedroom and one into the kitchen
  p.walls.push({ axis: 'x', at: split, from: -hw, to: hw, doors: [bedroomDoor, kitchenDoor] });
  p.walls.push({ axis: 'z', at: kitchenX, from: back, to: split, doors: [] });
  p.doors.push({ id: 'home_door_bedroom1', name: 'Bedroom door', x: bedroomDoor, z: split, yaw: 0, swing: 1 });
  p.doors.push({ id: 'home_door_kitchen', name: 'Kitchen door', x: kitchenDoor, z: split, yaw: 0, swing: 1 });
  // The bedroom's own toilet and shower: its back left corner
  bathroom(p, 'ensuite1', 'Bathroom', { minX: -hw, maxX: -hw + BATH_W, minZ: back, maxZ: back + BATH_D }, { side: 'maxZ', at: -hw + BATH_W / 2 }, ['minX', 'minZ']);
  counter(p, 'x', back, 1, kitchenX + HALF_T, kitchenX + 1.6);
  const entrance = { x: -1.2, z: frontZ };
  return {
    key: keyOf(brief),
    brief,
    width,
    length,
    frontZ,
    ...p,
    entrance,
    spawn: { x: entrance.x, z: frontZ - 1.2 },
    windows: [{ wall: 'back', at: -1.6 }, { wall: 'back', at: hw - 2 }, { wall: 'left', at: (split + frontZ) / 2 }, { wall: 'right', at: (split + frontZ) / 2 }],
    lights: lightsOf(p.rooms),
    spots: {
      bed: { x: kitchenX - HALF_T - 1.4, z: back + HALF_T + 1.2, turns: 0 },
      beds: [],
      sofa: { x: -hw + 3.4, z: split + 1.6, turns: 3 },
      tv: { x: -hw + HALF_T + 0.3, z: split + 1.6, turns: 1 },
      fridge: { x: hw - HALF_T - 0.46, z: back + HALF_T + 1.45, turns: 3 },
      drum: { x: hw - HALF_T - 0.65, z: split - HALF_T - 0.6, turns: 3 },
      cooker: { x: kitchenX + HALF_T + 2.3, z: back + HALF_T + 0.42, turns: 0 },
      dining: { x: hw - 1.8, z: (split + frontZ) / 2 + 0.4, turns: 0 },
      extras: [{ what: 'fan', x: -hw + 0.8, z: frontZ - 0.6, turns: 2 }, { what: 'plant', x: hw - 0.7, z: frontZ - 0.6, turns: 0 }],
    },
    carport: brief.carport,
  };
}

// --- Two bedrooms and more: a parlour, a corridor, and every bedroom off it -------------------------

function withCorridor(brief: HomeBrief): HomePlan {
  const n = Math.max(2, Math.min(6, brief.bedrooms));
  const backCount = Math.min(n, 4);
  const frontCount = n - backCount;
  const frontWidth = PARLOUR_MIN + KITCHEN_W + frontCount * BEDROOM_W;
  const width = Math.max(frontWidth, backCount * BEDROOM_W);
  const hw = width / 2;
  const depth = BACK_D + CORRIDOR + FRONT_D;
  const length = depth + STEP;
  const back = -length / 2;
  const corridorBack = back + BACK_D;
  const corridorFront = corridorBack + CORRIDOR;
  const frontZ = back + depth;
  const p = begin();
  const spare = width - frontWidth;
  const kitchenW = KITCHEN_W + Math.min(spare * 0.3, 1.6);
  const parlourW = PARLOUR_MIN + spare - (kitchenW - KITCHEN_W);
  const parlourMax = -hw + parlourW;
  const kitchenMax = parlourMax + kitchenW;
  const wcMin = hw - GUEST_WC_W;

  p.rooms.push({ id: 'parlour', kind: 'parlour', name: 'Parlour', minX: -hw, maxX: parlourMax, minZ: corridorFront, maxZ: frontZ });
  p.rooms.push({ id: 'corridor', kind: 'corridor', name: 'Corridor', minX: -hw, maxX: wcMin, minZ: corridorBack, maxZ: corridorFront });
  p.rooms.push({ id: 'kitchen', kind: 'kitchen', name: 'Kitchen', minX: parlourMax, maxX: kitchenMax, minZ: corridorFront, maxZ: frontZ });
  p.rooms.push({ id: 'toilet', kind: 'toilet', name: 'Guest toilet', minX: wcMin, maxX: hw, minZ: corridorBack, maxZ: corridorFront });

  const beds: Spot[] = [];
  const backDoors: number[] = [];
  const frontDoors: number[] = [];
  const backW = width / backCount;
  for (let i = 0; i < backCount; i++) {
    const minX = -hw + i * backW;
    const maxX = minX + backW;
    const id = `bedroom${i + 1}`;
    p.rooms.push({ id, kind: 'bedroom', name: i === 0 ? 'Master bedroom' : `Bedroom ${i + 1}`, minX, maxX, minZ: back, maxZ: corridorBack });
    if (i > 0) p.walls.push({ axis: 'z', at: minX, from: back, to: corridorBack, doors: [] });
    const doorX = minX + 1.1;
    backDoors.push(doorX);
    p.doors.push({ id: `home_door_${id}`, name: `${i === 0 ? 'Master bedroom' : `Bedroom ${i + 1}`} door`, x: doorX, z: corridorBack, yaw: 0, swing: 1 });
    // Its own toilet and shower in the back right corner, the door on the bedroom
    bathroom(p, `ensuite${i + 1}`, i === 0 ? 'Master bathroom' : `Bathroom ${i + 1}`, { minX: maxX - BATH_W, maxX, minZ: back, maxZ: back + BATH_D }, { side: 'maxZ', at: maxX - BATH_W / 2 }, ['maxX', 'minZ']);
    // The bed against the back wall, between the door and the bathroom
    beds.push({ x: (minX + HALF_T + maxX - BATH_W - HALF_T) / 2, z: back + HALF_T + 1.2, turns: 0 });
  }
  // Bedrooms at the front, past the kitchen, when there are more than four
  for (let j = 0; j < frontCount; j++) {
    const minX = kitchenMax + j * BEDROOM_W;
    const maxX = minX + BEDROOM_W;
    const k = backCount + j + 1;
    const id = `bedroom${k}`;
    p.rooms.push({ id, kind: 'bedroom', name: `Bedroom ${k}`, minX, maxX, minZ: corridorFront, maxZ: frontZ });
    p.walls.push({ axis: 'z', at: minX, from: corridorFront, to: frontZ, doors: [] });
    const doorX = minX + 1.1;
    frontDoors.push(doorX);
    p.doors.push({ id: `home_door_${id}`, name: `Bedroom ${k} door`, x: doorX, z: corridorFront, yaw: 0, swing: -1 });
    bathroom(p, `ensuite${k}`, `Bathroom ${k}`, { minX: maxX - BATH_W, maxX, minZ: frontZ - BATH_D, maxZ: frontZ }, { side: 'minZ', at: maxX - BATH_W / 2 }, ['maxX', 'maxZ']);
    beds.push({ x: (minX + HALF_T + maxX - BATH_W - HALF_T) / 2, z: frontZ - HALF_T - 1.2, turns: 2 });
  }

  // The corridor's walls: the bedrooms' along the back, the kitchen's and the front bedrooms' along the front (the parlour opens on it)
  p.walls.push({ axis: 'x', at: corridorBack, from: -hw, to: hw, doors: backDoors });
  p.walls.push({ axis: 'x', at: corridorFront, from: parlourMax, to: hw, doors: frontDoors });
  // The kitchen opens on the parlour
  const kitchenDoorZ = (corridorFront + frontZ) / 2 - 0.6;
  p.walls.push({ axis: 'z', at: parlourMax, from: corridorFront, to: frontZ, doors: [kitchenDoorZ] });
  p.doors.push({ id: 'home_door_kitchen', name: 'Kitchen door', x: parlourMax, z: kitchenDoorZ, yaw: Math.PI / 2, swing: 1 });
  // The guest toilet at the end of the corridor
  const wcDoorZ = (corridorBack + corridorFront) / 2;
  p.walls.push({ axis: 'z', at: wcMin, from: corridorBack, to: corridorFront, doors: [wcDoorZ] });
  p.doors.push({ id: 'home_door_bathroom', name: 'Guest toilet door', x: wcMin, z: wcDoorZ, yaw: Math.PI / 2, swing: -1 });
  // The toilet against the end wall, the basin on the front wall: room to stand between them
  p.fixtures.push({ kind: 'wc', x: hw - HALF_T - 0.38, z: corridorBack + HALF_T + 0.35, width: 0.76, depth: 0.5, face: { x: -1, z: 0 } });
  p.fixtures.push({ kind: 'basin', x: hw - 1.4, z: corridorFront - HALF_T - 0.25, width: 0.5, depth: 0.5, face: { x: 0, z: -1 } });

  // The kitchen: a counter and sink along the front wall, the cooker at its end, the fridge on the far wall
  counter(p, 'x', frontZ, -1, parlourMax + HALF_T + 0.1, kitchenMax - HALF_T - 1.45);
  const parlourMid = (corridorFront + frontZ) / 2;
  const sofaZ = corridorFront + 1.6;
  // In at the right of the parlour, clear of the sitting area on the left
  const entrance = { x: parlourMax - 1.6, z: frontZ };
  const plan: HomePlan = {
    key: keyOf(brief),
    brief,
    width,
    length,
    frontZ,
    ...p,
    entrance,
    spawn: { x: entrance.x, z: frontZ - 1.2 },
    windows: [
      ...Array.from({ length: backCount }, (_, i) => ({ wall: 'back' as const, at: -hw + i * backW + (backW - BATH_W) / 2 })),
      { wall: 'left', at: parlourMid },
      { wall: 'left', at: back + BACK_D / 2 },
      { wall: 'right', at: back + BACK_D / 2 },
    ],
    lights: lightsOf(p.rooms),
    spots: {
      bed: beds[0],
      beds: beds.slice(1),
      sofa: { x: -hw + 3.2, z: sofaZ, turns: 3 },
      tv: { x: -hw + HALF_T + 0.3, z: sofaZ, turns: 1 },
      fridge: { x: kitchenMax - HALF_T - 0.46, z: frontZ - HALF_T - 1.45, turns: 3 },
      // In the kitchen's back corner, clear of its door from the parlour
      drum: { x: kitchenMax - HALF_T - 0.8, z: corridorFront + HALF_T + 0.5, turns: 3 },
      cooker: { x: kitchenMax - HALF_T - 0.72, z: frontZ - HALF_T - 0.42, turns: 2 },
      dining: parlourW >= 9 ? { x: -hw + 3.0, z: frontZ - 1.4, turns: 0 } : null,
      extras: [
        { what: 'rug', x: -hw + 1.9, z: sofaZ, turns: 0 },
        { what: 'plant', x: -hw + 0.7, z: frontZ - 0.7, turns: 0 },
        { what: 'fan', x: -hw + 0.6, z: corridorFront + 0.5, turns: 1 },
      ],
    },
    carport: brief.carport,
  };
  return plan;
}

/** The room a point is in, or null if it is in a wall or outside */
export function roomAt(plan: HomePlan, x: number, z: number): PlanRoom | null {
  // Bathrooms sit inside their bedrooms: the smaller room is the one meant
  let best: PlanRoom | null = null;
  for (const room of plan.rooms) {
    if (x > room.minX + HALF_T && x < room.maxX - HALF_T && z > room.minZ + HALF_T && z < room.maxZ - HALF_T) {
      if (!best || (room.maxX - room.minX) * (room.maxZ - room.minZ) < (best.maxX - best.minX) * (best.maxZ - best.minZ)) best = room;
    }
  }
  return best;
}
