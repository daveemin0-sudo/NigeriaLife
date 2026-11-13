// The living city, stage 1: the crowd at three levels of detail.
//
// People the camera can see are moved every frame, as before. People in range but out of view are
// moved every second frame, and people out of range (or at home at that hour) every fourth, each by
// all the time that has passed since their turn. So the street costs a fraction of the work and
// nobody falls behind: a walker far from the player is where their pace would have taken them.
import { newPlayer, open, closeDialogs, wait } from './lib.mjs';

export async function run(browser, check) {
  const ctx = await newPlayer(browser);
  const { page, log } = await open(ctx, { w: 316, h: 700 });
  await closeDialogs(page);

  const crowdNow = (hour) => page.evaluate(async (hour) => {
    const g = window.game;
    const w = g.world;
    w.skyEnvironment.setHour(hour);
    for (let i = 0; i < 8; i++) g.advance(0.25);
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    const city = w.cityManager.currentCityId;
    const crowd = city === 'lagos' ? w.cityPopulation : w.cityManager.lifeHere().crowd;
    const p = g.player.position;
    const frustum = w.frustumNow();
    let moved = 0;
    let seen = 0;
    const frames = 16;
    for (let i = 0; i < frames; i++) {
      crowd.update(1 / 30, p, frustum);
      moved += crowd.movedNow;
      seen += crowd.seenNow;
    }
    const drawn = crowd.variants.reduce((n, v) => n + v.drawn + v.drawnFar, 0);
    return { city, hour, agents: crowd.agents.length, out: crowd.outNow, movedPerFrame: +(moved / frames).toFixed(1), seenPerFrame: +(seen / frames).toFixed(1), seenLast: crowd.seenNow, drawn };
  }, hour);

  // ------------------------------------------------------------------ Lagos: a fraction of the work
  const morning = await crowdNow(8);
  const night = await crowdNow(2);
  // (Since stage 3, commuters are indoors at work by 8 and are not moved at all: so fewer are out)
  check('livingcity: on Broad Street at 8 am the street is busy, and well under half of the crowd are moved in any one frame (the rest wait their turn, or are indoors)',
    morning.agents > 300 && morning.out > morning.agents * 0.35 && morning.movedPerFrame < morning.agents * 0.45 && morning.movedPerFrame >= morning.out / 4 - 1, morning);
  check('livingcity: those who are drawn are exactly those moved as seen: nobody in view is skipped',
    morning.drawn === morning.seenLast && morning.drawn > 0, morning);
  check('livingcity: at 2 am most are at home and the street costs less again', night.out < morning.out * 0.2 && night.movedPerFrame < morning.movedPerFrame, night);

  // ------------------------------------------------------------------ Nobody falls behind
  const pace = await page.evaluate(() => {
    const g = window.game;
    const w = g.world;
    w.skyEnvironment.setHour(8);
    const crowd = w.cityPopulation;
    // The crowd hears the hour from the game loop: tell it now, before choosing who to watch
    crowd.setClock(8, w.skyEnvironment.day, 0);
    const p = g.player.position;
    const SECONDS = 4;
    const frustum = w.frustumNow();
    // Plain walkers out of the player's range, with room ahead of them for the whole test
    const picked = crowd.agents.filter((a) => {
      if (a.mode !== 'walk' || a.errand || a.willCross || a.xing || a.stop !== undefined || a.crossing !== undefined) return false;
      // Street walkers out walking their pavement (commuters follow routes, and those at home do not move)
      if (a.life && (a.life.work >= 0 || a.life.state !== 'stroll')) return false;
      if (Math.hypot(a.x - p.x, a.z - p.z) < crowd.drawDistance + 15) return false;
      const along = a.axis === 'x' ? a.x : a.z;
      const room = a.dir > 0 ? a.max - along : along - a.min;
      // Nor anyone whose way runs over a side road in that time (they wait at its kerb for the lights)
      const end = along + a.dir * (a.speed * SECONDS + 1);
      if (a.onMainWalk && a.axis === 'z' && (crowd.plan.gaps ?? []).some((g) => Math.max(along, end) > g.from - 1 && Math.min(along, end) < g.to + 1)) return false;
      return room > a.speed * SECONDS + 2;
    });
    const before = picked.map((a) => ({ at: a.axis === 'x' ? a.x : a.z, dir: a.dir }));
    // The crowd's own clock, a frame at a time (the game's fast-forward does not run it in full)
    for (let k = 0; k < SECONDS * 30; k++) crowd.update(1 / 30, p, frustum);
    // Someone who turned back on the way is not a measure of pace
    const kept = picked.map((a, i) => ({ a, was: before[i] })).filter(({ a, was }) => a.dir === was.dir && !a.errand && !a.xing && a.crossing === undefined && (!a.life || a.life.state === 'stroll')).slice(0, 40);
    const off = kept.map(({ a, was }) => Math.abs(Math.abs((a.axis === 'x' ? a.x : a.z) - was.at) - a.speed * SECONDS));
    return { n: kept.length, worst: +Math.max(...off).toFixed(2), mean: +(off.reduce((t, v) => t + v, 0) / off.length).toFixed(2) };
  });
  check('livingcity: walkers far out of range, watched for four seconds of the crowd\'s clock, are each within 0.3 m of where their own pace puts them (a turn is at most three frames late)',
    pace.n >= 20 && pace.worst < 0.3, pace);

  // ------------------------------------------------------------------ Turn round: they are there
  const turned = await page.evaluate(async () => {
    const g = window.game;
    const w = g.world;
    w.skyEnvironment.setHour(8);
    const crowd = w.cityPopulation;
    const count = () => crowd.variants.reduce((n, v) => n + v.drawn + v.drawnFar, 0);
    const seen = [];
    for (const yaw of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) {
      g.cameraManager.yaw = yaw;
      for (let i = 0; i < 6; i++) g.advance(0.25);
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      seen.push(count());
    }
    return seen;
  });
  check('livingcity: looking each way along and across the street, people are drawn in every direction that has pavement in it', turned.filter((n) => n > 0).length >= 3, turned);

  // ------------------------------------------------------------------ Stage 2: crossing the road
  // A minute of the street, traffic and crowd a frame at a time: who crosses, who gives up, and
  // whether a moving vehicle's body ever covers someone out on the carriageway.
  const crossings = (hour, seconds) => page.evaluate((hour, seconds) => {
    const g = window.game;
    const w = g.world;
    const city = w.cityManager.currentCityId;
    const life = city === 'lagos' ? null : w.cityManager.lifeHere();
    const crowd = life ? life.crowd : w.cityPopulation;
    const traffic = life ? life.traffic : w.trafficSpawner;
    const B = g.modules.Bodies;
    const p = g.player.position;
    const frustum = w.frustumNow();
    w.skyEnvironment.setHour(hour);
    // The crowd hears the hour from the game loop: tell it now, and keep its clock going through the minute
    const day = w.skyEnvironment.day;
    crowd.setClock(hour, day, 0);
    const c0 = crowd.crossed;
    const g0 = crowd.gaveUp;
    let hits = 0;
    let heldFrames = 0;
    let waitedMax = 0;
    const backs = new Set();
    const gaveUpAt = {};
    const steps = seconds * 30;
    let cost = 0;
    for (let k = 0; k < steps; k++) {
      const t0 = performance.now();
      crowd.setClock(hour + k / 30 / 3600, day, 1 / 30);
      traffic.update(1 / 30, p, frustum);
      crowd.update(1 / 30, p, frustum);
      cost += performance.now() - t0;
      if (traffic.heldForWalkers > 0) heldFrames++;
      for (const person of crowd.onRoad) {
        for (const car of B.carsNear(person.x, person.z, 8)) {
          if (car.parked) continue;
          const dx = person.x - car.x;
          const dz = person.z - car.z;
          const s = Math.sin(car.yaw);
          const c = Math.cos(car.yaw);
          if (Math.abs(dx * s + dz * c) < car.halfLength + 0.2 && Math.abs(dx * c - dz * s) < car.halfWidth + 0.2) hits++;
        }
      }
      for (const a of crowd.agents) {
        if (a.xing?.phase === 'wait') waitedMax = Math.max(waitedMax, a.xing.waited);
        // Where anyone gives up (for the report)
        if (a.xing?.back && !backs.has(a.xing)) {
          backs.add(a.xing);
          const key = `${a.xing.c.kind}${a.xing.c.group ? '/' + a.xing.c.group : ''} ${a.xing.bx.toFixed(0)},${a.xing.bz.toFixed(0)}`;
          gaveUpAt[key] = (gaveUpAt[key] ?? 0) + 1;
        }
      }
    }
    return { gaveUpAt, city, hour, seconds, perMinute: +((crowd.crossed - c0) / (seconds / 60)).toFixed(1), crossed: crowd.crossed - c0, gaveUp: crowd.gaveUp - g0, hits, heldShare: +(heldFrames / steps).toFixed(2), waitedMax: +waitedMax.toFixed(1), moving: traffic.moving.now, msPerFrame: +(cost / steps).toFixed(2) };
  }, hour, seconds);
  const crossCheck = (name, r) => {
    // (Since stage 3 office workers are indoors in working hours, so fewer are out to cross: Abuja most of all)
    // (Two minutes at a time: a single minute's count swings by half either way. The bar is that people
    // do cross, not a quota: Abuja, the quiet capital, measures 19.5 to 26 a minute at 2 pm.)
    check(`livingcity: ${name} at ${r.hour}:00, two minutes of the street: at least 15 a minute cross the roads, and no moving vehicle is ever on top of someone crossing`, r.perMinute >= 15 && r.hits === 0, r);
    check(`livingcity: ${name}: people wait at the kerb for the lights or a gap, but almost nobody gives up and turns back, and the traffic keeps moving`, r.gaveUp <= Math.max(2 * (r.seconds / 60), r.crossed * 0.08) && r.heldShare < 0.9 && r.moving > 40, r);
  };
  crossCheck('Lagos', await crossings(8, 120));
  crossCheck('Lagos', await crossings(14, 120));
  crossCheck('Lagos', await crossings(13, 120));

  // ------------------------------------------------------------------ Stage 3: their days
  // Each walker has a role, a home at the edge of the map and (commuters) a workplace among the
  // city's real doors. The clock is jumped to an hour (as sleeping does) and the street then run.
  // The day is pinned to a Wednesday so the test means the same whichever day it is run.
  const dayOf = () => page.evaluate(() => {
    const g = window.game;
    const w = g.world;
    const city = w.cityManager.currentCityId;
    const life = city === 'lagos' ? null : w.cityManager.lifeHere();
    const crowd = life ? life.crowd : w.cityPopulation;
    const p = g.player.position;
    const frustum = w.frustumNow();
    const cal = g.modules.Hours.calendar;
    const realWeekday = cal.weekday;
    cal.weekday = () => 3;
    const residents = crowd.agents.filter((a) => a.life);
    const commuters = residents.filter((a) => a.life.work >= 0);
    const walkers = crowd.agents.filter((a) => a.life && a.stall === undefined).length;
    const roles = {};
    for (const a of residents) roles[a.life.role] = (roles[a.life.role] ?? 0) + 1;
    const kinds = {};
    for (const pl of crowd.places) kinds[pl.kind] = (kinds[pl.kind] ?? 0) + 1;
    const DAY = 40;
    const at = (hour) => {
      crowd.setClock(hour, DAY, 0);
      for (let k = 0; k < 60; k++) {
        crowd.setClock(hour + k / 30 / 3600, DAY, 1 / 30);
        crowd.update(1 / 30, p, frustum);
      }
      const t0 = performance.now();
      for (let k = 0; k < 60; k++) crowd.update(1 / 30, p, frustum);
      const ms = +((performance.now() - t0) / 60).toFixed(3);
      const state = {};
      for (const a of residents) state[a.life.state] = (state[a.life.state] ?? 0) + 1;
      // Commuters whose plan has them at work now, and how many of them are (in, at the pitch, or on the way)
      const due = commuters.filter((a) => {
        const plan = a.life.plan;
        let k = -1;
        for (let i = 0; i < plan.length; i++) if (plan[i].at <= hour) k = i;
        return k >= 0 && (plan[k].kind === 'in' || plan[k].kind === 'pitch');
      });
      const atWork = due.filter((a) => a.life.state === 'in' || a.life.state === 'pitch' || a.life.state === 'going').length;
      // Inside a place that shut over an hour ago (staff may stay on a little after closing)
      const inShut = commuters.filter((a) => a.life.state === 'in' && !crowd.openAt(crowd.places[a.life.place], hour) && !crowd.openAt(crowd.places[a.life.place], hour - 1)).length;
      const stalls = crowd.stallUp.length;
      const stallsUp = crowd.stallUp.filter(Boolean).length;
      const fabricUp = city === 'lagos' ? crowd.stallUp.filter((_, i) => w.cityDensity.fabric.isStallOpen(i)).length : 0;
      // Out for lunch or an errand: in a place that is not their work, or at a stall's counter, or on the way to one
      const away = residents.filter((a) => a.life.state === 'buy' || (a.life.state === 'in' && a.life.place !== a.life.work) || (a.life.state === 'going' && (a.life.then === 'buy' || (a.life.then === 'in' && a.life.place !== a.life.work))));
      const visitShut = away.filter((a) => a.life.state !== 'going' && !crowd.openAt(crowd.places[a.life.place], hour)).length;
      const buying = residents.filter((a) => a.life.state === 'buy').length;
      const serving = residents.filter((a) => a.life.state === 'pitch' && a.mode === 'talk').length;
      const servedStalls = crowd.buyers.filter((n) => n > 0).length;
      // Those whose plan has them back at their own work now, and how many are (in, or on the way)
      const back = commuters.filter((a) => {
        const plan = a.life.plan;
        let k = -1;
        for (let i = 0; i < plan.length; i++) if (plan[i].at <= hour) k = i;
        return k > 1 && plan[k].kind === 'in' && plan[k].place === a.life.work;
      });
      const backAtWork = back.filter((a) => (a.life.state === 'in' && a.life.place === a.life.work) || a.life.state === 'going').length;
      return { hour, state, out: crowd.outNow, due: due.length, atWork, inShut, stalls, stallsUp, fabricUp, away: away.length, visitShut, buying, serving, servedStalls, back: back.length, backAtWork, ms };
    };
    const night = at(3);
    const work = at(10.5);
    const midday = at(13);
    const afternoon = at(15.5);
    const evening = at(19);
    const late = at(22);
    // A morning on the fast clock (an hour each 25 s, as after sleeping): who sets out, who gets
    // there, and whether anyone is stuck (out walking, not waiting at a kerb, not moved in 10 s)
    crowd.setClock(5.5, DAY, 0);
    const s0 = crowd.setOut;
    const a0 = crowd.arrived;
    const frames = 3000;
    for (let k = 0; k < frames; k++) {
      crowd.setClock(5.5 + k * (0.04 / 30), DAY, 1 / 30);
      crowd.update(1 / 30, p, frustum);
    }
    const was = new Map();
    for (const a of residents) if (a.life.state === 'going') was.set(a, [a.x, a.z]);
    for (let k = 0; k < 300; k++) {
      crowd.setClock(5.5 + (frames + k) * (0.04 / 30), DAY, 1 / 30);
      crowd.update(1 / 30, p, frustum);
    }
    let stuck = 0;
    const stuckAt = [];
    for (const [a, [x, z]] of was) {
      if (a.life.state === 'going' && a.xing?.phase !== 'wait' && Math.hypot(a.x - x, a.z - z) < 0.5) {
        stuck++;
        if (stuckAt.length < 3) stuckAt.push({ x: +a.x.toFixed(1), z: +a.z.toFixed(1), xing: a.xing?.phase ?? null, blocked: a.xing?.blocked ?? null, node: a.life.node, wnode: a.life.wnode, goal: a.life.goal, then: a.life.then, w: [+a.life.wx.toFixed(1), +a.life.wz.toFixed(1)] });
      }
    }
    const morning = { setOut: crowd.setOut - s0, arrived: crowd.arrived - a0, stuck, stuckAt };
    // Lunch hours as planned for this Wednesday: when each commuter goes, and how spread out that is
    const lunches = commuters.map((a) => a.life.plan.find((st, i) => i > 0 && st.place !== a.life.work && (st.kind === 'in' || st.kind === 'buy'))?.at).filter((t) => t !== undefined);
    const mean = lunches.reduce((t, v) => t + v, 0) / Math.max(1, lunches.length);
    const spread = Math.sqrt(lunches.reduce((t, v) => t + (v - mean) * (v - mean), 0) / Math.max(1, lunches.length));
    const lunch = { n: lunches.length, first: +Math.min(...lunches).toFixed(2), last: +Math.max(...lunches).toFixed(2), mean: +mean.toFixed(2), spread: +spread.toFixed(2) };
    // The network in one piece? (Places that cannot be reached from any edge of the map)
    const net = crowd.network;
    const unreachable = crowd.places.filter((pl) => !net.homes.some((h) => net.reaches(h, pl.node))).length;
    cal.weekday = realWeekday;
    return { city, agents: crowd.agents.length, walkers, commuters: commuters.length, places: crowd.places.length, kinds, roles, nodes: crowd.network.nodes.length, homes: crowd.network.homes.length, night, work, midday, afternoon, evening, late, morning, lunch, unreachable };
  });
  const days = {};
  const dayCheck = (name, d) => {
    days[name] = d;
    check(`livingcity: ${name}: the walkers have lives - a pavement network to walk (${d.nodes} points), the city's own doors to go to (${d.places}), and at least a quarter of them a workplace`,
      d.nodes > 50 && d.homes >= 4 && d.places >= 15 && d.commuters >= d.walkers * 0.25, { nodes: d.nodes, homes: d.homes, places: d.places, kinds: d.kinds, commuters: d.commuters, walkers: d.walkers, roles: d.roles });
    check(`livingcity: ${name} at 3 am: every commuter is at home and the street is nearly empty`,
      (d.night.state.going ?? 0) + (d.night.state.in ?? 0) + (d.night.state.pitch ?? 0) === 0 && d.night.out < d.agents * 0.12, d.night);
    check(`livingcity: ${name} at 10:30 on a Wednesday: those due at work are there (in, at their stall, or still on the way), and nobody is inside a place that is shut`,
      d.work.due > 20 && d.work.atWork >= d.work.due * 0.95 && d.work.inShut === 0, d.work);
    check(`livingcity: ${name} at 1 pm and 7 pm: nobody is inside a place that shut over an hour ago`, d.midday.inShut === 0 && d.evening.inShut === 0, { midday: d.midday, evening: d.evening });
    check(`livingcity: ${name} on the fast clock, 5:30 to 9:30: commuters set out from the edges of the map and get to their doors, and nobody is stuck on the way`,
      d.morning.setOut >= d.commuters * 0.5 && d.morning.arrived >= d.commuters * 0.3 && d.morning.stuck === 0, d.morning);
    check(`livingcity: ${name}: the crowd's update stays under 1 ms a frame at 10:30, 1 pm, 3:30 pm and 7 pm`,
      d.work.ms < 1 && d.midday.ms < 1 && d.afternoon.ms < 1 && d.evening.ms < 1, { work: d.work.ms, midday: d.midday.ms, afternoon: d.afternoon.ms, evening: d.evening.ms });
    // Stage 3b: lunch and errands
    check(`livingcity: ${name}: every place on the network can be walked to from the edge of the map`, d.unreachable === 0, { unreachable: d.unreachable, places: d.places });
    check(`livingcity: ${name}: commuters take lunch at their own times (spread over at least an hour and a half, not all at once)`,
      d.lunch.n >= d.commuters * 0.5 && d.lunch.last - d.lunch.first >= 1.5 && d.lunch.spread >= 0.3, d.lunch);
    check(`livingcity: ${name} at 1 pm: people are out at lunch or on errands (a buka, a stall, a shop), and none of them at a place that is shut`,
      d.midday.away >= d.commuters * 0.1 && d.midday.visitShut === 0, d.midday);
    check(`livingcity: ${name} at 3:30 pm: lunch is over, and those due back at work are there or on the way`,
      d.afternoon.back > 20 && d.afternoon.backAtWork >= d.afternoon.back * 0.95, d.afternoon);
  };
  const lagosDay = await dayOf();
  dayCheck('Lagos', lagosDay);
  check('livingcity: Lagos stalls: all packed away at 3 am and 10 pm, put up by their traders by 10:30 (as drawn, not only as counted)',
    lagosDay.night.stalls >= 10 && lagosDay.night.stallsUp === 0 && lagosDay.late.stallsUp === 0 && lagosDay.work.stallsUp >= lagosDay.work.stalls * 0.9 && lagosDay.work.fabricUp === lagosDay.work.stallsUp,
    { night: lagosDay.night, work: lagosDay.work, late: lagosDay.late });
  check('livingcity: Lagos at 1 pm: people buy at the stalls, and the traders serve them (a trader with someone at the counter is busy serving)',
    lagosDay.midday.buying > 0 && lagosDay.midday.serving >= lagosDay.midday.servedStalls - 1 && lagosDay.midday.servedStalls > 0, lagosDay.midday);

  // ------------------------------------------------------------------ Stage 3c: evening and night
  // The same pinned Wednesday. Each hour is jumped to (as sleeping does), then the street run.
  const nightOf = () => page.evaluate(() => {
    const g = window.game;
    const w = g.world;
    const city = w.cityManager.currentCityId;
    const life = city === 'lagos' ? null : w.cityManager.lifeHere();
    const crowd = life ? life.crowd : w.cityPopulation;
    const p = g.player.position;
    const frustum = w.frustumNow();
    const cal = g.modules.Hours.calendar;
    const realWeekday = cal.weekday;
    const DAY = 60;
    const residents = crowd.agents.filter((a) => a.life);
    const commuters = residents.filter((a) => a.life.work >= 0);
    const owls = residents.filter((a) => a.life.role === 'owl');
    // A jump to an hour of the night (past midnight is the next day, a Thursday)
    const at = (hour) => {
      const day = hour >= 24 ? DAY + 1 : DAY;
      const h = hour >= 24 ? hour - 24 : hour;
      cal.weekday = () => (hour >= 24 ? 4 : 3);
      crowd.setClock(h, day, 0);
      for (let k = 0; k < 60; k++) {
        crowd.setClock(h + k / 30 / 3600, day, 1 / 30);
        crowd.update(1 / 30, p, frustum);
      }
      const t0 = performance.now();
      for (let k = 0; k < 60; k++) crowd.update(1 / 30, p, frustum);
      const ms = +((performance.now() - t0) / 60).toFixed(3);
      const visible = crowd.agents.filter((a) => crowd.isOut(a, a.id));
      // Out of an evening: inside, or standing about outside, a buka, a bar or club, a hotel lounge
      const atVenue = residents.filter((a) => (a.life.state === 'in' || a.life.state === 'hang') && a.life.place !== a.life.work && ['food', 'night', 'hotel'].includes(crowd.places[a.life.place]?.kind));
      const shut = residents.filter((a) => (a.life.state === 'in' || a.life.state === 'hang' || a.life.state === 'buy') && a.life.place !== a.life.work && !crowd.openAt(crowd.places[a.life.place], h)).length;
      const outside = residents.filter((a) => a.life.state === 'hang').length;
      const owlsOut = owls.filter((a) => a.life.state !== 'home').length;
      const owlsAtVenue = atVenue.filter((a) => a.life.role === 'owl').length;
      // How spread about the city those still out are: 40 m squares with someone in them
      const cells = new Set(visible.map((a) => `${Math.floor(a.x / 40)},${Math.floor(a.z / 40)}`)).size;
      return { hour, out: visible.length, cells, atVenue: atVenue.length, outside, shut, owlsOut, owlsAtVenue, ms };
    };
    const curve = [17, 19, 21, 23, 24.5, 26, 27.5].map(at);
    // Workers' home time against the hours their own workplace keeps (students excepted)
    cal.weekday = () => 3;
    let early = 0;
    let checked = 0;
    for (const a of commuters) {
      if (a.life.role === 'student') continue;
      const plan = crowd.planFor(a, a.life, DAY, 3);
      const h = crowd.places[a.life.work].hours;
      if (!h || !(h.closes > h.opens) || h.closes > 24 || !plan.length) continue;
      const lastWork = plan.reduce((k, st, i) => (st.place === a.life.work ? i : k), -1);
      const home = plan.slice(lastWork + 1).find((st) => st.kind === 'home' || st.place !== a.life.work);
      checked += 1;
      if (!home || home.at < h.closes) early += 1;
    }
    cal.weekday = realWeekday;
    return { city, agents: crowd.agents.length, owls: owls.length, curve, home: { checked, early } };
  });
  // Is everyone where their plan has them at the crowd's hour? (On the way counts, for a step begun
  // within the hour; a street walker in the player's view may not yet have stepped out or in.)
  await page.evaluate(() => {
    window.__resumed = () => {
    const g = window.game;
    const w = g.world;
    const city = w.cityManager.currentCityId;
    const life = city === 'lagos' ? null : w.cityManager.lifeHere();
    const crowd = life ? life.crowd : w.cityPopulation;
    const hour = crowd.hour;
    let wrong = 0;
    let n = 0;
    const examples = [];
    for (const a of crowd.agents) {
      const l = a.life;
      if (!l) continue;
      n += 1;
      let k = -1;
      for (let i = 0; i < l.plan.length; i++) if (l.plan[i].at <= hour) k = i;
      const step = k >= 0 ? l.plan[k] : { kind: 'home', at: -99 };
      const place = step.place !== undefined ? crowd.places[step.place] : null;
      const shut = place && (step.kind === 'in' || step.kind === 'hang' || step.kind === 'buy') && !crowd.openAt(place, hour);
      const ok = l.state === step.kind || (l.state === 'going' && hour - step.at < 1) || (shut && (l.state === 'home' || l.state === 'stroll' || l.state === 'going'))
        || (l.state === 'going' && step.kind === 'home') || (l.work < 0 && crowd.lastSeen.has(a)) || (step.kind === 'in' && place && l.state === 'in');
      if (!ok) {
        wrong += 1;
        if (examples.length < 3) examples.push({ role: l.role, state: l.state, want: step.kind, at: +step.at.toFixed(2), hour: +hour.toFixed(2) });
      }
    }
    return { city, hour: +hour.toFixed(2), residents: n, wrong, examples };
    };
  });
  const resumed = () => page.evaluate(() => window.__resumed());
  const nightCheck = (name, d) => {
    const c = d.curve;
    const byHour = Object.fromEntries(c.map((x) => [x.hour, x]));
    // From 7 pm on, each hour no busier than the one before (give or take 3% of the crowd)
    const fading = c.slice(1).every((x, i) => i === 0 || x.out <= c[i].out + d.agents * 0.03);
    check(`livingcity: ${name}: the street empties gradually through the night (7 pm to 3:30 am, never busier than the hour before), and at 11 pm people are still out in several parts of town`,
      fading && byHour[19].out > byHour[27.5].out && byHour[23].out > 0 && byHour[23].cells >= 3, c.map((x) => ({ h: x.hour, out: x.out, cells: x.cells })));
    check(`livingcity: ${name} at 9 pm and 11 pm: people are out at bukas, bars and hotel lounges (inside, or standing about outside), and none at a place that is shut`,
      byHour[21].atVenue > 0 && c.every((x) => x.shut === 0), c.map((x) => ({ h: x.hour, atVenue: x.atVenue, outside: x.outside, shut: x.shut })));
    check(`livingcity: ${name}: night owls are out late, after midnight at the clubs and hotel bars that are open then, and home by 3:30 am`,
      byHour[23].owlsOut > 0 && byHour[27.5].owlsOut === 0 && byHour[24.5].shut === 0, c.map((x) => ({ h: x.hour, owlsOut: x.owlsOut, owlsAtVenue: x.owlsAtVenue })));
    check(`livingcity: ${name}: every worker's day ends at or after their workplace's actual closing time`, d.home.checked > 20 && d.home.early === 0, d.home);
    check(`livingcity: ${name}: the crowd's update stays under 1 ms a frame at 9 pm, 11 pm and 12:30 am`, byHour[21].ms < 1 && byHour[23].ms < 1 && byHour[24.5].ms < 1, { '21': byHour[21].ms, '23': byHour[23].ms, '0:30': byHour[24.5].ms });
  };
  const nightsLagos = await nightOf();
  nightCheck('Lagos', nightsLagos);
  // Crossing at 9 pm: no artificial quota at night, only safety
  {
    const r = await crossings(21, 120);
    check('livingcity: Lagos at 9 pm, two minutes of the street: no moving vehicle is ever on top of someone crossing, and almost nobody gives up', r.hits === 0 && r.gaveUp <= Math.max(4, r.crossed * 0.08), r);
  }
  // After sleeping: from 11 pm to 7:30 the next morning in one jump, and after fast-forwarding 4 pm to 8 pm on the fast clock
  // (Each jump and its check in one go: between calls the game's own loop sets the crowd's clock)
  const afterSleep = await page.evaluate(() => {
    const g = window.game;
    const w = g.world;
    const crowd = w.cityPopulation;
    const p = g.player.position;
    const frustum = w.frustumNow();
    crowd.setClock(23, 70, 0);
    for (let k = 0; k < 30; k++) crowd.update(1 / 30, p, frustum);
    crowd.setClock(7.5, 71, 0);
    for (let k = 0; k < 30; k++) { crowd.setClock(7.5 + k / 30 / 3600, 71, 1 / 30); crowd.update(1 / 30, p, frustum); }
    return window.__resumed();
  });
  const afterFast = await page.evaluate(() => {
    const g = window.game;
    const w = g.world;
    const crowd = w.cityPopulation;
    const p = g.player.position;
    const frustum = w.frustumNow();
    crowd.setClock(16, 72, 0);
    for (let k = 0; k < 3600; k++) { crowd.setClock(16 + k * (0.04 / 30) * (4 / 4.8), 72, 1 / 30); crowd.update(1 / 30, p, frustum); }
    return window.__resumed();
  });
  check('livingcity: Lagos after sleeping (11 pm to 7:30 the next morning) and after fast-forwarding (4 pm to 8 pm on the fast clock): at least 97% of the crowd are where their day has them',
    Math.abs(afterSleep.hour - 7.5) < 0.1 && Math.abs(afterFast.hour - 20) < 0.1 && afterSleep.wrong <= afterSleep.residents * 0.03 && afterFast.wrong <= afterFast.residents * 0.03, { afterSleep, afterFast });

  // ------------------------------------------------------------------ The other cities
  for (const city of ['abuja', 'port_harcourt']) {
    await page.evaluate((c) => window.game.arriveInCity(c), city);
    await wait(3500);
    const there = await crowdNow(8);
    const name = city === 'abuja' ? 'Abuja' : 'Port Harcourt';
    check(`livingcity: ${name} at 8 am: its own crowd is out, and well under half of them are moved in any one frame`,
      there.city === city && there.agents > 300 && there.out > there.agents * 0.2 && there.movedPerFrame < there.agents * 0.45, there);
    crossCheck(name, await crossings(14, 120));
    crossCheck(name, await crossings(13, 120));
    dayCheck(name, await dayOf());
    nightCheck(name, await nightOf());
  }
  // Each city its own day: Abuja a city of offices that empties early, Port Harcourt of trades and shifts
  const share = (d, role) => (d.roles[role] ?? 0) / d.walkers;
  const [L, A, P] = [days.Lagos, days.Abuja, days['Port Harcourt']];
  check('livingcity: each city its own pattern: Abuja has the most office workers, Port Harcourt the most artisans and tradespeople, and Abuja is the quietest at 10 pm',
    share(A, 'office') > share(L, 'office') && share(A, 'office') > share(P, 'office') && share(P, 'artisan') > share(L, 'artisan') && share(P, 'artisan') > share(A, 'artisan') &&
      A.late.out / A.agents < L.late.out / L.agents && A.late.out / A.agents < P.late.out / P.agents,
    { office: [share(L, 'office'), share(A, 'office'), share(P, 'office')].map((v) => +v.toFixed(2)), artisan: [share(L, 'artisan'), share(A, 'artisan'), share(P, 'artisan')].map((v) => +v.toFixed(2)), lateOut: [L, A, P].map((d) => +(d.late.out / d.agents).toFixed(2)) });
  // Changing cities: back to Lagos at 9 pm, its crowd picks up where its day has it
  await page.evaluate(() => { window.game.arriveInCity('lagos'); });
  await wait(3500);
  await page.evaluate(() => window.game.world.skyEnvironment.setHour(21));
  await wait(1500);
  const backInLagos = await resumed();
  check('livingcity: back in Lagos from Port Harcourt, at 9 pm: at least 97% of its crowd are where their day has them',
    backInLagos.city === 'lagos' && backInLagos.wrong <= backInLagos.residents * 0.03, backInLagos);
  check('livingcity: no errors in the page', log.errors.length === 0, log.errors.slice(0, 4));
  await ctx.close();
}
