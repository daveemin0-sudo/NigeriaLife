import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/**
 * Airliners at their real size, shaped as the real types flown on Nigerian domestic routes: a
 * 737-800 (engines under the wings), a CRJ-900 (engines at the tail, a T-tail, its own airstair)
 * and an ATR 72 turboprop (high wing, propellers). A smooth turned fuselage with a painted livery
 * (windows, doors, cockpit glass, cheatline, the airline's name and registration), swept wings
 * with a real aerofoil section, nacelles with their fan faces, landing gear, lights.
 *
 * The aircraft stands on the ground at its origin's level, its nose toward +x, its left (port)
 * side toward -z. Every type is a handful of meshes.
 */
export type AirlinerType = '737' | 'crj' | 'atr';

export interface Livery {
  name: string;
  reg: string;
  /** The cheatline and tail colours, and the colour of the name */
  main: string;
  accent: string;
  tail: number;
  text: string;
}

export const LIVERIES: Record<string, Livery> = {
  nigerialife: { name: 'NigeriaLife Air', reg: '5N-NLA', main: '#0f7a46', accent: '#e0b021', tail: 0x0f7a46, text: '#0f5132' },
  nigerialife2: { name: 'NigeriaLife Air', reg: '5N-NLC', main: '#0f7a46', accent: '#e0b021', tail: 0x0f7a46, text: '#0f5132' },
  eko: { name: 'Eko Airways', reg: '5N-EKB', main: '#1d3f8f', accent: '#c81e1e', tail: 0x1d3f8f, text: '#1d3f8f' },
  delta: { name: 'Niger Delta Air', reg: '5N-NDE', main: '#0e7490', accent: '#f59e0b', tail: 0x0e7490, text: '#0e5f74' },
  arewa: { name: 'Arewa Express', reg: '5N-AWX', main: '#6d28d9', accent: '#f97316', tail: 0x5b21b6, text: '#5b21b6' },
};

interface Surface {
  /** Leading edge at the root: metres back from the nose; height above the fuselage's centre line */
  rootX: number;
  y: number;
  rootChord: number;
  tipChord: number;
  span: number;
  sweep: number;
  dihedral: number;
  thick: number;
}

interface Spec {
  length: number;
  radius: number;
  centreY: number;
  noseLen: number;
  tailLen: number;
  tailRise: number;
  wing: Surface;
  stab: Surface;
  fin: { rootX: number; rootChord: number; tipChord: number; height: number; sweep: number; thick: number };
  engines: 'wing' | 'tail' | 'prop';
  engine: { x: number; z: number; y: number; length: number; radius: number };
  gear: { nose: number; main: number; track: number; wheel: number };
  doors: { l1: number; l2: number; height: number };
  windows: { from: number; to: number; pitch: number };
}

