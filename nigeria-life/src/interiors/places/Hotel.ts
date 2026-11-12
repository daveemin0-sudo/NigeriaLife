import * as THREE from 'three';
import { bedDuvetNear, duvetOver } from '../../interactions/Duvet';
import { fineBasin, fineBathtub, fineBed, fineFridge, fineLamp, fineSofa, fineToilet, fineWardrobe } from '../../housing/FineFurniture';
import { repeated, smallTiles } from '../../graphics/Surfaces';
import { RENDER_LAYERS } from '../InteriorTypes';
import { Builder, signBoard } from '../../world/kit/ArchKit';
import { Sequence, steps } from '../../interactions/Sequence';
import { InteractionDirector } from '../../interactions/InteractionDirector';
import type { Actor } from '../../interactions/Actor';
import { Activity } from '../../life/Activity';
import { showGameToast } from '../../ui/GameToast';
import { BackendService } from '../../backend/BackendService';
import type { PlaceHost } from '../../destinations/PlaceActions';
import type { PlaceInterior, PlaceSpec } from './PlaceInterior';
import { EventClock, weekday } from './LiveEvents';
import { Figure } from './Worship';

/**
 * A night at the Eko Grand. At the front desk the guest pays for the nights and is handed a
 * key card for a room of their own: 201 to 206 on the second floor. The lift only goes up with
 * a key. Upstairs, along the corridor, their door opens with the card (the lock goes green)
 * and the room is theirs until noon on the day they check out: a king bed to sleep in for as
 * long as they like, the bathroom, the minibar, room service brought up to the door, a
 * television and the view over Lagos. Leaving goes back the way they came: the room to the
 * corridor, the corridor down to the lobby, the lobby out to the road.
 */

export const HOTEL = { lobby: 'eko-grand-hotel', floor: 'eko-grand-floor', suite: 'eko-grand-suite' } as const;
export const NIGHT_PRICE = 85_000;
const ROOMS = [201, 202, 203, 204, 205, 206];
const KEY_ITEM = 'hotel_key';

interface Stay {
  room: number;
  /** Game days: checked in on `from`, out by noon on `until` */
  from: number;
  until: number;
  paid: number;
  /** Real-world expiry timestamp in ms (12:00 PM on checkout date) */
  expiresAt?: number;
}

const naira = (n: number) => `₦${n.toLocaleString()}`;
const dayName = (day: number) => `${['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][weekday(day)]} ${new Date(2026, 9, 7 + day).getDate()}`;

/** The player's stay, kept per player */
export class HotelStay {
  private static instance: HotelStay | null = null;
  public static get(): HotelStay {
    HotelStay.instance ??= new HotelStay();
    return HotelStay.instance;
  }
  /** The game's clock (the tests set it) */
  public now: () => { day: number; hour: number } = () => EventClock.now();
  private stay: Stay | null = null;

  private key(): string {
    return `nl_hotel_v1:${Activity.player()}`;
  }

  private load(): void {
    try { this.stay = JSON.parse(localStorage.getItem(this.key()) ?? 'null'); } catch { this.stay = null; }
  }

  private save(): void {
    try { localStorage.setItem(this.key(), JSON.stringify(this.stay)); } catch { /* private window */ }
  }

  /** The stay, if it has not run out: checkout is at noon */
  public current(): Stay | null {
    this.load();
    const s = this.stay;
    if (!s) return null;
    // Real-time timestamp check (if lapsed past checkout noon)
    if (s.expiresAt && Date.now() >= s.expiresAt) return null;
    const { day, hour } = this.now();
    if (day > s.until || (day === s.until && hour >= 12)) return null;
    // Legacy stays booked when sky.day was 0 in late October/November
    if (s.until < 20 && day >= 20) return null;
    return s;
  }

  /** A stay that has run out but has not been handed back */
  public lapsed(): Stay | null {
    this.load();
    return this.stay && !this.current() ? this.stay : null;
  }

  public checkIn(nights: number, paid: number): Stay {
    const { day, hour } = this.now();
    // Checked in before 6 in the morning, last night counts as the first
    const from = hour < 6 ? day - 1 : day;
    const until = from + nights;
    const room = ROOMS[(day * 5 + nights + Math.floor(hour)) % ROOMS.length];
    const co = new Date();
    co.setDate(co.getDate() + nights);
    co.setHours(12, 0, 0, 0);
    this.stay = { room, from, until, paid, expiresAt: co.getTime() };
    this.save();
    return this.stay;
  }

  public extend(nights: number, paid: number): Stay | null {
    const s = this.current();
    if (!s) return null;
    s.until += nights;
    s.paid += paid;
    const co = new Date(s.expiresAt || Date.now());
    co.setDate(co.getDate() + nights);
    co.setHours(12, 0, 0, 0);
    s.expiresAt = co.getTime();
    this.save();
    return s;
  }

  public checkOut(): void {
    this.load();
    this.stay = null;
    this.save();
  }

  public until(s: Stay): string {
    return `noon on ${dayName(s.until)}`;
  }
}

// --- Things that move: doors that swing, lift doors that slide --------------------------------

class SwingDoor {
  public readonly pivot = new THREE.Group();
  public readonly led: THREE.MeshBasicMaterial;
  private target = 0;
  constructor(parent: THREE.Group, x: number, z: number, facing: number, number: number) {
    // Hung on the wall at (x, z); `facing` is the way the corridor side of it looks
    const holder = new THREE.Group();
    holder.position.set(x, 0, z);
    holder.rotation.y = facing;
    holder.name = `room door ${number}`;
    const frame = new THREE.Mesh(new THREE.BoxGeometry(1.15, 2.25, 0.08), new THREE.MeshStandardMaterial({ color: 0xe7dccb, roughness: 0.7 }));
    frame.position.set(0, 1.12, -0.02);
    this.pivot.position.set(-0.47, 0, 0.03);
    const leaf = new THREE.Mesh(new THREE.BoxGeometry(0.94, 2.12, 0.05), new THREE.MeshStandardMaterial({ color: 0x6b3f1d, roughness: 0.55 }));
    leaf.position.set(0.47, 1.06, 0);
    leaf.name = 'door_leaf';
    const handle = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.03, 0.05), new THREE.MeshStandardMaterial({ color: 0xd4af37, metalness: 0.6, roughness: 0.3 }));
    handle.position.set(0.82, 1.02, 0.05);
    this.led = new THREE.MeshBasicMaterial({ color: 0xdc2626 });
    const lock = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.16, 0.03), new THREE.MeshStandardMaterial({ color: 0x1f2937 }));
    lock.position.set(0.82, 1.22, 0.05);
    const light = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.03, 0.02), this.led);
    light.position.set(0.82, 1.27, 0.07);
    light.name = 'lock light';
    this.pivot.add(leaf, handle, lock, light);
    const plate = signBoard([String(number)], 0.34, 0.2, '#1c1917', '#d4af37');
    plate.position.set(0.78, 1.65, 0.03);
    holder.add(frame, this.pivot, plate);
    parent.add(holder);
  }
  /** How many times it has been unlocked and opened (for the tests: the green light is only on for a moment) */
  public opened = 0;
  public open(): void { this.target = -1.35; this.led.color.set(0x16a34a); this.opened += 1; }
  public close(): void { this.target = 0; this.led.color.set(0xdc2626); }
  public get isOpen(): boolean { return Math.abs(this.pivot.rotation.y - this.target) < 0.05 && this.target !== 0; }
  public tick(delta: number): void {
    this.pivot.rotation.y += (this.target - this.pivot.rotation.y) * Math.min(1, delta * 6);
  }
}

class LiftDoors {
  private readonly left: THREE.Mesh;
  private readonly right: THREE.Mesh;
  private open = 0;
  private target = 0;
  constructor(parent: THREE.Group, x: number, z: number, facing: number) {
    const holder = new THREE.Group();
    holder.position.set(x, 0, z);
    holder.rotation.y = facing;
    holder.name = 'lift';
    const steel = new THREE.MeshStandardMaterial({ color: 0xb8bcc2, metalness: 0.7, roughness: 0.25 });
    const frame = new THREE.Mesh(new THREE.BoxGeometry(1.9, 2.6, 0.12), new THREE.MeshStandardMaterial({ color: 0x3f3f46, roughness: 0.5 }));
    frame.position.set(0, 1.3, -0.05);
    const inside = new THREE.Mesh(new THREE.BoxGeometry(1.5, 2.25, 0.02), new THREE.MeshStandardMaterial({ color: 0xe5c07b, roughness: 0.4, emissive: 0x3a2a10 }));
    inside.position.set(0, 1.12, 0.005);
    this.left = new THREE.Mesh(new THREE.BoxGeometry(0.76, 2.25, 0.04), steel);
    this.right = new THREE.Mesh(new THREE.BoxGeometry(0.76, 2.25, 0.04), steel);
    this.left.position.set(-0.38, 1.12, 0.03);
    this.right.position.set(0.38, 1.12, 0.03);
    const panel = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.3, 0.04), new THREE.MeshStandardMaterial({ color: 0x18181b }));
    panel.position.set(1.15, 1.2, 0.02);
    const glow = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.06, 0.02), new THREE.MeshBasicMaterial({ color: 0x38bdf8 }));
    glow.position.set(1.15, 1.28, 0.05);
    const sign = signBoard(['▲ ▼', 'Rooms 201–206'], 1.4, 0.36, '#0f172a', '#facc15');
    sign.position.set(0, 2.85, 0.02);
    holder.add(frame, inside, this.left, this.right, panel, glow, sign);
    parent.add(holder);
  }
  public set(open: boolean): void { this.target = open ? 1 : 0; }
  public tick(delta: number): void {
    this.open += (this.target - this.open) * Math.min(1, delta * 5);
    this.left.position.x = -0.38 - this.open * 0.7;
    this.right.position.x = 0.38 + this.open * 0.7;
  }
}

