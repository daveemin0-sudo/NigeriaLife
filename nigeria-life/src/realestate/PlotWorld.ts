import * as THREE from 'three';
import type { InteractiveObject } from '../world/World';
import type { Obstruction } from '../world/plan/CityPlan';
import { RENDER_LAYERS } from '../interiors/InteriorTypes';
import { AssetMarket } from './AssetMarket';
import { buildingType, footprintAt, type BuildingType } from './BuildingCatalogue';
import { Land, stageOf, STAGE_LABEL, type Plot } from './Land';
import { STATE_NAME, type PlotCity } from './PlotCatalogue';
import { Registry, MY_ID } from './Registry';
import { hoursDone, isFinished, isLet } from './WorldClock';
import type { ConstructionStage, PlotBuilding } from './types';

const EARTH = 0xa8855a;
const CONCRETE = 0x9aa0a6;
const BLOCKWORK = 0x8d9299;
const SCAFFOLD = 0x8a6b3a;

const box = (parent: THREE.Object3D, colour: number, w: number, h: number, d: number, x: number, y: number, z: number, opts: { roughness?: number; shadow?: boolean } = {}) => {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshStandardMaterial({ color: colour, roughness: opts.roughness ?? 0.85 }));
  mesh.position.set(x, y, z);
  mesh.castShadow = opts.shadow ?? true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
};

/** A board with a few lines of writing on it. */
function board(lines: string[], background: string, ink: string): THREE.Mesh {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 288;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = background;
  ctx.fillRect(0, 0, 512, 288);
  ctx.strokeStyle = ink;
  ctx.lineWidth = 10;
  ctx.strokeRect(8, 8, 496, 272);
  ctx.fillStyle = ink;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const sizes = [54, 40, 34, 30];
  const total = lines.length;
  lines.forEach((line, index) => {
    let size = sizes[Math.min(index, sizes.length - 1)];
    ctx.font = `800 ${size}px system-ui, sans-serif`;
    while (ctx.measureText(line).width > 470 && size > 18) {
      size -= 2;
      ctx.font = `800 ${size}px system-ui, sans-serif`;
    }
    ctx.fillText(line, 256, 144 + (index - (total - 1) / 2) * 62);
  });
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 1.46), new THREE.MeshBasicMaterial({ map: texture, side: THREE.DoubleSide }));
  return mesh;
}

/** Which way a plot's street is, as a step from the plot's centre. */
function towardStreet(plot: Plot): { dx: number; dz: number } {
  switch (plot.frontage) {
    case 'north': return { dx: 0, dz: -1 };
    case 'south': return { dx: 0, dz: 1 };
    case 'east': return { dx: 1, dz: 0 };
    default: return { dx: -1, dz: 0 };
  }
}

/** The middle of the edge of a plot that is on its street. */
function frontOf(plot: Plot): THREE.Vector3 {
  const { rect } = plot;
  const cx = (rect.minX + rect.maxX) / 2;
  const cz = (rect.minZ + rect.maxZ) / 2;
  const { dx, dz } = towardStreet(plot);
  return new THREE.Vector3(cx + dx * ((rect.maxX - rect.minX) / 2), 0, cz + dz * ((rect.maxZ - rect.minZ) / 2));
}

/**
 * One building at one stage of going up. The same function draws every design: what changes
 * between a bungalow and a hotel is only the numbers in the catalogue.
 */
