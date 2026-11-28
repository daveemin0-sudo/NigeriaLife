import * as THREE from 'three';
import { BakedPeople, type BakedMode } from '../../graphics/people/BakedPeople';
import { SkinnedCrowd } from '../../graphics/people/SkinnedCrowd';
import type { StreetLook } from '../../graphics/people/SkinnedCharacter';
import { RENDER_LAYERS } from '../InteriorTypes';

/**
 * The people in a mall, a market or any big public room: they come in at the door, walk the
 * room's paths to what they came for (an aisle, a shop window, a till, a bench), stay a while,
 * and go on or go home with what they bought. Supermarket shoppers push a trolley or carry a
 * basket and queue at the tills; mall walkers carry shopping bags. Far people are baked frames
 * (a handful of draws for everyone); the few nearest the player are the full model, faces and all.
 */

type P = [number, number];

/** Somewhere people go and stay: browse a shelf, look in a window, wait, pay */
export interface CrowdSpot {
  x: number;
  z: number;
  /** The way they face while there */
  yaw: number;
  /** Who goes there: 'shop' (supermarket shoppers), 'mall' (everyone else) */
  group: 'shop' | 'mall';
  /** A till: one at a time, with a place to wait behind (`queue`) */
  till?: P;
  mode?: BakedMode;
  /** How long they stay, seconds (from, to) */
  stay?: P;
  /** Height of the floor here (a gallery upstairs) */
  y?: number;
  /** The path node it is reached from, when not simply the nearest */
  node?: number;
  /** After a till: the way on past it, and the node that is reached */
  exit?: { pts: P[]; node: number };
}

export interface CrowdLayout {
  /** The paths: points and which of them join (people walk only along these) */
  nodes: P[];
  links: Array<[number, number]>;
  /** Where people come in and leave (node indices) */
  doors: number[];
  spots: CrowdSpot[];
  /** People sitting still (benches, food court chairs) */
  seats: Array<{ x: number; z: number; yaw: number; y?: number }>;
  /** People on a level the player cannot walk on, walking back and forth for life (a gallery seen from below) */
  strollers?: Array<{ a: P; b: P; y: number; count: number }>;
  /** How many are about at once */
  shoppers: number;
  walkers: number;
  playerAt: () => THREE.Vector3 | null;
  /** The room's origin in the world */
  origin: THREE.Vector3;
}

interface Person {
  id: number;
  look: StreetLook;
  h: number;
  group: 'shop' | 'mall';
  x: number;
  y: number;
  z: number;
  yaw: number;
  mode: BakedMode;
  cycle: number;
  speed: number;
  /** Points still to walk to */
  path: P[];
  node: number;
  /** The spot they are at or going to */
  spot: number;
  wait: number;
  /** How many more spots before they go home */
  left: number;
  /** Their side of the path, so two on one path walk side by side */
  lane: number;
  carry: 'trolley' | 'basket' | 'bags' | 'none';
  bags: number;
  queued: boolean;
  gone: boolean;
  /** Back and forth on a gallery */
  stroll?: { a: P; b: P; there: boolean };
}

/** Where the player is (set by the game), for crowds to draw the nearest people as full models */
export const MallPlayer: { at: () => THREE.Vector3 | null } = { at: () => null };

const SKIN = ['#3b2219', '#4a2c20', '#5c3a28', '#6b4330', '#7a4b33', '#8d5b3d', '#553323'];
const TOPS = [0xf1ece0, 0x1e3a8a, 0x7f1d1d, 0x0f766e, 0xd97706, 0x6d28d9, 0x111827, 0xe5e7eb, 0x14532d, 0xbe185d, 0x0369a1, 0xfacc15, 0x9a3412, 0x334155, 0xf472b6, 0x22c55e];
const BOTTOMS = [0x1f2937, 0x111827, 0x374151, 0x1e3a8a, 0xd6d3d1, 0x3f3f46, 0x1e40af];
const MEN: Array<Partial<StreetLook> & { set?: boolean }> = [
  { outfit: 'polo_shirt', bottom: 'chinos', shoes: 'loafers' },
  { outfit: 'casual_tee', bottom: 'jeans', shoes: 'sneakers' },
  { outfit: 'button_shirt', bottom: 'trousers', shoes: 'oxfords' },
  { outfit: 'kaftan', bottom: 'trousers', shoes: 'sandals', hat: 'kufi', set: true },
  { outfit: 'senator', bottom: 'trousers', shoes: 'loafers', set: true },
  { outfit: 'hoodie', bottom: 'jeans', shoes: 'sneakers' },
  { outfit: 'casual_tee', bottom: 'shorts', shoes: 'sneakers' },
];
const WOMEN: Array<Partial<StreetLook> & { set?: boolean }> = [
  { outfit: 'ankara_gown', shoes: 'heels' },
  { outfit: 'casual_tee', bottom: 'jeans', shoes: 'sneakers' },
  { outfit: 'buba_iro', shoes: 'sandals', hat: 'gele', set: true },
  { outfit: 'sundress', shoes: 'sandals' },
  { outfit: 'peplum_top', bottom: 'pencil_skirt', shoes: 'heels' },
  { outfit: 'button_shirt', bottom: 'jeans', shoes: 'sneakers' },
];
const BAG_COLOURS = [0xf8fafc, 0xdc2626, 0xc8a26b, 0x111827, 0xfacc15, 0x16a34a];

