import type { PhoneApp, PhoneHost } from '../PhoneApp';
import { esc, naira } from '../../ui/kit/html';
import { newAyo, play as playAyo, botMove, legalMoves, type AyoState } from '../../games/Ayo';
import { newWhot, playCard, goToMarket, botTurn, canPlay, top, SHAPES, SHAPE_ICON, type WhotState, type Shape } from '../../games/Whot';
import { Activity } from '../../life/Activity';

/**
 * Naija Games on the phone: Ayo against Mama Ronke, the board's best on the street, and Whot
 * at a table of four. Play for nothing or put money on it: the stake goes into the pot and
 * the winner takes the pot. Wins are counted, and every game counts for today's hustle.
 */

const STAKES = [0, 1_000, 5_000, 20_000, 100_000];
const WHOT_NAMES = ['You', 'Chinedu', 'Aisha', 'Baba Tunde'];

interface Session {
  stake: number;
  ayo: AyoState | null;
  whot: WhotState | null;
  calling: string | null;
  busy: boolean;
  paid: boolean;
}
export const gameSession: Session = { stake: 0, ayo: null, whot: null, calling: null, busy: false, paid: false };

const RECORD_KEY = 'nl_games_record_v1';
function record(): { ayo: [number, number]; whot: [number, number] } {
  try { return { ayo: [0, 0], whot: [0, 0], ...JSON.parse(localStorage.getItem(`${RECORD_KEY}:${Activity.player()}`) ?? '{}') }; } catch { return { ayo: [0, 0], whot: [0, 0] }; }
}
function keepRecord(game: 'ayo' | 'whot', won: boolean): void {
  const r = record();
  r[game][won ? 0 : 1] += 1;
  try { localStorage.setItem(`${RECORD_KEY}:${Activity.player()}`, JSON.stringify(r)); } catch { /* blocked */ }
}

const CSS = `
.gm-board{border-radius:22px;padding:14px 10px;background:linear-gradient(160deg,#7c3f16,#a0522d 45%,#6b3410);box-shadow:inset 0 2px 0 rgba(255,255,255,.2),0 10px 24px rgba(0,0,0,.35)}
.gm-row{display:grid;grid-template-columns:repeat(6,1fr);gap:6px;margin:6px 0}
.gm-pit{aspect-ratio:1;border-radius:50%;background:radial-gradient(circle at 40% 35%,#4a2510,#2b1408 70%);box-shadow:inset 0 4px 8px rgba(0,0,0,.6);display:flex;flex-wrap:wrap;align-content:center;justify-content:center;gap:2px;padding:6px;position:relative;border:0;color:#fde68a}
.gm-pit .sd{width:7px;height:7px;border-radius:50%;background:radial-gradient(circle at 35% 30%,#fef3c7,#b45309)}
.gm-pit .c{position:absolute;bottom:-2px;right:0;font-size:11px;font-weight:800;background:rgba(0,0,0,.55);border-radius:8px;padding:0 5px}
.gm-pit.can{outline:2px solid #fde047;box-shadow:0 0 12px rgba(253,224,71,.6),inset 0 4px 8px rgba(0,0,0,.6)}
.gm-pit.path{background:radial-gradient(circle at 40% 35%,#6b3a17,#3b1d0a 70%)}
.gm-pit.took{outline:2px solid #ef4444}
.gm-stores{display:flex;justify-content:space-between;font-weight:800;color:#fde68a;font-size:13px;padding:0 4px}
.gm-say{margin:10px 0;padding:10px 12px;border-radius:14px;background:rgba(255,255,255,.06);font-size:13px;min-height:20px}
.gm-card{width:54px;height:78px;border-radius:9px;background:#fff8e7;border:2px solid #7f1d1d;color:#7f1d1d;display:flex;flex-direction:column;align-items:center;justify-content:center;font-weight:900;position:relative;flex:none;box-shadow:0 3px 8px rgba(0,0,0,.3)}
.gm-card .s{font-size:26px;line-height:1}
.gm-card .n{position:absolute;top:3px;left:5px;font-size:12px}
.gm-card.whot{background:linear-gradient(160deg,#7f1d1d,#b91c1c);color:#fff8e7}
.gm-card.can{transform:translateY(-8px);box-shadow:0 0 0 3px #fde047,0 8px 14px rgba(0,0,0,.35)}
.gm-card.off{opacity:.55}
.gm-back{width:30px;height:44px;border-radius:6px;background:repeating-linear-gradient(45deg,#7f1d1d 0 4px,#991b1b 4px 8px);border:2px solid #fff8e7;margin-left:-14px}
.gm-hand{display:flex;gap:6px;overflow-x:auto;padding:12px 2px 6px}
.gm-table{border-radius:22px;padding:12px;background:radial-gradient(circle,#166534,#14532d 70%,#052e16);box-shadow:inset 0 0 30px rgba(0,0,0,.5)}
.gm-opps{display:flex;justify-content:space-around;margin-bottom:12px}
.gm-opp{text-align:center;font-size:12px;color:#dcfce7}
.gm-opp.turn b{color:#fde047}
.gm-mid{display:flex;align-items:center;justify-content:center;gap:18px}
.gm-shapes{display:flex;gap:8px;justify-content:center;margin-top:10px}
.gm-shapes button{width:48px;height:48px;border-radius:12px;border:2px solid #7f1d1d;background:#fff8e7;color:#7f1d1d;font-size:22px;font-weight:900}
`;
let styled = false;
const style = () => {
  if (styled) return '';
  styled = true;
  const el = document.createElement('style');
  el.textContent = CSS;
  document.head.appendChild(el);
  return '';
};

