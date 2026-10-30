import { Activity, type ActivityEvent } from './Activity';
import { lagosDate, Hustles, XP } from './Hustles';
import { Ladder } from './Ladder';

/**
 * The Gist Times: Lagos's paper, a new edition every morning. Most of it is made from the
 * game as it stands (see the phone app), and two parts are kept here: the riddle of the day,
 * which names a place without saying it and is solved by going into that place; and the
 * diary of the notable things the player has done, which the gossip column reports.
 */

export interface Riddle { place: string; text: string; answer: string }

/** Each riddle names a place by a part of its id */
export const RIDDLES: Riddle[] = [
  { place: 'afrika-shrine', text: 'Where the saxophone of the Abami Eda still plays on a Thursday night.', answer: 'New Afrika Shrine' },
  { place: 'amala-shitta', text: 'Iya serves the ewedu, the gbegiri and the assorted, and the queue is out the door.', answer: 'Amala Shitta' },
  { place: 'balogun-market', text: 'Ten thousand traders, a hundred thousand voices, and somewhere a goat.', answer: 'Balogun Market' },
  { place: 'lekki-conservation', text: 'You walk the longest canopy in Africa above a swamp full of monkeys.', answer: 'Lekki Conservation Centre' },
  { place: 'computer-village', text: 'Your screen is broken at nine and fixed by ten, under an umbrella in Ikeja.', answer: 'Computer Village' },
  { place: 'lagoon-beach', text: 'Sand between your toes, horses for hire and suya by the sea.', answer: 'Elegushi Beach' },
  { place: 'government-house', text: 'Where the laws of Lagos are signed and the convoys start from.', answer: 'Lagos State Government House' },
  { place: 'freedom-park', text: 'Once a colonial prison; now poetry, live bands and art under the trees.', answer: 'Freedom Park' },
  { place: 'oshodi-interchange', text: 'Every danfo in Lagos seems to pass under its roof.', answer: 'Oshodi Transport Interchange' },
  { place: 'eko-grand-hotel', text: 'Five stars, a pool on Victoria Island, and a key card with your room number.', answer: 'Eko Grand Hotel' },
  { place: 'central-mosque', text: 'Its green domes call the faithful on Lagos Island five times a day.', answer: 'Lagos Central Mosque' },
  { place: 'redemption-cathedral', text: 'Where the choir, the drums and the dancing go on all night at the Holy Ghost service.', answer: 'Redemption Cathedral' },
  { place: 'dangote-refinery', text: 'The biggest single-train refinery in the world, out in the Lekki Free Zone.', answer: 'Dangote Refinery Visitors Centre' },
  { place: 'ladipo-auto', text: 'Any part for any motor, new or tokunbo, if you can bargain.', answer: 'Ladipo Auto Market' },
  { place: 'allen-suya', text: 'Off Allen Avenue, the mallam fans the coals and the pepper burns.', answer: 'Mai Suya Spot' },
  { place: 'shopwell-mall', text: 'Cinema, shawarma and air conditioning, all under one roof in Lekki.', answer: 'The Palms Mall' },
  { place: 'ivory-rooftop', text: 'Sunset over the lagoon, a DJ, and drinks far above the traffic.', answer: 'Ivory Rooftop' },
  { place: 'lasuth', text: 'The teaching hospital in Ikeja where nurses work all night.', answer: 'LASUTH' },
];

interface Entry { date: string; text: string }
interface Save { diary: Entry[]; solved: string[] }

export interface GistHooks {
  pay(amount: number, why: string): void;
  tell(text: string): void;
  name(): string;
}

const naira = (n: number) => `₦${Math.round(n).toLocaleString()}`;

export class GistTimes {
  private static instance: GistTimes | null = null;
  public hooks: GistHooks | null = null;
  private save: Save;

  public static get(): GistTimes {
    if (!GistTimes.instance) GistTimes.instance = new GistTimes();
    return GistTimes.instance;
  }

  private constructor() {
    this.save = this.load();
    Activity.get().on((e) => this.hear(e));
  }

