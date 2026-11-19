// A duplex has two floors. Rented, it is the parlour, the kitchen and a guest room downstairs with
// a flight of stairs up the hall, and the bedrooms upstairs. The floor button (or the stairs' card)
// walks the player to the foot of the stairs and up them, step by step; upstairs is then the
// floor they stand on, with its own rooms, doors and bathrooms, and only what is up there can be
// reached. Furniture put down upstairs stays upstairs: not seen, not in the way, from downstairs,
// and still there after a reload. Down again the same way. A flat keeps its one floor.
import { open, newPlayer, closeDialogs, wait, playUntil, reload } from './lib.mjs';

const SHOTS = process.env.SHOTS_DIR || null;

export async function run(browser, check) {
  const ctx = await newPlayer(browser);
  const { page } = await open(ctx);
  await closeDialogs(page);

  const into = async (propId) => {
    await page.evaluate((id) => window.game.hud.onEnterInterior(`residence:${id}`), propId);
    await playUntil(page, () => (window.game.world.interiorManager.currentInterior?.type === 'residence' && !window.game.world.interiorManager.busy ? true : null), 20);
    await wait(600);
  };
  const leave = async () => {
    await page.evaluate(() => { const g = window.game; return g.world.interiorManager.exitCurrentInterior(g.player, g.cameraManager, g.hud, g.world); });
    await wait(1500);
  };
  // What the house is like, and where the player is in it, right now
  const state = () => page.evaluate(() => {
    const g = window.game;
    const im = g.world.interiorManager;
    const r = im.residence;
    const o = r.group.position;
    const p = g.player.position;
    const upper = r.group.getObjectByName('interior_upper_storey');
    const ids = im.getActiveInteractiveObjects().map((x) => x.id);
    const btn = document.getElementById('nl-storey');
    return {
      storeys: r.plan?.storeys, storey: r.storey, y: +o.y.toFixed(2), upperShown: !!upper?.visible,
      player: { x: +(p.x - o.x).toFixed(2), y: +p.y.toFixed(2), z: +(p.z - o.z).toFixed(2) },
      room: r.roomNameAt(p.x, p.z),
      floor: im.getActiveFloorMesh()?.name ?? null,
      up: ids.includes('home_stairs_up'), down: ids.includes('home_stairs_down'), exit: ids.includes('interior_exit_door'), bed: ids.includes('flat-bed'), sofa: ids.includes('flat-tv'),
      upperDoors: ids.filter((id) => /home_door_bedroom[123]$/.test(id)).length,
      button: btn && !btn.hidden ? btn.textContent.replace(/\s+/g, ' ').trim() : null,
    };
  });

  // ------------------------------------------------------------------ A duplex: two floors
  const rented = await page.evaluate(() => {
    const be = window.game.hud.backend;
    be.performGig(60_000_000, 0, 'test: money for a duplex');
    return be.rentProperty('prop_lekki_duplex');
  });
  await into('prop_lekki_duplex');
  const plan = await page.evaluate(() => {
    const p = window.game.world.interiorManager.residence.plan;
    return { storeys: p.storeys, ground: p.rooms.map((r) => r.name), upper: p.upper?.rooms.map((r) => r.name) ?? [], stairs: !!p.stairs };
  });
  const down0 = await state();
  check('duplex: a rented duplex has two floors: parlour, kitchen, guest toilet and guest room downstairs, the bedrooms and bathrooms upstairs',
    rented.success && plan.storeys === 2 && plan.stairs && ['Parlour', 'Kitchen', 'Guest toilet', 'Guest room', 'Stair hall'].every((n) => plan.ground.includes(n)) && ['Master bedroom', 'Master bathroom', 'Bedroom 2', 'Bedroom 3', 'Bathroom', 'Landing'].every((n) => plan.upper.includes(n)),
    { rented: rented.message, plan });
  check('duplex: coming in is on the ground floor: the floor above is not shown, the stairs can be gone up, the button says Upstairs',
    down0.storey === 0 && down0.y === 0 && !down0.upperShown && down0.up && !down0.down && down0.exit && down0.button?.includes('Upstairs') && down0.floor === 'interior_floor_mesh', down0);
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/duplex-ground.png` });

  // ------------------------------------------------------------------ Up the stairs, walked
  await page.evaluate(() => document.getElementById('nl-storey')?.click());
  // Somewhere on the flight the house has sunk part of a storey and the player is still on their feet at the view's level
  const onFlight = await playUntil(page, () => {
    const r = window.game.world.interiorManager.residence;
    const y = r.group.position.y;
    return y < -0.9 && y > -2.7 ? { y: +y.toFixed(2), playerY: +window.game.player.position.y.toFixed(2) } : null;
  }, 25);
  const reached = await playUntil(page, () => (window.game.world.interiorManager.residence.storey === 1 && !window.game.player.actor?.busy ? true : null), 25);
  await playUntil(page, () => null, 2.5);
  const up1 = await state();
  check('duplex: Upstairs walks to the foot of the stairs and up them: the house sinks a step at a time as they climb',
    !!onFlight && Math.abs(onFlight.playerY) < 0.3 && !!reached, { onFlight, reached });
  check('duplex: upstairs is the floor they stand on: shown, walked on, the landing at the top; the stairs lead down; the front door is not up here',
    up1.storey === 1 && up1.y === -3.6 && up1.upperShown && Math.abs(up1.player.y) < 0.2 && up1.floor === 'interior_floor_upper' && up1.down && !up1.up && !up1.exit && up1.room === 'Landing' && up1.button?.includes('Downstairs'), up1);
  check('duplex: upstairs, the bedroom doors and the master bed are there to use; the sofa downstairs is not',
    up1.upperDoors >= 3 && up1.bed && !up1.sofa, up1);
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/duplex-upstairs.png` });

  // The stairwell is not walked into; the master bedroom is walked to through its door
  const walk = await page.evaluate(() => {
    const g = window.game;
    const r = g.world.interiorManager.residence;
    const o = r.group.position;
    const p = r.plan;
    const st = p.stairs;
    const master = p.upper.rooms.find((x) => x.id === 'bedroom1');
    const well = r.nav.isFree(o.x + (st.x0 + st.x1) / 2, o.z + (st.minZ + st.maxZ) / 2);
    const to = { x: o.x + (master.minX + master.maxX) / 2 - 1, z: o.z + master.minZ + 3.2 };
    // As a click on the floor does: round the walls, through the doorway
    const routed = g.input.walkPlayerTo(new g.modules.THREE.Vector3(to.x, 0, to.z));
    return { well, to, routed };
  });
  await playUntil(page, () => (!window.game.player.actor.busy && !window.game.player.isMoving ? true : null), 25);
  const inMaster = await state();
  check('duplex: the stairwell cannot be walked into, and a click in the master bedroom walks there through its door, level on the floor',
    walk.well === false && inMaster.room === 'Master bedroom' && Math.abs(inMaster.player.y) < 0.2, { walk, inMaster });

  // ------------------------------------------------------------------ Furniture upstairs stays upstairs
  const placed = await page.evaluate(() => {
    const g = window.game;
    const decor = g.modules.HouseDecorationSystem.getInstance();
    const r = g.world.interiorManager.residence;
    const master = r.plan.upper.rooms.find((x) => x.id === 'bedroom1');
    const at = { x: master.minX + 1.2, z: master.minZ + 4.4 };
    decor.beginPlacing('majesty_palm');
    decor.moveTo(at.x, at.z);
    const why = decor.blocked();
    const done = decor.confirm();
    const item = decor.placed.find((i) => i.id === 'majesty_palm' && Math.abs(i.z - at.z) < 0.3 && Math.abs(i.x - at.x) < 0.3);
    return { ok: done.ok, why, storey: item?.storey, uid: item?.uid, at, meshY: item ? +item.mesh.position.y.toFixed(2) : null };
  });
  check('duplex: a piece put down upstairs stands on the floor upstairs',
    placed.ok && placed.storey === 1 && placed.meshY >= 3.5, placed);

  // ------------------------------------------------------------------ Down again
  await page.evaluate(() => document.getElementById('nl-storey')?.click());
  const back = await playUntil(page, () => {
    const r = window.game.world.interiorManager.residence;
    return r.storey === 0 && r.group.position.y === 0 && !window.game.player.actor?.busy ? true : null;
  }, 30);
  await playUntil(page, () => null, 1.5);
  const down1 = await state();
  const hidden = await page.evaluate((uid) => {
    const g = window.game;
    const decor = g.modules.HouseDecorationSystem.getInstance();
    const r = g.world.interiorManager.residence;
    const item = decor.placed.find((i) => i.uid === uid);
    const o = r.group.position;
    // Not seen, not in the way: the floor under it is free downstairs (the guest toilet's or the kitchen's)
    return { shown: item?.mesh.visible, free: item ? r.nav.isFree(o.x + item.x, o.z + item.z) || r.life.solids.some((s) => Math.abs(s.x - item.x) < s.halfWidth && Math.abs(s.z - item.z) < s.halfLength) : null };
  }, placed.uid);
  check('duplex: Downstairs walks back down the flight to the hall; the floor above is gone from view and the front door is there again',
    !!back && down1.storey === 0 && down1.y === 0 && !down1.upperShown && down1.exit && down1.up && !down1.down && Math.abs(down1.player.y) < 0.2 && down1.room === 'Stair hall', down1);
  check('duplex: what stands upstairs is not seen from downstairs and is not in the way there',
    hidden.shown === false && hidden.free === true, hidden);

  // Sleep from downstairs: up the stairs to the bed first
  await page.evaluate(() => window.game.world.interiorManager.residence.onFloorOf('flat-bed', () => window.game.world.interiorManager.residence.life.sleep()));
  const slept = await playUntil(page, () => (window.game.world.interiorManager.residence.life.doing === 'sleeping' ? { storey: window.game.world.interiorManager.residence.storey } : null), 40);
  check('duplex: asked to sleep from downstairs, the player goes up the stairs to the master bed and lies down in it',
    !!slept && slept.storey === 1, { slept });
  await page.evaluate(() => window.game.world.interiorManager.residence.life.stop());
  await wait(400);

  // ------------------------------------------------------------------ After a reload
  await leave();
  await reload(page);
  await closeDialogs(page);
  await into('prop_lekki_duplex');
  const again = await page.evaluate((uid) => {
    const decor = window.game.modules.HouseDecorationSystem.getInstance();
    const item = decor.placed.find((i) => i.uid === uid);
    return { storey: item?.storey, shown: item?.mesh.visible, floor: window.game.world.interiorManager.residence.storey };
  }, placed.uid);
  check('duplex: after a reload the piece is still upstairs, and coming in is on the ground floor again',
    again.storey === 1 && again.shown === false && again.floor === 0, again);
  await leave();

  // ------------------------------------------------------------------ A flat has one floor
  await page.evaluate(() => window.game.hud.backend.rentProperty('prop_mainland_apt'));
  await into('prop_mainland_apt');
  const flat = await state();
  check('duplex: a flat has its one floor: no stairs, no floor button',
    flat.storeys === 1 && !flat.up && flat.button === null && flat.y === 0, flat);
  await leave();
  const out = await state();
  check('duplex: out of the house the floor button is gone', out.button === null, out);

  await ctx.close();
}