const SPECS: Record<AirlinerType, Spec> = {
  '737': {
    length: 39.5, radius: 1.9, centreY: 3.45, noseLen: 6.2, tailLen: 9.5, tailRise: 1.0,
    wing: { rootX: 13.2, y: -1.2, rootChord: 7.4, tipChord: 1.3, span: 16.6, sweep: 0.44, dihedral: 0.1, thick: 0.85 },
    stab: { rootX: 33.5, y: 0.25, rootChord: 3.8, tipChord: 1.2, span: 6.6, sweep: 0.55, dihedral: 0.12, thick: 0.35 },
    fin: { rootX: 30.2, rootChord: 6.6, tipChord: 2.2, height: 7.2, sweep: 0.68, thick: 0.4 },
    engines: 'wing', engine: { x: 10.4, z: 4.9, y: -2.05, length: 4.6, radius: 1.0 },
    gear: { nose: 4.6, main: 18.4, track: 2.85, wheel: 0.56 },
    doors: { l1: 4.4, l2: 35.0, height: 1.85 },
    windows: { from: 7.2, to: 33.2, pitch: 0.51 },
  },
  crj: {
    length: 36.2, radius: 1.36, centreY: 2.45, noseLen: 5.2, tailLen: 7.5, tailRise: 0.55,
    wing: { rootX: 14.5, y: -0.85, rootChord: 4.6, tipChord: 1.0, span: 11.0, sweep: 0.46, dihedral: 0.08, thick: 0.5 },
    stab: { rootX: 33.2, y: 6.2, rootChord: 2.6, tipChord: 1.1, span: 4.2, sweep: 0.55, dihedral: -0.04, thick: 0.22 },
    fin: { rootX: 28.6, rootChord: 5.2, tipChord: 2.6, height: 5.5, sweep: 0.7, thick: 0.32 },
    engines: 'tail', engine: { x: 25.0, z: 2.35, y: 0.75, length: 3.6, radius: 0.68 },
    gear: { nose: 3.2, main: 19.6, track: 2.0, wheel: 0.42 },
    doors: { l1: 3.6, l2: 31.5, height: 1.7 },
    windows: { from: 6.2, to: 30.2, pitch: 0.51 },
  },
  atr: {
    length: 27.2, radius: 1.42, centreY: 2.15, noseLen: 4.6, tailLen: 6.5, tailRise: 0.8,
    wing: { rootX: 10.6, y: 1.45, rootChord: 2.6, tipChord: 1.5, span: 13.3, sweep: 0.04, dihedral: 0.0, thick: 0.38 },
    stab: { rootX: 24.6, y: 5.6, rootChord: 1.9, tipChord: 1.0, span: 3.6, sweep: 0.3, dihedral: 0, thick: 0.18 },
    fin: { rootX: 20.0, rootChord: 4.6, tipChord: 1.9, height: 4.6, sweep: 0.62, thick: 0.3 },
    engines: 'prop', engine: { x: 8.6, z: 4.1, y: 1.05, length: 5.2, radius: 0.55 },
    gear: { nose: 2.4, main: 12.0, track: 2.05, wheel: 0.45 },
    doors: { l1: 3.2, l2: 23.4, height: 1.75 },
    windows: { from: 5.4, to: 21.4, pitch: 0.6 },
  },
};

// --- Shapes -------------------------------------------------------------------------------------

/** An aerofoil as points round its outline: u back from the leading edge (0 to 1), v up (thickness 1) */
const FOIL: Array<[number, number]> = [
  [0, 0], [0.02, 0.32], [0.08, 0.62], [0.2, 0.9], [0.38, 1], [0.6, 0.82], [0.82, 0.45], [1, 0.06],
  [1, -0.02], [0.82, -0.12], [0.6, -0.26], [0.38, -0.36], [0.2, -0.38], [0.08, -0.3], [0.02, -0.18],
];

/** Rings of points joined into a closed skin, the two end rings capped */
function loft(rings: THREE.Vector3[][]): THREE.BufferGeometry {
  const pos: number[] = [];
  const n = rings[0].length;
  const tri = (a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3) => pos.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z);
  for (let r = 0; r < rings.length - 1; r++) {
    for (let i = 0; i < n; i++) {
      const a = rings[r][i], b = rings[r][(i + 1) % n], c = rings[r + 1][(i + 1) % n], d = rings[r + 1][i];
      tri(a, b, c);
      tri(a, c, d);
    }
  }
  for (const [ring, flip] of [[rings[0], true], [rings[rings.length - 1], false]] as const) {
    for (let i = 1; i < n - 1; i++) (flip ? tri(ring[0], ring[i + 1], ring[i]) : tri(ring[0], ring[i], ring[i + 1]));
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array((pos.length / 3) * 2), 2));
  g.computeVertexNormals();
  return g;
}

/** A wing, a tailplane half or a winglet: aerofoil sections from root to tip, on one side (side = +1 or -1 in z) */
function liftingSurface(L: number, s: Surface, side: number, centreY: number): THREE.BufferGeometry {
  const rings: THREE.Vector3[][] = [];
  const steps = 3;
  for (let k = 0; k <= steps; k++) {
    const f = k / steps;
    const span = s.span * f;
    const chord = s.rootChord + (s.tipChord - s.rootChord) * f;
    const thick = s.thick * (1 - 0.72 * f);
    const le = L / 2 - (s.rootX + span * Math.tan(s.sweep));
    const y = centreY + s.y + span * Math.sin(s.dihedral);
    rings.push(FOIL.map(([u, v]) => new THREE.Vector3(le - u * chord, y + v * thick * 0.5, side * span)));
  }
  const g = loft(rings);
  if (side < 0) {
    // The mirror side winds the other way round
    const p = g.getAttribute('position');
    for (let i = 0; i < p.count; i += 3) {
      const x = p.getX(i + 1), y = p.getY(i + 1), z = p.getZ(i + 1);
      p.setXYZ(i + 1, p.getX(i + 2), p.getY(i + 2), p.getZ(i + 2));
      p.setXYZ(i + 2, x, y, z);
    }
    g.computeVertexNormals();
  }
  return g;
}

