import * as THREE from 'three';
import { Builder, signBoard } from '../kit/ArchKit';
import { HumanMeshBuilder, type HumanConfig } from '../../graphics/HumanMeshBuilder';
import { bakeToGeometry } from '../../graphics/MeshBaker';
import { neutralJoints, poseTargets, writeJoints, type PoseState } from '../../interactions/Poses';
import { Sequence, steps, type Step } from '../../interactions/Sequence';
import { PlaceActions, type PlaceHost } from '../../destinations/PlaceActions';
import { Figure } from '../../interiors/places/Worship';
import type { InteractiveObject } from '../World';
import { EXPRESS } from './layout';

/**
 * The lagoon under the bridge, alive: fishing canoes paddled about, the yellow ferries going to
 * and fro, speedboats with their wakes, a sand barge, and Makoko, the village on stilts by the
 * mainland end of the bridge: houses of plank and zinc over the water, walkways between them,
 * canoes in its channels, a church, washing on the lines. From a jetty on the mainland shore a
 * canoe takes the player through Makoko, stopping at the floating market for fresh fish.
 */

const WATER = -3.2;
const PEOPLE = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.7 });
/** Makoko: where the village stands on the water, west of the bridge by the mainland shore */
const MAKOKO = { minX: -205, maxX: -52, minZ: 2448, maxZ: 2588 };
const JETTY = { pavement: [-16, 2612] as [number, number], sand: [-40, 2606] as [number, number], end: [-40, 2590] as [number, number], canoe: [-40, 2585.5] as [number, number] };
const FARE = 3000;
const FISH_PRICE = 4000;
/** The canoe's way through Makoko and back, with the floating market on it */
const RIDE: Array<[number, number]> = [[-40, 2585.5], [-46, 2570], [-60, 2558], [-120, 2558], [-185, 2558], [-212, 2548], [-214, 2526], [-195, 2514], [-140, 2514], [-110, 2514], [-60, 2514], [-44, 2522], [-41, 2545], [-40, 2570], [-40, 2585.5]];
/** The floating market, moored along the southern channel */
const MARKET = new THREE.Vector3(-125, 0, 2514);
/** The church stands in a row of its own: no house is put where it is */
const CHURCH = { x: -120, z: 2536 };

