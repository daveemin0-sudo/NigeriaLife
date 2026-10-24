import * as THREE from 'three';
import type { Builder } from '../kit/ArchKit';
import type { PlaceHost } from '../../destinations/PlaceActions';

/**
 * The places the phone and the map name that had nowhere to stand: each one built along the
 * expressway with its own look, its sign, and things to do there at today's prices.
 */

export interface PlaceShape {
  b: Builder;
  place: { id: string; side: -1 | 1; z: number; length: number; depth: number };
  /** The x of the place's face to the road, and the side it is on */
  faceX: number;
  s: -1 | 1;
  depthMid: number;
  z0: number;
  group: THREE.Group;
  footprint(height: number): void;
  obstruct(minX: number, maxX: number, minZ: number, maxZ: number, height: number): void;
  label(text: string, sub: string, bg: string, y: number, width?: number): void;
}

export interface Card {
  name: string;
  category: string;
  description: string;
}

export interface PlaceKit {
  act(host: PlaceHost, arms: 'reach' | 'greet' | 'wave', seconds: number, effect: () => void): void;
  pay(host: PlaceHost, amount: number, what: string): boolean;
  openApp(app: string): void;
  /** Opens the pump: the player's vehicles, their tanks, and filling them */
  openPump(stationId: string): void;
  openStateHouse(mode: 'house' | 'polling' | 'view'): void;
}

/** Where on a filling station's forecourt a vehicle stands to be filled, from its face to the road */
export const FORECOURT_DEPTH = 11;

const WINDOWS = (b: Builder, faceX: number, s: number, z0: number, length: number, floors: number, storey: number, lit: number, from = 1) => {
  for (let f = from; f < floors; f++) {
    for (let z = z0 + 1.6; z < z0 + length - 1.2; z += 2.6) {
      const on = ((f * 7 + Math.round(z)) % 10) / 10 < lit;
      b.box(on ? 0xfde68a : 0x1e293b, 0.06, storey * 0.5, 1.6, faceX - s * 0.03, f * storey + storey * 0.25, z, { glow: on });
    }
  }
};

