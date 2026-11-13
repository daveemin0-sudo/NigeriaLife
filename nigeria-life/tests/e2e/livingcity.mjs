// The living city, stage 1: the crowd at three levels of detail.
//
// People the camera can see are moved every frame, as before. People in range but out of view are
// moved every second frame, and people out of range (or at home at that hour) every fourth, each by
// all the time that has passed since their turn. So the street costs a fraction of the work and
// nobody falls behind: a walker far from the player is where their pace would have taken them.
import { newPlayer, open, closeDialogs, wait } from './lib.mjs';

export async function run(browser, check) {
  const ctx = await newPlayer(browser);
  const { page, log } = await open(ctx, { w: 316, h: 700 });
  await closeDialogs(page);

  const crowdNow = (hour) => page.evaluate(async (hour) => {
    const g = window.game;
    const w = g.world;
    w.skyEnvironment.setHour(hour);
    for (let i = 0; i < 8; i++) g.advance(0.25);
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    const city = w.cityManager.currentCityId;
    const crowd = city === 'lagos' ? w.cityPopulation : w.cityManager.lifeHere().crowd;
    const p = g.player.position;
    const frustum = w.frustumNow();
    let moved = 0;
    let seen = 0;
    const frames = 16;
    for (let i = 0; i < frames; i++) {
      crowd.update(1 / 30, p, frustum);
      moved += crowd.movedNow;
      seen += crowd.seenNow;
    }
    const drawn = crowd.variants.reduce((n, v) => n + v.drawn + v.drawnFar, 0);
    return { city, hour, agents: crowd.agents.length, out: crowd.outNow, movedPerFrame: +(moved / frames).toFixed(1), seenPerFrame: +(seen / frames).toFixed(1), seenLast: crowd.seenNow, drawn };
  }, hour);

  // ------------------------------------------------------------------ Lagos: a fraction of the work
  const morning = await crowdNow(8);
  const night = await crowdNow(2);
  check('livingcity: on Broad Street at 8 am everyone is out, and well under half of them are moved in any one frame (the rest wait their turn)',
    morning.agents > 300 && morning.out === morning.agents && morning.movedPerFrame < morning.agents * 0.45 && morning.movedPerFrame >= morning.agents / 4 - 1, morning);
  check('livingcity: those who are drawn are exactly those moved as seen: nobody in view is skipped',
    morning.drawn === morning.seenLast && morning.drawn > 0, morning);
  check('livingcity: at 2 am most are at home and the street costs less again', night.out < morning.out * 0.2 && night.movedPerFrame < morning.movedPerFrame, night);

  // ------------------------------------------------------------------ Nobody falls behind
  const pace = await page.evaluate(() => {
    const g = window.game;
    const w = g.world;
    w.skyEnvironment.setHour(8);
    const crowd = w.cityPopulation;
    const p = g.player.position;
    const SECONDS = 4;
    const frustum = w.frustumNow();
    // Plain walkers out of the player's range, with room ahead of them for the whole test
    const picked = crowd.agents.filter((a) => {
      if (a.mode !== 'walk' || a.errand || a.willCross || a.stop !== undefined || a.crossing !== undefined) return false;
      if (Math.hypot(a.x - p.x, a.z - p.z) < crowd.drawDistance + 15) return false;
      const along = a.axis === 'x' ? a.x : a.z;
      const room = a.dir > 0 ? a.max - along : along - a.min;
      return room > a.speed * SECONDS + 2;
    });
    const before = picked.map((a) => ({ at: a.axis === 'x' ? a.x : a.z, dir: a.dir }));
    // The crowd's own clock, a frame at a time (the game's fast-forward does not run it in full)
    for (let k = 0; k < SECONDS * 30; k++) crowd.update(1 / 30, p, frustum);
    // Someone who turned back on the way is not a measure of pace
    const kept = picked.map((a, i) => ({ a, was: before[i] })).filter(({ a, was }) => a.dir === was.dir && !a.errand && a.crossing === undefined).slice(0, 40);
    const off = kept.map(({ a, was }) => Math.abs(Math.abs((a.axis === 'x' ? a.x : a.z) - was.at) - a.speed * SECONDS));
    return { n: kept.length, worst: +Math.max(...off).toFixed(2), mean: +(off.reduce((t, v) => t + v, 0) / off.length).toFixed(2) };
  });
  check('livingcity: walkers far out of range, watched for four seconds of the crowd\'s clock, are each within 0.3 m of where their own pace puts them (a turn is at most three frames late)',
    pace.n >= 20 && pace.worst < 0.3, pace);

  // ------------------------------------------------------------------ Turn round: they are there
  const turned = await page.evaluate(async () => {
    const g = window.game;
    const w = g.world;
    w.skyEnvironment.setHour(8);
    const crowd = w.cityPopulation;
    const count = () => crowd.variants.reduce((n, v) => n + v.drawn + v.drawnFar, 0);
    const seen = [];
    for (const yaw of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) {
      g.cameraManager.yaw = yaw;
      for (let i = 0; i < 6; i++) g.advance(0.25);
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      seen.push(count());
    }
    return seen;
  });
  check('livingcity: looking each way along and across the street, people are drawn in every direction that has pavement in it', turned.filter((n) => n > 0).length >= 3, turned);

  // ------------------------------------------------------------------ The other cities
  for (const city of ['abuja', 'port_harcourt']) {
    await page.evaluate((c) => window.game.arriveInCity(c), city);
    await wait(3500);
    const there = await crowdNow(8);
    check(`livingcity: ${city === 'abuja' ? 'Abuja' : 'Port Harcourt'} at 8 am: its own crowd is out, and well under half of them are moved in any one frame`,
      there.city === city && there.agents > 300 && there.out === there.agents && there.movedPerFrame < there.agents * 0.45, there);
  }
  check('livingcity: no errors in the page', log.errors.length === 0, log.errors.slice(0, 4));
  await ctx.close();
}
