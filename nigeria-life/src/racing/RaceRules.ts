/**
 * Street racing: the courses, the street racers' pace, what is won, and whether a time can be
 * true. Plain rules with nothing drawn, shared by the game and the server, so a rival's time is
 * the same sum in both places and a prize is decided where the money is.
 *
 * A course is a line driven along the middle of the racing lanes, from the start line to the
 * finish, round U-turns where it turns back; checkpoints are gates across the carriageway at
 * points along it. World coordinates, metres; +z is north, and a car heading north keeps to the
 * west (-x) side of a divided road.
 */

export type RaceCity = 'lagos' | 'abuja' | 'port_harcourt';

export interface CoursePoint {
  x: number;
  z: number;
  /** From here to the next point no faster than this (round a U-turn), metres a second */
  limit?: number;
}

export interface Course {
  id: string;
  city: RaceCity;
  name: string;
  /** A line under the name: where it goes */
  blurb: string;
  kind: 'sprint' | 'circuit' | 'drag';
  laps: number;
  /** One lap of the line driven, start to finish (a circuit's end is its start) */
  lap: CoursePoint[];
  /** Checkpoints, as distances along one lap (the finish line is the last, at the lap's end) */
  gates: number[];
  /** The racing lanes, metres to the driver's right of the line driven (0 is the line itself) */
  lanes: number[];
  /** How far a gate reaches across the carriageway from the line: to the left (the median) and to the right (the kerb) */
  reach: [number, number];
}

// --- Building the lines --------------------------------------------------------------------------

const straight = (x: number, z0: number, z1: number): CoursePoint[] => [{ x, z: z0 }, { x, z: z1 }];

/** A U-turn through the gap in the median at `cz`, from one side's line to the other's, bulging north or south */
function uTurn(cz: number, fromX: number, toX: number, north: boolean, limit = 9): CoursePoint[] {
  const r = Math.abs(toX - fromX) / 2;
  const mid = (fromX + toX) / 2;
  const pts: CoursePoint[] = [];
  const steps = 14;
  for (let i = 0; i <= steps; i++) {
    const a = (Math.PI * i) / steps;
    // From the start side round the bulge (north of the gap when going north) to the other side
    const x = mid + (fromX < toX ? -1 : 1) * r * Math.cos(a);
    const z = cz + (north ? 1 : -1) * r * Math.sin(a);
    // The last point begins the straight after the turn: no limit from there
    pts.push(i < steps ? { x, z, limit } : { x, z });
  }
  return pts;
}

const join = (...parts: CoursePoint[][]): CoursePoint[] => {
  const out: CoursePoint[] = [];
  for (const part of parts) for (const p of part) {
    const last = out[out.length - 1];
    if (last && Math.hypot(last.x - p.x, last.z - p.z) < 0.01) {
      if (p.limit && !last.limit) last.limit = p.limit;
      continue;
    }
    out.push({ ...p });
  }
  return out;
};

/** The expressway's middle northbound lane is at -4.9, the southbound at +4.9; the lanes 3.1 m apart */
const NORTH = -4.9;
const SOUTH = 4.9;
const EXPRESS_LANES = [-3.1, 0, 3.1];

