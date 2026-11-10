import * as THREE from 'three';
import { fineDining, fineFan, fineLamp, fineSofa } from '../../housing/FineFurniture';
import { RENDER_LAYERS } from '../InteriorTypes';
import { Builder, signBoard } from '../../world/kit/ArchKit';

/** A city look. Abuja is stone, gold and terracotta. Port Harcourt is creek green and white. */
export type CityLook = 'abuja' | 'ph';

export const layFine = (parent: THREE.Object3D, object: THREE.Object3D, x: number, y: number, z: number, yaw = 0): void => {
  object.position.set(x, y, z);
  object.rotation.y = yaw;
  object.traverse((child) => child.layers.set(RENDER_LAYERS.INTERIOR));
  parent.add(object);
};

const palette = (city: CityLook, variant: number) => {
  if (city === 'ph') {
    return variant === 2
      ? { cloth: 0x7c2d12, cushion: 0xfef3c7, wood: 0x44403c, gold: 0xd4af37 }
      : variant === 1
        ? { cloth: 0x1e3a8a, cushion: 0xe0f2fe, wood: 0x1c1917, gold: 0xf8fafc }
        : { cloth: 0x0f766e, cushion: 0xe0f2fe, wood: 0x44403c, gold: 0xd4af37 };
  }
  return variant === 2
    ? { cloth: 0x14532d, cushion: 0xfef3c7, wood: 0x3f2a17, gold: 0xd4af37 }
    : variant === 1
      ? { cloth: 0xb45309, cushion: 0xfef3c7, wood: 0x78350f, gold: 0xfde68a }
      : { cloth: 0x7c2d12, cushion: 0xf5e6c8, wood: 0x6b3f1d, gold: 0xd4af37 };
};

/** A small plaque, not the building's name painted across the wall. */
const plaque = (parent: THREE.Object3D, lines: string[], x: number, y: number, z: number, bg: string): void => {
  const board = signBoard(lines, 1.6, 0.42, bg, '#f8fafc');
  board.position.set(x, y, z);
  board.traverse((child) => child.layers.set(RENDER_LAYERS.INTERIOR));
  parent.add(board);
};

/**
 * A hotel lobby: reception, a lift, a bar, and seats. Each variant moves the seats and the
 * colour, so two hotels in one city are not the same room.
 * The desk stays at (-4, -5) and the bar at (5, -4), where the cards are.
 */
export function furnishLobby(group: THREE.Group, city: CityLook, variant: number): void {
  const p = palette(city, variant);
  const b = new Builder();
  b.box(p.wood, 4.2, 1.05, 0.9, -4, 0, -5).box(p.gold, 4.3, 0.06, 1, -4, 1.05, -5);
  b.box(0x1c1917, 3.2, 1.05, 0.8, 5, 0, -4).box(p.gold, 3.3, 0.05, 0.9, 5, 1.05, -4);
  // The lift, at the back
  b.box(0x1f2937, 2.4, 2.6, 0.12, variant === 1 ? 6.5 : 0, 0, -8.4);
  b.box(0xf8fafc, 1.8, 2.2, 0.04, variant === 1 ? 6.5 : 0, 0.1, -8.3);
  b.box(p.gold, 0.08, 0.5, 0.02, (variant === 1 ? 6.5 : 0) + 0.7, 1.1, -8.26);
  // Bottles behind the bar, and a plant by the desk
  for (let i = 0; i < 8; i++) b.cylinder([0xfacc15, 0x166534, 0x7f1d1d, 0xe0f2fe][i % 4], 0.06, 0.32, 3.6 + (i % 4) * 0.28, 1.1, -4.3, { sides: 8 });
  b.cylinder(0x78350f, 0.22, 0.4, -7.2, 0, -6).dome(0x166534, 0.45, -7.2, 0.4, -6);
  group.add(b.build('lobby fit', { roughness: 0.6 }));
  if (variant === 2) {
    layFine(group, fineDining(6, p.wood, p.cloth), 0, 0, 3.2, Math.PI / 2);
  } else {
    layFine(group, fineSofa(3, p.cloth, p.cushion, p.wood), -3, 0, variant === 1 ? 4.2 : 2.6, Math.PI);
    layFine(group, fineSofa(2, p.cloth, p.cushion, p.wood), variant === 1 ? -3 : 3.2, 0, variant === 1 ? 1.2 : 4.6, variant === 1 ? Math.PI / 2 : 0);
  }
  layFine(group, fineLamp(), -7.4, 0, 2, 0);
  layFine(group, fineLamp(), 7.2, 0, 1, 0);
  layFine(group, fineFan(p.cloth), 0.4, 0, 0.2, 0);
  plaque(group, [city === 'ph' ? 'Reception' : 'Front desk', 'Key cards'], -4, 1.7, -4.4, city === 'ph' ? '#0f766e' : '#7c2d12');
}

/**
 * An office: a reception desk, waiting seats, and desks with chairs. Abuja faces the window
 * wall; Port Harcourt runs the desks down the other side.
 */
export function furnishOffice(group: THREE.Group, city: CityLook): void {
  const p = palette(city, 0);
  const b = new Builder();
  b.box(city === 'ph' ? 0x0f766e : 0x1e3a8a, 5, 1.05, 0.9, 0, 0, -5).box(0xf8fafc, 5.1, 0.05, 1, 0, 1.05, -5);
  const row = city === 'ph' ? [2.2, 5.2] : [-5.4, -2.2];
  for (const x of row) {
    b.box(0xd6d3d1, 1.5, 0.75, 0.7, x, 0, -1);
    b.box(0x0f172a, 0.55, 0.36, 0.04, x, 0.78, -1.2);
    b.box(0x38bdf8, 0.48, 0.28, 0.02, x, 0.82, -1.16, { glow: true });
  }
  b.box(city === 'ph' ? 0x0369a1 : 0xb45309, 1.1, 0.7, 0.04, city === 'ph' ? -8.6 : 8.6, 1.7, -2);
  b.box(0xfef3c7, 0.86, 0.48, 0.02, city === 'ph' ? -8.55 : 8.55, 1.7, -2);
  group.add(b.build('office fit', { roughness: 0.6 }));
  for (const x of row) layFine(group, fineSofa(1, 0x1f2937, 0xe5e7eb, p.wood), x, 0, 0.15, Math.PI);
  layFine(group, fineSofa(3, p.cloth, p.cushion, p.wood), city === 'ph' ? 3 : -2.4, 0, 3.4, Math.PI);
  layFine(group, fineLamp(), city === 'ph' ? -6 : 6, 0, 3, 0);
  layFine(group, fineFan(city === 'ph' ? 0x0f766e : 0x1e3a8a), 0, 0, 1.2, 0);
  plaque(group, ['Reception', 'Jobs'], 0, 1.7, -4.4, city === 'ph' ? '#0f766e' : '#1e3a8a');
}
