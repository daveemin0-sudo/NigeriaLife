import * as THREE from 'three';
import {
  type CharacterConfig,
  CharacterStorage,
  type EmoteType,
} from './CharacterCustomization';
import { createHumanForConfig } from './HumanFromConfig';
import { RENDER_LAYERS } from '../interiors/InteriorTypes';
import type { GameCamera } from '../game/Camera';
import type { HumanRig } from '../graphics/HumanMeshBuilder';
import { AssetManager } from '../assets/AssetManager';
import { SoundEngine } from '../audio/SoundEngine';
import { BackendService } from '../backend/BackendService';
import { Actor } from '../interactions/Actor';
import { InteractionDirector } from '../interactions/InteractionDirector';
import { holdCarriedItem } from '../interactions/Poses';

export class Player {
  public mesh: THREE.Group;
  public targetPosition: THREE.Vector3 | null = null;
  public walkSpeed: number = 7.5;
  public sprintSpeed: number = 12.0;
  public speed: number = 7.5;
  public isMoving: boolean = false;
  public isSprinting: boolean = false;
  public currentEmote: EmoteType = 'idle';
  public emoteTimer: number = 0;
  public isDriving: boolean = false;
  public currentVehicle: any = null;
  public cameraManager: GameCamera | null = null;

  // Configuration
  public config: CharacterConfig;

  // Human anatomical procedural rig
  public humanRig!: HumanRig;

  // Skinned GLTF Model & AnimationMixer
  public glbModel: THREE.Group | null = null;
  public mixer: THREE.AnimationMixer | null = null;
  public actions: Map<string, THREE.AnimationAction> = new Map();
  public currentAction: THREE.AnimationAction | null = null;

  // Animation state
  private animTime: number = 0;

  /** Lets scripted interactions (doors, sitting, eating, waving) direct the player's body */
  public actor: Actor;

  constructor() {
    this.mesh = new THREE.Group();
    this.mesh.position.set(0, 0, 5); // Start on Broad Street

    // Load saved or default character configuration
    this.config = CharacterStorage.load();

    this.buildHumanMesh();

    this.actor = new Actor({
      id: 'player',
      name: this.config.name || 'You',
      root: this.mesh,
      // The built-in body can be animated by hand; a loaded character model cannot (yet)
      getRig: () => (this.glbModel ? null : this.humanRig),
      speed: 4.2,
    });
    InteractionDirector.get().player = InteractionDirector.get().register(this.actor);

    // Assign to dedicated PLAYER layer so player is visible in both street and interior
    this.mesh.traverse((child) => {
      child.layers.set(RENDER_LAYERS.PLAYER);
    });
  }

  public get position(): THREE.Vector3 {
    return this.mesh.position;
  }

  private buildHumanMesh(): void {
    if (this.humanRig) {
      this.mesh.remove(this.humanRig.group);
    }
    if (this.glbModel) {
      this.mesh.remove(this.glbModel);
      this.glbModel = null;
      this.mixer = null;
      this.actions.clear();
      this.currentAction = null;
    }

    // 1. Procedural Anatomical Model (Zero-latency instant render)
    this.humanRig = createHumanForConfig(this.config);

    this.mesh.add(this.humanRig.group);

    // 2. Asynchronous GLB Humanoid Rig (if available in public/models/characters/)
    const glbPath = `/models/characters/human_${this.config.gender || 'male'}.glb`;
    AssetManager.getInstance().instantiate(glbPath).then((gltfScene) => {
      if (gltfScene) {
        this.mesh.remove(this.humanRig.group);
        this.glbModel = gltfScene;
        this.mesh.add(this.glbModel);

        // Setup AnimationMixer
        if (gltfScene.userData.animations && gltfScene.userData.animations.length > 0) {
          this.mixer = new THREE.AnimationMixer(this.glbModel);
          for (const clip of gltfScene.userData.animations) {
            const action = this.mixer.clipAction(clip);
            this.actions.set(clip.name.toLowerCase(), action);
          }
          this.playAnimation('idle');
        }

        this.mesh.traverse((child) => {
          child.layers.set(RENDER_LAYERS.PLAYER);
        });
      }
    });

    this.mesh.traverse((child) => {
      child.layers.set(RENDER_LAYERS.PLAYER);
    });
  }

  public playAnimation(clipName: string, fadeDuration: number = 0.25): void {
    if (!this.mixer) return;
    const target = this.actions.get(clipName.toLowerCase()) || this.actions.get('idle');
    if (target && target !== this.currentAction) {
      if (this.currentAction) {
        this.currentAction.fadeOut(fadeDuration);
      }
      target.reset().fadeIn(fadeDuration).play();
      this.currentAction = target;
    }
  }

