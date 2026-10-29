import * as THREE from 'three';
import { bakeToGeometry } from '../../graphics/MeshBaker';

/**
 * A narrow-body airliner the size of an A320: a fuselage with a drooped nose and an upswept
 * tail, painted in the airline's livery with its windows, doors and title; swept wings with
 * sharklets, flaps and spoilers that move; two turbofans whose fans turn with the thrust; gear
 * that folds away; and the lights an airliner shows (red and green on the tips, white strobes,
 * the red beacon). The nose points along +z and the origin is on the ground under the main
 * wheels, which is where it pivots when it rotates for take-off.
 */

const R = 1.98;
const HALF = 18.8;
/** Fuselage centre above the ground with the gear down */
export const BODY_HEIGHT = 3.6;
const MAIN_AXLE = { y: 0.57, z: -1.0 };

function profile(z: number): { r: number; c: number } {
  if (z > 12) {
    const d = (z - 12) / (HALF - 12);
    return { r: R * Math.sqrt(Math.max(0, 1 - Math.pow(d, 2.4))), c: -0.38 * d * d };
  }
  if (z < -7) {
    const d = (-7 - z) / (HALF - 7);
    let r = R * (1 - 0.86 * Math.pow(d, 1.3));
    if (d > 0.97) r *= (1 - d) / 0.03;
    return { r, c: 1.2 * Math.pow(d, 1.6) };
  }
  return { r: R, c: 0 };
}

