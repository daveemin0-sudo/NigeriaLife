/**
 * Living city, stage 3: where the crowd's people go, and when.
 *
 * Not a second crowd: `CityPopulation` still owns every person, draws them, steps them aside and
 * takes them over the road. This module is its mind:
 *   - `WalkNetwork`: the pavements the crowd already walks, joined at corners, over the roads that
 *     have a crossing, and to the doors and stalls along them; with a route table worked out once
 *     per destination, on first use. Nobody path-finds while walking.
 *   - Places: the doors each city already has (its `interactiveList`), sorted into kinds, with the
 *     hours the door itself keeps (`destinations/Hours.ts`, the one record of them).
 *   - Residents: a role from each person's number, a home at the edge of the map, a workplace or a
 *     pitch, and a day plan from the city's own profile. Nothing is stored: the same number gives
 *     the same life every day, so a routine is remembered across updates, reloads and city changes.
 */
import type { WalkRun } from '../density/CityFabric';
import type { Crossing } from './CityPopulation';
import { hoursFor, isOpen, PLACE_HOURS, type OpeningHours } from '../../destinations/Hours';

// ---------------------------------------------------------------------------------------------
// PLACES
// ---------------------------------------------------------------------------------------------

export type PlaceKind = 'office' | 'bank' | 'shop' | 'food' | 'market' | 'school' | 'site' | 'transit' | 'worship' | 'night' | 'stall';

export interface PlaceInput {
  id: string;
  name: string;
  category: string;
  /** Where someone stands to go in */
  x: number;
  z: number;
  /** The hours the door keeps, if it is a door with a room behind it (null: none found, use its kind's) */
  hours?: OpeningHours | null;
}

export interface Place {
  id: string;
  name: string;
  kind: PlaceKind;
  x: number;
  z: number;
  /** Undefined: never shut */
  hours?: OpeningHours;
  /** The pavement node it opens off */
  node: number;
  /** A stall: its number in the street (for opening and shutting it), and which way it faces */
  stall?: number;
  yaw?: number;
}

/** What a door is, from its name and the category the game gives it. Null: nobody's destination (land, cars, cash machines, the player's homes). */
export function kindOf(name: string, category: string): PlaceKind | null {
  const s = `${name} ${category}`.toLowerCase();
  if (/\bland\b|vehicle|a home|open all hours|cash machine|boarding|arrivals|staff|lift|stairs|gate/.test(s)) return null;
  if (/mosque|church|christian centre|cathedral|worship/.test(s)) return 'worship';
  if (/club|lounge|nightlife|\bbar\b|viewing|gaming|\bbet\b|shrine/.test(s)) return 'night';
  if (/buka|mama put|food|restaurant|suya|eatery|chop|kitchen|bole/.test(s)) return 'food';
  if (/supermarket|mini mart/.test(s)) return 'shop';
  if (/market/.test(s)) return 'market';
  if (/universit|education|school|college|campus/.test(s)) return 'school';
  if (/building site|seaport|petro|refiner|repairs|auto works|workshop|filling|fuel|factory/.test(s)) return 'site';
  if (/motor park|terminal|transit|coach|danfo|bus/.test(s)) return 'transit';
  if (/bank|finance/.test(s)) return 'bank';
  if (/office|government|federal|secretariat|civic|ministry|commission|real estate|residence|hotel|hospital|police/.test(s)) return 'office';
  if (/shop|retail|commerce|supermarket|pharmacy|electronics|fashion|grooming|beauty|barber|salon|mall|textile|phones/.test(s)) return 'shop';
  return null;
}

/** Hours by kind, from the one record (`Hours.ts`), for a door that keeps none of its own */
export function hoursOfKind(kind: PlaceKind, name: string): OpeningHours | undefined {
  switch (kind) {
    case 'office':
      return hoursFor(name, 'Civic') ?? { opens: 8, closes: 16 };
    case 'bank':
      return hoursFor(name, 'Bank');
    case 'shop':
      return hoursFor(name, 'Supermarket');
    case 'food':
      return PLACE_HOURS.buka;
    case 'market':
      return hoursFor(name, 'Market');
    case 'school':
      return PLACE_HOURS.university;
    case 'site':
      return PLACE_HOURS.buildingSite;
    case 'transit':
      return hoursFor(name, 'Transit');
    case 'night':
      return hoursFor(name, 'Nightclub');
    case 'stall':
      return PLACE_HOURS.stall;
    case 'worship':
      return undefined;
  }
}

