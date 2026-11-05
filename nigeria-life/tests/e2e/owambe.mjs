// Owambe app: Saturday parties, Aso-Ebi fabric, 3D party hall set with MC, Talking Drummer
// and Celebrant (Figure), and 3-round ShiftSkill Naira spraying on the dancefloor.
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
    b.data.stats.hunger = 45;
    b.saveData();
  });

  // 1. Open the Owambe app on the phone
  await page.evaluate(() => window.game.hud.phoneModal.openApp('owambe'));
  await wait(450);
  await snap(page, 'owambe-1-app');

  const initialView = await page.evaluate(() => {
    const cards = Array.from(document.querySelectorAll('#phone-screen-content [data-owambe-card]')).map((el) =>
      el.getAttribute('data-owambe-card'),
    );
    return {
      title: document.getElementById('phone-title')?.textContent?.trim(),
      cards,
      fame: window.game.modules.Owambe.get().fameEarned(),
      socialTitle: window.game.modules.Owambe.get().socialTitle(),
    };
  });

  check(
    'owambe: opens with all 4 Lagos Owambe halls (Freedom Park, New Afrika Shrine, Ivory Rooftop, Eko Grand Hotel)',
    initialView.title === 'Owambe' &&
      initialView.cards.length === 4 &&
      initialView.cards.includes('island-birthday') &&
      initialView.cards.includes('shrine-chieftaincy') &&
      initialView.cards.includes('rooftop-champagne') &&
      initialView.cards.includes('eko-grand-wedding') &&
      initialView.fame === 0 &&
      initialView.socialTitle === 'Party Guest',
    initialView,
  );

  // 2. Switch to Aso-Ebi tab and buy Royal Gold Lace & Fila (₦15,000)
  await tap(page, '#phone-screen-content button[data-set="ow.tab"][data-value="asoebi"]');
  const beforeAsoMoney = await money(page);
  await tap(page, '#phone-screen-content button[data-act="buy-asoebi"][data-id="gold-lace"]');
  await snap(page, 'owambe-2-asoebi');

  const afterAsoMoney = await money(page);
  const asoState = await page.evaluate(() => {
    const ow = window.game.modules.Owambe.get();
    const inv = window.game.hud.backend.getData().inventory;
    return {
      owned: ow.ownedAsoEbi(),
      equipped: ow.equippedAsoEbi()?.id ?? null,
      inBag: inv.some((i) => i.id === 'asoebi_gold-lace'),
    };
  });

  check(
    'owambe: buying Royal Gold Lace & Fila deducts ₦15,000 once, equips the Aso-Ebi, and adds it to the player bag',
    beforeAsoMoney.total - afterAsoMoney.total === 15000 &&
      asoState.owned.includes('gold-lace') &&
      asoState.equipped === 'gold-lace' &&
      asoState.inBag,
    { spent: beforeAsoMoney.total - afterAsoMoney.total, asoState },
  );

  // 3. Switch back to Book Hall tab and book Lagos Island Birthday Owambe at Freedom Park (₦35,000)
  await tap(page, '#phone-screen-content button[data-set="ow.tab"][data-value="parties"]');
  const beforeBookMoney = await money(page);
  await tap(page, '#phone-screen-content button[data-act="book-party"][data-tier="island-birthday"]');
  const afterBookMoney = await money(page);

  const bookedState = await page.evaluate(() => ({
    active: window.game.modules.Owambe.get().activeParty(),
    banner: document.getElementById('owambe-active-party')?.innerText.replace(/\s+/g, ' ').trim() ?? '',
  }));

  check(
    'owambe: booking Lagos Island Birthday Owambe at Freedom Park deducts ₦35,000 once and sets the active party banner',
    beforeBookMoney.total - afterBookMoney.total === 35000 &&
      bookedState.active?.tierId === 'island-birthday' &&
      bookedState.active?.venueKey === 'freedom-park' &&
      /Freedom Park/.test(bookedState.banner) &&
      /Alhaji Tunde Gold/.test(bookedState.banner),
    { spent: beforeBookMoney.total - afterBookMoney.total, bookedState },
  );

  await page.evaluate(() => window.game.hud.phoneModal.close());
  await wait(250);

  // 4. Enter Freedom Park and inspect the 3D Owambe Party Set (high-table, VIP carpet, MC, drummer, celebrant, flying Naira notes)
  await page.evaluate(() => {
    const g = window.game;
    const card = g.world.interactiveObjects.find((o) => o.id === 'roadside-freedom-park');
    g.player.stopMoving();
    g.player.mesh.position.set(card.interactionPoint.x, 0, card.interactionPoint.z);
    g.hud.showInteractionCard(card);
    document.getElementById('card-action-btn')?.click();
  });
  const entered = await playUntil(
    page,
    () =>
      window.game.world.interiorManager.currentInterior && !window.game.world.interiorManager.isTransitioning
        ? window.game.world.interiorManager.currentInterior.name
        : null,
    20,
  );
  await advance(page, 0.6);

  const venueInfo = await page.evaluate(() => {
    const g = window.game;
    const setGroup = g.scene.getObjectByName('owambe_set_freedom-park');
    const card = g.world.interiorManager.getActiveInteractiveObjects().find((o) => o.id === 'owambe_freedom-park');
    if (card) g.hud.showInteractionCard(card);
    const label = document.getElementById('card-action-btn')?.textContent ?? '';
    return {
      hasSet: !!setGroup && setGroup.children.length >= 5,
      children: setGroup ? setGroup.children.map((c) => c.name) : [],
      label,
    };
  });
  await snap(page, 'owambe-3-venue');

  check(
    'owambe: Freedom Park has the 3D Owambe VIP carpet, banquet high-table, MC, Talking Drummer, Celebrant, and spray card',
    entered === 'Freedom Park' &&
      venueInfo.hasSet &&
      venueInfo.children.includes('worship Alhaji Tunde Gold') &&
      venueInfo.children.includes('worship Talking Drummer') &&
      venueInfo.children.includes('worship Celebrant') &&
      venueInfo.children.includes('owambe-naira-notes-freedom-park') &&
      /Spray Naira at Lagos Island Birthday Owambe \(Freedom Park\) · ₦15,000/.test(venueInfo.label),
    { entered, venueInfo },
  );

  // 5. Act out the 3-round Naira spraying sequence on the VIP carpet with ShiftSkill
  const beforeSprayMoney = await money(page);
  const beforeNeeds = await page.evaluate(() => {
    const s = window.game.hud.backend.getData().stats;
    return { social: s.social, fun: s.fun, hunger: s.hunger };
  });

  await page.evaluate(() => {
    const g = window.game;
    const o = g.world.interiorManager.getActiveInteractiveObjects().find((x) => x.id === 'owambe_freedom-park');
    g.player.stopMoving();
    g.player.mesh.position.set(o.interactionPoint.x, 0, o.interactionPoint.z);
    g.hud.showInteractionCard(o);
    document.getElementById('card-action-btn')?.click();
    window.__owambeSweeps = 0;
  });

  await playUntil(
    page,
    () => {
      const s = window.game.modules.ShiftSkill.get();
      if (s.showing && s.tapped === null) {
        s.tapPerfect();
        window.__owambeSweeps = (window.__owambeSweeps || 0) + 1;
      }
      return window.game.player.actor.sequence ? null : true;
    },
    60,
  );
  await advance(page, 0.5);

  const afterSprayMoney = await money(page);
  const afterSpray = await page.evaluate(() => {
    const ow = window.game.modules.Owambe.get();
    const d = window.game.hud.backend.getData();
    return {
      sweeps: window.__owambeSweeps,
      fame: ow.fameEarned(),
      socialTitle: ow.socialTitle(),
      totalSprayed: ow.totalSprayed(),
      active: ow.activeParty(),
      history: ow.history(),
      social: d.stats.social,
      fun: d.stats.fun,
      hunger: d.stats.hunger,
      hasSouvenir: d.inventory.some((i) => i.id === 'owambe_jollof_pack'),
    };
  });

  // Fame = 15 base + 5 Gold Lace Aso-Ebi bonus + 10 3-star ShiftSkill bonus = 30
  check(
    'owambe: spraying Naira on the VIP carpet spends ₦15,000 once, scores 3 stars, awards +30 Owambe Fame, raises social/fun/hunger, and gives the Party Jollof Souvenir Pack',
    afterSpray.sweeps === 3 &&
      beforeSprayMoney.total - afterSprayMoney.total === 15000 &&
      afterSpray.fame === 30 &&
      afterSpray.socialTitle === 'Owambe Celebrant' &&
      afterSpray.totalSprayed === 15000 &&
      afterSpray.active === null &&
      afterSpray.history.length === 1 &&
      afterSpray.social > beforeNeeds.social &&
      afterSpray.fun > beforeNeeds.fun &&
      afterSpray.hunger > beforeNeeds.hunger &&
      afterSpray.hasSouvenir,
    { spent: beforeSprayMoney.total - afterSprayMoney.total, beforeNeeds, afterSpray },
  );

  // 6. Open the Guestbook tab in the Owambe app and verify history card
  await page.evaluate(() => window.game.hud.phoneModal.openApp('owambe'));
  await wait(300);
  await tap(page, '#phone-screen-content button[data-set="ow.tab"][data-value="history"]');
  await snap(page, 'owambe-4-guestbook');

  const guestbookText = await page.evaluate(
    () => document.querySelector('#phone-screen-content [data-owambe-history="island-birthday"]')?.innerText.replace(/\s+/g, ' ').trim() ?? '',
  );
  check(
    'owambe: the Guestbook tab records the completed Freedom Park Owambe with ★★★, +30 Fame, and ₦15,000 sprayed',
    /Lagos Island Birthday Owambe ★★★/.test(guestbookText) &&
      /\+30 Fame/.test(guestbookText) &&
      /Sprayed ₦15,000/.test(guestbookText),
    { guestbookText },
  );

  check('owambe: no errors in the page', log.errors.length === 0, log.errors.slice(0, 5));
  await ctx.close();
}

