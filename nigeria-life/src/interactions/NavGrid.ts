import * as THREE from 'three';

/**
 * Walkable-floor map of one room, used to route characters around furniture.
 * Coordinates given to `block*` are relative to the room centre; paths are in world space.
 */
export class NavGrid {
  private readonly cols: number;
  private readonly rows: number;
  private readonly blocked: Uint8Array;
  private readonly cell: number;
  private readonly origin: THREE.Vector3;
  private readonly width: number;
  private readonly length: number;
  private readonly clearance: number;

  /** `clearance` is how far a character's centre must stay from anything solid. */
  constructor(origin: THREE.Vector3, width: number, length: number, clearance = 0.3, cell = 0.25) {
    this.clearance = clearance;
    this.origin = origin.clone();
    this.width = width;
    this.length = length;
    this.cell = cell;
    this.cols = Math.ceil(width / cell);
    this.rows = Math.ceil(length / cell);
    this.blocked = new Uint8Array(this.cols * this.rows);

    // Keep off the walls
    const wall = 0.2 + clearance;
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        const x = this.cellX(c);
        const z = this.cellZ(r);
        if (Math.abs(x) > width / 2 - wall || Math.abs(z) > length / 2 - wall) this.blocked[this.index(c, r)] = 1;
      }
    }
  }

  private index(c: number, r: number): number {
    return r * this.cols + c;
  }

  private cellX(c: number): number {
    return -this.width / 2 + (c + 0.5) * this.cell;
  }

  private cellZ(r: number): number {
    return -this.length / 2 + (r + 0.5) * this.cell;
  }

  private col(x: number): number {
    return Math.max(0, Math.min(this.cols - 1, Math.floor((x + this.width / 2) / this.cell)));
  }

  private row(z: number): number {
    return Math.max(0, Math.min(this.rows - 1, Math.floor((z + this.length / 2) / this.cell)));
  }

  public blockRect(centerX: number, centerZ: number, halfWidth: number, halfLength: number): void {
    const hw = halfWidth + this.clearance;
    const hl = halfLength + this.clearance;
    for (let r = this.row(centerZ - hl); r <= this.row(centerZ + hl); r++) {
      for (let c = this.col(centerX - hw); c <= this.col(centerX + hw); c++) {
        if (Math.abs(this.cellX(c) - centerX) <= hw && Math.abs(this.cellZ(r) - centerZ) <= hl) {
          this.blocked[this.index(c, r)] = 1;
        }
      }
    }
  }

  public blockDisc(centerX: number, centerZ: number, radius: number): void {
    const reach = radius + this.clearance;
    for (let r = this.row(centerZ - reach); r <= this.row(centerZ + reach); r++) {
      for (let c = this.col(centerX - reach); c <= this.col(centerX + reach); c++) {
        if (Math.hypot(this.cellX(c) - centerX, this.cellZ(r) - centerZ) <= reach) {
          this.blocked[this.index(c, r)] = 1;
        }
      }
    }
  }

  /** Is this world position clear of furniture and walls? */
  public isFree(worldX: number, worldZ: number): boolean {
    const x = worldX - this.origin.x;
    const z = worldZ - this.origin.z;
    if (Math.abs(x) >= this.width / 2 || Math.abs(z) >= this.length / 2) return false;
    return this.blocked[this.index(this.col(x), this.row(z))] === 0;
  }

  /** The nearest clear spot to a world position (the position itself if it is already clear). */
  public closestFree(point: THREE.Vector3): THREE.Vector3 {
    if (this.isFree(point.x, point.z)) return new THREE.Vector3(point.x, 0, point.z);
    const cell = this.nearestFree(this.col(point.x - this.origin.x), this.row(point.z - this.origin.z));
    if (!cell) return new THREE.Vector3(point.x, 0, point.z);
    return new THREE.Vector3(this.origin.x + this.cellX(cell[0]), 0, this.origin.z + this.cellZ(cell[1]));
  }

  private nearestFree(c: number, r: number): [number, number] | null {
    if (!this.blocked[this.index(c, r)]) return [c, r];
    for (let ring = 1; ring < 24; ring++) {
      let best: [number, number] | null = null;
      let bestDist = Infinity;
      for (let dr = -ring; dr <= ring; dr++) {
        for (let dc = -ring; dc <= ring; dc++) {
          if (Math.max(Math.abs(dr), Math.abs(dc)) !== ring) continue;
          const cc = c + dc;
          const rr = r + dr;
          if (cc < 0 || rr < 0 || cc >= this.cols || rr >= this.rows) continue;
          if (this.blocked[this.index(cc, rr)]) continue;
          const dist = dc * dc + dr * dr;
          if (dist < bestDist) {
            bestDist = dist;
            best = [cc, rr];
          }
        }
      }
      if (best) return best;
    }
    return null;
  }

  private clearLine(c0: number, r0: number, c1: number, r1: number): boolean {
    // Sampled finely enough that the line cannot clip the corner of a blocked cell unnoticed
    const steps = Math.ceil(Math.hypot(c1 - c0, r1 - r0) * 8);
    for (let i = 0; i <= steps; i++) {
      const t = steps === 0 ? 0 : i / steps;
      const c = Math.round(c0 + (c1 - c0) * t);
      const r = Math.round(r0 + (r1 - r0) * t);
      if (this.blocked[this.index(c, r)]) return false;
    }
    return true;
  }

  /**
   * Route from one world position to another around everything blocked.
   * The end point itself may be somewhere blocked (a chair, the edge of a counter):
   * the route leads to the nearest clear floor and then steps onto it.
   * Returns null only if there is no way through at all.
   */
  public findPath(from: THREE.Vector3, to: THREE.Vector3): THREE.Vector3[] | null {
    const start = this.nearestFree(this.col(from.x - this.origin.x), this.row(from.z - this.origin.z));
    const goal = this.nearestFree(this.col(to.x - this.origin.x), this.row(to.z - this.origin.z));
    if (!start || !goal) return null;

    const size = this.cols * this.rows;
    const cost = new Float32Array(size).fill(Infinity);
    const parent = new Int32Array(size).fill(-1);
    const closed = new Uint8Array(size);
    const startIndex = this.index(start[0], start[1]);
    const goalIndex = this.index(goal[0], goal[1]);

    // Binary heap of [priority, cell]
    const heap: Array<[number, number]> = [];
    const push = (priority: number, cellIndex: number) => {
      heap.push([priority, cellIndex]);
      let i = heap.length - 1;
      while (i > 0) {
        const up = (i - 1) >> 1;
        if (heap[up][0] <= heap[i][0]) break;
        [heap[up], heap[i]] = [heap[i], heap[up]];
        i = up;
      }
    };
    const pop = (): number => {
      const top = heap[0][1];
      const last = heap.pop()!;
      if (heap.length > 0) {
        heap[0] = last;
        let i = 0;
        for (;;) {
          const left = i * 2 + 1;
          const right = left + 1;
          let smallest = i;
          if (left < heap.length && heap[left][0] < heap[smallest][0]) smallest = left;
          if (right < heap.length && heap[right][0] < heap[smallest][0]) smallest = right;
          if (smallest === i) break;
          [heap[smallest], heap[i]] = [heap[i], heap[smallest]];
          i = smallest;
        }
      }
      return top;
    };

    const estimate = (c: number, r: number) => Math.hypot(c - goal[0], r - goal[1]);
    cost[startIndex] = 0;
    push(estimate(start[0], start[1]), startIndex);
    let found = false;

    while (heap.length > 0) {
      const current = pop();
      if (closed[current]) continue;
      closed[current] = 1;
      if (current === goalIndex) {
        found = true;
        break;
      }
      const c = current % this.cols;
      const r = (current - c) / this.cols;
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          if (dr === 0 && dc === 0) continue;
          const nc = c + dc;
          const nr = r + dr;
          if (nc < 0 || nr < 0 || nc >= this.cols || nr >= this.rows) continue;
          const next = this.index(nc, nr);
          if (this.blocked[next] || closed[next]) continue;
          // No squeezing diagonally between two blocked cells
          if (dr !== 0 && dc !== 0 && (this.blocked[this.index(c + dc, r)] || this.blocked[this.index(c, r + dr)])) continue;
          const stepCost = cost[current] + (dr !== 0 && dc !== 0 ? Math.SQRT2 : 1);
          if (stepCost < cost[next]) {
            cost[next] = stepCost;
            parent[next] = current;
            push(stepCost + estimate(nc, nr), next);
          }
        }
      }
    }
    if (!found) return null;

    const cells: Array<[number, number]> = [];
    for (let at = goalIndex; at !== -1; at = parent[at]) {
      const c = at % this.cols;
      cells.push([c, (at - c) / this.cols]);
    }
    cells.reverse();

    // Drop every corner that can be walked past in a straight line
    const kept: Array<[number, number]> = [cells[0]];
    let anchor = 0;
    for (let i = 2; i < cells.length; i++) {
      if (!this.clearLine(cells[anchor][0], cells[anchor][1], cells[i][0], cells[i][1])) {
        kept.push(cells[i - 1]);
        anchor = i - 1;
      }
    }
    if (cells.length > 1) kept.push(cells[cells.length - 1]);

    const path = kept.slice(1).map(([c, r]) => new THREE.Vector3(this.origin.x + this.cellX(c), 0, this.origin.z + this.cellZ(r)));
    const end = new THREE.Vector3(to.x, 0, to.z);
    const last = path[path.length - 1];
    if (!last || last.distanceTo(end) > 0.02) {
      // If the goal cell is the last corner, swap it for the exact point
      if (last && this.isFree(to.x, to.z) && last.distanceTo(end) < this.cell) path[path.length - 1] = end;
      else path.push(end);
    }
    return path;
  }
}
