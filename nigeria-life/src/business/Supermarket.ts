import { BackendService } from '../backend/BackendService';
import { profileKey } from '../backend/Profile';
import { Companies } from './Companies';

/**
 * A supermarket the player owns and runs: stock bought from the wholesaler by the carton and
 * stacked in the stockroom, eight shelf bays the owner lays out (which line goes where), and
 * cartons carried out to fill them. Customers buy from what is on the shelves, so an empty
 * shelf sells nothing. Drinks and snacks by the tills sell more (people pick them up while they
 * queue); the more lines on the shelves, the more people come. Shelf stackers on the staff
 * keep the shelves topped up from the stockroom.
 */

export const SUPERMARKET = 'biz_supermarket';

export interface Line {
  id: string;
  name: string;
  icon: string;
  /** The colours of what is on the shelf */
  colours: number[];
  carton: string;
  /** How many go in one carton */
  units: number;
  /** What a carton costs from the wholesaler, ₦ */
  cost: number;
  /** What one sells for on the shelf, ₦ */
  retail: number;
  /** Sells more by the tills (picked up in the queue) */
  impulse?: boolean;
}

export const LINES: Line[] = [
  { id: 'drinks', name: 'Soft drinks', icon: '🥤', colours: [0xdc2626, 0x16a34a, 0xf97316], carton: 'pack of 24 cans', units: 24, cost: 14_400, retail: 800, impulse: true },
  { id: 'snacks', name: 'Biscuits & snacks', icon: '🍪', colours: [0xfacc15, 0x7c2d12, 0x2563eb], carton: 'carton of 48', units: 48, cost: 9_600, retail: 300, impulse: true },
  { id: 'noodles', name: 'Noodles', icon: '🍜', colours: [0xfacc15, 0xdc2626], carton: 'carton of 40 packs', units: 40, cost: 11_200, retail: 400 },
  { id: 'rice', name: 'Rice, 5 kg bags', icon: '🍚', colours: [0xf5f5f4, 0x16a34a], carton: 'bundle of 6 bags', units: 6, cost: 48_000, retail: 10_000 },
  { id: 'oil', name: 'Cooking oil', icon: '🫗', colours: [0xfde047, 0xca8a04], carton: 'carton of 12 litres', units: 12, cost: 26_400, retail: 2_900 },
  { id: 'bread', name: 'Bread & milk', icon: '🍞', colours: [0xd97706, 0xf8fafc, 0x1d4ed8], carton: 'tray of 20', units: 20, cost: 20_000, retail: 1_400 },
  { id: 'frozen', name: 'Frozen chicken & fish', icon: '🍗', colours: [0xe0f2fe, 0xfecaca], carton: 'carton of 10 kg', units: 10, cost: 38_000, retail: 4_800 },
  { id: 'toiletries', name: 'Soap & toothpaste', icon: '🧼', colours: [0x0ea5e9, 0xf8fafc, 0xdb2777], carton: 'carton of 24', units: 24, cost: 19_200, retail: 1_100 },
  { id: 'cleaning', name: 'Detergent & bleach', icon: '🧴', colours: [0x2563eb, 0xf8fafc], carton: 'carton of 12', units: 12, cost: 18_000, retail: 2_000 },
  { id: 'baby', name: 'Diapers & baby food', icon: '🍼', colours: [0x93c5fd, 0xfbcfe8], carton: 'bale of 6 packs', units: 6, cost: 42_000, retail: 9_000 },
];

/** Shelf bays: the four nearest the tills first */
export const BAYS = 8;
export const FRONT_BAYS = 4;
/** How many cartons a bay holds when it is full */
export const BAY_CARTONS = 8;
/** What one bay sells in a payout at best, in cartons */
const SELLS_A_PAYOUT = 1;
/** What one shelf stacker carries out in a payout, in cartons */
const STACKER_CARTONS = 3;

export interface Bay {
  line: string | null;
  units: number;
}

interface State {
  bays: Bay[];
  /** In the stockroom, by line, in units */
  back: Record<string, number>;
}

const STORE = 'nigeria_life_supermarket_v1';

export const lineOf = (id: string | null): Line | null => LINES.find((l) => l.id === id) ?? null;
export const bayCapacity = (line: Line) => line.units * BAY_CARTONS;

export class Supermarket {
  private static instance: Supermarket | null = null;
  private readonly backend = BackendService.getInstance();
  private state: State = { bays: Array.from({ length: BAYS }, () => ({ line: null, units: 0 })), back: {} };
  private listeners: Array<() => void> = [];

  public static get(): Supermarket {
    if (!Supermarket.instance) Supermarket.instance = new Supermarket();
    return Supermarket.instance;
  }

  private constructor() {
    try {
      const saved = JSON.parse(localStorage.getItem(profileKey(STORE)) || 'null') as State | null;
      if (saved && Array.isArray(saved.bays)) {
        this.state.bays = this.state.bays.map((_, i) => {
          const b = saved.bays[i];
          const line = lineOf(b?.line ?? null);
          return line ? { line: line.id, units: Math.max(0, Math.min(bayCapacity(line), Math.floor(Number(b.units) || 0))) } : { line: null, units: 0 };
        });
        for (const line of LINES) if (Number(saved.back?.[line.id]) > 0) this.state.back[line.id] = Math.floor(Number(saved.back[line.id]));
      }
    } catch {
      // Starts empty
    }
  }

  private save(): void {
    try {
      localStorage.setItem(profileKey(STORE), JSON.stringify(this.state));
    } catch {
      // Kept for this visit only
    }
    for (const listener of this.listeners) listener();
  }

