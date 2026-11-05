import * as THREE from 'three';
import { Builder } from '../world/kit/ArchKit';
import { Activity } from '../life/Activity';

/**
 * The garden at home: planters and pots bought in the catalogue and put down anywhere, where
 * Nigerian vegetables and flowers are sown, watered once on the way up, and harvested into
 * the bag as food (ugwu, tomatoes, pepper, plantain...) or picked as a bouquet. They grow by
 * the real clock, so the garden is ready when the player comes back to it.
 */

export interface Seed {
  id: string;
  name: string;
  icon: string;
  price: number;
  /** Real minutes from sowing to harvest, with the watering done */
  minutes: number;
  kind: 'veg' | 'flower';
  colour: number;
  crop: { id: string; name: string; icon: string; qty: number; restore: number; sell: number };
}

const crop = (id: string, name: string, icon: string, qty: number, restore: number, sell: number) => ({ id: `garden_${id}`, name, icon, qty, restore, sell });

export const SEEDS: Seed[] = [
  { id: 'efirin', name: 'Scent leaf (efirin)', icon: '🌿', price: 250, minutes: 10, kind: 'veg', colour: 0x16a34a, crop: crop('efirin', 'Scent leaf', '🌿', 3, 6, 150) },
  { id: 'lemongrass', name: 'Lemongrass (for tea)', icon: '🌾', price: 250, minutes: 10, kind: 'veg', colour: 0x84cc16, crop: crop('lemongrass', 'Lemongrass', '🌾', 3, 6, 150) },
  { id: 'ugwu', name: 'Ugwu (fluted pumpkin)', icon: '🥬', price: 300, minutes: 20, kind: 'veg', colour: 0x15803d, crop: crop('ugwu', 'Ugwu leaves', '🥬', 3, 10, 300) },
  { id: 'okra', name: 'Okra', icon: '🫛', price: 300, minutes: 30, kind: 'veg', colour: 0x65a30d, crop: crop('okra', 'Okra', '🫛', 4, 9, 250) },
  { id: 'rodo', name: 'Pepper (ata rodo)', icon: '🌶️', price: 350, minutes: 40, kind: 'veg', colour: 0xdc2626, crop: crop('rodo', 'Ata rodo', '🌶️', 5, 5, 300) },
  { id: 'tomato', name: 'Tomatoes', icon: '🍅', price: 400, minutes: 45, kind: 'veg', colour: 0xef4444, crop: crop('tomato', 'Tomatoes', '🍅', 4, 8, 350) },
  { id: 'zobo', name: 'Zobo (hibiscus)', icon: '🌺', price: 500, minutes: 60, kind: 'veg', colour: 0x9f1239, crop: crop('zobo', 'Zobo leaves', '🌺', 3, 12, 500) },
  { id: 'plantain', name: 'Plantain', icon: '🍌', price: 900, minutes: 180, kind: 'veg', colour: 0xeab308, crop: crop('plantain', 'Plantain bunch', '🍌', 1, 30, 2500) },
  { id: 'ixora', name: 'Ixora', icon: '🌸', price: 250, minutes: 15, kind: 'flower', colour: 0xf43f5e, crop: crop('ixora', 'Ixora bouquet', '🌸', 1, 0, 1500) },
  { id: 'sunflower', name: 'Sunflowers', icon: '🌻', price: 400, minutes: 40, kind: 'flower', colour: 0xfacc15, crop: crop('sunflower', 'Sunflower bouquet', '🌻', 1, 0, 2500) },
  { id: 'bougainvillea', name: 'Bougainvillea', icon: '💮', price: 600, minutes: 60, kind: 'flower', colour: 0xc026d3, crop: crop('bougainvillea', 'Bougainvillea bouquet', '💮', 1, 0, 3500) },
  { id: 'rose', name: 'Roses', icon: '🌹', price: 900, minutes: 120, kind: 'flower', colour: 0xbe123c, crop: crop('rose', 'Bouquet of roses', '🌹', 1, 0, 6000) },
];

/** Past this much of its growing, a plant waits for water before it goes on */
const THIRSTY_AT = 0.4;

interface Bed { seed: string; grown: number; last: number; watered: boolean }

export interface GardenView { seed: Seed; progress: number; thirsty: boolean; ready: boolean; minutesLeft: number }

export class Garden {
  private static instance: Garden | null = null;
  /** The clock, in ms (tests move it on) */
  public static now: () => number = () => Date.now();
  private beds: Record<string, Bed>;

  public static get(): Garden {
    if (!Garden.instance) Garden.instance = new Garden();
    return Garden.instance;
  }

  private constructor() {
    this.beds = this.load();
  }

  private key(): string {
    return `nl_garden_v1:${Activity.player()}`;
  }

  private load(): Record<string, Bed> {
    try { return JSON.parse(localStorage.getItem(this.key()) ?? '{}'); } catch { return {}; }
  }

  private save(): void {
    try { localStorage.setItem(this.key(), JSON.stringify(this.beds)); } catch { /* blocked */ }
  }

  /** Brings a bed's growing up to now: it grows while watered, or until it is thirsty */
  private tick(uid: string): Bed | null {
    const bed = this.beds[uid];
    if (!bed) return null;
    const seed = SEEDS.find((s) => s.id === bed.seed);
    if (!seed) return null;
    const total = seed.minutes * 60_000;
    const now = Garden.now();
    let grown = bed.grown + Math.max(0, now - bed.last);
    if (!bed.watered) grown = Math.min(grown, total * THIRSTY_AT);
    bed.grown = Math.min(total, grown);
    bed.last = now;
    return bed;
  }

