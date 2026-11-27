import * as THREE from 'three';
import { Kit, M, contactShade, floorPlane, signMesh } from './TerminalKit';
import { LIVERIES, buildAirliner, type AirlinerHandle } from './Airliner';

/**
 * The airside of the airport seen through the terminal's glass: the working apron of a busy
 * Nigerian airport. A 737 boarding at Gate 1 up the stairs truck, its belt loader filling the hold
 * and the pushback tug waiting at the nose; the apron bus for Gate 2; a CRJ just in, its airstair
 * down and the passengers walking across to arrivals; an A320-size jet being turned round, with
 * the catering truck lifted to its door and the fuel bowser under its wing; further out, aircraft
 * on the remote stands, a turboprop taxiing out with its propellers turning, a baggage train
 * running along the service road, and every so often a jet taking off from the runway.
 *
 * Everything is in the hall's coordinates (the glass at z = -20.1, the apron running away to -z).
 */
export type ApronPoint = [number, number];

/** How far out (z) the service road, the remote stands, the taxiway and the runway are */
const ROAD = -66;
const REMOTE = -92;
const TAXIWAY = -122;
const RUNWAY = -170;

export const APRON = {
  plane1: { x: 0, noseZ: -25 },
  gate1Stairs: { foot: [6.2, -29.4] as ApronPoint, top: [2.5, -29.4] as ApronPoint, rise: 2.4 },
  bus: { x: 19, z: -24.6 },
  busDoor: { foot: [17.4, -23.1] as ApronPoint, top: [17.4, -23.8] as ApronPoint, rise: 0.35 },
  plane2: { x: 33, noseZ: -24.5 },
  arrivalsStairs: { foot: [36.6, -28.1] as ApronPoint, top: [34.75, -28.1] as ApronPoint, rise: 1.7 },
  plane3: { x: -40, noseZ: -25 },
};

/** Ground crew on the apron: where each stands, which way they face, and where they pace to */
export const APRON_CREW: Array<{ x: number; z: number; yaw: number; to?: ApronPoint; talk?: boolean }> = [
  { x: 6.9, z: -28.6, yaw: Math.PI / 2 }, // at the foot of the stairs, checking boarding passes
  { x: -3.6, z: -32.6, yaw: -Math.PI / 2, talk: true }, // two loading bags at the belt loader
  { x: -4.4, z: -31.6, yaw: Math.PI / 2, talk: true },
  { x: 1.6, z: -22.4, yaw: Math.PI }, // by the pushback tug at the nose
  { x: 33.0, z: -21.3, yaw: Math.PI }, // marshaller in front of the CRJ
  { x: 30.5, z: -27, yaw: 0, to: [30.5, -36] }, // walking round the CRJ
  { x: -45.4, z: -38.4, yaw: Math.PI / 2, talk: true }, // at the fuel bowser
  { x: -44.6, z: -39.2, yaw: -Math.PI / 2, talk: true },
  { x: -45.2, z: -56.5, yaw: -Math.PI / 2 }, // at the catering truck
  { x: -12, z: -24, yaw: Math.PI / 2, to: [12, -24] }, // walking along the front of the stands
  { x: 21.5, z: -23.0, yaw: Math.PI }, // the bus driver's mate at the door
];

const mat = (color: number, roughness = 0.5, metalness = 0.1, name = '') => new THREE.MeshStandardMaterial({ color, roughness, metalness, name });
const G = {
  yellow: mat(0xf2b705, 0.45, 0.1, 'gse yellow'),
  white: mat(0xf1f3f5, 0.4, 0.1, 'gse white'),
  orange: mat(0xea580c, 0.7, 0, 'cart curtains'),
  blue: mat(0x1e3a8a, 0.7, 0, 'cart curtains blue'),
  tyre: mat(0x121315, 0.9, 0, 'tyres'),
  glass: mat(0x1c2733, 0.15, 0.6, 'cab glass'),
  steel: mat(0x9aa3ad, 0.35, 0.7, 'steel'),
  green: mat(0x0f7a46, 0.45, 0.1, 'bus green'),
  silver: mat(0xc7ccd1, 0.25, 0.85, 'tanker'),
  cone: mat(0xff5a1f, 0.6, 0, 'cones'),
  grass: mat(0x6f8a3c, 1, 0, 'grass'),
  runway: mat(0x3a3d41, 0.95, 0, 'runway'),
  glassFar: mat(0x7d8a97, 0.4, 0.3, 'far windows'),
  stain: new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.12, depthWrite: false, name: 'stains' }),
  joint: new THREE.MeshBasicMaterial({ color: 0x55585c, name: 'slab joints' }),
  paintW: new THREE.MeshBasicMaterial({ color: 0xe9ecef, name: 'paint white' }),
  paintY: new THREE.MeshBasicMaterial({ color: 0xf2c200, name: 'paint yellow' }),
  paintR: new THREE.MeshBasicMaterial({ color: 0xc81e1e, name: 'paint red' }),
};

