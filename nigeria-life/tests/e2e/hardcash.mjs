// Lagos hard currency: VI bureau buy/sell USD & GBP, then spray dollars at Ivory Rooftop.
// No other cities, no Accra FX. Rates from HardCurrency.ts ($1 = ₦1,600 buy / ₦1,520 sell).
import { open, newPlayer, closeDialogs, advance, wait, playUntil, money } from './lib.mjs';

const enter = async (page, key) => {
  await page.evaluate((k) => {
    const g = window.game;
    const card = g.world.interactiveObjects.find((o) => o.id === `roadside-${k}`);
    if (!card) throw new Error(`no roadside-${k}`);
    g.player.stopMoving();
    g.player.mesh.position.set(card.interactionPoint.x, 0, card.interactionPoint.z);
    g.hud.showInteractionCard(card);
    document.getElementById('card-action-btn')?.click();
  }, key);
  return playUntil(page, () => (window.game.world.interiorManager.currentInterior && !window.game.world.interiorManager.isTransitioning ? window.game.world.interiorManager.currentInterior.name : null), 20);
};

const use = async (page, stationId, choice) => {
  await page.evaluate((id) => {
    const g = window.game;
    const o = g.world.interiorManager.getActiveInteractiveObjects().find((x) => x.id === id);
    if (!o) throw new Error(`no station ${id}`);
    g.player.stopMoving();
    g.player.mesh.position.set(o.interactionPoint.x, 0, o.interactionPoint.z);
    g.hud.showInteractionCard(o);
    document.getElementById('card-action-btn')?.click();
  }, stationId);
  await wait(300);
  await page.evaluate((t) => [...document.querySelectorAll('#game-dialogue-overlay button')].find((b) => b.textContent.includes(t))?.click(), choice);
  await playUntil(page, () => (window.game.player.actor.sequence ? null : true), 25);
  await advance(page, 0.5);
};

const leave = (page) => page.evaluate(() => {
  const g = window.game;
  return g.world.interiorManager.exitCurrentInterior(g.player, g.cameraManager, g.hud, g.world);
});

export async function run(browser, check) {
  const ctx = await newPlayer(browser);
  const { page, log } = await open(ctx);
  await closeDialogs(page);
  await page.evaluate(() => {
    const be = window.game.hud.backend;
    be.data.walletCash += 2_000_000;
    be.saveData();
    window.game.world.skyEnvironment.setHour(20);
  });

  const door = await page.evaluate(() => {
    const o = window.game.world.interactiveObjects.find((x) => x.id === 'roadside-bureau-fx');
    if (!o) return null;
    window.game.hud.showInteractionCard(o);
    return { found: true, label: document.getElementById('card-action-btn')?.textContent ?? '', z: o.interactionPoint.z };
  });
  await page.evaluate(() => window.game.hud.hideInteractionCard());
  check('hardcash: VI bureau stands on the Lagos roadside near Ivory Rooftop',
    !!door?.found && /Go inside/.test(door.label) && door.z > 560 && door.z < 620,
    door);

  // Buy $100 for ₦160,000
  const inBureau = await enter(page, 'bureau-fx');
  const m0 = await money(page);
  await use(page, 'place_bureau-fx_buy', 'Buy $100');
  const m1 = await money(page);
  check('hardcash: buying $100 costs ₦160,000 and puts dollars in the pocket',
    /Bureau de Change/.test(inBureau || '') && m0.total - m1.total === 160_000 && m1.usd === 100 && m1.gbp === 0,
    { inBureau, paid: m0.total - m1.total, hard: { usd: m1.usd, gbp: m1.gbp } });

  // Buy £50
  await use(page, 'place_bureau-fx_buy', 'Buy £50');
  const m2 = await money(page);
  check('hardcash: buying £50 costs ₦102,500 and stacks with the dollars',
    m1.total - m2.total === 102_500 && m2.usd === 100 && m2.gbp === 50,
    { paid: m1.total - m2.total, hard: { usd: m2.usd, gbp: m2.gbp } });

  // Sell $50 back for ₦76,000
  await use(page, 'place_bureau-fx_sell', 'Sell $50');
  const m3 = await money(page);
  check('hardcash: selling $50 returns ₦76,000 at the sell rate',
    m3.total - m2.total === 76_000 && m3.usd === 50 && m3.gbp === 50,
    { gained: m3.total - m2.total, hard: { usd: m3.usd, gbp: m3.gbp } });

  // Refuse sell when short
  await use(page, 'place_bureau-fx_sell', 'Sell $500');
  const m4 = await money(page);
  const refused = await page.evaluate(() => /only have|\$50|pocket/i.test(document.body.innerText));
  check('hardcash: selling more dollars than you hold is refused',
    m4.usd === 50 && m4.total === m3.total && refused,
    { hard: { usd: m4.usd }, refused, paid: m3.total - m4.total });

  await leave(page);
  await wait(800);

  // Spray $100 at Ivory — need another $50 first
  await enter(page, 'bureau-fx');
  await use(page, 'place_bureau-fx_buy', 'Buy $50');
  await leave(page);
  await wait(800);

  const beforeSpray = await money(page);
  const fun0 = await page.evaluate(() => window.game.hud.backend.getData().stats.fun);
  await enter(page, 'ivory-rooftop');
  await use(page, 'place_ivory-rooftop_spray', 'Spray $100 on the floor');
  const afterSpray = await money(page);
  const fun1 = await page.evaluate(() => window.game.hud.backend.getData().stats.fun);
  check('hardcash: spraying $100 at Ivory Rooftop spends dollars (not naira) and raises fun',
    beforeSpray.usd === 100 && afterSpray.usd === 0 && afterSpray.total === beforeSpray.total && fun1 > fun0,
    { before: beforeSpray, after: afterSpray, fun: [fun0, fun1] });

  // Spray without hard cash refused
  await use(page, 'place_ivory-rooftop_spray', 'Spray $100 on the floor');
  const afterFail = await money(page);
  const sprayRefused = await page.evaluate(() => /bureau|dollars|pounds|need \$100/i.test(document.body.innerText));
  check('hardcash: spray without dollars is refused',
    afterFail.usd === 0 && afterFail.total === afterSpray.total && sprayRefused,
    { afterFail, sprayRefused });

  check('hardcash: no page errors', log.errors.length === 0, log.errors.slice(0, 4));
}