/** The fin: aerofoil sections stacked upward, the thickness across the aircraft */
function fin(L: number, sp: Spec): THREE.BufferGeometry {
  const f = sp.fin;
  const rings: THREE.Vector3[][] = [];
  for (let k = 0; k <= 3; k++) {
    const t = k / 3;
    const h = f.height * t;
    const chord = f.rootChord + (f.tipChord - f.rootChord) * t;
    const le = L / 2 - (f.rootX + h * Math.tan(f.sweep));
    const thick = f.thick * (1 - 0.5 * t);
    const base = sp.centreY + sp.radius * 0.55 + sp.tailRise * 0.6;
    rings.push(FOIL.map(([u, v]) => new THREE.Vector3(le - u * chord, base + h, v * thick * 0.5)));
  }
  return loft(rings);
}

/** A turned shape round the x axis from (radius, along) points, front at x = 0 going toward -x */
function turned(profile: Array<[number, number]>, segments = 24): THREE.BufferGeometry {
  const g = new THREE.LatheGeometry(profile.map(([r, a]) => new THREE.Vector2(r, -a)), segments, Math.PI / 2);
  g.rotateZ(-Math.PI / 2);
  return g;
}

function cylinderZ(r: number, len: number, x: number, y: number, z: number, seg = 16): THREE.BufferGeometry {
  const g = new THREE.CylinderGeometry(r, r, len, seg);
  g.rotateX(Math.PI / 2);
  g.translate(x, y, z);
  return g;
}

function cylinderY(r: number, len: number, x: number, y: number, z: number, seg = 8): THREE.BufferGeometry {
  const g = new THREE.CylinderGeometry(r, r, len, seg);
  g.translate(x, y + len / 2, z);
  return g;
}

const plain = (g: THREE.BufferGeometry): THREE.BufferGeometry => {
  const f = g.index ? g.toNonIndexed() : g;
  if (!f.getAttribute('uv')) f.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(f.getAttribute('position').count * 2), 2));
  if (f.getAttribute('uv2')) f.deleteAttribute('uv2');
  return f;
};
const merge = (list: THREE.BufferGeometry[]): THREE.BufferGeometry => mergeGeometries(list.map(plain), false)!;

// --- The livery ---------------------------------------------------------------------------------

/**
 * The paint on the fuselage, as a picture wrapped round it: across the picture is round the body
 * (0 under the belly, a quarter the left side, a half the top, three quarters the right side), down
 * the picture is along it (the nose at the bottom row)
 */
