// People: greeting, shaking hands, talking and sitting together are seen to happen, the other
// person answers according to how well they know the player, and other players see it too.
import { open, reload, wait, newPlayer, enterInterior, leaveInterior, advance, playUntil, closeDialogs } from './lib.mjs';

const WHO = 'bet-customer'; // Segun, standing outside the bet shop

/** Both people at this instant. */
const pair = (page, id) => page.evaluate((objectId) => {
  const g = window.game;
  const me = g.player.actor;
  const them = g.interactions.actorFor(objectId);
  const here = me.worldPosition();
  const there = them.worldPosition();
  const off = (from, to, yaw) => Math.abs(Math.atan2(Math.sin(Math.atan2(to.x - from.x, to.z - from.z) - yaw), Math.cos(Math.atan2(to.x - from.x, to.z - from.z) - yaw)));
  return {
    me: { arms: me.pose.arms, legs: me.pose.legs, scripted: me.scripted, doing: me.sequence?.name ?? null, seated: me.hold !== null, facing: off(here, there, me.yaw) < 0.25 },
    them: { arms: them.pose.arms, scripted: them.scripted, doing: them.sequence?.name ?? null, seated: them.hold !== null, facing: off(there, here, them.yaw) < 0.25, home: Math.abs(Math.atan2(Math.sin(them.yaw - them.homeYaw), Math.cos(them.yaw - them.homeYaw))) < 0.1 },
    apart: +Math.hypot(here.x - there.x, here.z - there.z).toFixed(2),
    knows: g.hud.backend.familiarity(them.id),
  };
}, id);

/** Opens someone's card the way a click on them does, and reads what it offers. */
const card = async (page, id, inside = false) => {
  await closeDialogs(page);
  return page.evaluate(({ objectId, inside }) => {
    const g = window.game;
    const list = inside ? g.world.interiorManager.getActiveInteractiveObjects() : g.world.interactiveObjects;
    const obj = list.find((o) => o.id === objectId);
    // Indoors, stand where a click on them would have walked the player to
    if (inside && !g.player.actor.hold) g.player.mesh.position.set(obj.interactionPoint.x, 0, obj.interactionPoint.z);
    g.hud.showInteractionCard(obj);
    const shown = (elId) => getComputedStyle(document.getElementById(elId)).display !== 'none';
    return {
      wave: shown('card-wave-btn'), greet: shown('card-greet-btn'), shake: shown('card-shake-btn'), chat: shown('card-chat-btn'), sit: shown('card-sit-btn'),
      row: shown('card-social'), label: document.getElementById('card-social-label').textContent, action: document.getElementById('card-action-btn').textContent,
    };
  }, { objectId: id, inside });
};

/** Watches the two of them for a while and reports everything that was seen. */
const watch = async (page, id, seconds) => {
  const seen = { myArms: new Set(), theirArms: new Set(), bothAtOnce: new Set(), facedEachOther: false, closest: Infinity, stayedSeated: true };
  for (let t = 0; t < seconds; t += 0.15) {
    const now = await pair(page, id);
    seen.myArms.add(now.me.arms);
    seen.theirArms.add(now.them.arms);
    if (now.me.arms === now.them.arms) seen.bothAtOnce.add(now.me.arms);
    if (now.me.scripted && now.them.scripted && now.me.facing && now.them.facing) seen.facedEachOther = true;
    seen.closest = Math.min(seen.closest, now.apart);
    await advance(page, 0.15);
  }
  return { myArms: [...seen.myArms], theirArms: [...seen.theirArms], bothAtOnce: [...seen.bothAtOnce], facedEachOther: seen.facedEachOther, closest: seen.closest };
};

const settle = async (page, id, seconds = 12) => {
  await playUntil(page, (objectId) => {
    const g = window.game;
    const them = g.interactions.actorFor(objectId);
    return !g.player.actor.sequence && !them.sequence ? true : null;
  }, seconds, id);
  return pair(page, id);
};

