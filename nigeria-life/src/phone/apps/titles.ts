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

export const titlesApp: PhoneApp = {
  id: 'titles',
  name: 'Titles',
  icon: '👑',
  tint: ['#78350f', '#d97706'],
  purpose: 'Royal chieftaincy titles, palace investiture dais, sacred regalia & daily tributes.',
  badge: () => 0,
  render: (host) => {
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
        <div class="nl-card" data-title-card="${esc(spec.id)}">
          <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:8px;">
            <div>
              <div class="nl-card-title">${esc(spec.regaliaIcon)} ${esc(spec.name)}</div>
              <div class="nl-card-line" style="margin-top:2px;">Title Prefix: <strong>${esc(spec.prefix)}</strong> · Tribute: <strong>${naira(spec.dailyTribute)}/day</strong></div>
            </div>
            ${isConferred ? `<span class="nl-tag nl-tag--good">✓ Conferred</span>` : `<span class="nl-tag nl-tag--warn">${naira(spec.offeringPrice)}</span>`}
          </div>
          <div class="nl-card-line" style="margin-top:4px;">${esc(spec.description)}</div>
          <div class="nl-note" style="border-left:3px solid #d97706; margin:6px 0; font-style:italic; color:var(--nl-text);">"${esc(spec.oriki)}"</div>
          <div class="nl-stats">
            <span><strong>${spec.fameRequired} Fame</strong>Req. (${fame} held)</span>
            <span><strong>${esc(spec.regaliaName)}</strong>Insignia</span>
            <span><strong>${naira(spec.dailyTribute)}</strong>Daily Tribute</span>
          </div>
          <div style="margin-top:6px;">
            ${
              isConferred
                ? isActive
                  ? `<button class="nl-btn nl-btn--block" disabled>👑 Active Title</button>`
                  : `<button class="nl-btn nl-btn--primary nl-btn--block" data-act="set-active-title" data-title="${esc(spec.id)}">Set as Active Title</button>`
                : meetsFame
                  ? `<button class="nl-btn nl-btn--primary nl-btn--block" data-act="confer-title" data-title="${esc(spec.id)}" ${canAfford ? '' : 'disabled'}>
                      ${canAfford ? `👑 Take Title (${naira(spec.offeringPrice)})` : `Need ${naira(spec.offeringPrice)}`}
                    </button>`
                  : `<button class="nl-btn nl-btn--block" data-title="${esc(spec.id)}" disabled>Need ${spec.fameRequired} Fame</button>`
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
            <div class="nl-card">
              <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:8px;">
                <div class="nl-card-title">${esc(spec.regaliaIcon)} ${esc(spec.regaliaName)}</div>
                <span class="nl-tag ${owned ? 'nl-tag--good' : 'nl-tag--muted'}">${owned ? 'Owned In Bag' : 'Unconferred'}</span>
              </div>
              <div class="nl-card-line" style="margin-top:4px;">Sacred insignia of the <strong>${esc(spec.name)}</strong>. Conferred by Kabiyesi and the Council of Chiefs during royal palace investiture.</div>
              <div class="nl-card-line" style="margin-top:4px;">Royal Title: <strong>${esc(spec.prefix)}</strong> · Daily Tribute: <strong>${naira(spec.dailyTribute)}</strong></div>
            </div>
          `;
        })
        .join('');
    } else {
      content = `
        <div class="nl-card">
          <div class="nl-card-title">🏛️ Freedom Park Palace Court</div>
          <div class="nl-card-line" style="margin-top:4px;">
            The traditional Council of Chiefs and the Oba of Lagos sit upon the royal dais at <strong>Freedom Park</strong>.
            Meet Kabiyesi in person to take your title, pay royal homage, and hear the praise singer chant your royal Oriki.
          </div>
          <div class="nl-note" style="margin-top:8px;">
            <strong>Perks of High Chieftaincy:</strong>
            <ul style="margin:6px 0 0; padding-left:18px;">
              <li>Automatic respect and bows from street pedestrians &amp; lounge hosts.</li>
              <li>VIP tables and private suites without cover charges.</li>
              <li>Daily royal tribute deposited straight into your bank account.</li>
            </ul>
          </div>
          <button class="nl-btn nl-btn--primary nl-btn--block" style="margin-top:8px;" data-act="go-freedom-park">
            🗺️ Locate Freedom Park Palace Dais
          </button>
        </div>
      `;
    }

    const activeBanner = active
      ? `
        <div class="nl-card nl-card--live tt-active-banner">
          <div class="nl-card-title">👑 High Chief Standing: ${esc(active.name)} (Otunba of Lagos)</div>
          <div class="nl-card-line">Prefix: <strong>${esc(active.prefix)}</strong> · Daily Royal Tribute: <strong>${naira(active.dailyTribute)}</strong>. Recognized across Lagos Island, Ikoyi and mainland high society.</div>
        </div>
      `
      : `
        <div class="nl-card tt-active-banner">
          <div class="nl-card-title">🏛️ Council of Chiefs Court</div>
          <div class="nl-card-line">Attain 25+ Society Fame to be invited by Kabiyesi for your first chieftaincy investiture.</div>
        </div>
      `;

    return {
      title: 'Titles',
      body: `
        <div class="nl-hero nl-hero--amber">
          <span class="nl-hero-label">Kingdom of Lagos · Royal Investiture</span>
          <span class="nl-hero-value">${active ? esc(active.name) : 'No Royal Title'}</span>
          <span class="nl-hero-sub">Prefix: <strong>${active ? esc(active.prefix) : 'Citizen'}</strong> · Fame: <strong>${fame}</strong> · Tribute: <strong>${active ? naira(active.dailyTribute) : '₦0'}</strong></span>
          <div class="nl-hero-actions">
            <button class="nl-btn nl-btn--glass" data-set="tt.tab" data-value="titles">👑 Titles (${conferred.length}/4)</button>
            <button class="nl-btn nl-btn--glass" data-set="tt.tab" data-value="regalia">📿 Regalia</button>
          </div>
        </div>
        ${activeBanner}
        <div class="nl-section">Court Records</div>
        ${chips('tt.tab', tab, [
          ['titles', `Titles (${conferred.length}/4)`],
          ['regalia', 'Royal Regalia'],
          ['palace', 'Palace Protocol'],
        ])}
        <div class="nl-list" style="margin-top:8px;">
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

