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
  male: { shoulders: 0.85, hips: 0.72, legsIn: 0.075, armsIn: 0.16, handsOpen: 0.85 },
  female: { shoulders: 0.9, hips: 0.85, legsIn: 0.055, armsIn: 0.1, handsOpen: 0.85 },
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

  // Standing still (or talking), a person stands straight: the bones are aimed, in the character's own
  // frame (+z its front, +x one side), toward an everyday stance, whatever the clip's fighting stance was
  const lowerArms = (['l', 'r'] as const).map((s) => bone(`lowerarm_${s}`));
  const hands = (['l', 'r'] as const).map((s) => bone(`hand_${s}`));
  const calves = (['l', 'r'] as const).map((s) => bone(`calf_${s}`));
  const spine = bone('spine_03');
  const neck = bone('neck_01');
  const head = bone('Head');
  const a = new THREE.Vector3();
  const c = new THREE.Vector3();
  const want = new THREE.Vector3();
  const aimTurn = new THREE.Quaternion();
  const footQ = new THREE.Quaternion();
  /** Turns `b` so the line from it to `child` points along `dir` (character frame), `weight` of the way */
  const aim = (b: THREE.Object3D | null, child: THREE.Object3D | null, dir: THREE.Vector3, weight: number) => {
    if (!b?.parent || !child || weight <= 0) return;
    child.updateWorldMatrix(true, false);
    b.getWorldPosition(a);
    child.getWorldPosition(c);
    c.sub(a).normalize();
    want.copy(dir).normalize().applyQuaternion(root.getWorldQuaternion(rootQ));
    aimTurn.setFromUnitVectors(c, want);
    if (weight < 1) aimTurn.slerp(new THREE.Quaternion(), 1 - weight);
    b.parent.getWorldQuaternion(parentQ);
    aimTurn.premultiply(parentQ.clone().invert()).multiply(parentQ);
    b.quaternion.premultiply(aimTurn);
  };
  const stand = (arms: number) => {
    // Upright: chest over the hips, head up
    aim(spine, neck, new THREE.Vector3(0, 1, 0.04), 0.7);
    aim(neck, head, new THREE.Vector3(0, 1, 0.08), 0.6);
    // Legs straight under the hips, the feet as they were (flat)
    legs.forEach((leg, i) => {
      if (!leg.thigh || !leg.foot) return;
      leg.foot.getWorldQuaternion(footQ);
      aim(leg.thigh, calves[i], new THREE.Vector3(leg.sign * 0.02, -1, 0.01), 1);
      aim(calves[i], leg.foot, new THREE.Vector3(0, -1, -0.03), 1);
      leg.foot.parent!.updateWorldMatrix(true, false);
      leg.foot.parent!.getWorldQuaternion(parentQ);
      leg.foot.quaternion.copy(parentQ.invert().multiply(footQ));
    });
    // Arms hanging by the sides, a soft bend at the elbow, not held out ready to fight
    if (arms > 0) {
      armsAll.forEach((arm, i) => {
        aim(arm.arm, lowerArms[i], new THREE.Vector3(arm.sign * 0.14, -1, 0.02), arms);
        aim(lowerArms[i], hands[i], new THREE.Vector3(arm.sign * 0.06, -1, 0.16), arms);
      });
    }
  };
  const armsAll = arms;

  // Every bone the posture turns, with the rotation the clip gave it this frame
  const touched: Array<{ b: THREE.Object3D; was: THREE.Quaternion }> = [];
  for (const leg of legs) for (const b of [leg.thigh, leg.foot]) if (b) touched.push({ b, was: b.quaternion.clone() });
  for (const a of arms) if (a.arm) touched.push({ b: a.arm, was: a.arm.quaternion.clone() });
  for (const f of fingers) touched.push({ b: f.b, was: f.b.quaternion.clone() });
  for (const b of [...lowerArms, ...hands, ...calves, spine, neck]) if (b) touched.push({ b, was: b.quaternion.clone() });
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
      // Standing about: straight and easy (talking keeps its hands free for the talk)
      if (state === 'idle') stand(0.9);
      else if (state === 'talk') stand(0);
      if (shape.handsOpen > 0) for (const f of fingers) f.b.quaternion.slerp(f.rest, shape.handsOpen);
    },
  };
}
