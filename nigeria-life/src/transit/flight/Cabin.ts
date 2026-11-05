import * as THREE from 'three';
import { Builder } from '../../world/kit/ArchKit';
import { HumanMeshBuilder, type HumanRig, type HumanConfig } from '../../graphics/HumanMeshBuilder';
import { bakeToGeometry } from '../../graphics/MeshBaker';
import { seatFigure } from '../RideModels';
import type { Pose } from './FlightPlan';

/**
 * The cabin, inside the fuselage and moving with it: twenty-five rows of three-and-three, the
 * windows looking out on the wing and the ground, overhead bins with the seatbelt signs under
 * them, the galleys at each end, a full load of passengers, and the two cabin crew who greet,
 * show the safety drill, take their jump seats for take-off and landing, and push the trolley
 * down the aisle in the cruise. The player sits in their own seat with a moving map in the
 * seatback in front of them.
 *
 * Coordinates are the aircraft's own: nose along +z, the fuselage's centre line at y = 0.
 */

export const FLOOR = -0.78;
const ROWS = 25;
const PITCH = 0.81;
const FRONT_ROW = 10.0;
const SEAT_X = [1.53, 1.03, 0.53];
const WALL = 1.76;
const WIN_Y0 = 0.05;
const WIN_Y1 = 0.48;
const WIN_W = 0.3;

export const rowZ = (row: number) => FRONT_ROW - (row - 1) * PITCH;

/** The moulded surround with its rounded window, the hole cut out */
function windowBezel(): THREE.MeshStandardMaterial {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 176;
  const g = c.getContext('2d')!;
  g.fillStyle = '#eceff2';
  g.fillRect(0, 0, 128, 176);
  const grad = g.createRadialGradient(64, 88, 30, 64, 88, 90);
  grad.addColorStop(0, 'rgba(160,168,178,0.9)');
  grad.addColorStop(1, 'rgba(236,239,242,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 176);
  g.globalCompositeOperation = 'destination-out';
  g.beginPath();
  g.roundRect(24, 30, 80, 116, 36);
  g.fill();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return new THREE.MeshStandardMaterial({ map: t, alphaTest: 0.5, roughness: 0.6, side: THREE.DoubleSide });
}

const SKIN = ['#4a2c1d', '#5c3722', '#3b2416', '#6b4226'];
const HAIR: Record<string, number> = { gele: 0xd97706, fila: 0xb91c1c, braids: 0x18181b, bob_wig: 0x1c1917, ponytail: 0x18181b };

/** Head, hair and shoulders, in a passenger's own colours: for the rows the camera only sees from afar */
function farFigure(look: HumanConfig): THREE.BufferGeometry {
  const root = new THREE.Group();
  const mat = (hex: number | string) => new THREE.MeshStandardMaterial({ color: new THREE.Color(hex as THREE.ColorRepresentation) });
  const skin = mat(look.skinTone ?? SKIN[(look.outfitColor ?? 0) % SKIN.length]);
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.52, 0.24), mat(look.outfitColor ?? 0x334155));
  torso.position.y = 0.3;
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 0.1, 6), skin);
  neck.position.y = 0.6;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.13, 10, 8), skin);
  head.position.y = 0.74;
  head.scale.set(0.92, 1.05, 0.98);
  const hair = new THREE.Mesh(new THREE.SphereGeometry(0.138, 10, 5, 0, Math.PI * 2, 0, Math.PI * 0.55), mat(HAIR[look.hairstyle ?? ''] ?? 0x111111));
  hair.position.y = 0.76;
  if (look.hairstyle === 'gele') hair.scale.set(1.25, 1.35, 1.25);
  root.add(torso, neck, head, hair);
  for (const sx of [-0.24, 0.24]) {
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.42, 0.12), mat(look.outfitColor ?? 0x334155));
    arm.position.set(sx, 0.32, 0.04);
    root.add(arm);
  }
  return bakeToGeometry(root) ?? new THREE.BufferGeometry();
}

