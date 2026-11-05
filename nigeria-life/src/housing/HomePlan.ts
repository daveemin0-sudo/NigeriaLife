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
}

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
  return `${brief.kind}:${brief.bedrooms}:${brief.carport ? 'c' : '-'}:v3`;
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
  };
}

/** The room a point is in, or null if it is in a wall or outside */
export function roomAt(plan: HomePlan, x: number, z: number): PlanRoom | null {
  // A bathroom sits inside its bedroom: the smaller room is the one meant
  let best: PlanRoom | null = null;
  for (const room of plan.rooms) {
    if (x > room.minX + HALF_T && x < room.maxX - HALF_T && z > room.minZ + HALF_T && z < room.maxZ - HALF_T) {
      if (!best || (room.maxX - room.minX) * (room.maxZ - room.minZ) < (best.maxX - best.minX) * (best.maxZ - best.minZ)) best = room;
    }
  }
  return best;
}
