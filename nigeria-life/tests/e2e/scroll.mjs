// A list stays where it was scrolled to. The game keeps running underneath (needs tick every
// second, the save is written every few seconds), and none of that may throw an open list
// back to the top. Only going to a different screen starts from the top again.
import { open, wait, newPlayer, advance, closeDialogs } from './lib.mjs';

/** Where a scrolling element is, and how far it can go. */
const at = (page, selector) => page.evaluate((sel) => {
  const el = [...document.querySelectorAll(sel)].find((node) => node.offsetParent !== null && node.scrollHeight > node.clientHeight + 4);
  if (!el) return null;
  return { top: Math.round(el.scrollTop), max: el.scrollHeight - el.clientHeight };
}, selector);

const scrollTo = (page, selector, fraction) => page.evaluate(({ sel, fraction }) => {
  const el = [...document.querySelectorAll(sel)].find((node) => node.offsetParent !== null && node.scrollHeight > node.clientHeight + 4);
  if (!el) return null;
  el.scrollTop = Math.round((el.scrollHeight - el.clientHeight) * fraction);
  return Math.round(el.scrollTop);
}, { sel: selector, fraction });

/** Lets the game run: several needs ticks, and a change to the saved game that every listener hears about. */
const letTheGameRun = async (page) => {
  await advance(page, 3.4);
  await page.evaluate(() => window.game.hud.backend.addStreetCred(0));
  await wait(250);
};

/**
 * Scrolls a list to the middle, lets the game run, and checks it has not moved; then the same
 * at the bottom and at the top.
 */
async function holdsItsPlace(page, selector) {
  const start = await at(page, selector);
  if (!start || start.max < 40) return { ok: false, why: 'nothing to scroll', start };
  const result = { ok: true, max: start.max };
  for (const [name, fraction] of [['middle', 0.5], ['bottom', 1], ['top', 0]]) {
    const set = await scrollTo(page, selector, fraction);
    await letTheGameRun(page);
    const now = await at(page, selector);
    result[name] = { set, after: now?.top ?? null };
    if (!now || Math.abs(now.top - set) > 2) result.ok = false;
  }
  return result;
}

