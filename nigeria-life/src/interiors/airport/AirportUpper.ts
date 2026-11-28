import * as THREE from 'three';
import type { Builder } from '../../world/kit/ArchKit';
import type { Item } from '../../backend/types';
import type { PlaceSpec, PlaceInterior, StationChoice } from '../places/PlaceInterior';
import type { PlaceHost } from '../../destinations/PlaceActions';
import { Sequence, steps } from '../../interactions/Sequence';
import { parkedAirliners } from '../../world/landmarks/OutdoorAirliner';
import { LIVERIES } from './Airliner';
import { Escalator, GlassLift, rideLift, rideStair } from './Vertical';
import {
  ESCALATOR_RUN, HALL, HALL_DOWN_OFF, HALL_LIFT, LEVEL_RISE, UPPER_FOOT, UPPER_KEY, UPPER_LIFT, UPPER_ROOM, UPPER_TOP, UPPER_WELL,
} from './Levels';

/**
 * The terminal's upper level, over the main hall: a food court along one side (amala, suya, cold
 * drinks and small chops), a duty-free shop of things made in Nigeria along the other, tables in
 * between, and a glass wall at the back over the apron where people sit and watch the aircraft.
 * The escalators and the glass lift come up through the floor at the front; the stairs by them go
 * down too. Everyone behind a counter greets a customer who walks up.
 */

const need = (changes: Record<string, number>) => (backend: { modifyNeed(n: never, v: number): void }) => {
  for (const [k, v] of Object.entries(changes)) backend.modifyNeed(k as never, v);
};
const item = (id: string, name: string, icon: string, price: number, category: Item['category'] = 'food', energyRestore?: number): Omit<Item, 'quantity'> => ({
  id, name, icon, price, category, usable: category === 'food', description: `Bought on the upper level at the airport. ${name}.`, energyRestore,
});
const meal = (label: string, price: number, hunger: number, said: string, fun = 3): StationChoice => ({ label, price, note: `Hunger +${hunger}`, sit: true, seconds: 5, effect: need({ hunger, fun }), said });
const drink = (label: string, price: number, energy: number, said: string): StationChoice => ({ label, price, note: 'A drink', arms: 'reach', seconds: 2, effect: need({ hunger: 4, energy }), said });
const buy = (label: string, price: number, it: Omit<Item, 'quantity'>, said: string): StationChoice => ({ label, price, note: 'Into your bag', item: it, said, arms: 'reach', seconds: 1.8 });

const W = UPPER_ROOM.width / 2;
const L = UPPER_ROOM.length / 2;
const TABLES: Array<[number, number]> = [];
for (const x of [-12.5, -8.5, -4.5]) for (const z of [-7.5, -3.5, 0.5, 4.5]) TABLES.push([x, z]);

/** A counter with a top, and what stands on it */
function counter(b: Builder, x: number, z: number, length: number, colour: number): void {
  b.box(colour, 0.9, 1.0, length, x, 0, z, { solid: true });
  b.box(0xe7e5e4, 1.05, 0.06, length + 0.1, x, 1.0, z, { solid: false });
}

