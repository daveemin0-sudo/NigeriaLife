import type { HumanRig } from '../graphics/HumanMeshBuilder';

/**
 * What a character's body is doing, split in two so they combine freely:
 * someone can wave while seated, or carry a plate while walking.
 */
export type LegPose = 'stand' | 'walk' | 'sit' | 'lie';
export type ArmPose = 'rest' | 'swing' | 'wave' | 'eat' | 'carry' | 'reach' | 'talk' | 'greet' | 'shake';

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
}

export function neutralJoints(): JointValues {
  return {
    leftArmX: 0, leftArmZ: 0, rightArmX: 0, rightArmZ: 0,
    leftLegX: 0, rightLegX: 0, torsoX: 0, torsoLift: 0, headX: 0, headY: 0, drop: 0, recline: 0, lift: 0,
  };
}

/** Hip height is 0.76 and a seat is 0.5 high, so a seated body sits this much lower. */
const SEAT_DROP = 0.17;

export function poseTargets(pose: PoseState, time: number, out: JointValues): JointValues {
  const stride = Math.sin(time * 8);

  out.recline = 0;
  out.lift = 0;

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
    out.torsoLift = Math.abs(Math.sin(time * 16)) * 0.04;
    out.drop = 0;
  } else if (pose.legs === 'sit') {
    out.leftLegX = -1.42;
    out.rightLegX = -1.42;
    out.torsoLift = Math.sin(time * 2) * 0.01;
    out.drop = SEAT_DROP;
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
  const seated = pose.legs === 'sit';

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
  return out;
}

export function easeJoints(current: JointValues, target: JointValues, amount: number): void {
  for (const key of Object.keys(current) as Array<keyof JointValues>) {
    current[key] += (target[key] - current[key]) * amount;
  }
}

export function writeJoints(rig: HumanRig, joints: JointValues, baseTorsoY: number): void {
  rig.leftArm.rotation.set(joints.leftArmX, 0, joints.leftArmZ);
  rig.rightArm.rotation.set(joints.rightArmX, 0, joints.rightArmZ);
  rig.leftLeg.rotation.x = joints.leftLegX;
  rig.rightLeg.rotation.x = joints.rightLegX;
  rig.torso.rotation.set(joints.torsoX, 0, 0);
  rig.torso.position.y = baseTorsoY + joints.torsoLift;
  rig.head.rotation.set(joints.headX, joints.headY, 0);
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
  out.leftArmX = rig.leftArm.rotation.x;
  out.leftArmZ = rig.leftArm.rotation.z;
  out.rightArmX = rig.rightArm.rotation.x;
  out.rightArmZ = rig.rightArm.rotation.z;
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
