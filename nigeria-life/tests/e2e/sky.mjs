// The sky follows the clock smoothly: no jump at any hour, the same clouds all day, reflections
// made once per part of the day, overcast greys it, and real time is Lagos time from the
// Africa/Lagos time zone. Checked on what is drawn, not only on the numbers.
import { open, newPlayer, closeDialogs } from './lib.mjs';

/** Sets the clock, brings the sky up to date and draws a frame looking up at it; returns the colour high in the middle of the screen. */
const skyAt = (page, hour) =>
  page.evaluate((hour) => {
    const g = window.game;
    const sky = g.world.skyEnvironment;
    sky.setHour(hour);
    sky.update(0, g.player.position);
    const cam = g.cameraManager.camera;
    const p = g.player.position;
    cam.position.set(p.x, 40, p.z);
    cam.lookAt(p.x + 60, 70, p.z);
    cam.updateMatrixWorld();
    g.render();
    const small = document.createElement('canvas');
    small.width = 64;
    small.height = 36;
    const ctx = small.getContext('2d');
    ctx.drawImage(g.renderer.domElement, 0, 0, 64, 36);
    const d = ctx.getImageData(32, 8, 1, 1).data;
    return { r: d[0], g: d[1], b: d[2], env: sky.envByPeriod ? [...sky.envByPeriod.keys()].length : null };
  }, hour);

export async function run(browser, check) {
  const ctx = await newPlayer(browser);
  const { page, log } = await open(ctx);
  await closeDialogs(page);

  // 1. Sweep the day in three-minute steps across every hour the old sky changed picture
  const samples = [];
  for (let h = 4; h <= 22.001; h += 0.05) samples.push({ h: +h.toFixed(2), ...(await skyAt(page, h)) });
  let worst = { step: 0, at: null };
  for (let i = 1; i < samples.length; i++) {
    const a = samples[i - 1];
    const b = samples[i];
    const step = Math.max(Math.abs(a.r - b.r), Math.abs(a.g - b.g), Math.abs(a.b - b.b));
    if (step > worst.step) worst = { step, at: `${a.h} -> ${b.h}`, from: [a.r, a.g, a.b], to: [b.r, b.g, b.b] };
  }
  // The quickest real change is the tropical dawn, about 11 of 255 in three minutes; the old sky jumped 156 at 5:48
  check('sky: across the day, three minutes never changes the drawn sky by more than 16 of 255 in any channel (no jumps at set hours)', worst.step <= 16, worst);

  const noon = samples.find((s) => s.h === 12);
  const night = samples.find((s) => s.h === 22);
  const lum = (s) => 0.299 * s.r + 0.587 * s.g + 0.114 * s.b;
  check('sky: the drawn sky is blue at noon and dark at ten at night', noon.b > noon.r && lum(noon) > 120 && lum(night) < 60, { noon, night });

  // 2. Reflections are made once per part of the day, and the same one is used each time it comes round
  const reuse = await page.evaluate(() => {
    const g = window.game;
    const sky = g.world.skyEnvironment;
    const seen = new Map();
    let changedOnReturn = false;
    for (let pass = 0; pass < 2; pass++) {
      for (const h of [8, 13, 17.5, 22]) {
        sky.setHour(h);
        sky.update(0, g.player.position);
        const period = sky.currentPeriod;
        if (pass === 0) seen.set(period, g.scene.environment);
        else if (seen.get(period) !== g.scene.environment) changedOnReturn = true;
      }
    }
    return { periods: seen.size, changedOnReturn };
  });
  check('sky: a part of the day that comes round again reuses its reflections instead of making new ones', reuse.periods === 4 && !reuse.changedOnReturn, reuse);

  // 3. Overcast drains the colour out of the drawn sky
  const sunny = await skyAt(page, 12);
  await page.evaluate(async () => {
    const g = window.game;
    g.world.weather.setWeather('overcast');
    for (let i = 0; i < 60; i++) g.world.weather.update(0.1, g.player.position);
  });
  const grey = await skyAt(page, 12);
  await page.evaluate(async () => {
    const g = window.game;
    g.world.weather.setWeather('sunny');
    for (let i = 0; i < 60; i++) g.world.weather.update(0.1, g.player.position);
  });
  const chroma = (s) => Math.max(s.r, s.g, s.b) - Math.min(s.r, s.g, s.b);
  check('sky: under overcast the noon sky is greyer than when sunny', chroma(grey) < chroma(sunny) * 0.75, { sunny, grey });

  // 4. Real time is Lagos time, from the time zone: including just after midnight Lagos time
  const zone = await page.evaluate(() => {
    const sky = window.game.world.skyEnvironment;
    const lagos = (d) => {
      const f = new Intl.DateTimeFormat('en-GB', { timeZone: 'Africa/Lagos', hourCycle: 'h23', hour: 'numeric', minute: 'numeric' });
      const [hh, mm] = f.format(d).split(':').map(Number);
      return hh + mm / 60;
    };
    const late = new Date('2026-01-15T23:30:00Z');
    const now = new Date();
    sky.setClockMode('REAL_TIME');
    sky.update(0.016);
    return {
      lateGame: sky.lagosHourNow(late),
      lateZone: lagos(late),
      nowGame: sky.currentHour,
      nowZone: lagos(now),
      mode: sky.clockMode,
    };
  });
  check(
    'sky: real time is the hour in Lagos (Africa/Lagos time zone), right across midnight',
    Math.abs(zone.lateGame - zone.lateZone) < 0.02 && Math.abs(zone.nowGame - zone.nowZone) < 0.05 && zone.mode === 'REAL_TIME',
    zone
  );

  check('sky: no errors in the page', log.errors.length === 0, log.errors.slice(0, 5));
  await ctx.close();
}
