import * as THREE from 'three';

/**
 * How much the game draws, chosen per device. Each level sets only the things measured to
 * cost frame time on the target machine (Intel HD 620): the size of the drawing in pixels,
 * the sun's shadows, and how far away street pedestrians are drawn and drawn in full.
 * High is the game as it has always looked.
 *
 * Render scale + an optional internal height cap let a Low preset target ~720p fill-rate
 * without changing the CSS layout size of the canvas.
 */
export type Quality = 'high' | 'balanced' | 'low';

interface Level {
  label: string;
  /** Pixels drawn per screen point, from the screen's own density */
  pixelRatio: (deviceRatio: number) => number;
  /** Extra shrink of the drawing buffer (1 = full window × pixelRatio) */
  renderScale: number;
  /** Cap drawing-buffer height (CSS px × scale); Low uses 720 for HD 620-class fill-rate */
  maxInternalHeight: number;
  shadows: boolean;
  shadowMapSize: number;
  /** Seconds between redraws of the shadow map; 0 is every frame */
  shadowEvery: number;
  /** Pedestrians drawn at all within this, in full within crowdNear, metres */
  crowdDraw: number;
  crowdNear: number;
  /** Frames between smoke/atmosphere particle updates (1 = every frame) */
  smokeEvery: number;
  /** Distance beyond which outer Lagos district groups are culled */
  districtDraw: number;
  /** Max wet-road metalness (specular cost); rain still darkens roughness */
  wetMetalnessMax: number;
  /** Whether the optional bloom/grade composer may run */
  postFx: boolean;
}

export const QUALITY_LEVELS: Record<Quality, Level> = {
  high: {
    label: 'High',
    pixelRatio: (d) => Math.min(d, 2),
    renderScale: 1,
    maxInternalHeight: 1440,
    shadows: true,
    shadowMapSize: 1536,
    shadowEvery: 0,
    crowdDraw: 90,
    crowdNear: 22,
    smokeEvery: 1,
    districtDraw: 600,
    wetMetalnessMax: 0.65,
    postFx: false,
  },
  balanced: {
    label: 'Medium',
    pixelRatio: (d) => Math.min(d, 1.25),
    renderScale: 0.9,
    maxInternalHeight: 1080,
    shadows: true,
    shadowMapSize: 1024,
    shadowEvery: 0,
    crowdDraw: 60,
    crowdNear: 12,
    smokeEvery: 2,
    districtDraw: 380,
    wetMetalnessMax: 0.45,
    postFx: false,
  },
  // EliteBook HD 620 / A16-class: fewer pixels, throttled shadows, tight crowd, 720p cap.
  // Shadows stay on (turning them off rebuilds every lit shader — multi-second freeze).
  low: {
    label: 'Low',
    pixelRatio: (d) => Math.min(d, 1),
    renderScale: 0.7,
    maxInternalHeight: 720,
    shadows: true,
    shadowMapSize: 512,
    shadowEvery: 1.5,
    crowdDraw: 36,
    crowdNear: 6,
    smokeEvery: 4,
    districtDraw: 220,
    wetMetalnessMax: 0.22,
    postFx: false,
  },
};

const ORDER: Quality[] = ['high', 'balanced', 'low'];
const STORAGE_KEY = 'nigerialife.graphics';
/** Below this many frames a second over a stretch of play, the game steps down a level by itself */
const SLOW_FPS = 20;
/** Frames in the first seconds after loading are slow while shaders compile: not counted */
const WARM_UP_SECONDS = 8;
const SAMPLE_SECONDS = 12;

export interface QualityTargets {
  renderer: THREE.WebGLRenderer;
  sun: THREE.DirectionalLight;
  scene: THREE.Scene;
  crowd: { drawDistance: number; nearDistance: number };
  /** Called after the pixel ratio / drawing size changes */
  resized?: () => void;
  /** Called whenever a quality level is applied */
  onLevel?: (settings: {
    smokeEvery: number;
    districtDraw: number;
    wetMetalnessMax: number;
    postFx: boolean;
    level: Quality;
  }) => void;
  /** Tells the player what was changed by itself */
  tell?: (text: string) => void;
}

/** Integrated / software GPUs that should start on Low unless the player already chose. */
export function preferLowGpu(): boolean {
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
    if (!gl || !(gl instanceof WebGLRenderingContext)) return false;
    const dbg = gl.getExtension('WEBGL_debug_renderer_info');
    const name = dbg ? String(gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) || '') : '';
    // Real weak laptop iGPUs only — not SwiftShader/Mesa (CI / headless stay on High for visual tests)
    return /Intel.*(HD|UHD|Iris)/i.test(name);
  } catch {
    return false;
  }
}

export class GraphicsQuality {
  public level: Quality = 'high';
  /** True once the player has picked a level: the game then never changes it by itself */
  public chosen = false;
  /** Extra scale the player set (1 = use the level default). Persisted with the level. */
  public userScale = 1;
  private played = 0;
  private sinceShadow = 0;
  private frames = 0;
  private sampled = 0;
  private targets: QualityTargets;
  /** This device had a level kept from before */
  private storedLevel = false;

