import * as THREE from 'three';
import { Builder, signBoard } from '../world/kit/ArchKit';
import type { Obstruction, Rect } from '../world/plan/CityPlan';

/**
 * The compound round a finished house: what every house on a good street in Lagos has.
 *
 * A front fence of rendered wall and black iron railings with gold spear tips, square pillars
 * with lanterns on the gate posts, a sliding iron gate wide enough for a car, a pedestrian
 * wicket beside it, rendered walls with an electric wire round the sides and back, a lawn,
 * an interlocking-paver drive from the gate to the front door with garden lights along it, a
 * gatehouse where there is room, palms, and a flower bed between the fence and the street.
 *
 * Everything is laid out in the plot's own frame (u along the street, v in from the street)
 * and turned into the city's coordinates at the end, so the same drawing serves a plot facing
 * any way. Walls, pillars and the gatehouse are solid; the gate is solid while it is shut.
 */

export interface CompoundOptions {
  plotName: string;
  subtitle: string;
  /** The plot's boundary, its street edge's middle, and the step from its centre toward the street */
  rect: Rect;
  front: { x: number; z: number };
  facing: { dx: number; dz: number };
  /** The house on it */
  house: Rect;
  seed: number;
}

export interface CompoundDrawing {
  group: THREE.Group;
  /** The sliding leaf: moved by the owner of the drawing */
  leaf: THREE.Group;
  /** Where the leaf stands shut, and the world step it slides when fully open */
  leafShut: THREE.Vector3;
  leafSlide: THREE.Vector3;
  /** The leaf as an obstruction while it is shut */
  leafSolid: Obstruction;
  /** The gateway: nothing may stand in it when the gate is shut */
  gateway: Rect;
  /** The middle of the gateway on the fence line, and a point in the street before it */
  centre: THREE.Vector3;
  outside: THREE.Vector3;
  /** Where a gateman stands, and the way he faces */
  post: { x: number; z: number; yaw: number };
  /** Walls, pillars, the gatehouse: always solid */
  fixed: Obstruction[];
}

const WALL = 0xf1e7d3;
const COPING = 0xd9cdb4;
const PLINTH = 0x9c917f;
const IRON = 0x15171c;
const GOLD = 0xc9a34e;
const LAMP = 0xffe7a3;
const LAWN = 0x5d8f3a;
const SOIL = 0x3a2a1c;
const BRICK = 0xa2553a;
const LEAF = 0x2e6b2b;
const LEAF_DARK = 0x1f4f22;
const BLOOMS = [0xd7263d, 0xc2185b, 0xf48fb1, 0xf6c90e, 0xfaf7ef, 0xf57c00, 0x8e5bd0];

/** Interlocking pavers, as they are laid in Lagos drives: warm grey with a charcoal border course */
function paverTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#5b5852';
  ctx.fillRect(0, 0, 256, 256);
  const tones = ['#a39d92', '#9a9387', '#b0a99d', '#8f897e', '#a8957f'];
  let n = 7;
  const rnd = () => ((n = (n * 16807) % 2147483647) / 2147483647);
  // Herringbone: pairs of bricks, one along and one across, stepping diagonally
  const bw = 32;
  const bh = 16;
  for (let row = -2; row < 18; row++) {
    for (let col = -2; col < 10; col++) {
      const ox = col * bw + row * bh;
      const oy = row * bh - col * bh;
      ctx.fillStyle = tones[Math.floor(rnd() * tones.length)];
      ctx.fillRect(ox + 1, oy + 1, bw - 2, bh - 2);
      ctx.fillStyle = tones[Math.floor(rnd() * tones.length)];
      ctx.fillRect(ox + bw + 1 - bh, oy + bh + 1 - bh, bh - 2, bw - 2);
    }
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.anisotropy = 4;
  return texture;
}

