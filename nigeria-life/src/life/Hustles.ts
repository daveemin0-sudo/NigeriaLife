import { Activity, type ActivityEvent } from './Activity';

/**
 * Today's hustle: three things to do each real Lagos day, one for the grind, one for life and
 * one for linking up, drawn from what the game really counts. Each pays when it is done; all
 * three pay a bonus and a card pack. Doing at least one a day keeps a streak; finishing all
 * three on three days of the week opens the Sunday chest. Everything done also earns season
 * XP, climbing a track of forty tiers that rewards money, card packs and titles.
 */

export type HustleKind = 'grind' | 'life' | 'link';

interface Template {
  id: string;
  kind: HustleKind;
  icon: string;
  title: string;
  /** How much is needed, and what it is measured in */
  goal: number;
  unit?: string;
  /** How far this event takes it */
  counts(event: ActivityEvent, seenToday: Set<string>): number;
}

const money = (types: RegExp, signed: 1 | -1, asCount = false) => (e: ActivityEvent) =>
  e.kind === 'money' && types.test(e.type) && Math.sign(e.amount) === signed ? (asCount ? 1 : Math.abs(e.amount)) : 0;

const TEMPLATES: Template[] = [
  // The grind
  { id: 'earn-work', kind: 'grind', icon: '💪', title: 'Hammer: earn from work', goal: 20_000, unit: '₦', counts: money(/JOB_SALARY/, 1) },
  { id: 'shift', kind: 'grind', icon: '🕘', title: 'Clock in: finish a work shift', goal: 1, counts: money(/JOB_SALARY/, 1, true) },
  { id: 'takings', kind: 'grind', icon: '🏪', title: 'Oga at the top: collect business takings', goal: 1, counts: money(/BUSINESS_INCOME|RENT_INCOME/, 1, true) },
  { id: 'two-shifts', kind: 'grind', icon: '⏱️', title: 'No dulling: finish two shifts', goal: 2, counts: money(/JOB_SALARY/, 1, true) },
  // Life
  { id: 'chop', kind: 'life', icon: '🍲', title: 'Chop life: eat a proper meal', goal: 1, counts: (e) => (e.kind === 'need' && e.need === 'hunger' && e.delta >= 15 ? 1 : 0) },
  { id: 'rest', kind: 'life', icon: '🛏️', title: 'Rest your head: sleep well', goal: 40, unit: 'energy', counts: (e) => (e.kind === 'need' && e.need === 'energy' && e.delta > 0 && e.delta < 20 ? e.delta : 0) },
  { id: 'fresh', kind: 'life', icon: '🫧', title: 'Stay fresh: bathe', goal: 1, counts: (e) => (e.kind === 'need' && e.need === 'hygiene' && e.delta >= 25 ? 1 : 0) },
  {
    id: 'waka', kind: 'life', icon: '🚶', title: 'Waka: go into 3 different places', goal: 3,
    counts: (e, seen) => {
      if (e.kind !== 'visited' || seen.has(e.place)) return 0;
      seen.add(e.place);
      return 1;
    },
  },
  { id: 'market', kind: 'life', icon: '🛍️', title: 'Market day: spend ₦10,000 shopping', goal: 10_000, unit: '₦', counts: money(/SHOP_PURCHASE|FOOD_PURCHASE/, -1) },
  // Linking up
  { id: 'gist', kind: 'link', icon: '💬', title: 'Gist: send 2 messages in chat', goal: 2, counts: (e) => (e.kind === 'chat' ? 1 : 0) },
  { id: 'hail', kind: 'link', icon: '👋', title: 'Hail: greet 3 people', goal: 3, counts: (e) => (e.kind === 'greet' ? 1 : 0) },
  { id: 'owambe', kind: 'link', icon: '🍾', title: 'Owambe: spray money or pop a bottle', goal: 1, counts: (e) => (e.kind === 'acted' && /spray|pop a bottle/.test(e.id) ? 1 : 0) },
  { id: 'play', kind: 'link', icon: '🎲', title: 'Play a game on your phone', goal: 1, counts: (e) => (e.kind === 'game' ? 1 : 0) },
];

export interface SeasonTier { tier: number; reward: string; cash: number; packs: number; title?: string }

