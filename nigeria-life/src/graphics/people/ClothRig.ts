import * as THREE from 'three';

/**
 * The cloth rig: hanging cloth (skirts, gowns, tunics, the agbada) is skinned to bones under the pelvis that no
 * animation moves (tools/characters/build_ubc.mjs adds them, in a skin only those garments use): the front, the back
 * and the two sides of the cloth, each with a lower part from the knees down. Every frame, after the clip and the
 * everyday posture, they are turned from the legs:
 *
 * - the front with whichever leg is further forward (never back past hanging straight), its lower part bending at
 *   that leg's knee: the front of a skirt covers the leading knee in a stride and lies over the lap when seated;
 * - the back with whichever leg is further behind (never forward past hanging straight), its lower part bending
 *   with that leg's knee: the back follows the trailing leg, and when seated folds forward under the thighs;
 * - each side with its own leg, but only once that leg swings from how it stands: at rest the sides do not move, so
 *   the standing line of the garment is exactly as it was built. A leg going out sideways past its rest (as when the
 *   everyday stance lets go on sitting down) takes its side of the cloth out with it.
 *
 * Bones alone cannot lay cloth over a lap, so each hanging garment also has a seated shape (a morph target solved by
 * tools/characters/add_seated.mjs). It blends in with the lift of the thighs, so there is no jump between the two.
 *
 * All in the pelvis's own frame, from the bones' local transforms (no world matrices needed mid-frame).
 */
export class ClothRig {
  private readonly L = new THREE.Vector3();
  private readonly D = new THREE.Vector3();
  private readonly F = new THREE.Vector3();
  private sign = 1;
  private readonly rest = { thigh: [0, 0], calf: [0, 0] };
  private readonly t = { hip: new THREE.Vector3(), knee: new THREE.Vector3(), ankle: new THREE.Vector3(), v: new THREE.Vector3(), q: new THREE.Quaternion() };

  private readonly legs: Array<{ thigh: THREE.Bone; calf: THREE.Bone; foot: THREE.Bone }>;
  private readonly front: THREE.Bone;
  private readonly frontLow: THREE.Bone;
  private readonly back: THREE.Bone;
  private readonly backLow: THREE.Bone;
  private readonly sides: Array<{ upper: THREE.Bone; lower: THREE.Bone }>;
  private readonly frontRest = new THREE.Vector3();
  private readonly sideRest = [new THREE.Vector3(), new THREE.Vector3()];
  private readonly out = new THREE.Vector3();
  /** How far the cloth is drawn down onto the thighs when seated (in the model's units) */
  private static readonly SEATED_PRESS = 0.03;
  /** How much of the thighs' lift the back of the cloth takes when seated */
  private static readonly SEATED_UNDER = 1.0;
  /** How much of the knees' bend it takes there */
  private static readonly SEATED_UNDER_KNEE = 0.8;
  /** How far it is lifted against the underside of the thighs (in the model's units) */
  private static readonly SEATED_LIFT = 0.09;
  private readonly backRest = new THREE.Vector3();
  /** Thigh lift (radians) at which the seated shape starts to blend in, and at which it is whole */
  private static readonly SHAPE_FROM = 0.1;
  private static readonly SHAPE_AT = 1.25;
  private seatedShapes: Array<{ influences: number[]; index: number }> = [];
  /** The axis a leg turns about to go out sideways, each leg's outward sign and how far out it is at rest */
  private readonly A = new THREE.Vector3();
  private readonly outward = [1, -1];
  private readonly latRest = [0, 0];
  private readonly qOut = new THREE.Quaternion();
  /** How far each side of the cloth is out now: eased, since the stance letting go moves a leg in a single frame */
  private readonly wideNow = [0, 0];
  private shape = 0;

  private constructor(
    legs: Array<{ thigh: THREE.Bone; calf: THREE.Bone; foot: THREE.Bone }>,
    front: THREE.Bone,
    frontLow: THREE.Bone,
    back: THREE.Bone,
    backLow: THREE.Bone,
    sides: Array<{ upper: THREE.Bone; lower: THREE.Bone }>,
    forwardInPelvis: THREE.Vector3,
  ) {
    this.legs = legs;
    this.front = front;
    this.frontLow = frontLow;
    this.back = back;
    this.backLow = backLow;
    this.sides = sides;
    this.frontRest.copy(front.position);
    this.backRest.copy(back.position);
    sides.forEach((x, i) => this.sideRest[i].copy(x.upper.position));
    // The hips' axis, the thighs' rest direction square to it, and forward
    const [l, r] = legs;
    this.L.copy(l.thigh.position).sub(r.thigh.position).normalize();
    const a = this.thighDir(l, new THREE.Vector3());
    const b = this.thighDir(r, new THREE.Vector3());
    this.D.copy(a).add(b).normalize();
    this.D.addScaledVector(this.L, -this.D.dot(this.L)).normalize();
    this.F.crossVectors(this.L, this.D).normalize();
    if (this.F.dot(forwardInPelvis) < 0) {
      this.F.negate();
      this.sign = -1;
    }
    this.A.crossVectors(this.L, this.D).normalize();
    legs.forEach((leg, i) => {
      const [aT, aC] = this.angles(leg);
      this.rest.thigh[i] = aT;
      this.rest.calf[i] = aC;
      this.latRest[i] = this.lateral(i);
    });
  }