export function raise(type: BuildingType, building: Pick<PlotBuilding, 'x' | 'z' | 'turns'>, stage: ConstructionStage, facing: { dx: number; dz: number }, done = 1): THREE.Group {
  const group = new THREE.Group();
  const rect = footprintAt(type, building.x, building.z, building.turns);
  const w = rect.maxX - rect.minX;
  const d = rect.maxZ - rect.minZ;
  const cx = building.x;
  const cz = building.z;
  const height = type.floors * type.floorHeight;
  // The face of the building that looks at the street
  const fx = facing.dx * (w / 2);
  const fz = facing.dz * (d / 2);
  const alongX = facing.dz !== 0; // the street face runs along x

  const scaffold = (upTo: number) => {
    const span = alongX ? w : d;
    for (let s = -span / 2; s <= span / 2 + 0.01; s += Math.max(2, span / 4)) {
      const px = cx + fx + facing.dx * 0.7 + (alongX ? s : 0);
      const pz = cz + fz + facing.dz * 0.7 + (alongX ? 0 : s);
      box(group, SCAFFOLD, 0.1, upTo, 0.1, px, upTo / 2, pz);
    }
    for (let level = type.floorHeight; level <= upTo + 0.01; level += type.floorHeight) {
      box(group, 0xc9a66b, alongX ? span : 0.7, 0.06, alongX ? 0.7 : span, cx + fx + facing.dx * 0.7, level, cz + fz + facing.dz * 0.7);
    }
  };

  if (stage === 'cleared') {
    box(group, 0x8a6f47, w, 0.06, d, cx, 0.07, cz, { shadow: false });
    // Sand, a stack of blocks and the pegs that mark out the corners
    const sand = new THREE.Mesh(new THREE.ConeGeometry(1.1, 0.9, 10), new THREE.MeshStandardMaterial({ color: 0xd8bf8a, roughness: 1 }));
    sand.position.set(cx - w / 4, 0.5, cz - d / 4);
    group.add(sand);
    box(group, BLOCKWORK, 1.4, 0.8, 0.9, cx + w / 4, 0.45, cz + d / 5);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) box(group, 0xdc2626, 0.08, 0.7, 0.08, cx + (sx * w) / 2, 0.35, cz + (sz * d) / 2);
    return group;
  }

  // From here on there is a slab
  box(group, CONCRETE, w, 0.35, d, cx, 0.175, cz);
  const columnsX = Math.max(2, Math.round(w / 4) + 1);
  const columnsZ = Math.max(2, Math.round(d / 4) + 1);
  const eachColumn = (visit: (x: number, z: number) => void) => {
    for (let i = 0; i < columnsX; i++) {
      for (let j = 0; j < columnsZ; j++) visit(cx - w / 2 + 0.3 + (i * (w - 0.6)) / (columnsX - 1), cz - d / 2 + 0.3 + (j * (d - 0.6)) / (columnsZ - 1));
    }
  };

  if (stage === 'foundation') {
    eachColumn((x, z) => box(group, 0x7c5a3a, 0.08, 1.3, 0.08, x, 1.0, z));
    return group;
  }

  if (stage === 'structure') {
    // How many storeys of frame are up depends on how far through this stage the work is
    const through = Math.min(1, Math.max(0, (done - 0.38) / 0.36));
    const floorsUp = Math.max(1, Math.ceil(through * type.floors));
    const top = floorsUp * type.floorHeight;
    eachColumn((x, z) => box(group, CONCRETE, 0.34, top, 0.34, x, 0.35 + top / 2, z));
    for (let floor = 1; floor <= floorsUp; floor++) box(group, CONCRETE, w, 0.22, d, cx, 0.35 + floor * type.floorHeight, cz);
    scaffold(top);
    return group;
  }

  // Walls are up. Bare blockwork until it is finished, then paint.
  const finished = stage === 'finished';
  const wall = finished ? type.colour : BLOCKWORK;
  box(group, wall, w - 0.1, height, d - 0.1, cx, 0.35 + height / 2, cz, { roughness: type.look === 'glass' && finished ? 0.25 : 0.85 });

  // Windows on every floor, on the street face and the two sides
  const glass = finished ? (type.look === 'glass' ? 0x1e3a5f : 0x243447) : 0x3f4650;
  for (let floor = 0; floor < type.floors; floor++) {
    const y = 0.35 + floor * type.floorHeight + type.floorHeight * 0.55;
    const shopFloor = floor === 0 && type.look === 'shopfront';
    const count = Math.max(2, Math.round((alongX ? w : d) / 2.6));
    for (let i = 0; i < count; i++) {
      const along = -((alongX ? w : d) / 2) + ((i + 0.5) * (alongX ? w : d)) / count;
      // The middle of the ground floor is the door
      if (floor === 0 && Math.abs(along) < (alongX ? w : d) / count / 2 + 0.01 && count % 2 === 1) continue;
      const ww = shopFloor ? ((alongX ? w : d) / count) * 0.86 : 1.2;
      const wh = shopFloor ? type.floorHeight * 0.62 : type.floorHeight * 0.42;
      box(group, glass, alongX ? ww : 0.08, wh, alongX ? 0.08 : ww, cx + fx + (alongX ? along : 0), y, cz + fz + (alongX ? 0 : along), { roughness: 0.2, shadow: false });
    }
  }
  // The door, on the street face
  box(group, finished ? 0x5b3a1e : 0x4b5563, alongX ? 1.3 : 0.1, 2.2, alongX ? 0.1 : 1.3, cx + fx, 0.35 + 1.1, cz + fz, { shadow: false });
  box(group, CONCRETE, alongX ? 2 : 0.8, 0.18, alongX ? 0.8 : 2, cx + fx + facing.dx * 0.4, 0.09, cz + fz + facing.dz * 0.4, { shadow: false });

  // The roof
  if (type.look === 'house') {
    const roof = new THREE.Mesh(new THREE.ConeGeometry(Math.hypot(w, d) / 2 + 0.3, 1.9, 4), new THREE.MeshStandardMaterial({ color: finished ? 0x8a4b2f : 0x6b7280, roughness: 0.9 }));
    roof.rotation.y = Math.PI / 4;
    roof.scale.set(w / Math.hypot(w, d) * 1.42, 1, d / Math.hypot(w, d) * 1.42);
    roof.position.set(cx, 0.35 + height + 0.95, cz);
    roof.castShadow = true;
    group.add(roof);
  } else {
    box(group, finished ? new THREE.Color(type.colour).multiplyScalar(0.7).getHex() : 0x6b7280, w + 0.2, 0.5, d + 0.2, cx, 0.35 + height + 0.25, cz);
  }

  if (!finished) {
    scaffold(height);
    return group;
  }

  // Finishing touches by the kind of building
  if (type.look === 'shopfront') {
    const awning = box(group, 0xdc2626, alongX ? w * 0.9 : 1.5, 0.1, alongX ? 1.5 : d * 0.9, cx + fx + facing.dx * 0.75, 0.35 + type.floorHeight * 0.86, cz + fz + facing.dz * 0.75);
    awning.name = 'facade_awning';
  }
  if (type.look === 'house' && type.floors > 1) {
    const balcony = box(group, 0xe5e7eb, alongX ? w * 0.5 : 1.1, 0.14, alongX ? 1.1 : d * 0.5, cx + fx + facing.dx * 0.55, 0.35 + type.floorHeight, cz + fz + facing.dz * 0.55);
    balcony.name = 'facade_balcony';
  }
  if (type.look === 'block' || type.look === 'glass') {
    // A canopy over the entrance, held clear of the pavement
    const canopy = box(group, 0x1f2937, alongX ? 3.2 : 1.6, 0.16, alongX ? 1.6 : 3.2, cx + fx + facing.dx * 0.8, 0.35 + 2.9, cz + fz + facing.dz * 0.8);
    canopy.name = 'facade_canopy';
  }
  return group;
}

