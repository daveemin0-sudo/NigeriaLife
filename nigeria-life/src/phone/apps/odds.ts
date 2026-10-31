import type { PhoneApp, PhoneHost } from '../PhoneApp';
import { esc, naira, empty, chips } from '../../ui/kit/html';
import { Bets, pickLabel, MIN_STAKE, MAX_STAKE } from '../../sport/Bets';
import { odds, fixture, slotAt, SEASON_LENGTH, type Club, type Fixture, type Pick } from '../../sport/League';
import { PlaceOpeners } from '../../interiors/places/PlaceInterior';

/**
 * Naija Odds: bet on the Eko Premier League. A match kicks off every five minutes; back the
 * home side, the draw, the away side or the goals, before kick-off. The match is played on the
 * big screen at Oga Sunday's and on the football channel at home, and the app follows it live.
 * Winnings land in the bank at full time.
 */

const CSS = `
.no-live{position:relative;border-radius:22px;padding:14px 14px 12px;color:#fff;background:radial-gradient(120% 90% at 0% 0%,#15803d 0%,#0b3d24 55%,#06210f 100%);box-shadow:0 14px 28px rgba(6,33,15,.35),inset 0 1px 0 rgba(255,255,255,.14);overflow:hidden}
.no-live::before{content:'';position:absolute;inset:0;background:repeating-linear-gradient(90deg,rgba(255,255,255,.035) 0 22px,transparent 22px 44px);pointer-events:none}
.no-top{display:flex;justify-content:space-between;align-items:center;font:700 11px/1 var(--lx-font,system-ui);letter-spacing:.9px;text-transform:uppercase;opacity:.9}
.no-dot{display:inline-block;width:8px;height:8px;border-radius:50%;background:#ef4444;margin-right:6px;box-shadow:0 0 0 0 rgba(239,68,68,.7);animation:noPulse 1.4s infinite}
@keyframes noPulse{0%{box-shadow:0 0 0 0 rgba(239,68,68,.7)}70%{box-shadow:0 0 0 8px rgba(239,68,68,0)}100%{box-shadow:0 0 0 0 rgba(239,68,68,0)}}
.no-board{display:grid;grid-template-columns:1fr auto 1fr;align-items:center;gap:8px;margin:12px 0 8px;position:relative}
.no-team{display:flex;flex-direction:column;align-items:center;gap:6px;text-align:center;font:700 12.5px/1.2 var(--lx-font,system-ui)}
.no-badge{width:44px;height:44px;border-radius:50%;display:grid;place-items:center;font:900 12px/1 var(--lx-font,system-ui);letter-spacing:.5px;box-shadow:0 4px 10px rgba(0,0,0,.3),inset 0 0 0 3px rgba(255,255,255,.65)}
.no-badge--sm{width:30px;height:30px;font-size:9.5px;box-shadow:0 2px 6px rgba(0,0,0,.18),inset 0 0 0 2px rgba(255,255,255,.7)}
.no-score{font:900 38px/1 var(--lx-font,system-ui);letter-spacing:2px;text-shadow:0 2px 10px rgba(0,0,0,.35)}
.no-min{text-align:center;font:800 12px/1 var(--lx-font,system-ui);color:#fde68a}
.no-goals{display:flex;justify-content:space-between;gap:10px;font:600 11.5px/1.5 var(--lx-font,system-ui);opacity:.92;margin-top:6px;min-height:16px}
.no-goals span:last-child{text-align:right}
.no-watch{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:10px;position:relative}
.no-watch button{border:0;border-radius:14px;padding:10px 8px;font:800 12.5px/1.1 var(--lx-font,system-ui);color:#06210f;background:#fff;box-shadow:0 4px 10px rgba(0,0,0,.18);cursor:pointer}
.no-watch button:last-child{background:rgba(255,255,255,.16);color:#fff;box-shadow:inset 0 0 0 1px rgba(255,255,255,.35)}
.no-fx{background:var(--lx-surface-solid,#fff);border-radius:18px;padding:12px;margin:10px 0;box-shadow:var(--lx-shadow-sm,0 4px 12px rgba(0,0,0,.08));border:1px solid var(--lx-line,rgba(0,0,0,.06))}
.no-fx-head{display:flex;align-items:center;gap:8px;font:800 13.5px/1.25 var(--lx-font,system-ui);color:var(--lx-ink,#0f172a)}
.no-fx-head .no-v{color:var(--lx-dim,#64748b);font-weight:700;font-size:11px}
.no-ko{margin-left:auto;font:700 11px/1.2 var(--lx-font,system-ui);color:var(--lx-dim,#64748b);text-align:right;white-space:nowrap}
.no-prices{display:grid;grid-template-columns:repeat(3,1fr);gap:6px;margin-top:10px}
.no-prices--2{grid-template-columns:repeat(2,1fr);margin-top:6px}
.no-price{border:1px solid var(--lx-line,rgba(0,0,0,.08));background:var(--lx-surface-2,#f8fafc);border-radius:12px;padding:7px 4px;display:flex;flex-direction:column;align-items:center;gap:2px;cursor:pointer;color:var(--lx-ink,#0f172a);transition:transform .12s var(--lx-ease,ease),background .12s}
.no-price small{font:700 10px/1 var(--lx-font,system-ui);color:var(--lx-dim,#64748b);text-transform:uppercase;letter-spacing:.4px}
.no-price b{font:900 15px/1 var(--lx-font,system-ui)}
.no-price.is-on{background:var(--lx-brand,#0b7a43);border-color:transparent;color:#fff;transform:translateY(-1px);box-shadow:0 6px 14px rgba(11,122,67,.3)}
.no-price.is-on small{color:rgba(255,255,255,.85)}
.no-slip{position:sticky;bottom:0;margin-top:10px;background:var(--lx-surface-solid,#fff);border-radius:20px 20px 16px 16px;padding:12px;box-shadow:0 -8px 24px rgba(0,0,0,.14);border:1px solid var(--lx-line,rgba(0,0,0,.06))}
.no-slip-title{font:800 13px/1.3 var(--lx-font,system-ui);color:var(--lx-ink,#0f172a)}
.no-slip-sub{font:600 11.5px/1.3 var(--lx-font,system-ui);color:var(--lx-dim,#64748b);margin-top:2px}
.no-stakes{display:flex;gap:6px;overflow-x:auto;margin:10px 0 8px;scrollbar-width:none}
.no-stakes button{flex:0 0 auto;border:1px solid var(--lx-line,rgba(0,0,0,.1));background:var(--lx-surface-2,#f8fafc);border-radius:999px;padding:6px 11px;font:800 12px/1 var(--lx-font,system-ui);color:var(--lx-ink,#0f172a);cursor:pointer}
.no-stakes button.is-on{background:var(--lx-ink,#0f172a);color:#fff;border-color:transparent}
.no-return{display:flex;justify-content:space-between;align-items:center;margin:8px 0 10px;font:700 12.5px/1 var(--lx-font,system-ui);color:var(--lx-dim,#64748b)}
.no-return b{font:900 17px/1 var(--lx-font,system-ui);color:var(--lx-brand,#0b7a43)}
.no-bet{display:flex;align-items:center;gap:10px;background:var(--lx-surface-solid,#fff);border-radius:16px;padding:10px 12px;margin:8px 0;box-shadow:var(--lx-shadow-sm,0 4px 12px rgba(0,0,0,.08));border-left:4px solid var(--lx-line,#cbd5e1)}
.no-bet--won{border-left-color:#16a34a}.no-bet--lost{border-left-color:#dc2626;opacity:.82}.no-bet--open{border-left-color:#d9a93a}
.no-bet-text{flex:1;min-width:0}
.no-bet-title{font:800 13px/1.25 var(--lx-font,system-ui);color:var(--lx-ink,#0f172a)}
.no-bet-sub{font:600 11.5px/1.35 var(--lx-font,system-ui);color:var(--lx-dim,#64748b)}
.no-bet-amt{text-align:right;font:900 13.5px/1.2 var(--lx-font,system-ui);color:var(--lx-ink,#0f172a)}
.no-bet-amt small{display:block;font:700 10.5px/1.2 var(--lx-font,system-ui);color:var(--lx-dim,#64748b)}
.no-res{display:grid;grid-template-columns:1fr auto 1fr;align-items:center;gap:8px;padding:9px 4px;border-bottom:1px solid var(--lx-line,rgba(0,0,0,.06));font:700 12.5px/1.2 var(--lx-font,system-ui);color:var(--lx-ink,#0f172a)}
.no-res span:first-child{text-align:right}.no-res b{font:900 15px/1 var(--lx-font,system-ui);padding:5px 9px;border-radius:9px;background:var(--lx-surface-2,#f1f5f9)}
.no-foot{text-align:center;font:600 10.5px/1.4 var(--lx-font,system-ui);color:var(--lx-dim,#64748b);margin:14px 0 4px}
`;
let styled = false;
const style = () => {
  if (styled) return;
  styled = true;
  const el = document.createElement('style');
  el.textContent = CSS;
  document.head.appendChild(el);
};

