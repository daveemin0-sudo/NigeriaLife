/**
 * The plan of a home, from what kind of home it is, at the size people live in.
 *
 * A self-contain is one big room with its bathroom in a corner and a kitchen counter along a
 * wall. A room and parlour has a big parlour with the bedroom, the bathroom and the kitchen off
 * it. Two bedrooms and more: a parlour and a kitchen at the front, a wide corridor from the
 * parlour, every bedroom off it, and a bathroom as big as the kitchen, with room in it for a
 * bathtub, a jacuzzi or a washing machine; from three bedrooms the master bedroom has its own
 * bathroom too. No room is reached through another, and every room has room to furnish.
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
  /** A duplex has two floors, the bedrooms upstairs; everything else is on one */
  storeys?: 1 | 2;
}

/** Floor to floor in a two-storey home: eighteen steps of 20 cm */
export const STOREY_H = 3.6;

export interface Rect {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

export type RoomKind = 'studio' | 'parlour' | 'corridor' | 'bedroom' | 'ensuite' | 'kitchen' | 'bathroom';

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
  /** Which floor it is on: 0 the ground floor (the default), 1 upstairs */
  storey?: number;
}

/** The floor upstairs in a two-storey home: its own rooms, walls, doors and fittings */
export interface Storey {
  rooms: PlanRoom[];
  walls: PlanWall[];
  doors: PlanDoor[];
  fixtures: Fixture[];
  windows: Array<{ wall: 'back' | 'left' | 'right'; at: number }>;
  lights: Array<{ x: number; z: number }>;
}

/**
 * The stairs of a two-storey home: one straight flight against the back wall of the stair hall,
 * rising along x from its foot at `x0` to its top at `x1`, in the strip `minZ` to `maxZ`. Upstairs
 * the floor is open over the flight, with a rail round the opening but at its top.
 */
export interface Stairs {
  x0: number;
  x1: number;
  minZ: number;
  maxZ: number;
  /** The hall the flight stands in: the same width on both floors */
  slotMinX: number;
  slotMaxX: number;
  risers: number;
  /** Where the player stands at the foot to go up, and where they step off at the top */
  foot: { x: number; z: number };
  top: { x: number; z: number };
  /** A step clear of the top, on the landing */
  landing: { x: number; z: number };
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
  /** A light over the middle of each room, the rooms lived in most first */
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
    /** A bathtub in the bathroom, for a home that comes with one */
    bath: Spot;
    /** A table to eat at, when there is room for one */
    dining: Spot | null;
    /** A fan, a plant, a rug: things that make a room lived in */
    extras: Array<Spot & { what: 'fan' | 'plant' | 'rug' | 'chairs' }>;
  };
  carport: boolean;
  /** 1, or 2 for a duplex */
  storeys: 1 | 2;
  /** The floor upstairs, in a two-storey home */
  upper: Storey | null;
  stairs: Stairs | null;
}

const T = 0.4;
const HALF_T = T / 2;
const BEDROOM_W = 7.0;
const BACK_D = 7.5;
const CORRIDOR = 2.6;
const FRONT_D = 8.0;
const KITCHEN_W = 6.0;
const BATH_W = 5.5;
const PARLOUR_MIN = 11;
const ENSUITE = 4.0;
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
  // A duplex, a mansion, a villa: the living rooms downstairs and the bedrooms up the stairs
  const twoFloors = house && bedrooms >= 3 && !/bungalow/i.test(name) && (type === 'duplex' || /\b(duplex|mansion|villa|palace)\b/i.test(name));
  return { kind: house ? 'house' : 'flat', bedrooms, carport: house, ...(twoFloors ? { storeys: 2 as const } : {}) };
}

/** A house the player built on their own land */
export function briefOfBuilding(typeId: string): HomeBrief {
  return typeId === 'duplex' ? { kind: 'house', bedrooms: 4, carport: true, storeys: 2 } : { kind: 'house', bedrooms: 3, carport: true };
}

/** Where a bought generator stands. A house has a compound: along the side wall, outside it. A flat or a room has no compound: on the apron beside the front door. */
export function generatorPads(plan: HomePlan): Array<{ x: number; z: number; turns: number }> {
  const hw = plan.width / 2;
  if (plan.carport) {
    // Narrow side out from the wall (turns 1), long side along the house, on the side away from the carport
    const x = -(hw + 0.95);
    const z0 = plan.frontZ - 1.7;
    return [
      { x, z: z0, turns: 1 },
      { x, z: z0 - 2.8, turns: 1 },
    ];
  }
  // Outside the left wall, near the front. The view into a home is from the front-right,
  // so the left side is beside the building and out of that view. On the apron, or on the
  // right, a generator fills the picture and reads as standing in the room.
  const x = -(hw + 0.95);
  const z0 = plan.frontZ - 1.7;
  const back = -plan.length / 2;
  const pads = [{ x, z: z0, turns: 1 }];
  const z1 = z0 - 2.8;
  pads.push(z1 > back + 1.4 ? { x, z: z1, turns: 1 } : { x: x - 1.6, z: z0, turns: 1 });
  return pads;
}

