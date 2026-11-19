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

/** stall: a goods stall; foodstall: a roadside food stall or a suya spot */
export type PlaceKind = 'office' | 'bank' | 'shop' | 'food' | 'market' | 'school' | 'site' | 'transit' | 'worship' | 'night' | 'stall' | 'foodstall' | 'hotel';

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
  /** A stall's counter: where a customer stands to buy */
  front?: { x: number; z: number };
  /** What a stall sells */
  sells?: 'goods' | 'food' | 'suya';
}

/** What a door is, from its name and the category the game gives it. Null: nobody's destination (land, cars, cash machines, the player's homes). */
export function kindOf(name: string, category: string): PlaceKind | null {
  const s = `${name} ${category}`.toLowerCase();
  if (/\bland\b|vehicle|a home|open all hours|cash machine|boarding|arrivals|staff|lift|stairs|gate/.test(s)) return null;
  if (/mosque|church|christian centre|cathedral|worship/.test(s)) return 'worship';
  if (/club|lounge|nightlife|\bbar\b|viewing|gaming|\bbet\b|shrine/.test(s)) return 'night';
  // A hotel: a place of work by day, and its bar and lounge of an evening
  if (/hotel/.test(s)) return 'hotel';
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
    case 'foodstall':
      return PLACE_HOURS.stall;
    case 'worship':
    case 'hotel':
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
  /** Over a busy road with no lights: a last resort for a route (gaps in the go-slow are few) */
  busy?: boolean;
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
  /**
   * Is the straight walk between two points free of anything built (where it is known)? With it,
   * pavements in line with a side road between them are joined over that road (looking both ways),
   * and a side street's pavement that stops short of the avenue's is joined to it.
   */
  clear?: (x1: number, z1: number, x2: number, z2: number) => boolean;
  /** Does a straight walk cut across a lane of moving traffic? (Such a road with no lights is gone round, not waited at) */
  traffic?: (x1: number, z1: number, x2: number, z2: number) => boolean;
}

/** How far a door may stand from a pavement and still open off it, metres */
const DOOR_REACH = 7;
/** Two pavement ends this near (round a corner, or the same pavement broken by a driveway) are one walk */
const CORNER = 5.5;
/** What a road crossing costs a route, in metres of walking (people prefer to stay on their side) */
const CROSSING_COST = 12;
/** A busy road with no lights: walked a long way round to avoid (gaps in the go-slow are rare) */
const BUSY_CROSSING_COST = 250;

export class WalkNetwork {
  public readonly nodes: NetNode[] = [];
  public readonly edges: NetEdge[] = [];
  /** Where people come in from beyond the map and go home to: the dead ends at its edges */
  public readonly homes: number[] = [];
  /** The pavements newly joined straight on over a side road (run numbers): street walkers may cross there too */
  public readonly sideRoads: Array<{ a: number; b: number; c: Crossing }> = [];
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

