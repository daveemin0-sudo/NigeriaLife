import { BackendService } from '../backend/BackendService';
import type { PlayerAccount, RealEstateProperty } from '../backend/types';
import type { ProcessTransactionRequest, TransactionResult } from '../backend/TransactionService';

/** Moves money on the copy of the save being changed (BackendService.edit) */
type Pay = (req: ProcessTransactionRequest) => TransactionResult;

/**
 * What the player owes each week, settled on the game's calendar (day 0 is Wed 7 Oct 2026, and
 * the clock follows the real date in Lagos).
 *
 * Rent: signing a lease pays the first four weeks. After that, rent is taken every Saturday for
 * the week ahead, from the bank first and then the wallet. A Saturday the player cannot pay, the
 * landlord serves a quit notice: what is owed and this week's rent must be found by the next
 * Saturday, or the player is put out, the locks changed and the key taken back.
 *
 * Loans: an instalment is taken every seven days from the day the money was lent (Lapo's ₦7,500
 * on a ₦50,000 start). A week missed adds a late fee of a tenth of the instalment, at most four
 * times on one loan, and costs street cred. Paid ahead, the next week is skipped. A loan cleared
 * without a missed week counts in the player's favour at the bank, which then lends more.
 *
 * Days that went by while the game was closed are settled when it opens again, in order. Each
 * payment carries its own name to the game server, so two devices on one account pay it once.
 */

export const FIRST_LEASE_DAYS = 28;
export const GRACE_DAYS = 7;
export const LATE_FEE_SHARE = 0.1;
export const MAX_LATE_FEES = 4;
const SATURDAY = 6;

export const LANDLORD = { id: 'dues:landlord', name: 'Alhaji Lateef (landlord)' };
const LENDERS: Record<string, { id: string; name: string }> = {
  'Lapo Microfinance Bank': { id: 'dues:lapo', name: 'Mr Felix (Lapo credit officer)' },
  'Eko Commercial Bank': { id: 'dues:bank', name: 'Eko Commercial Bank loans desk' },
};
const lenderContact = (lender: string) => LENDERS[lender] ?? { id: `dues:${slug(lender)}`, name: lender };

/** What the bank lends, by how many loans the player has cleared without missing a week */
const BANK_OFFERS = [
  { principal: 50_000, repay: 55_000 },
  { principal: 150_000, repay: 165_000 },
  { principal: 500_000, repay: 550_000 },
];

export const dateOfDay = (day: number): Date => new Date(2026, 9, 7 + day);
/** "Sat 14 Nov" */
export const dayLabel = (day: number): string => dateOfDay(day).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
export const isSaturday = (day: number): boolean => dateOfDay(day).getDay() === SATURDAY;
export function nextSaturday(from: number): number {
  let d = from;
  while (!isSaturday(d)) d++;
  return d;
}
export const weeklyRentOf = (prop: RealEstateProperty): number => prop.weeklyRent ?? Math.max(100, Math.round(prop.rentalPriceMonthly / 4));
type Loan = NonNullable<PlayerAccount['activeLoan']>;
export const instalmentOf = (loan: Loan): number => Math.min(loan.amount, Math.max(1, Math.round(loan.weeklyRepayment || loan.amount / 8)));
const lateFeeOf = (loan: Loan): number => Math.round(instalmentOf(loan) * LATE_FEE_SHARE);
const slug = (text: string) => text.replace(/[^\w-]+/g, '-').slice(0, 30);
const naira = (n: number) => `₦${Math.round(n).toLocaleString()}`;

export type DueEvent =
  | { kind: 'rent-paid'; day: number; propId: string; name: string; amount: number }
  | { kind: 'rent-missed'; day: number; propId: string; name: string; owed: number; deadline: number }
  | { kind: 'evicted'; day: number; propId: string; name: string; owed: number }
  | { kind: 'instalment-paid'; day: number; lender: string; amount: number; left: number }
  | { kind: 'instalment-missed'; day: number; lender: string; amount: number; fee: number; owed: number }
  | { kind: 'loan-cleared'; day: number; lender: string; clean: boolean };

