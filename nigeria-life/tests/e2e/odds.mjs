// Naija Odds: the Eko Premier League on the phone. A match kicks off every five minutes; a bet
// is placed on the next one by tapping a price, choosing a stake and pressing Place; the stake
// leaves the bank; at full time the bet is settled from the same match the screens show and a
// winner is paid stake times price, once. The big screen at Oga Sunday's and the app show the
// same match, and the home television's football channel has it on.
import { open, newPlayer, closeDialogs, wait, money, enterInterior, leaveInterior } from './lib.mjs';

const centre = (page, selector) => page.evaluate((sel) => {
  const el = document.querySelector(sel);
  if (!el) return null;
  el.scrollIntoView({ block: 'center' });
  const r = el.getBoundingClientRect();
  const x = r.left + r.width / 2;
  const y = r.top + r.height / 2;
  const top = document.elementFromPoint(x, y);
  return { x, y, reachable: !!top && (top === el || el.contains(top)) };
}, selector);

const tap = async (page, selector) => {
  const at = await centre(page, selector);
  if (!at) return false;
  await page.mouse.click(at.x, at.y);
  await wait(250);
  return at.reachable;
};

export async function run(browser, check) {
  const ctx = await newPlayer(browser);
  const { page, log } = await open(ctx);
  await closeDialogs(page);
  await page.setViewport({ width: 420, height: 860 });
  await wait(600);
  await page.evaluate(() => {
    const g = window.game;
    g.modules.Bets.get().clear();
    g.modules.Bets.now = () => Date.now();
    g.hud.backend.data.bank.balance = 1_000_000;
    g.hud.backend.saveData();
    g.hud.phoneModal.open();
    g.hud.phoneModal.openApp('odds');
  });
  await wait(900);

  const screen = await page.evaluate(() => {
    const L = window.game.modules.League;
    const fixtures = [...document.querySelectorAll('#odds-fixtures [data-fixture]')].map((el) => ({ slot: Number(el.dataset.fixture), prices: [...el.querySelectorAll('.no-price b')].map((b) => Number(b.textContent)) }));
    const now = L.slotAt(Date.now());
    return { live: !!document.getElementById('odds-live'), fixtures, now, expected: fixtures.map((f) => { const o = L.odds(L.fixture(f.slot)); return [o['1'], o.X, o['2'], o.O, o.U]; }) };
  });
  check('odds: Naija Odds opens with the match on now and the next four kick-offs, each priced home / draw / away and over / under 2.5',
    screen.live && screen.fixtures.length === 4 && screen.fixtures.every((f, i) => f.slot === screen.now + 1 + i && f.prices.length === 5 && f.prices.every((p, k) => p === screen.expected[i][k] && p > 1)), screen);

  // A favourite and an outsider are priced differently, and the prices carry a margin
  const fair = await page.evaluate(() => {
    const L = window.game.modules.League;
    const f = L.fixture(L.slotAt(Date.now()) + 1);
    const o = L.odds(f);
    const book = 1 / o['1'] + 1 / o.X + 1 / o['2'];
    return { book, home: o['1'], away: o['2'], stronger: f.form[0] > f.form[1] ? 'home' : 'away' };
  });
  check('odds: the stronger side is the shorter price and the book adds up to a little over 100%', fair.book > 1.02 && fair.book < 1.15 && (fair.stronger === 'home' ? fair.home < fair.away : fair.away < fair.home), fair);

  // Pick the home side in the next match, stake ₦10,000, place it
  const m0 = await money(page);
  const picked = await tap(page, '#odds-fixtures [data-fixture]:first-child [data-pick="1"]');
  await wait(300);
  const tenK = await tap(page, '#odds-slip [data-value="10000"]');
  await wait(300);
  const slip = await page.evaluate(() => ({ slip: document.getElementById('odds-slip')?.innerText ?? '', returns: document.getElementById('odds-returns')?.textContent ?? '', on: !!document.querySelector('#odds-fixtures .no-price.is-on') }));
  const price = screen.fixtures[0].prices[0];
  check('odds: tapping a price puts it on the slip; ₦10,000 shows what it returns', picked && tenK && slip.on && slip.returns === `₦${Math.floor(10000 * price).toLocaleString()}`, { picked, tenK, slip, price });
  const placed = await tap(page, '#odds-place');
  await wait(600);
  const m1 = await money(page);
  const bets = await page.evaluate(() => window.game.modules.Bets.get().mine());
  check('odds: Place takes ₦10,000 from the bank and the bet is open on the next match at the price shown', placed && m0.bank - m1.bank === 10000 && bets.length === 1 && bets[0].status === 'open' && bets[0].price === price && bets[0].slot === screen.now + 1, { placed, paid: m0.bank - m1.bank, bets });

  // Bets on the match being played, or beyond the bank, are refused
  const refused = await page.evaluate(async () => {
    const { Bets, League } = window.game.modules;
    const now = League.slotAt(Date.now());
    const live = await Bets.get().place(now, '1', 1000);
    const big = await Bets.get().place(now + 2, 'X', 5_000_000);
    return { live, big, count: Bets.get().mine().length };
  });
  check('odds: a bet on the match already kicked off, or bigger than the bank, is refused', !!refused.live && !!refused.big && refused.count === 1, refused);

  // A second bet on the goals, then the clock moved past full time: both settled from the match, a winner paid once
  await page.evaluate(() => window.game.modules.Bets.get().place(window.game.modules.League.slotAt(Date.now()) + 1, 'O', 5000));
  const m2 = await money(page);
  const settled = await page.evaluate(async () => {
    const { Bets, League } = window.game.modules;
    const bet = Bets.get().mine().find((b) => b.pick === '1');
    const f = League.fixture(bet.slot);
    const offset = f.end + 1500 - Date.now();
    Bets.now = () => Date.now() + offset;
    Bets.get().tick();
    const after = Bets.get().mine();
    const score = League.result(f, League.openSeed(bet.slot));
    // The same match, followed live from kick-off, ends the same
    const live = new League.LiveMatch(f, League.openSeed(bet.slot));
    live.catchUp(f.kickoff + 100_000);
    live.catchUp(f.end + 10);
    Bets.get().tick();
    return { after, score, live: live.sim.score, toast: document.body.innerText.includes('Full time') || document.body.innerText.includes('Your bet won') };
  });
  const m3 = await money(page);
  const due = settled.after.filter((b) => b.status === 'won').reduce((s, b) => s + Math.floor(b.stake * b.price), 0);
  check('odds: at full time both bets are settled from the match played, winners paid stake x price into the bank, once',
    settled.after.every((b) => b.status !== 'open' && JSON.stringify(b.score) === JSON.stringify(settled.score)) && m3.bank - m2.bank === due && JSON.stringify(settled.live) === JSON.stringify(settled.score),
    { settled, paid: m3.bank - m2.bank, due });
  check('odds: the player is told the result', settled.toast, settled);
  await page.evaluate(() => document.querySelector('[data-set="odds.tab"][data-value="bets"]')?.click());
  await wait(500);
  const list = await page.evaluate(() => [...document.querySelectorAll('#odds-bets [data-bet]')].map((el) => el.dataset.status));
  check('odds: My bets lists both, settled', list.length === 2 && list.every((s) => s === 'won' || s === 'lost'), list);
  await page.evaluate(() => { window.game.modules.Bets.now = () => Date.now(); window.game.hud.phoneModal.close(); });

  // Oga Sunday's: the big screen shows the league match the app follows
  await enterInterior(page, 'interior_place_viewing-centre');
  await wait(1500);
  const room = await page.evaluate(() => {
    const g = window.game;
    let screen = null;
    g.world.scene.traverse((o) => { if (o.name === 'viewing screen') screen = o; });
    let visible = !!screen;
    for (let o = screen; o; o = o.parent) if (!o.visible) visible = false;
    const canvas = screen?.material?.map?.image;
    let colours = 0;
    if (canvas?.getContext) {
      const d = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
      const seen = new Set();
      for (let i = 0; i < d.length; i += 4 * 97) seen.add(`${d[i] >> 4},${d[i + 1] >> 4},${d[i + 2] >> 4}`);
      colours = seen.size;
    }
    const now = g.modules.Bets.get().now();
    return { inside: g.world.interiorManager.currentInterior?.type ?? null, visible, colours, phase: now.phase, teams: now.match?.sim.teams ?? null, fixture: [now.fixture.home.name, now.fixture.away.name] };
  });
  check("odds: at Oga Sunday's the big screen is drawn and shows the league match on now",
    room.visible && room.colours > 8 && (room.phase !== 'live' || (room.teams && room.teams[0] === room.fixture[0] && room.teams[1] === room.fixture[1])), room);
  await leaveInterior(page);

  check('odds: no errors in the page', log.errors.length === 0, log.errors.slice(0, 5));
  await ctx.close();
}
