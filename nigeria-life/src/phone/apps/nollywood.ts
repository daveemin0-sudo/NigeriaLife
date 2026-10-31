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
    .nw-root { padding: 4px 2px 18px; display: flex; flex-direction: column; gap: 10px; color: var(--lx-ink, #0f172a); font-family: var(--lx-font, system-ui); }
    .nw-hero {
      padding: 12px 14px; border-radius: 16px;
      background: linear-gradient(135deg, #451a03 0%, #7c2d12 55%, #b45309 100%);
      color: #fff; box-shadow: var(--lx-shadow-sm, 0 4px 12px rgba(0,0,0,.08));
    }
    .nw-hero-top { display: flex; justify-content: space-between; align-items: baseline; gap: 8px; }
    .nw-hero-tag { font-size: 10px; font-weight: 900; letter-spacing: .12em; text-transform: uppercase; color: #fde68a; }
    .nw-hero-fame { font-size: 12px; font-weight: 900; color: #fef08a; background: rgba(0,0,0,0.28); padding: 2px 8px; border-radius: 999px; }
    .nw-hero h3 { margin: 4px 0 2px; font-size: 16px; font-weight: 900; letter-spacing: -.02em; }
    .nw-hero p { margin: 0; font-size: 11px; color: rgba(255,255,255,.86); line-height: 1.35; }
    .nw-stats {
      margin-top: 8px; padding-top: 8px; border-top: 1px solid rgba(255,255,255,.16);
      display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; font-size: 11px;
    }
    .nw-stats div b { display: block; font-size: 13px; font-weight: 900; color: #fef08a; font-variant-numeric: tabular-nums; }
    .nw-stage {
      padding: 12px 14px; border-radius: 14px;
      background: #0f172a; color: #f8fafc;
      border: 1.5px solid #f59e0b; box-shadow: var(--lx-shadow-sm, 0 4px 12px rgba(0,0,0,.08));
      display: flex; flex-direction: column; gap: 8px;
    }
    .nw-stage-head { display: flex; justify-content: space-between; align-items: center; font-size: 11px; font-weight: 800; color: #fbbf24; text-transform: uppercase; letter-spacing: .06em; }
    .nw-line {
      margin: 2px 0; padding: 10px 12px; border-radius: 10px;
      background: rgba(255,255,255,.07); font-size: 13px; font-weight: 800; line-height: 1.35; color: #fff;
      font-style: italic;
    }
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
    .nw-stage-actions { display: flex; gap: 8px; }
    .nw-deliver {
      flex: 1; padding: 9px 12px; border-radius: 10px; border: 0;
      background: #f59e0b; color: #0f172a; font-family: inherit; font-size: 12px; font-weight: 900; cursor: pointer;
    }
    .nw-cancel {
      padding: 9px 12px; border-radius: 10px; border: 1px solid rgba(255,255,255,.25);
      background: transparent; color: #cbd5e1; font-family: inherit; font-size: 11px; font-weight: 700; cursor: pointer;
    }
    .nw-callsheet {
      padding: 12px; border-radius: 14px;
      background: var(--lx-surface-solid, #fff); border: 1.5px solid #d97706;
      display: flex; flex-direction: column; gap: 6px; color: var(--lx-ink, #0f172a);
    }
    .nw-callsheet-tag { font-size: 10px; font-weight: 900; text-transform: uppercase; letter-spacing: .08em; color: #b45309; }
    .nw-callsheet-title { font-size: 14px; font-weight: 900; color: var(--lx-ink, #0f172a); }
    .nw-callsheet-sub { font-size: 11px; color: var(--lx-dim, #64748b); line-height: 1.35; }
    .nw-cab {
      align-self: flex-start; margin-top: 2px; padding: 7px 12px; border-radius: 10px; border: 0;
      background: var(--lx-brand, #0b7a43); color: #fff; font-family: inherit; font-size: 11px; font-weight: 800; cursor: pointer;
    }
    .nw-card {
      padding: 12px; border-radius: 14px;
      background: var(--lx-surface-solid, #fff); border: 1px solid var(--lx-line, rgba(0,0,0,.08));
      box-shadow: var(--lx-shadow-sm, 0 4px 12px rgba(0,0,0,.08));
      display: flex; flex-direction: column; gap: 6px; color: var(--lx-ink, #0f172a);
    }
    .nw-card-top { display: flex; justify-content: space-between; align-items: flex-start; gap: 8px; }
    .nw-title { font-size: 14px; font-weight: 900; letter-spacing: -.01em; color: var(--lx-ink, #0f172a); }
    .nw-genre {
      padding: 2px 8px; border-radius: 999px; font-size: 10px; font-weight: 800;
      background: var(--lx-surface-2, #f1f5f9); color: var(--lx-dim, #64748b); white-space: nowrap;
    }
    .nw-meta { font-size: 11px; font-weight: 700; color: var(--lx-dim, #64748b); }
    .nw-syn { font-size: 11.5px; color: var(--lx-ink, #0f172a); line-height: 1.35; }
    .nw-terms {
      display: flex; flex-wrap: wrap; gap: 8px; padding-top: 4px;
      font-size: 11px; font-weight: 800; color: var(--lx-ink, #0f172a);
    }
    .nw-terms span { background: var(--lx-surface-2, #f1f5f9); padding: 3px 8px; border-radius: 8px; color: var(--lx-ink, #0f172a); }
    .nw-foot { display: flex; justify-content: space-between; align-items: center; gap: 8px; margin-top: 2px; }
    .nw-btn {
      padding: 7px 12px; border-radius: 10px; border: 0;
      background: var(--lx-brand, #0b7a43); color: #fff; font-family: inherit; font-size: 11px; font-weight: 800; cursor: pointer;
    }
    .nw-btn:disabled { opacity: 0.45; cursor: default; }
    .nw-stars { color: #d97706; font-weight: 900; letter-spacing: 1px; }
    .nw-royalty {
      padding: 8px 10px; border-radius: 10px; background: var(--lx-surface-2, #f1f5f9);
      display: flex; justify-content: space-between; align-items: center; font-size: 11px; font-weight: 700; color: var(--lx-ink, #0f172a);
    }
    .nw-collect {
      align-self: stretch; padding: 9px 12px; border-radius: 10px; border: 1px solid var(--lx-line, rgba(0,0,0,.12));
      background: var(--lx-surface-solid, #fff); color: var(--lx-ink, #0f172a); font-family: inherit; font-size: 11.5px; font-weight: 800; cursor: pointer;
    }
    .nw-list { display: flex; flex-direction: column; gap: 10px; }
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

  return `<article class="nw-card" data-casting="${esc(c.id)}">
    <div class="nw-card-top">
      <div>
        <div class="nw-title">${esc(c.title)}</div>
        <div class="nw-meta">${esc(c.studio)} · Dir. ${esc(c.director)}</div>
      </div>
      <span class="nw-genre">${esc(c.genre)}</span>
    </div>
    <div class="nw-syn">${esc(c.synopsis)}</div>
    <div class="nw-terms">
      <span>🎭 Role: ${esc(c.role)}</span>
      <span>📍 Set: ${esc(c.venueName)}</span>
      <span>🎬 Wrap: ${naira(c.shootPay)}</span>
      <span>📈 Royalties: ${naira(c.dailyRoyalty)}/day × ${RELEASE_DAYS}d</span>
      <span>⭐ +${c.fameGain} Fame</span>
    </div>
    <div class="nw-foot">
      <span class="nw-meta">${c.minFame > 0 ? `Min. Fame: ${c.minFame}` : 'Open casting call'}</span>
      <button type="button" class="nw-btn" ${canAudition ? `data-act="audition" data-id="${esc(c.id)}"` : 'disabled'}>${esc(label)}</button>
    </div>
  </article>`;
};

const renderFilm = (f: ReleasedFilm): string => {
  const stars = '★'.repeat(f.stars) + '☆'.repeat(3 - f.stars);
  const runDone = f.daysPaid >= f.totalDays;
  return `<article class="nw-card" data-film="${esc(f.filmId)}">
    <div class="nw-card-top">
      <div>
        <div class="nw-title">${esc(f.title)} <span class="nw-stars">${stars}</span></div>
        <div class="nw-meta">As ${esc(f.role)} · ${esc(f.studio)} · Shot at ${esc(f.venueName)}</div>
      </div>
      <span class="nw-genre">+${f.fameEarned} Fame</span>
    </div>
    <div class="nw-terms">
      <span>🎬 Wrap pay: ${naira(f.shootPay + f.tip)}${f.tip > 0 ? ` (incl. ${naira(f.tip)} bonus)` : ''}</span>
      <span>🎟️ Royalty rate: ${naira(f.dailyTaking)}/day</span>
    </div>
    <div class="nw-royalty">
      <span>Box-office run: Day ${f.daysPaid} of ${f.totalDays}${runDone ? ' (Complete)' : ' (In cinemas)'}</span>
      <b>Takings: ${naira(f.totalTakings)}</b>
    </div>
  </article>`;
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
      ? `<section class="nw-stage" id="nw-audition-stage">
          <div class="nw-stage-head">
            <span>🎬 Audition · ${esc(audition.title)} (${esc(audition.role)})</span>
            <span>Take ${audition.takeIndex + 1} of 3</span>
          </div>
          <div class="nw-line">"${esc(audition.lines[audition.takeIndex])}"</div>
          <div class="nw-bar" id="nw-audition-bar">
            <div class="nw-ok"></div>
            <div class="nw-sweet"></div>
            <div class="nw-pin" style="left:${Math.round(audition.pinAt * 100)}%"></div>
          </div>
          <div class="nw-takes">
            ${[0, 1, 2]
              .map((i) => {
                const hit = audition.hits[i];
                const cls = hit ? `nw-take-pill ${hit}` : 'nw-take-pill';
                const label = hit === 'good' ? `Take ${i + 1}: Perfect` : hit === 'ok' ? `Take ${i + 1}: Good` : hit === 'miss' ? `Take ${i + 1}: Flat` : `Take ${i + 1}`;
                return `<span class="${cls}">${label}</span>`;
              })
              .join('')}
          </div>
          <div class="nw-stage-actions">
            <button type="button" class="nw-deliver" data-act="deliver">🎬 Deliver line now</button>
            <button type="button" class="nw-cancel" data-act="cancel-audition">Cancel</button>
          </div>
        </section>`
      : '';

    const activeHtml = active
      ? `<section class="nw-callsheet" id="nw-active-role">
          <div class="nw-callsheet-tag">📋 Call Sheet · On Location</div>
          <div class="nw-callsheet-title">${esc(active.title)} — ${esc(active.role)} (${'★'.repeat(active.auditionStars)}${'☆'.repeat(3 - active.auditionStars)})</div>
          <div class="nw-callsheet-sub">Director ${esc(active.director)} (${esc(active.studio)}) is waiting on set at <b>${esc(active.venueName)}</b>. Wrap pay: <b>${naira(active.shootPay)}</b> + 5 days of box-office takings.</div>
          <button type="button" class="nw-cab" data-act="cab" data-venue="${esc(active.venueKey)}">🚕 Take a cab to ${esc(active.venueName)}</button>
        </section>`
      : '';

    const bodyHtml =
      tab === 'films'
        ? `<button type="button" class="nw-collect" data-act="collect">🎬 Check box-office takings</button>` +
          (films.length > 0
            ? films.map(renderFilm).join('')
            : empty('🎞️', 'No films released yet', 'Audition for a casting call and shoot your scene at the venue to release your first Nollywood film.'))
        : nw
            .calls()
            .map((c) => renderCall(c, fame, active?.filmId ?? null))
            .join('');

    return {
      title: 'Nollywood',
      body: `<div class="nw-root">
        <div class="nw-hero">
          <div class="nw-hero-top">
            <span class="nw-hero-tag">Lagos Film Guild</span>
            <span class="nw-hero-fame" id="nw-fame-badge">⭐ ${fame} Fame · ${esc(fameTitle)}</span>
          </div>
          <h3>Nollywood Casting & Box Office</h3>
          <p>Audition in a three-take scene test, shoot on location at a real Lagos venue, and collect daily box-office takings after release.</p>
          <div class="nw-stats">
            <div>Films shot<b id="nw-stat-films">${films.length}</b></div>
            <div>Fame<b id="nw-stat-fame">${fame}</b></div>
            <div>Royalties<b id="nw-stat-royalties">${naira(totalRoyalties)}</b></div>
          </div>
        </div>
        ${stageHtml}
        ${activeHtml}
        ${chips('nw.tab', tab, [
          ['casting', `🎬 Casting Calls (${nw.calls().length})`],
          ['films', `🎞️ Filmography (${films.length})`],
        ])}
        <div class="nw-list">${bodyHtml}</div>
      </div>`,
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