/** Builds one of these places; null if the id is not one of them */
export function buildMorePlace(k: PlaceShape): Card | null {
  const { b, place, faceX, s, depthMid, z0 } = k;
  const along = place.length;
  const at = (x: number) => faceX + s * x;
  if (place.id.startsWith('station-')) {
    // A canopy on columns over two islands of pumps, the shop behind, the price board by the road
    const fx = at(FORECOURT_DEPTH);
    b.box(0x6b7280, place.depth, 0.04, along, depthMid, 0.01, place.z);
    b.box(0xf8fafc, 16, 0.8, along - 10, fx, 5.6, place.z).box(0x16a34a, 16.2, 0.35, along - 9.8, fx, 5.3, place.z);
    for (const dz of [-(along - 14) / 2, (along - 14) / 2]) for (const dx of [-5, 5]) b.box(0xe5e7eb, 0.45, 5.3, 0.45, fx + dx, 0, place.z + dz);
    for (const dx of [-3.2, 3.2]) {
      b.box(0x9ca3af, 1.2, 0.2, along - 18, fx + dx, 0, place.z);
      for (const dz of [-6, 0, 6]) b.box(0xdc2626, 0.7, 1.6, 0.9, fx + dx, 0.2, place.z + dz).box(0x111827, 0.72, 0.45, 0.5, fx + dx, 1.1, place.z + dz).box(0xfef08a, 0.05, 0.2, 0.4, fx + dx - s * 0.37, 1.25, place.z + dz, { glow: true });
      k.obstruct(fx + dx - 0.6, fx + dx + 0.6, place.z - (along - 18) / 2, place.z + (along - 18) / 2, 1.6);
    }
    b.box(0xf5f5f4, 8, 3.6, 14, at(place.depth - 4), 0, place.z).box(0x16a34a, 8.2, 0.5, 14.2, at(place.depth - 4), 3.6, place.z).box(0x0f172a, 0.05, 1.8, 9, at(place.depth - 8) - s * 0.03, 0.6, place.z);
    k.obstruct(Math.min(at(place.depth - 8), at(place.depth)), Math.max(at(place.depth - 8), at(place.depth)), place.z - 7, place.z + 7, 3.6);
    b.box(0x16a34a, 0.4, 7, 0.4, at(1), 0, place.z - along / 2 + 3).box(0x16a34a, 0.35, 2.4, 3.2, at(1), 7, place.z - along / 2 + 3);
    k.label('NAIJAPETRO', `Petrol ₦${(950).toLocaleString()} per litre · Shop · Air`, '#15803d', 6.6, 18);
    return { name: place.id === 'station-island' ? 'NaijaPetro, Island' : place.id === 'station-bridge' ? 'NaijaPetro, Bridge End' : 'NaijaPetro, Mainland', category: 'Filling station', description: 'Drive onto the forecourt to fill up. Petrol at the pump price, and a shop for water and snacks.' };
  }
  switch (place.id) {
    case 'marina-towers': {
      // A podium of shops and the tower over it, glass and white bands
      b.box(0xe2e8f0, place.depth, 6, along, depthMid, 0, place.z);
      b.box(0x60a5fa, place.depth - 8, 60, along - 10, depthMid + s * 2, 6, place.z);
      for (let f = 1; f < 20; f++) b.box(0xf8fafc, place.depth - 7.9, 0.4, along - 9.9, depthMid + s * 2, 6 + f * 3, place.z);
      b.box(0x93c5fd, 0.1, 4, along - 4, faceX - s * 0.05, 0.5, place.z);
      k.footprint(6);
      k.label('MARINA TOWERS', 'Offices · Banks · Shops', '#1e3a8a', 7.2, 24);
      return { name: 'Marina Towers', category: 'Offices', description: 'Twenty floors of offices over a row of shops. Meet clients, rent a floor for your business, see Lagos from the top.' };
    }
    case 'freedom-park': {
      // Walls of the old prison yard, an open-air stage under a canopy, seats, art and trees
      b.box(0x8b5e3c, place.depth, 0.08, along, depthMid, 0, place.z);
      for (const dz of [-along / 2, along / 2]) b.box(0xb45309, place.depth, 3, 0.6, depthMid, 0, place.z + dz);
      b.box(0xb45309, 0.6, 3, along, at(place.depth), 0, place.z);
      b.box(0x57534e, 14, 1.2, 10, at(30), 0, place.z).box(0xf8fafc, 16, 0.3, 12, at(30), 7, place.z);
      for (const dz of [-5, 5]) for (const dx of [-7, 7]) b.cylinder(0x1f2937, 0.2, 7, at(30) + dx, 0, place.z + dz);
      for (let r = 0; r < 5; r++) b.box(0x78716c, 3, 0.45, 18, at(18 - r * 2.5), 0, place.z, { solid: false });
      for (let i = 0; i < 6; i++) b.cone([0xdc2626, 0x2563eb, 0xfacc15][i % 3], 0.8, 3, at(6 + (i % 2) * 4), 0, z0 + 6 + i * 8, 5);
      for (let i = 0; i < 8; i++) b.cylinder(0x78350f, 0.3, 5, at(4 + (i % 4) * 12), 0, i < 4 ? z0 + 3 : z0 + along - 3).dome(0x15803d, 3, at(4 + (i % 4) * 12), 4.5, i < 4 ? z0 + 3 : z0 + along - 3);
      k.obstruct(Math.min(at(23), at(37)), Math.max(at(23), at(37)), place.z - 5, place.z + 5, 1.2);
      k.label('FREEDOM PARK', 'Arts · Music · History', '#92400e', 3.6, 18);
      return { name: 'Freedom Park', category: 'Arts & culture', description: 'A colonial prison turned into a park: live music on the open-air stage, art, food and history.' };
    }
    case 'ivory-rooftop': {
      // Twelve floors and a lounge on the roof, lit, umbrellas and a glass rail
      const h = 38;
      b.box(0xd6d3d1, place.depth, h, along, depthMid, 0, place.z);
      WINDOWS(b, faceX, s, z0, along, 12, 3.2, 0.35);
      b.box(0x1f2937, place.depth - 2, 0.4, along - 2, depthMid, h, place.z);
      b.box(0x93c5fd, 0.08, 1.1, along - 2, faceX - s * 0.9, h + 0.4, place.z, { glow: true });
      for (let i = 0; i < 6; i++) {
        const x = at(4 + (i % 3) * 6);
        const z = place.z - 8 + Math.floor(i / 3) * 16;
        b.cylinder(0x18181b, 0.05, 2.4, x, h + 0.4, z).cone(i % 2 ? 0xf8fafc : 0xd4af37, 1.8, 0.7, x, h + 2.6, z, 10);
      }
      for (let z = z0 + 2; z < z0 + along - 1; z += 3) b.box(0xfef08a, 0.25, 0.25, 0.25, faceX - s * 0.9, h + 1.7, z, { glow: true });
      k.footprint(h);
      k.label('IVORY ROOFTOP', 'Sky lounge · Cocktails · Sunset DJ', '#111827', 5.6, 20);
      return { name: 'Ivory Rooftop Sky Lounge', category: 'Lounge & bar', description: 'Cocktails twelve floors up with the whole city lit under you. Dress well; nothing here is cheap.' };
    }
    case 'the-library': {
      // A dark front with gold trim and shelves of books seen through tall windows
      b.box(0x111827, place.depth, 8, along, depthMid, 0, place.z);
      b.box(0xd4af37, 0.15, 0.3, along, faceX - s * 0.08, 7.5, place.z).box(0xd4af37, 0.15, 0.3, along, faceX - s * 0.08, 0.2, place.z);
      for (let z = z0 + 3; z < z0 + along - 2; z += 4) {
        b.box(0xfbbf24, 0.06, 4, 2.4, faceX - s * 0.04, 1.6, z, { glow: true });
        for (let y = 2; y < 5.5; y += 0.8) b.box([0x7f1d1d, 0x1e3a8a, 0x14532d][Math.round(y) % 3], 0.08, 0.5, 2.2, faceX - s * 0.02, y, z);
      }
      k.footprint(8);
      k.label('THE LIBRARY', 'Speakeasy · Private dining · Members', '#78350f', 8.4, 16);
      return { name: 'The Library', category: 'Fine dining', description: 'A speakeasy behind a wall of books: private dining, wine and quiet deals. Booking and deep pockets advised.' };
    }
    case 'i-fitness': {
      // A glass box with the machines inside it
      b.box(0xf8fafc, place.depth, 0.5, along, depthMid, 8, place.z).box(0xe5e7eb, place.depth, 0.15, along, depthMid, 0, place.z);
      b.box(0xbae6fd, place.depth - 0.4, 8, along - 0.4, depthMid, 0, place.z);
      for (let i = 0; i < 8; i++) b.box(0x111827, 0.9, 1.3, 2, at(3 + (i % 2) * 3), 0.15, z0 + 4 + Math.floor(i / 2) * 7).box(0xef4444, 0.92, 0.12, 2, at(3 + (i % 2) * 3), 1.3, z0 + 4 + Math.floor(i / 2) * 7);
      for (const dz of [-along / 2, along / 2]) b.box(0xea580c, place.depth, 8.5, 0.4, depthMid, 0, place.z + dz);
      k.footprint(8.5);
      k.label('i-FITNESS', 'Gym · Classes · Personal trainers', '#ea580c', 9, 18);
      return { name: 'i-Fitness', category: 'Gym', description: 'Treadmills, weights, classes and trainers who shout. Pay for a day or by the month.' };
    }
    case 'lekki-conservation': {
      // Forest, a boardwalk through it, the canopy walk high up on its towers, the gate
      b.box(0x3f6212, place.depth, 0.06, along, depthMid, 0, place.z);
      for (let i = 0; i < 40; i++) {
        const x = at(4 + (i * 13) % (place.depth - 6));
        const z = z0 + 3 + ((i * 29) % (along - 6));
        b.cylinder(0x57534e, 0.3, 6 + (i % 4), x, 0, z).dome(i % 3 ? 0x166534 : 0x15803d, 2.6 + (i % 3), x, 5.5 + (i % 4), z);
      }
      b.box(0x92400e, 2, 0.25, along - 10, at(10), 0.6, place.z);
      for (const t of [0.2, 0.5, 0.8]) b.box(0x78350f, 2.2, 16, 2.2, at(14 + t * 40), 0, z0 + along * t);
      for (let i = 0; i < 2; i++) {
        const a = [0.2, 0.5, 0.8][i];
        const c = [0.2, 0.5, 0.8][i + 1];
        const x1 = at(14 + a * 40);
        const x2 = at(14 + c * 40);
        const za = z0 + along * a;
        const zc = z0 + along * c;
        const len = Math.hypot(x2 - x1, zc - za);
        b.box(0xa16207, 1.2, 0.15, len, (x1 + x2) / 2, 15, (za + zc) / 2, { yaw: Math.atan2(x2 - x1, zc - za) });
      }
      b.box(0x78350f, 1, 5, 1, at(1), 0, place.z - 5).box(0x78350f, 1, 5, 1, at(1), 0, place.z + 5).box(0x78350f, 1, 1.2, 11, at(1), 5, place.z);
      k.label('LEKKI CONSERVATION CENTRE', 'Canopy walk · Nature trail · Picnics', '#166534', 6.4, 24);
      return { name: 'Lekki Conservation Centre', category: 'Nature park', description: 'A forest in the city: the longest canopy walk in Africa, monkeys, a boardwalk through the swamp, and grass for a picnic.' };
    }
    case 'dangote-refinery': {
      // The tank farm, the columns, the flare stack burning, pipes and a fence
      b.box(0x9ca3af, place.depth, 0.05, along, depthMid, 0, place.z);
      for (let i = 0; i < 6; i++) {
        const x = at(24 + (i % 3) * 22);
        const z = z0 + 20 + Math.floor(i / 3) * 40;
        b.cylinder(0xe5e7eb, 9, 12, x, 0, z, { sides: 24 }).cylinder(0xcbd5e1, 9.1, 0.4, x, 12, z, { sides: 24 });
        k.obstruct(x - 9, x + 9, z - 9, z + 9, 12);
      }
      for (let i = 0; i < 4; i++) {
        const x = at(12);
        const z = z0 + 14 + i * 10;
        b.cylinder(0xa1a1aa, 1.4, 38 + i * 4, x, 0, z, { sides: 12 }).cylinder(0x52525b, 1.6, 0.6, x, 12, z, { sides: 12 }).cylinder(0x52525b, 1.6, 0.6, x, 24, z, { sides: 12 });
        k.obstruct(x - 1.4, x + 1.4, z - 1.4, z + 1.4, 38);
      }
      const fx = at(place.depth - 12);
      const fz = z0 + along - 12;
      b.cylinder(0xb91c1c, 0.8, 55, fx, 0, fz, { sides: 10 }).cone(0xf97316, 2.2, 7, fx, 55, fz, 8, { glow: true }).cone(0xfde047, 1.2, 4.5, fx, 55, fz, 8, { glow: true });
      for (let z = z0 + 8; z < z0 + along - 4; z += 6) b.box(0x71717a, 22, 0.6, 0.6, at(20), 3 + (z % 3), z);
      b.box(0x6b7280, 0.2, 2.6, along, at(0.5), 0, place.z);
      k.obstruct(Math.min(at(0.3), at(0.7)), Math.max(at(0.3), at(0.7)), z0, z0 + along / 2 - 4, 2.6);
      k.obstruct(Math.min(at(0.3), at(0.7)), Math.max(at(0.3), at(0.7)), z0 + along / 2 + 4, z0 + along, 2.6);
      b.box(0xf8fafc, 10, 4, 12, at(5), 0, place.z).box(0x16a34a, 10.2, 0.5, 12.2, at(5), 4, place.z);
      k.label('DANGOTE REFINERY', '650,000 barrels a day · Visitors at the gate', '#0f172a', 5.2, 26);
      return { name: 'Dangote Petroleum Refinery', category: 'Refinery', description: "Africa's largest refinery: a tank farm to the horizon and a flare seen for miles. Take the plant tour, eat at the canteen, apply at HR." };
    }
    case 'radio-house': {
      // A low studio block with its mast, red and white, a light at the top
      b.box(0xf1f5f9, place.depth, 9, along, depthMid, 0, place.z);
      WINDOWS(b, faceX, s, z0, along, 3, 3, 0.4, 0);
      const mx = at(place.depth - 5);
      for (let i = 0; i < 8; i++) b.box(i % 2 ? 0xf8fafc : 0xdc2626, 0.9, 5, 0.9, mx, 9 + i * 5, place.z);
      b.box(0xef4444, 0.6, 0.6, 0.6, mx, 49, place.z, { glow: true });
      b.box(0xdc2626, 0.15, 1.4, 6, faceX - s * 0.08, 6.5, place.z, { glow: true });
      k.footprint(9);
      k.label('NAIJA RADIO HOUSE', 'NaijaFM 99.1 · On air', '#b91c1c', 9.4, 20);
      return { name: 'Naija Radio House', category: 'Radio station', description: 'NaijaFM 99.1: request a song, give a shout-out, or be a guest on the evening show.' };
    }
    case 'balogun-market': {
      // A three-floor market hall behind rows of stalls under umbrellas, cloth hung out
      b.box(0xfde68a, place.depth - 14, 10, along, depthMid + s * 7, 0, place.z);
      WINDOWS(b, at(14), s, z0, along, 3, 3.3, 0.2, 1);
      for (let row = 0; row < 3; row++) {
        for (let z = z0 + 3; z < z0 + along - 2; z += 4) {
          const x = at(2.5 + row * 4);
          const colour = [0xdc2626, 0x2563eb, 0x16a34a, 0xf59e0b, 0x7c3aed][Math.abs(Math.round(z + row)) % 5];
          b.box(0x92400e, 1.6, 0.9, 2.6, x, 0, z).cylinder(0x3f3f46, 0.04, 2.4, x, 0, z).cone(colour, 1.8, 0.6, x, 2.3, z, 8);
          b.box([0xe11d48, 0x0ea5e9, 0xfacc15, 0x10b981][Math.abs(Math.round(z)) % 4], 0.05, 1.3, 1.2, x - s * 0.8, 0.9, z + 0.6);
        }
      }
      k.obstruct(Math.min(at(14), at(place.depth)), Math.max(at(14), at(place.depth)), z0, z0 + along, 10);
      k.label('BALOGUN MARKET', 'Fabric · Lace · Ankara · Shoes · Bags', '#b45309', 10.5, 26);
      return { name: 'Balogun Market', category: 'Market', description: 'The biggest cloth market in Lagos: Ankara, lace, aso-oke, shoes and bags. Haggle hard.' };
    }
    case 'amala-shitta': {
      // A small buka, yellow and green, benches outside, the smoke of the pots
      b.box(0xfacc15, place.depth, 4, along, depthMid, 0, place.z).box(0x15803d, place.depth + 0.6, 0.4, along + 0.6, depthMid, 4, place.z);
      b.box(0x15803d, 2.4, 0.15, along, at(-1.1), 3, place.z, { roll: s * 0.2 });
      b.box(0x1f2937, 0.08, 2.4, 2, faceX - s * 0.05, 0, place.z);
      for (const dz of [-6, -2.5, 2.5, 6]) b.box(0x92400e, 0.5, 0.45, 2.4, at(-1.6), 0, place.z + dz);
      for (let i = 0; i < 4; i++) b.cylinder(0xe5e7eb, 0.25 + i * 0.1, 0.5, at(place.depth - 3), 4.4 + i * 0.5, place.z - 6 + i * 0.3, { sides: 8 });
      k.footprint(4);
      k.label('AMALA SHITTA', 'Amala · Ewedu · Gbegiri · Assorted', '#15803d', 4.5, 14);
      return { name: 'Amala Shitta', category: 'Buka', description: 'The famous amala joint of Surulere: hot amala, ewedu, gbegiri and every kind of meat. Eat with your hand.' };
    }
    case 'viewing-centre': {
      // A hall with its doors open and a big screen showing the match, plastic chairs in rows
      b.box(0xcbd5e1, place.depth, 4, along, depthMid, 0, place.z);
      b.box(0x111827, 0.1, 2.6, along - 4, faceX - s * 0.05, 0, place.z);
      b.box(0x22c55e, 0.08, 1.6, 2.8, faceX - s * 0.1, 1.1, place.z, { glow: true });
      for (let i = 0; i < 10; i++) b.box([0xdc2626, 0x2563eb, 0xf8fafc][i % 3], 0.5, 0.45, 0.5, at(-1.5 - (i % 2)), 0, place.z - 4 + Math.floor(i / 2) * 2);
      k.footprint(4);
      k.label('OGA SUNDAY VIEWING CENTRE', 'EPL · La Liga · AFCON live', '#14532d', 4.2, 15);
      return { name: 'Oga Sunday Viewing Centre', category: 'Viewing centre', description: 'Every big match on a big screen with the noisiest crowd in the area. Pay at the door.' };
    }
    case 'polling-unit': {
      // A canopy over tables, a ballot box, the voters' register on the wall
      b.box(0xf8fafc, place.depth, 3.5, along - 10, depthMid + s * 3, 0, place.z);
      b.box(0x16a34a, 10, 0.2, 12, at(4), 3, place.z).box(0xf8fafc, 10, 0.2, 4, at(4), 3.2, place.z);
      for (const dz of [-5.5, 5.5]) for (const dx of [0, 8]) b.cylinder(0x9ca3af, 0.08, 3, at(dx), 0, place.z + dz);
      b.box(0x92400e, 1, 0.8, 4, at(4), 0, place.z).box(0xe5e7eb, 0.6, 0.6, 0.6, at(4), 0.8, place.z, { glow: false });
      k.obstruct(Math.min(at(3.5), at(4.5)), Math.max(at(3.5), at(4.5)), place.z - 2, place.z + 2, 0.8);
      k.label('POLLING UNIT 001', 'INEC · Lagos Island Civic Centre', '#166534', 3.6, 16);
      return { name: 'Polling Unit 001', category: 'Polling unit', description: 'Where Lagos Island votes. Check the register, and on election day cast your ballot.' };
    }
    case 'afrika-shrine': {
      // A big open hall, a corrugated roof, walls painted with faces and colour, the stage lights
      b.box(0x7f1d1d, place.depth, 0.1, along, depthMid, 0, place.z);
      b.box(0x9ca3af, place.depth + 2, 0.3, along + 2, depthMid, 8, place.z, { roll: s * 0.04 });
      for (let z = z0; z <= z0 + along; z += along / 5) for (const d of [0, place.depth]) b.cylinder(0x1f2937, 0.3, 8, at(d), 0, z);
      b.box(0xfacc15, 0.4, 6, along, at(place.depth), 0, place.z);
      for (let i = 0; i < 5; i++) b.box([0xdc2626, 0x16a34a, 0x2563eb, 0xf97316, 0x7c3aed][i], 0.42, 3, 5, at(place.depth) - s * 0.02, 1.5, z0 + 5 + i * 8.5);
      b.box(0x1f2937, 12, 1.2, 8, at(place.depth - 6), 0, place.z);
      for (let i = 0; i < 6; i++) b.box([0xef4444, 0x22c55e, 0x3b82f6][i % 3], 0.4, 0.4, 0.4, at(place.depth - 6), 7.3, place.z - 5 + i * 2, { glow: true });
      k.obstruct(Math.min(at(place.depth - 12), at(place.depth)), Math.max(at(place.depth - 12), at(place.depth)), place.z - 4, place.z + 4, 1.2);
      k.label('NEW AFRIKA SHRINE', 'Live Afrobeat · Thursday jam · Sunday jump', '#7f1d1d', 8.8, 22);
      return { name: 'New Afrika Shrine', category: 'Music venue', description: 'The home of Afrobeat: live bands, a hall that never sleeps on a Thursday, and the spirit of Fela.' };
    }
  }
  return null;
}

