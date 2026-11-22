// Clothing performance: what dressed people cost, measured in the running game on Broad Street.
//
// 1. Outfit changes: the nearby models are re-dressed again and again (tops, trousers, hats, shoes and colours
//    cycling, as the crowd does when someone new walks into range). Each change must stay cheap, and repeated
//    changes must not pile up textures or shader programs (materials and weave textures are reused).
// 2. 20, 50 and 100 nearby people drawn as full dressed models (the crowd's model limit raised for the test):
//    frame time, draw calls and triangles for each, so the cost can be compared build to build.
// Works on any build that has the crowd models (the outfit-change part needs the street-look API).
import { newPlayer, open, closeDialogs, wait } from './lib.mjs';

async function sample(page, ms = 4000) {
  return page.evaluate(async (ms) => new Promise((resolve) => {
    const deltas = [];
    // Draw calls and triangles of every frame: the shadows are redrawn only on some frames, and those frames count
    // about double, so one frame's reading says little (the median is the usual frame, the peak a shadow frame)
    const callsSeen = [];
    const trisSeen = [];
    const g = window.game;
    const info = g.renderer.info;
    let last = performance.now();
    const start = last;
    const tick = (now) => {
      deltas.push(now - last);
      callsSeen.push(info.render.calls);
      trisSeen.push(info.render.triangles);
      last = now;
      if (now - start < ms) { requestAnimationFrame(tick); return; }
      const v = deltas.slice(2).sort((a, b) => a - b);
      const total = v.reduce((s, x) => s + x, 0);
      const median = (list) => { const s = list.slice(2).sort((a, b) => a - b); return s[Math.floor(s.length / 2)]; };
      const crowd = g.world.cityPopulation;
      const models = (crowd.models?.slots ?? []).filter((m) => m.handle && m.holder.visible).length;
      resolve({
        models,
        fps: +((v.length * 1000) / total).toFixed(1),
        avgMs: +(total / v.length).toFixed(1),
        p95: +v[Math.floor(v.length * 0.95)].toFixed(1),
        calls: median(callsSeen),
        triangles: median(trisSeen),
        peakCalls: Math.max(...callsSeen.slice(2)),
        programs: info.programs?.length ?? 0,
        textures: info.memory.textures,
        geometries: info.memory.geometries,
        heapMB: performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1048576) : null,
      });
    };
    requestAnimationFrame(tick);
  }), ms);
}

