import * as THREE from 'three';
import type { Actor } from './Actor';
import type { PoseState } from './Poses';
import type { NavGrid } from './NavGrid';

export type EndReason = 'done' | 'cancelled' | 'failed';
export type Point = THREE.Vector3 | (() => THREE.Vector3);

const resolve = (point: Point): THREE.Vector3 => (typeof point === 'function' ? point() : point);

/** One thing that happens in a sequence. `tick` returns true when finished, or 'fail' to abort. */
export interface Step {
  name: string;
  begin?: () => void | 'fail';
  tick: (delta: number) => boolean | 'fail';
}

/**
 * A scripted run of steps involving one or more actors: walk here, face that, do this.
 * It always ends exactly once, with a reason, and its end handlers always run, so whatever
 * it reserved or changed can be put right however it ends.
 */
export class Sequence {
  public readonly name: string;
  public readonly actors: Actor[];
  /** Can the player break out of it by moving or doing something else? */
  public interruptible = true;
  /** A sequence that runs longer than this is assumed stuck and is failed. */
  public maxSeconds = 90;
  public ended: EndReason | null = null;
  public failure = '';

  private steps: Step[] = [];
  private index = -1;
  private elapsed = 0;
  private endHandlers: Array<(reason: EndReason) => void> = [];
  private settle!: (reason: EndReason) => void;
  /** Resolves when the sequence ends, however it ends. */
  public readonly finished: Promise<EndReason>;

  constructor(name: string, actors: Actor[]) {
    this.name = name;
    this.actors = actors;
    this.finished = new Promise((done) => { this.settle = done; });
  }

  public add(...steps: Step[]): this {
    this.steps.push(...steps);
    return this;
  }

  public onEnd(handler: (reason: EndReason) => void): this {
    this.endHandlers.push(handler);
    return this;
  }

  public locked(): this {
    this.interruptible = false;
    return this;
  }

  public cancel(): void {
    this.finish('cancelled');
  }

  public fail(why: string): void {
    this.failure = why;
    this.finish('failed');
  }

  private finish(reason: EndReason): void {
    if (this.ended) return;
    this.ended = reason;
    for (const handler of this.endHandlers) {
      try {
        handler(reason);
      } catch (error) {
        console.error(`[Sequence] ${this.name}: end handler failed`, error);
      }
    }
    this.settle(reason);
  }

  public update(delta: number): void {
    if (this.ended) return;
    this.elapsed += delta;
    if (this.elapsed > this.maxSeconds) {
      this.fail('took too long');
      return;
    }

    if (this.index === -1) {
      this.index = 0;
      if (!this.beginCurrent()) return;
    }

    // Steps that finish at once (calls, conditions already met) run in the same frame
    for (let guard = 0; guard < 64 && !this.ended; guard++) {
      let result: boolean | 'fail';
      try {
        result = this.steps[this.index].tick(delta);
      } catch (error) {
        console.error(`[Sequence] ${this.name}: step "${this.steps[this.index].name}" threw`, error);
        result = 'fail';
      }
      if (result === 'fail') {
        this.fail(this.failure || this.steps[this.index].name);
        return;
      }
      // A step may end the sequence itself (by cancelling it); nothing more runs after that
      if (!result || this.ended) return;
      this.index++;
      if (!this.beginCurrent()) return;
      delta = 0;
    }
  }

  /** Starts the current step. False if the sequence ended instead. */
  private beginCurrent(): boolean {
    if (this.index >= this.steps.length) {
      this.finish('done');
      return false;
    }
    if (this.steps[this.index].begin?.() === 'fail') {
      this.fail(this.failure || this.steps[this.index].name);
      return false;
    }
    return true;
  }
}

export interface WalkOptions {
  nav?: NavGrid | null;
  speed?: number;
  /** If the walk cannot be completed: give up, or put the actor at the destination anyway. */
  ifStuck?: 'fail' | 'snap';
}

