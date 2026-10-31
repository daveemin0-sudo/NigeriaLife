// Server-authoritative Chieftaincy & High Society Titles system:
// verifies Fame requirements, charges investiture offerings, grants royal titles,
// and manages daily royal tributes.
import type { DatabaseSync } from 'node:sqlite';
import type { ServerEconomy } from './economy';

export type TitleId = 'otunba' | 'aare' | 'omoba' | 'gbobaniyi';

export interface ServerTitleSpec {
  id: TitleId;
  name: string;
  prefix: string;
  regaliaName: string;
  regaliaIcon: string;
  fameRequired: number;
  offeringPrice: number;
  dailyTribute: number;
  description: string;
}

export const SERVER_TITLES: Record<TitleId, ServerTitleSpec> = {
  otunba: {
    id: 'otunba',
    name: 'Otunba of Lagos',
    prefix: 'Otunba',
    regaliaName: 'Royal Coral Beads',
    regaliaIcon: '📿',
    fameRequired: 25,
    offeringPrice: 250_000,
    dailyTribute: 15_000,
    description: 'Ancient honorary chieftaincy conferring royal coral beads and permanent VIP recognition across Lagos society.',
  },
  aare: {
    id: 'aare',
    name: 'Aare of Eko',
    prefix: 'Aare',
    regaliaName: 'Horse-tail Flywhisk (Irukere)',
    regaliaIcon: '🪶',
    fameRequired: 50,
    offeringPrice: 500_000,
    dailyTribute: 30_000,
    description: 'Prestigious warrior-protector title granted to distinguished community champions, marked by the sacred Irukere.',
  },
  omoba: {
    id: 'omoba',
    name: 'Omoba of the Realm',
    prefix: 'Omoba',
    regaliaName: 'Beaded Royal Cap',
    regaliaIcon: '👑',
    fameRequired: 100,
    offeringPrice: 1_200_000,
    dailyTribute: 75_000,
    description: 'High royal princely title conferred for exceptional philanthropy and prominence in Lagos high finance.',
  },
  gbobaniyi: {
    id: 'gbobaniyi',
    name: 'Gbobaniyi of Yorubaland',
    prefix: 'Chief',
    regaliaName: 'Gold-tipped Royal Staff',
    regaliaIcon: '🦯',
    fameRequired: 200,
    offeringPrice: 2_500_000,
    dailyTribute: 150_000,
    description: 'Supreme patron chieftaincy title recognized across the Southwest, bearing the ceremonial gold-tipped staff.',
  },
};

export interface ConferredTitleRow {
  userId: string;
  titleId: TitleId;
  titleName: string;
  prefix: string;
  conferredAt: number;
  offeringPaid: number;
}

export class ServerChieftaincy {
  private readonly db: DatabaseSync;
  private readonly economy: ServerEconomy;

  public constructor(db: DatabaseSync, economy: ServerEconomy) {
    this.db = db;
    this.economy = economy;
    this.init();
  }

