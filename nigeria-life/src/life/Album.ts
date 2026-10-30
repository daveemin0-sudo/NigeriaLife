import { Activity, type ActivityEvent } from './Activity';

/**
 * The Naija Album: cards in sets, each earned the first time the thing on it is done (going
 * into a landmark, a plate of amala, a danfo ride, a first shift at the port, a first car)
 * or found in a card pack. Packs come from the daily hustle, the Sunday chest and the season.
 * The rare cards are only in packs. A finished set pays out; spares can be sold back.
 * The agamas (lizards hidden about the city) are counted here too.
 */

export type Rarity = 'common' | 'rare' | 'epic' | 'legend';

export interface Card {
  id: string;
  set: string;
  name: string;
  icon: string;
  rarity: Rarity;
  /** How it is earned, for the album page; pack-only cards say so */
  how: string;
  earns?: (e: ActivityEvent) => boolean;
}

const visited = (...keys: string[]) => (e: ActivityEvent) => e.kind === 'visited' && keys.some((k) => e.place.includes(k));
const spentOn = (re: RegExp) => (e: ActivityEvent) => e.kind === 'money' && e.amount < 0 && re.test(e.what);
const earnedFrom = (re: RegExp) => (e: ActivityEvent) => e.kind === 'money' && e.amount > 0 && re.test(e.what);
const acted = (re: RegExp) => (e: ActivityEvent) => e.kind === 'acted' && re.test(e.id);

export const SETS: Array<{ id: string; name: string; icon: string; reward: number }> = [
  { id: 'places', name: 'Places of Lagos', icon: '🏙️', reward: 150_000 },
  { id: 'chop', name: 'Chop Life', icon: '🍲', reward: 60_000 },
  { id: 'rides', name: 'Waka About', icon: '🚌', reward: 120_000 },
  { id: 'hustle', name: 'Hustle Hard', icon: '💼', reward: 100_000 },
  { id: 'bigman', name: 'Big Man Moves', icon: '💎', reward: 1_000_000 },
  { id: 'naija', name: 'Naija Vibes', icon: '🇳🇬', reward: 500_000 },
];

