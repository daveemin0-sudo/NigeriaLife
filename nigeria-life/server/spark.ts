import type { DatabaseSync } from 'node:sqlite';
import type { Economy } from './economy.ts';

/**
 * Spark dating app on the server: matching with made-up profiles, scheduling dates at real
 * restaurants and lounges, and completing dates (paying the bill and raising closeness).
 */

export type SparkProfileId = 'zainab' | 'tolu' | 'amaka' | 'damilola' | 'chuka' | 'kemi';

export interface ServerSparkProfile {
  id: SparkProfileId;
  name: string;
  age: number;
  title: string;
  area: string;
  venueKey: string;
  venueName: string;
  dateBill: number;
}

export const SERVER_SPARK_PROFILES: Record<SparkProfileId, ServerSparkProfile> = {
  zainab: {
    id: 'zainab',
    name: 'Zainab Bello',
    age: 26,
    title: 'Architect',
    area: 'Ikoyi',
    venueKey: 'the-library',
    venueName: 'The Library',
    dateBill: 45_000,
  },
  tolu: {
    id: 'tolu',
    name: 'Tolu Adebayo',
    age: 28,
    title: 'Fintech Lead',
    area: 'Victoria Island',
    venueKey: 'ivory-rooftop',
    venueName: 'Ivory Rooftop',
    dateBill: 35_000,
  },
  amaka: {
    id: 'amaka',
    name: 'Amaka Okafor',
    age: 25,
    title: 'Fashion Stylist',
    area: 'Lekki',
    venueKey: 'allen-lounge',
    venueName: 'Allen Lounge',
    dateBill: 25_000,
  },
  damilola: {
    id: 'damilola',
    name: 'Damilola Coker',
    age: 29,
    title: 'Sound Producer',
    area: 'Yaba',
    venueKey: 'chop-express',
    venueName: 'Chop Express',
    dateBill: 12_000,
  },
  chuka: {
    id: 'chuka',
    name: 'Chuka Eze',
    age: 31,
    title: 'Marine Engineer',
    area: 'Victoria Island',
    venueKey: 'the-library',
    venueName: 'The Library',
    dateBill: 40_000,
  },
  kemi: {
    id: 'kemi',
    name: 'Kemi Adesanya',
    age: 24,
    title: 'Food Photographer',
    area: 'Surulere',
    venueKey: 'amala-shitta',
    venueName: 'Amala Shitta',
    dateBill: 8_500,
  },
};

export interface SparkMatchRow {
  profileId: SparkProfileId;
  matchedAt: number;
  closeness: number;
  datesCount: number;
}

export interface SparkDateRow {
  id: number;
  profileId: SparkProfileId;
  name: string;
  venueKey: string;
  venueName: string;
  bill: number;
  status: 'waiting' | 'completed';
  scheduledAt: number;
  completedAt: number | null;
}

export class ServerSpark {
  private readonly db: DatabaseSync;
  private readonly economy: Economy;