function stakeChips(): string {
  return `<div class="nl-chips" style="margin:6px 0 12px">${STAKES.map((s) => `<button class="nl-chip${s === gameSession.stake ? ' is-on' : ''}" data-act="stake" data-stake="${s}" aria-pressed="${s === gameSession.stake}">${s ? naira(s) : 'Free'}</button>`).join('')}</div>`;
}

function settle(host: PhoneHost, game: 'ayo' | 'whot', won: boolean, draw = false): void {
  if (gameSession.paid) return;
  gameSession.paid = true;
  const players = game === 'ayo' ? 2 : WHOT_NAMES.length;
  const pot = gameSession.stake * players;
  if (won && pot > 0) host.backend.processTransaction({ type: 'WINNINGS', amount: pot, description: `${game === 'ayo' ? 'Ayo' : 'Whot'}: you won the pot` });
  if (draw && gameSession.stake > 0) host.backend.processTransaction({ type: 'WINNINGS', amount: gameSession.stake, description: 'Ayo: a draw, your stake back' });
  keepRecord(game, won);
  Activity.emit({ kind: 'game', game, won, stake: gameSession.stake });
  host.say(won ? `You won${pot ? ` ${naira(pot)}` : ''}! 🎉` : draw ? 'A draw.' : 'You lost this one. Play again?', won ? 'good' : 'info');
}

function takeStake(host: PhoneHost, what: string): boolean {
  if (!gameSession.stake) return true;
  if (!host.backend.pay(gameSession.stake, `${what}: your stake`, 'TRANSFER_OUT')) {
    host.say(`You need ${naira(gameSession.stake)} for that stake.`, 'bad');
    return false;
  }
  return true;
}

// --- Ayo ----------------------------------------------------------------------------------

function ayoScreen(): string {
  const s = gameSession.ayo!;
  const moves = s.turn === 0 && !gameSession.busy ? legalMoves(s) : [];
  const pit = (i: number) => {
    const n = s.pits[i];
    const dots = Array.from({ length: Math.min(n, 14) }, () => '<span class="sd"></span>').join('');
    const cls = ['gm-pit', moves.includes(i) ? 'can' : '', s.last?.path.includes(i) ? 'path' : '', s.last?.captured.includes(i) ? 'took' : ''].join(' ');
    return `<button class="${cls}" data-act="ayo-pit" data-pit="${i}" ${moves.includes(i) ? '' : 'disabled'} aria-label="Pit ${i + 1}, ${n} seeds">${dots}<span class="c">${n}</span></button>`;
  };
  const status = s.over
    ? s.winner === 0 ? `🎉 You win ${s.store[0]} to ${s.store[1]}!` : s.winner === 1 ? `Mama Ronke wins ${s.store[1]} to ${s.store[0]}.` : 'A draw!'
    : s.turn === 0 ? 'Your turn: tap one of your pits (bottom row)' : 'Mama Ronke is thinking…';
  return `${style()}
    <div class="gm-stores"><span>👵🏾 Mama Ronke: ${s.store[1]}</span><span>${gameSession.stake ? `Pot ${naira(gameSession.stake * 2)}` : 'Friendly'}</span></div>
    <div class="gm-board">
      <div class="gm-row">${[11, 10, 9, 8, 7, 6].map(pit).join('')}</div>
      <div class="gm-row">${[0, 1, 2, 3, 4, 5].map(pit).join('')}</div>
    </div>
    <div class="gm-stores" style="margin-top:6px"><span>🙋🏾 You: ${s.store[0]}</span><span>25 to win</span></div>
    <div class="gm-say" id="ayo-status">${esc(status)}</div>
    ${s.over ? `<button class="nl-btn nl-btn--primary nl-btn--block" data-act="ayo-new">Play again</button>` : ''}`;
}

