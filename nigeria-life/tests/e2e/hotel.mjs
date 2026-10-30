// A night at the Eko Grand: checked in at the front desk (paid as the key card is handed over),
// up in the lift with the card, along the corridor to the guest's own door which the card opens,
// and the room: sleep as long as they like, room service brought up and eaten at the desk, the
// minibar, the television. Leaving goes back the way they came, room to corridor to lobby to
// road. Once the stay has run out the card opens nothing until the desk is seen again.
import { open, newPlayer, closeDialogs, advance, wait, playUntil, money } from './lib.mjs';

const where = (page) => page.evaluate(() => {
  const g = window.game;
  const im = g.world.interiorManager;
  const id = im.currentInterior?.id ?? null;
  const room = im.places.find((p) => p.def.id === id);
  const o = room?.group.position ?? { x: 0, z: 0 };
  return { id, x: +(g.player.position.x - o.x).toFixed(2), z: +(g.player.position.z - o.z).toFixed(2), inside: im.isPlayerInside(), moving: im.busy };
});
const card = async (page, id, choice) => {
  await closeDialogs(page);
  const found = await page.evaluate((cid) => {
    const g = window.game;
    const o = g.world.interiorManager.getActiveInteractiveObjects().find((x) => x.id === cid);
    if (!o) return false;
    g.player.stopMoving();
    g.player.mesh.position.set(o.interactionPoint.x, 0, o.interactionPoint.z);
    g.hud.showInteractionCard(o);
    document.getElementById('card-action-btn')?.click();
    return true;
  }, id);
  await wait(300);
  if (choice) await page.evaluate((t) => [...document.querySelectorAll('#game-dialogue-overlay button')].find((b) => b.textContent.includes(t))?.click(), choice);
  await wait(100);
  return found;
};
const labelOf = (page, id) => page.evaluate((cid) => {
  const g = window.game;
  const o = g.world.interiorManager.getActiveInteractiveObjects().find((x) => x.id === cid);
  g.hud.showInteractionCard(o);
  return document.getElementById('card-action-btn')?.textContent ?? '';
}, id);
const done = (page, seconds = 20) => playUntil(page, () => (window.game.player.actor.sequence ? null : true), seconds);
const inRoom = (page, id, seconds = 25) => playUntil(page, (want) => { const im = window.game.world.interiorManager; return im.currentInterior?.id === want && !im.busy ? true : null; }, seconds, id);
const bag = (page) => page.evaluate(() => window.game.hud.backend.getData().inventory.filter((i) => i.id === 'hotel_key').map((i) => i.name));
const play = async (page, seconds) => { for (let t = 0; t < seconds; t += 0.5) { await advance(page, 0.5); await wait(15); } };

