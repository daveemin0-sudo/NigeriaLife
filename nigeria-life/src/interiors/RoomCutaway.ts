import * as THREE from 'three';

/** How see-through something standing in the way becomes (0 = gone, 1 = solid) */
const SEE_THROUGH = 0.2;
/** How tall a cut-away outer wall is left */
const CUT_WALL_HEIGHT = 1.2;
/** Only things at least this tall can hide a standing person */
const MIN_BLOCKER_HEIGHT = 1.4;
/** Seconds between checks of what stands in the way */
const CHECK_EVERY = 0.08;
/** Something that was in the way stays see-through this long after it stops being, so it does not flicker */
const LINGER = 0.3;

type Materials = THREE.Material | THREE.Material[];

/** One piece of furniture or structure in a room, faded as a whole. */
interface Piece {
  root: THREE.Object3D;
  meshes: THREE.Mesh[];
  /** 1 = solid, 0 = invisible; eased toward `target` */
  fade: number;
  target: number;
  linger: number;
  swapped: boolean;
  solid: Map<THREE.Mesh, Materials>;
  clear: Map<THREE.Material, THREE.Material>;
  /** Hung on an outer wall or standing against it: goes when that wall is cut away */
  wall: Wall | null;
  /** Hung on the wall with nothing under it (a window, a banner): disappears with the wall instead of fading */
  mounted: boolean;
}

interface Wall {
  mesh: THREE.Object3D;
  axis: 'x' | 'z';
  /** Which side of the room it is on: -1 or 1 along its axis */
  side: number;
  /** 0 = full height, 1 = cut away; eased toward `want` */
  cut: number;
  want: number;
}

/**
 * Keeps the player in view inside a room. Outer walls between the camera and the room are
 * lowered, and anything else tall that comes between the camera and the player (a partition,
 * a shelf, a hanging light) turns see-through. Both ease in and out, hold for a moment before
 * coming back, and nothing but what is actually in the way is touched.
 */
export class RoomCutaway {
  private room: THREE.Object3D | null = null;
  private origin = new THREE.Vector3();
  private size = { width: 0, length: 0, height: 0 };
  private pieces: Piece[] = [];
  private targets: THREE.Mesh[] = [];
  private owner = new Map<THREE.Object3D, Piece>();
  private walls: Wall[] = [];
  private sinceCheck = CHECK_EVERY;
  private readonly raycaster = new THREE.Raycaster();
  private readonly from = new THREE.Vector3();
  private readonly to = new THREE.Vector3();
  private readonly direction = new THREE.Vector3();

  /** Begin looking after a room. Call when the player has been placed in it. */
  public attach(room: THREE.Object3D, origin: THREE.Vector3): void {
    this.detach();
    const shell = room.getObjectByName('interior_room_shell');
    const size = shell?.userData.size as { width: number; length: number; height: number } | undefined;
    if (!shell || !size) return;

    this.room = room;
    this.origin.copy(origin);
    this.size = size;
    room.updateWorldMatrix(true, true);

    const wall = (name: string, axis: 'x' | 'z', side: number) => {
      const mesh = shell.getObjectByName(name);
      if (mesh) this.walls.push({ mesh, axis, side, cut: 0, want: 0 });
    };
    wall('shell_wall_back', 'z', -1);
    wall('shell_wall_left', 'x', -1);
    wall('shell_wall_right', 'x', 1);

    const box = new THREE.Box3();
    const center = new THREE.Vector3();
    for (const root of room.children) {
      if (root === shell || root.name === 'interior_ground_plot' || root.name.startsWith('interior_npc_')) continue;
      const meshes: THREE.Mesh[] = [];
      root.traverse((child) => {
        const mesh = child as THREE.Mesh;
        if (mesh.isMesh && mesh.geometry) meshes.push(mesh);
      });
      if (meshes.length === 0) continue;
      box.setFromObject(root);
      if (box.isEmpty() || box.max.y - origin.y < MIN_BLOCKER_HEIGHT) continue;

      box.getCenter(center);
      const piece: Piece = {
        root, meshes, fade: 1, target: 1, linger: 0, swapped: false,
        solid: new Map(), clear: new Map(),
        wall: this.wallBeside(center.x - origin.x, center.z - origin.z),
        mounted: box.min.y - origin.y > 0.9,
      };
      this.pieces.push(piece);
      for (const mesh of meshes) {
        this.targets.push(mesh);
        this.owner.set(mesh, piece);
      }
    }
    this.sinceCheck = CHECK_EVERY;
  }

  /** The outer wall this spot is hard up against, if any. */
  private wallBeside(x: number, z: number): Wall | null {
    for (const wall of this.walls) {
      const half = (wall.axis === 'x' ? this.size.width : this.size.length) / 2;
      const along = wall.axis === 'x' ? x : z;
      if (Math.abs(along - wall.side * half) < 0.7) return wall;
    }
    return null;
  }

  /** Stop looking after the room and put everything back exactly as it was. */
  public detach(): void {
    for (const piece of this.pieces) {
      this.restore(piece);
      piece.root.visible = true;
      for (const material of piece.clear.values()) material.dispose();
    }
    for (const wall of this.walls) this.applyWall(wall, 0);
    this.room = null;
    this.pieces = [];
    this.targets = [];
    this.owner.clear();
    this.walls = [];
  }

