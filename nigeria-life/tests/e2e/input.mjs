// The mouse wheel belongs to whatever is under the pointer: a list, a phone screen or a menu
// scrolls itself and nothing else; only the 3D view zooms the camera.
import { open, wait, newPlayer, enterInterior, advance, closeDialogs } from './lib.mjs';

const zoomState = (page) => page.evaluate(() => {
  const g = window.game;
  return {
    street: +g.cameraManager.distance.toFixed(3),
    interior: +g.cameraManager.interiorDistance.toFixed(3),
    map: +g.world.worldMap.zoomLevel.toFixed(4),
  };
});

const sameZoom = (a, b) => a.street === b.street && a.interior === b.interior && a.map === b.map;

/** Turns the real mouse wheel with the pointer at a point on the page. */
async function wheelAt(page, x, y, deltaY, times = 1) {
  await page.mouse.move(x, y);
  for (let i = 0; i < times; i++) {
    await page.mouse.wheel({ deltaY });
    await wait(60);
  }
  await wait(120);
}

/** The middle of an element, and how far it is scrolled. */
const probe = (page, selector) => page.evaluate((sel) => {
  const el = document.querySelector(sel);
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return {
    x: r.left + r.width / 2, y: r.top + r.height / 2,
    top: el.scrollTop, left: el.scrollLeft,
    canScroll: el.scrollHeight - el.clientHeight, canScrollX: el.scrollWidth - el.clientWidth,
    under: document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2)?.closest(sel) === el,
  };
}, selector);

/** A spot on the screen where the 3D view itself is under the pointer. */
const openGround = (page) => page.evaluate(() => {
  const canvas = window.game.renderer.domElement;
  for (const [fx, fy] of [[0.5, 0.42], [0.35, 0.45], [0.65, 0.45], [0.5, 0.3], [0.25, 0.35], [0.75, 0.35]]) {
    const x = Math.round(innerWidth * fx);
    const y = Math.round(innerHeight * fy);
    if (document.elementFromPoint(x, y) === canvas) return { x, y };
  }
  return null;
});

