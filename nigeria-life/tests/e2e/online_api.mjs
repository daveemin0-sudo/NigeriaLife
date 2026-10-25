// The game server's rules, through its real HTTP and WebSocket interface: accounts, the
// ledger, limits on money the game reports, a job shift checked and paid by the server,
// players seeing only who is near, filtered and blockable chat, and the admin page's API.
// Starts its own server on a spare port with an empty database.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { WebSocket } from 'ws';
import { wait } from './lib.mjs';

const PORT = 8803;
const BASE = `http://localhost:${PORT}`;
const ADMIN = 'test-admin-key';

async function call(pathname, body, token, admin) {
  const headers = { 'content-type': 'application/json' };
  if (token) headers.authorization = `Bearer ${token}`;
  if (admin) headers['x-nl-admin'] = admin;
  const r = await fetch(BASE + pathname, { method: body ? 'POST' : 'GET', headers, body: body ? JSON.stringify(body) : undefined });
  return { status: r.status, ...(await r.json()) };
}

/** A player's WebSocket, collecting everything the server sends. */
function connect(token) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`ws://localhost:${PORT}/play?token=${encodeURIComponent(token)}`);
    const got = [];
    ws.on('message', (raw) => {
      const m = JSON.parse(String(raw));
      if (m.type === 'batch') got.push(...m.packets);
      else got.push(m);
    });
    ws.on('open', () => resolve({ ws, got, send: (p) => ws.send(JSON.stringify(p)) }));
    ws.on('error', reject);
  });
}

const stand = (x, z, city = 'lagos') => ({ type: 'state', player: { id: 'claimed-id', name: 'Claimed Name', position: { x, y: 0, z }, rotationY: 0, isMoving: false, currentEmote: 'idle', config: {}, city } });
const idem = () => `t:${Math.random().toString(36).slice(2)}${Date.now()}`;

