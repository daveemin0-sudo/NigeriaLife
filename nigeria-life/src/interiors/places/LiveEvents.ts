import * as THREE from 'three';
import { Builder, signBoard } from '../../world/kit/ArchKit';
import { HumanMeshBuilder } from '../../graphics/HumanMeshBuilder';
import { bakeToGeometry } from '../../graphics/MeshBaker';
import { Sequence, steps } from '../../interactions/Sequence';
import type { PlaceHost } from '../../destinations/PlaceActions';
import type { PlaceInterior } from './PlaceInterior';

/**
 * Live events at the venues: a timetable by day of the week and hour of the game's clock. While
 * one is on, its venue shows it: someone performing on the stage, a crowd in the seats, a LIVE
 * sign and stage lights. The player buys a ticket and sits in the crowd while the show goes
 * on, dances, takes a photo with the star, asks a question at a talk, gives at a service.
 */

export type EventKind = 'concert' | 'comedy' | 'talk' | 'service' | 'match' | 'party';

export interface LiveEvent {
  id: string;
  /** The place along the road it is held at */
  venue: string;
  title: string;
  /** Who is on stage */
  who: string;
  kind: EventKind;
  /** Days of the week it is on, 0 for Sunday */
  days: number[];
  /** From and to, in hours of the clock (to may be 24) */
  from: number;
  to: number;
  /** A ticket, ₦; nothing for a free event */
  price: number;
}

const EVERY_DAY = [0, 1, 2, 3, 4, 5, 6];
const WEEKDAYS = [1, 2, 3, 4, 5];

export const EVENTS: LiveEvent[] = [
  { id: 'fp-highlife', venue: 'freedom-park', title: 'Highlife & Afrobeat Night', who: 'Sunny & the Highlife Kings', kind: 'concert', days: EVERY_DAY, from: 18, to: 22, price: 5000 },
  { id: 'fp-comedy', venue: 'freedom-park', title: 'Comedy Hour', who: 'MC Lafiaji', kind: 'comedy', days: [6], from: 14, to: 17, price: 3000 },
  { id: 'eko-summit', venue: 'eko-grand-hotel', title: 'Eko Tech Summit', who: 'Ada Okoro, fintech founder', kind: 'talk', days: WEEKDAYS, from: 9, to: 13, price: 15000 },
  { id: 'faith-sunday', venue: 'faith-arena', title: 'Sunday Service', who: 'Pastor Ade', kind: 'service', days: [0], from: 7, to: 12, price: 0 },
  { id: 'faith-vigil', venue: 'faith-arena', title: 'Friday Night Vigil', who: 'Pastor Ade', kind: 'service', days: [5], from: 21, to: 24, price: 0 },
  { id: 'faith-midweek', venue: 'faith-arena', title: 'Midweek Service', who: 'Pastor Ade', kind: 'service', days: [3], from: 18, to: 20, price: 0 },
  { id: 'shrine-thursday', venue: 'afrika-shrine', title: 'Thursday Jam', who: 'The Shrine Afrobeat Band', kind: 'concert', days: [4], from: 20, to: 24, price: 5000 },
  { id: 'shrine-saturday', venue: 'afrika-shrine', title: 'Saturday Night Jam', who: 'The Shrine Afrobeat Band', kind: 'concert', days: [6], from: 20, to: 24, price: 5000 },
  { id: 'rooftop-sunset', venue: 'ivory-rooftop', title: 'Sunset DJ Set', who: 'DJ Kaywise', kind: 'party', days: EVERY_DAY, from: 17, to: 20, price: 10000 },
  { id: 'vc-weekend', venue: 'viewing-centre', title: 'Live football: Super Eagles vs Black Stars', who: 'On the big screen', kind: 'match', days: [0, 6], from: 14, to: 17, price: 1000 },
  { id: 'vc-midweek', venue: 'viewing-centre', title: 'Live football: the Champions League', who: 'On the big screen', kind: 'match', days: [3], from: 20, to: 23, price: 1000 },
  { id: 'beach-party', venue: 'lagoon-beach', title: 'Beach Party', who: 'DJ Spinz', kind: 'party', days: [5, 6, 0], from: 16, to: 21, price: 0 },
];

