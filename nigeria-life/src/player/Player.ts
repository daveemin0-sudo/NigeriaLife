import * as THREE from 'three';
import {
  type CharacterConfig,
  CharacterStorage,
  ATTIRE_PRESETS,
  type EmoteType,
} from './CharacterCustomization';
import { RENDER_LAYERS } from '../interiors/InteriorTypes';
import type { GameCamera } from '../game/Camera';
import { HumanMeshBuilder, type HumanRig } from '../graphics/HumanMeshBuilder';

export class Player {
  public mesh: THREE.Group;
  public targetPosition: THREE.Vector3 | null = null;
  public speed: number = 7.5;
  public isMoving: boolean = false;
  public currentEmote: EmoteType = 'idle';
  public emoteTimer: number = 0;
  public isDriving: boolean = false;
  public currentVehicle: any = null;
  public cameraManager: GameCamera | null = null;

  // Configuration
  public config: CharacterConfig;

  // Human anatomical rig
  public humanRig!: HumanRig;

  // Animation state
  private animTime: number = 0;

  constructor() {
    this.mesh = new THREE.Group();
    this.mesh.position.set(0, 0, 5); // Start on Broad Street

    // Load saved or default character configuration
    this.config = CharacterStorage.load();

    this.buildHumanMesh();

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

    const isFemale = this.config.gender === 'female';
    const attirePreset = ATTIRE_PRESETS[this.config.attire] || ATTIRE_PRESETS['agbada_green'];

    const outfitType = this.config.attire === 'blue_dress'
      ? 'blue_dress'
      : this.config.attire === 'engineer_vest'
      ? 'engineer_vest'
      : this.config.attire === 'senator_navy'
      ? 'senator'
      : isFemale ? 'blue_dress' : 'engineer_vest';

    const hairstyleToUse = this.config.headwear === 'hardhat'
      ? 'hardhat'
      : this.config.headwear === 'braids'
      ? 'braids'
      : this.config.headwear === 'bob_wig'
      ? 'bob_wig'
      : this.config.headwear === 'gele'
      ? 'gele'
      : this.config.headwear === 'fila_cream'
      ? 'fila'
      : isFemale ? 'bob_wig' : 'hardhat';

    this.humanRig = HumanMeshBuilder.createHuman({
      gender: this.config.gender || 'male',
      username: this.config.name || 'Bayo',
      skinTone: this.config.skinTone,
      outfit: outfitType,
      outfitColor: attirePreset.color,
      hairstyle: hairstyleToUse,
    });

    this.mesh.add(this.humanRig.group);

    this.mesh.traverse((child) => {
      child.layers.set(RENDER_LAYERS.PLAYER);
    });
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
  }

  public stopEmote(): void {
    this.emoteTimer = 0;
    this.isMoving = false;
    this.currentEmote = 'idle';
  }

  public update(delta: number, keys?: Record<string, boolean>): void {
    if (this.isDriving && this.currentVehicle) {
      this.mesh.position.copy(this.currentVehicle.mesh.position);
      this.mesh.rotation.y = this.currentVehicle.mesh.rotation.y;
      return;
    }

    // 0. Keyboard Walking Controls (WASD / Arrow Keys)
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
        this.mesh.rotation.y = THREE.MathUtils.lerp(this.mesh.rotation.y, targetAngle, 0.25);
        this.mesh.position.addScaledVector(moveDir, this.speed * delta);
        this.isMoving = true;
        this.currentEmote = 'walk';

        this.animTime += delta;
        this.humanRig.updateAnimation(this.animTime, true);
        return;
      }
    }

    // 1. Moving state (Point and Click)
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
      } else {
        // Rotate smoothly
        const targetAngle = Math.atan2(direction.x, direction.z);
        this.mesh.rotation.y = THREE.MathUtils.lerp(this.mesh.rotation.y, targetAngle, 0.2);

        // Move forward
        direction.normalize();
        const moveDist = Math.min(distance, this.speed * delta);
        this.mesh.position.addScaledVector(direction, moveDist);

        this.animTime += delta;
        this.humanRig.updateAnimation(this.animTime, true);
        return;
      }
    }

    // 2. Emote Timer handling
    if (this.emoteTimer > 0) {
      this.emoteTimer -= delta;
      if (this.emoteTimer <= 0) {
        this.currentEmote = 'idle';
      }
    }

    // 3. Emotes / Idle Animations
    this.animTime += delta;

    if (this.currentEmote === 'zanku') {
      const beat = Math.sin(this.animTime * 14);
      this.humanRig.leftLeg.rotation.x = beat * 0.9;
      this.humanRig.rightArm.rotation.x = -beat * 0.8;
      this.humanRig.torso.position.y = (this.config.gender === 'female' ? 1.05 : 1.1) + Math.abs(beat) * 0.15;
    } else if (this.currentEmote === 'groove') {
      const sway = Math.sin(this.animTime * 6);
      this.humanRig.torso.rotation.z = sway * 0.15;
      this.humanRig.leftArm.rotation.z = Math.abs(sway) * 0.4;
      this.humanRig.rightArm.rotation.z = -Math.abs(sway) * 0.4;
    } else if (this.currentEmote === 'salute') {
      this.humanRig.rightArm.rotation.x = -Math.PI / 2.2;
      this.humanRig.rightArm.rotation.z = -Math.PI / 6;
    } else {
      // Natural idle breathing
      this.humanRig.updateAnimation(this.animTime, false);
    }
  }

  public setDriving(driving: boolean, vehicle: any = null): void {
    this.isDriving = driving;
    this.currentVehicle = vehicle;
    this.mesh.visible = !driving;
  }
}
