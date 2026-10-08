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
  private radioPlaying: boolean = false;
  private radioTimer: any = null;

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
  public playVehicleHorn(type: 'danfo' | 'okada' | 'suv' | 'keke' = 'danfo'): void {
    const ctx = this.ensureContext();
    if (!ctx || this.isMuted || !this.masterGain) return;

    const now = ctx.currentTime;
    const duration = type === 'okada' || type === 'keke' ? 0.15 : 0.22;

    // Dual-tone harmonic horn frequencies
    const freq1 = type === 'okada' ? 620 : type === 'keke' ? 680 : type === 'suv' ? 380 : 440;
    const freq2 = type === 'okada' ? 780 : type === 'keke' ? 850 : type === 'suv' ? 475 : 554; // Musical major third interval

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
  public toggleRadio(): boolean {
    this.radioPlaying = !this.radioPlaying;
    if (this.radioPlaying) {
      this.startAfrobeatsLoop();
    } else {
      this.stopAfrobeatsLoop();
    }
    return this.radioPlaying;
  }

  public isRadioActive(): boolean {
    return this.radioPlaying;
  }

  private startAfrobeatsLoop(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;

    let step = 0;
    // Classic 112 BPM Afrobeats tempo (535ms per beat, 134ms per 16th step)
    const stepInterval = 134;

    const chords = [
      [329.63, 392.0, 493.88], // Em
      [261.63, 329.63, 392.0], // C
      [293.66, 369.99, 440.0], // D
      [246.94, 311.13, 369.99], // Bm
    ];

    const playStep = () => {
      if (!this.radioPlaying) return;
      const now = ctx.currentTime;

      // Amapiano / Afrobeats Log Drum Bass Kick on steps 0, 4, 7, 10, 12
      const isLogDrumStep = [0, 4, 7, 10, 12].includes(step % 16);
      if (isLogDrumStep && !this.isMuted && this.masterGain) {
        const bassOsc = ctx.createOscillator();
        const bassGain = ctx.createGain();
        bassOsc.type = 'sine';
        bassOsc.frequency.setValueAtTime(95, now);
        bassOsc.frequency.exponentialRampToValueAtTime(38, now + 0.16);

        bassGain.gain.setValueAtTime(0.24, now);
        bassGain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);

        bassOsc.connect(bassGain);
        bassGain.connect(this.masterGain);
        bassOsc.start(now);
        bassOsc.stop(now + 0.22);
      }

      // Shaker / Hi-Hat pulse on every other step
      if (step % 2 === 0 && !this.isMuted && this.masterGain) {
        const shakerOsc = ctx.createOscillator();
        const shakerGain = ctx.createGain();
        shakerOsc.type = 'square';
        shakerOsc.frequency.setValueAtTime(8000, now);

        shakerGain.gain.setValueAtTime(0.025, now);
        shakerGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.04);

        shakerOsc.connect(shakerGain);
        shakerGain.connect(this.masterGain);
        shakerOsc.start(now);
        shakerOsc.stop(now + 0.05);
      }

      // Rhodes Chord Stab on beat 0 of every bar (16 steps)
      if (step % 16 === 0 && !this.isMuted && this.masterGain) {
        const chordIndex = Math.floor(step / 16) % chords.length;
        const notes = chords[chordIndex];
        notes.forEach((f) => {
          const cOsc = ctx.createOscillator();
          const cGain = ctx.createGain();
          cOsc.type = 'sine';
          cOsc.frequency.setValueAtTime(f, now);
          cGain.gain.setValueAtTime(0.08, now);
          cGain.gain.exponentialRampToValueAtTime(0.001, now + 0.48);

          cOsc.connect(cGain);
          cGain.connect(this.masterGain!);
          cOsc.start(now);
          cOsc.stop(now + 0.5);
        });
      }

      step = (step + 1) % 64;
      this.radioTimer = setTimeout(playStep, stepInterval);
    };

    playStep();
  }

  private stopAfrobeatsLoop(): void {
    if (this.radioTimer) {
      clearTimeout(this.radioTimer);
      this.radioTimer = null;
    }
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
}
