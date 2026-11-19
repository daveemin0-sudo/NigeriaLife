// Earnable flight fares + early job pay lands in pocket cash (not only the bank).
import { open, money, newPlayer } from './lib.mjs';

export async function run(browser, check) {
  const ctx = await newPlayer(browser);
  const { page } = await open(ctx);

  const fares = await page.evaluate(() => {
    const f = window.game.flights;
    const fromLagos = Object.fromEntries(f.routesFrom('lagos').map((r) => [r.to, { flight: r.flight, fare: r.fare }]));
    return {
      abuja: fromLagos.abuja,
      ph: fromLagos.port_harcourt,
      ibadan: fromLagos.ibadan,
      coaches: {
        abuja: window.game.coaches.routesFrom('lagos').find((r) => r.to === 'abuja')?.fare,
        ph: window.game.coaches.routesFrom('lagos').find((r) => r.to === 'port_harcourt')?.fare,
      },
    };
  });

  check(
    'economyfares: Lagos flights are earnable (Abuja ₦95k, PH ₦85k) and Ibadan day-trip is middle-tier ₦220k',
    fares.abuja?.flight === 'NL 204' && fares.abuja.fare === 95_000
      && fares.ph?.flight === 'NL 310' && fares.ph.fare === 85_000
      && fares.ibadan?.flight === 'NL 118' && fares.ibadan.fare === 220_000,
    fares,
  );

  check(
    'economyfares: coach fares stay as-is (Abuja ₦42k, Port Harcourt ₦38k)',
    fares.coaches.abuja === 42_000 && fares.coaches.ph === 38_000,
    fares.coaches,
  );

  const paid = await page.evaluate(() => {
    const be = window.game.hud.backend;
    const before = { cash: be.getData().walletCash, bank: be.getData().bank.balance };
    const gig = be.performGig(12_500, 0, 'economyfares: danfo conductor');
    const after = { cash: be.getData().walletCash, bank: be.getData().bank.balance };
    return { gig, before, after, deltaCash: after.cash - before.cash, deltaBank: after.bank - before.bank };
  });

  check(
    'economyfares: an early gig pays into pocket cash, not the bank',
    paid.gig.success && paid.deltaCash === 12_500 && paid.deltaBank === 0,
    paid,
  );

  // Bank-only purse can still buy a coach (pay splits wallet then bank)
  await page.evaluate(() => {
    const be = window.game.hud.backend;
    be.data.walletCash = 0;
    be.data.bank.balance = 40_000;
    be.saveData();
  });
  const coach = await page.evaluate(() => {
    const leg = window.game.coaches.routesFrom('lagos').find((r) => r.to === 'port_harcourt');
    const sold = window.game.coaches.buy(leg, 'lagos');
    return { sold, money: { cash: window.game.hud.backend.getData().walletCash, bank: window.game.hud.backend.getData().bank.balance } };
  });
  check(
    'economyfares: Port Harcourt coach (₦38k) buys from bank when the pocket is empty',
    coach.sold.ok && coach.money.bank === 2_000 && coach.money.cash === 0,
    coach,
  );

  const m = await money(page);
  check('economyfares: still solvent after the coach buy', m.total === 2_000, m);
}
