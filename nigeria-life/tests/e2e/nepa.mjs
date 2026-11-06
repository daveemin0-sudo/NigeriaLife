// NEPA (src/life/Grid.ts, src/housing/HomePower.ts): each area's band and its plan for the day,
// the same for everyone; the street the player is on follows it; at home a cut puts the lights out
// (a lantern, never dark), turns the TV off and stops what needs power, but not a gas cooker; a
// Tiger is fuelled, started by hand, burns petrol by the hour and is too small for an AC; a Mikano
// changes over by itself; an inverter runs the house off its battery and charges from NEPA; light
// coming back; the Houses app tells a home's band; a business without backup takes less; reload.
import { open, newPlayer, closeDialogs, reload, wait, advance, enterInterior, money } from './lib.mjs';

/** Moves the game clock on (never back) to this day and hour, and lets the home catch up */
const clockTo = (page, day, hour) =>
  page.evaluate(([d, h]) => {
    const sky = window.game.world.skyEnvironment;
    sky.setDay(d);
    sky.setHour(h);
    window.game.modules.HomePower.get().tick();
  }, [day, hour]);
const supply = (page) => page.evaluate(() => window.game.modules.HomePower.get().supply());
/** A run of `len` hours without light in an area on a day, and the first hour with light after it */
const findCut = (page, area, day, len) =>
  page.evaluate(([a, d, n]) => {
    const plan = window.game.modules.Grid.dayPlan(a, d, 'lagos');
    // Outside 7 to 11 pm, when a compound's landlord runs the generator for the tenants
    const evening = (h) => h >= 19 && h < 23;
    for (let h = 0; h + n <= 23; h++) {
      if (plan.slice(h, h + n).every((lit, i) => !lit && !evening(h + i))) {
        let back = h + n;
        while (back < 24 && !plan[back]) back++;
        return { start: h, back: back < 24 ? back : null };
      }
    }
    return null;
  }, [area, day, len]);

/** Puts a catalogue piece down in the home at the first free spot, with a known uid */
const put = (page, uid, id) =>
  page.evaluate(([u, i]) => {
    const decor = window.game.modules.HouseDecorationSystem.getInstance();
    if (decor.placed.some((p) => p.uid === u)) return true;
    for (let x = -3; x <= 3; x += 1.5) {
      for (let z = -3; z <= 3; z += 1.5) {
        if (decor.adopt([{ uid: u, id: i, x, z, turns: 0 }]) === 1) return true;
      }
    }
    return false;
  }, [uid, id]);

/** Opens a piece's card in the home and presses its button: the choices it offers */
async function openCard(page, uid) {
  await page.evaluate((u) => {
    const g = window.game;
    const res = g.world.interiorManager.residence;
    const card = res.interactiveList.find((o) => o.id === `home_item_${u}`);
    document.getElementById('game-dialogue-overlay')?.remove();
    g.hud.hideInteractionCard();
    g.player.stopMoving();
    g.player.mesh.position.set(card.interactionPoint.x, 0, card.interactionPoint.z);
    g.hud.showInteractionCard(card);
  }, uid);
  await page.evaluate(() => document.getElementById('card-action-btn')?.click());
  await wait(300);
  return page.evaluate(() => [...document.querySelectorAll('#game-dialogue-overlay button')].map((b) => b.textContent.replace(/\s+/g, ' ').trim()));
}
const choose = (page, text) => page.evaluate((t) => [...document.querySelectorAll('#game-dialogue-overlay button')].find((b) => b.textContent.includes(t))?.click(), text);
const said = (page, pattern) => page.evaluate((source) => new RegExp(source).test(document.body.innerText), pattern);

/** How bright a drawn frame is, 0 to 255 */
const brightness = (page) => page.evaluate(() => {
  const g = window.game;
  g.render();
  const small = document.createElement('canvas');
  small.width = 160;
  small.height = 90;
  const ctx = small.getContext('2d');
  ctx.drawImage(g.renderer.domElement, 0, 0, 160, 90);
  const data = ctx.getImageData(0, 0, 160, 90).data;
  let sum = 0;
  for (let i = 0; i < data.length; i += 4) sum += 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2];
  return sum / (data.length / 4);
});

