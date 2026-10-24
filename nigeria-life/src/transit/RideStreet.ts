import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { Builder } from '../world/kit/ArchKit';
import { bakeToGeometry, seededRandom, simplifyByClustering } from '../graphics/MeshBaker';
import { HumanMeshBuilder, type HumanConfig } from '../graphics/HumanMeshBuilder';
import { buildKitCar } from '../world/vehicles/KitCar';
import { DrivableVehicle } from '../world/DrivableVehicle';
import { buildRideKeke, buildRideOkada } from './RideModels';

/**
 * The Lagos road a taxi, keke or okada ride goes down: two lanes each way with a median, kerbs
 * and paving, open drains, shops with awnings and signs, blocks of flats with water tanks on the
 * roofs, a filling station, a bus stop with people waiting, hawkers under umbrellas, power lines,
 * billboards, a footbridge. One stretch is built and repeated, and slides past the vehicle; the
 * other traffic is real cars, danfos, kekes and okadas, keeping their lanes.
 */

/** The length of one stretch before it repeats */
export const TILE = 220;
/** The stretch under the ride and the two beyond it: behind the ride, one is enough */
const COPIES = [0, 1, 2];

/** Across the road, in the street's own space: our side is toward -x, the median at +2.6 */
export const LANES = { kerb: -3.5, inner: 0, oncomingInner: 5.1, oncomingKerb: 8.6 };
const OUR_KERB = -5.3;
const MEDIAN_A = 1.9;
const MEDIAN_B = 3.3;
const THEIR_KERB = 10.4;
const WALK = 4.2;

const WALLS = [0xf1e4c8, 0xe7d3b3, 0xd9c1a0, 0xf5f5f4, 0xcbd5e1, 0xfde68a, 0xfed7aa, 0xbfdbfe, 0xbbf7d0, 0xe2e8f0, 0xfecaca, 0xd6d3d1, 0xa7f3d0, 0xfef3c7];
const AWNINGS = [0xdc2626, 0x16a34a, 0x2563eb, 0xf59e0b, 0x7c3aed, 0x0d9488, 0xdb2777, 0xea580c];
const PAINTS = [0xf8fafc, 0xe5e7eb, 0x9ca3af, 0x18181b, 0x111827, 0x7f1d1d, 0x1e3a8a, 0xb45309, 0x14532d, 0xd1d5db, 0x475569, 0x991b1b];

const SHOPS: Array<[string, string]> = [
  ['IYA BASIRA KITCHEN', '#b91c1c'], ['CHUKWUDI & SONS ELECTRONICS', '#1d4ed8'], ['BLESSED HANDS SALON', '#db2777'],
  ['ALHAJI MUSA PROVISIONS', '#15803d'], ['SHARP SHARP POS', '#0f766e'], ['FAITH PHONES & ACCESSORIES', '#7c3aed'],
  ['MAMA NKECHI FABRICS', '#c2410c'], ['OLUWASEUN PHARMACY', '#047857'], ['ADE BARBING SALOON', '#1e3a8a'],
  ["GOD'S GRACE SUPERMARKET", '#a16207'], ['EBUBE COLD ROOM', '#0369a1'], ['KEMI BAKERY & CAKES', '#be185d'],
  ['WAZOBIA FAST FOOD', '#dc2626'], ['NO WAHALA AUTO PARTS', '#334155'], ['DIVINE FAVOUR VULCANIZER', '#4d7c0f'], ['POST NO BILL', '#57534e'],
];
const ROW = 64;

