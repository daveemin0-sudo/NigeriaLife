import * as THREE from 'three';
import { BakedPeople, type BakedMode } from '../../graphics/people/BakedPeople';
import type { StreetLook } from '../../graphics/people/SkinnedCharacter';
import { RENDER_LAYERS } from '../InteriorTypes';
import { BAG_COLOURS, LuggageBatch, type BagKind } from './Luggage';

/**
 * The people who make the terminal a terminal: travellers coming in from the kerb pulling their
 * rollers and pushing trolleys of Ghana-must-go bags, a check-in queue that steps forward as the
 * counters call the next person, bags left on the scale, the walk through the security arches,
 * people waiting at the gates and walking out to their aircraft; and the other way, passengers
 * off the plane, waiting round the belt, taking their bag and heading out to the kerb.
 *
 * Everyone is the game's own character model (its low-detail copy, baked at a few frames of each
 * action and drawn instanced, as the far crowd on the streets is), so forty people moving cost
 * about what two of the old figures did. Everything is in the hall's own coordinates.
 */

type P = [number, number];

interface Bag {
  kind: BagKind;
  colour: number;
}

type Step =
  | { k: 'go'; pts: P[]; speed?: number }
  | { k: 'wait'; t: number; mode: BakedMode; yaw?: number }
  | { k: 'queue' }
  | { k: 'counter'; at: number }
  | { k: 'claim' }
  | { k: 'climb'; from: P; to: P; rise: number }
  | { k: 'out' };

interface Person {
  id: number;
  look: StreetLook;
  h: number;
  x: number;
  y: number;
  z: number;
  yaw: number;
  mode: BakedMode;
  cycle: number;
  speed: number;
  steps: Step[];
  wait: number;
  /** What they pull (a roller), push (a trolley, with bags on it) or carry (a duffel) */
  bag: Bag | null;
  load: Bag[];
  trolley: boolean;
  /** Along the queue line (metres from its head), while queuing */
  qs: number;
  spot: number;
  gone: boolean;
  /** Ground crew pacing between two points */
  crew?: { a: P; b: P; there: boolean };
}

/** Where the aircraft steps are for each gate (the foot, the top and how high the door is) */
export interface Boarding {
  foot: P;
  top: P;
  rise: number;
}

export interface CrowdLayout {
  /** The counters people are served at (x), and where their bag goes on the scale */
  counters: number[];
  /** The check-in queue as a line from its head back to where it is joined */
  queue: P[];
  lanes: number[];
  gates: number[];
  /** The way out to each gate's aircraft, and the arrivals coming in */
  boarding: Boarding[];
  arrivalsFrom: Boarding;
  /** People sitting still: benches at the gates, the café, the lounge */
  seats: Array<{ x: number; z: number; yaw: number; y?: number }>;
  /** Spots round the belt, each with the way the person faces */
  beltSpots: Array<{ x: number; z: number; yaw: number }>;
  /** A bag off the belt near this point, if one is passing (the belt then carries one fewer) */
  takeBag: (x: number, z: number) => Bag | null;
  playerAt: () => THREE.Vector3 | null;
  /** Ground crew in hi-vis on the apron: where they stand and face, and where they pace to */
  crew: Array<{ x: number; z: number; yaw: number; to?: P; talk?: boolean }>;
  /** The hall's origin in the world (the player's position is in world space) */
  origin: THREE.Vector3;
}

