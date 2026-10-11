// Places keep hours. The bank, the university, the supermarket, the buka, the stadium and the
// nightclub are each open when their one record says so and shut otherwise, whichever way the
// player comes; the map says which it is now. Cash is taken out at a cash machine, which is a
// place to walk to and works at any hour, not a screen that opens anywhere.
import { open, newPlayer, closeDialogs, advance, playUntil, money, wait, leaveByDoor, untilStopped } from './lib.mjs';

const setHour = (page, hour) => page.evaluate((h) => window.game.world.skyEnvironment.setHour(h), hour);
const put = (page, x, z) => page.evaluate(({ x, z }) => { const p = window.game.player; p.stopMoving(); p.onBridge = false; p.mesh.position.set(x, 0, z); }, { x, z });
const inside = (page) => page.evaluate(() => window.game.world.interiorManager.currentInterior?.type ?? null);
const atmUp = (page) => page.evaluate(() => document.getElementById('atm-modal').style.display === 'flex');
const said = (page, pattern) => page.evaluate((source) => new RegExp(source, 'i').test(document.body.innerText), pattern);

/** Stands the player at a street door and reads what its prompt says. */
async function atDoor(page, id) {
  return page.evaluate(async (id) => {
    const g = window.game;
    const o = g.world.interactiveObjects.find((x) => x.id === id);
    g.hud.hideInteractionCard();
    g.player.stopMoving();
    g.player.mesh.position.set(o.interactionPoint.x, 0, o.interactionPoint.z);
    await g.advance(0.1);
    return g.hud.currentInteractionTarget?.label ?? null;
  }, id);
}

/** Tries the door the way a player does, and by going straight at the room: is either let in? */
async function tryToEnter(page, doorId, type) {
  await atDoor(page, doorId);
  await page.keyboard.press('e');
  await advance(page, 1.5);
  await wait(300);
  const byDoor = (await inside(page)) === type || (await page.evaluate(() => window.game.world.interiorManager.busy));
  await page.evaluate((t) => { const g = window.game; g.world.interiorManager.enterInterior(t, g.player, g.cameraManager, g.hud, g.world); }, type);
  await wait(500);
  const straightIn = (await inside(page)) === type;
  return { byDoor, straightIn };
}

