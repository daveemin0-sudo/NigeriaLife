import * as THREE from 'three';

/**
 * The roadside stalls of a city, drawn as a few instanced meshes and opened up and packed away one
 * by one as their traders come and go. One kind of thing for every city: Lagos's side-street stalls
 * (placed by its street fabric) and Abuja's and Port Harcourt's (placed along their avenues) alike.
 *
 *   goods: an umbrella over a table stacked with goods (provisions, phone cards, clothes)
 *   food:  an umbrella over a table with a cooking pot and a cool box (akara, boli and fish, rice)
 *   suya:  a grill over glowing coals, an umbrella, and a lantern hung on the pole for the evening
 *
 * Shut, a stall's umbrella is furled on its pole and a tarpaulin tied over the table; the coals and
 * the lantern go out. Only the instances that change are written, when a trader arrives or leaves.
 */
export type StallSells = 'goods' | 'food' | 'suya';

export interface StallSpot {
  x: number;
  z: number;
  /** The way the stall faces (toward the road): 0 faces +z */
  yaw: number;
  sells: StallSells;
  /** On a narrow pavement: a shallower table, so people can still get by */
  narrow?: boolean;
  /** Colours and the umbrella's turn (chosen by whoever placed it, so a placement stays as it was) */
  canopy?: number;
  goods?: number;
  spin?: number;
}

/** What each of Lagos's side-street stalls sells: most goods, a few food stalls, two suya spots */
export function lagosStallSells(index: number): StallSells {
  if (index % 9 === 4 || index % 9 === 7) return 'food';
  if (index % 11 === 6) return 'suya';
  return 'goods';
}

const CANOPIES = [0xdc2626, 0x16a34a, 0xfacc15, 0x2563eb, 0xf97316, 0xffffff, 0xdb2777];
const GOODS = [0xf59e0b, 0xef4444, 0x22c55e, 0xfde047, 0xf8fafc];
const TARP = new THREE.Color(0x1d4ed8);
const WOOD = new THREE.Color(0x8b5a2b);
const STEEL = new THREE.Color(0x4b5563);

interface Part {
  mesh: THREE.InstancedMesh;
  open: THREE.Matrix4[];
  colors: (THREE.Color | null)[];
}

/** Where each stall's parts are in the meshes (-1: it has none of that part) */
interface Stall {
  spot: StallSpot;
  deep: number;
  canopy: number;
  top: number;
  extra: number[];
  glow: number[];
  open: boolean;
}

export class StreetStalls {
  public readonly group = new THREE.Group();
  /** The tables, as boxes on the ground (what the player and drivers do not pass through) */
  public readonly boxes: Array<{ minX: number; maxX: number; minZ: number; maxZ: number }> = [];
  private readonly stalls: Stall[] = [];
  private canopyPart!: Part;
  private topPart!: Part;
  private glowPart!: Part;
  private readonly m = new THREE.Matrix4();
  private readonly q = new THREE.Quaternion();
  private readonly up = new THREE.Vector3(0, 1, 0);

