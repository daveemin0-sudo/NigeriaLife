// A meal bought in one of the places is seen being eaten: the player sits, a plate of it is put
// down in front of them, they eat from it (hand to mouth), it is paid for once, hunger goes up,
// and the plate is cleared when they are done. A drink comes with its bottle.
import { open, newPlayer, closeDialogs, advance, wait, playUntil, money } from './lib.mjs';

const enter = async (page, key) => {
  await page.evaluate((k) => {
    const g = window.game;
    const card = g.world.interactiveObjects.find((o) => o.id === `roadside-${k}`);
    g.player.stopMoving();
    g.player.mesh.position.set(card.interactionPoint.x, 0, card.interactionPoint.z);
    g.hud.showInteractionCard(card);
    document.getElementById('card-action-btn')?.click();
  }, key);
  await playUntil(page, () => (window.game.world.interiorManager.currentInterior && !window.game.world.interiorManager.isTransitioning ? true : null), 20);
  await advance(page, 0.5);
};
const order = async (page, id, choice) => {
  await closeDialogs(page);
  await page.evaluate((cid) => {
    const g = window.game;
    const o = g.world.interiorManager.getActiveInteractiveObjects().find((x) => x.id === cid);
    g.player.stopMoving();
    g.player.mesh.position.set(o.interactionPoint.x, 0, o.interactionPoint.z);
    g.hud.showInteractionCard(o);
    document.getElementById('card-action-btn')?.click();
  }, id);
  await wait(300);
  await page.evaluate((t) => [...document.querySelectorAll('#game-dialogue-overlay button')].find((b) => b.textContent.includes(t))?.click(), choice);
};
/** The plate on the table, where it is against the player, and what is on it */
const plate = (page) => page.evaluate(() => {
  const g = window.game;
  const room = g.world.interiorManager.places.find((p) => p.def === g.world.interiorManager.currentInterior);
  let found = null;
  room?.group.traverse((o) => {
    if (o.name !== 'served meal') return;
    const w = o.getWorldPosition(new g.modules.THREE.Vector3());
    found = { away: +Math.hypot(w.x - g.player.position.x, w.z - g.player.position.z).toFixed(2), y: +w.y.toFixed(2), parts: o.children.length };
  });
  return found;
});

export async function run(browser, check) {
  const ctx = await newPlayer(browser);
  const { page, log } = await open(ctx);
  await closeDialogs(page);
  await page.evaluate(() => { const g = window.game; g.hud.backend.data.walletCash += 100_000; g.hud.backend.modifyNeed('hunger', -60); g.hud.backend.saveData(); g.world.skyEnvironment.setHour(13); });

  await enter(page, 'eko-grand-hotel');
  const m0 = await money(page);
  const h0 = await page.evaluate(() => window.game.hud.backend.getData().stats.hunger);
  await order(page, 'place_eko-grand-hotel_restaurant', 'Seafood okra');
  const eating = await playUntil(page, () => (window.game.player.actor.pose.arms === 'eat' && window.game.player.actor.pose.legs === 'sit' ? true : null), 15);
  await advance(page, 0.5);
  const onTable = await plate(page);
  const mid = await money(page);
  await playUntil(page, () => (window.game.player.actor.sequence ? null : true), 20);
  const cleared = await plate(page);
  const m1 = await money(page);
  const h1 = await page.evaluate(() => window.game.hud.backend.getData().stats.hunger);
  check('eating: the okra soup at the Eko Grand is eaten sitting at the table from a plate put down in front of the player, hand to mouth; paid once at the end, hunger up, the plate cleared after',
    !!eating && onTable && onTable.away < 0.8 && onTable.y > 0.6 && onTable.y < 0.95 && mid.total === m0.total && m0.total - m1.total === 18_000 && h1 > h0 + 40 && !cleared,
    { eating, onTable, paidBefore: m0.total - mid.total, paid: m0.total - m1.total, h0, h1, cleared });
  await page.evaluate(() => { const g = window.game; g.world.interiorManager.exitCurrentInterior(g.player, g.cameraManager, g.hud, g.world); });
  await wait(1500);

  // A drink comes with its bottle
  await enter(page, 'shopwell-mall');
  await order(page, 'place_shopwell-mall_food', 'Shawarma and a Coke');
  await playUntil(page, () => (window.game.player.actor.pose.arms === 'eat' ? true : null), 15);
  await advance(page, 0.5);
  const shawarma = await plate(page);
  check('eating: shawarma and a Coke at the mall food court: the plate and the bottle with it', shawarma && shawarma.parts === 3, shawarma);
  await playUntil(page, () => (window.game.player.actor.sequence ? null : true), 20);

  check('eating: no errors in the page', log.errors.length === 0, log.errors.slice(0, 5));
  await ctx.close();
}
