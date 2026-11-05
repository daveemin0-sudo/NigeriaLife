import * as THREE from 'three';
import { Builder } from '../kit/ArchKit';

/**
 * A private jet and a motor yacht, drawn to the model's length, in the owner's colour, with
 * the owner's name painted on: on the jet's flank behind the door, on the yacht's sides and
 * across its stern. The jet's nose and the yacht's bow point toward +x.
 */

function nameplate(text: string, width: number, height: number, ink: string, ground: string | null): THREE.Mesh {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = Math.max(48, Math.round((512 * height) / width));
  const ctx = canvas.getContext('2d')!;
  if (ground) {
    ctx.fillStyle = ground;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
  ctx.fillStyle = ink;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `800 italic ${Math.round(canvas.height * 0.7)}px Outfit Variable, Arial, sans-serif`;
  ctx.fillText(text, canvas.width / 2, canvas.height * 0.54, canvas.width - 16);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return new THREE.Mesh(new THREE.PlaneGeometry(width, height), new THREE.MeshBasicMaterial({ map: texture, transparent: !ground, toneMapped: false }));
}

const ink = (hex: number) => (new THREE.Color(hex).getHSL({ h: 0, s: 0, l: 0 }).l > 0.55 ? '#0f172a' : '#f8fafc');

export function buildJet(length: number, paint: number, name: string): THREE.Group {
  const L = length;
  const r = L * 0.055;
  const y = r + L * 0.07;
  const b = new Builder();
  const white = 0xf8fafc;
  const body = paint;
  const trim = paint === white ? 0xd4af37 : white;
  // Fuselage: cabin, nose and tail cone
  b.tube(body, r, r, L * 0.6, L * 0.02, y, 0);
  b.tube(body, r, r * 0.35, L * 0.17, L * 0.405, y - r * 0.1, 0);
  b.tube(0x1f2937, r * 0.35, r * 0.12, L * 0.04, L * 0.51, y - r * 0.12, 0);
  b.tube(body, r * 0.3, r, L * 0.22, -L * 0.39, y + r * 0.15, 0);
  // Windscreen and cabin windows
  b.box(0x0f172a, L * 0.05, r * 0.45, r * 1.5, L * 0.36, y + r * 0.35, 0, { pitch: 0 });
  for (let i = 0; i < Math.round(L / 2.4); i++) {
    for (const side of [-1, 1]) b.box(0x0f172a, r * 0.42, r * 0.38, 0.05, L * 0.24 - i * L * 0.055, y + r * 0.2, side * r * 0.99);
  }
  // A stripe along each side
  b.box(trim, L * 0.78, r * 0.14, r * 2.02, -L * 0.02, y - r * 0.35, 0);
  // Wings, swept, with winglets
  for (const side of [-1, 1]) {
    b.box(0xe5e7eb, L * 0.14, r * 0.22, L * 0.44, -L * 0.04, y - r * 0.55, side * L * 0.23, { yaw: side * -0.32 });
    b.box(body, L * 0.06, L * 0.06, 0.12, -L * 0.13, y - r * 0.4, side * L * 0.445, { roll: side * 0.25 });
  }
  // Engines on the tail
  for (const side of [-1, 1]) {
    b.box(0xcbd5e1, L * 0.05, r * 0.25, r * 0.7, -L * 0.25, y + r * 0.35, side * r * 1.15);
    b.tube(white, r * 0.42, r * 0.38, L * 0.18, -L * 0.27, y + r * 0.45, side * r * 1.75);
    b.tube(0x1f2937, r * 0.36, r * 0.36, L * 0.01, -L * 0.18, y + r * 0.45, side * r * 1.75);
  }
  // T-tail
  b.box(body, L * 0.13, L * 0.17, 0.2, -L * 0.45, y + r * 0.6, 0, { roll: 0 , pitch: 0 });
  b.box(trim, L * 0.04, L * 0.17, 0.22, -L * 0.42, y + r * 0.6, 0);
  b.box(0xe5e7eb, L * 0.09, 0.14, L * 0.24, -L * 0.5, y + r * 0.6 + L * 0.17, 0);
  // Landing gear
  b.cylinder(0x6b7280, 0.08, y - r, L * 0.33, 0, 0).cylinder(0x111827, r * 0.25, 0.25, L * 0.33, 0, 0);
  for (const side of [-1, 1]) b.cylinder(0x6b7280, 0.1, y - r, -L * 0.06, 0, side * r * 1.6).cylinder(0x111827, r * 0.3, 0.3, -L * 0.06, 0, side * r * 1.6);
  // Lights
  b.box(0xef4444, 0.2, 0.2, 0.2, -L * 0.13, y - r * 0.1, L * 0.45, { glow: true }).box(0x22c55e, 0.2, 0.2, 0.2, -L * 0.13, y - r * 0.1, -L * 0.45, { glow: true });
  const jet = b.build('private jet');
  // The name, on both flanks behind the door, and up the fin
  for (const side of [-1, 1]) {
    const plate = nameplate(name, L * 0.3, r * 0.6, ink(body), null);
    plate.position.set(-L * 0.1, y + r * 0.35 - r * 0.5, side * (r * 1.02));
    plate.rotation.y = side > 0 ? 0 : Math.PI;
    jet.add(plate);
  }
  jet.userData.length = L;
  return jet;
}

/** A hull pointed at the bow, as a plan pushed up to its height */
function hull(length: number, beam: number, height: number, colour: number): THREE.Mesh {
  const shape = new THREE.Shape();
  const half = beam / 2;
  shape.moveTo(-length / 2, -half * 0.92);
  shape.lineTo(length * 0.18, -half);
  shape.quadraticCurveTo(length * 0.42, -half * 0.8, length / 2, 0);
  shape.quadraticCurveTo(length * 0.42, half * 0.8, length * 0.18, half);
  shape.lineTo(-length / 2, half * 0.92);
  shape.lineTo(-length / 2, -half * 0.92);
  const geometry = new THREE.ExtrudeGeometry(shape, { depth: height, bevelEnabled: true, bevelThickness: 0.2, bevelSize: 0.15, bevelSegments: 2, curveSegments: 10 });
  geometry.rotateX(-Math.PI / 2);
  const mesh = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ color: colour, metalness: 0.3, roughness: 0.3 }));
  return mesh;
}

