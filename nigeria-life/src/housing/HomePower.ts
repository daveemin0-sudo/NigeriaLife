import { BackendService } from '../backend/BackendService';
import { profileKey } from '../backend/Profile';
import { HouseDecorationSystem } from './HouseDecorationSystem';
import { areaName, bandWords, hasLight, hourWords, nextChange } from '../life/Grid';
import { PETROL_PER_LITRE, petrolPolicy } from '../world/Fuel';

/**
 * Light at home. NEPA gives it by the area's plan (src/life/Grid.ts); when it goes, what the
 * player has bought keeps the house going, or does not:
 *
 *   - A solar inverter's batteries, charged by NEPA and by the sun, run everything, silently,
 *     until they are flat.
 *   - A Mikano changes over by itself when NEPA goes and runs everything, on diesel.
 *   - A Tiger is started by hand, runs on petrol, and is too small for an AC, a freezer, a
 *     fridge, a washing machine, a microwave or a jacuzzi. The neighbours hear it at night.
 *   - Without any, what needs power stops. A gas cooker, a kerosene stove, the rechargeable fan,
 *     the gramophone, the toilet and a bucket bath do not need it.
 *
 * Fuel and battery are worked out by the game clock, so a generator left on while the game was
 * shut has burned what it would have.
 */

/** What stops in a blackout, and whether it is too big for a small generator */
const HEAVY = new Set(['split_ac', 'deep_freezer', 'double_door_fridge', 'washing_machine', 'microwave_oven', 'blender_toaster', 'jacuzzi_spa']);
const LIGHT = new Set(['tv_75', 'home_cinema', 'hifi_soundbar', 'ps5_station', 'dual_pc_setup', 'home_gym', 'creator_ringlight', 'smart_mirror']);

export function needsPower(modelType: string): 'heavy' | 'light' | null {
  return HEAVY.has(modelType) ? 'heavy' : LIGHT.has(modelType) ? 'light' : null;
}

/** Diesel at the pump, per litre */
export const DIESEL_PER_LITRE = 1_150;
/** What whoever goes to the filling station for you is given */
export const ERRAND_FEE = 500;

interface GenSpec {
  name: string;
  tank: number;
  /** Litres an hour */
  burn: number;
  fuel: 'petrol' | 'diesel';
  heavy: boolean;
  /** Starts by itself when NEPA goes (an automatic changeover) */
  auto: boolean;
}

const GENERATORS: Record<string, GenSpec> = {
  generator_small: { name: 'Tiger generator', tank: 4, burn: 0.5, fuel: 'petrol', heavy: false, auto: false },
  generator_big: { name: 'Mikano generator', tank: 60, burn: 4, fuel: 'diesel', heavy: true, auto: true },
};
const INVERTER = 'solar_inverter';
/** Battery, in percent an hour */
const CHARGE_FROM_NEPA = 25;
const CHARGE_FROM_SUN = 12;
const DRAIN = 8;
const DRAIN_HEAVY = 12;
/** Days of a generator left on, or a battery, worked out when the player comes back at most */
const CATCH_UP_HOURS = 14 * 24;

interface GenState {
  litres: number;
  /** A Tiger: started by hand. A Mikano: left on automatic. */
  on: boolean;
}

interface HomeState {
  gens: Record<string, GenState>;
  batteries: Record<string, number>;
  /** The game hour (day × 24 + hour) everything was worked out to */
  at: number;
}

export type Source = 'nepa' | 'own' | 'inverter' | 'mikano' | 'tiger' | 'none';

export interface Supply {
  /** NEPA has light in the area now */
  grid: boolean;
  /** What the house is running on */
  source: Source;
  /** An AC or a freezer can run */
  heavy: boolean;
  /** Anything that needs power can run */
  any: boolean;
}

export interface Where {
  area: string;
  city: string;
  /** An estate with its own power plant */
  own: boolean;
}

export class HomePower {
  private static instance: HomePower | null = null;
  public static get(): HomePower {
    return (HomePower.instance ??= new HomePower());
  }

