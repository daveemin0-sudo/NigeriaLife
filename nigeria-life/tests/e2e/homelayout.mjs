// Residential interior quality demo: exterior/compound → elevated layout → rooms → walk → exit.
// Uses Lekki duplex as the showcase property. Screenshots land in SHOTS.
import { open, newPlayer, closeDialogs, wait, playUntil } from './lib.mjs';
import { mkdirSync } from 'node:fs';

const SHOTS = process.env.SHOTS || '/opt/cursor/artifacts';
mkdirSync(SHOTS, { recursive: true });

const PROP = 'prop_lekki_duplex';

const clean = (page) => page.evaluate(() => {
  document.querySelectorAll('.game-toast, #game-toast-container, #game-dialogue-overlay').forEach((el) => el.remove());
  document.body.classList.add('lx-clean');
});

const snap = async (page, name) => {
  await clean(page);
  await page.evaluate(() => window.game.render());
  await wait(200);
  await page.screenshot({ path: `${SHOTS}/homelayout-${name}.png` });
};

const enterHome = async (page) => {
  await page.evaluate((id) => window.game.hud.onEnterInterior(`residence:${id}`), PROP);
  await playUntil(page, () => (window.game.world.interiorManager.currentInterior?.type === 'residence' && !window.game.world.interiorManager.busy ? true : null), 30);
  await wait(600);
};

const leave = async (page) => {
  // Prefer the door path so rented homes emerge at their streetPosition (compound/neighbourhood continuity)
  await page.evaluate(() => {
    const g = window.game;
    return g.world.interiorManager.leaveThroughDoor(g.player, g.cameraManager, g.hud, g.world);
  });
  await playUntil(page, () => (!window.game.world.interiorManager.currentInterior && !window.game.world.interiorManager.busy ? true : null), 30);
  await wait(700);
};

