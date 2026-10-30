// The garden and the pets at home: a planter from the catalogue sown with ugwu, the shoots
// watered, grown by the clock and harvested into the bag; a kennel where a dog is adopted
// that then trots over to the player, is fed and played with, and is hungry a day later;
// an aquarium of fish; and a pet home sold taking its pet with it.
import { open, newPlayer, closeDialogs, advance, wait, playUntil, money, enterInterior } from './lib.mjs';

const cardOf = (page, uid) => page.evaluate((u) => {
  const g = window.game;
  const o = g.world.interiorManager.getActiveInteractiveObjects().find((x) => x.id === `home_item_${u}`);
  if (!o) return null;
  g.player.stopMoving();
  g.player.mesh.position.set(o.interactionPoint.x, 0, o.interactionPoint.z);
  g.hud.showInteractionCard(o);
  return document.getElementById('card-action-btn')?.textContent ?? '';
}, uid);
const choose = async (page, uid, text) => {
  await cardOf(page, uid);
  await page.evaluate(() => document.getElementById('card-action-btn')?.click());
  await wait(300);
  const picked = await page.evaluate((t) => { const b = [...document.querySelectorAll('#game-dialogue-overlay button')].find((x) => x.textContent.includes(t)); b?.click(); return !!b; }, text);
  await playUntil(page, () => (window.game.player.actor.sequence ? null : true), 15);
  await advance(page, 0.3);
  return picked;
};