/** Four weeks each from 1 October: Independence first, then on through the Lagos year */
const SEASONS = ['Independence Fever', 'Owambe Season', 'Detty December', 'Harmattan Hustle', 'Love & Hustle', 'Eko Carnival', 'Rainy Season Grind', 'Jollof Summer'];
const SEASON_DAYS = 28;
const SEASON_EPOCH = Date.UTC(2026, 9, 1);
export const TIER_XP = 150;
export const TIERS = 40;
const TITLES: Record<number, string> = { 5: 'JJC no more', 10: 'Area Champion', 20: 'Big Man', 30: 'Odogwu', 40: 'Eko Legend' };

export const XP = { hustle: 120, allThree: 200, firstPlace: 30, card: 40, agama: 25, ladder: 400, win: 30, case: 300 };

interface DayState { date: string; picks: string[]; progress: Record<string, number>; done: string[]; paidBonus: boolean; seen: string[] }
interface Save {
  day: DayState;
  streak: number;
  lastCounted: string | null;
  best: number;
  week: { monday: string; fullDays: string[]; chestOpened: boolean };
  season: { id: number; xp: number; claimed: number[] };
}

export interface HustleView { id: string; kind: HustleKind; icon: string; title: string; goal: number; unit?: string; progress: number; done: boolean; reward: number }

/** The Lagos calendar date, YYYY-MM-DD */
export function lagosDate(at = Date.now()): string {
  return new Date(at).toLocaleDateString('en-CA', { timeZone: 'Africa/Lagos' });
}
const dayBefore = (date: string) => lagosDate(Date.parse(`${date}T12:00:00Z`) - 86_400_000);
const mondayOf = (date: string) => {
  const d = new Date(`${date}T12:00:00Z`);
  const back = (d.getUTCDay() + 6) % 7;
  return lagosDate(d.getTime() - back * 86_400_000);
};
const isSunday = (date: string) => new Date(`${date}T12:00:00Z`).getUTCDay() === 0;

function seeded(text: string): () => number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) { h ^= text.charCodeAt(i); h = Math.imul(h, 16777619); }
  return () => { h ^= h << 13; h ^= h >>> 17; h ^= h << 5; return ((h >>> 0) % 100000) / 100000; };
}

export interface HustleHooks {
  /** Pays the player (and says why) */
  pay(amount: number, why: string): void;
  /** A card pack opened into the album */
  pack(count: number, why: string): void;
  /** How far up the life ladder the player is, 0 to 9: rewards grow with it */
  rung(): number;
  tell(text: string, big?: { title: string; sub: string }): void;
}

export class Hustles {
  private static instance: Hustles | null = null;
  public static today: () => string = () => lagosDate();
  public hooks: HustleHooks | null = null;
  private save: Save;
  private readonly listeners: Array<() => void> = [];

  public static get(): Hustles {
    if (!Hustles.instance) Hustles.instance = new Hustles();
    return Hustles.instance;
  }

  private constructor() {
    this.save = this.load();
    Activity.get().on((e) => this.hear(e));
  }

  private key(): string {
    return `nl_hustles_v1:${Activity.player()}`;
  }

  private load(): Save {
    try {
      const raw = localStorage.getItem(this.key());
      if (raw) return JSON.parse(raw) as Save;
    } catch { /* fresh */ }
    const date = Hustles.today();
    return {
      day: this.draw(date), streak: 0, lastCounted: null, best: 0,
      week: { monday: mondayOf(date), fullDays: [], chestOpened: false },
      season: { id: this.seasonId(), xp: 0, claimed: [] },
    };
  }

  public reload(): void {
    this.save = this.load();
    this.changed();
  }

  private persist(): void {
    try { localStorage.setItem(this.key(), JSON.stringify(this.save)); } catch { /* storage blocked */ }
  }

  public subscribe(listener: () => void): () => void {
    this.listeners.push(listener);
    return () => { const i = this.listeners.indexOf(listener); if (i >= 0) this.listeners.splice(i, 1); };
  }

  private changed(): void {
    this.persist();
    for (const l of this.listeners) l();
  }

  /** The three of the day, the same for everyone on the same day so friends can do them together */
  private draw(date: string): DayState {
    const rnd = seeded(`hustle:${date}`);
    const pick = (kind: HustleKind) => {
      const list = TEMPLATES.filter((t) => t.kind === kind);
      return list[Math.floor(rnd() * list.length)].id;
    };
    return { date, picks: [pick('grind'), pick('life'), pick('link')], progress: {}, done: [], paidBonus: false, seen: [] };
  }

