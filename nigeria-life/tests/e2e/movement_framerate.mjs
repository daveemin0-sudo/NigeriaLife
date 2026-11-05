// Dev check (not part of the suite): does walking and running cover the same ground whatever the
// frame rate? Drives the game's own step loop at fixed frame lengths with W (and Shift) held, from
// the same open spot on the pavement, and compares distance covered per second of game time.
//   node tests/e2e/movement_framerate.mjs
import { launch, open, closeDialogs } from './lib.mjs';

const browser = await launch();
const ctx = await browser.createBrowserContext();
const { page } = await open(ctx, { settle: 3000 });
await closeDialogs(page);

const result = await page.evaluate(async () => {
  const g = window.game;
  const keys = g.input.keys;
  const run = async (frame, sprint, seconds = 2) => {
    const p = g.player;
    p.stopMoving();
    p.onBridge = false;
    p.mesh.position.set(10, 0, 60); // east pavement, long clear stretch south→north
    p.mesh.rotation.y = Math.PI;
    for (const k of Object.keys(keys)) keys[k] = false;
    g.cameraManager.yaw !== undefined && (g.cameraManager.yaw = 0);
    await g.advance(0.2, frame); // settle
    const start = p.mesh.position.clone();
    keys['w'] = true;
    if (sprint) keys['shift'] = true;
    await g.advance(seconds, frame);
    keys['w'] = false;
    keys['shift'] = false;
    const d = Math.hypot(p.mesh.position.x - start.x, p.mesh.position.z - start.z);
    await g.advance(0.3, frame);
    return +(d / seconds).toFixed(2);
  };
  const rows = [];
  for (const frame of [1 / 120, 1 / 60, 1 / 30, 1 / 15, 1 / 10]) {
    rows.push({ fps: Math.round(1 / frame), walk: await run(frame, false), run: await run(frame, true) });
  }
  return { walkSpeed: g.player.walkSpeed, sprintSpeed: g.player.sprintSpeed, rows };
});

console.log(JSON.stringify(result, null, 2));
await browser.close();
