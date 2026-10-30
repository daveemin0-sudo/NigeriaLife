/**
 * Ludo, four colours round the cross. Each token waits in its yard until a six brings it out
 * onto its own start square; it then runs the 52 squares of the track clockwise and turns up
 * its own home column to the centre. Landing on another colour sends that token home to its
 * yard, unless the square is a safe one (the start squares and the stars). A six, or a
 * capture, earns another roll. The first to bring all four tokens home wins.
 *
 * A token's place is counted from its own start: -1 in the yard, 0 to 50 on the track,
 * 51 to 55 up the home column, 56 home.
 */

export type Colour = 'red' | 'green' | 'yellow' | 'blue';
export const COLOURS: Colour[] = ['red', 'green', 'yellow', 'blue'];
export const HOME = 56;

/** The 52 squares of the track, as [row, column] on the 15 by 15 board, clockwise from red's start */
export const TRACK: Array<[number, number]> = (() => {
  const t: Array<[number, number]> = [];
  for (let c = 1; c <= 5; c++) t.push([6, c]);
  for (let r = 5; r >= 0; r--) t.push([r, 6]);
  t.push([0, 7]);
  for (let r = 0; r <= 5; r++) t.push([r, 8]);
  for (let c = 9; c <= 14; c++) t.push([6, c]);
  t.push([7, 14]);
  for (let c = 14; c >= 9; c--) t.push([8, c]);
  for (let r = 9; r <= 14; r++) t.push([r, 8]);
  t.push([14, 7]);
  for (let r = 14; r >= 9; r--) t.push([r, 6]);
  for (let c = 5; c >= 0; c--) t.push([8, c]);
  t.push([7, 0]);
  t.push([6, 0]);
  return t;
})();

const at = (r: number, c: number) => TRACK.findIndex(([a, b]) => a === r && b === c);
/** Where each colour comes out onto the track */
export const ENTRY: Record<Colour, number> = { red: at(6, 1), green: at(1, 8), yellow: at(8, 13), blue: at(13, 6) };
export const SAFE = new Set<number>([...COLOURS.map((c) => ENTRY[c]), ...COLOURS.map((c) => (ENTRY[c] + 8) % 52)]);
/** The home column of each colour, from the track inwards */
export const COLUMN: Record<Colour, Array<[number, number]>> = {
  red: [[7, 1], [7, 2], [7, 3], [7, 4], [7, 5]],
  green: [[1, 7], [2, 7], [3, 7], [4, 7], [5, 7]],
  yellow: [[7, 13], [7, 12], [7, 11], [7, 10], [7, 9]],
  blue: [[13, 7], [12, 7], [11, 7], [10, 7], [9, 7]],
};

export interface LudoState {
  players: Colour[];
  names: string[];
  tokens: number[][];
  turn: number;
  die: number | null;
  /** The roll has been made and a token must be moved (or there is none to move) */
  rolled: boolean;
  winner: number | null;
  said: string;
  sixes: number;
}

export function newLudo(names: string[], players: Colour[] = COLOURS.slice(0, names.length)): LudoState {
  return { players, names, tokens: players.map(() => [-1, -1, -1, -1]), turn: 0, die: null, rolled: false, winner: null, said: `${names[0]} to roll.`, sixes: 0 };
}

/** The track square a token is on, or null in the yard, the home column or home */
export function squareOf(colour: Colour, place: number): number | null {
  return place >= 0 && place <= 50 ? (ENTRY[colour] + place) % 52 : null;
}

/** The board cell a token is drawn in: the yard is left to the board to draw */
export function cellOf(colour: Colour, place: number): [number, number] | null {
  const sq = squareOf(colour, place);
  if (sq !== null) return TRACK[sq];
  if (place >= 51 && place <= 55) return COLUMN[colour][place - 51];
  if (place === HOME) return [7, 7];
  return null;
}