  /** The rig of a loaded model, if it has the cloth bones (and the usual pelvis-thigh-calf-foot chain) */
  public static attach(root: THREE.Object3D): ClothRig | null {
    const bone = (name: string) => root.getObjectByName(name) as THREE.Bone | undefined;
    const pelvis = bone('pelvis');
    const front = bone('cloth_front'), frontLow = bone('cloth_front_low'), back = bone('cloth_back'), backLow = bone('cloth_back_low');
    if (!pelvis || !front || !frontLow || !back || !backLow) return null;
    const sides = (['l', 'r'] as const).map((s) => ({ upper: bone(`cloth_side_${s}`), lower: bone(`cloth_side_${s}_low`) }));
    if (sides.some((x) => !x.upper || !x.lower)) return null;
    const legs = (['l', 'r'] as const).map((s) => ({ thigh: bone(`thigh_${s}`), calf: bone(`calf_${s}`), foot: bone(`foot_${s}`) }));
    if (legs.some((g) => !g.thigh || !g.calf || !g.foot || g.thigh.parent !== pelvis || g.calf.parent !== g.thigh || g.foot.parent !== g.calf)) return null;
    // The model's forward (+z) as seen from the pelvis
    root.updateMatrixWorld(true);
    const q = new THREE.Quaternion();
    pelvis.getWorldQuaternion(q);
    const rootQ = new THREE.Quaternion();
    root.getWorldQuaternion(rootQ);
    const forward = new THREE.Vector3(0, 0, 1).applyQuaternion(rootQ).applyQuaternion(q.invert());
    const rig = new ClothRig(legs as Array<{ thigh: THREE.Bone; calf: THREE.Bone; foot: THREE.Bone }>, front, frontLow, back, backLow, sides as Array<{ upper: THREE.Bone; lower: THREE.Bone }>, forward);
    root.traverse((o) => {
      const mesh = o as THREE.Mesh;
      const index = mesh.isMesh ? mesh.morphTargetDictionary?.Seated : undefined;
      if (index !== undefined && mesh.morphTargetInfluences) rig.seatedShapes.push({ influences: mesh.morphTargetInfluences, index });
    });
    return rig;
  }

  private thighDir(leg: { thigh: THREE.Bone; calf: THREE.Bone }, out: THREE.Vector3): THREE.Vector3 {
    return out.copy(leg.calf.position).applyQuaternion(leg.thigh.quaternion);
  }

  /** A direction's angle round the hips' axis, forward positive, from hanging straight down */
  private angleOf(v: THREE.Vector3): number {
    return Math.atan2(v.dot(this.F), v.dot(this.D));
  }

  /** The thigh's and the shin's angles (the shin's from the knee to the ankle) */
  private angles(leg: { thigh: THREE.Bone; calf: THREE.Bone; foot: THREE.Bone }): [number, number] {
    const { knee, ankle, q } = this.t;
    knee.copy(leg.calf.position).applyQuaternion(leg.thigh.quaternion);
    const aT = this.angleOf(knee);
    q.copy(leg.thigh.quaternion).multiply(leg.calf.quaternion);
    ankle.copy(leg.foot.position).applyQuaternion(q);
    return [aT, this.angleOf(ankle)];
  }

  /** How far a thigh points out sideways from the body's middle (radians) */
  private lateral(i: number): number {
    const v = this.thighDir(this.legs[i], this.t.v).normalize();
    return Math.asin(Math.max(-1, Math.min(1, v.dot(this.L) * this.outward[i])));
  }

  /** An angle, nothing up to `still`, the whole of it from `still + ease` on (a person standing moves no side bone) */
  private static past(x: number, still: number, ease: number): number {
    const t = Math.max(0, Math.min(1, (Math.abs(x) - still) / ease));
    return x * t * t * (3 - 2 * t);
  }

