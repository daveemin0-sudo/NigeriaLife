import * as THREE from 'three';
import { Builder } from '../world/kit/ArchKit';
import { buildCarBody, carMaterials, CAR_SPECS, type CarSpec } from '../world/vehicles/CarBodyKit';
import { Bodies, type BodySource, type CarBody } from '../world/Bodies';
import { RENDER_LAYERS } from '../interiors/InteriorTypes';
import { BackendService } from '../backend/BackendService';
import { OnlineAccount } from '../online/OnlineAccount';
import { profileKey } from '../backend/Profile';
import { showGameToast } from '../ui/GameToast';
import { esc, naira } from '../ui/kit/html';
import {
  COURSES, courseById, raceGates, raceLength, lapLength, lapTable, pointAt, racers, finishTime, distanceAt,
  believable, prize, placeOf, medalFor, grid, type Course, type Stake, type Run,
} from './RaceRules';

/**
 * Street racing, in the city: the race is chosen on the phone, the arrows on the road lead to the
 * grid, the player stops their own car in the green box beside the street racers, the lights on
 * the gantry go red one by one and then green, and from there it is a real drive: through the
 * traffic, through every checkpoint gate in turn, to the finish. The racers' runs are set by the
 * race's seed (src/racing/RaceRules.ts), the same sums the server does, so where they finish on
 * the road is where they finish in the result. Online the server takes the stake, draws the seed,
 * checks the time and pays the winner; alone the game does.
 */

export type RacePhase = 'idle' | 'going' | 'grid' | 'countdown' | 'racing' | 'done';
export type RaceMode = 'trial' | 'race';

export interface RaceHooks {
  /** Where the course's gates and the racers are put */
  scene: THREE.Object3D;
  /** The player's own car while they are driving it: where it is, which way it faces, how fast */
  car(): { x: number; z: number; yaw: number; speed: number; name: string } | null;
  /** Arrows on the road to a point. False if there is no way there */
  driveTo(name: string, x: number, z: number): boolean;
  stopGuide(): void;
  city(): string;
  /** Indoors, on a flight or a coach: not on the road */
  away(): boolean;
}

export interface RaceResult {
  course: string;
  name: string;
  mode: RaceMode;
  stake: Stake;
  seconds: number;
  place: number;
  field: Array<{ name: string; seconds: number; you?: boolean }>;
  prize: number;
  best: boolean;
  medal: 'gold' | 'silver' | 'bronze' | null;
  refused?: string;
}

interface Racer {
  name: string;
  car: string;
  run: Run;
  lane: number;
  /** Across the road from the line, as driven now, and where they are moving to */
  lat: number;
  want: number;
  mesh: THREE.Group;
  body: CarBody;
  finished: number | null;
}

const BOX = { length: 5.4, width: 2.6, back: 3.0 };
const COUNT = 3;
const JUMP_PENALTY = 2;
const LIGHTS = 5;
/** How far up the road from the start line the gantry of lights stands */
const GANTRY_AHEAD = 16;

const best = () => profileKey('nl_race_best_v1');

/** Minutes, seconds and hundredths: 1:04.27 */
export function raceTime(seconds: number): string {
  const s = Math.max(0, seconds);
  const m = Math.floor(s / 60);
  const rest = s - m * 60;
  return `${m}:${rest.toFixed(2).padStart(5, '0')}`;
}

const ordinal = (n: number) => `${n}${n % 10 === 1 && n % 100 !== 11 ? 'st' : n % 10 === 2 && n % 100 !== 12 ? 'nd' : n % 10 === 3 && n % 100 !== 13 ? 'rd' : 'th'}`;

export class Racing {
  private static instance: Racing | null = null;
  public static get(): Racing {
    if (!Racing.instance) Racing.instance = new Racing();
    return Racing.instance;
  }

  public hooks: RaceHooks | null = null;
  public phase: RacePhase = 'idle';
  public course: Course | null = null;
  public mode: RaceMode = 'trial';
  public stake: Stake = 0;
  /** Told when the race moves on a stage (the phone draws itself again) */
  public onChange: (() => void) | null = null;
  /** The last race's result, for the card and the phone */
  public result: RaceResult | null = null;

  private seed = 1;
  private raceId: string | null = null;
  private table: number[] = [];
  private gates: number[] = [];
  private gateIndex = 0;
  private splits: number[] = [];
  private lastAlong = -Infinity;
  private t = 0;
  private count = 0;
  private penalty = 0;
  private progress = 0;
  private stuckFor = 0;
  private field: Racer[] = [];
  private group: THREE.Group | null = null;
  private lamps: THREE.MeshBasicMaterial[] = [];
  private boxMat: THREE.MeshBasicMaterial | null = null;
  private gateMats: THREE.MeshBasicMaterial[] = [];
  private gateGroups: THREE.Group[] = [];
  private inBox = false;
  private starting = false;
  private source: BodySource;
  private ui: RaceHud;
  private sinceLook = 0;

  private constructor() {
    this.ui = new RaceHud(this);
    this.source = {
      cars: (x, z, range, out) => {
        for (const r of this.field) if (Math.abs(r.body.x - x) < range && Math.abs(r.body.z - z) < range) out.push(r.body);
      },
    };
  }

