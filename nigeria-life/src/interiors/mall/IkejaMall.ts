import * as THREE from 'three';
import type { Item } from '../../backend/types';
import type { PlaceSpec, PlaceInterior, StationChoice } from '../places/PlaceInterior';
import { placeRooms } from '../places/PlaceRooms';
import type { PlaceHost } from '../../destinations/PlaceActions';
import { Sequence, steps } from '../../interactions/Sequence';
import { Kit, M, signMesh, lightPool, contactShade, mergeFloorDecals, WAYFINDING } from '../airport/TerminalKit';
import { Escalator, rideStair } from '../airport/Vertical';
import { buildKitCar } from '../../world/vehicles/KitCar';
import { GoodsMesh, stockRun, AISLES } from './Goods';
import { MallCrowd, MallPlayer, type CrowdLayout, type CrowdSpot } from './MallCrowd';
import { shopfront, planter, bench, galleryEdge, realFloor, floorArea, hangingSign, brandSign, diningChair, diningTable } from './MallKit';
import { addSeats, chairsRound, type Seat } from '../places/PlaceSeats';
import { MALL, MALL_UPPER } from './MallLevels';

/**
 * Ikeja City Mall, inside: the big supermarket on the left (four long aisles of goods, the chillers
 * along the back, fresh bread and fresh produce, four tills by the door), a row of shops on the
 * right and along the back (phones, fashion, a pharmacy, jewellers, shoes, electronics, books,
 * beauty, a coffee shop), and the atrium between: a fountain under the skylights, kiosks, a car to
 * be won, and the escalators up to the food court and the cinema on the gallery above. People
 * come and go all day, shop, queue at the tills and leave with their bags. Everyone at a counter
 * speaks first when a customer walks up.
 */

const W = MALL.width / 2;
const L = MALL.length / 2;
const H = MALL.height;
const LEVEL = MALL.level;

/** The supermarket's edges, its four gondolas (their middles), and its tills */
const SM = { minX: -W + 0.3, maxX: -8, minZ: -L + 0.3, maxZ: 13 };
const GONDOLAS = [-25.5, -21.5, -17.5, -13.5];
const GONDOLA = { z0: -17.5, z1: -3.5, half: 0.55 };
const SHELVES = [0.1, 0.52, 0.94, 1.36, 1.78];
const TILLS = [-26, -22.5, -19, -15.5];
const TILL_Z = 3.5;
/** Each till's customer lane, beside it (the aisles line up with them) */
const lane = (x: number) => x - 0.85;
/** The shops along the right-hand wall: the middle of each along z */
const EAST = [-17.5, -10.5, -3.5, 3.5, 10.5];
const EAST_FRONT = 23;
const BACK_FRONT = -16;

/** Every bench seat and chair on the ground floor: round the fountain, in the lobby, at Eko Coffee */
function groundSeats(): Seat[] {
  const seats: Seat[] = [];
  for (let i = 0; i < 4; i++) {
    const a = Math.PI / 4 + (i / 4) * Math.PI * 2;
    for (const t of [-0.6, 0, 0.6]) seats.push({ x: 11 + Math.sin(a) * 4.3 + Math.cos(a) * t, z: -1 + Math.cos(a) * 4.3 - Math.sin(a) * t, yaw: a, top: 0.48, group: `fountain_${i}` });
  }
  for (const x of [-20, -14]) for (const t of [-0.6, 0, 0.6]) seats.push({ x: x + t, z: 18.2, yaw: Math.PI, top: 0.48, group: `lobby_${x}` });
  for (const z of [15.6, 19.4]) seats.push(...chairsRound(25.4, z, 1.2, 0.8, Math.PI / 2, `coffee_${z}`));
  for (const t of [-0.6, 0.6]) seats.push({ x: 25.3, z: EAST[4] - 1 + t, yaw: Math.PI / 2, top: 0.48, group: 'shoes_bench' });
  return seats;
}
const SEATS = groundSeats();
/** Some seats already have someone on them */
const CROWD_SEATS = SEATS.filter((s, i) => !s.group.startsWith('shoes') && i % 3 === 0);
const FREE_SEATS = SEATS.filter((s) => !CROWD_SEATS.includes(s));

const need = (changes: Record<string, number>) => (backend: { modifyNeed(n: never, v: number): void }) => {
  for (const [k, v] of Object.entries(changes)) backend.modifyNeed(k as never, v);
};
const item = (id: string, name: string, icon: string, price: number, category: Item['category'] = 'food', energyRestore?: number): Omit<Item, 'quantity'> => ({
  id, name, icon, price, category, usable: category === 'food' || category === 'medicine', description: `Bought at Ikeja City Mall. ${name}.`, energyRestore,
});
const buy = (label: string, price: number, it: Omit<Item, 'quantity'>, said: string, note = 'Into your bag'): StationChoice => ({ label, price, note, item: it, said, arms: 'reach', seconds: 1.8 });
const snack = (label: string, price: number, hunger: number, said: string, fun = 3): StationChoice => ({ label, price, note: `Hunger +${hunger}`, arms: 'eat', seconds: 4, effect: need({ hunger, fun }), said });

// --- Building it ---------------------------------------------------------------------------------

/** A double-sided shelf run: plinth, spine, shelves and its goods on both sides, a promo end facing the tills */
function gondola(k: Kit, goods: GoodsMesh, x: number, west: string, east: string): void {
  const { z0, z1, half } = GONDOLA;
  const len = z1 - z0;
  const mz = (z0 + z1) / 2;
  k.box(M.metalDark, half * 2, 0.1, len, x, 0, mz);
  k.box(M.plaster, 0.06, 2.12, len, x, 0, mz);
  for (const y of SHELVES) for (const side of [-1, 1]) k.box(M.steel, half - 0.05, 0.025, len, x + side * (half / 2 + 0.01), y - 0.025, mz);
  // Price strips along the shelf edges
  for (const y of SHELVES) for (const side of [-1, 1]) k.box(M.solid, 0.01, 0.035, len, x + side * (half - 0.03), y - 0.06, mz);
  k.box(M.red, half * 2 + 0.04, 0.22, len + 0.04, x, 2.12, mz);
  stockRun(goods, AISLES[west], SHELVES, [x - half + 0.21, z0 + 0.1], len - 0.2, -Math.PI / 2);
  stockRun(goods, AISLES[east], SHELVES, [x + half - 0.21, z1 - 0.1], len - 0.2, Math.PI / 2);
  // The end toward the tills: a promotion stacked high, its card on top
  k.box(M.red, half * 2, 1.9, 0.5, x, 0, z1 + 0.3);
  stockRun(goods, [['malt', 'noodles'], ['cornflakes', 'milkTin'], ['detergent', 'tea'], ['vegOil', 'riceSmall']], [0.12, 0.55, 0.98, 1.41], [x - half + 0.05, z1 + 0.42], half * 2 - 0.1, 0, 0.3);
}

/** Heaps of fresh produce in tilted crates on a table */
function produceTable(k: Kit, fruit: Array<{ m: THREE.Matrix4; c: number; kind: 0 | 1 | 2 }>, x: number, z: number): void {
  k.box(M.wood, 1.6, 0.72, 3.4, x, 0, z);
  const kinds: Array<[number, 0 | 1 | 2, number]> = [[0xdc2626, 0, 0.055], [0x16a34a, 0, 0.05], [0xf97316, 0, 0.07], [0x7c2d12, 1, 0.12], [0xfacc15, 2, 0.1], [0x6b21a8, 0, 0.05], [0xb91c1c, 0, 0.045], [0x3f6212, 0, 0.16]];
  for (let c = 0; c < 4; c++) for (const side of [-1, 1]) {
    const cx = x + side * 0.4;
    const cz = z - 1.25 + c * 0.83;
    const [colour, kind, r] = kinds[(c * 2 + (side > 0 ? 1 : 0) + Math.round(z)) & 7];
    k.box(M.woodDark, 0.72, 0.16, 0.76, cx, 0.72, cz, 0, 0, side * 0.12);
    const n = kind === 0 ? Math.round(0.22 / r) : 3;
    for (let i = 0; i < n * n; i++) {
      const px = cx + ((i % n) / (n - 1 || 1) - 0.5) * 0.56;
      const pz = cz + (Math.floor(i / n) / (n - 1 || 1) - 0.5) * 0.6;
      const lift = 0.86 + Math.sin(i * 1.7) * 0.012 + (0.28 - Math.abs(px - cx)) * 0.2;
      const m = new THREE.Matrix4().compose(new THREE.Vector3(px, lift, pz), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, i * 0.9, kind === 2 ? 0.4 : 0)), new THREE.Vector3(r, r * (kind === 1 ? 0.7 : 1), r * (kind === 0 ? 1 : 3)));
      fruit.push({ m, c: colour, kind });
    }
  }
}

/** A lit board with a film's poster on it */
function poster(title: string, sub: string, colours: [string, string]): THREE.Mesh {
  const c = document.createElement('canvas');
  c.width = 200;
  c.height = 300;
  const g = c.getContext('2d')!;
  const grad = g.createLinearGradient(0, 0, 0, 300);
  grad.addColorStop(0, colours[0]);
  grad.addColorStop(1, colours[1]);
  g.fillStyle = grad;
  g.fillRect(0, 0, 200, 300);
  // Two figures in silhouette against a sunset, the title over them
  g.fillStyle = 'rgba(0,0,0,0.55)';
  g.beginPath(); g.ellipse(70, 190, 26, 70, 0, 0, Math.PI * 2); g.fill();
  g.beginPath(); g.arc(70, 110, 20, 0, Math.PI * 2); g.fill();
  g.beginPath(); g.ellipse(135, 200, 24, 62, 0, 0, Math.PI * 2); g.fill();
  g.beginPath(); g.arc(135, 128, 18, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#ffffff';
  g.font = '900 30px Arial';
  g.textAlign = 'center';
  g.fillText(title, 100, 44, 186);
  g.font = '600 14px Arial';
  g.fillText(sub, 100, 280, 186);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1.3, 1.95), new THREE.MeshBasicMaterial({ map: tex, toneMapped: false }));
  mesh.name = `poster ${title}`;
  return mesh;
}

/** A TV's picture: a bright scene, so the wall of screens glows */
function screenPicture(seed: number): THREE.MeshBasicMaterial {
  const c = document.createElement('canvas');
  c.width = 160;
  c.height = 90;
  const g = c.getContext('2d')!;
  const skies = [['#0ea5e9', '#f0f9ff'], ['#f97316', '#fde68a'], ['#16a34a', '#bbf7d0'], ['#7c3aed', '#f0abfc']];
  const [a, b] = skies[seed % skies.length];
  const grad = g.createLinearGradient(0, 0, 0, 90);
  grad.addColorStop(0, a);
  grad.addColorStop(1, b);
  g.fillStyle = grad;
  g.fillRect(0, 0, 160, 90);
  g.fillStyle = seed % 2 ? '#14532d' : '#1e293b';
  g.fillRect(0, 62, 160, 28);
  g.fillStyle = '#ffffff';
  g.fillRect(8, 8, 34, 8);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return new THREE.MeshBasicMaterial({ map: tex, toneMapped: false });
}

