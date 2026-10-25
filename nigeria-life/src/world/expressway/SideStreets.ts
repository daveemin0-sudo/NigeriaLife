import * as THREE from 'three';
import { Builder, signBoard } from '../kit/ArchKit';
import type { Obstruction } from '../plan/CityPlan';
import type { InteractiveObject } from '../World';
import { PlaceActions } from '../../destinations/PlaceActions';
import { EXPRESS, SIDE_ROADS, SIDE_PLACES, SIDE_WALK, sideFront } from './layout';

/**
 * Side streets off Ikorodu Road: Allen Avenue and Obafemi Awolowo Way, each its own carriageway
 * with pavements, lamps, shops and offices on both sides facing it, a green street sign at the
 * corner, and places along it to go into.
 */

const WALLS = [0xf1e4c8, 0xe7d3b3, 0xf5f5f4, 0xcbd5e1, 0xfde68a, 0xfed7aa, 0xbfdbfe, 0xbbf7d0, 0xfecaca];
const SIGNS = [0xdc2626, 0x16a34a, 0x2563eb, 0xf59e0b, 0x7c3aed, 0x0d9488, 0xdb2777];
const DRAW = 320;

/** What each place looks like from the street, and what its card says */
const PLACES: Record<string, { name: string; category: string; description: string; wall: number; sign: [string, string, string]; floors: number }> = {
  'allen-salon': { name: 'Allen Hair & Barbing Salon', category: 'Salon & barber', description: 'Low cut, fade, braids, a manicure. Sit down and come out looking fresh.', wall: 0xfbcfe8, sign: ['ALLEN HAIR & BARBING', 'Braids · Fades · Nails', '#db2777'], floors: 1 },
  'allen-suya': { name: 'Mai Suya Spot', category: 'Suya', description: 'Suya off the grill with yaji and onions, and a cold drink, on the pavement under the lights.', wall: 0xfed7aa, sign: ['MAI SUYA SPOT', 'Suya · Kilishi · Cold drinks', '#b45309'], floors: 1 },
  'allen-bank': { name: 'Eko Commercial Bank, Allen', category: 'Bank', description: 'A branch with a banking hall and cash machines: deposits, withdrawals, accounts.', wall: 0xe2e8f0, sign: ['EKO COMMERCIAL BANK', 'Allen Avenue branch · ATM', '#1e3a8a'], floors: 3 },
  'awolowo-fashion': { name: 'Awolowo Way Fashion House', category: 'Tailor & fashion', description: 'Measured, cut and sewn: kaftans, agbada, Ankara dresses for owambe.', wall: 0xede9fe, sign: ['FASHION HOUSE', 'Bespoke · Agbada · Kaftan · Ankara', '#7c3aed'], floors: 2 },
  'awolowo-pharmacy': { name: 'Awolowo Way Pharmacy', category: 'Pharmacy', description: 'Medicines, a pharmacist to ask, and a blood pressure check.', wall: 0xdcfce7, sign: ['PHARMACY', 'Medicines · Checks · Advice', '#16a34a'], floors: 1 },
  'awolowo-school': { name: 'Ikeja Computer School', category: 'Training centre', description: 'Courses in coding, design and office skills, by the week.', wall: 0xdbeafe, sign: ['IKEJA COMPUTER SCHOOL', 'Coding · Design · Office skills', '#1d4ed8'], floors: 3 },
};

export class SideStreets {
  public readonly group = new THREE.Group();
  public readonly obstructions: Array<Obstruction & { pole?: boolean }> = [];
  public readonly interactive: InteractiveObject[] = [];
  private readonly parts: Array<{ group: THREE.Group; z: number }> = [];

  constructor() {
    this.group.name = 'side streets';
    for (const road of SIDE_ROADS) this.buildRoad(road);
  }

  public update(playerZ: number): void {
    for (const part of this.parts) part.group.visible = Math.abs(part.z - playerZ) < DRAW;
  }

  private solid(owner: string, minX: number, maxX: number, minZ: number, maxZ: number, height: number, structure = true, pole = false): void {
    this.obstructions.push({ owner, minX, maxX, minZ, maxZ, height, structure, ...(pole ? { pole: true } : {}) });
  }

