import type { PhoneApp } from '../PhoneApp';
import { esc, naira } from '../../ui/kit/html';
import { Cases, CASES } from '../../life/Cases';
import { PLACE_SPECS } from '../../interiors/places/PlaceSpecs';
import { PlaceOpeners } from '../../interiors/places/PlaceInterior';

/**
 * Naija Detective on the phone: the cases open in Lagos, the notebook of what the witnesses
 * said, the next lead with a cab to it, and, when every clue is in, the accusation.
 */

const placeName = (key: string) => PLACE_SPECS.find((p) => p.key === key)?.name ?? key;
const stars = (n: number) => '★'.repeat(n) + '☆'.repeat(3 - n);

export const casesApp: PhoneApp = {
  id: 'cases',
  name: 'Detective',
  icon: '🔎',
  tint: ['#1e1b4b', '#4338ca'],
  purpose: 'Cases solved by going round Lagos',

  badge() {
    const c = Cases.get().active;
    return c && Cases.get().found(c.id) >= c.witnesses.length ? 1 : 0;
  },

  render(_host, route) {
    const cases = Cases.get();
    if (route.startsWith('c:')) {
      const c = CASES.find((x) => x.id === route.slice(2));
      if (!c) return { title: 'Detective', body: '' };
      const status = cases.status(c);
      const found = cases.found(c.id);
      const lead = status === 'active' ? cases.lead(c) : null;
      const ready = status === 'active' && found >= c.witnesses.length;
      return {
        title: c.title,
        body: `
          <div class="nl-hero nl-hero--indigo"><div class="nl-hero-label">${esc(c.area)} · ${stars(c.stars)}</div><div class="nl-hero-title">${c.icon} ${esc(c.title)}</div><div class="nl-hero-sub">Reward ${naira(cases.reward(c))}</div></div>
          <div class="nl-card"><div class="nl-card-line">${esc(c.intro)}</div></div>
          ${status === 'solved' ? `<div class="nl-card" id="case-solution"><div class="nl-card-title">✅ Solved</div><div class="nl-card-line">${esc(c.solution)}</div></div>` : ''}
          ${status === 'cold' ? '<div class="nl-note nl-note--warn">❄️ This case went cold today. Come back tomorrow.</div>' : ''}
          ${status === 'open' ? `<button class="nl-btn nl-btn--primary nl-btn--block" data-act="take" data-arg="${c.id}" id="case-take">🔎 Take the case</button>` : ''}
          ${status === 'active' || status === 'solved' ? `
            <div class="nl-section">Notebook · ${found}/${c.witnesses.length}</div>
            <div class="nl-list" id="case-notebook">${c.witnesses.slice(0, status === 'solved' ? c.witnesses.length : found).map((w) => `
              <div class="nl-row"><span class="nl-row-icon">📝</span><span class="nl-row-text"><span class="nl-row-title">${esc(w.who)} · ${esc(placeName(w.place))}</span><span class="nl-row-sub">"${esc(w.said)}"</span></span></div>`).join('') || '<div class="nl-hint">Nothing yet. Follow the first lead.</div>'}
            </div>` : ''}
          ${lead ? `
            <div class="nl-section">Next lead</div>
            <div class="nl-card" id="case-lead"><div class="nl-card-title">📍 ${esc(placeName(lead.place))}</div><div class="nl-card-line">${esc(found === 0 ? 'Start where it happened.' : c.witnesses[found - 1].next ?? '')} Someone there is waiting to talk to you: look for 🔎 inside.</div>
              <button class="nl-btn nl-btn--sm" data-act="go" data-arg="${lead.place}">🚕 Take a cab there</button></div>` : ''}
          ${ready ? `
            <div class="nl-section">Who did it?</div>
            <div class="nl-list" id="case-accuse">${c.suspects.map((s, i) => `<button class="nl-row" data-act="accuse" data-arg="${i}"><span class="nl-row-icon">👉</span><span class="nl-row-text"><span class="nl-row-title">${esc(s)}</span><span class="nl-row-sub">Name them. Get it wrong and the case goes cold.</span></span></button>`).join('')}</div>` : ''}`,
      };
    }
    const solved = CASES.filter((c) => cases.status(c) === 'solved').length;
    return {
      title: 'Detective',
      body: `
        <div class="nl-hero nl-hero--indigo"><div class="nl-hero-label">Naija Detective</div><div class="nl-hero-value">${solved}/${CASES.length} solved</div><div class="nl-hero-sub">Go round Lagos, question the witnesses, name who did it.</div></div>
        <div class="nl-list" id="case-list">${CASES.map((c) => {
          const st = cases.status(c);
          const tag = st === 'solved' ? '✅ Solved' : st === 'active' ? `🔎 ${cases.found(c.id)}/${c.witnesses.length} clues` : st === 'cold' ? '❄️ Cold till tomorrow' : naira(cases.reward(c));
          return `<button class="nl-row" data-act="open" data-arg="${c.id}"><span class="nl-row-icon">${c.icon}</span><span class="nl-row-text"><span class="nl-row-title">${esc(c.title)}</span><span class="nl-row-sub">${esc(c.area)} · ${stars(c.stars)} · ${tag}</span></span><span class="nl-row-trail">›</span></button>`;
        }).join('')}</div>`,
    };
  },

  act(host, action, el, route) {
    const arg = el.dataset.arg ?? '';
    if (action === 'open') host.go(`c:${arg}`);
    else if (action === 'take') {
      if (Cases.get().take(arg)) host.say('Case taken. Follow the lead.', 'good');
      host.refresh();
    } else if (action === 'go') {
      host.close();
      PlaceOpeners.open(`ride:roadside-${arg}`);
    } else if (action === 'accuse') {
      const right = Cases.get().accuse(parseInt(arg, 10));
      host.say(right ? 'Case solved!' : 'Wrong person. The case has gone cold.', right ? 'good' : 'bad');
      host.refresh();
      void route;
    }
  },
};
