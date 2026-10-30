import * as THREE from 'three';
import { Player } from '../player/Player';
import { RENDER_LAYERS } from '../interiors/InteriorTypes';
import { DrivableVehicle } from '../world/DrivableVehicle';

export type CameraMode = 'street' | 'interior' | 'home' | 'map' | 'photo';
/** 'eye' is indoors only: at eye height behind the player, inside the walls */
export type CameraPreset = 'close' | 'street' | 'isometric' | 'aerial' | 'eye';

const STREET_FOV = 55;
/** A narrower lens flattens perspective, so a room reads as a model you look into */
const INTERIOR_FOV = 40;
/** Indoors at eye height the view is as wide as the eye's */
const EYE_FOV = 62;
const INTERIOR_YAW = 0.62;
const INTERIOR_PITCH = 0.86;
/** How far the view drifts from the room centre toward the player (0 = fixed room view, 1 = follows the player) */
const INTERIOR_FOLLOW = 0.55;
/** How far the room is raised on the screen, as a share of the camera distance, to clear the cards along the bottom */
const INTERIOR_SCREEN_LIFT = 0.12;
/** Seconds between checks for buildings between the street camera and the player */
const COLLISION_CHECK_EVERY = 0.08;

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
  /** 0 = whole-room view, 1 = moved in on the player (while they sit at a table, say) */
  private closeUp: number = 0;
  private closeUpTarget: number = 0;

  /**
   * The inside view: indoors at eye height, a step behind the player, looking where they look,
   * kept inside the walls of the room. Chosen with the camera button and kept from room to room.
   */
  public interiorEye = false;
  public eyeYaw = Math.PI;
  public eyePitch = 0.06;
  public eyeDistance = 2.4;
  private roomWidth = 20;
  private roomLength = 20;

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
  /** How far out the street camera may sit: what the last check found, and the eased value actually used */
  private collisionFound: number = Infinity;
  private collisionLimit: number = Infinity;
  private collisionTimer: number = 0;

  // Mode camera targets
  private homeCamPos: THREE.Vector3 = new THREE.Vector3(16, 22, 198);
  private homeLookAt: THREE.Vector3 = new THREE.Vector3(0, 1.5, 180);

  private mapCamPos: THREE.Vector3 = new THREE.Vector3(0, 120, 50);
  private mapLookAt: THREE.Vector3 = new THREE.Vector3(0, 0, 10);

  // Vehicle driving chase camera heading filter
  private cameraVehYaw: number = 0;
  private hasInitializedVehCam: boolean = false;

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

  /** Remembers the inside view from the last visit */
  public restoreInsideView(): void {
    try { this.interiorEye = localStorage.getItem('nl_inside_view_v1') === '1'; } catch { /* no storage */ }
  }

  public setMode(mode: CameraMode): void {
    this.mode = mode;
    if (mode !== 'photo') {
      this.setFov(mode === 'interior' ? (this.interiorEye ? EYE_FOV : INTERIOR_FOV) : STREET_FOV);
    }
  }

  /** Into or out of the inside view while indoors */
  public setInteriorEye(on: boolean): void {
    // Straight behind the player the moment it is chosen
    if (on && !this.interiorEye) this.eyeSnap = true;
    this.interiorEye = on;
    if (this.mode === 'interior') this.setFov(on ? EYE_FOV : INTERIOR_FOV);
    try { localStorage.setItem('nl_inside_view_v1', on ? '1' : '0'); } catch { /* no storage */ }
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
    this.roomWidth = width;
    this.roomLength = length;
    this.roomRadius = 0.5 * Math.hypot(width, length);
    this.roomFrameDistance = this.computeRoomFrameDistance();
    this.interiorDistance = this.roomFrameDistance;
    this.interiorYaw = INTERIOR_YAW;
    this.interiorPitch = INTERIOR_PITCH;
    this.currentPreset = this.interiorEye ? 'eye' : 'street';
    this.closeUp = 0;
    this.closeUpTarget = 0;
    // In through the door, facing into the room
    this.eyeYaw = Math.PI;
    this.eyeSnap = true;
  }

  private eyeSnap = false;

  /** Moves the room view in on the player, or back out to the whole room. */
  public setCloseUp(on: boolean): void {
    this.closeUpTarget = on ? 1 : 0;
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
      const follow = THREE.MathUtils.lerp(INTERIOR_FOLLOW, 0.95, this.closeUp);
      focus.set(
        THREE.MathUtils.lerp(this.roomCenter.x, player.position.x, follow),
        1.0,
        THREE.MathUtils.lerp(this.roomCenter.z, player.position.z, follow)
      );
      // Aim a little short of that, so the room sits above the cards along the bottom of the screen
      const lift = this.interiorDistance * THREE.MathUtils.lerp(1, 0.45, this.closeUp) * INTERIOR_SCREEN_LIFT;
      focus.x += Math.sin(this.interiorYaw) * lift;
      focus.z += Math.cos(this.interiorYaw) * lift;
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
    // The way the camera looks from: forward on the stick goes the way the view faces
    if (this.mode === 'interior' && this.interiorEye) return this.eyeYaw + Math.PI;
    return this.mode === 'interior' ? this.interiorYaw : this.yaw;
  }

  /**
   * Rotate camera around the player horizontally (yaw) and vertically (pitch).
   */
  /** Is there a wall at this point on the ground? (set by the game) The driving camera stays on this side of one */
  public blocked: ((x: number, z: number) => boolean) | null = null;
  private vehCamRoom = 11.2;

  public rotate(deltaYaw: number, deltaPitch: number = 0): void {
    if (this.mode === 'interior' && this.interiorEye) {
      this.eyeYaw += deltaYaw;
      this.eyeHeld = 1.2;
      this.eyePitch = Math.max(-0.35, Math.min(0.6, this.eyePitch + deltaPitch));
      return;
    }
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
    if (this.mode === 'interior' && this.interiorEye) {
      this.eyeDistance = Math.max(1.3, Math.min(4.5, this.eyeDistance + deltaDistance * 0.5));
      return;
    }
    if (this.mode === 'interior') {
      const min = this.roomFrameDistance * 0.4;
      // Far enough out to take in the whole place and what is outside it (a home's carport)
      const max = this.roomFrameDistance * 2.4;
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
      this.setInteriorEye(preset === 'eye');
      if (preset === 'eye') return;
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
      if (preset === 'eye') preset = this.currentPreset = 'close';
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
    // Indoors the inside view comes straight after the room view
    const presets: CameraPreset[] = this.mode === 'interior' ? ['street', 'eye', 'close', 'isometric', 'aerial'] : ['close', 'street', 'isometric', 'aerial'];
    const idx = presets.indexOf(this.currentPreset);
    const next = presets[(idx + 1) % presets.length];
    this.setPreset(next);
    return next;
  }

  /**
   * Reset orientation to default perspective.
   */
  public resetOrientation(): void {
    if (this.mode === 'interior' && this.interiorEye) {
      this.eyePitch = 0.06;
      this.eyeDistance = 2.4;
      this.eyeHeld = 0;
      return;
    }
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
      const distance = this.interiorDistance * THREE.MathUtils.lerp(1, 0.45, this.closeUp);
      const x = Math.sin(this.interiorYaw) * Math.cos(this.interiorPitch) * distance;
      const y = Math.sin(this.interiorPitch) * distance;
      const z = Math.cos(this.interiorYaw) * Math.cos(this.interiorPitch) * distance;
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
      // Placed afresh: whatever was between the camera and the player before no longer applies
      this.collisionFound = Infinity;
      this.collisionLimit = Infinity;
      this.collisionTimer = 0;
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

    if (this.mode === 'interior' && this.interiorEye) {
      this.updateEye(player, delta);
      return;
    }
    this.hideOwnTag(player, false);

    if (this.mode === 'interior') {
      // Room diorama: the camera stays above a corner and drifts gently as the player walks
      this.closeUp += (this.closeUpTarget - this.closeUp) * Math.min(1, delta * 3);
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
      const vehSpeed = Math.abs(player.currentVehicle.currentSpeed || 0);

      if (!this.hasInitializedVehCam) {
        this.cameraVehYaw = vehRot;
        this.hasInitializedVehCam = true;
        this.vehCamRoom = 11.2;
      } else {
        // Smoothly track vehicle heading to decouple visual camera rotation from high-frequency wheel inputs
        const smoothMultiplier = Math.max(0.2, DrivableVehicle.cameraSmoothing);
        const angleDiff = THREE.MathUtils.euclideanModulo(vehRot - this.cameraVehYaw + Math.PI, Math.PI * 2) - Math.PI;
        this.cameraVehYaw += angleDiff * Math.min(delta * (4.6 / smoothMultiplier), 1.0);
      }

      // Dynamic distance and height: pull back slightly at top speed
      const speedNorm = Math.min(1.0, vehSpeed / 30);
      const chaseDistance = 11.2 + speedNorm * 2.2;
      const chaseHeight = 4.4 + speedNorm * 0.8;

      // A wall between the car and the camera: the camera comes in closer (fast), and goes back out slowly
      let room = chaseDistance;
      if (this.blocked) {
        for (let step = 1; step <= 12; step++) {
          const d = (chaseDistance * step) / 12;
          if (this.blocked(vehPos.x - Math.sin(this.cameraVehYaw) * d, vehPos.z - Math.cos(this.cameraVehYaw) * d)) {
            room = Math.max(3.2, d - 1.2);
            break;
          }
        }
      }
      this.vehCamRoom += (room - this.vehCamRoom) * Math.min(1, delta * (room < this.vehCamRoom ? 12 : 1.5));
      const behindX = vehPos.x - Math.sin(this.cameraVehYaw) * this.vehCamRoom;
      const behindZ = vehPos.z - Math.cos(this.cameraVehYaw) * this.vehCamRoom;
      const targetCameraPos = new THREE.Vector3(behindX, vehPos.y + chaseHeight, behindZ);

      const smoothMultiplier = Math.max(0.2, DrivableVehicle.cameraSmoothing);
      const vehLerp = Math.min(delta * (6.5 / smoothMultiplier), 1);
      this.camera.position.lerp(targetCameraPos, vehLerp);

      // Look ahead of vehicle along travel direction to provide natural driving perspective
      const lookAhead = Math.min(Math.max(vehSpeed * 0.16, 1.6), 5.5);
      const targetLookAt = new THREE.Vector3(
        vehPos.x + Math.sin(this.cameraVehYaw) * lookAhead,
        vehPos.y + 1.5,
        vehPos.z + Math.cos(this.cameraVehYaw) * lookAhead
      );
      this.currentLookAt.lerp(targetLookAt, vehLerp);
      this.camera.lookAt(this.currentLookAt);
      return;
    } else {
      this.hasInitializedVehCam = false;
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
      // Looking for what is in the way is costly in a dense city, so it is done a few times a second
      this.collisionTimer -= delta;
      if (this.collisionTimer <= 0) {
        this.collisionTimer = COLLISION_CHECK_EVERY;
        this.collisionRaycaster.set(origin, rayDir);
        this.collisionRaycaster.far = maxDist;
        const hits = this.collisionRaycaster.intersectObjects(this.collisionObjects, true);
        this.collisionFound = hits.length > 0 && hits[0].distance < maxDist ? Math.max(2.4, hits[0].distance - 0.5) : Infinity;
      }
      // In quickly, so the camera is never left inside a wall; back out slowly, so it does not
      // lurch in and out as buildings pass between it and the player
      const wanted = Math.min(maxDist, this.collisionFound);
      if (!Number.isFinite(this.collisionLimit)) this.collisionLimit = wanted;
      const rate = wanted < this.collisionLimit ? 14 : 2.5;
      this.collisionLimit += (wanted - this.collisionLimit) * Math.min(1, delta * rate);
      this.collisionLimit = Math.min(this.collisionLimit, maxDist);
      if (this.collisionLimit < maxDist - 0.01) actualOffset = rayDir.multiplyScalar(this.collisionLimit);
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

  /** In the inside view the player's own name would hang in the middle of the picture */
  private tagHidden = false;
  private hideOwnTag(player: Player, hide: boolean): void {
    if (hide === this.tagHidden) return;
    const tag = (player as unknown as { humanRig?: { nameTag?: THREE.Object3D } | null }).humanRig?.nameTag;
    if (!tag) return;
    tag.visible = !hide;
    this.tagHidden = hide;
  }

  /** How long a turn of the view by hand holds before the view swings back behind the player */
  private eyeHeld = 0;

  /**
   * Indoors at eye height: a step behind the player and a little above their head, looking
   * ahead past them. As they walk the view swings round behind them (not when they come back
   * toward it); the camera never leaves the room, so the walls stand and the ceiling lights show.
   */
  private updateEye(player: Player, delta: number): void {
    this.hideOwnTag(player, true);
    const facing = player.mesh.rotation.y;
    this.eyeHeld = Math.max(0, this.eyeHeld - delta);
    const moving = player.isMoving || (player.actor.scripted && player.actor.pose.legs === 'walk');
    const diff = THREE.MathUtils.euclideanModulo(facing - this.eyeYaw + Math.PI, Math.PI * 2) - Math.PI;
    if (this.eyeSnap) {
      this.eyeYaw = facing;
    } else if (moving && this.eyeHeld <= 0 && Math.abs(diff) < 2.3) {
      this.eyeYaw += diff * Math.min(1, delta * 2.6);
    }
    const lying = player.actor.scripted && player.actor.pose.legs === 'lie';
    const head = player.position.y + (lying ? 1.0 : player.actor.pose.legs === 'sit' || player.actor.pose.legs === 'kneel' ? 1.25 : 1.62);
    const d = this.eyeDistance * Math.cos(this.eyePitch);
    const want = new THREE.Vector3(
      player.position.x - Math.sin(this.eyeYaw) * d,
      head + 0.18 + Math.sin(this.eyePitch) * this.eyeDistance,
      player.position.z - Math.cos(this.eyeYaw) * d
    );
    // Inside the walls (0.4 thick, centred on the room's edge) and under the ceiling
    if (this.roomCenter) {
      const hx = this.roomWidth / 2 - 0.5;
      const hz = this.roomLength / 2 - 0.5;
      want.x = THREE.MathUtils.clamp(want.x, this.roomCenter.x - hx, this.roomCenter.x + hx);
      want.z = THREE.MathUtils.clamp(want.z, this.roomCenter.z - hz, this.roomCenter.z + hz);
    }
    want.y = Math.min(want.y, 2.9);
    const look = new THREE.Vector3(player.position.x + Math.sin(this.eyeYaw) * 2.2, head - 0.15 - Math.sin(this.eyePitch) * 1.5, player.position.z + Math.cos(this.eyeYaw) * 2.2);
    const ease = this.eyeSnap ? 1 : Math.min(1, delta * 7);
    this.eyeSnap = false;
    this.camera.position.lerp(want, ease);
    this.currentLookAt.lerp(look, ease);
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
