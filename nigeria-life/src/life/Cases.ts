import * as THREE from 'three';
import { Activity, type ActivityEvent } from './Activity';
import { Ladder } from './Ladder';
import { HumanMeshBuilder, type HumanConfig } from '../graphics/HumanMeshBuilder';
import { InteriorManager } from '../interiors/InteriorManager';
import { PlaceActions } from '../destinations/PlaceActions';
import type { PlaceInterior } from '../interiors/places/PlaceInterior';

/**
 * Naija Detective: cases solved by going round Lagos. Each case is a trail of witnesses, one
 * in each of a few real places; a witness stands waiting inside the place the trail leads
 * to next, and tells what they saw, which points to the next place. With every clue in the
 * notebook, the player names who did it. Right, and the case pays; wrong, and it goes cold
 * until tomorrow.
 */

export interface Witness { place: string; who: string; look: HumanConfig; said: string; next?: string }
export interface CaseDef {
  id: string;
  title: string;
  icon: string;
  area: string;
  stars: 1 | 2 | 3;
  reward: number;
  intro: string;
  witnesses: Witness[];
  suspects: string[];
  culprit: number;
  solution: string;
}

const look = (gender: 'male' | 'female', outfit: HumanConfig['outfit'], outfitColor: number, hairstyle: HumanConfig['hairstyle']): HumanConfig => ({ gender, username: '', outfit, outfitColor, hairstyle, lod: 'street' });

