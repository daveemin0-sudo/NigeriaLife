// Home cook consumes fridge stock — kitchen loop is no longer free Party Jollof.
import { open, newPlayer, closeDialogs, wait, playUntil } from './lib.mjs';

const enterHome = async (page, id) => {
  await page.evaluate((home) => window.game.hud.onEnterInterior(`residence:${home}`), id);
  await playUntil(page, () => (window.game.world.interiorManager.currentInterior?.type === 'residence' && !window.game.world.interiorManager.busy ? true : null), 25);
  await wait(400);
};

const leave = async (page) => {
  await page.evaluate(() => {
    const g = window.game;
    return g.world.interiorManager.exitCurrentInterior(g.player, g.cameraManager, g.hud, g.world);
  });
  await playUntil(page, () => (!window.game.world.interiorManager.currentInterior && !window.game.world.interiorManager.busy ? true : null), 20);
};

export async function run(browser, check) {
  const ctx = await newPlayer(browser);
  const { page, log } = await open(ctx);
  await closeDialogs(page);

  await page.evaluate(() => {
    const be = window.game.hud.backend;
    be.performGig(5_000_000, 0, 'cookhome');
    be.rentProperty('prop_mainland_apt');
    be.addItem({ id: 'jollof', name: 'Jollof rice pack', icon: '🍛', price: 2500, category: 'food', usable: true, description: 'test', energyRestore: 20 }, 2);
    be.addItem({ id: 'gala_snack', name: 'Gala', icon: '🌭', price: 500, category: 'food', usable: true, description: 'test', energyRestore: 8 }, 1);
  });

  await enterHome(page, 'prop_mainland_apt');

  const stocked = await page.evaluate(() => {
    const fridge = window.game.modules.Fridge.get();
    const n = fridge.stockFromBag();
    return { n, contents: fridge.contents().map((c) => ({ id: c.id, q: c.quantity })) };
  });
  check('cookhome: bag food stocks the fridge', stocked.n >= 2 && stocked.contents.some((c) => c.id === 'jollof'), stocked);

  const cookResult = await page.evaluate(async () => {
    const g = window.game;
    const objs = g.world.interiorManager.getActiveInteractiveObjects();
    let found = null;
    for (const o of objs) {
      g.hud.showInteractionCard(o);
      const label = document.getElementById('card-action-btn')?.textContent || '';
      if (/Cook food/i.test(label)) {
        found = { id: o.id, label };
        break;
      }
    }
    g.hud.hideInteractionCard();
    if (!found) return { found: false, sample: objs.slice(0, 16).map((o) => ({ id: o.id, name: o.name })) };

    const o = objs.find((x) => x.id === found.id);
    g.player.stopMoving();
    g.player.mesh.position.set(o.interactionPoint.x, 0, o.interactionPoint.z);
    g.hud.showInteractionCard(o);
    document.getElementById('card-action-btn')?.click();
    await new Promise((r) => setTimeout(r, 350));
    const buttons = [...document.querySelectorAll('#game-dialogue-overlay button')].map((b) => b.textContent.replace(/\s+/g, ' ').trim());
    const cookBtn = [...document.querySelectorAll('#game-dialogue-overlay button')].find((b) => /Party Jollof/i.test(b.textContent));
    cookBtn?.click();
    for (let i = 0; i < 24; i++) await g.advance(0.5);
    const after = window.game.modules.Fridge.get().contents().map((c) => ({ id: c.id, q: c.quantity }));
    const hunger = g.hud.backend.getData().stats.hunger;
    return { found: true, buttons, after, hunger };
  });

  check('cookhome: cooker offers Party Jollof that uses fridge food',
    cookResult.found && cookResult.buttons?.some((b) => /Party Jollof|fridge/i.test(b)),
    cookResult);

  const jollofLeft = (cookResult.after || []).find((i) => i.id === 'jollof')?.q ?? 0;
  check('cookhome: cooking consumes one jollof from the fridge',
    cookResult.found && jollofLeft === 1,
    { jollofLeft, after: cookResult.after });

  await leave(page);
  check('cookhome: no page errors', log.errors.length === 0, log.errors.slice(0, 4));
}
