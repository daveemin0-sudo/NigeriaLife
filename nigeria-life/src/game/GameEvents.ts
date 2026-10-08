/**
 * Things the player does that other systems react to (story quests today).
 * Gameplay code reports what happened here instead of calling the quest system directly,
 * so an activity cannot be wired up without its progress being counted.
 */
export type GameEventType = 'eat' | 'work_shift' | 'drive' | 'arrive_city' | 'interact_object';

export interface GameEventData {
  city?: string;
  objectId?: string;
}

type GameEventListener = (type: GameEventType, data?: GameEventData) => void;

const listeners: GameEventListener[] = [];

export function onGameEvent(listener: GameEventListener): void {
  listeners.push(listener);
}

export function emitGameEvent(type: GameEventType, data?: GameEventData): void {
  for (const listener of listeners) {
    listener(type, data);
  }
}
