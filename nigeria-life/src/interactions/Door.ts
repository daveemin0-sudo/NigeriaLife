import * as THREE from 'three';

export interface HingedDoorOptions {
  width: number;
  height: number;
  material: THREE.Material;
  /** Angle the leaf turns to when open; the sign picks which way it swings. */
  swing?: number;
  thickness?: number;
}

/**
 * A door leaf on a hinge. The group's origin is the middle of the doorway at floor level
 * and the door faces local +Z.
 */
export class HingedDoor {
  public readonly group: THREE.Group;
  private readonly pivot: THREE.Group;
  private readonly swing: number;
  private amount = 0;
  private target = 0;

  constructor(options: HingedDoorOptions) {
    this.swing = options.swing ?? -1.75;
    this.group = new THREE.Group();
    this.group.name = 'hinged_door';

    this.pivot = new THREE.Group();
    this.pivot.position.set(-options.width / 2, 0, 0);
    this.group.add(this.pivot);

    const leaf = new THREE.Mesh(
      new THREE.BoxGeometry(options.width, options.height, options.thickness ?? 0.07),
      options.material
    );
    leaf.position.set(options.width / 2, options.height / 2, 0);
    leaf.castShadow = true;
    this.pivot.add(leaf);

    const handle = new THREE.Mesh(
      new THREE.BoxGeometry(0.06, 0.22, 0.16),
      new THREE.MeshStandardMaterial({ color: 0xd4af37, metalness: 0.7, roughness: 0.35 })
    );
    handle.position.set(options.width - 0.14, options.height * 0.46, 0);
    this.pivot.add(handle);
  }

  public open(): void {
    this.target = 1;
  }

  public close(): void {
    this.target = 0;
  }

  /** Jump straight to open or closed, for when nobody is watching the door move. */
  public set(open: boolean): void {
    this.target = open ? 1 : 0;
    this.amount = this.target;
    this.pivot.rotation.y = this.swing * this.amount;
  }

  /** 0 = shut, 1 = fully open */
  public get openAmount(): number {
    return this.amount;
  }

  public get isOpen(): boolean {
    return this.amount > 0.93;
  }

  public get isClosed(): boolean {
    return this.amount < 0.02;
  }

  public update(delta: number): void {
    if (this.amount === this.target) return;
    const step = delta * 2.6;
    this.amount = this.target > this.amount
      ? Math.min(this.target, this.amount + step)
      : Math.max(this.target, this.amount - step);
    // Ease in and out so the leaf does not start or stop abruptly
    const eased = this.amount * this.amount * (3 - 2 * this.amount);
    this.pivot.rotation.y = this.swing * eased;
  }
}
