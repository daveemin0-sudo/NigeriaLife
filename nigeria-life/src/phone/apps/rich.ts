import type { PhoneApp, PhoneHost } from '../PhoneApp';
import { esc, empty, chips, meter } from '../../ui/kit/html';
import { RichList, TYCOONS, short, type Worth } from '../../life/RichList';
import { OnlineAccount } from '../../online/OnlineAccount';

/**
 * Naija Rich List: what you are worth, all of it counted, and where that puts you among Lagos's
 * big names; who is next above you and how much it takes to pass them. Online, the players'
 * own list, richest first.
 */

const CSS = `
.rl-hero{position:relative;border-radius:22px;padding:16px;color:#1c1407;background:linear-gradient(145deg,#f6d77a 0%,#d9a93a 45%,#a8761a 100%);box-shadow:0 14px 28px rgba(168,118,26,.3),inset 0 1px 0 rgba(255,255,255,.4);overflow:hidden}
.rl-hero::after{content:'';position:absolute;right:-30px;top:-40px;width:160px;height:160px;border-radius:50%;background:rgba(255,255,255,.16)}
.rl-label{font:800 11px/1 var(--lx-font,system-ui);letter-spacing:1px;text-transform:uppercase;opacity:.8}
.rl-worth{font:900 34px/1.1 var(--lx-font,system-ui);margin:6px 0 2px;position:relative}
.rl-rank{display:inline-flex;align-items:center;gap:6px;font:800 13px/1 var(--lx-font,system-ui);background:rgba(28,20,7,.12);padding:6px 10px;border-radius:999px;position:relative}
.rl-next{margin-top:10px;font:700 12.5px/1.4 var(--lx-font,system-ui);position:relative}
.rl-parts{background:var(--lx-surface-solid,#fff);border-radius:18px;padding:12px;margin:12px 0;box-shadow:var(--lx-shadow-sm,0 4px 12px rgba(0,0,0,.06));border:1px solid var(--lx-line,rgba(0,0,0,.06))}
.rl-part{display:grid;grid-template-columns:22px 1fr auto;gap:8px;align-items:center;padding:6px 0;font:700 12.5px/1.2 var(--lx-font,system-ui);color:var(--lx-ink,#0f172a)}
.rl-part .nl-meter{grid-column:2 / 4}
.rl-part b{font-weight:900}
.rl-row{display:flex;align-items:center;gap:10px;padding:10px 12px;margin:6px 0;border-radius:16px;background:var(--lx-surface-solid,#fff);border:1px solid var(--lx-line,rgba(0,0,0,.06));color:var(--lx-ink,#0f172a)}
.rl-row--me{background:linear-gradient(135deg,#fff7db,#fdecb5);border-color:#e8c766;box-shadow:0 6px 16px rgba(217,169,58,.25)}
.rl-pos{width:28px;text-align:center;font:900 14px/1 var(--lx-font,system-ui);color:var(--lx-dim,#64748b)}
.rl-row--top .rl-pos{color:#a8761a}
.rl-ic{width:34px;height:34px;border-radius:50%;display:grid;place-items:center;background:var(--lx-surface-2,#f1f5f9);font-size:17px;flex:0 0 auto}
.rl-who{flex:1;min-width:0;display:block}
.rl-name{display:block;font:800 13px/1.25 var(--lx-font,system-ui);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.rl-trade{display:block;font:600 11.5px/1.3 var(--lx-font,system-ui);color:var(--lx-dim,#64748b)}
.rl-amt{font:900 13.5px/1 var(--lx-font,system-ui);white-space:nowrap}
`;
let styled = false;
const style = () => {
  if (styled) return;
  styled = true;
  const el = document.createElement('style');
  el.textContent = CSS;
  document.head.appendChild(el);
};

let players: { list: Array<{ name: string; worth: number; me: boolean }>; rank: number; count: number } | null = null;
let fetchedAt = 0;
async function loadPlayers(host: PhoneHost): Promise<void> {
  const online = OnlineAccount.get();
  if (!online || Date.now() - fetchedAt < 15_000) return;
  fetchedAt = Date.now();
  const got = await online.request('/richlist');
  if (got?.ok) {
    players = { list: got.list ?? [], rank: got.rank ?? 0, count: got.count ?? 0 };
    host.refresh();
  }
}

