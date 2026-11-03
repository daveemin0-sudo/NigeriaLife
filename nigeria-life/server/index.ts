/**
 * One Nigeria Life game-server process.
 *
 * Players (and load-test bots) speak JSON over a WebSocket. The process simulates
 * at a fixed tick, tells each admitted player about nearby players, and keeps a
 * FIFO join queue once the admitted population reaches SAFE_PLAYER_LIMIT.
 *
 *   GET  /health
 *   GET  /metrics
 *   POST /metrics/reset
 */
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { WebSocketServer, WebSocket, type RawData } from 'ws';
import type {
  ChatWire,
  ClientMessage,
  NearbyWire,
  ServerMessage,
  ServerMetrics,
  ShiftWire,
  WireCharacter,
} from '../src/multiplayer/serverProtocol.ts';
import { getServerJob } from './jobs.ts';

const PORT = Number(process.env.PORT || 8787);
const TICK_MS = Number(process.env.TICK_MS || 50);
const BROADCAST_EVERY = Number(process.env.BROADCAST_EVERY || 4);
const SAFE_LIMIT = Math.max(1, Number(process.env.SAFE_PLAYER_LIMIT || 2000));
const CELL = 32;
const RADIUS = 36;
const RADIUS_SQ = RADIUS * RADIUS;
const MAX_NEARBY = 32;
const INBOUND_CAP = 32;
const OUTBOUND_HIGH_WATER = 256 * 1024;
const WORLD_BOUND = 4000;

const EMOTES = new Set([
  'idle', 'walk', 'run', 'zanku', 'groove', 'dance', 'salute', 'talk', 'phone_call',
]);

interface ShiftState {
  jobId: string;
  startedAt: number;
  durationMs: number;
}

interface Player {
  id: string;
  name: string;
  config: WireCharacter;
  ws: WebSocket;
  x: number;
  y: number;
  z: number;
  ry: number;
  mv: boolean;
  em: string;
  shift: ShiftState | null;
  inbound: ClientMessage[];
  introduced: Set<string>;
  chats: ChatWire[];
  shifts: ShiftWire[];
}

interface Waiting {
  ws: WebSocket;
  name: string;
  config: WireCharacter;
  position: number;
}

const players = new Map<string, Player>();
const bySocket = new Map<WebSocket, Player>();
const queue: Waiting[] = [];
const waitingSockets = new Set<WebSocket>();

let nextId = 1;
let tickIndex = 0;
let droppedInbound = 0;
let droppedOutbound = 0;
let messagesIn = 0;
let messagesOut = 0;
let chatsRelayed = 0;
let shiftsStarted = 0;
let shiftsCompleted = 0;
const tickSamples: number[] = [];
let cpuMark = process.cpuUsage();
let cpuTime = process.hrtime.bigint();
const startedAt = Date.now();

function send(ws: WebSocket, message: ServerMessage, droppable: boolean): boolean {
  if (ws.readyState !== WebSocket.OPEN) return false;
  if (droppable && ws.bufferedAmount > OUTBOUND_HIGH_WATER) {
    droppedOutbound += 1;
    return false;
  }
  ws.send(JSON.stringify(message));
  messagesOut += 1;
  return true;
}

function sanitizeName(input: unknown): string {
  const raw = typeof input === 'string' ? input : '';
  const cleaned = raw.replace(/[\u0000-\u001f]/g, '').trim().slice(0, 24);
  return cleaned || 'Player';
}

function sanitizeConfig(input: unknown, name: string): WireCharacter {
  const src = input && typeof input === 'object' ? input as Record<string, unknown> : {};
  return {
    name,
    gender: src.gender === 'female' ? 'female' : 'male',
    skinTone: typeof src.skinTone === 'string' ? src.skinTone.slice(0, 16) : '#4a2e1d',
    attire: typeof src.attire === 'string' ? src.attire.slice(0, 32) : 'engineer_vest',
    headwear: typeof src.headwear === 'string' ? src.headwear.slice(0, 32) : 'hardhat',
    hasShades: src.hasShades === true,
    hasGoldChain: src.hasGoldChain === true,
    trousersColor: typeof src.trousersColor === 'string' ? src.trousersColor.slice(0, 16) : '#f97316',
  };
}

