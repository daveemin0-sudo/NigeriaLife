// Jets and yachts: the top menu opens and leads to them; one is bought with a name and a
// colour, paid once, and stands at the airfield or the marina; the jet flies its owner to
// Abuja (fuel paid); the yacht takes them round the lagoon and back to its berth.
import { open, newPlayer, closeDialogs, wait } from './lib.mjs';

export async function run(browser, check) {
  const ctx = await newPlayer(browser);
  const { page, log } = await open(ctx);
  await closeDialogs(page);
  await page.evaluate(() => { const g = window.game; g.world.skyEnvironment.setHour(12); const d = g.hud.backend.getData(); d.bank.balance = 200_000_000_000; g.hud.backend.saveData(); });
  const money = () => page.evaluate(() => { const d = window.game.hud.backend.getData(); return d.walletCash + d.bank.balance; });

  await page.click('#top-menu-btn');
  await wait(300);
  const menu = await page.evaluate(() => ({ open: !document.getElementById('top-menu').hidden, rows: document.querySelectorAll('#top-menu .tm-row').length, chips: document.querySelectorAll('#top-menu .tm-chip').length }));
  await page.click('#top-menu [data-act="fleet"]');
  await wait(400);
  const sheet = await page.evaluate(() => getComputedStyle(document.getElementById('fleet-sheet')).display !== 'none');
  check('fleet: the top bar has a menu, with the jets and yachts in it', menu.open && menu.rows >= 4 && menu.chips >= 8 && sheet, { menu, sheet });

  const m0 = await money();
  await page.click('#fleet-sheet [data-tab="jet"]');
  await page.click('#fleet-sheet [data-choose="challenger"]');
  await page.type('#fleet-sheet [data-name]', 'oga flies');
  await page.click('#fleet-sheet [data-colour="green"]');
  await page.click('#fleet-sheet [data-buy]');
  await wait(400);
  const jet = await page.evaluate(() => {
    const g = window.game;
    const [mine] = g.world.expressway.roadside.hooks.mine('jet');
    const craft = mine && g.world.expressway.roadside.craft.get(mine.uid);
    return { mine, at: craft ? { x: craft.position.x, z: craft.position.z } : null };
  });
  const m1 = await money();
  check('fleet: a Challenger 350 is bought once, for ₦43bn, with its name painted on, and stands at the airfield', jet.mine?.label === 'OGA FLIES' && m0 - m1 === 43_000_000_000 && jet.at && jet.at.z > 2700 && jet.at.z < 2950, { jet, paid: m0 - m1 });

  await page.evaluate(() => { const g = window.game; g.fleetSheet.close(); g.player.mesh.position.set(40, 0.28, 2800); g.world.expressway.roadside.hooks.fly(g.world.expressway.roadside.hooks.mine('jet')[0].uid, 'abuja'); });
  await page.evaluate(async () => { for (let i = 0; i < 70; i++) await window.game.advance(0.25); });
  const flown = await page.evaluate(() => ({ city: window.game.world.cityManager.currentCityId, visible: window.game.player.mesh.visible }));
  const m2 = await money();
  check('fleet: the jet flies its owner to Abuja; the fuel is ₦2.5m', flown.city === 'abuja' && flown.visible && m1 - m2 === 2_500_000, { flown, fuel: m1 - m2 });

  // Back in Lagos for the yacht
  await page.evaluate(() => { const g = window.game; g.arriveInCity('lagos'); });
  await wait(1500);
  await page.evaluate(() => window.game.fleetSheet.open('yacht'));
  await page.click('#fleet-sheet [data-choose="speedboat"]');
  await page.click('#fleet-sheet [data-buy]');
  await wait(300);
  const cruise = await page.evaluate(async () => {
    const g = window.game;
    g.fleetSheet.close();
    const uid = g.world.expressway.roadside.hooks.mine('yacht')[0].uid;
    const craft = g.world.expressway.roadside.craft.get(uid);
    const home = craft.position.clone();
    const fun0 = g.hud.backend.getData().stats.fun;
    g.hud.backend.modifyNeed('fun', -50);
    const fun1 = g.hud.backend.getData().stats.fun;
    g.player.mesh.position.set(60, 0.28, 1318);
    g.world.expressway.roadside.hooks.cruise(uid);
    let far = 0;
    for (let i = 0; i < 180; i++) { await g.advance(0.25); far = Math.max(far, craft.position.distanceTo(home)); }
    return { far: Math.round(far), back: craft.position.distanceTo(home) < 0.5, fun: g.hud.backend.getData().stats.fun - fun1, onPier: Math.abs(g.player.position.z - 1322) < 2, fun0 };
  });
  check('fleet: the yacht goes out on the lagoon and comes back to its berth, the player on the pier after, happier', cruise.far > 100 && cruise.back && cruise.fun >= 30 && cruise.onPier, cruise);

  check('fleet: no errors in the page', log.errors.length === 0, log.errors.slice(0, 5));
  await ctx.close();
}