function ayoBot(host: PhoneHost): void {
  const s = gameSession.ayo;
  if (!s || s.over || s.turn !== 1) return;
  gameSession.busy = true;
  setTimeout(() => {
    const now = gameSession.ayo;
    if (!now || now.over || now.turn !== 1) { gameSession.busy = false; return; }
    gameSession.ayo = playAyo(now, botMove(now)) ?? now;
    gameSession.busy = false;
    if (gameSession.ayo.over) settle(host, 'ayo', gameSession.ayo.winner === 0, gameSession.ayo.winner === 'draw');
    host.refresh();
    // If the player has no move, play passes straight back
    if (!gameSession.ayo.over && gameSession.ayo.turn === 1) ayoBot(host);
  }, 900);
}

// --- Whot ---------------------------------------------------------------------------------

function cardHtml(c: { shape: Shape; n: number; id: string }, opts: { can?: boolean; off?: boolean; act?: boolean } = {}): string {
  const cls = ['gm-card', c.shape === 'whot' ? 'whot' : '', opts.can ? 'can' : '', opts.off ? 'off' : ''].join(' ');
  const inner = `<span class="n">${c.n}</span><span class="s">${SHAPE_ICON[c.shape]}</span>${c.shape === 'whot' ? '<span style="font-size:10px">WHOT</span>' : ''}`;
  return opts.act ? `<button class="${cls}" data-act="whot-card" data-card="${c.id}" ${opts.can ? '' : 'disabled'}>${inner}</button>` : `<div class="${cls}">${inner}</div>`;
}

function whotScreen(): string {
  const s = gameSession.whot!;
  const mine = s.turn === 0 && s.winner === null && !gameSession.busy;
  const t = top(s);
  return `${style()}
    <div class="gm-table">
      <div class="gm-opps">${[1, 2, 3].map((p) => `<div class="gm-opp${s.turn === p ? ' turn' : ''}"><div style="display:flex;justify-content:center;padding-left:14px">${Array.from({ length: Math.min(6, s.hands[p].length) }, () => '<span class="gm-back"></span>').join('')}</div><b>${esc(s.names[p])}</b> · ${s.hands[p].length}${s.hands[p].length === 1 ? ' ⚠️' : ''}</div>`).join('')}</div>
      <div class="gm-mid">
        <button class="gm-card" style="background:repeating-linear-gradient(45deg,#7f1d1d 0 5px,#991b1b 5px 10px);color:#fff8e7" data-act="whot-market" ${mine ? '' : 'disabled'} aria-label="Go to market"><span class="s" style="font-size:14px">Market</span><span style="font-size:11px">${s.market.length}</span></button>
        ${cardHtml(t)}
        ${s.called ? `<div style="color:#fde68a;font-weight:800;font-size:13px">Called:<br><span style="font-size:24px">${SHAPE_ICON[s.called]}</span></div>` : ''}
      </div>
    </div>
    <div class="gm-say" id="whot-status">${esc(s.winner !== null ? (s.winner === 0 ? '🎉 Check up! You win!' : `${s.names[s.winner]} wins.`) : s.said)}</div>
    ${gameSession.calling ? `<div style="text-align:center;font-weight:800">Call a shape</div><div class="gm-shapes">${SHAPES.map((sh) => `<button data-act="whot-call" data-shape="${sh}">${SHAPE_ICON[sh]}</button>`).join('')}</div>` : ''}
    <div class="gm-hand" id="whot-hand">${s.hands[0].map((c) => cardHtml(c, { act: true, can: mine && canPlay(s, c), off: mine && !canPlay(s, c) })).join('')}</div>
    ${s.winner !== null ? `<button class="nl-btn nl-btn--primary nl-btn--block" data-act="whot-new">Deal again</button>` : mine ? '<div class="nl-hint">Tap a card that matches the shape or the number, or go to market.</div>' : ''}`;
}

