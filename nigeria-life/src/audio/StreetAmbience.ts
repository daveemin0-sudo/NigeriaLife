import { SoundEngine } from './SoundEngine';

/**
 * The sound of a Lagos street: the murmur of the crowd, the rumble of the traffic, horns near
 * and far, and now and then a voice: a conductor calling his route, a hawker, someone shouting
 * at a driver. Louder where it is busy, quiet at night and indoors. The voices are the phone's
 * own speech, said in a Nigerian voice where the phone has one.
 */

/** Who says a line: a man, a woman, or either */
type Speaker = 'man' | 'woman' | 'either';
interface Call {
  text: string;
  who: Speaker;
}

/** Conductors calling their routes, all of them at once, the way they do at the bus stop: men, deep and fast */
const CONDUCTORS: Call[] = [
  'Oshodi! Oshodi! Oshodi! Oshodi, Oshodi, enter with your change!',
  'Obalende, CMS, Obalende, CMS! Wole, wole, wole! Shift, shift, shift!',
  'Ojuelegba, Stadium, Costain, Iddo! Ojuelegba o! One chance remain!',
  'Yaba, Yaba, Yaba! Sabo, Yaba, Oyingbo! Enter, enter, we dey go!',
  'Ikeja along, Ikeja along! Allen, Opebi, Ikeja along! Change o, change!',
  'Lekki, Ajah, Lekki, Ajah! Lekki Ajah, enter with your change o!',
  'Mile two, Mile two, Mile two! Oya oya oya, we don full!',
  'Berger, Berger, Berger! Ojota, Ketu, Mile twelve, Berger!',
  'CMS, CMS, CMS! Idumota, CMS! Last two seats, CMS!',
  'Agege, Agege, Pen Cinema! Agege, one more person, we dey go!',
  'Ikorodu, Ikorodu, Ikorodu! Owode, Ikorodu garage!',
  'Surulere, Surulere, Masha, Surulere! Enter with your change!',
].map((text) => ({ text, who: 'man' as Speaker }));

/** Everyone else on a busy road: hawkers, women and men, and people shouting */
const STREET: Call[] = [
  { text: 'Pure water! Buy your pure water! Cold pure water!', who: 'woman' },
  { text: 'Gala! Gala! Buy your Gala! Gala dey!', who: 'man' },
  { text: 'Agege bread! Hot agege bread, hot hot!', who: 'woman' },
  { text: 'Mama Put dey open! Come chop!', who: 'woman' },
  { text: 'Buy your plantain chips! Plantain chips, sweet one!', who: 'woman' },
  { text: 'Fan ice! Fan yogurt! Cold one!', who: 'man' },
  { text: 'Recharge card! MTN, Glo, Airtel! Recharge card!', who: 'man' },
  { text: 'Boli and groundnut! Hot boli!', who: 'woman' },
  { text: 'Oga, abeg shift small!', who: 'man' },
  { text: 'Driver, park well! Park well jor!', who: 'man' },
  { text: 'Hey! Stop there! Stop!', who: 'either' },
  { text: 'Wetin you dey look? Move now!', who: 'woman' },
  { text: 'No vex o, I dey come!', who: 'either' },
  { text: 'Okada! Okada! Where you dey go?', who: 'man' },
];

const EVENING: Call[] = [
  { text: 'Suya! Hot suya! Suya don ready!', who: 'man' },
  { text: 'Last bus! Last bus to Ikorodu! Ikorodu last bus!', who: 'man' },
  { text: 'Up NEPA! Light don come!', who: 'either' },
  { text: 'Roasted corn and pear! Hot corn!', who: 'woman' },
];

/**
 * How a Lagos name is said, spelt for a speech engine that reads English: Oshodi as
 * "Oh-shaw-dee", not "O-shoddy"; CMS letter by letter.
 */
