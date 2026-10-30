import * as THREE from 'three';
import { MaterialLibrary } from '../materials/MaterialLibrary';
import { SkyDome } from './SkyDome';

/** Lagos local time, from the time zone itself rather than a fixed offset */
const LAGOS_PARTS = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Africa/Lagos',
  hourCycle: 'h23',
  year: 'numeric',
  month: 'numeric',
  day: 'numeric',
  hour: 'numeric',
  minute: 'numeric',
  second: 'numeric',
});
const LAGOS_LABEL = new Intl.DateTimeFormat('en-GB', { timeZone: 'Africa/Lagos', weekday: 'short', day: 'numeric' });

/** Minutes Lagos is ahead of UTC at a moment, read from the time zone database. */
export function lagosOffsetMinutes(at: Date): number {
  const parts = LAGOS_PARTS.formatToParts(at);
  const part = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0);
  const asUtc = Date.UTC(part('year'), part('month') - 1, part('day'), part('hour'), part('minute'), part('second'));
  return Math.round((asUtc - Math.floor(at.getTime() / 1000) * 1000) / 60000);
}

export type TimePeriod = 'morning' | 'midday' | 'golden_hour' | 'night';
export type ClockMode = 'SIMULATED_TIME' | 'REAL_TIME';

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

// 24-Hour continuous lighting keyframe profile
interface LightingKeyframe {
  hour: number;
  sunColor: number;
  sunIntensity: number;
  hemiSky: number;
  hemiGround: number;
  hemiIntensity: number;
  fogColor: number;
  fogDensity: number;
  exposure: number;
}

const LIGHTING_TIMELINE: LightingKeyframe[] = [
  // Night in Lagos is never black: moonlight, generators and street lamps keep it readable
  { hour: 0.0,  sunColor: 0x6a80b8, sunIntensity: 0.75, hemiSky: 0x4a5d8c, hemiGround: 0x262c3a, hemiIntensity: 0.85, fogColor: 0x1b2436, fogDensity: 0.0055, exposure: 1.0 },
  { hour: 5.5,  sunColor: 0x7088bb, sunIntensity: 0.80, hemiSky: 0x52618e, hemiGround: 0x2a2e3c, hemiIntensity: 0.90, fogColor: 0x232a3e, fogDensity: 0.0055, exposure: 1.0 },
  { hour: 6.2,  sunColor: 0xffaa66, sunIntensity: 1.20, hemiSky: 0xffb888, hemiGround: 0x554433, hemiIntensity: 0.48, fogColor: 0x996655, fogDensity: 0.0062, exposure: 0.96 },
  { hour: 7.5,  sunColor: 0xfff2d4, sunIntensity: 2.30, hemiSky: 0xcde4ff, hemiGround: 0x8a7a62, hemiIntensity: 0.65, fogColor: 0xe2d6c2, fogDensity: 0.0050, exposure: 1.05 },
  { hour: 12.5, sunColor: 0xfff0d0, sunIntensity: 2.60, hemiSky: 0xbfdcff, hemiGround: 0x8a7a62, hemiIntensity: 0.75, fogColor: 0xd9cdb4, fogDensity: 0.0055, exposure: 1.05 },
  { hour: 16.5, sunColor: 0xffe0b0, sunIntensity: 2.50, hemiSky: 0xc4dcff, hemiGround: 0x8a7a62, hemiIntensity: 0.70, fogColor: 0xdec8ab, fogDensity: 0.0056, exposure: 1.05 },
  { hour: 18.0, sunColor: 0xffa65c, sunIntensity: 2.30, hemiSky: 0xffbf8a, hemiGround: 0x775544, hemiIntensity: 0.55, fogColor: 0xe0b184, fogDensity: 0.0060, exposure: 1.02 },
  { hour: 19.3, sunColor: 0xdd7755, sunIntensity: 1.10, hemiSky: 0x8a6a9e, hemiGround: 0x3c2c3c, hemiIntensity: 0.62, fogColor: 0x4a3248, fogDensity: 0.0060, exposure: 0.98 },
  { hour: 20.5, sunColor: 0x6f86bf, sunIntensity: 0.80, hemiSky: 0x4d5f8e, hemiGround: 0x282e3c, hemiIntensity: 0.88, fogColor: 0x1d2638, fogDensity: 0.0056, exposure: 1.0 },
  { hour: 24.0, sunColor: 0x6a80b8, sunIntensity: 0.75, hemiSky: 0x4a5d8c, hemiGround: 0x262c3a, hemiIntensity: 0.85, fogColor: 0x1b2436, fogDensity: 0.0055, exposure: 1.0 },
];