function build(room: PlaceInterior): void {
  const g = room.group;
  const k = new Kit();
  const goods = new GoodsMesh();
  const fruit: Array<{ m: THREE.Matrix4; c: number; kind: 0 | 1 | 2 }> = [];
  const extra = new THREE.Group();
  extra.name = 'mall signs and lights';
  // The tall parts in wings of their own (the see-through view fades a whole wing, not the whole mall)
  const smK = new Kit();
  const smG = new THREE.Group();
  smG.name = 'mall wing supermarket front';
  const east = new Kit();
  const eastG = new THREE.Group();
  eastG.name = 'mall wing east shops';
  const back = new Kit();
  const backG = new THREE.Group();
  backG.name = 'mall wing back shops';

  realFloor(room, MALL.width, MALL.length, M.floor, 2.4);
  // The supermarket's light vinyl tiles, the shops' wood
  floorArea(g, M.terrazzo, SM.minX, SM.maxX, SM.minZ, SM.maxZ, 1.2);
  for (const c of EAST) floorArea(g, M.wood, EAST_FRONT + 0.1, W - 0.3, c - 3.4, c + 3.4, 1.6);
  for (const [a, b] of [[-7.7, 1.2], [5, 13], [13, 22.8]] as const) floorArea(g, M.wood, a + 0.1, b - 0.1, -L + 0.3, BACK_FRONT - 0.1, 1.6);

  // === The supermarket ======================================================================
  shopfront(smK, smG, [SM.maxX, SM.minZ], [SM.maxX, SM.maxZ], Math.PI / 2, ['EKO FRESH', 'Supermarket · Open 9 am – 9 pm'], brandSign('#c8102e'), { at: 5.5 - SM.minZ, width: 5 }, 3.8, 1.3);
  shopfront(smK, smG, [SM.minX, SM.maxZ], [SM.maxX, SM.maxZ], 0, ['EKO FRESH SUPERMARKET', 'Groceries · Bakery · Fresh produce'], brandSign('#c8102e'), null, 3.8, 1.3);
  GONDOLAS.forEach((x, i) => gondola(k, goods, x, ['staples', 'snacks', 'home', 'breakfast'][i], ['breakfast', 'drinks', 'staples', 'snacks'][i]));
  // The aisles' signs, hung over each
  const aisleNames = ['Rice · Garri · Beans', 'Tea · Milk · Cereal', 'Drinks · Water · Juice', 'Toiletries · Cleaning', 'Snacks · Oil'];
  [-27.6, -23.5, -19.5, -15.5, -12.1].forEach((x, i) => hangingSign(extra, k, [`AISLE ${i + 1}`, aisleNames[i]], 2.4, 0.7, { bg: '#c8102e', fg: '#ffffff', density: 110 }, x, 3.4, -10.5, Math.PI / 2 * 0, 5.2));
  // Strip lights over the aisles
  for (const x of [-27.6, -23.5, -19.5, -15.5, -11]) {
    k.box(M.lamp, 0.16, 0.06, 13, x, 4.8, -10.5);
    k.box(M.metalDark, 0.22, 0.05, 13.2, x, 4.86, -10.5);
  }
  // Rice, beans and oil along the left wall
  k.box(M.metalDark, 0.6, 0.1, 14, SM.minX + 0.3, 0, -10.5);
  k.box(M.plaster, 0.05, 2.15, 14, SM.minX + 0.05, 0, -10.5);
  for (const y of SHELVES) k.box(M.steel, 0.55, 0.025, 14, SM.minX + 0.3, y - 0.025, -10.5);
  stockRun(goods, AISLES.staples, SHELVES, [SM.minX + 0.39, -3.6], 13.8, Math.PI / 2);
  // The chillers along the back: lit inside, cold drinks and dairy behind glass doors
  const chillX0 = SM.minX + 0.2;
  const chillX1 = -14;
  const chillMid = (chillX0 + chillX1) / 2;
  const chillLen = chillX1 - chillX0;
  k.box(M.metalDark, chillLen, 2.3, 0.9, chillMid, 0, SM.minZ + 0.45);
  k.box(M.lamp, chillLen - 0.2, 1.95, 0.02, chillMid, 0.22, SM.minZ + 0.12);
  stockRun(goods, [['water', 'cola', 'orange', 'lemon'], ['malt', 'energy', 'juice'], ['yoghurt', 'juice', 'yoghurt'], ['beer', 'stout', 'water']], [0.3, 0.75, 1.2, 1.65], [chillX0 + 0.15, SM.minZ + 0.5], chillLen - 0.3, 0, 0.3);
  k.box(M.glass, chillLen - 0.1, 2.0, 0.02, chillMid, 0.2, SM.minZ + 0.92);
  for (let x = chillX0 + 0.1; x <= chillX1; x += 0.75) {
    k.box(M.metalDark, 0.05, 2.05, 0.05, x, 0.18, SM.minZ + 0.93);
    k.box(M.chrome, 0.025, 0.5, 0.04, x + 0.09, 0.9, SM.minZ + 0.97);
  }
  const chillSign = signMesh(['❄ COLD DRINKS · DAIRY · FROZEN'], 6, 0.5, { bg: '#0c4a6e', fg: '#e0f2fe', density: 110 });
  chillSign.position.set(chillMid, 2.65, SM.minZ + 0.92);
  extra.add(chillSign);
  // The bakery: a counter with bread under glass, the shelves of loaves behind
  k.box(M.woodDark, 4.4, 0.95, 0.8, -10.75, 0, -19.0);
  k.box(M.glassShelf, 4.2, 0.45, 0.6, -10.75, 0.95, -19.0);
  k.box(M.plaster, 4.6, 2.2, 0.1, -10.75, 0, SM.minZ + 0.1);
  for (const y of [0.9, 1.3, 1.7]) k.box(M.wood, 4.4, 0.03, 0.4, -10.75, y - 0.03, SM.minZ + 0.35);
  stockRun(goods, AISLES.bakery, [0.9, 1.3, 1.7], [-12.9, SM.minZ + 0.35], 4.3, 0, 0.3);
  stockRun(goods, [['bread', 'breadSliced']], [0.97], [-12.85, -19.0], 4.2, 0, 0.35);
  const bakerySign = signMesh(['🥖 BAKERY', 'Hot Agege bread · Meat pie · Doughnut'], 4, 0.8, { bg: '#78350f', fg: '#fde68a', density: 110 });
  bakerySign.position.set(-10.75, 2.75, SM.minZ + 0.18);
  extra.add(bakerySign);
  // Fresh produce: tomatoes, peppers, oranges, yams, plantain, onions, in crates on three tables
  for (const z of [-14.6, -9.7, -4.8]) produceTable(k, fruit, -10.5, z);
  hangingSign(extra, k, ['FRESH PRODUCE', 'Tomatoes · Pepper · Yam · Plantain'], 2.8, 0.7, { bg: '#15803d', fg: '#ffffff', density: 110 }, -10.5, 3.4, -9.7, Math.PI / 2, 5.2);
  // The tills: a counter, its belt, the scanner, the till screen, a number lit over each
  TILLS.forEach((x, i) => {
    k.box(M.red, 0.75, 0.95, 3.0, x, 0, TILL_Z);
    k.box(M.rubber, 0.5, 0.02, 1.9, x - 0.08, 0.95, TILL_Z - 0.5);
    k.box(M.glass, 0.4, 0.02, 0.35, x - 0.08, 0.96, TILL_Z + 0.65);
    k.box(M.metalDark, 0.06, 0.4, 0.06, x + 0.25, 0.95, TILL_Z + 0.5);
    k.box(M.screen, 0.32, 0.24, 0.04, x + 0.25, 1.35, TILL_Z + 0.5);
    k.box(M.steel, 0.65, 0.04, 0.7, x - 0.05, 0.6, TILL_Z + 1.15);
    k.cyl(M.steel, 0.03, 0.03, 2.2, x + 0.3, 0, TILL_Z - 1.4, 8);
    const n = signMesh([`${i + 1}`], 0.45, 0.45, { bg: '#c8102e', fg: '#ffffff', density: 120 });
    n.position.set(x + 0.3, 2.45, TILL_Z - 1.4);
    extra.add(n);
    room.block(x, TILL_Z, 0.42, 1.52, 0.95);
  });
  // Trolleys waiting by the door, nested in a row; the promotion of rice and oil
  for (let i = 0; i < 7; i++) {
    const z = 8 + i * 0.32;
    k.box(M.steel, 0.5, 0.42, 0.75, SM.minX + 1.1, 0.5, z);
    k.box(M.red, 0.56, 0.05, 0.05, SM.minX + 1.1, 1.0, z + 0.38);
    k.box(M.metalDark, 0.46, 0.08, 0.7, SM.minX + 1.1, 0.06, z);
  }
  room.block(SM.minX + 1.1, 9.1, 0.4, 1.5, 1.1);
  for (let tier = 0; tier < 3; tier++) {
    const n = 3 - tier;
    stockRun(goods, [[tier === 2 ? 'vegOil' : 'rice']], [tier * 0.42], [-21 - n * 0.48, 9.5 + 0.5 - tier * 0.1], n * 0.96, 0, 0.9, 0.42);
  }
  const promo = signMesh(['PROMO!', 'Rice 50 kg ₦78,000 · Oil ₦18,500'], 2.2, 0.8, { bg: '#facc15', fg: '#7f1d1d', density: 120 });
  promo.position.set(-21, 1.9, 10.05);
  extra.add(promo);
  room.block(-21, 9.5, 1.5, 0.6, 1.3);
  // Customer service
  k.box(M.woodDark, 3, 1.05, 0.8, -12.5, 0, 10.4);
  k.box(M.solid, 3.1, 0.05, 0.9, -12.5, 1.05, 10.4);
  const cs = signMesh(['CUSTOMER SERVICE', 'Airtime · Bills · Returns'], 2.6, 0.6, { bg: '#1e293b', fg: '#ffffff', density: 120 });
  cs.position.set(-12.5, 2.6, 9.6);
  extra.add(cs);
  room.block(-12.5, 10.4, 1.55, 0.45, 1.05);

  // Gondolas, the wall shelf, chillers, bakery and produce are solid
  for (const x of GONDOLAS) room.block(x, (GONDOLA.z0 + GONDOLA.z1) / 2, GONDOLA.half + 0.05, (GONDOLA.z1 - GONDOLA.z0) / 2 + 0.55, 2.2);
  room.block(SM.minX + 0.3, -10.5, 0.32, 7.1, 2.2);
  room.block(chillMid, SM.minZ + 0.45, chillLen / 2, 0.5, 2.3);
  room.block(-10.75, -19.0, 2.25, 0.42, 1.0);
  for (const z of [-14.6, -9.7, -4.8]) room.block(-10.5, z, 0.82, 1.72, 0.9);
  // The supermarket's glass walls: solid but for the door
  room.block(SM.maxX, (SM.minZ + 3) / 2, 0.1, (3 - SM.minZ) / 2, 3.8);
  room.block(SM.maxX, (8 + SM.maxZ) / 2, 0.1, (SM.maxZ - 8) / 2, 3.8);
  room.block((SM.minX + SM.maxX) / 2, SM.maxZ, (SM.maxX - SM.minX) / 2, 0.1, 3.8);

  // === The lobby by the supermarket: cash machines and benches ================================
  for (const [z, bank, colour] of [[15.2, 'Eko Commercial', 0x1e3a8a], [17.2, 'Naija Bank', 0x0f766e], [19.2, 'Unity Trust', 0x9a3412]] as const) {
    k.box(M.metal, 0.7, 1.75, 0.65, -W + 0.4, 0, z, Math.PI / 2);
    k.box(M.screen, 0.02, 0.32, 0.4, -W + 0.76, 1.15, z);
    const panel = new THREE.MeshStandardMaterial({ color: colour, roughness: 0.4 });
    k.box(panel, 0.03, 0.35, 0.66, -W + 0.75, 1.5, z);
    const label = signMesh(['ATM', bank], 0.6, 0.3, { bg: `#${colour.toString(16).padStart(6, '0')}`, fg: '#ffffff', density: 160 });
    label.position.set(-W + 0.78, 1.95, z);
    label.rotation.y = Math.PI / 2;
    extra.add(label);
    room.block(-W + 0.4, z, 0.4, 0.4, 1.75);
  }
  bench(k, -20, 18.2, 3, Math.PI, true);
  bench(k, -14, 18.2, 3, Math.PI, true);
  planter(k, -17, 18.3, 1.2, 1.2);
  planter(k, -10, 18.3, 1.2, 1.2);
  for (const x of [-20, -14]) room.block(x, 18.2, 1.55, 0.35, 0.5);
  for (const x of [-17, -10]) room.block(x, 18.3, 0.62, 0.62, 0.6);

  // === The shops along the right ================================================================
  const eastShops: Array<{ name: string[]; colour: string }> = [
    { name: ['PHONEHUB', 'Phones · Laptops · Gadgets'], colour: '#1d4ed8' },
    { name: ['ANKARA HOUSE', 'Fashion · Ready-to-wear · Tailoring'], colour: '#7e22ce' },
    { name: ['✚ CAREPOINT PHARMACY', 'Medicines · Checks · Advice'], colour: '#15803d' },
    { name: ['GOLD CREST', 'Jewellers · Watches'], colour: '#171717' },
    { name: ['KICKS & HEELS', 'Shoes · Bags'], colour: '#ea580c' },
  ];
  EAST.forEach((c, i) => {
    shopfront(east, eastG, [EAST_FRONT, c - 3.5], [EAST_FRONT, c + 3.5], -Math.PI / 2, eastShops[i].name, brandSign(eastShops[i].colour), { at: 3.5, width: 2.6 }, 3.3, 1.0);
    // The wall between this shop and the next
    east.box(M.plaster, W - EAST_FRONT, 4.55, 0.15, (EAST_FRONT + W) / 2, 0, c + 3.5);
    room.block((EAST_FRONT + W) / 2, c + 3.5, (W - EAST_FRONT) / 2, 0.1, 4.5);
    room.block(EAST_FRONT, c - 2.4, 0.1, 1.1, 3.3);
    room.block(EAST_FRONT, c + 2.4, 0.1, 1.1, 3.3);
    // Every shop's counter, at the back right, and its back wall lit
    k.box(M.woodDark, 0.7, 1.0, 2.2, 27.4, 0, c + 1.8);
    k.box(M.solid, 0.8, 0.04, 2.3, 27.4, 1.0, c + 1.8);
    room.block(27.4, c + 1.8, 0.4, 1.15, 1.0);
    k.box(M.lamp, 0.02, 0.06, 6.6, W - 0.32, 3.1, c);
  });
  // PhoneHub: phones lit on the back wall and on a table in the middle
  {
    const c = EAST[0];
    k.box(M.black, 0.12, 2.0, 5, W - 0.36, 0.6, c - 1);
    for (let r = 0; r < 4; r++) for (let i = 0; i < 9; i++) {
      k.box(M.screen, 0.02, 0.16, 0.08, W - 0.43, 0.9 + r * 0.42, c - 3.1 + i * 0.5);
      k.box(i % 3 ? M.lamp : M.glass, 0.01, 0.13, 0.065, W - 0.445, 0.915 + r * 0.42, c - 3.1 + i * 0.5);
    }
    k.box(M.solid, 1.1, 0.9, 2.4, 25.4, 0, c - 1.2);
    for (let i = 0; i < 8; i++) k.box(i % 2 ? M.lamp : M.screen, 0.08, 0.01, 0.16, 25.1 + (i % 2) * 0.6, 0.91, c - 2.2 + Math.floor(i / 2) * 0.6);
    room.block(25.4, c - 1.2, 0.6, 1.25, 0.9);
  }
  // Ankara House: rails of clothes in bright prints, folded shirts on the wall
  {
    const c = EAST[1];
    const prints = [M.red, M.green, M.yellow, M.leaf, M.woodDark, M.black];
    for (const rz of [c - 2.2, c - 0.2]) {
      k.box(M.chrome, 0.03, 1.55, 0.03, 25.0, 0, rz - 0.9).box(M.chrome, 0.03, 1.55, 0.03, 25.0, 0, rz + 0.9).box(M.chrome, 0.03, 0.03, 1.85, 25.0, 1.55, rz);
      for (let i = 0; i < 10; i++) k.box(prints[(((i + Math.round(rz)) % prints.length) + prints.length) % prints.length], 0.5, 0.85, 0.04, 25.0, 0.65, rz - 0.8 + i * 0.18, Math.PI / 2);
      room.block(25.0, rz, 0.3, 0.95, 1.5);
    }
    for (let r = 0; r < 4; r++) for (let i = 0; i < 6; i++) k.box(prints[(r + i) % prints.length], 0.35, 0.12, 0.45, W - 0.5, 0.6 + r * 0.45, c - 3 + i * 0.55);
    k.box(M.wood, 0.4, 0.03, 3.5, W - 0.5, 0.58, c - 1.6);
  }
  // CarePoint Pharmacy: white shelves of packets, a green cross lit outside
  {
    const c = EAST[2];
    k.box(M.solid, 0.5, 2.1, 5, W - 0.55, 0, c - 1);
    stockRun(goods, [['toothpaste', 'soap'], ['lotion', 'hairCream'], ['soapGreen', 'toothpaste'], ['milkPowder', 'custard'], ['tissue', 'diapers']], SHELVES, [W - 0.62, c + 1.5], 5, -Math.PI / 2, 0.3);
    room.block(W - 0.55, c - 1, 0.3, 2.5, 2.1);
    const cross = signMesh(['✚'], 0.7, 0.7, { bg: '#16a34a', fg: '#ffffff', density: 120 });
    cross.position.set(EAST_FRONT - 0.2, 3.0, c - 3.0);
    cross.rotation.y = -Math.PI / 2;
    extra.add(cross);
  }
  // Gold Crest: dark wood, glass cases glinting with gold
  {
    const c = EAST[3];
    for (const [x, z] of [[25.2, c - 2], [25.2, c + 0.4], [W - 0.7, c - 1.8]] as const) {
      k.box(M.woodDark, 0.8, 0.85, 1.8, x, 0, z);
      k.box(M.glassShelf, 0.78, 0.3, 1.78, x, 0.85, z);
      for (let i = 0; i < 6; i++) k.box(M.yellow, 0.08, 0.02, 0.08, x - 0.2 + (i % 2) * 0.4, 0.88, z - 0.7 + Math.floor(i / 2) * 0.6);
      room.block(x, z, 0.45, 0.95, 1.1);
    }
  }
  // Kicks & Heels: a wall of shoes in pairs, a fitting bench
  {
    const c = EAST[4];
    const colours = [M.black, M.red, M.solid, M.woodDark, M.yellow, M.leatherTan];
    k.box(M.solid, 0.4, 2.2, 5.6, W - 0.5, 0, c - 0.8);
    for (let r = 0; r < 6; r++) for (let i = 0; i < 9; i++) {
      k.box(M.steel, 0.35, 0.02, 0.5, W - 0.6, 0.3 + r * 0.33, c - 3.2 + i * 0.6);
      for (const s of [-0.07, 0.07]) k.box(colours[(r + i) % colours.length], 0.26, 0.1, 0.11, W - 0.62, 0.32 + r * 0.33, c - 3.2 + i * 0.6 + s);
    }
    room.block(W - 0.5, c - 0.8, 0.25, 2.8, 2.2);
    bench(k, 25.3, c - 1, 2, Math.PI / 2);
    room.block(25.3, c - 1, 0.3, 1.05, 0.5);
  }
  // Eko Coffee, at the front right: a counter, the espresso machine, tables
  {
    k.box(M.woodDark, 0.8, 1.05, 4.6, W - 1.0, 0, 17.6);
    k.box(M.solid, 0.9, 0.05, 4.7, W - 1.0, 1.05, 17.6);
    k.box(M.chrome, 0.4, 0.45, 0.6, W - 1.0, 1.1, 16.6);
    k.box(M.black, 0.1, 1.6, 4.6, W - 0.35, 1.3, 17.6);
    room.block(W - 1.0, 17.6, 0.45, 2.35, 1.05);
    for (const z of [15.6, 19.4]) {
      diningTable(k, 25.4, z, 1.2, 0.8, Math.PI / 2, M.woodDark);
      room.block(25.4, z, 0.42, 0.62, 0.76);
    }
    for (const seat of SEATS.filter((x) => x.group.startsWith('coffee'))) {
      diningChair(k, seat, M.leatherTan);
      room.block(seat.x, seat.z, 0.23, 0.23, 0.46);
    }
    const sign = signMesh(['☕ EKO COFFEE', 'Espresso · Smoothies · Small chops'], 3.2, 0.8, { bg: '#3f2a1d', fg: '#fde68a', density: 120 });
    sign.position.set(W - 0.28, 3.1, 17.6);
    sign.rotation.y = -Math.PI / 2;
    extra.add(sign);
  }

  // === The shops along the back, under the gallery ================================================
  const backShops: Array<{ a: number; b: number; name: string[]; colour: string; door: number }> = [
    { a: -7.7, b: 1.2, name: ['EKO ELECTRONICS', 'TVs · Sound · Fridges · Generators'], colour: '#0f172a', door: 2.6 },
    { a: 5, b: 13, name: ['BOOKWORM', 'Books · Stationery'], colour: '#9a3412', door: 2.4 },
    { a: 13, b: 22.8, name: ['GLOW BEAUTY', 'Make-up · Hair · Skincare'], colour: '#be185d', door: 2.6 },
  ];
  for (const s of backShops) {
    shopfront(back, backG, [s.a, BACK_FRONT], [s.b, BACK_FRONT], 0, s.name, brandSign(s.colour), { at: (s.b - s.a) / 2, width: s.door }, 3.3, 1.0);
    for (const x of [s.a, s.b]) {
      back.box(M.plaster, 0.15, 4.55, L + BACK_FRONT, x, 0, (BACK_FRONT - L) / 2);
      room.block(x, (BACK_FRONT - L) / 2, 0.1, (L + BACK_FRONT) / 2, 4.5);
    }
    const mid = (s.a + s.b) / 2;
    room.block((s.a + mid - s.door / 2) / 2, BACK_FRONT, (mid - s.door / 2 - s.a) / 2, 0.1, 3.3);
    room.block((mid + s.door / 2 + s.b) / 2, BACK_FRONT, (s.b - mid - s.door / 2) / 2, 0.1, 3.3);
  }
  // Electronics: a wall of televisions all showing, a sound system, a generator by the door
  {
    for (let r = 0; r < 2; r++) for (let i = 0; i < 4; i++) {
      const x = -6.5 + i * 1.95;
      const y = 0.9 + r * 1.25;
      k.box(M.black, 1.75, 1.0, 0.06, x, y, -L + 0.36);
      const pic = new THREE.Mesh(new THREE.PlaneGeometry(1.65, 0.92), screenPicture(r * 4 + i));
      pic.position.set(x, y + 0.5, -L + 0.4);
      extra.add(pic);
    }
    k.box(M.woodDark, 7.6, 0.55, 0.6, -2.95, 0, -L + 0.6);
    room.block(-2.95, -L + 0.6, 3.8, 0.35, 0.6);
    for (const x of [-6.8, 0.6]) k.box(M.black, 0.4, 1.1, 0.4, x, 0, -19.6);
    k.box(M.woodDark, 2.4, 1.0, 0.7, -1.6, 0, -19.3);
    room.block(-1.6, -19.3, 1.25, 0.4, 1.0);
    // "I better pass my neighbour": the generator on show
    k.box(M.red, 0.9, 0.7, 0.6, -5.6, 0, -17.2);
    k.box(M.black, 0.92, 0.12, 0.62, -5.6, 0.7, -17.2);
    room.block(-5.6, -17.2, 0.5, 0.35, 0.8);
  }
  // Bookworm: shelves of books along the walls, a table of new titles
  {
    const spines = [M.red, M.green, M.yellow, M.black, M.woodDark, M.leatherTan, M.solid];
    for (const x of [5.4, 12.6]) {
      k.box(M.wood, 0.4, 2.2, 5.2, x, 0, -19);
      for (let r = 0; r < 5; r++) for (let i = 0; i < 16; i++) k.box(spines[(r * 3 + i) % spines.length], 0.25, 0.28 + ((i * 7) % 5) * 0.02, 0.05, x + (x < 9 ? 0.12 : -0.12), 0.15 + r * 0.42, -21.3 + i * 0.3);
      room.block(x, -19, 0.25, 2.65, 2.2);
    }
    k.box(M.woodDark, 2.0, 0.8, 1.2, 9, 0, -19.6);
    for (let i = 0; i < 8; i++) k.box(spines[i % spines.length], 0.3, 0.05, 0.4, 8.3 + (i % 4) * 0.45, 0.8, -19.85 + Math.floor(i / 4) * 0.5);
    room.block(9, -19.6, 1.05, 0.65, 0.85);
  }
  // Glow Beauty: mirrors ringed with lights, counters of make-up
  {
    for (let i = 0; i < 3; i++) {
      const x = 15 + i * 2.6;
      k.box(M.solid, 1.6, 0.95, 0.6, x, 0, -L + 0.6);
      k.box(M.glassShelf, 1.2, 1.0, 0.02, x, 1.2, -L + 0.33);
      for (let b = 0; b < 8; b++) k.box(M.lamp, 0.07, 0.07, 0.02, x - 0.65 + (b % 4) * 0.43, b < 4 ? 1.12 : 2.25, -L + 0.34);
    }
    room.block(17.6, -L + 0.6, 3.9, 0.35, 1.0);
    k.box(M.solid, 0.5, 2.1, 4, 22.3, 0, -19.5);
    stockRun(goods, [['lotion', 'hairCream'], ['soap', 'toothpaste'], ['hairCream', 'lotion'], ['soapGreen', 'soap'], ['lotion', 'insecticide']], SHELVES, [22.1, -17.6], 3.8, -Math.PI / 2, 0.3);
    room.block(22.3, -19.5, 0.3, 2.05, 2.1);
    k.box(M.woodDark, 2.4, 1.0, 0.7, 17.5, 0, -18.6);
    room.block(17.5, -18.6, 1.25, 0.4, 1.0);
  }

  // === The gallery above, the escalators up to it, the shops upstairs seen from below ============
  // Each run of gallery its own piece, so the view fades only the one between the camera and the player
  const backGallery = back;
  const eastGallery = east;
  galleryEdge(backGallery, [-8, BACK_FRONT], [1.4, BACK_FRONT], 0, L + BACK_FRONT, LEVEL);
  galleryEdge(backGallery, [4.45, BACK_FRONT], [EAST_FRONT, BACK_FRONT], 0, L + BACK_FRONT, LEVEL);
  galleryEdge(eastGallery, [EAST_FRONT, BACK_FRONT + 0.1], [EAST_FRONT, 14], -Math.PI / 2, W - EAST_FRONT, LEVEL);
  backGallery.box(M.solid, 3.05, 0.45, L + BACK_FRONT, 2.93, LEVEL - 0.45, (BACK_FRONT - L) / 2);
  backGallery.box(M.glass, 0.02, 1.05, L + BACK_FRONT, -8, LEVEL, (BACK_FRONT - L) / 2);

  // The columns under the gallery's edge are solid
  for (const x of [-7.5, 1.9, 4.95, 14, EAST_FRONT - 0.5]) room.block(x, BACK_FRONT - 0.5, 0.35, 0.35, LEVEL);
  for (let i = 0; i <= 4; i++) room.block(EAST_FRONT + 0.5, BACK_FRONT + (i / 4) * 30, 0.35, 0.35, LEVEL);
  const up = new Escalator({ x: MALL.up.x, z: MALL.up.foot, rise: LEVEL, run: MALL.run, up: true });
  const down = new Escalator({ x: MALL.down.x, z: MALL.down.foot, rise: LEVEL, run: MALL.run, up: false });
  g.add(up.group, down.group);
  room.ticks.push((delta) => { up.tick(delta); down.tick(delta); });
  room.block((MALL.up.x + MALL.down.x) / 2, MALL.up.foot - MALL.run / 2, 1.35, MALL.run / 2 + 0.2, 1.2);
  const upSign = signMesh(['⬆ FOOD COURT · CINEMA · FUN ZONE'], 3.4, 0.45, WAYFINDING);
  upSign.position.set((MALL.up.x + MALL.down.x) / 2, 3.1, MALL.up.foot + 0.4);
  extra.add(upSign);
  // Upstairs, along the back wall and the right: the cinema, the food court, the fun zone, a gym
  const upper = (lines: string[], width: number, style: Parameters<typeof brandSign>[0], x: number, z: number, yaw: number) => {
    const s = signMesh(lines, width, 1.0, brandSign(style));
    s.position.set(x, LEVEL + 3.3, z);
    s.rotation.y = yaw;
    (yaw === 0 ? backG : eastG).add(s);
  };
  upper(['🎬 EKO CINEMAS', 'Now showing · 5 screens'], 7, '#111827', 4, -L + 0.12, 0);
  upper(['🍔 FOOD COURT', 'Amala · Chicken · Shawarma · Pizza'], 7.5, '#b91c1c', 15.5, -L + 0.12, 0);
  upper(['🕹 FUN ZONE', 'Arcade · Bowling · Kids'], 6, '#7c3aed', W - 0.12, -6, -Math.PI / 2);
  upper(['💪 i-FIT GYM', 'Classes · Trainers'], 5, '#ea580c', W - 0.12, 6, -Math.PI / 2);
  back.box(M.black, 30, 3.6, 0.15, 7.5, LEVEL + 0.2, -L + 0.08);
  east.box(M.black, 0.15, 3.6, 30, W - 0.08, LEVEL + 0.2, -1);
  for (let i = 0; i < 5; i++) {
    const films = [['KING OF LAGOS', 'Nollywood · 7 pm'], ['OWAMBE', 'Comedy · 5 pm'], ['MAKOKO', 'Drama · 8 pm'], ['ADA & OBI', 'Romance · 6 pm'], ['THE HEIST', 'Action · 9 pm']];
    const p = poster(films[i][0], films[i][1], [['#7f1d1d', '#f59e0b'], ['#4c1d95', '#f472b6'], ['#0c4a6e', '#22d3ee'], ['#831843', '#fda4af'], ['#111827', '#ef4444']][i] as [string, string]);
    p.position.set(-5 + i * 1.7, LEVEL + 1.3, -L + 0.18);
    backG.add(p);
  }

  // === The atrium: a fountain, benches round it, kiosks, the car to be won ======================
  const fx = 11;
  const fz = -1;
  k.cyl(M.floorDark, 2.7, 2.8, 0.55, fx, 0, fz, 40);
  const water = new THREE.Mesh(new THREE.CircleGeometry(2.45, 40).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x38bdf8, emissive: 0x0c4a6e, emissiveIntensity: 0.6, roughness: 0.05, metalness: 0.3, transparent: true, opacity: 0.85 }));
  water.position.set(fx, 0.5, fz);
  extra.add(water);
  k.cyl(M.steel, 0.9, 1.1, 0.5, fx, 0.5, fz, 24).cyl(M.steel, 0.5, 0.6, 0.6, fx, 1.0, fz, 20).cyl(M.steel, 0.12, 0.25, 0.9, fx, 1.6, fz, 12);
  const jets = new THREE.Group();
  const jetMat = new THREE.MeshBasicMaterial({ color: 0xe0f2fe, transparent: true, opacity: 0.55, depthWrite: false });
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const jet = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.05, 1, 6).translate(0, 0.5, 0), jetMat);
    jet.position.set(fx + Math.sin(a) * 1.6, 0.5, fz + Math.cos(a) * 1.6);
    jets.add(jet);
  }
  extra.add(jets);
  let time = 0;
  room.ticks.push((delta) => {
    time += delta;
    jets.children.forEach((j, i) => { j.scale.y = 0.9 + Math.sin(time * 2.2 + i) * 0.35; });
  });
  room.block(fx, fz, 2.8, 2.8, 0.6);
  for (let i = 0; i < 4; i++) {
    const a = Math.PI / 4 + (i / 4) * Math.PI * 2;
    const bx = fx + Math.sin(a) * 4.3;
    const bz = fz + Math.cos(a) * 4.3;
    bench(k, bx, bz, 2.4, a);
    // Solid along its length only, so the floor in front of it stays free to sit down from
    for (let t = -1.0; t <= 1.01; t += 0.5) room.block(bx + Math.cos(a) * t, bz - Math.sin(a) * t, 0.2, 0.2, 0.5);
  }
  extra.add(lightPool(9, 9, fx, fz, 0.18));
  // Eko Creamery: a round ice cream kiosk under a striped canopy
  k.cyl(M.solid, 1.2, 1.2, 1.0, -2.5, 0, 6, 28).cyl(M.glassShelf, 1.15, 1.15, 0.3, -2.5, 1.0, 6, 28);
  for (const a of [0, 2.1, 4.2]) k.cyl(M.chrome, 0.03, 0.03, 1.4, -2.5 + Math.sin(a) * 1.1, 1.0, 6 + Math.cos(a) * 1.1, 8);
  k.cyl(M.red, 1.5, 1.5, 0.12, -2.5, 2.4, 6, 28).cyl(M.solid, 0.1, 1.5, 0.45, -2.5, 2.52, 6, 28);
  const ice = signMesh(['🍦 EKO CREAMERY'], 2.4, 0.45, { bg: '#db2777', fg: '#ffffff', density: 120 });
  ice.position.set(-2.5, 3.25, 6);
  extra.add(ice);
  room.block(-2.5, 6, 1.25, 1.25, 1.2);
  // The gadget kiosk: phone cases, chargers and earbuds hanging on its walls
  k.box(M.black, 2.4, 1.0, 1.4, 17, 0, 7);
  k.box(M.solid, 2.5, 0.05, 1.5, 17, 1.0, 7);
  for (let i = 0; i < 18; i++) k.box([M.red, M.yellow, M.green, M.solid, M.black][i % 5], 0.12, 0.2, 0.02, 15.9 + (i % 9) * 0.27, 1.3 + Math.floor(i / 9) * 0.3, 6.4);
  k.box(M.black, 2.4, 0.9, 0.05, 17, 1.2, 6.35);
  const gadgets = signMesh(['📱 OGA GADGETS', 'Cases · Chargers · Earbuds'], 2.3, 0.5, { bg: '#0f172a', fg: '#facc15', density: 120 });
  gadgets.position.set(17, 2.45, 6.36);
  extra.add(gadgets);
  room.block(17, 7, 1.25, 0.75, 1.0);
  // Mama Puff's cart: puff-puff, popcorn and chin chin
  k.box(M.yellow, 1.6, 0.95, 0.8, 17, 0, -9);
  k.box(M.glassShelf, 1.5, 0.5, 0.7, 17, 0.95, -9);
  for (let i = 0; i < 14; i++) k.cyl(M.woodDark, 0.05, 0.05, 0.08, 16.5 + (i % 7) * 0.16, 1.0, -9.15 + Math.floor(i / 7) * 0.25, 8);
  k.cyl(M.red, 0.9, 0.9, 0.08, 17, 2.3, -9, 20).cyl(M.chrome, 0.03, 0.03, 1.35, 17, 0.95, -9, 6);
  room.block(17, -9, 0.85, 0.45, 1.0);
  // The car to be won, on its turntable, roped off
  k.cyl(M.floorDark, 2.5, 2.5, 0.22, -3.9, 0, -11.5, 40).cyl(M.chrome, 2.52, 2.52, 0.03, -3.9, 0.2, -11.5, 40);
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    k.cyl(M.chrome, 0.03, 0.04, 0.95, -3.9 + Math.sin(a) * 2.9, 0, -11.5 + Math.cos(a) * 2.9, 8);
    k.box(M.red, 0.04, 0.04, 3.0, -3.9 + Math.sin(a + Math.PI / 6) * 2.5, 0.85, -11.5 + Math.cos(a + Math.PI / 6) * 2.5, a + Math.PI / 6 + Math.PI / 2);
  }
  const car = buildKitCar('lexus_rx', 0xb91c1c, { light: true }).group;
  car.position.set(-3.9, 0.22, -11.5);
  car.rotation.y = 0.7;
  g.add(car);
  let turn = 0;
  room.ticks.push((delta) => { turn += delta * 0.15; car.rotation.y = 0.7 + turn; });
  const win = signMesh(['🎁 SHOP & WIN', 'Spend ₦50,000 · Win this car!'], 2.6, 0.75, { bg: '#b91c1c', fg: '#ffffff', density: 120, accent: '#facc15' });
  win.position.set(-3.9, 2.6, -8.6);
  extra.add(win);
  room.block(-3.9, -11.5, 2.9, 2.9, 1.5);
  // The information desk by the door, the directory beside it, the metal-detector arch
  k.soft(M.solid, 3, 1.05, 0.9, 7, 0, 15.5, 0.3);
  k.box(M.woodDark, 3.1, 0.05, 1.0, 7, 1.05, 15.5);
  const info = signMesh(['ℹ INFORMATION'], 2, 0.4, WAYFINDING);
  info.position.set(7, 2.4, 15.04);
  extra.add(info);
  room.block(7, 15.5, 1.55, 0.5, 1.05);
  const directory = signMesh(['IKEJA CITY MALL', 'Upper: Cinema · Food Court · Fun Zone · Gym', 'Ground: Eko Fresh · Shops · Coffee · ATMs'], 3.2, 1.4, { bg: '#111827', fg: '#ffffff', density: 120, align: 'left' });
  directory.position.set(3.6, 1.6, 18.55);
  extra.add(directory);
  k.box(M.metalDark, 3.3, 2.0, 0.1, 3.6, 0.5, 18.48).box(M.metalDark, 0.1, 0.5, 0.1, 2.3, 0, 18.48).box(M.metalDark, 0.1, 0.5, 0.1, 4.9, 0, 18.48);
  room.block(3.6, 18.48, 1.7, 0.15, 2.4);
  for (const x of [-0.95, 0.95]) k.box(M.metalDark, 0.12, 2.2, 0.5, x, 0, 18.4);
  k.box(M.metalDark, 2.02, 0.15, 0.5, 0, 2.2, 18.4);
  k.box(M.lamp, 0.05, 0.05, 0.3, 0.9, 2.0, 18.4);
  for (const x of [-0.95, 0.95]) room.block(x, 18.4, 0.08, 0.25, 2.2);
  // Planters along the walkway, banners over the atrium
  for (const [x, z] of [[-6, -2], [-6, 10], [20.5, -14], [20.5, 13.5], [8, 10], [14.5, 10]] as const) {
    planter(k, x, z);
    room.block(x, z, 0.62, 0.62, 0.6);
  }
  // The sale banner along the gallery's edge, where it hides nothing
  const sale = signMesh(['DETTY DECEMBER SALES · UP TO 50% OFF · ALL SHOPS'], 14, 0.7, { bg: '#b91c1c', fg: '#ffffff', density: 90, accent: '#facc15' });
  sale.position.set(14, LEVEL - 0.6, BACK_FRONT + 0.08);
  backG.add(sale);

  // === Light: skylights over the atrium, panels over the rest, soft pools on the floor ============
  // (No ceiling fittings: the camera looks down from above the roof, and they would hide the floor)
  for (const [x, z] of [[-2, -4], [4, 8], [18, 2], [-18, 6], [-10, -10], [26, -10], [26, 6]] as const) extra.add(lightPool(7, 7, x, z, 0.12));
  for (const [x, y, z] of [[6, H - 1.2, -6], [6, H - 1.2, 9], [-19, 6, -6], [26, 4.2, -2]] as const) {
    const light = new THREE.PointLight(0xfff3df, 2.4, 34, 1.2);
    light.position.set(x, y, z);
    extra.add(light);
  }
  // Shades under the counters and the shelves
  for (const x of GONDOLAS) extra.add(contactShade(1.6, 15.5, x, -10.5, 0.3));
  for (const x of TILLS) extra.add(contactShade(1.1, 3.4, x, TILL_Z, 0.3));

  // The produce, all the crates' worth as instanced shapes, three kinds
  const shapes = [new THREE.SphereGeometry(1, 8, 6), new THREE.CapsuleGeometry(0.5, 1.2, 3, 6).rotateX(Math.PI / 2), new THREE.CapsuleGeometry(0.25, 1.6, 3, 6).rotateX(Math.PI / 2)];
  shapes.forEach((shape, kind) => {
    const list = fruit.filter((f) => f.kind === kind);
    if (!list.length) return;
    const mesh = new THREE.InstancedMesh(shape, new THREE.MeshStandardMaterial({ roughness: 0.45 }), list.length);
    const c = new THREE.Color();
    list.forEach((f, i) => { mesh.setMatrixAt(i, f.m); mesh.setColorAt(i, c.setHex(f.c)); });
    mesh.name = 'fresh produce';
    extra.add(mesh);
  });

  const built = k.build('ikeja mall');
  smG.add(smK.build('supermarket front'));
  eastG.add(east.build('east shops'));
  backG.add(back.build('back shops'));
  g.add(built, goods.build('eko fresh goods'), extra, smG, eastG, backG);
  mergeFloorDecals(g);
}

