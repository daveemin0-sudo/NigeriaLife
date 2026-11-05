// Churches and the mosque, alive: a service goes round all day. Faith Arena praises with the
// drums, the choir and the church on its feet, the pastor preaches with the church answering,
// and at offering time people dance their offering to the baskets. The player joins in their
// pew, dances an offering forward (paid as it goes in) and kneels at the altar for the pastor
// to pray over them. At the Central Mosque the rows bow and prostrate behind the imam, and the
// player prays in the row with them; at Redemption Cathedral the church kneels for prayers.
import { open, newPlayer, closeDialogs, advance, wait, playUntil, money } from './lib.mjs';

const enter = async (page, key) => {
  await page.evaluate((k) => {
    const g = window.game;
    const card = g.world.interactiveObjects.find((o) => o.id === `roadside-${k}`);
    g.player.stopMoving();
    g.player.mesh.position.set(card.interactionPoint.x, 0, card.interactionPoint.z);
    g.hud.showInteractionCard(card);
    document.getElementById('card-action-btn')?.click();
  }, key);
  const name = await playUntil(page, () => (window.game.world.interiorManager.currentInterior && !window.game.world.interiorManager.isTransitioning ? window.game.world.interiorManager.currentInterior.name : null), 20);
  await advance(page, 0.5);
  return name;
};
const leave = async (page) => {
  await page.evaluate(() => { const g = window.game; return g.world.interiorManager.exitCurrentInterior(g.player, g.cameraManager, g.hud, g.world); });
  await wait(1200);
};
const state = (page, key) => page.evaluate((k) => window.game.modules.Worship.get(k).state(), key);
const skip = (page, key, part, offset) => page.evaluate(({ k, p, o }) => window.game.modules.Worship.get(k).skipTo(p, o), { k: key, p: part, o: offset });
/** Plays the game forward, a little at a time, so walks and poses run as they do in play */
const play = async (page, seconds) => {
  for (let t = 0; t < seconds; t += 0.5) {
    await advance(page, 0.5);
    await wait(15);
  }
};
const card = async (page, id, choice) => {
  await closeDialogs(page);
  await page.evaluate((cid) => {
    const g = window.game;
    const o = g.world.interiorManager.getActiveInteractiveObjects().find((x) => x.id === cid);
    g.player.stopMoving();
    g.player.mesh.position.set(o.interactionPoint.x, 0, o.interactionPoint.z);
    g.hud.showInteractionCard(o);
    document.getElementById('card-action-btn')?.click();
  }, id);
  await wait(300);
  if (choice) await page.evaluate((t) => [...document.querySelectorAll('#game-dialogue-overlay button')].find((b) => b.textContent.includes(t))?.click(), choice);
  await wait(100);
};
const player = (page, room) => page.evaluate((r) => {
  const g = window.game;
  const o = g.world.interiorManager.places.find((pl) => pl.def.id === r)?.group.position ?? { x: 0, z: 0 };
  return { pose: { ...g.player.actor.pose }, doing: g.player.actor.sequence?.name ?? null, x: +(g.player.position.x - o.x).toFixed(2), z: +(g.player.position.z - o.z).toFixed(2) };
}, room);
/** What is drawn this frame: triangles and draw calls, after a real frame */
const drawn = async (page) => {
  await wait(400);
  return page.evaluate(() => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(() => { const i = window.game.renderer.info.render; done({ triangles: i.triangles, calls: i.calls }); }))));
};