const SAID: Array<[RegExp, string]> = [
  [/\bOshodi\b/gi, 'Oh shaw dee'],
  [/\bObalende\b/gi, 'Oh bah len day'],
  [/\bCMS\b/g, 'C. M. S.'],
  [/\bWole\b/gi, 'woh lay'],
  [/\bOjuelegba\b/gi, 'Oh joo eh leg bah'],
  [/\bCostain\b/gi, 'Coss tain'],
  [/\bIddo\b/gi, 'Ee doh'],
  [/\bIdumota\b/gi, 'Ee doo moh tah'],
  [/\bOyingbo\b/gi, 'Oh yin boh'],
  [/\bSabo\b/gi, 'Sah boh'],
  [/\bYaba\b/gi, 'Yah bah'],
  [/\bIkeja\b/gi, 'Ee keh jah'],
  [/\bOpebi\b/gi, 'Oh peh bee'],
  [/\bLekki\b/gi, 'Lek kee'],
  [/\bAjah\b/gi, 'Ah jah'],
  [/\bBerger\b/gi, 'Ber jer'],
  [/\bOjota\b/gi, 'Oh joh tah'],
  [/\bKetu\b/gi, 'Keh too'],
  [/\bIkorodu\b/gi, 'Ee koh roh doo'],
  [/\bOwode\b/gi, 'Oh woh day'],
  [/\bAgege\b/gi, 'Ah geh geh'],
  [/\bSurulere\b/gi, 'Shoo roo leh reh'],
  [/\bMasha\b/gi, 'Mah shah'],
  [/\bOga\b/gi, 'Oh gah'],
  [/\bOya\b/gi, 'Oh yah'],
  [/\babeg\b/gi, 'ah beg'],
  [/\bjor\b/gi, 'jaw'],
  [/\bdey\b/gi, 'day'],
  [/\bwetin\b/gi, 'weh tin'],
  [/\bGala\b/gi, 'Gah lah'],
  [/\bOkada\b/gi, 'Oh kah dah'],
  [/\bSuya\b/gi, 'Soo yah'],
  [/\bboli\b/gi, 'boh lee'],
  [/\bNEPA\b/g, 'Nee pah'],
  [/\bGlo\b/g, 'Gloh'],
  [/\bo\b/g, 'oh'],
];

/** A line as the speech engine should be given it */
export function spoken(text: string): string {
  let out = text.replace(/-/g, ' ');
  for (const [pattern, said] of SAID) out = out.replace(pattern, said);
  return out;
}

const MALE = /\b(male|man|abeo|david|mark|guy|george|james|daniel|fred|alex|tom|aaron|arthur|oliver|ryan|eric|thomas|christopher|roger|brian|matthew|justin|joey|rishi|ravi|liam|william|richard|sean|connor|mitchell|prabhat)\b/i;
const FEMALE = /\b(female|woman|ezinne|zira|susan|hazel|samantha|karen|moira|tessa|victoria|fiona|kate|serena|aria|jenny|libby|sonia|natasha|catherine|clara|emily|heera|linda|leah|olivia|sarah|zoe|amy|anna|ava|allison|neerja)\b/i;

export interface StreetHere {
  /** In the street (not indoors, not on the map) */
  outside: boolean;
  /** On a main road or at a bus stop: where conductors and hawkers call */
  onMainRoad: boolean;
  driving: boolean;
  /** How many people and vehicles are near */
  people: number;
  cars: number;
  hour: number;
}

export class StreetAmbience {
  private static instance: StreetAmbience | null = null;
  public static get(): StreetAmbience {
    return (this.instance ??= new StreetAmbience());
  }

  private crowd: GainNode | null = null;
  private crowdFilter: BiquadFilterNode | null = null;
  private traffic: GainNode | null = null;
  private nextHorn = 4;
  private nextCall = 8;
  private time = 0;
  /** The voices for men and for women, chosen once the browser has listed its voices */
  private voiceSet: { man: SpeechSynthesisVoice | null; woman: SpeechSynthesisVoice | null; any: SpeechSynthesisVoice | null } | null = null;
  /** Voices in the street (a setting) */
  public voices = true;

  private constructor() {
    try {
      this.voices = localStorage.getItem('nigerialife.streetVoices') !== 'off';
    } catch {
      // On by default
    }
  }

  public setVoices(on: boolean): void {
    this.voices = on;
    try {
      localStorage.setItem('nigerialife.streetVoices', on ? 'on' : 'off');
    } catch {
      // Not remembered
    }
  }

  private setUp(): boolean {
    if (this.crowd) return true;
    const audio = SoundEngine.getInstance().audio(false);
    if (!audio) return false;
    const { ctx, master } = audio;
    // Two long loops of noise: one shaped like many voices far off, one like engines
    const length = ctx.sampleRate * 4;
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    let brown = 0;
    for (let i = 0; i < length; i++) {
      brown = (brown + 0.02 * (Math.random() * 2 - 1)) / 1.02;
      data[i] = brown * 3.5;
    }
    const crowdSource = ctx.createBufferSource();
    crowdSource.buffer = buffer;
    crowdSource.loop = true;
    this.crowdFilter = ctx.createBiquadFilter();
    this.crowdFilter.type = 'bandpass';
    this.crowdFilter.frequency.value = 650;
    this.crowdFilter.Q.value = 0.9;
    this.crowd = ctx.createGain();
    this.crowd.gain.value = 0;
    crowdSource.connect(this.crowdFilter);
    this.crowdFilter.connect(this.crowd);
    this.crowd.connect(master);
    crowdSource.start();

    const trafficSource = ctx.createBufferSource();
    trafficSource.buffer = buffer;
    trafficSource.loop = true;
    trafficSource.playbackRate.value = 0.6;
    const low = ctx.createBiquadFilter();
    low.type = 'lowpass';
    low.frequency.value = 180;
    this.traffic = ctx.createGain();
    this.traffic.gain.value = 0;
    trafficSource.connect(low);
    low.connect(this.traffic);
    this.traffic.connect(master);
    trafficSource.start(0, 1.3);
    return true;
  }