// --- The people ----------------------------------------------------------------------------------

/** The paths people walk, and where they go: aisles, windows, kiosks, tills */
function crowdLayout(room: PlaceInterior, playerAt: () => THREE.Vector3 | null): CrowdLayout {
  const nodes: Array<[number, number]> = [];
  const links: Array<[number, number]> = [];
  const node = (x: number, z: number) => nodes.push([x, z]) - 1;
  const join = (...chain: number[]) => { for (let i = 1; i < chain.length; i++) links.push([chain[i - 1], chain[i]]); };
  // The mall's walkways
  const door = node(0, 20.6);
  const lobby = node(0, 16.2);
  const info = node(7, 13.4);
  const west = node(-5, 13.4);
  const smOut = node(-5, 5.5);
  const w0 = node(-5, -1);
  const w1 = node(-6.6, -7);
  const back0 = node(-0.5, -14.3);
  const mid0 = node(5.6, 5.5);
  const mid1 = node(5.6, -6.2);
  const back1 = node(9, -14.3);
  const back2 = node(17.8, -14.3);
  const e0 = node(20.5, -12);
  const e1 = node(20.5, -3.5);
  const e2 = node(20.5, 3.5);
  const e3 = node(20.5, 10.5);
  const e4 = node(19, 15.5);
  const fN = node(11, 4.8);
  join(door, lobby, info, e4, e3, e2, e1, e0, back2, back1, back0, w1, w0, smOut, west, lobby);
  join(mid0, mid1, back1);
  join(mid0, fN, e2);
  join(smOut, mid0, info);
  join(w0, mid1);
  // Into each shop on the right, and those at the back
  const eastDoor = EAST.map((c) => node(21.9, c));
  eastDoor.forEach((d, i) => join(d, [e0, e0, e1, e2, e3][i]));
  const backDoor = [[-3.25, back0], [9, back1], [17.9, back2]].map(([x, near]) => { const d = node(x, -14.9); join(d, near); return d; });
  // The supermarket: its door, the cross aisles at the front and the back, each aisle between
  const smIn = node(-10.2, 6.4);
  const smFront = node(-10.2, -1.4);
  join(smOut, smIn, smFront);
  const front = TILLS.map((x) => node(lane(x), -1.4));
  const backRow = TILLS.map((x) => node(lane(x), -18.9));
  const exitRow = TILLS.map((x) => node(lane(x), 6.9));
  join(front[0], front[1], front[2], front[3], smFront);
  join(backRow[0], backRow[1], backRow[2], backRow[3]);
  const produceSide = node(-8.85, -10);
  const bakery = node(-10.75, -18.1);
  join(smFront, node(-8.85, -1.4), produceSide, node(-8.85, -18.1), bakery, backRow[3]);
  front.forEach((f, i) => join(f, backRow[i]));
  join(exitRow[0], exitRow[1], exitRow[2], exitRow[3], smIn);

  const spots: CrowdSpot[] = [];
  const spot = (s: CrowdSpot) => spots.push(s);
  // Browsing the aisles: either side, along each
  TILLS.forEach((x) => {
    for (const z of [-15.5, -12, -8.5, -5]) spot({ x: lane(x) + (z % 2 ? 0.25 : -0.25), z, yaw: z % 2 ? Math.PI / 2 : -Math.PI / 2, group: 'shop', stay: [3, 9] });
  });
  for (let x = -27; x <= -15; x += 2.4) spot({ x, z: -19.7, yaw: Math.PI, group: 'shop', stay: [3, 7] });
  spot({ x: -10.75, z: -18.0, yaw: Math.PI, group: 'shop', stay: [5, 10], mode: 'talk' });
  for (const z of [-14, -9.5, -5]) spot({ x: -8.85, z, yaw: -Math.PI / 2, group: 'shop', stay: [4, 9] });
  spot({ x: -20.4, z: 8.4, yaw: 0, group: 'shop', stay: [3, 6] });
  // Two tills for the crowd (the third is the one a new cashier works, the fourth the player's): the spot, the place behind, the way out
  TILLS.slice(0, 2).forEach((x, i) => spot({ x: lane(x), z: TILL_Z + 0.4, yaw: Math.PI / 2, group: 'shop', till: [lane(x), TILL_Z - 1.9], stay: [6, 10], mode: 'talk', node: front[i], exit: { pts: [[lane(x), 6.9]], node: exitRow[i] } }));
  // The mall: shop windows and inside the shops, the kiosks, the car, the fountain, the directory
  EAST.forEach((c) => {
    spot({ x: 21.8, z: c - 2.2, yaw: Math.PI / 2, group: 'mall', stay: [4, 9] });
    spot({ x: 25.5, z: c + 1.4, yaw: Math.PI / 2, group: 'mall', stay: [6, 14], node: eastDoor[EAST.indexOf(c)] });
  });
  [[-3.25, -17.4], [9, -17.6], [17.9, -17.4]].forEach(([x, z], i) => spot({ x, z, yaw: Math.PI, group: 'mall', stay: [6, 12], node: backDoor[i] }));
  for (const [x, z, yaw] of [[-2.5, 7.9, Math.PI], [17, 8.5, Math.PI], [17, -7.9, Math.PI], [-0.4, -10.5, -Math.PI / 2], [-3.9, -8.2, Math.PI], [3.6, 17.6, Math.PI], [7, 14.3, Math.PI], [11, 2.6, Math.PI], [14.6, -1, -Math.PI / 2], [-6.2, 4, -Math.PI / 2]] as const) {
    spot({ x, z, yaw, group: 'mall', stay: [4, 12], mode: Math.random() < 0.3 ? 'talk' : 'idle' });
  }
  // Benches round the fountain and in the lobby, people sat on them
  const seats: CrowdLayout['seats'] = CROWD_SEATS.map((s) => ({ x: s.x, z: s.z, yaw: s.yaw, y: Math.max(0, s.top - 0.46) }));
  return {
    nodes, links, doors: [door], spots, seats,
    strollers: [
      { a: [-6.5, -19], b: [21, -19], y: LEVEL, count: 7 },
      { a: [26.5, -14], b: [26.5, 12.5], y: LEVEL, count: 5 },
    ],
    shoppers: 16,
    walkers: 22,
    playerAt,
    origin: room.group.position,
  };
}