export async function run(browser, check) {
  const ctx = await newPlayer(browser);
  const { page, log } = await open(ctx);
  await closeDialogs(page);
  await page.evaluate(() => { const be = window.game.hud.backend; be.data.walletCash += 500_000; be.saveData(); window.game.world.skyEnvironment.setHour(10); });

  // ------------------------------------------------------------------ Faith Arena
  const arena = await enter(page, 'faith-arena');
  await skip(page, 'faith-arena', 'praise');
  await play(page, 3);
  const praise = await state(page, 'faith-arena');
  const praiseDrawn = await drawn(page);
  const clapping = (praise.crowd.clapShut ?? 0) + (praise.crowd.clapOpen ?? 0);
  check('worship: Faith Arena is full: sixty in the pews, on their feet for praise and worship, most clapping in time and some with their hands raised; the choir claps and the band plays',
    arena === 'Faith Arena' && praise.phase === 'praise' && praise.seats === 60 && clapping + (praise.crowd.praise ?? 0) === 60 && clapping > 30 && (praise.crowd.praise ?? 0) > 8
      && ((praise.choir.clapShut ?? 0) + (praise.choir.clapOpen ?? 0)) === 8 && ((praise.band.drumA ?? 0) + (praise.band.drumB ?? 0)) === 1,
    { arena, phase: praise.phase, seats: praise.seats, crowd: praise.crowd, choir: praise.choir, band: praise.band });
  check('worship: a full church stays inside the frame budget (under 650k triangles, under 900 draw calls)', praiseDrawn.triangles < 650_000 && praiseDrawn.calls < 900, praiseDrawn);
  check('worship: the screens say what part of the service it is', praise.screens.every((s) => s.length === 1 && s[0] === 'praise'), praise.screens);

  await skip(page, 'faith-arena', 'sermon');
  // The church's answers last a moment each: gather them while the sermon goes on
  const answered = new Set();
  for (let t = 0; t < 8; t += 0.5) {
    await advance(page, 0.5);
    await wait(15);
    for (const w of (await state(page, 'faith-arena')).said) answered.add(w);
  }
  const sermon = await state(page, 'faith-arena');
  sermon.said = [...answered];
  const pastorBubble = await page.evaluate(() => { let t = null; window.game.world.interiorManager.places.find((pl) => pl.def.id === 'interior_place_faith-arena').group.traverse((o) => { if (o.isSprite && o.parent?.name === 'worship Pastor Ade') t = true; }); return t; });
  check('worship: at the sermon the church sits; the pastor walks to the front of the stage and preaches with the microphone, and people in the pews answer him',
    sermon.phase === 'sermon' && sermon.crowd.sit === 60 && Math.abs(sermon.pastor.at[1] + 8.7) < 0.3 && Math.abs(sermon.pastor.at[0]) <= 3.05 && (sermon.pastor.walking || sermon.pastor.pose.arms === 'preach') && sermon.said.length > 0,
    { phase: sermon.phase, crowd: sermon.crowd, pastor: sermon.pastor, said: sermon.said, pastorBubble });

  await skip(page, 'faith-arena', 'offering');
  await play(page, 14);
  const offering = await state(page, 'faith-arena');
  check('worship: at offering time the ushers go to the baskets at the front and people from the pews dance their offering up the aisle and into them',
    offering.phase === 'offering' && offering.notes >= 1 && offering.ushers.every((u) => u.at[1] < -6) && offering.dancers.some((d) => d.walking || d.at[1] < -5),
    { notes: offering.notes, ushers: offering.ushers, dancers: offering.dancers });

  // The player joins the service in their pew
  await skip(page, 'faith-arena', 'sermon');
  await advance(page, 0.2);
  const social0 = await page.evaluate(() => window.game.hud.backend.getData().stats.social);
  await card(page, 'place_faith-arena_service');
  const seated = await playUntil(page, () => (window.game.player.actor.pose.legs === 'sit' ? true : null), 12);
  await advance(page, 1);
  const inPew = await player(page, 'interior_place_faith-arena');
  await skip(page, 'faith-arena', 'praise');
  const dancing = await playUntil(page, () => { const p = window.game.player.actor.pose; return p.legs === 'dance' && p.arms === 'praise' ? true : null; }, 4);
  await advance(page, 1);
  const standing = await player(page, 'interior_place_faith-arena');
  await playUntil(page, () => (window.game.player.actor.sequence ? null : true), 40);
  const social1 = await page.evaluate(() => window.game.hud.backend.getData().stats.social);
  check('worship: the player takes their place in the pew: sat down for the sermon at the aisle end of the fourth row, then on their feet with hands raised when praise starts',
    !!seated && Math.abs(inPew.x + 1.93) < 0.15 && Math.abs(inPew.z - 0.4) < 0.15 && !!dancing && Math.abs(standing.z - (inPew.z - 0.62)) < 0.1, { inPew, standing, seated, dancing });
  check('worship: the service done, the player leaves lighter (social up)', social1 > social0, { social0, social1 });

  // Dancing an offering forward
  const m0 = await money(page);
  const notes0 = (await state(page, 'faith-arena')).notes;
  await card(page, 'place_faith-arena_offering', 'with ₦5,000');
  const atBasket = await playUntil(page, () => { const p = window.game.player.actor.pose; return p.legs === 'dance' ? true : null; }, 15);
  const mid = await money(page);
  await playUntil(page, () => (window.game.player.actor.sequence ? null : true), 20);
  const m1 = await money(page);
  const notes1 = (await state(page, 'faith-arena')).notes;
  const card1 = await page.evaluate(() => window.game.modules.Album.get().count('offeringDance'));
  check('worship: the offering is danced to the basket at the front and the ₦5,000 is paid as it goes in, not before; a note lands in the basket and the Offering Dance card is earned',
    !!atBasket && mid.total === m0.total && m0.total - m1.total === 5000 && notes1 === notes0 + 1 && card1 >= 1, { paid: m0.total - m1.total, beforeDrop: m0.total - mid.total, notes0, notes1, card1 });

  // The altar call
  await card(page, 'place_faith-arena_altar');
  const kneeling = await playUntil(page, () => (window.game.player.actor.pose.legs === 'kneel' ? true : null), 15);
  await play(page, 3);
  const altar = await state(page, 'faith-arena');
  const me = await player(page, 'interior_place_faith-arena');
  await playUntil(page, () => (window.game.player.actor.sequence ? null : true), 15);
  await play(page, 6);
  const after = await state(page, 'faith-arena');
  check('worship: at the altar the player kneels and the pastor comes to the edge of the stage in front of them to pray; afterwards he goes back to the service',
    !!kneeling && Math.abs(me.z + 7) < 0.2 && altar.pastor.busy && Math.abs(altar.pastor.at[0]) < 0.3 && Math.abs(altar.pastor.at[1] + 8.45) < 0.3 && !after.pastor.busy,
    { me, pastor: altar.pastor, after: after.pastor });
  await leave(page);

  // ------------------------------------------------------------------ The Central Mosque
  const mosque = await enter(page, 'central-mosque');
  await skip(page, 'central-mosque', 'salah', 9);
  await play(page, 1.5);
  const ruku = await state(page, 'central-mosque');
  const mosqueDrawn = await drawn(page);
  await skip(page, 'central-mosque', 'salah', 15);
  await play(page, 1.5);
  const sujud = await state(page, 'central-mosque');
  check('worship: at the Central Mosque thirty-eight men stand in four rows behind the imam and bow with him (ruku), then go down into prostration (sujud) with him',
    mosque === 'Lagos Central Mosque' && ruku.seats === 38 && ruku.movement === 'ruku' && (ruku.crowd.ruku ?? 0) === 38 && ruku.imam.pose.legs === 'bow'
      && sujud.movement === 'sujud' && (sujud.crowd.sujud ?? 0) === 38 && sujud.imam.pose.legs === 'prostrate'
      // Seen, not only set: his head comes down to the level of his back, then to the floor
      && ruku.imam.head < 1.15 && ruku.imam.head > 0.7 && sujud.imam.head < 0.45,
    { ruku: { movement: ruku.movement, crowd: ruku.crowd, imam: ruku.imam }, sujud: { movement: sujud.movement, crowd: sujud.crowd, imam: sujud.imam } });
  check('worship: a full mosque stays inside the frame budget', mosqueDrawn.triangles < 650_000 && mosqueDrawn.calls < 900, mosqueDrawn);

  // The player prays in the row
  await skip(page, 'central-mosque', 'rise');
  await advance(page, 0.2);
  await card(page, 'place_central-mosque_pray');
  const inRow = await playUntil(page, () => (window.game.player.actor.sequence?.name === 'pray in the row' && window.game.player.actor.pose.legs === 'stand' ? true : null), 10);
  const seen = new Set();
  const spots = [];
  for (let t = 0; t < 70; t += 0.5) {
    await advance(page, 0.5);
    const p = await player(page, 'interior_place_central-mosque');
    seen.add(p.pose.legs);
    if (spots.length < 3 && p.pose.legs === 'prostrate') spots.push(p);
    if (!p.doing) break;
  }
  const prayer = await player(page, 'interior_place_central-mosque');
  const saff = await page.evaluate(() => window.game.modules.Album.get().count('saff'));
  check('worship: the player stands in the back row and prays with the congregation, bowing, prostrating and sitting as they do, until the salam and the du\'a; the In the Saff card is earned',
    !!inRow && seen.has('bow') && seen.has('prostrate') && seen.has('kneel') && !prayer.doing && saff >= 1 && spots.every((p) => Math.abs(p.x - 2.25) < 0.1 && Math.abs(p.z + 1.6) < 0.1),
    { seen: [...seen], spots, prayer, saff });

  await skip(page, 'central-mosque', 'lesson', 1);
  await play(page, 2);
  const lesson = await state(page, 'central-mosque');
  check('worship: after the prayer the imam turns round to the congregation and gives the lesson while they sit', lesson.part === 'lesson' && Math.abs(lesson.imam.yaw) < 0.05 && lesson.imam.pose.legs === 'kneel' && (lesson.crowd.sit ?? 0) === 38, lesson);

  const s0 = await money(page);
  await card(page, 'place_central-mosque_sadaqah', 'Give ₦1,000');
  await playUntil(page, () => (window.game.player.actor.sequence ? null : true), 10);
  const s1 = await money(page);
  check('worship: ₦1,000 of sadaqah goes into the charity box', s0.total - s1.total === 1000, { paid: s0.total - s1.total });
  await leave(page);

  // ------------------------------------------------------------------ Redemption Cathedral
  const cathedral = await enter(page, 'redemption-cathedral');
  await skip(page, 'redemption-cathedral', 'prayer');
  await play(page, 3);
  const prayers = await state(page, 'redemption-cathedral');
  await skip(page, 'redemption-cathedral', 'offering');
  await play(page, 6);
  const bags = await state(page, 'redemption-cathedral');
  const c0 = await money(page);
  await card(page, 'place_redemption-cathedral_candle');
  await playUntil(page, () => (window.game.player.actor.sequence ? null : true), 10);
  const c1 = await money(page);
  const lit = await state(page, 'redemption-cathedral');
  check('worship: at Redemption Cathedral the church kneels for prayers, the choir with them; at the offering the ushers bring the bags down the aisle; a candle is lit for ₦500',
    cathedral === 'Redemption Cathedral' && prayers.phase === 'prayer' && prayers.crowd.kneel === prayers.seats && prayers.choir.kneel === 6 && bags.ushers.some((u) => u.walking) && c0.total - c1.total === 500 && lit.candles === 1,
    { prayers: { phase: prayers.phase, crowd: prayers.crowd, choir: prayers.choir }, ushers: bags.ushers, candle: c0.total - c1.total, lit: lit.candles });
  await leave(page);

  check('worship: no errors in the page', log.errors.length === 0, log.errors.slice(0, 5));
  await ctx.close();
}
