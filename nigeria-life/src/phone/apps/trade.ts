import type { PhoneApp, PhoneHost } from '../PhoneApp';
import { esc, naira, row, empty, chips, meter } from '../../ui/kit/html';
import { SoundEngine } from '../../audio/SoundEngine';
import { OnlineAccount } from '../../online/OnlineAccount';
import { TradeDesk } from '../../travel/TradeDesk';
import { CARRY_KG, CITY_NAMES, TRADE_SHEDS, goodById, type TradeCity } from '../../travel/Trade';

const CITIES: TradeCity[] = ['lagos', 'abuja', 'port_harcourt'];

/** Online the server holds the cargo and the day: asked when the app opens, then every half minute */
function askServer(host: PhoneHost): void {
  if (!OnlineAccount.get() || Date.now() - host.get<number>('trade.asked', 0) < 30_000) return;
  host.set('trade.asked', Date.now());
  void TradeDesk.get().refresh().then(() => host.refresh());
}

/**
 * Trade between cities: what you carry, today's prices at every motor park's goods shed (to plan
 * a run: buy where a thing is made, sell where it is dear), and, standing at a shed, buying and
 * selling there.
 */
export const tradeApp: PhoneApp = {
  id: 'trade',
  name: 'Trade',
  icon: '📦',
  tint: ['#7c2d12', '#d97706'],
  purpose: 'Buy goods where they are made, carry them, sell them where they are dear',

  render(host) {
    askServer(host);
    const desk = TradeDesk.get();
    const here = desk.shedHere();
    const view = host.get<TradeCity>('trade.city', here ?? 'lagos');
    const kg = desk.kg();
    const carried = desk.cargo();
    const list = desk.prices(view);
    // Where each good sells best today, for the board
    const best = (id: string) => CITIES.map((c) => ({ c, sell: desk.prices(c).find((p) => p.good.id === id)!.sell })).sort((a, b) => b.sell - a.sell)[0];

    return {
      title: 'Trade',
      body: `
        <div class="nl-hero" id="trade-hero">
          <span class="nl-hero-label">${here ? esc(TRADE_SHEDS[here].name) : 'Not at a goods shed'}</span>
          <span class="nl-hero-value" id="trade-kg">${kg} of ${CARRY_KG} kg</span>
          <span class="nl-hero-sub">${carried.length ? `Carrying ${carried.map((l) => `${l.qty} × ${esc(goodById(l.good)?.name ?? l.good)}`).join(', ')}` : 'Carrying nothing'}</span>
          ${meter((kg / CARRY_KG) * 100, kg > CARRY_KG * 0.85 ? 'warn' : 'good')}
        </div>
        ${here ? '' : '<div class="nl-hint" id="trade-away">Buy and sell at a motor park goods shed: Jibowu in Lagos, Utako in Abuja, Waterlines in Port Harcourt. The prices here are today\'s.</div>'}
        ${carried.length ? `
          <div class="nl-section">What you carry</div>
          <div class="nl-list" id="trade-cargo">
            ${carried.map((l) => {
              const good = goodById(l.good)!;
              const sellHere = here ? desk.prices(here).find((p) => p.good.id === l.good)!.sell : null;
              return row({
                icon: '📦',
                title: `${l.qty} × ${esc(good.name)}`,
                sub: `${esc(good.unit)} · paid ${naira(l.paid)} in ${esc(CITY_NAMES[l.city])}${sellHere !== null ? ` · ${naira(sellHere)} each here` : ''}`,
                trailing: here ? `<button class="nl-btn nl-btn--sm nl-btn--primary" data-act="sell" data-arg="${esc(l.good)}|${l.qty}">Sell all</button>` : '',
                tag: 'div',
              });
            }).join('')}
          </div>` : ''}
        <div class="nl-section">Prices today</div>
        ${chips('trade.city', view, CITIES.map((c) => [c, CITY_NAMES[c]] as [string, string]))}
        <div class="nl-list" id="trade-prices">
          ${list.length === 0 ? empty('📦', 'Nothing traded', '') : list.map(({ good, buy, sell }) => {
            const top = best(good.id);
            const canBuy = here === view;
            return row({
              icon: good.from === view ? '🏷️' : '🚚',
              title: `${esc(good.name)} · ${esc(good.unit)}`,
              sub: `Buy ${naira(buy)} · sells for ${naira(sell)} · ${good.kg} kg${good.from === view ? ' · made here' : ''} · best price today in ${esc(CITY_NAMES[top.c])} (${naira(top.sell)})`,
              trailing: canBuy ? `<button class="nl-btn nl-btn--sm" data-act="buy" data-arg="${esc(good.id)}|1">Buy 1</button>` : '',
              attrs: `data-good="${esc(good.id)}"`,
              tag: 'div',
            });
          }).join('')}
        </div>
        <div class="nl-hint">A shed buys back at nine tenths of its price, so the profit is in the journey: carry what is made in one city to where it is dear. By coach the goods ride in the boot.</div>
      `,
    };
  },

  async act(host, action, el) {
    const [id, n] = (el.dataset.arg ?? '').split('|');
    const qty = Math.max(1, Number(n) || 1);
    const desk = TradeDesk.get();
    const done = action === 'buy' ? await desk.buy(id, qty) : action === 'sell' ? await desk.sell(id, qty) : null;
    if (!done) return;
    if (done.ok) SoundEngine.getInstance().playTransactionSuccess();
    host.say(done.message, done.ok ? 'good' : 'bad');
    host.refresh();
  },
};
