import { BackendService } from '../../backend/BackendService';
import {
  Owambe,
  type AsoEbiId,
  type AsoEbiSpec,
  type OwambePartyRecord,
  type OwambeSpec,
  type OwambeTierId,
} from '../../social/Owambe';
import { chips, empty, esc, naira } from '../../ui/kit/html';
import type { PhoneApp } from '../PhoneApp';

/**
 * Owambe app on the phone: buy Aso-Ebi fabric, book Saturday Owambe halls at real Lagos venues,
 * and track your dancefloor Naira spraying & guestbook history.
 */

let syncedAt = 0;
let styled = false;

const style = (): void => {
  if (styled || typeof document === 'undefined') return;
  styled = true;
  const el = document.createElement('style');
  el.id = 'nl-owambe-style';
  el.textContent = `
    .ow-root { padding: 4px 2px 68px; display: flex; flex-direction: column; gap: 10px; color: var(--lx-ink, #0f172a); font-family: var(--lx-font, system-ui); }
    .ow-hero {
      padding: 12px 14px; border-radius: 16px;
      background: linear-gradient(135deg, #7f1d1d 0%, #b45309 55%, #ca8a04 100%);
      color: #fff; box-shadow: var(--lx-shadow-sm, 0 4px 12px rgba(0,0,0,.1));
    }
    .ow-hero-top { display: flex; justify-content: space-between; align-items: baseline; gap: 8px; }
    .ow-hero-tag { font-size: 10px; font-weight: 900; letter-spacing: .12em; text-transform: uppercase; color: #fde047; }
    .ow-hero-badge { font-size: 11px; font-weight: 900; color: #fef08a; background: rgba(0,0,0,.3); padding: 2px 8px; border-radius: 999px; }
    .ow-hero h3 { margin: 4px 0 2px; font-size: 16px; font-weight: 900; letter-spacing: -.02em; }
    .ow-hero p { margin: 0; font-size: 11px; color: rgba(255,255,255,.88); line-height: 1.35; }
    .ow-stats {
      margin-top: 8px; padding-top: 8px; border-top: 1px solid rgba(255,255,255,.18);
      display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; font-size: 11px;
    }
    .ow-stats div b { display: block; font-size: 13px; font-weight: 900; color: #fde68a; font-variant-numeric: tabular-nums; }
    .ow-active {
      padding: 12px; border-radius: 14px;
      background: linear-gradient(135deg, #fef3c7, #fde68a);
      border: 1px solid #f59e0b; color: #78350f;
      display: flex; flex-direction: column; gap: 5px;
    }
    .ow-active-title { font-size: 13px; font-weight: 900; color: #78350f; }
    .ow-active-sub { font-size: 11px; font-weight: 700; color: #92400e; line-height: 1.35; }
    .ow-card {
      padding: 12px; border-radius: 14px;
      background: var(--lx-surface-solid, #fff); border: 1px solid var(--lx-line, rgba(0,0,0,.08));
      box-shadow: var(--lx-shadow-sm, 0 4px 12px rgba(0,0,0,.08));
      display: flex; flex-direction: column; gap: 6px; color: var(--lx-ink, #0f172a);
    }
    .ow-card.equipped { border-color: #eab308; }
    .ow-card-top { display: flex; justify-content: space-between; align-items: flex-start; gap: 8px; }
    .ow-name { font-size: 13px; font-weight: 900; color: var(--lx-ink, #0f172a); }
    .ow-sub { font-size: 11px; font-weight: 700; color: var(--lx-dim, #64748b); }
    .ow-pill {
      padding: 3px 8px; border-radius: 999px; font-size: 10px; font-weight: 900;
      background: #fef3c7; color: #92400e; white-space: nowrap; font-variant-numeric: tabular-nums;
    }
    .ow-pill.green { background: #dcfce7; color: #166534; }
    .ow-meta { font-size: 11px; font-weight: 800; color: #b45309; }
    .ow-desc { font-size: 11px; color: var(--lx-dim, #64748b); line-height: 1.35; }
    .ow-actions { display: flex; gap: 6px; flex-wrap: wrap; margin-top: 2px; }
    .ow-btn {
      flex: 1; padding: 8px 10px; border-radius: 10px; border: 0;
      background: linear-gradient(135deg, #b45309, #ca8a04); color: #fff;
      font-family: inherit; font-size: 11px; font-weight: 800; cursor: pointer;
    }
    .ow-btn:disabled { opacity: .45; cursor: not-allowed; }
    .ow-btn-sec {
      padding: 8px 10px; border-radius: 10px;
      border: 1px solid var(--lx-line, rgba(0,0,0,.14));
      background: var(--lx-surface-2, #f1f5f9); color: var(--lx-ink, #0f172a);
      font-family: inherit; font-size: 11px; font-weight: 800; cursor: pointer;
    }
  `;
  document.head.appendChild(el);
};

