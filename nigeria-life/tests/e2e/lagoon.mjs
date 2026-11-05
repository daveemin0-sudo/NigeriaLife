// The lagoon under the bridge: canoes, ferries, speedboats and a sand barge going about, and
// Makoko on its stilts by the mainland end. From the jetty a canoe takes the player through
// Makoko (the fare paid into the boatman's hand), stops at the floating market where fish is
// bought canoe to canoe, and brings them back to the jetty.
import { open, newPlayer, closeDialogs, advance, wait, playUntil, money } from './lib.mjs';

const lagoon = (page) => page.evaluate(() => window.game.world.lagoon.state());
const play = async (page, seconds) => { for (let t = 0; t < seconds; t += 0.5) { await advance(page, 0.5); await wait(15); } };

export async function run(browser, check) {
  const ctx = await newPlayer(browser);
  const { page, log } = await open(ctx);
  await closeDialogs(page);
  await page.evaluate(() => { const g = window.game; g.hud.backend.data.walletCash += 100_000; g.hud.backend.saveData(); g.world.skyEnvironment.setHour(10); });

  // From the bridge
  await page.evaluate(() => { const g = window.game; g.player.stopMoving(); g.player.mesh.position.set(13, 0, 2420); });
  await play(page, 1);
  const first = await lagoon(page);
  await play(page, 3);
  const later = await lagoon(page);
  const makoko = await page.evaluate(() => {
    let tris = 0;
    let houses = null;
    window.game.world.lagoon.group.traverse((o) => { if (o.name === 'Makoko') o.traverse((m) => { if (m.isMesh) { houses = true; tris += m.geometry.attributes.position.count / 3; } }); });
    return { houses, tris: Math.round(tris) };
  });
  const moved = first.moving.some((p, i) => Math.hypot(p[0] - later.moving[i][0], p[1] - later.moving[i][1]) > 2);
  check('lagoon: seen from the bridge, the lagoon has canoes, ferries, speedboats and a sand barge going about, and Makoko stands on its stilts beside the bridge',
    later.visible && later.boats >= 14 && ['canoe', 'ferry', 'speedboat', 'barge'].every((k) => later.kinds.includes(k)) && moved && makoko.houses && makoko.tris < 120_000,
    { later, makoko, moved });

  // Away up the expressway it is not drawn
  await page.evaluate(() => { const g = window.game; g.player.mesh.position.set(13, 0, 5200); });
  await play(page, 0.5);
  const far = await lagoon(page);
  check('lagoon: away up at Ikeja the lagoon’s boats are not drawn', !far.visible, far);

  // The canoe from the jetty
  await page.evaluate(() => {
    const g = window.game;
    const o = g.world.interactiveObjects.find((x) => x.id === 'makoko-canoe');
    g.player.stopMoving();
    g.player.mesh.position.set(o.interactionPoint.x, 0, o.interactionPoint.z);
    g.hud.showInteractionCard(o);
  });
  const label = await page.evaluate(() => document.getElementById('card-action-btn')?.textContent ?? '');
  const m0 = await money(page);
  await page.evaluate(() => document.getElementById('card-action-btn')?.click());
  const aboard = await playUntil(page, () => { const a = window.game.player.actor; return a.pose.legs === 'sit' && window.game.player.position.y < -2.5 ? true : null; }, 20);
  const m1 = await money(page);
  const start = await page.evaluate(() => ({ x: window.game.player.position.x, z: window.game.player.position.z }));
  await play(page, 4);
  const onWater = await page.evaluate(() => ({ x: window.game.player.position.x, z: window.game.player.position.z, y: window.game.player.position.y }));
  const canoe = await lagoon(page);
  // On to the floating market, where the fish seller is asked
  const asked = await playUntil(page, () => [...document.querySelectorAll('#game-dialogue-overlay button')].some((b) => /smoked fish/i.test(b.textContent)) || null, 60);
  await page.evaluate(() => [...document.querySelectorAll('#game-dialogue-overlay button')].find((b) => /smoked fish/i.test(b.textContent))?.click());
  await advance(page, 0.3);
  const m2 = await money(page);
  const fish = await page.evaluate(() => window.game.hud.backend.getData().inventory.some((i) => i.id === 'makoko_fish'));
  const home = await playUntil(page, () => (window.game.player.actor.sequence ? null : true), 80);
  const end = await page.evaluate(() => ({ x: window.game.player.position.x, z: window.game.player.position.z, y: window.game.player.position.y, legs: window.game.player.actor.pose.legs }));
  const after = await lagoon(page);
  const card = await page.evaluate(() => window.game.modules.Album.get().count('makoko'));
  check('lagoon: at the jetty the canoe to Makoko is offered; the ₦3,000 fare goes into the boatman’s hand and the player sits in the canoe at the water',
    /Canoe through Makoko/.test(label) && !!aboard && m0.total - m1.total === 3000, { label, fare: m0.total - m1.total });
  check('lagoon: the canoe is paddled out through Makoko with the player in it',
    Math.hypot(onWater.x - start.x, onWater.z - start.z) > 8 && onWater.y < -2.5 && canoe.riding, { start, onWater, canoe: canoe.canoe });
  check('lagoon: at the floating market smoked fish is bought canoe to canoe (₦4,000, into the bag), and the canoe brings the player back to the jetty, on their feet',
    !!asked && m1.total - m2.total === 4000 && fish && !!home && Math.abs(end.y) < 0.05 && end.legs === 'stand' && Math.hypot(end.x + 40, end.z - 2606) < 2 && !after.riding && after.rides === 1 && card >= 1,
    { fishPaid: m1.total - m2.total, fish, end, after, card });

  check('lagoon: no errors in the page', log.errors.length === 0, log.errors.slice(0, 5));
  await ctx.close();
}
