import * as THREE from 'three';
import { MaterialLibrary } from '../../materials/MaterialLibrary';
import { seededRandom } from '../../graphics/MeshBaker';
import { MAIN_ROAD, MAIN_CORRIDOR_HALF, SIDE_STREETS, CROSS_STREET_Z, type SideStreet } from './StreetLayout';

// Occupancy bit flags
const OBSTACLE = 1; // hand-built buildings, districts, props
const NO_BUILD = 2; // paved district ground, reserved forecourts
const ROAD = 4; // asphalt + sidewalks
const LOT = 8; // generated building lots
const ANY = OBSTACLE | NO_BUILD | ROAD | LOT;

const WORLD_HALF = 160;
const GRID = WORLD_HALF * 2;
const LOT_GAP = 0.9;

/** Open ground kept clear of generated buildings (airport apron, stadium forecourt) */
const RESERVED: Array<[number, number, number, number]> = [
  [-114, -60, -136, -96],
  [-78, -38, -6, 22],
];

export interface WalkRun {
  axis: 'x' | 'z';
  /** Coordinate of the sidewalk centre line on the other axis */
  fixed: number;
  from: number;
  to: number;
}

export interface StreetSpot {
  x: number;
  z: number;
  yaw: number;
}

interface Inst {
  m: THREE.Matrix4;
  c?: THREE.Color;
}

interface Lot {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  /** Unit vector from the building towards the street it faces */
  front?: { dx: number; dz: number };
}

type FacadeKind = 'tenement' | 'commercial' | 'tower';

interface Archetype {
  kind: FacadeKind;
  floors: number;
  bays: number;
  floorHeight: number;
  items: Inst[];
}

const SHOP_NAMES = [
  'MAMA NKECHI PROVISIONS', "GOD'S TIME PHARMACY", 'CHINEDU PHONES', 'IYA BASIRA CANTEEN',
  'BLESSED HANDS TAILORING', 'DE-KING BARBING SALON', 'ALHAJI MUSA SUYA SPOT', 'EMEKA ELECTRONICS',
  'FAVOUR COSMETICS', 'OLUWASEUN BOUTIQUE', 'POS · TRANSFER · CASH', 'CHOICE BAKERY',
  'TRUST CHEMIST', 'ADE & SONS CEMENT', 'NGOZI HAIR PALACE', 'LAGOS CYBER CAFE',
  'SHARP SHARP LAUNDRY', 'UNCLE BEN STORES', 'GLORY UNISEX SALON', "BUKKY'S KITCHEN",
  'OGA TUNDE SPARE PARTS', 'DIVINE FAVOUR MART', 'KEMI FABRICS & LACE', 'ROYAL SHAWARMA',
  'PEACE COLD ROOM', 'HIS GRACE FURNITURE', 'AMAKA FASHION HOME', 'PRECIOUS PRINTING PRESS',
  'IBRO GADGETS', 'BIG BITE FAST FOOD', 'SURE WIN BET CENTRE', 'ISLAND RECHARGE CARDS',
];
const SIGN_COLS = 4;
const SIGN_ROWS = 8;

/**
 * CityFabric
 * Generates the dense Lagos Island urban fabric around the hand-built Broad Street set:
 * side streets, hundreds of tenements / plazas / towers, shopfronts and street stalls.
 * Everything is placed against an occupancy grid of the existing world and drawn with
 * InstancedMesh, so the whole fabric costs a few dozen draw calls.
 */
export class CityFabric {
  public group = new THREE.Group();
  public walkRuns: WalkRun[] = [];
  public parkingSpots: StreetSpot[] = [];
  public stallSpots: StreetSpot[] = [];
  public buildingCount = 0;

  private occ = new Uint8Array(GRID * GRID);
  private rand = seededRandom(20261008);
  private lots: Lot[] = [];

  private asphalt: Inst[] = [];
  private sidewalks: Inst[] = [];
  private paint: Inst[] = [];
  private pads: Inst[] = [];
  private boxes: Inst[] = [];
  private cylinders: Inst[] = [];
  private hipRoofs: Inst[] = [];
  private umbrellas: Inst[] = [];
  private signs: Array<Inst & { atlas: number }> = [];

  private archetypes: Archetype[] = [
    { kind: 'tenement', floors: 2, bays: 4, floorHeight: 3.2, items: [] },
    { kind: 'tenement', floors: 3, bays: 4, floorHeight: 3.2, items: [] },
    { kind: 'tenement', floors: 4, bays: 4, floorHeight: 3.2, items: [] },
    { kind: 'commercial', floors: 3, bays: 5, floorHeight: 3.4, items: [] },
    { kind: 'commercial', floors: 5, bays: 5, floorHeight: 3.4, items: [] },
    { kind: 'commercial', floors: 7, bays: 5, floorHeight: 3.4, items: [] },
    { kind: 'tower', floors: 9, bays: 6, floorHeight: 3.6, items: [] },
    { kind: 'tower', floors: 13, bays: 6, floorHeight: 3.6, items: [] },
    { kind: 'tower', floors: 18, bays: 6, floorHeight: 3.6, items: [] },
  ];