function fuselageGeometry(): THREE.BufferGeometry {
  const rings = 72;
  const seg = 36;
  const pos: number[] = [];
  const uv: number[] = [];
  const idx: number[] = [];
  for (let i = 0; i <= rings; i++) {
    const v = i / rings;
    const z = -HALF + v * 2 * HALF;
    const { r, c } = profile(z);
    for (let j = 0; j <= seg; j++) {
      const u = j / seg;
      const th = u * Math.PI * 2;
      pos.push(Math.sin(th) * r, c - Math.cos(th) * r * 1.03, z);
      uv.push(u, v);
    }
  }
  for (let i = 0; i < rings; i++) {
    for (let j = 0; j < seg; j++) {
      const a = i * (seg + 1) + j;
      const b = a + seg + 1;
      idx.push(a, a + 1, b, a + 1, b + 1, b);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/** The livery, painted onto the fuselage: around it across, along it down the canvas */
function liveryTexture(title: string, registration: string): THREE.CanvasTexture {
  const W = 512;
  const H = 2048;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const g = canvas.getContext('2d')!;
  const zy = (z: number) => (1 - (z + HALF) / (2 * HALF)) * H;
  const ux = (u: number) => u * W;
  g.fillStyle = '#f8fafc';
  g.fillRect(0, 0, W, H);
  // The belly, and the green cheatline with a gold pinstripe down both sides
  g.fillStyle = '#d5dbe3';
  g.fillRect(0, 0, ux(0.1), H);
  g.fillRect(ux(0.9), 0, W, H);
  for (const [u0, gold] of [[0.17, 0.222], [0.783, 0.775]] as Array<[number, number]>) {
    g.fillStyle = '#0f7a3d';
    g.fillRect(ux(u0), zy(17.2), ux(0.047), zy(-17.5) - zy(17.2));
    g.fillStyle = '#d4af37';
    g.fillRect(ux(gold), zy(16.8), 3, zy(-17.4) - zy(16.8));
  }
  // Doors: front and back on both sides, and the over-wing exits
  const doors: Array<[number, number, number]> = [[11.45, 0.82, 1.85], [-11.35, 0.82, 1.85], [0.55, 0.5, 1.0], [-0.25, 0.5, 1.0]];
  const doorAt = (z: number) => doors.some(([dz, w]) => Math.abs(z - dz) < w / 2 + 0.12);
  g.strokeStyle = '#94a3b8';
  g.lineWidth = 2;
  for (const [dz, w, h] of doors) {
    for (const mid of [0.27, 0.73]) {
      const hu = h / (2 * Math.PI * R);
      const top = mid > 0.5 ? mid - hu * 0.62 : mid + hu * 0.62;
      const bottom = mid > 0.5 ? mid + hu * 0.38 : mid - hu * 0.38;
      g.strokeRect(ux(Math.min(top, bottom)), zy(dz + w / 2), Math.abs(ux(top) - ux(bottom)), zy(dz - w / 2) - zy(dz + w / 2));
    }
  }
  // The cabin windows
  const wu = 0.0265 * W;
  const wv = (0.25 / (2 * HALF)) * H;
  for (let z = -10.6; z <= 11.25; z += 0.53) {
    if (doorAt(z)) continue;
    for (const u of [0.282, 0.718]) {
      const x = ux(u) - wu / 2;
      const y = zy(z) - wv / 2;
      g.fillStyle = '#1f2937';
      g.beginPath();
      g.roundRect(x, y, wu, wv, 5);
      g.fill();
      g.fillStyle = 'rgba(148,163,184,0.5)';
      g.fillRect(x + 2, y + 2, wu * 0.35, wv * 0.4);
    }
  }
  // The flight deck windscreen
  g.fillStyle = '#111827';
  for (const [u0, u1] of [[0.33, 0.395], [0.405, 0.495], [0.505, 0.595], [0.605, 0.67]]) {
    g.beginPath();
    g.moveTo(ux(u0), zy(16.0));
    g.lineTo(ux(u1), zy(16.0));
    g.lineTo(ux(u1) - (u1 < 0.5 ? -4 : 4), zy(16.75));
    g.lineTo(ux(u0) + (u0 < 0.5 ? 6 : -6), zy(16.75));
    g.closePath();
    g.fill();
  }
  // The title above the windows: read nose to tail on the right side, tail to nose on the left
  g.fillStyle = '#0f7a3d';
  g.font = '700 40px "Righteous", "Segoe UI", sans-serif';
  const len = g.measureText(title).width;
  g.save();
  g.translate(ux(0.318), zy(8.6));
  g.rotate(Math.PI / 2);
  g.fillText(title, 0, 0);
  g.restore();
  g.save();
  g.translate(ux(0.682), zy(8.6) + len);
  g.rotate(-Math.PI / 2);
  g.fillText(title, 0, 0);
  g.restore();
  // Registration near the tail, and a small flag by the front door
  g.fillStyle = '#334155';
  g.font = '700 20px "Segoe UI", sans-serif';
  const reg = g.measureText(registration).width;
  g.save();
  g.translate(ux(0.3), zy(-12.6));
  g.rotate(Math.PI / 2);
  g.fillText(registration, 0, 0);
  g.restore();
  g.save();
  g.translate(ux(0.7), zy(-12.6) + reg);
  g.rotate(-Math.PI / 2);
  g.fillText(registration, 0, 0);
  g.restore();
  for (const u of [0.315, 0.66]) {
    const x = ux(u);
    const y = zy(10.2);
    g.fillStyle = '#008751';
    g.fillRect(x, y, 22, 10);
    g.fillRect(x, y + 20, 22, 10);
    g.fillStyle = '#ffffff';
    g.fillRect(x, y + 10, 22, 10);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

function logoTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 256;
  const g = c.getContext('2d')!;
  g.fillStyle = '#d4af37';
  g.beginPath();
  g.arc(128, 128, 112, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = '#0f7a3d';
  g.beginPath();
  g.arc(128, 128, 96, 0, Math.PI * 2);
  g.fill();
  g.strokeStyle = '#ffffff';
  g.lineWidth = 12;
  g.beginPath();
  g.arc(128, 210, 120, Math.PI * 1.15, Math.PI * 1.85);
  g.stroke();
  g.fillStyle = '#ffffff';
  g.font = '700 92px "Righteous", "Segoe UI", sans-serif';
  g.textAlign = 'center';
  g.fillText('NL', 128, 150);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function fanTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 128;
  const g = c.getContext('2d')!;
  g.fillStyle = '#111827';
  g.fillRect(0, 0, 128, 128);
  g.translate(64, 64);
  g.fillStyle = '#4b5563';
  for (let i = 0; i < 22; i++) {
    g.rotate((Math.PI * 2) / 22);
    g.beginPath();
    g.moveTo(6, -2);
    g.quadraticCurveTo(40, -12, 62, -6);
    g.lineTo(62, 2);
    g.quadraticCurveTo(40, 0, 6, 3);
    g.fill();
  }
  // The spinner with its white swirl
  g.fillStyle = '#e5e7eb';
  g.beginPath();
  g.arc(0, 0, 14, 0, Math.PI * 2);
  g.fill();
  g.strokeStyle = '#111827';
  g.lineWidth = 3;
  g.beginPath();
  for (let a = 0; a < Math.PI * 1.6; a += 0.1) g.lineTo(Math.cos(a) * a * 3, Math.sin(a) * a * 3);
  g.stroke();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function glowTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 64;
  c.height = 64;
  const g = c.getContext('2d')!;
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.25, 'rgba(255,255,255,0.75)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}

interface Section { le: THREE.Vector3; chord: number; thick: number }

/** Half-thickness of a symmetric aerofoil at this fraction of the chord, for a thickness of 1 */
function aerofoil(x: number): number {
  return 5 * (0.2969 * Math.sqrt(x) - 0.126 * x - 0.3516 * x * x + 0.2843 * x * x * x - 0.1036 * x * x * x * x);
}

/** A lifting surface lofted through its sections: chord aft along -z, thickness along `across` */
function loft(sections: Section[], across: THREE.Vector3): THREE.BufferGeometry {
  const n = 10;
  const loop: Array<[number, number]> = [];
  for (let k = n; k >= 0; k--) { const x = (1 - Math.cos((Math.PI * k) / n)) / 2; loop.push([x, aerofoil(x)]); }
  for (let k = 1; k < n; k++) { const x = (1 - Math.cos((Math.PI * k) / n)) / 2; loop.push([x, -aerofoil(x)]); }
  const m = loop.length;
  const pos: number[] = [];
  const idx: number[] = [];
  for (const s of sections) {
    for (const [x, y] of loop) {
      pos.push(s.le.x + across.x * y * s.thick, s.le.y + across.y * y * s.thick, s.le.z - x * s.chord + across.z * y * s.thick);
    }
  }
  for (let k = 0; k < sections.length - 1; k++) {
    for (let i = 0; i < m; i++) {
      const a = k * m + i;
      const b = k * m + ((i + 1) % m);
      idx.push(a, b, a + m, b, b + m, a + m);
    }
  }
  // Close the outer end
  const last = sections[sections.length - 1];
  const centre = pos.length / 3;
  pos.push(last.le.x, last.le.y, last.le.z - last.chord * 0.4);
  const base = (sections.length - 1) * m;
  for (let i = 0; i < m; i++) idx.push(base + i, base + ((i + 1) % m), centre);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/** A point on a surface: this far out along the span and this fraction back along the chord */
function onSurface(sections: Section[], x: number, chordFraction: number, lift = 0): THREE.Vector3 {
  let i = 0;
  while (i < sections.length - 2 && sections[i + 1].le.x < x) i++;
  const a = sections[i];
  const b = sections[i + 1];
  const u = THREE.MathUtils.clamp((x - a.le.x) / (b.le.x - a.le.x), 0, 1);
  const le = a.le.clone().lerp(b.le, u);
  const chord = THREE.MathUtils.lerp(a.chord, b.chord, u);
  const thick = THREE.MathUtils.lerp(a.thick, b.thick, u);
  return new THREE.Vector3(le.x, le.y + lift * thick, le.z - chordFraction * chord);
}

/** A panel hinged along the line from `from` to `to`, reaching `chord` aft of it; `inner` turns about the hinge */
function hingedPanel(from: THREE.Vector3, to: THREE.Vector3, chord: number, thickness: number, material: THREE.Material): { pivot: THREE.Group; inner: THREE.Group } {
  const along = to.clone().sub(from);
  const length = along.length();
  const X = along.normalize();
  const Y = new THREE.Vector3(0, 1, 0).sub(X.clone().multiplyScalar(X.y)).normalize();
  const Z = new THREE.Vector3().crossVectors(X, Y);
  const pivot = new THREE.Group();
  pivot.position.copy(from);
  pivot.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(X, Y, Z));
  const inner = new THREE.Group();
  pivot.add(inner);
  const panel = new THREE.Mesh(new THREE.BoxGeometry(length, thickness, chord), material);
  panel.position.set(length / 2, 0, -chord / 2);
  inner.add(panel);
  return { pivot, inner };
}

interface Materials { white: THREE.Material; nacelle: THREE.Material; wingGrey: THREE.Material; green: THREE.Material; metal: THREE.Material; dark: THREE.Material; tyre: THREE.Material; glow: THREE.Texture }

const WING: Section[] = [
  { le: new THREE.Vector3(1.2, -1.32, 3.4), chord: 6.6, thick: 0.8 },
  { le: new THREE.Vector3(6.2, -0.78, 0.85), chord: 3.9, thick: 0.42 },
  { le: new THREE.Vector3(16.9, 0.32, -4.6), chord: 1.5, thick: 0.16 },
];

function lightSprite(glow: THREE.Texture, hex: number, size: number, x: number, y: number, z: number): THREE.Sprite {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow, color: hex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  s.scale.set(size, size, size);
  s.position.set(x, y, z);
  return s;
}

/** One side of the aircraft out from the fuselage: wing, sharklet, flaps, spoilers, engine, main gear and tip lights */
function buildSide(m: Materials, navHex: number) {
  const group = new THREE.Group();
  group.add(new THREE.Mesh(loft(WING, new THREE.Vector3(0, 1, 0)), m.wingGrey));
  group.add(new THREE.Mesh(loft([
    { le: new THREE.Vector3(16.9, 0.32, -4.6), chord: 1.5, thick: 0.12 },
    { le: new THREE.Vector3(17.35, 2.55, -5.75), chord: 0.6, thick: 0.06 },
  ], new THREE.Vector3(1, -0.2, 0).normalize()), m.green));
  const flaps: THREE.Group[] = [];
  const spoilers: THREE.Group[] = [];
  for (const [x0, x1] of [[2.2, 6.2], [6.2, 12.4]]) {
    const { pivot, inner } = hingedPanel(onSurface(WING, x0, 0.8), onSurface(WING, x1, 0.8), 1.25, 0.07, m.wingGrey);
    group.add(pivot);
    flaps.push(inner);
  }
  for (const [x0, x1] of [[6.6, 9.0], [9.0, 11.6]]) {
    const { pivot, inner } = hingedPanel(onSurface(WING, x0, 0.56, 0.17), onSurface(WING, x1, 0.56, 0.17), 0.75, 0.03, m.wingGrey);
    group.add(pivot);
    spoilers.push(inner);
  }
  // The engine: nacelle, intake lip, fan, core, exhaust plug, pylon
  const engine = new THREE.Group();
  engine.position.set(5.75, -2.15, 2.6);
  const nacelle = new THREE.Mesh(new THREE.LatheGeometry([
    new THREE.Vector2(0.6, -2.25), new THREE.Vector2(0.72, -1.95), new THREE.Vector2(0.95, -1.0), new THREE.Vector2(1.04, 0.0),
    new THREE.Vector2(1.06, 1.1), new THREE.Vector2(1.0, 1.96), new THREE.Vector2(0.92, 2.08), new THREE.Vector2(0.84, 1.9), new THREE.Vector2(0.82, 1.2),
  ], 28), m.nacelle);
  nacelle.rotation.x = Math.PI / 2;
  engine.add(nacelle);
  const lip = new THREE.Mesh(new THREE.TorusGeometry(0.9, 0.08, 8, 28), m.metal);
  lip.position.z = 2.04;
  engine.add(lip);
  const fan = new THREE.Mesh(new THREE.CircleGeometry(0.83, 28), new THREE.MeshBasicMaterial({ map: fanTexture() }));
  fan.position.z = 1.35;
  engine.add(fan);
  const core = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.55, 0.9, 20), m.metal);
  core.rotation.x = Math.PI / 2;
  core.position.z = -2.6;
  engine.add(core);
  const plug = new THREE.Mesh(new THREE.ConeGeometry(0.3, 0.8, 16), m.dark);
  plug.rotation.x = -Math.PI / 2;
  plug.position.z = -3.35;
  engine.add(plug);
  const reversers: THREE.Mesh[] = [];
  for (const sgn of [1, -1]) {
    const door = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.5, 1.1), m.metal);
    door.position.set(sgn * 1.02, 0.1, -0.9);
    door.rotation.y = sgn * 0.5;
    door.visible = false;
    engine.add(door);
    reversers.push(door);
  }
  const pylon = new THREE.Mesh(new THREE.BoxGeometry(0.34, 1.05, 4.2), m.wingGrey);
  pylon.position.set(0, 1.15, -0.2);
  engine.add(pylon);
  group.add(engine);
  // The main gear, folding inwards into the belly
  const gear = new THREE.Group();
  gear.position.set(3.8, -1.3, MAIN_AXLE.z);
  const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.13, 1.75, 10), m.metal);
  leg.position.y = -0.85;
  gear.add(leg);
  for (const dx of [-0.32, 0.32]) {
    const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.57, 0.57, 0.36, 18), m.tyre);
    wheel.rotation.z = Math.PI / 2;
    wheel.position.set(dx, -1.73, 0);
    gear.add(wheel);
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.38, 12), m.metal);
    hub.rotation.z = Math.PI / 2;
    hub.position.copy(wheel.position);
    gear.add(hub);
  }
  group.add(gear);
  const nav = lightSprite(m.glow, navHex, 1.4, 17.1, 0.45, -4.9);
  const strobe = lightSprite(m.glow, 0xffffff, 5, 17.2, 0.45, -5.4);
  const landing = lightSprite(m.glow, 0xfff7d6, 3.2, 3.0, -1.2, 3.1);
  group.add(nav, strobe, landing);
  return { group, flaps, spoilers, fan, reversers, gear, nav, strobe, landing };
}