/** Where things are in each part of the hotel, in their own rooms' space */
const LOBBY_LIFT = { at: [10.78, -7.5] as [number, number], stand: [9.4, -7.5] as [number, number], facing: -Math.PI / 2 };
const FLOOR_LIFT = { at: [-3.28, 9.5] as [number, number], stand: [-2.3, 9.5] as [number, number], facing: Math.PI / 2 };
const DOORS: Array<{ room: number; x: number; z: number }> = [
  { room: 201, x: -3.27, z: 4 }, { room: 202, x: 3.27, z: 4 },
  { room: 203, x: -3.27, z: -2 }, { room: 204, x: 3.27, z: -2 },
  { room: 205, x: -3.27, z: -8 }, { room: 206, x: 3.27, z: -8 },
];
const doorOf = (room: number) => DOORS.find((d) => d.room === room)!;
/** In front of a door, in the corridor */
const frontOf = (d: { x: number; z: number }): [number, number] => [d.x < 0 ? -2.3 : 2.3, d.z];
const SUITE = {
  door: [0, 3.9] as [number, number],
  bed: { root: [-0.5, -2.75] as [number, number], side: [1.05, -3.6] as [number, number], top: 0.66 },
  armchair: { seat: [2.35, 0.6] as [number, number], front: [2.35, 1.6] as [number, number], facing: Math.PI / 2 },
  desk: { seat: [-3.25, 0.6] as [number, number], front: [-2.4, 0.6] as [number, number], facing: -Math.PI / 2 },
  minibar: { at: [-4.0, 2.7] as [number, number], stand: [-2.9, 2.7] as [number, number] },
  window: { at: [-3.4, -4.8] as [number, number], stand: [-3.4, -3.9] as [number, number] },
};

/** The parts of the hotel, as rooms of their own */
export const HOTEL_SPECS: PlaceSpec[] = [
  {
    key: HOTEL.floor,
    name: 'Eko Grand Hotel · 2nd floor',
    district: 'Mainland · hotel',
    room: { width: 7, length: 24, height: 3.4, floor: 0x7f1d1d, wall: 0xf5efe6 },
    sign: { text: 'SECOND FLOOR', sub: 'Rooms 201 to 206', bg: '#b45309' },
    door: { name: 'Stairs down to the lobby', category: 'Eko Grand Hotel', description: 'Down the stairs to the front desk.' },
    build: (b) => {
      // A runner down the corridor, lamps between the doors, a table at the end, the housekeeping trolley
      b.box(0x450a0a, 2.6, 0.015, 22, 0, 0.01, 0).box(0xd4af37, 0.06, 0.02, 22, -1.3, 0.012, 0).box(0xd4af37, 0.06, 0.02, 22, 1.3, 0.012, 0);
      for (const z of [7, 1, -5, -10.5]) for (const x of [-3.26, 3.26]) b.box(0xfde68a, 0.08, 0.35, 0.25, x, 2.0, z, { glow: true });
      b.box(0x5b3a1e, 1.4, 0.8, 0.5, 0, 0, -11.4).cylinder(0xf8fafc, 0.12, 0.35, 0, 0.8, -11.4, { sides: 10 }).dome(0xdb2777, 0.22, 0, 1.15, -11.4);
      b.box(0xe5e7eb, 0.7, 0.9, 1.2, 2.2, 0, -10.2).box(0xf8fafc, 0.6, 0.3, 1.1, 2.2, 0.9, -10.2).box(0x0ea5e9, 0.5, 0.2, 0.4, 2.2, 1.2, -10.4);
    },
    staff: [{ name: 'Mama Kemi', title: 'Housekeeping', at: [1.4, -10.2], facing: 0, outfit: 0x0f766e, gender: 'female', says: 'Good day! Fresh towels are already in your room.' }],
    stations: [],
  },
  {
    key: HOTEL.suite,
    name: 'Eko Grand Hotel · your room',
    district: 'Mainland · hotel',
    room: { width: 9, length: 10, height: 3.2, floor: 0xc8b49a, wall: 0xf3ede4 },
    door: { name: 'Room door', category: 'Eko Grand Hotel', description: 'Out to the corridor.' },
    build: (b) => {
      const [bx] = SUITE.bed.root;
      // The king bed against the back wall, its headboard, pillows and the duvet
      b.box(0x3f2a1d, 2.3, 0.42, 2.4, bx, 0, -3.75).box(0xf8fafc, 2.2, 0.22, 2.3, bx, 0.42, -3.75).box(0x7c2d12, 2.2, 0.05, 1.4, bx, 0.64, -3.3);
      b.box(0x3f2a1d, 2.6, 1.5, 0.12, bx, 0, -4.74).box(0xf8fafc, 0.8, 0.16, 0.4, bx - 0.5, 0.64, -4.6).box(0xf8fafc, 0.8, 0.16, 0.4, bx + 0.5, 0.64, -4.6);
      // Bedside tables with lamps
      for (const x of [bx - 1.6, bx + 1.6]) b.box(0x5b3a1e, 0.55, 0.55, 0.45, x, 0, -4.6).cylinder(0x1c1917, 0.03, 0.35, x, 0.55, -4.6, { sides: 6 }).cone(0xfde68a, 0.16, 0.22, x, 0.86, -4.6, 12, { glow: true });
      // The television on the right wall and the armchair in front of it
      b.box(0x0a0a0a, 0.06, 0.9, 1.6, 4.26, 1.2, 0.6).box(0x5b3a1e, 0.45, 0.5, 1.8, 4.0, 0, 0.6);
      b.box(0x7f1d1d, 0.8, 0.42, 0.8, 2.35, 0, 0.6).box(0x7f1d1d, 0.18, 0.6, 0.8, 1.95, 0.42, 0.6).box(0x7f1d1d, 0.8, 0.25, 0.12, 2.35, 0.42, 0.25).box(0x7f1d1d, 0.8, 0.25, 0.12, 2.35, 0.42, 0.95);
      // The desk with its chair and telephone on the left wall
      b.box(0x5b3a1e, 0.65, 0.75, 1.5, -4.1, 0, 0.6).box(0x111827, 0.45, 0.45, 0.45, -3.25, 0, 0.6).box(0x111827, 0.08, 0.5, 0.45, -3.0, 0.45, 0.6);
      b.box(0x1c1917, 0.22, 0.07, 0.16, -4.1, 0.75, 1.1).box(0xf8fafc, 0.2, 0.01, 0.14, -4.15, 0.75, 0.2);
      // The minibar, with a kettle and glasses on it; the wardrobe; a rug; the luggage rack
      b.box(0x27272a, 0.6, 0.85, 0.6, -4.1, 0, 2.7).box(0xd6d3d1, 0.66, 0.04, 0.66, -4.1, 0.85, 2.7).cylinder(0xe5e7eb, 0.08, 0.22, -4.15, 0.89, 2.55, { sides: 10 });
      b.box(0x5b3a1e, 0.6, 2.2, 1.4, -4.15, 0, -2.2).box(0x3f2a1d, 0.02, 2.0, 0.02, -3.84, 0.1, -2.2);
      b.box(0x9a3412, 3.2, 0.012, 2.2, 0.8, 0.006, -0.8);
      b.box(0x5b3a1e, 0.9, 0.45, 0.5, 3.6, 0, 3.6).box(0x1e3a8a, 0.75, 0.5, 0.4, 3.6, 0.45, 3.6);
      // The bathroom: a tiled floor, a tiled half wall with a gap to walk in by, a glass shower and the toilet
      b.box(0xdbe7ee, 2.1, 0.012, 2.4, 3.45, 0.006, -3.8);
      b.box(0xe7eef2, 0.4, 1.1, 0.12, 2.6, 0, -2.6).box(0xe7eef2, 0.75, 1.1, 0.12, 4.12, 0, -2.6).box(0xe7eef2, 0.12, 1.1, 2.4, 2.4, 0, -3.8);
      b.box(0xf8fafc, 1.1, 0.08, 1.1, 3.85, 0, -4.35).box(0xb8c2cc, 0.05, 2.0, 0.05, 4.32, 0.08, -4.82).box(0xb8c2cc, 0.26, 0.04, 0.26, 4.15, 2.05, -4.6);
      b.box(0xbfe3f2, 0.04, 1.9, 1.1, 3.28, 0.08, -4.35);
      b.box(0xf8fafc, 0.38, 0.4, 0.46, 2.9, 0, -4.45).box(0xffffff, 0.42, 0.05, 0.5, 2.9, 0.4, -4.47).box(0xf8fafc, 0.46, 0.42, 0.2, 2.9, 0.4, -4.78);
      b.box(0xf8fafc, 0.5, 0.14, 0.4, 2.62, 0.75, -3.3).box(0xdbeafe, 0.03, 0.6, 0.46, 2.47, 1.1, -3.3);
    },
    staff: [],
    stations: [],
  },
];

// --- The three parts, alive ---------------------------------------------------------------------

const rooms = new Map<string, PlaceInterior>();
/** The room number of a guest on their way into a room not built yet */
let arriving: number | null = null;
/** For the tests: the moving parts and what they are doing */
export const HotelState: { lobby?: Lobby; floor?: Floor; suite?: Suite } = {};

class Lobby {
  private readonly lift: LiftDoors;
  private readonly room: PlaceInterior;
  constructor(room: PlaceInterior) {
    this.room = room;
    this.lift = new LiftDoors(room.group, LOBBY_LIFT.at[0], LOBBY_LIFT.at[1], LOBBY_LIFT.facing);
    room.ticks.push((delta) => this.lift.tick(delta));
    room.addCard({
      id: `place_${HOTEL.lobby}_reception`, name: '🛎️ Reception', description: 'Rooms by the night, a key card to your own room.',
      at: [-5, -6], stand: [-5, -4.6],
      label: () => {
        const s = HotelStay.get().current();
        return s ? `🛎️ Reception · your room is ${s.room}` : `🛎️ Reception · a room from ${naira(NIGHT_PRICE)} a night`;
      },
      run: (host) => this.desk(host),
    });
    room.addCard({
      id: `place_${HOTEL.lobby}_lift`, name: '🔼 Lifts', description: 'Up to the rooms, with a key card.',
      at: [LOBBY_LIFT.at[0] - 0.4, LOBBY_LIFT.at[1]], stand: LOBBY_LIFT.stand,
      label: () => (HotelStay.get().current() ? `🔼 Up to room ${HotelStay.get().current()!.room}` : '🔼 Lifts (guests with a key card)'),
      run: (host) => this.up(host),
    });
  }

  private receptionist(): Actor | null {
    return this.room.npcs.find((n) => n.actor.name === 'Front desk')?.actor ?? this.room.npcs[0]?.actor ?? null;
  }

