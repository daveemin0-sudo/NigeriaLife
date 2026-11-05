/**
 * Ayo: two rows of six pits, four seeds in each. A turn takes every seed from one of your own
 * pits and sows them one by one round the board, anticlockwise, passing over the pit they came
 * from. If the last seed makes two or three in an opponent's pit, those are captured, and so
 * are the twos and threes in the pits just before it on their side. A move may not take every
 * seed the opponent has (it is played, but nothing is captured). If the opponent has nothing,
 * you must give them seeds if you can; if you cannot, you take what is left on your side and
 * the game is over. More than half the seeds (25) wins.
 *
 * Pits 0 to 5 are the player's, left to right along the bottom; 6 to 11 the opponent's,
 * right to left along the top, so sowing runs 0, 1, ... 11, 0.
 */

export type Side = 0 | 1;

export interface AyoState {
  pits: number[];
  store: [number, number];
  turn: Side;
  over: boolean;
  winner: Side | null | 'draw';
  /** The last move, for the board to show where it went */
  last: { from: number; path: number[]; captured: number[] } | null;
}

export const own = (side: Side, pit: number) => (side === 0 ? pit < 6 : pit >= 6);
const pitsOf = (side: Side) => (side === 0 ? [0, 1, 2, 3, 4, 5] : [6, 7, 8, 9, 10, 11]);

export function newAyo(first: Side = 0): AyoState {
  return { pits: Array(12).fill(4), store: [0, 0], turn: first, over: false, winner: null, last: null };
}

function seedsOn(state: AyoState, side: Side): number {
  return pitsOf(side).reduce((s, p) => s + state.pits[p], 0);
}

/** Plays a move on a copy; returns the new state, or null if it is not allowed */
function apply(state: AyoState, pit: number): AyoState | null {
  const side = state.turn;
  if (state.over || !own(side, pit) || state.pits[pit] === 0) return null;
  const pits = [...state.pits];
  let seeds = pits[pit];
  pits[pit] = 0;
  let at = pit;
  const path: number[] = [];
  while (seeds > 0) {
    at = (at + 1) % 12;
    if (at === pit) continue;
    pits[at] += 1;
    path.push(at);
    seeds -= 1;
  }
  // Captures, walking back from the last pit along the opponent's side
  const captured: number[] = [];
  let take = 0;
  let c = at;
  while (!own(side, c) && (pits[c] === 2 || pits[c] === 3)) {
    captured.push(c);
    take += pits[c];
    c = (c + 11) % 12;
  }
  const other: Side = side === 0 ? 1 : 0;
  const after = [...pits];
  for (const p of captured) after[p] = 0;
  const grandSlam = captured.length > 0 && pitsOf(other).every((p) => after[p] === 0);
  const store: [number, number] = [...state.store];
  let finalPits = pits;
  if (!grandSlam && captured.length) {
    finalPits = after;
    store[side] += take;
  }
  return { pits: finalPits, store, turn: other, over: false, winner: null, last: { from: pit, path, captured: grandSlam ? [] : captured } };
}

/** The pits the side to move may play: all with seeds, or, if the opponent is empty, only those that feed them */
export function legalMoves(state: AyoState): number[] {
  if (state.over) return [];
  const side = state.turn;
  const other: Side = side === 0 ? 1 : 0;
  const moves = pitsOf(side).filter((p) => state.pits[p] > 0);
  if (seedsOn(state, other) > 0) return moves;
  return moves.filter((p) => {
    const next = apply(state, p);
    return next !== null && seedsOn(next, other) > 0;
  });
}

function settle(state: AyoState): AyoState {
  const s = { ...state, pits: [...state.pits], store: [...state.store] as [number, number] };
  const done = () => {
    s.over = true;
    s.winner = s.store[0] > s.store[1] ? 0 : s.store[1] > s.store[0] ? 1 : 'draw';
  };
  if (s.store[0] > 24 || s.store[1] > 24) { done(); return s; }
  if (legalMoves(s).length === 0) {
    // Nobody can be fed: each takes what is on their own side
    for (const side of [0, 1] as Side[]) for (const p of pitsOf(side)) { s.store[side] += s.pits[p]; s.pits[p] = 0; }
    done();
  }
  return s;
}

export function play(state: AyoState, pit: number): AyoState | null {
  if (!legalMoves(state).includes(pit)) return null;
  const next = apply(state, pit);
  return next ? settle(next) : null;
}

/** The computer's move: looks a few turns ahead and plays for the most seeds */
export function botMove(state: AyoState, depth = 4): number {
  const me = state.turn;
  const score = (s: AyoState) => (s.over ? (s.winner === me ? 1000 : s.winner === 'draw' ? 0 : -1000) : s.store[me] - s.store[me === 0 ? 1 : 0]);
  const search = (s: AyoState, d: number, alpha: number, beta: number): number => {
    if (d === 0 || s.over) return score(s);
    const moves = legalMoves(s);
    if (s.turn === me) {
      let best = -Infinity;
      for (const m of moves) {
        best = Math.max(best, search(play(s, m)!, d - 1, alpha, beta));
        alpha = Math.max(alpha, best);
        if (beta <= alpha) break;
      }
      return best;
    }
    let best = Infinity;
    for (const m of moves) {
      best = Math.min(best, search(play(s, m)!, d - 1, alpha, beta));
      beta = Math.min(beta, best);
      if (beta <= alpha) break;
    }
    return best;
  };
  const moves = legalMoves(state);
  let pick = moves[0];
  let best = -Infinity;
  for (const m of moves) {
    // A little randomness among equals, so it does not play the same game every time
    const v = search(play(state, m)!, depth - 1, -Infinity, Infinity) + Math.random() * 0.5;
    if (v > best) { best = v; pick = m; }
  }
  return pick;
}
