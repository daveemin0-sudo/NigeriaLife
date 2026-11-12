/**
 * One saved life per account: homes, furniture, the bag, jets, businesses, certificates and
 * the rest. Money is written over from the wallet, and a jet, a business or a house that was
 * not in the previous save is kept only when the ledger shows it was paid for.
 * The last few versions are kept so a bad save can be put back.
 */
import type { Store } from './store.ts';
import { transaction } from './store.ts';

const MAX_DOC = 1_500_000;
const KEEP_HISTORY = 5;

/** What a private jet or yacht costs. The save does not get to name the price. */
const FLEET: Record<string, { name: string; price: number }> = {
  hondajet: { name: 'HondaJet Elite', price: 11_500_000_000 },
  phenom: { name: 'Embraer Phenom 300E', price: 17_000_000_000 },
  challenger: { name: 'Bombardier Challenger 350', price: 43_000_000_000 },
  g650: { name: 'Gulfstream G650ER', price: 112_000_000_000 },
  global7500: { name: 'Bombardier Global 7500', price: 120_000_000_000 },
  speedboat: { name: 'Lagos Speedboat 35', price: 480_000_000 },
  sunseeker: { name: 'Sunseeker Manhattan 55', price: 4_000_000_000 },
  azimut: { name: 'Azimut Grande 27', price: 13_000_000_000 },
  superyacht: { name: 'Benetti Oasis 40m Superyacht', price: 64_000_000_000 },
};

/** Session, the registry and the old device-only backup never ride along in the save. */
const DENY = [
  'nigeria_life_session',
  'nigeria_life_account_id',
  'nigeria_life_cloud_',
  'nigeria_cloud_code_',
  'nigeria_life_world_registry',
  'nigeria_life_world_server',
  'nl_account_save_',
  'nigeria_life_network_player_id',
  'nigeria_life_account_data_v1__backup',
];

export interface SaveDoc {
  v: 1;
  at: number;
  bags: Record<string, string>;
}

interface Debit {
  amount: number;
  memo: string;
  used: boolean;
}

interface Row {
  version: number;
  saved_at: number;
  doc: string;
  /** The device that wrote this version (null for versions written before devices were named) */
  device?: string | null;
}

/** A device's name for itself: random, kept in its browser, never part of the save */
function deviceOf(value: unknown): string | null {
  return typeof value === 'string' && /^[A-Za-z0-9_-]{8,64}$/.test(value) ? value : null;
}

function denied(key: string): boolean {
  return DENY.some((prefix) => key === prefix || key.startsWith(prefix));
}

function baseOf(key: string): string {
  return key.replace(/__player_[a-z0-9_-]+$/i, '');
}

/** The account, or the fleet, including a second local player and a home suffix (`:id`). */
function keyIs(key: string, base: string): boolean {
  const bare = baseOf(key);
  return bare === base || bare.startsWith(`${base}:`);
}

export class Saves {
  private db: Store;
  private walletOf: (accountId: string) => { cash: number; bank: number };

  constructor(db: Store, walletOf: (accountId: string) => { cash: number; bank: number }) {
    this.db = db;
    this.walletOf = walletOf;
    db.exec(`
      CREATE TABLE IF NOT EXISTS player_saves (
        account_id TEXT PRIMARY KEY,
        version INTEGER NOT NULL,
        saved_at INTEGER NOT NULL,
        doc TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS player_save_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        account_id TEXT NOT NULL,
        version INTEGER NOT NULL,
        saved_at INTEGER NOT NULL,
        doc TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS player_save_history_account ON player_save_history(account_id, version);
    `);
    // Which device wrote the stored version. Added to a table that may already hold saves: rows
    // written before have none (null), which the old server ignores, so it can still be put back
    const columns = (db.prepare('PRAGMA table_info(player_saves)').all() as Array<{ name: string }>).map((c) => c.name);
    if (!columns.includes('device')) db.exec('ALTER TABLE player_saves ADD COLUMN device TEXT');
  }

