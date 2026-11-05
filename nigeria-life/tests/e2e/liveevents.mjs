// Live events at the venues, on a timetable: while one is on, the venue shows it (a star on the
// stage, a crowd, a LIVE sign); the player buys a ticket once and sits in the crowd while the
// show goes on; a talk is ON AIR and takes questions; the phone's What's on lists them with a
// cab there; and the player hears when a show comes on.
import { open, newPlayer, closeDialogs, advance, wait, playUntil, money } from './lib.mjs';

// Day 0 is Wednesday 7 October: day 3 is a Saturday, day 5 a Monday
const SATURDAY = 3;
const MONDAY = 5;

const at = (page, day, hour) => page.evaluate(({ day, hour }) => { const s = window.game.world.skyEnvironment; s.day = day; s.setHour(hour); }, { day, hour });
const enter = async (page, key) => {
  await page.evaluate((k) => {
    const g = window.game;
    const card = g.world.interactiveObjects.find((o) => o.id === `roadside-${k}`);
    g.player.stopMoving();
    g.player.mesh.position.set(card.interactionPoint.x, 0, card.interactionPoint.z);
    g.hud.showInteractionCard(card);
    document.getElementById('card-action-btn')?.click();
  }, key);
  return playUntil(page, () => (window.game.world.interiorManager.currentInterior && !window.game.world.interiorManager.isTransitioning ? window.game.world.interiorManager.currentInterior.name : null), 20);
};
const leave = async (page) => {
  await page.evaluate(() => { const g = window.game; return g.world.interiorManager.exitCurrentInterior(g.player, g.cameraManager, g.hud, g.world); });
  await wait(1000);
};
const show = (page, key) => page.evaluate((k) => {
  const g = window.game;
  const group = g.scene.getObjectByName(`live ${k}`);
  if (!group) return null;
  let crowd = 0;
  let performer = null;
  let sign = false;
  for (const c of group.children) {
    if (c.isMesh && c.material?.vertexColors) crowd += 1;
    if (/^performer/.test(c.name)) performer = c.name;
    if (c.isMesh && c.material?.map && c.visible) sign = true;
  }
  return { visible: group.visible, crowd, performer, sign };
}, key);
const label = (page, key) => page.evaluate((k) => { const g = window.game; const o = g.world.interiorManager.getActiveInteractiveObjects().find((x) => x.id === `event_${k}`); g.hud.showInteractionCard(o); return document.getElementById('card-action-btn')?.textContent ?? ''; }, key);
const useCard = async (page, key, choice) => {
  await page.evaluate((k) => { const g = window.game; const o = g.world.interiorManager.getActiveInteractiveObjects().find((x) => x.id === `event_${k}`); g.player.stopMoving(); g.player.mesh.position.set(o.interactionPoint.x, 0, o.interactionPoint.z); g.hud.showInteractionCard(o); document.getElementById('card-action-btn')?.click(); }, key);
  await wait(300);
  const text = await page.evaluate(() => [...document.querySelectorAll('#game-dialogue-overlay button')].map((b) => b.textContent.replace(/\s+/g, ' ').trim()));
  await page.evaluate((t) => [...document.querySelectorAll('#game-dialogue-overlay button')].find((b) => b.textContent.includes(t))?.click(), choice);
  await wait(200);
  return text;
};

