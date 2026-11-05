import * as THREE from 'three';
import type { HumanRig } from '../graphics/HumanMeshBuilder';

/**
 * What a character's body is doing, split in two so they combine freely:
 * someone can wave while seated, or carry a plate while walking.
 */
export type LegPose = 'stand' | 'walk' | 'sit' | 'lie'
  /** Bowed from the hips with the hands on the knees (ruku) */
  | 'bow'
  /** Kneeling, sat back on the heels (between prostrations, at a lesson, at the altar) */
  | 'kneel'
  /** Forehead and palms to the floor, knees down (sujud) */
  | 'prostrate'
  /** Stepping and bouncing on the spot to the music */
  | 'dance';
export type ArmPose = 'rest' | 'swing' | 'wave' | 'eat' | 'carry' | 'reach' | 'talk' | 'greet' | 'shake'
  /** Right hand over left at the navel, standing in prayer */
  | 'pray'
  /** Both hands up high, swaying */
  | 'praise'
  /** Clapping in time */
  | 'clap'
  /** Beating a drum in front */
  | 'drum'
  /** One hand up, the other holding the microphone */
  | 'preach'
  /** Both palms open in front of the chest (a supplication, a hymn book) */
  | 'palms'
  /** Both hands raised to the ears (Allahu akbar) */
  | 'takbir';

export interface PoseState {
  legs: LegPose;
  arms: ArmPose;
  /** For 'lie': how high the surface being lain on is (a mattress top) */
  height?: number;
}

/** Joint values a pose aims for. The rig is eased toward them, so poses never snap. */
export interface JointValues {
  leftArmX: number;
  leftArmZ: number;
  rightArmX: number;
  rightArmZ: number;
  leftLegX: number;
  rightLegX: number;
  torsoX: number;
  torsoLift: number;
  headX: number;
  headY: number;
  /** How far the whole body is lowered, e.g. onto a seat. */
  drop: number;
  /** 0 = upright, 1 = flat on the back */
  recline: number;
  /** How far the whole body is raised, e.g. onto a bed. */
  lift: number;
  /** The upper body (torso, head and arms together) bent forward at the hips */
  bend: number;
  /** Elbows: negative bends the forearm forward and up */
  leftElbow: number;
  rightElbow: number;
  /** The arm turned about its own length: positive turns a bent left forearm in across the body */
  leftArmY: number;
  rightArmY: number;
  /** Knees: positive bends the shin back */
  leftKnee: number;
  rightKnee: number;
}

export function neutralJoints(): JointValues {
  return {
    leftArmX: 0, leftArmZ: 0, rightArmX: 0, rightArmZ: 0,
    leftLegX: 0, rightLegX: 0, torsoX: 0, torsoLift: 0, headX: 0, headY: 0, drop: 0, recline: 0, lift: 0,
    bend: 0, leftElbow: 0, rightElbow: 0, leftArmY: 0, rightArmY: 0, leftKnee: 0, rightKnee: 0,
  };
}

/** Hip height is 0.76 and a seat is 0.5 high, so a seated body sits this much lower. */
const SEAT_DROP = 0.17;
/** The hip joint's height when standing */
const HIP = 0.77;