    const joins: Array<{ s: number; u: number; t: number; v: number; c?: Crossing; ka?: { x: number; z: number }; kb?: { x: number; z: number }; busy?: boolean }> = [];
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
    // Straight on over a side road with no crossing of its own: look both ways, and over
    if (input.clear) {
      const linked = new Set(input.links.map((l, i) => (l.up ? i : -1)));
      input.runs.forEach((a, i) => {
        if (runSeg[i] < 0 || linked.has(i)) return;
        let best = -1;
        input.runs.forEach((b, j) => {
          if (j === i || runSeg[j] < 0 || b.axis !== a.axis || Math.abs(b.fixed - a.fixed) > 0.6) return;
          const gap = b.from - a.to;
          if (gap > 3 && gap < 20 && (best < 0 || b.from < input.runs[best].from)) best = j;
        });
        if (best < 0) return;
        const p = this.at(runSeg[i], a.to);
        const q = this.at(runSeg[best], input.runs[best].from);
        if (input.clear!(p.x, p.z, q.x, q.z)) {
          const c: Crossing = { kind: 'street' };
          const busy = input.traffic?.(p.x, p.z, q.x, q.z) ?? false;
          joins.push({ s: runSeg[i], u: a.to, t: runSeg[best], v: input.runs[best].from, c, busy });
          // Street walkers go on over a quiet side road; a busy one they turn back at, as before
          if (!busy) this.sideRoads.push({ a: i, b: best, c });
        }
      });
    }
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
        // Up to its edge; or, with nothing built between, a little short of it (open ground at a corner)
        const short = Math.abs(u) - (av.halfRoad + av.walk);
        const reach = input.clear ? 13 : 3;
        if (short > reach || short < -3 || g.fixed < av.from || g.fixed > av.to) continue;
        if (short > 3 && !input.clear!(u, g.fixed, side * (av.halfRoad + av.walk), g.fixed)) continue;
        const piece = avenueSegs[side < 0 ? 0 : 1].find((p) => g.fixed >= this.segs[p].from && g.fixed <= this.segs[p].to);
        if (piece !== undefined) joins.push({ s, u, t: piece, v: g.fixed });
      }
    });

    // Any stretch still cut off from the rest is joined by the shortest safe way: over the road to
    // the pavement opposite (looking both ways), or over open ground (nothing built in between)
    this.trafficAt = input.traffic;
    if (input.clear) this.bridge(joins, input.clear);

    // Every point something joins at is a node on its pavement
    for (const j of joins) {
      this.segs[j.s].cuts.push(j.u);
      this.segs[j.t].cuts.push(j.v);
    }
    this.pendingJoins = joins;
  }

  /** Joins the pieces of the network that nothing else joined, each to another by its shortest safe link */
  private bridge(joins: Array<{ s: number; u: number; t: number; v: number; c?: Crossing; busy?: boolean }>, clear: (x1: number, z1: number, x2: number, z2: number) => boolean): void {
    const n = this.segs.length;
    const root = Array.from({ length: n }, (_, i) => i);
    const find = (i: number): number => (root[i] === i ? i : (root[i] = find(root[i])));
    for (const j of joins) root[find(j.s)] = find(j.t);
    for (let round = 0; round < 40; round++) {
      const size = new Map<number, number>();
      for (let i = 0; i < n; i++) size.set(find(i), (size.get(find(i)) ?? 0) + 1);
      if (size.size <= 1) return;
      let best: { s: number; u: number; t: number; v: number; c?: Crossing; cost: number; busy?: boolean } | null = null;
      for (let a = 0; a < n; a++) {
        const A = this.segs[a];
        for (const u of [A.from, A.to]) {
          const p = this.at(a, u);
          for (let b = 0; b < n; b++) {
            if (find(a) === find(b)) continue;
            const B = this.segs[b];
            if (B.axis === A.axis) {
              // The pavement opposite, across the road: straight over from this end
              const across = Math.abs(B.fixed - A.fixed);
              if (across < 5 || across > 14 || u < B.from - 1 || u > B.to + 1) continue;
              const v = Math.min(B.to, Math.max(B.from, u));
              const q = this.at(b, v);
              const cost = across + 5;
              if ((!best || cost < best.cost) && clear(p.x, p.z, q.x, q.z)) best = { s: a, u, t: b, v, c: { kind: 'street' }, cost, busy: this.trafficAt?.(p.x, p.z, q.x, q.z) ?? false };
            } else {
              // A pavement round the corner, over open ground
              const along = B.axis === 'z' ? p.z : p.x;
              const v = Math.min(B.to, Math.max(B.from, along));
              const q = this.at(b, v);
              const d = Math.hypot(p.x - q.x, p.z - q.z);
              if (d > 10) continue;
              if ((!best || d < best.cost) && clear(p.x, p.z, q.x, q.z)) best = { s: a, u, t: b, v, cost: d };
            }
          }
        }
      }
      if (!best) return;
      joins.push(best);
      root[find(best.s)] = find(best.t);
    }
  }

  private pendingJoins: Array<{ s: number; u: number; t: number; v: number; c?: Crossing; ka?: { x: number; z: number }; kb?: { x: number; z: number }; busy?: boolean }> | null = null;
  private trafficAt?: (x1: number, z1: number, x2: number, z2: number) => boolean;
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
      if (a !== b) this.addEdge(a, b, j.c, j.ka, j.kb, j.busy);
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
        const d = dist[u] + edge.len + (edge.c ? (edge.busy ? BUSY_CROSSING_COST : CROSSING_COST) : 0);
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

  private addEdge(a: number, b: number, c?: Crossing, ka?: { x: number; z: number }, kb?: { x: number; z: number }, busy?: boolean): void {
    const p = this.nodes[a];
    const q = this.nodes[b];
    // An edge that already exists is not added twice
    for (const e of p.edges) if (this.other(e, a) === b) return;
    this.edges.push({ a, b, len: Math.hypot(p.x - q.x, p.z - q.z), c, ka, kb, busy });
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
  /** Lunch: when on average, and how widely spread (hours either way), so the whole street does not go at once */
  lunch: number;
  lunchSpread: number;
  /** The share of workers (and of idlers) who go out of an evening before home, and when night owls make for their first place */
  eveningOut: number;
  nightOut: number;
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
    // Owls out till two or three: Lagos does not sleep early
    out: { hawker: [6, 20], idler: [6.5, 21.5], owl: [17, 26], elder: [7, 11] },
    lunch: 12.75,
    lunchSpread: 1.25,
    eveningOut: 0.35,
    nightOut: 20.5,
  },
  abuja: {
    roles: { office: 0.36, trader: 0.06, artisan: 0.08, student: 0.1, hawker: 0.08, idler: 0.18, owl: 0.06, elder: 0.08 },
    early: 0.8,
    spread: 0.5,
    knockOff: 0.3,
    // A quiet capital: its owls are home around midnight
    out: { hawker: [7, 18], idler: [7.5, 19.5], owl: [18, 24], elder: [7.5, 10.5] },
    // The civil service breaks at one, and not for long
    lunch: 13,
    lunchSpread: 0.75,
    eveningOut: 0.18,
    nightOut: 20,
  },
  port_harcourt: {
    roles: { office: 0.16, trader: 0.14, artisan: 0.2, student: 0.08, hawker: 0.16, idler: 0.14, owl: 0.07, elder: 0.05 },
    early: 1.2,
    spread: 0.9,
    knockOff: 0.8,
    out: { hawker: [6, 20.5], idler: [6.5, 21.5], owl: [17.5, 25.5], elder: [7, 11] },
    // Shift workers eat when the shift lets them
    lunch: 12.5,
    lunchSpread: 1.5,
    eveningOut: 0.4,
    nightOut: 20.5,
  },
};

