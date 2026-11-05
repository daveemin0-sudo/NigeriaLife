/**
 * The Eko Premier League's bookmaker. The fixtures and prices are public and worked out the same
 * way as in the game (`src/sport/League.ts`); what is kept here is each match's seed, made from a
 * secret the server keeps, and given out only once the match has kicked off. A bet is taken
 * before kick-off, its stake held from the player's bank; when the match is over the server
 * plays it back from its own seed and pays a winner the stake times the price it was taken at.
 * Money only moves here, so a winning bet is paid in full and is never held as unchecked earnings.
 */
import { createHmac, randomBytes, randomUUID } from 'node:crypto';
import type { Store } from './store.ts';
import type { Economy } from './economy.ts';
import type { Account } from './accounts.ts';
import { fixture, odds, result, won, slotAt, PICKS, type Pick } from '../src/sport/League.ts';

const MIN_STAKE = 100;
const MAX_STAKE = 10_000_000;
/** How many matches ahead a bet can be placed on, and how many bets can be open at once */
const AHEAD = 4;
const MAX_OPEN = 8;

export interface Bet {
  id: string;
  slot: number;
  pick: Pick;
  stake: number;
  price: number;
  status: 'open' | 'won' | 'lost';
  score: [number, number] | null;
  placedAt: number;
}

type Out = { ok: true; bet?: Bet } | { ok: false; reason: string };

export class League {
  private db: Store;
  private economy: Economy;
  private secret: Buffer;

  constructor(db: Store, economy: Economy) {
    this.db = db;
    this.economy = economy;
    db.exec('CREATE TABLE IF NOT EXISTS league_secret (id INTEGER PRIMARY KEY CHECK (id = 1), secret TEXT NOT NULL)');
    db.exec(`CREATE TABLE IF NOT EXISTS bets (
      id TEXT PRIMARY KEY, account_id TEXT NOT NULL, slot INTEGER NOT NULL, pick TEXT NOT NULL, stake INTEGER NOT NULL,
      price REAL NOT NULL, status TEXT NOT NULL, home INTEGER, away INTEGER, paid INTEGER NOT NULL DEFAULT 0, placed_at INTEGER NOT NULL
    )`);
    db.exec('CREATE INDEX IF NOT EXISTS bets_open ON bets (status, slot)');
    db.exec('CREATE INDEX IF NOT EXISTS bets_mine ON bets (account_id, placed_at)');
    const row = db.prepare('SELECT secret FROM league_secret WHERE id = 1').get() as { secret: string } | undefined;
    const kept = process.env.NL_LEAGUE_SECRET || row?.secret;
    if (!kept) {
      const made = randomBytes(32).toString('hex');
      db.prepare('INSERT INTO league_secret (id, secret) VALUES (1, ?)').run(made);
      this.secret = Buffer.from(made, 'hex');
    } else {
      this.secret = Buffer.from(kept, 'hex');
    }
  }

  /** A match's seed, from the secret: the same every time it is asked for */
  private seed(slot: number): number {
    return createHmac('sha256', this.secret).update(`eko-league:${slot}`).digest().readUInt32BE(0);
  }

  /** The seeds of the matches that have kicked off lately (the one on now and the last few), for the games to show them */
  public seeds(now = Date.now()): Record<number, number> {
    const current = slotAt(now);
    const out: Record<number, number> = {};
    for (let slot = current - 8; slot <= current; slot++) if (fixture(slot).kickoff <= now) out[slot] = this.seed(slot);
    return out;
  }

  private view(r: Record<string, unknown>): Bet {
    return {
      id: String(r.id), slot: Number(r.slot), pick: r.pick as Pick, stake: Number(r.stake), price: Number(r.price),
      status: r.status as Bet['status'], score: r.home === null || r.home === undefined ? null : [Number(r.home), Number(r.away)], placedAt: Number(r.placed_at),
    };
  }