  // --- What the phone asks ----------------------------------------------------------------------

  /** The courses in a city */
  public coursesIn(city: string): Course[] {
    return COURSES.filter((c) => c.city === city);
  }

  /** The player's best on each course, kept on this device */
  public bests(): Record<string, { seconds: number; car: string; at: number }> {
    try {
      const raw = JSON.parse(localStorage.getItem(best()) || '{}');
      return raw && typeof raw === 'object' ? raw : {};
    } catch {
      return {};
    }
  }

  private keepBest(course: string, seconds: number, car: string): boolean {
    const all = this.bests();
    if (all[course] && all[course].seconds <= seconds) return false;
    all[course] = { seconds, car, at: Date.now() };
    try { localStorage.setItem(best(), JSON.stringify(all)); } catch { /* kept for now */ }
    return true;
  }

  public get active(): boolean {
    return this.phase !== 'idle' && this.phase !== 'done';
  }

  /**
   * Sets a race up: the course built on the road, the racers on the grid, the arrows to it. Nothing
   * is paid until the player is on the grid and starts. Returns why not, or null.
   */
  public begin(courseId: string, mode: RaceMode, stake: Stake): string | null {
    const hooks = this.hooks;
    const course = courseById(courseId);
    if (!hooks || !course) return 'That race is not on.';
    if (this.active) return 'You are in a race already. Give it up first.';
    if (hooks.city() !== course.city) return `${course.name} is raced in ${course.city === 'lagos' ? 'Lagos' : course.city === 'abuja' ? 'Abuja' : 'Port Harcourt'}.`;
    if (hooks.away()) return 'Step outside first: races are on the road.';
    if (mode === 'race' && stake > 0) {
      const d = BackendService.getInstance().getData();
      if (d.walletCash + d.bank.balance < stake) return `The stake is ${naira(stake)} and you do not have it.`;
    }
    this.clear();
    this.course = course;
    this.mode = mode;
    this.stake = mode === 'race' ? stake : 0;
    this.result = null;
    this.table = lapTable(course);
    this.gates = raceGates(course);
    this.seed = 1 + Math.floor(Math.random() * 2_000_000_000);
    this.build(course);
    if (mode === 'race') this.lineUp(course, this.stake, this.seed);
    const start = this.gridPoint();
    const car = hooks.car();
    if (car && Math.hypot(car.x - start.x, car.z - start.z) < 60) this.setPhase('grid');
    else {
      if (!hooks.driveTo(`the start of ${course.name}`, start.x, start.z)) {
        this.clear();
        return 'There is no way to the start by road from here.';
      }
      this.setPhase('going');
    }
    return null;
  }

  /** Off: the stake, once the lights have gone, is lost */
  public giveUp(why = 'You gave up the race.'): void {
    if (this.phase === 'idle') return;
    const paid = this.phase === 'countdown' || this.phase === 'racing';
    showGameToast(`🏁 ${why}${paid && this.stake ? ` The ${naira(this.stake)} stake is lost.` : ''}`, 'info', 4200);
    this.hooks?.stopGuide();
    this.clear();
  }

  /** In the box and stopped: the lights */
  public async startLights(): Promise<void> {
    const course = this.course;
    if (this.phase !== 'grid' || !course || !this.inBox || this.starting) return;
    this.starting = true;
    try {
      const backend = BackendService.getInstance();
      const online = OnlineAccount.get();
      if (online) {
        const done = await online.request('/races/enter', { course: course.id, mode: this.mode, stake: this.stake, idem: `re:${online.id ?? 'x'}:${Date.now()}` }).catch(() => null);
        if (done?.wallet) backend.applyServerWallet(done.wallet);
        if (!done?.ok) {
          showGameToast(done?.reason ?? 'The race could not start. Check your connection.', 'warning', 3600);
          return;
        }
        this.raceId = done.race;
        this.seed = done.seed;
        if (this.stake) backend.settledByServer(() => backend.processTransaction({ type: 'TRANSFER_OUT', amount: this.stake, description: `Race stake: ${course.name}`, source: 'bank', funding: 'split' }));
        if (done.wallet) backend.applyServerWallet(done.wallet);
      } else if (this.stake) {
        const paid = backend.processTransaction({ type: 'TRANSFER_OUT', amount: this.stake, description: `Race stake: ${course.name}`, source: 'bank', funding: 'split' });
        if (!paid.success) {
          showGameToast(`The stake is ${naira(this.stake)} and you do not have it.`, 'warning', 3200);
          return;
        }
      }
      // The racers' runs from the race's own seed
      if (this.mode === 'race') this.lineUp(course, this.stake, this.seed);
      this.count = 0;
      this.penalty = 0;
      this.setPhase('countdown');
    } finally {
      this.starting = false;
    }
  }

  // --- Every frame ------------------------------------------------------------------------------