  public subscribe(listener: () => void): void {
    this.listeners.push(listener);
  }

  public owned(): boolean {
    return this.backend.getData().businesses.some((b) => b.id === SUPERMARKET && b.owned);
  }

  public bays(): readonly Bay[] {
    return this.state.bays;
  }

  /** In the stockroom, in units */
  public inBack(lineId: string): number {
    return this.state.back[lineId] ?? 0;
  }

  /** Whole cartons in the stockroom (a part carton counts as one) */
  public cartonsInBack(lineId: string): number {
    const line = lineOf(lineId);
    return line ? Math.ceil(this.inBack(lineId) / line.units) : 0;
  }

  /** Cartons bought from the wholesaler, delivered to the stockroom */
  public order(lineId: string, cartons: number): { ok: boolean; reason?: string; cost?: number } {
    const line = lineOf(lineId);
    if (!line || cartons <= 0) return { ok: false, reason: 'The wholesaler does not sell that.' };
    if (!this.owned()) return { ok: false, reason: 'Only the owner orders stock.' };
    const cost = line.cost * cartons;
    const paid = this.backend.processTransaction({ type: 'BUSINESS_EXPENSE', amount: cost, description: `Stock: ${cartons} × ${line.carton} of ${line.name.toLowerCase()}`, source: 'bank', funding: 'split' });
    if (!paid.success) return { ok: false, reason: `That is ₦${cost.toLocaleString()}. You do not have it.` };
    this.state.back[lineId] = this.inBack(lineId) + line.units * cartons;
    Companies.get().boughtStock(SUPERMARKET, cost);
    this.save();
    return { ok: true, cost };
  }

  /** A bay given over to a line: whatever was on it goes to the back */
  public layOut(bay: number, lineId: string | null): { ok: boolean; reason?: string } {
    const b = this.state.bays[bay];
    if (!b) return { ok: false, reason: 'There is no such shelf.' };
    if (lineId && !lineOf(lineId)) return { ok: false, reason: 'There is no such line.' };
    if (b.line && b.units > 0) this.state.back[b.line] = this.inBack(b.line) + b.units;
    this.state.bays[bay] = { line: lineId, units: 0 };
    this.save();
    return { ok: true };
  }

  /** One carton from the back onto a bay. Returns how many units went on. */
  public stack(bay: number): number {
    const b = this.state.bays[bay];
    const line = lineOf(b?.line ?? null);
    if (!b || !line) return 0;
    const room = bayCapacity(line) - b.units;
    const moved = Math.min(room, line.units, this.inBack(line.id));
    if (moved <= 0) return 0;
    b.units += moved;
    this.state.back[line.id] = this.inBack(line.id) - moved;
    this.save();
    return moved;
  }

  /** Why a carton cannot go onto this bay now, or null if it can */
  public cannotStack(bay: number): string | null {
    const b = this.state.bays[bay];
    const line = lineOf(b?.line ?? null);
    if (!b || !line) return 'Choose what goes on this shelf first.';
    if (b.units >= bayCapacity(line)) return 'This shelf is full.';
    if (this.inBack(line.id) <= 0) return `There is no ${line.name.toLowerCase()} in the stockroom. Order some at the desk.`;
    return null;
  }

  /** How well the shop is laid out: more lines on the shelves bring more people in */
  public variety(): number {
    const lines = new Set(this.state.bays.filter((b) => b.line && b.units > 0).map((b) => b.line));
    return 0.8 + 0.05 * lines.size;
  }

  /** How fast a bay sells, for where it is and what is on it */
  public pace(bay: number): number {
    const line = lineOf(this.state.bays[bay]?.line ?? null);
    if (!line) return 0;
    const front = bay < FRONT_BAYS;
    return line.impulse ? (front ? 1.25 : 0.85) : front ? 0.95 : 1.05;
  }

  /**
   * Some payouts' trade: the stackers fill the emptiest shelves from the back, then customers buy
   * from what is on the shelves. Returns the money taken.
   */
  public trade(cycles: number, lift: number, stackers: number): number {
    let taken = 0;
    for (let c = 0; c < cycles; c++) {
      // The stackers first
      for (let n = 0; n < stackers * STACKER_CARTONS; n++) {
        const candidates = this.state.bays.map((b, i) => ({ b, i, line: lineOf(b.line) })).filter((x) => x.line && x.b.units < bayCapacity(x.line) && this.inBack(x.line.id) > 0);
        if (!candidates.length) break;
        candidates.sort((a, z) => a.b.units / bayCapacity(a.line!) - z.b.units / bayCapacity(z.line!));
        this.stack(candidates[0].i);
      }
      const variety = this.variety();
      this.state.bays.forEach((b, i) => {
        const line = lineOf(b.line);
        if (!line || b.units <= 0) return;
        const sold = Math.min(b.units, Math.round(line.units * SELLS_A_PAYOUT * this.pace(i) * variety * lift));
        b.units -= sold;
        taken += sold * line.retail;
      });
    }
    if (cycles > 0) this.save();
    return taken;
  }

  /** The shop as the seller leaves it, for a visitor before anyone buys it: every shelf full */
  public static showroom(): Bay[] {
    const order = ['drinks', 'snacks', 'bread', 'toiletries', 'noodles', 'rice', 'oil', 'frozen'];
    return order.map((id) => ({ line: id, units: bayCapacity(lineOf(id)!) }));
  }
}
