import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

/**
 * Custom Lagos Tropical Atmosphere & Cinematic Color Grade Shader.
 * Adds subtle peripheral vignette to draw focus to street gameplay,
 * and a tailored warm golden sunlight grade fitting tropical Harmattan / Lagos heat.
 */
export const LagosAtmosphereShader = {
  name: 'LagosAtmosphereShader',
  uniforms: {
    tDiffuse: { value: null },
    vignetteOffset: { value: 1.15 },
    vignetteDarkness: { value: 0.35 },
    warmth: { value: 0.035 },
    contrast: { value: 1.05 },
    saturation: { value: 1.04 },
    time: { value: 0.0 },
    heatShimmer: { value: 0.0012 },
  },
  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    uniform sampler2D tDiffuse;
    uniform float vignetteOffset;
    uniform float vignetteDarkness;
    uniform float warmth;
    uniform float contrast;
    uniform float saturation;
    uniform float time;
    uniform float heatShimmer;
    varying vec2 vUv;

    void main() {
      // 0. Distance Heat-Haze Shimmer (Iconic Lagos midday tarmac mirage)
      // Only affects lower-middle horizon screen band where asphalt roads & distant junction meet
      float heatBand = smoothstep(0.26, 0.42, vUv.y) * (1.0 - smoothstep(0.56, 0.72, vUv.y));
      float shimmerWave = sin(vUv.y * 130.0 + time * 5.0) * cos(vUv.x * 85.0 + time * 3.8) * heatShimmer * heatBand;
      vec2 sampleUv = vUv + vec2(shimmerWave, shimmerWave * 0.25);

      vec4 texel = texture2D(tDiffuse, sampleUv);
      vec3 color = texel.rgb;

      // 1. Tropical Nigerian Warmth in midtones (Subtle golden-amber lift)
      float midtones = 1.0 - abs(dot(color, vec3(0.333)) - 0.5) * 2.0;
      color.r += warmth * 1.2 * midtones;
      color.g += warmth * 0.7 * midtones;
      color.b -= warmth * 0.3 * midtones;

      // 2. Gentle S-curve Contrast enhancement
      color = (color - 0.5) * contrast + 0.5;

      // 3. Subtle Vibrancy / Saturation
      float lum = dot(color, vec3(0.299, 0.587, 0.114));
      color = mix(vec3(lum), color, saturation);

      // 4. Smooth Cinematic Vignette
      vec2 uv = (vUv - vec2(0.5)) * vec2(vignetteOffset);
      float distSq = dot(uv, uv);
      float vig = clamp(1.0 - distSq * vignetteDarkness, 0.0, 1.0);
      color *= vig;

      gl_FragColor = vec4(clamp(color, 0.0, 1.0), 1.0);
    }
  `,
};

export class PostProcessingManager {
  private composer: EffectComposer;
  private renderer: THREE.WebGLRenderer;
  private bloomPass: UnrealBloomPass;
  private gradePass: ShaderPass;
  public isEnabled: boolean = false;

  constructor(scene: THREE.Scene, camera: THREE.Camera, renderer: THREE.WebGLRenderer) {
    this.renderer = renderer;

    const width = window.innerWidth;
    const height = window.innerHeight;
    const pixelRatio = Math.min(window.devicePixelRatio, 2);

    // Render target with high-precision half-float buffer for HDR bloom calculations
    const renderTarget = new THREE.WebGLRenderTarget(width * pixelRatio, height * pixelRatio, {
      type: THREE.HalfFloatType,
      format: THREE.RGBAFormat,
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      generateMipmaps: false,
    });

    this.composer = new EffectComposer(this.renderer, renderTarget);
    this.composer.setPixelRatio(pixelRatio);
    this.composer.setSize(width, height);

    // 1. Base Scene Render Pass
    const renderPass = new RenderPass(scene, camera);
    this.composer.addPass(renderPass);

    // 2. High-Fidelity Unreal Bloom Pass
    // Threshold: 0.88 (prevents matte roads/walls from blooming while giving headlights,
    // brake lights, neon signs, and chrome highlights a luscious glow)
    // Strength: 0.28 (refined and clean)
    // Radius: 0.35 (natural optical light dispersion)
    const bloomResolution = new THREE.Vector2(width, height);
    this.bloomPass = new UnrealBloomPass(bloomResolution, 0.28, 0.35, 0.88);
    this.composer.addPass(this.bloomPass);

    // 3. Lagos Tropical Color Grading & Cinematic Vignette Pass
    this.gradePass = new ShaderPass(LagosAtmosphereShader);
    this.composer.addPass(this.gradePass);

    // 4. Output Pass: Final ACES Filmic Tone Mapping and sRGB Color Space conversion
    const outputPass = new OutputPass();
    this.composer.addPass(outputPass);
  }

  public render(scene: THREE.Scene, camera: THREE.Camera, delta: number = 0.016): void {
    if (this.isEnabled) {
      if (this.gradePass && this.gradePass.uniforms && this.gradePass.uniforms.time) {
        this.gradePass.uniforms.time.value += delta;
      }
      try {
        this.composer.render();
      } catch {
        this.renderer.render(scene, camera);
      }
    } else {
      this.renderer.render(scene, camera);
    }
  }

  public setSize(width: number, height: number): void {
    const pixelRatio = Math.min(window.devicePixelRatio, 2);
    this.composer.setPixelRatio(pixelRatio);
    this.composer.setSize(width, height);
    this.bloomPass.resolution.set(width, height);
  }

  public setBloomStrength(strength: number): void {
    this.bloomPass.strength = strength;
  }

  public setBloomThreshold(threshold: number): void {
    this.bloomPass.threshold = threshold;
  }

  public setEnabled(enabled: boolean): void {
    this.isEnabled = enabled;
  }

  public get enabled(): boolean {
    return this.isEnabled;
  }
}
