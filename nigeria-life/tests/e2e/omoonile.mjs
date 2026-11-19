// Land that rises with the years, and omo-onile (src/realestate/PlotCatalogue.ts, Land.ts): a
// plot's state price grows by its neighbourhood's rate; the owner sees what it is worth now and
// how far it has come; in the neighbourhoods they work, a family stops the first block until their
// foundation levy is paid; a report to the task force runs them off or doubles it; on Eko
// Atlantic or Victoria Island nobody comes; the family's dialogue pays and lets the work start.
import { open, newPlayer, closeDialogs, wait, money } from './lib.mjs';

export async function run(browser, check) {
  const ctx = await newPlayer(browser);
  const { page, log } = await open(ctx, { w: 1280, h: 760 });
  await closeDialogs(page);
  const start = await page.evaluate(() => {
    const g = window.game;
    const sky = g.world.skyEnvironment;
    sky.timeScale = 0;
    sky.setHour(11);
    const be = g.hud.backend;
    be.data.bank.balance = 20_000_000_000;
    be.saveData();
    const plots = g.land.plots('lagos');
    const levied = plots.filter((p) => g.land.levyFor(p.id, 50_000_000) && !g.land.ownerOf(p.id));
    const free = plots.find((p) => ['eko_atlantic', 'victoria_island', 'banana_island'].includes(p.districtId));
    return { day: sky.day, levied: levied.map((p) => ({ id: p.id, district: p.districtId, growth: p.growth })), free: free ? { id: free.id, district: free.districtId } : null, districts: [...new Set(plots.map((p) => p.districtId))] };
  });
  check('omoonile: some Lagos plots are where omo-onile work, and some are on estates where nobody comes', start.levied.length >= 2 && !!start.free, start);

  // ------------------------------------------------------------------ Land rises with the years
  const rise = await page.evaluate(([id, d0]) => {
    const g = window.game;
    const sky = g.world.skyEnvironment;
    const plot = g.land.plot(id);
    sky.setDay(0);
    const day0 = plot.statePrice;
    sky.setDay(365);
    const year1 = plot.statePrice;
    sky.setDay(d0);
    return { base: plot.basePrice, day0, year1, growth: plot.growth, now: plot.statePrice };
  }, [start.levied[0].id, start.day]);
  check('omoonile: a plot\'s state price on day 0 is its base, and a year on it has risen by its neighbourhood\'s rate',
    rise.day0 === rise.base && Math.abs(rise.year1 - rise.base * (1 + rise.growth)) <= 50_000 && rise.year1 > rise.day0 && rise.now >= rise.day0,
    rise);

  // ------------------------------------------------------------------ Bought, and worth more later
  const plotId = start.levied[0].id;
  const bought = await page.evaluate((id) => window.game.land.buyFromState(id), plotId);
  await page.evaluate((d) => window.game.world.skyEnvironment.setDay(d + 200), start.day);
  await page.evaluate((id) => { window.game.hud.phoneModal.open(); window.game.hud.phoneModal.openApp('land', `plot:${id}`); }, plotId);
  await wait(700);
  const page1 = await page.evaluate(() => ({ value: document.getElementById('land-value')?.innerText ?? '', omo: document.getElementById('land-omo-onile')?.innerText ?? '' }));
  await page.evaluate(() => window.game.hud.phoneModal.close());
  check('omoonile: the owner\'s plot page says what the land is worth today, how fast it rises, and how far it has come since they paid; and that the family will ask a levy before building',
    bought.ok && /About ₦[\d,]+ today · land here rises about \d+% a year · \+\d+% on the ₦[\d,]+ you paid/.test(page1.value) && /family will ask a foundation levy/.test(page1.omo),
    { bought, page1 });

  // ------------------------------------------------------------------ The levy before the first block
  const levy = await page.evaluate(async (id) => {
    const g = window.game;
    const designs = g.land.designsFor(id).filter((d) => !d.why);
    const type = designs.sort((a, b) => a.type.cost - b.type.cost)[0]?.type;
    const plot = g.land.plot(id);
    const x = (plot.rect.minX + plot.rect.maxX) / 2;
    const z = (plot.rect.minZ + plot.rect.maxZ) / 2;
    const spend0 = g.hud.backend.getData().bank.balance + g.hud.backend.getData().walletCash;
    const first = await g.land.startBuilding(id, type.id, x, z, 0);
    const spend1 = g.hud.backend.getData().bank.balance + g.hud.backend.getData().walletCash;
    return { type: type.id, cost: type.cost, x, z, first, unchanged: spend0 === spend1, building: !!g.land.building(id) };
  }, plotId);
  check('omoonile: starting to build is stopped by the family: their foundation levy (a share of the cost, at least ₦50,000) is asked, nothing is paid and nothing is built',
    !levy.first.ok && !!levy.first.levy && levy.first.levy.amount >= 50_000 && /foundation levy/.test(levy.first.reason) && levy.unchanged && !levy.building,
    levy);

  // Through the family's own dialogue: pay, and the work starts
  const before = await money(page);
  await page.evaluate(([id, cost, lv]) => {
    const g = window.game;
    window.__again = 0;
    g.modules.BuildBar.onLevy(g.land.plot(id), cost, lv, () => { window.__again += 1; });
  }, [plotId, levy.cost, levy.first.levy]);
  await wait(400);
  const asked = await page.evaluate(() => document.getElementById('game-dialogue-overlay')?.innerText ?? '');
  await page.evaluate(() => [...document.querySelectorAll('#game-dialogue-overlay button')].find((b) => /Pay the levy/.test(b.textContent))?.click());
  await wait(500);
  const after = await money(page);
  const built = await page.evaluate(async ([id, type, x, z]) => {
    const g = window.game;
    const again = window.__again;
    const second = await g.land.startBuilding(id, type, x, z, 0);
    return { again, second, levyNow: g.land.levyFor(id, 1), building: !!g.land.building(id) };
  }, [plotId, levy.type, levy.x, levy.z]);
  check('omoonile: the family\'s dialogue offers to pay or report them; paid, the levy leaves the account once, the building goes ahead and they do not come back for this plot',
    /foundation levy/.test(asked) && /Report them to the task force/.test(asked) && before.total - after.total === levy.first.levy.amount && built.again === 1 && built.second.ok && built.building && built.levyNow === null,
    { asked: asked.slice(0, 200), paid: before.total - after.total, built });

  // ------------------------------------------------------------------ A report to the task force
  const report = await page.evaluate((id) => {
    const g = window.game;
    const was = g.land.levyFor(id, 10_000_000);
    const back = g.land.reportLevy(id, () => 0.9);
    const doubled = g.land.levyFor(id, 10_000_000);
    const chased = g.land.reportLevy(id, () => 0.1);
    return { was, back, doubled, chased, after: g.land.levyFor(id, 10_000_000) };
  }, start.levied[1].id);
  check('omoonile: reported to the task force, the family either come back asking twice as much, or are run off and the plot is left in peace',
    !report.back.chased && report.doubled.amount === report.was.amount * 2 && report.doubled.doubled && report.chased.chased && report.after === null,
    report);

  const island = await page.evaluate((id) => window.game.land.levyFor(id, 50_000_000), start.free.id);
  check('omoonile: on an estate where land is long titled and policed (Eko Atlantic, Victoria Island, Banana Island) nobody asks a levy', island === null, { island, free: start.free });

  check('omoonile: no errors', log.errors.length === 0, log.errors.slice(0, 5));
}
