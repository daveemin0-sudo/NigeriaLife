/**
 * Everything the player does, told in one place: money earned and spent, needs filled, things
 * acted out, places gone into, cities reached, messages sent, people greeted, games played,
 * things found. The daily hustles, the life ladder, the album and the season all listen here
 * instead of each wiring itself into every system.
 *
 * It also keeps the lifetime tallies the ladder and the album measure: places and cities seen,
 * money earned, shifts worked.
 */

export type ActivityEvent =
  | { kind: 'money'; type: string; amount: number; what: string }
  | { kind: 'need'; need: string; delta: number }
  | { kind: 'acted'; id: string }
  | { kind: 'visited'; place: string; name: string; first?: boolean }
  | { kind: 'city'; city: string }
  | { kind: 'chat' }
  | { kind: 'greet'; how: string }
  | { kind: 'game'; game: string; won: boolean; stake: number }
  | { kind: 'found'; what: 'agama' | 'card' | 'secret'; id: string }
  | { kind: 'ladder'; rung: number }
  | { kind: 'case'; id: string };

export interface Tallies {
  places: string[];
  cities: string[];
  earned: number;
  shifts: number;
  meals: number;
  greeted: number;
  gamesWon: number;
  firstSeen: number;
}

type Listener = (event: ActivityEvent) => void;

const KEY = 'nl_activity_v1';

export class Activity {
  private static instance: Activity | null = null;
  private readonly listeners: Listener[] = [];
  private tallies: Tallies;
  /** Who is playing, so each account keeps its own tallies */
  public static player: () => string = () => 'local';

  public static get(): Activity {
    if (!Activity.instance) Activity.instance = new Activity();
    return Activity.instance;
  }

  /** Tells everyone listening; safe to call from anywhere, even before anything listens */
  public static emit(event: ActivityEvent): void {
    Activity.get().tell(event);
  }

  private constructor() {
    this.tallies = this.load();
  }

  private storeKey(): string {
    return `${KEY}:${Activity.player()}`;
  }

  private load(): Tallies {
    const blank: Tallies = { places: [], cities: ['lagos'], earned: 0, shifts: 0, meals: 0, greeted: 0, gamesWon: 0, firstSeen: Date.now() };
    try {
      const raw = localStorage.getItem(this.storeKey());
      return raw ? { ...blank, ...JSON.parse(raw) } : blank;
    } catch {
      return blank;
    }
  }

  private save(): void {
    try { localStorage.setItem(this.storeKey(), JSON.stringify(this.tallies)); } catch { /* storage full or blocked */ }
  }

  /** The account changed (signed in as someone else): their own tallies */
  public reload(): void {
    this.tallies = this.load();
  }

  public on(listener: Listener): () => void {
    this.listeners.push(listener);
    return () => { const i = this.listeners.indexOf(listener); if (i >= 0) this.listeners.splice(i, 1); };
  }

  public get totals(): Readonly<Tallies> {
    return this.tallies;
  }

  private tell(event: ActivityEvent): void {
    const t = this.tallies;
    let changed = true;
    if (event.kind === 'visited' && !t.places.includes(event.place)) { t.places.push(event.place); event.first = true; }
    else if (event.kind === 'city' && !t.cities.includes(event.city)) t.cities.push(event.city);
    else if (event.kind === 'money' && event.amount > 0 && /JOB_SALARY|BUSINESS_INCOME|RENT_INCOME|WINNINGS/.test(event.type)) {
      t.earned += event.amount;
      if (event.type === 'JOB_SALARY') t.shifts += 1;
    } else if (event.kind === 'need' && event.need === 'hunger' && event.delta >= 15) t.meals += 1;
    else if (event.kind === 'greet') t.greeted += 1;
    else if (event.kind === 'game' && event.won) t.gamesWon += 1;
    else changed = false;
    if (changed) this.save();
    for (const l of [...this.listeners]) {
      try { l(event); } catch (e) { console.error('[Activity] listener failed', e); }
    }
  }
}
