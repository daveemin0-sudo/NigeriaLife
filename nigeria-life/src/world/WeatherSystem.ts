import * as THREE from 'three';
import type { SkyEnvironmentManager } from './SkyEnvironmentManager';

export type WeatherType =
  | 'sunny'
  | 'clear'
  | 'partly_cloudy'
  | 'overcast'
  | 'rainy'
  | 'thunderstorm'
  | 'harmattan';

interface WeatherProfile {
  name: string;
  icon: string;
  sunMultiplier: number;
  hemiMultiplier: number;
  fogDensityMultiplier: number;
  fogColorTint: [number, number, number];
  rainIntensity: number;
  windStrength: number;
  harmattanDust: number;
  roadWetness: number;
}

const WEATHER_PROFILES: Record<string, WeatherProfile> = {
  clear: {
    name: 'Clear Sky',
    icon: '☀️',
    sunMultiplier: 1.0,
    hemiMultiplier: 1.0,
    fogDensityMultiplier: 1.0,
    fogColorTint: [1.0, 1.0, 1.0],
    rainIntensity: 0.0,
    windStrength: 0.2,
    harmattanDust: 0.25,
    roadWetness: 0.0,
  },
  sunny: {
    name: 'Sunny',
    icon: '☀️',
    sunMultiplier: 1.0,
    hemiMultiplier: 1.0,
    fogDensityMultiplier: 1.0,
    fogColorTint: [1.0, 1.0, 1.0],
    rainIntensity: 0.0,
    windStrength: 0.2,
    harmattanDust: 0.25,
    roadWetness: 0.0,
  },
  partly_cloudy: {
    name: 'Partly Cloudy',
    icon: '⛅',
    sunMultiplier: 0.88,
    hemiMultiplier: 0.94,
    fogDensityMultiplier: 1.1,
    fogColorTint: [0.96, 0.96, 0.98],
    rainIntensity: 0.0,
    windStrength: 0.35,
    harmattanDust: 0.2,
    roadWetness: 0.0,
  },
  overcast: {
    name: 'Overcast',
    icon: '☁️',
    sunMultiplier: 0.52,
    hemiMultiplier: 0.68,
    fogDensityMultiplier: 1.35,
    fogColorTint: [0.78, 0.82, 0.88],
    rainIntensity: 0.0,
    windStrength: 0.5,
    harmattanDust: 0.1,
    roadWetness: 0.05,
  },
  rainy: {
    name: 'Rainy',
    icon: '🌧️',
    sunMultiplier: 0.35,
    hemiMultiplier: 0.52,
    fogDensityMultiplier: 1.55,
    fogColorTint: [0.60, 0.66, 0.76],
    rainIntensity: 0.65,
    windStrength: 0.65,
    harmattanDust: 0.0,
    roadWetness: 0.85,
  },
  thunderstorm: {
    name: 'Thunderstorm',
    icon: '⛈️',
    sunMultiplier: 0.20,
    hemiMultiplier: 0.38,
    fogDensityMultiplier: 1.85,
    fogColorTint: [0.42, 0.48, 0.60],
    rainIntensity: 1.0,
    windStrength: 0.95,
    harmattanDust: 0.0,
    roadWetness: 1.0,
  },
  harmattan: {
    name: 'Harmattan Haze',
    icon: '🌫️',
    sunMultiplier: 0.72,
    hemiMultiplier: 0.82,
    fogDensityMultiplier: 2.1,
    fogColorTint: [0.94, 0.84, 0.68], // Warm golden Saharan dust tint
    rainIntensity: 0.0,
    windStrength: 0.65,
    harmattanDust: 0.85,
    roadWetness: 0.0,
  },
};

export class WeatherSystem {
  private scene: THREE.Scene;
  public currentWeather: WeatherType = 'sunny';

  // Smooth interpolation state
  private curSunMultiplier: number = 1.0;
  private curHemiMultiplier: number = 1.0;
  private curFogDensityMultiplier: number = 1.0;
  private curFogColorTint = new THREE.Vector3(1.0, 1.0, 1.0);
  private curRainIntensity: number = 0.0;
  private curWindStrength: number = 0.2;
  private curHarmattanDust: number = 0.25;
  private curRoadWetness: number = 0.0;

