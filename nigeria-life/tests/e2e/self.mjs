// Clicking your own character opens a menu of what you can really do where you stand,
// and neither opening it, using it nor closing it walks the character or turns the camera.
import { open, wait, newPlayer, advance, playUntil, closeDialogs, enterInterior, leaveInterior } from './lib.mjs';

/** Where the character's chest is on the screen. */
const chest = (page) => page.evaluate(() => {
  const g = window.game;
  const p = g.player.mesh.position.clone();
  p.y += g.player.actor.hold ? 0.8 : 1.0;
  p.project(g.cameraManager.camera);
  return { x: ((p.x + 1) / 2) * innerWidth, y: ((1 - p.y) / 2) * innerHeight };
});
const state = (page) => page.evaluate(() => {
  const g = window.game;
  return {
    x: +g.player.position.x.toFixed(3), z: +g.player.position.z.toFixed(3), moving: g.player.isMoving, walking: g.player.actor.sequence?.name ?? null,
    yaw: g.cameraManager.yaw, pitch: g.cameraManager.pitch, distance: g.cameraManager.distance,
  };
});
const same = (a, b) => Math.hypot(a.x - b.x, a.z - b.z) < 0.02 && !b.moving && b.walking === null && a.yaw === b.yaw && a.pitch === b.pitch && a.distance === b.distance;
const menu = (page) => page.evaluate(() => {
  const el = document.getElementById('self-menu');
  if (!el || el.hidden) return null;
  const box = el.getBoundingClientRect();
  const items = Array.from(el.querySelectorAll('[data-menu-item]'));
  return {
    title: el.querySelector('.nl-menu-head strong').textContent,
    box: { left: box.left, top: box.top, right: box.right, bottom: box.bottom },
    items: Object.fromEntries(items.map((item) => [item.dataset.menuItem, {
      off: item.getAttribute('aria-disabled') === 'true',
      label: item.querySelector('.nl-menu-label').textContent,
      why: item.querySelector('.nl-menu-why')?.textContent ?? item.title ?? '',
      height: item.getBoundingClientRect().height,
    }])),
  };
});
const choose = async (page, id) => {
  const ok = await page.evaluate((itemId) => { const el = document.querySelector(`#self-menu [data-menu-item="${itemId}"]`); if (!el) return false; el.click(); return true; }, id);
  await wait(200);
  return ok;
};
const openMenu = async (page) => {
  const at = await chest(page);
  await page.mouse.click(at.x, at.y);
  await wait(250);
  return at;
};

