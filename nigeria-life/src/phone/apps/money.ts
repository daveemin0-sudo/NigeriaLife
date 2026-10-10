import type { PhoneApp, PhoneHost } from '../PhoneApp';
import { esc, naira, row, empty, chips, count } from '../../ui/kit/html';
import { CREDIT_TYPES } from '../../backend/TransactionService';
import type { TransactionRecord } from '../../backend/types';
import { NetworkManager } from '../../multiplayer/NetworkManager';
import { SHARES, FEE_RATE, type Share } from '../services/Market';
import { SoundEngine } from '../../audio/SoundEngine';
import { Deeds } from '../../realestate/Deeds';
import { AssetMarket } from '../../realestate/AssetMarket';

// ============================================================================================
// Bank
// ============================================================================================

const MOVES = new Set(['ATM_WITHDRAWAL', 'ATM_DEPOSIT']);
const direction = (tx: TransactionRecord): 'in' | 'out' | 'move' =>
  MOVES.has(tx.type) ? 'move' : CREDIT_TYPES.has(tx.type) ? 'in' : 'out';

function transactionRow(tx: TransactionRecord): string {
  const way = direction(tx);
  return row({
    icon: way === 'in' ? '↙' : way === 'out' ? '↗' : '⇄',
    title: esc(tx.description),
    sub: `${esc(tx.timestamp)} · ${tx.source === 'bank' ? 'Bank account' : 'Cash'}`,
    trailing: `<span class="nl-amount nl-amount--${way}">${way === 'in' ? '+' : way === 'out' ? '−' : ''}${naira(tx.amount)}</span>`,
  });
}