export async function run(browser, check) {
  const ctx = await newPlayer(browser);
  const { page, log } = await open(ctx, { w: 1280, h: 760 });
  await closeDialogs(page);
  const today = await page.evaluate(() => { const sky = window.game.world.skyEnvironment; sky.timeScale = 0; sky.setHour(9); return sky.day; });

  // ------------------------------------------------------------------ The plan
  const plan = await page.evaluate((d0) => {
    const G = window.game.modules.Grid;
    const areas = { banana_island: 'own', ikoyi: 'A', lekki: 'B', yaba: 'C', ajah: 'D', mushin: 'E' };
    const out = {};
    for (const [area, band] of Object.entries(areas)) {
      const hours = [];
      let cutsOk = true;
      for (let d = d0; d < d0 + 30; d++) {
        const p = G.dayPlan(area, d, 'lagos');
        hours.push(p.filter(Boolean).length);
        // The number of separate cuts, going round the clock
        let cuts = 0;
        for (let h = 0; h < 24; h++) if (!p[h] && p[(h + 23) % 24]) cuts++;
        if (band !== 'own' && (cuts < 1 || cuts > 3)) cutsOk = false;
      }
      out[area] = { band: G.bandOf(area), min: Math.min(...hours), max: Math.max(...hours), cutsOk };
    }
    const same = JSON.stringify(G.dayPlan('yaba', d0 + 3)) === JSON.stringify(G.dayPlan('yaba', d0 + 3));
    const differs = JSON.stringify(G.dayPlan('yaba', d0 + 3)) !== JSON.stringify(G.dayPlan('surulere', d0 + 3)) || JSON.stringify(G.dayPlan('yaba', d0 + 4)) !== JSON.stringify(G.dayPlan('surulere', d0 + 4));
    return { out, same, differs, home: [G.homeArea('mainland', 'Olosha, Mushin, Lagos Mainland'), G.homeArea('mainland', 'Magodo Phase 2')] };
  }, today);
  const o = plan.out;
  check('nepa: each area\'s band gets its hours: Ikoyi (A) 20 to 23 a day, Lekki (B) 16 to 19, Yaba (C) 12 to 15, Ajah (D) 8 to 11, Mushin (E) 4 to 7, Banana Island its own power all day; one to three cuts a day',
    o.ikoyi.band === 'A' && o.ikoyi.min >= 20 && o.ikoyi.max <= 23 && o.lekki.min >= 16 && o.lekki.max <= 19 && o.yaba.min >= 12 && o.yaba.max <= 15 && o.ajah.min >= 8 && o.ajah.max <= 11
    && o.mushin.band === 'E' && o.mushin.min >= 4 && o.mushin.max <= 7 && o.banana_island.min === 24 && Object.values(o).every((a) => a.cutsOk),
    o);
  check('nepa: a day\'s plan is the same every time it is asked (so everyone in an area sees the same), areas differ, and a home in Mushin or Magodo is placed in that area, not the Mainland',
    plan.same && plan.differs && plan.home[0] === 'mushin' && plan.home[1] === 'magodo', plan);

  // ------------------------------------------------------------------ The street follows its area
  const street = await page.evaluate(() => window.game.modules.LagosStreetLifeSystem.getInstance().lightHere());
  const streetCut = await findCut(page, street.area, today + 1, 1);
  await clockTo(page, today + 1, streetCut.start + 0.5);
  await advance(page, 3);
  const dark = await page.evaluate(() => ({ on: window.game.modules.LagosStreetLifeSystem.getInstance().isNepaOn, icon: document.getElementById('hud-light-icon')?.textContent, title: document.getElementById('hud-light-icon')?.title }));
  await clockTo(page, today + 1, streetCut.back ?? 23.5);
  await advance(page, 3);
  const lit = await page.evaluate(() => ({ on: window.game.modules.LagosStreetLifeSystem.getInstance().isNepaOn, icon: document.getElementById('hud-light-icon')?.textContent }));
  check('nepa: the street follows the plan of the area the player is in: no light in its cut (a candle by the clock, which says the band), light when its hour comes',
    streetCut && dark.on === false && dark.icon === '🕯️' && /Band [A-E]/.test(dark.title) && (streetCut.back === null || (lit.on === true && lit.icon === '💡')),
    { street, streetCut, dark, lit });

  // ------------------------------------------------------------------ A home in Mushin: a cut
  const day = today + 2;
  await page.evaluate(() => {
    const be = window.game.hud.backend;
    be.data.bank.balance = 50_000_000;
    be.data.walletCash = 5_000_000;
    be.saveData();
    be.rentProperty('prop_mushin_room');
  });
  const cut = await findCut(page, 'mushin', day, 5);
  await clockTo(page, day, cut.start + 0.25);
  await enterInterior(page, 'residence');
  await wait(800);
  await clockTo(page, day, cut.start + 0.3);
  const placed = [];
  for (const [uid, id] of [['nepa_tv', 'smart_tv_75'], ['nepa_cooker', 'gas_cooker'], ['nepa_ac', 'split_ac'], ['nepa_tiger', 'tiger_gen']]) placed.push(await put(page, uid, id));
  await wait(400);
  let s = await supply(page);
  const room = await page.evaluate(() => {
    const res = window.game.world.interiorManager.residence;
    const lights = [];
    res.group.traverse((x) => { if (x.name === 'ceiling_light') x.children.forEach((c) => { if (c.isPointLight) lights.push(c.intensity); }); });
    const lamp = res.group.getObjectByName('rechargeable_lamp');
    const P = window.game.modules.HomePower.get();
    return { lights, lamp: lamp?.userData.on === true, tv: P.whyNot('tv_75', 'TV'), cooker: P.whyNot('cooker', 'cooker') };
  });
  check('nepa: in a Mushin cut with nothing to fall back on, the house has no power: the ceiling lights are out, the rechargeable lantern is lit, the TV will not go on, and the gas cooker still works',
    placed.every(Boolean) && s.grid === false && s.source === 'none' && room.lights.length > 0 && room.lights.every((i) => i === 0) && room.lamp && /No light\. NEPA has taken it in Mushin/.test(room.tv) && room.cooker === null,
    { placed, s, room });
  const tvChoices = await openCard(page, 'nepa_tv');
  await choose(page, 'No light');
  await wait(300);
  const tvSays = await said(page, 'No light\\. NEPA has taken it in Mushin');
  check('nepa: the TV\'s own card marks its channels "No light", and pressing one says why',
    tvChoices.some((c) => /No light/.test(c)) && tvSays, tvChoices);

  // ------------------------------------------------------------------ A Tiger: fuel, start, burn
  let gen = await page.evaluate(() => window.game.modules.HomePower.get().generator('nepa_tiger'));
  const empty = await page.evaluate(() => window.game.modules.HomePower.get().start('nepa_tiger'));
  const before = await money(page);
  const quote = await page.evaluate(() => window.game.modules.HomePower.get().fillQuote('nepa_tiger'));
  await openCard(page, 'nepa_tiger');
  await choose(page, 'Send for petrol');
  await advance(page, 4);
  const after = await money(page);
  gen = await page.evaluate(() => window.game.modules.HomePower.get().generator('nepa_tiger'));
  check('nepa: a new Tiger has an empty tank and will not start; sending for petrol fills its 4 litres at the pump price and ₦500 for the errand, paid from the pocket',
    !empty.ok && /empty/.test(empty.message) && quote.litres === 4 && quote.cost === 4 * 950 + 500 && before.total - after.total === quote.cost && gen.litres === 4,
    { empty, quote, spent: before.total - after.total, gen });
  await openCard(page, 'nepa_tiger');
  await choose(page, 'Pull the cord');
  await advance(page, 3);
  s = await supply(page);
  const onTiger = await page.evaluate(() => { const P = window.game.modules.HomePower.get(); return { tv: P.whyNot('tv_75', 'TV'), ac: P.whyNot('split_ac', 'AC') }; });
  const lightsOn = await page.evaluate(() => { const res = window.game.world.interiorManager.residence; const l = []; res.group.traverse((x) => { if (x.name === 'ceiling_light') x.children.forEach((c) => { if (c.isPointLight) l.push(c.intensity); }); }); return { l, lamp: res.group.getObjectByName('rechargeable_lamp')?.userData.on }; });
  check('nepa: the cord pulled (acted out at the generator), the Tiger runs the house: lights back on, the lantern out, the TV can go on, but it is too small for the AC',
    s.source === 'tiger' && !s.heavy && onTiger.tv === null && /too small/.test(onTiger.ac) && lightsOn.l.every((i) => i > 0) && lightsOn.lamp === false,
    { s, onTiger, lightsOn });

  await clockTo(page, day, cut.start + 2.3);
  gen = await page.evaluate(() => window.game.modules.HomePower.get().generator('nepa_tiger'));
  check('nepa: two hours on, the Tiger has burned a litre (half a litre an hour)', Math.abs(gen.litres - 3) < 0.05 && gen.running, gen);
  await page.evaluate(() => { const P = window.game.modules.HomePower.get(); P.homes[P.homeId()].gens.nepa_tiger.litres = 0.2; });
  await clockTo(page, day, cut.start + 3);
  s = await supply(page);
  gen = await page.evaluate(() => window.game.modules.HomePower.get().generator('nepa_tiger'));
  check('nepa: when the petrol runs out the Tiger stops and the house is dark again', gen.litres === 0 && !gen.on && s.source === 'none', { gen, s });

  // ------------------------------------------------------------------ NEPA comes back
  if (cut.back !== null) {
    // Filled and started again for the rest of the cut: it burns until NEPA is back, then is switched off
    await page.evaluate(() => { const P = window.game.modules.HomePower.get(); P.homes[P.homeId()].gens.nepa_tiger.litres = 4; P.homes[P.homeId()].gens.nepa_tiger.on = true; });
    await clockTo(page, day, cut.back + 0.2);
    s = await supply(page);
    gen = await page.evaluate(() => window.game.modules.HomePower.get().generator('nepa_tiger'));
    const left = Math.max(0, 4 - 0.5 * (cut.back - (cut.start + 3)));
    check('nepa: when NEPA brings light back the house runs on it, AC and all, and the Tiger is switched off having burned only the hours of the cut', s.source === 'nepa' && s.heavy && !gen.on && Math.abs(gen.litres - left) < 0.05, { s, gen, left });
  }

  // ------------------------------------------------------------------ A Mikano and an inverter
  const day2 = day + 1;
  const cut2 = await findCut(page, 'mushin', day2, 4);
  await clockTo(page, day2, cut2.start + 0.2);
  await put(page, 'nepa_mikano', 'mikano_gen');
  await wait(300);
  const mikanoFill = await page.evaluate(() => window.game.modules.HomePower.get().fill('nepa_mikano'));
  s = await supply(page);
  const acOnMikano = await page.evaluate(() => window.game.modules.HomePower.get().whyNot('split_ac', 'AC'));
  check('nepa: a Mikano filled with diesel changes over by itself in a cut and runs everything, the AC too',
    mikanoFill.ok && s.source === 'mikano' && s.heavy && acOnMikano === null, { mikanoFill, s, acOnMikano });
  await page.evaluate(() => window.game.modules.HomePower.get().stop('nepa_mikano'));
  await put(page, 'nepa_inverter', 'inverter_solar');
  await wait(300);
  s = await supply(page);
  const battery0 = await page.evaluate(() => window.game.modules.HomePower.get().battery());
  await clockTo(page, day2, cut2.start + 1.2);
  const battery1 = await page.evaluate(() => window.game.modules.HomePower.get().battery());
  check('nepa: with the Mikano off automatic, an inverter runs the house silently off its battery, which drains (faster with an AC in the house)',
    s.source === 'inverter' && battery0 === 100 && battery1 < 100 && battery1 >= 80, { s, battery0, battery1 });

  // ------------------------------------------------------------------ Never too dark
  // At night, in a cut: lit by the inverter, then with nothing left
  const nightCut = await findCut(page, 'mushin', day2 + 1, 2);
  // An hour of the evening in a cut, if there is one, else the cut's own hour
  // A dark hour of the night in a cut, after the compound generator has gone off at eleven
  const eveningCut = await page.evaluate((d) => {
    const plan = window.game.modules.Grid.dayPlan('mushin', d, 'lagos');
    for (const h of [23, 0, 1, 2, 3, 4, 5]) if (!plan[h]) return h;
    return null;
  }, day2 + 1);
  const darkHour = eveningCut ?? nightCut.start;
  await clockTo(page, day2 + 1, darkHour + 0.4);
  await page.evaluate(() => { const P = window.game.modules.HomePower.get(); P.homes[P.homeId()].batteries.nepa_inverter = 100; P.tick(); });
  await wait(300);
  const withBattery = await brightness(page);
  await page.evaluate(() => { const P = window.game.modules.HomePower.get(); P.homes[P.homeId()].batteries.nepa_inverter = 0; P.tick(); });
  await wait(300);
  const withoutAny = await brightness(page);
  if (process.env.SHOTS) await page.screenshot({ path: `${process.env.SHOTS}/nepa_cut.png` });
  check('nepa: in a cut the room is darker than with power, and still clearly seen by the lantern (never too dark)',
    withoutAny < withBattery * 0.85 && withoutAny > 60, { darkHour, withBattery: Math.round(withBattery), withoutAny: Math.round(withoutAny) });

  // ------------------------------------------------------------------ The compound generator, 7 to 11 pm
  const compound = await page.evaluate(async (d) => {
    const g = window.game;
    const P = g.modules.HomePower.get();
    const plan = g.modules.Grid.dayPlan('mushin', d, 'lagos');
    const h = [19, 20, 21, 22].find((x) => !plan[x]);
    if (h === undefined) return { none: true };
    const sky = g.world.skyEnvironment;
    sky.setDay(d);
    sky.setHour(h + 0.3);
    // Nothing of the player's own running: battery flat, generators off
    const home = P.homes[P.homeId()];
    for (const k of Object.keys(home.batteries)) home.batteries[k] = 0;
    for (const k of Object.keys(home.gens)) home.gens[k].on = false;
    P.tick();
    return { h, s: P.supply(), tv: P.whyNot('tv_75', 'TV'), ac: P.whyNot('split_ac', 'AC'), said: P.describe() };
  }, day2 + 2);
  check('nepa: in a rented room in a cut between 7 and 11 pm the compound generator the landlord runs lights and the TV, not the AC',
    compound.none || (compound.s.source === 'compound' && compound.tv === null && /compound generator is for lights/.test(compound.ac ?? '') && /compound generator is on/.test(compound.said)),
    compound);

  // ------------------------------------------------------------------ The Houses app, a business, reload
  await page.evaluate(() => { window.game.hud.phoneModal.open(); window.game.hud.phoneModal.openApp('property', 'p:prop_mushin_room'); });
  await wait(600);
  const card = await page.evaluate(() => document.getElementById('property-power')?.innerText ?? '');
  await page.evaluate(() => window.game.hud.phoneModal.close());
  check('nepa: the Houses app tells a home\'s light before and after renting: Mushin is Band E, at least 4 hours a day, and whether NEPA has light there now',
    /Mushin is Band E: at least 4 hours/.test(card) && /NEPA light there now/.test(card), card);

  const share = await page.evaluate(([d, h]) => {
    const be = window.game.hud.backend;
    const biz = be.getData().businesses.find((b) => b.id === 'biz_mama_put');
    const sky = window.game.world.skyEnvironment;
    sky.setDay(d);
    sky.setHour(h);
    const Svc = be.constructor;
    const plain = Svc.powerShare({ ...biz, upgrades: biz.upgrades.map((u) => ({ ...u, purchased: false })) }, 1);
    const area = biz.districtId;
    const G = window.game.modules.Grid;
    return { plain, lit: G.hasLight(area, d, h - 0.5, 'lagos') || G.hasLight(area, d, h, 'lagos'), backed: Svc.powerShare({ ...biz, upgrades: [{ id: 'upg_gen', purchased: true }] }, 1) };
  }, [day2 + 1, darkHour + 0.4]);
  check('nepa: a business whose area has no light takes less (half, without a generator or solar); with one it takes it all', share.backed === 1 && (share.lit ? share.plain > 0.5 : share.plain === 0.5), share);

  const kept = await page.evaluate(() => { const P = window.game.modules.HomePower.get(); return JSON.stringify(P.homes[P.homeId()]); });
  await reload(page);
  await closeDialogs(page);
  const back = await page.evaluate(() => { const P = window.game.modules.HomePower.get(); return JSON.stringify(P.homes[P.homeId()]); });
  // (The clock runs on through a reload, so a battery may charge in it; a switched-off generator burns nothing)
  check('nepa: a reload keeps the fuel in each tank and the battery', JSON.parse(back).gens.nepa_tiger.litres === JSON.parse(kept).gens.nepa_tiger.litres && JSON.parse(back).gens.nepa_mikano.litres === JSON.parse(kept).gens.nepa_mikano.litres && JSON.parse(back).batteries.nepa_inverter >= JSON.parse(kept).batteries.nepa_inverter, { kept, back });

  check('nepa: no errors', log.errors.length === 0, log.errors.slice(0, 5));
}
