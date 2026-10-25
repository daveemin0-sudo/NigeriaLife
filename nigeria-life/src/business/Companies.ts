import { BackendService } from '../backend/BackendService';
import { profileKey } from '../backend/Profile';
import type { BusinessEnterprise } from '../backend/types';

/**
 * A business the player owns, run as a company: people hired into its roles and paid by the
 * day, branches opened in other parts of Lagos and paying rent, and at the end of each day a
 * report of what was taken, what was paid out in wages, rent and tax, and what was left.
 *
 * Staff lift the takings (a cook in a buka, a pharmacist in a pharmacy), one of each role per
 * outlet. A manager at every outlet banks the takings at the close of each day, so the owner
 * need not collect them. Tax is company income tax: nothing for a small company (turnover under
 * ₦100m a year, as the law has it), 30% of the profit above that.
 */

export type RoleId = 'manager' | 'cashier' | 'cook' | 'server' | 'pharmacist' | 'barber' | 'mechanic' | 'driver' | 'conductor' | 'attendant' | 'technician' | 'security' | 'cleaner';

export interface Role {
  id: RoleId;
  title: string;
  icon: string;
  /** Paid at the close of each day, ₦ */
  wage: number;
  /** What one at every outlet adds to the takings */
  lift: number;
  outfit: number;
  /** What they say when the owner stops by */
  says: string;
}

export const ROLES: Record<RoleId, Role> = {
  manager: { id: 'manager', title: 'Manager', icon: '👔', wage: 15000, lift: 0.1, outfit: 0x0f172a, says: 'Oga, everything is in order. I will bank today\'s takings at close.' },
  cashier: { id: 'cashier', title: 'Cashier', icon: '🧾', wage: 4000, lift: 0.1, outfit: 0x2563eb, says: 'The till is balanced, sir. No shortage.' },
  cook: { id: 'cook', title: 'Cook', icon: '👩‍🍳', wage: 5000, lift: 0.18, outfit: 0xf8fafc, says: 'The pot don ready! Customers dey come back for my stew.' },
  server: { id: 'server', title: 'Server', icon: '🍽️', wage: 3500, lift: 0.08, outfit: 0xdc2626, says: 'Table four wants more meat, sir.' },
  pharmacist: { id: 'pharmacist', title: 'Pharmacist', icon: '💊', wage: 12000, lift: 0.22, outfit: 0xf8fafc, says: 'Every prescription checked twice.' },
  barber: { id: 'barber', title: 'Barber', icon: '💈', wage: 4500, lift: 0.18, outfit: 0x111827, says: 'Low cut, punk, fade: my clippers no dey rest.' },
  mechanic: { id: 'mechanic', title: 'Mechanic', icon: '🔧', wage: 6000, lift: 0.2, outfit: 0x1e40af, says: 'Three cars today. All of them drove out sweet.' },
  driver: { id: 'driver', title: 'Driver', icon: '🚌', wage: 6000, lift: 0.22, outfit: 0xfacc15, says: 'Oshodi, CMS, back. The bus dey full every trip.' },
  conductor: { id: 'conductor', title: 'Conductor', icon: '🗣️', wage: 3500, lift: 0.1, outfit: 0xf59e0b, says: 'I don collect every fare, no shortage!' },
  attendant: { id: 'attendant', title: 'Attendant', icon: '🙋', wage: 3500, lift: 0.1, outfit: 0x16a34a, says: 'Customers are happy, sir.' },
  technician: { id: 'technician', title: 'Technician', icon: '🛠️', wage: 6000, lift: 0.15, outfit: 0x7c3aed, says: 'Every machine is working.' },
  security: { id: 'security', title: 'Security', icon: '💂', wage: 3000, lift: 0.05, outfit: 0x1f2937, says: 'Nobody go try anything here, oga.' },
  cleaner: { id: 'cleaner', title: 'Cleaner', icon: '🧹', wage: 2300, lift: 0.04, outfit: 0x0e7490, says: 'The place dey shine.' },
};

/** The roles each business has, the one who runs it last */
const ROLE_SETS: Record<string, RoleId[]> = {
  biz_mama_put: ['cook', 'server', 'cashier', 'cleaner', 'manager'],
  biz_pos_kiosk: ['attendant', 'security', 'manager'],
  biz_bet_lounge: ['cashier', 'technician', 'security', 'cleaner', 'manager'],
  biz_danfo_fleet: ['driver', 'conductor', 'manager'],
  biz_oando: ['attendant', 'cashier', 'security', 'manager'],
  biz_pharmacy: ['pharmacist', 'cashier', 'cleaner', 'manager'],
  biz_slot: ['technician', 'cashier', 'security', 'manager'],
  biz_barber: ['barber', 'cashier', 'cleaner', 'manager'],
  biz_mechanic: ['mechanic', 'cleaner', 'manager'],
};
const DEFAULT_ROLES: RoleId[] = ['cashier', 'attendant', 'security', 'cleaner', 'manager'];