export const CASES: CaseDef[] = [
  {
    id: 'case-suya-money', title: 'The Vanished Suya Money', icon: '🍢', area: 'Allen Avenue, Ikeja', stars: 1, reward: 40_000,
    intro: 'Mallam Sani’s whole night of suya takings, ₦85,000 in a black nylon bag, vanished from under his grill. He is begging anyone with sense to help.',
    witnesses: [
      { place: 'allen-suya', who: 'Mallam Sani (suya seller)', look: look('male', 'casual_tee', 0xf8fafc, 'fila'), said: 'I kept the bag under the grill. Only three people came behind my stall last night: my apprentice Musa, Aunty Bisi from the salon two doors down, and Kunle the okada man who buys suya every night.', next: 'Aunty Bisi’s salon is two doors down: ask her.' },
      { place: 'allen-salon', who: 'Aunty Bisi (salon owner)', look: look('female', 'casual_blouse', 0xdb2777, 'braids'), said: 'Me? I was plaiting a bride’s hair till midnight, ask anyone. But I saw Musa run past around ten with a black nylon bag, going towards the bank.', next: 'The bank on Allen Avenue has a deposit machine. Ask the guard.' },
      { place: 'allen-bank', who: 'Ayo (bank security)', look: look('male', 'security_uniform', 0x1f2937, 'short_crop'), said: 'A young boy in an apron paid ₦85,000 into the machine at 10:14 pm. He smelled of suya smoke and wrote "Musa" on the slip. I remember because he was shaking.' },
    ],
    suspects: ['Musa, the apprentice', 'Aunty Bisi, the salon owner', 'Kunle, the okada man'],
    culprit: 0,
    solution: 'Musa took the money to pay his school fees before the deadline. He has confessed, and promised to work it off at the grill. Mallam Sani forgave him, and gave you suya for life.',
  },
  {
    id: 'case-agbada', title: 'The Swapped Agbada', icon: '👘', area: 'Balogun to Ladipo', stars: 2, reward: 90_000,
    intro: 'Chief Adeyemi’s ₦2 million hand-woven aso-oke agbada came back from the tailor as a cheap copy. The owambe is on Saturday. Find the real one.',
    witnesses: [
      { place: 'balogun-market', who: 'Iya Basira (cloth seller)', look: look('female', 'blue_dress', 0x7c3aed, 'gele'), said: 'That aso-oke was the real thing, woven in Iseyin, I sold it to Chief myself. He sent it to his tailor, Emeka, on Awolowo Way.', next: 'Emeka has a fashion house on Awolowo Way, Ikeja.' },
      { place: 'awolowo-fashion', who: 'Emeka (tailor)', look: look('male', 'senator', 0x0f766e, 'fade'), said: 'I sewed it with these hands and gave it to Chief’s driver, Femi, to deliver. He came back two hours late, sweating, with a story about traffic.', next: 'Where do things that "fell off a lorry" go in Lagos? Ladipo.' },
      { place: 'ladipo-auto', who: 'Obi (mechanic)', look: look('male', 'mechanic_overalls', 0x1e3a8a, 'short_crop'), said: 'Femi parked Chief’s Prado here for three hours with a big Ghana-must-go bag, then went to a tailor at the back who copies anything in one day.' },
    ],
    suspects: ['Emeka, the tailor', 'Iya Basira, the cloth seller', 'Femi, the driver'],
    culprit: 2,
    solution: 'Femi had the agbada copied at Ladipo and was going to sell the real one in Cotonou. The police found it in the Prado’s boot. Chief will wear it on Saturday, and you are invited.',
  },
  {
    id: 'case-saxophone', title: 'Midnight at the Shrine', icon: '🎷', area: 'Ikeja to Oshodi', stars: 2, reward: 120_000,
    intro: 'Baba Tunji’s gold saxophone, the one he has played for forty years, disappeared from its stand during the Thursday jam at the Shrine.',
    witnesses: [
      { place: 'afrika-shrine', who: 'Baba Tunji (bandleader)', look: look('male', 'agbada', 0xeab308, 'short_crop'), said: 'It was on its stand at the break. Backstage there were three people: Dayo the sound engineer, Lola the DJ from Naija FM, and a fan who kept begging to hold it.', next: 'Lola does the night show at Naija Radio House.' },
      { place: 'radio-house', who: 'Lola (DJ)', look: look('female', 'casual_blouse', 0x111827, 'bob_wig'), said: 'I was live on air at the time, check the log! But Dayo was boasting that a man in Computer Village would pay "any money" for a vintage sax.', next: 'Computer Village: the repairers there see everything.' },
      { place: 'computer-village', who: 'Chuks (phone repairer)', look: look('male', 'casual_tee', 0x16a34a, 'fade'), said: 'Dayo came this morning trying to sell a gold sax. I told him I fix phones. He went off towards Oshodi with the case, looking over his shoulder.', next: 'Oshodi: buses out of Lagos leave from the interchange.' },
      { place: 'oshodi-interchange', who: 'Kola (bus conductor)', look: look('male', 'casual_tee', 0xf59e0b, 'short_crop'), said: 'A man with a sax case got on the Ibadan bus, then jumped down when he saw police at the gate. He is still sitting there by the gate, sweating.' },
    ],
    suspects: ['Dayo, the sound engineer', 'Lola, the DJ', 'The fan'],
    culprit: 0,
    solution: 'Dayo owed a loan shark and planned to sell the saxophone in Ibadan. Baba Tunji has his saxophone back, and you have a seat at the front every Thursday.',
  },
  {
    id: 'case-fake-doctor', title: 'The Fake Doctor', icon: '💉', area: 'LASUTH and Awolowo Way', stars: 3, reward: 200_000,
    intro: 'Someone in a white coat is selling "special injections" to frightened families in the LASUTH car park. The nurses want him caught before somebody dies.',
    witnesses: [
      { place: 'lasuth', who: 'Nurse Grace', look: look('female', 'nurse_scrubs', 0x0891b2, 'bob_wig'), said: 'He is not one of ours. He waits by the car park, says he is "Dr Peters" and sells injections for ₦20,000. We saw him buying empty vials across the road on Awolowo Way.', next: 'The pharmacy on Awolowo Way sells vials.' },
      { place: 'awolowo-pharmacy', who: 'Halima (pharmacist)', look: look('female', 'doctor_coat', 0xf8fafc, 'ponytail'), said: 'A man buys empty vials by the dozen and pays in new notes. He told me he runs the clinic at the Ikeja Computer School down the road.', next: 'The Ikeja Computer School is on the same street.' },
      { place: 'awolowo-school', who: 'Mr Okon (school owner)', look: look('male', 'lecturer_suit', 0x334155, 'short_crop'), said: 'We have no clinic! But our lab attendant, Ifeanyi, was sacked last month for stealing chemicals. He always said he would have been a doctor.', next: 'The police have files on everyone. The Lagos State Police Command.' },
      { place: 'police-command', who: 'Sgt. Danladi', look: look('male', 'security_uniform', 0x0f172a, 'police_cap'), said: 'Ifeanyi Okafor: two arrests for impersonation in Onitsha. Bring me the name and we will move tonight.' },
    ],
    suspects: ['Ifeanyi, the sacked lab attendant', 'Halima, the pharmacist', 'Dr Peters of LASUTH'],
    culprit: 0,
    solution: 'Ifeanyi was arrested in the car park with a bag of fake vials. LASUTH has put up a sign: only doctors in hospital ID give injections. The nurses are calling you "Detective".',
  },
  {
    id: 'case-owambe', title: 'The Owambe Gift Box', icon: '🎁', area: 'Victoria Island and Lekki', stars: 2, reward: 150_000,
    intro: 'At a ₦50 million wedding reception at the Eko Grand, the box of gift envelopes vanished from the high table before the couple could count a kobo.',
    witnesses: [
      { place: 'eko-grand-hotel', who: 'Tolu (event planner)', look: look('female', 'peplum_skirt', 0x9333ea, 'gele'), said: 'The box was on the high table. Near it all night: Deji the photographer, DJ Kapo, and Bimpe, the bride’s cousin. Deji said he had to rush off to shoot another party at Ivory Rooftop.', next: 'Ivory Rooftop: see if Deji was really there.' },
      { place: 'ivory-rooftop', who: 'Sam (bartender)', look: look('male', 'casual_tee', 0x111827, 'fade'), said: 'Deji was here shooting a birthday from eight till two, he never left. But Bimpe came in at midnight, bought champagne for everyone and paid with crisp new notes, straight out of envelopes.', next: 'The Palms: big spenders go shopping the morning after.' },
      { place: 'shopwell-mall', who: 'Ngozi (boutique attendant)', look: look('female', 'casual_blouse', 0xec4899, 'bob_wig'), said: 'A lady paid ₦1.2 million cash for a designer bag this morning. Her handbag was full of envelopes with "Happy Married Life" written on them.' },
    ],
    suspects: ['Deji, the photographer', 'DJ Kapo', 'Bimpe, the bride’s cousin'],
    culprit: 2,
    solution: 'Bimpe took the gift box during the cake cutting. Most of the money was recovered from her flat in Lekki, and the couple insist you come to the thanksgiving.',
  },
];

