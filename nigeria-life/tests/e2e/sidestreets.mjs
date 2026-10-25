// Side streets off Ikorodu Road: Allen Avenue and Obafemi Awolowo Way, each a street of its own
// with pavements, lamps and buildings facing it, named where the player stands, and places
// along it to go into and use, each pinned on the map.
import { open, newPlayer, closeDialogs, advance, wait, playUntil, money } from './lib.mjs';

const PLACES = { 'allen-salon': 'Allen Hair & Barbing Salon', 'allen-suya': 'Mai Suya Spot', 'allen-bank': 'Eko Commercial Bank, Allen', 'awolowo-fashion': 'Awolowo Way Fashion House', 'awolowo-pharmacy': 'Awolowo Way Pharmacy', 'awolowo-school': 'Ikeja Computer School' };

const enter = async (page, key) => {
  await page.evaluate((k) => {
    const g = window.game;
    const card = g.world.interactiveObjects.find((o) => o.id === `roadside-${k}`);
    g.player.stopMoving();
    g.player.mesh.position.set(card.interactionPoint.x, 0, card.interactionPoint.z);
    g.hud.showInteractionCard(card);
    document.getElementById('card-action-btn')?.click();
  }, key);
  return playUntil(page, () => (window.game.world.interiorManager.currentInterior && !window.game.world.interiorManager.isTransitioning ? window.game.world.interiorManager.currentInterior.name : null), 20);
};
const leave = async (page) => {
  await page.evaluate(() => { const g = window.game; return g.world.interiorManager.exitCurrentInterior(g.player, g.cameraManager, g.hud, g.world); });
  await wait(1000);
};
const use = async (page, id, choice) => {
  await page.evaluate((k) => { const g = window.game; const o = g.world.interiorManager.getActiveInteractiveObjects().find((x) => x.id === k); g.player.stopMoving(); g.player.mesh.position.set(o.interactionPoint.x, 0, o.interactionPoint.z); g.hud.showInteractionCard(o); document.getElementById('card-action-btn')?.click(); }, id);
  await wait(300);
  await page.evaluate((t) => [...document.querySelectorAll('#game-dialogue-overlay button')].find((b) => b.textContent.includes(t))?.click(), choice);
  await playUntil(page, () => (window.game.player.actor.sequence ? null : true), 25);
  await advance(page, 0.4);
};

export async function run(browser, check) {
  const ctx = await newPlayer(browser);
  const { page, log } = await open(ctx);
  await closeDialogs(page);
  await page.evaluate(() => { const b = window.game.hud.backend; b.data.walletCash += 200000; b.saveData(); window.game.world.skyEnvironment.setHour(13); });

  // ------------------------------------------------------------------ The streets themselves
  const streets = await page.evaluate(() => {
    const g = window.game;
    g.player.stopMoving();
    g.player.mesh.position.set(70, 0, 4620 - 6.5);
    const allen = g.world.getDistrictAtPosition(g.player.mesh.position);
    const awolowo = g.world.getDistrictAtPosition(new g.player.position.constructor(-90, 0, 5650 + 6.5));
    const road = g.world.getDistrictAtPosition(new g.player.position.constructor(-5, 0, 4620));
    const obs = g.world.expressway.obstructions;
    // The mouth of each street is clear of the road's own buildings
    const mouth = obs.filter((o) => o.owner === 'Expressway building' && ((o.minX > 14 && o.minZ < 4630 && o.maxZ > 4610) || (o.maxX < -14 && o.minZ < 5660 && o.maxZ > 5640))).length;
    const built = obs.filter((o) => /Allen Avenue building|Obafemi Awolowo Way building/.test(o.owner)).length;
    const lamps = obs.filter((o) => /Allen Avenue lamp|Obafemi Awolowo Way lamp/.test(o.owner)).length;
    return { allen, awolowo, road, mouth, built, lamps };
  });
  await advance(page, 0.5);
  const drawn = await page.evaluate(() => { const s = window.game.scene.getObjectByName('allen-avenue'); let shown = !!s; for (let o = s; o; o = o.parent) if (!o.visible) shown = false; return shown; });
  check('streets: Allen Avenue and Obafemi Awolowo Way run off Ikorodu Road, their mouths clear, buildings and lamps down both sides, and the player on one is told its name',
    streets.allen.name === 'Allen Avenue' && streets.awolowo.name === 'Obafemi Awolowo Way' && streets.road.name === 'Ikorodu Road, Ikeja' && streets.mouth === 0 && streets.built >= 20 && streets.lamps >= 30 && drawn, { ...streets, drawn });

  // ------------------------------------------------------------------ Every place on them is gone into
  const rooms = [];
  for (const [key, name] of Object.entries(PLACES)) {
    const label = await page.evaluate((k) => { const g = window.game; const o = g.world.interactiveObjects.find((x) => x.id === `roadside-${k}`); if (!o) return null; g.hud.showInteractionCard(o); return document.getElementById('card-action-btn')?.textContent ?? ''; }, key);
    const inside = await enter(page, key);
    const things = await page.evaluate((k) => window.game.world.interiorManager.getActiveInteractiveObjects().filter((o) => o.id.startsWith(`place_${k}_`)).length, key);
    await leave(page);
    const out = await page.evaluate((k) => { const g = window.game; const o = g.world.interactiveObjects.find((x) => x.id === `roadside-${k}`); return +Math.hypot(g.player.position.x - o.interactionPoint.x, g.player.position.z - o.interactionPoint.z).toFixed(1); }, key);
    rooms.push({ key, label, inside, things, out });
  }
  const bad = rooms.filter((r) => !/Go inside/.test(r.label ?? '') || r.inside !== PLACES[r.key] || r.things < 1 || r.out > 2);
  check('streets: every place on the two streets is gone into (salon, suya spot, bank, fashion house, pharmacy, computer school), and the way out leads back to its door on the street', bad.length === 0, bad.length ? bad : rooms.map((r) => r.inside));

  // ------------------------------------------------------------------ Things done there
  await enter(page, 'allen-salon');
  const m0 = await money(page);
  await use(page, 'place_allen-salon_barber', 'A low cut');
  const m1 = await money(page);
  await leave(page);
  await enter(page, 'awolowo-school');
  const c0 = await page.evaluate(() => window.game.hud.backend.getSkills().coding ?? 1);
  await use(page, 'place_awolowo-school_class', 'A week of coding');
  const c1 = await page.evaluate(() => window.game.hud.backend.getSkills().coding ?? 1);
  const m2 = await money(page);
  await leave(page);
  check('streets: a low cut at the barber’s on Allen Avenue (₦5,000), and a week of coding at the school on Awolowo Way (₦50,000) that teaches the player something',
    m0.total - m1.total === 5000 && m1.total - m2.total === 50000 && c1 > c0, { cut: m0.total - m1.total, course: m1.total - m2.total, coding: [c0, c1] });

  // ------------------------------------------------------------------ On the map
  await page.click('#nav-btn-map');
  await wait(2000);
  const pins = await page.evaluate((keys) => { const on = [...document.querySelectorAll('.map-pin-road')].map((p) => p.dataset.place); return keys.filter((k) => !on.includes(`roadside-${k}`)); }, Object.keys(PLACES));
  check('streets: every place on the two streets has its pin on the map', pins.length === 0, { missing: pins });
  await closeDialogs(page);

  check('streets: no errors in the page', log.errors.length === 0, log.errors.slice(0, 5));
  await ctx.close();
}