  constructor(targets: QualityTargets) {
    this.targets = targets;
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
      if (saved && ORDER.includes(saved.level)) {
        this.storedLevel = true;
        this.level = saved.level;
        this.chosen = !!saved.chosen;
        if (typeof saved.userScale === 'number' && saved.userScale >= 0.5 && saved.userScale <= 1) {
          this.userScale = saved.userScale;
        }
      }
    } catch {
      // No storage (private window): start at High
    }
    // Phones → Medium. Weak integrated GPUs (HD 620 class) → Low on first visit.
    if (!this.chosen && !this.storedLevel) {
      if (typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches) this.level = 'balanced';
      else if (preferLowGpu()) this.level = 'low';
    }
    this.apply(this.level);
  }

  public get label(): string {
    return QUALITY_LEVELS[this.level].label;
  }

  public get renderScale(): number {
    return QUALITY_LEVELS[this.level].renderScale * this.userScale;
  }

  public get maxInternalHeight(): number {
    return QUALITY_LEVELS[this.level].maxInternalHeight;
  }

  public get wetMetalnessMax(): number {
    return QUALITY_LEVELS[this.level].wetMetalnessMax;
  }

  public get postFx(): boolean {
    return QUALITY_LEVELS[this.level].postFx;
  }

  /** The player picks a level (from the phone). */
  public choose(level: Quality): void {
    this.chosen = true;
    this.apply(level);
  }

  /** Cycle render scale: 100% → 85% → 70% → 55% → 100% of the level’s scale. */
  public cycleUserScale(): number {
    const steps = [1, 0.85, 0.7, 0.55];
    const i = steps.findIndex((s) => Math.abs(s - this.userScale) < 0.02);
    this.userScale = steps[(i + 1) % steps.length];
    this.chosen = true;
    this.apply(this.level);
    return this.userScale;
  }

  /** The next level down the list, wrapping round: for a single "Change" button. */
  public next(): Quality {
    return ORDER[(ORDER.indexOf(this.level) + 1) % ORDER.length];
  }

  /**
   * Drawing-buffer size for the current window and quality.
   * CSS canvas size stays full-window; only the GPU buffer shrinks.
   */
  public drawingSize(cssWidth = window.innerWidth, cssHeight = window.innerHeight): { width: number; height: number } {
    const scale = this.renderScale;
    let w = Math.max(1, Math.floor(cssWidth * scale));
    let h = Math.max(1, Math.floor(cssHeight * scale));
    const cap = this.maxInternalHeight;
    if (h > cap) {
      const f = cap / h;
      w = Math.max(1, Math.floor(w * f));
      h = Math.max(1, Math.floor(h * f));
    }
    return { width: w, height: h };
  }

  public apply(level: Quality): void {
    this.level = level;
    const l = QUALITY_LEVELS[level];
    const { renderer, sun, scene, crowd } = this.targets;

    renderer.setPixelRatio(l.pixelRatio(window.devicePixelRatio || 1));
    this.targets.resized?.();

    // Turning shadows on or off changes every lit material's shader, so only touch them on a change
    if (renderer.shadowMap.enabled !== l.shadows || sun.castShadow !== l.shadows) {
      renderer.shadowMap.enabled = l.shadows;
      sun.castShadow = l.shadows;
      scene.traverse((o) => {
        const m = (o as THREE.Mesh).material;
        if (m) for (const mat of Array.isArray(m) ? m : [m]) mat.needsUpdate = true;
      });
    }
    if (sun.shadow.mapSize.x !== l.shadowMapSize) {
      sun.shadow.mapSize.set(l.shadowMapSize, l.shadowMapSize);
      sun.shadow.map?.dispose();
      sun.shadow.map = null;
    }

    renderer.shadowMap.autoUpdate = l.shadowEvery === 0;
    renderer.shadowMap.needsUpdate = true;
    crowd.drawDistance = l.crowdDraw;
    crowd.nearDistance = l.crowdNear;
    this.targets.onLevel?.({
      smokeEvery: l.smokeEvery,
      districtDraw: l.districtDraw,
      wetMetalnessMax: l.wetMetalnessMax,
      postFx: l.postFx,
      level,
    });

    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ level, chosen: this.chosen, userScale: this.userScale }));
    } catch {
      // Not kept, but still applied for this visit
    }
  }

  /**
   * Called every frame with the real time it took. Once, after the warm-up, if play has been
   * slower than SLOW_FPS the level steps down and the player is told; it does this at most
   * twice and never once the player has chosen. Automated browsers are left alone, so tests
   * draw the same thing every time.
   */
  public watch(realSeconds: number): void {
    // A shadow redrawn now and then, on a level that does not redraw it every frame
    const every = QUALITY_LEVELS[this.level].shadowEvery;
    if (every > 0) {
      this.sinceShadow += realSeconds;
      if (this.sinceShadow >= every) {
        this.sinceShadow = 0;
        this.targets.renderer.shadowMap.needsUpdate = true;
      }
    }
    if (this.chosen || this.level === 'low' || navigator.webdriver) return;
    this.played += realSeconds;
    if (this.played < WARM_UP_SECONDS) return;
    this.frames++;
    this.sampled += realSeconds;
    if (this.sampled < SAMPLE_SECONDS) return;
    const fps = this.frames / this.sampled;
    this.frames = 0;
    this.sampled = 0;
    if (fps < SLOW_FPS) this.stepDown(fps);
  }

  /** One level down, and say so. */
  public stepDown(fps: number): void {
    const lower = ORDER[Math.min(ORDER.length - 1, ORDER.indexOf(this.level) + 1)];
    if (lower === this.level) return;
    this.apply(lower);
    this.targets.tell?.(
      `The game was running at ${Math.round(fps)} frames a second, so graphics are now ${QUALITY_LEVELS[lower].label}. Change it in Phone › Life › Settings.`
    );
  }
}