interface Save { active: string | null; found: Record<string, number>; solved: string[]; cold: Record<string, string> }

export interface CaseHooks {
  pay(amount: number, why: string): void;
  tell(text: string, big?: { title: string; sub: string }): void;
  today(): string;
}

/** Where a witness waits in a room: by the way in, on the left */
const witnessSpot = (room: PlaceInterior) => ({ x: -room.spec.room.width / 2 + 2.6, z: room.spec.room.length / 2 - 3.4 });

export class Cases {
  private static instance: Cases | null = null;
  public hooks: CaseHooks | null = null;
  private save: Save;
  private readonly listeners: Array<() => void> = [];
  /** The witness put in a room, so it is put there once and taken away after */
  private placed: { key: string; group: THREE.Group; room: PlaceInterior; id: string } | null = null;

  public static get(): Cases {
    if (!Cases.instance) Cases.instance = new Cases();
    return Cases.instance;
  }

  private constructor() {
    this.save = this.load();
    Activity.get().on((e) => this.hear(e));
  }

  private key(): string {
    return `nl_cases_v1:${Activity.player()}`;
  }

  private load(): Save {
    try { return { active: null, found: {}, solved: [], cold: {}, ...JSON.parse(localStorage.getItem(this.key()) ?? '{}') }; } catch { return { active: null, found: {}, solved: [], cold: {} }; }
  }

  private changed(): void {
    try { localStorage.setItem(this.key(), JSON.stringify(this.save)); } catch { /* blocked */ }
    for (const l of this.listeners) l();
  }

  public subscribe(listener: () => void): () => void {
    this.listeners.push(listener);
    return () => { const i = this.listeners.indexOf(listener); if (i >= 0) this.listeners.splice(i, 1); };
  }

  public get active(): CaseDef | null {
    return CASES.find((c) => c.id === this.save.active) ?? null;
  }

  public found(id: string): number {
    return this.save.found[id] ?? 0;
  }

  public status(c: CaseDef): 'solved' | 'cold' | 'active' | 'open' {
    if (this.save.solved.includes(c.id)) return 'solved';
    if (this.save.cold[c.id] === this.hooks?.today()) return 'cold';
    return this.save.active === c.id ? 'active' : 'open';
  }

  public reward(c: CaseDef): number {
    return Math.round(c.reward * (1 + Ladder.get().rung * 0.5));
  }

  /** The witness to see next, if there is one */
  public lead(c: CaseDef): Witness | null {
    return c.witnesses[this.found(c.id)] ?? null;
  }

  public take(id: string): boolean {
    const c = CASES.find((x) => x.id === id);
    if (!c || this.status(c) === 'solved' || this.status(c) === 'cold') return false;
    this.save.active = id;
    this.clearWitness();
    this.changed();
    // Already standing in the place the trail starts at: the witness comes over
    const here = InteriorManager.getInstance().currentInterior?.id;
    if (here) this.hear({ kind: 'visited', place: here, name: '' });
    return true;
  }

