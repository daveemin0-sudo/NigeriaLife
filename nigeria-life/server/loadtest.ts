/**
 * Ramps fake players against one game-server process and writes docs/LOADTEST.md.
 *
 *   npm run loadtest
 *   STEPS=100,500 HOLD_MS=8000 npm run loadtest
 *
 * Each bot walks a small circle with its neighbours, chats, and works a shop
 * shift. The server process is spawned by this script and killed at the end.
 */
import { spawn, type ChildProcess } from 'node:child_process';
import { once } from 'node:events';
import { writeFileSync } from 'node:fs';
import { cpus, totalmem } from 'node:os';
import { fileURLToPath } from 'node:url';
import { WebSocket, type RawData } from 'ws';
import type { ServerMessage, ServerMetrics } from '../src/multiplayer/serverProtocol.ts';

const PORT = Number(process.env.LOADTEST_PORT || 8791);
const HOLD_MS = Number(process.env.HOLD_MS || 12000);
const STEPS = (process.env.STEPS || '100,500,1000,2000')
  .split(',')
  .map((part) => Number(part.trim()))
  .filter((value) => Number.isFinite(value) && value > 0);
const TICK_BUDGET_MS = Number(process.env.TICK_MS || 50);
const CLUSTER = 36;

const root = fileURLToPath(new URL('..', import.meta.url));
const serverScript = fileURLToPath(new URL('./index.ts', import.meta.url));
const docPath = fileURLToPath(new URL('../docs/LOADTEST.md', import.meta.url));

const CHAT_LINES = [
  'How far?',
  'Wetin dey sup?',
  'I dey on shift',
  'Abeg shift small',
  'Lagos traffic no be here o',
  'Oya make we hustle',
];

interface Bot {
  index: number;
  ws: WebSocket;
  admitted: boolean;
  cx: number;
  cz: number;
  angle: number;
  orbit: number;
  working: boolean;
  shiftEnds: number;
  nextShiftAt: number;
  rx: number;
}

interface StepRow {
  players: number;
  ok: boolean;
  note: string;
  cpu: number;
  rssMb: number;
  heapMb: number;
  avgMs: number;
  p95Ms: number;
  maxMs: number;
  dropped: number;
  droppedIn: number;
  droppedOut: number;
  messagesIn: number;
  messagesOut: number;
  chats: number;
  shiftsStarted: number;
  shiftsCompleted: number;
  rxPerBot: number;
  config: ServerMetrics['config'] | null;
}

const bots: Bot[] = [];

function place(index: number): { cx: number; cz: number; angle: number; orbit: number } {
  const cluster = Math.floor(index / CLUSTER);
  const slot = index % CLUSTER;
  return {
    cx: (cluster % 10) * 200,
    cz: Math.floor(cluster / 10) * 200,
    angle: (slot / CLUSTER) * Math.PI * 2,
    orbit: 6 + (slot % 6) * 2,
  };
}

function send(bot: Bot, payload: unknown): void {
  if (bot.ws.readyState !== WebSocket.OPEN) return;
  bot.ws.send(JSON.stringify(payload));
}

function rawText(data: RawData): string {
  if (typeof data === 'string') return data;
  if (Buffer.isBuffer(data)) return data.toString('utf8');
  if (Array.isArray(data)) return Buffer.concat(data).toString('utf8');
  return Buffer.from(data).toString('utf8');
}

function byteLength(data: RawData): number {
  if (typeof data === 'string') return data.length;
  if (Buffer.isBuffer(data)) return data.length;
  if (Array.isArray(data)) return data.reduce((total, chunk) => total + chunk.length, 0);
  return data.byteLength;
}

function onBotMessage(bot: Bot, data: RawData): void {
  bot.rx += 1;
  if (byteLength(data) > 500) return;
  const text = rawText(data);
  let message: ServerMessage;
  try {
    message = JSON.parse(text) as ServerMessage;
  } catch {
    return;
  }
  if (message.type === 'welcome') {
    bot.admitted = true;
    return;
  }
  if (message.type === 'shift_result' && message.ok && message.action === 'start') {
    bot.working = true;
    bot.shiftEnds = Date.now() + 11000;
    return;
  }
  if (message.type === 'shift_result' && message.ok && message.action === 'complete') {
    bot.working = false;
    bot.nextShiftAt = Date.now() + 1500 + (bot.index % 8) * 100;
  }
}

