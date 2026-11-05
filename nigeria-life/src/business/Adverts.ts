import { BackendService } from '../backend/BackendService';
import { OnlineAccount } from '../online/OnlineAccount';
import { Activity } from '../life/Activity';
import { Billboards, type BoardFace } from '../world/expressway/Billboards';
import { ROADSIDE } from '../world/expressway/layout';
import { PLACE_SPECS } from '../interiors/places/PlaceSpecs';
import { adPrice, AD_LIFT, AD_LIFT_MOST, DAY_MS, type AdDays } from './adPrices';

/**
 * Eko Ads behind the phone: billboards on the expressway rented by the day, the week or the
 * month, the advert painted on the board in the city for as long as it is paid for. An advert
 * for a business the player owns brings it custom (its takings go up a little per board).
 *
 * Playing alone the rentals are the player's own. Online the world server keeps them, so every
 * player driving down the road sees every advert, and a board taken by someone is taken.
 */

export interface Rental {
  board: string;
  headline: string;
  line: string;
  colour: string;
  /** The business it advertises, if one of the player's */
  business: string | null;
  until: number;
  by: string;
  mine: boolean;
}

export type BoardState = { face: BoardFace; near: string; km: string; rental: Rental | null };

const MAX_HEADLINE = 22;
const MAX_LINE = 40;

export class Adverts {
  private static instance: Adverts | null = null;
  public static get(): Adverts {
    if (!Adverts.instance) Adverts.instance = new Adverts();
    return Adverts.instance;
  }
  public static now: () => number = () => Date.now();

  private local: Rental[] = [];
  private remote: Rental[] | null = null;
  private fetchedAt = 0;
  private fetching: Promise<void> | null = null;
  private readonly listeners: Array<() => void> = [];

  private constructor() {
    this.local = this.load();
    window.setInterval(() => this.tick(), 30_000);
    this.tick();
  }

  private key(): string {
    return `nl_ads_v1:${Activity.player()}`;
  }

  private load(): Rental[] {
    try {
      const raw = localStorage.getItem(this.key());
      if (raw) return JSON.parse(raw) as Rental[];
    } catch { /* fresh */ }
    return [];
  }

  private save(): void {
    try { localStorage.setItem(this.key(), JSON.stringify(this.local)); } catch { /* blocked */ }
  }

  public subscribe(listener: () => void): () => void {
    this.listeners.push(listener);
    return () => { const i = this.listeners.indexOf(listener); if (i >= 0) this.listeners.splice(i, 1); };
  }

  public get online(): boolean {
    return OnlineAccount.get() !== null;
  }

  /** The adverts up now, everyone's */
  public rentals(): Rental[] {
    const now = Adverts.now();
    return (this.online ? this.remote ?? [] : this.local).filter((r) => r.until > now);
  }

  public mine(): Rental[] {
    return this.rentals().filter((r) => r.mine);
  }

  /** Every board on the road, where it is and who has it */
  public boards(): BoardState[] {
    const up = new Map(this.rentals().map((r) => [r.board, r]));
    return Billboards.all().map((face) => ({ face, near: nearTo(face.z), km: `km ${(face.z / 1000).toFixed(1)}`, rental: up.get(face.id) ?? null }));
  }

  /** How much the adverts lift a business's takings: 1, or a little more for each board advertising it */
  public lift(businessId: string): number {
    const boards = this.mine().filter((r) => r.business === businessId).length;
    return 1 + Math.min(AD_LIFT_MOST, AD_LIFT * boards);
  }