  /** Names who did it: right, and the case is solved and paid; wrong, and it goes cold until tomorrow */
  public accuse(index: number): boolean | null {
    const c = this.active;
    if (!c || this.found(c.id) < c.witnesses.length) return null;
    if (index === c.culprit) {
      this.save.solved.push(c.id);
      this.save.active = null;
      const pay = this.reward(c);
      this.hooks?.pay(pay, `Case solved: ${c.title}`);
      this.hooks?.tell(`🔎 Case solved: ${c.title}! +₦${pay.toLocaleString()}`, { title: '🔎 CASE SOLVED', sub: `${c.title} · ₦${pay.toLocaleString()}` });
      Activity.emit({ kind: 'case', id: c.id });
      this.changed();
      return true;
    }
    this.save.cold[c.id] = this.hooks?.today() ?? '';
    this.save.found[c.id] = 0;
    this.save.active = null;
    this.hooks?.tell(`❄️ Wrong person. ${c.suspects[index]} had nothing to do with it, and the case has gone cold. Try again tomorrow.`);
    this.changed();
    return false;
  }

  private hear(e: ActivityEvent): void {
    if (e.kind !== 'visited') return;
    const c = this.active;
    const w = c ? this.lead(c) : null;
    if (!c || !w || !e.place.endsWith(`_${w.place}`)) return;
    const room = InteriorManager.getInstance().places.find((p) => p.spec.key === w.place);
    if (room) this.putWitness(room, c, w);
  }

  private putWitness(room: PlaceInterior, c: CaseDef, w: Witness): void {
    if (this.placed?.key === `${c.id}:${this.found(c.id)}`) return;
    this.clearWitness();
    const spot = witnessSpot(room);
    const rig = HumanMeshBuilder.createHuman(w.look);
    rig.nameTag.visible = false;
    const group = new THREE.Group();
    group.add(rig.group);
    group.position.set(spot.x, 0, spot.z);
    group.rotation.y = 0;
    // A magnifying glass over their head, so they are seen at once
    const tag = document.createElement('canvas');
    tag.width = 128;
    tag.height = 128;
    const g = tag.getContext('2d')!;
    g.font = '96px sans-serif';
    g.textAlign = 'center';
    g.fillText('🔎', 64, 100);
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(tag), depthTest: false }));
    sprite.scale.set(0.8, 0.8, 0.8);
    sprite.position.y = 2.4;
    group.add(sprite);
    group.name = 'case witness';
    room.group.add(group);
    const id = `case_witness_${w.place}`;
    const stand = room.at(spot.x, spot.z + 1.3);
    room.interactiveList.push({ mesh: group, id, name: w.who, category: `Case: ${c.title}`, description: 'A witness for your case', interactionPoint: stand });
    PlaceActions.register(id, {
      label: () => `🔎 Ask ${w.who.split(' (')[0]} about the case`,
      run: (host) => {
        host.director.perform({
          id: 'question a witness', actor: host.actor, point: stand, target: room.at(spot.x, spot.z), animation: { arms: 'wave' }, seconds: 1.2, effectAt: 0.8, ifStuck: 'snap',
          effect: () => {
            host.ask({
              who: w.who, role: `Case: ${c.title}`, text: w.said,
              choices: [{ label: '📝 Write it in the notebook', note: w.next ?? 'That is every clue: name who did it in Cases', pick: () => this.note(c, w) }],
            });
          },
        });
      },
    });
    this.placed = { key: `${c.id}:${this.found(c.id)}`, group, room, id };
  }

  private note(c: CaseDef, w: Witness): void {
    const n = this.found(c.id);
    if (c.witnesses[n] !== w) return;
    this.save.found[c.id] = n + 1;
    this.clearWitness();
    this.changed();
    const done = n + 1 >= c.witnesses.length;
    this.hooks?.tell(done ? `📝 Every clue in the notebook. Open Cases on your phone and name who did it.` : `📝 Clue ${n + 1}/${c.witnesses.length}. Next: ${w.next}`);
  }

  private clearWitness(): void {
    if (!this.placed) return;
    const { group, room, id } = this.placed;
    group.removeFromParent();
    const i = room.interactiveList.findIndex((o) => o.id === id);
    if (i >= 0) room.interactiveList.splice(i, 1);
    this.placed = null;
  }
}
