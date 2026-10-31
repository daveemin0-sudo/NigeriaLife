/**
 * Yarn: what Lagos is saying. Players post a line (up to 280 letters) for everyone to read and
 * like. Posts go through the chat filter; a player can post once every 20 seconds; a like is
 * counted once per player. Muted or banned players cannot post.
 */
import { randomUUID } from 'node:crypto';
import type { Store } from './store.ts';
import type { Account } from './accounts.ts';
import { filterChat } from './chatFilter.ts';

const MAX_TEXT = 280;
const GAP_MS = 20_000;

export interface FeedPost {
  id: string;
  by: string;
  text: string;
  at: number;
  likes: number;
  liked: boolean;
  mine: boolean;
}

type Out = { ok: true; post?: FeedPost } | { ok: false; reason: string };

export class Feed {
  private db: Store;

  constructor(db: Store) {
    this.db = db;
    db.exec('CREATE TABLE IF NOT EXISTS feed_posts (id TEXT PRIMARY KEY, account_id TEXT NOT NULL, name TEXT NOT NULL, text TEXT NOT NULL, at INTEGER NOT NULL, likes INTEGER NOT NULL DEFAULT 0, hidden INTEGER NOT NULL DEFAULT 0)');
    db.exec('CREATE INDEX IF NOT EXISTS feed_at ON feed_posts (at)');
    db.exec('CREATE TABLE IF NOT EXISTS feed_likes (post_id TEXT NOT NULL, account_id TEXT NOT NULL, PRIMARY KEY (post_id, account_id))');
  }

  public latest(me: string, limit = 60): FeedPost[] {
    const rows = this.db.prepare('SELECT p.*, (SELECT 1 FROM feed_likes l WHERE l.post_id = p.id AND l.account_id = ?) AS liked FROM feed_posts p WHERE p.hidden = 0 ORDER BY p.at DESC LIMIT ?').all(me, limit) as Array<Record<string, unknown>>;
    return rows.map((r) => ({ id: String(r.id), by: String(r.name), text: String(r.text), at: Number(r.at), likes: Number(r.likes), liked: !!r.liked, mine: r.account_id === me }));
  }

  public post(account: Account, raw: { text?: unknown }, now = Date.now()): Out {
    if (account.banned || account.mutedUntil > now) return { ok: false, reason: 'You are muted for now.' };
    const text = filterChat(String(raw.text ?? '').replace(/\s+/g, ' ').trim().slice(0, MAX_TEXT)).text;
    if (text.replace(/\*/g, '').trim().length < 2) return { ok: false, reason: 'Say something first.' };
    const last = this.db.prepare('SELECT at FROM feed_posts WHERE account_id = ? ORDER BY at DESC LIMIT 1').get(account.id) as { at: number } | undefined;
    if (last && now - last.at < GAP_MS) return { ok: false, reason: 'Easy! One post every 20 seconds.' };
    const id = `yarn_${randomUUID().replace(/-/g, '').slice(0, 14)}`;
    this.db.prepare('INSERT INTO feed_posts (id, account_id, name, text, at) VALUES (?, ?, ?, ?, ?)').run(id, account.id, account.name, text, now);
    return { ok: true, post: this.latest(account.id, 1)[0] };
  }

  /** A like, once per player; liking again takes it back */
  public like(account: Account, raw: { id?: unknown }): Out {
    const id = String(raw.id ?? '');
    if (!this.db.prepare('SELECT 1 FROM feed_posts WHERE id = ? AND hidden = 0').get(id)) return { ok: false, reason: 'That post is gone.' };
    const had = this.db.prepare('SELECT 1 FROM feed_likes WHERE post_id = ? AND account_id = ?').get(id, account.id);
    if (had) {
      this.db.prepare('DELETE FROM feed_likes WHERE post_id = ? AND account_id = ?').run(id, account.id);
      this.db.prepare('UPDATE feed_posts SET likes = MAX(0, likes - 1) WHERE id = ?').run(id);
    } else {
      this.db.prepare('INSERT INTO feed_likes (post_id, account_id) VALUES (?, ?)').run(id, account.id);
      this.db.prepare('UPDATE feed_posts SET likes = likes + 1 WHERE id = ?').run(id);
    }
    return { ok: true };
  }

  /** The poster takes their own post down */
  public remove(account: Account, raw: { id?: unknown }): Out {
    const done = this.db.prepare('UPDATE feed_posts SET hidden = 1 WHERE id = ? AND account_id = ?').run(String(raw.id ?? ''), account.id);
    return Number(done.changes) ? { ok: true } : { ok: false, reason: 'That is not your post.' };
  }
}
