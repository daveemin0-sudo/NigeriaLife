import * as THREE from 'three';
import { Builder } from '../world/kit/ArchKit';
import { Activity } from '../life/Activity';

/**
 * Pets at home. Each lives at its own piece from the catalogue: the dog at its kennel, the cat
 * at its tree, the parrot on its perch, the fish in the aquarium. Adopted there, it is named
 * and fed and played with; the dog and the cat trot about the house and come to the player,
 * the parrot bobs on its perch and the fish swim. Left unfed for a day, a pet is hungry and
 * sad, and says so.
 */

export type PetKind = 'dog' | 'cat' | 'parrot' | 'fish';

export const PET_KINDS: Record<PetKind, { name: string; icon: string; price: number; home: string; names: string[]; sound: string }> = {
  dog: { name: 'Dog', icon: '🐕', price: 25_000, home: 'dog_kennel', names: ['Bingo', 'Simba', 'Jack', 'Rex', 'Tiger'], sound: 'Woof!' },
  cat: { name: 'Cat', icon: '🐈', price: 15_000, home: 'cat_tree', names: ['Mimi', 'Snow', 'Pepper', 'Kitty'], sound: 'Miaow' },
  parrot: { name: 'Parrot', icon: '🦜', price: 45_000, home: 'parrot_perch', names: ['Coco', 'Rio', 'Kiki'], sound: '"Oga, how far!"' },
  fish: { name: 'Tropical fish', icon: '🐠', price: 30_000, home: 'aquarium', names: ['Nemo & co'], sound: 'blub' },
};

export const PET_FOOD_PRICE = 500;
const DAY = 24 * 3600_000;

interface PetSave { kind: PetKind; name: string; fedAt: number; playedAt: number; adoptedAt: number }

export interface PetView { kind: PetKind; name: string; hunger: number; happiness: number; mood: string }

function dogModel(): THREE.Group {
  const b = new Builder();
  b.box(0x8b5a2b, 0.28, 0.22, 0.6, 0, 0.28, 0).box(0x8b5a2b, 0.22, 0.22, 0.24, 0, 0.42, 0.36).box(0x6b4423, 0.12, 0.1, 0.12, 0, 0.4, 0.52);
  b.box(0x111827, 0.05, 0.04, 0.04, 0, 0.43, 0.59);
  for (const x of [-0.08, 0.08]) b.box(0x5b3a1e, 0.05, 0.12, 0.06, x, 0.6, 0.33);
  for (const [x, z] of [[-0.09, 0.2], [0.09, 0.2], [-0.09, -0.2], [0.09, -0.2]]) b.box(0x7a4f25, 0.07, 0.28, 0.07, x, 0, z);
  const g = b.build('pet dog', { roughness: 0.85 });
  const tail = new Builder().box(0x8b5a2b, 0.04, 0.04, 0.24, 0, 0, -0.12).build('tail');
  tail.position.set(0, 0.42, -0.3);
  tail.rotation.x = -0.6;
  tail.name = 'tail';
  g.add(tail);
  return g;
}

function catModel(): THREE.Group {
  const b = new Builder();
  b.box(0xf59e0b, 0.18, 0.16, 0.4, 0, 0.18, 0).box(0xf59e0b, 0.16, 0.15, 0.15, 0, 0.3, 0.24);
  for (const x of [-0.05, 0.05]) b.cone(0xd97706, 0.035, 0.07, x, 0.44, 0.24, 4);
  for (const x of [-0.04, 0.04]) b.box(0x166534, 0.025, 0.02, 0.01, x, 0.34, 0.32);
  for (const [x, z] of [[-0.06, 0.13], [0.06, 0.13], [-0.06, -0.13], [0.06, -0.13]]) b.box(0xd97706, 0.045, 0.18, 0.045, x, 0, z);
  const g = b.build('pet cat', { roughness: 0.9 });
  const tail = new Builder().box(0xf59e0b, 0.03, 0.03, 0.3, 0, 0, -0.15).build('tail');
  tail.position.set(0, 0.26, -0.2);
  tail.rotation.x = -1.0;
  tail.name = 'tail';
  g.add(tail);
  return g;
}

function parrotModel(): THREE.Group {
  const b = new Builder();
  b.box(0x16a34a, 0.12, 0.2, 0.12, 0, 0, 0).box(0x16a34a, 0.1, 0.1, 0.1, 0, 0.2, 0.02).box(0xfacc15, 0.04, 0.04, 0.06, 0, 0.22, 0.09);
  b.box(0xdc2626, 0.11, 0.06, 0.2, 0, -0.04, -0.12).box(0x2563eb, 0.02, 0.12, 0.1, 0.07, 0.06, 0).box(0x2563eb, 0.02, 0.12, 0.1, -0.07, 0.06, 0);
  return b.build('pet parrot', { roughness: 0.6 });
}

function fishModel(colour: number): THREE.Group {
  const b = new Builder();
  b.box(colour, 0.03, 0.06, 0.1, 0, 0, 0).cone(colour, 0.03, 0.05, 0, 0, -0.07, 3, { pitch: Math.PI / 2 });
  return b.build('pet fish');
}

