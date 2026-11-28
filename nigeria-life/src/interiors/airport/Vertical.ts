import * as THREE from 'three';
import type { Actor } from '../../interactions/Actor';
import type { Step } from '../../interactions/Sequence';

/**
 * Going up and down a level: a moving escalator (glass balustrades, black handrails, steps that
 * really travel) and a glass lift whose car rises and falls in its shaft with sliding doors.
 * Each is built in a holder placed where its foot (or its doors) stand on the floor; it rises
 * toward the holder's -z.
 */

const steel = new THREE.MeshStandardMaterial({ color: 0xb8bec6, metalness: 0.75, roughness: 0.28 });
const dark = new THREE.MeshStandardMaterial({ color: 0x1c1f24, metalness: 0.3, roughness: 0.55 });
const glass = new THREE.MeshStandardMaterial({ color: 0xbfe0f2, transparent: true, opacity: 0.22, roughness: 0.05, metalness: 0.2, depthWrite: false, side: THREE.DoubleSide });
const stepMat = new THREE.MeshStandardMaterial({ color: 0x6b7280, metalness: 0.6, roughness: 0.4 });
const comb = new THREE.MeshStandardMaterial({ color: 0xd4a72c, metalness: 0.5, roughness: 0.4 });

export interface EscalatorSpec {
  /** The middle of its foot on the floor, and the way it rises (its holder's yaw: 0 rises toward -z) */
  x: number;
  z: number;
  yaw?: number;
  /** Height climbed, and the floor run of the incline */
  rise: number;
  run: number;
  width?: number;
  /** Steps going up (true) or coming down */
  up: boolean;
}

export class Escalator {
  public readonly group = new THREE.Group();
  private readonly steps: THREE.InstancedMesh;
  private readonly count: number;
  private readonly spacing = 0.42;
  private readonly length: number;
  private readonly angle: number;
  private readonly up: boolean;
  private offset = 0;
  private readonly m = new THREE.Matrix4();
  private readonly p = new THREE.Vector3();
  private readonly q = new THREE.Quaternion();
  private readonly s = new THREE.Vector3(1, 1, 1);

  constructor(spec: EscalatorSpec) {
    const w = spec.width ?? 1.1;
    this.up = spec.up;
    this.angle = Math.atan2(spec.rise, spec.run);
    this.length = Math.hypot(spec.rise, spec.run);
    this.group.position.set(spec.x, 0, spec.z);
    this.group.rotation.y = spec.yaw ?? 0;
    this.group.name = 'escalator';
    const incline = (geo: THREE.BufferGeometry, mat: THREE.Material, across: number, lift: number) => {
      const mesh = new THREE.Mesh(geo, mat);
      mesh.rotation.x = this.angle;
      mesh.position.set(across, spec.rise / 2 + lift, -spec.run / 2);
      this.group.add(mesh);
      return mesh;
    };
    // The truss under it, clad in steel, and the dark skirts each side of the steps
    incline(new THREE.BoxGeometry(w + 0.3, 0.7, this.length + 0.6), steel, 0, -0.45);
    for (const side of [-1, 1]) {
      incline(new THREE.BoxGeometry(0.08, 0.35, this.length), dark, side * (w / 2 + 0.06), 0.1);
      // The glass balustrade and its handrail
      incline(new THREE.BoxGeometry(0.03, 0.9, this.length + 0.4), glass, side * (w / 2 + 0.08), 0.62);
      incline(new THREE.BoxGeometry(0.1, 0.07, this.length + 0.9), dark, side * (w / 2 + 0.08), 1.1);
    }
    // Flat comb plates at the foot and the top, where the steps go under the floor
    const footPlate = new THREE.Mesh(new THREE.BoxGeometry(w + 0.2, 0.04, 1.1), comb);
    footPlate.position.set(0, 0.02, 0.45);
    const topPlate = new THREE.Mesh(new THREE.BoxGeometry(w + 0.2, 0.04, 1.1), comb);
    topPlate.position.set(0, spec.rise + 0.02, -spec.run - 0.45);
    this.group.add(footPlate, topPlate);
    // The newels: the rounded ends of the handrails at each landing
    for (const side of [-1, 1]) {
      for (const [y, z] of [[0, 0.5], [spec.rise, -spec.run - 0.5]] as const) {
        const newel = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 1.05, 10), dark);
        newel.position.set(side * (w / 2 + 0.08), y + 0.52, z);
        this.group.add(newel);
      }
    }
    // The steps, one instance each, moving along the incline
    this.count = Math.ceil(this.length / this.spacing) + 1;
    this.steps = new THREE.InstancedMesh(new THREE.BoxGeometry(w, 0.06, this.spacing - 0.03), stepMat, this.count);
    this.steps.name = 'escalator steps';
    this.group.add(this.steps);
    this.place();
  }

  private place(): void {
    for (let i = 0; i < this.count; i++) {
      const u = (i * this.spacing + this.offset) % (this.count * this.spacing);
      const t = Math.min(u, this.length);
      this.p.set(0, Math.sin(this.angle) * t + 0.03, -Math.cos(this.angle) * t);
      this.m.compose(this.p, this.q, this.s);
      this.steps.setMatrixAt(i, this.m);
    }
    this.steps.instanceMatrix.needsUpdate = true;
  }

  public tick(delta: number): void {
    const loop = this.count * this.spacing;
    this.offset = (this.offset + (this.up ? 1 : -1) * 0.5 * delta + loop) % loop;
    this.place();
  }
}

