import type { PhoneApp, PhoneHost } from '../PhoneApp';
import { esc, naira } from '../../ui/kit/html';
import { OnlineAccount } from '../../online/OnlineAccount';
import { Racing, raceTime } from '../../racing/Racing';
import { STAKES, courseById, grid, medalTimes, medalFor, raceLength, rivalsFor, type Course, type Stake } from '../../racing/RaceRules';

/**
 * Racing: the courses in the city, each raced on the real road. A time trial against the clock,
 * or a race against the street racers for glory or for a stake (the bigger the stake, the faster
 * the cars that turn up). Your best on each course with its medal, and online the fastest players.
 */

const CSS = `
.nl-hero.rc-hero{background:linear-gradient(150deg,#0b1220 0%,#7f1d1d 58%,#111827 100%)}
.rc-card{background:var(--lx-surface-solid,#fff);border-radius:20px;padding:14px;margin:10px 0;box-shadow:var(--lx-shadow-sm,0 4px 12px rgba(0,0,0,.08));border:1px solid var(--lx-line,rgba(0,0,0,.06))}
.rc-top{display:flex;gap:10px;align-items:flex-start}
.rc-flag{flex:0 0 44px;height:44px;border-radius:14px;display:grid;place-items:center;font-size:22px;background:linear-gradient(160deg,#111827,#374151);color:#fff}
.rc-name{display:block;font:900 15px/1.2 var(--lx-font,system-ui);color:var(--lx-ink,#0f172a)}
.rc-blurb{display:block;margin-top:3px;font:600 12px/1.35 var(--lx-font,system-ui);color:var(--lx-dim,#64748b)}
.rc-facts{display:flex;flex-wrap:wrap;gap:6px;margin:10px 0 8px}
.rc-fact{border-radius:999px;padding:5px 10px;font:800 11px/1 var(--lx-font,system-ui);background:var(--lx-surface-2,#f1f5f9);color:var(--lx-ink,#0f172a)}
.rc-fact.is-gold{background:#fef3c7;color:#92400e}
.rc-row{display:flex;gap:8px;margin-top:8px}
.rc-row .nl-btn{flex:1}
.rc-stakes{display:flex;gap:6px;flex-wrap:wrap;margin:12px 0 2px}
.rc-stakes button{border:1px solid var(--lx-line,rgba(0,0,0,.1));background:var(--lx-surface-2,#f8fafc);border-radius:12px;padding:8px 10px;font:800 12px/1 var(--lx-font,system-ui);color:var(--lx-ink,#0f172a);cursor:pointer}
.rc-stakes button.is-on{background:#111827;color:#fff;border-color:#111827}
.rc-who{font:700 11.5px/1.4 var(--lx-font,system-ui);color:var(--lx-dim,#64748b);margin-top:6px}
.rc-board{list-style:none;margin:8px 0 0;padding:0}
.rc-board li{display:flex;align-items:center;gap:10px;padding:9px 4px;border-bottom:1px solid var(--lx-line,rgba(0,0,0,.06));font:700 13px/1.2 var(--lx-font,system-ui);color:var(--lx-ink,#0f172a)}
.rc-board li b{margin-left:auto;font-variant-numeric:tabular-nums}
.rc-board li.is-me{background:#ecfdf5;border-radius:10px}
.rc-rank{flex:0 0 24px;text-align:center;font:900 13px/1 var(--lx-font,system-ui);color:var(--lx-dim,#64748b)}
`;
let styled = false;
const style = () => {
  if (styled) return;
  styled = true;
  const el = document.createElement('style');
  el.textContent = CSS;
  document.head.appendChild(el);
};

const medalIcon = (m: string | null) => (m === 'gold' ? '🥇' : m === 'silver' ? '🥈' : m === 'bronze' ? '🥉' : '');
const km = (c: Course) => `${(raceLength(c) / 1000).toFixed(raceLength(c) < 1000 ? 2 : 1)} km`;
const cityOf = (id: string) => (id === 'abuja' ? 'Abuja' : id === 'port_harcourt' ? 'Port Harcourt' : 'Lagos');

