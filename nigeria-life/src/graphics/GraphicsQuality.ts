import { SkinnedCrowd } from './people/SkinnedCrowd';
import * as THREE from 'three';
import { resolveDeviceProfile, type DeviceTier } from './DeviceProfile';

/**
 * How much the game draws, chosen per device. Each level sets only the things measured to
 * cost frame time: the size of the drawing in pixels, the sun's shadows, and how far away
 * street pedestrians are drawn and drawn in full.
 * High is the game as it has always looked. Very Low is for weak phones.
 *
 * Render scale + an optional internal height cap let Low/Very Low target lower fill-rate
 * without changing the CSS layout size of the canvas.
 *
 * IMPORTANT: toggling renderer.shadowMap.enabled rebuilds every lit shader (multi-second
 * freeze). Shadows are decided once before the first compile and never flipped live;
 * a desired change is kept for the next load.
 */
export type Quality = 'high' | 'balanced' | 'low' | 'veryLow';

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
  /** How many of the nearest street people are drawn as full character models */
  crowdModels: number;
  /** Instanced traffic draw distance, metres */
  trafficDraw: number;
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
    crowdModels: 10,
    trafficDraw: 150,
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
    crowdModels: 6,
    trafficDraw: 110,
    smokeEvery: 2,
    districtDraw: 380,
    wetMetalnessMax: 0.45,
    postFx: false,
  },
  // EliteBook HD 620 / mid phone: fewer pixels, throttled shadows, tight crowd, 720p cap.
  // Shadows stay on Low (turning them off rebuilds every lit shader — multi-second freeze).
  low: {
    label: 'Low',
    pixelRatio: (d) => Math.min(d, 1),
    renderScale: 0.7,
    maxInternalHeight: 720,
    shadows: true,
    shadowMapSize: 512,
    shadowEvery: 1.5,
    crowdDraw: 36,
    crowdNear: 10,
    crowdModels: 3,
    trafficDraw: 80,
    smokeEvery: 4,
    districtDraw: 220,
    wetMetalnessMax: 0.22,
    postFx: false,
  },
  // Weak phones (A16-class and below): pixel ratio 1, short distances, player as only full model.
  // Shadows off — decided before first shader compile; never toggled live.
  // Broad Street budget (measured): ≤250 draw calls and ≤110k triangles at 360×800.
  veryLow: {
    label: 'Very Low',
    pixelRatio: () => 1,
    renderScale: 0.55,
    maxInternalHeight: 540,
    shadows: false,
    shadowMapSize: 256,
    shadowEvery: 99,
    crowdDraw: 22,
    crowdNear: 6,
    crowdModels: 0,
    trafficDraw: 50,
    smokeEvery: 8,
    districtDraw: 140,
    wetMetalnessMax: 0.08,
    postFx: false,
  },
};

/** Highest → lowest (step-down walks toward the end) */
const ORDER: Quality[] = ['high', 'balanced', 'low', 'veryLow'];
const STORAGE_KEY = 'nigerialife.graphics';
/** Below this many frames a second over a stretch of play, the game steps down a level by itself */
const SLOW_FPS = 20;
/** Above this for a full sample window, the game may step up one level (if not chosen by hand) */
const GOOD_FPS = 48;
/** Frames in the first seconds after loading are slow while shaders compile: not counted */
const WARM_UP_SECONDS = 8;
const SAMPLE_SECONDS = 12;
/** After an auto change, wait this long before sampling again (avoids bouncing) */
const COOLDOWN_SECONDS = 45;

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
    trafficDraw: number;
    wetMetalnessMax: number;
    postFx: boolean;
    level: Quality;
  }) => void;
  /** Tells the player what was changed by itself */
  tell?: (text: string) => void;
}

