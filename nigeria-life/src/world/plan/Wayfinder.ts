import type { Zone } from './CityPlan';
import type { Solids } from './Solids';

/**
 * Finding the way on foot across a city: round its buildings, through its gates, along its
 * pavements for choice and across its roads where it must.
 *
 * The ground is laid out in half-metre squares. A square can be stood in if its middle is
 * clear of everything solid by more than a person's half-width. The way from one place to
 * another is the cheapest chain of such squares, where a metre of pavement costs less than a
 * metre of open ground and a metre of carriageway costs most, and it is then straightened
 * wherever a straight line is clear and no dearer.
 *
 * It is made from the same solids that stop the walker, so a way it finds is a way that can
 * be walked.
 */

export interface WayPoint {
  x: number;
  z: number;
}

export interface Way {
  /** The points to walk through in turn, ending where the walk ends */
  points: WayPoint[];
  /** How far that is on foot */
  metres: number;
  /** Whether it ends at the place asked for, or only as near to it as anyone can get */
  reaches: boolean;
}

const CELL = 0.5;
/** The ground of a city runs this far each way from its middle */
const HALF = 160;
const N = (HALF * 2) / CELL;

/** How far the middle of a square must be from anything solid for a person to stand in it */
const STAND = 0.62;
/** How far, for a straight line to cross any part of the square without brushing a wall */
const OPEN = 1.0;

const GROUND = 0;
const PAVEMENT = 1;
const ROAD = 2;
/** What a metre costs: people keep to the pavement, cut across open ground, and cross a road by the shortest way */
const COST = [1.35, 1, 2.4];
/** Squeezing along a wall costs more than walking clear of it, where there is room to */
const TIGHT = 1.3;

/** A short hop in the open is walked straight, road or no road, as someone who can see where they are going does */
const STRAIGHT_WITHIN = 30;
/** A place against a wall (a door, a counter) is walked right up to from the nearest ground that can be stood on */
const UP_TO = 3.5;

const DIAGONAL = Math.SQRT2;

export class Wayfinder {
  private readonly walk = new Uint8Array(N * N).fill(1);
  private readonly open = new Uint8Array(N * N).fill(1);
  private readonly kind = new Uint8Array(N * N);
  /** Which stretch of connected ground a square is part of: 0 if it cannot be stood in */
  private readonly part = new Int32Array(N * N);

  // Scratch for the search, kept between searches
  private readonly reached = new Float32Array(N * N);
  private readonly score = new Float32Array(N * N);
  private readonly cameFrom = new Int32Array(N * N);
  private readonly seen = new Uint32Array(N * N);
  private readonly heap: number[] = [];
  private search = 0;

  constructor(solids: Solids, zones: Zone[]) {
    for (const solid of solids.all) {
      this.fill(this.walk, solid.minX - STAND, solid.maxX + STAND, solid.minZ - STAND, solid.maxZ + STAND, 0);
      this.fill(this.open, solid.minX - OPEN, solid.maxX + OPEN, solid.minZ - OPEN, solid.maxZ + OPEN, 0);
    }
    // A carriageway that crosses a pavement is a carriageway there: the pavement gives way to the junction
    for (const zone of zones) if (zone.kind === 'walkway') this.fill(this.kind, zone.minX, zone.maxX, zone.minZ, zone.maxZ, PAVEMENT);
    for (const zone of zones) if (zone.kind === 'carriageway') this.fill(this.kind, zone.minX, zone.maxX, zone.minZ, zone.maxZ, ROAD);
    this.findParts();
  }

  /** Sets every square whose middle is inside a rectangle. */
  private fill(grid: Uint8Array, minX: number, maxX: number, minZ: number, maxZ: number, value: number): void {
    const i0 = Math.max(0, Math.ceil((minX + HALF) / CELL - 0.5));
    const i1 = Math.min(N - 1, Math.floor((maxX + HALF) / CELL - 0.5));
    const j0 = Math.max(0, Math.ceil((minZ + HALF) / CELL - 0.5));
    const j1 = Math.min(N - 1, Math.floor((maxZ + HALF) / CELL - 0.5));
    for (let j = j0; j <= j1; j++) grid.fill(value, j * N + i0, j * N + i1 + 1);
  }

  /** Marks out each stretch of ground that can be walked from end to end. */
  private findParts(): void {
    const stack = new Int32Array(N * N);
    let label = 0;
    for (let start = 0; start < N * N; start++) {
      if (!this.walk[start] || this.part[start]) continue;
      label += 1;
      let top = 0;
      stack[top++] = start;
      this.part[start] = label;
      while (top > 0) {
        const at = stack[--top];
        const i = at % N;
        if (i > 0 && this.walk[at - 1] && !this.part[at - 1]) { this.part[at - 1] = label; stack[top++] = at - 1; }
        if (i < N - 1 && this.walk[at + 1] && !this.part[at + 1]) { this.part[at + 1] = label; stack[top++] = at + 1; }
        if (at >= N && this.walk[at - N] && !this.part[at - N]) { this.part[at - N] = label; stack[top++] = at - N; }
        if (at < N * (N - 1) && this.walk[at + N] && !this.part[at + N]) { this.part[at + N] = label; stack[top++] = at + N; }
      }
    }
  }