  constructor(obstacles: THREE.Object3D[]) {
    this.scanObstacles(obstacles);
    for (const [minX, maxX, minZ, maxZ] of RESERVED) this.mark(minX, maxX, minZ, maxZ, NO_BUILD);
    this.mark(-MAIN_CORRIDOR_HALF, MAIN_CORRIDOR_HALF, MAIN_ROAD.zMin - 2, MAIN_ROAD.zMax + 2, ROAD);

    for (let i = 0; i < SIDE_STREETS.length; i++) this.layStreet(SIDE_STREETS[i], i);
    this.paintJunction();

    this.plotStreetFrontages();
    this.plotInfill();
    for (const lot of this.lots) this.raiseBuilding(lot);
    this.buildingCount = this.lots.length;

    this.commit();
  }

  // =========================================================================
  // OCCUPANCY GRID
  // =========================================================================
  private cell(v: number): number {
    return Math.max(0, Math.min(GRID - 1, Math.floor(v + WORLD_HALF)));
  }

  private mark(minX: number, maxX: number, minZ: number, maxZ: number, bit: number): void {
    const x0 = this.cell(minX), x1 = this.cell(Math.ceil(maxX) - 0.001);
    const z0 = this.cell(minZ), z1 = this.cell(Math.ceil(maxZ) - 0.001);
    for (let z = z0; z <= z1; z++) {
      for (let x = x0; x <= x1; x++) this.occ[z * GRID + x] |= bit;
    }
  }

  private hit(minX: number, maxX: number, minZ: number, maxZ: number, mask: number): boolean {
    if (minX < -WORLD_HALF || maxX > WORLD_HALF || minZ < -WORLD_HALF || maxZ > WORLD_HALF) return true;
    const x0 = this.cell(minX), x1 = this.cell(Math.ceil(maxX) - 0.001);
    const z0 = this.cell(minZ), z1 = this.cell(Math.ceil(maxZ) - 0.001);
    for (let z = z0; z <= z1; z++) {
      for (let x = x0; x <= x1; x++) {
        if (this.occ[z * GRID + x] & mask) return true;
      }
    }
    return false;
  }

  private scanObstacles(roots: THREE.Object3D[]): void {
    const box = new THREE.Box3();
    for (const root of roots) {
      root.updateWorldMatrix(true, true);
      root.traverse((obj) => {
        const mesh = obj as THREE.Mesh;
        if (!mesh.isMesh || !mesh.geometry) return;
        if (!mesh.geometry.boundingBox) mesh.geometry.computeBoundingBox();
        box.copy(mesh.geometry.boundingBox!).applyMatrix4(mesh.matrixWorld);

        const sx = box.max.x - box.min.x;
        const sz = box.max.z - box.min.z;
        if (box.max.y < 0) return; // buried below the terrain

        if (box.max.y < 0.45) {
          if (sx * sz >= 16 && sx < 200 && sz < 260) this.mark(box.min.x, box.max.x, box.min.z, box.max.z, NO_BUILD);
        } else if (sx < 120 && sz < 120) {
          this.mark(box.min.x - 0.5, box.max.x + 0.5, box.min.z - 0.5, box.max.z + 0.5, OBSTACLE);
        }
      });
    }
  }

  // =========================================================================
  // SIDE STREETS
  // =========================================================================
  private inMainCorridor(x: number, z: number): boolean {
    return Math.abs(x) < MAIN_CORRIDOR_HALF && z > MAIN_ROAD.zMin - 9 && z < MAIN_ROAD.zMax + 1;
  }

  private inOtherRoad(x: number, z: number, self: SideStreet): boolean {
    for (const st of SIDE_STREETS) {
      if (st === self) continue;
      const along = st.axis === 'x' ? x : z;
      const across = st.axis === 'x' ? z : x;
      if (along >= st.from && along <= st.to && Math.abs(across - st.fixed) <= st.halfRoad) return true;
    }
    return false;
  }

