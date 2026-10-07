import * as THREE from 'three';
import { Player } from '../player/Player';

export type CameraMode = 'street' | 'home' | 'map';

export class GameCamera {
  public camera: THREE.PerspectiveCamera;
  public mode: CameraMode = 'street';
  public offset: THREE.Vector3 = new THREE.Vector3(0, 5.8, 11.5);
  private currentLookAt: THREE.Vector3 = new THREE.Vector3();

  // Mode camera targets
  private homeCamPos: THREE.Vector3 = new THREE.Vector3(16, 22, 198);
  private homeLookAt: THREE.Vector3 = new THREE.Vector3(0, 1.5, 180);

  private mapCamPos: THREE.Vector3 = new THREE.Vector3(0, 120, 50);
  private mapLookAt: THREE.Vector3 = new THREE.Vector3(0, 0, 10);

  constructor() {
    this.camera = new THREE.PerspectiveCamera(
      54,
      window.innerWidth / window.innerHeight,
      0.1,
      1000
    );
    this.camera.position.set(0, 6, 12);
  }

  public setMode(mode: CameraMode): void {
    this.mode = mode;
  }

  public update(player: Player, delta: number): void {
    const lerpFactor = Math.min(delta * 4.2, 1);

    if (this.mode === 'home') {
      this.camera.position.lerp(this.homeCamPos, lerpFactor);
      this.currentLookAt.lerp(this.homeLookAt, lerpFactor);
      this.camera.lookAt(this.currentLookAt);
      return;
    }

    if (this.mode === 'map') {
      this.camera.position.lerp(this.mapCamPos, lerpFactor);
      this.currentLookAt.lerp(this.mapLookAt, lerpFactor);
      this.camera.lookAt(this.currentLookAt);
      return;
    }

    // Default 'street' mode: cinematic third-person view showing player, street & vibrant horizon
    const targetCameraPos = new THREE.Vector3()
      .copy(player.position)
      .add(this.offset);

    this.camera.position.lerp(targetCameraPos, lerpFactor);

    const targetLookAt = new THREE.Vector3(
      player.position.x,
      2.0,
      player.position.z - 3.5
    );
    this.currentLookAt.lerp(targetLookAt, lerpFactor);
    this.camera.lookAt(this.currentLookAt);
  }

  public handleResize(): void {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
  }
}
