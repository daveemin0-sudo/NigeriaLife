// The places along the expressway are gone into: each has its own room with people working in
// it and stations where the player does what is done there, acted out, paid once, the goods in
// the bag; and the way out leads back to the door on the road.
import { open, newPlayer, closeDialogs, advance, wait, playUntil, money } from './lib.mjs';

const KEYS = ['balogun-market', 'amala-shitta', 'marina-towers', 'freedom-park', 'ivory-rooftop', 'the-library', 'i-fitness', 'lekki-conservation', 'dangote-refinery', 'radio-house', 'viewing-centre', 'polling-unit', 'afrika-shrine', 'redemption-cathedral', 'central-mosque', 'sankofa-motors', 'shopwell-mall', 'eko-grand-hotel', 'police-command', 'efcc-office', 'government-house'];

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
const use = async (page, stationId, choice) => {
  await page.evaluate((id) => {
    const g = window.game;
    const o = g.world.interiorManager.getActiveInteractiveObjects().find((x) => x.id === id);
    g.player.stopMoving();
    g.player.mesh.position.set(o.interactionPoint.x, 0, o.interactionPoint.z);
    g.hud.showInteractionCard(o);
    document.getElementById('card-action-btn')?.click();
  }, stationId);
  await wait(300);
  await page.evaluate((t) => [...document.querySelectorAll('#game-dialogue-overlay button')].find((b) => b.textContent.includes(t))?.click(), choice);
  await playUntil(page, () => (window.game.player.actor.sequence ? null : true), 25);
  await advance(page, 0.5);
};
const leave = (page) => page.evaluate(() => { const g = window.game; return g.world.interiorManager.exitCurrentInterior(g.player, g.cameraManager, g.hud, g.world); });

