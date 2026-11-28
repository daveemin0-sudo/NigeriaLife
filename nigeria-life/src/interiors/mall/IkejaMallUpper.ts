import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { Item } from '../../backend/types';
import type { Builder } from '../../world/kit/ArchKit';
import type { PlaceSpec, PlaceInterior, StationChoice } from '../places/PlaceInterior';
import { placeRooms } from '../places/PlaceRooms';
import type { PlaceHost } from '../../destinations/PlaceActions';
import { Sequence, steps } from '../../interactions/Sequence';
import { EXPRESS, ROADSIDE } from '../../world/expressway/layout';
import { Kit, M, signMesh, lightPool, mergeFloorDecals, WAYFINDING } from '../airport/TerminalKit';
import { Escalator, rideStair } from '../airport/Vertical';
import { addSeats, chairsRound, type Seat } from '../places/PlaceSeats';
import { MallCrowd, MallPlayer, type CrowdLayout, type CrowdSpot } from './MallCrowd';
import { realFloor, planter, diningChair, diningTable, brandSign } from './MallKit';
import { MALL, MALL_UPPER } from './MallLevels';

/**
 * Ikeja City Mall, upstairs: the food court along the back (a buka, chicken and chips, shawarma,
 * pizza, suya, zobo and smoothies), tables and chairs to eat at in the middle, the cinema on the
 * right with its box office, its popcorn counter and a screen to sit and watch, the fun zone on
 * the left with arcade games and claw machines, and the open well in the floor over the atrium,
 * the escalators coming up through it. Every chair can be sat on; a meal is ordered and paid for at
 * the counter, then carried to a table and eaten there.
 */

const W = MALL_UPPER.width / 2;
const L = MALL_UPPER.length / 2;
const H = MALL_UPPER.height;
const WELL = MALL_UPPER.well;
const DROP = MALL.level;

/** The counters along the back: their middles along x */
const COUNTERS = [-19.5, -12.5, -5.5, 1.5, 8.5, 15.5];
const COUNTER_Z = -14.4;
/** The food court's tables: 1.8 m by 0.9, four chairs each */
const TABLES: Array<[number, number]> = [];
for (const z of [-10.2, -6.6, -3]) for (const x of [-21, -17, -13, -9, -5, -1, 3, 7]) TABLES.push([x, z]);
/** The cinema hall: its rows of seats, facing the screen on the right-hand wall */
const HALL = { minX: 13, maxX: W - 0.2, minZ: 6, maxZ: L - 0.2, door: [14.2, 16.4] as [number, number] };
const ROWS = [15.6, 17.3, 19.0, 20.7];

const need = (changes: Record<string, number>) => (backend: { modifyNeed(n: never, v: number): void }) => {
  for (const [k, v] of Object.entries(changes)) backend.modifyNeed(k as never, v);
};
const item = (id: string, name: string, icon: string, price: number, category: Item['category'] = 'food', energyRestore?: number): Omit<Item, 'quantity'> => ({
  id, name, icon, price, category, usable: category === 'food', description: `Bought at Ikeja City Mall. ${name}.`, energyRestore,
});
const meal = (label: string, price: number, hunger: number, said: string, fun = 3): StationChoice => ({ label, price, note: `Hunger +${hunger} · eat at a table`, sit: true, seconds: 6, effect: need({ hunger, fun }), said });
const drink = (label: string, price: number, energy: number, said: string): StationChoice => ({ label, price, note: 'A drink', arms: 'eat', seconds: 3, effect: need({ hunger: 4, energy }), said });

/** Every seat: four chairs at each table, the cinema's rows */
function allSeats(): Seat[] {
  const seats: Seat[] = [];
  TABLES.forEach(([x, z], i) => seats.push(...chairsRound(x, z, 1.8, 0.9, 0, `table_${i}`)));
  ROWS.forEach((x, r) => {
    for (let i = 0; i < 8; i++) seats.push({ x, z: 7.6 + i * 1.05, yaw: Math.PI / 2, top: 0.47, group: `cinema_row_${r}`, forward: 0.2, from: [x - 0.75, 7.6 + i * 1.05] });
  });
  return seats;
}
const SEATS = allSeats();
/** A third of the chairs already have someone in them (the crowd's); the rest are free */
const TAKEN = new Set(SEATS.filter((_, i) => i % 3 === 1).map((s) => `${s.x.toFixed(2)},${s.z.toFixed(2)}`));
const isTaken = (s: Seat) => TAKEN.has(`${s.x.toFixed(2)},${s.z.toFixed(2)}`);

// --- Building it ---------------------------------------------------------------------------------