// ---------------------------------------------------------------------------------------------
// THE PAVEMENT NETWORK
// ---------------------------------------------------------------------------------------------

export interface NetNode {
  x: number;
  z: number;
  /** Edge numbers */
  edges: number[];
  /** On the avenue's raised pavement (drawn at its height, and dropped where a road cuts it) */
  main: boolean;
}

export interface NetEdge {
  a: number;
  b: number;
  len: number;
  /** A road to go over, with what governs it */
  c?: Crossing;
  /** Where to wait at the kerb on each side, if not at the nodes themselves (over the avenue) */
  ka?: { x: number; z: number };
  kb?: { x: number; z: number };
}

interface Segment {
  axis: 'x' | 'z';
  fixed: number;
  from: number;
  to: number;
  main: boolean;
  cuts: number[];
  nodes?: number[];
}

export interface NetworkInput {
  runs: readonly WalkRun[];
  /** Straight on over a road, from the end of one run to the start of the next (the crowd's own links) */
  links: ReadonlyArray<{ up?: { run: number; c: Crossing } }>;
  avenue: { halfRoad: number; walk: number; from: number; to: number };
  /** Where roads cut the avenue's pavements */
  gaps: ReadonlyArray<{ from: number; to: number } & Crossing>;
  /** Ways over the avenue itself */
  zebras: ReadonlyArray<{ z: number } & Crossing>;
}

/** How far a door may stand from a pavement and still open off it, metres */
const DOOR_REACH = 7;
/** Two pavement ends this near (round a corner, or the same pavement broken by a driveway) are one walk */
const CORNER = 5.5;
/** What a road crossing costs a route, in metres of walking (people prefer to stay on their side) */
const CROSSING_COST = 12;

export class WalkNetwork {
  public readonly nodes: NetNode[] = [];
  public readonly edges: NetEdge[] = [];
  /** Where people come in from beyond the map and go home to: the dead ends at its edges */
  public readonly homes: number[] = [];
  /** For each destination node: the edge to take from every node (-1: there, or no way) */
  private readonly tables = new Map<number, Int32Array>();
  private readonly segs: Segment[] = [];
  private readonly avenueX: number;

