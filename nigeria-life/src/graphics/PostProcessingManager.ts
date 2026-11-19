import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

/**
 * Lagos tropical atmosphere + cinematic grade.
 * Tuned hard for a first-second "that's different" street read: warmth, contrast,
 * saturation, vignette, heat shimmer — still stylized realism, not photoreal.
 */
export const LagosAtmosphereShader = {
  name: 'LagosAtmosphereShader',
  uniforms: {
    tDiffuse: { value: null },
    vignetteOffset: { value: 1.22 },
    vignetteDarkness: { value: 0.58 },
    warmth: { value: 0.07 },
    contrast: { value: 1.22 },
    saturation: { value: 1.14 },
    time: { value: 0.0 },
    heatShimmer: { value: 0.0024 },
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
      // Heat-haze shimmer on the asphalt band
      float heatBand = smoothstep(0.22, 0.4, vUv.y) * (1.0 - smoothstep(0.55, 0.72, vUv.y));
      float shimmerWave = sin(vUv.y * 130.0 + time * 5.0) * cos(vUv.x * 85.0 + time * 3.8) * heatShimmer * heatBand;
      vec2 sampleUv = vUv + vec2(shimmerWave, shimmerWave * 0.25);

      vec4 texel = texture2D(tDiffuse, sampleUv);
      vec3 color = texel.rgb;

      // Tropical midtone warmth
      float midtones = 1.0 - abs(dot(color, vec3(0.333)) - 0.5) * 2.0;
      color.r += warmth * 1.35 * midtones;
      color.g += warmth * 0.75 * midtones;
      color.b -= warmth * 0.4 * midtones;

      // Punchier S-curve contrast
      color = (color - 0.5) * contrast + 0.5;

      // Naija vibrancy
      float lum = dot(color, vec3(0.299, 0.587, 0.114));
      color = mix(vec3(lum), color, saturation);

      // Cinematic vignette pulls the eye to the street
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
  private renderPass: RenderPass;
  private bloomPass: UnrealBloomPass;
  private gradePass: ShaderPass;
  public isEnabled: boolean = false;

  constructor(scene: THREE.Scene, camera: THREE.Camera, renderer: THREE.WebGLRenderer) {
    this.renderer = renderer;

    const width = window.innerWidth;
    const height = window.innerHeight;
    const pixelRatio = Math.min(window.devicePixelRatio, 2);

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

    this.renderPass = new RenderPass(scene, camera);
    this.composer.addPass(this.renderPass);

    // Bloom: chrome / paint specular / lamps — keep threshold high so asphalt stays matte
    const bloomResolution = new THREE.Vector2(width, height);
    this.bloomPass = new UnrealBloomPass(bloomResolution, 0.32, 0.38, 0.86);
    this.composer.addPass(this.bloomPass);

    this.gradePass = new ShaderPass(LagosAtmosphereShader);
    this.composer.addPass(this.gradePass);

    const outputPass = new OutputPass();
    this.composer.addPass(outputPass);
  }

  public render(scene: THREE.Scene, camera: THREE.Camera, delta: number = 0.016): void {
    if (this.isEnabled) {
      this.renderPass.scene = scene;
      this.renderPass.camera = camera;
      if (this.gradePass?.uniforms?.time) {
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

  /** Live grade knobs for e2e / debug */
  public get grade(): { contrast: number; warmth: number; saturation: number; vignette: number } {
    const u = this.gradePass.uniforms;
    return {
      contrast: u.contrast.value,
      warmth: u.warmth.value,
      saturation: u.saturation.value,
      vignette: u.vignetteDarkness.value,
    };
  }

  public setEnabled(enabled: boolean): void {
    this.isEnabled = enabled;
  }

  public get enabled(): boolean {
    return this.isEnabled;
  }
}
