// Home residence evidence: starter flats + common templates; phone eye + desktop play camera.
import fs from 'node:fs';
import path from 'node:path';
import { launch, open, newPlayer, closeDialogs, wait, playUntil, advance } from './lib.mjs';

const outRoot = process.argv[2] || 'docs/evidence/homes';

const play = async (page, seconds) => {
  for (let t = 0; t < seconds; t += 0.5) {
    await advance(page, 0.5);
    await wait(15);
  }
};

const rentAndEnter = async (page, propId) => {
  await page.evaluate((pid) => {
    const g = window.game;
    g.hud.backend.performGig(8_000_000, 0, 'homes evidence');
    const data = g.hud.backend.getData();
    for (const p of data.properties) if (p.ownerId === data.id) { p.status = 'available'; p.ownerId = 'npc'; }
    const p = data.properties.find((x) => x.id === pid);
    if (p) { p.status = 'rented'; p.ownerId = data.id; }
    if (g.world.interiorManager.currentInterior) {
      g.world.interiorManager.exitCurrentInterior(g.player, g.cameraManager, g.hud, g.world);
    }
    g.hud.onEnterInterior(`residence:${pid}`);
  }, propId);
  await wait(400);
  await playUntil(page, () => (window.game.world.interiorManager.currentInterior?.type === 'residence' && !window.game.world.interiorManager.busy ? true : null), 35);
  await play(page, 1.5);
};

const standEye = async (page, x, z, yaw) => {
  await page.evaluate(({ x, z, yaw }) => {
    const g = window.game;
    const o = g.world.interiorManager.residence.group.position;
    g.player.stopMoving();
    g.player.mesh.position.set(o.x + x, 0, o.z + z);
    g.player.mesh.rotation.y = yaw;
    g.cameraManager.eyeYaw = yaw;
    g.cameraManager.setInteriorEye(true);
  }, { x, z, yaw });
  await play(page, 0.8);
  await wait(400);
};

const standPlay = async (page, x, z, yaw) => {
  await page.evaluate(({ x, z, yaw }) => {
    const g = window.game;
    const o = g.world.interiorManager.residence.group.position;
    g.player.stopMoving();
    g.player.mesh.position.set(o.x + x, 0, o.z + z);
    g.player.mesh.rotation.y = yaw;
    g.cameraManager.setInteriorEye(false);
  }, { x, z, yaw });
  await play(page, 1.2);
  await wait(400);
};

const samplePerf = async (page, level) => {
  await page.evaluate((lvl) => window.game.graphics.choose(lvl), level);
  await wait(500);
  return page.evaluate(() => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(() => {
    const i = window.game.renderer.info.render;
    done({ calls: i.calls, tris: i.triangles });
  }))));
};

const verifyStations = async (page) => page.evaluate(() => {
  const ids = ['flat-tv', 'flat-bed', 'flat-fridge', 'flat-drum'];
  const g = window.game;
  const all = g.world.interiorManager.getActiveInteractiveObjects();
  const out = ids.map((id) => ({ id, ok: !!all.find((x) => x.id === id) }));
  const cards = [...all.filter((x) => x.id.startsWith('home_toilet_') || x.id.startsWith('home_shower_'))];
  out.push({ id: 'home_wash', ok: cards.length > 0 });
  return out;
});

const meta = async (page) => page.evaluate(() => {
  const r = window.game.world.interiorManager.residence;
  return { key: r.plan?.key, standard: r.standard, rooms: r.plan?.rooms.map((x) => x.name) };
});

fs.mkdirSync(outRoot, { recursive: true });

const browser = await launch();

// Phone: Mushin self-contain (starter) + mainland 3-bed flat
{
  const ctx = await newPlayer(browser);
  const { page } = await open(ctx, { w: 390, h: 844 });
  await closeDialogs(page);
  await page.evaluate(() => { window.game.world.skyEnvironment.setHour(17); window.game.cameraManager.setInteriorEye(true); });
  await rentAndEnter(page, 'prop_mushin_room');
  const m = await meta(page);
  fs.writeFileSync(path.join(outRoot, 'meta-mushin.json'), JSON.stringify(m, null, 2));
  await standEye(page, 0, 0, Math.PI);
  await page.screenshot({ path: path.join(outRoot, 'phone-mushin-parlour-390x844.png') });
  await standEye(page, -2, -2.5, 0.4);
  await page.screenshot({ path: path.join(outRoot, 'phone-mushin-kitchen-390x844.png') });
  await ctx.close();
}

{
  const ctx = await newPlayer(browser);
  const { page } = await open(ctx, { w: 390, h: 844 });
  await closeDialogs(page);
  await page.evaluate(() => { window.game.world.skyEnvironment.setHour(17); window.game.cameraManager.setInteriorEye(true); });
  await rentAndEnter(page, 'prop_mainland_apt');
  await standEye(page, 1, 1.5, -0.3);
  await page.screenshot({ path: path.join(outRoot, 'phone-mainland-parlour-390x844.png') });
  await standEye(page, -4, -5, 0);
  await page.screenshot({ path: path.join(outRoot, 'phone-mainland-bedroom-390x844.png') });
  const stations = await verifyStations(page);
  fs.writeFileSync(path.join(outRoot, 'stations.json'), JSON.stringify(stations, null, 2));
  await ctx.close();
}

// Desktop play camera — mainland apt (parlour + kitchen corridor)
{
  const ctx = await newPlayer(browser);
  const { page } = await open(ctx, { w: 1280, h: 800 });
  await closeDialogs(page);
  await page.evaluate(() => {
    window.game.world.skyEnvironment.setHour(17);
    window.game.cameraManager.setInteriorEye(false);
  });
  await rentAndEnter(page, 'prop_mainland_apt');
  await standPlay(page, 0.5, 2.8, Math.PI);
  await page.screenshot({ path: path.join(outRoot, 'desktop-mainland-parlour-1280x800.png') });
  await standPlay(page, -5, -2, 0.6);
  await page.screenshot({ path: path.join(outRoot, 'desktop-mainland-corridor-1280x800.png') });
  const veryLow = await samplePerf(page, 'veryLow');
  const medium = await samplePerf(page, 'balanced');
  const perf = {
    measuredAt: new Date().toISOString().slice(0, 16) + 'Z',
    method: 'graphics.choose(level) then 2 rAF sample; Medium = balanced',
    place: 'prop_mainland_apt residence',
    planKey: (await meta(page)).key,
    veryLow,
    medium,
  };
  fs.writeFileSync(path.join(outRoot, 'perf.json'), JSON.stringify(perf, null, 2));
  await ctx.close();
}

await browser.close();
console.log('Home evidence written to', outRoot);