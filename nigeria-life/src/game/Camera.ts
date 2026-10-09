import * as THREE from 'three';
import { Player } from '../player/Player';
import { RENDER_LAYERS } from '../interiors/InteriorTypes';

export type CameraMode = 'street' | 'interior' | 'home' | 'map' | 'photo';
export type CameraPreset = 'close' | 'street' | 'isometric' | 'aerial';

const STREET_FOV = 55;
/** A narrower lens flattens perspective, so a room reads as a model you look into */
const INTERIOR_FOV = 40;
const INTERIOR_YAW = 0.62;
const INTERIOR_PITCH = 0.86;
/** How far the view drifts from the room centre toward the player (0 = fixed room view, 1 = follows the player) */
const INTERIOR_FOLLOW = 0.55;

export class GameCamera {
  public camera: THREE.PerspectiveCamera;
  public mode: CameraMode = 'street';
  public previousMode: CameraMode = 'street';

  // Street mode spherical coordinates
  public yaw: number = 0;              // Horizontal azimuth around player (radians)
  public pitch: number = 0.44;          // Vertical elevation angle (~25 deg)
  public distance: number = 8.5;        // Distance to target (m)

  // Interior mode: a cutaway "diorama" view of the whole room from above one corner
  public interiorYaw: number = INTERIOR_YAW;
  public interiorPitch: number = INTERIOR_PITCH;
  public interiorDistance: number = 30;
  /** Distance at which the current room is comfortably framed; zoom limits scale from it */
  private roomFrameDistance: number = 30;
  private roomCenter: THREE.Vector3 | null = null;
  private roomRadius: number = 15;

  // Photo mode parameters
  public photoYaw: number = 0;
  public photoPitch: number = 0.35;
  public photoDistance: number = 6.5;
  public photoHeight: number = 1.35;
  public photoFov: number = 55;

