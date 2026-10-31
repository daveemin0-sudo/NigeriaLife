// The Nigeria Life game server.
//
//   npm run server                       port 8787, data in server/data, serves the built game from dist/
//   PORT=9000 NL_DATA=/srv/nl node server/game-server.ts
//   NL_ADMIN_KEY=...                     turns on the admin page at /admin (off without a key)
//   NL_KEY=...                           a room key every request must carry (private servers)
//   NL_PUBLIC_URL=https://...            the address sign-in links point to
//   NL_DEV=1                             sign-in links are also returned to the game (tests)
//
// What it does: accounts (guest, then email sign-in to keep progress), the money (every online
// player's wallet and an append-only ledger; job shifts checked and paid here), players in the
// city over WebSocket in rooms per city with interest management, moderated chat, the shared
// ownership registry, and an admin page. Node 22.5+ runs this TypeScript directly; the only
// package it needs is `ws`. See docs/ROADMAP.md for what is still checked by the game instead.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Accounts, consoleMailer, type Account } from './accounts.ts';
import { Economy } from './economy.ts';
import { Registry } from './registry.ts';
import { Rooms } from './rooms.ts';
import { RateLimit } from './accounts.ts';
import { openStore } from './store.ts';

const here = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT || 8787);
const DATA_DIR = path.resolve(process.env.NL_DATA || path.join(here, 'data'));
const STATIC_DIR = path.resolve(process.env.NL_STATIC || path.join(here, '..', 'dist'));
const ROOM_KEY = process.env.NL_KEY || '';
const ADMIN_KEY = process.env.NL_ADMIN_KEY || '';
const DEV = process.env.NL_DEV === '1';
const PUBLIC_URL = (process.env.NL_PUBLIC_URL || process.env.RENDER_EXTERNAL_URL || `http://localhost:${PORT}`).replace(/\/+$/, '');
const MAX_BODY = 4 * 1024 * 1024;

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'content-type, authorization, x-nl-key, x-nl-admin',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

const db = openStore(DATA_DIR);
const accounts = new Accounts(db, consoleMailer, PUBLIC_URL, DEV, Number(process.env.NL_GUESTS_PER_HOUR || (DEV ? 1000 : 10)));
const registry = new Registry(DATA_DIR, CORS);
const server = http.createServer((req, res) => void route(req, res));
const rooms = new Rooms(server, accounts, db);
const economy = new Economy(db, (id) => rooms.positionOf(id));
// What businesses an account owns, as the ownership registry says
economy.businessesOf = (accountId) => {
  const account = accounts.get(accountId);
  const owner = account ? accounts.registryOf(account) : null;
  if (!owner) return [];
  try {
    const titles = (JSON.parse(registry.text || '{}') as { titles?: Record<string, { ownerId?: string | null }> }).titles ?? {};
    return Object.entries(titles).filter(([key, t]) => key.startsWith('business:') && t?.ownerId === owner).map(([key]) => key.slice('business:'.length));
  } catch {
    return [];
  }
};
economy.onChange = (id, wallet) => rooms.tell(id, { type: 'wallet', wallet });

/** The share of a sale's price the market keeps: as the game (src/realestate/AssetMarket.ts) */
const SALE_FEE_RATE = 0.02;

/**
 * A registry change that writes new payouts (a sale completed, rent paid) moves real money: the
 * server takes it from the player who sent the change and pays whoever is owed, then marks the
 * payouts paid in the document it keeps, so nobody's game claims them again.
 */
