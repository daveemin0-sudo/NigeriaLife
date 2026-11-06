/**
 * The money. The server holds every online player's cash and bank balance; the game shows them
 * and asks for changes. Every change is one ledger row written in the same transaction as the
 * wallet, carries an idempotency key so a repeated request is not paid twice, and can never
 * take a balance below zero.
 *
 * Two kinds of change:
 *
 *   - Checked by the server (verified). A job shift: the server knows the player was taken on,
 *     saw them standing at the workplace when they started and when they finished, timed it by
 *     its own clock, and works out the pay from its own record of their grade.
 *
 *   - Reported by the game (not yet verified), for the actions that still run in the browser.
 *     Spending is always accepted (it can only cost the player); money moved between the
 *     player's own cash and bank is accepted if it balances; earning is accepted only up to a
 *     limit in any ten minutes. Anything beyond is held for the admin to look at and release:
 *     not refused outright, because an honest sale of a plot can be worth more than the limit
 *     and the seller must not lose both the plot and the money. Each action moved to the
 *     server takes its earnings out of this path.
 *
 * Fast money of any kind raises an alert for the admin page.
 */
import { randomUUID } from 'node:crypto';
import { EMPLOYERS, WORKSITES, type Employer, type Grade } from '../src/jobs/employers.ts';
import { mostTaken } from '../src/backend/businessRates.ts';
import { AGAMA_CAP, ALBUM_CASH, CASE_CASH, GIGS, QUEST_CASH, agamaPay, plotOf, quoteTakings, tipFor } from './earn.ts';
import { alert, transaction, type Store } from './store.ts';
import { lagosDate, lagosMonth, lagosMonthStart, monthRelief, taxOffice, workPayslip, MAX_SLIPS, type Payslip } from '../src/life/Tax.ts';

export interface Wallet {
  cash: number;
  bank: number;
}

export interface Position {
  city: string;
  x: number;
  z: number;
  /** The room the player is in, if they are inside a place */
  place?: string;
  /** When the server last heard it, ms */
  at: number;
}

type Result<T = object> = ({ ok: true; wallet: Wallet } & T) | { ok: false; reason: string; wallet?: Wallet; held?: number };

/**
 * Earnings the game may report without the server checking them, in any ten minutes.
 * What is still on that path (a diaspora pickup, a spell of fares, an Eko Rides trip) needs
 * about ₦45,000. ₦48,000 clears that and leaves a fare or two. See server/earn.ts.
 */
export const UNVERIFIED_EARNING_LIMIT = 48_000;
/** The most a player may borrow at once. A loan is debt, not earnings: one at a time, up to this */
export const LOAN_LIMIT = 5_000_000;
/** Earnings of any kind in ten minutes above which an alert is raised */
export const FAST_MONEY_ALERT = 300_000;
/** A position older than this is not taken as where the player is */
const POSITION_FRESH_MS = 6_000;
/** A shift not finished within this is given up */
const SHIFT_EXPIRES_MS = 10 * 60_000;
/** The most a local save may bring onto a new account, once */
export const IMPORT_LIMIT = 2_000_000;
const TEN_MINUTES = 10 * 60_000;

const whole = (n: unknown) => (typeof n === 'number' && Number.isFinite(n) ? Math.trunc(n) : NaN);
const cleanMemo = (memo: unknown) => String(memo ?? '').slice(0, 120);
const cleanIdem = (idem: unknown) => (typeof idem === 'string' && /^[\w:-]{8,80}$/.test(idem) ? idem : null);

export function gradeFor(employer: Employer, done: number): Grade {
  let grade = employer.grades[0];
  for (const g of employer.grades) if (done >= g.from) grade = g;
  return grade;
}

export class Economy {
  private db: Store;
  private positionOf: (accountId: string) => Position | null;
  /** Called after any change, so the game can be told its new balance at once */
  public onChange: (accountId: string, wallet: Wallet) => void = () => {};
  private alerted = new Map<string, number>();

  /** The businesses an account owns, from the ownership registry (set by the game server) */
  public businessesOf: (accountId: string) => string[] = () => [];

  constructor(db: Store, positionOf: (accountId: string) => Position | null) {
    this.db = db;
    this.positionOf = positionOf;
  }

  public wallet(accountId: string): Wallet {
    const r = this.db.prepare('SELECT cash, bank FROM wallets WHERE account_id = ?').get(accountId) as Wallet | undefined;
    return r ? { cash: r.cash, bank: r.bank } : { cash: 0, bank: 0 };
  }