/** Every shop sign on one canvas, a row each, so a whole stretch of signs is one draw */
function signAtlas(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = ROW * SHOPS.length;
  const ctx = canvas.getContext('2d')!;
  SHOPS.forEach(([name, bg], i) => {
    const y = i * ROW;
    ctx.fillStyle = bg;
    ctx.fillRect(0, y, 512, ROW);
    ctx.strokeStyle = 'rgba(255,255,255,0.75)';
    ctx.lineWidth = 3;
    ctx.strokeRect(4, y + 4, 504, ROW - 8);
    ctx.fillStyle = name === 'POST NO BILL' ? '#f5f5f4' : '#ffffff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `800 ${ROW * 0.5}px Outfit Variable, Arial, sans-serif`;
    ctx.fillText(name, 256, y + ROW * 0.54, 480);
  });
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

/** A sign plane facing +x or -x, its picture one row of the atlas */
function signPlane(row: number, width: number, height: number, x: number, y: number, z: number, facing: 1 | -1): THREE.BufferGeometry {
  const plane = new THREE.PlaneGeometry(width, height);
  const uv = plane.getAttribute('uv') as THREE.BufferAttribute;
  const top = 1 - row / SHOPS.length;
  const bottom = 1 - (row + 1) / SHOPS.length;
  for (let i = 0; i < uv.count; i++) uv.setY(i, uv.getY(i) > 0.5 ? top : bottom);
  plane.rotateY(facing > 0 ? Math.PI / 2 : -Math.PI / 2);
  plane.translate(x, y, z);
  return plane;
}

const BILLBOARDS: Array<[string, string, string]> = [
  ['NaijaFM 99.1', 'Afrobeats all day, all night', '#16a34a'],
  ['JOLLOF KINGDOM', 'Party jollof, delivered hot', '#dc2626'],
  ['EKO BANK', 'Your money, sharp sharp', '#1d4ed8'],
  ['OWAMBE HALL', 'Weddings · Birthdays · Burials', '#7c3aed'],
];

function billboard(title: string, line: string, bg: string): THREE.Mesh {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 220;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, 512, 220);
  ctx.fillStyle = 'rgba(255,255,255,0.16)';
  ctx.beginPath();
  ctx.arc(430, 40, 150, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.font = '800 64px Outfit Variable, Arial, sans-serif';
  ctx.fillText(title, 28, 92, 460);
  ctx.font = '600 30px Outfit Variable, Arial, sans-serif';
  ctx.fillText(line, 30, 160, 460);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return new THREE.Mesh(new THREE.PlaneGeometry(11, 4.7), new THREE.MeshBasicMaterial({ map: texture, side: THREE.DoubleSide, toneMapped: false }));
}

interface Traffic {
  mesh: THREE.Mesh;
  x: number;
  z: number;
  length: number;
  /** Its own speed; oncoming traffic comes the other way */
  speed: number;
  oncoming: boolean;
  /** How fast it likes to go, against the ride's own */
  temper: number;
}

const LOOKS: Array<Partial<HumanConfig> & { gender: 'male' | 'female' }> = [
  { gender: 'male', outfit: 'casual_tee', outfitColor: 0x10b981, hairstyle: 'fade' },
  { gender: 'female', outfit: 'blue_dress', outfitColor: 0xdb2777, hairstyle: 'braids' },
  { gender: 'male', outfit: 'senator', outfitColor: 0xf5f5f4, trousersColor: 0xf5f5f4, hairstyle: 'fila' },
  { gender: 'female', outfit: 'peplum_skirt', outfitColor: 0xf59e0b, hairstyle: 'gele' },
  { gender: 'male', outfit: 'student_casual', outfitColor: 0x1d4ed8, hairstyle: 'afro', hasBackpack: true },
  { gender: 'female', outfit: 'casual_blouse', outfitColor: 0x0d9488, hairstyle: 'ponytail' },
];

export class RideStreet {
  public readonly group = new THREE.Group();
  /** Moves the whole street across, so the ride's own lane is under the vehicle */
  private readonly across = new THREE.Group();
  private readonly scenery = new THREE.Group();
  private readonly trafficGroup = new THREE.Group();
  private readonly traffic: Traffic[] = [];
  private readonly rand = seededRandom(9127);
  private offset = 0;
  private laneX = 0;
  /** Keeps the next lane clear beside the ride, so a camera at the roadside sees it whole */
  public keepClear = false;

  constructor() {
    this.group.name = 'ride street';
    this.group.add(this.across);
    this.across.add(this.scenery, this.trafficGroup);
    const tile = this.buildTile();
    for (const k of COPIES) {
      const copy = k === 0 ? tile : tile.clone();
      copy.position.z = k * TILE;
      this.scenery.add(copy);
    }
    this.buildTraffic();
  }

  /** Which lane the ride keeps to: everything else is drawn round it */
  public setLane(x: number): void {
    this.laneX = x;
    this.across.position.x = -x;
    // Nothing of the traffic is left standing where the ride now is
    for (const car of this.traffic) if (!car.oncoming && Math.abs(car.x - x) < 1 && Math.abs(car.z) < 9) car.z += 30;
  }

  /** The street slides back by what the ride has gone; the traffic keeps its own pace */
  public advance(distance: number, speed: number, delta: number): void {
    this.offset = (this.offset + distance) % TILE;
    this.scenery.position.z = -this.offset;
    for (const car of this.traffic) {
      if (car.oncoming) {
        car.z -= (car.speed + speed) * delta;
        if (car.z < -90) car.z += 340;
      } else {
        // Same way as the ride: in a go-slow everyone crawls together, on a clear road some pull away
        const want = Math.max(0, speed * car.temper + (speed > 4 ? (car.temper - 1) * 6 : 0));
        car.speed += (want - car.speed) * Math.min(1, delta * 1.5);
        car.z += (car.speed - speed) * delta;
        if (car.z < -70) car.z += 300;
        if (car.z > 230) car.z -= 300;
      }
    }
    // Nobody drives into the one ahead of them, nor into the ride
    for (const lane of [LANES.kerb, LANES.inner]) {
      const cars = this.traffic.filter((c) => !c.oncoming && c.x === lane).sort((a, b) => a.z - b.z);
      for (let i = 1; i < cars.length; i++) {
        const gap = (cars[i].length + cars[i - 1].length) / 2 + 2.2;
        if (cars[i].z - cars[i - 1].z < gap) cars[i].z = cars[i - 1].z + gap;
      }
      if (Math.abs(lane - this.laneX) < 0.5) {
        for (const car of cars) {
          const gap = car.length / 2 + 4.6;
          if (car.z > 0 && car.z < gap) car.z = gap;
          if (car.z <= 0 && car.z > -gap) car.z = -gap;
        }
      }
    }
    if (this.keepClear) {
      // The lane the side camera stands in: by the kerb for a car, the inner lane for a keke or okada
      const beside = Math.abs(this.laneX - LANES.kerb) < 0.5 ? LANES.inner : LANES.kerb;
      for (const car of this.traffic) {
        if (car.oncoming || Math.abs(car.x - beside) > 0.5 || Math.abs(car.x - this.laneX) < 0.5) continue;
        const clear = car.length / 2 + 6;
        if (Math.abs(car.z) < clear) car.z = car.z < 0 ? -clear : clear;
      }
    }
    for (const car of this.traffic) car.mesh.position.set(car.x, 0, car.z);
  }

  // ----------------------------------------------------------------------------------------
  // The scenery: one stretch
  // ----------------------------------------------------------------------------------------

  private buildTile(): THREE.Group {
    const r = this.rand;
    const b = new Builder();
    const signs: THREE.BufferGeometry[] = [];
    const half = TILE / 2;
    // The land, the two carriageways, patches where the road has been mended
    b.box(0x8a7a5c, 300, 0.02, TILE, 0, -0.06, 0);
    b.box(0x2f3338, MEDIAN_A - OUR_KERB, 0.02, TILE, (MEDIAN_A + OUR_KERB) / 2, 0, 0);
    b.box(0x2f3338, THEIR_KERB - MEDIAN_B, 0.02, TILE, (THEIR_KERB + MEDIAN_B) / 2, 0, 0);
    for (let i = 0; i < 9; i++) {
      const x = OUR_KERB + 1 + r() * (THEIR_KERB - OUR_KERB - 2);
      if (x > MEDIAN_A - 0.6 && x < MEDIAN_B + 0.6) continue;
      b.box(r() < 0.5 ? 0x24272b : 0x3a3e44, 1 + r() * 2.5, 0.022, 2 + r() * 5, x, 0, -half + r() * TILE);
    }
    // Lines: dashes between the lanes, a solid edge by each kerb, yellow by the median
    for (let z = -half + 2; z < half; z += 9) {
      b.box(0xf1f5f9, 0.13, 0.01, 3, (LANES.kerb + LANES.inner) / 2, 0.021, z);
      b.box(0xf1f5f9, 0.13, 0.01, 3, (LANES.oncomingInner + LANES.oncomingKerb) / 2, 0.021, z);
    }
    b.box(0xf1f5f9, 0.14, 0.01, TILE, OUR_KERB + 0.3, 0.021, 0).box(0xf1f5f9, 0.14, 0.01, TILE, THEIR_KERB - 0.3, 0.021, 0);
    b.box(0xfacc15, 0.14, 0.01, TILE, MEDIAN_A - 0.25, 0.021, 0).box(0xfacc15, 0.14, 0.01, TILE, MEDIAN_B + 0.25, 0.021, 0);
    // A zebra crossing
    for (let x = OUR_KERB + 0.4; x < THEIR_KERB - 0.3; x += 0.9) if (x < MEDIAN_A || x > MEDIAN_B) b.box(0xf8fafc, 0.5, 0.012, 3.2, x, 0.021, -40);
    // The median: kerbs painted yellow and black, grass, lamps with an arm over each side, flowers
    b.box(0x5b8a3a, MEDIAN_B - MEDIAN_A - 0.2, 0.22, TILE, (MEDIAN_A + MEDIAN_B) / 2, 0, 0);
    for (let z = -half; z < half; z += 1) {
      const hex = Math.floor(z) % 2 ? 0xfacc15 : 0x111827;
      b.box(hex, 0.12, 0.24, 1, MEDIAN_A, 0, z + 0.5).box(hex, 0.12, 0.24, 1, MEDIAN_B, 0, z + 0.5);
    }
    const mid = (MEDIAN_A + MEDIAN_B) / 2;
    for (let z = -half + 10; z < half; z += 34) {
      b.cylinder(0x71717a, 0.11, 9.4, mid, 0.22, z);
      for (const side of [-1, 1]) {
        b.box(0x71717a, 2.6, 0.12, 0.12, mid + side * 1.3, 9.4, z);
        b.box(0xfff3c4, 0.6, 0.16, 0.34, mid + side * 2.5, 9.28, z, { glow: true });
      }
    }
    for (let z = -half + 27; z < half; z += 34) {
      b.cylinder(0x3f6212, 0.35, 0.5, mid, 0.22, z).dome(0x65a30d, 0.45, mid, 0.62, z).dome(0xdb2777, 0.18, mid + 0.2, 0.95, z + 0.1);
    }

    for (const side of [-1, 1] as const) {
      const kerb = side < 0 ? OUR_KERB : THEIR_KERB;
      const walkIn = kerb + side * WALK;
      // Kerb stones, the paving, the open drain behind it with a slab over it here and there
      for (let z = -half; z < half; z += 1.5) b.box(Math.floor(z / 1.5) % 2 ? 0xf8fafc : 0x1f2937, 0.22, 0.2, 1.5, kerb + side * 0.11, 0, z + 0.75);
      b.box(0xb8a48c, WALK - 0.22, 0.18, TILE, kerb + side * (0.22 + (WALK - 0.22) / 2), 0, 0);
      b.box(0x3b3f45, 0.7, 0.05, TILE, walkIn + side * 0.35, -0.04, 0);
      for (let z = -half + 4; z < half; z += 7 + Math.floor(r() * 9)) b.box(0x9ca3af, 0.9, 0.08, 1.8, walkIn + side * 0.35, 0.12, z);
      // Power poles and their wires
      const poleX = kerb + side * 0.7;
      for (let z = -half + 6; z < half; z += 32) {
        b.box(0x9ca3af, 0.24, 9.5, 0.24, poleX, 0.18, z);
        b.box(0x6b7280, 1.6, 0.1, 0.1, poleX, 8.9, z);
        b.box(0x374151, 0.22, 0.4, 0.22, poleX + side * 0.4, 8.4, z);
        for (const dx of [-0.65, 0, 0.65]) b.box(0x111111, 0.025, 0.025, 32, poleX + dx, 8.95 - Math.abs(dx) * 0.3, z + 16);
      }
      // What stands along it
      let z = -half;
      const front = walkIn + side * 0.9;
      while (z < half - 6) {
        const width = Math.min(half - z, 7 + r() * 10);
        const kind = r();
        const cz = z + width / 2;
        if (side < 0 && Math.abs(cz - 30) < 14) {
          // A filling station on our side: a canopy on columns over the pumps, the kiosk behind
          b.box(0x6b7280, 18, 0.03, 26, front + side * 9, 0.02, 30);
          b.box(0xf8fafc, 14, 0.7, 18, front + side * 9, 5, 30).box(0x16a34a, 14.1, 0.3, 18.1, front + side * 9, 5.1, 30);
          for (const dz of [-6, 6]) for (const dx of [-4, 4]) b.box(0xe5e7eb, 0.4, 5, 0.4, front + side * 9 + dx, 0, 30 + dz);
          for (const dz of [-5, 0, 5]) b.box(0xdc2626, 0.6, 1.5, 0.9, front + side * 9, 0, 30 + dz).box(0x111827, 0.62, 0.4, 0.5, front + side * 9, 1.0, 30 + dz);
          b.box(0xf5f5f4, 6, 3.4, 9, front + side * 17, 0, 30).box(0x0f172a, 0.05, 1.4, 6, front + side * 14, 1, 30);
          b.box(0x16a34a, 0.4, 7, 0.4, front + side * 0.8, 0, 41).box(0x16a34a, 0.3, 2, 3.4, front + side * 0.8, 7, 41);
          signs.push(signPlane(14, 3.2, 0.42, front + side * 0.8 - side * 0.17, 8, 41, side < 0 ? 1 : -1));
          z = 44;
          continue;
        }
        if (kind < 0.5) {
          // A row of shops: one or two floors, a shutter or a glass front, an awning, the sign over it
          const floors = 1 + Math.floor(r() * 2);
          const depth = 8 + r() * 6;
          const wall = WALLS[Math.floor(r() * WALLS.length)];
          b.box(wall, depth, floors * 3.3, width, front + (side * depth) / 2, 0, cz);
          const face = front - side * 0.03;
          b.box(r() < 0.5 ? 0x1f2937 : 0x64748b, 0.06, 2.4, width - 1.2, face, 0.1, cz);
          for (let y = 0.4; y < 2.4; y += 0.35) b.box(0x475569, 0.07, 0.04, width - 1.3, face, y, cz);
          const awning = AWNINGS[Math.floor(r() * AWNINGS.length)];
          b.box(awning, 1.6, 0.08, width - 0.4, front - side * 0.75, 2.7, cz, { roll: side * 0.25 });
          signs.push(signPlane(Math.floor(r() * (SHOPS.length - 1)), Math.min(width - 1, 7.5), 0.85, face - side * 0.04, 3.4, cz, side < 0 ? 1 : -1));
          if (floors > 1) {
            for (let w = 1.2; w < width - 1; w += 2.2) b.box(0x1e293b, 0.05, 1.2, 1.3, face, 4.3, z + w + 0.6);
          }
          b.box(0x57534e, depth + 0.4, 0.3, width + 0.3, front + (side * depth) / 2, floors * 3.3, cz);
          // Goods out front on the pavement
          if (r() < 0.5) b.box(0xf59e0b, 0.8, 0.6, 1.2, front - side * 1.2, 0.18, cz - 1).box(0x16a34a, 0.7, 0.4, 0.8, front - side * 1.2, 0.78, cz - 1);
        } else if (kind < 0.8) {
          // A block of flats: balconies with rails, windows, black water tanks on the roof
          const floors = 3 + Math.floor(r() * 3);
          const depth = 12 + r() * 8;
          const setback = 2 + r() * 3;
          const near = front + side * setback;
          const wall = WALLS[Math.floor(r() * WALLS.length)];
          b.box(wall, depth, floors * 3.1, width, near + (side * depth) / 2, 0, cz);
          for (let f = 0; f < floors; f++) {
            const y = f * 3.1;
            for (let w = 1.2; w < width - 1; w += 2.6) {
              b.box(r() < 0.15 ? 0xfde68a : 0x1e293b, 0.05, 1.3, 1.2, near - side * 0.03, y + 1.1, z + w + 0.6, { glow: false });
            }
            if (f > 0) {
              b.box(0xd6d3d1, 1.1, 0.12, width - 1, near - side * 0.55, y, cz);
              b.box(0x52525b, 0.05, 0.9, width - 1, near - side * 1.08, y + 0.12, cz);
            }
          }
          b.box(0x57534e, depth + 0.3, 0.6, width + 0.3, near + (side * depth) / 2, floors * 3.1, cz);
          for (let t = 0; t < 2; t++) b.cylinder(0x111111, 0.55, 1.2, near + side * (2 + t * 1.5), floors * 3.1 + 0.6, cz + (t - 0.5) * 2);
          // The fence and gate in front, with its wire on top
          b.box(0xe7e5e4, 0.25, 2.3, width, front + side * 0.6, 0.18, cz);
          b.box(0x1f2937, 0.27, 2.0, 2.6, front + side * 0.6, 0.18, cz);
          b.box(0x6b7280, 0.04, 0.3, width, front + side * 0.6, 2.5, cz);
          if (r() < 0.6) signs.push(signPlane(15, Math.min(width - 3.5, 4.5), 0.6, front + side * 0.6 - side * 0.14, 1.3, cz - width / 4 - 0.6, side < 0 ? 1 : -1));
        } else if (kind < 0.9) {
          // An office tower set back, glass and bands
          const floors = 8 + Math.floor(r() * 8);
          const depth = 16 + r() * 8;
          const near = front + side * (6 + r() * 6);
          b.box(r() < 0.5 ? 0x93c5fd : 0x94a3b8, depth, floors * 3.4, width + 2, near + (side * depth) / 2, 0, cz);
          for (let f = 1; f < floors; f += 1) b.box(0xe2e8f0, 0.08, 0.35, width + 2.04, near - side * 0.02, f * 3.4, cz);
          b.box(0x334155, depth - 2, 1.6, width, near + (side * depth) / 2, floors * 3.4, cz);
          b.box(0x6b7280, 6, 0.03, width, front + side * 3, 0.18, cz);
        } else {
          // Open ground behind a wall: hawkers' umbrellas and their tables in front of it
          b.box(0xd6d3d1, 0.3, 2.4, width, front + side * 1, 0.18, cz);
          b.box(0x7f1d1d, 0.32, 0.2, width, front + side * 1, 2.58, cz);
          for (let u = z + 2; u < z + width - 1; u += 3.4) {
            const colour = AWNINGS[Math.floor(r() * AWNINGS.length)];
            b.cylinder(0x3f3f46, 0.04, 2.2, front - side * 0.6, 0.18, u).cone(colour, 1.5, 0.6, front - side * 0.6, 2.2, u, 8);
            b.box(0x92400e, 1.0, 0.75, 0.8, front - side * 0.6, 0.18, u).box(r() < 0.5 ? 0xef4444 : 0xfacc15, 0.8, 0.2, 0.6, front - side * 0.6, 0.93, u);
          }
        }
        z += width + r() * 1.5;
      }
      // A bus stop on our side, with its sign
      if (side < 0) {
        const at = -70;
        b.box(0x1e3a8a, 1.8, 0.1, 6, kerb - 1.9, 2.6, at);
        for (const dz of [-2.6, 2.6]) b.box(0x9ca3af, 0.12, 2.6, 0.12, kerb - 2.6, 0.18, at + dz);
        b.box(0x6b7280, 0.6, 0.45, 5, kerb - 2.6, 0.18, at);
        b.cylinder(0x9ca3af, 0.05, 2.8, kerb - 0.6, 0.18, at + 4).box(0xfacc15, 0.05, 0.7, 1.2, kerb - 0.6, 2.4, at + 4);
      }
    }
    // A footbridge over the whole road
    {
      const at = 75;
      const deck = 6.2;
      const from = OUR_KERB - WALK + 1;
      const to = THEIR_KERB + WALK - 1;
      b.box(0x2563eb, to - from + 2, 0.35, 2.6, (from + to) / 2, deck, at);
      for (const dz of [-1.25, 1.25]) b.box(0x93c5fd, to - from + 2, 1.1, 0.08, (from + to) / 2, deck + 0.35, at + dz);
      for (const x of [from, to]) {
        b.box(0x1e3a8a, 2.4, deck, 3, x, 0, at);
        for (let s = 0; s < 8; s++) b.box(0x64748b, 2.2, 0.15, 0.6, x, s * 0.8, at - 1.8 - s * 0.55);
      }
      b.box(0x1e3a8a, 0.6, deck, 0.6, mid, 0.22, at);
    }
    // Palms here and there behind the pavements
    for (let i = 0; i < 10; i++) {
      const side = i % 2 ? 1 : -1;
      const x = (side < 0 ? OUR_KERB : THEIR_KERB) + side * (WALK - 0.4);
      const z = -half + 8 + r() * (TILE - 16);
      if (side < 0 && Math.abs(z - 30) < 16) continue;
      b.cylinder(0x78716c, 0.16, 6.5, x, 0.18, z, { topRadius: 0.12 });
      for (let f = 0; f < 6; f++) {
        const a = (f / 6) * Math.PI * 2;
        b.box(0x3f7d20, 0.35, 0.06, 2.4, x + Math.sin(a) * 1.0, 6.4, z + Math.cos(a) * 1.0, { yaw: a, pitch: 0.35 });
      }
    }
    const tile = b.build('ride street', { roughness: 0.82 });
    tile.traverse((child) => {
      const mesh = child as THREE.Mesh;
      if (mesh.isMesh) mesh.receiveShadow = true;
    });
    // All the shop signs, as one
    const signGeo = mergeGeometries(signs.map((g) => (g.index ? g.toNonIndexed() : g)));
    tile.add(new THREE.Mesh(signGeo, new THREE.MeshBasicMaterial({ map: signAtlas(), toneMapped: false })));
    // Two billboards, and people waiting at the bus stop and walking by
    for (const [i, z] of [[0, -20], [1, 55]] as Array<[number, number]>) {
      const [title, line, bg] = BILLBOARDS[i * 2 + Math.floor(r() * 2)];
      const side = i ? 1 : -1;
      const x = (side < 0 ? OUR_KERB - WALK - 7 : THEIR_KERB + WALK + 7);
      const board = billboard(title, line, bg);
      board.position.set(x, 10, z);
      board.rotation.y = side < 0 ? Math.PI / 2 : -Math.PI / 2;
      tile.add(board);
      tile.add(new Builder().box(0x374151, 0.4, 8, 0.4, x, 0, z - 3.5).box(0x374151, 0.4, 8, 0.4, x, 0, z + 3.5).build('billboard posts'));
    }
    tile.add(this.people());
    return tile;
  }

  /** People on the pavements: baked to one mesh each, as the city's crowd is */
  private people(): THREE.Group {
    const group = new THREE.Group();
    const material = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.7 });
    const geos = LOOKS.map((look) => {
      const rig = HumanMeshBuilder.createHuman({ username: '', lod: 'street', ...look } as HumanConfig);
      rig.nameTag.visible = false;
      const geo = bakeToGeometry(rig.group);
      // Seen from a moving vehicle: a lighter copy is enough
      return geo ? simplifyByClustering(geo, 0.035) : null;
    });
    const spots: Array<[number, number, number]> = [
      [OUR_KERB - 2.0, -71.5, 0.4], [OUR_KERB - 1.4, -69.6, -0.6], [OUR_KERB - 2.4, -67.8, 1.2], [OUR_KERB - 1.2, -66, 0.2],
      [OUR_KERB - 2.8, -10, 0], [OUR_KERB - 1.6, 12, Math.PI], [OUR_KERB - 3.0, 64, 0], [OUR_KERB - 1.8, 96, Math.PI],
      [THEIR_KERB + 2.0, -50, Math.PI], [THEIR_KERB + 1.5, 4, 0], [THEIR_KERB + 2.6, 40, Math.PI], [THEIR_KERB + 1.8, 88, 0],
    ];
    // All of them as one mesh
    const placed: THREE.BufferGeometry[] = [];
    const matrix = new THREE.Matrix4();
    spots.forEach(([x, z, yaw], i) => {
      const geo = geos[i % geos.length];
      if (!geo) return;
      matrix.makeRotationY(yaw + (Math.PI / 2) * (x < 0 ? 1 : -1) * (i % 3 === 0 ? 1 : 0)).setPosition(x, 0.18, z);
      placed.push(geo.clone().applyMatrix4(matrix));
    });
    if (placed.length) {
      const mesh = new THREE.Mesh(mergeGeometries(placed), material);
      mesh.castShadow = true;
      group.add(mesh);
    }
    return group;
  }

  // ----------------------------------------------------------------------------------------
  // The traffic
  // ----------------------------------------------------------------------------------------

  private buildTraffic(): void {
    const r = this.rand;
    const vehicleMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.35, metalness: 0.3 });
    const bake = (group: THREE.Object3D): { geo: THREE.BufferGeometry; length: number } | null => {
      const geo = bakeToGeometry(group);
      if (!geo) return null;
      return { geo, length: geo.boundingBox!.max.z - geo.boundingBox!.min.z };
    };
    const cars = ['corolla_2008', 'corolla_2020', 'camry', 'accord', 'sedan', 'lexus_rx', 'highlander', 'suv', 'range_rover', 'gwagon', 'bmw_7', 'camry'];
    const made: Array<{ geo: THREE.BufferGeometry; length: number } | null> = [];
    cars.forEach((id) => made.push(bake(buildKitCar(id, PAINTS[Math.floor(r() * PAINTS.length)], { light: true }).group)));
    for (let i = 0; i < 2; i++) made.push(bake(buildKitCar('corolla_2008', undefined, { taxi: true, light: true }).group));
    const danfo = new DrivableVehicle({ id: 'ride-danfo', name: 'Danfo', type: 'danfo', maxSpeed: 1, reverseSpeed: 1, acceleration: 1, braking: 1, turnSpeed: 1, friction: 1, hornText: '' }, new THREE.Vector3());
    const danfoGeo = bake(danfo.mesh);
    const keke = bake(buildRideKeke().body);
    const okada = bake(buildRideOkada().body);
    const pool = made.filter(Boolean) as Array<{ geo: THREE.BufferGeometry; length: number }>;

    const add = (shape: { geo: THREE.BufferGeometry; length: number } | null, x: number, z: number, oncoming: boolean) => {
      if (!shape) return;
      const mesh = new THREE.Mesh(shape.geo, vehicleMat);
      mesh.castShadow = true;
      if (oncoming) mesh.rotation.y = Math.PI;
      this.trafficGroup.add(mesh);
      this.traffic.push({ mesh, x, z, length: shape.length, speed: oncoming ? 7 + r() * 7 : 0, oncoming, temper: 0.85 + r() * 0.35 });
    };
    // Our side: danfos, kekes and okadas mostly by the kerb, cars in both lanes
    for (let i = 0; i < 7; i++) {
      const z = -55 + i * 32 + r() * 8;
      const pick = r();
      add(pick < 0.3 ? danfoGeo : pick < 0.5 ? keke : pick < 0.62 ? okada : pool[Math.floor(r() * pool.length)], LANES.kerb, z, false);
      add(pool[Math.floor(r() * pool.length)], LANES.inner, z + 14 + r() * 6, false);
    }
    // Coming the other way
    for (let i = 0; i < 7; i++) {
      const z = -80 + i * 46 + r() * 10;
      const pick = r();
      add(pick < 0.25 ? danfoGeo : pick < 0.4 ? okada : pool[Math.floor(r() * pool.length)], LANES.oncomingKerb, z, true);
      add(pool[Math.floor(r() * pool.length)], LANES.oncomingInner, z + 20, true);
    }
  }
}
