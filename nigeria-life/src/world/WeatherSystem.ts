import * as THREE from 'three';

export type WeatherType = 'sunny' | 'rainy';

export class WeatherSystem {
  private scene: THREE.Scene;
  public currentWeather: WeatherType = 'sunny';

  // Rain particles
  private rainGeometry!: THREE.BufferGeometry;
  private rainMaterial!: THREE.PointsMaterial;
  private rainParticles!: THREE.Points;
  private rainCount: number = 2500;
  private rainVelocity: Float32Array = new Float32Array(this.rainCount);

  // Lightning
  private lightningLight!: THREE.PointLight;
  private lightningTimer: number = 0;
  private isFlashing: boolean = false;

  // Audio synthesis (Web Audio API procedural rain & thunder)
  private audioCtx: AudioContext | null = null;
  private rainGainNode: GainNode | null = null;

  // Environment references
  private sunLight: THREE.DirectionalLight | null = null;
  private hemiLight: THREE.HemisphereLight | null = null;
  private roadsMeshList: THREE.MeshStandardMaterial[] = [];
  private atmosphere: any = null;

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

  private createRainSystem(): void {
    this.rainGeometry = new THREE.BufferGeometry();
    const positions = new Float32Array(this.rainCount * 3);

    for (let i = 0; i < this.rainCount; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 260;     // X spread
      positions[i * 3 + 1] = Math.random() * 50 + 2;      // Y height
      positions[i * 3 + 2] = (Math.random() - 0.5) * 260; // Z spread
      this.rainVelocity[i] = 28 + Math.random() * 14;     // Fall speed
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

  public toggleWeather(): WeatherType {
    this.setWeather(this.currentWeather === 'sunny' ? 'rainy' : 'sunny');
    return this.currentWeather;
  }

  public setWeather(type: WeatherType): void {
    this.currentWeather = type;

    if (type === 'rainy') {
      this.rainParticles.visible = true;
      this.rainMaterial.opacity = 0.75;

      // Dark dramatic rain storm lighting
      if (this.scene.fog && this.scene.fog instanceof THREE.FogExp2) {
        this.scene.fog.color.setHex(0x334155);
        this.scene.fog.density = 0.016;
      }
      this.scene.background = new THREE.Color(0x1e293b);

      if (this.sunLight) {
        this.sunLight.intensity = 0.6;
        this.sunLight.color.setHex(0x94a3b8);
      }
      if (this.hemiLight) {
        this.hemiLight.intensity = 0.7;
        this.hemiLight.color.setHex(0x64748b);
      }

      // Wet asphalt shimmer
      for (const mat of this.roadsMeshList) {
        mat.roughness = 0.15;
        mat.metalness = 0.65;
      }

      if (this.atmosphere && typeof this.atmosphere.setDustIntensity === 'function') {
        this.atmosphere.setDustIntensity(0.1);
      }

      this.startRainAudio();
    } else {
      this.rainParticles.visible = false;
      this.rainMaterial.opacity = 0;

      // Warm tropical golden sunlight
      if (this.scene.fog && this.scene.fog instanceof THREE.FogExp2) {
        this.scene.fog.color.setHex(0xa9d6f8);
        this.scene.fog.density = 0.012;
      }
      this.scene.background = new THREE.Color(0x6eb7f2);

      if (this.sunLight) {
        this.sunLight.intensity = 2.2;
        this.sunLight.color.setHex(0xfff5db);
      }
      if (this.hemiLight) {
        this.hemiLight.intensity = 1.3;
        this.hemiLight.color.setHex(0xffffff);
      }

      // Dry asphalt
      for (const mat of this.roadsMeshList) {
        mat.roughness = 0.85;
        mat.metalness = 0.05;
      }

      if (this.atmosphere && typeof this.atmosphere.setDustIntensity === 'function') {
        this.atmosphere.setDustIntensity(0.45);
      }

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
        // Procedural white noise rain
        const bufferSize = this.audioCtx.sampleRate * 2;
        const noiseBuffer = this.audioCtx.createBuffer(1, bufferSize, this.audioCtx.sampleRate);
        const output = noiseBuffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
          output[i] = Math.random() * 2 - 1;
        }

        const whiteNoise = this.audioCtx.createBufferSource();
        whiteNoise.buffer = noiseBuffer;
        whiteNoise.loop = true;

        // Bandpass filter for rain frequency
        const filter = this.audioCtx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(800, this.audioCtx.currentTime);

        this.rainGainNode = this.audioCtx.createGain();
        this.rainGainNode.gain.setValueAtTime(0.04, this.audioCtx.currentTime);

        whiteNoise.connect(filter);
        filter.connect(this.rainGainNode);
        this.rainGainNode.connect(this.audioCtx.destination);
        whiteNoise.start();
      } else {
        this.rainGainNode.gain.setTargetAtTime(0.04, this.audioCtx.currentTime, 0.5);
      }
    } catch {
      // Audio autoplay restrictions or unsupported
    }
  }

  private stopRainAudio(): void {
    if (this.rainGainNode && this.audioCtx) {
      this.rainGainNode.gain.setTargetAtTime(0, this.audioCtx.currentTime, 0.5);
    }
  }

  private triggerThunder(): void {
    if (this.currentWeather !== 'rainy') return;
    this.isFlashing = true;
    this.lightningLight.intensity = 4.5 + Math.random() * 3.0;

    setTimeout(() => {
      this.lightningLight.intensity = 0;
      setTimeout(() => {
        this.lightningLight.intensity = 3.0;
        setTimeout(() => {
          this.lightningLight.intensity = 0;
          this.isFlashing = false;
        }, 80);
      }, 60);
    }, 120);
  }

  public update(delta: number, playerPos?: THREE.Vector3): void {
    if (this.currentWeather === 'rainy') {
      const positions = this.rainGeometry.attributes.position.array as Float32Array;

      const center = playerPos || new THREE.Vector3(0, 0, 0);

      for (let i = 0; i < this.rainCount; i++) {
        // Fall down
        positions[i * 3 + 1] -= this.rainVelocity[i] * delta;

        // Wrap around player if hitting ground
        if (positions[i * 3 + 1] < 0.2) {
          positions[i * 3 + 1] = 48 + Math.random() * 10;
          positions[i * 3] = center.x + (Math.random() - 0.5) * 160;
          positions[i * 3 + 2] = center.z + (Math.random() - 0.5) * 160;
        }
      }

      this.rainGeometry.attributes.position.needsUpdate = true;

      // Random thunder flash
      this.lightningTimer += delta;
      if (this.lightningTimer > 12) {
        if (Math.random() < 0.35 && !this.isFlashing) {
          this.triggerThunder();
          this.lightningTimer = 0;
        }
      }
    }
  }
}