  /** The home the player is in or last came home to, and where it is (set by the game) */
  public where: () => Where | null = () => null;
  /** Which of the player's homes it is (set by the game) */
  public homeId: () => string = () => 'main';
  /** The game day and hour now (set by the game) */
  public clock: () => { day: number; hour: number } = () => ({ day: 0, hour: 12 });

  private homes: Record<string, HomeState> = {};
  private listeners: Array<() => void> = [];
  private lastKey = '';
  private readonly key = profileKey('nl_home_power_v1');

  private constructor() {
    try {
      const saved = JSON.parse(localStorage.getItem(this.key) || '{}');
      if (saved && typeof saved === 'object') this.homes = saved;
    } catch {
      this.homes = {};
    }
  }

  private save(): void {
    try {
      localStorage.setItem(this.key, JSON.stringify(this.homes));
    } catch {
      // Kept for this visit only
    }
  }

  public subscribe(listener: () => void): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  private now(): number {
    const { day, hour } = this.clock();
    return day * 24 + hour;
  }

  /** The power pieces standing in this home now: generators and inverters, by uid */
  private pieces(): { gens: Array<{ uid: string; spec: GenSpec }>; inverters: string[]; heavyLoads: boolean } {
    const decor = HouseDecorationSystem.getInstance();
    const gens: Array<{ uid: string; spec: GenSpec }> = [];
    const inverters: string[] = [];
    let heavyLoads = false;
    for (const item of decor.placed) {
      const spec = GENERATORS[item.modelType];
      if (spec) gens.push({ uid: item.uid, spec });
      else if (item.modelType === INVERTER) inverters.push(item.uid);
      else if (HEAVY.has(item.modelType)) heavyLoads = true;
    }
    return { gens, inverters, heavyLoads };
  }

  private state(): HomeState {
    const id = this.homeId();
    const home = (this.homes[id] ??= { gens: {}, batteries: {}, at: this.now() });
    const { gens, inverters } = this.pieces();
    for (const g of gens) home.gens[g.uid] ??= { litres: 0, on: g.spec.auto };
    for (const uid of inverters) home.batteries[uid] ??= 100;
    return home;
  }

  private gridAt(day: number, hour: number): boolean {
    const where = this.where();
    if (!where || where.own) return true;
    return hasLight(where.area, day, hour, where.city);
  }

  /**
   * Fuel burned and batteries charged or drained from when it was last worked out to now, an
   * hour at a time (a part of an hour at either end).
   */
  public settle(): void {
    const home = this.state();
    const now = this.now();
    let t = Math.max(home.at, now - CATCH_UP_HOURS);
    if (now <= t) {
      home.at = Math.max(home.at, now);
      return;
    }
    const { gens, inverters, heavyLoads } = this.pieces();
    while (t < now - 1e-9) {
      const next = Math.min(now, Math.floor(t) + 1);
      const span = next - t;
      const day = Math.floor(t / 24);
      const hour = t - day * 24;
      const grid = this.gridAt(day, hour);
      const sun = hour >= 8 && hour < 17;
      for (const uid of inverters) {
        home.batteries[uid] = Math.min(100, (home.batteries[uid] ?? 0) + span * ((grid ? CHARGE_FROM_NEPA : 0) + (sun ? CHARGE_FROM_SUN : 0)));
      }
      if (grid) {
        // NEPA is back: a Tiger is switched off (a Mikano goes back to standing by)
        for (const g of gens) if (!g.spec.auto) home.gens[g.uid].on = false;
      } else {
        const battery = inverters.find((uid) => (home.batteries[uid] ?? 0) > 0);
        if (battery) {
          home.batteries[battery] = Math.max(0, home.batteries[battery] - span * (heavyLoads ? DRAIN_HEAVY : DRAIN));
        } else {
          const running = this.runningGen(gens, home);
          if (running) {
            const s = home.gens[running.uid];
            s.litres = Math.max(0, s.litres - span * running.spec.burn);
            if (s.litres <= 0 && !running.spec.auto) s.on = false;
          }
        }
      }
      t = next;
    }
    home.at = now;
    this.save();
  }

