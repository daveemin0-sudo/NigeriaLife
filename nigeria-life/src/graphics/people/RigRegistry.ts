import type * as THREE from 'three';
import type { HumanConfig, HumanRig } from '../HumanMeshBuilder';
import type { PoseState } from '../../interactions/Poses';

/**
 * Every procedural person (HumanRig) made anywhere in the game, with the look it was made from and
 * what it was last told to do. StandIns draws each one that is out in the world as a character model
 * (full detail near the player, less detail further off), so the old figures themselves never show.
 *
 * Rigs are held weakly: one thrown away is forgotten.
 */
export interface RigEntry {
  id: number;
  rig: WeakRef<HumanRig>;
  look: HumanConfig;
  /** The last animation it was given (updateAnimation's state), and when (performance.now() ms) */
  state: string;
  stateAt: number;
  /** The last pose an interaction gave it (sitting, eating, kneeling...), and when */
  pose: PoseState | null;
  poseAt: number;
  /** Where it was last frame, to tell walking from standing when nobody says */
  last: THREE.Vector3 | null;
  speed: number;
}

const entries: RigEntry[] = [];
const byRig = new WeakMap<HumanRig, RigEntry>();
let nextId = 1;

export const RigRegistry = {
  add(rig: HumanRig, look: HumanConfig): void {
    if (byRig.has(rig)) return;
    const entry: RigEntry = { id: nextId++, rig: new WeakRef(rig), look, state: 'idle', stateAt: 0, pose: null, poseAt: 0, last: null, speed: 0 };
    entries.push(entry);
    byRig.set(rig, entry);
    // What it is told to do, noted on the way through
    const animate = rig.updateAnimation;
    rig.updateAnimation = (time: number, animState?: boolean | string) => {
      entry.state = animState === true ? 'walk' : typeof animState === 'string' ? animState : 'idle';
      entry.stateAt = performance.now();
      animate(time, animState);
    };
  },

  /** An interaction is posing this rig (the Actor calls this every frame it does) */
  notePose(rig: HumanRig, pose: PoseState): void {
    const entry = byRig.get(rig);
    if (!entry) return;
    entry.pose = pose;
    entry.poseAt = performance.now();
  },

  /** The rigs still alive (forgetting the ones thrown away) */
  live(): RigEntry[] {
    for (let i = entries.length - 1; i >= 0; i--) if (!entries[i].rig.deref()) entries.splice(i, 1);
    return entries;
  },

  entryOf(rig: HumanRig): RigEntry | undefined {
    return byRig.get(rig);
  },
};