  private layStreet(st: SideStreet, index: number): void {
    const STEP = 2;
    const roadY = 0.012 + index * 0.002;
    const runs: Array<WalkRun | null> = [null, null];
    const isX = st.axis === 'x';

    for (let s = st.from; s < st.to; s += STEP) {
      const mid = s + STEP / 2;
      const cx = isX ? mid : st.fixed;
      const cz = isX ? st.fixed : mid;
      const inMain = this.inMainCorridor(cx, cz);

      const rMinX = isX ? s : st.fixed - st.halfRoad;
      const rMaxX = isX ? s + STEP : st.fixed + st.halfRoad;
      const rMinZ = isX ? st.fixed - st.halfRoad : s;
      const rMaxZ = isX ? st.fixed + st.halfRoad : s + STEP;

      const blocked = !inMain && this.hit(rMinX, rMaxX, rMinZ, rMaxZ, OBSTACLE);
      if (blocked) {
        runs[0] = runs[1] = null;
        continue;
      }

      this.asphalt.push({
        m: this.mat(cx, roadY, cz, isX ? STEP : st.halfRoad * 2, 1, isX ? st.halfRoad * 2 : STEP),
      });
      this.mark(rMinX, rMaxX, rMinZ, rMaxZ, ROAD);

      // Dashed centre line on streets that carry traffic
      if (st.traffic && !inMain && Math.round(s / STEP) % 3 === 0) {
        this.paint.push({ m: this.mat(cx, roadY + 0.012, cz, isX ? 2.6 : 0.18, 1, isX ? 0.18 : 2.6) });
      }

      for (let side = 0; side < 2; side++) {
        const sign = side === 0 ? -1 : 1;
        const lateral = st.fixed + sign * (st.halfRoad + st.walk / 2);
        const wx = isX ? mid : lateral;
        const wz = isX ? lateral : mid;
        const wMinX = isX ? s : lateral - st.walk / 2;
        const wMaxX = isX ? s + STEP : lateral + st.walk / 2;
        const wMinZ = isX ? lateral - st.walk / 2 : s;
        const wMaxZ = isX ? lateral + st.walk / 2 : s + STEP;

        const skip =
          inMain ||
          this.inOtherRoad(wx, wz, st) ||
          this.hit(wMinX, wMaxX, wMinZ, wMaxZ, OBSTACLE);
        if (skip) {
          runs[side] = null;
          continue;
        }

        this.sidewalks.push({
          m: this.mat(wx, 0, wz, isX ? STEP : st.walk, MAIN_ROAD.sidewalkTop, isX ? st.walk : STEP),
        });
        this.mark(wMinX, wMaxX, wMinZ, wMaxZ, ROAD);

        let run = runs[side];
        if (!run) {
          run = { axis: st.axis, fixed: lateral, from: s, to: s + STEP };
          runs[side] = run;
          this.walkRuns.push(run);
        } else {
          run.to = s + STEP;
        }

        // Kerbside parking on the quiet streets
        if (!st.traffic && Math.round(s / STEP) % 3 === 0 && this.rand() < 0.62 && !this.inOtherRoad(cx, cz, st)) {
          const parkLateral = st.fixed + sign * (st.halfRoad - 1.2);
          this.parkingSpots.push({
            x: isX ? mid : parkLateral,
            z: isX ? parkLateral : mid,
            yaw: isX ? (sign > 0 ? Math.PI / 2 : -Math.PI / 2) : sign > 0 ? Math.PI : 0,
          });
        }

        // Roadside umbrella stalls & street lamps along the building edge of the sidewalk
        const tick = Math.round(s / STEP);
        const edge = st.fixed + sign * (st.halfRoad + st.walk - 0.55);
        const px = isX ? mid : edge;
        const pz = isX ? edge : mid;
        if (tick % 12 === (side === 0 ? 0 : 6)) {
          this.addStreetLamp(px, pz, isX, -sign);
        } else if (tick % 4 === 1 && this.rand() < 0.5) {
          this.addUmbrellaStall(px, pz, isX ? (sign > 0 ? Math.PI : 0) : sign > 0 ? -Math.PI / 2 : Math.PI / 2);
        }
      }
    }
  }

  private addStreetLamp(x: number, z: number, alongX: boolean, towardRoad: number): void {
    const steel = new THREE.Color(0x6b7280);
    this.cylinders.push({ m: this.mat(x, 0, z, 0.16, 6.4, 0.16), c: steel });
    const reach = 1.5;
    const ax = alongX ? x : x + (towardRoad * reach) / 2;
    const az = alongX ? z + (towardRoad * reach) / 2 : z;
    this.boxes.push({ m: this.mat(ax, 6.3, az, alongX ? 0.12 : reach, 0.1, alongX ? reach : 0.12), c: steel });
    const hx = alongX ? x : x + towardRoad * reach;
    const hz = alongX ? z + towardRoad * reach : z;
    this.boxes.push({ m: this.mat(hx, 6.16, hz, 0.42, 0.14, 0.42), c: new THREE.Color(0xfff3c4) });
  }

