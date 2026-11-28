import * as THREE from 'three';
import type { Builder } from '../../world/kit/ArchKit';
import type { Item } from '../../backend/types';
import type { PlaceSpec, PlaceInterior, StationChoice } from '../places/PlaceInterior';
import type { PlaceHost } from '../../destinations/PlaceActions';
import { Sequence, steps } from '../../interactions/Sequence';
import { parkedAirliners } from '../../world/landmarks/OutdoorAirliner';
import { LIVERIES } from './Airliner';
import { Escalator, GlassLift, rideLift, rideStair } from './Vertical';
import { Kit, M, signMesh } from './TerminalKit';
import { GoodsMesh, stockRun } from '../mall/Goods';
import { bench, planter, diningChair, diningTable, relight } from '../mall/MallKit';
import { addSeats, chairsRound, type Seat } from '../places/PlaceSeats';
import { MallCrowd, MallPlayer, type CrowdSpot } from '../mall/MallCrowd';
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
/** The gallery's benches, along the glass */
const BENCHES = [-1, 3.5, 8, 12.5];
for (const x of [-12.5, -8.5, -4.5]) for (const z of [-7.5, -3.5, 0.5, 4.5]) TABLES.push([x, z]);

/** Every seat: four chairs at each table, the gallery's benches facing the glass */
function allSeats(): Seat[] {
  const seats: Seat[] = [];
  TABLES.forEach(([x, z], i) => seats.push(...chairsRound(x, z, 1.8, 0.9, 0, `table_${i}`)));
  for (const x of BENCHES) for (const t of [-0.75, 0, 0.75]) seats.push({ x: x + t, z: -L + 2.2, yaw: Math.PI, top: 0.48, group: `gallery_${x}` });
  return seats;
}
const SEATS = allSeats();
/** About one seat in three has a traveller in it already */
const CROWD_SEATS = SEATS.filter((_, i) => i % 3 === 1);
const FREE_SEATS = SEATS.filter((s) => !CROWD_SEATS.includes(s));

/** A food counter: a soft-edged front in the stall's colour, a stone top, its menu lit on the wall behind */
function counter(k: Kit, group: THREE.Group, b: Builder, x: number, z: number, length: number, front: THREE.Material, menu: string[], colour: string): void {
  k.soft(front, 0.9, 1.0, length, x, 0, z, 0.06);
  k.box(M.floorDark, 1.05, 0.05, length + 0.1, x, 1.0, z);
  k.box(M.steel, 0.7, 0.9, length, -W + 0.4, 0, z);
  b.occupy(x - 0.45, x + 0.45, z - length / 2, z + length / 2, 1.05);
  b.occupy(-W, -W + 0.8, z - length / 2, z + length / 2, 0.95);
  const sign = signMesh(menu, Math.min(length, 3.2), 0.95, { bg: colour, fg: '#ffffff', density: 120, accent: 'rgba(255,255,255,0.55)' });
  sign.position.set(-W + 0.12, 2.9, z);
  sign.rotation.y = Math.PI / 2;
  group.add(sign);
}

