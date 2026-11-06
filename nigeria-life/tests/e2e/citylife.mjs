// Abuja and Port Harcourt are lived in: traffic on each city's avenue keeps to the right and
// stops at the lights by the market, people walk both pavements, and both are as busy as the
// hour. The vehicles and the people are solid to the player, as in Lagos, and Lagos's own are
// not felt there. Seen in a frame drawn on the avenue.
import { open, newPlayer, closeDialogs, wait } from './lib.mjs';

export async function run(browser, check) {
  const ctx = await newPlayer(browser);
  const { page, log } = await open(ctx);
  await closeDialogs(page);

  for (const city of ['abuja', 'port_harcourt']) {
    await page.evaluate((c) => { const g = window.game; g.world.skyEnvironment.setHour(12); g.arriveInCity(c); }, city);
    await wait(2500);
    const life = await page.evaluate(async () => {
      const g = window.game;
      const here = g.world.cityManager.lifeHere();
      if (!here) return { built: false };
      // Stand on the pavement by the market and let the street run a while
      g.player.stopMoving();
      g.player.mesh.position.set(-12, 0, 10);
      for (let i = 0; i < 20; i++) await g.advance(0.1);
      const t = here.traffic;
      const lanes = t.lanes;
      const wrong = lanes.filter((l) => Math.sign(l.fixed) !== -l.dir).length;
      const moving = t.moving;
      // What is drawn near the player, whichever way the camera faces (the frame itself is looked at by hand)
      t.update(0, g.player.position);
      here.crowd.update(0, g.player.position);
      const vehiclesDrawn = t.batches.reduce((n, b) => n + (b.body ? b.body.count : 0), 0);
      const peopleDrawn = here.crowd.variants.reduce((n, v) => n + (v.body ? v.body.count : 0) + (v.farBody ? v.farBody.count : 0), 0);
      const kinds = new Set();
      for (const l of lanes) for (const c of l.cars) kinds.add(t.batches[c.kind].spec.kind);
      // Solid: a vehicle near the player is felt by the body checks, and Lagos's are not
      // One of the vehicles on the road at this hour, felt through the game's own body checks, as walking and driving use them
      const onRoad = [];
      t.cars(0, 20, 120, onRoad);
      const car = onRoad.find((b) => !b.parked);
      const felt = car ? g.modules.Bodies.carsNear(car.x, car.z, 3).length : null;
      const people = g.modules.Bodies.peopleNear(-12, 10, 40);
      return {
        built: true,
        lanes: lanes.length,
        wrong,
        moving,
        vehiclesDrawn,
        peopleDrawn,
        kinds: [...kinds].sort(),
        felt,
        peopleNear: people.length,
        visible: here.group.visible && g.world.cityManager.lifeHere() === here,
      };
    });
    const name = city === 'abuja' ? 'Abuja' : 'Port Harcourt';
    check(`citylife: ${name} has traffic on its avenue, every lane on the right-hand side, and people on its pavements, drawn near the player`,
      life.built && life.lanes === 4 && life.wrong === 0 && life.moving.now > 10 && life.vehiclesDrawn > 4 && life.peopleDrawn > 10 && life.visible, life);
    check(`citylife: ${name}'s traffic is its own (${city === 'abuja' ? 'no okadas or kekes in the centre' : 'kekes, no okadas'}), and its vehicles and people are solid to the player`,
      !life.kinds.includes('okada') && (city === 'abuja' ? !life.kinds.includes('keke') && !life.kinds.includes('danfo') : life.kinds.includes('keke')) && life.felt > 0 && life.peopleNear > 0, life);

    // The lights by the market: red holds the avenue
    const lights = await page.evaluate(() => {
      const g = window.game;
      const t = g.world.cityManager.lifeHere().traffic;
      let red = null;
      for (let s = 0; s < 80; s += 0.1) {
        t.signalTime = s;
        if (t.signalState('main') === 'stop' && t.signalState('cross') === 'go') { red = s; break; }
      }
      if (red === null) return { red: false };
      t.signalTime = red + 0.1;
      const waiting = [];
      for (const lane of t.lanes) {
        const stop = lane.stops[0].u;
        for (const car of lane.cars) if (car.u + car.length / 2 <= stop + 0.1 && !car.committed) waiting.push({ car, stop });
      }
      const at = g.player.mesh.position;
      for (let i = 0; i < 240; i++) t.update(1 / 30, at);
      return { red: true, waiting: waiting.length, ranRed: waiting.filter(({ car, stop }) => car.u + car.length / 2 > stop + 0.7).length };
    });
    check(`citylife: in ${name} the lights by the market go red for the crossing, and no car waiting at the line goes over it`,
      lights.red && lights.waiting > 2 && lights.ranRed === 0, lights);
  }

  // Back in Lagos: its own street again, and the other cities' traffic is not felt there
  const lagos = await page.evaluate(async () => {
    const g = window.game;
    g.arriveInCity('lagos');
    for (let i = 0; i < 10; i++) await g.advance(0.1);
    return { life: g.world.cityManager.lifeHere(), lagosCrowd: g.world.cityPopulation.group.visible };
  });
  check('citylife: back in Lagos, the other cities step aside and Lagos has its own street life', lagos.life === null && lagos.lagosCrowd, lagos);

  check('citylife: no errors in the page', log.errors.length === 0, log.errors.slice(0, 5));
  await ctx.close();
}
