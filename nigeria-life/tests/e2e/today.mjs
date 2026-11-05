// Today's hustle: three a day from what the game really counts, paid when done, a bonus and a
// card pack for all three; the streak from day to day; the Sunday chest; the season's tiers;
// the life ladder from Mushin up; the album's cards earned by going places and opened from
// packs; the agamas caught off the walls; and all of it kept across a reload.
import { open, newPlayer, closeDialogs, advance, wait, playUntil, money } from './lib.mjs';

const life = (page, fn, arg) => page.evaluate(fn, arg);

export async function run(browser, check) {
  const ctx = await newPlayer(browser);
  const { page, log } = await open(ctx, { life: true });
  await closeDialogs(page);

  // ------------------------------------------------------------------ The day's three, done the real way
  await life(page, () => {
    const m = window.game.modules;
    m.Hustles.today = () => '2026-10-29';
    const h = m.Hustles.get();
    h.reload();
    h.save.day.picks = ['shift', 'chop', 'hail'];
    h.changed();
  });
  const first = await life(page, () => window.game.modules.Hustles.get().hustles().map((x) => `${x.kind}:${x.id}`));
  const m0 = await money(page);
  await life(page, () => {
    const g = window.game;
    g.hud.backend.performGig(12_000, 5, 'Test shift at the port');
    g.hud.backend.consumeFood('Amala and ewedu', 40, 5, 5, 1500);
  });
  // Greeting is acted out: the director runs it and the hub hears it
  for (let i = 0; i < 3; i++) {
    await page.evaluate(() => { const g = window.game; g.modules.InteractionDirector.get().perform({ id: 'greet', actor: g.player.actor, animation: { arms: 'wave' }, seconds: 0.4 }); });
    await advance(page, 1.2);
  }
  const after = await life(page, () => {
    const h = window.game.modules.Hustles.get();
    return { list: h.hustles().map((x) => ({ id: x.id, done: x.done })), streak: h.streak, packs: window.game.modules.Album.get().packs, xp: h.season().xp, badge: document.getElementById('badge-today-sub')?.textContent };
  });
  const m1 = await money(page);
  check('today: three hustles a day, one for the grind, one for life, one for linking up', first.length === 3 && first[0].startsWith('grind') && first[1].startsWith('life') && first[2].startsWith('link'), first);
  check('today: a paid shift, a meal and three greetings acted out finish all three: each pays, the bonus and a card pack come, the streak starts and the badge shows it',
    after.list.every((x) => x.done) && after.streak === 1 && after.packs === 1 && after.xp >= 3 * 120 + 200 && m1.total - m0.total > 12_000 - 1500 + 20_000 && /🔥 1 · 3\/3 done · 🃏 1/.test(after.badge ?? ''), { after, gained: m1.total - m0.total });

  // ------------------------------------------------------------------ The panel, and a pack opened
  await page.evaluate(() => document.getElementById('badge-today')?.click());
  await wait(400);
  const panel = await page.evaluate(() => ({ open: document.getElementById('today-panel')?.classList.contains('open'), done: document.querySelectorAll('#today-panel .tp-card.done').length, hero: document.querySelector('#today-panel .tp-hero b')?.textContent }));
  const owned0 = await life(page, () => window.game.modules.Album.get().owned);
  await page.evaluate(() => document.getElementById('tp-open-pack')?.click());
  await wait(1800);
  const reveal = await page.evaluate(() => ({ cards: document.querySelectorAll('#tp-reveal .tp-cardface.show').length, open: document.getElementById('tp-reveal')?.classList.contains('open') }));
  const packsLeft = await life(page, () => window.game.modules.Album.get().packs);
  check('today: the Today panel shows the streak and the three hustles done; the card pack opens three cards one by one into the album',
    panel.open && panel.done === 3 && /1-day streak/.test(panel.hero ?? '') && reveal.open && reveal.cards === 3 && packsLeft === 0, { panel, reveal, owned0, packsLeft });
  await page.evaluate(() => { document.getElementById('tp-reveal-done')?.click(); document.querySelector('#today-panel [data-act="close"]')?.click(); });

  // ------------------------------------------------------------------ The streak, day to day
  const streaks = await life(page, () => {
    const m = window.game.modules;
    const h = m.Hustles.get();
    const out = [];
    m.Hustles.today = () => '2026-10-30';
    out.push(h.streak);
    h.save.day.picks = ['chop', 'chop', 'chop'];
    window.game.hud.backend.consumeFood('Suya', 30, 0, 0, 2000);
    out.push(h.streak);
    m.Hustles.today = () => '2026-11-01';
    out.push(h.streak);
    return out;
  });
  check('today: one hustle done the next day keeps the streak going (2); a day missed and it has gone out', streaks[0] === 1 && streaks[1] === 2 && streaks[2] === 0, streaks);

  // ------------------------------------------------------------------ The Sunday chest and the season
  const chest = await life(page, () => {
    const m = window.game.modules;
    const h = m.Hustles.get();
    m.Hustles.today = () => '2026-11-01';
    h.hustles();
    h.save.week.fullDays = ['2026-10-27', '2026-10-28', '2026-10-29'];
    h.save.week.monday = '2026-10-26';
    const before = window.game.hud.backend.getData().walletCash + window.game.hud.backend.getData().bank.balance;
    const c = h.chest();
    const opened = h.openChest();
    const after = window.game.hud.backend.getData().walletCash + window.game.hud.backend.getData().bank.balance;
    const s = h.season();
    const claimed = h.claimTier(1);
    return { ready: c.ready, sunday: c.sunday, opened, paid: after - before, packs: m.Album.get().packs, tier: s.tier, claimed, again: h.claimTier(1) };
  });
  check('today: on Sunday, after three full days, the chest opens with money and two packs; a season tier reached is claimed once',
    chest.sunday && chest.ready && chest.opened && chest.paid >= 80_000 && chest.packs === 2 && chest.tier >= 1 && chest.claimed && !chest.again, chest);

  // ------------------------------------------------------------------ The ladder: up from Mushin
  const ladder = await life(page, () => {
    const m = window.game.modules;
    const L = m.Ladder.get();
    const before = { rung: L.rung, area: L.current.area };
    const be = window.game.hud.backend;
    be.performGig(60_000, 1, 'Test shift');
    for (const [id, name] of [['interior_place_a', 'A'], ['interior_place_b', 'B'], ['interior_place_c', 'C'], ['interior_place_d', 'D'], ['interior_place_e', 'E']]) m.Activity.emit({ kind: 'visited', place: id, name });
    for (let i = 0; i < 3; i++) be.consumeFood('Jollof', 30, 0, 0, 0);
    L.check();
    return { before, rung: L.rung, area: L.current.area, next: L.next?.area, banner: document.getElementById('club-celebrate')?.innerText ?? '' };
  });
  check('ladder: earning from work, going into five places and three meals move the player up from Mushin to Oshodi, with the banner and the reward',
    ladder.before.rung === 0 && ladder.rung === 1 && ladder.area === 'Oshodi' && ladder.next === 'Yaba' && /OSHODI/.test(ladder.banner), ladder);

  // ------------------------------------------------------------------ A card earned by going in; an agama caught
  await page.evaluate(() => {
    const g = window.game;
    const card = g.world.interactiveObjects.find((o) => o.id === 'roadside-balogun-market');
    g.player.stopMoving();
    g.player.mesh.position.set(card.interactionPoint.x, 0, card.interactionPoint.z);
    g.hud.showInteractionCard(card);
    document.getElementById('card-action-btn')?.click();
  });
  await playUntil(page, () => (window.game.world.interiorManager.currentInterior && !window.game.world.interiorManager.isTransitioning ? true : null), 20);
  const balogun = await life(page, () => window.game.modules.Album.get().count('balogun'));
  await page.evaluate(() => { const g = window.game; return g.world.interiorManager.exitCurrentInterior(g.player, g.cameraManager, g.hud, g.world); });
  await wait(1200);
  const a0 = await money(page);
  const agama = await page.evaluate(() => {
    const g = window.game;
    const o = g.world.interactiveObjects.find((x) => x.id.startsWith('agama-'));
    g.player.stopMoving();
    g.player.mesh.position.set(o.interactionPoint.x, 0, o.interactionPoint.z);
    g.hud.showInteractionCard(o);
    const label = document.getElementById('card-action-btn')?.textContent ?? '';
    document.getElementById('card-action-btn')?.click();
    return { id: o.id, label, count: g.world.agamas.all.length };
  });
  const caught = await playUntil(page, (id) => (window.game.modules.Album.get().hasAgama(id) ? true : null), 15, agama.id);
  const a1 = await money(page);
  const hidden = await page.evaluate((id) => !window.game.world.agamas.group.getObjectByName(id).visible, agama.id);
  check('album: going into Balogun Market earns its card; an agama on a wall is walked up to and caught: it is gone from the wall, counted and paid',
    balogun === 1 && agama.count === 40 && /Catch the agama \(0\/40\)/.test(agama.label) && !!caught && hidden && a1.total - a0.total === 2000, { balogun, agama, caught, hidden, paid: a1.total - a0.total });

  // Every agama is in sight from where the player stands to catch it: the first thing a line of
  // sight meets is the lizard, not the wall or a shopfront panel in front of it
  const sight = await page.evaluate(() => {
    const g = window.game;
    const THREE = g.modules.THREE;
    const ray = new THREE.Raycaster();
    ray.layers.enableAll();
    const group = g.world.expressway.group;
    const out = { seen: 0, hidden: [] };
    for (const a of g.world.agamas.all) {
      const o = g.world.interactiveObjects.find((x) => x.id === a.id);
      const eye = new THREE.Vector3(o.interactionPoint.x, 1.6, o.interactionPoint.z);
      const at = a.holder.getWorldPosition(new THREE.Vector3());
      const was = a.holder.visible;
      a.holder.visible = true;
      group.updateMatrixWorld(true);
      ray.set(eye, at.clone().sub(eye).normalize());
      ray.far = eye.distanceTo(at) + 0.5;
      const hit = ray.intersectObject(group, true).find((h) => h.object.visible);
      a.holder.visible = was;
      let mine = false;
      for (let n = hit?.object; n; n = n.parent) if (n === a.holder) mine = true;
      if (mine) out.seen += 1; else out.hidden.push(a.id);
    }
    return out;
  });
  check('album: all forty agamas can be seen from where the player stands to catch them, none buried in a wall', sight.seen === 40, sight);

  // ------------------------------------------------------------------ Kept
  await page.reload({ waitUntil: 'load' });
  await page.waitForFunction('window.game && window.game.world', { timeout: 120000 });
  await wait(2500);
  const kept = await life(page, (id) => {
    const m = window.game.modules;
    m.Hustles.today = () => '2026-11-01';
    const h = m.Hustles.get();
    h.reload();
    return { streak: h.streak, best: h.bestStreak, rung: m.Ladder.get().rung, agama: m.Album.get().hasAgama(id), balogun: m.Album.get().count('balogun'), onWall: window.game.world.agamas.group.getObjectByName(id).visible };
  }, agama.id);
  check('today: the streak (restarted on the 1st after a missed day, best 2), the ladder, the album and the caught agama are all kept across a reload', kept.streak === 1 && kept.best === 2 && kept.rung === 1 && kept.agama && kept.balogun === 1 && !kept.onWall, kept);

  check('today: no errors in the page', log.errors.length === 0, log.errors.slice(0, 5));
  await ctx.close();
}
