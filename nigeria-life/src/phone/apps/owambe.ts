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

function renderPartyCard(spec: OwambeSpec, active: OwambePartyRecord | null, totalFunds: number): string {
  const isBookedHere = active?.tierId === spec.id;
  const canAfford = totalFunds >= spec.bookingFee;
  const disabled = Boolean(active) || !canAfford;

  let btnLabel = `Book ${spec.venueName} (${naira(spec.bookingFee)})`;
  if (isBookedHere) btnLabel = `Booked · Spray at ${spec.venueName}`;
  else if (active) btnLabel = `Finish active Owambe first`;
  else if (!canAfford) btnLabel = `Need ${naira(spec.bookingFee)}`;

  return `
    <div class="nl-card ${isBookedHere ? 'nl-card--live' : ''}" data-owambe-card="${esc(spec.id)}">
      <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:8px;">
        <div>
          <div class="nl-card-title">🎉 ${esc(spec.title)}</div>
          <div class="nl-card-line" style="margin-top:2px;">${esc(spec.occasion)} · <span class="nl-tag">📍 ${esc(spec.venueName)}</span></div>
        </div>
        <span class="nl-tag nl-tag--good">+${spec.baseFame} Fame</span>
      </div>
      <div class="nl-card-line" style="color:var(--nl-accent); font-weight:700; margin-top:4px;">🎤 ${esc(spec.mcName)} · 🥁 ${esc(spec.bandName)}</div>
      <div class="nl-card-line">${esc(spec.summary)}</div>
      <div class="nl-stats">
        <span><strong>${naira(spec.bookingFee)}</strong>Booking Fee</span>
        <span><strong>${naira(spec.sprayBundle)}</strong>Spray Bundle</span>
        <span><strong>${esc(spec.district)}</strong>District</span>
      </div>
      <div style="margin-top:6px;">
        <button class="nl-btn ${isBookedHere ? '' : 'nl-btn--primary'} nl-btn--block" data-act="book-party" data-tier="${esc(spec.id)}" ${disabled ? 'disabled' : ''}>
          ${esc(btnLabel)}
        </button>
      </div>
    </div>
  `;
}

function renderAsoEbiCard(spec: AsoEbiSpec, owned: boolean, equipped: boolean, totalFunds: number): string {
  const canAfford = totalFunds >= spec.price;
  return `
    <div class="nl-card ${equipped ? 'nl-card--live' : ''}" data-asoebi-card="${esc(spec.id)}">
      <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:8px;">
        <div>
          <div class="nl-card-title">${spec.icon} ${esc(spec.name)}</div>
          <div class="nl-card-line" style="margin-top:2px;">${esc(spec.subtitle)}</div>
        </div>
        <span class="nl-tag ${equipped ? 'nl-tag--live' : owned ? 'nl-tag--good' : 'nl-tag--warn'}">${equipped ? 'Wearing' : owned ? 'Owned' : naira(spec.price)}</span>
      </div>
      <div class="nl-card-line" style="color:var(--nl-accent); font-weight:700; margin-top:4px;">+${spec.fameBonus} Bonus Owambe Fame when spraying</div>
      <div class="nl-card-line">${esc(spec.description)}</div>
      <div style="margin-top:6px;">
        ${
          owned
            ? `<button class="nl-btn ${equipped ? '' : 'nl-btn--primary'} nl-btn--block" data-act="equip-asoebi" data-id="${esc(spec.id)}" ${equipped ? 'disabled' : ''}>${
                equipped ? '✓ Currently Wearing' : `Wear ${esc(spec.name)}`
              }</button>`
            : `<button class="nl-btn nl-btn--primary nl-btn--block" data-act="buy-asoebi" data-id="${esc(spec.id)}" ${canAfford ? '' : 'disabled'}>${
                canAfford ? `Buy & Wear (${naira(spec.price)})` : `Need ${naira(spec.price)}`
              }</button>`
        }
      </div>
    </div>
  `;
}

function renderHistoryCard(rec: OwambePartyRecord): string {
  return `
    <div class="nl-card" data-owambe-history="${esc(rec.tierId)}">
      <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:8px;">
        <div>
          <div class="nl-card-title">${esc(rec.title)} ${'★'.repeat(rec.stars)}${'☆'.repeat(3 - rec.stars)}</div>
          <div class="nl-card-line" style="margin-top:2px;">📍 ${esc(rec.venueName)} · 🎤 ${esc(rec.mcName)}</div>
        </div>
        <span class="nl-tag nl-tag--good">+${rec.fameEarned} Fame</span>
      </div>
      <div class="nl-card-line" style="margin-top:4px;">💸 Sprayed <strong>${naira(rec.sprayBundle)}</strong> · Hall <strong>${naira(rec.bookingFee)}</strong></div>
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
        <div class="nl-card nl-card--live ow-active" id="owambe-active-party">
          <div class="nl-card-title">🎉 Active Owambe: ${esc(active.title)}</div>
          <div class="nl-card-line">
            📍 Waiting inside <strong>${esc(active.venueName)}</strong> with <strong>${esc(active.mcName)}</strong> &amp; <strong>${esc(active.bandName)}</strong>.
          </div>
          <div class="nl-card-line" style="margin-top:2px;">
            Step onto the VIP carpet inside ${esc(active.venueName)} to spray <strong>${naira(active.sprayBundle)}</strong>!
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
        <div class="nl-hero nl-hero--amber">
          <span class="nl-hero-label">Lagos Society &amp; Celebrations</span>
          <span class="nl-hero-value" style="font-size:22px;">${esc(owambe.socialTitle())}</span>
          <span class="nl-hero-sub">Fame: <strong>${owambe.fameEarned()}</strong> · Sprayed: <strong>${naira(owambe.totalSprayed())}</strong> · Aso-Ebi: <strong>${equipped ? esc(equipped.name.split(' ')[0]!) : 'None'}</strong></span>
          <div class="nl-hero-actions">
            <button class="nl-btn nl-btn--glass" data-set="ow.tab" data-value="parties">🎉 Book Hall</button>
            <button class="nl-btn nl-btn--glass" data-set="ow.tab" data-value="asoebi">👘 Aso-Ebi (${ownedAso.length})</button>
          </div>
        </div>
        ${activeBanner}
        <div class="nl-section">Party Circuit</div>
        ${chips('ow.tab', tab, [
          ['parties', `Book Hall (${owambe.partySpecs().length})`],
          ['asoebi', `Aso-Ebi (${ownedAso.length}/${owambe.asoEbiCatalogue().length})`],
          ['history', `Guestbook (${history.length})`],
        ])}
        <div class="nl-list" style="margin-top:8px;">
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
