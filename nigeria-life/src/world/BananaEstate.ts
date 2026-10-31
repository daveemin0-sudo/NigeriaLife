import * as THREE from 'three';
import { Builder, signBoard } from './kit/ArchKit';
import type { Obstruction } from './plan/CityPlan';
import type { InteractiveObject } from './World';
import { PlaceActions } from '../destinations/PlaceActions';

/**
 * Banana Island's estate: the reclaimed land east of Banana Island Road, laid out in closes of
 * villas, each with its wall, gate, palms and often a car in the drive. Every house has an
 * address and an owner; at the gate the player can ring and see if anyone is in, or ask about
 * buying it. Drawn as a handful of instanced meshes, however many houses there are.
 */

const CLOSES = ['Banana Close', 'Ocean Parade', 'Lagoon Crescent', 'Palm Avenue', 'Coral Way', 'Eko Gardens', 'Admiralty Close', 'Bourdillon Court', 'Ruxton Close', 'Lugard Crescent', 'Awolowo Court', 'Ikoyi Gardens', 'Glover Close', 'Osborne Way', 'Gerrard Court'];
const OWNERS = ['Chief Adebayo Ogunleye', 'Dr. Ngozi Eze', 'Alhaji Musa Danjuma', 'Mrs. Funmilayo Adeyemi', 'Engr. Chukwuemeka Obi', 'Barrister Aisha Bello', 'Mr. Tunde Bakare', 'Hon. Ifeoma Nwosu', 'Otunba Segun Alade', 'Madam Bisi Coker', 'Mr. Kelechi Okafor', 'Senator Yemi Ojo', 'Prof. Zainab Lawal', 'Mr. Dayo Fashola', 'Lady Chioma Uche', 'Prince Femi Oyelaran'];
const PAINT = [0xf8fafc, 0xf5f0e6, 0xe7e5e4, 0xfef3c7, 0xe2e8f0, 0xd6d3d1, 0xfafaf9];
const CARS = [0x111827, 0xf8fafc, 0x9ca3af, 0x1e3a8a, 0x7f1d1d];

/** The estate's land and its lanes */
export const ESTATE = { minX: 158, maxX: 318, minZ: -150, maxZ: 150, avenueX: 166, entryZ: 10, cols: 11, plot: 13.5, rows: 15, pitch: 20 };

export class BananaEstate {
  public readonly group = new THREE.Group();
  public readonly obstructions: Obstruction[] = [];
  public readonly interactive: InteractiveObject[] = [];
  public readonly houses: Array<{ id: string; address: string; owner: string; x: number; z: number; home: boolean }> = [];