  private desk(host: PlaceHost): void {
    const hotel = HotelStay.get();
    const s = hotel.current();
    const lapsed = hotel.lapsed();
    const choices: Array<{ label: string; note?: string; pick: () => void }> = [];
    if (s) {
      choices.push({ label: 'Stay another night', note: naira(NIGHT_PRICE), pick: () => this.book(host, 1, NIGHT_PRICE) });
      choices.push({ label: 'Check out', note: 'Hand the key card back', pick: () => this.checkOut(host) });
    } else {
      const offers: Array<[number, number, string]> = [[1, NIGHT_PRICE, 'Tonight'], [2, NIGHT_PRICE * 2, 'Two nights'], [3, NIGHT_PRICE * 3, 'Three nights'], [7, NIGHT_PRICE * 6, 'A week: the seventh night free']];
      for (const [n, price, label] of offers) choices.push({ label: `${label}`, note: naira(price), pick: () => this.book(host, n, price) });
      if (lapsed) choices.push({ label: 'Hand back the old key card', note: `Room ${lapsed.room}`, pick: () => this.checkOut(host) });
    }
    choices.push({ label: 'Not now', pick: () => undefined });
    host.ask({
      who: 'Front desk', role: 'Eko Grand Hotel',
      text: s ? `Welcome back. Room ${s.room} is yours until ${hotel.until(s)}.` : lapsed ? `Your stay in room ${lapsed.room} has ended. Another night?` : 'Welcome to Eko Grand. A room for how many nights? Breakfast, Wi-Fi and the pool are included.',
      choices,
    });
  }

  /** Paid at the desk, the key card handed over at the moment it is paid */
  private book(host: PlaceHost, nights: number, price: number): void {
    const hotel = HotelStay.get();
    const extending = !!hotel.current();
    const desk = this.receptionist();
    const result = host.director.perform([
      { id: 'at the front desk', actor: host.actor, point: this.room.at(-5, -4.6), target: this.room.at(-5, -6), animation: { arms: 'talk' }, seconds: 1.6 },
      {
        id: extending ? 'another night' : 'check in', actor: host.actor, animation: { arms: 'reach' }, seconds: 1.3, effectAt: 0.55,
        effect: () => {
          if (!host.backend.pay(price, `Eko Grand Hotel: ${nights === 1 ? 'a night' : `${nights} nights`}`, 'SHOP_PURCHASE')) {
            host.say(`That is ${naira(price)}. You do not have enough.`, 'warning');
            return false;
          }
          const s = extending ? hotel.extend(nights, price)! : hotel.checkIn(nights, price);
          host.backend.removeItem(KEY_ITEM);
          host.backend.addItem({ id: KEY_ITEM, name: `Room ${s.room} key card`, icon: '💳', price: 0, category: 'key', usable: false, description: `Eko Grand Hotel, room ${s.room}, second floor. Until ${hotel.until(s)}.` });
          desk?.say(extending ? `Done. Room ${s.room} until ${hotel.until(s)}.` : `Room ${s.room}, second floor. The lift is on your right.`, 3.5);
          host.say(extending ? `🛎️ Another night in room ${s.room}, until ${hotel.until(s)}.` : `🛎️ Checked in: room ${s.room}, second floor, until ${hotel.until(s)}. The key card is in your bag.`, 'success');
          return true;
        },
      },
    ]);
    if (!result.ok && result.reason) host.say(result.reason, 'info');
  }

  private checkOut(host: PlaceHost): void {
    const desk = this.receptionist();
    host.director.perform({
      id: 'check out', actor: host.actor, point: this.room.at(-5, -4.6), target: this.room.at(-5, -6), animation: { arms: 'reach' }, seconds: 1.2, effectAt: 0.5,
      effect: () => {
        HotelStay.get().checkOut();
        host.backend.removeItem(KEY_ITEM);
        desk?.say('Thank you for staying with us. Safe journey!', 3);
        host.say('🛎️ Checked out. The key card is handed back.', 'success');
        return true;
      },
    });
  }

  /** The key card on the reader, the doors open, in, and up */
  private up(host: PlaceHost): void {
    const s = HotelStay.get().current();
    if (!s) {
      host.say(HotelStay.get().lapsed() ? 'The reader beeps red: your stay has ended. See the front desk.' : 'The lift needs a room key card. Check in at the front desk.', 'info');
      return;
    }
    if (host.director.interrupt(host.actor) === 'locked') return;
    const actor = host.actor;
    const ride = new Sequence('lift up to the rooms', [actor]).locked();
    ride.add(
      steps.walk(actor, this.room.at(LOBBY_LIFT.stand[0], LOBBY_LIFT.stand[1]), { speed: 2.8 }),
      steps.face(actor, this.room.at(LOBBY_LIFT.at[0], LOBBY_LIFT.at[1])),
      steps.animate(actor, { arms: 'reach' }, 0.8, [{ at: 0.6, run: () => this.lift.set(true) }]),
      steps.wait(0.6),
      steps.slide(actor, this.room.at(LOBBY_LIFT.at[0] - 0.55, LOBBY_LIFT.at[1]), 0.7, { legs: 'walk', arms: 'swing' }),
      steps.call('doors close', () => { this.lift.set(false); }),
      steps.wait(0.5),
    );
    ride.onEnd((reason) => {
      if (reason !== 'done') { this.lift.set(false); return; }
      const floor = rooms.get(HOTEL.floor);
      if (floor) host.ride(floor.def.id, floor.at(FLOOR_LIFT.stand[0], FLOOR_LIFT.stand[1]), FLOOR_LIFT.facing);
    });
    host.director.run(ride);
  }
}

class Floor {
  private readonly room: PlaceInterior;
  private readonly lift: LiftDoors;
  public readonly doors = new Map<number, SwingDoor>();
  constructor(room: PlaceInterior) {
    this.room = room;
    this.lift = new LiftDoors(room.group, FLOOR_LIFT.at[0], FLOOR_LIFT.at[1], FLOOR_LIFT.facing);
    for (const d of DOORS) this.doors.set(d.room, new SwingDoor(room.group, d.x, d.z, d.x < 0 ? Math.PI / 2 : -Math.PI / 2, d.room));
    room.ticks.push((delta) => { this.lift.tick(delta); for (const door of this.doors.values()) door.tick(delta); });
    for (const d of DOORS) {
      const [sx, sz] = frontOf(d);
      room.addCard({
        id: `place_${HOTEL.floor}_room${d.room}`, name: `🚪 Room ${d.room}`, description: 'A guest room.',
        at: [d.x + (d.x < 0 ? 0.4 : -0.4), d.z], stand: [sx, sz],
        label: () => {
          const s = HotelStay.get().current();
          if (s?.room === d.room) return `🔑 Room ${d.room}: open it with your key card`;
          if (HotelStay.get().lapsed()?.room === d.room) return `🔒 Room ${d.room}: your stay has ended`;
          return `🔒 Room ${d.room}: knock`;
        },
        run: (host) => this.door(host, d.room),
      });
    }
    room.addCard({
      id: `place_${HOTEL.floor}_lift`, name: '🔽 Lift', description: 'Down to the lobby.',
      at: [FLOOR_LIFT.at[0] + 0.4, FLOOR_LIFT.at[1]], stand: FLOOR_LIFT.stand,
      label: () => '🔽 Lift down to the lobby',
      run: (host) => this.down(host),
    });
    // Out by the stairs: down to the lobby, by the lift
    room.leadsTo = () => {
      const lobby = rooms.get(HOTEL.lobby);
      return lobby ? { id: lobby.def.id, spawnAt: lobby.at(LOBBY_LIFT.stand[0] - 0.6, LOBBY_LIFT.stand[1] + 1.6), spawnYaw: -Math.PI / 2 } : null;
    };
  }

  private door(host: PlaceHost, number: number): void {
    const hotel = HotelStay.get();
    const s = hotel.current();
    const d = doorOf(number);
    const [sx, sz] = frontOf(d);
    const door = this.doors.get(number)!;
    if (s?.room !== number) {
      const mine = hotel.lapsed()?.room === number;
      host.director.perform({
        id: mine ? 'key card refused' : 'knock on a door', actor: host.actor, point: this.room.at(sx, sz), target: this.room.at(d.x, d.z), animation: { arms: 'reach' }, seconds: 1.4, effectAt: 0.7,
        effect: () => {
          if (mine) host.say('The lock blinks red. Your stay has ended: see the front desk to stay on.', 'warning');
          else host.say(['*Knock knock* … no answer.', '"Who is it? I did not order anything o!"', '"Not now, please! Come back later."', '*Knock knock* … a television, and nobody comes.'][number % 4], 'info');
          return true;
        },
      });
      return;
    }
    if (host.director.interrupt(host.actor) === 'locked') return;
    const actor = host.actor;
    const inside: [number, number] = [d.x + (d.x < 0 ? -0.3 : 0.3), d.z];
    const open = new Sequence('open my hotel room', [actor]).locked();
    open.add(
      steps.walk(actor, this.room.at(sx, sz), { speed: 2.8 }),
      steps.face(actor, this.room.at(d.x, d.z)),
      steps.animate(actor, { arms: 'reach' }, 0.9, [{ at: 0.6, run: () => door.open() }]),
      steps.until('door open', () => door.isOpen, 2, 'continue'),
      steps.slide(actor, this.room.at(inside[0], inside[1]), 0.8, { legs: 'walk', arms: 'swing' }),
    );
    open.onEnd((reason) => {
      door.close();
      if (reason !== 'done') return;
      const suite = rooms.get(HOTEL.suite);
      // The room is built the first time it is entered: its number goes up as soon as it is
      if (HotelState.suite) HotelState.suite.arrive(number);
      else arriving = number;
      if (suite) host.ride(suite.def.id, suite.at(SUITE.door[0], SUITE.door[1]), Math.PI);
    });
    host.director.run(open);
  }

