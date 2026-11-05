/**
 * Hustle: players hire players. Someone posts a job with a fee (decorate my house, DJ my party,
 * drive me to the airport); the fee leaves their bank at once and is held by the game, so the
 * worker knows it is there. Another player takes the job; when the poster says it is done, the
 * fee (less the app's 5%) goes to the worker. An open job can be cancelled for a full refund; a
 * worker can give a job back. Money only moves on the server.
 */
import { randomUUID } from 'node:crypto';
import type { Store } from './store.ts';
import type { Economy } from './economy.ts';
import type { Account } from './accounts.ts';

export const CATEGORIES = ['decorator', 'cook', 'dj', 'driver', 'photographer', 'bodyguard', 'tutor', 'tailor', 'mc', 'cleaner', 'builder', 'other'] as const;
const CUT = 0.05;
const MIN_FEE = 1_000;
const MAX_FEE = 5_000_000_000;

export interface HustlePost {
  id: string;
  posterId: string;
  posterName: string;
  title: string;
  category: string;
  fee: number;
  status: 'open' | 'taken' | 'done' | 'cancelled';
  workerId: string | null;
  workerName: string | null;
  createdAt: number;
}

type Out = { ok: true; post?: HustlePost } | { ok: false; reason: string };

export class Hustle {
  private db: Store;
  private economy: Economy;

  constructor(db: Store, economy: Economy) {
    this.db = db;
    this.economy = economy;
    db.exec(`CREATE TABLE IF NOT EXISTS hustle_posts (
      id TEXT PRIMARY KEY, poster_id TEXT NOT NULL, poster_name TEXT NOT NULL, title TEXT NOT NULL, category TEXT NOT NULL,
      fee INTEGER NOT NULL, status TEXT NOT NULL, worker_id TEXT, worker_name TEXT, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL
    )`);
    db.exec('CREATE INDEX IF NOT EXISTS hustle_open ON hustle_posts (status, created_at)');
  }

  private view(r: Record<string, unknown> | undefined): HustlePost | null {
    if (!r) return null;
    return {
      id: String(r.id), posterId: String(r.poster_id), posterName: String(r.poster_name), title: String(r.title), category: String(r.category),
      fee: Number(r.fee), status: r.status as HustlePost['status'], workerId: (r.worker_id as string | null) ?? null, workerName: (r.worker_name as string | null) ?? null, createdAt: Number(r.created_at),
    };
  }

  private get(id: unknown): HustlePost | null {
    return this.view(this.db.prepare('SELECT * FROM hustle_posts WHERE id = ?').get(String(id ?? '')) as Record<string, unknown> | undefined);
  }

  /** The jobs anyone can take, newest first */
  public board(): HustlePost[] {
    return (this.db.prepare("SELECT * FROM hustle_posts WHERE status = 'open' ORDER BY created_at DESC LIMIT 60").all() as Array<Record<string, unknown>>).map((r) => this.view(r)!);
  }

  /** What this player posted and what they are working on */
  public mine(accountId: string): HustlePost[] {
    return (this.db.prepare("SELECT * FROM hustle_posts WHERE (poster_id = ? OR worker_id = ?) AND status IN ('open', 'taken', 'done') ORDER BY updated_at DESC LIMIT 40").all(accountId, accountId) as Array<Record<string, unknown>>).map((r) => this.view(r)!);
  }

  public post(account: Account, raw: { title?: unknown; category?: unknown; fee?: unknown }): Out {
    const title = String(raw.title ?? '').replace(/\s+/g, ' ').trim().slice(0, 80);
    const category = CATEGORIES.includes(String(raw.category) as (typeof CATEGORIES)[number]) ? String(raw.category) : 'other';
    const fee = Math.trunc(Number(raw.fee));
    if (title.length < 4) return { ok: false, reason: 'Say what the job is, in a few words.' };
    if (!Number.isFinite(fee) || fee < MIN_FEE || fee > MAX_FEE) return { ok: false, reason: `The fee is from ₦${MIN_FEE.toLocaleString()} to ₦${MAX_FEE.toLocaleString()}.` };
    const id = `job_${randomUUID().replace(/-/g, '').slice(0, 14)}`;
    const held = this.economy.holdFee(account.id, fee, `Hustle: held for "${title}"`, `hustle-hold:${id}`);
    if (!held.ok) return { ok: false, reason: `₦${fee.toLocaleString()} is held from your bank until the job is done, and your bank does not have it.` };
    const now = Date.now();
    this.db.prepare("INSERT INTO hustle_posts (id, poster_id, poster_name, title, category, fee, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, 'open', ?, ?)").run(id, account.id, account.name, title, category, fee, now, now);
    return { ok: true, post: this.get(id)! };
  }

  public take(account: Account, id: unknown): Out {
    const p = this.get(id);
    if (!p || p.status !== 'open') return { ok: false, reason: 'That job has been taken or is gone.' };
    if (p.posterId === account.id) return { ok: false, reason: 'You cannot take your own job.' };
    this.db.prepare("UPDATE hustle_posts SET status = 'taken', worker_id = ?, worker_name = ?, updated_at = ? WHERE id = ? AND status = 'open'").run(account.id, account.name, Date.now(), p.id);
    return { ok: true, post: this.get(p.id)! };
  }

  /** The poster says it is done: the fee goes to the worker, less the app's cut */
  public release(account: Account, id: unknown): Out {
    const p = this.get(id);
    if (!p || p.posterId !== account.id) return { ok: false, reason: 'Only whoever posted the job can say it is done.' };
    if (p.status !== 'taken' || !p.workerId) return { ok: false, reason: 'Nobody has taken that job yet.' };
    const pay = Math.round(p.fee * (1 - CUT));
    const paid = this.economy.payFee(p.workerId, pay, `Hustle: "${p.title}" for @${p.posterName}`, `hustle-pay:${p.id}`);
    if (!paid.ok) return { ok: false, reason: 'The payment could not be made. Try again.' };
    this.db.prepare("UPDATE hustle_posts SET status = 'done', updated_at = ? WHERE id = ?").run(Date.now(), p.id);
    return { ok: true, post: this.get(p.id)! };
  }

  /** An open job taken down: the held fee back in full */
  public cancel(account: Account, id: unknown): Out {
    const p = this.get(id);
    if (!p || p.posterId !== account.id) return { ok: false, reason: 'Only whoever posted the job can cancel it.' };
    if (p.status !== 'open') return { ok: false, reason: p.status === 'taken' ? `@${p.workerName} is on it: ask them to give it back first.` : 'That job is closed.' };
    this.db.prepare("UPDATE hustle_posts SET status = 'cancelled', updated_at = ? WHERE id = ?").run(Date.now(), p.id);
    this.economy.payFee(p.posterId, p.fee, `Hustle: refund for "${p.title}"`, `hustle-refund:${p.id}`);
    return { ok: true };
  }

  /** A worker gives a job back: open for someone else */
  public quit(account: Account, id: unknown): Out {
    const p = this.get(id);
    if (!p || p.workerId !== account.id || p.status !== 'taken') return { ok: false, reason: 'You are not working on that job.' };
    this.db.prepare("UPDATE hustle_posts SET status = 'open', worker_id = NULL, worker_name = NULL, updated_at = ? WHERE id = ?").run(Date.now(), p.id);
    return { ok: true };
  }
}
