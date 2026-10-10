// The view indoors: the player is never hidden behind a wall, a partition or a shelf, only
// what is actually in the way is cut or faded, it eases in and out without flicker, and
// everything is put back exactly as it was on the way out.
import { open, wait, newPlayer, enterInterior, leaveInterior, advance, closeDialogs } from './lib.mjs';

/**
 * What stands, solid, between the camera and the player: anything at all in front of their
 * head, and anything tall in front of their waist (standing at a desk or a counter, the desk
 * is meant to be in front of their legs).
 */
const blockers = (page) => page.evaluate(() => {
  const g = window.game;
  const interiors = g.world.interiorManager;
  const group = interiors.getActiveInteriorGroup();
  const camera = g.cameraManager.camera;
  camera.updateMatrixWorld();
  group.updateWorldMatrix(true, true);
  const meshes = [];
  group.traverse((o) => {
    if (!o.isMesh || o.name === 'interior_floor_mesh') return;
    for (let p = o; p && p !== group; p = p.parent) {
      if (!p.visible || p.name === 'interior_ground_plot' || p.name.startsWith('interior_npc_')) return;
    }
    meshes.push(o);
  });
  const ray = g.cameraManager.collisionRaycaster;
  const found = new Set();
  const corner = g.player.position.clone();
  const topOf = (root) => {
    let top = -Infinity;
    root.traverse((o) => {
      if (!o.isMesh) return;
      if (!o.geometry.boundingBox) o.geometry.computeBoundingBox();
      const b = o.geometry.boundingBox;
      for (const x of [b.min.x, b.max.x]) for (const y of [b.min.y, b.max.y]) for (const z of [b.min.z, b.max.z]) {
        top = Math.max(top, corner.set(x, y, z).applyMatrix4(o.matrixWorld).y);
      }
    });
    return top;
  };
  for (const height of [1.55, 0.95]) {
    const to = g.player.position.clone();
    to.y += height;
    const direction = to.sub(camera.position);
    const distance = direction.length();
    ray.set(camera.position, direction.divideScalar(distance));
    ray.near = 0;
    ray.far = distance - 0.35;
    ray.layers.enableAll();
    for (const hit of ray.intersectObjects(meshes, false)) {
      const material = Array.isArray(hit.object.material) ? hit.object.material[0] : hit.object.material;
      if (material.opacity <= 0.5) continue;
      let top = hit.object;
      while (top.parent && top.parent !== group && top.parent.name !== 'interior_room_shell') top = top.parent;
      if (height < 1.5 && topOf(top) < 1.4) continue;
      found.add(top.name || top.type);
    }
  }
  return [...found];
});

const cutState = (page) => page.evaluate(() => {
  const cut = window.game.world.interiorManager.cutaway;
  return { ...cut.state(), settled: cut.settled };
});

/** Stands the player somewhere in the current room and points the room camera. */
const place = (page, x, z, yaw, pitch) => page.evaluate(({ x, z, yaw, pitch }) => {
  const g = window.game;
  const origin = g.world.interiorManager.currentInterior.interiorOrigin;
  g.player.stopMoving();
  g.player.mesh.position.set(origin.x + x, 0, origin.z + z);
  if (yaw !== undefined) g.cameraManager.interiorYaw = yaw;
  if (pitch !== undefined) g.cameraManager.interiorPitch = pitch;
}, { x, z, yaw, pitch });

/** Every mesh's material in the room, to check nothing is left swapped. */
const materialSnapshot = (page, type) => page.evaluate((type) => {
  const group = window.game.world.interiorManager[type].group;
  const ids = [];
  group.traverse((o) => { if (o.isMesh) ids.push((Array.isArray(o.material) ? o.material : [o.material]).map((m) => m.uuid).join('+')); });
  let walls = [];
  group.getObjectByName('interior_room_shell').traverse((o) => { if (o.name.startsWith('shell_wall_')) walls.push(+o.scale.y.toFixed(3)); });
  return { ids: ids.join(','), count: ids.length, walls, hidden: (() => { let n = 0; group.traverse((o) => { if (o.isMesh && !o.visible) n++; }); return n; })() };
}, type);

