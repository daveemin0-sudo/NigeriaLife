import * as THREE from 'three';

export type TimePeriod = 'morning' | 'midday' | 'golden_hour' | 'night';

export interface SkyModeConfig {
  period: TimePeriod;
  top: string;
  mid: string;
  hor: string;
  glow: string;
  fog: number;
  fogDensity: number;
  sun: number;
  si: number;
  dir: [number, number, number];
  hemiSky: number;
  hemiGround: number;
  hi: number;
  label: string;
}

const MODES: Record<TimePeriod, SkyModeConfig> = {
  midday: {
    period: 'midday',
    top: '#3f7fc4',
    mid: '#8fc0e8',
    hor: '#e9dcc2',
    glow: '#fff7d8',
    fog: 0xd9cdb4,
    fogDensity: 0.0055,
    sun: 0xfff0d0,
    si: 2.6,
    dir: [40, 70, 25],
    hemiSky: 0xbfdcff,
    hemiGround: 0x8a7a62,
    hi: 0.75,
    label: '☀️ Midday',
  },
  golden_hour: {
    period: 'golden_hour',
    top: '#2b4a7c',
    mid: '#e7a06a',
    hor: '#ffcf8a',
    glow: '#ffd9a0',
    fog: 0xe0b184,
    fogDensity: 0.006,
    sun: 0xffa65c,
    si: 2.4,
    dir: [-60, 24, 30],
    hemiSky: 0xbfdcff,
    hemiGround: 0x8a7a62,
    hi: 0.55,
    label: '🌆 Golden Hour',
  },
  morning: {
    period: 'morning',
    top: '#3b6ea5',
    mid: '#9bc5e8',
    hor: '#f5e4c8',
    glow: '#fff3cf',
    fog: 0xe2d6c2,
    fogDensity: 0.005,
    sun: 0xfff2d4,
    si: 2.3,
    dir: [55, 45, -30],
    hemiSky: 0xcde4ff,
    hemiGround: 0x8a7a62,
    hi: 0.65,
    label: '🌤️ Morning',
  },
  night: {
    period: 'night',
    top: '#0a1128',
    mid: '#131e3a',
    hor: '#1c2b4a',
    glow: '#3b5284',
    fog: 0x101726,
    fogDensity: 0.007,
    sun: 0x446699,
    si: 0.45,
    dir: [-40, 50, -20],
    hemiSky: 0x1e2a44,
    hemiGround: 0x0f1722,
    hi: 0.3,
    label: '🌙 Night',
  },
};

export class SkyEnvironmentManager {
  private scene: THREE.Scene;
  private renderer: THREE.WebGLRenderer;
  private pmrem: THREE.PMREMGenerator;

  public sunLight: THREE.DirectionalLight;
  public hemiLight: THREE.HemisphereLight;

  // In-game time tracking (24-hour float: 13.3 = ~1:18 PM)
  public currentHour: number = 13.3;
  private timeScale: number = 0.04;
  public currentPeriod: TimePeriod = 'midday';
  private currentSkyTexture: THREE.CanvasTexture | null = null;
  private currentEnvTexture: THREE.Texture | null = null;

  constructor(scene: THREE.Scene, renderer: THREE.WebGLRenderer) {
    this.scene = scene;
    this.renderer = renderer;
    this.pmrem = new THREE.PMREMGenerator(this.renderer);

    // 1. Hemisphere Light
    this.hemiLight = new THREE.HemisphereLight(0xbfdcff, 0x8a7a62, 0.75);
    this.scene.add(this.hemiLight);

    // 2. Directional Sun Light with PCF Soft Shadows
    this.sunLight = new THREE.DirectionalLight(0xfff0d0, 2.6);
    this.sunLight.castShadow = true;
    this.sunLight.shadow.mapSize.set(2048, 2048);

    const sc = this.sunLight.shadow.camera;
    sc.left = sc.bottom = -45;
    sc.right = sc.top = 45;
    sc.near = 1;
    sc.far = 160;
    this.sunLight.shadow.bias = -0.0004;
    this.sunLight.shadow.normalBias = 0.04;

    this.scene.add(this.sunLight);
    this.scene.add(this.sunLight.target);

    // 3. Initial Mode Apply
    this.applyMode(this.currentPeriod);
  }

  private makeSkyTexture(top: string, mid: string, hor: string, glow: string): THREE.CanvasTexture {
    const w = 1024;
    const h = 512;
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    const g = c.getContext('2d')!;

    // Horizon & sky gradient
    const gr = g.createLinearGradient(0, 0, 0, h);
    gr.addColorStop(0, top);
    gr.addColorStop(0.42, mid);
    gr.addColorStop(0.5, hor);
    gr.addColorStop(0.62, '#b9a98f');
    gr.addColorStop(1, '#6d6556');
    g.fillStyle = gr;
    g.fillRect(0, 0, w, h);

    // Radial sun glow
    const rg = g.createRadialGradient(w * 0.25, h * 0.3, 5, w * 0.25, h * 0.3, 170);
    rg.addColorStop(0, glow);
    rg.addColorStop(1, '#00000000');
    g.fillStyle = rg;
    g.fillRect(0, 0, w, h);

    // Soft tropical African clouds
    g.fillStyle = '#ffffff55';
    for (let i = 0; i < 40; i++) {
      g.beginPath();
      const ex = (Math.random() * w);
      const ey = h * (0.12 + Math.random() * 0.3);
      const rx = 30 + Math.random() * 70;
      const ry = 6 + Math.random() * 10;
      g.ellipse(ex, ey, rx, ry, 0, 0, Math.PI * 2);
      g.fill();
    }

    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.mapping = THREE.EquirectangularReflectionMapping;
    return t;
  }