  constructor(input: NetworkInput) {
    const av = input.avenue;
    this.avenueX = av.halfRoad + av.walk / 2;
    // The avenue's two pavements, broken where a road cuts them
    const avenueSegs: number[][] = [[], []];
    const cuts = [...input.gaps].sort((p, q) => p.from - q.from);
    for (const [k, side] of [-1, 1].entries()) {
      let from = av.from + 1;
      for (const g of cuts) {
        if (g.from > from) avenueSegs[k].push(this.addSeg('z', side * this.avenueX, from, g.from, true));
        from = g.to;
      }
      if (av.to - 1 > from) avenueSegs[k].push(this.addSeg('z', side * this.avenueX, from, av.to - 1, true));
    }
    const runSeg = input.runs.map((r) => (r.to - r.from >= 10 ? this.addSeg(r.axis, r.fixed, r.from, r.to, false) : -1));

    const joins: Array<{ s: number; u: number; t: number; v: number; c?: Crossing; ka?: { x: number; z: number }; kb?: { x: number; z: number } }> = [];
    // Over a road that cuts the avenue's pavement: from one piece to the next
    for (const k of [0, 1]) {
      const pieces = avenueSegs[k];
      for (let i = 0; i + 1 < pieces.length; i++) {
        const g = cuts.find((gap) => Math.abs(gap.from - this.segs[pieces[i]].to) < 0.01);
        joins.push({ s: pieces[i], u: this.segs[pieces[i]].to, t: pieces[i + 1], v: this.segs[pieces[i + 1]].from, c: g });
      }
    }
    // Over the avenue at its zebras, waiting at the kerb
    const kerb = av.halfRoad + 0.45;
    for (const zb of input.zebras) {
      const l = avenueSegs[0].find((s) => zb.z > this.segs[s].from && zb.z < this.segs[s].to);
      const r = avenueSegs[1].find((s) => zb.z > this.segs[s].from && zb.z < this.segs[s].to);
      if (l === undefined || r === undefined) continue;
      joins.push({ s: l, u: zb.z, t: r, v: zb.z, c: zb, ka: { x: -kerb, z: zb.z }, kb: { x: kerb, z: zb.z } });
    }
    // Straight on over a road between two runs (the crowd's links)
    input.links.forEach((l, i) => {
      if (!l.up || runSeg[i] < 0 || runSeg[l.up.run] < 0) return;
      joins.push({ s: runSeg[i], u: this.segs[runSeg[i]].to, t: runSeg[l.up.run], v: this.segs[runSeg[l.up.run]].from, c: l.up.c });
    });
    // Round a corner, or along a pavement broken by a driveway: ends close together
    const ends: Array<{ s: number; u: number; x: number; z: number }> = [];
    this.segs.forEach((g, s) => {
      for (const u of [g.from, g.to]) ends.push({ s, u, ...this.at(s, u) });
    });
    for (let i = 0; i < ends.length; i++) {
      for (let j = i + 1; j < ends.length; j++) {
        const p = ends[i];
        const q = ends[j];
        if (p.s === q.s || Math.hypot(p.x - q.x, p.z - q.z) > CORNER) continue;
        joins.push({ s: p.s, u: p.u, t: q.s, v: q.u });
      }
    }
    // A side street's pavement that runs up to the avenue joins it there
    this.segs.forEach((g, s) => {
      if (g.main || g.axis !== 'x') return;
      for (const u of [g.from, g.to]) {
        const side = Math.sign(u);
        if (Math.abs(Math.abs(u) - (av.halfRoad + av.walk)) > 3 || g.fixed < av.from || g.fixed > av.to) continue;
        const piece = avenueSegs[side < 0 ? 0 : 1].find((p) => g.fixed >= this.segs[p].from && g.fixed <= this.segs[p].to);
        if (piece !== undefined) joins.push({ s, u, t: piece, v: g.fixed });
      }
    });

    // Every point something joins at is a node on its pavement
    for (const j of joins) {
      this.segs[j.s].cuts.push(j.u);
      this.segs[j.t].cuts.push(j.v);
    }
    this.pendingJoins = joins;
  }

  private pendingJoins: Array<{ s: number; u: number; t: number; v: number; c?: Crossing; ka?: { x: number; z: number }; kb?: { x: number; z: number } }> | null = null;
  private pendingPlaces: Array<{ seg: number; u: number; index: number }> = [];

  /** Where on its pavement a door opens off: its segment and point along it, or null if no pavement is near */
  public attach(x: number, z: number): { seg: number; u: number } | null {
    let best: { seg: number; u: number } | null = null;
    let bestD = DOOR_REACH;
    for (let s = 0; s < this.segs.length; s++) {
      const g = this.segs[s];
      const along = g.axis === 'z' ? z : x;
      const across = g.axis === 'z' ? x : z;
      const u = Math.min(g.to, Math.max(g.from, along));
      // The avenue's pavement is wide: a door on its far edge is still on it
      const off = Math.max(0, Math.abs(across - g.fixed) - (g.main ? 3.5 : 0));
      const d = Math.hypot(along - u, off);
      if (d < bestD) {
        bestD = d;
        best = { seg: s, u };
      }
    }
    return best;
  }

  /** A door, stall or pitch to be given a node: call before `finish` */
  public addPlace(x: number, z: number, index: number): boolean {
    const on = this.attach(x, z);
    if (!on) return false;
    this.segs[on.seg].cuts.push(on.u);
    this.pendingPlaces.push({ seg: on.seg, u: on.u, index });
    return true;
  }