function parseMessage(data: RawData): ClientMessage | null {
  let text: string;
  if (typeof data === 'string') text = data;
  else if (Buffer.isBuffer(data)) text = data.toString('utf8');
  else if (Array.isArray(data)) text = Buffer.concat(data).toString('utf8');
  else text = Buffer.from(data).toString('utf8');
  if (text.length > 8192) return null;
  try {
    const value = JSON.parse(text) as ClientMessage;
    if (!value || typeof value !== 'object' || typeof (value as { type?: unknown }).type !== 'string') return null;
    return value;
  } catch {
    return null;
  }
}

function finite(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function population(): number {
  return players.size;
}

function publishQueuePositions(): void {
  for (let i = 0; i < queue.length; i++) {
    const entry = queue[i]!;
    const position = i + 1;
    if (entry.position === position) continue;
    entry.position = position;
    send(entry.ws, { type: 'queue_update', position, limit: SAFE_LIMIT }, false);
  }
}

function admit(entry: Waiting): void {
  const id = `p${nextId++}`;
  const player: Player = {
    id,
    name: entry.name,
    config: { ...entry.config, name: entry.name },
    ws: entry.ws,
    x: 0,
    y: 0,
    z: 0,
    ry: 0,
    mv: false,
    em: 'idle',
    shift: null,
    inbound: [],
    introduced: new Set(),
    chats: [],
    shifts: [],
  };
  players.set(id, player);
  bySocket.set(entry.ws, player);
  send(entry.ws, { type: 'welcome', id, limit: SAFE_LIMIT, population: population() }, false);
}

function tryAdmit(): void {
  while (players.size < SAFE_LIMIT && queue.length > 0) {
    const next = queue.shift()!;
    waitingSockets.delete(next.ws);
    if (next.ws.readyState !== WebSocket.OPEN) continue;
    admit(next);
  }
  publishQueuePositions();
}

function enqueue(ws: WebSocket, name: string, config: WireCharacter): void {
  const entry: Waiting = { ws, name, config, position: queue.length + 1 };
  queue.push(entry);
  waitingSockets.add(ws);
  send(ws, { type: 'queued', position: entry.position, limit: SAFE_LIMIT }, false);
}

function handleHello(ws: WebSocket, message: ClientMessage): void {
  if (message.type !== 'hello') return;
  if (bySocket.has(ws) || waitingSockets.has(ws)) return;
  const name = sanitizeName(message.name);
  const config = sanitizeConfig(message.config, name);
  if (players.size >= SAFE_LIMIT) enqueue(ws, name, config);
  else admit({ ws, name, config, position: 0 });
}

function applyMessage(player: Player, message: ClientMessage): void {
  if (message.type === 'state') {
    const x = finite(message.x);
    const y = finite(message.y);
    const z = finite(message.z);
    const ry = finite(message.ry);
    if (x === null || y === null || z === null || ry === null) {
      droppedInbound += 1;
      return;
    }
    player.x = clamp(x, -WORLD_BOUND, WORLD_BOUND);
    player.y = clamp(y, -20, 200);
    player.z = clamp(z, -WORLD_BOUND, WORLD_BOUND);
    player.ry = ry;
    player.mv = message.mv === true;
    player.em = typeof message.em === 'string' && EMOTES.has(message.em) ? message.em : 'idle';
    return;
  }

  if (message.type === 'chat') {
    if (typeof message.text !== 'string') {
      droppedInbound += 1;
      return;
    }
    const text = message.text.replace(/[\u0000-\u001f]/g, '').trim().slice(0, 140);
    if (!text) return;
    if (player.chats.length >= 3) {
      droppedInbound += 1;
      return;
    }
    player.chats.push({
      id: `c${Date.now().toString(36)}${player.chats.length}`,
      senderId: player.id,
      senderName: player.name,
      text,
      timestamp: new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Lagos' }),
    });
    chatsRelayed += 1;
    return;
  }

  if (message.type === 'shift') {
    const jobId = typeof message.jobId === 'string' ? message.jobId : '';
    if (message.action === 'start') {
      const job = getServerJob(jobId);
      if (!job) {
        send(player.ws, { type: 'shift_result', ok: false, action: 'start', jobId, message: 'Unknown job.' }, false);
        return;
      }
      if (player.shift) {
        send(player.ws, { type: 'shift_result', ok: false, action: 'start', jobId, message: 'Shift already in progress.' }, false);
        return;
      }
      player.shift = { jobId: job.id, startedAt: Date.now(), durationMs: job.shiftDuration * 1000 };
      player.shifts.push({ playerId: player.id, name: player.name, jobId: job.id, action: 'start' });
      shiftsStarted += 1;
      send(player.ws, { type: 'shift_result', ok: true, action: 'start', jobId: job.id, message: `Shift started: ${job.title}` }, false);
      return;
    }
    if (message.action === 'complete') {
      if (!player.shift || player.shift.jobId !== jobId) {
        send(player.ws, { type: 'shift_result', ok: false, action: 'complete', jobId, message: 'No active shift for that job.' }, false);
        return;
      }
      if (Date.now() - player.shift.startedAt < player.shift.durationMs) {
        send(player.ws, { type: 'shift_result', ok: false, action: 'complete', jobId, message: 'Shift still ongoing.' }, false);
        return;
      }
      player.shift = null;
      player.shifts.push({ playerId: player.id, name: player.name, jobId, action: 'complete' });
      shiftsCompleted += 1;
      send(player.ws, { type: 'shift_result', ok: true, action: 'complete', jobId, message: 'Shift completed.' }, false);
    }
  }
}

function removePlayer(ws: WebSocket): void {
  const queuedAt = queue.findIndex((entry) => entry.ws === ws);
  if (queuedAt >= 0) {
    queue.splice(queuedAt, 1);
    waitingSockets.delete(ws);
    publishQueuePositions();
    return;
  }
  const player = bySocket.get(ws);
  if (!player) return;
  bySocket.delete(ws);
  players.delete(player.id);
  tryAdmit();
}

function cellKey(x: number, z: number): string {
  return `${Math.floor(x / CELL)},${Math.floor(z / CELL)}`;
}

function broadcast(): void {
  const grid = new Map<string, Player[]>();
  for (const player of players.values()) {
    const key = cellKey(player.x, player.z);
    const cell = grid.get(key);
    if (cell) cell.push(player);
    else grid.set(key, [player]);
  }

  const round1 = (value: number) => Math.round(value * 10) / 10;
  const pop = population();

  for (const player of players.values()) {
    const cx = Math.floor(player.x / CELL);
    const cz = Math.floor(player.z / CELL);
    const nearby: NearbyWire[] = [];
    const chats: ChatWire[] = [];
    const shifts: ShiftWire[] = [];
    const fresh: string[] = [];

    for (let dx = -1; dx <= 1 && nearby.length < MAX_NEARBY; dx++) {
      for (let dz = -1; dz <= 1 && nearby.length < MAX_NEARBY; dz++) {
        const cell = grid.get(`${cx + dx},${cz + dz}`);
        if (!cell) continue;
        for (const other of cell) {
          if (other === player) continue;
          const ox = other.x - player.x;
          const oz = other.z - player.z;
          if (ox * ox + oz * oz > RADIUS_SQ) continue;
          const wire: NearbyWire = {
            id: other.id,
            x: round1(other.x),
            y: round1(other.y),
            z: round1(other.z),
            ry: round1(other.ry),
            mv: other.mv,
            em: other.em,
          };
          if (!player.introduced.has(other.id)) {
            wire.name = other.name;
            wire.config = other.config;
            fresh.push(other.id);
          }
          nearby.push(wire);
          if (other.chats.length > 0) chats.push(...other.chats);
          if (other.shifts.length > 0) shifts.push(...other.shifts);
          if (nearby.length >= MAX_NEARBY) break;
        }
      }
    }

    const sent = send(player.ws, { type: 'world', tick: tickIndex, population: pop, nearby, chats, shifts }, true);
    if (sent) {
      for (const id of fresh) player.introduced.add(id);
    }
  }

  for (const player of players.values()) {
    player.chats.length = 0;
    player.shifts.length = 0;
  }
}

function tick(): void {
  tickIndex += 1;
  for (const player of players.values()) {
    if (player.inbound.length === 0) continue;
    const batch = player.inbound;
    player.inbound = [];
    for (const message of batch) applyMessage(player, message);
  }
  if (tickIndex % BROADCAST_EVERY === 0) broadcast();
}

function noteTick(elapsedMs: number): void {
  tickSamples.push(elapsedMs);
  if (tickSamples.length > 4096) tickSamples.splice(0, tickSamples.length - 4096);
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));
  return sorted[index] ?? 0;
}

