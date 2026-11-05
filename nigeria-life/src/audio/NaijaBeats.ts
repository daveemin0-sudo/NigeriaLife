/**
 * Original music, played live: Afrobeats, Amapiano, Highlife and Afro-pop songs written for the
 * game, each made of drums, shaker, talking drum or log drum, bass, chords and a lead tune, in
 * sections (intro, verse, chorus, break) so a song goes somewhere. Notes are scheduled a little
 * ahead on the audio clock, so the groove does not stumble when the game is busy.
 *
 * Every tune here is made up for NigeriaLife: nothing is copied from anyone's record.
 */

export type Style = 'afrobeats' | 'amapiano' | 'highlife' | 'afropop';

export interface Song {
  id: string;
  title: string;
  artist: string;
  style: Style;
  bpm: number;
  /** The key: MIDI note of its root */
  root: number;
  minor: boolean;
  /** Chords, one per bar, as scale degrees (0 = the root chord) */
  chords: number[];
  seed: number;
}

export const SONGS: Song[] = [
  { id: 'eko-sunset', title: 'Eko Sunset', artist: 'NaijaFM Band', style: 'afrobeats', bpm: 106, root: 57, minor: true, chords: [0, 5, 3, 4], seed: 11 },
  { id: 'danfo-groove', title: 'Danfo Groove', artist: 'Third Mainland Crew', style: 'afropop', bpm: 112, root: 60, minor: false, chords: [0, 4, 5, 3], seed: 23 },
  { id: 'yaba-nights', title: 'Yaba Nights', artist: 'Log Drum Lagos', style: 'amapiano', bpm: 113, root: 55, minor: true, chords: [0, 3, 6, 4], seed: 37 },
  { id: 'owambe-sunday', title: 'Owambe Sunday', artist: 'Highlife Ambassadors', style: 'highlife', bpm: 122, root: 62, minor: false, chords: [0, 3, 4, 0, 5, 3, 4, 4], seed: 41 },
  { id: 'gidi-shine', title: 'Gidi Shine', artist: 'NaijaFM Band', style: 'afrobeats', bpm: 100, root: 59, minor: false, chords: [0, 5, 1, 4], seed: 53 },
  { id: 'surulere-love', title: 'Surulere Love', artist: 'Mama Put Singers', style: 'afropop', bpm: 96, root: 64, minor: false, chords: [0, 3, 0, 4], seed: 67 },
  { id: 'lekki-tollgate', title: 'Lekki Toll Gate', artist: 'Log Drum Lagos', style: 'amapiano', bpm: 115, root: 53, minor: true, chords: [0, 5, 3, 3], seed: 71 },
  { id: 'calabar-breeze', title: 'Calabar Breeze', artist: 'Highlife Ambassadors', style: 'highlife', bpm: 118, root: 60, minor: false, chords: [0, 4, 3, 4], seed: 89 },
];

const MAJOR = [0, 2, 4, 5, 7, 9, 11];
const MINOR = [0, 2, 3, 5, 7, 8, 10];
const hz = (midi: number) => 440 * 2 ** ((midi - 69) / 12);

