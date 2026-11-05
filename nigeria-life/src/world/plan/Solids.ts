import type { Obstruction } from './CityPlan';

/** What stands on the ground, and whether it is a street lamp (thin, but walked round) */
type Standing = Obstruction & { pole?: boolean };

/**
 * What cannot be walked or driven through in a city: the bodies of its buildings, walls and
 * fences, as rectangles on the ground. It is made from the same list the city plan is checked
 * against, so what the plan says is standing somewhere is what stops someone walking there.
 *
 * Something only stops a person who is coming at it from outside. Anyone who is already
 * inside one (set down there by a journey, or walked in through a door by the game itself)
 * can always walk out.
 */

interface Solid {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

const CELL = 8;

/** Tall enough to be a solid physical obstacle (structures, stalls, bins, street lamps, poles) */
const MIN_SOLID_HEIGHT = 0.65;
const MIN_SOLID_SIZE = 0.20;
/** A street lamp stops a person as if it were this wide */
const POLE_HALF = 0.13;

export class Solids {
  private readonly cells = new Map<string, Solid[]>();
  public readonly count: number;
  /** Every one of them, for whoever needs to lay them out (the way-finder) */
  public readonly all: ReadonlyArray<Readonly<Solid>>;

  constructor(obstructions: Standing[]) {
    let count = 0;
    const all: Solid[] = [];
    this.all = all;
    for (const thing of obstructions) {
      // Kerb edges and ground stripes < 0.65m are stepped over; real physical props & structures block movement
      if (thing.height < MIN_SOLID_HEIGHT) continue;
      const width = thing.maxX - thing.minX;
      const depth = thing.maxZ - thing.minZ;
      let solid: Solid = { minX: thing.minX, maxX: thing.maxX, minZ: thing.minZ, maxZ: thing.maxZ };
      if (Math.max(width, depth) < MIN_SOLID_SIZE) {
        // Something thin is stepped past, except a street lamp: that is walked round
        if (!thing.pole) continue;
        const x = (thing.minX + thing.maxX) / 2;
        const z = (thing.minZ + thing.maxZ) / 2;
        solid = { minX: x - POLE_HALF, maxX: x + POLE_HALF, minZ: z - POLE_HALF, maxZ: z + POLE_HALF };
      }
      count += 1;
      all.push(solid);
      for (let cx = Math.floor(solid.minX / CELL); cx <= Math.floor(solid.maxX / CELL); cx++) {
        for (let cz = Math.floor(solid.minZ / CELL); cz <= Math.floor(solid.maxZ / CELL); cz++) {
          const key = `${cx},${cz}`;
          const list = this.cells.get(key);
          if (list) list.push(solid);
          else this.cells.set(key, [solid]);
        }
      }
    }
    this.count = count;
  }

  /** Everything solid that a circle at this point touches. */
  private touching(x: number, z: number, radius: number, into: Solid[]): Solid[] {
    into.length = 0;
    for (let cx = Math.floor((x - radius) / CELL); cx <= Math.floor((x + radius) / CELL); cx++) {
      for (let cz = Math.floor((z - radius) / CELL); cz <= Math.floor((z + radius) / CELL); cz++) {
        const list = this.cells.get(`${cx},${cz}`);
        if (!list) continue;
        for (const solid of list) {
          if (x + radius > solid.minX && x - radius < solid.maxX && z + radius > solid.minZ && z - radius < solid.maxZ && !into.includes(solid)) into.push(solid);
        }
      }
    }
    return into;
  }

  private readonly now: Solid[] = [];

  /** Is there something solid at this point? */
  public at(x: number, z: number, radius = 0): boolean {
    return this.touching(x, z, radius, this.now).length > 0;
  }

  private blocked(fromX: number, fromZ: number, toX: number, toZ: number, radius: number): boolean {
    /** How far into a solid (grown by the mover's half-width) a point is. Nothing or less means clear of it. */
    const into = (solid: Solid, x: number, z: number) => Math.min(x + radius - solid.minX, solid.maxX - (x - radius), z + radius - solid.minZ, solid.maxZ - (z - radius));
    // Standing inside something already (set down there, or walked in through its door): free to walk
    // out, through whatever else the same building is made of, until they are in the open again
    if (this.touching(fromX, fromZ, 0, this.now).length > 0) return false;
    for (const solid of this.touching(toX, toZ, radius, this.now)) {
      // Brushing against it is allowed; going further into it is not
      if (into(solid, toX, toZ) > Math.max(0, into(solid, fromX, fromZ)) + 1e-4) return true;
    }
    return false;
  }

  /**
   * Where a step from one point toward another ends: all the way if nothing is in the way,
   * along the wall if the wall can be slid along, or not at all. `radius` is half the width
   * of whoever is moving.
   */
  public step(fromX: number, fromZ: number, toX: number, toZ: number, radius: number): { x: number; z: number; stopped: boolean } {
    if (!this.blocked(fromX, fromZ, toX, toZ, radius)) return { x: toX, z: toZ, stopped: false };
    if (toX !== fromX && !this.blocked(fromX, fromZ, toX, fromZ, radius)) return { x: toX, z: fromZ, stopped: false };
    if (toZ !== fromZ && !this.blocked(fromX, fromZ, fromX, toZ, radius)) return { x: fromX, z: toZ, stopped: false };
    return { x: fromX, z: fromZ, stopped: true };
  }
}