/** The kinds of place each commuting role works at, in order of preference */
const WORKS_AT: Partial<Record<Role, PlaceKind[]>> = {
  office: ['office', 'bank', 'hotel'],
  trader: ['stall', 'foodstall', 'market', 'shop', 'food'],
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
      if (p.kind === kind && reach(p.node) && !(p.stall !== undefined && taken.has(i))) choices.push(i);
    });
    if (!choices.length) continue;
    const pick = choices[Math.floor(hash01(id, 2) * choices.length)];
    if (places[pick].stall !== undefined) taken.add(pick);
    return pick;
  }
  return -1;
}

/** One step in a day: from `at` (hours), be at home, in a place, at a pitch, or out walking the streets */
export interface Step {
  at: number;
  /** in: inside a door; pitch: keeping their stall; buy: at someone else's stall counter */
  kind: 'home' | 'in' | 'pitch' | 'stroll' | 'buy' | 'hang';
  place?: number;
}

/**
 * Chooses a place of these kinds (in order of preference) that is open from `at` for `stay` hours
 * and can be walked to; -1 if none. Supplied by the crowd, which knows where the person is.
 */
export type PlacePicker = (kinds: readonly PlaceKind[][], at: number, stay: number, salt: number) => number;

/** Where people eat: a buka or a food stall first, then a market or a supermarket */
const LUNCH: PlaceKind[][] = [['food', 'foodstall'], ['market', 'shop']];
/** Where a street walker pops into: a shop, a stall, a market, a buka */
const ERRAND: PlaceKind[][] = [['shop', 'stall', 'foodstall', 'market', 'food']];
/** Out of an evening: a buka, a bar or club, a hotel lounge */
const EVENING: PlaceKind[][] = [['food', 'foodstall', 'night', 'hotel']];
/** Late, after the bukas shut: the clubs and the hotel bars */
const LATE: PlaceKind[][] = [['night', 'hotel', 'foodstall']];

/**
 * Someone's day, worked out afresh each morning from who they are and what is open. Commuters
 * set out before their place opens and leave a little after it shuts (or their own hours end);
 * a place shut today (an office on Sunday) keeps them at home. Street walkers are out in their
 * role's hours, each a little different.
 */
