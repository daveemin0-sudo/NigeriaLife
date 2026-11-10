// Eating uses the fridge that was opened, then the nearest real seat in that home.
// A rented flat and a built duplex, each with a fridge and a sofa the player bought
// (the ones the home did not come with). Screenshots are taken while it happens.
import { open, newPlayer, closeDialogs, wait, playUntil } from './lib.mjs';
import { mkdirSync } from 'node:fs';

const SHOTS = process.env.SHOTS || '/opt/cursor/artifacts';

const enterHome = async (page, id) => {
  await page.evaluate((home) => window.game.hud.onEnterInterior(`residence:${home}`), id);
  await playUntil(page, () => (window.game.world.interiorManager.currentInterior?.type === 'residence' && !window.game.world.interiorManager.busy ? true : null), 25);
  await wait(500);
};

const leave = async (page) => {
  await page.evaluate(() => {
    const g = window.game;
    return g.world.interiorManager.exitCurrentInterior(g.player, g.cameraManager, g.hud, g.world);
  });
  await playUntil(page, () => (!window.game.world.interiorManager.currentInterior && !window.game.world.interiorManager.busy ? true : null), 20);
};

/** Put the home's own seats and fridge away, and stand a bought fridge and sofa in the parlour. */
const bought = (page) => page.evaluate(() => {
  const decor = window.game.modules.HouseDecorationSystem.getInstance();
  for (const piece of [...decor.placed]) {
    const kind = decor.kind(piece.modelType);
    if (piece.uid === 'home_fridge' || /fridge/.test(piece.modelType) || (kind.use === 'seat' && kind.seat)) decor.putAway(piece.uid);
  }
  const fridge = decor.adopt([{ uid: 'bought_fridge', id: 'double_door_fridge', x: -2, z: 0, turns: 0 }]);
  const sofa = decor.adopt([{ uid: 'bought_sofa', id: 'sofa3_leather', x: 2.4, z: 0, turns: 2 }]);
  const placed = decor.placed.filter((p) => p.uid === 'bought_fridge' || p.uid === 'bought_sofa').map((p) => ({ uid: p.uid, x: p.x, z: p.z }));
  return { fridge, sofa, placed };
});

const local = (page) => page.evaluate(() => {
  const g = window.game;
  const o = g.world.interiorManager.residence.group.position;
  const p = g.player.position;
  const a = g.player.actor;
  return {
    x: +(p.x - o.x).toFixed(2), z: +(p.z - o.z).toFixed(2),
    arms: a.pose.arms, legs: a.pose.legs, carried: !!a.carried,
  };
});