export const CARDS: Card[] = [
  // Places of Lagos
  { id: 'balogun', set: 'places', name: 'Balogun Market', icon: '🧺', rarity: 'common', how: 'Go into Balogun Market', earns: visited('balogun-market') },
  { id: 'shrine', set: 'places', name: 'Afrika Shrine', icon: '🎷', rarity: 'rare', how: 'Go into the Afrika Shrine', earns: visited('afrika-shrine') },
  { id: 'freedom', set: 'places', name: 'Freedom Park', icon: '🌳', rarity: 'common', how: 'Go into Freedom Park', earns: visited('freedom-park') },
  { id: 'lcc', set: 'places', name: 'Lekki Conservation', icon: '🌉', rarity: 'common', how: 'Walk the canopy at Lekki Conservation Centre', earns: visited('lekki-conservation') },
  { id: 'cv', set: 'places', name: 'Computer Village', icon: '📱', rarity: 'common', how: 'Go into Computer Village', earns: visited('computer-village') },
  { id: 'oshodi', set: 'places', name: 'Oshodi Interchange', icon: '🚏', rarity: 'common', how: 'Go into Oshodi Interchange', earns: visited('oshodi-interchange') },
  { id: 'mosque', set: 'places', name: 'Lagos Central Mosque', icon: '🕌', rarity: 'common', how: 'Go into the Central Mosque', earns: visited('central-mosque') },
  { id: 'redeemed', set: 'places', name: 'Redemption Camp', icon: '⛪', rarity: 'common', how: 'Go into the Redemption cathedral', earns: visited('redemption-cathedral', 'faith-arena') },
  { id: 'makoko', set: 'places', name: 'Makoko by Canoe', icon: '🛶', rarity: 'rare', how: 'Take the canoe from the jetty through Makoko', earns: acted(/^canoe ride to Makoko$/) },
  { id: 'beach', set: 'places', name: 'The Beach', icon: '🏖️', rarity: 'common', how: 'Go onto the beach', earns: visited('lagoon-beach') },
  { id: 'statehouse', set: 'places', name: 'Lagos State House', icon: '🏛️', rarity: 'rare', how: 'Go into Government House', earns: visited('government-house') },
  { id: 'refinery', set: 'places', name: 'Dangote Refinery', icon: '🛢️', rarity: 'rare', how: 'Go into the refinery', earns: visited('dangote-refinery') },
  { id: 'mmia', set: 'places', name: 'Murtala Muhammed Airport', icon: '🛫', rarity: 'common', how: 'Go into the airport terminal', earns: visited('mmia-terminal', 'airport') },
  { id: 'club', set: 'places', name: 'Quilox Nights', icon: '🪩', rarity: 'rare', how: 'Get into the nightclub', earns: visited('club') },
  // Chop Life
  { id: 'amala', set: 'chop', name: 'Amala & Ewedu', icon: '🥣', rarity: 'common', how: 'Eat at Amala Shitta', earns: (e) => visited('amala-shitta')(e) || spentOn(/amala/i)(e) },
  { id: 'jollof', set: 'chop', name: 'Party Jollof', icon: '🍛', rarity: 'common', how: 'Cook or buy jollof', earns: (e) => spentOn(/jollof/i)(e) || (e.kind === 'need' && e.need === 'hunger' && e.delta >= 55) },
  { id: 'suya', set: 'chop', name: 'Suya at Night', icon: '🍢', rarity: 'common', how: 'Buy suya', earns: spentOn(/suya/i) },
  { id: 'shawarma', set: 'chop', name: 'Double Sausage Shawarma', icon: '🌯', rarity: 'common', how: 'Buy shawarma at the mall', earns: spentOn(/shawarma/i) },
  { id: 'pie', set: 'chop', name: 'Meat Pie at 35,000 ft', icon: '🥟', rarity: 'rare', how: 'Be served on a flight', earns: acted(/^served on a flight$/) },
  { id: 'chapman', set: 'chop', name: 'Chapman', icon: '🍹', rarity: 'common', how: 'Order a drink at the club or a bar', earns: spentOn(/chapman|cocktail|drink/i) },
  // Waka About
  { id: 'danfo', set: 'rides', name: 'Danfo: Oshodi Oya!', icon: '🚐', rarity: 'common', how: 'Ride a danfo', earns: spentOn(/danfo/i) },
  { id: 'keke', set: 'rides', name: 'Keke NAPEP', icon: '🛺', rarity: 'common', how: 'Ride a keke', earns: spentOn(/keke/i) },
  { id: 'okada', set: 'rides', name: 'Okada Express', icon: '🏍️', rarity: 'common', how: 'Ride an okada', earns: spentOn(/okada|bike/i) },
  { id: 'flight', set: 'rides', name: 'Wheels Up', icon: '✈️', rarity: 'rare', how: 'Take a flight', earns: (e) => e.kind === 'city' && e.city !== 'lagos' },
  { id: 'coach', set: 'rides', name: 'Interstate Coach', icon: '🚌', rarity: 'common', how: 'Buy a coach ticket', earns: spentOn(/coach/i) },
  { id: 'convoy', set: 'rides', name: 'Siren Life', icon: '🚨', rarity: 'epic', how: 'Hire a police escort', earns: spentOn(/escort|convoy/i) },
  // Hustle Hard
  { id: 'firstpay', set: 'hustle', name: 'First Alert', icon: '💸', rarity: 'common', how: 'Get paid for a shift', earns: (e) => e.kind === 'money' && e.type === 'JOB_SALARY' && e.amount > 0 },
  { id: 'port', set: 'hustle', name: 'Apapa Port Loader', icon: '⚓', rarity: 'common', how: 'Work a shift at the port', earns: earnedFrom(/port|apapa/i) },
  { id: 'site', set: 'hustle', name: 'Site Labourer', icon: '🏗️', rarity: 'common', how: 'Work a shift on the building site', earns: earnedFrom(/site|block|plaza/i) },
  { id: 'takings', set: 'hustle', name: 'Business Alert', icon: '🏪', rarity: 'rare', how: 'Collect takings from your business', earns: (e) => e.kind === 'money' && e.type === 'BUSINESS_INCOME' && e.amount > 0 },
  { id: 'sherlock', set: 'hustle', name: 'Naija Sherlock', icon: '🔎', rarity: 'epic', how: 'Solve a detective case', earns: (e) => e.kind === 'case' && e.id.startsWith('case-') },
  { id: 'landlord', set: 'hustle', name: 'Landlord', icon: '🔑', rarity: 'rare', how: 'Collect rent', earns: (e) => e.kind === 'money' && e.type === 'RENT_INCOME' && e.amount > 0 },
  // Big Man Moves
  { id: 'firstcar', set: 'bigman', name: 'First Motor', icon: '🚗', rarity: 'rare', how: 'Buy a vehicle', earns: (e) => e.kind === 'money' && e.type === 'ASSET_PURCHASE' && /car|vehicle|motor|okada|keke|corolla|camry|benz|g-?wagon/i.test(e.what) },
  { id: 'land', set: 'bigman', name: 'C of O', icon: '📜', rarity: 'rare', how: 'Buy a plot of land', earns: (e) => e.kind === 'money' && e.type === 'ASSET_PURCHASE' && /plot|land/i.test(e.what) },
  { id: 'build', set: 'bigman', name: 'My Own House', icon: '🏡', rarity: 'epic', how: 'Build on your own land', earns: (e) => e.kind === 'money' && e.type === 'CONSTRUCTION_COST' },
  { id: 'biz', set: 'bigman', name: 'CEO', icon: '👔', rarity: 'epic', how: 'Buy a business', earns: (e) => e.kind === 'money' && e.type === 'BUSINESS_PURCHASE' },
  { id: 'suite', set: 'bigman', name: 'Room 20-Something', icon: '🛎️', rarity: 'rare', how: 'Check into the Eko Grand and open your room with the key card', earns: acted(/^open my hotel room$/) },
  { id: 'spray', set: 'bigman', name: 'Spraying Money', icon: '💵', rarity: 'rare', how: 'Spray money at the club', earns: acted(/^spray/) },
  { id: 'host', set: 'bigman', name: 'Host of the Night', icon: '👑', rarity: 'legend', how: 'Host the whole club (Platinum table)', earns: spentOn(/Platinum/i) },
  { id: 'jet', set: 'bigman', name: 'Private Jet', icon: '🛩️', rarity: 'legend', how: 'Buy a jet or a yacht', earns: spentOn(/jet|yacht/i) },
  // Naija Vibes: only in packs
  { id: 'nepa', set: 'naija', name: 'NEPA Took Light', icon: '💡', rarity: 'common', how: 'Card packs only' },
  { id: 'gele', set: 'naija', name: 'Gele Queen', icon: '👸🏾', rarity: 'rare', how: 'Card packs only' },
  { id: 'agbada', set: 'naija', name: 'Agbada King', icon: '🤴🏾', rarity: 'rare', how: 'Card packs only' },
  { id: 'eyo', set: 'naija', name: 'Eyo Masquerade', icon: '🎭', rarity: 'epic', how: 'Card packs only' },
  { id: 'goslow', set: 'naija', name: 'Third Mainland Go-slow', icon: '🚦', rarity: 'common', how: 'Card packs only' },
  { id: 'jollofwar', set: 'naija', name: 'Jollof Wars', icon: '🏆', rarity: 'rare', how: 'Card packs only' },
  { id: 'owambe', set: 'naija', name: 'Owambe Saturday', icon: '🥳', rarity: 'common', how: 'Card packs only' },
  { id: 'superEagles', set: 'naija', name: 'Super Eagles', icon: '🦅', rarity: 'epic', how: 'Card packs only' },
  { id: 'goldDanfo', set: 'naija', name: 'The Golden Danfo', icon: '🌟', rarity: 'legend', how: 'Card packs only' },
  { id: 'offeringDance', set: 'naija', name: 'Offering Dance', icon: '💃🏾', rarity: 'rare', how: 'Dance your offering to the front at Faith Arena', earns: acted(/^offering dance$/) },
  { id: 'saff', set: 'naija', name: 'In the Saff', icon: '🕌', rarity: 'rare', how: 'Pray in the row at the Central Mosque', earns: acted(/^pray in the row$/) },
  { id: 'agbero', set: 'naija', name: 'Agbero Wahala', icon: '😤', rarity: 'common', how: 'Card packs only' },
];