/** A passenger posed in a seat, hips at the origin, still in its own colours, ready to bake into one mesh */
function seatedForBaking(look: HumanConfig): { root: THREE.Object3D; legs: THREE.Object3D[] } {
  const rig = HumanMeshBuilder.createHuman(look);
  rig.nameTag.visible = false;
  if (rig.phoneMesh) rig.phoneMesh.visible = false;
  const root = new THREE.Group();
  rig.group.scale.setScalar(0.92);
  rig.group.position.y = -0.77 * 0.92;
  rig.leftLeg.rotation.set(-1.42, 0, -0.06);
  rig.rightLeg.rotation.set(-1.42, 0, 0.06);
  if (rig.leftLowerLeg) rig.leftLowerLeg.rotation.x = 1.15;
  if (rig.rightLowerLeg) rig.rightLowerLeg.rotation.x = 1.15;
  rig.leftArm.rotation.x = -0.5;
  rig.rightArm.rotation.x = -0.5;
  if (rig.leftForearm) rig.leftForearm.rotation.x = -0.6;
  if (rig.rightForearm) rig.rightForearm.rotation.x = -0.6;
  root.add(rig.group);
  return { root, legs: [rig.leftLeg, rig.rightLeg] };
}
const windowZs = (): number[] => {
  const out: number[] = [];
  for (let z = -10.6; z <= 11.25; z += 0.53) {
    if (Math.abs(z - 11.45) < 0.53 || Math.abs(z + 11.35) < 0.53) continue;
    out.push(z);
  }
  return out;
};

interface Crew { rig: HumanRig; root: THREE.Group; walking: boolean; sitting: boolean }

/** Where the player sits, from the booking's seat (row number and letter) */
export function seatOf(seat: string | undefined): { row: number; side: 1 | -1; column: number } {
  const m = /(\d+)\s*([A-F])/i.exec(seat ?? '');
  const row = THREE.MathUtils.clamp(m ? parseInt(m[1], 10) : 14, 2, ROWS);
  const letter = (m?.[2] ?? 'A').toUpperCase();
  const index = 'ABCDEF'.indexOf(letter);
  return { row, side: index < 3 ? 1 : -1, column: 0 };
}

export class Cabin {
  public readonly group = new THREE.Group();
  /** The player's eye in their seat, and the way their window is */
  public readonly seatEye = new THREE.Vector3();
  public readonly windowSide: 1 | -1;
  public readonly aisleEye = new THREE.Vector3(0, FLOOR + 1.62, -9.4);
  /** The trolley has reached the player's row: a drink and a meat pie on the tray table */
  public onServed: (() => void) | null = null;

  private readonly row: number;
  private readonly signMaterial = new THREE.MeshBasicMaterial({ color: 0xf59e0b });
  private readonly ifeCanvas = document.createElement('canvas');
  private readonly ifeTexture: THREE.CanvasTexture;
  private readonly crew: Crew[] = [];
  private readonly trolley = new THREE.Group();
  private readonly tray = new THREE.Group();
  private player: THREE.Group | null = null;
  private served = false;
  private ifeTimer = 0;

