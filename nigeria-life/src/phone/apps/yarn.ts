import type { PhoneApp, PhoneHost } from '../PhoneApp';
import { esc, empty } from '../../ui/kit/html';
import { OnlineAccount } from '../../online/OnlineAccount';
import { Activity } from '../../life/Activity';
import { Bets } from '../../sport/Bets';
import { Adverts } from '../../business/Adverts';
import { RichList, short } from '../../life/RichList';
import { fixture } from '../../sport/League';

/**
 * Yarn: what Lagos is saying. Post a line for the city to read, like what others post, and
 * share what you have done with one tap (a win on Naija Odds, your billboard, your place on the
 * Rich List, where you are). Online every player reads the same feed; alone, the city's
 * regulars keep it busy.
 */

interface Post { id: string; by: string; text: string; at: number; likes: number; liked: boolean; mine: boolean; npc?: boolean }

const CSS = `
.yn-compose{background:var(--lx-surface-solid,#fff);border-radius:20px;padding:12px;box-shadow:var(--lx-shadow-sm,0 4px 12px rgba(0,0,0,.08));border:1px solid var(--lx-line,rgba(0,0,0,.06))}
.yn-compose textarea{width:100%;box-sizing:border-box;min-height:70px;resize:none;border:0;outline:0;background:var(--lx-surface-2,#f8fafc);border-radius:14px;padding:10px 12px;font:600 14px/1.4 var(--lx-font,system-ui);color:var(--lx-ink,#0f172a)}
.yn-bar{display:flex;align-items:center;justify-content:space-between;margin-top:8px;gap:8px}
.yn-count{font:700 11px/1 var(--lx-font,system-ui);color:var(--lx-dim,#64748b)}
.yn-quick{display:flex;gap:6px;overflow-x:auto;margin:10px 0 2px;scrollbar-width:none}
.yn-quick button{flex:0 0 auto;border:1px solid var(--lx-line,rgba(0,0,0,.1));background:var(--lx-surface-2,#f8fafc);border-radius:999px;padding:7px 11px;font:700 12px/1 var(--lx-font,system-ui);color:var(--lx-ink,#0f172a);cursor:pointer}
.yn-post{display:flex;gap:10px;background:var(--lx-surface-solid,#fff);border-radius:18px;padding:12px;margin:9px 0;box-shadow:var(--lx-shadow-sm,0 4px 12px rgba(0,0,0,.06));border:1px solid var(--lx-line,rgba(0,0,0,.05))}
.yn-av{width:38px;height:38px;border-radius:50%;flex:0 0 auto;display:grid;place-items:center;font:900 15px/1 var(--lx-font,system-ui);color:#fff;box-shadow:inset 0 0 0 2px rgba(255,255,255,.5)}
.yn-body{flex:1;min-width:0;display:block}
.yn-head{display:flex;align-items:baseline;gap:6px;font:800 13px/1.2 var(--lx-font,system-ui);color:var(--lx-ink,#0f172a)}
.yn-head small{font:600 11px/1 var(--lx-font,system-ui);color:var(--lx-dim,#64748b)}
.yn-text{display:block;margin-top:4px;font:500 14px/1.45 var(--lx-font,system-ui);color:var(--lx-ink,#0f172a);word-wrap:break-word;white-space:pre-wrap}
.yn-acts{display:flex;gap:14px;margin-top:8px}
.yn-like{border:0;background:none;padding:0;font:800 12.5px/1 var(--lx-font,system-ui);color:var(--lx-dim,#64748b);cursor:pointer}
.yn-like.is-on{color:#e11d48}
.yn-del{border:0;background:none;padding:0;font:700 11.5px/1 var(--lx-font,system-ui);color:var(--lx-dim,#94a3b8);cursor:pointer}
`;
let styled = false;
const style = () => {
  if (styled) return;
  styled = true;
  const el = document.createElement('style');
  el.textContent = CSS;
  document.head.appendChild(el);
};

