import { BackendService } from '../../backend/BackendService';
import {
  Studio,
  type ActiveStudioSession,
  type ChartEntry,
  type ReleasedSong,
  type StudioTrackSpec,
} from '../../music/Studio';
import { chips, empty, esc, naira } from '../../ui/kit/html';
import type { PhoneApp } from '../PhoneApp';

/**
 * Studio app on the phone: book Afrobeats recording sessions at Naija Radio House (`radio-house`),
 * climb the Lagos Top 10 Chart, collect 5-day streaming royalties, and track live headline shows.
 */

let syncedAt = 0;

function artistRankTitle(fame: number): string {
  if (fame >= 90) return 'Global Afrobeats Giant';
  if (fame >= 55) return 'Lagos Arena Headliner';
  if (fame >= 25) return 'Chart-Topping Star';
  if (fame >= 10) return 'NaijaFM Breakout Act';
  return 'Studio Newcomer';
}

function renderTrackCard(
  spec: StudioTrackSpec,
  active: ActiveStudioSession | null,
  fame: number,
  totalFunds: number,
): string {
  const isBooked = active?.trackId === spec.id;
  const locked = fame < spec.minFame;
  const canAfford = totalFunds >= spec.studioFee;
  const disabled = Boolean(active) || locked || !canAfford;

  let btnLabel = `Book Studio B (${naira(spec.studioFee)})`;
  if (isBooked) btnLabel = 'Booked · Record at Naija Radio House';
  else if (locked) btnLabel = `🔒 Needs ${spec.minFame} Music Fame`;
  else if (active) btnLabel = 'Finish active studio session first';
  else if (!canAfford) btnLabel = `Need ${naira(spec.studioFee)}`;

  return `
    <div class="nl-card ${isBooked ? 'nl-card--live' : ''}" data-studio-card="${esc(spec.id)}">
      <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:8px;">
        <div>
          <div class="nl-card-title">🎵 ${esc(spec.title)}</div>
          <div class="nl-card-line" style="margin-top:2px;">${esc(spec.genre)} · <span class="nl-tag">Prod. ${esc(spec.producer)} (${esc(spec.label)})</span></div>
        </div>
        <span class="nl-tag nl-tag--good">+${spec.fameGain} Fame</span>
      </div>
      <div class="nl-card-line" style="margin-top:4px;">${esc(spec.synopsis)}</div>
      <div class="nl-stats">
        <span><strong>${naira(spec.advancePay)}</strong>Advance Pay</span>
        <span><strong>${naira(spec.dailyRoyalty)}/day</strong>Royalties (5d)</span>
        <span><strong>${esc(spec.concertVenueName)}</strong>Headline Stage</span>
      </div>
      <div style="margin-top:6px;">
        <button class="nl-btn ${isBooked ? '' : 'nl-btn--primary'} nl-btn--block" data-act="book-studio" data-track="${esc(spec.id)}" ${disabled ? 'disabled' : ''}>
          ${esc(btnLabel)}
        </button>
      </div>
    </div>
  `;
}

function renderChartRow(entry: ChartEntry): string {
  return `
    <div class="nl-card ${entry.isPlayer ? 'nl-card--live' : ''}" style="margin:4px 0; padding:10px 12px;" data-chart-rank="${entry.rank}">
      <div style="display:flex; align-items:center; justify-content:space-between; gap:10px;">
        <div style="display:flex; align-items:center; gap:10px; min-width:0;">
          <div style="width:28px; height:28px; border-radius:8px; background:${entry.rank <= 3 ? '#fef3c7' : 'var(--nl-surface-2)'}; color:${entry.rank <= 3 ? '#92400e' : 'var(--nl-text)'}; display:grid; place-items:center; font-weight:900; font-size:12px; flex-shrink:0;">
            #${entry.rank}
          </div>
          <div style="min-width:0;">
            <div class="nl-card-title" style="font-size:13.5px;">
              ${esc(entry.title)} ${entry.isPlayer ? '<span class="nl-tag nl-tag--good">YOU</span>' : ''}
            </div>
            <div class="nl-card-line" style="margin-top:1px;">${esc(entry.artist)} · ${esc(entry.genre)}</div>
          </div>
        </div>
        <span class="nl-tag nl-tag--warn" style="font-weight:800;">${entry.streams.toLocaleString()} streams</span>
      </div>
    </div>
  `;
}

function renderCatalogCard(song: ReleasedSong): string {
  const starStr = '★'.repeat(song.stars) + '☆'.repeat(3 - song.stars);
  return `
    <div class="nl-card" data-catalog-song="${esc(song.trackId)}">
      <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:8px;">
        <div>
          <div class="nl-card-title">💿 ${esc(song.title)} <span style="color:#eab308;">${starStr}</span></div>
          <div class="nl-card-line" style="margin-top:2px;">${esc(song.genre)} · Prod. ${esc(song.producer)} · ${esc(song.label)}</div>
        </div>
        <span class="nl-tag nl-tag--warn">${song.streams.toLocaleString()} streams</span>
      </div>
      <div class="nl-stats" style="margin-top:6px;">
        <span><strong>${naira(song.advancePay + song.bonus)}</strong>Advance Earned</span>
        <span><strong>${naira(song.totalRoyalties)}</strong>Royalties (${song.daysPaid}/${song.totalDays}d)</span>
      </div>
      <div class="nl-card-line" style="margin-top:4px;">
        ${
          song.concertDone
            ? `✓ Headline show performed at <strong>${esc(song.concertVenueName)}</strong>`
            : `🎤 Headline Show Ready at <strong>${esc(song.concertVenueName)}</strong> (+${naira(song.concertFee)}) — visit the stage inside ${esc(song.concertVenueName)}!`
        }
      </div>
    </div>
  `;
}