  public read(accountId: string): { ok: true; version: number; savedAt: number; doc: SaveDoc | null } {
    const row = this.db.prepare('SELECT version, saved_at, doc FROM player_saves WHERE account_id = ?').get(accountId) as Row | undefined;
    if (!row) return { ok: true, version: 0, savedAt: 0, doc: null };
    const doc = this.parse(row.doc);
    if (!doc) return { ok: true, version: 0, savedAt: 0, doc: null };
    this.overlayMoney(accountId, doc);
    return { ok: true, version: row.version, savedAt: row.saved_at, doc };
  }

  /**
   * Keeps a save, unless it would overwrite newer progress: a save is taken only when it was built
   * on the version stored now (its `base`), or when it comes from the device that wrote that
   * version (a reply that never arrived must not throw away a minute of play). A device left open
   * while the player went on elsewhere is sent the newer copy instead (`kept: 'server'`), whatever
   * its clock says. A save that names no base (an old client, a tool) keeps the old rule: refused
   * only when its own time is older than the stored one.
   * Cash and bank are the wallet's. A new jet, business or house with no matching payment is removed.
   */
  public write(accountId: string, raw: unknown): { ok: true; version: number; savedAt: number; doc: SaveDoc; stripped: boolean; kept: 'client' | 'server' } | { ok: false; reason: string } {
    const body = raw && typeof raw === 'object' ? (raw as { doc?: unknown; base?: unknown; device?: unknown; take?: unknown }) : {};
    const incoming = this.clean(body.doc);
    if (!incoming) return { ok: false, reason: 'That save could not be read.' };
    const row = this.db.prepare('SELECT version, saved_at, doc, device FROM player_saves WHERE account_id = ?').get(accountId) as Row | undefined;
    const current = row ? this.parse(row.doc) : null;
    const device = deviceOf(body.device);
    const named = body.base !== undefined && body.base !== null && body.base !== '' && Number.isFinite(Number(body.base));
    const base = Number(body.base);
    // "Play here instead" on a device that had stepped aside: the player chose this device, which has
    // just loaded the latest copy (whatever the other device saved since is the price of that choice)
    const taking = body.take === true && device !== null;
    const behind = taking ? false : named ? base !== row?.version && !(device !== null && row?.device === device) : !!current && incoming.at + 2000 < current.at;
    if (current && row && behind) {
      this.overlayMoney(accountId, current);
      return { ok: true, version: row.version, savedAt: row.saved_at, doc: current, stripped: false, kept: 'server' };
    }
    const stripped = this.prove(accountId, incoming, current);
    this.overlayMoney(accountId, incoming);
    const text = JSON.stringify(incoming);
    if (text.length > MAX_DOC) return { ok: false, reason: 'That save is too large.' };
    const now = Date.now();
    const version = (row?.version ?? 0) + 1;
    transaction(this.db, () => {
      if (row) {
        this.db.prepare('INSERT INTO player_save_history (account_id, version, saved_at, doc) VALUES (?, ?, ?, ?)').run(accountId, row.version, row.saved_at, row.doc);
        const old = this.db.prepare('SELECT id FROM player_save_history WHERE account_id = ? ORDER BY version DESC').all(accountId) as Array<{ id: number }>;
        for (const extra of old.slice(KEEP_HISTORY)) this.db.prepare('DELETE FROM player_save_history WHERE id = ?').run(extra.id);
      }
      this.db
        .prepare(
          `INSERT INTO player_saves (account_id, version, saved_at, doc, device) VALUES (?, ?, ?, ?, ?)
           ON CONFLICT(account_id) DO UPDATE SET version = excluded.version, saved_at = excluded.saved_at, doc = excluded.doc, device = excluded.device`,
        )
        .run(accountId, version, now, text, device);
    });
    return { ok: true, version, savedAt: now, doc: incoming, stripped, kept: 'client' };
  }

