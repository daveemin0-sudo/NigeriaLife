// Help at open roadside stalls for pocket cash in Lagos, Abuja and Port Harcourt.
import { open, newPlayer, closeDialogs, advance, playUntil, wait } from './lib.mjs';

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

async function openStall(page, city) {
  await page.evaluate((c) => {
    const g = window.game;
    g.world.skyEnvironment.setHour(12);
    if (c !== 'lagos') {
      g.world.cityManager.switchCity(c, g.player, (objs) => { g.world.interactiveObjects = objs; });
    }
  }, city);
  for (let i = 0; i < 40; i++) await advance(page, 0.25);
  await closeDialogs(page);

  return page.evaluate((c) => {
    const g = window.game;
    const cards = g.world.interactiveObjects.filter((o) => o.id.startsWith(`${c}-stall-`));
    const openOnes = cards.filter((o) => {
      const i = Number(o.id.split('-').pop());
      if (c === 'lagos') return g.world.cityDensity.fabric.isStallOpen(i);
      return g.world.cityManager.lifeHere()?.stalls?.isOpen(i);
    });
    return { total: cards.length, open: openOnes.length, id: openOnes[0]?.id ?? null };
  }, city);
}

async function helpAt(page, stallId) {
  const before = await page.evaluate(() => {
    const d = window.game.hud.backend.getData();
    return { cash: d.walletCash, energy: d.stats.energy, cred: d.stats.streetCred };
  });
  const label = await cardFor(page, stallId);
  await press(page);
  await wait(300);
  const offered = await choices(page);
  await choose(page, 'Help the trader for cash');
  await playUntil(page, () => (window.game.player.actor.sequence ? true : null), 6);
  await playUntil(page, () => (window.game.player.actor.sequence ? null : true), 20);
  await advance(page, 0.8);
  const after = await page.evaluate(() => {
    const d = window.game.hud.backend.getData();
    return { cash: d.walletCash, energy: d.stats.energy, cred: d.stats.streetCred };
  });
  const toast = await said(page, 'dashed you');
  return {
    label,
    offered,
    before,
    after,
    paid: after.cash - before.cash === 5_000 && before.energy - after.energy >= 12 && after.cred - before.cred === 5,
    toast,
  };
}

export async function run(browser, check) {
  const ctx = await newPlayer(browser);
  const { page } = await open(ctx);
  await closeDialogs(page);

  for (const city of ['lagos', 'abuja', 'port_harcourt']) {
    const name = city === 'lagos' ? 'Lagos' : city === 'abuja' ? 'Abuja' : 'Port Harcourt';
    const stall = await openStall(page, city);
    check(`stallhelp: ${name} has an open roadside stall at noon`, stall.open > 0 && !!stall.id, stall);
    if (!stall.id) continue;
    const helped = await helpAt(page, stall.id);
    check(
      `stallhelp: ${name} stall help pays ₦5,000 cash, costs energy, awards cred`,
      /buy or help/i.test(helped.label ?? '') && helped.offered.some((c) => /Help the trader/.test(c)) && helped.paid && helped.toast,
      helped,
    );
  }
}
