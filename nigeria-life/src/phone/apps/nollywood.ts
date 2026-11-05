import { Nollywood, RELEASE_DAYS, type CastingCall, type ReleasedFilm } from '../../film/Nollywood';
import { PlaceOpeners } from '../../interiors/places/PlaceInterior';
import { chips, empty, esc, naira } from '../../ui/kit/html';
import type { PhoneApp } from '../PhoneApp';

/**
 * Nollywood on the phone: casting calls to audition for (a three-take scene test scored like
 * `ShiftSkill`), the call sheet for the location shoot at a real venue in the city, and the
 * player's filmography with box-office takings over the next five real days and rising Fame.
 */

let syncedAt = 0;

let styled = false;
const style = (): void => {
  if (styled || typeof document === 'undefined') return;
  styled = true;
  const el = document.createElement('style');
  el.id = 'nl-nollywood-style';
  el.textContent = `
    .nw-bar {
      position: relative; height: 18px; border-radius: 999px;
      background: rgba(255,255,255,.12); overflow: hidden; border: 1px solid rgba(255,255,255,.22);
    }
    .nw-ok { position: absolute; top: 0; bottom: 0; left: 42%; width: 46%; background: rgba(250,204,21,.28); }
    .nw-sweet { position: absolute; top: 0; bottom: 0; left: 56%; width: 22%; background: #22c55e; }
    .nw-pin {
      position: absolute; top: -2px; bottom: -2px; width: 6px; margin-left: -3px;
      border-radius: 3px; background: #ffffff; box-shadow: 0 0 8px #fff;
    }
    .nw-takes { display: flex; gap: 6px; font-size: 10px; font-weight: 800; }
    .nw-take-pill { padding: 2px 8px; border-radius: 999px; background: rgba(255,255,255,.1); color: #cbd5e1; }
    .nw-take-pill.good { background: #166534; color: #dcfce7; }
    .nw-take-pill.ok { background: #854d0e; color: #fef9c3; }
    .nw-take-pill.miss { background: #7f1d1d; color: #fee2e2; }
  `;
  document.head.appendChild(el);
};

const renderCall = (c: CastingCall, fame: number, activeFilmId: string | null): string => {
  const locked = fame < c.minFame;
  const isCastHere = activeFilmId === c.id;
  const busyElsewhere = activeFilmId !== null && activeFilmId !== c.id;
  const canAudition = !locked && !isCastHere && !busyElsewhere;
  const label = isCastHere
    ? 'Cast — shoot on set'
    : locked
      ? `Needs ${c.minFame} Fame`
      : busyElsewhere
        ? 'Finish active shoot'
        : '🎬 Audition (3 takes)';

  return `
    <div class="nl-card" data-casting="${esc(c.id)}">
      <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:8px;">
        <div>
          <div class="nl-card-title">🎬 ${esc(c.title)}</div>
          <div class="nl-card-line" style="margin-top:2px;">${esc(c.studio)} · Dir. <strong>${esc(c.director)}</strong></div>
        </div>
        <span class="nl-tag nl-tag--warn">${esc(c.genre)}</span>
      </div>
      <div class="nl-card-line" style="margin-top:4px; font-style:italic;">"${esc(c.synopsis)}"</div>
      <div class="nl-stats" style="margin-top:6px;">
        <span><strong>${esc(c.role)}</strong>Role</span>
        <span><strong>${esc(c.venueName)}</strong>Location Set</span>
        <span><strong>${naira(c.shootPay)}</strong>Wrap Pay</span>
        <span><strong>${naira(c.dailyRoyalty)}/d</strong>Royalties (${RELEASE_DAYS}d)</span>
      </div>
      <div style="display:flex; justify-content:space-between; align-items:center; gap:8px; margin-top:8px;">
        <span class="nl-tag ${locked ? 'nl-tag--muted' : 'nl-tag--good'}">
          ${c.minFame > 0 ? `⭐ Min. ${c.minFame} Fame` : '⭐ Open casting call'}
        </span>
        <button type="button" class="nl-btn ${canAudition ? 'nl-btn--primary' : ''}" style="min-width:140px;" data-act="audition" data-id="${esc(c.id)}" ${canAudition ? '' : 'disabled'}>
          ${esc(label)}
        </button>
      </div>
    </div>
  `;
};