  private down(host: PlaceHost): void {
    if (host.director.interrupt(host.actor) === 'locked') return;
    const actor = host.actor;
    const ride = new Sequence('lift down to the lobby', [actor]).locked();
    ride.add(
      steps.walk(actor, this.room.at(FLOOR_LIFT.stand[0], FLOOR_LIFT.stand[1]), { speed: 2.8 }),
      steps.face(actor, this.room.at(FLOOR_LIFT.at[0], FLOOR_LIFT.at[1])),
      steps.animate(actor, { arms: 'reach' }, 0.6, [{ at: 0.5, run: () => this.lift.set(true) }]),
      steps.wait(0.6),
      steps.slide(actor, this.room.at(FLOOR_LIFT.at[0] + 0.55, FLOOR_LIFT.at[1]), 0.7, { legs: 'walk', arms: 'swing' }),
      steps.call('doors close', () => { this.lift.set(false); }),
      steps.wait(0.5),
    );
    ride.onEnd((reason) => {
      if (reason !== 'done') { this.lift.set(false); return; }
      const lobby = rooms.get(HOTEL.lobby);
      if (lobby) host.ride(lobby.def.id, lobby.at(LOBBY_LIFT.stand[0], LOBBY_LIFT.stand[1]), LOBBY_LIFT.facing);
    });
    host.director.run(ride);
  }
}

const MENU: Array<{ label: string; price: number; hunger: number; fun: number; dish: number }> = [
  { label: 'Jollof rice, fried plantain and chicken', price: 18_000, hunger: 60, fun: 5, dish: 0xea580c },
  { label: 'Goat meat pepper soup', price: 12_000, hunger: 40, fun: 6, dish: 0x9a3412 },
  { label: 'Club sandwich and chips', price: 15_000, hunger: 45, fun: 4, dish: 0xfacc15 },
  { label: 'Breakfast: eggs, bread and tea', price: 14_000, hunger: 45, fun: 3, dish: 0xfde68a },
];

class Suite {
  /** Under the shower: washed clean */
  private shower(host: PlaceHost): void {
    const actor = host.actor;
    if (host.director.interrupt(actor) === 'locked') return;
    const at = (x: number, z: number) => new THREE.Vector3(this.room.group.position.x + x, 0, this.room.group.position.z + z);
    const wash = new Sequence('hotel shower', [actor]).add(
      steps.walk(actor, at(3.6, -3.25), { ifStuck: 'snap' }),
      steps.face(actor, at(3.85, -4.35)),
      steps.slide(actor, at(3.85, -4.3), 0.6),
      steps.animate(actor, { arms: 'reach' }, 3.4, [{ at: 0.75, run: () => {
        host.backend.takeShower();
        host.backend.rest(20, 10);
        host.say('🚿 A hot shower and a fresh towel. Hygiene full.', 'success');
      } }]),
      steps.slide(actor, at(3.6, -3.25), 0.6),
    );
    host.director.run(wash);
  }

  /** The toilet: sat on, flushed, hands washed */
  private toilet(host: PlaceHost): void {
    const actor = host.actor;
    if (host.director.interrupt(actor) === 'locked') return;
    const at = (x: number, z: number) => new THREE.Vector3(this.room.group.position.x + x, 0, this.room.group.position.z + z);
    const use = new Sequence('hotel toilet', [actor]).add(
      steps.walk(actor, at(2.95, -3.45), { ifStuck: 'snap' }),
      steps.face(actor, 0),
      steps.slide(actor, at(2.9, -4.3), 0.45),
      steps.setPose(actor, { legs: 'sit', arms: 'rest' }),
      steps.wait(2.6),
      steps.call('relieved', () => {
        host.backend.relieveBladder();
        showGameToast('🚽 Relieved. *Flush*', 'success', 2200);
      }),
      steps.setPose(actor, { legs: 'stand', arms: 'rest' }),
      steps.slide(actor, at(2.95, -3.45), 0.45),
      steps.animate(actor, { arms: 'reach' }, 0.9),
    );
    host.director.run(use);
  }

  private readonly room: PlaceInterior;
  private readonly hold: { release: (instant?: boolean) => void };
  private sleeping = false;
  /** The duvet over the player while they sleep */
  private duvet: THREE.Group | null = null;
  private slept = 0;
  private restedTold = false;
  private waiter: Figure | null = null;
  private order: { dish: (typeof MENU)[number]; due: number; stage: 'cooking' | 'coming' | 'served' } | null = null;
  private tray: THREE.Group | null = null;
  private readonly screen: THREE.Mesh;
  private readonly view: THREE.Mesh;
  private viewNight: boolean | null = null;
  public number = 0;
  private readonly sign: THREE.Group;
  /** Room service brought up to the room (for the tests) */
  private delivered = 0;