export function poseTargets(pose: PoseState, time: number, out: JointValues): JointValues {
  const stride = Math.sin(time * 8);

  out.recline = 0;
  out.lift = 0;
  out.bend = 0;
  out.leftElbow = 0;
  out.rightElbow = 0;
  out.leftArmY = 0;
  out.rightArmY = 0;
  out.leftKnee = 0;
  out.rightKnee = 0;

  // Lower body
  if (pose.legs === 'lie') {
    // Flat on the back on a bed; the body's thickness keeps it on top of the mattress
    out.leftLegX = 0;
    out.rightLegX = 0;
    out.torsoLift = Math.sin(time * 1.2) * 0.012;
    out.drop = 0;
    out.recline = 1;
    out.lift = (pose.height ?? 0.6) + 0.14;
  } else if (pose.legs === 'walk') {
    out.leftLegX = stride * 0.6;
    out.rightLegX = -stride * 0.6;
    // The knee bends as the leg swings through
    out.leftKnee = Math.max(0, -stride) * 0.8;
    out.rightKnee = Math.max(0, stride) * 0.8;
    out.torsoLift = Math.abs(Math.sin(time * 16)) * 0.04;
    out.drop = 0;
  } else if (pose.legs === 'sit') {
    out.leftLegX = -1.42;
    out.rightLegX = -1.42;
    // Shins down to the floor, not sticking out in front
    out.leftKnee = 1.36;
    out.rightKnee = 1.36;
    out.torsoLift = Math.sin(time * 2) * 0.01;
    out.drop = SEAT_DROP;
  } else if (pose.legs === 'bow') {
    // Ruku: straight legs, the back level, the head in line with it
    out.leftLegX = 0;
    out.rightLegX = 0;
    out.bend = 1.42;
    out.drop = 0;
    out.torsoLift = 0;
  } else if (pose.legs === 'kneel') {
    // Knees on the floor in front, shins flat behind, sat back on the heels
    out.leftLegX = -0.98;
    out.rightLegX = -0.98;
    out.leftKnee = 2.55;
    out.rightKnee = 2.55;
    out.drop = HIP - 0.31;
    out.torsoLift = Math.sin(time * 2) * 0.008;
    out.bend = 0.04;
  } else if (pose.legs === 'prostrate') {
    // Sujud: knees down, hips over them, the body folded forward until the forehead is on the floor
    out.leftLegX = -0.25;
    out.rightLegX = -0.25;
    out.leftKnee = 1.82;
    out.rightKnee = 1.82;
    out.drop = HIP - 0.47;
    out.bend = 1.98;
    out.torsoLift = 0;
  } else if (pose.legs === 'dance') {
    // A step from foot to foot with a bounce, to the beat
    const beat = Math.sin(time * 6.5);
    out.leftLegX = -Math.max(0, beat) * 0.35;
    out.rightLegX = -Math.max(0, -beat) * 0.35;
    out.leftKnee = Math.max(0, beat) * 0.7;
    out.rightKnee = Math.max(0, -beat) * 0.7;
    out.torsoLift = -Math.abs(beat) * 0.05;
    out.drop = Math.abs(beat) * 0.03;
  } else {
    out.leftLegX = 0;
    out.rightLegX = 0;
    out.torsoLift = Math.sin(time * 2) * 0.015;
    out.drop = 0;
  }

  // Upper body
  out.torsoX = 0;
  out.headX = 0;
  out.headY = 0;
  out.leftArmZ = 0;
  out.rightArmZ = 0;
  const seated = pose.legs === 'sit' || pose.legs === 'kneel';

  switch (pose.arms) {
    case 'swing':
      out.leftArmX = -stride * 0.5;
      out.rightArmX = stride * 0.5;
      break;
    case 'carry':
      // Both forearms out in front, holding a plate level
      out.leftArmX = -1.25;
      out.rightArmX = -1.25;
      out.leftArmZ = 0.14;
      out.rightArmZ = -0.14;
      break;
    case 'reach':
      // Leaning in to pick something up or set it down
      out.leftArmX = -1.05;
      out.rightArmX = -1.05;
      out.leftArmZ = 0.1;
      out.rightArmZ = -0.1;
      out.torsoX = 0.2;
      out.headX = 0.2;
      break;
    case 'wave': {
      out.leftArmX = seated ? -0.4 : 0;
      out.rightArmX = 0;
      out.rightArmZ = 2.55 + Math.sin(time * 11) * 0.32;
      out.headY = Math.sin(time * 5.5) * 0.06;
      break;
    }
    case 'eat': {
      // Hand travels from the plate to the mouth and back
      const lift = (Math.sin(time * 4.2) + 1) / 2;
      out.rightArmX = -0.85 - lift * 1.1;
      out.rightArmZ = -0.28;
      out.leftArmX = -0.8;
      out.leftArmZ = 0.1;
      out.headX = 0.08 + lift * 0.2;
      break;
    }
    case 'greet':
      // A respectful half-bow with the right hand to the chest
      out.leftArmX = seated ? -0.45 : 0;
      out.rightArmX = -0.95;
      out.rightArmZ = -0.62;
      out.torsoX = seated ? 0.16 : 0.27;
      out.headX = 0.22;
      break;
    case 'shake':
      // Right hand out at waist height, pumping gently
      out.leftArmX = seated ? -0.45 : 0;
      out.rightArmX = -1.12 + Math.sin(time * 11) * 0.13;
      out.rightArmZ = -0.08;
      out.torsoX = 0.07;
      break;
    case 'pray':
      // Right hand over left at the navel
      out.leftArmX = -0.12;
      out.rightArmX = -0.12;
      out.leftArmZ = 0.08;
      out.rightArmZ = -0.08;
      out.leftArmY = 0.95;
      out.rightArmY = -0.95;
      out.leftElbow = -1.5;
      out.rightElbow = -1.6;
      out.headX = 0.12;
      break;
    case 'praise': {
      const sway = Math.sin(time * 2.6);
      out.leftArmX = -2.75;
      out.rightArmX = -2.75;
      out.leftArmZ = -0.38 + sway * 0.14;
      out.rightArmZ = 0.38 + sway * 0.14;
      out.leftElbow = -0.25;
      out.rightElbow = -0.25;
      out.headX = -0.18;
      out.headY = sway * 0.12;
      break;
    }
    case 'clap': {
      // Close to two claps a second: the hands come together in front of the chest
      const apart = (Math.cos(time * Math.PI * 3.4) + 1) / 2;
      out.leftArmX = -0.75;
      out.rightArmX = -0.75;
      out.leftElbow = -1.05;
      out.rightElbow = -1.05;
      out.leftArmY = 0.95 - apart * 0.55;
      out.rightArmY = -0.95 + apart * 0.55;
      out.headY = Math.sin(time * 1.7) * 0.1;
      break;
    }
    case 'drum': {
      const hit = Math.sin(time * 13);
      out.leftArmX = -0.55 + hit * 0.3;
      out.rightArmX = -0.55 - hit * 0.3;
      out.leftElbow = -0.9 + hit * 0.25;
      out.rightElbow = -0.9 - hit * 0.25;
      out.leftArmZ = -0.15;
      out.rightArmZ = 0.15;
      out.headX = 0.1 + Math.abs(hit) * 0.05;
      break;
    }
    case 'preach': {
      // The microphone at the mouth in the left hand; the right hand up, making the point
      const point = Math.sin(time * 1.9);
      out.leftArmX = -0.55;
      out.leftArmY = 0.7;
      out.leftElbow = -1.95;
      out.rightArmX = -1.9 + point * 0.7;
      out.rightArmZ = 0.25;
      out.rightElbow = -0.35 - Math.max(0, point) * 0.4;
      out.headY = Math.sin(time * 0.8) * 0.25;
      out.headX = -0.06;
      break;
    }
    case 'palms':
      // Both forearms forward, palms open and up
      out.leftArmX = -0.32;
      out.rightArmX = -0.32;
      out.leftArmY = 0.35;
      out.rightArmY = -0.35;
      out.leftElbow = -1.35;
      out.rightElbow = -1.35;
      out.headX = 0.2;
      break;
    case 'takbir':
      // Hands up beside the ears, palms forward
      out.leftArmX = -0.35;
      out.rightArmX = -0.35;
      out.leftArmZ = -0.55;
      out.rightArmZ = 0.55;
      out.leftElbow = -2.45;
      out.rightElbow = -2.45;
      break;
    case 'talk':
      out.leftArmX = -0.4 + Math.sin(time * 4) * 0.2;
      out.leftArmZ = -0.2;
      out.rightArmX = -0.75 + Math.cos(time * 3) * 0.25;
      out.rightArmZ = 0.25;
      out.headY = Math.sin(time * 1.5) * 0.12;
      break;
    default:
      // At rest: arms hang when standing, hands near the lap when seated
      out.leftArmX = seated ? -0.45 : Math.sin(time * 2) * 0.03;
      out.rightArmX = seated ? -0.45 : -Math.sin(time * 2) * 0.03;
      break;
  }
  // Leg poses that put the hands somewhere of their own
  if (pose.legs === 'bow' && (pose.arms === 'rest' || pose.arms === 'pray')) {
    // Hands on the knees
    out.leftArmX = out.rightArmX = -0.58;
    out.leftArmZ = 0.16;
    out.rightArmZ = -0.16;
    out.leftArmY = out.rightArmY = 0;
    out.leftElbow = out.rightElbow = 0;
    out.headX = 0;
    out.headY = 0;
  } else if (pose.legs === 'prostrate') {
    // Palms flat on the floor either side of the head, the elbows raised
    out.leftArmX = out.rightArmX = -2.15;
    out.leftArmZ = -0.5;
    out.rightArmZ = 0.5;
    out.leftArmY = out.rightArmY = 0;
    out.leftElbow = out.rightElbow = -0.85;
    out.headX = 0.35;
    out.headY = 0;
  } else if (pose.legs === 'kneel' && pose.arms === 'rest') {
    // Hands on the thighs
    out.leftArmX = out.rightArmX = -0.42;
    out.leftElbow = out.rightElbow = -0.35;
  }
  return out;
}