  /**
   * Puts back the previous version. The one replaced is kept in the history. What is put back gets a
   * new, higher number and no device, so every device (even one still holding the number of the copy
   * put back) is behind it and is sent it on its next save.
   */
  public rollback(accountId: string): { ok: true; version: number } | { ok: false; reason: string } {
    const prev = this.db
      .prepare('SELECT id, version, saved_at, doc FROM player_save_history WHERE account_id = ? ORDER BY version DESC LIMIT 1')
      .get(accountId) as { id: number; version: number; saved_at: number; doc: string } | undefined;
    if (!prev) return { ok: false, reason: 'Nothing earlier to restore.' };
    const current = this.db.prepare('SELECT version, saved_at, doc FROM player_saves WHERE account_id = ?').get(accountId) as Row | undefined;
    const restored = Math.max(current?.version ?? 0, prev.version) + 1;
    transaction(this.db, () => {
      if (current) {
        this.db.prepare('INSERT INTO player_save_history (account_id, version, saved_at, doc) VALUES (?, ?, ?, ?)').run(accountId, current.version, current.saved_at, current.doc);
      }
      this.db
        .prepare(
          `INSERT INTO player_saves (account_id, version, saved_at, doc, device) VALUES (?, ?, ?, ?, NULL)
           ON CONFLICT(account_id) DO UPDATE SET version = excluded.version, saved_at = excluded.saved_at, doc = excluded.doc, device = NULL`,
        )
        .run(accountId, restored, prev.saved_at, prev.doc);
      this.db.prepare('DELETE FROM player_save_history WHERE id = ?').run(prev.id);
    });
    return { ok: true, version: restored };
  }

  public deleteAll(accountId: string): void {
    this.db.prepare('DELETE FROM player_saves WHERE account_id = ?').run(accountId);
    this.db.prepare('DELETE FROM player_save_history WHERE account_id = ?').run(accountId);
  }

  private parse(text: string): SaveDoc | null {
    try {
      const raw = JSON.parse(text) as SaveDoc;
      if (!raw || raw.v !== 1 || !raw.bags || typeof raw.bags !== 'object') return null;
      return { v: 1, at: Number(raw.at) || 0, bags: raw.bags };
    } catch {
      return null;
    }
  }

  private clean(raw: unknown): SaveDoc | null {
    if (!raw || typeof raw !== 'object') return null;
    const doc = raw as { v?: unknown; at?: unknown; bags?: unknown };
    if (doc.v !== 1 || !doc.bags || typeof doc.bags !== 'object') return null;
    const bags: Record<string, string> = {};
    const accepted: Array<[string, string]> = [];
    for (const [key, value] of Object.entries(doc.bags as Record<string, unknown>)) {
      if (typeof value !== 'string' || key.length > 180 || denied(key) || value.length > 400_000) continue;
      accepted.push([key, value]);
    }
    // The life itself is never the key that gets dropped when a device has a lot of small settings
    const pin = /account_data_v1$|fleet_v1$|nl-qualifications|placed_furniture|furniture_storage|nl_fridge|employment|character_v2|home_look|home_now|home_power|companies_v1|nl_police|nl-bus-line|nl-worn|story_quests|home_doors|home_handed/;
    accepted.sort((a, b) => Number(pin.test(baseOf(b[0]))) - Number(pin.test(baseOf(a[0]))));
    let size = 0;
    for (const [key, value] of accepted.slice(0, 120)) {
      size += key.length + value.length;
      if (size > MAX_DOC && Object.keys(bags).length > 0) break;
      bags[key] = value;
    }
    const at = Number(doc.at);
    return { v: 1, at: Number.isFinite(at) ? at : Date.now(), bags };
  }

  /** Cash and bank in the saved game become whatever the wallet says. */
  private overlayMoney(accountId: string, doc: SaveDoc): void {
    const wallet = this.walletOf(accountId);
    for (const [key, value] of Object.entries(doc.bags)) {
      if (!keyIs(key, 'nigeria_life_account_data_v1')) continue;
      try {
        const account = JSON.parse(value) as Record<string, unknown>;
        account.walletCash = wallet.cash;
        const bank = account.bank;
        if (bank && typeof bank === 'object') (bank as { balance: number }).balance = wallet.bank;
        else account.bank = { balance: wallet.bank };
        doc.bags[key] = JSON.stringify(account);
      } catch {
        // Not the account document
      }
    }
  }

