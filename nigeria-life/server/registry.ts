/**
 * The ownership registry (who owns which plot, building, vehicle, home and business; listings,
 * offers and sales), as the world server has always kept it: one document, changed by one game
 * at a time under a lock, so two buyers cannot take the same plot. Also the event stream games
 * listen on for registry changes and for players' packets on the old relay.
 *
 * Moved here unchanged from server/world-server.mjs so the game server serves the same routes.
 * It still trusts the game to follow the rules when changing the registry: what is bought and
 * sold moves to server checks as each action moves to `economy.ts`.
 */
import type http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

const LEASE_MS = 5000;
const WAIT_MS = 15000;

type Reply = (res: http.ServerResponse, status: number, body: unknown) => void;
type ReadBody = (req: http.IncomingMessage) => Promise<Record<string, unknown>>;

export class Registry {
  private file: string;
  private dataDir: string;
  private registry = { text: '', version: 0 };
  private lock: { token: string; client: string; timer: NodeJS.Timeout } | null = null;
  private waiting: Array<{ client: string; grant: (token: string | null) => void; timer: NodeJS.Timeout }> = [];
  private listeners = new Map<string, http.ServerResponse>();
  private corsHeaders: Record<string, string>;

  constructor(dataDir: string, corsHeaders: Record<string, string>) {
    this.dataDir = dataDir;
    this.file = path.join(dataDir, 'registry.json');
    this.corsHeaders = corsHeaders;
    try {
      const saved = JSON.parse(fs.readFileSync(this.file, 'utf8'));
      if (typeof saved.text === 'string' && Number.isInteger(saved.version)) this.registry = saved;
    } catch {
      // No registry yet: an empty world
    }
  }

  public get version(): number {
    return this.registry.version;
  }

  public get listening(): number {
    return this.listeners.size;
  }

  private persist(): void {
    fs.mkdirSync(this.dataDir, { recursive: true });
    const tmp = `${this.file}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(this.registry));
    fs.renameSync(tmp, this.file);
  }

  private grantNext(): void {
    if (this.lock || this.waiting.length === 0) return;
    const next = this.waiting.shift()!;
    clearTimeout(next.timer);
    const token = randomUUID();
    this.lock = { token, client: next.client, timer: setTimeout(() => this.release(token), LEASE_MS) };
    next.grant(token);
  }

  private release(token: string): boolean {
    if (!this.lock || this.lock.token !== token) return false;
    clearTimeout(this.lock.timer);
    this.lock = null;
    this.grantNext();
    return true;
  }

  private requestLock(client: string): Promise<string | null> {
    return new Promise((resolve) => {
      const entry = {
        client,
        grant: resolve,
        timer: setTimeout(() => {
          const at = this.waiting.indexOf(entry);
          if (at >= 0) this.waiting.splice(at, 1);
          resolve(null);
        }, WAIT_MS),
      };
      this.waiting.push(entry);
      this.grantNext();
    });
  }

  private send(res: http.ServerResponse, event: string, data: unknown): void {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  }

  public broadcast(event: string, data: unknown, except?: string): void {
    for (const [client, res] of this.listeners) if (client !== except) this.send(res, event, data);
  }

  /** Handles the registry's routes; false if the request is not one of them. */
  public async handle(req: http.IncomingMessage, res: http.ServerResponse, url: URL, reply: Reply, readBody: ReadBody): Promise<boolean> {
    if (req.method === 'GET' && url.pathname === '/registry') {
      reply(res, 200, { ok: true, text: this.registry.text, version: this.registry.version });
    } else if (req.method === 'GET' && url.pathname === '/events') {
      const client = url.searchParams.get('client') || randomUUID();
      res.writeHead(200, { ...this.corsHeaders, 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-store', Connection: 'keep-alive' });
      res.write('retry: 1500\n\n');
      this.listeners.get(client)?.end();
      this.listeners.set(client, res);
      this.send(res, 'hello', { version: this.registry.version, players: this.listeners.size });
      const beat = setInterval(() => res.write(': still here\n\n'), 20000);
      req.on('close', () => {
        clearInterval(beat);
        if (this.listeners.get(client) === res) this.listeners.delete(client);
        this.broadcast('gone', { client });
      });
    } else if (req.method === 'POST' && url.pathname === '/lock') {
      const body = await readBody(req);
      const token = await this.requestLock(String(body.client ?? ''));
      if (!token) reply(res, 503, { ok: false, reason: 'The server is busy. Try again.' });
      else reply(res, 200, { ok: true, token, text: this.registry.text, version: this.registry.version });
    } else if (req.method === 'POST' && url.pathname === '/commit') {
      const body = await readBody(req);
      if (!this.lock || this.lock.token !== body.token) {
        reply(res, 409, { ok: false, reason: 'The change took too long and was not saved.' });
        return true;
      }
      if (typeof body.text === 'string' && body.text !== this.registry.text) {
        JSON.parse(body.text);
        this.registry = { text: body.text, version: this.registry.version + 1 };
        this.persist();
        this.broadcast('registry', { version: this.registry.version });
      }
      this.release(String(body.token));
      reply(res, 200, { ok: true, version: this.registry.version });
    } else if (req.method === 'POST' && url.pathname === '/net') {
      const body = await readBody(req);
      if (Array.isArray(body.packets)) {
        // The old relay: money is never passed this way any more (see rooms.ts)
        for (const packet of body.packets.slice(0, 40)) {
          if ((packet as { type?: string })?.type === 'p2p_transfer') continue;
          this.broadcast('net', packet, String(body.client ?? ''));
        }
      }
      reply(res, 200, { ok: true });
    } else {
      return false;
    }
    return true;
  }
}