export async function run(browser, check) {
  const ctx = await newPlayer(browser);
  const { page, log } = await open(ctx);
  await closeDialogs(page);
  // A quiet stretch of pavement, so nobody else is under the pointer
  await page.evaluate(() => { const g = window.game; g.player.stopMoving(); g.player.mesh.position.set(-9, 0, 62); g.cameraManager.snapToPlayer(g.player, 'street'); });
  await advance(page, 0.6);
  await wait(300);

  // ------------------------------------------------------------------ Opening it
  let before = await state(page);
  const at = await openMenu(page);
  let shown = await menu(page);
  await advance(page, 0.5);
  let after = await state(page);
  const names = shown ? Object.keys(shown.items) : [];
  check('a click on your own character opens your menu beside them, on screen, with your name and needs',
    shown && shown.title.length > 1 && shown.box.left >= 0 && shown.box.top >= 0 && shown.box.right <= 1366 && shown.box.bottom <= 768
      && Math.abs((shown.box.left + shown.box.right) / 2 - at.x) < 400 && await page.evaluate(() => /%/.test(document.getElementById('self-menu-needs').textContent)),
    shown && { title: shown.title, box: shown.box, at });
  check('the menu lists what a character has and can do: look, bag, money, needs, work, property, vehicle, emotes, rest, quests, phone, settings',
    ['look', 'bag', 'money', 'needs', 'career', 'property', 'vehicle', 'emotes', 'rest', 'quests', 'phone', 'settings'].every((id) => names.includes(id)), names);
  check('opening the menu did not walk the character anywhere or move the camera', same(before, after), { before, after });
  check('the money line shows what is really held', /25,000/.test(shown.items.money.why) && /150,000/.test(shown.items.money.why), shown.items.money);
  check('every line is big enough to press', Object.values(shown.items).every((item) => item.height >= 40), Object.fromEntries(Object.entries(shown.items).map(([id, item]) => [id, Math.round(item.height)])));

  // What cannot be done here is listed, greyed, and says why; pressing it does nothing
  check('with no chair or bed about, "Sit or rest" is off and says why; with no vehicle near, so is getting into one',
    shown.items.rest.off && /sit or lie/i.test(shown.items.rest.why) && shown.items.vehicle.off && /vehicle/i.test(shown.items.vehicle.why), { rest: shown.items.rest, vehicle: shown.items.vehicle });
  await choose(page, 'rest');
  check('pressing something that is off leaves the menu open and changes nothing', (await menu(page)) !== null && same(before, await state(page)));

  // ------------------------------------------------------------------ Closing it
  await page.keyboard.press('Escape');
  await wait(200);
  const escaped = (await menu(page)) === null;
  await openMenu(page);
  before = await state(page);
  // A press on the open ground, well away from the menu and the character
  const ground = await page.evaluate(() => {
    const g = window.game;
    const p = g.player.mesh.position.clone(); p.x += 2.5; p.z += 3;
    p.project(g.cameraManager.camera);
    return { x: ((p.x + 1) / 2) * innerWidth, y: ((1 - p.y) / 2) * innerHeight };
  });
  const box = (await menu(page)).box;
  const clear = ground.x < box.left - 6 || ground.x > box.right + 6 || ground.y < box.top - 6 || ground.y > box.bottom + 6;
  const spot = clear ? ground : { x: box.left - 60, y: Math.min(700, box.bottom + 20) };
  await page.mouse.click(spot.x, spot.y);
  await wait(200);
  await advance(page, 0.6);
  after = await state(page);
  check('Escape closes the menu; so does a press outside it, and that press does not send the character walking',
    escaped && (await menu(page)) === null && same(before, after), { escaped, before, after, spot });

  await page.mouse.click(spot.x, spot.y);
  await advance(page, 0.4);
  const walked = await state(page);
  check('with the menu closed, the same press on the ground walks there as it always did', walked.moving || Math.hypot(walked.x - before.x, walked.z - before.z) > 0.3, walked);
  await page.evaluate(() => window.game.player.stopMoving());
  await advance(page, 0.3);

  // A drag that starts on the character still turns the camera, and opens nothing
  let here = await chest(page);
  before = await state(page);
  await page.mouse.move(here.x, here.y);
  await page.mouse.down();
  await page.mouse.move(here.x + 90, here.y + 10, { steps: 6 });
  await page.mouse.up();
  await wait(200);
  after = await state(page);
  check('dragging from the character turns the camera as before and does not open the menu', after.yaw !== before.yaw && (await menu(page)) === null, { from: before.yaw, to: after.yaw });

  // ------------------------------------------------------------------ Using it
  await openMenu(page);
  await choose(page, 'emotes');
  const sub = await menu(page);
  check('Emotes opens a list of moves inside the same menu', sub && sub.title === 'Emotes' && ['emote-wave', 'emote-greet', 'emote-zanku', 'emote-groove', 'emote-salute'].every((id) => id in sub.items), sub && Object.keys(sub.items));
  await choose(page, 'emote-wave');
  await advance(page, 0.5);
  const waving = await page.evaluate(() => ({ arms: window.game.player.actor.pose.arms, doing: window.game.player.actor.sequence?.name ?? null, menu: !document.getElementById('self-menu').hidden }));
  check('choosing Wave closes the menu and the character waves', !waving.menu && waving.arms === 'wave', waving);
  await advance(page, 2.5);

  await openMenu(page);
  await choose(page, 'emotes');
  await choose(page, 'emote-zanku');
  await advance(page, 0.3);
  const dancing = await page.evaluate(() => window.game.player.currentEmote);
  check('choosing Zanku makes the character dance', dancing === 'zanku', dancing);
  await page.evaluate(() => window.game.player.stopEmote());
  await advance(page, 0.3);

  await openMenu(page);
  await choose(page, 'money');
  const bank = await page.evaluate(() => ({ phone: window.game.hud.phoneModal.isOpen, title: document.getElementById('phone-title').textContent }));
  check('Money opens the bank app on the phone', bank.phone && bank.title === 'Bank', bank);
  await page.evaluate(() => window.game.hud.phoneModal.close());

  await openMenu(page);
  await choose(page, 'bag');
  const bag = await page.evaluate(() => !!document.querySelector('#inventory-modal .dialog-body') && window.game.hud.inventoryModal?.isOpen !== false);
  await page.keyboard.press('Escape');
  await wait(200);
  await openMenu(page);
  await choose(page, 'quests');
  const quests = await page.evaluate(() => window.game.hud.questModal.isOpen);
  await page.keyboard.press('Escape');
  await wait(200);
  check('Bag opens the bag and Quests opens the quest log', bag && quests, { bag, quests });

  // With a dialog open the world is not clickable through it
  await page.evaluate(() => window.game.hud.questModal.open());
  await wait(200);
  await page.evaluate(() => window.game.input.onSelfClicked({ x: 400, y: 300 }));
  const underDialog = await menu(page);
  await page.evaluate(() => window.game.hud.questModal.close());
  check('the menu does not open over a dialog', underDialog === null);

  // ------------------------------------------------------------------ Other people keep their own cards
  const person = await page.evaluate(() => {
    const g = window.game;
    const obj = g.world.interactiveObjects.find((o) => o.id === 'bet-customer');
    g.player.stopMoving();
    g.player.mesh.position.set(obj.interactionPoint.x, 0, obj.interactionPoint.z + 2.2);
    g.cameraManager.snapToPlayer(g.player, 'street');
    return true;
  });
  await advance(page, 0.5);
  await wait(200);
  const them = await page.evaluate(() => {
    const g = window.game;
    const actor = g.interactions.actorFor('bet-customer');
    const p = actor.worldPosition().clone(); p.y += 1.1;
    p.project(g.cameraManager.camera);
    return { x: ((p.x + 1) / 2) * innerWidth, y: ((1 - p.y) / 2) * innerHeight };
  });
  await page.mouse.click(them.x, them.y);
  await wait(300);
  await advance(page, 0.5);
  const card = await page.evaluate(() => ({ menu: !document.getElementById('self-menu').hidden, card: window.game.hud.currentActiveObject?.id ?? null, walking: window.game.player.actor.sequence?.name ?? (window.game.player.isMoving ? 'walk' : null) }));
  check('a click on someone else opens their card (or walks up to them), never your own menu', person && !card.menu && (card.card === 'bet-customer' || card.walking !== null), card);
  await page.evaluate(() => { window.game.hud.hideInteractionCard(); window.game.player.stopMoving(); });

  // ------------------------------------------------------------------ Near a vehicle
  const car = await page.evaluate(() => {
    const g = window.game;
    const v = g.world.vehicles.drivableVehicles[0];
    g.player.stopMoving();
    g.player.mesh.position.set(v.mesh.position.x - 3.5, 0, v.mesh.position.z);
    g.cameraManager.snapToPlayer(g.player, 'street');
    return v.name;
  });
  await advance(page, 0.5);
  await wait(200);
  await page.evaluate(() => window.game.hud.hideInteractionCard());
  await openMenu(page);
  shown = await menu(page);
  const offered = shown && !shown.items.vehicle.off && shown.items.vehicle.label.includes(car);
  await choose(page, 'vehicle');
  const driving = await playUntil(page, () => (window.game.player.isDriving ? true : null), 12);
  check('beside a vehicle the menu offers to get into it by name, and choosing that walks round and gets in', offered && driving, { car, item: shown?.items.vehicle, driving });
  await page.keyboard.press('f');
  await advance(page, 1);
  await playUntil(page, () => (!window.game.player.isDriving ? true : null), 6);

  // ------------------------------------------------------------------ At home: sit and rest are real
  await page.evaluate(() => { const b = window.game.hud.backend; b.data.bank.balance = 900000; b.rentProperty(b.getData().properties.filter((p) => p.rentalPriceMonthly > 0).sort((a, c) => a.rentalPriceMonthly - c.rentalPriceMonthly)[0].id); });
  await enterInterior(page, 'residence');
  await advance(page, 0.6);
  await wait(400);
  await page.evaluate(() => window.game.hud.hideInteractionCard());
  await openMenu(page);
  shown = await menu(page);
  const restOn = shown && !shown.items.rest.off;
  await choose(page, 'rest');
  const restList = await menu(page);
  await choose(page, 'rest-sofa');
  const sat = await playUntil(page, () => (window.game.player.actor.hold ? window.game.player.actor.pose.legs : null), 20);
  check('at home "Sit or rest" is on and offers the bed and the sofa; choosing the sofa walks over and sits down',
    restOn && restList && 'rest-sleep' in restList.items && 'rest-sofa' in restList.items && sat === 'sit', { restOn, list: restList && Object.keys(restList.items), sat });

  await advance(page, 0.5);
  await wait(300);
  await openMenu(page);
  shown = await menu(page);
  const seatedMenu = shown && { stand: 'stand' in shown.items, rest: 'rest' in shown.items };
  await choose(page, 'emotes');
  const seatedEmotes = await menu(page);
  const seatedRules = seatedEmotes && { wave: seatedEmotes.items['emote-wave'].off, dance: seatedEmotes.items['emote-zanku'].off, why: seatedEmotes.items['emote-zanku'].why };
  await page.keyboard.press('Escape'); // back up to the first page of the menu
  await wait(150);
  const backUp = await menu(page);
  await choose(page, 'stand');
  const stood = await playUntil(page, () => (!window.game.player.actor.hold && !window.game.player.actor.sequence ? true : null), 10);
  check('a click on yourself works while seated: the menu offers "Get up" instead, a wave is allowed from the sofa and a dance is not, and Get up stands you up',
    seatedMenu && seatedMenu.stand && !seatedMenu.rest && seatedRules && !seatedRules.wave && seatedRules.dance && /stand up/i.test(seatedRules.why) && backUp && 'stand' in backUp.items && stood,
    { seatedMenu, seatedRules, stood });
  await leaveInterior(page);

  // ------------------------------------------------------------------ Keyboard
  await page.evaluate(() => { const g = window.game; g.player.stopMoving(); g.player.mesh.position.set(-9, 0, 62); g.cameraManager.snapToPlayer(g.player, 'street'); });
  await advance(page, 0.5);
  await wait(200);
  before = await state(page);
  await openMenu(page);
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowDown');
  const focused = await page.evaluate(() => document.activeElement?.dataset?.menuItem ?? null);
  await page.keyboard.press('Enter');
  await wait(250);
  const viaKeys = await page.evaluate(() => !!document.querySelector('#inventory-modal .dialog-body') && document.getElementById('self-menu').hidden);
  await page.keyboard.press('Escape');
  await advance(page, 0.4);
  after = await state(page);
  check('the arrow keys move through the menu and Enter chooses, without the keys walking the character', focused === 'bag' && viaKeys && Math.hypot(after.x - before.x, after.z - before.z) < 0.02, { focused, viaKeys });

  // ------------------------------------------------------------------ On a phone-sized screen
  // Turning on touch reloads the page, as a real phone would have loaded it
  await page.setViewport({ width: 390, height: 780, hasTouch: true, isMobile: true });
  await page.waitForFunction('window.game', { timeout: 120000 });
  await wait(3000);
  await closeDialogs(page);
  await page.evaluate(() => { const g = window.game; g.player.stopMoving(); g.player.mesh.position.set(-9, 0, 62); g.cameraManager.snapToPlayer(g.player, 'street'); });
  await advance(page, 0.6);
  await wait(300);
  here = await chest(page);
  const under = await page.evaluate(({ x, y }) => { const el = document.elementFromPoint(x, y); return el ? `${el.tagName}#${el.id}.${String(el.className).slice(0, 40)}` : null; }, here);
  await page.touchscreen.tap(here.x, here.y);
  await wait(350);
  shown = await menu(page);
  check('a tap on the character opens the menu on a small screen, and all of it fits on the screen',
    shown && shown.box.left >= 0 && shown.box.right <= 390 && shown.box.top >= 0 && shown.box.bottom <= 780 && Object.values(shown.items).every((item) => item.height >= 40), { box: shown && shown.box, here, under });
  before = await state(page);
  // Somewhere on the 3D view that the menu is not covering
  const away = await page.evaluate(() => {
    const menu = document.getElementById('self-menu').getBoundingClientRect();
    const canvas = document.querySelector('canvas');
    for (let y = 60; y < innerHeight - 20; y += 20) {
      for (let x = 12; x < innerWidth - 10; x += 20) {
        const inMenu = x > menu.left - 8 && x < menu.right + 8 && y > menu.top - 8 && y < menu.bottom + 8;
        if (!inMenu && document.elementFromPoint(x, y) === canvas) return { x, y };
      }
    }
    return null;
  });
  await page.touchscreen.tap(away.x, away.y);
  await wait(300);
  await advance(page, 0.5);
  after = await state(page);
  check('a tap outside closes it on a touch screen too, without walking', (await menu(page)) === null && Math.hypot(after.x - before.x, after.z - before.z) < 0.02 && !after.moving, { after, away });

  check('self menu: no console errors', log.errors.length === 0, log.errors.slice(0, 6));
  await ctx.close();
}