export function planDay(id: number, role: Role, profile: CityProfile, work: Place | undefined, workIndex: number, weekday: number | null, pick?: PlacePicker, places?: readonly Place[]): Step[] {
  const j = (salt: number) => hash01(id, salt) - 0.5;
  const steps: Step[] = [];
  // Inside the door, or (a stall) at its counter; out of an evening, some stand about outside with friends
  const visit = (index: number, outside = false): Step['kind'] => (places?.[index]?.stall !== undefined ? 'buy' : outside ? 'hang' : 'in');
  if (role in profile.out) {
    const [from, to] = profile.out[role as keyof CityProfile['out']];
    const out = from + j(3) * 1.5;
    let home = to + j(4) * 1.5;
    steps.push({ at: out, kind: 'stroll' });
    // Errands while they are out: an idler is in and out of places all day, an elder twice in the morning
    const errands = role === 'idler' ? [9.5 + j(12), 12 + j(13), 14.5 + j(16), 17 + j(17)] : role === 'elder' ? [out + 0.4 + Math.abs(j(14)), out + 2.2 + Math.abs(j(18))] : [];
    for (const [k, at] of errands.entries()) {
      if (!pick || at < out + 0.25 || at > home - 0.75) continue;
      const stay = 0.2 + Math.abs(j(30 + k)) * 0.4;
      const place = pick(ERRAND, at, stay, 20 + k);
      if (place < 0) continue;
      steps.push({ at, kind: visit(place), place }, { at: at + stay, kind: 'stroll' });
    }
    // The evening: night owls make for a bar, a club or a hotel lounge (and on to another later);
    // some idlers end the day outside a buka or a bar with friends rather than walking about
    if (pick && role === 'owl') {
      let at = profile.nightOut + j(40) * 1.5;
      for (let k = 0; k < 2 && at < home - 0.75; k++) {
        const stay = Math.min(home - 0.25 - at, 1.2 + Math.abs(j(41 + k)) * 2.6);
        const place = pick(k === 0 ? EVENING : LATE, at, stay, 40 + k);
        if (place < 0) break;
        steps.push({ at, kind: visit(place, hash01(id, 43 + k) < 0.5), place });
        at += stay;
        if (k === 0 && at < home - 0.75) steps.push({ at, kind: 'stroll' });
        at += 0.1;
      }
      // Home when the last place is left, or at their own late hour
      home = Math.max(home, steps[steps.length - 1].at + 0.25);
    } else if (pick && role === 'idler' && hash01(id, 44) < profile.eveningOut) {
      const at = Math.max(18.5, home - 2.5) + Math.abs(j(45));
      const place = at < home - 0.5 ? pick(EVENING, at, home - at, 46) : -1;
      if (place >= 0) steps.push({ at, kind: visit(place, true), place });
    }
    steps.push({ at: home, kind: 'home' });
    return steps.sort((p, q) => p.at - q.at);
  }
  if (!work) return steps;
  const h = work.hours;
  // Open today at all? (Checked at midday and at the hour it opens)
  const opens = h ? h.opens : 8;
  if (h && !isOpen(h, Math.max(opens + 0.01, 0), weekday) && !isOpen(h, 12, weekday)) return steps;
  // Their working day: from when the place opens (or their own start) to when it actually closes.
  // A place that never shuts keeps its staff an ordinary day; students leave school mid-afternoon.
  // (A stall's trader comes for its opening, whenever that is: six for the akara, five in the afternoon for suya)
  const start = work.stall !== undefined ? opens : Math.max(opens, role === 'student' ? 7.5 : role === 'artisan' ? 7 : 8);
  // (A place open past midnight, a suya spot till one, closes the next day: 25)
  const closes = h && h.closes > h.opens && h.closes <= 24 ? h.closes : h && h.closes < h.opens ? 24 + h.closes : null;
  const end = role === 'student' ? Math.min(15, closes ?? 15) : closes ?? (role === 'trader' ? 19.5 : 17.5);
  const leave = start - profile.early * (0.5 + 0.25 * (j(5) + 0.5)) - Math.abs(j(6)) * profile.spread;
  steps.push({ at: leave, kind: work.stall !== undefined ? 'pitch' : 'in', place: workIndex });
  // Lunch, at their own time (the street does not all go at once), somewhere open near work; then
  // back to work. Traders keep their stall and their shop: they eat where they are.
  if (pick && role !== 'trader') {
    const lunch = profile.lunch + j(8) * 2 * profile.lunchSpread;
    const stay = 0.35 + Math.abs(j(9)) * 0.5;
    if (lunch > start + 1 && lunch + stay < end - 0.5) {
      const place = pick(LUNCH, lunch, stay, 10);
      if (place >= 0) steps.push({ at: lunch, kind: visit(place), place }, { at: lunch + stay, kind: 'in', place: workIndex });
    }
  }
  // Staff stay on a while after closing, never more than most of an hour (a stall is packed up
  // within a quarter of an hour); then home, or (some) out for the evening first: a buka, a bar,
  // a hotel lounge, open for as long as they stay
  const off = end + Math.min(work.stall !== undefined ? 0.25 : 0.9, profile.knockOff * (0.4 + j(7) + 0.5));
  if (pick && role !== 'student' && work.stall === undefined && hash01(id, 47) < profile.eveningOut && off < 22) {
    const stay = 1 + Math.abs(j(48)) * 2.4;
    const place = pick(EVENING, off, stay, 48);
    if (place >= 0) {
      steps.push({ at: off, kind: visit(place, hash01(id, 49) < 0.4), place }, { at: off + stay, kind: 'home' });
      return steps;
    }
  }
  steps.push({ at: off, kind: 'home' });
  return steps;
}