/** Wheels on an axle across a vehicle (local z), at x along it */
function wheels(k: Kit, x: number, z: number, yaw: number, at: Array<[number, number]>, r = 0.4): void {
  const c = Math.cos(yaw), s = Math.sin(yaw);
  for (const [ax, az] of at) {
    const g = new THREE.CylinderGeometry(r, r, 0.3, 14);
    g.rotateX(Math.PI / 2);
    k.geo(G.tyre, g, x + ax * c + az * s, r, z - ax * s + az * c, yaw);
  }
}

/** A box on a vehicle, in its own frame (x along it, z across), turned with it */
function part(k: Kit, m: THREE.Material, w: number, h: number, d: number, x: number, y: number, z: number, vx: number, vz: number, yaw: number, pitch = 0): void {
  const c = Math.cos(yaw), s = Math.sin(yaw);
  k.box(m, w, h, d, x + vx * c + vz * s, y, z - vx * s + vz * c, yaw, 0, pitch);
}

export class ApronLife {
  public readonly group = new THREE.Group();
  private readonly beacons: THREE.Mesh[] = [];
  private readonly props: THREE.Object3D[] = [];
  private clock = 0;
  private readonly train: THREE.Group[] = [];
  private trainRun = 0;
  private readonly taxiing: AirlinerHandle;
  private readonly departing: AirlinerHandle;
  private readonly followMe: THREE.Group;

  constructor() {
    this.group.name = 'apron view';
    this.buildGround();
    this.buildStands();
    // A turboprop taxiing out along the taxiway, a jet on the runway, a baggage train on the service road
    this.taxiing = buildAirliner('atr', LIVERIES.delta);
    this.group.add(this.taxiing.group);
    this.props.push(...this.taxiing.props);
    this.beacons.push(...this.taxiing.beacons);
    this.departing = buildAirliner('737', LIVERIES.arewa);
    this.group.add(this.departing.group);
    this.beacons.push(...this.departing.beacons);
    this.followMe = this.car();
    this.group.add(this.followMe);
    for (let i = 0; i < 4; i++) {
      const unit = i === 0 ? this.tug() : this.cart(i);
      this.train.push(unit);
      this.group.add(unit);
    }
    this.update(0);
  }

  // --- Ground: the apron slab, its markings, the taxiway, grass, the runway, the far city -----------

