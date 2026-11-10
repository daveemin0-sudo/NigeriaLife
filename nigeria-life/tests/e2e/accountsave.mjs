// A life saved to the account, not to the browser.
//
// One player earns money, rents and buys homes, furnishes one, buys a car and a jet, registers
// a business and takes a course. The browser is then cleared and they sign in again, and a
// second browser signs in too. Both come back identical, standing where they left. Restarting
// the server does not lose it. Money in a save is ignored, and a jet with no payment is dropped.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { wait, newPlayer, closeDialogs, GAME_URL } from './lib.mjs';

const PORT = 8900 + Math.floor(Math.random() * 150);
const SERVER = `http://127.0.0.1:${PORT}`;
const ADMIN = 'accountsave-admin';
const USER = 'Ada_Save1';
const PASS = 'lagos-life';

function startServer(dataDir, backupDir) {
  const log = fs.openSync(path.join(dataDir, 'server.log'), 'a');
  return spawn(process.execPath, ['server/game-server.ts'], {
    env: { ...process.env, PORT: String(PORT), NL_DATA: dataDir, NL_DEV: '1', NL_ADMIN_KEY: ADMIN, NL_BACKUP_DIR: backupDir },
    stdio: ['ignore', log, log],
  });
}

function stopServer(child) {
  return new Promise((resolve) => {
    if (!child || child.exitCode !== null) return resolve();
    const done = () => resolve();
    child.once('exit', done);
    child.kill('SIGTERM');
    setTimeout(() => {
      if (child.exitCode === null) child.kill('SIGKILL');
      resolve();
    }, 4000);
  });
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

async function api(pathname, body, token, admin = false) {
  const headers = { 'content-type': 'application/json' };
  if (token) headers.authorization = `Bearer ${token}`;
  if (admin) headers['x-nl-admin'] = ADMIN;
  const response = await fetch(`${SERVER}${pathname}`, {
    method: body === undefined ? 'GET' : 'POST',
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await response.json().catch(() => ({}));
  return { status: response.status, ...data };
}

function accountOf(doc) {
  const raw = doc?.bags?.nigeria_life_account_data_v1;
  try {
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

async function openGame(browser) {
  const ctx = await newPlayer(browser);
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e.message || e).slice(0, 240)));
  await page.setViewport({ width: 1100, height: 700 });
  await page.goto(`${GAME_URL}?server=${encodeURIComponent(SERVER)}`, { waitUntil: 'load', timeout: 120000 });
  await page.waitForFunction('window.game && window.game.hud', { timeout: 120000 });
  await wait(1500);
  await closeDialogs(page);
  await page.waitForFunction(() => window.game.modules.OnlineAccount.get()?.id, { timeout: 60000 });
  return { ctx, page, errors };
}

async function signIn(page) {
  await page.evaluate((user, pass) => window.game.modules.OnlineAccount.get().login(user, pass), USER, PASS).catch(() => {});
  // Signing in reloads, and the registry id may reload once more. Wait until a page stays.
  const deadline = Date.now() + 120000;
  let last = null;
  let steady = 0;
  while (Date.now() < deadline) {
    try {
      last = await page.evaluate(async (user) => {
        const g = window.game;
        if (!g?.hud) return null;
        const online = g.modules.OnlineAccount.get();
        const state = g.hud.backend.getData().worldState;
        if (online?.account?.name !== user || online.account?.kind !== 'password' || state?.cityId !== 'abuja') {
          return { wait: true, name: online?.account?.name ?? null, kind: online?.account?.kind ?? null, city: state?.cityId ?? null };
        }
        const res = await online.request('/motors');
        await g.modules.Motors.get().syncOnline();
        return { models: (res.vehicles || []).map((v) => v.modelId), owned: g.modules.Motors.get().owned().map((v) => v.modelId) };
      }, USER);
      if (last?.owned?.includes('land_cruiser')) {
        steady += 1;
        if (steady >= 3) return;
      } else {
        steady = 0;
      }
    } catch {
      steady = 0;
      // The page is loading again
    }
    await wait(400);
  }
  throw new Error(`sign-in did not settle: ${JSON.stringify(last)}`);
}

function life() {
  const g = window.game;
  const d = g.hud.backend.getData();
  const fleet = JSON.parse(localStorage.getItem('nigeria_life_fleet_v1') || '[]');
  const wanted = (id) => id === 'note_keep' || String(id).startsWith('cert_') || String(id).startsWith('key_');
  return {
    cash: d.walletCash,
    bank: d.bank.balance,
    city: d.worldState?.cityId ?? null,
    x: Math.round(g.player.mesh.position.x * 100) / 100,
    z: Math.round(g.player.mesh.position.z * 100) / 100,
    homes: d.properties.filter((p) => p.status === 'owned' || p.status === 'rented' || p.status === 'purchased').map((p) => `${p.id}:${p.status}`).sort(),
    businesses: d.businesses.filter((b) => b.owned).map((b) => b.name).sort(),
    bag: d.inventory.map((i) => i.id).filter(wanted).sort(),
    fleet: fleet.map((c) => c.modelId).sort(),
    jet: fleet.map((c) => c.name).sort(),
    course: JSON.parse(localStorage.getItem('nl-qualifications') || '{}'),
    furniture: (() => {
      const bits = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i) || '';
        if (key.includes('placed_furniture')) bits.push(localStorage.getItem(key) || '');
      }
      return bits.join('|');
    })(),
    fridge: localStorage.getItem('nl_fridge_v1'),
    motors: g.modules.Motors.get().owned().map((v) => v.modelId).sort(),
    name: g.modules.OnlineAccount.get().account.name,
    pill: document.querySelector('#hud-cloud-status')?.textContent ?? '',
  };
}

