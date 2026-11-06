// Needs while the game is shut, and needs at work (src/backend/BackendService.ts settleTimeAway,
// poorShape): three hours away take a gentle bite (hunger 5.5 an hour); two days away stop at a
// quarter, and a need already lower is not raised; the player is told in one line. A shift done
// starving is docked a fifth, and the boss says so.
import { open, newPlayer, closeDialogs, advance, wait, money } from './lib.mjs';

/** As if the game had last been open `hours` ago, with these needs: the next tick of the needs settles it */
const away = (page, hours, stats) =>
  page.evaluate(([h, st]) => {
    const be = window.game.hud.backend;
    Object.assign(be.data.stats, st);
    be.data.lastActiveAt = Date.now() - h * 3_600_000;
    be.awaySettled = false;
  }, [hours, stats]);
const needs = (page) => page.evaluate(() => { const s = window.game.hud.backend.getData().stats; return { hunger: s.hunger, energy: s.energy, fun: s.fun, social: s.social, hygiene: s.hygiene, bladder: s.bladder }; });

export async function run(browser, check) {
  const ctx = await newPlayer(browser);
  const { page, log } = await open(ctx, { w: 1280, h: 760 });
  await closeDialogs(page);
  await page.evaluate(() => { window.game.hud.backend.data.trait = undefined; });
  const full = { hunger: 90, energy: 90, fun: 90, social: 90, hygiene: 90, bladder: 90 };

  await away(page, 3, full);
  await advance(page, 1.2);
  let n = await needs(page);
  const told = await page.evaluate(() => /While you were away you got hungrier \(-1[67]\)/.test(document.body.innerText));
  // The game's own drain in the second it ran is small; time away is the hourly rates
  check('away: three hours away take a gentle bite at a Lagos day\'s rates (hunger about 16, energy 12, bladder 21), and the player is told in one line',
    Math.abs(n.hunger - (90 - 16.5)) < 2 && Math.abs(n.energy - (90 - 12)) < 2 && Math.abs(n.social - (90 - 9)) < 2 && Math.abs(n.bladder - (90 - 21)) < 2 && told,
    { n, told });

  await away(page, 48, { ...full, hygiene: 10 });
  await advance(page, 1.2);
  n = await needs(page);
  check('away: two days away stop every need at a quarter (nobody comes back starved), and a need already lower (hygiene at 10) is not raised',
    n.hunger >= 24 && n.hunger <= 25 && n.energy >= 24 && n.energy <= 25 && n.fun >= 24 && n.fun <= 25 && n.hygiene <= 10,
    n);

  await away(page, 0.05, full);
  await advance(page, 1.2);
  n = await needs(page);
  check('away: a few minutes away (a reload) take nothing', n.hunger > 88 && n.energy > 88, n);

  // ------------------------------------------------------------------ Work done starving
  const shift = await page.evaluate(() => {
    const g = window.game;
    const be = g.hud.backend;
    g.jobs.apply('apapa-port');
    be.restoreEnergy(100);
    be.data.stats.hunger = 10;
    be.data.stats.hygiene = 80;
    const hungry = g.jobs.complete('apapa-port');
    be.data.stats.hunger = 80;
    be.restoreEnergy(100);
    const fed = g.jobs.complete('apapa-port');
    return { hungry, fed };
  });
  check('away: a shift worked starving is docked a fifth (₦6,000 becomes ₦4,800) and says why; fed, the full rate is paid',
    shift.hungry.ok && shift.hungry.pay === 4_800 && /You worked hungry/.test(shift.hungry.docked ?? '') && shift.fed.ok && shift.fed.pay === 6_000 && !shift.fed.docked,
    shift);

  check('away: no errors', log.errors.length === 0, log.errors.slice(0, 5));
}
