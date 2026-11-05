import type { DatabaseSync } from 'node:sqlite';
import type { Economy } from './economy.ts';

/**
 * Owambe on the server: Aso-Ebi fabric purchases, Saturday Owambe party hall bookings at real
 * city venues, and dancefloor Naira spraying scored with ShiftSkill.
 */

export type AsoEbiId = 'gold-lace' | 'emerald-asooke' | 'coral-velvet';
export type OwambeTierId = 'island-birthday' | 'shrine-chieftaincy' | 'rooftop-champagne' | 'eko-grand-wedding';

export interface ServerAsoEbiSpec {
  id: AsoEbiId;
  name: string;
  price: number;
  fameBonus: number;
}

export interface ServerOwambeSpec {
  id: OwambeTierId;
  title: string;
  occasion: string;
  venueKey: string;
  venueName: string;
  mcName: string;
  bandName: string;
  bookingFee: number;
  sprayBundle: number;
  baseFame: number;
}

export const SERVER_ASO_EBI: Record<AsoEbiId, ServerAsoEbiSpec> = {
  'gold-lace': {
    id: 'gold-lace',
    name: 'Royal Gold Lace & Fila',
    price: 15_000,
    fameBonus: 5,
  },
  'emerald-asooke': {
    id: 'emerald-asooke',
    name: 'Emerald Handwoven Aso-Oke',
    price: 25_000,
    fameBonus: 10,
  },
  'coral-velvet': {
    id: 'coral-velvet',
    name: 'Coral Velvet & Edo Beads',
    price: 40_000,
    fameBonus: 15,
  },
};

export const SERVER_OWAMBE_SPECS: Record<OwambeTierId, ServerOwambeSpec> = {
  'island-birthday': {
    id: 'island-birthday',
    title: 'Lagos Island Birthday Owambe',
    occasion: 'Milestone Birthday Bash',
    venueKey: 'freedom-park',
    venueName: 'Freedom Park',
    mcName: 'Alhaji Tunde Gold',
    bandName: 'Sunny & The Jùjú Rockets',
    bookingFee: 35_000,
    sprayBundle: 15_000,
    baseFame: 15,
  },
  'shrine-chieftaincy': {
    id: 'shrine-chieftaincy',
    title: 'Kalakuta Chieftaincy Night',
    occasion: 'Chieftaincy & Afrobeat Celebration',
    venueKey: 'afrika-shrine',
    venueName: 'New Afrika Shrine',
    mcName: 'MC Shakara',
    bandName: 'Kalakuta Horns Collective',
    bookingFee: 55_000,
    sprayBundle: 25_000,
    baseFame: 22,
  },
  'rooftop-champagne': {
    id: 'rooftop-champagne',
    title: 'VI Champagne & Lace Soirée',
    occasion: 'Victoria Island Society Night',
    venueKey: 'ivory-rooftop',
    venueName: 'Ivory Rooftop',
    mcName: 'Hypeman Dotun',
    bandName: 'Eko Alte & Talking Drums',
    bookingFee: 85_000,
    sprayBundle: 40_000,
    baseFame: 30,
  },
  'eko-grand-wedding': {
    id: 'eko-grand-wedding',
    title: 'Eko Grand Society Wedding',
    occasion: 'Grand Ballroom Society Owambe',
    venueKey: 'eko-grand-hotel',
    venueName: 'Eko Grand Hotel',
    mcName: 'Chief Ebenezer',
    bandName: 'King Sunny Jùjú Orchestra',
    bookingFee: 120_000,
    sprayBundle: 60_000,
    baseFame: 45,
  },
};

export interface OwambePartyRow {
  id: number;
  tierId: OwambeTierId;
  title: string;
  occasion: string;
  venueKey: string;
  venueName: string;
  mcName: string;
  bandName: string;
  bookingFee: number;
  sprayBundle: number;
  asoEbiId: AsoEbiId | null;
  stars: 1 | 2 | 3;
  fameEarned: number;
  status: 'booked' | 'completed';
  bookedAt: number;
  completedAt: number | null;
}

