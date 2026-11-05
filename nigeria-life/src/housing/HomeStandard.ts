/**
 * How well a home comes furnished: what the player can afford to rent or own decides what is in
 * it when they move in. A room let for a couple of hundred thousand a month comes with a foam,
 * a small television and plastic chairs; a mansion comes with the lot. Anything more is bought
 * from the catalogue.
 */
export type HomeStandard = 'basic' | 'comfortable' | 'luxury';

export interface HomeLike {
  status: string;
  ownerId?: string;
  type?: string;
  purchasePrice?: number;
  rentalPriceMonthly?: number;
}

/** Not somewhere to live */
const NOT_HOMES = new Set(['office', 'shop', 'business', 'warehouse', 'land', 'commercial']);

export function standardOf(properties: readonly HomeLike[], playerId: string, otherHome: boolean): HomeStandard {
  let best: HomeStandard | null = null;
  const rank = { basic: 0, comfortable: 1, luxury: 2 } as const;
  const consider = (s: HomeStandard) => {
    if (!best || rank[s] > rank[best]) best = s;
  };
  for (const p of properties) {
    if (p.ownerId !== playerId || (p.status !== 'owned' && p.status !== 'rented')) continue;
    if (p.type && NOT_HOMES.has(p.type)) continue;
    if (p.status === 'owned') {
      const price = p.purchasePrice ?? 0;
      consider(price >= 150_000_000 ? 'luxury' : price >= 30_000_000 ? 'comfortable' : 'basic');
    } else {
      const rent = p.rentalPriceMonthly ?? 0;
      consider(rent >= 1_500_000 ? 'luxury' : rent >= 400_000 ? 'comfortable' : 'basic');
    }
  }
  // A building of their own on their own land: furnished like an ordinary family home
  if (!best && otherHome) consider('comfortable');
  return best ?? 'basic';
}