  constructor(room: PlaceInterior) {
    this.room = room;
    this.hold = { release: (instant) => this.getUp(instant) };
    // The television's picture and the window's view over Lagos
    this.screen = signBoard(['📺 NTA · Nollywood Tonight', '"Eko Love", 8 pm'], 1.5, 0.84, '#1e1b4b', '#fde68a');
    this.screen.position.set(4.22, 1.65, 0.6);
    this.screen.rotation.y = -Math.PI / 2;
    this.screen.visible = false;
    room.group.add(this.screen);
    this.view = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 1.3), new THREE.MeshBasicMaterial({ color: 0xffffff }));
    this.view.position.set(SUITE.window.at[0], 1.85, -4.77);
    this.view.name = 'window view';
    room.group.add(this.view);
    const frame = new THREE.Mesh(new THREE.BoxGeometry(1.95, 1.45, 0.06), new THREE.MeshStandardMaterial({ color: 0xf8fafc }));
    frame.position.set(SUITE.window.at[0], 1.85, -4.8);
    room.group.add(frame);
    this.sign = new THREE.Group();
    room.group.add(this.sign);

    room.addCard({ id: `place_${HOTEL.suite}_bed`, name: '🛏️ The bed', description: 'A king bed with clean white sheets.', at: [SUITE.bed.root[0], -3.8], stand: SUITE.bed.side, label: () => (this.sleeping ? '🛏️ Sleeping' : '🛏️ Sleep'), run: (host) => this.sleep(host) });
    room.addCard({ id: `place_${HOTEL.suite}_phone`, name: '☎️ The room phone', description: 'Room service, charged to the room.', at: [-4.1, 1.1], stand: SUITE.desk.front, label: () => this.phoneLabel(), run: (host) => this.phone(host) });
    room.addCard({ id: `place_${HOTEL.suite}_minibar`, name: '🧊 Minibar', description: 'Cold drinks and snacks, at hotel prices.', at: SUITE.minibar.at, stand: SUITE.minibar.stand, label: () => '🧊 Minibar', run: (host) => this.minibar(host) });
    room.addCard({ id: `place_${HOTEL.suite}_tv`, name: '📺 Television', description: 'Sit in the armchair and watch.', at: [4.1, 0.6], stand: SUITE.armchair.front, label: () => '📺 Watch television', run: (host) => this.watch(host) });
    room.addCard({ id: `place_${HOTEL.suite}_shower`, name: '🚿 The shower', description: 'Hot water, soft towels.', at: [3.85, -4.35], stand: [3.6, -3.25], label: () => '🚿 Take a shower', run: (host) => this.shower(host) });
    room.addCard({ id: `place_${HOTEL.suite}_toilet`, name: '🚽 The toilet', description: 'Behind the half wall.', at: [2.9, -4.45], stand: [2.95, -3.45], label: () => '🚽 Use the toilet', run: (host) => this.toilet(host) });
    room.addCard({ id: `place_${HOTEL.suite}_window`, name: '🌇 The window', description: 'The view over Lagos.', at: SUITE.window.at, stand: SUITE.window.stand, label: () => '🌇 Look out over Lagos', run: (host) => this.look(host) });
    room.ticks.push((delta) => this.tick(delta));
    // Out of the door: back into the corridor, in front of the room
    room.leadsTo = () => {
      const floor = rooms.get(HOTEL.floor);
      if (!floor || !this.number) return floor ? { id: floor.def.id, spawnAt: floor.at(FLOOR_LIFT.stand[0], FLOOR_LIFT.stand[1]), spawnYaw: FLOOR_LIFT.facing } : null;
      const d = doorOf(this.number);
      const [x, z] = frontOf(d);
      return { id: floor.def.id, spawnAt: floor.at(x, z), spawnYaw: d.x < 0 ? Math.PI / 2 : -Math.PI / 2 };
    };
  }

  /** The guest comes in: the room is theirs, with their number by the door */
  public arrive(number: number): void {
    this.number = number;
    this.sign.clear();
    const plate = signBoard([`Room ${number}`, 'Welcome to Eko Grand'], 1.1, 0.4, '#1c1917', '#d4af37');
    plate.position.set(-4.27, 1.55, -0.1);
    plate.rotation.y = Math.PI / 2;
    this.sign.add(plate);
    this.paintView();
  }

  /** Lagos through the glass: the lagoon and the towers by day, their lights by night */
  private paintView(): void {
    if (typeof document === 'undefined') return;
    const hour = EventClock.now().hour;
    const night = hour >= 19 || hour < 6;
    if (night === this.viewNight) return;
    this.viewNight = night;
    const c = document.createElement('canvas');
    c.width = 512;
    c.height = 360;
    const g = c.getContext('2d');
    if (!g) return;
    const sky = g.createLinearGradient(0, 0, 0, 220);
    sky.addColorStop(0, night ? '#0b1026' : '#7cc4f5');
    sky.addColorStop(1, night ? '#27305a' : '#f7d9a8');
    g.fillStyle = sky;
    g.fillRect(0, 0, 512, 360);
    const towers = [[20, 120, 40], [70, 90, 34], [110, 150, 50], [170, 70, 30], [210, 130, 46], [265, 100, 36], [310, 160, 54], [370, 85, 30], [410, 140, 44], [460, 110, 40]];
    for (const [x, h, w] of towers) {
      g.fillStyle = night ? '#111827' : '#64748b';
      g.fillRect(x, 230 - h, w, h);
      for (let y = 236 - h; y < 225; y += 12) for (let wx = x + 5; wx < x + w - 5; wx += 9) {
        if (night ? Math.random() < 0.55 : Math.random() < 0.2) {
          g.fillStyle = night ? '#fde68a' : '#cbd5e1';
          g.fillRect(wx, y, 4, 5);
        }
      }
    }
    g.fillStyle = night ? '#0f1d33' : '#2f6f8f';
    g.fillRect(0, 230, 512, 130);
    // The bridge across the lagoon, lit at night
    g.fillStyle = night ? '#fbbf24' : '#e5e7eb';
    g.fillRect(0, 262, 512, 4);
    for (let x = 10; x < 512; x += 40) g.fillRect(x, 266, 3, 18);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    const mat = this.view.material as THREE.MeshBasicMaterial;
    mat.map?.dispose();
    mat.map = tex;
    mat.needsUpdate = true;
  }

  private sleep(host: PlaceHost): void {
    const player = host.actor;
    if (this.sleeping || host.director.interrupt(player) === 'locked') return;
    const lying = { legs: 'lie' as const, arms: 'rest' as const, height: SUITE.bed.top };
    const [rx, rz] = SUITE.bed.root;
    const lieDown = new Sequence('lie down in the hotel bed', [player]).add(
      steps.walk(player, this.room.at(SUITE.bed.side[0], SUITE.bed.side[1]), { speed: 2.4 }),
      steps.face(player, this.room.at(rx, rz)),
      steps.slide(player, this.room.at(rx, rz), 0.5),
      steps.face(player, 0),
      steps.setPose(player, lying),
      steps.wait(0.5)
    );
    lieDown.onEnd((reason) => {
      if (reason !== 'done') return;
      player.yaw = 0;
      player.hold = this.hold;
      player.setScripted(true);
      player.pose = lying;
      this.sleeping = true;
      this.slept = 0;
      this.restedTold = false;
      this.duvet?.removeFromParent();
      this.duvet = duvetOver(this.room.group, { x: rx, z: rz }, 0, SUITE.bed.top, bedDuvetNear(this.room.group, { x: rx, z: rz }) ?? 0xf1ece2);
      host.say('🛏️ Cold AC, soft sheets. You drift off.', 'info');
    });
    host.director.run(lieDown);
  }

  private getUp(instant?: boolean): void {
    const player = InteractionDirector.get().player;
    this.sleeping = false;
    this.duvet?.removeFromParent();
    this.duvet = null;
    if (!player) return;
    player.hold = null;
    if (instant) { player.setScripted(false); return; }
    if (this.slept > 1) showGameToast('You got up. What you rested, you keep.', 'info', 2600);
    const rise = new Sequence('get up', [player]).locked().add(
      steps.setPose(player, { legs: 'stand', arms: 'rest' }),
      steps.slide(player, this.room.at(SUITE.bed.side[0], SUITE.bed.side[1]), 0.5)
    );
    if (!InteractionDirector.get().run(rise)) player.setScripted(false);
  }

  /** For the tests and the Get up button */
  public get asleep(): boolean {
    return this.sleeping;
  }

  private phoneLabel(): string {
    if (!this.order) return '☎️ Room service';
    if (this.order.stage === 'served') return '🍽️ Eat your room service at the desk';
    return '☎️ Room service is on its way';
  }

  private phone(host: PlaceHost): void {
    if (this.order?.stage === 'served') { this.eat(host); return; }
    if (this.order) { host.say('The kitchen says it is on its way up.', 'info'); return; }
    host.ask({
      who: 'Room service', role: 'Eko Grand Hotel', text: 'Good evening, room service. What can we bring you? It goes on your bill now.',
      choices: [
        ...MENU.map((dish) => ({ label: dish.label, note: naira(dish.price), pick: () => this.orderDish(host, dish) })),
        { label: 'Not now', pick: () => undefined },
      ],
    });
  }

  private orderDish(host: PlaceHost, dish: (typeof MENU)[number]): void {
    host.director.perform({
      id: 'call room service', actor: host.actor, point: this.room.at(SUITE.desk.front[0], SUITE.desk.front[1]), target: this.room.at(-4.1, 1.1), animation: { arms: 'talk' }, seconds: 2.4, effectAt: 0.7,
      effect: () => {
        if (!host.backend.pay(dish.price, `Room service: ${dish.label}`, 'FOOD_PURCHASE')) {
          host.say(`That is ${naira(dish.price)}. You do not have enough.`, 'warning');
          return false;
        }
        this.order = { dish, due: 14, stage: 'cooking' };
        host.say('☎️ "Fifteen minutes, sir. We will bring it up."', 'success');
        return true;
      },
    });
  }

  /** The waiter knocks, comes in with the tray, sets it on the desk and goes */
  private deliver(): void {
    if (!this.order) return;
    this.order.stage = 'coming';
    this.waiter ??= new Figure(this.room.group, 'eko-grand-waiter', 'Room service', { gender: 'male', username: '', outfit: 'lecturer_suit', outfitColor: 0xf8fafc, trousersColor: 0x111827, hasTie: true, hairstyle: 'short_crop' }, [0, 5.6], Math.PI);
    const w = this.waiter;
    w.root.visible = true;
    w.place(0, 5.4, Math.PI);
    w.say('Knock knock! Room service!', 3);
    w.walk([[0, 3.6], [-2.2, 1.1]], () => {
      w.face(-Math.PI / 2);
      w.pose('stand', 'reach');
      w.hold(0.9, () => {
        this.putTray(this.order!.dish.dish);
        this.order!.stage = 'served';
        this.delivered += 1;
        w.say('Enjoy your meal!', 2.5);
        w.walk([[0, 3.6], [0, 5.4]], () => { w.root.visible = false; }, { speed: 1.5 });
      });
    }, { arms: 'carry', speed: 1.3 });
  }

  private putTray(colour: number): void {
    this.tray?.removeFromParent();
    const b = new Builder();
    b.box(0xd6d3d1, 0.5, 0.02, 0.36, 0, 0, 0).cylinder(0xf8fafc, 0.14, 0.03, -0.06, 0.02, 0, { sides: 14 }).dome(colour, 0.1, -0.06, 0.05, 0).cylinder(0xf97316, 0.04, 0.12, 0.16, 0.02, 0.08, { sides: 8 });
    this.tray = new THREE.Group();
    this.tray.name = 'room service tray';
    this.tray.add(b.build('room service tray'));
    this.tray.position.set(-4.05, 0.76, 0.6);
    this.room.group.add(this.tray);
  }

  private eat(host: PlaceHost): void {
    const order = this.order;
    if (!order) return;
    const player = host.actor;
    if (host.director.interrupt(player) === 'locked') return;
    const meal = new Sequence('room service meal', [player]).add(
      steps.walk(player, this.room.at(SUITE.desk.front[0], SUITE.desk.front[1]), { speed: 2.4 }),
      steps.face(player, SUITE.desk.facing),
      steps.slide(player, this.room.at(SUITE.desk.seat[0], SUITE.desk.seat[1]), 0.45),
      steps.animate(player, { legs: 'sit', arms: 'eat' }, 6, [{
        at: 0.9, run: () => {
          host.backend.modifyNeed('hunger', order.dish.hunger);
          host.backend.modifyNeed('fun', order.dish.fun);
          this.tray?.removeFromParent();
          this.tray = null;
          this.order = null;
          host.say(`🍽️ ${order.dish.label}, hot from the kitchen. Every bite.`, 'success');
        },
      }]),
      steps.animate(player, { legs: 'stand', arms: 'rest' }, 0.3),
      steps.slide(player, this.room.at(SUITE.desk.front[0], SUITE.desk.front[1]), 0.4)
    );
    host.director.run(meal);
  }

  private minibar(host: PlaceHost): void {
    const items: Array<[string, number, Record<string, number>]> = [['A cold Chapman', 6_000, { fun: 8, hunger: 5 }], ['Malt and chin chin', 4_500, { hunger: 15, fun: 4 }], ['Bottled water', 2_000, { hunger: 2 }], ['A small bottle of champagne', 45_000, { fun: 20, social: 5 }]];
    host.ask({
      who: 'Minibar', role: 'Eko Grand Hotel', text: 'Cold drinks and snacks. Hotel prices, mind.',
      choices: [
        ...items.map(([label, price, need]) => ({
          label, note: naira(price),
          pick: () => {
            host.director.perform([
              { id: 'open the minibar', actor: host.actor, point: this.room.at(SUITE.minibar.stand[0], SUITE.minibar.stand[1]), target: this.room.at(SUITE.minibar.at[0], SUITE.minibar.at[1]), animation: { arms: 'reach' }, seconds: 1.1, effectAt: 0.6,
                effect: () => {
                  if (!host.backend.pay(price, `Minibar: ${label}`, 'FOOD_PURCHASE')) { host.say(`That is ${naira(price)}.`, 'warning'); return false; }
                  return true;
                } },
              { id: `minibar: ${label}`, actor: host.actor, animation: { arms: 'eat' }, seconds: 3, effectAt: 0.9,
                effect: () => {
                  for (const [k, v] of Object.entries(need)) host.backend.modifyNeed(k as 'fun', v);
                  host.say(`🧊 ${label}. Cold and good.`, 'success');
                  return true;
                } },
            ]);
          },
        })),
        { label: 'Not now', pick: () => undefined },
      ],
    });
  }

  private watch(host: PlaceHost): void {
    const player = host.actor;
    if (host.director.interrupt(player) === 'locked') return;
    const show = new Sequence('watch hotel television', [player]).add(
      steps.walk(player, this.room.at(SUITE.armchair.front[0], SUITE.armchair.front[1]), { speed: 2.4 }),
      steps.face(player, SUITE.armchair.facing),
      steps.call('television on', () => { this.screen.visible = true; }),
      steps.slide(player, this.room.at(SUITE.armchair.seat[0], SUITE.armchair.seat[1]), 0.45),
      steps.animate(player, { legs: 'sit', arms: 'rest' }, 8, [{
        at: 0.95, run: () => {
          host.backend.modifyNeed('fun', 18);
          host.backend.rest(8, 0, false);
          host.say('📺 Nollywood on the big screen, the AC humming. Proper relaxation.', 'success');
        },
      }]),
      steps.animate(player, { legs: 'stand', arms: 'rest' }, 0.3),
      steps.slide(player, this.room.at(SUITE.armchair.front[0], SUITE.armchair.front[1]), 0.4)
    );
    show.onEnd(() => { this.screen.visible = false; });
    host.director.run(show);
  }

  private look(host: PlaceHost): void {
    this.paintView();
    host.director.perform({
      id: 'look out over Lagos', actor: host.actor, point: this.room.at(SUITE.window.stand[0], SUITE.window.stand[1]), target: this.room.at(SUITE.window.at[0], SUITE.window.at[1]), animation: { arms: 'rest' }, seconds: 4, effectAt: 0.9,
      effect: () => {
        host.backend.modifyNeed('fun', 5);
        host.say(EventClock.now().hour >= 19 || EventClock.now().hour < 6 ? '🌃 Lagos at night: the bridge lit up across the lagoon, the towers glittering.' : '🌇 Lagos below: the lagoon, the bridge, the towers of the Island in the haze.', 'success');
        return true;
      },
    });
  }

  private tick(delta: number): void {
    this.paintView();
    const player = InteractionDirector.get().player;
    if (this.sleeping && player?.hold !== this.hold) this.sleeping = false;
    if (this.sleeping) {
      this.slept += delta;
      // As at home: energy and health come back while asleep, and they lie in for as long as they like
      const be = BackendService.getInstance();
      be.rest(9 * delta, 5 * delta, false);
      const stats = be.getData().stats;
      if (stats.energy >= 100 && stats.health >= 100 && this.slept > 3 && !this.restedTold) {
        this.restedTold = true;
        be.rest(0, 0);
        showGameToast('You are fully rested. Stay in bed as long as you like, or get up when you are ready.', 'success', 4200);
      }
    }
    if (this.order && this.order.stage === 'cooking') {
      this.order.due -= delta;
      if (this.order.due <= 0) this.deliver();
    }
    this.waiter?.tick(delta);
  }

  /** For the tests */
  public state(): Record<string, unknown> {
    return { number: this.number, delivered: this.delivered, sleeping: this.sleeping, order: this.order ? { stage: this.order.stage, dish: this.order.dish.label } : null, tray: !!this.tray?.parent, waiter: this.waiter ? { visible: this.waiter.root.visible, at: this.waiter.where().map((v) => +v.toFixed(2)), walking: this.waiter.walking } : null, tv: this.screen.visible };
  }
}