function metrics(): ServerMetrics {
  const cpu = process.cpuUsage(cpuMark);
  const elapsedUs = Number(process.hrtime.bigint() - cpuTime) / 1000;
  const cpuPercentOneCore = elapsedUs > 0 ? ((cpu.user + cpu.system) / elapsedUs) * 100 : 0;
  const memory = process.memoryUsage();
  const sorted = [...tickSamples].sort((a, b) => a - b);
  const sum = tickSamples.reduce((total, sample) => total + sample, 0);
  return {
    players: population(),
    queued: queue.length,
    safeLimit: SAFE_LIMIT,
    tick: {
      avgMs: tickSamples.length ? sum / tickSamples.length : 0,
      p95Ms: percentile(sorted, 95),
      maxMs: sorted.length ? sorted[sorted.length - 1]! : 0,
      samples: tickSamples.length,
    },
    droppedMessages: droppedInbound + droppedOutbound,
    droppedInbound,
    droppedOutbound,
    messagesIn,
    messagesOut,
    chats: chatsRelayed,
    shiftsStarted,
    shiftsCompleted,
    cpuPercentOneCore,
    rssMb: memory.rss / (1024 * 1024),
    heapUsedMb: memory.heapUsed / (1024 * 1024),
    uptimeSec: (Date.now() - startedAt) / 1000,
    config: {
      tickMs: TICK_MS,
      broadcastHz: 1000 / (TICK_MS * BROADCAST_EVERY),
      interestRadius: RADIUS,
      maxNearby: MAX_NEARBY,
    },
  };
}

