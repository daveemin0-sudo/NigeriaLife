// The Red Line: trains on the viaduct over Ikorodu Road keep to their timetable, north on one
// track and south on the other. From Yaba the player taps their card at the gate (the fare
// taken then), climbs to the concourse and on up to the platform for the north, waits for the
// train, rides in the second car to Mushin, and comes down to the road there.
import { open, newPlayer, closeDialogs, advance, wait, playUntil, money } from './lib.mjs';

const line = (page) => page.evaluate(() => window.game.world.expressway.redLine.state());
const play = async (page, seconds) => { for (let t = 0; t < seconds; t += 0.5) { await advance(page, 0.5); await wait(15); } };
const me = (page) => page.evaluate(() => { const g = window.game; return { x: +g.player.position.x.toFixed(2), y: +g.player.position.y.toFixed(2), z: +g.player.position.z.toFixed(2), doing: g.player.actor.sequence?.name ?? null, legs: g.player.actor.pose.legs }; });

export async function run(browser, check) {
  const ctx = await newPlayer(browser);
  const { page, log } = await open(ctx);
  await closeDialogs(page);
  await page.evaluate(() => { const g = window.game; g.hud.backend.data.walletCash += 50_000; g.hud.backend.saveData(); g.world.skyEnvironment.setHour(10); g.player.stopMoving(); g.player.mesh.position.set(14, 0, 3380); });
  await play(page, 1);
  const s0 = await line(page);
  await play(page, 12);
  const s1 = await line(page);
  const moved = s0.positions.filter((p, i) => Math.hypot(p[0] - s1.positions[i][0], p[1] - s1.positions[i][1]) > 3).length;
  const viaduct = await page.evaluate(() => { let seen = 0; window.game.world.expressway.redLine.group.traverse((o) => { if (o.name.startsWith('Red Line ') && o.visible && o.isGroup && /^Red Line \d+$/.test(o.name)) seen += 1; }); return seen; });
  check('red line: six trains of four cars run on the viaduct over Ikorodu Road between six stations, and they move on their timetable',
    s1.built && s1.trains === 6 && s1.stations.join(',') === 'Oyingbo,Yaba,Mushin,Oshodi,Ikeja,Agege' && moved >= 3 && viaduct >= 2 && s1.loop > 300 && s1.loop < 1200,
    { trains: s1.trains, stations: s1.stations, moved, viaduct, loop: s1.loop });

  const next = await page.evaluate(() => window.game.world.expressway.redLine.nextAt(1, 1));
  check('red line: a train north stops at Yaba within a few minutes', next < 160, { next });

  // From Yaba's gate on the east pavement, to Mushin
  await page.evaluate(() => {
    const g = window.game;
    const o = g.world.interactiveObjects.find((x) => x.id === 'redline-yaba-e');
    g.player.stopMoving();
    g.player.mesh.position.set(o.interactionPoint.x, 0, o.interactionPoint.z);
    g.hud.showInteractionCard(o);
  });
  const label = await page.evaluate(() => document.getElementById('card-action-btn')?.textContent ?? '');
  const m0 = await money(page);
  await page.evaluate(() => document.getElementById('card-action-btn')?.click());
  await wait(300);
  const offered = await page.evaluate(() => [...document.querySelectorAll('#game-dialogue-overlay button')].map((b) => b.textContent.trim()));
  await page.evaluate(() => [...document.querySelectorAll('#game-dialogue-overlay button')].find((b) => /To Mushin/.test(b.textContent))?.click());
  const upstairs = await playUntil(page, () => (window.game.player.actor.sequence?.name === 'ride the Red Line' && window.game.player.position.y > 9 ? true : null), 40);
  const m1 = await money(page);
  const platform = await me(page);
  // Once the player is waiting on the platform, the next train is brought on, as if the wait had passed
  await playUntil(page, () => { const q = window.game.player.actor.sequence; return q && q.steps?.[q.index]?.name === 'waiting for the train' ? true : null; }, 40);
  await page.evaluate(() => { const r = window.game.world.expressway.redLine; r.skip(Math.max(0, r.nextAt(1, 1) - 2)); });
  const aboard = await playUntil(page, () => (window.game.world.expressway.redLine.state().riding ? true : null), 30);
  const onTrain = await me(page);
  const roofOff = await page.evaluate(() => { let off = false; window.game.world.expressway.redLine.group.traverse((o) => { if (/^car \d roof$/.test(o.name) && !o.visible) off = true; }); return off; });
  // It stands out its time at the platform, then goes
  await play(page, 18);
  const moving = await me(page);
  const home = await playUntil(page, () => (window.game.player.actor.sequence ? null : true), 220);
  const end = await me(page);
  const after = await line(page);
  const card = await page.evaluate(() => window.game.modules.Album.get().count('redLine'));
  check('red line: at the gate the Red Line offers every other station with its fare; Mushin, one stop, is ₦750, taken as the card is tapped',
    /Red Line · Yaba/.test(label) && offered.filter((t) => /To [A-Z]/.test(t)).length === 5 && m0.total - m1.total === 750, { label, offered, fare: m0.total - m1.total });
  check('red line: the player climbs from the pavement to the platform for the north and waits there',
    !!upstairs && platform.y > 9 && platform.x > 3.5 && platform.x < 7, platform);
  check('red line: the train comes in and the player boards the car that stops by the stairs, whose roof comes off so they can be seen; the train carries them north',
    !!aboard && onTrain.y > 9 && roofOff && moving.z > onTrain.z + 5, { onTrain, moving, roofOff });
  check('red line: at Mushin they step off, go down to the road and come out of the gate on the pavement; the ride is counted and the Red Line card earned',
    !!home && Math.abs(end.y) < 0.05 && Math.abs(end.z - 4125) < 4 && end.x > 12 && after.rides === 1 && !after.riding && card >= 1, { end, rides: after.rides, card });

  check('red line: no errors in the page', log.errors.length === 0, log.errors.slice(0, 5));
  await ctx.close();
}