export async function run(browser, check) {
  const ctx = await newPlayer(browser);
  const { page, log } = await open(ctx, { w: 1440, h: 900 });
  await closeDialogs(page);

  const rented = await page.evaluate((id) => {
    const be = window.game.hud.backend;
    be.performGig(8_000_000, 0, 'homelayout');
    const r = be.rentProperty(id);
    return { ok: r.success, id };
  }, PROP);
  check('homelayout: Lekki duplex rented', rented.ok, rented);

  // Enter then leave once so street-return places the player outside this home's door
  await enterHome(page);
  await leave(page);

  // ── 1. Exterior / compound (outside the duplex after exit) ─────────────
  const exterior = await page.evaluate(() => {
    const g = window.game;
    g.player.stopMoving();
    g.cameraManager.setMode('street');
    g.cameraManager.setPreset('isometric');
    g.cameraManager.snapToPlayer(g.player);
    g.render();
    const district = g.world.getDistrictAtPosition?.(g.player.position);
    return {
      x: +g.player.position.x.toFixed(1),
      z: +g.player.position.z.toFixed(1),
      district: district?.name ?? null,
      mode: g.cameraManager.mode,
    };
  });
  await wait(500);
  await snap(page, '01-exterior-compound');
  check('homelayout: exterior framing near Lekki street',
    exterior.mode === 'street' && Math.abs(exterior.x - 55) < 25 && Math.abs(exterior.z - 0) < 25,
    exterior);

  // ── 2. Full interior elevated / aerial dollhouse ───────────────────────
  await enterHome(page);
  const aerial = await page.evaluate(() => {
    const g = window.game;
    g.cameraManager.setPreset('aerial');
    for (let i = 0; i < 12; i++) g.world.interiorManager.cutaway.update(0.05, g.cameraManager.camera, g.player.position);
    g.cameraManager.snapToPlayer(g.player);
    g.render();
    const cut = g.world.interiorManager.cutaway.state();
    const rooms = g.world.interiorManager.residence?.plan?.rooms?.map((r) => r.kind) ?? [];
    return { cutWalls: cut.cutWalls, rooms, pitch: +g.cameraManager.interiorPitch.toFixed(2) };
  });
  await wait(400);
  await snap(page, '02-elevated-layout');
  check('homelayout: aerial dollhouse cuts outer walls and multi-room plan exists',
    aerial.pitch >= 1.3 && aerial.rooms.length >= 3,
    aerial);

  // Raised isometric "Home" view
  await page.evaluate(() => {
    const g = window.game;
    g.cameraManager.setPreset('isometric');
    for (let i = 0; i < 10; i++) g.world.interiorManager.cutaway.update(0.05, g.cameraManager.camera, g.player.position);
    g.cameraManager.snapToPlayer(g.player);
    g.render();
  });
  await wait(300);
  await snap(page, '02b-home-cutaway');

  // ── 3. Individual room views ───────────────────────────────────────────
  const rooms = await page.evaluate(() => {
    const g = window.game;
    const plan = g.world.interiorManager.residence?.plan;
    if (!plan?.rooms?.length) return [];
    const origin = g.world.interiorManager.residence.group.position;
    const picks = [];
    for (const kind of ['living', 'bedroom', 'kitchen', 'bathroom']) {
      const room = plan.rooms.find((r) => r.kind === kind || (kind === 'bedroom' && /bed/.test(r.kind)) || (kind === 'living' && /living|parlour|lounge/.test(r.kind)));
      if (!room) continue;
      picks.push({
        kind: room.kind,
        x: origin.x + (room.minX + room.maxX) / 2,
        z: origin.z + (room.minZ + room.maxZ) / 2,
      });
    }
    return picks;
  });

  for (const room of rooms.slice(0, 4)) {
    await page.evaluate((r) => {
      const g = window.game;
      g.player.stopMoving();
      g.player.mesh.position.set(r.x, 0, r.z);
      g.player.position.copy(g.player.mesh.position);
      g.cameraManager.setPreset('street');
      g.cameraManager.snapToPlayer(g.player);
      for (let i = 0; i < 8; i++) g.world.interiorManager.cutaway.update(0.05, g.cameraManager.camera, g.player.position);
      g.render();
    }, room);
    await wait(250);
    await snap(page, `03-room-${room.kind}`);
  }
  check('homelayout: captured individual room views', rooms.length >= 2, { rooms: rooms.map((r) => r.kind) });

  // ── 4. Normal player exploration (eye + close) ─────────────────────────
  await page.evaluate(() => {
    const g = window.game;
    const spawn = g.world.interiorManager.residence?.def?.playerSpawnOffset;
    const o = g.world.interiorManager.residence.group.position;
    if (spawn) {
      g.player.mesh.position.set(o.x + spawn.x, 0, o.z + spawn.z);
      g.player.position.copy(g.player.mesh.position);
    }
    g.cameraManager.setPreset('eye');
    g.cameraManager.snapToPlayer(g.player);
    g.render();
  });
  await wait(300);
  await snap(page, '04-explore-eyes');

  await page.evaluate(() => {
    const g = window.game;
    g.cameraManager.setPreset('close');
    g.cameraManager.snapToPlayer(g.player);
    g.render();
  });
  await wait(250);
  await snap(page, '04b-explore-close');

  // Walk toward sofa / living furniture if present
  await page.evaluate(() => {
    const g = window.game;
    const sofa = g.modules.HouseDecorationSystem.getInstance().placed.find((p) => /sofa/i.test(p.modelType) || p.uid === 'home_sofa');
    if (!sofa) return;
    const o = g.world.interiorManager.residence.group.position;
    g.player.mesh.position.set(o.x + sofa.x + 1.2, 0, o.z + sofa.z + 1.2);
    g.player.position.copy(g.player.mesh.position);
    g.cameraManager.setPreset('street');
    g.cameraManager.snapToPlayer(g.player);
    g.render();
  });
  await wait(250);
  await snap(page, '04c-explore-living');

  // ── 5. Exit back into the live neighbourhood ───────────────────────────
  await leave(page);
  await page.evaluate(() => {
    const g = window.game;
    g.cameraManager.setPreset('street');
    g.cameraManager.snapToPlayer(g.player);
    g.render();
  });
  await wait(400);
  await snap(page, '05-exit-neighbourhood');

  await page.evaluate(() => {
    const g = window.game;
    g.cameraManager.setPreset('isometric');
    g.cameraManager.snapToPlayer(g.player);
    g.render();
  });
  await wait(300);
  await snap(page, '05b-exit-neighbourhood-high');

  const outside = await page.evaluate(() => ({
    inside: !!window.game.world.interiorManager.currentInterior,
    mode: window.game.cameraManager.mode,
  }));
  check('homelayout: exited to street neighbourhood', !outside.inside && outside.mode === 'street', outside);

  // Re-enter once to assert architecture markers from the upgrades
  await enterHome(page);
  const built = await page.evaluate(() => {
    const g = window.game;
    const root = g.world.interiorManager.residence.group;
    let frames = 0;
    let windows = 0;
    let tiled = 0;
    root.traverse((o) => {
      if (o.name === 'door_frame' || o.name === 'entrance_frame') frames += 1;
      if (o.name === 'window') windows += 1;
      if (typeof o.name === 'string' && o.name.startsWith('floor ')) tiled += 1;
    });
    return { frames, windows, tiled, rooms: g.world.interiorManager.residence.plan?.rooms?.length ?? 0 };
  });
  check('homelayout: door frames, curtained windows, and tiled wet rooms present',
    built.frames >= 2 && built.windows >= 1 && built.rooms >= 3,
    built);

  await leave(page);
  check('homelayout: no page errors', log.errors.length === 0, log.errors.slice(0, 4));
}