export function planFor(brief: HomeBrief): HomePlan {
  if (brief.storeys === 2 && brief.kind === 'house' && brief.bedrooms >= 3) return duplex(brief);
  if (brief.kind === 'self-contain') return selfContain(brief);
  if (brief.bedrooms <= 1) return roomAndParlour(brief);
  return withCorridor(brief);
}

// --- Shared pieces -----------------------------------------------------------------------------

interface Builder {
  rooms: PlanRoom[];
  walls: PlanWall[];
  doors: PlanDoor[];
  fixtures: Fixture[];
}

function begin(): Builder {
  return { rooms: [], walls: [], doors: [], fixtures: [] };
}

type Side = 'minX' | 'maxX' | 'minZ' | 'maxZ';

/**
 * The fittings of a bathroom: the toilet and the shower along the wall across from the door,
 * the basin on a side wall by the door; the rest of the floor free for a bathtub, a jacuzzi, a
 * washing machine. Returns where a bathtub would go, against the other side wall.
 */
function fitBathroom(plan: Builder, box: Rect, door: Side): Spot {
  const across: Side = door === 'minZ' ? 'maxZ' : door === 'maxZ' ? 'minZ' : door === 'minX' ? 'maxX' : 'minX';
  const alongX = door === 'minZ' || door === 'maxZ';
  // Measured as "along the far wall" (u) and "out from it" (v), then turned into x and z
  const uMin = alongX ? box.minX : box.minZ;
  const uMax = alongX ? box.maxX : box.maxZ;
  const wall = box[across];
  const inward = across === 'minZ' || across === 'minX' ? 1 : -1;
  const at = (u: number, v: number) => (alongX ? { x: u, z: wall + inward * v } : { x: wall + inward * v, z: u });
  const face = alongX ? { x: 0, z: inward } : { x: inward, z: 0 };
  const size = (w: number, d: number) => (alongX ? { width: w, depth: d } : { width: d, depth: w });
  plan.fixtures.push({ kind: 'wc', ...at(uMin + HALF_T + 0.75, HALF_T + 0.4), ...size(0.5, 0.76), face });
  plan.fixtures.push({ kind: 'shower', ...at(uMax - HALF_T - 0.65, HALF_T + 0.65), ...size(1.3, 1.3), face });
  // The basin hung on the side wall by the toilet, near the door
  const doorWall = box[door];
  const basin = alongX ? { x: uMin + HALF_T + 0.22, z: doorWall - inward * (HALF_T + 0.9) } : { x: doorWall - inward * (HALF_T + 0.9), z: uMin + HALF_T + 0.22 };
  plan.fixtures.push({ kind: 'basin', ...basin, width: alongX ? 0.4 : 0.5, depth: alongX ? 0.5 : 0.4, face: alongX ? { x: 1, z: 0 } : { x: 0, z: 1 } });
  // A bathtub against the other side wall, past the shower, toward the door
  const middle = box[across] + (box[door] - box[across]) * 0.6;
  return alongX ? { x: uMax - HALF_T - 0.5, z: middle, turns: 1 } : { x: middle, z: uMax - HALF_T - 0.5, turns: 0 };
}

/** A kitchen counter with a sink along a wall: from `a` to `b` along it, its back to the wall at `wall` */
function counter(plan: Builder, along: 'x' | 'z', wall: number, inward: 1 | -1, a: number, b: number): void {
  const depth = 0.62;
  const mid = (a + b) / 2;
  const length = Math.abs(b - a);
  if (along === 'x') {
    const z = wall + inward * (HALF_T + depth / 2);
    plan.fixtures.push({ kind: 'counter', x: mid, z, width: length, depth, face: { x: 0, z: inward } });
    plan.fixtures.push({ kind: 'sink', x: mid - length * 0.2, z, width: 0.6, depth: 0.45, face: { x: 0, z: inward } });
  } else {
    const x = wall + inward * (HALF_T + depth / 2);
    plan.fixtures.push({ kind: 'counter', x, z: mid, width: depth, depth: length, face: { x: inward, z: 0 } });
    plan.fixtures.push({ kind: 'sink', x, z: mid - length * 0.2, width: 0.45, depth: 0.6, face: { x: inward, z: 0 } });
  }
}

function lightsOf(rooms: PlanRoom[]): Array<{ x: number; z: number }> {
  // The rooms people spend time in first: the parlour (or the one room), the bedrooms, the kitchen, then the bathrooms
  const order: RoomKind[] = ['studio', 'parlour', 'bedroom', 'kitchen', 'bathroom', 'ensuite'];
  return [...rooms]
    .filter((r) => r.kind !== 'corridor')
    .sort((a, b) => order.indexOf(a.kind) - order.indexOf(b.kind))
    .map((r) => ({ x: (r.minX + r.maxX) / 2, z: (r.minZ + r.maxZ) / 2 }));
}

function keyOf(brief: HomeBrief): string {
  return `${brief.kind}:${brief.bedrooms}:${brief.carport ? 'c' : '-'}${brief.storeys === 2 ? ':2s' : ''}:v3`;
}

// --- A self-contain: one big room -------------------------------------------------------------

