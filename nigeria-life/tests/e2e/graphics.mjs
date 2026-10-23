// The graphics setting: chosen on the phone, it really changes what is drawn (pixels, shadows,
// how far away people are drawn in full), Low draws faster than High, it is kept on this
// device, and a slow machine steps itself down once and says so. Also: the driving options
// on the same screen are kept after a reload.
import { open, reload, wait, newPlayer, closeDialogs, steadyPoint } from './lib.mjs';

const PHONE = '#smartphone-wrapper';

const state = (page) =>
  page.evaluate(() => {
    const g = window.game;
    return {
      level: g.graphics.level,
      chosen: g.graphics.chosen,
      pixelRatio: g.renderer.getPixelRatio(),
      shadows: g.renderer.shadowMap.enabled && g.world.skyEnvironment.sunLight.castShadow,
      crowd: [g.world.cityPopulation.drawDistance, g.world.cityPopulation.nearDistance],
      stored: localStorage.getItem('nigerialife.graphics'),
    };
  });

const openSettings = async (page) => {
  await page.evaluate(() => window.game.hud.phoneModal.openApp('settings', ''));
  await wait(700);
};

/** Presses the row's button with the mouse, where it is on the screen. */
const press = async (page, act) => {
  await page.evaluate((sel) => document.querySelector(sel)?.scrollIntoView({ block: 'center' }), `${PHONE} [data-act="${act}"]`);
  const at = await steadyPoint(page, `${PHONE} [data-act="${act}"]`);
  if (!at) return false;
  await page.mouse.click(at.x, at.y);
  await wait(250);
  return true;
};

const rowText = (page) =>
  page.evaluate((sel) => document.querySelector(sel)?.closest('.nl-row, li, div')?.textContent?.replace(/\s+/g, ' ').trim() ?? null, `${PHONE} [data-act="toggle-graphics"]`);

const fps = (page) =>
  page.evaluate(
    () =>
      new Promise((resolve) => {
        let n = 0;
        const start = performance.now();
        const tick = (now) => {
          n++;
          if (now - start < 4000) requestAnimationFrame(tick);
          else resolve(n / ((now - start) / 1000));
        };
        requestAnimationFrame(tick);
      })
  );

export async function run(browser, check) {
  const ctx = await newPlayer(browser);
  const { page, log } = await open(ctx);
  await closeDialogs(page);
  await page.evaluate(() => {
    const g = window.game;
    g.world.skyEnvironment.setHour(12.5);
    g.player.stopMoving();
    g.player.mesh.position.set(-9, 0.28, -60);
  });

  const first = await state(page);
  check('graphics: a new device starts at High, the game as it has always looked (shadows on, people drawn in full to 22 m)', first.level === 'high' && first.shadows && first.crowd[1] === 22 && !first.chosen, first);

  await wait(4000);
  const highFps = await fps(page);

  // Balanced, then Low, from the phone
  await openSettings(page);
  const pressedOnce = await press(page, 'toggle-graphics');
  const balanced = await state(page);
  const balancedRow = await rowText(page);
  check(
    'graphics: pressing Change on the phone moves to Balanced: one pixel per screen pixel at most, people in full only to 14 m, the row says so, and the choice is kept',
    pressedOnce && balanced.level === 'balanced' && balanced.pixelRatio <= 1 && balanced.crowd[1] === 14 && /Balanced/.test(balancedRow || '') && /"chosen":true/.test(balanced.stored || ''),
    { balanced, balancedRow }
  );
  await press(page, 'toggle-graphics');
  const low = await state(page);
  check('graphics: pressed again it moves to Low: a softer picture (0.75), no sun shadows, fewer people far off', low.level === 'low' && low.pixelRatio === 0.75 && !low.shadows && low.crowd[0] === 50, low);

  await page.evaluate(() => window.game.hud.phoneModal.close?.());
  await page.keyboard.press('Escape');
  await wait(2500);
  const drawn = await page.evaluate(() => {
    const g = window.game;
    g.render();
    const c = document.createElement('canvas');
    c.width = 160;
    c.height = 90;
    const x = c.getContext('2d');
    x.drawImage(g.renderer.domElement, 0, 0, 160, 90);
    const d = x.getImageData(0, 0, 160, 90).data;
    const seen = new Set();
    for (let i = 0; i < d.length; i += 4) seen.add(((d[i] >> 4) << 8) | ((d[i + 1] >> 4) << 4) | (d[i + 2] >> 4));
    return seen.size;
  });
  const lowFps = await fps(page);
  check('graphics: at Low the street is still drawn (many colours on screen) and runs faster than at High on this machine', drawn > 60 && lowFps > highFps * 1.1, { drawnColours: drawn, highFps: +highFps.toFixed(1), lowFps: +lowFps.toFixed(1) });

  // Kept on this device
  await reload(page);
  const after = await state(page);
  check('graphics: after a reload it is still Low, as the player chose', after.level === 'low' && after.chosen && !after.shadows, after);

  // Driving options on the same screen are kept too
  await closeDialogs(page);
  await openSettings(page);
  const assistBefore = await page.evaluate(() => window.game.player.constructor && window.game.world.vehicles.drivableVehicles[0].constructor.laneAssistStrength);
  await press(page, 'toggle-lane-assist');
  const assistChosen = await page.evaluate(() => window.game.world.vehicles.drivableVehicles[0].constructor.laneAssistStrength);
  await reload(page);
  const assistAfter = await page.evaluate(() => window.game.world.vehicles.drivableVehicles[0].constructor.laneAssistStrength);
  check('graphics: a changed driving option (lane assist) is still set after a reload', assistChosen !== assistBefore && assistAfter === assistChosen, { assistBefore, assistChosen, assistAfter });
  await ctx.close();

  // A slow machine: the game steps down once and tells the player; a choice made by the player is left alone
  const ctx2 = await newPlayer(browser);
  const { page: page2 } = await open(ctx2);
  await closeDialogs(page2);
  const slow = await page2.evaluate(async () => {
    const g = window.game;
    g.graphics.stepDown(12);
    await new Promise((r) => setTimeout(r, 300));
    const told = document.body.innerText.includes('frames a second');
    const level = g.graphics.level;
    g.graphics.choose('high');
    const chosenStays = g.graphics.level;
    return { level, told, chosenStays, chosen: g.graphics.chosen };
  });
  check('graphics: running slowly, the game steps down to Balanced by itself and says so; a level the player picks afterwards stands', slow.level === 'balanced' && slow.told && slow.chosenStays === 'high' && slow.chosen, slow);
  await ctx2.close();

  check('graphics: no errors in the page', log.errors.length === 0, log.errors.slice(0, 5));
}