export interface LeaseView {
  propId: string;
  name: string;
  weekly: number;
  /** Rent is paid up to (not including) this day */
  paidUntil: number;
  /** When rent is next taken */
  nextDue: number;
  arrears: number;
  /** Set when a quit notice has been served: the day the player is put out if still owing */
  deadline: number | null;
}

export interface LoanView {
  lender: string;
  owed: number;
  instalment: number;
  nextDue: number | null;
  missed: number;
  lateFees: number;
}

export class Dues {
  private static instance: Dues | null = null;
  public static get(): Dues {
    return (Dues.instance ??= new Dues());
  }

  /** The game day now (the sky's) */
  public today: () => number = () => 0;
  /** Told what happened each time days are settled, to show the player */
  public onSettled: ((events: DueEvent[]) => void) | null = null;
  /** The player has just been put out of this home (the game takes them out of it if they are in it) */
  public onEvicted: ((propId: string, name: string) => void) | null = null;
  private listeners = new Set<() => void>();

  private get backend(): BackendService {
    return BackendService.getInstance();
  }

  public subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private changed(): void {
    for (const l of this.listeners) l();
  }

  /** The homes the player rents */
  public leasesHeld(data: PlayerAccount = this.backend.getData()): RealEstateProperty[] {
    return data.properties.filter((p) => p.status === 'rented' && (p.ownerId === data.id || p.id === data.activeHousingId));
  }

  // --- Settling -------------------------------------------------------------------------------

  /** Settles every day after the last one settled, up to `day`, in order. */
  public settleTo(day: number = this.today()): DueEvent[] {
    const events: DueEvent[] = [];
    // The first time (a new game, or a save from before weekly dues), the schedules start today:
    // nothing is charged for weeks gone by
    const first = this.backend.edit((d) => {
      if (d.duesDay !== undefined) return false;
      d.duesDay = day;
      return true;
    });
    if (!first) {
      for (;;) {
        // Each day is claimed and settled on one copy of the save: a second tab that has already
        // settled it is seen at the start, and its payments carry the same names as these
        const next = this.backend.edit((d, pay) => {
          const n = (d.duesDay ?? day) + 1;
          if (n > day) return null;
          d.duesDay = n;
          this.settleDay(d, pay, n, events);
          return n;
        });
        if (next === null) break;
      }
    }
    this.keepSchedules(day);
    for (const e of events) if (e.kind === 'evicted') this.onEvicted?.(e.propId, e.name);
    if (events.length) this.onSettled?.(events);
    this.changed();
    return events;
  }

  /** Every lease has a record and every loan a due day; records of leases given up are dropped */
  private keepSchedules(day: number): void {
    this.backend.edit((d) => {
      const held = new Set(this.leasesHeld(d).map((p) => p.id));
      const leases = (d.leases ??= {});
      for (const id of Object.keys(leases)) if (!held.has(id)) delete leases[id];
      // A lease from before weekly dues: rent is due on the coming Saturday, as it was
      for (const id of held) leases[id] ??= { paidUntil: day + 1, arrears: 0 };
      if (d.activeLoan && d.activeLoan.nextDueDay === undefined) d.activeLoan.nextDueDay = day + 7;
    });
  }

  private settleDay(d: PlayerAccount, pay: Pay, day: number, events: DueEvent[]): void {
    if (isSaturday(day)) for (const prop of this.leasesHeld(d)) this.chargeRent(d, pay, prop, day, events);
    const loan = d.activeLoan;
    if (loan && loan.nextDueDay !== undefined && day >= loan.nextDueDay) this.takeInstalment(d, pay, day, events);
  }

  private canPay(d: PlayerAccount, amount: number): boolean {
    return d.walletCash + d.bank.balance >= amount;
  }