export const AGAMAS = 40;
const ODDS: Record<Rarity, number> = { common: 62, rare: 26, epic: 10, legend: 2 };
export const SELL_PRICE: Record<Rarity, number> = { common: 1_500, rare: 5_000, epic: 20_000, legend: 100_000 };

interface Save { owned: Record<string, number>; agamas: string[]; setsPaid: string[]; newest: string[]; packs: number }

export interface AlbumHooks {
  pay(amount: number, why: string): void;
  tell(text: string, big?: { title: string; sub: string }): void;
}

export class Album {
  private static instance: Album | null = null;
  public hooks: AlbumHooks | null = null;
  private save: Save;
  private readonly listeners: Array<() => void> = [];

  public static get(): Album {
    if (!Album.instance) Album.instance = new Album();
    return Album.instance;
  }

  private constructor() {
    this.save = this.load();
    Activity.get().on((e) => this.hear(e));
  }

  private key(): string {
    return `nl_album_v1:${Activity.player()}`;
  }

  private load(): Save {
    try {
      const raw = localStorage.getItem(this.key());
      if (raw) return { owned: {}, agamas: [], setsPaid: [], newest: [], packs: 0, ...JSON.parse(raw) };
    } catch { /* fresh */ }
    return { owned: {}, agamas: [], setsPaid: [], newest: [], packs: 0 };
  }

  public reload(): void {
    this.save = this.load();
    this.changed();
  }