  /** Drops a new jet, business or house the ledger cannot pay for. True when something was dropped. */
  private prove(accountId: string, doc: SaveDoc, previous: SaveDoc | null): boolean {
    const debits = this.debits(accountId);
    let stripped = false;
    // A thin save that forgets the account or the fleet does not wipe what was already accepted
    if (previous) {
      for (const [key, value] of Object.entries(previous.bags)) {
        if (!keyIs(key, 'nigeria_life_account_data_v1') && !keyIs(key, 'nigeria_life_fleet_v1')) continue;
        if (Object.prototype.hasOwnProperty.call(doc.bags, key)) continue;
        doc.bags[key] = value;
        stripped = true;
      }
    }
    for (const [key, value] of Object.entries(doc.bags)) {
      if (keyIs(key, 'nigeria_life_fleet_v1')) {
        const next = this.proveFleet(accountId, key, value, previous, debits);
        if (next !== value) {
          doc.bags[key] = next;
          stripped = true;
        }
      } else if (keyIs(key, 'nigeria_life_account_data_v1')) {
        const next = this.proveAccount(accountId, value, this.accountBag(previous), debits);
        if (next !== value) {
          doc.bags[key] = next;
          stripped = true;
        }
      }
    }
    return stripped;
  }

  private debits(accountId: string): Debit[] {
    const rows = this.db
      .prepare('SELECT cash_delta, bank_delta, memo FROM ledger WHERE account_id = ? AND cash_delta + bank_delta < 0 ORDER BY id ASC LIMIT 5000')
      .all(accountId) as Array<{ cash_delta: number; bank_delta: number; memo: string }>;
    return rows.map((row) => ({ amount: -(Number(row.cash_delta) + Number(row.bank_delta)), memo: String(row.memo ?? ''), used: false }));
  }

  /** A payment not already used to explain something else, whose note names it and whose amount covers it. */
  private cover(debits: Debit[], price: number, needle: string): boolean {
    const want = needle.toLowerCase();
    const hit = debits.find((debit) => !debit.used && debit.amount + 1 >= price * 0.9 && debit.memo.toLowerCase().includes(want));
    if (!hit) return false;
    hit.used = true;
    return true;
  }

  private fleetIds(previous: SaveDoc | null, key: string): Set<string> {
    const ids = new Set<string>();
    if (!previous) return ids;
    try {
      const list = JSON.parse(previous.bags[key] || '[]') as Array<{ uid?: string; modelId?: string }>;
      if (Array.isArray(list)) for (const craft of list) if (craft) ids.add(String(craft.uid ?? craft.modelId ?? ''));
    } catch {
      // No fleet last time
    }
    return ids;
  }

  private proveFleet(accountId: string, key: string, value: string, previous: SaveDoc | null, debits: Debit[]): string {
    let list: Array<{ uid?: string; modelId?: string; name?: string; colour?: string }>;
    try {
      const parsed = JSON.parse(value);
      if (!Array.isArray(parsed)) return '[]';
      list = parsed;
    } catch {
      return '[]';
    }
    const before = this.fleetIds(previous, key);
    const kept = list.filter((craft) => {
      const model = FLEET[String(craft?.modelId ?? '')];
      if (!model || !craft) return false;
      const id = String(craft.uid ?? craft.modelId);
      if (before.has(id)) return true;
      return this.cover(debits, model.price, model.name);
    });
    // A jet already accepted is not dropped by a later, thinner save unless it was sold
    const seen = new Set(kept.map((craft) => String(craft.uid ?? craft.modelId)));
    for (const craft of this.fleetCrafts(previous, key)) {
      const model = FLEET[String(craft?.modelId ?? '')];
      const id = String(craft?.uid ?? craft?.modelId ?? '');
      if (!model || !id || seen.has(id)) continue;
      if (this.sold(accountId, model.name)) continue;
      kept.push(craft);
      seen.add(id);
    }
    const unchanged = kept.length === list.length && kept.every((craft, index) => craft === list[index]);
    return unchanged ? value : JSON.stringify(kept);
  }

  private fleetCrafts(previous: SaveDoc | null, key: string): Array<{ uid?: string; modelId?: string; name?: string; colour?: string }> {
    if (!previous) return [];
    try {
      const list = JSON.parse(previous.bags[key] || '[]');
      return Array.isArray(list) ? list : [];
    } catch {
      return [];
    }
  }

  /** Money came back for selling it, so the new save may leave it out */
  private sold(accountId: string, name: string): boolean {
    const needle = name.replace(/[%_]/g, '').slice(0, 40);
    if (needle.length < 3) return false;
    const row = this.db
      .prepare(`SELECT 1 FROM ledger WHERE account_id = ? AND cash_delta + bank_delta > 0 AND memo LIKE ? LIMIT 1`)
      .get(accountId, `%${needle}%`) as { 1: number } | undefined;
    return !!row;
  }

