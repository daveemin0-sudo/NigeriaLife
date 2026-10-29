/**
 * Whot, the Nigerian card game. Fifty-four cards: circles and triangles 1-5, 7, 8, 10-14;
 * crosses and squares 1, 2, 3, 5, 7, 10, 11, 13, 14; stars 1-5, 7, 8; and five Whot 20s.
 * Play a card of the same shape or number as the one on top, or a Whot and call a shape; if
 * you cannot, go to market (draw one). The first to finish their hand wins ("Check up!").
 *
 * The special cards, as played in Lagos: 1 Hold on (play again), 2 Pick two, 5 Pick three
 * (the next player picks them and misses their turn), 8 Suspension (the next player is
 * skipped), 14 General market (everyone else picks one), 20 Whot (call any shape).
 */

export type Shape = 'circle' | 'triangle' | 'cross' | 'square' | 'star' | 'whot';
export interface WhotCard { shape: Shape; n: number; id: string }

export const SHAPES: Shape[] = ['circle', 'triangle', 'cross', 'square', 'star'];
export const SHAPE_ICON: Record<Shape, string> = { circle: '●', triangle: '▲', cross: '✚', square: '■', star: '★', whot: 'W' };

export function deck(): WhotCard[] {
  const out: WhotCard[] = [];
  const add = (shape: Shape, ns: number[]) => ns.forEach((n) => out.push({ shape, n, id: `${shape}-${n}` }));
  add('circle', [1, 2, 3, 4, 5, 7, 8, 10, 11, 12, 13, 14]);
  add('triangle', [1, 2, 3, 4, 5, 7, 8, 10, 11, 12, 13, 14]);
  add('cross', [1, 2, 3, 5, 7, 10, 11, 13, 14]);
  add('square', [1, 2, 3, 5, 7, 10, 11, 13, 14]);
  add('star', [1, 2, 3, 4, 5, 7, 8]);
  for (let i = 0; i < 5; i++) out.push({ shape: 'whot', n: 20, id: `whot-20-${i}` });
  return out;
}

export interface WhotState {
  hands: WhotCard[][];
  market: WhotCard[];
  pile: WhotCard[];
  /** The shape called on a Whot, until it is answered */
  called: Shape | null;
  turn: number;
  winner: number | null;
  /** What happened last, for the table to say */
  said: string;
  names: string[];
}

