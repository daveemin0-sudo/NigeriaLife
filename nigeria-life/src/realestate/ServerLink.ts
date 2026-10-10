import { profileKey } from '../backend/Profile';

/**
 * The link to a world server, when the game is set to use one.
 *
 * Without a server the game is what it always was: everything in this browser. With one, the
 * ownership registry lives on the server and is shared by every device that connects to it,
 * and players on those devices see each other in the city.
 *
 * The server's address comes from `?server=http://host:8787` on the page's address (which is
 * then remembered), or from the Settings app. `?server=off` forgets it.
 */

const ADDRESS_KEY = 'nigeria_life_world_server';
const ROOM_KEY = 'nigeria_life_world_server_key';

function readAddress(): { url: string | null; key: string } {
  try {
    const params = new URLSearchParams(window.location.search);
    const asked = params.get('server');
    if (asked !== null) {
      if (asked === '' || asked === 'off') {
        localStorage.removeItem(ADDRESS_KEY);
        localStorage.removeItem(ROOM_KEY);
      } else {
        localStorage.setItem(ADDRESS_KEY, asked.replace(/\/+$/, ''));
        const key = params.get('key');
        if (key !== null) localStorage.setItem(ROOM_KEY, key);
      }
    }
    const url = localStorage.getItem(ADDRESS_KEY);
    return { url: url && /^https?:\/\//.test(url) ? url : null, key: localStorage.getItem(ROOM_KEY) ?? '' };
  } catch {
    return { url: null, key: '' };
  }
}

const address = readAddress();

/** The world server this game is using, or null when it is playing in this browser only. */
export const SERVER_URL = address.url;

/** Remembers a server to use from now on (or none), for the next time the game starts. */
export function rememberServer(url: string | null, key = ''): void {
  if (url) {
    localStorage.setItem(ADDRESS_KEY, url.trim().replace(/\/+$/, ''));
    if (key) localStorage.setItem(ROOM_KEY, key);
    else localStorage.removeItem(ROOM_KEY);
  } else {
    localStorage.removeItem(ADDRESS_KEY);
    localStorage.removeItem(ROOM_KEY);
  }
}

/** This device's player on a server: made once and kept, never taken from a display name. */
function networkPlayerId(): string {
  const key = profileKey('nigeria_life_network_player_id');
  let id = localStorage.getItem(key);
  if (!id) {
    id = `net:${crypto.randomUUID()}`;
    localStorage.setItem(key, id);
  }
  return id;
}

export const NETWORK_PLAYER_ID = SERVER_URL ? networkPlayerId() : null;

type Handler = (data: unknown) => void;

export class ServerLink {
  private static instance: ServerLink | null = null;
  /** One per running game, so the server knows which game a message came from */
  public readonly clientId = crypto.randomUUID();
  public connected = false;
  private readonly handlers = new Map<string, Handler[]>();
  private outbox: unknown[] = [];
  private flushing: number | null = null;

  private readonly url: string;

  private constructor(url: string) {
    this.url = url;
    const source = new EventSource(`${url}/events?client=${this.clientId}${address.key ? `&key=${encodeURIComponent(address.key)}` : ''}`);
    source.onopen = () => this.setConnected(true);
    source.onerror = () => this.setConnected(false);
    for (const type of ['hello', 'registry', 'net', 'gone']) {
      source.addEventListener(type, (event) => {
        this.setConnected(true);
        let data: unknown = null;
        try {
          data = JSON.parse((event as MessageEvent).data);
        } catch {
          return;
        }
        for (const handler of this.handlers.get(type) ?? []) handler(data);
      });
    }
  }

  /** The link, or null when the game is not using a server. */
  public static get(): ServerLink | null {
    if (!SERVER_URL) return null;
    if (!ServerLink.instance) ServerLink.instance = new ServerLink(SERVER_URL);
    return ServerLink.instance;
  }

  private setConnected(now: boolean): void {
    if (this.connected === now) return;
    this.connected = now;
    for (const handler of this.handlers.get('link') ?? []) handler(now);
  }

  /** Listens for something from the server: `registry`, `net`, `gone`, `hello`, or `link` for the connection coming and going. */
  public on(type: string, handler: Handler): void {
    this.handlers.set(type, [...(this.handlers.get(type) ?? []), handler]);
  }

  public async get<T>(path: string): Promise<T> {
    const response = await fetch(`${this.url}${path}`, { headers: address.key ? { 'x-nl-key': address.key } : {}, cache: 'no-store' });
    if (!response.ok) throw new Error(`world server said ${response.status}`);
    return (await response.json()) as T;
  }

  public async post<T>(path: string, body: unknown): Promise<T> {
    const response = await fetch(`${this.url}${path}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...(address.key ? { 'x-nl-key': address.key } : {}) },
      body: JSON.stringify(body),
    });
    if (!response.ok) throw new Error(`world server said ${response.status}`);
    return (await response.json()) as T;
  }

  /** Sends something to the other players' games. Many small messages a second go as a few bundles. */
  public relay(packet: unknown): void {
    this.outbox.push(packet);
    if (this.flushing !== null) return;
    this.flushing = window.setTimeout(() => {
      this.flushing = null;
      // Of the position updates waiting, only the latest matters; everything else is sent in order
      const waiting = this.outbox;
      this.outbox = [];
      let lastState = -1;
      waiting.forEach((packet, index) => {
        if ((packet as { type?: string }).type === 'state') lastState = index;
      });
      const packets = waiting.filter((packet, index) => (packet as { type?: string }).type !== 'state' || index === lastState);
      void this.post('/net', { client: this.clientId, packets }).catch(() => this.setConnected(false));
    }, 90);
  }
}