export interface Area {
  id: string;
  name: string;
  /** What opening there costs, as a share of the business's price */
  cost: number;
  /** What it takes, against the first outlet */
  takes: number;
}

export const AREAS: Area[] = [
  { id: 'vi', name: 'Victoria Island', cost: 1.1, takes: 1.3 },
  { id: 'lekki', name: 'Lekki Phase 1', cost: 0.95, takes: 1.15 },
  { id: 'ikeja', name: 'Ikeja', cost: 0.75, takes: 1 },
  { id: 'yaba', name: 'Yaba', cost: 0.6, takes: 0.9 },
  { id: 'surulere', name: 'Surulere', cost: 0.55, takes: 0.85 },
  { id: 'ajah', name: 'Ajah', cost: 0.6, takes: 0.85 },
  { id: 'festac', name: 'Festac', cost: 0.5, takes: 0.8 },
  { id: 'ikorodu', name: 'Ikorodu', cost: 0.45, takes: 0.7 },
];

/** A year's rent on a branch, as a share of what opening it cost */
const RENT_A_YEAR = 0.15;
const SMALL_COMPANY_TURNOVER = 100_000_000;
const TAX_RATE = 0.3;
const DAYS_A_YEAR = 365;

export interface Staffer {
  id: string;
  name: string;
  gender: 'male' | 'female';
  role: RoleId;
  wage: number;
  since: number;
}

export interface Branch {
  area: string;
  opened: number;
  /** What it cost to open, for the rent */
  cost: number;
}

export interface DayReport {
  day: number;
  takings: number;
  wages: number;
  rent: number;
  tax: number;
  profit: number;
  /** The takings went to the bank at close (a manager at every outlet) */
  banked: number;
  note?: string;
}

interface Book {
  staff: Staffer[];
  branches: Branch[];
  /** Taken since the last close */
  takings: number;
  /** Wages, rent or tax that could not be paid, carried to the next close */
  owed: number;
  reports: DayReport[];
  closed: number;
}

const STORE = 'nigeria_life_companies_v1';

const FIRST = {
  male: ['Tunde', 'Emeka', 'Musa', 'Chinedu', 'Segun', 'Ibrahim', 'Femi', 'Uche', 'Kunle', 'Yusuf', 'Obinna', 'Dayo', 'Sani', 'Ikenna', 'Gbenga'],
  female: ['Bisi', 'Ngozi', 'Aisha', 'Funke', 'Chioma', 'Kemi', 'Halima', 'Ada', 'Yetunde', 'Amaka', 'Zainab', 'Tolu', 'Nneka', 'Bukola', 'Hauwa'],
};
const SURNAMES = ['Adeyemi', 'Okafor', 'Bello', 'Okonkwo', 'Balogun', 'Abubakar', 'Eze', 'Ogunleye', 'Nwosu', 'Danjuma', 'Afolabi', 'Umeh', 'Lawal', 'Obi', 'Ibrahim'];

export class Companies {
  private static instance: Companies | null = null;
  private readonly backend = BackendService.getInstance();
  private books: Record<string, Book> = {};
  private listeners: Array<() => void> = [];
  /** The game's day, for when people were taken on and branches opened */
  public today: () => number = () => 1;
  /** A game day as the calendar on the top bar names it: "Wed 7 Oct" */
  public dayName: (day: number) => string = (day) => `day ${day}`;
  /** Told when a day's reports are in */
  public onReports: ((reports: Array<{ business: BusinessEnterprise; report: DayReport }>) => void) | null = null;

  public static get(): Companies {
    if (!Companies.instance) Companies.instance = new Companies();
    return Companies.instance;
  }

  private constructor() {
    try {
      const saved = JSON.parse(localStorage.getItem(profileKey(STORE)) || '{}');
      for (const [id, raw] of Object.entries(saved ?? {})) {
        const b = raw as Partial<Book>;
        this.books[id] = {
          staff: Array.isArray(b.staff) ? b.staff.filter((s) => s && ROLES[s.role as RoleId]) : [],
          branches: Array.isArray(b.branches) ? b.branches.filter((x) => x && AREAS.some((a) => a.id === x.area)) : [],
          takings: Math.max(0, Number(b.takings) || 0),
          owed: Math.max(0, Number(b.owed) || 0),
          reports: Array.isArray(b.reports) ? b.reports.slice(0, 14) : [],
          closed: Number(b.closed) || 0,
        };
      }
    } catch {
      // Nothing kept: no company yet
    }
  }

