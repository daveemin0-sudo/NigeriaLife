import type { PhoneApp, PhoneHost } from '../PhoneApp';
import { esc, empty } from '../../ui/kit/html';
import { OnlineAccount } from '../../online/OnlineAccount';
import { profileKey } from '../../backend/Profile';

/**
 * Ideas: tell the makers what to build next. Write an idea, a wish or a bug; vote for the ones you
 * want too; see which are planned, being built and done. Online every player sees and votes on the
 * same list, and the makers mark them from the admin page. Alone, your own ideas are kept here
 * and go up the moment you play online.
 */

interface Idea { id: string; by: string; text: string; kind: string; at: number; votes: number; voted: boolean; status: string; mine: boolean; sent?: boolean }

const KINDS: Array<[string, string, string]> = [['idea', '💡', 'Idea'], ['wish', '✨', 'Wish'], ['bug', '🐞', 'Something broken']];
const STATUS: Record<string, [string, string]> = {
  new: ['New', '#64748b'],
  planned: ['Planned', '#2563eb'],
  building: ['Being built', '#d97706'],
  done: ['Done ✓', '#16a34a'],
  'not now': ['Not now', '#94a3b8'],
};

const CSS = `
.id-compose{background:var(--lx-surface-solid,#fff);border-radius:20px;padding:12px;box-shadow:var(--lx-shadow-sm,0 4px 12px rgba(0,0,0,.08));border:1px solid var(--lx-line,rgba(0,0,0,.06))}
.id-kinds{display:flex;gap:6px;margin-bottom:8px}
.id-kinds button{flex:1;border:1px solid var(--lx-line,rgba(0,0,0,.1));background:var(--lx-surface-2,#f8fafc);border-radius:12px;padding:8px 6px;font:800 12px/1.1 var(--lx-font,system-ui);color:var(--lx-ink,#0f172a);cursor:pointer}
.id-kinds button.is-on{background:#0b7a43;color:#fff;border-color:#0b7a43}
.id-compose textarea{width:100%;box-sizing:border-box;min-height:84px;resize:none;border:0;outline:0;background:var(--lx-surface-2,#f8fafc);border-radius:14px;padding:10px 12px;font:600 14px/1.4 var(--lx-font,system-ui);color:var(--lx-ink,#0f172a)}
.id-bar{display:flex;align-items:center;justify-content:space-between;margin-top:8px;gap:8px}
.id-count{font:700 11px/1.3 var(--lx-font,system-ui);color:var(--lx-dim,#64748b)}
.id-tabs{display:flex;gap:6px;margin:12px 0 4px}
.id-tabs button{border:0;border-radius:999px;padding:7px 14px;font:800 12px/1 var(--lx-font,system-ui);background:var(--lx-surface-2,#eef2f7);color:var(--lx-ink,#0f172a);cursor:pointer}
.id-tabs button.is-on{background:var(--lx-ink,#0f172a);color:#fff}
.id-item{display:flex;gap:10px;background:var(--lx-surface-solid,#fff);border-radius:18px;padding:12px;margin:9px 0;box-shadow:var(--lx-shadow-sm,0 4px 12px rgba(0,0,0,.06));border:1px solid var(--lx-line,rgba(0,0,0,.05))}
.id-vote{flex:0 0 52px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;border:1px solid var(--lx-line,rgba(0,0,0,.1));border-radius:14px;background:var(--lx-surface-2,#f8fafc);font:900 16px/1 var(--lx-font,system-ui);color:var(--lx-ink,#0f172a);cursor:pointer;padding:6px 0}
.id-vote small{font:800 9.5px/1 var(--lx-font,system-ui);color:var(--lx-dim,#64748b)}
.id-vote.is-on{background:#0b7a43;color:#fff;border-color:#0b7a43}
.id-vote.is-on small{color:#d1fae5}
.id-body{flex:1;min-width:0;display:block}
.id-head{display:flex;align-items:center;gap:6px;flex-wrap:wrap;font:800 12px/1.2 var(--lx-font,system-ui);color:var(--lx-dim,#64748b)}
.id-badge{border-radius:999px;padding:3px 8px;font:800 10.5px/1 var(--lx-font,system-ui);color:#fff}
.id-text{display:block;margin-top:5px;font:600 14px/1.45 var(--lx-font,system-ui);color:var(--lx-ink,#0f172a);word-wrap:break-word;white-space:pre-wrap}
`;
let styled = false;
const style = () => {
  if (styled) return;
  styled = true;
  const el = document.createElement('style');
  el.textContent = CSS;
  document.head.appendChild(el);
};

