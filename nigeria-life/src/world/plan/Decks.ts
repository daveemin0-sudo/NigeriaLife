/**
 * Raised ground a car can drive on: a ramp up to an airport's departures deck, the deck itself,
 * the floors of a multi-storey car park and the ramps between them. Each belongs to one city and
 * is laid out as a rectangle, flat or rising along one axis. A car stands on the highest surface
 * that is not above it by more than a kerb's step, so it drives under a deck at street level and
 * onto it only up the ramp. Once up, the surfaces' edges hold it: it cannot drive off the side.
 */

export interface Deck {
  city: string;
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  /** Its height at the low end and the high end (the same for a flat deck) */
  y0: number;
  y1: number;
  /** Which way it rises: from minX to maxX ('+x'), maxX to minX ('-x'), likewise in z */
  rises?: '+x' | '-x' | '+z' | '-z';
}

const DECKS: Deck[] = [];
/** Things standing up on the decks (parked cars): solid to a car on the same floor */
const BLOCKS: Array<{ city: string; minX: number; maxX: number; minZ: number; maxZ: number; y: number }> = [];
/** How far above the car a surface may be and still be driven onto (a ramp's foot, a kerb) */
const STEP = 0.9;

export const Decks = {
  add(deck: Deck): void {
    DECKS.push(deck);
  },

  /** Takes away a city's surfaces (when it is built again) */
  clear(city: string): void {
    for (let i = DECKS.length - 1; i >= 0; i--) if (DECKS[i].city === city) DECKS.splice(i, 1);
    for (let i = BLOCKS.length - 1; i >= 0; i--) if (BLOCKS[i].city === city) BLOCKS.splice(i, 1);
  },

  /** Something solid standing on a deck at height `y` */
  block(city: string, minX: number, maxX: number, minZ: number, maxZ: number, y: number): void {
    BLOCKS.push({ city, minX, maxX, minZ, maxZ, y });
  },

  /** The height of one surface at a point, or null off it */
  heightOn(d: Deck, x: number, z: number): number | null {
    if (x < d.minX || x > d.maxX || z < d.minZ || z > d.maxZ) return null;
    if (!d.rises || d.y0 === d.y1) return d.y0;
    const t = d.rises === '+x' ? (x - d.minX) / (d.maxX - d.minX)
      : d.rises === '-x' ? (d.maxX - x) / (d.maxX - d.minX)
        : d.rises === '+z' ? (z - d.minZ) / (d.maxZ - d.minZ)
          : (d.maxZ - z) / (d.maxZ - d.minZ);
    return d.y0 + (d.y1 - d.y0) * t;
  },

  /** The surface a car at height `y` stands on here (0 for the ground when there is none) */
  surfaceAt(city: string, x: number, z: number, y = 0): number {
    let best = 0;
    for (const d of DECKS) {
      if (d.city !== city) continue;
      const h = Decks.heightOn(d, x, z);
      if (h !== null && h <= y + STEP && h > best) best = h;
    }
    return best;
  },

  /** Is a car at height `y` up on raised ground (not on the street)? */
  up(city: string, x: number, z: number, y: number): boolean {
    for (const d of DECKS) {
      if (d.city !== city || Math.max(d.y0, d.y1) < 0.6) continue;
      const h = Decks.heightOn(d, x, z);
      if (h !== null && Math.abs(h - y) <= STEP) return true;
    }
    return false;
  },

  /** Can a car up at height `y` go on to this point (there is a surface there within a step of it)? */
  canGo(city: string, x: number, z: number, y: number): boolean {
    for (const b of BLOCKS) if (b.city === city && Math.abs(b.y - y) < 1.5 && x > b.minX && x < b.maxX && z > b.minZ && z < b.maxZ) return false;
    for (const d of DECKS) {
      if (d.city !== city) continue;
      const h = Decks.heightOn(d, x, z);
      if (h !== null && Math.abs(h - y) <= STEP) return true;
    }
    // Off the low end of a ramp: back on the street
    return y < STEP;
  },

  /** For the tests: every surface of a city */
  list(city: string): readonly Deck[] {
    return DECKS.filter((d) => d.city === city);
  },
};
