import { BackendService } from '../../backend/BackendService';
import {
  Chieftaincy,
  type TitleId,
  type ChieftaincyTitleSpec,
} from '../../social/Chieftaincy';
import { chips, esc, naira } from '../../ui/kit/html';
import type { PhoneApp } from '../PhoneApp';

/**
 * Titles app on the phone:
 * - High Society & Chieftaincy Titles conferred by the Council of Chiefs & Kabiyesi.
 * - Manage active title prefix (*Otunba*, *Aare*, *Omoba*, *Chief*).
 * - Collect daily royal tributes and view sacred regalia.
 */

let syncedAt = 0;
let styled = false;

const style = (): void => {
  if (styled || typeof document === 'undefined') return;
  styled = true;
  const el = document.createElement('style');
  el.id = 'nl-titles-style';
  el.textContent = `
    .tt-root { padding: 4px 2px 68px; display: flex; flex-direction: column; gap: 10px; color: var(--lx-ink, #0f172a); font-family: var(--lx-font, system-ui); }
    .tt-hero {
      padding: 12px 14px; border-radius: 16px;
      background: linear-gradient(135deg, #78350f 0%, #b45309 50%, #d97706 100%);
      color: #fff; box-shadow: var(--lx-shadow-sm, 0 4px 12px rgba(0,0,0,.1));
    }
    .tt-hero-top { display: flex; justify-content: space-between; align-items: baseline; gap: 8px; }
    .tt-hero-tag { font-size: 10px; font-weight: 900; letter-spacing: .12em; text-transform: uppercase; color: #fde68a; }
    .tt-hero-badge { font-size: 11px; font-weight: 900; color: #fef3c7; background: rgba(0,0,0,.3); padding: 2px 8px; border-radius: 999px; }
    .tt-hero h3 { margin: 4px 0 2px; font-size: 16px; font-weight: 900; letter-spacing: -.02em; }
    .tt-hero p { margin: 0; font-size: 11px; color: rgba(255,255,255,.9); line-height: 1.35; }
    .tt-stats {
      margin-top: 8px; padding-top: 8px; border-top: 1px solid rgba(255,255,255,.2);
      display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; font-size: 11px;
    }
    .tt-stats div b { display: block; font-size: 13px; font-weight: 900; color: #fef08a; font-variant-numeric: tabular-nums; }
    .tt-active-banner {
      padding: 10px 12px; border-radius: 14px;
      background: linear-gradient(135deg, #fef3c7, #fde68a);
      border: 1px solid #d97706; color: #78350f;
      display: flex; flex-direction: column; gap: 4px;
    }
    .tt-active-title { font-size: 13px; font-weight: 900; color: #78350f; }
    .tt-active-sub { font-size: 11px; font-weight: 700; color: #92400e; line-height: 1.35; }
    .tt-card {
      background: var(--lx-card-bg, #fff);
      border: 1px solid var(--lx-border, #e2e8f0);
      border-radius: 14px; padding: 12px;
      display: flex; flex-direction: column; gap: 8px;
    }
    .tt-head { display: flex; justify-content: space-between; align-items: flex-start; gap: 6px; }
    .tt-title-name { font-size: 14px; font-weight: 900; color: var(--lx-ink, #0f172a); }
    .tt-meta { font-size: 11px; font-weight: 800; color: #b45309; }
    .tt-desc { font-size: 11px; color: var(--lx-muted, #64748b); line-height: 1.4; }
    .tt-oriki {
      font-size: 11px; font-style: italic; color: #78350f;
      background: #fffbeb; padding: 6px 8px; border-radius: 8px;
      border-left: 3px solid #d97706;
    }
    .tt-pills { display: flex; gap: 6px; flex-wrap: wrap; margin-top: 2px; }
    .tt-pill {
      font-size: 10px; font-weight: 800; padding: 3px 7px; border-radius: 999px;
      background: #f1f5f9; color: #475569;
    }
    .tt-pill.gold { background: #fef3c7; color: #92400e; border: 1px solid #fde68a; }
    .tt-pill.green { background: #dcfce7; color: #166534; border: 1px solid #bbf7d0; }
    .tt-btn {
      width: 100%; padding: 9px 12px; border-radius: 10px; font-size: 12px; font-weight: 800;
      border: none; cursor: pointer; transition: transform .05s ease, opacity .15s;
      background: linear-gradient(135deg, #b45309, #d97706); color: #fff;
    }
    .tt-btn:active { transform: scale(0.98); }
    .tt-btn.secondary { background: #f1f5f9; color: #334155; }
    .tt-btn:disabled { opacity: .5; cursor: not-allowed; }
  `;
  document.head.appendChild(el);
};