/** A film on the big screen: a sunset over the lagoon, a figure, the title */
function filmFrame(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 256;
  const g = c.getContext('2d')!;
  const sky = g.createLinearGradient(0, 0, 0, 256);
  sky.addColorStop(0, '#1e1b4b');
  sky.addColorStop(0.55, '#f97316');
  sky.addColorStop(1, '#fde68a');
  g.fillStyle = sky;
  g.fillRect(0, 0, 512, 256);
  g.fillStyle = '#0f172a';
  for (let i = 0; i < 14; i++) {
    const h = 30 + ((i * 37) % 70);
    g.fillRect(i * 38, 190 - h, 30, h + 70);
  }
  g.fillStyle = 'rgba(14,116,144,0.85)';
  g.fillRect(0, 200, 512, 56);
  g.fillStyle = '#000000';
  g.beginPath(); g.ellipse(330, 170, 16, 46, 0, 0, Math.PI * 2); g.fill();
  g.beginPath(); g.arc(330, 116, 13, 0, Math.PI * 2); g.fill();
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function build(b: Builder, group: THREE.Group): void {
  const k = new Kit();
  const extra = new THREE.Group();
  extra.name = 'mall upper signs';

  // --- The food court counters along the back, a kitchen behind each, its menu lit over it ---
  const brands: Array<{ name: string[]; colour: string; body: THREE.Material }> = [
    { name: ['IYA EBA BUKA', 'Amala · Eba · Pounded yam · Efo'], colour: '#166534', body: M.green },
    { name: ['CHOP REPUBLIC', 'Chicken · Chips · Jollof'], colour: '#b91c1c', body: M.red },
    { name: ['SHAWARMA KING', 'Chicken · Beef · Double sausage'], colour: '#9a3412', body: M.woodDark },
    { name: ['PIZZA PALACE', 'Pepperoni · Suya pizza'], colour: '#1e3a8a', body: M.black },
    { name: ['SUYA HUB', 'Beef · Chicken · Kilishi'], colour: '#7c2d12', body: M.woodDark },
    { name: ['ZOBO & SMOOTHIES', 'Zobo · Chapman · Fresh juice'], colour: '#be185d', body: M.solid },
  ];
  COUNTERS.forEach((x, i) => {
    const br = brands[i];
    k.soft(br.body, 5.2, 1.0, 0.9, x, 0, COUNTER_Z, 0.06);
    k.box(M.solid, 5.3, 0.05, 1.0, x, 1.0, COUNTER_Z);
    k.box(M.glassShelf, 2.0, 0.4, 0.55, x - 1.1, 1.05, COUNTER_Z);
    // The kitchen: steel worktop, a hood, shelves; the wall and the menu board
    k.box(M.steel, 5.0, 0.9, 0.7, x, 0, -L + 0.45);
    k.box(M.metalDark, 3, 0.6, 0.8, x, 2.4, -L + 0.5);
    k.box(M.plaster, 0.12, 3.2, 3.2, x - 2.6, 0, -L + 1.6);
    const menu = signMesh(br.name, 4.6, 1.1, brandSign(br.colour));
    menu.position.set(x, 3.6, -L + 0.12);
    extra.add(menu);
    // What is cooking: pots on the counter (the buka), a grill glowing (suya), a spit (shawarma), an oven (pizza)
    if (i === 0) for (let p = 0; p < 4; p++) k.cyl(M.steel, 0.22, 0.25, 0.3, x + 0.5 + p * 0.5, 1.05, COUNTER_Z, 14);
    if (i === 1) for (let p = 0; p < 3; p++) k.box(M.yellow, 0.4, 0.06, 0.3, x + 0.6 + p * 0.5, 1.05, COUNTER_Z);
    if (i === 2) k.cyl(M.woodDark, 0.18, 0.22, 0.7, x + 1.5, 0.9, -L + 0.45, 12);
    if (i === 3) k.box(M.red, 1.4, 1.0, 0.9, x + 1.2, 0.9, -L + 0.5);
    if (i === 4) k.box(M.lamp, 1.2, 0.03, 0.4, x + 1.0, 1.06, COUNTER_Z);
    if (i === 5) for (let p = 0; p < 5; p++) k.cyl(p % 2 ? M.red : M.yellow, 0.06, 0.06, 0.2, x + 0.4 + p * 0.35, 1.05, COUNTER_Z, 10);
    b.occupy(x - 2.6, x + 2.6, COUNTER_Z - 0.45, COUNTER_Z + 0.45, 1.05);
    b.occupy(x - 2.5, x + 2.5, -L, -L + 0.8, 0.95);
  });

  // --- Tables and chairs: wood tops on chrome, padded chairs, all to be sat at ---
  for (const [x, z] of TABLES) {
    diningTable(k, x, z, 1.8, 0.9, 0);
    b.occupy(x - 0.9, x + 0.9, z - 0.45, z + 0.45, 0.76);
  }
  for (const s of SEATS.filter((s) => s.group.startsWith('table'))) {
    diningChair(k, s, s.x < -11 ? M.leatherTan : M.leather);
    b.occupy(s.x - 0.23, s.x + 0.23, s.z - 0.22, s.z + 0.22, 0.46);
  }

  // --- The cinema: its lobby with the box office and the popcorn counter, the hall with the screen ---
  k.soft(M.black, 4.4, 1.05, 0.9, 18.5, 0, -3.2, 0.06);
  k.box(M.yellow, 4.5, 0.05, 1.0, 18.5, 1.05, -3.2);
  k.box(M.screen, 0.8, 0.5, 0.05, 17.3, 1.1, -3.5).box(M.screen, 0.8, 0.5, 0.05, 19.7, 1.1, -3.5);
  b.occupy(16.3, 20.7, -3.65, -2.75, 1.05);
  const box = signMesh(['🎬 EKO CINEMAS', 'Tickets · Now showing'], 4.2, 0.9, brandSign('#111827'));
  box.position.set(18.5, 3.1, -4.9);
  extra.add(box);
  k.box(M.black, 4.6, 2.4, 0.1, 18.5, 2.3, -4.95);
  // The popcorn counter: a glowing popcorn machine, cups, the drinks fountain
  k.soft(M.red, 0.9, 1.05, 3.6, W - 1.2, 0, 1.6, 0.06);
  k.box(M.glassShelf, 0.7, 0.8, 0.8, W - 1.2, 1.05, 0.6).box(M.yellow, 0.6, 0.35, 0.7, W - 1.2, 1.07, 0.6);
  k.box(M.steel, 0.5, 0.6, 0.6, W - 1.2, 1.05, 2.4);
  b.occupy(W - 1.65, W - 0.75, -0.2, 3.4, 1.05);
  // Posters along the lobby
  const films: Array<[string, string, string, string]> = [['KING OF LAGOS', '7 pm', '#7f1d1d', '#f59e0b'], ['OWAMBE', '5 pm', '#4c1d95', '#f472b6'], ['MAKOKO', '8 pm', '#0c4a6e', '#22d3ee'], ['THE HEIST', '9 pm', '#111827', '#ef4444']];
  films.forEach(([t, s, a, c2], i) => {
    const p = signMesh([t, s], 1.2, 1.8, { bg: a, fg: '#ffffff', density: 120, accent: c2 });
    p.position.set(13.8 + i * 1.6, 1.8, HALL.minZ - 0.12);
    p.rotation.y = Math.PI;
    extra.add(p);
  });
  // The hall: dark walls, a doorway in its front wall, the screen, red velvet rows
  const hallMat = new THREE.MeshStandardMaterial({ color: 0x1c1917, roughness: 0.9 });
  const velvet = new THREE.MeshStandardMaterial({ color: 0x8b1a1a, roughness: 0.95 });
  k.box(hallMat, HALL.door[0] - HALL.minX, 3.4, 0.2, (HALL.minX + HALL.door[0]) / 2, 0, HALL.minZ);
  k.box(hallMat, HALL.maxX - HALL.door[1], 3.4, 0.2, (HALL.door[1] + HALL.maxX) / 2, 0, HALL.minZ);
  k.box(hallMat, 0.2, 3.4, HALL.maxZ - HALL.minZ, HALL.minX, 0, (HALL.minZ + HALL.maxZ) / 2);
  b.occupy(HALL.minX, HALL.door[0], HALL.minZ - 0.1, HALL.minZ + 0.1, 3.4);
  b.occupy(HALL.door[1], HALL.maxX, HALL.minZ - 0.1, HALL.minZ + 0.1, 3.4);
  b.occupy(HALL.minX - 0.1, HALL.minX + 0.1, HALL.minZ, HALL.maxZ, 3.4);
  const carpet = new THREE.Mesh(new THREE.PlaneGeometry(HALL.maxX - HALL.minX, HALL.maxZ - HALL.minZ).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x3b0a0a, roughness: 1, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }));
  carpet.position.set((HALL.minX + HALL.maxX) / 2, 0.006, (HALL.minZ + HALL.maxZ) / 2);
  extra.add(carpet);
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(9.4, 4.0), new THREE.MeshBasicMaterial({ map: filmFrame(), toneMapped: false }));
  screen.name = 'cinema screen';
  screen.position.set(HALL.maxX - 0.05, 2.6, (HALL.minZ + HALL.maxZ) / 2);
  screen.rotation.y = -Math.PI / 2;
  extra.add(screen);
  k.box(M.black, 0.1, 4.4, 9.8, HALL.maxX - 0.02, 0.4, (HALL.minZ + HALL.maxZ) / 2);
  for (const s of SEATS.filter((s) => s.group.startsWith('cinema'))) {
    k.soft(velvet, 0.55, 0.45, 0.6, s.x, 0, s.z, 0.08, s.yaw);
    k.soft(velvet, 0.12, 0.65, 0.62, s.x - 0.33, 0, s.z, 0.05, s.yaw);
    k.box(M.black, 0.06, 0.62, 0.08, s.x, 0, s.z - 0.33, s.yaw).box(M.black, 0.06, 0.62, 0.08, s.x, 0, s.z + 0.33, s.yaw);
    b.occupy(s.x - 0.4, s.x + 0.3, s.z - 0.33, s.z + 0.33, 0.47);
  }
  const hallSign = signMesh(['SCREEN 1'], 1.6, 0.4, WAYFINDING);
  hallSign.position.set((HALL.door[0] + HALL.door[1]) / 2, 2.9, HALL.minZ - 0.12);
  hallSign.rotation.y = Math.PI;
  extra.add(hallSign);

  // --- The fun zone: arcade machines, claw machines, an air hockey table ---
  for (let i = 0; i < 6; i++) {
    const z = 2.5 + i * 1.6;
    k.box(M.black, 0.8, 1.85, 0.75, -W + 0.6, 0, z);
    const glow = new THREE.Mesh(new THREE.PlaneGeometry(0.55, 0.45), new THREE.MeshBasicMaterial({ color: [0x22d3ee, 0xf472b6, 0xfacc15, 0x4ade80, 0xa78bfa, 0xfb923c][i], toneMapped: false }));
    glow.position.set(-W + 1.01, 1.3, z);
    glow.rotation.y = Math.PI / 2;
    extra.add(glow);
    k.box(M.lamp, 0.1, 0.18, 0.7, -W + 0.6, 1.85, z);
    k.box(M.black, 0.3, 0.06, 0.6, -W + 1.1, 0.95, z);
  }
  b.occupy(-W, -W + 1.2, 1.9, 11.4, 1.9);
  for (const z of [13.5, 15.2]) {
    k.box(M.yellow, 0.9, 0.9, 0.9, -W + 0.7, 0, z).box(M.glass, 0.85, 0.9, 0.85, -W + 0.7, 0.9, z).box(M.yellow, 0.9, 0.12, 0.9, -W + 0.7, 1.8, z);
    for (let t = 0; t < 6; t++) k.cyl([M.red, M.green, M.leatherTan][t % 3], 0.09, 0.09, 0.16, -W + 0.5 + (t % 3) * 0.2, 0.92, z - 0.2 + Math.floor(t / 3) * 0.35, 10);
  }
  b.occupy(-W, -W + 1.2, 12.9, 15.8, 1.9);
  k.box(M.solid, 2.1, 0.8, 1.2, -16, 0, 7.5).box(new THREE.MeshBasicMaterial({ color: 0x38bdf8 }), 2.0, 0.02, 1.1, -16, 0.8, 7.5);
  b.occupy(-17.05, -14.95, 6.9, 8.1, 0.82);
  k.soft(M.red, 2.8, 1.05, 0.8, -12.5, 0, 15.2, 0.06);
  b.occupy(-13.9, -11.1, 14.8, 15.6, 1.05);
  const fun = signMesh(['🕹 FUN ZONE', 'Arcade · Claw · Air hockey'], 4, 0.9, brandSign('#7c3aed'));
  fun.position.set(-12.5, 3.2, L - 0.15);
  fun.rotation.y = Math.PI;
  extra.add(fun);

  // --- Round the well: a steel kerb, glass on three sides and the near side, open where the escalators arrive ---
  const glassRail = (x0: number, z0: number, x1: number, z1: number) => {
    const len = Math.hypot(x1 - x0, z1 - z0);
    const alongX = Math.abs(x1 - x0) > Math.abs(z1 - z0);
    k.box(M.glass, alongX ? len : 0.03, 1.05, alongX ? 0.03 : len, (x0 + x1) / 2, 0.05, (z0 + z1) / 2);
    k.box(M.steel, alongX ? len : 0.08, 0.05, alongX ? 0.08 : len, (x0 + x1) / 2, 1.08, (z0 + z1) / 2);
    k.box(M.metalDark, alongX ? len : 0.12, 0.08, alongX ? 0.12 : len, (x0 + x1) / 2, 0, (z0 + z1) / 2);
  };
  glassRail(WELL.minX, WELL.minZ, WELL.minX, WELL.maxZ);
  glassRail(WELL.maxX, WELL.minZ, WELL.maxX, WELL.maxZ);
  glassRail(WELL.minX, WELL.maxZ, WELL.maxX, WELL.maxZ);
  glassRail(WELL.minX, WELL.minZ, MALL_UPPER.up.x - 0.65, WELL.minZ);
  b.occupy(WELL.minX - 0.1, WELL.maxX + 0.1, WELL.minZ - 0.05, WELL.maxZ + 0.1, 1.1);

  // --- Plants, light ---
  for (const [x, z] of [[-W + 1, -L + 4.5], [11, -12], [11, -1], [-9, 14.5], [10.5, 14.5]] as const) {
    planter(k, x, z);
    b.occupy(x - 0.62, x + 0.62, z - 0.62, z + 0.62, 0.6);
  }
  for (const [x, z] of [[-9, -7], [3, -7], [-16, 8], [18, 0]] as const) extra.add(lightPool(8, 7, x, z, 0.12));
  for (const [x, z] of [[-8, -6], [8, -6], [-15, 9]] as const) {
    const light = new THREE.PointLight(0xfff3df, 2.0, 26, 1.2);
    light.position.set(x, H - 0.8, z);
    extra.add(light);
  }

  group.add(k.build('mall upper'), extra);
}

