// Marriage app: buying wedding rings at Computer Village, proposing to Spark matches
// with 60%+ closeness, holding traditional dowry wedding, and spouse living in home (3D Figure in parlour).
import { open, newPlayer, closeDialogs, wait, enterInterior, leaveInterior, advance, pressSteady } from './lib.mjs';

const ARTIFACT_DIR = 'C:/Users/User/.gemini/antigravity/brain/b9c44c55-f7bc-420a-8af0-4637d105c126';

const tap = async (page, selector) => {
  await page.evaluate(() => {
    const notice = document.getElementById('phone-notice');
    if (notice) notice.hidden = true;
  });
  await pressSteady(page, selector);
  await wait(280);
};

const snap = async (page, name) => {
  await page.evaluate(() => {
    document.querySelectorAll('.game-toast, #game-toast-container').forEach((el) => el.remove());
  });
  await page.screenshot({ path: `${ARTIFACT_DIR}/${name}.png` });
};

export async function run(browser, check) {
  const ctx = await newPlayer(browser);
  const { page, log } = await open(ctx);
  await page.setViewport({ width: 400, height: 820 });
  await closeDialogs(page);

  await page.evaluate(() => {
    const b = window.game.hud.backend;
    b.data.bank.balance = 500_000;
    b.data.stats.social = 40;
    b.data.stats.fun = 40;
    b.saveData();
    window.game.modules.Marriage.get().resetForTests();
  });

  // 1. Open Marriage app on the phone
  await page.evaluate(() => window.game.hud.phoneModal.openApp('marriage'));
  await wait(450);
  await snap(page, 'marriage-1-app');

  const initialView = await page.evaluate(() => {
    const cards = Array.from(document.querySelectorAll('#phone-screen-content [data-ring-card]')).map((el) =>
      el.getAttribute('data-ring-card'),
    );
    return {
      title: document.getElementById('phone-title')?.textContent?.trim(),
      cards,
      isMarried: window.game.modules.Marriage.get().isMarried(),
      ringsOwned: window.game.modules.Marriage.get().ownedRings().length,
    };
  });

  check(
    'marriage: opens on phone showing Silver, Gold, and Diamond wedding rings for sale',
    initialView.title === 'Marriage' &&
      initialView.cards.includes('silver') &&
      initialView.cards.includes('gold') &&
      initialView.cards.includes('diamond') &&
      !initialView.isMarried &&
      initialView.ringsOwned === 0,
    initialView,
  );

  // 2. Buy Silver Promise Band (₦35,000)
  const bankBeforeRing = await page.evaluate(() => window.game.hud.backend.getData().bank.balance);
  await tap(page, 'button[data-act="buy-ring"][data-ring="silver"]');
  await wait(300);
  await snap(page, 'marriage-2-ring');

  const ringBought = await page.evaluate(() => {
    const m = window.game.modules.Marriage.get();
    const b = window.game.hud.backend.getData();
    return {
      ownedRings: m.ownedRings(),
      bestRing: m.bestRing(),
      bankBalance: b.bank.balance,
      hasInBag: b.inventory.some((i) => i.id === 'ring_silver'),
    };
  });

  check(
    'marriage: buys Silver Promise Band for ₦35,000 and adds ring to player inventory',
    ringBought.ownedRings.includes('silver') &&
      ringBought.bestRing === 'silver' &&
      bankBeforeRing - ringBought.bankBalance === 35000 &&
      ringBought.hasInBag,
    ringBought,
  );

  // 3. Navigate to Proposal tab, set closeness with Zainab to 75%, and propose
  await tap(page, 'button[data-set="mr.tab"][data-value="proposal"]');
  await wait(300);

  // Verify propose button is disabled when closeness < 60
  const proposeDisabled = await page.evaluate(() => {
    const btn = document.querySelector('button[data-spouse="zainab"]');
    return btn?.hasAttribute('disabled') ?? false;
  });

  check(
    'marriage: proposal is blocked until player builds at least 60% closeness on Spark dates',
    proposeDisabled,
    { proposeDisabled },
  );

  // Boost Zainab's closeness to 75%
  await page.evaluate(async () => {
    const s = window.game.modules.Spark.get();
    await s.like('zainab');
    s.setClosenessForTests('zainab', 75);
    window.game.hud.phoneModal.openApp('marriage');
  });
  await wait(350);
  await tap(page, 'button[data-set="mr.tab"][data-value="proposal"]');
  await wait(300);

  // Now propose to Zainab
  await tap(page, 'button[data-act="propose-spouse"][data-spouse="zainab"]');
  await wait(400);
  await snap(page, 'marriage-3-engaged');

  const engagedState = await page.evaluate(() => {
    const m = window.game.modules.Marriage.get();
    const state = m.snapshot();
    const canMarryBtn = document.querySelector('button[data-act="hold-wedding"]');
    return {
      status: state.marriage?.status,
      spouseName: state.marriage?.spouseName,
      ringTier: state.marriage?.ringTier,
      canMarryBtn: !!canMarryBtn,
    };
  });

  check(
    'marriage: proposal succeeds with 60%+ closeness, setting status to engaged with wedding dowry button unlocked',
    engagedState.status === 'engaged' &&
      engagedState.spouseName === 'Zainab Bello' &&
      engagedState.ringTier === 'silver' &&
      engagedState.canMarryBtn,
    engagedState,
  );

  // 4. Hold traditional wedding ceremony with dowry (₦75,000)
  const bankBeforeWedding = await page.evaluate(() => window.game.hud.backend.getData().bank.balance);
  await tap(page, 'button[data-act="hold-wedding"][data-spouse="zainab"]');
  await wait(500);

  const marriedState = await page.evaluate(() => {
    const m = window.game.modules.Marriage.get();
    const state = m.snapshot();
    const b = window.game.hud.backend.getData();
    return {
      status: state.marriage?.status,
      closeness: state.marriage?.closeness,
      dowryPaid: state.marriage?.dowryPaid,
      bankBalance: b.bank.balance,
      isMarried: m.isMarried(),
    };
  });

  check(
    'marriage: traditional wedding ceremony deducts ₦75,000 dowry and seals marriage with 100% closeness',
    marriedState.status === 'married' &&
      marriedState.isMarried &&
      marriedState.closeness === 100 &&
      marriedState.dowryPaid === 75000 &&
      bankBeforeWedding - marriedState.bankBalance === 75000,
    marriedState,
  );

  // 5. Enter residential home: spouse Figure exists in parlour and fridge has special meal
  await page.evaluate(() => window.game.hud.phoneModal.close());
  await wait(300);

  await enterInterior(page, 'interior_residence');
  await advance(page, 2.0);
  await wait(300);

  const homeSpouse = await page.evaluate(() => {
    const g = window.game;
    const res = g.world.interiorManager.residence;
    const m = g.modules.Marriage.get();
    const fridge = g.modules.Fridge.get();
    let hasSpouseFigure = false;
    res.group.traverse((obj) => {
      if (obj.name?.startsWith('worship ') && obj.name.includes('Zainab') && obj.visible) {
        hasSpouseFigure = true;
      }
    });
    const interactive = res.interactiveList.find((o) => o.id === 'home_spouse');
    // Trigger onNewDay to test home cooking
    m.onNewDay();
    const contents = fridge.contents();
    return {
      hasSpouseFigure,
      interactiveFound: !!interactive,
      interactiveName: interactive?.name,
      fridgeHasMeal: contents.some((i) => i.id === 'spouse_special_jollof'),
      spouseProfile: m.spouseProfile()?.name,
    };
  });

  await snap(page, 'marriage-4-home');

  check(
    'marriage: spouse lives inside residential home parlour as 3D Figure and stocks fridge with loving jollof meal',
    homeSpouse.hasSpouseFigure &&
      homeSpouse.interactiveFound &&
      homeSpouse.interactiveName?.includes('Zainab Bello') &&
      homeSpouse.fridgeHasMeal &&
      homeSpouse.spouseProfile === 'Zainab Bello',
    homeSpouse,
  );

  await leaveInterior(page);
}