  private chargeRent(d: PlayerAccount, pay: Pay, prop: RealEstateProperty, day: number, events: DueEvent[]): void {
    const lease = d.leases?.[prop.id];
    if (!lease || day < lease.paidUntil) return;
    const weekly = weeklyRentOf(prop);
    const due = lease.arrears + weekly;
    if (this.canPay(d, due)) {
      const paid = pay({
        type: 'RENT_PAYMENT',
        amount: due,
        description: `${lease.arrears ? 'Rent and arrears' : 'Saturday rent'}: ${prop.name}`,
        source: 'bank',
        funding: 'split',
        idem: `due:rent:${slug(prop.id)}:${day}`,
      });
      if (paid.success) {
        const hadNotice = lease.noticeDay !== undefined;
        lease.arrears = 0;
        delete lease.noticeDay;
        lease.paidUntil = day + 7;
        events.push({ kind: 'rent-paid', day, propId: prop.id, name: prop.name, amount: due });
        if (hadNotice) this.text(d, LANDLORD, `I don see the rent for ${prop.name}, ${naira(due)} complete. The quit notice is withdrawn. Thank you.`, day);
        return;
      }
    }
    if (lease.noticeDay !== undefined && day >= lease.noticeDay + GRACE_DAYS) {
      this.evict(d, prop, day, due, events);
      return;
    }
    lease.arrears += weekly;
    lease.noticeDay ??= day;
    lease.paidUntil = day + 7;
    const deadline = lease.noticeDay + GRACE_DAYS;
    events.push({ kind: 'rent-missed', day, propId: prop.id, name: prop.name, owed: lease.arrears, deadline });
    this.text(d, LANDLORD, `QUIT NOTICE. Rent for ${prop.name} was not paid today. You owe ${naira(lease.arrears)}. Pay everything, with next week's rent, before ${dayLabel(deadline)} or pack your load. I have pinned it on your door.`, day);
  }

  private evict(d: PlayerAccount, prop: RealEstateProperty, day: number, owed: number, events: DueEvent[]): void {
    // On this same copy of the save (not reloaded halfway)
    this.backend.endLease(prop.id, false);
    d.evicted = { propId: prop.id, name: prop.name, day };
    delete d.leases?.[prop.id];
    d.stats.streetCred = Math.max(0, d.stats.streetCred - 15);
    events.push({ kind: 'evicted', day, propId: prop.id, name: prop.name, owed });
    this.text(d, LANDLORD, `You were given a week. The locks on ${prop.name} have been changed and the key is back with me. The caution fee covers what you owed. Find another place.`, day);
  }

  private takeInstalment(d: PlayerAccount, pay: Pay, day: number, events: DueEvent[]): void {
    const loan = d.activeLoan;
    if (!loan) return;
    const amount = instalmentOf(loan);
    const clears = amount >= loan.amount;
    const contact = lenderContact(loan.lender);
    if (this.canPay(d, amount)) {
      const paid = pay({
        type: clears ? 'LOAN_REPAYMENT' : 'LOAN_INSTALMENT',
        amount,
        description: clears ? `Last instalment, loan cleared: ${loan.lender}` : `Weekly instalment: ${loan.lender}`,
        source: 'bank',
        funding: 'split',
        idem: `due:loan:${slug(loan.lender)}:${day}`,
      });
      if (paid.success) {
        if (clears) {
          const clean = this.clearLoan(d);
          events.push({ kind: 'loan-cleared', day, lender: loan.lender, clean });
          this.text(d, contact, clean ? 'Your loan is fully paid, and not one week missed. Your record with us is clean: come back any time.' : 'Your loan is fully paid. Thank you.', day);
        } else {
          loan.amount -= amount;
          loan.missed = 0;
          loan.nextDueDay = (loan.nextDueDay ?? day) + 7;
          events.push({ kind: 'instalment-paid', day, lender: loan.lender, amount, left: loan.amount });
        }
        return;
      }
    }
    const each = lateFeeOf(loan);
    const fee = (loan.lateFees ?? 0) + each <= each * MAX_LATE_FEES ? each : 0;
    loan.amount += fee;
    loan.lateFees = (loan.lateFees ?? 0) + fee;
    loan.missed = (loan.missed ?? 0) + 1;
    loan.everMissed = true;
    loan.nextDueDay = (loan.nextDueDay ?? day) + 7;
    d.credit = { cleanLoans: d.credit?.cleanLoans ?? 0, missed: (d.credit?.missed ?? 0) + 1 };
    d.stats.streetCred = Math.max(0, d.stats.streetCred - 5);
    events.push({ kind: 'instalment-missed', day, lender: loan.lender, amount, fee, owed: loan.amount });
    this.text(d, contact, `Your ${naira(amount)} instalment was due today and your account could not cover it.${fee ? ` A late fee of ${naira(fee)} has been added.` : ''} You now owe ${naira(loan.amount)}. Please pay this week from the Bank app.`, day);
  }

