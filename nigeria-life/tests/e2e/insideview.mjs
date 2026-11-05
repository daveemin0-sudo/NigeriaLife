// The inside view: indoors the camera can come down to eye height, a step behind the player,
// inside the walls with a ceiling over the room. Forward goes the way the view looks, the view
// swings round behind the player as they walk, and the choice is kept from room to room and
// the next time the game is opened. One press more and it is the room seen from above again.
import { open, reload, newPlayer, closeDialogs, advance, wait, playUntil } from './lib.mjs';

const enter = async (page, key) => {
  await page.evaluate((k) => {
    const g = window.game;
    const card = g.world.interactiveObjects.find((o) => o.id === `roadside-${k}`);
    g.player.stopMoving();
    g.player.mesh.position.set(card.interactionPoint.x, 0, card.interactionPoint.z);
    g.hud.showInteractionCard(card);
    document.getElementById('card-action-btn')?.click();
  }, key);
  await playUntil(page, () => (window.game.world.interiorManager.currentInterior && !window.game.world.interiorManager.isTransitioning ? true : null), 20);
  await advance(page, 0.5);
};
/** Where the camera is and what it shows, after a real frame */
const view = async (page) => {
  await advance(page, 0.6);
  await wait(250);
  return page.evaluate(() => new Promise((done) => requestAnimationFrame(() => {
    const g = window.game;
    const c = g.cameraManager;
    const def = g.world.interiorManager.currentInterior;
    const o = def?.interiorOrigin ?? { x: 0, z: 0 };
    const room = def?.rooms[0]?.size ?? { width: 0, length: 0 };
    const cam = c.camera.position;
    const look = new g.modules.THREE.Vector3();
    c.camera.getWorldDirection(look);
    const facing = g.player.mesh.rotation.y;
    let ceiling = null;
    g.world.interiorManager.places.find((p) => p.def === def)?.group.traverse((m) => { if (m.name === 'inside view ceiling') ceiling = m.visible; });
    done({
      eye: c.interiorEye, preset: c.currentPreset, fov: c.camera.fov,
      inside: Math.abs(cam.x - o.x) < room.width / 2 - 0.3 && Math.abs(cam.z - o.z) < room.length / 2 - 0.3,
      height: +cam.y.toFixed(2),
      // How well the view looks the way the player faces (1 = straight ahead of them)
      along: +(look.x * Math.sin(facing) + look.z * Math.cos(facing)).toFixed(2),
      behind: +Math.hypot(cam.x - g.player.position.x, cam.z - g.player.position.z).toFixed(2),
      ceiling,
      room: def?.name ?? null,
    });
  })));
};

export async function run(browser, check) {
  const ctx = await newPlayer(browser);
  const { page, log } = await open(ctx);
  await closeDialogs(page);
  await page.evaluate(() => window.game.world.skyEnvironment.setHour(10));

  await enter(page, 'faith-arena');
  const above = await view(page);
  const named = await page.evaluate(() => window.game.hud.onCycleCameraPreset());
  const eye = await view(page);
  check('inside view: in Faith Arena the camera button goes from the room seen from above to the inside view: eye height, a step behind the player, inside the walls, under a ceiling, looking the way they face',
    !above.eye && above.height > 6 && named === 'eye' && eye.eye && eye.inside && eye.height > 1.4 && eye.height < 2.9 && eye.behind < 3 && eye.along > 0.85 && eye.ceiling === true && eye.fov === 62,
    { above, named, eye });

  // Forward on the keyboard: the way the view looks
  const p0 = await page.evaluate(() => ({ x: window.game.player.position.x, z: window.game.player.position.z, yaw: window.game.cameraManager.eyeYaw }));
  await page.keyboard.down('w');
  for (let i = 0; i < 8; i++) { await advance(page, 0.1); await wait(30); }
  await page.keyboard.up('w');
  await advance(page, 0.2);
  const p1 = await page.evaluate(() => ({ x: window.game.player.position.x, z: window.game.player.position.z }));
  const step = Math.hypot(p1.x - p0.x, p1.z - p0.z);
  const ahead = step > 0 ? ((p1.x - p0.x) * Math.sin(p0.yaw) + (p1.z - p0.z) * Math.cos(p0.yaw)) / step : 0;
  check('inside view: W walks the player the way the view looks', step > 0.5 && ahead > 0.9, { step: +step.toFixed(2), ahead: +ahead.toFixed(2) });

  // Sent off across the room to the side: the view swings round behind them
  await page.evaluate(() => {
    const g = window.game;
    const o = g.world.interiorManager.currentInterior.interiorOrigin;
    const p = g.player.position;
    const side = p.x - o.x > 0 ? -1 : 1;
    g.player.setDestination(new g.modules.THREE.Vector3(p.x + side * 6, 0, p.z + 0.5));
  });
  for (let i = 0; i < 12; i++) { await advance(page, 0.25); await wait(30); }
  const swung = await view(page);
  check('inside view: walking off to the side, the view swings round behind the player and stays inside the walls', swung.inside && swung.along > 0.7, swung);

  // Kept into the next room, and the next time the game is opened
  await page.evaluate(() => { const g = window.game; g.world.interiorManager.exitCurrentInterior(g.player, g.cameraManager, g.hud, g.world); });
  await wait(1500);
  await enter(page, 'eko-grand-hotel');
  const lobby = await view(page);
  await reload(page);
  await closeDialogs(page);
  await enter(page, 'central-mosque');
  const mosque = await view(page);
  check('inside view: the choice is kept into the next place (the hotel lobby) and after the game is opened again (the mosque)', lobby.eye && lobby.inside && lobby.height < 2.9 && mosque.eye && mosque.inside && mosque.ceiling === true, { lobby, mosque });

  // One press more: the room from above again, with no ceiling in the way
  const next = await page.evaluate(() => window.game.hud.onCycleCameraPreset());
  const back = await view(page);
  check('inside view: one press more and the room is seen from above again, the ceiling gone', next === 'close' && !back.eye && back.ceiling !== true && back.height > 4 && back.fov === 40, { next, back });

  check('inside view: no errors in the page', log.errors.length === 0, log.errors.slice(0, 5));
  await page.evaluate(() => { try { localStorage.removeItem('nl_inside_view_v1'); } catch {} });
  await ctx.close();
}
