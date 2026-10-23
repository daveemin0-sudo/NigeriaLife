/**
 * Players in the city, over one WebSocket each.
 *
 * A city is a room, split into instances of at most INSTANCE_SIZE players. Each player tells the
 * server where they are 10 to 20 times a second; ten times a second the server sends each
 * player only the players near them (INTEREST metres, in the same building if they are inside
 * one) whose state has changed, and says when someone has gone out of sight. A player's id and
 * name are the server's, never what the game claims.
 *
 * The packets are the game's own (`src/multiplayer/types.ts`), so `NetworkManager` keeps its API:
 *   state / join   where a player is and what they look like
 *   chat           to the whole instance, or `scope: 'near'` within NEAR_CHAT metres; filtered,
 *                  slow-moded, refused while muted, not delivered to anyone who blocked the sender
 *   dm             to one player only, filtered, not to anyone who blocked the sender
 *   social, emote_sync   to the one asked, or to those in sight
 *   p2p_transfer   refused: money between players goes through the economy (POST /money/send)
 * The server adds `wallet` (the player's balance after any change) and `welcome`.
 */
import type http from 'node:http';
import { WebSocketServer, type WebSocket } from 'ws';
import type { Accounts, Account } from './accounts.ts';
import type { Position } from './economy.ts';
import { filterChat } from './chatFilter.ts';
import type { Store } from './store.ts';
import { alert } from './store.ts';

export const INSTANCE_SIZE = 200;
const INTEREST = 120;
const NEAR_CHAT = 40;
const TICK_MS = 100;
/** Chat: at most this many messages in this many ms from one player */
const CHAT_BURST = 3;
const CHAT_WINDOW_MS = 6000;
/** Faster than this on the street is not walking or driving: the position is not trusted for a while */
const TELEPORT_SPEED = 90;
const DISTRUST_MS = 10_000;
/** Jumps in ten minutes before one is raised as an alert */
const TELEPORT_ALERT_AFTER = 5;

interface NetState {
  id: string;
  name: string;
  position: { x: number; y: number; z: number };
  city?: string;
  place?: string;
  [key: string]: unknown;
}

interface Client {
  ws: WebSocket;
  account: Account;
  city: string;
  instance: string;
  state: NetState | null;
  stateText: string;
  /** When this player's state last changed */
  changed: number;
  /** Who this player can see, and when each was last sent to them */
  seen: Map<string, number>;
  chats: number[];
  distrustUntil: number;
  jumps: number[];
  position: Position | null;
}

export class Rooms {
  private wss: WebSocketServer;
  private clients = new Map<string, Client>();
  private instances = new Map<string, Set<string>>();
  private accounts: Accounts;
  private db: Store;
  private timer: NodeJS.Timeout;

  constructor(server: http.Server, accounts: Accounts, db: Store) {
    this.accounts = accounts;
    this.db = db;
    this.wss = new WebSocketServer({ noServer: true, maxPayload: 64 * 1024 });
    server.on('upgrade', (req, socket, head) => {
      const url = new URL(req.url ?? '/', 'http://localhost');
      if (url.pathname !== '/play') return socket.destroy();
      const account = this.accounts.authenticate(url.searchParams.get('token'));
      if (!account) {
        socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
        return socket.destroy();
      }
      this.wss.handleUpgrade(req, socket, head, (ws) => this.join(ws, account));
    });
    this.timer = setInterval(() => this.tick(), TICK_MS);
  }

  public close(): void {
    clearInterval(this.timer);
    for (const c of this.clients.values()) c.ws.close();
    this.wss.close();
  }

  /** Where the server last saw a player, if it trusts it. */
  public positionOf(accountId: string): Position | null {
    const c = this.clients.get(accountId);
    if (!c || !c.position || Date.now() < c.distrustUntil) return null;
    return c.position;
  }

  public online(): { players: number; byInstance: Record<string, number> } {
    const byInstance: Record<string, number> = {};
    for (const [key, members] of this.instances) if (members.size) byInstance[key] = members.size;
    return { players: this.clients.size, byInstance };
  }

  /** Sends one player a message (their new balance, say). */
  public tell(accountId: string, message: unknown): void {
    const c = this.clients.get(accountId);
    if (c && c.ws.readyState === c.ws.OPEN) c.ws.send(JSON.stringify(message));
  }

  public kick(accountId: string): void {
    this.clients.get(accountId)?.ws.close(4003, 'Removed by the game team');
  }

