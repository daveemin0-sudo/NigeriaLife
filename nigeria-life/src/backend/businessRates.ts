/**
 * What businesses cost and take, in one plain table with no imports, so the game and the game
 * server read the same numbers: the game to pay a business's takings, the server to know how
 * much a player's businesses can honestly have taken since they were last paid.
 */

/** Businesses for sale: what the going concern costs */
export const BUSINESS_PRICES: Record<string, number> = {
  biz_pos_kiosk: 2_500_000,
  biz_barber: 6_000_000,
  biz_mama_put: 8_000_000,
  biz_pharmacy: 25_000_000,
  biz_mechanic: 18_000_000,
  biz_slot: 30_000_000,
  biz_bet_lounge: 40_000_000,
  biz_danfo_fleet: 60_000_000,
  biz_oando: 450_000_000,
  biz_supermarket: 20_000_000,
};

/**
 * What a business takes in one payout, as a share of its price: about 4% of the price in a game
 * day before staff, wages, rent and tax. A fully staffed ₦8m buka nets about ₦300k a game day
 * after wages and tax, and pays for itself in about 25 game days (four hours or so of play).
 */
export const TAKINGS_PER_PAYOUT = 0.003;

/** A payout every 45 seconds of real time */
export const PAYOUT_MS = 45_000;

/**
 * The most a business can take against its own base takings: upgrades, every role staffed, and
 * a branch in every part of Lagos (a supermarket's full shelves sell for more than its price
 * suggests). The server allows up to this, and holds anything beyond for a person to look at.
 */
export const MOST_TAKINGS_FACTOR: Record<string, number> = { biz_supermarket: 20 };
export const MOST_TAKINGS_DEFAULT = 14;

/** The most a business can honestly take in this many milliseconds */
export function mostTaken(bizId: string, ms: number): number {
  const price = BUSINESS_PRICES[bizId] ?? 0;
  return price * TAKINGS_PER_PAYOUT * (MOST_TAKINGS_FACTOR[bizId] ?? MOST_TAKINGS_DEFAULT) * (ms / PAYOUT_MS);
}