function resetMetrics(): void {
  droppedInbound = 0;
  droppedOutbound = 0;
  messagesIn = 0;
  messagesOut = 0;
  chatsRelayed = 0;
  shiftsStarted = 0;
  shiftsCompleted = 0;
  tickSamples.length = 0;
  cpuMark = process.cpuUsage();
  cpuTime = process.hrtime.bigint();
}

function readBody(req: IncomingMessage): Promise<void> {
  return new Promise((resolve) => {
    req.on('data', () => undefined);
    req.on('end', () => resolve());
    req.on('error', () => resolve());
  });
}

function writeJson(res: ServerResponse, status: number, body: unknown): void {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'content-length': Buffer.byteLength(payload),
  });
  res.end(payload);
}

function arm(): void {
  const start = performance.now();
  try {
    tick();
  } catch (error) {
    console.error('[game-server] tick failed', error);
  }
  const elapsed = performance.now() - start;
  noteTick(elapsed);
  setTimeout(arm, Math.max(0, TICK_MS - elapsed));
}

const httpServer = createServer(async (req, res) => {
  const url = req.url?.split('?')[0] ?? '/';
  if (req.method === 'GET' && url === '/health') {
    writeJson(res, 200, { ok: true, players: population(), queued: queue.length, safeLimit: SAFE_LIMIT });
    return;
  }
  if (req.method === 'GET' && url === '/metrics') {
    writeJson(res, 200, metrics());
    return;
  }
  if (req.method === 'POST' && url === '/metrics/reset') {
    await readBody(req);
    resetMetrics();
    writeJson(res, 200, { ok: true });
    return;
  }
  writeJson(res, 404, { ok: false });
});

const sockets = new WebSocketServer({ server: httpServer, maxPayload: 8192 });

sockets.on('connection', (ws) => {
  ws.on('message', (data, isBinary) => {
    messagesIn += 1;
    if (isBinary) {
      droppedInbound += 1;
      return;
    }
    const message = parseMessage(data);
    if (!message) {
      droppedInbound += 1;
      return;
    }
    const player = bySocket.get(ws);
    if (!player) {
      if (message.type === 'hello') handleHello(ws, message);
      else droppedInbound += 1;
      return;
    }
    if (player.inbound.length >= INBOUND_CAP) {
      droppedInbound += 1;
      return;
    }
    player.inbound.push(message);
  });

  ws.on('close', () => removePlayer(ws));
  ws.on('error', () => {
    /* close follows */
  });
});

httpServer.listen(PORT, () => {
  console.log(`[game-server] listening on :${PORT} safeLimit=${SAFE_LIMIT} tick=${TICK_MS}ms`);
});

arm();

function shutdown(signal: string): void {
  console.log(`[game-server] ${signal}, closing`);
  for (const ws of bySocket.keys()) ws.close();
  for (const entry of queue) entry.ws.close();
  sockets.close();
  httpServer.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 1500).unref();
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