registry.onCommit = (beforeText, afterText, req) => {
  type Doc = { payouts?: Record<string, { id: string; toId: string; amount: number; reason: string; saleId?: string; claimedAt?: number; settledBy?: string }>; sales?: Array<{ id: string; buyerId: string; sellerId: string; price: number }> };
  let before: Doc;
  let after: Doc;
  try {
    before = beforeText ? JSON.parse(beforeText) : {};
    after = JSON.parse(afterText);
  } catch {
    return { reason: 'That change could not be read.' };
  }
  const fresh = Object.values(after.payouts ?? {}).filter((p) => !before.payouts?.[p.id]);
  if (fresh.length === 0) return { text: afterText };
  const sender = accounts.authenticate(tokenOf(req));
  const senderId = sender ? accounts.registryOf(sender) : null;
  if (!sender || !senderId) return { reason: 'Sign in to buy, sell or pay rent.' };
  const moves = [];
  for (const payout of fresh) {
    const payee = accounts.byRegistry(String(payout.toId));
    if (!payee) return { reason: 'The one being paid has no account on this server.' };
    const amount = Math.trunc(Number(payout.amount));
    let pay = amount;
    if (payout.saleId) {
      const sale = after.sales?.find((s) => s.id === payout.saleId);
      if (!sale || sale.buyerId !== senderId || sale.sellerId !== payout.toId) return { reason: 'That sale is not the sender\'s to complete.' };
      pay = Math.trunc(Number(sale.price));
      if (amount !== pay - Math.round(pay * SALE_FEE_RATE)) return { reason: 'The amount paid for that sale is not right.' };
    }
    moves.push({ payer: sender.id, payee: payee.id, pay, receive: amount, memo: String(payout.reason ?? 'Payment').slice(0, 120), key: `payout:${payout.id}` });
  }
  const settled = economy.settlePayouts(moves);
  if (!settled.ok) return { reason: settled.reason };
  for (const payout of fresh) {
    after.payouts![payout.id].claimedAt = Date.now();
    after.payouts![payout.id].settledBy = 'server';
  }
  return { text: JSON.stringify(after) };
};
/** How the game runs on each player's device, as it last said (kept in memory only, for the admin page) */
const devices = new Map<string, Record<string, unknown>>();

/** Money requests from one account: plenty for play, too few to hammer the server */
const moneyRate = new RateLimit(120, 60_000);

function reply(res: http.ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { ...CORS, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(body));
}

function readBody(req: http.IncomingMessage): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => {
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
        const body = chunks.length ? JSON.parse(Buffer.concat(chunks).toString('utf8')) : {};
        resolve(body && typeof body === 'object' ? body : {});
      } catch (error) {
        reject(error);
      }
    });
    req.on('error', reject);
  });
}

const addressOf = (req: http.IncomingMessage) => String(req.headers['x-forwarded-for'] ?? req.socket.remoteAddress ?? '').split(',')[0].trim();
const tokenOf = (req: http.IncomingMessage) => String(req.headers.authorization ?? '').replace(/^Bearer\s+/i, '') || null;

/** The built game, with this server set as its server before any of its code runs. */
function serveStatic(res: http.ServerResponse, pathname: string): boolean {
  if (!fs.existsSync(STATIC_DIR)) return false;
  const safe = path.normalize(decodeURIComponent(pathname)).replace(/^(\.\.[/\\])+/, '');
  let file = path.resolve(STATIC_DIR, `.${path.sep}${safe}`);
  if (file !== STATIC_DIR && !file.startsWith(STATIC_DIR + path.sep)) return false;
  if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(STATIC_DIR, 'index.html');
  if (!fs.existsSync(file)) return false;
  const types: Record<string, string> = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.json': 'application/json', '.ico': 'image/x-icon' };
  const type = types[path.extname(file)] ?? 'application/octet-stream';
  let body: Buffer | string = fs.readFileSync(file);
  if (path.basename(file) === 'index.html') {
    body = body.toString('utf8').replace('<head>', `<head><script>try{localStorage.setItem('nigeria_life_world_server', location.origin)}catch(e){}</script>`);
  }
  res.writeHead(200, { 'Content-Type': type, 'Cache-Control': path.basename(file) === 'index.html' ? 'no-store' : 'public, max-age=31536000, immutable' });
  res.end(body);
  return true;
}