/**
 * The hotel's three rooms, known from the start: a room is built only the first time it is entered,
 * and the lift must be able to take the player up to a floor nobody has been to yet (it is built on
 * the way in). Without this the lift opened, closed, and went nowhere.
 */
export function knowHotelRoom(room: PlaceInterior, key: string): void {
  if (key === HOTEL.lobby || key === HOTEL.floor || key === HOTEL.suite || key.endsWith('-town-hotel') || key.endsWith('-town-suite')) rooms.set(key, room);
}

/** A night at an Abuja or Port Harcourt hotel: its own key and room, the same idea as the Eko Grand */
export const TOWN_NIGHT = 72_000;
const TOWN_ROOMS = [12, 14, 16, 18];

export class TownStay {
  private static all = new Map<string, TownStay>();
  public static get(hotel: string): TownStay {
    let stay = TownStay.all.get(hotel);
    if (!stay) TownStay.all.set(hotel, stay = new TownStay(hotel));
    return stay;
  }
  public now: () => { day: number; hour: number } = () => EventClock.now();
  private stay: Stay | null = null;
  private readonly hotel: string;
  private constructor(hotel: string) { this.hotel = hotel; }
  private key(): string { return `nl_town_hotel_v1:${Activity.player()}:${this.hotel}`; }
  private load(): void {
    try { this.stay = JSON.parse(localStorage.getItem(this.key()) ?? 'null'); } catch { this.stay = null; }
  }
  private save(): void {
    try { localStorage.setItem(this.key(), JSON.stringify(this.stay)); } catch { /* private window */ }
  }
  public current(): Stay | null {
    this.load();
    const s = this.stay;
    if (!s) return null;
    if (s.expiresAt && Date.now() >= s.expiresAt) return null;
    const { day, hour } = this.now();
    if (day > s.until || (day === s.until && hour >= 12)) return null;
    return s;
  }
  public lapsed(): Stay | null {
    this.load();
    return this.stay && !this.current() ? this.stay : null;
  }
  public checkIn(nights: number, paid: number): Stay {
    const { day, hour } = this.now();
    const from = hour < 6 ? day - 1 : day;
    const until = from + nights;
    const room = TOWN_ROOMS[(day + nights + Math.floor(hour)) % TOWN_ROOMS.length];
    const co = new Date();
    co.setDate(co.getDate() + nights);
    co.setHours(12, 0, 0, 0);
    this.stay = { room, from, until, paid, expiresAt: co.getTime() };
    this.save();
    return this.stay;
  }
  public extend(nights: number, paid: number): Stay | null {
    const s = this.current();
    if (!s) return null;
    s.until += nights;
    s.paid += paid;
    const co = new Date(s.expiresAt || Date.now());
    co.setDate(co.getDate() + nights);
    co.setHours(12, 0, 0, 0);
    s.expiresAt = co.getTime();
    this.save();
    return s;
  }
  public checkOut(): void { this.stay = null; this.save(); }
  public until(s: Stay): string { return `noon on ${dayName(s.until)}`; }
  public keyItem(): string { return `town_key_${this.hotel}`; }
}

/** Front desk, a key card, and the door to the guest room */
class TownLobby {
  private readonly room: PlaceInterior;
  private readonly hotel: string;
  constructor(room: PlaceInterior, hotel: string) {
    this.room = room;
    this.hotel = hotel;
    const stay = () => TownStay.get(hotel);
    room.addCard({
      id: `place_${hotel}_reception`, name: '🛎️ Reception', description: 'A room for the night, and a key card.',
      at: [-4, -5], stand: [-4, -3.6],
      label: () => {
        const s = stay().current();
        return s ? `🛎️ Reception · room ${s.room}` : `🛎️ Check in · ${naira(TOWN_NIGHT)} a night`;
      },
      run: (host) => this.desk(host),
    });
    room.addCard({
      id: `place_${hotel}_room`, name: '🔑 Your room', description: 'Up to the room on your key card.',
      at: [0, -8.2], stand: [0, -6.6],
      label: () => {
        const s = stay().current();
        return s ? `🔑 To room ${s.room}` : '🔑 Your room (check in first)';
      },
      run: (host) => this.toRoom(host),
    });
  }

  private desk(host: PlaceHost): void {
    const hotel = TownStay.get(this.hotel);
    const s = hotel.current();
    const lapsed = hotel.lapsed();
    const name = this.room.spec.name;
    const choices: Array<{ label: string; note?: string; pick: () => void }> = [];
    if (s) {
      choices.push({ label: 'Stay another night', note: naira(TOWN_NIGHT), pick: () => this.book(host, 1) });
      choices.push({ label: 'Check out', note: 'Hand the key card back', pick: () => this.leave(host) });
    } else {
      for (const [nights, label] of [[1, 'Tonight'], [2, 'Two nights'], [3, 'Three nights']] as Array<[number, string]>) {
        choices.push({ label, note: naira(TOWN_NIGHT * nights), pick: () => this.book(host, nights) });
      }
      if (lapsed) choices.push({ label: 'Hand back the old key card', note: `Room ${lapsed.room}`, pick: () => this.leave(host) });
    }
    choices.push({ label: 'Not now', pick: () => undefined });
    host.ask({
      who: 'Front desk', role: name,
      text: s ? `Room ${s.room} is yours until ${hotel.until(s)}.` : lapsed ? `Your stay in room ${lapsed.room} has ended. Another night?` : `Welcome to ${name}. A room for how many nights? Out by noon.`,
      choices,
    });
  }

  private book(host: PlaceHost, nights: number): void {
    const hotel = TownStay.get(this.hotel);
    const price = TOWN_NIGHT * nights;
    const extending = !!hotel.current();
    const name = this.room.spec.name;
    host.director.perform({
      id: extending ? 'another night' : 'check in', actor: host.actor, point: this.room.at(-4, -3.6), target: this.room.at(-4, -5),
      animation: { arms: 'reach' }, seconds: 1.4, effectAt: 0.55,
      effect: () => {
        if (!host.backend.pay(price, `${name}: ${nights === 1 ? 'a night' : `${nights} nights`}`, 'SHOP_PURCHASE')) {
          host.say(`That is ${naira(price)}. You do not have enough.`, 'warning');
          return false;
        }
        const s = extending ? hotel.extend(nights, price)! : hotel.checkIn(nights, price);
        host.backend.removeItem(hotel.keyItem());
        host.backend.addItem({ id: hotel.keyItem(), name: `Room ${s.room} key card`, icon: '💳', price: 0, category: 'key', usable: false, description: `${name}, room ${s.room}. Until ${hotel.until(s)}.` });
        host.say(extending ? `🛎️ Another night in room ${s.room}, until ${hotel.until(s)}.` : `🛎️ Checked in: room ${s.room}, until ${hotel.until(s)}. The key card is in your bag.`, 'success');
        return true;
      },
    });
  }

  private leave(host: PlaceHost): void {
    const hotel = TownStay.get(this.hotel);
    host.director.perform({
      id: 'check out', actor: host.actor, point: this.room.at(-4, -3.6), target: this.room.at(-4, -5),
      animation: { arms: 'reach' }, seconds: 1.2, effectAt: 0.5,
      effect: () => {
        hotel.checkOut();
        host.backend.removeItem(hotel.keyItem());
        host.say('🛎️ Checked out. The key card is handed back.', 'success');
        return true;
      },
    });
  }

  private toRoom(host: PlaceHost): void {
    const hotel = TownStay.get(this.hotel);
    const s = hotel.current();
    if (!s) {
      host.say(hotel.lapsed() ? 'Your stay has ended. See the front desk.' : 'Check in at the front desk for a key card.', 'info');
      return;
    }
    const suiteKey = this.hotel.endsWith('-hotel') ? this.hotel.replace(/-hotel$/, '-suite') : `${this.hotel}-suite`;
    const suite = rooms.get(suiteKey);
    const id = suite?.def.id ?? `interior_place_${suiteKey}`;
    const at = suite ? suite.at(1.2, -1.2) : this.room.at(0, 2);
    host.ride(id, at, Math.PI);
  }
}

/** Where the bed sits, and which side of the room the bathroom is on. Abuja and Port Harcourt are mirrored. */
function roomPlan(hotel: string): { bed: { x: number; z: number }; side: number; variant: number } {
  const variant = hotel.includes('-hotel-1') ? 1 : hotel.includes('-hotel-2') ? 2 : 0;
  const side = (hotel.startsWith('port') ? -1 : 1) * (variant === 2 ? -1 : 1);
  const bed = variant === 1 ? { x: 0, z: -1.4 } : { x: -side * 2.1, z: -2.3 };
  return { bed, side, variant };
}