/** Opens the floor over the atrium, hangs the escalators in it, the atrium below, the crowd */
function attach(room: PlaceInterior): void {
  const g = room.group;
  realFloor(room, MALL_UPPER.width, MALL_UPPER.length, M.floor, 2.4);
  // The floor, in pieces round the well
  const floor = g.getObjectByName('interior_floor_mesh') as THREE.Mesh | undefined;
  if (floor) {
    const pieces: Array<[number, number, number, number]> = [
      [-W, WELL.minX, -L, L], [WELL.maxX, W, -L, L], [WELL.minX, WELL.maxX, -L, WELL.minZ], [WELL.minX, WELL.maxX, WELL.maxZ, L],
    ];
    const parts = pieces.map(([x0, x1, z0, z1]) => {
      const p = new THREE.BoxGeometry(x1 - x0, 0.4, z1 - z0);
      const uv = p.getAttribute('uv') as THREE.BufferAttribute;
      for (let i = 0; i < uv.count; i++) uv.setXY(i, (x0 + uv.getX(i) * (x1 - x0)) / 2.4, (z0 + uv.getY(i) * (z1 - z0)) / 2.4);
      p.translate((x0 + x1) / 2, 0, (z0 + z1) / 2);
      return p;
    });
    const merged = mergeGeometries(parts, false);
    if (merged) {
      floor.geometry.dispose();
      floor.geometry = merged;
    }
  }
  const plot = g.getObjectByName('interior_ground_plot');
  if (plot) plot.position.y = -DROP - 0.6;
  // The atrium below the well: its stone floor, benches, a planter, people walking
  const below = new THREE.Mesh(new THREE.PlaneGeometry(26, 20).rotateX(-Math.PI / 2), M.floor);
  below.position.set(1, -DROP, 7);
  g.add(below);
  const k = new Kit();
  for (const [x, z] of [[-3, 5], [-3, 10]] as const) k.box(M.wood, 2.4, 0.06, 0.5, x, -DROP + 0.42, z).box(M.metalDark, 2.2, 0.42, 0.4, x, -DROP, z);
  k.cyl(M.floorDark, 1.2, 1.2, 0.55, 2, -DROP, 7, 20).box(M.leaf, 1.6, 0.6, 1.6, 2, -DROP + 0.5, 7);
  g.add(k.build('atrium below'));
  // The escalators up through the well
  const top = MALL_UPPER.up.top;
  const up = new Escalator({ x: MALL_UPPER.up.x, z: top + MALL_UPPER.run, rise: DROP, run: MALL_UPPER.run, up: true });
  const down = new Escalator({ x: MALL_UPPER.down.x, z: top + MALL_UPPER.run, rise: DROP, run: MALL_UPPER.run, up: false });
  up.group.position.y = -DROP;
  down.group.position.y = -DROP;
  g.add(up.group, down.group);
  // The screen flickers as the film plays
  const screen = g.getObjectByName('cinema screen') as THREE.Mesh | undefined;
  let t = 0;
  room.ticks.push((delta) => {
    up.tick(delta);
    down.tick(delta);
    t += delta;
    if (screen) (screen.material as THREE.MeshBasicMaterial).color.setScalar(0.82 + Math.sin(t * 1.3) * 0.08 + Math.sin(t * 7.1) * 0.04);
  });
  mergeFloorDecals(g);

  // Every free chair can be sat on; the crowd has the others
  addSeats(room, SEATS.filter((s) => !isTaken(s) && s.group.startsWith('table')), { name: '🪑 Food court table', description: 'Sit down at a table.' });
  addSeats(room, SEATS.filter((s) => !isTaken(s) && s.group.startsWith('cinema')), { name: '🎬 Cinema seats', description: 'Take a seat in Screen 1.' });
  room.busySeats.push(...SEATS.filter(isTaken).map((s) => [s.x, s.z] as [number, number]));

  const crowd = new MallCrowd(crowdLayout(room));
  g.add(crowd.group);
  room.crowds.push(crowd);
  room.ticks.push((delta) => crowd.update(delta));

  // Down the escalator to the atrium, or by the stairs (the door at the front)
  const ground = () => placeRooms.get(MALL.key);
  room.addCard({
    id: 'mall_upper_escalator_down', name: '⬇ Escalator down', description: 'Down to the supermarket, the shops and the way out.',
    at: [MALL_UPPER.down.x, top - 0.4], stand: [MALL_UPPER.down.x, top - 1.4],
    label: () => '⬇ Escalator down to the ground floor',
    run: (host: PlaceHost) => {
      const actor = host.actor;
      const below = ground();
      if (!below || host.director.interrupt(actor) === 'locked') return;
      const ride = new Sequence('mall escalator down', [actor]).locked().add(
        steps.walk(actor, room.at(MALL_UPPER.down.x, top - 1.2), { ifStuck: 'snap' }),
        steps.face(actor, 0),
        steps.slide(actor, room.at(MALL_UPPER.down.x, top), 0.6),
        rideStair(actor, room.at(MALL_UPPER.down.x, top), room.at(MALL_UPPER.down.x, top + MALL_UPPER.run), 0, -DROP, 7),
      );
      ride.onEnd((reason) => {
        actor.root.position.y = 0;
        if (reason === 'done') host.ride(MALL.id, below.at(MALL.down.x, MALL.down.foot + 1.3), 0);
      });
      host.director.run(ride);
    },
  });
  room.leadsTo = () => {
    const below = ground();
    return below ? { id: MALL.id, spawnAt: below.at(MALL.down.x + 1.4, MALL.down.foot + 1.6), spawnYaw: 0 } : null;
  };
}