export const bankApp: PhoneApp = {
  id: 'bank',
  name: 'Bank',
  icon: '🏦',
  tint: ['#0f5132', '#1f9d6b'],
  purpose: 'Your balance, what came in and went out, and sending money',

  render(host, route) {
    const data = host.backend.getData();

    if (route === 'send') {
      const others = (NetworkManager.getInstance()?.getOnlinePlayersList() ?? []).filter((p) => !p.isLocal);
      const to = host.get('bank.to', others[0]?.id ?? '');
      const from = host.get<'bank' | 'wallet'>('bank.from', 'bank');
      const amount = host.get('bank.amount', '');
      const available = from === 'bank' ? data.bank.balance : data.walletCash;
      return {
        title: 'Send money',
        body: others.length === 0
          ? empty('👥', 'Nobody to send to', 'Transfers go to other players who are in the city at the same time as you. Nobody else is online right now.')
          : `
            <div class="nl-label">To</div>
            <div class="nl-list">
              ${others.map((p) => row({
                icon: '👤',
                title: esc(p.name),
                sub: 'Online now',
                trailing: p.id === to ? '<span class="nl-check">✓</span>' : '',
                attrs: `data-set="bank.to" data-value="${esc(p.id)}" aria-pressed="${p.id === to}"`,
              })).join('')}
            </div>
            <div class="nl-label">From</div>
            ${chips('bank.from', from, [['bank', `Bank · ${naira(data.bank.balance)}`], ['wallet', `Cash · ${naira(data.walletCash)}`]])}
            <label class="nl-label" for="bank-amount">Amount</label>
            <input class="nl-field" id="bank-amount" type="text" inputmode="numeric" pattern="[0-9]*" autocomplete="off" placeholder="₦" value="${esc(amount)}" data-bind="bank.amount" />
            <div class="nl-hint">You can send up to ${naira(available)}.</div>
            <button class="nl-btn nl-btn--primary nl-btn--block" id="bank-send-btn" data-act="send">Send</button>
          `,
      };
    }

    const filter = host.get<string>('bank.filter', 'all');
    const search = host.get('bank.search', '').toLowerCase();
    const history = [...data.transactionHistory].reverse()
      .filter((tx) => filter === 'all' || direction(tx) === filter)
      .filter((tx) => !search || tx.description.toLowerCase().includes(search));
    const loan = data.activeLoan;

    return {
      title: 'Bank',
      body: `
        <div class="nl-hero">
          <span class="nl-hero-label">Bank balance</span>
          <span class="nl-hero-value" id="bank-balance">${naira(data.bank.balance)}</span>
          <span class="nl-hero-sub">Acct ${esc(data.bank.accountNumber)} · Cash on you ${naira(data.walletCash)}</span>
          <div class="nl-hero-actions">
            <button class="nl-btn nl-btn--glass" data-go="send">↗ Send</button>
            <button class="nl-btn nl-btn--glass" data-app="invest">📈 Invest</button>
          </div>
        </div>
        <div class="nl-hint">Cash goes in and out at any cash machine. The branch is on Broad Street.</div>
        ${loan ? `
          <div class="nl-card nl-card--warn">
            <div class="nl-card-title">Loan from ${esc(loan.lender)}</div>
            <div class="nl-card-line">You owe ${naira(loan.amount)}</div>
            <button class="nl-btn nl-btn--sm" data-act="repay">Repay ${naira(loan.amount)}</button>
          </div>` : ''}
        <div class="nl-section">Transactions</div>
        ${chips('bank.filter', filter, [['all', 'All'], ['in', 'Money in'], ['out', 'Money out']])}
        <input class="nl-field nl-field--search" id="bank-search" type="search" placeholder="Search transactions" value="${esc(host.get('bank.search', ''))}" data-bind="bank.search" />
        <div class="nl-list" id="bank-history">
          ${history.length === 0
            ? empty('🧾', 'Nothing here', search ? 'No transaction matches that search.' : 'Money you earn, spend and move will be listed here.')
            : history.map(transactionRow).join('')}
        </div>
      `,
    };
  },

  act(host, action) {
    if (action === 'repay') {
      const result = host.backend.repayLoan();
      host.say(result.message, result.success ? 'good' : 'bad');
      return;
    }
    if (action === 'send') {
      const net = NetworkManager.getInstance();
      const to = host.get('bank.to', '') || (net?.getOnlinePlayersList() ?? []).find((p) => !p.isLocal)?.id || '';
      const amount = wholeNumber(host.get('bank.amount', ''));
      const from = host.get<'bank' | 'wallet'>('bank.from', 'bank');
      if (!net || !to) return host.say('Choose who to send it to.', 'bad');
      if (!Number.isFinite(amount) || amount <= 0) return host.say('Enter an amount to send.', 'bad');
      const sent = net.sendTransfer(to, amount, 'Sent from the bank app', from);
      if (!sent.success) return host.say(sent.message, 'bad');
      SoundEngine.getInstance().playTransactionSuccess();
      host.set('bank.amount', '');
      host.back();
      host.say(sent.message, 'good');
    }
  },
};

// ============================================================================================
// Invest
// ============================================================================================

/** What was typed as an amount, read as a whole number: "12,500" and "₦12500" are both 12500. Nothing usable is NaN. */
function wholeNumber(typed: string): number {
  const digits = String(typed).replace(/[^\d]/g, '');
  return digits ? Number(digits) : NaN;
}

