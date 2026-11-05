// The six needs as in Lagos Life, bladder included: its bar in the menu, a warning when it is
// pressing, the toilet at home and in every place gone into (walked to, used, flushed), the
// home cooking that fills the player up, the cars standing in the showroom, and the fonts.
import { open, newPlayer, closeDialogs, advance, wait, playUntil, enterInterior } from './lib.mjs';

const stat = (page, key) => page.evaluate((k) => window.game.hud.backend.getData().stats[k], key);
const setStat = (page, key, v) => page.evaluate(({ k, v }) => { const b = window.game.hud.backend; b.data.stats[k] = v; b.saveData(); }, { k: key, v });
const useCard = async (page, id, choice) => {
  await page.evaluate((cid) => {
    const g = window.game;
    const o = g.world.interiorManager.getActiveInteractiveObjects().find((x) => x.id === cid);
    g.player.stopMoving();
    g.player.mesh.position.set(o.interactionPoint.x, 0, o.interactionPoint.z + 2);
    g.hud.showInteractionCard(o);
    document.getElementById('card-action-btn')?.click();
  }, id);
  await wait(300);
  if (choice) await page.evaluate((t) => [...document.querySelectorAll('#game-dialogue-overlay button')].find((b) => b.textContent.includes(t))?.click(), choice);
};

