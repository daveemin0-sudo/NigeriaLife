import * as THREE from 'three';
import { Player } from '../player/Player';

export class GameCamera {
  public camera: THREE.PerspectiveCamera;
  public offset: THREE.Vector3 = new THREE.Vector3(0, 10, 13);
  private currentLookAt: THREE.Vector3 = new THREE.Vector3();

  constructor() {
    this.camera = new THREE.PerspectiveCamera(
      55,
      window.innerWidth / window.innerHeight,
      0.1,
      1000
    );
    this.camera.position.set(0, 10, 13);
  }

  public update(player: Player, delta: number): void {
    // Target position of the camera behind and above the player
    const targetCameraPos = new THREE.Vector3()
      .copy(player.position)
      .add(this.offset);

    // Smooth lerp camera position
    const lerpFactor = Math.min(delta * 4.5, 1);
    this.camera.position.lerp(targetCameraPos, lerpFactor);

    // Smooth camera look target (focused slightly above player center)
    const targetLookAt = new THREE.Vector3(
      player.position.x,
      1.2,
      player.position.z
    );
    this.currentLookAt.lerp(targetLookAt, lerpFactor);
    this.camera.lookAt(this.currentLookAt);
  }

  public handleResize(): void {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
  }
}
