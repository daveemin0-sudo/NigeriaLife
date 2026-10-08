// The saved game: damaged saves are repaired, the player resumes where they were,
// and two tabs of the same browser cannot overwrite each other.
import { open, reload, wait, money, quest, newPlayer, enterInterior } from './lib.mjs';

const SAVE_KEY = 'nigeria_life_account_data_v1';
// Writes a save before the game boots, once (so a later reload keeps what the game saved)
const seedSave = (text) => `if (!sessionStorage.getItem('seeded')) { sessionStorage.setItem('seeded', '1'); localStorage.setItem('${SAVE_KEY}', ${JSON.stringify(text)}); }`;

export async function run(browser, check) {
  // --- A healthy save written before saves had a version number
  let ctx = await newPlayer(browser);
  const legacy = {
    id: 'usr_eko_001', username: 'Ada', phoneNumber: '08023456789', walletCash: 4321,
    bank: { accountNumber: '0234891102', bankName: 'Eko Commercial Bank', balance: 98765, transactions: [] },
    stats: { health: 90, energy: 55, hunger: 44, streetCred: 33 },
    inventory: [{ id: 'gala_snack', name: 'Beef Gala Sausage Roll', category: 'food', icon: '🌭', description: '', price: 200, quantity: 5, usable: true, energyRestore: 25 }],
    businesses: [{ id: 'biz_mama_put', owned: true, pendingRevenue: 24000, level: 2, upgrades: [{ id: 'upg_cook', purchased: true }] }],
    properties: [{ id: 'prop_mainland_room', status: 'rented', ownerId: 'usr_eko_001' }],
    career: { title: 'Senior Hustler / Supervisor', rankLevel: 2, xp: 120, completedGigs: 5, bonusMultiplier: 1.25 },
    originDestiny: 'tech_bro', destinyTitle: 'Yaba Tech Bro & Startup Founder', activeHousingId: 'prop_mainland_room',
    transactionHistory: [], activeJobShift: null, createdAt: '2026-10-01T00:00:00.000Z',
  };
  let opened = await open(ctx, { before: seedSave(JSON.stringify(legacy)) });
  const old = await opened.page.evaluate(() => {
    const be = window.game.hud.backend;
    const d = be.getData();
    const biz = d.businesses.find((x) => x.id === 'biz_mama_put');
    return {
      username: d.username, cash: d.walletCash, bank: d.bank.balance, cred: d.stats.streetCred, gala: d.inventory.find((i) => i.id === 'gala_snack')?.quantity,
      items: d.inventory.length, biz: { owned: biz.owned, pending: biz.pendingRevenue, level: biz.level, cook: biz.upgrades.find((u) => u.id === 'upg_cook').purchased },
      room: d.properties.find((p) => p.id === 'prop_mainland_room').status, rank: d.career.rankLevel, destiny: d.originDestiny, housing: d.activeHousingId, notice: be.loadNotice,
    };
  });
  check('an existing save from before versioning loads unchanged, with no warning',
    old.username === 'Ada' && old.cash === 4321 && old.bank === 98765 && old.cred === 33 && old.gala === 5 && old.items === 1
      && old.biz.owned && old.biz.pending === 24000 && old.biz.level === 2 && old.biz.cook === true
      && old.room === 'rented' && old.rank === 2 && old.destiny === 'tech_bro' && old.housing === 'prop_mainland_room' && old.notice === null,
    old);
  await ctx.close();

  // --- A save with the wrong types in it
  ctx = await newPlayer(browser);
  const damaged = {
    username: 'Bayo', walletCash: 'lots', bank: { balance: null, transactions: 'none' },
    stats: { energy: 'full', hunger: null, health: -40, streetCred: 9999 }, inventory: 'bag', career: { xp: 'x' },
    businesses: [{ id: 'biz_mama_put', owned: true, pendingRevenue: 'NaN', purchasePrice: 1 }],
  };
  let { page, log } = await open(ctx, { before: seedSave(JSON.stringify(damaged)) });
  const r = await page.evaluate(() => {
    const be = window.game.hud.backend;
    const d = be.getData();
    return {
      cash: d.walletCash, bank: d.bank.balance, stats: d.stats, inventoryIsList: Array.isArray(d.inventory),
      biz: d.businesses.find((x) => x.id === 'biz_mama_put'), notice: be.loadNotice, version: d.schemaVersion,
      hudHasNaN: /NaN|undefined/.test(document.getElementById('hud-overlay').innerText),
      backup: !!localStorage.getItem('nigeria_life_account_data_v1__backup'),
    };
  });
  const numbersOk = [r.cash, r.bank, r.stats.energy, r.stats.hunger, r.stats.health, r.stats.streetCred].every((n) => typeof n === 'number' && Number.isFinite(n));
  check('a save with wrong types loads with every number valid and in range',
    numbersOk && r.inventoryIsList && r.stats.health >= 0 && r.stats.health < 1 && r.stats.streetCred === 100 && r.cash === 25000 && r.bank === 150000,
    { cash: r.cash, bank: r.bank, stats: r.stats, version: r.version });
  check('the HUD shows no NaN/undefined', r.hudHasNaN === false);
  check('valid parts of a damaged save are kept (business still owned, price taken from code)',
    r.biz.owned === true && r.biz.pendingRevenue === 0 && r.biz.purchasePrice === 180000,
    { owned: r.biz.owned, pendingRevenue: r.biz.pendingRevenue, purchasePrice: r.biz.purchasePrice });
  check('the player is told, and the original save is backed up', !!r.notice && r.backup, { notice: r.notice });
  check('damaged save: no console errors', log.errors.length === 0, log.errors.slice(0, 5));
  await ctx.close();

  // --- A save that is not readable at all
  ctx = await newPlayer(browser);
  ({ page } = await open(ctx, { before: seedSave('{"walletCash": 99999, broken') }));
  const u = await page.evaluate(() => { const be = window.game.hud.backend; return { cash: be.getData().walletCash, notice: be.loadNotice, backup: localStorage.getItem('nigeria_life_account_data_v1__backup') }; });
  check('an unreadable save starts a new game, keeps a backup and says so', u.cash === 25000 && !!u.notice && (u.backup || '').includes('broken'), u);
  await ctx.close();

  // --- Position, time of day and vitals survive a reload
  ctx = await newPlayer(browser);
  ({ page, log } = await open(ctx));
  await page.evaluate(() => {
    const g = window.game;
    g.player.mesh.position.set(31, 0, -22);
    g.player.mesh.rotation.y = 1.25;
    g.world.skyEnvironment.setHour(20.5);
    g.hud.backend.data.stats.hunger = 61.5;
    g.hud.backend.data.stats.energy = 47;
  });
  // The autosave runs every 5 s; headless start-up frames can be slow, so poll for it
  const t0 = Date.now();
  let saved = null;
  while (Date.now() - t0 < 20000) {
    saved = await page.evaluate((key) => { const raw = localStorage.getItem(key); if (!raw) return null; const d = JSON.parse(raw); return { world: d.worldState, version: d.schemaVersion, bytes: raw.length }; }, SAVE_KEY);
    if (saved && saved.world && Math.abs(saved.world.x - 31) < 0.5) break;
    await wait(500);
  }
  check('the autosave writes a versioned save holding the world state', saved && saved.version === 2 && saved.world && Math.abs(saved.world.x - 31) < 0.5 && Math.abs(saved.world.z + 22) < 0.5, saved);
  await reload(page);
  const after = await page.evaluate(() => { const g = window.game; const d = g.hud.backend.getData(); return { x: g.player.position.x, z: g.player.position.z, rot: g.player.mesh.rotation.y, hour: g.world.skyEnvironment.currentHour, hunger: d.stats.hunger, energy: d.stats.energy }; });
  check('reload restores position and facing', Math.abs(after.x - 31) < 1 && Math.abs(after.z + 22) < 1 && Math.abs(after.rot - 1.25) < 0.1, after);
  check('reload restores the time of day', Math.abs(after.hour - 20.5) < 0.6, { hour: after.hour });
  check('reload restores drained vitals', after.hunger < 62 && after.hunger > 60 && after.energy < 47.1 && after.energy > 45.5, { hunger: after.hunger, energy: after.energy });

  await page.evaluate(() => { window.game.player.mesh.position.set(-12, 0, 40); });
  await enterInterior(page, 'hospital');
  await wait(1500);
  await reload(page);
  const out = await page.evaluate(() => { const g = window.game; return { x: g.player.position.x, z: g.player.position.z, inside: g.world.interiorManager.isPlayerInside() }; });
  check('saved while indoors: reload puts the player on the street outside', !out.inside && Math.abs(out.x + 12) < 1 && Math.abs(out.z - 40) < 1, out);

  const beforeFlight = await money(page);
  await page.evaluate(() => window.game.hud.interstateModal.open('lagos'));
  await wait(500);
  await page.evaluate(() => document.querySelector('[data-dest-id="port_harcourt"]').click());
  await wait(1500);
  const inFlight = await page.evaluate(() => window.game.flightExperience.isActive);
  await reload(page);
  const landed = await page.evaluate(() => window.game.world.cityManager.currentCityId);
  const afterFlight = await money(page);
  check('reload mid-flight: the paid journey is not lost, the player resumes in Port Harcourt', inFlight && landed === 'port_harcourt' && beforeFlight.total - afterFlight.total > 0, { inFlight, landed, fare: beforeFlight.total - afterFlight.total });
  check('that arrival still counts for the Port Harcourt quest', (await quest(page, 'quest_ph_1')).obj.obj_p1_arrive === true);
  check('persistence: no console errors', log.errors.length === 0, log.errors.slice(0, 5));
  await ctx.close();

  // --- Two tabs of the same browser share one save
  ctx = await newPlayer(browser);
  const { page: A, log: logA } = await open(ctx);
  const { page: B, log: logB } = await open(ctx);
  const start = (await money(A)).total;

  await A.evaluate(() => window.game.hud.backend.addCash(1000, 'tab A earns'));
  await wait(700);
  check('tab B picks up money earned in tab A', (await money(B)).total === start + 1000);
  await B.evaluate(() => window.game.hud.backend.spendCash(400, 'tab B spends'));
  await wait(700);
  check('tab A picks up money spent in tab B', (await money(A)).total === start + 600);

  // Both tabs act in the same instant, before either has heard from the other
  await Promise.all([
    A.evaluate(() => window.game.hud.backend.addCash(250, 'A burst')),
    B.evaluate(() => window.game.hud.backend.addCash(150, 'B burst')),
  ]);
  await wait(900);
  const burst = [(await money(A)).total, (await money(B)).total];
  check('simultaneous changes in both tabs are both kept', burst[0] === start + 1000 && burst[1] === start + 1000, { expected: start + 1000, burst });

  // A transfer between the tabs moves money within one account, so the total must not change
  const idB = await B.evaluate(() => window.game.network.localId);
  await wait(500);
  const sent = await A.evaluate((to) => window.game.network.sendP2PTransfer(to, 5000, 'tab to tab'), idB);
  await wait(1000);
  const afterTransfer = [(await money(A)).total, (await money(B)).total];
  check('a tab-to-tab transfer neither creates nor destroys money', sent.success && afterTransfer[0] === start + 1000 && afterTransfer[1] === start + 1000, { expected: start + 1000, afterTransfer });

  // An owned business must pay one cycle once, not once per open tab
  await A.evaluate(() => { const be = window.game.hud.backend; be.data.bank.balance += 500000; be.buyBusiness('biz_mama_put'); });
  await wait(600);
  await A.evaluate(() => { const be = window.game.hud.backend; be.data.lastRevenueAt = Date.now() - 46000; be.saveData(); });
  await wait(6500);
  const pending = (p) => p.evaluate(() => window.game.hud.backend.getData().businesses.find((x) => x.id === 'biz_mama_put').pendingRevenue);
  const revenue = [await pending(A), await pending(B)];
  check('one business cycle is paid once across two tabs', revenue[0] === 12000 && revenue[1] === 12000, { revenue, onePayout: 12000 });

  const { page: C } = await open(ctx);
  check('a newly opened tab loads the state both tabs agree on', (await money(C)).total === (await money(A)).total);
  check('two tabs: no console errors', logA.errors.length + logB.errors.length === 0, [...logA.errors, ...logB.errors].slice(0, 5));
  await ctx.close();
}