/** Riding a moving stair: carried from one point to another, rising (or falling) as it goes */
export function rideStair(actor: Actor, from: THREE.Vector3, to: THREE.Vector3, fromY: number, toY: number, seconds: number): Step {
  let t = 0;
  return {
    name: 'ride the escalator',
    begin() {
      t = 0;
      actor.pose = { legs: 'stand', arms: 'rest' };
      actor.yaw = Math.atan2(to.x - from.x, to.z - from.z);
    },
    tick(delta) {
      t = Math.min(1, t + delta / seconds);
      actor.setWorldPosition(from.x + (to.x - from.x) * t, from.z + (to.z - from.z) * t);
      actor.root.position.y = fromY + (toY - fromY) * t;
      return t >= 1;
    },
  };
}

export interface LiftSpec {
  /** The middle of the shaft on the floor, and the way its doors face (0: toward +z) */
  x: number;
  z: number;
  yaw?: number;
  /** How far the car travels up from this floor (negative: down, for a lift seen from upstairs) */
  travel: number;
  /** How tall the shaft is drawn above this floor */
  shaft: number;
  /** How far the shaft goes on below this floor (seen from upstairs, through the hole it stands in) */
  below?: number;
}

export class GlassLift {
  public readonly group = new THREE.Group();
  private readonly car = new THREE.Group();
  private readonly left: THREE.Mesh;
  private readonly right: THREE.Mesh;
  private carTarget = 0;
  private open = 0;
  private openTarget = 0;
  private readonly travel: number;