  private buildGround(): void {
    const apron = new THREE.Mesh(floorPlane(320, 116, 8), M.apron);
    apron.position.set(0, -0.03, -20 - 58);
    apron.receiveShadow = true;
    this.group.add(apron);
    const grass = new THREE.Mesh(new THREE.PlaneGeometry(620, 160).rotateX(-Math.PI / 2), G.grass);
    grass.position.set(0, -0.06, -136 - 80);
    this.group.add(grass);
    const k = new Kit();
    // The taxiway (darker, with its yellow centre line), the runway with its white marks
    k.box(G.runway, 620, 0.01, 23, 0, -0.04, TAXIWAY);
    k.box(G.paintY, 620, 0.012, 0.3, 0, -0.035, TAXIWAY);
    k.box(G.runway, 620, 0.01, 45, 0, -0.05, RUNWAY);
    for (let x = -300; x < 300; x += 50) k.box(G.paintW, 30, 0.012, 0.9, x, -0.045, RUNWAY);
    for (const z of [RUNWAY + 21, RUNWAY - 21]) k.box(G.paintW, 620, 0.012, 0.9, 0, -0.045, z);
    // Edge lights along the runway
    for (let x = -300; x < 300; x += 30) for (const z of [RUNWAY + 23.5, RUNWAY - 23.5]) k.box(M.lamp, 0.3, 0.3, 0.3, x, 0, z);
    // Stand markings: lead-in lines to each nose, stop bars, the red line equipment must keep behind
    for (const sx of [APRON.plane1.x, APRON.plane2.x, APRON.plane3.x]) {
      k.box(G.paintY, 0.3, 0.012, 46, sx, -0.02, -48);
      k.box(G.paintY, 5, 0.012, 0.35, sx, -0.02, -24.2);
      k.box(G.paintR, 0.25, 0.012, 40, sx - 19, -0.02, -44);
      k.box(G.paintR, 0.25, 0.012, 40, sx + 19, -0.02, -44);
    }
    k.box(G.paintR, 320, 0.012, 0.3, 0, -0.02, -21.6);
    // The concrete is laid in slabs: their joints, and the oil and rubber stains where aircraft stand
    for (let x = -150; x <= 150; x += 7.5) k.box(G.joint, 0.06, 0.008, 112, x, -0.025, -78);
    for (let z = -27.5; z > -134; z -= 7.5) k.box(G.joint, 300, 0.008, 0.06, 0, -0.025, z);
    for (const sx of [APRON.plane1.x, APRON.plane2.x, APRON.plane3.x]) {
      for (const [dx, dz, w] of [[0, -30, 1.8], [2.6, -43, 2.4], [-2.6, -43, 2.4], [0, -36, 1.2]]) {
        k.geo(G.stain, new THREE.CircleGeometry(w, 16).rotateX(-Math.PI / 2), sx + dx, -0.018, dz);
      }
    }
    // The service road behind the stands, white dashes either side
    for (const z of [ROAD - 1.8, ROAD - 7.8]) for (let x = -150; x < 150; x += 6) k.box(G.paintW, 3, 0.012, 0.2, x, -0.02, z);
    // Remote stand lines
    for (const sx of [-14, 32]) k.box(G.paintY, 40, 0.012, 0.3, sx, -0.02, REMOTE);
    this.group.add(k.build('apron markings'));
    // Floodlight masts
    for (const mx of [-60, -18, 22, 62]) {
      const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.4, 24, 10), M.steel);
      mast.position.set(mx, 12, -62);
      const head = new THREE.Mesh(new THREE.BoxGeometry(3.6, 1.4, 0.8), new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xfff4d6, emissiveIntensity: 0.6 }));
      head.position.set(mx, 24.4, -62);
      this.group.add(mast, head);
    }
    // The control tower and the far side of the field: hangars, trees, the city beyond
    const far = new Kit();
    far.cyl(M.plaster, 2.2, 3.2, 34, 70, 0, -212, 16);
    far.cyl(M.glass, 6.2, 5.2, 4.2, 70, 34, -212, 16);
    far.cyl(M.metalDark, 6.8, 6.8, 1.2, 70, 38.2, -212, 16);
    for (const [hx, hw] of [[-80, 60], [-10, 46]] as const) {
      far.box(M.plaster, hw, 16, 30, hx, 0, -226);
      // A curved roof along the hangar
      const roof = new THREE.CylinderGeometry(15, 15, hw, 20, 1, false, 0, Math.PI);
      roof.rotateZ(Math.PI / 2);
      roof.scale(1, 0.35, 1);
      far.geo(M.metal, roof, hx, 16, -226);
    }
    for (let x = -300; x < 300; x += 8) {
      const h = 6 + ((x * 7919) % 5 + 5) % 5;
      far.geo(M.leaf, new THREE.SphereGeometry(4.5, 7, 5).scale(1, h / 9, 1), x, h / 2, -246 - (((x * 31) % 7) + 7) % 7);
    }
    // The city beyond the fence, in the haze: blocks of offices and flats in soft, dusty tones
    const haze = [mat(0xb9c3cc, 1, 0, 'haze 1'), mat(0xc9c2b6, 1, 0, 'haze 2'), mat(0xa9b4bf, 1, 0, 'haze 3')];
    for (let x = -300; x < 300; x += 17) {
      const h = 12 + ((x * 131) % 34 + 34) % 34;
      const i = Math.abs(x * 7) % 3;
      far.box(haze[i], 11 + (Math.abs(x) % 7), h, 10, x, 0, -268 - (((x * 17) % 12) + 12) % 12);
      // Rows of windows, a shade darker
      for (let y = 3; y < h - 2; y += 3.2) far.box(G.glassFar, 9 + (Math.abs(x) % 7), 1.1, 0.2, x, y, -262.9 - (((x * 17) % 12) + 12) % 12);
    }
    this.group.add(far.build('far side'));
  }

  // --- The stands ----------------------------------------------------------------------------------

  private plane(type: '737' | 'crj' | 'atr', livery: keyof typeof LIVERIES, x: number, noseZ: number, opts: { airstair?: boolean; yaw?: number } = {}): AirlinerHandle {
    const h = buildAirliner(type, LIVERIES[livery], { airstair: opts.airstair });
    const yaw = opts.yaw ?? -Math.PI / 2;
    h.group.rotation.y = yaw;
    // Placed by the nose: the nose is half a length ahead of the middle along the heading
    const fx = Math.cos(yaw), fz = -Math.sin(yaw);
    h.group.position.set(x - fx * h.spec.length / 2, 0, noseZ - fz * h.spec.length / 2);
    this.group.add(h.group);
    this.beacons.push(...h.beacons);
    this.props.push(...h.props);
    const shade = contactShade(h.spec.span * 1.6, h.spec.length * 0.95, h.group.position.x, h.group.position.z, 0.35, yaw + Math.PI / 2);
    this.group.add(shade);
    return h;
  }

  private buildStands(): void {
    const k = new Kit();
    const p1 = this.plane('737', 'nigerialife', APRON.plane1.x, APRON.plane1.noseZ);
    this.plane('crj', 'nigerialife2', APRON.plane2.x, APRON.plane2.noseZ, { airstair: true });
    this.plane('737', 'eko', APRON.plane3.x, APRON.plane3.noseZ);
    // Remote stands: side-on to the terminal, so their whole shape shows
    this.plane('atr', 'arewa', -28, REMOTE, { yaw: Math.PI });
    this.plane('737', 'delta', 52, REMOTE - 2, { yaw: 0 });

    // Gate 1: the stairs truck at the front door, the belt loader at the hold, a baggage train, the tug
    const st = APRON.gate1Stairs;
    this.stairsTruck(k, st.top[0], st.top[1], st.rise, st.foot[0] - st.top[0]);
    this.beltLoader(k, -4.4, -33.6, 1.9);
    this.parkedTrain(k, -9.5, -43, Math.PI / 2);
    this.pushback(k, APRON.plane1.x, -22.85);
    this.gpu(k, 3.4, -23.6);
    // Gate 2: the apron bus
    this.bus(k, APRON.bus.x, APRON.bus.z);
    // The CRJ: a baggage train come out to meet it
    this.parkedTrain(k, 28.4, -38, Math.PI / 2, 2);
    // Stand 3: catering at the rear service door, the fuel bowser ahead of the wing, a belt loader at the hold
    this.cateringTruck(k, -42.9, -59.5, 2.4);
    this.fuelTruck(k, -50.5, -36.5);
    this.beltLoader(k, -44.4, -34, 1.9);
    // Cones at the wingtips, engines and nose of each stand
    for (const sx of [APRON.plane1.x, APRON.plane2.x, APRON.plane3.x]) {
      for (const [cx, cz] of [[-17.5, -46], [17.5, -46], [-5, -33], [5, -33], [0, -66]]) {
        k.cyl(G.cone, 0.03, 0.2, 0.7, sx + cx * (sx === APRON.plane2.x ? 0.75 : 1), 0, cz, 10);
        k.box(G.paintW, 0.3, 0.06, 0.3, sx + cx * (sx === APRON.plane2.x ? 0.75 : 1), 0.38, cz);
      }
    }
    // Chocks at the nose wheels
    for (const [sx, gz] of [[APRON.plane1.x, -29.6], [APRON.plane2.x, -27.7], [APRON.plane3.x, -29.6]]) for (const dz of [-0.5, 0.5]) k.box(G.yellow, 0.25, 0.25, 0.5, sx + dz * 1.0, 0, gz);
    this.group.add(k.build('ground equipment'));
    void p1;
    // Stand numbers painted large at the nose, readable from the gates
    [[APRON.plane1.x, 'A1'], [APRON.plane2.x, 'A2'], [APRON.plane3.x, 'A3']].forEach(([x, label]) => {
      const sign = signMesh([label as string], 3.2, 1.6, { bg: '#f2c200', fg: '#16181c', density: 120 });
      sign.rotation.x = -Math.PI / 2;
      sign.position.set((x as number) - 6, -0.01, -23.2);
      this.group.add(sign);
    });
  }

  /** Passenger stairs on a truck, the top platform at the aircraft door, the foot run out toward +x */
  private stairsTruck(k: Kit, x: number, z: number, rise: number, run: number): void {
    const steps = Math.round(rise / 0.19);
    for (let i = 0; i < steps; i++) {
      const t = (i + 1) / steps;
      k.box(M.metalDark, 0.3, 0.05, 1.15, x + run * (1 - t) + 0.1, rise * t - 0.05, z);
    }
    const len = Math.hypot(run, rise);
    const pitch = Math.atan2(rise, run);
    for (const side of [-0.62, 0.62]) {
      const panel = new THREE.BoxGeometry(len, 0.5, 0.05);
      panel.rotateZ(-pitch);
      k.geo(G.white, panel, x + run / 2 + 0.1, rise / 2 + 0.15, z + side);
      const rail = new THREE.BoxGeometry(len, 0.05, 0.06);
      rail.rotateZ(-pitch);
      k.geo(G.steel, rail, x + run / 2 + 0.1, rise / 2 + 1.0, z + side);
    }
    // The platform at the top, with its canopy
    k.box(M.metalDark, 1.3, 0.08, 1.4, x - 0.3, rise - 0.05, z);
    for (const [px, pz] of [[-0.9, -0.65], [-0.9, 0.65], [0.3, -0.65], [0.3, 0.65]]) k.box(G.steel, 0.06, 2.1, 0.06, x + px, rise, z + pz);
    k.box(G.white, 1.5, 0.08, 1.5, x - 0.3, rise + 2.1, z);
    // The truck under it: a long chassis and the driver's cab beside the foot
    k.box(G.white, run + 1.6, 0.6, 1.7, x + run / 2 - 0.2, 0.45, z);
    k.box(G.yellow, 1.8, 1.5, 1.6, x + run - 0.2, 0.45, z + 1.75);
    k.box(G.glass, 1.0, 0.6, 1.62, x + run + 0.25, 1.2, z + 1.75);
    wheels(k, x + run / 2, z, 0, [[-run / 2 + 0.2, -0.85], [-run / 2 + 0.2, 0.85], [run / 2 - 0.2, -0.85], [run / 2 - 0.2, 0.85]], 0.38);
  }

  /** A belt loader: a small chassis with a conveyor rising toward +x, to the aircraft's hold door at `rise` */
  private beltLoader(k: Kit, x: number, z: number, rise: number): void {
    const len = 6.2;
    const low = 0.7;
    const pitch = Math.atan2(rise - low, len);
    const belt = new THREE.BoxGeometry(len, 0.12, 0.9);
    belt.rotateZ(pitch);
    k.geo(M.rubber, belt, x, (rise + low) / 2, z);
    for (const side of [-0.5, 0.5]) {
      const rail = new THREE.BoxGeometry(len, 0.3, 0.06);
      rail.rotateZ(pitch);
      k.geo(G.yellow, rail, x, (rise + low) / 2 + 0.15, z + side);
    }
    k.box(G.yellow, len * 0.8, 0.45, 1.5, x - 0.3, 0.3, z);
    k.box(G.yellow, 1.1, 1.0, 1.2, x - 1.4, 0.75, z + 1.1);
    k.box(G.glass, 0.8, 0.5, 1.22, x - 1.4, 1.25, z + 1.1);
    wheels(k, x, z, 0, [[-2, -0.7], [-2, 0.7], [2, -0.7], [2, 0.7]], 0.3);
  }

  /** A baggage tug and its carts parked in a line, heading `yaw` */
  private parkedTrain(k: Kit, x: number, z: number, yaw: number, carts = 3): void {
    const fx = Math.cos(yaw), fz = -Math.sin(yaw);
    this.tugInto(k, x, z, yaw);
    for (let i = 1; i <= carts; i++) this.cartInto(k, x - fx * i * 3.4, z - fz * i * 3.4, yaw, i);
  }

  private tugInto(k: Kit, x: number, z: number, yaw: number): void {
    part(k, G.yellow, 2.6, 0.9, 1.5, x, 0.3, z, 0, 0, yaw);
    part(k, G.yellow, 1.0, 1.0, 1.4, x, 1.2, z, -0.5, 0, yaw);
    part(k, G.glass, 0.05, 0.6, 1.3, x, 1.4, z, 0.0, 0, yaw);
    part(k, M.black, 1.2, 0.08, 1.5, x, 2.2, z, -0.5, 0, yaw);
    wheels(k, x, z, yaw, [[-0.8, -0.7], [-0.8, 0.7], [0.8, -0.7], [0.8, 0.7]], 0.32);
  }

  private cartInto(k: Kit, x: number, z: number, yaw: number, i: number): void {
    part(k, M.metalDark, 2.8, 0.12, 1.5, x, 0.42, z, 0, 0, yaw);
    part(k, i % 2 ? G.orange : G.blue, 2.8, 1.3, 0.05, x, 0.55, z, 0, -0.74, yaw);
    part(k, i % 2 ? G.orange : G.blue, 2.8, 1.3, 0.05, x, 0.55, z, 0, 0.74, yaw);
    part(k, M.metalDark, 2.9, 0.06, 1.6, x, 1.9, z, 0, 0, yaw);
    for (const [vx, h, c] of [[-0.8, 0.45, 0x1e3a8a], [0, 0.35, 0xb3261e], [0.8, 0.5, 0x334155]] as const) {
      part(k, mat(c, 0.6), 0.6, h, 0.45, x, 0.54, z, vx, 0, yaw);
    }
    wheels(k, x, z, yaw, [[-1, -0.7], [-1, 0.7], [1, -0.7], [1, 0.7]], 0.22);
  }

  /** A pushback tug at the nose with its tow bar */
  private pushback(k: Kit, x: number, z: number): void {
    // A low, heavy body (it has to push 70 tonnes), black bumpers front and back
    k.soft(G.yellow, 2.5, 0.75, 4.6, x, 0.35, z, 0.18);
    k.box(M.black, 2.6, 0.3, 0.25, x, 0.3, z - 2.35);
    k.box(M.black, 2.6, 0.3, 0.25, x, 0.3, z + 2.35);
    // The driver's cab, sunk into one side: open frame, roof, glass, an orange beacon on top
    k.box(M.black, 1.0, 0.06, 1.3, x + 0.6, 1.95, z + 1.0);
    for (const [px, pz] of [[0.15, 0.4], [1.05, 0.4], [0.15, 1.6], [1.05, 1.6]]) k.box(M.black, 0.06, 0.85, 0.06, x + px, 1.1, z + pz);
    k.box(G.glass, 0.9, 0.6, 0.03, x + 0.6, 1.25, z + 0.38);
    k.cyl(G.cone, 0.09, 0.09, 0.14, x + 0.6, 2.0, z + 1.0, 10);
    // The tow bar out to the nose wheel
    k.box(G.steel, 0.14, 0.14, 4.2, x, 0.45, z - 4.45);
    wheels(k, x, z, Math.PI / 2, [[-1.6, -1.2], [-1.6, 1.2], [1.6, -1.2], [1.6, 1.2]], 0.45);
  }

  /** A ground power unit with its cable to the aircraft */
  private gpu(k: Kit, x: number, z: number): void {
    k.soft(G.white, 1.3, 1.1, 2.1, x, 0.35, z, 0.08);
    // Cooling grilles down both sides, the control panel, the tow handle and the cable to the aircraft
    for (let i = 0; i < 6; i++) for (const s2 of [-0.66, 0.66]) k.box(M.black, 0.02, 0.6, 0.06, x + s2, 0.55, z - 0.6 + i * 0.2);
    k.box(M.screen, 0.5, 0.35, 0.03, x, 0.9, z + 1.06);
    k.box(M.black, 0.08, 0.08, 1.2, x, 0.5, z + 1.6);
    k.box(M.black, 0.06, 0.06, 5, x - 1.5, 0.03, z - 3, 0.4);
    wheels(k, x, z, Math.PI / 2, [[-0.8, -0.7], [-0.8, 0.7], [0.8, -0.7], [0.8, 0.7]], 0.22);
  }

  /** The apron bus, side-on to the glass, its doors open toward the terminal (+z) */
  private bus(k: Kit, x: number, z: number): void {
    const len = 12, wid = 2.7, hgt = 3.0;
    k.box(G.white, len, hgt - 0.35, wid, x, 0.35, z);
    k.box(G.white, len - 0.2, 0.12, wid - 0.2, x, hgt, z);
    // A long band of tinted windows along both sides, the windscreens at the ends
    for (const side of [-1, 1]) {
      for (let i = 0; i < 6; i++) k.box(G.glass, 1.55, 1.3, 0.04, x - len / 2 + 1.2 + i * 1.75, 1.35, z + side * (wid / 2 + 0.01));
      k.box(G.green, len, 0.32, 0.04, x, 0.8, z + side * (wid / 2 + 0.015));
    }
    for (const end of [-1, 1]) k.box(G.glass, 0.04, 1.7, wid - 0.3, x + end * (len / 2 + 0.01), 1.05, z);
    // The double doors toward the terminal, open
    for (const dx of [-1.6, 3.6]) k.box(M.black, 1.5, 2.45, 0.06, x + dx, 0.3, z + wid / 2 + 0.02);
    k.box(M.black, len + 0.02, 0.25, wid + 0.02, x, 0.2, z);
    wheels(k, x, z, 0, [[-4.3, -1.25], [-4.3, 1.25], [4.3, -1.25], [4.3, 1.25]], 0.5);
    const sign = signMesh(['NigeriaLife Air · Gate 2'], 3.4, 0.4, { bg: '#0f7a46', fg: '#ffffff', density: 160 });
    sign.position.set(x, 2.55, z + wid / 2 + 0.03);
    this.group.add(sign);
  }

  /** The catering truck: cab and a box body raised on its scissor lift to the door */
  private cateringTruck(k: Kit, x: number, z: number, sill: number): void {
    k.box(G.white, 2.4, 1.8, 2.4, x, 0.4, z + 3.4);
    k.box(G.glass, 2.3, 0.7, 0.05, x, 1.3, z + 4.62);
    k.box(M.metalDark, 2.4, 0.5, 6.2, x, 0.35, z);
    for (const s of [-1, 1]) {
      const bar = new THREE.BoxGeometry(0.1, Math.hypot(sill - 0.9, 4), 0.1);
      bar.rotateX(s * Math.atan2(4, sill - 0.9));
      k.geo(G.steel, bar, x - 1.0, 0.85 + (sill - 0.9) / 2, z - 0.3);
      k.geo(G.steel, bar.clone(), x + 1.0, 0.85 + (sill - 0.9) / 2, z - 0.3);
    }
    k.box(G.white, 2.5, 2.5, 5.0, x, sill - 0.1, z - 0.4);
    k.box(G.green, 2.52, 0.4, 5.02, x, sill + 1.6, z - 0.4);
    wheels(k, x, z, Math.PI / 2, [[-2.4, -1.1], [-2.4, 1.1], [3.2, -1.1], [3.2, 1.1]], 0.45);
  }

  /** A fuel bowser under the wing, its hose up to the refuelling point */
  private fuelTruck(k: Kit, x: number, z: number): void {
    k.box(G.white, 2.5, 2.0, 2.4, x + 4.2, 0.45, z);
    k.box(G.glass, 0.05, 0.75, 2.3, x + 5.45, 1.5, z);
    const tank = new THREE.CylinderGeometry(1.25, 1.25, 7.0, 20);
    tank.rotateZ(Math.PI / 2);
    k.geo(G.silver, tank, x - 0.4, 1.9, z);
    k.box(M.metalDark, 9.6, 0.5, 2.2, x + 0.4, 0.4, z);
    k.box(G.yellow, 7.0, 0.25, 0.05, x - 0.4, 1.9, z + 1.26);
    k.box(M.black, 0.08, 0.08, 4.5, x - 2.5, 2.6, z + 2.4, 0, 0.5);
    wheels(k, x, z, 0, [[-3.0, -1.1], [-3.0, 1.1], [-1.6, -1.1], [-1.6, 1.1], [4.0, -1.1], [4.0, 1.1]], 0.5);
  }

  // --- Moving vehicles -------------------------------------------------------------------------------

  private tug(): THREE.Group {
    const k = new Kit();
    this.tugInto(k, 0, 0, 0);
    return k.build('moving tug');
  }

  private cart(i: number): THREE.Group {
    const k = new Kit();
    this.cartInto(k, 0, 0, 0, i);
    return k.build('moving cart');
  }

  private car(): THREE.Group {
    const k = new Kit();
    k.soft(G.yellow, 4.2, 1.0, 1.8, 0, 0.35, 0, 0.2);
    k.box(G.glass, 2.2, 0.55, 1.7, -0.3, 1.3, 0);
    k.box(G.yellow, 2.2, 0.06, 1.72, -0.3, 1.85, 0);
    wheels(k, 0, 0, 0, [[-1.3, -0.85], [-1.3, 0.85], [1.3, -0.85], [1.3, 0.85]], 0.32);
    const g = k.build('follow me car');
    const sign = signMesh(['FOLLOW ME'], 1.6, 0.45, { bg: '#16181c', fg: '#f2c200', density: 160 });
    sign.position.set(-0.3, 2.15, 0);
    sign.rotation.y = Math.PI / 2;
    const back = sign.clone();
    back.rotation.y = -Math.PI / 2;
    g.add(sign, back);
    return g;
  }

  /** A point on the service road loop (two straights joined at the ends), and the heading there */
  private roadAt(s: number): { x: number; z: number; yaw: number } {
    const half = 140;
    const r = 3;
    const straight = half * 2;
    const total = 2 * straight + 2 * Math.PI * r;
    const mid = ROAD - 4.8;
    let d = ((s % total) + total) % total;
    if (d < straight) return { x: -half + d, z: mid + r, yaw: 0 };
    d -= straight;
    if (d < Math.PI * r) {
      const a = d / r;
      return { x: half + Math.sin(a) * r, z: mid + Math.cos(a) * r, yaw: a };
    }
    d -= Math.PI * r;
    if (d < straight) return { x: half - d, z: mid - r, yaw: Math.PI };
    d -= straight;
    const a = d / r;
    return { x: -half - Math.sin(a) * r, z: mid - Math.cos(a) * r, yaw: Math.PI + a };
  }

  public update(delta: number): void {
    this.clock += delta;
    // Beacons flash; propellers on the move turn
    const on = this.clock % 1.2 < 0.12;
    for (const b of this.beacons) b.visible = on;
    for (const p of this.taxiing.props) p.rotation.x += delta * 28;
    // The baggage train round the service road
    this.trainRun += delta * 5.5;
    this.train.forEach((unit, i) => {
      const at = this.roadAt(this.trainRun - i * 3.4);
      unit.position.set(at.x, 0, at.z);
      unit.rotation.y = at.yaw;
    });
    // The turboprop taxiing along the taxiway behind the follow-me car, round again from the far end
    const span = 560;
    const tx = -280 + ((this.clock * 7) % span);
    this.taxiing.group.position.set(tx, 0, TAXIWAY);
    this.taxiing.group.rotation.y = 0;
    this.followMe.position.set(tx + 30, 0, TAXIWAY);
    // A jet rolling down the runway, lifting off and climbing away, about once a minute
    const t = this.clock % 64;
    const dep = this.departing.group;
    if (t < 30) {
      const a = 1.7;
      const v0 = 2;
      const dist = v0 * t + 0.5 * a * t * t;
      const lift = Math.max(0, t - 18);
      dep.visible = true;
      dep.position.set(300 - dist, lift * lift * 0.35, RUNWAY);
      dep.rotation.set(0, Math.PI, Math.min(0.2, lift * 0.06));
    } else {
      dep.visible = false;
    }
  }
}
