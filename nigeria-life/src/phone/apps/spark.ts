import type { PhoneApp, PhoneHost } from '../PhoneApp';
import type { PhoneMessage } from '../../backend/types';
import { Spark, SPARK_PROFILES, type SparkActiveDate, type SparkProfile, type SparkProfileId } from '../../social/Spark';
import { chips, empty, esc, naira } from '../../ui/kit/html';

type SparkTab = 'discover' | 'chat' | 'dates';

let syncedAt = 0;
let styled = false;

const style = (): void => {
  if (styled || typeof document === 'undefined') return;
  styled = true;
  const el = document.createElement('style');
  el.id = 'nl-spark-style';
  el.textContent = `
    .sp-root { padding: 4px 2px 18px; display: flex; flex-direction: column; gap: 10px; color: var(--lx-ink, #0f172a); font-family: var(--lx-font, system-ui); }
    .sp-hero {
      padding: 11px 13px; border-radius: 16px;
      background: linear-gradient(135deg, #881337 0%, #be123c 55%, #db2777 100%);
      color: #fff; box-shadow: var(--lx-shadow-sm, 0 4px 12px rgba(0,0,0,.08));
    }
    .sp-hero-top { display: flex; justify-content: space-between; align-items: center; gap: 8px; }
    .sp-hero-tag { font-size: 10px; font-weight: 800; text-transform: uppercase; letter-spacing: .06em; opacity: .9; }
    .sp-hero-badge { font-size: 11px; font-weight: 800; padding: 3px 9px; border-radius: 999px; background: rgba(255,255,255,.18); }
    .sp-hero h3 { margin: 4px 0 2px; font-size: 16px; font-weight: 800; }
    .sp-hero p { margin: 0; font-size: 11.5px; opacity: .92; line-height: 1.35; }
    .sp-banner {
      padding: 10px 12px; border-radius: 14px;
      background: linear-gradient(135deg, rgba(225,29,72,.14), rgba(147,51,234,.12));
      border: 1px solid rgba(225,29,72,.35);
      display: flex; justify-content: space-between; align-items: center; gap: 8px;
    }
    .sp-pills { display: flex; flex-wrap: wrap; gap: 5px; }
    .sp-pill {
      padding: 5px 10px; border-radius: 999px; font-size: 11px; font-weight: 700; cursor: pointer;
      border: 1px solid var(--lx-line, #e2e8f0); background: var(--lx-surface, #fff); color: var(--lx-ink, #0f172a);
    }
    .sp-pill.on { background: #be123c; color: #fff; border-color: #be123c; }
    .sp-card {
      padding: 12px; border-radius: 14px; background: var(--lx-surface, #fff);
      border: 1px solid var(--lx-line, #e2e8f0); box-shadow: var(--lx-shadow-xs, 0 2px 6px rgba(0,0,0,.04));
      display: flex; flex-direction: column; gap: 9px;
    }
    .sp-person { display: flex; align-items: center; gap: 10px; }
    .sp-avatar {
      width: 42px; height: 42px; border-radius: 50%; display: flex; align-items: center; justify-content: center;
      font-weight: 800; font-size: 14px; color: #fff; flex-shrink: 0;
    }
    .sp-name { font-size: 15px; font-weight: 800; color: var(--lx-ink, #0f172a); }
    .sp-sub { font-size: 12px; color: var(--lx-muted, #64748b); }
    .sp-bio { font-size: 12.5px; line-height: 1.45; color: var(--lx-ink, #0f172a); word-break: keep-all; overflow-wrap: break-word; }
    .sp-tags { display: flex; flex-wrap: wrap; gap: 5px; }
    .sp-tag { font-size: 10.5px; font-weight: 700; padding: 3px 8px; border-radius: 999px; background: var(--lx-surface-2, #f1f5f9); color: var(--lx-ink-2, #334155); }
    .sp-venue {
      padding: 8px 10px; border-radius: 10px; background: var(--lx-surface-2, #f8fafc);
      border: 1px solid var(--lx-line, #e2e8f0);
    }
    .sp-venue-label { font-size: 10px; font-weight: 800; color: #be123c; text-transform: uppercase; letter-spacing: .04em; }
    .sp-venue-name { font-size: 12.5px; font-weight: 800; color: var(--lx-ink, #0f172a); margin-top: 1px; }
    .sp-venue-dish { font-size: 11px; color: var(--lx-muted, #64748b); margin-top: 1px; }
    .sp-actions { display: grid; grid-template-columns: 1fr 1.35fr; gap: 8px; }
    .sp-btn {
      padding: 9px 10px; border-radius: 10px; font-size: 12px; font-weight: 800; cursor: pointer;
      border: 1px solid var(--lx-line, #cbd5e1); background: var(--lx-surface-2, #f1f5f9); color: var(--lx-ink, #0f172a);
    }
    .sp-btn.primary { background: #be123c; color: #fff; border-color: #be123c; }
    .sp-thread {
      display: flex; flex-direction: column; gap: 6px; max-height: 170px; overflow-y: auto;
      padding: 8px; border-radius: 10px; background: var(--lx-surface-2, #f8fafc); border: 1px solid var(--lx-line, #e2e8f0);
    }
    .sp-msg {
      max-width: 85%; padding: 7px 10px; border-radius: 12px; font-size: 12px; line-height: 1.35;
      word-break: keep-all; overflow-wrap: break-word;
    }
    .sp-msg.them { align-self: flex-start; background: var(--lx-surface, #fff); border: 1px solid var(--lx-line, #e2e8f0); color: var(--lx-ink, #0f172a); }
    .sp-msg.me { align-self: flex-end; background: #be123c; color: #fff; }
    .sp-msg small { display: block; font-size: 9.5px; opacity: .72; margin-top: 2px; }
  `;
  document.head.appendChild(el);
};