/** The escalator up to the gallery, and the crowd */
function attach(room: PlaceInterior): void {
  build(room);
  room.group.userData.view = { width: 26, length: 20 };
  const shell = room.group.getObjectByName('interior_room_shell');
  if (shell) shell.userData.view = { width: 26, length: 20 };
  const crowd = new MallCrowd(crowdLayout(room, () => MallPlayer.at()));
  room.group.add(crowd.group);
  room.crowds.push(crowd);
  room.ticks.push((delta) => crowd.update(delta));
  addSeats(room, FREE_SEATS, { name: '🪑 Bench', description: 'Sit down and rest your legs.' });
  room.busySeats.push(...CROWD_SEATS.map((s) => [s.x, s.z] as [number, number]));

  room.addCard({
    id: 'mall_escalator_up', name: '⬆ Escalator to the upper level', description: 'Up to the food court, the cinema and the fun zone.',
    at: [MALL.up.x, MALL.up.foot + 0.4], stand: [MALL.up.x, MALL.up.foot + 1.4],
    label: () => '⬆ Escalator up to the food court and cinema',
    run: (host: PlaceHost) => {
      const actor = host.actor;
      const upper = placeRooms.get(MALL_UPPER.key);
      if (!upper || host.director.interrupt(actor) === 'locked') return;
      const top = MALL.up.foot - MALL.run;
      const ride = new Sequence('mall escalator up', [actor]).locked().add(
        steps.walk(actor, room.at(MALL.up.x, MALL.up.foot + 1.2), { ifStuck: 'snap' }),
        steps.face(actor, Math.PI),
        steps.slide(actor, room.at(MALL.up.x, MALL.up.foot + 0.2), 0.5),
        rideStair(actor, room.at(MALL.up.x, MALL.up.foot), room.at(MALL.up.x, top), 0, LEVEL, 7),
      );
      ride.onEnd((reason) => {
        actor.root.position.y = 0;
        if (reason === 'done') host.ride(MALL_UPPER.id, upper.at(MALL_UPPER.up.x, MALL_UPPER.up.top - 1.0), Math.PI);
      });
      host.director.run(ride);
    },
  });
}