const REGULARS: Array<[string, string]> = [
  ['mama_put_eko', 'Party jollof is ready o! Broad Street, come before it finish 🍛'],
  ['segun_odds', 'Eko United at 2.4? Free money. Don’t say I didn’t tell you ⚽'],
  ['danfo_driver_ade', 'Third Mainland is moving today. Who did this miracle? 🙏'],
  ['zay_ne', 'New hair, new energy. Quilox tonight, who’s coming? 💃'],
  ['nepa_watch', 'Light don come for Surulere!!! Charge everything NOW ⚡'],
  ['lekki_landlord', 'Two-bedroom in Lekki Phase 1 just freed up. Serious people only.'],
  ['tech_bro_yaba', 'Shipped the app at 3am. Generator ran out at 3:05. Lagos life 😂'],
  ['iya_basira', 'Fresh Ankara landed at Balogun. Owambe season, I see you 👗'],
  ['okada_king', 'Ojota to Ikeja in 12 minutes. Don’t ask me how 🏍️'],
  ['pastor_femi', 'Midweek service at Faith Arena by 6. Come and be blessed 🙌'],
  ['amala_lover', 'Amala Shitta queue is long but the gbegiri is worth it'],
  ['gist_hunter', 'Who was in the G-Wagon at Sankofa Motors this morning? Talk to me 👀'],
  ['fitfam_lagos', '5am at i-Fitness Lekki. Sapa can’t stop the gains 💪'],
  ['bukola_bakes', 'Taking cake orders for the weekend. DM me 🎂'],
  ['oshodi_conductor', 'Oshodi! Oshodi! Enter with your change o!'],
  ['rooftop_vibes', 'Ivory Rooftop sunset set was madness last night 🌇'],
  ['naija_foodie', 'Suya on Allen Avenue hits different after 10pm'],
  ['real_estate_ray', 'Banana Island plots are going. If you know, you know 🏝️'],
  ['shrine_regular', 'Thursday jam at the Shrine. The horns, my people, the horns 🎷'],
  ['traffic_report', 'Ikorodu Road is bumper to bumper by the airport turn. Plan well'],
];

const COLOURS = ['#0b7a43', '#1d4ed8', '#b91c1c', '#7c3aed', '#c2410c', '#0f766e', '#be185d', '#a16207'];
const colourOf = (name: string) => COLOURS[[...name].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7) % COLOURS.length];

const ago = (at: number) => {
  const s = Math.max(1, Math.floor((Date.now() - at) / 1000));
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86400)}d`;
};

/** The regulars' posts: a few new ones every hour, the same for everyone at the same hour */
function regulars(): Post[] {
  const hour = Math.floor(Date.now() / 3_600_000);
  const out: Post[] = [];
  for (let k = 0; k < 10; k++) {
    const i = (hour * 7 + k * 3) % REGULARS.length;
    const [by, text] = REGULARS[i];
    out.push({ id: `npc-${hour}-${k}`, by, text, at: hour * 3_600_000 - k * 1_260_000 + ((i * 97_000) % 1_200_000), likes: (i * 13 + hour) % 40, liked: false, mine: false, npc: true });
  }
  return out;
}

// --- Playing alone: the player's posts and likes kept on this device ------------------------
const key = () => `nl_yarn_v1:${Activity.player()}`;
function loadLocal(): { posts: Post[]; liked: string[] } {
  try {
    const raw = localStorage.getItem(key());
    if (raw) return JSON.parse(raw);
  } catch { /* fresh */ }
  return { posts: [], liked: [] };
}
function saveLocal(state: { posts: Post[]; liked: string[] }): void {
  try { localStorage.setItem(key(), JSON.stringify({ posts: state.posts.slice(0, 80), liked: state.liked.slice(-200) })); } catch { /* blocked */ }
}

// --- Online: the shared feed --------------------------------------------------------------
let remote: Post[] | null = null;
let fetchedAt = 0;
let fetching = false;
async function load(host: PhoneHost, force = false): Promise<void> {
  const online = OnlineAccount.get();
  if (!online || fetching || (!force && Date.now() - fetchedAt < 6000)) return;
  fetching = true;
  try {
    const got = await online.request('/feed');
    if (got?.ok) {
      remote = got.posts ?? [];
      fetchedAt = Date.now();
    }
  } finally {
    fetching = false;
  }
  host.refresh();
}

function feed(host: PhoneHost): Post[] {
  const local = loadLocal();
  // The regulars' posts, with this player's likes on them
  const npc = regulars().map((p) => ({ ...p, liked: local.liked.includes(p.id), likes: p.likes + (local.liked.includes(p.id) ? 1 : 0) }));
  if (OnlineAccount.get()) {
    void load(host);
    const real = remote ?? [];
    return real.length >= 8 ? real : [...real, ...npc].sort((a, b) => b.at - a.at);
  }
  return [...local.posts, ...npc].sort((a, b) => b.at - a.at);
}

/** One-tap things to share: what the player has done lately */
function shares(host: PhoneHost): Array<[string, string]> {
  const out: Array<[string, string]> = [];
  const win = Bets.get().mine().find((b) => b.status === 'won');
  if (win) {
    const f = fixture(win.slot);
    out.push(['⚽ My win', `Called it! ${f.home.name} ${win.score?.[0]}-${win.score?.[1]} ${f.away.name}. Naija Odds paid me ₦${Math.floor(win.stake * win.price).toLocaleString()} ⚽💰`]);
  }
  const ad = Adverts.get().mine()[0];
  if (ad) out.push(['📢 My billboard', `My billboard is up on the expressway: "${ad.headline}". Drive past and see am 📢`]);
  const s = RichList.standing();
  out.push(['👑 My rank', `#${s.rank} on the Naija Rich List at ${short(RichList.total())}. ${s.above ? `${s.above.name}, I’m coming for you 👑` : 'Top of Lagos 👑'}`]);
  const where = host.world.placeName();
  if (where) out.push(['📍 Where I am', `Chilling at ${where} 📍`]);
  return out;
}