  public view(uid: string): GardenView | null {
    const bed = this.tick(uid);
    if (!bed) return null;
    const seed = SEEDS.find((s) => s.id === bed.seed)!;
    const total = seed.minutes * 60_000;
    const progress = bed.grown / total;
    return { seed, progress, thirsty: !bed.watered && progress >= THIRSTY_AT - 1e-6, ready: progress >= 1, minutesLeft: Math.max(0, Math.ceil((total - bed.grown) / 60_000)) };
  }

  public plant(uid: string, seedId: string): boolean {
    if (this.beds[uid]) return false;
    if (!SEEDS.some((s) => s.id === seedId)) return false;
    this.beds[uid] = { seed: seedId, grown: 0, last: Garden.now(), watered: false };
    this.save();
    return true;
  }

  public water(uid: string): boolean {
    const bed = this.tick(uid);
    if (!bed || bed.watered) return false;
    bed.watered = true;
    this.save();
    return true;
  }

  /** Takes in what is ripe; the bed is empty again */
  public harvest(uid: string): Seed | null {
    const v = this.view(uid);
    if (!v?.ready) return null;
    delete this.beds[uid];
    this.save();
    return v.seed;
  }

  /** A piece sold or put away: what grew in it goes with it */
  public forget(uid: string): void {
    if (!this.beds[uid]) return;
    delete this.beds[uid];
    this.save();
  }

  /** The plants drawn in a planter as they stand: sprouts, a bush, then fruit or flowers */
  public dress(uid: string, mesh: THREE.Object3D, modelType: string): void {
    const v = this.view(uid);
    const stage = !v ? -1 : v.ready ? 3 : v.progress >= THIRSTY_AT ? 2 : v.progress >= 0.12 ? 1 : 0;
    const tag = v ? `${v.seed.id}:${stage}:${v.thirsty ? 'dry' : 'wet'}` : 'empty';
    const old = mesh.getObjectByName('garden plants');
    if (old?.userData.tag === tag) return;
    old?.removeFromParent();
    if (!v) return;
    const b = new Builder();
    const spots = modelType === 'flower_pots' ? [[-0.5, 0.52], [0, 0.52], [0.5, 0.52]] : [[-0.5, 0.42], [0, 0.42], [0.5, 0.42]];
    const leaf = v.thirsty ? 0x8a9a3a : v.seed.kind === 'flower' ? 0x15803d : v.seed.colour === 0xeab308 ? 0x166534 : 0x16a34a;
    for (const [x, y] of spots) {
      if (stage === 0) {
        b.cone(leaf, 0.03, 0.08, x - 0.04, y, 0, 5).cone(leaf, 0.03, 0.1, x + 0.04, y, 0.02, 5);
        continue;
      }
      if (v.seed.id === 'plantain' && stage >= 2) {
        b.cylinder(0x65a30d, 0.05, 0.7, x, y, 0, { sides: 6 });
        for (const yaw of [0, 2.1, 4.2]) b.box(leaf, 0.12, 0.02, 0.5, x, y + 0.68, 0, { yaw, pitch: 0.5 });
        if (stage === 3) b.box(0xeab308, 0.12, 0.2, 0.12, x + 0.06, y + 0.48, 0);
        continue;
      }
      const r = stage === 1 ? 0.07 : 0.12;
      b.dome(leaf, r, x, y, 0).dome(leaf, r * 0.8, x + 0.07, y + 0.02, 0.05).dome(leaf, r * 0.8, x - 0.07, y + 0.03, -0.04);
      if (v.seed.kind === 'flower' && stage >= 2) b.cylinder(0x15803d, 0.012, 0.25, x, y + 0.1, 0, { sides: 4 });
      if (stage === 3) {
        if (v.seed.kind === 'flower') {
          for (const [dx, dz] of [[0, 0], [0.07, 0.05], [-0.07, 0.04], [0.03, -0.07]]) b.dome(v.seed.colour, 0.05, x + dx, y + 0.3, dz);
        } else {
          for (const [dx, dz] of [[0.08, 0.04], [-0.07, 0.06], [0.02, -0.08]]) b.dome(v.seed.colour, 0.035, x + dx, y + 0.1, dz);
        }
      }
    }
    const g = b.build('garden plants', { roughness: 0.8 });
    g.name = 'garden plants';
    g.userData.tag = tag;
    mesh.add(g);
  }
}

/** The planter and the pots, as catalogue models */
export function planterBox(): THREE.Group {
  const b = new Builder();
  b.box(0x7c4a1e, 1.6, 0.38, 0.7, 0, 0, 0).box(0x3f2a14, 1.5, 0.04, 0.6, 0, 0.38, 0);
  for (const x of [-0.78, 0.78]) b.box(0x5b3412, 0.06, 0.42, 0.72, x, 0, 0);
  return b.build('planter_box');
}

export function flowerPots(): THREE.Group {
  const b = new Builder();
  for (const x of [-0.5, 0, 0.5]) b.cylinder(0xb45309, 0.17, 0.48, x, 0, 0, { topRadius: 0.2, sides: 12 }).cylinder(0x3f2a14, 0.18, 0.03, x, 0.48, 0, { sides: 12 });
  return b.build('flower_pots');
}