export class Airliner {
  public readonly root = new THREE.Group();
  /** Pitches and rolls about the main wheels */
  private readonly pivot = new THREE.Group();
  public readonly body = new THREE.Group();
  /** The outside skin: hidden when the camera is in the cabin, so the windows look out */
  private readonly shell: THREE.Object3D[] = [];
  private readonly fans: THREE.Mesh[] = [];
  private readonly flaps: THREE.Group[] = [];
  private readonly spoilers: THREE.Group[] = [];
  private readonly reversers: THREE.Mesh[] = [];
  private readonly mainGear: THREE.Group[] = [];
  private noseGear!: THREE.Group;
  private readonly strobes: THREE.Sprite[] = [];
  private readonly beacons: THREE.Sprite[] = [];
  private readonly navLights: THREE.Sprite[] = [];
  private readonly landingLights: THREE.Sprite[] = [];
  private fanAngle = 0;
  private time = 0;

  constructor(title = 'NigeriaLife Air', registration = '5N-NLA') {
    this.root.name = 'airliner';
    this.root.add(this.pivot);
    this.pivot.position.set(0, MAIN_AXLE.y, MAIN_AXLE.z);
    this.pivot.add(this.body);
    this.body.position.set(0, BODY_HEIGHT - MAIN_AXLE.y, -MAIN_AXLE.z);

    const white = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.38, metalness: 0.12 });
    const wingGrey = new THREE.MeshStandardMaterial({ color: 0xd3d9e0, roughness: 0.45, metalness: 0.2, side: THREE.DoubleSide });
    const green = new THREE.MeshStandardMaterial({ color: 0x0f7a3d, roughness: 0.4, metalness: 0.15, side: THREE.DoubleSide });
    const metal = new THREE.MeshStandardMaterial({ color: 0x9ca3af, roughness: 0.3, metalness: 0.75, side: THREE.DoubleSide });
    const dark = new THREE.MeshStandardMaterial({ color: 0x1f2937, roughness: 0.6, metalness: 0.3 });
    const tyre = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.9 });

    // The fuselage in its livery, and the fairing where the wings meet it
    const fuselage = new THREE.Mesh(fuselageGeometry(), new THREE.MeshStandardMaterial({ map: liveryTexture(title, registration), roughness: 0.36, metalness: 0.1 }));
    fuselage.name = 'fuselage';
    this.body.add(fuselage);
    this.shell.push(fuselage);
    const fairing = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 12), white);
    fairing.scale.set(2.05, 0.95, 7.2);
    fairing.position.set(0, -1.45, -0.2);
    this.body.add(fairing);
    this.shell.push(fairing);

    // The left wing (+x side) with its engine, gear and red light; the right is its mirror, with the green
    const glow = glowTexture();
    const nacelleMat = new THREE.MeshStandardMaterial({ color: 0xf1f5f9, roughness: 0.35, metalness: 0.15, side: THREE.DoubleSide });
    const mats: Materials = { white, nacelle: nacelleMat, wingGrey, green, metal, dark, tyre, glow };
    for (const [sgn, navHex] of [[1, 0xff2a2a], [-1, 0x22ff55]]) {
      const half = buildSide(mats, navHex);
      half.group.scale.x = sgn;
      this.body.add(half.group);
      this.flaps.push(...half.flaps);
      this.spoilers.push(...half.spoilers);
      this.fans.push(half.fan);
      this.reversers.push(...half.reversers);
      this.mainGear.push(half.gear);
      this.navLights.push(half.nav);
      this.strobes.push(half.strobe);
      this.landingLights.push(half.landing);
    }
    const light = (hex: number, size: number, x: number, y: number, z: number) => lightSprite(glow, hex, size, x, y, z);

    // The tail: fin with the logo, and the tailplane
    const fin = new THREE.Mesh(loft([
      { le: new THREE.Vector3(0, 1.1, -9.9), chord: 6.6, thick: 0.55 },
      { le: new THREE.Vector3(0, 7.65, -15.7), chord: 2.4, thick: 0.13 },
    ], new THREE.Vector3(1, 0, 0)), green);
    this.body.add(fin);
    const logo = logoTexture();
    for (const sgn of [1, -1]) {
      const decal = new THREE.Mesh(new THREE.CircleGeometry(1.35, 28), new THREE.MeshStandardMaterial({ map: logo, transparent: true, roughness: 0.4 }));
      decal.position.set(sgn * 0.2, 4.4, -14.1);
      decal.rotation.y = sgn * Math.PI / 2;
      this.body.add(decal);
    }
    for (const sgn of [1, -1]) {
      const stab = new THREE.Mesh(loft([
        { le: new THREE.Vector3(0.5, 0.55, -13.4), chord: 3.7, thick: 0.36 },
        { le: new THREE.Vector3(6.3, 0.95, -16.5), chord: 1.3, thick: 0.12 },
      ], new THREE.Vector3(0, 1, 0)), wingGrey);
      stab.scale.x = sgn;
      this.body.add(stab);
    }
    const tailStrobe = light(0xffffff, 3.5, 0, 0.9, -18.9);
    this.body.add(tailStrobe);
    this.strobes.push(tailStrobe);
    for (const [y, z] of [[2.05, -2], [-2.35, 1]]) {
      const b = light(0xff1a1a, 2.2, 0, y, z);
      this.body.add(b);
      this.beacons.push(b);
    }

    // The nose gear, folding forwards
    this.noseGear = new THREE.Group();
    this.noseGear.position.set(0, -1.55, 13.2);
    const noseLeg = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 1.65, 10), metal);
    noseLeg.position.y = -0.8;
    this.noseGear.add(noseLeg);
    for (const dx of [-0.2, 0.2]) {
      const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.38, 0.24, 16), tyre);
      wheel.rotation.z = Math.PI / 2;
      wheel.position.set(dx, -1.67, 0);
      this.noseGear.add(wheel);
    }
    this.body.add(this.noseGear);
  }

  /** From the cabin the skin is left out, so the windows look out on the wing and the sky */
  public setInside(inside: boolean): void {
    for (const o of this.shell) o.visible = !inside;
  }

  public setPose(position: THREE.Vector3, yaw: number, pitch: number, roll: number): void {
    this.root.position.copy(position);
    this.root.rotation.set(0, yaw, 0);
    this.pivot.rotation.set(-pitch, 0, roll, 'YXZ');
  }

  public update(delta: number, state: { gear: number; flaps: number; spoilers: number; thrust: number; reverse: number; engines: boolean; night: boolean }): void {
    this.time += delta;
    const spin = state.engines ? 6 + state.thrust * 60 : Math.max(0, 0);
    this.fanAngle += spin * delta;
    for (const fan of this.fans) fan.rotation.z = this.fanAngle;
    const folded = 1 - state.gear;
    for (const g of this.mainGear) { g.rotation.z = -folded * Math.PI * 0.48; g.visible = folded < 0.99; }
    this.noseGear.rotation.x = -folded * Math.PI * 0.5;
    this.noseGear.visible = folded < 0.99;
    for (const f of this.flaps) {
      f.rotation.x = -0.55 * state.flaps;
      f.position.z = -0.55 * state.flaps;
    }
    for (const s of this.spoilers) s.rotation.x = 0.85 * state.spoilers;
    for (const d of this.reversers) d.visible = state.reverse > 0.05;
    // Strobes flash twice a second and a bit; the beacon turns over once a second
    const strobeOn = state.engines && (this.time % 1.2) < 0.06;
    for (const s of this.strobes) s.visible = strobeOn;
    const beaconOn = state.engines && (this.time % 1.0) < 0.12;
    for (const b of this.beacons) b.visible = beaconOn;
    for (const n of this.navLights) n.visible = true;
    for (const l of this.landingLights) l.visible = state.gear > 0.5 && state.engines;
  }

  /** The aircraft in one piece of geometry, coloured but without its livery: for those parked at the other stands */
  public static parked(tail: number): THREE.Mesh {
    const plane = new Airliner();
    plane.update(0, { gear: 1, flaps: 0, spoilers: 0, thrust: 0, reverse: 0, engines: false, night: false });
    const glows: THREE.Object3D[] = [];
    plane.root.traverse((o) => { if (o instanceof THREE.Sprite) glows.push(o); });
    const geo = bakeToGeometry(plane.root, {
      exclude: glows,
      filter: (mesh, material) => {
        if ((material as THREE.MeshStandardMaterial).color?.getHex() === 0x0f7a3d) return new THREE.Color(tail);
        if (mesh.name === 'fuselage') return new THREE.Color(0xf3f4f6);
        return true;
      },
    });
    return new THREE.Mesh(geo ?? new THREE.BufferGeometry(), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.4, metalness: 0.1 }));
  }
}