/** Where things go at each venue while a show is on, in the room's own space */
interface Stage {
  /** Where the star stands, which way they face, how high the stage is */
  performer?: [number, number, number, number];
  /** The crowd: where each stands or sits, which way they face */
  crowd: Array<[number, number, number, boolean]>;
  /** Where the player watches from, and where they stand to go there */
  seat: { at: [number, number]; facing: number; sit: boolean };
  /** The LIVE sign: its middle, its height up the wall, its width */
  sign: [number, number, number, number];
  /** What only stands while a show is on: a stage and chairs set out, lights */
  build?(b: Builder): void;
}

const rows = (xs: number[], zs: number[], facing: number, sit: boolean): Array<[number, number, number, boolean]> => zs.flatMap((z) => xs.map((x): [number, number, number, boolean] => [x, z, facing, sit]));

const STAGES: Record<string, Stage> = {
  'freedom-park': {
    performer: [0, -6.5, 0, 0.7],
    crowd: rows([-3, -1.5, 1.5, 3], [-0.6, 1, 2.6], Math.PI, true),
    seat: { at: [0, 4.2], facing: Math.PI, sit: true },
    // Hung from the front of the stage canopy, where the crowd can see it
    sign: [0, 3.1, -3.3, 6],
    build: (b) => { b.box(0x1f2937, 10, 0.2, 0.2, 0, 4.3, -5.5); for (let i = 0; i < 5; i++) b.box([0xef4444, 0xfacc15, 0x22c55e, 0x3b82f6, 0xf97316][i], 0.4, 0.4, 0.4, -4 + i * 2, 3.9, -5.5, { glow: true }); },
  },
  'eko-grand-hotel': {
    performer: [4, -2.8, 0, 0.5],
    crowd: rows([2.6, 4, 5.4], [0.6, 2], Math.PI, true),
    seat: { at: [6.8, 2], facing: Math.PI, sit: true },
    sign: [4, 2.2, -4.05, 3.6],
    // A low stage set out in the ballroom, a screen behind, rows of chairs
    build: (b) => {
      b.box(0x1f2937, 5, 0.5, 2.2, 4, 0, -2.8).box(0x111827, 0.6, 1.1, 0.5, 2.6, 0.5, -2.4);
      b.box(0x0a0a0a, 4, 1.8, 0.1, 4, 1.3, -4).box(0x38bdf8, 3.8, 1.6, 0.02, 4, 1.4, -3.94, { glow: true });
      for (const [x, z] of rows([2.6, 4, 5.4, 6.8], [0.6, 2], 0, false)) b.box(0xb45309, 0.5, 0.45, 0.5, x, 0, z).box(0xb45309, 0.5, 0.5, 0.08, x, 0.45, z + 0.22);
    },
  },
  // Faith Arena has a service of its own going on all day (Worship.ts): its timetable stays here
  'afrika-shrine': {
    performer: [0, -7.5, 0, 0.7],
    crowd: rows([-4, -2, 0, 2, 4], [-3.6, -1.8], Math.PI, false),
    seat: { at: [-1, -0.2], facing: Math.PI, sit: false },
    sign: [0, 4.3, -9.6, 6],
  },
  'ivory-rooftop': {
    crowd: rows([3.6, 5, 6.4], [-1.2, 0.2], Math.PI, false),
    seat: { at: [4.2, 1.4], facing: Math.PI, sit: false },
    sign: [0, 3.2, -8.6, 5],
  },
  'viewing-centre': {
    crowd: rows([-3.75, -0.75, 0.75, 3.75], [-2, -0.4, 1.2], Math.PI, true),
    seat: { at: [2.25, 2.8], facing: Math.PI, sit: true },
    sign: [5, 3, -7.6, 4],
  },
  'lagoon-beach': {
    crowd: rows([-3, -1.5, 0.5, 2], [0.8, 2.2], Math.PI, false),
    seat: { at: [-2.4, 3.4], facing: Math.PI, sit: false },
    sign: [-1, 3.4, -10, 4],
  },
};