async function route(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
  const url = new URL(req.url ?? '/', 'http://localhost');
  if (req.method === 'OPTIONS') {
    res.writeHead(204, CORS);
    res.end();
    return;
  }
  try {
    // The admin page is a static page that asks for the admin key itself
    if (req.method === 'GET' && url.pathname === '/admin') {
      if (!ADMIN_KEY) return reply(res, 404, { ok: false, reason: 'The admin page is off on this server.' });
      res.writeHead(200, { 'Content-Type': 'text/html', 'Cache-Control': 'no-store' });
      res.end(fs.readFileSync(path.join(here, 'admin.html')));
      return;
    }
    const api = /^\/(health|registry|events|lock|commit|net|auth|me|money|work|social|admin)(\/|$)/.test(url.pathname);
    if (!api) {
      if (req.method === 'GET' && serveStatic(res, url.pathname)) return;
      return reply(res, 404, { ok: false, reason: 'Not found.' });
    }
    if (ROOM_KEY && req.headers['x-nl-key'] !== ROOM_KEY && url.searchParams.get('key') !== ROOM_KEY) {
      return reply(res, 401, { ok: false, reason: 'This server needs its room key.' });
    }
    if (req.method === 'GET' && url.pathname === '/health') {
      const counts = accounts.counts();
      return reply(res, 200, { ok: true, name: 'Nigeria Life game server', version: registry.version, players: rooms.online().players + registry.listening, online: rooms.online().players, accounts: counts.all, verified: counts.verified });
    }
    if (await registry.handle(req, res, url, reply, readBody)) return;

    if (req.method === 'POST' && url.pathname === '/auth/guest') {
      const body = await readBody(req);
      const made = accounts.createGuest(body.name, addressOf(req));
      if (!made.ok) return reply(res, 429, made);
      if (body.save && typeof body.save === 'object') economy.importSave(made.account.id, body.save as Record<string, unknown>);
      return reply(res, 200, { ok: true, token: made.token, account: made.account, wallet: economy.wallet(made.account.id) });
    }
    if (req.method === 'POST' && url.pathname === '/auth/register') {
      const body = await readBody(req);
      const result = accounts.register(body.username, body.password, accounts.authenticate(tokenOf(req)), addressOf(req));
      if (!result.ok) return reply(res, 400, result);
      return reply(res, 200, { ...result, wallet: economy.wallet(result.account.id) });
    }
    if (req.method === 'POST' && url.pathname === '/auth/login') {
      const body = await readBody(req);
      const result = accounts.login(body.username, body.password, addressOf(req));
      if (!result.ok) return reply(res, 400, result);
      return reply(res, 200, { ...result, wallet: economy.wallet(result.account.id) });
    }
    if (req.method === 'POST' && url.pathname === '/auth/email') {
      const body = await readBody(req);
      const result = accounts.startEmail(body.email, accounts.authenticate(tokenOf(req)), addressOf(req));
      return reply(res, result.ok ? 200 : 400, result);
    }
    if (req.method === 'POST' && url.pathname === '/auth/finish') {
      const body = await readBody(req);
      const result = accounts.finishEmail(body.token);
      if (!result.ok) return reply(res, 400, result);
      return reply(res, 200, { ...result, wallet: economy.wallet(result.account.id) });
    }

    if (url.pathname.startsWith('/admin/')) return admin(req, res, url);

    // Everything below is for a signed-in player
    const account = accounts.authenticate(tokenOf(req));
    if (!account) return reply(res, 401, { ok: false, reason: 'Sign in again.' });
    if (url.pathname.startsWith('/money/') && !moneyRate.allow(account.id)) {
      return reply(res, 429, { ok: false, reason: 'Too many requests. Slow down.', wallet: economy.wallet(account.id) });
    }
    return player(req, res, url, account);
  } catch {
    reply(res, 400, { ok: false, reason: 'That request could not be read.' });
  }
}

async function player(req: http.IncomingMessage, res: http.ServerResponse, url: URL, account: Account): Promise<void> {
  const body = req.method === 'POST' ? await readBody(req) : {};
  const done = (result: { ok: boolean }) => reply(res, result.ok ? 200 : 409, result);
  switch (`${req.method} ${url.pathname}`) {
    case 'GET /me':
      return reply(res, 200, { ok: true, account, wallet: economy.wallet(account.id) });
    case 'POST /me/device': {
      const keep = ['fps', 'quality', 'pixelRatio', 'deviceRatio', 'screen', 'touch', 'triangles', 'drawCalls', 'mode', 'walked', 'joystickTouches', 'agent'];
      const report: Record<string, unknown> = { at: Date.now(), name: account.name };
      for (const key of keep) if (key in body) report[key] = typeof body[key] === 'string' ? String(body[key]).slice(0, 160) : body[key];
      devices.set(account.id, report);
      console.log(`[device] ${account.name} ${report.screen} x${report.deviceRatio} ${report.fps} fps, ${report.quality} (pixels x${report.pixelRatio}), ${report.triangles} triangles, ${report.mode}, walked ${report.walked} m, stick touched ${report.joystickTouches}`);
      return reply(res, 200, { ok: true });
    }
    case 'POST /me/registry': {
      const bound = accounts.bindRegistry(account, body.id);
      return reply(res, bound.ok ? 200 : 409, bound);
    }
    case 'POST /me/name': {
      const renamed = accounts.rename(account, body.name);
      return renamed ? reply(res, 200, { ok: true, account: renamed }) : reply(res, 400, { ok: false, reason: 'A name is 2 to 20 letters or numbers.' });
    }
    case 'POST /money/report':
      return done(economy.report(account.id, body));
    case 'POST /money/send': {
      const result = economy.transfer(account.id, String(body.to ?? ''), body);
      if (result.ok) rooms.tell(String(body.to ?? ''), { type: 'transfer', fromId: account.id, fromName: account.name, amount: Math.trunc(Number(body.amount)), memo: String(body.memo ?? '').slice(0, 120) });
      return done(result);
    }
    case 'GET /money/ledger':
      return reply(res, 200, { ok: true, wallet: economy.wallet(account.id), ledger: economy.ledger(account.id) });
    case 'POST /work/hire':
      return done(economy.hire(account.id, String(body.employer ?? '')));
    case 'POST /work/start':
      return done(economy.startShift(account.id, String(body.employer ?? '')));
    case 'POST /work/finish':
      return done(economy.finishShift(account.id, body.shift, body.idem));
    case 'GET /work': {
      const employer = url.searchParams.get('employer') ?? '';
      return reply(res, 200, { ok: true, job: economy.job(account.id, employer) });
    }
    case 'POST /social/block':
      db.prepare('INSERT OR IGNORE INTO blocks (account_id, blocked) VALUES (?, ?)').run(account.id, String(body.id ?? ''));
      return reply(res, 200, { ok: true });
    case 'POST /social/unblock':
      db.prepare('DELETE FROM blocks WHERE account_id = ? AND blocked = ?').run(account.id, String(body.id ?? ''));
      return reply(res, 200, { ok: true });
    case 'POST /social/report':
      db.prepare('INSERT INTO reports (at, reporter, reported, reason, context) VALUES (?, ?, ?, ?, ?)').run(Date.now(), account.id, String(body.id ?? '').slice(0, 40), String(body.reason ?? '').slice(0, 300), String(body.context ?? '').slice(0, 1000));
      return reply(res, 200, { ok: true });
    default:
      return reply(res, 404, { ok: false, reason: 'Not found.' });
  }
}

