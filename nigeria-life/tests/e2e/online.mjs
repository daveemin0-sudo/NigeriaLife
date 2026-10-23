// Phase 1 end to end: the game server serves the game; two separate browsers (separate Chrome
// processes, separate storage, as two phones would be) open it at this machine's network
// address, each gets an account at once, they see each other in the street and chat, money
// edited in the browser does not survive, and a job shift at the port is checked and paid
// by the server. One of the two is a small phone screen with the processor slowed four times.
//
// Needs a built game: GAME_STATIC (default: the dist folder) is what the server serves.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { launch, newPlayer, open, closeDialogs, wait, reload } from './lib.mjs';

const PORT = 8805;
const ADMIN = 'online-admin-key';
const lanAddress = () => {
  for (const list of Object.values(os.networkInterfaces())) for (const a of list ?? []) if (a.family === 'IPv4' && !a.internal) return a.address;
  return 'localhost';
};

/** Who this game is on the server, what it shows, and whether it is connected. */
const me = (page) =>
  page.evaluate(() => {
    const g = window.game;
    const online = g.modules.OnlineAccount.get();
    const d = g.hud.backend.getData();
    return { id: online?.id ?? null, name: online?.account?.name ?? null, connected: !!online?.connected, localId: g.network.localId, cash: d.walletCash, bank: d.bank.balance, server: online?.wallet ?? null, origin: location.origin };
  });

async function until(page, test, seconds, arg) {
  const end = Date.now() + seconds * 1000;
  while (Date.now() < end) {
    const value = await page.evaluate(test, arg).catch(() => null);
    if (value) return value;
    await wait(400);
  }
  return null;
}

