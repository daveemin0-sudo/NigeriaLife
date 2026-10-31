import type { DatabaseSync } from 'node:sqlite';
import type { Economy } from './economy.ts';

/**
 * Studio (Afrobeats Record Label) on the server: booking studio booth time at Naija Radio House,
 * recording 3-take tracks, collecting 5-day streaming royalties, and headlining live release
 * concerts at real Lagos venues.
 */

export const STUDIO_ROYALTY_DAYS = 5;
export const STUDIO_DAY_MS = 86_400_000;

export type StudioTrackId =
  | 'lagos-sunrise'
  | 'lekki-log-drum'
  | 'third-mainland-cruise'
  | 'ojuelegba-anthem'
  | 'grammy-nights-eko';

export interface ServerStudioTrack {
  id: StudioTrackId;
  title: string;
  genre: string;
  producer: string;
  label: string;
  minFame: number;
  studioFee: number;
  advancePay: number;
  dailyRoyalty: number;
  concertVenueKey: string;
  concertVenueName: string;
  concertFee: number;
  fameGain: number;
}

export const SERVER_STUDIO_TRACKS: readonly ServerStudioTrack[] = [
  {
    id: 'lagos-sunrise',
    title: 'Eko Sunrise',
    genre: 'Afrobeats',
    producer: 'Sarz-Beatz',
    label: 'Kalakuta Sound Lab',
    minFame: 0,
    studioFee: 25_000,
    advancePay: 35_000,
    dailyRoyalty: 14_000,
    concertVenueKey: 'freedom-park',
    concertVenueName: 'Freedom Park',
    concertFee: 40_000,
    fameGain: 15,
  },
  {
    id: 'lekki-log-drum',
    title: 'Lekki Log Drum',
    genre: 'Amapiano',
    producer: 'P-Prime',
    label: ' Mainland Rhythm Records',
    minFame: 15,
    studioFee: 40_000,
    advancePay: 55_000,
    dailyRoyalty: 22_000,
    concertVenueKey: 'afrika-shrine',
    concertVenueName: 'New Afrika Shrine',
    concertFee: 65_000,
    fameGain: 20,
  },
  {
    id: 'third-mainland-cruise',
    title: 'Third Mainland Cruise',
    genre: 'Afro-Fusion',
    producer: 'Rexxie-Vibe',
    label: 'Lagoon Wave Music',
    minFame: 35,
    studioFee: 60_000,
    advancePay: 80_000,
    dailyRoyalty: 32_000,
    concertVenueKey: 'ivory-rooftop',
    concertVenueName: 'Ivory Rooftop',
    concertFee: 95_000,
    fameGain: 25,
  },
  {
    id: 'ojuelegba-anthem',
    title: 'Ojuelegba Hustle',
    genre: 'Street-Pop',
    producer: 'MagicSticks',
    label: 'Surulere Gold Records',
    minFame: 60,
    studioFee: 85_000,
    advancePay: 110_000,
    dailyRoyalty: 44_000,
    concertVenueKey: 'afrika-shrine',
    concertVenueName: 'New Afrika Shrine',
    concertFee: 130_000,
    fameGain: 30,
  },
  {
    id: 'grammy-nights-eko',
    title: 'Eko to the World',
    genre: 'Arena Afrobeats',
    producer: 'Kel-V',
    label: 'Starboy Atlantic Lagos',
    minFame: 90,
    studioFee: 120_000,
    advancePay: 150_000,
    dailyRoyalty: 60_000,
    concertVenueKey: 'eko-grand-hotel',
    concertVenueName: 'Eko Grand Hotel',
    concertFee: 185_000,
    fameGain: 40,
  },
];

export interface ActiveStudioSessionView {
  trackId: StudioTrackId;
  title: string;
  genre: string;
  producer: string;
  label: string;
  studioFee: number;
  advancePay: number;
  concertVenueKey: string;
  concertVenueName: string;
  concertFee: number;
  bookedAt: number;
}

export interface ReleasedSongView {
  id: number;
  trackId: StudioTrackId;
  title: string;
  genre: string;
  producer: string;
  label: string;
  stars: 1 | 2 | 3;
  advancePay: number;
  bonus: number;
  dailyRoyalty: number;
  daysPaid: number;
  totalDays: number;
  totalRoyalties: number;
  streams: number;
  concertVenueKey: string;
  concertVenueName: string;
  concertFee: number;
  concertDone: boolean;
  fameEarned: number;
  releasedAt: number;
}