export async function run(browser, check) {
  const ctx = await newPlayer(browser);
  const { page, log } = await open(ctx);
  await closeDialogs(page);

  // ------------------------------------------------------------------ One record
  const record = await page.evaluate(() => {
    const g = window.game;
    const registry = g.modules.DestinationRegistry.getInstance();
    const of = (id) => { const d = registry.getById(id); return { hours: d.hours ?? null, words: d.openingHours }; };
    const club = g.world.landmarks.club.status();
    return {
      bank: of('dest_lagos_bank'), university: of('dest_lagos_unilag'), supermarket: of('dest_lagos_supermarket'), buka: of('dest_lagos_buka'),
      stadium: of('dest_lagos_stadium'), club: of('dest_lagos_quilox'), hospital: of('dest_lagos_hospital'), police: of('dest_lagos_police'),
      clubItself: club.hours,
    };
  });
  check('each place that keeps hours has them on its record, and what its card says is written from them: the bank 8 am to 4 pm, the nightclub 8 pm to 5 am; the hospital and the police never shut',
    record.bank.hours.opens === 8 && record.bank.hours.closes === 16 && record.bank.words === '8 am to 4 pm' && record.club.words === '8 pm to 5 am' && record.university.words === '7 am to 9 pm'
      && record.supermarket.words === '7 am to 10 pm' && record.buka.words === '9 am to 11 pm' && record.stadium.words === '9 am to 11 pm'
      && record.hospital.hours === null && record.hospital.words === 'Open all day' && record.police.hours === null
      && record.clubItself.opens === record.club.hours.opens && record.clubItself.closes === record.club.hours.closes, record);

  // ------------------------------------------------------------------ The street at night
  const streetAt = async (hour) => {
    await setHour(page, hour);
    await advance(page, 0.3);
    return page.evaluate(() => {
      const w = window.game.world;
      const drawn = w.cityPopulation.variants.reduce((sum, variant) => sum + variant.drawn, 0);
      return { walkers: w.cityPopulation.outNow, ofWalkers: w.cityPopulation.count, drawn, traffic: w.trafficSpawner.moving };
    });
  };
  const noon = await streetAt(12);
  const evening = await streetAt(21);
  const small = await streetAt(3);
  const dawn = await streetAt(7.5);
  check('the street is as busy as the hour: everyone is out at noon, fewer by nine in the evening, about one in ten of the people and the traffic at three in the morning, and all of them again by half past seven (it was as full at 3 am as at noon)',
    noon.walkers === noon.ofWalkers && noon.traffic.now === noon.traffic.byDay && evening.walkers < noon.walkers * 0.7 && evening.walkers > small.walkers
      && small.walkers < noon.walkers * 0.2 && small.walkers > 0 && small.traffic.now < noon.traffic.byDay * 0.2 && small.drawn <= small.walkers && dawn.walkers === noon.walkers && dawn.traffic.now === noon.traffic.byDay, { noon, evening, small, dawn });

  // ------------------------------------------------------------------ The bank by day
  await setHour(page, 13);
  const dayPrompt = await atDoor(page, 'lagos-bank');
  await page.keyboard.press('e');
  const inBank = await playUntil(page, () => (window.game.world.interiorManager.currentInterior?.type === 'bank' && !window.game.world.interiorManager.busy ? true : null), 20);
  check('at one in the afternoon the bank is open: its door says so and lets the player in', !!dayPrompt && !/closed/i.test(dayPrompt) && inBank === true, { dayPrompt, inBank });
  await leaveByDoor(page);

  // ------------------------------------------------------------------ The bank at night
  await setHour(page, 20);
  const nightPrompt = await atDoor(page, 'lagos-bank');
  const bankAtNight = await tryToEnter(page, 'lagos-bank', 'bank');
  const told = await said(page, 'is closed\\. It opens at 8 am');
  check('at eight in the evening the bank is shut: the door says "closed (8 am to 4 pm)", and neither the door nor any other way in lets the player through',
    /closed \(8 am to 4 pm\)/.test(nightPrompt ?? '') && !bankAtNight.byDoor && !bankAtNight.straightIn && told, { nightPrompt, bankAtNight, told });

  // ------------------------------------------------------------------ The others, each by its own hours
  const others = {};
  for (const [hour, door, type] of [[23.5, 'supermarket', 'shop'], [3, 'mama-put', 'restaurant'], [22, 'unilag-campus', 'university']]) {
    await setHour(page, hour);
    const known = await page.evaluate((d) => !!window.game.world.interactiveObjects.find((x) => x.id === d), door);
    others[type] = known ? { ...(await tryToEnter(page, door, type)), open: await page.evaluate((t) => window.game.world.interiorManager.isOpenNow(t), type) } : { missing: door };
  }
  check('the supermarket is shut at half past eleven at night, the buka at three in the morning and the university at ten at night',
    Object.values(others).every((o) => !o.missing && !o.byDoor && !o.straightIn && o.open === false), others);

  await setHour(page, 3);
  await page.evaluate(() => { const g = window.game; g.world.interiorManager.enterInterior('hospital', g.player, g.cameraManager, g.hud, g.world); });
  await wait(900);
  const hospitalAtThree = await inside(page);
  const stadiumAtThree = await page.evaluate(() => window.game.world.landmarks.status()['surulere-stadium']?.open ?? null);
  check('the hospital takes people in at three in the morning, when the stadium is shut', hospitalAtThree === 'hospital' && stadiumAtThree === false, { hospitalAtThree, stadiumAtThree });

  // ------------------------------------------------------------------ No cash machine in a ward
  const cash0 = await money(page);
  await page.keyboard.press('b');
  await wait(400);
  const inWard = { screen: await atmUp(page), told: await said(page, 'no cash machine in here') };
  check('in the hospital, asking for a cash machine opens nothing: the player is told there is none in here', !inWard.screen && inWard.told, inWard);
  await leaveByDoor(page);

  // ------------------------------------------------------------------ The map says which it is
  await page.click('#nav-btn-map');
  await wait(1800);
  await page.evaluate(() => window.game.hud.worldMapUI.goToPlace('dest_lagos_bank', 'lagos'));
  await wait(500);
  const bankCard = await page.evaluate(() => ({ text: document.getElementById('map-card-sub').textContent, shut: document.getElementById('map-card-sub').classList.contains('shut') }));
  await page.evaluate(() => window.game.hud.worldMapUI.goToPlace('dest_lagos_hospital', 'lagos'));
  await wait(500);
  const hospitalCard = await page.evaluate(() => ({ text: document.getElementById('map-card-sub').textContent, shut: document.getElementById('map-card-sub').classList.contains('shut') }));
  await page.click('#btn-map-back-street');
  await wait(600);
  await setHour(page, 10);
  await page.click('#nav-btn-map');
  await wait(1800);
  await page.evaluate(() => window.game.hud.worldMapUI.goToPlace('dest_lagos_bank', 'lagos'));
  await wait(500);
  const bankCardByDay = await page.evaluate(() => ({ text: document.getElementById('map-card-sub').textContent, shut: document.getElementById('map-card-sub').classList.contains('shut') }));
  await page.click('#btn-map-back-street');
  await wait(600);
  check('on the map at three in the morning the bank reads "Closed now, opens at 8 am" and the hospital "Open all day"; at ten the bank reads "Open now, until 4 pm" (the card used to show a green light at every hour)',
    /Closed now, opens at 8 am/.test(bankCard.text) && bankCard.shut && /Open all day/.test(hospitalCard.text) && !hospitalCard.shut && /Open now, until 4 pm/.test(bankCardByDay.text) && !bankCardByDay.shut, { bankCard, hospitalCard, bankCardByDay });

  // ------------------------------------------------------------------ Cash at any hour, but at a machine
  await setHour(page, 3);
  await put(page, 9, 40);
  const start = await money(page);
  await page.keyboard.press('b');
  await wait(400);
  await advance(page, 0.4);
  const asked = await page.evaluate(() => ({ screen: document.getElementById('atm-modal').style.display === 'flex', moving: window.game.player.isMoving, told: /nearest cash machine, Eko Commercial Bank is \d+ m away/i.test(document.body.innerText) }));
  check('pressing B sixty metres from a cash machine does not put its screen up (it used to, anywhere): the player is told where the nearest is and sets off for it',
    !asked.screen && asked.moving && asked.told, asked);
  await untilStopped(page, 40);
  await wait(300);
  const arrived = await page.evaluate(() => {
    const g = window.game;
    const machine = g.world.interactiveObjects.find((o) => o.id === 'atm-broad-street');
    return { card: g.hud.currentActiveObject?.id ?? null, button: document.getElementById('card-action-btn')?.textContent ?? '', away: +Math.hypot(g.player.position.x - machine.interactionPoint.x, g.player.position.z - machine.interactionPoint.z).toFixed(2), bankOpen: g.world.interiorManager.isOpenNow('bank') };
  });
  check('they walk to the machine in the wall of the bank, which is there to be used though the branch is shut', arrived.card === 'atm-broad-street' && /cash machine/i.test(arrived.button) && arrived.away < 3 && arrived.bankOpen === false, arrived);

  await page.click('#card-action-btn');
  const reaching = await playUntil(page, () => {
    const g = window.game;
    return g.player.actor.pose.arms === 'reach' && g.player.actor.sequence?.name === 'use atm-broad-street' ? { screen: document.getElementById('atm-modal').style.display === 'flex' } : null;
  }, 6);
  const screenUp = await playUntil(page, () => (document.getElementById('atm-modal').style.display === 'flex' ? true : null), 5);
  await page.evaluate(() => document.querySelector('#atm-modal [data-withdraw]').click());
  await advance(page, 1.5);
  const after = await money(page);
  check('the player puts a hand to the machine, then its screen comes up, and a withdrawal moves money from the bank to the wallet at three in the morning',
    !!reaching && reaching.screen === false && screenUp === true && after.cash > start.cash && start.bank - after.bank === after.cash - start.cash, { reaching, screenUp, toWallet: after.cash - start.cash, fromBank: start.bank - after.bank });
  await page.keyboard.press('Escape');
  await advance(page, 1);
  await page.evaluate(() => document.getElementById('atm-close-btn')?.click());

  // Standing at it, the button by the money opens it; from far off, it does not
  const plus = await page.evaluate(() => {
    const r = document.getElementById('btn-quick-topup').getBoundingClientRect();
    const m = document.getElementById('hud-money').getBoundingClientRect();
    const onTop = (x, y) => document.elementFromPoint(x, y)?.id ?? '';
    return { plus: onTop(r.x + r.width / 2, r.y + r.height / 2), money: onTop(m.right - 3, m.y + m.height / 2), width: innerWidth };
  });
  check('at laptop width the money and the + beside it are in the clear: the location badge no longer lies over them', plus.plus === 'btn-quick-topup' && plus.money === 'hud-money', plus);
  await page.click('#btn-quick-topup');
  await wait(400);
  const atIt = await atmUp(page);
  await page.evaluate(() => document.getElementById('atm-close-btn')?.click());
  await put(page, -10, 90);
  await page.click('#btn-quick-topup');
  await wait(400);
  const farOff = { screen: await atmUp(page), moving: await page.evaluate(() => window.game.player.isMoving) };
  await page.evaluate(() => window.game.player.stopMoving());
  check('the + beside the money opens the screen when the player is standing at a machine, and sends them walking to one when they are not', atIt && !farOff.screen && farOff.moving, { atIt, farOff });

  // ------------------------------------------------------------------ A machine at every airport
  const lagosAirport = await page.evaluate(() => {
    const g = window.game;
    const machine = g.world.interactiveObjects.find((o) => o.id.startsWith('atm-airport'));
    const way = machine ? g.waysHere().route(-80, -80, machine.interactionPoint.x, machine.interactionPoint.z) : null;
    return { id: machine?.id ?? null, reaches: way?.reaches ?? false, plan: g.validateCity('lagos').length, door: g.world.interactiveObjects.find((o) => o.id === 'dest_lagos_airport') ? true : false };
  });
  const abuja = await page.evaluate(() => {
    const g = window.game;
    g.arriveInCity('abuja');
    const machines = g.world.interactiveObjects.filter((o) => o.id.startsWith('atm-'));
    const kerb = g.world.cityManager.abujaCity.airport.kerb;
    const way = machines[0] ? g.waysHere().route(kerb.x, kerb.z + 3, machines[0].interactionPoint.x, machines[0].interactionPoint.z) : null;
    return { ids: machines.map((m) => m.id), reaches: way?.reaches ?? false, metres: way ? +way.metres.toFixed(1) : null, plan: g.validateCity('abuja').length, planPh: g.validateCity('port_harcourt').length };
  });
  check('there is a cash machine in the wall of each airport, reached on foot from the kerb, and every city still passes its plan with them there',
    /^atm-airport-/.test(lagosAirport.id ?? '') && lagosAirport.reaches && lagosAirport.plan === 0 && lagosAirport.door && abuja.ids.length === 1 && /^atm-airport-/.test(abuja.ids[0]) && abuja.reaches && abuja.plan === 0 && abuja.planPh === 0, { lagosAirport, abuja });

  await page.keyboard.press('b');
  await wait(400);
  await advance(page, 0.4);
  const abujaAsked = await page.evaluate(() => ({ screen: document.getElementById('atm-modal').style.display === 'flex', moving: window.game.player.isMoving, city: window.game.world.cityManager.currentCityId }));
  check('in Abuja, asking for a cash machine sends the player to the one at Abuja airport, not to Lagos', abujaAsked.city === 'abuja' && !abujaAsked.screen && abujaAsked.moving, abujaAsked);

  void cash0;
  check('no errors were logged at any of it', log.errors.length === 0, log.errors.slice(0, 5));
  await wait(100);
  await ctx.close();
}
