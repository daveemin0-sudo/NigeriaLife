// People further off than the nearest few: they really step (the baked frames are different poses, each foot in turn),
// their feet keep pace with how fast they move, and they are in the same clothes as when they were close.
import { open, newPlayer, closeDialogs, wait } from './lib.mjs';

export async function run(browser, check) {
  const ctx = await newPlayer(browser);
  const { page } = await open(ctx, { w: 1366, h: 768 });
  await closeDialogs(page);
  await page.evaluate(() => window.game.world.skyEnvironment.setHour(12));
  await wait(5000);

  const legs = await page.evaluate(() => {
    const crowd = window.game.world.cityPopulation, baked = crowd.baked, Baked = baked.constructor;
    const look = { gender: 'male', outfit: 'casual_tee', outfitColor: 0x2563eb, bottom: 'jeans', trousersColor: 0x1e3a5f, shoes: 'sneakers' };
    baked.begin();
    for (let f = 0; f < 8; f++) baked.draw(1, look, 'farwalk-test', 0, -100, 0, 0, 1, 'walk', (f + 0.5) / 8);
    baked.end();
    const cut = baked.dresses.get('farwalk-test').key;
    const feet = [], tops = [];
    for (let f = 0; f < 8; f++) {
      const p = Baked.frames.get(`male|${cut}|walk|${f}`).getAttribute('position');
      const side = [[0, 0], [0, 0]];
      let top = -Infinity;
      for (let i = 0; i < p.count; i++) { top = Math.max(top, p.getY(i)); if (p.getY(i) < 0.14) { const s = side[p.getX(i) > 0 ? 0 : 1]; s[0] += p.getZ(i); s[1]++; } }
      tops.push(top);
      feet.push(side.map(([sum, n]) => (n ? sum / n : 0)));
    }
    const a = feet.map((x) => x[0]), b = feet.map((x) => x[1]);
    const mean = (v) => v.reduce((s, x) => s + x, 0) / v.length;
    const [ma, mb] = [mean(a), mean(b)];
    const cov = a.reduce((s, x, i) => s + (x - ma) * (b[i] - mb), 0);
    const spread = (v, m) => Math.sqrt(v.reduce((s, x) => s + (x - m) ** 2, 0));
    return { swingA: +(Math.max(...a) - Math.min(...a)).toFixed(3), swingB: +(Math.max(...b) - Math.min(...b)).toFixed(3), together: +(cov / (spread(a, ma) * spread(b, mb))).toFixed(2), lowestHead: +Math.min(...tops).toFixed(3), highestHead: +Math.max(...tops).toFixed(3) };
  });
  check('farwalk: the far figures really step: upright in every frame, each foot swinging, the two in opposite time', legs.swingA > 0.25 && legs.swingB > 0.25 && legs.together < -0.5 && legs.lowestHead > 1.55 && legs.highestHead - legs.lowestHead < 0.09, legs);

  const pace = await page.evaluate(async () => {
    const crowd = window.game.world.cityPopulation, baked = crowd.baked, was = baked.draw, seen = new Map();
    baked.draw = function (id, look, key, x, y, z, yaw, scale, mode, cycle) {
      if (mode === 'walk') { const r = seen.get(id) ?? { x0: x, z0: z, c0: cycle, moved: 0, x, z, c: cycle, jumps: 0, scale }; const step = Math.hypot(x - r.x, z - r.z); if (step > 1) r.jumps++; r.moved += step; r.x = x; r.z = z; r.c = cycle; seen.set(id, r); }
      return was.call(this, id, look, key, x, y, z, yaw, scale, mode, cycle);
    };
    await new Promise((r) => setTimeout(r, 5000));
    baked.draw = was;
    const per = [...seen.values()].filter((r) => !r.jumps && r.moved > 1.5 && r.c > r.c0).map((r) => r.moved / (r.c - r.c0) / r.scale).sort((u, v) => u - v);
    return { walkers: per.length, median: per.length ? +per[per.length >> 1].toFixed(2) : null };
  });
  check('farwalk: a far walker takes one full stride for each 1.0 to 1.45 m walked, so the feet do not skate', pace.walkers >= 3 && pace.median >= 1 && pace.median <= 1.45, pace);

  const clothes = await page.evaluate(() => {
    const crowd = window.game.world.cityPopulation, baked = crowd.baked, THREE = window.game.modules.THREE;
    const far = (name, look) => {
      baked.begin();
      baked.draw(2, look, `farwalk-${name}`, 0, -100, 0, 0, 1, 'idle', 0);
      baked.end();
      return baked.dresses.get(`farwalk-${name}`);
    };
    const buba = far('buba', { gender: 'female', outfit: 'buba', outfitColor: 0x1e3a8a, bottom: 'iro', trousersColor: 0x0d9488, shoes: 'sandals' });
    const peplum = far('peplum', { gender: 'female', outfit: 'peplum_top', outfitColor: 0xdb2777, bottom: 'pencil_skirt', trousersColor: 0xdb2777, shoes: 'heels' });
    const plain = far('plain', { gender: 'female', outfit: 'casual_blouse', outfitColor: 0x0d9488, bottom: 'chinos', trousersColor: 0x111827, shoes: 'heels' });
    const print = far('print', { gender: 'female', outfit: 'casual_blouse', outfitColor: 0x0d9488, bottom: 'chinos', trousersColor: 0x111827, shoes: 'heels', styles: { top: { colour: '#0d9488', pattern: { kind: 'ankara', colour2: '#f8fafc', colour3: '#facc15' } } } });
    const base = new THREE.Color(0x0d9488);
    return { buba: buba.variants.top, peplum: peplum.variants.top, pencil: peplum.variants.skirt, plainSame: plain.top.equals(base), printLighter: print.top.r > base.r + 0.05 && print.top.g > base.g + 0.05 };
  });
  check('farwalk: a buba, a peplum and a pencil skirt keep their own shape far off, and a print keeps its colours', clothes.buba === 'buba' && clothes.peplum === 'peplum' && clothes.pencil === 'pencil' && clothes.plainSame && clothes.printLighter, clothes);
}