  public setDestination(target: THREE.Vector3): void {
    this.targetPosition = target.clone();
    this.isMoving = true;
    this.currentEmote = 'walk';
  }

  public stopMoving(): void {
    this.targetPosition = null;
    this.isMoving = false;
    this.currentEmote = 'idle';
  }

  public applyCustomization(newConfig: CharacterConfig): void {
    this.config = { ...newConfig };
    CharacterStorage.save(this.config);
    this.buildHumanMesh();
  }

  public playEmote(emote: EmoteType, durationSeconds: number = 3.5): void {
    this.currentEmote = emote;
    this.emoteTimer = durationSeconds;
    this.isMoving = false;
    this.playAnimation(emote);
  }

  public stopEmote(): void {
    this.emoteTimer = 0;
    this.isMoving = false;
    this.currentEmote = 'idle';
    this.playAnimation('idle');
  }

  public update(delta: number, keys?: Record<string, boolean>): void {
    this.updateBody(delta, keys);
    // Something in the hands (a shop basket) stays held while walking about freely
    if (!this.actor.scripted && this.actor.carried && this.humanRig && !this.glbModel) {
      holdCarriedItem(this.humanRig);
    }
  }

  private updateBody(delta: number, keys?: Record<string, boolean>): void {
    // Tick GLB skeletal animation mixer if present
    if (this.mixer) {
      this.mixer.update(delta);
    }

    // A scripted interaction is moving and animating the player: input waits until it ends
    if (this.actor.scripted) {
      this.targetPosition = null;
      this.isMoving = false;
      this.isSprinting = false;
      return;
    }

    if (this.isDriving && this.currentVehicle) {
      this.mesh.position.copy(this.currentVehicle.mesh.position);
      this.mesh.rotation.y = this.currentVehicle.mesh.rotation.y;
      return;
    }

    // 0. Sprint state via Shift key (depleted if energy < 5)
    const backend = BackendService.getInstance();
    const stats = backend.getData().stats;
    const isShift = keys && (keys['shift'] || keys['shiftleft'] || keys['shiftright']);
    this.isSprinting = !!isShift && stats.energy >= 5;
    let currentBaseSpeed = this.isSprinting ? this.sprintSpeed : this.walkSpeed;
    if (stats.hunger <= 0) {
      currentBaseSpeed *= 0.72; // Starvation fatigue
    }
    this.speed = currentBaseSpeed;

    // 1. Keyboard Walking & Running Controls (WASD / Arrow Keys)
    const hasMoveKey =
      keys &&
      (keys['w'] ||
        keys['s'] ||
        keys['a'] ||
        keys['d'] ||
        keys['arrowup'] ||
        keys['arrowdown'] ||
        keys['arrowleft'] ||
        keys['arrowright']);

    if (hasMoveKey && !this.isDriving) {
      this.targetPosition = null;
      let moveX = 0;
      let moveZ = 0;
      if (keys['w'] || keys['arrowup']) moveZ -= 1;
      if (keys['s'] || keys['arrowdown']) moveZ += 1;
      if (keys['a'] || keys['arrowleft']) moveX -= 1;
      if (keys['d'] || keys['arrowright']) moveX += 1;

      if (moveX !== 0 || moveZ !== 0) {
        let moveDir: THREE.Vector3;
        if (this.cameraManager) {
          const yaw = this.cameraManager.getActiveYaw();
          const forward = new THREE.Vector3(-Math.sin(yaw), 0, -Math.cos(yaw));
          const right = new THREE.Vector3(Math.cos(yaw), 0, -Math.sin(yaw));
          moveDir = new THREE.Vector3()
            .addScaledVector(right, moveX)
            .addScaledVector(forward, -moveZ)
            .normalize();
        } else {
          moveDir = new THREE.Vector3(moveX, 0, moveZ).normalize();
        }

        const targetAngle = Math.atan2(moveDir.x, moveDir.z);
        const diffAngle = Math.atan2(Math.sin(targetAngle - this.mesh.rotation.y), Math.cos(targetAngle - this.mesh.rotation.y));
        this.mesh.rotation.y += diffAngle * Math.min(1, delta * 14.0);
        this.mesh.position.addScaledVector(moveDir, this.speed * delta);
        this.isMoving = true;
        const moveAction = this.isSprinting ? 'run' : 'walk';
        this.currentEmote = moveAction as EmoteType;
        this.playAnimation(moveAction);
        SoundEngine.getInstance().playFootstep(this.isSprinting);

        // Physically traverse pedestrian bridge, stairs, and terrain elevation
        const targetY = this.calculateWalkableHeight(this.mesh.position.x, this.mesh.position.z);
        this.mesh.position.y = THREE.MathUtils.lerp(this.mesh.position.y, targetY, Math.min(1, delta * 14));

        this.animTime += delta;
        if (this.humanRig) {
          this.humanRig.updateAnimation(this.animTime, moveAction);
        }
        return;
      }
    }

    // 2. Moving state (Point and Click)
    if (this.targetPosition && this.isMoving) {
      const currentPos = this.mesh.position;
      const direction = new THREE.Vector3().subVectors(this.targetPosition, currentPos);
      direction.y = 0;
      const distance = direction.length();

      const arriveTolerance = 0.15;
      if (distance <= arriveTolerance) {
        this.mesh.position.x = this.targetPosition.x;
        this.mesh.position.z = this.targetPosition.z;
        this.isMoving = false;
        this.targetPosition = null;
        this.currentEmote = 'idle';
        this.playAnimation('idle');
      } else {
        // Rotate smoothly
        const targetAngle = Math.atan2(direction.x, direction.z);
        const diffAngle = Math.atan2(Math.sin(targetAngle - this.mesh.rotation.y), Math.cos(targetAngle - this.mesh.rotation.y));
        this.mesh.rotation.y += diffAngle * Math.min(1, delta * 12.0);

        // Move forward
        direction.normalize();
        const moveDist = Math.min(distance, this.speed * delta);
        this.mesh.position.addScaledVector(direction, moveDist);
        this.playAnimation('walk');
        SoundEngine.getInstance().playFootstep(false);

        // Physically traverse pedestrian bridge, stairs, and terrain elevation
        const targetY = this.calculateWalkableHeight(this.mesh.position.x, this.mesh.position.z);
        this.mesh.position.y = THREE.MathUtils.lerp(this.mesh.position.y, targetY, Math.min(1, delta * 14));

        this.animTime += delta;
        if (this.humanRig) {
          this.humanRig.updateAnimation(this.animTime, 'walk');
        }
        return;
      }
    }

    // 3. Emote Timer handling
    if (this.emoteTimer > 0) {
      this.emoteTimer -= delta;
      if (this.emoteTimer <= 0) {
        this.currentEmote = 'idle';
        this.playAnimation('idle');
      }
    }

    // 4. Emotes / Idle Animations
    this.animTime += delta;

    if (this.humanRig) {
      if (this.currentEmote === 'salute') {
        this.humanRig.rightArm.rotation.x = -Math.PI / 2.2;
        this.humanRig.rightArm.rotation.z = -Math.PI / 6;
      } else if (this.currentEmote === 'zanku' || this.currentEmote === 'groove' || this.currentEmote === 'dance') {
        this.humanRig.updateAnimation(this.animTime, 'dance');
      } else if (this.currentEmote === 'talk') {
        this.humanRig.updateAnimation(this.animTime, 'talk');
      } else if (this.currentEmote === 'phone_call') {
        this.humanRig.updateAnimation(this.animTime, 'phone_call');
      } else {
        // Natural idle breathing
        this.humanRig.updateAnimation(this.animTime, 'idle');
      }
    }
  }

