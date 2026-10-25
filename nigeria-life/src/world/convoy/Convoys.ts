import * as THREE from 'three';
import { Builder } from '../kit/ArchKit';
import { buildKitCar } from '../vehicles/KitCar';
import { profileKey } from '../../backend/Profile';

/**
 * Convoys: the governor's, down the expressway at its hours with outriders, a patrol van, the
 * black jeep with the flag, escort jeeps and an ambulance, sirens going and the traffic pulling
 * aside for it; and the player's own, a police escort or a full convoy hired at the Police
 * Command, following behind whenever the player drives.
 */

type VehicleKind = 'bike' | 'patrol' | 'principal' | 'jeep' | 'ambulance';

interface ConvoyCar {
  kind: VehicleKind;
  group: THREE.Group;
  length: number;
}

/** Lamps that flash red and blue */
const FLASH_RED = new THREE.MeshBasicMaterial({ color: 0xef4444 });
const FLASH_BLUE = new THREE.MeshBasicMaterial({ color: 0x3b82f6 });

function lightBar(group: THREE.Group, y: number, z = 0, width = 1.2): void {
  const red = new THREE.Mesh(new THREE.BoxGeometry(width / 2, 0.14, 0.24), FLASH_RED);
  const blue = new THREE.Mesh(new THREE.BoxGeometry(width / 2, 0.14, 0.24), FLASH_BLUE);
  red.position.set(-width / 4, y, z);
  blue.position.set(width / 4, y, z);
  group.add(red, blue);
}

function convoyCar(kind: VehicleKind): ConvoyCar {
  if (kind === 'bike') {
    // A police outrider: a white bike, its rider in blue with a white helmet, a blue lamp behind
    const b = new Builder();
    b.box(0x111111, 0.12, 0.62, 0.62, 0, 0, 0.75).box(0x111111, 0.12, 0.62, 0.62, 0, 0, -0.75);
    b.box(0xf8fafc, 0.42, 0.45, 1.5, 0, 0.45, 0).box(0x1e293b, 0.3, 0.12, 0.7, 0, 0.9, -0.15);
    b.box(0x1e3a8a, 0.42, 0.7, 0.32, 0, 1.0, -0.15).box(0xf8fafc, 0.3, 0.3, 0.32, 0, 1.72, -0.12);
    const group = b.build('outrider');
    lightBar(group, 1.05, -0.8, 0.36);
    return { kind, group, length: 2 };
  }
  const spec = kind === 'principal' ? 'cullinan' : kind === 'jeep' ? 'lexus_rx' : 'highlander';
  const paint = kind === 'patrol' ? 0x1e3a8a : kind === 'ambulance' ? 0xf8fafc : 0x0a0a0a;
  const car = buildKitCar(spec, paint, { light: true });
  const group = car.group;
  if (kind === 'patrol' || kind === 'ambulance') lightBar(group, car.spec.roof + 0.08, (car.spec.screenTop + car.spec.backTop) / 2);
  if (kind === 'ambulance') {
    const band = new THREE.Mesh(new THREE.BoxGeometry(car.spec.width + 0.02, 0.18, car.spec.length * 0.8), new THREE.MeshStandardMaterial({ color: 0xdc2626 }));
    band.position.y = car.spec.belt - 0.15;
    group.add(band);
  }
  if (kind === 'principal') {
    // The flag on the front wing: green, white, green
    const b = new Builder();
    b.cylinder(0xd1d5db, 0.015, 0.6, car.spec.width / 2 - 0.15, car.spec.noseTop, car.spec.length / 2 - 0.5);
    for (let i = 0; i < 3; i++) b.box(i === 1 ? 0xf8fafc : 0x15803d, 0.02, 0.22, 0.1, car.spec.width / 2 - 0.15, car.spec.noseTop + 0.36, car.spec.length / 2 - 0.62 - i * 0.1);
    group.add(b.build('flag'));
  }
  return { kind, group, length: car.spec.length };
}

/** A point on the road, which way it faces, and which way along the expressway it is going */
interface Pose {
  x: number;
  z: number;
  yaw: number;
}

/** What the convoys need from the game each frame */
export interface ConvoyWorld {
  hour: number;
  day: number;
  /** Where the player is, and if they are driving, their vehicle's heading */
  player: THREE.Vector3;
  driving: { x: number; z: number; yaw: number } | null;
  inLagos: boolean;
}

