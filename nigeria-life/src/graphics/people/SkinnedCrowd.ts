import * as THREE from 'three';
import type { CharacterConfig } from '../../player/CharacterCustomization';
import { applyStreetLook, loadSkinnedCharacter, type SkinnedCharacterHandle, type StreetLook } from './SkinnedCharacter';

/**
 * The street people nearest the player, drawn as full character models (the player's own build:
 * faces, hair, clothes on a skeleton, walk and talk clips) in place of the light procedural figures.
 * Everyone further away stays procedural, so a busy street still costs little on a modest phone.
 *
 * Each frame the crowd offers who is near and in view; the pool takes the closest few, matches each
 * one's place, heading, size, look and what they are doing, and tells the crowd not to draw them.
 */
export interface CrowdOffer {
  /** The walker's id in its crowd */
  id: number;
  look: StreetLook;
  /** Where their look came from (a model is only re-dressed when this changes) */
  lookKey: number;
  x: number;
  y: number;
  z: number;
  yaw: number;
  scale: number;
  /** What they are doing; null when something else (an Actor's scripted pose) animates the model */
  mode: 'walk' | 'idle' | 'talk' | 'dance' | null;
  /** Squared distance from the player */
  d2: number;
  /**
   * A character with a place of their own (a named person's group): the model goes inside it and
   * follows it, and x, y, z, yaw and scale are ignored
   */
  parent?: THREE.Object3D;
}

interface Slot {
  handle: SkinnedCharacterHandle | null;
  holder: THREE.Group;
  gender: 'male' | 'female';
  /** The walker shown, or -1 */
  id: number;
  lookKey: number;
}

export class SkinnedCrowd {
  /** How many near people are drawn as models (set by the graphics setting: more on a strong device) */
  public static limit = 6;
  /** How near (metres) someone must be to be drawn as a model */
  public static reach = 16;

  private readonly slots: Slot[] = [];
  private readonly byId = new Map<number, Slot>();
  private offers: CrowdOffer[] = [];
  private loading = 0;

  private readonly group: THREE.Group;

  constructor(group: THREE.Group) {
    this.group = group;
  }

  public get reach2(): number {
    return SkinnedCrowd.reach * SkinnedCrowd.reach;
  }

  /** Is this walker drawn as a model this frame (so the crowd leaves it out)? */
  public has(id: number): boolean {
    return this.byId.has(id);
  }

  /** The model drawn for this walker, if any (an Actor directs it through this) */
  public handleOf(id: number): SkinnedCharacterHandle | null {
    return this.byId.get(id)?.handle ?? null;
  }

  public offer(o: CrowdOffer): void {
    this.offers.push(o);
  }

  /** Assigns models to the nearest walkers offered this frame, places and animates them */
  public sync(delta: number): void {
    const limit = Math.max(0, SkinnedCrowd.limit);
    const chosen = this.offers.sort((a, b) => a.d2 - b.d2).slice(0, limit);
    const wanted = new Map(chosen.map((o) => [o.id, o]));

    // Those no longer among the nearest give their model back
    for (const slot of this.slots) {
      if (slot.id >= 0 && !wanted.has(slot.id)) {
        this.byId.delete(slot.id);
        slot.id = -1;
        slot.holder.visible = false;
      }
    }
    // Newcomers take a free model of their gender (made the first time it is needed)
    for (const o of chosen) {
      let slot = this.byId.get(o.id);
      if (!slot) {
        slot = this.slots.find((s) => s.id < 0 && s.handle && s.gender === o.look.gender);
        if (!slot) {
          this.make(o.look.gender, limit);
          continue;
        }
        slot.id = o.id;
        this.byId.set(o.id, slot);
      }
      const handle = slot.handle!;
      if (slot.lookKey !== o.lookKey) {
        applyStreetLook(handle.root, o.look);
        slot.lookKey = o.lookKey;
      }
      slot.holder.visible = true;
      if (o.parent) {
        // Inside the character's own group: it carries the model wherever it goes
        if (slot.holder.parent !== o.parent) o.parent.add(slot.holder);
        slot.holder.position.set(0, 0, 0);
        slot.holder.rotation.set(0, 0, 0);
        slot.holder.scale.setScalar(1);
      } else {
        if (slot.holder.parent !== this.group) this.group.add(slot.holder);
        slot.holder.position.set(o.x, o.y, o.z);
        slot.holder.rotation.set(0, o.yaw, 0);
        slot.holder.scale.setScalar(o.scale);
      }
      if (o.mode) handle.play(o.mode, 0.3);
      handle.update(delta);
    }
    this.offers = [];
  }

  /** Hides every model (a city left, the crowd hidden) */
  public clear(): void {
    for (const slot of this.slots) {
      slot.id = -1;
      slot.holder.visible = false;
    }
    this.byId.clear();
    this.offers = [];
  }

  /** Loads one more model of this gender, if the pool is not already as big as allowed */
  private make(gender: 'male' | 'female', limit: number): void {
    const ofGender = this.slots.filter((s) => s.gender === gender).length;
    if (this.loading > 0 || ofGender >= limit) return;
    this.loading += 1;
    const holder = new THREE.Group();
    holder.name = `crowd_model_${gender}`;
    holder.visible = false;
    const slot: Slot = { handle: null, holder, gender, id: -1, lookKey: -1 };
    this.slots.push(slot);
    this.group.add(holder);
    void loadSkinnedCharacter(gender, { gender } as CharacterConfig)
      .then((handle) => {
        if (!handle) return;
        // Drawn on the crowd's own layers, so it shows wherever the crowd shows
        handle.root.traverse((o) => { o.layers.mask = this.group.layers.mask; });
        holder.add(handle.root);
        slot.handle = handle;
      })
      .finally(() => {
        this.loading -= 1;
      });
  }
}
