import * as THREE from 'three';
import type { PlaceHost } from '../../destinations/PlaceActions';
import { Sequence, steps } from '../../interactions/Sequence';
import type { PlaceInterior } from './PlaceInterior';

/**
 * Every chair, bench and armchair in a place that can be sat on: walk up to it, turn, sit down,
 * and stay sat until you walk off. Seats are gathered by table or by bench, each group with one
 * "Sit down" card in front of it; the nearest free seat of the group is the one taken. Seats
 * people already sit on (the room's own crowd) are left out by whoever makes the list.
 */
export interface Seat {
  /** Where the seat's middle is (room coordinates), the way the sitter faces, how high the cushion is */
  x: number;
  z: number;
  yaw: number;
  top: number;
  /** One card per group (a table's chairs, a bench) */
  group: string;
  /** How far forward of the seat's middle the hips go (a deep armchair more) */
  forward?: number;
  /** Where the sitter walks up to before sitting (beside a chair pulled up to a table); else in front of it */
  from?: [number, number];
}

/** The lift the sitting pose needs for a cushion at `top` (the pose is made for a 0.45 m chair) */
const lift = (top: number) => Math.max(0, top - 0.45) + 0.28;

export function addSeats(room: PlaceInterior, seats: Seat[], card: { name: string; description: string } = { name: '🪑 Seats', description: 'Sit down a while.' }): void {
  const groups = new Map<string, Seat[]>();
  for (const s of seats) groups.set(s.group, [...(groups.get(s.group) ?? []), s]);
  // Numbered on from any seats the room already has, so two lists of seats never share a card
  const prefix = `place_${room.spec.key}_sit_`;
  let n = room.interactiveList.filter((o) => o.id.startsWith(prefix)).length;
  for (const [, list] of groups) {
    const id = `${prefix}${n++}`;
    const mx = list.reduce((a, s) => a + s.x, 0) / list.length;
    const mz = list.reduce((a, s) => a + s.z, 0) / list.length;
    // The card stands in front of the first seat, where the player walks up to it
    const f = list[0];
    const stand: [number, number] = f.from ?? [f.x + Math.sin(f.yaw) * 0.75, f.z + Math.cos(f.yaw) * 0.75];
    room.addCard({
      id, name: card.name, description: card.description, at: [mx, mz], stand,
      label: () => '🪑 Sit down',
      run: (host: PlaceHost) => {
        const actor = host.actor;
        const here = actor.root.position.clone().sub(room.group.position);
        const free = list
          .filter((s) => !host.director.isTaken(`${id}_${s.x.toFixed(2)}_${s.z.toFixed(2)}`))
          .sort((a, b) => (a.x - here.x) ** 2 + (a.z - here.z) ** 2 - ((b.x - here.x) ** 2 + (b.z - here.z) ** 2))[0];
        if (!free) {
          host.say('Every seat here is taken. Try another one.', 'info');
          return;
        }
        if (!sitOn(room, host, free, `${id}_${free.x.toFixed(2)}_${free.z.toFixed(2)}`)) host.say('You cannot sit down just now.', 'info');
      },
    });
  }
}

/** Walks to the seat and sits on it, staying sat until the player moves or does something else */
export function sitOn(room: PlaceInterior, host: PlaceHost, seat: Seat, key: string): boolean {
  const player = host.actor;
  const director = host.director;
  if (director.interrupt(player) === 'locked') return false;
  if (!director.reserve(key, player)) return false;
  const fx = Math.sin(seat.yaw);
  const fz = Math.cos(seat.yaw);
  const front = seat.from ? room.at(seat.from[0], seat.from[1]) : room.at(seat.x + fx * 0.6, seat.z + fz * 0.6);
  const forward = seat.forward ?? 0.17;
  const on = room.at(seat.x + fx * forward, seat.z + fz * forward);
  const pose = { legs: 'sit' as const, arms: 'rest' as const, height: lift(seat.top) };
  const sit = new Sequence('sit down', [player]).add(
    steps.walk(player, front, { nav: room.nav, ifStuck: 'snap' }),
    steps.face(player, seat.yaw),
    steps.slide(player, on, 0.45),
    steps.setPose(player, pose),
    steps.wait(0.25),
  );
  sit.onEnd((reason) => {
    if (reason !== 'done') {
      director.release(key, player);
      return;
    }
    player.yaw = seat.yaw;
    player.setScripted(true);
    player.pose = { ...pose };
    player.hold = {
      release: (instant) => {
        player.hold = null;
        director.release(key, player);
        if (instant) {
          player.setScripted(false);
          return;
        }
        const rise = new Sequence('get up', [player]).locked().add(steps.setPose(player, { legs: 'stand', arms: 'rest' }), steps.slide(player, front, 0.5));
        if (!director.run(rise)) player.setScripted(false);
      },
    };
  });
  const ok = director.run(sit);
  if (!ok) director.release(key, player);
  return ok;
}

/** Chairs round a table: two along each long side of a table `w` wide (along x turned by `yaw`), facing it */
export function chairsRound(x: number, z: number, w: number, d: number, yaw: number, group: string, top = 0.46): Seat[] {
  const out: Seat[] = [];
  const s = Math.sin(yaw);
  const c = Math.cos(yaw);
  const per = w >= 1.5 ? [-w / 4, w / 4] : [0];
  for (const side of [-1, 1]) for (const t of per) {
    const lx = t;
    const lz = side * (d / 2 + 0.42);
    // Come up beside the chair, at the table's end side of it, and slide in
    const ox = lx + (t < 0 ? -0.62 : 0.62);
    out.push({ x: x + c * lx + s * lz, z: z - s * lx + c * lz, yaw: yaw + (side < 0 ? 0 : Math.PI), top, group, from: [x + c * ox + s * lz, z - s * ox + c * lz] });
  }
  return out;
}

export const seatPoint = (s: Seat): THREE.Vector2 => new THREE.Vector2(s.x, s.z);