export async function run(browser, check) {
  const ctx = await newPlayer(browser);
  const { page, log } = await open(ctx);
  await closeDialogs(page);
  await page.evaluate(() => { const be = window.game.hud.backend; be.data.walletCash += 300000; be.saveData(); window.game.world.skyEnvironment.setHour(13); });

  const cards = await page.evaluate((keys) => keys.map((k) => { const ok = window.game.modules ? true : true; return { k, label: (window.game.world.interactiveObjects.find((o) => o.id === `roadside-${k}`) ? 'card' : null) }; }), KEYS);
  const labels = await page.evaluate((keys) => {
    const g = window.game;
    return keys.map((k) => { const o = g.world.interactiveObjects.find((x) => x.id === `roadside-${k}`); g.hud.showInteractionCard(o); return document.getElementById('card-action-btn')?.textContent ?? ''; });
  }, KEYS);
  await page.evaluate(() => window.game.hud.hideInteractionCard());
  check('insides: every place along the road offers to go inside', cards.every((c) => c.label) && labels.every((l) => /Go inside/.test(l)), { labels });

  // ------------------------------------------------------------------ The market
  const inMarket = await enter(page, 'balogun-market');
  const market = await page.evaluate(() => {
    const things = window.game.world.interiorManager.getActiveInteractiveObjects();
    return { stalls: things.filter((o) => o.id.startsWith('place_balogun-market_')).length, sellers: things.filter((o) => o.id.startsWith('interior_npc_')).length };
  });
  check('insides: through the door is Balogun Market itself: stalls of pepper, rice, yam, meat, fish, spices, oil, cloth and goats, each with its seller', inMarket === 'Balogun Market' && market.stalls === 9 && market.sellers === 9, { inMarket, market });

  const m0 = await money(page);
  const bag0 = await page.evaluate(() => window.game.hud.backend.getData().inventory.find((i) => i.id === 'mkt_goat')?.quantity ?? 0);
  await use(page, 'place_balogun-market_goats', 'A goat');
  const m1 = await money(page);
  const bag1 = await page.evaluate(() => window.game.hud.backend.getData().inventory.find((i) => i.id === 'mkt_goat')?.quantity ?? 0);
  await use(page, 'place_balogun-market_pepper', 'paint bucket of tomatoes');
  const m2 = await money(page);
  const tomatoes = await page.evaluate(() => window.game.hud.backend.getData().inventory.some((i) => i.id === 'mkt_tomato'));
  check('insides: a goat is bought from Baba Sule (₦90,000, once) and goes into the bag; tomatoes from Mama Bisi too', m0.total - m1.total === 90000 && bag1 === bag0 + 1 && m1.total - m2.total === 8000 && tomatoes, { goat: m0.total - m1.total, bag: [bag0, bag1], tomatoes: m1.total - m2.total });

  await leave(page);
  await wait(1200);
  const out = await page.evaluate(() => { const g = window.game; const c = g.world.interactiveObjects.find((o) => o.id === 'roadside-balogun-market'); return { inside: g.world.interiorManager.isPlayerInside(), away: +Math.hypot(g.player.position.x - c.interactionPoint.x, g.player.position.z - c.interactionPoint.z).toFixed(1) }; });
  check('insides: the way out leads back to the market\'s door on the road', !out.inside && out.away < 2, out);

  // ------------------------------------------------------------------ Amala Shitta
  await enter(page, 'amala-shitta');
  await page.evaluate(() => window.game.hud.backend.modifyNeed('hunger', -60));
  const h0 = await page.evaluate(() => window.game.hud.backend.getData().stats.hunger);
  const m3 = await money(page);
  let sat = false;
  await page.evaluate(() => {
    const g = window.game;
    const o = g.world.interiorManager.getActiveInteractiveObjects().find((x) => x.id === 'place_amala-shitta_counter');
    g.player.mesh.position.set(o.interactionPoint.x, 0, o.interactionPoint.z);
    g.hud.showInteractionCard(o);
    document.getElementById('card-action-btn')?.click();
  });
  await wait(300);
  await page.evaluate(() => [...document.querySelectorAll('#game-dialogue-overlay button')].find((b) => b.textContent.includes('assorted meat'))?.click());
  sat = !!(await playUntil(page, () => (window.game.player.actor.pose?.legs === 'sit' ? true : null), 15));
  await playUntil(page, () => (window.game.player.actor.sequence ? null : true), 25);
  await advance(page, 0.5);
  const h1 = await page.evaluate(() => window.game.hud.backend.getData().stats.hunger);
  const m4 = await money(page);
  check('insides: at Amala Shitta the player sits down to amala, ewedu, gbegiri and assorted meat: ₦4,500 once, and hunger is filled', sat && m3.total - m4.total === 4500 && h1 - h0 > 50, { sat, paid: m3.total - m4.total, hunger: [h0, h1] });
  await leave(page);
  await wait(1200);

  // ------------------------------------------------------------------ The polling unit and NIMC
  await enter(page, 'polling-unit');
  await use(page, 'place_polling-unit_nin', 'Enrol for my NIN');
  await use(page, 'place_polling-unit_inec', 'Permanent Voter Card');
  const papers = await page.evaluate(() => window.game.hud.backend.getData().inventory.filter((i) => i.category === 'document').map((i) => i.id));
  await use(page, 'place_polling-unit_ballot', 'Vote in this week');
  const ballot = await page.evaluate(() => { const el = document.getElementById('state-house'); return !!el && el.style.display !== 'none' && /Vote/.test(el.innerText); });
  check('insides: at the polling unit the player enrols for an NIN and collects a voter card (both in the bag), and the ballot box opens this week\'s ballot', papers.includes('nin_slip') && papers.includes('pvc') && ballot, { papers, ballot });
  await page.evaluate(() => window.game.stateHouse.close());
  await leave(page);
  await wait(1200);

  // ------------------------------------------------------------------ Every other place has a room of its own with something to do
  const rooms = [];
  for (const key of KEYS.filter((k) => !['balogun-market', 'amala-shitta', 'polling-unit'].includes(k))) {
    const name = await enter(page, key);
    const things = await page.evaluate((k) => window.game.world.interiorManager.getActiveInteractiveObjects().filter((o) => o.id.startsWith(`place_${k}_`)).length, key);
    rooms.push({ key, name, things });
    await leave(page);
    await wait(900);
  }
  check('insides: every other place, from Marina Towers to Government House, is a room of its own with something to do in it', rooms.every((r) => r.name && r.things >= 1), rooms.filter((r) => !r.name || r.things < 1));

  check('insides: no errors in the page', log.errors.length === 0, log.errors.slice(0, 5));
  await ctx.close();
}
