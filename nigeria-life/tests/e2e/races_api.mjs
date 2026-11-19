// Street races on the game server, through its HTTP interface: entering takes the stake and
// draws the seed; a finish the fastest car could not have done, or one sent before the race could
// have been run, is refused; a winning time is paid the pot (the racers' times worked out by the
// server from the seed, the same sums as the game's); the best times make the board, fastest
// first. Starts its own server on a spare port with an empty database.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { wait } from './lib.mjs';

const PORT = 8807;
const BASE = `http://localhost:${PORT}`;
const ADMIN = 'test-admin-key';

async function call(pathname, body, token, admin) {
  const headers = { 'content-type': 'application/json' };
  if (token) headers.authorization = `Bearer ${token}`;
  if (admin) headers['x-nl-admin'] = admin;
  const r = await fetch(BASE + pathname, { method: body ? 'POST' : 'GET', headers, body: body ? JSON.stringify(body) : undefined });
  return { status: r.status, ...(await r.json()) };
}
const idem = () => `t:${Math.random().toString(36).slice(2)}${Date.now()}`;

export async function run(_browser, check) {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nl-races-'));
  const child = spawn(process.execPath, ['server/game-server.ts'], { env: { ...process.env, PORT: String(PORT), NL_DATA: dataDir, NL_DEV: '1', NL_ADMIN_KEY: ADMIN, NL_STATIC: path.join(dataDir, 'no-static') }, stdio: 'ignore' });
  try {
    for (let i = 0; i < 50; i++) {
      try {
        if ((await fetch(`${BASE}/health`)).ok) break;
      } catch {}
      await wait(200);
    }
    const R = await import('../../src/racing/RaceRules.ts').catch(() => null);
    const ada = await call('/auth/guest', { name: 'Ada' });
    const tunde = await call('/auth/guest', { name: 'Tunde' });
    await call('/admin/grant', { id: ada.account.id, amount: 200_000, memo: 'test' }, null, ADMIN);
    const before = (await call('/me', null, ada.token)).wallet ?? ada.wallet;

    // In for ₦10,000 on Ikorodu Road
    const entered = await call('/races/enter', { course: 'ikorodu', mode: 'race', stake: 10_000, idem: idem() }, ada.token);
    check('races: entering a race for ₦10,000 takes the stake and gives the race its seed',
      entered.ok && typeof entered.seed === 'number' && entered.wallet.cash + entered.wallet.bank === before.cash + before.bank - 10_000, { entered, before });

    // Sent at once: no race of 38 s could be over yet
    const course = R?.courseById('ikorodu');
    const runOf = (top, pull) => R.plan(course, top, pull, 0.2);
    const splitsOf = (run) => R.raceGates(course).map((g) => +run.times[Math.round(g)].toFixed(3));
    const fast = R ? splitsOf(runOf(40, 30)) : [];
    const early = await call('/races/finish', { race: entered.race, seconds: fast[fast.length - 1], splits: fast, car: 'Range Rover' }, ada.token);
    check('races: a finish sent before the race could have been driven is refused, and the race is over', !early.ok && /not on the road that long/.test(early.reason ?? ''), early);

    // A race run for real time: enter, wait out the run, finish ahead of the racers
    const short = await call('/races/enter', { course: 'shagari_drag', mode: 'race', stake: 10_000, idem: idem() }, ada.token);
    const drag = R?.courseById('shagari_drag');
    const dragRun = R ? R.plan(drag, 50, 30, 0.2) : null;
    const dragSplits = R ? R.raceGates(drag).map((g) => +dragRun.times[Math.round(g)].toFixed(3)) : [];
    const secs = dragSplits[dragSplits.length - 1];
    await wait(Math.ceil(secs * 1000 * 0.55) + 200);
    const won = await call('/races/finish', { race: short.race, seconds: secs, splits: dragSplits, car: 'Huracán' }, ada.token);
    const rivals = R ? R.racers(drag, 10_000, short.seed).map((r) => +R.finishTime(r.run).toFixed(3)) : [];
    check('races: a drag run faster than the racers is won and paid the pot less a tenth, the racers timed from the seed as the game times them',
      won.ok && won.place === 1 && won.prize === 18_000 && won.field.length === 1 && Math.abs(won.field[0].seconds - rivals[0]) < 0.01 && won.best === true,
      { won, rivals, secs });

    // A time no car could do
    const cheat = await call('/races/enter', { course: 'shagari_drag', mode: 'trial', idem: idem() }, ada.token);
    await wait(800);
    const silly = await call('/races/finish', { race: cheat.race, seconds: 1.2, splits: [0.6, 1.2], car: 'devtools' }, ada.token);
    check('races: a time no car could have done is refused', !silly.ok && /No car could/.test(silly.reason ?? ''), silly);

    // Tunde's slower trial goes on the board under Ada's
    const t2 = await call('/races/enter', { course: 'shagari_drag', mode: 'trial', idem: idem() }, tunde.token);
    const slowRun = R ? R.plan(drag, 30, 10, 0.4) : null;
    const slow = R ? R.raceGates(drag).map((g) => +slowRun.times[Math.round(g)].toFixed(3)) : [];
    await wait(Math.ceil(slow[slow.length - 1] * 1000 * 0.55) + 200);
    const trial = await call('/races/finish', { race: t2.race, seconds: slow[slow.length - 1], splits: slow, car: 'Camry' }, tunde.token);
    const board = await call('/races/board?course=shagari_drag', null, tunde.token);
    check('races: the board has the fastest first, each with their car, and where the asking player stands',
      trial.ok && trial.prize === 0 && board.ok && board.top.length === 2 && board.top[0].name === 'Ada' && board.top[1].name === 'Tunde' && board.top[1].mine && board.rank === 2 && board.top[0].ms < board.top[1].ms,
      { trial, board });

    const unknown = await call('/races/enter', { course: 'nowhere', mode: 'trial', idem: idem() }, ada.token);
    check('races: a course that does not exist cannot be entered', !unknown.ok, unknown);
  } finally {
    child.kill();
    await wait(300);
    try { fs.rmSync(dataDir, { recursive: true, force: true }); } catch { /* left for the system */ }
  }
}
