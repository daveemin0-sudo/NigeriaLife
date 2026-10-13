import * as THREE from 'three';
import { Builder, signBoard } from './ArchKit';
import type { Obstruction } from '../plan/CityPlan';

/**
 * The ordinary buildings of a town: office blocks, rows of shops, blocks of flats, houses, a
 * hotel. Each is described by what it is, where it stands, how big it is and which way it
 * faces the street; the whole town is then one mesh, however many buildings are in it, and
 * its footprints go to the city plan like anything else that stands on the ground.
 *
 * A building is drawn in its own terms: `across` runs along its street front and `out` runs
 * from its middle toward the street.
 */

export type Facing = 'east' | 'west' | 'north' | 'south';

export interface TownBuilding {
  kind: 'office' | 'shops' | 'flats' | 'house' | 'hotel' | 'duplex' | 'bungalow' | 'market' | 'bank';
  /** The middle of its footprint */
  x: number;
  z: number;
  /** Along the street front, and back from it */
  width: number;
  depth: number;
  /** Which way its front looks */
  faces: Facing;
  floors?: number;
  /** Its walls, and what it is trimmed with */
  colour?: number;
  trim?: number;
  /** A name over the door, for the few that have one */
  name?: string;
}

const LIT_GLASS = 0xfef08a;
const DARK_GLASS = 0x1e3a5f;
const DOOR = 0x1f2937;
const STOREY = 3.2;

const FRONT: Record<Facing, { x: number; z: number; yaw: number }> = {
  south: { x: 0, z: 1, yaw: 0 },
  north: { x: 0, z: -1, yaw: Math.PI },
  east: { x: 1, z: 0, yaw: Math.PI / 2 },
  west: { x: -1, z: 0, yaw: -Math.PI / 2 },
};