  public update(delta: number): void {
    const hooks = this.hooks;
    const course = this.course;
    if (!hooks || !course || this.phase === 'idle') return;
    const car = hooks.car();
    // Out of the car, indoors, in another city: the race is off
    if (this.phase !== 'done' && (hooks.away() || hooks.city() !== course.city)) return this.giveUp('You left the road: the race is off.');
    if ((this.phase === 'countdown' || this.phase === 'racing') && !car) return this.giveUp('You got out of the car: the race is off.');

    const start = this.gridPoint();
    if (this.phase === 'going' || this.phase === 'grid') {
      const near = !!car && Math.hypot(car.x - start.x, car.z - start.z) < 70;
      if (near && this.phase === 'going') {
        hooks.stopGuide();
        this.setPhase('grid');
      } else if (!near && this.phase === 'grid' && car && Math.hypot(car.x - start.x, car.z - start.z) > 200) this.setPhase('going');
      this.inBox = !!car && this.boxed(car);
      this.boxMat?.color.setHex(this.inBox ? 0x22c55e : 0xf59e0b);
    }

    if (this.phase === 'countdown') {
      this.count += delta;
      const lit = Math.min(LIGHTS, Math.floor((this.count / COUNT) * LIGHTS) + 1);
      this.lamps.forEach((m, i) => m.color.setHex(this.count >= COUNT ? 0x22c55e : i < lit ? 0xef4444 : 0x1f2937));
      // Over the line before the green: two seconds on the time
      if (car && !this.penalty && this.along(car, 0) > -BOX.back + 2.6) {
        this.penalty = JUMP_PENALTY;
        showGameToast(`🚦 Jump start! ${JUMP_PENALTY} seconds on your time.`, 'warning', 2600);
      }
      if (this.count >= COUNT) {
        this.t = 0;
        this.gateIndex = 0;
        this.splits = [];
        this.lastAlong = car ? this.along(car, this.gates[0]) : -Infinity;
        this.stuckFor = 0;
        this.setPhase('racing');
      }
    }

    if (this.phase === 'racing') {
      this.t += delta;
      if (car) this.checkGates(car, course, delta);
      if (this.count < COUNT + 1.2) {
        this.count += delta;
        if (this.count >= COUNT + 1.2) this.lamps.forEach((m) => m.color.setHex(0x1f2937));
      }
    }
    if (this.phase === 'racing' || this.phase === 'done') this.driveRacers(delta, course, car);
    this.ui.update();
  }

  /** Across the start box, and stopped in it, facing up the course */
  private boxed(car: { x: number; z: number; yaw: number; speed: number }): boolean {
    const course = this.course!;
    const p = pointAt(course, 0, this.table);
    const lane = grid(course).player;
    const rx = -p.dz;
    const rz = p.dx;
    const cx = p.x + rx * lane - p.dx * BOX.back;
    const cz = p.z + rz * lane - p.dz * BOX.back;
    const along = (car.x - cx) * p.dx + (car.z - cz) * p.dz;
    const across = (car.x - cx) * rx + (car.z - cz) * rz;
    const heading = Math.atan2(p.dx, p.dz);
    const off = Math.abs(Math.atan2(Math.sin(car.yaw - heading), Math.cos(car.yaw - heading)));
    return Math.abs(along) < BOX.length / 2 && Math.abs(across) < BOX.width / 2 && off < 0.6 && Math.abs(car.speed) < 0.8;
  }

  /** How far past a point of the race the car is, along the line there (negative before it) */
  private along(car: { x: number; z: number }, s: number): number {
    const p = pointAt(this.course!, s, this.table);
    return (car.x - p.x) * p.dx + (car.z - p.z) * p.dz;
  }

  private checkGates(car: { x: number; z: number; speed: number }, course: Course, delta: number): void {
    const s = this.gates[this.gateIndex];
    const p = pointAt(course, s, this.table);
    const along = (car.x - p.x) * p.dx + (car.z - p.z) * p.dz;
    const across = (car.x - p.x) * -p.dz + (car.z - p.z) * p.dx;
    const crossed = this.lastAlong < 0 && along >= 0 && across > -course.reach[0] - 1.2 && across < course.reach[1] + 1.2;
    this.lastAlong = along;
    // How far along the race the player is: up to the next gate, never back past the last one
    const before = this.gateIndex > 0 ? this.gates[this.gateIndex - 1] : 0;
    const now = Math.max(before, Math.min(s, s + along));
    if (now > this.progress + 0.5) {
      this.progress = now;
      this.stuckFor = 0;
    } else this.stuckFor += delta;
    if (!crossed) return;
    this.splits.push(+(this.t + this.penalty).toFixed(3));
    this.gateIndex += 1;
    this.progress = s;
    this.showGates();
    if (this.gateIndex >= this.gates.length) {
      void this.finish();
      return;
    }
    this.lastAlong = this.along(car, this.gates[this.gateIndex]);
    const total = this.gates.length;
    const lapLen = lapLength(course);
    const lap = Math.min(course.laps, Math.floor(s / lapLen + 0.001) + 1);
    const lapDone = course.laps > 1 && Math.abs(s - lap * lapLen) < 1;
    showGameToast(lapDone ? `🏁 Lap ${lap} of ${course.laps} · ${raceTime(this.t + this.penalty)}` : `✅ Checkpoint ${this.gateIndex} of ${total - 1} · ${raceTime(this.t + this.penalty)}`, 'success', 1600);
  }

