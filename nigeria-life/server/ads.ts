/**
 * Eko Ads: the billboards on the expressway, rented by players. One player holds a board at a
 * time, for as long as they have paid; everyone in the city sees what is on it. The words are
 * passed through the chat filter, because every player will read them. Rent is taken from the
 * renter's bank here, at the price in the shared table (`src/business/adPrices.ts`).
 */
import { randomUUID } from 'node:crypto';
import type { Store } from './store.ts';
import type { Economy } from './economy.ts';
import type { Account } from './accounts.ts';
import { filterChat } from './chatFilter.ts';
import { adPrice, parseBoard, AD_DAYS, AD_COLOURS, DAY_MS, type AdDays } from '../src/business/adPrices.ts';

export interface AdView {
  board: string;
  headline: string;
  line: string;
  colour: string;
  business: string | null;
  until: number;
  by: string;
  mine: boolean;
}

type Out = { ok: true; ad?: AdView } | { ok: false; reason: string };

const clean = (text: unknown, most: number) => filterChat(String(text ?? '').replace(/\s+/g, ' ').trim().slice(0, most)).text;

export class Ads {
  private db: Store;
  private economy: Economy;

  constructor(db: Store, economy: Economy) {
    this.db = db;
    this.economy = economy;
    db.exec(`CREATE TABLE IF NOT EXISTS ads (
      board TEXT PRIMARY KEY, account_id TEXT NOT NULL, name TEXT NOT NULL, headline TEXT NOT NULL, line TEXT NOT NULL,
      colour TEXT NOT NULL, business TEXT, until INTEGER NOT NULL, placed_at INTEGER NOT NULL
    )`);
  }

  private view(r: Record<string, unknown>, me: string): AdView {
    return { board: String(r.board), headline: String(r.headline), line: String(r.line), colour: String(r.colour), business: (r.business as string | null) ?? null, until: Number(r.until), by: String(r.name), mine: r.account_id === me };
  }

  public active(me: string, now = Date.now()): AdView[] {
    return (this.db.prepare('SELECT * FROM ads WHERE until > ? ORDER BY board').all(now) as Array<Record<string, unknown>>).map((r) => this.view(r, me));
  }

  public rent(account: Account, raw: { board?: unknown; days?: unknown; headline?: unknown; line?: unknown; colour?: unknown; business?: unknown }, now = Date.now()): Out {
    const board = String(raw.board ?? '');
    const days = Number(raw.days) as AdDays;
    if (!parseBoard(board)) return { ok: false, reason: 'That board is not on the road.' };
    if (!AD_DAYS.includes(days)) return { ok: false, reason: 'Rent it for a day, a week or a month.' };
    const headline = clean(raw.headline, 22);
    const line = clean(raw.line, 40);
    if (headline.replace(/\*/g, '').trim().length < 2) return { ok: false, reason: 'Write a headline for the board.' };
    const colour = AD_COLOURS.includes(String(raw.colour)) ? String(raw.colour) : AD_COLOURS[0];
    const business = typeof raw.business === 'string' && /^[\w-]{1,40}$/.test(raw.business) ? raw.business : null;
    const held = this.db.prepare('SELECT * FROM ads WHERE board = ?').get(board) as Record<string, unknown> | undefined;
    const live = held && Number(held.until) > now ? held : null;
    if (live && live.account_id !== account.id) return { ok: false, reason: `@${live.name} has that board for now.` };
    const price = adPrice(board, days);
    const paid = this.economy.holdFee(account.id, price, `Eko Ads: billboard ${board} for ${days} day${days === 1 ? '' : 's'}`, `ad:${randomUUID()}`);
    if (!paid.ok) return { ok: false, reason: `Your bank does not have ₦${price.toLocaleString()} for that.` };
    const until = (live ? Number(live.until) : now) + days * DAY_MS;
    this.db.prepare('INSERT OR REPLACE INTO ads (board, account_id, name, headline, line, colour, business, until, placed_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
      .run(board, account.id, account.name, headline, line, colour, business, until, now);
    return { ok: true, ad: this.view(this.db.prepare('SELECT * FROM ads WHERE board = ?').get(board) as Record<string, unknown>, account.id) };
  }

  /** The renter takes their advert down early; nothing is paid back */
  public remove(account: Account, raw: { board?: unknown }): Out {
    const done = this.db.prepare('DELETE FROM ads WHERE board = ? AND account_id = ?').run(String(raw.board ?? ''), account.id);
    return Number(done.changes) ? { ok: true } : { ok: false, reason: 'That is not your board.' };
  }
}
