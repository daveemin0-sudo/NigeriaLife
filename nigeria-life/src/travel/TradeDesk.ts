import { BackendService } from '../backend/BackendService';
import { profileKey } from '../backend/Profile';
import { OnlineAccount } from '../online/OnlineAccount';
import { CARRY_KG, GOODS, TRAVEL_MS, buyPrice, cargoKg, goodById, sellPrice, shedAt, type CargoLine, type Good, type TradeCity } from './Trade';

/**
 * The player's side of trade between cities (src/travel/Trade.ts has the goods and prices):
 * what they carry, and buying and selling at a motor park's goods shed. On a game server the
 * server holds the cargo and pays; without one it is kept here, by the same rules.
 */
export class TradeDesk {
  private static instance: TradeDesk | null = null;
  public static get(): TradeDesk {
    return (TradeDesk.instance ??= new TradeDesk());
  }

  /** Where the player stands in the street, or null indoors (set by the game) */
  public where: () => { city: string; x: number; z: number } | null = () => null;
  /** The day on the game's calendar (set by the game; online the server's day is used) */
  public today: () => number = () => 0;

  private lines: CargoLine[] = [];
  private serverDay: number | null = null;
  private readonly key = profileKey('nl_cargo_v1');

  private constructor() {
    try {
      const saved = JSON.parse(localStorage.getItem(this.key) || '[]');
      if (Array.isArray(saved)) this.lines = saved.filter((l: CargoLine) => l && goodById(l.good) && l.qty > 0);
    } catch {
      this.lines = [];
    }
  }

  private keep(): void {
    try {
      localStorage.setItem(this.key, JSON.stringify(this.lines));
    } catch {
      // Kept for this visit
    }
  }

  public day(): number {
    return this.serverDay ?? this.today();
  }

  /** The shed the player is standing at, or null */
  public shedHere(): TradeCity | null {
    const at = this.where();
    return at ? shedAt(at.city, at.x, at.z) : null;
  }

  public cargo(): readonly CargoLine[] {
    return this.lines;
  }

  public kg(): number {
    return cargoKg(this.lines);
  }

  public prices(city: TradeCity): Array<{ good: Good; buy: number; sell: number }> {
    const day = this.day();
    return GOODS.map((good) => ({ good, buy: buyPrice(good, city, day), sell: sellPrice(good, city, day) }));
  }

  /** Online: the cargo and the day as the server holds them */
  public async refresh(): Promise<void> {
    const online = OnlineAccount.get();
    if (!online) return;
    const state = await online.request('/trade').catch(() => null);
    if (!state?.ok) return;
    this.serverDay = state.day;
    const skew = Date.now() - state.now;
    this.lines = (state.cargo as CargoLine[]).map((l) => ({ ...l, at: l.at + skew }));
    this.keep();
  }

  public async buy(goodId: string, qty: number): Promise<{ ok: boolean; message: string }> {
    const good = goodById(goodId);
    const city = this.shedHere();
    if (!good) return { ok: false, message: 'That is not traded here.' };
    if (!city) return { ok: false, message: 'Trade is done at a motor park goods shed.' };
    if (this.kg() + good.kg * qty > CARRY_KG) return { ok: false, message: `That is more than you can carry: ${CARRY_KG} kg at most (you have ${this.kg()} kg).` };
    const online = OnlineAccount.get();
    if (online) {
      const done = await online.request('/trade/buy', { good: goodId, qty, idem: `tb:${online.id ?? 'x'}:${Date.now()}` }).catch(() => null);
      const backend = BackendService.getInstance();
      if (done?.wallet) backend.applyServerWallet(done.wallet);
      if (!done?.ok) return { ok: false, message: done?.reason ?? 'The trader did not take your money.' };
      this.lines = done.cargo;
      this.keep();
      backend.settledByServer(() => backend.processTransaction({ type: 'TRADE_PURCHASE', amount: done.total, description: `${qty} × ${good.name} (${good.unit}) at the goods shed`, source: 'bank', funding: 'split' }));
      if (done.wallet) backend.applyServerWallet(done.wallet);
      return { ok: true, message: `Loaded: ${qty} × ${good.unit} of ${good.name.toLowerCase()} for ₦${done.total.toLocaleString()}.` };
    }
    const each = buyPrice(good, city, this.day());
    const paid = BackendService.getInstance().processTransaction({ type: 'TRADE_PURCHASE', amount: each * qty, description: `${qty} × ${good.name} (${good.unit}) at the goods shed`, source: 'bank', funding: 'split' });
    if (!paid.success) return { ok: false, message: `${qty} × ${good.unit} is ₦${(each * qty).toLocaleString()} and you do not have it.` };
    const line = this.lines.find((l) => l.good === goodId);
    if (line) Object.assign(line, { qty: line.qty + qty, paid: line.paid + each * qty, city, at: Date.now() });
    else this.lines.push({ good: goodId, qty, paid: each * qty, city, at: Date.now() });
    this.keep();
    return { ok: true, message: `Loaded: ${qty} × ${good.unit} of ${good.name.toLowerCase()} for ₦${(each * qty).toLocaleString()}.` };
  }

  public async sell(goodId: string, qty: number): Promise<{ ok: boolean; message: string; profit?: number }> {
    const good = goodById(goodId);
    const city = this.shedHere();
    const line = this.lines.find((l) => l.good === goodId);
    if (!good || !line || line.qty < qty) return { ok: false, message: 'You are not carrying that many.' };
    if (!city) return { ok: false, message: 'Trade is done at a motor park goods shed.' };
    const online = OnlineAccount.get();
    if (online) {
      const done = await online.request('/trade/sell', { good: goodId, qty, idem: `ts:${online.id ?? 'x'}:${Date.now()}` }).catch(() => null);
      const backend = BackendService.getInstance();
      if (done?.wallet) backend.applyServerWallet(done.wallet);
      if (!done?.ok) return { ok: false, message: done?.reason ?? 'The trader would not buy.' };
      this.lines = done.cargo;
      this.keep();
      backend.settledByServer(() => backend.processTransaction({ type: 'TRADE_SALE', amount: done.total, description: `Sold ${qty} × ${good.name} at the goods shed`, source: 'wallet' }));
      if (done.wallet) backend.applyServerWallet(done.wallet);
      return { ok: true, message: this.soldWords(good, qty, done.total, done.profit), profit: done.profit };
    }
    if (line.city !== city && Date.now() - line.at < TRAVEL_MS) return { ok: false, message: 'Those goods could not have got here yet.' };
    const total = sellPrice(good, city, this.day()) * qty;
    const cost = Math.round((line.paid * qty) / line.qty);
    BackendService.getInstance().processTransaction({ type: 'TRADE_SALE', amount: total, description: `Sold ${qty} × ${good.name} at the goods shed`, source: 'wallet' });
    line.qty -= qty;
    line.paid -= cost;
    this.lines = this.lines.filter((l) => l.qty > 0);
    this.keep();
    return { ok: true, message: this.soldWords(good, qty, total, total - cost), profit: total - cost };
  }

  private soldWords(good: Good, qty: number, total: number, profit: number): string {
    return `Sold ${qty} × ${good.unit} of ${good.name.toLowerCase()} for ₦${total.toLocaleString()}: ${profit >= 0 ? `₦${profit.toLocaleString()} profit` : `₦${(-profit).toLocaleString()} loss`}.`;
  }
}
