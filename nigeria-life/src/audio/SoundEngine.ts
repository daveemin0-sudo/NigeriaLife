/**
 * Unified Procedural Audio Engine for NigeriaLife.
 * Uses Web Audio API synthesizers to produce authentic Nigerian open-world soundscapes:
 * 1. Lagos Danfo / Okada dual-tone "Pim Pim!" horns
 * 2. Walking / running asphalt footstep taps
 * 3. Tiger generator ("I pass my neighbor") exhaust rumble
 * 4. Suya grill charcoal sizzle
 * 5. Bank / POS Naira transaction success chimes
 * 6. Afrobeats groove background radio synthesizer
 */

export class SoundEngine {
  private static instance: SoundEngine;
  private ctx: AudioContext | null = null;
  public isMuted: boolean = false;
  private masterGain: GainNode | null = null;

  // Background generator & ambient loops
  private generatorOsc: OscillatorNode | null = null;
  private generatorGain: GainNode | null = null;

  private constructor() {
    // Lazy initialize on first user interaction to satisfy browser autoplay policy
    const initAudio = () => {
      this.ensureContext();
      window.removeEventListener('pointerdown', initAudio);
      window.removeEventListener('keydown', initAudio);
      window.removeEventListener('touchstart', initAudio);
    };

    window.addEventListener('pointerdown', initAudio, { once: true });
    window.addEventListener('keydown', initAudio, { once: true });
    window.addEventListener('touchstart', initAudio, { once: true });
  }

  public static getInstance(): SoundEngine {
    if (!SoundEngine.instance) {
      SoundEngine.instance = new SoundEngine();
    }
    return SoundEngine.instance;
  }

