// Driving with fingers on a phone, through the running game (not stepped by hand): the pedals and
// the steering pad are touched as a player touches them, two fingers at once, and the car is
// watched frame by frame. It pulls away, holds its lane, answers a small touch with a small
// correction and a long one with a turn (never a spin), brakes to a stop and waits there before
// it will back up, reverses slowly, stops at a wall, and the view follows without jerking.
//
// Times are the game's own (the sum of the frame steps), so a slow machine gives the same numbers.
import { newPlayer, closeDialogs, wait, GAME_URL } from './lib.mjs';

const LANE = -4.9;

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

  // Fingers: several at once, each its own touch, as a phone reports them
  const fingers = new Map();
  const down = async (id, x, y) => { fingers.set(id, await page.touchscreen.touchStart(x, y)); };
  const move = async (id, x, y) => { await fingers.get(id)?.move(x, y); };
  const up = async (id) => { const f = fingers.get(id); fingers.delete(id); await f?.end(); };
  const lift = async () => { for (const id of [...fingers.keys()]) await up(id); };
  const box = (sel) => page.evaluate((s) => { const e = document.querySelector(s); if (!e) return null; const r = e.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width, h: r.height, left: r.left, right: r.right }; }, sel);

  // Every frame: the game's time, the car, and the camera
  await page.evaluate(() => {
    const g = window.game;
    const log = (window.__drive = { on: false, rows: [], t: 0 });
    const step = g.step.bind(g);
    g.step = (dt) => { step(dt); log.t += dt; };
    const frame = () => {
      requestAnimationFrame(frame);
      const v = g.player.currentVehicle;
      if (!log.on || !v) return;
      const c = g.cameraManager.camera.position;
      log.rows.push([log.t, v.mesh.position.x, v.mesh.position.z, v.mesh.rotation.y, v.currentSpeed, v.steerInput, c.x, c.z, performance.now()]);
    };
    requestAnimationFrame(frame);
  });
  const place = (x, z, heading, speed = 0) => page.evaluate(({ x, z, heading, speed }) => {
    const g = window.game;
    let v = g.player.currentVehicle;
    if (!v) {
      v = g.world.vehicles.drivableVehicles.find((c) => c.type === 'sedan');
      g.player.mesh.position.copy(v.mesh.position);
      g.enterVehicle(v);
    }
    v.mesh.position.set(x, 0, z);
    v.mesh.rotation.y = heading;
    v.currentSpeed = speed;
    v.steerInput = 0;
    v.fuel = 100;
    if (v.velocityDirection) v.velocityDirection.set(Math.sin(heading), Math.cos(heading));
    window.__drive.rows = [];
    window.__drive.on = true;
  }, { x, z, heading, speed });
  const traces = [];
  // What the game is doing, for a check that fails: at the wheel? which screen? is its clock running?
  const state = () => page.evaluate(() => { const g = window.game; return { mode: document.body.dataset.uiMode ?? null, driving: g.player.isDriving, t: +window.__drive.t.toFixed(1), hidden: document.hidden, inside: !!g.world.interiorManager.currentInterior, toasts: [...document.querySelectorAll('.game-toast')].map((t) => t.textContent.trim().slice(0, 50)), dialog: document.getElementById('game-dialogue-overlay')?.innerText.slice(0, 80) ?? null, custody: !!document.querySelector('#custody-overlay, .custody-screen') }; });
  const rows = async () => { const got = await page.evaluate(() => { window.__drive.on = false; return window.__drive.rows; }); traces.push(got.map((row) => row.slice(0, 6).map((n) => +n.toFixed(2)))); return got; };
  const gameTime = () => page.evaluate(() => window.__drive.t);
  // Waits for so much of the game's own time
  const play = async (seconds) => { const end = (await gameTime()) + seconds; for (let i = 0; i < 600 && (await gameTime()) < end; i++) await wait(50); };
  const until = async (test, seconds) => { const end = (await gameTime()) + seconds; for (let i = 0; i < 900 && (await gameTime()) < end; i++) { if (await page.evaluate(test)) return true; await wait(50); } return false; };
  const deg = (r) => (r * 180) / Math.PI;

  // Other cars and walkers are out of it, and so are the police at the checkpoint down the road (they have their own suite)
  await page.evaluate(() => { window.game.world.vehicles.drivableVehicles[0].constructor.ignoreBodies = true; window.game.checkpointPassAt = Date.now() + 3_600_000; });
  await place(LANE, -100, 0);
  await wait(1500);
  const gas = await box('#drive-controls [data-key="w"]');
  const brake = await box('#drive-controls [data-key="s"]');
  const pad = await box('#drive-controls .drive-steer');
  check('drivetouch: on a phone the pedals and the steering pad are on the screen, each big enough for a thumb',
    !!gas && !!brake && !!pad && gas.w >= 60 && gas.h >= 60 && brake.w >= 60 && brake.h >= 60 && pad.w >= 120 && pad.h >= 56, { gas, brake, pad });
  if (!gas || !brake || !pad) { await ctx.close(); return; }
  // A touch on the pad, so far from its middle (-1 full left, +1 full right)
  const steerAt = (amount) => ({ x: pad.x + amount * (pad.w / 2 - 6), y: pad.y });

  // ------------------------------------------------------------------ Pulling away and holding the lane
  await place(LANE, -100, 0);
  await down(1, gas.x, gas.y);
  await play(6);
  let r = await rows();
  await lift();
  const at = (rs, t) => rs.find((row) => row[0] - rs[0][0] >= t) ?? rs[rs.length - 1];
  const pull = { after2s: +(at(r, 2)[4] * 3.6).toFixed(0), after6s: +(r[r.length - 1][4] * 3.6).toFixed(0), drift: +Math.max(...r.map((row) => Math.abs(row[1] - LANE))).toFixed(2), frames: r.length, fps: +(r.length / ((r[r.length - 1][8] - r[0][8]) / 1000)).toFixed(1) };
  check('drivetouch: holding GAS pulls away (over 25 km/h in two seconds, over 60 in six) and the car stays in its lane untouched', pull.after2s > 25 && pull.after6s > 60 && pull.drift < 0.4, pull);

  // ------------------------------------------------------------------ The view follows without jerking
  // Between frames the camera moves as the car does: the gap between them never jumps
  const gaps = r.slice(5).map((row) => Math.hypot(row[6] - row[1], row[7] - row[2]));
  const jumps = gaps.slice(1).map((g, i) => Math.abs(g - gaps[i]));
  const view = { worstJump: +Math.max(...jumps).toFixed(3), gapMin: +Math.min(...gaps).toFixed(2), gapMax: +Math.max(...gaps).toFixed(2) };
  check('drivetouch: the chase view stays planted behind the car (its distance never jumps more than 15 cm between frames)', view.worstJump < 0.15, view);

  // ------------------------------------------------------------------ A small touch is a small correction
  // (the touch is timed by the clock on the wall, as a thumb's is: about a fifth of a second)
  await place(LANE, -100, 0, 14);
  await play(0.3);
  const p1 = steerAt(-0.5);
  await down(2, p1.x, p1.y);
  await wait(180);
  await up(2);
  await play(2.5);
  r = await rows();
  await lift();
  const touched = r.filter((row) => row[5] !== 0);
  const tapTurn = { peakHeadingDeg: +Math.max(...r.map((row) => Math.abs(deg(row[3])))).toFixed(1), endHeadingDeg: +deg(r[r.length - 1][3]).toFixed(1), sideways: +(r[r.length - 1][1] - LANE).toFixed(2), wheelPeak: +Math.max(...r.map((row) => Math.abs(row[5]))).toFixed(2), touchSeconds: touched.length ? +(touched[touched.length - 1][0] - touched[0][0]).toFixed(2) : 0 };
  check('drivetouch: a short touch half-way left on the pad at 50 km/h nudges the car (under 14 degrees) and it comes back to its lane (within 2 m, nearly straight), never a spin', tapTurn.peakHeadingDeg > 0.2 && tapTurn.peakHeadingDeg < 14 && Math.abs(tapTurn.endHeadingDeg) < 6 && Math.abs(tapTurn.sideways) < 2, tapTurn);

  // ------------------------------------------------------------------ Holding the pad turns the car, and no more
  await place(LANE, -100, 0, 14);
  await down(1, gas.x, gas.y);
  await play(0.3);
  const p2 = steerAt(0.9);
  await down(2, p2.x, p2.y);
  await play(1.5);
  r = await rows();
  await lift();
  const heldTurn = { headingDeg: +deg(r[r.length - 1][3]).toFixed(1), speedKmh: +(r[r.length - 1][4] * 3.6).toFixed(0), wheel: +r[r.length - 1][5].toFixed(2) };
  check('drivetouch: holding the right of the pad for a second and a half at 50 km/h turns the car right by a bend (20 to 110 degrees), not round on itself', heldTurn.headingDeg < -20 && heldTurn.headingDeg > -110, heldTurn);

  // ------------------------------------------------------------------ A finger slid a little is a little steering
  await place(LANE, -100, 0, 10);
  const mid = steerAt(0);
  await down(2, mid.x, mid.y);
  await play(0.3);
  const little = steerAt(0.3);
  await move(2, little.x, little.y);
  await play(0.8);
  const wheelLittle = await page.evaluate(() => window.game.player.currentVehicle.steerInput);
  const lots = steerAt(0.95);
  await move(2, lots.x, lots.y);
  await play(0.8);
  const wheelLots = await page.evaluate(() => window.game.player.currentVehicle.steerInput);
  await lift();
  await play(0.8);
  const wheelFree = await page.evaluate(() => window.game.player.currentVehicle.steerInput);
  await rows();
  check('drivetouch: the pad is a slider: a finger a little right of the middle turns the wheel a little, far right turns it fully, and let go it comes back to the middle',
    Math.abs(wheelLittle) > 0.05 && Math.abs(wheelLittle) < 0.5 && wheelLots < -0.85 && Math.abs(wheelFree) < 0.05, { wheelLittle: +wheelLittle.toFixed(2), wheelLots: +wheelLots.toFixed(2), wheelFree: +wheelFree.toFixed(2) });

  // ------------------------------------------------------------------ Braking: to a stop, and it stays stopped
  await place(LANE, -100, 0, 16.7);
  await down(1, brake.x, brake.y);
  await until(() => Math.abs(window.game.player.currentVehicle.currentSpeed) < 0.05, 8);
  const tStop = await gameTime();
  await play(1.6);
  r = await page.evaluate(() => window.__drive.rows);
  const stopRow = r.find((row) => Math.abs(row[4]) < 0.05) ?? r[r.length - 1];
  const backRow = r.find((row) => row[0] > stopRow[0] && row[4] < -0.05);
  const stop = { seconds: +(stopRow[0] - r[0][0]).toFixed(2), metres: +(stopRow[2] - r[0][2]).toFixed(1), sideways: +(stopRow[1] - LANE).toFixed(2), stoodSeconds: backRow ? +(backRow[0] - stopRow[0]).toFixed(2) : null };
  check('drivetouch: BRAKE from 60 km/h stops the car in a straight line in under three seconds and 30 metres, and with the pedal still down it stands for half a second before it backs up', stop.seconds < 3 && stop.metres < 30 && Math.abs(stop.sideways) < 0.3 && stop.stoodSeconds !== null && stop.stoodSeconds >= 0.45 && stop.stoodSeconds < 1.2, stop);

  // ------------------------------------------------------------------ Kept down, it backs up, slowly
  await play(1.5);
  r = await rows();
  await lift();
  const back = { speedKmh: +(r[r.length - 1][4] * 3.6).toFixed(1), wentBack: +(r[r.length - 1][2] - stopRow[2]).toFixed(1), afterStop: +((await gameTime()) - tStop).toFixed(1) };
  check('drivetouch: BRAKE kept down after the stop backs the car up, at no more than 35 km/h', back.speedKmh < -2 && back.speedKmh > -35 && back.wentBack < -0.5, back);
  await play(2.5);
  const rolled = await page.evaluate(() => window.game.player.currentVehicle.currentSpeed);
  check('drivetouch: with every finger off, the car rolls to rest', Math.abs(rolled) < 1.5, { speed: +rolled.toFixed(2) });

  // ------------------------------------------------------------------ A wall stops it
  await place(LANE, -100, -Math.PI / 2);
  await down(1, gas.x, gas.y);
  await play(6);
  r = await rows();
  await lift();
  const wall = await page.evaluate(() => { const g = window.game; const v = g.player.currentVehicle; const p = v.mesh.position; return { x: +p.x.toFixed(1), z: +p.z.toFixed(1), speed: +v.currentSpeed.toFixed(2), inBuilding: !!g.world.collisionAt?.(p.x, p.z) }; });
  wall.furthest = +Math.min(...r.map((row) => row[1])).toFixed(1);
  check('drivetouch: driven straight at the buildings beside the road with GAS held for six seconds, the car is stopped by them (it does not pass 30 m from the road)', wall.furthest > LANE - 30 && Math.abs(wall.speed) < 3, wall);

  if (process.env.DRIVE_TRACE) (await import('node:fs')).writeFileSync(process.env.DRIVE_TRACE, JSON.stringify(traces));
  const ending = await state();
  if (ending.mode !== 'driving') console.log('drivetouch: the drive was interrupted', JSON.stringify(ending));
  if (process.env.DRIVE_SHOT) await page.screenshot({ path: process.env.DRIVE_SHOT });
  check('drivetouch: no errors in the page', errors.length === 0, errors.slice(0, 4));
  await ctx.close();
}