export async function run(browser, check) {
  const ctx = await newPlayer(browser);
  const { page, log } = await open(ctx);
  await closeDialogs(page);

  // A bag full enough to need scrolling
  await page.evaluate(() => {
    const be = window.game.hud.backend;
    for (let i = 0; i < 40; i++) {
      be.addItem({ id: `test_snack_${i}`, name: `Test snack ${i + 1}`, category: 'food', icon: '🍪', description: 'For the scrolling test.', price: 100, usable: true, energyRestore: 1 });
    }
  });

  // ------------------------------------------------------------------ Inventory
  await page.keyboard.press('i');
  await wait(500);
  let held = await holdsItsPlace(page, '#inventory-modal .dialog-body');
  check('the bag stays where it was scrolled to while the game runs: middle, bottom and top', held.ok, held);

  // Using something from the bottom of the list changes the list and still keeps the place
  await scrollTo(page, '#inventory-modal .dialog-body', 1);
  const beforeUse = await at(page, '#inventory-modal .dialog-body');
  await page.evaluate(() => { const buttons = document.querySelectorAll('#inventory-modal .inv-btn-use'); buttons[buttons.length - 1].click(); });
  await wait(300);
  const afterUse = await at(page, '#inventory-modal .dialog-body');
  const left = await page.evaluate(() => window.game.hud.backend.getData().inventory.filter((i) => i.id.startsWith('test_snack_')).length);
  check('eating the last thing in the bag removes it and leaves the list at the bottom, not back at the top',
    left === 39 && afterUse && afterUse.top > afterUse.max - 6 && afterUse.top > 100, { left, before: beforeUse, after: afterUse });

  // Scrolled with the real wheel, with the game running between turns
  await scrollTo(page, '#inventory-modal .dialog-body', 0);
  const box = await page.evaluate(() => { const r = document.querySelector('#inventory-modal .dialog-body').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
  await page.mouse.move(box.x, box.y);
  const steps = [];
  for (let i = 0; i < 4; i++) {
    await page.mouse.wheel({ deltaY: 240 });
    await wait(80);
    await advance(page, 1.2);
    await wait(120);
    steps.push((await at(page, '#inventory-modal .dialog-body')).top);
  }
  check('turning the wheel moves the bag down step by step, with no jump back between turns',
    steps.every((top, i) => top > (i === 0 ? 0 : steps[i - 1]) || top >= held.max - 2) && steps[steps.length - 1] > 400, steps);
  await page.keyboard.press('Escape');
  await wait(300);

  // ------------------------------------------------------------------ Businesses
  await page.evaluate(() => window.game.hud.economyModal.open());
  await wait(500);
  held = await holdsItsPlace(page, '#economy-modal .economy-dialog, #economy-modal .dialog-body, #economy-modal [class*="body"]');
  check('the businesses screen stays where it was scrolled to while the game runs', held.ok, held);
  await page.keyboard.press('Escape');
  await wait(300);
  await page.evaluate(() => window.game.hud.economyModal.close());

  // ------------------------------------------------------------------ Flights
  await page.evaluate(() => window.game.hud.interstateModal.open('lagos'));
  await wait(500);
  await page.setViewport({ width: 1366, height: 520 });
  await wait(300);
  held = await holdsItsPlace(page, '#interstate-modal .interstate-dialog');
  check('the flights screen stays where it was scrolled to while the game runs', held.ok, held);
  await page.evaluate(() => window.game.hud.interstateModal.close());
  await wait(200);

  // ------------------------------------------------------------------ City travel
  await page.evaluate(() => window.game.hud.travelModal.open());
  await wait(500);
  held = await holdsItsPlace(page, '#travel-modal .travel-dialog');
  check('the city travel screen stays where it was scrolled to while the game runs', held.ok, held);
  await page.evaluate(() => window.game.hud.travelModal.close());
  await page.setViewport({ width: 1366, height: 768 });
  await wait(300);

  // ------------------------------------------------------------------ The phone
  await page.click('#nav-btn-phone');
  await wait(600);
  await page.click('#smartphone-wrapper [data-app="jobs"]');
  await wait(400);
  held = await holdsItsPlace(page, '#smartphone-wrapper .phone-screen');
  check('a phone app stays where it was scrolled to while the game runs', held.ok, held);

  // Tapping something at the bottom of a phone list does not send it back to the top
  await scrollTo(page, '#smartphone-wrapper .phone-screen', 1);
  const beforeTap = await at(page, '#smartphone-wrapper .phone-screen');
  await page.evaluate(() => { const buttons = document.querySelectorAll('#smartphone-wrapper [data-start-job]:not([disabled])'); buttons[buttons.length - 1].click(); });
  await wait(300);
  const afterTap = await at(page, '#smartphone-wrapper .phone-screen');
  const working = await page.evaluate(() => !!window.game.hud.backend.getActiveJobShift());
  check('taking a shift from the bottom of the jobs list starts the shift and leaves the list where it was',
    // The shift's card is added above the list, so "where it was" is still the bottom, now further down
    working && afterTap && afterTap.top >= beforeTap.top - 4 && afterTap.top >= afterTap.max - 4, { working, before: beforeTap, after: afterTap });

  // The shift counts down every second on the screen; the list must not move while it does
  const during = [];
  for (let i = 0; i < 4; i++) {
    await wait(1100);
    during.push((await at(page, '#smartphone-wrapper .phone-screen')).top);
  }
  check('while the shift timer counts down on screen, the list does not move', during.every((top) => Math.abs(top - afterTap.top) < 4), { started: afterTap.top, during });

  // Going to a different app is a new screen: that one starts at the top
  await page.evaluate(() => (document.getElementById('app-back-btn') ?? document.querySelector('#smartphone-wrapper [data-phone-back]')).click());
  await wait(300);
  await page.click('#smartphone-wrapper [data-app="property"]');
  await wait(400);
  const fresh = await at(page, '#smartphone-wrapper .phone-screen');
  check('opening a different app starts at the top of that app', fresh && fresh.top === 0, fresh);
  await page.evaluate(() => window.game.hud.phoneModal.close());
  await wait(300);

  check('scroll: no console errors', log.errors.length === 0, log.errors.slice(0, 5));
  await ctx.close();
}