export const COURSES: Course[] = [
  {
    id: 'bridge',
    city: 'lagos',
    name: 'Third Mainland Bridge',
    blurb: 'Flat out over the lagoon, under the bridge tower, to the mainland: 1.5 km',
    kind: 'sprint',
    laps: 1,
    lap: straight(NORTH, 1150, 2650),
    gates: [500, 1000, 1500],
    lanes: EXPRESS_LANES,
    reach: [4.0, 6.4],
  },
  {
    id: 'ikorodu',
    city: 'lagos',
    name: 'Ikorodu Road',
    blurb: 'Past Computer Village, Ikeja City Mall, Oshodi and LASUTH: 1.5 km',
    kind: 'sprint',
    laps: 1,
    lap: straight(NORTH, 4150, 5650),
    gates: [400, 800, 1150, 1500],
    lanes: EXPRESS_LANES,
    reach: [4.0, 6.4],
  },
  {
    id: 'ikeja',
    city: 'lagos',
    name: 'Ikeja circuit',
    blurb: 'Two laps of Ikorodu Road, turning back through the median by Awolowo Way and by Allen Avenue: 4.5 km',
    kind: 'circuit',
    laps: 2,
    lap: join(
      straight(NORTH, 4760, 5800),
      uTurn(5800, NORTH, SOUTH, true),
      straight(SOUTH, 5800, 4700),
      uTurn(4700, SOUTH, NORTH, false),
      straight(NORTH, 4700, 4760),
    ),
    // Up to Ladipo, back past the mall, round the south turn; the finish is the start line
    gates: [520, 1060, 1600, 2160, 2230.8],
    lanes: EXPRESS_LANES,
    reach: [4.0, 6.4],
  },
  {
    id: 'island_airport',
    city: 'lagos',
    name: 'Island to the airport',
    blurb: 'From Broad Street over the bridge and up Ikorodu Road to Murtala Muhammed: 6.3 km',
    kind: 'sprint',
    laps: 1,
    // Broad Street's northbound lanes (1.8 and 5.0 west of the middle) become the expressway's
    lap: join([{ x: -3.4, z: -30 }, { x: -3.4, z: 110 }], [{ x: NORTH, z: 170 }, { x: NORTH, z: 6260 }]),
    gates: [900, 1900, 2900, 3900, 4900, 6291],
    lanes: [-1.6, 1.6],
    reach: [4.0, 6.4],
  },
  {
    id: 'shagari_drag',
    city: 'abuja',
    name: 'Shehu Shagari Way drag',
    blurb: 'A straight run up the avenue towards Aso Rock: 190 m',
    kind: 'drag',
    laps: 1,
    lap: straight(-5.5, -70, 120),
    gates: [95, 190],
    lanes: [-2.2, 2.2],
    reach: [4.4, 4.5],
  },
  {
    id: 'aba_drag',
    city: 'port_harcourt',
    name: 'Aba Road drag',
    blurb: 'Down Aba Road between the shops, flat out: 230 m',
    kind: 'drag',
    laps: 1,
    lap: straight(-4.4, -115, 115),
    gates: [115, 230],
    lanes: [-2.2, 2.2],
    reach: [4.1, 4.5],
  },
];

export const courseById = (id: string): Course | null => COURSES.find((c) => c.id === id) ?? null;

// --- Along the line ------------------------------------------------------------------------------

/** How long one lap is, and the distance along it at every point */
export function lapTable(course: Course): number[] {
  const at = [0];
  for (let i = 1; i < course.lap.length; i++) at.push(at[i - 1] + Math.hypot(course.lap[i].x - course.lap[i - 1].x, course.lap[i].z - course.lap[i - 1].z));
  return at;
}

export const lapLength = (course: Course): number => {
  const t = lapTable(course);
  return t[t.length - 1];
};

export const raceLength = (course: Course): number => lapLength(course) * course.laps;

/** Every checkpoint of the whole race, lap after lap, as distances from the start */
export function raceGates(course: Course): number[] {
  const lap = lapLength(course);
  const out: number[] = [];
  for (let l = 0; l < course.laps; l++) for (const g of course.gates) out.push(Math.min(lap, g) + l * lap);
  return out;
}

/** The point on the line at a distance along the race, which way it runs there, and its limit */
export function pointAt(course: Course, s: number, table = lapTable(course)): { x: number; z: number; dx: number; dz: number; limit: number | null } {
  const lap = table[table.length - 1];
  let d = course.laps > 1 ? ((s % lap) + lap) % lap : Math.max(0, Math.min(lap, s));
  if (course.laps > 1 && s >= lap * course.laps) d = lap;
  let i = 1;
  while (i < table.length - 1 && table[i] < d) i++;
  const a = course.lap[i - 1];
  const b = course.lap[i];
  const len = Math.max(1e-6, table[i] - table[i - 1]);
  const t = Math.max(0, Math.min(1, (d - table[i - 1]) / len));
  return { x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t, dx: (b.x - a.x) / len, dz: (b.z - a.z) / len, limit: a.limit ?? null };
}

// --- The street racers ---------------------------------------------------------------------------

