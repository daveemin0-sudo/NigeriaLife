import * as THREE from 'three';
import { Sky } from 'three/addons/objects/Sky.js';

export type TimePeriod = 'morning' | 'midday' | 'golden_hour' | 'night';

export interface LightingPreset {
  period: TimePeriod;
  sunElevation: number;   // degrees
  sunAzimuth: number;     // degrees
  sunColor: number;
  sunIntensity: number;
  hemiSkyColor: number;
  hemiGroundColor: number;
  hemiIntensity: number;
  fogColor: number;
  fogDensity: number;
  turbidity: number;
  rayleigh: number;
  mieCoefficient: number;
  mieDirectionalG: number;
  exposure: number;
}

const PRESETS: Record<TimePeriod, LightingPreset> = {
  midday: {
    period: 'midday',
    sunElevation: 58,
    sunAzimuth: 145,
    sunColor: 0xfff6e6,
    sunIntensity: 2.2,
    hemiSkyColor: 0xfff1de,
    hemiGroundColor: 0x4a4036,
    hemiIntensity: 0.55,
    fogColor: 0xd2c2a8,      // Warm dusty harmattan horizon
    fogDensity: 0.0075,
    turbidity: 9.0,          // Hazy tropical Lagos atmosphere
    rayleigh: 2.2,
    mieCoefficient: 0.005,
    mieDirectionalG: 0.82,
    exposure: 1.0,
  },
  golden_hour: {
    period: 'golden_hour',
    sunElevation: 12,
    sunAzimuth: 220,
    sunColor: 0xff8c3b,      // Rich amber-orange African sunset
    sunIntensity: 2.6,
    hemiSkyColor: 0xff9955,
    hemiGroundColor: 0x361e12,
    hemiIntensity: 0.45,
    fogColor: 0xd47545,      // Fiery golden hour haze
    fogDensity: 0.009,
    turbidity: 14.0,
    rayleigh: 4.2,
    mieCoefficient: 0.012,
    mieDirectionalG: 0.88,
    exposure: 1.05,
  },
  night: {
    period: 'night',
    sunElevation: -14,
    sunAzimuth: 260,
    sunColor: 0x48658a,      // Subtle cool Atlantic moonlight
    sunIntensity: 0.35,
    hemiSkyColor: 0x1e2a3d,
    hemiGroundColor: 0x0a0f18,
    hemiIntensity: 0.22,
    fogColor: 0x0d1522,      // Deep Lagos midnight
    fogDensity: 0.010,
    turbidity: 2.5,
    rayleigh: 0.6,
    mieCoefficient: 0.002,
    mieDirectionalG: 0.7,
    exposure: 0.9,
  },
  morning: {
    period: 'morning',
    sunElevation: 25,
    sunAzimuth: 85,
    sunColor: 0xffeed4,      // Soft warm dawn light
    sunIntensity: 1.9,
    hemiSkyColor: 0xffe6cb,
    hemiGroundColor: 0x3d352c,
    hemiIntensity: 0.5,
    fogColor: 0xd8caa8,      // Morning tropical dew haze
    fogDensity: 0.008,
    turbidity: 8.0,
    rayleigh: 1.8,
    mieCoefficient: 0.004,
    mieDirectionalG: 0.8,
    exposure: 0.98,
  },
};

export class SkyEnvironmentManager {
  private scene: THREE.Scene;
  private renderer: THREE.WebGLRenderer;

  public sky: Sky;
  public sunLight: THREE.DirectionalLight;
  public hemiLight: THREE.HemisphereLight;
  private pmremGenerator: THREE.PMREMGenerator;
  private currentEnvTexture: THREE.WebGLRenderTarget | null = null;

  // In-game time tracking (24-hour float: 13.3 = ~1:18 PM)
  public currentHour: number = 13.3;
  private timeScale: number = 0.04; // ~25 real minutes per 24h game cycle
  private currentPeriod: TimePeriod = 'midday';

  // Base sun offset vector relative to the player
  private sunRelativeOffset = new THREE.Vector3(35, 60, 30);
  private sunPositionVector = new THREE.Vector3();

  constructor(scene: THREE.Scene, renderer: THREE.WebGLRenderer) {
    this.scene = scene;
    this.renderer = renderer;

    // 1. Procedural Sky Shader
    this.sky = new Sky();
    this.sky.scale.setScalar(450000);
    this.scene.add(this.sky);

    // 2. Hemisphere Skylight / Ground Bounce
    this.hemiLight = new THREE.HemisphereLight(0xfff1de, 0x4a4036, 0.55);
    this.scene.add(this.hemiLight);

    // 3. Directional Sun Light with Tuned Shadow Camera
    this.sunLight = new THREE.DirectionalLight(0xfff6e6, 2.2);
    this.sunLight.castShadow = true;

    // High fidelity shadow map
    this.sunLight.shadow.mapSize.width = 2048;
    this.sunLight.shadow.mapSize.height = 2048;

    // Tuned ~60m player-centric frustum
    const shadowD = 32;
    this.sunLight.shadow.camera.left = -shadowD;
    this.sunLight.shadow.camera.right = shadowD;
    this.sunLight.shadow.camera.top = shadowD;
    this.sunLight.shadow.camera.bottom = -shadowD;
    this.sunLight.shadow.camera.near = 10;
    this.sunLight.shadow.camera.far = 160;

    // Precision bias settings: prevents shadow acne on bus roofs & building walls
    this.sunLight.shadow.bias = -0.0003;
    this.sunLight.shadow.normalBias = 0.05;

    this.scene.add(this.sunLight);
    this.scene.add(this.sunLight.target);

    // 4. PMREM Generator for Sky Reflections
    this.pmremGenerator = new THREE.PMREMGenerator(this.renderer);
    this.pmremGenerator.compileEquirectangularShader();

    // 5. Atmospheric Fog
    this.scene.fog = new THREE.FogExp2(0xd2c2a8, 0.0075);

    // Apply initial midday setting
    this.applyPreset(PRESETS.midday);
    this.updateEnvironmentMap();
  }