function build(b: Builder): void {
  // --- The food court, along the west wall ---
  // Iya Basira's amala spot: green counter, steel pots, the menu lit on the wall
  counter(b, -17.6, -7, 3.4, 0x15803d);
  for (let i = 0; i < 4; i++) b.cylinder(0x9ca3af, 0.24, 0.34, -17.6, 1.06, -8.3 + i * 0.85, { sides: 14, solid: false });
  b.box(0xfacc15, 0.06, 1.2, 3.0, -W + 0.25, 2.0, -7, { glow: true, solid: false });
  b.box(0x14532d, 0.08, 0.5, 3.2, -W + 0.24, 3.3, -7, { solid: false });
  // Mallam Sani's suya: a glowing grill under a hood, sticks on it, a red counter
  counter(b, -17.6, -1.5, 3.0, 0x7c2d12);
  b.box(0xf97316, 0.7, 0.04, 1.8, -17.6, 1.08, -1.5, { glow: true, solid: false });
  for (let i = 0; i < 9; i++) b.box(0x5b2410, 0.5, 0.04, 0.05, -17.6, 1.13, -2.3 + i * 0.2, { solid: false });
  b.box(0x3f3f46, 1.0, 0.5, 2.2, -18.6, 2.9, -1.5, { solid: false });
  // Ada's drinks bar: a blue counter, a glass-fronted fridge behind
  counter(b, -17.6, 4.0, 3.0, 0x0e7490);
  b.box(0x1e3a8a, 0.8, 2.0, 1.6, -19.4, 0, 4.0, { solid: true });
  b.box(0x7dd3fc, 0.04, 1.6, 1.4, -18.98, 0.25, 4.0, { glow: true, solid: false });
  for (let i = 0; i < 6; i++) b.box([0xdc2626, 0xf97316, 0x16a34a][i % 3], 0.12, 0.3, 0.12, -17.6, 1.06, 3.0 + i * 0.4, { solid: false });

  // --- Tables for eating, with their chairs ---
  for (const [x, z] of TABLES) {
    b.box(0xf8fafc, 1.2, 0.76, 0.9, x, 0, z, { solid: true });
    for (const side of [-1, 1]) {
      b.box(0x7c2d12, 0.46, 0.45, 0.46, x, 0, z + side * 0.85, { solid: false });
      b.box(0x7c2d12, 0.46, 0.5, 0.06, x, 0.45, z + side * 1.06, { solid: false });
    }
  }

  // --- Duty free, along the east wall: shelves of goods, a counter ---
  for (let z = -9.5; z <= 3.5; z += 2.6) {
    b.box(0xe7e5e4, 0.6, 2.2, 2.4, W - 0.55, 0, z, { solid: true });
    for (let r = 0; r < 3; r++) for (let i = 0; i < 5; i++) b.box([0x7c3aed, 0xdb2777, 0xf59e0b, 0x0f766e, 0x1e3a8a][(i + r) % 5], 0.3, 0.32, 0.3, W - 0.7, 0.45 + r * 0.6, z - 0.95 + i * 0.47, { solid: false });
  }
  counter(b, 14.5, -3, 2.8, 0x1e293b);
  b.box(0xfbbf24, 0.5, 0.25, 0.4, 14.5, 1.06, -3.8, { solid: false });

  // --- The viewing gallery: benches facing the glass, the aircraft beyond ---
  for (const x of [-1, 3.5, 8, 12.5]) {
    b.box(0x374151, 2.6, 0.45, 0.6, x, 0, -L + 2.2, { solid: true });
    b.box(0x111827, 2.6, 0.06, 0.62, x, 0.45, -L + 2.2, { solid: false });
  }

  // --- Round the escalator well and the lift: a steel kerb, posts and a top rail (the glass is added after) ---
  const w = UPPER_WELL;
  for (const [x0, x1, z0, z1] of [[w.minX, w.minX, w.minZ, w.maxZ], [w.maxX, w.maxX, w.minZ, w.maxZ], [w.minX, w.maxX, w.maxZ, w.maxZ]] as const) {
    const len = Math.hypot(x1 - x0, z1 - z0);
    const alongX = x1 !== x0;
    b.box(0x9ca3af, alongX ? len : 0.12, 0.12, alongX ? 0.12 : len, (x0 + x1) / 2, 0, (z0 + z1) / 2, { solid: false });
    b.box(0x9ca3af, alongX ? len : 0.08, 0.06, alongX ? 0.08 : len, (x0 + x1) / 2, 1.05, (z0 + z1) / 2, { solid: false });
  }
  for (let z = w.minZ; z <= w.maxZ + 0.01; z += 1.48) for (const x of [w.minX, w.maxX]) b.box(0x9ca3af, 0.06, 1.05, 0.06, x, 0, z, { solid: false });
  // Plants by the glass, and a big flag
  for (const [x, z] of [[-18.6, -10.8], [18.6, -10.8], [-18.6, 10.8], [18.6, 10.8]] as const) {
    b.cylinder(0x78350f, 0.35, 0.6, x, 0, z, { sides: 12, solid: true });
    b.dome(0x15803d, 0.6, x, 0.6, z, { solid: false });
  }
}