  constructor(spec: LiftSpec) {
    this.travel = spec.travel;
    this.group.position.set(spec.x, 0, spec.z);
    this.group.rotation.y = spec.yaw ?? 0;
    this.group.name = 'glass lift';
    const below = spec.below ?? 0;
    const tall = spec.shaft + below;
    const size = 1.9;
    // Four steel corner posts and glass between them; the front left open for the doors
    for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]] as const) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.1, tall, 0.1), steel);
      post.position.set((x * size) / 2, tall / 2 - below, (z * size) / 2);
      this.group.add(post);
    }
    for (const [x, z, ry] of [[0, -size / 2, 0], [-size / 2, 0, Math.PI / 2], [size / 2, 0, Math.PI / 2]] as const) {
      const pane = new THREE.Mesh(new THREE.BoxGeometry(size, tall, 0.03), glass);
      pane.position.set(x, tall / 2 - below, z);
      pane.rotation.y = ry;
      this.group.add(pane);
    }
    // The front above the doors, glazed too, and a frame round the door opening
    const over = new THREE.Mesh(new THREE.BoxGeometry(size, tall - 2.3, 0.03), glass);
    over.position.set(0, 2.3 + (tall - 2.3) / 2 - below, size / 2);
    const head = new THREE.Mesh(new THREE.BoxGeometry(size, 0.12, 0.12), steel);
    head.position.set(0, 2.3, size / 2);
    this.group.add(over, head);
    // The car: floor, a back rail, a ceiling with its light, its own glass walls
    const floor = new THREE.Mesh(new THREE.BoxGeometry(size - 0.15, 0.12, size - 0.15), steel);
    floor.position.y = -0.06;
    const ceiling = new THREE.Mesh(new THREE.BoxGeometry(size - 0.15, 0.08, size - 0.15), steel);
    ceiling.position.y = 2.35;
    const light = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.02, 1.1), new THREE.MeshBasicMaterial({ color: 0xfff7e0 }));
    light.position.y = 2.3;
    const rail = new THREE.Mesh(new THREE.BoxGeometry(size - 0.4, 0.05, 0.05), steel);
    rail.position.set(0, 0.95, -size / 2 + 0.18);
    this.car.add(floor, ceiling, light, rail);
    this.group.add(this.car);
    // The landing doors: two glass leaves that slide apart
    const leaf = new THREE.BoxGeometry(size / 2 - 0.02, 2.2, 0.04);
    const doorMat = new THREE.MeshStandardMaterial({ color: 0xd9eef8, transparent: true, opacity: 0.45, roughness: 0.1, metalness: 0.4, depthWrite: false });
    this.left = new THREE.Mesh(leaf, doorMat);
    this.right = new THREE.Mesh(leaf, doorMat);
    this.left.position.set(-size / 4, 1.12, size / 2 + 0.04);
    this.right.position.set(size / 4, 1.12, size / 2 + 0.04);
    // The call button beside the doors
    const panel = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.26, 0.05), dark);
    panel.position.set(size / 2 + 0.2, 1.2, size / 2 + 0.03);
    const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, 0.02), new THREE.MeshBasicMaterial({ color: 0x38bdf8 }));
    lamp.position.set(size / 2 + 0.2, 1.24, size / 2 + 0.06);
    this.group.add(this.left, this.right, panel, lamp);
  }

  /** How far the car travels from this floor to the other */
  public get reach(): number {
    return this.travel;
  }

  /** The car's height now, above this floor */
  public get carY(): number {
    return this.car.position.y;
  }

  /** At this floor (0) or the other one (1) */
  public send(level: 0 | 1): void {
    this.carTarget = level === 0 ? 0 : this.travel;
  }

  public doors(open: boolean): void {
    this.openTarget = open ? 1 : 0;
  }

  public tick(delta: number): void {
    const dy = this.carTarget - this.car.position.y;
    this.car.position.y += Math.sign(dy) * Math.min(Math.abs(dy), 1.4 * delta);
    this.open += (this.openTarget - this.open) * Math.min(1, delta * 5);
    const w = 1.9 / 4;
    this.left.position.x = -w - this.open * 0.88;
    this.right.position.x = w + this.open * 0.88;
  }
}

/** Waits until something is so (the car has come, the doors have opened) */
export function until(name: string, done: () => boolean, most = 8): Step {
  let t = 0;
  return {
    name,
    begin() { t = 0; },
    tick(delta) {
      t += delta;
      return done() || t >= most;
    },
  };
}

/** Riding the lift car to a level: the passenger goes up (or down) with it, standing on its floor */
export function rideLift(actor: Actor, lift: GlassLift, level: 0 | 1, baseY = 0): Step {
  return {
    name: 'ride the lift',
    begin() {
      lift.send(level);
    },
    tick() {
      actor.root.position.y = baseY + lift.carY;
      return Math.abs(lift.carY - (level === 0 ? 0 : lift.reach)) < 0.01;
    },
  };
}
