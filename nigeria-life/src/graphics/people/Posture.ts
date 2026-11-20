import * as THREE from 'three';

/**
 * An everyday Nigerian posture for the character models.
 *
 * The free base body is built (and animated) like a superhero: shoulders and hips set wide, legs
 * planted apart, arms held out from the body, fists clenched. Mesh slimming alone cannot change
 * that, because it is in the skeleton. So, once at load, the shoulders and hips are brought in
 * (the arm and leg bones sit closer to the spine), and after every animation frame the legs are
 * drawn together under the hips, the arms hang by the sides and the hands relax open.
 *
 * Only upright states are corrected; sitting, kneeling, lying and driving keep their clips.
 */
export interface PostureShape {
  /** How far out the shoulders sit, 1 = as built */
  shoulders: number;
  /** How far apart the hip joints sit, 1 = as built */
  hips: number;
  /** Legs drawn in toward each other (radians, each leg) */
  legsIn: number;
  /** Arms brought in to the sides (radians, each arm) */
  armsIn: number;
  /** How far the fingers relax from the clip's grip back toward an open hand (0 to 1) */
  handsOpen: number;
}

export const POSTURE: Record<'male' | 'female', PostureShape> = {
  male: { shoulders: 0.85, hips: 0.72, legsIn: 0.075, armsIn: 0.16, handsOpen: 0.6 },
  female: { shoulders: 0.9, hips: 0.85, legsIn: 0.055, armsIn: 0.1, handsOpen: 0.6 },
};

/** Clips the posture leaves alone: the body is folded, lying, or holding a wheel */
const UNTOUCHED = new Set(['sit', 'sit_talk', 'sit_enter', 'sit_exit', 'drive', 'fall', 'lie', 'kneel', 'crouch_walk', 'fix']);

const FINGER = /^(thumb|index|middle|ring|pinky)_0\d_[lr]$/;

export interface Posture {
  /** Before the mixer poses the next frame: the bones as the clip left them (a bone a clip does not move must not drift) */
  restore(): void;
  /** After the mixer has posed the skeleton for this frame */
  apply(state: string): void;
}

export function makePosture(root: THREE.Object3D, scene: THREE.Object3D, shape: PostureShape): Posture {
  const bone = (name: string) => scene.getObjectByName(name) ?? null;
  const v = new THREE.Vector3();
  const w = new THREE.Vector3();

  // Where a joint sits sideways, in the character's own space (+ one side, - the other)
  const side = (b: THREE.Object3D) => Math.sign(root.worldToLocal(b.getWorldPosition(v)).x) || 1;

  /** Moves a joint sideways toward the middle of the body, keeping its height and depth */
  const narrow = (name: string, factor: number) => {
    const b = bone(name);
    if (!b?.parent || factor === 1) return;
    root.updateMatrixWorld(true);
    const local = root.worldToLocal(b.getWorldPosition(v));
    const centre = root.worldToLocal(b.parent.getWorldPosition(w));
    local.x = centre.x + (local.x - centre.x) * factor;
    b.parent.worldToLocal(root.localToWorld(local));
    b.position.copy(local);
  };
  narrow('upperarm_l', shape.shoulders);
  narrow('upperarm_r', shape.shoulders);
  narrow('thigh_l', shape.hips);
  narrow('thigh_r', shape.hips);
  root.updateMatrixWorld(true);

  const legs = (['l', 'r'] as const).map((s) => ({ thigh: bone(`thigh_${s}`), foot: bone(`foot_${s}`), sign: 0 }));
  const arms = (['l', 'r'] as const).map((s) => ({ arm: bone(`upperarm_${s}`), sign: 0 }));
  for (const leg of legs) if (leg.thigh) leg.sign = side(leg.thigh);
  for (const a of arms) if (a.arm) a.sign = side(a.arm);
  // The fingers at rest (as built: an open hand), to relax each clip's grip toward
  const fingers: Array<{ b: THREE.Object3D; rest: THREE.Quaternion }> = [];
  scene.traverse((o) => { if (FINGER.test(o.name)) fingers.push({ b: o, rest: o.quaternion.clone() }); });

  const forward = new THREE.Vector3();
  const rootQ = new THREE.Quaternion();
  const parentQ = new THREE.Quaternion();
  const turn = new THREE.Quaternion();
  /** Turns a bone about the character's own front-to-back axis, in world terms, by `angle` */
  const swing = (b: THREE.Object3D, angle: number) => {
    if (!b.parent || !angle) return;
    b.parent.updateWorldMatrix(true, false);
    b.parent.getWorldQuaternion(parentQ);
    forward.set(0, 0, 1).applyQuaternion(root.getWorldQuaternion(rootQ));
    turn.setFromAxisAngle(forward, angle);
    // The same turn written in the parent's frame, put before the bone's own rotation
    turn.premultiply(parentQ.clone().invert()).multiply(parentQ);
    b.quaternion.premultiply(turn);
  };

  // Every bone the posture turns, with the rotation the clip gave it this frame
  const touched: Array<{ b: THREE.Object3D; was: THREE.Quaternion }> = [];
  for (const leg of legs) for (const b of [leg.thigh, leg.foot]) if (b) touched.push({ b, was: b.quaternion.clone() });
  for (const a of arms) if (a.arm) touched.push({ b: a.arm, was: a.arm.quaternion.clone() });
  for (const f of fingers) touched.push({ b: f.b, was: f.b.quaternion.clone() });
  let applied = false;

  return {
    restore() {
      if (!applied) return;
      for (const t of touched) t.b.quaternion.copy(t.was);
      applied = false;
    },
    apply(state: string) {
      if (UNTOUCHED.has(state)) return;
      for (const t of touched) t.was.copy(t.b.quaternion);
      applied = true;
      for (const leg of legs) {
        if (!leg.thigh) continue;
        // A foot hanging under a joint on the + side swings toward the middle with a negative turn
        swing(leg.thigh, -leg.sign * shape.legsIn);
        if (leg.foot) swing(leg.foot, leg.sign * shape.legsIn); // the sole stays flat on the ground
      }
      for (const a of arms) if (a.arm) swing(a.arm, -a.sign * shape.armsIn);
      if (shape.handsOpen > 0) for (const f of fingers) f.b.quaternion.slerp(f.rest, shape.handsOpen);
    },
  };
}
