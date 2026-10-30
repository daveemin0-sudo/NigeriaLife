import * as THREE from 'three';
import type { Zone } from './plan/CityPlan';

/**
 * Directions while driving yourself: the way along the streets to a place the player chose,
 * drawn as glowing arrows on their side of the road for the stretch ahead, moving the way to
 * go, and a line at the top saying where to and how far. On arrival it says so and clears.
 * If they leave the way, it finds a new one from where they are.
 */

const SPACING = 4.5;
const AHEAD = 95;
const MAX_ARROWS = Math.ceil(AHEAD / SPACING) + 2;
const ARRIVE = 14;

interface Node {
  x: number;
  z: number;
  roads: number[];
}

/** The way along the carriageways from one point to another, as the corners to drive through */
export function driveRoute(roads: readonly Zone[], from: { x: number; z: number }, to: { x: number; z: number }): THREE.Vector3[] | null {
  const lanes = roads.filter((r) => r.kind === 'carriageway');
  if (!lanes.length) return null;
  const centre = (r: Zone) => ({ x: (r.minX + r.maxX) / 2, z: (r.minZ + r.maxZ) / 2 });
  /** A point brought onto a road's middle line */
  const onto = (r: Zone, p: { x: number; z: number }) => (r.axis === 'z'
    ? { x: centre(r).x, z: Math.min(r.maxZ, Math.max(r.minZ, p.z)) }
    : { x: Math.min(r.maxX, Math.max(r.minX, p.x)), z: centre(r).z });
  const distTo = (r: Zone, p: { x: number; z: number }) => {
    const dx = Math.max(r.minX - p.x, 0, p.x - r.maxX);
    const dz = Math.max(r.minZ - p.z, 0, p.z - r.maxZ);
    return Math.hypot(dx, dz);
  };
  const nearest = (p: { x: number; z: number }) => lanes.reduce((best, r, i) => (distTo(r, p) < distTo(lanes[best], p) ? i : best), 0);
  const startRoad = nearest(from);
  const endRoad = nearest(to);
  // Corners: where two carriageways cross or meet
  const nodes: Node[] = [];
  const start = onto(lanes[startRoad], from);
  const end = onto(lanes[endRoad], to);
  nodes.push({ ...start, roads: [startRoad] }, { ...end, roads: [endRoad] });
  for (let i = 0; i < lanes.length; i++) {
    for (let j = i + 1; j < lanes.length; j++) {
      const a = lanes[i];
      const b = lanes[j];
      const minX = Math.max(a.minX, b.minX);
      const maxX = Math.min(a.maxX, b.maxX);
      const minZ = Math.max(a.minZ, b.minZ);
      const maxZ = Math.min(a.maxZ, b.maxZ);
      if (minX > maxX + 1 || minZ > maxZ + 1) continue;
      if (a.axis === b.axis) {
        // One road carrying on as another (Broad Street into the expressway): joined where they meet
        nodes.push(a.axis === 'z' ? { x: (Math.max(minX, Math.min(maxX, centre(a).x)) + centre(b).x) / 2, z: (minZ + maxZ) / 2, roads: [i, j] } : { x: (minX + maxX) / 2, z: (Math.max(minZ, Math.min(maxZ, centre(a).z)) + centre(b).z) / 2, roads: [i, j] });
        continue;
      }
      const along = a.axis === 'z' ? a : b;
      const across = a.axis === 'z' ? b : a;
      nodes.push({ x: centre(along).x, z: centre(across).z, roads: [i, j] });
    }
  }
  // Along each road, from each corner to the next
  const edges = new Map<number, Array<{ to: number; cost: number }>>();
  const link = (u: number, v: number) => {
    const cost = Math.hypot(nodes[u].x - nodes[v].x, nodes[u].z - nodes[v].z);
    (edges.get(u) ?? edges.set(u, []).get(u)!).push({ to: v, cost });
    (edges.get(v) ?? edges.set(v, []).get(v)!).push({ to: u, cost });
  };
  for (let r = 0; r < lanes.length; r++) {
    const on = nodes.map((n, i) => ({ n, i })).filter(({ n }) => n.roads.includes(r));
    on.sort((a, b) => (lanes[r].axis === 'z' ? a.n.z - b.n.z : a.n.x - b.n.x));
    for (let k = 1; k < on.length; k++) link(on[k - 1].i, on[k].i);
  }
  // The shortest way through them
  const dist = new Array(nodes.length).fill(Infinity);
  const prev = new Array<number>(nodes.length).fill(-1);
  const done = new Array(nodes.length).fill(false);
  dist[0] = 0;
  for (let step = 0; step < nodes.length; step++) {
    let u = -1;
    for (let i = 0; i < nodes.length; i++) if (!done[i] && (u < 0 || dist[i] < dist[u])) u = i;
    if (u < 0 || dist[u] === Infinity) break;
    if (u === 1) break;
    done[u] = true;
    for (const e of edges.get(u) ?? []) {
      if (dist[u] + e.cost < dist[e.to]) {
        dist[e.to] = dist[u] + e.cost;
        prev[e.to] = u;
      }
    }
  }
  if (dist[1] === Infinity) return null;
  const path: THREE.Vector3[] = [];
  for (let at = 1; at >= 0; at = prev[at]) path.unshift(new THREE.Vector3(nodes[at].x, 0, nodes[at].z));
  return path;
}