  constructor() {
    this.group.name = 'Banana Island estate';
    const b = new Builder();
    const E = ESTATE;
    // The land, its lawns, the avenue in from Banana Island Road and the lanes of the closes
    b.box(0x6f9a4c, E.maxX - 160, 0.2, E.maxZ - E.minZ, (E.maxX + 160) / 2, -0.2, 0);
    b.box(0x374151, E.avenueX + 4 - 116, 0.04, 8, (E.avenueX + 4 + 116) / 2, 0.0, E.entryZ);
    b.box(0x374151, 8, 0.04, E.maxZ - E.minZ - 6, E.avenueX, 0.0, 0);
    for (let r = 0; r <= E.rows; r++) {
      const z = E.minZ + 4 + r * E.pitch;
      b.box(0x4b5563, E.maxX - E.avenueX - 4, 0.035, 6, (E.maxX + E.avenueX + 4) / 2, 0.0, z);
      // A kerb on each side of the lane
      for (const s of [-1, 1]) b.box(0xe5e7eb, E.maxX - E.avenueX - 4, 0.12, 0.25, (E.maxX + E.avenueX + 4) / 2, 0.0, z + s * 3.1);
    }
    // The estate's own sign at the avenue
    this.group.add(b.build('Banana Island estate land', { roughness: 0.9 }));
    const sign = signBoard(['BANANA ISLAND', 'Residential Estate · Private'], 9, 2.2, '#14532d', '#fef9c3');
    sign.position.set(E.avenueX - 6, 3.2, E.entryZ + 5);
    sign.rotation.y = -Math.PI / 2;
    this.group.add(sign);

    // The houses: bodies, upper floors, roofs, glass, walls, gates, palms and cars, each kind one instanced mesh
    const count = E.cols * E.rows;
    const box = new THREE.BoxGeometry(1, 1, 1);
    box.translate(0, 0.5, 0);
    const make = (name: string, colour: number, rough = 0.7, geo: THREE.BufferGeometry = box, n = count) => {
      const mesh = new THREE.InstancedMesh(geo, new THREE.MeshStandardMaterial({ color: colour, roughness: rough }), n);
      mesh.name = name;
      mesh.castShadow = false;
      mesh.receiveShadow = true;
      this.group.add(mesh);
      return mesh;
    };
    const bodies = make('estate house', 0xffffff, 0.75);
    const uppers = make('estate upper floor', 0xffffff, 0.75);
    const roofs = make('estate roof', 0x334155, 0.6);
    const glass = make('estate glass', 0x1e3a5f, 0.15);
    const walls = make('estate wall', 0xe7e5e4, 0.85);
    const gates = make('estate gate', 0x111827, 0.4);
    const trunk = new THREE.CylinderGeometry(0.16, 0.22, 1, 6);
    trunk.translate(0, 0.5, 0);
    const crown = new THREE.ConeGeometry(1.8, 1.6, 7);
    const trunks = make('estate palm', 0x8b6b47, 0.9, trunk, count);
    const crowns = make('estate palm leaves', 0x2f7d32, 0.8, crown, count);
    const cars = make('estate car', 0xffffff, 0.3, box, count);
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const v = new THREE.Vector3();
    const sc = new THREE.Vector3();
    const put = (mesh: THREE.InstancedMesh, i: number, x: number, y: number, z: number, w: number, h: number, d: number, colour?: number) => {
      mesh.setMatrixAt(i, m.compose(v.set(x, y, z), q.identity(), sc.set(w, h, d)));
      if (colour !== undefined) mesh.setColorAt(i, new THREE.Color(colour));
    };
    let rnd = 9127;
    const rand = () => ((rnd = (rnd * 1103515245 + 12345) >>> 0) / 4294967296);
    let i = 0;
    let carCount = 0;
    for (let r = 0; r < E.rows; r++) {
      const lane = E.minZ + 4 + r * E.pitch;
      const close = CLOSES[r % CLOSES.length];
      for (let c = 0; c < E.cols; c++, i++) {
        const x = E.avenueX + 8 + c * E.plot + E.plot / 2;
        // The house stands back from its lane, its front to the lane
        const w = 9 + rand() * 1.5;
        const d = 8.5 + rand() * 1.5;
        const z = lane + 5 + d / 2;
        const storeys = rand() < 0.75 ? 2 : 1;
        const paint = PAINT[Math.floor(rand() * PAINT.length)];
        put(bodies, i, x, 0, z, w, 3.4, d, paint);
        put(uppers, i, x + (rand() - 0.5) * 1.5, storeys === 2 ? 3.4 : -5, z + 0.5, w * 0.8, storeys === 2 ? 3.1 : 0.01, d * 0.85, paint);
        put(roofs, i, x, storeys === 2 ? 6.5 : 3.4, z, w + 0.5, 0.3, d + 0.5);
        // A band of dark glass across the front, each floor
        put(glass, i, x, 1.0, z - d / 2 - 0.02, w * 0.7, storeys === 2 ? 4.9 : 1.8, 0.06);
        // The wall round the front and the gate in it
        put(walls, i, x, 0, lane + 3.3, E.plot - 0.6, 1.9, 0.25);
        put(gates, i, x - 1.5, 0, lane + 3.32, 3.2, 1.8, 0.12);
        // A palm in the corner of the front garden
        const palmX = x + w / 2 - 0.6;
        const palmH = 4.5 + rand() * 2;
        put(trunks, i, palmX, 0, lane + 4.4, 1, palmH, 1);
        put(crowns, i, palmX, palmH + 0.3, lane + 4.4, 1, 1, 1);
        // A car in the drive, most of the time
        if (rand() < 0.6) put(cars, carCount++, x - 1.5, 0.22, lane + 5.6, 1.85, 1.3, 4.4, CARS[Math.floor(rand() * CARS.length)]);
        this.obstructions.push({ owner: `Banana Island house ${i + 1}`, structure: true, height: storeys === 2 ? 6.8 : 3.7, minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2 });
        this.obstructions.push({ owner: `Banana Island wall ${i + 1}`, structure: false, height: 1.9, minX: x - E.plot / 2 + 0.3, maxX: x - 3.2, minZ: lane + 3.2, maxZ: lane + 3.45 });
        this.obstructions.push({ owner: `Banana Island wall ${i + 1}b`, structure: false, height: 1.9, minX: x + 0.2, maxX: x + E.plot / 2 - 0.3, minZ: lane + 3.2, maxZ: lane + 3.45 });
        const number = c + 1 + Math.floor(r / CLOSES.length) * E.cols;
        const owner = OWNERS[(i * 7 + r) % OWNERS.length];
        const id = `estate-house-${i}`;
        const home = rand() < 0.45;
        this.houses.push({ id, address: `${number} ${close}`, owner, x, z, home });
        const marker = new THREE.Object3D();
        marker.position.set(x - 1.5, 1, lane + 3.3);
        this.group.add(marker);
        this.interactive.push({ mesh: marker, id, name: `${number} ${close}`, category: 'Banana Island · a home', description: `The home of ${owner}.`, interactionPoint: new THREE.Vector3(x - 1.5, 0, lane + 1.8) });
        PlaceActions.register(id, { label: () => `🏡 ${number} ${close} · ${owner}`, run: (host) => this.ring(i, host) });
      }
    }
    for (const mesh of [bodies, uppers, roofs, glass, walls, gates, trunks, crowns]) {
      mesh.count = count;
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    }
    cars.count = carCount;
    cars.instanceMatrix.needsUpdate = true;
    if (cars.instanceColor) cars.instanceColor.needsUpdate = true;
  }

