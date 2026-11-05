import type { PhoneApp, PhoneHost } from '../PhoneApp';
import { esc, naira, empty, chips } from '../../ui/kit/html';
import { Adverts, until, type BoardState } from '../../business/Adverts';
import { adPrice, dayRate, AD_DAYS, AD_COLOURS, AD_LIFT, type AdDays } from '../../business/adPrices';

/**
 * Eko Ads: rent a billboard on the expressway. Write the headline and a line under it, pick a
 * colour, and it goes up on the board in the city for a day, a week or a month. Name one of your
 * businesses and the advert brings it custom. Online, every player on the road sees it.
 */

const CSS = `
.ea-board{position:relative;border-radius:14px;aspect-ratio:2.5/1;padding:14px 16px;color:#fff;overflow:hidden;display:flex;flex-direction:column;justify-content:center;box-shadow:0 12px 26px rgba(0,0,0,.28),inset 0 0 0 3px #1f2937}
.ea-board::before{content:'';position:absolute;left:-20%;top:-60%;width:90%;height:110%;border-radius:50%;background:rgba(255,255,255,.08)}
.ea-board h3{margin:0;font:900 clamp(20px,6.4vw,30px)/1.02 var(--lx-font,system-ui);text-transform:uppercase;letter-spacing:.3px;position:relative;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.ea-board p{margin:6px 0 0;font:600 13.5px/1.25 var(--lx-font,system-ui);opacity:.93;position:relative;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.ea-board i{position:absolute;left:16px;bottom:12px;width:44px;height:3px;background:#e8c766;border-radius:2px}
.ea-board small{position:absolute;right:14px;bottom:9px;font:700 10px/1 var(--lx-font,system-ui);opacity:.75}
.ea-pole{width:16px;height:22px;margin:0 auto 12px;background:linear-gradient(90deg,#4b5563,#6b7280,#4b5563);border-radius:0 0 4px 4px}
.ea-swatches{display:flex;gap:8px;margin:6px 0 12px;flex-wrap:wrap}
.ea-swatch{width:32px;height:32px;border-radius:50%;border:3px solid transparent;cursor:pointer;box-shadow:0 2px 6px rgba(0,0,0,.2)}
.ea-swatch.is-on{border-color:var(--lx-ink,#0f172a);transform:scale(1.08)}
.ea-row{display:flex;align-items:center;gap:10px;width:100%;text-align:left;background:var(--lx-surface-solid,#fff);border:1px solid var(--lx-line,rgba(0,0,0,.06));border-radius:16px;padding:10px 12px;margin:7px 0;box-shadow:var(--lx-shadow-sm,0 4px 12px rgba(0,0,0,.06));cursor:pointer;color:var(--lx-ink,#0f172a)}
.ea-chip{width:46px;height:30px;border-radius:7px;flex:0 0 auto;display:grid;place-items:center;font:900 8.5px/1.05 var(--lx-font,system-ui);color:#fff;text-transform:uppercase;padding:2px;overflow:hidden;box-shadow:inset 0 0 0 2px #1f2937;text-align:center}
.ea-text{flex:1;min-width:0;display:block}
.ea-title{display:block;font:800 13px/1.25 var(--lx-font,system-ui)}
.ea-sub{display:block;font:600 11.5px/1.35 var(--lx-font,system-ui);color:var(--lx-dim,#64748b)}
.ea-price{text-align:right;font:900 13px/1.2 var(--lx-font,system-ui);white-space:nowrap}
.ea-price small{display:block;font:700 10px/1.2 var(--lx-font,system-ui);color:var(--lx-dim,#64748b)}
.ea-tag{display:inline-block;font:800 10px/1 var(--lx-font,system-ui);padding:4px 7px;border-radius:999px;background:var(--lx-surface-2,#f1f5f9);color:var(--lx-dim,#475569);margin-top:3px}
.ea-tag--mine{background:#dcfce7;color:#166534}.ea-tag--taken{background:#fee2e2;color:#991b1b}
`;
let styled = false;
const style = () => {
  if (styled) return;
  styled = true;
  const el = document.createElement('style');
  el.textContent = CSS;
  document.head.appendChild(el);
};

const DAYS_LABEL: Record<AdDays, string> = { 1: '1 day', 7: '1 week', 30: '1 month' };