  private addUmbrellaStall(x: number, z: number, yaw: number): void {
    const canopy = [0xdc2626, 0x16a34a, 0xfacc15, 0x2563eb, 0xf97316, 0xffffff, 0xdb2777];
    this.cylinders.push({ m: this.mat(x, 0, z, 0.07, 2.3, 0.07), c: new THREE.Color(0x4b5563) });
    this.umbrellas.push({
      m: this.mat(x, 2.1, z, 1.25, 0.55, 1.25, this.rand() * Math.PI),
      c: new THREE.Color(this.pick(canopy)),
    });
    // Wooden table stacked with goods
    this.boxes.push({ m: this.mat(x, 0.28, z, 1.3, 0.7, 0.8, yaw), c: new THREE.Color(0x8b5a2b) });
    const goods = [0xf59e0b, 0xef4444, 0x22c55e, 0xfde047, 0xf8fafc];
    this.boxes.push({ m: this.mat(x, 0.98, z, 1.05, 0.22, 0.6, yaw), c: new THREE.Color(this.pick(goods)) });
    this.stallSpots.push({ x, z, yaw });
  }

  /** Zebra crossings on all four arms of the Broad Street / Martins Street junction */
  private paintJunction(): void {
    const cross = SIDE_STREETS[0];
    for (const dz of [-(cross.halfRoad + 2.4), cross.halfRoad + 2.4]) {
      for (let x = -6; x <= 6.01; x += 1.2) {
        this.paint.push({ m: this.mat(x, 0.026, CROSS_STREET_Z + dz, 0.65, 1, 3.2) });
      }
    }
    for (const sx of [-1, 1]) {
      for (let z = CROSS_STREET_Z - 3.6; z <= CROSS_STREET_Z + 3.61; z += 1.2) {
        this.paint.push({ m: this.mat(sx * 10.4, 0.03, z, 4.6, 1, 0.65) });
      }
    }
  }

  // =========================================================================
  // LOT PLOTTING
  // =========================================================================
  private insideCity(cx: number, cz: number): boolean {
    const r = Math.pow(cx / 130, 4) + Math.pow((cz + 12) / 138, 4);
    if (r >= 1) return false;
    // Feather the outskirts so the city edge is ragged, not a hard rectangle
    return !(r > 0.7 && this.rand() < (r - 0.7) * 1.4);
  }

  private tryPlace(minX: number, maxX: number, minZ: number, maxZ: number, front?: Lot['front']): boolean {
    if (this.hit(minX - LOT_GAP, maxX + LOT_GAP, minZ - LOT_GAP, maxZ + LOT_GAP, ANY)) return false;
    if (!this.insideCity((minX + maxX) / 2, (minZ + maxZ) / 2)) return false;
    this.mark(minX, maxX, minZ, maxZ, LOT);
    this.lots.push({ minX, maxX, minZ, maxZ, front });
    return true;
  }

  /** March along one side of a street, packing building frontages edge to edge */
  private plotFrontage(axis: 'x' | 'z', fixed: number, sign: number, edgeOffset: number, from: number, to: number): void {
    const frontEdge = fixed + sign * (edgeOffset + LOT_GAP + 1.1);
    const front = axis === 'x' ? { dx: 0, dz: -sign } : { dx: -sign, dz: 0 };

    let s = from;
    while (s < to) {
      let placed = 0;
      for (const width of [9 + this.rand() * 6, 7, 5]) {
        const depth = width < 6 ? 6 : 11 + this.rand() * 6;
        const a = Math.min(frontEdge, frontEdge + sign * depth);
        const b = Math.max(frontEdge, frontEdge + sign * depth);
        const ok =
          axis === 'x'
            ? this.tryPlace(s, s + width, a, b, front)
            : this.tryPlace(a, b, s, s + width, front);
        if (ok) {
          placed = width;
          break;
        }
      }
      s += placed > 0 ? placed + LOT_GAP + 1 : 1;
    }
  }

  private plotStreetFrontages(): void {
    for (const sign of [-1, 1]) {
      this.plotFrontage('z', 0, sign, MAIN_CORRIDOR_HALF, -134, MAIN_ROAD.zMax + 4);
    }
    for (const st of SIDE_STREETS) {
      for (const sign of [-1, 1]) {
        this.plotFrontage(st.axis, st.fixed, sign, st.halfRoad + st.walk, st.from, st.to);
      }
    }
  }

  private plotInfill(): void {
    // Pass 1 lays full-size plots; pass 2 squeezes small houses into the leftover gaps,
    // which is exactly how Lagos Island backstreets fill up.
    for (const [minSize, spread] of [[10, 8], [6, 3.5]]) {
      for (let z = -150; z < 126; z += 2) {
        for (let x = -134; x < 134; x += 2) {
          if (this.occ[this.cell(z) * GRID + this.cell(x)] & ANY) continue;
          const w = minSize + this.rand() * spread;
          const d = minSize + this.rand() * spread;
          this.tryPlace(x, x + w, z, z + d);
        }
      }
    }
  }