  private key(): string {
    return `nl_gist_v1:${Activity.player()}`;
  }

  private load(): Save {
    try { return { diary: [], solved: [], ...JSON.parse(localStorage.getItem(this.key()) ?? '{}') }; } catch { return { diary: [], solved: [] }; }
  }

  private persist(): void {
    try { localStorage.setItem(this.key(), JSON.stringify(this.save)); } catch { /* blocked */ }
  }

  /** Today's edition: the date Lagos wakes up to (a new paper at 6 in the morning) */
  public static edition(): string {
    return lagosDate(Date.parse(`${Hustles.today()}T12:00:00Z`));
  }

  public riddle(): Riddle & { solved: boolean; reward: number } {
    const date = GistTimes.edition();
    let h = 0;
    for (const ch of date) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
    const r = RIDDLES[h % RIDDLES.length];
    return { ...r, solved: this.save.solved.includes(date), reward: Math.round(10_000 * (1 + Ladder.get().rung * 0.6)) };
  }

  private note(text: string): void {
    this.save.diary = [{ date: Hustles.today(), text }, ...this.save.diary].slice(0, 30);
    this.persist();
  }

  private hear(e: ActivityEvent): void {
    const who = `@${this.hooks?.name() ?? 'someone'}`;
    if (e.kind === 'visited') {
      const r = this.riddle();
      if (!r.solved && e.place.includes(r.place)) {
        this.save.solved.push(GistTimes.edition());
        this.persist();
        this.hooks?.pay(r.reward, `Gist Times riddle solved: ${r.answer}`);
        this.hooks?.tell(`📰 Riddle of the day solved: ${r.answer}! +${naira(r.reward)}`);
        Activity.emit({ kind: 'case', id: `riddle-${GistTimes.edition()}` });
      }
    } else if (e.kind === 'money' && e.amount <= -1_000_000 && /ASSET_PURCHASE|BUSINESS_PURCHASE|PROPERTY_PURCHASE|CONSTRUCTION_COST/.test(e.type)) {
      this.note(`${who} was seen paying ${naira(-e.amount)} for ${e.what.replace(/^(Bought|Purchase of|Buy)\s*/i, '').slice(0, 60)}. Money is speaking!`);
    } else if (e.kind === 'acted' && /^spray/.test(e.id)) {
      this.note(`Eyewitnesses say ${who} turned the club upside down, spraying notes on the dance floor. Odogwu!`);
    } else if (e.kind === 'ladder') {
      this.note(`${who} has packed out and moved up to ${Ladder.get().current.area}. From grass to grace!`);
    } else if (e.kind === 'city' && e.city !== 'lagos') {
      this.note(`${who} touched down in ${e.city === 'abuja' ? 'Abuja' : e.city === 'port_harcourt' ? 'Port Harcourt' : e.city}. Business trip or enjoyment?`);
    } else if (e.kind === 'game' && e.won && e.stake >= 5_000) {
      this.note(`${who} won the pot at ${e.game === 'ayo' ? 'Ayo' : 'Whot'} for ${naira(e.stake * (e.game === 'ayo' ? 2 : 4))}. The streets are talking.`);
    } else if (e.kind === 'case' && e.id.startsWith('case-')) {
      this.note(`${who} cracked a case the police could not. Lagos has a new detective!`);
    } else if (e.kind === 'found' && e.what === 'agama') {
      const n = (this.save.diary.filter((d) => /agama/.test(d.text)).length);
      if (n < 3) this.note(`${who} has been chasing agama lizards along the expressway. Collector or madness? You decide.`);
    }
  }

  /** What the paper says about the player: yesterday's and today's notable moves */
  public gist(): string[] {
    const today = Hustles.today();
    const yesterday = lagosDate(Date.parse(`${today}T12:00:00Z`) - 86_400_000);
    return this.save.diary.filter((d) => d.date === today || d.date === yesterday).map((d) => d.text).slice(0, 4);
  }

  /** The XP a solved riddle earns, for the panel's legend */
  public static readonly riddleXp = XP.case;
}