  /** Rents a board and puts the advert up. Returns why not, or null. */
  public async rent(board: string, days: AdDays, ad: { headline: string; line: string; colour: string; business: string | null }): Promise<string | null> {
    const headline = ad.headline.replace(/\s+/g, ' ').trim().slice(0, MAX_HEADLINE);
    const line = ad.line.replace(/\s+/g, ' ').trim().slice(0, MAX_LINE);
    if (headline.length < 2) return 'Write a headline for the board.';
    if (!Billboards.get(board)) return 'That board is not on the road.';
    const taken = this.rentals().find((r) => r.board === board && !r.mine);
    if (taken) return `@${taken.by} has that board until ${until(taken.until)}.`;
    const price = adPrice(board, days);
    const online = OnlineAccount.get();
    if (online) {
      const done = await online.request('/ads/rent', { board, days, headline, line, colour: ad.colour, business: ad.business });
      if (!done?.ok) return done?.reason ?? 'The board could not be rented.';
      await this.refresh(true);
      return null;
    }
    const paid = BackendService.getInstance().processTransaction({
      type: ad.business ? 'BUSINESS_EXPENSE' : 'SHOP_PURCHASE', amount: price, description: `Eko Ads: billboard ${board} for ${days} day${days === 1 ? '' : 's'}`, source: 'bank', funding: 'strict',
    });
    if (!paid.success) return `Your bank does not have ₦${price.toLocaleString()} for that.`;
    const now = Adverts.now();
    const had = this.local.find((r) => r.board === board && r.until > now);
    const by = BackendService.getInstance().getData().username || 'you';
    this.local = this.local.filter((r) => r.board !== board && r.until > now);
    this.local.push({ board, headline, line, colour: ad.colour, business: ad.business, until: (had?.until ?? now) + days * DAY_MS, by, mine: true });
    this.save();
    this.apply();
    return null;
  }

  /** Takes an advert down early (nothing is paid back) */
  public async remove(board: string): Promise<string | null> {
    const online = OnlineAccount.get();
    if (online) {
      const done = await online.request('/ads/remove', { board });
      if (!done?.ok) return done?.reason ?? 'It could not be taken down.';
      await this.refresh(true);
      return null;
    }
    this.local = this.local.filter((r) => r.board !== board);
    this.save();
    this.apply();
    return null;
  }

  public refresh(force = false): Promise<void> {
    const online = OnlineAccount.get();
    if (!online) return Promise.resolve();
    if (this.fetching) return this.fetching;
    if (!force && Adverts.now() - this.fetchedAt < 20_000) return Promise.resolve();
    this.fetching = (async () => {
      try {
        const got = await online.request('/ads');
        if (got?.ok) {
          this.remote = (got.ads ?? []) as Rental[];
          this.fetchedAt = Adverts.now();
          this.apply();
        }
      } finally {
        this.fetching = null;
      }
    })();
    return this.fetching;
  }

  /** Paints every board: the adverts up now, the house adverts back where a rental has run out */
  public apply(): void {
    const up = new Map(this.rentals().map((r) => [r.board, r]));
    for (const face of Billboards.all()) {
      const r = up.get(face.id);
      Billboards.paint(face.id, r ? { headline: r.headline, line: r.line, colour: r.colour, by: r.by } : null);
    }
    for (const l of this.listeners) l();
  }

  public tick(): void {
    if (this.online) void this.refresh();
    this.apply();
  }

  /** For tests */
  public clear(): void {
    this.local = [];
    this.save();
    this.apply();
  }
}

const NAMES = new Map(PLACE_SPECS.map((p) => [p.key, p.name]));

/** What a board stands by: the nearest place along the road */
function nearTo(z: number): string {
  let best: { id: string; d: number } | null = null;
  for (const p of ROADSIDE) {
    const d = Math.abs(p.z - z);
    if (!best || d < best.d) best = { id: p.id, d };
  }
  if (!best || best.d > 260) return z < 1000 ? 'Lagos Island' : z >= 4110 ? 'Ikorodu Road, Ikeja' : 'the expressway';
  return NAMES.get(best.id) ?? best.id.replace(/-/g, ' ');
}

export function until(ms: number): string {
  return new Date(ms).toLocaleString('en-NG', { weekday: 'short', hour: 'numeric', minute: '2-digit', timeZone: 'Africa/Lagos' });
}
