// Furnishing a home: furniture is chosen from the catalogue, put down where the player wants
// it and paid for then, can be moved, turned and sold, and does what it is for. A sofa is
// sat on, a television shows something (the match really being played at the stadium), the
// walls can be painted, and all of it is still there after the game is closed and reopened.
import { open, reload, newPlayer, closeDialogs, advance, playUntil, money, wait, enterInterior, pressSteady } from './lib.mjs';

const decor = (page) => page.evaluate(() => {
  const d = window.game.modules.HouseDecorationSystem.getInstance();
  return {
    placed: d.placed.map((item) => ({ uid: item.uid, id: item.id, x: item.x, z: item.z, turns: item.turns, shown: item.mesh.visible, parts: item.mesh.children.length })),
    placing: d.placing ? { id: d.placing.item.id, x: d.placing.x, z: d.placing.z, turns: d.placing.turns, moving: !!d.placing.moving, blocked: d.blocked() } : null,
    wall: d.wallColour,
  };
});
const bar = (page) => page.evaluate(() => {
  const el = document.getElementById('furnish-bar');
  return el && !el.hidden ? { say: document.getElementById('furnish-bar-say')?.textContent, canPlace: !document.getElementById('furnish-bar-confirm')?.disabled, button: document.getElementById('furnish-bar-confirm')?.textContent } : null;
});
const choices = (page) => page.evaluate(() => [...document.querySelectorAll('#game-dialogue-overlay button')].map((b) => b.textContent.replace(/\s+/g, ' ').trim()).filter((t) => t && !/^(ok|close|continue)$/i.test(t)));
const choose = (page, text) => page.evaluate((t) => [...document.querySelectorAll('#game-dialogue-overlay button')].find((b) => b.textContent.includes(t))?.click(), text);
const idle = (page, seconds = 30) => playUntil(page, () => (window.game.player.actor.sequence ? null : true), seconds);

/** Chooses a piece in the catalogue, which starts putting it down. */
async function pick(page, itemId) {
  await page.evaluate(() => window.game.modules.HouseDecorationSystem.getInstance().openCatalogueModal());
  await wait(300);
  await page.evaluate(() => document.querySelector('#house-catalogue-modal [data-tab="all"]')?.click());
  await page.evaluate((id) => document.querySelector(`#house-catalogue-modal [data-item-id="${id}"]`)?.click(), itemId);
  await wait(300);
}
/** Walks up to a piece of the player's furniture and opens what can be done with it. */
async function useFurniture(page, uid) {
  await page.evaluate(async (id) => {
    const g = window.game;
    const o = g.world.interiorManager.getActiveInteractiveObjects().find((x) => x.id === `home_item_${id}`);
    document.getElementById('game-dialogue-overlay')?.remove();
    g.player.actor.hold?.release(true);
    g.player.stopMoving();
    g.player.mesh.position.set(o.interactionPoint.x, 0, o.interactionPoint.z);
    await g.advance(0.1);
    g.hud.showInteractionCard(o);
  }, uid);
  await wait(200);
  const label = await page.evaluate(() => document.getElementById('card-action-btn')?.textContent ?? null);
  await page.evaluate(() => document.getElementById('card-action-btn')?.click());
  await wait(350);
  return label;
}

