import * as THREE from 'three';
import { Player } from '../player/Player';
import { RENDER_LAYERS } from '../interiors/InteriorTypes';
import { DrivableVehicle } from '../world/DrivableVehicle';

export type CameraMode = 'street' | 'interior' | 'home' | 'map' | 'photo';
/** 'eye' is first-person at head height: indoors a step behind the player, on the street at eye level */
export type CameraPreset = 'close' | 'street' | 'isometric' | 'aerial' | 'eye';

const STREET_FOV = 55;
/** A narrower lens flattens perspective, so a room reads as a model you look into */
const INTERIOR_FOV = 40;
/** At eye height the view is as wide as the eye's */
const EYE_FOV = 62;
/** Minimum horizontal FOV (degrees) on narrow portrait screens */
const PORTRAIT_MIN_HORIZ_STREET = 60;
const PORTRAIT_MIN_HORIZ_INTERIOR = 46;
const PORTRAIT_MIN_HORIZ_EYE = 60;
const INTERIOR_YAW = 0.62;
/** Room diorama: high enough to read furniture layout without going fully top-down */
const INTERIOR_PITCH = 0.95;
/** Open-air pocket (beach, park): near street eye — ground-level play, not a high diorama */
const OPEN_AIR_PITCH = 0.48;
const OPEN_AIR_YAW = 0.35;
/** How far the view drifts from the room centre toward the player (0 = fixed room view, 1 = follows the player) */
const INTERIOR_FOLLOW = 0.45;
const OPEN_AIR_FOLLOW = 0.92;
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
  public pitch: number = 0.46;          // Vertical elevation (~26 deg) — slight cinematic lift
  public distance: number = 8.8;        // Distance to target (m)
  /** Preset pitch/distance eased toward these (orbit/zoom updates both live + target) */
  private targetPitch = 0.46;
  private targetDistance = 8.8;
  private targetInteriorPitch = INTERIOR_PITCH;
  private targetInteriorDistance = 30;
  private fovTarget = STREET_FOV;

  // Interior mode: a cutaway "diorama" view of the whole room from above one corner
  public interiorYaw: number = INTERIOR_YAW;
  public interiorPitch: number = INTERIOR_PITCH;
  public interiorDistance: number = 30;
  /** Distance at which the current room is comfortably framed; zoom limits scale from it */
  private roomFrameDistance: number = 30;
  private roomCenter: THREE.Vector3 | null = null;
  private roomRadius: number = 15;
  /** Open-air place: street-height follow instead of room diorama */
  private openAirView = false;
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

  /** Driving: behind the car (chase), or over its bonnet looking down the road */
  public driveView: 'chase' | 'bonnet' = (() => {
    try {
      return localStorage.getItem('nl_drive_view_v1') === 'bonnet' ? 'bonnet' : 'chase';
    } catch {
      return 'chase';
    }
  })();
  private carHeights = new WeakMap<THREE.Object3D, number>();

  /** Chase view to bonnet view and back; kept for the next drive */
  public toggleDriveView(): 'chase' | 'bonnet' {
    this.driveView = this.driveView === 'chase' ? 'bonnet' : 'chase';
    try {
      localStorage.setItem('nl_drive_view_v1', this.driveView);
    } catch {
      // Kept for this visit
    }
    return this.driveView;
  }

  /** How tall a car is, measured once */
  private carHeight(car: THREE.Object3D): number {
    let h = this.carHeights.get(car);
    if (h === undefined) {
      const box = new THREE.Box3().setFromObject(car);
      h = Math.min(2.6, Math.max(0.9, box.max.y - car.position.y));
      this.carHeights.set(car, h);
    }
    return h;
  }

  /** Where the bonnet camera sits, and looks, from the car (smoothed). The chase camera does not use these. */
  private vehCamOffset = new THREE.Vector3();
  private vehLookOffset = new THREE.Vector3();
  /** Chase camera height, eased. The camera is placed from the car every frame, not lagged in the world. */
  private chaseHeight = 4.4;

  /**
   * How much of a gap to close this frame. Exponential, and capped, so a hitch on a phone
   * (one long frame, then a short one) does not whip the view round the car.
   */
  private ease(rate: number, delta: number): number {
    return 1 - Math.exp(-rate * Math.min(delta, 1 / 30));
  }
  // Vehicle driving chase camera heading filter
  private cameraVehYaw: number = 0;
  private hasInitializedVehCam: boolean = false;

  constructor() {
    this.camera = new THREE.PerspectiveCamera(
      STREET_FOV,
      window.innerWidth / window.innerHeight,
      0.1,
      300
    );
    this.collisionRaycaster.camera = this.camera;
    this.camera.position.set(0, 3.8, 7.8);
    this.setFov(this.activeFov());

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
      this.setFov(this.activeFov());
    }
  }

  /** Into or out of the inside view while indoors */
  public setInteriorEye(on: boolean): void {
    // Straight behind the player the moment it is chosen
    if (on && !this.interiorEye) this.eyeSnap = true;
    this.interiorEye = on;
    if (this.mode === 'interior') this.setFov(this.activeFov());
    try { localStorage.setItem('nl_inside_view_v1', on ? '1' : '0'); } catch { /* no storage */ }
  }

  private portraitScaledFov(baseFov: number, minHorizDeg: number, maxFov = 95): number {
    const aspect = this.camera.aspect || 1;
    if (aspect < 1) {
      const horiz = THREE.MathUtils.degToRad(minHorizDeg);
      const needed = THREE.MathUtils.radToDeg(2 * Math.atan(Math.tan(horiz / 2) / aspect));
      return THREE.MathUtils.clamp(needed, baseFov, maxFov);
    }
    return baseFov;
  }

  private activeFov(): number {
    if (this.mode === 'interior') {
      return this.interiorEye
        ? this.portraitScaledFov(EYE_FOV, PORTRAIT_MIN_HORIZ_EYE, 95)
        : this.portraitScaledFov(INTERIOR_FOV, PORTRAIT_MIN_HORIZ_INTERIOR, 76);
    }
    if (this.currentPreset === 'eye') {
      return this.portraitScaledFov(EYE_FOV, PORTRAIT_MIN_HORIZ_EYE, 95);
    }
    return this.portraitScaledFov(STREET_FOV, PORTRAIT_MIN_HORIZ_STREET, 95);
  }

  private setFov(fov: number, instant = false): void {
    this.fovTarget = fov;
    if (instant || Math.abs(this.camera.fov - fov) < 0.01) {
      if (Math.abs(this.camera.fov - fov) >= 0.01) {
        this.camera.fov = fov;
        this.camera.updateProjectionMatrix();
      }
      return;
    }
  }

  /** Ease FOV toward the active mode/preset target (photo mode sets FOV instantly). */
  private easeFov(delta: number): void {
    if (this.mode === 'photo') return;
    const next = this.camera.fov + (this.fovTarget - this.camera.fov) * this.ease(7.5, delta);
    if (Math.abs(next - this.camera.fov) < 0.02) {
      if (Math.abs(this.camera.fov - this.fovTarget) >= 0.02) {
        this.camera.fov = this.fovTarget;
        this.camera.updateProjectionMatrix();
      }
      return;
    }
    this.camera.fov = next;
    this.camera.updateProjectionMatrix();
  }

  /** Framing state for e2e / debug: live values vs eased preset targets */
  public get framing(): {
    pitch: number;
    distance: number;
    targetPitch: number;
    targetDistance: number;
    fov: number;
    fovTarget: number;
    preset: CameraPreset;
  } {
    return {
      pitch: this.pitch,
      distance: this.distance,
      targetPitch: this.targetPitch,
      targetDistance: this.targetDistance,
      fov: this.camera.fov,
      fovTarget: this.fovTarget,
      preset: this.currentPreset,
    };
  }

  /**
   * Point the interior camera at a room: it looks down into it from a front corner,
   * far enough back that most of the floor is in view on the current screen shape.
   * Open-air places use a lower street-like chase so the ground fills the view.
   */
  public frameRoom(
    center: THREE.Vector3,
    width: number,
    length: number,
    view?: { width: number; length: number },
    opts?: { openAir?: boolean },
  ): void {
    this.roomCenter = center.clone();
    this.roomWidth = width;
    this.roomLength = length;
    this.openAirView = !!opts?.openAir;
    // A big home is not shown whole from far off: a part of it the size of `view`, following the player through it
    const w = view ? Math.min(width, view.width) : width;
    const l = view ? Math.min(length, view.length) : length;
    this.bigRoom = this.openAirView || w < width || l < length;
    this.roomRadius = 0.5 * Math.hypot(w, l);
    if (this.openAirView) {
      // Street eye height: short leash, follow the player — not a high platform overview
      this.roomFrameDistance = Math.min(14, Math.max(9, this.roomRadius * 0.22));
      this.interiorYaw = OPEN_AIR_YAW;
      this.interiorPitch = OPEN_AIR_PITCH;
      this.targetInteriorPitch = OPEN_AIR_PITCH;
    } else {
      this.roomFrameDistance = this.computeRoomFrameDistance();
      this.interiorYaw = INTERIOR_YAW;
      this.interiorPitch = INTERIOR_PITCH;
      this.targetInteriorPitch = INTERIOR_PITCH;
    }
    this.interiorDistance = this.roomFrameDistance;
    this.targetInteriorDistance = this.roomFrameDistance;
    this.currentPreset = this.interiorEye ? 'eye' : 'street';
    this.closeUp = 0;
    this.closeUpTarget = 0;
    // In through the door, facing into the room
    this.eyeYaw = Math.PI;
    this.eyeSnap = true;
  }

  private eyeSnap = false;
  /** The room is bigger than what is framed of it: the view follows the player closely */
  private bigRoom = false;

  /** Moves the room view in on the player, or back out to the whole room. */
  public setCloseUp(on: boolean): void {
    this.closeUpTarget = on ? 1 : 0;
  }

  private computeRoomFrameDistance(): number {
    const fov = this.portraitScaledFov(INTERIOR_FOV, PORTRAIT_MIN_HORIZ_INTERIOR, 76);
    const halfFov = THREE.MathUtils.degToRad(fov / 2);
    // Wide screens are limited by height, tall phone screens by width
    const fitWidth = this.roomRadius / (Math.tan(halfFov) * this.camera.aspect);
    return Math.max(this.roomRadius * 1.75, fitWidth * 1.05);
  }

  /** The point the interior camera looks at: the room centre, pulled part of the way toward the player. */
  private interiorFocus(player: Player): THREE.Vector3 {
    const focus = new THREE.Vector3(player.position.x, this.openAirView ? 1.35 : 1.0, player.position.z);
    if (this.roomCenter) {
      // Aerial / high isometric hold the plan centre so multi-room layouts stay inspectable
      const overview = this.currentPreset === 'aerial' || this.currentPreset === 'isometric';
      const baseFollow = this.openAirView
        ? OPEN_AIR_FOLLOW
        : overview ? (this.bigRoom ? 0.28 : 0.12) : (this.bigRoom ? 0.9 : INTERIOR_FOLLOW);
      const follow = THREE.MathUtils.lerp(baseFollow, 0.95, this.closeUp);
      focus.set(
        THREE.MathUtils.lerp(this.roomCenter.x, player.position.x, follow),
        overview ? 0.4 : 1.0,
        THREE.MathUtils.lerp(this.roomCenter.z, player.position.z, follow)
      );
      // Aim a little short of that, so the room sits above the cards along the bottom of the screen
      const lift = this.interiorDistance * THREE.MathUtils.lerp(1, 0.45, this.closeUp) * INTERIOR_SCREEN_LIFT * (overview ? 0.55 : 1);
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

  private isStreetEye(): boolean {
    return this.mode === 'street' && this.currentPreset === 'eye';
  }

  public getActiveYaw(): number {
    // The way the camera looks from: forward on the stick goes the way the view faces
    if ((this.mode === 'interior' && this.interiorEye) || this.isStreetEye()) return this.eyeYaw + Math.PI;
    return this.mode === 'interior' ? this.interiorYaw : this.yaw;
  }

  /**
   * Rotate camera around the player horizontally (yaw) and vertically (pitch).
   */
  /** Is there a wall at this point on the ground? (set by the game) The driving camera stays on this side of one */
  public blocked: ((x: number, z: number) => boolean) | null = null;
  private vehCamRoom = 11.2;

  /** Where the street camera is easing round to; the player turning it themselves takes over */
  private yawGoal: number | null = null;

  /** Eases round behind the player so that this point on the street is in view beyond them */
  public lookTowards(from: { x: number; z: number }, x: number, z: number): void {
    this.yawGoal = Math.atan2(from.x - x, from.z - z);
  }

  public rotate(deltaYaw: number, deltaPitch: number = 0): void {
    this.yawGoal = null;
    if ((this.mode === 'interior' && this.interiorEye) || this.isStreetEye()) {
      this.eyeYaw += deltaYaw;
      this.eyeHeld = 1.2;
      this.eyePitch = Math.max(-0.35, Math.min(0.6, this.eyePitch + deltaPitch));
      return;
    }
    if (this.mode === 'interior') {
      this.interiorYaw += deltaYaw;
      while (this.interiorYaw > Math.PI) this.interiorYaw -= Math.PI * 2;
      while (this.interiorYaw < -Math.PI) this.interiorYaw += Math.PI * 2;
      // Never low enough to look through the walls from the side; allow dollhouse pitch up to aerial
      this.interiorPitch = Math.max(0.5, Math.min(1.48, this.interiorPitch + deltaPitch));
      this.targetInteriorPitch = this.interiorPitch;
    } else {
      this.yaw += deltaYaw;
      while (this.yaw > Math.PI) this.yaw -= Math.PI * 2;
      while (this.yaw < -Math.PI) this.yaw += Math.PI * 2;
      this.pitch = Math.max(0.12, Math.min(1.30, this.pitch + deltaPitch));
      this.targetPitch = this.pitch;
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
      this.targetInteriorDistance = this.interiorDistance;
    } else {
      this.distance = Math.max(4.0, Math.min(22.0, this.distance + deltaDistance));
      this.targetDistance = this.distance;
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
      if (preset === 'eye') {
        this.setFov(this.activeFov());
        return;
      }
      if (preset === 'close') {
        this.targetInteriorPitch = this.openAirView ? 0.32 : 0.62;
        this.targetInteriorDistance = this.roomFrameDistance * (this.openAirView ? 0.7 : 0.55);
      } else if (preset === 'street') {
        this.targetInteriorPitch = this.openAirView ? OPEN_AIR_PITCH : INTERIOR_PITCH;
        this.targetInteriorDistance = this.roomFrameDistance;
      } else if (preset === 'isometric') {
        // Raised isometric — whole-home cutaway, walls still readable
        this.targetInteriorPitch = this.openAirView ? 0.85 : 1.12;
        this.targetInteriorDistance = this.roomFrameDistance * 1.35;
        this.closeUp = 0;
        this.closeUpTarget = 0;
      } else if (preset === 'aerial') {
        // Dollhouse overview: near top-down so every room division is inspectable
        this.targetInteriorPitch = this.openAirView ? 1.15 : 1.42;
        this.targetInteriorDistance = this.roomFrameDistance * 1.75;
        this.closeUp = 0;
        this.closeUpTarget = 0;
      }
      this.setFov(this.activeFov());
    } else {
      const wasEye = this.currentPreset === 'eye';
      this.currentPreset = preset;
      if (preset === 'eye') {
        if (!wasEye) {
          this.eyeSnap = true;
          this.eyePitch = 0.04;
        }
        this.setFov(this.activeFov());
        return;
      }
      this.setFov(this.activeFov());
      if (preset === 'close') {
        // Close third-person: shoulder-level view, character prominent
        this.targetPitch = 0.22;
        this.targetDistance = 5.2;
      } else if (preset === 'street') {
        // Standard street view — slight cinematic lift vs the old 0.44 / 8.5
        this.targetPitch = 0.46;
        this.targetDistance = 8.8;
      } else if (preset === 'isometric') {
        // High angle overview looking down at sidewalks and road lanes
        this.targetPitch = 0.82;
        this.targetDistance = 15.0;
      } else if (preset === 'aerial') {
        // High city aerial view
        this.targetPitch = 1.18;
        this.targetDistance = 26.0;
      }
    }
  }

  /**
   * Cycle through available camera presets (Close -> Street -> Isometric -> Aerial -> Eye).
   */
  public cyclePreset(): CameraPreset {
    // Indoors the inside view comes straight after the room view
    const presets: CameraPreset[] = this.mode === 'interior'
      ? ['street', 'eye', 'close', 'isometric', 'aerial']
      : ['close', 'street', 'isometric', 'aerial', 'eye'];
    const idx = presets.indexOf(this.currentPreset);
    const next = presets[(idx + 1) % presets.length];
    this.setPreset(next);
    return next;
  }

  /**
   * Reset orientation to default perspective.
   */
  public resetOrientation(): void {
    if ((this.mode === 'interior' && this.interiorEye) || this.isStreetEye()) {
      this.eyePitch = this.mode === 'interior' ? 0.06 : 0.04;
      this.eyeDistance = 2.4;
      this.eyeHeld = 0;
      if (this.isStreetEye()) this.eyeSnap = true;
      return;
    }
    if (this.mode === 'interior') {
      this.interiorYaw = this.openAirView ? OPEN_AIR_YAW : INTERIOR_YAW;
      this.interiorPitch = this.openAirView ? OPEN_AIR_PITCH : INTERIOR_PITCH;
      this.targetInteriorPitch = this.interiorPitch;
      this.interiorDistance = this.roomFrameDistance;
      this.targetInteriorDistance = this.roomFrameDistance;
    } else {
      this.yaw = 0;
      this.pitch = 0.46;
      this.targetPitch = 0.46;
      this.distance = 8.8;
      this.targetDistance = 8.8;
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
      if (this.isStreetEye()) {
        this.eyeSnap = true;
        this.updateStreetEye(player, 1 / 30);
        return;
      }
      const offset = this.computeOffset();
      const targetPos = new THREE.Vector3().copy(player.position).add(offset);
      if (this.blocked && this.blocked(targetPos.x, targetPos.z)) {
        const rayDir = offset.clone().normalize();
        for (let d = offset.length() - 0.35; d >= 0.45; d -= 0.35) {
          const cx = player.position.x + rayDir.x * d;
          const cz = player.position.z + rayDir.z * d;
          if (!this.blocked(cx, cz)) {
            targetPos.set(cx, player.position.y + rayDir.y * d, cz);
            this.collisionLimit = d;
            break;
          }
        }
      }
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
    this.setPhotoFov(this.activeFov());
  }

  public setPhotoFov(fov: number): void {
    this.photoFov = fov;
    this.camera.fov = fov;
    this.camera.updateProjectionMatrix();
  }

  public update(player: Player, delta: number): void {
    // Hitch-resistant follow rates (capped exponential ease)
    const followEase = this.ease(10, delta);
    const lookEase = this.ease(12, delta);
    this.easeFov(delta);

    // Ease spherical framing toward the last preset (orbit/zoom keep targets in sync)
    if (this.mode === 'street' && !this.isStreetEye() && !(player.isDriving && player.currentVehicle)) {
      this.pitch += (this.targetPitch - this.pitch) * this.ease(8, delta);
      this.distance += (this.targetDistance - this.distance) * this.ease(7, delta);
      if (this.yawGoal !== null) {
        const gap = Math.atan2(Math.sin(this.yawGoal - this.yaw), Math.cos(this.yawGoal - this.yaw));
        if (Math.abs(gap) < 0.01) {
          this.yaw = this.yawGoal;
          this.yawGoal = null;
        } else {
          this.yaw += gap * this.ease(3.2, delta);
        }
      }
    } else {
      this.yawGoal = null;
    }
    if (this.mode === 'interior' && !this.interiorEye) {
      this.interiorPitch += (this.targetInteriorPitch - this.interiorPitch) * this.ease(6.5, delta);
      this.interiorDistance += (this.targetInteriorDistance - this.interiorDistance) * this.ease(6, delta);
    }

    if (this.mode === 'photo') {
      this.setStreetEyeHidden(player, false);
      const x = Math.sin(this.photoYaw) * Math.cos(this.photoPitch) * this.photoDistance;
      const y = Math.sin(this.photoPitch) * this.photoDistance + this.photoHeight;
      const z = Math.cos(this.photoYaw) * Math.cos(this.photoPitch) * this.photoDistance;
      const targetCameraPos = new THREE.Vector3().copy(player.position).add(new THREE.Vector3(x, y, z));

      this.camera.position.lerp(targetCameraPos, this.ease(14, delta));

      const targetLookAt = new THREE.Vector3(
        player.position.x,
        player.position.y + this.photoHeight,
        player.position.z
      );
      this.currentLookAt.lerp(targetLookAt, this.ease(14, delta));
      this.camera.lookAt(this.currentLookAt);
      return;
    }

    if (this.mode === 'interior' && this.interiorEye) {
      this.setStreetEyeHidden(player, false);
      this.updateEye(player, delta);
      return;
    }
    this.hideOwnTag(player, false);

    if (this.mode === 'interior') {
      this.setStreetEyeHidden(player, false);
      // Room diorama: the camera stays above a corner and drifts gently as the player walks
      this.closeUp += (this.closeUpTarget - this.closeUp) * this.ease(3.2, delta);
      const focus = this.interiorFocus(player);
      const roomLerp = this.ease(5.2, delta);
      this.currentLookAt.lerp(focus, roomLerp);
      this.camera.position.lerp(focus.clone().add(this.computeOffset()), roomLerp);
      this.camera.lookAt(this.currentLookAt);
      return;
    }

    if (this.mode === 'home') {
      this.camera.position.lerp(this.homeCamPos, followEase);
      this.currentLookAt.lerp(this.homeLookAt, lookEase);
      this.camera.lookAt(this.currentLookAt);
      return;
    }

    if (this.mode === 'map') {
      this.camera.position.lerp(this.mapCamPos, followEase);
      this.currentLookAt.lerp(this.mapLookAt, lookEase);
      this.camera.lookAt(this.currentLookAt);
      return;
    }

    // Vehicle driving chase camera
    if (player.isDriving && player.currentVehicle) {
      this.setStreetEyeHidden(player, false);
      const vehPos = player.currentVehicle.mesh.position;
      const vehRot = player.currentVehicle.mesh.rotation.y;
      const vehSpeed = Math.abs(player.currentVehicle.currentSpeed || 0);

      if (!this.hasInitializedVehCam) {
        this.cameraVehYaw = vehRot;
        this.hasInitializedVehCam = true;
        this.vehCamRoom = 11.2;
        this.chaseHeight = 4.4;
        // From wherever the camera was, relative to the car
        this.vehCamOffset.copy(this.camera.position).sub(vehPos);
        this.vehLookOffset.copy(this.currentLookAt).sub(vehPos);
      } else {
        // Smoothly track vehicle heading to decouple visual camera rotation from high-frequency wheel inputs
        const smoothMultiplier = Math.max(0.2, DrivableVehicle.cameraSmoothing);
        const angleDiff = THREE.MathUtils.euclideanModulo(vehRot - this.cameraVehYaw + Math.PI, Math.PI * 2) - Math.PI;
        // Slightly softer heading filter for cinematic chase without lagging corners
        this.cameraVehYaw += angleDiff * this.ease(4.1 / smoothMultiplier, delta);
      }

      // Over the bonnet: the driver's view down the road, the front of the car at the bottom of it
      if (this.driveView === 'bonnet') {
        const yaw = vehRot;
        const h = this.carHeight(player.currentVehicle.mesh);
        // Just over the roof at the middle of the car, so the bonnet runs out ahead at the bottom of the view
        const eye = new THREE.Vector3(Math.sin(yaw) * -0.1, h * 1.08 + 0.05, Math.cos(yaw) * -0.1);
        this.vehCamOffset.lerp(eye, this.ease(12, delta));
        this.camera.position.copy(vehPos).add(this.vehCamOffset);
        const ahead = new THREE.Vector3(Math.sin(this.cameraVehYaw) * 26, h * 0.25, Math.cos(this.cameraVehYaw) * 26);
        this.vehLookOffset.lerp(ahead, this.ease(10, delta));
        this.currentLookAt.copy(vehPos).add(this.vehLookOffset);
        this.camera.lookAt(this.currentLookAt);
        return;
      }

      // Dynamic distance and height: pull back slightly at top speed
      const speedNorm = Math.min(1.0, vehSpeed / 30);
      const chaseDistance = 11.8 + speedNorm * 2.4;
      const chaseHeight = 4.55 + speedNorm * 0.85;

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
      // In quickly when a wall is close; back out slowly. A hitch must not throw the camera at the car.
      this.vehCamRoom += (room - this.vehCamRoom) * this.ease(room < this.vehCamRoom ? 6 : 1.2, delta);
      this.chaseHeight += (chaseHeight - this.chaseHeight) * this.ease(4, delta);
      // Placed from the car every frame. A second smoothing of the world position, on top of the
      // smoothed heading, lags on a short frame and catches up on a long one: that is the jerk
      // on a phone, where frame time is uneven. The car stays planted in the view.
      const yaw = this.cameraVehYaw;
      this.camera.position.set(
        vehPos.x - Math.sin(yaw) * this.vehCamRoom,
        vehPos.y + this.chaseHeight,
        vehPos.z - Math.cos(yaw) * this.vehCamRoom,
      );
      const lookAhead = Math.min(Math.max(vehSpeed * 0.18, 1.8), 7.5);
      this.currentLookAt.set(vehPos.x + Math.sin(yaw) * lookAhead, vehPos.y + 1.65, vehPos.z + Math.cos(yaw) * lookAhead);
      this.camera.lookAt(this.currentLookAt);
      return;
    } else {
      this.hasInitializedVehCam = false;
    }

    if (this.isStreetEye()) {
      this.updateStreetEye(player, delta);
      return;
    }
    this.setStreetEyeHidden(player, false);

    // Default 'street' mode: rotatable framing centered on player
    const offset = this.computeOffset();
    const lookHeight = this.currentPreset === 'close' ? 1.35 : this.currentPreset === 'isometric' ? 0.9 : 1.55;
    const origin = new THREE.Vector3(player.position.x, player.position.y + lookHeight, player.position.z);

    // Collision avoidance against city buildings, landmarks & vehicles
    let actualOffset = offset.clone();
    const rayDir = offset.clone().normalize();
    const maxDist = offset.length();
    if (this.collisionObjects.length > 0) {
      // Looking for what is in the way is costly in a dense city, so it is done a few times a second
      this.collisionTimer -= delta;
      if (this.collisionTimer <= 0) {
        this.collisionTimer = COLLISION_CHECK_EVERY;
        this.collisionRaycaster.set(origin, rayDir);
        this.collisionRaycaster.far = maxDist;
        const hits = this.collisionRaycaster.intersectObjects(this.collisionObjects, true);
        this.collisionFound = hits.length > 0 && hits[0].distance < maxDist ? Math.max(0.45, hits[0].distance - 0.35) : Infinity;
      }
      // In quickly, so the camera is never left inside a wall; back out slowly, so it does not
      // lurch in and out as buildings pass between it and the player
      const wanted = Math.min(maxDist, this.collisionFound);
      if (!Number.isFinite(this.collisionLimit)) this.collisionLimit = wanted;
      const rate = wanted < this.collisionLimit ? 24 : 2.5;
      this.collisionLimit += (wanted - this.collisionLimit) * Math.min(1, delta * rate);
      this.collisionLimit = Math.min(this.collisionLimit, maxDist);
      if (this.collisionLimit < maxDist - 0.01) actualOffset.copy(rayDir).multiplyScalar(this.collisionLimit);
    }

    const targetCameraPos = new THREE.Vector3().copy(player.position).add(actualOffset);
    // Ground-plane wall guard: ensure camera never lands inside a city wall box
    if (this.blocked && this.blocked(targetCameraPos.x, targetCameraPos.z)) {
      const curLen = actualOffset.length();
      for (let d = curLen - 0.35; d >= 0.45; d -= 0.35) {
        const cx = player.position.x + rayDir.x * d;
        const cz = player.position.z + rayDir.z * d;
        if (!this.blocked(cx, cz)) {
          targetCameraPos.set(cx, player.position.y + rayDir.y * d, cz);
          this.collisionLimit = Math.min(this.collisionLimit, d);
          break;
        }
      }
    }
    const camInWall = this.blocked ? this.blocked(this.camera.position.x, this.camera.position.z) : false;
    this.camera.position.lerp(targetCameraPos, camInWall ? 1 : followEase);

    // Slight look-ahead when walking so Broad Street framing feels cinematic, not glued
    const moving = player.isMoving || (player.actor.scripted && player.actor.pose.legs === 'walk');
    const face = player.mesh.rotation.y;
    const lead = moving ? 0.55 : 0;
    const targetLookAt = new THREE.Vector3(
      player.position.x + Math.sin(face) * lead,
      player.position.y + lookHeight,
      player.position.z + Math.cos(face) * lead
    );
    this.currentLookAt.lerp(targetLookAt, lookEase);
    this.camera.lookAt(this.currentLookAt);
  }

  /** Hide the player body and nametag only while in street first-person view */
  private streetEyeHidden = false;
  private setStreetEyeHidden(player: Player, hide: boolean): void {
    if (hide === this.streetEyeHidden) return;
    player.mesh.visible = !hide;
    this.hideOwnTag(player, hide);
    this.streetEyeHidden = hide;
  }

  /** Street-level first-person view at head height, looking ahead with the same movement controls */
  private updateStreetEye(player: Player, delta: number): void {
    this.setStreetEyeHidden(player, true);
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
    const want = new THREE.Vector3(
      player.position.x + Math.sin(this.eyeYaw) * 0.12,
      head,
      player.position.z + Math.cos(this.eyeYaw) * 0.12
    );
    const look = new THREE.Vector3(
      player.position.x + Math.sin(this.eyeYaw) * 2.4,
      head - Math.sin(this.eyePitch) * 1.8,
      player.position.z + Math.cos(this.eyeYaw) * 2.4
    );
    const ease = this.eyeSnap ? 1 : Math.min(1, delta * 10);
    this.eyeSnap = false;
    this.camera.position.lerp(want, ease);
    this.currentLookAt.lerp(look, ease);
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
    if (this.mode !== 'photo') {
      this.camera.fov = this.activeFov();
    }
    this.camera.updateProjectionMatrix();

    // Keep the same zoom relative to the room when the screen shape changes
    const zoom = this.interiorDistance / this.roomFrameDistance;
    this.roomFrameDistance = this.openAirView
      ? Math.min(14, Math.max(9, this.roomRadius * 0.22))
      : this.computeRoomFrameDistance();
    this.interiorDistance = this.roomFrameDistance * zoom;
  }
}