export async function run(_browser, check) {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nl-online-'));
  const child = spawn(process.execPath, ['server/game-server.ts'], { env: { ...process.env, PORT: String(PORT), NL_DATA: dataDir, NL_DEV: '1', NL_ADMIN_KEY: ADMIN, NL_STATIC: path.join(dataDir, 'no-static') }, stdio: 'ignore' });
  try {
    for (let i = 0; i < 50; i++) {
      try {
        if ((await fetch(`${BASE}/health`)).ok) break;
      } catch {}
      await wait(200);
    }

    // Accounts
    const ada = await call('/auth/guest', { name: 'Ada' });
    const bayo = await call('/auth/guest', { name: 'Bayo <script>' });
    check('online: anyone can start as a guest at once, with the starting money held by the server', ada.ok && ada.account.kind === 'guest' && !ada.account.verified && ada.wallet.cash === 25000 && ada.wallet.bank === 150000, ada);
    check('online: a name is cleaned before anyone sees it', bayo.account.name === 'Bayo script', bayo.account);
    const noToken = await call('/me');
    check('online: without signing in, nothing of anyone is shown', noToken.status === 401, noToken);

    // Money the game reports: spending yes, earning only within a limit
    const spent = await call('/money/report', { cash: -2000, memo: 'Suya', idem: idem() }, ada.token);
    const repeatKey = idem();
    const earned = await call('/money/report', { cash: 30000, memo: 'Street gig', idem: repeatKey }, ada.token);
    const again = await call('/money/report', { cash: 30000, memo: 'Street gig', idem: repeatKey }, ada.token);
    check('online: spending is taken, and the same report sent twice is paid once', spent.ok && spent.wallet.cash === 23000 && earned.wallet.cash === 53000 && again.ok && again.wallet.cash === 53000, { spent: spent.wallet, earned: earned.wallet, again: again.wallet });
    const tooMuch = await call('/money/report', { cash: 1_000_000_000, memo: 'devtools', idem: idem() }, ada.token);
    const overdraw = await call('/money/report', { cash: -10_000_000, memo: 'too dear', idem: idem() }, ada.token);
    check('online: a billion naira from the game is not paid but held for checking, nothing goes below zero, and the wallet is unchanged', !tooMuch.ok && tooMuch.held > 0 && tooMuch.wallet.cash === 53000 && !overdraw.ok && overdraw.wallet.cash === 53000, { tooMuch, overdraw });

    // A job shift, checked by the server
    const a = await connect(ada.token);
    const b = await connect(bayo.token);
    await wait(300);
    const welcome = a.got.find((m) => m.type === 'welcome');
    check('online: the server says who the player is (its id, not one the game makes up)', welcome?.id === ada.account.id, welcome);
    a.send(stand(0, 0));
    await wait(300);
    const notHired = await call('/work/start', { employer: 'apapa-port' }, ada.token);
    const hired = await call('/work/hire', { employer: 'apapa-port' }, ada.token);
    const notThere = await call('/work/start', { employer: 'apapa-port' }, ada.token);
    check('online: work cannot start before being taken on, nor away from the workplace', !notHired.ok && hired.ok && !notThere.ok && /not at the workplace/.test(notThere.reason), { notHired, notThere });
    // Arriving at the bay in a jump nobody could walk: not believed for ten seconds
    a.send(stand(-73, 55));
    await wait(300);
    const jumped = await call('/work/start', { employer: 'apapa-port' }, ada.token);
    check('online: someone who appears at the workplace in a jump is not believed to be there for a while', !jumped.ok && /cannot see where you are/.test(jumped.reason), jumped);
    const hold = setInterval(() => a.send(stand(-73, 55)), 500);
    await wait(10_500);
    clearInterval(hold);
    const started = await call('/work/start', { employer: 'apapa-port' }, ada.token);
    const tooSoon = await call('/work/finish', { shift: started.shift, idem: idem() }, ada.token);
    check('online: at the loading bay the shift starts, and finishing it at once is refused as faster than anyone could', started.ok && !tooSoon.ok && /faster/.test(tooSoon.reason), { started, tooSoon });
    // Keep telling the server where Ada is while she works (the game does this ten times a second)
    const beat = setInterval(() => a.send(stand(-73, 55)), 500);
    await wait(12_500);
    clearInterval(beat);
    a.send(stand(-73, 55));
    await wait(200);
    const before = (await call('/me', null, ada.token)).wallet.cash;
    const finishKey = idem();
    const paid = await call('/work/finish', { shift: started.shift, idem: finishKey }, ada.token);
    const paidAgain = await call('/work/finish', { shift: started.shift, idem: finishKey }, ada.token);
    const after = (await call('/me', null, ada.token)).wallet.cash;
    const pushed = a.got.filter((m) => m.type === 'wallet').pop();
    check('online: after a real 12 s at the bay the server pays the casual hand rate (₦6,000) once, and tells the game the new balance', paid.ok && paid.pay === 6000 && after - before === 6000 && paidAgain.ok && paidAgain.replay && pushed?.wallet.cash === after, { paid, paidAgain, before, after, pushed });

    // Seeing each other: only those near
    b.send(stand(-70, 50));
    await wait(400);
    const seesBayo = a.got.some((m) => m.type === 'state' && m.player.id === bayo.account.id);
    const bayoState = a.got.filter((m) => m.type === 'state' && m.player.id === bayo.account.id).pop();
    b.send(stand(300, 300));
    await wait(400);
    const lostBayo = a.got.some((m) => m.type === 'leave' && m.id === bayo.account.id);
    check('online: a player near sees the other, under the server\'s id and name, and is told when they go out of sight', seesBayo && bayoState?.player.name === 'Bayo script' && lostBayo, { seesBayo, name: bayoState?.player.name, lostBayo });

    // Chat: filtered, slowed, blockable
    b.send(stand(-70, 50));
    await wait(300);
    b.send({ type: 'chat', message: { text: 'you be ashawo', id: 'c1' } });
    await wait(300);
    const rude = a.got.filter((m) => m.type === 'chat').pop();
    for (let i = 0; i < 5; i++) b.send({ type: 'chat', message: { text: `hello ${i}`, id: `s${i}` } });
    await wait(300);
    const refused = b.got.some((m) => m.type === 'refused' && m.what === 'chat');
    await call('/social/block', { id: bayo.account.id }, ada.token);
    const heardBefore = a.got.filter((m) => m.type === 'chat').length;
    await wait(6500);
    b.send({ type: 'chat', message: { text: 'are you there', id: 'c9' } });
    b.send({ type: 'dm', toId: ada.account.id, text: 'private hello' });
    await wait(400);
    const heardAfter = a.got.filter((m) => m.type === 'chat' || m.type === 'dm').length - heardBefore;
    check('online: an insult is masked before anyone sees it, a flood is slowed down, and someone blocked is not heard at all', rude && /\*{3}/.test(rude.message.text) && !/ashawo/.test(rude.message.text) && refused && heardAfter === 0, { rude: rude?.message.text, refused, heardAfter });

    // Money between players only through the server
    b.send({ type: 'p2p_transfer', transfer: { id: 'x', senderId: bayo.account.id, recipientId: ada.account.id, amount: 5_000_000, memo: 'free' } });
    await wait(300);
    const noPeerMoney = b.got.some((m) => m.type === 'refused' && m.what === 'p2p_transfer');
    const adaCash = (await call('/me', null, ada.token)).wallet;
    const sent = await call('/money/send', { to: ada.account.id, amount: 1000, from: 'bank', into: 'bank', memo: 'for suya', idem: idem() }, bayo.token);
    const adaAfter = (await call('/me', null, ada.token)).wallet;
    check('online: money passed player to player directly is refused; sent through the server it moves once, from one to the other', noPeerMoney && sent.ok && sent.wallet.bank === 149000 && adaAfter.bank - adaCash.bank === 1000, { noPeerMoney, sent: sent.wallet, ada: adaAfter });

    // Keeping progress: a guest adds an email and stays the same account
    const link = await call('/auth/email', { email: 'ada@example.com' }, ada.token);
    const token = new URL(link.devLink).searchParams.get('signin');
    const finished = await call('/auth/finish', { token });
    const reused = await call('/auth/finish', { token });
    check('online: a guest who adds an email keeps the same account and money, now verified; the link works once', finished.ok && finished.upgraded && finished.account.id === ada.account.id && finished.account.verified && finished.wallet.cash === after && !reused.ok, { finished, reused });

    // Admin
    const refusedAdmin = await call('/admin/stats');
    const stats = await call('/admin/stats', null, null, ADMIN);
    const ledger = await call(`/admin/ledger?id=${ada.account.id}`, null, null, ADMIN);
    const alerts = stats.economy?.alerts?.map((x) => x.kind) ?? [];
    check('online: the admin API needs the key, counts verified accounts apart, and shows each ledger row with whether the server checked it', refusedAdmin.status === 403 && stats.accounts.verified === 1 && stats.accounts.all === 2 && ledger.ledger.some((l) => l.kind === 'shift' && l.verified === 1) && ledger.ledger.some((l) => l.kind === 'client' && l.verified === 0), { verified: stats.accounts, kinds: ledger.ledger.map((l) => l.kind) });
    check('online: the held billion and the too-fast shift were raised as alerts', alerts.includes('earning-held') && alerts.includes('shift-too-fast'), alerts);
    // An honest big sale held the same way is paid once when the admin releases it
    const sale = await call('/money/report', { cash: 250000, memo: 'Sold a plot', idem: idem() }, bayo.token);
    const bayoBefore = (await call('/me', null, bayo.token)).wallet.cash;
    const released = await call('/admin/held', { held: sale.held, release: true }, null, ADMIN);
    const releasedAgain = await call('/admin/held', { held: sale.held, release: true }, null, ADMIN);
    const bayoAfter = (await call('/me', null, bayo.token)).wallet.cash;
    check('online: held money the admin releases is paid once', sale.held > 0 && released.ok && !releasedAgain.ok && bayoAfter - bayoBefore === 250000, { sale, bayoBefore, bayoAfter });

    // Business takings: paid at once to someone who owns the business, as far as it could have
    // taken; held for anybody who owns nothing; and takings held earlier let through with them
    const chi = await call('/auth/guest', { name: 'Chi' });
    const regId = `net:${'00000000-0000-4000-8000-'}${Date.now().toString(16).padStart(12, '0').slice(-12)}`;
    await call('/me/registry', { id: regId }, chi.token);
    const heldBefore = await call('/money/report', { bank: 200000, memo: 'BUSINESS_INCOME: Lagos Enterprise Profit Payout', idem: idem() }, chi.token);
    const lock = await call('/lock', { client: 'test' });
    const doc = JSON.parse(lock.text || '{}');
    doc.titles = { ...(doc.titles ?? {}), 'business:biz_pos_kiosk': { ownerId: regId } };
    await call('/commit', { token: lock.token, text: JSON.stringify(doc) });
    const chiBefore = (await call('/me', null, chi.token)).wallet;
    const takings = await call('/money/report', { bank: 180000, memo: 'BUSINESS_INCOME: Lagos Enterprise Profit Payout', idem: idem() }, chi.token);
    const chiAfter = (await call('/me', null, chi.token)).wallet;
    const greedy = await call('/money/report', { bank: 5_000_000_000, memo: 'BUSINESS_INCOME: Lagos Enterprise Profit Payout', idem: idem() }, chi.token);
    const nobody = await call('/money/report', { bank: 180000, memo: 'BUSINESS_INCOME: Lagos Enterprise Profit Payout', idem: idem() }, ada.token);
    check('online: business takings are paid at once to the owner of a business, up to what it could have taken, and takings held before are let through with them; ₦5bn from a POS kiosk is held, and takings for someone who owns no business are held',
      heldBefore.held > 0 && takings.ok && chiAfter.bank + chiAfter.cash - chiBefore.bank - chiBefore.cash === 380000 && !greedy.ok && greedy.held > 0 && !nobody.ok && nobody.held > 0,
      { heldBefore: heldBefore.held, takings: takings.ok, gained: chiAfter.bank + chiAfter.cash - chiBefore.bank - chiBefore.cash, greedy: greedy.held, nobody: nobody.held });
    await call('/admin/mute', { id: bayo.account.id, minutes: 5 }, null, ADMIN);
    b.send({ type: 'chat', message: { text: 'can you hear me', id: 'm1' } });
    await wait(300);
    check('online: a player muted from the admin page cannot chat', b.got.some((m) => m.type === 'refused' && /muted/.test(m.reason)));

    a.ws.close();
    b.ws.close();
  } finally {
    child.kill();
  }
}