  /** At the gate: ring and see who is in, or ask about the house */
  private ring(index: number, host: import('../destinations/PlaceActions').PlaceHost): void {
    const house = this.houses[index];
    const hour = host.hour();
    const late = hour >= 22 || hour < 6;
    host.ask({
      who: house.address,
      role: `Banana Island · ${house.owner}`,
      text: 'A high white wall, a black gate, a camera over it, the sound of a generator behind.',
      choices: [
        {
          label: '🔔 Ring at the gate',
          pick: () => {
            const done = host.director.perform({ id: `ring ${house.id}`, actor: host.actor, animation: { arms: 'reach' }, seconds: 1.4, effectAt: 0.5, effect: () => {
              if (late) host.say(`The gateman speaks through the grille: "${house.owner.split(' ').slice(-1)[0]} family don sleep. Come back tomorrow."`, 'info');
              else if (house.home) {
                host.backend.modifyNeed('social', 15);
                host.say(`The gateman lets you in. ${house.owner} comes out to the porch: "Welcome! Sit, have a malt." Social +15.`, 'success');
              } else host.say(`The gateman: "Oga no dey house. ${house.owner} travelled to London. Leave a message?"`, 'info');
            } });
            if (!done.ok && done.reason) host.say(done.reason, 'info');
          },
        },
        { label: '🏷️ Ask if it is for sale', pick: () => host.say(`"This house no be for sale." Houses on Banana Island change hands for ₦1.5 to ₦4 billion. Look in the Land app for plots to build your own.`, 'info') },
        { label: 'Walk on', pick: () => undefined },
      ],
    });
  }
}