export function buildTownscape(name: string, buildings: TownBuilding[]): { group: THREE.Group; obstructions: Obstruction[] } {
  const b = new Builder().around(0, 0);
  const signs: THREE.Mesh[] = [];

  for (const one of buildings) {
    const front = FRONT[one.faces];
    const alongX = front.x === 0; // the street front runs along x when the building faces north or south
    // Its own terms to the world's: `across` along the front, `out` toward the street
    const X = (across: number, out: number) => one.x + (alongX ? across : out * front.x);
    const Z = (across: number, out: number) => one.z + (alongX ? out * front.z : across);
    const box = (hex: number, across: number, height: number, out: number, atAcross: number, baseY: number, atOut: number, options: { glow?: boolean; solid?: boolean } = {}) =>
      b.box(hex, alongX ? across : out, height, alongX ? out : across, X(atAcross, atOut), baseY, Z(atAcross, atOut), options);
    /** Panes on a wall that faces the street (`side` 1), the back (-1), or an end (`end` ±1) */
    const panes = (hex: number, columns: number, rows: number, wallWidth: number, baseY: number, wallHeight: number, side: 1 | -1, options: { glow?: boolean } = {}) =>
      b.windows(hex, columns, rows, wallWidth, baseY, wallHeight, X(0, side * (one.depth / 2 + 0.02)), Z(0, side * (one.depth / 2 + 0.02)), side === 1 ? front.yaw : front.yaw + Math.PI, options);
    const endPanes = (hex: number, columns: number, rows: number, baseY: number, wallHeight: number, end: 1 | -1, options: { glow?: boolean } = {}) =>
      b.windows(hex, columns, rows, one.depth - 1, baseY, wallHeight, X(end * (one.width / 2 + 0.02), 0), Z(end * (one.width / 2 + 0.02), 0), front.yaw + (end * Math.PI) / 2, options);

    const floors = Math.max(1, one.floors ?? 1);
    const colour = one.colour ?? 0xe7e5e4;
    const trim = one.trim ?? 0x475569;
    const reach = one.depth / 2;

    if (one.kind === 'office' || one.kind === 'hotel') {
      const height = floors * STOREY + 1;
      box(colour, one.width, height, one.depth, 0, 0, 0, { solid: true });
      // A darker ground floor with a glazed front, a canopy over the door
      box(trim, one.width + 0.1, 3.4, 0.14, 0, 0, reach + 0.03);
      box(DARK_GLASS, one.width * 0.7, 2.4, 0.08, 0, 0.5, reach + 0.12);
      box(DOOR, 2.2, 2.6, 0.1, 0, 0, reach + 0.17);
      box(trim, 4.4, 0.22, 1.8, 0, 3.3, reach + 0.9);
      // Windows floor by floor, front and back and both ends
      const columns = Math.max(3, Math.round(one.width / 2.6));
      panes(one.kind === 'hotel' ? 0xfef3c7 : LIT_GLASS, columns, floors, one.width - 1, 3.8, floors * STOREY - 2.8, 1, { glow: true });
      panes(LIT_GLASS, columns, floors, one.width - 1, 3.8, floors * STOREY - 2.8, -1, { glow: true });
      for (const end of [-1, 1] as const) endPanes(LIT_GLASS, Math.max(2, Math.round(one.depth / 3)), floors, 3.8, floors * STOREY - 2.8, end, { glow: true });
      // Bands between the floors of a hotel, a parapet, and what sits on the roof
      if (one.kind === 'hotel') for (let floor = 1; floor <= floors; floor++) box(trim, one.width + 0.16, 0.2, one.depth + 0.16, 0, 0.6 + floor * STOREY, 0);
      box(trim, one.width + 0.3, 0.5, one.depth + 0.3, 0, height, 0);
      box(0x9ca3af, Math.min(4, one.width * 0.3), 1.4, Math.min(3, one.depth * 0.3), -one.width * 0.2, height + 0.5, -one.depth * 0.15);
      if (one.name) {
        const sign = signBoard([one.name.toUpperCase()], Math.min(one.width - 1.5, 11), 1.1, '#0f172a', '#fde68a');
        sign.position.set(X(0, reach + 0.2), 4.5, Z(0, reach + 0.2));
        sign.rotation.y = front.yaw;
        signs.push(sign);
      }
    } else if (one.kind === 'bank') {
      // Grand commercial banking hall: two storeys with monumental front pillars and ATM bay
      const height = 7.0;
      box(colour, one.width, height, one.depth, 0, 0, 0, { solid: true });
      // Neoclassical portico facade with columns
      box(trim, one.width + 0.2, 0.4, one.depth + 0.2, 0, height, 0);
      box(0x334155, one.width * 0.8, 0.3, 1.8, 0, 0, reach + 0.9);
      for (const col of [-0.3, -0.1, 0.1, 0.3]) {
        box(0xf8fafc, 0.5, 6.2, 0.5, one.width * col, 0.3, reach + 1.2);
      }
      box(0x1e293b, one.width * 0.75, 0.5, 1.2, 0, 6.5, reach + 1.2);
      // Glazed banking hall entrance and ATM recess
      box(DARK_GLASS, one.width * 0.5, 3.2, 0.08, -one.width * 0.1, 0.4, reach + 0.04);
      box(DOOR, 2.0, 2.6, 0.1, -one.width * 0.1, 0, reach + 0.08);
      // 24/7 ATM Bay alcove with illuminated canopy
      box(0x0284c7, 2.4, 3.0, 0.8, one.width * 0.32, 0, reach + 0.2);
      box(0x38bdf8, 1.8, 0.8, 0.1, one.width * 0.32, 2.4, reach + 0.62, { glow: true });
      // Upper glazed floor
      box(LIT_GLASS, one.width * 0.6, 1.8, 0.08, 0, 4.2, reach + 0.04, { glow: true });
      if (one.name) {
        const sign = signBoard([one.name.toUpperCase(), 'COMMERCIAL BANK & 24/7 ATM'], Math.min(one.width - 1.2, 10), 1.2, '#0f172a', '#38bdf8');
        sign.position.set(X(0, reach + 0.8), 5.4, Z(0, reach + 0.8));
        sign.rotation.y = front.yaw;
        signs.push(sign);
      }
    } else if (one.kind === 'market') {
      // Open-air covered market pavilion / trading stalls
      box(colour, one.width, 3.8, one.depth, 0, 0, 0, { solid: true });
      box(trim, one.width + 0.2, 0.4, one.depth + 0.2, 0, 3.8, 0);
      const stalls = Math.max(2, Math.round(one.width / 4.0));
      const each = one.width / stalls;
      const CANOPY_COLOURS = [0x15803d, 0xb91c1c, 0xd97706, 0x1d4ed8, 0x7c3aed];
      for (let s = 0; s < stalls; s++) {
        const at = -one.width / 2 + (s + 0.5) * each;
        // Timber stall display counter
        box(0x78350f, each - 0.8, 1.1, 1.4, at, 0, reach + 0.7);
        // Produce baskets
        box(s % 2 ? 0xd97706 : 0x16a34a, each - 1.2, 0.35, 1.0, at, 1.1, reach + 0.7);
        // Colourful awning over stall
        box(CANOPY_COLOURS[s % CANOPY_COLOURS.length], each - 0.3, 0.12, 1.8, at, 2.8, reach + 0.9);
      }
      if (one.name) {
        const sign = signBoard([one.name.toUpperCase()], Math.min(one.width - 1.5, 9), 1.0, '#14532d', '#fef08a');
        sign.position.set(X(0, reach + 0.2), 3.4, Z(0, reach + 0.2));
        sign.rotation.y = front.yaw;
        signs.push(sign);
      }
    } else if (one.kind === 'duplex') {
      // Luxury two-storey duplex villa with upper cantilevered balcony, security gate, and hip roof
      const height = 6.4;
      box(colour, one.width, height, one.depth, 0, 0, 0, { solid: true });
      // Front entrance porch
      box(trim, 3.0, 0.25, 1.6, 0, 0, reach + 0.8);
      box(DOOR, 1.4, 2.4, 0.1, 0, 0, reach + 0.04);
      box(LIT_GLASS, 1.8, 1.4, 0.08, -one.width * 0.28, 1.0, reach + 0.04, { glow: true });
      box(LIT_GLASS, 1.8, 1.4, 0.08, one.width * 0.28, 1.0, reach + 0.04, { glow: true });
      // First floor cantilevered balcony with steel balustrade
      box(trim, one.width * 0.6, 0.18, 1.4, 0, 3.2, reach + 0.7);
      box(trim, one.width * 0.6, 0.9, 0.06, 0, 3.38, reach + 1.35);
      box(DARK_GLASS, 2.0, 2.2, 0.08, 0, 3.2, reach + 0.04);
      // Windows on first floor
      box(LIT_GLASS, 1.6, 1.4, 0.08, -one.width * 0.32, 4.0, reach + 0.04, { glow: true });
      box(LIT_GLASS, 1.6, 1.4, 0.08, one.width * 0.32, 4.0, reach + 0.04, { glow: true });
      // Terracotta pitched roof
      const roof = one.trim ?? 0x9a3412;
      const slope = 0.45;
      const half = one.width / 2 + 0.5;
      const run = half / Math.cos(slope);
      for (const side of [-1, 1]) {
        const tilt = alongX ? { roll: -side * slope } : { pitch: side * slope };
        b.box(roof, alongX ? run : one.depth + 0.8, 0.16, alongX ? one.depth + 0.8 : run, X(side * half * 0.5, 0), height + (half * 0.5) * Math.tan(slope) - 0.08, Z(side * half * 0.5, 0), tilt);
      }
      for (const end of [-1, 1]) box(colour, one.width * 0.5, (half * Math.tan(slope)) * 0.55, 0.12, 0, height, end * (reach - 0.06));
    } else if (one.kind === 'bungalow') {
      // Compound bungalow with veranda plinth, columns, and hipped roof
      box(colour, one.width, 3.6, one.depth, 0, 0, 0, { solid: true });
      // Front veranda porch
      box(trim, one.width * 0.8, 0.3, 1.6, 0, 0, reach + 0.8);
      box(trim, 0.3, 3.2, 0.3, -one.width * 0.35, 0.3, reach + 1.4);
      box(trim, 0.3, 3.2, 0.3, one.width * 0.35, 0.3, reach + 1.4);
      box(trim, one.width * 0.8, 0.2, 1.6, 0, 3.4, reach + 0.8);
      box(DOOR, 1.2, 2.3, 0.1, 0, 0, reach + 0.04);
      for (const side of [-1, 1]) box(LIT_GLASS, 1.5, 1.2, 0.08, side * one.width * 0.3, 1.1, reach + 0.04, { glow: true });
      const roof = one.trim ?? 0x7c2d12;
      const slope = 0.45;
      const half = one.width / 2 + 0.4;
      const run = half / Math.cos(slope);
      for (const side of [-1, 1]) {
        const tilt = alongX ? { roll: -side * slope } : { pitch: side * slope };
        b.box(roof, alongX ? run : one.depth + 0.8, 0.16, alongX ? one.depth + 0.8 : run, X(side * half * 0.5, 0), 3.6 + (half * 0.5) * Math.tan(slope) - 0.08, Z(side * half * 0.5, 0), tilt);
      }
      for (const end of [-1, 1]) box(colour, one.width * 0.5, (half * Math.tan(slope)) * 0.55, 0.12, 0, 3.6, end * (reach - 0.06));
    } else if (one.kind === 'shops') {
      // One storey, a row of fronts: a shutter or a window each, an awning over it, a band of colour for the name
      box(colour, one.width, 4.2, one.depth, 0, 0, 0, { solid: true });
      box(trim, one.width + 0.2, 0.5, one.depth + 0.2, 0, 4.2, 0);
      const units = Math.max(2, Math.round(one.width / 4.5));
      const each = one.width / units;
      const AWNINGS = [0xb91c1c, 0x15803d, 0x1d4ed8, 0xca8a04, 0x7c3aed];
      for (let unit = 0; unit < units; unit++) {
        const at = -one.width / 2 + (unit + 0.5) * each;
        box(unit % 2 ? DARK_GLASS : 0x52525b, each - 1, 2.6, 0.1, at, 0.1, reach + 0.03);
        box(AWNINGS[unit % AWNINGS.length], each - 0.5, 0.14, 1.5, at, 2.9, reach + 0.75);
        box(AWNINGS[(unit + 2) % AWNINGS.length], each - 0.7, 0.7, 0.08, at, 3.3, reach + 0.04);
      }
    } else if (one.kind === 'flats') {
      const height = floors * STOREY;
      box(colour, one.width, height, one.depth, 0, 0, 0, { solid: true });
      box(DOOR, 1.6, 2.4, 0.1, 0, 0, reach + 0.04);
      const columns = Math.max(2, Math.round(one.width / 3.2));
      // A balcony with a rail to each flat on the front; windows at the back and the ends
      for (let floor = 1; floor < floors; floor++) {
        for (let column = 0; column < columns; column++) {
          const at = -one.width / 2 + ((column + 0.5) * one.width) / columns;
          box(trim, one.width / columns - 0.9, 0.14, 1.1, at, floor * STOREY, reach + 0.55);
          box(trim, one.width / columns - 0.9, 0.9, 0.06, at, floor * STOREY + 0.14, reach + 1.07);
          box(DARK_GLASS, 1.3, 2.1, 0.08, at, floor * STOREY + 0.14, reach + 0.03);
        }
      }
      panes(LIT_GLASS, columns, 1, one.width - 1, 0.9, 1.6, 1, { glow: true });
      panes(LIT_GLASS, columns, floors, one.width - 1, 0.8, height - 1.2, -1, { glow: true });
      for (const end of [-1, 1] as const) endPanes(LIT_GLASS, 2, floors, 0.8, height - 1.2, end, { glow: true });
      // A flat roof with a parapet and the water tanks every such block has
      box(trim, one.width + 0.24, 0.4, one.depth + 0.24, 0, height, 0);
      for (const side of [-1, 1]) b.cylinder(0x111827, 0.8, 1.5, X(side * one.width * 0.25, -one.depth * 0.2), height + 0.4, Z(side * one.width * 0.25, -one.depth * 0.2));
    } else {
      // A house: one floor under a pitched roof, a door and two windows to the street, a low wall round its yard
      box(colour, one.width, 3.2, one.depth, 0, 0, 0, { solid: true });
      box(DOOR, 1.1, 2.2, 0.1, 0, 0, reach + 0.04);
      for (const side of [-1, 1]) box(LIT_GLASS, 1.4, 1.1, 0.08, side * one.width * 0.3, 1.2, reach + 0.04, { glow: true });
      const roof = one.trim ?? 0x9a3412;
      const slope = 0.5;
      const half = one.width / 2 + 0.4;
      const run = half / Math.cos(slope);
      for (const side of [-1, 1]) {
        const tilt = alongX ? { roll: -side * slope } : { pitch: side * slope };
        b.box(roof, alongX ? run : one.depth + 0.8, 0.16, alongX ? one.depth + 0.8 : run, X(side * half * 0.5, 0), 3.2 + (half * 0.5) * Math.tan(slope) - 0.08, Z(side * half * 0.5, 0), tilt);
      }
      // The gable ends, closed
      for (const end of [-1, 1]) box(colour, one.width * 0.5, (half * Math.tan(slope)) * 0.55, 0.12, 0, 3.2, end * (reach - 0.06));
    }
  }

  const group = b.build(name);
  for (const sign of signs) group.add(sign);
  return { group, obstructions: b.obstructions(name, 0, 0) };
}
