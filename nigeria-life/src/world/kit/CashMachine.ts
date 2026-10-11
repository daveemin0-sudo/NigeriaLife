import * as THREE from 'three';
import { Builder, signBoard } from './ArchKit';
import { PlaceActions } from '../../destinations/PlaceActions';
import type { InteractiveObject } from '../World';

/**
 * A cash machine in a wall: where money is taken out of the bank and paid into it, at any
 * hour. It is a place in the street like any other: the player walks up to it and uses it
 * there. Every one is known by an id that starts the same way, so the nearest can be found.
 */

export const CASH_MACHINE = 'atm-';

export interface CashMachineOptions {
  /** What comes after "atm-" in its id */
  id: string;
  /** Whose it is, as its card says: "Eko Commercial Bank", "the airport" */
  name: string;
  /** Where its back is against the wall, and which way it faces (0 faces +z) */
  x: number;
  z: number;
  facing: number;
  /** Leave the machine itself out where one is already modelled in the wall: only the place to press and stand is made */
  fasciaOnly?: boolean;
}

function clickArea(width: number, height: number, depth: number): THREE.Mesh {
  return new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }));
}

export function createCashMachine(options: CashMachineOptions): { group: THREE.Group; interactive: InteractiveObject } {
  const b = new Builder().around(0, 0);
  if (!options.fasciaOnly) {
    // A dark surround set against the wall, a pale fascia, a lit screen, a shelf of keys and the slot the notes come from
    b.box(0x1e293b, 1.3, 2.3, 0.3, 0, 0, 0.15);
    b.box(0xe2e8f0, 1.1, 1.5, 0.06, 0, 0.6, 0.32);
    b.box(0x38bdf8, 0.6, 0.45, 0.03, 0, 1.38, 0.355, { glow: true });
    b.box(0x334155, 0.42, 0.05, 0.24, 0, 1.08, 0.44);
    b.box(0x0f172a, 0.5, 0.07, 0.03, 0, 0.86, 0.355);
    b.box(0x22c55e, 0.12, 0.04, 0.03, 0.4, 1.32, 0.355, { glow: true });
    b.box(0x0b7a43, 1.3, 0.42, 0.36, 0, 2.3, 0.18);
  }
  const group = b.build(`${CASH_MACHINE}${options.id}`);
  if (!options.fasciaOnly) {
    const sign = signBoard(['ATM · 24 HOURS'], 1.2, 0.3, '#0b7a43', '#ffffff');
    sign.position.set(0, 2.51, 0.37);
    group.add(sign);
  }
  const press = clickArea(1.7, 2.6, 1.3);
  press.position.set(0, 1.3, 0.6);
  group.add(press);
  group.position.set(options.x, 0, options.z);
  group.rotation.y = options.facing;

  const id = `${CASH_MACHINE}${options.id}`;
  const standAt = new THREE.Vector3(options.x + Math.sin(options.facing) * 1.15, 0, options.z + Math.cos(options.facing) * 1.15);
  PlaceActions.register(id, {
    label: () => '🏧 Use the cash machine',
    run: (host) => {
      // Up to it, facing the screen, a hand to the keys: then the screen is theirs
      host.director.perform({
        id: `use ${id}`,
        actor: host.actor,
        point: standAt,
        target: new THREE.Vector3(options.x, 0, options.z),
        ifStuck: 'snap',
        speed: 5,
        animation: { arms: 'reach' },
        seconds: 0.9,
        effectAt: 0.6,
        effect: () => host.cashMachine(),
      });
    },
  });
  return {
    group,
    interactive: {
      mesh: press,
      id,
      name: `Cash machine, ${options.name}`,
      category: 'Banking · open all hours',
      description: 'Take cash out of your account or pay it in. It works at any hour, when the branch is shut too.',
      interactionPoint: standAt,
    },
  };
}
