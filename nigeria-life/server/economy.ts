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
import { alert, transaction, type Store } from './store.ts';

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

/** Earnings the game may report without the server checking them, in any ten minutes */
export const UNVERIFIED_EARNING_LIMIT = 60_000;
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
      .prepare(`SELECT COALESCE(SUM(cash_delta + bank_delta), 0) AS earned FROM ledger WHERE account_id = ? AND at >= ? AND cash_delta + bank_delta > 0 AND kind NOT IN ('start', 'import') ${onlyUnverified ? 'AND verified = 0' : ''}`)
      .get(accountId, since) as { earned: number };
    return r.earned;
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
  public report(accountId: string, raw: { cash?: unknown; bank?: unknown; memo?: unknown; idem?: unknown }): Result {
    const cash = whole(raw.cash ?? 0);
    const bank = whole(raw.bank ?? 0);
    const idem = cleanIdem(raw.idem);
    if (!Number.isFinite(cash) || !Number.isFinite(bank) || !idem) return { ok: false, reason: 'That could not be read.', wallet: this.wallet(accountId) };
    const memo = cleanMemo(raw.memo);
    const net = cash + bank;
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

  /** Why the player is not at the workplace now, or null if they are. */
  private notThere(accountId: string, employerId: string): string | null {
    const site = WORKSITES[employerId];
    const at = this.positionOf(accountId);
    if (!site) return 'That work is not run by the server yet.';
    if (!at || Date.now() - at.at > POSITION_FRESH_MS) return 'The server cannot see where you are. Check your connection.';
    if (site.place) return at.city === site.city && at.place === site.place ? null : 'You are not at the workplace.';
    if (at.city !== site.city || Math.hypot(at.x - site.x, at.z - site.z) > site.radius) return 'You are not at the workplace.';
    return null;
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

  public finishShift(accountId: string, shiftId: unknown, idemRaw: unknown): Result<{ pay?: number; promoted?: Grade; done?: number; replay?: boolean }> {
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
    this.db.prepare('UPDATE shifts SET finished_at = ? WHERE id = ?').run(Date.now(), shift.id);
    const paid = this.apply(accountId, 'shift', pay, 0, `${job.grade.title}, ${employer.name}`, true, idem);
    if (!paid.ok) return paid;
    this.db.prepare('UPDATE jobs SET done = done + 1 WHERE account_id = ? AND employer = ?').run(accountId, shift.employer);
    const now = gradeFor(employer, job.done + 1);
    return { ok: true, wallet: paid.wallet, pay, done: job.done + 1, promoted: now !== job.grade ? now : undefined };
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

  public grant(accountId: string, amount: number, memo: string): Result {
    return this.apply(accountId, 'grant', Math.trunc(amount), 0, cleanMemo(memo || 'From the game team'), true, `grant:${randomUUID()}`);
  }

  public ledger(accountId: string, limit = 50): unknown[] {
    return this.db.prepare('SELECT at, kind, cash_delta, bank_delta, cash_after, bank_after, verified, memo FROM ledger WHERE account_id = ? ORDER BY id DESC LIMIT ?').all(accountId, limit);
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