  /** The loan is gone; true if no week was missed on it */
  private clearLoan(d: PlayerAccount): boolean {
    const clean = !d.activeLoan?.everMissed;
    d.activeLoan = undefined;
    d.credit = { cleanLoans: (d.credit?.cleanLoans ?? 0) + (clean ? 1 : 0), missed: d.credit?.missed ?? 0 };
    return clean;
  }

  /** A text in the player's phone, written on the same copy of the save */
  private text(d: PlayerAccount, who: { id: string; name: string }, text: string, day: number): void {
    const threads = (d.threads ??= {});
    const thread = (threads[who.id] ??= { messages: [], unread: 0 });
    thread.messages.push({ from: 'them', text: text.slice(0, 240), at: dayLabel(day) });
    if (thread.messages.length > 40) thread.messages.splice(0, thread.messages.length - 40);
    thread.unread += 1;
  }

  // --- What the player does ---------------------------------------------------------------------

  /** Pays the rent owed on a home now, which withdraws the quit notice. */
  public payRentOwed(propId: string): { ok: boolean; message: string } {
    const done = this.backend.edit((d, pay) => {
      const prop = d.properties.find((p) => p.id === propId);
      const lease = d.leases?.[propId];
      if (!prop || !lease || lease.arrears <= 0) return { ok: false, message: 'You owe nothing on this home.' };
      const owed = lease.arrears;
      if (!this.canPay(d, owed)) return { ok: false, message: `You owe ${naira(owed)} and do not have it yet.` };
      const paid = pay({ type: 'RENT_PAYMENT', amount: owed, description: `Rent owed: ${prop.name}`, source: 'bank', funding: 'split' });
      if (!paid.success) return { ok: false, message: paid.message };
      lease.arrears = 0;
      delete lease.noticeDay;
      this.text(d, LANDLORD, `I don see ${naira(owed)} for ${prop.name}. The quit notice is withdrawn.`, this.today());
      return { ok: true, message: `${naira(owed)} paid to the landlord. The quit notice on ${prop.name} is withdrawn.` };
    });
    if (done.ok) this.changed();
    return done;
  }

  /** Pays one instalment now. After a missed week it covers that week; otherwise next week is skipped. */
  public payInstalmentNow(): { ok: boolean; message: string } {
    const done = this.backend.edit((d, pay) => {
      const loan = d.activeLoan;
      if (!loan) return { ok: false, message: 'You have no loan.' };
      const amount = instalmentOf(loan);
      const clears = amount >= loan.amount;
      if (!this.canPay(d, amount)) return { ok: false, message: `This week's ${naira(amount)} is more than you have.` };
      const paid = pay({
        type: clears ? 'LOAN_REPAYMENT' : 'LOAN_INSTALMENT',
        amount,
        description: clears ? `Last instalment, loan cleared: ${loan.lender}` : `Instalment paid early: ${loan.lender}`,
        source: 'bank',
        funding: 'split',
      });
      if (!paid.success) return { ok: false, message: paid.message };
      if (clears) {
        const clean = this.clearLoan(d);
        return { ok: true, message: `Loan from ${loan.lender} cleared.${clean ? ' Not one week missed: the bank will lend you more now.' : ''}` };
      }
      loan.amount -= amount;
      if ((loan.missed ?? 0) > 0) loan.missed = (loan.missed ?? 0) - 1;
      else loan.nextDueDay = (loan.nextDueDay ?? this.today() + 7) + 7;
      return { ok: true, message: `${naira(amount)} paid to ${loan.lender}. You owe ${naira(loan.amount)}.` };
    });
    if (done.ok) this.changed();
    return done;
  }

