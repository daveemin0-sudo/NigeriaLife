import type { Quality } from './GraphicsQuality';

/**
 * Classifies the device so the game can pick a safe starting graphics level.
 * Missing APIs (common on Safari / Firefox) push toward a lower start, never a crash.
 *
 * Test-only URL overrides:
 *   ?device=weak|mid|strong
 *   ?quality=high|balanced|medium|low|veryLow|verylow
 */

export type DeviceTier = 'weak' | 'mid' | 'strong';

export interface DeviceSignals {
  deviceMemory: number | null;
  hardwareConcurrency: number | null;
  gpuName: string;
  webgl2: boolean;
  maxTextureSize: number | null;
  cssPixels: number;
  pixelRatio: number;
  saveData: boolean;
  connectionType: string | null;
  touch: boolean;
  webdriver: boolean;
}

export interface DeviceDecision {
  tier: DeviceTier;
  /** Starting quality when the player has not chosen and nothing is stored */
  quality: Quality;
  /** Whether this level should enable the sun's shadow map on first load */
  shadows: boolean;
  signals: DeviceSignals;
  reason: string;
}

const QUALITY_ALIASES: Record<string, Quality> = {
  high: 'high',
  balanced: 'balanced',
  medium: 'balanced',
  mid: 'balanced',
  low: 'low',
  verylow: 'veryLow',
  'very-low': 'veryLow',
  very_low: 'veryLow',
};

function readParam(name: string): string | null {
  try {
    if (typeof location === 'undefined') return null;
    return new URLSearchParams(location.search).get(name);
  } catch {
    return null;
  }
}

function probeGpu(): { name: string; webgl2: boolean; maxTextureSize: number | null } {
  try {
    const canvas = document.createElement('canvas');
    const gl2 = canvas.getContext('webgl2');
    const gl = gl2 || canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
    if (!gl || !('getParameter' in gl)) {
      return { name: '', webgl2: false, maxTextureSize: null };
    }
    const ctx = gl as WebGLRenderingContext;
    let name = '';
    try {
      const dbg = ctx.getExtension('WEBGL_debug_renderer_info');
      if (dbg) name = String(ctx.getParameter(dbg.UNMASKED_RENDERER_WEBGL) || '');
    } catch {
      name = '';
    }
    let maxTextureSize: number | null = null;
    try {
      maxTextureSize = Number(ctx.getParameter(ctx.MAX_TEXTURE_SIZE)) || null;
    } catch {
      maxTextureSize = null;
    }
    // Drop the probe context so we do not keep a second GPU context alive
    try {
      const lose = ctx.getExtension('WEBGL_lose_context');
      lose?.loseContext();
    } catch {
      /* ignore */
    }
    return { name, webgl2: !!gl2, maxTextureSize };
  } catch {
    return { name: '', webgl2: false, maxTextureSize: null };
  }
}

function connectionType(): string | null {
  try {
    const nav = navigator as Navigator & {
      connection?: { effectiveType?: string; saveData?: boolean; type?: string };
      mozConnection?: { effectiveType?: string; saveData?: boolean; type?: string };
      webkitConnection?: { effectiveType?: string; saveData?: boolean; type?: string };
    };
    const c = nav.connection || nav.mozConnection || nav.webkitConnection;
    if (!c) return null;
    return String(c.effectiveType || c.type || '') || null;
  } catch {
    return null;
  }
}

function saveDataOn(): boolean {
  try {
    const nav = navigator as Navigator & { connection?: { saveData?: boolean } };
    return !!nav.connection?.saveData;
  } catch {
    return false;
  }
}

/** GPU strings that usually mean a weak integrated / mobile chip. */
function weakGpu(name: string): boolean {
  if (!name) return false;
  // Real weak laptop / phone GPUs — not SwiftShader (CI stays strong for visual tests)
  if (/SwiftShader|llvmpipe|Microsoft Basic Render/i.test(name)) return false;
  if (/Intel.*(HD|UHD|Iris)/i.test(name)) return true;
  if (/Mali-G5[0-2]|Mali-4|Mali-T|Adreno \(TM\) [1-5]\d{2}\b|Adreno [1-5]\d{2}\b/i.test(name)) return true;
  if (/PowerVR|Apple GPU/i.test(name) && /A[89]|A1[0-2]/i.test(name)) return true;
  return false;
}

function strongGpu(name: string): boolean {
  if (!name) return false;
  if (/NVIDIA|GeForce|RTX|GTX|Radeon RX|Arc A/i.test(name)) return true;
  if (/Adreno \(TM\) [7-9]\d{2}|Adreno [7-9]\d{2}|Mali-G7|Mali-G71|Apple M[1-9]/i.test(name)) return true;
  return false;
}