async function admin(req: http.IncomingMessage, res: http.ServerResponse, url: URL): Promise<void> {
  if (!ADMIN_KEY || req.headers['x-nl-admin'] !== ADMIN_KEY) return reply(res, 403, { ok: false, reason: 'Not allowed.' });
  const body = req.method === 'POST' ? await readBody(req) : {};
  const id = String(body.id ?? url.searchParams.get('id') ?? '');
  switch (`${req.method} ${url.pathname}`) {
    case 'GET /admin/stats':
      return reply(res, 200, { ok: true, online: rooms.online(), accounts: accounts.counts(), economy: economy.totals() });
    case 'GET /admin/devices':
      return reply(res, 200, { ok: true, devices: Array.from(devices, ([id, d]) => ({ id, ...d }) as Record<string, unknown>).filter((d) => Date.now() - Number(d.at) < 10 * 60_000) });
    case 'GET /admin/reports':
      return reply(res, 200, { ok: true, reports: db.prepare('SELECT * FROM reports ORDER BY id DESC LIMIT 100').all() });
    case 'GET /admin/ledger':
      return reply(res, 200, { ok: true, account: accounts.get(id), wallet: economy.wallet(id), ledger: economy.ledger(id, 200) });
    case 'POST /admin/ban':
      accounts.setBanned(id, body.banned !== false);
      if (body.banned !== false) rooms.kick(id);
      return reply(res, 200, { ok: true });
    case 'POST /admin/mute':
      accounts.mute(id, Math.max(0, Math.min(60 * 24 * 30, Number(body.minutes) || 60)));
      return reply(res, 200, { ok: true });
    case 'GET /admin/held':
      return reply(res, 200, { ok: true, held: economy.heldList() });
    case 'POST /admin/held': {
      const result = economy.decideHeld(Number(body.held), body.release !== false);
      return reply(res, result.ok ? 200 : 409, result);
    }
    case 'POST /admin/grant': {
      const result = economy.grant(id, Number(body.amount) || 0, String(body.memo ?? ''));
      return reply(res, result.ok ? 200 : 409, result);
    }
    default:
      return reply(res, 404, { ok: false, reason: 'Not found.' });
  }
}

server.listen(PORT, () => {
  const counts = accounts.counts();
  console.log(`Nigeria Life game server on port ${PORT}. Data: ${DATA_DIR}. Accounts: ${counts.all} (${counts.verified} verified).${ADMIN_KEY ? ' Admin page: /admin.' : ''}${DEV ? ' Development mode.' : ''}`);
});

function stop(): void {
  rooms.close();
  server.close(() => {
    db.close();
    process.exit(0);
  });
  setTimeout(() => process.exit(0), 3000).unref();
}
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