  public offset: THREE.Vector3 = new THREE.Vector3(0, 3.8, 7.8);
  public interiorOffset: THREE.Vector3 = new THREE.Vector3(0, 8.5, 9.5);
  private currentLookAt: THREE.Vector3 = new THREE.Vector3();
  public collisionObjects: THREE.Object3D[] = [];
  private collisionRaycaster: THREE.Raycaster = new THREE.Raycaster();

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
    if (mode !== 'photo') {
      this.setFov(mode === 'interior' ? INTERIOR_FOV : STREET_FOV);
    }
  }

  private setFov(fov: number): void {
    if (this.camera.fov === fov) return;
    this.camera.fov = fov;
    this.camera.updateProjectionMatrix();
  }

  /**
   * Point the interior camera at a room: it looks down into it from a front corner,
   * far enough back that most of the floor is in view on the current screen shape.
   */
  public frameRoom(center: THREE.Vector3, width: number, length: number): void {
    this.roomCenter = center.clone();
    this.roomRadius = 0.5 * Math.hypot(width, length);
    this.roomFrameDistance = this.computeRoomFrameDistance();
    this.interiorDistance = this.roomFrameDistance;
    this.interiorYaw = INTERIOR_YAW;
    this.interiorPitch = INTERIOR_PITCH;
    this.currentPreset = 'street';
  }

  private computeRoomFrameDistance(): number {
    const halfFov = THREE.MathUtils.degToRad(INTERIOR_FOV / 2);
    // Wide screens are limited by height, tall phone screens by width
    const fitWidth = this.roomRadius / (Math.tan(halfFov) * this.camera.aspect);
    return Math.max(this.roomRadius * 1.75, fitWidth * 1.05);
  }

  /** The point the interior camera looks at: the room centre, pulled part of the way toward the player. */
  private interiorFocus(player: Player): THREE.Vector3 {
    const focus = new THREE.Vector3(player.position.x, 1.0, player.position.z);
    if (this.roomCenter) {
      focus.set(
        THREE.MathUtils.lerp(this.roomCenter.x, player.position.x, INTERIOR_FOLLOW),
        1.0,
        THREE.MathUtils.lerp(this.roomCenter.z, player.position.z, INTERIOR_FOLLOW)
      );
    }
    return focus;
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
      // Never low enough to look through the walls from the side
      this.interiorPitch = Math.max(0.5, Math.min(1.35, this.interiorPitch + deltaPitch));
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
      const min = this.roomFrameDistance * 0.4;
      const max = this.roomFrameDistance * 1.6;
      this.interiorDistance = Math.max(min, Math.min(max, this.interiorDistance + deltaDistance * 3));
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
        this.interiorPitch = 0.62;
        this.interiorDistance = this.roomFrameDistance * 0.55;
      } else if (preset === 'street') {
        this.interiorPitch = INTERIOR_PITCH;
        this.interiorDistance = this.roomFrameDistance;
      } else if (preset === 'isometric') {
        this.interiorPitch = 1.05;
        this.interiorDistance = this.roomFrameDistance * 1.25;
      } else if (preset === 'aerial') {
        this.interiorPitch = 1.35;
        this.interiorDistance = this.roomFrameDistance * 1.5;
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
      this.interiorYaw = INTERIOR_YAW;
      this.interiorPitch = INTERIOR_PITCH;
      this.interiorDistance = this.roomFrameDistance;
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
      const focus = this.interiorFocus(player);
      this.camera.position.copy(focus).add(this.computeOffset());
      this.currentLookAt.copy(focus);
      this.camera.lookAt(this.currentLookAt);
    } else if (currentMode === 'street') {
      const offset = this.computeOffset();
      const targetPos = new THREE.Vector3().copy(player.position).add(offset);
      this.camera.position.copy(targetPos);
      this.currentLookAt.set(player.position.x, player.position.y + 1.6, player.position.z);
      this.camera.lookAt(this.currentLookAt);
    }
  }

  public enterPhotoMode(): void {
    this.previousMode = this.mode;
    this.mode = 'photo';
    this.photoYaw = this.yaw;
    this.photoPitch = Math.max(0.12, Math.min(0.85, this.pitch));
    this.photoDistance = 6.2;
    this.photoHeight = 1.35;
    this.setPhotoFov(55);
  }

  public exitPhotoMode(): void {
    this.mode = this.previousMode || 'street';
    this.setPhotoFov(this.mode === 'interior' ? INTERIOR_FOV : STREET_FOV);
  }

  public setPhotoFov(fov: number): void {
    this.photoFov = fov;
    this.camera.fov = fov;
    this.camera.updateProjectionMatrix();
  }

  public update(player: Player, delta: number): void {
    const lerpFactor = Math.min(delta * 9.0, 1);

    if (this.mode === 'photo') {
      const x = Math.sin(this.photoYaw) * Math.cos(this.photoPitch) * this.photoDistance;
      const y = Math.sin(this.photoPitch) * this.photoDistance + this.photoHeight;
      const z = Math.cos(this.photoYaw) * Math.cos(this.photoPitch) * this.photoDistance;
      const targetCameraPos = new THREE.Vector3().copy(player.position).add(new THREE.Vector3(x, y, z));

      this.camera.position.lerp(targetCameraPos, lerpFactor * 1.5);

      const targetLookAt = new THREE.Vector3(
        player.position.x,
        player.position.y + this.photoHeight,
        player.position.z
      );
      this.currentLookAt.lerp(targetLookAt, lerpFactor * 1.5);
      this.camera.lookAt(this.currentLookAt);
      return;
    }

    if (this.mode === 'interior') {
      // Room diorama: the camera stays above a corner and drifts gently as the player walks
      const focus = this.interiorFocus(player);
      const roomLerp = Math.min(delta * 4.0, 1);
      this.currentLookAt.lerp(focus, roomLerp);
      this.camera.position.lerp(focus.clone().add(this.computeOffset()), roomLerp);
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

    // Vehicle driving chase camera
    if (player.isDriving && player.currentVehicle) {
      const vehPos = player.currentVehicle.mesh.position;
      const vehRot = player.currentVehicle.mesh.rotation.y;
      const chaseDistance = 11.5;
      const chaseHeight = 4.5;
      const behindX = vehPos.x - Math.sin(vehRot) * chaseDistance;
      const behindZ = vehPos.z - Math.cos(vehRot) * chaseDistance;
      const targetCameraPos = new THREE.Vector3(behindX, vehPos.y + chaseHeight, behindZ);

      const vehLerp = Math.min(delta * 8.0, 1);
      this.camera.position.lerp(targetCameraPos, vehLerp);

      const targetLookAt = new THREE.Vector3(vehPos.x, vehPos.y + 1.5, vehPos.z);
      this.currentLookAt.lerp(targetLookAt, vehLerp);
      this.camera.lookAt(this.currentLookAt);
      return;
    }

    // Default 'street' mode: rotatable framing centered on player
    const offset = this.computeOffset();
    const lookHeight = this.currentPreset === 'close' ? 1.35 : this.currentPreset === 'isometric' ? 0.9 : 1.6;
    const origin = new THREE.Vector3(player.position.x, player.position.y + lookHeight, player.position.z);

    // Collision avoidance against city buildings & obstacles
    let actualOffset = offset;
    if (this.collisionObjects.length > 0) {
      const rayDir = offset.clone().normalize();
      const maxDist = offset.length();
      this.collisionRaycaster.set(origin, rayDir);
      this.collisionRaycaster.far = maxDist;
      const hits = this.collisionRaycaster.intersectObjects(this.collisionObjects, true);
      if (hits.length > 0 && hits[0].distance < maxDist) {
        const clampedDist = Math.max(2.4, hits[0].distance - 0.5);
        actualOffset = rayDir.multiplyScalar(clampedDist);
      }
    }

    const targetCameraPos = new THREE.Vector3().copy(player.position).add(actualOffset);
    this.camera.position.lerp(targetCameraPos, lerpFactor);

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

    // Keep the same zoom relative to the room when the screen shape changes
    const zoom = this.interiorDistance / this.roomFrameDistance;
    this.roomFrameDistance = this.computeRoomFrameDistance();
    this.interiorDistance = this.roomFrameDistance * zoom;
  }
}
