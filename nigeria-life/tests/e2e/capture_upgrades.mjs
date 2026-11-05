// Car upgrades from the Garage app: a stage 1 tune and a respray, then the car on the street as it now is (scratch capture)
import { launch, newPlayer, wait, advance } from './lib.mjs';
const out = process.argv[2];
const browser = await launch();
const ctx = await newPlayer(browser);
const page = await ctx.newPage();
await page.setViewport({ width: 420, height: 816, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
await page.goto(process.env.GAME_URL, { waitUntil: 'load', timeout: 120000 });
await page.waitForFunction('window.game', { timeout: 120000 });
await wait(7000);
const id = await page.evaluate(async () => {
  const g = window.game;
  document.getElementById('dialogue-confirm-btn')?.click();
  const b = g.hud.backend; b.data.bank.balance += 200_000_000; b.saveData();
  const made = await g.garage.buyNew('lexus_rx');
  window.__made = made;
  return made.vehicleId ?? g.garage.mine()[0]?.id;
});
await page.evaluate((id) => { const g = window.game; g.hud.phoneModal.open(); g.hud.phoneModal.openApp('garage', `car:${id}`); }, id);
await wait(800);
const before = await page.evaluate(() => document.getElementById('garage-upgrades')?.innerText ?? null);
await page.evaluate(() => document.getElementById('garage-tune-btn')?.click());
await wait(1200);
await page.evaluate(() => document.querySelector('#garage-paints [title="Ferrari red"]')?.click());
await wait(1200);
await page.screenshot({ path: `${out}/upgrades.png` });
const after = await page.evaluate((id) => {
  const g = window.game;
  const r = g.garage.record(id) ?? { upgrades: 'no record' };
  g.ownedVehicles.bringRound(id);
  g.ownedVehicles.sync();
  const v = g.world.vehicles.drivableVehicles.find((x) => x.id.includes(id));
  return { upgrades: r.upgrades, card: document.getElementById('garage-upgrades')?.innerText.slice(0, 140) ?? null, car: v ? { maxSpeed: v.config.maxSpeed, paint: v.config.paint } : null };
}, id);
const base = await page.evaluate(() => window.game.modules?.CATALOGUE_ITEMS ? null : null);
console.log(JSON.stringify({ made: await page.evaluate(() => window.__made), id, before: before?.slice(0, 120), after, base }));
await browser.close();