export function movable(s: LudoState): number[] {
  if (!s.rolled || s.die === null || s.winner !== null) return [];
  const mine = s.tokens[s.turn];
  return mine.map((p, i) => ({ p, i })).filter(({ p }) => (p === -1 ? s.die === 6 : p !== HOME && p + s.die! <= HOME)).map(({ i }) => i);
}

const say = (name: string, you: string, other: string) => (name === 'You' ? you : other);

export function roll(state: LudoState, value = 1 + Math.floor(Math.random() * 6)): LudoState {
  if (state.rolled || state.winner !== null) return state;
  const s: LudoState = { ...state, tokens: state.tokens.map((t) => [...t]), die: value, rolled: true };
  const name = s.names[s.turn];
  s.sixes = value === 6 ? s.sixes + 1 : 0;
  if (s.sixes === 3) {
    s.said = `${name} ${say(name, 'roll', 'rolls')} three sixes: the turn is lost.`;
    return pass(s);
  }
  if (!movable(s).length) {
    s.said = `${name} ${say(name, 'roll', 'rolls')} ${value}: no move.`;
    return pass(s);
  }
  s.said = `${name} ${say(name, 'roll', 'rolls')} ${value}.`;
  return s;
}

function pass(s: LudoState): LudoState {
  s.turn = (s.turn + 1) % s.players.length;
  s.rolled = false;
  s.sixes = 0;
  return s;
}

/** Moves a token by the roll; returns the new state, or null if that token cannot move */
export function move(state: LudoState, token: number): LudoState | null {
  if (!movable(state).includes(token)) return null;
  const s: LudoState = { ...state, tokens: state.tokens.map((t) => [...t]) };
  const colour = s.players[s.turn];
  const name = s.names[s.turn];
  const from = s.tokens[s.turn][token];
  const to = from === -1 ? 0 : from + s.die!;
  s.tokens[s.turn][token] = to;
  let captured = false;
  const sq = squareOf(colour, to);
  if (sq !== null && !SAFE.has(sq)) {
    s.players.forEach((other, p) => {
      if (p === s.turn) return;
      s.tokens[p].forEach((place, k) => {
        if (squareOf(other, place) === sq) {
          s.tokens[p][k] = -1;
          captured = true;
          s.said = `${name} ${say(name, 'knock', 'knocks')} ${s.names[p]}'s token back to the yard!`;
        }
      });
    });
  }
  if (!captured) s.said = from === -1 ? `${name} ${say(name, 'bring', 'brings')} a token out.` : to === HOME ? `${name} ${say(name, 'get', 'gets')} a token home!` : `${name} ${say(name, 'move', 'moves')} ${s.die}.`;
  if (s.tokens[s.turn].every((p) => p === HOME)) {
    s.winner = s.turn;
    s.said = `${name} ${say(name, 'win', 'wins')}! All four tokens home.`;
    s.rolled = false;
    return s;
  }
  // A six or a capture: roll again
  if (s.die === 6 || captured) {
    s.rolled = false;
    return s;
  }
  return pass(s);
}

/** The computer's choice of token: a capture, then home, then out of the yard, then to safety */
export function botPick(s: LudoState): number {
  const options = movable(s);
  const colour = s.players[s.turn];
  const score = (i: number) => {
    const from = s.tokens[s.turn][i];
    const to = from === -1 ? 0 : from + s.die!;
    const sq = squareOf(colour, to);
    let v = to / 10;
    if (to === HOME) v += 60;
    if (from <= 50 && to > 50) v += 35;
    if (from === -1) v += 30;
    if (sq !== null && SAFE.has(sq)) v += 15;
    if (sq !== null && !SAFE.has(sq)) {
      s.players.forEach((other, p) => {
        if (p === s.turn) return;
        for (const place of s.tokens[p]) {
          const o = squareOf(other, place);
          if (o === sq) v += 100;
          // An opponent up to six behind could land on it
          if (o !== null && ((sq - o + 52) % 52) >= 1 && ((sq - o + 52) % 52) <= 6) v -= 25;
        }
      });
    }
    return v + Math.random();
  };
  return [...options].sort((a, b) => score(b) - score(a))[0];
}