const STAKES = [500, 2_000, 10_000, 50_000, 250_000, 1_000_000];

const badge = (club: Club, small = false) =>
  `<span class="no-badge${small ? ' no-badge--sm' : ''}" style="background:linear-gradient(145deg, ${club.colours[0]}, ${club.colours[0]}cc);color:${club.colours[1]}">${esc(club.short)}</span>`;

const clockAt = (ms: number) => new Date(ms).toLocaleTimeString('en-NG', { hour: 'numeric', minute: '2-digit', timeZone: 'Africa/Lagos' });
const countdown = (ms: number) => {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

function liveCard(): string {
  const bets = Bets.get();
  const { fixture: f, match, phase } = bets.now();
  const next = fixture(f.slot + 1);
  const now = Bets.now();
  if (!match) {
    return `
      <div class="no-live" id="odds-live">
        <div class="no-top"><span>Eko Premier League</span><span>Kick-off</span></div>
        <div class="no-board">
          <div class="no-team">${badge(f.home)}${esc(f.home.name)}</div>
          <div class="no-score">–</div>
          <div class="no-team">${badge(f.away)}${esc(f.away.name)}</div>
        </div>
        <div class="no-min">Getting the match feed…</div>
      </div>`;
  }
  const sim = match.sim;
  const goals = (side: 0 | 1) => match.goals.filter((g) => g.side === side).map((g) => `⚽ ${g.minute}'`).join(' ');
  const minute = phase === 'full-time' ? `Full time · next: ${esc(next.home.short)} v ${esc(next.away.short)} in ${countdown(next.kickoff - now)}` : sim.celebrating > 0 ? 'GOAL!' : `${sim.minute}'`;
  return `
    <div class="no-live" id="odds-live" data-score="${sim.score[0]}-${sim.score[1]}" data-phase="${phase}">
      <div class="no-top"><span>${phase === 'live' ? '<span class="no-dot"></span>Live' : 'Eko Premier League'}</span><span>Match ${(f.slot % SEASON_LENGTH) + 1} of ${SEASON_LENGTH}</span></div>
      <div class="no-board">
        <div class="no-team">${badge(f.home)}${esc(f.home.name)}</div>
        <div class="no-score" id="odds-score">${sim.score[0]} - ${sim.score[1]}</div>
        <div class="no-team">${badge(f.away)}${esc(f.away.name)}</div>
      </div>
      <div class="no-min">${minute}</div>
      <div class="no-goals"><span>${goals(0)}</span><span>${goals(1)}</span></div>
      <div class="no-watch">
        <button data-act="watch-out" id="odds-watch-out">📺 Oga Sunday's</button>
        <button data-act="watch-home" id="odds-watch-home">🏠 Watch at home</button>
      </div>
    </div>`;
}

function fixtureCard(f: Fixture, chosen: string): string {
  const price = odds(f);
  const now = Bets.now();
  const btn = (pick: Pick, label: string) => {
    const id = `${f.slot}|${pick}`;
    return `<button class="no-price${chosen === id ? ' is-on' : ''}" data-act="pick" data-arg="${id}" data-pick="${pick}" data-slot="${f.slot}"><small>${label}</small><b>${price[pick].toFixed(2)}</b></button>`;
  };
  return `
    <div class="no-fx" data-fixture="${f.slot}">
      <div class="no-fx-head">${badge(f.home, true)}<span>${esc(f.home.name)} <span class="no-v">v</span> ${esc(f.away.name)}</span>${badge(f.away, true)}
        <span class="no-ko">${clockAt(f.kickoff)}<br>in ${countdown(f.kickoff - now)}</span></div>
      <div class="no-prices">${btn('1', esc(f.home.short))}${btn('X', 'Draw')}${btn('2', esc(f.away.short))}</div>
      <div class="no-prices no-prices--2">${btn('O', 'Over 2.5')}${btn('U', 'Under 2.5')}</div>
    </div>`;
}

function slip(host: PhoneHost, chosen: string): string {
  if (!chosen) return '';
  const [slotText, pick] = chosen.split('|') as [string, Pick];
  const f = fixture(Number(slotText));
  const price = odds(f)[pick];
  const typed = String(host.get('odds.stake', '2000'));
  const stake = Math.floor(Number(typed.replace(/[^\d]/g, '')) || 0);
  return `
    <div class="no-slip" id="odds-slip">
      <div class="no-slip-title">🎫 ${esc(pickLabel(pick, f))} @ ${price.toFixed(2)}</div>
      <div class="no-slip-sub">${esc(f.home.name)} v ${esc(f.away.name)} · kick-off ${clockAt(f.kickoff)}</div>
      <div class="no-stakes">${STAKES.map((s) => `<button class="${s === stake ? 'is-on' : ''}" data-set="odds.stake" data-value="${s}">${naira(s)}</button>`).join('')}</div>
      <input class="nl-field" id="odds-stake" type="text" inputmode="numeric" value="${esc(typed)}" data-bind="odds.stake" data-live aria-label="Stake" />
      <div class="no-return"><span>Stake ${naira(stake)} from your bank</span><span>Returns <b id="odds-returns">${naira(Math.floor(stake * price))}</b></span></div>
      <button class="nl-btn nl-btn--primary nl-btn--block" id="odds-place" data-act="place" ${stake < MIN_STAKE || stake > MAX_STAKE ? 'disabled' : ''}>Place bet · ${naira(stake)}</button>
    </div>`;
}

function myBets(): string {
  const list = Bets.get().mine();
  if (!list.length) return empty('🎫', 'No bets yet', 'Back a team in the next match and watch it live.');
  return list.slice(0, 30).map((bet) => {
    const f = fixture(bet.slot);
    const returns = Math.floor(bet.stake * bet.price);
    const state = bet.status === 'open'
      ? (f.kickoff > Bets.now() ? `Kick-off ${clockAt(f.kickoff)}` : 'Playing now')
      : `${f.home.short} ${bet.score?.[0] ?? 0}-${bet.score?.[1] ?? 0} ${f.away.short} · ${bet.status === 'won' ? 'Won' : 'Lost'}`;
    return `
      <div class="no-bet no-bet--${bet.status}" data-bet="${esc(bet.id)}" data-status="${bet.status}">
        <span>${bet.status === 'won' ? '✅' : bet.status === 'lost' ? '❌' : '⏳'}</span>
        <div class="no-bet-text">
          <div class="no-bet-title">${esc(pickLabel(bet.pick, f))} @ ${bet.price.toFixed(2)}</div>
          <div class="no-bet-sub">${esc(f.home.name)} v ${esc(f.away.name)} · ${esc(state)}</div>
        </div>
        <div class="no-bet-amt">${bet.status === 'won' ? `+${naira(returns)}` : naira(bet.stake)}<small>${bet.status === 'open' ? `to return ${naira(returns)}` : bet.status === 'won' ? `from ${naira(bet.stake)}` : 'stake'}</small></div>
      </div>`;
  }).join('');
}

function results(): string {
  const list = Bets.get().results(8);
  if (!list.length) return empty('📊', 'No results yet', 'The first full time is a few minutes away.');
  return `<div class="no-fx">${list.map(({ fixture: f, score }) => `
    <div class="no-res"><span>${esc(f.home.name)}</span><b>${score[0]} - ${score[1]}</b><span>${esc(f.away.name)}</span></div>`).join('')}</div>`;
}

export const oddsApp: PhoneApp = {
  id: 'odds',
  aliases: ['bettips', 'bet'],
  name: 'Naija Odds',
  icon: '⚽',
  tint: ['#0b3d24', '#16a34a'],
  purpose: 'Bet on the Eko Premier League: a match every five minutes, watch it live',
  badge: () => Bets.get().open().length,
  live: () => true,

  render(host) {
    style();
    const tab = host.get('odds.tab', 'matches') as string;
    const chosen = String(host.get('odds.pick', ''));
    // A pick on a match that has since kicked off is gone
    const still = chosen && Number(chosen.split('|')[0]) > slotAt(Bets.now()) ? chosen : '';
    let body = '';
    if (tab === 'bets') body = `<div id="odds-bets">${myBets()}</div>`;
    else if (tab === 'results') body = `<div id="odds-results">${results()}</div>`;
    else body = `
      <div class="nl-section">Next kick-offs</div>
      <div id="odds-fixtures">${Bets.get().upcoming().map((f) => fixtureCard(f, still)).join('')}</div>
      ${slip(host, still)}`;
    return {
      title: 'Naija Odds',
      body: `
        ${liveCard()}
        ${chips('odds.tab', tab, [['matches', '⚽ Matches'], ['bets', `🎫 My bets${Bets.get().open().length ? ` (${Bets.get().open().length})` : ''}`], ['results', '📊 Results']])}
        ${body}
        <div class="no-foot">Game money only, for fun. ${Bets.get().online ? 'The world server holds stakes and pays winners.' : 'Winnings are paid into your bank at full time.'}</div>`,
    };
  },

  async act(host, action, el) {
    if (action === 'pick') {
      const arg = el.dataset.arg ?? '';
      host.set('odds.pick', host.get('odds.pick', '') === arg ? '' : arg);
      return;
    }
    if (action === 'place') {
      const chosen = String(host.get('odds.pick', ''));
      if (!chosen) return;
      const [slot, pick] = chosen.split('|') as [string, Pick];
      const stake = Math.floor(Number(String(host.get('odds.stake', '0')).replace(/[^\d]/g, '')) || 0);
      const why = await Bets.get().place(Number(slot), pick, stake);
      if (why) return host.say(why, 'bad');
      host.set('odds.pick', '');
      host.say(`Bet placed: ${naira(stake)}. Watch it live at Oga Sunday's or on your TV.`, 'good');
      return;
    }
    if (action === 'watch-out') {
      host.close();
      PlaceOpeners.open('ride:roadside-viewing-centre');
      return;
    }
    if (action === 'watch-home') {
      host.close();
      host.world.goHome();
    }
  },
};