/** The building blocks every interaction is made from. */
export const steps = {
  /** Walk to a point, around furniture when a floor map is given. */
  walk(actor: Actor, to: Point, options: WalkOptions = {}): Step {
    let path: THREE.Vector3[] = [];
    let limit = 0;
    let elapsed = 0;
    const here = new THREE.Vector3();
    const stuck = (): boolean | 'fail' => {
      if (options.ifStuck === 'snap') {
        const end = resolve(to);
        actor.setWorldPosition(end.x, end.z);
        actor.pose = { legs: 'stand', arms: actor.carried ? 'carry' : 'rest' };
        return true;
      }
      return 'fail';
    };
    return {
      name: 'walk',
      begin() {
        const end = resolve(to);
        actor.worldPosition(here);
        const route = options.nav ? options.nav.findPath(here, end) : [new THREE.Vector3(end.x, 0, end.z)];
        path = route ?? [];
        let length = 0;
        let previous = here.clone();
        for (const point of path) {
          length += Math.hypot(point.x - previous.x, point.z - previous.z);
          previous = point;
        }
        const speed = options.speed ?? actor.speed;
        limit = (length / speed) * 2.5 + 3;
        elapsed = 0;
        actor.pose = { legs: 'walk', arms: actor.carried ? 'carry' : 'swing' };
        if (!route) return stuck() === 'fail' ? 'fail' : undefined;
      },
      tick(delta) {
        elapsed += delta;
        if (elapsed > limit) return stuck();
        let budget = (options.speed ?? actor.speed) * delta;
        actor.worldPosition(here);
        while (path.length > 0 && budget > 0) {
          const next = path[0];
          const dx = next.x - here.x;
          const dz = next.z - here.z;
          const distance = Math.hypot(dx, dz);
          if (distance <= budget) {
            here.x = next.x;
            here.z = next.z;
            budget -= distance;
            path.shift();
          } else {
            here.x += (dx / distance) * budget;
            here.z += (dz / distance) * budget;
            actor.turnToward(Math.atan2(dx, dz), delta, 12);
            budget = 0;
          }
        }
        actor.setWorldPosition(here.x, here.z);
        if (path.length > 0) return false;
        actor.pose = { legs: 'stand', arms: actor.carried ? 'carry' : 'rest' };
        return true;
      },
    };
  },

  /** Glide in a straight line over a fixed time: through a doorway, onto a chair. */
  slide(actor: Actor, to: Point, seconds: number, pose?: PoseState): Step {
    const from = new THREE.Vector3();
    let elapsed = 0;
    return {
      name: 'slide',
      begin() {
        actor.worldPosition(from);
        elapsed = 0;
        if (pose) actor.pose = { ...pose };
      },
      tick(delta) {
        elapsed += delta;
        const t = Math.min(1, elapsed / seconds);
        const end = resolve(to);
        actor.setWorldPosition(from.x + (end.x - from.x) * t, from.z + (end.z - from.z) * t);
        return t >= 1;
      },
    };
  },

  /** Turn to look at a point, or to a heading given in radians. */
  face(actor: Actor, toward: Point | number): Step {
    let elapsed = 0;
    return {
      name: 'face',
      begin() {
        elapsed = 0;
      },
      tick(delta) {
        elapsed += delta;
        const yaw = typeof toward === 'number' ? toward : actor.headingTo(resolve(toward));
        const facing = actor.turnToward(yaw, delta);
        if (facing || elapsed > 1.2) {
          actor.yaw = yaw;
          return true;
        }
        return false;
      },
    };
  },

  /**
   * Hold a pose for a while. `moments` run once each, part-way through the animation
   * (0 = start, 1 = end); one that returns false aborts the sequence.
   */
  animate(
    actor: Actor,
    pose: Partial<PoseState>,
    seconds: number,
    moments: Array<{ at: number; run: () => boolean | void }> = []
  ): Step {
    let elapsed = 0;
    let fired: boolean[] = [];
    let armsBefore: PoseState['arms'] = 'rest';
    return {
      name: `animate ${pose.arms ?? pose.legs}`,
      begin() {
        elapsed = 0;
        fired = moments.map(() => false);
        armsBefore = actor.pose.arms;
        actor.pose = { ...actor.pose, ...pose };
      },
      tick(delta) {
        elapsed += delta;
        const progress = seconds <= 0 ? 1 : Math.min(1, elapsed / seconds);
        for (let i = 0; i < moments.length; i++) {
          if (!fired[i] && progress >= moments[i].at) {
            fired[i] = true;
            if (moments[i].run() === false) return 'fail';
          }
        }
        if (progress < 1) return false;
        // Back to what the arms were doing (eating, say), or to whatever is now in the hands
        if (pose.arms && actor.pose.arms === pose.arms) {
          const resume = armsBefore === 'swing' || armsBefore === pose.arms ? 'rest' : armsBefore;
          actor.pose = { ...actor.pose, arms: actor.carried ? 'carry' : resume === 'carry' ? 'rest' : resume };
        }
        return true;
      },
    };
  },

  /** Set a pose and move straight on, leaving the actor in it. */
  setPose(actor: Actor, pose: Partial<PoseState>): Step {
    return {
      name: 'set pose',
      tick() {
        actor.pose = { ...actor.pose, ...pose };
        return true;
      },
    };
  },

  /** Run some code. Returning false aborts the sequence. */
  call(name: string, run: () => boolean | void): Step {
    return { name, tick: () => (run() === false ? 'fail' : true) };
  },

  wait(seconds: number): Step {
    let elapsed = 0;
    return {
      name: 'wait',
      begin() {
        elapsed = 0;
      },
      tick(delta) {
        elapsed += delta;
        return elapsed >= seconds;
      },
    };
  },

  /** Wait for something to become true. */
  until(name: string, test: () => boolean, timeoutSeconds: number, ifTimedOut: 'fail' | 'continue' = 'fail'): Step {
    let elapsed = 0;
    return {
      name,
      begin() {
        elapsed = 0;
      },
      tick(delta) {
        if (test()) return true;
        elapsed += delta;
        if (elapsed < timeoutSeconds) return false;
        return ifTimedOut === 'continue' ? true : 'fail';
      },
    };
  },
};