  // =========================================================================
  // BUILDINGS
  // =========================================================================
  private pick<T>(list: T[]): T {
    return list[Math.floor(this.rand() * list.length)];
  }

  private chooseArchetype(lot: Lot): Archetype {
    const w = lot.maxX - lot.minX;
    const d = lot.maxZ - lot.minZ;
    const ax = Math.abs((lot.minX + lot.maxX) / 2);
    const r = this.rand();

    let kind: FacadeKind;
    if (Math.min(w, d) < 9.6) kind = 'tenement';
    else if (lot.front) kind = r < 0.55 ? 'tenement' : r < 0.93 ? 'commercial' : 'tower';
    else if (ax < 42) kind = r < 0.55 ? 'tenement' : r < 0.86 ? 'commercial' : 'tower';
    else if (ax < 96) kind = r < 0.34 ? 'tenement' : r < 0.68 ? 'commercial' : 'tower';
    else kind = r < 0.58 ? 'tenement' : r < 0.9 ? 'commercial' : 'tower';

    const options = this.archetypes.filter((a) => a.kind === kind);
    if (Math.min(w, d) < 8) return options[this.rand() < 0.6 ? 0 : 1];
    return this.pick(options);
  }

  private raiseBuilding(lot: Lot): void {
    const arch = this.chooseArchetype(lot);
    const inset = 0.3;
    let minX = lot.minX + inset, maxX = lot.maxX - inset;
    let minZ = lot.minZ + inset, maxZ = lot.maxZ - inset;

    // Towers stand on a compact plinth in the middle of their lot
    if (arch.kind === 'tower' && !lot.front) {
      const side = Math.min(maxX - minX, maxZ - minZ, 15);
      const cx0 = (minX + maxX) / 2, cz0 = (minZ + maxZ) / 2;
      minX = cx0 - side / 2; maxX = cx0 + side / 2;
      minZ = cz0 - side / 2; maxZ = cz0 + side / 2;
    }

    const w = maxX - minX, d = maxZ - minZ;
    const cx = (minX + maxX) / 2, cz = (minZ + maxZ) / 2;
    const h = arch.floors * arch.floorHeight;

    const palettes: Record<FacadeKind, number[]> = {
      tenement: [0xf3e2b3, 0xe9c46a, 0xd98b5f, 0xbfd8d2, 0xf1f1ec, 0xe8b7b0, 0xc9d6a3, 0xd9cdb8, 0x9fc2e0],
      commercial: [0xf5f5f0, 0xe2e8f0, 0xfde68a, 0xcbd5e1, 0xf0d9c0, 0xb7d3c6],
      tower: [0x7fb2e0, 0x5b9bd5, 0x8fd0c8, 0xb8c4d0, 0xc9a878, 0x6c8fb5],
    };
    const wall = new THREE.Color(this.pick(palettes[arch.kind])).multiplyScalar(0.84 + this.rand() * 0.16);
    arch.items.push({ m: this.mat(cx, 0, cz, w, h, d), c: wall });

    // Paved yard under and around the building so no lawn shows between plots
    const ground = [0x9a9186, 0xa08468, 0x8f8a80, 0xa39a8c];
    this.pads.push({
      m: this.mat((lot.minX + lot.maxX) / 2, 0.02, (lot.minZ + lot.maxZ) / 2, lot.maxX - lot.minX + 3, 1, lot.maxZ - lot.minZ + 3),
      c: new THREE.Color(this.pick(ground)),
    });

    // --- Roofscape ---
    if (arch.kind === 'tenement' && this.rand() < 0.72) {
      const roofs = [0x8a4b2f, 0x9a5a3a, 0x77777a, 0xa33b2b, 0x6b4a3a, 0x8c8f93];
      this.hipRoofs.push({
        m: this.mat(cx, h, cz, w + 1.0, 1.5 + this.rand() * 1.1, d + 1.0),
        c: new THREE.Color(this.pick(roofs)),
      });
    } else {
      this.boxes.push({ m: this.mat(cx, h, cz, w + 0.25, 0.55, d + 0.25), c: wall.clone().multiplyScalar(0.72) });
      const tanks = [0x111827, 0x111827, 0x1d4ed8, 0x166534];
      const tankCount = arch.kind === 'tower' ? 0 : 1 + Math.floor(this.rand() * 2);
      for (let i = 0; i < tankCount; i++) {
        this.cylinders.push({
          m: this.mat(cx + (this.rand() - 0.5) * w * 0.5, h + 0.55, cz + (this.rand() - 0.5) * d * 0.5, 1.5, 1.7, 1.5),
          c: new THREE.Color(this.pick(tanks)),
        });
      }
      if (arch.kind === 'tower') {
        this.boxes.push({
          m: this.mat(cx + w * 0.12, h + 0.55, cz - d * 0.1, w * 0.36, 2.8, d * 0.36),
          c: wall.clone().multiplyScalar(0.6),
        });
        if (this.rand() < 0.5) {
          this.cylinders.push({ m: this.mat(cx - w * 0.2, h + 0.55, cz + d * 0.2, 0.12, 7, 0.12), c: new THREE.Color(0xdc2626) });
        }
      }
    }

    if (lot.front) this.dressFrontage(lot.front, arch, minX, maxX, minZ, maxZ, h);
  }

