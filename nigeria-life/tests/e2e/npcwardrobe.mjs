// NPC wardrobe (clothing Stage 4): what the street wears, and when.
//
// 1. Occupations: office workers, students, mechanics, construction workers, security, market traders, drivers,
//    shopkeepers, fitness people, hawkers, elders and night owls each dress for what they do, on both bodies.
// 2. Districts: the same kind of people dress differently in Victoria Island, Yaba, a market district and Lekki,
//    and still differ from one another inside each.
// 3. Time: nobody changes between morning and afternoon; some (not all) change in the evening; native wear on
//    Fridays and church clothes on Sundays.
// 4. Weather: rain (closed shoes, caps), harmattan mornings (hoodies, beanies), hot days (tees, slides); a shower
//    starting mid-day only puts caps on those who carry one, and nobody changes in front of the player.
// 5. Persistence: the same person wears the same outfit after the page is loaded again; the regulars keep the
//    outfit they put on today (the weather they dressed in) across sessions; few writes; not in the account save.
// 6. Variety: a hundred nearby people are almost all dressed differently.
// 7. Rendering: every occupation's outfit on the real model in each motion with no shader errors and no new
//    programs; near models and far figures show the same outfit; the crowd's wardrobe costs little per frame.
// SHOTS=<dir> saves pictures for the review page.
import fs from 'node:fs';
import path from 'node:path';
import { newPlayer, open, closeDialogs, wait, reload } from './lib.mjs';

const SHOTS = process.env.SHOTS || '';
function saveShot(name, dataUrl) {
  if (!SHOTS || !dataUrl) return;
  fs.mkdirSync(SHOTS, { recursive: true });
  fs.writeFileSync(path.join(SHOTS, `${name}.jpg`), Buffer.from(dataUrl.split(',')[1], 'base64'));
}
function saveJson(name, data) {
  if (!SHOTS) return;
  fs.mkdirSync(SHOTS, { recursive: true });
  fs.writeFileSync(path.join(SHOTS, `${name}.json`), JSON.stringify(data, null, 1));
}

const OCCUPATIONS = ['office', 'student', 'mechanic', 'construction', 'security', 'market_trader', 'driver', 'shopkeeper', 'fitness', 'hawker', 'casual', 'elder', 'nightlife'];