  public mine(accountId: string): Bet[] {
    this.settle();
    return (this.db.prepare('SELECT * FROM bets WHERE account_id = ? ORDER BY placed_at DESC LIMIT 40').all(accountId) as Array<Record<string, unknown>>).map((r) => this.view(r));
  }

  public place(account: Account, raw: { slot?: unknown; pick?: unknown; stake?: unknown }, now = Date.now()): Out {
    const slot = Math.trunc(Number(raw.slot));
    const pick = String(raw.pick ?? '') as Pick;
    const stake = Math.trunc(Number(raw.stake));
    const current = slotAt(now);
    if (!Number.isFinite(slot) || slot <= current || slot > current + AHEAD) return { ok: false, reason: 'Bets close at kick-off. Pick one of the next matches.' };
    if (!PICKS.some((p) => p.id === pick)) return { ok: false, reason: 'Pick a result to back.' };
    if (!Number.isFinite(stake) || stake < MIN_STAKE || stake > MAX_STAKE) return { ok: false, reason: `Stakes are from ₦${MIN_STAKE.toLocaleString()} to ₦${MAX_STAKE.toLocaleString()}.` };
    const open = (this.db.prepare("SELECT COUNT(*) AS n FROM bets WHERE account_id = ? AND status = 'open'").get(account.id) as { n: number }).n;
    if (open >= MAX_OPEN) return { ok: false, reason: `You have ${MAX_OPEN} bets running. Wait for some to finish.` };
    const f = fixture(slot);
    const price = odds(f)[pick];
    const id = `bet_${randomUUID().replace(/-/g, '').slice(0, 14)}`;
    const label = PICKS.find((p) => p.id === pick)!.label;
    const held = this.economy.holdFee(account.id, stake, `Naija Odds: ${f.home.short} v ${f.away.short}, ${label} @ ${price.toFixed(2)}`, `bet-stake:${id}`);
    if (!held.ok) return { ok: false, reason: `Your bank does not have ₦${stake.toLocaleString()} for that stake.` };
    this.db.prepare("INSERT INTO bets (id, account_id, slot, pick, stake, price, status, placed_at) VALUES (?, ?, ?, ?, ?, ?, 'open', ?)").run(id, account.id, slot, pick, stake, price, now);
    return { ok: true, bet: this.view(this.db.prepare('SELECT * FROM bets WHERE id = ?').get(id) as Record<string, unknown>) };
  }

  /** Every bet on a match that is over: played back from the seed, winners paid. Safe to run again. */
  public settle(now = Date.now()): number {
    const due = this.db.prepare("SELECT * FROM bets WHERE status = 'open' AND slot <= ? ORDER BY slot").all(slotAt(now)) as Array<Record<string, unknown>>;
    let settled = 0;
    for (const r of due) {
      const f = fixture(Number(r.slot));
      if (f.end > now) continue;
      const score = result(f, this.seed(f.slot));
      const win = won(r.pick as Pick, score);
      const changed = this.db.prepare("UPDATE bets SET status = ?, home = ?, away = ? WHERE id = ? AND status = 'open'").run(win ? 'won' : 'lost', score[0], score[1], String(r.id));
      if (Number(changed.changes) === 1) settled += 1;
    }
    // Pay winners not yet paid (the payment carries the bet's id, so it is never made twice)
    const unpaid = this.db.prepare("SELECT * FROM bets WHERE status = 'won' AND paid = 0").all() as Array<Record<string, unknown>>;
    for (const r of unpaid) {
      const f = fixture(Number(r.slot));
      const pay = Math.floor(Number(r.stake) * Number(r.price));
      const paid = this.economy.payFee(String(r.account_id), pay, `Naija Odds: won ${f.home.short} ${r.home}-${r.away} ${f.away.short}`, `bet-pay:${r.id}`);
      if (paid.ok) this.db.prepare('UPDATE bets SET paid = 1 WHERE id = ?').run(String(r.id));
    }
    return settled;
  }
}
