import * as THREE from 'three';

/**
 * The sky, drawn as one dome round whichever camera is rendering, with its colours worked out
 * from the clock every frame. It used to be a painted picture swapped at four set hours, which
 * made the whole sky jump (and its clouds move) at 5:48, 11:30, 16:30 and 19:18.
 */

interface SkyKey {
  hour: number;
  top: string;
  mid: string;
  horizon: string;
  glow: string;
}

const NIGHT = { top: '#0a1128', mid: '#131e3a', horizon: '#1c2b4a', glow: '#3b5284' };
const DAWN = { top: '#2b4a7c', mid: '#e7a06a', horizon: '#ffcf8a', glow: '#ffd9a0' };
const MORNING = { top: '#3b6ea5', mid: '#9bc5e8', horizon: '#f5e4c8', glow: '#fff3cf' };
const MIDDAY = { top: '#3f7fc4', mid: '#8fc0e8', horizon: '#e9dcc2', glow: '#fff7d8' };
const GOLDEN = { top: '#2b4a7c', mid: '#e7a06a', horizon: '#ffcf8a', glow: '#ffd9a0' };
const DUSK = { top: '#1a2850', mid: '#6a4466', horizon: '#d07a5c', glow: '#e08a60' };

const KEYS: SkyKey[] = [
  { hour: 0, ...NIGHT },
  { hour: 5.3, ...NIGHT },
  { hour: 6.3, ...DAWN },
  { hour: 7.6, ...MORNING },
  { hour: 11, ...MORNING },
  { hour: 12.5, ...MIDDAY },
  { hour: 16.5, ...MIDDAY },
  { hour: 18.2, ...GOLDEN },
  { hour: 19.4, ...DUSK },
  { hour: 20.5, ...NIGHT },
  { hour: 24, ...NIGHT },
];

const VERTEX = /* glsl */ `
  varying vec3 vDir;
  void main() {
    vDir = position;
    vec4 clip = projectionMatrix * viewMatrix * vec4(position + cameraPosition, 1.0);
    // On the far plane, behind everything
    gl_Position = clip.xyww;
    gl_Position.z = gl_Position.w * 0.99999;
  }
`;

const FRAGMENT = /* glsl */ `
  uniform vec3 uTop;
  uniform vec3 uMid;
  uniform vec3 uHorizon;
  uniform vec3 uGlow;
  uniform vec3 uSunDir;
  uniform float uGrey;
  uniform float uNight;
  uniform float uDrift;
  uniform sampler2D uClouds;
  varying vec3 vDir;

  float hash(vec3 p) { return fract(sin(dot(p, vec3(12.9898, 78.233, 37.719))) * 43758.5453); }

  void main() {
    vec3 dir = normalize(vDir);
    float up = dir.y;
    // Ground haze below the horizon, then horizon, middle band and the top of the sky
    vec3 col = up < 0.0
      ? mix(uHorizon, uHorizon * 0.55, clamp(-up * 3.0, 0.0, 1.0))
      : up < 0.25 ? mix(uHorizon, uMid, up / 0.25) : mix(uMid, uTop, clamp((up - 0.25) / 0.6, 0.0, 1.0));

    // The sun (or moon) and the light round it
    float sun = max(dot(dir, uSunDir), 0.0);
    col += uGlow * (pow(sun, 8.0) * 0.28 + pow(sun, 220.0) * 0.9) * (1.0 - uGrey);

    // Stars on a clear night
    if (up > 0.05) {
      float star = step(0.9975, hash(floor(dir * 420.0)));
      col += vec3(star) * uNight * (1.0 - uGrey) * smoothstep(0.05, 0.3, up) * 0.8;
    }

    // Clouds drift slowly with the wind; lit like the sky round them, dark at night
    if (up > 0.0) {
      vec2 uv = vec2(atan(dir.z, dir.x) / 6.2831853 + 0.5 + uDrift, clamp(up / 0.6, 0.0, 1.0));
      float cloud = texture2D(uClouds, uv).a * smoothstep(0.0, 0.12, up) * (1.0 - smoothstep(0.45, 0.6, up));
      vec3 cloudCol = mix(mix(uHorizon, vec3(1.0), 0.65), uMid * 0.6, uNight * 0.85);
      col = mix(col, cloudCol, cloud * (0.75 + uGrey * 0.25));
    }

    // Overcast: the colour drains out of it
    float luma = dot(col, vec3(0.299, 0.587, 0.114));
    col = mix(col, vec3(luma) * 0.92, uGrey);

    gl_FragColor = vec4(col, 1.0);
    #include <colorspace_fragment>
  }
`;