export const yarnApp: PhoneApp = {
  id: 'yarn',
  aliases: ['spaces', 'feed', 'social'],
  name: 'Yarn',
  icon: '🗣️',
  tint: ['#0f766e', '#2dd4bf'],
  purpose: 'What Lagos is saying: post, like, and show off what you did',
  live: () => !!OnlineAccount.get(),

  render(host) {
    style();
    const me = host.backend.getData().username || 'you';
    const text = String(host.get('yarn.text', ''));
    const posts = feed(host);
    return {
      title: 'Yarn',
      body: `
        <div class="yn-compose" id="yarn-compose">
          <textarea id="yarn-text" maxlength="280" placeholder="What’s the gist, @${esc(me)}?" data-bind="yarn.text" data-live>${esc(text)}</textarea>
          <div class="yn-quick">${shares(host).map(([label, line], i) => `<button data-act="share" data-arg="${i}" data-line="${esc(line)}">${esc(label)}</button>`).join('')}</div>
          <div class="yn-bar"><span class="yn-count">${text.length}/280 · ${OnlineAccount.get() ? 'everyone in Lagos sees it' : 'playing alone: the city’s regulars read it'}</span>
            <button class="nl-btn nl-btn--primary nl-btn--sm" id="yarn-post" data-act="post" ${text.trim().length < 2 ? 'disabled' : ''}>Post</button></div>
        </div>
        <div id="yarn-feed">${posts.length ? posts.map((p) => `
          <div class="yn-post" data-post="${esc(p.id)}"${p.mine ? ' data-mine="1"' : ''}>
            <span class="yn-av" style="background:${colourOf(p.by)}">${esc(p.by.replace(/^@/, '').charAt(0).toUpperCase())}</span>
            <span class="yn-body">
              <span class="yn-head">@${esc(p.by)}<small>· ${ago(p.at)}</small></span>
              <span class="yn-text">${esc(p.text)}</span>
              <span class="yn-acts">
                <button class="yn-like${p.liked ? ' is-on' : ''}" data-act="like" data-arg="${esc(p.id)}">${p.liked ? '❤️' : '🤍'} ${p.likes}</button>
                ${p.mine ? `<button class="yn-del" data-act="remove" data-arg="${esc(p.id)}">Delete</button>` : ''}
              </span>
            </span>
          </div>`).join('') : empty('🗣️', 'Quiet for now', 'Be the first to say something.')}</div>`,
    };
  },

  async act(host, action, el) {
    const online = OnlineAccount.get();
    const id = el.dataset.arg ?? '';
    if (action === 'share') {
      host.set('yarn.text', el.dataset.line ?? '');
      return;
    }
    if (action === 'post') {
      const text = String(host.get('yarn.text', '')).replace(/\s+/g, ' ').trim().slice(0, 280);
      if (text.length < 2) return;
      if (online) {
        const done = await online.request('/feed/post', { text });
        if (!done?.ok) return host.say(done?.reason ?? 'That did not post.', 'bad');
        await load(host, true);
      } else {
        const local = loadLocal();
        local.posts.unshift({ id: `mine-${Date.now().toString(36)}`, by: host.backend.getData().username || 'you', text, at: Date.now(), likes: 0, liked: false, mine: true });
        saveLocal(local);
      }
      host.set('yarn.text', '');
      host.say('Posted. 🗣️', 'good');
      // A post is a message: it counts toward the day's "Gist" hustle
      Activity.emit({ kind: 'chat' });
      return;
    }
    if (action === 'like') {
      if (online && !id.startsWith('npc-')) {
        const done = await online.request('/feed/like', { id });
        if (!done?.ok) return host.say(done?.reason ?? 'That did not work.', 'bad');
        await load(host, true);
        return;
      }
      const local = loadLocal();
      const mine = local.posts.find((p) => p.id === id);
      if (mine) {
        mine.liked = !mine.liked;
        mine.likes += mine.liked ? 1 : -1;
      } else if (local.liked.includes(id)) local.liked = local.liked.filter((x) => x !== id);
      else local.liked.push(id);
      saveLocal(local);
      return;
    }
    if (action === 'remove') {
      if (online) {
        await online.request('/feed/remove', { id });
        await load(host, true);
        return;
      }
      const local = loadLocal();
      local.posts = local.posts.filter((p) => p.id !== id);
      saveLocal(local);
    }
  },
};
