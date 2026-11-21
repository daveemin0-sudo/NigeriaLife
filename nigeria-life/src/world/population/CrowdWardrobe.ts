import type { StreetLook } from '../../graphics/people/SkinnedCharacter';
import {
  OUTFITS_PER_PURPOSE, buildOutfit, dressWeather, forWeather, makeProfile, personSeed, purposeOf, rotationOf, slotOf, toStreetLook,
  COLOURS, type DressWeather, type NpcOutfit, type PersonFacts, type Purpose, type WardrobeProfile,
} from './NpcWardrobe';

/**
 * The few outfit choices worth keeping between sessions: what the regulars (the traders at their stalls,
 * the shopkeepers, the guards at their doors) put on today, and the weather they dressed for. Everything else
 * about anyone's clothes follows from their number, so nothing more is stored.
 *
 * Kept on this device only (the account save leaves it out: src/backend/CloudSyncService.ts), apart from the
 * player's own outfits, and written at most once every few seconds, only when something changed.
 */
interface Rec {
  /** The dressing (slotOf) the choice is for */
  s: number;
  w: DressWeather;
}
export const NPC_WARDROBE_KEY = 'nl_npc_wardrobe_v1';
const VERSION = 1;
const KEEP = 400;

export class NpcWardrobeStore {
  public static shared = new NpcWardrobeStore();
  private data: { v: number; people: Record<string, Rec> } | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;
  /** How many times it has been written (for the tests: few writes) */
  public writes = 0;

  private load(): { v: number; people: Record<string, Rec> } {
    if (this.data) return this.data;
    let parsed: { v: number; people: Record<string, Rec> } | null = null;
    try {
      const raw = localStorage.getItem(NPC_WARDROBE_KEY);
      if (raw) parsed = JSON.parse(raw);
    } catch {
      parsed = null;
    }
    this.data = parsed && parsed.v === VERSION && parsed.people && typeof parsed.people === 'object' ? parsed : { v: VERSION, people: {} };
    return this.data;
  }

  public get(city: string, id: number): Rec | undefined {
    const r = this.load().people[`${city}:${id}`];
    return r && typeof r.s === 'number' && typeof r.w === 'string' ? r : undefined;
  }

  public put(city: string, id: number, rec: Rec): void {
    const people = this.load().people;
    const key = `${city}:${id}`;
    const was = people[key];
    if (was && was.s === rec.s && was.w === rec.w) return;
    people[key] = rec;
    const keys = Object.keys(people);
    if (keys.length > KEEP) {
      // The oldest choices go first
      keys.sort((a, b) => people[a].s - people[b].s);
      for (const k of keys.slice(0, keys.length - KEEP)) delete people[k];
    }
    if (!this.timer) this.timer = setTimeout(() => this.flush(), 5000);
  }

  public flush(): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    if (!this.data) return;
    try {
      localStorage.setItem(NPC_WARDROBE_KEY, JSON.stringify(this.data));
      this.writes += 1;
    } catch {
      /* storage full or blocked: the choices are simply made again */
    }
  }

  /** Forgets what was read (the tests read it again from storage, as a new session would) */
  public reset(): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    this.data = null;
  }
}
if (typeof window !== 'undefined') window.addEventListener('pagehide', () => NpcWardrobeStore.shared.flush());

/** What a crowd needs to know about a person the first time they are dressed */
export interface CrowdPerson extends PersonFacts {
  /** A regular the player meets again (a trader at a stall, a shopkeeper, a guard): their choice is kept */
  important: boolean;
  /** Has work to go to on their working days */
  works: boolean;
}

export interface WardrobeEntry {
  profile: WardrobeProfile;
  important: boolean;
  works: boolean;
  /** The dressing worn now, what it is for, and the weather it was put on in */
  slot: number;
  purpose: Purpose;
  weather: DressWeather;
  /** Their outfit for it, as worn (after the weather), and the cap put on when it rains */
  outfit: NpcOutfit;
  rainHat: boolean;
  look: StreetLook;
  /** The look's number (a model is dressed again only when it changes) */
  key: number;
  serial: number;
  outfits: Map<number, NpcOutfit>;
}