  private init(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS player_titles (
        user_id TEXT NOT NULL,
        title_id TEXT NOT NULL,
        conferred_at INTEGER NOT NULL,
        offering_paid INTEGER NOT NULL,
        PRIMARY KEY (user_id, title_id)
      );
      CREATE TABLE IF NOT EXISTS player_active_title (
        user_id TEXT PRIMARY KEY,
        active_title_id TEXT NOT NULL
      );
    `);
  }

  public snapshot(userId: string): {
    ok: true;
    titles: ConferredTitleRow[];
    activeTitle: TitleId | null;
  } {
    const rows = this.db
      .prepare('SELECT user_id, title_id, conferred_at, offering_paid FROM player_titles WHERE user_id = ? ORDER BY conferred_at ASC')
      .all(userId) as Array<{
      user_id: string;
      title_id: TitleId;
      conferred_at: number;
      offering_paid: number;
    }>;

    const titles: ConferredTitleRow[] = rows
      .filter((r) => r.title_id in SERVER_TITLES)
      .map((r) => ({
        userId: r.user_id,
        titleId: r.title_id,
        titleName: SERVER_TITLES[r.title_id].name,
        prefix: SERVER_TITLES[r.title_id].prefix,
        conferredAt: r.conferred_at,
        offeringPaid: r.offering_paid,
      }));

    const activeRow = this.db
      .prepare('SELECT active_title_id FROM player_active_title WHERE user_id = ?')
      .get(userId) as { active_title_id: TitleId } | undefined;

    const activeTitle = activeRow && activeRow.active_title_id in SERVER_TITLES ? activeRow.active_title_id : (titles[titles.length - 1]?.titleId ?? null);

    return { ok: true, titles, activeTitle };
  }

  public confer(
    userId: string,
    raw: { titleId?: unknown; fame?: unknown; now?: unknown },
  ):
    | {
        ok: true;
        title: ServerTitleSpec;
        paid: number;
        wallet: { cash: number; bank: number };
        snapshot: ReturnType<ServerChieftaincy['snapshot']>;
      }
    | { ok: false; reason: string } {
    const titleId = String(raw.titleId ?? '').trim() as TitleId;
    const spec = SERVER_TITLES[titleId];
    if (!spec) return { ok: false, reason: 'Invalid chieftaincy title selection.' };

    const alreadyConferred = this.db
      .prepare('SELECT 1 FROM player_titles WHERE user_id = ? AND title_id = ?')
      .get(userId, titleId);
    if (alreadyConferred) return { ok: false, reason: `You have already been conferred the title of ${spec.name}.` };

    const fame = typeof raw.fame === 'number' && Number.isFinite(raw.fame) ? Math.trunc(raw.fame) : 0;
    if (fame < spec.fameRequired) {
      return {
        ok: false,
        reason: `${spec.name} requires ${spec.fameRequired} Society Fame (you currently have ${fame}).`,
      };
    }

    const now = typeof raw.now === 'number' && Number.isFinite(raw.now) ? Math.trunc(raw.now) : Date.now();
    let paid = this.economy.holdFee(userId, spec.offeringPrice, `Chieftaincy Investiture: ${spec.name}`, `title:${userId}:${titleId}`);
    if (!paid.ok) {
      paid = this.economy.debitCash(userId, spec.offeringPrice, `Chieftaincy Investiture: ${spec.name}`, `title_cash:${userId}:${titleId}`);
    }
    if (!paid.ok) {
      return { ok: false, reason: `You need ₦${spec.offeringPrice.toLocaleString()} for the palace investiture offering.` };
    }

    this.db.prepare('INSERT INTO player_titles (user_id, title_id, conferred_at, offering_paid) VALUES (?, ?, ?, ?)').run(userId, titleId, now, spec.offeringPrice);
    this.db.prepare('INSERT OR REPLACE INTO player_active_title (user_id, active_title_id) VALUES (?, ?)').run(userId, titleId);

    return {
      ok: true,
      title: spec,
      paid: spec.offeringPrice,
      wallet: paid.wallet!,
      snapshot: this.snapshot(userId),
    };
  }

  public setActiveTitle(
    userId: string,
    raw: { titleId?: unknown },
  ): { ok: boolean; reason?: string; activeTitle?: TitleId | null } {
    const titleId = String(raw.titleId ?? '').trim() as TitleId;
    if (!titleId) {
      this.db.prepare('DELETE FROM player_active_title WHERE user_id = ?').run(userId);
      return { ok: true, activeTitle: null };
    }
    if (!(titleId in SERVER_TITLES)) return { ok: false, reason: 'Invalid title.' };

    const owned = this.db
      .prepare('SELECT 1 FROM player_titles WHERE user_id = ? AND title_id = ?')
      .get(userId, titleId);
    if (!owned) return { ok: false, reason: 'You have not been conferred that title.' };

    this.db.prepare('INSERT OR REPLACE INTO player_active_title (user_id, active_title_id) VALUES (?, ?)').run(userId, titleId);
    return { ok: true, activeTitle: titleId };
  }
}

