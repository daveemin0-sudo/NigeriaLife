// Naija Detective: a case taken on the phone, its witnesses found standing inside the places
// the trail leads to, each questioned and noted, the culprit named and the case paid; a wrong
// name and the case goes cold until tomorrow.
import { open, newPlayer, closeDialogs, wait, playUntil, money } from './lib.mjs';

const enter = async (page, key) => {
  await page.evaluate((k) => {
    const g = window.game;
    const card = g.world.interactiveObjects.find((o) => o.id === `roadside-${k}`);
    g.world.skyEnvironment.setHour(13);
    g.player.stopMoving();
    g.player.mesh.position.set(card.interactionPoint.x, 0, card.interactionPoint.z);
    g.hud.showInteractionCard(card);
    document.getElementById('card-action-btn')?.click();
  }, key);
  await playUntil(page, () => (window.game.world.interiorManager.currentInterior && !window.game.world.interiorManager.isTransitioning ? true : null), 20);
  await wait(300);
};
const leave = async (page) => {
  await page.evaluate(() => { const g = window.game; return g.world.interiorManager.exitCurrentInterior(g.player, g.cameraManager, g.hud, g.world); });
  await wait(1100);
};
/** The witness in this room: seen, asked, and the clue written down */
const question = async (page, key) => {
  const seen = await page.evaluate((k) => {
    const g = window.game;
    const o = g.world.interiorManager.getActiveInteractiveObjects().find((x) => x.id === `case_witness_${k}`);
    if (!o) return null;
    g.player.stopMoving();
    g.player.mesh.position.set(o.interactionPoint.x, 0, o.interactionPoint.z);
    g.hud.showInteractionCard(o);
    const label = document.getElementById('card-action-btn')?.textContent ?? '';
    document.getElementById('card-action-btn')?.click();
    return { label, visible: o.mesh.visible && !!o.mesh.parent };
  }, key);
  const said = await playUntil(page, () => document.getElementById('game-dialogue-overlay')?.innerText || null, 15);
  await page.evaluate(() => [...document.querySelectorAll('#game-dialogue-overlay button')].find((b) => b.textContent.includes('Write it in the notebook'))?.click());
  await wait(300);
  return { ...seen, said };
};

export async function run(browser, check) {
  const ctx = await newPlayer(browser);
  const { page, log } = await open(ctx, { life: true });
  await closeDialogs(page);
  await page.evaluate(() => window.game.hud.phoneModal.openApp('cases'));
  await wait(400);
  const list = await page.evaluate(() => document.querySelectorAll('#case-list .nl-row').length);
  await page.evaluate(() => document.querySelector('[data-act="open"][data-arg="case-suya-money"]')?.click());
  await wait(300);
  await page.evaluate(() => document.getElementById('case-take')?.click());
  await wait(300);
  const lead = await page.evaluate(() => document.getElementById('case-lead')?.innerText ?? '');
  check('cases: Detective on the phone has five cases; the suya money case is taken and its first lead is Mai Suya Spot', list === 5 && /Mai Suya Spot/.test(lead), { list, lead });
  await page.evaluate(() => window.game.hud.phoneModal.close?.());

  const trail = [];
  for (const key of ['allen-suya', 'allen-salon', 'allen-bank']) {
    await enter(page, key);
    trail.push({ key, ...(await question(page, key)) });
    await leave(page);
  }
  const notebook = await page.evaluate(() => window.game.modules.Cases.get().found('case-suya-money'));
  check('cases: in each place on the trail a witness waits with a 🔎 card; asked, they say what they saw, and it goes in the notebook (3/3)',
    trail.every((t) => t.visible && /Ask .* about the case/.test(t.label) && (t.said ?? '').length > 40) && notebook === 3, trail.map((t) => ({ key: t.key, label: t.label, visible: t.visible })));

  const m0 = await money(page);
  await page.evaluate(() => { window.game.hud.phoneModal.openApp('cases', 'c:case-suya-money'); });
  await wait(300);
  const accuse = await page.evaluate(() => document.querySelectorAll('#case-accuse [data-act="accuse"]').length);
  await page.evaluate(() => document.querySelector('#case-accuse [data-act="accuse"][data-arg="0"]')?.click());
  await wait(400);
  const m1 = await money(page);
  const after = await page.evaluate(() => ({ solution: document.getElementById('case-solution')?.innerText ?? '', card: window.game.modules.Album.get().count('sherlock') }));
  check('cases: with every clue in, the three suspects are named; naming Musa solves the case, pays ₦40,000 and earns the Naija Sherlock card',
    accuse === 3 && /Musa took the money/.test(after.solution) && m1.total - m0.total >= 40_000 && after.card === 1, { accuse, paid: m1.total - m0.total, after });

  // A wrong name: the case goes cold and cannot be taken again today
  const cold = await page.evaluate(() => {
    const C = window.game.modules.Cases.get();
    C.take('case-agbada');
    C.save.found['case-agbada'] = 3;
    const right = C.accuse(0);
    const c = window.game.modules.Cases.get().active;
    return { right, active: c, retake: C.take('case-agbada') };
  });
  check('cases: naming the wrong person sends the case cold: it cannot be taken again until tomorrow', cold.right === false && cold.active === null && cold.retake === false, cold);

  check('cases: no errors in the page', log.errors.length === 0, log.errors.slice(0, 5));
  await page.evaluate(() => window.game.hud.phoneModal.close?.());
  await ctx.close();
}
