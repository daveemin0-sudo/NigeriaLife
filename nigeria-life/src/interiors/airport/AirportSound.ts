import { SoundEngine } from '../../audio/SoundEngine';
import { FEMALE, spoken } from '../../audio/StreetAmbience';
import { showGameToast } from '../../ui/GameToast';

/**
 * How the terminal sounds: the low murmur of a busy hall, and the public address. Every minute
 * or so the airport's three-note chime, then a woman's voice: boarding calls and final calls for
 * this airport's flights, the arrivals belt, the reminders about luggage and liquids. What is said
 * is also shown as a caption, for a phone on silent.
 */
export class AirportSound {
  private hum: { source: AudioBufferSource; gain: GainNode } | null = null;
  private next = 7;
  private turn = 0;
  private on = false;
  private voice: SpeechSynthesisVoice | null | undefined;

  private audio(): { ctx: AudioContext; master: GainNode } | null {
    return SoundEngine.getInstance().audio(false) as { ctx: AudioContext; master: GainNode } | null;
  }

  public start(): void {
    this.on = true;
    this.next = 6;
    const a = this.audio();
    if (!a || this.hum) return;
    // The hall: brown noise, low and soft, like many people talking far off under a high roof
    const { ctx, master } = a;
    const buf = ctx.createBuffer(1, ctx.sampleRate * 4, ctx.sampleRate);
    const d = buf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < d.length; i++) {
      last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02;
      d[i] = last * 3.2;
    }
    const source = ctx.createBufferSource();
    source.buffer = buf;
    source.loop = true;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 420;
    filter.Q.value = 0.6;
    const gain = ctx.createGain();
    gain.gain.value = 0;
    gain.gain.setTargetAtTime(0.06, ctx.currentTime, 1.2);
    source.connect(filter).connect(gain).connect(master);
    source.start();
    this.hum = { source, gain };
  }

  public stop(): void {
    this.on = false;
    if (typeof window !== 'undefined') window.speechSynthesis?.cancel();
    const a = this.audio();
    if (this.hum && a) {
      const hum = this.hum;
      hum.gain.gain.setTargetAtTime(0, a.ctx.currentTime, 0.3);
      setTimeout(() => hum.source.stop(), 1500);
    }
    this.hum = null;
  }

  public update(delta: number, lines: () => string[]): void {
    if (!this.on) return;
    // The hall's sound starts once the game may make sound (after the player's first touch)
    if (!this.hum && this.audio()) this.start();
    this.next -= delta;
    if (this.next > 0) return;
    this.next = 42 + Math.random() * 26;
    const all = lines();
    if (!all.length) return;
    this.announce(all[this.turn++ % all.length]);
  }

  /** The chime, then the line spoken and shown */
  public announce(text: string): void {
    showGameToast(`📢 ${text}`, 'info', 8000);
    const engine = SoundEngine.getInstance();
    if (engine.isMuted) return;
    this.chime();
    setTimeout(() => this.say(text), 1700);
  }

  /** The three rising notes airports use before an announcement */
  private chime(): void {
    const a = this.audio();
    if (!a) return;
    const { ctx, master } = a;
    [[523.25, 0], [659.25, 0.42], [783.99, 0.84]].forEach(([hz, at]) => {
      const o = ctx.createOscillator();
      o.type = 'sine';
      o.frequency.value = hz;
      const g = ctx.createGain();
      const t = ctx.currentTime + at;
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.2, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.001, t + 1.3);
      o.connect(g).connect(master);
      o.start(t);
      o.stop(t + 1.4);
    });
  }

  private say(text: string): void {
    const speech = typeof window !== 'undefined' ? window.speechSynthesis : undefined;
    if (!speech || !this.on || SoundEngine.getInstance().isMuted) return;
    if (this.voice === undefined) {
      const all = speech.getVoices().filter((v) => /^en/i.test(v.lang));
      if (all.length) this.voice = all.find((v) => /NG/i.test(v.lang) && FEMALE.test(v.name)) ?? all.find((v) => FEMALE.test(v.name) && /GB|NG|ZA/i.test(v.lang)) ?? all.find((v) => FEMALE.test(v.name)) ?? null;
    }
    const line = new SpeechSynthesisUtterance(spoken(text));
    if (this.voice) line.voice = this.voice;
    line.lang = this.voice?.lang ?? 'en-GB';
    line.rate = 0.94;
    line.pitch = this.voice ? 1.02 : 1.25;
    line.volume = 0.9;
    speech.speak(line);
  }
}

type AudioBufferSource = AudioBufferSourceNode;