function connectBot(index: number): Promise<void> {
  const spot = place(index);
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`ws://127.0.0.1:${PORT}`);
    const bot: Bot = {
      index,
      ws,
      admitted: false,
      cx: spot.cx,
      cz: spot.cz,
      angle: spot.angle,
      orbit: spot.orbit,
      working: false,
      shiftEnds: 0,
      nextShiftAt: Date.now() + (index % 40) * 250,
      rx: 0,
    };
    const timer = setTimeout(() => reject(new Error(`bot ${index} connect timeout`)), 8000);
    ws.on('message', (data) => onBotMessage(bot, data));
    ws.on('open', () => {
      clearTimeout(timer);
      const name = `Bot ${index}`;
      send(bot, {
        type: 'hello',
        name,
        config: {
          name,
          gender: index % 2 === 0 ? 'male' : 'female',
          skinTone: '#4a2e1d',
          attire: 'engineer_vest',
          headwear: 'hardhat',
          hasShades: false,
          hasGoldChain: index % 3 === 0,
          trousersColor: '#f97316',
        },
      });
      bots.push(bot);
      resolve();
    });
    ws.on('error', (error) => {
      clearTimeout(timer);
      reject(error);
    });
  });
}

let botClock = 0;

function stepBots(): void {
  botClock += 1;
  const now = Date.now();
  for (const bot of bots) {
    if (!bot.admitted || bot.ws.readyState !== WebSocket.OPEN) continue;
    bot.angle += 0.18;
    const x = Math.round((bot.cx + Math.cos(bot.angle) * bot.orbit) * 10) / 10;
    const z = Math.round((bot.cz + Math.sin(bot.angle) * bot.orbit) * 10) / 10;
    send(bot, { type: 'state', x, y: 0, z, ry: Math.round(bot.angle * 100) / 100, mv: true, em: 'walk' });
    if ((botClock + bot.index) % 25 === 0) {
      send(bot, { type: 'chat', text: CHAT_LINES[bot.index % CHAT_LINES.length] });
    }
    if (!bot.working && now >= bot.nextShiftAt) {
      send(bot, { type: 'shift', action: 'start', jobId: 'job_shop_assistant' });
      bot.nextShiftAt = now + 2000;
    } else if (bot.working && now >= bot.shiftEnds) {
      send(bot, { type: 'shift', action: 'complete', jobId: 'job_shop_assistant' });
      bot.shiftEnds = now + 1000;
    }
  }
}