function preview(headline: string, line: string, colour: string, by: string): string {
  return `
    <div class="ea-board" id="ads-preview" style="background:linear-gradient(135deg, ${esc(colour)}, ${esc(colour)}99 140%)">
      <h3>${esc(headline || 'Your headline')}</h3>
      <p>${esc(line || 'A line under it, up to forty letters')}</p>
      <i></i><small>${by ? `@${esc(by)} · ` : ''}Eko Ads</small>
    </div>
    <div class="ea-pole"></div>`;
}

function boardRow(b: BoardState): string {
  const r = b.rental;
  const state = !r ? '<span class="ea-tag">Free</span>' : r.mine ? `<span class="ea-tag ea-tag--mine">Yours till ${esc(until(r.until))}</span>` : `<span class="ea-tag ea-tag--taken">@${esc(r.by)} till ${esc(until(r.until))}</span>`;
  const colour = r?.colour ?? '#334155';
  return `
    <button class="ea-row" data-go="board:${esc(b.face.id)}" data-board="${esc(b.face.id)}">
      <span class="ea-chip" style="background:${esc(colour)}">${esc((r?.headline ?? b.face.house).slice(0, 14))}</span>
      <span class="ea-text">
        <span class="ea-title">${esc(b.km)} · by ${esc(b.near)}</span>
        <span class="ea-sub">${b.face.face === 'a' ? 'Facing the traffic' : 'The face behind'}</span>
        ${state}
      </span>
      <span class="ea-price">${naira(dayRate(b.face.id))}<small>a day</small></span>
    </button>`;
}

function detail(host: PhoneHost, id: string): string {
  const ads = Adverts.get();
  const b = ads.boards().find((s) => s.face.id === id);
  if (!b) return empty('📢', 'That board is not on the road', 'Go back and pick another.');
  const me = host.backend.getData().username || '';
  const r = b.rental;
  if (r && !r.mine) {
    return `
      ${preview(r.headline, r.line, r.colour, r.by)}
      <div class="nl-note">@${esc(r.by)} has this board until ${esc(until(r.until))}. Pick a free one, or come back then.</div>
      <button class="nl-btn nl-btn--block" data-act="show" data-arg="${esc(id)}">📍 Show me where it is</button>`;
  }
  const headline = String(host.get('ads.headline', r?.headline ?? ''));
  const line = String(host.get('ads.line', r?.line ?? ''));
  const colour = String(host.get('ads.colour', r?.colour ?? AD_COLOURS[0]));
  const days = Number(host.get('ads.days', '7')) as AdDays;
  const owned = host.backend.getData().businesses.filter((biz) => biz.owned);
  const business = String(host.get('ads.business', r?.business ?? ''));
  return `
    ${preview(headline, line, colour, me)}
    <div class="nl-hint">${esc(b.km)} on the road, by ${esc(b.near)}, ${b.face.face === 'a' ? 'facing the traffic' : 'on the face behind'}.${r ? ` Yours until ${esc(until(r.until))}: renting again adds the time.` : ''}</div>
    <label class="nl-label" for="ads-headline">Headline</label>
    <input class="nl-field" id="ads-headline" maxlength="22" placeholder="e.g. MAMA T'S SUYA" value="${esc(headline)}" data-bind="ads.headline" data-live />
    <label class="nl-label" for="ads-line">Under it</label>
    <input class="nl-field" id="ads-line" maxlength="40" placeholder="e.g. Hot every night · Allen Avenue" value="${esc(line)}" data-bind="ads.line" data-live />
    <div class="nl-label">Colour</div>
    <div class="ea-swatches">${AD_COLOURS.map((c) => `<button class="ea-swatch${c === colour ? ' is-on' : ''}" style="background:${c}" data-set="ads.colour" data-value="${c}" aria-label="Colour ${c}"></button>`).join('')}</div>
    ${owned.length ? `<div class="nl-label">Advertise a business (its takings go up ${Math.round(AD_LIFT * 100)}% a board)</div>
      ${chips('ads.business', business, [['', 'None'], ...owned.map((biz) => [biz.id, esc(biz.name)] as [string, string])])}` : ''}
    <div class="nl-label">How long</div>
    ${chips('ads.days', String(days), AD_DAYS.map((d) => [String(d), `${DAYS_LABEL[d]} · ${naira(adPrice(id, d))}`] as [string, string]))}
    <button class="nl-btn nl-btn--primary nl-btn--block" id="ads-rent" data-act="rent" data-arg="${esc(id)}">${r ? 'Add time' : 'Put it up'} · ${naira(adPrice(id, days))}</button>
    <button class="nl-btn nl-btn--block" data-act="show" data-arg="${esc(id)}">📍 Show me where it is</button>
    ${r ? `<button class="nl-btn nl-btn--danger nl-btn--sm" data-act="remove" data-arg="${esc(id)}">Take it down (no refund)</button>` : ''}`;
}

