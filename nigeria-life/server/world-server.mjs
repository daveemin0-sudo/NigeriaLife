// The NigeriaLife world server.
//
// It does two things for players on different devices:
//
//   1. It holds the one ownership registry (who owns which plot, building, vehicle, home and
//      business; listings, offers, sales) and lets one game at a time change it. A game asks
//      for the lock, is given the registry as it stands, makes its change and hands it back.
//      Nobody else can change it in between, so two buyers cannot take the same plot.
//
//   2. It passes players' movements, chat and private messages between games, so they see
//      each other in the city.
//
// What it does NOT do: it does not check the rules of the game or hold anyone's money. The
// games do that, as they do when playing in one browser. Anyone who can reach this server and
// knows the room key can write to the registry. It is for playing with people you trust on a
// home or office network, not for the public internet.
//
//   node server/world-server.mjs            listens on port 8787
//   PORT=9000 NL_KEY=secret node server/world-server.mjs
//   NL_DATA=/path/to/folder                 where the registry is kept (default server/data)
//
// No dependencies: Node's own http and fs.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';

const PORT = Number(process.env.PORT || 8787);
const KEY = process.env.NL_KEY || '';
const DATA_DIR = process.env.NL_DATA || path.join(path.dirname(fileURLToPath(import.meta.url)), 'data');
const FILE = path.join(DATA_DIR, 'registry.json');
/** How long a game may hold the lock before it is taken back. A change takes milliseconds. */
const LEASE_MS = 5000;
/** How long a game waits in line for the lock before being told to try again */
const WAIT_MS = 15000;
const MAX_BODY = 4 * 1024 * 1024;

// --- The registry -------------------------------------------------------------------------------

let registry = { text: '', version: 0 };
try {
  const saved = JSON.parse(fs.readFileSync(FILE, 'utf8'));
  if (typeof saved.text === 'string' && Number.isInteger(saved.version)) registry = saved;
} catch {
  // No registry yet: an empty world
}

function persist() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const tmp = `${FILE}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(registry));
  fs.renameSync(tmp, FILE);
}

// --- The lock -----------------------------------------------------------------------------------

/** @type {{ token: string, client: string, timer: NodeJS.Timeout } | null} */
let lock = null;
/** @type {Array<{ client: string, grant: (token: string | null) => void, timer: NodeJS.Timeout }>} */
const waiting = [];

function grantNext() {
  if (lock || waiting.length === 0) return;
  const next = waiting.shift();
  clearTimeout(next.timer);
  const token = randomUUID();
  lock = { token, client: next.client, timer: setTimeout(() => release(token), LEASE_MS) };
  next.grant(token);
}

function release(token) {
  if (!lock || lock.token !== token) return false;
  clearTimeout(lock.timer);
  lock = null;
  grantNext();
  return true;
}

function requestLock(client) {
  return new Promise((resolve) => {
    const entry = { client, grant: resolve, timer: setTimeout(() => {
      const at = waiting.indexOf(entry);
      if (at >= 0) waiting.splice(at, 1);
      resolve(null);
    }, WAIT_MS) };
    waiting.push(entry);
    grantNext();
  });
}

// --- Players listening --------------------------------------------------------------------------

/** @type {Map<string, http.ServerResponse>} */
const listeners = new Map();

function send(res, event, data) {
  res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

function broadcast(event, data, except) {
  for (const [client, res] of listeners) {
    if (client !== except) send(res, event, data);
  }
}

// --- HTTP ---------------------------------------------------------------------------------------

function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY) {
        reject(new Error('too large'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      try {
        resolve(chunks.length ? JSON.parse(Buffer.concat(chunks).toString('utf8')) : {});
      } catch (error) {
        reject(error);
      }
    });
    req.on('error', reject);
  });
}

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'content-type, x-nl-key',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

function reply(res, status, body) {
  res.writeHead(status, { ...CORS, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(body));
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', 'http://localhost');
  if (req.method === 'OPTIONS') {
    res.writeHead(204, CORS);
    res.end();
    return;
  }
  if (KEY && req.headers['x-nl-key'] !== KEY && url.searchParams.get('key') !== KEY) {
    reply(res, 401, { ok: false, reason: 'This server needs its room key.' });
    return;
  }

  try {
    if (req.method === 'GET' && url.pathname === '/health') {
      reply(res, 200, { ok: true, name: 'NigeriaLife world server', version: registry.version, players: listeners.size });
    } else if (req.method === 'GET' && url.pathname === '/registry') {
      reply(res, 200, { ok: true, text: registry.text, version: registry.version });
    } else if (req.method === 'GET' && url.pathname === '/events') {
      const client = url.searchParams.get('client') || randomUUID();
      res.writeHead(200, { ...CORS, 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-store', Connection: 'keep-alive' });
      res.write('retry: 1500\n\n');
      listeners.get(client)?.end();
      listeners.set(client, res);
      send(res, 'hello', { version: registry.version, players: listeners.size });
      const beat = setInterval(() => res.write(': still here\n\n'), 20000);
      req.on('close', () => {
        clearInterval(beat);
        if (listeners.get(client) === res) listeners.delete(client);
        // Their game has gone: everyone else stops showing them
        broadcast('gone', { client });
      });
    } else if (req.method === 'POST' && url.pathname === '/lock') {
      const body = await readBody(req);
      const token = await requestLock(String(body.client ?? ''));
      if (!token) reply(res, 503, { ok: false, reason: 'The server is busy. Try again.' });
      else reply(res, 200, { ok: true, token, text: registry.text, version: registry.version });
    } else if (req.method === 'POST' && url.pathname === '/commit') {
      const body = await readBody(req);
      if (!lock || lock.token !== body.token) {
        reply(res, 409, { ok: false, reason: 'The change took too long and was not saved.' });
        return;
      }
      // `text: null` hands the lock back without changing anything
      if (typeof body.text === 'string' && body.text !== registry.text) {
        JSON.parse(body.text); // refuse anything that is not a document
        registry = { text: body.text, version: registry.version + 1 };
        persist();
        broadcast('registry', { version: registry.version });
      }
      release(body.token);
      reply(res, 200, { ok: true, version: registry.version });
    } else if (req.method === 'POST' && url.pathname === '/net') {
      const body = await readBody(req);
      if (Array.isArray(body.packets)) {
        for (const packet of body.packets.slice(0, 40)) broadcast('net', packet, String(body.client ?? ''));
      }
      reply(res, 200, { ok: true });
    } else {
      reply(res, 404, { ok: false, reason: 'Not found.' });
    }
  } catch (error) {
    reply(res, 400, { ok: false, reason: 'That request could not be read.' });
  }
});

server.listen(PORT, () => {
  console.log(`NigeriaLife world server listening on port ${PORT}${KEY ? ' (room key set)' : ''}. Registry: ${FILE} (version ${registry.version}).`);
});