export async function run(browser, check) {
  const ctx = await newPlayer(browser);
  const { page, log } = await open(ctx);
  await closeDialogs(page);
  await page.evaluate(() => { const b = window.game.hud.backend; b.data.walletCash += 100000; b.saveData(); });

  // ------------------------------------------------------------------ Saturday night at Freedom Park
  await at(page, SATURDAY, 19);
  const name = await enter(page, 'freedom-park');
  await advance(page, 1);
  const on = await show(page, 'freedom-park');
  const liveLabel = await label(page, 'freedom-park');
  check('events: on a Saturday at 7 pm Freedom Park has its Highlife night on: the band on the stage, a crowd on the benches, the LIVE sign up',
    name === 'Freedom Park' && on?.visible && /fp-highlife/.test(on.performer ?? '') && on.crowd >= 12 && on.sign && /LIVE: Highlife & Afrobeat Night · ₦5,000/.test(liveLabel), { name, on, liveLabel });

  const m0 = await money(page);
  const fun0 = await page.evaluate(() => { window.game.hud.backend.modifyNeed('fun', -60); return window.game.hud.backend.getData().stats.fun; });
  const offered = await useCard(page, 'freedom-park', 'Buy a ticket');
  let sat = false;
  const watched = await playUntil(page, () => {
    const a = window.game.player.actor;
    if (a.pose.legs === 'sit') window.__sat = true;
    return /Encore/.test(document.body.innerText) && !a.sequence ? true : null;
  }, 70);
  sat = await page.evaluate(() => !!window.__sat);
  const m1 = await money(page);
  const fun1 = await page.evaluate(() => window.game.hud.backend.getData().stats.fun);
  check('events: a ticket is bought (₦5,000) and the player sits in the crowd while the show goes on, to the encore; fun goes up',
    offered.some((t) => /Dance in front of the stage/.test(t)) && !!watched && sat && m0.total - m1.total === 5000 && fun1 - fun0 >= 30, { offered, watched, sat, paid: m0.total - m1.total, fun: [fun0, fun1] });

  await useCard(page, 'freedom-park', 'Sit in the crowd');
  await playUntil(page, () => (window.game.player.actor.sequence ? null : true), 40);
  const m2 = await money(page);
  check('events: back to the crowd the same night, the ticket is already paid', m1.total === m2.total, { again: m1.total - m2.total });

  // ------------------------------------------------------------------ Midday: nothing on, and what is next
  await at(page, SATURDAY, 12);
  await advance(page, 1);
  const off = await show(page, 'freedom-park');
  const nextLabel = await label(page, 'freedom-park');
  check('events: at midday the stage is empty again, and the card says what is next', off && !off.visible && /Next: Comedy Hour, today, 2 pm/.test(nextLabel), { off, nextLabel });
  await page.evaluate(() => window.game.hud.hideInteractionCard());
  await leave(page);

  // ------------------------------------------------------------------ A Monday morning talk, ON AIR
  await at(page, MONDAY, 10);
  const hotel = await enter(page, 'eko-grand-hotel');
  await advance(page, 1);
  const summit = await show(page, 'eko-grand-hotel');
  const c0 = await page.evaluate(() => window.game.hud.backend.getSkills().charisma ?? 1);
  await useCard(page, 'eko-grand-hotel', 'Ask a question');
  await playUntil(page, () => (window.game.player.actor.sequence ? null : true), 20);
  await advance(page, 0.3);
  const answered = await page.evaluate(() => /Great question/.test(document.body.innerText));
  check('events: on a Monday morning the Eko Tech Summit is on in the hotel ballroom (a stage, a screen, rows of chairs, ON AIR), and the player asks a question at the microphone',
    hotel === 'Eko Grand Hotel' && summit?.visible && /eko-summit/.test(summit.performer ?? '') && summit.sign && answered, { summit, answered, charisma: c0 });
  await closeDialogs(page);
  await leave(page);

  // ------------------------------------------------------------------ What's on, and a cab there
  await page.evaluate(() => window.game.hud.phoneModal.openApp('events'));
  await wait(500);
  const phone = await page.evaluate(() => ({ live: document.getElementById('events-live')?.innerText ?? '', later: [...document.querySelectorAll('#events-later [data-event]')].length }));
  const f0 = await money(page);
  await page.evaluate(() => document.querySelector('#events-live [data-act="go"][data-arg="eko-grand-hotel"]')?.click());
  await wait(300);
  const riding = await page.evaluate(() => window.game.roadRideExperience.isActive);
  await playUntil(page, () => (window.game.roadRideExperience.isActive ? null : true), 60);
  check('events: the phone\'s What\'s on shows the summit LIVE and the rest coming up; Go is a paid cab there',
    /LIVE/.test(phone.live) && /Eko Tech Summit/.test(phone.live) && phone.later >= 8 && riding && f0.total > (await money(page)).total, { phone, riding });
  await closeDialogs(page);

  // ------------------------------------------------------------------ The notice when a show comes on
  await at(page, SATURDAY, 17.92);
  await advance(page, 0.5);
  const told = await playUntil(page, () => (/LIVE now at Freedom Park: Highlife & Afrobeat Night/.test(document.body.innerText) ? true : null), 20);
  check('events: as six o\'clock strikes on Saturday the player is told the Highlife night is live at Freedom Park', !!told, { told });

  check('events: no errors in the page', log.errors.length === 0, log.errors.slice(0, 5));
  await ctx.close();
}
