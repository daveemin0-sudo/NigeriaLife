// The first five minutes against a real game server, with a keyboard and a mouse.
//
// A brand-new guest is not asked to register: they walk, meet Chief Alabi, are taken on by Amaka,
// lay a course and are paid ₦5,000 by the server (its own payslip, not the game's word). The page
// is loaded again at the later steps and the guide carries on. Only then are they offered an
// account; registering keeps everything (the same account, the same money, the life saved to it)
// and the server marks the guide over. A second browser that signs in to that account never
// shows the guide, not for a moment, and the account's life is not overwritten by the guest that
// browser began as. ✕ is kept by the server. With the server down the guide still runs on the
// device's word, and what happened offline is told to the server when it is back.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { wait, newPlayer, GAME_URL } from './lib.mjs';

const PORT = 9100 + Math.floor(Math.random() * 150);
const SERVER = `http://127.0.0.1:${PORT}`;
const USER = 'Wasiu';
const PASS = 'broad-street';

function startServer(dataDir) {
  const log = fs.openSync(path.join(dataDir, 'server.log'), 'a');
  return spawn(process.execPath, ['server/game-server.ts'], {
    env: { ...process.env, PORT: String(PORT), NL_DATA: dataDir, NL_DEV: '1', NL_ADMIN_KEY: 'firstfive-admin', NL_BACKUP_DIR: path.join(dataDir, 'backups') },
    stdio: ['ignore', log, log],
  });
}

function stopServer(child) {
  return new Promise((resolve) => {
    if (!child || child.exitCode !== null) return resolve();
    child.once('exit', () => resolve());
    child.kill('SIGTERM');
    setTimeout(() => {
      if (child.exitCode === null) child.kill('SIGKILL');
      resolve();
    }, 4000);
  });
}

async function serverUp(tries = 60) {
  for (let i = 0; i < tries; i++) {
    try {
      const response = await fetch(`${SERVER}/health`);
      if (response.ok) return true;
    } catch {
      // not up yet
    }
    await wait(150);
  }
  return false;
}

async function api(pathname, token, body) {
  const headers = { 'content-type': 'application/json' };
  if (token) headers.authorization = `Bearer ${token}`;
  try {
    const response = await fetch(`${SERVER}${pathname}`, { method: body === undefined ? 'GET' : 'POST', headers, body: body === undefined ? undefined : JSON.stringify(body) });
    return { status: response.status, ...(await response.json().catch(() => ({}))) };
  } catch (error) {
    return { status: 0, error: String(error).slice(0, 80) };
  }
}

