/**
 * Load test for ONE game-server process (server/game-server.ts), the same code players use.
 *
 *   npm run loadtest                      ramp 100, 500, 1000, 1500, 2000 players
 *   npm run loadtest -- 200 400           your own steps
 *   LOADTEST_HZ=20 npm run loadtest       how often each bot sends where it is (the game sends 10-20)
 *   LOADTEST_CROWD=1 npm run loadtest     everyone in one square, as at a concert (worst case)
 *
 * It starts its own server on a spare port with an empty database and the join limit lifted,
 * signs in one guest per bot, and connects them over WebSocket. Each bot:
 *   - walks around its neighbourhood, sending its position LOADTEST_HZ times a second, with a
 *     look (config) the size of a real player's, so packets are the real size
 *   - says something in city chat about every 20 seconds
 *   - one in ten works shifts at the Apapa loading bay, through the server's real
 *     hire / start / finish checks
 *
 * Each step holds for HOLD seconds once every bot is in, then reads /admin/metrics. The bots run
 * in this process, so on a small machine they compete with the server for the CPU: read the
 * server's own CPU column, not the machine's.
 *
 * A step is healthy when the server's average tick is under half its budget (100 ms), its p95
 * tick is under the budget, nothing was dropped for a slow socket, and the server's CPU is
 * under 70% of one core (Node runs the rooms on one core). Results go to docs/LOADTEST.md.
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocket } from 'ws';

const here = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.LOADTEST_PORT || 8899);
const BASE = `http://127.0.0.1:${PORT}`;
const ADMIN = 'loadtest-admin';
const HZ = Number(process.env.LOADTEST_HZ || 10);
const HOLD_S = Number(process.env.LOADTEST_HOLD || 20);
const CROWD = process.env.LOADTEST_CROWD === '1';
const STEPS = process.argv.slice(2).map(Number).filter((n) => n > 0);
const RAMP = STEPS.length ? STEPS : [100, 500, 1000, 1500, 2000];
/** The Apapa loading bay, where shifts are checked (src/jobs/employers.ts WORKSITES) */
const PORT_SITE = { x: -73, z: 55.5 };

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

const LOOK = {
  gender: 'male', skinTone: '#6b4226', hairStyle: 'low-cut', hairColor: '#1a1a1a', beard: 'short',
  top: 'ankara-shirt', topColor: '#d4a017', topPattern: 'ankara-1', bottom: 'chinos', bottomColor: '#2b2b2b',
  shoes: 'sneakers', shoeColor: '#ffffff', cap: 'none', glasses: 'none', accessory: 'wristwatch',
  height: 1.0, build: 'average', faceShape: 'oval', eyeColor: '#3b2414',
};

async function call(pathname: string, body?: unknown, token?: string): Promise<any> {
  const headers: Record<string, string> = { 'content-type': 'application/json', 'x-nl-admin': ADMIN };
  if (token) headers.authorization = `Bearer ${token}`;
  const r = await fetch(BASE + pathname, { method: body ? 'POST' : 'GET', headers, body: body ? JSON.stringify(body) : undefined });
  return { status: r.status, ...(await r.json()) };
}

interface Bot {
  n: number;
  token: string;
  ws: WebSocket;
  cx: number;
  cz: number;
  angle: number;
  worker: boolean;
  shift: string | null;
  shiftAt: number;
  received: number;
  queued: boolean;
}

const stats = { chats: 0, shiftsStarted: 0, shiftsPaid: 0, shiftErrors: 0, received: 0 };

/** Where bot n lives: clusters of about 40, as players gather in spots, spread over the island */
function home(n: number): { x: number; z: number } {
  if (CROWD) return { x: (n % 20) * 2 - 20, z: Math.floor(n / 20) % 20 * 2 - 20 };
  const cluster = Math.floor(n / 40);
  if (cluster === 0) return { x: PORT_SITE.x, z: PORT_SITE.z };
  const ring = Math.ceil(Math.sqrt(cluster));
  return { x: ((cluster % ring) - ring / 2) * 300 + ((n * 7) % 30) - 15, z: (Math.floor(cluster / ring) - ring / 2) * 300 + ((n * 13) % 30) - 15 };
}

async function makeBot(n: number): Promise<Bot> {
  const guest = await call('/auth/guest', { name: `Bot ${n}` });
  if (!guest.ok) throw new Error(`guest ${n}: ${guest.reason}`);
  const h = home(n);
  const worker = n % 10 === 0;
  const bot: Bot = { n, token: guest.token, ws: null as unknown as WebSocket, cx: worker ? PORT_SITE.x : h.x, cz: worker ? PORT_SITE.z : h.z, angle: (n * 0.7) % (Math.PI * 2), worker, shift: null, shiftAt: 0, received: 0, queued: false };
  await new Promise<void>((resolve, reject) => {
    const ws = new WebSocket(`ws://127.0.0.1:${PORT}/play?token=${encodeURIComponent(bot.token)}&proto=2`);
    bot.ws = ws;
    ws.on('message', (raw) => {
      bot.received++;
      stats.received++;
      const text = String(raw);
      if (text.startsWith('{"type":"queued"')) bot.queued = true;
      else if (text.startsWith('{"type":"welcome"')) bot.queued = false;
    });
    ws.on('open', () => resolve());
    ws.on('error', reject);
  });
  if (worker) await call('/work/hire', { employer: 'apapa-port' }, bot.token);
  return bot;
}