function sparkline(points: number[], width = 96, height = 30): string {
  const low = Math.min(...points);
  const high = Math.max(...points);
  const span = high - low || 1;
  const path = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'}${((i / (points.length - 1)) * width).toFixed(1)},${(height - 2 - ((p - low) / span) * (height - 4)).toFixed(1)}`)
    .join(' ');
  const up = points[points.length - 1] >= points[0];
  return `<svg class="nl-spark nl-spark--${up ? 'up' : 'down'}" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" aria-hidden="true"><path d="${path}" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
}

const percent = (fraction: number) => `${fraction >= 0 ? '+' : '−'}${Math.abs(fraction * 100).toFixed(1)}%`;

function shareRow(host: PhoneHost, share: Share): string {
  const change = host.market.change(share);
  const held = host.market.holding(share.ticker).units;
  return row({
    icon: share.icon,
    title: `${esc(share.name)} <span class="nl-tag">${share.ticker}</span>`,
    sub: `${esc(share.sector)} · ${share.risk} risk${held > 0 ? ` · you hold ${held}` : ''}`,
    trailing: `<span class="nl-stack"><strong>${naira(host.market.price(share))}</strong><span class="nl-amount nl-amount--${change >= 0 ? 'in' : 'out'}">${percent(change)}</span></span>`,
    attrs: `data-go="s:${share.ticker}" data-share="${share.ticker}"`,
  });
}

export const investApp: PhoneApp = {
  id: 'invest',
  name: 'Invest',
  icon: '📈',
  tint: ['#1e3a8a', '#3b82f6'],
  purpose: 'Buy and sell shares on the game\'s own exchange',
  live: () => true,

  render(host, route) {
    const data = host.backend.getData();

    if (route.startsWith('s:')) {
      const share = host.market.share(route.slice(2));
      if (!share) return { title: 'Invest', body: empty('📉', 'Not listed', 'That share is no longer on the exchange.') };
      const price = host.market.price(share);
      const held = host.market.holding(share.ticker);
      const units = wholeNumber(host.get('invest.units', '1')) || 0;
      const cost = units > 0 ? host.market.costToBuy(share, units) : 0;
      const proceeds = units > 0 ? host.market.proceedsFromSale(share, Math.min(units, held.units)) : 0;
      const worth = held.units > 0 ? host.market.proceedsFromSale(share, held.units) : 0;
      const change = host.market.change(share);
      return {
        title: share.ticker,
        body: `
          <div class="nl-hero nl-hero--blue">
            <span class="nl-hero-label">${share.icon} ${esc(share.name)}</span>
            <span class="nl-hero-value" id="invest-price">${naira(price)}</span>
            <span class="nl-hero-sub">${percent(change)} since yesterday · ${esc(share.sector)} · ${share.risk} risk</span>
            ${sparkline(host.market.history(share, 32), 280, 64)}
          </div>
          <div class="nl-card">
            <div class="nl-card-title">Your holding</div>
            ${held.units > 0
              ? `<div class="nl-card-line">${count(held.units, 'unit')} · worth ${naira(worth)} if sold now</div>
                 <div class="nl-card-line nl-amount--${worth - held.spent >= 0 ? 'in' : 'out'}">${worth - held.spent >= 0 ? 'Gain' : 'Loss'} of ${naira(Math.abs(worth - held.spent))} on ${naira(held.spent)} paid</div>`
              : '<div class="nl-card-line">You hold none of this.</div>'}
          </div>
          <label class="nl-label" for="invest-units">Units</label>
          <input class="nl-field" id="invest-units" type="text" inputmode="numeric" pattern="[0-9]*" autocomplete="off" value="${esc(host.get('invest.units', '1'))}" data-bind="invest.units" data-live />
          <div class="nl-split">
            <button class="nl-btn nl-btn--primary" id="invest-buy-btn" data-act="buy" data-arg="${share.ticker}" ${units > 0 ? '' : 'disabled'}>Buy · ${naira(cost)}</button>
            <button class="nl-btn" id="invest-sell-btn" data-act="sell" data-arg="${share.ticker}" ${units > 0 && held.units >= units ? '' : 'disabled'}>Sell · ${naira(proceeds)}</button>
          </div>
          <div class="nl-hint">Bank balance ${naira(data.bank.balance)}. The broker keeps ${(FEE_RATE * 100).toFixed(1)}% of each trade, which is in the amounts above.</div>
          <div class="nl-note">Prices rise and fall. You can get back less than you put in. This exchange is part of the game: nothing here is a real company or real money.</div>
        `,
      };
    }

    const portfolio = host.market.portfolio();
    const gain = portfolio.value - portfolio.spent;
    return {
      title: 'Invest',
      body: `
        <div class="nl-hero nl-hero--blue">
          <span class="nl-hero-label">Portfolio value</span>
          <span class="nl-hero-value" id="invest-value">${naira(portfolio.value)}</span>
          <span class="nl-hero-sub">${portfolio.lines.length === 0
            ? 'You hold no shares yet'
            : `${gain >= 0 ? 'Up' : 'Down'} ${naira(Math.abs(gain))} on ${naira(portfolio.spent)} paid in`}</span>
        </div>
        ${portfolio.lines.length > 0 ? `
          <div class="nl-section">What you hold</div>
          <div class="nl-list">
            ${portfolio.lines.map((line) => row({
              icon: line.share.icon,
              title: `${esc(line.share.name)} <span class="nl-tag">${line.share.ticker}</span>`,
              sub: count(line.units, 'unit'),
              trailing: `<span class="nl-stack"><strong>${naira(line.value)}</strong><span class="nl-amount nl-amount--${line.value - line.spent >= 0 ? 'in' : 'out'}">${line.value - line.spent >= 0 ? '+' : '−'}${naira(Math.abs(line.value - line.spent))}</span></span>`,
              attrs: `data-go="s:${line.share.ticker}"`,
            })).join('')}
          </div>` : ''}
        <div class="nl-section">The exchange</div>
        <div class="nl-list" id="invest-list">${SHARES.map((share) => shareRow(host, share)).join('')}</div>
        <div class="nl-note">Part of the game, not a real market. Prices move with the game's clock, and money comes from and goes back to your bank account.</div>
      `,
    };
  },

  act(host, action, el) {
    const ticker = el.dataset.arg ?? '';
    const units = wholeNumber(host.get('invest.units', '1'));
    const result = action === 'buy' ? host.market.buy(ticker, units) : host.market.sell(ticker, units);
    if (result.success) SoundEngine.getInstance().playTransactionSuccess();
    host.say(result.message, result.success ? 'good' : 'bad');
  },
};

// ============================================================================================
// Businesses
// ============================================================================================

export const businessApp: PhoneApp = {
  id: 'business',
  aliases: ['forbes'],
  name: 'Business',
  icon: '🏢',
  tint: ['#92400e', '#f59e0b'],
  purpose: 'The businesses you own, what they earn, and ones for sale',

  badge(host) {
    return host.backend.getData().businesses.some((b) => b.owned && b.pendingRevenue > 0) ? 1 : 0;
  },

  render(host, route) {
    const data = host.backend.getData();
    const earns = (id: string) => {
      const biz = data.businesses.find((b) => b.id === id)!;
      return biz.baseIncomePerCycle + biz.upgrades.reduce((sum, u) => sum + (u.purchased ? u.bonusIncomePerCycle : 0), 0);
    };

    if (route.startsWith('b:')) {
      const biz = data.businesses.find((b) => b.id === route.slice(2));
      if (!biz) return { title: 'Business', body: empty('🏚️', 'Not found', 'That business is not on the books.') };
      const takenBy = biz.owned ? null : Deeds.get().takenBy('business', biz.id);
      const listing = Deeds.get().listingFor('business', biz.id);
      return {
        title: biz.owned ? 'Your business' : 'For sale',
        body: `
          <div class="nl-card">
            <div class="nl-card-title">${biz.icon} ${esc(biz.name)}</div>
            <div class="nl-card-line">${esc(biz.category)}</div>
            <div class="nl-stats">
              <span><strong>${naira(earns(biz.id))}</strong>each payout</span>
              <span><strong>Level ${biz.level}</strong>${count(biz.upgrades.filter((u) => u.purchased).length, 'upgrade')}</span>
              <span><strong>${naira(biz.purchasePrice)}</strong>${biz.owned ? 'you paid' : 'asking price'}</span>
            </div>
            ${biz.owned
              ? `<div class="nl-card-line">Waiting to be collected: <strong>${naira(biz.pendingRevenue)}</strong></div>`
              : takenBy
                ? `<div class="nl-note" id="business-taken">${esc(AssetMarket.get().nameOf(takenBy))} owns this business. It can only be bought from them.</div>
                   ${listing && listing.status === 'active' ? `<button class="nl-btn nl-btn--primary nl-btn--block" id="business-their-listing" data-app="land" data-route="listing:${esc(listing.id)}">They are asking ${naira(listing.askingPrice)} · make an offer</button>` : ''}`
                : `<button class="nl-btn nl-btn--primary nl-btn--block" data-act="buy" data-arg="${esc(biz.id)}">Buy for ${naira(biz.purchasePrice)}</button>
                   <div class="nl-hint">Paid from your bank account (${naira(data.bank.balance)}).</div>`}
            ${biz.owned ? (listing
              ? `<button class="nl-btn nl-btn--block" id="business-listing" data-app="land" data-route="listing:${esc(listing.id)}">On the market at ${naira(listing.askingPrice)} · see offers</button>`
              : `<button class="nl-btn nl-btn--block" id="business-sell-player" data-app="land" data-route="ask:business:${esc(biz.id)}">Sell to another player</button>`) : ''}
          </div>
          ${biz.owned ? `
            <div class="nl-section">Upgrades</div>
            <div class="nl-list">
              ${biz.upgrades.length === 0 ? empty('🔧', 'No upgrades', 'This business has nothing more to add.') : biz.upgrades.map((u) => row({
                icon: u.purchased ? '✅' : '🔧',
                title: esc(u.name),
                sub: `${esc(u.description)} · +${naira(u.bonusIncomePerCycle)} each payout`,
                trailing: u.purchased ? '<span class="nl-tag">Installed</span>' : `<button class="nl-btn nl-btn--sm" data-act="upgrade" data-arg="${esc(biz.id)}|${esc(u.id)}">${naira(u.cost)}</button>`,
              })).join('')}
            </div>` : ''}
        `,
      };
    }

    const owned = data.businesses.filter((b) => b.owned);
    const forSale = data.businesses.filter((b) => !b.owned);
    const pending = owned.reduce((sum, b) => sum + b.pendingRevenue, 0);
    return {
      title: 'Business',
      body: `
        <div class="nl-hero nl-hero--amber">
          <span class="nl-hero-label">Waiting to be collected</span>
          <span class="nl-hero-value" id="business-pending">${naira(pending)}</span>
          <span class="nl-hero-sub">${count(owned.length, 'business', 'businesses')} · ${naira(owned.reduce((sum, b) => sum + earns(b.id), 0))} each payout</span>
          <div class="nl-hero-actions">
            <button class="nl-btn nl-btn--glass" data-act="collect" ${pending > 0 ? '' : 'disabled'}>Collect into bank</button>
          </div>
        </div>
        <div class="nl-section">Yours</div>
        <div class="nl-list">
          ${owned.length === 0
            ? empty('🏪', 'You own no business yet', 'Buy one below and it pays into this app every few seconds while you play.')
            : owned.map((b) => row({ icon: b.icon, title: esc(b.name), sub: `Level ${b.level} · ${naira(earns(b.id))} each payout`, trailing: `<strong>${naira(b.pendingRevenue)}</strong>`, attrs: `data-go="b:${esc(b.id)}"` })).join('')}
        </div>
        <div class="nl-section">For sale</div>
        <div class="nl-list">
          ${forSale.length === 0
            ? empty('🎉', 'You own them all', 'There is nothing left to buy.')
            : forSale.map((b) => row({ icon: b.icon, title: esc(b.name), sub: `${esc(b.category)} · ${naira(b.baseIncomePerCycle)} each payout`, trailing: `<strong>${naira(b.purchasePrice)}</strong>`, attrs: `data-go="b:${esc(b.id)}"`, tone: data.bank.balance + data.walletCash < b.purchasePrice ? 'muted' : 'default' })).join('')}
        </div>
      `,
    };
  },

  async act(host, action, el) {
    const arg = el.dataset.arg ?? '';
    if (action === 'collect') {
      const result = host.backend.collectBusinessRevenue();
      if (result.totalCollected > 0) SoundEngine.getInstance().playTransactionSuccess();
      host.say(result.message, result.totalCollected > 0 ? 'good' : 'info');
    } else if (action === 'buy') {
      const biz = host.backend.getData().businesses.find((b) => b.id === arg);
      if (!biz) return;
      if (!(await host.confirm(`Buy ${biz.name} for ${naira(biz.purchasePrice)}?`, 'Buy it'))) return;
      const result = host.backend.buyBusiness(arg);
      if (result.success) SoundEngine.getInstance().playTransactionSuccess();
      host.say(result.message, result.success ? 'good' : 'bad');
    } else if (action === 'upgrade') {
      const [bizId, upgradeId] = arg.split('|');
      const result = host.backend.upgradeBusiness(bizId, upgradeId);
      if (result.success) SoundEngine.getInstance().playTransactionSuccess();
      host.say(result.message, result.success ? 'good' : 'bad');
    }
  },
};