const PARTS: Array<[keyof Worth, string, string]> = [
  ['money', '💵', 'Cash and bank'],
  ['businesses', '🏪', 'Businesses'],
  ['land', '🗺️', 'Land and buildings'],
  ['homes', '🏠', 'Homes'],
  ['vehicles', '🚗', 'Cars and rides'],
  ['investments', '📈', 'Investments'],
];

export const richApp: PhoneApp = {
  id: 'rich',
  aliases: ['forbes', 'richlist'],
  name: 'Rich List',
  icon: '👑',
  tint: ['#a8761a', '#f6d77a'],
  purpose: 'What you are worth, and where it puts you among Lagos’s richest',

  render(host) {
    style();
    const w = RichList.worth();
    const total = RichList.total(w);
    const me = host.backend.getData().username || 'You';
    const s = RichList.standing(total);
    const tab = host.get('rich.tab', 'lagos') as string;
    const hero = `
      <div class="rl-hero" id="rich-hero" data-total="${total}" data-rank="${s.rank}">
        <div class="rl-label">Your net worth</div>
        <div class="rl-worth">${short(total)}</div>
        <span class="rl-rank">👑 #${s.rank} on the Lagos list</span>
        <div class="rl-next">${s.above ? `Next: ${esc(s.above.name)} at ${short(s.above.worth)}. ${short(s.gap)} more to pass them.` : 'Top of the list. Lagos bows.'}</div>
      </div>`;
    const parts = `
      <div class="rl-parts" id="rich-parts">
        ${PARTS.map(([key, icon, label]) => `
          <div class="rl-part"><span>${icon}</span><span>${label}</span><b>${short(w[key])}</b>${meter(total > 0 ? (w[key] / total) * 100 : 0, 'good')}</div>`).join('')}
      </div>`;
    let list = '';
    if (tab === 'players') {
      if (!OnlineAccount.get()) list = empty('🌐', 'The players’ list is for the online city', 'Play online to see who has made the most money.');
      else {
        void loadPlayers(host);
        list = !players ? empty('⏳', 'Loading…', 'The richest players in Lagos.')
          : `${players.list.map((p, i) => `
            <div class="rl-row${p.me ? ' rl-row--me' : ''}${i < 3 ? ' rl-row--top' : ''}"><span class="rl-pos">${i + 1}</span><span class="rl-ic">${i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : '👤'}</span>
              <span class="rl-who"><span class="rl-name">@${esc(p.name)}</span><span class="rl-trade">Cash and bank</span></span><span class="rl-amt">${short(p.worth)}</span></div>`).join('')}
            ${players.rank > players.list.length ? `<div class="nl-hint">You are #${players.rank} of ${players.count} players.</div>` : ''}`;
      }
    } else {
      const rows: string[] = [];
      let placed = false;
      let pos = 1;
      const meRow = () => `
        <div class="rl-row rl-row--me" id="rich-me"><span class="rl-pos">${pos}</span><span class="rl-ic">⭐</span>
          <span class="rl-who"><span class="rl-name">@${esc(me)} (you)</span><span class="rl-trade">On the way up</span></span><span class="rl-amt">${short(total)}</span></div>`;
      for (const t of TYCOONS) {
        if (!placed && total >= t.worth) {
          rows.push(meRow());
          placed = true;
          pos++;
        }
        rows.push(`
          <div class="rl-row${pos <= 3 ? ' rl-row--top' : ''}"><span class="rl-pos">${pos}</span><span class="rl-ic">${t.icon}</span>
            <span class="rl-who"><span class="rl-name">${esc(t.name)}</span><span class="rl-trade">${esc(t.trade)}</span></span><span class="rl-amt">${short(t.worth)}</span></div>`);
        pos++;
      }
      if (!placed) rows.push(meRow());
      list = `<div id="rich-list">${rows.join('')}</div>`;
    }
    return {
      title: 'Rich List',
      body: `${hero}${parts}${chips('rich.tab', tab, [['lagos', '👑 Lagos list'], ['players', '🌐 Players']])}${list}`,
    };
  },
};