  // --- What the player sees -------------------------------------------------------------------

  public leaseOf(propId: string): LeaseView | null {
    const data = this.backend.getData();
    const prop = data.properties.find((p) => p.id === propId);
    const lease = data.leases?.[propId];
    if (!prop || prop.status !== 'rented' || !lease) return null;
    const settled = data.duesDay ?? this.today();
    return {
      propId,
      name: prop.name,
      weekly: weeklyRentOf(prop),
      paidUntil: lease.paidUntil,
      nextDue: nextSaturday(Math.max(lease.paidUntil, settled + 1)),
      arrears: lease.arrears,
      deadline: lease.noticeDay !== undefined ? lease.noticeDay + GRACE_DAYS : null,
    };
  }

  /** The leases with a quit notice on them */
  public notices(): LeaseView[] {
    return this.leasesHeld()
      .map((p) => this.leaseOf(p.id))
      .filter((l): l is LeaseView => !!l && l.deadline !== null);
  }

  public loan(): LoanView | null {
    const loan = this.backend.getData().activeLoan;
    if (!loan) return null;
    return { lender: loan.lender, owed: loan.amount, instalment: instalmentOf(loan), nextDue: loan.nextDueDay ?? null, missed: loan.missed ?? 0, lateFees: loan.lateFees ?? 0 };
  }

  /** What the bank will lend now: more for each loan cleared without a missed week */
  public bankOffer(): { principal: number; repay: number } {
    const clean = this.backend.getData().credit?.cleanLoans ?? 0;
    return BANK_OFFERS[Math.min(clean, BANK_OFFERS.length - 1)];
  }

  /** Put out of a home in the last fortnight, and not living anywhere since */
  public recentlyEvicted(): { propId: string; name: string; day: number } | null {
    const data = this.backend.getData();
    const e = data.evicted;
    if (!e || this.today() - e.day > 14 || this.backend.hasHome()) return null;
    return e;
  }

  /** The people who write about money owed, for the phone's contacts */
  public contacts(): Array<{ id: string; name: string; note: string }> {
    const data = this.backend.getData();
    const all = [LANDLORD, ...Object.values(LENDERS)];
    const loan = data.activeLoan ? lenderContact(data.activeLoan.lender) : null;
    if (loan && !all.some((c) => c.id === loan.id)) all.push(loan);
    return all
      .filter((c) => (data.threads?.[c.id]?.messages.length ?? 0) > 0)
      .map((c) => ({ id: c.id, name: c.name, note: c.id === LANDLORD.id ? 'Your landlord' : 'Your lender' }));
  }

  /** What they answer when written to */
  public replyTo(id: string): string | null {
    if (id === LANDLORD.id) {
      const owing = this.notices()[0];
      return owing ? `No story. ${naira(owing.arrears)} before ${dayLabel(owing.deadline!)}, or you pack.` : 'Rent na every Saturday. As long as it lands, we no get problem.';
    }
    if (!id.startsWith('dues:')) return null;
    const loan = this.loan();
    return loan ? `${naira(loan.instalment)} every week${loan.nextDue !== null ? `, next on ${dayLabel(loan.nextDue)}` : ''}. You owe ${naira(loan.owed)}.` : 'You have no loan with us. Come and see us when you need one.';
  }
}