export class SkyEnvironmentManager {
  private scene: THREE.Scene;
  private renderer: THREE.WebGLRenderer;
  private pmrem: THREE.PMREMGenerator;

  public sunLight: THREE.DirectionalLight;
  public hemiLight: THREE.HemisphereLight;

  // Authoritative World Clock
  public clockMode: ClockMode = 'REAL_TIME';
  public currentHour: number = 8.0; // 24-hour float (e.g. 8.0 = 8:00 AM)
  public day: number = 0; // Whole days elapsed since start date (Wed 7 Oct 2026)
  public timeScale: number = 0.04; // Simulated seconds to in-game time advancement rate
  public onNewDay?: (day: number) => void;
  public onPeriodChange?: (period: TimePeriod) => void;

  public currentPeriod: TimePeriod = 'morning';
  private lastClockLabel: string = '';
  private lastClockKey: string = '';
  /** The sky itself, coloured from the clock every frame */
  public readonly dome = new SkyDome();
  /** What shows behind anything the dome does not cover: the horizon colour */
  private skyColour = new THREE.Color();
  /** Reflections for glossy paint and glass, one per part of the day, each made once */
  private envByPeriod = new Map<TimePeriod, THREE.Texture | null>();
  /** Lagos's offset from UTC, re-read from the time zone once a minute */
  private lagosOffset = { minutes: 60, readAt: -Infinity };
  private lightDir = new THREE.Vector3();
  private origin = new THREE.Vector3();

  // Weather influence multipliers
  public weatherSunMultiplier: number = 1.0;
  public weatherHemiMultiplier: number = 1.0;
  public weatherFogDensityMultiplier: number = 1.0;
  public weatherFogColorMultiplier: THREE.Color = new THREE.Color(1, 1, 1);

  // Temporary color buffers for smooth per-frame lerping without GC pressure
  private tempColorA = new THREE.Color();
  private tempColorB = new THREE.Color();
  private tempColorResult = new THREE.Color();

