import type { DatabaseSync } from 'node:sqlite';
import type { Economy } from './economy.ts';
import { SERVER_SPARK_PROFILES, type SparkProfileId } from './spark.ts';

/**
 * Marriage & Spouse system on the server:
 * - Buying wedding rings at Computer Village / Balogun Market
 * - Proposing at a romantic venue (closeness >= 75)
 * - Owambe Society Wedding banquet ceremony (booking and blessings)
 * - Spouse living in home with daily support, shared savings, and marital meals
 */

export type RingTierId = 'silver' | 'gold' | 'diamond';

export interface ServerWeddingRing {
  id: RingTierId;
  name: string;
  price: number;
  closenessBonus: number;
}

export const SERVER_WEDDING_RINGS: Record<RingTierId, ServerWeddingRing> = {
  silver: {
    id: 'silver',
    name: 'Silver Promise Band',
    price: 35_000,
    closenessBonus: 10,
  },
  gold: {
    id: 'gold',
    name: '18K Yellow Gold Wedding Ring',
    price: 120_000,
    closenessBonus: 20,
  },
  diamond: {
    id: 'diamond',
    name: 'Solitaire Platinum Diamond Ring',
    price: 350_000,
    closenessBonus: 30,
  },
};

export interface MarriageRow {
  userId: string;
  spouseId: SparkProfileId;
  spouseName: string;
  ringTier: RingTierId;
  status: 'engaged' | 'married';
  closeness: number;
  proposedAt: number;
  marriedAt: number | null;
  dowryPaid: number;
}

export class ServerMarriage {
  private readonly db: DatabaseSync;
  private readonly economy: Economy;

