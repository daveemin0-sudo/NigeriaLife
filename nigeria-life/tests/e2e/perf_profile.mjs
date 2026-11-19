// A measuring tool, not a suite: where the processor's time goes, by function, while the game
// loads and while it stands in the street. Run it against a build that is not minified, so the
// names can be read:
//
//   npx vite build --minify false --outDir <dir> && npx vite preview --outDir <dir> --port 4207
//   GAME_URL=http://localhost:4207/ node tests/e2e/perf_profile.mjs [load|street|drive|map] [seconds]
//
// It prints the functions that take the most time themselves, and the ones that take the most
// with everything they call.
import { launch, newPlayer, closeDialogs, wait, GAME_URL } from './lib.mjs';

const what = process.argv[2] || 'street';
const seconds = Number(process.argv[3] || 6);
const browser = await launch();
const ctx = await newPlayer(browser);
const page = await ctx.newPage();
await page.emulate({ viewport: { width: 360, height: 780, isMobile: true, hasTouch: true, deviceScaleFactor: 2 }, userAgent: 'Mozilla/5.0 (Linux; Android 14; SM-A165F) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36' });
const cdp = await page.createCDPSession();
await cdp.send('Profiler.enable');
await cdp.send('Profiler.setSamplingInterval', { interval: 500 });

let profile;
if (what === 'load') {
  await cdp.send('Profiler.start');
  const t0 = Date.now();
  await page.goto(GAME_URL, { waitUntil: 'load', timeout: 600000 });
  await page.waitForFunction('window.game', { timeout: 600000, polling: 100 });
  await wait(3000);
  profile = (await cdp.send('Profiler.stop')).profile;
  console.log(`loaded in ${((Date.now() - t0) / 1000).toFixed(1)} s (3 s of play included)`);
} else {
  await page.goto(GAME_URL, { waitUntil: 'load', timeout: 600000 });
  await page.waitForFunction('window.game', { timeout: 600000 });
  await wait(8000);
  await closeDialogs(page);
  if (what === 'drive') {
    await page.evaluate(() => {
      const g = window.game;
      g.checkpointPassAt = Date.now() + 3_600_000;
      const v = g.world.vehicles.drivableVehicles.find((c) => c.type === 'sedan');
      v.constructor.ignoreBodies = true;
      v.mesh.position.set(-4.9, 0, -100);
      v.mesh.rotation.y = 0;
      g.player.mesh.position.copy(v.mesh.position);
      g.enterVehicle(v);
      setInterval(() => { const c = g.player.currentVehicle; if (!c) return; c.currentSpeed = 16.7; if (c.mesh.position.z > 150) c.mesh.position.z = -100; }, 100);
    });
    await wait(2000);
  }
  if (what === 'map') {
    await page.evaluate(() => document.getElementById('nav-btn-map').click());
    await wait(3000);
  }
  const counts = await page.evaluate(() => { let nodes = 0, meshes = 0, visible = 0, auto = 0; window.game.scene.traverse((o) => { nodes += 1; if (o.isMesh) meshes += 1; if (o.matrixAutoUpdate) auto += 1; }); window.game.scene.traverseVisible(() => { visible += 1; }); return { nodes, meshes, visible, matrixAutoUpdate: auto, calls: window.game.renderer.info.render.calls, level: window.game.graphics.level }; });
  console.log('scene', JSON.stringify(counts));
  await cdp.send('Profiler.start');
  await wait(seconds * 1000);
  profile = (await cdp.send('Profiler.stop')).profile;
}
await browser.close();

// Time in each node: the samples that landed in it, times the gap between samples
const byId = new Map(profile.nodes.map((n) => [n.id, n]));
const self = new Map();
const deltas = profile.timeDeltas;
profile.samples.forEach((id, i) => self.set(id, (self.get(id) ?? 0) + (deltas[i] ?? 0) / 1000));
const total = [...self.values()].reduce((a, b) => a + b, 0);
const name = (n) => { const c = n.callFrame; const file = c.url.split('/').pop().split('?')[0]; return `${c.functionName || '(anonymous)'} ${file}:${c.lineNumber + 1}`; };
const selfBy = new Map();
for (const [id, ms] of self) { const k = name(byId.get(id)); selfBy.set(k, (selfBy.get(k) ?? 0) + ms); }
// With everything it calls: each function counted once per stack it is on
const incl = new Map();
const walk = (n, onStack) => {
  const k = name(n);
  let sum = self.get(n.id) ?? 0;
  const fresh = !onStack.has(k);
  if (fresh) onStack.add(k);
  for (const child of n.children ?? []) sum += walk(byId.get(child), onStack);
  if (fresh) { onStack.delete(k); incl.set(k, (incl.get(k) ?? 0) + sum); }
  return sum;
};
walk(profile.nodes[0], new Set());
const show = (title, map, n) => {
  console.log(`\n${title} (of ${total.toFixed(0)} ms sampled)`);
  for (const [k, ms] of [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, n)) console.log(`${ms.toFixed(0).padStart(7)} ms ${((ms / total) * 100).toFixed(1).padStart(5)}%  ${k}`);
};
// FOCUS=name: who calls it, by the chain of callers above it
if (process.env.FOCUS) {
  const parent = new Map();
  for (const n of profile.nodes) for (const c of n.children ?? []) parent.set(c, n.id);
  const sumOf = (n) => (self.get(n.id) ?? 0) + (n.children ?? []).reduce((a, c) => a + sumOf(byId.get(c)), 0);
  const chains = new Map();
  for (const n of profile.nodes) {
    if (!name(n).startsWith(process.env.FOCUS)) continue;
    const chain = [];
    for (let id = parent.get(n.id); id !== undefined; id = parent.get(id)) { const k = name(byId.get(id)).split(' ')[0]; if (!/^(WebGL|render|setProgram|\(anonymous\)|getUniforms|onFirstUse|projectObject|renderObjects?|renderScene|renderBufferDirect|\(root\))/.test(k)) chain.push(k); }
    const key = chain.slice(0, 7).reverse().join(' > ');
    chains.set(key, (chains.get(key) ?? 0) + sumOf(n));
  }
  show(`Callers of ${process.env.FOCUS}`, chains, 14);
}
show('By itself', selfBy, 45);
show('With what it calls', incl, 70);