function crowdLayout(room: PlaceInterior): CrowdLayout {
  const nodes: Array<[number, number]> = [];
  const links: Array<[number, number]> = [];
  const node = (x: number, z: number) => nodes.push([x, z]) - 1;
  const join = (...chain: number[]) => { for (let i = 1; i < chain.length; i++) links.push([chain[i - 1], chain[i]]); };
  const arrive = node(7.5, 0.6);
  // The aisle in front of the counters, the aisles between the tables, round the well
  const counterRow = [-23, ...COUNTERS, 22].map((x) => node(x, -12.3));
  join(...counterRow);
  const cross = [-23, -19, -15, -11, -7, -3, 1, 5, 9.6].map((x) => node(x, -1.2));
  join(...cross);
  for (const x of [-19, -11, -3, 5]) join(nodes.findIndex(([nx, nz]) => nx === x && nz === -1.2), node(x, -8.4), node(x, -12.3));
  join(node(-19, -12.3), counterRow[1]);
  join(cross[8], arrive, node(11, 0.6), node(11, -8), counterRow[6]);
  const east = node(15, 0.6);
  join(node(11, 0.6), east, node(15, 4.6), node(15.3, 7.5));
  const west = node(-10, 4);
  join(cross[3], west, node(-10, 12), node(-18, 12), node(-18, 4), west);
  join(nodes.findIndex(([nx, nz]) => nx === 11 && nz === 0.6), node(11, 14), node(-8, 14.5), node(-10, 12));

  const spots: CrowdSpot[] = [];
  COUNTERS.forEach((x) => {
    spots.push({ x: x - 0.8, z: -13.25, yaw: Math.PI, group: 'mall', stay: [5, 12], mode: 'talk' });
    spots.push({ x: x + 1.1, z: -13.3, yaw: Math.PI, group: 'mall', stay: [4, 9] });
  });
  for (let z = 2.5; z <= 10.5; z += 2.4) spots.push({ x: -W + 1.75, z, yaw: -Math.PI / 2, group: 'mall', stay: [8, 18] });
  spots.push({ x: -16, z: 6.5, yaw: 0, group: 'mall', stay: [8, 15] }, { x: -16, z: 8.5, yaw: Math.PI, group: 'mall', stay: [8, 15] });
  for (const x of [-5, -1, 3]) spots.push({ x, z: 13.4, yaw: Math.PI, group: 'mall', stay: [6, 14] });
  spots.push({ x: -8.0, z: 6, yaw: Math.PI / 2, group: 'mall', stay: [6, 14] }, { x: 10, z: 8, yaw: -Math.PI / 2, group: 'mall', stay: [6, 14] });
  spots.push({ x: 18.5, z: -2.0, yaw: Math.PI, group: 'mall', stay: [5, 10], mode: 'talk' }, { x: 15.5, z: 4.8, yaw: Math.PI, group: 'mall', stay: [4, 9] });
  spots.push({ x: W - 2.3, z: 1.6, yaw: Math.PI / 2, group: 'mall', stay: [5, 10] });
  return {
    nodes, links, doors: [arrive], spots,
    seats: SEATS.filter(isTaken).map((s) => ({ x: s.x, z: s.z, yaw: s.yaw, y: s.top - 0.46 + 0.0 })),
    strollers: [
      { a: [-4, 3], b: [6, 11.5], y: -DROP, count: 6 },
      { a: [-5, 11], b: [5, 2.5], y: -DROP, count: 4 },
    ],
    shoppers: 0,
    walkers: 18,
    playerAt: () => MallPlayer.at(),
    origin: room.group.position,
  };
}