const WALK = 1.15;
const STRIDE = 1.45;
const SIT_FORWARD = 0.17;
const SIT_UP = 0.07;
/** How close two walkers come before the one behind waits */
const PERSONAL = 0.55;

const angleTo = (from: number, to: number): number => {
  let d = (to - from) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
};

/** A supermarket trolley: a wire basket on a frame with four castors and a red handle, one geometry */
function trolleyGeometry(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  const colour = (g: THREE.BufferGeometry, hex: number) => {
    const c = new THREE.Color(hex);
    const n = g.getAttribute('position').count;
    const a = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) a.set([c.r, c.g, c.b], i * 3);
    g.setAttribute('color', new THREE.BufferAttribute(a, 3));
    return g.index ? g.toNonIndexed() : g;
  };
  const box = (w: number, h: number, d: number, x: number, y: number, z: number, hex: number) => parts.push(colour(new THREE.BoxGeometry(w, h, d).translate(x, y + h / 2, z), hex));
  // The basket: its floor, sides and front, thin, in chrome grey (z forward, the handle at z 0)
  box(0.5, 0.02, 0.72, 0, 0.5, 0.46, 0xb8bec6);
  for (const x of [-0.25, 0.25]) box(0.02, 0.4, 0.72, x, 0.5, 0.46, 0xc9ced4);
  box(0.5, 0.4, 0.02, 0, 0.5, 0.82, 0xc9ced4);
  box(0.5, 0.4, 0.02, 0, 0.5, 0.1, 0xc9ced4);
  for (let i = 1; i < 6; i++) box(0.5, 0.012, 0.012, 0, 0.5 + i * 0.066, 0.82, 0x9aa1aa);
  // The frame and castors
  for (const x of [-0.22, 0.22]) {
    box(0.03, 0.03, 0.75, x, 0.12, 0.45, 0x8b939c);
    box(0.03, 0.42, 0.03, x, 0.12, 0.12, 0x8b939c);
    for (const z of [0.15, 0.78]) box(0.04, 0.1, 0.08, x, 0.02, z, 0x1f2937);
  }
  // The red handle the hands are on
  box(0.56, 0.05, 0.05, 0, 0.98, 0.02, 0xdc2626);
  return mergeColoured(parts);
}

/** A shopping basket held in one hand: red plastic, the handle up */
function basketGeometry(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  const add = (g: THREE.BufferGeometry, hex: number) => {
    const c = new THREE.Color(hex);
    const n = g.getAttribute('position').count;
    const a = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) a.set([c.r, c.g, c.b], i * 3);
    g.setAttribute('color', new THREE.BufferAttribute(a, 3));
    parts.push(g.index ? g.toNonIndexed() : g);
  };
  add(new THREE.BoxGeometry(0.42, 0.2, 0.3).translate(0, -0.12, 0), 0xdc2626);
  add(new THREE.BoxGeometry(0.36, 0.06, 0.24).translate(0, -0.01, 0), 0xfacc15);
  add(new THREE.BoxGeometry(0.03, 0.18, 0.02).translate(-0.1, 0.07, 0), 0x991b1b);
  add(new THREE.BoxGeometry(0.03, 0.18, 0.02).translate(0.1, 0.07, 0), 0x991b1b);
  add(new THREE.BoxGeometry(0.23, 0.03, 0.02).translate(0, 0.16, 0), 0x991b1b);
  return mergeColoured(parts);
}

