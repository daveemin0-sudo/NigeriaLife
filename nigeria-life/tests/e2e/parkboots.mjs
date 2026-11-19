// Day work at every motor park: load coach boots for pocket cash in Lagos, Abuja and Port Harcourt.
import { open, newPlayer, closeDialogs, advance, playUntil, wait } from './lib.mjs';

const said = (page, pattern) => page.evaluate((source) => new RegExp(source, 'i').test(document.body.innerText), pattern);
const choices = (page) => page.evaluate(() => [...document.querySelectorAll('#game-dialogue-overlay button')].map((b) => b.textContent.replace(/\s+/g, ' ').trim()).filter((t) => t && !/^(ok|close|continue)$/i.test(t)));
const choose = (page, text) => page.evaluate((t) => [...document.querySelectorAll('#game-dialogue-overlay button')].find((b) => b.textContent.includes(t))?.click(), text);

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

/** Walk the offline boot-loading loop at one park and return what the player got. */
async function loadBoots(page, bayId) {
  const before = await page.evaluate(() => {
    const be = window.game.hud.backend;
    const d = be.getData();
    return { cash: d.walletCash, energy: d.stats.energy, cred: d.stats.streetCred };
  });
  const label = await cardFor(page, bayId);
  if (label === 'not-found') return { label, before, after: before, paid: false, toast: false };
  await press(page);
  await wait(300);
  const offered = await choices(page);
  await choose(page, "Load the coaches' boots");
  await playUntil(page, () => (window.game.player.actor.sequence?.name === 'load coach boots' ? true : null), 6);
  await playUntil(page, () => (window.game.player.actor.sequence ? null : true), 20);
  await advance(page, 0.8);
  const after = await page.evaluate(() => {
    const be = window.game.hud.backend;
    const d = be.getData();
    return { cash: d.walletCash, energy: d.stats.energy, cred: d.stats.streetCred };
  });
  const toast = await said(page, 'Boots locked');
  const cashOk = after.cash - before.cash === 10_000;
  // Energy also decays while the loading animation runs, so expect at least the gig cost.
  const energyOk = before.energy - after.energy >= 18;
  const credOk = after.cred - before.cred === 8;
  return {
    label,
    offered,
    before,
    after,
    paid: cashOk && energyOk && credOk,
    toast,
  };
}

export async function run(browser, check) {
  const ctx = await newPlayer(browser);
  const { page } = await open(ctx);
  await closeDialogs(page);

  const parks = await page.evaluate(() => {
    const g = window.game;
    return ['lagos', 'abuja', 'port_harcourt'].map((city) => {
      const p = g.world.motorParkOf(city);
      return {
        city,
        name: p.name,
        bay: p.interactive.find((o) => /-boots$/.test(o.id))?.id ?? null,
        things: p.interactive.map((o) => o.id),
      };
    });
  });

  check(
    'parkboots: every motor park has a loading-bay interactive (Lagos, Abuja, Port Harcourt)',
    parks.every((p) => p.bay && p.things.includes(p.bay)),
    parks,
  );

  const lagos = await loadBoots(page, 'jibowu-park-boots');
  check(
    'parkboots: Jibowu loading bay pays ₦10,000 cash, costs 18% energy, and awards +8 cred',
    /Load coach boots/.test(lagos.label ?? '') && lagos.paid && lagos.toast,
    lagos,
  );

  // Travel to Abuja park without a full coach journey: switch city and stand at Utako
  await page.evaluate(() => {
    const g = window.game;
    g.world.cityManager.switchCity('abuja', g.player, (objs) => { g.world.interactiveObjects = objs; });
    const bay = g.world.interactiveObjects.find((x) => x.id === 'utako-park-boots');
    g.player.stopMoving();
    g.player.mesh.position.set(bay.interactionPoint.x, 0, bay.interactionPoint.z);
  });
  await advance(page, 0.5);
  await closeDialogs(page);

  const utako = await loadBoots(page, 'utako-park-boots');
  check(
    'parkboots: Utako loading bay pays the same cash loop in Abuja',
    /Load coach boots/.test(utako.label ?? '') && utako.paid && utako.toast,
    utako,
  );

  await page.evaluate(() => {
    const g = window.game;
    g.world.cityManager.switchCity('port_harcourt', g.player, (objs) => { g.world.interactiveObjects = objs; });
    const bay = g.world.interactiveObjects.find((x) => x.id === 'waterlines-park-boots');
    g.player.stopMoving();
    g.player.mesh.position.set(bay.interactionPoint.x, 0, bay.interactionPoint.z);
  });
  await advance(page, 0.5);
  await closeDialogs(page);

  const waterlines = await loadBoots(page, 'waterlines-park-boots');
  check(
    'parkboots: Waterlines loading bay pays the same cash loop in Port Harcourt',
    /Load coach boots/.test(waterlines.label ?? '') && waterlines.paid && waterlines.toast,
    waterlines,
  );
}
