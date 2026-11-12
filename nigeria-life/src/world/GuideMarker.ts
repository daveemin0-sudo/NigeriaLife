import * as THREE from 'three';

/**
 * The guide's marker: a gold chevron that bobs over the head of the person (or the door) the
 * first-five-minutes guide is about. One small unlit mesh, no shadow; when there is nothing to
 * point at it is hidden and costs nothing.
 */
export class GuideMarker {
  public readonly mesh: THREE.Mesh;
  private target: (() => THREE.Vector3 | null) | null = null;
  private time = 0;

  constructor(scene: THREE.Scene) {
    const shape = new THREE.ConeGeometry(0.32, 0.6, 4, 1);
    shape.rotateX(Math.PI);
    this.mesh = new THREE.Mesh(shape, new THREE.MeshBasicMaterial({ color: 0xf5b301, transparent: true, opacity: 0.95, depthWrite: false }));
    this.mesh.name = 'guide-marker';
    this.mesh.visible = false;
    this.mesh.renderOrder = 10;
    this.mesh.castShadow = false;
    this.mesh.receiveShadow = false;
    this.mesh.frustumCulled = false;
    scene.add(this.mesh);
  }

  /** Over this point from now on (read every frame, so it follows someone who walks), or nowhere */
  public point(target: (() => THREE.Vector3 | null) | null): void {
    this.target = target;
    if (!target) this.mesh.visible = false;
  }

  public update(delta: number, playerAt: THREE.Vector3, hidden: boolean): void {
    if (!this.target) return;
    const at = this.target();
    // Not while indoors or at the wheel, and not once the player is standing beside it
    if (!at || hidden || Math.hypot(at.x - playerAt.x, at.z - playerAt.z) < 2.2) {
      this.mesh.visible = false;
      return;
    }
    this.time += delta;
    this.mesh.visible = true;
    this.mesh.position.set(at.x, at.y + 2.75 + Math.sin(this.time * 3) * 0.12, at.z);
    this.mesh.rotation.y += delta * 1.6;
  }
}