export const adsApp: PhoneApp = {
  id: 'ads',
  aliases: ['myads', 'billboards'],
  name: 'Eko Ads',
  icon: '📢',
  tint: ['#7c2d12', '#f59e0b'],
  purpose: 'Rent a billboard on the expressway and put your advert up for all Lagos to see',
  badge: () => 0,

  render(host, route) {
    style();
    if (route.startsWith('board:')) return { title: 'Billboard', body: detail(host, route.slice('board:'.length)) };
    const ads = Adverts.get();
    void ads.refresh();
    const tab = host.get('ads.tab', 'boards') as string;
    const head = `
      <div class="nl-hero nl-hero--amber">
        <span class="nl-hero-label">Billboards on the expressway</span>
        <span class="nl-hero-title">Eko Ads</span>
        <span class="nl-hero-sub">${ads.online ? 'Every player on the road sees your board.' : 'Your words, ten metres wide, on Lagos’s busiest road.'}</span>
      </div>
      ${chips('ads.tab', tab, [['boards', '📢 Boards'], ['mine', `📣 My adverts${ads.mine().length ? ` (${ads.mine().length})` : ''}`]])}`;
    if (tab === 'mine') {
      const mine = ads.boards().filter((b) => b.rental?.mine);
      return {
        title: 'Eko Ads',
        body: `${head}<div id="ads-mine">${mine.length ? mine.map(boardRow).join('') : empty('📣', 'No adverts up', 'Pick a board and put your name on the road.')}</div>`,
      };
    }
    const boards = ads.boards();
    const group = (title: string, list: BoardState[]) => (list.length ? `<div class="nl-section">${title}</div>${list.map(boardRow).join('')}` : '');
    return {
      title: 'Eko Ads',
      body: `${head}
        <div id="ads-boards">
          ${group('Lagos Island · the dearest', boards.filter((b) => b.face.z < 1000))}
          ${group('The expressway and the bridge', boards.filter((b) => b.face.z >= 1000 && b.face.z < 4110))}
          ${group('Ikorodu Road, Ikeja', boards.filter((b) => b.face.z >= 4110))}
        </div>
        ${boards.length ? '' : empty('📢', 'No boards here', 'The billboards are on the expressway in Lagos.')}`,
    };
  },

  async act(host, action, el) {
    const id = el.dataset.arg ?? '';
    if (action === 'rent') {
      const days = Number(host.get('ads.days', '7')) as AdDays;
      const price = adPrice(id, days);
      if (price >= 1_000_000 && !(await host.confirm(`Rent this billboard for ${DAYS_LABEL[days]} for ${naira(price)}?`, 'Rent it'))) return;
      const why = await Adverts.get().rent(id, days, {
        headline: String(host.get('ads.headline', '')),
        line: String(host.get('ads.line', '')),
        colour: String(host.get('ads.colour', AD_COLOURS[0])),
        business: String(host.get('ads.business', '')) || null,
      });
      if (why) return host.say(why, 'bad');
      host.say('Your advert is up on the road. 📢', 'good');
      return;
    }
    if (action === 'remove') {
      if (!(await host.confirm('Take your advert down? Nothing is paid back.', 'Take it down'))) return;
      const why = await Adverts.get().remove(id);
      host.say(why ?? 'Taken down.', why ? 'bad' : 'info');
      return;
    }
    if (action === 'show') {
      const face = Adverts.get().boards().find((b) => b.face.id === id)?.face;
      if (!face) return;
      host.close();
      host.world.showPlace(face.x, face.z, 'Your billboard');
    }
  },
};