/** Hangs the glass, opens the floor for the escalators and the lift, and puts the aircraft outside */
function attach(room: PlaceInterior): void {
  const g = room.group;
  const glass = new THREE.MeshStandardMaterial({ color: 0xbfe0f2, transparent: true, opacity: 0.16, roughness: 0.05, metalness: 0.2, depthWrite: false, side: THREE.DoubleSide });

  // The back wall is glass, floor to ceiling, between slim mullions: the apron is outside it
  const back = g.getObjectByName('shell_wall_back') as THREE.Mesh | undefined;
  if (back) {
    back.material = glass;
    back.children.forEach((c) => { c.visible = false; });
    for (let x = -W; x <= W + 0.01; x += 4) {
      const mullion = new THREE.Mesh(new THREE.BoxGeometry(0.12, UPPER_ROOM.height, 0.14), new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.6, roughness: 0.4 }));
      mullion.position.set(x, UPPER_ROOM.height / 2, -L);
      g.add(mullion);
    }
  }

  // The floor, laid round the escalator well and the lift shaft (one slab, cut into pieces round the holes)
  const floor = g.getObjectByName('interior_floor_mesh') as THREE.Mesh | undefined;
  if (floor) {
    const old = floor.geometry as THREE.BoxGeometry;
    old.computeBoundingBox();
    const box = old.boundingBox!;
    const thick = box.max.y - box.min.y;
    const fw = box.max.x - box.min.x;
    const fl = box.max.z - box.min.z;
    const w = UPPER_WELL;
    const f = UPPER_LIFT;
    const pieces: Array<[number, number, number, number]> = [
      [-fw / 2, f.minX, -fl / 2, fl / 2],
      [w.maxX, fw / 2, -fl / 2, fl / 2],
      [f.minX, w.minX, -fl / 2, f.minZ],
      [f.minX, f.maxX, f.maxZ, fl / 2],
      [f.maxX, w.minX, f.minZ, fl / 2],
      [w.minX, w.maxX, -fl / 2, w.minZ],
      [w.minX, w.maxX, w.maxZ, fl / 2],
    ];
    const parts = pieces.filter(([x0, x1, z0, z1]) => x1 - x0 > 0.01 && z1 - z0 > 0.01).map(([x0, x1, z0, z1]) => {
      const piece = new THREE.BoxGeometry(x1 - x0, thick, z1 - z0);
      // Tiles the same size as on the whole floor: the texture is repeated for the whole room
      const uv = piece.getAttribute('uv');
      for (let i = 0; i < uv.count; i++) uv.setXY(i, (x0 + fw / 2) / fw + uv.getX(i) * ((x1 - x0) / fw), (z0 + fl / 2) / fl + uv.getY(i) * ((z1 - z0) / fl));
      piece.translate((x0 + x1) / 2, (box.max.y + box.min.y) / 2, (z0 + z1) / 2);
      return piece.toNonIndexed();
    });
    floor.geometry = mergeAll(parts);
    old.dispose();
  }
  // Under the holes: the hall below, its floor a storey down, and the lawn moved down out of the way
  const plot = g.getObjectByName('interior_ground_plot');
  if (plot) plot.position.y = -LEVEL_RISE - 0.6;
  const hallFloor = new THREE.Mesh(new THREE.PlaneGeometry(12, 16), new THREE.MeshStandardMaterial({ color: 0xd9dadc, roughness: 0.6 }));
  hallFloor.rotation.x = -Math.PI / 2;
  hallFloor.position.set(4, -LEVEL_RISE, 6);
  g.add(hallFloor);

  // Glass round the well, on its three open sides
  const w = UPPER_WELL;
  for (const [x, z, len, alongX] of [[w.minX, (w.minZ + w.maxZ) / 2, w.maxZ - w.minZ, false], [w.maxX, (w.minZ + w.maxZ) / 2, w.maxZ - w.minZ, false], [(w.minX + w.maxX) / 2, w.maxZ, w.maxX - w.minX, true]] as const) {
    const pane = new THREE.Mesh(new THREE.BoxGeometry(alongX ? len : 0.03, 1.0, alongX ? 0.03 : len), glass);
    pane.position.set(x, 0.55, z);
    g.add(pane);
  }

  // The escalators, coming up through the well from the hall below; the glass lift in its shaft
  const up = new Escalator({ x: 4.6, z: UPPER_FOOT, rise: LEVEL_RISE, run: ESCALATOR_RUN, up: true });
  const down = new Escalator({ x: 5.85, z: UPPER_FOOT, rise: LEVEL_RISE, run: ESCALATOR_RUN, up: false });
  up.group.position.y = -LEVEL_RISE;
  down.group.position.y = -LEVEL_RISE;
  const lift = new GlassLift({ x: UPPER_LIFT.x, z: UPPER_LIFT.z, yaw: Math.PI, travel: -LEVEL_RISE, shaft: UPPER_ROOM.height, below: LEVEL_RISE });
  g.add(up.group, down.group, lift.group);
  room.ticks.push((delta) => { up.tick(delta); down.tick(delta); lift.tick(delta); });
  room.block(w.minX - 0.1, (w.minZ + w.maxZ) / 2, (w.maxX - w.minX) / 2 + 0.15, (w.maxZ - w.minZ) / 2 + 0.05, 1.1);
  room.block(UPPER_LIFT.x, UPPER_LIFT.z, 1.05, 1.0, 2.5);

  // Outside the glass: the apron a storey down, two aircraft at their stands, the runway beyond
  const outside = new THREE.Group();
  outside.name = 'apron below the gallery';
  const tarmac = new THREE.Mesh(new THREE.PlaneGeometry(140, 70), new THREE.MeshStandardMaterial({ color: 0x9ca3af, roughness: 0.9 }));
  tarmac.rotation.x = -Math.PI / 2;
  tarmac.position.set(0, -LEVEL_RISE, -L - 35);
  const runway = new THREE.Mesh(new THREE.PlaneGeometry(160, 11), new THREE.MeshStandardMaterial({ color: 0x27272a, roughness: 0.9 }));
  runway.rotation.x = -Math.PI / 2;
  runway.position.set(0, -LEVEL_RISE + 0.02, -L - 58);
  const line = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 26), new THREE.MeshBasicMaterial({ color: 0xfacc15 }));
  line.rotation.x = -Math.PI / 2;
  outside.add(tarmac, runway);
  for (const x of [-9, 17]) {
    const l = line.clone();
    l.position.set(x, -LEVEL_RISE + 0.03, -L - 17);
    outside.add(l);
  }
  const noseIn = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), -Math.PI / 2);
  outside.add(parkedAirliners('atr', LIVERIES.nigerialife, [-9, 17].map((x) => new THREE.Matrix4().compose(new THREE.Vector3(x, -LEVEL_RISE, -L - 19), noseIn, new THREE.Vector3(1, 1, 1)))));
  g.add(outside);

  // --- Going down: the escalator, the lift, and the stairs (the door at the front) ---
  const hallAt = (x: number, z: number) => new THREE.Vector3(HALL.origin.x + x, 0, HALL.origin.z + z);
  room.addCard({
    id: 'airport_upper_escalator', name: '⬇ Escalator down', description: 'Down to check-in, security, the gates and arrivals.',
    at: [5.85, UPPER_TOP - 0.6], stand: [5.85, UPPER_TOP - 1.6],
    label: () => '⬇ Escalator down to the main hall',
    run: (host: PlaceHost) => {
      const actor = host.actor;
      if (host.director.interrupt(actor) === 'locked') return;
      const ride = new Sequence('escalator down', [actor]).locked().add(
        steps.walk(actor, room.at(5.85, UPPER_TOP - 1.4), { ifStuck: 'snap' }),
        steps.face(actor, 0),
        steps.slide(actor, room.at(5.85, UPPER_TOP), 0.6),
        rideStair(actor, room.at(5.85, UPPER_TOP), room.at(5.85, UPPER_FOOT), 0, -LEVEL_RISE, 7),
      );
      ride.onEnd((reason) => {
        actor.root.position.y = 0;
        if (reason === 'done') host.ride(HALL.id, hallAt(HALL_DOWN_OFF.x, HALL_DOWN_OFF.z), 0);
      });
      host.director.run(ride);
    },
  });
  room.addCard({
    id: 'airport_upper_lift', name: '🛗 Glass lift', description: 'Down to the main hall.',
    at: [UPPER_LIFT.x, UPPER_LIFT.z - 1.2], stand: [UPPER_LIFT.x, UPPER_LIFT.stand],
    label: () => '🛗 Lift down to the main hall',
    run: (host: PlaceHost) => {
      const actor = host.actor;
      if (host.director.interrupt(actor) === 'locked') return;
      const inside = room.at(UPPER_LIFT.x, UPPER_LIFT.z);
      const ride = new Sequence('lift down', [actor]).locked().add(
        steps.walk(actor, room.at(UPPER_LIFT.x, UPPER_LIFT.stand), { ifStuck: 'snap' }),
        steps.face(actor, inside),
        steps.animate(actor, { arms: 'reach' }, 0.6, [{ at: 0.5, run: () => lift.doors(true) }]),
        steps.wait(0.7),
        steps.slide(actor, inside, 0.9, { legs: 'walk', arms: 'swing' }),
        steps.face(actor, 0),
        steps.call('doors close', () => { lift.doors(false); }),
        steps.wait(0.6),
        rideLift(actor, lift, 1),
      );
      ride.onEnd((reason) => {
        actor.root.position.y = 0;
        lift.send(0);
        lift.doors(false);
        if (reason === 'done') host.ride(HALL.id, hallAt(HALL_LIFT.x, HALL_LIFT.stand), 0);
      });
      host.director.run(ride);
    },
  });
  // The stairs by the escalators: the room's door at the front, down to the hall
  room.leadsTo = () => ({ id: HALL.id, spawnAt: hallAt(HALL_DOWN_OFF.x - 1.4, HALL_DOWN_OFF.z), spawnYaw: 0 });
}