const lay = (parent: THREE.Object3D, object: THREE.Object3D, x: number, y: number, z: number, yaw = 0): void => {
  object.position.set(x, y, z);
  object.rotation.y = yaw;
  object.traverse((child) => child.layers.set(RENDER_LAYERS.INTERIOR));
  parent.add(object);
};

/**
 * A real guest room: a king bed, the window, a desk, a wardrobe, and an en-suite.
 * Abuja is terracotta and gold. Port Harcourt is river green, and the bathroom is on the other side.
 */
function furnishGuestRoom(room: THREE.Object3D, hotel: string): { x: number; z: number } {
  const ph = hotel.startsWith('port');
  const { bed, side, variant } = roomPlan(hotel);
  const cover = variant === 1 ? (ph ? 0x1e3a8a : 0xb45309) : variant === 2 ? (ph ? 0x7c2d12 : 0x14532d) : ph ? 0x0f766e : 0x9a3412;
  const trim = variant === 0 && !ph ? 0xf5e6c8 : 0xe0f2fe;
  const wood = variant === 2 ? 0x3f3f46 : ph ? 0x44403c : 0x6b3f1d;
  lay(room, fineBed(1.7, cover, trim, wood), bed.x, 0, bed.z, 0);
  const b = new Builder();
  for (const edge of [-1, 1]) {
    const x = bed.x + edge * 1.35;
    b.box(wood, 0.46, 0.52, 0.42, x, 0, bed.z - 0.95);
    b.cylinder(0x1c1917, 0.025, 0.28, x, 0.52, bed.z - 0.95, { sides: 6 });
    b.cone(0xfde68a, 0.14, 0.18, x, 0.78, bed.z - 0.95, 12, { glow: true });
  }
  b.box(ph ? 0x134e4a : 0x7c2d12, 5.4, 0.02, 4.4, bed.x, 0.01, bed.z + 0.15);
  // The window, with the city beyond the glass and the curtains drawn back
  b.box(ph ? 0x0369a1 : 0x7dd3fc, 2.6, 1.55, 0.05, bed.x, 1.75, -6.85, { glow: true });
  b.box(0x1e293b, 2.2, 0.35, 0.04, bed.x, 1.15, -6.8);
  for (const edge of [-1, 1]) b.box(cover, 0.22, 2.15, 0.08, bed.x + edge * 1.45, 1.6, -6.55);
  for (const edge of [-1, 1]) b.box(trim, 0.42, 1.85, 0.05, bed.x + edge * 1.05, 1.55, -6.5);
  // The television on a console at the foot of the bed
  const tvZ = bed.z + 2.2;
  b.box(wood, 1.7, 0.42, 0.42, bed.x, 0, tvZ);
  b.box(0x0a0a0a, 1.4, 0.8, 0.06, bed.x, 1.4, tvZ - 0.16);
  b.box(0x1e293b, 1.26, 0.66, 0.02, bed.x, 1.4, tvZ - 0.2, { glow: true });
  // A desk under the window, on the side away from the bathroom
  const deskX = -side * 5.8;
  b.box(wood, 1.35, 0.75, 0.62, deskX, 0, -4.8);
  b.box(0xe5e7eb, 0.95, 0.28, 0.18, side * 1.6, 2.55, -6.75);
  b.box(ph ? 0x0e7490 : 0xb45309, 1.05, 0.7, 0.04, side * 7.7, 1.7, -1.2);
  b.box(0xfef3c7, 0.82, 0.5, 0.02, side * 7.68, 1.7, -1.2);
  b.box(0x111827, 0.16, 0.24, 0.05, 0.9, 1.15, 6.55);
  b.box(0x22c55e, 0.08, 0.016, 0.02, 0.9, 1.2, 6.52, { glow: true });
  b.box(0x78350f, 1.15, 0.26, 0.4, bed.x + side * 1.7, 0, bed.z + 1.35);
  b.box(0xf5f5f4, 0.12, 2.35, 3.4, side * 3.6, 0, 4.2);
  b.box(ph ? 0x99f6e4 : 0xfde68a, 3.6, 0.025, 4.2, side * 5.7, 0.02, 4.3);
  b.box(trim, 0.42, 0.7, 0.05, side * 7.7, 1.35, 4.4);
  // A shower beside the bath: a stall, a curtain and a head
  b.box(0xe7e5e4, 0.08, 2.05, 1.15, side * 4.15, 0, 2.7);
  b.box(0xf8fafc, 0.04, 1.7, 0.9, side * 4.28, 0.1, 2.7);
  b.cylinder(0xcbd5e1, 0.08, 0.04, side * 5.15, 2.05, 2.35);
  room.add(b.build('guest room', { roughness: 0.65 }));
  lay(room, cityBeyond(ph ? 'ph' : 'abuja'), bed.x, 1.78, -6.78);
  const tiles = new THREE.Mesh(
    new THREE.BoxGeometry(3.6, 0.02, 4.8),
    (() => {
      const map = repeated(smallTiles(ph ? '#d5efe6' : '#f4ead8'), 9, 12);
      return new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.35, ...(map ? { map } : {}) });
    })(),
  );
  tiles.name = 'bathroom tiles';
  lay(room, tiles, side * 5.6, 0.02, 4.15);
  lay(room, fineWardrobe(), -side * 6.4, 0, 0.2, side > 0 ? -Math.PI / 2 : Math.PI / 2);
  lay(room, fineSofa(1, cover, trim, wood), side * 1.1, 0, 1.5, Math.PI);
  lay(room, fineSofa(1, wood, trim, wood), deskX, 0, -3.85, Math.PI);
  const fridge = fineFridge();
  fridge.scale.setScalar(0.55);
  lay(room, fridge, side * 5.9, 0, -0.6, side > 0 ? -Math.PI / 2 : Math.PI / 2);
  lay(room, fineToilet(), side * 5.9, 0, 5.5, Math.PI);
  lay(room, fineBathtub(), side * 5.5, 0, 2.7, side > 0 ? Math.PI / 2 : -Math.PI / 2);
  lay(room, fineLamp(), bed.x - side * 2.6, 0, bed.z + 1.8, 0);
  // The mirror sits on the outside wall. wallBack is behind the basin, in the basin's own space.
  lay(room, fineBasin(-0.32), side * 6.15, 0, 6.15, side > 0 ? -Math.PI / 2 : Math.PI / 2);
  return bed;
}

/** What is outside the glass: Aso Rock and the dome in Abuja, the creek and a bridge in Port Harcourt. */
function cityBeyond(city: 'abuja' | 'ph'): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2.15, 1.28), new THREE.MeshBasicMaterial({ color: 0xffffff }));
  mesh.name = 'window view';
  if (typeof document === 'undefined') return mesh;
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 320;
  const g = c.getContext('2d');
  if (!g) return mesh;
  const sky = g.createLinearGradient(0, 0, 0, 210);
  if (city === 'abuja') {
    sky.addColorStop(0, '#7eb6e8');
    sky.addColorStop(1, '#f6d2a0');
    g.fillStyle = sky;
    g.fillRect(0, 0, 512, 320);
    g.fillStyle = '#6b7280';
    g.beginPath();
    g.moveTo(30, 214);
    g.lineTo(150, 78);
    g.lineTo(280, 214);
    g.fill();
    g.fillStyle = '#15803d';
    g.beginPath();
    g.ellipse(370, 168, 54, 30, 0, Math.PI, 0);
    g.fill();
    g.fillStyle = '#e5e7eb';
    g.fillRect(330, 168, 80, 46);
  } else {
    sky.addColorStop(0, '#5eaddf');
    sky.addColorStop(1, '#fde68a');
    g.fillStyle = sky;
    g.fillRect(0, 0, 512, 320);
    g.fillStyle = '#0e7490';
    g.fillRect(0, 168, 512, 152);
    g.fillStyle = '#f8fafc';
    g.fillRect(0, 188, 512, 7);
    g.fillStyle = '#334155';
    for (let x = 16; x < 512; x += 46) g.fillRect(x, 195, 5, 28);
    g.fillStyle = '#14532d';
    g.fillRect(0, 230, 90, 90);
    g.fillRect(430, 214, 82, 106);
  }
  g.fillStyle = city === 'abuja' ? '#166534' : '#0f766e';
  if (city === 'abuja') g.fillRect(0, 214, 512, 106);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  (mesh.material as THREE.MeshBasicMaterial).map = tex;
  return mesh;
}

/** The guest room: a bed to sleep in for as long as the stay lasts */
class TownSuite {
  private readonly hold: { release: (instant?: boolean) => void };
  private sleeping = false;
  private seated = false;
  private lampOn = false;
  private lampLight: THREE.PointLight | null = null;
  private duvet: THREE.Group | null = null;
  private bedCloth: THREE.Mesh | null = null;
  private slept = 0;
  private restedTold = false;
  private readonly room: PlaceInterior;
  private readonly hotel: string;
  private readonly bed: { x: number; z: number };
  constructor(room: PlaceInterior, hotel: string) {
    this.room = room;
    this.hotel = hotel;
    this.hold = { release: (instant) => this.getUp(instant) };
    this.bed = furnishGuestRoom(room.group, hotel);
    const bed = this.bed;
    const side = roomPlan(hotel).side;
    const standX = bed.x + (bed.x < 0 ? 1.6 : -1.6);
    room.addCard({
      id: `place_${room.spec.key}_bed`, name: '🛏️ The bed', description: 'Clean sheets. Yours until noon.',
      at: [bed.x, bed.z], stand: [standX, bed.z + 0.6],
      label: () => (this.sleeping ? '🛏️ Sleeping' : '🛏️ Sleep'),
      run: (host) => this.sleep(host),
    });
    room.addCard({
      id: `place_${room.spec.key}_chair`, name: '🪑 The chair', description: 'A seat in the room.',
      at: [side * 1.1, 1.5], stand: [side * 1.1, 2.4],
      label: () => (this.seated ? '🪑 Sitting' : '🪑 Sit'),
      run: (host) => this.sit(host),
    });
    room.addCard({
      id: `place_${room.spec.key}_toilet`, name: '🚽 The toilet', description: 'The en-suite.',
      at: [side * 5.9, 5.5], stand: [side * 5.9, 4.5],
      label: () => '🚽 Use the toilet',
      run: (host) => this.useToilet(host),
    });
    room.addCard({
      id: `place_${room.spec.key}_bath`, name: '🚿 The shower', description: 'Hot water beside the bath.',
      at: [side * 5.5, 2.7], stand: [side * 5.2, 1.5],
      label: () => '🚿 Take a shower',
      run: (host) => this.wash(host),
    });
    room.addCard({
      id: `place_${room.spec.key}_lamp`, name: '💡 The lamp', description: 'The floor lamp by the bed.',
      at: [bed.x - side * 2.6, bed.z + 1.8], stand: [bed.x - side * 2.2, bed.z + 1.2],
      label: () => (this.lampOn ? '💡 Lamp on' : '💡 Lamp off'),
      run: (host) => this.lamp(host),
    });
    room.leadsTo = () => {
      const lobby = rooms.get(hotel);
      if (!lobby) return null;
      return { id: lobby.def.id, spawnAt: lobby.at(0, -6.6), spawnYaw: Math.PI };
    };
    room.ticks.push((delta) => this.tick(delta));
  }

