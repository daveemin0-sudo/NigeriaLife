// Homes built to what they are: a self-contain is one room with its toilet and shower in a corner
// and its kitchen counter in another; a room and parlour is a parlour with the bedroom and the
// kitchen off it; two to six bedrooms have that many bedrooms, each with its own toilet and
// shower, every one reached from the parlour by the corridor and none through another room. A
// carport stands only by a house. Moving into a smaller home, what has no room goes into storage.
import { open, newPlayer, closeDialogs, advance, wait, playUntil, enterInterior } from './lib.mjs';

/** Comes into the home as a home of this kind, and reads its plan back */
async function visit(page, brief) {
  await page.evaluate((b) => {
    const g = window.game;
    g.world.interiorManager.residence.constructor.briefNow = () => b;
    if (g.world.interiorManager.currentInterior) return g.world.interiorManager.exitCurrentInterior(g.player, g.cameraManager, g.hud, g.world);
  }, brief);
  await playUntil(page, () => (!window.game.world.interiorManager.busy ? true : null), 20);
  await enterInterior(page, 'residence');
  await advance(page, 0.6);
  return page.evaluate(() => {
    const g = window.game;
    const r = g.world.interiorManager.residence;
    const plan = r.plan;
    const o = r.group.position;
    const nav = r.life.nav;
    const P = (x, z) => new o.constructor(o.x + x, 0, o.z + z);
    // Every room but the corridor, from the way in: a path to a clear spot inside it, and the rooms it passes through
    const start = P(plan.spawn.x, plan.spawn.z);
    const rooms = plan.rooms.filter((room) => room.kind !== 'corridor');
    const reach = rooms.map((room) => {
      // A free spot in the room, away from its own fittings
      let target = null;
      for (let fx = 0.25; fx <= 0.75 && !target; fx += 0.25) {
        for (let fz = 0.25; fz <= 0.75 && !target; fz += 0.25) {
          const x = room.minX + (room.maxX - room.minX) * fx;
          const z = room.minZ + (room.maxZ - room.minZ) * fz;
          if (nav.isFree(o.x + x, o.z + z)) {
            const inside = plan.rooms.filter((r2) => x > r2.minX + 0.2 && x < r2.maxX - 0.2 && z > r2.minZ + 0.2 && z < r2.maxZ - 0.2).sort((a, b) => (a.maxX - a.minX) * (a.maxZ - a.minZ) - (b.maxX - b.minX) * (b.maxZ - b.minZ))[0];
            if (inside === room) target = P(x, z);
          }
        }
      }
      if (!target) return { room: room.id, kind: room.kind, path: false, through: [] };
      const path = nav.findPath(start, target);
      const through = new Set();
      for (const point of path ?? []) {
        const x = point.x - o.x;
        const z = point.z - o.z;
        const at = plan.rooms.filter((r2) => x > r2.minX + 0.3 && x < r2.maxX - 0.3 && z > r2.minZ + 0.3 && z < r2.maxZ - 0.3).sort((a, b) => (a.maxX - a.minX) * (a.maxZ - a.minZ) - (b.maxX - b.minX) * (b.maxZ - b.minZ))[0];
        if (at) through.add(at.id);
      }
      return { room: room.id, kind: room.kind, path: !!path, through: [...through] };
    });
    // Reaching a room may pass through the parlour, the corridor, and, for a bathroom, its own bedroom: nothing else
    const own = (id) => (id.startsWith('ensuite') ? `bedroom${id.slice(7)}` : null);
    const astray = reach.filter((r1) => r1.through.some((id) => id !== r1.room && id !== 'parlour' && id !== 'corridor' && id !== 'studio' && id !== own(r1.room)));
    return {
      key: plan.key,
      bedrooms: plan.rooms.filter((x) => x.kind === 'bedroom').length,
      ensuites: plan.rooms.filter((x) => x.kind === 'ensuite').length,
      kitchens: plan.rooms.filter((x) => x.kind === 'kitchen').length,
      studio: plan.rooms.some((x) => x.kind === 'studio'),
      parlour: plan.rooms.some((x) => x.kind === 'parlour'),
      toilets: plan.fixtures.filter((f) => f.kind === 'wc').length,
      showers: plan.fixtures.filter((f) => f.kind === 'shower').length,
      counter: plan.fixtures.some((f) => f.kind === 'counter'),
      carport: r.group.getObjectByName('carport').visible,
      cards: g.world.interiorManager.getActiveInteractiveObjects().filter((x) => /^home_toilet_|^home_shower_/.test(x.id)).length,
      size: [plan.width, plan.length],
      unreachable: reach.filter((x) => !x.path).map((x) => x.room),
      astray,
    };
  });
}