/** The governor's runs: out to Government House in the morning, back to the island in the evening */
const RUNS = [
  { hour: 7.5, from: 60, to: 3960, x: -1.8 },
  { hour: 17.5, from: 3960, to: 60, x: 1.8 },
];
const NPC_SPEED = 25;
const GAP = 4;

class GovernorConvoy {
  public readonly group = new THREE.Group();
  public readonly cars: ConvoyCar[];
  /** The run under way, and how far along it the front is */
  public run: (typeof RUNS)[number] | null = null;
  public head = 0;
  public speed = NPC_SPEED;
  public blocked = false;

  constructor() {
    this.group.name = 'governor convoy';
    this.cars = (['bike', 'bike', 'patrol', 'principal', 'jeep', 'jeep', 'ambulance'] as VehicleKind[]).map((k) => convoyCar(k));
    for (const car of this.cars) this.group.add(car.group);
    this.group.visible = false;
  }

  public start(index: number): void {
    this.run = RUNS[index];
    this.head = this.run.from;
    this.speed = NPC_SPEED;
    this.group.visible = true;
  }

  public get dir(): 1 | -1 {
    return this.run && this.run.to < this.run.from ? -1 : 1;
  }

  /** Moves the convoy on; stops behind the player if they are in its way. Returns the front's pose, or null when it has arrived. */
  public update(delta: number, world: ConvoyWorld): Pose | null {
    if (!this.run) return null;
    const dir = this.dir;
    const x = this.run.x;
    // Somebody in the way: it slows and stops behind them, sirens going
    const ahead = (world.player.z - this.head) * dir;
    const inLane = Math.abs(world.player.x - x) < 2.2 && ahead > -2 && ahead < 70;
    // Braking to stand about seven metres behind whoever it is, half their vehicle and a gap
    const room = ahead - 7;
    const want = inLane ? (room <= 0 ? 0 : Math.min(NPC_SPEED, Math.sqrt(2 * 9 * room))) : NPC_SPEED;
    this.blocked = inLane && ahead < 30;
    this.speed += THREE.MathUtils.clamp(want - this.speed, -20 * delta, 6 * delta);
    this.head += dir * this.speed * delta;
    let back = 0;
    for (const car of this.cars) {
      const z = this.head - dir * (back + car.length / 2);
      car.group.position.set(x, 0, z);
      car.group.rotation.y = dir > 0 ? 0 : Math.PI;
      back += car.length + GAP;
    }
    if ((this.head - this.run.to) * dir > back) {
      this.run = null;
      this.group.visible = false;
      return null;
    }
    return { x, z: this.head, yaw: dir > 0 ? 0 : Math.PI };
  }
}

export type EscortLevel = 'escort' | 'convoy';
export const ESCORTS: Record<EscortLevel, { name: string; price: number; days: number; vehicles: VehicleKind[]; blurb: string }> = {
  escort: { name: 'A police escort', price: 450_000, days: 3, vehicles: ['patrol'], blurb: 'A patrol van behind you, lights and siren, for three days.' },
  convoy: { name: 'A full convoy', price: 3_600_000, days: 3, vehicles: ['bike', 'bike', 'patrol', 'jeep', 'jeep'], blurb: 'Two outriders, a patrol van and two black escort jeeps, for three days.' },
};

/** The player's own convoy, hired, following their vehicle along the way it has come */
class Escort {
  public readonly group = new THREE.Group();
  public cars: ConvoyCar[] = [];
  public level: EscortLevel | null = null;
  public until = -1;
  private trail: Array<{ x: number; z: number }> = [];
  private readonly key = profileKey('nigeria_life_escort_v1');

  constructor() {
    this.group.name = 'my convoy';
    this.group.visible = false;
    try {
      const saved = JSON.parse(localStorage.getItem(this.key) || 'null') as { level: EscortLevel; until: number } | null;
      if (saved && ESCORTS[saved.level]) this.set(saved.level, saved.until);
    } catch {
      // None hired
    }
  }

  public set(level: EscortLevel | null, until: number): void {
    for (const car of this.cars) this.group.remove(car.group);
    this.level = level;
    this.until = until;
    this.cars = level ? ESCORTS[level].vehicles.map((k) => convoyCar(k)) : [];
    for (const car of this.cars) this.group.add(car.group);
    try {
      localStorage.setItem(this.key, JSON.stringify(level ? { level, until } : null));
    } catch {
      // Kept for this visit
    }
  }

  public active(day: number): boolean {
    return !!this.level && day <= this.until;
  }