/**
 * The plots as they are seen in the city: the bare ground and its boundary, the board saying
 * whose it is and whether it is for sale, and whatever is being built or has been built on it.
 * It draws what the registry says and nothing else, and redraws a plot only when that changes.
 */
export class PlotWorld {
  /** Everything, for all cities. Each city's plots are in a group of their own inside it. */
  public readonly group = new THREE.Group();
  /** Every plot's card, whatever city it is in */
  public readonly interactiveList: InteractiveObject[] = [];
  private readonly cityGroups = new Map<PlotCity, THREE.Group>();
  private readonly cityCards = new Map<PlotCity, InteractiveObject[]>();
  private readonly land = Land.get();
  private readonly market = AssetMarket.get();
  private readonly roots = new Map<string, { root: THREE.Group; drawn: string }>();
  private ghost: THREE.Group | null = null;

  constructor() {
    this.group.name = 'plots';
    for (const plot of this.land.plots()) {
      let cityGroup = this.cityGroups.get(plot.city);
      if (!cityGroup) {
        cityGroup = new THREE.Group();
        cityGroup.name = `plots of ${plot.city}`;
        cityGroup.visible = plot.city === 'lagos';
        this.group.add(cityGroup);
        this.cityGroups.set(plot.city, cityGroup);
        this.cityCards.set(plot.city, []);
      }
      const root = new THREE.Group();
      root.name = `Plot ${plot.name}`;
      cityGroup.add(root);
      this.roots.set(plot.id, { root, drawn: '' });
      const front = frontOf(plot);
      const { dx, dz } = towardStreet(plot);
      const card: InteractiveObject = {
        mesh: root,
        id: `plot_${plot.id}`,
        name: plot.name,
        category: 'Land',
        description: '',
        // On the verge between the plot and the pavement
        interactionPoint: new THREE.Vector3(front.x + dx * 1.2, 0, front.z + dz * 1.2),
      };
      this.interactiveList.push(card);
      this.cityCards.get(plot.city)!.push(card);
    }
    Registry.get().subscribe(() => this.refresh());
    this.refresh();
  }

  /** The plots of one city, as a group to show and hide and as cards to walk up to. */
  public of(city: PlotCity): { group: THREE.Group | null; cards: InteractiveObject[] } {
    return { group: this.cityGroups.get(city) ?? null, cards: this.cityCards.get(city) ?? [] };
  }

  /** Shows the plots of the city the player is in and hides the rest. */
  public showCity(city: string): void {
    for (const [name, group] of this.cityGroups) group.visible = name === city;
  }