export async function run(browser, check) {
  const ctx = await newPlayer(browser);
  const { page, log } = await open(ctx);
  await closeDialogs(page);
  await page.evaluate(() => { const g = window.game; g.hud.backend.data.walletCash += 1_000_000; g.hud.backend.saveData(); g.world.skyEnvironment.setHour(20); });

  // In off the road
  await page.evaluate(() => {
    const g = window.game;
    const door = g.world.interactiveObjects.find((o) => o.id === 'roadside-eko-grand-hotel');
    g.player.stopMoving();
    g.player.mesh.position.set(door.interactionPoint.x, 0, door.interactionPoint.z);
    g.hud.showInteractionCard(door);
    document.getElementById('card-action-btn')?.click();
  });
  await inRoom(page, 'interior_place_eko-grand-hotel');
  const road = await page.evaluate(() => { const d = window.game.world.interactiveObjects.find((o) => o.id === 'roadside-eko-grand-hotel'); return { x: d.interactionPoint.x, z: d.interactionPoint.z }; });

  // No key, no lift
  await card(page, 'place_eko-grand-hotel_lift');
  await play(page, 2);
  const noKey = await where(page);
  check('hotel: without a key card the lift does not go up', noKey.id === 'interior_place_eko-grand-hotel', noKey);

  // Two nights at the desk
  const m0 = await money(page);
  const label0 = await labelOf(page, 'place_eko-grand-hotel_reception');
  await card(page, 'place_eko-grand-hotel_reception', 'Two nights');
  const midway = await playUntil(page, () => (window.game.player.actor.pose.arms === 'talk' ? true : null), 8);
  const mTalk = await money(page);
  await done(page);
  const m1 = await money(page);
  const stay = await page.evaluate(() => { const H = window.game.modules.HotelStay.get(); const s = H.current(); return s ? { ...s, day: H.now().day } : null; });
  const key = await bag(page);
  check('hotel: at the front desk two nights are ₦170,000, paid as the key card is handed over (not while talking); the card for the room is in the bag and the stay runs two nights',
    /a room from ₦85,000/.test(label0) && !!midway && mTalk.total === m0.total && m0.total - m1.total === 170_000 && stay && stay.until - stay.from === 2 && key.length === 1 && key[0] === `Room ${stay.room} key card`,
    { label0, paid: m0.total - m1.total, whileTalking: m0.total - mTalk.total, stay, key });

  // Up in the lift and along to the door
  await card(page, 'place_eko-grand-hotel_lift');
  const upstairs = await inRoom(page, 'interior_place_eko-grand-floor');
  const atLift = await where(page);
  check('hotel: with the key card the lift goes up to the second floor, and the guest steps out in front of it', !!upstairs && Math.abs(atLift.x + 2.3) < 0.6 && Math.abs(atLift.z - 9.5) < 0.6, atLift);

  const other = [201, 202, 203, 204, 205, 206].find((n) => n !== stay.room);
  await card(page, `place_eko-grand-floor_room${other}`);
  await done(page);
  const knocked = await where(page);
  const myLabel = await labelOf(page, `place_eko-grand-floor_room${stay.room}`);
  await card(page, `place_eko-grand-floor_room${stay.room}`);
  const green = await playUntil(page, (n) => { let c = null; window.game.world.interiorManager.places.find((p) => p.def.id === 'interior_place_eko-grand-floor').group.traverse((o) => { if (o.name === `room door ${n}`) o.traverse((m) => { if (m.name === 'lock light') c = m.material.color.getHex(); }); }); return c === 0x16a34a ? true : null; }, 8, stay.room);
  const inMine = await inRoom(page, 'interior_place_eko-grand-suite');
  const suite = await page.evaluate(() => window.game.modules.HotelState.suite.state());
  await advance(page, 0.3);
  const roomCard = await page.evaluate(() => {
    const g = window.game;
    const door = g.world.interiorManager.getActiveInteractiveObjects().find((o) => o.id === 'interior_exit_door');
    g.hud.showInteractionCard(door);
    return { card: document.getElementById('place-card')?.innerText.replace(/\s+/g, ' ') ?? '', door: document.getElementById('card-action-btn')?.textContent ?? '' };
  });
  check('hotel: in the room, the card of things to do is the room’s own (the bed, the phone, the minibar) and its door says it goes to the corridor',
    /your room/.test(roomCard.card) && /bed/i.test(roomCard.card) && /minibar/i.test(roomCard.card) && !/pool/i.test(roomCard.card) && /Room door/.test(roomCard.door) && !/Street/.test(roomCard.door), roomCard);
  check('hotel: another guest\'s door only gets a knock; the guest\'s own door says so, its lock goes green for the card, and it opens into their room',
    knocked.id === 'interior_place_eko-grand-floor' && /open it with your key card/.test(myLabel) && !!green && !!inMine && suite.number === stay.room, { knocked: knocked.id, myLabel, green, suite });

  // Sleep, as long as they like
  await page.evaluate(() => window.game.hud.backend.modifyNeed('energy', -70));
  await card(page, 'place_eko-grand-suite_bed');
  const asleep = await playUntil(page, () => (window.game.modules.HotelState.suite.asleep ? true : null), 10);
  await play(page, 14);
  const rested = await page.evaluate(() => ({ energy: window.game.hud.backend.getData().stats.energy, asleep: window.game.modules.HotelState.suite.asleep, legs: window.game.player.actor.pose.legs }));
  await page.evaluate(() => window.game.modules.InteractionDirector.get().interrupt(window.game.player.actor));
  await play(page, 1.5);
  const up = await page.evaluate(() => ({ asleep: window.game.modules.HotelState.suite.asleep, legs: window.game.player.actor.pose.legs }));
  check('hotel: in the king bed the guest sleeps, is fully rested and stays lying in until they choose to get up', !!asleep && rested.energy >= 99 && rested.asleep && rested.legs === 'lie' && !up.asleep && up.legs !== 'lie', { rested, up });

  // Room service
  const r0 = await money(page);
  await page.evaluate(() => window.game.hud.backend.modifyNeed('hunger', -50));
  const h0 = await page.evaluate(() => window.game.hud.backend.getData().stats.hunger);
  await card(page, 'place_eko-grand-suite_phone', 'Jollof rice');
  await done(page);
  const r1 = await money(page);
  await play(page, 15);
  const coming = await page.evaluate(() => window.game.modules.HotelState.suite.state());
  const served = await playUntil(page, () => (window.game.modules.HotelState.suite.state().tray ? true : null), 25);
  const eatLabel = await labelOf(page, 'place_eko-grand-suite_phone');
  await card(page, 'place_eko-grand-suite_phone');
  const eating = await playUntil(page, () => (window.game.player.actor.pose.arms === 'eat' ? true : null), 10);
  await done(page, 15);
  const h1 = await page.evaluate(() => window.game.hud.backend.getData().stats.hunger);
  const after = await page.evaluate(() => window.game.modules.HotelState.suite.state());
  check('hotel: room service is ordered on the room phone (₦18,000); the waiter knocks, brings the tray in and sets it on the desk; the guest sits and eats it (hunger up) and the tray is cleared',
    r0.total - r1.total === 18_000 && coming.waiter?.visible && !!served && /Eat your room service/.test(eatLabel) && !!eating && h1 > h0 + 40 && !after.tray && !after.order,
    { paid: r0.total - r1.total, coming, eatLabel, h0, h1, after });

  const b0 = await money(page);
  await card(page, 'place_eko-grand-suite_minibar', 'Chapman');
  await done(page);
  const b1 = await money(page);
  await card(page, 'place_eko-grand-suite_tv');
  const tvOn = await playUntil(page, () => (window.game.modules.HotelState.suite.state().tv ? true : null), 8);
  await done(page, 15);
  check('hotel: a Chapman from the minibar is ₦6,000; the television comes on while the guest sits and watches', b0.total - b1.total === 6_000 && !!tvOn, { minibar: b0.total - b1.total, tvOn });

  // Out the way they came
  await page.evaluate(() => document.getElementById('place-leave-btn')?.click());
  const toCorridor = await inRoom(page, 'interior_place_eko-grand-floor');
  const outside = await where(page);
  await page.evaluate(() => document.getElementById('place-leave-btn')?.click());
  const toLobby = await inRoom(page, 'interior_place_eko-grand-hotel');
  await page.evaluate(() => document.getElementById('place-leave-btn')?.click());
  const toRoad = await playUntil(page, () => { const im = window.game.world.interiorManager; return !im.isPlayerInside() && !im.busy ? true : null; }, 25);
  const street = await page.evaluate(() => ({ x: window.game.player.position.x, z: window.game.player.position.z }));
  const mine = [201, 202, 203, 204, 205, 206].indexOf(stay.room);
  check('hotel: leaving goes back the way they came: out of the room into the corridor at its door, down to the lobby, out to the road at the hotel\'s door',
    !!toCorridor && Math.abs(Math.abs(outside.x) - 2.3) < 0.7 && Math.abs(outside.z - [4, 4, -2, -2, -8, -8][mine]) < 0.7 && !!toLobby && !!toRoad && Math.hypot(street.x - road.x, street.z - road.z) < 3,
    { outside, toLobby, toRoad, street, road });

  // Three days on: the stay has run out
  await page.evaluate(() => {
    const g = window.game;
    const door = g.world.interactiveObjects.find((o) => o.id === 'roadside-eko-grand-hotel');
    g.player.mesh.position.set(door.interactionPoint.x, 0, door.interactionPoint.z);
    g.hud.showInteractionCard(door);
    document.getElementById('card-action-btn')?.click();
  });
  await inRoom(page, 'interior_place_eko-grand-hotel');
  await page.evaluate(() => { const H = window.game.modules.HotelStay.get(); const real = H.now; const d = real().day; H.now = () => ({ day: d + 3, hour: 10 }); });
  await card(page, 'place_eko-grand-hotel_lift');
  await play(page, 2);
  const refused = await where(page);
  const deskLabel = await labelOf(page, 'place_eko-grand-hotel_reception');
  await card(page, 'place_eko-grand-hotel_reception', 'Hand back the old key card');
  await done(page);
  const handedBack = await bag(page);
  check('hotel: once the stay has run out the lift will not take the card; at the desk the old card is handed back and leaves the bag',
    refused.id === 'interior_place_eko-grand-hotel' && /a room from/.test(deskLabel) && handedBack.length === 0, { refused: refused.id, deskLabel, handedBack });

  check('hotel: no errors in the page', log.errors.length === 0, log.errors.slice(0, 5));
  await ctx.close();
}