  /** The generator that would be running with NEPA off: a Mikano on automatic first, then a Tiger started by hand */
  private runningGen(gens: Array<{ uid: string; spec: GenSpec }>, home: HomeState): { uid: string; spec: GenSpec } | null {
    const fuelled = gens.filter((g) => home.gens[g.uid]?.on && home.gens[g.uid].litres > 0);
    return fuelled.find((g) => g.spec.auto) ?? fuelled[0] ?? null;
  }

  /** What the home has to run on now */
  public supply(): Supply {
    this.settle();
    const where = this.where();
    if (where?.own) return { grid: true, source: 'own', heavy: true, any: true };
    const { day, hour } = this.clock();
    const grid = this.gridAt(day, hour);
    if (grid) return { grid, source: 'nepa', heavy: true, any: true };
    const home = this.state();
    const { gens, inverters } = this.pieces();
    if (inverters.some((uid) => (home.batteries[uid] ?? 0) > 0)) return { grid, source: 'inverter', heavy: true, any: true };
    const running = this.runningGen(gens, home);
    if (running) return { grid, source: running.spec.auto ? 'mikano' : 'tiger', heavy: running.spec.heavy, any: true };
    return { grid, source: 'none', heavy: false, any: false };
  }

  /** Whether this piece works now, or why not in words */
  public whyNot(modelType: string, name: string): string | null {
    const need = needsPower(modelType);
    if (!need) return null;
    const supply = this.supply();
    if (need === 'heavy' ? supply.heavy : supply.any) return null;
    if (supply.source === 'tiger') return `The Tiger generator is too small for the ${name}. It runs the lights, a fan, the TV and the PS5, not an AC, a freezer or a washing machine.`;
    return this.noLight();
  }

  /** "No light: NEPA took it at 2 pm in Mushin…" */
  public noLight(): string {
    const where = this.where();
    const { day, hour } = this.clock();
    const back = where ? nextChange(where.area, day, hour, where.city) : null;
    const { gens, inverters } = this.pieces();
    const home = this.state();
    const fix = inverters.length
      ? 'The inverter battery is flat.'
      : gens.length
        ? gens.some((g) => home.gens[g.uid].litres <= 0) ? 'The generator needs fuel.' : 'Start the generator.'
        : 'A generator or an inverter would keep it on.';
    return `No light. NEPA has taken it${where ? ` in ${areaName(where.area)}` : ''}${back ? `, and it should be back about ${hourWords(back.hour)}` : ''}. ${fix}`;
  }

  /** One line for the phone and the door: the band, and light now or when it comes back */
  public describe(): string {
    const where = this.where();
    if (!where) return '';
    if (where.own) return `${areaName(where.area)} has ${bandWords(where.area, where.city)}.`;
    const supply = this.supply();
    const { day, hour } = this.clock();
    const change = nextChange(where.area, day, hour, where.city);
    const now = supply.grid
      ? `NEPA has light now${change ? ` until about ${hourWords(change.hour)}` : ''}.`
      : `No NEPA light now${change ? `; it should be back about ${hourWords(change.hour)}` : ''}. ${this.sourceWords(supply)}`;
    return `${areaName(where.area)}: ${bandWords(where.area, where.city)}. ${now}`;
  }

  public sourceWords(supply: Supply): string {
    if (supply.source === 'inverter') return `The inverter is running the house (battery ${Math.round(this.battery() ?? 0)}%).`;
    if (supply.source === 'mikano') return 'The Mikano changed over and is running the house.';
    if (supply.source === 'tiger') return 'The Tiger is running the lights, the fan and the TV.';
    if (supply.source === 'none') return 'Nothing that needs power works.';
    return '';
  }

  /** The fullest inverter battery in this home, or null without one */
  public battery(): number | null {
    const home = this.state();
    const { inverters } = this.pieces();
    if (!inverters.length) return null;
    return Math.max(...inverters.map((uid) => home.batteries[uid] ?? 0));
  }