export type Stake = 0 | 10_000 | 100_000 | 1_000_000;
export const STAKES: Stake[] = [0, 10_000, 100_000, 1_000_000];

/** How hard the racers drive for each stake: top speed and pull, metres a second */
const PACE: Record<Stake, { top: number; pull: number }> = {
  0: { top: 29, pull: 7.5 },
  10_000: { top: 35, pull: 9 },
  100_000: { top: 43, pull: 11 },
  1_000_000: { top: 53, pull: 13 },
};

export interface Rival {
  name: string;
  car: string;
  paint: number;
}

/** Who turns up, by how much is at stake: the money brings out the fast cars */
const RIVALS: Record<Stake, Rival[]> = {
  0: [
    { name: 'Kunle from Ojota', car: 'corolla_2008', paint: 0xb91c1c },
    { name: 'Blessing Okafor', car: 'camry', paint: 0xf8fafc },
    { name: 'Danladi "Shortcut"', car: 'accord', paint: 0x6b7280 },
  ],
  10_000: [
    { name: 'Tobi Lekki', car: 'lexus_rx', paint: 0x0f172a },
    { name: 'Chidi Okoro', car: 'camry', paint: 0x1e3a8a },
    { name: 'Halima "Hurricane"', car: 'highlander', paint: 0x7f1d1d },
  ],
  100_000: [
    { name: 'Emeka Allen', car: 'range_rover', paint: 0x14532d },
    { name: 'Tunde "Speed" Bakare', car: 'cayenne', paint: 0xeab308 },
    { name: 'Ngozi Banana Island', car: 'panamera', paint: 0x334155 },
  ],
  1_000_000: [
    { name: 'Ada "Chiron" Lekki', car: 'chiron', paint: 0x1d4ed8 },
    { name: 'Seun V.I.', car: 'aventador', paint: 0xf97316 },
    { name: 'Musa "Mallam Fast"', car: 'huracan', paint: 0x84cc16 },
  ],
};

export const rivalsFor = (stake: Stake): Rival[] => RIVALS[stake];

/** A number from 0 to 1, the same for the same seed and index */
export function seeded(seed: number, i: number): number {
  let h = (Math.imul(seed | 0, 2654435761) ^ Math.imul(i + 1, 1597334677)) >>> 0;
  h = Math.imul(h ^ (h >>> 15), 2246822507) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 3266489909) >>> 0;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/**
 * One racer's run, as the time they reach every metre of the race: they get away a moment after
 * the lights, pull up to their top speed (less pull as they go faster), slow for each U-turn in
 * time and pull away again. Sampled every metre; `timeAt` and `distanceAt` read it.
 */
export interface Run {
  /** Seconds from the green light to each metre of the race */
  times: Float64Array;
  length: number;
}

export function plan(course: Course, top: number, pull: number, start: number, brake = 12): Run {
  const length = raceLength(course);
  const n = Math.max(2, Math.ceil(length) + 1);
  const table = lapTable(course);
  const limit = new Float64Array(n);
  for (let i = 0; i < n; i++) limit[i] = pointAt(course, Math.min(length, i), table).limit ?? top;
  // As fast as they can pull to, then as slow as they must be by each limit ahead
  const v = new Float64Array(n);
  v[0] = 0;
  for (let i = 1; i < n; i++) {
    const was = v[i - 1];
    const ease = 1 - 0.75 * (was / top) ** 2;
    v[i] = Math.min(top, limit[i], Math.sqrt(was * was + 2 * pull * Math.max(0.05, ease)));
  }
  for (let i = n - 2; i >= 0; i--) v[i] = Math.min(v[i], Math.sqrt(v[i + 1] * v[i + 1] + 2 * brake));
  const times = new Float64Array(n);
  times[0] = start;
  for (let i = 1; i < n; i++) times[i] = times[i - 1] + 2 / Math.max(0.5, v[i - 1] + v[i]);
  return { times, length };
}

/**
 * The grid: the player in the middle lane (or the kerb lane of two), the racers in the others,
 * side by side on the line. As many racers as there are lanes beside the player's.
 */
