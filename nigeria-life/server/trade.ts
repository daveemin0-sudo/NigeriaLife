import type { DatabaseSync } from 'node:sqlite';
import type { Economy, Position } from './economy.ts';
import { CARRY_KG, GOODS, TRAVEL_MS, buyPrice, cargoKg, goodById, sellPrice, shedAt, tradeDay, type CargoLine, type TradeCity } from '../src/travel/Trade.ts';

/**
 * Trade between cities, on the server (src/travel/Trade.ts has the goods and the prices): it
 * holds each player's cargo, sees them at a motor park's goods shed when they buy or sell, prices
 * by its own calendar, and pays for goods sold in another city only once they have had time to
 * travel there. The game sends what and how many, never a price.
 */
export class ServerTrade {
  private readonly db: DatabaseSync;
  private readonly economy: Economy;
  private readonly positionOf: (id: string) => Position | null;

  constructor(db: DatabaseSync, economy: Economy, positionOf: (id: string) => Position | null) {
    this.db = db;
    this.economy = economy;
    this.positionOf = positionOf;
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS cargo (
        account_id TEXT    NOT NULL,
        good       TEXT    NOT NULL,
        qty        INTEGER NOT NULL,
        paid       INTEGER NOT NULL,
        city       TEXT    NOT NULL,
        at         INTEGER NOT NULL,
        PRIMARY KEY (account_id, good)
      );
    `);
  }

  private cargo(id: string): CargoLine[] {
    return (this.db.prepare('SELECT good, qty, paid, city, at FROM cargo WHERE account_id = ? AND qty > 0').all(id) as Array<{ good: string; qty: number; paid: number; city: string; at: number }>).map((r) => ({ good: r.good, qty: r.qty, paid: r.paid, city: r.city as TradeCity, at: r.at }));
  }

  /** The shed the server sees the player at, or why not */
  private shed(id: string): { city: TradeCity } | { reason: string } {
    const at = this.positionOf(id);
    if (!at || Date.now() - at.at > 6_000 || at.place) return { reason: 'The server cannot see you at a goods shed. Check your connection.' };
    const city = shedAt(at.city, at.x, at.z);
    return city ? { city } : { reason: 'Trade is done at a motor park goods shed.' };
  }

  /** What the player carries, and today's prices at every shed */
  public state(id: string) {
    const day = tradeDay(Date.now());
    const prices = GOODS.map((g) => ({ good: g.id, buy: { lagos: buyPrice(g, 'lagos', day), abuja: buyPrice(g, 'abuja', day), port_harcourt: buyPrice(g, 'port_harcourt', day) }, sell: { lagos: sellPrice(g, 'lagos', day), abuja: sellPrice(g, 'abuja', day), port_harcourt: sellPrice(g, 'port_harcourt', day) } }));
    return { ok: true as const, day, cargo: this.cargo(id), prices, now: Date.now() };
  }

  public buy(id: string, raw: { good?: unknown; qty?: unknown; idem?: unknown }) {
    const good = goodById(String(raw.good ?? ''));
    const qty = Math.trunc(Number(raw.qty));
    const idem = typeof raw.idem === 'string' && /^[\w:-]{8,80}$/.test(raw.idem) ? raw.idem : null;
    if (!good || !Number.isInteger(qty) || qty < 1 || qty > 50 || !idem) return { ok: false as const, reason: 'That could not be read.', wallet: this.economy.wallet(id) };
    const where = this.shed(id);
    if ('reason' in where) return { ok: false as const, reason: where.reason, wallet: this.economy.wallet(id) };
    const city = where.city;
    const carrying = this.cargo(id);
    if (cargoKg(carrying) + good.kg * qty > CARRY_KG) return { ok: false as const, reason: `That is more than you can carry: ${CARRY_KG} kg at most.`, wallet: this.economy.wallet(id) };
    const each = buyPrice(good, city, tradeDay(Date.now()));
    const paid = this.economy.charge(id, each * qty, 'trade-buy', `${qty} × ${good.name} at ${city}`, idem);
    if (!paid.ok) return { ok: false as const, reason: `${qty} × ${good.unit} of ${good.name.toLowerCase()} is ₦${(each * qty).toLocaleString()} and you do not have it.`, wallet: paid.wallet ?? this.economy.wallet(id) };
    if ('replay' in paid && paid.replay) return { ok: true as const, replay: true, wallet: paid.wallet, cargo: this.cargo(id) };
    this.db
      .prepare('INSERT INTO cargo (account_id, good, qty, paid, city, at) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(account_id, good) DO UPDATE SET qty = qty + excluded.qty, paid = paid + excluded.paid, city = excluded.city, at = excluded.at')
      .run(id, good.id, qty, each * qty, city, Date.now());
    return { ok: true as const, each, total: each * qty, wallet: paid.wallet, cargo: this.cargo(id) };
  }

  public sell(id: string, raw: { good?: unknown; qty?: unknown; idem?: unknown }) {
    const good = goodById(String(raw.good ?? ''));
    const qty = Math.trunc(Number(raw.qty));
    const idem = typeof raw.idem === 'string' && /^[\w:-]{8,80}$/.test(raw.idem) ? raw.idem : null;
    if (!good || !Number.isInteger(qty) || qty < 1 || !idem) return { ok: false as const, reason: 'That could not be read.', wallet: this.economy.wallet(id) };
    const where = this.shed(id);
    if ('reason' in where) return { ok: false as const, reason: where.reason, wallet: this.economy.wallet(id) };
    const city = where.city;
    const line = this.cargo(id).find((l) => l.good === good.id);
    if (!line || line.qty < qty) return { ok: false as const, reason: `You are not carrying ${qty} × ${good.unit} of ${good.name.toLowerCase()}.`, wallet: this.economy.wallet(id) };
    if (line.city !== city && Date.now() - line.at < TRAVEL_MS) return { ok: false as const, reason: 'Those goods could not have got here yet.', wallet: this.economy.wallet(id) };
    const each = sellPrice(good, city, tradeDay(Date.now()));
    const paid = this.economy.credit(id, each * qty, 'trade-sell', `Sold ${qty} × ${good.name} at ${city}`, idem);
    if (!paid.ok) return paid;
    if ('replay' in paid && paid.replay) return { ok: true as const, replay: true, wallet: paid.wallet, cargo: this.cargo(id) };
    const cost = Math.round((line.paid * qty) / line.qty);
    this.db.prepare('UPDATE cargo SET qty = qty - ?, paid = paid - ? WHERE account_id = ? AND good = ?').run(qty, cost, id, good.id);
    this.db.prepare('DELETE FROM cargo WHERE account_id = ? AND qty <= 0').run(id);
    return { ok: true as const, each, total: each * qty, profit: each * qty - cost, wallet: paid.wallet, cargo: this.cargo(id) };
  }
}