const ago = (at: number) => {
  const s = Math.max(1, Math.floor((Date.now() - at) / 1000));
  if (s < 3600) return `${Math.max(1, Math.floor(s / 60))}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86400)}d`;
};

// --- Alone: the player's own ideas, kept until they can be sent -----------------------------
const key = () => profileKey('nl_ideas_v1');
function loadLocal(): Idea[] {
  try {
    const raw = JSON.parse(localStorage.getItem(key()) || '[]');
    return Array.isArray(raw) ? raw : [];
  } catch {
    return [];
  }
}
function saveLocal(list: Idea[]): void {
  try { localStorage.setItem(key(), JSON.stringify(list.slice(0, 60))); } catch { /* blocked */ }
}

// --- Online: everyone's ideas ---------------------------------------------------------------
let remote: { top: Idea[] | null; new: Idea[] | null } = { top: null, new: null };
let fetchedAt = { top: 0, new: 0 };
let fetching = false;
async function load(host: PhoneHost, order: 'top' | 'new', force = false): Promise<void> {
  const online = OnlineAccount.get();
  if (!online || fetching || (!force && Date.now() - fetchedAt[order] < 8000)) return;
  fetching = true;
  try {
    // Anything written while playing alone goes up first
    const waiting = loadLocal().filter((i) => !i.sent);
    for (const idea of waiting) {
      const sent = await online.request('/ideas/post', { text: idea.text, kind: idea.kind });
      if (sent?.ok) idea.sent = true;
      else break;
    }
    if (waiting.length) saveLocal(loadLocal().map((i) => (waiting.find((w) => w.id === i.id && w.sent) ? { ...i, sent: true } : i)));
    const got = await online.request(`/ideas?order=${order}`);
    if (got?.ok) {
      remote = { ...remote, [order]: got.ideas ?? [] };
      fetchedAt = { ...fetchedAt, [order]: Date.now() };
    }
  } finally {
    fetching = false;
  }
  host.refresh();
}

function list(host: PhoneHost, order: 'top' | 'new'): Idea[] {
  if (OnlineAccount.get()) {
    void load(host, order);
    return remote[order] ?? [];
  }
  const own = loadLocal();
  return order === 'new' ? own : [...own].sort((a, b) => b.votes - a.votes || b.at - a.at);
}

