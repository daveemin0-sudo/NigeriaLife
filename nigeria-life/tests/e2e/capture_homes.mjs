// Every kind of home, from above and from the usual corner (scratch capture for the plans)
import { launch, newPlayer, wait, playUntil, advance } from './lib.mjs';
const out = process.argv[2];
const tag = process.argv[3] ?? 'homes';
const ids = (process.argv[4] ?? 'prop_mushin_room,prop_palm_view,prop_mainland_apt,prop_magodo_estate,prop_ikoyi_mansion,prop_banana_island_villa').split(',');
const browser = await launch();
const ctx = await newPlayer(browser);
const page = await ctx.newPage();
await page.setViewport({ width: 420, height: 816, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
await page.goto(process.env.GAME_URL, { waitUntil: 'load', timeout: 120000 });
await page.waitForFunction('window.game', { timeout: 120000 });
await wait(8000);
await page.evaluate(() => { document.getElementById('dialogue-confirm-btn')?.click(); window.game.world.skyEnvironment.setHour(12); });
for (const id of ids) {
  await page.evaluate((pid) => {
    const g = window.game; const data = g.hud.backend.getData();
    for (const p of data.properties) if (p.ownerId === data.id) { p.status = 'available'; p.ownerId = 'npc'; }
    const p = data.properties.find((x) => x.id === pid); p.status = 'rented'; p.ownerId = data.id;
    if (g.world.interiorManager.currentInterior) return g.world.interiorManager.exitCurrentInterior(g.player, g.cameraManager, g.hud, g.world);
  }, id);
  await playUntil(page, () => (!window.game.world.interiorManager.busy ? true : null), 20);
  await page.evaluate(() => window.game.hud.onNavigateMode('home'));
  await playUntil(page, () => (window.game.world.interiorManager.currentInterior?.type === 'residence' && !window.game.world.interiorManager.busy ? true : null), 20);
  await advance(page, 1.5);
  await wait(400);
  const info = await page.evaluate(() => { const r = window.game.world.interiorManager.residence; return { key: r.plan?.key, rooms: r.plan?.rooms.map((x) => x.name), doors: r.plan?.doors.length, carport: r.plan?.carport, toasts: [...document.querySelectorAll('.game-toast')].map((t) => t.textContent).slice(-2) }; });
  console.log(id, JSON.stringify(info));
  await page.screenshot({ path: `${out}/${tag}-${id}-corner.png` });
  await page.evaluate(() => window.game.cameraManager.setPreset('aerial'));
  await advance(page, 1.5);
  await wait(300);
  await page.screenshot({ path: `${out}/${tag}-${id}-above.png` });
  await page.evaluate(() => window.game.cameraManager.setPreset('street'));
}
await browser.close();