export async function run(browser, check) {
  const ctx = await newPlayer(browser);
  const { page, log } = await open(ctx);
  await closeDialogs(page);
  await page.evaluate(() => { const be = window.game.hud.backend; be.rentProperty(be.getData().properties[0].id); be.performGig(1200000, 0, 'test: furnishing money'); window.game.world.skyEnvironment.setHour(15); });
  await enterInterior(page, 'residence');
  await wait(600);
  const start = await money(page);

  // ------------------------------------------------------------------ What is sold is furniture
  const models = await page.evaluate(() => {
    const d = window.game.modules.HouseDecorationSystem.getInstance();
    const out = {};
    for (const item of window.game.modules.CATALOGUE_ITEMS) {
      const mesh = d.createFurniture3DMesh(item.modelType);
      let triangles = 0;
      mesh.traverse((node) => { if (node.isMesh) triangles += (node.geometry.index ? node.geometry.index.count : node.geometry.attributes.position.count) / 3; });
      const size = d.footprint(item.modelType, 0);
      out[item.id] = { triangles: Math.round(triangles), width: +size.width.toFixed(2), depth: +size.depth.toFixed(2), screen: !!mesh.getObjectByName('tv_screen') };
    }
    return out;
  });
  check('the sofa, the bed and the television in the catalogue are made as a sofa, a bed and a television (each was a plain green box), and the television has a screen',
    models.emerald_sofa?.triangles > 150 && models.smart_tv_75?.triangles > 100 && models.smart_tv_75.screen && Object.values(models).filter((m) => m.triangles <= 12).length === 0 && Object.keys(models).length >= 15,
    { sofa: models.emerald_sofa, tv: models.smart_tv_75, boxes: Object.entries(models).filter(([, m]) => m.triangles <= 12).map(([id]) => id) });

  // ------------------------------------------------------------------ Put down where the player chooses, and paid for then
  await pick(page, 'emerald_sofa');
  let state = await decor(page);
  let shown = await bar(page);
  check('choosing the sofa takes no money: it appears in the room to be put down, with a bar that says what it will cost',
    !!state.placing && state.placing.id === 'emerald_sofa' && state.placed.length === 0 && !!shown && /Place/.test(shown.button || '') && (await money(page)).total === start.total, { state, shown });

  // Not through a wall, and not on top of what is already there
  await page.evaluate(() => window.game.modules.HouseDecorationSystem.getInstance().moveTo(15.6, 0));
  const inWall = await bar(page);
  await page.evaluate(() => window.game.modules.HouseDecorationSystem.getInstance().moveTo(-6, 5));
  const onTable = await bar(page);
  await page.evaluate(() => window.game.modules.HouseDecorationSystem.getInstance().moveTo(0, 9.4));
  const inDoorway = await bar(page);
  check('it cannot be put through a wall, on top of the furniture already there, or across the way in',
    !inWall.canPlace && /wall/.test(inWall.say) && !onTable.canPlace && /already standing/.test(onTable.say) && !inDoorway.canPlace && /way in/.test(inDoorway.say) && (await decor(page)).placed.length === 0, { inWall, onTable, inDoorway });

  // A tap on the floor moves it there; the arrows nudge it; Turn turns it
  await page.evaluate(() => {
    const g = window.game;
    const home = g.world.interiorManager.residence.group.position;
    g.input.onFloorClick(new g.player.position.constructor(home.x + 3.1, 0, home.z + 4.9));
  });
  const tapped = (await decor(page)).placing;
  await pressSteady(page, '#furnish-bar [data-move="1,0"]');
  await pressSteady(page, '#furnish-bar-turn');
  await wait(150);
  const nudged = (await decor(page)).placing;
  check('a tap on the floor moves it there (to the nearest quarter metre), the arrows nudge it and Turn turns it',
    tapped.x === 3 && tapped.z === 5 && nudged.x === 3.25 && nudged.turns === 1 && !nudged.blocked, { tapped, nudged });

  await pressSteady(page, '#furnish-bar-turn');
  await pressSteady(page, '#furnish-bar-turn');
  await pressSteady(page, '#furnish-bar-turn');
  await pressSteady(page, '#furnish-bar-confirm');
  await wait(300);
  state = await decor(page);
  let paid = start.total - (await money(page)).total;
  const sofa = state.placed[0];
  check('placing it puts it there and takes its price once (₦320,000)', state.placed.length === 1 && !state.placing && sofa.x === 3.25 && sofa.z === 5 && sofa.turns === 0 && paid === 320000 && (await bar(page)) === null, { state, paid });

  // The television, facing the sofa from across the room
  await pick(page, 'tv_55');
  await page.evaluate(() => { const d = window.game.modules.HouseDecorationSystem.getInstance(); d.moveTo(3.25, 9); d.turn(); d.turn(); });
  await pressSteady(page, '#furnish-bar-confirm');
  await wait(300);
  state = await decor(page);
  const tv = state.placed.find((item) => item.id === 'tv_55');
  paid = start.total - (await money(page)).total;
  check('a television (55 inches, ₦520,000) is bought and stood facing the sofa', !!tv && tv.turns === 2 && paid === 320000 + 520000, { tv, paid });

  // Giving up part-way costs nothing
  await pick(page, 'king_bed');
  await page.keyboard.press('Escape');
  await wait(200);
  check('giving up part-way through putting a piece down buys nothing', (await decor(page)).placed.length === 2 && !(await decor(page)).placing && start.total - (await money(page)).total === paid, await decor(page));

  // ------------------------------------------------------------------ The furniture does what it is for
  const tvLabel = await useFurniture(page, tv.uid);
  const tvChoices = await choices(page);
  await choose(page, 'Football');
  await advance(page, 1.2);
  await wait(400);
  const picture = async () => page.evaluate((uid) => {
    const home = window.game.world.interiorManager.residence;
    const set = home.sets.get(uid);
    const canvas = set.canvas;
    const data = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
    let green = 0;
    let sum = 0;
    for (let i = 0; i < data.length; i += 40) {
      if (data[i + 1] > data[i] + 30 && data[i + 1] > data[i + 2] + 30) green += 1;
      sum = (sum + data[i] * 3 + data[i + 1] * 5 + data[i + 2] * 7 + i) % 1000003;
    }
    return { on: set.on, channel: set.channel, showing: set.showing(), frames: set.frames, green: green / (data.length / 40), sum, score: window.game.world.landmarks.stadium.match.scoreLine() };
  }, tv.uid);
  const first = await picture();
  await advance(page, 3);
  await wait(300);
  const second = await picture();
  check('the television offers its channels; turned to football it shows a pitch, and the picture keeps changing: it is the match being played at the stadium',
    /Turn it on/.test(tvLabel || '') && ['Football', 'News', 'Afrobeats'].every((name) => tvChoices.some((c) => c.includes(name))) && first.on && first.channel === 'football' && first.green > 0.4 && second.frames > first.frames && second.sum !== first.sum && /Eko United/.test(first.score),
    { tvLabel, tvChoices, first, second });

  await useFurniture(page, tv.uid);
  await choose(page, 'News');
  await advance(page, 1);
  await wait(300);
  const news = await picture();
  check('turned to the news it shows something else', news.channel === 'news' && news.green < 0.2 && /News/.test(news.showing), news);
  await useFurniture(page, tv.uid);
  await choose(page, 'Football');
  await wait(200);

  const sofaLabel = await useFurniture(page, sofa.uid);
  await choose(page, 'Sit down');
  const seated = await playUntil(page, () => {
    const g = window.game;
    const a = g.player.actor;
    const home = g.world.interiorManager.residence.group.position;
    return a.hold && a.pose.legs === 'sit' ? { x: +(g.player.position.x - home.x).toFixed(2), z: +(g.player.position.z - home.z).toFixed(2) } : null;
  }, 25);
  await advance(page, 1.2);
  await wait(300);
  const watching = await page.evaluate(() => ({
    title: document.querySelector('#home-activity-status .buka-status-name')?.textContent,
    chips: [...document.querySelectorAll('#home-activity-status .activity-choice')].map((b) => `${b.textContent}${b.classList.contains('current') ? '*' : ''}`),
  }));
  check('the sofa is sat on, where it was put, and the status line says what is being watched with the channels to turn to',
    /Sit down/.test(sofaLabel || '') && !!seated && Math.abs(seated.x - 3.25) < 0.6 && Math.abs(seated.z - 5) < 0.6 && /Football/.test(watching.title || '') && watching.chips.some((c) => /Football\*/.test(c)) && watching.chips.some((c) => /^Off$/.test(c)),
    { sofaLabel, seated, watching });

  await page.evaluate(() => [...document.querySelectorAll('#home-activity-status .activity-choice')].find((b) => /Music/.test(b.textContent))?.click());
  await advance(page, 1);
  await wait(300);
  const tuned = await picture();
  await page.evaluate(() => document.getElementById('home-activity-status-stop')?.click());
  await idle(page);
  const up = await page.evaluate(() => { const a = window.game.player.actor; return !a.hold && a.pose.legs !== 'sit'; });
  check('from the sofa the television is turned to the music channel, and the player gets up again', tuned.channel === 'music' && up, { tuned, up });

  // ------------------------------------------------------------------ Moved, turned, sold
  await useFurniture(page, sofa.uid);
  await choose(page, 'Move it');
  await wait(300);
  let moving = await decor(page);
  await page.evaluate(() => window.game.modules.HouseDecorationSystem.getInstance().moveTo(11, 9));
  const before = await money(page);
  await pressSteady(page, '#furnish-bar-confirm');
  await wait(300);
  state = await decor(page);
  const moved = state.placed.find((item) => item.uid === sofa.uid);
  check('a piece already owned is picked up and put somewhere else for nothing', moving.placing?.moving === true && /Put it here/.test((await bar(page))?.button ?? 'Put it here') && moved.x === 11 && moved.z === 9 && moved.shown && (await money(page)).total === before.total, { moving: moving.placing, moved });

  // Walking goes round furniture: where the sofa stands cannot be stood on, and where it stood can
  const floor = await page.evaluate(() => {
    const home = window.game.world.interiorManager.residence;
    const o = home.group.position;
    return { underSofa: home.life.nav.isFree(o.x + 11, o.z + 9), whereItWas: home.life.nav.isFree(o.x + 3.25, o.z + 5) };
  });
  check('people walk round it where it stands now, and across the floor where it used to stand', !floor.underSofa && floor.whereItWas, floor);

  await pick(page, 'floor_lamp');
  await page.evaluate(() => window.game.modules.HouseDecorationSystem.getInstance().moveTo(13, 11));
  await pressSteady(page, '#furnish-bar-confirm');
  await wait(300);
  const lamp = (await decor(page)).placed.find((item) => item.id === 'floor_lamp');
  const beforeSale = await money(page);
  await useFurniture(page, lamp.uid);
  const lampChoices = await choices(page);
  await choose(page, 'Sell it');
  await wait(300);
  state = await decor(page);
  const gone = await page.evaluate((uid) => !window.game.world.interiorManager.getActiveInteractiveObjects().some((o) => o.id === `home_item_${uid}`), lamp.uid);
  check('a piece is sold for half what it cost, and is gone from the room', lampChoices.some((c) => /Sell it/.test(c) && /11,000/.test(c)) && !state.placed.some((item) => item.uid === lamp.uid) && gone && (await money(page)).total - beforeSale.total === 11000, { lampChoices, back: (await money(page)).total - beforeSale.total });

  // ------------------------------------------------------------------ The walls
  const wallBefore = await page.evaluate(() => window.game.world.interiorManager.residence.wallPaint.color.getHexString());
  const beforePaint = await money(page);
  await page.evaluate(() => window.game.modules.HouseDecorationSystem.getInstance().openCatalogueModal());
  await wait(300);
  // Walls and floors have a tab of their own
  await page.evaluate(() => document.querySelector('#house-catalogue-modal [data-tab="design"]')?.click());
  await wait(200);
  await page.evaluate(() => document.querySelector('#house-catalogue-modal [data-wall="sage"]')?.click());
  await wait(400);
  await page.evaluate(() => document.querySelector('#house-catalogue-modal [data-wall="sage"]')?.click());
  await wait(300);
  await page.evaluate(() => window.game.modules.HouseDecorationSystem.getInstance().closeCatalogueModal());
  const wallAfter = await page.evaluate(() => window.game.world.interiorManager.residence.wallPaint.color.getHexString());
  check('the walls are painted sage green for ₦15,000, once: choosing the colour they already are takes nothing',
    wallBefore !== wallAfter && (await decor(page)).wall === 'sage' && beforePaint.total - (await money(page)).total === 15000, { wallBefore, wallAfter, paid: beforePaint.total - (await money(page)).total });

  // ------------------------------------------------------------------ A bed that is bought is slept in
  await idle(page, 10);
  await page.evaluate(() => { const g = window.game; g.player.actor.hold?.release(true); g.hud.backend.depleteEnergy(60); });
  const beforeBed = await money(page);
  await pick(page, 'king_bed');
  // Somewhere in the living room with room for it
  const spot = await page.evaluate(() => {
    const d = window.game.modules.HouseDecorationSystem.getInstance();
    for (const [x, z] of [[9, 6], [8, 4], [6, 7], [-2, 7], [1, 2], [10, 2]]) {
      d.moveTo(x, z);
      if (d.blocked() === null) return { x, z };
    }
    return null;
  });
  await pressSteady(page, '#furnish-bar-confirm');
  await wait(300);
  const bedItem = (await decor(page)).placed.find((item) => item.id === 'king_bed');
  const bedPrice = beforeBed.total - (await money(page)).total;
  const tired = await page.evaluate(() => window.game.hud.backend.getData().stats.energy);
  const bedLabel = bedItem ? await useFurniture(page, bedItem.uid) : null;
  const bedChoices = await choices(page);
  await choose(page, 'Lie down and sleep');
  const asleep = await playUntil(page, () => {
    const g = window.game;
    const life = g.world.interiorManager.residence.life;
    const home = g.world.interiorManager.residence.group.position;
    return life.doing === 'sleeping' && g.player.actor.pose.legs === 'lie' ? { x: +(g.player.position.x - home.x).toFixed(2), z: +(g.player.position.z - home.z).toFixed(2), title: life.status()?.title } : null;
  }, 25);
  await advance(page, 8);
  const rested = await page.evaluate(() => window.game.hud.backend.getData().stats.energy);
  await page.evaluate(() => window.game.world.interiorManager.residence.life.stop());
  const upAgain = await idle(page, 10);
  const afterUp = await page.evaluate(() => ({ doing: window.game.world.interiorManager.residence.life.doing, legs: window.game.player.actor.pose.legs, free: !window.game.player.actor.scripted }));
  check('a bed bought from the catalogue and put down is slept in where it stands: the player walks to its side, lies down on it, and energy comes back while they sleep (it used to be furniture to look at)',
    !!spot && !!bedItem && bedPrice > 0 && /Sleep in it/.test(bedLabel || '') && bedChoices.some((c) => /Lie down and sleep/.test(c)) && !!asleep && Math.hypot(asleep.x - bedItem.x, asleep.z - bedItem.z) < 1.3 && /Sleeping/.test(asleep.title || '')
      && rested > tired && upAgain === true && afterUp.doing === null && afterUp.legs === 'stand' && afterUp.free, { spot, bedItem, bedPrice, bedLabel, asleep, tired, rested, afterUp });
  // Sold again, so what follows is about the two pieces it has always been about
  const soldBed = bedItem ? await page.evaluate((uid) => window.game.modules.HouseDecorationSystem.getInstance().sell(uid), bedItem.uid) : null;
  check('and it is sold again for half of what it cost', !!soldBed && soldBed.ok && soldBed.refund === Math.round(bedPrice / 2) && (await decor(page)).placed.length === 2, { soldBed, bedPrice });

  // ------------------------------------------------------------------ Still there tomorrow
  const kept = await decor(page);
  const purse = await money(page);
  await page.evaluate(() => { const g = window.game; return g.world.interiorManager.exitCurrentInterior(g.player, g.cameraManager, g.hud, g.world); });
  await wait(1200);
  const outside = await page.evaluate(() => ({ inside: window.game.world.interiorManager.isPlayerInside(), placing: !!window.game.modules.HouseDecorationSystem.getInstance().placing }));
  await reload(page);
  await enterInterior(page, 'residence');
  await wait(600);
  const after = await decor(page);
  const afterWall = await page.evaluate(() => window.game.world.interiorManager.residence.wallPaint.color.getHexString());
  const again = await page.evaluate(() => window.game.world.interiorManager.getActiveInteractiveObjects().filter((o) => o.id.startsWith('home_item_')).length);
  const same = (a, b) => a.length === b.length && a.every((item) => b.some((other) => other.uid === item.uid && other.x === item.x && other.z === item.z && other.turns === item.turns));
  check('after leaving, closing the game and coming back, the furniture is where it was put, the walls are the colour they were painted, and nothing was charged again',
    !outside.inside && same(kept.placed, after.placed) && after.placed.length === 2 && afterWall === wallAfter && again === 2 && (await money(page)).total === purse.total, { kept: kept.placed, after: after.placed, afterWall });

  check('no errors were logged at any of it', log.errors.length === 0, log.errors.slice(0, 5));
  await ctx.close();
}
