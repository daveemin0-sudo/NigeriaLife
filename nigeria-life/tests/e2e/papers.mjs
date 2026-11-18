// Lagos-only document loop: Federal Passport Office → Visa & Consular Desk.
// Visa is blocked until a Nigerian passport is in the bag. No flights in this suite.
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

const bag = (page) => page.evaluate(() => window.game.hud.backend.getData().inventory.map((i) => i.id));

export async function run(browser, check) {
  const ctx = await newPlayer(browser);
  const { page, log } = await open(ctx);
  await closeDialogs(page);
  await page.evaluate(() => {
    const be = window.game.hud.backend;
    be.data.walletCash += 500000;
    be.saveData();
    window.game.world.skyEnvironment.setHour(11);
  });

  const doors = await page.evaluate(() => ({
    passport: !!window.game.world.interactiveObjects.find((o) => o.id === 'roadside-nis-passport'),
    visa: !!window.game.world.interactiveObjects.find((o) => o.id === 'roadside-consular-visa'),
    passportEnter: (() => {
      const o = window.game.world.interactiveObjects.find((x) => x.id === 'roadside-nis-passport');
      window.game.hud.showInteractionCard(o);
      return document.getElementById('card-action-btn')?.textContent ?? '';
    })(),
  }));
  await page.evaluate(() => window.game.hud.hideInteractionCard());
  check('papers: passport office and visa desk stand on the Lagos roadside', doors.passport && doors.visa && /Go inside/.test(doors.passportEnter), doors);

  // Visa first without a passport must fail (no charge, no item)
  const inVisa = await enter(page, 'consular-visa');
  const m0 = await money(page);
  await use(page, 'place_consular-visa_visa', 'Apply for a travel visa stamp');
  const blocked = await page.evaluate(() => ({
    bag: window.game.hud.backend.getData().inventory.map((i) => i.id),
    said: document.getElementById('game-toast')?.innerText?.slice(0, 160)
      || document.body.innerText.match(/document in your bag|Alagbon|passport/i)?.[0]
      || '',
  }));
  const m1 = await money(page);
  check('papers: visa desk refuses without a Nigerian passport in the bag',
    inVisa === 'Visa & Consular Desk' && !blocked.bag.includes('travel_visa') && m1.total === m0.total,
    { inVisa, blocked, paid: m0.total - m1.total });
  await leave(page);
  await wait(800);

  // Passport office: apply and collect
  const inPass = await enter(page, 'nis-passport');
  const m2 = await money(page);
  await use(page, 'place_nis-passport_apply', 'Apply and collect my Nigerian passport');
  const afterPass = await bag(page);
  const m3 = await money(page);
  check('papers: Alagbon passport office puts a Nigerian passport in the bag for ₦70,000',
    inPass === 'Federal Passport Office, Alagbon' && afterPass.includes('ng_passport') && m2.total - m3.total === 70000,
    { inPass, afterPass, paid: m2.total - m3.total });
  await leave(page);
  await wait(800);

  // Visa with passport succeeds
  await enter(page, 'consular-visa');
  const m4 = await money(page);
  await use(page, 'place_consular-visa_visa', 'Apply for a travel visa stamp');
  const afterVisa = await bag(page);
  const m5 = await money(page);
  check('papers: with a passport, the consular desk stamps a travel visa for ₦45,000',
    afterVisa.includes('ng_passport') && afterVisa.includes('travel_visa') && m4.total - m5.total === 45000,
    { afterVisa, paid: m4.total - m5.total });

  // Duplicate passport refused
  await leave(page);
  await wait(800);
  await enter(page, 'nis-passport');
  const m6 = await money(page);
  await use(page, 'place_nis-passport_apply', 'Apply and collect my Nigerian passport');
  const m7 = await money(page);
  const passCount = await page.evaluate(() => window.game.hud.backend.getData().inventory.find((i) => i.id === 'ng_passport')?.quantity ?? 0);
  check('papers: a second passport is refused once you already hold one',
    m7.total === m6.total && passCount === 1,
    { paid: m6.total - m7.total, passCount });

  check('papers: no page errors', log.errors.length === 0, log.errors.slice(0, 4));
}