const renderFilm = (f: ReleasedFilm): string => {
  const stars = '★'.repeat(f.stars) + '☆'.repeat(3 - f.stars);
  const runDone = f.daysPaid >= f.totalDays;
  return `
    <div class="nl-card" data-film="${esc(f.filmId)}">
      <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:8px;">
        <div>
          <div class="nl-card-title">🎬 ${esc(f.title)} <span style="color:#d97706; font-weight:900;">${stars}</span></div>
          <div class="nl-card-line" style="margin-top:2px;">As <strong>${esc(f.role)}</strong> · ${esc(f.studio)} · Shot at <strong>${esc(f.venueName)}</strong></div>
        </div>
        <span class="nl-tag nl-tag--good">+${f.fameEarned} Fame</span>
      </div>
      <div class="nl-stats" style="margin-top:6px;">
        <span><strong>${naira(f.shootPay + f.tip)}</strong>Wrap Pay${f.tip > 0 ? ` (+${naira(f.tip)})` : ''}</span>
        <span><strong>${naira(f.dailyTaking)}/day</strong>Royalty Rate</span>
        <span><strong>${naira(f.totalTakings)}</strong>Total Takings</span>
      </div>
      <div style="display:flex; justify-content:space-between; align-items:center; margin-top:6px; padding:6px 10px; background:var(--nl-surface-2); border-radius:var(--nl-r-sm); font-size:11.5px; font-weight:700;">
        <span>Box-office run: Day ${f.daysPaid} of ${f.totalDays}${runDone ? ' (Complete)' : ' (In cinemas)'}</span>
        <strong style="color:var(--nl-warn);">${naira(f.totalTakings)}</strong>
      </div>
    </div>
  `;
};