export class ServerStudio {
  private readonly db: DatabaseSync;
  private readonly economy: Economy;
  public now: () => number = () => Date.now();

  constructor(db: DatabaseSync, economy: Economy) {
    this.db = db;
    this.economy = economy;
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS studio_active (
        account_id TEXT PRIMARY KEY,
        track_id   TEXT NOT NULL,
        booked_at  INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS studio_songs (
        id              INTEGER PRIMARY KEY AUTOINCREMENT,
        account_id      TEXT NOT NULL,
        track_id        TEXT NOT NULL,
        stars           INTEGER NOT NULL,
        advance_pay     INTEGER NOT NULL,
        bonus           INTEGER NOT NULL,
        daily_royalty   INTEGER NOT NULL,
        days_paid       INTEGER NOT NULL DEFAULT 0,
        total_royalties INTEGER NOT NULL DEFAULT 0,
        streams         INTEGER NOT NULL DEFAULT 0,
        concert_done    INTEGER NOT NULL DEFAULT 0,
        fame_earned     INTEGER NOT NULL,
        released_at     INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_studio_songs_acc ON studio_songs (account_id, id DESC);
    `);
  }

  private trackFor(trackId: string): ServerStudioTrack | null {
    return SERVER_STUDIO_TRACKS.find((t) => t.id === trackId) ?? null;
  }

  public fameOf(accountId: string): number {
    const row = this.db
      .prepare('SELECT COALESCE(SUM(fame_earned), 0) AS fame FROM studio_songs WHERE account_id = ?')
      .get(accountId) as { fame: number } | undefined;
    return Number(row?.fame ?? 0);
  }

  public activeOf(accountId: string): ActiveStudioSessionView | null {
    const row = this.db
      .prepare('SELECT track_id, booked_at FROM studio_active WHERE account_id = ?')
      .get(accountId) as { track_id: string; booked_at: number } | undefined;
    if (!row) return null;
    const spec = this.trackFor(row.track_id);
    if (!spec) return null;
    return {
      trackId: spec.id,
      title: spec.title,
      genre: spec.genre,
      producer: spec.producer,
      label: spec.label,
      studioFee: spec.studioFee,
      advancePay: spec.advancePay,
      concertVenueKey: spec.concertVenueKey,
      concertVenueName: spec.concertVenueName,
      concertFee: spec.concertFee,
      bookedAt: row.booked_at,
    };
  }

  public settleRoyalties(accountId: string, at = this.now()): number {
    const rows = this.db
      .prepare(
        'SELECT id, track_id, daily_royalty, days_paid, total_royalties, streams, released_at FROM studio_songs WHERE account_id = ? AND days_paid < ?',
      )
      .all(accountId, STUDIO_ROYALTY_DAYS) as Array<{
      id: number;
      track_id: string;
      daily_royalty: number;
      days_paid: number;
      total_royalties: number;
      streams: number;
      released_at: number;
    }>;
    let paidNow = 0;
    const upd = this.db.prepare(
      'UPDATE studio_songs SET days_paid = ?, total_royalties = ?, streams = ? WHERE id = ?',
    );
    for (const r of rows) {
      const elapsed = Math.min(
        STUDIO_ROYALTY_DAYS,
        Math.max(0, Math.floor((at - r.released_at) / STUDIO_DAY_MS)),
      );
      if (elapsed <= r.days_paid) continue;
      const spec = this.trackFor(r.track_id);
      let daysPaid = r.days_paid;
      let totalRoyalties = r.total_royalties;
      let streams = r.streams;
      for (let d = r.days_paid + 1; d <= elapsed; d++) {
        this.economy.payFee(
          accountId,
          r.daily_royalty,
          `Studio streaming royalty: ${spec?.title ?? r.track_id} (Day ${d})`,
          `studio:royalty:${accountId}:${r.id}:d${d}`,
        );
        daysPaid = d;
        totalRoyalties += r.daily_royalty;
        streams += 45_000;
        paidNow += r.daily_royalty;
      }
      upd.run(daysPaid, totalRoyalties, streams, r.id);
    }
    return paidNow;
  }

  public discographyOf(accountId: string): ReleasedSongView[] {
    const rows = this.db
      .prepare(
        'SELECT id, track_id, stars, advance_pay, bonus, daily_royalty, days_paid, total_royalties, streams, concert_done, fame_earned, released_at FROM studio_songs WHERE account_id = ? ORDER BY id DESC LIMIT 40',
      )
      .all(accountId) as Array<{
      id: number;
      track_id: string;
      stars: number;
      advance_pay: number;
      bonus: number;
      daily_royalty: number;
      days_paid: number;
      total_royalties: number;
      streams: number;
      concert_done: number;
      fame_earned: number;
      released_at: number;
    }>;
    return rows.map((r) => {
      const spec = this.trackFor(r.track_id) ?? SERVER_STUDIO_TRACKS[0];
      return {
        id: r.id,
        trackId: spec.id,
        title: spec.title,
        genre: spec.genre,
        producer: spec.producer,
        label: spec.label,
        stars: Math.min(3, Math.max(1, r.stars)) as 1 | 2 | 3,
        advancePay: r.advance_pay,
        bonus: r.bonus,
        dailyRoyalty: r.daily_royalty,
        daysPaid: r.days_paid,
        totalDays: STUDIO_ROYALTY_DAYS,
        totalRoyalties: r.total_royalties,
        streams: r.streams,
        concertVenueKey: spec.concertVenueKey,
        concertVenueName: spec.concertVenueName,
        concertFee: spec.concertFee,
        concertDone: r.concert_done === 1,
        fameEarned: r.fame_earned,
        releasedAt: r.released_at,
      };
    });
  }

  public stateFor(accountId: string): {
    ok: true;
    fame: number;
    active: ActiveStudioSessionView | null;
    discography: ReleasedSongView[];
    paidNow: number;
    wallet: { cash: number; bank: number };
  } {
    const paidNow = this.settleRoyalties(accountId);
    return {
      ok: true,
      fame: this.fameOf(accountId),
      active: this.activeOf(accountId),
      discography: this.discographyOf(accountId),
      paidNow,
      wallet: this.economy.wallet(accountId),
    };
  }

  public bookSession(
    accountId: string,
    body: Record<string, unknown>,
  ): {
    ok: boolean;
    reason?: string;
    paid?: number;
    active?: ActiveStudioSessionView | null;
    fame?: number;
    wallet?: { cash: number; bank: number };
  } {
    const trackId = String(body.trackId ?? '').trim();
    const spec = this.trackFor(trackId);
    if (!spec) return { ok: false, reason: 'Unknown studio track.' };
    const fame = this.fameOf(accountId);
    if (fame < spec.minFame) {
      return {
        ok: false,
        reason: `${spec.title} needs ${spec.minFame} Music Fame (you have ${fame}).`,
      };
    }
    const existing = this.activeOf(accountId);
    if (existing) {
      return {
        ok: false,
        reason: `Finish recording ${existing.title} at Naija Radio House first.`,
      };
    }
    const now = this.now();
    let charged = this.economy.holdFee(
      accountId,
      spec.studioFee,
      `Studio session booking: ${spec.title} (${spec.producer})`,
      `studio:book:${accountId}:${spec.id}:${now}`,
    );
    if (!charged.ok) {
      charged = this.economy.debitCash(
        accountId,
        spec.studioFee,
        `Studio session booking: ${spec.title} (${spec.producer})`,
        `studio:book_cash:${accountId}:${spec.id}:${now}`,
      );
    }
    if (!charged.ok) return { ok: false, reason: charged.reason };

    this.db
      .prepare(
        'INSERT INTO studio_active (account_id, track_id, booked_at) VALUES (?, ?, ?) ON CONFLICT(account_id) DO UPDATE SET track_id = excluded.track_id, booked_at = excluded.booked_at',
      )
      .run(accountId, spec.id, now);

    return {
      ok: true,
      paid: spec.studioFee,
      active: this.activeOf(accountId),
      fame,
      wallet: this.economy.wallet(accountId),
    };
  }

  public completeRecording(
    accountId: string,
    body: Record<string, unknown>,
  ): {
    ok: boolean;
    reason?: string;
    song?: ReleasedSongView;
    fame?: number;
    active?: null;
    discography?: ReleasedSongView[];
    wallet?: { cash: number; bank: number };
  } {
    const trackId = String(body.trackId ?? '').trim();
    const active = this.activeOf(accountId);
    if (!active || active.trackId !== trackId) {
      return {
        ok: false,
        reason: 'You do not have a booked studio session for that track. Book the booth first.',
      };
    }
    const spec = this.trackFor(trackId);
    if (!spec) return { ok: false, reason: 'Unknown studio track.' };

    const stars = Math.min(3, Math.max(1, Math.round(Number(body.stars) || 3))) as 1 | 2 | 3;
    const bonus =
      stars === 3
        ? Math.round((spec.advancePay * 0.3) / 50) * 50
        : stars === 2
          ? Math.round((spec.advancePay * 0.1) / 50) * 50
          : 0;
    const dailyRoyalty = Math.round((spec.dailyRoyalty * (1 + (stars - 1) * 0.25)) / 100) * 100;
    const fameEarned = spec.fameGain + (stars - 1) * 5;
    const streams = stars * 180_000 + fameEarned * 4_500;
    const now = this.now();

    const ins = this.db
      .prepare(
        'INSERT INTO studio_songs (account_id, track_id, stars, advance_pay, bonus, daily_royalty, days_paid, total_royalties, streams, concert_done, fame_earned, released_at) VALUES (?, ?, ?, ?, ?, ?, 0, 0, ?, 0, ?, ?)',
      )
      .run(accountId, spec.id, stars, spec.advancePay, bonus, dailyRoyalty, streams, fameEarned, now);
    const rowId = Number(ins.lastInsertRowid);
    this.db.prepare('DELETE FROM studio_active WHERE account_id = ?').run(accountId);

    const totalUpfront = spec.advancePay + bonus;
    this.economy.payFee(
      accountId,
      totalUpfront,
      `Studio master advance: ${spec.title} (${stars}★)`,
      `studio:record:${accountId}:${rowId}`,
    );

    const discography = this.discographyOf(accountId);
    const song = discography.find((s) => s.id === rowId) ?? discography[0];
    return {
      ok: true,
      song,
      fame: this.fameOf(accountId),
      active: null,
      discography,
      wallet: this.economy.wallet(accountId),
    };
  }

  public performConcert(
    accountId: string,
    body: Record<string, unknown>,
  ): {
    ok: boolean;
    reason?: string;
    paid?: number;
    song?: ReleasedSongView;
    fame?: number;
    discography?: ReleasedSongView[];
    wallet?: { cash: number; bank: number };
  } {
    const trackId = String(body.trackId ?? '').trim();
    const row = this.db
      .prepare(
        'SELECT id, track_id, stars, concert_done, streams, fame_earned FROM studio_songs WHERE account_id = ? AND track_id = ? ORDER BY id DESC LIMIT 1',
      )
      .get(accountId, trackId) as
      | {
          id: number;
          track_id: string;
          stars: number;
          concert_done: number;
          streams: number;
          fame_earned: number;
        }
      | undefined;
    if (!row) {
      return {
        ok: false,
        reason: 'Record and release that track at Naija Radio House before headlining a concert.',
      };
    }
    const spec = this.trackFor(row.track_id);
    if (!spec) return { ok: false, reason: 'Unknown studio track.' };
    if (row.concert_done === 1) {
      return {
        ok: false,
        reason: `You have already performed the headline release show for ${spec.title}.`,
      };
    }

    const perfStars = Math.min(3, Math.max(1, Math.round(Number(body.stars) || 3))) as 1 | 2 | 3;
    const bonus =
      perfStars === 3
        ? Math.round((spec.concertFee * 0.25) / 50) * 50
        : perfStars === 2
          ? Math.round((spec.concertFee * 0.1) / 50) * 50
          : 0;
    const totalPay = spec.concertFee + bonus;
    const newStreams = row.streams + 120_000 * perfStars;
    const newFame = row.fame_earned + 15 + (perfStars - 1) * 5;

    this.db
      .prepare('UPDATE studio_songs SET concert_done = 1, streams = ?, fame_earned = ? WHERE id = ?')
      .run(newStreams, newFame, row.id);

    this.economy.payFee(
      accountId,
      totalPay,
      `Headline concert: ${spec.title} live at ${spec.concertVenueName}`,
      `studio:concert:${accountId}:${row.id}`,
    );

    const discography = this.discographyOf(accountId);
    const song = discography.find((s) => s.id === row.id) ?? discography[0];
    return {
      ok: true,
      paid: totalPay,
      song,
      fame: this.fameOf(accountId),
      discography,
      wallet: this.economy.wallet(accountId),
    };
  }
}

