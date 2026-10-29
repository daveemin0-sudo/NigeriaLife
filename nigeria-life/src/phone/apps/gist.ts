import type { PhoneApp } from '../PhoneApp';
import { esc, naira } from '../../ui/kit/html';
import { GistTimes } from '../../life/GistTimes';
import { Hustles } from '../../life/Hustles';
import { Ladder } from '../../life/Ladder';
import { Album } from '../../life/Album';
import { upcoming, EventClock } from '../../interiors/places/LiveEvents';
import { PLACE_SPECS } from '../../interiors/places/PlaceSpecs';
import { EMPLOYERS } from '../../jobs/employers';
import { Land } from '../../realestate/Land';
import { ROADSIDE, SIDE_PLACES } from '../../world/expressway/layout';

/**
 * The Gist Times on the phone: a new edition each morning, made from Lagos as it is. The
 * front page leads with the player when they have done something worth printing; then the
 * hustle of the day, what is on tonight, the riddle of the day, a tip-off about an agama,
 * the market report, situations vacant, land for sale and the gossip.
 */

/** Who governs Lagos, from the State House (set by the game) */
export const GistWorld: { governor: () => string | null } = { governor: () => null };

const CSS = `
.gt{background:#f6f1e3;color:#1c1917;border-radius:14px;padding:14px 14px 18px;font-family:Georgia,'Times New Roman',serif;box-shadow:0 6px 18px rgba(0,0,0,.35)}
.gt-mast{text-align:center;border-bottom:3px double #1c1917;padding-bottom:6px}
.gt-mast h1{margin:0;font:900 38px/1 'Times New Roman',Georgia,serif;letter-spacing:1px}
.gt-dateline{display:flex;justify-content:space-between;font:700 10px/1.4 Arial,sans-serif;text-transform:uppercase;letter-spacing:.8px;border-bottom:1px solid #1c1917;padding:4px 0;margin-bottom:10px}
.gt-lead{font:900 22px/1.15 'Times New Roman',Georgia,serif;margin:6px 0}
.gt-pic{font-size:46px;text-align:center;background:#e7dfc8;border-radius:8px;padding:10px;margin:6px 0}
.gt-p{font-size:14px;line-height:1.45;margin:6px 0}
.gt-h{font:800 12px/1 Arial,sans-serif;text-transform:uppercase;letter-spacing:1.4px;border-top:2px solid #1c1917;padding-top:7px;margin:14px 0 6px}
.gt-li{font-size:13.5px;line-height:1.4;padding:5px 0;border-bottom:1px dotted #a8a29e}
.gt-box{border:2px solid #1c1917;padding:10px;margin-top:8px;background:#fffdf5}
.gt-cols{display:grid;grid-template-columns:1fr 1fr;gap:10px}
.gt-num{font:800 15px Arial,sans-serif}
.gt-up{color:#15803d}.gt-down{color:#b91c1c}
`;
let styled = false;

function seeded(date: string): () => number {
  let h = 2166136261;
  for (const ch of `gist:${date}`) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); }
  return () => { h ^= h << 13; h ^= h >>> 17; h ^= h << 5; return ((h >>> 0) % 100000) / 100000; };
}

const GOSSIP = [
  'Which Banana Island landlord’s convoy held up Third Mainland Bridge for forty minutes on Sunday? Our lips are sealed.',
  'Mama Ronke says she has not lost a game of Ayo in thirty years. Who will humble her? (Phone → Naija Games)',
  'Danfo drivers at Oshodi say the new fare is “wickedness”. Conductors say “enter with your change”.',
  'NEPA brought light for eighteen hours straight in Surulere yesterday. Residents are still in shock.',
  'A Lekki big boy was spotted buying a G-Wagon in cash at Sankofa Motors. The salesman has not stopped smiling.',
  'They say the DJ at Quilox stopped the music twice last night for one table. Platinum things.',
  'Agbero wahala at Ojuelegba again: a driver paid three times for the same ticket.',
  'Iya Shitta’s gbegiri finished by one o’clock. Latecomers left with only ewedu and regret.',
  'An Abuja politician was seen at Freedom Park reading poetry. Campaign season, abi?',
  'Word on the street: a ₦1 billion owambe is being planned for the Eko Grand this weekend.',
];