function shuffle<T>(list: T[], rnd = Math.random): T[] {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

export function newWhot(names: string[], rnd = Math.random): WhotState {
  const cards = shuffle(deck(), rnd);
  const hands = names.map(() => cards.splice(0, 5));
  // The first card on the pile is an ordinary one
  let i = cards.findIndex((c) => c.shape !== 'whot' && ![1, 2, 5, 8, 14].includes(c.n));
  if (i < 0) i = 0;
  const pile = cards.splice(i, 1);
  return { hands, market: cards, pile, called: null, turn: 0, winner: null, said: `${names[0]} to start. The card is ${SHAPE_ICON[pile[0].shape]} ${pile[0].n}.`, names };
}

export const top = (s: WhotState) => s.pile[s.pile.length - 1];

export function canPlay(s: WhotState, card: WhotCard): boolean {
  if (card.shape === 'whot') return true;
  const t = top(s);
  if (s.called) return card.shape === s.called;
  return card.shape === t.shape || card.n === t.n;
}

function draw(s: WhotState, who: number, count: number): number {
  let got = 0;
  for (let i = 0; i < count; i++) {
    if (s.market.length === 0) {
      // The pile, all but its top card, is shuffled back into the market
      const keep = s.pile.pop()!;
      s.market = shuffle(s.pile);
      s.pile = [keep];
      if (s.market.length === 0) break;
    }
    s.hands[who].push(s.market.pop()!);
    got++;
  }
  return got;
}

const next = (s: WhotState, from: number, step = 1) => (from + step) % s.hands.length;
/** 'You play' for the player, 'Aisha plays' for anyone else */
const says = (name: string, verb: string, you: string) => `${name} ${name === 'You' ? you : verb}`;

/** Plays a card from the hand of whoever's turn it is; `call` is the shape asked for on a Whot */
export function playCard(state: WhotState, cardId: string, call?: Shape): WhotState | null {
  if (state.winner !== null) return null;
  const s: WhotState = { ...state, hands: state.hands.map((h) => [...h]), market: [...state.market], pile: [...state.pile] };
  const who = s.turn;
  const hand = s.hands[who];
  const i = hand.findIndex((c) => c.id === cardId);
  if (i < 0 || !canPlay(s, hand[i])) return null;
  const card = hand.splice(i, 1)[0];
  s.pile.push(card);
  s.called = null;
  const name = s.names[who];
  const shape = `${SHAPE_ICON[card.shape]} ${card.n}`;
  if (hand.length === 0) {
    s.winner = who;
    s.said = `${name}: "Check up!" ${says(name, 'wins', 'win')}!`;
    return s;
  }
  const lastCard = hand.length === 1 ? ` ${name}: "Last card!"` : '';
  const after = next(s, who);
  if (card.shape === 'whot') {
    s.called = call ?? 'circle';
    s.turn = after;
    s.said = `${says(name, 'plays', 'play')} Whot and ${name === 'You' ? 'call' : 'calls'} ${s.called}s.${lastCard}`;
  } else if (card.n === 1) {
    s.said = `${name}: ${shape}, "Hold on!" and ${name === 'You' ? 'play' : 'plays'} again.${lastCard}`;
  } else if (card.n === 2 || card.n === 5) {
    const pick = card.n === 2 ? 2 : 3;
    const got = draw(s, after, pick);
    s.turn = next(s, after);
    s.said = `${name}: ${shape}, "Pick ${pick === 2 ? 'two' : 'three'}!" ${says(s.names[after], 'picks', 'pick')} ${got}.${lastCard}`;
  } else if (card.n === 8) {
    s.turn = next(s, after);
    s.said = `${name}: ${shape}, "Suspension!" ${says(s.names[after], 'misses', 'miss')} a turn.${lastCard}`;
  } else if (card.n === 14) {
    for (let p = 0; p < s.hands.length; p++) if (p !== who) draw(s, p, 1);
    s.said = `${name}: ${shape}, "General market!" Everyone else picks one, and ${says(name, 'goes', 'go')} again.${lastCard}`;
  } else {
    s.turn = after;
    s.said = `${says(name, 'plays', 'play')} ${shape}.${lastCard}`;
  }
  return s;
}

/** Nothing to play: to market, and the turn passes */
export function goToMarket(state: WhotState): WhotState {
  const s: WhotState = { ...state, hands: state.hands.map((h) => [...h]), market: [...state.market], pile: [...state.pile] };
  draw(s, s.turn, 1);
  s.said = `${says(s.names[s.turn], 'goes', 'go')} to market.`;
  s.turn = next(s, s.turn);
  return s;
}

/** The computer's turn: attacks when someone is close to winning, saves its Whots, calls its own strongest shape */
export function botTurn(s: WhotState): WhotState {
  const hand = s.hands[s.turn];
  const playable = hand.filter((c) => canPlay(s, c));
  if (!playable.length) return goToMarket(s);
  const threat = s.hands.some((h, p) => p !== s.turn && h.length <= 2);
  const rank = (c: WhotCard) => {
    if (c.shape === 'whot') return hand.length === 1 ? 100 : -50;
    if (threat && (c.n === 2 || c.n === 5 || c.n === 8)) return 60;
    if (c.n === 1 || c.n === 14) return 40;
    return c.n === 2 || c.n === 5 || c.n === 8 ? 25 : 10 + hand.filter((h) => h.shape === c.shape).length;
  };
  const card = [...playable].sort((a, b) => rank(b) - rank(a))[0];
  const counts = SHAPES.map((sh) => [sh, hand.filter((c) => c.shape === sh && c.id !== card.id).length] as const);
  const call = [...counts].sort((a, b) => b[1] - a[1])[0][0];
  return playCard(s, card.id, call) ?? goToMarket(s);
}
