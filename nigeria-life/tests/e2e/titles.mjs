// Chieftaincy & High Society Titles app:
// - Verifying society fame and wealth requirements
// - Royal palace investiture ceremony with Kabiyesi Oba of Lagos at Freedom Park
// - Awarding sacred regalia (royal coral beads, irukere, beaded cap, staff)
// - Setting active title and daily tribute
// - 3D Palace Dais with Kabiyesi, High Chief Elder, and Praise Singer
import { open, newPlayer, closeDialogs, wait, enterInterior, advance, pressSteady } from './lib.mjs';

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
  const { page } = await open(ctx);
  await page.setViewport({ width: 400, height: 820 });
  await closeDialogs(page);

  await page.evaluate(() => {
    const b = window.game.hud.backend;
    b.data.bank.balance = 500_000;
    b.data.stats.streetCred = 0;
    b.data.reputation = 0;
    b.saveData();
    window.game.modules.Chieftaincy.get().resetForTests();
  });

  // 1. Open Titles app on phone
  await page.evaluate(() => window.game.hud.phoneModal.openApp('titles'));
  await wait(450);
  await snap(page, 'titles-1-app');

  const initialView = await page.evaluate(() => {
    const cards = Array.from(document.querySelectorAll('#phone-screen-content [data-title-card]')).map((el) =>
      el.getAttribute('data-title-card'),
    );
    const otunbaBtn = document.querySelector('button[data-title="otunba"]');
    return {
      title: document.getElementById('phone-title')?.textContent?.trim(),
      cards,
      activeTitle: window.game.modules.Chieftaincy.get().activeTitleId(),
      conferredCount: window.game.modules.Chieftaincy.get().conferred().length,
      otunbaDisabled: otunbaBtn?.hasAttribute('disabled') ?? false,
      otunbaBtnText: otunbaBtn?.textContent?.trim(),
    };
  });

  check(
    'titles: opens on phone showing 4 royal titles, with investiture blocked when Fame < 25',
    initialView.title === 'Titles' &&
      initialView.cards.includes('otunba') &&
      initialView.cards.includes('aare') &&
      initialView.cards.includes('omoba') &&
      initialView.cards.includes('gbobaniyi') &&
      initialView.activeTitle === null &&
      initialView.conferredCount === 0 &&
      initialView.otunbaDisabled &&
      initialView.otunbaBtnText?.includes('Need 25 Fame'),
    initialView,
  );

  // 2. Grant player 35 Society Fame, refreshing app and conferring Otunba of Lagos (₦250,000)
  await page.evaluate(() => {
    const b = window.game.hud.backend;
    b.data.stats.streetCred = 35;
    b.saveData();
    window.game.hud.phoneModal.openApp('titles');
  });
  await wait(350);

  const walletBefore = await page.evaluate(() => {
    const d = window.game.hud.backend.getData();
    return d.bank.balance + d.walletCash;
  });
  await tap(page, 'button[data-act="confer-title"][data-title="otunba"]');
  await wait(350);
  await snap(page, 'titles-2-investiture');

  const conferredState = await page.evaluate(() => {
    const c = window.game.modules.Chieftaincy.get();
    const b = window.game.hud.backend.getData();
    return {
      activeTitle: c.activeTitleId(),
      isOtunba: c.isConferred('otunba'),
      totalFunds: b.bank.balance + b.walletCash,
      hasRegaliaInBag: b.inventory.some((i) => i.id === 'regalia_beads'),
      activeBannerText: document.querySelector('.tt-active-banner')?.textContent?.trim(),
    };
  });

  check(
    'titles: takes Otunba of Lagos title for ₦250,000 offering, confers royal beads, and sets active title',
    conferredState.activeTitle === 'otunba' &&
      conferredState.isOtunba &&
      walletBefore - conferredState.totalFunds === 250000 &&
      conferredState.hasRegaliaInBag &&
      conferredState.activeBannerText?.includes('Otunba of Lagos'),
    conferredState,
  );

  // 3. Inspect Royal Regalia tab
  await tap(page, 'button[data-set="tt.tab"][data-value="regalia"]');
  await wait(300);
  await snap(page, 'titles-3-regalia');

  const regaliaTab = await page.evaluate(() => {
    const text = document.getElementById('phone-screen-content')?.textContent ?? '';
    return {
      hasBeadsOwned: text.includes('Royal Coral Beads') && text.includes('Owned In Bag'),
      hasIrukereUnconferred: text.includes('Irukere') && text.includes('Unconferred'),
      hasStaffUnconferred: text.includes('Royal Staff') && text.includes('Unconferred'),
    };
  });

  check(
    'titles: regalia tab shows Royal Coral Beads owned in bag, other sacred insignia unconferred',
    regaliaTab.hasBeadsOwned && regaliaTab.hasIrukereUnconferred && regaliaTab.hasStaffUnconferred,
    regaliaTab,
  );

  // Close phone
  await page.evaluate(() => window.game.hud.phoneModal.close());
  await wait(250);

  // 4. Enter Freedom Park and verify 3D Palace Court dais and figures
  await enterInterior(page, 'interior_place_freedom-park');
  await advance(page, 1.0);
  await snap(page, 'titles-4-palace');

  const palaceScene = await page.evaluate(() => {
    const g = window.game;
    const daisMesh = g.scene.getObjectByName('palace_dais_mesh');
    const kabiyesi = g.scene.getObjectByName('kabiyesi_oba');
    const highChief = g.scene.getObjectByName('high_chief_elder');
    const griot = g.scene.getObjectByName('royal_griot');
    const action = g.world.interiorManager.getActiveInteractiveObjects().find((o) => o.id === 'palace_investiture');
    let actionBtnText = '';
    if (action) {
      g.hud.showInteractionCard(action);
      actionBtnText = document.getElementById('card-action-btn')?.textContent?.trim() ?? '';
    }
    return {
      hasDaisMesh: !!daisMesh,
      hasKabiyesi: !!kabiyesi,
      hasHighChief: !!highChief,
      hasGriot: !!griot,
      hasInvestitureAction: !!action,
      actionBtnText,
    };
  });

  check(
    'titles: Freedom Park interior features 3D Palace Dais with Kabiyesi Oba, High Chief, Royal Griot, and interactive homage action',
    palaceScene.hasDaisMesh &&
      palaceScene.hasKabiyesi &&
      palaceScene.hasHighChief &&
      palaceScene.hasGriot &&
      palaceScene.hasInvestitureAction &&
      palaceScene.actionBtnText.includes('Otunba'),
    palaceScene,
  );
}