function renderPartyCard(spec: OwambeSpec, active: OwambePartyRecord | null, totalFunds: number): string {
  const isBookedHere = active?.tierId === spec.id;
  const canAfford = totalFunds >= spec.bookingFee;
  const disabled = Boolean(active) || !canAfford;

  let btnLabel = `Book ${spec.venueName} (${naira(spec.bookingFee)})`;
  if (isBookedHere) btnLabel = `Booked · Spray at ${spec.venueName}`;
  else if (active) btnLabel = `Finish active Owambe first`;
  else if (!canAfford) btnLabel = `Need ${naira(spec.bookingFee)}`;

  return `
    <div class="ow-card ${isBookedHere ? 'equipped' : ''}" data-owambe-card="${esc(spec.id)}">
      <div class="ow-card-top">
        <div>
          <div class="ow-name">🎉 ${esc(spec.title)}</div>
          <div class="ow-sub">${esc(spec.occasion)} · 📍 ${esc(spec.venueName)} (${esc(spec.district)})</div>
        </div>
        <span class="ow-pill">+${spec.baseFame} Fame</span>
      </div>
      <div class="ow-meta">🎤 ${esc(spec.mcName)} · 🥁 ${esc(spec.bandName)}</div>
      <div class="ow-desc">${esc(spec.summary)}</div>
      <div class="ow-sub">Hall booking: <b>${naira(spec.bookingFee)}</b> · Dancefloor spray bundle: <b>${naira(spec.sprayBundle)}</b></div>
      <div class="ow-actions">
        <button class="ow-btn" data-act="book-party" data-tier="${esc(spec.id)}" ${disabled ? 'disabled' : ''}>
          ${esc(btnLabel)}
        </button>
      </div>
    </div>
  `;
}

function renderAsoEbiCard(spec: AsoEbiSpec, owned: boolean, equipped: boolean, totalFunds: number): string {
  const canAfford = totalFunds >= spec.price;
  return `
    <div class="ow-card ${equipped ? 'equipped' : ''}" data-asoebi-card="${esc(spec.id)}">
      <div class="ow-card-top">
        <div>
          <div class="ow-name">${spec.icon} ${esc(spec.name)}</div>
          <div class="ow-sub">${esc(spec.subtitle)}</div>
        </div>
        <span class="ow-pill ${owned ? 'green' : ''}">${equipped ? 'Wearing' : owned ? 'Owned' : naira(spec.price)}</span>
      </div>
      <div class="ow-meta">+${spec.fameBonus} Bonus Owambe Fame when spraying</div>
      <div class="ow-desc">${esc(spec.description)}</div>
      <div class="ow-actions">
        ${
          owned
            ? `<button class="ow-btn" data-act="equip-asoebi" data-id="${esc(spec.id)}" ${equipped ? 'disabled' : ''}>${
                equipped ? '✓ Currently Wearing' : `Wear ${esc(spec.name)}`
              }</button>`
            : `<button class="ow-btn" data-act="buy-asoebi" data-id="${esc(spec.id)}" ${canAfford ? '' : 'disabled'}>${
                canAfford ? `Buy & Wear (${naira(spec.price)})` : `Need ${naira(spec.price)}`
              }</button>`
        }
      </div>
    </div>
  `;
}

function renderHistoryCard(rec: OwambePartyRecord): string {
  return `
    <div class="ow-card" data-owambe-history="${esc(rec.tierId)}">
      <div class="ow-card-top">
        <div>
          <div class="ow-name">${esc(rec.title)} ${'★'.repeat(rec.stars)}${'☆'.repeat(3 - rec.stars)}</div>
          <div class="ow-sub">📍 ${esc(rec.venueName)} · 🎤 ${esc(rec.mcName)}</div>
        </div>
        <span class="ow-pill green">+${rec.fameEarned} Fame</span>
      </div>
      <div class="ow-meta">💸 Sprayed ${naira(rec.sprayBundle)} · Hall ${naira(rec.bookingFee)}</div>
    </div>
  `;
}

