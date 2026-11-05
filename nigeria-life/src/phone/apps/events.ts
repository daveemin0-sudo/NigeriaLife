import type { PhoneApp } from '../PhoneApp';
import { esc, naira, row, empty } from '../../ui/kit/html';
import { EventClock, upcoming } from '../../interiors/places/LiveEvents';
import { PLACE_SPECS } from '../../interiors/places/PlaceSpecs';
import { PlaceOpeners } from '../../interiors/places/PlaceInterior';

/**
 * What's on: the shows, services and matches at the venues, the ones on now first, each with a
 * cab there.
 */

const ICONS: Record<string, string> = { concert: '🎷', comedy: '🎤', talk: '💡', service: '⛪', match: '⚽', party: '🎧' };

export const eventsApp: PhoneApp = {
  id: 'events',
  name: 'What’s on',
  icon: '🎟️',
  tint: ['#be123c', '#fb7185'],
  purpose: 'Shows, services and matches at the venues, today and this week',

  badge() {
    const { day, hour } = EventClock.now();
    return upcoming(day, hour).filter((u) => u.live).length;
  },

  render() {
    const { day, hour } = EventClock.now();
    const list = upcoming(day, hour);
    const venue = (key: string) => PLACE_SPECS.find((spec) => spec.key === key)?.name ?? key;
    const line = (u: (typeof list)[number]) => row({
      icon: ICONS[u.event.kind] ?? '🎟️',
      title: `${u.live ? '<span class="nl-tag nl-tag--live">LIVE</span> ' : ''}${esc(u.event.title)}`,
      sub: `${esc(venue(u.event.venue))} · ${esc(u.event.who)} · ${esc(u.when)}`,
      trailing: `<span class="nl-stack"><strong>${u.event.price ? naira(u.event.price) : 'Free'}</strong><button class="nl-btn nl-btn--sm" data-act="go" data-arg="${esc(u.event.venue)}">🚕 Go</button></span>`,
      attrs: `data-event="${esc(u.event.id)}"`,
      tag: 'div',
    });
    const live = list.filter((u) => u.live);
    const later = list.filter((u) => !u.live);
    return {
      title: 'What’s on',
      body: `
        <div class="nl-section">On now</div>
        <div class="nl-list" id="events-live">${live.length ? live.map(line).join('') : empty('🌙', 'Nothing on just now', 'See what is coming up below.')}</div>
        <div class="nl-section">Coming up</div>
        <div class="nl-list" id="events-later">${later.map(line).join('')}</div>
      `,
    };
  },

  act(host, action, el) {
    if (action !== 'go') return;
    host.close();
    PlaceOpeners.open(`ride:roadside-${el.dataset.arg}`);
  },
};