function step(bot: Bot, t: number): void {
  if (bot.ws.readyState !== bot.ws.OPEN) return;
  // Workers stand at the bay; everyone else walks a slow circle in their neighbourhood
  const r = bot.worker ? 3 : 12;
  bot.angle += 0.15 / HZ * 10;
  const x = bot.cx + Math.cos(bot.angle) * r;
  const z = bot.cz + Math.sin(bot.angle) * r;
  bot.ws.send(JSON.stringify({ type: 'state', player: { id: 'x', name: 'x', position: { x, y: 0, z }, rotationY: bot.angle, isMoving: true, currentEmote: 'idle', config: LOOK, city: 'lagos', streetCred: 10 } }));
  if (Math.random() < 1 / (20 * HZ)) {
    stats.chats++;
    bot.ws.send(JSON.stringify({ type: 'chat', message: { id: `${bot.n}:${t}`, text: 'How far, who dey Broad Street?', scope: 'city' } }));
  }
}

async function work(bot: Bot): Promise<void> {
  if (!bot.worker || bot.ws.readyState !== bot.ws.OPEN) return;
  const now = Date.now();
  if (!bot.shift) {
    if (now < bot.shiftAt) return;
    const s = await call('/work/start', { employer: 'apapa-port' }, bot.token);
    if (s.ok) {
      bot.shift = s.shift;
      bot.shiftAt = now + 13_000;
      stats.shiftsStarted++;
    } else {
      stats.shiftErrors++;
      bot.shiftAt = now + 5_000;
    }
  } else if (now >= bot.shiftAt) {
    const f = await call('/work/finish', { shift: bot.shift, idem: `lt:${bot.n}:${bot.shift}`, stars: 3 }, bot.token);
    if (f.ok) stats.shiftsPaid++;
    else stats.shiftErrors++;
    bot.shift = null;
    bot.shiftAt = now + 2_000;
  }
}

async function main(): Promise<void> {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nl-loadtest-'));
  const server = spawn(process.execPath, [path.join(here, 'game-server.ts')], {
    env: { ...process.env, PORT: String(PORT), NL_DATA: dataDir, NL_DEV: '1', NL_ADMIN_KEY: ADMIN, NL_MAX_PLAYERS: '1000000', NL_GUESTS_PER_HOUR: '1000000', NL_STATIC: path.join(dataDir, 'none') },
    stdio: ['ignore', 'ignore', 'inherit'],
  });
  const bots: Bot[] = [];
  let ticking: NodeJS.Timeout | null = null;
  const rows: string[] = [];
  try {
    for (let i = 0; i < 100; i++) {
      try {
        if ((await fetch(`${BASE}/health`)).ok) break;
      } catch {}
      await wait(200);
    }
    let t = 0;
    ticking = setInterval(() => {
      t++;
      for (const b of bots) step(b, t);
      if (t % HZ === 0) for (const b of bots) void work(b).catch(() => stats.shiftErrors++);
    }, 1000 / HZ);

    for (const target of RAMP) {
      while (bots.length < target) {
        const batch = Math.min(50, target - bots.length);
        const made = await Promise.all(Array.from({ length: batch }, (_, i) => makeBot(bots.length + i)));
        bots.push(...made);
      }
      await wait(3000);
      const before = await call('/admin/metrics/reset', {});
      const s0 = { ...stats };
      const t0 = Date.now();
      await wait(HOLD_S * 1000);
      const m = await call('/admin/metrics');
      const secs = (Date.now() - t0) / 1000;
      const cpuUs = m.cpu.user + m.cpu.system - (before.cpu.user + before.cpu.system);
      const cpuPct = (cpuUs / 1e6 / secs) * 100;
      const r = m.rooms;
      const healthy = r.tick.avgMs <= r.tick.budgetMs / 2 && r.tick.p95Ms <= r.tick.budgetMs && r.dropped === 0 && cpuPct < 70;
      const row = [
        target, cpuPct.toFixed(1), m.memoryMb.rss, m.memoryMb.heap, r.tick.avgMs, r.tick.p95Ms, r.tick.maxMs, r.dropped,
        Math.round(r.messagesIn / secs), Math.round(r.messagesOut / secs), (r.bytesOut / secs / 1048576).toFixed(2), (r.wireBytesOut / secs / 1024 / target).toFixed(1),
        stats.chats - s0.chats, stats.shiftsStarted - s0.shiftsStarted, stats.shiftsPaid - s0.shiftsPaid, stats.shiftErrors - s0.shiftErrors,
        healthy ? 'yes' : '**no**',
      ];
      rows.push(`| ${row.join(' | ')} |`);
      console.log(`${target} players: server CPU ${cpuPct.toFixed(1)}%, tick avg ${r.tick.avgMs} ms / p95 ${r.tick.p95Ms} ms / max ${r.tick.maxMs} ms, out ${(r.bytesOut / secs / 1048576).toFixed(2)} MB/s, wire ${(r.wireBytesOut / secs / 1024 / target).toFixed(1)} KB/s each, dropped ${r.dropped}, healthy ${healthy}`);
    }
  } finally {
    if (ticking) clearInterval(ticking);
    for (const b of bots) b.ws?.close();
    server.kill('SIGTERM');
  }
  console.log('\n| Players | Server CPU % of one core | RSS MB | Heap MB | Tick avg ms | Tick p95 ms | Tick max ms | Dropped | Msgs in/s | Msgs out/s | MB out/s | Wire KB/s per player | Chats | Shifts started | Shifts paid | Shift errors | Healthy |');
  console.log('| ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | :---: |');
  for (const r of rows) console.log(r);
  console.log(`\n${os.cpus().length} cores, ${os.cpus()[0]?.model}, ${(os.totalmem() / 1073741824).toFixed(1)} GB; ${HZ} Hz positions; ${CROWD ? 'everyone in one square' : 'clusters of 40'}; hold ${HOLD_S} s per step`);
  process.exit(0);
}

void main().catch((e) => {
  console.error(e);
  process.exit(1);
});