  public getTimePeriodForHour(hour: number): TimePeriod {
    const h = (hour % 24 + 24) % 24;
    if (h >= 6 && h < 11) return 'morning';
    if (h >= 11 && h < 17) return 'midday';
    if (h >= 17 && h < 20) return 'golden_hour';
    return 'night';
  }

  public applyPreset(preset: LightingPreset): void {
    this.currentPeriod = preset.period;

    // Compute sun direction from elevation & azimuth
    const phi = THREE.MathUtils.degToRad(90 - preset.sunElevation);
    const theta = THREE.MathUtils.degToRad(preset.sunAzimuth);
    this.sunPositionVector.setFromSphericalCoords(1, phi, theta);

    // Update Sky Shader uniforms
    const uniforms = this.sky.material.uniforms;
    uniforms['turbidity'].value = preset.turbidity;
    uniforms['rayleigh'].value = preset.rayleigh;
    uniforms['mieCoefficient'].value = preset.mieCoefficient;
    uniforms['mieDirectionalG'].value = preset.mieDirectionalG;
    uniforms['sunPosition'].value.copy(this.sunPositionVector);

    // Update Sun Light
    this.sunLight.color.setHex(preset.sunColor);
    this.sunLight.intensity = preset.sunIntensity;

    // Update Hemisphere Light
    this.hemiLight.color.setHex(preset.hemiSkyColor);
    this.hemiLight.groundColor.setHex(preset.hemiGroundColor);
    this.hemiLight.intensity = preset.hemiIntensity;

    // Update Fog
    if (this.scene.fog && this.scene.fog instanceof THREE.FogExp2) {
      this.scene.fog.color.setHex(preset.fogColor);
      this.scene.fog.density = preset.fogDensity;
    }

    // Update Renderer Exposure
    this.renderer.toneMappingExposure = preset.exposure;

    // Recompute sun offset vector based on elevation
    const sunDist = 70;
    this.sunRelativeOffset.copy(this.sunPositionVector).multiplyScalar(sunDist);
    if (this.sunRelativeOffset.y < 5) this.sunRelativeOffset.y = 5;
  }

  public updateEnvironmentMap(): void {
    try {
      if (this.currentEnvTexture) {
        this.currentEnvTexture.dispose();
      }
      this.currentEnvTexture = this.pmremGenerator.fromScene(this.sky as unknown as THREE.Scene);
      this.scene.environment = this.currentEnvTexture.texture;
    } catch {
      // Fallback if context not ready
    }
  }

  public setHour(hour: number): void {
    this.currentHour = (hour % 24 + 24) % 24;
    const period = this.getTimePeriodForHour(this.currentHour);
    if (period !== this.currentPeriod) {
      this.applyPreset(PRESETS[period]);
      this.updateEnvironmentMap();
    }
    this.updateClockHUD();
  }

  public cycleTimeOfDay(): TimePeriod {
    const sequence: TimePeriod[] = ['midday', 'golden_hour', 'night', 'morning'];
    const nextIdx = (sequence.indexOf(this.currentPeriod) + 1) % sequence.length;
    const nextPeriod = sequence[nextIdx];

    const targetHour =
      nextPeriod === 'morning' ? 8 :
      nextPeriod === 'midday' ? 13.3 :
      nextPeriod === 'golden_hour' ? 18.2 :
      21.5;

    this.currentHour = targetHour;
    this.applyPreset(PRESETS[nextPeriod]);
    this.updateEnvironmentMap();
    this.updateClockHUD();
    return nextPeriod;
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
    // Advance time naturally
    this.currentHour += delta * this.timeScale;
    if (this.currentHour >= 24) this.currentHour -= 24;

    const period = this.getTimePeriodForHour(this.currentHour);
    if (period !== this.currentPeriod) {
      this.applyPreset(PRESETS[period]);
      this.updateEnvironmentMap();
    }

    this.updateClockHUD();

    // Shadow camera follows player smoothly
    const targetPos = playerPosition || new THREE.Vector3(0, 0, 0);

    this.sunLight.position.set(
      targetPos.x + this.sunRelativeOffset.x,
      targetPos.y + this.sunRelativeOffset.y,
      targetPos.z + this.sunRelativeOffset.z
    );
    this.sunLight.target.position.copy(targetPos);
    this.sunLight.target.updateMatrixWorld();
  }
}
