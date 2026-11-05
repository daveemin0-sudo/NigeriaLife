import { Activity } from './Activity';
import { Album } from './Album';

/**
 * The life ladder: from a face-me-I-face-you room in Mushin to a mansion on Banana Island, in
 * ten rungs, each a real part of Lagos. Every rung has its life goals, measured from what the
 * player really has and has done: money, a roof, a motor, a business, places, shifts, the
 * album, the cities. Meeting them all moves the player up, with a reward and a new title.
 */

export interface LadderFacts {
  /** Cash, bank and businesses at what they cost */
  worth: number;
  vehicles: number;
  businesses: number;
  /** Rented a place, or built a house on their own land */
  renting: boolean;
  builtHomes: number;
  plots: number;
  /** Private jets and yachts */
  craft: number;
}

interface Goal { label: string; have: (f: LadderFacts) => number; need: number; money?: boolean }

export interface Rung { n: number; area: string; title: string; icon: string; line: string; goals: Goal[]; reward: number }

const t = () => Activity.get().totals;
const worth = (need: number): Goal => ({ label: `Be worth ₦${need >= 1e9 ? `${need / 1e9}bn` : need >= 1e6 ? `${need / 1e6}m` : need.toLocaleString()}`, have: (f) => f.worth, need, money: true });

export const RUNGS: Rung[] = [
  { n: 0, area: 'Mushin', title: 'JJC', icon: '🏚️', line: 'Just arrived, one room, big dreams.', goals: [], reward: 0 },
  {
    n: 1, area: 'Oshodi', title: 'Hustler', icon: '🚏', line: 'You know your way round the bus stops now.', reward: 25_000,
    goals: [
      { label: 'Earn ₦50,000 from work', have: () => t().earned, need: 50_000, money: true },
      { label: 'Go into 5 places', have: () => t().places.length, need: 5 },
      { label: 'Eat 3 proper meals', have: () => t().meals, need: 3 },
    ],
  },
  {
    n: 2, area: 'Yaba', title: 'Yaba Boy', icon: '🎓', line: 'Tech hubs, campus gist and your own rented room.', reward: 75_000,
    goals: [
      { label: 'Earn ₦250,000 from work', have: () => t().earned, need: 250_000, money: true },
      { label: 'Rent a place or build your own', have: (f) => (f.renting || f.builtHomes > 0 ? 1 : 0), need: 1 },
      { label: 'Greet 5 people', have: () => t().greeted, need: 5 },
    ],
  },
  {
    n: 3, area: 'Surulere', title: 'Mainland Boss', icon: '🏟️', line: 'A motor of your own and people know your name.', reward: 200_000,
    goals: [worth(1_000_000), { label: 'Own a vehicle', have: (f) => f.vehicles, need: 1 }, { label: 'Collect 10 album cards', have: () => Album.get().owned, need: 10 }],
  },
  {
    n: 4, area: 'Ikeja', title: 'Big Boy', icon: '🏢', line: 'Your own business and an office near the airport.', reward: 500_000,
    goals: [worth(5_000_000), { label: 'Own a business', have: (f) => f.businesses, need: 1 }, { label: 'Go into 15 places', have: () => t().places.length, need: 15 }],
  },
  {
    n: 5, area: 'Magodo', title: 'Estate Life', icon: '🏘️', line: 'Gated estate, generator that does not stop.', reward: 1_200_000,
    goals: [worth(20_000_000), { label: 'Own a plot of land', have: (f) => f.plots, need: 1 }, { label: 'Work 20 shifts', have: () => t().shifts, need: 20 }],
  },
  {
    n: 6, area: 'Lekki Phase 1', title: 'Lekki Big Man', icon: '🌴', line: 'Brunch on Admiralty Way, flights on the weekend.', reward: 3_000_000,
    goals: [worth(75_000_000), { label: 'Own 2 businesses', have: (f) => f.businesses, need: 2 }, { label: 'Fly to another city', have: () => t().cities.length - 1, need: 1 }],
  },
  {
    n: 7, area: 'Victoria Island', title: 'VI Executive', icon: '🏙️', line: 'Corner office in a tower, three cars in the garage.', reward: 8_000_000,
    goals: [worth(250_000_000), { label: 'Own 3 vehicles', have: (f) => f.vehicles, need: 3 }, { label: 'Visit Lagos, Abuja and Port Harcourt', have: () => t().cities.length, need: 3 }],
  },
  {
    n: 8, area: 'Ikoyi', title: 'Old Money', icon: '🏛️', line: 'Quiet streets, old trees, older money.', reward: 25_000_000,
    goals: [worth(1_000_000_000), { label: 'Build a house on your land', have: (f) => f.builtHomes, need: 1 }, { label: 'Collect 30 album cards', have: () => Album.get().owned, need: 30 }],
  },
  {
    n: 9, area: 'Banana Island', title: 'Banana Island Royalty', icon: '👑', line: 'The top. Everybody wants to be you.', reward: 100_000_000,
    goals: [worth(5_000_000_000), { label: 'Own a private jet or a yacht', have: (f) => f.craft, need: 1 }, { label: 'Catch 25 agamas', have: () => Album.get().agamas, need: 25 }],
  },
];

