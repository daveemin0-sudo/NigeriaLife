// Eko Ads at phone size: the boards, a board being written, and the advert up on the road (scratch capture).
// node capture_ads.mjs <out dir>
import { launch, open, newPlayer, closeDialogs, wait } from './lib.mjs';
const out = process.argv[2] || '.';
const browser = await launch();
const ctx = await newPlayer(browser);
const { page } = await open(ctx);
await page.setViewport({ width: 400, height: 820, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
await wait(2500);
await closeDialogs(page);
await page.evaluate(() => {
  const g = window.game;
  g.hud.backend.data.bank.balance = 25_000_000;
  g.hud.backend.saveData();
  g.modules.Adverts.get().clear();
  g.hud.phoneModal.open();
  g.hud.phoneModal.openApp('ads');
});
await wait(1200);
await page.screenshot({ path: `${out}/ads-boards.png` });
const BOARD = await page.evaluate(() => {
  const id = window.game.modules.Adverts.get().boards().find((b) => b.face.z > 3000 && b.face.face === 'a').face.id;
  window.game.hud.phoneModal.go(`board:${id}`);
  return id;
});
await wait(500);
await page.evaluate(() => {
  const set = (id, v) => { const el = document.getElementById(id); el.value = v; el.dispatchEvent(new Event('input', { bubbles: true })); };
  set('ads-headline', 'Bayo Motors');
  set('ads-line', 'Tokunbo cars · pay small small');
  document.querySelector('.ea-swatch:nth-child(5)')?.click();
});
await wait(500);
await page.screenshot({ path: `${out}/ads-write.png` });
await page.evaluate(() => document.getElementById('ads-rent')?.click());
await wait(1200);
await page.evaluate(() => window.game.hud.phoneModal.close());
await wait(400);
// Stand on the road short of the board and look at it
const at = await page.evaluate((id) => {
  const g = window.game;
  const face = g.modules.Adverts.get().boards().find((b) => b.face.id === id).face;
  g.player.stopMoving?.();
  return { x: face.x, z: face.z };
}, BOARD);
// A camera on the road aimed at the board, one frame drawn and read straight back
await page.evaluate((p) => { window.game.player.mesh.position.set(p.x > 0 ? p.x - 10 : p.x + 10, 0, p.z - 30); }, at);
await wait(2500);
const shot = await page.evaluate((id) => {
  const g = window.game;
  const THREE = g.modules.THREE;
  const face = g.modules.Adverts.get().boards().find((b) => b.face.id === id).face;
  const mesh = face.mesh;
  mesh.updateWorldMatrix(true, false);
  const centre = new THREE.Vector3();
  mesh.getWorldPosition(centre);
  const normal = new THREE.Vector3(0, 0, 1).applyQuaternion(mesh.getWorldQuaternion(new THREE.Quaternion()));
  const cam = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.5, 2000);
  cam.position.copy(centre).addScaledVector(normal, 5).add(new THREE.Vector3(0, -10.5, -30));
  cam.layers.mask = g.cameraManager.camera.layers.mask;
  cam.lookAt(centre);
  g.renderer.render(g.world.scene, cam);
  window.__dbg = (JSON.stringify({ centre, cam: cam.position, normal, visible: (() => { for (let o = mesh; o; o = o.parent) if (!o.visible) return false; return true; })(), root: (() => { let o = mesh; while (o.parent) o = o.parent; return o === g.world.scene; })(), player: g.player.mesh.position }));
  return g.renderer.domElement.toDataURL('image/png');
}, BOARD);
const fs = await import('node:fs');
fs.writeFileSync(`${out}/ads-road.png`, Buffer.from(shot.split(',')[1], 'base64'));
await browser.close();