  /**
   * Call every frame while inside. `snap` jumps straight to the right state, for the first
   * frame in a room, when nobody should see things fading into place.
   */
  public update(delta: number, camera: THREE.Camera, player: THREE.Vector3, snap = false): void {
    if (!this.room) return;

    // Outer walls: cut the ones the camera is looking over. A wall that has been cut stays cut
    // until the camera is well clear of it, so turning the view slowly cannot make it flicker.
    const dx = camera.position.x - this.origin.x;
    const dz = camera.position.z - this.origin.z;
    for (const wall of this.walls) {
      const half = (wall.axis === 'x' ? this.size.width : this.size.length) / 2;
      const beyond = (wall.axis === 'x' ? dx : dz) * wall.side;
      if (beyond > half - 2) wall.want = 1;
      else if (beyond < half - 3.5) wall.want = 0;
    }

    // What stands between the camera and the player
    this.sinceCheck += delta;
    if (snap || this.sinceCheck >= CHECK_EVERY) {
      this.sinceCheck = 0;
      for (const piece of this.pieces) piece.target = 1;
      this.from.copy(camera.position);
      for (const height of [1.55, 0.95]) {
        this.to.set(player.x, player.y + height, player.z);
        this.direction.subVectors(this.to, this.from);
        const distance = this.direction.length();
        if (distance < 0.5) continue;
        this.raycaster.set(this.from, this.direction.divideScalar(distance));
        this.raycaster.near = 0;
        this.raycaster.far = distance - 0.35;
        this.raycaster.layers.enableAll();
        for (const hit of this.raycaster.intersectObjects(this.targets, false)) {
          const piece = this.owner.get(hit.object);
          if (piece && piece.root.visible) {
            piece.target = SEE_THROUGH;
            piece.linger = LINGER;
          }
        }
      }
    }

    const ease = snap ? 1 : 1 - Math.exp(-delta * 9);
    for (const wall of this.walls) {
      wall.cut += (wall.want - wall.cut) * ease;
      if (Math.abs(wall.want - wall.cut) < 0.004) wall.cut = wall.want;
      this.applyWall(wall, wall.cut);
    }

    for (const piece of this.pieces) {
      let target = piece.target;
      if (target === 1 && piece.linger > 0) {
        piece.linger -= delta;
        target = SEE_THROUGH;
      }
      // Whatever is fixed to a wall that has been cut away goes with it
      if (piece.wall && piece.wall.want === 1) target = piece.mounted ? 0 : Math.min(target, SEE_THROUGH);

      if (piece.fade === target) continue;
      piece.fade += (target - piece.fade) * ease;
      if (Math.abs(target - piece.fade) < 0.01) piece.fade = target;
      this.applyFade(piece);
    }
  }

  private applyWall(wall: Wall, cut: number): void {
    const height = THREE.MathUtils.lerp(this.size.height, CUT_WALL_HEIGHT, cut);
    wall.mesh.scale.y = height / this.size.height;
    wall.mesh.position.y = height / 2;
  }

  private applyFade(piece: Piece): void {
    if (piece.fade >= 0.995) {
      this.restore(piece);
      piece.root.visible = true;
      return;
    }
    piece.root.visible = piece.fade > 0.03;
    if (!piece.root.visible) return;

    if (!piece.swapped) {
      piece.swapped = true;
      for (const mesh of piece.meshes) {
        piece.solid.set(mesh, mesh.material);
        mesh.material = Array.isArray(mesh.material)
          ? mesh.material.map((material) => this.clearVersion(piece, material))
          : this.clearVersion(piece, mesh.material);
      }
    }
    for (const [solid, clear] of piece.clear) {
      clear.opacity = solid.opacity * piece.fade;
    }
  }

  /** A see-through copy of a material, made once per piece: the room's materials are shared and must not change. */
  private clearVersion(piece: Piece, solid: THREE.Material): THREE.Material {
    let clear = piece.clear.get(solid);
    if (!clear) {
      clear = solid.clone();
      clear.transparent = true;
      clear.depthWrite = false;
      piece.clear.set(solid, clear);
    }
    return clear;
  }

  private restore(piece: Piece): void {
    if (!piece.swapped) return;
    piece.swapped = false;
    for (const [mesh, material] of piece.solid) mesh.material = material;
    piece.solid.clear();
  }

  /** For tests and debugging: what is cut away or see-through right now. */
  public state(): { cutWalls: string[]; seeThrough: string[]; hidden: string[] } {
    return {
      cutWalls: this.walls.filter((wall) => wall.cut > 0.5).map((wall) => wall.mesh.name),
      seeThrough: this.pieces.filter((piece) => piece.fade < 0.6 && piece.root.visible).map((piece) => piece.root.name || piece.root.type),
      hidden: this.pieces.filter((piece) => !piece.root.visible).map((piece) => piece.root.name || piece.root.type),
    };
  }

  /** Every piece is solid and every wall is at its full height or fully cut: nothing is mid-change. */
  public get settled(): boolean {
    return this.walls.every((wall) => wall.cut === wall.want)
      && this.pieces.every((piece) => piece.fade === 1 || piece.fade === SEE_THROUGH || piece.fade === 0);
  }
}