const SKIN = ['#3b2219', '#4a2c20', '#5c3a28', '#6b4330', '#7a4b33', '#8d5b3d', '#553323'];
const TOPS = [0xf1ece0, 0x1e3a8a, 0x7f1d1d, 0x0f766e, 0xd97706, 0x6d28d9, 0x111827, 0xe5e7eb, 0x14532d, 0xbe185d, 0x0369a1, 0xfacc15, 0x9a3412, 0x334155];
const BOTTOMS = [0x1f2937, 0x111827, 0x374151, 0x1e3a8a, 0xd6d3d1, 0x3f3f46];
const MEN: Array<Partial<StreetLook> & { set?: boolean }> = [
  { outfit: 'polo_shirt', bottom: 'chinos', shoes: 'loafers' },
  { outfit: 'button_shirt', bottom: 'trousers', shoes: 'oxfords' },
  { outfit: 'casual_tee', bottom: 'jeans', shoes: 'sneakers' },
  { outfit: 'kaftan', bottom: 'trousers', shoes: 'sandals', hat: 'kufi', set: true },
  { outfit: 'senator', bottom: 'trousers', shoes: 'loafers', set: true },
  { outfit: 'agbada', bottom: 'trousers', shoes: 'loafers', hat: 'fila', set: true },
  { outfit: 'hoodie', bottom: 'jeans', shoes: 'sneakers' },
  { outfit: 'corporate_shirt', bottom: 'trousers', shoes: 'oxfords' },
];
const WOMEN: Array<Partial<StreetLook> & { set?: boolean }> = [
  { outfit: 'buba_iro', shoes: 'sandals', hat: 'gele', set: true },
  { outfit: 'ankara_gown', shoes: 'heels' },
  { outfit: 'button_shirt', bottom: 'jeans', shoes: 'sneakers' },
  { outfit: 'peplum_top', bottom: 'pencil_skirt', shoes: 'heels' },
  { outfit: 'sundress', shoes: 'sandals' },
  { outfit: 'casual_tee', bottom: 'jeans', shoes: 'sneakers' },
  { outfit: 'gown', shoes: 'heels', hat: 'gele' },
];

const QUEUE_GAP = 0.82;
const QUEUE_MAX = 19;
const WALK = 1.25;
/** Metres walked in one full stride (both legs) of the walk */
const STRIDE = 1.45;

const angleTo = (from: number, to: number): number => {
  let d = (to - from) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
};

export class AirportCrowd {
  public readonly group = new THREE.Group();
  private readonly baked: BakedPeople;
  private readonly bags: LuggageBatch;
  private readonly people: Person[] = [];
  private readonly queue: Person[] = [];
  private readonly counterBusy: Array<Person | null>;
  private readonly spotBusy: Array<Person | null>;
  private readonly seated: Array<{ x: number; z: number; yaw: number; y: number; id: number; look: StreetLook; h: number }> = [];
  private readonly talkers: Person[] = [];
  private readonly qLen: number;
  private seed = 12345;
  private nextId = 1;
  private sinceDeparture = 0;
  private sinceArrival = 0;
  private readonly m = new THREE.Matrix4();
  private readonly m2 = new THREE.Matrix4();
  private readonly q = new THREE.Quaternion();
  private readonly e = new THREE.Euler();
  private readonly v = new THREE.Vector3();
  private readonly one = new THREE.Vector3(1, 1, 1);
  private readonly shadeMesh: THREE.InstancedMesh;
  private readonly player = new THREE.Vector3();
  private hasPlayer = false;

  private readonly layout: CrowdLayout;

