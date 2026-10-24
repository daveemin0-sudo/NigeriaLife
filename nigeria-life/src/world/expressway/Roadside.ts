import * as THREE from 'three';
import { Builder } from '../kit/ArchKit';
import type { Obstruction } from '../plan/CityPlan';
import type { InteractiveObject } from '../World';
import { PlaceActions, type PlaceHost } from '../../destinations/PlaceActions';
import { buildCarBody, CAR_SPECS, type CarSpec } from '../vehicles/CarBodyKit';
import { EXPRESS, ROADSIDE } from './layout';
import { buildJet, buildYacht } from './FleetModels';
import { buildMorePlace, moreMenu, DESTINATIONS_HERE, FORECOURT_DEPTH } from './MorePlaces';
import { STATIONS } from '../Fuel';
import { DestinationRegistry } from '../../destinations/DestinationRegistry';
import type { FleetKind } from '../../assets/Fleet';

/**
 * Places worth stopping at along the expressway: a car showroom, a cathedral, a mosque, a
 * beach on the lagoon, a mall, a hotel, the police command, the EFCC, a golf club and the
 * government house. Each is built facing the road with its name up, and has a card with
 * things to do there, acted out by the player.
 */
export interface RoadsideHooks {
  /** Opens the phone on one of its apps */
  openApp(app: string): void;
  /** Opens the jets and yachts for sale and owned */
  openFleet(kind: FleetKind): void;
  /** The player's own jets or yachts, by id and what to call them */
  mine(kind: FleetKind): Array<{ uid: string; label: string }>;
  /** Flies the player in their jet to another city */
  fly(uid: string, city: string): void;
  /** Takes the player out on the lagoon in their yacht */
  cruise(uid: string): void;
  /** Opens the pump at a filling station */
  openPump(stationId: string): void;
}

/** Where the airfield's stands and the marina's berths are */
export const AIRFIELD = { apronX: 70, runwayX: 132, stands: [2735, 2790, 2845, 2900], from: 2712, to: 2948 };
export const MARINA = { pierZ: 1322, berths: [52, 92, 132, 172] };

type Place = (typeof ROADSIDE)[number];

