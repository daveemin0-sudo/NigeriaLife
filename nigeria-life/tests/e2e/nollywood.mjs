// Nollywood: casting calls on the phone, a three-take scene audition scored like ShiftSkill,
// a location shoot on a 3D film set inside a real PLACE_SPECS venue, the film's release with
// box-office takings over the next five real days, and the player's filmography and rising Fame.
import path from 'node:path';
import { open, newPlayer, closeDialogs, advance, wait, playUntil, money } from './lib.mjs';

const DAY_MS = 86_400_000;
const SHOT_DIR = process.env.NL_SCREENSHOT_DIR || '';
const snap = async (page, name) => {
  if (!SHOT_DIR) return;
  await page.screenshot({ path: path.join(SHOT_DIR, `${name}.png`) });
};

const realClick = async (page, selector) => {
  const box = await page.evaluate((sel) => {
    const el = document.querySelector(sel);
    if (!el) return null;
    el.scrollIntoView({ block: 'center', inline: 'center' });
    const r = el.getBoundingClientRect();
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;
    const top = document.elementFromPoint(cx, cy);
    return {
      x: cx,
      y: cy,
      hit: !!top && (top === el || el.contains(top) || top.contains(el)),
    };
  }, selector);
  if (!box || !box.hit) throw new Error(`Element not clickable via elementFromPoint: ${selector}`);
  await page.mouse.click(box.x, box.y);
  await wait(250);
};