export interface LadderHooks {
  facts(): LadderFacts;
  pay(amount: number, why: string): void;
  tell(text: string, big?: { title: string; sub: string }): void;
}

export class Ladder {
  private static instance: Ladder | null = null;
  public hooks: LadderHooks | null = null;
  private reached = 0;
  private readonly listeners: Array<() => void> = [];

  public static get(): Ladder {
    if (!Ladder.instance) Ladder.instance = new Ladder();
    return Ladder.instance;
  }

  private constructor() {
    this.reached = this.load();
  }

  private key(): string {
    return `nl_ladder_v1:${Activity.player()}`;
  }

  private load(): number {
    try { return Math.max(0, Math.min(9, parseInt(localStorage.getItem(this.key()) ?? '0', 10) || 0)); } catch { return 0; }
  }

  public reload(): void {
    this.reached = this.load();
    for (const l of this.listeners) l();
  }

  public subscribe(listener: () => void): () => void {
    this.listeners.push(listener);
    return () => { const i = this.listeners.indexOf(listener); if (i >= 0) this.listeners.splice(i, 1); };
  }

  public get rung(): number {
    return this.reached;
  }

  public get current(): Rung {
    return RUNGS[this.reached];
  }

  public get next(): Rung | null {
    return RUNGS[this.reached + 1] ?? null;
  }

  /** The goals of a rung, with how far the player is on each */
  public progress(rung: Rung): Array<{ label: string; have: number; need: number; done: boolean; money?: boolean }> {
    const f = this.hooks?.facts() ?? { worth: 0, vehicles: 0, businesses: 0, renting: false, builtHomes: 0, plots: 0, craft: 0 };
    return rung.goals.map((g) => {
      const have = g.have(f);
      return { label: g.label, have, need: g.need, done: have >= g.need, money: g.money };
    });
  }

  /** Moves the player up as far as their life now allows; called often, cheap */
  public check(): void {
    let moved = false;
    while (this.next && this.progress(this.next).every((g) => g.done)) {
      this.reached += 1;
      moved = true;
      const r = this.current;
      try { localStorage.setItem(this.key(), String(this.reached)); } catch { /* blocked */ }
      this.hooks?.pay(r.reward, `Moved up the ladder: ${r.area}`);
      this.hooks?.tell(`${r.icon} You moved up to ${r.area}: ${r.title}! ₦${r.reward.toLocaleString()}`, { title: `${r.icon} WELCOME TO ${r.area.toUpperCase()}`, sub: `You are now ${r.title} · ₦${r.reward.toLocaleString()}` });
      Activity.emit({ kind: 'ladder', rung: this.reached });
    }
    if (moved) for (const l of this.listeners) l();
  }
}
