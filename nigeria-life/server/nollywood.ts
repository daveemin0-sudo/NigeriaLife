import type { DatabaseSync } from 'node:sqlite';
import type { ServerEconomy } from './economy.ts';

/**
 * Nollywood on the server: casting calls, auditions, location shoots, and box-office takings
 * paid over the next five real days. The server holds who is cast, what they have shot, their
 * fame, and which days of takings have already been paid, so no day or shoot can be paid twice.
 */

export const RELEASE_DAYS = 5;
export const DAY_MS = 86_400_000;

export interface ServerCastingCall {
  id: string;
  title: string;
  genre: string;
  director: string;
  studio: string;
  role: string;
  venueKey: string;
  venueName: string;
  minFame: number;
  shootPay: number;
  dailyRoyalty: number;
  fameGain: number;
}

export const SERVER_CASTING_CALLS: readonly ServerCastingCall[] = [
  {
    id: 'blood-on-the-lagoon',
    title: 'Blood on the Lagoon',
    genre: 'Crime thriller',
    director: 'Kunle Adebayo',
    studio: 'Surulere Pictures',
    role: 'Inspector Tunde',
    venueKey: 'marina-towers',
    venueName: 'Marina Towers',
    minFame: 0,
    shootPay: 45_000,
    dailyRoyalty: 18_000,
    fameGain: 15,
  },
  {
    id: 'royal-wedding-in-lekki',
    title: 'Royal Wedding in Lekki',
    genre: 'Romantic comedy',
    director: 'Bisi Olatunji',
    studio: 'Eko Reel Studios',
    role: 'Prince Adewale',
    venueKey: 'eko-grand-hotel',
    venueName: 'Eko Grand Hotel',
    minFame: 0,
    shootPay: 60_000,
    dailyRoyalty: 24_000,
    fameGain: 20,
  },
  {
    id: 'king-of-balogun',
    title: 'King of Balogun',
    genre: 'Market drama',
    director: 'Chukwudi Nwachukwu',
    studio: 'Idumota Film Works',
    role: 'Chief Emeka',
    venueKey: 'balogun-market',
    venueName: 'Balogun Market',
    minFame: 0,
    shootPay: 50_000,
    dailyRoyalty: 20_000,
    fameGain: 18,
  },
  {
    id: 'midnight-at-the-shrine',
    title: 'Midnight at the Shrine',
    genre: 'Musical drama',
    director: 'Sade Kuti-Bello',
    studio: 'Kalakuta Motion',
    role: 'Dapo the Saxophonist',
    venueKey: 'afrika-shrine',
    venueName: 'New Afrika Shrine',
    minFame: 15,
    shootPay: 75_000,
    dailyRoyalty: 30_000,
    fameGain: 25,
  },
  {
    id: 'island-heist',
    title: 'Island Heist',
    genre: 'Action thriller',
    director: 'Tobi Bankole',
    studio: 'Third Mainland Films',
    role: 'Zero',
    venueKey: 'ivory-rooftop',
    venueName: 'Ivory Rooftop',
    minFame: 30,
    shootPay: 100_000,
    dailyRoyalty: 40_000,
    fameGain: 30,
  },
];

export interface ActiveRoleView {
  filmId: string;
  title: string;
  role: string;
  director: string;
  studio: string;
  venueKey: string;
  venueName: string;
  auditionStars: 1 | 2 | 3;
  shootPay: number;
  castAt: number;
}

export interface ReleasedFilmView {
  id: number;
  filmId: string;
  title: string;
  genre: string;
  role: string;
  director: string;
  studio: string;
  venueKey: string;
  venueName: string;
  auditionStars: 1 | 2 | 3;
  shootStars: 1 | 2 | 3;
  stars: 1 | 2 | 3;
  shootPay: number;
  tip: number;
  dailyTaking: number;
  daysPaid: number;
  totalDays: number;
  totalTakings: number;
  fameEarned: number;
  releasedAt: number;
}

export class ServerNollywood {
  private readonly db: DatabaseSync;
  private readonly economy: ServerEconomy;
  public now: () => number = () => Date.now();