export async function run(browser, check) {
  const ctx = await newPlayer(browser);
  const { page } = await open(ctx, { w: 1366, h: 768 });
  await closeDialogs(page);
  await page.evaluate(() => {
    const g = window.game;
    g.world.skyEnvironment.setHour(12);
    for (let i = 0; i < 8; i++) g.advance(0.25);
  });
  await wait(1500);

  // ------------------------------------------------------------------ Nearby people as dressed models
  // The crowd makes its models one at a time for the nearest walkers; with its limit raised and a long reach it
  // makes N of them, dressed as their walkers are. They are then all stood round the player, walking, in rows in
  // front of the camera (the crowd's own placing paused), so every build draws the same N nearby people.
  const results = {};
  for (const n of [6, 20, 50, 100]) {
    await page.evaluate((n) => {
      const models = window.game.world.cityPopulation.models;
      const Crowd = models.constructor;
      Crowd.limit = n;
      Crowd.reach = 400;
      if (models.__sync) models.sync = models.__sync;
    }, n);
    let seen = -1;
    for (let k = 0; k < 300; k++) {
      await wait(300);
      // (fewer walkers in reach than n: the crowd's own model maker asked for the rest, men and women in turn)
      const now = await page.evaluate((args) => {
        const models = window.game.world.cityPopulation.models;
        const have = models.slots.length;
        if (have < args.n && models.loading === 0) models.make(args.k % 2 ? 'female' : 'male', Math.ceil(args.n / 2));
        return models.slots.filter((m) => m.handle).length;
      }, { n, k });
      if (now >= n || (now === seen && k > 60)) break;
      seen = now;
    }
    await page.evaluate((n) => {
      const g = window.game;
      const models = g.world.cityPopulation.models;
      models.__sync ??= models.sync;
      const cam = g.cameraManager.camera;
      const p = g.player.position;
      const fwd = new g.modules.THREE.Vector3();
      cam.getWorldDirection(fwd); fwd.y = 0; fwd.normalize();
      const side = new g.modules.THREE.Vector3(-fwd.z, 0, fwd.x);
      const yaw = Math.atan2(-fwd.x, -fwd.z);
      models.sync = function (delta) {
        const ready = this.slots.filter((m) => m.handle).slice(0, n);
        ready.forEach((m, i) => {
          const row = Math.floor(i / 10), col = (i % 10) - 4.5;
          if (m.holder.parent !== this.group) this.group.add(m.holder);
          m.holder.visible = true;
          m.holder.position.set(p.x + fwd.x * (4 + row * 1.6) + side.x * col * 1.1, p.y, p.z + fwd.z * (4 + row * 1.6) + side.z * col * 1.1);
          m.holder.rotation.set(0, yaw, 0);
          m.holder.scale.set(1, 1, 1);
          m.handle.play('walk', 0);
          m.handle.update(delta);
        });
        this.offers = [];
      };
    }, n);
    await wait(1500);
    results[n] = await sample(page);
  }
  // The crowd back to normal
  await page.evaluate(() => { const models = window.game.world.cityPopulation.models; models.sync = models.__sync; models.constructor.limit = 6; models.constructor.reach = 16; });
  console.log('NEARBY', JSON.stringify(results));
  check('20, 50 and 100 nearby dressed people measured (frame time, draw calls, triangles)',
    results[20].models >= 20 && results[50].models >= 50 && results[100].models >= 100, results);

  // ------------------------------------------------------------------ Repeated outfit changes
  const change = await page.evaluate(async () => {
    const g = window.game;
    const api = g.modules?.SkinnedCharacterApi;
    if (!api?.applyStreetLook) return { skipped: 'no street-look API in this build' };
    const handles = (g.world.cityPopulation.models?.slots ?? []).filter((m) => m.handle).map((m) => m.handle);
    const tops = ['tshirt', 'polo_shirt', 'button_shirt', 'hoodie', 'tee_oversized', 'senator'];
    const bottoms = ['jeans', 'jeans_slim', 'jeans_baggy', 'cargo_pants', 'chinos', 'shorts', 'cargo_shorts'];
    const hats = ['', 'cap', 'bucket_hat', 'beanie'];
    const shoes = ['sneakers', 'oxfords', 'boots', 'sandals'];
    const colours = [0xf8fafc, 0x1e3a8a, 0xb91c1c, 0x16a34a, 0xf59e0b, 0x111827, 0x7c3aed];
    const render = () => g.renderer.render(g.scene, g.cameraManager.camera);
    // Every garment worn once by every model first: a garment's own texture uploads the first time it is worn
    const warm = Math.max(tops.length, bottoms.length, hats.length, shoes.length);
    for (let r = 0; r < warm; r++) {
      handles.forEach((h, i) => api.applyStreetLook(h.root, { gender: h.root.name.includes('female') ? 'female' : 'male', outfit: tops[r % tops.length], bottom: bottoms[r % bottoms.length], hat: hats[r % hats.length], shoes: shoes[r % shoes.length] }));
      render();
    }
    render();
    const before = { textures: g.renderer.info.memory.textures, programs: g.renderer.info.programs?.length ?? 0, heapMB: performance.memory ? performance.memory.usedJSHeapSize / 1048576 : 0 };
    // Two passes of the same changes: the first may still upload a garment's texture the first time a model
    // wears it; the second (all seen before) must add nothing
    const rounds = 12;
    let mid = null;
    let changes = 0;
    let worst = 0;
    let total = 0;
    for (let r = 0; r < rounds; r++) {
      if (r === rounds / 2) mid = { textures: g.renderer.info.memory.textures, programs: g.renderer.info.programs?.length ?? 0 };
      for (let i = 0; i < handles.length; i++) {
        const k = (r % (rounds / 2)) * 7 + i;
        const look = {
          gender: handles[i].root.name.includes('female') ? 'female' : 'male',
          outfit: tops[k % tops.length], outfitColor: colours[k % colours.length],
          bottom: bottoms[(k * 3) % bottoms.length], trousersColor: colours[(k + 2) % colours.length],
          hat: hats[k % hats.length], hatColor: colours[(k + 4) % colours.length],
          shoes: shoes[(k * 5) % shoes.length], shoeColor: colours[(k + 1) % colours.length],
        };
        const s = performance.now();
        api.applyStreetLook(handles[i].root, look);
        const took = performance.now() - s;
        total += took;
        worst = Math.max(worst, took);
        changes++;
      }
      // Drawn between rounds, as the game would (new materials compile here)
      render();
    }
    render();
    const after = { textures: g.renderer.info.memory.textures, programs: g.renderer.info.programs?.length ?? 0, heapMB: performance.memory ? performance.memory.usedJSHeapSize / 1048576 : 0 };
    return { changes, msPerChange: +(total / changes).toFixed(2), worstMs: +worst.toFixed(1), before, mid, after, firstPassTextures: mid.textures - before.textures, texturesAdded: after.textures - mid.textures, programsAdded: after.programs - before.programs };
  });
  console.log('CHANGES', JSON.stringify(change));
  check('repeated outfit changes stay cheap and add no textures (weave textures and shader programs reused)',
    !!change.skipped || (change.changes >= 60 && change.msPerChange < 4 && change.texturesAdded <= 0 && change.programsAdded <= 2), change);
  await ctx.close();
}
