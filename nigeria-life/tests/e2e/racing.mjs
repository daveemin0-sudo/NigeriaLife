// Street racing. The Racing app lists the city's courses; a race picked there puts the grid, the
// lights and the checkpoint gates on the real road and sends the player's own car to the start.
// Stopped in the box, Start runs the lights; every gate is driven through in turn; the finish
// gives the time, the medal and the best. In a race for a stake the stake is paid at the lights,
// the street racers drive their runs on the road beside the player, and the winner is paid the
// pot. A time no car could do is not counted; getting out of the car ends the race.
import { open, newPlayer, closeDialogs, wait, advance, money } from './lib.mjs';

export async function run(browser, check) {
  const ctx = await newPlayer(browser);
  const { page, log } = await open(ctx);
  await closeDialogs(page);

  // A car of their own, at the kerb, and in it
  const bought = await page.evaluate(async () => {
    const g = window.game;
    g.world.skyEnvironment.setHour(11);
    const b = g.hud.backend;
    b.data.bank.balance += 600_000_000;
    b.saveData();
    const bought = await g.garage.buyNew('range_rover');
    return bought;
  });
  await wait(800);
  const setup = await page.evaluate(() => {
    const g = window.game;
    const car = g.ownedVehicles.ownCar();
    if (!car) return { car: null };
    g.ownedVehicles.bringRound(car.id);
    g.ownedVehicles.sync();
    const v = g.ownedVehicles.mine().find((m) => m.id === car.id)?.vehicle;
    if (v) g.enterVehicle(v);
    return { car: car?.name, driving: g.player.isDriving, own: !!g.ownedVehicles.vehicleIdOf(g.player.currentVehicle) };
  });
  await advance(page, 0.5);

  // ------------------------------------------------------------------ The app
  await page.evaluate(() => { window.game.hud.phoneModal.open(); window.game.hud.phoneModal.openApp('racing'); });
  await wait(500);
  const app = await page.evaluate(() => ({
    courses: [...document.querySelectorAll('[data-course]')].map((c) => c.dataset.course),
    trial: !!document.querySelector('[data-act="trial"][data-arg="bridge"]'),
    stakes: [...document.querySelectorAll('[data-act="stake"]')].map((b) => b.textContent.trim()),
    elsewhere: /Raced in Abuja/.test(document.body.textContent),
  }));
  check('racing: the Racing app lists the Lagos courses with a time trial and a race on each, the stakes, and the races in other cities',
    !!bought && setup.driving && setup.own && ['bridge', 'ikorodu', 'ikeja', 'island_airport'].every((id) => app.courses.includes(id)) && app.trial && app.stakes.length === 4 && app.elsewhere, { setup, app });

  // Where the start box is, in the world
  const box = (id) => page.evaluate((cid) => {
    const R = window.game.modules.RaceRules;
    const c = R.courseById(cid);
    const p = R.pointAt(c, 0);
    const lane = R.grid(c).player;
    return { x: p.x - p.dz * lane - p.dx * 3, z: p.z + p.dx * lane - p.dz * 3, yaw: Math.atan2(p.dx, p.dz) };
  }, id);
  const intoBox = async (id) => {
    const b = await box(id);
    await page.evaluate((at) => {
      const v = window.game.player.currentVehicle;
      v.mesh.position.set(at.x, 0, at.z);
      v.mesh.rotation.y = at.yaw;
      v.currentSpeed = 0;
    }, b);
    await advance(page, 0.6);
    return b;
  };
  // Drives the car up the line at a speed, one frame (a thirtieth of a second) at a time, until the race is done
  const drive = (speed, seconds) => page.evaluate(async ({ speed, seconds }) => {
    const g = window.game;
    const R = g.modules.RaceRules;
    const racing = g.modules.Racing.get();
    const c = racing.course;
    const lane = R.grid(c).player;
    let s = 0;
    const seen = [];
    const dt = 1 / 30;
    for (let t = 0; t < seconds && racing.phase === 'racing'; t += dt) {
      s += speed * dt;
      const p = R.pointAt(c, s);
      const v = g.player.currentVehicle;
      v.mesh.position.set(p.x - p.dz * lane, 0, p.z + p.dx * lane);
      v.mesh.rotation.y = Math.atan2(p.dx, p.dz);
      v.currentSpeed = speed;
      await g.advance(dt);
      if (Math.abs(t - 10) < dt / 2) seen.push({ hud: document.querySelector('#nl-race')?.textContent.replace(/\s+/g, ' ').trim(), racers: racing.field.map((r) => ({ x: +r.body.x.toFixed(1), z: +r.body.z.toFixed(1) })), bodies: g.modules.Bodies.carsNear(p.x, p.z, 200).length });
    }
    return { phase: racing.phase, s, seen };
  }, { speed, seconds });

  // ------------------------------------------------------------------ A time trial over the bridge
  await page.evaluate(() => document.querySelector('[data-act="trial"][data-arg="bridge"]')?.click());
  await wait(400);
  const going = await page.evaluate(() => ({ phase: window.game.modules.Racing.get().phase, guide: window.game.routeGuide.active, hud: document.querySelector('#nl-race')?.textContent.replace(/\s+/g, ' ').trim(), gates: window.game.scene.getObjectByName('race course')?.children.length ?? 0 }));
  check('racing: a time trial picked on the phone puts the course on the road and the arrows to the start',
    going.phase === 'going' && going.guide && /Follow the arrows/.test(going.hud ?? '') && going.gates > 4, going);

  await intoBox('bridge');
  const atGrid = await page.evaluate(() => {
    const r = window.game.modules.Racing.get();
    const start = document.querySelector('#nl-race [data-race="start"]');
    return { phase: r.phase, inBox: r.view().inBox, enabled: !!start && !start.disabled, guide: window.game.routeGuide.active };
  });
  check('racing: stopped in the box on the grid, Start can be pressed and the arrows are gone', atGrid.phase === 'grid' && atGrid.inBox && atGrid.enabled && !atGrid.guide, atGrid);

  await page.evaluate(() => document.querySelector('#nl-race [data-race="start"]')?.click());
  await wait(200);
  await advance(page, 1.2);
  const lights = await page.evaluate(() => ({ phase: window.game.modules.Racing.get().phase, count: document.getElementById('nl-race-count')?.textContent, shown: !document.getElementById('nl-race-count')?.hidden }));
  await advance(page, 2.0);
  const green = await page.evaluate(() => window.game.modules.Racing.get().phase);
  check('racing: Start runs the lights, three, two, one, and on the green the race is on', lights.phase === 'countdown' && lights.shown && ['1', '2', '3'].includes(lights.count) && green === 'racing', { lights, green });

  const trial = await drive(45, 60);
  const done = await page.evaluate(() => {
    const r = window.game.modules.Racing.get();
    const card = document.getElementById('nl-race-result');
    return { phase: r.phase, result: r.result, card: card && !card.hidden ? card.textContent.replace(/\s+/g, ' ').trim() : null, best: r.bests().bridge?.seconds ?? null };
  });
  check('racing: through every gate to the flag: the time (about 34 s at 160 km/h), gold, a new best, and the result on the screen',
    trial.phase === 'done' && done.result && !done.result.refused && Math.abs(done.result.seconds - 1500 / 45) < 1.5 && done.result.medal === 'gold' && done.result.best && /new best/i.test(done.card ?? '') && done.best === done.result.seconds,
    { trial: { phase: trial.phase }, done });
  await page.evaluate(() => document.querySelector('#nl-race-result [data-race="close"]')?.click());
  await wait(200);
  const cleared = await page.evaluate(() => ({ phase: window.game.modules.Racing.get().phase, course: !!window.game.scene.getObjectByName('race course'), panel: !document.getElementById('nl-race')?.hidden }));
  check('racing: Done takes the course off the road', cleared.phase === 'idle' && !cleared.course && !cleared.panel, cleared);

  // ------------------------------------------------------------------ A race for ₦10,000 up Ikorodu Road
  await page.evaluate(() => {
    const g = window.game;
    const R = g.modules.RaceRules;
    const p = R.pointAt(R.courseById('ikorodu'), 0);
    const v = g.player.currentVehicle;
    v.mesh.position.set(p.x, 0, p.z - 300);
  });
  await advance(page, 0.3);
  const began = await page.evaluate(() => window.game.modules.Racing.get().begin('ikorodu', 'race', 10_000));
  await intoBox('ikorodu');
  const m0 = await money(page);
  await page.evaluate(() => document.querySelector('#nl-race [data-race="start"]')?.click());
  await wait(200);
  const m1 = await money(page);
  await advance(page, 3.3);
  const race = await drive(40, 60);
  const won = await page.evaluate(() => window.game.modules.Racing.get().result);
  const m2 = await money(page);
  check('racing: the ₦10,000 stake is paid at the lights',
    began === null && m0.total - m1.total === 10_000, { began, m0, m1 });
  const mid = race.seen[0];
  check('racing: the street racers drive up the road beside the player, solid, and the panel shows the place',
    !!mid && mid.racers.length === 2 && mid.racers.every((r) => r.z > 4200 && Math.abs(r.x + 4.9) < 4.5) && mid.bodies >= 2 && /1st of 3|2nd of 3|3rd of 3/.test(mid.hud ?? ''), mid);
  check('racing: faster than the racers, the player wins and is paid the pot, less a tenth (₦27,000)',
    !!won && won.place === 1 && won.prize === 27_000 && m2.total - m1.total === 27_000 && won.field.length === 3, { won, m1, m2 });
  await page.evaluate(() => document.querySelector('#nl-race-result [data-race="close"]')?.click());
  await wait(200);

  // ------------------------------------------------------------------ A time no car could do
  await page.evaluate(() => window.game.modules.Racing.get().begin('bridge', 'trial', 0));
  await intoBox('bridge');
  await page.evaluate(() => document.querySelector('#nl-race [data-race="start"]')?.click());
  await wait(200);
  await advance(page, 3.3);
  await drive(400, 10);
  const cheat = await page.evaluate(() => ({ result: window.game.modules.Racing.get().result, best: window.game.modules.Racing.get().bests().bridge?.seconds }));
  check('racing: a time no car could have done (400 m a second) is not counted and is not the best',
    !!cheat.result?.refused && cheat.best === done.best, cheat);
  await page.evaluate(() => document.querySelector('#nl-race-result [data-race="close"]')?.click());
  await wait(200);

  // ------------------------------------------------------------------ Out of the car, the race is off
  await page.evaluate(() => window.game.modules.Racing.get().begin('bridge', 'trial', 0));
  await intoBox('bridge');
  await page.evaluate(() => document.querySelector('#nl-race [data-race="start"]')?.click());
  await wait(200);
  await advance(page, 3.3);
  await page.evaluate(() => window.game.exitVehicle());
  await advance(page, 0.5);
  const off = await page.evaluate(() => ({ phase: window.game.modules.Racing.get().phase, course: !!window.game.scene.getObjectByName('race course') }));
  check('racing: getting out of the car mid-race ends it and clears the road', off.phase === 'idle' && !off.course, off);

  check('racing: no errors in the page', log.errors.length === 0, log.errors.slice(0, 5));
  await ctx.close();
}