  public subscribe(listener: () => void): () => void {
    this.listeners.push(listener);
    return () => { const i = this.listeners.indexOf(listener); if (i >= 0) this.listeners.splice(i, 1); };
  }

  private changed(): void {
    try { localStorage.setItem(this.key(), JSON.stringify(this.save)); } catch { /* blocked */ }
    for (const l of this.listeners) l();
  }

  private hear(e: ActivityEvent): void {
    if (e.kind === 'found') return;
    for (const card of CARDS) {
      if (!card.earns || this.save.owned[card.id]) continue;
      if (card.earns(e)) this.give(card, 'earned');
    }
  }

  private give(card: Card, how: 'earned' | 'pack'): void {
    const first = !this.save.owned[card.id];
    this.save.owned[card.id] = (this.save.owned[card.id] ?? 0) + 1;
    if (first) {
      this.save.newest = [card.id, ...this.save.newest.filter((id) => id !== card.id)].slice(0, 6);
      if (how === 'earned') this.hooks?.tell(`${card.icon} New card: ${card.name}. ${this.owned}/${CARDS.length} in your album.`);
      Activity.emit({ kind: 'found', what: 'card', id: card.id });
      this.checkSet(card.set);
    }
    this.changed();
  }

  private checkSet(set: string): void {
    if (this.save.setsPaid.includes(set)) return;
    const cards = CARDS.filter((c) => c.set === set);
    if (!cards.every((c) => this.save.owned[c.id])) return;
    this.save.setsPaid.push(set);
    const s = SETS.find((x) => x.id === set)!;
    this.hooks?.pay(s.reward, `Album set complete: ${s.name}`);
    this.hooks?.tell(`${s.icon} Set complete: ${s.name}! ₦${s.reward.toLocaleString()}`, { title: `${s.icon} SET COMPLETE`, sub: `${s.name} · ₦${s.reward.toLocaleString()}` });
  }

  /** Packs won and waiting to be opened */
  public get packs(): number {
    return this.save.packs;
  }

  public addPacks(n: number, why: string): void {
    this.save.packs += n;
    this.hooks?.tell(`🃏 ${why}: ${n === 1 ? 'a card pack' : `${n} card packs`} to open in Today.`);
    this.changed();
  }

  /** A pack of three, rarer cards less often; returns what came out */
  public openPack(why = 'A card pack'): Card[] {
    if (this.save.packs <= 0) return [];
    this.save.packs -= 1;
    const out: Card[] = [];
    for (let i = 0; i < 3; i++) {
      let roll = Math.random() * 100;
      let rarity: Rarity = 'common';
      for (const r of ['legend', 'epic', 'rare', 'common'] as Rarity[]) {
        if (roll < ODDS[r]) { rarity = r; break; }
        roll -= ODDS[r];
      }
      const pool = CARDS.filter((c) => c.rarity === rarity);
      const card = pool[Math.floor(Math.random() * pool.length)];
      out.push(card);
      this.give(card, 'pack');
    }
    void why;
    this.changed();
    return out;
  }

  public sellSpare(id: string): number {
    const card = CARDS.find((c) => c.id === id);
    const n = this.save.owned[id] ?? 0;
    if (!card || n < 2) return 0;
    this.save.owned[id] = n - 1;
    const price = SELL_PRICE[card.rarity];
    this.hooks?.pay(price, `Spare card sold: ${card.name}`);
    this.changed();
    return price;
  }

  public foundAgama(id: string): boolean {
    if (this.save.agamas.includes(id)) return false;
    this.save.agamas.push(id);
    const n = this.save.agamas.length;
    const prize = n === AGAMAS ? 500_000 : n % 10 === 0 ? 50_000 : 2_000;
    this.hooks?.pay(prize, `Agama caught (${n}/${AGAMAS})`);
    this.hooks?.tell(n % 10 === 0 ? `🦎 ${n} agamas caught! ₦${prize.toLocaleString()}` : `🦎 Agama caught! ${n}/${AGAMAS}. +₦${prize.toLocaleString()}`, n % 10 === 0 ? { title: `🦎 ${n} AGAMAS`, sub: `₦${prize.toLocaleString()} for the catch` } : undefined);
    Activity.emit({ kind: 'found', what: 'agama', id });
    this.changed();
    return true;
  }

  public hasAgama(id: string): boolean {
    return this.save.agamas.includes(id);
  }

  public count(id: string): number {
    return this.save.owned[id] ?? 0;
  }

  public get owned(): number {
    return CARDS.filter((c) => this.save.owned[c.id]).length;
  }

  public get agamas(): number {
    return this.save.agamas.length;
  }

  public get newest(): string[] {
    return this.save.newest;
  }

  public setDone(set: string): boolean {
    return this.save.setsPaid.includes(set);
  }
}
