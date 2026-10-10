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
    const purchases = () => a.evaluate(() => window.game.hud.backend.getData().transactionHistory.filter((tx) => tx.type === 'ASSET_PURCHASE').length);
    const purchasesBefore = await purchases();
    a0 = await money(a);
    const lost = await a.evaluate((id) => window.game.land.buyFromState(id), P4);
    a1 = await money(a);
    a.off('request', block);
    await a.setRequestInterception(false);
    const unowned = await until(b, (id) => (window.game.land.ownerOf(id) === null ? true : null), P4);
    check('if the payment is taken but the server never records the purchase, the money is put back and the plot is still for sale',
      !lost.ok && a1.total === a0.total && unowned && (await purchases()) === purchasesBefore, { lost, delta: a1.total - a0.total });

    // The lock that game was holding is taken back, and the next change goes through
    await wait(5400);
    const after = await b.evaluate((id) => window.game.land.buyFromState(id), P4);
    check('a lock left held by a game that went quiet is taken back, so nobody is stuck behind it', after.ok, after);

    // ------------------------------------------------------------------ A vehicle driven on one device is seen moving on the other
    await a.evaluate(async () => { const g = window.game; g.player.stopMoving(); g.player.mesh.position.set(10, 0, 100); await g.garage.buyNew('keke'); const car = g.garage.mine()[0]; g.ownedVehicles.bringRound(car.id); });
    const kekeId = await a.evaluate(() => window.game.garage.mine()[0].id);
    const parkedOnB = await until(b, (id) => { const v = window.game.world.vehicles.getVehicleById(`veh-own-${id}`); return v ? { x: v.mesh.position.x, z: v.mesh.position.z } : null; }, kekeId);
    await a.bringToFront();
    await a.evaluate((id) => { const g = window.game; g.enterVehicle(g.world.vehicles.getVehicleById(`veh-own-${id}`)); }, kekeId);
    await a.keyboard.down('w');
    for (let i = 0; i < 12; i++) { await advance(a, 0.4); await wait(120); await advance(b, 0.4); await wait(120); }
    const onA = await a.evaluate((id) => { const v = window.game.world.vehicles.getVehicleById(`veh-own-${id}`); return { x: v.mesh.position.x, z: v.mesh.position.z }; }, kekeId);
    const whileDriven = await b.evaluate((id) => {
      const g = window.game;
      const v = g.world.vehicles.getVehicleById(`veh-own-${id}`);
      const driver = [...g.network.remotePlayers.values()][0];
      return { x: v.mesh.position.x, z: v.mesh.position.z, busy: g.vehicleSync.driverOf(v) !== null, driverShown: driver.mesh.visible, parked: g.garage.record(id).parkedAt };
    }, kekeId);
    await a.keyboard.up('w');
    const movedOnA = Math.hypot(onA.x - parkedOnB.x, onA.z - parkedOnB.z);
    const gap = Math.hypot(whileDriven.x - onA.x, whileDriven.z - onA.z);
    check('a vehicle driven on one device is seen moving on the other, with its driver inside it, and nobody else can get in while it is driven',
      parkedOnB && movedOnA > 8 && gap < movedOnA * 0.5 && whileDriven.busy && whileDriven.driverShown === false, { movedOnA: +movedOnA.toFixed(1), gap: +gap.toFixed(1), whileDriven });
    await a.evaluate(() => window.game.exitVehicle());
    for (let i = 0; i < 4; i++) { await advance(a, 0.3); await wait(150); await advance(b, 0.3); await wait(150); }
    const afterParking = await until(b, (id) => { const g = window.game; const v = g.world.vehicles.getVehicleById(`veh-own-${id}`); const p = g.garage.record(id).parkedAt; return v && Math.hypot(v.mesh.position.x - p.x, v.mesh.position.z - p.z) < 1 && g.vehicleSync.driverOf(v) === null ? { x: p.x, z: p.z } : null; }, kekeId, 60);
    check('when the driver gets out it is parked where they left it on both devices', afterParking && Math.hypot(afterParking.x - parkedOnB.x, afterParking.z - parkedOnB.z) > 8, afterParking);

    // ------------------------------------------------------------------ Coming to a server with land and a vehicle from playing alone
    const solo = await newPlayer(browser);
    const c = await solo.newPage();
    await c.setViewport({ width: 1000, height: 700 });
    await c.goto(GAME_URL, { waitUntil: 'load', timeout: 120000 });
    await c.waitForFunction('window.game && window.game.plotWorld', { timeout: 120000 });
    await wait(2500);
    await closeDialogs(c);
    const FREE = 'lag-kakawa-e3';
    const before = await c.evaluate(async ({ free, taken }) => {
      const g = window.game;
      g.hud.backend.data.bank.balance = 40000000; g.hud.backend.saveData();
      await g.land.buyFromState(free);
      await g.land.buyFromState(taken);
      const r = g.land.plot(free).rect;
      await g.land.startBuilding(free, 'bungalow', (r.minX + r.maxX) / 2, (r.minZ + r.maxZ) / 2, 0);
      await g.garage.buyNew('okada');
      const d = g.hud.backend.getData();
      return { id: g.assetMarket.me, plots: g.land.myPlots().map((p) => p.id), plate: g.garage.mine()[0].plate, started: g.land.building(free).startedAt, money: d.walletCash + d.bank.balance };
    }, { free: FREE, taken: P2 });
    await c.goto(`${GAME_URL}?server=${encodeURIComponent(SERVER)}`, { waitUntil: 'load', timeout: 120000 });
    await c.waitForFunction('window.game && window.game.plotWorld', { timeout: 120000 });
    const carried = await until(c, () => (window.game.carried !== undefined ? window.game.carried ?? 'nothing' : null), null, 80);
    const arrived = await c.evaluate(({ free, taken }) => {
      const g = window.game;
      const d = g.hud.backend.getData();
      const local = JSON.parse(localStorage.getItem('nigeria_life_world_registry_v1'));
      return {
        id: g.assetMarket.me, mine: g.land.myPlots().map((p) => p.id), building: g.land.building(free), cars: g.garage.mine().map((v) => v.plate), takenOwner: g.land.ownerOf(taken),
        money: d.walletCash + d.bank.balance, localFree: local.titles[`plot:${free}`] ?? null, localTaken: local.titles[`plot:${taken}`]?.ownerId ?? null, localCars: Object.keys(local.vehicles).length,
      };
    }, { free: FREE, taken: P2 });
    const seenByB = await until(b, (id) => { const g = window.game; const owner = g.land.ownerOf(id); return owner && g.land.building(id) ? { owner, type: g.land.building(id).typeId } : null; }, FREE);
    check('a player who joins the server brings the land they own, the building going up on it and their vehicle, and keeps their money',
      before.id === 'local:main' && arrived.id.startsWith('net:') && carried && carried !== 'nothing' && carried.plots.join() === FREE && carried.vehicles === 1
        && arrived.mine.join() === FREE && arrived.building && arrived.building.typeId === 'bungalow' && arrived.building.startedAt === before.started
        && arrived.cars.join() === before.plate && arrived.money === before.money && seenByB && seenByB.owner === arrived.id && seenByB.type === 'bungalow', { carried, arrived: { ...arrived, building: arrived.building?.typeId } });
    check('a plot that already has an owner on the server stays behind in the browser, and what did come across is no longer there',
      carried.stayed.join() === P2 && arrived.takenOwner !== arrived.id && arrived.localTaken === 'local:main' && arrived.localFree === null && arrived.localCars === 0, { stayed: carried.stayed, localTaken: arrived.localTaken });
    await c.reload({ waitUntil: 'load', timeout: 120000 });
    await c.waitForFunction('window.game && window.game.plotWorld', { timeout: 120000 });
    const twice = await until(c, () => (window.game.carried !== undefined ? { carried: window.game.carried, plots: window.game.land.myPlots().length, cars: window.game.garage.mine().length } : null), null, 80);
    check('joining again brings nothing twice', twice && (twice.carried === null || (twice.carried.plots.length === 0 && twice.carried.vehicles === 0)) && twice.plots === 1 && twice.cars === 1, twice);
    await solo.close();

    check('server: no page errors on either device', A.errors.length + B.errors.length === 0, [...A.errors, ...B.errors].slice(0, 5));
  } finally {
    server.kill();
    await A.ctx.close();
    await B.ctx.close();
    fs.rmSync(dataDir, { recursive: true, force: true });
  }
}