export const studioApp: PhoneApp = {
  id: 'studio',
  name: 'Studio',
  icon: '🎙️',
  tint: ['#7c3aed', '#3b0764'],
  purpose: 'Afrobeats studio, Lagos Top 10 & live shows',
  badge: () => (Studio.get().activeSession() ? 1 : 0),
  render(host) {
    const studio = Studio.get();
    if (Date.now() - syncedAt > 8_000) {
      syncedAt = Date.now();
      void studio.syncFromServer();
    }

    const tab = host.get<'beats' | 'chart' | 'catalog'>('ms.tab', 'beats');
    const active = studio.activeSession();
    const discography = studio.discography();
    const fame = studio.fame();
    const data = BackendService.getInstance().getData();
    const totalFunds = data.walletCash + data.bank.balance;

    const activeBanner = active
      ? `
        <div class="nl-card nl-card--live ms-active" id="studio-active-session">
          <div class="nl-card-title">🎙️ Booked at Studio B: ${esc(active.title)}</div>
          <div class="nl-card-line">
            📍 Waiting inside <strong>Naija Radio House</strong> (Ikeja) with producer <strong>${esc(active.producer)}</strong>.
          </div>
          <div class="nl-card-line" style="margin-top:2px;">
            Step into the 3D Studio B Vocal Booth to record 3 takes and earn <strong>${naira(active.advancePay)}</strong> master advance!
          </div>
        </div>
      `
      : '';

    let content = '';
    if (tab === 'beats') {
      content = studio
        .tracks()
        .map((t) => renderTrackCard(t, active, fame, totalFunds))
        .join('');
    } else if (tab === 'chart') {
      content = `<div class="nl-list">${studio.topTenChart().map((c) => renderChartRow(c)).join('')}</div>`;
    } else {
      content =
        discography.length === 0
          ? empty(
              '🎙️',
              'No tracks released yet',
              'Book Studio B on the Beats tab and record at Naija Radio House to drop your first Afrobeats single!',
            )
          : `
            <button class="nl-btn nl-btn--primary nl-btn--block" data-act="collect-royalties" style="margin-bottom:8px;">
              💰 Check &amp; Settle Streaming Royalties
            </button>
            <div class="nl-list">
              ${discography.map((s) => renderCatalogCard(s)).join('')}
            </div>
          `;
    }

    return {
      title: 'Studio',
      body: `
        <div class="nl-hero nl-hero--indigo">
          <span class="nl-hero-label">Lagos Afrobeats Record Label</span>
          <span class="nl-hero-value" style="font-size:22px;">${esc(artistRankTitle(fame))}</span>
          <span class="nl-hero-sub">Fame: <strong>${fame}</strong> · Streams: <strong>${studio.totalStreams().toLocaleString()}</strong> · Royalties: <strong>${naira(studio.totalRoyaltiesEarned())}</strong></span>
          <div class="nl-hero-actions">
            <button class="nl-btn nl-btn--glass" data-set="ms.tab" data-value="beats">🎙️ Studio B</button>
            <button class="nl-btn nl-btn--glass" data-set="ms.tab" data-value="chart">📈 Top 10 Chart</button>
          </div>
        </div>
        ${activeBanner}
        <div class="nl-section">Music Operations</div>
        ${chips('ms.tab', tab, [
          ['beats', `Beats & Booth (${studio.tracks().length})`],
          ['chart', 'Lagos Top 10'],
          ['catalog', `Catalog & Tour (${discography.length})`],
        ])}
        <div class="nl-list" style="margin-top:8px;">
          ${content}
        </div>
      `,
    };
  },
  async act(host, action, el) {
    const studio = Studio.get();
    if (action === 'book-studio') {
      const trackId = el.dataset.track ?? '';
      const res = await studio.bookSession(trackId);
      host.say(
        res.ok
          ? `Studio B booked for "${res.active?.title}"! Head to Naija Radio House.`
          : (res.reason ?? 'Could not book studio session.'),
        res.ok ? 'good' : 'bad',
      );
      host.refresh();
      return;
    }
    if (action === 'collect-royalties') {
      const paid = await studio.checkRoyalties();
      host.say(
        paid > 0
          ? `Collected ${naira(paid)} in streaming royalties!`
          : 'No new streaming days have matured yet.',
        paid > 0 ? 'good' : 'info',
      );
      host.refresh();
    }
  },
};