/** The pet homes, as catalogue models */
export function kennel(): THREE.Group {
  const b = new Builder();
  b.box(0x92400e, 0.9, 0.6, 0.8, 0, 0, 0).box(0xb91c1c, 1.0, 0.08, 0.9, 0, 0.6, 0, { roll: 0.35 }).box(0x111827, 0.34, 0.4, 0.02, 0, 0.06, 0.41);
  b.cylinder(0x64748b, 0.13, 0.07, 0.7, 0, 0.35, { sides: 12 }).cylinder(0x64748b, 0.13, 0.07, 0.7, 0, 0.05, { sides: 12 });
  return b.build('dog_kennel');
}

export function catTree(): THREE.Group {
  const b = new Builder();
  b.box(0xd6d3d1, 0.7, 0.06, 0.7, 0, 0, 0).cylinder(0xa8a29e, 0.07, 1.3, 0, 0.06, 0, { sides: 8 }).box(0xd6d3d1, 0.5, 0.05, 0.5, 0, 0.7, 0).box(0xd6d3d1, 0.4, 0.05, 0.4, 0, 1.36, 0);
  b.cylinder(0x64748b, 0.11, 0.06, 0.25, 0.06, 0.25, { sides: 12 });
  return b.build('cat_tree');
}

export function perch(): THREE.Group {
  const b = new Builder();
  b.cylinder(0x78350f, 0.22, 0.04, 0, 0, 0, { sides: 12 }).cylinder(0x78350f, 0.03, 1.3, 0, 0.04, 0, { sides: 8 }).box(0x92400e, 0.5, 0.04, 0.04, 0, 1.32, 0);
  return b.build('parrot_perch');
}

export function aquarium(): THREE.Group {
  const b = new Builder();
  b.box(0x1f2937, 1.2, 0.7, 0.45, 0, 0, 0).box(0x1f2937, 1.2, 0.05, 0.45, 0, 1.27, 0).box(0xd6c79a, 1.12, 0.06, 0.38, 0, 0.72, 0);
  b.box(0x15803d, 0.04, 0.3, 0.04, -0.4, 0.78, 0.05).box(0x16a34a, 0.04, 0.22, 0.04, 0.35, 0.78, -0.08);
  const g = b.build('aquarium', { roughness: 0.4 });
  // The water and the glass, seen through, so the fish show
  const water = new THREE.Mesh(new THREE.BoxGeometry(1.16, 0.55, 0.41), new THREE.MeshStandardMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.32, roughness: 0.05, metalness: 0.1, depthWrite: false }));
  water.position.set(0, 0.72 + 0.275, 0);
  water.renderOrder = 3;
  g.add(water);
  return g;
}

interface Live { uid: string; kind: PetKind; mesh: THREE.Group; home: THREE.Vector3; wander: THREE.Vector3; bob: number }

export class Pets {
  private static instance: Pets | null = null;
  public static now: () => number = () => Date.now();
  private pets: Record<string, PetSave>;
  private live = new Map<string, Live>();

  public static get(): Pets {
    if (!Pets.instance) Pets.instance = new Pets();
    return Pets.instance;
  }

  private constructor() {
    this.pets = this.load();
  }

  private key(): string {
    return `nl_pets_v1:${Activity.player()}`;
  }

  private load(): Record<string, PetSave> {
    try { return JSON.parse(localStorage.getItem(this.key()) ?? '{}'); } catch { return {}; }
  }

  private save(): void {
    try { localStorage.setItem(this.key(), JSON.stringify(this.pets)); } catch { /* blocked */ }
  }

  /** Which pet lives at this kind of home */
  public static kindFor(modelType: string): PetKind | null {
    return (Object.keys(PET_KINDS) as PetKind[]).find((k) => PET_KINDS[k].home === modelType) ?? null;
  }

  public at(uid: string): PetView | null {
    const p = this.pets[uid];
    if (!p) return null;
    const now = Pets.now();
    const hunger = Math.max(0, Math.round(100 - ((now - p.fedAt) / DAY) * 100));
    const happiness = Math.max(0, Math.round(100 - ((now - p.playedAt) / DAY) * 70 - (100 - hunger) * 0.3));
    const mood = hunger < 30 ? 'Hungry' : happiness < 40 ? 'Lonely' : happiness > 80 ? 'Very happy' : 'Content';
    return { kind: p.kind, name: p.name, hunger, happiness, mood };
  }

  public get count(): number {
    return Object.keys(this.pets).length;
  }

  public adopt(uid: string, kind: PetKind): string | null {
    if (this.pets[uid] || this.count >= 3) return null;
    const names = PET_KINDS[kind].names;
    const taken = new Set(Object.values(this.pets).map((p) => p.name));
    const name = names.find((n) => !taken.has(n)) ?? names[0];
    const now = Pets.now();
    this.pets[uid] = { kind, name, fedAt: now, playedAt: now, adoptedAt: now };
    this.save();
    return name;
  }

  public feed(uid: string): boolean {
    const p = this.pets[uid];
    if (!p) return false;
    p.fedAt = Pets.now();
    this.save();
    return true;
  }