async function eatThere(page, check, label) {
  const laid = await bought(page);
  await page.evaluate(() => {
    const sky = window.game.world.skyEnvironment;
    const power = window.game.modules.HomePower.get();
    for (let hour = 6; hour < 22; hour++) {
      sky.setHour(hour);
      power.tick();
      if (power.supply().any) return;
    }
  });
  const fridge = laid.placed.find((p) => p.uid === 'bought_fridge');
  const sofa = laid.placed.find((p) => p.uid === 'bought_sofa');
  await page.evaluate(() => {
    const be = window.game.hud.backend;
    const bag = be.getData().inventory.filter((i) => i.category === 'food' && i.usable && i.quantity > 0);
    if (!bag.length) be.addItem({ id: 'jollof_rice', name: 'Jollof rice', icon: '🍚', price: 1500, category: 'food', usable: true, description: 'Hot jollof.', energyRestore: 25 });
    window.game.modules.Fridge.get().stockFromBag();
  });
  const opened = await page.evaluate(() => {
    const g = window.game;
    const card = g.world.interiorManager.residence.interactiveList.find((o) => o.id === 'home_item_bought_fridge');
    document.getElementById('game-dialogue-overlay')?.remove();
    g.hud.hideInteractionCard();
    g.player.stopMoving();
    g.player.mesh.position.set(card.interactionPoint.x, g.player.mesh.position.y, card.interactionPoint.z);
    g.hud.showInteractionCard(card);
    document.getElementById('card-action-btn')?.click();
    return !!card;
  });
  const menu = await playUntil(page, () => {
    const buttons = [...document.querySelectorAll('#game-dialogue-overlay button')].map((b) => b.textContent.replace(/\s+/g, ' ').trim()).filter(Boolean);
    return buttons.length ? buttons : null;
  }, 6) ?? [];
  await page.evaluate(() => [...document.querySelectorAll('#game-dialogue-overlay button')].find((b) => /Open the fridge/.test(b.textContent))?.click());
  const foodMenu = await playUntil(page, () => {
    const buttons = [...document.querySelectorAll('#game-dialogue-overlay button')].map((b) => b.textContent.replace(/\s+/g, ' ').trim());
    return buttons.some((t) => /×/.test(t)) ? buttons : null;
  }, 6) ?? [];
  const food = await page.evaluate(() => {
    const btn = [...document.querySelectorAll('#game-dialogue-overlay button')].find((b) => /×/.test(b.textContent));
    btn?.click();
    return btn?.textContent.replace(/\s+/g, ' ').trim() ?? null;
  });
  const frame = async (name) => {
    await page.evaluate(() => {
      const g = window.game;
      g.cameraManager.interiorDistance = g.cameraManager.roomFrameDistance * 0.42;
      g.cameraManager.snapToPlayer(g.player);
      g.render();
    });
    await page.screenshot({ path: `${SHOTS}/fridge-${label}-${name}.png` });
  };
  const taking = await playUntil(page, () => {
    const a = window.game.player.actor;
    return a.pose.arms === 'reach' && a.carried ? true : null;
  }, 20);
  const atFridge = await local(page);
  mkdirSync(SHOTS, { recursive: true });
  await frame('take');
  const sitting = await playUntil(page, () => {
    const a = window.game.player.actor;
    return a.pose.arms === 'eat' && a.pose.legs === 'sit' && a.carried ? true : null;
  }, 20);
  const atSofa = await local(page);
  await frame('sit');
  await playUntil(page, () => (!window.game.player.actor.scripted ? true : null), 15);
  const near = (p, spot) => Math.hypot(p.x - spot.x, p.z - spot.z);
  check(`${label}: the food is taken at the bought fridge and eaten sitting on the bought sofa`,
    laid.fridge === 1 && laid.sofa === 1 && !!food && !!taking && !!sitting
      && near(atFridge, fridge) < 2.2 && near(atSofa, sofa) < 2.2
      && near(atSofa, fridge) > near(atSofa, sofa),
    { laid, opened, menu, foodMenu, food, atFridge, atSofa, fridge, sofa });
}

export async function run(browser, check) {
  const ctx = await newPlayer(browser);
  const { page, log } = await open(ctx, { w: 390, h: 780 });
  await closeDialogs(page);
  await page.evaluate(() => { window.game.hud.backend.data.walletCash += 8_000_000; window.game.hud.backend.rentProperty('prop_mainland_apt'); });
  await enterHome(page, 'prop_mainland_apt');
  await eatThere(page, check, 'rented');
  await leave(page);

  const plot = await page.evaluate(async () => {
    const g = window.game;
    const p = g.land.plots('lagos').find((one) => /Odunlami/.test(one.name));
    g.hud.backend.data.bank.balance = 5_000_000_000;
    g.hud.backend.saveData();
    await g.land.buyFromState(p.id);
    g.land.payLevy(p.id, 50_000_000);
    await g.land.startBuilding(p.id, 'duplex', (p.rect.minX + p.rect.maxX) / 2, (p.rect.minZ + p.rect.maxZ) / 2, 1);
    await g.registry.transact((state) => { if (state.buildings[p.id]) state.buildings[p.id].startedAt = Date.now() - 360000000; return { ok: true }; });
    g.plotWorld.refresh();
    return { id: p.id, lives: g.land.livesIn(p.id) };
  });
  await page.evaluate((id) => window.game.hud.phoneModal.openApp('land', `plot:${id}`), plot.id);
  await wait(700);
  await page.evaluate(() => document.getElementById('land-go-in')?.click());
  await playUntil(page, () => (window.game.world.interiorManager.currentInterior?.type === 'residence' && !window.game.world.interiorManager.busy ? true : null), 25);
  await wait(600);
  check('fridge: the built duplex can be lived in', plot.lives && (await page.evaluate(() => window.game.world.interiorManager.currentInterior?.type)) === 'residence', plot);
  await eatThere(page, check, 'duplex');

  check('fridge: no errors in the page', log.errors.length === 0, log.errors.slice(0, 5));
  await ctx.close();
}