  /** Ground-floor shop, awning, named signboard, balconies and AC units on the street face */
  private dressFrontage(
    front: { dx: number; dz: number },
    arch: Archetype,
    minX: number, maxX: number, minZ: number, maxZ: number,
    h: number
  ): void {
    const alongX = front.dz !== 0; // frontage runs along X when the building faces ±Z
    const length = alongX ? maxX - minX : maxZ - minZ;
    const mid = alongX ? (minX + maxX) / 2 : (minZ + maxZ) / 2;
    const face = alongX ? (front.dz > 0 ? maxZ : minZ) : front.dx > 0 ? maxX : minX;
    const out = alongX ? front.dz : front.dx;
    const yaw = Math.atan2(front.dx, front.dz);

    // Places a box centred `offset` metres out from the facade
    const slab = (offset: number, y: number, len: number, height: number, depth: number, along: number, c: THREE.Color) => {
      const p = face + out * offset;
      this.boxes.push({
        m: alongX
          ? this.mat(mid + along, y, p, len, height, depth)
          : this.mat(p, y, mid + along, depth, height, len),
        c,
      });
    };

    // Open shopfront / roller shutter
    const shutters = [0x1f2937, 0x1f2937, 0x111827, 0x1d4ed8, 0x166534, 0x6b7280];
    slab(0.04, 0.05, length * 0.82, 2.45, 0.1, 0, new THREE.Color(this.pick(shutters)));

    if (arch.kind !== 'tower') {
      const awnings = [0xdc2626, 0x15803d, 0x1d4ed8, 0xf59e0b, 0x7c3aed, 0x0f766e, 0xe11d48, 0xf8fafc];
      slab(0.8, 2.75, length - 0.5, 0.1, 1.6, 0, new THREE.Color(this.pick(awnings)));

      const signWidth = Math.min(length - 0.8, 7.5);
      if (signWidth > 3.2) {
        const p = face + out * 0.14;
        this.signs.push({
          m: alongX ? this.mat(mid, 3.45, p, signWidth, 1.05, 1, yaw) : this.mat(p, 3.45, mid, signWidth, 1.05, 1, yaw),
          atlas: Math.floor(this.rand() * SHOP_NAMES.length),
        });
      }
    }

    if (arch.kind === 'tenement') {
      const rail = new THREE.Color(0x374151);
      const deck = new THREE.Color(0xd6d3d1);
      for (let f = 1; f < arch.floors; f++) {
        const y = f * arch.floorHeight + 0.5;
        slab(0.55, y, length * 0.84, 0.12, 1.1, 0, deck);
        slab(1.05, y + 0.12, length * 0.84, 0.85, 0.06, 0, rail);
      }
    }

    // Split-unit AC compressors hung on the facade
    const acCount = Math.floor(this.rand() * 3);
    for (let i = 0; i < acCount && h > 6; i++) {
      const floor = 1 + Math.floor(this.rand() * (arch.floors - 1));
      slab(0.22, floor * arch.floorHeight + 1.9, 0.85, 0.6, 0.4, (this.rand() - 0.5) * length * 0.7, new THREE.Color(0xe5e7eb));
    }
  }

  // =========================================================================
  // INSTANCED MESH ASSEMBLY
  // =========================================================================
  private mat(px: number, py: number, pz: number, sx: number, sy: number, sz: number, yaw: number = 0): THREE.Matrix4 {
    const m = new THREE.Matrix4();
    if (yaw !== 0) m.makeRotationY(yaw);
    m.scale(new THREE.Vector3(sx, sy, sz));
    m.setPosition(px, py, pz);
    return m;
  }

  private instanced(
    geo: THREE.BufferGeometry,
    material: THREE.Material,
    items: Inst[],
    cast: boolean,
    receive: boolean
  ): THREE.InstancedMesh | null {
    if (items.length === 0) return null;
    const mesh = new THREE.InstancedMesh(geo, material, items.length);
    for (let i = 0; i < items.length; i++) {
      mesh.setMatrixAt(i, items[i].m);
      if (items[i].c) mesh.setColorAt(i, items[i].c!);
    }
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.castShadow = cast;
    mesh.receiveShadow = receive;
    mesh.computeBoundingSphere();
    this.group.add(mesh);
    return mesh;
  }

