import * as THREE from 'three';

/**
 * How much the game draws, chosen per device. Each level sets only the things measured to
 * cost frame time on the target machine (Intel HD 620): the size of the drawing in pixels,
 * the sun's shadows, and how far away street pedestrians are drawn and drawn in full.
 * High is the game as it has always looked.
 */
export type Quality = 'high' | 'balanced' | 'low';

interface Level {
  label: string;
  /** Pixels drawn per screen point, from the screen's own density */
  pixelRatio: (deviceRatio: number) => number;
  shadows: boolean;
  shadowMapSize: number;
  /** Pedestrians drawn at all within this, in full within crowdNear, metres */
  crowdDraw: number;
  crowdNear: number;
}

export const QUALITY_LEVELS: Record<Quality, Level> = {
  high: { label: 'High', pixelRatio: (d) => Math.min(d, 2), shadows: true, shadowMapSize: 1536, crowdDraw: 90, crowdNear: 22 },
  balanced: { label: 'Balanced', pixelRatio: (d) => Math.min(d, 1.5), shadows: true, shadowMapSize: 1024, crowdDraw: 70, crowdNear: 14 },
  // On a phone's dense screen fewer than one pixel per point is a blur; on an ordinary monitor 0.75 is the saving that counts
  low: { label: 'Low', pixelRatio: (d) => (d >= 1.5 ? 1 : 0.75), shadows: false, shadowMapSize: 512, crowdDraw: 50, crowdNear: 8 },
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
  /** Called after the pixel ratio changes, for anything sized to the drawing */
  resized?: () => void;
  /** Tells the player what was changed by itself */
  tell?: (text: string) => void;
}

export class GraphicsQuality {
  public level: Quality = 'high';
  /** True once the player has picked a level: the game then never changes it by itself */
  public chosen = false;
  private played = 0;
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
      }
    } catch {
      // No storage (private window): start at High
    }
    // A phone's first visit starts at Balanced: most phones cannot draw High smoothly (a real
    // Android phone measured 4 to 16 frames a second on the street at High). The player can
    // still choose High, and that choice is kept.
    if (!this.chosen && !this.storedLevel && typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches) this.level = 'balanced';
    this.apply(this.level);
  }

  public get label(): string {
    return QUALITY_LEVELS[this.level].label;
  }

  /** The player picks a level (from the phone). */
  public choose(level: Quality): void {
    this.chosen = true;
    this.apply(level);
  }

  /** The next level down the list, wrapping round: for a single "Change" button. */
  public next(): Quality {
    return ORDER[(ORDER.indexOf(this.level) + 1) % ORDER.length];
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

    crowd.drawDistance = l.crowdDraw;
    crowd.nearDistance = l.crowdNear;

    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ level, chosen: this.chosen }));
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
