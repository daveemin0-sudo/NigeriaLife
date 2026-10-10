import { BackendService } from '../backend/BackendService';
import { PROFILE_ID } from '../backend/Profile';
import { ServerLink, NETWORK_PLAYER_ID } from './ServerLink';
import { emptyRegistry, type RegistryState } from './types';

/**
 * The record of who owns what.
 *
 * It is one document. Every change to it is made alone, under a lock, and is checked against
 * the document as it is at that moment, not as a screen last showed it. That is what makes
 * trading correct: no asset can end up with two owners, no sale can be paid twice.
 *
 * WHERE IT LIVES. With no world server, it lives in this browser's storage and is shared by
 * the players (tabs) in this browser, locked across tabs with the browser's own lock. With a
 * world server (see ServerLink and server/world-server.mjs), it lives on the server and is
 * shared by every device connected to it, locked by the server.
 *
 * WHAT THAT DOES NOT GIVE. The rules are applied by the games, not by the server, and money
 * is in each player's own saved game. So this is not proof against someone who edits their
 * browser's storage or writes to the server themselves. It is right for playing with people
 * you trust. A public game needs a server that also runs the rules and holds the money. The
 * functions that change the registry are written as "take the state, check it, change it in
 * one step" so that they can be moved there.
 */

const STORAGE_KEY = 'nigeria_life_world_registry_v1';
const LOCK_NAME = 'nigeria_life_world_registry';

/**
 * This player's stable id. On a world server it is an id made once for this device's player;
 * otherwise it comes from which local profile the tab is playing. Never from a display name.
 */
export const MY_ID = NETWORK_PLAYER_ID ?? `local:${PROFILE_ID}`;

const OFFLINE = { ok: false, reason: 'The world server cannot be reached, so nothing was changed.' };

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
    tenancies: record(from.tenancies),
    vehicles: record(from.vehicles),
    fittings: record(from.fittings),
  };
}

function parse(text: string | null): RegistryState {
  try {
    return sanitise(text ? JSON.parse(text) : null);
  } catch (error) {
    console.warn('The ownership registry could not be read; starting from an empty one', error);
    return emptyRegistry();
  }
}

const refused = (result: unknown) => !!result && typeof result === 'object' && 'ok' in (result as object) && (result as { ok?: boolean }).ok === false;

export class Registry {
  private static instance: Registry | null = null;
  private cache: RegistryState;
  private cachedText: string | null = null;
  private listeners: Listener[] = [];
  /** Changes made in this game wait their turn here */
  private queue: Promise<unknown> = Promise.resolve();
  private readonly link = ServerLink.get();
  /** Settled once the registry has been read for the first time (at once, unless it is on a server) */
  public readonly ready: Promise<void>;

  private constructor() {
    if (this.link) {
      this.cache = emptyRegistry();
      this.ready = this.fetchRemote();
      this.link.on('registry', () => void this.fetchRemote());
      // Back in touch after a gap: catch up
      this.link.on('link', (connected) => {
        if (connected) void this.fetchRemote();
      });
      return;
    }
    this.cache = this.load();
    this.ready = Promise.resolve();
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

  /** Is the registry on a world server, shared between devices? */
  public get shared(): boolean {
    return this.link !== null;
  }

  private load(): RegistryState {
    let text: string | null = null;
    try {
      text = localStorage.getItem(STORAGE_KEY);
    } catch (error) {
      console.warn('Browser storage is not available', error);
    }
    this.cachedText = text;
    return parse(text);
  }

  private async fetchRemote(): Promise<void> {
    try {
      const got = await this.link!.get<{ text: string }>('/registry');
      if (got.text === this.cachedText) return;
      this.cachedText = got.text;
      this.cache = parse(got.text);
      this.tell();
    } catch {
      // Not reachable just now. The link will say when it is back.
    }
  }

  /** The registry as this game last saw it. For drawing screens; never for deciding a sale. */
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
   * Makes one change to the registry, alone. `change` is given the registry as it is at that
   * moment and may alter it; whatever it returns is handed back. If it returns a result with
   * `ok: false`, nothing is written.
   *
   * The change must do everything that belongs together (check, take the money, move the
   * title) before it returns, with no waiting in between. If the registry then cannot be
   * saved, whatever the change did to this player's own account is undone, so money is never
   * taken for something that was not recorded.
   */
  public async transact<T>(change: (state: RegistryState) => T): Promise<T> {
    if (this.link) {
      const next = this.queue.then(() => this.transactOnServer(change), () => this.transactOnServer(change));
      this.queue = next.catch(() => undefined);
      return next;
    }

    const run = (): T => {
      const state = this.load();
      const undo = BackendService.getInstance().checkpoint();
      const result = change(state);
      if (refused(result)) {
        this.cache = this.load();
        return result;
      }
      const text = JSON.stringify(state);
      const changed = text !== this.cachedText;
      if (changed) {
        try {
          localStorage.setItem(STORAGE_KEY, text);
        } catch (error) {
          console.warn('The ownership registry could not be saved', error);
          undo();
          this.cache = this.load();
          return { ok: false, reason: 'The change could not be saved, so nothing was changed.' } as T;
        }
        this.cachedText = text;
      }
      this.cache = state;
      // Only a real change is announced: a check that found nothing to do must not set off another round of checks
      if (changed) this.tell();
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

  /** The same, with the server holding the lock and the document. */
  private async transactOnServer<T>(change: (state: RegistryState) => T): Promise<T> {
    const link = this.link!;
    let granted: { token: string; text: string };
    try {
      granted = await link.post<{ token: string; text: string }>('/lock', { client: link.clientId });
    } catch {
      return OFFLINE as T;
    }

    const state = parse(granted.text);
    const undo = BackendService.getInstance().checkpoint();
    let result: T;
    try {
      result = change(state);
    } catch (error) {
      undo();
      void link.post('/commit', { token: granted.token, text: null }).catch(() => undefined);
      throw error;
    }

    const text = refused(result) ? null : JSON.stringify(state);
    try {
      await link.post('/commit', { token: granted.token, text });
    } catch {
      // The server never took the change: put this player's account back as it was
      undo();
      return OFFLINE as T;
    }
    if (text !== null && text !== this.cachedText) {
      this.cachedText = text;
      this.cache = state;
      this.tell();
    }
    return result;
  }

  /** A new id that no other record in the registry has. Call inside `transact`. */
  public static nextId(state: RegistryState, prefix: string): string {
    state.serial += 1;
    return `${prefix}_${state.serial.toString(36)}_${Math.floor(Math.random() * 1e6).toString(36)}`;
  }
}
