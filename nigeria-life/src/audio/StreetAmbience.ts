import { SoundEngine } from './SoundEngine';

/**
 * The sound of a Lagos street: the murmur of the crowd, the rumble of the traffic, horns near
 * and far, and now and then a voice: a conductor calling his route, a hawker, someone shouting
 * at a driver. Louder where it is busy, quiet at night and indoors. The voices are the phone's
 * own speech, said in a Nigerian voice where the phone has one.
 */

const CALLS = [
  'Oshodi! Oshodi! Oshodi!',
  'Ojuelegba, enter with your change!',
  'Obalende! CMS! Enter quick quick!',
  'Pure water! Buy your pure water!',
  'Gala! Gala! Buy your Gala!',
  'Oga, abeg shift small!',
  'Driver, park well!',
  'Hey! Stop there! Stop!',
  'Wetin you dey look? Move now!',
  'Ehen! Na so! Na so!',
  'Agege bread! Hot agege bread!',
  'Yaba! Yaba! One more chance!',
  'No vex o, I dey come!',
  'Mama Put dey open! Come chop!',
];

const EVENING_CALLS = ['Suya! Hot suya!', 'Last bus! Last bus to Ikorodu!', 'Light don come!'];

export interface StreetHere {
  /** In the street (not indoors, not on the map) */
  outside: boolean;
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
  private voice: SpeechSynthesisVoice | null | undefined;
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
    const busy = here.outside ? Math.min(1, here.people / 30) : 0;
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
      if (this.voices && busy > 0.2 && !night) this.call(here.hour >= 18 ? [...CALLS, ...EVENING_CALLS] : CALLS);
    }
  }

  private call(lines: string[]): void {
    const speech = typeof window !== 'undefined' ? window.speechSynthesis : undefined;
    if (!speech || SoundEngine.getInstance().isMuted || speech.speaking) return;
    if (this.voice === undefined) {
      const all = speech.getVoices();
      if (all.length === 0) return; // Not loaded yet: next time
      this.voice = all.find((v) => /en[-_]NG/i.test(v.lang)) ?? all.find((v) => /nigeria/i.test(v.name)) ?? all.find((v) => /^en/i.test(v.lang)) ?? null;
    }
    const line = new SpeechSynthesisUtterance(lines[Math.floor(Math.random() * lines.length)]);
    if (this.voice) line.voice = this.voice;
    line.volume = 0.32;
    line.rate = 1.05 + Math.random() * 0.2;
    line.pitch = 0.8 + Math.random() * 0.5;
    speech.speak(line);
  }
}
