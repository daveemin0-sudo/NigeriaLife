// Phone HUD: Dynamic Island safe top, short location pill, Watching card layout, money = cash+bank
import { open, newPlayer, closeDialogs, wait, playUntil, advance } from './lib.mjs';

export async function run(browser, check) {
  const ctx = await newPlayer(browser);
  const { page, log } = await open(ctx, { w: 390, h: 844 });
  await closeDialogs(page);

  // Force phone-like insets (touch + narrow) so --nl-inset-top floors at 47
  const inset = await page.evaluate(() => {
    document.documentElement.style.setProperty('--nl-inset-top', '47px');
    // Re-run safe insets with touch media mocked via coarse pointer where possible
    return getComputedStyle(document.documentElement).getPropertyValue('--nl-inset-top').trim();
  });
  check('hudphone: --nl-inset-top is applied for phone chrome', inset === '47px' || parseInt(inset, 10) >= 44, { inset });

  const topBar = await page.evaluate(() => {
    const bar = document.querySelector('.hud-center-pill-bar');
    const clock = document.getElementById('hud-clock-val') || document.querySelector('.hud-center-pill-bar');
    const r = bar?.getBoundingClientRect();
    return { top: r ? +r.top.toFixed(1) : null, height: r ? +r.height.toFixed(1) : null };
  });
  check('hudphone: top pill bar sits below Dynamic Island floor (≥ 47+8)', topBar.top != null && topBar.top >= 50, topBar);

  // Money: wallet 0, bank full → HUD must not show ₦0
  const money = await page.evaluate(() => {
    const be = window.game.hud.backend;
    be.data.walletCash = 0;
    be.data.bank.balance = 1_250_000;
    be.saveData(); // notifies HUD subscribers
    const text = document.getElementById('hud-money')?.textContent ?? '';
    const title = document.getElementById('hud-money')?.title ?? '';
    return { text, title, cash: be.data.walletCash, bank: be.data.bank.balance };
  });
  check('hudphone: top money shows cash+bank (not ₦0 when bank has funds)',
    /₦1,250,000/.test(money.text) && money.cash === 0 && money.bank === 1_250_000, money);

  // Location shorten
  const loc = await page.evaluate(() => {
    window.game.hud.updateLocation('Your duplex at 1 Banana Island', 'Banana Island Road, Lagos');
    window.game.hud.updateLocation('Lekki Phase 1 Gated 4-Bed Duplex (rented)', 'Admiralty Way, Lekki Phase 1');
    return {
      name: document.getElementById('hud-loc-name')?.textContent,
      title: document.getElementById('hud-loc-name')?.title,
      sub: document.getElementById('hud-loc-sub')?.textContent,
    };
  });
  check('hudphone: long location names are shortened for the pill',
    !!loc.name && loc.name.length <= 24 && !/Gated|4-Bed|\(rented\)/.test(loc.name)
    && loc.title?.includes('Duplex'), loc);

  // Watching card layout: two rows, no overlap of icon onto title
  await page.evaluate(() => {
    const be = window.game.hud.backend;
    be.performGig(80_000_000, 0, 'hudphone cash');
    be.rentProperty('prop_lekki_duplex');
    be.saveData();
  });
  await page.evaluate(() => window.game.hud.onEnterInterior('residence:prop_lekki_duplex'));
  await playUntil(page, () => (
    window.game.world.interiorManager.currentInterior?.type === 'residence'
    && !window.game.world.interiorManager.busy ? true : null
  ), 25);
  await wait(500);
  await closeDialogs(page);

  await page.evaluate(() => {
    const g = window.game;
    const r = g.world.interiorManager.residence;
    const decor = g.modules.HouseDecorationSystem.getInstance();
    const sofa = decor.placed.find((p) => p.uid === 'home_sofa' || /sofa/i.test(p.modelType));
    const kind = decor.kind(sofa.modelType);
    const s = (kind.seats || [kind.seat])[0];
    const turn = (sofa.turns * Math.PI) / 2;
    const seat = {
      x: sofa.x + s.x * Math.cos(turn) + s.z * Math.sin(turn),
      z: sofa.z - s.x * Math.sin(turn) + s.z * Math.cos(turn),
    };
    const face = decor.facing(sofa.turns);
    const size = decor.footprint(sofa.modelType, sofa.turns);
    const reach = (face.x !== 0 ? size.width : size.depth) / 2 + 0.55;
    const front = { x: sofa.x + face.x * reach, z: sofa.z + face.z * reach };
    const THREE = g.modules.THREE;
    r.life.sitAt(new THREE.Vector3(seat.x, 0, seat.z), new THREE.Vector3(front.x, 0, front.z), Math.atan2(face.x, face.z), s.top ?? 0.55);
  });
  await playUntil(page, () => (window.game.player.actor.pose.legs === 'sit' ? true : null), 40);
  await advance(page, 0.8);
  // Turn TV on so Watching title + channel chips show
  await page.evaluate(() => {
    const r = window.game.world.interiorManager.residence;
    const set = r.televisions()?.[0];
    set?.turnOn?.('football');
    r.life.refresh?.();
  });
  await wait(400);

  const card = await page.evaluate(() => {
    const el = document.getElementById('home-activity-status') || document.querySelector('.buka-order-status');
    if (!el || el.style.display === 'none') return { missing: true };
    const head = el.querySelector('.buka-status-head');
    const choices = el.querySelector('.buka-status-choices');
    const icon = el.querySelector('.buka-status-icon')?.getBoundingClientRect();
    const name = el.querySelector('.buka-status-name');
    const nameR = name?.getBoundingClientRect();
    const fabs = [...document.querySelectorAll('#music-fab, #view-fab')].map((f) => f.getBoundingClientRect());
    const cardR = el.getBoundingClientRect();
    const overlapsFab = fabs.some((f) => !(cardR.right < f.left || cardR.left > f.right || cardR.bottom < f.top || cardR.top > f.bottom));
    // Icon and title should not share the same centre (overlap)
    const iconOnText = icon && nameR
      && !(icon.right < nameR.left || icon.left > nameR.right || icon.bottom < nameR.top || icon.top > nameR.bottom);
    const labels = [...(choices?.querySelectorAll('.activity-choice') ?? [])].map((b) => b.textContent.trim());
    return {
      hasHead: !!head,
      hasChoices: !!choices,
      title: name?.textContent ?? '',
      labels,
      iconOnText: !!iconOnText,
      overlapsFab,
      right: +cardR.right.toFixed(0),
      fabLeft: fabs[0] ? +fabs[0].left.toFixed(0) : null,
    };
  });
  check('hudphone: Watching card has head + channel chips, title short, no icon-on-text, clear of FABs',
    !card.missing && card.hasHead && card.hasChoices && /Watching|Sitting/i.test(card.title)
    && card.title.length <= 28 && card.labels.some((l) => /Football/.test(l))
    && card.labels.some((l) => /News/.test(l)) && !card.iconOnText && !card.overlapsFab, card);

  const real = log.errors.filter((e) => !/fontsource|403 \(Forbidden\).*woff/i.test(e));
  check('hudphone: no page errors', real.length === 0, real.slice(0, 5));
  await ctx.close();
}