// The fastest players on each course, fetched when the board is opened
const boards = new Map<string, { at: number; top: Array<{ name: string; ms: number; car: string; mine: boolean }>; rank: number | null; best: number | null }>();
async function fetchBoard(host: PhoneHost, course: string): Promise<void> {
  const online = OnlineAccount.get();
  if (!online) return;
  const was = boards.get(course);
  if (was && Date.now() - was.at < 15_000) return;
  boards.set(course, { at: Date.now(), top: was?.top ?? [], rank: was?.rank ?? null, best: was?.best ?? null });
  const got = await online.request(`/races/board?course=${encodeURIComponent(course)}`).catch(() => null);
  if (got?.ok) boards.set(course, { at: Date.now(), top: got.top ?? [], rank: got.rank ?? null, best: got.best ?? null });
  host.refresh();
}

export const racingApp: PhoneApp = {
  id: 'racing',
  aliases: ['race', 'races'],
  name: 'Racing',
  icon: '🏁',
  tint: ['#111827', '#ef4444'],
  purpose: 'Race the long roads: time trials, street racers, stakes and the fastest board',
  live: () => Racing.get().active,

  render(host, route) {
    style();
    const racing = Racing.get();
    if (route.startsWith('board:')) {
      const course = courseById(route.slice(6));
      if (!course) return { title: 'Racing', body: '' };
      const online = !!OnlineAccount.get();
      if (online) void fetchBoard(host, course.id);
      const board = boards.get(course.id);
      const mine = racing.bests()[course.id];
      const m = medalTimes(course);
      return {
        title: course.name,
        body: `
          <div class="rc-card">
            <span class="rc-name">${esc(course.name)}</span><span class="rc-blurb">${esc(course.blurb)}</span>
            <div class="rc-facts"><span class="rc-fact">🥇 ${raceTime(m.gold)}</span><span class="rc-fact">🥈 ${raceTime(m.silver)}</span><span class="rc-fact">🥉 ${raceTime(m.bronze)}</span></div>
            <div class="rc-who">${mine ? `Your best: <b>${raceTime(mine.seconds)}</b> ${medalIcon(medalFor(course, mine.seconds))} in ${esc(mine.car)}` : 'You have not raced it yet.'}</div>
          </div>
          <div class="rc-card">
            <span class="rc-name">🏆 Fastest players</span>
            ${online
              ? board && board.top.length
                ? `<ol class="rc-board">${board.top.map((r, i) => `<li class="${r.mine ? 'is-me' : ''}"><span class="rc-rank">${i + 1}</span><span>@${esc(r.name)}<small style="display:block;font-weight:600;color:#64748b">${esc(r.car)}</small></span><b>${raceTime(r.ms / 1000)}</b></li>`).join('')}</ol>${board.rank && board.rank > board.top.length ? `<div class="rc-who">You are ${board.rank}${board.rank % 10 === 1 ? 'st' : board.rank % 10 === 2 ? 'nd' : board.rank % 10 === 3 ? 'rd' : 'th'} on this course.</div>` : ''}`
                : '<div class="rc-who">No one has a time here yet. Be the first on the board.</div>'
              : '<div class="rc-who">Play online to see the fastest players and put your times on the board.</div>'}
          </div>`,
      };
    }

    const city = host.world.cityId();
    const here = racing.coursesIn(city);
    const elsewhere = ['lagos', 'abuja', 'port_harcourt'].filter((c) => c !== city).flatMap((c) => racing.coursesIn(c));
    const stake = Number(host.get('racing.stake', 0)) as Stake;
    const bests = racing.bests();
    const now = racing.view();
    const card = (c: Course, playable: boolean) => {
      const mine = bests[c.id];
      const field = grid(c).rivals.length;
      return `
        <div class="rc-card" data-course="${c.id}">
          <div class="rc-top"><span class="rc-flag">${c.kind === 'circuit' ? '🔁' : c.kind === 'drag' ? '⚡' : '🏁'}</span>
            <span><span class="rc-name">${esc(c.name)}</span><span class="rc-blurb">${esc(c.blurb)}</span></span></div>
          <div class="rc-facts"><span class="rc-fact">${km(c)}</span>${c.laps > 1 ? `<span class="rc-fact">${c.laps} laps</span>` : ''}<span class="rc-fact">${field + 1} on the grid</span>${mine ? `<span class="rc-fact is-gold">Best ${raceTime(mine.seconds)} ${medalIcon(medalFor(c, mine.seconds))}</span>` : ''}</div>
          ${playable
            ? `<div class="rc-row"><button class="nl-btn nl-btn--sm" data-act="trial" data-arg="${c.id}">⏱ Time trial</button><button class="nl-btn nl-btn--primary nl-btn--sm" data-act="race" data-arg="${c.id}">🏁 Race · ${stake ? naira(stake) : 'for glory'}</button></div>
               <div class="rc-row"><button class="nl-btn nl-btn--sm" data-act="board" data-arg="${c.id}">🏆 Fastest times</button></div>`
            : `<div class="rc-who">Raced in ${cityOf(c.city)}: fly or take a coach there.</div>`}
        </div>`;
    };
    const racers = rivalsFor(stake);
    return {
      title: 'Racing',
      body: `
        <div class="nl-hero rc-hero">
          <span class="nl-hero-label">${esc(cityOf(city))} street racing</span>
          <span class="nl-hero-title">Race the long roads</span>
          <span class="nl-hero-sub">Drive your own car to the grid, stop in the box, wait for the lights. Every checkpoint, through the traffic, to the flag.</span>
        </div>
        ${now.course && now.phase !== 'idle' && now.phase !== 'done' ? `
          <div class="rc-card"><span class="rc-name">🚦 ${esc(now.course.name)}</span>
            <span class="rc-blurb">${now.phase === 'going' ? 'On your way to the start.' : now.phase === 'grid' ? 'At the start: stop in the box and press Start.' : now.phase === 'countdown' ? 'The lights are on.' : `Racing: ${raceTime(now.time)}`}</span>
            <div class="rc-row"><button class="nl-btn nl-btn--sm" data-act="quit">Give it up</button></div></div>` : ''}
        <div class="rc-card">
          <span class="rc-name">The stake</span>
          <span class="rc-blurb">Everyone on the grid puts it in; the winner takes the pot, less a tenth. The more money, the faster the cars that turn up.</span>
          <div class="rc-stakes">${STAKES.map((s) => `<button data-act="stake" data-arg="${s}" class="${s === stake ? 'is-on' : ''}">${s ? naira(s) : 'For glory'}</button>`).join('')}</div>
          <div class="rc-who">On the grid: ${racers.map((r) => esc(r.name)).join(', ')}</div>
        </div>
        ${here.length ? here.map((c) => card(c, true)).join('') : `<div class="rc-card"><span class="rc-blurb">No races in ${esc(cityOf(city))} yet.</span></div>`}
        ${elsewhere.length ? `<div class="rc-who" style="margin:16px 4px 0">In other cities</div>${elsewhere.map((c) => card(c, false)).join('')}` : ''}`,
    };
  },

  act(host, action, el) {
    const racing = Racing.get();
    const arg = el.dataset.arg ?? '';
    if (action === 'stake') return host.set('racing.stake', Number(arg));
    if (action === 'board') return host.go(`board:${arg}`);
    if (action === 'quit') {
      racing.giveUp();
      return host.refresh();
    }
    if (action === 'trial' || action === 'race') {
      const stake = (action === 'race' ? Number(host.get('racing.stake', 0)) : 0) as Stake;
      if (!host.world.canDrive()) return host.say('You need a car of your own to race. Buy one in the Garage app.', 'bad');
      const why = racing.begin(arg, action, stake);
      if (why) return host.say(why, 'bad');
      host.close();
    }
  },
};