const placeName = (key: string) => PLACE_SPECS.find((p) => p.key === key)?.name ?? key.replace(/-/g, ' ');

export const gistApp: PhoneApp = {
  id: 'gist',
  aliases: ['news'],
  name: 'Gist Times',
  icon: '📰',
  tint: ['#1c1917', '#78716c'],
  purpose: "Lagos's paper: a new edition every morning",

  badge() {
    return GistTimes.get().riddle().solved ? 0 : 1;
  },

  render(host) {
    if (!styled) {
      styled = true;
      const el = document.createElement('style');
      el.textContent = CSS;
      document.head.appendChild(el);
    }
    const g = GistTimes.get();
    const edition = GistTimes.edition();
    const rnd = seeded(edition);
    const when = new Date(`${edition}T12:00:00Z`).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
    const number = Math.max(1, Math.floor((Date.parse(`${edition}T12:00:00Z`) - Date.UTC(2026, 9, 1)) / 86_400_000) + 1);
    const about = g.gist();
    const now = EventClock.now();
    const shows = upcoming(now.day, now.hour).slice(0, 3);
    const lad = Ladder.get();
    const governor = GistWorld.governor();
    const weather = host.world.weather() === 'rainy' ? '🌧️ Rain this afternoon. Carry umbrella, avoid Ikorodu Road.' : '☀️ Sunny and hot, 32°C. Harmattan haze in the evening.';
    // The lead: the player if there is gist about them, otherwise tonight's show or the State House
    const lead = about[0]
      ? { pic: '📸', head: 'EXCLUSIVE: ' + about[0].split('.')[0].replace(/^@/, '@'), body: about[0] }
      : shows[0]
        ? { pic: '🎤', head: `${shows[0].live ? 'LIVE NOW' : 'TONIGHT'}: ${shows[0].event.title.toUpperCase()}`, body: `${shows[0].event.who} at ${placeName(shows[0].event.venue)}, ${shows[0].when}. Lagos is going to be on fire.` }
        : { pic: '🏛️', head: governor ? `GOVERNOR @${governor.toUpperCase()} SIGNS NEW LAWS` : 'WHO WILL BE THE NEXT GOVERNOR OF LAGOS?', body: governor ? 'The State House says roads and markets come first this week.' : 'The weekly election is open at Polling Unit 001. Register, campaign, vote.' };
    const hustles = Hustles.get().hustles();
    const riddle = g.riddle();
    // An agama not yet caught, named by the place it is on
    const fronts = [...ROADSIDE.map((p) => p.id), ...SIDE_PLACES.map((p) => p.id)].filter((id) => !Album.get().hasAgama(`agama-${id}`) && !/beach|marina|airfield|golf/.test(id));
    const agamaAt = fronts.length ? fronts[Math.floor(rnd() * fronts.length)] : null;
    const price = (base: number, spread: number) => Math.round((base + (rnd() - 0.5) * spread) / 10) * 10;
    const prices: Array<[string, number, number]> = [
      ['Petrol, a litre', price(1150, 120), rnd() < 0.5 ? 1 : -1],
      ['Dollar (parallel)', price(1650, 120), rnd() < 0.55 ? 1 : -1],
      ['Rice, 50kg bag', price(85_000, 9000), rnd() < 0.5 ? 1 : -1],
      ['Garri, a paint', price(4200, 900), rnd() < 0.5 ? 1 : -1],
      ['Tomatoes, a basket', price(38_000, 12_000), rnd() < 0.5 ? 1 : -1],
      ['Diesel, a litre', price(1350, 150), rnd() < 0.5 ? 1 : -1],
    ];
    const jobs = [...EMPLOYERS].sort(() => rnd() - 0.5).slice(0, 3);
    const plots = Land.get().plots('lagos').filter((p) => Land.get().status(p.id) === 'available').sort(() => rnd() - 0.5).slice(0, 3);
    const gossip = [...GOSSIP].sort(() => rnd() - 0.5).slice(0, 3);
    return {
      title: 'Gist Times',
      body: `
        <div class="gt" id="gist-times">
          <div class="gt-mast"><h1>GIST TIMES</h1><div style="font:italic 12px Georgia,serif">"If it happened in Lagos, we know am"</div></div>
          <div class="gt-dateline"><span>No. ${number}</span><span>${esc(when)}</span><span>₦300</span></div>
          <div class="gt-pic">${lead.pic}</div>
          <div class="gt-lead" id="gist-lead">${esc(lead.head)}</div>
          <p class="gt-p">${esc(lead.body)}</p>
          <p class="gt-p" style="font-size:12px;color:#57534e">${esc(weather)}</p>

          <div class="gt-h">Riddle of the day</div>
          <div class="gt-box" id="gist-riddle">
            <div class="gt-p" style="margin-top:0"><i>${esc(riddle.text)}</i></div>
            <div class="gt-p" style="margin-bottom:0;font:700 13px Arial,sans-serif">${riddle.solved ? `✅ Solved: ${esc(riddle.answer)}` : `Go into the place to win ${naira(riddle.reward)}`}</div>
          </div>

          <div class="gt-h">The hustle of the day</div>
          ${hustles.map((h) => `<div class="gt-li">${h.icon} ${esc(h.title)} ${h.done ? '✅' : ''}</div>`).join('')}

          ${about.length > 1 ? `<div class="gt-h">People are talking</div>${about.slice(1).map((t) => `<div class="gt-li">🗣️ ${esc(t)}</div>`).join('')}` : ''}

          <div class="gt-h">What's on</div>
          ${shows.length ? shows.map((s) => `<div class="gt-li">${s.live ? '🔴' : '🎟️'} <b>${esc(s.event.title)}</b>, ${esc(s.event.who)} · ${esc(placeName(s.event.venue))} · ${esc(s.when)}</div>`).join('') : '<div class="gt-li">A quiet day. The beach is open.</div>'}

          ${agamaAt ? `<div class="gt-h">Agama watch</div><div class="gt-li">🦎 Residents report an agama doing push-ups on the front of <b>${esc(placeName(agamaAt))}</b>. Catch it before it runs. (${Album.get().agamas}/40 caught)</div>` : ''}

          <div class="gt-h">Market report</div>
          <div class="gt-cols">${prices.map(([name, value, dir]) => `<div class="gt-li">${esc(name)}<br><span class="gt-num">${naira(value)}</span> <span class="${dir > 0 ? 'gt-down' : 'gt-up'}">${dir > 0 ? '▲' : '▼'}</span></div>`).join('')}</div>

          <div class="gt-h">Situations vacant</div>
          ${jobs.map((j) => `<div class="gt-li">💼 <b>${esc(j.name)}</b> wants a ${esc(j.grades[0]?.title ?? j.trade)}: ${naira(j.grades[0]?.pay ?? 0)} a ${esc(j.task.split(' ')[0] === 'One' ? 'piece' : 'shift')}. Apply in person.</div>`).join('')}

          ${plots.length ? `<div class="gt-h">Land for sale</div>${plots.map((p) => `<div class="gt-li">🏗️ ${esc(p.name)}, ${esc(p.street)}, ${esc(p.neighbourhood)}: <b>${naira(p.statePrice)}</b>. C of O ready.</div>`).join('')}` : ''}

          <div class="gt-h">Gist corner</div>
          ${gossip.map((t) => `<div class="gt-li">👀 ${esc(t)}</div>`).join('')}

          <div class="gt-h">Our readers</div>
          <div class="gt-li">${esc(lad.current.icon)} You are a ${esc(lad.current.title)} in ${esc(lad.current.area)}. ${lad.next ? `Next stop: ${esc(lad.next.area)}.` : 'The very top of Lagos.'} 🔥 ${Hustles.get().streak}-day streak.</div>
        </div>`,
    };
  },
};
