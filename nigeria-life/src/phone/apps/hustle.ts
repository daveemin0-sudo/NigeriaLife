import type { PhoneApp, PhoneHost } from '../PhoneApp';
import { esc, naira, row, empty, chips } from '../../ui/kit/html';
import { OnlineAccount } from '../../online/OnlineAccount';

/**
 * Hustle: players hire players. A job is posted with its fee (held by the game from the poster's
 * bank, so it is there for whoever does it); anyone can take it; when the poster says it is
 * done the fee is paid to the worker, less 5%. The city's players are on the board.
 */

interface Post {
  id: string;
  posterId: string;
  posterName: string;
  title: string;
  category: string;
  fee: number;
  status: 'open' | 'taken' | 'done' | 'cancelled';
  workerId: string | null;
  workerName: string | null;
}

const CATS: Array<[string, string]> = [
  ['decorator', '🛋️ Decorator'], ['cook', '🍲 Cook'], ['dj', '🎧 DJ'], ['driver', '🚗 Driver'], ['photographer', '📸 Photographer'], ['bodyguard', '🕶️ Bodyguard'],
  ['tutor', '📚 Tutor'], ['tailor', '🧵 Tailor'], ['mc', '🎤 MC'], ['cleaner', '🧹 Cleaner'], ['builder', '🧱 Builder'], ['other', '🧰 Other'],
];
const icon = (cat: string) => (CATS.find(([c]) => c === cat)?.[1] ?? '🧰').split(' ')[0];

let data: { posts: Post[]; mine: Post[]; me: string } | null = null;
let fetchedAt = 0;
let loading = false;

async function load(host: PhoneHost, force = false): Promise<void> {
  const online = OnlineAccount.get();
  if (!online || loading || (!force && Date.now() - fetchedAt < 8000)) return;
  loading = true;
  try {
    const got = await online.request('/hustle/board');
    if (got.ok) {
      data = { posts: got.posts ?? [], mine: got.mine ?? [], me: got.me ?? '' };
      fetchedAt = Date.now();
    }
  } finally {
    loading = false;
  }
  host.refresh();
}

