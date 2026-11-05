import * as THREE from 'three';

/**
 * Pictures of furniture for the catalogue: each piece is built, lit and drawn once from above a
 * front corner by a small renderer of its own, and the picture is kept. Pictures are drawn a few
 * at a time between frames, so opening the catalogue never stalls the game.
 */
export class FurnitureThumbs {
  private static readonly SIZE = 192;
  private static renderer: THREE.WebGLRenderer | null = null;
  private static scene: THREE.Scene | null = null;
  private static camera: THREE.PerspectiveCamera | null = null;
  private static readonly done = new Map<string, string>();
  private static readonly waiting: Array<{ modelType: string; img: HTMLImageElement }> = [];
  private static pumping = false;
  /** Builds a piece by its model type (set by whoever owns the furniture) */
  public static build: ((modelType: string) => THREE.Object3D) | null = null;

  /** Shows the picture of this piece in `img`, now if it has been drawn, or as soon as it is */
  public static show(modelType: string, img: HTMLImageElement): void {
    const ready = this.done.get(modelType);
    if (ready) {
      img.src = ready;
      return;
    }
    this.waiting.push({ modelType, img });
    if (!this.pumping) {
      this.pumping = true;
      requestAnimationFrame(() => this.pump());
    }
  }

  private static setUp(): boolean {
    if (this.renderer) return true;
    try {
      const canvas = document.createElement('canvas');
      canvas.width = canvas.height = this.SIZE;
      this.renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, preserveDrawingBuffer: true });
      this.renderer.setPixelRatio(1);
      this.renderer.setSize(this.SIZE, this.SIZE, false);
      this.renderer.outputColorSpace = THREE.SRGBColorSpace;
      this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
      this.renderer.toneMappingExposure = 1.15;
      this.scene = new THREE.Scene();
      this.scene.add(new THREE.HemisphereLight(0xffffff, 0x8a7d6b, 1.6));
      const sun = new THREE.DirectionalLight(0xffffff, 2.2);
      sun.position.set(3, 6, 4);
      this.scene.add(sun);
      this.camera = new THREE.PerspectiveCamera(30, 1, 0.05, 100);
      return true;
    } catch {
      return false;
    }
  }

  private static pump(): void {
    if (!this.setUp() || !this.build) {
      this.pumping = false;
      return;
    }
    const started = performance.now();
    // A few each frame, and never more than a few milliseconds' work
    while (this.waiting.length > 0 && performance.now() - started < 8) {
      const { modelType, img } = this.waiting.shift()!;
      if (!img.isConnected) continue;
      let url = this.done.get(modelType);
      if (!url) {
        url = this.draw(modelType) ?? undefined;
        if (url) this.done.set(modelType, url);
      }
      if (url) img.src = url;
    }
    if (this.waiting.length > 0) requestAnimationFrame(() => this.pump());
    else this.pumping = false;
  }

  private static draw(modelType: string): string | null {
    const renderer = this.renderer!;
    const scene = this.scene!;
    const camera = this.camera!;
    let piece: THREE.Object3D;
    try {
      piece = this.build!(modelType);
    } catch {
      return null;
    }
    piece.traverse((child) => child.layers.set(0));
    piece.position.set(0, 0, 0);
    piece.rotation.set(0, 0, 0);
    scene.add(piece);
    const box = new THREE.Box3().setFromObject(piece);
    const centre = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    const radius = Math.max(0.3, size.length() / 2);
    // From above its front-right corner, far enough to see all of it
    const distance = radius / Math.sin(THREE.MathUtils.degToRad(camera.fov / 2)) * 1.02;
    const dir = new THREE.Vector3(0.75, 0.62, 1).normalize();
    camera.position.copy(centre).addScaledVector(dir, distance);
    camera.lookAt(centre);
    camera.near = distance / 50;
    camera.far = distance * 4;
    camera.updateProjectionMatrix();
    renderer.setClearColor(0x000000, 0);
    renderer.render(scene, camera);
    const url = renderer.domElement.toDataURL('image/png');
    scene.remove(piece);
    // Its geometry was made for this picture; materials may be shared with the room, so they stay
    piece.traverse((child) => (child as THREE.Mesh).geometry?.dispose());
    return url;
  }
}