  /** Builds the nodes and edges. Returns each added place's node, by its index. */
  public finish(): Map<number, number> {
    this.segs.forEach((g) => {
      g.cuts.push(g.from, g.to);
      g.cuts.sort((p, q) => p - q);
      const merged: number[] = [];
      for (const u of g.cuts) if (!merged.length || u - merged[merged.length - 1] > 0.6) merged.push(u);
      g.cuts = merged;
      g.nodes = merged.map((u) => this.addNode(this.at(this.segs.indexOf(g), u), g.main));
      for (let i = 0; i + 1 < g.nodes.length; i++) this.addEdge(g.nodes[i], g.nodes[i + 1]);
    });
    for (const j of this.pendingJoins ?? []) {
      const a = this.nodeAt(j.s, j.u);
      const b = this.nodeAt(j.t, j.v);
      if (a !== b) this.addEdge(a, b, j.c, j.ka, j.kb);
    }
    this.pendingJoins = null;
    // The dead ends far out are where people come in from and go home to
    const r = (n: NetNode) => Math.max(Math.abs(n.x), Math.abs(n.z));
    let far = 0;
    for (const n of this.nodes) far = Math.max(far, r(n));
    this.nodes.forEach((n, i) => {
      if (n.edges.length === 1 && r(n) > far * 0.55) this.homes.push(i);
    });
    const placed = new Map<number, number>();
    for (const p of this.pendingPlaces) placed.set(p.index, this.nodeAt(p.seg, p.u));
    this.pendingPlaces = [];
    return placed;
  }

  /** The edge to take from `from` toward `to`; -1 when there, or when there is no way */
  public step(from: number, to: number): number {
    if (from === to) return -1;
    let table = this.tables.get(to);
    if (!table) {
      table = this.solve(to);
      this.tables.set(to, table);
    }
    return table[from];
  }

  /** Is there a way from one to the other? */
  public reaches(from: number, to: number): boolean {
    return from === to || this.step(from, to) >= 0;
  }

  /** The node nearest a point (only when a walk starts from somewhere that is not a node) */
  public nearest(x: number, z: number): number {
    let best = -1;
    let bestD = Infinity;
    for (let i = 0; i < this.nodes.length; i++) {
      const n = this.nodes[i];
      const d = (n.x - x) * (n.x - x) + (n.z - z) * (n.z - z);
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    }
    return best;
  }

  public other(edge: number, node: number): number {
    const e = this.edges[edge];
    return e.a === node ? e.b : e.a;
  }

  // Dijkstra from the destination outward: for each node, the edge that leads one step nearer
  private solve(to: number): Int32Array {
    const n = this.nodes.length;
    const dist = new Float64Array(n).fill(Infinity);
    const via = new Int32Array(n).fill(-1);
    const heap: number[] = [];
    const push = (node: number) => {
      heap.push(node);
      let i = heap.length - 1;
      while (i > 0) {
        const p = (i - 1) >> 1;
        if (dist[heap[p]] <= dist[heap[i]]) break;
        [heap[p], heap[i]] = [heap[i], heap[p]];
        i = p;
      }
    };
    const pop = (): number => {
      const top = heap[0];
      const last = heap.pop()!;
      if (heap.length) {
        heap[0] = last;
        let i = 0;
        for (;;) {
          const l = 2 * i + 1;
          const r = l + 1;
          let m = i;
          if (l < heap.length && dist[heap[l]] < dist[heap[m]]) m = l;
          if (r < heap.length && dist[heap[r]] < dist[heap[m]]) m = r;
          if (m === i) break;
          [heap[m], heap[i]] = [heap[i], heap[m]];
          i = m;
        }
      }
      return top;
    };
    dist[to] = 0;
    push(to);
    while (heap.length) {
      const u = pop();
      for (const e of this.nodes[u].edges) {
        const edge = this.edges[e];
        const v = edge.a === u ? edge.b : edge.a;
        const d = dist[u] + edge.len + (edge.c ? CROSSING_COST : 0);
        if (d < dist[v]) {
          dist[v] = d;
          via[v] = e;
          push(v);
        }
      }
    }
    return via;
  }