function random(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

/** Where a 16th step is in its song: which section, which bar, which step */
type Section = 'intro' | 'verse' | 'chorus' | 'break';
const FORM: Array<{ part: Section; bars: number }> = [
  { part: 'intro', bars: 4 },
  { part: 'verse', bars: 8 },
  { part: 'chorus', bars: 8 },
  { part: 'verse', bars: 8 },
  { part: 'break', bars: 2 },
  { part: 'chorus', bars: 8 },
  { part: 'chorus', bars: 4 },
];
const FORM_BARS = FORM.reduce((sum, f) => sum + f.bars, 0);

export class NaijaBeats {
  private readonly ctx: AudioContext;
  private readonly out: GainNode;
  private noise: AudioBuffer;
  private song: Song | null = null;
  private step = 0;
  private nextTime = 0;
  private timer: number | null = null;
  private melody: number[] = [];
  /** Called when a song has played through once */
  public onSongEnd: (() => void) | null = null;

  constructor(ctx: AudioContext, destination: AudioNode) {
    this.ctx = ctx;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -16;
    comp.ratio.value = 3;
    this.out = ctx.createGain();
    this.out.gain.value = 0.55;
    this.out.connect(comp);
    comp.connect(destination);
    this.noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const data = this.noise.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  }

  public get playing(): Song | null {
    return this.timer !== null ? this.song : null;
  }

  /** How far through the song, 0 to 1 */
  public get progress(): number {
    return this.song ? Math.min(1, this.step / (FORM_BARS * 16)) : 0;
  }

  public play(song: Song): void {
    this.stop();
    this.song = song;
    this.step = 0;
    this.melody = this.writeMelody(song);
    this.nextTime = this.ctx.currentTime + 0.08;
    this.timer = window.setInterval(() => this.schedule(), 25);
  }

  public stop(): void {
    if (this.timer !== null) window.clearInterval(this.timer);
    this.timer = null;
  }

  /** A tune for the chorus: a two-bar figure on the notes of each chord, repeated and varied */
  private writeMelody(song: Song): number[] {
    const rand = random(song.seed);
    const scale = song.minor ? MINOR : MAJOR;
    const pent = song.minor ? [0, 2, 3, 4, 6] : [0, 1, 2, 4, 5];
    const figure: number[] = [];
    for (let i = 0; i < 32; i++) {
      // Notes land mostly on the off-beats, as Afrobeats sings
      const on = [0, 3, 6, 8, 10, 13, 14].includes(i % 16) ? 0.82 : 0.12;
      figure.push(rand() < on ? pent[Math.floor(rand() * pent.length)] : -1);
    }
    const tune: number[] = [];
    for (let bar = 0; bar < 8; bar++) {
      for (let i = 0; i < 16; i++) {
        const degree = figure[(bar % 2) * 16 + i];
        if (degree < 0) {
          tune.push(-1);
          continue;
        }
        const chord = song.chords[bar % song.chords.length];
        // Lean toward the chord's notes; the second time round, a little higher
        const lift = bar >= 4 && rand() < 0.3 ? 2 : 0;
        const d = degree + (rand() < 0.4 ? chord : 0) + lift;
        tune.push(song.root + 12 + scale[d % 7] + 12 * Math.floor(d / 7));
      }
    }
    return tune;
  }

  private schedule(): void {
    const song = this.song;
    if (!song) return;
    const sixteenth = 60 / song.bpm / 4;
    while (this.nextTime < this.ctx.currentTime + 0.12) {
      this.playStep(song, this.step, this.nextTime, sixteenth);
      // A little swing on the off 16ths
      this.nextTime += sixteenth * (this.step % 2 === 0 ? 1.08 : 0.92);
      this.step += 1;
      if (this.step >= FORM_BARS * 16) {
        this.step = 0;
        this.onSongEnd?.();
        if (this.timer === null || this.song !== song) return;
      }
    }
  }

  private sectionAt(step: number): { part: Section; bar: number } {
    let bar = Math.floor(step / 16);
    for (const f of FORM) {
      if (bar < f.bars) return { part: f.part, bar };
      bar -= f.bars;
    }
    return { part: 'chorus', bar: 0 };
  }

  private playStep(song: Song, step: number, t: number, sixteenth: number): void {
    const { part, bar } = this.sectionAt(step);
    const i = step % 16;
    const absBar = Math.floor(step / 16);
    const chordDegree = song.chords[absBar % song.chords.length];
    const scale = song.minor ? MINOR : MAJOR;
    const chordRoot = song.root - 12 + scale[chordDegree % 7];
    const full = part === 'verse' || part === 'chorus';
    const style = song.style;

    // Drums
    if (part !== 'break') {
      if (style === 'amapiano') {
        if (i % 4 === 0) this.kick(t, 0.9);
      } else if (style === 'highlife') {
        if (i === 0 || i === 8) this.kick(t, 0.8);
      } else if ([0, 7, 10].includes(i) || (style === 'afropop' && i === 8)) {
        this.kick(t, i === 0 ? 1 : 0.75);
      }
      if (full && (i === 4 || i === 12)) this.clap(t, style === 'highlife' ? 0.35 : 0.5);
      if (style !== 'highlife' && [3, 6, 11, 14].includes(i) && full) this.rim(t, 0.25);
    }
    // Shaker on every 16th, accents on the beat
    if (part !== 'intro' || bar >= 2) this.shaker(t, i % 4 === 2 ? 0.16 : 0.08, style === 'highlife' ? 0.05 : 0.035);
    // Talking drum fills (Afrobeats, Afro-pop) or the log drum (Amapiano)
    if (style === 'amapiano' && full && [3, 6, 10, 13].includes(i)) this.logDrum(t, hz(chordRoot + (i === 10 ? 7 : 0)), sixteenth * 2.2);
    if ((style === 'afrobeats' || style === 'afropop') && (bar % 4 === 3 || part === 'break') && [9, 11, 13, 14].includes(i)) this.talkingDrum(t, 0.35);
    if (style === 'highlife' && [2, 6, 10, 14].includes(i)) this.conga(t, i % 8 === 2 ? 330 : 250);

    // Bass
    if (part !== 'intro' && style !== 'amapiano') {
      const pattern = style === 'highlife' ? [0, 6, 8, 12] : [0, 3, 8, 11, 14];
      if (pattern.includes(i)) this.bass(t, hz(chordRoot + (i === 14 || i === 12 ? 7 : 0)), sixteenth * 1.8);
    }

    // Chords: off-beat stabs (Afrobeats), long keys (Amapiano), guitar picking (Highlife)
    const chord = [0, 2, 4].map((n) => song.root + scale[(chordDegree + n) % 7] + (chordDegree + n >= 7 ? 12 : 0));
    if (style === 'highlife') {
      if (part !== 'break' && i % 2 === 0) this.pluck(t, hz(chord[(i / 2) % 3] + 12), 0.08);
    } else if (style === 'amapiano') {
      if (i === 0) for (const n of chord) this.keys(t, hz(n), sixteenth * 15, 0.06);
    } else if ([2, 6, 10, 14].includes(i) || (i === 0 && part === 'intro')) {
      for (const n of chord) this.keys(t, hz(n), sixteenth * 1.4, 0.05);
    }

    // The tune, in the choruses
    if (part === 'chorus') {
      const note = this.melody[(bar % 8) * 16 + i];
      if (note > 0) this.lead(t, hz(note), sixteenth * 1.7);
    }
  }

  // ---------------------------------------------------------------- instruments
  private env(t: number, peak: number, attack: number, decay: number): GainNode {
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
    g.connect(this.out);
    return g;
  }

  private kick(t: number, level: number): void {
    const o = this.ctx.createOscillator();
    o.frequency.setValueAtTime(130, t);
    o.frequency.exponentialRampToValueAtTime(42, t + 0.12);
    o.connect(this.env(t, 0.9 * level, 0.004, 0.28));
    o.start(t);
    o.stop(t + 0.32);
  }

  private noiseHit(t: number, level: number, type: BiquadFilterType, freq: number, q: number, decay: number): void {
    const src = this.ctx.createBufferSource();
    src.buffer = this.noise;
    const f = this.ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    f.Q.value = q;
    src.connect(f);
    f.connect(this.env(t, level, 0.002, decay));
    src.start(t, Math.random() * 0.5);
    src.stop(t + decay + 0.02);
  }

  private clap(t: number, level: number): void {
    this.noiseHit(t, level, 'bandpass', 1500, 0.8, 0.14);
    this.noiseHit(t + 0.012, level * 0.6, 'bandpass', 2100, 1, 0.1);
  }

  private rim(t: number, level: number): void {
    this.noiseHit(t, level, 'highpass', 3500, 2, 0.03);
  }

  private shaker(t: number, level: number, decay: number): void {
    this.noiseHit(t, level, 'highpass', 7000, 0.7, decay);
  }

  private talkingDrum(t: number, level: number): void {
    const o = this.ctx.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(260, t);
    o.frequency.exponentialRampToValueAtTime(150, t + 0.16);
    o.connect(this.env(t, level, 0.005, 0.2));
    o.start(t);
    o.stop(t + 0.24);
  }

  private conga(t: number, f: number): void {
    const o = this.ctx.createOscillator();
    o.frequency.setValueAtTime(f, t);
    o.frequency.exponentialRampToValueAtTime(f * 0.85, t + 0.1);
    o.connect(this.env(t, 0.22, 0.003, 0.14));
    o.start(t);
    o.stop(t + 0.18);
  }

  private logDrum(t: number, f: number, length: number): void {
    const o = this.ctx.createOscillator();
    o.type = 'triangle';
    o.frequency.setValueAtTime(f * 1.5, t);
    o.frequency.exponentialRampToValueAtTime(f, t + 0.04);
    const lp = this.ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 600;
    o.connect(lp);
    lp.connect(this.env(t, 0.5, 0.006, length));
    o.start(t);
    o.stop(t + length + 0.05);
  }

  private bass(t: number, f: number, length: number): void {
    const o = this.ctx.createOscillator();
    o.type = 'triangle';
    o.frequency.value = f;
    const lp = this.ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 420;
    o.connect(lp);
    lp.connect(this.env(t, 0.42, 0.01, length));
    o.start(t);
    o.stop(t + length + 0.05);
  }

  private keys(t: number, f: number, length: number, level: number): void {
    for (const detune of [-6, 6]) {
      const o = this.ctx.createOscillator();
      o.type = 'sine';
      o.frequency.value = f;
      o.detune.value = detune;
      o.connect(this.env(t, level, 0.015, length));
      o.start(t);
      o.stop(t + length + 0.05);
    }
    const o2 = this.ctx.createOscillator();
    o2.type = 'triangle';
    o2.frequency.value = f * 2;
    o2.connect(this.env(t, level * 0.25, 0.005, length * 0.4));
    o2.start(t);
    o2.stop(t + length * 0.4 + 0.05);
  }

  private pluck(t: number, f: number, level: number): void {
    const o = this.ctx.createOscillator();
    o.type = 'triangle';
    o.frequency.value = f;
    const bp = this.ctx.createBiquadFilter();
    bp.type = 'lowpass';
    bp.frequency.setValueAtTime(3000, t);
    bp.frequency.exponentialRampToValueAtTime(600, t + 0.2);
    o.connect(bp);
    bp.connect(this.env(t, level, 0.003, 0.22));
    o.start(t);
    o.stop(t + 0.26);
  }

  private lead(t: number, f: number, length: number): void {
    // A bright marimba-like note: a tone and its octave, dying away
    for (const [mult, level] of [[1, 0.16], [4, 0.03]] as Array<[number, number]>) {
      const o = this.ctx.createOscillator();
      o.type = 'sine';
      o.frequency.value = f * mult;
      o.connect(this.env(t, level, 0.004, length));
      o.start(t);
      o.stop(t + length + 0.05);
    }
  }
}
