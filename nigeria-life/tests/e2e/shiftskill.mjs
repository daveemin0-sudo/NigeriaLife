// Skill on the job: each part of a shift has a sweep to tap in the green; three stars earns the
// worker a tip on top of the pay, and counts for the hustle; not tapping is just the pay.
import { open, newPlayer, closeDialogs, advance, wait, playUntil, money } from './lib.mjs';

const KEY = 'lasuth';
const EMPLOYER = 'lasuth-nursing';

const use = async (page, id) => {
  await page.evaluate((key) => {
    const g = window.game;
    document.getElementById('game-dialogue-overlay')?.remove();
    const o = g.world.interiorManager.getActiveInteractiveObjects().find((x) => x.id === key);
    g.player.stopMoving();
    g.player.mesh.position.set(o.interactionPoint.x, 0, o.interactionPoint.z);
    g.hud.showInteractionCard(o);
    document.getElementById('card-action-btn')?.click();
  }, id);
  await wait(300);
};

const shift = async (page, tap) => {
  await page.evaluate(() => { window.game.hud.backend.restoreEnergy(100); window.__sweeps = 0; window.__seen = false; });
  const pay = await page.evaluate((e) => { const j = window.game.jobs; return Math.round(j.grade(e).pay * j.constructor.payBoost()); }, EMPLOYER);
  const before = await money(page);
  await use(page, `work_${KEY}_shift_${EMPLOYER}`);
  await playUntil(page, (t) => {
    const s = window.game.modules.ShiftSkill.get();
    if (s.showing) {
      window.__seen = true;
      if (t && !window.__tapping) { window.__tapping = true; s.tapPerfect(); window.__sweeps += 1; }
    } else window.__tapping = false;
    return window.game.player.actor.sequence ? null : true;
  }, 90, tap);
  await advance(page, 0.3);
  const after = await money(page);
  const state = await page.evaluate(() => ({ seen: window.__seen, sweeps: window.__sweeps, overlayOff: !document.getElementById('shift-skill')?.classList.contains('on') }));
  return { pay, gained: after.total - before.total, ...state };
};

export async function run(browser, check) {
  const ctx = await newPlayer(browser);
  const { page, log } = await open(ctx, { life: true });
  await closeDialogs(page);
  await page.evaluate(() => { window.game.world.skyEnvironment.setHour(11); window.game.modules.Hustles.today = () => '2026-11-05'; const h = window.game.modules.Hustles.get(); h.hustles(); h.save.day.picks = ['stars', 'chop', 'hail']; h.changed(); });
  await page.evaluate((k) => {
    const g = window.game;
    const card = g.world.interactiveObjects.find((o) => o.id === `roadside-${k}`);
    g.player.mesh.position.set(card.interactionPoint.x, 0, card.interactionPoint.z);
    g.hud.showInteractionCard(card);
    document.getElementById('card-action-btn')?.click();
  }, KEY);
  await playUntil(page, () => (window.game.world.interiorManager.currentInterior && !window.game.world.interiorManager.isTransitioning ? true : null), 20);
  await use(page, `work_${KEY}_hire_${EMPLOYER}`);
  await page.evaluate(() => [...document.querySelectorAll('#game-dialogue-overlay button')].find((b) => b.textContent.includes('Take the job'))?.click());
  await wait(300);

  const perfect = await shift(page, true);
  const tip = Math.round((perfect.pay * 0.3) / 50) * 50;
  const h = await page.evaluate(() => window.game.modules.Hustles.get().hustles().find((x) => x.id === 'stars'));
  const hustle = h?.done;
  check('skill: every part of the shift sweeps a bar to tap; tapped in the green each time, it is a three-star shift and the one in charge tips 30% on top of the pay',
    perfect.seen && perfect.sweeps >= 2 && perfect.gained === perfect.pay + tip + (h?.reward ?? 0) && perfect.overlayOff, { perfect, tip, hustleReward: h?.reward });
  check('skill: a three-star shift counts for the "sharp hands" hustle', hustle === true, { hustle });

  const plain = await shift(page, false);
  check('skill: a shift with no taps is paid the plain rate, no tip, and the bar is put away', plain.seen && plain.sweeps === 0 && plain.gained === plain.pay && plain.overlayOff, plain);

  check('skill: no errors in the page', log.errors.length === 0, log.errors.slice(0, 5));
  await ctx.close();
}
