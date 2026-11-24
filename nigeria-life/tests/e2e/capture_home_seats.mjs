// Capture sofa + dining sit at home (phone viewport) for before/after evidence
import { launch, newPlayer, wait, playUntil, advance, closeDialogs } from './lib.mjs';
import fs from 'node:fs';

const out = process.argv[2] || '/tmp/nl-regression/seat-after';
fs.mkdirSync(out, { recursive: true });

const browser = await launch();
const ctx = await newPlayer(browser);
const page = await ctx.newPage();
await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
await page.goto(process.env.GAME_URL || 'http://127.0.0.1:5181/NigeriaLife/', { waitUntil: 'load', timeout: 120000 });
await page.waitForFunction('window.game', { timeout: 120000 });
await wait(6000);
await page.evaluate(() => {
  const g = window.game;
  g.world.skyEnvironment.setHour(14);
  const b = g.hud.backend;
  b.performGig(80_000_000, 0, 'test cash');
  b.rentProperty('prop_lekki_duplex');
  b.saveData();
});
await closeDialogs(page);
await page.evaluate(() => window.game.hud.onEnterInterior('residence:prop_lekki_duplex'));
await playUntil(page, () => (
  window.game.world.interiorManager.currentInterior?.type === 'residence'
  && !window.game.world.interiorManager.busy ? true : null
), 25);
await wait(800);
await closeDialogs(page);
await page.evaluate(() => {
  document.getElementById('game-dialogue-overlay')?.style.setProperty('display', 'none');
  for (const id of ['place-card', 'hud-top', 'bottom-nav', 'hud-proximity-prompt', 'home-activity-status']) {
    const el = document.getElementById(id);
    if (el) el.style.setProperty('visibility', 'hidden');
  }
  // Hide floating FABs
  document.querySelectorAll('.fab, #view-fab, #music-fab, #camera-fab').forEach((el) => { el.style.visibility = 'hidden'; });
});

const freezeCam = async (seat, mode) => {
  await page.evaluate((s, mode) => {
    const g = window.game;
    const o = g.world.interiorManager.residence.group.position;
    const cam = g.cameraManager.camera;
    // Stop follow so our shot sticks
    if (g.cameraManager.setFollowEnabled) g.cameraManager.setFollowEnabled(false);
    g.cameraManager.enabled = false;
    if (mode === 'side') {
      cam.position.set(o.x + s.x + 3.2, 0.95, o.z + s.z);
      cam.up.set(0, 1, 0);
      cam.lookAt(o.x + s.x, 0.55, o.z + s.z);
    } else {
      cam.position.set(o.x + s.x + 1.8, 2.4, o.z + s.z + 1.8);
      cam.up.set(0, 1, 0);
      cam.lookAt(o.x + s.x, 0.5, o.z + s.z);
    }
    cam.updateProjectionMatrix();
    g.renderer.render(g.world.scene, cam);
  }, seat, mode);
};

const sitFurniture = async (predSrc, name) => {
  const ok = await page.evaluate((src) => {
    const g = window.game;
    const r = g.world.interiorManager.residence;
    const decor = g.modules.HouseDecorationSystem.getInstance();
    const pred = eval(`(${src})`);
    const item = decor.placed.find(pred);
    if (!item) return { err: 'no item' };
    const kind = decor.kind(item.modelType);
    const spots = (kind.seats?.length ? kind.seats : kind.seat ? [kind.seat] : []).map((s) => ({
      x: s.x, z: s.z, top: s.top ?? 0.5,
    }));
    const turn = (item.turns * Math.PI) / 2;
    const onIt = (x, z) => ({
      x: item.x + x * Math.cos(turn) + z * Math.sin(turn),
      z: item.z - x * Math.sin(turn) + z * Math.cos(turn),
    });
    const dining = /dining_table|plastic_set/.test(item.modelType);
    const best = spots[Math.floor(spots.length / 2)] || spots[0];
    const seat = onIt(best.x, best.z);
    let facing;
    let front;
    if (dining) {
      facing = Math.atan2(item.x - seat.x, item.z - seat.z);
      const awayX = seat.x - item.x;
      const awayZ = seat.z - item.z;
      const len = Math.hypot(awayX, awayZ) || 1;
      front = { x: seat.x + (awayX / len) * 0.55, z: seat.z + (awayZ / len) * 0.55 };
    } else {
      const face = decor.facing(item.turns);
      const size = decor.footprint(item.modelType, item.turns);
      const reach = (face.x !== 0 ? size.width : size.depth) / 2 + 0.55;
      facing = Math.atan2(face.x, face.z);
      front = { x: item.x + face.x * reach, z: item.z + face.z * reach };
    }
    const THREE = g.modules.THREE;
    const started = r.life.sitAt(
      new THREE.Vector3(seat.x, 0, seat.z),
      new THREE.Vector3(front.x, 0, front.z),
      facing,
      best.top,
    );
    return { started, model: item.modelType, seat, facing, top: best.top, spots: spots.length, dining };
  }, predSrc);
  await playUntil(page, () => (window.game.player.actor.pose.legs === 'sit' ? true : null), 40);
  await advance(page, 1.2);
  const metrics = await page.evaluate((m) => {
    const g = window.game;
    const o = g.world.interiorManager.residence.group.position;
    const a = g.player.actor;
    const root = a.root;
    root.updateMatrixWorld(true);
    // Sample mid pelvis height
    let hipY = null;
    const THREE = g.modules.THREE;
    root.traverse((obj) => {
      if (!obj.isMesh || !obj.geometry?.attributes?.position) return;
      const pos = obj.geometry.attributes.position;
      const v = new THREE.Vector3();
      for (let i = 0; i < pos.count; i += 20) {
        v.fromBufferAttribute(pos, i).applyMatrix4(obj.matrixWorld);
        const ly = v.y - o.y;
        const d = Math.hypot(v.x - o.x - m.seat.x, v.z - o.z - m.seat.z);
        if (d < 0.3 && ly > m.top - 0.05 && ly < m.top + 0.5) {
          if (hipY == null || Math.abs(ly - (m.top + 0.22)) < Math.abs(hipY - (m.top + 0.22))) hipY = ly;
        }
      }
    });
    return { hipY, poseH: a.pose.height, rootY: root.position.y, skinnedY: a.getSkinned?.()?. /* no */ null, legs: a.pose.legs };
  }, ok);
  if (ok.seat) await freezeCam(ok.seat, 'side');
  await wait(100);
  await page.screenshot({ path: `${out}/${name}-side.png` });
  if (ok.seat) await freezeCam(ok.seat, 'iso');
  await wait(100);
  await page.screenshot({ path: `${out}/${name}.png` });
  await page.evaluate(() => {
    const a = window.game.player.actor;
    a.hold?.release?.(true);
    a.pose = { legs: 'stand', arms: 'rest' };
    a.setScripted(false);
    window.game.cameraManager.enabled = true;
  });
  await wait(400);
  return { ...ok, metrics };
};

const sofa = await sitFurniture(`(p) => p.uid === 'home_sofa' || /sofa/i.test(p.modelType)`, 'sofa-sit');
const dining = await sitFurniture(`(p) => /dining_table/.test(p.modelType)`, 'dining-sit');
console.log(JSON.stringify({ sofa, dining, out }, null, 2));
await browser.close();
