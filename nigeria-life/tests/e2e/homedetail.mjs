// The home in detail: a door in every room's doorway that swings open as the player comes up
// and closes behind them, and can be changed for another style; walls to the height of the
// catalogue's partitions; POP ceilings with cove lights and a light in every room; a carport for
// five cars; doors in the catalogue; and room to zoom out over it all.
import { open, newPlayer, closeDialogs, advance, wait, playUntil, money, enterInterior } from './lib.mjs';

const doors = (page) => page.evaluate(() => {
  const r = window.game.world.interiorManager.residence;
  return ['home_door_bedroom1', 'home_door_bedroom2', 'home_door_bathroom'].map((id) => {
    const holder = r.group.getObjectByName(`home door ${id}`);
    const leaf = holder?.getObjectByName('door_leaf');
    let shown = !!holder;
    for (let o = holder; o; o = o.parent) if (!o.visible) shown = false;
    return { id, shown, angle: leaf ? +leaf.rotation.y.toFixed(2) : null };
  });
});
const standAt = (page, x, z) => page.evaluate(({ x, z }) => { const g = window.game; const o = g.world.interiorManager.residence.group.position; g.player.stopMoving(); g.player.mesh.position.set(o.x + x, 0, o.z + z); }, { x, z });

export async function run(browser, check) {
  const ctx = await newPlayer(browser);
  const { page, log } = await open(ctx);
  await closeDialogs(page);
  await page.evaluate(async () => {
    const g = window.game;
    g.world.interiorManager.residence.constructor.standardNow = () => 'comfortable';
    // A three-bedroom house: a parlour, a corridor, three bedrooms each with its bathroom, a carport
    g.world.interiorManager.residence.constructor.briefNow = () => ({ kind: 'house', bedrooms: 3, carport: true });
    g.world.skyEnvironment.setHour(21);
    const b = g.hud.backend; b.data.bank.balance += 200_000_000; b.data.walletCash += 2_000_000; b.saveData();
    for (const id of ['okada', 'okada', 'okada']) await g.garage.buyNew(id);
  });
  await enterInterior(page, 'residence');
  await advance(page, 1);

  // ------------------------------------------------------------------ Walls, doors, ceilings, lights
  const room = await page.evaluate(() => {
    const r = window.game.world.interiorManager.residence;
    const walls = r.group.children.filter((o) => o.name === 'home_partition').map((o) => +o.geometry.parameters.height.toFixed(2));
    let lights = 0;
    r.group.traverse((o) => { if (o.isPointLight) lights += 1; });
    const pop = r.group.getObjectByName('pop ceiling');
    return { walls: walls.length, heights: [...new Set(walls)], lights, pop: !!pop && pop.visible };
  });
  const closed = await doors(page);
  check('home: the rooms are walled to the height of a catalogue partition, with a door in each of the three doorways, POP ceilings and a light in every room',
    room.walls >= 6 && room.heights.length === 1 && room.heights[0] === 2.6 && closed.every((d) => d.shown && d.angle === 0) && room.pop && room.lights >= 4, { room, closed });

  // ------------------------------------------------------------------ A door opens as the player comes up, and closes behind them
  const plan = await page.evaluate(() => { const p = window.game.world.interiorManager.residence.plan; const d = p.doors.find((x) => x.id === 'home_door_bedroom1'); return { door: { x: d.x, z: d.z }, spawn: p.spawn }; });
  await standAt(page, plan.door.x, plan.door.z + 0.6);
  await advance(page, 1);
  const opened = (await doors(page))[0];
  await standAt(page, plan.spawn.x, plan.spawn.z);
  await advance(page, 1.2);
  const shut = (await doors(page))[0];
  check('home: the bedroom door swings open as the player comes up to it, and closes again when they have gone', Math.abs(opened.angle) > 1.2 && Math.abs(shut.angle) < 0.15, { opened, shut });

  // ------------------------------------------------------------------ Through the doors: from the living room to the master bed
  await standAt(page, plan.spawn.x, plan.spawn.z);
  await page.evaluate(() => { const g = window.game; const o = g.world.interactiveObjects.concat(g.world.interiorManager.getActiveInteractiveObjects()).find((x) => x.id === 'flat-bed'); g.hud.showInteractionCard(o); document.getElementById('card-action-btn')?.click(); });
  await wait(300);
  await page.evaluate(() => [...document.querySelectorAll('#game-dialogue-overlay button')].find((b) => /sleep|lie/i.test(b.textContent))?.click());
  let sawOpen = false;
  const lay = await playUntil(page, () => {
    const r = window.game.world.interiorManager.residence;
    for (const id of ['home_door_bedroom1']) { const l = r.group.getObjectByName(`home door ${id}`)?.getObjectByName('door_leaf'); if (l && Math.abs(l.rotation.y) > 1) window.__doorOpen = true; }
    return window.game.player.actor.pose.legs === 'lie' ? true : null;
  }, 40);
  sawOpen = await page.evaluate(() => !!window.__doorOpen);
  check('home: from the parlour the player walks down the corridor and through the door to the master bedroom and lies down on the bed, the doors opening on the way', !!lay && sawOpen, { lay, sawOpen });
  await page.evaluate(() => window.game.player.actor.hold?.release(true));
  // Up from the bed and free again before doing anything else
  await playUntil(page, () => { const a = window.game.player.actor; return !a.sequence && !a.hold && !a.scripted ? true : null; }, 20);
  await advance(page, 0.5);

  // ------------------------------------------------------------------ Changing a door
  const m0 = await money(page);
  await page.evaluate(() => { const g = window.game; const o = g.world.interiorManager.getActiveInteractiveObjects().find((x) => x.id === 'home_door_bathroom'); g.player.stopMoving(); g.player.mesh.position.set(o.interactionPoint.x, 0, o.interactionPoint.z); g.hud.showInteractionCard(o); document.getElementById('card-action-btn')?.click(); });
  await wait(300);
  const offered = await page.evaluate(() => [...document.querySelectorAll('#game-dialogue-overlay button')].map((b) => b.textContent.replace(/\s+/g, ' ').trim()));
  await page.evaluate(() => [...document.querySelectorAll('#game-dialogue-overlay button')].find((b) => /Steel security door/.test(b.textContent))?.click());
  // The walk to the doorway and the fitting take a few seconds
  const fitted = await playUntil(page, () => (JSON.stringify(localStorage).includes('steel') ? true : null), 20);
  await advance(page, 0.3);
  const m1 = await money(page);
  const label = await page.evaluate(() => { const g = window.game; const o = g.world.interiorManager.getActiveInteractiveObjects().find((x) => x.id === 'home_door_bathroom'); g.hud.showInteractionCard(o); return document.getElementById('card-action-btn')?.textContent ?? ''; });
  check('home: the bathroom door is changed for a steel security door, fitted while the player watches, ₦450,000 paid once',
    offered.some((t) => /Flush door/.test(t)) && offered.some((t) => /Frosted glass door/.test(t)) && m0.total - m1.total === 450_000 && /Steel security door/.test(label), { offered, paid: m0.total - m1.total, label });
  await page.evaluate(() => window.game.hud.hideInteractionCard());

  // ------------------------------------------------------------------ The carport
  const carport = await page.evaluate(() => {
    const r = window.game.world.interiorManager.residence;
    const port = r.group.getObjectByName('carport');
    const parked = r.carportCars.children.map((c) => +c.position.z.toFixed(1));
    return { bays: !!port.getObjectByName('carport frame'), shown: port.visible, parked };
  });
  check('home: the carport outside takes five cars side by side; the player\'s three are parked in three bays', carport.bays && carport.shown && carport.parked.length === 3 && new Set(carport.parked).size === 3, carport);

  // ------------------------------------------------------------------ Doors in the catalogue
  const shop = await page.evaluate(() => {
    const d = window.game.modules.HouseDecorationSystem.getInstance();
    const items = ['room_door_flush', 'room_door_panel', 'room_door_glass', 'room_door_steel'].map((id) => d.catalogueItem(id));
    return { items: items.map((i) => i && `${i.name} ₦${i.price}`), walkThrough: d.kind('room_door_glass').solid === false && d.kind('room_door_glass').use === 'door', leaf: !!d.createFurniture3DMesh('room_door_panel').getObjectByName('door_leaf') };
  });
  check('home: four doors are in the catalogue (flush, mahogany, glass, steel), to stand between partition walls; people walk through them and their leaf swings', shop.items.every(Boolean) && shop.walkThrough && shop.leaf, shop);

  // ------------------------------------------------------------------ Zooming out over it all
  const zoom = await page.evaluate(() => { const c = window.game.cameraManager; const before = c.interiorDistance; for (let i = 0; i < 40; i++) c.zoom(2); return { before: +before.toFixed(1), after: +c.interiorDistance.toFixed(1) }; });
  check('home: the view zooms out to well over twice the room\'s framing, carport and all', zoom.after >= zoom.before * 2.3, zoom);

  // ------------------------------------------------------------------ A house built on the player's own land is a home of its own
  const flatPieces = await page.evaluate(() => window.game.modules.HouseDecorationSystem.getInstance().placed.length);
  await page.evaluate(() => { const g = window.game; return g.world.interiorManager.exitCurrentInterior(g.player, g.cameraManager, g.hud, g.world); });
  await wait(1200);
  await page.evaluate(async () => {
    const g = window.game;
    g.hud.backend.data.bank.balance += 200_000_000; g.hud.backend.saveData();
    await g.land.buyFromState('lag-kakawa-w2');
    const r = g.land.plot('lag-kakawa-w2').rect;
    await g.land.startBuilding('lag-kakawa-w2', 'bungalow', (r.minX + r.maxX) / 2, (r.minZ + r.maxZ) / 2, 0);
    await g.registry.transact((s) => { s.buildings['lag-kakawa-w2'].startedAt -= 30 * 25_000; });
  });
  await page.evaluate(() => window.game.hud.phoneModal.openApp('land', 'plot:lag-kakawa-w2'));
  await wait(500);
  await page.evaluate(() => document.querySelector('#land-go-in')?.click());
  await playUntil(page, () => (window.game.world.interiorManager.currentInterior?.type === 'residence' && !window.game.world.interiorManager.isTransitioning ? true : null), 20);
  await advance(page, 0.5);
  const built = await page.evaluate(() => ({ name: window.game.world.interiorManager.currentInterior?.name, pieces: window.game.modules.HouseDecorationSystem.getInstance().placed.length, home: window.game.modules.HouseDecorationSystem.getInstance().homeId }));
  await page.evaluate(() => { const g = window.game; return g.world.interiorManager.exitCurrentInterior(g.player, g.cameraManager, g.hud, g.world); });
  await wait(1200);
  // The player rents a flat too: in through its compound gate is the flat, with its own furniture
  await page.evaluate(() => { const b = window.game.hud.backend; const flat = b.data.properties.find((p) => p.type === 'apartment' || p.type === 'self-contained'); flat.ownerId = b.data.id; flat.status = 'rented'; b.saveData(); });
  await page.evaluate(() => { const g = window.game; const d = g.world.buildings.placeDoors.find((x) => x.buildingId === 'villa-compound'); g.player.mesh.position.set(d.outside.x, 0, d.outside.z); g.hud.onEnterInterior('villa-compound'); });
  await playUntil(page, () => (window.game.world.interiorManager.currentInterior?.type === 'residence' && !window.game.world.interiorManager.isTransitioning ? true : null), 30);
  await advance(page, 0.5);
  const back = await page.evaluate(() => ({ name: window.game.world.interiorManager.currentInterior?.name, pieces: window.game.modules.HouseDecorationSystem.getInstance().placed.length }));
  check('home: the bungalow built on the player’s own plot is a home of its own: going inside it is that house, by its name, bare to furnish; the flat keeps its own furniture',
    /bungalow at 7 Kakawa Street/i.test(built.name ?? '') && built.pieces === 0 && built.home === 'lag-kakawa-w2' && !/bungalow/i.test(back.name ?? '') && back.pieces === flatPieces && flatPieces > 0, { built, back, flatPieces });

  // ------------------------------------------------------------------ Kept
  await page.reload({ waitUntil: 'load' });
  await page.waitForFunction('window.game && window.game.world', { timeout: 120000 });
  await wait(2500);
  const kept = await page.evaluate(() => JSON.parse(localStorage.getItem(Object.keys(localStorage).find((k) => k.includes('home_doors_v1')) ?? '') || '{}'));
  check('home: the doors chosen are kept across a reload', kept.home_door_bathroom === 'steel', kept);

  check('home: no errors in the page', log.errors.length === 0, log.errors.slice(0, 5));
  await ctx.close();
}