  constructor(seat: string | undefined, passengerLook: (() => HumanRig) | null) {
    this.group.name = 'cabin';
    const where = seatOf(seat);
    this.row = where.row;
    this.windowSide = where.side;
    const seatX = where.side * SEAT_X[0];
    this.seatEye.set(seatX - where.side * 0.14, FLOOR + 1.17, rowZ(this.row) - 0.02);
    this.aisleEye.set(0, FLOOR + 1.84, Math.max(-10.2, rowZ(this.row) - 3.4));

    this.buildShell();
    this.buildSeats();
    this.buildPassengers(where.row, where.side);
    this.buildCrew();
    this.buildTray(seatX);
    this.ifeCanvas.width = 512;
    this.ifeCanvas.height = 320;
    this.ifeTexture = new THREE.CanvasTexture(this.ifeCanvas);
    this.ifeTexture.colorSpace = THREE.SRGBColorSpace;
    const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.25, 0.156), new THREE.MeshBasicMaterial({ map: this.ifeTexture }));
    screen.position.set(seatX, FLOOR + 0.98, rowZ(this.row) + PITCH - 0.31);
    screen.rotation.set(-0.12, Math.PI, 0);
    this.group.add(screen);
    // The player in their window seat, seen from the aisle
    if (passengerLook) {
      const seated = seatFigure(passengerLook());
      seated.root.position.set(seatX, FLOOR + 0.56, rowZ(this.row) - 0.06);
      this.group.add(seated.root);
      this.player = seated.root;
    }
  }

  public setPlayerVisible(visible: boolean): void {
    if (this.player) this.player.visible = visible;
  }

  // --- The cabin itself -------------------------------------------------------------------

  private buildShell(): void {
    const b = new Builder();
    const panel = 0xeef1f4;
    const trim = 0xcbd2da;
    // Floor, carpet down the aisle
    b.box(0x475569, WALL * 2, 0.12, 24.2, 0, FLOOR - 0.12, 0.3);
    b.box(0x1e3a8a, 0.56, 0.012, 23.6, 0, FLOOR, 0.3);
    const wins = windowZs();
    for (const sgn of [1, -1]) {
      // The wall under the windows, the strip above them and the curve up to the bins
      b.box(panel, 0.06, WIN_Y0 - FLOOR, 24.2, sgn * WALL, FLOOR, 0.3);
      b.box(panel, 0.06, 0.5, 24.2, sgn * (WALL - 0.04), WIN_Y1, 0.3, { roll: sgn * 0.18 });
      // Pillars between the windows, and each window's bezel
      let last = -11.9;
      for (const z of wins) {
        const from = last;
        const to = z - WIN_W / 2;
        if (to > from) b.box(panel, 0.06, WIN_Y1 - WIN_Y0, to - from, sgn * WALL, WIN_Y0, (from + to) / 2);
        last = z + WIN_W / 2;
        for (const [w, h, y, dz] of [[WIN_W + 0.08, 0.04, WIN_Y1, 0], [WIN_W + 0.08, 0.04, WIN_Y0 - 0.04, 0], [0.04, WIN_Y1 - WIN_Y0, WIN_Y0, WIN_W / 2 + 0.02], [0.04, WIN_Y1 - WIN_Y0, WIN_Y0, -WIN_W / 2 - 0.02]]) {
          b.box(trim, 0.03, h, w, sgn * (WALL - 0.045), y, z + dz);
        }
      }
      b.box(panel, 0.06, WIN_Y1 - WIN_Y0, 12.5 - last, sgn * WALL, WIN_Y0, (last + 12.5) / 2);
      // Overhead bins, with a seam between each pair of rows, and the service panel beneath
      b.box(0xf8fafc, 1.0, 0.5, 23.4, sgn * 1.16, 0.98, 0.1, { roll: sgn * 0.12 });
      for (let r = 1; r <= ROWS; r += 2) b.box(0xd1d5db, 1.02, 0.5, 0.02, sgn * 1.16, 0.98, rowZ(r) + 0.4, { roll: sgn * 0.12 });
      b.box(0xe5e7eb, 0.9, 0.05, 23.4, sgn * 1.12, 0.93, 0.1);
      for (let r = 1; r <= ROWS; r++) {
        for (const x of SEAT_X) b.box(0xfff7d6, 0.05, 0.012, 0.05, sgn * x, 0.918, rowZ(r) + 0.05, { glow: true });
      }
    }
    // The ceiling and its cove lights, and the wall behind the bins
    b.box(0xf1f5f9, WALL * 2, 0.06, 24.2, 0, 1.5, 0.3);
    for (const sgn of [1, -1]) b.box(panel, 0.06, 0.62, 24.2, sgn * (WALL - 0.08), 0.92, 0.3);
    for (const sgn of [1, -1]) b.box(0xfffbeb, 0.06, 0.03, 23.4, sgn * 0.62, 1.46, 0.1, { glow: true });
    // The front: galleys either side of the flight-deck door, the exit signs over the doors
    b.box(0xe2e8f0, WALL * 2, 2.3, 0.08, 0, FLOOR, 12.6);
    b.box(0x94a3b8, 0.82, 1.95, 0.04, 0, FLOOR, 12.54);
    for (const sgn of [1, -1]) {
      b.box(0xd1d5db, 1.0, 1.9, 0.75, sgn * 1.2, FLOOR, 12.15);
      b.box(0x9ca3af, 0.9, 0.02, 0.7, sgn * 1.2, FLOOR + 1.0, 12.14);
      b.box(0x16a34a, 0.28, 0.1, 0.03, sgn * 1.2, 1.0, 11.75, { glow: true });
      b.box(0x16a34a, 0.28, 0.1, 0.03, sgn * 1.2, 1.0, -11.0, { glow: true });
    }
    // The back: the rear galley and the toilets
    b.box(0xe2e8f0, WALL * 2, 2.3, 0.08, 0, FLOOR, -11.8);
    for (const sgn of [1, -1]) b.box(0xcbd5e1, 1.1, 1.95, 0.9, sgn * 1.15, FLOOR, -11.3);
    this.group.add(b.build('cabin shell', { roughness: 0.6 }));

    // The seatbelt signs, one over every other row, lit when the captain has them on
    const signs = new Builder();
    for (const sgn of [1, -1]) for (let r = 1; r <= ROWS; r += 2) signs.box(0xffffff, 0.12, 0.012, 0.07, sgn * 1.12, 0.915, rowZ(r) - 0.12);
    const signMesh = signs.build('seatbelt signs');
    signMesh.traverse((o) => { if (o instanceof THREE.Mesh) o.material = this.signMaterial; });
    this.group.add(signMesh);

    // Window shades: some passengers have theirs half down
    const shades = new Builder();
    let n = 7;
    for (const sgn of [1, -1]) {
      for (const z of windowZs()) {
        n = (n * 1103515245 + 12345) & 0x7fffffff;
        const near = sgn === this.windowSide && Math.abs(z - rowZ(this.row)) < 1.6;
        if (near || n % 5 !== 0) continue;
        shades.box(0xe5e7eb, 0.02, (WIN_Y1 - WIN_Y0) * 0.55, WIN_W, sgn * (WALL - 0.035), WIN_Y1 - (WIN_Y1 - WIN_Y0) * 0.55, z);
      }
    }
    this.group.add(shades.build('window shades'));

    // The rounded window surround of an airliner, over every opening
    const bezel = windowBezel();
    for (const sgn of [1, -1]) {
      const wins = windowZs();
      const mesh = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.44, 0.6), bezel, wins.length);
      const m = new THREE.Matrix4();
      const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), -sgn * Math.PI / 2);
      wins.forEach((z, i) => { m.compose(new THREE.Vector3(sgn * (WALL - 0.05), (WIN_Y0 + WIN_Y1) / 2, z), q, new THREE.Vector3(1, 1, 1)); mesh.setMatrixAt(i, m); });
      mesh.instanceMatrix.needsUpdate = true;
      mesh.frustumCulled = false;
      this.group.add(mesh);
    }
  }

  private buildSeats(): void {
    const b = new Builder();
    const leather = 0x1f3b5c;
    const cover = 0xf8fafc;
    const band = 0x0f7a3d;
    for (let r = 1; r <= ROWS; r++) {
      const z = rowZ(r);
      for (const sgn of [1, -1]) {
        for (const x of SEAT_X) {
          const sx = sgn * x;
          b.box(0x334155, 0.42, 0.3, 0.4, sx, FLOOR, z);
          b.box(leather, 0.46, 0.12, 0.47, sx, FLOOR + 0.36, z + 0.02);
          b.box(leather, 0.46, 0.74, 0.1, sx, FLOOR + 0.44, z - 0.25, { pitch: -0.12 });
          b.box(cover, 0.42, 0.22, 0.11, sx, FLOOR + 0.98, z - 0.31, { pitch: -0.12 });
          b.box(band, 0.42, 0.04, 0.115, sx, FLOOR + 0.99, z - 0.31, { pitch: -0.12 });
          // The seatback screen and the tray table, for the row behind
          b.box(0x0b1220, 0.25, 0.16, 0.012, sx, FLOOR + 0.9, z - 0.31, { pitch: -0.12 });
          b.box(0x94a3b8, 0.38, 0.26, 0.012, sx, FLOOR + 0.52, z - 0.32, { pitch: -0.12 });
        }
        // Armrests between and beside the seats
        for (const ax of [0.28, 0.78, 1.28, 1.76]) b.box(0x111827, 0.05, 0.06, 0.42, sgn * Math.min(ax, 1.72), FLOOR + 0.6, z + 0.02);
      }
    }
    this.group.add(b.build('seats', { roughness: 0.55 }));
  }

  /** A full flight: people of every kind, seated, each look drawn in one go wherever it sits */
  private buildPassengers(playerRow: number, playerSide: 1 | -1): void {
    const looks: HumanConfig[] = [
      { gender: 'male', username: '', outfit: 'senator', outfitColor: 0x1e3a8a, hairstyle: 'short_crop', lod: 'street' },
      { gender: 'female', username: '', outfit: 'casual_blouse', outfitColor: 0xdc2626, hairstyle: 'braids', lod: 'street' },
      { gender: 'male', username: '', outfit: 'agbada', outfitColor: 0xf8fafc, hairstyle: 'fila', lod: 'street' },
      { gender: 'female', username: '', outfit: 'blue_dress', outfitColor: 0x7c3aed, hairstyle: 'gele', lod: 'street' },
      { gender: 'male', username: '', outfit: 'casual_tee', outfitColor: 0x059669, hairstyle: 'fade', lod: 'street' },
      { gender: 'female', username: '', outfit: 'peplum_skirt', outfitColor: 0xf59e0b, hairstyle: 'bob_wig', lod: 'street' },
      { gender: 'male', username: '', outfit: 'lecturer_suit', outfitColor: 0x111827, hairstyle: 'short_crop', lod: 'street', hasShades: true },
      { gender: 'female', username: '', outfit: 'casual_blouse', outfitColor: 0x0ea5e9, hairstyle: 'ponytail', lod: 'street' },
    ];
    const material = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.62 });
    const seats: Array<{ x: number; z: number; near: boolean }> = [];
    let n = 42;
    for (let r = 1; r <= ROWS; r++) {
      for (const sgn of [1, -1]) {
        for (let c = 0; c < 3; c++) {
          // The player's seat, and those between it and the window, are left for the player
          if (r === playerRow && sgn === playerSide && c === 0) continue;
          n = (n * 1103515245 + 12345) & 0x7fffffff;
          if (n % 100 < 12) continue;
          seats.push({ x: sgn * SEAT_X[c], z: rowZ(r), near: Math.abs(r - playerRow) <= 6 });
        }
      }
    }
    const near = seats.filter((st) => st.near);
    const far = seats.filter((st) => !st.near);
    const per = Math.ceil(near.length / looks.length);
    const farPer = Math.ceil(far.length / looks.length);
    const m = new THREE.Matrix4();
    const place = (mesh: THREE.InstancedMesh, list: Array<{ x: number; z: number }>) => {
      list.forEach((st, k) => {
        m.makeRotationY(((k % 3) - 1) * 0.12);
        m.setPosition(st.x, FLOOR + 0.56, st.z - 0.06);
        mesh.setMatrixAt(k, m);
      });
      mesh.instanceMatrix.needsUpdate = true;
      mesh.frustumCulled = false;
      mesh.name = 'passengers';
      this.group.add(mesh);
    };
    // Further down the cabin, a head and shoulders over the seat back is all that is seen of anyone
    looks.forEach((look, i) => {
      const mine = far.slice(i * farPer, (i + 1) * farPer);
      if (mine.length) place(new THREE.InstancedMesh(farFigure(look), material, mine.length), mine);
    });
    looks.forEach((look, i) => {
      // Under the seat in front the legs are never seen: they are left out of the mesh
      const seated = seatedForBaking(look);
      const geo = bakeToGeometry(seated.root, { exclude: seated.legs });
      if (!geo) return;
      const mine = near.slice(i * per, (i + 1) * per);
      if (mine.length) place(new THREE.InstancedMesh(geo, material, mine.length), mine);
    });
  }

  private buildCrew(): void {
    const looks: HumanConfig[] = [
      { gender: 'female', username: '', outfit: 'peplum_skirt', outfitColor: 0x0f7a3d, secondaryColor: 0xd4af37, trousersColor: 0x0f3d2a, shoeColor: 0x111827, hairstyle: 'bob_wig', lod: 'street' },
      { gender: 'male', username: '', outfit: 'lecturer_suit', outfitColor: 0x0f7a3d, secondaryColor: 0xd4af37, trousersColor: 0x111827, shoeColor: 0x111827, hairstyle: 'short_crop', hasTie: true, lod: 'street' },
    ];
    for (const look of looks) {
      const rig = HumanMeshBuilder.createHuman(look);
      rig.nameTag.visible = false;
      const root = new THREE.Group();
      rig.group.scale.setScalar(0.92);
      root.add(rig.group);
      root.position.set(0, FLOOR, 11.2);
      this.group.add(root);
      this.crew.push({ rig, root, walking: false, sitting: false });
    }
    // The trolley
    const b = new Builder();
    b.box(0xa3acb8, 0.34, 0.98, 0.78, 0, 0.06, 0);
    b.box(0x0f7a3d, 0.345, 0.12, 0.785, 0, 0.8, 0);
    for (const x of [-0.06, 0.06]) b.box(0xe5e7eb, 0.08, 0.2, 0.08, x, 1.04, 0.22);
    b.box(0xdc2626, 0.1, 0.14, 0.1, 0, 1.04, -0.05);
    b.box(0xfacc15, 0.14, 0.06, 0.18, 0, 1.04, -0.26);
    for (const x of [-0.12, 0.12]) for (const z of [-0.32, 0.32]) b.cylinder(0x111827, 0.04, 0.06, x, 0, z);
    this.trolley.add(b.build('trolley', { roughness: 0.3, metalness: 0.5 }));
    this.trolley.position.set(0, FLOOR, 10.6);
    this.trolley.visible = false;
    this.group.add(this.trolley);
  }

  private buildTray(seatX: number): void {
    const b = new Builder();
    b.box(0x94a3b8, 0.38, 0.02, 0.28, 0, 0, 0);
    b.cylinder(0xb91c1c, 0.035, 0.11, 0.1, 0.02, 0.02);
    b.box(0xfacc15, 0.14, 0.05, 0.1, -0.07, 0.02, 0);
    b.box(0xb45309, 0.09, 0.03, 0.06, -0.07, 0.07, 0);
    b.box(0xffffff, 0.08, 0.004, 0.08, 0.04, 0.02, -0.08);
    this.tray.add(b.build('tray'));
    this.tray.position.set(seatX, FLOOR + 0.7, rowZ(this.row) + 0.34);
    this.tray.visible = false;
    this.group.add(this.tray);
  }

  // --- Through the flight -----------------------------------------------------------------

  public update(delta: number, time: number, pose: Pose, journey: { from: string; to: string; fromCode: string; toCode: string; fraction: number; minutesLeft: number; feet: number; kmh: number }): void {
    this.signMaterial.color.set(pose.seatbelt ? 0xf59e0b : 0x4b5563);
    this.crewAct(time, pose);
    for (const c of this.crew) {
      c.rig.updateAnimation(time, c.walking ? 'walk' : false);
      if (!c.sitting) continue;
      c.rig.leftLeg.rotation.set(-1.42, 0, -0.06);
      c.rig.rightLeg.rotation.set(-1.42, 0, 0.06);
      if (c.rig.leftLowerLeg) c.rig.leftLowerLeg.rotation.x = 1.2;
      if (c.rig.rightLowerLeg) c.rig.rightLowerLeg.rotation.x = 1.2;
    }
    this.crewGesture(time, pose);
    this.ifeTimer -= delta;
    if (this.ifeTimer <= 0) {
      this.ifeTimer = 0.5;
      this.drawMap(journey, pose);
    }
  }

  /** Where the crew are and what they are doing, stage by stage */
  private crewAct(time: number, pose: Pose): void {
    const [a, b] = this.crew;
    const s = pose.inStage;
    const place = (c: Crew, z: number, facing: number, walking = false, sit = false) => {
      c.root.visible = true;
      c.root.position.set(0, sit ? FLOOR + 0.5 : FLOOR, z);
      c.rig.group.position.y = sit ? -0.77 * 0.92 : 0;
      c.root.rotation.y = facing;
      c.walking = walking;
      c.sitting = sit;
    };
    this.trolley.visible = false;
    switch (pose.stage) {
      case 'gate': {
        place(a, 11.05, Math.PI);
        // B walks down the aisle closing the bins, and back
        const u = s / 9;
        const z = u < 0.5 ? THREE.MathUtils.lerp(10.4, -8.5, u * 2) : THREE.MathUtils.lerp(-8.5, 1.5, (u - 0.5) * 2);
        place(b, z, u < 0.5 ? Math.PI : 0, true);
        break;
      }
      case 'pushback':
      case 'taxi': {
        const demo = pose.stage === 'taxi' ? s + 7 : s;
        if (demo < 17) {
          place(a, rowZ(3) + 0.45, Math.PI);
          place(b, rowZ(15) + 0.45, Math.PI);
        } else {
          const u = Math.min(1, (demo - 17) / 3);
          place(a, THREE.MathUtils.lerp(rowZ(3) + 0.45, 11.3, u), 0, u < 1);
          place(b, THREE.MathUtils.lerp(rowZ(15) + 0.45, -10.9, u), Math.PI, u < 1);
          if (u >= 1) { place(a, 11.35, Math.PI, false, true); place(b, -10.95, 0, false, true); }
        }
        break;
      }
      case 'takeoff':
      case 'climb':
      case 'final':
      case 'rollout':
        place(a, 11.35, Math.PI, false, true);
        place(b, -10.95, 0, false, true);
        break;
      case 'cruise': {
        // The trolley from the front galley to the back, stopping at each row; A pushes it, B pulls
        const start = 3;
        const len = Math.max(8, pose.stageLength - 6);
        const p = THREE.MathUtils.clamp((s - start) / len, 0, 1);
        const stops = 10;
        const q = p - Math.sin(2 * Math.PI * p * stops) / (2 * Math.PI * stops);
        const z = THREE.MathUtils.lerp(10.4, -8.6, q);
        const moving = p > 0 && p < 1 && Math.cos(2 * Math.PI * p * stops) < 0.6;
        if (s < start) {
          place(a, 11.05, Math.PI);
          place(b, 10.6, Math.PI);
        } else {
          this.trolley.visible = true;
          this.trolley.position.z = z;
          place(a, z + 0.75, Math.PI, moving);
          place(b, z - 0.75, 0, moving);
        }
        if (!this.served && s > start && z < rowZ(this.row) + 0.3) {
          this.served = true;
          this.tray.visible = true;
          this.onServed?.();
        }
        break;
      }
      case 'descent': {
        // Collecting the rubbish and checking the belts, then to the jump seats
        if (s > 4) this.tray.visible = false;
        const u = Math.min(1, s / 14);
        place(a, THREE.MathUtils.lerp(-8.8, 11.35, u), 0, u < 1, u >= 1);
        if (u >= 1) a.root.rotation.y = Math.PI;
        place(b, -10.95, 0, false, true);
        break;
      }
      case 'taxi-in':
        place(a, 11.05, Math.PI);
        place(b, -10.95, 0, false, true);
        break;
    }
    void time;
  }

  /** The safety drill: the belt, the oxygen mask, the life jacket and the exits, arms acting each one */
  private crewGesture(time: number, pose: Pose): void {
    const demoStage = pose.stage === 'pushback' || pose.stage === 'taxi';
    if (!demoStage) return;
    const demo = pose.stage === 'taxi' ? pose.inStage + 7 : pose.inStage;
    if (demo >= 17) return;
    const part = Math.floor(demo / 4.25);
    for (const c of this.crew) {
      const r = c.rig;
      if (part === 0) {
        // The belt, held out in front and buckled
        r.leftArm.rotation.set(-0.9, 0, 0.15);
        r.rightArm.rotation.set(-0.9, 0, -0.15);
        if (r.leftForearm) r.leftForearm.rotation.x = -0.6 - 0.2 * Math.sin(time * 4);
        if (r.rightForearm) r.rightForearm.rotation.x = -0.6;
      } else if (part === 1) {
        // The oxygen mask, pulled down and over the face
        r.leftArm.rotation.set(-2.5 + 0.3 * Math.sin(time * 2), 0, 0.1);
        r.rightArm.rotation.set(-0.3, 0, -0.1);
        if (r.leftForearm) r.leftForearm.rotation.x = -1.4;
      } else if (part === 2) {
        // The life jacket over the head, the toggles pulled
        r.leftArm.rotation.set(-1.4, 0, 0.5);
        r.rightArm.rotation.set(-1.4, 0, -0.5);
        if (r.leftForearm) r.leftForearm.rotation.x = -1.2;
        if (r.rightForearm) r.rightForearm.rotation.x = -1.2;
      } else {
        // The exits: two at the front, four over the wings, two at the back
        const fore = Math.sin(time * 1.6) > 0;
        r.leftArm.rotation.set(fore ? -1.5 : 0, 0, fore ? 0.2 : 1.45);
        r.rightArm.rotation.set(fore ? -1.5 : 0, 0, fore ? -0.2 : -1.45);
        if (r.leftForearm) r.leftForearm.rotation.x = 0;
        if (r.rightForearm) r.rightForearm.rotation.x = 0;
      }
    }
  }

  /** The moving map on the seatback screen */
  private drawMap(j: { from: string; to: string; fromCode: string; toCode: string; fraction: number; minutesLeft: number; feet: number; kmh: number }, pose: Pose): void {
    const g = this.ifeCanvas.getContext('2d')!;
    const W = 512;
    const H = 320;
    const sea = g.createLinearGradient(0, 0, 0, H);
    sea.addColorStop(0, '#0c4a6e');
    sea.addColorStop(1, '#082f49');
    g.fillStyle = sea;
    g.fillRect(0, 0, W, H);
    // The land, a few rivers
    g.fillStyle = '#3f6212';
    g.beginPath();
    g.moveTo(0, 250); g.bezierCurveTo(120, 230, 220, 268, 330, 252); g.bezierCurveTo(420, 240, 470, 270, W, 262); g.lineTo(W, 0); g.lineTo(0, 0); g.closePath();
    g.fill();
    g.strokeStyle = '#38bdf8';
    g.lineWidth = 3;
    g.beginPath(); g.moveTo(90, 0); g.bezierCurveTo(180, 90, 230, 140, 300, 250); g.stroke();
    g.beginPath(); g.moveTo(W, 70); g.bezierCurveTo(400, 110, 320, 130, 262, 170); g.stroke();
    const ax = 110; const ay = 215; const bx = 400; const by = 95;
    g.setLineDash([8, 8]);
    g.strokeStyle = 'rgba(255,255,255,0.6)';
    g.beginPath(); g.moveTo(ax, ay); g.quadraticCurveTo(250, 110, bx, by); g.stroke();
    g.setLineDash([]);
    const f = j.fraction;
    const px = (1 - f) * (1 - f) * ax + 2 * (1 - f) * f * 250 + f * f * bx;
    const py = (1 - f) * (1 - f) * ay + 2 * (1 - f) * f * 110 + f * f * by;
    g.strokeStyle = '#facc15';
    g.lineWidth = 4;
    g.beginPath();
    for (let k = 0; k <= 20; k++) {
      const u = (f * k) / 20;
      const x = (1 - u) * (1 - u) * ax + 2 * (1 - u) * u * 250 + u * u * bx;
      const y = (1 - u) * (1 - u) * ay + 2 * (1 - u) * u * 110 + u * u * by;
      if (k === 0) g.moveTo(x, y); else g.lineTo(x, y);
    }
    g.stroke();
    for (const [x, y, code] of [[ax, ay, j.fromCode], [bx, by, j.toCode]] as Array<[number, number, string]>) {
      g.fillStyle = '#ffffff';
      g.beginPath(); g.arc(x, y, 6, 0, Math.PI * 2); g.fill();
      g.font = 'bold 20px "Segoe UI", sans-serif';
      g.fillText(code, x + 10, y - 8);
    }
    g.save();
    g.translate(px, py);
    g.rotate(Math.atan2(by - ay, bx - ax));
    g.fillStyle = '#facc15';
    g.beginPath(); g.moveTo(14, 0); g.lineTo(-10, -9); g.lineTo(-5, 0); g.lineTo(-10, 9); g.closePath(); g.fill();
    g.restore();
    // The panel along the bottom
    g.fillStyle = 'rgba(2,6,23,0.85)';
    g.fillRect(0, H - 70, W, 70);
    g.fillStyle = '#e2e8f0';
    g.font = 'bold 17px "Segoe UI", sans-serif';
    const cells = [
      ['Altitude', `${j.feet.toLocaleString()} ft`], ['Ground speed', `${j.kmh} km/h`], ['To ' + j.to, j.minutesLeft > 0 ? `${j.minutesLeft} min` : 'Arrived'],
    ];
    cells.forEach(([label, value], i) => {
      g.fillStyle = '#94a3b8';
      g.font = '14px "Segoe UI", sans-serif';
      g.fillText(label, 16 + i * 168, H - 44);
      g.fillStyle = '#f8fafc';
      g.font = 'bold 20px "Segoe UI", sans-serif';
      g.fillText(value, 16 + i * 168, H - 18);
    });
    g.fillStyle = 'rgba(2,6,23,0.7)';
    g.fillRect(0, 0, W, 34);
    g.fillStyle = pose.seatbelt ? '#fbbf24' : '#4ade80';
    g.font = 'bold 15px "Segoe UI", sans-serif';
    g.fillText(pose.seatbelt ? '⚠ FASTEN SEATBELT' : 'SEATBELT SIGN OFF', 14, 23);
    g.fillStyle = '#e2e8f0';
    g.textAlign = 'right';
    g.fillText(`${j.from} → ${j.to}`, W - 14, 23);
    g.textAlign = 'left';
    this.ifeTexture.needsUpdate = true;
  }
}