function liveryMap(sp: Spec, lv: Livery): THREE.CanvasTexture {
  const W = 512, H = 2048;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const g = c.getContext('2d')!;
  const L = sp.length;
  const circ = Math.PI * 2 * sp.radius;
  const row = (along: number) => H - (along / L) * H;
  const mPerRow = L / H;
  const mPerCol = circ / W;
  /** The column at an angle down from the top, on the left (-1) or right (+1) side */
  const col = (fromTop: number, side: number) => (0.5 + (side * fromTop) / (Math.PI * 2)) * W;
  g.fillStyle = '#f7f8f8';
  g.fillRect(0, 0, W, H);
  // A grey belly
  g.fillStyle = '#cfd5db';
  g.fillRect(0, 0, W * 0.1, H);
  g.fillRect(W * 0.9, 0, W * 0.1, H);
  for (const side of [-1, 1]) {
    // The cheatline under the windows, with its thin second line
    const a = col(1.62, side), b = col(1.78, side);
    g.fillStyle = lv.main;
    g.fillRect(Math.min(a, b), row(L - 4), Math.abs(b - a), row(3.2) - row(L - 4));
    const c1 = col(1.84, side), c2 = col(1.88, side);
    g.fillStyle = lv.accent;
    g.fillRect(Math.min(c1, c2), row(L - 4), Math.abs(c2 - c1), row(3.2) - row(L - 4));
    // Windows: small rounded panes in a row along each side
    const wy = col(1.3, side);
    const wh = 0.34 / mPerCol;
    const ww = 0.27 / mPerRow;
    g.fillStyle = '#1d2733';
    for (let a2 = sp.windows.from; a2 <= sp.windows.to; a2 += sp.windows.pitch) {
      if (Math.abs(a2 - (sp.wing.rootX + 3)) < 0.3) continue; // the overwing exits
      const y = row(a2);
      g.beginPath();
      g.roundRect(wy - wh / 2, y - ww / 2, wh, ww, Math.min(wh, ww) * 0.45);
      g.fill();
    }
    // The doors, outlined, with their small windows
    g.strokeStyle = '#8a939c';
    g.lineWidth = 3;
    for (const d of [sp.doors.l1, sp.doors.l2]) {
      // The sill a little over half a radius below the centre line (where the stairs meet it)
      const top = col(2.15 - sp.doors.height / sp.radius, side), bottom = col(2.15, side);
      const y = row(d);
      const dw = 0.9 / mPerRow;
      g.beginPath();
      g.roundRect(Math.min(top, bottom), y - dw / 2, Math.abs(bottom - top), dw, 10);
      g.stroke();
      g.fillStyle = '#1d2733';
      g.fillRect(wy - wh * 0.4, y - ww * 0.4, wh * 0.8, ww * 0.8);
    }
    // The cockpit glass: a band of three panes each side round the top of the nose, white frames between
    g.fillStyle = '#141b23';
    const glassAt = sp.noseLen * 0.36;
    const panes: Array<[number, number, number]> = [[0.04, 0.42, 0.0], [0.48, 0.86, 0.12], [0.92, 1.22, 0.3]];
    for (const [a0, a1, back] of panes) {
      const x0 = col(a0, side), x1 = col(a1, side);
      g.beginPath();
      g.moveTo(x0, row(glassAt + back));
      g.lineTo(x1, row(glassAt + back + 0.05));
      g.lineTo(x1, row(glassAt + back + 0.62));
      g.lineTo(x0, row(glassAt + back + 0.55));
      g.closePath();
      g.fill();
    }
    // The airline's name along the upper body, reading nose to tail on the left and tail to nose on the right
    g.save();
    g.translate(col(0.9, side), row(L * 0.42));
    g.rotate(side < 0 ? Math.PI / 2 : -Math.PI / 2);
    g.scale(1, mPerRow / mPerCol);
    g.fillStyle = lv.text;
    g.font = `bold ${Math.round(0.9 / mPerRow)}px Georgia, serif`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(lv.name, 0, 0);
    g.restore();
    g.save();
    g.translate(col(1.05, side), row(L - 6.2));
    g.rotate(side < 0 ? Math.PI / 2 : -Math.PI / 2);
    g.scale(1, mPerRow / mPerCol);
    g.fillStyle = '#334155';
    g.font = `bold ${Math.round(0.42 / mPerRow)}px Arial, sans-serif`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(lv.reg, 0, 0);
    g.restore();
  }
  // The nose cone, a touch greyer
  g.fillStyle = 'rgba(120,130,140,0.25)';
  g.fillRect(0, row(0.9), W, H - row(0.9));
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

/** The airline's emblem on the tail: a gold circle with a bird in it, on both sides */
function tailMark(lv: Livery): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d')!;
  g.fillStyle = lv.accent;
  g.beginPath();
  g.arc(128, 128, 110, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = '#ffffff';
  g.beginPath();
  g.moveTo(40, 150);
  g.quadraticCurveTo(110, 70, 220, 60);
  g.quadraticCurveTo(140, 110, 120, 190);
  g.quadraticCurveTo(100, 150, 40, 150);
  g.fill();
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// --- The aircraft ---------------------------------------------------------------------------------

const shared = {
  // Two-sided: the aerofoil skins are lofted by hand, and either face shades correctly this way
  white: new THREE.MeshStandardMaterial({ color: 0xf3f4f6, roughness: 0.35, metalness: 0.15, name: 'airframe', side: THREE.DoubleSide }),
  grey: new THREE.MeshStandardMaterial({ color: 0xb8c0c8, roughness: 0.4, metalness: 0.55, name: 'airframe metal' }),
  dark: new THREE.MeshStandardMaterial({ color: 0x1b1f24, roughness: 0.6, metalness: 0.2, name: 'airframe dark' }),
  tyre: new THREE.MeshStandardMaterial({ color: 0x111214, roughness: 0.9, metalness: 0, name: 'tyres' }),
  red: new THREE.MeshBasicMaterial({ color: 0xff2a2a }),
  green: new THREE.MeshBasicMaterial({ color: 0x22ff66 }),
};
const tails = new Map<number, THREE.MeshStandardMaterial>();

export interface AirlinerHandle {
  group: THREE.Group;
  /** The flashing beacons (top and belly) and the propellers, for the caller to animate */
  beacons: THREE.Mesh[];
  props: THREE.Object3D[];
  spec: { length: number; doorSill: number; l1: number; radius: number; span: number };
}

export function buildAirliner(type: AirlinerType, livery: Livery, opts: { airstair?: boolean } = {}): AirlinerHandle {
  const sp = SPECS[type];
  const L = sp.length;
  const group = new THREE.Group();
  group.name = `airliner ${type} ${livery.reg}`;
  const xAt = (along: number) => L / 2 - along;

  // The fuselage: turned from its outline, the tail swept up, the nose dropped a little
  const r = sp.radius;
  const prof: Array<[number, number]> = [
    [0.02, 0], [r * 0.2, 0.22], [r * 0.38, 0.62], [r * 0.55, 1.15], [r * 0.7, 1.8], [r * 0.83, 2.6], [r * 0.93, 3.6], [r * 0.985, sp.noseLen * 0.82], [r, sp.noseLen],
    [r, L - sp.tailLen], [r * 0.93, L - sp.tailLen * 0.72], [r * 0.74, L - sp.tailLen * 0.45], [r * 0.46, L - sp.tailLen * 0.2], [r * 0.2, L - 0.4], [0.06, L],
  ];
  const body = new THREE.LatheGeometry(prof.map(([rad, a]) => new THREE.Vector2(rad, -a)), 40, Math.PI / 2);
  body.rotateZ(-Math.PI / 2);
  body.translate(L / 2, 0, 0);
  const p = body.getAttribute('position');
  const uv = body.getAttribute('uv');
  for (let i = 0; i < p.count; i++) {
    const along = L / 2 - p.getX(i);
    let y = p.getY(i);
    const tail = along - (L - sp.tailLen);
    if (tail > 0) y += sp.tailRise * Math.pow(tail / sp.tailLen, 1.5) * (1 - 0.35 * (y / r));
    if (along < sp.noseLen) y -= 0.28 * r * Math.pow(1 - along / sp.noseLen, 2);
    p.setY(i, y + sp.centreY);
    uv.setY(i, along / L);
  }
  body.computeVertexNormals();
  const paint = new THREE.MeshStandardMaterial({ map: liveryMap(sp, livery), roughness: 0.45, metalness: 0.05, name: `livery ${livery.reg}` });
  const fuselage = new THREE.Mesh(body, paint);
  fuselage.name = 'fuselage';
  group.add(fuselage);

  // Wings, tailplane and the wing-to-body fairing, in the airframe's white and metal
  const frame: THREE.BufferGeometry[] = [];
  const metal: THREE.BufferGeometry[] = [];
  const dark: THREE.BufferGeometry[] = [];
  const tyres: THREE.BufferGeometry[] = [];
  for (const side of [-1, 1]) {
    frame.push(liftingSurface(L, sp.wing, side, sp.centreY));
    frame.push(liftingSurface(L, sp.stab, side, sp.centreY + (sp.engines === 'wing' ? sp.tailRise * 0.5 : 0)));
    // Winglets on the jets, raked up at the tips
    if (type !== 'atr') {
      const w = sp.wing;
      const tipLe = L / 2 - (w.rootX + w.span * Math.tan(w.sweep));
      const tipY = sp.centreY + w.y + w.span * Math.sin(w.dihedral);
      const rings: THREE.Vector3[][] = [];
      for (let k = 0; k <= 2; k++) {
        const t = k / 2;
        const chord = w.tipChord * (1 - 0.55 * t);
        const h = (type === '737' ? 2.4 : 1.3) * t;
        rings.push(FOIL.map(([u, v]) => new THREE.Vector3(tipLe - 0.2 - h * 0.6 - u * chord, tipY + h, side * (w.span + 0.15 * t) + v * 0.06)));
      }
      frame.push(loft(rings));
    }
  }
  // The belly fairing where the wing meets the body
  const fair = new THREE.SphereGeometry(1, 20, 10);
  fair.scale(sp.wing.rootChord * 0.75, r * 0.42, r * 0.9);
  fair.translate(xAt(sp.wing.rootX + sp.wing.rootChord * 0.55), sp.centreY - r * 0.62 + (type === 'atr' ? r * 1.25 : 0), 0);
  frame.push(fair);

  // Engines
  const props: THREE.Object3D[] = [];
  const e = sp.engine;
  const nacelleProfile: Array<[number, number]> = sp.engines === 'prop'
    ? [[0.12, 0], [0.32, 0.2], [0.5, 0.8], [0.55, 1.6], [0.5, 3.6], [0.3, e.length]]
    : [[e.radius * 0.8, 0], [e.radius * 0.95, 0.12], [e.radius, 0.6], [e.radius * 0.98, e.length * 0.55], [e.radius * 0.8, e.length * 0.85], [e.radius * 0.6, e.length]];
  for (const side of [-1, 1]) {
    const ex = xAt(e.x);
    const ey = sp.centreY + e.y;
    const ez = side * e.z;
    const nac = turned(nacelleProfile, 28);
    nac.translate(ex, ey, ez);
    frame.push(nac);
    if (sp.engines !== 'prop') {
      // The fan face deep in the intake, its spinner, and the hot exhaust cone at the back
      const fan = new THREE.CircleGeometry(e.radius * 0.82, 24);
      fan.rotateY(Math.PI / 2);
      fan.translate(ex - 0.35, ey, ez);
      dark.push(fan);
      const spinner = new THREE.ConeGeometry(e.radius * 0.26, e.radius * 0.5, 16);
      spinner.rotateZ(-Math.PI / 2);
      spinner.translate(ex - 0.2, ey, ez);
      metal.push(spinner);
      const cone = new THREE.ConeGeometry(e.radius * 0.42, e.radius * 1.1, 16);
      cone.rotateZ(Math.PI / 2);
      cone.translate(ex - e.length - e.radius * 0.45, ey, ez);
      metal.push(cone);
      // The pylon up to the wing, or in to the tail
      if (sp.engines === 'wing') {
        const py = new THREE.BoxGeometry(e.length * 0.9, 1.1, 0.3);
        py.translate(ex - e.length * 0.55, ey + e.radius + 0.25, ez);
        frame.push(py);
      } else {
        const py = new THREE.BoxGeometry(e.length * 0.6, 0.35, Math.abs(e.z) - r * 0.7);
        py.translate(ex - e.length * 0.5, ey, side * (r * 0.7 + (Math.abs(e.z) - r * 0.7) / 2));
        frame.push(py);
      }
    } else {
      // A six-bladed propeller on its spinner
      const prop = new THREE.Group();
      prop.position.set(ex + 0.12, ey + 0.05, ez);
      const spin = new THREE.Mesh(new THREE.ConeGeometry(0.28, 0.7, 16).rotateZ(-Math.PI / 2), shared.dark);
      spin.position.x = 0.2;
      prop.add(spin);
      for (let b = 0; b < 6; b++) {
        const blade = new THREE.Mesh(new THREE.BoxGeometry(0.06, 1.95, 0.2), shared.dark);
        blade.position.y = 1.0;
        const holder = new THREE.Group();
        holder.rotation.x = (b / 6) * Math.PI * 2;
        blade.rotation.y = 0.35;
        holder.add(blade);
        prop.add(holder);
      }
      group.add(prop);
      props.push(prop);
    }
  }

  // The fin
  const tailMat = tails.get(livery.tail) ?? new THREE.MeshStandardMaterial({ color: livery.tail, roughness: 0.35, metalness: 0.1, name: 'tail paint', side: THREE.DoubleSide });
  tails.set(livery.tail, tailMat);
  const finMesh = new THREE.Mesh(fin(L, sp), tailMat);
  finMesh.name = 'fin';
  group.add(finMesh);
  const mark = new THREE.MeshBasicMaterial({ map: tailMark(livery), transparent: true, toneMapped: false });
  const fx = xAt(sp.fin.rootX + sp.fin.height * 0.55 * Math.tan(sp.fin.sweep) + sp.fin.rootChord * 0.42);
  const fy = sp.centreY + r * 0.55 + sp.tailRise * 0.6 + sp.fin.height * 0.48;
  for (const side of [-1, 1]) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(sp.fin.height * 0.42, sp.fin.height * 0.42), mark);
    m.position.set(fx, fy, side * (sp.fin.thick * 0.32 + 0.02));
    if (side < 0) m.rotation.y = Math.PI;
    group.add(m);
  }

  // Landing gear: the nose leg with two wheels, the mains under the wing roots
  const ground = (wheelR: number) => wheelR;
  const nx = xAt(sp.gear.nose);
  const belly = sp.centreY - r * 0.85;
  metal.push(cylinderY(0.09, belly - ground(sp.gear.wheel * 0.8), nx, sp.gear.wheel * 0.8, 0));
  for (const z of [-0.22, 0.22]) tyres.push(cylinderZ(sp.gear.wheel * 0.8, 0.22, nx, sp.gear.wheel * 0.8, z, 18));
  const mx = xAt(sp.gear.main);
  const legTop = type === 'atr' ? sp.centreY - r * 0.4 : sp.centreY + sp.wing.y;
  for (const side of [-1, 1]) {
    const z = side * sp.gear.track;
    metal.push(cylinderY(0.14, legTop - sp.gear.wheel, mx, sp.gear.wheel, z));
    for (const dx of type === '737' ? [0] : [0]) {
      for (const dz of [-0.32, 0.32]) tyres.push(cylinderZ(sp.gear.wheel, 0.3, mx + dx, sp.gear.wheel, z + dz, 20));
    }
    if (type === 'atr') {
      // The ATR's mains fold into pods on the lower body
      const pod = new THREE.SphereGeometry(1, 14, 8);
      pod.scale(2.2, 0.7, 0.55);
      pod.translate(mx, sp.centreY - r * 0.55, side * (r * 0.9));
      frame.push(pod);
    }
  }

  // The CRJ's airstair, folded down from the front door
  if (opts.airstair) {
    const sill = sp.centreY - r * 0.55;
    const run = 1.8;
    const steps = 7;
    const ax = xAt(sp.doors.l1);
    for (let i = 0; i < steps; i++) {
      const t = i / steps;
      const st = new THREE.BoxGeometry(0.85, 0.05, 0.3);
      st.translate(ax, sill * (1 - t) - 0.02, -(r + 0.05 + run * t));
      metal.push(st);
    }
    for (const dx of [-0.45, 0.45]) {
      const rail = new THREE.BoxGeometry(0.04, 0.04, Math.hypot(run, sill));
      rail.rotateX(-Math.atan2(sill, run));
      rail.translate(ax + dx, sill / 2 + 0.85, -(r + 0.05 + run / 2));
      dark.push(rail);
    }
  }

  const add = (geos: THREE.BufferGeometry[], mat: THREE.Material, name: string) => {
    if (!geos.length) return;
    const m = new THREE.Mesh(merge(geos), mat);
    m.name = name;
    group.add(m);
  };
  add(frame, shared.white, 'wings and engines');
  add(metal, shared.grey, 'metal');
  add(dark, shared.dark, 'dark parts');
  add(tyres, shared.tyre, 'tyres');

  // Lights: the red beacons on top and under the belly, red and green at the wingtips
  const beacons: THREE.Mesh[] = [];
  for (const [y, name] of [[sp.centreY + r + 0.05, 'beacon top'], [sp.centreY - r - 0.05, 'beacon belly']] as const) {
    const b = new THREE.Mesh(new THREE.SphereGeometry(0.11, 10, 6), shared.red.clone());
    b.position.set(xAt(sp.wing.rootX + 2), y, 0);
    b.name = name;
    group.add(b);
    beacons.push(b);
  }
  const w = sp.wing;
  const tipX = xAt(w.rootX + w.span * Math.tan(w.sweep) + w.tipChord * 0.2);
  const tipY = sp.centreY + w.y + w.span * Math.sin(w.dihedral);
  const navL = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 6), shared.red);
  navL.position.set(tipX, tipY, -(w.span + 0.1));
  const navR = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 6), shared.green);
  navR.position.set(tipX, tipY, w.span + 0.1);
  group.add(navL, navR);

  group.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.isMesh) {
      m.castShadow = false;
      m.receiveShadow = false;
    }
  });
  return {
    group,
    beacons,
    props,
    spec: { length: L, doorSill: sp.centreY - r * 0.55, l1: sp.doors.l1, radius: r, span: w.span },
  };
}