/** A strip of cloud shapes, the same every time (seeded), so the clouds never jump. */
function cloudTexture(): THREE.CanvasTexture {
  const w = 1024;
  const h = 256;
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const g = c.getContext('2d')!;
  let seed = 7;
  const rand = () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };
  for (let i = 0; i < 70; i++) {
    const x = rand() * w;
    const y = h * (0.1 + rand() * 0.6);
    const rx = 30 + rand() * 80;
    const ry = 5 + rand() * 12;
    const grad = g.createRadialGradient(0, 0, 0, 0, 0, 1);
    grad.addColorStop(0, 'rgba(255,255,255,0.5)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    // Drawn twice across the seam so the strip wraps round the sky
    for (const shift of [0, -w, w]) {
      g.save();
      g.translate(x + shift, y);
      g.scale(rx, ry);
      g.fillStyle = grad;
      g.beginPath();
      g.arc(0, 0, 1, 0, Math.PI * 2);
      g.fill();
      g.restore();
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = THREE.RepeatWrapping;
  return t;
}

export class SkyDome {
  public readonly mesh: THREE.Mesh;
  private material: THREE.ShaderMaterial;
  private colours = { top: new THREE.Color(), mid: new THREE.Color(), horizon: new THREE.Color(), glow: new THREE.Color() };
  private a = new THREE.Color();
  private b = new THREE.Color();

  constructor() {
    this.material = new THREE.ShaderMaterial({
      vertexShader: VERTEX,
      fragmentShader: FRAGMENT,
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
      toneMapped: false,
      uniforms: {
        uTop: { value: this.colours.top },
        uMid: { value: this.colours.mid },
        uHorizon: { value: this.colours.horizon },
        uGlow: { value: this.colours.glow },
        uSunDir: { value: new THREE.Vector3(0, 1, 0) },
        uGrey: { value: 0 },
        uNight: { value: 0 },
        uDrift: { value: 0 },
        uClouds: { value: cloudTexture() },
      },
    });
    this.mesh = new THREE.Mesh(new THREE.SphereGeometry(10, 32, 16), this.material);
    this.mesh.name = 'SkyDome';
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = -1000;
    this.mesh.matrixAutoUpdate = false;
  }

  /** The colour at the horizon now (linear), for whatever the dome does not cover. */
  public get horizonColour(): THREE.Color {
    return this.colours.horizon;
  }

  /** The sky's colours at an hour of the day (sRGB hex strings), for tests and the HUD. */
  public static coloursAt(hour: number): { top: string; mid: string; horizon: string; glow: string } {
    const h = ((hour % 24) + 24) % 24;
    let i = 0;
    while (i < KEYS.length - 2 && h > KEYS[i + 1].hour) i++;
    const k0 = KEYS[i];
    const k1 = KEYS[i + 1];
    const t = k1.hour > k0.hour ? (h - k0.hour) / (k1.hour - k0.hour) : 0;
    const mix = (p: string, q: string) =>
      '#' + new THREE.Color(p).convertLinearToSRGB().lerp(new THREE.Color(q).convertLinearToSRGB(), t).convertSRGBToLinear().getHexString();
    return { top: mix(k0.top, k1.top), mid: mix(k0.mid, k1.mid), horizon: mix(k0.horizon, k1.horizon), glow: mix(k0.glow, k1.glow) };
  }

  /** Sets the sky for an hour (0-24), the direction of the sun or moon, how overcast it is (0-1), and the time for drift. */
  public update(hour: number, sunDir: THREE.Vector3, grey: number, seconds: number): void {
    const h = ((hour % 24) + 24) % 24;
    let i = 0;
    while (i < KEYS.length - 2 && h > KEYS[i + 1].hour) i++;
    const k0 = KEYS[i];
    const k1 = KEYS[i + 1];
    const t = k1.hour > k0.hour ? (h - k0.hour) / (k1.hour - k0.hour) : 0;
    // Blended as the eye sees it (sRGB), so night does not leap towards dawn in the first minutes
    for (const name of ['top', 'mid', 'horizon', 'glow'] as const) {
      this.a.setStyle(k0[name]).convertLinearToSRGB();
      this.b.setStyle(k1[name]).convertLinearToSRGB();
      this.colours[name].copy(this.a).lerp(this.b, t).convertSRGBToLinear();
    }
    const u = this.material.uniforms;
    u.uSunDir.value.copy(sunDir).normalize();
    u.uGrey.value = THREE.MathUtils.clamp(grey, 0, 0.85);
    // Stars come out after dusk and fade before dawn
    u.uNight.value = h < 5.5 ? 1 : h < 6.3 ? 1 - (h - 5.5) / 0.8 : h > 20.5 ? 1 : h > 19.4 ? (h - 19.4) / 1.1 : 0;
    u.uDrift.value = (seconds * 0.0015) % 1;
  }
}
