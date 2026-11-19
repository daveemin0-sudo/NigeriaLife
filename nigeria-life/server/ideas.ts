/**
 * Ideas: what players want next. A player writes an idea, a wish or a bug (up to 400 letters),
 * others vote for the ones they want too (a vote once per player, taken back by voting again),
 * and the makers mark each one planned, being built, done, or not now. Ideas go through the chat
 * filter; a player can post one every two minutes; muted or banned players cannot post.
 */
import { randomUUID } from 'node:crypto';
import type { Store } from './store.ts';
import type { Account } from './accounts.ts';
import { filterChat } from './chatFilter.ts';

const MAX_TEXT = 400;
const GAP_MS = 120_000;
export const IDEA_KINDS = ['idea', 'wish', 'bug'] as const;
export const IDEA_STATUS = ['new', 'planned', 'building', 'done', 'not now'] as const;

export interface Idea {
  id: string;
  by: string;
  text: string;
  kind: string;
  at: number;
  votes: number;
  voted: boolean;
  status: string;
  mine: boolean;
}

type Out = { ok: true; idea?: Idea } | { ok: false; reason: string };

export class Ideas {
  private db: Store;

  constructor(db: Store) {
    this.db = db;
    db.exec("CREATE TABLE IF NOT EXISTS ideas (id TEXT PRIMARY KEY, account_id TEXT NOT NULL, name TEXT NOT NULL, text TEXT NOT NULL, kind TEXT NOT NULL DEFAULT 'idea', at INTEGER NOT NULL, votes INTEGER NOT NULL DEFAULT 0, status TEXT NOT NULL DEFAULT 'new', hidden INTEGER NOT NULL DEFAULT 0)");
    db.exec('CREATE INDEX IF NOT EXISTS ideas_votes ON ideas (votes)');
    db.exec('CREATE TABLE IF NOT EXISTS idea_votes (idea_id TEXT NOT NULL, account_id TEXT NOT NULL, PRIMARY KEY (idea_id, account_id))');
  }

  private shape(r: Record<string, unknown>, me: string): Idea {
    return { id: String(r.id), by: String(r.name), text: String(r.text), kind: String(r.kind), at: Number(r.at), votes: Number(r.votes), voted: !!r.voted, status: String(r.status), mine: r.account_id === me };
  }

  /** The most wanted first, or the newest first */
  public list(me: string, order: 'top' | 'new' = 'top', limit = 80): Idea[] {
    const by = order === 'new' ? 'i.at DESC' : 'i.votes DESC, i.at DESC';
    const rows = this.db.prepare(`SELECT i.*, (SELECT 1 FROM idea_votes v WHERE v.idea_id = i.id AND v.account_id = ?) AS voted FROM ideas i WHERE i.hidden = 0 ORDER BY ${by} LIMIT ?`).all(me, limit) as Array<Record<string, unknown>>;
    return rows.map((r) => this.shape(r, me));
  }

  public post(account: Account, raw: { text?: unknown; kind?: unknown }, now = Date.now()): Out {
    if (account.banned || account.mutedUntil > now) return { ok: false, reason: 'You are muted for now.' };
    const text = filterChat(String(raw.text ?? '').replace(/\s+/g, ' ').trim().slice(0, MAX_TEXT)).text;
    if (text.replace(/\*/g, '').trim().length < 8) return { ok: false, reason: 'Say a little more about it.' };
    const kind = (IDEA_KINDS as readonly string[]).includes(String(raw.kind)) ? String(raw.kind) : 'idea';
    const last = this.db.prepare('SELECT at FROM ideas WHERE account_id = ? ORDER BY at DESC LIMIT 1').get(account.id) as { at: number } | undefined;
    if (last && now - last.at < GAP_MS) return { ok: false, reason: 'One idea every two minutes. Thank you for so many!' };
    const id = `idea_${randomUUID().replace(/-/g, '').slice(0, 14)}`;
    this.db.prepare('INSERT INTO ideas (id, account_id, name, text, kind, at) VALUES (?, ?, ?, ?, ?, ?)').run(id, account.id, account.name, text, kind, now);
    // The one who has the idea wants it: their own vote comes with it
    this.db.prepare('INSERT INTO idea_votes (idea_id, account_id) VALUES (?, ?)').run(id, account.id);
    this.db.prepare('UPDATE ideas SET votes = 1 WHERE id = ?').run(id);
    const row = this.db.prepare('SELECT i.*, 1 AS voted FROM ideas i WHERE i.id = ?').get(id) as Record<string, unknown>;
    return { ok: true, idea: this.shape(row, account.id) };
  }

  /** A vote, once per player; voting again takes it back */
  public vote(account: Account, raw: { id?: unknown }): Out {
    const id = String(raw.id ?? '');
    if (!this.db.prepare('SELECT 1 FROM ideas WHERE id = ? AND hidden = 0').get(id)) return { ok: false, reason: 'That idea is gone.' };
    const had = this.db.prepare('SELECT 1 FROM idea_votes WHERE idea_id = ? AND account_id = ?').get(id, account.id);
    if (had) {
      this.db.prepare('DELETE FROM idea_votes WHERE idea_id = ? AND account_id = ?').run(id, account.id);
      this.db.prepare('UPDATE ideas SET votes = MAX(0, votes - 1) WHERE id = ?').run(id);
    } else {
      this.db.prepare('INSERT INTO idea_votes (idea_id, account_id) VALUES (?, ?)').run(id, account.id);
      this.db.prepare('UPDATE ideas SET votes = votes + 1 WHERE id = ?').run(id);
    }
    return { ok: true };
  }

  /** The makers: everything, the most wanted first, with who sent it */
  public forAdmin(limit = 300): Array<Record<string, unknown>> {
    return this.db.prepare('SELECT * FROM ideas ORDER BY hidden ASC, votes DESC, at DESC LIMIT ?').all(limit) as Array<Record<string, unknown>>;
  }

  /** The makers mark an idea planned, being built, done or not now; or hide it */
  public mark(raw: { id?: unknown; status?: unknown; hidden?: unknown }): Out {
    const id = String(raw.id ?? '');
    if (raw.hidden !== undefined) {
      const done = this.db.prepare('UPDATE ideas SET hidden = ? WHERE id = ?').run(raw.hidden ? 1 : 0, id);
      return Number(done.changes) ? { ok: true } : { ok: false, reason: 'No such idea.' };
    }
    const status = String(raw.status ?? '');
    if (!(IDEA_STATUS as readonly string[]).includes(status)) return { ok: false, reason: 'Not a status.' };
    const done = this.db.prepare('UPDATE ideas SET status = ? WHERE id = ?').run(status, id);
    return Number(done.changes) ? { ok: true } : { ok: false, reason: 'No such idea.' };
  }
}