  private async finish(): Promise<void> {
    const course = this.course!;
    const seconds = +(this.t + this.penalty).toFixed(3);
    this.setPhase('done');
    const carName = this.hooks?.car()?.name ?? 'a car';
    const others = this.field.map((r) => ({ name: r.name, seconds: +finishTime(r.run).toFixed(3) }));
    let result: RaceResult = {
      course: course.id, name: course.name, mode: this.mode, stake: this.stake, seconds,
      place: placeOf(seconds, others.map((o) => o.seconds)),
      field: [...others, { name: 'You', seconds, you: true }].sort((a, b) => a.seconds - b.seconds),
      prize: 0, best: false, medal: medalFor(course, seconds),
    };
    const backend = BackendService.getInstance();
    const online = OnlineAccount.get();
    if (online && this.raceId) {
      const done = await online.request('/races/finish', { race: this.raceId, seconds, splits: this.splits, car: carName }).catch(() => null);
      if (done?.ok) {
        result.place = done.place;
        result.prize = done.prize ?? 0;
        result.best = !!done.best;
        if (result.prize) backend.settledByServer(() => backend.processTransaction({ type: 'WINNINGS', amount: result.prize, description: `Won the race: ${course.name}`, source: 'wallet' }));
        if (done.wallet) backend.applyServerWallet(done.wallet);
        this.keepBest(course.id, seconds, carName);
      } else {
        if (done?.wallet) backend.applyServerWallet(done.wallet);
        result = { ...result, refused: done?.reason ?? 'The time could not be sent.' };
      }
    } else {
      const doubt = believable(course, seconds, this.splits);
      if (doubt) result = { ...result, refused: doubt, place: result.place };
      else {
        result.prize = this.mode === 'race' ? prize(this.stake, result.place, this.field.length + 1) : 0;
        if (result.prize) backend.processTransaction({ type: 'WINNINGS', amount: result.prize, description: `Won the race: ${course.name}`, source: 'wallet' });
        result.best = this.keepBest(course.id, seconds, carName);
      }
    }
    this.result = result;
    this.ui.showResult(result);
    this.onChange?.();
  }

  // --- The street racers ------------------------------------------------------------------------

  private lineUp(course: Course, stake: Stake, seed: number): void {
    for (const r of this.field) r.mesh.removeFromParent();
    Bodies.remove(this.source);
    this.field = racers(course, stake, seed).map((r) => {
      const base = CAR_SPECS[r.car] ?? CAR_SPECS.sedan;
      const spec = { ...base, paint: r.paint } as CarSpec;
      const mesh = buildCarBody(spec, carMaterials(r.paint), 'light');
      mesh.name = `racer ${r.name}`;
      mesh.traverse((o) => o.layers.set(RENDER_LAYERS.STREET));
      this.group?.add(mesh);
      const half = { w: (spec.width ?? 1.9) / 2, l: (spec.length ?? 4.6) / 2 };
      return { name: r.name, car: r.car, run: r.run, lane: r.lane, lat: r.lane, want: r.lane, mesh, body: { x: 0, z: 0, yaw: 0, halfWidth: half.w, halfLength: half.l }, finished: null };
    });
    Bodies.add(this.source);
    this.placeRacers(0);
  }

  /** Each racer where their run has them, in their lane, moving over for what is ahead of them */
  private driveRacers(delta: number, course: Course, car: { x: number; z: number } | null): void {
    this.sinceLook += delta;
    const look = this.sinceLook > 0.25;
    if (look) this.sinceLook = 0;
    const length = raceLength(course);
    for (const r of this.field) {
      let s = distanceAt(r.run, this.t);
      // Past the finish they ease off and pull up
      const done = finishTime(r.run);
      if (this.t > done) {
        const v = 2 / Math.max(1e-3, r.run.times[r.run.times.length - 1] - r.run.times[r.run.times.length - 3]);
        s = length + v * 3 * (1 - Math.exp(-(this.t - done) / 3));
      }
      const p = this.pointPast(course, s, length);
      // Single file round a U-turn; their lanes again after it
      const turning = !!pointAt(course, Math.min(s + 25, length), this.table).limit || !!p.limit;
      if (look && !turning) r.want = this.freeLane(course, r, p, car);
      const target = turning ? 0 : r.want;
      r.lat += Math.max(-2.6 * delta, Math.min(2.6 * delta, target - r.lat));
      this.put(r, p, r.lat);
    }
  }

  /** A point on the line, carrying on straight past the finish */
  private pointPast(course: Course, s: number, length: number) {
    if (s <= length) return pointAt(course, s, this.table);
    const end = pointAt(course, length, this.table);
    return { ...end, x: end.x + end.dx * (s - length), z: end.z + end.dz * (s - length), limit: null };
  }

  private put(r: Racer, p: { x: number; z: number; dx: number; dz: number }, lat: number): void {
    const x = p.x - p.dz * lat;
    const z = p.z + p.dx * lat;
    const yaw = Math.atan2(p.dx, p.dz);
    r.mesh.position.set(x, 0, z);
    r.mesh.rotation.y = yaw;
    r.body.x = x;
    r.body.z = z;
    r.body.yaw = yaw;
  }