function whotBots(host: PhoneHost): void {
  const s = gameSession.whot;
  if (!s || s.winner !== null || s.turn === 0) return;
  gameSession.busy = true;
  setTimeout(() => {
    const now = gameSession.whot;
    if (!now || now.winner !== null || now.turn === 0) { gameSession.busy = false; return; }
    gameSession.whot = botTurn(now);
    gameSession.busy = false;
    if (gameSession.whot.winner !== null) settle(host, 'whot', gameSession.whot.winner === 0);
    host.refresh();
    whotBots(host);
  }, 1000);
}

export const gamesApp: PhoneApp = {
  id: 'games',
  name: 'Naija Games',
  icon: '🎲',
  tint: ['#7f1d1d', '#f59e0b'],
  purpose: 'Ayo and Whot, for fun or for money',

  render(_host, route) {
    if (route === 'ayo' && gameSession.ayo) return { title: 'Ayo', body: ayoScreen() };
    if (route === 'whot' && gameSession.whot) return { title: 'Whot', body: whotScreen() };
    const r = record();
    return {
      title: 'Naija Games',
      body: `${style()}
        <div class="nl-hero nl-hero--amber"><div class="nl-hero-label">Your record</div><div class="nl-hero-value">${r.ayo[0] + r.whot[0]} wins</div><div class="nl-hero-sub">Ayo ${r.ayo[0]}–${r.ayo[1]} · Whot ${r.whot[0]}–${r.whot[1]}</div></div>
        <div class="nl-section">Stake</div>
        ${stakeChips()}
        <div class="nl-hint">The stake goes into the pot; the winner takes all of it.</div>
        <div class="nl-section">Play</div>
        <div class="nl-list">
          <button class="nl-row" data-act="ayo-new"><span class="nl-row-icon">🌰</span><span class="nl-row-text"><span class="nl-row-title">Ayo</span><span class="nl-row-sub">Against Mama Ronke, the best board on the street · pot ${naira(gameSession.stake * 2)}</span></span><span class="nl-row-trail">›</span></button>
          <button class="nl-row" data-act="whot-new"><span class="nl-row-icon">🃏</span><span class="nl-row-text"><span class="nl-row-title">Whot</span><span class="nl-row-sub">Four at the table: you, Chinedu, Aisha and Baba Tunde · pot ${naira(gameSession.stake * 4)}</span></span><span class="nl-row-trail">›</span></button>
        </div>`,
    };
  },

  act(host, action, el) {
    if (action === 'stake') {
      gameSession.stake = parseInt(el.dataset.stake ?? '0', 10) || 0;
      host.refresh();
    } else if (action === 'ayo-new') {
      if (!takeStake(host, 'Ayo')) return;
      gameSession.ayo = newAyo(Math.random() < 0.5 ? 0 : 1);
      gameSession.paid = false;
      gameSession.busy = false;
      host.go('ayo');
      ayoBot(host);
    } else if (action === 'ayo-pit') {
      const s = gameSession.ayo;
      if (!s || gameSession.busy) return;
      const next = playAyo(s, parseInt(el.dataset.pit ?? '-1', 10));
      if (!next) return;
      gameSession.ayo = next;
      if (next.over) settle(host, 'ayo', next.winner === 0, next.winner === 'draw');
      host.refresh();
      ayoBot(host);
    } else if (action === 'whot-new') {
      if (!takeStake(host, 'Whot')) return;
      gameSession.whot = newWhot(WHOT_NAMES);
      gameSession.paid = false;
      gameSession.busy = false;
      gameSession.calling = null;
      host.go('whot');
    } else if (action === 'whot-card') {
      const s = gameSession.whot;
      if (!s || s.turn !== 0 || gameSession.busy) return;
      const card = s.hands[0].find((c) => c.id === el.dataset.card);
      if (!card || !canPlay(s, card)) return;
      if (card.shape === 'whot' && s.hands[0].length > 1) {
        gameSession.calling = card.id;
        host.refresh();
        return;
      }
      gameSession.whot = playCard(s, card.id, 'circle') ?? s;
      if (gameSession.whot.winner !== null) settle(host, 'whot', gameSession.whot.winner === 0);
      host.refresh();
      whotBots(host);
    } else if (action === 'whot-call') {
      const s = gameSession.whot;
      if (!s || !gameSession.calling) return;
      gameSession.whot = playCard(s, gameSession.calling, el.dataset.shape as Shape) ?? s;
      gameSession.calling = null;
      host.refresh();
      whotBots(host);
    } else if (action === 'whot-market') {
      const s = gameSession.whot;
      if (!s || s.turn !== 0 || gameSession.busy) return;
      gameSession.whot = goToMarket(s);
      host.refresh();
      whotBots(host);
    }
  },
};