  private place(accountId: string, city: string): string {
    // The first instance of the city with room, or a new one
    for (let n = 1; ; n++) {
      const key = `${city}#${n}`;
      const members = this.instances.get(key) ?? new Set<string>();
      if (members.size < INSTANCE_SIZE || members.has(accountId)) {
        members.add(accountId);
        this.instances.set(key, members);
        return key;
      }
    }
  }

  private leaveInstance(c: Client): void {
    this.instances.get(c.instance)?.delete(c.account.id);
    for (const other of this.membersOf(c.instance)) other.seen.delete(c.account.id) && this.send(other, { type: 'leave', id: c.account.id });
  }

  private membersOf(instance: string): Client[] {
    return Array.from(this.instances.get(instance) ?? [], (id) => this.clients.get(id)).filter((c): c is Client => !!c);
  }

  private join(ws: WebSocket, account: Account): void {
    // One connection per account: a second one replaces the first
    const old = this.clients.get(account.id);
    if (old) {
      this.leaveInstance(old);
      old.ws.close(4001, 'Signed in somewhere else');
    }
    const city = 'lagos';
    const client: Client = { ws, account, city, instance: this.place(account.id, city), state: null, stateText: '', changed: 0, seen: new Map(), chats: [], distrustUntil: 0, jumps: [], position: null };
    this.clients.set(account.id, client);
    this.send(client, { type: 'welcome', id: account.id, name: account.name, verified: account.verified, instance: client.instance });

    ws.on('message', (raw) => {
      let packet: Record<string, unknown>;
      try {
        packet = JSON.parse(String(raw));
      } catch {
        return;
      }
      this.receive(client, packet);
    });
    ws.on('close', () => {
      if (this.clients.get(account.id) !== client) return;
      this.leaveInstance(client);
      this.clients.delete(account.id);
    });
  }

  private send(c: Client, message: unknown): void {
    if (c.ws.readyState === c.ws.OPEN) c.ws.send(JSON.stringify(message));
  }

  private blocked(by: string, sender: string): boolean {
    return !!this.db.prepare('SELECT 1 FROM blocks WHERE account_id = ? AND blocked = ?').get(by, sender);
  }

  private receive(c: Client, packet: Record<string, unknown>): void {
    switch (packet.type) {
      case 'join':
      case 'state':
        return this.updateState(c, packet.player as NetState);
      case 'chat':
        return this.chat(c, packet.message as { text?: unknown; scope?: unknown; id?: unknown });
      case 'dm':
        return this.direct(c, packet);
      case 'social': {
        const to = this.clients.get(String(packet.toId ?? ''));
        if (to && to.instance === c.instance && !this.blocked(to.account.id, c.account.id)) {
          this.send(to, { type: 'social', fromId: c.account.id, fromName: c.account.name, toId: to.account.id, kind: packet.kind === 'greet' ? 'greet' : 'wave' });
        }
        return;
      }
      case 'emote_sync':
        for (const other of this.membersOf(c.instance)) if (other !== c && other.seen.has(c.account.id)) this.send(other, { type: 'emote_sync', playerId: c.account.id, emote: String(packet.emote ?? '') });
        return;
      case 'p2p_transfer':
        this.send(c, { type: 'refused', what: 'p2p_transfer', reason: 'Money between players goes through the bank (POST /money/send).' });
        return;
      case 'leave':
        this.leaveInstance(c);
        c.state = null;
        c.stateText = '';
        return;
    }
  }

