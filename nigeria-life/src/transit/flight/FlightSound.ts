import { SoundEngine } from '../../audio/SoundEngine';
import { MALE, FEMALE } from '../../audio/StreetAmbience';

/**
 * What a flight sounds like: the engines from a whine at the gate to the roar of the take-off
 * roll, the steady hum of the cruise, the reversers on the landing roll; the two-tone chime
 * before every announcement; the thump of the touchdown; the gear going up and down; and the
 * captain and the cabin crew speaking, in the voices the browser has.
 */
export class FlightSound {
  private engine: { noise: AudioBufferSourceNode; filter: BiquadFilterNode; gain: GainNode; whine: OscillatorNode; whineGain: GainNode } | null = null;
  private voices: { man: SpeechSynthesisVoice | null; woman: SpeechSynthesisVoice | null } | null = null;
  private stopped = true;

  private audio() {
    return SoundEngine.getInstance().audio(true);
  }

  public start(): void {
    this.stopped = false;
    const a = this.audio();
    if (!a || this.engine) return;
    const { ctx, master } = a;
    // Brown noise, looped: the body of the engine sound
    const buffer = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    let last = 0;
    for (let i = 0; i < data.length; i++) {
      last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02;
      data[i] = last * 3.5;
    }
    const noise = ctx.createBufferSource();
    noise.buffer = buffer;
    noise.loop = true;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 300;
    const gain = ctx.createGain();
    gain.gain.value = 0;
    noise.connect(filter).connect(gain).connect(master);
    // The fan's whine on top
    const whine = ctx.createOscillator();
    whine.type = 'sawtooth';
    whine.frequency.value = 400;
    const whineFilter = ctx.createBiquadFilter();
    whineFilter.type = 'bandpass';
    whineFilter.frequency.value = 1800;
    whineFilter.Q.value = 6;
    const whineGain = ctx.createGain();
    whineGain.gain.value = 0;
    whine.connect(whineFilter).connect(whineGain).connect(master);
    noise.start();
    whine.start();
    this.engine = { noise, filter, gain, whine, whineGain };
  }

  /** The engines at this power; muffled from inside the cabin */
  public engines(running: boolean, thrust: number, reverse: number, inside: boolean): void {
    const a = this.audio();
    if (!a || !this.engine) return;
    const now = a.ctx.currentTime;
    const power = running ? Math.max(thrust, reverse * 0.95) : 0;
    const level = running ? (inside ? 0.1 + power * 0.32 : 0.12 + power * 0.5) : 0;
    this.engine.gain.gain.setTargetAtTime(level, now, 0.6);
    this.engine.filter.frequency.setTargetAtTime((inside ? 180 : 260) + power * (inside ? 520 : 1300), now, 0.6);
    this.engine.whine.frequency.setTargetAtTime(running ? 300 + power * 900 : 120, now, 1.2);
    this.engine.whineGain.gain.setTargetAtTime(running ? (inside ? 0.008 : 0.02) + power * (inside ? 0.01 : 0.03) : 0, now, 0.8);
  }

  /** Ding-dong, before the crew or the captain speak */
  public chime(): void {
    const a = this.audio();
    if (!a || SoundEngine.getInstance().isMuted) return;
    const { ctx, master } = a;
    [[659.25, 0], [523.25, 0.55]].forEach(([hz, at]) => {
      const o = ctx.createOscillator();
      o.type = 'sine';
      o.frequency.value = hz;
      const g = ctx.createGain();
      const t = ctx.currentTime + at;
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.22, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.001, t + 1.4);
      o.connect(g).connect(master);
      o.start(t);
      o.stop(t + 1.5);
    });
  }

  /** A low thud: the wheels on the runway, or the gear locking */
  public thump(level = 0.5): void {
    const a = this.audio();
    if (!a || SoundEngine.getInstance().isMuted) return;
    const { ctx, master } = a;
    const o = ctx.createOscillator();
    o.type = 'sine';
    const g = ctx.createGain();
    const t = ctx.currentTime;
    o.frequency.setValueAtTime(110, t);
    o.frequency.exponentialRampToValueAtTime(38, t + 0.35);
    g.gain.setValueAtTime(level, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.5);
    o.connect(g).connect(master);
    o.start(t);
    o.stop(t + 0.55);
  }

  /** The passengers clapping on landing */
  public clap(seconds = 3.5): void {
    const a = this.audio();
    if (!a || SoundEngine.getInstance().isMuted) return;
    const { ctx, master } = a;
    for (let i = 0; i < seconds * 40; i++) {
      const t = ctx.currentTime + Math.random() * seconds;
      const len = 0.03;
      const buf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * len), ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let k = 0; k < d.length; k++) d[k] = (Math.random() * 2 - 1) * Math.pow(1 - k / d.length, 3);
      const src = ctx.createBufferSource();
      src.buffer = buf;
      const f = ctx.createBiquadFilter();
      f.type = 'bandpass';
      f.frequency.value = 1200 + Math.random() * 1600;
      const g = ctx.createGain();
      g.gain.value = 0.05 + Math.random() * 0.05;
      src.connect(f).connect(g).connect(master);
      src.start(t);
    }
  }

  /** The captain (a man's voice) or the cabin crew (a woman's) speaking a line */
  public say(text: string, who: 'captain' | 'crew'): void {
    const speech = typeof window !== 'undefined' ? window.speechSynthesis : undefined;
    if (!speech || SoundEngine.getInstance().isMuted || this.stopped) return;
    if (!this.voices) {
      const all = speech.getVoices().filter((v) => /^en/i.test(v.lang));
      if (all.length) {
        const pick = (test: RegExp) => all.find((v) => /NG/i.test(v.lang) && test.test(v.name)) ?? all.find((v) => test.test(v.name) && /GB|NG|ZA/i.test(v.lang)) ?? all.find((v) => test.test(v.name)) ?? null;
        this.voices = { man: pick(MALE), woman: pick(FEMALE) };
      }
    }
    const line = new SpeechSynthesisUtterance(text);
    const voice = who === 'captain' ? this.voices?.man : this.voices?.woman;
    if (voice) line.voice = voice;
    line.lang = voice?.lang ?? 'en-GB';
    line.rate = who === 'captain' ? 0.98 : 1.04;
    line.pitch = who === 'captain' ? (voice ? 0.85 : 0.6) : voice ? 1.05 : 1.35;
    line.volume = 0.85;
    speech.speak(line);
  }

  public stop(): void {
    this.stopped = true;
    if (typeof window !== 'undefined') window.speechSynthesis?.cancel();
    const a = this.audio();
    if (this.engine && a) {
      const now = a.ctx.currentTime;
      this.engine.gain.gain.setTargetAtTime(0, now, 0.3);
      this.engine.whineGain.gain.setTargetAtTime(0, now, 0.3);
      const e = this.engine;
      setTimeout(() => { try { e.noise.stop(); e.whine.stop(); } catch { /* already stopped */ } }, 1500);
    }
    this.engine = null;
  }
}