export const hustleApp: PhoneApp = {
  id: 'hustle',
  name: 'Hustle',
  icon: '🧰',
  tint: ['#c2410c', '#fb923c'],
  purpose: 'Players hire players: post a job with a fee, or take one and get paid',
  badge: () => (data ? data.mine.filter((p) => p.status === 'taken' && p.posterId === data!.me).length : 0),

  render(host) {
    const online = OnlineAccount.get();
    if (!online) return { title: 'Hustle', body: empty('🌐', 'Hustle is for the online city', 'Play online to hire other players or be hired.') };
    void load(host);
    const tab = host.get('hustle.tab', 'board') as string;
    const head = `
      <div class="nl-hero nl-hero--amber">
        <span class="nl-hero-label">Players hire players</span>
        <span class="nl-hero-title">Hustle</span>
        <span class="nl-hero-sub">Decorate a house, DJ a party, drive, cook. The fee is held safe until the job is done.</span>
      </div>
      ${chips('hustle.tab', tab, [['board', '📋 Board'], ['post', '➕ Post a job'], ['mine', '💼 My jobs']])}`;
    if (!data) return { title: 'Hustle', body: `${head}${empty('⏳', 'Loading the board…', 'The jobs posted across Lagos.')}` };
    const me = data.me;

    if (tab === 'post') {
      const cat = host.get('hustle.cat', 'decorator') as string;
      return {
        title: 'Hustle',
        body: `${head}
          <label class="nl-label" for="hustle-title">What is the job?</label>
          <input class="nl-field" id="hustle-title" maxlength="80" placeholder="e.g. Decorate my new house in Banana Island" value="${esc(String(host.get('hustle.title', '')))}" data-bind="hustle.title" />
          <div class="nl-label">Kind of work</div>
          ${chips('hustle.cat', cat, CATS)}
          <label class="nl-label" for="hustle-fee">Fee (₦)</label>
          <input class="nl-field" id="hustle-fee" type="text" inputmode="numeric" placeholder="e.g. 2500000" value="${esc(String(host.get('hustle.fee', '')))}" data-bind="hustle.fee" />
          <div class="nl-hint">The fee leaves your bank now and is held until you say the job is done; then it goes to the worker (less 5%). Cancel before anyone takes it and it all comes back.</div>
          <button class="nl-btn nl-btn--primary nl-btn--block" id="hustle-post-btn" data-act="post">Post the job</button>`,
      };
    }

    if (tab === 'mine') {
      const posted = data.mine.filter((p) => p.posterId === me && p.status !== 'done');
      const working = data.mine.filter((p) => p.workerId === me && p.status === 'taken');
      const done = data.mine.filter((p) => p.status === 'done').slice(0, 10);
      return {
        title: 'Hustle',
        body: `${head}
          <div class="nl-section">Jobs you posted</div>
          <div class="nl-list" id="hustle-posted">${posted.length ? posted.map((p) => `
            <div class="nl-card">
              <div class="nl-card-title">${icon(p.category)} ${esc(p.title)}</div>
              <div class="nl-card-line">${naira(p.fee)} held · ${p.status === 'open' ? 'waiting for someone to take it' : `@${esc(p.workerName ?? '')} is on it`}</div>
              ${p.status === 'open'
                ? `<button class="nl-btn nl-btn--danger nl-btn--sm" data-act="cancel" data-arg="${esc(p.id)}">Cancel (refund)</button>`
                : `<button class="nl-btn nl-btn--primary nl-btn--block" data-act="done" data-arg="${esc(p.id)}">It is done: pay @${esc(p.workerName ?? '')} ${naira(Math.round(p.fee * 0.95))}</button>`}
            </div>`).join('') : empty('📝', 'Nothing posted', 'Post a job and players across Lagos can take it.')}</div>
          <div class="nl-section">Jobs you are doing</div>
          <div class="nl-list" id="hustle-working">${working.length ? working.map((p) => `
            <div class="nl-card">
              <div class="nl-card-title">${icon(p.category)} ${esc(p.title)}</div>
              <div class="nl-card-line">For @${esc(p.posterName)} · ${naira(Math.round(p.fee * 0.95))} when they say it is done. Chat to them in Street Chat.</div>
              <button class="nl-btn nl-btn--sm" data-act="quit" data-arg="${esc(p.id)}">Give it back</button>
            </div>`).join('') : empty('🧰', 'No jobs on', 'Take one from the Board.')}</div>
          ${done.length ? `<div class="nl-section">Done</div><div class="nl-list">${done.map((p) => row({ icon: '✅', title: esc(p.title), sub: p.workerId === me ? `Paid by @${esc(p.posterName)}` : `Done by @${esc(p.workerName ?? '')}`, trailing: naira(p.fee) })).join('')}</div>` : ''}`,
      };
    }

    const filter = host.get('hustle.filter', 'all') as string;
    const posts = data.posts.filter((p) => filter === 'all' || p.category === filter);
    return {
      title: 'Hustle',
      body: `${head}
        ${chips('hustle.filter', filter, [['all', 'All'], ...CATS])}
        <div class="nl-list" id="hustle-board">${posts.length ? posts.map((p) => `
          <div class="nl-card">
            <div class="nl-card-title">${icon(p.category)} ${esc(p.title)}</div>
            <div class="nl-card-line">@${esc(p.posterName)} · <strong>${naira(p.fee)}</strong></div>
            ${p.posterId === me ? '<div class="nl-hint">Your job</div>' : `<button class="nl-btn nl-btn--primary nl-btn--block" data-act="take" data-arg="${esc(p.id)}">Take this job · ${naira(Math.round(p.fee * 0.95))} to you</button>`}
          </div>`).join('') : empty('📋', 'No jobs here yet', 'Be the first: post one, or check back soon.')}</div>`,
    };
  },

  async act(host, action, el) {
    const online = OnlineAccount.get();
    if (!online) return;
    const arg = el.dataset.arg ?? '';
    let done: { ok: boolean; reason?: string } | null = null;
    if (action === 'post') {
      const title = String(host.get('hustle.title', '')).trim();
      const fee = Number(String(host.get('hustle.fee', '')).replace(/[^\d.]/g, '')) * (/m\b/i.test(String(host.get('hustle.fee', ''))) ? 1_000_000 : 1);
      done = await online.request('/hustle/post', { title, category: host.get('hustle.cat', 'decorator'), fee: Math.round(fee) });
      if (done?.ok) {
        host.set('hustle.title', '');
        host.set('hustle.fee', '');
        host.set('hustle.tab', 'mine');
        host.say('Posted: the fee is held until the job is done.', 'good');
      }
    } else if (action === 'take' || action === 'done' || action === 'cancel' || action === 'quit') {
      done = await online.request(`/hustle/${action}`, { id: arg });
      if (done?.ok) host.say(action === 'take' ? 'The job is yours. Do it, then the poster pays you.' : action === 'done' ? 'Paid. Thank you!' : action === 'cancel' ? 'Cancelled: the fee is back in your bank.' : 'You gave the job back.', 'good');
      if (done?.ok && action === 'take') host.set('hustle.tab', 'mine');
    }
    if (done && !done.ok) host.say(done.reason ?? 'That did not work.', 'bad');
    await load(host, true);
  },
};
