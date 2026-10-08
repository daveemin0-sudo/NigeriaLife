import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';

export interface AssetLoadProgress {
  loaded: number;
  total: number;
  url: string;
}

export type ProgressCallback = (progress: AssetLoadProgress) => void;

/**
 * High-performance GLTF/GLB Asset Pipeline for Nigeria Life V2.
 * Provides asynchronous downloading, caching, cloning with proper skinned mesh bone binding,
 * loading progress reporting, and zero-crash procedural fallbacks.
 */
export class AssetManager {
  private static instance: AssetManager;
  private loader: GLTFLoader;
  private cache: Map<string, any> = new Map();
  private pendingLoads: Map<string, Promise<any>> = new Map();
  private failedAssets: Set<string> = new Set();

  private totalQueueCount = 0;
  private loadedQueueCount = 0;
  private progressListeners: Set<(pct: number, status: string) => void> = new Set();

  private constructor() {
    this.loader = new GLTFLoader();
  }

  public static getInstance(): AssetManager {
    if (!AssetManager.instance) {
      AssetManager.instance = new AssetManager();
    }
    return AssetManager.instance;
  }

  /**
   * Subscribe to global queue loading progress.
   */
  public onProgress(callback: (pct: number, status: string) => void): () => void {
    this.progressListeners.add(callback);
    return () => this.progressListeners.delete(callback);
  }

  private notifyProgress(status: string): void {
    const pct = this.totalQueueCount > 0 ? (this.loadedQueueCount / this.totalQueueCount) * 100 : 100;
    this.progressListeners.forEach((cb) => cb(pct, status));
  }

  /**
   * Loads a GLTF/GLB file from URL or public path.
   * Cached automatically.
   */
  public async loadGLTF(url: string, onProgress?: ProgressCallback): Promise<any | null> {
    if (this.cache.has(url)) {
      return this.cache.get(url);
    }

    if (this.failedAssets.has(url)) {
      return null;
    }

    if (this.pendingLoads.has(url)) {
      return this.pendingLoads.get(url)!;
    }

    this.totalQueueCount++;
    this.notifyProgress(`Fetching ${url}...`);

    const loadPromise = new Promise<any | null>((resolve) => {
      this.loader.load(
        url,
        (gltf) => {
          // Optimize materials and shadows
          gltf.scene.traverse((node: any) => {
            if (node.isMesh) {
              node.castShadow = true;
              node.receiveShadow = true;
              if (node.material) {
                // Ensure correct color space for textures
                if (node.material.map) {
                  node.material.map.colorSpace = THREE.SRGBColorSpace;
                }
              }
            }
          });

          this.cache.set(url, gltf);
          this.pendingLoads.delete(url);
          this.loadedQueueCount++;
          this.notifyProgress(`Loaded ${url}`);
          resolve(gltf);
        },
        (event) => {
          if (onProgress && event.total > 0) {
            onProgress({
              loaded: event.loaded,
              total: event.total,
              url,
            });
          }
        },
        (error) => {
          console.warn(`[AssetManager] GLB asset not found or failed to parse: "${url}". Falling back to procedural model.`, error);
          this.failedAssets.add(url);
          this.pendingLoads.delete(url);
          this.loadedQueueCount++;
          this.notifyProgress(`Fallback for ${url}`);
          resolve(null);
        }
      );
    });

    this.pendingLoads.set(url, loadPromise);
    return loadPromise;
  }

  /**
   * Instantiates a clone of the model.
   * If the model has bones/skinned meshes, uses SkeletonUtils.clone to ensure animations work.
   */
  public async instantiate(url: string): Promise<THREE.Group | null> {
    const gltf = await this.loadGLTF(url);
    if (!gltf || !gltf.scene) {
      return null;
    }

    // SkeletonUtils ensures bone hierarchies and SkinnedMeshes are cloned with their bindings intact
    const clone = SkeletonUtils.clone(gltf.scene) as THREE.Group;
    
    // Attach original animations reference to userData for easy AnimationMixer access
    if (gltf.animations && gltf.animations.length > 0) {
      clone.userData.animations = gltf.animations;
    }

    return clone;
  }

  /**
   * Attempts to load and instantiate a GLB model; if unavailable, uses the procedural fallback builder.
   * Never throws or halts runtime.
   */
  public async instantiateWithFallback<T extends THREE.Object3D>(
    url: string,
    fallbackFactory: () => T
  ): Promise<THREE.Object3D> {
    const glbInstance = await this.instantiate(url);
    if (glbInstance) {
      return glbInstance;
    }
    return fallbackFactory();
  }

  /**
   * Preload a list of assets in parallel.
   */
  public async preload(urls: string[]): Promise<void> {
    await Promise.all(urls.map((url) => this.loadGLTF(url)));
  }

  /**
   * Clear cache if needed (e.g. city transition).
   */
  public clearCache(): void {
    this.cache.clear();
    this.pendingLoads.clear();
    this.failedAssets.clear();
    this.totalQueueCount = 0;
    this.loadedQueueCount = 0;
  }
}