export async function run(browser, check) {
  const ctx = await newPlayer(browser);
  const { page, log } = await open(ctx);
  await closeDialogs(page);

  // ------------------------------------------------------------------ The bar in the menu
  await setStat(page, 'bladder', 12);
  await page.evaluate(() => document.getElementById('top-menu-btn')?.click());
  await wait(300);
  const bars = await page.evaluate(() => [...document.querySelectorAll('.tm-need')].map((n) => n.getAttribute('title')));
  check('needs: the menu shows the six needs of Lagos Life, bladder among them, and health', ['Hunger', 'Energy', 'Fun', 'Social', 'Hygiene', 'Bladder', 'Health'].every((n) => bars.some((b) => b?.startsWith(n))), bars);
  await page.evaluate(() => document.getElementById('top-menu-btn')?.click());

  // ------------------------------------------------------------------ The warning, and the accident
  await advance(page, 2);
  const warned = await page.evaluate(() => /need the toilet/i.test(document.body.innerText));
  await setStat(page, 'bladder', 0.01);
  await setStat(page, 'hygiene', 90);
  await advance(page, 2);
  const after = { bladder: await stat(page, 'bladder'), hygiene: await stat(page, 'hygiene') };
  check('needs: when it is pressing the player is told to find a toilet; held to the end, there is an accident and hygiene is ruined',
    warned && after.bladder > 90 && after.hygiene <= 10, { warned, after });

  // ------------------------------------------------------------------ The toilet at home
  await page.evaluate(() => { const g = window.game; g.world.interiorManager.residence.constructor.standardNow = () => 'comfortable'; });
  await enterInterior(page, 'residence');
  await advance(page, 1);
  await setStat(page, 'bladder', 20);
  const toilet = await page.evaluate(() => window.game.world.interiorManager.getActiveInteractiveObjects().find((o) => /toilet/i.test(o.id) || /toilet/i.test(o.name))?.id ?? null);
  const label = await page.evaluate((id) => { const g = window.game; const o = g.world.interiorManager.getActiveInteractiveObjects().find((x) => x.id === id); g.hud.showInteractionCard(o); return document.getElementById('card-action-btn')?.textContent ?? ''; }, toilet);
  await useCard(page, toilet, 'Use the toilet');
  let sat = false;
  const done = await playUntil(page, () => {
    const a = window.game.player.actor;
    if (a.pose.legs === 'sit') window.__sat = true;
    return a.sequence ? null : true;
  }, 30);
  sat = await page.evaluate(() => !!window.__sat);
  const homeBladder = await stat(page, 'bladder');
  check('needs: at home the toilet is used: the player walks to it, sits, the flush, and the bladder is back to full', /Use the toilet/.test(label) && !!done && sat && homeBladder >= 99, { toilet, label, sat, homeBladder });

  // ------------------------------------------------------------------ Home cooking fills the player up
  await setStat(page, 'hunger', 20);
  await page.evaluate(() => { const d = window.game.modules.HouseDecorationSystem.getInstance(); for (const [x, z] of [[2, 8], [4, 8], [0, 9], [6, 3], [-3, 9]]) if (d.adopt([{ id: 'gas_cooker', x, z, turns: 0 }])) break; });
  await advance(page, 0.5);
  const stove = await page.evaluate(() => {
    const g = window.game;
    const found = g.world.interiorManager.getActiveInteractiveObjects().find((o) => { g.hud.showInteractionCard(o); return /Cook food/.test(document.getElementById('card-action-btn')?.textContent ?? ''); });
    g.hud.hideInteractionCard();
    return found?.id ?? null;
  });
  if (stove) {
    await useCard(page, stove, 'Cook Party Jollof');
    // Cooked at the stove a while, then eaten there
    await playUntil(page, () => (window.game.player.actor.pose.arms === 'reach' ? true : null), 20);
    await playUntil(page, () => (window.game.player.actor.sequence ? null : true), 30);
  }
  const fed = await stat(page, 'hunger');
  check('needs: cooking Party Jollof at home is done at the stove, eaten, and fills the hunger bar up, not down', !!stove && fed >= 75, { stove, fed });
  await page.evaluate(() => { const g = window.game; return g.world.interiorManager.exitCurrentInterior(g.player, g.cameraManager, g.hud, g.world); });
  await wait(1200);

  // ------------------------------------------------------------------ The toilet in a place, and the showroom cars
  await page.evaluate(() => {
    const g = window.game;
    const card = g.world.interactiveObjects.find((o) => o.id === 'roadside-sankofa-motors');
    g.player.stopMoving();
    g.player.mesh.position.set(card.interactionPoint.x, 0, card.interactionPoint.z);
    g.hud.showInteractionCard(card);
    document.getElementById('card-action-btn')?.click();
  });
  await playUntil(page, () => (window.game.world.interiorManager.currentInterior && !window.game.world.interiorManager.isTransitioning ? true : null), 20);
  await advance(page, 2);
  const showroom = await page.evaluate(() => {
    const room = window.game.world.interiorManager.currentInterior;
    let cars = 0;
    window.game.scene.traverse((o) => { if (/^showroom car/.test(o.name)) cars += 1; });
    return { name: room?.name, cars };
  });
  await setStat(page, 'bladder', 15);
  await useCard(page, 'toilet_sankofa-motors');
  let hidden = false;
  const out = await playUntil(page, () => {
    const a = window.game.player.actor;
    if (!a.root.visible) window.__inToilet = true;
    return a.sequence ? null : true;
  }, 30);
  hidden = await page.evaluate(() => !!window.__inToilet);
  const placeBladder = await stat(page, 'bladder');
  const shown = await page.evaluate(() => window.game.player.actor.root.visible);
  check('needs: in Sankofa Motors the toilet door by the way in is gone through, the flush heard, and the player comes out relieved',
    !!out && hidden && shown && placeBladder >= 99, { hidden, shown, placeBladder });
  check('showroom: Sankofa Motors has cars standing in it, three turning on their stands', showroom.cars >= 5, showroom);

  const spots = await page.evaluate(() => window.game.world.interiorManager.places.map((pl) => ({ key: pl.spec.key, ...pl.restroomAt })));
  const blocked = spots.filter((sp) => !sp.clear).map((sp) => sp.key);
  check(`needs: every place gone into (${spots.length}) has its toilet door on the back wall, where nothing stands in front of it`, spots.length > 40 && blocked.length === 0, { blocked });

  // ------------------------------------------------------------------ The fonts
  const fonts = await page.evaluate(async () => {
    await document.fonts.ready;
    return { display: document.fonts.check('20px "Righteous"'), name: document.fonts.check('20px "Dancing Script Variable"') };
  });
  check('fonts: the display font and the flowing font for usernames are loaded', fonts.display && fonts.name, fonts);

  check('needs: no errors in the page', log.errors.length === 0, log.errors.slice(0, 5));
  await ctx.close();
}