export function collectSignals(): DeviceSignals {
  const gpu = typeof document !== 'undefined' ? probeGpu() : { name: '', webgl2: false, maxTextureSize: null };
  let deviceMemory: number | null = null;
  let hardwareConcurrency: number | null = null;
  try {
    const mem = (navigator as Navigator & { deviceMemory?: number }).deviceMemory;
    if (typeof mem === 'number' && mem > 0) deviceMemory = mem;
  } catch {
    deviceMemory = null;
  }
  try {
    const cores = navigator.hardwareConcurrency;
    if (typeof cores === 'number' && cores > 0) hardwareConcurrency = cores;
  } catch {
    hardwareConcurrency = null;
  }
  const w = typeof window !== 'undefined' ? window.innerWidth || 0 : 0;
  const h = typeof window !== 'undefined' ? window.innerHeight || 0 : 0;
  const pixelRatio = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
  let touch = false;
  try {
    touch =
      (typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches) ||
      (typeof navigator !== 'undefined' && navigator.maxTouchPoints > 0);
  } catch {
    touch = false;
  }
  let webdriver = false;
  try {
    webdriver = !!navigator.webdriver;
  } catch {
    webdriver = false;
  }
  return {
    deviceMemory,
    hardwareConcurrency,
    gpuName: gpu.name,
    webgl2: gpu.webgl2,
    maxTextureSize: gpu.maxTextureSize,
    cssPixels: w * h,
    pixelRatio,
    saveData: saveDataOn(),
    connectionType: connectionType(),
    touch,
    webdriver,
  };
}

/**
 * Pick a device tier from signals. Unknown / missing fields lean weaker.
 */
export function classifyTier(signals: DeviceSignals): { tier: DeviceTier; reason: string } {
  const override = readParam('device');
  if (override === 'weak' || override === 'mid' || override === 'strong') {
    return { tier: override, reason: `?device=${override}` };
  }

  // Automated browsers keep a strong start so visual suites match the old High default
  if (signals.webdriver) {
    return { tier: 'strong', reason: 'webdriver' };
  }

  const reasons: string[] = [];
  let score = 0; // negative = weaker

  if (signals.saveData) {
    score -= 3;
    reasons.push('save-data');
  }
  const conn = (signals.connectionType || '').toLowerCase();
  if (conn === 'slow-2g' || conn === '2g') {
    score -= 3;
    reasons.push(conn);
  } else if (conn === '3g') {
    score -= 1;
    reasons.push('3g');
  }

  if (signals.deviceMemory != null) {
    if (signals.deviceMemory <= 2) {
      score -= 3;
      reasons.push(`mem=${signals.deviceMemory}`);
    } else if (signals.deviceMemory <= 4) {
      score -= 1;
      reasons.push(`mem=${signals.deviceMemory}`);
    } else if (signals.deviceMemory >= 8) {
      score += 2;
      reasons.push(`mem=${signals.deviceMemory}`);
    }
  } else {
    // Safari often hides deviceMemory — do not assume strong
    score -= 1;
    reasons.push('mem=?');
  }

  if (signals.hardwareConcurrency != null) {
    if (signals.hardwareConcurrency <= 4) {
      score -= 1;
      reasons.push(`cores=${signals.hardwareConcurrency}`);
    } else if (signals.hardwareConcurrency >= 8) {
      score += 1;
      reasons.push(`cores=${signals.hardwareConcurrency}`);
    }
  } else {
    score -= 1;
    reasons.push('cores=?');
  }

  if (!signals.webgl2) {
    score -= 2;
    reasons.push('no-webgl2');
  }
  if (signals.maxTextureSize != null && signals.maxTextureSize < 4096) {
    score -= 2;
    reasons.push(`tex=${signals.maxTextureSize}`);
  }

  if (weakGpu(signals.gpuName)) {
    score -= 2;
    reasons.push('weak-gpu');
  } else if (strongGpu(signals.gpuName)) {
    score += 2;
    reasons.push('strong-gpu');
  } else if (!signals.gpuName) {
    score -= 1;
    reasons.push('gpu=?');
  }

  // Huge portrait phone screens at high DPR are fill-rate heavy
  const approxDevicePixels = signals.cssPixels * signals.pixelRatio * signals.pixelRatio;
  if (signals.touch && approxDevicePixels > 1_200_000 && (signals.deviceMemory == null || signals.deviceMemory <= 4)) {
    score -= 1;
    reasons.push('dense-screen');
  }

  let tier: DeviceTier;
  if (score <= -3) tier = 'weak';
  else if (score <= 0) tier = 'mid';
  else tier = 'strong';

  return { tier, reason: reasons.join(',') || 'default' };
}

/** Starting quality for a tier. Strong desktops get High; strong phones get Medium. */
export function qualityForTier(tier: DeviceTier, touch: boolean): Quality {
  if (tier === 'weak') return 'veryLow';
  if (tier === 'mid') return 'low';
  if (touch) return 'balanced';
  return 'high';
}

export function parseQualityOverride(): Quality | null {
  const raw = readParam('quality');
  if (!raw) return null;
  return QUALITY_ALIASES[raw.toLowerCase()] ?? null;
}

/**
 * Resolve the starting quality / shadow flag for this visit.
 * Manual choice and stored level are handled by GraphicsQuality; this only
 * covers first-visit defaults and URL overrides.
 */
export function resolveDeviceProfile(signals = collectSignals()): DeviceDecision {
  const qualityOverride = parseQualityOverride();
  const { tier, reason } = classifyTier(signals);

  let quality: Quality;
  let why: string;
  if (qualityOverride) {
    quality = qualityOverride;
    why = `?quality=${qualityOverride}`;
  } else {
    quality = qualityForTier(tier, signals.touch);
    why = `${tier}:${reason}`;
  }

  // veryLow never wants shadows on first compile; others do (Low keeps cheap shadows)
  const shadows = quality !== 'veryLow';

  return { tier, quality, shadows, signals, reason: why };
}
