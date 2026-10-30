// Playing with a finger on a phone (420 x 800, touch), as found on a real Android phone:
// the joystick stops when let go and goes backwards too; a tap on the street walks there, even
// after the joystick and even just in front of the character; at home a tap on "Bed" walks all
// the way to the bed and its card can be used; tapping your own character opens your menu and
// it closes with its close button; nothing on screen sits on top of what has to be tapped.
import { launch, newPlayer, closeDialogs, wait } from './lib.mjs';

export async function run(_browser, check) {
  const browser = await launch();
  const page = await (await newPlayer(browser)).newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message.slice(0, 200)));
  await page.emulate({ viewport: { width: 420, height: 800, isMobile: true, hasTouch: true, deviceScaleFactor: 2.5 }, userAgent: 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36' });
  const { GAME_URL } = await import('./lib.mjs');
  await page.goto(GAME_URL, { waitUntil: 'load', timeout: 120000 });
  await page.waitForFunction('window.game', { timeout: 120000 });
  await wait(5000);
  await closeDialogs(page);
  const quality = await page.evaluate(() => window.game.graphics.level);
  check('touch: a phone on its first visit starts at Balanced graphics', quality === 'balanced', quality);

  const pos = () => page.evaluate(() => ({ x: window.game.player.position.x, z: window.game.player.position.z }));
  const dist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
  const street = () => page.evaluate(() => { const g = window.game; g.world.skyEnvironment.setHour(12); g.player.stopMoving(); g.player.mesh.position.set(-9, 0.28, -40); g.player.mesh.rotation.y = Math.PI; g.cameraManager.yaw = 0; });
  await street();
  await wait(800);
  const joy = await page.evaluate(() => { const r = document.querySelector('.v-joystick-base').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
  const push = async (dy, ms) => {
    await page.touchscreen.touchStart(joy.x, joy.y);
    for (let i = 1; i <= 10; i++) {
      await page.touchscreen.touchMove(joy.x, joy.y + (dy * i) / 10);
      await wait(20);
    }
    await wait(ms);
    await page.touchscreen.touchEnd();
  };

  // 1. Joystick
  const a = await pos();
  await push(-50, 1200);
  const b = await pos();
  await wait(1500);
  const c = await pos();
  check('touch: pushed forward the joystick walks, and let go the player stops (no key left held)', dist(a, b) > 3 && dist(b, c) < 1, { forward: +dist(a, b).toFixed(2), afterLettingGo: +dist(b, c).toFixed(2) });
  await push(50, 1200);
  const d = await pos();
  check('touch: pulled back the joystick walks the other way', dist(c, d) > 3, { back: +dist(c, d).toFixed(2) });

  // 2. A tap on the street just in front of the character, after using the joystick
  await street();
  await wait(1000);
  const me = await page.evaluate(() => { const g = window.game; const v = g.player.position.clone(); v.y += 1.8; v.project(g.cameraManager.camera); return { x: ((v.x + 1) / 2) * innerWidth, y: ((1 - v.y) / 2) * innerHeight }; });
  const e = await pos();
  await page.touchscreen.tap(me.x, me.y - 60);
  await wait(3000);
  const f = await pos();
  const menuAfterTap = await page.evaluate(() => !document.getElementById('self-menu').hidden);
  check('touch: a tap on the street just above the character walks there; it does not open the character\'s menu', dist(e, f) > 2 && !menuAfterTap, { walked: +dist(e, f).toFixed(2), menuOpened: menuAfterTap });

  // 3. Tapping the character itself opens the menu; its close button closes it; the stick is out of the way meanwhile
  await street();
  await wait(1000);
  const body = await page.evaluate(() => { const g = window.game; const v = g.player.position.clone(); v.y += 0.9; v.project(g.cameraManager.camera); return { x: ((v.x + 1) / 2) * innerWidth, y: ((1 - v.y) / 2) * innerHeight }; });
  await page.touchscreen.tap(body.x, body.y);
  await wait(800);
  const menu = await page.evaluate(() => {
    const m = document.getElementById('self-menu');
    const close = m.querySelector('[data-menu-close]');
    const r = close?.getBoundingClientRect();
    const top = r ? document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2) : null;
    return { open: !m.hidden, close: r ? { x: r.left + r.width / 2, y: r.top + r.height / 2, reachable: top === close } : null, stickShown: getComputedStyle(document.getElementById('virtual-mobile-controls')).display !== 'none' };
  });
  if (menu.close) await page.touchscreen.tap(menu.close.x, menu.close.y);
  await wait(600);
  const closed = await page.evaluate(() => document.getElementById('self-menu').hidden);
  check('touch: a tap on the character opens their menu with a close button that can be tapped and closes it; the stick steps aside meanwhile', menu.open && menu.close?.reachable && closed && !menu.stickShown, { menu, closed });

  // 4. At home, after using the joystick: Bed walks all the way to the bed and its card works
  await page.evaluate(() => { const g = window.game; g.world.skyEnvironment.setHour(22); g.hud.backend.modifyNeed('energy', -60); g.world.interiorManager.enterInterior('residence', g.player, g.cameraManager, g.hud, g.world); });
  await wait(2500);
  await closeDialogs(page);
  const joyInside = await page.evaluate(() => { const r = document.querySelector('.v-joystick-base').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
  await page.touchscreen.touchStart(joyInside.x, joyInside.y);
  await page.touchscreen.touchMove(joyInside.x, joyInside.y - 45);
  await wait(400);
  await page.touchscreen.touchEnd();
  await wait(500);
  const chips = await page.evaluate(() => [...document.querySelectorAll('.place-chip, .place-leave-btn')].filter((el) => { const r = el.getBoundingClientRect(); return r.width > 0 && r.right <= innerWidth; }).map((el) => { const r = el.getBoundingClientRect(); const top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return { text: el.textContent.trim().replace(/\s+/g, ' '), x: r.left + r.width / 2, y: r.top + r.height / 2, reachable: top === el || el.contains(top) }; }));
  check('touch: inside, every button on the place card that is on screen can be tapped (nothing on top of it)', chips.length >= 3 && chips.every((x) => x.reachable), chips.map((x) => `${x.text}: ${x.reachable}`));
  // The bed's own chip (not the bedroom door's), scrolled into view along the row if the phone is too narrow for all of them
  const bed = await page.evaluate(() => {
    const el = [...document.querySelectorAll('.place-chip')].find((c) => /Bed$/.test(c.textContent.trim()) && !/door/i.test(c.textContent));
    if (!el) return null;
    el.scrollIntoView({ inline: 'center', block: 'nearest' });
    const r = el.getBoundingClientRect();
    return { text: el.textContent.trim(), x: r.left + r.width / 2, y: r.top + r.height / 2 };
  });
  await wait(300);
  const bedPoint = await page.evaluate(() => { const o = window.game.world.interiorManager.getActiveInteractiveObjects().find((x) => /bed/i.test(x.id) && !/sofa|door/i.test(x.id)); return o ? { x: o.interactionPoint.x, z: o.interactionPoint.z } : null; });
  await page.touchscreen.tap(bed.x, bed.y);
  await wait(6000);
  const atBed = await pos();
  const sleep = await page.evaluate(() => { const b = [...document.querySelectorAll('#interaction-card button')].find((x) => /sleep/i.test(x.textContent) && x.getBoundingClientRect().width > 0); if (!b) return null; const r = b.getBoundingClientRect(); const top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return { x: r.left + r.width / 2, y: r.top + r.height / 2, reachable: top === b || b.contains(top) }; });
  const cardSays = await page.evaluate(() => { const c = document.getElementById('interaction-card'); return c ? { shown: getComputedStyle(c).display !== 'none' && !c.hidden, text: c.innerText.replace(/\s+/g, ' ').slice(0, 160) } : null; });
  check('touch: after using the joystick, one tap on Bed walks all the way to the bed and its card offers sleep, which can be tapped', bedPoint && dist(atBed, bedPoint) < 2.5 && sleep?.reachable, { fromBed: bedPoint ? +dist(atBed, bedPoint).toFixed(2) : null, sleep, cardSays });
  if (sleep) {
    const energy0 = await page.evaluate(() => window.game.hud.backend.getData().stats.energy);
    await page.touchscreen.tap(sleep.x, sleep.y);
    await wait(5000);
    const energy1 = await page.evaluate(() => window.game.hud.backend.getData().stats.energy);
    check('touch: tapping sleep puts the player to bed and their energy comes back', energy1 > energy0 + 10, { energy0, energy1 });
  }

  check('touch: no errors in the page', errors.length === 0, errors.slice(0, 5));
  await browser.close();
}