  private accountBag(previous: SaveDoc | null): Record<string, unknown> | null {
    if (!previous) return null;
    for (const [key, value] of Object.entries(previous.bags)) {
      if (!keyIs(key, 'nigeria_life_account_data_v1')) continue;
      try {
        return JSON.parse(value) as Record<string, unknown>;
      } catch {
        return null;
      }
    }
    return null;
  }

  private proveAccount(accountId: string, value: string, previous: Record<string, unknown> | null, debits: Debit[]): string {
    let account: Record<string, unknown>;
    try {
      account = JSON.parse(value) as Record<string, unknown>;
    } catch {
      return value;
    }
    let changed = false;
    const prevBusinesses = Array.isArray(previous?.businesses) ? (previous.businesses as Array<Record<string, unknown>>) : [];
    const ownedBefore = new Set(prevBusinesses.filter((biz) => biz && biz.owned).map((biz) => String(biz.id)));
    if (Array.isArray(account.businesses)) {
      const next: unknown[] = [];
      for (const biz of account.businesses as Array<Record<string, unknown>>) {
        if (!biz || !biz.owned) {
          next.push(biz);
          continue;
        }
        const id = String(biz.id ?? '');
        if (ownedBefore.has(id)) {
          next.push(biz);
          continue;
        }
        const price = Number(biz.purchasePrice) || 0;
        const name = String(biz.name ?? '');
        if (name.length >= 3 && this.cover(debits, Math.max(price, 100_000), name)) {
          next.push(biz);
          continue;
        }
        changed = true;
        if (id.startsWith('reg_')) continue;
        next.push({ ...biz, owned: false });
      }
      // One already accepted stays, even when this save forgot to send it, until it is sold
      const ownedNow = new Set(next.filter((biz) => biz && (biz as { owned?: boolean }).owned).map((biz) => String((biz as { id?: string }).id ?? '')));
      for (const biz of prevBusinesses) {
        if (!biz || !biz.owned) continue;
        const id = String(biz.id ?? '');
        if (!id || ownedNow.has(id)) continue;
        if (this.sold(accountId, String(biz.name ?? ''))) continue;
        next.push(biz);
        ownedNow.add(id);
        changed = true;
      }
      account.businesses = next;
    }
    const prevProperties = Array.isArray(previous?.properties) ? (previous.properties as Array<Record<string, unknown>>) : [];
    const heldBefore = new Set(
      prevProperties
        .filter((prop) => prop && (prop.status === 'owned' || prop.status === 'purchased' || prop.status === 'rented'))
        .map((prop) => `${prop.id}:${prop.status}`),
    );
    if (Array.isArray(account.properties)) {
      for (const prop of account.properties as Array<Record<string, unknown>>) {
        if (!prop) continue;
        const status = String(prop.status ?? '');
        if (status !== 'owned' && status !== 'purchased' && status !== 'rented') continue;
        if (heldBefore.has(`${prop.id}:${status}`)) continue;
        const bought = status !== 'rented';
        const price = Number(bought ? prop.purchasePrice : prop.rentalPriceMonthly) || 0;
        const need = bought ? Math.max(price, 100_000) : Math.max(price, 500);
        const name = String(prop.name ?? '');
        if (name.length >= 3 && this.cover(debits, need, name)) continue;
        prop.status = 'available';
        changed = true;
      }
      for (const prev of prevProperties) {
        if (!prev) continue;
        const status = String(prev.status ?? '');
        if (status !== 'owned' && status !== 'purchased' && status !== 'rented') continue;
        const id = String(prev.id ?? '');
        const incoming = (account.properties as Array<Record<string, unknown>>).find((prop) => prop && String(prop.id) === id);
        const now = String(incoming?.status ?? '');
        if (now === 'owned' || now === 'purchased' || now === 'rented') continue;
        if (this.sold(accountId, String(prev.name ?? ''))) continue;
        if (incoming) {
          incoming.status = status;
          if (typeof prev.ownerId === 'string') incoming.ownerId = prev.ownerId;
        } else {
          (account.properties as unknown[]).push(prev);
        }
        changed = true;
      }
    }
    return changed ? JSON.stringify(account) : value;
  }
}