  // Rain particles
  private rainGeometry!: THREE.BufferGeometry;
  private rainMaterial!: THREE.PointsMaterial;
  private rainParticles!: THREE.Points;
  private rainCount: number = 2500;
  private rainVelocity: Float32Array = new Float32Array(this.rainCount);

  // Lightning system (delta-time phase machine, zero setTimeout)
  private lightningLight!: THREE.PointLight;
  private lightningTimer: number = 0;
  private thunderPhase: number = 0; // 0: idle, 1: strike 1, 2: gap, 3: strike 2, 4: dissipation
  private phaseTimer: number = 0;

  // Audio synthesis (Web Audio API procedural white noise)
  private audioCtx: AudioContext | null = null;
  private rainGainNode: GainNode | null = null;

  // References
  private sunLight: THREE.DirectionalLight | null = null;
  private hemiLight: THREE.HemisphereLight | null = null;
  private roadsMeshList: THREE.MeshStandardMaterial[] = [];
  private atmosphere: any = null;
  private skyEnvironment: SkyEnvironmentManager | null = null;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.createRainSystem();
    this.createLightningLight();
  }

  public registerLights(sun: THREE.DirectionalLight, hemi: THREE.HemisphereLight): void {
    this.sunLight = sun;
    this.hemiLight = hemi;
  }

  public registerRoadMaterial(mat: THREE.MeshStandardMaterial): void {
    this.roadsMeshList.push(mat);
  }

  public registerAtmosphere(atmosphere: any): void {
    this.atmosphere = atmosphere;
  }

  public registerSkyEnvironment(sky: SkyEnvironmentManager): void {
    this.skyEnvironment = sky;
  }

  private createRainSystem(): void {
    this.rainGeometry = new THREE.BufferGeometry();
    const positions = new Float32Array(this.rainCount * 3);

    for (let i = 0; i < this.rainCount; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 260; // X spread
      positions[i * 3 + 1] = Math.random() * 50 + 2; // Y height
      positions[i * 3 + 2] = (Math.random() - 0.5) * 260; // Z spread
      this.rainVelocity[i] = 30 + Math.random() * 15; // Fall speed
    }

    this.rainGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

    this.rainMaterial = new THREE.PointsMaterial({
      color: 0x93c5fd,
      size: 0.28,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    this.rainParticles = new THREE.Points(this.rainGeometry, this.rainMaterial);
    this.rainParticles.visible = false;
    this.scene.add(this.rainParticles);
  }

  private createLightningLight(): void {
    this.lightningLight = new THREE.PointLight(0xdbeafe, 0, 180, 1.2);
    this.lightningLight.position.set(0, 50, 0);
    this.scene.add(this.lightningLight);
  }

  public getWeatherLabel(): string {
    const prof = WEATHER_PROFILES[this.currentWeather] || WEATHER_PROFILES.clear;
    return `${prof.icon} ${prof.name}`;
  }

  public getWeatherIcon(): string {
    const prof = WEATHER_PROFILES[this.currentWeather] || WEATHER_PROFILES.clear;
    return prof.icon;
  }

  public toggleWeather(): WeatherType {
    // Backward-compatible toggle between sunny and rainy
    const next = this.currentWeather === 'rainy' ? 'sunny' : 'rainy';
    this.setWeather(next);
    return next;
  }

  public cycleWeather(): WeatherType {
    const sequence: WeatherType[] = [
      'sunny',
      'partly_cloudy',
      'overcast',
      'rainy',
      'thunderstorm',
      'harmattan',
    ];
    const currentIndex = sequence.indexOf(this.currentWeather);
    const next = sequence[(currentIndex + 1) % sequence.length];
    this.setWeather(next);
    return next;
  }

  public setWeather(type: WeatherType): void {
    if (!WEATHER_PROFILES[type]) {
      type = 'sunny';
    }
    this.currentWeather = type;

    // Start or stop procedural rain audio depending on target rain intensity
    const prof = WEATHER_PROFILES[type];
    if (prof.rainIntensity > 0.05) {
      this.startRainAudio();
    } else {
      this.stopRainAudio();
    }
  }

  private startRainAudio(): void {
    try {
      if (!this.audioCtx) {
        const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
        if (AudioContextClass) {
          this.audioCtx = new AudioContextClass();
        }
      }
      if (!this.audioCtx) return;

      if (this.audioCtx.state === 'suspended') {
        this.audioCtx.resume();
      }

      if (!this.rainGainNode) {
        const bufferSize = this.audioCtx.sampleRate * 2;
        const noiseBuffer = this.audioCtx.createBuffer(1, bufferSize, this.audioCtx.sampleRate);
        const output = noiseBuffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
          output[i] = Math.random() * 2 - 1;
        }

        const whiteNoise = this.audioCtx.createBufferSource();
        whiteNoise.buffer = noiseBuffer;
        whiteNoise.loop = true;

        const filter = this.audioCtx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(800, this.audioCtx.currentTime);

        this.rainGainNode = this.audioCtx.createGain();
        this.rainGainNode.gain.setValueAtTime(0.04, this.audioCtx.currentTime);

        whiteNoise.connect(filter);
        filter.connect(this.rainGainNode);
        this.rainGainNode.connect(this.audioCtx.destination);
        whiteNoise.start();
      }
    } catch {
      // Audio autoplay policy catch
    }
  }

  private stopRainAudio(): void {
    if (this.rainGainNode && this.audioCtx) {
      try {
        this.rainGainNode.gain.setTargetAtTime(0, this.audioCtx.currentTime, 0.5);
      } catch {}
    }
  }

  public update(delta: number, playerPos?: THREE.Vector3): void {
    const safeDelta = Math.min(delta, 0.25);
    const target = WEATHER_PROFILES[this.currentWeather] || WEATHER_PROFILES.clear;

    // 1. Smoothly interpolate weather parameters toward target profile
    const lerpRate = Math.min(1.0, safeDelta * 1.8);
    this.curSunMultiplier = THREE.MathUtils.lerp(this.curSunMultiplier, target.sunMultiplier, lerpRate);
    this.curHemiMultiplier = THREE.MathUtils.lerp(this.curHemiMultiplier, target.hemiMultiplier, lerpRate);
    this.curFogDensityMultiplier = THREE.MathUtils.lerp(this.curFogDensityMultiplier, target.fogDensityMultiplier, lerpRate);

    this.curFogColorTint.x = THREE.MathUtils.lerp(this.curFogColorTint.x, target.fogColorTint[0], lerpRate);
    this.curFogColorTint.y = THREE.MathUtils.lerp(this.curFogColorTint.y, target.fogColorTint[1], lerpRate);
    this.curFogColorTint.z = THREE.MathUtils.lerp(this.curFogColorTint.z, target.fogColorTint[2], lerpRate);

    this.curRainIntensity = THREE.MathUtils.lerp(this.curRainIntensity, target.rainIntensity, lerpRate);
    this.curWindStrength = THREE.MathUtils.lerp(this.curWindStrength, target.windStrength, lerpRate);
    this.curHarmattanDust = THREE.MathUtils.lerp(this.curHarmattanDust, target.harmattanDust, lerpRate);
    this.curRoadWetness = THREE.MathUtils.lerp(this.curRoadWetness, target.roadWetness, lerpRate);

    // 2. Feed weather multipliers into authoritative sky environment (never overwriting scene.background!)
    if (this.skyEnvironment) {
      this.skyEnvironment.weatherSunMultiplier = this.curSunMultiplier;
      this.skyEnvironment.weatherHemiMultiplier = this.curHemiMultiplier;
      this.skyEnvironment.weatherFogDensityMultiplier = this.curFogDensityMultiplier;
      this.skyEnvironment.weatherFogColorMultiplier.setRGB(
        this.curFogColorTint.x,
        this.curFogColorTint.y,
        this.curFogColorTint.z
      );
    } else {
      if (this.sunLight) this.sunLight.intensity = this.curSunMultiplier * 2.0;
      if (this.hemiLight) this.hemiLight.intensity = this.curHemiMultiplier * 0.7;
    }

    // 3. Wet Asphalt PBR Material Shimmer
    const targetRoughness = THREE.MathUtils.lerp(0.85, 0.15, this.curRoadWetness);
    const targetMetalness = THREE.MathUtils.lerp(0.05, 0.65, this.curRoadWetness);
    for (const mat of this.roadsMeshList) {
      mat.roughness = targetRoughness;
      mat.metalness = targetMetalness;
    }

    // 4. Harmattan Dust and Puddle Environmental Sync
    if (this.atmosphere) {
      if (typeof this.atmosphere.setDustIntensity === 'function') {
        this.atmosphere.setDustIntensity(this.curHarmattanDust);
      }
      if (typeof this.atmosphere.setPuddlesVisible === 'function') {
        this.atmosphere.setPuddlesVisible(this.curRoadWetness > 0.25);
      }
    }

    // 5. Rain Particle Simulation
    const isRaining = this.curRainIntensity > 0.015;
    this.rainParticles.visible = isRaining;
    if (isRaining) {
      this.rainMaterial.opacity = this.curRainIntensity * 0.75;
      const positions = this.rainGeometry.attributes.position.array as Float32Array;
      const center = playerPos || new THREE.Vector3(0, 0, 0);

      // Wind displacement factor
      const windX = Math.sin(this.curWindStrength * 2.0) * 8.0 * safeDelta;

      for (let i = 0; i < this.rainCount; i++) {
        // Fall down with wind angle
        positions[i * 3] += windX;
        positions[i * 3 + 1] -= this.rainVelocity[i] * safeDelta;

        // Wrap around player box when hitting ground
        if (positions[i * 3 + 1] < 0.2) {
          positions[i * 3 + 1] = 48 + Math.random() * 10;
          positions[i * 3] = center.x + (Math.random() - 0.5) * 160;
          positions[i * 3 + 2] = center.z + (Math.random() - 0.5) * 160;
        }
      }
      this.rainGeometry.attributes.position.needsUpdate = true;
    }

    // 6. Rain Audio Gain
    if (this.rainGainNode && this.audioCtx) {
      try {
        const audioGain = this.curRainIntensity * 0.045;
        this.rainGainNode.gain.setTargetAtTime(audioGain, this.audioCtx.currentTime, 0.2);
      } catch {}
    }

    // 7. Thunder & Lightning Phase Machine (Strictly delta-time driven, zero setTimeout)
    const canThunder = this.currentWeather === 'thunderstorm' || (this.currentWeather === 'rainy' && this.curRainIntensity > 0.4);
    if (canThunder) {
      const intervalThreshold = this.currentWeather === 'thunderstorm' ? 8.0 : 22.0;
      this.lightningTimer += safeDelta;

      if (this.thunderPhase === 0 && this.lightningTimer > intervalThreshold) {
        if (Math.random() < (this.currentWeather === 'thunderstorm' ? 0.65 : 0.25)) {
          this.thunderPhase = 1;
          this.phaseTimer = 0;
          const center = playerPos || new THREE.Vector3(0, 0, 0);
          this.lightningLight.position.set(
            center.x + (Math.random() - 0.5) * 120,
            60 + Math.random() * 20,
            center.z + (Math.random() - 0.5) * 120
          );
        }
        this.lightningTimer = 0;
      }

      if (this.thunderPhase > 0) {
        this.phaseTimer += safeDelta;
        if (this.thunderPhase === 1) {
          // Primary strike flash
          this.lightningLight.intensity = 5.5 + Math.random() * 2.5;
          if (this.phaseTimer >= 0.09) {
            this.thunderPhase = 2;
            this.phaseTimer = 0;
          }
        } else if (this.thunderPhase === 2) {
          // Dark lull
          this.lightningLight.intensity = 0;
          if (this.phaseTimer >= 0.06) {
            this.thunderPhase = 3;
            this.phaseTimer = 0;
          }
        } else if (this.thunderPhase === 3) {
          // Secondary after-flash
          this.lightningLight.intensity = 3.2;
          if (this.phaseTimer >= 0.08) {
            this.thunderPhase = 4;
            this.phaseTimer = 0;
          }
        } else if (this.thunderPhase === 4) {
          // Final dissipation
          this.lightningLight.intensity = 0;
          this.thunderPhase = 0;
          this.phaseTimer = 0;
        }
      }
    } else {
      this.lightningLight.intensity = 0;
      this.thunderPhase = 0;
    }
  }
}