function sameLife(a, b) {
  if (!a || !b) return false;
  const near = Math.abs(a.x - b.x) < 1.5 && Math.abs(a.z - b.z) < 1.5;
  const rest = JSON.stringify({ ...a, x: 0, z: 0, pill: '' }) === JSON.stringify({ ...b, x: 0, z: 0, pill: '' });
  return near && rest && a.city === 'abuja' && b.city === 'abuja';
}

export async function run(browser, check) {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nl-account-'));
  const backupDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nl-account-backup-'));
  let server = startServer(dataDir, backupDir);
  const contexts = [];
  try {
    const up = await serverUp();
    check('the game server starts', !!up?.ok, up);
    const day = new Date().toISOString().slice(0, 10);
    const backupFile = path.join(backupDir, `nl-${day}.sqlite`);
    check('today’s database is copied to the backup directory', fs.existsSync(backupFile) && fs.statSync(backupFile).size > 0, backupFile);

    // A save that claims money and a jet it never paid for
    const forged = await api('/auth/guest', { name: 'Forge' });
    const fakeAccount = {
      walletCash: 999_999_999,
      bank: { balance: 888_888_888 },
      businesses: [{ id: 'reg_fake', name: 'Fake Kiosk', owned: true, purchasePrice: 6_000_000 }],
      properties: [{ id: 'prop_x', name: 'Fake House', status: 'owned', purchasePrice: 350_000 }],
      inventory: [{ id: 'note_keep', name: 'Mothers letter', quantity: 1 }],
    };
    const docOf = (marker) => ({
      v: 1,
      at: Date.now(),
      bags: {
        nl_marker: marker,
        nigeria_life_fleet_v1: JSON.stringify([{ uid: 'jet-1', modelId: 'hondajet', name: 'FAKE', colour: 'white' }]),
        nigeria_life_account_data_v1: JSON.stringify(fakeAccount),
      },
    });
    const firstSave = await api('/me/save', { doc: docOf('one') }, forged.token);
    await wait(20);
    const secondSave = await api('/me/save', { doc: docOf('two') }, forged.token);
    const stored = accountOf(secondSave.doc);
    const fleet = JSON.parse(secondSave.doc?.bags?.nigeria_life_fleet_v1 || 'null');
    check('a save cannot grant itself money, a jet, a business or a house',
      firstSave.ok && secondSave.ok && secondSave.stripped && stored?.walletCash === 25_000 && stored?.bank?.balance === 150_000 && Array.isArray(fleet) && fleet.length === 0 && !stored.businesses?.some((b) => b.owned) && stored.properties?.[0]?.status === 'available' && stored.inventory?.[0]?.id === 'note_keep',
      { cash: stored?.walletCash, bank: stored?.bank?.balance, fleet, businesses: stored?.businesses, status: stored?.properties?.[0]?.status });
    const rolled = await api('/admin/save/rollback', { id: forged.account.id }, undefined, true);
    const restored = await api('/me/save', undefined, forged.token);
    check('the previous save can be put back', rolled.ok && restored.doc?.bags?.nl_marker === 'one', { rolled, marker: restored.doc?.bags?.nl_marker });

    const made = await api('/auth/register', { username: 'Del_Save1', password: PASS });
    const email = await api('/me/email', { email: 'ada@example.com', password: PASS }, made.token);
    const who = await api('/me', undefined, made.token);
    const refused = await api('/me/delete', { password: 'wrong-password' }, made.token);
    const removed = await api('/me/delete', { password: PASS }, made.token);
    const dead = await api('/auth/login', { username: 'Del_Save1', password: PASS });
    check('email can be changed, and deleting the account means it cannot be signed in to',
      email.ok && who.account?.email === 'ada@example.com' && !refused.ok && removed.ok && !dead.ok, { email, who: who.account, refused, removed, dead });

    const device = await openGame(browser);
    contexts.push(device.ctx);
    const page = device.page;

    await page.click('#hud-btn-cloud-sync');
    await page.waitForSelector('#settings-save-status', { timeout: 10000 });
    const guestPill = await page.$eval('#hud-cloud-status', (el) => el.textContent);
    const guestNote = await page.$eval('#settings-save-status', (el) => el.textContent);
    const guestPage = await page.$eval('#settings-privacy', (el) => el.textContent);
    const hasRegister = await page.$('#settings-account-register');
    check('a guest is told to sign up, on the pill and on the account page',
      guestPill === 'Guest: sign up to keep your progress' && guestNote === 'Guest: sign up to keep your progress' && /never signs up can lose everything/.test(guestPage || '') && !!hasRegister,
      { guestPill, guestNote });

    await page.setViewport({ width: 390, height: 800, isMobile: true, hasTouch: true });
    await page.evaluate(() => {
      document.querySelector('#nav-btn-phone')?.click();
      document.querySelector('[data-app="settings"]')?.click();
    });
    await page.waitForSelector('#settings-save-status', { timeout: 10000 });
    const phoneGuest = await page.$eval('#settings-save-status', (el) => el.textContent);
    check('on a phone the account page says a guest is not saved', phoneGuest === 'Guest: sign up to keep your progress', phoneGuest);
    await page.setViewport({ width: 1100, height: 700 });

    const guestId = await page.evaluate(() => window.game.modules.OnlineAccount.get().id);
    const granted = await api('/admin/grant', { id: guestId, amount: 12_000_000_000, memo: 'For the account save test' }, undefined, true);
    check('the test can pay this player on the server', granted.ok === true, granted);
    await page.waitForFunction(() => window.game.hud.backend.getData().walletCash + window.game.hud.backend.getData().bank.balance > 11_000_000_000, { timeout: 20000 });

    const jetTry = await page.evaluate(() => {
      const backend = window.game.hud.backend;
      const money = { cash: backend.getData().walletCash, bank: backend.getData().bank.balance };
      const jet = window.game.modules.Fleet.get().buy('hondajet', 'NAIJA ONE', 'white');
      return { money, jet, fleet: localStorage.getItem('nigeria_life_fleet_v1') };
    });
    check('the jet can be bought with the money on the account', jetTry.jet === null && /hondajet/.test(jetTry.fleet || ''), jetTry);

    const built = await page.evaluate(async () => {
      const g = window.game;
      const backend = g.hud.backend;
      const jet = null;
      const car = await g.modules.Motors.get().buy('land_cruiser');
      const house = backend.buyProperty('prop_mushin_room', false);
      const rent = backend.rentProperty('prop_mainland_room');
      const biz = backend.registerBusiness({ name: 'Creek Peppersoup', type: 'restaurant', cityId: 'abuja', area: 'Wuse', fee: 6000000, icon: '🍲', logo: '#0f172a', x: -150, z: 200 });
      const course = g.modules.Qualifications.get().sit('lawyer');
      backend.addItem({ id: 'note_keep', name: 'Mothers letter', icon: '✉', price: 0, category: 'document', usable: false, description: 'Kept.' });
      g.world.cityManager.switchCity('abuja', g.player, (objs) => { g.world.interactiveObjects = objs; });
      g.player.mesh.position.set(12.34, 0, -56.78);
      g.player.mesh.rotation.y = 0.4;
      window.dispatchEvent(new Event('pagehide'));
      const furn = g.modules.HouseDecorationSystem.getInstance().adopt([{ uid: 'sofa-keep', id: 'emerald_sofa', x: 1, z: 2, turns: 0 }]);
      localStorage.setItem('nl_fridge_v1', JSON.stringify([{ id: 'jollof', n: 2 }]));
      const saved = await g.modules.CloudSyncService.getInstance().pushNow();
      const id = g.modules.OnlineAccount.get().id;
      const signed = await g.modules.OnlineAccount.get().register('Ada_Save1', 'lagos-life');
      return { jet, car, house, rent, biz, course, furn, saved, signed, id, after: g.modules.OnlineAccount.get().id, kind: g.modules.OnlineAccount.get().account?.kind };
    });
    check('the guest’s homes, car, jet, business and course are bought, and signing up keeps that same account',
      built.jet === null && built.car?.ok && built.house?.success && built.rent?.success && built.biz?.success && built.course?.ok && built.furn === 1 && built.saved && built.signed?.ok && built.id === built.after && built.kind === 'password',
      built);

    await page.waitForFunction(() => document.querySelector('#hud-cloud-status')?.textContent?.startsWith('Saved to your account'), { timeout: 20000 });
    const savedPill = await page.$eval('#hud-cloud-status', (el) => el.textContent);
    await page.evaluate(() => window.game.hud.phoneModal.openApp('settings'));
    await page.waitForSelector('#settings-account-download', { timeout: 10000 });
    const actions = await page.evaluate(() => ({
      status: document.querySelector('#settings-save-status')?.textContent ?? '',
      download: !!document.querySelector('#settings-account-download'),
      out: !!document.querySelector('#settings-account-signout'),
      del: !!document.querySelector('#settings-account-delete'),
      email: !!document.querySelector('#settings-account-email-change'),
    }));
    check('the pill and the account page say the life is saved, and offer download, sign out, email and delete',
      /^Saved to your account · /.test(savedPill || '') && actions.status === savedPill && actions.download && actions.out && actions.del && actions.email,
      { savedPill, actions });

    const token = await page.evaluate(() => localStorage.getItem('nigeria_life_session'));
    const firstLife = await page.evaluate(life);
    check('the built life is standing in Abuja with the jet, the homes, the business and the certificate',
      firstLife.city === 'abuja' && Math.abs(firstLife.x - 12.34) < 1.5 && Math.abs(firstLife.z - (-56.78)) < 1.5 && firstLife.fleet.includes('hondajet') && firstLife.motors.includes('land_cruiser') && firstLife.homes.includes('prop_mushin_room:owned') && firstLife.homes.includes('prop_mainland_room:rented') && firstLife.businesses.includes('Creek Peppersoup') && firstLife.course.lawyer === 1 && firstLife.bag.includes('cert_lawyer_1') && firstLife.bag.includes('note_keep') && /sofa-keep/.test(firstLife.furniture || '') && /jollof/.test(firstLife.fridge || ''),
      firstLife);

    await page.evaluate(() => { window.game.modules.OnlineAccount.get().leaving = true; });
    await page.evaluate(async () => {
      localStorage.clear();
      sessionStorage.clear();
      const bases = await indexedDB.databases?.() ?? [];
      await Promise.all(bases.map((db) => new Promise((resolve) => {
        const req = indexedDB.deleteDatabase(db.name);
        req.onsuccess = () => resolve();
        req.onerror = () => resolve();
        req.onblocked = () => resolve();
      })));
    });
    await page.goto(`${GAME_URL}?server=${encodeURIComponent(SERVER)}`, { waitUntil: 'load', timeout: 120000 });
    await page.waitForFunction('window.game && window.game.hud', { timeout: 120000 });
    await wait(1000);
    await closeDialogs(page);
    await page.waitForFunction(() => window.game.modules.OnlineAccount.get()?.id, { timeout: 60000 });
    await signIn(page);
    const cleared = await page.evaluate(life);
    check('clearing the browser and signing in again brings the same life back', sameLife(firstLife, cleared), { first: firstLife, again: cleared, errors: device.errors.slice(0, 4) });

    await page.close();
    const second = await openGame(browser);
    contexts.push(second.ctx);
    await signIn(second.page);
    const other = await second.page.evaluate(life);
    check('signing in on a second device brings the same life, standing in the same place', sameLife(firstLife, other), { first: firstLife, second: other, errors: second.errors.slice(0, 4) });
    await second.page.close();

    await stopServer(server);
    server = startServer(dataDir, backupDir);
    const again = await serverUp();
    const kept = await api('/me/save', undefined, token);
    const keptAccount = accountOf(kept.doc);
    const keptFleet = JSON.parse(kept.doc?.bags?.nigeria_life_fleet_v1 || '[]');
    check('restarting the server keeps the account',
      !!again?.ok && kept.ok && keptAccount?.worldState?.cityId === 'abuja' && keptFleet.some((c) => c.modelId === 'hondajet') && keptAccount.businesses.some((b) => b.owned && b.name === 'Creek Peppersoup'),
      { up: !!again?.ok, city: keptAccount?.worldState?.cityId, fleet: keptFleet.map((c) => c.modelId), version: kept.version });
  } finally {
    for (const ctx of contexts) {
      try { await ctx.close(); } catch { /* already closed */ }
    }
    await stopServer(server);
  }
}