  /** The room is theirs only after they have checked in */
  private stayOrSay(host: PlaceHost): boolean {
    if (TownStay.get(this.hotel).current()) return true;
    host.say(TownStay.get(this.hotel).lapsed() ? 'Your stay has ended. See the front desk.' : 'This room is not yours yet. Check in at the desk.', 'info');
    return false;
  }

  /** Sit in the chair. Getting up is the same hold the bed uses, so one tap stands them. */
  private sit(host: PlaceHost): void {
    if (!this.stayOrSay(host)) return;
    const actor = host.actor;
    if (this.seated || this.sleeping || host.director.interrupt(actor) === 'locked') return;
    const side = roomPlan(this.hotel).side;
    const seat = this.room.at(side * 1.1, 1.2);
    const stand = this.room.at(side * 1.1, 2.4);
    const down = new Sequence('sit in the chair', [actor]).add(
      steps.walk(actor, stand, { speed: 2.2, ifStuck: 'snap' }),
      steps.face(actor, seat),
      steps.slide(actor, seat, 0.45),
      steps.setPose(actor, { legs: 'sit', arms: 'rest' }),
      steps.wait(0.3),
    );
    down.onEnd((reason) => {
      if (reason !== 'done') return;
      actor.hold = { release: (instant) => this.standFrom(stand, instant) };
      actor.setScripted(true);
      actor.pose = { legs: 'sit', arms: 'rest' };
      this.seated = true;
      host.say('You sit down.', 'info');
    });
    host.director.run(down);
  }

  private standFrom(stand: THREE.Vector3, instant?: boolean): void {
    const player = InteractionDirector.get().player;
    this.seated = false;
    if (!player) return;
    player.hold = null;
    if (instant) { player.setScripted(false); return; }
    const rise = new Sequence('get up from the chair', [player]).locked().add(
      steps.setPose(player, { legs: 'stand', arms: 'rest' }),
      steps.slide(player, stand, 0.45),
    );
    if (!InteractionDirector.get().run(rise)) player.setScripted(false);
  }

  private useToilet(host: PlaceHost): void {
    if (!this.stayOrSay(host)) return;
    const actor = host.actor;
    if (host.director.interrupt(actor) === 'locked') return;
    const side = roomPlan(this.hotel).side;
    const at = (x: number, z: number) => this.room.at(x, z);
    const use = new Sequence('hotel toilet', [actor]).add(
      steps.walk(actor, at(side * 5.9, 4.5), { ifStuck: 'snap' }),
      steps.face(actor, at(side * 5.9, 5.5)),
      steps.slide(actor, at(side * 5.9, 5.15), 0.45),
      steps.setPose(actor, { legs: 'sit', arms: 'rest' }),
      steps.wait(2.2),
      steps.call('relieved', () => {
        host.backend.relieveBladder();
        showGameToast('🚽 Relieved. *Flush*', 'success', 2200);
      }),
      steps.setPose(actor, { legs: 'stand', arms: 'rest' }),
      steps.slide(actor, at(side * 5.9, 4.5), 0.45),
    );
    host.director.run(use);
  }

  private wash(host: PlaceHost): void {
    if (!this.stayOrSay(host)) return;
    const actor = host.actor;
    if (host.director.interrupt(actor) === 'locked') return;
    const side = roomPlan(this.hotel).side;
    const at = (x: number, z: number) => this.room.at(x, z);
    const wash = new Sequence('hotel shower', [actor]).add(
      steps.walk(actor, at(side * 5.2, 1.5), { ifStuck: 'snap' }),
      steps.face(actor, at(side * 5.5, 2.7)),
      steps.slide(actor, at(side * 5.35, 2.2), 0.55),
      steps.animate(actor, { arms: 'reach' }, 3.2, [{ at: 0.7, run: () => {
        host.backend.takeShower();
        host.say('🚿 A hot shower. You are clean.', 'success');
      } }]),
      steps.slide(actor, at(side * 5.2, 1.5), 0.55),
    );
    host.director.run(wash);
  }

  private lamp(host: PlaceHost): void {
    if (!this.lampLight) {
      const side = roomPlan(this.hotel).side;
      this.lampLight = new THREE.PointLight(0xffe0b0, 0, 7);
      this.lampLight.position.set(this.bed.x - side * 2.6, 1.5, this.bed.z + 1.8);
      this.room.group.add(this.lampLight);
    }
    this.lampOn = !this.lampOn;
    this.lampLight.intensity = this.lampOn ? 1.3 : 0;
    host.say(this.lampOn ? '💡 The lamp is on.' : 'The lamp is off.', 'info');
  }

  private sleep(host: PlaceHost): void {
    const stay = TownStay.get(this.hotel).current();
    if (!stay) {
      host.say(TownStay.get(this.hotel).lapsed() ? 'Your stay has ended. The bed is made up for the next guest.' : 'This room is not yours yet. Check in at the desk.', 'info');
      return;
    }
    const player = host.actor;
    if (this.sleeping || host.director.interrupt(player) === 'locked') return;
    const bed = this.bed;
    const standX = bed.x + (bed.x < 0 ? 1.6 : -1.6);
    // The foot of the bed points toward the door. The head is on the pillows.
    const facing = 0;
    const top = 0.72;
    // Feet at the footboard. Lying faces the foot, so the head lands on the pillows.
    const feet = { x: bed.x, z: bed.z + 0.85 };
    const lying = { legs: 'lie' as const, arms: 'rest' as const, height: top };
    const lieDown = new Sequence('lie down', [player]).add(
      steps.walk(player, this.room.at(standX, bed.z + 0.6), { speed: 2.4 }),
      steps.face(player, this.room.at(bed.x, bed.z)),
      steps.slide(player, this.room.at(feet.x, feet.z), 0.5),
      steps.face(player, facing),
      steps.setPose(player, lying),
      steps.wait(0.4),
    );
    lieDown.onEnd((reason) => {
      if (reason !== 'done') return;
      player.yaw = facing;
      player.hold = this.hold;
      player.setScripted(true);
      player.pose = lying;
      this.sleeping = true;
      this.slept = 0;
      this.restedTold = false;
      this.duvet?.removeFromParent();
      if (this.bedCloth) this.bedCloth.visible = true;
      this.bedCloth = bedDuvetNear(this.room.group, feet);
      this.duvet = duvetOver(this.room.group, feet, facing, top, this.bedCloth);
      if (this.bedCloth) this.bedCloth.visible = false;
      host.say(`🛏️ Room ${stay.room}. You drift off.`, 'info');
    });
    host.director.run(lieDown);
  }

  private getUp(instant?: boolean): void {
    const player = InteractionDirector.get().player;
    this.sleeping = false;
    this.duvet?.removeFromParent();
    this.duvet = null;
    if (this.bedCloth) this.bedCloth.visible = true;
    this.bedCloth = null;
    if (!player) return;
    player.hold = null;
    if (instant) { player.setScripted(false); return; }
    const standX = this.bed.x + (this.bed.x < 0 ? 1.6 : -1.6);
    const rise = new Sequence('get up', [player]).locked().add(
      steps.setPose(player, { legs: 'stand', arms: 'rest' }),
      steps.slide(player, this.room.at(standX, this.bed.z + 0.6), 0.5),
    );
    if (!InteractionDirector.get().run(rise)) player.setScripted(false);
  }

  private tick(delta: number): void {
    const player = InteractionDirector.get().player;
    if (this.sleeping && player?.hold !== this.hold) this.sleeping = false;
    if (!this.sleeping) return;
    this.slept += delta;
    const be = BackendService.getInstance();
    be.rest(9 * delta, 5 * delta, false);
    const stats = be.getData().stats;
    if (stats.energy >= 100 && stats.health >= 100 && this.slept > 3 && !this.restedTold) {
      this.restedTold = true;
      showGameToast('You are fully rested. Stay in bed, or get up when you are ready.', 'success', 3600);
    }
  }
}

/** Gives each part of the hotel what it needs, as it is built */
const townHotelKey = (key: string) => key.endsWith('-town-hotel') || /-hotel-[12]$/.test(key);
const townSuiteKey = (key: string) => key.endsWith('-town-suite') || /-hotel-[12]-suite$/.test(key);

export function attachHotel(room: PlaceInterior, key: string): void {
  if (townHotelKey(key)) {
    rooms.set(key, room);
    new TownLobby(room, key);
    return;
  }
  if (townSuiteKey(key)) {
    rooms.set(key, room);
    const hotel = key.endsWith('-town-suite') ? key.replace(/-suite$/, '-hotel') : key.replace(/-suite$/, '');
    new TownSuite(room, hotel);
    return;
  }
  if (key !== HOTEL.lobby && key !== HOTEL.floor && key !== HOTEL.suite) return;
  rooms.set(key, room);
  if (key === HOTEL.lobby) HotelState.lobby = new Lobby(room);
  else if (key === HOTEL.floor) HotelState.floor = new Floor(room);
  else {
    HotelState.suite = new Suite(room);
    if (arriving !== null) {
      HotelState.suite.arrive(arriving);
      arriving = null;
    }
  }
}