function selfContain(brief: HomeBrief): HomePlan {
  const width = 13;
  const depth = 10;
  const length = depth + STEP;
  const hw = width / 2;
  const back = -length / 2;
  const frontZ = back + depth;
  const p = begin();
  p.rooms.push({ id: 'studio', kind: 'studio', name: 'Room', minX: -hw, maxX: hw, minZ: back, maxZ: frontZ });
  // The bathroom: the back right corner, its door on the room
  const bath: Rect = { minX: hw - 5, maxX: hw, minZ: back, maxZ: back + 4.5 };
  p.rooms.push({ id: 'bathroom', kind: 'bathroom', name: 'Bathroom', ...bath });
  const bathDoor = bath.minX + 1.4;
  p.walls.push({ axis: 'z', at: bath.minX, from: back, to: bath.maxZ, doors: [] });
  p.walls.push({ axis: 'x', at: bath.maxZ, from: bath.minX, to: hw, doors: [bathDoor] });
  p.doors.push({ id: 'home_door_bathroom', name: 'Bathroom door', x: bathDoor, z: bath.maxZ, yaw: 0, swing: -1 });
  const bathSpot = fitBathroom(p, bath, 'maxZ');
  // The kitchen corner: back left, a counter along the back wall
  counter(p, 'x', back, 1, -hw + HALF_T, -hw + 3.8);
  const entrance = { x: 1.5, z: frontZ };
  return {
    key: keyOf(brief),
    brief,
    width,
    length,
    frontZ,
    ...p,
    entrance,
    spawn: { x: entrance.x, z: frontZ - 2.2 },
    windows: [{ wall: 'back', at: -1.2 }, { wall: 'left', at: 2.4 }, { wall: 'right', at: 2.4 }],
    lights: [{ x: -1.5, z: back + depth / 2 }, { x: (bath.minX + bath.maxX) / 2, z: (bath.minZ + bath.maxZ) / 2 }],
    spots: {
      bed: { x: hw - HALF_T - 1.3, z: 1.6, turns: 3 },
      beds: [],
      sofa: { x: -2.4, z: 1.4, turns: 3 },
      tv: { x: -hw + HALF_T + 0.3, z: 1.4, turns: 1 },
      fridge: { x: -hw + HALF_T + 0.5, z: back + 2.4, turns: 1 },
      drum: { x: bath.minX - 1.0, z: back + HALF_T + 0.6, turns: 0 },
      cooker: { x: -hw + 4.7, z: back + HALF_T + 0.42, turns: 0 },
      bath: bathSpot,
      dining: null,
      extras: [{ what: 'chairs', x: -3.8, z: frontZ - 1.2, turns: 0 }, { what: 'fan', x: hw - 0.8, z: frontZ - 0.8, turns: 2 }, { what: 'rug', x: -4.4, z: 1.4, turns: 0 }],
    },
    carport: brief.carport,
    storeys: 1,
    upper: null,
    stairs: null,
  };
}

// --- A room and parlour --------------------------------------------------------------------------

function roomAndParlour(brief: HomeBrief): HomePlan {
  const width = 17;
  const depth = FRONT_D + BACK_D;
  const length = depth + STEP;
  const hw = width / 2;
  const back = -length / 2;
  const split = back + BACK_D;
  const frontZ = back + depth;
  const bedMax = -hw + 7.5;
  const bathMax = bedMax + 4.5;
  const p = begin();
  p.rooms.push({ id: 'parlour', kind: 'parlour', name: 'Parlour', minX: -hw, maxX: hw, minZ: split, maxZ: frontZ });
  p.rooms.push({ id: 'bedroom1', kind: 'bedroom', name: 'Bedroom', minX: -hw, maxX: bedMax, minZ: back, maxZ: split });
  const bath: Rect = { minX: bedMax, maxX: bathMax, minZ: back, maxZ: split };
  p.rooms.push({ id: 'bathroom', kind: 'bathroom', name: 'Bathroom', ...bath });
  p.rooms.push({ id: 'kitchen', kind: 'kitchen', name: 'Kitchen', minX: bathMax, maxX: hw, minZ: back, maxZ: split });
  const bedroomDoor = bedMax - 1.2;
  const bathDoor = (bedMax + bathMax) / 2;
  const kitchenDoor = bathMax + 1.2;
  // The parlour's back wall, with a door into each room behind it
  p.walls.push({ axis: 'x', at: split, from: -hw, to: hw, doors: [bedroomDoor, bathDoor, kitchenDoor] });
  p.walls.push({ axis: 'z', at: bedMax, from: back, to: split, doors: [] });
  p.walls.push({ axis: 'z', at: bathMax, from: back, to: split, doors: [] });
  p.doors.push({ id: 'home_door_bedroom1', name: 'Bedroom door', x: bedroomDoor, z: split, yaw: 0, swing: 1 });
  p.doors.push({ id: 'home_door_bathroom', name: 'Bathroom door', x: bathDoor, z: split, yaw: 0, swing: 1 });
  p.doors.push({ id: 'home_door_kitchen', name: 'Kitchen door', x: kitchenDoor, z: split, yaw: 0, swing: 1 });
  const bathSpot = fitBathroom(p, bath, 'maxZ');
  counter(p, 'x', back, 1, bathMax + HALF_T, hw - HALF_T - 1.6);
  const sofaZ = split + 2.6;
  const entrance = { x: 1.0, z: frontZ };
  return {
    key: keyOf(brief),
    brief,
    width,
    length,
    frontZ,
    ...p,
    entrance,
    spawn: { x: entrance.x, z: frontZ - 2.2 },
    windows: [{ wall: 'back', at: -hw + 3 }, { wall: 'back', at: hw - 2.6 }, { wall: 'left', at: (split + frontZ) / 2 }, { wall: 'right', at: (split + frontZ) / 2 }],
    lights: lightsOf(p.rooms),
    spots: {
      bed: { x: -hw + HALF_T + 2.2, z: back + HALF_T + 1.2, turns: 0 },
      beds: [],
      sofa: { x: -hw + 3.8, z: sofaZ, turns: 3 },
      tv: { x: -hw + HALF_T + 0.3, z: sofaZ, turns: 1 },
      fridge: { x: hw - HALF_T - 0.46, z: back + HALF_T + 2.0, turns: 3 },
      drum: { x: hw - HALF_T - 0.65, z: split - HALF_T - 0.8, turns: 3 },
      cooker: { x: hw - HALF_T - 0.8, z: back + HALF_T + 0.42, turns: 0 },
      bath: bathSpot,
      dining: { x: hw - 3, z: frontZ - 2.4, turns: 0 },
      extras: [{ what: 'rug', x: -hw + 2.2, z: sofaZ, turns: 0 }, { what: 'fan', x: -hw + 0.8, z: frontZ - 0.8, turns: 2 }, { what: 'plant', x: hw - 0.8, z: split + 0.8, turns: 0 }],
    },
    carport: brief.carport,
    storeys: 1,
    upper: null,
    stairs: null,
  };
}