function seeded(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

/** A figure baked in a pose, one mesh: for those sitting in boats */
function posed(look: HumanConfig, pose: PoseState, time: number): THREE.BufferGeometry | null {
  const rig = HumanMeshBuilder.createHuman({ lod: 'street', ...look, username: '' });
  rig.nameTag.visible = false;
  if (rig.phoneMesh) rig.phoneMesh.visible = false;
  const holder = new THREE.Group();
  holder.add(rig.group);
  const j = poseTargets(pose, time, neutralJoints());
  writeJoints(rig, j, rig.torso.position.y);
  return bakeToGeometry(holder);
}

interface Boat {
  kind: 'canoe' | 'ferry' | 'speedboat' | 'barge';
  group: THREE.Group;
  curve: THREE.CatmullRomCurve3;
  length: number;
  u: number;
  speed: number;
  bob: number;
  /** Paddlers: two poses shown in turn */
  strokes?: [THREE.Object3D, THREE.Object3D];
}

export class Lagoon {
  public readonly group = new THREE.Group();
  public readonly interactive: InteractiveObject[] = [];
  private readonly boats: Boat[] = [];
  private built = false;
  private time = 0;
  private paddleA: THREE.BufferGeometry | null = null;
  private paddleB: THREE.BufferGeometry | null = null;
  /** The canoe that takes the player to Makoko, and its boatman */
  private ferryCanoe = new THREE.Group();
  private boatman: Figure | null = null;
  private riding = false;
  /** Fresh fish bought at the floating market on this ride */
  private boughtFish = false;
  public rides = 0;

  constructor() {
    this.group.name = 'Lagos Lagoon life';
    this.group.visible = false;
    const stand = new THREE.Vector3(JETTY.pavement[0], 0, JETTY.pavement[1]);
    const marker = new THREE.Mesh(new THREE.BoxGeometry(1.4, 1.6, 1.4), new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }));
    marker.position.set(JETTY.sand[0], 0.8, JETTY.sand[1]);
    this.group.add(marker);
    this.interactive.push({ mesh: marker, id: 'makoko-canoe', name: '🛶 Canoe to Makoko', category: 'Lagos Lagoon', description: 'A canoe through Makoko, the village on stilts, and its floating market.', interactionPoint: stand });
    PlaceActions.register('makoko-canoe', {
      label: () => (this.riding ? '🛶 The canoe is out on the water' : `🛶 Canoe through Makoko · ₦${FARE.toLocaleString()}`),
      run: (host) => this.ride(host),
    });
  }

  /** The lagoon is only drawn and moved when the player is near it */
  public update(delta: number, player: THREE.Vector3): void {
    const near = player.z > EXPRESS.lagoonFrom - 300 && player.z < EXPRESS.lagoonTo + 300 && Math.abs(player.x) < 900;
    this.group.visible = near || this.riding;
    if (!this.group.visible) return;
    this.build();
    this.time += delta;
    const flip = Math.floor(this.time * 1.6) % 2 === 0;
    for (const boat of this.boats) {
      boat.u = (boat.u + (boat.speed * delta) / boat.length) % 1;
      const p = boat.curve.getPointAt(boat.u);
      const t = boat.curve.getTangentAt(boat.u);
      boat.group.position.set(p.x, WATER + Math.sin(this.time * 1.7 + boat.bob) * 0.05, p.z);
      boat.group.rotation.set(0, Math.atan2(t.x, t.z), Math.sin(this.time * 1.3 + boat.bob) * 0.025);
      if (boat.strokes) {
        boat.strokes[0].visible = flip;
        boat.strokes[1].visible = !flip;
      }
    }
    if (!this.riding) {
      this.ferryCanoe.position.set(JETTY.canoe[0], WATER + Math.sin(this.time * 1.5) * 0.04, JETTY.canoe[1]);
    }
    this.boatman?.tick(delta);
  }

  // --- Building it, the first time it is near -------------------------------------------------

  private build(): void {
    if (this.built) return;
    this.built = true;
    const paddler: HumanConfig = { gender: 'male', username: '', outfit: 'casual_tee', outfitColor: 0x9a3412, trousersColor: 0x1f2937, hairstyle: 'short_crop', skinTone: '#5e3a22' };
    this.paddleA = posed(paddler, { legs: 'sit', arms: 'drum' }, 0.1208);
    this.paddleB = posed(paddler, { legs: 'sit', arms: 'drum' }, 0.3625);
    this.buildMakoko();
    this.buildJetty();
    this.buildBoats();
  }

  private canoe(colour: number, length = 5.2, paddled = true): { group: THREE.Group; strokes?: [THREE.Object3D, THREE.Object3D] } {
    const b = new Builder();
    b.box(colour, 0.85, 0.32, length, 0, 0, 0).box(0x3f2a1d, 0.6, 0.06, length - 0.6, 0, 0.26, 0);
    b.box(colour, 0.5, 0.3, 0.8, 0, 0.02, length / 2 + 0.25, { pitch: 0.25 }).box(colour, 0.5, 0.3, 0.8, 0, 0.02, -length / 2 - 0.25, { pitch: -0.25 });
    b.box(0x5b3a1e, 0.75, 0.05, 0.3, 0, 0.2, -length / 2 + 0.8);
    const group = new THREE.Group();
    group.add(b.build('canoe'));
    if (!paddled || !this.paddleA || !this.paddleB) return { group };
    const a = new THREE.Mesh(this.paddleA, PEOPLE);
    const c = new THREE.Mesh(this.paddleB, PEOPLE);
    for (const m of [a, c]) { m.position.set(0, 0.05 - 0.17, -length / 2 + 0.85); group.add(m); }
    // The paddle, held across
    const paddle = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, 1.6), new THREE.MeshStandardMaterial({ color: 0x92400e }));
    paddle.position.set(0.5, 0.55, -length / 2 + 1.2);
    paddle.rotation.x = 0.9;
    group.add(paddle);
    return { group, strokes: [a, c] };
  }

  private buildBoats(): void {
    const rand = seeded(2600);
    const loop = (points: Array<[number, number]>) => new THREE.CatmullRomCurve3(points.map(([x, z]) => new THREE.Vector3(x, 0, z)), true, 'centripetal');
    const add = (kind: Boat['kind'], group: THREE.Group, curve: THREE.CatmullRomCurve3, speed: number, strokes?: [THREE.Object3D, THREE.Object3D]) => {
      group.name = `boat ${kind}`;
      this.group.add(group);
      this.boats.push({ kind, group, curve, length: curve.getLength(), u: rand(), speed, bob: rand() * 6, strokes });
    };
    // Fishing canoes, slow, here and there on both sides of the bridge and in Makoko's channels
    const canoes: Array<Array<[number, number]>> = [
      [[-80, 2540], [-130, 2515], [-170, 2470], [-120, 2455], [-75, 2495]],
      [[-60, 2470], [-110, 2440], [-180, 2430], [-150, 2400], [-80, 2420]],
      [[-260, 2300], [-380, 2200], [-300, 2100], [-200, 2180]],
      [[-120, 1900], [-260, 1800], [-200, 1650], [-90, 1760]],
      [[-350, 1550], [-500, 1450], [-420, 1380], [-300, 1460]],
      [[120, 2450], [260, 2380], [220, 2250], [100, 2320]],
      [[300, 1700], [450, 1650], [420, 1520], [280, 1580]],
      [[-60, 2565], [-90, 2575], [-120, 2560], [-90, 2550]],
    ];
    canoes.forEach((pts, i) => {
      const c = this.canoe([0x78350f, 0x92400e, 0x14532d, 0x1e3a8a][i % 4]);
      add('canoe', c.group, loop(pts), 1.2 + rand() * 0.6, c.strokes);
    });
    // The yellow ferries, between the jetties out of sight up the lagoon
    for (const [i, pts] of ([
      [[160, 1500], [520, 1700], [600, 2200], [300, 2450], [140, 2000]],
      [[-180, 1450], [-600, 1600], [-650, 2100], [-320, 2250], [-150, 1850]],
    ] as Array<Array<[number, number]>>).entries()) {
      const b = new Builder();
      b.box(0xfacc15, 4.2, 1.3, 15, 0, -0.4, 0).box(0x1d4ed8, 4.3, 0.3, 15.1, 0, 0.5, 0).box(0xf8fafc, 3.6, 2.0, 9, 0, 0.9, -1).box(0x0f172a, 3.65, 0.6, 8.6, 0, 1.75, -1).box(0x1d4ed8, 3.8, 0.15, 9.4, 0, 2.9, -1);
      b.box(0xfacc15, 2.2, 1.3, 1.6, 0, -0.4, 8.1, { yaw: 0 }).box(0xdc2626, 0.5, 0.5, 0.5, 0, 3.05, 2.6, { glow: true });
      const ferry = new THREE.Group();
      ferry.add(b.build('ferry'));
      for (const side of [-1, 1]) {
        const sign = signBoard(['LAGFERRY', i === 0 ? 'Ikorodu · CMS · Falomo' : 'Badore · Ijede · Five Cowries'], 5, 0.9, '#1d4ed8', '#facc15');
        sign.position.set(side * 1.84, 1.25, -1);
        sign.rotation.y = side * Math.PI / 2;
        ferry.add(sign);
      }
      add('ferry', ferry, loop(pts), 6.5);
    }
    // Speedboats with their wakes, fast and far out
    for (const pts of [
      [[100, 1350], [700, 1500], [720, 2300], [200, 2550], [60, 1900]],
      [[-90, 1350], [-720, 1450], [-700, 2350], [-260, 2350], [-80, 1800]],
      [[200, 1600], [400, 2000], [250, 2400], [120, 2050]],
    ] as Array<Array<[number, number]>>) {
      const b = new Builder();
      b.box(0xf8fafc, 1.9, 0.6, 6, 0, -0.1, 0).box(0xf8fafc, 1.2, 0.5, 1.4, 0, -0.05, 3.5, { pitch: 0.3 }).box(0xdc2626, 1.95, 0.12, 6, 0, 0.1, 0).box(0x38bdf8, 1.6, 0.5, 0.08, 0, 0.5, 1.2, { pitch: -0.5 });
      const boat = new THREE.Group();
      boat.add(b.build('speedboat'));
      const wake = new THREE.Mesh(new THREE.PlaneGeometry(4, 16), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.45, depthWrite: false }));
      wake.rotation.x = -Math.PI / 2;
      wake.position.set(0, 0.06, -10.5);
      wake.scale.set(1, 1, 1);
      boat.add(wake);
      add('speedboat', boat, loop(pts), 14);
    }
    // A sand barge, low and slow
    {
      const b = new Builder();
      b.box(0x57534e, 6.5, 1.2, 26, 0, -0.6, 0).dome(0xd6b27a, 3.2, 0, 0.5, -3).box(0x3f3f46, 2.4, 2.4, 3, 0, 0.6, 10.5).box(0xf59e0b, 0.3, 0.3, 9, 0, 3.2, 4, { pitch: -0.4 });
      const barge = new THREE.Group();
      barge.add(b.build('sand barge'));
      add('barge', barge, loop([[350, 2350], [550, 2200], [500, 1900], [320, 2050]]), 1.6);
    }
  }

  /** Makoko: houses of plank and zinc on stilts over the water, in rows along its channels */
  private buildMakoko(): void {
    const rand = seeded(1951);
    const b = new Builder();
    const wood = [0x6b4f2a, 0x7c5a33, 0x5c4326, 0x8b6a3e, 0x4a3520];
    const zinc = [0x8a8f94, 0x9a5b3a, 0x7a7f84, 0xa16a4a, 0x6b7280];
    const floorY = WATER + 1.4;
    for (let z = MAKOKO.minZ; z < MAKOKO.maxZ; z += 11) {
      // A channel every few rows is left open for the canoes
      if (Math.round((z - MAKOKO.minZ) / 11) % 4 === 2) continue;
      for (let x = MAKOKO.minX + rand() * 4; x < MAKOKO.maxX; x += 6 + rand() * 4) {
        if (rand() < 0.14) continue;
        if (Math.abs(x - CHURCH.x) < 8 && Math.abs(z - CHURCH.z) < 6) continue;
        const w = 3.4 + rand() * 2.2;
        const d = 3.2 + rand() * 2;
        const h = 2.1 + rand() * 0.6;
        const cz = z + (rand() - 0.5) * 2;
        const yaw = (rand() - 0.5) * 0.25;
        // Stilts down into the water, the platform, the walls, a door and a window
        for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]] as const) b.cylinder(0x3f2a1d, 0.08, floorY - WATER + 0.2, x + sx * (w / 2 - 0.2), WATER - 0.2, cz + sz * (d / 2 - 0.2), { sides: 5 });
        b.box(0x5c4326, w + 0.8, 0.15, d + 0.8, x, floorY, cz, { yaw });
        b.box(wood[Math.floor(rand() * wood.length)], w, h, d, x, floorY + 0.15, cz, { yaw });
        b.box(0x1c1917, 0.8, 1.6, 0.06, x + 0.4, floorY + 0.15, cz + d / 2 + 0.01, { yaw });
        b.box(0x111827, 0.7, 0.5, 0.06, x - w / 4, floorY + 1.2, cz + d / 2 + 0.01, { yaw });
        // A zinc roof, pitched, two sheets
        const roof = zinc[Math.floor(rand() * zinc.length)];
        b.box(roof, w + 0.5, 0.06, d / 2 + 0.5, x, floorY + 0.15 + h + 0.3, cz - d / 4, { yaw, pitch: 0.28 });
        b.box(roof, w + 0.5, 0.06, d / 2 + 0.5, x, floorY + 0.15 + h + 0.3, cz + d / 4, { yaw, pitch: -0.28 });
        // Washing on a line, now and then
        if (rand() < 0.3) for (let i = 0; i < 4; i++) b.box([0xdc2626, 0xfacc15, 0x2563eb, 0x16a34a, 0xf8fafc][(i + Math.floor(x)) % 5], 0.35, 0.5, 0.04, x - w / 2 + 0.5 + i * 0.5, floorY + 1.4, cz + d / 2 + 0.6);
        // A plank walkway to the next house
        if (rand() < 0.45) b.box(0x6b4f2a, 2.6, 0.08, 0.6, x + w / 2 + 1.3, floorY + 0.05, cz);
      }
    }
    // Its church, white with a cross, and the floating market's stalls
    b.box(0x5c4326, 9, 0.2, 7, CHURCH.x, floorY, CHURCH.z).box(0xf8fafc, 8, 3.2, 6, CHURCH.x, floorY + 0.2, CHURCH.z).box(0x9a5b3a, 8.6, 0.08, 3.6, CHURCH.x, floorY + 3.7, CHURCH.z - 1.6, { pitch: 0.3 }).box(0x9a5b3a, 8.6, 0.08, 3.6, CHURCH.x, floorY + 3.7, CHURCH.z + 1.6, { pitch: -0.3 });
    b.box(0x1e3a8a, 0.2, 1.6, 0.2, -120, floorY + 4.3, 2536).box(0x1e3a8a, 0.9, 0.2, 0.2, -120, floorY + 5.2, 2536);
    for (let i = 0; i < 6; i++) b.cylinder(0x3f2a1d, 0.08, 2.0, -122 + (i % 3) * 2, WATER - 0.2, 2533 + Math.floor(i / 3) * 6, { sides: 5 });
    const church = signBoard(['MAKOKO', 'Redeemed Assembly'], 3.6, 0.9, '#1e3a8a', '#ffffff');
    church.position.set(-120, floorY + 2.6, 2539.05);
    this.group.add(church);
    // The floating market: canoes moored together, basins of fish and baskets of produce
    for (let i = 0; i < 5; i++) {
      const c = this.canoe([0x78350f, 0x14532d, 0x92400e, 0x1e3a8a, 0x7c2d12][i], 4.6, false);
      c.group.position.set(MARKET.x - 8 + i * 4, WATER, MARKET.z + 3.6 + (i % 2) * 0.5);
      c.group.rotation.y = Math.PI / 2 + 0.15 * (i - 2);
      const goods = new Builder();
      goods.cylinder([0xd6d3d1, 0x2563eb, 0xdc2626][i % 3], 0.35, 0.18, 0, 0.32, 0.5, { sides: 12 }).dome([0x9a3412, 0xfacc15, 0x16a34a][i % 3], 0.25, 0, 0.4, -0.8);
      c.group.add(goods.build('market goods'));
      this.group.add(c.group);
    }
    this.group.add(b.build('Makoko', { roughness: 0.85 }));
    const sign = signBoard(['MAKOKO', 'Floating market'], 3.2, 0.8, '#7c2d12', '#fde68a');
    sign.position.set(MARKET.x, floorY + 2.2, MARKET.z + 6.4);
    this.group.add(sign);
    // The fish seller in her canoe at the market
    const seller = posed({ gender: 'female', username: '', outfit: 'blue_dress', outfitColor: 0xdb2777, hairstyle: 'gele', skinTone: '#7a4a2a' }, { legs: 'sit', arms: 'palms' }, 0);
    if (seller) {
      const m = new THREE.Mesh(seller, PEOPLE);
      m.position.set(MARKET.x, WATER + 0.05 - 0.17, MARKET.z + 3.4);
      m.rotation.y = Math.PI;
      m.name = 'fish seller';
      this.group.add(m);
    }
  }

  private buildJetty(): void {
    const b = new Builder();
    const [x, z] = JETTY.end;
    // Planks out over the water from the sand, on posts
    b.box(0x6b4f2a, 2.2, 0.15, 18, x, -0.15, z + 7);
    for (let i = 0; i < 5; i++) for (const sx of [-1, 1]) b.cylinder(0x3f2a1d, 0.1, 3.2, x + sx * 1.0, WATER - 0.2, z - 1 + i * 4, { sides: 6 });
    b.box(0x1c1917, 0.08, 1.0, 0.08, x - 1.05, 0, z + 2).box(0x1c1917, 0.08, 1.0, 0.08, x - 1.05, 0, z - 1.5);
    this.group.add(b.build('Makoko jetty'));
    const sign = signBoard(['🛶 CANOE TO MAKOKO', `Floating market · ₦${FARE.toLocaleString()}`], 2.6, 0.8, '#7c2d12', '#fde68a');
    sign.position.set(x - 1.1, 1.5, z + 6);
    sign.rotation.y = Math.PI / 2;
    this.group.add(sign);
    // The canoe that takes passengers, moored at the end, and its boatman
    const c = this.canoe(0x92400e, 5.6, false);
    this.ferryCanoe = c.group;
    this.ferryCanoe.name = 'Makoko canoe';
    this.ferryCanoe.position.set(JETTY.canoe[0], WATER, JETTY.canoe[1]);
    this.group.add(this.ferryCanoe);
    this.boatman = new Figure(this.ferryCanoe, 'makoko-boatman', 'Baba Sunday', { gender: 'male', username: '', outfit: 'casual_tee', outfitColor: 0x166534, trousersColor: 0x1f2937, hairstyle: 'fila', skinTone: '#4a2e1c' }, [0, -1.9], 0, 0.2);
    this.boatman.pose('sit', 'rest');
  }

  // --- The ride ---------------------------------------------------------------------------------

  /** Pays at the jetty, sits in the canoe, and is paddled through Makoko to the market and back */
  private ride(host: PlaceHost): void {
    if (this.riding) {
      host.say('The canoe is out on the water. It will be back soon.', 'info');
      return;
    }
    if (host.director.interrupt(host.actor) === 'locked') return;
    this.build();
    const actor = host.actor;
    const curve = new THREE.CatmullRomCurve3(RIDE.map(([x, z]) => new THREE.Vector3(x, 0, z)), false, 'centripetal');
    const length = curve.getLength();
    const marketU = (() => {
      let best = 0;
      let d = Infinity;
      for (let i = 0; i <= 200; i++) {
        const p = curve.getPointAt(i / 200);
        const dd = p.distanceTo(MARKET);
        if (dd < d) { d = dd; best = i / 200; }
      }
      return best;
    })();
    this.boughtFish = false;
    const speed = 4.2;
    let u = 0;
    let waited = 0;
    let asked = false;
    const boatman = this.boatman!;
    const canoe = this.ferryCanoe;
    const seat = new THREE.Vector3();
    const paddle: Step = {
      name: 'paddled through Makoko',
      begin: () => {
        u = 0;
        waited = 0;
        asked = false;
        this.riding = true;
        const t0 = curve.getTangentAt(0.02);
        host.look(Math.atan2(t0.x, t0.z) + Math.PI, 0.62, 12);
        boatman.pose('sit', 'drum');
        boatman.say('Hold the sides o! We dey go Makoko.', 3);
      },
      tick: (delta) => {
        // At the floating market the canoe waits while the player is asked about fish
        if (!asked && u >= marketU) {
          asked = true;
          boatman.pose('sit', 'rest');
          boatman.say('Mama Ronke get fresh fish today!', 3);
          host.ask({
            who: 'Mama Ronke', role: 'Fish seller, Makoko floating market',
            text: 'Fresh catfish and smoked bonga from the lagoon this morning!',
            choices: [
              { label: 'A bowl of smoked fish', note: `₦${FISH_PRICE.toLocaleString()}`, pick: () => this.buyFish(host) },
              { label: 'No, thank you', pick: () => { waited = 99; } },
            ],
          });
        }
        if (asked && waited < 7 && !this.boughtFish) {
          waited += delta;
          this.place(canoe, curve, u, actor, seat);
          return false;
        }
        if (asked && waited < 99) boatman.pose('sit', 'drum');
        u = Math.min(1, u + (speed * delta) / length);
        this.place(canoe, curve, u, actor, seat);
        return u >= 1;
      },
    };
    const show = new Sequence('canoe ride to Makoko', [actor]);
    show.maxSeconds = 150;
    show.add(
      steps.walk(actor, new THREE.Vector3(JETTY.sand[0], 0, JETTY.sand[1]), { speed: 2.8 }),
      steps.walk(actor, new THREE.Vector3(JETTY.end[0], 0, JETTY.end[1]), { speed: 1.6 }),
      steps.face(actor, new THREE.Vector3(JETTY.canoe[0], 0, JETTY.canoe[1] - 1)),
      // The fare, into the boatman's hand
      steps.animate(actor, { arms: 'reach' }, 1.0, [{
        at: 0.6, run: () => {
          if (!host.backend.pay(FARE, 'Canoe to Makoko', 'TRAVEL_COST')) {
            host.say(`The canoe is ₦${FARE.toLocaleString()}. You do not have it.`, 'warning');
            return false;
          }
          boatman.say('Enter, enter. Sit down well.', 2.5);
          return true;
        },
      }]),
      steps.call('into the canoe', () => {
        actor.pose = { legs: 'sit', arms: 'rest' };
        this.place(canoe, curve, 0, actor, seat);
      }),
      paddle,
      steps.call('back at the jetty', () => {
        boatman.pose('sit', 'rest');
        actor.pose = { legs: 'stand', arms: 'rest' };
        actor.root.position.y = 0;
        actor.setWorldPosition(JETTY.end[0], JETTY.end[1]);
        actor.yaw = 0;
        host.backend.modifyNeed('fun', 25);
        host.backend.modifyNeed('social', 10);
        host.say('🛶 Makoko from the water: houses on stilts, children paddling to school, the smell of smoked fish. Lagos like nowhere else.', 'success');
        boatman.say('Thank you, come again!', 2.5);
        this.rides += 1;
      }),
      steps.walk(actor, new THREE.Vector3(JETTY.sand[0], 0, JETTY.sand[1]), { speed: 1.8 })
    );
    show.onEnd((reason) => {
      this.riding = false;
      actor.root.position.y = 0;
      // Cut short out on the water: put ashore at the jetty, not left standing on the lagoon
      if (reason !== 'done') actor.setWorldPosition(JETTY.end[0], JETTY.end[1]);
      canoe.position.set(JETTY.canoe[0], WATER, JETTY.canoe[1]);
      canoe.rotation.set(0, 0, 0);
      boatman.pose('sit', 'rest');
    });
    host.director.run(show);
  }

  /** The canoe at a point of its way, and the player sitting in its middle, facing forward */
  private place(canoe: THREE.Group, curve: THREE.CatmullRomCurve3, u: number, actor: PlaceHost['actor'], seat: THREE.Vector3): void {
    const p = curve.getPointAt(Math.min(1, u));
    const t = curve.getTangentAt(Math.min(1, u));
    const yaw = Math.atan2(t.x, t.z);
    canoe.position.set(p.x, WATER + Math.sin(this.time * 1.6) * 0.04, p.z);
    canoe.rotation.set(0, yaw, Math.sin(this.time * 1.2) * 0.03);
    seat.set(Math.sin(yaw) * 0.6, 0, Math.cos(yaw) * 0.6).add(canoe.position);
    actor.setWorldPosition(seat.x, seat.z);
    actor.root.position.y = WATER + 0.25;
    actor.yaw = yaw;
  }

  private buyFish(host: PlaceHost): void {
    if (this.boughtFish) return;
    if (!host.backend.pay(FISH_PRICE, 'Smoked fish, Makoko floating market', 'FOOD_PURCHASE')) {
      host.say(`That is ₦${FISH_PRICE.toLocaleString()}.`, 'warning');
      return;
    }
    this.boughtFish = true;
    host.backend.addItem({ id: 'makoko_fish', name: 'Smoked fish from Makoko', icon: '🐟', price: FISH_PRICE, category: 'food', usable: true, description: 'Smoked bonga from the Makoko floating market.', energyRestore: 20 });
    host.say('🐟 Mama Ronke wraps the smoked fish in paper and hands it across, canoe to canoe. Into your bag.', 'success');
  }

  /** For the tests */
  public state(): Record<string, unknown> {
    return {
      built: this.built, visible: this.group.visible, boats: this.boats.length,
      kinds: [...new Set(this.boats.map((b) => b.kind))],
      riding: this.riding, rides: this.rides, fish: this.boughtFish,
      canoe: [+this.ferryCanoe.position.x.toFixed(1), +this.ferryCanoe.position.z.toFixed(1)],
      moving: this.boats.slice(0, 3).map((b) => [+b.group.position.x.toFixed(1), +b.group.position.z.toFixed(1)]),
    };
  }
}
