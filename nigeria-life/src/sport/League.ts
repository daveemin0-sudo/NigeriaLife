/**
 * The Eko Premier League: eight clubs playing one match after another, a new kick-off every
 * five minutes of real time, all day. The fixture list is public (anyone can work out who plays
 * whom in any slot), and so is each side's form on the day; the match itself is played out by
 * the football show (`MatchSim`) from a seed. Offline the seed comes from the slot; online the
 * world server keeps the seeds secret and gives each one out only at kick-off, so nobody can
 * play a match through before it starts and bet on the answer.
 *
 * The same match is what the screen at Oga Sunday's shows, what the football channel shows at
 * home, what the betting app follows live, and what the server replays to pay a winning bet.
 *
 * Plain code with no imports but the match, so the game server runs it too.
 */
import { MatchSim, MATCH_SECONDS } from '../world/landmarks/MatchSim.ts';

export interface Club {
  id: string;
  name: string;
  short: string;
  /** How good they are, 1 being ordinary */
  strength: number;
  /** Shirt colours, for badges */
  colours: [string, string];
  home: string;
}

export const CLUBS: Club[] = [
  { id: 'eko', name: 'Eko United', short: 'EKO', strength: 1.3, colours: ['#15803d', '#f8fafc'], home: 'Lagos Island' },
  { id: 'lions', name: 'Lagos Lions', short: 'LAG', strength: 1.18, colours: ['#b45309', '#fde68a'], home: 'Surulere' },
  { id: 'hawks', name: 'Abuja Hawks', short: 'ABJ', strength: 1.1, colours: ['#1d4ed8', '#e0f2fe'], home: 'Abuja' },
  { id: 'rivers', name: 'Rivers Stars', short: 'RIV', strength: 1.05, colours: ['#dc2626', '#fef2f2'], home: 'Port Harcourt' },
  { id: 'kano', name: 'Kano Falcons', short: 'KAN', strength: 1.0, colours: ['#facc15', '#1c1917'], home: 'Kano' },
  { id: 'ibadan', name: 'Ibadan Rovers', short: 'IBA', strength: 0.93, colours: ['#7c3aed', '#ede9fe'], home: 'Ibadan' },
  { id: 'enugu', name: 'Enugu Royals', short: 'ENU', strength: 0.88, colours: ['#0f766e', '#ccfbf1'], home: 'Enugu' },
  { id: 'calabar', name: 'Calabar Sharks', short: 'CAL', strength: 0.81, colours: ['#0ea5e9', '#082f49'], home: 'Calabar' },
];

/** A kick-off every five minutes: four minutes of football (ninety on the clock), then a break */
export const SLOT_MS = 300_000;
export const PLAY_MS = MATCH_SECONDS * 1000;
/** The bookmaker's margin on every price */
const MARGIN = 0.08;

export type Pick = '1' | 'X' | '2' | 'O' | 'U';
export const PICKS: Array<{ id: Pick; label: string }> = [
  { id: '1', label: 'Home win' },
  { id: 'X', label: 'Draw' },
  { id: '2', label: 'Away win' },
  { id: 'O', label: 'Over 2.5 goals' },
  { id: 'U', label: 'Under 2.5 goals' },
];

export interface Fixture {
  slot: number;
  home: Club;
  away: Club;
  /** Strength on the day: the club's own, give or take its form */
  form: [number, number];
  kickoff: number;
  end: number;
}

export interface Goal {
  minute: number;
  side: 0 | 1;
}

export function slotAt(ms: number): number {
  return Math.floor(ms / SLOT_MS);
}

function hash(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  h ^= h >>> 13;
  h = Math.imul(h, 0x5bd1e995);
  h ^= h >>> 15;
  return h >>> 0;
}

/** The round-robin: seven rounds of four matches, the second time round with home and away swapped */
const ROUNDS: Array<Array<[number, number]>> = (() => {
  const n = CLUBS.length;
  const rounds: Array<Array<[number, number]>> = [];
  const ring = Array.from({ length: n }, (_, i) => i);
  for (let r = 0; r < n - 1; r++) {
    const pairs: Array<[number, number]> = [];
    for (let i = 0; i < n / 2; i++) {
      const a = ring[i];
      const b = ring[n - 1 - i];
      pairs.push(r % 2 === 0 ? [a, b] : [b, a]);
    }
    rounds.push(pairs);
    ring.splice(1, 0, ring.pop()!);
  }
  return [...rounds, ...rounds.map((pairs) => pairs.map(([a, b]) => [b, a] as [number, number]))];
})();
const PER_SEASON = ROUNDS.length * ROUNDS[0].length;