export const owambeApp: PhoneApp = {
  id: 'owambe',
  name: 'Owambe',
  icon: '🎉',
  tint: ['#b45309', '#7f1d1d'],
  purpose: 'Saturday parties, Aso-Ebi & spraying Naira in 3D',
  badge: () => (Owambe.get().activeParty() ? 1 : 0),
  render(host) {
    style();
    const owambe = Owambe.get();
    if (Date.now() - syncedAt > 8_000) {
      syncedAt = Date.now();
      void owambe.syncFromServer();
    }

    const tab = host.get<'parties' | 'asoebi' | 'history'>('ow.tab', 'parties');
    const active = owambe.activeParty();
    const ownedAso = owambe.ownedAsoEbi();
    const equipped = owambe.equippedAsoEbi();
    const history = owambe.history();
    const data = BackendService.getInstance().getData();
    const totalFunds = data.walletCash + data.bank.balance;

    const activeBanner = active
      ? `
        <div class="ow-active" id="owambe-active-party">
          <div class="ow-active-title">🎉 Active Owambe: ${esc(active.title)}</div>
          <div class="ow-active-sub">
            📍 Waiting inside <b>${esc(active.venueName)}</b> with <b>${esc(active.mcName)}</b> &amp; <b>${esc(active.bandName)}</b>.<br/>
            Step onto the VIP carpet inside ${esc(active.venueName)} to spray <b>${naira(active.sprayBundle)}</b>!
          </div>
        </div>
      `
      : '';

    let content = '';
    if (tab === 'parties') {
      content = owambe
        .partySpecs()
        .map((spec) => renderPartyCard(spec, active, totalFunds))
        .join('');
    } else if (tab === 'asoebi') {
      content = owambe
        .asoEbiCatalogue()
        .map((a) => renderAsoEbiCard(a, ownedAso.includes(a.id), equipped?.id === a.id, totalFunds))
        .join('');
    } else {
      content =
        history.length === 0
          ? empty('🎉', 'No Owambe parties hosted yet', 'Buy your Aso-Ebi, book a hall, and spray Naira on the dancefloor!')
          : history.map((h) => renderHistoryCard(h)).join('');
    }

    return {
      title: 'Owambe',
      body: `
        <div class="ow-root">
          <div class="ow-hero">
            <div class="ow-hero-top">
              <span class="ow-hero-tag">Lagos Society & Celebrations</span>
              <span class="ow-hero-badge">${esc(owambe.socialTitle())}</span>
            </div>
            <h3>Saturday Owambe &amp; Spraying</h3>
            <p>Rock custom Aso-Ebi, book a hall with a live Jùjú or Afrobeat band, and spray crisp Naira notes in 3D.</p>
            <div class="ow-stats">
              <div>Owambe Fame<b>${owambe.fameEarned()}</b></div>
              <div>Total Sprayed<b>${naira(owambe.totalSprayed())}</b></div>
              <div>Aso-Ebi<b>${equipped ? esc(equipped.name.split(' ')[0]!) : 'None'}</b></div>
            </div>
          </div>
          ${activeBanner}
          ${chips('ow.tab', tab, [
            ['parties', `Book Hall (${owambe.partySpecs().length})`],
            ['asoebi', `Aso-Ebi (${ownedAso.length}/${owambe.asoEbiCatalogue().length})`],
            ['history', `Guestbook (${history.length})`],
          ])}
          ${content}
        </div>
      `,
    };
  },
  async act(host, action, el) {
    const owambe = Owambe.get();
    if (action === 'buy-asoebi') {
      const id = (el.dataset.id ?? '') as AsoEbiId;
      const res = await owambe.buyAsoEbi(id);
      host.say(res.message, res.ok ? 'good' : 'bad');
      host.refresh();
      return;
    }
    if (action === 'equip-asoebi') {
      const id = (el.dataset.id ?? '') as AsoEbiId;
      const res = owambe.equipAsoEbi(id);
      host.say(res.message, res.ok ? 'good' : 'bad');
      host.refresh();
      return;
    }
    if (action === 'book-party') {
      const tierId = (el.dataset.tier ?? '') as OwambeTierId;
      const res = await owambe.bookParty(tierId);
      host.say(res.message, res.ok ? 'good' : 'bad');
      host.refresh();
    }
  },
};
