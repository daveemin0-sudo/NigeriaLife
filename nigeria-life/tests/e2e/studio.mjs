// Studio app: Afrobeats recording sessions in Studio B at Naija Radio House, Lagos Top 10 Chart,
// 5-day streaming royalties, and live headline release concerts at Lagos venues.
import { open, newPlayer, closeDialogs, wait, advance, playUntil, money, pressSteady } from './lib.mjs';

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
    b.data.stats.social = 40;
    b.data.stats.fun = 40;
    b.saveData();
    window.game.modules.Studio.get().resetForTests();
  });

  // 1. Open Studio app on the phone
  await page.evaluate(() => window.game.hud.phoneModal.openApp('studio'));
  await wait(450);
  await snap(page, 'studio-1-app');

  const initialView = await page.evaluate(() => {
    const cards = Array.from(document.querySelectorAll('#phone-screen-content [data-studio-card]')).map((el) =>
      el.getAttribute('data-studio-card'),
    );
    const lockedBtn = document.querySelector(
      '#phone-screen-content button[data-act="book-studio"][data-track="lekki-log-drum"]',
    );
    return {
      title: document.getElementById('phone-title')?.textContent?.trim(),
      cards,
      fame: window.game.modules.Studio.get().fame(),
      lockedDisabled: lockedBtn?.hasAttribute('disabled') ?? false,
      lockedText: lockedBtn?.textContent?.trim() ?? '',
    };
  });

  check(
    'studio: opens with 5 Afrobeats tracks and locks Lekki Log Drum behind 15 Music Fame',
    initialView.title === 'Studio' &&
      initialView.cards.length === 5 &&
      initialView.cards.includes('lagos-sunrise') &&
      initialView.cards.includes('lekki-log-drum') &&
      initialView.cards.includes('grammy-nights-eko') &&
      initialView.fame === 0 &&
      initialView.lockedDisabled &&
      /Needs 15 Music Fame/.test(initialView.lockedText),
    initialView,
  );

  // 2. Book Studio B for "Eko Sunrise" (₦25,000)
  const beforeBookMoney = await money(page);
  await tap(page, '#phone-screen-content button[data-act="book-studio"][data-track="lagos-sunrise"]');
  const afterBookMoney = await money(page);

  const bookedState = await page.evaluate(() => ({
    active: window.game.modules.Studio.get().activeSession(),
    banner: document.getElementById('studio-active-session')?.innerText.replace(/\s+/g, ' ').trim() ?? '',
  }));

  check(
    'studio: booking Studio B for Eko Sunrise deducts ₦25,000 once and displays the active session banner for Naija Radio House',
    beforeBookMoney.total - afterBookMoney.total === 25000 &&
      bookedState.active?.trackId === 'lagos-sunrise' &&
      /Naija Radio House/.test(bookedState.banner) &&
      /Sarz-Beatz/.test(bookedState.banner),
    { spent: beforeBookMoney.total - afterBookMoney.total, bookedState },
  );

  await page.evaluate(() => window.game.hud.phoneModal.close());
  await wait(250);

  // 3. Enter Naija Radio House and inspect the 3D Studio B Vocal Booth & Producer Mixing Console
  await page.evaluate(() => {
    const g = window.game;
    const card = g.world.interactiveObjects.find((o) => o.id === 'roadside-radio-house');
    g.player.stopMoving();
    g.player.mesh.position.set(card.interactionPoint.x, 0, card.interactionPoint.z);
    g.hud.showInteractionCard(card);
    document.getElementById('card-action-btn')?.click();
  });
  const enteredRadio = await playUntil(
    page,
    () =>
      window.game.world.interiorManager.currentInterior && !window.game.world.interiorManager.isTransitioning
        ? window.game.world.interiorManager.currentInterior.name
        : null,
    20,
  );
  await advance(page, 0.6);

  const boothInfo = await page.evaluate(() => {
    const g = window.game;
    const boothGroup = g.scene.getObjectByName('studio-booth-radio-house');
    const card = g.world.interiorManager.getActiveInteractiveObjects().find((o) => o.id === 'studio_vocal_booth');
    if (card) g.hud.showInteractionCard(card);
    const label = document.getElementById('card-action-btn')?.textContent ?? '';
    return {
      hasBooth: !!boothGroup && boothGroup.children.length >= 4,
      children: boothGroup ? boothGroup.children.map((c) => c.name) : [],
      label,
    };
  });
  await snap(page, 'studio-2-booth');

  check(
    'studio: Naija Radio House contains the 3D Studio B vocal booth, producer Sarz-Beatz, soundwave bars, and recording card',
    enteredRadio === 'Naija Radio House' &&
      boothInfo.hasBooth &&
      boothInfo.children.includes('studio-booth-rig') &&
      boothInfo.children.includes('worship Sarz-Beatz') &&
      boothInfo.children.includes('studio-soundwaves-radio-house') &&
      /Record "Eko Sunrise" \(Sarz-Beatz\) · \+₦35,000 advance/.test(boothInfo.label),
    { enteredRadio, boothInfo },
  );

  // 4. Act out the 3-take vocal recording session in Studio B with ShiftSkill
  const beforeRecMoney = await money(page);
  await page.evaluate(() => {
    const g = window.game;
    const o = g.world.interiorManager.getActiveInteractiveObjects().find((x) => x.id === 'studio_vocal_booth');
    g.player.stopMoving();
    g.player.mesh.position.set(o.interactionPoint.x, 0, o.interactionPoint.z);
    g.hud.showInteractionCard(o);
    document.getElementById('card-action-btn')?.click();
    window.__studioSweeps = 0;
  });

  await playUntil(
    page,
    () => {
      const s = window.game.modules.ShiftSkill.get();
      if (s.showing && s.tapped === null) {
        s.tapPerfect();
        window.__studioSweeps = (window.__studioSweeps || 0) + 1;
      }
      return window.game.player.actor.sequence ? null : true;
    },
    60,
  );
  await advance(page, 0.5);

  const afterRecMoney = await money(page);
  const afterRec = await page.evaluate(() => {
    const st = window.game.modules.Studio.get();
    return {
      sweeps: window.__studioSweeps,
      fame: st.fame(),
      active: st.activeSession(),
      discography: st.discography(),
      chart: st.topTenChart(),
    };
  });

  // 3-star advance = 35,000 + 10,500 = 45,500; fame = 15 + 10 = 25; dailyRoyalty = 14,000 * 1.5 = 21,000
  check(
    'studio: recording 3 perfect takes in Studio B pays ₦45,500 (₦35,000 advance + ₦10,500 3★ bonus), awards 25 Music Fame, and charts Eko Sunrise on the Lagos Top 10',
    afterRec.sweeps === 3 &&
      afterRecMoney.total - beforeRecMoney.total === 45500 &&
      afterRec.fame === 25 &&
      afterRec.active === null &&
      afterRec.discography.length === 1 &&
      afterRec.discography[0].stars === 3 &&
      afterRec.discography[0].dailyRoyalty === 21000 &&
      afterRec.chart.some((c) => c.isPlayer && c.title === 'Eko Sunrise'),
    { earned: afterRecMoney.total - beforeRecMoney.total, afterRec },
  );

  // 5. Advance 2 real days of streaming royalties (₦21,000/day × 2 = ₦42,000) and inspect Lagos Top 10 Chart
  const beforeRoyaltyMoney = await money(page);
  const royaltyPaid = await page.evaluate(async () => {
    const Studio = window.game.modules.Studio;
    const base = Studio.now();
    Studio.now = () => base + 2 * 86_400_000 + 5000;
    return await Studio.get().checkRoyalties();
  });
  const afterRoyaltyMoney = await money(page);

  await page.evaluate(() => window.game.hud.phoneModal.openApp('studio'));
  await wait(300);
  await tap(page, '#phone-screen-content button[data-set="ms.tab"][data-value="chart"]');
  await snap(page, 'studio-3-chart');

  check(
    'studio: 2 elapsed real days of streaming pay ₦42,000 (2 × ₦21,000) into the bank once',
    royaltyPaid === 42000 && afterRoyaltyMoney.total - beforeRoyaltyMoney.total === 42000,
    { royaltyPaid, delta: afterRoyaltyMoney.total - beforeRoyaltyMoney.total },
  );

  await page.evaluate(() => window.game.hud.phoneModal.close());
  await wait(250);

  // 6. Leave Naija Radio House, enter Freedom Park, and perform the Headline Release Show on the 3D stage
  await page.evaluate(async () => {
    const g = window.game;
    if (g.world.interiorManager.isPlayerInside()) {
      await g.world.interiorManager.exitCurrentInterior(g.player, g.cameraManager, g.hud, g.world);
    }
    const card = g.world.interactiveObjects.find((o) => o.id === 'roadside-freedom-park');
    g.player.stopMoving();
    g.player.mesh.position.set(card.interactionPoint.x, 0, card.interactionPoint.z);
    g.hud.showInteractionCard(card);
    document.getElementById('card-action-btn')?.click();
  });
  const enteredFreedom = await playUntil(
    page,
    () =>
      window.game.world.interiorManager.currentInterior?.name === 'Freedom Park' &&
      !window.game.world.interiorManager.isTransitioning
        ? true
        : null,
    20,
  );
  await advance(page, 0.6);

  const beforeShowMoney = await money(page);
  await page.evaluate(() => {
    const g = window.game;
    const o = g.world.interiorManager.getActiveInteractiveObjects().find((x) => x.id === 'studio_concert_freedom-park');
    g.player.stopMoving();
    g.player.mesh.position.set(o.interactionPoint.x, 0, o.interactionPoint.z);
    g.hud.showInteractionCard(o);
    document.getElementById('card-action-btn')?.click();
    window.__concertSweeps = 0;
  });
  await snap(page, 'studio-4-concert');

  await playUntil(
    page,
    () => {
      const s = window.game.modules.ShiftSkill.get();
      if (s.showing && s.tapped === null) {
        s.tapPerfect();
        window.__concertSweeps = (window.__concertSweeps || 0) + 1;
      }
      return window.game.player.actor.sequence ? null : true;
    },
    60,
  );
  await advance(page, 0.5);

  const afterShowMoney = await money(page);
  const afterShow = await page.evaluate(() => {
    const st = window.game.modules.Studio.get();
    return {
      sweeps: window.__concertSweeps,
      fame: st.fame(),
      song: st.discography()[0],
      topRank: st.topTenChart()[0],
    };
  });

  // Headline concert 3★ = 40,000 + 10,000 = 50,000; streams += 360,000 -> #1 on Lagos Top 10 Chart!
  check(
    'studio: performing the Headline Live Show at Freedom Park pays ₦50,000 once, boosts Eko Sunrise to #1 on the Lagos Top 10 Chart, and raises Music Fame to 50',
    Boolean(enteredFreedom) &&
      afterShow.sweeps === 3 &&
      afterShowMoney.total - beforeShowMoney.total === 50000 &&
      afterShow.song?.concertDone === true &&
      afterShow.fame === 50 &&
      afterShow.topRank?.isPlayer === true &&
      afterShow.topRank?.rank === 1,
    { earned: afterShowMoney.total - beforeShowMoney.total, afterShow },
  );

  check('studio: no errors in the page', log.errors.length === 0, log.errors.slice(0, 5));
  await ctx.close();
}