  private placeRacers(s: number): void {
    const course = this.course;
    if (!course) return;
    const p = pointAt(course, s, this.table);
    for (const r of this.field) {
      const at = { ...p, x: p.x - p.dx * BOX.back, z: p.z - p.dz * BOX.back };
      this.put(r, at, r.lane);
    }
  }

  /** The lane to be in: their own if it is clear for the next stretch, else the nearest clear one */
  private freeLane(course: Course, me: Racer, p: { x: number; z: number; dx: number; dz: number }, car: { x: number; z: number } | null): number {
    const x = me.body.x;
    const z = me.body.z;
    const ahead: Array<{ along: number; across: number }> = [];
    const note = (ox: number, oz: number) => {
      const along = (ox - x) * p.dx + (oz - z) * p.dz;
      if (along > 1 && along < 30) ahead.push({ along, across: (ox - p.x) * -p.dz + (oz - p.z) * p.dx });
    };
    for (const c of Bodies.carsNear(x, z, 34)) if (c !== me.body) note(c.x, c.z);
    if (car) note(car.x, car.z);
    const clear = (lane: number) => !ahead.some((a) => Math.abs(a.across - lane) < 1.9);
    if (clear(me.want)) return me.want;
    const order = [...course.lanes].sort((a, b) => Math.abs(a - me.lat) - Math.abs(b - me.lat));
    return order.find(clear) ?? me.want;
  }

  // --- On the road: the grid, the gantry, the gates -------------------------------------------------

  private gridPoint(): { x: number; z: number } {
    const course = this.course!;
    const p = pointAt(course, 0, this.table);
    const lane = grid(course).player;
    return { x: p.x - p.dz * lane - p.dx * (BOX.back + 30), z: p.z + p.dx * lane - p.dz * (BOX.back + 30) };
  }

  private build(course: Course): void {
    const hooks = this.hooks!;
    const group = new THREE.Group();
    group.name = 'race course';
    this.group = group;
    const p0 = pointAt(course, 0, this.table);
    const yaw0 = Math.atan2(p0.dx, p0.dz);
    const right = (p: { dx: number; dz: number }) => ({ x: -p.dz, z: p.dx });
    // The grid: a white box for each car, the player's filled amber until they are stopped in it
    const g = grid(course);
    const lines = new Builder();
    for (const lane of [g.player, ...g.rivals]) {
      const r = right(p0);
      const cx = p0.x + r.x * lane - p0.dx * BOX.back;
      const cz = p0.z + r.z * lane - p0.dz * BOX.back;
      const local = (a: number, c: number) => ({ x: cx + p0.dx * a + r.x * c, z: cz + p0.dz * a + r.z * c });
      for (const side of [-1, 1]) {
        const q = local(0, side * BOX.width / 2);
        lines.box(0xffffff, 0.12, 0.02, BOX.length, q.x, 0.03, q.z, { yaw: yaw0 });
        const e = local(side * BOX.length / 2, 0);
        lines.box(0xffffff, BOX.width, 0.02, 0.12, e.x, 0.03, e.z, { yaw: yaw0 });
      }
      if (lane === g.player) {
        this.boxMat = new THREE.MeshBasicMaterial({ color: 0xf59e0b, transparent: true, opacity: 0.4, depthWrite: false });
        const fill = new THREE.Mesh(new THREE.PlaneGeometry(BOX.width - 0.2, BOX.length - 0.2), this.boxMat);
        fill.rotation.order = 'YXZ';
        fill.rotation.set(-Math.PI / 2, yaw0, 0);
        fill.position.set(cx, 0.035, cz);
        fill.name = 'race box';
        group.add(fill);
      }
    }
    group.add(lines.build('race grid'));
    // The start line, chequered across the carriageway (a circuit's is its finish line), and the gantry of lights over it
    if (course.kind !== 'circuit') group.add(this.banner(course, 0, 'START', 'start'));
    // The lights stand a little way up the road, where a driver in the box sees them over the bonnet
    const pg = pointAt(course, GANTRY_AHEAD, this.table);
    const gantry = new Builder();
    const r0 = right(pg);
    for (const c of [-course.reach[0], course.reach[1]]) gantry.box(0x1f2937, 0.3, 6.6, 0.3, pg.x + r0.x * c, 0, pg.z + r0.z * c);
    group.add(gantry.build('race gantry'));
    this.lamps = [];
    const span = course.reach[0] + course.reach[1];
    const mid = (course.reach[1] - course.reach[0]) / 2;
    const plate = new THREE.Mesh(new THREE.BoxGeometry(span, 1.3, 0.3), new THREE.MeshStandardMaterial({ color: 0x0b0f17, roughness: 0.5 }));
    plate.position.set(pg.x + r0.x * mid, 5.9, pg.z + r0.z * mid);
    plate.rotation.y = yaw0;
    group.add(plate);
    for (let i = 0; i < LIGHTS; i++) {
      const m = new THREE.MeshBasicMaterial({ color: 0x1f2937, toneMapped: false });
      this.lamps.push(m);
      const lamp = new THREE.Mesh(new THREE.CircleGeometry(0.42, 24), m);
      const c = mid + (i - (LIGHTS - 1) / 2) * 1.05;
      lamp.position.set(pg.x + r0.x * c - pg.dx * 0.17, 5.9, pg.z + r0.z * c - pg.dz * 0.17);
      lamp.rotation.y = yaw0 + Math.PI;
      group.add(lamp);
    }
    // A gate at each checkpoint of a lap; the finish chequered
    this.gateMats = [];
    this.gateGroups = [];
    const lapLen = lapLength(course);
    course.gates.forEach((s, i) => {
      const last = i === course.gates.length - 1;
      const gate = this.banner(course, Math.min(lapLen, s), last ? 'FINISH' : `CHECKPOINT ${i + 1}`, last ? 'finish' : 'gate');
      this.gateGroups.push(gate);
      group.add(gate);
    });
    group.traverse((o) => o.layers.set(RENDER_LAYERS.STREET));
    hooks.scene.add(group);
    this.showGates();
  }