  /** Turns the cloth bones for the legs as they are now posed */
  public apply(delta = 0): void {
    const follow = delta > 0 ? 1 - Math.exp(-delta / 0.06) : 1;
    let fi = 0, bi = 0;
    const aT = [0, 0], bend = [0, 0];
    for (let i = 0; i < 2; i++) {
      const [t, c] = this.angles(this.legs[i]);
      aT[i] = t - this.rest.thigh[i];
      // The knee's bend (negative as the shin swings back), from the rest pose
      bend[i] = c - this.rest.calf[i] - aT[i];
    }
    if (aT[1] > aT[0]) fi = 1;
    if (aT[1] < aT[0]) bi = 1;
    const front = Math.max(0, aT[fi]);
    const clampBend = (b: number) => Math.max(-2.6, Math.min(0.1, b));
    // With both thighs up (seated); nothing while standing or in a stride, where one thigh is always down
    const up = Math.max(0, Math.min(1, (Math.min(aT[0], aT[1]) - 0.3) / 0.9));
    const seated = up * up * (3 - 2 * up);
    // The seated shape, in step with the thighs
    const s = Math.max(0, Math.min(1, (Math.min(aT[0], aT[1]) - ClothRig.SHAPE_FROM) / (ClothRig.SHAPE_AT - ClothRig.SHAPE_FROM)));
    // Half straight, half eased: soft at both ends without the fast middle of a full ease
    let shape = 0.5 * s + 0.5 * s * s * (3 - 2 * s);
    // Getting up, the everyday stance can straighten the body in one frame: the cloth falls back over a few frames
    if (delta > 0 && shape < this.shape) {
      const eased = this.shape + (shape - this.shape) * (1 - Math.exp(-delta / 0.07));
      shape = eased - shape < 0.002 ? shape : eased;
    }
    if (shape !== this.shape) {
      this.shape = shape;
      for (const { influences, index } of this.seatedShapes) influences[index] = shape;
    }
    // Seated, the back of the cloth is sat on: it folds forward under the thighs and bends down at the knees with them
    const back = Math.min(0, aT[bi]) + seated * aT[bi] * ClothRig.SEATED_UNDER;
    // A lower part bends only when its upper part follows its leg
    // (shared between the legs as they pass each other, and eased in from hanging straight, so the hem never jumps)
    const cross = Math.max(0, Math.min(1, (aT[1] - aT[0]) / 0.16 + 0.5));
    const lead = cross * cross * (3 - 2 * cross);
    const leadBend = clampBend(bend[0]) * (1 - lead) + clampBend(bend[1]) * lead;
    const trailBend = clampBend(bend[0]) * lead + clampBend(bend[1]) * (1 - lead);
    const eased = (x: number) => { const u = Math.max(0, Math.min(1, x / 0.2)); return u * u * (3 - 2 * u); };
    const frontBend = leadBend * eased(aT[fi]);
    const backBend = trailBend * 0.6 * eased(-aT[bi]) + seated * trailBend * ClothRig.SEATED_UNDER_KNEE;
    this.front.quaternion.setFromAxisAngle(this.L, front * this.sign);
    this.frontLow.quaternion.setFromAxisAngle(this.L, frontBend * this.sign);
    this.back.quaternion.setFromAxisAngle(this.L, back * this.sign);
    this.back.position.copy(this.backRest).addScaledVector(this.D, -ClothRig.SEATED_LIFT * seated);
    this.backLow.quaternion.setFromAxisAngle(this.L, backBend * this.sign);
    // With both thighs up (seated) the cloth, turning about the hips, would ride above the thighs and over the hands
    // resting on them: it is drawn down onto the thighs, along its own outward direction. Nothing while standing or
    // in a stride, where one thigh is always down.
    const press = ClothRig.SEATED_PRESS * seated;
    this.out.copy(this.F).multiplyScalar(Math.cos(front)).addScaledVector(this.D, -Math.sin(front));
    this.front.position.copy(this.frontRest).addScaledVector(this.out, -press);
    // Each side with its own leg, easing in once the leg swings past how it stands
    for (let i = 0; i < 2; i++) {
      const swing = ClothRig.past(aT[i], 0.05, 0.2);
      const knee = ClothRig.past(clampBend(bend[i]), 0.2, 0.3);
      this.out.copy(this.F).multiplyScalar(Math.cos(swing)).addScaledVector(this.D, -Math.sin(swing));
      this.sides[i].upper.position.copy(this.sideRest[i]).addScaledVector(this.out, -press);
      const wide = ClothRig.past(Math.max(0, this.lateral(i) - this.latRest[i]), 0.02, 0.1);
      this.wideNow[i] += (wide - this.wideNow[i]) * follow;
      this.qOut.setFromAxisAngle(this.A, -this.outward[i] * this.wideNow[i]);
      this.sides[i].upper.quaternion.setFromAxisAngle(this.L, swing * this.sign).premultiply(this.qOut);
      this.sides[i].lower.quaternion.setFromAxisAngle(this.L, knee * this.sign);
    }
  }
}