  public play(uid: string): boolean {
    const p = this.pets[uid];
    if (!p) return false;
    p.playedAt = Pets.now();
    this.save();
    const l = this.live.get(uid);
    if (l) l.bob = -1;
    return true;
  }

  /** The piece is gone (sold or put away): the pet goes to a new home with a friend */
  public forget(uid: string): void {
    const l = this.live.get(uid);
    l?.mesh.removeFromParent();
    this.live.delete(uid);
    if (!this.pets[uid]) return;
    delete this.pets[uid];
    this.save();
  }

  /** Puts each pet in the house beside its home piece (positions in the house's own space) */
  public ensure(uid: string, homeMesh: THREE.Object3D, room: THREE.Object3D, home: THREE.Vector3): void {
    const p = this.pets[uid];
    const l = this.live.get(uid);
    if (!p) { if (l) { l.mesh.removeFromParent(); this.live.delete(uid); } return; }
    if (l) { l.home.copy(home); return; }
    let mesh: THREE.Group;
    if (p.kind === 'dog') mesh = dogModel();
    else if (p.kind === 'cat') mesh = catModel();
    else if (p.kind === 'parrot') mesh = parrotModel();
    else {
      mesh = new THREE.Group();
      [0xf97316, 0xfacc15, 0x3b82f6, 0xef4444].forEach((c, i) => { const f = fishModel(c); f.position.set(-0.4 + i * 0.26, 0.85 + (i % 2) * 0.2, 0); mesh.add(f); });
    }
    mesh.name = `pet ${p.name}`;
    if (p.kind === 'parrot') { mesh.position.set(0, 1.36, 0); homeMesh.add(mesh); }
    else if (p.kind === 'fish') homeMesh.add(mesh);
    else { mesh.position.copy(home).add(new THREE.Vector3(0.9, 0, 0.9)); room.add(mesh); }
    this.live.set(uid, { uid, kind: p.kind, mesh, home: home.clone(), wander: home.clone(), bob: 0 });
  }

  /**
   * The dog and the cat come to the player and keep a step away, or wander near home when the
   * player is far; the parrot bobs; the fish swim. `free` says whether a spot in the house can be stood on.
   */
  public update(delta: number, player: THREE.Vector3 | null, free: (x: number, z: number) => boolean, time: number): void {
    for (const l of this.live.values()) {
      if (!l.mesh.parent) continue;
      if (l.kind === 'parrot') { l.mesh.position.y = 1.36 + Math.abs(Math.sin(time * 3)) * 0.03; l.mesh.rotation.y = Math.sin(time * 0.7) * 0.8; continue; }
      if (l.kind === 'fish') {
        l.mesh.children.forEach((f, i) => { f.position.x = Math.sin(time * (0.6 + i * 0.17) + i) * 0.45; f.rotation.y = Math.cos(time * (0.6 + i * 0.17) + i) > 0 ? Math.PI / 2 : -Math.PI / 2; });
        continue;
      }
      const pos = l.mesh.position;
      const near = player && Math.hypot(player.x - pos.x, player.z - pos.z) < 9;
      let target = l.wander;
      if (near && player) target = player;
      else if (Math.hypot(l.wander.x - pos.x, l.wander.z - pos.z) < 0.3 || Math.random() < delta * 0.1) {
        l.wander = l.home.clone().add(new THREE.Vector3((Math.random() - 0.5) * 3, 0, (Math.random() - 0.5) * 3));
      }
      const dx = target.x - pos.x;
      const dz = target.z - pos.z;
      const d = Math.hypot(dx, dz);
      const stop = target === player ? 1.2 : 0.2;
      const tail = l.mesh.getObjectByName('tail');
      if (tail) tail.rotation.y = Math.sin(time * (near ? 14 : 4)) * 0.5;
      if (d > stop) {
        const step = Math.min(d - stop, (l.kind === 'dog' ? 2.6 : 2.0) * delta);
        const nx = pos.x + (dx / d) * step;
        const nz = pos.z + (dz / d) * step;
        // Off a spot that counts as taken (beside its own kennel) it may always step; otherwise round what is in the way
        if (!free(pos.x, pos.z) || free(nx, nz)) { pos.x = nx; pos.z = nz; }
        else if (free(nx, pos.z)) pos.x = nx;
        else if (free(pos.x, nz)) pos.z = nz;
        l.mesh.rotation.y = Math.atan2(dx, dz);
        l.mesh.position.y = Math.abs(Math.sin(time * 12)) * 0.03;
      } else {
        l.mesh.position.y = 0;
        if (player) l.mesh.rotation.y = Math.atan2(player.x - pos.x, player.z - pos.z);
      }
      // A jump for joy when played with
      if (l.bob < 0) { l.bob = 0.6; }
      if (l.bob > 0) { l.bob = Math.max(0, l.bob - delta); l.mesh.position.y = Math.sin((0.6 - l.bob) / 0.6 * Math.PI) * 0.4; }
    }
  }

  public liveMesh(uid: string): THREE.Object3D | null {
    return this.live.get(uid)?.mesh ?? null;
  }
}