  private save(): void {
    try {
      localStorage.setItem(profileKey(STORE), JSON.stringify(this.books));
    } catch {
      // Kept for this visit only
    }
    for (const listener of this.listeners) listener();
  }

  public subscribe(listener: () => void): void {
    this.listeners.push(listener);
  }

  private business(id: string): BusinessEnterprise | null {
    return this.backend.getData().businesses.find((b) => b.id === id && b.owned) ?? null;
  }

  private book(id: string): Book {
    return (this.books[id] ??= { staff: [], branches: [], takings: 0, owed: 0, reports: [], closed: this.today() - 1 });
  }

  public roles(bizId: string): Role[] {
    return (ROLE_SETS[bizId] ?? DEFAULT_ROLES).map((id) => ROLES[id]);
  }

  public staff(bizId: string): readonly Staffer[] {
    return this.books[bizId]?.staff ?? [];
  }

  public branches(bizId: string): readonly Branch[] {
    return this.books[bizId]?.branches ?? [];
  }

  public reports(bizId: string): readonly DayReport[] {
    return this.books[bizId]?.reports ?? [];
  }

  public takenToday(bizId: string): number {
    return this.books[bizId]?.takings ?? 0;
  }

  /** The first shop and every branch */
  public outlets(bizId: string): number {
    return 1 + this.branches(bizId).length;
  }

  /** How many in this role there is room for: one at each outlet */
  public room(bizId: string, role: RoleId): number {
    return this.outlets(bizId) - this.staff(bizId).filter((s) => s.role === role).length;
  }

  /** What the staff add to the takings: each role's lift, in full when every outlet has one */
  public lift(bizId: string): number {
    const outlets = this.outlets(bizId);
    return 1 + this.roles(bizId).reduce((sum, role) => sum + role.lift * Math.min(1, this.staff(bizId).filter((s) => s.role === role.id).length / outlets), 0);
  }

  /** A manager at every outlet: the takings are banked at the close of the day */
  public managed(bizId: string): boolean {
    return this.staff(bizId).filter((s) => s.role === 'manager').length >= this.outlets(bizId);
  }

  public wages(bizId: string): number {
    return this.staff(bizId).reduce((sum, s) => sum + s.wage, 0);
  }

  public rent(bizId: string): number {
    return this.branches(bizId).reduce((sum, b) => sum + Math.round((b.cost * RENT_A_YEAR) / DAYS_A_YEAR), 0);
  }

  /** What one payout comes to: the first outlet (with its upgrades) and the branches, lifted by the staff */
  public perCycle(biz: BusinessEnterprise, first: number): number {
    const branches = this.branches(biz.id).reduce((sum, b) => sum + biz.baseIncomePerCycle * (AREAS.find((a) => a.id === b.area)?.takes ?? 0), 0);
    return Math.round((first + branches) * this.lift(biz.id));
  }

  /** Counted as it comes in, for the day's report */
  public took(bizId: string, amount: number): void {
    if (!this.business(bizId) || amount <= 0) return;
    this.book(bizId).takings += amount;
    this.save();
  }

  /** Someone new for a role, with a name: they start today and are paid at each close */
  public hire(bizId: string, role: RoleId): { ok: boolean; reason?: string; staffer?: Staffer } {
    const biz = this.business(bizId);
    if (!biz) return { ok: false, reason: 'You do not own that business.' };
    if (!this.roles(bizId).some((r) => r.id === role)) return { ok: false, reason: `${biz.name} has no ${ROLES[role].title.toLowerCase()}s.` };
    if (this.room(bizId, role) <= 0) return { ok: false, reason: `There is a ${ROLES[role].title.toLowerCase()} at every outlet already. Open a branch to take on more.` };
    const book = this.book(bizId);
    const gender: 'male' | 'female' = Math.random() < 0.5 ? 'male' : 'female';
    const taken = new Set(book.staff.map((s) => s.name));
    let name = '';
    for (let i = 0; i < 20 && (!name || taken.has(name)); i++) name = `${FIRST[gender][Math.floor(Math.random() * FIRST[gender].length)]} ${SURNAMES[Math.floor(Math.random() * SURNAMES.length)]}`;
    const staffer: Staffer = { id: `${bizId}_${Date.now().toString(36)}${Math.floor(Math.random() * 1e4)}`, name, gender, role, wage: ROLES[role].wage, since: this.today() };
    book.staff.push(staffer);
    this.save();
    return { ok: true, staffer };
  }