  constructor(db: DatabaseSync, economy: Economy) {
    this.db = db;
    this.economy = economy;
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS player_rings (
        user_id    TEXT NOT NULL,
        ring_id    TEXT NOT NULL,
        bought_at  INTEGER NOT NULL,
        PRIMARY KEY (user_id, ring_id)
      );
      CREATE TABLE IF NOT EXISTS marriages (
        user_id     TEXT PRIMARY KEY,
        spouse_id   TEXT NOT NULL,
        spouse_name TEXT NOT NULL,
        ring_tier   TEXT NOT NULL,
        status      TEXT NOT NULL DEFAULT 'engaged',
        closeness   INTEGER NOT NULL DEFAULT 75,
        proposed_at INTEGER NOT NULL,
        married_at  INTEGER,
        dowry_paid  INTEGER NOT NULL DEFAULT 0
      );
    `);
  }

  public snapshot(userId: string): {
    ok: true;
    rings: RingTierId[];
    marriage: MarriageRow | null;
  } {
    const ringRows = this.db
      .prepare('SELECT ring_id FROM player_rings WHERE user_id = ?')
      .all(userId) as Array<{ ring_id: RingTierId }>;
    const rings = ringRows.map((r) => r.ring_id).filter((r) => r in SERVER_WEDDING_RINGS);

    const m = this.db
      .prepare('SELECT user_id, spouse_id, spouse_name, ring_tier, status, closeness, proposed_at, married_at, dowry_paid FROM marriages WHERE user_id = ?')
      .get(userId) as
      | {
          user_id: string;
          spouse_id: SparkProfileId;
          spouse_name: string;
          ring_tier: RingTierId;
          status: 'engaged' | 'married';
          closeness: number;
          proposed_at: number;
          married_at: number | null;
          dowry_paid: number;
        }
      | undefined;

    const marriage: MarriageRow | null = m
      ? {
          userId: m.user_id,
          spouseId: m.spouse_id,
          spouseName: m.spouse_name,
          ringTier: m.ring_tier,
          status: m.status,
          closeness: m.closeness,
          proposedAt: m.proposed_at,
          marriedAt: m.married_at,
          dowryPaid: m.dowry_paid,
        }
      : null;

    return { ok: true, rings, marriage };
  }

  public buyRing(
    userId: string,
    raw: { ringId?: unknown; now?: unknown },
  ):
    | {
        ok: true;
        ring: ServerWeddingRing;
        paid: number;
        wallet: { cash: number; bank: number };
        snapshot: ReturnType<ServerMarriage['snapshot']>;
      }
    | { ok: false; reason: string } {
    const ringId = String(raw.ringId ?? '').trim() as RingTierId;
    const ring = SERVER_WEDDING_RINGS[ringId];
    if (!ring) return { ok: false, reason: 'Invalid wedding ring selection.' };

    const owned = this.db
      .prepare('SELECT 1 FROM player_rings WHERE user_id = ? AND ring_id = ?')
      .get(userId, ringId);
    if (owned) return { ok: false, reason: `You already have the ${ring.name}.` };

    const now = typeof raw.now === 'number' && Number.isFinite(raw.now) ? Math.trunc(raw.now) : Date.now();
    let paid = this.economy.holdFee(userId, ring.price, `Jewellery: ${ring.name}`, `ring:${userId}:${ringId}`);
    if (!paid.ok) {
      paid = this.economy.debitCash(userId, ring.price, `Jewellery: ${ring.name}`, `ring_cash:${userId}:${ringId}`);
    }
    if (!paid.ok) return { ok: false, reason: `You need ₦${ring.price.toLocaleString()} for the ${ring.name}.` };

    this.db.prepare('INSERT INTO player_rings (user_id, ring_id, bought_at) VALUES (?, ?, ?)').run(userId, ringId, now);

    return {
      ok: true,
      ring,
      paid: ring.price,
      wallet: paid.wallet!,
      snapshot: this.snapshot(userId),
    };
  }

  public propose(
    userId: string,
    raw: { spouseId?: unknown; ringId?: unknown; now?: unknown },
  ):
    | {
        ok: true;
        marriage: MarriageRow;
        snapshot: ReturnType<ServerMarriage['snapshot']>;
      }
    | { ok: false; reason: string } {
    const spouseId = String(raw.spouseId ?? '').trim() as SparkProfileId;
    const profile = SERVER_SPARK_PROFILES[spouseId];
    if (!profile) return { ok: false, reason: 'Unknown proposal partner.' };

    const snap = this.snapshot(userId);
    if (snap.marriage) {
      return { ok: false, reason: `You are already ${snap.marriage.status} to ${snap.marriage.spouseName}.` };
    }

    const ringId = String(raw.ringId ?? '').trim() as RingTierId;
    const ring = SERVER_WEDDING_RINGS[ringId];
    if (!ring || !snap.rings.includes(ringId)) {
      return { ok: false, reason: 'You must buy a wedding ring before proposing.' };
    }

    // Must have at least 1 completed date / 60+ closeness in Spark matches
    const match = this.db
      .prepare('SELECT closeness FROM spark_matches WHERE user_id = ? AND profile_id = ?')
      .get(userId, spouseId) as { closeness: number } | undefined;
    if (!match || match.closeness < 60) {
      return { ok: false, reason: `You need at least 60% closeness with ${profile.name} before proposing.` };
    }

    const now = typeof raw.now === 'number' && Number.isFinite(raw.now) ? Math.trunc(raw.now) : Date.now();
    const newCloseness = Math.min(100, match.closeness + ring.closenessBonus);

    this.db.prepare(`
      INSERT INTO marriages (user_id, spouse_id, spouse_name, ring_tier, status, closeness, proposed_at, married_at, dowry_paid)
      VALUES (?, ?, ?, ?, 'engaged', ?, ?, NULL, 0)
    `).run(userId, spouseId, profile.name, ringId, newCloseness, now);

    // Update Spark match closeness as well
    this.db.prepare('UPDATE spark_matches SET closeness = ? WHERE user_id = ? AND profile_id = ?').run(newCloseness, userId, spouseId);

    return {
      ok: true,
      marriage: this.snapshot(userId).marriage!,
      snapshot: this.snapshot(userId),
    };
  }

  public marry(
    userId: string,
    raw: { dowry?: unknown; now?: unknown },
  ):
    | {
        ok: true;
        marriage: MarriageRow;
        dowryPaid: number;
        wallet: { cash: number; bank: number };
        snapshot: ReturnType<ServerMarriage['snapshot']>;
      }
    | { ok: false; reason: string } {
    const snap = this.snapshot(userId);
    if (!snap.marriage) {
      return { ok: false, reason: 'You must propose and get engaged first.' };
    }
    if (snap.marriage.status === 'married') {
      return { ok: false, reason: `You are already married to ${snap.marriage.spouseName}.` };
    }

    const dowry = typeof raw.dowry === 'number' && raw.dowry >= 50_000 ? Math.trunc(raw.dowry) : 75_000;
    const now = typeof raw.now === 'number' && Number.isFinite(raw.now) ? Math.trunc(raw.now) : Date.now();

    let paid = this.economy.holdFee(userId, dowry, `Traditional Wedding Dowry & Ceremony: ${snap.marriage.spouseName}`, `marriage_dowry:${userId}`);
    if (!paid.ok) {
      paid = this.economy.debitCash(userId, dowry, `Traditional Wedding Dowry & Ceremony: ${snap.marriage.spouseName}`, `marriage_dowry_cash:${userId}`);
    }
    if (!paid.ok) {
      return { ok: false, reason: `You need ₦${dowry.toLocaleString()} for the traditional wedding ceremony & dowry.` };
    }

    this.db.prepare(`
      UPDATE marriages
      SET status = 'married', married_at = ?, dowry_paid = ?, closeness = 100
      WHERE user_id = ?
    `).run(now, dowry, userId);

    this.db.prepare('UPDATE spark_matches SET closeness = 100 WHERE user_id = ? AND profile_id = ?').run(userId, snap.marriage.spouseId);

    return {
      ok: true,
      marriage: this.snapshot(userId).marriage!,
      dowryPaid: dowry,
      wallet: paid.wallet!,
      snapshot: this.snapshot(userId),
    };
  }
}