  public generator(uid: string): { spec: GenSpec; litres: number; on: boolean; running: boolean } | null {
    const item = HouseDecorationSystem.getInstance().placed.find((p) => p.uid === uid);
    const spec = item ? GENERATORS[item.modelType] : undefined;
    if (!spec) return null;
    this.settle();
    const s = this.state().gens[uid];
    const supply = this.supply();
    const running = !supply.grid && s.on && s.litres > 0 && (supply.source === 'mikano' || supply.source === 'tiger') && this.runningGen(this.pieces().gens, this.state())?.uid === uid;
    return { spec, litres: s.litres, on: s.on, running };
  }

  /** A Tiger started by hand, or a Mikano put on automatic. Why not, if it cannot. */
  public start(uid: string): { ok: boolean; message: string } {
    const gen = this.generator(uid);
    if (!gen) return { ok: false, message: 'That is not a generator.' };
    if (gen.litres <= 0) return { ok: false, message: `The ${gen.spec.name}'s tank is empty. Send for ${gen.spec.fuel} first.` };
    if (!gen.spec.auto && this.supply().grid) return { ok: false, message: 'NEPA has light now. There is no need to burn petrol.' };
    this.state().gens[uid].on = true;
    this.save();
    this.changed();
    if (gen.spec.auto) return { ok: true, message: `The ${gen.spec.name} is on automatic: it starts itself when NEPA goes.` };
    return { ok: true, message: `Vroom! The ${gen.spec.name} is running: lights, the fan and the TV are back. It burns about ${gen.spec.burn} litres an hour.` };
  }

  public stop(uid: string): { ok: boolean; message: string } {
    const gen = this.generator(uid);
    if (!gen) return { ok: false, message: 'That is not a generator.' };
    this.state().gens[uid].on = false;
    this.save();
    this.changed();
    return { ok: true, message: gen.spec.auto ? `The ${gen.spec.name} is off automatic and will not start by itself.` : `You switch the ${gen.spec.name} off.` };
  }

  /** What filling the tank costs: the litres it takes at the pump price, and the errand */
  public fillQuote(uid: string): { litres: number; cost: number } | null {
    const gen = this.generator(uid);
    if (!gen) return null;
    const litres = Math.max(0, Math.round((gen.spec.tank - gen.litres) * 10) / 10);
    const perLitre = gen.spec.fuel === 'petrol' ? PETROL_PER_LITRE * petrolPolicy.factor() : DIESEL_PER_LITRE;
    return { litres, cost: Math.round((litres * perLitre) / 50) * 50 + ERRAND_FEE };
  }

  /** Someone is sent to the filling station with a jerry can, and the tank is filled from it */
  public fill(uid: string): { ok: boolean; message: string } {
    const gen = this.generator(uid);
    const quote = this.fillQuote(uid);
    if (!gen || !quote) return { ok: false, message: 'That is not a generator.' };
    if (quote.litres < 0.1) return { ok: false, message: `The ${gen.spec.name}'s tank is already full.` };
    const paid = BackendService.getInstance().processTransaction({
      type: 'SHOP_PURCHASE',
      amount: quote.cost,
      description: `${gen.spec.fuel === 'petrol' ? 'Petrol' : 'Diesel'} for the ${gen.spec.name} (${quote.litres} litres, fetched)`,
      source: 'wallet',
    });
    if (!paid.success) return { ok: false, message: `${quote.litres} litres of ${gen.spec.fuel} and the errand come to ₦${quote.cost.toLocaleString()}. You do not have it.` };
    this.state().gens[uid].litres = gen.spec.tank;
    this.save();
    this.changed();
    return { ok: true, message: `The boy comes back from the filling station with ${quote.litres} litres of ${gen.spec.fuel}, and you fill the ${gen.spec.name}: ₦${quote.cost.toLocaleString()}.` };
  }

  /** Called often (the game loop): tells listeners when what the home runs on has changed */
  public tick(): void {
    const s = this.supply();
    const key = `${this.homeId()}|${s.grid}|${s.source}|${s.heavy}`;
    if (key === this.lastKey) return;
    this.lastKey = key;
    this.changed();
  }

  private changed(): void {
    this.lastKey = '';
    const s = this.supply();
    this.lastKey = `${this.homeId()}|${s.grid}|${s.source}|${s.heavy}`;
    for (const listener of this.listeners) listener();
  }
}
