// The world server: two separate browsers, standing in for two devices, share one land
// registry and see each other, through a real server process started for the test.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { wait, newPlayer, closeDialogs, money, advance, GAME_URL } from './lib.mjs';

const PORT = 8700 + Math.floor(Math.random() * 200);
const SERVER = `http://localhost:${PORT}`;

function startServer(dataDir) {
  const child = spawn(process.execPath, ['server/world-server.mjs'], { env: { ...process.env, PORT: String(PORT), NL_DATA: dataDir, NL_KEY: '' }, stdio: 'ignore' });
  return child;
}

async function serverUp(tries = 50) {
  for (let i = 0; i < tries; i++) {
    try {
      const response = await fetch(`${SERVER}/health`);
      if (response.ok) return await response.json();
    } catch {
      // not up yet
    }
    await wait(150);
  }
  return null;
}

async function join(browser, cash) {
  const ctx = await newPlayer(browser);
  const page = await ctx.newPage();
  await page.setViewport({ width: 1100, height: 700 });
  const errors = [];
  page.on('pageerror', (e) => errors.push('PAGEERR ' + e.message.slice(0, 200)));
  await page.goto(`${GAME_URL}?server=${encodeURIComponent(SERVER)}`, { waitUntil: 'load', timeout: 120000 });
  await page.waitForFunction('window.game && window.game.plotWorld', { timeout: 120000 });
  await wait(2500);
  await closeDialogs(page);
  await page.evaluate((amount) => { const b = window.game.hud.backend; b.data.bank.balance = amount; b.saveData(); }, cash);
  return { ctx, page, errors };
}

async function until(page, test, arg, tries = 50) {
  for (let i = 0; i < tries; i++) {
    const value = await page.evaluate(test, arg);
    if (value) return value;
    await wait(150);
  }
  return null;
}