function signBoard(text: string, sub: string, width: number, height: number, bg: string, fg = '#ffffff'): THREE.Mesh {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = Math.max(64, Math.round((512 * height) / width));
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = fg;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `800 ${Math.round(canvas.height * (sub ? 0.4 : 0.55))}px Outfit Variable, Arial, sans-serif`;
  ctx.fillText(text, canvas.width / 2, canvas.height * (sub ? 0.38 : 0.52), canvas.width - 24);
  if (sub) {
    ctx.font = `600 ${Math.round(canvas.height * 0.22)}px Outfit Variable, Arial, sans-serif`;
    ctx.fillText(sub, canvas.width / 2, canvas.height * 0.76, canvas.width - 24);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return new THREE.Mesh(new THREE.PlaneGeometry(width, height), new THREE.MeshBasicMaterial({ map: texture, toneMapped: false }));
}

export class Roadside {
  public readonly group = new THREE.Group();
  public readonly obstructions: Obstruction[] = [];
  public readonly interactive: InteractiveObject[] = [];
  /** Each place's own group, for drawing only the ones near */
  private readonly parts: Array<{ group: THREE.Group; z: number }> = [];
  /** What each place is called on its card */
  private readonly names = new Map<string, string>();

  /** Set by the game */
  public hooks: RoadsideHooks = { openApp: () => {}, openFleet: () => {}, mine: () => [], fly: () => {}, cruise: () => {}, openPump: () => {} };
  /** The jets and yachts standing at the airfield and the marina, by their id */
  public readonly craft = new Map<string, THREE.Group>();
  private readonly fleetGroup = new THREE.Group();

  constructor() {
    this.group.name = 'Expressway places';
    for (const place of ROADSIDE) this.build(place);
    // The filling stations along the road, where their forecourts are
    for (const place of ROADSIDE) {
      if (!place.id.startsWith('station-')) continue;
      const { faceX } = this.front(place);
      STATIONS.push({ id: place.id, name: this.names.get(place.id) ?? 'NaijaPetro', x: faceX + place.side * FORECOURT_DEPTH, z: place.z, city: 'lagos' });
    }
    // The phone's and the map's places: a ride there, or a pin, goes to the door of the one built here
    const registry = DestinationRegistry.getInstance();
    for (const [destination, placeId] of Object.entries(DESTINATIONS_HERE)) {
      const place = ROADSIDE.find((p) => p.id === placeId);
      const d = registry.getById(destination);
      if (!place || !d) continue;
      const { standX } = this.front(place);
      d.streetPosition = new THREE.Vector3(standX, 0, place.z);
      if (d.entrance) d.entrance.position = new THREE.Vector3(standX, 0, place.z);
      d.name = this.names.get(placeId) ?? d.name;
    }
    this.fleetGroup.name = 'Jets and yachts';
    this.group.add(this.fleetGroup);
  }

  /** Puts the owned jets on their stands and the yachts at their berths, each as painted */
  public showFleet(jets: Array<{ uid: string; length: number; paint: number; name: string }>, yachts: Array<{ uid: string; length: number; paint: number; name: string }>): void {
    this.fleetGroup.clear();
    this.craft.clear();
    jets.slice(0, AIRFIELD.stands.length).forEach((jet, i) => {
      const mesh = buildJet(jet.length, jet.paint, jet.name);
      // Nose to the road
      mesh.position.set(AIRFIELD.apronX, 0, AIRFIELD.stands[i]);
      mesh.rotation.y = Math.PI;
      mesh.userData.home = mesh.position.clone();
      this.fleetGroup.add(mesh);
      this.craft.set(jet.uid, mesh);
    });
    yachts.slice(0, MARINA.berths.length).forEach((yacht, i) => {
      const mesh = buildYacht(yacht.length, yacht.paint, yacht.name);
      const beam = yacht.length * 0.24;
      mesh.position.set(MARINA.berths[i] + yacht.length * 0.5 - 18, -3.6, MARINA.pierZ + 2.2 + beam / 2);
      mesh.userData.home = mesh.position.clone();
      this.fleetGroup.add(mesh);
      this.craft.set(yacht.uid, mesh);
    });
  }

  public update(playerZ: number): void {
    for (const part of this.parts) part.group.visible = Math.abs(part.z - playerZ) < 340;
    for (const mesh of this.craft.values()) mesh.visible = Math.abs(mesh.position.z - playerZ) < 420;
  }

  /** Where a place's front is, on the pavement, and the x of its face */
  private front(place: Place): { faceX: number; standX: number } {
    const faceX = place.side * (EXPRESS.half + EXPRESS.walk + 2);
    return { faceX, standX: place.side * (EXPRESS.half + EXPRESS.walk - 1) };
  }

  private build(place: Place): void {
    const group = new THREE.Group();
    group.name = place.id;
    const b = new Builder();
    const { faceX, standX } = this.front(place);
    const s = place.side;
    const depthMid = faceX + (s * place.depth) / 2;
    const z0 = place.z - place.length / 2;
    const footprint = (height: number, structure = true) =>
      this.obstructions.push({ owner: place.id, minX: Math.min(faceX, faceX + s * place.depth), maxX: Math.max(faceX, faceX + s * place.depth), minZ: z0, maxZ: z0 + place.length, height, structure });
    const label = (text: string, sub: string, bg: string, y: number, width = Math.min(place.length - 4, 26)) => {
      const board = signBoard(text, sub, width, width / 5.5, bg);
      board.position.set(faceX - s * 0.06, y, place.z);
      board.rotation.y = s < 0 ? Math.PI / 2 : -Math.PI / 2;
      group.add(board);
    };

    let card: { name: string; category: string; description: string };
    switch (place.id) {
      case 'sankofa-motors': {
        // A glass showroom with cars on show
        b.box(0x111827, place.depth, 0.6, place.length, depthMid, 7, place.z);
        b.box(0x93c5fd, place.depth - 0.4, 7, place.length - 0.4, depthMid, 0, place.z, { glow: false });
        b.box(0xe5e7eb, place.depth, 0.15, place.length, depthMid, 0, place.z);
        for (const dz of [-place.length / 2, place.length / 2]) b.box(0x111827, place.depth, 7.6, 0.4, depthMid, 0, place.z + dz);
        const show = ['huracan', 'urus', 'range_rover', 'camry', 'cullinan'];
        show.forEach((body, i) => {
          const spec = { ...CAR_SPECS[body], paint: CAR_SPECS[body].paint ?? 0xffffff } as CarSpec;
          const car = buildCarBody(spec);
          car.position.set(faceX + s * (4 + (i % 2) * 7), 0.15, z0 + 6 + i * ((place.length - 12) / (show.length - 1)));
          car.rotation.y = s < 0 ? -Math.PI / 2 + 0.4 : Math.PI / 2 - 0.4;
          group.add(car);
        });
        footprint(7.6);
        label('SANKOFA MOTORS', 'New & tokunbo · Lamborghini · Porsche · Toyota', '#0f172a', 8.4, 30);
        card = { name: 'Sankofa Motors', category: 'Car showroom', description: 'Every car in Lagos, from a Corolla to a Chiron. Browse, test the price, drive it home.' };
        break;
      }
      case 'redemption-cathedral': {
        b.box(0xf5f5f4, place.depth, 9, place.length - 8, depthMid, 0, place.z + 4);
        b.box(0x7f1d1d, place.depth + 1, 0.5, place.length - 7, depthMid, 9, place.z + 4, { roll: 0 });
        b.cone(0x7f1d1d, place.depth * 0.75, 6, depthMid, 9.4, place.z + 4, 4);
        // The bell tower with its cross, at the front corner
        const tx = faceX + s * 4;
        const tz = z0 + 4;
        b.box(0xe7e5e4, 7, 22, 7, tx, 0, tz).cone(0x475569, 5, 7, tx, 22, tz, 4);
        b.box(0xfacc15, 0.4, 3.4, 0.4, tx, 29, tz, { glow: true }).box(0xfacc15, 2, 0.4, 0.4, tx, 31.2, tz, { glow: true });
        for (let z = z0 + 10; z < z0 + place.length - 2; z += 4) b.box(0x60a5fa, 0.1, 4.5, 1.6, faceX - s * 0.05, 2.5, z, { glow: true });
        footprint(9);
        this.obstructions.push({ owner: place.id, minX: tx - 3.5, maxX: tx + 3.5, minZ: tz - 3.5, maxZ: tz + 3.5, height: 22, structure: true });
        label('REDEMPTION CATHEDRAL', 'Sunday service 8 am & 11 am · All are welcome', '#7f1d1d', 7.6);
        card = { name: 'Redemption Cathedral', category: 'Church', description: 'Singing, drums and a long sermon. Come in, sit down, give what you can.' };
        break;
      }
      case 'central-mosque': {
        b.box(0xf8fafc, place.depth, 10, place.length - 10, depthMid, 0, place.z);
        b.dome(0x15803d, Math.min(place.depth, place.length) * 0.32, depthMid, 10, place.z);
        b.cylinder(0xfacc15, 0.2, 2.5, depthMid, 10 + Math.min(place.depth, place.length) * 0.32, place.z, { glow: true });
        for (const dz of [-place.length / 2 + 3, place.length / 2 - 3]) {
          b.cylinder(0xf8fafc, 1.3, 26, faceX + s * 3, 0, place.z + dz, { sides: 12 });
          b.cone(0x15803d, 1.6, 4, faceX + s * 3, 26, place.z + dz, 12);
          this.obstructions.push({ owner: place.id, minX: faceX + s * 3 - 1.3, maxX: faceX + s * 3 + 1.3, minZ: place.z + dz - 1.3, maxZ: place.z + dz + 1.3, height: 26, structure: false });
        }
        for (let z = z0 + 7; z < z0 + place.length - 6; z += 3) b.box(0x15803d, 0.1, 4, 1.4, faceX - s * 0.05, 2, z);
        this.obstructions.push({ owner: place.id, minX: Math.min(faceX, faceX + s * place.depth), maxX: Math.max(faceX, faceX + s * place.depth), minZ: z0 + 5, maxZ: z0 + place.length - 5, height: 10, structure: true });
        label('LAGOS CENTRAL MOSQUE', 'Jumat prayers Friday 1 pm', '#15803d', 7.4, 22);
        card = { name: 'Lagos Central Mosque', category: 'Mosque', description: 'Wash, take off your shoes and pray. Peace in the middle of the city.' };
        break;
      }
      case 'lagoon-beach': {
        // Sand down to the lagoon, umbrellas, loungers and palms
        b.box(0xe8d5a3, place.depth, 0.08, place.length, depthMid, 0, place.z);
        const colours = [0xdc2626, 0xfacc15, 0x16a34a, 0x2563eb, 0xf97316];
        for (let i = 0; i < 18; i++) {
          const x = faceX + s * (8 + (i % 6) * 15);
          const z = z0 + 12 + Math.floor(i / 6) * 34;
          b.cylinder(0x78350f, 0.06, 2.4, x, 0, z).cone(colours[i % colours.length], 1.6, 0.9, x, 2.2, z, 10);
          b.box(0xf8fafc, 0.7, 0.35, 1.8, x + 1.4, 0, z, { pitch: -0.15 });
        }
        for (let i = 0; i < 10; i++) {
          const x = faceX + s * (4 + i * 10);
          const z = z0 + 4 + (i % 2) * (place.length - 8);
          b.cylinder(0x92400e, 0.25, 7, x, 0, z, { topRadius: 0.18 });
          for (let f = 0; f < 6; f++) b.box(0x16a34a, 0.4, 0.1, 3, x + Math.sin(f) * 1.2, 7, z + Math.cos(f) * 1.2, { yaw: f, pitch: -0.4 });
        }
        // A bar hut by the road
        b.box(0xb45309, 5, 3, 7, faceX + s * 4, 0, z0 + place.length / 2).cone(0xd6b46a, 5.4, 2, faceX + s * 4, 3, z0 + place.length / 2, 4);
        this.obstructions.push({ owner: place.id, minX: faceX + s * 4 - 2.5, maxX: faceX + s * 4 + 2.5, minZ: place.z - 3.5, maxZ: place.z + 3.5, height: 3, structure: true });
        label('ELEGUSHI BEACH', 'Chill · Suya · Coconut · Afrobeats', '#0e7490', 4.6, 18);
        card = { name: 'Elegushi Beach', category: 'Beach', description: 'Sand, the lagoon breeze, cold drinks and music. Lie down for a while and forget the go-slow.' };
        break;
      }
      case 'shopwell-mall': {
        b.box(0xe2e8f0, place.depth, 11, place.length, depthMid, 0, place.z);
        b.box(0xdc2626, 0.3, 2.4, place.length, faceX - s * 0.15, 8.5, place.z);
        b.box(0x93c5fd, 0.2, 5, place.length * 0.5, faceX - s * 0.1, 0, place.z);
        footprint(11);
        label('THE PALMS MALL', 'Supermarket · Food court · Cinema', '#dc2626', 9.7, 30);
        card = { name: 'The Palms Mall', category: 'Supermarket & mall', description: 'Groceries, drinks, phones and clothes under one roof, with air-conditioning and generator light.' };
        break;
      }
      case 'eko-grand-hotel': {
        b.box(0x1e3a8a, place.depth, 46, place.length, depthMid, 0, place.z);
        for (let f = 1; f < 14; f++) b.box(f % 3 ? 0x1e293b : 0xfde68a, 0.06, 1.6, place.length - 2, faceX - s * 0.03, f * 3.2, place.z, { glow: f % 3 === 0 });
        b.box(0xd4af37, 6, 0.4, 10, faceX + s * -2.5, 4, place.z);
        footprint(46);
        label('EKO GRAND HOTEL', '★★★★★ · Rooms · Pool · Restaurant', '#b45309', 6.2, 22);
        card = { name: 'Eko Grand Hotel', category: 'Hotel', description: 'Air-conditioned rooms, soft beds, room service. Sleep like a big man.' };
        break;
      }
      case 'police-command': {
        b.box(0xf8fafc, place.depth, 10, place.length, depthMid, 0, place.z);
        b.box(0x1d4ed8, place.depth + 0.4, 1.4, place.length + 0.4, depthMid, 10, place.z);
        for (let z = z0 + 3; z < z0 + place.length - 2; z += 3) b.box(0x1e3a8a, 0.06, 1.6, 1.6, faceX - s * 0.03, 5, z);
        b.cylinder(0x9ca3af, 0.08, 9, faceX + s * -3, 0, place.z - 8).box(0x16a34a, 0.05, 1.2, 2, faceX + s * -3, 7.8, place.z - 9);
        footprint(10);
        label('LAGOS STATE POLICE COMMAND', 'Police is your friend · Emergency 112', '#1d4ed8', 7.6, 28);
        card = { name: 'Lagos State Police Command', category: 'Police', description: 'Report a crime, ask for help, or bail somebody out.' };
        break;
      }
      case 'efcc-office': {
        b.box(0xe7e5e4, place.depth, 14, place.length, depthMid, 0, place.z);
        b.box(0x166534, 0.3, 14, 4, faceX - s * 0.15, 0, place.z);
        footprint(14);
        label('EFCC ZONAL OFFICE', 'Economic and Financial Crimes Commission', '#166534', 11, 24);
        card = { name: 'EFCC Zonal Office', category: 'Government office', description: 'Where the anti-graft agency asks where the money came from.' };
        break;
      }
      case 'ikeja-golf': {
        b.box(0x4d7c0f, place.depth, 0.06, place.length, depthMid, 0, place.z);
        for (let i = 0; i < 6; i++) {
          const x = faceX + s * (12 + (i % 3) * 22);
          const z = z0 + 18 + Math.floor(i / 3) * 44;
          b.cylinder(0x65a30d, 4, 0.08, x, 0.02, z, { sides: 20 });
          b.cylinder(0xf8fafc, 0.04, 2.2, x, 0, z).box(0xdc2626, 0.04, 0.5, 0.8, x, 1.7, z + 0.4);
        }
        for (let i = 0; i < 12; i++) b.cone(0x166534, 2.5, 6, faceX + s * (6 + (i % 4) * 22), 0, z0 + 3 + Math.floor(i / 4) * 40, 7);
        b.box(0xfef3c7, 12, 5, 16, faceX + s * 7, 0, z0 + place.length - 12).cone(0x7f1d1d, 11, 3, faceX + s * 7, 5, z0 + place.length - 12, 4);
        this.obstructions.push({ owner: place.id, minX: faceX + s * 7 - 6, maxX: faceX + s * 7 + 6, minZ: z0 + place.length - 20, maxZ: z0 + place.length - 4, height: 5, structure: true });
        label('IKEJA GOLF CLUB', 'Members & guests · 9 holes', '#14532d', 4.2, 20);
        card = { name: 'Ikeja Golf Club', category: 'Golf club', description: 'Nine holes on green grass, caddies, and the clubhouse bar after.' };
        break;
      }
      case 'lagoon-marina': {
        // A clubhouse on the shore, a pier out over the water along the shore, and berths off it
        b.box(0xf8fafc, 12, 4, 20, faceX + s * 8, 0, place.z - 10).box(0x0e7490, 13, 0.4, 21, faceX + s * 8, 4, place.z - 10);
        this.obstructions.push({ owner: place.id, minX: faceX + s * 2, maxX: faceX + s * 14, minZ: place.z - 20, maxZ: place.z, height: 4, structure: true });
        b.box(0xa16207, 4, 0.3, 26, 34, -0.3, EXPRESS.lagoonFrom + 11);
        b.box(0xa16207, 170, 0.3, 4, 105, -0.3, MARINA.pierZ);
        for (let x = 22; x <= 190; x += 8) for (const dz of [-1.8, 1.8]) b.cylinder(0x78350f, 0.18, 3.4, x, -3.6, MARINA.pierZ + dz);
        for (const x of MARINA.berths) b.box(0xfacc15, 0.4, 0.5, 0.4, x - 15, 0, MARINA.pierZ + 1.7, { glow: true });
        label('EKO MARINA', 'Berths · Fuel · Yacht club', '#0e7490', 5, 20);
        card = { name: 'Eko Marina', category: 'Marina', description: 'Yachts and speedboats on the lagoon. Buy one, berth it here, take your people out on the water.' };
        break;
      }
      case 'private-airfield': {
        // An apron, a short runway beside it, a small terminal by the road, a windsock
        b.box(0xa1a1aa, AIRFIELD.runwayX + 14 - 18, 0.04, AIRFIELD.to - AIRFIELD.from, (AIRFIELD.runwayX + 14 + 18) / 2, 0, (AIRFIELD.from + AIRFIELD.to) / 2);
        b.box(0x27272a, 22, 0.06, AIRFIELD.to - AIRFIELD.from, AIRFIELD.runwayX, 0, (AIRFIELD.from + AIRFIELD.to) / 2);
        for (let z = AIRFIELD.from + 6; z < AIRFIELD.to - 6; z += 14) b.box(0xf8fafc, 0.5, 0.07, 7, AIRFIELD.runwayX, 0, z);
        for (const z of AIRFIELD.stands) b.box(0xfacc15, 30, 0.07, 0.3, AIRFIELD.apronX, 0, z).box(0xfacc15, 0.3, 0.07, 30, AIRFIELD.apronX, 0, z);
        b.box(0xf8fafc, 16, 6, 40, 26, 0, 2830).box(0x1e3a8a, 16.4, 0.5, 40.4, 26, 6, 2830).box(0x0f172a, 0.1, 2.4, 34, 34.05, 1.8, 2830);
        this.obstructions.push({ owner: place.id, minX: 18, maxX: 34, minZ: 2810, maxZ: 2850, height: 6, structure: true });
        b.cylinder(0x9ca3af, 0.08, 6, 150, 0, AIRFIELD.from + 10).cone(0xf97316, 0.5, 2, 150.6, 6, AIRFIELD.from + 10, 8, { roll: Math.PI / 2 });
        label('EKO EXECUTIVE AIRFIELD', 'Private jets · Charter · Fuel', '#1e3a8a', 7.4, 28);
        card = { name: 'Eko Executive Airfield', category: 'Private airfield', description: 'Private jets only. Buy one, park it on your stand, and fly anywhere in Nigeria when you like.' };
        break;
      }
      default: {
        const more = buildMorePlace({
          b, place, faceX, s, depthMid, z0, group, footprint,
          obstruct: (minX, maxX, minZ, maxZ, height) => this.obstructions.push({ owner: place.id, minX, maxX, minZ, maxZ, height, structure: true }),
          label,
        });
        if (more) {
          card = more;
          break;
        }
        // The government house: white, columns, a flag
        b.box(0xf8fafc, place.depth, 12, place.length, depthMid, 0, place.z);
        for (let z = z0 + 3; z < z0 + place.length - 2; z += 3.5) b.cylinder(0xffffff, 0.45, 9, faceX + s * -1.2, 0, z);
        b.box(0xf8fafc, 2.6, 0.8, place.length, faceX + s * -1.2, 9, place.z);
        b.cylinder(0x9ca3af, 0.1, 14, faceX + s * -6, 0, place.z).box(0x16a34a, 0.05, 1.4, 1.2, faceX + s * -6, 12.4, place.z + 0.6).box(0xffffff, 0.05, 1.4, 1.2, faceX + s * -6, 12.4, place.z + 1.8).box(0x16a34a, 0.05, 1.4, 1.2, faceX + s * -6, 12.4, place.z + 3);
        footprint(12);
        label('LAGOS STATE GOVERNMENT HOUSE', 'Alausa · Office of the Governor', '#166534', 10.6, 30);
        card = { name: 'Lagos State Government House', category: 'Government', description: 'The seat of the state government. Petitions, permits and long queues.' };
      }
    }
    group.add(b.build(place.id));
    group.visible = false;
    this.group.add(group);
    this.parts.push({ group, z: place.z });

    // The card: walk up to the front and see what can be done here
    const marker = new THREE.Mesh(new THREE.BoxGeometry(3, 4, 6), new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }));
    marker.position.set(faceX - s * 1.6, 2, place.z);
    group.add(marker);
    const id = `roadside-${place.id}`;
    this.names.set(place.id, card.name);
    this.interactive.push({ mesh: marker, id, name: card.name, category: card.category, description: card.description, interactionPoint: new THREE.Vector3(standX, 0, place.z) });
    PlaceActions.register(id, this.actionFor(place.id, card.name));
  }

  /** What can be done at each place */
  private actionFor(placeId: string, name: string) {
    const act = (host: PlaceHost, arms: 'reach' | 'greet' | 'wave', seconds: number, effect: () => void) =>
      host.director.perform({ id: `${placeId} visit`, actor: host.actor, animation: { arms }, seconds, effect: () => { effect(); } });
    const pay = (host: PlaceHost, amount: number, what: string): boolean => {
      const paid = host.backend.processTransaction({ type: 'SHOP_PURCHASE', amount, description: `${what}, ${name}` });
      if (!paid.success) host.say(`That is ₦${amount.toLocaleString()}. You do not have enough.`, 'warning');
      return paid.success;
    };
    const menu: Record<string, { label: string; run(host: PlaceHost): void }> = {
      'sankofa-motors': {
        label: '🚗 Browse the cars',
        run: () => this.hooks.openApp('garage'),
      },
      'redemption-cathedral': {
        label: '⛪ Go in for the service',
        run: (host) => host.ask({ who: 'Usher', role: 'Redemption Cathedral', text: 'Welcome, brother, sister! Come and sit down.', choices: [
          { label: 'Sit through the service', note: 'Social +20, Fun +10', pick: () => act(host, 'greet', 4, () => { host.backend.modifyNeed('social', 20); host.backend.modifyNeed('fun', 10); host.say('The choir lifted the roof. You feel light.', 'success'); }) },
          { label: 'Give an offering', note: '₦2,000', pick: () => act(host, 'reach', 1.5, () => { if (pay(host, 2000, 'Offering')) { host.backend.modifyNeed('social', 8); host.say('God bless you! Your offering is received.', 'success'); } }) },
        ] }),
      },
      'central-mosque': {
        label: '🕌 Go in and pray',
        run: (host) => act(host, 'greet', 4, () => { host.backend.modifyNeed('social', 15); host.backend.modifyNeed('fun', 8); host.say('You prayed in peace. The noise of the road is far away.', 'success'); }),
      },
      'lagoon-beach': {
        label: '🏖️ Relax on the beach',
        run: (host) => host.ask({ who: 'Beach bar', role: 'Elegushi Beach', text: 'Welcome! Lounger, drink, suya?', choices: [
          { label: 'Lie on a lounger by the water', note: '₦3,000 · Fun +30, Energy +10', pick: () => act(host, 'wave', 3, () => { if (pay(host, 3000, 'Lounger')) { host.backend.modifyNeed('fun', 30); host.backend.modifyNeed('energy', 10); host.say('Breeze, waves, Afrobeats. You needed this.', 'success'); } }) },
          { label: 'Fresh coconut water', note: '₦1,500 · Hunger', pick: () => act(host, 'reach', 1.5, () => { if (pay(host, 1500, 'Coconut water')) { host.backend.modifyNeed('hunger', 15); host.say('Cold coconut water, straight from the nut.', 'success'); } }) },
          { label: 'Suya and a cold drink', note: '₦4,500 · Hunger', pick: () => act(host, 'reach', 1.5, () => { if (pay(host, 4500, 'Suya')) { host.backend.modifyNeed('hunger', 35); host.backend.modifyNeed('fun', 5); host.say('Hot suya with yaji. Sweet!', 'success'); } }) },
        ] }),
      },
      'shopwell-mall': {
        label: '🛒 Go shopping',
        run: () => this.hooks.openApp('shopping'),
      },
      'eko-grand-hotel': {
        label: '🏨 Reception',
        run: (host) => host.ask({ who: 'Front desk', role: 'Eko Grand Hotel', text: 'Good day! How can we help you?', choices: [
          { label: 'A room for the night', note: '₦85,000 · Energy full', pick: () => act(host, 'reach', 2, () => { if (pay(host, 85000, 'Room for the night')) { host.backend.rest(100, 20); host.backend.modifyNeed('hygiene', 60); host.say('Cold AC, soft bed, hot shower. You slept like a king.', 'success'); } }) },
          { label: 'Lunch at the restaurant', note: '₦18,000 · Hunger', pick: () => act(host, 'reach', 2, () => { if (pay(host, 18000, 'Lunch')) { host.backend.modifyNeed('hunger', 60); host.backend.modifyNeed('fun', 10); host.say('Seafood okra and pounded yam, five-star style.', 'success'); } }) },
        ] }),
      },
      'police-command': {
        label: '👮 Front desk',
        run: (host) => host.ask({ who: 'Desk sergeant', role: 'Lagos State Police Command', text: 'Yes? What happened?', choices: [
          { label: 'Report a crime', pick: () => act(host, 'greet', 2, () => host.say('The sergeant writes it down: "We go look into am." Use Police on your phone to follow it up.', 'info')) },
          { label: 'Ask for directions', pick: () => host.say('"Follow this express straight, you go see am."', 'info') },
        ] }),
      },
      'efcc-office': {
        label: '🏛️ Enquiries',
        run: (host) => host.say('"No file on you for now. Make you keep am so." The officer goes back to his papers.', 'info'),
      },
      'ikeja-golf': {
        label: '⛳ Play nine holes',
        run: (host) => host.ask({ who: 'Club secretary', role: 'Ikeja Golf Club', text: 'Guests pay a green fee. Caddy included.', choices: [
          { label: 'Play nine holes', note: '₦50,000 · Fun +40', pick: () => act(host, 'wave', 4, () => { if (pay(host, 50000, 'Green fee')) { host.backend.modifyNeed('fun', 40); host.backend.modifyNeed('energy', -15); host.backend.addSkillExp('fitness', 1); host.say('Two birdies and one ball in the bush. Good round!', 'success'); } }) },
          { label: 'A drink at the clubhouse', note: '₦6,000 · Social +15', pick: () => act(host, 'reach', 1.5, () => { if (pay(host, 6000, 'Clubhouse drink')) host.backend.modifyNeed('social', 15); }) },
        ] }),
      },
      'government-house': {
        label: '🏛️ Visit',
        run: (host) => host.say('"Leave your petition with us. The Governor will see it." You are given a stamped receipt.', 'info'),
      },
    };
    menu['lagoon-marina'] = {
      label: '🛥️ My yachts',
      run: (host) => {
        const mine = this.hooks.mine('yacht');
        host.ask({ who: 'Harbour master', role: 'Eko Marina', text: mine.length ? 'Which one are we taking out today?' : 'You have no yacht berthed here yet.', choices: [
          ...mine.map((y) => ({ label: `Take "${y.label}" out on the lagoon`, note: 'Fun +40, Social +25', pick: () => this.hooks.cruise(y.uid) })),
          { label: mine.length ? 'Buy another, or repaint' : 'See yachts for sale', pick: () => this.hooks.openFleet('yacht') },
        ] });
      },
    };
    menu['private-airfield'] = {
      label: '✈️ My jets',
      run: (host) => {
        const mine = this.hooks.mine('jet');
        if (!mine.length) {
          host.ask({ who: 'Ground handler', role: 'Eko Executive Airfield', text: 'You have no jet on a stand here yet.', choices: [{ label: 'See jets for sale', pick: () => this.hooks.openFleet('jet') }] });
          return;
        }
        host.ask({ who: 'Ground handler', role: 'Eko Executive Airfield', text: 'Your crew is ready. Which jet are we flying?', choices: [
          ...mine.map((j) => ({ label: `Fly "${j.label}"`, pick: () => host.ask({ who: 'Captain', role: j.label, text: 'Where to?', choices: [
            { label: 'Abuja', note: 'Nnamdi Azikiwe Airport · fuel ₦2,500,000', pick: () => this.hooks.fly(j.uid, 'abuja') },
            { label: 'Port Harcourt', note: 'Port Harcourt Airport · fuel ₦2,000,000', pick: () => this.hooks.fly(j.uid, 'port_harcourt') },
          ] }) })),
          { label: 'Buy another, or repaint', pick: () => this.hooks.openFleet('jet') },
        ] });
      },
    };
    const entry = menu[placeId] ?? moreMenu(placeId, { act, pay, openApp: (app) => this.hooks.openApp(app), openPump: (station) => this.hooks.openPump(station) }) ?? menu['government-house'];
    return { label: () => entry.label, run: (host: PlaceHost) => entry.run(host) };
  }
}