  constructor(db: DatabaseSync, economy: ServerEconomy) {
    this.db = db;
    this.economy = economy;
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS nollywood_active (
        account_id TEXT PRIMARY KEY,
        film_id TEXT NOT NULL,
        audition_stars INTEGER NOT NULL,
        cast_at INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS nollywood_films (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        account_id TEXT NOT NULL,
        film_id TEXT NOT NULL,
        audition_stars INTEGER NOT NULL,
        shoot_stars INTEGER NOT NULL,
        stars INTEGER NOT NULL,
        shoot_pay INTEGER NOT NULL,
        tip INTEGER NOT NULL,
        daily_taking INTEGER NOT NULL,
        days_paid INTEGER NOT NULL DEFAULT 0,
        total_takings INTEGER NOT NULL DEFAULT 0,
        fame_earned INTEGER NOT NULL,
        released_at INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_nollywood_films_acc ON nollywood_films (account_id, id DESC);
    `);
  }

  private callFor(filmId: string): ServerCastingCall | null {
    return SERVER_CASTING_CALLS.find((c) => c.id === filmId) ?? null;
  }

  public fameOf(accountId: string): number {
    const row = this.db.prepare('SELECT COALESCE(SUM(fame_earned), 0) AS fame FROM nollywood_films WHERE account_id = ?').get(accountId) as { fame: number } | undefined;
    return Number(row?.fame ?? 0);
  }

  public activeOf(accountId: string): ActiveRoleView | null {
    const row = this.db.prepare('SELECT film_id, audition_stars, cast_at FROM nollywood_active WHERE account_id = ?').get(accountId) as
      | { film_id: string; audition_stars: number; cast_at: number }
      | undefined;
    if (!row) return null;
    const spec = this.callFor(row.film_id);
    if (!spec) return null;
    return {
      filmId: spec.id,
      title: spec.title,
      role: spec.role,
      director: spec.director,
      studio: spec.studio,
      venueKey: spec.venueKey,
      venueName: spec.venueName,
      auditionStars: (Math.min(3, Math.max(1, row.audition_stars)) as 1 | 2 | 3),
      shootPay: spec.shootPay,
      castAt: row.cast_at,
    };
  }

  /** Settles any newly elapsed real days of box-office takings for this player's released films */
  public settleTakings(accountId: string, at = this.now()): number {
    const rows = this.db.prepare(
      'SELECT id, film_id, daily_taking, days_paid, total_takings, released_at FROM nollywood_films WHERE account_id = ? AND days_paid < ?'
    ).all(accountId, RELEASE_DAYS) as Array<{
      id: number;
      film_id: string;
      daily_taking: number;
      days_paid: number;
      total_takings: number;
      released_at: number;
    }>;
    let paidNow = 0;
    const upd = this.db.prepare('UPDATE nollywood_films SET days_paid = ?, total_takings = ? WHERE id = ?');
    for (const r of rows) {
      const elapsed = Math.min(RELEASE_DAYS, Math.max(0, Math.floor((at - r.released_at) / DAY_MS)));
      if (elapsed <= r.days_paid) continue;
      const spec = this.callFor(r.film_id);
      let daysPaid = r.days_paid;
      let totalTakings = r.total_takings;
      for (let d = r.days_paid + 1; d <= elapsed; d++) {
        this.economy.payFee(
          accountId,
          r.daily_taking,
          `Nollywood takings: ${spec?.title ?? r.film_id} (Day ${d})`,
          `nollywood:taking:${accountId}:${r.id}:d${d}`
        );
        daysPaid = d;
        totalTakings += r.daily_taking;
        paidNow += r.daily_taking;
      }
      upd.run(daysPaid, totalTakings, r.id);
    }
    return paidNow;
  }

  public filmographyOf(accountId: string): ReleasedFilmView[] {
    const rows = this.db.prepare(
      'SELECT id, film_id, audition_stars, shoot_stars, stars, shoot_pay, tip, daily_taking, days_paid, total_takings, fame_earned, released_at FROM nollywood_films WHERE account_id = ? ORDER BY id DESC LIMIT 40'
    ).all(accountId) as Array<{
      id: number;
      film_id: string;
      audition_stars: number;
      shoot_stars: number;
      stars: number;
      shoot_pay: number;
      tip: number;
      daily_taking: number;
      days_paid: number;
      total_takings: number;
      fame_earned: number;
      released_at: number;
    }>;
    return rows.map((r) => {
      const spec = this.callFor(r.film_id) ?? SERVER_CASTING_CALLS[0];
      return {
        id: r.id,
        filmId: r.film_id,
        title: spec.title,
        genre: spec.genre,
        role: spec.role,
        director: spec.director,
        studio: spec.studio,
        venueKey: spec.venueKey,
        venueName: spec.venueName,
        auditionStars: (Math.min(3, Math.max(1, r.audition_stars)) as 1 | 2 | 3),
        shootStars: (Math.min(3, Math.max(1, r.shoot_stars)) as 1 | 2 | 3),
        stars: (Math.min(3, Math.max(1, r.stars)) as 1 | 2 | 3),
        shootPay: r.shoot_pay,
        tip: r.tip,
        dailyTaking: r.daily_taking,
        daysPaid: r.days_paid,
        totalDays: RELEASE_DAYS,
        totalTakings: r.total_takings,
        fameEarned: r.fame_earned,
        releasedAt: r.released_at,
      };
    });
  }

  public stateFor(accountId: string): {
    ok: true;
    fame: number;
    active: ActiveRoleView | null;
    filmography: ReleasedFilmView[];
    paidNow: number;
    wallet: { cash: number; bank: number };
  } {
    const paidNow = this.settleTakings(accountId);
    return {
      ok: true,
      fame: this.fameOf(accountId),
      active: this.activeOf(accountId),
      filmography: this.filmographyOf(accountId),
      paidNow,
      wallet: this.economy.wallet(accountId),
    };
  }

  public audition(accountId: string, filmId: string, rawStars: number): {
    ok: boolean;
    reason?: string;
    active?: ActiveRoleView | null;
    fame?: number;
  } {
    const spec = this.callFor(filmId);
    if (!spec) return { ok: false, reason: 'That casting call is not open.' };
    const fame = this.fameOf(accountId);
    if (fame < spec.minFame) {
      return { ok: false, reason: `${spec.title} needs ${spec.minFame} Fame (you have ${fame}).` };
    }
    const existing = this.activeOf(accountId);
    if (existing && existing.filmId !== filmId) {
      return { ok: false, reason: `Finish shooting ${existing.title} at ${existing.venueName} first.` };
    }
    const stars = (Math.min(3, Math.max(1, Math.round(Number(rawStars) || 1))) as 1 | 2 | 3);
    this.db.prepare(
      'INSERT INTO nollywood_active (account_id, film_id, audition_stars, cast_at) VALUES (?, ?, ?, ?) ON CONFLICT(account_id) DO UPDATE SET film_id = excluded.film_id, audition_stars = excluded.audition_stars, cast_at = excluded.cast_at'
    ).run(accountId, spec.id, stars, this.now());
    return { ok: true, active: this.activeOf(accountId), fame };
  }

  public completeShoot(accountId: string, filmId: string, rawStars: number): {
    ok: boolean;
    reason?: string;
    film?: ReleasedFilmView;
    fame?: number;
    active?: null;
    filmography?: ReleasedFilmView[];
    wallet?: { cash: number; bank: number };
  } {
    const active = this.activeOf(accountId);
    if (!active || active.filmId !== filmId) {
      return { ok: false, reason: 'You have not been cast in that film yet. Audition first.' };
    }
    const spec = this.callFor(filmId);
    if (!spec) return { ok: false, reason: 'Unknown film.' };
    const shootStars = (Math.min(3, Math.max(1, Math.round(Number(rawStars) || 1))) as 1 | 2 | 3);
    const stars = (Math.min(3, Math.max(1, Math.round((active.auditionStars + shootStars) / 2))) as 1 | 2 | 3);
    const tip = shootStars === 3 ? Math.round((spec.shootPay * 0.3) / 50) * 50 : shootStars === 2 ? Math.round((spec.shootPay * 0.1) / 50) * 50 : 0;
    const dailyTaking = Math.round((spec.dailyRoyalty * (1 + (stars - 1) * 0.25)) / 100) * 100;
    const fameEarned = spec.fameGain + (stars - 1) * 5;
    const now = this.now();

    const ins = this.db.prepare(
      'INSERT INTO nollywood_films (account_id, film_id, audition_stars, shoot_stars, stars, shoot_pay, tip, daily_taking, days_paid, total_takings, fame_earned, released_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, 0, ?, ?)'
    ).run(accountId, spec.id, active.auditionStars, shootStars, stars, spec.shootPay, tip, dailyTaking, fameEarned, now);
    const rowId = Number(ins.lastInsertRowid);
    this.db.prepare('DELETE FROM nollywood_active WHERE account_id = ?').run(accountId);

    const totalUpfront = spec.shootPay + tip;
    this.economy.payFee(
      accountId,
      totalUpfront,
      `Nollywood shoot wrap: ${spec.title} (${spec.role})`,
      `nollywood:shoot:${accountId}:${rowId}`
    );

    const filmography = this.filmographyOf(accountId);
    const film = filmography.find((f) => f.id === rowId) ?? filmography[0];
    return {
      ok: true,
      film,
      fame: this.fameOf(accountId),
      active: null,
      filmography,
      wallet: this.economy.wallet(accountId),
    };
  }
}

