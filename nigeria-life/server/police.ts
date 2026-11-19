import type { DatabaseSync } from 'node:sqlite';
import type { Economy } from './economy.ts';
import { BRIBE, BRIBE_TAKEN, OFFENCES, sentence, standing, vetsStaff, type Custody, type RecordEntry } from '../src/life/Offences.ts';

/**
 * The police, on the server: who is in a cell and until when, what their bail is, and each
 * player's record. Bail is paid by the player or by anyone else, from their own money, once
 * (by its idempotency key); a bribe's luck is the server's. The game says what a player was
 * arrested for (it only ever costs them), but cannot shorten the time or unmake the record.
 */
export class ServerPolice {
  private readonly db: DatabaseSync;
  private readonly economy: Economy;
  /** A player's name, and whether they are connected now (set by the game server) */
  public nameOf: (id: string) => string = (id) => id;
  public isOnline: (id: string) => boolean = () => false;
  /** Tells a player something at once (set by the game server) */
  public tell: (id: string, message: unknown) => void = () => {};

  constructor(db: DatabaseSync, economy: Economy) {
    this.db = db;
    this.economy = economy;
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS custody (
        account_id TEXT PRIMARY KEY,
        offence    TEXT    NOT NULL,
        since      INTEGER NOT NULL,
        until      INTEGER NOT NULL,
        bail       INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS police_record (
        id         INTEGER PRIMARY KEY AUTOINCREMENT,
        account_id TEXT    NOT NULL,
        offence    TEXT    NOT NULL,
        at         INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS police_record_of ON police_record(account_id, at);
    `);
  }

  private record(id: string, now = Date.now()): RecordEntry[] {
    const rows = this.db.prepare('SELECT offence, at FROM police_record WHERE account_id = ? ORDER BY at').all(id) as Array<{ offence: string; at: number }>;
    return standing(rows.map((r) => ({ offence: r.offence, at: r.at })), now);
  }

  /** In a cell now, or null (time served is let out) */
  private custody(id: string, now = Date.now()): Custody | null {
    const row = this.db.prepare('SELECT offence, since, until, bail FROM custody WHERE account_id = ?').get(id) as Custody | undefined;
    if (!row) return null;
    if (row.until <= now) {
      this.db.prepare('DELETE FROM custody WHERE account_id = ?').run(id);
      return null;
    }
    return { offence: row.offence, since: row.since, until: row.until, bail: row.bail };
  }

  public state(id: string): { ok: true; custody: Custody | null; record: RecordEntry[]; now: number } {
    const now = Date.now();
    return { ok: true, custody: this.custody(id, now), record: this.record(id, now), now };
  }

  /** Arrested: on the record, and in a cell (a second charge while in one adds to the time and the bail) */
  public arrest(id: string, raw: { offence?: unknown }): { ok: true; custody: Custody; record: RecordEntry[]; now: number } | { ok: false; reason: string } {
    const offence = String(raw.offence ?? '');
    if (!OFFENCES[offence]) return { ok: false, reason: 'There is no such charge.' };
    const now = Date.now();
    const given = sentence(offence, this.record(id, now), now);
    const held = this.custody(id, now);
    this.db.prepare('INSERT INTO police_record (account_id, offence, at) VALUES (?, ?, ?)').run(id, offence, now);
    const custody: Custody = held
      ? { offence: held.offence, since: held.since, until: held.until + given.minutes * 60_000, bail: held.bail + given.bail }
      : { offence, since: now, until: now + given.minutes * 60_000, bail: given.bail };
    this.db
      .prepare('INSERT INTO custody (account_id, offence, since, until, bail) VALUES (?, ?, ?, ?, ?) ON CONFLICT(account_id) DO UPDATE SET offence = excluded.offence, since = excluded.since, until = excluded.until, bail = excluded.bail')
      .run(id, custody.offence, custody.since, custody.until, custody.bail);
    return { ok: true, custody, record: this.record(id, now), now };
  }

  /** Bail paid by `payerId` (the prisoner or anyone else), from their bank and then their cash */
  public bail(payerId: string, raw: { for?: unknown; idem?: unknown }) {
    const target = typeof raw.for === 'string' && raw.for ? raw.for : payerId;
    const held = this.custody(target);
    if (!held) return { ok: false as const, reason: target === payerId ? 'You are not in a cell.' : 'They are not in a cell any more.', wallet: this.economy.wallet(payerId) };
    const idem = typeof raw.idem === 'string' && /^[\w:-]{8,80}$/.test(raw.idem) ? raw.idem : null;
    if (!idem) return { ok: false as const, reason: 'That could not be read.', wallet: this.economy.wallet(payerId) };
    const paid = this.economy.charge(payerId, held.bail, 'bail', `Bail for ${target === payerId ? 'yourself' : this.nameOf(target)}: ${OFFENCES[held.offence]?.name ?? held.offence}`, idem);
    if (!paid.ok) return { ok: false as const, reason: `Bail is ₦${held.bail.toLocaleString()} and you do not have it.`, wallet: paid.wallet ?? this.economy.wallet(payerId) };
    this.db.prepare('DELETE FROM custody WHERE account_id = ?').run(target);
    if (target !== payerId) this.tell(target, { type: 'bailed', by: this.nameOf(payerId), amount: held.bail });
    return { ok: true as const, released: target, bail: held.bail, wallet: paid.wallet };
  }

  /** An envelope pushed through the bars: the officer takes it, or the player is charged with it */
  public bribe(id: string, raw: { idem?: unknown }) {
    const held = this.custody(id);
    if (!held) return { ok: false as const, reason: 'You are not in a cell.', wallet: this.economy.wallet(id) };
    const idem = typeof raw.idem === 'string' && /^[\w:-]{8,80}$/.test(raw.idem) ? raw.idem : null;
    if (!idem) return { ok: false as const, reason: 'That could not be read.', wallet: this.economy.wallet(id) };
    const paid = this.economy.charge(id, BRIBE, 'bribe', 'An envelope for the officer', idem);
    if (!paid.ok) return { ok: false as const, reason: `You do not have ₦${BRIBE.toLocaleString()}.`, wallet: paid.wallet ?? this.economy.wallet(id) };
    if ('replay' in paid && paid.replay) return { ...this.state(id), ok: true as const, replay: true, wallet: paid.wallet };
    if (Math.random() < BRIBE_TAKEN) {
      this.db.prepare('DELETE FROM custody WHERE account_id = ?').run(id);
      return { ...this.state(id), ok: true as const, taken: true, wallet: paid.wallet };
    }
    const charged = this.arrest(id, { offence: 'bribery' });
    return { ...(charged.ok ? charged : this.state(id)), ok: true as const, taken: false, wallet: paid.wallet };
  }

  /** Who is in a cell now and online, for anyone who would bail them */
  public held(viewerId: string): { ok: true; held: Array<{ id: string; name: string; bail: number; until: number; offence: string }> } {
    const now = Date.now();
    const rows = this.db.prepare('SELECT account_id, offence, until, bail FROM custody WHERE until > ? ORDER BY since DESC LIMIT 50').all(now) as Array<{ account_id: string; offence: string; until: number; bail: number }>;
    return {
      ok: true,
      held: rows
        .filter((r) => r.account_id !== viewerId && this.isOnline(r.account_id))
        .map((r) => ({ id: r.account_id, name: this.nameOf(r.account_id), bail: r.bail, until: r.until, offence: OFFENCES[r.offence]?.name ?? r.offence })),
    };
  }

  /** Why an employer that vets its staff will not take this player on, or null */
  public refuses(id: string, trade: string): string | null {
    if (!vetsStaff(trade)) return null;
    const record = this.record(id);
    return record.length ? 'They check police records, and yours is not clear.' : null;
  }
}