export function grid(course: Course): { player: number; rivals: number[] } {
  const lanes = [...course.lanes];
  const player = lanes.reduce((best, l) => (Math.abs(l) < Math.abs(best) - 0.01 || (Math.abs(Math.abs(l) - Math.abs(best)) < 0.01 && l > best) ? l : best), lanes[0]);
  return { player, rivals: lanes.filter((l) => l !== player) };
}

/** Each racer in a race of this course and stake, with this seed: who, in what car, their lane and their run */
export function racers(course: Course, stake: Stake, seed: number): Array<Rival & { run: Run; lane: number }> {
  const pace = PACE[stake];
  const lanes = grid(course).rivals;
  return RIVALS[stake].slice(0, lanes.length).map((r, i) => {
    const top = pace.top * (0.96 + 0.07 * seeded(seed, i * 3));
    const pull = pace.pull * (0.92 + 0.16 * seeded(seed, i * 3 + 1));
    const start = 0.25 + 0.55 * seeded(seed, i * 3 + 2);
    return { ...r, run: plan(course, top, pull, start), lane: lanes[i] };
  });
}

/** Seconds from the green light until a run reaches the finish */
export const finishTime = (run: Run): number => run.times[run.times.length - 1];

/** How far along the race a run is, this many seconds after the green light */
export function distanceAt(run: Run, t: number): number {
  const times = run.times;
  if (t <= times[0]) return 0;
  if (t >= times[times.length - 1]) return run.length;
  let lo = 0;
  let hi = times.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (times[mid] <= t) lo = mid;
    else hi = mid;
  }
  return Math.min(run.length, lo + (t - times[lo]) / Math.max(1e-6, times[hi] - times[lo]));
}

/** The time each medal needs on a course: gold is as fast as the hundred-thousand racers, bronze as the free ones */
export function medalTimes(course: Course): { gold: number; silver: number; bronze: number } {
  const t = (stake: Stake) => finishTime(plan(course, PACE[stake].top, PACE[stake].pull, 0.5));
  return { gold: t(100_000), silver: t(10_000), bronze: t(0) };
}

export function medalFor(course: Course, seconds: number): 'gold' | 'silver' | 'bronze' | null {
  const m = medalTimes(course);
  return seconds <= m.gold ? 'gold' : seconds <= m.silver ? 'silver' : seconds <= m.bronze ? 'bronze' : null;
}

// --- Whether a time can be true --------------------------------------------------------------------

/** No car on these roads, however tuned, goes faster than this or pulls harder */
const FASTEST = { top: 72, pull: 40 };

/**
 * A time is believed if it is no quicker than the fastest car there is could have done it (each
 * checkpoint too, in order), and under half an hour. `splits` are seconds at each checkpoint.
 */
export function believable(course: Course, seconds: number, splits: number[]): string | null {
  if (!Number.isFinite(seconds) || seconds <= 0 || seconds > 1800) return 'That time cannot be read.';
  const gates = raceGates(course);
  if (splits.length !== gates.length) return 'Every checkpoint must be passed.';
  const best = plan(course, FASTEST.top, FASTEST.pull, 0, 30);
  let before = 0;
  for (let i = 0; i < gates.length; i++) {
    const at = splits[i];
    if (!Number.isFinite(at) || at < before) return 'The checkpoints are out of order.';
    const fastest = best.times[Math.min(best.times.length - 1, Math.round(gates[i]))];
    if (at < fastest * 0.97) return 'No car could have got there that fast.';
    before = at;
  }
  if (Math.abs(splits[splits.length - 1] - seconds) > 0.05) return 'The finish does not match the last checkpoint.';
  return null;
}

// --- What is won -----------------------------------------------------------------------------------

/**
 * Everyone puts in the stake; the winner takes the pot, less a tenth for whoever runs the race.
 * Second and third lose their stake. For glory, nothing changes hands.
 */
export function prize(stake: Stake, place: number, field: number): number {
  if (!stake || place !== 1) return 0;
  return Math.round(stake * field * 0.9);
}

/** Where the player came: one more than the racers who finished before them */
export function placeOf(seconds: number, others: number[]): number {
  return 1 + others.filter((t) => t < seconds).length;
}