export { MallPlayer };

// --- The place -----------------------------------------------------------------------------------

const S = (id: string, name: string, at: [number, number], stand: [number, number], who: string, role: string, text: string, choices: StationChoice[]) => ({ id, name, at, stand, who, role, text, choices });

export const IKEJA_MALL: PlaceSpec = {
  key: 'ikeja-city-mall',
  name: 'Ikeja City Mall',
  district: 'Ikeja · Alausa',
  room: { width: MALL.width, length: MALL.length, height: H, floor: 0xece7df, wall: 0xf4f1ec },
  build: () => {},
  attach,
  staff: [
    { name: 'Mr Musa', title: 'Mall security', at: [-1.9, 18.9], facing: Math.PI / 2, outfit: 0x1f2937, gender: 'male', cap: true, says: 'Welcome to Ikeja City Mall! Raise your hands small.' },
    { name: 'Kemi', title: 'Information desk', at: [7, 16.25], facing: 0, outfit: 0x0f766e, gender: 'female', says: 'Welcome! How can I help you?' },
    { name: 'Bola', title: 'Cashier · Till 4', at: [TILLS[3] + 0.85, TILL_Z + 0.4], facing: -Math.PI / 2, outfit: 0xc8102e, gender: 'female', says: 'Next customer, please!' },
    { name: 'Ruth', title: 'Cashier · Till 1', at: [TILLS[0] + 0.85, TILL_Z + 0.4], facing: -Math.PI / 2, outfit: 0xc8102e, gender: 'female', says: 'You are welcome!' },
    { name: 'Tunde', title: 'Cashier · Till 2', at: [TILLS[1] + 0.85, TILL_Z + 0.4], facing: -Math.PI / 2, outfit: 0xc8102e, gender: 'male', says: 'Card or transfer?' },
    { name: 'Chidi', title: 'Shelf attendant', at: [-23.5, -7.4], facing: 0, outfit: 0xc8102e, gender: 'male', cap: true, says: 'Can I help you find anything?' },
    { name: 'Mama Tola', title: 'Bakery', at: [-10.75, -20.35], facing: 0, outfit: 0xf8fafc, gender: 'female', chef: true, says: 'Hot bread just came out!' },
    { name: 'Mama Nkechi', title: 'Fresh produce', at: [-10.5, -12.15], facing: Math.PI / 2, outfit: 0x15803d, gender: 'female', says: 'Fresh tomatoes, fresh pepper!' },
    { name: 'Mrs Adaeze', title: 'Customer service', at: [-12.5, 9.55], facing: 0, outfit: 0x1e293b, gender: 'female', says: 'Customer service. How may I help you?' },
    { name: 'Emeka', title: 'PhoneHub', at: [28.4, EAST[0] + 1.8], facing: -Math.PI / 2, outfit: 0x1d4ed8, gender: 'male', says: 'Which phone are you looking for?' },
    { name: 'Aunty Ronke', title: 'Ankara House', at: [28.4, EAST[1] + 1.8], facing: -Math.PI / 2, outfit: 0x7e22ce, gender: 'female', says: 'Fine fabrics, fine cuts!' },
    { name: 'Pharm. Daniel', title: 'CarePoint Pharmacy', at: [28.4, EAST[2] + 1.8], facing: -Math.PI / 2, outfit: 0xf8fafc, gender: 'male', says: 'What are you treating today?' },
    { name: 'Mr Lawal', title: 'Gold Crest', at: [28.4, EAST[3] + 1.8], facing: -Math.PI / 2, outfit: 0x171717, gender: 'male', tie: true, says: 'Eighteen carat, sir. Pure gold.' },
    { name: 'Precious', title: 'Kicks & Heels', at: [28.4, EAST[4] + 1.8], facing: -Math.PI / 2, outfit: 0xea580c, gender: 'female', says: 'What size do you wear?' },
    { name: 'Ifeanyi', title: 'Eko Coffee', at: [W - 0.35, 18.4], facing: -Math.PI / 2, outfit: 0x3f2a1d, gender: 'male', says: 'Coffee or smoothie?' },
    { name: 'Mr Femi', title: 'Eko Electronics', at: [-1.6, -20.2], facing: 0, outfit: 0x0f172a, gender: 'male', says: 'Correct TV, correct price!' },
    { name: 'Mrs Ibe', title: 'Bookworm', at: [9, -20.6], facing: 0, outfit: 0x9a3412, gender: 'female', says: 'Looking for a good book?' },
    { name: 'Tolu', title: 'Glow Beauty', at: [17.5, -19.6], facing: 0, outfit: 0xbe185d, gender: 'female', says: 'Let me make you glow!' },
    { name: 'Funmi', title: 'Eko Creamery', at: [-2.5, 5.7], facing: 0, outfit: 0xdb2777, gender: 'female', says: 'Ice cream, cold cold!' },
    { name: 'Seun', title: 'Oga Gadgets', at: [17, 7.15], facing: 0, outfit: 0x0f172a, gender: 'male', says: 'Oga, original charger dey!' },
    { name: 'Mama Puff', title: 'Puff-puff & popcorn', at: [17, -9.75], facing: Math.PI, outfit: 0xfacc15, gender: 'female', says: 'Hot puff-puff!' },
    { name: 'Jessica', title: 'Shop & Win promoter', at: [-0.8, -9.2], facing: 0, outfit: 0xb91c1c, gender: 'female', says: 'Shop and win a brand-new car!' },
  ],
  stations: [
    S('security', '🛡️ Mall security', [-1.9, 18.9], [-1.9, 20.1], 'Mr Musa', 'Mall security', 'Welcome to Ikeja City Mall, oga! Abeg raise your hand small make I check you. Na normal routine.', [
      { label: 'Raise my hands for the check', note: 'Beep!', arms: 'wave', seconds: 2.5, effect: need({ fun: 2 }), said: '"Beep… na your belt buckle. Oya, enter. Enjoy yourself, oga!"' },
      { label: 'Ask where the cinema is', note: 'Directions', arms: 'rest', seconds: 1.5, said: '"Cinema and food court dey upstairs. Take the escalator by the car wey dem dey raffle."' },
      { label: 'Give him ₦500 for pure water', price: 500, note: 'Social +3', arms: 'reach', seconds: 1.5, effect: need({ social: 3 }), said: '"God bless you, oga! Anything you need for this mall, call Musa."' },
    ]),
    S('info', 'ℹ️ Information desk', [7, 15.5], [7, 14.3], 'Kemi', 'Information desk', 'Welcome to Ikeja City Mall! What would you like to find today?', [
      { label: 'Where is the supermarket?', note: 'Directions', arms: 'rest', seconds: 1.5, said: '"Eko Fresh is the big one on your left: groceries, bakery, fresh produce. Tills by the door."' },
      { label: 'Where are the cinema and food court?', note: 'Directions', arms: 'rest', seconds: 1.5, said: '"Upstairs. The escalators are past the fountain, by the car on the turntable."' },
      { label: 'Where can I get cash?', note: 'Directions', arms: 'rest', seconds: 1.5, said: '"Three ATMs in the lobby by the supermarket: Eko Commercial, Naija Bank, Unity Trust."' },
      { label: 'Where are the toilets?', note: 'Directions', arms: 'rest', seconds: 1.5, said: '"At the back, past the electronics shop. They are clean, I promise!"' },
      { label: 'What time do you close?', note: 'Hours', arms: 'rest', seconds: 1.5, said: '"9 am to 10 pm every day. The cinema runs till midnight on Fridays."' },
    ]),
    S('groceries', '🛒 Eko Fresh · Till 4', [TILLS[3], TILL_Z + 0.4], [lane(TILLS[3]), TILL_Z + 0.4], 'Bola', 'Cashier · Eko Fresh Supermarket', 'Good day! Did you find everything you wanted? Put them on the belt, let me ring you up.', [
      buy('A week of groceries', 45000, item('groceries_week', 'A week of groceries', '🛒', 45000, 'food', 30), 'Rice, bread, eggs, milk, noodles, drinks: beep, beep, beep. Two big nylon bags full.'),
      buy('Bag of rice, 10 kg', 19500, item('rice_10kg', 'Rice, 10 kg', '🍚', 19500, 'food', 20), '"Eko Gold rice, ten kilo. Stone-free!"'),
      buy('Carton of noodles', 12500, item('noodles_carton', 'Carton of noodles (40)', '🍜', 12500, 'food', 10), '"Forty packs. You will not go hungry this month."'),
      buy('Toiletries: soap, paste, tissue', 8500, item('toiletries_pack', 'Toiletries pack', '🧴', 8500, 'tool'), 'Soap, toothpaste, tissue, sponge: bagged.'),
      { label: 'Shop the shelves', note: 'Opens Shopping', open: 'app:shopping' },
    ]),
    S('aisles', '🛒 Aisle 2 · Tea, milk & cereal', [-23.5, -9], [-23.5, -9], 'Chidi', 'Shelf attendant · Eko Fresh', 'Good afternoon! You need help finding anything? Everything for breakfast dey this aisle.', [
      buy('Tin of milk powder', 6500, item('milk_powder', 'Milk powder, 400 g', '🥛', 6500, 'food', 8), 'Into your basket. Pay at the till.'),
      buy('Box of cornflakes', 4800, item('cornflakes', 'Cornflakes', '🥣', 4800, 'food', 8), 'Into your basket.'),
      buy('Tea bags and sugar', 3200, item('tea_sugar', 'Tea bags & sugar', '🍵', 3200, 'food', 4), 'Into your basket.'),
      buy('Tin of cocoa drink', 5500, item('cocoa_tin', 'Cocoa drink, 500 g', '🍫', 5500, 'food', 8), '"That one sweet well well with hot water," says Chidi.'),
    ]),
    S('drinks', '🥤 Aisle 3 · Drinks', [-19.5, -13], [-19.5, -13], 'Chidi', 'Shelf attendant · Eko Fresh', 'Drinks, water, juice: all here.', [
      buy('Pack of water, 12 bottles', 2800, item('water_pack', 'Pack of bottled water (12)', '💧', 2800, 'food', 6), 'Twelve cold bottles. Heavy!'),
      buy('Pack of malt, 6 cans', 4500, item('malt_pack', 'Malt drink (6 cans)', '🥫', 4500, 'food', 10), 'Into your basket.'),
      buy('Fruit juice, 1 litre', 2200, item('juice_litre', 'Fruit juice, 1 litre', '🧃', 2200, 'food', 6), 'Into your basket.'),
    ]),
    S('home', '🧼 Aisle 4 · Toiletries & cleaning', [-15.5, -6], [-15.5, -6], 'Eko Fresh', 'Toiletries & cleaning', 'Soap, detergent, tissue, insecticide.', [
      buy('Detergent, 2 kg', 5200, item('detergent', 'Detergent, 2 kg', '🧺', 5200, 'tool'), 'Into your basket.'),
      buy('Tissue, 12 rolls', 4800, item('tissue_12', 'Toilet tissue (12 rolls)', '🧻', 4800, 'tool'), 'Into your basket.'),
      buy('Insecticide spray', 2600, item('insecticide', 'Insecticide spray', '🦟', 2600, 'tool'), 'For the mosquitoes. Into your basket.'),
    ]),
    S('bakery', '🥖 Bakery', [-10.75, -19.0], [-10.75, -17.9], 'Mama Tola', 'Bakery · Eko Fresh', 'Welcome, my dear! Hot Agege bread just came out of the oven. How many loaves?', [
      buy('Agege bread, big loaf', 1500, item('agege_bread', 'Agege bread', '🍞', 1500, 'food', 10), 'Soft and hot in its nylon. The smell!'),
      snack('Meat pie, hot', 1200, 18, 'Flaky meat pie, still warm. You ate it standing.', 3),
      snack('Doughnut and a cold drink', 1500, 14, 'Sugar on your lips.', 4),
      buy('Birthday cake (order)', 25000, item('birthday_cake', 'Birthday cake', '🎂', 25000, 'food', 15), '"Pick it up by four o\'clock. Happy birthday to the celebrant!"'),
    ]),
    S('produce', '🍅 Fresh produce', [-10.5, -9.7], [-8.9, -9.7], 'Mama Nkechi', 'Fresh produce · Eko Fresh', 'Fresh tomatoes, fresh pepper, yam from Benue! Wetin you wan buy, my customer?', [
      buy('Tomatoes and pepper (a basket)', 4500, item('tomato_pepper', 'Tomatoes & pepper', '🍅', 4500, 'food', 5), 'Weighed and bagged. Stew is ready.'),
      buy('Tuber of yam', 3800, item('yam_tuber', 'Tuber of yam', '🍠', 3800, 'food', 15), 'A big one from Benue.'),
      buy('Bunch of plantain', 3000, item('plantain_bunch', 'Bunch of plantain', '🍌', 3000, 'food', 12), 'Half ripe, for dodo tomorrow.'),
      buy('Onions, 1 kg', 1600, item('onions', 'Onions, 1 kg', '🧅', 1600, 'food', 2), 'Into your basket.'),
    ]),
    S('service', '🎧 Customer service', [-12.5, 10.4], [-12.5, 11.5], 'Mrs Adaeze', 'Customer service · Eko Fresh', 'Good day! Customer service. Airtime, bills, returns: how may I help you?', [
      buy('Airtime, ₦2,000', 2000, item('airtime_2000', 'Airtime voucher ₦2,000', '📶', 2000, 'tool'), 'Loaded. "Thank you for shopping with us!"'),
      buy('Prepaid light token, ₦10,000', 10000, item('light_token', 'Prepaid meter token ₦10,000', '💡', 10000, 'tool'), 'Twenty digits printed on the receipt. NEPA, we move.'),
      buy('Gift card, ₦20,000', 20000, item('giftcard_20000', 'Eko Fresh gift card', '🎁', 20000, 'luxury'), 'A gift card in an envelope. Good present.'),
    ]),
    S('atm', '🏧 ATMs', [-W + 0.4, 17.2], [-W + 1.5, 17.2], 'ATM', 'Eko Commercial · Naija Bank · Unity Trust', 'Three cash machines. Insert your card.', [
      { label: 'Use the ATM', note: 'Opens your bank', open: 'app:bank' },
    ]),
    S('phones', '📱 PhoneHub', [27.4, EAST[0] + 1.8], [26.3, EAST[0] + 1.8], 'Emeka', 'PhoneHub · Phones & gadgets', 'Welcome to PhoneHub! New phones, UK-used, laptops, accessories. Which one dey your mind?', [
      buy('Wireless earbuds', 18000, item('earbuds', 'Wireless earbuds', '🎧', 18000, 'gadget'), '"Bass is heavy. Test am!"'),
      buy('Power bank, 20,000 mAh', 25000, item('powerbank', 'Power bank, 20,000 mAh', '🔋', 25000, 'gadget'), 'For when NEPA takes light.'),
      buy('Phone case and screen guard', 6000, item('phone_case', 'Phone case & screen guard', '📱', 6000, 'gadget'), 'Fixed on for you, no bubbles.'),
      buy('Smartwatch', 65000, item('smartwatch', 'Smartwatch', '⌚', 65000, 'gadget'), 'Counts your steps and your heartbeat.'),
    ]),
    S('fashion', '👗 Ankara House', [27.4, EAST[1] + 1.8], [26.3, EAST[1] + 1.8], 'Aunty Ronke', 'Ankara House · Fashion', 'Welcome, my dear! See fine Ankara, fresh from the tailor. For you, or for a gift?', [
      buy('Ankara shirt', 22000, item('ankara_shirt', 'Ankara shirt', '👕', 22000, 'luxury'), 'Bright print, cut slim. "You go fine pass!"'),
      buy('Ankara gown', 38000, item('ankara_gown', 'Ankara gown', '👗', 38000, 'luxury'), 'Folded in tissue paper in a branded bag.'),
      buy('Senator material, 4 yards', 30000, item('senator_fabric', 'Senator fabric (4 yards)', '🧵', 30000, 'luxury'), 'For your tailor to sew.'),
    ]),
    S('pharmacy', '💊 CarePoint Pharmacy', [27.4, EAST[2] + 1.8], [26.3, EAST[2] + 1.8], 'Pharm. Daniel', 'CarePoint Pharmacy', 'Good day! What are we treating today? Headache, malaria, or just vitamins?', [
      buy('Paracetamol', 600, item('paracetamol', 'Paracetamol', '💊', 600, 'medicine'), '"Two tablets, three times a day, after food."'),
      buy('Malaria treatment', 4500, item('malaria_drug', 'Malaria treatment pack', '💊', 4500, 'medicine'), '"Finish the dose o, even when you feel better."'),
      buy('Vitamin C', 2500, item('vitamin_c', 'Vitamin C', '🍊', 2500, 'medicine'), 'Fizzy tablets, orange flavour.'),
      { label: 'Check my blood pressure', price: 1000, note: 'Health +2', arms: 'reach', seconds: 4, effect: need({ health: 2 }), said: '"120 over 80. Perfect! Reduce salt and keep it so."' },
    ]),
    S('jewellery', '💍 Gold Crest Jewellers', [27.4, EAST[3] + 1.8], [26.3, EAST[3] + 1.8], 'Mr Lawal', 'Gold Crest · Jewellers', 'Welcome, sir. Eighteen-carat gold, Italian chains, watches. Something for madam?', [
      buy('Gold chain, 18 carat', 450000, item('gold_chain', 'Gold chain (18 ct)', '📿', 450000, 'luxury'), 'In a velvet box. It shines.'),
      buy('Wedding band', 280000, item('wedding_band', 'Wedding band', '💍', 280000, 'luxury'), '"Congratulations in advance!"'),
      buy('Wristwatch', 120000, item('wristwatch', 'Wristwatch', '⌚', 120000, 'luxury'), 'Steel bracelet, sized for your wrist.'),
    ]),
    S('shoes', '👟 Kicks & Heels', [27.4, EAST[4] + 1.8], [26.3, EAST[4] + 1.8], 'Precious', 'Kicks & Heels · Shoes', 'Welcome! Sneakers, loafers, heels. What size do you wear?', [
      buy('Sneakers', 35000, item('sneakers', 'Sneakers', '👟', 35000, 'luxury'), 'You walked up and down the shop in them. Correct fit.'),
      buy('Leather loafers', 42000, item('loafers', 'Leather loafers', '👞', 42000, 'luxury'), 'Shined and boxed.'),
      buy('Heels', 38000, item('heels', 'Heels', '👠', 38000, 'luxury'), '"Owambe ready!"'),
    ]),
    S('coffee', '☕ Eko Coffee', [W - 1.0, 17.6], [W - 2.1, 17.6], 'Ifeanyi', 'Eko Coffee', 'Welcome to Eko Coffee! Cappuccino, iced latte, smoothies, small chops. What can I get you?', [
      { label: 'Cappuccino', price: 3500, note: 'Energy +12', arms: 'eat', seconds: 4, effect: need({ energy: 12, hunger: 3 }), said: 'Hot, with a heart drawn in the foam.' },
      { label: 'Iced latte', price: 4000, note: 'Energy +10', arms: 'eat', seconds: 4, effect: need({ energy: 10, hunger: 3 }), said: 'Cold and creamy. AC and iced coffee: Lagos heat, who?' },
      snack('Chicken pie and a smoothie', 5500, 25, 'Mango smoothie, flaky pie.', 4),
    ]),
    S('electronics', '📺 Eko Electronics', [-1.6, -19.3], [-1.6, -18.1], 'Mr Femi', 'Eko Electronics', 'Welcome! Correct TV, correct price. Sound system, fridge, generator: anything for the house.', [
      buy('55-inch smart TV', 480000, item('smart_tv', '55-inch smart TV', '📺', 480000, 'electronics'), 'Delivered to your house tomorrow, with the wall bracket.'),
      buy('Sound bar', 120000, item('sound_bar', 'Sound bar', '🔊', 120000, 'electronics'), '"Your neighbours go hear am!"'),
      buy('Generator, 3.5 kVA', 350000, item('generator_35', 'Generator, 3.5 kVA', '⚡', 350000, 'electronics'), '"I better pass my neighbour." Delivered with a jerrycan.'),
      buy('Standing fan', 45000, item('standing_fan', 'Standing fan', '🌀', 45000, 'electronics'), 'Three speeds and a remote.'),
    ]),
    S('books', '📚 Bookworm', [9, -19.6], [9, -18.4], 'Mrs Ibe', 'Bookworm · Books & stationery', 'Welcome! New novels, school books, Bibles and Qurans, notebooks. What are you reading?', [
      buy('A Nigerian novel', 8500, item('novel', 'Nigerian novel', '📖', 8500, 'luxury'), '"You will not put it down. Trust me."'),
      buy('Notebook and pens', 2500, item('notebook_pens', 'Notebook & pens', '📓', 2500, 'tool'), 'For your plans.'),
      { label: 'Read in the corner a while', note: 'Fun +6', arms: 'rest', seconds: 10, effect: need({ fun: 6 }), said: 'Three chapters later, you looked up. Peaceful.' },
    ]),
    S('beauty', '💄 Glow Beauty', [17.5, -18.6], [17.5, -17.4], 'Tolu', 'Glow Beauty', 'Hi dear! Make-up, wigs, skincare, perfume. Let me make you glow today!', [
      buy('Perfume, 100 ml', 45000, item('perfume', 'Perfume (100 ml)', '🧴', 45000, 'luxury'), 'A spray on your wrist. You smelt it all day.'),
      buy('Skincare set', 28000, item('skincare_set', 'Skincare set', '🧴', 28000, 'luxury'), 'Cleanser, toner, cream, shea butter.'),
      { label: 'Quick make-up touch-up', price: 8000, note: 'Hygiene +8 · Fun +4', arms: 'rest', seconds: 6, effect: need({ hygiene: 8, fun: 4 }), said: '"Look at you! You fine pass yesterday!"' },
    ]),
    S('icecream', '🍦 Eko Creamery', [-2.5, 6], [-2.5, 7.8], 'Funmi', 'Eko Creamery', 'Hello! Ice cream, cold cold! Vanilla, chocolate, mango, zobo sorbet. Cup or cone?', [
      snack('Two scoops in a cone', 2500, 10, 'Vanilla and mango. It dripped on your hand.', 6),
      snack('Zobo sorbet', 2000, 8, 'Cold, sweet, a little ginger.', 6),
      snack('Ice cream sundae', 4000, 14, 'Chocolate sauce, sprinkles, wafer.', 8),
    ]),
    S('gadgets', '📱 Oga Gadgets kiosk', [17, 7], [17, 8.5], 'Seun', 'Oga Gadgets · Kiosk', 'Oga! Original charger, earpiece, phone case, screen guard: everything dey. Wetin you need?', [
      buy('Fast charger', 5000, item('charger', 'Fast charger', '🔌', 5000, 'gadget'), '"Original! If e no work, bring am back."'),
      buy('Wired earpiece', 2500, item('earpiece', 'Wired earpiece', '🎧', 2500, 'gadget'), 'Tested in your phone. Clear.'),
      buy('Ring light for videos', 9000, item('ring_light', 'Ring light', '💡', 9000, 'gadget'), 'For your TikTok, sharp sharp.'),
    ]),
    S('puffpuff', '🍩 Mama Puff', [17, -9], [17, -10.6], 'Mama Puff', 'Puff-puff & popcorn', 'Hot puff-puff! Popcorn, chin chin, groundnut. Come, my pikin, taste am!', [
      snack('Puff-puff, ten pieces', 1000, 15, 'Hot, soft, sugar on top.', 4),
      snack('Popcorn, big bag', 1500, 8, 'Salty and sweet together.', 4),
      buy('Chin chin, a pack', 1200, item('chinchin_pack', 'Chin chin', '🍪', 1200, 'food', 5), 'Crunchy, for later.'),
    ]),
    S('promo', '🎁 Shop & Win', [-0.8, -10.4], [-0.8, -8.0], 'Jessica', 'Shop & Win promoter', 'Hello! Shop for ₦50,000 at any shop in the mall and drop your receipt: you could drive this car home this December!', [
      { label: 'Drop my receipt in the box', note: 'Fun +4', arms: 'reach', seconds: 2, effect: need({ fun: 4 }), said: 'Your receipt went in with thousands of others. The draw is on 31 December. Fingers crossed!' },
      { label: 'Take a photo with the car', note: 'Fun +5 · Social +2', arms: 'wave', seconds: 2.5, effect: need({ fun: 5, social: 2 }), said: 'A photo by the turntable. "Na my car be this," you wrote under it.' },
    ]),
  ],
};