/** A carrier bag on its handles: white unless tinted */
function bagGeometry(): THREE.BufferGeometry {
  const body = new THREE.BoxGeometry(0.3, 0.34, 0.12).translate(0, -0.27, 0);
  const handle = new THREE.TorusGeometry(0.06, 0.008, 4, 10, Math.PI).translate(0, -0.1, 0);
  return mergeColoured([body.toNonIndexed(), handle.toNonIndexed()].map((g) => {
    const n = g.getAttribute('position').count;
    g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(n * 3).fill(1), 3));
    return g;
  }));
}

function mergeColoured(parts: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const out = new THREE.BufferGeometry();
  for (const name of ['position', 'normal', 'color']) {
    const arrays = parts.map((p) => p.getAttribute(name).array as Float32Array);
    const merged = new Float32Array(arrays.reduce((n, a) => n + a.length, 0));
    let at = 0;
    for (const a of arrays) { merged.set(a, at); at += a.length; }
    out.setAttribute(name, new THREE.BufferAttribute(merged, 3));
  }
  for (const p of parts) p.dispose();
  out.computeBoundingSphere();
  return out;
}

export class MallCrowd {
  public readonly group = new THREE.Group();
  private readonly baked: BakedPeople;
  private readonly near: SkinnedCrowd;
  private readonly layout: CrowdLayout;
  private readonly people: Person[] = [];
  private readonly seated: Array<{ x: number; z: number; yaw: number; y: number; id: number; look: StreetLook; h: number }> = [];
  /** For each node, the nodes it joins */
  private readonly next: number[][];
  /** For each spot, the node nearest it (where its path leaves the network) */
  private readonly spotNode: number[];
  private readonly tillBusy = new Map<number, Person | null>();
  private readonly tillWaiting = new Map<number, Person | null>();
  private readonly trolleys: THREE.InstancedMesh;
  private readonly baskets: THREE.InstancedMesh;
  private readonly bagMesh: THREE.InstancedMesh;
  private readonly shade: THREE.InstancedMesh;
  private readonly m = new THREE.Matrix4();
  private readonly q = new THREE.Quaternion();
  private readonly v = new THREE.Vector3();
  private readonly s = new THREE.Vector3(1, 1, 1);
  private readonly c = new THREE.Color();
  private readonly player = new THREE.Vector3();
  private hasPlayer = false;
  private seed = 4242;
  private nextId = 1;