function renderAvatar(p: SparkProfile): string {
  const initials = p.name
    .split(' ')
    .map((n) => n[0])
    .join('');
  return `<div class="sp-avatar" style="background:${p.accentColor}">${esc(initials)}</div>`;
}

export const sparkApp: PhoneApp = {
  id: 'spark',
  name: 'Spark',
  icon: '💘',
  tint: ['#be123c', '#ec4899'],
  purpose: 'Profiles of made-up people, matching, chat, and dates at restaurants and lounges',
  badge: (host: PhoneHost) => {
    const spark = Spark.get();
    if (spark.activeDate()) return 1;
    let unread = 0;
    for (const m of spark.matches()) {
      const c = host.messages.contact(m.profile.contactId);
      if (c) unread += c.unread;
    }
    return unread;
  },
  render(host: PhoneHost): { title: string; body: string } {
    style();
    const spark = Spark.get();
    if (Date.now() - syncedAt > 8_000) {
      syncedAt = Date.now();
      void spark.syncFromServer();
    }

    const tab = host.get<SparkTab>('spark-tab', 'discover');
    const selectedId = host.get<SparkProfileId>('spark-selected', 'zainab');
    const matches = spark.matches();
    const activeDate = spark.activeDate();
    const completedDates = spark.completedDates();

    const activeBanner = activeDate
      ? `
        <div class="sp-banner" id="spark-active-date">
          <div>
            <div style="font-size:10px;font-weight:800;color:#be123c;text-transform:uppercase;letter-spacing:.04em;">💘 Date Waiting Now</div>
            <div style="font-size:13px;font-weight:800;margin-top:1px;">${esc(activeDate.name)} at ${esc(activeDate.venueName)}</div>
            <div style="font-size:11px;color:var(--lx-muted,#64748b);">Standing inside ${esc(activeDate.venueName)} · ${naira(activeDate.bill)}</div>
          </div>
          <button class="sp-btn primary" data-act="go-venue" data-venue="${esc(activeDate.venueKey)}" style="padding:7px 10px;font-size:11px;white-space:nowrap;">
            🚕 Go to Venue
          </button>
        </div>
      `
      : '';

    let content = '';

    if (tab === 'discover') {
      const profile = spark.profileFor(selectedId) ?? spark.currentDiscoverProfile();
      const isMatched = spark.isMatched(profile.id);
      const matchState = matches.find((m) => m.profileId === profile.id);

      const selectorPills = SPARK_PROFILES.map((p) => {
        const on = p.id === profile.id;
        const m = spark.isMatched(p.id);
        return `
          <button type="button" class="sp-pill ${on ? 'on' : ''}" data-act="select-profile" data-profile="${esc(p.id)}">
            ${esc(p.name.split(' ')[0])}${m ? ' 💘' : ''}
          </button>
        `;
      }).join('');

      const interestTags = profile.interests
        .map((tag) => `<span class="sp-tag">${esc(tag)}</span>`)
        .join('');

      content = `
        <div class="sp-pills">${selectorPills}</div>
        <div class="sp-card" data-spark-profile="${esc(profile.id)}">
          <div class="sp-person">
            ${renderAvatar(profile)}
            <div style="flex:1;min-width:0;">
              <div style="display:flex;justify-content:space-between;align-items:center;gap:6px;">
                <div class="sp-name">${esc(profile.name)}, ${profile.age}</div>
                <span class="sp-tag" style="${isMatched ? 'background:#ffe4e6;color:#be123c;' : ''}">
                  ${isMatched ? `Matched · ${matchState?.closeness ?? 35}%` : esc(profile.area)}
                </span>
              </div>
              <div class="sp-sub">${esc(profile.title)} · ${esc(profile.area)}</div>
            </div>
          </div>
          <div class="sp-bio">"${esc(profile.bio)}"</div>
          <div class="sp-tags">${interestTags}</div>
          <div class="sp-venue">
            <div class="sp-venue-label">🍷 Favourite Date Spot</div>
            <div class="sp-venue-name">${esc(profile.venueName)} (${esc(profile.venueArea)}) · ${naira(profile.dateBill)}</div>
            <div class="sp-venue-dish">${esc(profile.dateDish)}</div>
          </div>
          <div class="sp-actions">
            ${
              isMatched
                ? `
                  <button type="button" class="sp-btn" data-act="open-chat" data-profile="${esc(profile.id)}">💬 Open Chat</button>
                  <button type="button" class="sp-btn primary" data-act="schedule-date" data-profile="${esc(profile.id)}">🍷 Date at ${esc(profile.venueName)}</button>
                `
                : `
                  <button type="button" class="sp-btn" data-act="pass-profile" data-profile="${esc(profile.id)}">✕ Next Profile</button>
                  <button type="button" class="sp-btn primary" data-act="like-profile" data-profile="${esc(profile.id)}">💘 Like & Match</button>
                `
            }
          </div>
        </div>
      `;
    } else if (tab === 'chat') {
      if (matches.length === 0) {
        content = empty(
          '💘',
          'No Spark matches yet',
          'Tap Like & Match on a profile in Discover to open a conversation in Spark and Messages.',
        );
      } else {
        const activeMatch = matches.find((m) => m.profileId === selectedId) ?? matches[0];
        const p = activeMatch.profile;
        host.messages.markRead(p.contactId);
        const thread = host.messages.thread(p.contactId);

        const matchPills = matches
          .map((m) => {
            const on = m.profileId === p.id;
            const c = host.messages.contact(m.profile.contactId);
            const unread = c?.unread ?? 0;
            return `
              <button type="button" class="sp-pill ${on ? 'on' : ''}" data-act="select-chat" data-profile="${esc(m.profileId)}">
                ${esc(m.profile.name.split(' ')[0])}${unread > 0 ? ` (${unread})` : ''}
              </button>
            `;
          })
          .join('');

        const messagesHtml =
          thread.length === 0
            ? `<div style="font-size:12px;color:var(--lx-muted,#64748b);padding:8px;">Write a message to ${esc(p.name)}!</div>`
            : thread
                .slice(-3)
                .map(
                  (msg: PhoneMessage) => `
                  <div class="sp-msg ${msg.from}">
                    <span>${esc(msg.text)}</span>
                    <small>${esc(msg.at)}</small>
                  </div>
                `,
                )
                .join('');

        const draftKey = `spark.draft.${p.id}`;

        content = `
          <div class="sp-pills">${matchPills}</div>
          <div class="sp-card">
            <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;">
              <div>
                <div class="sp-name" style="font-size:13.5px;">${esc(p.name)} · <span style="color:#be123c;">${activeMatch.closeness}% Closeness</span></div>
                <div class="sp-sub">Spot: ${esc(p.venueName)} (${naira(p.dateBill)})</div>
              </div>
              <button type="button" class="sp-btn primary" data-act="schedule-date" data-profile="${esc(p.id)}" style="padding:6px 10px;font-size:11px;">
                🍷 Book Date
              </button>
            </div>
            <div class="sp-thread" id="spark-msg-thread">
              ${messagesHtml}
            </div>
            <div class="sp-pills">
              <button type="button" class="sp-pill" data-act="quick-msg" data-contact="${esc(p.contactId)}" data-text="Hey ${esc(p.name.split(' ')[0])}! How is ${esc(p.area)} treating you today?">
                👋 Ask about ${esc(p.area)}
              </button>
              <button type="button" class="sp-pill" data-act="quick-msg" data-contact="${esc(p.contactId)}" data-text="Let us meet at ${esc(p.venueName)} for dinner tonight!">
                🍷 Suggest ${esc(p.venueName)}
              </button>
            </div>
            <form class="nl-chat-form" data-form="send-chat" data-arg="${esc(p.contactId)}" data-draft="${esc(draftKey)}">
              <input class="nl-field" id="spark-chat-input" type="text" maxlength="200" autocomplete="off" placeholder="Message ${esc(p.name.split(' ')[0])}…" value="${esc(host.get(draftKey, ''))}" data-bind="${esc(draftKey)}" />
              <button class="nl-btn nl-btn--primary" id="spark-chat-send" type="submit" aria-label="Send">➤</button>
            </form>
          </div>
        `;
      }
    } else {
      const matchCards =
        matches.length === 0
          ? empty('🍷', 'No dates arranged yet', 'Match with someone in Discover first to plan a restaurant or lounge date.')
          : matches
              .map((m) => {
                const p = m.profile;
                const isWaiting = activeDate?.profileId === p.id;
                return `
                  <div class="sp-card" data-spark-date-card="${esc(p.id)}">
                    <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;">
                      <div>
                        <div class="sp-name" style="font-size:13.5px;">${esc(p.name)} <span style="font-size:11px;color:#be123c;">(${m.closeness}% · ${m.datesCount} date${m.datesCount === 1 ? '' : 's'})</span></div>
                        <div class="sp-sub">📍 ${esc(p.venueName)} (${esc(p.venueArea)}) · ${naira(p.dateBill)}</div>
                      </div>
                      ${
                        isWaiting
                          ? `<button type="button" class="sp-btn primary" data-act="go-venue" data-venue="${esc(p.venueKey)}" style="padding:7px 10px;font-size:11px;">🚕 Go Meet</button>`
                          : `<button type="button" class="sp-btn primary" data-act="schedule-date" data-profile="${esc(p.id)}" style="padding:7px 10px;font-size:11px;">🍷 Plan Date</button>`
                      }
                    </div>
                  </div>
                `;
              })
              .join('');

      const historyHtml =
        completedDates.length > 0
          ? completedDates
              .slice(0, 4)
              .map(
                (d: SparkActiveDate) => `
                <div class="sp-card" style="padding:9px 12px;font-size:12px;">
                  <div>❤️ <b>${esc(d.name)}</b> at <b>${esc(d.venueName)}</b> · Paid ${naira(d.bill)}</div>
                </div>
              `,
              )
              .join('')
          : '';

      content = `${matchCards}${historyHtml}`;
    }

    return {
      title: 'Spark',
      body: `
        <div class="sp-root">
          <div class="sp-hero">
            <div class="sp-hero-top">
              <span class="sp-hero-tag">Lagos Dating</span>
              <span class="sp-hero-badge">${matches.length} Match${matches.length === 1 ? '' : 'es'}</span>
            </div>
            <h3>Spark Lagos</h3>
            <p>Match with people across Lagos, chat on Messages, and meet them at real restaurants & lounges.</p>
          </div>
          ${activeBanner}
          ${chips('spark-tab', tab, [
            ['discover', `Discover (${SPARK_PROFILES.length})`],
            ['chat', `Chat (${matches.length})`],
            ['dates', `Dates (${(activeDate ? 1 : 0) + completedDates.length})`],
          ])}
          ${content}
        </div>
      `,
    };
  },

  act(host: PhoneHost, action: string, el: HTMLElement): void {
    const spark = Spark.get();
    const profileId = (el.dataset.profile ?? '') as SparkProfileId;

    if (action === 'select-profile' && profileId) {
      host.set('spark-selected', profileId);
      host.refresh();
      return;
    }
    if (action === 'select-chat' && profileId) {
      host.set('spark-selected', profileId);
      host.refresh();
      return;
    }
    if (action === 'pass-profile') {
      const next = spark.pass(profileId || undefined);
      host.set('spark-selected', next.id);
      host.refresh();
      return;
    }
    if (action === 'like-profile' && profileId) {
      void spark.like(profileId).then((res) => {
        if (!res.ok || !res.profile) {
          host.say(res.reason ?? 'Could not match.', 'bad');
          return;
        }
        host.set('spark-selected', res.profile.id);
        host.say(`💘 Matched with ${res.profile.name}! They sent you a message.`, 'good');
        host.refresh();
      });
      return;
    }
    if (action === 'open-chat' && profileId) {
      host.set('spark-selected', profileId);
      host.set('spark-tab', 'chat');
      host.refresh();
      return;
    }
    if (action === 'schedule-date' && profileId) {
      void (async () => {
        if (!spark.isMatched(profileId)) {
          await spark.like(profileId);
        }
        const res = await spark.scheduleDate(profileId);
        if (!res.ok || !res.profile) {
          host.say(res.reason ?? 'Could not schedule date.', 'bad');
          return;
        }
        host.set('spark-selected', res.profile.id);
        host.say(
          `🍷 Date set! ${res.profile.name} is standing inside ${res.profile.venueName} waiting for you.`,
          'good',
        );
        host.refresh();
      })();
      return;
    }
    if (action === 'go-venue') {
      const venueKey = el.dataset.venue ?? '';
      const dest = host.rides.destinations().find((d) => d.id === `place:${venueKey}`);
      if (dest) {
        const err = host.rides.book(dest.id, 'cab');
        if (!err) {
          host.say(`🚕 Taking a cab to ${dest.name} for your Spark date.`, 'good');
          return;
        }
      }
      host.openApp('ride');
      return;
    }
    if (action === 'quick-msg') {
      const contactId = el.dataset.contact ?? '';
      const text = el.dataset.text ?? '';
      if (!contactId || !text) return;
      const err = host.messages.send(contactId, text);
      if (err) {
        host.say(err, 'bad');
        return;
      }
      host.refresh();
      return;
    }
    if (action === 'send-chat') {
      const contactId = el.dataset.arg ?? '';
      const draftKey = el.dataset.draft ?? '';
      const text = host.get<string>(draftKey, '');
      const err = host.messages.send(contactId, text);
      if (err) {
        host.say(err, 'bad');
        return;
      }
      host.set(draftKey, '');
      host.refresh();
    }
  },
};
