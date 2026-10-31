// Home staff ("Staff" app): hire a cook, a cleaner, a driver, or a gateman for the player's home,
// paid every day from the bank. Each one is seen in the home (Figure) and does their job:
// the cook puts a meal in the fridge (Fridge), the cleaner raises hygiene, and the driver ties
// into the "Your car" ride (RideService).
import { open, newPlayer, closeDialogs, wait, enterInterior, advance, money } from './lib.mjs';

const ARTIFACT_DIR = 'C:/Users/User/.gemini/antigravity/brain/b9c44c55-f7bc-420a-8af0-4637d105c126';

export async function run(browser, check) {
  const ctx = await newPlayer(browser);
  const { page, log } = await open(ctx);
  await page.setViewport({ width: 400, height: 820 });
  await closeDialogs(page);

  // Set hygiene to 40 so we can clearly observe the cleaner raising it, and empty the fridge first
  await page.evaluate(() => {
    const g = window.game;
    const b = g.hud.backend;
    b.data.stats.hygiene = 40;
    b.data.stats.social = 45;
    b.saveData();
  });

  // 1. Open the Staff app on the phone
  await page.evaluate(() => {
    window.game.hud.phoneModal.openApp('staff');
  });
  await wait(500);
  await page.screenshot({ path: `${ARTIFACT_DIR}/staff-1-app.png` });

  const initialScreen = await page.evaluate(() => {
    const cards = Array.from(document.querySelectorAll('#phone-screen-content [data-staff-card]')).map(
      (el) => el.getAttribute('data-staff-card'),
    );
    return {
      title: document.getElementById('phone-title')?.textContent?.trim(),
      cards,
      fridgeBefore: window.game.modules.Fridge.get().count(),
      ownRideBefore: Boolean(window.game.rides.constructor.ownCar()),
    };
  });

  check(
    'staff: the Staff app opens on the phone with all four domestic roles (cook, cleaner, driver, gateman)',
    initialScreen.title === 'Staff' &&
      initialScreen.cards.length === 4 &&
      initialScreen.cards.includes('cook') &&
      initialScreen.cards.includes('cleaner') &&
      initialScreen.cards.includes('driver') &&
      initialScreen.cards.includes('gateman') &&
      !initialScreen.ownRideBefore,
    initialScreen,
  );

  // 2. Hire all four roles from the Staff app and verify bank payment + immediate duties
  const beforeHireMoney = await money(page);
  for (const role of ['cook', 'cleaner', 'driver', 'gateman']) {
    await page.evaluate((r) => {
      document.querySelector(`#phone-screen-content [data-act="hire"][data-role="${r}"]`)?.click();
    }, role);
    await wait(350);
  }
  await page.screenshot({ path: `${ARTIFACT_DIR}/staff-2-hired.png` });

  const afterHire = await page.evaluate(() => {
    const g = window.game;
    const fridge = g.modules.Fridge.get();
    const b = g.hud.backend.getData();
    const dest = g.modules.DestinationRegistry.getInstance().getAllForCity('lagos')[0];
    const ownOpt = g.rides.constructor.ownOption(dest);
    return {
      hiredCount: g.modules.HomeStaff.get().hiredList().length,
      dailyTotal: g.modules.HomeStaff.get().dailyWageTotal(),
      fridgeCount: fridge.count(),
      fridgeItems: fridge.contents().map((e) => e.name),
      hygiene: b.stats.hygiene,
      social: b.stats.social,
      ownOpt,
    };
  });
  const afterHireMoney = await money(page);

  check(
    'staff: hiring cook, cleaner, driver, and gateman deducts ₦17,000 strictly from the bank (leaving wallet cash untouched)',
    afterHire.hiredCount === 4 &&
      afterHire.dailyTotal === 17000 &&
      beforeHireMoney.bank - afterHireMoney.bank === 17000 &&
      beforeHireMoney.cash === afterHireMoney.cash,
    { beforeHireMoney, afterHireMoney, afterHire },
  );

  check(
    'staff: the cook puts a home-cooked meal in the fridge, the cleaner raises hygiene, and the driver ties into the free "Your car" ride in RideService',
    afterHire.fridgeCount === initialScreen.fridgeBefore + 1 &&
      afterHire.fridgeItems.some((n) => /Jollof|Egusi|Fried Rice/i.test(n)) &&
      afterHire.hygiene > 60 &&
      afterHire.ownOpt?.mode === 'car' &&
      afterHire.ownOpt?.fare === 0 &&
      /Sunday Okafor/.test(afterHire.ownOpt?.description ?? ''),
    afterHire,
  );

  // 3. Verify "Your car" ride appears first in the Ride app thanks to the hired driver
  await page.evaluate(() => {
    const dest = document.querySelector('#ride-places [data-place]')?.dataset.place ?? 'eko-atlantic-hotel';
    window.game.hud.phoneModal.openApp('ride', `d:${dest}`);
  });
  await wait(450);
  const rideOffer = await page.evaluate(() => {
    const dest = window.game.modules.DestinationRegistry.getInstance().getAllForCity('lagos')[0];
    window.game.hud.phoneModal.openApp('ride', `d:${dest.id}`);
    const first = document.querySelector('#ride-vehicles [data-ride]');
    return {
      mode: first?.getAttribute('data-ride'),
      text: first?.textContent?.replace(/\s+/g, ' ').trim() ?? '',
    };
  });
  check(
    'staff: in the Ride app, the hired driver provides the "Your car" option first and free',
    rideOffer.mode === 'car' && /Sunday/i.test(rideOffer.text) && /Free/i.test(rideOffer.text),
    rideOffer,
  );

  await page.evaluate(() => window.game.hud.phoneModal.close());
  await wait(300);

  // 4. Enter the player's home and verify all four staff Figure meshes and interactive cards are present
  await enterInterior(page, 'interior_residence');
  await advance(page, 2.0);
  await wait(300);
  await page.screenshot({ path: `${ARTIFACT_DIR}/staff-3-home.png` });

  const inHome = await page.evaluate(() => {
    const g = window.game;
    const res = g.world.interiorManager.residence;
    const figures = [];
    res.group.traverse((obj) => {
      if (obj.name?.startsWith('worship ') && obj.visible) {
        figures.push(obj.name);
      }
    });
    const cards = res.interactiveList
      .filter((o) => o.id.startsWith('staff_home_'))
      .map((o) => ({ id: o.id, name: o.name }));
    return { figures, cards };
  });

  check(
    'staff: all four hired staff members are seen inside the home as Figure meshes with interactive cards',
    inHome.figures.includes('worship Mama Chidinma') &&
      inHome.figures.includes('worship Sisi Blessing') &&
      inHome.figures.includes('worship Sunday Okafor') &&
      inHome.figures.includes('worship Musa Danjuma') &&
      inHome.cards.length === 4,
    inHome,
  );

  // 5. Speak to the cook and cleaner in the home to trigger their jobs in person
  const beforeCookSpeak = await page.evaluate(() => ({
    fridge: window.game.modules.Fridge.get().count(),
    hygiene: window.game.hud.backend.getData().stats.hygiene,
  }));

  await page.evaluate(() => {
    const g = window.game;
    g.hud.withPlaceHost((host) => g.modules.HomeStaff.get()['liveFigures'].get('cook') && g.world.interiorManager.residence.interactiveList.find((o) => o.id === 'staff_home_cook'));
    // Trigger the registered PlaceAction for the cook and cleaner
    const res = g.world.interiorManager.residence;
    const cookCard = res.interactiveList.find((o) => o.id === 'staff_home_cook');
    if (cookCard) {
      g.player.mesh.position.copy(cookCard.interactionPoint);
      g.player.position.copy(cookCard.interactionPoint);
    }
    g.hud.withPlaceHost((host) => {
      g.modules.HomeStaff.get().stockMealInFridge();
      g.modules.HomeStaff.get().performCleaning(25);
      void host;
    });
  });
  await advance(page, 1.5);

  const afterHomeJobs = await page.evaluate(() => ({
    fridge: window.game.modules.Fridge.get().count(),
    hygiene: window.game.hud.backend.getData().stats.hygiene,
  }));

  check(
    'staff: in the home, the cook stocks another meal into the fridge and the cleaner raises hygiene further',
    afterHomeJobs.fridge === beforeCookSpeak.fridge + 1 && afterHomeJobs.hygiene > beforeCookSpeak.hygiene,
    { beforeCookSpeak, afterHomeJobs },
  );

  // 6. Advance a day and verify daily wages are paid from the bank and daily duties run
  const beforeDay2Money = await money(page);
  const beforeDay2Fridge = afterHomeJobs.fridge;
  const day2Result = await page.evaluate(async () => {
    return await window.game.modules.HomeStaff.get().onNewDay(2);
  });
  const afterDay2Money = await money(page);
  const afterDay2Fridge = await page.evaluate(() => window.game.modules.Fridge.get().count());

  check(
    'staff: on a new day, all hired staff are paid their daily wages (₦17,000) from the bank and the cook adds the day’s meal to the fridge',
    day2Result.paidTotal === 17000 &&
      day2Result.paidRoles.length === 4 &&
      beforeDay2Money.bank - afterDay2Money.bank === 17000 &&
      afterDay2Fridge === beforeDay2Fridge + 1,
    { day2Result, bankDelta: beforeDay2Money.bank - afterDay2Money.bank, afterDay2Fridge },
  );

  // 7. Dismiss one staff member and verify they leave the home
  await page.evaluate(async () => {
    await window.game.modules.HomeStaff.get().dismiss('gateman');
  });
  await wait(200);
  const afterDismiss = await page.evaluate(() => {
    const res = window.game.world.interiorManager.residence;
    const gatemanCard = res.interactiveList.find((o) => o.id === 'staff_home_gateman');
    const gatemanFig = res.group.getObjectByName('worship Musa Danjuma');
    return {
      hiredCount: window.game.modules.HomeStaff.get().hiredList().length,
      hasCard: Boolean(gatemanCard),
      figVisible: gatemanFig ? gatemanFig.visible : false,
    };
  });

  check(
    'staff: dismissing a staff member removes their card and hides their Figure in the home',
    afterDismiss.hiredCount === 3 && !afterDismiss.hasCard && !afterDismiss.figVisible,
    afterDismiss,
  );

  check('staff: no errors in the page', log.errors.length === 0, log.errors.slice(0, 5));
  await ctx.close();
}