export async function run(browser, check) {
  const ctx = await newPlayer(browser);
  const { page, log } = await open(ctx);
  await closeDialogs(page);

  const self = await visit(page, { kind: 'self-contain', bedrooms: 1, carport: false });
  check('homeplans: a self-contain is one room: its toilet and shower in a corner behind a door, a kitchen counter in another corner, no parlour, no carport',
    self.studio && !self.parlour && self.bedrooms === 0 && self.ensuites === 1 && self.toilets === 1 && self.showers === 1 && self.counter && !self.carport && self.size[0] < 10 && self.unreachable.length === 0, self);

  const rp = await visit(page, { kind: 'room-parlour', bedrooms: 1, carport: false });
  check('homeplans: a room and parlour has a parlour with the bedroom (its own toilet and shower) and the kitchen off it',
    rp.parlour && rp.bedrooms === 1 && rp.ensuites === 1 && rp.kitchens === 1 && !rp.carport && rp.unreachable.length === 0 && rp.astray.length === 0, rp);

  const sizes = [];
  for (const n of [2, 3, 4, 5, 6]) {
    const flat = await visit(page, { kind: n >= 4 ? 'house' : 'flat', bedrooms: n, carport: n >= 4 });
    sizes.push({ n, ...flat });
  }
  check('homeplans: two to six bedrooms have that many bedrooms, each with its own toilet and shower, a kitchen and a guest toilet',
    sizes.every((h) => h.bedrooms === h.n && h.ensuites === h.n && h.kitchens === 1 && h.toilets === h.n + 1 && h.showers === h.n), sizes.map(({ n, bedrooms, ensuites, toilets, showers }) => ({ n, bedrooms, ensuites, toilets, showers })));
  check('homeplans: every room is reached from the front door by the parlour and the corridor, never through another room',
    sizes.every((h) => h.unreachable.length === 0 && h.astray.length === 0), sizes.map(({ n, unreachable, astray }) => ({ n, unreachable, astray })));
  check('homeplans: a carport only beside a house, not a flat', sizes.every((h) => h.carport === (h.n >= 4)) && !self.carport, sizes.map(({ n, carport }) => ({ n, carport })));
  check('homeplans: every toilet can be used and every shower stood under: a card for each', sizes.every((h) => h.cards === h.toilets + h.showers) && self.cards === 2, sizes.map(({ n, cards }) => ({ n, cards })));

  // The toilet in the self-contain is used: walked to, sat on, flushed
  await visit(page, { kind: 'self-contain', bedrooms: 1, carport: false });
  await page.evaluate(() => { window.game.hud.backend.getData().stats.bladder = 20; });
  await page.evaluate(() => { const g = window.game; const o = g.world.interiorManager.getActiveInteractiveObjects().find((x) => x.id === 'home_toilet_1'); g.hud.showInteractionCard(o); document.getElementById('card-action-btn')?.click(); });
  let sat = false;
  const flushed = await playUntil(page, () => {
    if (window.game.player.actor.pose.legs === 'sit') window.__satOnToilet = true;
    return window.game.hud.backend.getData().stats.bladder >= 99 && !window.game.player.actor.sequence ? true : null;
  }, 30);
  sat = await page.evaluate(() => !!window.__satOnToilet);
  check('homeplans: in the self-contain the player walks into the bathroom, sits on the toilet, flushes and the bladder is full again', !!flushed && sat, { flushed, sat });

  // Moving from a big house into a self-contain: the everyday pieces come along, what has no room is stored and the player is told
  await visit(page, { kind: 'house', bedrooms: 5, carport: true });
  const big = await page.evaluate(() => {
    const d = window.game.modules.HouseDecorationSystem.getInstance();
    // A sofa and a table that only a big parlour has room for, put in it
    const free = [[-3, 3], [0, 3], [-1, 1.2], [2, 2.5]];
    for (const [x, z] of free) d.adopt([{ id: 'emerald_sofa', x, z, turns: 0 }]);
    return { pieces: d.placed.length, stored: d.stored.length };
  });
  await page.evaluate(() => { document.querySelectorAll('.game-toast').forEach((t) => t.remove()); });
  const small = await visit(page, { kind: 'self-contain', bedrooms: 1, carport: false });
  const moved = await page.evaluate(() => {
    const d = window.game.modules.HouseDecorationSystem.getInstance();
    const r = window.game.world.interiorManager.residence;
    const hw = r.plan.width / 2;
    const hl = r.plan.length / 2;
    const inside = d.placed.every((i) => Math.abs(i.x) < hw && Math.abs(i.z) < hl);
    const core = ['home_bed', 'home_sofa', 'home_tv', 'home_fridge', 'home_drum'].filter((uid) => d.placed.some((i) => i.uid === uid)).length;
    return { pieces: d.placed.length, stored: d.stored.length, inside, core, told: [...document.querySelectorAll('.game-toast')].map((t) => t.textContent).join(' | ') };
  });
  check('homeplans: moving into a self-contain, the bed, sofa, television, fridge and drum come along and fit; what has no room goes into storage, and the player is told',
    moved.core === 5 && moved.inside && moved.stored > big.stored && moved.pieces + (moved.stored - big.stored) === big.pieces && /storage/i.test(moved.told), { big, moved, small: small.key });

  check('homeplans: no errors in the page', log.errors.length === 0, log.errors.slice(0, 5));
  await ctx.close();
}