export function easeJoints(current: JointValues, target: JointValues, amount: number): void {
  for (const key of Object.keys(current) as Array<keyof JointValues>) {
    current[key] += (target[key] - current[key]) * amount;
  }
}

/** Where the head and shoulders sit on a rig at rest, kept the first time the rig is posed */
interface RestPlaces { head: THREE.Vector3; leftArm: THREE.Vector3; rightArm: THREE.Vector3; hip: number }
const restOf = (rig: HumanRig): RestPlaces => {
  const data = rig.group.userData as { rest?: RestPlaces };
  if (!data.rest) data.rest = { head: rig.head.position.clone(), leftArm: rig.leftArm.position.clone(), rightArm: rig.rightArm.position.clone(), hip: rig.leftLeg.position.y };
  return data.rest;
};
const bent = new THREE.Vector3();
const torsoRest = new THREE.Vector3();
/** A point of the upper body, swung forward by `bend` about the hips */
const swing = (rest: THREE.Vector3, hip: number, bend: number, lift: number, out: THREE.Vector3): THREE.Vector3 => {
  const y = rest.y + lift - hip;
  return out.set(rest.x, hip + y * Math.cos(bend) - rest.z * Math.sin(bend), y * Math.sin(bend) + rest.z * Math.cos(bend));
};