const PEOPLE = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.65 });
const OUTFITS = [0xdc2626, 0x2563eb, 0xfacc15, 0x16a34a, 0xdb2777, 0xf97316, 0x7c3aed, 0xf8fafc, 0x0ea5e9];

/** The clock the timetable runs on (set by the game): the game's day and hour */
export const EventClock: { now: () => { day: number; hour: number } } = { now: () => ({ day: 0, hour: 12 }) };

/** The day of the week a game day falls on, 0 for Sunday: day 0 is Wednesday 7 October */
export const weekday = (day: number) => new Date(2026, 9, 7 + day).getDay();
const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const clock = (hour: number) => `${hour % 12 === 0 ? 12 : hour % 12} ${hour < 12 || hour === 24 ? 'am' : 'pm'}`;

/** What is on at a venue now, if anything */
export function liveAt(venue: string, day: number, hour: number): LiveEvent | null {
  return EVENTS.find((e) => e.venue === venue && e.days.includes(weekday(day)) && hour >= e.from && hour < e.to) ?? null;
}

/** The next time each event is on, from now, over the coming week, soonest first */
export function upcoming(day: number, hour: number, venue?: string): Array<{ event: LiveEvent; day: number; live: boolean; when: string }> {
  const out: Array<{ event: LiveEvent; day: number; live: boolean; when: string; at: number }> = [];
  for (const event of EVENTS) {
    if (venue && event.venue !== venue) continue;
    for (let d = day; d < day + 8; d++) {
      if (!event.days.includes(weekday(d))) continue;
      if (d === day && hour >= event.to) continue;
      const live = d === day && hour >= event.from;
      out.push({ event, day: d, live, when: live ? `on now till ${clock(event.to)}` : `${d === day ? 'today' : d === day + 1 ? 'tomorrow' : DAY_NAMES[weekday(d)]}, ${clock(event.from)} to ${clock(event.to)}`, at: d * 24 + event.from });
      break;
    }
  }
  return out.sort((a, b) => Number(b.live) - Number(a.live) || a.at - b.at);
}

/** Events that came on between one moment and the next (for the "live now" notice) */
export function startedBetween(day0: number, hour0: number, day1: number, hour1: number): LiveEvent[] {
  const t0 = day0 * 24 + hour0;
  const t1 = day1 * 24 + hour1;
  if (t1 <= t0 || t1 - t0 > 2) return [];
  return EVENTS.filter((e) => [day0, day1].some((d) => e.days.includes(weekday(d)) && d * 24 + e.from > t0 && d * 24 + e.from <= t1));
}

const LINES: Record<EventKind, (who: string) => string[]> = {
  concert: (who) => ['The band counts in: one, two, three, four!', `${who} hit the first note and the crowd roars.`, 'Encore! Encore! The whole place is singing.'],
  comedy: (who) => [`${who} grabs the mic: "Lagos people, how una dey?"`, 'A joke about danfo conductors. The crowd is dying.', 'A standing ovation. Your stomach hurts from laughing.'],
  talk: (who) => [`${who} walks on. ON AIR.`, 'Slides on the screen: building a bank for two hundred million people.', 'Applause. You wrote down three ideas.'],
  service: (who) => ['The choir starts, and hands go up across the hall.', `${who}: "Your season of lifting has come!"`, 'The grace. You feel light.'],
  match: () => ['Kick-off! The hall is loud.', 'GOAL! Chairs flying, everybody hugging strangers.', 'Final whistle. The hall goes home happy.'],
  party: (who) => [`${who} drops the beat.`, 'The log drum hits and the floor shakes.', `${who} shouts your section out!`],
};

