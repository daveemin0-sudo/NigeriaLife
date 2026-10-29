// The Gist Times: a paper on the phone each morning, made from Lagos as it is: the riddle of
// the day solved by going into the place it names; the player on the front page after a big
// purchase; the hustle of the day, what is on, the agama tip-off, prices, jobs and land.
import { open, newPlayer, closeDialogs, wait, playUntil, money } from './lib.mjs';

const paper = (page) => page.evaluate(() => {
  const el = document.getElementById('gist-times');
  return { text: el?.innerText ?? '', lead: document.getElementById('gist-lead')?.textContent ?? '', riddle: document.getElementById('gist-riddle')?.innerText ?? '' };
});

export async function run(browser, check) {
  const ctx = await newPlayer(browser);
  const { page, log } = await open(ctx, { life: true });
  await closeDialogs(page);

  // A day whose riddle names a place along the road, so it can be walked into
  const day = await page.evaluate(() => {
    const m = window.game.modules;
    const ids = new Set(window.game.world.interactiveObjects.map((o) => o.id));
    for (let d = 1; d < 60; d++) {
      const date = `2026-11-${String((d % 28) + 1).padStart(2, '0')}`;
      m.Hustles.today = () => date;
      const r = m.GistTimes.get().riddle();
      if (ids.has(`roadside-${r.place}`)) return { date, place: r.place, answer: r.answer, reward: r.reward };
    }
    return null;
  });
  await page.evaluate(() => window.game.hud.phoneModal.openApp('gist'));
  await wait(500);
  const first = await paper(page);
  const sections = ['GIST TIMES', 'RIDDLE OF THE DAY', 'THE HUSTLE OF THE DAY', "WHAT'S ON", 'AGAMA WATCH', 'MARKET REPORT', 'SITUATIONS VACANT', 'GIST CORNER'];
  check('gist: the Gist Times opens on the phone with today\'s edition: riddle, hustle of the day, what is on, an agama tip-off, prices, jobs and gossip',
    !!day && sections.every((s) => first.text.toUpperCase().includes(s)) && /Go into the place to win/.test(first.riddle), { day, missing: sections.filter((s) => !first.text.toUpperCase().includes(s)) });

  // The riddle answered by going into the place
  await page.evaluate(() => window.game.hud.phoneModal.close?.());
  const m0 = await money(page);
  await page.evaluate((key) => {
    const g = window.game;
    const card = g.world.interactiveObjects.find((o) => o.id === `roadside-${key}`);
    g.world.skyEnvironment.setHour(13);
    g.player.stopMoving();
    g.player.mesh.position.set(card.interactionPoint.x, 0, card.interactionPoint.z);
    g.hud.showInteractionCard(card);
    document.getElementById('card-action-btn')?.click();
  }, day.place);
  await playUntil(page, () => (window.game.world.interiorManager.currentInterior && !window.game.world.interiorManager.isTransitioning ? true : null), 20);
  await wait(300);
  const m1 = await money(page);
  await page.evaluate(() => { const g = window.game; return g.world.interiorManager.exitCurrentInterior(g.player, g.cameraManager, g.hud, g.world); });
  await wait(1200);

  // A big purchase: the paper prints it
  await page.evaluate(() => {
    const b = window.game.hud.backend;
    b.data.bank.balance += 5_000_000;
    b.saveData();
    b.pay(2_500_000, 'Toyota Camry from Sankofa Motors', 'ASSET_PURCHASE');
  });
  await page.evaluate(() => window.game.hud.phoneModal.openApp('gist'));
  await wait(500);
  const after = await paper(page);
  const name = await page.evaluate(() => window.game.hud.backend.getData().username);
  check(`gist: going into ${day?.answer} answers the riddle of the day: paid, and the paper marks it solved`, m1.total - m0.total === day.reward && after.riddle.includes('Solved'), { paid: m1.total - m0.total, reward: day.reward, riddle: after.riddle });
  check('gist: a ₦2,500,000 purchase puts the player on the front page', after.lead.startsWith('EXCLUSIVE') && after.lead.includes(`@${name}`) && /2,500,000/.test(after.text), { lead: after.lead, name });

  check('gist: no errors in the page', log.errors.length === 0, log.errors.slice(0, 5));
  await ctx.close();
}