  private commit(): void {
    const lib = MaterialLibrary.getInstance();

    // Unit primitives (origin at the base centre) scaled per instance
    const unitBox = new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0);
    const unitPlane = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
    const unitCylinder = new THREE.CylinderGeometry(0.5, 0.5, 1, 10).translate(0, 0.5, 0);
    const unitHip = new THREE.ConeGeometry(Math.SQRT1_2, 1, 4, 1).rotateY(Math.PI / 4).translate(0, 0.5, 0);
    const unitUmbrella = new THREE.ConeGeometry(1, 1, 8, 1).translate(0, 0.5, 0);

    // --- Streets ---
    const asphaltMat = new THREE.MeshStandardMaterial({ color: 0x3b3f47, roughness: 0.94 });
    this.instanced(unitPlane, asphaltMat, this.asphalt, false, true);

    const paverMap = lib.sidewalkMaterial.map ? lib.sidewalkMaterial.map.clone() : null;
    if (paverMap) {
      paverMap.repeat.set(1, 1);
      paverMap.needsUpdate = true;
    }
    const sidewalkMat = new THREE.MeshStandardMaterial({ map: paverMap, color: paverMap ? 0xffffff : 0xb9ad9c, roughness: 0.95 });
    this.instanced(unitBox, sidewalkMat, this.sidewalks, false, true);

    const paintMat = new THREE.MeshStandardMaterial({ color: 0xf1f5f9, roughness: 0.8 });
    this.instanced(unitPlane, paintMat, this.paint, false, false);