export function drawCompound(o: CompoundOptions): CompoundDrawing {
  const { rect, front, facing, house } = o;
  const { dx, dz } = facing;
  const alongX = dz !== 0;
  const A = alongX ? { x: 1, z: 0 } : { x: 0, z: 1 };
  const I = { x: -dx, z: -dz };
  const W = alongX ? rect.maxX - rect.minX : rect.maxZ - rect.minZ;
  const D = alongX ? rect.maxZ - rect.minZ : rect.maxX - rect.minX;
  const at = (u: number, v: number) => ({ x: front.x + A.x * u + I.x * v, z: front.z + A.z * u + I.z * v });
  const local = (x: number, z: number) => ({ u: (x - front.x) * A.x + (z - front.z) * A.z, v: (x - front.x) * I.x + (z - front.z) * I.z });
  const dims = (lu: number, lv: number): [number, number] => (alongX ? [lu, lv] : [lv, lu]);
  const box = (b: Builder, hex: number, lu: number, h: number, lv: number, u: number, y: number, v: number, opts: { glow?: boolean; yaw?: number; pitch?: number } = {}) => {
    const p = at(u, v);
    const [w, d] = dims(lu, lv);
    b.box(hex, w, h, d, p.x, y, p.z, opts);
  };
  const rectOf = (u0: number, u1: number, v0: number, v1: number): Rect => {
    const a = at(u0, v0);
    const c = at(u1, v1);
    return { minX: Math.min(a.x, c.x), maxX: Math.max(a.x, c.x), minZ: Math.min(a.z, c.z), maxZ: Math.max(a.z, c.z) };
  };
  const solid = (owner: string, height: number, u0: number, u1: number, v0: number, v1: number): Obstruction => ({ owner, structure: false, height, ...rectOf(u0, u1, v0, v1) });

  // The house in the plot's frame
  const h0 = local(house.minX, house.minZ);
  const h1 = local(house.maxX, house.maxZ);
  const hu0 = Math.min(h0.u, h1.u);
  const hu1 = Math.max(h0.u, h1.u);
  const hv0 = Math.min(h0.v, h1.v);
  const hv1 = Math.max(h0.v, h1.v);
  const doorU = (hu0 + hu1) / 2;

  let rnd = (o.seed * 9301 + 49297) % 233280 || 1;
  const rand = () => ((rnd = (rnd * 9301 + 49297) % 233280) / 233280);

  // --- Layout -----------------------------------------------------------------------------------
  const s = 0.2; // the side and back walls stand just inside the boundary
  const uL = -W / 2 + s;
  const uR = W / 2 - s;
  const vBack = D - s;
  const t = 0.24; // wall thickness
  // The front fence is set back from the street edge to leave room for the flowers, and clear of the house
  const vf = Math.min(1.35, Math.max(0.6, hv0 - 1.1));
  const G = 4.4; // the gateway: a car with room to spare
  const P = 0.62; // gate pillars
  const p = 0.44; // fence pillars
  const wick = 1.1; // the pedestrian door
  const vLeaf = vf + t / 2 + 0.16; // the leaf runs on its rail just behind the fence line
  const afterGate = P + 0.3 + p + wick + p;
  let lo = uL + 0.3 + 1.5 * G;
  let hi = uR - 0.4 - G / 2 - afterGate;
  let wicket = true;
  if (lo > hi) {
    wicket = false;
    hi = uR - 0.3 - G / 2 - P;
  }
  if (lo > hi) lo = hi = (lo + hi) / 2;
  const ug = Math.min(hi, Math.max(lo, doorU));
  const gL = ug - G / 2;
  const gR = ug + G / 2;
  const wkL = gR + P + 0.3 + p; // the wicket's opening
  const wkR = wkL + wick;

  const b = new Builder();
  const fixed: Obstruction[] = [];
  const owner = `Compound at ${o.plotName}`;

  // --- The ground inside: lawn, and the drive -------------------------------------------------------
  {
    const p0 = at((uL + uR) / 2, (vf + vBack) / 2);
    const [w, d] = dims(uR - uL, vBack - vf);
    b.ground(LAWN, w, d, p0.x, 0.047, p0.z);
  }

  // --- The front fence --------------------------------------------------------------------------
  const pillar = (u: number, width: number, height: number, lantern: boolean) => {
    box(b, PLINTH, width + 0.08, 0.32, width + 0.08, u, 0, vf);
    box(b, WALL, width, height - 0.32, width, u, 0.32, vf);
    box(b, COPING, width + 0.14, 0.1, width + 0.14, u, height, vf);
    b.cone(COPING, (width + 0.06) * 0.72, 0.26, at(u, vf).x, height + 0.1, at(u, vf).z, 4, { yaw: Math.PI / 4 });
    if (lantern) {
      const y = height + 0.36;
      box(b, IRON, 0.3, 0.05, 0.3, u, y - 0.04, vf);
      box(b, LAMP, 0.2, 0.3, 0.2, u, y, vf, { glow: true });
      for (const cu of [-0.11, 0.11]) for (const cv of [-0.11, 0.11]) box(b, IRON, 0.03, 0.32, 0.03, u + cu, y, vf + cv);
      b.cone(IRON, 0.2, 0.16, at(u, vf).x, y + 0.3, at(u, vf).z, 4, { yaw: Math.PI / 4 });
      box(b, GOLD, 0.04, 0.1, 0.04, u, y + 0.46, vf);
    }
  };
  /** A run of fence between two pillars' faces: a stone plinth, rendered dwarf wall, and railings */
  const railing = (u0: number, u1: number) => {
    const len = u1 - u0;
    if (len <= 0.05) return;
    const mid = (u0 + u1) / 2;
    box(b, PLINTH, len, 0.3, t + 0.06, mid, 0, vf);
    box(b, WALL, len, 0.66, t, mid, 0.3, vf);
    box(b, COPING, len, 0.07, t + 0.1, mid, 0.96, vf);
    box(b, IRON, len, 0.05, 0.05, mid, 1.12, vf);
    box(b, IRON, len, 0.05, 0.05, mid, 2.02, vf);
    box(b, GOLD, len, 0.025, 0.055, mid, 1.86, vf);
    const bars = Math.max(1, Math.round(len / 0.13));
    for (let i = 0; i < bars; i++) {
      const u = u0 + ((i + 0.5) * len) / bars;
      box(b, IRON, 0.032, 1.16, 0.032, u, 1.03, vf);
      const tip = at(u, vf);
      b.cone(GOLD, 0.035, 0.12, tip.x, 2.18, tip.z, 4);
    }
  };
  /** A whole stretch of front fence, with pillars along it no further apart than 2.8 m */
  const fenceRun = (u0: number, u1: number, leftPillar: boolean, rightPillar: boolean) => {
    const posts: number[] = [];
    if (leftPillar) posts.push(u0 + p / 2);
    const inner0 = leftPillar ? u0 + p : u0;
    const inner1 = rightPillar ? u1 - p : u1;
    const bays = Math.max(1, Math.ceil((inner1 - inner0) / 2.8));
    for (let k = 1; k < bays; k++) posts.push(inner0 + ((inner1 - inner0) * k) / bays);
    if (rightPillar) posts.push(u1 - p / 2);
    posts.sort((a, c) => a - c);
    let from = u0;
    for (const post of posts) {
      railing(from, post - p / 2);
      pillar(post, p, 2.45, false);
      from = post + p / 2;
    }
    railing(from, u1);
  };

  // Left of the gate, to the corner
  fenceRun(uL, gL - P, true, false);
  pillar(gL - P / 2, P, 2.8, true);
  pillar(gR + P / 2, P, 2.8, true);
  fixed.push(solid(owner, 2.4, uL - t / 2, gL, vf - P / 2 - 0.05, vf + P / 2 + 0.05));
  if (wicket) {
    fenceRun(gR + P, wkL, false, true);
    // The wicket: an iron door in a frame, standing open a crack
    box(b, IRON, wick, 0.06, 0.06, (wkL + wkR) / 2, 2.15, vf);
    const leafU = wkL + 0.04;
    const door = new Builder();
    void door;
    for (let i = 0; i < 7; i++) box(b, IRON, 0.03, 1.95, 0.03, leafU + 0.08 + i * 0.13, 0.08, vf + 0.25 + i * 0.07);
    box(b, IRON, 0.04, 2.0, 0.04, leafU, 0.06, vf + 0.02);
    fenceRun(wkR, uR, true, false);
    fixed.push(solid(owner, 2.4, gR, wkL, vf - P / 2 - 0.05, vf + P / 2 + 0.05));
    fixed.push(solid(owner, 2.4, wkR, uR + t / 2, vf - P / 2 - 0.05, vf + P / 2 + 0.05));
  } else {
    fenceRun(gR + P, uR, false, false);
    fixed.push(solid(owner, 2.4, gR, uR + t / 2, vf - P / 2 - 0.05, vf + P / 2 + 0.05));
  }
  // The rail the gate runs on, and the stop
  box(b, 0x3f3f46, G * 2 + 0.6, 0.04, 0.12, gL - G / 2 + 0.2, 0.0, vLeaf);

  // The house's name, in gold on black granite, on the wall left of the gate
  const plate = signBoard([o.plotName.toUpperCase(), o.subtitle], 1.5, 0.46, '#0b0d12', '#e3bf6a');
  {
    const u = gL - P - 0.95;
    const q = at(u, vf - t / 2 - 0.035);
    plate.position.set(q.x, 0.64, q.z);
    plate.rotation.y = Math.atan2(dx, dz);
  }

  // --- The side and back walls, with an electric wire on top ----------------------------------------
  const wallRun = (u0: number, v0: number, u1: number, v1: number) => {
    const lu = Math.abs(u1 - u0) || t;
    const lv = Math.abs(v1 - v0) || t;
    const mu = (u0 + u1) / 2;
    const mv = (v0 + v1) / 2;
    box(b, PLINTH, lu + 0.04, 0.3, lv + 0.04, mu, 0, mv);
    box(b, WALL, lu, 2.1, lv, mu, 0.3, mv);
    box(b, COPING, lu + (lu > lv ? 0 : 0.1), 0.08, lv + (lv > lu ? 0 : 0.1), mu, 2.4, mv);
    const len = Math.max(lu, lv);
    const posts = Math.max(1, Math.round(len / 3.2));
    for (let k = 0; k <= posts; k++) {
      const f = k / posts;
      const u = u0 + (u1 - u0) * f;
      const v = v0 + (v1 - v0) * f;
      box(b, WALL, lu > lv ? 0.4 : 0.36, 2.48, lv > lu ? 0.4 : 0.36, u, 0, v);
      box(b, 0x52525b, 0.03, 0.45, 0.03, u, 2.48, v);
    }
    for (const y of [2.62, 2.76, 2.9]) box(b, 0x71717a, lu > lv ? lu : 0.012, 0.012, lv > lu ? lv : 0.012, mu, y, mv);
    fixed.push(solid(owner, 2.4, Math.min(u0, u1) - t / 2, Math.max(u0, u1) + t / 2, Math.min(v0, v1) - t / 2, Math.max(v0, v1) + t / 2));
  };
  wallRun(uL, vf, uL, vBack);
  wallRun(uR, vf, uR, vBack);
  wallRun(uL, vBack, uR, vBack);

  // --- The drive: pavers from the street edge to the front door, with lights along it ----------------
  const pavers: Array<{ u0: number; u1: number; v0: number; v1: number }> = [];
  const driveEnd = Math.max(vf + 1, hv0);
  pavers.push({ u0: gL + 0.1, u1: gR - 0.1, v0: 0.02, v1: driveEnd });
  // A forecourt before the door, joining the drive to it if the gate is not straight in front
  pavers.push({ u0: Math.min(gL + 0.1, hu0 + 0.4), u1: Math.max(gR - 0.1, hu1 - 0.4), v0: Math.max(vf + 0.5, driveEnd - 2.6), v1: driveEnd });
  if (wicket) pavers.push({ u0: wkL + 0.05, u1: wkR - 0.05, v0: 0.02, v1: Math.max(vf + 0.5, driveEnd - 2.6) });
  for (const k of [0.15, 0.85]) {
    const u = gL + 0.1 + (G - 0.2) * k;
    for (let v = vf + 1.2; v < driveEnd - 0.6; v += 2.4) {
      const q = at(u + (k < 0.5 ? -0.25 : 0.25), v);
      b.cylinder(0x27272a, 0.06, 0.42, q.x, 0.05, q.z, { sides: 8 });
      b.cylinder(LAMP, 0.075, 0.1, q.x, 0.47, q.z, { sides: 8, glow: true });
    }
  }

  // --- The gatehouse, where there is room: on the wicket side, inside -----------------------------
  let post = { x: at(wicket ? wkL + wick / 2 : gR + P + 0.6, vf + 0.9).x, z: at(wicket ? wkL + wick / 2 : gR + P + 0.6, vf + 0.9).z, yaw: Math.atan2(dx, dz) };
  {
    const gu0 = (wicket ? wkR : gR + P) + 0.35;
    const gu1 = gu0 + 1.6;
    const gv0 = vf + 0.45;
    const gv1 = gv0 + 1.6;
    const clearOfHouse = gu1 < hu0 - 0.3 || gu0 > hu1 + 0.3 || gv1 < hv0 - 0.3;
    if (gu1 < uR - 0.4 && gv1 < vBack - 0.4 && clearOfHouse) {
      const mu = (gu0 + gu1) / 2;
      const mv = (gv0 + gv1) / 2;
      box(b, PLINTH, 1.66, 0.2, 1.66, mu, 0, mv);
      box(b, WALL, 1.6, 2.2, 1.6, mu, 0.2, mv);
      box(b, 0x1e293b, 1.1, 0.7, 0.04, mu, 1.15, gv0 - 0.01); // window to the street side
      box(b, 0xfff3c4, 0.9, 0.5, 0.03, mu, 1.25, gv0 - 0.02, { glow: true });
      box(b, 0x5b3a1e, 0.04, 1.9, 0.75, gu0 - 0.01, 0.2, mv + 0.15); // its door, toward the gate
      box(b, COPING, 2.1, 0.14, 2.1, mu, 2.4, mv);
      box(b, 0x7f1d1d, 1.9, 0.08, 1.9, mu, 2.54, mv);
      fixed.push(solid(owner, 2.6, gu0, gu1, gv0, gv1));
      const stand = at(gu0 - 0.45, gv0 + 0.35);
      post = { x: stand.x, z: stand.z, yaw: Math.atan2(dx, dz) };
    }
  }

  // --- Palms in the front corners of the garden ---------------------------------------------------
  const palm = (u: number, v: number, height: number) => {
    const q = at(u, v);
    b.cylinder(0x8b6b47, 0.2, height, q.x, 0.05, q.z, { topRadius: 0.13, sides: 8 });
    for (let r = 0.6; r < height; r += 0.45) b.cylinder(0x7a5c3a, 0.215 - (r / height) * 0.07, 0.06, q.x, r, q.z, { sides: 8 });
    const top = height + 0.05;
    b.dome(0x4d7c2a, 0.22, q.x, top - 0.1, q.z);
    for (let k = 0; k < 9; k++) {
      const yaw = (k / 9) * Math.PI * 2 + rand() * 0.3;
      const tilt = 0.45 + rand() * 0.35;
      const len = 2.4 + rand() * 0.5;
      const reach = (len / 2) * Math.cos(tilt);
      b.box(k % 2 ? 0x2f7d32 : 0x3b8f3a, 0.42, 0.04, len, q.x + Math.sin(yaw) * reach, top - (len / 2) * Math.sin(tilt), q.z + Math.cos(yaw) * reach, { yaw, pitch: tilt });
    }
  };
  const palmV = vf + 1.1;
  if (gL - P - uL > 2.2 && hv0 - palmV > 1.2) palm(uL + 1.0, palmV, 5.2 + rand() * 1.4);
  if (uR - (wicket ? wkR : gR + P) > 4.6 && hv0 - palmV > 1.2) palm(uR - 1.0, palmV, 5.0 + rand() * 1.4);
  // Shrubs along the inside of the side walls
  for (const u of [uL + 0.55, uR - 0.55]) {
    for (let v = vf + 2.4; v < vBack - 0.6; v += 1.3) {
      if (v > hv0 - 0.6 && v < hv1 + 0.6 && Math.abs(u - (u < 0 ? hu0 : hu1)) < 0.9) continue;
      const q = at(u, v);
      b.dome(rand() < 0.5 ? LEAF : LEAF_DARK, 0.42 + rand() * 0.12, q.x, 0.05, q.z);
    }
  }

  // --- The flower bed, outside the fence, between it and the street --------------------------------
  const bedV0 = 0.08;
  const bedV1 = vf - t / 2 - 0.12;
  const bed = (u0: number, u1: number) => {
    if (u1 - u0 < 0.6 || bedV1 - bedV0 < 0.25) return;
    const mu = (u0 + u1) / 2;
    const mv = (bedV0 + bedV1) / 2;
    const lv = bedV1 - bedV0;
    // Brick edging and dark soil
    box(b, BRICK, u1 - u0, 0.16, 0.08, mu, 0, bedV0 + 0.04);
    box(b, BRICK, u1 - u0, 0.16, 0.08, mu, 0, bedV1 - 0.04);
    box(b, BRICK, 0.08, 0.16, lv, u0 + 0.04, 0, mv);
    box(b, BRICK, 0.08, 0.16, lv, u1 - 0.04, 0, mv);
    box(b, SOIL, u1 - u0 - 0.16, 0.12, lv - 0.12, mu, 0, mv);
    // A low hedge against the fence, flowering ixora along its top
    const back = bedV1 - Math.min(0.2, lv * 0.3);
    for (let u = u0 + 0.28; u < u1 - 0.2; u += 0.34) {
      const q = at(u, back);
      b.dome(LEAF_DARK, 0.22, q.x, 0.1, q.z);
      if (rand() < 0.7) {
        const f = at(u + (rand() - 0.5) * 0.14, back + (rand() - 0.5) * 0.1);
        b.dome(0xe4572e, 0.07, f.x, 0.28, f.z);
      }
    }
    // Then the flowers in front: runs of one kind at a time, as a gardener plants them
    if (lv > 0.5) {
      const row = bedV0 + Math.max(0.16, (back - bedV0) * 0.45);
      let colour = BLOOMS[Math.floor(rand() * BLOOMS.length)];
      let run = 0;
      for (let u = u0 + 0.22; u < u1 - 0.18; u += 0.24) {
        if (run-- <= 0) {
          colour = BLOOMS[Math.floor(rand() * BLOOMS.length)];
          run = 2 + Math.floor(rand() * 3);
        }
        const q = at(u, row + (rand() - 0.5) * 0.06);
        b.dome(LEAF, 0.13, q.x, 0.1, q.z);
        for (let k = 0; k < 4; k++) {
          const f = at(u + (rand() - 0.5) * 0.16, row + (rand() - 0.5) * 0.12);
          b.dome(colour, 0.045 + rand() * 0.02, f.x, 0.18 + rand() * 0.05, f.z);
        }
      }
    }
  };
  bed(uL, gL - P - 0.08);
  if (wicket) {
    bed(gR + P + 0.08, wkL - p - 0.08);
    bed(wkR + p + 0.08, uR);
  } else bed(gR + P + 0.08, uR);
  // Potted palms either side of the gate, on the street side
  for (const u of [gL - P / 2, gR + P / 2]) {
    const q = at(u, Math.max(0.3, vf - P / 2 - 0.35));
    b.cylinder(0x3f3f46, 0.24, 0.5, q.x, 0.05, q.z, { topRadius: 0.3, sides: 12 });
    b.cylinder(GOLD, 0.305, 0.04, q.x, 0.5, q.z, { sides: 12 });
    b.dome(0x2f7d32, 0.34, q.x, 0.52, q.z);
    for (let k = 0; k < 6; k++) {
      const yaw = (k / 6) * Math.PI * 2;
      b.box(0x3b8f3a, 0.12, 0.03, 0.75, q.x + Math.sin(yaw) * 0.25, 0.85, q.z + Math.cos(yaw) * 0.25, { yaw, pitch: -0.7 });
    }
  }

  const group = b.build(owner, { roughness: 0.78 });
  group.add(plate);

  // Pavers are textured, so they are a mesh of their own
  const texture = paverTexture();
  for (const patch of pavers) {
    const lu = patch.u1 - patch.u0;
    const lv = patch.v1 - patch.v0;
    if (lu <= 0 || lv <= 0) continue;
    const [w, d] = dims(lu, lv);
    const geo = new THREE.PlaneGeometry(w, d);
    const uv = geo.attributes.uv as THREE.BufferAttribute;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * (w / 1.6), uv.getY(i) * (d / 1.6));
    const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map: texture, roughness: 0.92 }));
    mesh.rotation.x = -Math.PI / 2;
    const q = at((patch.u0 + patch.u1) / 2, (patch.v0 + patch.v1) / 2);
    mesh.position.set(q.x, 0.056 + pavers.indexOf(patch) * 0.002, q.z);
    mesh.receiveShadow = true;
    mesh.name = 'compound drive';
    group.add(mesh);
  }

  // --- The sliding gate ------------------------------------------------------------------------------
  // Drawn along its own x, centred, then turned to run along the street
  const lb = new Builder();
  const L = G + 0.24;
  const frame = (w: number, h: number, d: number, x: number, y: number, hex = IRON) => lb.box(hex, w, h, d, x, y, 0);
  frame(L, 0.09, 0.08, 0, 0.1);
  frame(L, 0.07, 0.07, 0, 1.0);
  frame(0.1, 2.0, 0.09, -L / 2 + 0.05, 0.1);
  frame(0.1, 2.0, 0.09, L / 2 - 0.05, 0.1);
  // A solid lower panel for privacy, with a gold line round it
  frame(L - 0.2, 0.8, 0.035, 0, 0.19, 0x1c1f26);
  frame(L - 0.34, 0.03, 0.045, 0, 0.9, GOLD);
  frame(L - 0.34, 0.03, 0.045, 0, 0.25, GOLD);
  frame(0.03, 0.62, 0.045, -L / 2 + 0.17, 0.27, GOLD);
  frame(0.03, 0.62, 0.045, L / 2 - 0.17, 0.27, GOLD);
  // Upper bars rising to an arch, each with a gold spear
  const bars = Math.round((L - 0.2) / 0.12);
  for (let i = 0; i <= bars; i++) {
    const x = -L / 2 + 0.1 + (i * (L - 0.2)) / bars;
    const arch = 1.95 + 0.28 * Math.sin((Math.PI * i) / bars);
    frame(0.035, arch - 1.0, 0.035, x, 1.05);
    lb.cone(GOLD, 0.04, 0.13, x, arch + 0.05, 0, 4);
  }
  // The arched top rail, in short pieces following the bars
  for (let i = 0; i < bars; i++) {
    const x0 = -L / 2 + 0.1 + (i * (L - 0.2)) / bars;
    const x1 = -L / 2 + 0.1 + ((i + 1) * (L - 0.2)) / bars;
    const y0 = 1.95 + 0.28 * Math.sin((Math.PI * i) / bars);
    const y1 = 1.95 + 0.28 * Math.sin((Math.PI * (i + 1)) / bars);
    lb.box(IRON, Math.hypot(x1 - x0, y1 - y0) + 0.01, 0.05, 0.06, (x0 + x1) / 2, (y0 + y1) / 2 - 0.025, 0, { roll: Math.atan2(y1 - y0, x1 - x0) });
  }
  // A gold medallion in the middle of the rail
  lb.shape(GOLD, new THREE.TorusGeometry(0.22, 0.03, 8, 24), 0, 1.45, 0);
  lb.shape(GOLD, new THREE.TorusGeometry(0.1, 0.025, 8, 18), 0, 1.45, 0);
  // Wheels on the rail
  for (const x of [-L / 2 + 0.35, L / 2 - 0.35]) lb.tube(0x52525b, 0.08, 0.08, 0.06, x, 0.08, 0, { sides: 10, yaw: Math.PI / 2 });
  const leaf = lb.build(`Gate of ${o.plotName}`, { roughness: 0.35, metalness: 0.55 });
  const shut = at(ug, vLeaf);
  leaf.position.set(shut.x, 0, shut.z);
  // Its x runs along the street: turned a quarter if the street runs along z
  leaf.rotation.y = alongX ? 0 : -Math.PI / 2;
  group.add(leaf);

  const slide = at(ug - G - 0.05, vLeaf);
  const centre = at(ug, vf);
  const outside = at(ug, -2.5);
  return {
    group,
    leaf,
    leafShut: new THREE.Vector3(shut.x, 0, shut.z),
    leafSlide: new THREE.Vector3(slide.x - shut.x, 0, slide.z - shut.z),
    leafSolid: solid(`Gate of ${o.plotName}`, 2.2, gL - 0.05, gR + 0.05, vLeaf - 0.12, vLeaf + 0.12),
    gateway: rectOf(gL - 0.2, gR + 0.2, vf - 1.6, vLeaf + 1.4),
    centre: new THREE.Vector3(centre.x, 0, centre.z),
    outside: new THREE.Vector3(outside.x, 0, outside.z),
    post,
    fixed,
  };
}

