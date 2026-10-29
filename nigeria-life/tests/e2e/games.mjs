// Naija Games on the phone: the rules of Ayo and Whot as they are played, whole games between
// the computers that finish, and the app: a stake taken into the pot, the board and the table
// drawn and played by tapping, the pot paid to the winner, the record kept, the hustle counted.
import { open, newPlayer, closeDialogs, wait, money } from './lib.mjs';

export async function run(browser, check) {
  const ctx = await newPlayer(browser);
  const { page, log } = await open(ctx, { life: true });
  await closeDialogs(page);

  // ------------------------------------------------------------------ Ayo's rules
  const ayo = await page.evaluate(() => {
    const A = window.game.modules.Games.Ayo;
    const s0 = A.newAyo(0);
    const total = (s) => s.pits.reduce((a, b) => a + b, 0) + s.store[0] + s.store[1];
    // A capture that runs back: the last seed makes 3 in pit 8, and 7 and 6 hold 2 each
    const cap = { ...A.newAyo(0), pits: [0, 0, 0, 0, 0, 3, 1, 1, 2, 4, 4, 4] };
    const afterCap = A.play(cap, 5);
    // The grand slam: taking every seed the opponent has captures nothing
    const slam = { ...A.newAyo(0), pits: [0, 0, 0, 0, 0, 2, 1, 1, 0, 0, 0, 0] };
    const afterSlam = A.play(slam, 5);
    // Twelve or more seeds pass over the pit they came from
    const lap = { ...A.newAyo(0), pits: [12, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1] };
    const afterLap = A.play(lap, 0);
    // An empty opponent must be fed: only the moves that reach them may be played
    const feed = { ...A.newAyo(0), pits: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0], store: [20, 26] };
    const feedMoves = A.legalMoves({ ...feed, store: [20, 20] });
    // Two computers play it out
    let g = A.newAyo(0);
    let moves = 0;
    while (!g.over && moves < 400) { g = A.play(g, A.botMove(g, 3)); moves++; }
    return { start: total(s0), capStore: afterCap?.store[0], capPits: afterCap?.pits.slice(6, 9), slamStore: afterSlam?.store[0], lapOrigin: afterLap?.pits[0], lapTotal: afterLap && total(afterLap), feedMoves, over: g.over, end: total(g), winner: g.winner, moves };
  });
  check('ayo: 48 seeds; a last seed making three captures it and the twos and threes behind it (7 seeds); a move that would take every seed captures none; twelve seeds pass over their own pit; an empty side must be fed',
    ayo.start === 48 && ayo.capStore === 7 && JSON.stringify(ayo.capPits) === '[0,0,0]' && ayo.slamStore === 0 && ayo.lapOrigin === 0 && ayo.lapTotal === 18 && JSON.stringify(ayo.feedMoves) === '[5]', ayo);
  check('ayo: two computers play a whole game to its end, every seed accounted for', ayo.over && ayo.end === 48 && ayo.winner !== null && ayo.moves < 400, { over: ayo.over, end: ayo.end, winner: ayo.winner, moves: ayo.moves });

  // ------------------------------------------------------------------ Whot's rules
  const whot = await page.evaluate(() => {
    const W = window.game.modules.Games.Whot;
    const d = W.deck();
    const by = (sh) => d.filter((c) => c.shape === sh).length;
    const names = ['You', 'A', 'B', 'C'];
    const base = (hands, topCard) => ({ hands, market: W.deck().slice(0, 20), pile: [topCard], called: null, turn: 0, winner: null, said: '', names });
    const c = (shape, n, id = `${shape}-${n}-t`) => ({ shape, n, id });
    const pick2 = W.playCard(base([[c('circle', 2), c('star', 7)], [c('cross', 3)], [c('square', 3)], [c('star', 4)]], c('circle', 10)), 'circle-2-t');
    const susp = W.playCard(base([[c('triangle', 8), c('star', 7)], [c('cross', 3)], [c('square', 3)], [c('star', 4)]], c('triangle', 3)), 'triangle-8-t');
    const hold = W.playCard(base([[c('cross', 1), c('star', 7)], [c('cross', 3)], [c('square', 3)], [c('star', 4)]], c('cross', 11)), 'cross-1-t');
    const market = W.playCard(base([[c('star', 14), c('star', 7)], [c('cross', 3)], [c('square', 3)], [c('star', 4)]], c('star', 2)), 'star-14-t');
    const called = W.playCard(base([[c('whot', 20), c('star', 7)], [c('cross', 3)], [c('square', 3)], [c('star', 4)]], c('circle', 4)), 'whot-20-t', 'star');
    const wrong = W.playCard(base([[c('cross', 9), c('star', 7)], [], [], []], c('circle', 4)), 'cross-9-t');
    let g = W.newWhot(names);
    let turns = 0;
    while (g.winner === null && turns < 2000) { g = W.botTurn(g); turns++; }
    const cards = g.hands.reduce((a, h) => a + h.length, 0) + g.market.length + g.pile.length;
    return {
      size: d.length, circles: by('circle'), crosses: by('cross'), stars: by('star'), whots: by('whot'),
      pick2: { picked: pick2.hands[1].length, turn: pick2.turn }, susp: susp.turn, hold: hold.turn, market: [market.hands[1].length, market.hands[2].length, market.hands[3].length, market.turn],
      called: { called: called.called, turn: called.turn, said: called.said }, wrong: wrong === null, winner: g.winner, turns, cards,
    };
  });
  check('whot: the 54-card Nigerian deck (12 circles, 9 crosses, 7 stars, 5 Whots); pick two gives the next player two and passes them by; suspension skips; hold on plays again; general market gives everyone one; a Whot calls the shape; a card of neither shape nor number is refused',
    whot.size === 54 && whot.circles === 12 && whot.crosses === 9 && whot.stars === 7 && whot.whots === 5 && whot.pick2.picked === 3 && whot.pick2.turn === 2 && whot.susp === 2 && whot.hold === 0 && JSON.stringify(whot.market) === '[2,2,2,0]' && whot.called.called === 'star' && whot.called.turn === 1 && whot.wrong, whot);
  check('whot: four computers play a whole hand until one checks up, no card lost', whot.winner !== null && whot.turns < 2000 && whot.cards === 54, { winner: whot.winner, turns: whot.turns, cards: whot.cards });

  // ------------------------------------------------------------------ The app: a stake on Ayo, played by tapping, the pot won
  await page.evaluate(() => { const b = window.game.hud.backend; b.data.walletCash += 50_000; b.saveData(); window.game.hud.phoneModal.openApp('games'); });
  await wait(500);
  const lobby = await page.evaluate(() => ({ rows: [...document.querySelectorAll('[data-act="ayo-new"],[data-act="whot-new"]')].length, chips: document.querySelectorAll('[data-act="stake"]').length }));
  const m0 = await money(page);
  await page.evaluate(() => document.querySelector('[data-act="stake"][data-stake="1000"]')?.click());
  await wait(200);
  await page.evaluate(() => document.querySelector('[data-act="ayo-new"]')?.click());
  await wait(500);
  const board = await page.evaluate(() => ({ pits: document.querySelectorAll('.gm-pit').length, seeds: [...document.querySelectorAll('.gm-pit .c')].reduce((a, e) => a + parseInt(e.textContent, 10), 0) }));
  const m1 = await money(page);
  // A board one tap from the win: pit 5 sows into 6, making three
  await page.evaluate(() => {
    const s = window.game.modules.Games.session;
    s.ayo = { pits: [0, 0, 0, 0, 2, 1, 2, 4, 4, 4, 2, 0], store: [24, 5], turn: 0, over: false, winner: null, last: null };
    s.busy = false;
    window.game.hud.phoneModal.openApp('games', 'ayo');
  });
  await wait(400);
  await page.evaluate(() => document.querySelector('[data-act="ayo-pit"][data-pit="5"]')?.click());
  await wait(600);
  const won = await page.evaluate(() => ({ status: document.getElementById('ayo-status')?.textContent, again: !!document.querySelector('[data-act="ayo-new"]') }));
  const m2 = await money(page);
  const today = await page.evaluate(() => window.game.modules.Activity.get().totals.gamesWon);
  check('games: the phone has Naija Games with Ayo, Whot and five stakes; ₦1,000 on Ayo goes into the pot and the board has 12 pits and 48 seeds',
    lobby.rows === 2 && lobby.chips === 5 && m0.total - m1.total === 1000 && board.pits === 12 && board.seeds === 48, { lobby, staked: m0.total - m1.total, board });
  check('games: a winning tap on the board wins the game and the ₦2,000 pot, and the win is counted', /You win/.test(won.status ?? '') && won.again && m2.total - m1.total === 2000 && today === 1, { won, pot: m2.total - m1.total, today });

  // ------------------------------------------------------------------ Whot at the table
  await page.evaluate(() => { window.game.modules.Games.session.stake = 0; window.game.hud.phoneModal.openApp('games'); });
  await wait(300);
  await page.evaluate(() => document.querySelector('[data-act="whot-new"]')?.click());
  await wait(500);
  const table = await page.evaluate(() => ({ hand: document.querySelectorAll('#whot-hand .gm-card').length, opps: document.querySelectorAll('.gm-opp').length, playable: document.querySelectorAll('#whot-hand .gm-card.can').length }));
  // Play a card that can go, or go to market; the others then take their turns
  await page.evaluate(() => {
    const can = document.querySelector('#whot-hand .gm-card.can');
    if (can) can.click(); else document.querySelector('[data-act="whot-market"]')?.click();
  });
  await wait(300);
  await page.evaluate(() => document.querySelector('[data-act="whot-call"]')?.click());
  await wait(4500);
  const moved = await page.evaluate(() => ({ turn: window.game.modules.Games.session.whot.turn, said: document.getElementById('whot-status')?.textContent }));
  check('games: Whot deals five cards to the player and seats three others; the player plays (or goes to market) and the others play in turn back to the player',
    table.hand === 5 && table.opps === 3 && (moved.said ?? '').length > 5, { table, moved });

  check('games: no errors in the page', log.errors.length === 0, log.errors.slice(0, 5));
  await page.evaluate(() => window.game.hud.phoneModal.close?.());
  await ctx.close();
}