  private addSeg(axis: 'x' | 'z', fixed: number, from: number, to: number, main: boolean): number {
    this.segs.push({ axis, fixed, from, to, main, cuts: [] });
    return this.segs.length - 1;
  }

  private at(seg: number, u: number): { x: number; z: number } {
    const g = this.segs[seg];
    return g.axis === 'z' ? { x: g.fixed, z: u } : { x: u, z: g.fixed };
  }

  private nodeAt(seg: number, u: number): number {
    const g = this.segs[seg];
    let best = 0;
    for (let i = 1; i < g.cuts.length; i++) if (Math.abs(g.cuts[i] - u) < Math.abs(g.cuts[best] - u)) best = i;
    return g.nodes![best];
  }

  private addNode(p: { x: number; z: number }, main: boolean): number {
    this.nodes.push({ x: p.x, z: p.z, edges: [], main });
    return this.nodes.length - 1;
  }

  private addEdge(a: number, b: number, c?: Crossing, ka?: { x: number; z: number }, kb?: { x: number; z: number }): void {
    const p = this.nodes[a];
    const q = this.nodes[b];
    // An edge that already exists is not added twice
    for (const e of p.edges) if (this.other(e, a) === b) return;
    this.edges.push({ a, b, len: Math.hypot(p.x - q.x, p.z - q.z), c, ka, kb });
    const id = this.edges.length - 1;
    p.edges.push(id);
    q.edges.push(id);
  }
}

// ---------------------------------------------------------------------------------------------
// RESIDENTS AND THEIR DAYS
// ---------------------------------------------------------------------------------------------

/** What someone does with their day. Commuters go somewhere and in; the rest walk the streets in their hours. */
export type Role = 'office' | 'trader' | 'artisan' | 'student' | 'hawker' | 'idler' | 'owl' | 'elder';

export interface CityProfile {
  /** Shares of the walkers in each role (they need not add to 1: they are weighed) */
  roles: Record<Role, number>;
  /** When commuters set out, on average, before their place opens (hours), and how much that varies */
  early: number;
  spread: number;
  /** How long after their place's closing (or their own knocking-off time) people head home */
  knockOff: number;
  /** When street walkers are out: hawkers, idlers, night owls, elders [from, to] */
  out: Record<'hawker' | 'idler' | 'owl' | 'elder', [number, number]>;
}

/**
 * Each city its own day. Lagos sets out early to beat the go-slow and trades hard all day; Abuja
 * keeps civil-service hours and empties early; Port Harcourt runs on port and oil shifts, with
 * Aba Road trading busy and late.
 */
export const PROFILES: Record<string, CityProfile> = {
  lagos: {
    roles: { office: 0.22, trader: 0.1, artisan: 0.1, student: 0.08, hawker: 0.16, idler: 0.2, owl: 0.07, elder: 0.07 },
    early: 1.6,
    spread: 1.2,
    knockOff: 0.6,
    out: { hawker: [6, 20], idler: [6.5, 21.5], owl: [17, 24], elder: [7, 11] },
  },
  abuja: {
    roles: { office: 0.36, trader: 0.06, artisan: 0.08, student: 0.1, hawker: 0.08, idler: 0.18, owl: 0.06, elder: 0.08 },
    early: 0.8,
    spread: 0.5,
    knockOff: 0.3,
    out: { hawker: [7, 18], idler: [7.5, 19.5], owl: [18, 23], elder: [7.5, 10.5] },
  },
  port_harcourt: {
    roles: { office: 0.16, trader: 0.14, artisan: 0.2, student: 0.08, hawker: 0.16, idler: 0.14, owl: 0.07, elder: 0.05 },
    early: 1.2,
    spread: 0.9,
    knockOff: 0.8,
    out: { hawker: [6, 20.5], idler: [6.5, 21.5], owl: [17.5, 24], elder: [7, 11] },
  },
};