export const titlesApp: PhoneApp = {
  id: 'titles',
  name: 'Titles',
  icon: '👑',
  tint: ['#78350f', '#d97706'],
  purpose: 'Royal chieftaincy titles, palace investiture dais, sacred regalia & daily tributes.',
  badge: () => 0,
  render: (host) => {
    style();
    const chieftaincy = Chieftaincy.get();
    const now = Date.now();
    if (now - syncedAt > 10_000) {
      syncedAt = now;
      void chieftaincy.syncOnline().then(() => host.refresh());
    }

    const be = BackendService.getInstance();
    const bankBal = be.getData().bank.balance;
    const cashBal = be.getData().walletCash;
    const fame = chieftaincy.playerFame();
    const conferred = chieftaincy.conferred();
    const activeId = chieftaincy.activeTitleId();
    const active = chieftaincy.activeTitleSpec();

    const tab = host.get<'titles' | 'regalia' | 'palace'>('tt.tab', 'titles');

    const renderTitleCard = (spec: ChieftaincyTitleSpec): string => {
      const isConferred = chieftaincy.isConferred(spec.id);
      const isActive = activeId === spec.id;
      const canAfford = bankBal >= spec.offeringPrice || cashBal >= spec.offeringPrice;
      const meetsFame = fame >= spec.fameRequired;

      return `
        <div class="tt-card" data-title-card="${esc(spec.id)}">
          <div class="tt-head">
            <div>
              <div class="tt-title-name">${esc(spec.regaliaIcon)} ${esc(spec.name)}</div>
              <div class="tt-meta">Title Prefix: <b>${esc(spec.prefix)}</b> · Tribute: <b>${naira(spec.dailyTribute)}/day</b></div>
            </div>
            ${isConferred ? `<span class="tt-pill green">✓ Conferred</span>` : `<span class="tt-pill gold">${naira(spec.offeringPrice)}</span>`}
          </div>
          <div class="tt-desc">${esc(spec.description)}</div>
          <div class="tt-oriki">"${esc(spec.oriki)}"</div>
          <div class="tt-pills">
            <span class="tt-pill ${meetsFame ? 'green' : ''}">Req: ${spec.fameRequired} Fame (Have: ${fame})</span>
            <span class="tt-pill gold">Insignia: ${esc(spec.regaliaName)}</span>
          </div>
          <div style="margin-top:4px;">
            ${
              isConferred
                ? isActive
                  ? `<button class="tt-btn" disabled>👑 Active Title</button>`
                  : `<button class="tt-btn secondary" data-act="set-active-title" data-title="${esc(spec.id)}">Set as Active Title</button>`
                : meetsFame
                  ? `<button class="tt-btn" data-act="confer-title" data-title="${esc(spec.id)}" ${canAfford ? '' : 'disabled'}>
                      ${canAfford ? `👑 Take Title (${naira(spec.offeringPrice)})` : `Need ${naira(spec.offeringPrice)}`}
                    </button>`
                  : `<button class="tt-btn" data-title="${esc(spec.id)}" disabled>Need ${spec.fameRequired} Fame</button>`
            }
          </div>
        </div>
      `;
    };

    let content = '';

    if (tab === 'titles') {
      content = chieftaincy.titles().map(renderTitleCard).join('');
    } else if (tab === 'regalia') {
      const regaliaSpecs = chieftaincy.titles();
      content = regaliaSpecs
        .map((spec) => {
          const owned = chieftaincy.isConferred(spec.id);
          return `
            <div class="tt-card">
              <div class="tt-head">
                <div class="tt-title-name">${esc(spec.regaliaIcon)} ${esc(spec.regaliaName)}</div>
                <span class="tt-pill ${owned ? 'green' : ''}">${owned ? 'Owned In Bag' : 'Unconferred'}</span>
              </div>
              <div class="tt-desc">Sacred insignia of the <b>${esc(spec.name)}</b>. Conferred by Kabiyesi and the Council of Chiefs during royal palace investiture.</div>
              <div class="tt-oriki">Royal Title: <b>${esc(spec.prefix)}</b> · Daily Tribute: <b>${naira(spec.dailyTribute)}</b></div>
            </div>
          `;
        })
        .join('');
    } else {
      content = `
        <div class="tt-card">
          <div class="tt-title-name">🏛️ Freedom Park Palace Court</div>
          <div class="tt-desc">
            The traditional Council of Chiefs and the Oba of Lagos sit upon the royal dais at <b>Freedom Park</b>.
            Meet Kabiyesi in person to take your title, pay royal homage, and hear the praise singer chant your royal Oriki.
          </div>
          <div class="tt-desc" style="font-weight:700; color:#b45309;">
            Perks of High Chieftaincy:
            <ul style="margin:4px 0 0; padding-left:18px;">
              <li>Automatic respect and bows from street pedestrians &amp; lounge hosts.</li>
              <li>VIP tables and private suites without cover charges.</li>
              <li>Daily royal tribute deposited straight into your bank account.</li>
            </ul>
          </div>
          <button class="tt-btn secondary" data-act="go-freedom-park">
            🗺️ Locate Freedom Park Palace Dais
          </button>
        </div>
      `;
    }

    const activeBanner = active
      ? `
        <div class="tt-active-banner">
          <div class="tt-active-title">👑 High Chief Standing: ${esc(active.name)}</div>
          <div class="tt-active-sub">Prefix: <b>${esc(active.prefix)}</b> · Daily Royal Tribute: <b>${naira(active.dailyTribute)}</b>. Recognized across Lagos Island, Ikoyi and mainland high society.</div>
        </div>
      `
      : `
        <div class="tt-active-banner">
          <div class="tt-active-title">🏛️ Council of Chiefs Court</div>
          <div class="tt-active-sub">Attain 25+ Society Fame to be invited by Kabiyesi for your first chieftaincy investiture.</div>
        </div>
      `;

    return {
      title: 'Titles',
      body: `
        <div class="tt-root">
          <div class="tt-hero">
            <div class="tt-hero-top">
              <span class="tt-hero-tag">Kingdom of Lagos</span>
              <span class="tt-hero-badge">${conferred.length} Titles Held</span>
            </div>
            <h3>Chieftaincy &amp; Royal Titles</h3>
            <p>Investiture by Kabiyesi, sacred regalia, royal Oriki praise poetry, and daily societal tribute.</p>
            <div class="tt-stats">
              <div>Active<b>${active ? esc(active.prefix) : 'None'}</b></div>
              <div>Society Fame<b>${fame}</b></div>
              <div>Tribute<b>${active ? naira(active.dailyTribute) : '₦0'}</b></div>
            </div>
          </div>
          ${activeBanner}
          ${chips('tt.tab', tab, [
            ['titles', `Titles (${conferred.length}/4)`],
            ['regalia', 'Royal Regalia'],
            ['palace', 'Palace Protocol'],
          ])}
          ${content}
        </div>
      `,
    };
  },
  async act(host, action, el) {
    const chieftaincy = Chieftaincy.get();
    if (action === 'confer-title') {
      const titleId = (el.dataset.title ?? '') as TitleId;
      const res = await chieftaincy.confer(titleId);
      host.say(res.message, res.ok ? 'good' : 'bad');
      host.refresh();
      return;
    }
    if (action === 'set-active-title') {
      const titleId = (el.dataset.title ?? '') as TitleId;
      const res = await chieftaincy.setActiveTitle(titleId);
      host.say(res.message, res.ok ? 'good' : 'bad');
      host.refresh();
      return;
    }
    if (action === 'go-freedom-park') {
      host.say('Freedom Park is located in Lagos Island. Enter the venue to approach the Palace Dais.', 'good');
    }
  },
};