export class ServerOwambe {
  private readonly db: DatabaseSync;
  private readonly economy: Economy;

  constructor(db: DatabaseSync, economy: Economy) {
    this.db = db;
    this.economy = economy;
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS owambe_asoebi (
        user_id      TEXT    NOT NULL,
        aso_ebi_id   TEXT    NOT NULL,
        purchased_at INTEGER NOT NULL,
        PRIMARY KEY (user_id, aso_ebi_id)
      );
      CREATE TABLE IF NOT EXISTS owambe_parties (
        id           INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id      TEXT    NOT NULL,
        tier_id      TEXT    NOT NULL,
        venue_key    TEXT    NOT NULL,
        venue_name   TEXT    NOT NULL,
        booking_fee  INTEGER NOT NULL,
        spray_bundle INTEGER NOT NULL,
        aso_ebi_id   TEXT,
        stars        INTEGER NOT NULL DEFAULT 3,
        fame_earned  INTEGER NOT NULL DEFAULT 0,
        status       TEXT    NOT NULL DEFAULT 'booked',
        booked_at    INTEGER NOT NULL,
        completed_at INTEGER
      );
    `);
  }

  public snapshot(userId: string): {
    ok: true;
    ownedAsoEbi: AsoEbiId[];
    equippedAsoEbi: AsoEbiId | null;
    activeParty: OwambePartyRow | null;
    history: OwambePartyRow[];
    totalSprayed: number;
    fameEarned: number;
  } {
    const asoRows = this.db
      .prepare('SELECT aso_ebi_id FROM owambe_asoebi WHERE user_id = ? ORDER BY purchased_at DESC')
      .all(userId) as Array<{ aso_ebi_id: AsoEbiId }>;
    const ownedAsoEbi = asoRows
      .map((r) => r.aso_ebi_id)
      .filter((id): id is AsoEbiId => id in SERVER_ASO_EBI);
    const equippedAsoEbi = ownedAsoEbi[0] ?? null;

    const partyRows = this.db
      .prepare(
        'SELECT id, tier_id, venue_key, venue_name, booking_fee, spray_bundle, aso_ebi_id, stars, fame_earned, status, booked_at, completed_at FROM owambe_parties WHERE user_id = ? ORDER BY id DESC LIMIT 25',
      )
      .all(userId) as Array<{
      id: number;
      tier_id: OwambeTierId;
      venue_key: string;
      venue_name: string;
      booking_fee: number;
      spray_bundle: number;
      aso_ebi_id: AsoEbiId | null;
      stars: number;
      fame_earned: number;
      status: 'booked' | 'completed';
      booked_at: number;
      completed_at: number | null;
    }>;

    const mapped: OwambePartyRow[] = partyRows
      .filter((r) => r.tier_id in SERVER_OWAMBE_SPECS)
      .map((r) => {
        const spec = SERVER_OWAMBE_SPECS[r.tier_id];
        const stars: 1 | 2 | 3 = r.stars === 3 ? 3 : r.stars === 2 ? 2 : 1;
        return {
          id: r.id,
          tierId: r.tier_id,
          title: spec.title,
          occasion: spec.occasion,
          venueKey: r.venue_key,
          venueName: r.venue_name,
          mcName: spec.mcName,
          bandName: spec.bandName,
          bookingFee: r.booking_fee,
          sprayBundle: r.spray_bundle,
          asoEbiId: r.aso_ebi_id,
          stars,
          fameEarned: r.fame_earned,
          status: r.status,
          bookedAt: r.booked_at,
          completedAt: r.completed_at,
        };
      });

    const activeParty = mapped.find((p) => p.status === 'booked') ?? null;
    const history = mapped.filter((p) => p.status === 'completed');
    const totalSprayed = history.reduce((sum, p) => sum + p.sprayBundle, 0);
    const fameEarned = history.reduce((sum, p) => sum + p.fameEarned, 0);

    return {
      ok: true,
      ownedAsoEbi,
      equippedAsoEbi,
      activeParty,
      history,
      totalSprayed,
      fameEarned,
    };
  }

  public buyAsoEbi(
    userId: string,
    raw: { asoEbiId?: unknown; now?: unknown },
  ):
    | {
        ok: true;
        asoEbiId: AsoEbiId;
        paid: number;
        wallet: { cash: number; bank: number };
        snapshot: ReturnType<ServerOwambe['snapshot']>;
      }
    | { ok: false; reason: string } {
    const asoEbiId = String(raw.asoEbiId ?? '').trim() as AsoEbiId;
    const spec = SERVER_ASO_EBI[asoEbiId];
    if (!spec) return { ok: false, reason: 'That Aso-Ebi fabric is not in the catalogue.' };

    const existing = this.db
      .prepare('SELECT 1 FROM owambe_asoebi WHERE user_id = ? AND aso_ebi_id = ?')
      .get(userId, asoEbiId);
    if (existing) {
      return { ok: false, reason: `You already own ${spec.name}.` };
    }

    const now = typeof raw.now === 'number' && Number.isFinite(raw.now) ? Math.trunc(raw.now) : Date.now();
    let paidRes = this.economy.holdFee(
      userId,
      spec.price,
      `Aso-Ebi fabric: ${spec.name}`,
      `owambe_asoebi:${userId}:${asoEbiId}`,
    );
    if (!paidRes.ok) {
      paidRes = this.economy.debitCash(
        userId,
        spec.price,
        `Aso-Ebi fabric: ${spec.name}`,
        `owambe_asoebi_cash:${userId}:${asoEbiId}`,
      );
    }
    if (!paidRes.ok) {
      return { ok: false, reason: `You need ₦${spec.price.toLocaleString()} to buy ${spec.name}.` };
    }

    this.db
      .prepare('INSERT INTO owambe_asoebi (user_id, aso_ebi_id, purchased_at) VALUES (?, ?, ?)')
      .run(userId, asoEbiId, now);

    return {
      ok: true,
      asoEbiId,
      paid: spec.price,
      wallet: paidRes.wallet!,
      snapshot: this.snapshot(userId),
    };
  }

  public bookParty(
    userId: string,
    raw: { tierId?: unknown; now?: unknown },
  ):
    | {
        ok: true;
        party: OwambePartyRow;
        paid: number;
        wallet: { cash: number; bank: number };
        snapshot: ReturnType<ServerOwambe['snapshot']>;
      }
    | { ok: false; reason: string } {
    const tierId = String(raw.tierId ?? '').trim() as OwambeTierId;
    const spec = SERVER_OWAMBE_SPECS[tierId];
    if (!spec) return { ok: false, reason: 'That Owambe package does not exist.' };

    const currentSnap = this.snapshot(userId);
    if (currentSnap.activeParty) {
      return {
        ok: false,
        reason: `You already have ${currentSnap.activeParty.title} booked at ${currentSnap.activeParty.venueName}. Head there to spray first.`,
      };
    }

    const now = typeof raw.now === 'number' && Number.isFinite(raw.now) ? Math.trunc(raw.now) : Date.now();
    let paidRes = this.economy.holdFee(
      userId,
      spec.bookingFee,
      `Owambe booking: ${spec.title} at ${spec.venueName}`,
      `owambe_book:${userId}:${tierId}:${now}`,
    );
    if (!paidRes.ok) {
      paidRes = this.economy.debitCash(
        userId,
        spec.bookingFee,
        `Owambe booking: ${spec.title} at ${spec.venueName}`,
        `owambe_book_cash:${userId}:${tierId}:${now}`,
      );
    }
    if (!paidRes.ok) {
      return {
        ok: false,
        reason: `You need ₦${spec.bookingFee.toLocaleString()} to book ${spec.title} at ${spec.venueName}.`,
      };
    }

    const asoEbiId = currentSnap.equippedAsoEbi;
    const info = this.db
      .prepare(
        "INSERT INTO owambe_parties (user_id, tier_id, venue_key, venue_name, booking_fee, spray_bundle, aso_ebi_id, stars, fame_earned, status, booked_at) VALUES (?, ?, ?, ?, ?, ?, ?, 3, 0, 'booked', ?)",
      )
      .run(userId, tierId, spec.venueKey, spec.venueName, spec.bookingFee, spec.sprayBundle, asoEbiId, now);

    const updated = this.snapshot(userId);
    const party = updated.activeParty ?? {
      id: Number(info.lastInsertRowid),
      tierId,
      title: spec.title,
      occasion: spec.occasion,
      venueKey: spec.venueKey,
      venueName: spec.venueName,
      mcName: spec.mcName,
      bandName: spec.bandName,
      bookingFee: spec.bookingFee,
      sprayBundle: spec.sprayBundle,
      asoEbiId,
      stars: 3,
      fameEarned: 0,
      status: 'booked' as const,
      bookedAt: now,
      completedAt: null,
    };

    return {
      ok: true,
      party,
      paid: spec.bookingFee,
      wallet: paidRes.wallet!,
      snapshot: updated,
    };
  }

  public spray(
    userId: string,
    raw: { venueKey?: unknown; stars?: unknown; now?: unknown },
  ):
    | {
        ok: true;
        party: OwambePartyRow;
        paid: number;
        fameEarned: number;
        wallet: { cash: number; bank: number };
        snapshot: ReturnType<ServerOwambe['snapshot']>;
      }
    | { ok: false; reason: string } {
    const snap = this.snapshot(userId);
    const active = snap.activeParty;
    if (!active) {
      return { ok: false, reason: 'You do not have an active Owambe party booked.' };
    }
    if (raw.venueKey && String(raw.venueKey) !== active.venueKey) {
      return { ok: false, reason: `Your Owambe party is at ${active.venueName}, not here.` };
    }

    const rawStars = Number(raw.stars ?? 3);
    const stars: 1 | 2 | 3 = rawStars >= 3 ? 3 : rawStars >= 2 ? 2 : 1;
    const now = typeof raw.now === 'number' && Number.isFinite(raw.now) ? Math.trunc(raw.now) : Date.now();

    let paidRes = this.economy.holdFee(
      userId,
      active.sprayBundle,
      `Owambe Naira spray at ${active.venueName}`,
      `owambe_spray:${userId}:${active.id}`,
    );
    if (!paidRes.ok) {
      paidRes = this.economy.debitCash(
        userId,
        active.sprayBundle,
        `Owambe Naira spray at ${active.venueName}`,
        `owambe_spray_cash:${userId}:${active.id}`,
      );
    }
    if (!paidRes.ok) {
      return {
        ok: false,
        reason: `You need ₦${active.sprayBundle.toLocaleString()} for mint Naira notes to spray at ${active.venueName}.`,
      };
    }

    const spec = SERVER_OWAMBE_SPECS[active.tierId];
    const asoBonus = active.asoEbiId && SERVER_ASO_EBI[active.asoEbiId] ? SERVER_ASO_EBI[active.asoEbiId].fameBonus : 0;
    const starBonus = stars === 3 ? 10 : stars === 2 ? 5 : 0;
    const fameEarned = spec.baseFame + asoBonus + starBonus;

    this.db
      .prepare(
        "UPDATE owambe_parties SET status = 'completed', stars = ?, fame_earned = ?, completed_at = ? WHERE id = ? AND user_id = ?",
      )
      .run(stars, fameEarned, now, active.id, userId);

    const updatedSnap = this.snapshot(userId);
    const completed = updatedSnap.history.find((h) => h.id === active.id) ?? {
      ...active,
      stars,
      fameEarned,
      status: 'completed' as const,
      completedAt: now,
    };

    return {
      ok: true,
      party: completed,
      paid: active.sprayBundle,
      fameEarned,
      wallet: paidRes.wallet!,
      snapshot: updatedSnap,
    };
  }
}

