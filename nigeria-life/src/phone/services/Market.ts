import { BackendService } from '../../backend/BackendService';

/** A share on the game's own exchange. None of these is a real company or a real market. */
export interface Share {
  ticker: string;
  name: string;
  sector: string;
  icon: string;
  /** The price it moves around */
  base: number;
  /** How far it swings either side of that, as a share of the price */
  swing: number;
  risk: 'Low' | 'Medium' | 'High';
  /** What makes its ups and downs its own */
  phase: [number, number, number];
}

export const SHARES: Share[] = [
  { ticker: 'FGNB', name: 'Federal Savings Bond', sector: 'Government bond', icon: '🏛️', base: 1000, swing: 0.02, risk: 'Low', phase: [0.4, 2.1, 5.2] },
  { ticker: 'EKOB', name: 'Eko Commercial Bank', sector: 'Banking', icon: '🏦', base: 420, swing: 0.09, risk: 'Low', phase: [1.3, 0.2, 3.9] },
  { ticker: 'DNGC', name: 'Dangana Cement', sector: 'Building materials', icon: '🧱', base: 2600, swing: 0.14, risk: 'Medium', phase: [2.6, 4.4, 1.1] },
  { ticker: 'NJPT', name: 'NaijaPetro', sector: 'Oil & gas', icon: '🛢️', base: 880, swing: 0.2, risk: 'Medium', phase: [4.9, 1.7, 0.3] },
  { ticker: 'KUDI', name: 'KudiPoint', sector: 'Fintech', icon: '📲', base: 150, swing: 0.34, risk: 'High', phase: [0.9, 3.3, 2.4] },
  { ticker: 'AFBT', name: 'AfroBeat Media', sector: 'Entertainment', icon: '🎵', base: 64, swing: 0.42, risk: 'High', phase: [3.7, 5.6, 4.5] },
];

/** The broker keeps this much of every trade, each way. */
export const FEE_RATE = 0.015;

/**
 * The game's stock market. A share's price depends only on which share it is and what time
 * it is on the game's clock, so it is the same before and after a reload and cannot be
 * re-rolled. Buying and selling go through the bank account, with a fee each way.
 */
export class Market {
  private readonly backend = BackendService.getInstance();
  private clock: () => number = () => 0;

  /** `clock` gives the hours gone by on the game's clock since the game began. */
  public connect(clock: () => number): void {
    this.clock = clock;
  }

  public share(ticker: string): Share | null {
    return SHARES.find((entry) => entry.ticker === ticker) ?? null;
  }

  /** What one unit costs at an hour on the game's clock (now, if not given). */
  public price(share: Share, hours: number = this.clock()): number {
    const [a, b, c] = share.phase;
    const wave = 0.55 * Math.sin(hours / 31 + a) + 0.3 * Math.sin(hours / 9.7 + b) + 0.15 * Math.sin(hours / 2.3 + c);
    // A slow climb over the long run, as markets tend to
    const growth = 1 + Math.min(0.5, hours / 24 / 400);
    return Math.max(1, Math.round(share.base * growth * (1 + share.swing * wave)));
  }

  /** How the price has moved over the last `span` hours, as a share of the price then. */
  public change(share: Share, span = 24): number {
    const then = this.price(share, this.clock() - span);
    return (this.price(share) - then) / then;
  }

  /** Prices over the last two days, oldest first, for a small chart. */
  public history(share: Share, points = 24, span = 48): number[] {
    const now = this.clock();
    const out: number[] = [];
    for (let i = points - 1; i >= 0; i--) out.push(this.price(share, now - (span * i) / (points - 1)));
    return out;
  }

  public costToBuy(share: Share, units: number): number {
    return Math.ceil(this.price(share) * units * (1 + FEE_RATE));
  }

  public proceedsFromSale(share: Share, units: number): number {
    return Math.floor(this.price(share) * units * (1 - FEE_RATE));
  }

  public holding(ticker: string): { units: number; spent: number } {
    return this.backend.getData().investments?.[ticker] ?? { units: 0, spent: 0 };
  }

  /** Everything held, valued at what it would fetch now. */
  public portfolio(): { value: number; spent: number; lines: Array<{ share: Share; units: number; spent: number; value: number }> } {
    const lines = [];
    let value = 0;
    let spent = 0;
    for (const share of SHARES) {
      const held = this.holding(share.ticker);
      if (held.units <= 0) continue;
      const worth = this.proceedsFromSale(share, held.units);
      lines.push({ share, units: held.units, spent: held.spent, value: worth });
      value += worth;
      spent += held.spent;
    }
    return { value, spent, lines };
  }

  public buy(ticker: string, units: number): { success: boolean; message: string } {
    const share = this.share(ticker);
    if (!share) return { success: false, message: 'That share is not listed.' };
    if (!Number.isInteger(units) || units <= 0) return { success: false, message: 'Enter a whole number of units.' };
    return this.backend.tradeInvestment(ticker, units, this.costToBuy(share, units), 'buy', `${share.ticker} unit${units === 1 ? '' : 's'}`);
  }

  public sell(ticker: string, units: number): { success: boolean; message: string } {
    const share = this.share(ticker);
    if (!share) return { success: false, message: 'That share is not listed.' };
    if (!Number.isInteger(units) || units <= 0) return { success: false, message: 'Enter a whole number of units.' };
    return this.backend.tradeInvestment(ticker, units, this.proceedsFromSale(share, units), 'sell', `${share.ticker} unit${units === 1 ? '' : 's'}`);
  }
}