export async function run(browser, check) {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nl-world-'));
  let server = startServer(dataDir);
  const up = await serverUp();
  check('the world server starts and answers', up && up.ok && up.version === 0, up);

  const A = await join(browser, 40_000_000);
  const B = await join(browser, 40_000_000);
  const a = A.page;
  const b = B.page;
  try {
    const who = async (page) => page.evaluate(() => ({ id: window.game.assetMarket.me, shared: window.game.registry.shared, connected: window.game.modules.ServerLink.get().connected, own: localStorage.getItem('nigeria_life_world_registry_v1') }));
    await until(a, () => window.game.modules.ServerLink.get().connected);
    await until(b, () => window.game.modules.ServerLink.get().connected);
    const ia = await who(a);
    const ib = await who(b);
    check('two separate browsers connect to it and are two different players, with nothing of the registry kept in either browser',
      ia.connected && ib.connected && ia.shared && ib.shared && ia.id.startsWith('net:') && ib.id.startsWith('net:') && ia.id !== ib.id && ia.own === null && ib.own === null, { a: ia.id, b: ib.id });

    // ------------------------------------------------------------------ One registry for both
    const P1 = 'lag-odunlami-w2';
    const price = await a.evaluate((id) => window.game.land.plot(id).statePrice, P1);
    let a0 = await money(a);
    const bought = await a.evaluate((id) => window.game.land.buyFromState(id), P1);
    let a1 = await money(a);
    const seen = await until(b, (id) => { const g = window.game; const owner = g.land.ownerOf(id); return owner ? { owner, name: g.assetMarket.nameOf(owner), status: g.land.status(id), board: g.plotWorld.interactiveList.find((i) => i.id === `plot_${id}`).description } : null; }, P1);
    const tooLate = await b.evaluate((id) => window.game.land.buyFromState(id), P1);
    check('land bought on one device is owned on the other: the second player sees whose it is and cannot buy it',
      bought.ok && a0.total - a1.total === price && seen && seen.owner === ia.id && seen.status === 'owned' && /OWNER:/.test(seen.board) && !tooLate.ok && /can only be bought from them/.test(tooLate.reason), { bought, seen, tooLate });

    // ------------------------------------------------------------------ Two devices, one plot, same instant
    const P2 = 'lag-martins-n2';
    const price2 = await a.evaluate((id) => window.game.land.plot(id).statePrice, P2);
    a0 = await money(a);
    let b0 = await money(b);
    const race = await Promise.all([a.evaluate((id) => window.game.land.buyFromState(id), P2), b.evaluate((id) => window.game.land.buyFromState(id), P2)]);
    await wait(500);
    a1 = await money(a);
    let b1 = await money(b);
    const owner2 = await until(a, (id) => window.game.land.ownerOf(id), P2);
    check('when both devices buy the same plot at the same instant the server lets one through: one owner, one payment',
      race.filter((r) => r.ok).length === 1 && (a0.total - a1.total) + (b0.total - b1.total) === price2 && owner2 === (race[0].ok ? ia.id : ib.id), { race, paidA: a0.total - a1.total, paidB: b0.total - b1.total });

    // ------------------------------------------------------------------ A sale between devices
    const listing = await a.evaluate((id) => window.game.assetMarket.list({ kind: 'plot', id }, 3_000_000, ''), P1);
    await until(b, (id) => (window.game.land.status(id) === 'listed' ? true : null), P1);
    const offer = await b.evaluate((id) => window.game.assetMarket.offer(id, 2_600_000), listing.listingId);
    await until(a, (id) => (window.game.assetMarket.negotiationsOn(id).length ? true : null), listing.listingId);
    a0 = await money(a);
    b0 = await money(b);
    await a.evaluate((id) => window.game.assetMarket.accept(id), offer.negotiationId);
    const passed = await until(b, (id) => (window.game.land.isMine(id) ? true : null), P1, 80);
    await until(a, () => (window.game.hud.backend.getData().transactionHistory.some((tx) => tx.type === 'ASSET_SALE') ? true : null), null, 80);
    a1 = await money(a);
    b1 = await money(b);
    check('a negotiated sale completes across devices: the buyer pays once, the seller is paid once less the fee, the title moves',
      passed && b0.total - b1.total === 2_600_000 && a1.total - a0.total === 2_548_000 && (await a.evaluate((id) => window.game.land.isMine(id), P1)) === false, { paid: b0.total - b1.total, got: a1.total - a0.total });

    // ------------------------------------------------------------------ Seeing each other
    await a.bringToFront();
    for (let i = 0; i < 8; i++) { await advance(a, 0.2); await wait(150); await advance(b, 0.2); await wait(150); }
    const presence = await until(b, () => { const g = window.game; const them = [...g.network.remotePlayers.values()][0]; return them ? { count: g.network.remotePlayers.size, name: them.name, body: !!them.actor } : null; });
    await a.evaluate(() => { const g = window.game; const id = [...g.network.remotePlayers.keys()][0]; g.network.sendDirectMessage(id, 'Are you on the island?'); });
    const dm = await until(b, () => { const c = window.game.messages.contacts().find((entry) => entry.kind === 'player' && entry.unread > 0); return c ? c.last.text : null; });
    check('the two players see each other in the city through the server, and a private message reaches the other device', presence && presence.count === 1 && presence.body && dm === 'Are you on the island?', { presence, dm });

    // ------------------------------------------------------------------ The server is gone
    server.kill();
    await wait(1200);
    a0 = await money(a);
    const P3 = 'lag-azikiwe-s2';
    const offline = await a.evaluate((id) => window.game.land.buyFromState(id), P3);
    a1 = await money(a);
    check('with the server unreachable a purchase is refused, says why, and takes no money', !offline.ok && /cannot be reached/.test(offline.reason) && a1.total === a0.total, offline);

    // ------------------------------------------------------------------ It comes back with what it knew
    server = startServer(dataDir);
    const again = await serverUp();
    const kept = await (await fetch(`${SERVER}/registry`)).json();
    const titles = JSON.parse(kept.text).titles;
    check('restarted, the server still has the registry: both plots, with their owners', again && again.version > 0 && titles[`plot:${P1}`].ownerId === ib.id && !!titles[`plot:${P2}`].ownerId, { version: again?.version });

    const back = await until(a, () => window.game.modules.ServerLink.get().connected, null, 80);
    a0 = await money(a);
    const price3 = await a.evaluate((id) => window.game.land.plot(id).statePrice, P3);
    const retry = await a.evaluate((id) => window.game.land.buyFromState(id), P3);
    a1 = await money(a);
    check('the games find the server again by themselves and carry on', back && retry.ok && a0.total - a1.total === price3, { back, retry });

    // ------------------------------------------------------------------ A change that never reaches the server is undone
    await a.setRequestInterception(true);
    const block = (request) => { if (request.url().endsWith('/commit')) request.abort(); else request.continue(); };
    a.on('request', block);
    const P4 = 'lag-kakawa-w2';
    a0 = await money(a);
    const lost = await a.evaluate((id) => window.game.land.buyFromState(id), P4);
    a1 = await money(a);
    a.off('request', block);
    await a.setRequestInterception(false);
    const unowned = await until(b, (id) => (window.game.land.ownerOf(id) === null ? true : null), P4);
    check('if the payment is taken but the server never records the purchase, the money is put back and the plot is still for sale',
      !lost.ok && a1.total === a0.total && unowned && (await a.evaluate(() => window.game.hud.backend.getData().transactionHistory.filter((tx) => tx.type === 'ASSET_PURCHASE').length)) === 2, { lost, delta: a1.total - a0.total });

    // The lock that game was holding is taken back, and the next change goes through
    await wait(5400);
    const after = await b.evaluate((id) => window.game.land.buyFromState(id), P4);
    check('a lock left held by a game that went quiet is taken back, so nobody is stuck behind it', after.ok, after);

    check('server: no page errors on either device', A.errors.length + B.errors.length === 0, [...A.errors, ...B.errors].slice(0, 5));
  } finally {
    server.kill();
    await A.ctx.close();
    await B.ctx.close();
    fs.rmSync(dataDir, { recursive: true, force: true });
  }
}
