import * as THREE from 'three';
import type { PlayerNetState } from './types';
import type { CharacterConfig, EmoteType } from '../player/CharacterCustomization';
import { createHumanForConfig } from '../player/HumanFromConfig';
import type { HumanRig } from '../graphics/HumanMeshBuilder';
import { createColorCanvasTexture } from '../utils/TextureUtils';
import { RENDER_LAYERS } from '../interiors/InteriorTypes';
import { Actor } from '../interactions/Actor';
import type { PoseState } from '../interactions/Poses';

/**
 * Another player seen in the world. They have the same body as the local player and are
 * animated by the same pose system, so a wave, a greeting or a handshake made on their
 * screen is seen here as it happens.
 */
export class RemotePlayer {
  public id: string;
  public name: string;
  public mesh: THREE.Group;
  public targetPosition: THREE.Vector3;
  public targetRotationY: number = 0;
  public isMoving: boolean = false;
  public currentEmote: EmoteType = 'idle';
  /** Drives the body while the other player is in the middle of a scripted action */
  public actor: Actor;

  private rig!: HumanRig;
  private look = '';
  private animTime: number = Math.random() * 10;
  /** What their body is doing in a scripted action, as last reported; null when walking about freely */
  private pose: PoseState | null = null;

  // Chat bubble (their name is on the body's own name tag)
  private chatBubbleSprite!: THREE.Sprite;
  private chatBubbleTimer: number = 0;

  constructor(initialState: PlayerNetState) {
    this.id = initialState.id;
    this.name = initialState.name;
    this.mesh = new THREE.Group();
    this.targetPosition = new THREE.Vector3(
      initialState.position.x,
      initialState.position.y,
      initialState.position.z
    );
    this.mesh.position.copy(this.targetPosition);
    this.targetRotationY = initialState.rotationY;
    this.mesh.rotation.y = this.targetRotationY;

    this.createShadow();
    this.rebuildBody(initialState.config);
    // Not registered with the interaction director: nothing on this side may direct another player's body
    this.actor = new Actor({ id: `remote:${this.id}`, name: this.name, root: this.mesh, getRig: () => this.rig });
    this.createChatBubble();
    this.applyState(initialState);
  }

  private createShadow(): void {
    const shadow = new THREE.Mesh(
      new THREE.CircleGeometry(0.55, 16),
      new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.35 })
    );
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.y = 0.02;
    this.mesh.add(shadow);
  }

  /** Builds the body for their chosen look, only when that look has changed. */
  private rebuildBody(config: CharacterConfig): void {
    const look = JSON.stringify([config.name, config.gender, config.skinTone, config.attire, config.headwear]);
    if (look === this.look) return;
    this.look = look;
    if (this.rig) this.mesh.remove(this.rig.group);
    this.rig = createHumanForConfig(config);
    this.mesh.add(this.rig.group);
    this.applyLayers();
  }

  /** Other players are part of the street scene, never of an interior. */
  private applyLayers(): void {
    this.mesh.traverse((child) => {
      child.layers.set(RENDER_LAYERS.STREET);
    });
  }

  private createChatBubble(): void {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 128;
    const texture = createColorCanvasTexture(canvas);
    const spriteMat = new THREE.SpriteMaterial({ map: texture, transparent: true });
    this.chatBubbleSprite = new THREE.Sprite(spriteMat);
    this.chatBubbleSprite.position.set(0, 3.1, 0);
    this.chatBubbleSprite.scale.set(2.8, 0.7, 1);
    this.chatBubbleSprite.visible = false;
    this.mesh.add(this.chatBubbleSprite);
    this.applyLayers();
  }

  public showSpeechBubble(text: string): void {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 128;
    const ctx = canvas.getContext('2d')!;

    ctx.fillStyle = '#ffffff';
    ctx.roundRect(16, 16, 480, 80, 20);
    ctx.fill();

    ctx.strokeStyle = '#008751';
    ctx.lineWidth = 4;
    ctx.roundRect(16, 16, 480, 80, 20);
    ctx.stroke();

    ctx.font = 'bold 26px sans-serif';
    ctx.fillStyle = '#111827';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text.length > 30 ? text.substring(0, 28) + '...' : text, 256, 56);

    this.chatBubbleSprite.material.map = createColorCanvasTexture(canvas);
    this.chatBubbleSprite.material.map.needsUpdate = true;
    this.chatBubbleSprite.visible = true;
    this.chatBubbleTimer = 5.0; // Show for 5 seconds
  }

  public applyState(state: PlayerNetState): void {
    this.targetPosition.set(state.position.x, state.position.y, state.position.z);
    this.targetRotationY = state.rotationY;
    this.isMoving = state.isMoving;
    this.currentEmote = state.currentEmote;
    this.name = state.name;
    // Someone inside a building is not on the street to be seen, and someone driving is inside their vehicle
    this.mesh.visible = !state.place && !state.driving;
    this.pose = state.pose ? { legs: state.pose.legs, arms: state.pose.arms, height: state.pose.height } : null;
    this.rebuildBody(state.config);

    if (state.chatBubble && Date.now() - state.chatBubble.timestamp < 5000) {
      this.showSpeechBubble(state.chatBubble.text);
    }
  }

  public update(delta: number): void {
    // Smooth position interpolation
    this.mesh.position.lerp(this.targetPosition, Math.min(delta * 12, 1));

    // Smooth rotation interpolation, the short way round
    const turn = Math.atan2(Math.sin(this.targetRotationY - this.mesh.rotation.y), Math.cos(this.targetRotationY - this.mesh.rotation.y));
    this.mesh.rotation.y += turn * Math.min(1, delta * 12);

    // Chat bubble timer
    if (this.chatBubbleTimer > 0) {
      this.chatBubbleTimer -= delta;
      if (this.chatBubbleTimer <= 0) {
        this.chatBubbleSprite.visible = false;
      }
    }

    // In a scripted action on their screen (waving, shaking hands, sitting): the same pose here
    if (this.pose) {
      this.actor.setScripted(true);
      this.actor.pose = this.pose;
      this.actor.update(delta);
      return;
    }
    this.actor.setScripted(false);

    this.animTime += delta;
    if (this.isMoving) {
      this.rig.updateAnimation(this.animTime, this.currentEmote === 'run' ? 'run' : 'walk');
    } else if (this.currentEmote === 'salute') {
      this.rig.updateAnimation(this.animTime, 'idle');
      this.rig.rightArm.rotation.x = -Math.PI / 2.2;
      this.rig.rightArm.rotation.z = -Math.PI / 6;
    } else if (this.currentEmote === 'zanku' || this.currentEmote === 'groove' || this.currentEmote === 'dance') {
      this.rig.updateAnimation(this.animTime, 'dance');
    } else if (this.currentEmote === 'talk' || this.currentEmote === 'phone_call') {
      this.rig.updateAnimation(this.animTime, this.currentEmote);
    } else {
      this.rig.updateAnimation(this.animTime, 'idle');
    }
  }
}