export async function run(browser, check) {
  const ctx = await newPlayer(browser);
  const { page } = await open(ctx, { w: 1366, h: 768 });
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error' && /shader|program|webgl|glsl/i.test(m.text())) errors.push(m.text().slice(0, 240)); });
  await closeDialogs(page);

  // ------------------------------------------------------------------ 1. Occupations
  const occ = await page.evaluate((OCCUPATIONS) => {
    const A = window.game.modules.NpcWardrobeApi;
    const out = {};
    for (const o of OCCUPATIONS) {
      const district = o === 'office' ? 'business' : o === 'student' ? 'student' : o === 'market_trader' ? 'market' : 'everyday';
      const rows = [];
      for (const gender of ['male', 'female']) {
        for (let i = 0; i < 60; i++) {
          const w = new A.CrowdWardrobe('occ');
          const facts = { gender, occupation: o, home: A.FASHION[district], work: A.FASHION[district], skinTone: '#5c3a28', hairColor: '#0b0908', important: false, works: A.OCCUPATIONS[o].workdays.length > 0 };
          // A Tuesday at 10 in the morning, mild weather
          const id = i * 2 + (gender === 'female' ? 1 : 0) + OCCUPATIONS.indexOf(o) * 1000;
          const e = w.dress(id, () => facts, 10, 1, 2, 'partly_cloudy', false);
          // The same person dressed again from nothing: the same outfit
          const again = new A.CrowdWardrobe('occ').dress(id, () => facts, 10, 1, 2, 'partly_cloudy', false);
          rows.push({ gender, purpose: e.purpose, t: e.outfit.template, top: e.outfit.top, bottom: e.outfit.bottom, shoes: e.outfit.shoes, hat: e.outfit.hat, cond: e.outfit.styles.top?.condition, logo: e.outfit.styles.top?.pattern?.text, colour: e.outfit.topColour, sig: A.outfitSignature(e.outfit), same: A.outfitSignature(again.outfit) === A.outfitSignature(e.outfit) });
        }
      }
      const share = (f) => rows.filter(f).length / rows.length;
      const tally = {};
      for (const r of rows) tally[r.t] = (tally[r.t] ?? 0) + 1;
      out[o] = {
        n: rows.length, templates: tally, deterministic: rows.every((r) => r.same), unique: new Set(rows.map((r) => r.sig)).size / rows.length,
        formalShoes: share((r) => ['oxfords', 'loafers', 'heels'].includes(r.shoes)), sandals: share((r) => r.shoes === 'sandals'), boots: share((r) => r.shoes === 'boots'),
        logo: share((r) => r.logo === 'SECURITY'), dirtyOrWorn: share((r) => r.cond === 'dirty' || r.cond === 'worn' || r.cond === 'damaged'),
        hivis: share((r) => ['#f97316', '#facc15', '#a3e635'].includes(r.colour)), purposes: [...new Set(rows.map((r) => r.purpose))],
        native: share((r) => ['kaftan', 'senator', 'agbada', 'ankara_shirt', 'ankara_set_f', 'ankara_gown', 'iro_buba', 'ankara_two_piece'].includes(r.t)),
        youth: share((r) => ['oversized_street', 'hoodie_jeans', 'tee_jeans', 'tee_jeans_f'].includes(r.t)),
        sport: share((r) => r.t.startsWith('sport_')),
        bothBodies: rows.some((r) => r.gender === 'male') && rows.some((r) => r.gender === 'female'),
        bottoms: [...new Set(rows.map((r) => r.bottom ?? ''))],
      };
    }
    return out;
  }, OCCUPATIONS);
  saveJson('occupations', occ);
  const occBad = [];
  const need = (o, ok, what) => { if (!ok) occBad.push(`${o}: ${what}`); };
  for (const o of OCCUPATIONS) need(o, occ[o].deterministic && occ[o].bothBodies, 'deterministic on both bodies');
  need('office', occ.office.formalShoes >= 0.8 && occ.office.purposes.includes('work'), `formal shoes ${occ.office.formalShoes}`);
  need('student', occ.student.youth >= 0.6, `youth ${occ.student.youth}`);
  need('mechanic', (occ.mechanic.templates.mechanic ?? 0) === occ.mechanic.n && occ.mechanic.dirtyOrWorn >= 0.8 && occ.mechanic.bottoms.every((b) => b === 'cargo_pants'), JSON.stringify(occ.mechanic.templates));
  need('construction', occ.construction.hivis + (occ.construction.templates.mechanic ?? 0) / occ.construction.n >= 0.95 && occ.construction.boots >= 0.6, `hivis ${occ.construction.hivis}`);
  need('security', occ.security.logo === 1, `logo ${occ.security.logo}`);
  need('market_trader', occ.market_trader.native >= 0.5, `native ${occ.market_trader.native}`);
  need('driver', Object.keys(occ.driver.templates).every((t) => /driver|polo|tee/.test(t)), JSON.stringify(occ.driver.templates));
  need('fitness', occ.fitness.sport === 1, `sport ${occ.fitness.sport}`);
  need('elder', occ.elder.native >= 0.6 && occ.elder.youth <= 0.1, `native ${occ.elder.native} youth ${occ.elder.youth}`);
  need('nightlife', occ.nightlife.purposes.join() === 'evening', occ.nightlife.purposes.join());
  need('hawker', occ.hawker.sandals >= 0.3, `sandals ${occ.hawker.sandals}`);
  check('npcwardrobe: every occupation dresses for what it does (office formal shoes, mechanics in overalls, hi-vis on sites, SECURITY on guards, native wear in markets and on elders, sport for the fit), the same outfit for the same person every time, on both bodies', occBad.length === 0,
    { bad: occBad, summary: Object.fromEntries(OCCUPATIONS.map((o) => [o, { top: Object.entries(occ[o].templates).sort((a, b) => b[1] - a[1]).slice(0, 4), unique: +occ[o].unique.toFixed(2) }])) });

  // ------------------------------------------------------------------ 2. Districts
  const dist = await page.evaluate(() => {
    const A = window.game.modules.NpcWardrobeApi;
    const out = {};
    for (const [name, f] of [['Victoria Island', 'business'], ['Yaba', 'student'], ['Market district', 'market'], ['Lekki', 'premium_casual'], ['Abuja CBD', 'capital_formal'], ['Port Harcourt Trans-Amadi', 'industrial']]) {
      const rows = [];
      for (let i = 0; i < 400; i++) {
        const w = new A.CrowdWardrobe('dist');
        const gender = i % 2 ? 'female' : 'male';
        // Everyday people on a Saturday afternoon (their own clothes), and office workers on a Tuesday
        const occupation = i % 4 === 3 ? 'office' : 'casual';
        const facts = { gender, occupation, home: A.FASHION[f], work: A.FASHION[f], skinTone: '#5c3a28', hairColor: '#0b0908', important: false, works: occupation === 'office' };
        const e = w.dress(i, () => facts, 14, occupation === 'office' ? 1 : 5, occupation === 'office' ? 2 : 6, 'partly_cloudy', false);
        const o = e.outfit;
        rows.push({ occupation, t: o.template, shoes: o.shoes, hat: o.hat, cond: o.styles.top?.condition, pat: o.styles.top?.pattern?.kind, sig: A.outfitSignature(o) });
      }
      const casual = rows.filter((r) => r.occupation === 'casual');
      const share = (list, f) => +(list.filter(f).length / list.length).toFixed(3);
      out[name] = {
        fashion: f,
        formal: share(casual, (r) => ['polo_chinos', 'shirt_casual', 'office_shirt', 'office_polo_f', 'office_skirt_f', 'senator'].includes(r.t) || ['oxfords', 'loafers', 'heels'].includes(r.shoes)),
        youth: share(casual, (r) => ['oversized_street', 'hoodie_jeans'].includes(r.t) || r.pat === 'graphic' || r.hat === 'cap' || r.hat === 'bucket_hat'),
        native: share(casual, (r) => ['kaftan', 'senator', 'agbada', 'ankara_shirt', 'ankara_set_f', 'ankara_gown', 'iro_buba', 'ankara_two_piece'].includes(r.t) || r.pat === 'ankara'),
        sandals: share(casual, (r) => r.shoes === 'sandals'),
        worn: share(casual, (r) => r.cond !== 'clean'),
        officeFormalShoes: share(rows.filter((r) => r.occupation === 'office'), (r) => ['oxfords', 'loafers', 'heels'].includes(r.shoes)),
        unique: +(new Set(rows.map((r) => r.sig)).size / rows.length).toFixed(3),
      };
    }
    return out;
  });
  saveJson('districts', dist);
  const VI = dist['Victoria Island'];
  const YA = dist.Yaba;
  const MK = dist['Market district'];
  const LK = dist.Lekki;
  check('npcwardrobe: districts dress differently (Victoria Island more formal than Yaba, Yaba younger, the market more native wear and slides than Lekki, Lekki kept cleaner) and people inside each still differ (at least 85% unique)',
    VI.formal > YA.formal + 0.1 && YA.youth > VI.youth + 0.1 && MK.native > LK.native + 0.1 && MK.sandals > LK.sandals && LK.worn < MK.worn && Object.values(dist).every((d) => d.unique >= 0.85), dist);

  // ------------------------------------------------------------------ 3. Time of day and the week
  const time = await page.evaluate(() => {
    const A = window.game.modules.NpcWardrobeApi;
    const occs = ['office', 'student', 'market_trader', 'casual', 'hawker', 'elder', 'driver', 'shopkeeper', 'security', 'fitness', 'nightlife', 'mechanic'];
    const people = [];
    for (let i = 0; i < 360; i++) {
      const occupation = occs[i % occs.length];
      people.push({ id: i, facts: { gender: i % 2 ? 'female' : 'male', occupation, home: A.FASHION.island_mixed, work: A.FASHION.business, skinTone: '#5c3a28', hairColor: '#0b0908', important: false, works: A.OCCUPATIONS[occupation].workdays.length > 0 } });
    }
    const w = new A.CrowdWardrobe('time');
    const at = (hour, day, weekday) => people.map((p) => A.outfitSignature(w.dress(p.id, () => p.facts, hour, day, weekday, 'partly_cloudy', false).outfit));
    // Tuesday (day 1): morning, afternoon, evening, night
    const morning = at(9, 1, 2);
    const afternoon = at(15, 1, 2);
    const evening = at(21, 1, 2);
    const night = at(2, 2, 3); // the small hours belong to the night before
    const differ = (a, b) => a.filter((s, i) => s !== b[i]).length;
    // Friday and Sunday mornings
    const purposes = (hour, day, weekday, occ) => people.filter((p) => !occ || p.facts.occupation === occ).map((p) => w.dress(p.id, () => p.facts, hour, day, weekday, 'partly_cloudy', false).purpose);
    const fri = purposes(10, 4, 5, 'office');
    const sun = purposes(10, 6, 0);
    const wed = purposes(10, 2, 3, 'office');
    // Tomorrow's work outfit is not always today's (a small wardrobe, rotated)
    const tue = people.filter((p) => p.facts.occupation === 'office').map((p) => A.outfitSignature(w.dress(p.id, () => p.facts, 10, 1, 2, 'partly_cloudy', false).outfit));
    const thu = people.filter((p) => p.facts.occupation === 'office').map((p) => A.outfitSignature(w.dress(p.id, () => p.facts, 10, 3, 4, 'partly_cloudy', false).outfit));
    return {
      people: people.length,
      morningToAfternoon: differ(morning, afternoon),
      afternoonToEvening: differ(afternoon, evening),
      eveningToNight: differ(evening, night),
      fridayNative: +(fri.filter((p) => p === 'occasion').length / fri.length).toFixed(2),
      wednesdayWork: +(wed.filter((p) => p === 'work').length / wed.length).toFixed(2),
      sundayOccasion: +(sun.filter((p) => p === 'occasion').length / sun.length).toFixed(2),
      officeRotated: +(tue.filter((s, i) => s !== thu[i]).length / tue.length).toFixed(2),
      dayParts: [6, 13, 18, 23].map((h) => A.dayPart(h)),
    };
  });
  saveJson('time', time);
  check('npcwardrobe: no one changes between morning and afternoon, some but not all change for the evening, none between evening and the small hours; native wear on Fridays, church clothes on Sundays, work clothes on weekdays, and outfits rotate day to day',
    time.morningToAfternoon === 0 && time.afternoonToEvening > time.people * 0.1 && time.afternoonToEvening < time.people * 0.6 && time.eveningToNight === 0
    && time.fridayNative >= 0.25 && time.wednesdayWork === 1 && time.sundayOccasion >= 0.3 && time.officeRotated >= 0.2 && time.dayParts.join() === 'morning,afternoon,evening,night', time);

  // ------------------------------------------------------------------ 4. Weather
  const weather = await page.evaluate(() => {
    const A = window.game.modules.NpcWardrobeApi;
    const occs = ['casual', 'student', 'hawker', 'casual', 'driver', 'market_trader', 'office', 'construction'];
    const out = {};
    for (const [label, wx, hour] of [['mild', 'partly_cloudy', 8], ['rain', 'rainy', 8], ['harmattan', 'harmattan', 8], ['hot', 'sunny', 8]]) {
      const rows = [];
      for (let i = 0; i < 400; i++) {
        const occupation = occs[i % occs.length];
        const facts = { gender: i % 2 ? 'female' : 'male', occupation, home: A.FASHION.everyday, work: A.FASHION.everyday, skinTone: '#5c3a28', hairColor: '#0b0908', important: false, works: A.OCCUPATIONS[occupation].workdays.length > 0 };
        // Saturday for the casual ones, so their own clothes show
        const e = new A.CrowdWardrobe('wx').dress(i, () => facts, hour, 5, 6, wx, false);
        rows.push({ occupation, top: e.outfit.top, bottom: e.outfit.bottom, shoes: e.outfit.shoes, hat: e.outfit.hat, adjusted: e.outfit.adjusted ?? '', base: A.outfitSignature(A.buildOutfit(e.profile, e.purpose, A.rotationOf(e.profile, e.purpose, A.slotOf(e.profile, hour, 5)))), template: e.outfit.template, rainHat: e.rainHat });
      }
      const share = (f) => +(rows.filter(f).length / rows.length).toFixed(3);
      out[label] = {
        sandals: share((r) => r.shoes === 'sandals'), hats: share((r) => !!r.hat || r.rainHat), hoodies: share((r) => r.top === 'hoodie'), beanies: share((r) => r.hat === 'beanie'),
        shorts: share((r) => r.bottom === 'shorts' || r.bottom === 'cargo_shorts'), adjusted: share((r) => !!r.adjusted),
        examples: rows.filter((r) => r.adjusted).slice(0, 4).map((r) => `${r.occupation} ${r.template}: ${r.adjusted}`),
      };
    }
    return out;
  });
  saveJson('weather', weather);
  check('npcwardrobe: weather changes what people put on: rain means closed shoes and more caps, harmattan mornings more hoodies and beanies, hot days fewer hoodies and more shorts',
    weather.rain.sandals === 0 && weather.rain.hats > weather.mild.hats + 0.15 && weather.harmattan.hoodies > weather.mild.hoodies + 0.05 && weather.harmattan.beanies > weather.mild.beanies
    && weather.hot.hoodies < weather.mild.hoodies && weather.hot.shorts > weather.mild.shorts, weather);

  // ------------------------------------------------------------------ The live street: variety, a shower, holding changes, LOD, cost
  // The whole crowd is dressed through the crowd's own code (as each person is when drawn), wherever they are, so
  // a hundred nearby people can be counted though the camera only sees some of them.
  const dressAll = () => page.evaluate(() => {
    const g = window.game;
    const crowd = g.world.cityPopulation;
    window.__dressAll = (opts = {}) => {
      const p = g.player.position;
      const out = [];
      for (const a of crowd.agents) {
        const d2 = (a.x - p.x) ** 2 + (a.z - p.z) ** 2;
        const model = crowd.models.has(a.id);
        const hold = opts.hold === false ? false : model || d2 < crowd.constructor.HOLD_CHANGE2;
        const e = crowd.dressOf(a, crowd.variants[a.variant], hold, model);
        out.push({ id: a.id, d2, e });
      }
      return out;
    };
    return true;
  });
  await page.evaluate(() => {
    const g = window.game;
    g.world.weather.setWeather('partly_cloudy', true);
    g.world.skyEnvironment.setHour(10);
    for (let i = 0; i < 8; i++) g.advance(0.25);
  });
  await wait(2500);
  await dressAll();
  const street = await page.evaluate(() => {
    const g = window.game;
    const crowd = g.world.cityPopulation;
    const A = g.modules.NpcWardrobeApi;
    crowd.constructor.weather = 'partly_cloudy';
    const all = window.__dressAll({ hold: false }).sort((x, y) => x.d2 - y.d2);
    const near = all.slice(0, 100);
    const sigs = near.map(({ e }) => A.outfitSignature(e.outfit));
    const counts = {};
    for (const s of sigs) counts[s] = (counts[s] ?? 0) + 1;
    const occ = {};
    const dists = {};
    const genders = {};
    for (const { e } of all) {
      occ[e.profile.occupation] = (occ[e.profile.occupation] ?? 0) + 1;
      dists[e.profile.homeDistrict] = (dists[e.profile.homeDistrict] ?? 0) + 1;
      genders[e.profile.gender] = (genders[e.profile.gender] ?? 0) + 1;
    }
    // The near models wear their walker's own outfit (the same look the far figures are drawn in)
    const slots = (crowd.models.slots ?? []).filter((s) => s.id >= 0 && s.handle && s.holder.visible);
    const matched = slots.filter((s) => crowd.wardrobe.entries.get(s.id)?.key === s.lookKey).length;
    // Cost: each frame every person drawn asks what they wear (a number compared when nothing changed)
    const t0 = performance.now();
    let k = 0;
    for (let rep = 0; rep < 50; rep++) for (const a of crowd.agents) {
      crowd.dressOf(a, crowd.variants[a.variant], false, false);
      k++;
    }
    const perCall = (performance.now() - t0) / k;
    // A first dressing (profile and outfit made from nothing)
    const saved = new Map(crowd.wardrobe.entries);
    crowd.wardrobe.entries.clear();
    const t1 = performance.now();
    for (const a of crowd.agents) crowd.dressOf(a, crowd.variants[a.variant], false, false);
    const firstMs = (performance.now() - t1) / crowd.agents.length;
    crowd.wardrobe.entries.clear();
    for (const [id, e] of saved) crowd.wardrobe.entries.set(id, e);
    return {
      people: all.length, nearby: sigs.length, unique: new Set(sigs).size, mostRepeated: Math.max(0, ...Object.values(counts)),
      occupations: occ, districts: dists, genders, models: slots.length, modelsMatched: matched,
      perCallUs: +(perCall * 1000).toFixed(2), firstDressMs: +firstMs.toFixed(3),
      examples: near.slice(0, 12).map(({ e }) => `${e.profile.occupation}/${e.profile.homeDistrict}: ${e.outfit.template} ${e.outfit.topColour} ${e.outfit.shoes}${e.outfit.hat ? ' ' + e.outfit.hat : ''}`),
    };
  });
  saveJson('street', street);
  check('npcwardrobe: the hundred people nearest the player on Broad Street are almost all dressed differently (at least 90% unique, no outfit on more than 3), across many occupations and districts, men and women',
    street.nearby === 100 && street.unique >= 90 && street.mostRepeated <= 3 && Object.keys(street.occupations).length >= 8 && Object.keys(street.districts).length >= 3 && street.genders.male > 0 && street.genders.female > 0, street);
  check('npcwardrobe: the near models wear their walker\'s own outfit (the same look as the far figures), and asking what someone wears costs microseconds a frame (under 3 µs; a first dressing under 0.3 ms)',
    street.models > 0 && street.modelsMatched === street.models && street.perCallUs < 3 && street.firstDressMs < 0.3, street);

  // A shower starts mid-morning: caps go on those who carry one (never on a close-up model); nobody changes outfit
  const shower = await page.evaluate(() => {
    const g = window.game;
    const crowd = g.world.cityPopulation;
    const w = crowd.wardrobe;
    const before = new Map(window.__dressAll().map(({ id, e }) => [id, { sig: e.outfit.template + e.outfit.topColour, hat: e.rainHat, slot: e.slot }]));
    const changes0 = w.changes;
    crowd.constructor.weather = 'rainy';
    const after = window.__dressAll();
    let capped = 0;
    let cappedWithout = 0;
    let outfitChanged = 0;
    let modelCapped = 0;
    let carriers = 0;
    for (const { id, e } of after) {
      const b = before.get(id);
      if (b.sig !== e.outfit.template + e.outfit.topColour) outfitChanged++;
      if (e.profile.capInBag && !e.outfit.hat && !crowd.models.has(id)) carriers++;
      if (e.rainHat && !b.hat) {
        capped++;
        if (!e.profile.capInBag) cappedWithout++;
        if (crowd.models.has(id)) modelCapped++;
      }
    }
    const changes = w.changes - changes0;
    crowd.constructor.weather = 'partly_cloudy';
    window.__dressAll();
    return { people: after.length, capped, carriers, cappedWithout, outfitChanged, modelCapped, changes };
  });
  check('npcwardrobe: when rain starts the people who carry a cap put it on (never a close-up model, never anyone without one), and nobody changes their outfit',
    shower.capped > 0 && shower.capped === shower.carriers && shower.cappedWithout === 0 && shower.outfitChanged === 0 && shower.modelCapped === 0 && shower.changes === 0, shower);

  // The evening on the live street: some change; those close to the player wait until they are further off
  const evening = await page.evaluate(() => {
    const g = window.game;
    const crowd = g.world.cityPopulation;
    const w = crowd.wardrobe;
    const before = new Map(window.__dressAll().map(({ id, e }) => [id, e.outfit.template + e.outfit.topColour + e.slot]));
    const c0 = w.changes;
    const h0 = w.held;
    const day = crowd.day;
    let nearChanged = 0;
    let near = 0;
    for (let h = 15; h <= 21; h += 0.25) {
      crowd.hour = h;
      for (const { id, d2, e } of window.__dressAll()) {
        if (d2 < crowd.constructor.HOLD_CHANGE2 || crowd.models.has(id)) {
          if (h === 15) near++;
          if (before.get(id) !== e.outfit.template + e.outfit.topColour + e.slot) nearChanged++;
        }
      }
    }
    crowd.setClock(10, day, 0);
    return { people: w.entries.size, changes: w.changes - c0, held: w.held - h0, near, nearChanged };
  });
  check('npcwardrobe: on the live street some people (not most) change for the evening, and nobody close to the player is seen changing (their change waits)',
    evening.changes > evening.people * 0.05 && evening.changes < evening.people * 0.7 && evening.nearChanged === 0 && (evening.near === 0 || evening.held > 0), evening);

  // ------------------------------------------------------------------ 5. Persistence
  // A rainy morning: everyone dresses afresh (as on a new day), and the regulars' choices are kept
  const rainy = await page.evaluate(() => {
    const g = window.game;
    const crowd = g.world.cityPopulation;
    const A = g.modules.NpcWardrobeApi;
    // A new day: nothing kept from earlier in the run
    localStorage.removeItem('nl_npc_wardrobe_v1');
    A.NpcWardrobeStore.shared.reset();
    crowd.wardrobe.reset();
    A.NpcWardrobeStore.shared.writes = 0;
    crowd.constructor.weather = 'rainy';
    crowd.setClock(10, crowd.day, 0);
    const all = window.__dressAll({ hold: false }).map(({ id, e }) => ({ id, important: e.important, weather: e.weather, slot: e.slot, sig: A.outfitSignature(e.outfit) }));
    A.NpcWardrobeStore.shared.flush();
    const raw = localStorage.getItem('nl_npc_wardrobe_v1');
    const bags = g.modules.CloudSyncService.getInstance().collect().bags;
    return { all, day: crowd.day, writes: A.NpcWardrobeStore.shared.writes, stored: raw ? Object.keys(JSON.parse(raw).people).length : 0, inAccountSave: Object.keys(bags).some((k) => k.startsWith('nl_npc_wardrobe')) };
  });
  // A new session, in sunshine, the same day and hour
  await reload(page, 3000);
  await closeDialogs(page);
  await page.evaluate(() => { const g = window.game; g.world.weather.setWeather('sunny', true); g.world.skyEnvironment.setHour(10); for (let i = 0; i < 6; i++) g.advance(0.25); });
  await wait(2500);
  await dressAll();
  const after = await page.evaluate((day) => {
    const g = window.game;
    const crowd = g.world.cityPopulation;
    const A = g.modules.NpcWardrobeApi;
    crowd.constructor.weather = 'sunny';
    crowd.setClock(10, day, 0);
    return window.__dressAll({ hold: false }).map(({ id, e }) => ({ id, important: e.important, weather: e.weather, slot: e.slot, sig: A.outfitSignature(e.outfit) }));
  }, rainy.day);
  const byId = new Map(after.map((r) => [r.id, r]));
  const pairs = rainy.all.map((r) => [r, byId.get(r.id)]).filter(([a, b]) => b && b.slot === a.slot);
  const regulars = pairs.filter(([a]) => a.important);
  const regularsKept = regulars.filter(([a, b]) => a.sig === b.sig && a.weather === 'rain' && b.weather === 'rain').length;
  const others = pairs.filter(([a]) => !a.important);
  const othersSunny = others.filter(([, b]) => b.weather !== 'rain').length;
  saveJson('persistence', { writes: rainy.writes, stored: rainy.stored, inAccountSave: rainy.inAccountSave, regulars: regulars.length, regularsKept, others: others.length, othersSunny });
  check('npcwardrobe: regulars (traders, shopkeepers, guards) keep the outfit they put on today across a reload though the weather changed; others dress for the new weather; one write, kept apart from the player\'s outfits and out of the account save',
    regulars.length >= 5 && regularsKept === regulars.length && othersSunny === others.length && rainy.writes === 1 && !rainy.inAccountSave && rainy.stored === rainy.all.filter((r) => r.important).length,
    { regulars: regulars.length, regularsKept, others: others.length, othersSunny, writes: rainy.writes, stored: rainy.stored, inAccountSave: rainy.inAccountSave });

  // The same weather and hour after a reload: everyone exactly as before (who they are and what they wear)
  const snapshot = () => page.evaluate(() => {
    const g = window.game;
    const crowd = g.world.cityPopulation;
    const A = g.modules.NpcWardrobeApi;
    crowd.constructor.weather = 'partly_cloudy';
    crowd.setClock(10, 3, 0);
    crowd.wardrobe.reset();
    return window.__dressAll({ hold: false }).map(({ id, e }) => [id, e.profile.occupation, e.profile.homeDistrict, e.profile.gender, A.outfitSignature(e.outfit)].join('|'));
  });
  const first = await snapshot();
  await reload(page, 3000);
  await closeDialogs(page);
  await page.evaluate(() => { const g = window.game; for (let i = 0; i < 6; i++) g.advance(0.25); });
  await wait(2500);
  await dressAll();
  const second = await snapshot();
  const identical = first.filter((s, i) => s === second[i]).length;
  check('npcwardrobe: the same person is the same person after a reload (occupation, district, body and outfit identical for the whole crowd)', first.length >= 300 && identical === first.length, { people: first.length, identical, differing: first.filter((s, i) => s !== second[i]).slice(0, 4) });
  // ------------------------------------------------------------------ 7. On the real model: every occupation, both bodies, each motion
  const shots = await page.evaluate(async (OCCUPATIONS) => {
    const g = window.game;
    const A = g.modules.NpcWardrobeApi;
    const api = g.modules.SkinnedCharacterApi;
    let programs0 = 0;
    let rows = [];
    const pics = {};
    let i = 0;
    // The first pass draws every garment once (its programs made, as any first sight of it does); the second
    // dresses everyone in other outfits of theirs, which must make nothing new
    for (const pass of [0, 1]) {
    if (pass === 1) { programs0 = g.renderer.info.programs?.length ?? 0; rows = []; }
    for (const occupation of OCCUPATIONS) {
      for (const gender of ['male', 'female']) {
        const district = occupation === 'office' ? 'business' : occupation === 'student' ? 'student' : occupation === 'market_trader' ? 'market' : 'everyday';
        const facts = { gender, occupation, home: A.FASHION[district], work: A.FASHION[district], skinTone: gender === 'female' ? '#7a4b33' : '#5c3a28', hairColor: '#0b0908', important: false, works: A.OCCUPATIONS[occupation].workdays.length > 0 };
        const e = new A.CrowdWardrobe('shots').dress(7 + i * 31 + pass * 5000, () => facts, 10, 1 + pass, 2 + pass, 'partly_cloudy', false);
        const clip = ['idle', 'walk', 'run', 'sit'][i % 4];
        let shown = [];
        const url = await api.LookPreview.shootClothes({ gender }, -0.35, 'full', (root) => {
          api.applyStreetLook(root, e.look);
          root.traverse((o) => { if (o.isMesh && o.visible && /Outfit_/.test(o.name + (o.parent?.name ?? ''))) shown.push(o.name); });
        }, clip);
        if (pass === 0) pics[`${occupation}_${gender}`] = url;
        rows.push({ occupation, gender, clip, template: e.outfit.template, shown: shown.length, ok: !!url });
        i++;
      }
    }
    }
    return { rows, pics, programsAdded: (g.renderer.info.programs?.length ?? 0) - programs0 };
  }, OCCUPATIONS);
  for (const [name, url] of Object.entries(shots.pics)) saveShot(`occ_${name}`, url);
  saveJson('shots', shots.rows);
  check('npcwardrobe: every occupation\'s outfit on both bodies drawn on the real model (idle, walk, run, sit) with its garments showing, no shader errors and no new shader programs',
    shots.rows.length === OCCUPATIONS.length * 2 && shots.rows.every((r) => r.ok && r.shown > 0) && errors.length === 0 && shots.programsAdded === 0, { rows: shots.rows.filter((r) => !r.ok || !r.shown), errors, programsAdded: shots.programsAdded });

  // District and weather pictures for the review page
  if (SHOTS) {
    const more = await page.evaluate(async () => {
      const g = window.game;
      const A = g.modules.NpcWardrobeApi;
      const api = g.modules.SkinnedCharacterApi;
      const pics = {};
      const looks = [];
      const people = [
        ['vi_m', 'male', 'casual', 'business', 5, 6], ['vi_f', 'female', 'office', 'business', 1, 2], ['yaba_m', 'male', 'student', 'student', 1, 2], ['yaba_f', 'female', 'casual', 'student', 5, 6],
        ['market_m', 'male', 'market_trader', 'market', 1, 2], ['market_f', 'female', 'market_trader', 'market', 1, 2], ['lekki_m', 'male', 'casual', 'premium_casual', 5, 6], ['lekki_f', 'female', 'casual', 'premium_casual', 5, 6],
        ['abuja_m', 'male', 'office', 'capital_formal', 1, 2], ['ph_m', 'male', 'construction', 'industrial', 1, 2],
        ['friday_m', 'male', 'office', 'business', 4, 5], ['sunday_f', 'female', 'casual', 'everyday', 6, 0],
      ];
      let k = 0;
      for (const [name, gender, occupation, f, day, wd] of people) {
        const facts = { gender, occupation, home: A.FASHION[f], work: A.FASHION[f], skinTone: gender === 'female' ? '#6b4226' : '#4a2c1d', hairColor: '#0b0908', important: false, works: A.OCCUPATIONS[occupation].workdays.length > 0 };
        // Find someone of that kind whose Friday or Sunday shows native wear
        let e = null;
        for (let s = 0; s < 40; s++) {
          e = new A.CrowdWardrobe('pics').dress(300 + k * 50 + s, () => facts, 10, day, wd, 'partly_cloudy', false);
          if (!name.startsWith('friday') && !name.startsWith('sunday')) break;
          if (e.purpose === 'occasion') break;
        }
        pics[name] = await api.LookPreview.shootClothes({ gender }, -0.35, 'full', (root) => api.applyStreetLook(root, e.look), 'idle');
        looks.push({ name, template: e.outfit.template, purpose: e.purpose });
        k++;
      }
      // One person through the weather and the day
      const facts = { gender: 'male', occupation: 'casual', home: A.FASHION.everyday, work: A.FASHION.everyday, skinTone: '#5c3a28', hairColor: '#0b0908', important: false, works: false };
      for (const [name, wx, hour] of [['wx_mild', 'partly_cloudy', 8], ['wx_rain', 'rainy', 8], ['wx_harmattan', 'harmattan', 8], ['wx_hot', 'sunny', 8]]) {
        let e = null;
        for (let s = 0; s < 60; s++) {
          e = new A.CrowdWardrobe('pics').dress(9001 + s, () => facts, hour, 5, 6, wx, false);
          if (wx === 'partly_cloudy' || e.outfit.adjusted) break;
        }
        pics[name] = await api.LookPreview.shootClothes({ gender: 'male' }, -0.35, 'full', (root) => api.applyStreetLook(root, e.look), 'walk');
        looks.push({ name, template: e.outfit.template, adjusted: e.outfit.adjusted ?? '' });
      }
      return { pics, looks };
    });
    for (const [name, url] of Object.entries(more.pics)) saveShot(name, url);
    saveJson('looks', more.looks);
    // The street itself, at three distances
    await page.evaluate(() => { const g = window.game; g.world.weather.setWeather('sunny', true); g.world.skyEnvironment.setHour(11); for (let i = 0; i < 6; i++) g.advance(0.25); });
    await wait(2500);
    await page.screenshot({ path: path.join(SHOTS, 'street_broad.jpg'), type: 'jpeg', quality: 82 });
  }
  // ------------------------------------------------------------------ The other cities: their own districts and taste
  const cities = {};
  for (const city of ['abuja', 'port_harcourt']) {
    await page.evaluate((c) => window.game.arriveInCity(c), city);
    await wait(3500);
    cities[city] = await page.evaluate(() => {
      const g = window.game;
      const life = g.world.cityManager.lifeHere();
      const crowd = life.crowd;
      const A = g.modules.NpcWardrobeApi;
      crowd.setClock(10, 1, 0);
      const rows = crowd.agents.map((a) => crowd.dressOf(a, crowd.variants[a.variant], false, false));
      const tally = (f) => { const m = {}; for (const e of rows) { const k = f(e); m[k] = (m[k] ?? 0) + 1; } return m; };
      const sigs = rows.map((e) => A.outfitSignature(e.outfit));
      return { city: crowd.wardrobe.city, people: rows.length, unique: +(new Set(sigs).size / rows.length).toFixed(3), districts: tally((e) => e.profile.homeDistrict), fashion: tally((e) => e.profile.home.id), occupations: Object.keys(tally((e) => e.profile.occupation)).length };
    });
  }
  saveJson('cities', cities);
  const lagosIds = ['victoria_island', 'lagos_island', 'yaba', 'ikeja', 'mainland', 'lekki', 'banana_island', 'eko_atlantic', 'airport', 'surulere', 'port_apapa', 'ajah'];
  check('npcwardrobe: Abuja and Port Harcourt crowds dress by their own districts (not the Lagos ones), in many occupations, almost all differently',
    ['abuja', 'port_harcourt'].every((c) => cities[c].city === c && cities[c].people > 200 && cities[c].unique >= 0.85 && cities[c].occupations >= 6 && Object.keys(cities[c].districts).every((d) => !lagosIds.includes(d))), cities);

  check('npcwardrobe: no shader errors anywhere in the run', errors.length === 0, errors);
  await ctx.close();
}