export async function run(_browser, check) {
  const staticDir = process.env.GAME_STATIC || path.resolve('dist');
  if (!fs.existsSync(path.join(staticDir, 'index.html'))) {
    check('online: a built game to serve (set GAME_STATIC)', false, staticDir);
    return;
  }
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nl-online-game-'));
  const server = spawn(process.execPath, ['server/game-server.ts'], { env: { ...process.env, PORT: String(PORT), NL_DATA: dataDir, NL_DEV: '1', NL_ADMIN_KEY: ADMIN, NL_STATIC: staticDir }, stdio: 'ignore' });
  const url = `http://${lanAddress()}:${PORT}/`;
  const browsers = [];
  try {
    for (let i = 0; i < 50; i++) {
      try {
        if ((await fetch(`${url}health`)).ok) break;
      } catch {}
      await wait(200);
    }

    // Two devices: separate browser processes with their own storage
    const deviceA = await launch();
    const deviceB = await launch();
    browsers.push(deviceA, deviceB);
    const { page: a, log: logA } = await open(await newPlayer(deviceA), { url });
    const ctxB = await newPlayer(deviceB);
    const pageB = await ctxB.newPage();
    // Device B is a budget phone: 360 x 740, touch, processor four times slower
    await pageB.emulate({ viewport: { width: 360, height: 740, isMobile: true, hasTouch: true, deviceScaleFactor: 2 }, userAgent: 'Mozilla/5.0 (Linux; Android 11; Infinix X657) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Mobile Safari/537.36' });
    const cdp = await pageB.createCDPSession();
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
    const loadStart = Date.now();
    await pageB.goto(url, { waitUntil: 'load', timeout: 180000 });
    await pageB.waitForFunction('window.game', { timeout: 180000 });
    const phoneFirstFrame = (Date.now() - loadStart) / 1000;
    const b = pageB;
    await closeDialogs(a);
    await closeDialogs(b);

    const signedA = await until(a, () => { const o = window.game.modules.OnlineAccount.get(); return o?.connected && o.id ? true : null; }, 30);
    const signedB = await until(b, () => { const o = window.game.modules.OnlineAccount.get(); return o?.connected && o.id ? true : null; }, 60);
    const ma = await me(a);
    const mb = await me(b);
    check(
      'online: both devices open the game from the server\'s network address and are given accounts at once, with the money the server holds',
      signedA && signedB && ma.id && mb.id && ma.id !== mb.id && ma.localId === ma.id && ma.cash === 25000 && mb.server?.cash === 25000 && ma.origin.includes(lanAddress()),
      { ma, mb }
    );
    check('online: the budget phone (360 x 740, processor slowed 4x) loads and is playing', !!signedB, { secondsToGame: +phoneFirstFrame.toFixed(1) });

    // They see each other in the street
    await a.evaluate(() => { const g = window.game; g.player.stopMoving(); g.player.mesh.position.set(-9, 0.28, -40); });
    await b.evaluate(() => { const g = window.game; g.player.stopMoving(); g.player.mesh.position.set(-7, 0.28, -38); });
    const aSeesB = await until(a, (id) => { const r = window.game.network.remotePlayers.get(id); return r ? { name: r.name, shown: r.mesh.visible && !!r.mesh.parent } : null; }, 30, mb.id);
    const bSeesA = await until(b, (id) => { const r = window.game.network.remotePlayers.get(id); return r ? { name: r.name, shown: r.mesh.visible && !!r.mesh.parent } : null; }, 60, ma.id);
    check('online: each device sees the other player standing near them, under the name the server gave them', aSeesB?.shown && bSeesA?.shown && aSeesB.name === mb.name, { aSeesB, bSeesA });

    // Chat across devices
    await a.evaluate(() => window.game.network.sendChatMessage('How far from phone A'));
    // (The chat panel starts folded away, so its text is read directly)
    const heard = await until(b, () => [...document.querySelectorAll('.chat-msg')].map((m) => m.textContent).find((t) => t.includes('How far from phone A')) || null, 30);
    check('online: a chat message from one device reaches the other, under the name the server gave the sender',!!heard && heard.includes(`${ma.name}:`), heard);

    // From the other player's card: report them (with what they said), then block them
    const cardButtons = await b.evaluate(async (id) => {
      const g = window.game;
      const rp = g.network.remotePlayers.get(id);
      const card = () => ({ mesh: rp.mesh, id: `remote_player_${id}`, name: rp.name, category: 'Online Citizen', description: '', interactionPoint: rp.mesh.position.clone() });
      g.hud.showInteractionCard(card());
      const shown = ['card-block-btn', 'card-report-btn'].map((x) => document.getElementById(x)?.style.display);
      document.getElementById('card-report-btn').click();
      await new Promise((r) => setTimeout(r, 800));
      g.hud.showInteractionCard(card());
      document.getElementById('card-block-btn').click();
      await new Promise((r) => setTimeout(r, 800));
      return shown;
    }, ma.id);
    const reports = await (await fetch(`${url}admin/reports`, { headers: { 'x-nl-admin': ADMIN } })).json();
    const report = reports.reports.find((r) => r.reported === ma.id && r.reporter === mb.id);
    await a.evaluate(() => window.game.network.sendChatMessage('Can you still hear me'));
    await wait(3000);
    const stillHeard = await b.evaluate(() => [...document.querySelectorAll('.chat-msg')].some((m) => m.textContent.includes('Can you still hear me')));
    check(
      'online: another player\'s card offers Block and Report; a report reaches the admin page with what they said, and once blocked nothing more of theirs arrives',
      cardButtons.every((d) => d === 'inline-block') && report && /How far from phone A/.test(report.context) && !stillHeard,
      { cardButtons, report, stillHeard }
    );

    // Money edited in the browser does not survive
    await a.evaluate(() => { const bk = window.game.hud.backend; bk.data.walletCash = 99_999_999; bk.saveData(); bk.spendCash(5000, 'Suya at Broad Street'); });
    const corrected = await until(a, () => { const d = window.game.hud.backend.getData(); return d.walletCash < 1_000_000 ? d.walletCash : null; }, 20);
    await reload(a);
    await closeDialogs(a);
    await until(a, () => window.game.modules.OnlineAccount.get()?.wallet || null, 30);
    const afterReload = await me(a);
    check(
      'online: ₦99,999,999 typed into the browser is gone at the next purchase (the server had ₦25,000, so ₦20,000 is left) and after a reload, on the same account',
      corrected === 20000 && afterReload.cash === 20000 && afterReload.id === ma.id,
      { corrected, afterReload }
    );

    // A job shift, checked and paid by the server
    await a.evaluate(() => { const g = window.game; g.player.stopMoving(); const f = g.world.interactiveObjects.find((o) => o.id === 'apapa-port-foreman').interactionPoint; g.player.mesh.position.set(f.x, 0, f.z); });
    // The server does not believe a jump across the city for ten seconds
    await wait(11000);
    const hired = await a.evaluate(async () => {
      const g = window.game;
      const o = g.world.interactiveObjects.find((x) => x.id === 'apapa-port-foreman');
      g.hud.showInteractionCard(o);
      document.getElementById('card-action-btn')?.click();
      await new Promise((r) => setTimeout(r, 400));
      [...document.querySelectorAll('#game-dialogue-overlay button')].find((x) => x.textContent.includes('Take the job'))?.click();
      await new Promise((r) => setTimeout(r, 400));
      document.getElementById('game-dialogue-overlay')?.remove();
      g.hud.backend.restoreEnergy(100);
      const bay = g.world.interactiveObjects.find((x) => x.id === 'apapa-port-loading-bay');
      g.hud.showInteractionCard(bay);
      document.getElementById('card-action-btn')?.click();
      return g.jobs.isEmployed('apapa-port');
    });
    const before = (await me(a)).cash;
    // Played in real time: the server times the work by its own clock
    const done = await until(a, () => (window.game.world.landmarks.status()['apapa-port'].bay === 'leaving' ? true : null), 120);
    const paid = await until(a, (start) => { const c = window.game.hud.backend.getData().walletCash; return c !== start ? c : null; }, 15, before);
    const ledger = await (await fetch(`${url}admin/ledger?id=${ma.id}`, { headers: { 'x-nl-admin': ADMIN } })).json();
    const shiftRow = ledger.ledger.find((l) => l.kind === 'shift');
    check(
      'online: a lorry loaded by hand at the port is paid ₦6,000 by the server: in the server\'s ledger as checked by the server, and shown in the game',
      hired && done && paid === before + 6000 && shiftRow?.cash_delta === 6000 && shiftRow?.verified === 1 && ledger.wallet.cash === paid,
      { hired, done, before, paid, shiftRow, server: ledger.wallet }
    );

    const adminPage = await fetch(`${url}admin`);
    const stats = await (await fetch(`${url}admin/stats`, { headers: { 'x-nl-admin': ADMIN } })).json();
    check('online: the admin page is served, and counts two players online in one Lagos instance', adminPage.ok && stats.online.players === 2 && stats.online.byInstance['lagos#1'] === 2, stats.online);
    check('online: no errors on either device', logA.errors.length === 0, logA.errors.slice(0, 5));
  } finally {
    for (const browser of browsers) await browser.close().catch(() => {});
    server.kill();
  }
}