  /** Two posts at the edges of the carriageway and a banner across between them, facing the drivers coming */
  private banner(course: Course, s: number, words: string, kind: 'start' | 'gate' | 'finish'): THREE.Group {
    const p = pointAt(course, s, this.table);
    const yaw = Math.atan2(p.dx, p.dz);
    const r = { x: -p.dz, z: p.dx };
    const group = new THREE.Group();
    group.name = `race ${words.toLowerCase()}`;
    const span = course.reach[0] + course.reach[1];
    const mid = (course.reach[1] - course.reach[0]) / 2;
    if (kind === 'start') {
      // Painted on the road
      const line = new THREE.Mesh(new THREE.PlaneGeometry(span, 1.2), new THREE.MeshBasicMaterial({ map: chequer(), transparent: true, opacity: 0.92, depthWrite: false }));
      line.rotation.order = 'YXZ';
      line.rotation.set(-Math.PI / 2, yaw, 0);
      line.position.set(p.x + r.x * mid, 0.04, p.z + r.z * mid);
      group.add(line);
      return group;
    }
    const posts = new Builder();
    for (const c of [-course.reach[0], course.reach[1]]) posts.box(kind === 'finish' ? 0xf8fafc : 0x0b7a43, 0.28, 6.6, 0.28, p.x + r.x * c, 0, p.z + r.z * c);
    group.add(posts.build('race posts'));
    const material = new THREE.MeshBasicMaterial({ map: kind === 'finish' ? finishCloth() : gateCloth(words), toneMapped: false, transparent: true });
    this.gateMats.push(material);
    const cloth = new THREE.Mesh(new THREE.PlaneGeometry(span, 1.5), material);
    cloth.position.set(p.x + r.x * mid, 5.75, p.z + r.z * mid);
    // Facing the drivers coming up to it
    cloth.rotation.y = yaw + Math.PI;
    group.add(cloth);
    if (kind === 'finish') {
      const line = new THREE.Mesh(new THREE.PlaneGeometry(span, 1.2), new THREE.MeshBasicMaterial({ map: chequer(), transparent: true, opacity: 0.92, depthWrite: false }));
      line.rotation.order = 'YXZ';
      line.rotation.set(-Math.PI / 2, yaw, 0);
      line.position.set(p.x + r.x * mid, 0.04, p.z + r.z * mid);
      group.add(line);
    }
    return group;
  }

  /** The next gate bright, the ones after it faint, the ones passed gone */
  private showGates(): void {
    const course = this.course;
    if (!course) return;
    const per = course.gates.length;
    const next = this.gateIndex % per;
    const lapsLeft = course.laps - Math.floor(this.gateIndex / per);
    this.gateGroups.forEach((g, i) => {
      const passed = this.phase === 'racing' && lapsLeft <= 1 && i < next && this.gateIndex < this.gates.length;
      g.visible = !passed;
      const m = this.gateMats[i];
      if (m) {
        m.opacity = i === next || this.phase !== 'racing' ? 1 : 0.45;
        m.color.setHex(i === next || this.phase !== 'racing' ? 0xffffff : 0x9ca3af);
      }
    });
  }

  private setPhase(phase: RacePhase): void {
    this.phase = phase;
    if (phase === 'racing' || phase === 'grid' || phase === 'going') this.showGates();
    this.ui.update();
    this.onChange?.();
  }

  /** Everything put on the road for the race taken away */
  public clear(): void {
    Bodies.remove(this.source);
    this.field = [];
    if (this.group) {
      this.group.removeFromParent();
      this.group.traverse((o) => {
        const mesh = o as THREE.Mesh;
        mesh.geometry?.dispose();
        const mat = mesh.material as THREE.Material | THREE.Material[] | undefined;
        for (const m of Array.isArray(mat) ? mat : mat ? [mat] : []) {
          (m as THREE.MeshBasicMaterial).map?.dispose();
          m.dispose();
        }
      });
    }
    this.group = null;
    this.lamps = [];
    this.gateMats = [];
    this.gateGroups = [];
    this.boxMat = null;
    this.phase = 'idle';
    this.course = null;
    this.raceId = null;
    this.progress = 0;
    this.gateIndex = 0;
    this.splits = [];
    this.t = 0;
    this.inBox = false;
    this.ui.update();
    this.onChange?.();
  }