export class RouteGuide {
  public readonly group = new THREE.Group();
  private readonly arrows: THREE.InstancedMesh;
  private readonly matrix = new THREE.Matrix4();
  private readonly quat = new THREE.Quaternion();
  private readonly scale = new THREE.Vector3(1, 1, 1);
  private readonly up = new THREE.Vector3(0, 1, 0);
  private readonly spot = new THREE.Vector3();
  private path: THREE.Vector3[] = [];
  private target: { x: number; z: number; name: string } | null = null;
  private roads: (() => readonly Zone[] | null) | null = null;
  private clock = 0;
  private rethink = 0;
  private readonly bar: HTMLDivElement;
  /** Told when the place is reached */
  public onArrived: ((name: string) => void) | null = null;

  constructor() {
    // A chevron laid flat on the road, pointing along +z
    const shape = new THREE.Shape();
    shape.moveTo(-0.9, -0.5);
    shape.lineTo(0, 0.55);
    shape.lineTo(0.9, -0.5);
    shape.lineTo(0.55, -0.5);
    shape.lineTo(0, 0.12);
    shape.lineTo(-0.55, -0.5);
    shape.closePath();
    const geo = new THREE.ShapeGeometry(shape);
    geo.rotateX(-Math.PI / 2);
    geo.rotateY(Math.PI);
    const mat = new THREE.MeshBasicMaterial({ color: 0x34d399, transparent: true, opacity: 0.92, depthWrite: false });
    this.arrows = new THREE.InstancedMesh(geo, mat, MAX_ARROWS);
    this.arrows.name = 'route arrows';
    this.arrows.frustumCulled = false;
    this.arrows.renderOrder = 2;
    this.arrows.count = 0;
    this.group.add(this.arrows);
    this.group.visible = false;

    this.bar = document.createElement('div');
    this.bar.id = 'route-guide';
    this.bar.className = 'route-guide';
    this.bar.hidden = true;
    this.bar.innerHTML = '<span class="rg-icon">🧭</span><span class="rg-text"><strong id="route-guide-name"></strong><em id="route-guide-left"></em></span><button type="button" class="rg-x" aria-label="Stop the directions">✕</button>';
    this.bar.querySelector('.rg-x')!.addEventListener('click', () => this.stop());
    document.body.appendChild(this.bar);
  }

  public get active(): boolean {
    return !!this.target;
  }

  public get destination(): string | null {
    return this.target?.name ?? null;
  }

  /** Directions from here to there along the streets. False if there is no way by road. */
  public start(roads: () => readonly Zone[] | null, from: { x: number; z: number }, to: { x: number; z: number }, name: string): boolean {
    const list = roads();
    const path = list ? driveRoute(list, from, to) : null;
    if (!path) return false;
    path.push(new THREE.Vector3(to.x, 0, to.z));
    this.roads = roads;
    this.path = path;
    this.target = { ...to, name };
    this.group.visible = true;
    this.bar.hidden = false;
    (this.bar.querySelector('#route-guide-name') as HTMLElement).textContent = name;
    return true;
  }

