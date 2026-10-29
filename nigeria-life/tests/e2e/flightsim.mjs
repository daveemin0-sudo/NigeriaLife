// A flight flown through from the stand to the stand: every stage in turn, the jet bridge and
// the tug, the gear and the flaps, the climb to the cruise and the touchdown, the trolley
// reaching the player, the captain and the crew speaking, the window seat looking out, and
// the cost of drawing it kept inside what a phone can draw.
import { open, newPlayer, closeDialogs, advance, wait } from './lib.mjs';

export async function run(browser, check) {
  const ctx = await newPlayer(browser);
  const { page, log } = await open(ctx);
  await closeDialogs(page);
  const hunger0 = await page.evaluate(() => {
    const g = window.game;
    g.world.skyEnvironment.setHour(13);
    const b = g.hud.backend; b.data.stats.hunger = 30; b.saveData();
    window.__lines = [];
    const fe = g.flightExperience;
    const was = fe.onAnnouncement;
    fe.onAnnouncement = (t) => { window.__lines.push(t); was?.(t); };
    g.world.setStreetModeVisibility(false);
    g.player.mesh.visible = false;
    const details = { flightCode: 'NL 204', airlineName: 'NigeriaLife Air', travelClass: 'Economy · seat 14A', tailNumber: '5N-NLA', originId: 'lagos', destinationId: 'abuja', originCode: 'LOS', destinationCode: 'ABV', originName: 'Murtala Muhammed International Airport (LOS)', destinationName: 'Nnamdi Azikiwe International Airport (ABV)', durationSeconds: 120 };
    fe.startFlight(details);
    g.transitHUD.showFlightHUD(details);
    return b.getData().stats.hunger;
  });

  // Step through, a quarter second at a time, and note what the aircraft is doing
  const trace = await page.evaluate(async () => {
    const g = window.game;
    const fe = g.flightExperience;
    const seen = [];
    const at = {};
    let bridgeAt0 = null;
    let bridgeLater = null;
    let tug = false;
    for (let i = 0; i < 520 && fe.isActive; i++) {
      g.advance(0.25);
      const p = fe.pose;
      if (seen[seen.length - 1] !== p.stage) seen.push(p.stage);
      const tube = fe.world.bridge.children[0].userData.tube;
      if (p.stage === 'gate' && p.inStage < 1) bridgeAt0 = tube.scale.z;
      if (p.stage === 'pushback') { bridgeLater = tube.scale.z; tug = tug || fe.world.tug.visible; }
      const keep = (k, v) => { if (!(k in at)) at[k] = v; };
      if (p.stage === 'takeoff' && p.inStage > 6) keep('roll', { y: p.position.y, speed: p.speed, gear: p.gear });
      if (p.stage === 'climb' && p.inStage > 10) keep('climb', { y: p.position.y, gear: p.gear, flaps: +p.flaps.toFixed(2) });
      if (p.stage === 'cruise' && p.inStage > 5) keep('cruise', { y: p.position.y, seatbelt: p.seatbelt });
      if (p.stage === 'final' && p.inStage > 2) keep('final', { gear: p.gear, flaps: +p.flaps.toFixed(2), seatbelt: p.seatbelt });
      if (p.stage === 'rollout' && p.inStage > 1) keep('rollout', { y: p.position.y, spoilers: p.spoilers, reverse: p.reverse, onRunway: Math.abs(p.position.x) < 3 && p.position.z > fe.plan.arrivalThreshold });
      if (p.stage === 'cruise' && p.inStage > 8 && !('draw' in at)) {
        fe.setCameraView('seat');
        g.advance(0.05);
        g.renderer.info.reset?.();
        g.renderer.render(fe.scene, fe.flightCamera);
        const seat = { calls: g.renderer.info.render.calls, triangles: g.renderer.info.render.triangles, insideCabin: fe.cabin.group.visible && !fe.airliner.shell[0].visible };
        fe.setCameraView('outside');
        g.advance(0.05);
        g.renderer.render(fe.scene, fe.flightCamera);
        at.draw = { seat, outside: { calls: g.renderer.info.render.calls, triangles: g.renderer.info.render.triangles } };
        fe.setCameraView('seat');
      }
      await new Promise((r) => setTimeout(r, 0));
    }
    return { seen, at, bridgeAt0, bridgeLater, tug, active: fe.isActive };
  });
  await wait(500);
  const lines = await page.evaluate(() => window.__lines);
  const hunger1 = await page.evaluate(() => window.game.hud.backend.getData().stats.hunger);

  const order = ['gate', 'pushback', 'taxi', 'takeoff', 'climb', 'cruise', 'descent', 'final', 'rollout', 'taxi-in'];
  check('flight: it goes from the gate to the gate through every stage in turn: pushback, taxi, take-off roll, climb, cruise, descent, final, roll-out, taxi in', JSON.stringify(trace.seen) === JSON.stringify(order) && !trace.active, trace.seen);
  check('flight: at the gate the jet bridge is on the door; it pulls back before the tug pushes the aircraft back', trace.bridgeAt0 > trace.bridgeLater + 0.2 && trace.tug, { at0: trace.bridgeAt0, later: trace.bridgeLater, tug: trace.tug });
  const a = trace.at;
  check('flight: the take-off roll is on the runway, fast, wheels down; by the end of the climb the gear is up and the flaps in, high over the cloud',
    a.roll?.y < 1 && a.roll?.speed > 55 && a.roll?.gear === 1 && a.climb?.y > 1200 && a.climb?.gear === 0 && a.climb?.flaps < 0.05, { roll: a.roll, climb: a.climb });
  check('flight: in the cruise the seatbelt sign is off; on final the gear is down, full flap, the sign back on', a.cruise?.y === 1700 && a.cruise?.seatbelt === false && a.final?.gear === 1 && a.final?.flaps > 0.9 && a.final?.seatbelt === true, { cruise: a.cruise, final: a.final });
  check('flight: it touches down on the arrival runway: wheels on it, spoilers up, the reversers open', a.rollout?.y === 0 && a.rollout?.spoilers === 1 && a.rollout?.reverse === 1 && a.rollout?.onRunway, a.rollout);
  check('flight: the trolley comes down the aisle and serves the player at their row (hunger up)', hunger1 > hunger0 + 15, { hunger0, hunger1 });
  const said = (re) => lines.some((l) => re.test(l));
  check('flight: the crew welcome the passengers, show the safety drill, the captain announces the cruise and the descent, and the crew welcome them to the city on landing',
    said(/welcome aboard NigeriaLife Air flight NL 204/i) && said(/oxygen masks/i) && said(/life jacket/i) && said(/cruising altitude/i) && said(/descent into Nnamdi Azikiwe/i) && said(/Welcome to Nnamdi Azikiwe/i), lines.map((l) => l.slice(0, 50)));
  const d = a.draw;
  check('flight: from the window seat the cabin is drawn round the player and the skin left out so the window looks out; both views stay inside the phone budget',
    d?.seat.insideCabin && d.seat.calls < 220 && d.outside.calls < 220 && d.seat.triangles < 900000, d);
  check('flight: no errors in the page', log.errors.length === 0, log.errors.slice(0, 5));
  await ctx.close();
}