export const nollywoodApp: PhoneApp = {
  id: 'nollywood',
  aliases: ['film', 'movies', 'acting'],
  name: 'Nollywood',
  icon: '🎬',
  tint: ['#7c2d12', '#d97706'],
  purpose: 'Audition for Nollywood roles, shoot on location, and earn box-office royalties',
  live: () => true,
  badge: () => (Nollywood.get().activeRole() ? 1 : 0),

  render(host) {
    style();
    const nw = Nollywood.get();
    const tab = host.get('nw.tab', 'casting') as string;
    if (Date.now() - syncedAt > 4000) {
      syncedAt = Date.now();
      void nw.sync();
    } else {
      void nw.checkTakings();
    }

    const fame = nw.fame();
    const fameTitle = nw.fameTitle();
    const active = nw.activeRole();
    const films = nw.filmography();
    const audition = nw.auditionState();
    const totalRoyalties = films.reduce((sum, f) => sum + f.totalTakings, 0);

    const stageHtml = audition
      ? `<div class="nl-card" id="nw-audition-stage" style="border:1.5px solid var(--nl-warn); background:#0f172a; color:#f8fafc;">
          <div style="display:flex; justify-content:space-between; align-items:center;">
            <span style="font-size:11px; font-weight:800; color:#fbbf24; text-transform:uppercase; letter-spacing:.06em;">🎬 Audition · ${esc(audition.title)} (${esc(audition.role)})</span>
            <span class="nl-tag nl-tag--warn">Take ${audition.takeIndex + 1} of 3</span>
          </div>
          <div class="nw-line" style="margin:6px 0; padding:10px 12px; border-radius:10px; background:rgba(255,255,255,.08); font-size:13px; font-weight:800; line-height:1.35; color:#fff; font-style:italic; border-left:3px solid #f59e0b;">
            "${esc(audition.lines[audition.takeIndex])}"
          </div>
          <div class="nw-bar" id="nw-audition-bar">
            <div class="nw-ok"></div>
            <div class="nw-sweet"></div>
            <div class="nw-pin" style="left:${Math.round(audition.pinAt * 100)}%"></div>
          </div>
          <div class="nw-takes" style="margin-top:6px;">
            ${[0, 1, 2]
              .map((i) => {
                const hit = audition.hits[i];
                const cls = hit ? `nw-take-pill ${hit}` : 'nw-take-pill';
                const label = hit === 'good' ? `Take ${i + 1}: Perfect` : hit === 'ok' ? `Take ${i + 1}: Good` : hit === 'miss' ? `Take ${i + 1}: Flat` : `Take ${i + 1}`;
                return `<span class="${cls}">${label}</span>`;
              })
              .join('')}
          </div>
          <div style="display:flex; gap:8px; margin-top:8px;">
            <button type="button" class="nl-btn nl-btn--primary" style="flex:1;" data-act="deliver">🎬 Deliver line now</button>
            <button type="button" class="nl-btn" data-act="cancel-audition">Cancel</button>
          </div>
        </div>`
      : '';

    const activeHtml = active
      ? `<div class="nl-card nl-card--live" id="nw-active-role" style="border-left:3px solid var(--nl-warn);">
          <div style="display:flex; justify-content:space-between; align-items:center;">
            <span class="nl-tag nl-tag--warn">📋 Call Sheet · On Location</span>
            <span style="font-size:12px; font-weight:800; color:#d97706;">${'★'.repeat(active.auditionStars)}${'☆'.repeat(3 - active.auditionStars)}</span>
          </div>
          <div class="nl-card-title" style="margin-top:4px;">${esc(active.title)} — Role: ${esc(active.role)}</div>
          <div class="nl-card-line" style="margin-top:2px;">Director <strong>${esc(active.director)}</strong> (${esc(active.studio)}) is waiting on set at <strong>${esc(active.venueName)}</strong>. Wrap pay: <strong>${naira(active.shootPay)}</strong> + 5 days of box-office takings.</div>
          <button type="button" class="nl-btn nl-btn--primary nl-btn--block" style="margin-top:8px;" data-act="cab" data-venue="${esc(active.venueKey)}">🚕 Take a cab to ${esc(active.venueName)}</button>
        </div>`
      : '';

    const bodyHtml =
      tab === 'films'
        ? `<button type="button" class="nl-btn nl-btn--primary nl-btn--block" style="margin-bottom:8px;" data-act="collect">🎬 Check box-office takings</button>` +
          (films.length > 0
            ? films.map(renderFilm).join('')
            : empty('🎞️', 'No films released yet', 'Audition for a casting call and shoot your scene at the venue to release your first Nollywood film.'))
        : nw
            .calls()
            .map((c) => renderCall(c, fame, active?.filmId ?? null))
            .join('');

    return {
      title: 'Nollywood',
      body: `
        <div class="nl-hero nl-hero--amber">
          <span class="nl-hero-label">Lagos Film Guild · Nollywood</span>
          <span class="nl-hero-value" id="nw-fame-badge">⭐ ${fame} Fame</span>
          <span class="nl-hero-sub">Rank: <strong>${esc(fameTitle)}</strong> · Royalties: <strong>${naira(totalRoyalties)}</strong></span>
          <div class="nl-stats" style="margin-top:8px;">
            <span><strong id="nw-stat-films">${films.length}</strong>Films Shot</span>
            <span><strong id="nw-stat-fame">${fame}</strong>Actor Fame</span>
            <span><strong id="nw-stat-royalties">${naira(totalRoyalties)}</strong>Total Box Office</span>
          </div>
        </div>
        ${stageHtml}
        ${activeHtml}
        ${chips('nw.tab', tab, [
          ['casting', `🎬 Casting Calls (${nw.calls().length})`],
          ['films', `🎞️ Filmography (${films.length})`],
        ])}
        <div class="nl-list" style="margin-top:8px;">
          ${bodyHtml}
        </div>
      `,
    };
  },

  async act(host, action, el) {
    const nw = Nollywood.get();
    if (action === 'audition') {
      const id = el.dataset.id || '';
      const res = nw.startAudition(id);
      if (!res.ok) {
        host.say(res.reason ?? 'Cannot audition right now.', 'bad');
        return;
      }
      host.refresh();
      return;
    }
    if (action === 'deliver') {
      const res = await nw.deliverLine();
      if (!res.ok && res.reason) host.say(res.reason, 'bad');
      host.refresh();
      return;
    }
    if (action === 'cancel-audition') {
      nw.cancelAudition();
      host.refresh();
      return;
    }
    if (action === 'cab') {
      const venue = el.dataset.venue || '';
      if (!venue) return;
      host.close();
      PlaceOpeners.open(`ride:roadside-${venue}`);
      return;
    }
    if (action === 'collect') {
      const paid = await nw.checkTakings();
      if (paid <= 0) {
        host.say('No new daily box-office takings are due yet.', 'info');
      } else {
        host.say(`Collected ${naira(paid)} in box-office takings.`, 'good');
      }
      host.refresh();
    }
  },
};