export async function run(browser, check) {
  const ctx = await newPlayer(browser);
  const { page, log } = await open(ctx);
  await closeDialogs(page);

  // ------------------------------------------------------------------ A stranger on the street
  await page.evaluate(() => { const g = window.game; g.player.mesh.position.set(-9, 0, 4.5); });
  await advance(page, 0.3);
  let offered = await card(page, WHO);
  check('a person\'s card offers Wave, Greet, Shake hands and Chat, and says they are a stranger',
    offered.row && offered.wave && offered.greet && offered.shake && offered.chat && !offered.sit && offered.label === 'Stranger', offered);

  // Greet
  await page.click('#card-greet-btn');
  let seen = await watch(page, WHO, 4.5);
  let after = await settle(page, WHO);
  check('greeting: the player turns and bows a little; the stranger turns and answers the same way, formally',
    seen.myArms.includes('greet') && seen.theirArms.includes('greet') && !seen.theirArms.includes('wave') && after.knows === 2,
    { ...seen, knows: after.knows });
  check('afterwards both are free and he is facing the way he was', !after.me.scripted && !after.them.scripted && after.them.home, after);

  // The same greeting straight away does not count twice
  await card(page, WHO);
  await page.click('#card-greet-btn');
  await watch(page, WHO, 4);
  after = await settle(page, WHO);
  check('greeting again at once is answered but does not count twice', after.knows === 2, { knows: after.knows });

  // Shake hands
  await page.evaluate(() => { const g = window.game; g.player.mesh.position.set(-7.5, 0, 6.5); });
  await advance(page, 0.3);
  await card(page, WHO);
  await page.click('#card-shake-btn');
  seen = await watch(page, WHO, 5);
  after = await settle(page, WHO);
  check('shaking hands: the player walks up to arm\'s length, they face each other and both hold out a hand together',
    seen.bothAtOnce.includes('shake') && seen.facedEachOther && seen.closest > 0.6 && seen.closest < 1.1 && after.knows === 6,
    { ...seen, knows: after.knows });
  check('after the handshake both are free again, and he turns back', !after.me.scripted && !after.them.scripted && after.them.home, after);

  // Chat
  await card(page, WHO);
  await page.click('#card-chat-btn');
  seen = await watch(page, WHO, 9);
  after = await settle(page, WHO);
  check('chatting: they face each other and take turns talking', seen.myArms.includes('talk') && seen.theirArms.includes('talk') && seen.facedEachOther, seen);
  offered = await card(page, WHO);
  check('after a greeting, a handshake and a chat he knows the player, and the card says so', after.knows === 11 && offered.label === 'Knows you', { knows: after.knows, label: offered.label });
  await page.evaluate(() => window.game.hud.hideInteractionCard());

  // After a while a greeting counts again
  await advance(page, 22);
  await card(page, WHO);
  await page.click('#card-greet-btn');
  await watch(page, WHO, 4);
  after = await settle(page, WHO);
  check('a greeting some time later counts again', after.knows === 13, { knows: after.knows });

  // A friend answers differently
  await page.evaluate((id) => { const g = window.game; g.hud.backend.addFamiliarity(g.interactions.actorFor(id).id, 30); }, WHO);
  await advance(page, 22);
  offered = await card(page, WHO);
  await page.click('#card-greet-btn');
  seen = await watch(page, WHO, 4.5);
  await settle(page, WHO);
  check('a friend answers a greeting with a wave, and the card calls them a friend', offered.label === 'Friend' && seen.theirArms.includes('wave'), { label: offered.label, ...seen });

  // It is kept in the save
  const known = (await pair(page, WHO)).knows;
  await page.evaluate(() => window.game.hud.backend.saveData());
  await reload(page);
  await closeDialogs(page);
  const afterReload = await pair(page, WHO);
  check('how well someone knows the player is kept when the game is closed and reopened', afterReload.knows === known && known >= 43, { before: known, after: afterReload.knows });

  // ------------------------------------------------------------------ Inside: seats, counters, people at work
  await enterInterior(page, 'restaurant');
  await advance(page, 0.5);
  const TUNDE = 'interior_npc_npc_baba_tunde';
  offered = await card(page, TUNDE, true);
  check('someone sitting down can be greeted and spoken to and sat with, but not offered a handshake',
    offered.wave && offered.greet && offered.chat && offered.sit && !offered.shake, offered);

  await page.click('#card-sit-btn');
  const sat = await playUntil(page, () => (window.game.player.actor.hold ? true : null), 25);
  const table = await page.evaluate(() => {
    const g = window.game;
    const service = g.world.interiorManager.restaurant.service;
    const mine = [...g.interactions.reservations.entries()].find(([, who]) => who === 'player')?.[0];
    const his = [...g.interactions.reservations.entries()].find(([, who]) => who === 'npc:npc_baba_tunde')?.[0];
    const status = document.getElementById('buka-order-status');
    return { mine, his, companion: service.companion, order: !!service.order, status: status.style.display !== 'none' ? status.textContent : null, legs: g.player.actor.pose.legs };
  });
  check('"Sit together" walks the player to a free chair at his table and seats them, with nothing ordered',
    sat && table.mine && table.his && table.mine.split(':')[1] === table.his.split(':')[1] && table.mine !== table.his && table.companion === 'Baba Tunde' && !table.order && table.legs === 'sit' && /Sitting with Baba Tunde/.test(table.status || ''),
    table);

  // Talk across the table without getting up
  await card(page, TUNDE, true);
  await page.click('#card-chat-btn');
  seen = await watch(page, TUNDE, 8);
  after = await settle(page, TUNDE);
  check('they can chat across the table, both still seated', seen.myArms.includes('talk') && seen.theirArms.includes('talk') && after.me.seated && after.them.seated && after.me.legs === 'sit' && after.knows === 5, { ...seen, seated: after.me.seated, knows: after.knows });

  // Order from the seat
  const cashBefore = await page.evaluate(() => window.game.hud.backend.getData().walletCash);
  await page.click('#buka-company-order');
  await wait(200);
  await page.click('.buka-dish[data-dish="suya"]');
  await advance(page, 0.3);
  const ordered = await page.evaluate(() => {
    const g = window.game;
    const service = g.world.interiorManager.restaurant.service;
    return { stage: service.order?.stage, seated: g.player.actor.hold !== null, doing: g.player.actor.sequence?.name ?? null, legs: g.player.actor.pose.legs };
  });
  check('ordering from that seat starts the order without the player getting up', ordered.stage === 'waiting' && ordered.seated && ordered.legs === 'sit' && ordered.doing === null, ordered);
  const eating = await playUntil(page, () => (window.game.world.interiorManager.restaurant.service.order?.stage === 'eating' ? true : null), 40);
  const paid = await page.evaluate(() => {
    const d = window.game.hud.backend.getData();
    return { cash: d.walletCash, bills: d.transactionHistory.filter((t) => t.type === 'FOOD_PURCHASE').length };
  });
  check('the food is brought to that seat and paid for once when it arrives', eating && cashBefore - paid.cash === 1200 && paid.bills === 1, { paid: cashBefore - paid.cash, bills: paid.bills });
  await page.click('#buka-order-stop');
  await playUntil(page, () => { const g = window.game; return !g.player.actor.hold && !g.player.actor.sequence ? true : null; }, 15);
  const up = await page.evaluate(() => ({ companion: window.game.world.interiorManager.restaurant.service.companion, free: !window.game.player.actor.scripted }));
  check('standing up leaves the table and the company', up.companion === null && up.free, up);

  // Someone in the middle of a job does not stop for a chat
  await playUntil(page, () => (window.game.world.interiorManager.restaurant.service.waiter.busy ? true : null), 10);
  const busyChat = await page.evaluate(async () => {
    const g = window.game;
    const service = g.world.interiorManager.restaurant.service;
    if (!service.waiter.busy) return { skipped: true };
    const obj = g.world.interiorManager.getActiveInteractiveObjects().find((o) => o.id === 'interior_npc_npc_waiter_segun');
    g.hud.showInteractionCard(obj);
    document.getElementById('card-chat-btn').click();
    await g.advance(0.2);
    return { skipped: false, playerDoing: g.player.actor.sequence?.name ?? null, waiterDoing: service.waiter.sequence?.name ?? null };
  });
  check('a waiter who is clearing a table carries on with it instead of stopping to chat',
    busyChat.skipped || (busyChat.playerDoing !== 'chat' && busyChat.waiterDoing !== 'chat'), busyChat);
  await leaveInterior(page);

  // A cashier behind her counter: no handshake across it
  await enterInterior(page, 'shop');
  await advance(page, 0.5);
  offered = await card(page, 'interior_npc_npc_shop_cashier', true);
  check('someone behind a counter can be greeted and spoken to, but a handshake across the counter is not offered', offered.greet && offered.chat && !offered.shake, offered);
  await page.evaluate(() => window.game.hud.hideInteractionCard());
  await leaveInterior(page);

  // ------------------------------------------------------------------ Seen by another player
  await page.evaluate(() => { const g = window.game; g.player.mesh.position.set(2, 0, 9); });
  const other = await ctx.newPage();
  await other.setViewport({ width: 900, height: 600 });
  await other.goto(page.url(), { waitUntil: 'load', timeout: 120000 });
  await other.waitForFunction('window.game', { timeout: 120000 });
  await wait(2500);
  await other.evaluate(() => { const g = window.game; g.player.mesh.position.set(4, 0, 11); });
  // Let the two find each other
  for (let i = 0; i < 6; i++) {
    await advance(page, 0.2);
    await wait(120);
    await advance(other, 0.2);
    await wait(120);
  }
  const met = await other.evaluate(() => {
    const g = window.game;
    const them = [...g.network.remotePlayers.values()][0];
    return them ? { count: g.network.remotePlayers.size, hasBody: !!them.actor && !!them.rig?.rightArm, visible: them.mesh.visible } : null;
  });
  check('a second player sees the first one on the street, with a proper body', met && met.count === 1 && met.hasBody && met.visible, met);

  // The first player waves at the second
  const waved = await page.evaluate(() => {
    const g = window.game;
    const [id, them] = [...g.network.remotePlayers.entries()][0];
    g.hud.showInteractionCard({ mesh: them.mesh, id: `remote_player_${id}`, name: them.name, category: 'Online Citizen', description: '', interactionPoint: them.mesh.position.clone() });
    const offered = getComputedStyle(document.getElementById('card-wave-btn')).display !== 'none' && getComputedStyle(document.getElementById('card-shake-btn')).display === 'none';
    document.getElementById('card-wave-btn').click();
    return offered;
  });
  let sawWave = false;
  let raised = 0;
  for (let i = 0; i < 14 && !sawWave; i++) {
    await advance(page, 0.12);
    await wait(120);
    await advance(other, 0.2);
    const there = await other.evaluate(() => {
      const them = [...window.game.network.remotePlayers.values()][0];
      return { arms: them.actor.pose.arms, scripted: them.actor.scripted, armZ: them.rig.rightArm.rotation.z };
    });
    if (there.arms === 'wave' && there.scripted) { sawWave = true; raised = there.armZ; }
  }
  const told = await other.evaluate(() => /waved at you/.test(document.body.textContent));
  check('when the first player waves at them, the second player sees the arm go up on their own screen and is told about it',
    waved && sawWave && raised > 1 && told, { offered: waved, sawWave, armRaised: +raised.toFixed(2), told });

  // And when it is over, the other screen shows them standing normally again
  await advance(page, 4);
  for (let i = 0; i < 5; i++) {
    await advance(page, 0.15);
    await wait(120);
    await advance(other, 0.2);
  }
  const rested = await other.evaluate(() => {
    const them = [...window.game.network.remotePlayers.values()][0];
    return { scripted: them.actor.scripted };
  });
  check('afterwards the second player sees them standing normally again', rested.scripted === false, rested);

  // Someone who goes indoors is not left standing in the street on other screens
  await enterInterior(page, 'bank');
  for (let i = 0; i < 5; i++) {
    await advance(page, 0.15);
    await wait(120);
    await advance(other, 0.2);
  }
  const indoors = await other.evaluate(() => [...window.game.network.remotePlayers.values()][0].mesh.visible);
  check('a player who has gone into a building is no longer shown on the street to others', indoors === false, { visible: indoors });
  await other.close();
  await leaveInterior(page);

  check('social: no console errors', log.errors.length === 0, log.errors.slice(0, 5));
  await ctx.close();
}
