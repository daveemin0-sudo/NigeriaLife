/**
 * Lagos hard currency: US dollars and British pounds in the pocket, bought and sold
 * at a Victoria Island bureau de change. Rates are a game parallel-market spread —
 * not live CBN figures. Naira still moves only through BackendService / TransactionService.
 */

export type HardKind = 'usd' | 'gbp';

/** Naira per unit when the player buys hard currency at the desk (pays NGN, gets $ / £). */
export const FX_BUY: Record<HardKind, number> = {
  usd: 1_600,
  gbp: 2_050,
};

/** Naira per unit when the player sells hard currency (pays $ / £, gets NGN). Spread below buy. */
export const FX_SELL: Record<HardKind, number> = {
  usd: 1_520,
  gbp: 1_950,
};

export const HARD_SYMBOL: Record<HardKind, string> = { usd: '$', gbp: '£' };
export const HARD_NAME: Record<HardKind, string> = { usd: 'US dollars', gbp: 'British pounds' };

/** Desk bundles offered at the bureau. */
export const FX_BUNDLES: ReadonlyArray<{ kind: HardKind; units: number }> = [
  { kind: 'usd', units: 50 },
  { kind: 'usd', units: 100 },
  { kind: 'usd', units: 500 },
  { kind: 'gbp', units: 50 },
  { kind: 'gbp', units: 100 },
];

/** High-roller spray bundles at Ivory Rooftop (Lagos only). */
export const SPRAY_HARD: ReadonlyArray<{ kind: HardKind; units: number; fun: number; social: number }> = [
  { kind: 'usd', units: 100, fun: 35, social: 30 },
  { kind: 'gbp', units: 50, fun: 30, social: 28 },
];

export function formatHard(kind: HardKind, units: number): string {
  return `${HARD_SYMBOL[kind]}${units.toLocaleString()}`;
}

export function buyCost(kind: HardKind, units: number): number {
  return units * FX_BUY[kind];
}

export function sellProceeds(kind: HardKind, units: number): number {
  return units * FX_SELL[kind];
}