  private square(x: number, z: number): number {
    const i = Math.floor((x + HALF) / CELL);
    const j = Math.floor((z + HALF) / CELL);
    if (i < 0 || j < 0 || i >= N || j >= N) return -1;
    return j * N + i;
  }

  private middle(square: number): WayPoint {
    return { x: -HALF + ((square % N) + 0.5) * CELL, z: -HALF + (Math.floor(square / N) + 0.5) * CELL };
  }

  private price(square: number): number {
    return COST[this.kind[square]] * (this.open[square] ? 1 : TIGHT);
  }

  /** Can someone stand here? */
  public canStand(x: number, z: number): boolean {
    const square = this.square(x, z);
    return square >= 0 && this.walk[square] === 1;
  }

  /** Is this spot on a pavement, on a carriageway, or on neither? */
  public groundAt(x: number, z: number): 'pavement' | 'road' | 'ground' {
    const square = this.square(x, z);
    const kind = square < 0 ? GROUND : this.kind[square];
    return kind === PAVEMENT ? 'pavement' : kind === ROAD ? 'road' : 'ground';
  }

  /**
   * The square to use for a point that is not on ground of the wanted stretch: the one nearest
   * to it, leaning toward whoever is coming. `stretch` 0 takes any ground that can be stood on.
   */
  private nearestIn(stretch: number, x: number, z: number, comingFromX: number, comingFromZ: number, reach: number[]): number {
    for (const metres of reach) {
      const span = Math.ceil(metres / CELL);
      const ci = Math.floor((x + HALF) / CELL);
      const cj = Math.floor((z + HALF) / CELL);
      let best = -1;
      let bestScore = Infinity;
      for (let j = Math.max(0, cj - span); j <= Math.min(N - 1, cj + span); j++) {
        for (let i = Math.max(0, ci - span); i <= Math.min(N - 1, ci + span); i++) {
          const square = j * N + i;
          if (!this.walk[square] || (stretch !== 0 && this.part[square] !== stretch)) continue;
          const mx = -HALF + (i + 0.5) * CELL;
          const mz = -HALF + (j + 0.5) * CELL;
          const away = Math.hypot(mx - x, mz - z);
          if (away > metres) continue;
          const score = away + 0.3 * Math.hypot(mx - comingFromX, mz - comingFromZ);
          if (score < bestScore) {
            bestScore = score;
            best = square;
          }
        }
      }
      if (best >= 0) return best;
    }
    return -1;
  }

  /**
   * What a straight line between two points costs to walk, or Infinity if any of it passes
   * closer to something solid than a line may.
   */
  private straight(ax: number, az: number, bx: number, bz: number): number {
    const length = Math.hypot(bx - ax, bz - az);
    const steps = Math.max(1, Math.ceil(length / 0.25));
    const each = length / steps;
    let cost = 0;
    for (let s = 0; s <= steps; s++) {
      const t = s / steps;
      const square = this.square(ax + (bx - ax) * t, az + (bz - az) * t);
      if (square < 0 || !this.open[square]) return Infinity;
      cost += COST[this.kind[square]] * (s === 0 || s === steps ? each / 2 : each);
    }
    return cost;
  }

