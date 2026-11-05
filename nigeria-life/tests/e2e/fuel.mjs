// Filling stations: the pump lists the vehicles with their tanks and fills the one on the
// forecourt at the pump price, once, paid when it is done; away from a station the player is
// told where the nearest is; run dry far from one, a jerry can is brought out, dearer.
import { open, newPlayer, closeDialogs, advance, wait, money } from './lib.mjs';

const sheet = (page) => page.evaluate(() => {
  const el = document.getElementById('pump-sheet');
  if (!el || el.style.display === 'none') return null;
  return {
    title: el.querySelector('.cat-title')?.textContent ?? '',
    rows: [...el.querySelectorAll('.pump-row')].map((r) => r.textContent.replace(/\s+/g, ' ').trim()),
    fill: [...el.querySelectorAll('[data-fill]')].map((b) => ({ id: b.dataset.fill, cost: Number(b.dataset.cost), text: b.textContent })),
  };
});

export async function run(browser, check) {
  const ctx = await newPlayer(browser);
  const { page, log } = await open(ctx);
  await closeDialogs(page);
  await page.evaluate(() => window.game.hud.backend.performGig(500000, 0, 'test: fuel money'));

  // Into the danfo, which is drawn onto the Broad Street forecourt with its tank at 40%
  const danfo = await page.evaluate(() => {
    const g = window.game;
    const v = g.world.vehicles.drivableVehicles.find((x) => x.type === 'danfo');
    g.enterVehicle(v);
    v.mesh.position.set(-18, 0, 78.2);
    v.fuel = 40;
    return v.id;
  });
  await advance(page, 0.3);
  await page.evaluate(() => window.game.hud.onRefuelVehicle());
  await wait(300);
  let shown = await sheet(page);
  const expected = Math.round((70 * 0.6 * 950) / 50) * 50;
  check('fuel: on the forecourt the pump lists the danfo with its tank, and offers to fill it at ₦950 a litre',
    shown && /The pump/.test(shown.title) && /Broad Street/.test(shown.title) && shown.rows.some((r) => /Tank 40%/.test(r)) && shown.fill.some((f) => f.id === danfo && f.cost === expected), { shown, expected });

  const before = await money(page);
  await page.evaluate((id) => document.querySelector(`#pump-sheet [data-fill="${id}"]`)?.click(), danfo);
  await wait(300);
  const during = await money(page);
  await wait(2600);
  const after = await money(page);
  const tank = await page.evaluate(() => window.game.player.currentVehicle.fuel);
  shown = await sheet(page);
  check('fuel: the attendant fills it, and it is paid once when the tank is full: then the pump says Full',
    during.total === before.total && before.total - after.total === expected && tank === 100 && shown && shown.rows.some((r) => /Full/.test(r)), { paid: before.total - after.total, during: before.total - during.total, tank, shown });
  await page.evaluate(() => window.game.pumpSheet.close());

  // Away from any station
  await page.evaluate(() => { const v = window.game.player.currentVehicle; v.mesh.position.set(6, 0, 20); v.fuel = 50; });
  await page.evaluate(() => window.game.hud.onRefuelVehicle());
  await wait(300);
  const told = await page.evaluate(() => /nearest filling station is NaijaPetro/.test(document.body.innerText));
  check('fuel: away from a station there is no pump; the player is told where the nearest one is', told && !(await sheet(page)), { told });

  // Run dry far from one: a jerry can
  await page.evaluate(() => { const v = window.game.player.currentVehicle; v.mesh.position.set(0, 0, 2000); v.fuel = 2; });
  await page.evaluate(() => window.game.hud.onRefuelVehicle());
  await wait(300);
  shown = await sheet(page);
  const m0 = await money(page);
  await page.evaluate(() => document.querySelector('#pump-sheet [data-jerry]')?.click());
  await wait(2900);
  const m1 = await money(page);
  const dry = await page.evaluate(() => window.game.player.currentVehicle.fuel);
  check('fuel: with the tank dry and no station near, a jerry can of 10 litres is brought for ₦19,000',
    shown && /Out of fuel/.test(shown.title) && m0.total - m1.total === 19000 && Math.abs(dry - (2 + 1000 / 70)) < 0.5, { shown, paid: m0.total - m1.total, dry });

  // The expressway's stations
  const stations = await page.evaluate(() => {
    const g = window.game;
    const ids = ['station-island', 'station-bridge', 'station-mainland'];
    return ids.map((id) => {
      const card = g.world.interactiveObjects.find((o) => o.id === `roadside-${id}`);
      return { id, card: !!card, name: card?.name ?? null };
    });
  });
  await page.evaluate(() => { const v = window.game.player.currentVehicle; v.mesh.position.set(-26.5, 0, 900); v.fuel = 30; });
  await page.evaluate(() => window.game.hud.onRefuelVehicle());
  await wait(300);
  shown = await sheet(page);
  check('fuel: there are filling stations on the expressway, and the pump works on their forecourts',
    stations.every((s) => s.card) && shown && /NaijaPetro, Island/.test(shown.title) && shown.fill.length === 1, { stations, shown });

  check('fuel: no errors in the page', log.errors.length === 0, log.errors.slice(0, 5));
  await ctx.close();
}
