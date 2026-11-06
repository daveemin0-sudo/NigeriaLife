// Every home is its own place, and work is a shift. Two flats rented: each one entered is that
// flat (its own name, its own furniture, its own fridge), and Home goes back to the one last gone
// into, after a reload too. A car never stands parked across a way in. At the refinery, sent from
// the phone, the player is taken straight to the supervisor, taken on, and works a whole shift in
// a hard hat and vest, kept in the room till it is done.
import { open, newPlayer, closeDialogs, wait, advance, reload, playUntil } from './lib.mjs';

const choices = (page) => page.evaluate(() => [...document.querySelectorAll('#game-dialogue-overlay button')].map((b) => b.textContent.replace(/\s+/g, ' ').trim()).filter(Boolean));
const choose = (page, text) => page.evaluate((t) => [...document.querySelectorAll('#game-dialogue-overlay button')].find((b) => b.textContent.includes(t))?.click(), text);

export async function run(browser, check) {
  const ctx = await newPlayer(browser);
  const { page, log } = await open(ctx);
  await closeDialogs(page);

  // ------------------------------------------------------------------ Two homes, each its own
  const rented = await page.evaluate(() => {
    const g = window.game;
    const be = g.hud.backend;
    be.performGig(5_000_000, 0, 'test: money for two homes');
    const a = be.rentProperty('prop_mainland_apt');
    const b = be.rentProperty('prop_ikeja_apt');
    return { a: a.success, b: b.success };
  });
  const into = async (propId) => {
    await page.evaluate((id) => window.game.hud.onEnterInterior(`residence:${id}`), propId);
    await playUntil(page, () => (window.game.world.interiorManager.currentInterior?.type === 'residence' && !window.game.world.interiorManager.busy ? true : null), 20);
    await wait(500);
    return page.evaluate(() => {
      const g = window.game;
      const r = g.world.interiorManager;
      const decor = g.modules.HouseDecorationSystem.getInstance();
      return { inside: r.currentInterior?.type, name: r.residence.def.name, area: r.residence.def.districtName, home: decor.homeId };
    });
  };
  const leave = async () => {
    await page.evaluate(() => { const g = window.game; return g.world.interiorManager.exitCurrentInterior(g.player, g.cameraManager, g.hud, g.world); });
    await wait(1500);
  };
  const first = await into('prop_mainland_apt');
  await leave();
  const second = await into('prop_ikeja_apt');
  await leave();
  check('homes: two flats rented are two homes: going into each shows that one, by its own name, with its own furniture',
    rented.a && rented.b && first.inside === 'residence' && second.inside === 'residence' && first.name !== second.name && first.home !== second.home, { rented, first, second });

  // Home goes to the one last gone into, and still does after a reload
  await page.evaluate(() => document.getElementById('nav-btn-home')?.click());
  await playUntil(page, () => (window.game.world.interiorManager.currentInterior?.type === 'residence' && !window.game.world.interiorManager.busy ? true : null), 20);
  const viaHome = await page.evaluate(() => ({ name: window.game.world.interiorManager.residence.def.name, inside: window.game.world.interiorManager.currentInterior?.type }));
  await leave();
  await reload(page);
  await closeDialogs(page);
  await page.evaluate(() => document.getElementById('nav-btn-home')?.click());
  await playUntil(page, () => (window.game.world.interiorManager.currentInterior?.type === 'residence' && !window.game.world.interiorManager.busy ? true : null), 20);
  const afterReload = await page.evaluate(() => ({ name: window.game.world.interiorManager.residence.def.name }));
  await leave();
  check('homes: the Home button goes back to the home last gone into, and after a reload too',
    viaHome.inside === 'residence' && viaHome.name === second.name && afterReload.name === second.name, { viaHome, afterReload, last: second.name });

  // ------------------------------------------------------------------ No car parked across a way in
  const parking = await page.evaluate(() => {
    const g = window.game;
    const t = g.world.trafficSpawner;
    const shown = t.parked.filter((c) => !c.cleared);
    // Every plot's front and every door: none has a parked car within 3 m of it along the kerb
    const ways = g.world.interactiveObjects.map((o) => o.interactionPoint).filter(Boolean);
    let blocking = 0;
    for (const car of shown) {
      const c = Math.cos(car.yaw), s = Math.sin(car.yaw);
      const half = t.batches[car.kind].length / 2;
      if (ways.some((p) => Math.abs((p.x - car.x) * s + (p.z - car.z) * c) < half + 3 && Math.abs((p.x - car.x) * c - (p.z - car.z) * s) < 6)) blocking += 1;
    }
    return { parked: t.parked.length, cleared: t.parked.length - shown.length, blocking };
  });
  check('homes: no car is left parked across a gate, a driveway or a door; parking is on one side of a quiet street',
    parking.parked > 10 && parking.cleared > 0 && parking.blocking === 0, parking);

  // ------------------------------------------------------------------ A shift at the refinery
  await page.evaluate(() => {
    const g = window.game;
    g.world.skyEnvironment.setHour(10);
    const be = g.hud.backend;
    be.getData().stats.energy = 100;
    be.getData().stats.hunger = 100;
    be.saveData();
  });
  await page.evaluate(() => {
    const g = window.game;
    window.__shifts = g.modules.Shifts;
  });
  const sent = await page.evaluate(async () => {
    const g = window.game;
    const Shifts = window.__shifts;
    if (!Shifts) return { exposed: false };
    Shifts.arriving = 'dangote-refinery-ops';
    await g.world.interiorManager.enterInterior('interior_place_dangote-refinery', g.player, g.cameraManager, g.hud, g.world);
    return { exposed: true, inside: g.world.interiorManager.currentInterior?.id };
  });
  // The supervisor is walked up to, then speaks
  const offered = (await playUntil(page, () => {
    const found = [...document.querySelectorAll('#game-dialogue-overlay button')].map((x) => x.textContent.replace(/\s+/g, ' ').trim()).filter(Boolean);
    return found.length ? found : null;
  }, 12)) ?? [];
  check('work: sent from the phone to the refinery, on arrival the player is taken to the supervisor, who offers the job and a shift',
    sent.exposed && sent.inside === 'interior_place_dangote-refinery' && offered.some((c) => /start a shift/i.test(c)), { sent, offered });
  await choose(page, 'start a shift now');
  await wait(2500);
  const started = await page.evaluate(() => ({ shift: window.__shifts.current ? { ...window.__shifts.current } : null, uniform: window.game.player.uniform?.outfit ?? null, hat: window.game.player.uniform?.hat ?? null }));
  // Trying to leave in the middle of it
  const held = await page.evaluate(() => window.game.world.interiorManager.constructor.holdIn?.());
  check('work: the shift starts in work clothes (hard hat and vest at the refinery), and the player cannot walk out in the middle of it',
    started.shift?.total === 4 && started.uniform === 'engineer_vest' && started.hat === 'hardhat' && /on shift/i.test(held ?? ''), { started, held });
  const before = await page.evaluate(() => window.game.hud.backend.getData().walletCash + window.game.hud.backend.getData().bank.balance);
  const over = await playUntil(page, () => (window.__shifts.current ? null : { uniform: window.game.player.uniform }), 240);
  const after = await page.evaluate(() => window.game.hud.backend.getData().walletCash + window.game.hud.backend.getData().bank.balance);
  check('work: the whole shift is worked piece after piece, each one paid; at the end the player is back in their own clothes and free to go',
    !!over && over.uniform === null && after > before && !(await page.evaluate(() => window.game.world.interiorManager.constructor.holdIn?.())), { over, paid: after - before });

  check('homes: no errors in the page', log.errors.length === 0, log.errors.slice(0, 5));
  await ctx.close();
}
