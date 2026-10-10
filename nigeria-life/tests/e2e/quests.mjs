// Story quests advance when the player actually does the thing: eat, work, drive, travel.
import { open, reload, wait, money, quest, newPlayer, enterInterior, leaveInterior, closeDialogs, useStation, playUntil, advance } from './lib.mjs';

export async function run(browser, check) {
  // --- Chapter 1 through the phone, chapter 2 by driving, then the Abuja arc by flying
  let ctx = await newPlayer(browser);
  const { page, log } = await open(ctx);

  check('new game: chapter 1 is tracked and incomplete', (await quest(page, 'quest_lagos_1')).status === 'active');

  // Food ordered on the phone is brought by a rider, paid for at the door, and counts once it is eaten
  await page.evaluate(() => window.game.hud.phoneModal.openApp('chowdeck'));
  await wait(700);
  await page.evaluate(() => document.querySelector('#smartphone-wrapper [data-add]').click());
  await wait(200);
  await page.evaluate(() => document.getElementById('shopping-order-btn').click());
  await wait(200);
  let q1 = await quest(page, 'quest_lagos_1');
  const beforeItArrives = q1.obj.obj_l1_eat;
  await advance(page, 20);
  const phoneMeal = await page.evaluate(() => window.game.hud.backend.getData().inventory.find((item) => item.id.startsWith('meal_'))?.id ?? null);
  await page.evaluate((id) => window.game.hud.backend.useItem(id), phoneMeal);
  await wait(300);
  q1 = await quest(page, 'quest_lagos_1');
  check('QuickChop from the phone completes the "eat" objective when the food has arrived and been eaten, not when it is ordered',
    beforeItArrives === false && phoneMeal && q1.obj.obj_l1_eat === true, { beforeItArrives, phoneMeal, q1 });

  await page.evaluate(() => window.game.hud.phoneModal.openApp('jobs'));
  await wait(300);
  const started = await page.evaluate(() => { const b = document.querySelector('[data-start-job]'); if (!b) return null; b.click(); return b.getAttribute('data-start-job'); });
  await wait(300);
  // Skip the shift's waiting time
  await page.evaluate(() => { window.game.hud.backend.data.activeJobShift.startTime -= 24 * 3600 * 1000; window.game.hud.phoneModal.render(); });
  await wait(200);
  const claimed = await page.evaluate(() => { const b = document.getElementById('btn-claim-shift-salary'); if (b) { b.click(); return true; } return false; });
  await wait(500);
  q1 = await quest(page, 'quest_lagos_1');
  check('claiming a job shift completes the "work" objective', q1.obj.obj_l1_work === true, { started, claimed, q1 });
  check('chapter 1 completes when both objectives are done', q1.status === 'completed', q1.status);
  check('chapter 2 unlocks and becomes the tracked quest', (await quest(page, 'quest_lagos_2')).status === 'active');
  const reward = await page.evaluate(() => window.game.hud.backend.getData().transactionHistory.find((t) => t.type === 'QUEST_REWARD'));
  check('the chapter reward (₦15,000) is paid and recorded in the ledger', reward && reward.amount === 15000, reward);
  const tracker = await page.evaluate(() => document.getElementById('tracker-quest-title')?.textContent);
  check('the HUD tracker shows chapter 2', /Ch\. 2/.test(tracker || ''), tracker);
  await page.evaluate(() => window.game.hud.phoneModal.close());
  await wait(200);

  await page.evaluate(() => { const g = window.game; const v = g.world.vehicles.getNearestDrivableVehicle(g.player.position, 1e9); g.player.mesh.position.set(v.mesh.position.x + 2, 0, v.mesh.position.z); });
  await wait(300);
  await page.keyboard.press('f');
  // The player walks round to the driver's door and gets in
  await advance(page, 3);
  await wait(600);
  const driving = await page.evaluate(() => window.game.player.isDriving);
  const q2 = await quest(page, 'quest_lagos_2');
  check('getting behind the wheel completes the "drive" objective', driving && q2.obj.obj_l2_drive === true, { driving, q2 });
  check('driving in Lagos does not complete the Abuja cab objective', (await quest(page, 'quest_abuja_1')).obj.obj_a1_cab === false);
  await page.keyboard.press('f');
  await wait(500);

  const beforeFlight = await money(page);
  await page.evaluate(() => window.game.hud.interstateModal.open('lagos'));
  await wait(500);
  await page.evaluate(() => document.querySelector('[data-dest-id="abuja"]').click());
  await wait(1200);
  await page.evaluate(() => window.game.flightExperience.skipFlight());
  await wait(2500);
  await page.evaluate(() => window.game.roadRideExperience.skipRide());
  await wait(2500);
  const city = await page.evaluate(() => window.game.world.cityManager.currentCityId);
  const afterFlight = await money(page);
  check('the flight lands in Abuja and charges the fare once', city === 'abuja' && beforeFlight.total - afterFlight.total === 35000, { city, charged: beforeFlight.total - afterFlight.total });
  const qa = await quest(page, 'quest_abuja_1');
  check('arriving completes "Travel to Abuja", even though a Lagos quest is tracked', qa.obj.obj_a1_arrive === true && qa.obj.obj_a1_cab === false, qa);

  const cab = await useStation(page, 'abuja-cab', false);
  await wait(300);
  check('riding the Abuja green cab completes that chapter', (await quest(page, 'quest_abuja_1')).status === 'completed', cab);
  await closeDialogs(page);

  await reload(page);
  check('reload: still in Abuja', (await page.evaluate(() => window.game.world.cityManager.currentCityId)) === 'abuja');
  check('reload: quest progress kept', (await quest(page, 'quest_lagos_1')).status === 'completed' && (await quest(page, 'quest_abuja_1')).status === 'completed');
  check('quests: no console errors', log.errors.length === 0, log.errors.slice(0, 5));
  await ctx.close();

  // --- The same objectives through the world instead of the phone
  ctx = await newPlayer(browser);
  const { page: p2 } = await open(ctx);
  await enterInterior(p2, 'restaurant');
  // At the buka a meal is ordered from the menu, brought to the table and eaten there
  const meal = await useStation(p2, 'buka_food_counter');
  await wait(200);
  await p2.click('.buka-dish[data-dish="jollof_rice"]');
  const ate = await playUntil(p2, () => {
    const q = window.game.hud.questManager.getAllQuests().find((x) => x.id === 'quest_lagos_1');
    return q.objectives.find((o) => o.id === 'obj_l1_eat').isCompleted ? true : null;
  }, 60);
  check('a buka meal completes the "eat" objective', !!ate && (await quest(p2, 'quest_lagos_1')).obj.obj_l1_eat === true, meal);
  await closeDialogs(p2);
  await leaveInterior(p2);
  const m0 = await money(p2);
  const gig = await useStation(p2, 'construction-site', false);
  const wage = await p2.evaluate(() => window.game.hud.backend.getData().transactionHistory.find((t) => t.type === 'JOB_SALARY'));
  const m1 = await money(p2);
  // The chapter completes here too, so the wallet also receives the ₦15,000 chapter reward
  check('a street hustle pays ₦6,500, is recorded, and completes the "work" objective',
    (await quest(p2, 'quest_lagos_1')).obj.obj_l1_work === true && wage && wage.amount === 6500 && m1.cash - m0.cash === 6500 + 15000,
    { gig, wage: wage && wage.amount, walletDelta: m1.cash - m0.cash });
  await ctx.close();
}
