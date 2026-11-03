/**
 * Proves the join queue: a full process lines new players up, tells them their
 * place, and admits them in order when a spot opens. No click required.
 */
import { spawn, type ChildProcess } from 'node:child_process';
import { once } from 'node:events';
import { fileURLToPath } from 'node:url';
import { WebSocket } from 'ws';
import type { ServerMessage } from '../src/multiplayer/serverProtocol.ts';

const PORT = Number(process.env.QUEUE_PORT || 8792);
const root = fileURLToPath(new URL('..', import.meta.url));
const serverScript = fileURLToPath(new URL('./index.ts', import.meta.url));

function fail(message: string): never {
  console.error('[queuecheck] ' + message);
  process.exitCode = 1;
  throw new Error(message);
}

async function waitForHealth(child: ChildProcess): Promise<void> {
  const deadline = Date.now() + 8000;
  let stderr = '';
  child.stderr?.on('data', (chunk) => {
    stderr += String(chunk);
  });
  while (Date.now() < deadline) {
    if (child.exitCode !== null) fail(`server exited early: ${stderr}`);
    try {
      const response = await fetch(`http://127.0.0.1:${PORT}/health`);
      if (response.ok) return;
    } catch {
      /* not up yet */
    }
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  fail(`server did not become healthy. ${stderr}`);
}

function connect(name: string): Promise<{ ws: WebSocket; messages: ServerMessage[] }> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`ws://127.0.0.1:${PORT}`);
    const messages: ServerMessage[] = [];
    const timer = setTimeout(() => reject(new Error(`${name} connect timeout`)), 3000);
    ws.on('message', (data) => {
      messages.push(JSON.parse(String(data)) as ServerMessage);
    });
    ws.on('open', () => {
      clearTimeout(timer);
      ws.send(JSON.stringify({
        type: 'hello',
        name,
        config: { name, gender: 'male', skinTone: '#4a2e1d', attire: 'engineer_vest', headwear: 'hardhat', hasShades: false, hasGoldChain: false, trousersColor: '#f97316' },
      }));
      resolve({ ws, messages });
    });
    ws.on('error', (error) => {
      clearTimeout(timer);
      reject(error);
    });
  });
}

async function until(label: string, predicate: () => boolean): Promise<void> {
  const deadline = Date.now() + 3000;
  while (Date.now() < deadline) {
    if (predicate()) return;
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  fail(`timed out waiting for ${label}`);
}

const child = spawn(process.execPath, ['--experimental-strip-types', serverScript], {
  cwd: root,
  env: { ...process.env, PORT: String(PORT), SAFE_PLAYER_LIMIT: '2' },
  stdio: ['ignore', 'pipe', 'pipe'],
});

const openSockets: WebSocket[] = [];

try {
  await waitForHealth(child);
  const first = await connect('Ada');
  const second = await connect('Emeka');
  openSockets.push(first.ws, second.ws);
  await until('two welcomes', () =>
    first.messages.some((message) => message.type === 'welcome')
    && second.messages.some((message) => message.type === 'welcome'));

  const third = await connect('Bayo');
  openSockets.push(third.ws);
  await until('third queued', () => third.messages.some((message) => message.type === 'queued' && message.position === 1));
  const fourth = await connect('Chioma');
  openSockets.push(fourth.ws);
  await until('fourth queued', () => fourth.messages.some((message) => message.type === 'queued' && message.position === 2));

  const queued = third.messages.find((message) => message.type === 'queued');
  if (!queued || queued.type !== 'queued') fail('missing queue message');
  if (queued.position !== 1 || queued.limit !== 2) fail(`unexpected queue payload ${JSON.stringify(queued)}`);

  first.ws.close();
  await until('third admitted', () => third.messages.some((message) => message.type === 'welcome'));
  await until('fourth moved up', () =>
    fourth.messages.some((message) => message.type === 'queue_update' && message.position === 1));

  const welcome = third.messages.find((message) => message.type === 'welcome');
  if (!welcome || welcome.type !== 'welcome') fail('third player was not admitted');
  third.ws.send(JSON.stringify({ type: 'state', x: 4, y: 0, z: 8, ry: 1, mv: true, em: 'walk' }));
  third.ws.send(JSON.stringify({ type: 'chat', text: 'How far, I don enter' }));
  third.ws.send(JSON.stringify({ type: 'shift', action: 'start', jobId: 'job_shop_assistant' }));
  await until('shift accepted', () =>
    third.messages.some((message) => message.type === 'shift_result' && message.ok && message.action === 'start'));

  second.ws.close();
  await until('fourth admitted', () => fourth.messages.some((message) => message.type === 'welcome'));

  console.log('[queuecheck] queue admits players in order and tells them their place');
} finally {
  for (const ws of openSockets) ws.close();
  child.kill('SIGTERM');
  await Promise.race([
    once(child, 'exit'),
    new Promise((resolve) => setTimeout(resolve, 2000)),
  ]);
  if (child.exitCode === null) child.kill('SIGKILL');
}