  /** A new day (or a new week, or a new season) begins when it is first looked at */
  private roll(): void {
    const date = Hustles.today();
    if (this.save.day.date !== date) this.save.day = this.draw(date);
    const monday = mondayOf(date);
    if (this.save.week.monday !== monday) this.save.week = { monday, fullDays: [], chestOpened: false };
    const season = this.seasonId();
    if (this.save.season.id !== season) this.save.season = { id: season, xp: 0, claimed: [] };
  }

  private seasonId(): number {
    return Math.max(0, Math.floor((Date.parse(`${Hustles.today()}T12:00:00Z`) - SEASON_EPOCH) / (SEASON_DAYS * 86_400_000)));
  }

  private rewardFor(t: Template): number {
    const rung = this.hooks?.rung() ?? 0;
    return Math.round((t.kind === 'grind' ? 6000 : 4000) * (1 + rung * 0.6) / 100) * 100;
  }

  private goalFor(t: Template): number {
    const rung = this.hooks?.rung() ?? 0;
    return t.unit === '₦' ? Math.round(t.goal * (1 + rung * 0.75)) : t.goal;
  }

  private hear(e: ActivityEvent): void {
    this.roll();
    // Season XP for what is not a hustle
    if (e.kind === 'visited' && e.first) this.addXp(XP.firstPlace);
    if (e.kind === 'found') this.addXp(e.what === 'agama' ? XP.agama : XP.card);
    if (e.kind === 'ladder') this.addXp(XP.ladder);
    if (e.kind === 'game' && e.won) this.addXp(XP.win);
    if (e.kind === 'case') this.addXp(XP.case);
    const day = this.save.day;
    const seen = new Set(day.seen);
    let moved = false;
    for (const id of day.picks) {
      if (day.done.includes(id)) continue;
      const t = TEMPLATES.find((x) => x.id === id);
      if (!t) continue;
      const add = t.counts(e, seen);
      if (add <= 0) continue;
      moved = true;
      day.progress[id] = (day.progress[id] ?? 0) + add;
      if (day.progress[id] >= this.goalFor(t)) this.complete(t);
    }
    day.seen = [...seen];
    if (moved || e.kind === 'found' || e.kind === 'ladder' || e.kind === 'game' || e.kind === 'case' || (e.kind === 'visited' && e.first)) this.changed();
  }

  private complete(t: Template): void {
    const day = this.save.day;
    day.done.push(t.id);
    const reward = this.rewardFor(t);
    this.hooks?.pay(reward, `Hustle done: ${t.title}`);
    this.addXp(XP.hustle);
    // The streak: the first one done today keeps it going
    if (day.done.length === 1 && this.save.lastCounted !== day.date) {
      this.save.streak = this.save.lastCounted === dayBefore(day.date) ? this.save.streak + 1 : 1;
      this.save.best = Math.max(this.save.best, this.save.streak);
      this.save.lastCounted = day.date;
    }
    if (day.done.length === day.picks.length && !day.paidBonus) {
      day.paidBonus = true;
      const bonus = Math.round(20_000 * (1 + (this.hooks?.rung() ?? 0) * 0.5));
      this.hooks?.pay(bonus, "All of today's hustle done");
      this.hooks?.pack(1, "Today's hustle");
      this.addXp(XP.allThree);
      if (!this.save.week.fullDays.includes(day.date)) this.save.week.fullDays.push(day.date);
      this.hooks?.tell(`🔥 All three done! ₦${bonus.toLocaleString()} bonus and a card pack.`, { title: '🔥 TODAY\'S HUSTLE DONE', sub: `Streak: ${this.save.streak} day${this.save.streak === 1 ? '' : 's'} · bonus ₦${bonus.toLocaleString()}` });
    } else {
      this.hooks?.tell(`${t.icon} Hustle done: ${t.title.split(':')[0]}. +₦${reward.toLocaleString()}`);
    }
  }

  private addXp(amount: number): void {
    this.roll();
    const before = Math.floor(this.save.season.xp / TIER_XP);
    this.save.season.xp += amount;
    const after = Math.floor(this.save.season.xp / TIER_XP);
    if (after > before && after <= TIERS) this.hooks?.tell(`⭐ Season tier ${after} reached in ${this.seasonName}. Claim it in Today.`);
  }

  // --- What the panel shows -----------------------------------------------------------------