export const ideasApp: PhoneApp = {
  id: 'ideas',
  aliases: ['idea', 'suggest', 'feedback'],
  name: 'Ideas',
  icon: '💡',
  tint: ['#ca8a04', '#fde047'],
  purpose: 'Tell the makers what to build next, and vote for what others want',
  live: () => !!OnlineAccount.get(),

  render(host) {
    style();
    const text = String(host.get('ideas.text', ''));
    const kind = String(host.get('ideas.kind', 'idea'));
    const order = host.get<string>('ideas.order', 'top') === 'new' ? 'new' : 'top';
    const items = list(host, order);
    const online = !!OnlineAccount.get();
    return {
      title: 'Ideas',
      body: `
        <div class="nl-hero nl-hero--green">
          <span class="nl-hero-label">Build Nigeria Life with us</span>
          <span class="nl-hero-title">What should we add next?</span>
          <span class="nl-hero-sub">Every idea is read. The most wanted get built first: you will see them marked planned, being built and done.</span>
        </div>
        <div class="id-compose" id="ideas-compose">
          <div class="id-kinds">${KINDS.map(([k, icon, label]) => `<button data-act="kind" data-arg="${k}" class="${k === kind ? 'is-on' : ''}">${icon} ${label}</button>`).join('')}</div>
          <textarea id="ideas-text" maxlength="400" placeholder="${kind === 'bug' ? 'What went wrong, and where? (e.g. the lift at Eko Grand will not go up)' : 'Your idea: a place, a job, a feature, anything that would make the game better'}" data-bind="ideas.text" data-live>${esc(text)}</textarea>
          <div class="id-bar"><span class="id-count">${text.length}/400 · ${online ? 'every player can vote for it' : 'kept here; sent the moment you play online'}</span>
            <button class="nl-btn nl-btn--primary nl-btn--sm" id="ideas-send" data-act="send" ${text.trim().length < 8 ? 'disabled' : ''}>Send</button></div>
        </div>
        <div class="id-tabs">
          <button data-act="order" data-arg="top" class="${order === 'top' ? 'is-on' : ''}">🔥 Most wanted</button>
          <button data-act="order" data-arg="new" class="${order === 'new' ? 'is-on' : ''}">🆕 Newest</button>
        </div>
        <div id="ideas-list">${items.length ? items.map((i) => {
          const [label, colour] = STATUS[i.status] ?? STATUS.new;
          const k = KINDS.find(([id]) => id === i.kind) ?? KINDS[0];
          return `
          <div class="id-item" data-idea="${esc(i.id)}">
            <button class="id-vote${i.voted ? ' is-on' : ''}" data-act="vote" data-arg="${esc(i.id)}" aria-label="Vote">▲ ${i.votes}<small>${i.voted ? 'voted' : 'vote'}</small></button>
            <span class="id-body">
              <span class="id-head">${k[1]} ${esc(k[2])} · @${esc(i.by)} · ${ago(i.at)}<span class="id-badge" style="background:${colour}">${esc(label)}</span>${!online && !i.sent ? '<span class="id-badge" style="background:#94a3b8">Not sent yet</span>' : ''}</span>
              <span class="id-text">${esc(i.text)}</span>
            </span>
          </div>`;
        }).join('') : empty('💡', online ? 'No ideas yet' : 'Your ideas', online ? 'Be the first: what would make the game better?' : 'Write one above. It goes to the makers when you play online.')}</div>`,
    };
  },

  async act(host, action, el) {
    const online = OnlineAccount.get();
    const arg = el.dataset.arg ?? '';
    if (action === 'kind') return host.set('ideas.kind', arg);
    if (action === 'order') return host.set('ideas.order', arg === 'new' ? 'new' : 'top');
    if (action === 'send') {
      const text = String(host.get('ideas.text', '')).replace(/\s+/g, ' ').trim().slice(0, 400);
      const kind = String(host.get('ideas.kind', 'idea'));
      if (text.length < 8) return;
      if (online) {
        const done = await online.request('/ideas/post', { text, kind });
        if (!done?.ok) return host.say(done?.reason ?? 'That did not send.', 'bad');
        await load(host, 'new', true);
        await load(host, 'top', true);
      } else {
        const own = loadLocal();
        own.unshift({ id: `mine-${Date.now().toString(36)}`, by: host.backend.getData().username || 'you', text, kind, at: Date.now(), votes: 1, voted: true, status: 'new', mine: true, sent: false });
        saveLocal(own);
      }
      host.set('ideas.text', '');
      host.say('Thank you! Your idea is in. 💡', 'good');
      return;
    }
    if (action === 'vote') {
      if (online && !arg.startsWith('mine-')) {
        const done = await online.request('/ideas/vote', { id: arg });
        if (!done?.ok) return host.say(done?.reason ?? 'That did not work.', 'bad');
        await load(host, host.get<string>('ideas.order', 'top') === 'new' ? 'new' : 'top', true);
        return;
      }
      const own = loadLocal();
      const it = own.find((i) => i.id === arg);
      if (it) {
        it.voted = !it.voted;
        it.votes += it.voted ? 1 : -1;
        saveLocal(own);
      }
    }
  },
};
