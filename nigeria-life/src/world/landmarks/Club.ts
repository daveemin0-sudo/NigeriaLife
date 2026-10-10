import * as THREE from 'three';
import { Builder, signBoard } from '../kit/ArchKit';
import { clickBox, figure, type Landmark } from './Landmark';
import { HingedDoor } from '../../interactions/Door';
import { InteractionDirector } from '../../interactions/InteractionDirector';
import { type OpeningHours, isOpen, closedNotice, describeHours } from '../../destinations/Hours';

/**
 * A nightclub from the street: a dark block with a lit front, a canopy over a real door with
 * a rope and a doorman, and a roof terrace. Its door leads to the club inside, and it keeps
 * hours: outside them the door stays shut.
 *
 * Everything is measured from the middle of the building. The door is in the west face.
 */

const HALF_X = 7;
const HALF_Z = 6;
const HEIGHT = 7;

export interface ClubOptions {
  /** The id its door and its room inside are known by */
  id: string;
  name: string;
  /** The middle of the building */
  x: number;
  z: number;
  hours: OpeningHours;
  gateFee: number;
}

export function createClub(options: ClubOptions): Landmark {
  const site = { x: options.x, z: options.z };
  const at = (x: number, z: number) => new THREE.Vector3(site.x + x, 0, site.z + z);
  const b = new Builder();
  const BODY = 0x18181b;
  const TRIM = 0x27272a;
  const PINK = 0xec4899;
  const VIOLET = 0xa855f7;
  const front = -HALF_X;

  b.box(BODY, HALF_X * 2, HEIGHT, HALF_Z * 2, 0, 0, 0, { solid: true });
  b.ground(0x44403c, 3.2, HALF_Z * 2 + 2, front - 1.6, 0.02, 0);

  // The way in: two piers and a head, a canopy lit from underneath
  for (const z of [-2.3, 2.3]) b.box(TRIM, 0.7, 4.5, 0.7, front - 0.3, 0, z);
  b.box(TRIM, 0.7, 0.8, 5.3, front - 0.3, 4.5, 0);
  b.box(0x0a0a0a, 2.6, 0.2, 5.6, front - 1.5, 3.6, 0).box(PINK, 2.4, 0.05, 5.3, front - 1.5, 3.54, 0, { glow: true });
  b.box(0x3b0764, 0.06, 2.6, 1.5, front - 0.02, 0, 0, { glow: true });

  // Light down the front, and a band of it round the top
  for (const z of [-5.2, -3.7, 3.7, 5.2]) b.box(VIOLET, 0.06, 5.4, 0.26, front - 0.03, 0.7, z, { glow: true });
  b.box(PINK, 0.08, 0.3, HALF_Z * 2 - 0.4, front - 0.04, 6.35, 0, { glow: true });
  for (const side of [-1, 1]) {
    b.box(PINK, HALF_X * 2 - 0.4, 0.3, 0.08, 0, 6.35, side * (HALF_Z + 0.04), { glow: true });
    for (const x of [-4, 0, 4]) b.box(VIOLET, 0.26, 4.2, 0.06, x, 1.2, side * (HALF_Z + 0.03), { glow: true });
  }
  b.box(0x0a0a0f, 0.1, 1.7, 6.7, front - 0.68, 4.25, 0);

  // The roof terrace: a parapet with a lit edge, and a bar under an awning
  b.box(TRIM, HALF_X * 2 + 0.3, 0.9, 0.3, 0, HEIGHT, -HALF_Z).box(TRIM, HALF_X * 2 + 0.3, 0.9, 0.3, 0, HEIGHT, HALF_Z);
  b.box(TRIM, 0.3, 0.9, HALF_Z * 2 + 0.3, -HALF_X, HEIGHT, 0).box(TRIM, 0.3, 0.9, HALF_Z * 2 + 0.3, HALF_X, HEIGHT, 0);
  b.box(VIOLET, HALF_X * 2 + 0.4, 0.1, 0.34, 0, HEIGHT + 0.9, -HALF_Z, { glow: true }).box(VIOLET, HALF_X * 2 + 0.4, 0.1, 0.34, 0, HEIGHT + 0.9, HALF_Z, { glow: true });
  b.box(VIOLET, 0.34, 0.1, HALF_Z * 2 + 0.4, -HALF_X, HEIGHT + 0.9, 0, { glow: true }).box(VIOLET, 0.34, 0.1, HALF_Z * 2 + 0.4, HALF_X, HEIGHT + 0.9, 0, { glow: true });
  b.box(0x0a0a0a, 6.4, 0.2, 5.2, 2.6, HEIGHT + 2.5, 0);
  for (const [x, z] of [[-0.3, -2.3], [-0.3, 2.3], [5.5, -2.3], [5.5, 2.3]]) b.cylinder(0x94a3b8, 0.08, 2.5, x, HEIGHT, z);
  b.box(0x3b1d0e, 3.6, 1.05, 0.8, 3, HEIGHT, -1.6).box(0xfde68a, 3.2, 0.3, 0.1, 3, HEIGHT + 1.05, -1.9, { glow: true });

  // A rope to queue along, on gold posts
  for (const side of [-1, 1]) {
    for (const x of [front - 1.2, front - 2.8]) {
      b.cylinder(0xd4af37, 0.05, 0.95, x, 0, side * 1.5, { solid: true }).cylinder(0xd4af37, 0.09, 0.05, x, 0.95, side * 1.5);
    }
    b.box(0x7f1d1d, 1.6, 0.05, 0.05, front - 2, 0.82, side * 1.5);
  }

  const group = b.build(options.id);
  group.position.set(site.x, 0, site.z);

  const name = signBoard([options.name.toUpperCase()], 6.2, 1.4, '#0a0a0f', '#f0abfc');
  name.position.set(front - 0.74, 5.1, 0);
  name.rotation.y = -Math.PI / 2;
  const board = signBoard([`Open ${describeHours(options.hours)}`, `Gate fee ₦${options.gateFee.toLocaleString()}`], 1.9, 0.8, '#0a0a0f', '#e5e7eb');
  board.position.set(front - 0.04, 1.8, -3.1);
  board.rotation.y = -Math.PI / 2;
  const doorman = figure(0x0a0a0a, 0x0a0a0a, 0x4a2f1b);
  doorman.position.set(front - 0.9, 0, 1.55);
  doorman.rotation.y = -Math.PI / 2;
  group.add(name, board, doorman);

  // A real door, which opens for someone going in
  const doorway = new THREE.Group();
  doorway.position.set(front - 0.06, 0, 0);
  doorway.rotation.y = -Math.PI / 2;
  const door = new HingedDoor({
    width: 1.4,
    height: 2.5,
    material: new THREE.MeshStandardMaterial({ color: 0x1c1917, roughness: 0.4, metalness: 0.4 }),
    swing: -1.9,
    thickness: 0.06,
  });
  door.group.position.z = 0.06;
  doorway.add(door.group);
  group.add(doorway);
  InteractionDirector.get().addDoor(door);

  const outside = at(front - 2.2, 0);
  const frontBox = clickBox(3, 5, 6);
  frontBox.position.set(front - 1.2, 2.5, 0);
  group.add(frontBox);

  let hour = 12;
  const open = () => isOpen(options.hours, hour);

  return {
    id: options.id,
    name: options.name,
    zone: { minX: site.x + front - 3.2, maxX: site.x + HALF_X + 1, minZ: site.z - HALF_Z - 1, maxZ: site.z + HALF_Z + 1 },
    group,
    obstructions: b.obstructions(options.name, site.x, site.z),
    interactive: [
      {
        mesh: frontBox,
        id: options.id,
        name: `${options.name} Nightclub`,
        category: 'Nightlife',
        description: `A dance floor, a DJ, a bar and a lounge. Open ${describeHours(options.hours)}. The gate fee is ₦${options.gateFee.toLocaleString()}, paid at the desk inside.`,
        interactionPoint: outside,
      },
    ],
    actions: {
      [options.id]: {
        label: () => (open() ? '🚪 Go in' : `🔒 Closed. Opens at ${describeHours(options.hours).split(' to ')[0]}`),
        run: (host) => {
          if (!open()) {
            host.say(closedNotice(options.name, options.hours), 'info');
            return;
          }
          host.enter(options.id);
        },
      },
    },
    doors: [{ name: `Door of ${options.name}`, x: outside.x, z: outside.z }],
    streetDoors: [{ buildingId: options.id, door, outside, inside: at(front + 1.4, 0) }],
    update(_delta, now) {
      hour = now;
    },
    status: () => ({ open: open(), hour, hours: options.hours }),
  };
}
