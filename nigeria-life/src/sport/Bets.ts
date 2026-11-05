import { BackendService } from '../backend/BackendService';
import { OnlineAccount } from '../online/OnlineAccount';
import { Activity } from '../life/Activity';
import { fixture, odds, result, won, slotAt, openSeed, LiveMatch, PICKS, type Fixture, type Pick } from './League';

/**
 * Naija Odds behind the phone: the match on now (kept in step with the clock so the screen at
 * Oga Sunday's, the television at home and the app all show the same one), the bets the player
 * has placed, and paying them out at full time.
 *
 * Playing alone, the game keeps the bets and pays them. Online, the world server holds the
 * stake, keeps each match's seed secret until kick-off, and pays winners itself; the game asks.
 */

export interface PlacedBet {
  id: string;
  slot: number;
  pick: Pick;
  stake: number;
  price: number;
  status: 'open' | 'won' | 'lost';
  score: [number, number] | null;
  placedAt: number;
}

const AHEAD = 4;
const MAX_OPEN = 8;
export const MIN_STAKE = 100;
export const MAX_STAKE = 10_000_000;

export const pickLabel = (pick: Pick, f: Fixture) =>
  pick === '1' ? `${f.home.name} to win` : pick === '2' ? `${f.away.name} to win` : PICKS.find((p) => p.id === pick)!.label;

export class Bets {
  private static instance: Bets | null = null;
  public static get(): Bets {
    if (!Bets.instance) Bets.instance = new Bets();
    return Bets.instance;
  }
  /** Tells the player when a bet comes in (set by the game) */
  public static tell: (text: string) => void = () => undefined;
  /** The clock, so tests can move it */
  public static now: () => number = () => Date.now();

  private local: PlacedBet[] = [];
  private remote: PlacedBet[] | null = null;
  private readonly seeds = new Map<number, number>();
  private live: LiveMatch | null = null;
  private fetching: Promise<void> | null = null;
  private fetchedAt = 0;
  private readonly told = new Set<string>();
  private readonly listeners: Array<() => void> = [];

  private constructor() {
    this.local = this.load();
    for (const bet of this.local) if (bet.status !== 'open') this.told.add(bet.id);
    // Bets come in at full time whether or not the phone is open
    window.setInterval(() => this.tick(), 5000);
  }

  private key(): string {
    return `nl_bets_v1:${Activity.player()}`;
  }

  private load(): PlacedBet[] {
    try {
      const raw = localStorage.getItem(this.key());
      if (raw) return JSON.parse(raw) as PlacedBet[];
    } catch { /* fresh */ }
    return [];
  }

  private save(): void {
    try { localStorage.setItem(this.key(), JSON.stringify(this.local.slice(0, 60))); } catch { /* blocked */ }
  }

  public subscribe(listener: () => void): () => void {
    this.listeners.push(listener);
    return () => { const i = this.listeners.indexOf(listener); if (i >= 0) this.listeners.splice(i, 1); };
  }

  private changed(): void {
    for (const l of this.listeners) l();
  }

  public get online(): boolean {
    return OnlineAccount.get() !== null;
  }

  /** The seed of a match, or null while it has not kicked off (online the server says, once it has) */
  public seedOf(slot: number): number | null {
    if (fixture(slot).kickoff > Bets.now()) return null;
    if (!this.online) return openSeed(slot);
    const seed = this.seeds.get(slot);
    if (seed === undefined) void this.refresh();
    return seed ?? null;
  }

  /** Asks the server for the bets and the seeds of the matches that have kicked off */
  public refresh(force = false): Promise<void> {
    const online = OnlineAccount.get();
    if (!online) return Promise.resolve();
    if (this.fetching) return this.fetching;
    if (!force && Bets.now() - this.fetchedAt < 4000) return Promise.resolve();
    this.fetching = (async () => {
      try {
        const got = await online.request('/bets/mine');
        if (got?.ok) {
          for (const [slot, seed] of Object.entries(got.seeds ?? {})) this.seeds.set(Number(slot), Number(seed));
          this.remote = (got.bets ?? []) as PlacedBet[];
          this.fetchedAt = Bets.now();
          this.announce(this.remote);
          this.changed();
        }
      } finally {
        this.fetching = null;
      }
    })();
    return this.fetching;
  }

  /** The bets, newest first */
  public mine(): PlacedBet[] {
    if (this.online) {
      void this.refresh();
      return this.remote ?? [];
    }
    return this.local;
  }

  public open(): PlacedBet[] {
    return this.mine().filter((bet) => bet.status === 'open');
  }

  /** The matches that can still be backed: the next few kick-offs */
  public upcoming(): Fixture[] {
    const now = Bets.now();
    const out: Fixture[] = [];
    for (let slot = slotAt(now) + 1; slot <= slotAt(now) + AHEAD; slot++) out.push(fixture(slot));
    return out;
  }