  constructor(spots: readonly StallSpot[]) {
    // Drawn things only: the street's own lists say what is solid (see `boxes`)
    this.group.userData.streetLife = true;
    const poles: THREE.Matrix4[] = [];
    const tables: THREE.Matrix4[] = [];
    const canopies: THREE.Matrix4[] = [];
    const canopyColors: THREE.Color[] = [];
    const tops: THREE.Matrix4[] = [];
    const topColors: THREE.Color[] = [];
    const pots: THREE.Matrix4[] = [];
    const potColors: THREE.Color[] = [];
    const glows: THREE.Matrix4[] = [];
    spots.forEach((spot, i) => {
      const { x, z, yaw } = spot;
      const deep = spot.narrow ? 0.6 : 0.8;
      const fx = Math.sin(yaw);
      const fz = Math.cos(yaw);
      const stall: Stall = { spot, deep, canopy: canopies.length, top: tops.length, extra: [], glow: [], open: true };
      poles.push(this.mat(x, 0, z, 0.07, 2.3, 0.07));
      canopies.push(this.mat(x, 2.1, z, 1.25, 0.55, 1.25, spot.spin ?? i * 1.3));
      canopyColors.push(new THREE.Color(spot.canopy ?? (spot.sells === 'suya' ? 0x7c2d12 : CANOPIES[i % CANOPIES.length])));
      tables.push(this.mat(x, 0.28, z, 1.3, 0.7, deep, yaw));
      if (spot.sells === 'goods') {
        tops.push(this.mat(x, 0.98, z, 1.05, 0.22, deep - 0.2, yaw));
        topColors.push(new THREE.Color(spot.goods ?? GOODS[i % GOODS.length]));
      } else if (spot.sells === 'food') {
        // A tray of food on one side, the pot and the cool box beside it
        tops.push(this.mat(x - Math.cos(yaw) * 0.3, 0.98, z + Math.sin(yaw) * 0.3, 0.55, 0.08, deep - 0.25, yaw));
        topColors.push(new THREE.Color(0xf59e0b));
        stall.extra.push(pots.length);
        pots.push(this.mat(x + Math.cos(yaw) * 0.32, 0.98, z - Math.sin(yaw) * 0.32, 0.36, 0.34, 0.36));
        potColors.push(new THREE.Color(0x52525b));
        stall.extra.push(pots.length);
        pots.push(this.mat(x - fx * 0.7 + Math.cos(yaw) * 0.5, 0, z - fz * 0.7 - Math.sin(yaw) * 0.5, 0.5, 0.45, 0.5));
        potColors.push(new THREE.Color(0x2563eb));
      } else {
        // Suya: sticks of meat on the grill over the coals, and a lantern on the pole
        tops.push(this.mat(x, 0.99, z, 1.0, 0.06, deep - 0.3, yaw));
        topColors.push(new THREE.Color(0x92400e));
        stall.glow.push(glows.length);
        glows.push(this.mat(x, 0.93, z, 1.05, 0.06, deep - 0.25, yaw));
        stall.glow.push(glows.length);
        glows.push(this.mat(x + fx * 0.05, 1.75, z + fz * 0.05, 0.16, 0.22, 0.16));
      }
      this.stalls.push(stall);
      // The table, whichever way it is turned
      const alongX = Math.abs(Math.cos(yaw)) > 0.5;
      const half = deep / 2;
      this.boxes.push({ minX: x - (alongX ? 0.65 : half), maxX: x + (alongX ? 0.65 : half), minZ: z - (alongX ? half : 0.65), maxZ: z + (alongX ? half : 0.65) });
    });

    const unitBox = new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0);
    const unitCylinder = new THREE.CylinderGeometry(0.5, 0.5, 1, 10).translate(0, 0.5, 0);
    const unitCone = new THREE.ConeGeometry(1, 1, 8, 1).translate(0, 0.5, 0);
    const solid = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.8 });
    this.part(unitCylinder, solid, poles, poles.map(() => STEEL), true);
    this.part(unitBox, solid, tables, tables.map(() => WOOD), true);
    this.canopyPart = this.part(unitCone, new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.8, side: THREE.DoubleSide, flatShading: true }), canopies, canopyColors, true);
    this.topPart = this.part(unitBox, solid, tops, topColors, false);
    this.part(unitCylinder, solid, pots, potColors, false);
    // Coals and lanterns light themselves: they are seen at night
    this.glowPart = this.part(unitBox, new THREE.MeshBasicMaterial({ color: 0xff8a3d }), glows, glows.map(() => null), false);
  }

  public get count(): number {
    return this.stalls.length;
  }

  public isOpen(i: number): boolean {
    return this.stalls[i]?.open ?? false;
  }

  public sells(i: number): StallSells | undefined {
    return this.stalls[i]?.spot.sells;
  }

  /** Opens a stall up, or packs it away (a handful of instance writes) */
  public setOpen(i: number, open: boolean): void {
    const st = this.stalls[i];
    if (!st || st.open === open) return;
    st.open = open;
    const { x, z, yaw } = st.spot;
    const c = this.canopyPart;
    const t = this.topPart;
    if (open) {
      c.mesh.setMatrixAt(st.canopy, c.open[st.canopy]);
      t.mesh.setMatrixAt(st.top, t.open[st.top]);
      if (t.colors[st.top]) t.mesh.setColorAt(st.top, t.colors[st.top]!);
      for (const g of st.glow) this.glowPart.mesh.setMatrixAt(g, this.glowPart.open[g]);
    } else {
      c.mesh.setMatrixAt(st.canopy, this.mat(x, 1.2, z, 0.13, 1.15, 0.13));
      t.mesh.setMatrixAt(st.top, this.mat(x, 0.97, z, 1.4, 0.1, st.deep + 0.1, yaw));
      t.mesh.setColorAt(st.top, TARP);
      for (const g of st.glow) this.glowPart.mesh.setMatrixAt(g, this.m.makeScale(0, 0, 0));
    }
    c.mesh.instanceMatrix.needsUpdate = true;
    t.mesh.instanceMatrix.needsUpdate = true;
    if (t.mesh.instanceColor) t.mesh.instanceColor.needsUpdate = true;
    if (st.glow.length) this.glowPart.mesh.instanceMatrix.needsUpdate = true;
  }

  private part(geo: THREE.BufferGeometry, material: THREE.Material, mats: THREE.Matrix4[], colors: (THREE.Color | null)[], cast: boolean): Part {
    const mesh = new THREE.InstancedMesh(geo, material, Math.max(1, mats.length));
    mesh.count = mats.length;
    mats.forEach((mat, i) => {
      mesh.setMatrixAt(i, mat);
      if (colors[i]) mesh.setColorAt(i, colors[i]!);
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.castShadow = cast;
    mesh.receiveShadow = true;
    mesh.computeBoundingSphere();
    mesh.visible = mats.length > 0;
    this.group.add(mesh);
    return { mesh, open: mats.map((mat) => mat.clone()), colors };
  }

  private mat(px: number, py: number, pz: number, sx: number, sy: number, sz: number, yaw = 0): THREE.Matrix4 {
    this.q.setFromAxisAngle(this.up, yaw);
    return new THREE.Matrix4().compose(new THREE.Vector3(px, py, pz), this.q, new THREE.Vector3(sx, sy, sz));
  }
}