  constructor(scene: THREE.Scene, renderer: THREE.WebGLRenderer) {
    this.scene = scene;
    this.renderer = renderer;
    this.pmrem = new THREE.PMREMGenerator(this.renderer);

    // 1. Hemisphere Ambient Light
    this.hemiLight = new THREE.HemisphereLight(0xbfdcff, 0x8a7a62, 0.75);
    this.scene.add(this.hemiLight);

    // 2. Directional Sun Light with PCF Soft Shadows
    this.sunLight = new THREE.DirectionalLight(0xfff0d0, 2.6);
    this.sunLight.castShadow = true;
    this.sunLight.shadow.mapSize.set(1536, 1536);

    const sc = this.sunLight.shadow.camera;
    sc.left = sc.bottom = -35;
    sc.right = sc.top = 35;
    sc.near = 1;
    sc.far = 150;
    this.sunLight.shadow.bias = -0.0004;
    this.sunLight.shadow.normalBias = 0.04;

    this.scene.add(this.sunLight);
    this.scene.add(this.sunLight.target);
    this.scene.add(this.dome.mesh);
    this.scene.background = this.skyColour;

    // 3. Initial Mode Apply
    if (this.clockMode === 'REAL_TIME') {
      this.syncRealTime();
    } else {
      this.applyMode(this.currentPeriod);
    }
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
    let seed = 11;
    const rand = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    for (let i = 0; i < 40; i++) {
      g.beginPath();
      const ex = rand() * w;
      const ey = h * (0.12 + rand() * 0.3);
      const rx = 30 + rand() * 70;
      const ry = 6 + rand() * 10;
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

    // Reflections for this part of the day: made the first time it comes round, then kept
    if (!this.envByPeriod.has(period)) {
      const sky = this.makeSkyTexture(m.top, m.mid, m.hor, m.glow);
      let env: THREE.Texture | null = null;
      try {
        env = this.pmrem.fromEquirectangular(sky).texture;
      } catch {
        env = null;
      }
      sky.dispose();
      this.envByPeriod.set(period, env);
    }
    this.scene.environment = this.envByPeriod.get(period) ?? null;
    this.scene.background = this.skyColour;

    // Atmospheric fog (one fog, recoloured: the continuous lighting below keeps it moving)
    const baseFogDensity = m.fogDensity * this.weatherFogDensityMultiplier;
    if (this.scene.fog instanceof THREE.FogExp2) {
      this.scene.fog.color.setHex(m.fog);
      this.scene.fog.density = baseFogDensity;
    } else {
      this.scene.fog = new THREE.FogExp2(m.fog, baseFogDensity);
    }

    // Sun & Hemi light baseline
    this.sunLight.color.setHex(m.sun);
    this.sunLight.intensity = m.si * this.weatherSunMultiplier;

    this.hemiLight.color.setHex(m.hemiSky);
    this.hemiLight.groundColor.setHex(m.hemiGround);
    this.hemiLight.intensity = m.hi * this.weatherHemiMultiplier;

    this.renderer.toneMappingExposure = period === 'night' ? 0.92 : 1.05;
    this.updateClockHUD();

    try {
      MaterialLibrary.getInstance().setNightLighting(period);
    } catch {}

    if (this.onPeriodChange) {
      this.onPeriodChange(period);
    }
  }

  public getTimePeriodForHour(hour: number): TimePeriod {
    const h = ((hour % 24) + 24) % 24;
    if (h >= 5.8 && h < 11.5) return 'morning';
    if (h >= 11.5 && h < 16.5) return 'midday';
    if (h >= 16.5 && h < 19.3) return 'golden_hour';
    return 'night';
  }

  public setHour(hour: number): void {
    this.clockMode = 'SIMULATED_TIME';
    this.currentHour = ((hour % 24) + 24) % 24;
    const period = this.getTimePeriodForHour(this.currentHour);
    if (period !== this.currentPeriod) {
      this.applyMode(period);
    }
    this.updateClockHUD();
  }

  public setClockMode(mode: ClockMode): void {
    this.clockMode = mode;
    if (mode === 'REAL_TIME') {
      this.syncRealTime();
    } else {
      this.updateClockHUD();
    }
  }

  /** The hour now in Lagos (0-24, with fractions), from the Africa/Lagos time zone. */
  public lagosHourNow(now: Date = new Date()): number {
    const ms = now.getTime();
    if (ms - this.lagosOffset.readAt > 60000 || ms < this.lagosOffset.readAt) {
      this.lagosOffset = { minutes: lagosOffsetMinutes(now), readAt: ms };
    }
    const minutesOfDay = (((ms / 60000 + this.lagosOffset.minutes) % 1440) + 1440) % 1440;
    return minutesOfDay / 60;
  }

  /** Sets the clock to the time now in Lagos */
  public syncRealTime(): void {
    this.currentHour = this.lagosHourNow();

    const period = this.getTimePeriodForHour(this.currentHour);
    if (period !== this.currentPeriod) {
      this.applyMode(period);
    }
    this.updateClockHUD();
  }

  /** Cycles clock between Real-Time Lagos (WAT) and simulated time-of-day presets */
  public cycleWorldClock(): { mode: ClockMode; label: string } {
    if (this.clockMode === 'REAL_TIME') {
      this.clockMode = 'SIMULATED_TIME';
      this.currentHour = 8.0;
      this.applyMode('morning');
      this.updateClockHUD();
      return { mode: 'SIMULATED_TIME', label: 'Simulated Morning (8:00 AM)' };
    }

    if (this.currentPeriod === 'morning') {
      this.currentHour = 13.3;
      this.applyMode('midday');
      this.updateClockHUD();
      return { mode: 'SIMULATED_TIME', label: 'Simulated Midday (1:18 PM)' };
    } else if (this.currentPeriod === 'midday') {
      this.currentHour = 18.0;
      this.applyMode('golden_hour');
      this.updateClockHUD();
      return { mode: 'SIMULATED_TIME', label: 'Simulated Golden Hour (6:00 PM)' };
    } else if (this.currentPeriod === 'golden_hour') {
      this.currentHour = 21.5;
      this.applyMode('night');
      this.updateClockHUD();
      return { mode: 'SIMULATED_TIME', label: 'Simulated Night (9:30 PM)' };
    } else {
      this.clockMode = 'REAL_TIME';
      this.syncRealTime();
      const timeStr = this.getFormattedTimeString();
      return { mode: 'REAL_TIME', label: `Real-Time Lagos (WAT) • ${timeStr}` };
    }
  }

  public toggleTimeOfDay(): TimePeriod {
    this.cycleWorldClock();
    return this.currentPeriod;
  }

  public cycleTimeOfDay(): TimePeriod {
    return this.toggleTimeOfDay();
  }

  public getFormattedTimeString(): string {
    const totalMinutes = Math.floor(this.currentHour * 60);
    const hours24 = Math.floor(totalMinutes / 60) % 24;
    const minutes = totalMinutes % 60;
    const ampm = hours24 >= 12 ? 'PM' : 'AM';
    let hours12 = hours24 % 12;
    if (hours12 === 0) hours12 = 12;

    const minStr = minutes.toString().padStart(2, '0');
    return `${this.getDateLabel()} • ${hours12}:${minStr} ${ampm}`;
  }

  /** The calendar date for current clock mode. Real-Time uses live Lagos date; Simulated uses 2026-10-07 + day. */
  public getDateLabel(): string {
    if (this.clockMode === 'REAL_TIME') {
      const parts = LAGOS_LABEL.formatToParts(new Date());
      const weekday = parts.find((p) => p.type === 'weekday')?.value ?? '';
      const day = parts.find((p) => p.type === 'day')?.value ?? '';
      return `${weekday} ${day}`;
    }
    const date = new Date(2026, 9, 7 + this.day);
    return `${date.toLocaleDateString('en-GB', { weekday: 'short' })} ${date.getDate()}`;
  }

  public setDay(day: number): void {
    this.clockMode = 'SIMULATED_TIME';
    this.day = Math.max(0, Math.floor(day));
    this.updateClockHUD();
  }

  public updateClockHUD(): void {
    // Called every frame: the page is only touched when the minute, the mode or the part of the day changes
    const key = `${this.clockMode}|${this.currentPeriod}|${this.day}|${Math.floor(this.currentHour * 60)}`;
    if (key === this.lastClockKey) return;
    // Not remembered until the HUD is on the page, so the first label is not lost
    if (document.getElementById('hud-clock-val')) this.lastClockKey = key;

    const label = this.getFormattedTimeString();
    if (label !== this.lastClockLabel) {
      this.lastClockLabel = label;
      const clockEl = document.getElementById('hud-clock-val');
      if (clockEl) clockEl.textContent = label;
      const mapClockEl = document.getElementById('map-ui-time');
      if (mapClockEl) mapClockEl.textContent = label;
    }

    const pillEl = document.getElementById('hud-time-pill');
    if (pillEl) {
      pillEl.setAttribute(
        'title',
        this.clockMode === 'REAL_TIME'
          ? 'World Clock: Real-Time Lagos (WAT) • Click to cycle time presets'
          : `World Clock: Simulated ${this.currentPeriod} • Click to cycle time / switch to Real-Time (WAT)`
      );
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

  /** Interpolates lighting parameters smoothly between keyframes across the 24-hour cycle */
  private applyContinuousLighting(targetPos: THREE.Vector3): void {
    const h = ((this.currentHour % 24) + 24) % 24;

    // Find bounding keyframes
    let k0 = LIGHTING_TIMELINE[0];
    let k1 = LIGHTING_TIMELINE[1];
    for (let i = 0; i < LIGHTING_TIMELINE.length - 1; i++) {
      if (h >= LIGHTING_TIMELINE[i].hour && h <= LIGHTING_TIMELINE[i + 1].hour) {
        k0 = LIGHTING_TIMELINE[i];
        k1 = LIGHTING_TIMELINE[i + 1];
        break;
      }
    }

    const span = k1.hour - k0.hour;
    const t = span > 0 ? (h - k0.hour) / span : 0;

    // 1. Sun Direction (Lagos Celestial Solar Arc)
    // Lagos latitude is ~6.5° N (tropical near-equator). Sun rises roughly East (+X), peaks overhead at midday, sets West (-X).
    const isDay = h >= 5.8 && h <= 18.8;
    if (isDay) {
      const solarPhase = ((h - 6.0) / 12.0) * Math.PI;
      const sunX = Math.cos(solarPhase) * 60;
      const sunY = Math.max(6.0, Math.sin(solarPhase) * 75);
      const sunZ = Math.cos(((h - 12.0) / 12.0) * Math.PI) * 25;
      this.sunLight.position.set(targetPos.x + sunX, sunY, targetPos.z + sunZ);
    } else {
      // Moon position at night
      const nightPhase = ((((h + 6.0) % 24) - 6.0) / 12.0) * Math.PI;
      const moonX = -Math.cos(nightPhase) * 45;
      const moonY = Math.max(10.0, Math.sin(nightPhase) * 55);
      const moonZ = -20;
      this.sunLight.position.set(targetPos.x + moonX, moonY, targetPos.z + moonZ);
    }
    this.sunLight.target.position.copy(targetPos);
    this.sunLight.target.updateMatrixWorld();

    // 2. Directional Sun/Moon Light Color & Intensity
    this.tempColorA.setHex(k0.sunColor);
    this.tempColorB.setHex(k1.sunColor);
    this.tempColorResult.copy(this.tempColorA).lerp(this.tempColorB, t);
    this.sunLight.color.copy(this.tempColorResult);
    const baseSunInt = THREE.MathUtils.lerp(k0.sunIntensity, k1.sunIntensity, t);
    this.sunLight.intensity = baseSunInt * this.weatherSunMultiplier;

    // 3. Hemisphere Ambient Light
    this.tempColorA.setHex(k0.hemiSky);
    this.tempColorB.setHex(k1.hemiSky);
    this.hemiLight.color.copy(this.tempColorA).lerp(this.tempColorB, t);

    this.tempColorA.setHex(k0.hemiGround);
    this.tempColorB.setHex(k1.hemiGround);
    this.hemiLight.groundColor.copy(this.tempColorA).lerp(this.tempColorB, t);

    const baseHemiInt = THREE.MathUtils.lerp(k0.hemiIntensity, k1.hemiIntensity, t);
    this.hemiLight.intensity = baseHemiInt * this.weatherHemiMultiplier;

    // 4. Atmospheric Fog
    if (this.scene.fog && this.scene.fog instanceof THREE.FogExp2) {
      this.tempColorA.setHex(k0.fogColor);
      this.tempColorB.setHex(k1.fogColor);
      this.tempColorResult.copy(this.tempColorA).lerp(this.tempColorB, t);
      // Modulate with weather fog tint
      this.tempColorResult.multiply(this.weatherFogColorMultiplier);
      this.scene.fog.color.copy(this.tempColorResult);

      const baseDensity = THREE.MathUtils.lerp(k0.fogDensity, k1.fogDensity, t);
      this.scene.fog.density = baseDensity * this.weatherFogDensityMultiplier;
    }

    // 5. Tone Mapping Exposure
    const baseExposure = THREE.MathUtils.lerp(k0.exposure, k1.exposure, t);
    this.renderer.toneMappingExposure = baseExposure;

    // 6. Indoors the lights are on: whatever the hour, a room is lit bright and clear, so it can be
    // seen by anyone, including players whose eyes are not strong
    if (this.indoors) {
      this.hemiLight.color.setHex(0xfffaf0);
      this.hemiLight.groundColor.setHex(0xd6d3d1);
      this.hemiLight.intensity = Math.max(this.hemiLight.intensity, 1.55);
      this.sunLight.intensity = Math.max(this.sunLight.intensity, 0.9);
      this.sunLight.color.setHex(0xfff4e0);
      if (this.scene.fog instanceof THREE.FogExp2) this.scene.fog.density *= 0.12;
      this.renderer.toneMappingExposure = Math.max(baseExposure, 1.08);
    }
  }

  /** The player is inside a building: lit as rooms are, not as the street is at that hour */
  public indoors = false;

  public update(delta: number, playerPosition?: THREE.Vector3): void {
    // Delta clamping prevents burst jumps when tab is backgrounded
    const safeDelta = Math.min(delta, 0.25);

    if (this.clockMode === 'REAL_TIME') {
      // Lagos time from the Africa/Lagos time zone
      const lagosHour = this.lagosHourNow();
      if (lagosHour < this.currentHour - 12) {
        this.day += 1;
        this.onNewDay?.(this.day);
      }
      this.currentHour = lagosHour;
    } else {
      // SIMULATED_TIME: advance according to timeScale
      this.currentHour += safeDelta * this.timeScale;
      if (this.currentHour >= 24) {
        this.currentHour -= 24;
        this.day += 1;
        this.onNewDay?.(this.day);
      }
    }

    // Check if period category changed (for skybox texture and building night lights)
    const period = this.getTimePeriodForHour(this.currentHour);
    if (period !== this.currentPeriod) {
      this.applyMode(period);
    }

    this.updateClockHUD();

    // Continuous lighting and celestial sun position tracking
    const targetPos = playerPosition || this.origin.set(0, 0, 0);
    this.applyContinuousLighting(targetPos);

    // The sky, from the same hour and the same sun, greyed by cloud cover
    this.lightDir.subVectors(this.sunLight.position, this.sunLight.target.position);
    this.dome.update(this.currentHour, this.lightDir, 1 - this.weatherSunMultiplier, performance.now() / 1000);
    this.skyColour.copy(this.dome.horizonColour);
    if (this.scene.background !== this.skyColour) this.scene.background = this.skyColour;
  }
}
