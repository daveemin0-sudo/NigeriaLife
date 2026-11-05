// The line to get in, and the short position packets, through the real game server.
// Starts its own server on a spare port with an empty database and room for only two players.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { WebSocket } from 'ws';
import { wait } from './lib.mjs';

const PORT = 8804;
const BASE = `http://localhost:${PORT}`;

async function guest(name) {
  const r = await fetch(`${BASE}/auth/guest`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name }) });
  return r.json();
}

function connect(token, proto = '2') {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`ws://localhost:${PORT}/play?token=${encodeURIComponent(token)}${proto ? `&proto=${proto}` : ''}`);
    const got = [];
    ws.on('message', (raw) => {
      const m = JSON.parse(String(raw));
      if (m.type === 'batch') got.push(...m.packets);
      else got.push(m);
    });
    ws.on('open', () => resolve({ ws, got, send: (p) => ws.send(JSON.stringify(p)), last: (type) => [...got].reverse().find((m) => m.type === type) }));
    ws.on('error', reject);
  });
}

const look = { gender: 'female', skinTone: '#6b4226', attire: 'ankara' };
const stand = (x, z, config = look) => ({ type: 'state', player: { id: 'x', name: 'x', position: { x, y: 0, z }, rotationY: 0.123456, isMoving: true, currentEmote: 'idle', config, city: 'lagos' } });

export async function run(_browser, check) {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nl-queue-'));
  const child = spawn(process.execPath, ['server/game-server.ts'], { env: { ...process.env, PORT: String(PORT), NL_DATA: dataDir, NL_DEV: '1', NL_MAX_PLAYERS: '2', NL_STATIC: path.join(dataDir, 'none') }, stdio: 'ignore' });
  try {
    for (let i = 0; i < 50; i++) {
      try {
        if ((await fetch(`${BASE}/health`)).ok) break;
      } catch {}
      await wait(200);
    }
    const [a, b, c, d] = await Promise.all(['Ada', 'Bayo', 'Chidi', 'Dami'].map(guest));
    const ada = await connect(a.token);
    const bayo = await connect(b.token, null); // an older game that does not ask for short packets
    await wait(200);
    const chidi = await connect(c.token);
    await wait(150);
    const dami = await connect(d.token);
    await wait(300);
    check('queue: the first two players are let straight in', !!ada.last('welcome') && !!bayo.last('welcome'), { ada: ada.got.slice(0, 2), bayo: bayo.got.slice(0, 2) });
    check('queue: with the server full, the next two wait as numbers 1 and 2 in line', chidi.last('queued')?.position === 1 && dami.last('queued')?.position === 2 && !chidi.last('welcome'), { chidi: chidi.got, dami: dami.got });
    const health = await (await fetch(`${BASE}/health`)).json();
    check('queue: the server says how many are waiting', health.queued === 2 && health.online === 2, health);

    // Short packets: Ada and Bayo can see each other
    ada.send(stand(10, 10));
    bayo.send(stand(12, 10));
    await wait(400);
    ada.send(stand(10.5, 10));
    bayo.send(stand(12.5, 10));
    await wait(400);
    const seenByAda = ada.got.filter((m) => m.type === 'state' && m.player.id === b.account.id);
    const seenByBayo = bayo.got.filter((m) => m.type === 'state' && m.player.id === a.account.id);
    check('queue: a game that asks for short packets gets the look once, then only movement', seenByAda.length >= 2 && !!seenByAda[0].player.config && !seenByAda.at(-1).player.config && !seenByAda.at(-1).player.name, seenByAda);
    check('queue: short packets keep positions to the centimetre', seenByAda.at(-1)?.player.rotationY === 0.12, seenByAda.at(-1));
    check('queue: an older game still gets the whole state every time', seenByBayo.length >= 2 && seenByBayo.every((m) => !!m.player.config && m.player.name === 'Ada'), seenByBayo);
    ada.send(stand(10.5, 10, { ...look, attire: 'agbada' }));
    await wait(400);
    const changed = ada.got.length && bayo.got.filter((m) => m.type === 'state' && m.player.id === a.account.id).at(-1);
    const toAda = await connect(a.token); // same account again: replaces, never waits
    await wait(300);
    check('queue: someone already playing who connects again goes straight in, ahead of the line', !!toAda.last('welcome') && !toAda.last('queued'), toAda.got);
    toAda.send(stand(10.5, 10, { ...look, attire: 'agbada' }));
    bayo.send(stand(13, 10));
    await wait(400);
    const lookAgain = toAda.got.filter((m) => m.type === 'state' && m.player.id === b.account.id);
    check('queue: a fresh connection is sent the look again', !!lookAgain[0]?.player.config, lookAgain);
    check('queue: a changed look reaches the others', changed?.player?.config?.attire === 'agbada', changed);

    // Someone leaves: the head of the line is let in without doing anything, and the rest move up
    bayo.ws.close();
    await wait(500);
    check('queue: when a player leaves, number 1 in line is let in by itself', !!chidi.last('welcome'), chidi.got);
    check('queue: the rest move up the line', dami.last('queued')?.position === 1, dami.got);
    // Leaving the line moves nobody ahead of you
    dami.ws.close();
    await wait(300);
    const after = await (await fetch(`${BASE}/health`)).json();
    check('queue: someone who gives up waiting leaves the line', after.queued === 0 && after.online === 2, after);
    for (const s of [toAda, chidi, ada]) s.ws.close();
  } finally {
    child.kill('SIGTERM');
  }
}