  // --- What the HUD shows --------------------------------------------------------------------------

  public view(): {
    phase: RacePhase; course: Course | null; time: number; gate: number; gates: number; lap: number; laps: number;
    place: number; field: number; inBox: boolean; best: number | null; count: number; mode: RaceMode; stake: Stake; off: boolean;
  } {
    const course = this.course;
    const per = course?.gates.length ?? 1;
    const lap = course ? Math.min(course.laps, Math.floor(this.gateIndex / per) + 1) : 1;
    const others = this.field.map((r) => distanceAt(r.run, this.t));
    const place = 1 + others.filter((s) => s > this.progress + 0.5).length;
    return {
      phase: this.phase, course, time: this.t + this.penalty, gate: Math.min(this.gates.length, this.gateIndex + 1), gates: this.gates.length,
      lap, laps: course?.laps ?? 1, place, field: this.field.length + 1, inBox: this.inBox,
      best: course ? this.bests()[course.id]?.seconds ?? null : null, count: this.count, mode: this.mode, stake: this.stake,
      off: this.phase === 'racing' && this.stuckFor > 20,
    };
  }

  /** The line of the race ahead, for the round map in the corner */
  public lineAhead(): Array<{ x: number; z: number }> | null {
    const course = this.course;
    if (!course || (this.phase !== 'racing' && this.phase !== 'grid' && this.phase !== 'countdown')) return null;
    const out: Array<{ x: number; z: number }> = [];
    const length = raceLength(course);
    for (let s = this.progress; s <= Math.min(length, this.progress + 260); s += 8) out.push(pointAt(course, s, this.table));
    return out;
  }
}

// --- The banners' cloth ------------------------------------------------------------------------------

function canvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D | null] {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return [c, c.getContext('2d')];
}