export async function run(browser, check) {
  const ctx = await newPlayer(browser);
  const { page, log } = await open(ctx);
  await closeDialogs(page);

  // ------------------------------------------------------------------ Walking into a room
  const homeBefore = await materialSnapshot(page, 'residence');
  await page.evaluate(() => { const be = window.game.hud.backend; be.rentProperty(be.getData().properties[0].id); });
  await enterInterior(page, 'residence');
  await advance(page, 0.6);
  let s = await cutState(page);
  let inTheWay = await blockers(page);
  check('on walking in, the walls on the camera\'s side are already down and nothing hides the player',
    s.cutWalls.includes('shell_wall_right') && !s.cutWalls.includes('shell_wall_left') && !s.cutWalls.includes('shell_wall_back') && inTheWay.length === 0 && s.settled, { ...s, inTheWay });

  const lift = await page.evaluate(() => {
    const g = window.game;
    const centre = g.world.interiorManager.currentInterior.interiorOrigin.clone().project(g.cameraManager.camera);
    return +centre.y.toFixed(3);
  });
  check('the room sits above the middle of the screen, clear of the cards along the bottom', lift > 0.08, { roomCentreScreenY: lift });

  // ------------------------------------------------------------------ All the way round
  const round = [];
  let hiddenSomewhere = false;
  for (let i = 0; i < 16; i++) {
    await page.evaluate((yaw) => { window.game.cameraManager.interiorYaw = yaw; }, -Math.PI + (i * Math.PI) / 8 + 0.1);
    await advance(page, 1.2);
    const here = await blockers(page);
    if (here.length > 0) hiddenSomewhere = true;
    round.push({ angle: i, cut: (await cutState(page)).cutWalls.map((w) => w.replace('shell_wall_', '')).join('+') || 'none', blocked: here });
  }
  check('turning the camera all the way round the room, the player is in clear view from every side',
    !hiddenSomewhere, round.filter((r) => r.blocked.length > 0).length ? round.filter((r) => r.blocked.length > 0) : round.map((r) => r.cut));
  check('different walls come down as the camera goes round, never all of them at once',
    new Set(round.map((r) => r.cut)).size >= 3 && round.every((r) => r.cut.split('+').length <= 2), round.map((r) => r.cut));

  // ------------------------------------------------------------------ No snapping, no flicker
  // Sweep slowly across the angle where the right-hand wall comes back up, recording its height every frame
  await page.evaluate(() => { window.game.cameraManager.interiorYaw = 0.62; });
  await advance(page, 1.5);
  const sweep = await page.evaluate(async () => {
    const g = window.game;
    const wall = g.world.interiorManager.getActiveInteriorGroup().getObjectByName('shell_wall_right');
    const heights = [];
    const cameraSteps = [];
    let last = g.cameraManager.camera.position.clone();
    for (let frame = 0; frame < 240; frame++) {
      g.cameraManager.rotate(-0.012);
      await g.advance(1 / 30);
      heights.push(wall.scale.y);
      cameraSteps.push(g.cameraManager.camera.position.distanceTo(last));
      last = g.cameraManager.camera.position.clone();
    }
    let biggest = 0;
    let turns = 0;
    let direction = 0;
    for (let i = 1; i < heights.length; i++) {
      const change = heights[i] - heights[i - 1];
      biggest = Math.max(biggest, Math.abs(change));
      const now = Math.sign(Math.round(change * 1000));
      if (now !== 0 && direction !== 0 && now !== direction) turns++;
      if (now !== 0) direction = now;
    }
    return { from: +heights[0].toFixed(2), to: +heights[heights.length - 1].toFixed(2), biggestStep: +biggest.toFixed(3), turns, biggestCameraStep: +Math.max(...cameraSteps).toFixed(2) };
  });
  check('a wall comes back up gradually as the camera turns away from it, not in one jump', sweep.from < 0.5 && sweep.to === 1 && sweep.biggestStep < 0.3, sweep);
  check('it rises once and stays up: no flickering up and down at the edge', sweep.turns === 0, { reversals: sweep.turns });
  check('the camera itself glides the whole way, with no jumps', sweep.biggestCameraStep < 2.2, { biggestStepPerFrame: sweep.biggestCameraStep });

  // ------------------------------------------------------------------ A partition between the camera and the player
  // Low camera to the east, the player just west of the wall between the two bedrooms
  await place(page, 0.8, -8, 1.35, 0.52);
  await advance(page, 1.5);
  s = await cutState(page);
  inTheWay = await blockers(page);
  const partition = await page.evaluate(() => {
    const cut = window.game.world.interiorManager.cutaway;
    const faded = cut.pieces.filter((p) => p.fade < 0.6);
    return {
      faded: faded.length,
      // The one between the bedrooms: a thin wall running north-south at x = 2
      isThePartition: faded.some((p) => Math.abs(p.root.position.x - 2) < 0.3 && p.root.geometry?.parameters?.depth > 5),
      opacity: faded.length ? +(Array.isArray(faded[0].meshes[0].material) ? faded[0].meshes[0].material[0] : faded[0].meshes[0].material).opacity.toFixed(2) : null,
      total: cut.pieces.length,
    };
  });
  check('standing behind a partition from where the camera is, the partition turns see-through and the player shows through it',
    inTheWay.length === 0 && partition.isThePartition && partition.opacity < 0.3, { partition, inTheWay });
  check('only what is in the way fades: the rest of the room stays solid', partition.faded <= 2 && partition.total > 10, partition);

  // Walk out from behind it
  await place(page, -6, 4);
  await advance(page, 2);
  s = await cutState(page);
  const restored = await page.evaluate(() => {
    const cut = window.game.world.interiorManager.cutaway;
    return { stillSwapped: cut.pieces.filter((p) => p.swapped).length, faded: cut.pieces.filter((p) => p.fade < 1 && !p.wall).length };
  });
  check('walking out from behind it, the partition turns solid again with its own material back', restored.faded === 0 && restored.stillSwapped <= s.seeThrough.length + s.hidden.length, { ...restored, s });

  // It eases: sample the opacity as the player steps back behind it
  await place(page, 0.8, -8);
  const easing = await page.evaluate(async () => {
    const g = window.game;
    const cut = g.world.interiorManager.cutaway;
    const piece = cut.pieces.find((p) => Math.abs(p.root.position.x - 2) < 0.3 && p.root.geometry?.parameters?.depth > 5);
    const values = [];
    for (let frame = 0; frame < 30; frame++) {
      await g.advance(1 / 30);
      values.push(+piece.fade.toFixed(3));
    }
    let biggest = 0;
    for (let i = 1; i < values.length; i++) biggest = Math.max(biggest, Math.abs(values[i] - values[i - 1]));
    return { first: values[0], last: values[values.length - 1], biggestStep: +biggest.toFixed(3) };
  });
  check('the fade is gradual, not a pop', easing.last <= 0.25 && easing.biggestStep < 0.35, easing);

  // ------------------------------------------------------------------ Sitting down: the camera moves in smoothly
  await place(page, -9.2, 2.5, 0.62, 0.86);
  await advance(page, 1);
  const closeIn = await page.evaluate(async () => {
    const g = window.game;
    g.hud.onHomeActivity('flat-tv');
    const steps = [];
    let last = g.cameraManager.camera.position.clone();
    const start = last.distanceTo(g.player.position);
    for (let frame = 0; frame < 150; frame++) {
      await g.advance(1 / 30);
      steps.push(g.cameraManager.camera.position.distanceTo(last));
      last = g.cameraManager.camera.position.clone();
    }
    return { seated: g.player.actor.hold !== null, start: +start.toFixed(1), end: +last.distanceTo(g.player.position).toFixed(1), biggestStep: +Math.max(...steps).toFixed(2) };
  });
  inTheWay = await blockers(page);
  check('sitting on the sofa brings the camera in close, gliding there, with the player still in clear view',
    closeIn.seated && closeIn.end < closeIn.start * 0.7 && closeIn.biggestStep < 1.6 && inTheWay.length === 0, { ...closeIn, inTheWay });
  await page.evaluate(() => window.game.world.interiorManager.residence.life.stop());
  await advance(page, 2);

  // ------------------------------------------------------------------ Leaving puts everything back
  await leaveInterior(page);
  const homeAfter = await materialSnapshot(page, 'residence');
  check('on leaving, every wall is back to full height and every material is the one it started with',
    homeAfter.ids === homeBefore.ids && homeAfter.walls.every((h) => h === 1) && homeAfter.hidden === homeBefore.hidden, { walls: homeAfter.walls, sameMaterials: homeAfter.ids === homeBefore.ids, hidden: homeAfter.hidden });
  const street = await page.evaluate(() => {
    const g = window.game;
    return { buildings: g.world.buildings.group.visible, shadows: g.renderer.shadowMap.enabled, sun: g.world.sunLight.visible && g.world.sunLight.castShadow, mode: g.cameraManager.mode };
  });
  check('back on the street the city, its shadows and its sun are untouched', street.buildings && street.shadows && street.sun && street.mode === 'street', street);

  // ------------------------------------------------------------------ Other kinds of room
  const rooms = [];
  for (const type of ['shop', 'bank', 'hospital', 'restaurant', 'police', 'university', 'airport']) {
    const key = type === 'university' ? 'unilag' : type;
    const before = await materialSnapshot(page, key);
    await enterInterior(page, type);
    await advance(page, 0.6);
    const spots = await page.evaluate(() => window.game.world.interiorManager.getActiveInteractiveObjects().map((o) => ({ id: o.id, x: o.interactionPoint.x, z: o.interactionPoint.z })));
    const hiddenAt = [];
    // Stand at everything the player can use, seen from the usual corner and from the opposite one
    for (const yaw of [0.62, 0.62 + Math.PI]) {
      for (const spot of spots) {
        await page.evaluate(({ spot, yaw }) => { const g = window.game; g.player.stopMoving(); g.player.mesh.position.set(spot.x, 0, spot.z); g.cameraManager.interiorYaw = yaw; }, { spot, yaw });
        await advance(page, 1.1);
        const here = await blockers(page);
        if (here.length > 0) hiddenAt.push({ at: spot.id, yaw: +yaw.toFixed(2), by: here });
      }
    }
    await leaveInterior(page);
    const after = await materialSnapshot(page, key);
    rooms.push({ type, spots: spots.length, hiddenAt, restored: after.ids === before.ids && after.walls.every((h) => h === 1) });
  }
  check('in the shop, bank, hospital, buka, police station, university and airport, the player is in clear view at every station from both sides of the room',
    rooms.every((r) => r.hiddenAt.length === 0), rooms.filter((r) => r.hiddenAt.length > 0).length ? rooms.filter((r) => r.hiddenAt.length > 0).map((r) => ({ type: r.type, hiddenAt: r.hiddenAt.slice(0, 4) })) : rooms.map((r) => `${r.type}: ${r.spots} spots`));
  check('and each of them is put back exactly as it was on leaving', rooms.every((r) => r.restored), rooms.map((r) => `${r.type}: ${r.restored}`));

  // ------------------------------------------------------------------ On the street: a building behind the player
  const pulled = await page.evaluate(async () => {
    const g = window.game;
    const cam = g.cameraManager;
    cam.setPreset('street');
    // Stand with the bank right behind the camera's usual place
    g.player.mesh.position.set(10.2, 0, -22);
    cam.yaw = Math.PI / 2;
    cam.snapToPlayer(g.player, 'street');
    await g.advance(1.5);
    const close = cam.camera.position.distanceTo(g.player.position);
    // Step out into the middle of the road, away from it
    g.player.mesh.position.set(0, 0, -22);
    // How far out the camera is allowed to sit, frame by frame, as the way clears
    const allowed = [];
    for (let frame = 0; frame < 120; frame++) {
      await g.advance(1 / 30);
      allowed.push(cam.collisionLimit);
    }
    let biggestOut = 0;
    for (let i = 1; i < allowed.length; i++) biggestOut = Math.max(biggestOut, allowed[i] - allowed[i - 1]);
    const full = allowed[allowed.length - 1];
    return { close: +close.toFixed(1), full: +full.toFixed(1), biggestStepOut: +biggestOut.toFixed(2), framesToFull: allowed.findIndex((d) => d > full - 0.3) };
  });
  check('on the street, a building behind the player brings the camera in front of it, and it eases back out when they step clear',
    pulled.close < pulled.full - 1 && pulled.biggestStepOut < 1.2 && pulled.framesToFull > 6, pulled);

  check('view: no console errors', log.errors.length === 0, log.errors.slice(0, 5));
  await ctx.close();
}