// --- Two bedrooms and more: a parlour, a corridor, and every room off it --------------------------

interface Slot {
  kind: 'bedroom' | 'bathroom' | 'parlour' | 'kitchen';
  width: number;
}

function withCorridor(brief: HomeBrief): HomePlan {
  const n = Math.max(2, Math.min(6, brief.bedrooms));
  const backBeds = n <= 5 ? Math.min(n, 3) : 4;
  const frontBeds = n - backBeds;
  // The bathroom goes in whichever row is shorter
  const backW0 = backBeds * BEDROOM_W;
  const frontW0 = PARLOUR_MIN + KITCHEN_W + frontBeds * BEDROOM_W;
  const bathInBack = backW0 <= frontW0;
  const backSlots: Slot[] = [...Array.from({ length: backBeds }, () => ({ kind: 'bedroom' as const, width: BEDROOM_W })), ...(bathInBack ? [{ kind: 'bathroom' as const, width: BATH_W }] : [])];
  const frontSlots: Slot[] = [{ kind: 'parlour', width: PARLOUR_MIN }, { kind: 'kitchen', width: KITCHEN_W }, ...Array.from({ length: frontBeds }, () => ({ kind: 'bedroom' as const, width: BEDROOM_W })), ...(!bathInBack ? [{ kind: 'bathroom' as const, width: BATH_W }] : [])];
  const sum = (slots: Slot[]) => slots.reduce((s, x) => s + x.width, 0);
  const width = Math.max(sum(backSlots), sum(frontSlots));
  // The spare width: across the back row's bedrooms, and to the parlour in the front
  const backSpare = width - sum(backSlots);
  for (const slot of backSlots) if (slot.kind === 'bedroom') slot.width += backSpare / backBeds;
  frontSlots[0].width += width - sum(frontSlots);

  const hw = width / 2;
  const depth = BACK_D + CORRIDOR + FRONT_D;
  const length = depth + STEP;
  const back = -length / 2;
  const corridorBack = back + BACK_D;
  const corridorFront = corridorBack + CORRIDOR;
  const frontZ = back + depth;
  const p = begin();
  p.rooms.push({ id: 'corridor', kind: 'corridor', name: 'Corridor', minX: -hw, maxX: hw, minZ: corridorBack, maxZ: corridorFront });

  const beds: Spot[] = [];
  let bedNo = 0;
  let bathSpot: Spot = { x: 0, z: 0, turns: 0 };
  const backDoors: number[] = [];
  const frontDoors: number[] = [];
  let parlour: Rect = { minX: -hw, maxX: -hw, minZ: corridorFront, maxZ: frontZ };
  let kitchen: Rect = { minX: 0, maxX: 0, minZ: corridorFront, maxZ: frontZ };

  // The back row: bedrooms (the first is the master), and the bathroom if it is here
  let x = -hw;
  backSlots.forEach((slot, i) => {
    const box: Rect = { minX: x, maxX: x + slot.width, minZ: back, maxZ: corridorBack };
    if (i > 0) p.walls.push({ axis: 'z', at: box.minX, from: back, to: corridorBack, doors: [] });
    if (slot.kind === 'bedroom') {
      bedNo += 1;
      const id = `bedroom${bedNo}`;
      const master = bedNo === 1;
      p.rooms.push({ id, kind: 'bedroom', name: master ? 'Master bedroom' : `Bedroom ${bedNo}`, ...box });
      const doorX = box.minX + 1.3;
      backDoors.push(doorX);
      p.doors.push({ id: `home_door_${id}`, name: `${master ? 'Master bedroom' : `Bedroom ${bedNo}`} door`, x: doorX, z: corridorBack, yaw: 0, swing: 1 });
      if (master && n >= 3) {
        // The master bedroom's own bathroom, in its front corner by the corridor, its door on the bedroom
        const en: Rect = { minX: box.maxX - ENSUITE, maxX: box.maxX, minZ: corridorBack - ENSUITE, maxZ: corridorBack };
        p.rooms.push({ id: 'ensuite1', kind: 'ensuite', name: 'Master bathroom', ...en });
        const doorZ = en.minZ + 1.3;
        p.walls.push({ axis: 'z', at: en.minX, from: en.minZ, to: en.maxZ, doors: [doorZ] });
        p.walls.push({ axis: 'x', at: en.minZ, from: en.minX, to: en.maxX, doors: [] });
        p.doors.push({ id: 'home_door_ensuite1', name: 'Master bathroom door', x: en.minX, z: doorZ, yaw: Math.PI / 2, swing: 1 });
        fitBathroom(p, en, 'minX');
        beds.push({ x: box.minX + HALF_T + 2.4, z: back + HALF_T + 1.2, turns: 0 });
      } else {
        beds.push({ x: (box.minX + box.maxX) / 2, z: back + HALF_T + 1.2, turns: 0 });
      }
    } else {
      p.rooms.push({ id: 'bathroom', kind: 'bathroom', name: 'Bathroom', ...box });
      const doorX = (box.minX + box.maxX) / 2;
      backDoors.push(doorX);
      p.doors.push({ id: 'home_door_bathroom', name: 'Bathroom door', x: doorX, z: corridorBack, yaw: 0, swing: 1 });
      bathSpot = fitBathroom(p, box, 'maxZ');
    }
    x = box.maxX;
  });

  // The front row: the parlour (open on the corridor), the kitchen off it, bedrooms, the bathroom if it is here
  x = -hw;
  frontSlots.forEach((slot, i) => {
    const box: Rect = { minX: x, maxX: x + slot.width, minZ: corridorFront, maxZ: frontZ };
    if (i > 0) p.walls.push({ axis: 'z', at: box.minX, from: corridorFront, to: frontZ, doors: slot.kind === 'kitchen' ? [corridorFront + 2.6] : [] });
    if (slot.kind === 'parlour') {
      parlour = box;
      p.rooms.push({ id: 'parlour', kind: 'parlour', name: 'Parlour', ...box });
    } else if (slot.kind === 'kitchen') {
      kitchen = box;
      p.rooms.push({ id: 'kitchen', kind: 'kitchen', name: 'Kitchen', ...box });
      p.doors.push({ id: 'home_door_kitchen', name: 'Kitchen door', x: box.minX, z: corridorFront + 2.6, yaw: Math.PI / 2, swing: 1 });
    } else if (slot.kind === 'bedroom') {
      bedNo += 1;
      const id = `bedroom${bedNo}`;
      p.rooms.push({ id, kind: 'bedroom', name: `Bedroom ${bedNo}`, ...box });
      const doorX = box.minX + 1.3;
      frontDoors.push(doorX);
      p.doors.push({ id: `home_door_${id}`, name: `Bedroom ${bedNo} door`, x: doorX, z: corridorFront, yaw: 0, swing: -1 });
      beds.push({ x: (box.minX + box.maxX) / 2, z: frontZ - HALF_T - 1.2, turns: 2 });
    } else {
      p.rooms.push({ id: 'bathroom', kind: 'bathroom', name: 'Bathroom', ...box });
      const doorX = (box.minX + box.maxX) / 2;
      frontDoors.push(doorX);
      p.doors.push({ id: 'home_door_bathroom', name: 'Bathroom door', x: doorX, z: corridorFront, yaw: 0, swing: -1 });
      bathSpot = fitBathroom(p, box, 'minZ');
    }
    x = box.maxX;
  });

  // The corridor's walls: the back row's along the back, the front row's (but the parlour's) along the front
  p.walls.push({ axis: 'x', at: corridorBack, from: -hw, to: hw, doors: backDoors });
  p.walls.push({ axis: 'x', at: corridorFront, from: parlour.maxX, to: hw, doors: frontDoors });

  // The kitchen: a counter and sink along the front wall, the cooker at its end, the fridge on the far wall
  counter(p, 'x', frontZ, -1, kitchen.minX + HALF_T + 0.2, kitchen.maxX - HALF_T - 1.8);
  const sofaZ = corridorFront + 3.0;
  const entrance = { x: parlour.maxX - 2.4, z: frontZ };
  const parlourW = parlour.maxX - parlour.minX;
  const windowsBack = p.rooms.filter((r) => r.minZ === back && r.kind !== 'ensuite').map((r) => ({ wall: 'back' as const, at: r.kind === 'bedroom' ? (r.minX + r.maxX) / 2 : r.minX + 1.6 }));
  return {
    key: keyOf(brief),
    brief,
    width,
    length,
    frontZ,
    ...p,
    entrance,
    spawn: { x: entrance.x, z: frontZ - 2.2 },
    windows: [...windowsBack, { wall: 'left', at: (corridorFront + frontZ) / 2 }, { wall: 'left', at: back + BACK_D / 2 }, { wall: 'right', at: (corridorFront + frontZ) / 2 }, { wall: 'right', at: back + BACK_D / 2 }],
    lights: lightsOf(p.rooms),
    spots: {
      bed: beds[0],
      beds: beds.slice(1),
      sofa: { x: -hw + 3.8, z: sofaZ, turns: 3 },
      tv: { x: -hw + HALF_T + 0.3, z: sofaZ, turns: 1 },
      fridge: { x: kitchen.maxX - HALF_T - 0.46, z: frontZ - HALF_T - 2.0, turns: 3 },
      drum: { x: kitchen.maxX - HALF_T - 0.8, z: corridorFront + HALF_T + 0.6, turns: 3 },
      cooker: { x: kitchen.maxX - HALF_T - 0.9, z: frontZ - HALF_T - 0.42, turns: 2 },
      bath: bathSpot,
      dining: parlourW >= 12 ? { x: -hw + 3.6, z: frontZ - 2.2, turns: 0 } : { x: parlour.maxX - 4.6, z: corridorFront + 1.8, turns: 0 },
      extras: [
        { what: 'rug', x: -hw + 2.2, z: sofaZ, turns: 0 },
        { what: 'plant', x: -hw + 0.8, z: frontZ - 0.8, turns: 0 },
        { what: 'fan', x: -hw + 0.7, z: corridorFront + 0.9, turns: 1 },
      ],
    },
    carport: brief.carport,
    storeys: 1,
    upper: null,
    stairs: null,
  };
}

