import * as THREE from 'three';
import type { PlaceInterior } from './PlaceInterior';
import { Figure } from './Worship';
import type { HumanConfig } from '../../graphics/HumanMeshBuilder';

/**
 * The terminal is busy: pilots and cabin crew walking through with their flight bags, travellers
 * pulling suitcases to check-in and from security, back and forth all day, each pausing a while
 * at the end of their walk before heading back.
 */

interface Walker {
  look: Omit<HumanConfig, 'username'>;
  from: [number, number];
  to: [number, number];
  bag: 'cabin' | 'suitcase' | 'duffel';
  colour: number;
}

const WALKERS: Walker[] = [
  { look: { gender: 'male', outfit: 'pilot_uniform', hairstyle: 'pilot_cap', headShape: 'square' }, from: [-11, 9], to: [4.5, 1.8], bag: 'cabin', colour: 0x111827 },
  { look: { gender: 'female', outfit: 'pilot_uniform', hairstyle: 'pilot_cap', hair: 'bun' }, from: [11.5, -3.2], to: [-6, -3.6], bag: 'cabin', colour: 0x111827 },
  { look: { gender: 'male', outfit: 'button_shirt', hairstyle: 'fade', outfitColor: 0x1d4ed8 }, from: [0, 10.5], to: [-3, -4.6], bag: 'suitcase', colour: 0x7c2d12 },
  { look: { gender: 'female', outfit: 'ankara_gown', hairstyle: 'box_braids', outfitColor: 0x0e7490, accentColor: 0xfacc15 }, from: [-12, -2.2], to: [3, 5.2], bag: 'suitcase', colour: 0x1e3a8a },
  { look: { gender: 'male', outfit: 'kaftan', hairstyle: 'fila', outfitColor: 0xf5f5f4 }, from: [10, 9.5], to: [1.5, -4.4], bag: 'suitcase', colour: 0x374151 },
  { look: { gender: 'female', outfit: 'hoodie', hairstyle: 'bun', outfitColor: 0x6b7280 }, from: [-6, 10], to: [8, -4.2], bag: 'duffel', colour: 0x15803d },
];

export function attachTravellers(room: PlaceInterior): void {
  const shell = new THREE.MeshStandardMaterial({ color: 0x111827, roughness: 0.35 });
  const metal = new THREE.MeshStandardMaterial({ color: 0x9ca3af, roughness: 0.3, metalness: 0.7 });
  WALKERS.forEach((w, i) => {
    const fig = new Figure(room.group, `traveller-${i}`, 'Traveller', { username: '', lod: 'detailed', ...w.look } as HumanConfig, w.from, 0);
    // The bag: pulled behind on its wheels by its handle, or carried on the shoulder
    const bag = new THREE.Group();
    const body = new THREE.MeshStandardMaterial({ color: w.colour, roughness: 0.4 });
    if (w.bag === 'duffel') {
      const d = new THREE.Mesh(new THREE.CapsuleGeometry(0.13, 0.4, 4, 10), body);
      d.rotation.z = Math.PI / 2;
      d.position.set(0.28, 0.98, -0.02);
      bag.add(d);
    } else {
      const big = w.bag === 'suitcase';
      const h = big ? 0.66 : 0.5;
      const case_ = new THREE.Mesh(new THREE.BoxGeometry(big ? 0.44 : 0.36, h, big ? 0.26 : 0.22), w.bag === 'cabin' ? shell : body);
      case_.position.set(0.3, h / 2 + 0.06, -0.42);
      case_.rotation.x = -0.22;
      bag.add(case_);
      for (const sx of [-1, 1]) {
        const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.03, 10), shell);
        wheel.rotation.z = Math.PI / 2;
        wheel.position.set(0.3 + sx * 0.15, 0.035, -0.5);
        bag.add(wheel);
      }
      // The handle up to the hand
      const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.5, 6), metal);
      handle.position.set(0.3, h + 0.28, -0.3);
      handle.rotation.x = 0.55;
      bag.add(handle);
    }
    fig.root.add(bag);
    // Out and back, a pause at each end
    const go = (there: boolean) => {
      const end = there ? w.to : w.from;
      fig.walk([end], () => fig.hold(2 + ((i * 1.7) % 4), () => go(!there)), { speed: 1.05 + (i % 3) * 0.12 });
    };
    // Each starts somewhere along their walk, so they are not all in step
    fig.hold(i * 1.3, () => go(true));
    room.ticks.push((delta) => fig.tick(delta));
  });
}