export async function run(browser, check) {
  const ctx = await newPlayer(browser);
  const { page, log } = await open(ctx, { life: true });
  await closeDialogs(page);
  await page.setViewport({ width: 400, height: 820 });

  let clockNow = Date.now();
  await page.evaluate((t) => {
    window.game.modules.Nollywood.now = () => window.__nwNow;
    window.__nwNow = t;
  }, clockNow);

  // 1. Open phone & Nollywood app via real mouse click on 400x820 phone viewport
  await page.evaluate(() => window.game.hud.phoneModal.openApp('nollywood'));
  await wait(400);
  await snap(page, 'nollywood-1-casting');

  const initialView = await page.evaluate(() => {
    const cards = [...document.querySelectorAll('#phone-screen-content [data-casting]')].map((el) => ({
      id: el.getAttribute('data-casting'),
      disabled: !!el.querySelector('button[data-act="audition"]')?.disabled || !el.querySelector('button[data-act="audition"]'),
      text: el.innerText.replace(/\s+/g, ' ').trim(),
    }));
    return {
      fame: window.game.modules.Nollywood.get().fame(),
      cards,
    };
  });
  check(
    'nollywood: casting calls list open productions at real venues and lock higher-tier films until Fame rises',
    initialView.fame === 0 &&
      initialView.cards.length === 5 &&
      initialView.cards.some((c) => c.id === 'blood-on-the-lagoon' && !c.disabled && /Marina Towers/.test(c.text)) &&
      initialView.cards.some((c) => c.id === 'midnight-at-the-shrine' && c.disabled && /Needs 15 Fame/.test(c.text)),
    initialView
  );

  // 2. Audition: 3-take scene test scored like ShiftSkill
  await realClick(page, '#phone-screen-content button[data-act="audition"][data-id="blood-on-the-lagoon"]');
  await snap(page, 'nollywood-2-audition');
  const stageOpen = await page.evaluate(() => ({
    stage: !!document.getElementById('nw-audition-stage'),
    bar: !!document.getElementById('nw-audition-bar'),
    line: document.querySelector('#nw-audition-stage .nw-line')?.textContent ?? '',
  }));
  check(
    'nollywood: starting an audition opens the 3-take scene test with script lines and a sweeping timing bar',
    stageOpen.stage && stageOpen.bar && /briefcase/.test(stageOpen.line),
    stageOpen
  );

  for (let t = 0; t < 3; t++) {
    await page.evaluate(() => window.game.modules.Nollywood.get().tapPerfect());
    await wait(200);
  }
  await page.evaluate(() => window.game.hud.phoneModal.openApp('nollywood'));
  await wait(250);

  const castState = await page.evaluate(() => ({
    active: window.game.modules.Nollywood.get().activeRole(),
    callSheet: document.getElementById('nw-active-role')?.innerText.replace(/\s+/g, ' ').trim() ?? '',
  }));
  check(
    'nollywood: completing the 3-take audition scores 3 stars and issues the call sheet for Marina Towers',
    castState.active?.filmId === 'blood-on-the-lagoon' &&
      castState.active?.auditionStars === 3 &&
      /Marina Towers/.test(castState.callSheet) &&
      /Inspector Tunde/.test(castState.callSheet),
    castState
  );

  await page.evaluate(() => window.game.hud.phoneModal.close());
  await wait(250);

  // 3. Enter Marina Towers and inspect the 3D Nollywood set in the venue
  await page.evaluate(() => {
    const g = window.game;
    const card = g.world.interactiveObjects.find((o) => o.id === 'roadside-marina-towers');
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
    20
  );
  await advance(page, 0.5);

  const setInfo = await page.evaluate(() => {
    const g = window.game;
    const setGroup = g.scene.getObjectByName('nollywood marina-towers');
    const card = g.world.interiorManager.getActiveInteractiveObjects().find((o) => o.id === 'nollywood_marina-towers');
    if (card) g.hud.showInteractionCard(card);
    const label = document.getElementById('card-action-btn')?.textContent ?? '';
    return {
      hasSet: !!setGroup && setGroup.children.length >= 4,
      children: setGroup ? setGroup.children.map((c) => c.name) : [],
      label,
    };
  });
  await snap(page, 'nollywood-3-set');
  check(
    'nollywood: Marina Towers has the 3D film set (camera rig, director, cameraman, signboard) and the shoot card',
    entered === 'Marina Towers' &&
      setInfo.hasSet &&
      setInfo.children.includes('worship Kunle Adebayo') &&
      setInfo.children.includes('worship Camera Operator') &&
      /Shoot "Blood on the Lagoon" \(Inspector Tunde\) · ₦45,000/.test(setInfo.label),
    { entered, setInfo }
  );

  // 4. Act out the 3-take location shoot on set with ShiftSkill
  const beforeShootMoney = await money(page);
  await page.evaluate(() => {
    const g = window.game;
    const o = g.world.interiorManager.getActiveInteractiveObjects().find((x) => x.id === 'nollywood_marina-towers');
    g.player.stopMoving();
    g.player.mesh.position.set(o.interactionPoint.x, 0, o.interactionPoint.z);
    g.hud.showInteractionCard(o);
    document.getElementById('card-action-btn')?.click();
    window.__shootSweeps = 0;
  });

  await playUntil(
    page,
    () => {
      const s = window.game.modules.ShiftSkill.get();
      if (s.showing && !window.__tappedRound) {
        window.__tappedRound = true;
        s.tapPerfect();
        window.__shootSweeps = (window.__shootSweeps || 0) + 1;
      } else if (!s.showing) {
        window.__tappedRound = false;
      }
      return window.game.player.actor.sequence ? null : true;
    },
    60
  );
  await advance(page, 0.5);

  const afterShootMoney = await money(page);
  const afterShootState = await page.evaluate(() => {
    const nw = window.game.modules.Nollywood.get();
    return {
      sweeps: window.__shootSweeps,
      fame: nw.fame(),
      fameTitle: nw.fameTitle(),
      active: nw.activeRole(),
      films: nw.filmography(),
    };
  });
  // 45,000 base + 13,500 (30% 3-star tip) = 58,500; Fame: 15 base + 10 (3-star bonus) = 25
  check(
    'nollywood: shooting the scene on set pays the wrap fee + 3-star bonus (₦58,500), raises Fame to 25, and releases the film',
    afterShootState.sweeps >= 2 &&
      afterShootMoney.total - beforeShootMoney.total === 58500 &&
      afterShootState.fame === 25 &&
      afterShootState.fameTitle === 'Rising Actor' &&
      afterShootState.active === null &&
      afterShootState.films.length === 1 &&
      afterShootState.films[0].dailyTaking === 27000 &&
      afterShootState.films[0].daysPaid === 0,
    { gained: afterShootMoney.total - beforeShootMoney.total, afterShootState }
  );

  // 5. Box-office takings over the next 5 real days (₦27,000/day × 5 days = ₦135,000)
  const beforeRoyalties = await money(page);
  clockNow += 2 * DAY_MS + 1000;
  await page.evaluate(async (t) => {
    window.__nwNow = t;
    await window.game.modules.Nollywood.get().checkTakings();
  }, clockNow);
  const afterDay2Money = await money(page);
  const day2Film = await page.evaluate(() => window.game.modules.Nollywood.get().filmography()[0]);
  check(
    'nollywood: two real days after release, two days of box-office takings (₦54,000) are paid into the bank',
    afterDay2Money.total - beforeRoyalties.total === 54000 &&
      day2Film.daysPaid === 2 &&
      day2Film.totalTakings === 54000,
    { gained: afterDay2Money.total - beforeRoyalties.total, day2Film }
  );

  clockNow += 4 * DAY_MS;
  await page.evaluate(async (t) => {
    window.__nwNow = t;
    await window.game.modules.Nollywood.get().checkTakings();
  }, clockNow);
  const afterDay6Money = await money(page);
  const day6Film = await page.evaluate(() => window.game.modules.Nollywood.get().filmography()[0]);
  check(
    'nollywood: over the full 5-day cinema run, all 5 days of takings (₦135,000 total) are paid once and stop after day 5',
    afterDay6Money.total - beforeRoyalties.total === 135000 &&
      day6Film.daysPaid === 5 &&
      day6Film.totalTakings === 135000,
    { totalRoyalties: afterDay6Money.total - beforeRoyalties.total, day6Film }
  );

  // 6. Open Filmography tab on the phone and verify UI & unlocked higher-fame casting calls
  await page.evaluate(() => window.game.hud.phoneModal.openApp('nollywood'));
  await wait(300);
  const unlockedShrine = await page.evaluate(() => {
    const btn = document.querySelector('#phone-screen-content button[data-act="audition"][data-id="midnight-at-the-shrine"]');
    return !!btn && !btn.disabled;
  });
  await realClick(page, '#phone-screen-content button[data-set="nw.tab"][data-value="films"]');
  await page.evaluate(() => document.querySelectorAll('.game-toast, #game-toast-container').forEach((el) => el.remove()));
  await wait(150);
  await snap(page, 'nollywood-4-filmography');
  const filmographyText = await page.evaluate(
    () => document.querySelector('#phone-screen-content [data-film="blood-on-the-lagoon"]')?.innerText.replace(/\s+/g, ' ').trim() ?? ''
  );
  check(
    'nollywood: rising Fame unlocks higher-tier casting calls and the Filmography tab shows the completed cinema run and takings',
    unlockedShrine &&
      /Blood on the Lagoon/.test(filmographyText) &&
      /★★★/.test(filmographyText) &&
      /Day 5 of 5 \(Complete\)/.test(filmographyText) &&
      /₦135,000/.test(filmographyText),
    { unlockedShrine, filmographyText }
  );

  check('nollywood: no errors in the page', log.errors.length === 0, log.errors.slice(0, 5));
  await ctx.close();
}