export function writeJoints(rig: HumanRig, joints: JointValues, baseTorsoY: number): void {
  const rest = restOf(rig);
  const bend = joints.bend;
  rig.leftArm.rotation.set(joints.leftArmX + bend, joints.leftArmY, joints.leftArmZ);
  rig.rightArm.rotation.set(joints.rightArmX + bend, joints.rightArmY, joints.rightArmZ);
  rig.leftLeg.rotation.x = joints.leftLegX;
  rig.rightLeg.rotation.x = joints.rightLegX;
  rig.torso.rotation.set(joints.torsoX + bend, 0, 0);
  rig.head.rotation.set(joints.headX + bend, joints.headY, 0);
  if (Math.abs(bend) > 1e-4) {
    // The head and arms hang from the root, not the torso: they are carried round the hips with it
    swing(torsoRest.set(0, baseTorsoY, 0), rest.hip, bend, joints.torsoLift, bent);
    rig.torso.position.set(0, bent.y, bent.z);
    rig.head.position.copy(swing(rest.head, rest.hip, bend, joints.torsoLift, bent));
    rig.leftArm.position.copy(swing(rest.leftArm, rest.hip, bend, joints.torsoLift, bent));
    rig.rightArm.position.copy(swing(rest.rightArm, rest.hip, bend, joints.torsoLift, bent));
  } else {
    rig.torso.position.set(0, baseTorsoY + joints.torsoLift, 0);
    rig.head.position.copy(rest.head);
    rig.leftArm.position.copy(rest.leftArm);
    rig.rightArm.position.copy(rest.rightArm);
  }
  if (rig.leftForearm) rig.leftForearm.rotation.set(joints.leftElbow, 0, 0);
  if (rig.rightForearm) rig.rightForearm.rotation.set(joints.rightElbow, 0, 0);
  if (rig.leftLowerLeg) rig.leftLowerLeg.rotation.x = joints.leftKnee;
  if (rig.rightLowerLeg) rig.rightLowerLeg.rotation.x = joints.rightKnee;
  rig.group.position.y = joints.lift - joints.drop;
  rig.group.rotation.x = -joints.recline * (Math.PI / 2);
  if (rig.phoneMesh) rig.phoneMesh.visible = false;
}

/**
 * Keeps both hands on whatever is being carried while the character's usual owner animates
 * the rest of the body (the player walking about freely with a shop basket).
 */
export function holdCarriedItem(rig: HumanRig): void {
  rig.leftArm.rotation.set(-1.25, 0, 0.14);
  rig.rightArm.rotation.set(-1.25, 0, -0.14);
}

export function readJoints(rig: HumanRig, baseTorsoY: number, out: JointValues): JointValues {
  // A rig taken over is assumed upright: any bend it had is let go of
  out.bend = 0;
  out.leftArmX = rig.leftArm.rotation.x;
  out.leftArmZ = rig.leftArm.rotation.z;
  out.leftArmY = rig.leftArm.rotation.y;
  out.rightArmX = rig.rightArm.rotation.x;
  out.rightArmZ = rig.rightArm.rotation.z;
  out.rightArmY = rig.rightArm.rotation.y;
  out.leftElbow = rig.leftForearm?.rotation.x ?? 0;
  out.rightElbow = rig.rightForearm?.rotation.x ?? 0;
  out.leftKnee = rig.leftLowerLeg?.rotation.x ?? 0;
  out.rightKnee = rig.rightLowerLeg?.rotation.x ?? 0;
  out.leftLegX = rig.leftLeg.rotation.x;
  out.rightLegX = rig.rightLeg.rotation.x;
  out.torsoX = rig.torso.rotation.x;
  out.torsoLift = rig.torso.position.y - baseTorsoY;
  out.headX = rig.head.rotation.x;
  out.headY = rig.head.rotation.y;
  out.recline = -rig.group.rotation.x / (Math.PI / 2);
  out.lift = Math.max(0, rig.group.position.y);
  out.drop = Math.max(0, -rig.group.position.y);
  return out;
}