export async function run(browser, check) {
  const ctx = await newPlayer(browser);
  const { page, log } = await open(ctx);
  await closeDialogs(page);
  await page.evaluate(() => { const g = window.game; g.world.interiorManager.residence.constructor.standardNow = () => 'comfortable'; g.world.interiorManager.residence.constructor.briefNow = () => ({ kind: 'house', bedrooms: 4, carport: true }); const b = g.hud.backend; b.data.bank.balance += 500_000; b.saveData(); });
  await enterInterior(page, 'residence');
  await advance(page, 1);
  // A planter, a kennel and an aquarium put down in the living room
  const uids = await page.evaluate(() => {
    const d = window.game.modules.HouseDecorationSystem.getInstance();
    const put = (id, spots) => { for (const [x, z] of spots) { const n = d.placed.length; if (d.adopt([{ id, x, z, turns: 0 }])) return d.placed[n].uid; } return null; };
    return {
      planter: put('planter_box', [[-2, 2.5], [0, 2.5], [-3, 4], [1, 4]]),
      kennel: put('dog_kennel', [[-0.5, 1.0], [1.5, 1.5], [-3.5, 3]]),
      tank: put('aquarium', [[-0.5, 4.4], [3.3, 2.2], [-4, 1]]),
    };
  });
  await advance(page, 0.5);
  const catalogue = await page.evaluate(() => ['planter_box', 'flower_pots', 'dog_kennel', 'cat_tree', 'parrot_perch', 'aquarium'].map((id) => !!window.game.modules.HouseDecorationSystem.getInstance().catalogueItem(id)));

  // ------------------------------------------------------------------ The garden
  const label0 = await cardOf(page, uids.planter);
  const m0 = await money(page);
  const sown = await choose(page, uids.planter, 'Sow Ugwu');
  const m1 = await money(page);
  const sprouts = await page.evaluate((u) => { const d = window.game.modules.HouseDecorationSystem.getInstance(); const it = d.placed.find((p) => p.uid === u); return !!it.mesh.getObjectByName('garden plants'); }, uids.planter);
  // Eight minutes on: the shoots are up and want water; without it they wait
  await page.evaluate(() => { const G = window.game.modules.Garden; const t0 = Date.now(); G.now = () => t0 + 8 * 60_000; });
  const thirsty = await cardOf(page, uids.planter);
  await page.evaluate(() => { const G = window.game.modules.Garden; const t0 = Date.now(); G.now = () => t0 + 60 * 60_000; });
  const stillThirsty = await cardOf(page, uids.planter);
  await choose(page, uids.planter, 'Water the');
  await page.evaluate(() => { const G = window.game.modules.Garden; const t0 = Date.now(); G.now = () => t0 + 3 * 3600_000; });
  const ripe = await cardOf(page, uids.planter);
  await choose(page, uids.planter, 'Harvest');
  const bag = await page.evaluate(() => window.game.hud.backend.getData().inventory.find((i) => i.id === 'garden_ugwu')?.quantity ?? 0);
  const empty = await cardOf(page, uids.planter);
  check('garden: six garden and pet pieces are in the catalogue; a planter is sown with ugwu for ₦300 and its shoots show',
    catalogue.every(Boolean) && /Sow something/.test(label0) && sown && m0.total - m1.total === 300 && sprouts, { catalogue, label0, paid: m0.total - m1.total, sprouts });
  check('garden: the shoots want water and wait for it however long it takes; watered, the ugwu grows ripe, is harvested into the bag (3 bunches) and the planter is empty again',
    /Water the ugwu/.test(thirsty) && /Water the ugwu/.test(stillThirsty) && /Harvest the ugwu/.test(ripe) && bag === 3 && /Sow something/.test(empty), { thirsty, stillThirsty, ripe, bag, empty });

  // ------------------------------------------------------------------ A dog
  const k0 = await money(page);
  const adopted = await choose(page, uids.kennel, 'Adopt a dog');
  const k1 = await money(page);
  const dog = await page.evaluate(() => { const r = window.game.world.interiorManager.residence.group; return !!r.getObjectByName('pet Bingo'); });
  // The player walks off across the room: the dog follows
  const follow = await page.evaluate(async () => {
    const g = window.game;
    const r = g.world.interiorManager.residence.group;
    const pet = r.getObjectByName('pet Bingo');
    const o = r.position;
    g.player.stopMoving();
    // Across the parlour from the kennel
    g.player.mesh.position.set(o.x + 2.6, 0, o.z + 3.4);
    const d = () => Math.hypot(g.player.position.x - (o.x + pet.position.x), g.player.position.z - (o.z + pet.position.z));
    const before = d();
    for (let i = 0; i < 60; i++) g.advance(0.1);
    return { before: +before.toFixed(2), after: +d().toFixed(2) };
  });
  const f0 = await page.evaluate(() => window.game.hud.backend.getData().stats.fun);
  await choose(page, uids.kennel, 'Feed Bingo');
  await choose(page, uids.kennel, 'Play with Bingo');
  const f1 = await page.evaluate(() => window.game.hud.backend.getData().stats.fun);
  await page.evaluate(() => { const P = window.game.modules.Pets; const t0 = Date.now(); P.now = () => t0 + 26 * 3600_000; });
  const hungry = await cardOf(page, uids.kennel);
  check('pets: at the kennel a dog is adopted for ₦25,000 and named Bingo; when the player walks away across the room, Bingo trots after and stops a step away',
    adopted && k0.total - k1.total === 25_000 && dog && follow.after < follow.before && follow.after < 2, { paid: k0.total - k1.total, dog, follow });
  check('pets: Bingo is fed and played with (fun up); a day without food and the kennel says he is hungry', f1 > f0 && /Bingo: Hungry/.test(hungry), { f0, f1, hungry });

  // ------------------------------------------------------------------ Fish, and a pet home sold
  await choose(page, uids.tank, 'Adopt a tropical fish');
  const fish = await page.evaluate((u) => { const d = window.game.modules.HouseDecorationSystem.getInstance(); const it = d.placed.find((p) => p.uid === u); let n = 0; it.mesh.traverse((o) => { if (o.name === 'pet fish') n += 1; }); return n; }, uids.tank);
  const pets0 = await page.evaluate(() => window.game.modules.Pets.get().count);
  await page.evaluate((u) => window.game.modules.HouseDecorationSystem.getInstance().sell(u), uids.kennel);
  await advance(page, 0.5);
  const after = await page.evaluate(() => ({ count: window.game.modules.Pets.get().count, dog: !!window.game.world.interiorManager.residence.group.getObjectByName('pet Bingo') }));
  check('pets: the aquarium gets a shoal of four fish; the kennel sold, Bingo goes with it', fish === 4 && pets0 === 2 && after.count === 1 && !after.dog, { fish, pets0, after });

  check('gardenpets: no errors in the page', log.errors.length === 0, log.errors.slice(0, 5));
  await ctx.close();
}