  public stop(): void {
    this.target = null;
    this.path = [];
    this.arrows.count = 0;
    this.group.visible = false;
    this.bar.hidden = true;
  }

  /** Each frame: the arrows for the stretch ahead of `at`, the distance left, arrival */
  public update(delta: number, at: THREE.Vector3): void {
    if (!this.target) return;
    this.clock += delta;
    const target = this.target;
    if (Math.hypot(at.x - target.x, at.z - target.z) < ARRIVE) {
      const name = target.name;
      this.stop();
      this.onArrived?.(name);
      return;
    }
    // Drop the corners already passed: the nearest point of the way, and on from there
    let best = 0;
    let bestD = Infinity;
    let bestPoint = this.path[0];
    for (let i = 0; i < this.path.length - 1; i++) {
      const a = this.path[i];
      const b = this.path[i + 1];
      const abx = b.x - a.x;
      const abz = b.z - a.z;
      const len2 = abx * abx + abz * abz || 1;
      const t = Math.max(0, Math.min(1, ((at.x - a.x) * abx + (at.z - a.z) * abz) / len2));
      const px = a.x + abx * t;
      const pz = a.z + abz * t;
      const d = Math.hypot(at.x - px, at.z - pz);
      if (d < bestD) {
        bestD = d;
        best = i;
        bestPoint = new THREE.Vector3(px, 0, pz);
      }
    }
    // Off the way: a new one from here, now and then
    this.rethink -= delta;
    if (bestD > 22 && this.rethink <= 0 && this.roads) {
      this.rethink = 2;
      const list = this.roads();
      const fresh = list ? driveRoute(list, at, target) : null;
      if (fresh) {
        fresh.push(new THREE.Vector3(target.x, 0, target.z));
        this.path = fresh;
        return;
      }
    }
    const ahead = [bestPoint, ...this.path.slice(best + 1)];
    // How far is left along it
    let left = 0;
    for (let i = 0; i < ahead.length - 1; i++) left += ahead[i].distanceTo(ahead[i + 1]);
    (this.bar.querySelector('#route-guide-left') as HTMLElement).textContent = left >= 1000 ? `${(left / 1000).toFixed(1)} km to go` : `${Math.round(left / 10) * 10} m to go`;
    // Arrows every few metres for the next stretch, on the right-hand side of the road, drifting forward
    const phase = (this.clock * 5) % SPACING;
    let n = 0;
    let walked = 0;
    // How far along the way the next arrow stands
    let next = SPACING - phase;
    for (let i = 0; i < ahead.length - 1 && n < MAX_ARROWS && next < AHEAD; i++) {
      const a = ahead[i];
      const b = ahead[i + 1];
      const len = a.distanceTo(b);
      if (len < 0.01) continue;
      const dx = (b.x - a.x) / len;
      const dz = (b.z - a.z) / len;
      // On the right of the way travelled, (-dz, dx); in the middle for the last bit to the door
      const off = i === ahead.length - 2 ? 0 : 2.0;
      while (next <= walked + len && n < MAX_ARROWS && next < AHEAD) {
        const s = next - walked;
        if (next >= 3) {
          this.spot.set(a.x + dx * s - dz * off, 0.13, a.z + dz * s + dx * off);
          this.quat.setFromAxisAngle(this.up, Math.atan2(dx, dz));
          // Nearer arrows a little bigger
          const k = 1.45 - Math.min(0.5, (next / AHEAD) * 0.5);
          this.scale.set(k, 1, k);
          this.matrix.compose(this.spot, this.quat, this.scale);
          this.arrows.setMatrixAt(n++, this.matrix);
        }
        next += SPACING;
      }
      walked += len;
    }
    this.arrows.count = n;
    this.arrows.instanceMatrix.needsUpdate = true;
  }
}