  /** What a plot's board says. Also what its card in the world says. */
  public describe(plot: Plot): string[] {
    const status = this.land.status(plot.id);
    const owner = this.land.ownerOf(plot.id);
    const state = STATE_NAME[plot.city].replace(/^the /, '');
    const who = owner === MY_ID ? 'YOUR LAND' : owner ? `OWNER: ${this.market.nameOf(owner).toUpperCase()}` : `${state.toUpperCase()} LAND`;
    const size = `${Math.round(plot.area)} m² · ${plot.neighbourhood}`;
    const building = this.land.building(plot.id);
    const type = building ? buildingType(building.typeId) : null;
    if (status === 'available') return ['LAND FOR SALE', `₦${plot.statePrice.toLocaleString()}`, size, `${state} Lands Bureau`];
    if (status === 'listed' || status === 'negotiating') return ['FOR SALE BY OWNER', `Asking ₦${(this.land.askingPrice(plot.id) ?? 0).toLocaleString()}`, size, who];
    if (status === 'reserved') return ['SOLD', 'Subject to completion', size, who];
    if (status === 'building' && building && type) return [`${type.name.toUpperCase()} GOING UP`, STAGE_LABEL[stageOf(building)], `${Math.round((hoursDone(building) / building.hoursNeeded) * 100)}% built`, who];
    if (status === 'developed' && type) {
      const tenancy = this.land.tenancy(plot.id);
      if (isLet(tenancy)) return [type.name.toUpperCase(), who, `LET TO ${tenancy.tenantId === MY_ID ? 'YOU' : this.market.nameOf(tenancy.tenantId).toUpperCase()}`, size];
      if (tenancy && !tenancy.ending) return [`${type.name.toUpperCase()} TO LET`, `₦${tenancy.rentPerWeek.toLocaleString()} a week`, size, who];
      return [type.name.toUpperCase(), who, size, 'Not for sale'];
    }
    return ['PRIVATE LAND', 'Not for sale', size, who];
  }

  public refresh(): void {
    for (const plot of this.land.plots()) {
      const entry = this.roots.get(plot.id)!;
      const building = this.land.building(plot.id);
      const lines = this.describe(plot);
      // Work is redrawn when it reaches the next storey, not for every hour
      const progress = building && !isFinished(building) ? Math.floor((hoursDone(building) / building.hoursNeeded) * 12) : -1;
      const signature = JSON.stringify([lines, building?.typeId, building?.x, building?.z, building?.turns, building ? stageOf(building) : null, progress]);
      if (signature === entry.drawn) continue;
      entry.drawn = signature;
      this.draw(plot, entry.root, lines, building);
      const card = this.interactiveList.find((item) => item.id === `plot_${plot.id}`);
      if (card) card.description = lines.join(' · ');
    }
  }

  private draw(plot: Plot, root: THREE.Group, lines: string[], building: PlotBuilding | null): void {
    for (const child of [...root.children]) {
      child.traverse((obj) => {
        const mesh = obj as THREE.Mesh;
        if (!mesh.isMesh) return;
        mesh.geometry.dispose();
        const material = mesh.material as THREE.Material & { map?: THREE.Texture | null };
        material.map?.dispose();
        material.dispose();
      });
      root.remove(child);
    }
    const { rect } = plot;
    const w = rect.maxX - rect.minX;
    const d = rect.maxZ - rect.minZ;
    const cx = (rect.minX + rect.maxX) / 2;
    const cz = (rect.minZ + rect.maxZ) / 2;
    const owner = this.land.ownerOf(plot.id);
    const status = this.land.status(plot.id);

    // The ground itself
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(w, d), new THREE.MeshStandardMaterial({ color: building && isFinished(building) ? 0x9a9186 : EARTH, roughness: 1 }));
    ground.rotation.x = -Math.PI / 2;
    ground.position.set(cx, 0.04, cz);
    ground.receiveShadow = true;
    root.add(ground);

    // Its boundary: a low kerb all the way round, in a colour that says whose it is
    const edge = owner === MY_ID ? 0x16a34a : owner ? 0x64748b : 0xfacc15;
    box(root, edge, w, 0.16, 0.18, cx, 0.08, rect.minZ, { shadow: false });
    box(root, edge, w, 0.16, 0.18, cx, 0.08, rect.maxZ, { shadow: false });
    box(root, edge, 0.18, 0.16, d, rect.minX, 0.08, cz, { shadow: false });
    box(root, edge, 0.18, 0.16, d, rect.maxX, 0.08, cz, { shadow: false });
    for (const sx of [rect.minX, rect.maxX]) for (const sz of [rect.minZ, rect.maxZ]) box(root, 0xf8fafc, 0.14, 1.0, 0.14, sx, 0.5, sz);

