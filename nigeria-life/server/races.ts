import type { DatabaseSync } from 'node:sqlite';
import { randomInt, randomUUID } from 'node:crypto';
import type { Economy } from './economy.ts';
import type { Account } from './accounts.ts';
import { STAKES, believable, courseById, finishTime, placeOf, prize, racers, type Stake } from '../src/racing/RaceRules.ts';

/**
 * Street races on the server (src/racing/RaceRules.ts has the courses and the racers' pace). A
 * race is entered here: the stake is taken and the seed that sets the street racers' runs is
 * drawn here. At the finish the game sends the time and the time at each checkpoint; the server
 * checks no car could have done better, that the race took at least that long, works out the
 * racers' times from the same seed, and pays the winner. Each player's best time on each course
 * goes on the board.
 */
export class ServerRaces {
  private readonly db: DatabaseSync;
  private readonly economy: Economy;

  constructor(db: DatabaseSync, economy: Economy) {
    this.db = db;
    this.economy = economy;
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS races (
        id         TEXT    PRIMARY KEY,
        account_id TEXT    NOT NULL,
        course     TEXT    NOT NULL,
        mode       TEXT    NOT NULL,
        stake      INTEGER NOT NULL,
        seed       INTEGER NOT NULL,
        at         INTEGER NOT NULL,
        done       INTEGER NOT NULL DEFAULT 0
      );
      CREATE TABLE IF NOT EXISTS race_times (
        account_id TEXT    NOT NULL,
        course     TEXT    NOT NULL,
        name       TEXT    NOT NULL,
        ms         INTEGER NOT NULL,
        car        TEXT    NOT NULL,
        at         INTEGER NOT NULL,
        PRIMARY KEY (account_id, course)
      );
      CREATE INDEX IF NOT EXISTS race_times_board ON race_times (course, ms);
    `);
  }

  /** The twenty fastest on a course, and where this player stands */
  public board(me: string, courseId: string) {
    const course = courseById(courseId);
    if (!course) return { ok: false as const, reason: 'No such race.' };
    const top = this.db.prepare('SELECT account_id, name, ms, car, at FROM race_times WHERE course = ? ORDER BY ms ASC, at ASC LIMIT 20').all(course.id) as Array<{ account_id: string; name: string; ms: number; car: string; at: number }>;
    const mine = this.db.prepare('SELECT ms FROM race_times WHERE course = ? AND account_id = ?').get(course.id, me) as { ms: number } | undefined;
    const rank = mine ? 1 + (this.db.prepare('SELECT COUNT(*) AS n FROM race_times WHERE course = ? AND ms < ?').get(course.id, mine.ms) as { n: number }).n : null;
    return { ok: true as const, course: course.id, top: top.map((r) => ({ name: r.name, ms: r.ms, car: r.car, at: r.at, mine: r.account_id === me })), best: mine?.ms ?? null, rank };
  }

  /** On the grid: the stake taken (if any) and the race given its seed */
  public enter(account: Account, raw: { course?: unknown; mode?: unknown; stake?: unknown; idem?: unknown }) {
    const course = courseById(String(raw.course ?? ''));
    const mode = raw.mode === 'race' ? 'race' : 'trial';
    const stake = Math.trunc(Number(raw.stake ?? 0)) as Stake;
    const idem = typeof raw.idem === 'string' && /^[\w:-]{8,80}$/.test(raw.idem) ? raw.idem : null;
    if (!course || !idem || (mode === 'race' && !STAKES.includes(stake))) return { ok: false as const, reason: 'That race could not be read.', wallet: this.economy.wallet(account.id) };
    const open = this.db.prepare('SELECT id FROM races WHERE account_id = ? AND done = 0 AND at > ?').get(account.id, Date.now() - 30 * 60_000) as { id: string } | undefined;
    if (open) this.db.prepare('UPDATE races SET done = 1 WHERE id = ?').run(open.id);
    const put = mode === 'race' ? stake : 0;
    if (put > 0) {
      const paid = this.economy.charge(account.id, put, 'race-stake', `Stake: ${course.name}`, idem);
      if (!paid.ok) return { ok: false as const, reason: `The stake is ₦${put.toLocaleString()} and you do not have it.`, wallet: paid.wallet ?? this.economy.wallet(account.id) };
    }
    const id = `race_${randomUUID().replace(/-/g, '').slice(0, 16)}`;
    const seed = randomInt(1, 2 ** 31 - 1);
    this.db.prepare('INSERT INTO races (id, account_id, course, mode, stake, seed, at) VALUES (?, ?, ?, ?, ?, ?, ?)').run(id, account.id, course.id, mode, put, seed, Date.now());
    return { ok: true as const, race: id, seed, wallet: this.economy.wallet(account.id) };
  }

  /** Over the line: the time checked, the racers' times worked out, the winner paid, the best kept */
  public finish(account: Account, raw: { race?: unknown; seconds?: unknown; splits?: unknown; car?: unknown }) {
    const row = this.db.prepare('SELECT * FROM races WHERE id = ? AND account_id = ?').get(String(raw.race ?? ''), account.id) as { id: string; course: string; mode: string; stake: number; seed: number; at: number; done: number } | undefined;
    if (!row || row.done) return { ok: false as const, reason: 'That race is over.', wallet: this.economy.wallet(account.id) };
    this.db.prepare('UPDATE races SET done = 1 WHERE id = ?').run(row.id);
    const course = courseById(row.course)!;
    const seconds = Number(raw.seconds);
    const splits = Array.isArray(raw.splits) ? raw.splits.map(Number) : [];
    const doubt = believable(course, seconds, splits) ?? (Date.now() - row.at < seconds * 1000 * 0.5 ? 'The race was not on the road that long.' : null);
    if (doubt) return { ok: false as const, reason: doubt, wallet: this.economy.wallet(account.id) };
    const stake = row.stake as Stake;
    const field = row.mode === 'race' ? racers(course, stake, row.seed).map((r) => ({ name: r.name, seconds: finishTime(r.run) })) : [];
    const place = placeOf(seconds, field.map((r) => r.seconds));
    const won = row.mode === 'race' ? prize(stake, place, field.length + 1) : 0;
    let wallet = this.economy.wallet(account.id);
    if (won > 0) {
      const paid = this.economy.credit(account.id, won, 'race-prize', `Won: ${course.name}`, `race-prize:${row.id}`);
      if (paid.ok) wallet = paid.wallet;
    }
    const ms = Math.round(seconds * 1000);
    const car = String(raw.car ?? '').slice(0, 40) || 'a car';
    const before = this.db.prepare('SELECT ms FROM race_times WHERE account_id = ? AND course = ?').get(account.id, course.id) as { ms: number } | undefined;
    const best = !before || ms < before.ms;
    if (best) this.db.prepare('INSERT INTO race_times (account_id, course, name, ms, car, at) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(account_id, course) DO UPDATE SET ms = excluded.ms, car = excluded.car, at = excluded.at, name = excluded.name').run(account.id, course.id, account.name, ms, car, Date.now());
    return { ok: true as const, place, field, prize: won, best, wallet, board: this.board(account.id, course.id) };
  }
}