  public applyMode(period: TimePeriod): void {
    this.currentPeriod = period;
    const m = MODES[period];

    // Dispose old textures
    if (this.currentSkyTexture) {
      this.currentSkyTexture.dispose();
    }
    if (this.currentEnvTexture) {
      this.currentEnvTexture.dispose();
    }

    // Generate new equirectangular sky
    this.currentSkyTexture = this.makeSkyTexture(m.top, m.mid, m.hor, m.glow);
    this.scene.background = this.currentSkyTexture;

    // PMREM environment map for glossy metals, glass, and cars
    try {
      const envTarget = this.pmrem.fromEquirectangular(this.currentSkyTexture);
      this.currentEnvTexture = envTarget.texture;
      this.scene.environment = this.currentEnvTexture;
    } catch {
      this.scene.environment = null;
    }

    // Atmospheric Fog
    this.scene.fog = new THREE.FogExp2(m.fog, m.fogDensity);

    // Sun & Hemi light
    this.sunLight.color.setHex(m.sun);
    this.sunLight.intensity = m.si;

    this.hemiLight.color.setHex(m.hemiSky);
    this.hemiLight.groundColor.setHex(m.hemiGround);
    this.hemiLight.intensity = m.hi;

    this.renderer.toneMappingExposure = period === 'night' ? 0.92 : 1.05;
    this.updateClockHUD();
  }

  public getTimePeriodForHour(hour: number): TimePeriod {
    const h = (hour % 24 + 24) % 24;
    if (h >= 6 && h < 11) return 'morning';
    if (h >= 11 && h < 17) return 'midday';
    if (h >= 17 && h < 20) return 'golden_hour';
    return 'night';
  }

  public setHour(hour: number): void {
    this.currentHour = ((hour % 24) + 24) % 24;
    const period = this.getTimePeriodForHour(this.currentHour);
    if (period !== this.currentPeriod) {
      this.applyMode(period);
    }
    this.updateClockHUD();
  }

  public toggleTimeOfDay(): TimePeriod {
    const cycle: TimePeriod[] = ['midday', 'golden_hour', 'night', 'morning'];
    const idx = cycle.indexOf(this.currentPeriod);
    const nextPeriod = cycle[(idx + 1) % cycle.length];

    const targetHour =
      nextPeriod === 'morning' ? 8 :
      nextPeriod === 'midday' ? 13.3 :
      nextPeriod === 'golden_hour' ? 18.2 :
      21.5;

    this.currentHour = targetHour;
    this.applyMode(nextPeriod);
    return nextPeriod;
  }

  public cycleTimeOfDay(): TimePeriod {
    return this.toggleTimeOfDay();
  }

  public getFormattedTimeString(): string {
    const totalMinutes = Math.floor(this.currentHour * 60);
    let hours24 = Math.floor(totalMinutes / 60) % 24;
    const minutes = totalMinutes % 60;
    const ampm = hours24 >= 12 ? 'PM' : 'AM';
    let hours12 = hours24 % 12;
    if (hours12 === 0) hours12 = 12;

    const minStr = minutes.toString().padStart(2, '0');
    return `Wed 7 • ${hours12}:${minStr} ${ampm}`;
  }

  public updateClockHUD(): void {
    const clockEl = document.getElementById('hud-clock-val');
    if (clockEl) {
      clockEl.textContent = this.getFormattedTimeString();
    }

    const weatherIconEl = document.getElementById('hud-weather-icon');
    if (weatherIconEl) {
      weatherIconEl.textContent =
        this.currentPeriod === 'night' ? '🌙' :
        this.currentPeriod === 'golden_hour' ? '🌅' :
        this.currentPeriod === 'morning' ? '🌤️' :
        '☀️';
    }
  }

  public update(delta: number, playerPosition?: THREE.Vector3): void {
    this.currentHour += delta * this.timeScale;
    if (this.currentHour >= 24) this.currentHour -= 24;

    const period = this.getTimePeriodForHour(this.currentHour);
    if (period !== this.currentPeriod) {
      this.applyMode(period);
    }

    this.updateClockHUD();

    const targetPos = playerPosition || new THREE.Vector3(0, 0, 0);
    const m = MODES[this.currentPeriod];

    this.sunLight.position.set(
      targetPos.x + m.dir[0],
      m.dir[1],
      targetPos.z + m.dir[2]
    );
    this.sunLight.target.position.copy(targetPos);
    this.sunLight.target.updateMatrixWorld();
  }
}