/** The shows at one venue, in its room */
class VenueShows {
  private readonly room: PlaceInterior;
  private readonly key: string;
  private readonly stage: Stage;
  private readonly group = new THREE.Group();
  private readonly signs = new Map<string, THREE.Mesh>();
  private performer: ReturnType<typeof HumanMeshBuilder.createHuman> | null = null;
  private live: LiveEvent | null = null;
  private since = 0;
  private check = 0;
  /** Tickets bought, by event and day */
  private readonly tickets = new Set<string>();

  constructor(room: PlaceInterior, key: string, stage: Stage) {
    this.room = room;
    this.key = key;
    this.stage = stage;
    this.group.name = `live ${key}`;
    this.group.visible = false;
    room.group.add(this.group);
    if (stage.build) {
      const b = new Builder();
      stage.build(b);
      this.group.add(b.build(`${key} show`));
    }
    // The crowd, each one mesh
    stage.crowd.forEach(([x, z, facing, sit], i) => {
      const female = i % 2 === 1;
      const rig = HumanMeshBuilder.createHuman({ gender: female ? 'female' : 'male', username: '', lod: 'street', outfitColor: OUTFITS[i % OUTFITS.length], outfit: female ? (i % 4 === 1 ? 'blue_dress' : 'casual_blouse') : i % 3 ? 'casual_tee' : 'senator', hairstyle: female ? 'braids' : 'short_crop' });
      rig.nameTag.visible = false;
      if (sit) {
        rig.leftLeg.rotation.x = rig.rightLeg.rotation.x = -1.42;
        if (rig.leftLowerLeg) rig.leftLowerLeg.rotation.x = 1.3;
        if (rig.rightLowerLeg) rig.rightLowerLeg.rotation.x = 1.3;
      } else if (i % 3 === 0) {
        // Hands up for the music
        rig.leftArm.rotation.x = rig.rightArm.rotation.x = -2.6;
      }
      const geo = bakeToGeometry(rig.group);
      if (!geo) return;
      const mesh = new THREE.Mesh(geo, PEOPLE);
      mesh.position.set(x, sit ? -0.3 : 0, z);
      mesh.rotation.y = facing;
      this.group.add(mesh);
    });
    // A LIVE sign for each show held here
    for (const event of EVENTS.filter((e) => e.venue === key)) {
      const sign = signBoard([event.kind === 'talk' ? '● ON AIR' : '● LIVE', event.title], stage.sign[3], stage.sign[3] * 0.32, '#b91c1c', '#ffffff');
      sign.position.set(stage.sign[0], stage.sign[1], stage.sign[2]);
      sign.visible = false;
      this.group.add(sign);
      this.signs.set(event.id, sign);
    }
    room.ticks.push((delta) => this.tick(delta));
    room.addCard({
      id: `event_${key}`,
      name: '🎤 Live events',
      description: 'Shows, services and matches, on the timetable.',
      at: stage.seat.at,
      stand: [stage.seat.at[0], stage.seat.at[1] + 0.9],
      label: () => {
        const { day, hour } = EventClock.now();
        const now = liveAt(key, day, hour);
        if (now) return `🔴 LIVE: ${now.title}${now.price ? ` · ₦${now.price.toLocaleString()}` : ' · free'}`;
        const next = upcoming(day, hour, key)[0];
        return next ? `🗓️ Next: ${next.event.title}, ${next.when}` : '🗓️ No shows this week';
      },
      run: (host) => this.offer(host),
    });
  }

  private setPerformer(event: LiveEvent | null): void {
    if (this.performer) {
      this.group.remove(this.performer.group);
      this.performer = null;
    }
    if (!event || !this.stage.performer) return;
    const [x, z, facing, y] = this.stage.performer;
    const female = /Ada|Sunny/.test(event.who) && event.kind === 'talk';
    const rig = HumanMeshBuilder.createHuman({ gender: female ? 'female' : 'male', username: '', lod: 'street', outfitColor: event.kind === 'service' ? 0x111827 : event.kind === 'talk' ? 0x1e3a8a : 0xf59e0b, outfit: event.kind === 'service' || event.kind === 'talk' ? 'senator' : 'casual_tee', hairstyle: female ? 'braids' : 'short_crop' });
    rig.nameTag.visible = false;
    rig.group.position.set(x, y, z);
    rig.group.rotation.y = facing;
    rig.group.name = `performer ${event.id}`;
    this.group.add(rig.group);
    this.performer = rig;
  }

