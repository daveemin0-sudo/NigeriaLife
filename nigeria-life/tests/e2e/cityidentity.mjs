// City identity slice: Abuja / Port Harcourt / Lagos must not read as one city copied thrice.
import { open, newPlayer, closeDialogs, wait } from './lib.mjs';
import { mkdirSync } from 'node:fs';

const SHOTS = process.env.SHOTS || '/opt/cursor/artifacts';
mkdirSync(SHOTS, { recursive: true });

const snap = async (page, name) => {
  await page.evaluate(() => {
    document.body.classList.add('lx-clean');
    document.querySelectorAll('.game-toast, #game-toast-container').forEach((el) => el.remove());
    window.game.render();
  });
  await wait(300);
  await page.screenshot({ path: `${SHOTS}/cityidentity-${name}.png` });
};

export async function run(browser, check) {
  const ctx = await newPlayer(browser);
  const { page, log } = await open(ctx, { w: 1280, h: 720 });
  await closeDialogs(page);

  const districts = await page.evaluate(() => {
    const g = window.game;
    return {
      abuja: g.modules.abujaIdentity(),
      ph: g.modules.phIdentity(),
    };
  });

  check('cityidentity: Abuja has a full planned-district set with wide setbacks',
    districts.abuja.districts >= 10 && districts.abuja.wideSetbacks >= 4, districts.abuja);
  check('cityidentity: Port Harcourt has industrial Trans-Amadi and tight market setbacks',
    districts.ph.districts >= 9 && districts.ph.hasIndustrial && districts.ph.tightSetbacks >= 4, districts.ph);
  check('cityidentity: Abuja and PH district colour palettes are not identical',
    districts.abuja.colours.some((c) => !districts.ph.colours.includes(c))
      && districts.ph.colours.some((c) => !districts.abuja.colours.includes(c)),
    { abuja: districts.abuja.colours.length, ph: districts.ph.colours.length });

  // Lagos traffic fingerprint (danfo / okada / keke alive)
  const lagos = await page.evaluate(() => {
    const g = window.game;
    g.arriveInCity('lagos');
    g.player.stopMoving();
    g.player.mesh.position.set(-2, 0, 8);
    g.world.skyEnvironment.setHour(12.5);
    const t = g.world.trafficSpawner;
    t.abroad = 1;
    for (let i = 0; i < 20; i++) t.update(0.05, g.player.position, null);
    const kinds = new Set();
    for (const lane of t.lanes) for (const c of lane.cars) kinds.add(t.batches[c.kind].spec.kind);
    g.render();
    return { kinds: [...kinds].sort(), fleet: t.vehicleCount };
  });
  await snap(page, '01-lagos');
  check('cityidentity: Lagos still reads as commercial bus / okada / keke city',
    lagos.kinds.includes('danfo') && lagos.kinds.includes('okada') && lagos.kinds.includes('keke'), lagos);

  const abuja = await page.evaluate(async () => {
    const g = window.game;
    g.arriveInCity('abuja');
    await new Promise((r) => setTimeout(r, 400));
    g.player.stopMoving();
    g.player.mesh.position.set(-12, 0, 10);
    g.world.skyEnvironment.setHour(12.5);
    const life = g.world.cityManager.lifeHere();
    if (!life) return { built: false };
    life.update(0.05, g.player.position, null, 12.5, { halfWidth: 0.35, halfLength: 1.4 }, []);
    for (let i = 0; i < 25; i++) life.update(0.05, g.player.position, null, 12.5, { halfWidth: 0.35, halfLength: 1.4 }, []);
    const kinds = new Set();
    for (const lane of life.traffic.lanes) for (const c of lane.cars) kinds.add(life.traffic.batches[c.kind].spec.kind);
    g.render();
    return { built: true, kinds: [...kinds].sort(), id: life.identity(), crowd: life.crowd.count };
  });
  await snap(page, '02-abuja');
  check('cityidentity: Abuja centre bans okada/keke/danfo and favours SUV/police',
    abuja.built && !abuja.kinds.includes('okada') && !abuja.kinds.includes('keke') && !abuja.kinds.includes('danfo')
      && (abuja.kinds.includes('suv') || abuja.kinds.includes('sedan')) && abuja.id.mix.police >= 2,
    abuja);
  check('cityidentity: Abuja street life is orderly (wider gaps, fewer walkers than PH)',
    abuja.built && abuja.id.gap >= 20 && abuja.id.walkers < 120, abuja.id);

  const ph = await page.evaluate(async () => {
    const g = window.game;
    g.arriveInCity('port_harcourt');
    await new Promise((r) => setTimeout(r, 400));
    g.player.stopMoving();
    g.player.mesh.position.set(-12, 0, 10);
    g.world.skyEnvironment.setHour(12.5);
    const life = g.world.cityManager.lifeHere();
    if (!life) return { built: false };
    for (let i = 0; i < 25; i++) life.update(0.05, g.player.position, null, 12.5, { halfWidth: 0.35, halfLength: 1.4 }, []);
    const kinds = new Set();
    for (const lane of life.traffic.lanes) for (const c of lane.cars) kinds.add(life.traffic.batches[c.kind].spec.kind);
    g.render();
    return { built: true, kinds: [...kinds].sort(), id: life.identity(), crowd: life.crowd.count };
  });
  await snap(page, '03-portharcourt');
  check('cityidentity: Port Harcourt is keke/tanker city (no okadas)',
    ph.built && !ph.kinds.includes('okada') && ph.kinds.includes('keke')
      && (ph.kinds.includes('tanker') || ph.kinds.includes('truck')) && ph.id.mix.keke >= 1.5 && ph.id.mix.tanker >= 2,
    ph);
  check('cityidentity: Port Harcourt street life is denser than Abuja',
    ph.built && abuja.built && ph.id.walkers > abuja.id.walkers && ph.id.gap < abuja.id.gap, { ph: ph.id, abuja: abuja.id });

  check('cityidentity: no page errors', log.errors.length === 0, log.errors.slice(0, 4));
}
