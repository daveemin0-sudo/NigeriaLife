import { profileKey } from '../backend/Profile';

/**
 * What this player has with other players: how close they are to each, who is family, who is
 * their bae, and the jobs they have hired others for or been hired to do. Kept on this device,
 * for this profile; the other side keeps its own half and the two are kept in step by messages.
 */

export type HireRole = 'decorator' | 'cook' | 'dj' | 'driver' | 'bodyguard' | 'photographer' | 'tutor' | 'hustle';

export const ROLES: Array<{ id: HireRole; icon: string; name: string; hint: string }> = [
  { id: 'decorator', icon: '🛋️', name: 'Decorator', hint: 'Decorate my house' },
  { id: 'cook', icon: '🍲', name: 'Cook', hint: 'Cook for my party' },
  { id: 'dj', icon: '🎧', name: 'DJ', hint: 'Play at my owambe' },
  { id: 'driver', icon: '🚘', name: 'Driver', hint: 'Drive me around Lagos' },
  { id: 'bodyguard', icon: '🕶️', name: 'Bodyguard', hint: 'Follow me tonight' },
  { id: 'photographer', icon: '📸', name: 'Photographer', hint: 'Shoot my pictures' },
  { id: 'tutor', icon: '📚', name: 'Tutor', hint: 'Teach me something' },
  { id: 'hustle', icon: '🧰', name: 'Hustle', hint: 'Help me with something' },
];

export type OfferState = 'offered' | 'accepted' | 'declined' | 'done' | 'paid';

export interface Offer {
  id: string;
  employerId: string;
  employerName: string;
  workerId: string;
  workerName: string;
  role: HireRole;
  details: string;
  fee: number;
  budget: number;
  /** When it is wanted: 'now', '1h', '3h', '6h', 'tomorrow' */
  when: string;
  at: number;
  state: OfferState;
  /** 1 to 5 stars, given by the one who hired when they paid */
  rating?: number;
}

export const FEE_MIN = 1000;
export const FEE_MAX = 10_000_000;
/** Closeness at which a bae can be asked */
export const BAE_AT = 40;

interface Saved {
  close: Record<string, { name: string; n: number }>;
  family: Array<{ id: string; name: string }>;
  bae: { id: string; name: string } | null;
  offers: Offer[];
  /** Whether others may see this player's criminal record */
  recordPublic: boolean;
}

export class Ties {
  private static instance: Ties | null = null;
  public static get(): Ties {
    return (this.instance ??= new Ties());
  }

  private readonly key = profileKey('nigeria_life_ties_v1');
  private data: Saved = { close: {}, family: [], bae: null, offers: [], recordPublic: false };
  private listeners = new Set<() => void>();

  private constructor() {
    try {
      const saved = JSON.parse(localStorage.getItem(this.key) || 'null');
      if (saved && typeof saved === 'object') {
        this.data = {
          close: saved.close && typeof saved.close === 'object' ? saved.close : {},
          family: Array.isArray(saved.family) ? saved.family : [],
          bae: saved.bae && typeof saved.bae.id === 'string' ? saved.bae : null,
          offers: Array.isArray(saved.offers) ? saved.offers : [],
          recordPublic: !!saved.recordPublic,
        };
      }
    } catch {
      // A record that cannot be read back: no ties
    }
  }

  public onChange(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private changed(): void {
    try {
      localStorage.setItem(this.key, JSON.stringify(this.data));
    } catch {
      // Storage shut off: kept until the page is closed
    }
    for (const listener of this.listeners) listener();
  }

  // --- Closeness -----------------------------------------------------------------------------

  public closeness(id: string): number {
    return Math.round(this.data.close[id]?.n ?? 0);
  }

  /** Time spent together: a wave, a chat, a job done, each brings two players closer */
  public grow(id: string, name: string, by: number): void {
    const was = this.data.close[id]?.n ?? 0;
    this.data.close[id] = { name, n: Math.max(0, Math.min(100, was + by)) };
    this.changed();
  }

  // --- Family and bae --------------------------------------------------------------------------

  public family(): ReadonlyArray<{ id: string; name: string }> {
    return this.data.family;
  }

  public isFamily(id: string): boolean {
    return this.data.family.some((f) => f.id === id);
  }

  public addFamily(id: string, name: string): void {
    if (this.isFamily(id)) return;
    this.data.family.push({ id, name });
    this.grow(id, name, 10);
  }

  public bae(): { id: string; name: string } | null {
    return this.data.bae;
  }

  public setBae(id: string, name: string): void {
    this.data.bae = { id, name };
    this.grow(id, name, 10);
  }

  public get recordPublic(): boolean {
    return this.data.recordPublic;
  }

  public setRecordPublic(on: boolean): void {
    this.data.recordPublic = on;
    this.changed();
  }

  // --- Jobs between players --------------------------------------------------------------------

  public offers(): readonly Offer[] {
    return this.data.offers;
  }

  public offer(id: string): Offer | null {
    return this.data.offers.find((o) => o.id === id) ?? null;
  }

  /** Records an offer made or received; an offer seen again (sent twice) is not added twice */
  public keep(offer: Offer): void {
    if (this.offer(offer.id)) return;
    this.data.offers.unshift(offer);
    this.data.offers = this.data.offers.slice(0, 60);
    this.changed();
  }

  /** Moves an offer on: accepted, declined, done, paid. Only forward, never back. */
  public advance(id: string, state: OfferState, rating?: number): Offer | null {
    const offer = this.offer(id);
    if (!offer) return null;
    const order: OfferState[] = ['offered', 'accepted', 'done', 'paid'];
    if (state === 'declined') {
      if (offer.state !== 'offered') return null;
    } else if (order.indexOf(state) <= order.indexOf(offer.state) || offer.state === 'declined') {
      return null;
    }
    offer.state = state;
    if (rating !== undefined) offer.rating = Math.max(1, Math.min(5, Math.round(rating)));
    this.changed();
    return offer;
  }

  /** The jobs this player has done for others and been paid for, with how they were rated */
  public hustle(me: string): { done: number; rating: number | null; ratings: number; roles: Record<string, number> } {
    const paid = this.data.offers.filter((o) => o.workerId === me && o.state === 'paid');
    const rated = paid.filter((o) => o.rating);
    const roles: Record<string, number> = {};
    for (const o of paid) roles[o.role] = (roles[o.role] ?? 0) + 1;
    return {
      done: paid.length,
      rating: rated.length ? Math.round((rated.reduce((s, o) => s + (o.rating ?? 0), 0) / rated.length) * 10) / 10 : null,
      ratings: rated.length,
      roles,
    };
  }
}