  private updateState(c: Client, player: NetState | undefined): void {
    if (!player || typeof player !== 'object' || !player.position) return;
    const x = Number(player.position.x);
    const z = Number(player.position.z);
    if (!Number.isFinite(x) || !Number.isFinite(z)) return;
    const city = typeof player.city === 'string' && /^[a-z_]{2,20}$/.test(player.city) ? player.city : c.city;
    const place = typeof player.place === 'string' ? player.place.slice(0, 60) : undefined;
    const now = Date.now();

    // A jump on the street that nobody could walk or drive: not believed for a while
    const before = c.position;
    if (before && !place && !c.state?.place && before.city === city) {
      const seconds = Math.max(0.05, (now - before.at) / 1000);
      const speed = Math.hypot(x - before.x, z - before.z) / seconds;
      if (speed > TELEPORT_SPEED && Math.hypot(x - before.x, z - before.z) > 30) {
        // Rides and doors move players legitimately too, so one jump only costs a few seconds of
        // trust; jumping again and again is raised for the admin page
        c.distrustUntil = now + DISTRUST_MS;
        c.jumps = c.jumps.filter((t) => now - t < 10 * 60_000);
        c.jumps.push(now);
        if (c.jumps.length === TELEPORT_ALERT_AFTER) alert(this.db, c.account.id, 'teleport', `${c.jumps.length} jumps in ten minutes, the last ${Math.round(Math.hypot(x - before.x, z - before.z))} m in ${seconds.toFixed(2)} s in ${city}`);
      }
    }
    c.position = place ? { city, x: NaN, z: NaN, at: now } : { city, x, z, at: now };

    if (city !== c.city) {
      this.leaveInstance(c);
      c.city = city;
      c.instance = this.place(c.account.id, city);
      c.seen.clear();
      this.send(c, { type: 'welcome', id: c.account.id, name: c.account.name, verified: c.account.verified, instance: c.instance });
    }
    // The server's id and name, whatever the game sent; others are only sent it again if it changed
    const state = { ...player, id: c.account.id, name: c.account.name, city, place };
    const text = JSON.stringify(state);
    if (text !== c.stateText) {
      c.state = state;
      c.stateText = text;
      c.changed = now;
    }
  }

  private chat(c: Client, message: { text?: unknown; scope?: unknown; id?: unknown } | undefined): void {
    if (!message) return;
    const now = Date.now();
    const account = this.accounts.get(c.account.id) ?? c.account;
    if (account.mutedUntil > now) {
      this.send(c, { type: 'refused', what: 'chat', reason: 'You are muted for now.' });
      return;
    }
    c.chats = c.chats.filter((t) => now - t < CHAT_WINDOW_MS);
    if (c.chats.length >= CHAT_BURST) {
      this.send(c, { type: 'refused', what: 'chat', reason: 'Slow down: wait a few seconds before the next message.' });
      return;
    }
    c.chats.push(now);
    const { text, masked } = filterChat(String(message.text ?? ''));
    if (!text.trim()) return;
    const near = message.scope === 'near';
    const out = {
      type: 'chat',
      message: { id: String(message.id ?? `${c.account.id}:${now}`).slice(0, 60), senderId: c.account.id, senderName: c.account.name, text, timestamp: new Date(now).toISOString(), scope: near ? 'near' : 'city' },
    };
    if (masked) this.send(c, out);
    for (const other of this.membersOf(c.instance)) {
      if (other === c || this.blocked(other.account.id, c.account.id)) continue;
      if (near && !(other.position && c.position && Math.hypot(other.position.x - c.position.x, other.position.z - c.position.z) <= NEAR_CHAT)) continue;
      this.send(other, out);
    }
  }

  private direct(c: Client, packet: Record<string, unknown>): void {
    const to = this.clients.get(String(packet.toId ?? ''));
    const account = this.accounts.get(c.account.id) ?? c.account;
    if (account.mutedUntil > Date.now()) return this.send(c, { type: 'refused', what: 'dm', reason: 'You are muted for now.' });
    if (!to) return this.send(c, { type: 'refused', what: 'dm', reason: 'They are not online.' });
    if (this.blocked(to.account.id, c.account.id)) return;
    const { text } = filterChat(String(packet.text ?? ''));
    if (text.trim()) this.send(to, { type: 'dm', fromId: c.account.id, fromName: c.account.name, toId: to.account.id, text });
  }

  /** Ten times a second: each player is sent the players in sight whose state changed. */
  private tick(): void {
    for (const [key, members] of this.instances) {
      if (members.size === 0) continue;
      const list = this.membersOf(key);
      for (const viewer of list) {
        if (!viewer.state) continue;
        const packets: unknown[] = [];
        for (const other of list) {
          if (other === viewer || !other.state) continue;
          const inSight =
            (other.state.place ?? '') === (viewer.state.place ?? '') &&
            Math.hypot(other.state.position.x - viewer.state.position.x, other.state.position.z - viewer.state.position.z) <= INTEREST;
          const sent = viewer.seen.get(other.account.id);
          if (inSight) {
            if (sent === undefined || other.changed > sent) {
              packets.push({ type: 'state', player: other.state });
              viewer.seen.set(other.account.id, other.changed);
            }
          } else if (sent !== undefined) {
            viewer.seen.delete(other.account.id);
            packets.push({ type: 'leave', id: other.account.id });
          }
        }
        if (packets.length) this.send(viewer, { type: 'batch', packets });
      }
    }
  }
}