function build(b: Builder, group: THREE.Group): void {
  const k = new Kit();
  const signs = new THREE.Group();
  signs.name = 'upper level signs';
  const goods = new GoodsMesh();
  const glow = (hex: number) => new THREE.MeshBasicMaterial({ color: hex, toneMapped: false });

  // --- The food court, along the west wall ---
  // Iya Basira's amala spot: steel pots of amala, ewedu and gbegiri on the counter
  counter(k, signs, b, -17.6, -7, 3.4, M.green, ['IYA BASIRA’S AMALA SPOT', 'Amala · Ewedu · Gbegiri · Ofada'], '#166534');
  for (let i = 0; i < 4; i++) k.cyl(M.steel, 0.22, 0.25, 0.32, -17.6, 1.05, -8.3 + i * 0.85, 16).cyl(M.chrome, 0.23, 0.23, 0.02, -17.6, 1.37, -8.3 + i * 0.85, 16);
  // Mallam Sani's suya: a glowing grill under a hood, sticks on it
  counter(k, signs, b, -17.6, -1.5, 3.0, M.woodDark, ['MALLAM SANI’S SUYA', 'Beef · Chicken · Kilishi'], '#7c2d12');
  k.box(glow(0xf97316), 0.7, 0.03, 1.8, -17.6, 1.06, -1.5);
  for (let i = 0; i < 9; i++) k.box(M.woodDark, 0.5, 0.04, 0.05, -17.6, 1.1, -2.3 + i * 0.2);
  k.box(M.metalDark, 1.0, 0.5, 2.2, -18.6, 2.9, -1.5);
  // Ada's drinks bar: a glass-fronted fridge of cold drinks behind a blue counter
  counter(k, signs, b, -17.6, 4.0, 3.0, M.metalDark, ['ADA’S DRINKS BAR', 'Chapman · Zobo · Small chops'], '#0e7490');
  k.box(M.metalDark, 0.8, 2.1, 1.6, -19.4, 0, 6.3);
  k.box(M.lamp, 0.02, 1.7, 1.4, -18.99, 0.25, 6.3);
  stockRun(goods, [['cola', 'orange'], ['water', 'lemon'], ['malt', 'juice'], ['beer', 'stout']], [0.3, 0.72, 1.14, 1.56], [-19.2, 7.0], 1.4, Math.PI / 2, 0.3);
  k.box(M.glass, 0.02, 1.9, 1.5, -18.98, 0.2, 6.3);
  b.occupy(-19.8, -19.0, 5.5, 7.1, 2.1);
  for (let i = 0; i < 6; i++) k.cyl([M.red, M.yellow, M.green][i % 3], 0.05, 0.05, 0.22, -17.6, 1.05, 3.0 + i * 0.4, 10);

  // --- Tables and chairs: wood on chrome, padded chairs, every one to sit at ---
  for (const [x, z] of TABLES) {
    diningTable(k, x, z, 1.8, 0.9, 0);
    b.occupy(x - 0.9, x + 0.9, z - 0.45, z + 0.45, 0.76);
  }
  for (const s of SEATS.filter((s) => s.group.startsWith('table'))) {
    diningChair(k, s, M.leatherTan);
    b.occupy(s.x - 0.23, s.x + 0.23, s.z - 0.22, s.z + 0.22, 0.46);
  }

  // --- Naija Duty Free, along the east wall: lit wooden shelves of things made in Nigeria, a counter ---
  for (let z = -9.5; z <= 3.5; z += 2.6) {
    k.box(M.wood, 0.6, 2.2, 2.4, W - 0.55, 0, z);
    for (const y of [0.45, 0.95, 1.45]) k.box(M.woodDark, 0.55, 0.03, 2.4, W - 0.55, y - 0.03, z);
    k.box(M.lamp, 0.02, 0.05, 2.3, W - 0.3, 2.05, z);
    b.occupy(W - 0.85, W, z - 1.2, z + 1.2, 2.2);
  }
  stockRun(goods, [['honey', 'groundnut', 'cocoa'], ['sweets', 'plantain', 'chinchin'], ['lotion', 'hairCream', 'pepper']], [0.45, 0.95, 1.45], [W - 0.62, 4.6], 15.2, -Math.PI / 2, 0.3);
  k.soft(M.woodDark, 0.9, 1.0, 2.8, 14.5, 0, -3, 0.06);
  k.box(M.floorDark, 1.0, 0.05, 2.9, 14.5, 1.0, -3);
  k.box(M.yellow, 0.5, 0.22, 0.4, 14.5, 1.05, -3.8);
  b.occupy(14.05, 14.95, -4.4, -1.6, 1.05);
  const df = signMesh(['NAIJA DUTY FREE', 'Made in Nigeria · Gifts'], 4, 0.9, { bg: '#4c1d95', fg: '#ffffff', density: 120, accent: '#facc15' });
  df.position.set(W - 0.12, 3.0, -3);
  df.rotation.y = -Math.PI / 2;
  signs.add(df);

  // --- The viewing gallery: benches facing the glass, the aircraft beyond ---
  for (const x of BENCHES) {
    bench(k, x, -L + 2.2, 2.4, Math.PI, true);
    b.occupy(x - 1.2, x + 1.2, -L + 2.15, -L + 2.5, 0.48);
  }

  // --- Round the escalator well and the lift: a steel kerb and top rail (the glass is added after) ---
  const w = UPPER_WELL;
  for (const [x0, x1, z0, z1] of [[w.minX, w.minX, w.minZ, w.maxZ], [w.maxX, w.maxX, w.minZ, w.maxZ], [w.minX, w.maxX, w.maxZ, w.maxZ]] as const) {
    const len = Math.hypot(x1 - x0, z1 - z0);
    const alongX = x1 !== x0;
    k.box(M.metalDark, alongX ? len : 0.12, 0.12, alongX ? 0.12 : len, (x0 + x1) / 2, 0, (z0 + z1) / 2);
    k.box(M.steel, alongX ? len : 0.08, 0.05, alongX ? 0.08 : len, (x0 + x1) / 2, 1.05, (z0 + z1) / 2);
  }
  // Plants in the corners
  for (const [x, z] of [[-18.6, -10.8], [18.6, -10.8], [-18.6, 10.8], [18.6, 10.8]] as const) {
    planter(k, x, z, 1.1, 1.1);
    b.occupy(x - 0.55, x + 0.55, z - 0.55, z + 0.55, 0.6);
  }
  group.add(k.build('upper level furniture'), goods.build('upper level goods'), signs);
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

  relight(room, [[-10, 4.6, -2], [6, 4.6, -6], [14, 4.6, 4]]);
  // Every free chair and bench can be sat on; travellers have the others
  addSeats(room, FREE_SEATS.filter((s) => s.group.startsWith('table')), { name: '🪑 Food court table', description: 'Sit down at a table.' });
  addSeats(room, FREE_SEATS.filter((s) => s.group.startsWith('gallery')), { name: '🪑 Gallery bench', description: 'Sit and watch the aircraft.' });
  room.busySeats.push(...CROWD_SEATS.map((s) => [s.x, s.z] as [number, number]));
  // Travellers about the level: eating, buying, watching the planes, coming up the escalator
  const nodes: Array<[number, number]> = [[5.2, 1.4], [0, 1.4], [-15.5, 1.4], [-15.5, -8.5], [-15.5, 6], [-2.5, -9.6], [10, -9.6], [10, 1.4], [12.8, -3], [16.5, 6.5], [16.5, -9.5]];
  const links: Array<[number, number]> = [[0, 1], [1, 2], [2, 3], [2, 4], [1, 5], [5, 6], [6, 7], [7, 0], [7, 8], [8, 9], [8, 10], [6, 10]];
  const spots: CrowdSpot[] = [
    { x: -16.3, z: -7.4, yaw: -Math.PI / 2, group: 'mall', stay: [5, 10], mode: 'talk' }, { x: -16.3, z: -1.2, yaw: -Math.PI / 2, group: 'mall', stay: [5, 10] },
    { x: -16.3, z: 4.3, yaw: -Math.PI / 2, group: 'mall', stay: [4, 8] }, { x: 13.2, z: -2.6, yaw: Math.PI / 2, group: 'mall', stay: [5, 9], mode: 'talk' },
    { x: W - 1.6, z: -6.9, yaw: Math.PI / 2, group: 'mall', stay: [5, 12] }, { x: W - 1.6, z: 1.0, yaw: Math.PI / 2, group: 'mall', stay: [5, 12] },
    { x: 5.5, z: -L + 1.2, yaw: Math.PI, group: 'mall', stay: [8, 16] }, { x: 15.5, z: -L + 1.2, yaw: Math.PI, group: 'mall', stay: [8, 16] }, { x: -6, z: -L + 1.2, yaw: Math.PI, group: 'mall', stay: [8, 16] },
  ];
  const crowd = new MallCrowd({
    nodes, links, doors: [0], spots,
    seats: CROWD_SEATS.map((s) => ({ x: s.x, z: s.z, yaw: s.yaw, y: Math.max(0, s.top - 0.46) })),
    shoppers: 0, walkers: 9,
    playerAt: () => MallPlayer.at(),
    origin: room.group.position,
  });
  g.add(crowd.group);
  room.crowds.push(crowd);
  room.ticks.push((delta) => crowd.update(delta));
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
  build,
  attach,
  staff: [
    { name: 'Iya Basira', title: 'Amala Spot', at: [-18.7, -7], facing: Math.PI / 2, outfit: 0x15803d, gender: 'female', chef: true, says: 'Amala dey hot! Come and chop.' },
    { name: 'Mallam Sani', title: 'Suya', at: [-18.7, -1.5], facing: Math.PI / 2, outfit: 0xf8fafc, gender: 'male', cap: true, says: 'Fresh suya, hot from the fire.' },
    { name: 'Ada', title: 'Drinks bar', at: [-18.7, 4.0], facing: Math.PI / 2, outfit: 0x0e7490, gender: 'female', says: 'Chilled drinks and small chops!' },
    { name: 'Chiamaka', title: 'Naija Duty Free', at: [15.7, -3], facing: -Math.PI / 2, outfit: 0x7c3aed, gender: 'female', says: 'Made in Nigeria, the best gifts.' },
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