async function desk(browser) {
  const ctx = await newPlayer(browser);
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e.message || e).slice(0, 200)));
  await page.setViewport({ width: 1280, height: 720 });
  await page.evaluateOnNewDocument(() => {
    window.__titleOn = true;
    window.__firstStepsOn = true;
    window.__signInOn = true;
    // Was the guide's line, or the sign-up screen, ever on this page, even for a moment?
    window.__seen = { guide: false, signIn: false };
    new MutationObserver(() => {
      if (document.getElementById('nl-first-steps')) window.__seen.guide = true;
      if (document.getElementById('nl-signin')) window.__seen.signIn = true;
    }).observe(document, { childList: true, subtree: true });
    const t = setInterval(() => { const sky = window.game?.world?.skyEnvironment; if (!sky) return; clearInterval(t); sky.setHour(10); }, 10);
  });
  const ready = async () => {
    await page.waitForFunction('window.game && window.game.hud && window.titleScreen', { timeout: 240000 });
    await page.waitForFunction(() => !document.getElementById('nl-splash'), { timeout: 240000 });
    await wait(1500);
  };
  const load = async (again = false) => {
    if (again) await page.reload({ waitUntil: 'load', timeout: 240000 });
    else await page.goto(`${GAME_URL}?server=${encodeURIComponent(SERVER)}`, { waitUntil: 'load', timeout: 240000 });
    await ready();
  };
  await load();
  const centre = (sel) => page.evaluate((s) => {
    const e = [...document.querySelectorAll(s)].find((x) => { const r = x.getBoundingClientRect(); return r.width > 0 && getComputedStyle(x).display !== 'none' && getComputedStyle(x).visibility !== 'hidden'; });
    if (!e) return null;
    const r = e.getBoundingClientRect();
    const x = r.left + r.width / 2, y = r.top + r.height / 2;
    const top = document.elementFromPoint(x, y);
    return { x, y, reachable: top === e || e.contains(top), text: e.textContent.trim().slice(0, 40) };
  }, sel);
  const click = async (sel) => {
    const c = await centre(sel);
    if (c) await page.mouse.click(c.x, c.y);
    await wait(500);
    return c;
  };
  const until = async (fn, seconds) => {
    const end = Date.now() + seconds * 1000;
    while (Date.now() < end) {
      let v = null;
      try { v = await fn(); } catch { /* the page is loading again */ }
      if (v) return v;
      await wait(300);
    }
    return null;
  };
  const guideLine = () => page.evaluate(() => {
    const e = document.getElementById('nl-first-steps');
    if (!e || getComputedStyle(e).display === 'none') return null;
    return { step: e.dataset.step, text: e.querySelector('.fs-text')?.textContent ?? '', buttons: [...e.querySelectorAll('button')].map((b) => b.textContent.trim()) };
  });
  const stepIs = (id, seconds = 12) => until(async () => ((await guideLine())?.step === id ? guideLine() : null), seconds);
  const morning = () => page.evaluate(() => window.game.world.skyEnvironment.setHour(10));
  const card = () => page.evaluate(() => { const c = document.getElementById('interaction-card'); return c && getComputedStyle(c).display !== 'none' ? { title: document.getElementById('card-title')?.textContent ?? '', action: document.getElementById('card-action-btn')?.textContent.trim() ?? '' } : null; });
  const dialogue = () => page.evaluate(() => document.getElementById('game-dialogue-overlay')?.innerText.replace(/\s+/g, ' ') ?? null);
  /** The line's own button, then the walk in real time (the server keeps its own clock), until the card is up */
  const go = async (seconds = 150) => {
    await morning();
    const pressed = await click('#nl-first-steps .fs-go, #nl-first-steps .fs-there');
    const at = await until(card, seconds);
    await wait(500);
    return { pressed, card: at };
  };
  const online = () => page.evaluate(() => {
    const o = window.game?.modules.OnlineAccount.get();
    return o?.account ? { id: o.account.id, kind: o.account.kind, name: o.account.name, token: o.authorization } : null;
  });
  const life = () => page.evaluate(() => {
    const g = window.game;
    const d = g.hud.backend.getData();
    return {
      name: d.username, cash: d.walletCash, bank: d.bank.balance, paid: d.career.completedGigs,
      steps: localStorage.getItem('nl_first_steps_v1'), elder: JSON.parse(localStorage.getItem('nl_chief_alabi_v1') || 'null'),
      seen: window.__seen, signIn: !!document.getElementById('nl-signin'),
      toasts: [...document.querySelectorAll('.game-toast')].map((t) => t.textContent).join(' | '),
    };
  });
  const title = () => page.evaluate(() => { const c = document.getElementById('title-card'); return { text: c?.innerText.replace(/\s+/g, ' ') ?? '', buttons: [...(c?.querySelectorAll('button') ?? [])].map((b) => b.textContent.trim()) }; });
  return { ctx, page, errors, load, ready, centre, click, until, guideLine, stepIs, morning, card, dialogue, go, online, life, title };
}