  /** Follows the driven vehicle; returns the siren's pose (at the player) while it is with them */
  public update(world: ConvoyWorld): Pose | null {
    if (!this.active(world.day) || !world.inLagos) {
      this.group.visible = false;
      this.trail = [];
      return null;
    }
    if (!world.driving) {
      // Pulled up where they were; out of sight once the player is far from them
      const first = this.cars[0]?.group.position;
      this.group.visible = !!first && this.group.visible && first.distanceTo(world.player) < 80;
      return null;
    }
    const d = world.driving;
    const last = this.trail[this.trail.length - 1];
    if (!last || Math.hypot(d.x - last.x, d.z - last.z) > 0.5) this.trail.push({ x: d.x, z: d.z });
    if (this.trail.length > 240) this.trail.shift();
    this.group.visible = true;
    // Each one at its distance back along the way the player has come
    let back = 4.5;
    for (const car of this.cars) {
      back += car.length / 2 + 2;
      const at = this.along(back, d);
      car.group.position.set(at.x, 0, at.z);
      car.group.rotation.y = at.yaw;
      back += car.length / 2 + 2;
    }
    return { x: d.x, z: d.z, yaw: d.yaw };
  }

  /** The point that far back along the trail, and which way the road runs there */
  private along(distance: number, d: { x: number; z: number; yaw: number }): Pose {
    let left = distance;
    let ax = d.x;
    let az = d.z;
    for (let i = this.trail.length - 1; i >= 0; i--) {
      const p = this.trail[i];
      const step = Math.hypot(ax - p.x, az - p.z);
      if (step >= left && step > 0) {
        const t = left / step;
        return { x: ax + (p.x - ax) * t, z: az + (p.z - az) * t, yaw: Math.atan2(ax - p.x, az - p.z) };
      }
      left -= step;
      ax = p.x;
      az = p.z;
    }
    // Not that far yet: lined up straight behind
    return { x: ax - Math.sin(d.yaw) * left, z: az - Math.cos(d.yaw) * left, yaw: d.yaw };
  }
}

export class Convoys {
  public readonly group = new THREE.Group();
  public readonly governor = new GovernorConvoy();
  public readonly escort = new Escort();
  /** Where each siren is this frame, for the traffic to pull aside */
  public sirens: Array<{ x: number; z: number; dir: 1 | -1 }> = [];
  /** Told something to say to the player */
  public say: (text: string) => void = () => {};
  /** Plays a siren, as loud as given */
  public siren: (level: number) => void = () => {};
  private lastHour: number | null = null;
  private wail = 0;
  private flash = 0;
  private warned = false;

  constructor() {
    this.group.name = 'convoys';
    this.group.add(this.governor.group, this.escort.group);
  }

  public update(delta: number, world: ConvoyWorld): void {
    // The governor sets out at the hours of the runs
    if (this.lastHour !== null && world.inLagos && !this.governor.run) {
      RUNS.forEach((run, i) => {
        if (this.lastHour! < run.hour && world.hour >= run.hour) {
          this.governor.start(i);
          if (Math.abs(world.player.x) < 30) this.say('🚨 Sirens! The Governor’s convoy is coming down the expressway. Clear the road.');
        }
      });
    }
    this.lastHour = world.hour;

    this.sirens = [];
    const poses: Pose[] = [];
    const npc = world.inLagos ? this.governor.update(delta, world) : null;
    if (npc) {
      this.sirens.push({ x: npc.x, z: npc.z, dir: this.governor.dir });
      poses.push(npc);
      if (this.governor.blocked && !this.warned) {
        this.warned = true;
        this.say('🚨 The Governor’s convoy is right behind you. Pull aside and let it pass!');
      }
      if (!this.governor.blocked) this.warned = false;
    }
    const mine = this.escort.update(world);
    if (mine) {
      const along = Math.cos(mine.yaw);
      if (Math.abs(along) > 0.7) this.sirens.push({ x: mine.x, z: mine.z, dir: along > 0 ? 1 : -1 });
      poses.push(mine);
    }

    // Lights flashing, and the siren as loud as the nearest convoy is near
    this.flash += delta;
    const red = Math.floor(this.flash * 4) % 2 === 0;
    FLASH_RED.color.setHex(red ? 0xef4444 : 0x450a0a);
    FLASH_BLUE.color.setHex(red ? 0x172554 : 0x3b82f6);
    this.wail -= delta;
    if (poses.length && this.wail <= 0) {
      this.wail = 1.2;
      const near = Math.min(...poses.map((p) => Math.hypot(p.x - world.player.x, p.z - world.player.z)));
      if (near < 150) this.siren(1 - near / 150);
    }
  }
}
