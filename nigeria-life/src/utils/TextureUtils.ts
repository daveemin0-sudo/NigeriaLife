import * as THREE from 'three';

/**
 * Utility functions for creating color and data textures in Three.js,
 * guaranteeing correct color space assignment for the ACES Filmic sRGB pipeline.
 */

/**
 * Creates a CanvasTexture configured for diffuse / base color maps.
 * Uses SRGBColorSpace so gamma and tone mapping are correctly evaluated.
 */
export function createColorCanvasTexture(
  canvas: HTMLCanvasElement,
  options?: {
    wrapS?: THREE.Wrapping;
    wrapT?: THREE.Wrapping;
    repeatX?: number;
    repeatY?: number;
    anisotropy?: number;
  }
): THREE.CanvasTexture {
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;

  if (options?.wrapS) texture.wrapS = options.wrapS;
  if (options?.wrapT) texture.wrapT = options.wrapT;
  if (options?.repeatX || options?.repeatY) {
    texture.repeat.set(options.repeatX ?? 1, options.repeatY ?? 1);
  }
  if (options?.anisotropy) {
    texture.anisotropy = options.anisotropy;
  }

  texture.needsUpdate = true;
  return texture;
}

/**
 * Creates a CanvasTexture configured for data maps (normals, roughness, metalness, bump).
 * Preserves linear numerical data without gamma correction.
 */
export function createDataCanvasTexture(
  canvas: HTMLCanvasElement,
  options?: {
    wrapS?: THREE.Wrapping;
    wrapT?: THREE.Wrapping;
    repeatX?: number;
    repeatY?: number;
  }
): THREE.CanvasTexture {
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.NoColorSpace;

  if (options?.wrapS) texture.wrapS = options.wrapS;
  if (options?.wrapT) texture.wrapT = options.wrapT;
  if (options?.repeatX || options?.repeatY) {
    texture.repeat.set(options.repeatX ?? 1, options.repeatY ?? 1);
  }

  texture.needsUpdate = true;
  return texture;
}

/**
 * Creates a soft radial glow particle texture for dust motes.
 */
export function createSoftCircleTexture(size: number = 64): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  const center = size / 2;
  const grad = ctx.createRadialGradient(center, center, 0, center, center, center);
  grad.addColorStop(0.0, 'rgba(255, 255, 255, 1.0)');
  grad.addColorStop(0.2, 'rgba(255, 240, 200, 0.85)');
  grad.addColorStop(0.55, 'rgba(255, 220, 160, 0.35)');
  grad.addColorStop(0.85, 'rgba(255, 200, 120, 0.08)');
  grad.addColorStop(1.0, 'rgba(255, 180, 100, 0.0)');

  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(center, center, center, 0, Math.PI * 2);
  ctx.fill();

  return createColorCanvasTexture(canvas);
}

/**
 * Creates a soft smoky cloud particle texture for exhaust & BBQ haze.
 */
export function createSmokeParticleTexture(size: number = 64): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  const center = size / 2;
  const grad = ctx.createRadialGradient(center, center, 0, center, center, center);
  grad.addColorStop(0.0, 'rgba(220, 225, 230, 0.7)');
  grad.addColorStop(0.3, 'rgba(180, 190, 200, 0.45)');
  grad.addColorStop(0.65, 'rgba(140, 150, 160, 0.18)');
  grad.addColorStop(1.0, 'rgba(100, 110, 120, 0.0)');

  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(center, center, center, 0, Math.PI * 2);
  ctx.fill();

  return createColorCanvasTexture(canvas);
}

/**
 * Creates an organic puddle mask texture with natural irregular water edge falloff.
 */
export function createPuddleTexture(size: number = 256): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  const cx = size / 2;
  const cy = size / 2;
  const baseRadius = size * 0.42;

  // Draw organic multi-lobed shape
  ctx.fillStyle = '#0f171c';
  ctx.beginPath();
  const numPoints = 24;
  for (let i = 0; i <= numPoints; i++) {
    const angle = (i / numPoints) * Math.PI * 2;
    // Multi-octave harmonic wobble for natural puddle boundary
    const wobble =
      Math.sin(angle * 3.0) * 0.12 +
      Math.sin(angle * 5.0 + 1.2) * 0.08 +
      Math.cos(angle * 7.0 + 0.4) * 0.05;
    const r = baseRadius * (1.0 + wobble);
    const px = cx + Math.cos(angle) * r;
    const py = cy + Math.sin(angle) * r;
    if (i === 0) {
      ctx.moveTo(px, py);
    } else {
      ctx.lineTo(px, py);
    }
  }
  ctx.closePath();
  ctx.fill();

  // Soft shoreline feathering / wet boundary blur
  ctx.lineWidth = 14;
  ctx.strokeStyle = 'rgba(25, 35, 42, 0.45)';
  ctx.stroke();

  return createColorCanvasTexture(canvas);
}