/** @deprecated Prefer resolveDeviceProfile(); kept for callers that only need the Intel-iGPU check. */
export function preferLowGpu(): boolean {
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
    if (!gl || !(gl instanceof WebGLRenderingContext)) return false;
    const dbg = gl.getExtension('WEBGL_debug_renderer_info');
    const name = dbg ? String(gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) || '') : '';
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
  /** Device tier used for the first-visit default (for diagnostics) */
  public deviceTier: DeviceTier = 'strong';
  private played = 0;
  private sinceShadow = 0;
  private frames = 0;
  private sampled = 0;
  private cooldown = 0;
  private targets: QualityTargets;
  /** This device had a level kept from before */
  private storedLevel = false;
  /**
   * Shadows applied on this visit. Never flipped after the first apply — a desired change is
   * written to storage and takes effect on the next load.
   */
  private sessionShadows: boolean;
  private firstApplyDone = false;

  constructor(targets: QualityTargets, opts?: { sessionShadows?: boolean }) {
    this.targets = targets;
    const profile = resolveDeviceProfile();
    this.deviceTier = profile.tier;

    let desiredShadows = profile.shadows;
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
      if (saved && ORDER.includes(saved.level)) {
        this.storedLevel = true;
        this.level = saved.level;
        this.chosen = !!saved.chosen;
        if (typeof saved.userScale === 'number' && saved.userScale >= 0.5 && saved.userScale <= 1) {
          this.userScale = saved.userScale;
        }
        if (typeof saved.shadows === 'boolean') desiredShadows = saved.shadows;
        else desiredShadows = QUALITY_LEVELS[this.level].shadows;
      }
    } catch {
      // No storage (private window): start from the device profile
    }

    if (!this.chosen && !this.storedLevel) {
      this.level = profile.quality;
      desiredShadows = QUALITY_LEVELS[this.level].shadows;
    }

    // URL ?quality= wins for this visit's starting level (tests / probes), but does not mark chosen
    // unless the player later presses Change. Existing automated suites keep High via webdriver tier.
    try {
      const q = new URLSearchParams(location.search).get('quality');
      if (q) {
        const aliases: Record<string, Quality> = {
          high: 'high',
          balanced: 'balanced',
          medium: 'balanced',
          low: 'low',
          verylow: 'veryLow',
          'very-low': 'veryLow',
        };
        const mapped = aliases[q.toLowerCase()];
        if (mapped) {
          this.level = mapped;
          if (!this.storedLevel) desiredShadows = QUALITY_LEVELS[mapped].shadows;
        }
      }
    } catch {
      /* ignore */
    }

    // Constructor opts (from Game, which may have already primed the renderer) win for this session
    this.sessionShadows = typeof opts?.sessionShadows === 'boolean' ? opts.sessionShadows : desiredShadows;
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

    const wantShadows = l.shadows;
    if (!this.firstApplyDone) {
      // First apply of the session: lock the shadow flag that Game may already have primed
      renderer.shadowMap.enabled = this.sessionShadows;
      sun.castShadow = this.sessionShadows;
      this.firstApplyDone = true;
    } else if (wantShadows !== this.sessionShadows) {
      // Live change would rebuild every lit shader — keep the session flag; remember for next load
      // (sessionShadows stays; storage below writes the desired wantShadows)
    } else {
      // Same shadow intent as session: only refresh map size / interval
      sun.castShadow = this.sessionShadows;
    }

    // Shadow map size may shrink/grow without flipping enabled
    if (this.sessionShadows && sun.shadow.mapSize.x !== l.shadowMapSize) {
      sun.shadow.mapSize.set(l.shadowMapSize, l.shadowMapSize);
      sun.shadow.map?.dispose();
      sun.shadow.map = null;
    }

    renderer.shadowMap.autoUpdate = this.sessionShadows && l.shadowEvery === 0;
    if (this.sessionShadows) renderer.shadowMap.needsUpdate = true;
    crowd.drawDistance = l.crowdDraw;
    crowd.nearDistance = l.crowdNear;
    SkinnedCrowd.limit = l.crowdModels;
    this.targets.onLevel?.({
      smokeEvery: l.smokeEvery,
      districtDraw: l.districtDraw,
      trafficDraw: l.trafficDraw,
      wetMetalnessMax: l.wetMetalnessMax,
      postFx: l.postFx,
      level,
    });

    try {
      // Persist the level's desired shadows for the *next* load (may differ from sessionShadows)
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          level,
          chosen: this.chosen,
          userScale: this.userScale,
          shadows: wantShadows,
        })
      );
    } catch {
      // Not kept, but still applied for this visit
    }

    // Very Low Broad Street budget ≤110k tris: facade window/AC/tank dressing is the
    // biggest optional cost once crowds are off. Keep the shell; drop the detail bake.
    const showFacadeDetail = level !== 'veryLow';
    scene.traverse((obj) => {
      if (obj.name === 'facade_detail') obj.visible = showFacadeDetail;
    });
  }

  /**
   * Called every frame with the real time it took. After warm-up, sustained slow play steps
   * down; sustained smooth play may step up one level. Never once the player has chosen.
   * Automated browsers are left alone so tests draw the same thing every time.
   */
  public watch(realSeconds: number): void {
    const every = QUALITY_LEVELS[this.level].shadowEvery;
    if (this.sessionShadows && every > 0) {
      this.sinceShadow += realSeconds;
      if (this.sinceShadow >= every) {
        this.sinceShadow = 0;
        this.targets.renderer.shadowMap.needsUpdate = true;
      }
    }
    if (this.chosen || navigator.webdriver) return;
    if (this.cooldown > 0) {
      this.cooldown = Math.max(0, this.cooldown - realSeconds);
      return;
    }
    this.played += realSeconds;
    if (this.played < WARM_UP_SECONDS) return;
    this.frames++;
    this.sampled += realSeconds;
    if (this.sampled < SAMPLE_SECONDS) return;
    const fps = this.frames / this.sampled;
    this.frames = 0;
    this.sampled = 0;
    if (fps < SLOW_FPS) this.stepDown(fps);
    else if (fps >= GOOD_FPS) this.stepUp(fps);
  }

  /** One level down, and say so. Does not toggle shadowMap.enabled. */
  public stepDown(fps: number): void {
    const lower = ORDER[Math.min(ORDER.length - 1, ORDER.indexOf(this.level) + 1)];
    if (lower === this.level) return;
    this.apply(lower);
    this.cooldown = COOLDOWN_SECONDS;
    this.targets.tell?.(
      `The game was running at ${Math.round(fps)} frames a second, so graphics are now ${QUALITY_LEVELS[lower].label}. Change it in Phone › Life › Settings.`
    );
  }

  /** One level up after sustained good frame rate. Does not toggle shadowMap.enabled. */
  public stepUp(fps: number): void {
    const idx = ORDER.indexOf(this.level);
    if (idx <= 0) return;
    const higher = ORDER[idx - 1];
    this.apply(higher);
    this.cooldown = COOLDOWN_SECONDS;
    this.targets.tell?.(
      `The game is running smoothly (${Math.round(fps)} fps), so graphics are now ${QUALITY_LEVELS[higher].label}. Change it in Phone › Life › Settings.`
    );
  }
}

/** Shadows the renderer should enable before the first shader compile. */
export function initialShadowFlag(): boolean {
  // URL ?quality= must win here too — Game primes the renderer before GraphicsQuality runs
  try {
    const q = new URLSearchParams(location.search).get('quality');
    if (q) {
      const aliases: Record<string, Quality> = {
        high: 'high',
        balanced: 'balanced',
        medium: 'balanced',
        low: 'low',
        verylow: 'veryLow',
        'very-low': 'veryLow',
      };
      const mapped = aliases[q.toLowerCase()];
      if (mapped) return QUALITY_LEVELS[mapped].shadows;
    }
  } catch {
    /* ignore */
  }
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
    if (saved && typeof saved.shadows === 'boolean') return saved.shadows;
    if (saved && ORDER.includes(saved.level)) return QUALITY_LEVELS[saved.level as Quality].shadows;
  } catch {
    /* ignore */
  }
  return resolveDeviceProfile().shadows;
}
