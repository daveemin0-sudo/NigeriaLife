// Audio immersion slice: city-mixed street beds, market boost, rain duck, interior hush.
import { open, newPlayer, closeDialogs, wait } from './lib.mjs';
import { mkdirSync } from 'node:fs';

const SHOTS = process.env.SHOTS || '/opt/cursor/artifacts';
mkdirSync(SHOTS, { recursive: true });

export async function run(browser, check) {
  const ctx = await newPlayer(browser);
  const { page, log } = await open(ctx, { w: 1280, h: 720 });
  await closeDialogs(page);

  // Unlock audio via a gesture, then drive ambience states through the game API
  const levels = await page.evaluate(async () => {
    const { SoundEngine } = await import('/src/audio/SoundEngine.ts');
    const { StreetAmbience } = await import('/src/audio/StreetAmbience.ts');
    SoundEngine.getInstance().audio(true);
    const amb = StreetAmbience.get();
    amb.warm();

    const sample = (here) => {
      for (let i = 0; i < 8; i++) amb.update(0.25, here);
      return { ...amb.levels };
    };

    const noonBusy = sample({
      outside: true, onMainRoad: true, driving: false,
      people: 24, cars: 14, hour: 12.5, cityId: 'lagos', marketNear: false, rain: 0,
    });
    const market = sample({
      outside: true, onMainRoad: true, driving: false,
      people: 24, cars: 14, hour: 12.5, cityId: 'lagos', marketNear: true, rain: 0,
    });
    const rainy = sample({
      outside: true, onMainRoad: true, driving: false,
      people: 24, cars: 14, hour: 12.5, cityId: 'lagos', marketNear: false, rain: 0.9,
    });
    const indoor = sample({
      outside: false, onMainRoad: false, driving: false,
      people: 0, cars: 0, hour: 12.5, cityId: 'lagos', marketNear: false, rain: 0,
    });
    const abuja = sample({
      outside: true, onMainRoad: true, driving: false,
      people: 24, cars: 14, hour: 12.5, cityId: 'abuja', marketNear: false, rain: 0,
    });
    const ph = sample({
      outside: true, onMainRoad: true, driving: false,
      people: 24, cars: 14, hour: 12.5, cityId: 'port_harcourt', marketNear: false, rain: 0,
    });
    return { noonBusy, market, rainy, indoor, abuja, ph };
  });

  await page.evaluate(() => window.game.render());
  await wait(200);
  await page.screenshot({ path: `${SHOTS}/audioimmersion-01-street.png` });

  check('audioimmersion: noon Broad Street has audible crowd + traffic beds',
    levels.noonBusy.crowd > 0.02 && levels.noonBusy.traffic > 0.02 && levels.noonBusy.interior === 0, levels.noonBusy);
  check('audioimmersion: market kerb boosts crowd bed over the plain street',
    levels.market.crowd > levels.noonBusy.crowd && levels.market.marketBoost > 1, { market: levels.market, noon: levels.noonBusy });
  check('audioimmersion: rain ducks street beds',
    levels.rainy.rainDuck < 0.7 && levels.rainy.crowd < levels.noonBusy.crowd && levels.rainy.traffic < levels.noonBusy.traffic,
    { rainy: levels.rainy, noon: levels.noonBusy });
  check('audioimmersion: indoors hush replaces street beds',
    levels.indoor.interior > 0 && levels.indoor.crowd === 0 && levels.indoor.traffic === 0, levels.indoor);
  check('audioimmersion: Abuja street beds are quieter / more orderly than Lagos',
    levels.abuja.crowd < levels.noonBusy.crowd && levels.abuja.traffic < levels.noonBusy.traffic, { abuja: levels.abuja, lagos: levels.noonBusy });
  check('audioimmersion: Port Harcourt traffic rumble is heavier than Abuja',
    levels.ph.traffic > levels.abuja.traffic, { ph: levels.ph, abuja: levels.abuja });

  check('audioimmersion: no page errors', log.errors.length === 0, log.errors.slice(0, 4));
}
