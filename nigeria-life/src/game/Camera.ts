import * as THREE from 'three';
import { Player } from '../player/Player';
import { RENDER_LAYERS } from '../interiors/InteriorTypes';

export type CameraMode = 'street' | 'interior' | 'home' | 'map';

export class GameCamera {
  public camera: THREE.PerspectiveCamera;
  public mode: CameraMode = 'street';
  public offset: THREE.Vector3 = new THREE.Vector3(0, 3.8, 7.8);
  public interiorOffset: THREE.Vector3 = new THREE.Vector3(0, 8.5, 9.5);
  private currentLookAt: THREE.Vector3 = new THREE.Vector3();

  // Mode camera targets
  private homeCamPos: THREE.Vector3 = new THREE.Vector3(16, 22, 198);
  private homeLookAt: THREE.Vector3 = new THREE.Vector3(0, 1.5, 180);

  private mapCamPos: THREE.Vector3 = new THREE.Vector3(0, 120, 50);
  private mapLookAt: THREE.Vector3 = new THREE.Vector3(0, 0, 10);

  constructor() {
    this.camera = new THREE.PerspectiveCamera(
      55,
      window.innerWidth / window.innerHeight,
      0.1,
      300
    );
    this.camera.position.set(0, 3.8, 7.8);

    // Initial layer configuration: Default street setup
    this.camera.layers.enable(RENDER_LAYERS.DEFAULT);
    this.camera.layers.enable(RENDER_LAYERS.STREET);
    this.camera.layers.enable(RENDER_LAYERS.PLAYER);
    this.camera.layers.disable(RENDER_LAYERS.INTERIOR);
  }

  public setMode(mode: CameraMode): void {
    this.mode = mode;
  }

  public setLayerMode(mode: 'street' | 'interior' | 'map'): void {
    if (mode === 'interior') {
      this.camera.layers.disable(RENDER_LAYERS.STREET);
      this.camera.layers.enable(RENDER_LAYERS.INTERIOR);
      this.camera.layers.enable(RENDER_LAYERS.PLAYER);
    } else if (mode === 'street') {
      this.camera.layers.enable(RENDER_LAYERS.STREET);
      this.camera.layers.disable(RENDER_LAYERS.INTERIOR);
      this.camera.layers.enable(RENDER_LAYERS.PLAYER);
    } else if (mode === 'map') {
      this.camera.layers.enable(RENDER_LAYERS.DEFAULT);
    }
  }

  public snapToPlayer(player: Player, targetMode?: CameraMode): void {
    const currentMode = targetMode ?? this.mode;
    if (currentMode === 'interior') {
      const targetPos = new THREE.Vector3().copy(player.position).add(this.interiorOffset);
      this.camera.position.copy(targetPos);
      this.currentLookAt.set(player.position.x, 1.2, player.position.z);
      this.camera.lookAt(this.currentLookAt);
    } else if (currentMode === 'street') {
      const targetPos = new THREE.Vector3().copy(player.position).add(this.offset);
      this.camera.position.copy(targetPos);
      this.currentLookAt.set(player.position.x, 1.6, player.position.z);
      this.camera.lookAt(this.currentLookAt);
    }
  }

  public update(player: Player, delta: number): void {
    const lerpFactor = Math.min(delta * 8.0, 1);

    if (this.mode === 'interior') {
      // Dynamic indoor isometric follow camera
      const targetCameraPos = new THREE.Vector3()
        .copy(player.position)
        .add(this.interiorOffset);

      this.camera.position.lerp(targetCameraPos, lerpFactor);

      const targetLookAt = new THREE.Vector3(
        player.position.x,
        1.2,
        player.position.z
      );
      this.currentLookAt.lerp(targetLookAt, lerpFactor);
      this.camera.lookAt(this.currentLookAt);
      return;
    }

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

    // Default 'street' mode: reference framing centered on player at 7.8m distance
    const targetCameraPos = new THREE.Vector3()
      .copy(player.position)
      .add(this.offset);

    this.camera.position.lerp(targetCameraPos, lerpFactor);

    const targetLookAt = new THREE.Vector3(
      player.position.x,
      1.6,
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
