// Convoys: the governor's goes down the expressway at its hours, sirens on, the traffic pulling
// aside, and stops behind anyone in its way; the player hires an escort or a full convoy at the
// Police Command, and it follows them whenever they drive, the traffic pulling aside for them too.
import { open, newPlayer, closeDialogs, advance, wait, playUntil, money } from './lib.mjs';

const governor = (page) => page.evaluate(() => {
  const c = window.game.convoys.governor;
  return { run: !!c.run, head: Math.round(c.head), speed: +c.speed.toFixed(1), visible: c.group.visible, cars: c.cars.length, kinds: c.cars.map((x) => x.kind) };
});
/** Cars in the lane the governor's morning run takes, near its front, and how far they have pulled over */
const yielding = (page) => page.evaluate(() => {
  const g = window.game;
  const head = g.convoys.governor.head;
  const lane = g.world.trafficSpawner.lanes.find((l) => l.axis === 'z' && l.fixed === -1.8 && l.dir === 1);
  return lane.cars.filter((c) => c.u - head > 2 && c.u - head < 60).map((c) => +(c.aside ?? 0).toFixed(2));
});

export async function run(browser, check) {
  const ctx = await newPlayer(browser);
  const { page, log } = await open(ctx);
  await closeDialogs(page);
  await page.evaluate(() => { const g = window.game; g.hud.backend.data.bank.balance += 10_000_000; g.hud.backend.saveData(); g.world.skyEnvironment.setHour(10); g.player.mesh.position.set(-30, 0, 400); });

  // ------------------------------------------------------------------ The governor's convoy, and the traffic pulling aside
  await page.evaluate(() => window.game.convoys.governor.start(0));
  await advance(page, 1);
  const g0 = await governor(page);
  await advance(page, 2);
  const g1 = await governor(page);
  const aside = await yielding(page);
  const sirens = await page.evaluate(() => window.game.world.trafficSpawner.sirens.length);
  check('convoys: the governor’s convoy runs down the expressway (two outriders, a patrol van, the black jeep with the flag, two escort jeeps, an ambulance), sirens on',
    g1.visible && g1.cars === 7 && g1.kinds.join() === 'bike,bike,patrol,principal,jeep,jeep,ambulance' && g1.head - g0.head > 40 && sirens === 1, { g0, g1, sirens });
  check('convoys: the cars ahead of it in its lane pull over to the edge of the road and slow', aside.length > 0 && aside.every((a) => a > 1), { aside });

  // ------------------------------------------------------------------ Somebody in its way
  const danfo = await page.evaluate(() => {
    const g = window.game;
    const v = g.world.vehicles.drivableVehicles.find((x) => x.type === 'danfo');
    g.enterVehicle(v);
    v.mesh.position.set(-1.8, 0, g.convoys.governor.head + 22);
    v.mesh.rotation.y = 0;
    return v.id;
  });
  await advance(page, 3);
  const stuck = await governor(page);
  const gap = await page.evaluate(() => window.game.player.currentVehicle.mesh.position.z - window.game.convoys.governor.head);
  const told = await page.evaluate(() => /Pull aside and let it pass/.test(document.body.innerText));
  await page.evaluate(() => { const v = window.game.player.currentVehicle; v.mesh.position.x = -8; });
  await advance(page, 2.5);
  const moved = await governor(page);
  check('convoys: with the player’s danfo in its lane it slows and stops behind, and the player is told to pull aside; once clear it goes on',
    stuck.speed < 2 && gap > 2 && gap < 26 && told && moved.speed > 10, { stuck, gap: +gap.toFixed(1), told, moved });
  await page.evaluate(() => { const c = window.game.convoys.governor; c.run = null; c.group.visible = false; });

  // ------------------------------------------------------------------ It sets out at its hour
  await page.evaluate(() => { const g = window.game; g.player.currentVehicle.mesh.position.set(-8, 0, 300); g.world.skyEnvironment.setHour(7.45); });
  await advance(page, 0.5);
  const out = await playUntil(page, () => (window.game.convoys.governor.run ? true : null), 20);
  const warned = await page.evaluate(() => /The Governor’s convoy is coming down the expressway/.test(document.body.innerText));
  check('convoys: at half past seven in the morning it sets out from the island for Government House, and the player on the expressway hears the sirens coming',
    !!out && warned, { out, warned });
  await page.evaluate(() => { const c = window.game.convoys.governor; c.run = null; c.group.visible = false; window.game.world.skyEnvironment.setHour(10); });

  // ------------------------------------------------------------------ Hiring a convoy of one's own at the Police Command
  await page.evaluate(() => window.game.exitVehicle());
  await advance(page, 0.5);
  await page.evaluate(() => {
    const g = window.game;
    const card = g.world.interactiveObjects.find((o) => o.id === 'roadside-police-command');
    g.player.stopMoving();
    g.player.mesh.position.set(card.interactionPoint.x, 0, card.interactionPoint.z);
    g.hud.showInteractionCard(card);
    document.getElementById('card-action-btn')?.click();
  });
  await playUntil(page, () => (window.game.world.interiorManager.currentInterior && !window.game.world.interiorManager.isTransitioning ? true : null), 20);
  const m0 = await money(page);
  await page.evaluate(() => { const g = window.game; const o = g.world.interiorManager.getActiveInteractiveObjects().find((x) => x.id === 'place_police-command_escort'); g.player.mesh.position.set(o.interactionPoint.x, 0, o.interactionPoint.z); g.hud.showInteractionCard(o); document.getElementById('card-action-btn')?.click(); });
  await wait(300);
  await page.evaluate(() => [...document.querySelectorAll('#game-dialogue-overlay button')].find((b) => /A full convoy/.test(b.textContent))?.click());
  await wait(400);
  const m1 = await money(page);
  const hired = await page.evaluate(() => { const e = window.game.convoys.escort; return { level: e.level, until: e.until, day: window.game.world.skyEnvironment.day, cars: e.cars.map((c) => c.kind) }; });
  check('convoys: a full convoy is hired at the Police Command’s escort desk, ₦3.6m for three days: outriders, a patrol van, two jeeps',
    m0.total - m1.total === 3_600_000 && hired.level === 'convoy' && hired.until === hired.day + 2 && hired.cars.join() === 'bike,bike,patrol,jeep,jeep', { paid: m0.total - m1.total, hired });
  await page.evaluate(() => { const g = window.game; return g.world.interiorManager.exitCurrentInterior(g.player, g.cameraManager, g.hud, g.world); });
  await wait(1200);

  // ------------------------------------------------------------------ It follows the player as they drive
  await page.evaluate(() => {
    const g = window.game;
    const v = g.world.vehicles.drivableVehicles.find((x) => x.type === 'danfo');
    g.enterVehicle(v);
    v.mesh.position.set(-4.9, 0, 500);
    v.mesh.rotation.y = 0;
  });
  for (let i = 0; i < 40; i++) await page.evaluate(async () => { const g = window.game; g.player.currentVehicle.mesh.position.z += 1.5; await g.advance(0.06); });
  const following = await page.evaluate(() => {
    const g = window.game;
    const me = g.player.currentVehicle.mesh.position;
    const cars = g.convoys.escort.cars.map((c) => ({ kind: c.kind, x: +c.group.position.x.toFixed(1), behind: +(me.z - c.group.position.z).toFixed(1) }));
    return { visible: g.convoys.escort.group.visible, cars, sirens: g.world.trafficSpawner.sirens.map((s) => ({ x: s.x, dir: s.dir })) };
  });
  const inOrder = following.cars.every((c, i) => c.behind > 3 && Math.abs(c.x + 4.9) < 0.6 && (i === 0 || c.behind > following.cars[i - 1].behind));
  check('convoys: driving down the expressway, the convoy follows in line behind the player, sirens on for the traffic ahead',
    following.visible && following.cars.length === 5 && inOrder && following.sirens.some((s) => s.x === -4.9 && s.dir === 1), following);

  // ------------------------------------------------------------------ Kept
  await page.reload({ waitUntil: 'load' });
  await page.waitForFunction('window.game && window.game.convoys', { timeout: 120000 });
  await wait(2500);
  const kept = await page.evaluate(() => ({ level: window.game.convoys.escort.level, until: window.game.convoys.escort.until }));
  check('convoys: the hired convoy is kept across a reload', kept.level === 'convoy' && kept.until === hired.until, kept);

  check('convoys: no errors in the page', log.errors.length === 0, log.errors.slice(0, 5));
  await ctx.close();
}