// --- The place -----------------------------------------------------------------------------------

const out = (() => {
  const p = ROADSIDE.find((r) => r.id === MALL.key);
  return p ? [p.side * (EXPRESS.half + EXPRESS.walk - 1), 0, p.z] as [number, number, number] : undefined;
})();

const S = (id: string, name: string, at: [number, number], stand: [number, number], who: string, role: string, text: string, choices: StationChoice[]) => ({ id, name, at, stand, who, role, text, choices });
const cs = (i: number): [number, number] => [COUNTERS[i], COUNTER_Z];
const cstand = (i: number): [number, number] => [COUNTERS[i] - 0.6, COUNTER_Z + 1.2];

export const IKEJA_MALL_UPPER: PlaceSpec = {
  key: MALL_UPPER.key,
  name: 'Ikeja City Mall · Upper level',
  district: 'Ikeja City Mall · food court, cinema, fun zone',
  streetId: 'ikeja-mall-upper-level',
  comeOut: out,
  room: { width: MALL_UPPER.width, length: MALL_UPPER.length, height: H, floor: 0xece7df, wall: 0xf4f1ec },
  sign: { text: 'FOOD COURT · CINEMA · FUN ZONE', sub: 'Ikeja City Mall · upper level', bg: '#b91c1c' },
  door: { name: 'Stairs down to the ground floor', category: 'Ikeja City Mall', description: 'Down to the supermarket, the shops and the way out.' },
  build,
  attach,
  staff: [
    { name: 'Iya Eba', title: 'Iya Eba Buka', at: [COUNTERS[0], -15.4], facing: 0, outfit: 0x166534, gender: 'female', chef: true, says: 'Come and chop, my customer!' },
    { name: 'Uche', title: 'Chop Republic', at: [COUNTERS[1], -15.4], facing: 0, outfit: 0xb91c1c, gender: 'male', cap: true, says: 'Chicken and chips?' },
    { name: 'Hassan', title: 'Shawarma King', at: [COUNTERS[2], -15.4], facing: 0, outfit: 0xf8fafc, gender: 'male', chef: true, says: 'Double sausage?' },
    { name: 'Blessing', title: 'Pizza Palace', at: [COUNTERS[3], -15.4], facing: 0, outfit: 0x1e3a8a, gender: 'female', cap: true, says: 'Fresh from the oven!' },
    { name: 'Mallam Garba', title: 'Suya Hub', at: [COUNTERS[4], -15.4], facing: 0, outfit: 0xf8fafc, gender: 'male', cap: true, says: 'Suya dey hot!' },
    { name: 'Zainab', title: 'Zobo & Smoothies', at: [COUNTERS[5], -15.4], facing: 0, outfit: 0xbe185d, gender: 'female', says: 'Cold zobo, fresh juice!' },
    { name: 'Tobi', title: 'Eko Cinemas box office', at: [18.5, -4.3], facing: 0, outfit: 0x111827, gender: 'male', says: 'Which film are you watching?' },
    { name: 'Amara', title: 'Cinema snacks', at: [W - 0.45, 1.6], facing: -Math.PI / 2, outfit: 0xb91c1c, gender: 'female', says: 'Popcorn, sweet or salted?' },
    { name: 'Kelechi', title: 'Fun zone', at: [-12.5, 16.0], facing: Math.PI, outfit: 0x7c3aed, gender: 'male', says: 'Who wants to play?' },
  ],
  stations: [
    S('buka', '🍲 Iya Eba Buka', cs(0), cstand(0), 'Iya Eba', 'Iya Eba Buka · Food court', 'Ehen, welcome my customer! Amala dey, eba dey, pounded yam dey. Efo riro, egusi, assorted meat. Wetin I go give you?', [
      meal('Amala, ewedu, gbegiri and assorted', 4500, 65, 'Soft amala, ewedu, gbegiri, assorted meat on top. You licked your fingers.', 6),
      meal('Pounded yam and egusi with goat meat', 6500, 75, 'Smooth pounded yam, thick egusi, goat meat. You needed a nap after.'),
      meal('Eba and efo riro with fish', 4800, 65, 'Hot eba, efo riro full of fish and pomo.'),
      meal('Ofada rice and ayamase', 5500, 60, 'Ofada in leaves with green pepper sauce. Peppery!'),
    ]),
    S('chicken', '🍗 Chop Republic', cs(1), cstand(1), 'Uche', 'Chop Republic · Food court', 'Welcome to Chop Republic! Chicken and chips, jollof, fried rice, plantain. What will you have today?', [
      meal('Chicken and chips with a Coke', 6000, 50, 'Crispy chicken, hot chips, cold Coke.'),
      meal('Jollof rice, chicken and plantain', 6500, 60, 'Party jollof, smoky; chicken; sweet dodo.'),
      meal('Fried rice and turkey', 7500, 60, 'Fried rice with a big turkey wing.'),
    ]),
    S('shawarma', '🌯 Shawarma King', cs(2), cstand(2), 'Hassan', 'Shawarma King · Food court', 'Welcome! Chicken shawarma, beef shawarma, double sausage, extra cream. How you want am?', [
      meal('Chicken shawarma, double sausage', 4500, 45, 'Double sausage, extra cream, a little pepper. Correct shawarma.'),
      meal('Beef shawarma and a Chapman', 6000, 48, 'Beef shawarma and a cold Chapman.'),
    ]),
    S('pizza', '🍕 Pizza Palace', cs(3), cstand(3), 'Blessing', 'Pizza Palace · Food court', 'Hi, welcome to Pizza Palace! Pepperoni, chicken suya pizza, BBQ beef. Medium or large?', [
      meal('Medium chicken suya pizza', 9000, 55, 'Suya spice on pizza. Lagos invented something.'),
      meal('Large pepperoni to share', 14000, 65, 'A whole large pepperoni, the cheese stretching.', 6),
    ]),
    S('suya', '🍢 Suya Hub', cs(4), cstand(4), 'Mallam Garba', 'Suya Hub · Food court', 'Sannu! Fresh suya, hot hot. Beef, chicken, kidney, ram. How many sticks?', [
      meal('Beef suya with onions and tomato', 3000, 30, 'Yaji, onions, sliced tomatoes. Hot!', 5),
      meal('Ram suya, a full portion', 5000, 40, 'Ram suya wrapped in old newspaper, the proper way.', 5),
    ]),
    S('drinks', '🥤 Zobo & Smoothies', cs(5), cstand(5), 'Zainab', 'Zobo & Smoothies · Food court', 'Hello! Chilled zobo, Chapman, fresh juice, smoothies, ice cream. What will cool you down?', [
      drink('Chilled zobo with ginger', 1200, 5, 'Cold zobo, a ginger kick.'),
      drink('Chapman with cucumber', 2500, 8, 'Chapman with ice and cucumber.'),
      drink('Mango and pineapple smoothie', 3500, 10, 'Thick, cold, sweet.'),
    ]),
    S('cinema', '🎬 Eko Cinemas box office', [18.5, -3.2], [18.5, -2.0], 'Tobi', 'Eko Cinemas · Box office', 'Good evening! Now showing: King of Lagos, Owambe, Makoko, The Heist. Which one, and how many tickets?', [
      { label: 'Ticket: King of Lagos (Nollywood)', price: 5000, note: 'Then sit in Screen 1', arms: 'reach', seconds: 1.8, item: item('cinema_ticket', 'Cinema ticket', '🎟️', 5000, 'document'), said: '"Screen 1, enjoy your film!" The ticket is in your bag.' },
      { label: 'Two tickets: Owambe (comedy)', price: 10000, note: 'Bring a friend', arms: 'reach', seconds: 1.8, item: item('cinema_ticket', 'Cinema ticket', '🎟️', 5000, 'document'), said: 'Two tickets for Owambe. Funke Akindele again!' },
    ]),
    S('snacks', '🍿 Cinema snacks', [W - 1.2, 1.6], [W - 2.4, 1.6], 'Amara', 'Eko Cinemas · Snacks', 'Hi! Popcorn sweet or salted, hot dog, nachos, cold drinks. What are you taking into the film?', [
      { label: 'Big popcorn and a drink', price: 4500, note: 'Hunger +15 · Fun +4', arms: 'eat', seconds: 3, effect: need({ hunger: 15, fun: 4 }), said: 'Half sweet, half salted. The bucket was gone before the trailers ended.' },
      { label: 'Hot dog', price: 3500, note: 'Hunger +20', arms: 'eat', seconds: 3, effect: need({ hunger: 20 }), said: 'Sausage, ketchup, mustard.' },
    ]),
    S('screen', '🎬 Screen 1 · Watch the film', [17.3, 11.2], [16.5, 11.2], 'Screen 1', 'Eko Cinemas', 'The lights go down. King of Lagos, two hours. Your seat is waiting.', [
      { label: 'Watch the film', note: 'Fun +35 · needs a ticket', needItem: 'cinema_ticket', sit: true, arms: 'rest', seconds: 20, effect: need({ fun: 35, social: 4 }), said: 'The whole hall screamed at the twist and clapped at the end. Worth every naira.' },
    ]),
    S('arcade', '🕹 Fun zone', [-12.5, 15.2], [-12.5, 14.0], 'Kelechi', 'Fun zone · Arcade', 'Welcome to the fun zone! Arcade, claw machines, air hockey. Load your card and play!', [
      { label: 'Play the racing game', price: 1500, note: 'Fun +15', arms: 'reach', seconds: 8, effect: need({ fun: 15 }), said: 'Third Mainland Bridge at 300 km/h. First place!' },
      { label: 'Air hockey', price: 1000, note: 'Fun +12', arms: 'reach', seconds: 8, effect: need({ fun: 12, social: 3 }), said: 'Seven to five. You won.' },
      { label: 'Try the claw machine', price: 500, note: 'Fun +8 · maybe a prize', arms: 'reach', seconds: 5, effect: need({ fun: 8 }), said: 'The claw grabbed the teddy… and dropped it at the hole. Next time!' },
    ]),
  ],
};
