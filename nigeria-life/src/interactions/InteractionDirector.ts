import type { Actor } from './Actor';
import type { HingedDoor } from './Door';
import type { NavGrid } from './NavGrid';
import type { PoseState } from './Poses';
import { Sequence, steps, type Point, type Step } from './Sequence';

/**
 * One visible action, described as data. Every action in the game is the same five beats:
 * walk to `point`, face `target`, play `animation`, apply `effect` part-way through it,
 * then finish and hand control back.
 */
export interface InteractionDef {
  id: string;
  actor: Actor;
  /** Where the actor stands to do it. Omit to do it on the spot. */
  point?: Point;
  /** What the actor looks at while doing it. */
  target?: Point | number;
  animation: Partial<PoseState>;
  seconds: number;
  /** Checked just before the animation. Return why it cannot happen, or null if it can. */
  requires?: () => string | null;
  /** The change to the game: money, inventory, hunger, objects moving. Runs once at most. */
  effect?: () => boolean | void;
  /** When in the animation the effect lands (0 = start, 1 = end). */
  effectAt?: number;
  nav?: NavGrid | null;
  speed?: number;
  ifStuck?: 'fail' | 'snap';
}

export interface PerformResult {
  ok: boolean;
  reason?: string;
  sequence?: Sequence;
}

/**
 * Runs every scripted interaction in the game and keeps the shared state they need:
 * which actors exist, which are busy, which seats and spots are taken, and which doors are moving.
 */
export class InteractionDirector {
  private static instance: InteractionDirector | null = null;

  public player: Actor | null = null;
  private actors = new Map<string, Actor>();
  private running: Sequence[] = [];
  private reservations = new Map<string, string>();
  private doors: HingedDoor[] = [];

  public static get(): InteractionDirector {
    if (!InteractionDirector.instance) InteractionDirector.instance = new InteractionDirector();
    return InteractionDirector.instance;
  }

  /** Registers an actor under the id of the object the player clicks to reach them. */
  public register(actor: Actor, ...objectIds: string[]): Actor {
    this.actors.set(actor.id, actor);
    for (const id of objectIds) this.actors.set(id, actor);
    return actor;
  }

  public actorFor(objectId: string): Actor | null {
    return this.actors.get(objectId) ?? null;
  }

  public addDoor(door: HingedDoor): HingedDoor {
    this.doors.push(door);
    return door;
  }

  // --- Seats and standing spots ------------------------------------------------------------

  /** Claims a spot for an actor. False if someone else already has it. */
  public reserve(spot: string, actor: Actor): boolean {
    const holder = this.reservations.get(spot);
    if (holder && holder !== actor.id) return false;
    this.reservations.set(spot, actor.id);
    return true;
  }

  public release(spot: string, actor?: Actor): void {
    if (actor && this.reservations.get(spot) !== actor.id) return;
    this.reservations.delete(spot);
  }

  public isTaken(spot: string): boolean {
    return this.reservations.has(spot);
  }

  // --- Running sequences -------------------------------------------------------------------

  /**
   * Starts a sequence. An actor already in an interruptible sequence drops it for this one;
   * an actor in a locked sequence makes this one refuse to start.
   */
  public run(sequence: Sequence): boolean {
    for (const actor of sequence.actors) {
      if (actor.sequence && !actor.sequence.interruptible) return false;
    }
    const posesAtStart = new Map<Actor, PoseState>();
    for (const actor of sequence.actors) {
      // Swap first, so ending the old sequence does not hand the body back for a frame
      const previous = actor.sequence;
      actor.sequence = sequence;
      previous?.cancel();
      actor.setScripted(true);
      posesAtStart.set(actor, { ...actor.pose });
    }
    sequence.onEnd((reason) => {
      for (const actor of sequence.actors) {
        if (actor.sequence !== sequence) continue;
        actor.sequence = null;
        if (!actor.hold) {
          actor.setScripted(false);
        } else if (reason !== 'done') {
          // A held actor (seated, say) stays under direction; cut short, they go back to how they were
          actor.pose = posesAtStart.get(actor) ?? actor.pose;
        }
      }
    });
    this.running.push(sequence);
    return true;
  }

  /** The steps for one interaction, to be run alone or joined with others into a longer scene. */
  public stepsFor(def: InteractionDef): Step[] {
    const list: Step[] = [];
    let applied = false;
    if (def.point) {
      list.push(steps.walk(def.actor, def.point, { nav: def.nav, speed: def.speed, ifStuck: def.ifStuck }));
    }
    if (def.target !== undefined) list.push(steps.face(def.actor, def.target));
    if (def.requires) {
      const requires = def.requires;
      list.push({
        name: `${def.id}: requirements`,
        tick: () => (requires() === null ? true : 'fail'),
      });
    }
    list.push(
      steps.animate(def.actor, def.animation, def.seconds, def.effect
        ? [{
            at: def.effectAt ?? 0.5,
            run: () => {
              if (applied) return;
              applied = true;
              return def.effect?.();
            },
          }]
        : [])
    );
    return list;
  }

  /** Performs one interaction, or several in a row as a single uninterrupted scene. */
  public perform(defs: InteractionDef | InteractionDef[], options: { locked?: boolean } = {}): PerformResult {
    const list = Array.isArray(defs) ? defs : [defs];
    const reason = list[0].requires?.() ?? null;
    if (reason) return { ok: false, reason };

    const actors = [...new Set(list.map((def) => def.actor))];
    const sequence = new Sequence(list.map((def) => def.id).join(' > '), actors);
    if (options.locked) sequence.locked();
    for (const def of list) sequence.add(...this.stepsFor(def));
    if (!this.run(sequence)) return { ok: false, reason: 'busy' };
    return { ok: true, sequence };
  }

  /**
   * The player wants to do something else. Drops what they are doing if it can be dropped.
   * Returns 'locked' if they are mid-way through something that must finish (a doorway).
   */
  public interrupt(actor: Actor): 'free' | 'released' | 'locked' {
    if (actor.sequence) {
      if (!actor.sequence.interruptible) return 'locked';
      actor.sequence.cancel();
    }
    if (actor.hold) {
      actor.hold.release();
      return actor.sequence && !actor.sequence.interruptible ? 'locked' : 'released';
    }
    return actor.scripted ? 'released' : 'free';
  }

  /** Drops whatever an actor is doing, at once and without animation. Used when a scene is torn down. */
  public forceFree(actor: Actor): void {
    actor.sequence?.cancel();
    actor.sequence = null;
    actor.hold?.release(true);
    actor.hold = null;
    actor.letGo();
    actor.setScripted(false);
  }

  public update(delta: number): void {
    if (this.running.length > 0) {
      for (const sequence of [...this.running]) sequence.update(delta);
      this.running = this.running.filter((sequence) => !sequence.ended);
    }
    // Actors in scenes that are not being shown cost nothing
    const seen = new Set<Actor>();
    for (const actor of this.actors.values()) {
      if (seen.has(actor)) continue;
      seen.add(actor);
      if (actor.isVisible()) actor.update(delta);
    }
    for (const door of this.doors) door.update(delta);
  }
}