export async function run(browser, check) {
  const ctx = await newPlayer(browser);
  const { page, log } = await open(ctx);
  await closeDialogs(page);

  // ------------------------------------------------------------------ Over the 3D view: zoom
  const ground = await openGround(page);
  check('there is open 3D view to point at', !!ground, ground);
  let before = await zoomState(page);
  await wheelAt(page, ground.x, ground.y, 300);
  let after = await zoomState(page);
  check('turning the wheel over the street zooms the camera out', after.street > before.street && after.map === before.map, { before: before.street, after: after.street });
  await wheelAt(page, ground.x, ground.y, -300);
  const back = await zoomState(page);
  check('and turning it the other way zooms back in', back.street < after.street, { from: after.street, to: back.street });

  // ------------------------------------------------------------------ A long list in a panel
  // A scrolling panel with a scrolling list inside it, standing in for any present or future menu
  await page.evaluate(() => {
    const outer = document.createElement('div');
    outer.id = 'wheel-test-outer';
    outer.style.cssText = 'position:fixed;left:40px;top:120px;width:260px;height:260px;overflow-y:auto;background:#fff;z-index:500;pointer-events:auto;';
    const inner = document.createElement('div');
    inner.id = 'wheel-test-inner';
    inner.style.cssText = 'height:120px;overflow-y:auto;background:#eee;margin:10px;';
    inner.innerHTML = '<div style="height:900px">inner list</div>';
    const filler = document.createElement('div');
    filler.id = 'wheel-test-filler';
    filler.style.cssText = 'height:900px;';
    filler.textContent = 'outer list';
    const strip = document.createElement('div');
    strip.id = 'wheel-test-strip';
    strip.style.cssText = 'position:fixed;left:340px;top:120px;width:200px;height:40px;overflow-x:auto;white-space:nowrap;background:#fff;z-index:500;pointer-events:auto;';
    strip.innerHTML = '<div style="width:1200px;height:20px">chips</div>';
    outer.append(inner, filler);
    document.body.append(outer, strip);
  });

  before = await zoomState(page);
  let outer = await probe(page, '#wheel-test-outer');
  await wheelAt(page, outer.x, outer.y + 60, 200, 2);
  let outerNow = await probe(page, '#wheel-test-outer');
  check('scrolling a long list moves the list', outerNow.top > outer.top, { from: outer.top, to: outerNow.top });
  check('and the camera does not zoom while it scrolls', sameZoom(before, await zoomState(page)), { before, after: await zoomState(page) });

  // Run it to the very end and keep turning: still nothing behind it moves
  await wheelAt(page, outer.x, outer.y + 60, 600, 6);
  outerNow = await probe(page, '#wheel-test-outer');
  check('a list scrolled to its end stays put and still does not zoom the camera',
    outerNow.top >= outerNow.canScroll - 1 && sameZoom(before, await zoomState(page)), { top: outerNow.top, end: outerNow.canScroll, zoom: await zoomState(page) });

  // ------------------------------------------------------------------ A list inside a list
  await page.evaluate(() => { document.getElementById('wheel-test-outer').scrollTop = 0; });
  const inner = await probe(page, '#wheel-test-inner');
  await wheelAt(page, inner.x, inner.y, 150, 2);
  let innerNow = await probe(page, '#wheel-test-inner');
  outerNow = await probe(page, '#wheel-test-outer');
  check('with one scrolling panel inside another, the inner one under the pointer scrolls and the outer one does not',
    innerNow.top > 0 && outerNow.top === 0, { inner: innerNow.top, outer: outerNow.top });
  await wheelAt(page, inner.x, inner.y, 600, 6);
  innerNow = await probe(page, '#wheel-test-inner');
  outerNow = await probe(page, '#wheel-test-outer');
  check('when the inner one reaches its end, the outer one does not take over',
    innerNow.top >= innerNow.canScroll - 1 && outerNow.top === 0, { inner: innerNow.top, innerEnd: innerNow.canScroll, outer: outerNow.top });
  check('none of that zoomed the camera', sameZoom(before, await zoomState(page)));

  // A strip that only scrolls sideways moves with an ordinary wheel
  const strip = await probe(page, '#wheel-test-strip');
  await wheelAt(page, strip.x, strip.y, 200, 2);
  const stripNow = await probe(page, '#wheel-test-strip');
  check('a sideways strip of chips scrolls with the wheel, without zooming', stripNow.left > 0 && sameZoom(before, await zoomState(page)), { left: stripNow.left });

  // ------------------------------------------------------------------ Moving from a panel to the 3D view
  await wheelAt(page, outer.x, outer.y + 60, 200);
  const overPanel = await zoomState(page);
  const clear = await openGround(page);
  await wheelAt(page, clear.x, clear.y, 300);
  const overGround = await zoomState(page);
  check('moving the pointer off the panel onto the 3D view switches the wheel back to zooming',
    sameZoom(before, overPanel) && overGround.street > overPanel.street, { overPanel: overPanel.street, overGround: overGround.street });
  await page.evaluate(() => { document.getElementById('wheel-test-outer').remove(); document.getElementById('wheel-test-strip').remove(); });

  // ------------------------------------------------------------------ The game's own panels
  // Phone
  await page.click('#nav-btn-phone');
  await wait(700);
  const phoneOpen = await page.evaluate(() => window.game.hud.phoneModal.isOpen === true || document.body.classList.contains('ui-modal-open'));
  before = await zoomState(page);
  // The phone slides up the screen: wait until it has stopped and its screen is under the pointer
  let phone = await probe(page, '.phone-screen');
  for (let i = 0; i < 20 && !phone.under; i++) {
    await wait(150);
    phone = await probe(page, '.phone-screen');
  }
  // Make sure there is something to scroll, whatever the home screen holds today
  await page.evaluate(() => {
    const screen = document.querySelector('.phone-screen');
    if (screen && screen.scrollHeight - screen.clientHeight < 200) {
      const pad = document.createElement('div');
      pad.id = 'wheel-test-pad';
      pad.style.cssText = 'height:900px;flex-shrink:0;';
      screen.appendChild(pad);
    }
  });
  await wheelAt(page, phone.x, phone.y, 200, 2);
  const phoneNow = await probe(page, '.phone-screen');
  check('the phone opens and its screen scrolls with the wheel', phoneOpen && phone.under && phoneNow.top > phone.top, { open: phoneOpen, under: phone.under, from: phone.top, to: phoneNow.top });
  check('scrolling the phone does not move the world camera', sameZoom(before, await zoomState(page)), { before, after: await zoomState(page) });

  // With a dialog open, the world behind it does not zoom even where it shows around the dialog
  const beside = await page.evaluate(() => {
    const canvas = window.game.renderer.domElement;
    for (const [fx, fy] of [[0.06, 0.5], [0.94, 0.5], [0.1, 0.3], [0.9, 0.3], [0.5, 0.06]]) {
      const x = Math.round(innerWidth * fx);
      const y = Math.round(innerHeight * fy);
      if (document.elementFromPoint(x, y) === canvas) return { x, y };
    }
    return null;
  });
  if (beside) {
    await wheelAt(page, beside.x, beside.y, 300);
    check('while a dialog is open, turning the wheel beside it leaves the camera alone', sameZoom(before, await zoomState(page)), { at: beside, zoom: await zoomState(page) });
  } else {
    check('while a dialog is open, the dialog covers the 3D view', true);
  }
  await page.evaluate(() => document.getElementById('wheel-test-pad')?.remove());
  await page.keyboard.press('Escape');
  await wait(400);
  await page.evaluate(() => window.game.hud.phoneModal.close?.());
  await wait(200);

  // Inventory
  await page.keyboard.press('i');
  await wait(500);
  const bag = await page.evaluate(() => {
    const candidates = [...document.querySelectorAll('.dialog-body, .inventory-grid, .dialog-overlay')].filter((el) => el.offsetParent !== null);
    const el = candidates[0];
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  });
  if (bag) {
    before = await zoomState(page);
    await wheelAt(page, bag.x, bag.y, 300, 2);
    check('turning the wheel over the inventory does not move the world camera', sameZoom(before, await zoomState(page)), { before, after: await zoomState(page) });
  } else {
    check('the inventory opened', false, 'no inventory dialog found');
  }
  await page.keyboard.press('Escape');
  await wait(300);
  await page.evaluate(() => window.game.hud.inventoryModal?.close?.());
  await wait(200);

  // The street camera still zooms once everything is closed
  const free = await openGround(page);
  before = await zoomState(page);
  await wheelAt(page, free.x, free.y, -200);
  check('with the panels closed, the wheel zooms the street camera again', (await zoomState(page)).street < before.street, { before: before.street, after: (await zoomState(page)).street });

  // ------------------------------------------------------------------ Inside a building
  await enterInterior(page, 'bank');
  await advance(page, 0.5);
  const room = await openGround(page);
  before = await zoomState(page);
  if (room) await wheelAt(page, room.x, room.y, 300);
  after = await zoomState(page);
  check('inside a building the wheel zooms the room view, not the street camera', !!room && after.interior > before.interior && after.street === before.street, { before, after });

  // The row of shortcut chips at the bottom scrolls sideways and leaves the room view alone
  const chips = await probe(page, '.place-chips');
  if (chips) {
    before = await zoomState(page);
    await wheelAt(page, chips.x, chips.y, 200, 2);
    check('turning the wheel over the place card does not zoom the room', sameZoom(before, await zoomState(page)), { before, after: await zoomState(page) });
  }

  // ------------------------------------------------------------------ The map
  await page.evaluate(() => { const g = window.game; return g.world.interiorManager.exitCurrentInterior(g.player, g.cameraManager, g.hud, g.world); });
  await wait(900);
  await page.click('#nav-btn-map');
  await wait(1500);
  const mapSpot = await page.evaluate(() => {
    const canvas = window.game.renderer.domElement;
    for (const [fx, fy] of [[0.5, 0.5], [0.3, 0.55], [0.7, 0.55], [0.5, 0.7], [0.2, 0.4], [0.8, 0.6]]) {
      const x = Math.round(innerWidth * fx);
      const y = Math.round(innerHeight * fy);
      if (document.elementFromPoint(x, y) === canvas) return { x, y };
    }
    return null;
  });
  before = await zoomState(page);
  if (mapSpot) await wheelAt(page, mapSpot.x, mapSpot.y, 300);
  after = await zoomState(page);
  check('on the map, the wheel zooms the map and not the street camera', !!mapSpot && after.map > before.map && after.street === before.street, { before, after });

  // Open a place sheet and scroll it: the map stays where it is
  await page.click('.map-pin[data-place="mama_put_buka"]').catch(() => {});
  await wait(500);
  const sheet = await probe(page, '.map-context-card');
  if (sheet && sheet.under) {
    before = await zoomState(page);
    await wheelAt(page, sheet.x, sheet.y, 300, 2);
    check('turning the wheel over a place sheet on the map does not zoom the map', sameZoom(before, await zoomState(page)), { before, after: await zoomState(page) });
  } else {
    check('a place sheet opened on the map', false, sheet);
  }

  check('input: no console errors', log.errors.length === 0, log.errors.slice(0, 5));
  await ctx.close();
}