/** What can be done at each of these places */
export function moreMenu(id: string, k: PlaceKit): { label: string; run(host: PlaceHost): void } | null {
  if (id.startsWith('station-')) return { label: '⛽ The pump', run: () => k.openPump(id) };
  const offer = (who: string, role: string, text: string, choices: Array<{ label: string; note: string; price: number; arms?: 'reach' | 'greet' | 'wave'; seconds?: number; done: (host: PlaceHost) => void; said: string }>) => (host: PlaceHost) =>
    host.ask({ who, role, text, choices: choices.map((c) => ({ label: c.label, note: c.price ? `₦${c.price.toLocaleString()} · ${c.note}` : c.note, pick: () => k.act(host, c.arms ?? 'reach', c.seconds ?? 2, () => {
      if (c.price && !k.pay(host, c.price, c.label)) return;
      c.done(host);
      host.say(c.said, 'success');
    }) })) });
  const need = (host: PlaceHost, changes: Record<string, number>) => { for (const [n, v] of Object.entries(changes)) host.backend.modifyNeed(n as never, v); };
  switch (id) {
    case 'marina-towers':
      return { label: '🏢 Reception', run: (host) => host.ask({ who: 'Receptionist', role: 'Marina Towers', text: 'Good afternoon. Who are you here to see?', choices: [
        { label: 'Rent office space for my business', note: 'Opens Business', pick: () => k.openApp('business') },
        { label: 'Take the lift to the top floor', note: 'Fun +12', pick: () => k.act(host, 'wave', 3, () => { need(host, { fun: 12 }); host.say('Lagos from twenty floors up: the lagoon, the bridge, the island lit like gold.', 'success'); }) },
        { label: 'Meet a client in the lobby', note: 'Social +15', pick: () => k.act(host, 'greet', 3, () => { need(host, { social: 15 }); host.say('Firm handshake, good gist. They will call you.', 'success'); }) },
      ] }) };
    case 'freedom-park':
      return { label: '🎭 What is on', run: offer('Gate attendant', 'Freedom Park', 'Welcome to Freedom Park! Live band tonight.', [
        { label: 'Watch the show on the open-air stage', note: 'Fun +35, Social +10', price: 5000, arms: 'wave', seconds: 4, done: (h) => need(h, { fun: 35, social: 10 }), said: 'Highlife, then Afrobeat. The crowd sang every word.' },
        { label: 'Walk round the art exhibition', note: 'Fun +12', price: 0, arms: 'greet', seconds: 3, done: (h) => need(h, { fun: 12 }), said: 'Paintings, sculptures, and the old prison cells. Lagos history up close.' },
        { label: 'Food and a cold drink at the stalls', note: 'Hunger', price: 6500, done: (h) => need(h, { hunger: 40 }), said: 'Asun, small chops and a cold Chapman.' },
      ]) };
    case 'ivory-rooftop':
      return { label: '🍸 The lounge', run: offer('Host', 'Ivory Rooftop', 'Good evening. Table, bar, or just the view?', [
        { label: 'A cocktail at the bar', note: 'Fun +20, Social +15', price: 25000, done: (h) => need(h, { fun: 20, social: 15 }), said: 'A smoky old fashioned with the whole of Lagos lit below.' },
        { label: 'Bottle service at a table', note: 'Social +40, Fun +30', price: 350000, arms: 'wave', seconds: 3, done: (h) => need(h, { social: 40, fun: 30 }), said: 'Sparklers came out. Everybody on the roof knows your name now.' },
        { label: 'Watch the sunset', note: 'Fun +10', price: 0, arms: 'greet', seconds: 3, done: (h) => need(h, { fun: 10 }), said: 'Orange sky over the lagoon. Beautiful.' },
      ]) };
    case 'the-library':
      return { label: '📚 Private dining', run: offer('Maître d', 'The Library', 'Welcome. Members and their guests only, but we can make room.', [
        { label: 'A private dinner, three courses', note: 'Hunger +60, Social +20', price: 85000, arms: 'reach', seconds: 3, done: (h) => need(h, { hunger: 60, social: 20 }), said: 'Seafood, steak, and a dessert you will talk about for a week.' },
        { label: 'A glass of wine by the shelves', note: 'Fun +12', price: 30000, done: (h) => need(h, { fun: 12 }), said: 'Quiet, cool, expensive. You feel like a chairman.' },
      ]) };
    case 'i-fitness':
      return { label: '🏋️ Train', run: offer('Trainer', 'i-Fitness', 'Ready to sweat? Day pass or membership?', [
        { label: 'Day pass: a full workout', note: 'Health +10, Energy -20', price: 15000, arms: 'wave', seconds: 4, done: (h) => { need(h, { health: 10, energy: -20 }); h.backend.addSkillExp('fitness', 2); }, said: 'Cardio, weights, and a trainer who would not let you stop. Fitness up.' },
        { label: 'Monthly membership', note: 'Health +15', price: 120000, done: (h) => { need(h, { health: 15 }); h.backend.addSkillExp('fitness', 1); }, said: 'Card on your phone. See you every morning by six.' },
      ]) };
    case 'lekki-conservation':
      return { label: '🌳 Visit', run: offer('Ranger', 'Lekki Conservation Centre', 'Welcome to the forest! Mind the monkeys.', [
        { label: 'The canopy walk', note: 'Fun +35, Energy -10', price: 10000, arms: 'wave', seconds: 5, done: (h) => need(h, { fun: 35, energy: -10 }), said: 'Forty metres up on a swinging bridge. Your legs shook; the view was worth it.' },
        { label: 'A picnic on the grass', note: 'Hunger +30, Social +20, Fun +15', price: 15000, arms: 'reach', seconds: 4, done: (h) => need(h, { hunger: 30, social: 20, fun: 15 }), said: 'Jollof, chicken, a cold drink and good gist under the trees.' },
        { label: 'Walk the boardwalk and watch the monkeys', note: 'Fun +10', price: 3000, arms: 'greet', seconds: 3, done: (h) => need(h, { fun: 10 }), said: 'A monkey stole a biscuit from a child. Everybody laughed.' },
      ]) };
    case 'dangote-refinery':
      return { label: '🛢️ Visitors centre', run: (host) => host.ask({ who: 'Security', role: 'Dangote Refinery', text: 'Hard hat on before you pass the gate.', choices: [
        { label: 'Plant tour in a hard hat', note: 'Free · Fun +15', pick: () => k.act(host, 'greet', 5, () => { need(host, { fun: 15 }); host.say('Distillation columns taller than buildings, and the flare roaring like a jet.', 'success'); }) },
        { label: 'HR office: apply for a job', note: 'Opens Jobs', pick: () => k.openApp('jobs') },
        { label: 'Staff canteen: rice, stew and plantain', note: '₦3,500 · Hunger', pick: () => k.act(host, 'reach', 2, () => { if (k.pay(host, 3500, 'Canteen meal')) { need(host, { hunger: 45 }); host.say('Big portion, hot stew. Factory food is real food.', 'success'); } }) },
      ] }) };
    case 'radio-house':
      return { label: '📻 Studio', run: offer('Producer', 'NaijaFM 99.1', 'You dey for studio! Wetin you want?', [
        { label: 'Request a song with a shout-out', note: 'Fun +10, Social +10', price: 5000, done: (h) => need(h, { fun: 10, social: 10 }), said: '"This one goes out to all my people for Lagos!" The DJ said your name on air.' },
        { label: 'Be a guest on the evening show', note: 'Social +30', price: 0, arms: 'greet', seconds: 5, done: (h) => need(h, { social: 30 }), said: 'Twenty minutes of gist on air. Your phone started ringing.' },
      ]) };
    case 'balogun-market':
      return { label: '🧵 Shop the market', run: offer('Alhaja', 'Balogun Market', 'Customer! Come and see original lace, Ankara, everything!', [
        { label: 'Ankara, six yards', note: 'Fashion', price: 18000, done: (h) => need(h, { fun: 8 }), said: 'Bright Ankara, folded and bagged. Your tailor will be happy.' },
        { label: 'Swiss lace, five yards', note: 'For the next owambe', price: 120000, done: (h) => need(h, { fun: 12, social: 5 }), said: 'Original lace, heavy and shining. Owambe ready.' },
        { label: 'Haggle for fun', note: 'Social +12', price: 0, arms: 'greet', seconds: 3, done: (h) => need(h, { social: 12, fun: 6 }), said: '"Last price?" "Oya bring ₦15,000." Everybody left laughing.' },
      ]) };
    case 'amala-shitta':
      return { label: '🍲 Order', run: offer('Iya Shitta', 'Amala Shitta', 'Sit down! Amala dey hot.', [
        { label: 'Amala, ewedu, gbegiri and assorted meat', note: 'Hunger +65', price: 4500, arms: 'reach', seconds: 4, done: (h) => need(h, { hunger: 65, fun: 5 }), said: 'Hot amala, soft and black, with a bowl of gbegiri. Your hand smelt of it for hours.' },
        { label: 'A cold zobo', note: 'Thirst', price: 800, done: (h) => need(h, { hunger: 6 }), said: 'Cold zobo with ginger and pineapple.' },
      ]) };
    case 'viewing-centre':
      return { label: '⚽ Watch the match', run: offer('Oga Sunday', 'Viewing centre', 'Arsenal dey play! Pay at the door.', [
        { label: 'Watch the match', note: 'Fun +25, Social +15', price: 1000, arms: 'wave', seconds: 5, done: (h) => need(h, { fun: 25, social: 15 }), said: 'Last-minute goal. The whole hall stood on the chairs.' },
        { label: 'A cold drink and some suya', note: 'Hunger', price: 4000, done: (h) => need(h, { hunger: 30 }), said: 'Suya and a cold malt for half-time.' },
      ]) };
    case 'polling-unit':
      // The ballot is the State House's own: this week's candidates for each office, one vote each
      return { label: '🗳️ Vote', run: () => k.openStateHouse('polling') };
    case 'afrika-shrine':
      return { label: '🎷 Inside the Shrine', run: offer('Gateman', 'New Afrika Shrine', 'The band never stops. Come in!', [
        { label: 'The Thursday jam', note: 'Fun +40, Social +20', price: 5000, arms: 'wave', seconds: 5, done: (h) => need(h, { fun: 40, social: 20 }), said: 'Horns, drums and a crowd dancing till morning.' },
        { label: 'A drink at the bar', note: 'Social +8', price: 4000, done: (h) => need(h, { social: 8 }), said: 'A cold drink and a stranger who became a friend.' },
      ]) };
  }
  return null;
}

/** Which of the phone's and the map's places stands at which place along the road */
export const DESTINATIONS_HERE: Record<string, string> = {
  'dest_lagos_marina_towers': 'marina-towers',
  'dest_lagos_freedom_park': 'freedom-park',
  'dest_lagos_ivory_rooftop': 'ivory-rooftop',
  'dest_lagos_the_library': 'the-library',
  'dest_lagos_ifitness': 'i-fitness',
  'dest_lagos_lekki_conservation': 'lekki-conservation',
  'dest_lagos_refinery': 'dangote-refinery',
  'dest_lagos_radio': 'radio-house',
  'dest_lagos_balogun_market': 'balogun-market',
  'dest_lagos_amala_shitta': 'amala-shitta',
  'dest_lagos_mama_bisi_salon': 'viewing-centre',
  'dest_lagos_polling_unit': 'polling-unit',
  'dest_lagos_afrika_shrine': 'afrika-shrine',
  // Those that were already built
  'dest_lagos_chapel': 'redemption-cathedral',
  'dest_lagos_central_mosque': 'central-mosque',
  'dest_lagos_elegushi_beach': 'lagoon-beach',
  'dest_lagos_palms_lekki': 'shopwell-mall',
};