  private tick(delta: number): void {
    this.since += delta;
    this.check -= delta;
    if (this.check <= 0) {
      this.check = 0.5;
      const { day, hour } = EventClock.now();
      const now = liveAt(this.key, day, hour);
      if (now !== this.live) {
        this.live = now;
        this.group.visible = !!now;
        for (const [id, sign] of this.signs) sign.visible = id === now?.id;
        this.setPerformer(now);
      }
    }
    // The star moves: arms up and down with the music, or the hands of someone talking
    if (this.performer && this.live) {
      const t = this.since;
      const talk = this.live.kind === 'talk' || this.live.kind === 'service' || this.live.kind === 'comedy';
      this.performer.leftArm.rotation.x = talk ? -0.6 + Math.sin(t * 2.2) * 0.35 : -1.4 + Math.sin(t * 5) * 1.1;
      this.performer.rightArm.rotation.x = talk ? -0.3 + Math.sin(t * 1.7 + 1) * 0.3 : -1.4 + Math.sin(t * 5 + Math.PI) * 1.1;
      this.performer.group.rotation.y = (this.stage.performer?.[2] ?? 0) + Math.sin(t * 0.7) * 0.35;
    }
  }

  private offer(host: PlaceHost): void {
    const { day, hour } = EventClock.now();
    const event = liveAt(this.key, day, hour);
    if (!event) {
      const next = upcoming(day, hour, this.key);
      host.ask({ who: 'What’s on', role: 'Timetable', text: next.length ? next.map((n) => `${n.event.title}: ${n.when}`).join('\n') : 'Nothing on this week.', choices: [{ label: 'OK', pick: () => undefined }] });
      return;
    }
    const ticket = `${event.id}:${day}`;
    const has = event.price === 0 || this.tickets.has(ticket);
    const choices: Array<{ label: string; note?: string; pick: () => void }> = [];
    choices.push({
      label: has ? (this.stage.seat.sit ? 'Sit in the crowd and watch' : 'Join the crowd and watch') : `Buy a ticket and ${this.stage.seat.sit ? 'sit in the crowd' : 'join the crowd'}`,
      note: has ? (event.price ? 'Your ticket' : 'Free') : `₦${event.price.toLocaleString()}`,
      pick: () => {
        if (!has) {
          if (!host.backend.pay(event.price, `Ticket: ${event.title}`, 'SHOP_PURCHASE')) {
            host.say(`A ticket is ₦${event.price.toLocaleString()}. You do not have it.`, 'warning');
            return;
          }
          this.tickets.add(ticket);
        }
        this.watch(event, host);
      },
    });
    if (event.kind === 'concert' || event.kind === 'party') choices.push({ label: 'Dance in front of the stage', note: has ? 'Fun +25' : 'With a ticket', pick: () => (has ? this.dance(host) : host.say('Get a ticket first.', 'info')) });
    if (event.kind === 'concert' || event.kind === 'comedy' || event.kind === 'talk') choices.push({ label: `A photo with ${event.who.split(',')[0]}`, note: 'Social +10', pick: () => this.photo(event, host) });
    if (event.kind === 'talk') choices.push({ label: 'Ask a question at the microphone', note: 'Social +15', pick: () => this.ask(event, host) });
    if (event.kind === 'service') choices.push({ label: 'Give an offering', note: '₦5,000', pick: () => { if (host.backend.pay(5000, `Offering, ${event.title}`, 'SHOP_PURCHASE')) { host.backend.modifyNeed('social', 10); host.say('The offering basket came round. God bless you!', 'success'); } } });
    choices.push({ label: 'Not now', pick: () => undefined });
    host.ask({ who: event.title, role: `${event.who} · ${upcoming(day, hour, this.key)[0]?.when ?? ''}`, text: event.kind === 'match' ? 'The match is on the big screen.' : `${event.who} is on now.`, choices });
  }