    // The board, at the street edge, facing the street
    const front = frontOf(plot);
    const { dx, dz } = towardStreet(plot);
    const colours: Record<string, [string, string]> = {
      available: ['#fde047', '#1f2937'], listed: ['#fca5a5', '#450a0a'], negotiating: ['#fca5a5', '#450a0a'], reserved: ['#e5e7eb', '#111827'],
      building: ['#fdba74', '#431407'], developed: ['#bbf7d0', '#052e16'], owned: ['#e2e8f0', '#0f172a'],
    };
    const [paper, ink] = colours[status];
    const sign = board(lines, paper, ink);
    // Off to one side of the frontage, so it does not stand in a doorway
    const side = (dz !== 0 ? w : d) / 2 - 1.9;
    const sx = front.x - dx * 0.5 + (dz !== 0 ? side : 0);
    const sz = front.z - dz * 0.5 + (dx !== 0 ? side : 0);
    sign.position.set(sx, 2.0, sz);
    sign.rotation.y = Math.atan2(dx, dz);
    root.add(sign);
    for (const offset of [-1.1, 1.1]) box(root, 0x4b5563, 0.1, 2.7, 0.1, sx + (dz !== 0 ? offset : 0), 1.35, sz + (dx !== 0 ? offset : 0));

    if (building) {
      const type = buildingType(building.typeId);
      if (type) root.add(raise(type, building, stageOf(building), { dx, dz }, hoursDone(building) / building.hoursNeeded));
    }
    root.traverse((child) => child.layers.set(RENDER_LAYERS.STREET));
  }

  /** What stands on the plots, for the city plan: every building, finished or not, is a building. */
  public obstructions(city: PlotCity = 'lagos'): Obstruction[] {
    const out: Obstruction[] = [];
    for (const plot of this.land.plots(city)) {
      const building = this.land.building(plot.id);
      const type = building ? buildingType(building.typeId) : null;
      if (!building || !type) continue;
      out.push({ owner: `${type.name} at ${plot.name}`, structure: true, height: type.floors * type.floorHeight, ...footprintAt(type, building.x, building.z, building.turns) });
    }
    return out;
  }

  /** Where a design would go, before it is built: green if it may go there, red if not. */
  public showPreview(plot: Plot, type: BuildingType, x: number, z: number, turns: number, allowed: boolean): void {
    this.clearPreview();
    const rect = footprintAt(type, x, z, turns);
    const w = rect.maxX - rect.minX;
    const d = rect.maxZ - rect.minZ;
    const height = type.floors * type.floorHeight;
    const colour = allowed ? 0x22c55e : 0xef4444;
    const ghost = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(w, height, d), new THREE.MeshBasicMaterial({ color: colour, transparent: true, opacity: 0.32, depthWrite: false }));
    body.position.set(x, height / 2 + 0.1, z);
    ghost.add(body);
    const outline = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(w, height, d)), new THREE.LineBasicMaterial({ color: colour }));
    outline.position.copy(body.position);
    ghost.add(outline);
    const pad = new THREE.Mesh(new THREE.PlaneGeometry(w, d), new THREE.MeshBasicMaterial({ color: colour, transparent: true, opacity: 0.55, depthWrite: false }));
    pad.rotation.x = -Math.PI / 2;
    pad.position.set(x, 0.09, z);
    ghost.add(pad);
    // An arrow of sorts: a bar on the side the door will be
    const { dx, dz } = towardStreet(plot);
    const door = new THREE.Mesh(new THREE.BoxGeometry(dz !== 0 ? 1.6 : 0.3, 2.2, dz !== 0 ? 0.3 : 1.6), new THREE.MeshBasicMaterial({ color: 0xffffff }));
    door.position.set(x + dx * (w / 2), 1.2, z + dz * (d / 2));
    ghost.add(door);
    ghost.traverse((child) => child.layers.set(RENDER_LAYERS.STREET));
    (this.cityGroups.get(plot.city) ?? this.group).add(ghost);
    this.ghost = ghost;
  }

  public clearPreview(): void {
    if (!this.ghost) return;
    this.ghost.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (mesh.geometry) mesh.geometry.dispose();
      const material = mesh.material as THREE.Material | undefined;
      material?.dispose();
    });
    this.ghost.parent?.remove(this.ghost);
    this.ghost = null;
  }

  public get previewing(): boolean {
    return this.ghost !== null;
  }
}
