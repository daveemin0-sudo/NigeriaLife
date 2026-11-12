import * as THREE from 'three';

/**
 * Things that have not moved are not placed again.
 *
 * Every frame three.js rebuilds the placing of every object in the scene from its position,
 * turn and size, and then its place in the world from its parent's, whether or not anything
 * changed. The city is about 12,000 objects and nearly all of them (walls, roofs, roads, signs,
 * furniture) never move: measured on the street, that rebuilding was 38% of all the processor's
 * work in a frame.
 *
 * Here an object's placing is rebuilt only when its position, turn or size differ from last
 * time, or it has a new parent; and its place in the world only then, or when something above it
 * moved, or when asked for (matrixWorldNeedsUpdate), exactly as three.js would. What is drawn is
 * the same; an object that moves is seen to have moved the frame it does.
 *
 * And on the walk the renderer makes over the whole scene before each frame, whatever is switched
 * off (a district away from the player, a room not entered: three quarters of the objects) is
 * passed over with everything under it, since none of it is drawn. It is placed afresh, with
 * everything under it, on the first frame it is switched on again. Asking any object itself to
 * be placed (object.updateMatrixWorld, updateWorldMatrix, getWorldPosition) works on hidden
 * things as it always did: only the renderer's own walk passes them over.
 */

interface Kept {
  /** Passed over while switched off: placed afresh, with all under it, when next seen */
  hidden: boolean;
  parent: THREE.Object3D | null;
  px: number; py: number; pz: number;
  qx: number; qy: number; qz: number; qw: number;
  sx: number; sy: number; sz: number;
}

const KEPT = Symbol('nl.placed');
type Placed = THREE.Object3D & { [KEPT]?: Kept };

let installed = false;
/** The renderer's walk over the whole scene is under way */
let frameWalk = false;

/** Call once, before the world is made. */
export function installStillMatrices(): void {
  if (installed) return;
  installed = true;
  const place = function place(this: Placed, force?: boolean): void {
    if (frameWalk) {
      const seen = this[KEPT];
      if (!this.visible) {
        if (seen !== undefined) seen.hidden = true;
        return;
      }
      if (seen !== undefined && seen.hidden) {
        seen.hidden = false;
        force = true;
      }
    }
    if (this.matrixAutoUpdate) {
      const p = this.position;
      const q = this.quaternion;
      const s = this.scale;
      const k = this[KEPT];
      if (k === undefined) {
        this[KEPT] = { hidden: false, parent: this.parent, px: p.x, py: p.y, pz: p.z, qx: q.x, qy: q.y, qz: q.z, qw: q.w, sx: s.x, sy: s.y, sz: s.z };
        this.updateMatrix();
      } else if (
        k.px !== p.x || k.py !== p.y || k.pz !== p.z ||
        k.qx !== q.x || k.qy !== q.y || k.qz !== q.z || k.qw !== q.w ||
        k.sx !== s.x || k.sy !== s.y || k.sz !== s.z ||
        k.parent !== this.parent
      ) {
        k.parent = this.parent;
        k.px = p.x; k.py = p.y; k.pz = p.z;
        k.qx = q.x; k.qy = q.y; k.qz = q.z; k.qw = q.w;
        k.sx = s.x; k.sy = s.y; k.sz = s.z;
        this.updateMatrix();
      }
    }
    if (this.matrixWorldNeedsUpdate || force) {
      if (this.matrixWorldAutoUpdate === true) {
        if (this.parent === null) this.matrixWorld.copy(this.matrix);
        else this.matrixWorld.multiplyMatrices(this.parent.matrixWorld, this.matrix);
      }
      this.matrixWorldNeedsUpdate = false;
      force = true;
    }
    const children = this.children;
    for (let i = 0, l = children.length; i < l; i++) children[i].updateMatrixWorld(force);
  };
  THREE.Object3D.prototype.updateMatrixWorld = function updateMatrixWorld(this: Placed, force?: boolean): void {
    // The renderer's walk: the scene itself, not forced. Anything else is a part of the game asking for a thing to be placed.
    if (frameWalk || force || (this as unknown as THREE.Scene).isScene !== true) {
      place.call(this, force);
      return;
    }
    frameWalk = true;
    try {
      place.call(this, force);
    } finally {
      frameWalk = false;
    }
  };
}