  /** The match on the screens now, in step with the clock; or the next one if it is the break */
  public now(): { fixture: Fixture; match: LiveMatch | null; phase: 'live' | 'full-time' | 'waiting' } {
    const now = Bets.now();
    const f = fixture(slotAt(now));
    const seed = this.seedOf(f.slot);
    if (seed === null) return { fixture: f, match: null, phase: 'waiting' };
    if (!this.live || this.live.fixture.slot !== f.slot) this.live = new LiveMatch(f, seed);
    this.live.catchUp(now);
    return { fixture: f, match: this.live, phase: now >= f.end ? 'full-time' : 'live' };
  }

  /** The last few results, newest first (those whose seeds are known) */
  public results(count = 6): Array<{ fixture: Fixture; score: [number, number] }> {
    const now = Bets.now();
    const out: Array<{ fixture: Fixture; score: [number, number] }> = [];
    for (let slot = slotAt(now) - 1; slot >= slotAt(now) - 8 && out.length < count; slot--) {
      const f = fixture(slot);
      const seed = this.seedOf(slot);
      if (seed !== null && f.end <= now) out.push({ fixture: f, score: result(f, seed) });
    }
    return out;
  }

  /** Places a bet: the stake leaves the bank now. Returns why not, or null. */
  public async place(slot: number, pick: Pick, stake: number): Promise<string | null> {
    const now = Bets.now();
    stake = Math.floor(stake);
    if (slot <= slotAt(now) || slot > slotAt(now) + AHEAD) return 'Bets close at kick-off. Pick one of the next matches.';
    if (!Number.isFinite(stake) || stake < MIN_STAKE || stake > MAX_STAKE) return `Stakes are from ₦${MIN_STAKE.toLocaleString()} to ₦${MAX_STAKE.toLocaleString()}.`;
    const online = OnlineAccount.get();
    if (online) {
      const done = await online.request('/bets/place', { slot, pick, stake });
      if (!done?.ok) return done?.reason ?? 'The bet could not be placed.';
      await this.refresh(true);
      return null;
    }
    if (this.open().length >= MAX_OPEN) return `You have ${MAX_OPEN} bets running. Wait for some to finish.`;
    const f = fixture(slot);
    const price = odds(f)[pick];
    const paid = BackendService.getInstance().processTransaction({
      type: 'TRANSFER_OUT', amount: stake, description: `Naija Odds: ${f.home.short} v ${f.away.short}, ${pickLabel(pick, f)} @ ${price.toFixed(2)}`, source: 'bank', funding: 'strict',
    });
    if (!paid.success) return `Your bank does not have ₦${stake.toLocaleString()} for that stake.`;
    this.local.unshift({ id: `bet_${now.toString(36)}${Math.floor(Math.random() * 1e6).toString(36)}`, slot, pick, stake, price, status: 'open', score: null, placedAt: now });
    this.save();
    this.changed();
    return null;
  }

  /** Every so often: bets on finished matches are paid (alone), or fetched (online) */
  public tick(): void {
    if (this.online) {
      if (this.remote?.some((bet) => bet.status === 'open' && fixture(bet.slot).end <= Bets.now())) void this.refresh();
      return;
    }
    const now = Bets.now();
    let any = false;
    for (const bet of this.local) {
      if (bet.status !== 'open') continue;
      const f = fixture(bet.slot);
      if (f.end > now) continue;
      const score = result(f, openSeed(bet.slot));
      bet.score = score;
      bet.status = won(bet.pick, score) ? 'won' : 'lost';
      any = true;
      // Marked first and kept, then paid: a reload cannot pay it twice
      this.save();
      if (bet.status === 'won') {
        BackendService.getInstance().processTransaction({ type: 'WINNINGS', amount: Math.floor(bet.stake * bet.price), description: `Naija Odds: won on ${f.home.short} ${score[0]}-${score[1]} ${f.away.short}`, source: 'bank' });
      }
    }
    if (any) {
      this.announce(this.local);
      this.changed();
    }
  }

  private announce(bets: PlacedBet[]): void {
    for (const bet of bets) {
      if (bet.status === 'open' || this.told.has(bet.id)) continue;
      this.told.add(bet.id);
      if (bet.placedAt < Bets.now() - 3_600_000) continue;
      const f = fixture(bet.slot);
      const line = `${f.home.name} ${bet.score?.[0] ?? 0}-${bet.score?.[1] ?? 0} ${f.away.name}`;
      Bets.tell(bet.status === 'won' ? `⚽ Your bet won! ₦${Math.floor(bet.stake * bet.price).toLocaleString()} paid into your bank. ${line}` : `⚽ Full time: ${line}. Your bet on ${pickLabel(bet.pick, f)} lost.`);
      Activity.emit({ kind: 'game', game: 'bet', won: bet.status === 'won', stake: bet.stake });
    }
  }

  /** For tests: forget the bets kept on this device */
  public clear(): void {
    this.local = [];
    this.save();
    this.changed();
  }
}