  constructor(db: DatabaseSync, economy: Economy) {
    this.db = db;
    this.economy = economy;
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS spark_matches (
        user_id     TEXT    NOT NULL,
        profile_id  TEXT    NOT NULL,
        matched_at  INTEGER NOT NULL,
        closeness   INTEGER NOT NULL DEFAULT 35,
        dates_count INTEGER NOT NULL DEFAULT 0,
        PRIMARY KEY (user_id, profile_id)
      );
      CREATE TABLE IF NOT EXISTS spark_dates (
        id           INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id      TEXT    NOT NULL,
        profile_id   TEXT    NOT NULL,
        venue_key    TEXT    NOT NULL,
        venue_name   TEXT    NOT NULL,
        bill         INTEGER NOT NULL,
        status       TEXT    NOT NULL DEFAULT 'waiting',
        scheduled_at INTEGER NOT NULL,
        completed_at INTEGER
      );
    `);
  }

  public snapshot(userId: string): {
    ok: true;
    matches: SparkMatchRow[];
    activeDate: SparkDateRow | null;
    completedDates: SparkDateRow[];
  } {
    const matchRows = this.db
      .prepare('SELECT profile_id, matched_at, closeness, dates_count FROM spark_matches WHERE user_id = ? ORDER BY matched_at DESC')
      .all(userId) as Array<{ profile_id: SparkProfileId; matched_at: number; closeness: number; dates_count: number }>;
    const matches: SparkMatchRow[] = matchRows
      .filter((r) => r.profile_id in SERVER_SPARK_PROFILES)
      .map((r) => ({
        profileId: r.profile_id,
        matchedAt: r.matched_at,
        closeness: r.closeness,
        datesCount: r.dates_count,
      }));

    const dateRows = this.db
      .prepare('SELECT id, profile_id, venue_key, venue_name, bill, status, scheduled_at, completed_at FROM spark_dates WHERE user_id = ? ORDER BY id DESC LIMIT 20')
      .all(userId) as Array<{
      id: number;
      profile_id: SparkProfileId;
      venue_key: string;
      venue_name: string;
      bill: number;
      status: 'waiting' | 'completed';
      scheduled_at: number;
      completed_at: number | null;
    }>;

    const mappedDates: SparkDateRow[] = dateRows
      .filter((r) => r.profile_id in SERVER_SPARK_PROFILES)
      .map((r) => ({
        id: r.id,
        profileId: r.profile_id,
        name: SERVER_SPARK_PROFILES[r.profile_id].name,
        venueKey: r.venue_key,
        venueName: r.venue_name,
        bill: r.bill,
        status: r.status,
        scheduledAt: r.scheduled_at,
        completedAt: r.completed_at,
      }));

    const activeDate = mappedDates.find((d) => d.status === 'waiting') ?? null;
    const completedDates = mappedDates.filter((d) => d.status === 'completed');

    return { ok: true, matches, activeDate, completedDates };
  }

  public like(
    userId: string,
    raw: { profileId?: unknown; now?: unknown },
  ):
    | { ok: true; profileId: SparkProfileId; matched: true; snapshot: ReturnType<ServerSpark['snapshot']> }
    | { ok: false; reason: string } {
    const profileId = String(raw.profileId ?? '').trim() as SparkProfileId;
    const spec = SERVER_SPARK_PROFILES[profileId];
    if (!spec) return { ok: false, reason: 'That Spark profile does not exist.' };

    const now = typeof raw.now === 'number' && Number.isFinite(raw.now) ? Math.trunc(raw.now) : Date.now();
    this.db
      .prepare(
        'INSERT INTO spark_matches (user_id, profile_id, matched_at, closeness, dates_count) VALUES (?, ?, ?, 35, 0) ON CONFLICT(user_id, profile_id) DO NOTHING',
      )
      .run(userId, profileId, now);

    return { ok: true, profileId, matched: true, snapshot: this.snapshot(userId) };
  }

  public scheduleDate(
    userId: string,
    raw: { profileId?: unknown; now?: unknown },
  ):
    | { ok: true; date: SparkDateRow; snapshot: ReturnType<ServerSpark['snapshot']> }
    | { ok: false; reason: string } {
    const profileId = String(raw.profileId ?? '').trim() as SparkProfileId;
    const spec = SERVER_SPARK_PROFILES[profileId];
    if (!spec) return { ok: false, reason: 'That Spark profile does not exist.' };

    const match = this.db
      .prepare('SELECT 1 FROM spark_matches WHERE user_id = ? AND profile_id = ?')
      .get(userId, profileId);
    if (!match) {
      return { ok: false, reason: `Match with ${spec.name} first before arranging a date.` };
    }

    const now = typeof raw.now === 'number' && Number.isFinite(raw.now) ? Math.trunc(raw.now) : Date.now();
    // Clear any previous waiting date so only one date is waiting at a time
    this.db.prepare("DELETE FROM spark_dates WHERE user_id = ? AND status = 'waiting'").run(userId);

    const info = this.db
      .prepare(
        "INSERT INTO spark_dates (user_id, profile_id, venue_key, venue_name, bill, status, scheduled_at) VALUES (?, ?, ?, ?, ?, 'waiting', ?)",
      )
      .run(userId, profileId, spec.venueKey, spec.venueName, spec.dateBill, now);

    const date: SparkDateRow = {
      id: Number(info.lastInsertRowid),
      profileId,
      name: spec.name,
      venueKey: spec.venueKey,
      venueName: spec.venueName,
      bill: spec.dateBill,
      status: 'waiting',
      scheduledAt: now,
      completedAt: null,
    };
    return { ok: true, date, snapshot: this.snapshot(userId) };
  }

  public completeDate(
    userId: string,
    raw: { profileId?: unknown; venueKey?: unknown; now?: unknown },
  ):
    | {
        ok: true;
        date: SparkDateRow;
        paid: number;
        closeness: number;
        wallet: { cash: number; bank: number };
        snapshot: ReturnType<ServerSpark['snapshot']>;
      }
    | { ok: false; reason: string } {
    const snap = this.snapshot(userId);
    const active = snap.activeDate;
    if (!active) {
      return { ok: false, reason: 'You do not have an active Spark date waiting.' };
    }
    if (raw.profileId && String(raw.profileId) !== active.profileId) {
      return { ok: false, reason: `Your active date is with ${active.name}, not that profile.` };
    }
    if (raw.venueKey && String(raw.venueKey) !== active.venueKey) {
      return { ok: false, reason: `${active.name} is waiting at ${active.venueName}.` };
    }

    const now = typeof raw.now === 'number' && Number.isFinite(raw.now) ? Math.trunc(raw.now) : Date.now();
    // Try bank card first via holdFee, or cash if bank is low
    let paidRes = this.economy.holdFee(
      userId,
      active.bill,
      `Spark date with ${active.name} at ${active.venueName}`,
      `spark_date:${userId}:${active.id}`,
    );
    if (!paidRes.ok) {
      paidRes = this.economy.debitCash(
        userId,
        active.bill,
        `Spark date with ${active.name} at ${active.venueName}`,
        `spark_date_cash:${userId}:${active.id}`,
      );
    }
    if (!paidRes.ok) {
      return { ok: false, reason: `You need ₦${active.bill.toLocaleString()} (cash or bank) to cover the date at ${active.venueName}.` };
    }

    this.db
      .prepare("UPDATE spark_dates SET status = 'completed', completed_at = ? WHERE id = ? AND user_id = ?")
      .run(now, active.id, userId);

    this.db
      .prepare('UPDATE spark_matches SET closeness = MIN(100, closeness + 25), dates_count = dates_count + 1 WHERE user_id = ? AND profile_id = ?')
      .run(userId, active.profileId);

    const updatedSnap = this.snapshot(userId);
    const matchRow = updatedSnap.matches.find((m) => m.profileId === active.profileId);
    const completedDate = updatedSnap.completedDates.find((d) => d.id === active.id) ?? {
      ...active,
      status: 'completed' as const,
      completedAt: now,
    };

    return {
      ok: true,
      date: completedDate,
      paid: active.bill,
      closeness: matchRow?.closeness ?? 60,
      wallet: paidRes.wallet!,
      snapshot: updatedSnap,
    };
  }
}