  /** The way on foot from one point to another, or null if there is nowhere to set off from. */
  public route(fromX: number, fromZ: number, toX: number, toZ: number): Way | null {
    let start = this.square(fromX, fromZ);
    const setOffFromHere = start >= 0 && this.walk[start] === 1;
    if (!setOffFromHere) start = this.nearestIn(0, fromX, fromZ, toX, toZ, [1.5, 4]);
    if (start < 0) return null;

    let end = this.square(toX, toZ);
    const reaches = end >= 0 && this.walk[end] === 1 && this.part[end] === this.part[start];
    if (!reaches) end = this.nearestIn(this.part[start], toX, toZ, fromX, fromZ, [4, 12, 30, 70]);
    if (end < 0) return null;

    // Where the walk ends: the place itself; or, for a place against a wall, the ground in front of it and then up to it
    const endMiddle = this.middle(end);
    const upTo = !reaches && Math.hypot(endMiddle.x - toX, endMiddle.z - toZ) <= UP_TO;
    const last: WayPoint = reaches ? { x: toX, z: toZ } : endMiddle;
    const finish = (points: WayPoint[]): Way => {
      if (upTo) points.push({ x: toX, z: toZ });
      let metres = 0;
      let px = fromX;
      let pz = fromZ;
      for (const point of points) {
        metres += Math.hypot(point.x - px, point.z - pz);
        px = point.x;
        pz = point.z;
      }
      return { points, metres, reaches: reaches || upTo };
    };

    if (start === end) return finish([last]);
    if (setOffFromHere && Math.hypot(last.x - fromX, last.z - fromZ) <= STRAIGHT_WITHIN && this.straight(fromX, fromZ, last.x, last.z) < Infinity) return finish([last]);

    const squares = this.cheapest(start, end);
    if (!squares) return null;

    // Straighten it: from each point kept, go on to the furthest point that a clear line reaches at no greater cost
    const spots: WayPoint[] = squares.map((square) => this.middle(square));
    spots[spots.length - 1] = last;
    if (setOffFromHere) spots[0] = { x: fromX, z: fromZ };
    const points: WayPoint[] = setOffFromHere ? [] : [spots[0]];
    let anchor = 0;
    while (anchor < spots.length - 1) {
      let next = anchor + 1;
      while (next + 1 < spots.length) {
        const dearest = this.reached[squares[next + 1]] - this.reached[squares[anchor]] + 0.05;
        if (this.straight(spots[anchor].x, spots[anchor].z, spots[next + 1].x, spots[next + 1].z) > dearest) break;
        next += 1;
      }
      points.push(spots[next]);
      anchor = next;
    }
    return finish(points);
  }

  /** The cheapest chain of squares from one to another: A* over the eight neighbours, never cutting a corner. */
  private cheapest(start: number, end: number): number[] | null {
    const { walk, reached, score, cameFrom, seen, heap } = this;
    this.search += 2;
    const opened = this.search;
    const closed = this.search + 1;
    const ei = end % N;
    const ej = Math.floor(end / N);
    const guess = (square: number) => {
      const di = Math.abs((square % N) - ei);
      const dj = Math.abs(Math.floor(square / N) - ej);
      return (Math.max(di, dj) + (DIAGONAL - 1) * Math.min(di, dj)) * CELL * 1.0005;
    };

    heap.length = 0;
    const push = (square: number) => {
      let at = heap.length;
      heap.push(square);
      while (at > 0) {
        const up = (at - 1) >> 1;
        if (score[heap[up]] <= score[square]) break;
        heap[at] = heap[up];
        at = up;
      }
      heap[at] = square;
    };
    const pop = (): number => {
      const first = heap[0];
      const moved = heap.pop()!;
      const size = heap.length;
      if (size > 0) {
        let at = 0;
        for (;;) {
          let child = at * 2 + 1;
          if (child >= size) break;
          if (child + 1 < size && score[heap[child + 1]] < score[heap[child]]) child += 1;
          if (score[heap[child]] >= score[moved]) break;
          heap[at] = heap[child];
          at = child;
        }
        heap[at] = moved;
      }
      return first;
    };

    reached[start] = 0;
    score[start] = guess(start);
    cameFrom[start] = -1;
    seen[start] = opened;
    push(start);

    while (heap.length > 0) {
      const at = pop();
      if (seen[at] === closed) continue;
      if (at === end) {
        const chain: number[] = [];
        for (let square = end; square !== -1; square = cameFrom[square]) chain.push(square);
        return chain.reverse();
      }
      seen[at] = closed;
      const i = at % N;
      const j = Math.floor(at / N);
      const here = this.price(at);
      const west = i > 0 && walk[at - 1] === 1;
      const east = i < N - 1 && walk[at + 1] === 1;
      const north = j > 0 && walk[at - N] === 1;
      const south = j < N - 1 && walk[at + N] === 1;
      const visit = (to: number, length: number) => {
        if (seen[to] === closed) return;
        const cost = reached[at] + length * CELL * (here + this.price(to)) * 0.5;
        if (seen[to] === opened && cost >= reached[to]) return;
        seen[to] = opened;
        reached[to] = cost;
        score[to] = cost + guess(to);
        cameFrom[to] = at;
        push(to);
      };
      if (west) visit(at - 1, 1);
      if (east) visit(at + 1, 1);
      if (north) visit(at - N, 1);
      if (south) visit(at + N, 1);
      if (west && north && walk[at - N - 1]) visit(at - N - 1, DIAGONAL);
      if (east && north && walk[at - N + 1]) visit(at - N + 1, DIAGONAL);
      if (west && south && walk[at + N - 1]) visit(at + N - 1, DIAGONAL);
      if (east && south && walk[at + N + 1]) visit(at + N + 1, DIAGONAL);
    }
    return null;
  }
}