  public update(delta: number, here: StreetHere): void {
    if (!this.setUp()) return;
    const ctx = SoundEngine.getInstance().audio()!.ctx;
    this.time += delta;
    const night = here.hour < 6 || here.hour >= 22;
    const busy = here.outside ? Math.min(1, here.people / 30) * (here.onMainRoad ? 1 : 0.45) : 0;
    const roads = here.outside ? Math.min(1, here.cars / 12) : 0;
    // The crowd's murmur rises and falls, as a crowd does
    const swell = 0.75 + 0.25 * Math.sin(this.time * 0.7) * Math.sin(this.time * 0.23);
    this.crowd!.gain.setTargetAtTime((night ? 0.03 : 0.11) * busy * swell * (here.driving ? 0.6 : 1), ctx.currentTime, 0.4);
    this.crowdFilter!.frequency.setTargetAtTime(560 + 220 * Math.sin(this.time * 1.3), ctx.currentTime, 0.3);
    this.traffic!.gain.setTargetAtTime(0.12 * roads * (here.driving ? 1.2 : 1), ctx.currentTime, 0.5);
    if (!here.outside) return;

    // A horn somewhere in the traffic
    this.nextHorn -= delta;
    if (this.nextHorn <= 0 && roads > 0.1) {
      this.nextHorn = 3 + Math.random() * (night ? 20 : 8);
      SoundEngine.getInstance().playDistantHorn(0.15 + Math.random() * 0.3);
    }
    // A voice from the street
    this.nextCall -= delta;
    if (this.nextCall <= 0) {
      this.nextCall = 9 + Math.random() * 14;
      // Voices belong to the main road and the bus stops, not to a quiet street
      if (this.voices && here.onMainRoad && busy > 0.15 && !night) {
        const conductor = Math.random() < 0.55;
        this.call(conductor ? CONDUCTORS : here.hour >= 18 ? [...STREET, ...EVENING] : STREET, conductor);
      }
    }
  }

  /** A man's voice and a woman's, Nigerian English first, from what this browser has */
  private pickVoices(all: SpeechSynthesisVoice[]): { man: SpeechSynthesisVoice | null; woman: SpeechSynthesisVoice | null; any: SpeechSynthesisVoice | null } {
    const english = all.filter((v) => /^en/i.test(v.lang));
    const nigerian = english.filter((v) => /en[-_]NG/i.test(v.lang) || /nigeria/i.test(v.name));
    const pick = (test: RegExp) => nigerian.find((v) => test.test(v.name)) ?? english.find((v) => test.test(v.name) && /GB|NG|ZA|KE|GH/i.test(v.lang)) ?? english.find((v) => test.test(v.name)) ?? null;
    return { man: pick(MALE), woman: pick(FEMALE), any: nigerian[0] ?? english[0] ?? null };
  }

  private call(lines: Call[], conductor = false): void {
    const speech = typeof window !== 'undefined' ? window.speechSynthesis : undefined;
    if (!speech || SoundEngine.getInstance().isMuted || speech.speaking) return;
    if (!this.voiceSet) {
      const all = speech.getVoices();
      if (all.length === 0) return; // Not loaded yet: next time
      this.voiceSet = this.pickVoices(all);
    }
    const chosen = lines[Math.floor(Math.random() * lines.length)];
    const who: 'man' | 'woman' = chosen.who === 'either' ? (Math.random() < 0.5 ? 'man' : 'woman') : chosen.who;
    const line = new SpeechSynthesisUtterance(spoken(chosen.text));
    const voice = this.voiceSet[who];
    const used = voice ?? this.voiceSet.any;
    if (used) line.voice = used;
    line.lang = used?.lang ?? 'en-NG';
    // Without a voice of the right kind, the pitch makes it one: a conductor deep, a woman higher
    const fitted = !!voice;
    if (conductor) {
      line.volume = 0.55;
      line.rate = 1.22 + Math.random() * 0.15;
      line.pitch = fitted ? 0.62 + Math.random() * 0.15 : 0.35 + Math.random() * 0.1;
    } else if (who === 'woman') {
      line.volume = 0.4;
      line.rate = 1.08 + Math.random() * 0.15;
      line.pitch = fitted ? 1.05 + Math.random() * 0.2 : 1.45 + Math.random() * 0.2;
    } else {
      line.volume = 0.4;
      line.rate = 1.08 + Math.random() * 0.15;
      line.pitch = fitted ? 0.82 + Math.random() * 0.15 : 0.6 + Math.random() * 0.12;
    }
    speech.speak(line);
  }
}