    // --- Ground pads ---
    const padMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1.0 });
    this.instanced(unitPlane, padMat, this.pads, false, true);

    // --- Building bodies, one draw call per archetype ---
    const facadeMaps: Record<FacadeKind, THREE.CanvasTexture> = {
      tenement: this.createFacadeTexture('tenement'),
      commercial: this.createFacadeTexture('commercial'),
      tower: this.createFacadeTexture('tower'),
    };
    const facadeMats: Record<FacadeKind, THREE.MeshStandardMaterial> = {
      tenement: new THREE.MeshStandardMaterial({ map: facadeMaps.tenement, roughness: 0.9 }),
      commercial: new THREE.MeshStandardMaterial({ map: facadeMaps.commercial, roughness: 0.75 }),
      tower: new THREE.MeshStandardMaterial({ map: facadeMaps.tower, roughness: 0.22, metalness: 0.55 }),
    };
    for (const arch of this.archetypes) {
      this.instanced(this.createBodyGeometry(arch.bays, arch.floors), facadeMats[arch.kind], arch.items, true, true);
    }

    // --- Roofs, trim and street furniture ---
    const trimMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.8 });
    this.instanced(unitBox, trimMat, this.boxes, false, true);
    this.instanced(unitCylinder, new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.6 }), this.cylinders, false, false);
    this.instanced(unitHip, new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.85, flatShading: true }), this.hipRoofs, true, false);
    this.instanced(
      unitUmbrella,
      new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.8, side: THREE.DoubleSide, flatShading: true }),
      this.umbrellas,
      true,
      false
    );

    this.commitSigns();
  }

  /** Box with facade UVs tiled per bay / per floor; roof and base sample a plain wall texel */
  private createBodyGeometry(bays: number, floors: number): THREE.BufferGeometry {
    const geo = new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0);
    const uv = geo.getAttribute('uv') as THREE.BufferAttribute;
    // BoxGeometry face order: +X, -X, +Y, -Y, +Z, -Z (4 vertices each)
    for (let i = 0; i < uv.count; i++) {
      const face = Math.floor(i / 4);
      if (face === 2 || face === 3) uv.setXY(i, 0.04, 0.5);
      else uv.setXY(i, uv.getX(i) * bays, uv.getY(i) * floors);
    }
    uv.needsUpdate = true;
    return geo;
  }

  /** One bay × one floor tile. Walls are near-white so the per-instance colour tints them. */
  private createFacadeTexture(kind: FacadeKind): THREE.CanvasTexture {
    const S = 128;
    const canvas = document.createElement('canvas');
    canvas.width = S;
    canvas.height = S;
    const ctx = canvas.getContext('2d')!;
    const rand = seededRandom(kind.length * 977);

    if (kind === 'tenement') {
      ctx.fillStyle = '#f2ede2';
      ctx.fillRect(0, 0, S, S);
      // Weathering streaks
      for (let i = 0; i < 26; i++) {
        ctx.fillStyle = `rgba(90, 70, 50, ${0.03 + rand() * 0.05})`;
        ctx.fillRect(rand() * S, rand() * S, 2 + rand() * 5, 10 + rand() * 40);
      }
      // Floor slab band
      ctx.fillStyle = '#cfc8ba';
      ctx.fillRect(0, S - 9, S, 9);
      // Louvred window with frame
      ctx.fillStyle = '#e4dccb';
      ctx.fillRect(30, 26, 68, 70);
      ctx.fillStyle = '#27323d';
      ctx.fillRect(35, 31, 58, 60);
      ctx.fillStyle = 'rgba(160, 190, 205, 0.55)';
      for (let y = 34; y < 90; y += 7) ctx.fillRect(36, y, 56, 3);
      ctx.fillStyle = '#e4dccb';
      ctx.fillRect(62, 31, 4, 60);
    } else if (kind === 'commercial') {
      ctx.fillStyle = '#f3f3f0';
      ctx.fillRect(0, 0, S, S);
      ctx.fillStyle = '#d4d4cf';
      ctx.fillRect(0, S - 16, S, 16);
      // Ribbon glazing
      ctx.fillStyle = '#2f4a63';
      ctx.fillRect(8, 28, 112, 62);
      const sheen = ctx.createLinearGradient(0, 28, 0, 90);
      sheen.addColorStop(0, 'rgba(170, 205, 230, 0.55)');
      sheen.addColorStop(1, 'rgba(40, 70, 100, 0.1)');
      ctx.fillStyle = sheen;
      ctx.fillRect(8, 28, 112, 62);
      ctx.fillStyle = '#e8e8e4';
      ctx.fillRect(62, 28, 4, 62);
      ctx.fillRect(8, 57, 112, 3);
    } else {
      // Curtain-wall glass
      const glass = ctx.createLinearGradient(0, 0, 0, S);
      glass.addColorStop(0, '#e8f2fa');
      glass.addColorStop(1, '#b4c8d8');
      ctx.fillStyle = glass;
      ctx.fillRect(0, 0, S, S);
      ctx.fillStyle = 'rgba(60, 80, 100, 0.55)';
      ctx.fillRect(0, S - 20, S, 20);
      ctx.fillStyle = '#6b7785';
      ctx.fillRect(0, 0, 4, S);
      ctx.fillRect(S / 2 - 2, 0, 4, S);
      ctx.fillRect(0, 0, S, 4);
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    return tex;
  }

  /** All shop signboards share one atlas texture; each instance picks its cell in the shader */
  private commitSigns(): void {
    if (this.signs.length === 0) return;

    const CW = 512, CH = 128;
    const canvas = document.createElement('canvas');
    canvas.width = CW * SIGN_COLS;
    canvas.height = CH * SIGN_ROWS;
    const ctx = canvas.getContext('2d')!;
    const boards = [
      ['#0f5132', '#fef9c3'], ['#1d4ed8', '#ffffff'], ['#b91c1c', '#fef3c7'], ['#fde047', '#1f2937'],
      ['#111827', '#fbbf24'], ['#ffffff', '#b91c1c'], ['#7c2d12', '#ffedd5'], ['#0e7490', '#ecfeff'],
    ];
    SHOP_NAMES.forEach((name, i) => {
      const x = (i % SIGN_COLS) * CW;
      const y = Math.floor(i / SIGN_COLS) * CH;
      const [bg, fg] = boards[i % boards.length];
      ctx.fillStyle = bg;
      ctx.fillRect(x, y, CW, CH);
      ctx.strokeStyle = fg;
      ctx.lineWidth = 6;
      ctx.strokeRect(x + 9, y + 9, CW - 18, CH - 18);
      ctx.fillStyle = fg;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      let size = 46;
      do {
        ctx.font = `900 ${size}px "Arial Black", "Segoe UI", sans-serif`;
        size -= 2;
      } while (ctx.measureText(name).width > CW - 50 && size > 16);
      ctx.fillText(name, x + CW / 2, y + CH / 2 + 2);
    });

    const atlas = new THREE.CanvasTexture(canvas);
    atlas.colorSpace = THREE.SRGBColorSpace;
    atlas.anisotropy = 8;

    const material = new THREE.MeshStandardMaterial({ map: atlas, roughness: 0.6 });
    material.onBeforeCompile = (shader) => {
      shader.vertexShader =
        'attribute vec2 aAtlas;\n' +
        shader.vertexShader.replace(
          '#include <uv_vertex>',
          `#include <uv_vertex>
          #ifdef USE_MAP
            vMapUv = (vMapUv + aAtlas) * vec2(${(1 / SIGN_COLS).toFixed(5)}, ${(1 / SIGN_ROWS).toFixed(5)});
          #endif`
        );
    };

    const geo = new THREE.PlaneGeometry(1, 1);
    const cells = new Float32Array(this.signs.length * 2);
    this.signs.forEach((sign, i) => {
      cells[i * 2] = sign.atlas % SIGN_COLS;
      cells[i * 2 + 1] = SIGN_ROWS - 1 - Math.floor(sign.atlas / SIGN_COLS);
    });
    geo.setAttribute('aAtlas', new THREE.InstancedBufferAttribute(cells, 2));

    this.instanced(geo, material, this.signs, false, false);
  }
}
