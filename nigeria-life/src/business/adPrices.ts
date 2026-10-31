/**
 * What a billboard on the expressway costs to rent, in one plain table with no imports, so the
 * game and the world server charge the same. A board is named by where it stands and which face:
 * `board-<metres along the road>-<a|b>`, `a` the face turned to the traffic, `b` the one behind.
 * Prices are Lagos unipole prices for a day: dearest on the Island, then Ikeja, cheapest between.
 */

export const AD_DAYS = [1, 7, 30] as const;
export type AdDays = (typeof AD_DAYS)[number];

/** The days paid for, for each length of rental: a week is six days' price, a month twenty-two */
const PAID_DAYS: Record<AdDays, number> = { 1: 1, 7: 6, 30: 22 };

export const DAY_MS = 86_400_000;

/** How much a board lifts the takings of the business it advertises, and the most any business gets */
export const AD_LIFT = 0.08;
export const AD_LIFT_MOST = 0.32;

export const AD_COLOURS = ['#0b7a43', '#0f172a', '#b91c1c', '#1d4ed8', '#7c3aed', '#c2410c', '#be185d', '#a16207'];

export function parseBoard(id: string): { z: number; face: 'a' | 'b' } | null {
  const m = /^board-(\d{2,5})-(a|b)$/.exec(id);
  if (!m) return null;
  return { z: Number(m[1]), face: m[2] as 'a' | 'b' };
}

/** One day on this board */
export function dayRate(id: string): number {
  const board = parseBoard(id);
  if (!board) return 0;
  const where = board.z < 1000 ? 2 : board.z >= 4110 ? 1.5 : 1;
  const face = board.face === 'a' ? 1 : 0.6;
  return Math.round((150_000 * where * face) / 1000) * 1000;
}

export function adPrice(id: string, days: AdDays): number {
  return dayRate(id) * PAID_DAYS[days];
}