  /**
   * Changes a wallet and writes why, in one transaction. A request with an idempotency key the
   * ledger has already seen changes nothing and returns the wallet as it is.
   */
  private apply(accountId: string, kind: string, cashDelta: number, bankDelta: number, memo: string, verified: boolean, idem: string | null): Result<{ replay?: boolean }> {
    const outcome = transaction(this.db, (): Result<{ replay?: boolean }> => {
      if (idem && this.db.prepare('SELECT 1 FROM ledger WHERE account_id = ? AND idem = ?').get(accountId, idem)) {
        return { ok: true, wallet: this.wallet(accountId), replay: true };
      }
      const before = this.wallet(accountId);
      const after = { cash: before.cash + cashDelta, bank: before.bank + bankDelta };
      if (after.cash < 0 || after.bank < 0) return { ok: false, reason: 'Not enough money.', wallet: before };
      this.db
        .prepare('INSERT INTO ledger (account_id, at, kind, cash_delta, bank_delta, cash_after, bank_after, verified, memo, idem) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
        .run(accountId, Date.now(), kind, cashDelta, bankDelta, after.cash, after.bank, verified ? 1 : 0, memo, idem);
      this.db.prepare('UPDATE wallets SET cash = ?, bank = ? WHERE account_id = ?').run(after.cash, after.bank, accountId);
      return { ok: true, wallet: after };
    });
    if (outcome.ok && !('replay' in outcome && outcome.replay)) {
      if (cashDelta + bankDelta > 0) this.watchForFastMoney(accountId);
      this.onChange(accountId, outcome.wallet);
    }
    return outcome;
  }

  private earnedSince(accountId: string, since: number, onlyUnverified: boolean): number {
    const r = this.db
      .prepare(`SELECT COALESCE(SUM(cash_delta + bank_delta), 0) AS earned FROM ledger WHERE account_id = ? AND at >= ? AND cash_delta + bank_delta > 0 AND kind NOT IN ('start', 'import', 'loan') ${onlyUnverified ? 'AND verified = 0' : ''}`)
      .get(accountId, since) as { earned: number };
    return r.earned;
  }

  /**
   * Is a loan open: was the last loan row money lent, not the payment that cleared it? Weekly
   * instalments are kind 'loan_part' and do not close a loan; only the last payment does. (A Lapo
   * loan the player starts with was never lent through the server, so counting rows would let its
   * clearing payment close the next loan too.)
   */
  private loanOpen(accountId: string): boolean {
    const last = this.db
      .prepare("SELECT cash_delta + bank_delta AS net FROM ledger WHERE account_id = ? AND kind = 'loan' ORDER BY id DESC LIMIT 1")
      .get(accountId) as { net: number } | undefined;
    return !!last && last.net > 0;
  }

  private watchForFastMoney(accountId: string): void {
    const earned = this.earnedSince(accountId, Date.now() - TEN_MINUTES, false);
    if (earned <= FAST_MONEY_ALERT) return;
    const last = this.alerted.get(accountId) ?? 0;
    if (Date.now() - last < TEN_MINUTES) return;
    this.alerted.set(accountId, Date.now());
    alert(this.db, accountId, 'fast-money', `earned ₦${earned.toLocaleString()} in ten minutes`);
  }

  /**
   * What the game did with money in the browser, for actions not yet run by the server.
   * `cash` and `bank` are the changes it made (negative for spending).
   */
  public report(accountId: string, raw: { cash?: unknown; bank?: unknown; memo?: unknown; idem?: unknown }): Result<{ replay?: boolean }> {
    const cash = whole(raw.cash ?? 0);
    const bank = whole(raw.bank ?? 0);
    const idem = cleanIdem(raw.idem);
    if (!Number.isFinite(cash) || !Number.isFinite(bank) || !idem) return { ok: false, reason: 'That could not be read.', wallet: this.wallet(accountId) };
    const memo = cleanMemo(raw.memo);
    const net = cash + bank;
    // A repeat of a request already in the ledger changes nothing, even when a fresh one would be held.
    if (this.db.prepare('SELECT 1 FROM ledger WHERE account_id = ? AND idem = ?').get(accountId, idem)) {
      return { ok: true, wallet: this.wallet(accountId), replay: true };
    }
    // A loan from a lender: paid when the player has none open and it is within the limit; it is
    // debt to be repaid, not earnings, so the earnings limit does not apply to it. Repayments close it.
    if (/^LOAN_DISBURSEMENT:/.test(memo) && net > 0) {
      if (this.loanOpen(accountId)) return { ok: false, reason: 'Clear the loan you have before borrowing again.', wallet: this.wallet(accountId) };
      if (net > LOAN_LIMIT) {
        alert(this.db, accountId, 'loan-too-big', `asked to borrow ₦${net.toLocaleString()}`);
        return { ok: false, reason: `No lender gives more than ₦${LOAN_LIMIT.toLocaleString()} at once.`, wallet: this.wallet(accountId) };
      }
      return this.apply(accountId, 'loan', cash, bank, memo, true, idem);
    }
    if (/^LOAN_REPAYMENT:/.test(memo) && net < 0) return this.apply(accountId, 'loan', cash, bank, memo, true, idem);
    if (/^LOAN_INSTALMENT:/.test(memo) && net < 0) return this.apply(accountId, 'loan_part', cash, bank, memo, true, idem);
    // A business's takings: paid if the businesses the player owns could have taken that much
    // since they were last paid (the registry says what they own; the price table what each takes)
    if (net > 0 && /^BUSINESS_INCOME:/.test(memo)) {
      const paid = this.payTakings(accountId, cash, bank, memo, idem);
      if (paid) return paid;
    }
    if (net > 0) {
      const already = this.earnedSince(accountId, Date.now() - TEN_MINUTES, true);
      if (already + net > UNVERIFIED_EARNING_LIMIT) {
        if (this.db.prepare("SELECT 1 FROM held WHERE account_id = ? AND memo = ? AND status = 'waiting' AND at > ?").get(accountId, `${idem} ${memo}`, Date.now() - TEN_MINUTES)) {
          return { ok: false, reason: 'That money is already waiting to be checked.', wallet: this.wallet(accountId) };
        }
        const held = this.db.prepare('INSERT INTO held (at, account_id, amount, memo) VALUES (?, ?, ?, ?)').run(Date.now(), accountId, net, `${idem} ${memo}`);
        alert(this.db, accountId, 'earning-held', `₦${net.toLocaleString()} for "${memo}" after ₦${already.toLocaleString()} in ten minutes`);
        return { ok: false, held: Number(held.lastInsertRowid), reason: `₦${net.toLocaleString()} is being checked and will reach you once it has been.`, wallet: this.wallet(accountId) };
      }
    }
    return this.apply(accountId, 'client', cash, bank, memo, false, idem);
  }

  /**
   * Business takings, checked against what the player owns: each business they own adds to a
   * credit as time passes, at the most it could take (staffed, with every branch), up to a
   * week's worth. Takings within the credit are paid at once and come off it. Takings held
   * earlier for the admin are let through too, once the credit covers them.
   */
  private payTakings(accountId: string, cash: number, bank: number, memo: string, idem: string): Result | null {
    const owned = this.businessesOf(accountId);
    if (owned.length === 0) return null;
    const now = Date.now();
    const perMs = owned.reduce((sum, id) => sum + mostTaken(id, 1), 0);
    const week = perMs * 7 * 24 * 3600_000;
    const row = this.db.prepare('SELECT credit, at FROM business_clock WHERE account_id = ?').get(accountId) as { credit: number; at: number } | undefined;
    // First seen with businesses: a week's worth, so what was earned before this check began is not lost
    let credit = row ? Math.min(week, row.credit + perMs * (now - row.at)) : week;
    const net = cash + bank;
    if (net > credit) {
      this.db.prepare('INSERT INTO business_clock (account_id, credit, at) VALUES (?, ?, ?) ON CONFLICT(account_id) DO UPDATE SET credit = excluded.credit, at = excluded.at').run(accountId, Math.round(credit), now);
      return null;
    }
    const paid = this.apply(accountId, 'business', cash, bank, memo, true, idem);
    if (!paid.ok) return paid;
    credit -= net;
    // Takings held before this check existed, released while the credit lasts
    const waiting = this.db.prepare("SELECT id, amount FROM held WHERE account_id = ? AND status = 'waiting' AND memo LIKE '% BUSINESS_INCOME%' ORDER BY id").all(accountId) as Array<{ id: number; amount: number }>;
    for (const h of waiting) {
      if (h.amount > credit) break;
      const released = this.decideHeld(h.id, true);
      if (released.ok) credit -= h.amount;
    }
    this.db.prepare('INSERT INTO business_clock (account_id, credit, at) VALUES (?, ?, ?) ON CONFLICT(account_id) DO UPDATE SET credit = excluded.credit, at = excluded.at').run(accountId, Math.round(credit), now);
    return { ...paid, wallet: this.wallet(accountId) };
  }

  /** A local save brought onto a new account, once, up to a limit. */
  public importSave(accountId: string, raw: { cash?: unknown; bank?: unknown }): Result {
    const cash = Math.max(0, whole(raw.cash ?? 0));
    const bank = Math.max(0, whole(raw.bank ?? 0));
    if (!Number.isFinite(cash) || !Number.isFinite(bank)) return { ok: false, reason: 'That could not be read.' };
    const done = this.db.prepare('SELECT imported FROM accounts WHERE id = ?').get(accountId) as { imported: number } | undefined;
    if (!done || done.imported) return { ok: false, reason: 'This account has already brought in a saved game.', wallet: this.wallet(accountId) };
    const total = cash + bank;
    const scale = total > IMPORT_LIMIT ? IMPORT_LIMIT / total : 1;
    if (scale < 1) alert(this.db, accountId, 'import-capped', `save held ₦${total.toLocaleString()}, brought in ₦${IMPORT_LIMIT.toLocaleString()}`);
    const target = { cash: Math.floor(cash * scale), bank: Math.floor(bank * scale) };
    const now = this.wallet(accountId);
    this.db.prepare('UPDATE accounts SET imported = 1 WHERE id = ?').run(accountId);
    return this.apply(accountId, 'import', target.cash - now.cash, target.bank - now.bank, 'Saved game brought from this device', true, `import:${accountId}`);
  }

  // --- Work -------------------------------------------------------------------------------------

  public job(accountId: string, employerId: string): { done: number; grade: Grade } | null {
    const employer = EMPLOYERS.find((e) => e.id === employerId);
    const r = this.db.prepare('SELECT done FROM jobs WHERE account_id = ? AND employer = ?').get(accountId, employerId) as { done: number } | undefined;
    return employer && r ? { done: r.done, grade: gradeFor(employer, r.done) } : null;
  }

  public hire(accountId: string, employerId: string): { ok: true; done: number } | { ok: false; reason: string } {
    if (!EMPLOYERS.some((e) => e.id === employerId) || !WORKSITES[employerId]) return { ok: false, reason: 'That work is not run by the server yet.' };
    this.db.prepare('INSERT OR IGNORE INTO jobs (account_id, employer, done, since) VALUES (?, ?, 0, ?)').run(accountId, employerId, Date.now());
    return { ok: true, done: this.job(accountId, employerId)!.done };
  }

  /** Why the player is not standing in this spot, or null if they are. */
  private awayFrom(accountId: string, site: { city: string; x: number; z: number; radius: number; place?: string } | null, where: string): string | null {
    const at = this.positionOf(accountId);
    if (!site) return 'That work is not run by the server yet.';
    if (!at || Date.now() - at.at > POSITION_FRESH_MS) return 'The server cannot see where you are. Check your connection.';
    if (site.place) return at.city === site.city && at.place === site.place ? null : where;
    if (at.city !== site.city || Math.hypot(at.x - site.x, at.z - site.z) > site.radius) return where;
    return null;
  }

  /** Why the player is not at the workplace now, or null if they are. */
  private notThere(accountId: string, employerId: string): string | null {
    return this.awayFrom(accountId, WORKSITES[employerId] ?? null, 'You are not at the workplace.');
  }

  public startShift(accountId: string, employerId: string): { ok: true; shift: string } | { ok: false; reason: string } {
    if (!this.job(accountId, employerId)) return { ok: false, reason: 'You do not work there.' };
    const away = this.notThere(accountId, employerId);
    if (away) return { ok: false, reason: away };
    // One piece of work at a time: an open one left over is given up
    this.db.prepare('UPDATE shifts SET finished_at = -1 WHERE account_id = ? AND finished_at IS NULL').run(accountId);
    const shift = randomUUID();
    this.db.prepare('INSERT INTO shifts (id, account_id, employer, started_at) VALUES (?, ?, ?, ?)').run(shift, accountId, employerId, Date.now());
    return { ok: true, shift };
  }

  public finishShift(accountId: string, shiftId: unknown, idemRaw: unknown, starsRaw?: unknown): Result<{ pay?: number; tip?: number; slip?: Payslip; promoted?: Grade; done?: number; replay?: boolean }> {
    const idem = cleanIdem(idemRaw);
    if (!idem) return { ok: false, reason: 'That could not be read.' };
    if (this.db.prepare('SELECT 1 FROM ledger WHERE account_id = ? AND idem = ?').get(accountId, idem)) {
      return { ok: true, wallet: this.wallet(accountId), replay: true };
    }
    const shift = this.db.prepare('SELECT id, employer, started_at, finished_at FROM shifts WHERE id = ? AND account_id = ?').get(String(shiftId ?? ''), accountId) as
      | { id: string; employer: string; started_at: number; finished_at: number | null }
      | undefined;
    if (!shift || shift.finished_at !== null) return { ok: false, reason: 'That work was not started, or is already paid.' };
    const site = WORKSITES[shift.employer];
    const employer = EMPLOYERS.find((e) => e.id === shift.employer)!;
    const took = Date.now() - shift.started_at;
    if (took > SHIFT_EXPIRES_MS) return { ok: false, reason: 'That work took too long and was given up.' };
    if (took < site.minSeconds * 1000) {
      alert(this.db, accountId, 'shift-too-fast', `${shift.employer} finished in ${(took / 1000).toFixed(1)} s (least ${site.minSeconds} s)`);
      return { ok: false, reason: 'That was done faster than anyone could.' };
    }
    const away = this.notThere(accountId, shift.employer);
    if (away) return { ok: false, reason: away };

    const job = this.job(accountId, shift.employer)!;
    const pay = job.grade.pay;
    // Stars are optional. Left out, the wage is the whole pay, so an existing shift test is unchanged.
    const stars = starsRaw === 2 || starsRaw === 3 ? starsRaw : 0;
    const tip = tipFor(pay, stars);
    // The employer takes PAYE from the wage before paying it; a tip is the player's, untaxed
    const slip = this.payslip(accountId, pay, employer.name, job.grade.title, site.city);
    this.db.prepare('UPDATE shifts SET finished_at = ? WHERE id = ?').run(Date.now(), shift.id);
    const paid = this.apply(accountId, 'shift', slip.net + tip, 0, `${job.grade.title}, ${employer.name}${slip.paye ? ` (PAYE ₦${slip.paye.toLocaleString()})` : ''}`, true, idem);
    if (!paid.ok) return paid;
    this.keepPayslip(accountId, slip, idem);
    this.db.prepare('UPDATE jobs SET done = done + 1 WHERE account_id = ? AND employer = ?').run(accountId, shift.employer);
    const now = gradeFor(employer, job.done + 1);
    return { ok: true, wallet: paid.wallet, pay, tip, slip, done: job.done + 1, promoted: now !== job.grade ? now : undefined };
  }

  // --- Between players and from the admin -------------------------------------------------------

  public transfer(fromId: string, toId: string, raw: { amount?: unknown; into?: unknown; from?: unknown; memo?: unknown; idem?: unknown }): Result {
    const amount = whole(raw.amount);
    const idem = cleanIdem(raw.idem);
    if (!Number.isFinite(amount) || amount <= 0 || !idem) return { ok: false, reason: 'Enter an amount to send.' };
    if (fromId === toId) return { ok: false, reason: 'You cannot send money to yourself.' };
    if (!this.db.prepare('SELECT 1 FROM wallets WHERE account_id = ?').get(toId)) return { ok: false, reason: 'There is nobody with that account.' };
    const into = raw.into === 'bank' ? 'bank' : 'wallet';
    const memo = cleanMemo(raw.memo);
    const fromCash = raw.from === 'wallet';
    const sent = this.apply(fromId, 'transfer-out', fromCash ? -amount : 0, fromCash ? 0 : -amount, `To ${toId}: ${memo}`, true, idem);
    if (!sent.ok || ('replay' in sent && sent.replay)) return sent;
    this.apply(toId, 'transfer-in', into === 'wallet' ? amount : 0, into === 'bank' ? amount : 0, `From ${fromId}: ${memo}`, true, `in:${idem}`);
    return sent;
  }

  public heldList(): unknown[] {
    return this.db.prepare("SELECT id, at, account_id, amount, memo, status FROM held WHERE status = 'waiting' ORDER BY id").all();
  }

  /** The admin lets held money through (or not). Releasing pays it once. */
  public decideHeld(id: number, release: boolean): Result {
    const row = this.db.prepare("SELECT account_id, amount, memo FROM held WHERE id = ? AND status = 'waiting'").get(id) as { account_id: string; amount: number; memo: string } | undefined;
    if (!row) return { ok: false, reason: 'Nothing waiting with that number.' };
    this.db.prepare('UPDATE held SET status = ? WHERE id = ?').run(release ? 'released' : 'refused', id);
    if (!release) return { ok: true, wallet: this.wallet(row.account_id) };
    return this.apply(row.account_id, 'released', row.amount, 0, `Checked and released: ${row.memo.replace(/^\S+ /, '')}`, true, `held:${id}`);
  }

  /**
   * Payments made through the registry (a sale completed, rent paid): taken from the payer and
   * paid to whoever is owed, all of them or none, each once (keyed by its payout id).
   */
  public settlePayouts(moves: Array<{ payer: string; payee: string; pay: number; receive: number; memo: string; key: string }>): { ok: true } | { ok: false; reason: string } {
    for (const m of moves) {
      if (!Number.isInteger(m.pay) || !Number.isInteger(m.receive) || m.pay < 0 || m.receive < 0 || m.receive > m.pay) return { ok: false, reason: 'A payment in that change is not valid.' };
    }
    const changed = new Map<string, Wallet>();
    try {
      transaction(this.db, () => {
        for (const m of moves) {
          if (this.db.prepare('SELECT 1 FROM ledger WHERE account_id = ? AND idem = ?').get(m.payer, `${m.key}:out`)) continue;
          const payer = this.wallet(m.payer);
          // From the bank first, then the pocket, as the game pays
          const fromBank = Math.min(payer.bank, m.pay);
          const fromCash = m.pay - fromBank;
          if (fromCash > payer.cash) throw new Error(`short:${m.memo}`);
          const after = { cash: payer.cash - fromCash, bank: payer.bank - fromBank };
          this.db
            .prepare('INSERT INTO ledger (account_id, at, kind, cash_delta, bank_delta, cash_after, bank_after, verified, memo, idem) VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?)')
            .run(m.payer, Date.now(), 'registry-out', -fromCash, -fromBank, after.cash, after.bank, m.memo, `${m.key}:out`);
          this.db.prepare('UPDATE wallets SET cash = ?, bank = ? WHERE account_id = ?').run(after.cash, after.bank, m.payer);
          changed.set(m.payer, after);
          const payee = this.wallet(m.payee);
          const got = { cash: payee.cash, bank: payee.bank + m.receive };
          this.db
            .prepare('INSERT INTO ledger (account_id, at, kind, cash_delta, bank_delta, cash_after, bank_after, verified, memo, idem) VALUES (?, ?, ?, 0, ?, ?, ?, 1, ?, ?)')
            .run(m.payee, Date.now(), 'registry-in', m.receive, got.cash, got.bank, m.memo, `${m.key}:in`);
          this.db.prepare('UPDATE wallets SET cash = ?, bank = ? WHERE account_id = ?').run(got.cash, got.bank, m.payee);
          changed.set(m.payee, got);
        }
      });
    } catch (error) {
      const reason = String((error as Error).message ?? '');
      return { ok: false, reason: reason.startsWith('short:') ? `There is not enough money for that (${reason.slice(6)}).` : 'The payment could not be made.' };
    }
    for (const [id, wallet] of changed) {
      this.watchForFastMoney(id);
      this.onChange(id, wallet);
    }
    return { ok: true };
  }

  /** A fee taken from a player's bank and held for something (a Hustle job) until it is paid out */
  public holdFee(accountId: string, amount: number, memo: string, idem: string): Result {
    return this.apply(accountId, 'held', 0, -Math.trunc(amount), cleanMemo(memo), true, idem);
  }

  /**
   * Money a player spends from their cash on something the server sells (a ring, aso-ebi, a
   * studio session). Used when the bank cannot cover it. Fails rather than going below zero.
   */
  public debitCash(accountId: string, amount: number, memo: string, idem: string): Result {
    return this.apply(accountId, 'spent', -Math.abs(Math.trunc(amount)), 0, cleanMemo(memo), true, idem);
  }

  /** A held fee paid into a player's bank: the worker's pay, or a refund */
  public payFee(accountId: string, amount: number, memo: string, idem: string): Result {
    return this.apply(accountId, 'paid', 0, Math.trunc(amount), cleanMemo(memo), true, idem);
  }

  public grant(accountId: string, amount: number, memo: string): Result {
    return this.apply(accountId, 'grant', Math.trunc(amount), 0, cleanMemo(memo || 'From the game team'), true, `grant:${randomUUID()}`);
  }

  public ledger(accountId: string, limit = 50): unknown[] {
    return this.db.prepare('SELECT at, kind, cash_delta, bank_delta, cash_after, bank_after, verified, memo FROM ledger WHERE account_id = ? ORDER BY id DESC LIMIT ?').all(accountId, limit);
  }

  // --- Gigs, takings, and one-off catalogue pays -----------------------------------------------

  public startGig(accountId: string, gigId: string): { ok: true; shift: string } | { ok: false; reason: string } {
    const gig = GIGS[gigId];
    if (!gig) return { ok: false, reason: 'That work is not run by the server yet.' };
    if (gig.site) {
      const away = this.awayFrom(accountId, gig.site, 'You are not at the workplace.');
      if (away) return { ok: false, reason: away };
    }
    this.db.prepare('UPDATE shifts SET finished_at = -1 WHERE account_id = ? AND finished_at IS NULL').run(accountId);
    const shift = randomUUID();
    this.db.prepare('INSERT INTO shifts (id, account_id, employer, started_at) VALUES (?, ?, ?, ?)').run(shift, accountId, `gig:${gigId}`, Date.now());
    return { ok: true, shift };
  }

  public finishGig(accountId: string, shiftId: unknown, idemRaw: unknown): Result<{ pay?: number; slip?: Payslip; replay?: boolean }> {
    const idem = cleanIdem(idemRaw);
    if (!idem) return { ok: false, reason: 'That could not be read.' };
    if (this.db.prepare('SELECT 1 FROM ledger WHERE account_id = ? AND idem = ?').get(accountId, idem)) {
      return { ok: true, wallet: this.wallet(accountId), replay: true };
    }
    const shift = this.db.prepare('SELECT id, employer, started_at, finished_at FROM shifts WHERE id = ? AND account_id = ?').get(String(shiftId ?? ''), accountId) as
      | { id: string; employer: string; started_at: number; finished_at: number | null }
      | undefined;
    if (!shift || shift.finished_at !== null || !shift.employer.startsWith('gig:')) return { ok: false, reason: 'That work was not started, or is already paid.' };
    const gig = GIGS[shift.employer.slice(4)];
    if (!gig) return { ok: false, reason: 'That work is not run by the server yet.' };
    const took = Date.now() - shift.started_at;
    if (took > SHIFT_EXPIRES_MS) return { ok: false, reason: 'That work took too long and was given up.' };
    if (took < gig.minSeconds * 1000) {
      alert(this.db, accountId, 'shift-too-fast', `${shift.employer} finished in ${(took / 1000).toFixed(1)} s (least ${gig.minSeconds} s)`);
      return { ok: false, reason: 'That was done faster than anyone could.' };
    }
    if (gig.site) {
      const away = this.awayFrom(accountId, gig.site, 'You are not at the workplace.');
      if (away) return { ok: false, reason: away };
    }
    this.db.prepare('UPDATE shifts SET finished_at = ? WHERE id = ?').run(Date.now(), shift.id);
    // A career shift is a wage: PAYE comes off it and there is a payslip. A gig is cash in hand.
    const slip = gig.employer ? this.payslip(accountId, gig.pay, gig.employer, gig.memo, gig.site?.city ?? 'lagos') : null;
    const paid = this.apply(accountId, 'gig', slip ? slip.net : gig.pay, 0, slip?.paye ? `${gig.memo} (PAYE ₦${slip.paye.toLocaleString()})` : gig.memo, true, idem);
    if (!paid.ok) return paid;
    if (slip) this.keepPayslip(accountId, slip, idem);
    return { ok: true, wallet: paid.wallet, pay: gig.pay, ...(slip ? { slip } : {}) };
  }

  // --- PAYE (src/life/Tax.ts) ----------------------------------------------------------------

  /** This month's wages and PAYE so far, and the home rent paid this month (from the ledger) */
  private monthSoFar(accountId: string, month: string): { gross: number; paye: number; rent: number } {
    const wages = this.db.prepare('SELECT COALESCE(SUM(gross), 0) AS gross, COALESCE(SUM(paye), 0) AS paye FROM payslips WHERE account_id = ? AND month = ?').get(accountId, month) as { gross: number; paye: number };
    // Home rent the game reported (a lease's first month, Saturday rent, arrears): what left the wallet
    const rent = this.db
      .prepare("SELECT COALESCE(-SUM(cash_delta + bank_delta), 0) AS rent FROM ledger WHERE account_id = ? AND at >= ? AND cash_delta + bank_delta < 0 AND (memo LIKE 'RENT_PAYMENT: Saturday rent:%' OR memo LIKE 'RENT_PAYMENT: Rent and arrears:%' OR memo LIKE 'RENT_PAYMENT: Rent owed:%' OR memo LIKE 'RENT_PAYMENT: Monthly Rent:%')")
      .get(accountId, lagosMonthStart(month)) as { rent: number };
    return { gross: wages.gross, paye: wages.paye, rent: rent.rent };
  }

  /** The payslip for a wage of `gross` paid now: PAYE on the month's wages so far, less what was taken */
  private payslip(accountId: string, gross: number, employer: string, title: string, city: string): Payslip {
    const now = Date.now();
    const month = lagosMonth(now);
    return { ...workPayslip(gross, this.monthSoFar(accountId, month)), month, date: lagosDate(now), employer, title, office: taxOffice(city) };
  }

  private keepPayslip(accountId: string, slip: Payslip, idem: string): void {
    this.db
      .prepare('INSERT INTO payslips (account_id, at, month, employer, title, office, gross, relief, paye, net, month_gross, month_paye, rate, idem) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
      .run(accountId, Date.now(), slip.month, slip.employer, slip.title, slip.office, slip.gross, slip.relief, slip.paye, slip.net, slip.monthGross, slip.monthPaye, slip.rate, idem);
  }

  /** The player's PAYE: this month, this year, and the latest payslips (newest last) */
  public taxOf(accountId: string): { month: string; gross: number; paye: number; rent: number; relief: number; yearGross: number; yearPaye: number; slips: Payslip[] } {
    const month = lagosMonth(Date.now());
    const so = this.monthSoFar(accountId, month);
    const year = this.db.prepare('SELECT COALESCE(SUM(gross), 0) AS gross, COALESCE(SUM(paye), 0) AS paye FROM payslips WHERE account_id = ? AND month LIKE ?').get(accountId, `${month.slice(0, 4)}-%`) as { gross: number; paye: number };
    const rows = this.db
      .prepare('SELECT at, month, employer, title, office, gross, relief, paye, net, month_gross, month_paye, rate FROM payslips WHERE account_id = ? ORDER BY id DESC LIMIT ?')
      .all(accountId, MAX_SLIPS) as Array<{ at: number; month: string; employer: string; title: string; office: string; gross: number; relief: number; paye: number; net: number; month_gross: number; month_paye: number; rate: number }>;
    const slips: Payslip[] = rows.reverse().map((r) => ({
      month: r.month, date: lagosDate(r.at), employer: r.employer, title: r.title, office: r.office,
      gross: r.gross, relief: r.relief, paye: r.paye, net: r.net, monthGross: r.month_gross, monthPaye: r.month_paye, rate: r.rate,
    }));
    return { month, gross: so.gross, paye: so.paye, rent: so.rent, relief: monthRelief(so.rent), yearGross: year.gross, yearPaye: year.paye, slips };
  }

  /**
   * A building's takings. The registry says what stands there and who runs it; the catalogue
   * says what that earns; the server's clock says how long it has been since it was paid.
   * Any amount in the request is ignored.
   */
  public collectTakings(accountId: string, plotId: string, idemRaw: unknown, registryId: string | null, registryText: string): Result<{ pay?: number; replay?: boolean }> {
    const idem = cleanIdem(idemRaw);
    if (!idem) return { ok: false, reason: 'That could not be read.', wallet: this.wallet(accountId) };
    if (this.db.prepare('SELECT 1 FROM ledger WHERE account_id = ? AND idem = ?').get(accountId, idem)) {
      return { ok: true, wallet: this.wallet(accountId), replay: true };
    }
    const plot = plotOf(plotId);
    if (!plot) return { ok: false, reason: 'There is no such plot.', wallet: this.wallet(accountId) };
    const at = this.positionOf(accountId);
    if (!at || Date.now() - at.at > POSITION_FRESH_MS) return { ok: false, reason: 'The server cannot see where you are. Check your connection.', wallet: this.wallet(accountId) };
    if (at.city !== plot.city || at.x < plot.rect.minX || at.x > plot.rect.maxX || at.z < plot.rect.minZ || at.z > plot.rect.maxZ) {
      return { ok: false, reason: 'You are not on that plot.', wallet: this.wallet(accountId) };
    }
    if (!registryId) return { ok: false, reason: 'Your name is not on the register yet.', wallet: this.wallet(accountId) };
    let doc: { titles?: Record<string, { ownerId?: string | null }>; buildings?: Record<string, { typeId?: unknown; startedAt?: unknown }>; tenancies?: Record<string, { tenantId?: string; paidUntil?: number }> } = {};
    try {
      doc = JSON.parse(registryText || '{}');
    } catch {
      doc = {};
    }
    const building = doc.buildings?.[plotId];
    if (!building || typeof building.typeId !== 'string') return { ok: false, reason: 'There is no finished building there.', wallet: this.wallet(accountId) };
    const tenancy = doc.tenancies?.[plotId];
    const letOut = !!tenancy?.tenantId && (tenancy.paidUntil ?? 0) > Date.now();
    const occupier = letOut ? tenancy!.tenantId : doc.titles?.[`plot:${plotId}`]?.ownerId;
    if (occupier !== registryId) {
      return { ok: false, reason: letOut ? "It is let: the takings are the tenant's." : 'That is not your building.', wallet: this.wallet(accountId) };
    }
    const recorded = this.db.prepare('SELECT type_id, started_at, paid_until FROM building_clock WHERE account_id = ? AND plot_id = ?').get(accountId, plotId) as
      | { type_id: string; started_at: number; paid_until: number }
      | undefined;
    const quote = quoteTakings(plotId, building.typeId, Number(building.startedAt), recorded ? { typeId: recorded.type_id, startedAt: recorded.started_at, paidUntil: recorded.paid_until } : null, Date.now());
    const remember = (clock: { typeId: string; startedAt: number; paidUntil: number }) => {
      this.db.prepare('INSERT INTO building_clock (account_id, plot_id, type_id, started_at, paid_until) VALUES (?, ?, ?, ?, ?) ON CONFLICT(account_id, plot_id) DO UPDATE SET type_id = excluded.type_id, started_at = excluded.started_at, paid_until = excluded.paid_until').run(accountId, plotId, clock.typeId, clock.startedAt, clock.paidUntil);
    };
    if (!quote.ok) {
      if (quote.clock) remember(quote.clock);
      return { ok: false, reason: quote.reason, wallet: this.wallet(accountId) };
    }
    const paid = this.apply(accountId, 'takings', 0, quote.pay, quote.memo, true, idem);
    if (!paid.ok || ('replay' in paid && paid.replay)) return paid;
    remember(quote.clock);
    return { ok: true, wallet: paid.wallet, pay: quote.pay };
  }

  /** A catalogue payout, once per item: quests, album sets, cases, agamas. The amount is the server's. */
  public claimOnce(accountId: string, kind: 'quest' | 'album' | 'case' | 'agama', item: string): Result<{ pay?: number; replay?: boolean }> {
    const table = kind === 'quest' ? QUEST_CASH : kind === 'album' ? ALBUM_CASH : kind === 'case' ? CASE_CASH : null;
    let pay = table ? table[item] : 0;
    if (kind === 'agama') {
      if (!/^agama-[a-z0-9-]{1,48}$/.test(item)) return { ok: false, reason: 'There is no such lizard.', wallet: this.wallet(accountId) };
      const caught = (this.db.prepare("SELECT COUNT(*) AS n FROM once_paid WHERE account_id = ? AND kind = 'agama'").get(accountId) as { n: number }).n;
      if (caught >= AGAMA_CAP) return { ok: false, reason: 'You have caught them all.', wallet: this.wallet(accountId) };
      pay = agamaPay(caught + 1);
    }
    if (!pay) return { ok: false, reason: 'There is nothing to pay for that.', wallet: this.wallet(accountId) };
    const idem = `once:${kind}:${item}`;
    if (this.db.prepare('SELECT 1 FROM once_paid WHERE account_id = ? AND kind = ? AND item = ?').get(accountId, kind, item)) {
      return { ok: true, wallet: this.wallet(accountId), replay: true, pay: 0 };
    }
    const memo = kind === 'quest' ? `Quest reward: ${item}` : kind === 'album' ? `Album set complete: ${item}` : kind === 'case' ? `Case solved: ${item}` : `Agama caught (${item})`;
    const paid = this.apply(accountId, kind, pay, 0, memo, true, idem);
    if (!paid.ok || ('replay' in paid && paid.replay)) return paid;
    this.db.prepare('INSERT INTO once_paid (account_id, kind, item) VALUES (?, ?, ?)').run(accountId, kind, item);
    return { ok: true, wallet: paid.wallet, pay };
  }

  /** A NaijaBet ticket: ₦1,000 from the pocket, and a 6% chance the server draws of ₦15,000 back. */
  public playNaibet(accountId: string, idemRaw: unknown): Result<{ won?: boolean; pay?: number; replay?: boolean }> {
    const idem = cleanIdem(idemRaw);
    if (!idem) return { ok: false, reason: 'That could not be read.', wallet: this.wallet(accountId) };
    if (this.db.prepare('SELECT 1 FROM ledger WHERE account_id = ? AND idem = ?').get(accountId, idem)) {
      return { ok: true, wallet: this.wallet(accountId), replay: true };
    }
    const won = Math.random() < 0.06;
    const paid = this.apply(accountId, 'naibet', won ? 14_000 : -1_000, 0, won ? 'NaijaBet Accumulator Win' : 'NaijaBet 5-Game Ticket', true, idem);
    if (!paid.ok) return paid;
    return { ok: true, wallet: paid.wallet, won, pay: won ? 15_000 : 0 };
  }

  public totals(): { money: number; lastHour: { earned: number; spent: number }; alerts: unknown[] } {
    const money = (this.db.prepare('SELECT COALESCE(SUM(cash + bank), 0) AS m FROM wallets').get() as { m: number }).m;
    const hour = this.db
      .prepare('SELECT COALESCE(SUM(CASE WHEN cash_delta + bank_delta > 0 THEN cash_delta + bank_delta END), 0) AS earned, COALESCE(-SUM(CASE WHEN cash_delta + bank_delta < 0 THEN cash_delta + bank_delta END), 0) AS spent FROM ledger WHERE at >= ? AND kind NOT IN (\'start\', \'import\')')
      .get(Date.now() - 3_600_000) as { earned: number; spent: number };
    const alerts = this.db.prepare('SELECT at, account_id, kind, detail FROM alerts ORDER BY id DESC LIMIT 30').all();
    return { money, lastHour: hour, alerts };
  }
}

/** The name other server modules import the economy by */
export type ServerEconomy = Economy;