  public hustles(): HustleView[] {
    this.roll();
    const day = this.save.day;
    return day.picks.map((id) => {
      const t = TEMPLATES.find((x) => x.id === id)!;
      return { id, kind: t.kind, icon: t.icon, title: t.title, goal: this.goalFor(t), unit: t.unit, progress: Math.min(this.goalFor(t), day.progress[id] ?? 0), done: day.done.includes(id), reward: this.rewardFor(t) };
    });
  }

  public get streak(): number {
    this.roll();
    // A streak not kept yesterday or today has lapsed
    const last = this.save.lastCounted;
    const today = this.save.day.date;
    return last === today || last === dayBefore(today) ? this.save.streak : 0;
  }

  public get bestStreak(): number {
    return this.save.best;
  }

  /** Days this week with all three done, and whether the chest can be opened (Sundays, three days or more) */
  public chest(): { days: number; need: number; sunday: boolean; ready: boolean; opened: boolean } {
    this.roll();
    const days = this.save.week.fullDays.length;
    const sunday = isSunday(this.save.day.date);
    return { days, need: 3, sunday, ready: sunday && days >= 3 && !this.save.week.chestOpened, opened: this.save.week.chestOpened };
  }

  public openChest(): boolean {
    const c = this.chest();
    if (!c.ready) return false;
    this.save.week.chestOpened = true;
    const cash = Math.round(80_000 * (1 + (this.hooks?.rung() ?? 0) * 0.6));
    this.hooks?.pay(cash, 'The Sunday chest');
    this.hooks?.pack(2, 'The Sunday chest');
    this.addXp(300);
    this.hooks?.tell(`🎁 The Sunday chest: ₦${cash.toLocaleString()} and two card packs!`, { title: '🎁 SUNDAY CHEST', sub: `₦${cash.toLocaleString()} and two card packs` });
    this.changed();
    return true;
  }

  public get seasonName(): string {
    return SEASONS[this.save.season.id % SEASONS.length];
  }

  public season(): { name: string; xp: number; tier: number; intoTier: number; daysLeft: number; tiers: Array<SeasonTier & { reached: boolean; claimed: boolean }> } {
    this.roll();
    const xp = this.save.season.xp;
    const tier = Math.min(TIERS, Math.floor(xp / TIER_XP));
    const start = SEASON_EPOCH + this.save.season.id * SEASON_DAYS * 86_400_000;
    const daysLeft = Math.max(0, Math.ceil((start + SEASON_DAYS * 86_400_000 - Date.parse(`${this.save.day.date}T12:00:00Z`)) / 86_400_000));
    const tiers = Array.from({ length: TIERS }, (_, i) => {
      const n = i + 1;
      const t = Hustles.tierReward(n);
      return { ...t, reached: tier >= n, claimed: this.save.season.claimed.includes(n) };
    });
    return { name: this.seasonName, xp, tier, intoTier: xp % TIER_XP, daysLeft, tiers };
  }

  public static tierReward(n: number): SeasonTier {
    const title = TITLES[n];
    if (title) return { tier: n, reward: `Title: ${title} + ₦${(n * 25_000).toLocaleString()}`, cash: n * 25_000, packs: 1, title };
    if (n % 3 === 0) return { tier: n, reward: 'A card pack', cash: 0, packs: 1 };
    return { tier: n, reward: `₦${(n * 6_000).toLocaleString()}`, cash: n * 6_000, packs: 0 };
  }

  public claimTier(n: number): boolean {
    const s = this.season();
    const t = s.tiers[n - 1];
    if (!t || !t.reached || t.claimed) return false;
    this.save.season.claimed.push(n);
    if (t.cash) this.hooks?.pay(t.cash, `${s.name}, tier ${n}`);
    if (t.packs) this.hooks?.pack(t.packs, `${s.name}, tier ${n}`);
    if (t.title) this.save.season.claimed.push(-n);
    this.hooks?.tell(`⭐ ${s.name} tier ${n}: ${t.reward}`, t.title ? { title: `👑 ${t.title.toUpperCase()}`, sub: `${s.name} · tier ${n}` } : undefined);
    this.changed();
    return true;
  }

  /** The best title won this season, for the name tag and the profile */
  public get title(): string | null {
    const won = this.save.season.claimed.filter((n) => n < 0).map((n) => -n).sort((a, b) => b - a)[0];
    return won ? TITLES[won] : null;
  }

  public get doneToday(): number {
    this.roll();
    return this.save.day.done.length;
  }
}
