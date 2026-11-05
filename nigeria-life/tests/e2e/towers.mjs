// Towers built to the number of floors the owner chooses, where the zoning allows: the plot's
// Build screen says what is allowed, the floors are chosen, the cost and earnings follow the
// height, and the tower goes up floor by floor (a frame and a crane, then glass), drawn as one
// mesh however tall it is, and earns office rents when it is finished.
import { open, newPlayer, closeDialogs, wait, money } from './lib.mjs';

const PHONE = '#smartphone-wrapper';
const HOUR = 25_000;
const TALL = 'lag-kakawa-e1';
const LOW = 'lag-kakawa-w2';
const age = (page, plotId, hours) => page.evaluate(({ plotId, ms }) => window.game.registry.transact((s) => {
  const building = s.buildings[plotId];
  building.startedAt -= ms;
  if (building.collectedAt) building.collectedAt -= ms;
}), { plotId, ms: hours * HOUR });
const openApp = async (page, id, route = '') => {
  await page.evaluate(({ id, route }) => window.game.hud.phoneModal.openApp(id, route || undefined), { id, route });
  await wait(500);
};
/** The tower on the plot as drawn: its name, how tall, how many meshes */
const drawn = (page) => page.evaluate(() => {
  let found = null;
  window.game.scene.traverse((o) => { if (!found && /storey tower/.test(o.name)) found = o; });
  if (!found) return null;
  let meshes = 0;
  found.traverse((o) => { if (o.isMesh) meshes += 1; });
  let top = -Infinity;
  found.traverse((o) => {
    if (!o.isMesh) return;
    o.geometry.computeBoundingBox();
    o.updateWorldMatrix(true, false);
    const y = o.geometry.boundingBox.max.y + o.matrixWorld.elements[13];
    if (y > top) top = y;
  });
  return { name: found.name, meshes, top: Math.round(top * 10) / 10, visible: found.visible };
});

export async function run(browser, check) {
  const ctx = await newPlayer(browser);
  const { page, log } = await open(ctx);
  await closeDialogs(page);
  await page.evaluate(async ({ tall, low }) => {
    const g = window.game;
    g.hud.backend.data.bank.balance += 30_000_000_000; g.hud.backend.saveData();
    await g.land.buyFromState(tall);
    await g.land.buyFromState(low);
    const r = g.land.plot(tall).rect;
    g.player.mesh.position.set((r.minX + r.maxX) / 2 - 14, 0, (r.minZ + r.maxZ) / 2);
  }, { tall: TALL, low: LOW });

  // ------------------------------------------------------------------ The zoning
  await openApp(page, 'land', `build:${LOW}`);
  const low = await page.evaluate((p) => document.querySelector(`${p} #build-tower-zoning`)?.textContent ?? null, PHONE);
  await openApp(page, 'land', `build:${TALL}`);
  const tall = await page.evaluate((p) => ({ card: !!document.querySelector(`${p} #build-tower`), text: document.querySelector(`${p} #build-tower`)?.innerText ?? '', section: [...document.querySelectorAll(`${p} .nl-section`)].map((e) => e.textContent).find((t) => /Tower/.test(t)) }), PHONE);
  const rules = await page.evaluate(({ tall }) => ({ over: window.game.land.cannotPlace(tall, 'tower-41', 58.5, 22, 0) }), { tall: TALL });
  check('towers: a plot zoned for three floors of homes says no towers; a Lagos Island plot zoned for 40 offers a tower, and no more than 40 floors',
    /not allowed here/.test(low ?? '') && tall.card && /up to 40 floors/.test(tall.section ?? '') && /No more than 40 floors/.test(rules.over ?? ''), { low, tall, rules });

  // ------------------------------------------------------------------ Choosing the floors
  const click = (by) => page.evaluate(({ p, by }) => [...document.querySelectorAll(`${p} [data-act="tower-floors"]`)].find((b) => b.textContent.trim() === by)?.click(), { p: PHONE, by });
  await click('+5');
  await wait(300);
  await click('+5');
  await wait(300);
  const picked = await page.evaluate((p) => ({ floors: document.querySelector(`${p} #build-tower-floors`)?.textContent, button: document.querySelector(`${p} #build-tower [data-act="place"]`)?.dataset.arg, cost: document.querySelector(`${p} #build-tower [data-act="place"]`)?.textContent }), PHONE);
  check('towers: the floors are chosen with + and −: 20 floors, priced for 20 (₦7.935bn, a little more a floor above ten)', picked.floors === '20' && picked.button === `${TALL}|tower-20` && /₦7,935,000,000/.test(picked.cost ?? ''), picked);
  await closeDialogs(page);

  // ------------------------------------------------------------------ Going up, floor by floor
  const m0 = await money(page);
  const started = await page.evaluate(async (tall) => { const g = window.game; const r = g.land.plot(tall).rect; return g.land.startBuilding(tall, 'tower-20', (r.minX + r.maxX) / 2, (r.minZ + r.maxZ) / 2, 0); }, TALL);
  const m1 = await money(page);
  check('towers: work starts and the cost is taken once', started.ok && m0.total - m1.total === 7_935_000_000, { started, paid: m0.total - m1.total });

  const hours = 6 + 2 * 20;
  await age(page, TALL, hours * 0.45);
  await wait(1500);
  const early = await drawn(page);
  await age(page, TALL, hours * 0.2);
  await wait(1500);
  const later = await drawn(page);
  check('towers: the frame rises floor by floor with a tower crane above it, as one or two meshes', early && later && /frame/.test(early.name) && later.top > early.top + 20 && early.meshes <= 3, { early, later });

  await age(page, TALL, hours);
  await wait(1500);
  const done = await drawn(page);
  const status = await page.evaluate((tall) => window.game.land.status(tall), TALL);
  check('towers: finished, it stands 72 m of glass to its roof and mast, still a single mesh', status === 'developed' && done && done.name === '20-storey tower' && done.top > 72 && done.meshes <= 2, { status, done });

  // ------------------------------------------------------------------ Office rents
  await page.evaluate((tall) => window.game.land.collect(tall), TALL);
  await age(page, TALL, 24);
  const due = await page.evaluate((tall) => window.game.land.takings(tall), TALL);
  check('towers: a day of office rents on 20 floors, less running costs: about ₦67.6m', due > 66_000_000 && due < 69_000_000, { due });

  check('towers: no errors in the page', log.errors.length === 0, log.errors.slice(0, 5));
  await ctx.close();
}