  constructor(layout: CrowdLayout) {
    this.layout = layout;
    this.group.name = 'interior_npc_crowd';
    const people = new THREE.Group();
    people.name = 'interior_npc_crowd_people';
    this.group.add(people);
    this.baked = new BakedPeople(people);
    this.bags = new LuggageBatch({ roller: 60, rollerLying: 24, ghana: 40, duffel: 30, carton: 24, trolley: 20 });
    this.group.add(this.bags.group);
    // A soft shadow on the floor under everyone
    this.shadeMesh = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.75, 0.75).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: shadowSpot(), transparent: true, depthWrite: false, opacity: 0.5 }), 140);
    this.shadeMesh.frustumCulled = false;
    this.shadeMesh.renderOrder = 1;
    this.shadeMesh.name = 'crowd shadows';
    this.group.add(this.shadeMesh);
    this.counterBusy = layout.counters.map(() => null);
    this.spotBusy = layout.beltSpots.map(() => null);
    let len = 0;
    for (let i = 1; i < layout.queue.length; i++) len += Math.hypot(layout.queue[i][0] - layout.queue[i - 1][0], layout.queue[i][1] - layout.queue[i - 1][1]);
    this.qLen = len;

    for (const s of layout.seats) {
      const id = this.nextId++;
      this.seated.push({ ...s, y: s.y ?? 0, id, look: this.lookFor(id), h: this.heightOf(id) });
    }
    this.startingCrowd();
    for (const c of layout.crew) this.crewMember(c);
    // A minute of the terminal already going before anyone looks
    for (let t = 0; t < 75; t += 0.25) this.step(0.25);
  }

  /** People about now, and how many of them are walking (for the tests) */
  public stats(): { people: number; walking: number; queuing: number; seated: number; atBelt: number } {
    const live = this.people.filter((p) => !p.gone);
    return { people: live.length + this.seated.length, walking: live.filter((p) => p.mode === 'walk').length, queuing: this.queue.length, seated: this.seated.length, atBelt: this.spotBusy.filter(Boolean).length };
  }

  // --- Who they are ------------------------------------------------------------------------------

  private rand(): number {
    this.seed = (this.seed * 1103515245 + 12345) & 0x7fffffff;
    return this.seed / 0x7fffffff;
  }

  private pick<T>(list: readonly T[]): T {
    return list[Math.floor(this.rand() * list.length) % list.length];
  }

  private heightOf(id: number): number {
    return 0.94 + ((id * 2654435761) >>> 0) % 1000 / 1000 * 0.12;
  }

  private lookFor(id: number): StreetLook {
    const r = (salt: number) => (((id + salt) * 2654435761) >>> 0) / 4294967296;
    const female = r(1) < 0.48;
    const style = (female ? WOMEN : MEN)[Math.floor(r(2) * (female ? WOMEN : MEN).length)];
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

  private newPerson(x: number, z: number, yaw: number, steps: Step[], luggage: 'any' | 'none' | 'carry' = 'any'): Person {
    const id = this.nextId++;
    const p: Person = { id, look: this.lookFor(id), h: this.heightOf(id), x, y: 0, z, yaw, mode: 'idle', cycle: this.rand(), speed: WALK * (0.88 + this.rand() * 0.24), steps, wait: 0, bag: null, load: [], trolley: false, qs: -1, spot: -1, gone: false };
    const r = this.rand();
    const colour = this.pick(BAG_COLOURS);
    if (luggage === 'carry') p.bag = r < 0.6 ? { kind: 'duffel', colour } : null;
    else if (luggage === 'any') {
      if (r < 0.47) p.bag = { kind: 'roller', colour };
      else if (r < 0.74) {
        p.trolley = true;
        p.load = [{ kind: 'ghana', colour }, this.rand() < 0.5 ? { kind: 'rollerLying', colour: this.pick(BAG_COLOURS) } : { kind: 'carton', colour }];
        if (this.rand() < 0.4) p.load.push({ kind: 'ghana', colour });
      } else if (r < 0.88) p.bag = { kind: 'duffel', colour };
    }
    this.people.push(p);
    return p;
  }

  // --- What they do ------------------------------------------------------------------------------

  private departure(): void {
    const door = this.rand() < 0.75 ? -12 : 0;
    const x = door + (this.rand() - 0.5) * 2;
    const online = this.rand() < 0.28;
    const steps: Step[] = [{ k: 'go', pts: [[x, 18.6]] }];
    if (online) {
      steps.push({ k: 'go', pts: [[-6.6, 9.4], [-6.8, 6.6]] }, ...this.security(-6.8), ...this.airside());
    } else {
      steps.push({ k: 'go', pts: [[-13, 12.4], this.layout.queue[this.layout.queue.length - 1]] }, { k: 'queue' });
    }
    this.newPerson(x, 21.4, Math.PI, steps, online ? 'carry' : 'any');
  }

  /** From the check-in side to the far side of a security arch */
  private security(fromX: number): Step[] {
    const lane = this.pick(this.layout.lanes);
    const ax = lane + 0.3;
    return [
      { k: 'go', pts: [[Math.min(fromX, -6.6), 5.95], [-6.0, 6.35], [ax, 6.35], [ax, 3.25]] },
      // The beep of the arch, the officer's look, the tray
      { k: 'wait', t: 1.2 + this.rand() * 1.4, mode: 'idle', yaw: Math.PI },
      { k: 'go', pts: [[ax, 0.3], [ax, -1.2]] },
    ];
  }

  /** Airside: a coffee or a look at the shop sometimes, then the gate, then out to the aircraft */
  private airside(): Step[] {
    const g = this.rand() < 0.5 ? 0 : 1;
    const gx = this.layout.gates[g];
    const aisle = g === 0 ? gx - 1.0 : gx;
    const steps: Step[] = [];
    const r = this.rand();
    // The café counter along the wall, round the tables; or down the shop's aisle
    if (r < 0.18) steps.push({ k: 'go', pts: [[-14, -1.6], [-16.5, -2.6], [-23.8, -2.6], [-24.5, -4.8 - this.rand() * 2.4]] }, { k: 'wait', t: 6 + this.rand() * 6, mode: 'idle', yaw: -Math.PI / 2 }, { k: 'go', pts: [[-23.8, -2.6], [-16.5, -2.6], [-14, -1.6], [-3.4, -1.6]] });
    else if (r < 0.3) steps.push({ k: 'go', pts: [[-6.5, -1.6], [-10.05, -1.6], [-10.05, -3.5 - this.rand() * 2.2]] }, { k: 'wait', t: 5 + this.rand() * 5, mode: 'idle', yaw: Math.PI / 2 }, { k: 'go', pts: [[-10.05, -1.6], [-3.4, -1.6]] });
    const sx = gx - 2.6 + this.rand() * 5.2;
    const sz = -13.7 - this.rand() * 1.0;
    steps.push(
      { k: 'go', pts: [[aisle, -4.6], [aisle, -13.6], [sx, sz]] },
      { k: 'wait', t: 14 + this.rand() * 40, mode: this.rand() < 0.25 ? 'talk' : 'idle', yaw: this.rand() * Math.PI * 2 },
      ...this.board(g),
    );
    return steps;
  }

  private board(g: number): Step[] {
    const gx = this.layout.gates[g];
    const b = this.layout.boarding[g];
    return [
      { k: 'go', pts: [[gx + 2.3, -14.6], [gx + 2.3, -18.3], [gx + 0.9, -19.4], [gx + 0.9, -21.2], b.foot] },
      { k: 'climb', from: b.foot, to: b.top, rise: b.rise },
      { k: 'out' },
    ];
  }

  private arrival(): void {
    const a = this.layout.arrivalsFrom;
    const p = this.newPerson(a.top[0], a.top[1], 0, [], 'carry');
    p.y = a.rise;
    // Off the aircraft, down the steps, across to the arrivals door and through to the belt
    p.steps = [
      { k: 'climb', from: a.top, to: a.foot, rise: -a.rise },
      { k: 'go', pts: [[37, -23.2], [30, -22.3], [26.2, -21.0], [26.2, -19.3], [26.9, -14], [26.9, -5], [12.2, -0.6], [12.1, 2.6]] },
      { k: 'claim' },
    ];
  }

  private exitWith(p: Person): void {
    const s = this.layout.beltSpots[p.spot];
    const pts: P[] = [];
    // Round the belt, never across it
    if (s.z < 9) pts.push(s.x < 16 ? [7.6, 7.4] : [21.7, 7.4], s.x < 16 ? [7.6, 13.6] : [21.7, 12.8]);
    else if (s.x > 21) pts.push([21.7, 12.8]);
    pts.push([14.3, 14.4], [14.2, 18.4], [13.2, 19.3], [13.2, 21.6]);
    p.steps.unshift({ k: 'go', pts }, { k: 'out' });
  }

  private startingCrowd(): void {
    // A queue already there, and someone at each counter
    for (let i = 0; i < 15; i++) {
      const [x, z] = this.queuePoint(i * QUEUE_GAP);
      const p = this.newPerson(x, z, 0, []);
      p.qs = i * QUEUE_GAP;
      this.queue.push(p);
    }
    // People talking in pairs, landside and airside, and one on the phone by the kiosks
    const pairs: Array<[number, number, number]> = [[-8.6, 16.4, 0.3], [7.4, 13.8, -0.5], [1.2, -8.2, 1.2], [-17.2, 14.6, 2.0]];
    for (const [x, z, yaw] of pairs) {
      for (const side of [-1, 1]) {
        const px = x + Math.sin(yaw + Math.PI / 2) * 0.45 * side;
        const pz = z + Math.cos(yaw + Math.PI / 2) * 0.45 * side;
        const p = this.newPerson(px, pz, yaw + (side > 0 ? -Math.PI / 2 : Math.PI / 2), [{ k: 'wait', t: 1e9, mode: 'talk' }], this.rand() < 0.5 ? 'any' : 'none');
        this.talkers.push(p);
      }
    }
  }

  /** Ground crew: hi-vis vests (lime or orange) over navy work trousers and boots */
  private crewMember(c: { x: number; z: number; yaw: number; to?: P; talk?: boolean }): void {
    const p = this.newPerson(c.x, c.z, c.yaw, c.to ? [] : [{ k: 'wait', t: 1e9, mode: c.talk ? 'talk' : 'idle', yaw: c.yaw }], 'none');
    const vest = p.id % 3 ? 0xc8f03c : 0xff7a1a;
    p.look = { gender: p.id % 5 ? 'male' : 'female', skinTone: p.look.skinTone, hairColor: '#0b0908', outfit: 'polo_shirt', outfitColor: vest, bottom: 'cargo_pants', trousersColor: 0x1f2a44, shoes: 'boots', shoeColor: 0x111827, hat: p.id % 2 ? 'cap' : undefined, hatColor: 0x1f2a44 };
    if (c.to) p.crew = { a: [c.x, c.z], b: c.to, there: false };
  }

  // --- The queue -----------------------------------------------------------------------------------

  private queuePoint(s: number): P {
    const q = this.layout.queue;
    let left = Math.max(0, Math.min(this.qLen, s));
    for (let i = 1; i < q.length; i++) {
      const seg = Math.hypot(q[i][0] - q[i - 1][0], q[i][1] - q[i - 1][1]);
      if (left <= seg) {
        const t = seg > 0 ? left / seg : 0;
        return [q[i - 1][0] + (q[i][0] - q[i - 1][0]) * t, q[i - 1][1] + (q[i][1] - q[i - 1][1]) * t];
      }
      left -= seg;
    }
    return q[q.length - 1];
  }

  private stepQueue(dt: number): void {
    this.queue.forEach((p, i) => {
      const target = i * QUEUE_GAP;
      if (p.qs > target + 0.02) {
        const before = this.queuePoint(p.qs);
        p.qs = Math.max(target, p.qs - p.speed * 0.8 * dt);
        const [x, z] = this.queuePoint(p.qs);
        this.face(p, x - before[0], z - before[1], dt);
        p.cycle += Math.hypot(x - p.x, z - p.z) / STRIDE;
        p.x = x;
        p.z = z;
        p.mode = 'walk';
      } else {
        p.mode = 'idle';
      }
    });
    // The next person to a free counter
    const head = this.queue[0];
    if (head && head.qs < 0.1) {
      const free = this.counterBusy.findIndex((c) => !c);
      if (free >= 0) {
        this.queue.shift();
        head.qs = -1;
        this.counterBusy[free] = head;
        const cx = this.layout.counters[free];
        const [hx, hz] = this.layout.queue[0];
        head.steps.unshift({ k: 'go', pts: [[hx + 0.3, hz - 0.75], [Math.min(cx + 0.6, hx), 5.95], [cx, 5.3]] }, { k: 'counter', at: free });
      }
    }
  }

  // --- Each moment -----------------------------------------------------------------------------------

  private face(p: Person, dx: number, dz: number, dt: number): void {
    if (Math.abs(dx) + Math.abs(dz) < 1e-5) return;
    const want = Math.atan2(dx, dz);
    p.yaw += angleTo(p.yaw, want) * Math.min(1, dt * 8);
  }

  private blocked(p: Person, dx: number, dz: number): boolean {
    if (!this.hasPlayer) return false;
    const px = this.player.x - p.x;
    const pz = this.player.z - p.z;
    const d2 = px * px + pz * pz;
    // Someone about to walk into the player stops and lets them by
    return d2 < 0.9 && px * dx + pz * dz > 0;
  }

  private step(dt: number): void {
    this.sinceDeparture += dt;
    this.sinceArrival += dt;
    if (this.sinceDeparture > 5.2 && this.queue.length < QUEUE_MAX) {
      this.sinceDeparture = this.rand() * 1.5;
      this.departure();
    }
    if (this.sinceArrival > 6.5) {
      this.sinceArrival = this.rand() * 2;
      this.arrival();
    }
    this.stepQueue(dt);
    for (const p of this.people) {
      if (p.gone || p.qs >= 0) continue;
      this.act(p, dt);
    }
    // The gone are let go of now and then
    if (this.people.length > 90) {
      const keep = this.people.filter((p) => !p.gone);
      this.people.length = 0;
      this.people.push(...keep);
    }
  }

  private act(p: Person, dt: number): void {
    const s = p.steps[0];
    if (!s) {
      p.mode = 'idle';
      // Ground crew walk on to the other end of their round, and stop there a while
      if (p.crew) {
        p.crew.there = !p.crew.there;
        p.steps.push({ k: 'go', pts: [p.crew.there ? [...p.crew.b] as P : [...p.crew.a] as P], speed: 1.1 }, { k: 'wait', t: 2 + this.rand() * 4, mode: 'idle' });
      }
      return;
    }
    switch (s.k) {
      case 'go': {
        const [tx, tz] = s.pts[0];
        const dx = tx - p.x;
        const dz = tz - p.z;
        const d = Math.hypot(dx, dz);
        if (d < 0.06) {
          s.pts.shift();
          if (!s.pts.length) p.steps.shift();
          return;
        }
        if (this.blocked(p, dx, dz)) {
          p.mode = 'idle';
          return;
        }
        const move = Math.min(d, (s.speed ?? p.speed) * dt);
        p.x += (dx / d) * move;
        p.z += (dz / d) * move;
        p.cycle += move / STRIDE;
        this.face(p, dx, dz, dt);
        p.mode = 'walk';
        return;
      }
      case 'wait': {
        p.mode = s.mode;
        if (s.yaw !== undefined) p.yaw += angleTo(p.yaw, s.yaw) * Math.min(1, dt * 4);
        p.cycle += dt * 0.5;
        s.t -= dt;
        if (s.t <= 0) p.steps.shift();
        return;
      }
      case 'queue': {
        p.steps.shift();
        p.qs = this.qLen;
        this.queue.push(p);
        return;
      }
      case 'counter': {
        p.mode = 'idle';
        p.yaw += angleTo(p.yaw, Math.PI) * Math.min(1, dt * 4);
        p.wait += dt;
        if (p.wait > 10 + (p.id % 5)) {
          p.wait = 0;
          p.steps.shift();
          this.counterBusy[s.at] = null;
          // The checked bags have gone down the belt; what is left is carried on
          p.trolley = false;
          p.load = [];
          p.bag = this.rand() < 0.55 ? { kind: 'duffel', colour: this.pick(BAG_COLOURS) } : null;
          p.steps.unshift(...this.security(this.layout.counters[s.at]), ...this.airside());
        }
        return;
      }
      case 'climb': {
        const run = Math.hypot(s.to[0] - s.from[0], s.to[1] - s.from[1]);
        const done = Math.hypot(p.x - s.from[0], p.z - s.from[1]);
        const dx = s.to[0] - p.x;
        const dz = s.to[1] - p.z;
        const left = Math.hypot(dx, dz);
        const move = Math.min(left, p.speed * 0.6 * dt);
        if (left > 0.01) {
          p.x += (dx / left) * move;
          p.z += (dz / left) * move;
          this.face(p, dx, dz, dt);
        }
        p.cycle += move / STRIDE;
        p.mode = 'walk';
        const t = run > 0 ? Math.min(1, (done + move) / run) : 1;
        p.y = s.rise > 0 ? s.rise * t : -s.rise * (1 - t);
        if (left <= 0.02) p.steps.shift();
        return;
      }
      case 'claim': {
        if (p.spot < 0) {
          const free = this.spotBusy.map((b, i) => (b ? -1 : i)).filter((i) => i >= 0);
          if (!free.length) {
            p.mode = 'idle';
            return;
          }
          const i = this.pick(free);
          p.spot = i;
          this.spotBusy[i] = p;
          const spot = this.layout.beltSpots[i];
          const pts: P[] = spot.z > 11 ? [[7.6, 6.6], [7.6, 13.6], [spot.x, 13.5], [spot.x, spot.z]] : spot.x > 21 ? [[21.6, 7.4], [spot.x, spot.z]] : [[spot.x, spot.z]];
          p.steps.unshift({ k: 'go', pts }, { k: 'wait', t: 0.6, mode: 'idle', yaw: spot.yaw });
          return;
        }
        p.mode = 'idle';
        p.yaw += angleTo(p.yaw, this.layout.beltSpots[p.spot].yaw) * Math.min(1, dt * 4);
        p.wait += dt;
        if (p.wait < 5) return;
        const bag = this.layout.takeBag(p.x, p.z) ?? (p.wait > 45 ? { kind: 'roller' as BagKind, colour: this.pick(BAG_COLOURS) } : null);
        if (!bag) return;
        p.wait = 0;
        p.steps.shift();
        if (bag.kind === 'ghana' || bag.kind === 'carton') {
          p.trolley = true;
          p.load = [bag];
        } else {
          p.load = [];
          p.bag = { kind: bag.kind === 'rollerLying' ? 'roller' : bag.kind, colour: bag.colour };
        }
        this.spotBusy[p.spot] = null;
        this.exitWith(p);
        p.spot = -1;
        return;
      }
      case 'out':
        p.gone = true;
        return;
    }
  }

  // --- Drawing ---------------------------------------------------------------------------------------

  public update(delta: number): void {
    const at = this.layout.playerAt();
    this.hasPlayer = !!at;
    if (at) this.player.copy(at).sub(this.layout.origin);
    this.step(Math.min(delta, 0.1));
    this.draw();
  }

  private draw(): void {
    this.baked.begin();
    this.bags.begin();
    let shade = 0;
    const shadeAt = (x: number, y: number, z: number, size: number) => {
      if (shade >= this.shadeMesh.instanceMatrix.count || y > 0.2) return;
      this.m.makeScale(size, 1, size).setPosition(x, 0.013, z);
      this.shadeMesh.setMatrixAt(shade++, this.m);
    };
    for (const s of this.seated) {
      this.baked.draw(s.id, s.look, s.id, s.x, s.y, s.z, s.yaw, s.h, 'sit', 0);
    }
    for (const p of this.people) {
      if (p.gone) continue;
      this.baked.draw(p.id, p.look, p.id, p.x, p.y, p.z, p.yaw, p.h, p.mode, p.cycle);
      shadeAt(p.x, p.y, p.z, 1);
      this.drawLuggage(p);
    }
    this.baked.end();
    this.bags.end();
    this.shadeMesh.count = shade;
    this.shadeMesh.instanceMatrix.needsUpdate = true;
    // New batches of people are made as new cuts of clothes and actions appear: drawn with the rooms
    const mask = 1 << RENDER_LAYERS.INTERIOR;
    this.group.traverse((o) => {
      if (o.layers.mask !== mask) o.layers.set(RENDER_LAYERS.INTERIOR);
    });
  }

  /** A matrix for something at the person's side: `side` to their right, `ahead` in front, turned `turn` from their facing */
  private place(p: Person, side: number, ahead: number, y: number, turn: number, tilt = 0, pivot = 0): THREE.Matrix4 {
    const s = Math.sin(p.yaw);
    const c = Math.cos(p.yaw);
    // The person faces +z turned by yaw: their right is (-cos, sin)... in this hall's terms (x right of +z is -x)
    const x = p.x + s * ahead - c * side;
    const z = p.z + c * ahead + s * side;
    this.e.set(0, p.yaw + turn, 0, 'YXZ');
    this.m.compose(this.v.set(x, p.y + y, z), this.q.setFromEuler(this.e), this.one);
    if (tilt) {
      this.m2.makeTranslation(0, 0, pivot);
      this.m.multiply(this.m2);
      this.m2.makeRotationX(tilt);
      this.m.multiply(this.m2);
      this.m2.makeTranslation(0, 0, -pivot);
      this.m.multiply(this.m2);
    }
    return this.m;
  }

  private drawLuggage(p: Person): void {
    const walking = p.mode === 'walk';
    if (p.trolley) {
      // Pushed in front: the push bar at their hands, the load on the bed
      this.bags.add('trolley', this.place(p, 0, 0.62, 0, 0), 0xffffff);
      let y = 0.2;
      p.load.forEach((b, i) => {
        const ahead = 0.72 + (i === 1 ? 0.04 : 0);
        this.bags.add(b.kind, this.place(p, 0, ahead, y, Math.PI / 2), b.colour);
        y += b.kind === 'ghana' ? 0.4 : b.kind === 'carton' ? 0.4 : 0.26;
      });
      return;
    }
    if (!p.bag) return;
    if (p.bag.kind === 'roller') {
      // Pulled behind and to the side, tipped onto its back wheels toward the hand; standing, upright beside them
      if (walking) this.bags.add('roller', this.place(p, 0.24, -0.88, 0, Math.PI, -0.55, -0.1), p.bag.colour);
      else this.bags.add('roller', this.place(p, 0.36, 0.05, 0, Math.PI / 2), p.bag.colour);
    } else if (p.bag.kind === 'duffel') {
      // On the shoulder strap, at the hip
      this.bags.add('duffel', this.place(p, 0.24, -0.02, 0.62, 0), p.bag.colour);
    }
  }
}

/** The soft round shadow under a person */
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