  /** Sitting (or standing) in the crowd through the show, the show going on as they watch */
  private watch(event: LiveEvent, host: PlaceHost): void {
    if (host.director.interrupt(host.actor) === 'locked') return;
    const [x, z] = this.stage.seat.at;
    const lines = LINES[event.kind](event.who);
    const show = new Sequence(`watch ${event.title}`, [host.actor]);
    show.maxSeconds = 60;
    show.add(
      steps.walk(host.actor, this.room.at(x, z + 0.9), { speed: 3.2 }),
      steps.face(host.actor, this.stage.seat.facing),
      steps.slide(host.actor, this.room.at(x, z), 0.4),
      steps.animate(host.actor, { legs: this.stage.seat.sit ? 'sit' : 'stand', arms: this.stage.seat.sit ? 'rest' : 'wave' }, 12, [
        { at: 0.1, run: () => host.say(lines[0], 'info') },
        { at: 0.5, run: () => host.say(lines[1], 'info') },
        {
          at: 0.97,
          run: () => {
            const be = host.backend;
            if (event.kind === 'talk') { be.modifyNeed('social', 15); be.addSkillExp('academics', 1); be.addSkillExp('coding', 1); }
            else if (event.kind === 'service') { be.modifyNeed('social', 20); be.modifyNeed('fun', 10); }
            else { be.modifyNeed('fun', event.kind === 'comedy' ? 45 : 35); be.modifyNeed('social', 15); }
            host.say(lines[2], 'success');
          },
        },
      ]),
      steps.animate(host.actor, { legs: 'stand', arms: 'rest' }, 0.3),
      steps.slide(host.actor, this.room.at(x, z + 0.9), 0.3)
    );
    host.director.run(show);
  }

  private dance(host: PlaceHost): void {
    const done = host.director.perform({ id: 'dance at the show', actor: host.actor, point: this.room.at(this.stage.seat.at[0], this.stage.seat.at[1] - 1.5), animation: { arms: 'rest' }, seconds: 0.3, effect: () => { host.backend.modifyNeed('fun', 25); host.backend.modifyNeed('social', 10); host.say('Front of the stage, arms up. The whole crowd with you.', 'success'); return true; } });
    if (done.ok) host.emote('zanku', 8);
  }

  private photo(event: LiveEvent, host: PlaceHost): void {
    const spot = this.stage.performer ? this.room.at(this.stage.performer[0] + 1.2, this.stage.performer[1] + 1.8) : this.room.at(this.stage.seat.at[0], this.stage.seat.at[1]);
    host.director.perform({ id: 'photo with the star', actor: host.actor, point: spot, animation: { arms: 'wave' }, seconds: 2, effectAt: 0.8, ifStuck: 'snap', effect: () => { host.backend.modifyNeed('social', 10); host.say(`Click! You and ${event.who.split(',')[0]}, both smiling. It is on your phone.`, 'success'); return true; } });
  }

  private ask(event: LiveEvent, host: PlaceHost): void {
    const mic = this.room.at(this.stage.seat.at[0] - 2, this.stage.seat.at[1] - 1);
    host.director.perform({ id: 'ask a question', actor: host.actor, point: mic, animation: { arms: 'talk' }, seconds: 4, effectAt: 0.9, ifStuck: 'snap', effect: () => { host.backend.modifyNeed('social', 15); host.backend.addSkillExp('charisma', 1); host.say(`"How do we reach the market traders?" ${event.who.split(',')[0]}: "Great question. Find me after."`, 'success'); return true; } });
  }
}

/** Gives a venue's room its shows, if it has any on the timetable */
export function attachShows(room: PlaceInterior, key: string): void {
  const stage = STAGES[key];
  if (stage && EVENTS.some((e) => e.venue === key)) new VenueShows(room, key, stage);
}