// --- A duplex: the living rooms downstairs, the bedrooms up the stairs ---------------------------

interface DSlot {
  kind: 'stairs' | 'landing' | 'kitchen' | 'bathroom' | 'bedroom' | 'parlour' | 'lounge' | 'study';
  width: number;
  master?: boolean;
}

const STAIR_HALL = 7.0;
const RISERS = 18;
const GOING = 0.25;

/**
 * Two floors on the same footprint, each a row of rooms behind a corridor and a row in front.
 * Downstairs: the stair hall (the flight up its back wall), the kitchen and the guest toilet
 * behind; the parlour across the front, and a guest room from four bedrooms. Upstairs: the
 * landing over the stair hall, the master bedroom with its own bathroom behind; the other
 * bedrooms and the bathroom in front, a family lounge where there is width to spare.
 */
function duplex(brief: HomeBrief): HomePlan {
  const n = Math.max(3, Math.min(6, brief.bedrooms));
  const guestDown = n >= 4;
  const sum = (slots: DSlot[]) => slots.reduce((s, x) => s + x.width, 0);
  const gBack: DSlot[] = [{ kind: 'stairs', width: STAIR_HALL }, { kind: 'kitchen', width: KITCHEN_W }, { kind: 'bathroom', width: BATH_W }];
  const gFront: DSlot[] = [{ kind: 'parlour', width: PARLOUR_MIN }, ...(guestDown ? [{ kind: 'bedroom' as const, width: BEDROOM_W }] : [])];
  const uBack: DSlot[] = [{ kind: 'landing', width: STAIR_HALL }, { kind: 'bedroom', width: BEDROOM_W, master: true }];
  const uFrontBeds: DSlot[] = [];
  for (let others = n - (guestDown ? 1 : 0) - 1; others > 0; others--) {
    if (sum(uFrontBeds) + BATH_W <= sum(uBack)) uFrontBeds.push({ kind: 'bedroom', width: BEDROOM_W });
    else uBack.push({ kind: 'bedroom', width: BEDROOM_W });
  }
  const uFront: DSlot[] = [...uFrontBeds, { kind: 'bathroom', width: BATH_W }];
  const width = Math.max(sum(gBack), sum(gFront), sum(uBack), sum(uFront));
  // The width to spare: a study downstairs when there is room for one (else a bigger kitchen),
  // a bigger parlour, bigger bedrooms upstairs, or a family lounge over the parlour
  const spread = (slots: DSlot[], spare: number): void => {
    const takers = slots.filter((x) => x.kind === 'bedroom');
    for (const t of takers) t.width += spare / takers.length;
  };
  const backSpare = width - sum(gBack);
  if (backSpare >= 6) gBack.push({ kind: 'study', width: backSpare });
  else gBack[1].width += backSpare;
  gFront[0].width += width - sum(gFront);
  spread(uBack, width - sum(uBack));
  const frontSpare = width - sum(uFront);
  if (frontSpare >= 6 || (!uFrontBeds.length && frontSpare > 0.01)) uFront.unshift({ kind: 'lounge', width: frontSpare });
  else spread(uFront, frontSpare);

  const hw = width / 2;
  const depth = BACK_D + CORRIDOR + FRONT_D;
  const length = depth + STEP;
  const back = -length / 2;
  const corridorBack = back + BACK_D;
  const corridorFront = corridorBack + CORRIDOR;
  const frontZ = back + depth;
  const ground = begin();
  const upper = begin();
  ground.rooms.push({ id: 'corridor', kind: 'corridor', name: 'Corridor', minX: -hw, maxX: hw, minZ: corridorBack, maxZ: corridorFront });
  upper.rooms.push({ id: 'corridor_up', kind: 'corridor', name: 'Upstairs corridor', minX: -hw, maxX: hw, minZ: corridorBack, maxZ: corridorFront });

  const upBeds: Spot[] = [];
  let master: Spot | null = null;
  let guest: Spot | null = null;
  let bathSpot: Spot = { x: 0, z: 0, turns: 0, storey: 1 };
  let parlour: Rect = { minX: -hw, maxX: hw, minZ: corridorFront, maxZ: frontZ };
  let kitchen: Rect = { minX: 0, maxX: 0, minZ: back, maxZ: corridorBack };
  let bedNo = 1;

  const row = (p: Builder, slots: DSlot[], where: 'back' | 'front', storey: 0 | 1): void => {
    const minZ = where === 'back' ? back : corridorFront;
    const maxZ = where === 'back' ? corridorBack : frontZ;
    const doorZ = where === 'back' ? corridorBack : corridorFront;
    const swing: 1 | -1 = where === 'back' ? 1 : -1;
    const doors: number[] = [];
    let openTo = -hw;
    let x = -hw;
    slots.forEach((slot, i) => {
      const box: Rect = { minX: x, maxX: x + slot.width, minZ, maxZ };
      x = box.maxX;
      if (i > 0) p.walls.push({ axis: 'z', at: box.minX, from: minZ, to: maxZ, doors: [] });
      const door = (id: string, name: string, at: number) => {
        doors.push(at);
        p.doors.push({ id: `home_door_${id}`, name: `${name} door`, x: at, z: doorZ, yaw: 0, swing });
      };
      // The rooms open on the corridor (no wall between): the stair hall, the landing, the parlour, the lounge
      const open = (id: string, kind: RoomKind, name: string) => {
        p.rooms.push({ id, kind, name, ...box });
        if (i === 0) openTo = box.maxX;
      };
      if (slot.kind === 'stairs') open('stairhall', 'corridor', 'Stair hall');
      else if (slot.kind === 'landing') open('landing', 'corridor', 'Landing');
      else if (slot.kind === 'parlour') {
        parlour = box;
        open('parlour', 'parlour', 'Parlour');
      } else if (slot.kind === 'lounge') open('lounge', 'parlour', 'Family lounge');
      else if (slot.kind === 'study') {
        p.rooms.push({ id: 'study', kind: 'parlour', name: 'Study', ...box });
        door('study', 'Study', (box.minX + box.maxX) / 2);
      } else if (slot.kind === 'kitchen') {
        kitchen = box;
        p.rooms.push({ id: 'kitchen', kind: 'kitchen', name: 'Kitchen', ...box });
        door('kitchen', 'Kitchen', box.minX + 1.3);
        // A counter and sink along the back wall, the cooker at its end, the fridge on the end wall
        counter(p, 'x', back, 1, box.minX + HALF_T + 0.2, box.maxX - HALF_T - 1.6);
      } else if (slot.kind === 'bathroom') {
        const id = storey === 0 ? 'bathroom' : 'bathroom2';
        p.rooms.push({ id, kind: 'bathroom', name: storey === 0 ? 'Guest toilet' : 'Bathroom', ...box });
        door(id, storey === 0 ? 'Guest toilet' : 'Bathroom', (box.minX + box.maxX) / 2);
        const spot = fitBathroom(p, box, where === 'back' ? 'maxZ' : 'minZ');
        if (storey === 1) bathSpot = { ...spot, storey: 1 };
      } else if (storey === 0) {
        // The guest room, downstairs at the front
        const id = `bedroom${n}`;
        p.rooms.push({ id, kind: 'bedroom', name: 'Guest room', ...box });
        door(id, 'Guest room', box.minX + 1.3);
        guest = where === 'front' ? { x: (box.minX + box.maxX) / 2, z: frontZ - HALF_T - 1.2, turns: 2, storey: 0 } : { x: (box.minX + box.maxX) / 2, z: back + HALF_T + 1.2, turns: 0, storey: 0 };
      } else if (slot.master) {
        p.rooms.push({ id: 'bedroom1', kind: 'bedroom', name: 'Master bedroom', ...box });
        door('bedroom1', 'Master bedroom', box.minX + 1.3);
        // Its own bathroom, in its front corner by the corridor, the door on the bedroom
        const en: Rect = { minX: box.maxX - ENSUITE, maxX: box.maxX, minZ: corridorBack - ENSUITE, maxZ: corridorBack };
        p.rooms.push({ id: 'ensuite1', kind: 'ensuite', name: 'Master bathroom', ...en });
        const enDoor = en.minZ + 1.3;
        p.walls.push({ axis: 'z', at: en.minX, from: en.minZ, to: en.maxZ, doors: [enDoor] });
        p.walls.push({ axis: 'x', at: en.minZ, from: en.minX, to: en.maxX, doors: [] });
        p.doors.push({ id: 'home_door_ensuite1', name: 'Master bathroom door', x: en.minX, z: enDoor, yaw: Math.PI / 2, swing: 1 });
        fitBathroom(p, en, 'minX');
        master = { x: box.minX + HALF_T + 2.4, z: back + HALF_T + 1.2, turns: 0, storey: 1 };
      } else {
        bedNo += 1;
        const id = `bedroom${bedNo}`;
        p.rooms.push({ id, kind: 'bedroom', name: `Bedroom ${bedNo}`, ...box });
        door(id, `Bedroom ${bedNo}`, box.minX + 1.3);
        upBeds.push(where === 'front' ? { x: (box.minX + box.maxX) / 2, z: frontZ - HALF_T - 1.2, turns: 2, storey: 1 } : { x: (box.minX + box.maxX) / 2, z: back + HALF_T + 1.2, turns: 0, storey: 1 });
      }
    });
    // The corridor's wall along this row, but where a room is open on it
    if (openTo < hw - 0.05) p.walls.push({ axis: 'x', at: doorZ, from: openTo, to: hw, doors });
  };
  row(ground, gBack, 'back', 0);
  row(ground, gFront, 'front', 0);
  row(upper, uBack, 'back', 1);
  row(upper, uFront, 'front', 1);

  // The flight: eighteen risers up the stair hall's back wall, its foot by the side wall. A
  // landing at each end wide enough to stand on: rooms keep people 0.8 m off their outer walls
  const slotMinX = -hw;
  const slotMaxX = -hw + STAIR_HALL;
  const x0 = slotMinX + HALF_T + 1.1;
  const x1 = x0 + (RISERS - 1) * GOING;
  const sMinZ = back + HALF_T;
  const sMaxZ = sMinZ + 1.3;
  const mid = (sMinZ + sMaxZ) / 2;
  const stairs: Stairs = {
    x0, x1, minZ: sMinZ, maxZ: sMaxZ, slotMinX, slotMaxX, risers: RISERS,
    foot: { x: x0 - 0.45, z: mid },
    top: { x: x1 + 0.6, z: mid },
    landing: { x: x1 + 0.6, z: sMaxZ + 1.5 },
  };

  const sofaZ = corridorFront + 3.0;
  const entrance = { x: parlour.maxX - 2.4, z: frontZ };
  const centre = (r: PlanRoom) => ({ x: (r.minX + r.maxX) / 2, z: (r.minZ + r.maxZ) / 2 });
  const lightsWith = (rooms: PlanRoom[], hall: string) => {
    const lit = lightsOf(rooms);
    const h = rooms.find((r) => r.id === hall);
    if (h) lit.splice(1, 0, centre(h));
    return lit;
  };
  const backWindows = (rooms: PlanRoom[]) => rooms.filter((r) => r.minZ === back && r.kind !== 'ensuite' && r.kind !== 'corridor').map((r) => ({ wall: 'back' as const, at: r.kind === 'bedroom' ? (r.minX + r.maxX) / 2 : r.minX + 1.6 }));
  const sideWindows = [{ wall: 'left' as const, at: (corridorFront + frontZ) / 2 }, { wall: 'right' as const, at: (corridorFront + frontZ) / 2 }, { wall: 'right' as const, at: back + BACK_D / 2 }];
  const beds = [...upBeds, ...(guest ? [guest] : [])];
  return {
    key: keyOf(brief),
    brief,
    width,
    length,
    frontZ,
    ...ground,
    entrance,
    spawn: { x: entrance.x, z: frontZ - 2.2 },
    windows: [...backWindows(ground.rooms), ...sideWindows, { wall: 'left', at: back + BACK_D / 2 + 1.2 }],
    lights: lightsWith(ground.rooms, 'stairhall'),
    spots: {
      bed: master ?? { x: 0, z: back + 1.6, turns: 0, storey: 1 },
      beds,
      sofa: { x: -hw + 3.8, z: sofaZ, turns: 3 },
      tv: { x: -hw + HALF_T + 0.3, z: sofaZ, turns: 1 },
      fridge: { x: kitchen.maxX - HALF_T - 0.46, z: back + HALF_T + 2.0, turns: 3 },
      drum: { x: kitchen.maxX - HALF_T - 0.65, z: corridorBack - HALF_T - 0.8, turns: 3 },
      cooker: { x: kitchen.maxX - HALF_T - 0.8, z: back + HALF_T + 0.42, turns: 0 },
      bath: bathSpot,
      dining: { x: parlour.maxX - 4.6, z: frontZ - 2.4, turns: 0 },
      extras: [
        { what: 'rug', x: -hw + 2.2, z: sofaZ, turns: 0 },
        { what: 'plant', x: -hw + 0.8, z: frontZ - 0.8, turns: 0 },
        { what: 'fan', x: -hw + 0.7, z: corridorFront + 0.9, turns: 1 },
        { what: 'plant', x: slotMaxX - 0.8, z: corridorBack - 0.8, turns: 0, storey: 1 },
      ],
    },
    carport: brief.carport,
    storeys: 2,
    upper: {
      ...upper,
      windows: [...backWindows(upper.rooms), ...sideWindows, { wall: 'left', at: back + BACK_D / 2 + 1.2 }],
      lights: lightsWith(upper.rooms, 'landing'),
    },
    stairs,
  };
}

/** The room a point is in, or null if it is in a wall or outside; upstairs in a duplex when `storey` is 1 */
export function roomAt(plan: HomePlan, x: number, z: number, storey = 0): PlanRoom | null {
  // A bathroom sits inside its bedroom: the smaller room is the one meant
  let best: PlanRoom | null = null;
  for (const room of storey === 1 && plan.upper ? plan.upper.rooms : plan.rooms) {
    if (x > room.minX + HALF_T && x < room.maxX - HALF_T && z > room.minZ + HALF_T && z < room.maxZ - HALF_T) {
      if (!best || (room.maxX - room.minX) * (room.maxZ - room.minZ) < (best.maxX - best.minX) * (best.maxZ - best.minZ)) best = room;
    }
  }
  return best;
}
