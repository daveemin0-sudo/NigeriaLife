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
let styled = false;

const style = (): void => {
  if (styled || typeof document === 'undefined') return;
  styled = true;
  const el = document.createElement('style');
  el.id = 'nl-studio-style';
  el.textContent = `
    .ms-root { padding: 4px 2px 68px; display: flex; flex-direction: column; gap: 10px; color: var(--lx-ink, #0f172a); font-family: var(--lx-font, system-ui); }
    .ms-hero {
      padding: 12px 14px; border-radius: 16px;
      background: linear-gradient(135deg, #3b0764 0%, #6d28d9 55%, #9333ea 100%);
      color: #fff; box-shadow: var(--lx-shadow-sm, 0 4px 12px rgba(0,0,0,.1));
    }
    .ms-hero-top { display: flex; justify-content: space-between; align-items: baseline; gap: 8px; }
    .ms-hero-tag { font-size: 10px; font-weight: 900; letter-spacing: .12em; text-transform: uppercase; color: #fde047; }
    .ms-hero-badge { font-size: 11px; font-weight: 900; color: #fef08a; background: rgba(0,0,0,.32); padding: 2px 8px; border-radius: 999px; }
    .ms-hero h3 { margin: 4px 0 2px; font-size: 16px; font-weight: 900; letter-spacing: -.02em; }
    .ms-hero p { margin: 0; font-size: 11px; color: rgba(255,255,255,.88); line-height: 1.35; }
    .ms-stats {
      margin-top: 8px; padding-top: 8px; border-top: 1px solid rgba(255,255,255,.18);
      display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; font-size: 11px;
    }
    .ms-stats div b { display: block; font-size: 13px; font-weight: 900; color: #fde68a; font-variant-numeric: tabular-nums; }
    .ms-active {
      padding: 12px; border-radius: 14px;
      background: linear-gradient(135deg, #f3e8ff, #e9d5ff);
      border: 1px solid #a855f7; color: #4c1d95;
      display: flex; flex-direction: column; gap: 5px;
    }
    .ms-active-title { font-size: 13px; font-weight: 900; color: #4c1d95; }
    .ms-active-sub { font-size: 11px; font-weight: 700; color: #5b21b6; line-height: 1.35; }
    .ms-card {
      padding: 12px; border-radius: 14px;
      background: var(--lx-surface-solid, #fff); border: 1px solid var(--lx-line, rgba(0,0,0,.08));
      box-shadow: var(--lx-shadow-sm, 0 4px 12px rgba(0,0,0,.08));
      display: flex; flex-direction: column; gap: 6px; color: var(--lx-ink, #0f172a);
    }
    .ms-card.booked { border-color: #9333ea; }
    .ms-card-top { display: flex; justify-content: space-between; align-items: flex-start; gap: 8px; }
    .ms-name { font-size: 13px; font-weight: 900; color: var(--lx-ink, #0f172a); }
    .ms-sub { font-size: 11px; font-weight: 700; color: var(--lx-dim, #64748b); }
    .ms-pill {
      padding: 3px 8px; border-radius: 999px; font-size: 10px; font-weight: 900;
      background: #f3e8ff; color: #6b21a8; white-space: nowrap; font-variant-numeric: tabular-nums;
    }
    .ms-pill.gold { background: #fef3c7; color: #92400e; }
    .ms-pill.green { background: #dcfce7; color: #166534; }
    .ms-meta { font-size: 11px; font-weight: 800; color: #6d28d9; }
    .ms-desc { font-size: 11px; color: var(--lx-dim, #64748b); line-height: 1.35; }
    .ms-actions { display: flex; gap: 6px; flex-wrap: wrap; margin-top: 2px; }
    .ms-btn {
      flex: 1; padding: 8px 10px; border-radius: 10px; border: 0;
      background: linear-gradient(135deg, #6d28d9, #9333ea); color: #fff;
      font-family: inherit; font-size: 11px; font-weight: 800; cursor: pointer;
    }
    .ms-btn:disabled { opacity: .45; cursor: not-allowed; }
    .ms-chart-row {
      padding: 10px 12px; border-radius: 12px;
      background: var(--lx-surface-solid, #fff); border: 1px solid var(--lx-line, rgba(0,0,0,.08));
      display: flex; align-items: center; justify-content: space-between; gap: 10px;
    }
    .ms-chart-row.me {
      background: linear-gradient(135deg, #faf5ff, #f3e8ff);
      border-color: #a855f7;
    }
    .ms-rank {
      width: 26px; height: 26px; border-radius: 8px;
      background: #f1f5f9; color: #334155;
      display: flex; align-items: center; justify-content: center;
      font-size: 12px; font-weight: 900; flex-shrink: 0;
    }
    .ms-rank.top3 { background: #fef3c7; color: #92400e; }
  `;
  document.head.appendChild(el);
};

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
    <div class="ms-card ${isBooked ? 'booked' : ''}" data-studio-card="${esc(spec.id)}">
      <div class="ms-card-top">
        <div>
          <div class="ms-name">🎵 ${esc(spec.title)}</div>
          <div class="ms-sub">${esc(spec.genre)} · 🎛️ Prod. ${esc(spec.producer)} (${esc(spec.label)})</div>
        </div>
        <span class="ms-pill">+${spec.fameGain} Fame</span>
      </div>
      <div class="ms-desc">${esc(spec.synopsis)}</div>
      <div class="ms-meta">
        Master Advance: <b>${naira(spec.advancePay)}</b> · Royalties: <b>${naira(spec.dailyRoyalty)}/day</b> (5d)
      </div>
      <div class="ms-sub">
        🎤 Headline Show: <b>${esc(spec.concertVenueName)}</b> (+${naira(spec.concertFee)})
      </div>
      <div class="ms-actions">
        <button class="ms-btn" data-act="book-studio" data-track="${esc(spec.id)}" ${disabled ? 'disabled' : ''}>
          ${esc(btnLabel)}
        </button>
      </div>
    </div>
  `;
}

function renderChartRow(entry: ChartEntry): string {
  return `
    <div class="ms-chart-row ${entry.isPlayer ? 'me' : ''}" data-chart-rank="${entry.rank}">
      <div style="display:flex;align-items:center;gap:10px;min-width:0;">
        <div class="ms-rank ${entry.rank <= 3 ? 'top3' : ''}">#${entry.rank}</div>
        <div style="min-width:0;">
          <div class="ms-name">
            ${esc(entry.title)} ${entry.isPlayer ? '<span class="ms-pill green">YOU</span>' : ''}
          </div>
          <div class="ms-sub">${esc(entry.artist)} · ${esc(entry.genre)}</div>
        </div>
      </div>
      <span class="ms-pill gold">${entry.streams.toLocaleString()} streams</span>
    </div>
  `;
}

function renderCatalogCard(song: ReleasedSong): string {
  const starStr = '★'.repeat(song.stars) + '☆'.repeat(3 - song.stars);
  return `
    <div class="ms-card" data-catalog-song="${esc(song.trackId)}">
      <div class="ms-card-top">
        <div>
          <div class="ms-name">💿 ${esc(song.title)} ${starStr}</div>
          <div class="ms-sub">${esc(song.genre)} · Prod. ${esc(song.producer)} · ${esc(song.label)}</div>
        </div>
        <span class="ms-pill gold">${song.streams.toLocaleString()} streams</span>
      </div>
      <div class="ms-meta">
        Advance: ${naira(song.advancePay + song.bonus)} · Royalties: ${naira(song.totalRoyalties)} (${song.daysPaid}/${song.totalDays} days)
      </div>
      <div class="ms-sub">
        ${
          song.concertDone
            ? `✓ Headline show performed at <b>${esc(song.concertVenueName)}</b>`
            : `🎤 Headline Show Ready at <b>${esc(song.concertVenueName)}</b> (+${naira(song.concertFee)}) — visit the stage inside ${esc(song.concertVenueName)}!`
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
    style();
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
        <div class="ms-active" id="studio-active-session">
          <div class="ms-active-title">🎙️ Booked at Studio B: ${esc(active.title)}</div>
          <div class="ms-active-sub">
            📍 Waiting inside <b>Naija Radio House</b> (Ikeja) with producer <b>${esc(active.producer)}</b>.<br/>
            Step into the 3D Studio B Vocal Booth to record 3 takes and earn <b>${naira(active.advancePay)}</b> master advance!
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
      content = studio
        .topTenChart()
        .map((c) => renderChartRow(c))
        .join('');
    } else {
      content =
        discography.length === 0
          ? empty(
              '🎙️',
              'No tracks released yet',
              'Book Studio B on the Beats tab and record at Naija Radio House to drop your first Afrobeats single!',
            )
          : `
            <button class="ms-btn" data-act="collect-royalties" style="margin-bottom:4px;">
              💰 Check &amp; Settle Streaming Royalties
            </button>
            ${discography.map((s) => renderCatalogCard(s)).join('')}
          `;
    }

    return {
      title: 'Studio',
      body: `
        <div class="ms-root">
          <div class="ms-hero">
            <div class="ms-hero-top">
              <span class="ms-hero-tag">Lagos Afrobeats Record Label</span>
              <span class="ms-hero-badge">${esc(artistRankTitle(fame))}</span>
            </div>
            <h3>Kalakuta Sound Lab &amp; Charts</h3>
            <p>Record hits in Studio B at Naija Radio House, climb the Lagos Top 10, and headline live venue stages.</p>
            <div class="ms-stats">
              <div>Music Fame<b>${fame}</b></div>
              <div>Streams<b>${studio.totalStreams().toLocaleString()}</b></div>
              <div>Royalties<b>${naira(studio.totalRoyaltiesEarned())}</b></div>
            </div>
          </div>
          ${activeBanner}
          ${chips('ms.tab', tab, [
            ['beats', `Beats & Booth (${studio.tracks().length})`],
            ['chart', 'Lagos Top 10'],
            ['catalog', `Catalog & Tour (${discography.length})`],
          ])}
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

