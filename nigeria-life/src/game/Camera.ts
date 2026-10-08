import * as THREE from 'three';
import { Player } from '../player/Player';
import { RENDER_LAYERS } from '../interiors/InteriorTypes';

export type CameraMode = 'street' | 'interior' | 'home' | 'map';
export type CameraPreset = 'close' | 'street' | 'isometric' | 'aerial';

export class GameCamera {
  public camera: THREE.PerspectiveCamera;
  public mode: CameraMode = 'street';

  // Street mode spherical coordinates
  public yaw: number = 0;              // Horizontal azimuth around player (radians)
  public pitch: number = 0.44;          // Vertical elevation angle (~25 deg)
  public distance: number = 8.5;        // Distance to target (m)

  // Interior mode spherical coordinates
  public interiorYaw: number = 0;      // Starts facing into the room
  public interiorPitch: number = 0.58;  // Elevated isometric angle (~33 deg)
  public interiorDistance: number = 10.5; // Distance to target inside room (m)

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

  public getActiveYaw(): number {
    return this.mode === 'interior' ? this.interiorYaw : this.yaw;
  }

  /**
   * Rotate camera around the player horizontally (yaw) and vertically (pitch).
   */
  public rotate(deltaYaw: number, deltaPitch: number = 0): void {
    if (this.mode === 'interior') {
      this.interiorYaw += deltaYaw;
      while (this.interiorYaw > Math.PI) this.interiorYaw -= Math.PI * 2;
      while (this.interiorYaw < -Math.PI) this.interiorYaw += Math.PI * 2;
      this.interiorPitch = Math.max(0.18, Math.min(1.25, this.interiorPitch + deltaPitch));
    } else {
      this.yaw += deltaYaw;
      while (this.yaw > Math.PI) this.yaw -= Math.PI * 2;
      while (this.yaw < -Math.PI) this.yaw += Math.PI * 2;
      this.pitch = Math.max(0.12, Math.min(1.30, this.pitch + deltaPitch));
    }
  }

  /**
   * Zoom camera in or out smoothly.
   */
  public zoom(deltaDistance: number): void {
    if (this.mode === 'interior') {
      this.interiorDistance = Math.max(4.5, Math.min(18.0, this.interiorDistance + deltaDistance));
    } else {
      this.distance = Math.max(4.0, Math.min(22.0, this.distance + deltaDistance));
    }
  }

  public currentPreset: CameraPreset = 'street';

  /**
   * Set a specific camera framing preset.
   */
  public setPreset(preset: CameraPreset): void {
    this.currentPreset = preset;
    if (this.mode === 'interior') {
      if (preset === 'close') {
        this.interiorPitch = 0.32;
        this.interiorDistance = 6.2;
      } else if (preset === 'street') {
        this.interiorPitch = 0.58;
        this.interiorDistance = 10.5;
      } else if (preset === 'isometric') {
        this.interiorPitch = 0.88;
        this.interiorDistance = 14.5;
      } else if (preset === 'aerial') {
        this.interiorPitch = 1.20;
        this.interiorDistance = 18.5;
      }
    } else {
      if (preset === 'close') {
        // Close third-person: shoulder-level view, character prominent
        this.pitch = 0.22;
        this.distance = 5.2;
      } else if (preset === 'street') {
        // Standard street view
        this.pitch = 0.44;
        this.distance = 8.5;
      } else if (preset === 'isometric') {
        // High angle overview looking down at sidewalks and road lanes
        this.pitch = 0.82;
        this.distance = 15.0;
      } else if (preset === 'aerial') {
        // High city aerial view
        this.pitch = 1.18;
        this.distance = 26.0;
      }
    }
  }

  /**
   * Cycle through available camera presets (Close -> Street -> Isometric -> Aerial).
   */
  public cyclePreset(): CameraPreset {
    const presets: CameraPreset[] = ['close', 'street', 'isometric', 'aerial'];
    const idx = presets.indexOf(this.currentPreset);
    const next = presets[(idx + 1) % presets.length];
    this.setPreset(next);
    return next;
  }

  /**
   * Reset orientation to default perspective.
   */
  public resetOrientation(): void {
    if (this.mode === 'interior') {
      this.interiorYaw = 0;
      this.interiorPitch = 0.58;
    } else {
      this.yaw = 0;
      this.pitch = 0.44;
    }
  }

  /**
   * Calculate 3D spherical offset vector relative to the player.
   */
  public computeOffset(): THREE.Vector3 {
    if (this.mode === 'interior') {
      const x = Math.sin(this.interiorYaw) * Math.cos(this.interiorPitch) * this.interiorDistance;
      const y = Math.sin(this.interiorPitch) * this.interiorDistance;
      const z = Math.cos(this.interiorYaw) * Math.cos(this.interiorPitch) * this.interiorDistance;
      return new THREE.Vector3(x, y, z);
    } else {
      const x = Math.sin(this.yaw) * Math.cos(this.pitch) * this.distance;
      const y = Math.sin(this.pitch) * this.distance + 0.6;
      const z = Math.cos(this.yaw) * Math.cos(this.pitch) * this.distance;
      return new THREE.Vector3(x, y, z);
    }
  }

  public snapToPlayer(player: Player, targetMode?: CameraMode): void {
    const currentMode = targetMode ?? this.mode;
    if (currentMode === 'interior') {
      const offset = this.computeOffset();
      const targetPos = new THREE.Vector3().copy(player.position).add(offset);
      this.camera.position.copy(targetPos);
      this.currentLookAt.set(player.position.x, player.position.y + 1.2, player.position.z);
      this.camera.lookAt(this.currentLookAt);
    } else if (currentMode === 'street') {
      const offset = this.computeOffset();
      const targetPos = new THREE.Vector3().copy(player.position).add(offset);
      this.camera.position.copy(targetPos);
      this.currentLookAt.set(player.position.x, player.position.y + 1.6, player.position.z);
      this.camera.lookAt(this.currentLookAt);
    }
  }

  public update(player: Player, delta: number): void {
    const lerpFactor = Math.min(delta * 9.0, 1);

    if (this.mode === 'interior') {
      // Dynamic indoor rotatable camera
      const offset = this.computeOffset();
      const targetCameraPos = new THREE.Vector3()
        .copy(player.position)
        .add(offset);

      this.camera.position.lerp(targetCameraPos, lerpFactor);

      const targetLookAt = new THREE.Vector3(
        player.position.x,
        player.position.y + 1.2,
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

    // Default 'street' mode: rotatable framing centered on player
    const offset = this.computeOffset();
    const targetCameraPos = new THREE.Vector3()
      .copy(player.position)
      .add(offset);

    this.camera.position.lerp(targetCameraPos, lerpFactor);

    const lookHeight = this.currentPreset === 'close' ? 1.35 : this.currentPreset === 'isometric' ? 0.9 : 1.6;
    const targetLookAt = new THREE.Vector3(
      player.position.x,
      player.position.y + lookHeight,
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