  constructor(layout: CrowdLayout) {
    this.layout = layout;
    this.group.name = 'interior_npc_mall_crowd';
    const people = new THREE.Group();
    people.name = 'interior_npc_mall_people';
    this.group.add(people);
    this.baked = new BakedPeople(people);
    this.near = new SkinnedCrowd(people);
    this.next = layout.nodes.map(() => []);
    for (const [a, b] of layout.links) {
      this.next[a].push(b);
      this.next[b].push(a);
    }
    this.spotNode = layout.spots.map((s) => s.node ?? this.nearestNode(s.x, s.z, s.group));
    layout.spots.forEach((s, i) => {
      if (s.till) {
        this.tillBusy.set(i, null);
        this.tillWaiting.set(i, null);
      }
    });
    const lit = (geo: THREE.BufferGeometry, count: number, name: string, vertexColors = true) => {
      const mesh = new THREE.InstancedMesh(geo, new THREE.MeshStandardMaterial({ vertexColors, roughness: 0.5, metalness: 0.2 }), count);
      mesh.frustumCulled = false;
      mesh.count = 0;
      mesh.name = name;
      this.group.add(mesh);
      return mesh;
    };
    this.trolleys = lit(trolleyGeometry(), 40, 'trolleys');
    this.baskets = lit(basketGeometry(), 40, 'baskets');
    this.bagMesh = lit(bagGeometry(), 120, 'carrier bags');
    this.bagMesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(120 * 3), 3);
    this.shade = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.75, 0.75).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: shadowSpot(), transparent: true, depthWrite: false, opacity: 0.45 }), 160);
    this.shade.frustumCulled = false;
    this.shade.renderOrder = 1;
    this.shade.name = 'crowd shadows';
    this.group.add(this.shade);

    for (const s of layout.seats) {
      const id = this.nextId++;
      this.seated.push({ x: s.x + Math.sin(s.yaw) * SIT_FORWARD, z: s.z + Math.cos(s.yaw) * SIT_FORWARD, y: (s.y ?? 0) + SIT_UP, yaw: s.yaw, id, look: this.lookFor(id), h: this.heightOf(id) });
    }
    for (const st of layout.strollers ?? []) {
      for (let i = 0; i < st.count; i++) {
        const t = this.rand();
        const p = this.newPerson('mall', st.a[0] + (st.b[0] - st.a[0]) * t, st.a[1] + (st.b[1] - st.a[1]) * t);
        p.y = st.y;
        p.lane = (this.rand() - 0.5) * 1.6;
        p.stroll = { a: st.a, b: st.b, there: this.rand() < 0.5 };
        p.carry = this.rand() < 0.5 ? 'bags' : 'none';
      }
    }
    // People already about the room: spread over the spots, some walking
    for (let i = 0; i < layout.shoppers + layout.walkers; i++) {
      const group = i < layout.shoppers ? 'shop' : 'mall';
      const spots = layout.spots.map((s, k) => ({ s, k })).filter(({ s }) => s.group === group && !s.till);
      if (!spots.length) continue;
      const { s, k } = spots[Math.floor(this.rand() * spots.length)];
      const p = this.newPerson(group, s.x, s.z);
      p.node = this.spotNode[k];
      p.spot = k;
      p.yaw = s.yaw;
      p.wait = this.rand() * this.stayAt(s);
      p.mode = s.mode ?? 'idle';
    }
    for (let t = 0; t < 40; t += 0.25) this.step(0.25);
  }

  public stats(): { people: number; walking: number; seated: number; atTills: number } {
    const live = this.people.filter((p) => !p.gone);
    return { people: live.length + this.seated.length, walking: live.filter((p) => p.mode === 'walk').length, seated: this.seated.length, atTills: [...this.tillBusy.values()].filter(Boolean).length };
  }

  // --- Who they are ----------------------------------------------------------------------------

  private rand(): number {
    this.seed = (this.seed * 1103515245 + 12345) & 0x7fffffff;
    return this.seed / 0x7fffffff;
  }

  private heightOf(id: number): number {
    return 0.94 + (((id * 2654435761) >>> 0) % 1000) / 1000 * 0.12;
  }

  private lookFor(id: number): StreetLook {
    const r = (salt: number) => (((id + salt) * 2654435761) >>> 0) / 4294967296;
    const female = r(1) < 0.52;
    const list = female ? WOMEN : MEN;
    const style = list[Math.floor(r(2) * list.length)];
    const top = TOPS[Math.floor(r(3) * TOPS.length)];
    const { set, ...rest } = style;
    return {
      gender: female ? 'female' : 'male',
      skinTone: SKIN[Math.floor(r(4) * SKIN.length)],
      hairColor: '#0b0908',
      ...rest,
      outfitColor: top,
      trousersColor: set ? top : BOTTOMS[Math.floor(r(5) * BOTTOMS.length)],
      shoeColor: r(6) < 0.5 ? 0x111827 : 0x5b3a1e,
      hatColor: style.hat === 'gele' ? TOPS[Math.floor(r(7) * TOPS.length)] : style.hat ? top : undefined,
    };
  }

  private newPerson(group: 'shop' | 'mall', x: number, z: number): Person {
    const id = this.nextId++;
    const r = this.rand();
    const p: Person = {
      id, look: this.lookFor(id), h: this.heightOf(id), group, x, y: 0, z, yaw: 0, mode: 'idle', cycle: this.rand(),
      speed: WALK * (0.85 + this.rand() * 0.3), path: [], node: 0, spot: -1, wait: 0,
      left: 2 + Math.floor(this.rand() * 4), lane: (this.rand() - 0.5) * 0.7,
      carry: group === 'shop' ? (r < 0.45 ? 'trolley' : 'basket') : r < 0.55 ? 'bags' : 'none',
      bags: 1 + Math.floor(this.rand() * 2), queued: false, gone: false,
    };
    this.people.push(p);
    return p;
  }

  private stayAt(s: CrowdSpot): number {
    const [a, b] = s.stay ?? [4, 12];
    return a + this.rand() * (b - a);
  }

  // --- Where they go ---------------------------------------------------------------------------

  private nearestNode(x: number, z: number, _group?: string): number {
    let best = 0;
    let d = Infinity;
    this.layout.nodes.forEach(([nx, nz], i) => {
      const dd = (nx - x) ** 2 + (nz - z) ** 2;
      if (dd < d) { d = dd; best = i; }
    });
    return best;
  }

  /** The nodes from one to another along the links (breadth first: few hops is short enough here) */
  private route(from: number, to: number): number[] {
    if (from === to) return [to];
    const back = new Map<number, number>([[from, -1]]);
    const open = [from];
    while (open.length) {
      const at = open.shift()!;
      for (const n of this.next[at]) {
        if (back.has(n)) continue;
        back.set(n, at);
        if (n === to) {
          const out = [to];
          let k = at;
          while (k !== from) { out.unshift(k); k = back.get(k)!; }
          return out;
        }
        open.push(n);
      }
    }
    return [to];
  }

  private goTo(p: Person, spot: number): void {
    const s = this.layout.spots[spot];
    p.spot = spot;
    p.path = this.route(p.node, this.spotNode[spot]).map((n) => this.layout.nodes[n]);
    p.path.push(s.till && this.tillBusy.get(spot) ? s.till : [s.x, s.z]);
    p.node = this.spotNode[spot];
    p.queued = !!(s.till && this.tillBusy.get(spot));
    if (s.till) {
      if (p.queued) this.tillWaiting.set(spot, p);
      else this.tillBusy.set(spot, p);
    }
  }

  private goHome(p: Person, first: P[] = []): void {
    const doors = this.layout.doors;
    const door = doors[Math.floor(this.rand() * doors.length)];
    p.spot = -1;
    p.path = [...first, ...this.route(p.node, door).map((n) => this.layout.nodes[n])];
    p.node = door;
    p.left = -1;
  }

  /** What they do next, at the end of a stay */
  private decide(p: Person): void {
    if (p.left === 0) {
      // A shopper pays before they go: to a till with nobody waiting
      if (p.group === 'shop' && p.carry !== 'bags') {
        const tills = this.layout.spots.map((s, i) => ({ s, i })).filter(({ s, i }) => s.till && !this.tillWaiting.get(i));
        const free = tills.filter(({ i }) => !this.tillBusy.get(i));
        const pick = (free.length ? free : tills)[Math.floor(this.rand() * (free.length || tills.length))];
        if (pick) { this.goTo(p, pick.i); return; }
      }
      this.goHome(p);
      return;
    }
    p.left--;
    const spots = this.layout.spots.map((s, i) => ({ s, i })).filter(({ s, i }) => s.group === p.group && !s.till && i !== p.spot);
    if (!spots.length) { this.goHome(p); return; }
    this.goTo(p, spots[Math.floor(this.rand() * spots.length)].i);
  }

  /** Someone new through a door, now and then, so the room stays as busy as it was */
  private arrive(): void {
    const live = this.people.filter((p) => !p.gone && !p.stroll);
    const shoppers = live.filter((p) => p.group === 'shop').length;
    const group: 'shop' | 'mall' = shoppers < this.layout.shoppers ? 'shop' : live.length - shoppers < this.layout.walkers ? 'mall' : 'shop';
    if (live.length >= this.layout.shoppers + this.layout.walkers) return;
    const door = this.layout.doors[Math.floor(this.rand() * this.layout.doors.length)];
    const [x, z] = this.layout.nodes[door];
    const p = this.newPerson(group, x, z);
    p.node = door;
    if (group === 'shop' && p.carry === 'bags') p.carry = 'basket';
    this.decide(p);
  }

  private sinceArrival = 0;

  private step(dt: number): void {
    this.sinceArrival += dt;
    if (this.sinceArrival > 1.6) {
      this.sinceArrival = 0;
      this.arrive();
    }
    for (const p of this.people) {
      if (p.gone) continue;
      if (p.stroll) { this.strollStep(p, dt); continue; }
      if (p.path.length) {
        this.walk(p, dt);
        continue;
      }
      // Arrived: at a spot (or at the door, and gone)
      if (p.left < 0 && p.spot < 0) { p.gone = true; continue; }
      const s = this.layout.spots[p.spot];
      if (!s) { this.decide(p); continue; }
      if (p.queued) {
        // Waiting behind someone at the till: step up when they are done
        p.mode = 'idle';
        p.yaw += angleTo(p.yaw, s.yaw) * Math.min(1, dt * 4);
        if (!this.tillBusy.get(p.spot)) {
          this.tillWaiting.set(p.spot, null);
          this.tillBusy.set(p.spot, p);
          p.queued = false;
          p.path = [[s.x, s.z]];
        }
        continue;
      }
      if (p.wait <= 0 && p.mode === 'walk') p.wait = this.stayAt(s);
      p.mode = s.mode ?? 'idle';
      p.yaw += angleTo(p.yaw, s.yaw) * Math.min(1, dt * 4);
      p.wait -= dt;
      if (p.wait > 0) continue;
      p.wait = 0;
      if (s.till) {
        // Paid: bagged, the trolley or basket left at the till's end, out with the bags
        this.tillBusy.set(p.spot, null);
        p.carry = 'bags';
        p.bags = 2 + Math.floor(this.rand() * 2);
        p.left = 0;
        if (s.exit) p.node = s.exit.node;
        this.goHome(p, s.exit?.pts ?? []);
        continue;
      }
      p.mode = 'walk';
      this.decide(p);
    }
    // The gone are let go now and then
    if (this.people.length > (this.layout.shoppers + this.layout.walkers) * 2) {
      for (let i = this.people.length - 1; i >= 0; i--) if (this.people[i].gone) this.people.splice(i, 1);
    }
  }

  private walk(p: Person, dt: number): void {
    const [tx0, tz0] = p.path[0];
    // Walk a little to one side of the path (their lane), except onto the very spot at the end
    const last = p.path.length === 1;
    let tx = tx0;
    let tz = tz0;
    const dx0 = tx0 - p.x;
    const dz0 = tz0 - p.z;
    const len0 = Math.hypot(dx0, dz0) || 1;
    if (!last) {
      tx += (dz0 / len0) * p.lane;
      tz -= (dx0 / len0) * p.lane;
    }
    const dx = tx - p.x;
    const dz = tz - p.z;
    const d = Math.hypot(dx, dz);
    if (d < 0.15) {
      p.path.shift();
      if (!p.path.length) p.wait = 0;
      return;
    }
    // Someone right ahead and walking the same way, or standing: slow and pass on their side
    let slow = 1;
    for (const o of this.people) {
      if (o === p || o.gone || o.y !== p.y) continue;
      const ox = o.x - p.x;
      const oz = o.z - p.z;
      const ahead = (ox * dx + oz * dz) / d;
      if (ahead <= 0 || ahead > PERSONAL * 1.6) continue;
      const side = Math.abs((ox * dz - oz * dx) / d);
      if (side < PERSONAL * 0.7) slow = Math.min(slow, o.mode === 'walk' ? 0.55 : 0.35);
    }
    const move = Math.min(d, p.speed * slow * dt);
    p.x += (dx / d) * move;
    p.z += (dz / d) * move;
    p.yaw += angleTo(p.yaw, Math.atan2(dx, dz)) * Math.min(1, dt * 8);
    p.mode = 'walk';
    p.cycle = (p.cycle + move / STRIDE) % 1;
  }

  private strollStep(p: Person, dt: number): void {
    const st = p.stroll!;
    const [tx, tz] = st.there ? st.b : st.a;
    const ax = st.b[0] - st.a[0];
    const az = st.b[1] - st.a[1];
    const al = Math.hypot(ax, az) || 1;
    const gx = tx + (-az / al) * p.lane;
    const gz = tz + (ax / al) * p.lane;
    const dx = gx - p.x;
    const dz = gz - p.z;
    const d = Math.hypot(dx, dz);
    if (p.wait > 0) {
      p.wait -= dt;
      p.mode = 'idle';
      return;
    }
    if (d < 0.3) {
      st.there = !st.there;
      p.wait = 1 + this.rand() * 5;
      return;
    }
    const move = Math.min(d, p.speed * dt);
    p.x += (dx / d) * move;
    p.z += (dz / d) * move;
    p.yaw += angleTo(p.yaw, Math.atan2(dx, dz)) * Math.min(1, dt * 6);
    p.mode = 'walk';
    p.cycle = (p.cycle + move / STRIDE) % 1;
  }

  /** Everyone on the floor near a point (room coordinates), as bodies, for the player to walk round */
  public peopleNear(x: number, z: number, range: number, out: Array<{ x: number; z: number; r: number }>): void {
    for (const p of this.people) {
      if (p.gone || p.y > 0.3) continue;
      if (Math.abs(p.x - x) < range && Math.abs(p.z - z) < range) out.push({ x: p.x, z: p.z, r: p.carry === 'trolley' ? 0.42 : 0.26 });
    }
  }

  // --- Drawing ---------------------------------------------------------------------------------

  public update(delta: number): void {
    const at = this.layout.playerAt();
    this.hasPlayer = !!at;
    if (at) this.player.copy(at).sub(this.layout.origin);
    this.step(Math.min(delta, 0.1));
    this.draw(delta);
  }

  private placeAt(p: Person, side: number, ahead: number, y: number): THREE.Matrix4 {
    const s = Math.sin(p.yaw);
    const c = Math.cos(p.yaw);
    this.v.set(p.x + s * ahead - c * side, p.y + y, p.z + c * ahead + s * side);
    this.q.setFromAxisAngle(THREE.Object3D.DEFAULT_UP, p.yaw);
    return this.m.compose(this.v, this.q, this.s);
  }

  private draw(delta: number): void {
    const mask = 1 << RENDER_LAYERS.INTERIOR;
    if (this.hasPlayer) {
      const reach2 = SkinnedCrowd.reach * SkinnedCrowd.reach;
      for (const p of this.people) {
        if (p.gone || p.y > 0.3) continue;
        const d2 = (p.x - this.player.x) ** 2 + (p.z - this.player.z) ** 2;
        if (d2 < reach2) this.near.offer({ id: p.id, look: p.look, lookKey: p.id, x: p.x, y: p.y, z: p.z, yaw: p.yaw, scale: p.h, mode: p.mode === 'walk' ? 'walk' : p.mode === 'talk' ? 'talk' : 'idle', d2, layers: mask });
      }
    }
    this.near.sync(delta);
    this.baked.begin();
    let trolleys = 0;
    let baskets = 0;
    let bags = 0;
    let shade = 0;
    for (const s of this.seated) this.baked.draw(s.id, s.look, s.id, s.x, s.y, s.z, s.yaw, s.h, 'sit', 0);
    for (const p of this.people) {
      if (p.gone) continue;
      if (!this.near.handleOf(p.id)) this.baked.draw(p.id, p.look, p.id, p.x, p.y, p.z, p.yaw, p.h, p.mode, p.cycle);
      if (shade < this.shade.instanceMatrix.count) {
        this.m.makeTranslation(p.x, p.y + 0.013, p.z);
        this.shade.setMatrixAt(shade++, this.m);
      }
      if (p.carry === 'trolley' && trolleys < this.trolleys.instanceMatrix.count) {
        this.trolleys.setMatrixAt(trolleys++, this.placeAt(p, 0, 0.42, 0));
      } else if (p.carry === 'basket' && baskets < this.baskets.instanceMatrix.count) {
        this.baskets.setMatrixAt(baskets++, this.placeAt(p, 0.27, 0.02, 0.72 * p.h));
      } else if (p.carry === 'bags') {
        for (let i = 0; i < Math.min(p.bags, 3) && bags < this.bagMesh.instanceMatrix.count; i++) {
          const side = i === 1 ? -0.27 : 0.27;
          this.bagMesh.setMatrixAt(bags, this.placeAt(p, side, 0.02 + (i === 2 ? 0.08 : 0), 0.74 * p.h));
          this.bagMesh.setColorAt(bags++, this.c.setHex(BAG_COLOURS[(p.id + i) % BAG_COLOURS.length]));
        }
      }
    }
    this.baked.end();
    for (const [mesh, n] of [[this.trolleys, trolleys], [this.baskets, baskets], [this.bagMesh, bags], [this.shade, shade]] as const) {
      mesh.count = n;
      mesh.instanceMatrix.needsUpdate = true;
    }
    if (this.bagMesh.instanceColor) this.bagMesh.instanceColor.needsUpdate = true;
    this.group.traverse((o) => {
      if (o.layers.mask !== mask) o.layers.set(RENDER_LAYERS.INTERIOR);
    });
  }
}

let spot: THREE.CanvasTexture | null = null;
function shadowSpot(): THREE.CanvasTexture {
  if (spot) return spot;
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d')!;
  const grad = g.createRadialGradient(32, 32, 2, 32, 32, 32);
  grad.addColorStop(0, 'rgba(0,0,0,0.85)');
  grad.addColorStop(0.55, 'rgba(0,0,0,0.35)');
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  spot = new THREE.CanvasTexture(c);
  return spot;
}
