import { PROFILE_ID } from '../backend/Profile';
import { emptyRegistry, type RegistryState } from './types';

/**
 * The record of who owns what, shared by every player in this browser.
 *
 * WHAT THIS IS AND IS NOT. NigeriaLife has no server. This registry is a single document in
 * the browser's storage that every tab of the game reads and writes. It is the one place
 * ownership is recorded, every change to it is made under a lock so two tabs cannot both
 * change it at once, and every change is checked against the document as it is at that
 * moment, not as a screen last showed it. That is enough to make trading between players on
 * one computer correct: no asset can end up with two owners, no sale can be paid twice.
 *
 * It is not secure. Anyone at this computer can open the browser's storage and edit it, and
 * players on other computers do not share it at all. Real multiplayer ownership needs a
 * server that holds this document and makes these same checks. The functions here are written
 * so that they could be moved to one: each takes the state, checks it, and changes it in one step.
 */

const STORAGE_KEY = 'nigeria_life_world_registry_v1';
const LOCK_NAME = 'nigeria_life_world_registry';

/** This player's stable id. It comes from which local profile the tab is playing, never from a display name. */
export const MY_ID = `local:${PROFILE_ID}`;

type Listener = (state: RegistryState) => void;

function sanitise(raw: unknown): RegistryState {
  const base = emptyRegistry();
  if (!raw || typeof raw !== 'object') return base;
  const from = raw as Partial<RegistryState>;
  const record = <T,>(value: unknown): Record<string, T> => (value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, T>) : {});
  return {
    version: 1,
    serial: Number.isFinite(from.serial) ? Number(from.serial) : 0,
    players: record(from.players),
    titles: record(from.titles),
    listings: record(from.listings),
    negotiations: record(from.negotiations),
    sales: Array.isArray(from.sales) ? from.sales : [],
    payouts: record(from.payouts),
    buildings: record(from.buildings),
    vehicles: record(from.vehicles),
  };
}

export class Registry {
  private static instance: Registry | null = null;
  private cache: RegistryState;
  private cachedText: string | null = null;
  private listeners: Listener[] = [];
  /** Changes made in this tab wait their turn here when the browser has no cross-tab lock */
  private queue: Promise<unknown> = Promise.resolve();

  private constructor() {
    this.cache = this.load();
    // Another tab changed it: this tab sees the same world
    window.addEventListener('storage', (event) => {
      if (event.key !== STORAGE_KEY) return;
      this.cache = this.load();
      this.tell();
    });
  }

  public static get(): Registry {
    if (!Registry.instance) Registry.instance = new Registry();
    return Registry.instance;
  }

  private load(): RegistryState {
    try {
      const text = localStorage.getItem(STORAGE_KEY);
      this.cachedText = text;
      return sanitise(text ? JSON.parse(text) : null);
    } catch (error) {
      console.warn('The ownership registry could not be read; starting from an empty one', error);
      return emptyRegistry();
    }
  }

  /** The registry as this tab last saw it. For drawing screens; never for deciding a sale. */
  public peek(): RegistryState {
    return this.cache;
  }

  public subscribe(listener: Listener): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((entry) => entry !== listener);
    };
  }

  private tell(): void {
    for (const listener of this.listeners) {
      try {
        listener(this.cache);
      } catch (error) {
        console.error('A registry listener failed', error);
      }
    }
  }

  /**
   * Makes one change to the registry, alone. `change` is given the registry as it is in
   * storage at that moment and may alter it; whatever it returns is handed back. If it
   * throws, or returns a result with `ok: false`, nothing is written.
   *
   * The change must do everything that belongs together (check, take the money, move the
   * title) before it returns, with no waiting in between.
   */
  public async transact<T>(change: (state: RegistryState) => T): Promise<T> {
    const run = (): T => {
      const state = this.load();
      // Money is taken inside `change`. If the registry cannot be written at all, find out
      // before anything is paid for, not after.
      if (this.cachedText !== null) localStorage.setItem(STORAGE_KEY, this.cachedText);
      const result = change(state);
      const failed = result && typeof result === 'object' && 'ok' in (result as object) && (result as { ok?: boolean }).ok === false;
      if (!failed) {
        const text = JSON.stringify(state);
        if (text !== this.cachedText) {
          localStorage.setItem(STORAGE_KEY, text);
          this.cachedText = text;
        }
        this.cache = state;
        this.tell();
      } else {
        this.cache = this.load();
      }
      return result;
    };

    const locks = typeof navigator !== 'undefined' ? navigator.locks : undefined;
    if (locks?.request) {
      return locks.request(LOCK_NAME, () => run()) as Promise<T>;
    }
    // No cross-tab lock in this browser: one at a time within this tab is the best there is
    const next = this.queue.then(run, run);
    this.queue = next.catch(() => undefined);
    return next;
  }

  /** A new id that no other record in the registry has. Call inside `transact`. */
  public static nextId(state: RegistryState, prefix: string): string {
    state.serial += 1;
    return `${prefix}_${state.serial.toString(36)}_${Math.floor(Math.random() * 1e6).toString(36)}`;
  }
}