export function fixture(slot: number): Fixture {
  const k = ((slot % PER_SEASON) + PER_SEASON) % PER_SEASON;
  const [h, a] = ROUNDS[Math.floor(k / ROUNDS[0].length)][k % ROUNDS[0].length];
  const wobble = (salt: string) => 0.94 + (hash(`${salt}:${slot}`) % 1000) / 1000 * 0.12;
  const home = CLUBS[h];
  const away = CLUBS[a];
  return {
    slot,
    home,
    away,
    form: [home.strength * wobble(home.id), away.strength * wobble(away.id)],
    kickoff: slot * SLOT_MS,
    end: slot * SLOT_MS + PLAY_MS,
  };
}

/** The seed a match is played from when nobody is keeping it secret (playing alone) */
export function openSeed(slot: number): number {
  return hash(`eko-league:${slot}`);
}

/**
 * The chances, from many thousands of matches played out by the show itself at each gap in
 * strength (see the calibration in the commit that added this): the stronger side's win, the
 * draw, and goals over two and a half, by how far apart the two sides are.
 */
const GAPS = [0, 0.11, 0.223, 0.357, 0.51];
const STRONGER = [0.36, 0.4245, 0.5215, 0.602, 0.6845];
const DRAWS = [0.28, 0.28, 0.233, 0.226, 0.19];

function between(table: number[], gap: number): number {
  if (gap >= GAPS[GAPS.length - 1]) return table[table.length - 1];
  let i = 0;
  while (gap > GAPS[i + 1]) i++;
  const t = (gap - GAPS[i]) / (GAPS[i + 1] - GAPS[i]);
  return table[i] + (table[i + 1] - table[i]) * t;
}

export function chances(f: Fixture): Record<Pick, number> {
  const gap = Math.log(f.form[0] / f.form[1]);
  const strong = between(STRONGER, Math.abs(gap));
  const draw = between(DRAWS, Math.abs(gap));
  const weak = 1 - strong - draw;
  const over = Math.min(0.6, 0.44 + 0.16 * Math.abs(gap));
  return { '1': gap >= 0 ? strong : weak, X: draw, '2': gap >= 0 ? weak : strong, O: over, U: 1 - over };
}

/** The price paid on a pick: stake times this, stake included */
export function odds(f: Fixture): Record<Pick, number> {
  const c = chances(f);
  const price = (p: number) => Math.max(1.05, Math.floor((1 / (p * (1 + MARGIN))) * 100) / 100);
  return { '1': price(c['1']), X: price(c.X), '2': price(c['2']), O: price(c.O), U: price(c.U) };
}

const RESULTS = new Map<string, [number, number]>();

/** The final score of a match, worked out once and remembered */
export function result(f: Fixture, seed: number): [number, number] {
  const key = `${f.slot}:${seed}`;
  let score = RESULTS.get(key);
  if (!score) {
    const sim = new MatchSim(36, 24, [f.home.name, f.away.name], seed, f.form);
    sim.playTo(MATCH_SECONDS);
    score = [sim.score[0], sim.score[1]];
    RESULTS.set(key, score);
    if (RESULTS.size > 400) RESULTS.delete(RESULTS.keys().next().value!);
  }
  return score;
}

/** Whether a pick won, given the final score */
export function won(pick: Pick, score: [number, number]): boolean {
  const [h, a] = score;
  if (pick === '1') return h > a;
  if (pick === 'X') return h === a;
  if (pick === '2') return a > h;
  if (pick === 'O') return h + a > 2;
  return h + a <= 2;
}

/** The match on now, followed in step with the clock so everyone watching sees the same thing. */
export class LiveMatch {
  public readonly fixture: Fixture;
  public readonly sim: MatchSim;
  public readonly goals: Goal[] = [];
  private seen = 0;

  constructor(f: Fixture, seed: number) {
    this.fixture = f;
    this.sim = new MatchSim(36, 24, [f.home.name, f.away.name], seed, f.form);
  }

  /** Plays on to where the match is at this moment, a second at a time so goals get their minute */
  public catchUp(now: number): void {
    const target = Math.max(0, Math.min(PLAY_MS, now - this.fixture.kickoff)) / 1000;
    let t = Math.floor(this.sim.clock) + 1;
    while (t <= target) {
      this.sim.playTo(t);
      this.note();
      t += 1;
    }
    this.sim.playTo(target);
    this.note();
  }

  private note(): void {
    if (this.sim.goals === this.seen) return;
    this.seen = this.sim.goals;
    this.goals.push({ minute: Math.max(1, this.sim.minute), side: (this.sim.lastScorer ?? 0) as 0 | 1 });
  }
}

export const SEASON_LENGTH = PER_SEASON;