export function buildYacht(length: number, paint: number, name: string): THREE.Group {
  const L = length;
  const beam = L * 0.24;
  const h = L * 0.11;
  const group = new THREE.Group();
  const hullMesh = hull(L, beam, h, paint);
  group.add(hullMesh);
  const b = new Builder();
  const white = 0xf8fafc;
  // The deck, a waterline stripe, and the superstructure in steps
  b.box(0xd6b47c, L * 0.62, 0.1, beam * 0.86, -L * 0.04, h, 0);
  b.box(0x1e293b, L * 0.9, h * 0.08, beam * 1.01, -L * 0.04, h * 0.25, 0);
  const decks = L > 25 ? 3 : L > 14 ? 2 : 1;
  for (let d = 0; d < decks; d++) {
    const len = L * (0.5 - d * 0.12);
    const w = beam * (0.8 - d * 0.1);
    const at = -L * 0.06 - d * L * 0.02;
    const yy = h + 0.1 + d * 2.2;
    b.box(white, len, 2.1, w, at, yy, 0);
    b.box(0x0f172a, len * 0.9, 0.7, w + 0.04, at + len * 0.03, yy + 0.8, 0);
  }
  // A radar arch and a sun deck at the top, rails round the bow
  const top = h + 0.1 + decks * 2.2;
  b.box(white, 0.3, 1.6, beam * 0.6, -L * 0.18, top, 0).box(white, 1.2, 0.2, beam * 0.6, -L * 0.18, top + 1.6, 0);
  b.box(0x9ca3af, L * 0.3, 0.6, 0.06, L * 0.28, h + 0.1, beam * 0.4).box(0x9ca3af, L * 0.3, 0.6, 0.06, L * 0.28, h + 0.1, -beam * 0.4);
  if (L > 30) b.box(0x38bdf8, L * 0.12, 0.3, beam * 0.5, -L * 0.42, h + 0.05, 0); // a pool on the stern
  group.add(b.build('yacht top'));
  // The name on the stern and both sides
  const plate = nameplate(name, beam * 0.8, beam * 0.2, ink(paint), null);
  plate.position.set(-L / 2 - 0.22, h * 0.6, 0);
  plate.rotation.y = -Math.PI / 2;
  group.add(plate);
  for (const side of [-1, 1]) {
    const flank = nameplate(name, L * 0.25, beam * 0.16, ink(paint), null);
    flank.position.set(L * 0.2, h * 0.62, side * (beam / 2 + 0.16));
    flank.rotation.y = side > 0 ? 0 : Math.PI;
    group.add(flank);
  }
  group.userData.deck = h + 0.15;
  // The sun deck on the top, where the owner stands to be seen
  group.userData.top = top + 0.2;
  group.userData.length = L;
  return group;
}