async function connectUntil(target: number): Promise<void> {
  const batch = 50;
  while (bots.length < target) {
    const count = Math.min(batch, target - bots.length);
    const start = bots.length;
    await Promise.all(Array.from({ length: count }, (_, offset) => connectBot(start + offset)));
  }
  const deadline = Date.now() + 15000;
  while (Date.now() < deadline) {
    if (bots.filter((bot) => bot.admitted).length >= target) return;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  const admitted = bots.filter((bot) => bot.admitted).length;
  throw new Error(`only ${admitted} of ${target} bots were admitted`);
}

async function waitForHealth(child: ChildProcess): Promise<void> {
  const deadline = Date.now() + 8000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error('game server exited before the load test started');
    try {
      const response = await fetch(`http://127.0.0.1:${PORT}/health`);
      if (response.ok) return;
    } catch {
      /* starting */
    }
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error('game server did not open /health');
}

async function resetMetrics(): Promise<void> {
  const response = await fetch(`http://127.0.0.1:${PORT}/metrics/reset`, { method: 'POST' });
  if (!response.ok) throw new Error('metrics reset failed');
}

async function readMetrics(): Promise<ServerMetrics> {
  const response = await fetch(`http://127.0.0.1:${PORT}/metrics`);
  if (!response.ok) throw new Error('metrics read failed');
  return await response.json() as ServerMetrics;
}

function round(value: number, digits = 2): string {
  if (!Number.isFinite(value)) return '—';
  return value.toFixed(digits);
}

function healthy(row: StepRow): boolean {
  if (!row.ok) return false;
  const dropRate = row.dropped / Math.max(1, row.messagesIn);
  return row.avgMs <= TICK_BUDGET_MS * 0.5
    && row.p95Ms <= TICK_BUDGET_MS
    && dropRate < 0.001
    && row.shiftsStarted + row.shiftsCompleted > 0
    && row.chats > 0;
}

function recommend(rows: StepRow[]): number {
  let safe = 0;
  for (const row of rows) {
    if (!healthy(row)) break;
    safe = row.players;
  }
  return safe;
}

function renderDoc(rows: StepRow[], safe: number, started: string): string {
  const cpuModel = cpus()[0]?.model ?? 'unknown';
  const cores = cpus().length;
  const ramGb = (totalmem() / (1024 * 1024 * 1024)).toFixed(1);
  const config = rows.find((row) => row.config)?.config;
  const header = `| Players | CPU % of one core | RSS MB | Heap MB | Tick avg ms | Tick p95 ms | Tick max ms | Dropped | Drop rate | Chats | Shifts started | Shifts done | Messages in | Messages out | Rx / bot |`;
  const rule = `| ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |`;
  const body = rows.map((row) => {
    const dropRate = row.messagesIn > 0 ? (row.dropped / row.messagesIn) * 100 : 0;
    return `| ${row.players} | ${round(row.cpu, 1)} | ${round(row.rssMb, 1)} | ${round(row.heapMb, 1)} | ${round(row.avgMs)} | ${round(row.p95Ms)} | ${round(row.maxMs)} | ${row.dropped} | ${round(dropRate, 3)}% | ${row.chats} | ${row.shiftsStarted} | ${row.shiftsCompleted} | ${row.messagesIn} | ${row.messagesOut} | ${round(row.rxPerBot, 1)} |`;
  }).join('\n');
  const notes = rows.filter((row) => row.note).map((row) => `- ${row.players} players: ${row.note}`).join('\n');
  const limitText = safe > 0
    ? `The largest healthy step in this run is **${safe}** players. \`SAFE_PLAYER_LIMIT\` defaults to ${safe}, and the pm2 config uses the same number. Past that, a new player is not dropped: they see “Server busy, you are number X in line” and are admitted automatically when someone leaves.`
    : `No step stayed inside the budget. Do not raise the join cap until a re-run does. The process still queues players once it is over \`SAFE_PLAYER_LIMIT\`.`;

  return `# Game server load test

Recorded ${started} (Africa/Lagos) on this machine: ${cores} cores, ${cpuModel}, ${ramGb} GB RAM. The bots and the game server shared that machine. CPU is the game-server process only, as a percentage of one core (so 200% means two cores busy inside that process). Tick time is wall-clock time inside the server tick, so it includes time the process spent waiting on a busy core.

## What ran

\`npm run loadtest\` starts **one** game-server process and connects fake players over WebSocket. The ramp is ${STEPS.join(', ')} players. Each step holds for ${HOLD_MS / 1000} seconds after every bot has been admitted, then reads \`/metrics\`.

Each bot, five times a second:

- walks a circle inside a neighbourhood of ${CLUSTER} bots, so interest sets stay full
- sends a short chat about every 5 seconds
- starts a Trade Shop Assistant shift and completes it once the server’s 10 second shift clock allows

Server settings for the run: tick ${config?.tickMs ?? TICK_BUDGET_MS} ms, world broadcast ${config?.broadcastHz ?? 5} Hz, interest radius ${config?.interestRadius ?? 36}, at most ${config?.maxNearby ?? 32} neighbours per player. The load-test process raises the cap so the ramp can pass the production safe limit and measure it. Production keeps the cap, and players beyond it wait in the join queue.

A step is healthy when the average tick stays at or under half the tick interval (${TICK_BUDGET_MS * 0.5} ms), the p95 tick stays at or under the tick interval (${TICK_BUDGET_MS} ms), dropped messages stay under 0.1% of messages received, and the bots actually chatted and started shifts. Dropped messages are inbound frames the server refused (bad payload or a full per-player queue) plus outbound world snapshots skipped because that socket’s send buffer was over 256 KB.

## Results

${header}
${rule}
${body}

${notes ? `### Notes\n\n${notes}\n` : ''}
## Safe limit

${limitText}

## Join queue

When the admitted population is at the safe limit, the next \`hello\` gets \`{ "type": "queued", "position": 1 }\` instead of a welcome. The browser shows **Server busy, you are number 1 in line** and updates the number as the line moves. When a player disconnects, the process admits the head of the queue and that player enters without pressing anything. \`npm run test:queue\` checks the order.

## Process supervisor

[\`ecosystem.config.cjs\`](../ecosystem.config.cjs) is a pm2 app named \`nigeria-life-game-server\`. \`autorestart\` is on, so a crash starts a new process.

\`\`\`bash
npx pm2 start ecosystem.config.cjs
npx pm2 status
\`\`\`

## Run it again

\`\`\`bash
npm run loadtest
\`\`\`
`;
}

function emptyRow(players: number, note: string): StepRow {
  return {
    players,
    ok: false,
    note,
    cpu: 0,
    rssMb: 0,
    heapMb: 0,
    avgMs: 0,
    p95Ms: 0,
    maxMs: 0,
    dropped: 0,
    droppedIn: 0,
    droppedOut: 0,
    messagesIn: 0,
    messagesOut: 0,
    chats: 0,
    shiftsStarted: 0,
    shiftsCompleted: 0,
    rxPerBot: 0,
    config: null,
  };
}

const child = spawn(process.execPath, ['--experimental-strip-types', serverScript], {
  cwd: root,
  env: {
    ...process.env,
    PORT: String(PORT),
    SAFE_PLAYER_LIMIT: '100000',
    TICK_MS: String(TICK_BUDGET_MS),
  },
  stdio: ['ignore', 'pipe', 'pipe'],
});

let serverLog = '';
child.stdout?.on('data', (chunk) => {
  serverLog += String(chunk);
  if (serverLog.length > 20000) serverLog = serverLog.slice(-20000);
});
child.stderr?.on('data', (chunk) => {
  serverLog += String(chunk);
  if (serverLog.length > 20000) serverLog = serverLog.slice(-20000);
});

const rows: StepRow[] = [];

async function stopServer(): Promise<void> {
  for (const bot of bots) {
    try { bot.ws.close(); } catch { /* already closed */ }
  }
  if (child.exitCode === null) child.kill('SIGTERM');
  await Promise.race([
    once(child, 'exit'),
    new Promise((resolve) => setTimeout(resolve, 2500)),
  ]);
  if (child.exitCode === null) child.kill('SIGKILL');
}

try {
  await waitForHealth(child);
  const timer = setInterval(stepBots, 200);
  try {
    for (const step of STEPS) {
      process.stdout.write(`[loadtest] connecting ${step} bots\n`);
      try {
        await connectUntil(step);
        const rxBefore = bots.reduce((total, bot) => total + bot.rx, 0);
        await resetMetrics();
        await new Promise((resolve) => setTimeout(resolve, HOLD_MS));
        if (child.exitCode !== null) throw new Error('game server exited during the sample');
        const sample = await readMetrics();
        const rxAfter = bots.reduce((total, bot) => total + bot.rx, 0);
        const row: StepRow = {
          players: step,
          ok: true,
          note: '',
          cpu: sample.cpuPercentOneCore,
          rssMb: sample.rssMb,
          heapMb: sample.heapUsedMb,
          avgMs: sample.tick.avgMs,
          p95Ms: sample.tick.p95Ms,
          maxMs: sample.tick.maxMs,
          dropped: sample.droppedMessages,
          droppedIn: sample.droppedInbound,
          droppedOut: sample.droppedOutbound,
          messagesIn: sample.messagesIn,
          messagesOut: sample.messagesOut,
          chats: sample.chats,
          shiftsStarted: sample.shiftsStarted,
          shiftsCompleted: sample.shiftsCompleted,
          rxPerBot: bots.length ? (rxAfter - rxBefore) / bots.length : 0,
          config: sample.config,
        };
        if (!healthy(row)) {
          const dropRate = row.dropped / Math.max(1, row.messagesIn);
          row.note = `over budget (tick avg ${round(row.avgMs)} ms, p95 ${round(row.p95Ms)} ms, dropped ${round(dropRate * 100, 3)}%)`;
        }
        rows.push(row);
        process.stdout.write(`[loadtest] ${step} tick avg ${round(row.avgMs)} ms p95 ${round(row.p95Ms)} ms dropped ${row.dropped} cpu ${round(row.cpu, 1)}%\n`);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        rows.push(emptyRow(step, message + (serverLog ? ` | server: ${serverLog.trim().slice(-500)}` : '')));
        process.stdout.write(`[loadtest] ${step} failed: ${message}\n`);
        break;
      }
    }
  } finally {
    clearInterval(timer);
  }
} finally {
  const safe = recommend(rows);
  const started = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Africa/Lagos',
    dateStyle: 'full',
    timeStyle: 'short',
  }).format(new Date());
  writeFileSync(docPath, renderDoc(rows, safe, started));
  process.stdout.write(`[loadtest] wrote ${docPath} safeLimit=${safe}\n`);
  await stopServer();
}

if (rows.some((row) => !row.ok)) process.exitCode = 1;