export async function run(browser, check) {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nl-firstfive-'));
  let server = startServer(dataDir);
  if (!(await serverUp())) {
    check('firstfive: the game server starts', false, fs.readFileSync(path.join(dataDir, 'server.log'), 'utf8').slice(-400));
    await stopServer(server);
    return;
  }
  try {
    // ================================================================ A brand-new guest, keyboard and mouse
    const a = await desk(browser);
    const guest = await a.until(a.online, 30);
    const firstTitle = await a.until(async () => { const t = await a.title(); return t.buttons.includes('I already have an account') ? t : null; }, 15) ?? await a.title();
    check('firstfive: a first visit on a game server is a guest, welcomed with "Start your life" and, beside it, "I already have an account"',
      guest?.kind === 'guest' && /Welcome/.test(firstTitle.text) && firstTitle.buttons.includes('Start your life') && firstTitle.buttons.includes('I already have an account'), { guest: guest?.kind, firstTitle });
    const startMe = await api('/me', guest?.token);
    await a.click('#title-continue');
    const first = await a.stepIs('move', 15);
    const noForm = await a.life();
    check('firstfive: Start goes straight to the street: the server says the guide is open, the line is about walking, and no sign-up screen has appeared',
      startMe.guide === 'open' && !!first && /W A S D/.test(first.text) && noForm.seen.signIn === false, { guide: startMe.guide, first, seen: noForm.seen });

    await a.page.keyboard.down('w');
    await a.until(async () => (await a.guideLine())?.step !== 'move', 30);
    await a.page.keyboard.up('w');
    const called = await a.stepIs('elder');
    const toElder = await a.go();
    await a.click('#card-action-btn');
    const asks = await a.until(a.dialogue, 20);
    const stood = await a.page.evaluate(() => { const p = window.game.player.position; return [p.x, p.z]; });
    await a.click('#dialogue-name-input');
    await a.page.type('#dialogue-name-input', USER);
    await wait(400);
    const typed = await a.page.evaluate(() => { const p = window.game.player.position; return { at: [p.x, p.z], value: document.getElementById('dialogue-name-input')?.value ?? null, open: !!document.getElementById('game-dialogue-overlay') }; });
    check('firstfive: W walks, "Take me" is clicked, and Chief Alabi asks who they are; a name with W, A and S in it is typed without the player walking off or a reply being picked',
      !!called && /Chief Alabi/.test(toElder.card?.title ?? '') && /Who are you/.test(asks ?? '') && typed.value === USER && typed.open && Math.hypot(typed.at[0] - stood[0], typed.at[1] - stood[1]) < 0.2, { called, toElder, typed, stood });
    await a.click('.dialogue-choice-btn');
    const answer = await a.until(async () => { const d = await a.dialogue(); return d && /Amaka|port/.test(d) ? d : null; }, 8);
    await a.page.keyboard.press('1');
    await wait(900);
    const roof = await a.dialogue();
    await a.page.keyboard.press('e');
    await wait(900);
    const met = await a.life();
    check('firstfive: he takes the name (it is the player\'s now), answers a respectful greeting warmly and speaks of Amaka; replies are picked with the mouse, 1 and E',
      /Wasiu\./.test(answer ?? '') && /greets well/.test(answer ?? '') && /rooms/.test(roof ?? '') && met.name === USER && met.elder?.answer === 'respect', { answer, roof, met });

    // ---------------------------------------------------------------- Taken on, the course, the server's pay
    const toSite = await a.go();
    await a.click('#card-action-btn');
    await a.until(a.dialogue, 20);
    await a.page.keyboard.press('1');
    await wait(1500);
    if (await a.dialogue()) await a.page.keyboard.press('e');
    const work = await a.stepIs('work', 15);
    const before = { site: await a.page.evaluate(() => window.game.world.landmarks.buildingSite.status()), me: await api('/me', guest?.token) };
    const toPallet = await a.go(60);
    await a.click('#card-action-btn');
    let paid = null;
    for (let s = 0; s < 420 && !paid; s += 5) {
      await a.morning();
      await wait(5000);
      const st = await a.page.evaluate(() => window.game.world.landmarks.buildingSite.status());
      if (!st.working && st.paidRuns > before.site.paidRuns) paid = st;
    }
    await wait(2500);
    const after = { site: await a.page.evaluate(() => window.game.world.landmarks.buildingSite.status()), me: await api('/me', guest?.token), tax: await api('/me/tax', guest?.token), life: await a.life() };
    const slip = after.tax.slips?.[0] ?? null;
    check('firstfive: Amaka takes them on and the course is laid: the wall has grown from 0 to 6 blocks',
      /Amaka/.test(toSite.card?.title ?? '') && !!work && /Pallet/.test(toPallet.card?.title ?? '') && before.site.inWall === 0 && !!paid && after.site.inWall === 6, { toSite, work, toPallet, before: before.site, after: after.site });
    check('firstfive: the pay is the server\'s: a ₦5,000 payslip from the Eko Mega Plaza site in the account, the server\'s wallet up by what the slip says, and the game showing the server\'s figure',
      !!slip && slip.gross === 5000 && /Eko Mega Plaza/.test(slip.employer) && after.me.wallet.cash === before.me.wallet.cash + slip.net && after.life.cash === after.me.wallet.cash && after.life.paid === 1, { slip, before: before.me.wallet, after: after.me.wallet, shown: after.life.cash });

    // ---------------------------------------------------------------- Loaded again at each of the later steps
    const eat = await a.stepIs('eat', 15);
    await wait(2500);
    await a.load(true);
    const eatTitle = await a.title();
    await a.click('#title-continue');
    const eatAgain = await a.stepIs('eat', 20);
    check('firstfive: loaded again after the pay: the title offers to continue as Wasiu and the line is still about something to eat',
      !!eat && eatTitle.buttons.includes('Continue') && /Wasiu/.test(eatTitle.text) && !!eatAgain && eatAgain.buttons.includes('Not hungry'), { eat, eatTitle, eatAgain });
    await a.click('#nl-first-steps .fs-do');
    const home = await a.stepIs('home');
    await wait(2500);
    await a.load(true);
    await a.click('#title-continue');
    const homeAgain = await a.stepIs('home', 20);
    check('firstfive: "Not hungry" is taken at its word (no meal is forced), and loaded again the line is still about a room', !!home && !!homeAgain, { home, homeAgain });
    const toEstate = await a.go();
    await a.page.evaluate(() => document.getElementById('card-close')?.click());
    await wait(400);
    await a.click('#nl-first-steps .fs-there');
    await wait(1500);
    const rooms = await a.page.evaluate(() => ({ app: window.game.hud.phoneModal.currentAppId, n: document.querySelectorAll('#property-list [data-property]').length }));
    await a.page.evaluate(() => window.game.hud.phoneModal.close());
    const keep = await a.stepIs('keep');
    await wait(2500);
    await a.load(true);
    await a.click('#title-continue');
    const keepAgain = await a.stepIs('keep', 20);
    const stillOpen = await api('/me', guest?.token);
    check('firstfive: the rooms within their means are shown from the estate, and only now, with money earned, does the line offer to keep it all: "Save my life" (still there after loading again; the server still has the guide open)',
      /Estate/.test(toEstate.card?.title ?? '') && rooms.app === 'property' && rooms.n >= 2 && !!keep && keep.buttons.includes('Save my life') && !!keepAgain && stillOpen.guide === 'open' && (await a.life()).seen.signIn === false, { rooms, keep, keepAgain, guide: stillOpen.guide });

    // ---------------------------------------------------------------- An account: everything comes with them
    const walletBefore = stillOpen.wallet;
    await a.click('#nl-first-steps .fs-do');
    const form = await a.until(() => a.page.evaluate(() => { const e = document.getElementById('nl-signin'); return e ? { text: e.innerText.replace(/\s+/g, ' ').slice(0, 200), user: document.getElementById('nl-signin-user')?.value ?? '' } : null; }), 8);
    await a.click('#nl-signin-pass');
    await a.page.type('#nl-signin-pass', PASS);
    await a.click('#nl-signin-go');
    const named = await a.until(async () => { const o = await a.online(); return o?.kind === 'password' ? o : null; }, 40);
    // "Make your look your own" opens the look editor; shutting it puts them back in the street
    await wait(1500);
    await a.page.evaluate(() => { if (window.game.hud.creatorModal.isOpen) window.game.hud.creatorModal.close(); });
    const ended = await a.until(async () => ((await a.life()).steps === 'done' ? a.life() : null), 15);
    const account = await a.until(async () => { const me = await api('/me', named?.token); return me.guide === 'done' ? me : null; }, 15);
    check('firstfive: "Save my life" opens the sign-up screen with the name they gave Chief Alabi already in it; registering makes the guest that same account, with the same money',
      !!form && form.user === USER && /Keep your life/.test(form.text) && !!named && named.id === guest?.id && named.name === USER && !!account && account.wallet.cash === walletBefore.cash && account.wallet.bank === walletBefore.bank, { form, guest: guest?.id, named, wallet: account?.wallet, walletBefore });
    check('firstfive: the guide ends there, and the server now holds it as done for the account', !!ended && (await a.guideLine()) === null && account?.guide === 'done', { ended: ended?.steps, guide: account?.guide });
    const saved = await a.until(async () => {
      const doc = (await api('/me/save', named?.token)).doc;
      let data = null;
      try { data = JSON.parse(doc?.bags?.nigeria_life_account_data_v1 ?? 'null'); } catch { /* not there yet */ }
      return data?.username === USER && data?.career?.completedGigs === 1 && doc.bags.nl_first_steps_v1 === 'done' ? { username: data.username, paid: data.career.completedGigs, steps: doc.bags.nl_first_steps_v1, elder: doc.bags.nl_chief_alabi_v1 } : null;
    }, 30);
    check('firstfive: the guest\'s whole life is in the account on the server: the name, the job done, the guide over, Chief Alabi\'s memory of them',
      !!saved && /respect/.test(saved.elder ?? ''), saved);
    check('firstfive: no errors in the page (new guest to account)', a.errors.length === 0, a.errors.slice(0, 4));
    const version = (await api('/me/save', named?.token)).version;
    await a.ctx.close();

    // ================================================================ The account on another device
    const b = await desk(browser);
    const other = await b.until(b.online, 30);
    await b.until(async () => ((await b.title()).buttons.includes('I already have an account') ? true : null), 15);
    await b.click('#title-signin');
    const login = await b.until(() => b.page.evaluate(() => { const e = document.getElementById('nl-signin'); return e ? e.innerText.replace(/\s+/g, ' ').slice(0, 120) : null; }), 8);
    await b.click('#nl-signin-user');
    await b.page.type('#nl-signin-user', USER);
    await b.click('#nl-signin-pass');
    await b.page.type('#nl-signin-pass', PASS);
    const seenBefore = await b.page.evaluate(() => window.__seen.guide);
    await b.click('#nl-signin-go');
    // Signing in loads the page again with the account's life (and may once more): wait for one that stays
    let steady = 0;
    const signedIn = await b.until(async () => {
      const o = await b.online();
      const ok = o?.kind === 'password' && o.name === USER && (await b.page.evaluate(() => !!window.titleScreen && window.game.hud.backend.getData().username)) === USER;
      steady = ok ? steady + 1 : 0;
      return steady >= 6 ? o : null;
    }, 180);
    const theirTitle = await b.title();
    check('firstfive: on another device "I already have an account" opens Sign in (the guide never having begun there); signed in, the title offers to continue as Wasiu with the account\'s money',
      other?.kind === 'guest' && other.id !== guest?.id && /Welcome back/.test(login ?? '') && seenBefore === false && !!signedIn && signedIn.id === guest?.id && theirTitle.buttons.includes('Continue') && /Wasiu/.test(theirTitle.text) && !theirTitle.buttons.includes('I already have an account'), { other: other?.kind, login, signedIn, theirTitle });
    await b.click('#title-continue');
    await wait(9000);
    const theirs = await b.life();
    const remembered = await b.page.evaluate(() => window.game.world.interactiveObjects.find((o) => o.id === 'community-elder')?.description ?? '');
    check('firstfive: there the guide never shows, not for a moment (watched from the first instant of the page), and neither does the sign-up screen; the life is theirs: paid once, known to Chief Alabi',
      theirs.seen.guide === false && theirs.seen.signIn === false && theirs.paid === 1 && theirs.name === USER && theirs.steps === 'done' && /Wasiu/.test(remembered), { theirs, remembered });
    await wait(4000);
    const kept = await api('/me/save', signedIn?.token);
    let keptData = null;
    try { keptData = JSON.parse(kept.doc?.bags?.nigeria_life_account_data_v1 ?? 'null'); } catch { /* unreadable */ }
    const keptMe = await api('/me', signedIn?.token);
    check('firstfive: the account was not overwritten by the new guest that device began as: its save still has the job done and the name, at the same or a later version, with the same money',
      keptData?.career?.completedGigs === 1 && keptData?.username === USER && kept.version >= version && keptMe.wallet.cash === account?.wallet.cash && keptMe.wallet.bank === account?.wallet.bank, { paid: keptData?.career?.completedGigs, name: keptData?.username, version: [version, kept.version], wallet: keptMe.wallet });
    check('firstfive: no errors in the page (second device)', b.errors.length === 0, b.errors.slice(0, 4));
    await b.ctx.close();

    // ================================================================ ✕ is kept by the server
    const c = await desk(browser);
    const skipper = await c.until(c.online, 30);
    await c.click('#title-continue');
    await c.stepIs('move', 15);
    await c.click('#nl-first-steps .fs-skip');
    const skippedOn = await c.until(async () => { const me = await api('/me', skipper?.token); return me.guide === 'skipped' ? me.guide : null; }, 10);
    // As on a device that has no record of it: only the server knows
    await c.page.evaluate(() => localStorage.removeItem('nl_first_steps_v1'));
    await c.load(true);
    await c.click('#title-continue');
    await wait(9000);
    const afterSkip = await c.life();
    check('firstfive: ✕ is kept by the server for the account; with this device\'s own record wiped the guide still never shows, and the device learns it was skipped',
      skippedOn === 'skipped' && afterSkip.seen.guide === false && afterSkip.steps === 'skipped', { skippedOn, afterSkip });
    // Nothing a device sends opens it again
    const reopened = await api('/me/guide', skipper?.token, { state: 'open' });
    const still = await api('/me', skipper?.token);
    check('firstfive: the server refuses to open the guide again, and a later "done" does not change how it ended', reopened.status === 400 && still.guide === 'skipped' && (await api('/me/guide', skipper?.token, { state: 'done' })).guide === 'skipped', { reopened: reopened.status, still: still.guide });
    await c.ctx.close();

    // ================================================================ The server goes away
    const d = await desk(browser);
    const lone = await d.until(d.online, 30);
    await d.click('#title-continue');
    await d.stepIs('move', 15);
    await d.page.keyboard.down('w');
    await d.until(async () => (await d.guideLine())?.step !== 'move', 30);
    await d.page.keyboard.up('w');
    const beforeDown = await d.stepIs('elder');
    await wait(2500);
    await stopServer(server);
    await d.load(true);
    await d.click('#title-continue');
    const offline = await d.stepIs('elder', 20);
    check('firstfive: with the game server down the page still loads and the guide carries on from the same step, on the device\'s own record',
      !!beforeDown && !!offline && (await api('/health')).status === 0, { beforeDown, offline });
    await d.click('#nl-first-steps .fs-skip');
    await wait(800);
    const offlineSkip = await d.life();
    server = startServer(dataDir);
    const up = await serverUp();
    const unknown = await api('/me', lone?.token);
    await d.load(true);
    const told = await d.until(async () => { const me = await api('/me', lone?.token); return me.guide === 'skipped' ? me.guide : null; }, 30);
    // A guest whose guide is over is offered an account when they come back, as before: put off, they play on
    const offered = await d.until(() => d.page.evaluate(() => !!document.getElementById('nl-signin')), 10);
    await d.click('#nl-signin-later');
    await d.click('#title-continue');
    await wait(6000);
    check('firstfive: skipped while the server was down, it is kept on the device; when the server is back (still thinking the guide open) the device tells it, and the guide does not show',
      offlineSkip.steps === 'skipped' && up && unknown.guide === 'open' && told === 'skipped' && !!offered && (await d.life()).seen.guide === false, { offlineSkip: offlineSkip.steps, up, unknown: unknown.guide, told, offered, seen: (await d.life()).seen });
    check('firstfive: no errors in the page (skip, server down)', c.errors.length + d.errors.length === 0, [...c.errors, ...d.errors].slice(0, 4));
    await d.ctx.close();
  } finally {
    await stopServer(server);
  }
}
