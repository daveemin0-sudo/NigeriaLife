import * as THREE from 'three';
import type { HumanRig } from '../graphics/HumanMeshBuilder';
import {
  type PoseState, type JointValues,
  neutralJoints, poseTargets, easeJoints, writeJoints, readJoints,
} from './Poses';
import type { Sequence } from './Sequence';

/** Something that pins an actor in place (a seat, say) and must be undone before they can move. */
export interface ActorHold {
  /** `instant` skips any getting-up animation, for when the scene is being torn down. */
  release: (instant?: boolean) => void;
}

export interface ActorOptions {
  id: string;
  name: string;
  /** The object that is moved and turned. Its parents must not be rotated or scaled. */
  root: THREE.Object3D;
  /** Read each frame, because the player's body is rebuilt when they change their look. */
  getRig: () => HumanRig | null;
  speed?: number;
}

const scratch = new THREE.Vector3();

/**
 * A character the interaction system can direct: the player or any NPC.
 * While `scripted` is set, the character's usual owner leaves the body alone and the
 * interaction system moves and animates it.
 */
export class Actor {
  public readonly id: string;
  public readonly name: string;
  public readonly root: THREE.Object3D;
  public speed: number;

  public scripted = false;
  public pose: PoseState = { legs: 'stand', arms: 'rest' };
  public sequence: Sequence | null = null;
  public hold: ActorHold | null = null;
  public carried: THREE.Object3D | null = null;
  /** Where this actor faces when left alone (NPCs return to it after turning to someone). */
  public homeYaw: number;

  private readonly getRig: () => HumanRig | null;
  private time = Math.random() * 10;
  private joints: JointValues = neutralJoints();
  private target: JointValues = neutralJoints();
  private baseTorsoY: number | null = null;
  private lastRig: HumanRig | null = null;
  private bubble: THREE.Sprite | null = null;
  private bubbleTime = 0;

  constructor(options: ActorOptions) {
    this.id = options.id;
    this.name = options.name;
    this.root = options.root;
    this.getRig = options.getRig;
    this.speed = options.speed ?? 2.8;
    this.homeYaw = this.root.rotation.y;
  }

  /** In the middle of a scripted sequence that has not ended yet. */
  public get busy(): boolean {
    return this.sequence !== null && this.sequence.ended === null;
  }

  /** Busy with something that should not be broken off for small talk (serving a table, ringing up a sale). */
  public get engaged(): boolean {
    return this.busy && !this.sequence!.casual;
  }

  public get yaw(): number {
    return this.root.rotation.y;
  }

  public set yaw(value: number) {
    this.root.rotation.y = value;
  }

  public worldPosition(out: THREE.Vector3 = new THREE.Vector3()): THREE.Vector3 {
    return this.root.getWorldPosition(out);
  }

  public setWorldPosition(x: number, z: number): void {
    scratch.set(x, 0, z);
    if (this.root.parent) {
      this.root.parent.updateWorldMatrix(true, false);
      this.root.parent.worldToLocal(scratch);
    }
    this.root.position.x = scratch.x;
    this.root.position.z = scratch.z;
  }

  /** Is this actor in a scene that is currently being shown? */
  public isVisible(): boolean {
    for (let node: THREE.Object3D | null = this.root; node; node = node.parent) {
      if (!node.visible) return false;
    }
    return true;
  }

  public setScripted(on: boolean): void {
    if (this.scripted === on) return;
    this.scripted = on;
    const rig = this.getRig();
    if (!rig) return;
    if (on) {
      this.adoptRig(rig);
    } else {
      // Hand the body back standing upright, whatever it was doing
      this.pose = { legs: 'stand', arms: 'rest' };
      writeJoints(rig, neutralJoints(), this.baseTorsoY ?? rig.torso.position.y);
      this.joints = neutralJoints();
    }
  }

  private adoptRig(rig: HumanRig): void {
    if (this.lastRig !== rig) {
      this.lastRig = rig;
      this.baseTorsoY = rig.torso.position.y;
    }
    readJoints(rig, this.baseTorsoY ?? rig.torso.position.y, this.joints);
  }

  /** Turns toward a heading. Returns true once facing it. */
  public turnToward(yaw: number, delta: number, rate = 9): boolean {
    const diff = Math.atan2(Math.sin(yaw - this.yaw), Math.cos(yaw - this.yaw));
    if (Math.abs(diff) < 0.04) {
      this.yaw = yaw;
      return true;
    }
    this.yaw += diff * Math.min(1, delta * rate);
    return false;
  }

  public headingTo(point: THREE.Vector3): number {
    const here = this.worldPosition(scratch);
    return Math.atan2(point.x - here.x, point.z - here.z);
  }

  /** Puts an object in the actor's hands. */
  public carry(object: THREE.Object3D): void {
    this.carried = object;
    this.root.add(object);
    object.position.set(0, 1.02, 0.5);
    object.rotation.set(0, 0, 0);
    object.traverse((child) => { child.layers.mask = this.root.layers.mask; });
  }

  /** Takes the carried object out of the actor's hands without placing it anywhere. */
  public letGo(): THREE.Object3D | null {
    const object = this.carried;
    this.carried = null;
    if (object) this.root.remove(object);
    return object;
  }

  /** Shows a short line above the actor's head, so what they say is seen in the world. */
  public say(text: string, seconds = 2.6): void {
    this.clearBubble();
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 96;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.font = '600 34px Inter, system-ui, sans-serif';
    const width = Math.min(496, Math.ceil(ctx.measureText(text).width) + 56);
    const left = (512 - width) / 2;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.96)';
    ctx.beginPath();
    ctx.roundRect(left, 8, width, 72, 30);
    ctx.fill();
    ctx.fillStyle = '#1c1917';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, 256, 45, 470);

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, depthTest: false, transparent: true }));
    sprite.scale.set(3.4, 0.64, 1);
    sprite.position.y = 2.95;
    sprite.renderOrder = 20;
    sprite.layers.mask = this.root.layers.mask;
    this.root.add(sprite);
    this.bubble = sprite;
    this.bubbleTime = seconds;
  }

  private clearBubble(): void {
    if (!this.bubble) return;
    this.root.remove(this.bubble);
    this.bubble.material.map?.dispose();
    this.bubble.material.dispose();
    this.bubble = null;
  }

  public update(delta: number): void {
    if (this.bubble) {
      this.bubbleTime -= delta;
      if (this.bubbleTime <= 0) this.clearBubble();
    }
    if (!this.scripted) return;
    const rig = this.getRig();
    if (!rig) return;
    if (this.lastRig !== rig) this.adoptRig(rig);

    this.time += delta;
    poseTargets(this.pose, this.time, this.target);
    easeJoints(this.joints, this.target, 1 - Math.exp(-delta * 14));
    writeJoints(rig, this.joints, this.baseTorsoY ?? rig.torso.position.y);
  }
}
