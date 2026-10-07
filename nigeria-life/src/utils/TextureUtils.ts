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
