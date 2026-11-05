import type * as THREE from 'three';
import type { Actor } from '../interactions/Actor';
import type { InteractionDirector } from '../interactions/InteractionDirector';
import type { BackendService } from '../backend/BackendService';

/** What a place needs from the game to let the player do something there. */
export interface PlaceHost {
  actor: Actor;
  backend: BackendService;
  director: InteractionDirector;
  say(text: string, kind?: 'success' | 'warning' | 'info'): void;
  /** Turns the street camera: which side of the player it is on, how high it looks down from, how far back. */
  look(yaw: number, pitch: number, distance: number): void;
  /** The time on the game's clock, 0 to 24 */
  hour(): number;
  /** Puts a question to the player with a few answers to pick from: a menu, a choice of seats. */
  ask(question: { who: string; role?: string; text: string; choices: Array<{ label: string; note?: string; pick: () => void }> }): void;
  /** Has the player dance, for this many seconds or until they walk off. */
  emote(name: 'zanku' | 'groove' | 'dance', seconds: number): void;
  /**
   * Takes the player into a building, by the id its door is registered under. With `comeOutAt`,
   * they go straight in from where they stand and will come out at that point instead: in
   * from the apron, say, and out at the kerb.
   */
  enter(buildingId: string, comeOutAt?: THREE.Vector3): void;
  /** Takes the player out of the room they are in, to this point outside rather than back the way they came. */
  leave(comeOutAt: THREE.Vector3, facing?: number): void;
  /** Puts the screen of the cash machine the player is standing at in front of them. */
  cashMachine(): void;
  /**
   * Takes the player into another room of the same building, at this spot and facing this way
   * (up in the lift, through a hotel room's door). Leaving the building still comes out at the
   * road where they went in.
   */
  ride(id: string, spawnAt: THREE.Vector3, spawnYaw: number): void;
}

/** What the button on a thing's card says, and what pressing it does. */
export interface PlaceAction {
  label(): string;
  run(host: PlaceHost): void;
}

const actions = new Map<string, PlaceAction>();

/**
 * What can be done at each thing in the world, by the id of the thing. A place says what its
 * own things do when it is built (a ticket booth, a loading bay, a bar), and the card that
 * comes up for one of them asks here. This is the one way a place adds something to do:
 * nothing about a particular place is written into the screen that shows the card.
 */
export const PlaceActions = {
  register(id: string, action: PlaceAction): void {
    actions.set(id, action);
  },
  registerAll(all: Record<string, PlaceAction>): void {
    for (const [id, action] of Object.entries(all)) actions.set(id, action);
  },
  /** The thing is gone (a piece of furniture sold, say): nothing can be done at it any more. */
  unregister(id: string): void {
    actions.delete(id);
  },
  get(id: string): PlaceAction | null {
    return actions.get(id) ?? null;
  },
};