function mergeAll(parts: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const out = new THREE.BufferGeometry();
  for (const name of ['position', 'normal', 'uv']) {
    const arrays = parts.map((p) => p.getAttribute(name).array as Float32Array);
    const size = parts[0].getAttribute(name).itemSize;
    const merged = new Float32Array(arrays.reduce((n, a) => n + a.length, 0));
    let at = 0;
    for (const a of arrays) { merged.set(a, at); at += a.length; }
    out.setAttribute(name, new THREE.BufferAttribute(merged, size));
  }
  out.computeBoundingBox();
  out.computeBoundingSphere();
  return out;
}

export const AIRPORT_UPPER: PlaceSpec = {
  key: UPPER_KEY,
  name: 'Upper Level · Food Court, Duty Free & Viewing Gallery',
  district: 'Airport · upper level',
  streetId: 'airport-upper-level',
  comeOut: [-53, 0, 6268.8],
  room: { width: UPPER_ROOM.width, length: UPPER_ROOM.length, height: UPPER_ROOM.height, floor: 0xe8e4dc, wall: 0xf2efe9, finish: 'terrazzo' },
  sign: { text: 'UPPER LEVEL', sub: 'Food Court · Duty Free · Viewing Gallery', bg: '#0b7a43' },
  door: { name: 'Stairs down to the main hall', category: 'Airport · Upper level', description: 'Down to check-in, security, the gates and arrivals.' },
  build: (b) => build(b),
  attach,
  staff: [
    { name: 'Iya Basira', title: 'Amala Spot', at: [-18.7, -7], facing: Math.PI / 2, outfit: 0x15803d, gender: 'female', chef: true, says: 'Amala dey hot! Come and chop.' },
    { name: 'Mallam Sani', title: 'Suya', at: [-18.7, -1.5], facing: Math.PI / 2, outfit: 0xf8fafc, gender: 'male', cap: true, says: 'Fresh suya, hot from the fire.' },
    { name: 'Ada', title: 'Drinks bar', at: [-18.7, 4.0], facing: Math.PI / 2, outfit: 0x0e7490, gender: 'female', says: 'Chilled drinks and small chops!' },
    { name: 'Chiamaka', title: 'Naija Duty Free', at: [15.7, -3], facing: -Math.PI / 2, outfit: 0x7c3aed, gender: 'female', says: 'Made in Nigeria, the best gifts.' },
  ],
  regulars: [
    { at: [-12.5, -8.35], facing: 0, outfit: 0x2563eb, sit: true },
    { at: [-8.5, -2.65], facing: Math.PI, outfit: 0xdb2777, sit: true, gender: 'female' },
    { at: [-4.5, 3.65], facing: 0, outfit: 0x16a34a, sit: true },
    { at: [-12.5, 5.35], facing: Math.PI, outfit: 0xf59e0b, sit: true, gender: 'female' },
    { at: [3.5, -L + 2.2], facing: Math.PI, outfit: 0x0f766e, sit: true },
    { at: [12.0, -L + 2.2], facing: Math.PI, outfit: 0xbe185d, sit: true, gender: 'female' },
    { at: [9, -6], facing: -2.2, outfit: 0x111827 },
  ],
  stations: [
    { id: 'amala', name: '🍲 Iya Basira’s Amala Spot', at: [-17.6, -7], stand: [-16.3, -7], who: 'Iya Basira', role: 'Amala Spot · Upper Level', text: 'Ehen! Welcome, my customer! Amala dey hot, ewedu fresh, gbegiri sweet well well. Wetin I go serve you?', choices: [
      meal('Amala, ewedu, gbegiri and assorted meat', 5500, 65, 'Soft hot amala with gbegiri and ewedu, assorted on top. Your fingers smelt of it for hours.', 6),
      meal('Amala with goat meat', 7000, 70, 'Goat meat in pepper sauce over amala. Correct!'),
      meal('Ofada rice and ayamase', 6500, 60, 'Ofada rice in leaves with green pepper ayamase. Sweet.'),
      meal('Pounded yam and egusi', 7500, 75, 'Smooth pounded yam, thick egusi with stockfish.'),
      buy('A takeaway pack of amala for later', 5000, item('airport_amala_pack', 'Takeaway amala & ewedu', '🥡', 5000, 'food', 20), 'Packed in foil and nylon, still hot.'),
    ] },
    { id: 'suya', name: '🍢 Mallam Sani’s Suya', at: [-17.6, -1.5], stand: [-16.3, -1.5], who: 'Mallam Sani', role: 'Suya · Upper Level', text: 'Sannu! Fresh suya, hot from the fire: beef, chicken, kidney. How many sticks?', choices: [
      meal('Beef suya, four sticks, with onions', 3000, 30, 'Pepper heat, yaji, raw onions. Hot!', 5),
      meal('Chicken suya', 3500, 32, 'Smoky chicken suya wrapped in paper.', 5),
      buy('A pack of kilishi', 4000, item('airport_kilishi', 'Pack of kilishi', '🥩', 4000, 'food', 15), 'Dry spiced kilishi, for the journey.'),
    ] },
    { id: 'drinks', name: '🥤 Ada’s Drinks Bar', at: [-17.6, 4.0], stand: [-16.3, 4.0], who: 'Ada', role: 'Drinks & small chops · Upper Level', text: 'Welcome! Chilled Chapman, zobo, fresh juice, small chops. What will you have?', choices: [
      drink('Chapman, with ice', 2500, 8, 'Chapman with cucumber and ice. Refreshing.'),
      drink('Chilled zobo with ginger', 1200, 5, 'Cold zobo with a ginger kick.'),
      drink('Fresh pineapple juice', 2000, 6, 'Sweet fresh pineapple.'),
      meal('A plate of small chops', 4000, 25, 'Samosa, spring rolls, puff-puff and peppered gizzard.', 4),
    ] },
    { id: 'dutyfree', name: '🛍️ Naija Duty Free', at: [14.5, -3], stand: [13.2, -3], who: 'Chiamaka', role: 'Naija Duty Free · Made in Nigeria', text: 'Welcome to Naija Duty Free! Everything here is made in Nigeria. For you, or for a gift?', choices: [
      buy('Ankara tote bag', 18000, item('airport_ankara_tote', 'Ankara tote bag', '👜', 18000, 'luxury'), 'Bright Ankara, lined inside. A good gift.'),
      buy('Aso-oke cap (fila)', 9000, item('airport_fila', 'Aso-oke fila', '🧢', 9000, 'luxury'), 'Hand-woven aso-oke, folded the Yoruba way.'),
      buy('Roasted cashew nuts', 4500, item('airport_cashew', 'Roasted cashew nuts', '🥜', 4500, 'food', 10), 'Salted cashew from Ogbomoso.'),
      buy('Nigerian dark chocolate', 3500, item('airport_chocolate', 'Nigerian dark chocolate', '🍫', 3500, 'food', 8), 'Made from Ondo cocoa.'),
      buy('A small talking drum', 12000, item('airport_talking_drum', 'Small talking drum', '🪘', 12000, 'luxury'), 'Goat-skin dundun, it really talks.'),
      buy('Perfume, 100 ml', 45000, item('airport_perfume', 'Perfume (100 ml)', '🧴', 45000, 'luxury'), 'Wrapped in tissue in a gift bag.'),
    ] },
    { id: 'gallery', name: '✈️ Viewing gallery', at: [3.5, -L + 0.8], stand: [3.5, -L + 3.2], who: 'Viewing gallery', role: 'Upper Level', text: 'The aircraft on their stands below, the runway beyond. Sit a while?', choices: [
      { label: 'Sit and watch the planes', note: 'Fun +12 · Energy +4', sit: true, seconds: 15, effect: need({ fun: 12, energy: 4 }), said: 'You watched the ground crew load the bags and a plane push back. Peaceful.' },
      { label: 'Take a photo of the aircraft', note: 'Fun +6', arms: 'reach', seconds: 2, effect: need({ fun: 6 }), said: 'A clean shot of the tail with the runway behind. One for the status.' },
    ] },
  ],
};
