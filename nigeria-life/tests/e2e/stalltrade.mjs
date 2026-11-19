// Roadside stalls sell in every city: sachet water, akara/rice, suya when the trader is open.
import { open, newPlayer, closeDialogs, advance, wait } from './lib.mjs';

const choices = (page) => page.evaluate(() => [...document.querySelectorAll('#game-dialogue-overlay button')].map((b) => b.textContent.replace(/\s+/g, ' ').trim()).filter((t) => t && !/^(ok|close|continue)$/i.test(t)));
const choose = (page, text) => page.evaluate((t) => [...document.querySelectorAll('#game-dialogue-overlay button')].find((b) => b.textContent.includes(t))?.click(), text);
const said = (page, pattern) => page.evaluate((source) => new RegExp(source, 'i').test(document.body.innerText), pattern);

async function cardFor(page, id) {
  return page.evaluate(async (key) => {
    const g = window.game;
    const o = g.world.interactiveObjects.find((x) => x.id === key);
    if (!o) return 'not-found';
    document.getElementById('game-dialogue-overlay')?.remove();
    g.hud.hideInteractionCard();
    g.player.stopMoving();
    g.player.mesh.position.set(o.interactionPoint.x, 0, o.interactionPoint.z);
    await g.advance(0.1);
    g.hud.showInteractionCard(o);
    return document.getElementById('card-action-btn')?.textContent ?? null;
  }, id);
}

const press = (page) => page.evaluate(() => document.getElementById('card-action-btn')?.click());

/** Noon, let traders put stalls up, then find an open stall of the wanted kind. */
async function openStall(page, city, sells) {
  await page.evaluate((c) => {
    const g = window.game;
    g.world.skyEnvironment.setHour(12);
    if (c !== 'lagos') {
      g.world.cityManager.switchCity(c, g.player, (objs) => { g.world.interactiveObjects = objs; });
    }
  }, city);
  // Let Living City settle: traders walk in and open their stalls
  for (let i = 0; i < 40; i++) await advance(page, 0.25);
  await closeDialogs(page);

  return page.evaluate((c, kind) => {
    const g = window.game;
    const cards = g.world.interactiveObjects.filter((o) => o.id.startsWith(`${c}-stall-`));
    const openOnes = cards.filter((o) => {
      const i = Number(o.id.split('-').pop());
      if (c === 'lagos') return g.world.cityDensity.fabric.isStallOpen(i) && g.world.cityDensity.fabric.stallSpots[i]?.sells === kind;
      const life = g.world.cityManager.lifeHere();
      return life?.stalls?.isOpen(i) && life.stalls.sells(i) === kind;
    });
    return {
      total: cards.length,
      open: openOnes.length,
      id: openOnes[0]?.id ?? null,
      name: openOnes[0]?.name ?? null,
    };
  }, city, sells);
}

async function buy(page, stallId, item) {
  const before = await page.evaluate(() => {
    const d = window.game.hud.backend.getData();
    return { cash: d.walletCash, hunger: d.stats.hunger, energy: d.stats.energy, fun: d.stats.fun };
  });
  const label = await cardFor(page, stallId);
  await press(page);
  await wait(300);
  const offered = await choices(page);
  await choose(page, item);
  await wait(400);
  const after = await page.evaluate(() => {
    const d = window.game.hud.backend.getData();
    return { cash: d.walletCash, hunger: d.stats.hunger, energy: d.stats.energy, fun: d.stats.fun };
  });
  const toast = await said(page, item === 'Sachet pure water' ? 'Cold sachet' : item === 'Akara wrap' ? 'Hot akara' : 'Pepper suya');
  return { label, offered, before, after, toast };
}

export async function run(browser, check) {
  const ctx = await newPlayer(browser);
  const { page } = await open(ctx);
  await closeDialogs(page);

  // ------------------------------------------------------------------ Lagos goods stall: sachet water
  const lagosGoods = await openStall(page, 'lagos', 'goods');
  check(
    'stalltrade: Lagos has open roadside goods stalls at noon',
    lagosGoods.total > 0 && lagosGoods.open > 0 && !!lagosGoods.id,
    lagosGoods,
  );
  if (lagosGoods.id) {
    const water = await buy(page, lagosGoods.id, 'Sachet pure water');
    check(
      'stalltrade: Lagos sachet water costs ₦200 cash and restores a little energy',
      /Buy from/.test(water.label ?? '') && water.after.cash === water.before.cash - 200 && water.after.energy > water.before.energy && water.toast,
      water,
    );
  }

  // ------------------------------------------------------------------ Abuja food stall: akara
  const abujaFood = await openStall(page, 'abuja', 'food');
  check(
    'stalltrade: Abuja has open roadside food stalls at noon',
    abujaFood.total > 0 && abujaFood.open > 0 && !!abujaFood.id,
    abujaFood,
  );
  if (abujaFood.id) {
    const akara = await buy(page, abujaFood.id, 'Akara wrap');
    check(
      'stalltrade: Abuja akara costs ₦800 cash and restores hunger',
      /Buy from/.test(akara.label ?? '')
        && akara.after.cash === akara.before.cash - 800
        && (akara.after.hunger >= Math.min(100, akara.before.hunger + 22) || akara.after.hunger === 100)
        && akara.toast,
      akara,
    );
  }

  // ------------------------------------------------------------------ Port Harcourt: any open stall sells something
  const phGoods = await openStall(page, 'port_harcourt', 'goods');
  const phFood = phGoods.open ? null : await openStall(page, 'port_harcourt', 'food');
  const ph = phGoods.open ? phGoods : phFood;
  check(
    'stalltrade: Port Harcourt has open roadside stalls at noon',
    !!ph && ph.total > 0 && ph.open > 0 && !!ph.id,
    { phGoods, phFood },
  );
  if (ph?.id) {
    const item = /food/i.test(ph.name ?? '') ? 'Akara wrap' : 'Sachet pure water';
    const price = item === 'Akara wrap' ? 800 : 200;
    const bought = await buy(page, ph.id, item);
    check(
      'stalltrade: Port Harcourt stall takes cash for a street buy',
      /Buy from/.test(bought.label ?? '') && bought.after.cash === bought.before.cash - price && bought.toast,
      bought,
    );
  }

  // ------------------------------------------------------------------ Closed stall at night refuses sale
  await page.evaluate(() => {
    const g = window.game;
    g.world.skyEnvironment.setHour(2);
  });
  for (let i = 0; i < 30; i++) await advance(page, 0.25);
  await closeDialogs(page);
  const night = await page.evaluate(() => {
    const g = window.game;
    const cards = g.world.interactiveObjects.filter((o) => o.id.startsWith('port_harcourt-stall-'));
    const closed = cards.find((o) => {
      const i = Number(o.id.split('-').pop());
      return !g.world.cityManager.lifeHere()?.stalls?.isOpen(i);
    });
    return closed?.id ?? null;
  });
  if (night) {
    const label = await cardFor(page, night);
    await press(page);
    await wait(400);
    const refused = await said(page, 'tarp is down');
    check(
      'stalltrade: a shut stall at night will not sell',
      /closed/i.test(label ?? '') && refused,
      { night, label, refused },
    );
  } else {
    check('stalltrade: a shut stall at night will not sell', false, { night, note: 'no closed stall found' });
  }
}
