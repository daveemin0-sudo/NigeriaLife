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
 *   profile              to those in sight
 *   tie, offer, offer_update   to the one asked, unless they blocked the sender
 *   p2p_transfer   refused: money between players goes through the economy (POST /money/send)
 * The server adds `wallet` (the player's balance after any change) and `welcome`.
 *
 * One process takes at most `maxPlayers` (NL_MAX_PLAYERS; measured in docs/LOADTEST.md). The
 * next player is held in a line and sent `{ type: 'queued', position, ahead }` until a place
 * opens; they are then admitted with the usual `welcome` without doing anything. Someone who is
 * already in (a second tab, a reconnect) never waits.
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
/** Players further than this are sent at most every FAR_EVERY_MS: they are small on screen */
const NEAR_FULL_RATE = 40;
const FAR_EVERY_MS = 300;
const TICK_MS = 100;
/** Chat: at most this many messages in this many ms from one player */
const CHAT_BURST = 3;
const CHAT_WINDOW_MS = 6000;
/** Faster than this on the street is not walking or driving: the position is not trusted for a while */
const TELEPORT_SPEED = 90;
const DISTRUST_MS = 10_000;
/** Jumps in ten minutes before one is raised as an alert */
const TELEPORT_ALERT_AFTER = 5;
/** Players one process admits before the next waits in line, unless NL_MAX_PLAYERS says otherwise */
export const DEFAULT_MAX_PLAYERS = 300;
/** A socket this far behind on sending is skipped for a tick of positions rather than buffering more */
const SLOW_SOCKET_BYTES = 512 * 1024;
/** Tick times kept for the metrics */
const TICK_SAMPLES = 600;

/** How the process is coping, for the admin page and the load test */
export interface RoomMetrics {
  players: number;
  queued: number;
  maxPlayers: number;
  instances: number;
  tick: { avgMs: number; p95Ms: number; maxMs: number; budgetMs: number };
  messagesIn: number;
  messagesOut: number;
  bytesOut: number;
  /** What actually went over the wire to the players connected now, after compression */
  wireBytesOut: number;
  /** Position batches skipped because a socket was too far behind */
  dropped: number;
  admittedFromQueue: number;
}

interface Waiting {
  ws: WebSocket;
  account: Account;
  since: number;
  lean: boolean;
}

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
  /** When this player's look (config) last changed */
  lookChanged: number;
  lookText: string;
  /** For each player in sight, the look change this player was last sent */
  lookSeen: Map<string, number>;
  /** For each player in sight, when they were last sent to this player */
  sentAt: Map<string, number>;
  /** This player's state as packets, written once per change, not once per viewer */
  fullPacket: string;
  leanPacket: string;
  /** The game said it understands a state without the look when the look has not changed */
  lean: boolean;
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
  private readonly maxPlayers: number;
  private queue: Waiting[] = [];
  private tickTimes: number[] = [];
  private wireAtReset = 0;
  private wireBytes(): number {
    let total = 0;
    for (const c of this.clients.values()) total += (c.ws as unknown as { _socket?: { bytesWritten?: number } })._socket?.bytesWritten ?? 0;
    return total;
  }
  private counts = { messagesIn: 0, messagesOut: 0, bytesOut: 0, dropped: 0, admittedFromQueue: 0 };

  constructor(server: http.Server, accounts: Accounts, db: Store, maxPlayers = DEFAULT_MAX_PLAYERS) {
    this.accounts = accounts;
    this.db = db;
    this.maxPlayers = Math.max(1, Math.floor(maxPlayers));
    // Compression: positions repeat the same keys, so they shrink well. Off with NL_DEFLATE=0.
    const deflate = process.env.NL_DEFLATE !== '0';
    this.wss = new WebSocketServer({
      noServer: true,
      maxPayload: 64 * 1024,
      perMessageDeflate: deflate ? { threshold: 256, zlibDeflateOptions: { level: 1 }, serverNoContextTakeover: false, clientNoContextTakeover: true } : false,
    });
    server.on('upgrade', (req, socket, head) => {
      const url = new URL(req.url ?? '/', 'http://localhost');
      if (url.pathname !== '/play') return socket.destroy();
      const account = this.accounts.authenticate(url.searchParams.get('token'));
      if (!account) {
        socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
        return socket.destroy();
      }
      const lean = url.searchParams.get('proto') === '2';
      this.wss.handleUpgrade(req, socket, head, (ws) => this.admitOrQueue(ws, account, lean));
    });
    this.timer = setInterval(() => this.tick(), TICK_MS);
  }

  public close(): void {
    clearInterval(this.timer);
    for (const c of this.clients.values()) c.ws.close();
    for (const w of this.queue) w.ws.close();
    this.queue = [];
    this.wss.close();
  }

  /** Where the server last saw a player, if it trusts it. */
  public positionOf(accountId: string): Position | null {
    const c = this.clients.get(accountId);
    if (!c || !c.position || Date.now() < c.distrustUntil) return null;
    return c.position;
  }

  public online(): { players: number; queued: number; byInstance: Record<string, number> } {
    const byInstance: Record<string, number> = {};
    for (const [key, members] of this.instances) if (members.size) byInstance[key] = members.size;
    return { players: this.clients.size, queued: this.queue.length, byInstance };
  }

  public metrics(): RoomMetrics {
    const times = [...this.tickTimes].sort((a, b) => a - b);
    const avg = times.length ? times.reduce((a, b) => a + b, 0) / times.length : 0;
    const p95 = times.length ? times[Math.min(times.length - 1, Math.floor(times.length * 0.95))] : 0;
    const round = (n: number) => Math.round(n * 100) / 100;
    return {
      players: this.clients.size,
      queued: this.queue.length,
      maxPlayers: this.maxPlayers,
      instances: Array.from(this.instances.values()).filter((m) => m.size > 0).length,
      tick: { avgMs: round(avg), p95Ms: round(p95), maxMs: round(times.at(-1) ?? 0), budgetMs: TICK_MS },
      ...this.counts,
      wireBytesOut: this.wireBytes() - this.wireAtReset,
    };
  }

  /** Clears the tick samples and counters, so a load-test step measures only itself. */
  public resetMetrics(): void {
    this.wireAtReset = this.wireBytes();
    this.tickTimes = [];
    this.counts = { messagesIn: 0, messagesOut: 0, bytesOut: 0, dropped: 0, admittedFromQueue: 0 };
  }

  // --- The line to get in -----------------------------------------------------------------------

  private admitOrQueue(ws: WebSocket, account: Account, lean = false): void {
    // Already playing (another tab, a reconnect) or room to spare, and nobody waiting ahead
    if (this.clients.has(account.id) || (this.clients.size < this.maxPlayers && this.queue.length === 0)) {
      return this.join(ws, account, lean);
    }
    // The same account waiting twice keeps only its newest socket, at the old place in line
    const existing = this.queue.find((w) => w.account.id === account.id);
    if (existing) {
      existing.ws.close(4001, 'Signed in somewhere else');
      existing.ws = ws;
      existing.lean = lean;
    } else {
      this.queue.push({ ws, account, since: Date.now(), lean });
    }
    const waiting = this.queue.find((w) => w.ws === ws)!;
    ws.on('close', () => {
      const i = this.queue.indexOf(waiting);
      if (i >= 0 && waiting.ws === ws) {
        this.queue.splice(i, 1);
        this.tellQueue(i);
      }
    });
    this.tellQueue(this.queue.indexOf(waiting));
  }

  /** Tells everyone from this place in line on their new position. */
  private tellQueue(from = 0): void {
    for (let i = Math.max(0, from); i < this.queue.length; i++) {
      const w = this.queue[i];
      if (w.ws.readyState === w.ws.OPEN) w.ws.send(JSON.stringify({ type: 'queued', position: i + 1, ahead: i, online: this.clients.size }));
    }
  }

  /** Lets in whoever is next while there is room. */
  private admitNext(): void {
    let admitted = false;
    while (this.queue.length && this.clients.size < this.maxPlayers) {
      const next = this.queue.shift()!;
      if (next.ws.readyState !== next.ws.OPEN) continue;
      next.ws.removeAllListeners('close');
      this.counts.admittedFromQueue++;
      this.join(next.ws, next.account, next.lean);
      admitted = true;
    }
    if (admitted) this.tellQueue();
  }

  /** Is this player connected now? */
  public isOnline(accountId: string): boolean {
    return this.clients.has(accountId);
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

  private join(ws: WebSocket, account: Account, lean = false): void {
    // One connection per account: a second one replaces the first
    const old = this.clients.get(account.id);
    if (old) {
      this.leaveInstance(old);
      old.ws.close(4001, 'Signed in somewhere else');
    }
    const city = 'lagos';
    const client: Client = { ws, account, city, instance: this.place(account.id, city), state: null, stateText: '', changed: 0, seen: new Map(), lookChanged: 0, lookText: '', lookSeen: new Map(), sentAt: new Map(), fullPacket: '', leanPacket: '', lean, chats: [], distrustUntil: 0, jumps: [], position: null };
    this.clients.set(account.id, client);
    this.send(client, { type: 'welcome', id: account.id, name: account.name, verified: account.verified, instance: client.instance });

    ws.on('message', (raw) => {
      this.counts.messagesIn++;
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
      this.admitNext();
    });
  }

  private send(c: Client, message: unknown): void {
    this.sendText(c, JSON.stringify(message));
  }

  private sendText(c: Client, text: string): void {
    if (c.ws.readyState !== c.ws.OPEN) return;
    this.counts.messagesOut++;
    this.counts.bytesOut += text.length;
    c.ws.send(text);
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
      case 'profile': {
        // Who a player shows themselves to be: to those who can see them, never bigger than a card
        const text = JSON.stringify(packet.profile ?? null);
        if (text.length > 4000) return;
        for (const other of this.membersOf(c.instance)) if (other !== c && other.seen.has(c.account.id)) this.send(other, { type: 'profile', playerId: c.account.id, profile: JSON.parse(text) });
        return;
      }
      case 'tie':
      case 'offer':
      case 'offer_update': {
        // One player to another: the sender is who the server says they are, and a block stops it
        const target = packet.type === 'offer' ? String((packet.offer as Record<string, unknown> | undefined)?.workerId ?? '') : String(packet.toId ?? '');
        const to = this.clients.get(target);
        if (!to || to.instance !== c.instance || this.blocked(to.account.id, c.account.id)) return;
        if (packet.type === 'tie') {
          const kinds = ['family_ask', 'family_yes', 'family_no', 'bae_ask', 'bae_yes', 'bae_no'];
          if (!kinds.includes(String(packet.kind))) return;
          this.send(to, { type: 'tie', fromId: c.account.id, fromName: c.account.name, toId: to.account.id, kind: packet.kind });
        } else if (packet.type === 'offer') {
          const o = (packet.offer ?? {}) as Record<string, unknown>;
          const fee = Math.round(Number(o.fee));
          if (!Number.isFinite(fee) || fee < 1000 || fee > 10_000_000) return;
          this.send(to, { type: 'offer', offer: { id: String(o.id ?? '').slice(0, 60), employerId: c.account.id, employerName: c.account.name, workerId: to.account.id, workerName: to.account.name, role: String(o.role ?? 'hustle').slice(0, 20), details: String(o.details ?? '').slice(0, 140), fee, budget: Math.max(0, Math.min(10_000_000, Math.round(Number(o.budget) || 0))), when: String(o.when ?? 'now').slice(0, 10), at: Date.now(), state: 'offered' } });
        } else {
          const states = ['accepted', 'declined', 'done', 'paid'];
          if (!states.includes(String(packet.state))) return;
          const rating = typeof packet.rating === 'number' ? Math.max(1, Math.min(5, Math.round(packet.rating))) : undefined;
          this.send(to, { type: 'offer_update', id: String(packet.id ?? '').slice(0, 60), fromId: c.account.id, toId: to.account.id, state: packet.state, rating });
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
    c.position = place ? { city, x: NaN, z: NaN, place, at: now } : { city, x, z, at: now };

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
      const lookText = JSON.stringify((player as { config?: unknown }).config ?? null);
      if (lookText !== c.lookText) {
        c.lookText = lookText;
        c.lookChanged = now;
      }
      c.fullPacket = `{"type":"state","player":${text}}`;
      // Without the look, the name (the game keeps the last one) and with positions to the centimetre
      const { config: _look, name: _name, ...motion } = state as NetState;
      const cm = (n: unknown) => (typeof n === 'number' ? Math.round(n * 100) / 100 : n);
      const lean = { ...motion, position: { x: cm(state.position.x), y: cm(state.position.y), z: cm(state.position.z) }, rotationY: cm(motion.rotationY) };
      c.leanPacket = `{"type":"state","player":${JSON.stringify(lean)}}`;
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
    const started = performance.now();
    try {
      this.sendPositions();
    } finally {
      this.tickTimes.push(performance.now() - started);
      if (this.tickTimes.length > TICK_SAMPLES) this.tickTimes.splice(0, this.tickTimes.length - TICK_SAMPLES);
    }
  }

  private sendPositions(): void {
    const now = Date.now();
    for (const [key, members] of this.instances) {
      if (members.size === 0) continue;
      const list = this.membersOf(key);
      for (const viewer of list) {
        if (!viewer.state) continue;
        // A phone on a bad line: let its socket drain instead of piling more positions on it.
        // What it misses is sent next tick, because `seen` is only updated when a batch goes out.
        if (viewer.ws.bufferedAmount > SLOW_SOCKET_BYTES) {
          this.counts.dropped++;
          continue;
        }
        const packets: string[] = [];
        for (const other of list) {
          if (other === viewer || !other.state) continue;
          const distance = Math.hypot(other.state.position.x - viewer.state.position.x, other.state.position.z - viewer.state.position.z);
          const inSight = (other.state.place ?? '') === (viewer.state.place ?? '') && distance <= INTEREST;
          const sent = viewer.seen.get(other.account.id);
          if (inSight) {
            // Far players are sent less often; what is skipped goes out on a later tick
            const tooSoon = sent !== undefined && distance > NEAR_FULL_RATE && now - (viewer.sentAt.get(other.account.id) ?? 0) < FAR_EVERY_MS;
            if ((sent === undefined || other.changed > sent) && !tooSoon) {
              viewer.sentAt.set(other.account.id, now);
              // The look goes to someone seeing this player for the first time or after it changed;
              // otherwise a game that understands it is sent only where they are and what they are doing
              const needsLook = !viewer.lean || sent === undefined || other.lookChanged > (viewer.lookSeen.get(other.account.id) ?? -1);
              packets.push(needsLook ? other.fullPacket : other.leanPacket);
              if (needsLook) viewer.lookSeen.set(other.account.id, other.lookChanged);
              viewer.seen.set(other.account.id, other.changed);
            }
          } else if (sent !== undefined) {
            viewer.seen.delete(other.account.id);
            viewer.lookSeen.delete(other.account.id);
            viewer.sentAt.delete(other.account.id);
            packets.push(`{"type":"leave","id":${JSON.stringify(other.account.id)}}`);
          }
        }
        if (packets.length) this.sendText(viewer, `{"type":"batch","packets":[${packets.join(',')}]}`);
      }
    }
  }
}
