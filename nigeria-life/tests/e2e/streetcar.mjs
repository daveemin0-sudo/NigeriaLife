// A car found parked in the street (not bought, not rented) can be got into, driven somewhere,
// left there, and got back into from the phone's action button, as often as the player likes. And
// the horn: from the bonnet view it is a small tag on the screen, not a bubble over the car that
// fills the view; from the chase view the bubble over the car stays small.
import { newPlayer, closeDialogs, wait, GAME_URL } from './lib.mjs';

export async function run(browser, check) {
  const ctx = await newPlayer(browser);
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message.slice(0, 200)));
  await page.emulate({ viewport: { width: 360, height: 780, isMobile: true, hasTouch: true, deviceScaleFactor: 2 }, userAgent: 'Mozilla/5.0 (Linux; Android 14; SM-A165F) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36' });
  await page.goto(GAME_URL, { waitUntil: 'load', timeout: 240000 });
  await page.waitForFunction('window.game', { timeout: 240000 });
  await wait(4000);
  await closeDialogs(page);

  const prompt = () => page.evaluate(() => {
    const el = document.getElementById('hud-proximity-prompt');
    if (!el || getComputedStyle(el).display === 'none') return null;
    const r = el.getBoundingClientRect();
    return { text: el.innerText.trim(), x: r.left + r.width / 2, y: r.top + r.height / 2 };
  });
  const setup = await page.evaluate(() => {
    const g = window.game;
    g.checkpointPassAt = Date.now() + 3_600_000;
    const v = g.world.vehicles.drivableVehicles.find((c) => c.id === 'veh-sedan');
    v.constructor.ignoreBodies = true;
    return { id: v.id, name: v.name, from: { x: v.mesh.position.x, z: v.mesh.position.z, yaw: v.mesh.rotation.y } };
  });
  const tapAndWait = async (button) => {
    if (button && /Board/.test(button.text)) await page.touchscreen.tap(button.x, button.y);
    for (let i = 0; i < 40; i++) {
      await wait(150);
      if (await page.evaluate((id) => window.game.player.isDriving && window.game.player.currentVehicle?.id === id, setup.id)) return true;
    }
    return false;
  };

  // 1. Three times over: tap the button by the car, drive it somewhere else, get out, and the button is there by it again
  await page.evaluate((s) => window.game.player.mesh.position.set(s.from.x - 2.2 * Math.cos(s.from.yaw), 0, s.from.z + 2.2 * Math.sin(s.from.yaw)), setup);
  const places = [{ x: -4.9, z: -40, yaw: 0 }, { x: 30, z: -63.5, yaw: Math.PI / 2 }, { x: 4.9, z: 30, yaw: Math.PI }];
  const rounds = [];
  for (const at of places) {
    await wait(900);
    const before = await prompt();
    const gotIn = await tapAndWait(before);
    // Driven there (put there, as if driven), then out
    await page.evaluate((at) => {
      const g = window.game;
      const v = g.player.currentVehicle;
      if (!v) return;
      v.currentSpeed = 0;
      v.mesh.position.set(at.x, 0, at.z);
      v.mesh.rotation.y = at.yaw;
      g.exitVehicle();
    }, at);
    await wait(900);
    const after = await prompt();
    rounds.push({ at, button: before?.text ?? null, gotIn, buttonAfterGettingOut: after?.text ?? null });
  }
  check('streetcar: a street car can be got into from the button, driven elsewhere, left, and the button to get back in is there beside it, three times in different streets',
    rounds.every((r) => r.gotIn && /Board/.test(r.button ?? '') && r.buttonAfterGettingOut?.includes(setup.name)), rounds);

  // 2. Back in, once more, from where it was last left
  const again = await tapAndWait(await prompt());
  check('streetcar: and got back into from where it was last left', again, { again });

  // 3. Where it was first parked, with the car gone, there is no button for it any more
  await page.evaluate(() => { const g = window.game; if (g.player.isDriving) g.exitVehicle(); });
  await page.evaluate((s) => window.game.player.mesh.position.set(s.from.x - 2.2, 0, s.from.z), setup);
  await wait(900);
  const ghost = await prompt();
  check('streetcar: where it was first parked, now empty, no button offers to board it', !ghost || !ghost.text.includes(setup.name), { ghost });

  // 4. The horn, from the bonnet and from behind
  await page.evaluate(() => {
    const g = window.game;
    const v = g.world.vehicles.drivableVehicles.find((c) => c.id === 'veh-sedan');
    v.mesh.position.set(-4.9, 0, -100);
    v.mesh.rotation.y = 0;
    g.player.mesh.position.copy(v.mesh.position);
    g.enterVehicle(v);
    g.cameraManager.driveView = 'bonnet';
  });
  await wait(1500);
  const honk = async () => {
    const horn = await page.evaluate(() => { const b = document.querySelector('.drive-controls [data-horn]'); if (!b) return null; const r = b.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
    if (horn) await page.touchscreen.tap(horn.x, horn.y);
    await wait(250);
    return page.evaluate((pressed) => {
      const g = window.game;
      const v = g.player.currentVehicle;
      const bubble = v.hornDisplayGroup;
      // How tall the bubble is on the screen, as a share of the screen's height, whether or not it is shown
      const cam = g.cameraManager.camera;
      const at = bubble.getWorldPosition(new g.modules.THREE.Vector3());
      const ahead = -at.applyMatrix4(cam.matrixWorldInverse).z;
      const share = ahead > 0.05 ? 1.2 / (2 * ahead * Math.tan((cam.fov * Math.PI) / 360)) : Infinity;
      const tag = document.getElementById('horn-tag');
      const shown = !!tag && getComputedStyle(tag).display !== 'none';
      const r = tag?.getBoundingClientRect();
      const controls = [...document.querySelectorAll('.drive-controls button, .drive-controls .drive-steer')].map((e) => e.getBoundingClientRect()).filter((c) => c.width > 0);
      const overlaps = shown ? controls.filter((c) => c.left < r.right && c.right > r.left && c.top < r.bottom && c.bottom > r.top).length : 0;
      return { pressed, view: g.cameraManager.driveView, bubbleShown: bubble.visible, bubbleShareOfScreen: +Math.min(share, 99).toFixed(2), bubbleAheadM: +ahead.toFixed(2), tag: shown ? { w: Math.round(r.width), h: Math.round(r.height), top: Math.round(r.top), text: tag.textContent } : null, tagOverControls: overlaps, vw: innerWidth, vh: innerHeight };
    }, !!horn);
  };
  const bonnet = await honk();
  check('streetcar: from the bonnet view the horn shows as a small tag (under 40 px tall, under 70% of the width), clear of the controls, and the bubble over the car is not drawn (it would fill the view)',
    bonnet.pressed && !bonnet.bubbleShown && !!bonnet.tag && bonnet.tag.h <= 40 && bonnet.tag.w <= bonnet.vw * 0.7 && bonnet.tagOverControls === 0, bonnet);
  await wait(1500);
  const gone = await page.evaluate(() => { const t = document.getElementById('horn-tag'); return t ? getComputedStyle(t).display : 'none'; });
  check('streetcar: the tag goes again in a little over a second', gone === 'none', { gone });
  await page.evaluate(() => { window.game.cameraManager.driveView = 'chase'; });
  await wait(1500);
  const chase = await honk();
  check('streetcar: from the chase view the bubble over the car is shown, small (under a quarter of the screen height), and no tag', chase.bubbleShown && chase.bubbleShareOfScreen < 0.25 && !chase.tag, chase);
  // Changing to the bonnet while the bubble is up hides it at once
  await page.evaluate(() => { window.game.cameraManager.driveView = 'bonnet'; });
  await wait(200);
  const switched = await page.evaluate(() => window.game.player.currentVehicle.hornDisplayGroup.visible);
  check('streetcar: changing to the bonnet view while the bubble is up hides it at once', switched === false, { switched });
  await page.evaluate(() => { window.game.cameraManager.driveView = 'chase'; });
  check('streetcar: no errors in the page', errors.length === 0, errors.slice(0, 4));
  await ctx.close();
}