function chequer(): THREE.Texture {
  const [c, g] = canvas(256, 32);
  if (g) for (let x = 0; x < 16; x++) for (let y = 0; y < 2; y++) {
    g.fillStyle = (x + y) % 2 ? '#111827' : '#f8fafc';
    g.fillRect(x * 16, y * 16, 16, 16);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function gateCloth(words: string): THREE.Texture {
  const [c, g] = canvas(512, 96);
  if (g) {
    const grad = g.createLinearGradient(0, 0, 0, 96);
    grad.addColorStop(0, '#0b7a43');
    grad.addColorStop(1, '#065f46');
    g.fillStyle = grad;
    g.fillRect(0, 0, 512, 96);
    g.fillStyle = '#facc15';
    g.fillRect(0, 0, 512, 6);
    g.fillRect(0, 90, 512, 6);
    g.fillStyle = '#ffffff';
    g.font = '900 46px system-ui, sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(words, 256, 50);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function finishCloth(): THREE.Texture {
  const [c, g] = canvas(512, 96);
  if (g) {
    for (let x = 0; x < 32; x++) for (let y = 0; y < 6; y++) {
      g.fillStyle = (x + y) % 2 ? '#111827' : '#f8fafc';
      g.fillRect(x * 16, y * 16, 16, 16);
    }
    g.fillStyle = 'rgba(17,24,39,0.82)';
    g.fillRect(150, 14, 212, 68);
    g.fillStyle = '#facc15';
    g.font = '900 48px system-ui, sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText('FINISH', 256, 50);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// --- The race on the screen ------------------------------------------------------------------------

class RaceHud {
  private readonly racing: Racing;
  private readonly panel: HTMLDivElement;
  private readonly count: HTMLDivElement;
  private readonly card: HTMLDivElement;
  private shown = '';
  private timeEl: HTMLElement | null = null;
  private placeEl: HTMLElement | null = null;
  private sayEl: HTMLElement | null = null;

  constructor(racing: Racing) {
    this.racing = racing;
    this.panel = document.createElement('div');
    this.panel.id = 'nl-race';
    this.panel.className = 'nl-race';
    this.panel.hidden = true;
    this.panel.addEventListener('click', (e) => {
      const act = (e.target as HTMLElement).closest<HTMLElement>('[data-race]')?.dataset.race;
      e.stopPropagation();
      if (act === 'start') void this.racing.startLights();
      if (act === 'quit') this.racing.giveUp();
    });
    this.count = document.createElement('div');
    this.count.id = 'nl-race-count';
    this.count.className = 'nl-race-count';
    this.count.hidden = true;
    this.card = document.createElement('div');
    this.card.id = 'nl-race-result';
    this.card.className = 'nl-race-result';
    this.card.hidden = true;
    this.card.addEventListener('click', (e) => {
      const act = (e.target as HTMLElement).closest<HTMLElement>('[data-race]')?.dataset.race;
      e.stopPropagation();
      if (act === 'again') {
        const r = this.racing.result;
        this.card.hidden = true;
        this.racing.clear();
        if (r) {
          const why = this.racing.begin(r.course, r.mode, r.stake);
          if (why) showGameToast(why, 'warning', 3200);
        }
      }
      if (act === 'close') {
        this.card.hidden = true;
        this.racing.clear();
      }
    });
    document.body.append(this.panel, this.count, this.card);
  }

  public update(): void {
    const v = this.racing.view();
    const c = v.course;
    if (!c || v.phase === 'idle') {
      this.panel.hidden = true;
      this.count.hidden = true;
      this.shown = '';
      return;
    }
    this.panel.hidden = v.phase === 'done';
    // The lights: three, two, one, GO
    const counting = v.phase === 'countdown' || (v.phase === 'racing' && v.count < COUNT + 1.2);
    this.count.hidden = !counting;
    if (counting) {
      const left = COUNT - v.count;
      const text = left > 0 ? String(Math.ceil(left)) : 'GO!';
      if (this.count.textContent !== text) {
        this.count.textContent = text;
        this.count.classList.toggle('is-go', left <= 0);
        this.count.classList.remove('is-pop');
        void this.count.offsetWidth;
        this.count.classList.add('is-pop');
      }
    }
    // The panel is drawn once for each stage (so its buttons stay put under a finger); its words change in place
    const ready = v.phase === 'grid' && v.inBox;
    const key = `${c.id}|${v.phase}|${ready}|${v.mode}`;
    if (key !== this.shown) {
      this.shown = key;
      if (v.phase === 'going' || v.phase === 'grid') {
        this.panel.innerHTML = `<div class="nl-race-head"><span class="nl-race-name">🏁 ${esc(c.name)}</span><span class="nl-race-tag">${v.mode === 'race' ? (v.stake ? `${naira(v.stake)} each` : 'For glory') : 'Time trial'}</span></div>
          <div class="nl-race-say" data-race-say></div>
          <div class="nl-race-row"><button class="nl-race-btn" data-race="quit">Give up</button><button class="nl-race-btn is-go" data-race="start" ${ready ? '' : 'disabled'}>Start</button></div>`;
      } else {
        this.panel.innerHTML = `<div class="nl-race-head"><span class="nl-race-time" data-race-time></span>${v.mode === 'race' ? '<span class="nl-race-place" data-race-place></span>' : ''}</div>
          <div class="nl-race-say" data-race-say></div>
          <div class="nl-race-row"><button class="nl-race-btn" data-race="quit">Give up</button></div>`;
      }
      this.timeEl = this.panel.querySelector('[data-race-time]');
      this.placeEl = this.panel.querySelector('[data-race-place]');
      this.sayEl = this.panel.querySelector('[data-race-say]');
    }
    const say = v.phase === 'going' ? 'Follow the arrows to the start.'
      : v.phase === 'grid' ? (ready ? 'In the box. Start when you are ready.' : 'Stop your car in the amber box on the grid.')
      : v.phase === 'countdown' ? 'Wait for the green.'
      : v.off ? 'The race is the other way: back to the gates.'
      : `Checkpoint ${Math.min(v.gate, v.gates)} of ${v.gates}${v.laps > 1 ? ` · Lap ${v.lap} of ${v.laps}` : ''}${v.best ? ` · Best ${raceTime(v.best)}` : ''}`;
    if (this.sayEl && this.sayEl.textContent !== say) this.sayEl.textContent = say;
    if (this.timeEl) this.timeEl.textContent = raceTime(v.time);
    if (this.placeEl) {
      const place = `${ordinal(v.place)} of ${v.field}`;
      if (this.placeEl.textContent !== place) this.placeEl.textContent = place;
    }
  }

  public showResult(r: RaceResult): void {
    const medal = r.medal === 'gold' ? '🥇' : r.medal === 'silver' ? '🥈' : r.medal === 'bronze' ? '🥉' : '';
    const head = r.refused ? 'The time was not counted' : r.mode === 'race' ? (r.place === 1 ? 'You won!' : `You came ${ordinal(r.place)}`) : 'Time trial done';
    this.card.innerHTML = `
      <div class="nl-race-card" role="dialog" aria-label="Race result">
        <div class="nl-race-card-top"><span class="nl-race-card-flag">${r.place === 1 && !r.refused ? '🏆' : '🏁'}</span><span><b>${esc(head)}</b><small>${esc(r.name)}</small></span></div>
        <div class="nl-race-card-time">${raceTime(r.seconds)} ${medal}</div>
        ${r.refused ? `<div class="nl-race-card-note is-bad">${esc(r.refused)}</div>` : ''}
        ${r.best && !r.refused ? '<div class="nl-race-card-note is-good">A new best on this course</div>' : ''}
        ${r.prize ? `<div class="nl-race-card-note is-good">${naira(r.prize)} won</div>` : r.mode === 'race' && r.stake && !r.refused ? `<div class="nl-race-card-note">${naira(r.stake)} stake lost</div>` : ''}
        ${r.field.length > 1 ? `<ol class="nl-race-card-field">${r.field.map((f) => `<li class="${f.you ? 'is-you' : ''}"><span>${esc(f.name)}</span><b>${raceTime(f.seconds)}</b></li>`).join('')}</ol>` : ''}
        <div class="nl-race-row"><button class="nl-race-btn" data-race="close">Done</button><button class="nl-race-btn is-go" data-race="again">Race again</button></div>
      </div>`;
    this.card.hidden = false;
  }
}