  public setDriving(driving: boolean, vehicle: any = null): void {
    this.isDriving = driving;
    this.currentVehicle = vehicle;
    this.mesh.visible = !driving;
  }

  /**
   * Calculates the walkable ground surface height for physical verticality.
   * Enables physically traversing the overhead pedestrian bridge at z = 28.0m:
   * Walking up the concrete stairs from z = 14.2m to 26.5m, walking across the
   * overhead deck 5.4m above traffic, and walking down the stairs on the other side.
   */
  public calculateWalkableHeight(x: number, z: number): number {
    const deckY = 5.4;

    // West staircase (around x = -10.5) and East staircase (around x = +10.5)
    const isWestStairs = Math.abs(x - (-10.5)) <= 1.8;
    const isEastStairs = Math.abs(x - 10.5) <= 1.8;

    // Staircase ramp span along Z: 14.2m (bottom on sidewalk) to 26.5m (top at deck)
    if ((isWestStairs || isEastStairs) && z >= 14.2 && z <= 26.5) {
      const progress = (z - 14.2) / (26.5 - 14.2);
      return Math.max(0, Math.min(deckY, progress * deckY));
    }

    // Overhead walkway deck crossing the 4 highway lanes
    // Spans from West pillar to East pillar (x: -11.0 to +11.0, z: 26.4 to 29.8)
    if (Math.abs(x) <= 11.0 && z >= 26.4 && z <= 29.8) {
      return deckY;
    }

    // Default street & sidewalk ground elevation
    return 0;
  }
}