  private ensureContext(): AudioContext | null {
    if (!this.ctx) {
      const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtxClass) return null;
      this.ctx = new AudioCtxClass();

      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.setValueAtTime(this.isMuted ? 0 : 0.65, this.ctx.currentTime);
      this.masterGain.connect(this.ctx.destination);
    }

    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }

    return this.ctx;
  }

  public toggleMute(): boolean {
    this.isMuted = !this.isMuted;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setValueAtTime(this.isMuted ? 0 : 0.65, this.ctx.currentTime);
    }
    return this.isMuted;
  }

  // =========================================================================
  // 1. VEHICLE HORN: Authentic Nigerian Danfo / Okada Dual-Tone "Pim-Pim!"
  // =========================================================================
  /** A convoy's siren: one rising and falling wail, as loud as the convoy is near (0 to 1) */
  public playSiren(level = 0.5): void {
    const ctx = this.ensureContext();
    if (!ctx || this.isMuted || !this.masterGain || level <= 0.02) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(650, now);
    osc.frequency.linearRampToValueAtTime(1150, now + 0.55);
    osc.frequency.linearRampToValueAtTime(650, now + 1.1);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(0.16 * level, now + 0.08);
    gain.gain.linearRampToValueAtTime(0.0001, now + 1.15);
    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 1.2);
  }

  public playVehicleHorn(type: string = 'danfo'): void {
    const ctx = this.ensureContext();
    if (!ctx || this.isMuted || !this.masterGain) return;

    const now = ctx.currentTime;
    if (type === 'ambulance') {
      // Emergency two-tone siren yelp (high-low alternating warble)
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(960, now);
      osc.frequency.linearRampToValueAtTime(740, now + 0.18);
      osc.frequency.linearRampToValueAtTime(960, now + 0.36);
      gain.gain.setValueAtTime(0.22, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.38);
      osc.connect(gain);
      gain.connect(this.masterGain!);
      osc.start(now);
      osc.stop(now + 0.38);
      return;
    }

    if (type === 'electric_car') {
      // Modern smooth acoustic pedestrian warning chime
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, now); // D5
      osc.frequency.exponentialRampToValueAtTime(880, now + 0.16); // A5
      gain.gain.setValueAtTime(0.15, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
      osc.connect(gain);
      gain.connect(this.masterGain!);
      osc.start(now);
      osc.stop(now + 0.22);
      return;
    }

    const duration = type === 'okada' || type === 'keke' ? 0.15 : 0.22;

    // Dual-tone harmonic horn frequencies
    let freq1 = 440;
    let freq2 = 554;
    if (type === 'okada') {
      freq1 = 620; freq2 = 780;
    } else if (type === 'keke') {
      freq1 = 680; freq2 = 850;
    } else if (type === 'suv' || type === 'gwagon') {
      freq1 = 340; freq2 = 425; // Deep booming truck horn
    } else if (type === 'luxury_sedan') {
      freq1 = 370; freq2 = 466; // Refined European executive dual-tone
    } else if (type === 'sports_car') {
      freq1 = 510; freq2 = 640; // High-pitched aggressive sports horn
    } else if (type === 'sedan') {
      freq1 = 415; freq2 = 520;
    }

    [freq1, freq2].forEach((freq) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = type === 'okada' || type === 'keke' ? 'square' : 'sawtooth';
      osc.frequency.setValueAtTime(freq, now);
      // Slight pitch droop characteristic of vehicular horns
      osc.frequency.exponentialRampToValueAtTime(freq * 0.98, now + duration);

      gain.gain.setValueAtTime(0.18, now);
      gain.gain.setValueAtTime(0.18, now + duration - 0.04);
      gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

      osc.connect(gain);
      gain.connect(this.masterGain!);

      osc.start(now);
      osc.stop(now + duration);
    });
  }

  // =========================================================================
  // 2. FOOTSTEPS: Surface-Responsive Shoe Taps (Asphalt / Concrete)
  // =========================================================================
  private lastFootstepTime: number = 0;

  public playFootstep(isSprinting: boolean = false): void {
    const ctx = this.ensureContext();
    if (!ctx || this.isMuted || !this.masterGain) return;

    const now = ctx.currentTime;
    const minInterval = isSprinting ? 0.24 : 0.38;
    if (now - this.lastFootstepTime < minInterval) return;
    this.lastFootstepTime = now;

    // Filtered noise pulse simulating rubber shoe sole against street pavement
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();

    osc.type = 'triangle';
    const pitch = 75 + Math.random() * 25;
    osc.frequency.setValueAtTime(pitch, now);
    osc.frequency.exponentialRampToValueAtTime(25, now + 0.05);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(450, now);

    gain.gain.setValueAtTime(isSprinting ? 0.22 : 0.12, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);

    osc.start(now);
    osc.stop(now + 0.07);
  }

  // =========================================================================
  // 3. ENGINE ACCELERATION & IDLE RUMBLE
  // =========================================================================
  public playEngineAccelerate(speedRatio: number): void {
    const ctx = this.ensureContext();
    if (!ctx || this.isMuted || !this.masterGain) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sawtooth';
    const baseFreq = 55 + speedRatio * 95;
    osc.frequency.setValueAtTime(baseFreq, now);

    gain.gain.setValueAtTime(0.06 + speedRatio * 0.08, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);

    osc.connect(gain);
    gain.connect(this.masterGain);

    osc.start(now);
    osc.stop(now + 0.13);
  }

  // =========================================================================
  // 4. FINANCIAL TRANSACTION: Authentic KudiPoint / NaijaPay Alert Chime
  // =========================================================================
  public playTransactionSuccess(): void {
    const ctx = this.ensureContext();
    if (!ctx || this.isMuted || !this.masterGain) return;

    const now = ctx.currentTime;
    const notes = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6 arpeggio

    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + i * 0.07);

      gain.gain.setValueAtTime(0.18, now + i * 0.07);
      gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.07 + 0.28);

      osc.connect(gain);
      gain.connect(this.masterGain!);

      osc.start(now + i * 0.07);
      osc.stop(now + i * 0.07 + 0.3);
    });
  }

  // =========================================================================
  // 4b. UI AUDIO: Subtle tactile click / tap
  // =========================================================================
  public playClickSound(): void {
    const ctx = this.ensureContext();
    if (!ctx || this.isMuted || !this.masterGain) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(800, now);
    osc.frequency.exponentialRampToValueAtTime(400, now + 0.04);
    gain.gain.setValueAtTime(0.12, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);
    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.045);
  }

  // =========================================================================
  // 5. AFROBEATS STREET RADIO: Rhythmic Synthetic Log-Drum & Rhodes Chords
  // =========================================================================
  /** The music player, which the old radio buttons start and stop (set by the music player itself) */
  public static radio: { toggle(): boolean; isOn(): boolean } | null = null;

  /** The audio context and the master volume, for whoever plays through the game's sound */
  public audio(start = true): { ctx: AudioContext; master: GainNode } | null {
    // Background sound waits for the player's first touch: browsers only allow sound after one
    if (!start && !this.ctx) return null;
    const ctx = this.ensureContext();
    return ctx && this.masterGain ? { ctx, master: this.masterGain } : null;
  }

  /** A horn somewhere down the road: two short notes, muffled by distance */
  public playDistantHorn(level = 0.25): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.masterGain || this.isMuted) return;
    const now = ctx.currentTime;
    const pitch = 330 + Math.random() * 160;
    const beeps = Math.random() < 0.5 ? 1 : 2;
    const low = ctx.createBiquadFilter();
    low.type = 'lowpass';
    low.frequency.value = 1400;
    low.connect(this.masterGain);
    for (let b = 0; b < beeps; b++) {
      const t = now + b * 0.24;
      for (const f of [pitch, pitch * 1.26]) {
        const o = ctx.createOscillator();
        o.type = 'square';
        o.frequency.value = f;
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(0.05 * level, t + 0.02);
        g.gain.setValueAtTime(0.05 * level, t + 0.16);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 0.2);
        o.connect(g);
        g.connect(low);
        o.start(t);
        o.stop(t + 0.22);
      }
    }
  }

  /** The game is out of sight (Chrome closed, another app): every sound stops where it is */
  public suspendAll(): void {
    if (this.ctx && this.ctx.state === 'running') void this.ctx.suspend();
    try {
      window.speechSynthesis?.cancel();
    } catch {
      // No speech here
    }
  }

  /** Back in sight: the sound carries on */
  public resumeAll(): void {
    if (this.ctx && this.ctx.state === 'suspended') void this.ctx.resume();
  }

  public toggleRadio(): boolean {
    return SoundEngine.radio?.toggle() ?? false;
  }

  public isRadioActive(): boolean {
    return SoundEngine.radio?.isOn() ?? false;
  }

  // =========================================================================
  // 6. ATMOSPHERIC GENERATOR HUM (Tiger "I pass my neighbor" engine)
  // =========================================================================
  public updateAmbientGenerator(distanceToGen: number): void {
    const ctx = this.ensureContext();
    if (!ctx || this.isMuted || !this.masterGain) return;

    if (distanceToGen > 24) {
      if (this.generatorOsc) {
        try {
          this.generatorOsc.stop();
          this.generatorOsc.disconnect();
          this.generatorOsc = null;
        } catch {}
      }
      return;
    }

    if (!this.generatorOsc) {
      this.generatorOsc = ctx.createOscillator();
      this.generatorGain = ctx.createGain();

      this.generatorOsc.type = 'sawtooth';
      this.generatorOsc.frequency.setValueAtTime(62, ctx.currentTime); // ~3700 RPM 2-stroke generator

      this.generatorOsc.connect(this.generatorGain);
      this.generatorGain.connect(this.masterGain);
      this.generatorOsc.start();
    }

    if (this.generatorGain) {
      // Inverse distance squared attenuation
      const vol = Math.max(0, Math.min(0.08, 0.08 * (1 - distanceToGen / 24)));
      this.generatorGain.gain.setValueAtTime(vol, ctx.currentTime);
    }
  }

  // =========================================================================
  // 7. DANFO CONDUCTOR ROOF / BODY SLAP ("Piam-Piam! Carry go!")
  // =========================================================================
  public playConductorSlap(): void {
    const ctx = this.ensureContext();
    if (!ctx || this.isMuted || !this.masterGain) return;
    const now = ctx.currentTime;
    [0, 0.12].forEach((offset) => {
      const t = now + offset;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const filter = ctx.createBiquadFilter();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(140, t);
      osc.frequency.exponentialRampToValueAtTime(45, t + 0.08);

      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(420, t);

      gain.gain.setValueAtTime(0.35, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.09);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.masterGain!);

      osc.start(t);
      osc.stop(t + 0.1);
    });
  }

  // =========================================================================
  // 8. NEPA BLACKOUT TRANSFORMER TRIP ("Kpa-Bzzt!")
  // =========================================================================
  public playTransformerTrip(): void {
    const ctx = this.ensureContext();
    if (!ctx || this.isMuted || !this.masterGain) return;
    const now = ctx.currentTime;

    // Explosive low punch ("Kpa!")
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(110, now);
    osc.frequency.exponentialRampToValueAtTime(28, now + 0.22);
    gain.gain.setValueAtTime(0.4, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.26);

    // High electrical fizzle arc ("Bzzt!")
    const spark = ctx.createOscillator();
    const sparkGain = ctx.createGain();
    spark.type = 'square';
    spark.frequency.setValueAtTime(1200, now + 0.04);
    spark.frequency.linearRampToValueAtTime(300, now + 0.18);
    sparkGain.gain.setValueAtTime(0.18, now + 0.04);
    sparkGain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
    spark.connect(sparkGain);
    sparkGain.connect(this.masterGain);
    spark.start(now + 0.04);
    spark.stop(now + 0.22);
  }

  // =========================================================================
  // 9. UP NEPA POWER RESTORATION SURGE ("Bzzzt-Ting!")
  // =========================================================================
  public playNepaRestored(): void {
    const ctx = this.ensureContext();
    if (!ctx || this.isMuted || !this.masterGain) return;
    const now = ctx.currentTime;

    // Rising power hum
    const hum = ctx.createOscillator();
    const humGain = ctx.createGain();
    hum.type = 'sine';
    hum.frequency.setValueAtTime(50, now);
    hum.frequency.exponentialRampToValueAtTime(100, now + 0.35);
    humGain.gain.setValueAtTime(0.02, now);
    humGain.gain.linearRampToValueAtTime(0.25, now + 0.3);
    humGain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
    hum.connect(humGain);
    humGain.connect(this.masterGain);
    hum.start(now);
    hum.stop(now + 0.46);

    // Relay contactor snap ("Clack!")
    const snap = ctx.createOscillator();
    const snapGain = ctx.createGain();
    snap.type = 'triangle';
    snap.frequency.setValueAtTime(800, now + 0.32);
    snap.frequency.exponentialRampToValueAtTime(80, now + 0.38);
    snapGain.gain.setValueAtTime(0.3, now + 0.32);
    snapGain.gain.exponentialRampToValueAtTime(0.001, now + 0.39);
    snap.connect(snapGain);
    snapGain.connect(this.masterGain);
    snap.start(now + 0.32);
    snap.stop(now + 0.4);
  }

  // =========================================================================
  // 10. RECOIL PULL STARTER & GENERATOR CRANK
  // =========================================================================
  public playGeneratorPull(): void {
    const ctx = this.ensureContext();
    if (!ctx || this.isMuted || !this.masterGain) return;
    const now = ctx.currentTime;

    // Pull friction whoosh
    const pull = ctx.createOscillator();
    const pullGain = ctx.createGain();
    pull.type = 'sawtooth';
    pull.frequency.setValueAtTime(220, now);
    pull.frequency.exponentialRampToValueAtTime(480, now + 0.15);
    pullGain.gain.setValueAtTime(0.2, now);
    pullGain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
    pull.connect(pullGain);
    pullGain.connect(this.masterGain);
    pull.start(now);
    pull.stop(now + 0.2);

    // 2-stroke sputter catches
    [0.18, 0.28, 0.36, 0.43, 0.49].forEach((tOff, i) => {
      const t = now + tOff;
      const chug = ctx.createOscillator();
      const chugGain = ctx.createGain();
      chug.type = 'sawtooth';
      chug.frequency.setValueAtTime(65 + i * 4, t);
      chugGain.gain.setValueAtTime(0.22, t);
      chugGain.gain.exponentialRampToValueAtTime(0.001, t + 0.06);
      chug.connect(chugGain);
      chugGain.connect(this.masterGain!);
      chug.start(t);
      chug.stop(t + 0.07);
    });
  }
}