  /** Let go, with a day's pay in hand */
  public dismiss(bizId: string, stafferId: string): { ok: boolean; reason?: string } {
    const book = this.books[bizId];
    const staffer = book?.staff.find((s) => s.id === stafferId);
    if (!book || !staffer) return { ok: false, reason: 'They do not work there.' };
    const paid = this.backend.processTransaction({ type: 'BUSINESS_EXPENSE', amount: staffer.wage, description: `A day's pay for ${staffer.name}, let go`, source: 'bank', funding: 'split' });
    if (!paid.success) return { ok: false, reason: `You need ₦${staffer.wage.toLocaleString()} to pay ${staffer.name} off.` };
    book.staff = book.staff.filter((s) => s.id !== stafferId);
    this.save();
    return { ok: true };
  }

  /** What a branch in an area costs to open */
  public branchCost(bizId: string, areaId: string): number {
    const biz = this.business(bizId);
    const area = AREAS.find((a) => a.id === areaId);
    return biz && area ? Math.round((biz.purchasePrice * area.cost) / 1000) * 1000 : 0;
  }

  public openBranch(bizId: string, areaId: string): { ok: boolean; reason?: string } {
    const biz = this.business(bizId);
    const area = AREAS.find((a) => a.id === areaId);
    if (!biz || !area) return { ok: false, reason: 'There is no such place.' };
    if (this.branches(bizId).some((b) => b.area === areaId)) return { ok: false, reason: `${biz.name} already has a branch in ${area.name}.` };
    const cost = this.branchCost(bizId, areaId);
    const paid = this.backend.processTransaction({ type: 'BUSINESS_PURCHASE', amount: cost, description: `${biz.name}: a branch in ${area.name}`, source: 'bank', funding: 'split' });
    if (!paid.success) return { ok: false, reason: `A branch in ${area.name} costs ₦${cost.toLocaleString()}. You do not have it.` };
    this.book(bizId).branches.push({ area: areaId, opened: this.today(), cost });
    this.save();
    return { ok: true };
  }

  /**
   * The close of a day, for every business the player owns: the day's takings, the wages, the
   * branches' rent and the tax, paid from the till first and then the bank; the rest banked if
   * a manager runs every outlet. Staff who cannot be paid walk out.
   */
  public closeDay(day: number): Array<{ business: BusinessEnterprise; report: DayReport }> {
    const out: Array<{ business: BusinessEnterprise; report: DayReport }> = [];
    // Businesses sold or lost: their staff and branches go with them
    for (const id of Object.keys(this.books)) if (!this.business(id)) delete this.books[id];
    for (const biz of this.backend.getData().businesses.filter((b) => b.owned)) {
      const book = this.book(biz.id);
      if (book.closed >= day) continue;
      book.closed = day;
      const takings = Math.round(book.takings);
      const wages = this.wages(biz.id);
      const rent = this.rent(biz.id);
      const profit = takings - wages - rent;
      const tax = takings * DAYS_A_YEAR > SMALL_COMPANY_TURNOVER ? Math.round(Math.max(0, profit) * TAX_RATE) : 0;
      let due = wages + rent + tax + book.owed;
      let note: string | undefined;
      // From the till first
      due -= this.backend.takeFromTill(biz.id, due);
      if (due > 0) {
        const paid = this.backend.processTransaction({ type: 'BUSINESS_EXPENSE', amount: due, description: `${biz.name}: wages, rent and tax, day ${day}`, source: 'bank', funding: 'split' });
        if (paid.success) due = 0;
      }
      book.owed = 0;
      if (due > 0) {
        // Not enough anywhere: the staff walk out unpaid, and the rest is owed till tomorrow
        const walked = book.staff.length;
        book.owed = Math.max(0, due - wages);
        book.staff = [];
        note = walked ? `There was not enough to pay wages: ${walked === 1 ? 'your one worker' : `all ${walked} staff`} walked out.` : 'There was not enough to pay the rent and tax. It is owed.';
      }
      let banked = 0;
      if (this.managed(biz.id)) banked = this.backend.collectBusinessRevenue(biz.id).totalCollected;
      const report: DayReport = { day, takings, wages, rent, tax, profit: takings - wages - rent - tax, banked, note };
      book.reports.unshift(report);
      book.reports = book.reports.slice(0, 14);
      book.takings = 0;
      out.push({ business: biz, report });
    }
    this.save();
    if (out.length) this.onReports?.(out);
    return out;
  }
}