/** One crowd's people and what they wear, made as they are first seen */
export class CrowdWardrobe {
  public city: string;
  public readonly entries = new Map<number, WardrobeEntry>();
  /** Outfit changes made, and changes held back because the person was in front of the player */
  public changes = 0;
  public held = 0;
  public store = NpcWardrobeStore.shared;

  constructor(city = 'lagos') {
    this.city = city;
  }

  public setCity(city: string): void {
    if (city === this.city) return;
    this.city = city;
    this.entries.clear();
  }

  /**
   * What this person wears now. `hold`: they are close in front of the player, so a change of clothes waits;
   * `holdHat`: they are one of the full close-up models, so even the cap for the rain waits. Cheap when nothing changes: a number compared, the same entry returned.
   */
  public dress(id: number, facts: () => CrowdPerson, hour: number, day: number, weekdayToday: number | null, weather: string, hold: boolean, holdHat = hold): WardrobeEntry {
    let e = this.entries.get(id);
    if (!e) {
      const f = facts();
      const profile = makeProfile(personSeed(this.city, id), f);
      e = { profile, important: f.important, works: f.works, slot: Number.NaN, purpose: 'casual', weather: 'mild', outfit: null!, rainHat: false, look: null!, key: 0, serial: 0, outfits: new Map() };
      this.entries.set(id, e);
    }
    const slot = slotOf(e.profile, hour, day);
    if (slot !== e.slot) {
      if (hold && e.look) this.held += 1;
      else this.choose(id, e, slot, day, weekdayToday ?? 1, weather);
    }
    // The rain is met at once by those who carry a cap (and only by them)
    const raining = weather === 'rainy' || weather === 'thunderstorm';
    const wantHat = raining && e.profile.capInBag && !e.outfit.hat;
    if (wantHat !== e.rainHat && !holdHat) {
      e.rainHat = wantHat;
      this.relook(id, e);
    }
    return e;
  }

  /** Forgets everyone's wardrobe (they are made again as they are next seen) */
  public reset(): void {
    this.entries.clear();
  }

  private choose(id: number, e: WardrobeEntry, slot: number, day: number, weekdayToday: number, weather: string): void {
    const slotDay = Math.floor(slot / 2);
    const weekday = (((weekdayToday - (day - slotDay)) % 7) + 7) % 7;
    const purpose = purposeOf(e.profile, slot, weekday, e.works);
    const index = rotationOf(e.profile, purpose, slot);
    const dressAt = slot % 2 === 1 ? e.profile.eveningHour : e.profile.dressHour;
    let w = dressWeather(weather, dressAt);
    // A regular wears what they put on today, whatever the weather is now in this session
    if (e.important) {
      const rec = this.store.get(this.city, id);
      if (rec && rec.s === slot) w = rec.w;
      else this.store.put(this.city, id, { s: slot, w });
    }
    const k = (Object.keys(OUTFITS_PER_PURPOSE) as Purpose[]).indexOf(purpose) * 8 + index;
    let base = e.outfits.get(k);
    if (!base) {
      base = buildOutfit(e.profile, purpose, index);
      e.outfits.set(k, base);
    }
    const had = !!e.look;
    e.slot = slot;
    e.purpose = purpose;
    e.weather = w;
    e.outfit = forWeather(base, w, e.profile);
    e.rainHat = false;
    this.relook(id, e);
    if (had) this.changes += 1;
  }

  private relook(id: number, e: WardrobeEntry): void {
    let o = e.outfit;
    if (e.rainHat) {
      const colour = COLOURS.hats[e.profile.seed % COLOURS.hats.length];
      o = { ...o, hat: 'cap', hatColour: colour, styles: { ...o.styles, hat: { colour } }, adjusted: `${o.adjusted ? `${o.adjusted}; ` : ''}cap for the rain` };
    }
    e.look = toStreetLook(e.profile, o);
    e.serial = (e.serial + 1) & 4095;
    e.key = id * 4096 + e.serial;
  }
}