  private buildRoad(road: (typeof SIDE_ROADS)[number]): void {
    const group = new THREE.Group();
    group.name = road.id;
    const b = new Builder();
    const s = road.side;
    const start = EXPRESS.half + EXPRESS.walk;
    const x0 = s * start;
    const x1 = s * (start + road.length);
    const mx = (x0 + x1) / 2;
    const half = road.half;
    // The carriageway, its centre line and edge lines, and where it crosses the expressway's pavement
    b.box(0x2b2f36, road.length, 0.02, half * 2, mx, 0, road.z);
    b.box(0x2b2f36, EXPRESS.walk + 0.2, 0.02, half * 2, s * (EXPRESS.half + EXPRESS.walk / 2), 0.2, road.z);
    for (let d = 4; d < road.length - 2; d += 7) b.box(0xf8fafc, 3.2, 0.01, 0.13, s * (start + d), 0.021, road.z);
    for (const e of [-1, 1]) b.box(0xf8fafc, road.length, 0.01, 0.13, mx, 0.021, road.z + e * (half - 0.3));
    // Pavements and kerbs both sides, the land behind
    for (const e of [-1, 1]) {
      b.box(0xbcb3a3, road.length, 0.2, SIDE_WALK, mx, 0, road.z + e * (half + SIDE_WALK / 2));
      b.box(0xe5e7eb, road.length, 0.22, 0.25, mx, 0, road.z + e * (half + 0.12));
    }
    // Lamps down both pavements, every 25 m, an arm over the road
    for (let d = 12; d < road.length; d += 25) {
      for (const e of [-1, 1]) {
        const x = s * (start + d + (e > 0 ? 12 : 0));
        const z = road.z + e * (half + 0.6);
        b.cylinder(0x6b7280, 0.1, 7, x, 0.2, z).box(0x6b7280, 0.12, 0.12, 2, x, 7.1, z - e * 1).box(0xfff3c4, 0.4, 0.15, 0.6, x, 7.0, z - e * 1.8, { glow: true });
        this.solid(`${road.name} lamp`, x - 0.12, x + 0.12, z - 0.12, z + 0.12, 7, false, true);
      }
    }
    // The street sign at the corner: green, white letters
    const corner = signBoard([road.name.toUpperCase(), 'Ikeja'], 3.6, 0.9, '#166534', '#ffffff');
    corner.position.set(s * (start + 1.2), 3, road.z - (half + 1.2));
    corner.rotation.y = s > 0 ? -Math.PI / 2 : Math.PI / 2;
    group.add(corner);
    b.cylinder(0x6b7280, 0.06, 3.4, s * (start + 1.2), 0, road.z - (half + 1.2));

    // Shops, offices and houses along both sides, facing the street, round the places
    const front = half + SIDE_WALK;
    let seed = road.z;
    const rand = () => {
      seed = (seed * 9301 + 49297) % 233280;
      return seed / 233280;
    };
    for (const e of [-1, 1] as const) {
      let d = 6;
      while (d < road.length - 8) {
        const width = 8 + rand() * 10;
        const taken = SIDE_PLACES.find((p) => p.road === road.id && p.side === e && d + width > p.at - p.length / 2 - 1.5 && d < p.at + p.length / 2 + 1.5);
        if (taken) {
          d = taken.at + taken.length / 2 + 2;
          continue;
        }
        const depth = 9 + rand() * 8;
        const floors = 1 + Math.floor(rand() * 4);
        const height = floors * 3.2;
        const xa = s * (start + d);
        const xb = s * (start + d + width);
        const zFace = road.z + e * (front + 0.8 + rand() * 1.5);
        const zMid = zFace + (e * depth) / 2;
        b.box(WALLS[Math.floor(rand() * WALLS.length)], width, height, depth, (xa + xb) / 2, 0, zMid);
        for (let f = 0; f < floors; f++) for (let w = 1.4; w < width - 1; w += 2.4) {
          const lit = rand() < 0.3;
          b.box(lit ? 0xfde68a : 0x1e293b, 1.3, 1.3, 0.05, s * (start + d + w), f * 3.2 + 1.1, zFace - e * 0.02, { glow: lit });
        }
        b.box(SIGNS[Math.floor(rand() * SIGNS.length)], width * 0.8, 0.9, 0.1, (xa + xb) / 2, 2.5, zFace - e * 0.06);
        b.box(0x7f1d1d, width + 0.6, 0.3, depth + 0.6, (xa + xb) / 2, height, zMid);
        this.solid(`${road.name} building`, Math.min(xa, xb), Math.max(xa, xb), Math.min(zFace, zFace + e * depth), Math.max(zFace, zFace + e * depth), height);
        d += width + 1 + rand() * 3;
      }
    }

    // The places to go into
    for (const place of SIDE_PLACES.filter((p) => p.road === road.id)) this.buildPlace(b, group, place);

    group.add(b.build(road.id));
    group.visible = false;
    this.group.add(group);
    this.parts.push({ group, z: road.z });
  }

  private buildPlace(b: Builder, group: THREE.Group, place: (typeof SIDE_PLACES)[number]): void {
    const look = PLACES[place.id];
    const front = sideFront(place.id);
    if (!look || !front) return;
    const e = place.side;
    const zMid = front.faceZ + (e * place.depth) / 2;
    const height = look.floors * 3.4;
    b.box(look.wall, place.length, height, place.depth, front.x, 0, zMid);
    // A glass front and a door, an awning over them
    b.box(0x93c5fd, place.length * 0.7, 2.4, 0.06, front.x, 0.3, front.faceZ - e * 0.03);
    b.box(0x5b3a1e, 1.4, 2.3, 0.08, front.x, 0, front.faceZ - e * 0.05);
    b.box(new THREE.Color(look.sign[2]).getHex(), place.length, 0.12, 1.4, front.x, 3, front.faceZ - e * 0.7);
    b.box(0x334155, place.length + 0.4, 0.4, place.depth + 0.4, front.x, height, zMid);
    this.solid(look.name, front.x - place.length / 2, front.x + place.length / 2, Math.min(front.faceZ, front.faceZ + e * place.depth), Math.max(front.faceZ, front.faceZ + e * place.depth), height);
    const board = signBoard([look.sign[0], look.sign[1]], Math.min(place.length - 2, 12), 1.6, look.sign[2], '#ffffff');
    board.position.set(front.x, 3.9, front.faceZ - e * 0.08);
    board.rotation.y = e < 0 ? 0 : Math.PI;
    group.add(board);

    // Its card at the door, and going in
    const marker = new THREE.Mesh(new THREE.BoxGeometry(4, 3, 2), new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }));
    marker.position.set(front.x, 1.5, front.faceZ + e * 0.8);
    group.add(marker);
    const id = `roadside-${place.id}`;
    const door = new THREE.Vector3(front.x, 0, front.standZ);
    this.interactive.push({ mesh: marker, id, name: look.name, category: look.category, description: look.description, interactionPoint: door.clone() });
    PlaceActions.register(id, { label: () => '🚪 Go inside', run: (host) => host.enter(id, door.clone()) });
  }
}