/** The kinds of place each commuting role works at, in order of preference */
const WORKS_AT: Partial<Record<Role, PlaceKind[]>> = {
  office: ['office', 'bank'],
  trader: ['stall', 'market', 'shop', 'food'],
  artisan: ['site', 'transit', 'shop'],
  student: ['school', 'office'],
};

/** A number from 0 to 1 that is always the same for this person and this purpose */
export function hash01(id: number, salt: number): number {
  let h = Math.imul(id ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul(salt + 0x632be59b, 0xc2b2ae35);
  h ^= h >>> 15;
  h = Math.imul(h, 0x2c1b3c6d);
  h ^= h >>> 12;
  return (h >>> 0) / 4294967296;
}

export function roleOf(id: number, profile: CityProfile): Role {
  const roles = Object.keys(profile.roles) as Role[];
  const total = roles.reduce((t, r) => t + profile.roles[r], 0);
  let pick = hash01(id, 1) * total;
  for (const r of roles) {
    pick -= profile.roles[r];
    if (pick < 0) return r;
  }
  return 'idler';
}

/** Their workplace, the same every day: one of the places of their kind they can walk to from home */
export function workplaceOf(id: number, role: Role, places: readonly Place[], reach: (node: number) => boolean, taken: Set<number>): number {
  const kinds = WORKS_AT[role];
  if (!kinds) return -1;
  for (const kind of kinds) {
    const choices: number[] = [];
    places.forEach((p, i) => {
      // A stall has one trader
      if (p.kind === kind && reach(p.node) && !(kind === 'stall' && taken.has(i))) choices.push(i);
    });
    if (!choices.length) continue;
    const pick = choices[Math.floor(hash01(id, 2) * choices.length)];
    if (kind === 'stall') taken.add(pick);
    return pick;
  }
  return -1;
}

/** One step in a day: from `at` (hours), be at home, in a place, at a pitch, or out walking the streets */
export interface Step {
  at: number;
  kind: 'home' | 'in' | 'pitch' | 'stroll';
  place?: number;
}

/**
 * Someone's day, worked out afresh each morning from who they are and what is open. Commuters
 * set out before their place opens and leave a little after it shuts (or their own hours end);
 * a place shut today (an office on Sunday) keeps them at home. Street walkers are out in their
 * role's hours, each a little different.
 */
export function planDay(id: number, role: Role, profile: CityProfile, work: Place | undefined, workIndex: number, weekday: number | null): Step[] {
  const j = (salt: number) => hash01(id, salt) - 0.5;
  const steps: Step[] = [];
  if (role in profile.out) {
    const [from, to] = profile.out[role as keyof CityProfile['out']];
    steps.push({ at: from + j(3) * 1.5, kind: 'stroll' }, { at: to + j(4) * 1.5, kind: 'home' });
    return steps;
  }
  if (!work) return steps;
  const h = work.hours;
  // Open today at all? (Checked at midday and at the hour it opens)
  const opens = h ? h.opens : 8;
  if (h && !isOpen(h, Math.max(opens + 0.01, 0), weekday) && !isOpen(h, 12, weekday)) return steps;
  // Their own working day inside the place's hours
  const start = Math.max(opens, role === 'student' ? 7.5 : role === 'artisan' ? 7 : 8);
  let end = h ? (h.closes > h.opens ? h.closes : 24) : 17;
  end = Math.min(end, role === 'student' ? 15 : role === 'artisan' ? 17.5 : role === 'trader' ? 19.5 : 17.5);
  const leave = start - profile.early * (0.5 + 0.25 * (j(5) + 0.5)) - Math.abs(j(6)) * profile.spread;
  steps.push({ at: leave, kind: work.kind === 'stall' ? 'pitch' : 'in', place: workIndex });
  // Staff stay on a while after closing, never more than most of an hour
  steps.push({ at: end + Math.min(0.9, profile.knockOff * (0.4 + j(7) + 0.5)), kind: 'home' });
  return steps;
}
