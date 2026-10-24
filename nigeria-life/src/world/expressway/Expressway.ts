import * as THREE from 'three';
import { Builder } from '../kit/ArchKit';
import { seededRandom } from '../../graphics/MeshBaker';
import type { Obstruction } from '../plan/CityPlan';
import { EXPRESS, roadsideAt } from './layout';
import { Roadside } from './Roadside';

/**
 * The expressway out of Lagos Island. Broad Street carries straight on south and becomes it:
 * three lanes each way with a concrete barrier down the middle and lamps along it, shops and
 * offices on both sides, footbridges every few hundred metres, the toll plaza, then the long
 * bridge across the lagoon with the cable tower half-way, the mainland on the far side, and a
 * roundabout at the end to come back.
 *
 * Built in 100 m pieces; only the pieces near the player are drawn.
 */
export { EXPRESS };

const CHUNK = 100;
const DRAW = 320;

const WALLS = [0xf1e4c8, 0xe7d3b3, 0xd9c1a0, 0xf5f5f4, 0xcbd5e1, 0xfde68a, 0xfed7aa, 0xbfdbfe, 0xbbf7d0, 0xe2e8f0, 0xfecaca, 0xd6d3d1];
const ROOFS = [0x7f1d1d, 0x92400e, 0x475569, 0x9a3412, 0x57534e];
const SIGNS = [0xdc2626, 0x16a34a, 0x2563eb, 0xf59e0b, 0x7c3aed, 0x0d9488, 0xdb2777];

/** A flat sign with words on it, both faces */
function sign(text: string, sub: string, width: number, height: number, bg: string, fg = '#ffffff'): THREE.Mesh {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = Math.round((512 * height) / width);
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.strokeStyle = 'rgba(255,255,255,0.85)';
  ctx.lineWidth = 6;
  ctx.strokeRect(6, 6, canvas.width - 12, canvas.height - 12);
  ctx.fillStyle = fg;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `800 ${Math.round(canvas.height * (sub ? 0.36 : 0.5))}px Outfit Variable, Arial, sans-serif`;
  ctx.fillText(text, canvas.width / 2, canvas.height * (sub ? 0.38 : 0.52), canvas.width - 30);
  if (sub) {
    ctx.font = `600 ${Math.round(canvas.height * 0.2)}px Outfit Variable, Arial, sans-serif`;
    ctx.fillText(sub, canvas.width / 2, canvas.height * 0.75, canvas.width - 30);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, height), new THREE.MeshBasicMaterial({ map: texture, side: THREE.DoubleSide, toneMapped: false }));
  return mesh;
}

const BILLBOARDS: Array<[string, string, string]> = [
  ['NaijaFM 99.1', 'Afrobeats all day, all night', '#16a34a'],
  ['JOLLOF KINGDOM', 'Party jollof, delivered hot', '#dc2626'],
  ['EKO BANK', 'Your money, sharp sharp', '#1d4ed8'],
  ['OWAMBE HALL', 'Weddings · Birthdays · Burials', '#7c3aed'],
  ['SANKOFA MOTORS', 'New & tokunbo · Victoria Island', '#0f172a'],
  ['LAGOS eTAG', 'Pass the toll without stopping', '#0d9488'],
];

export class Expressway {
  public readonly group = new THREE.Group();
  /** What stands on the ground: the barrier, lamps, buildings, parapets and the rest */
  public readonly obstructions: Array<Obstruction & { pole?: boolean }> = [];
  private readonly chunks: Array<{ group: THREE.Group; z: number }> = [];
  private readonly rand = seededRandom(4410);

  /** The places along it: showroom, cathedral, mosque, beach, mall, hotel and the rest */
  public readonly roadside = new Roadside();

  constructor() {
    this.group.name = 'Expressway';
    this.group.add(this.roadside.group);
    this.obstructions.push(...this.roadside.obstructions);
    for (let z = EXPRESS.from; z < EXPRESS.to; z += CHUNK) this.buildChunk(z, Math.min(EXPRESS.to, z + CHUNK));
    this.buildRoundabout();
    this.buildLagoon();
    this.buildToll();
    this.buildPylon();
  }

  /** Is z on the bridge over the lagoon? */
  public static overWater(z: number): boolean {
    return z > EXPRESS.lagoonFrom && z < EXPRESS.lagoonTo;
  }

  /** Draws only the pieces near the player */
  public update(playerZ: number): void {
    for (const chunk of this.chunks) chunk.group.visible = Math.abs(chunk.z - playerZ) < DRAW;
    this.roadside.update(playerZ);
  }

  private add(chunkZ: number, object: THREE.Object3D): void {
    let chunk = this.chunks.find((c) => c.z === chunkZ);
    if (!chunk) {
      chunk = { group: new THREE.Group(), z: chunkZ };
      chunk.group.visible = false;
      this.chunks.push(chunk);
      this.group.add(chunk.group);
    }
    chunk.group.add(object);
  }

  private solid(owner: string, minX: number, maxX: number, minZ: number, maxZ: number, height: number, structure = false, pole = false): void {
    this.obstructions.push({ owner, minX, maxX, minZ, maxZ, height, structure, ...(pole ? { pole: true } : {}) });
  }

  private buildChunk(z0: number, z1: number): void {
    const b = new Builder();
    const mid = (z0 + z1) / 2;
    const len = z1 - z0;
    const water = Expressway.overWater(mid);
    const H = EXPRESS.half;
    // The deck or the road: asphalt, with its edge lines
    if (water) {
      // A bridge deck on its slab, with concrete parapets to keep cars on it
      b.box(0x6b7280, H * 2 + 2.4, 1.4, len, 0, -1.4, mid);
      for (const side of [-1, 1]) {
        b.box(0xd6d3d1, 0.4, 0.95, len, side * (H + 0.4), 0, mid);
        this.solid('Bridge parapet', side * (H + 0.2) - 0.2, side * (H + 0.2) + 0.2, z0, z1, 0.95);
      }
      // Piers into the water
      for (let z = z0 + 20; z < z1; z += 40) {
        for (const x of [-7, 7]) b.cylinder(0x9ca3af, 1.1, 12, x, -13.4, z);
        b.box(0x9ca3af, H * 2, 1, 2.4, 0, -2.4, z);
      }
    } else {
      // Pavements, kerbs and the land behind
      for (const side of [-1, 1]) {
        b.box(0xbcb3a3, EXPRESS.walk, 0.2, len, side * (H + EXPRESS.walk / 2), 0, mid);
        b.box(0xe5e7eb, 0.25, 0.22, len, side * (H + 0.12), 0, mid);
      }
      b.box(0x8b7d62, 520, 0.02, len, 0, -0.06, mid);
    }
    b.box(0x2b2f36, H * 2, 0.02, len, 0, 0.0, mid);
    for (const side of [-1, 1]) {
      // Solid edge lines, and the dashes between lanes
      b.box(0xf8fafc, 0.15, 0.01, len, side * (H - 0.35), 0.021, mid);
      for (const x of [3.35, 6.45]) {
        for (let z = z0 + 2; z < z1; z += 12) b.box(0xf8fafc, 0.13, 0.01, 4, side * x, 0.021, z);
      }
    }
    // The median: a raised strip, painted kerbs and a concrete barrier, broken where cars may turn back
    const gap = EXPRESS.uTurns.find((u) => u + 12 > z0 && u - 12 < z1);
    const start = Math.max(z0, 132);
    const pieces: Array<[number, number]> = (gap ? [[start, gap - 12], [gap + 12, z1]] : [[start, z1]]).filter(([a, c]) => c - a > 0.5) as Array<[number, number]>;
    for (const [a, c] of pieces) {
      const m = (a + c) / 2;
      const l = c - a;
      b.box(0xa8a29e, EXPRESS.median * 2, 0.16, l, 0, 0, m);
      for (const side of [-1, 1]) {
        for (let z = a; z < c - 0.5; z += 2) b.box(z % 4 < 2 ? 0xfacc15 : 0x111827, 0.06, 0.16, Math.min(2, c - z), side * EXPRESS.median, 0, z + Math.min(2, c - z) / 2);
      }
      b.box(0xd6d3d1, EXPRESS.barrier * 2, 0.9, l, 0, 0.16, m);
      b.box(0xe7e5e4, EXPRESS.barrier * 1.2, 0.08, l, 0, 1.06, m);
      this.solid('Expressway barrier', -EXPRESS.barrier, EXPRESS.barrier, a, c, 1.1);
    }
    // Lamps down the median, every 40 m, an arm over each carriageway
    for (let z = z0 + 20; z < z1; z += 40) {
      if ((gap && Math.abs(z - gap) < 14) || z < 140) continue;
      b.cylinder(0x6b7280, 0.14, 10, 0, 0.16, z);
      for (const side of [-1, 1]) {
        b.box(0x6b7280, 3.2, 0.14, 0.14, side * 1.6, 9.9, z);
        b.box(0xfff3c4, 0.7, 0.18, 0.4, side * 3.1, 9.78, z, { glow: true });
      }
      this.solid('Expressway lamp', -0.14, 0.14, z - 0.14, z + 0.14, 10, false, true);
    }
    if (!water) {
      // The island's own buildings stand round the end of Broad Street: the frontage starts beyond them
      if (z1 > 165) this.buildFrontage(b, Math.max(z0, 165), z1);
      // A footbridge every 400 m over the whole road
      for (let z = Math.ceil(z0 / 400) * 400; z < z1; z += 400) if (z > EXPRESS.from + 100 && Math.abs(z - EXPRESS.toll) > 60) this.footbridge(b, z);
    }
    const built = b.build(`expressway ${z0}`);
    built.traverse((child) => {
      const mesh = child as THREE.Mesh;
      if (mesh.isMesh) mesh.receiveShadow = true;
    });
    this.add(z0, built);
    // A billboard now and then
    if (!water && Math.floor(z0 / 100) % 4 === 1) {
      const [title, line, bg] = BILLBOARDS[Math.floor(z0 / 400) % BILLBOARDS.length];
      const side = Math.floor(z0 / 400) % 2 ? 1 : -1;
      const board = sign(title, line, 12, 5, bg);
      board.position.set(side * (H + EXPRESS.walk + 3), 10, mid);
      // Its face to the road
      board.rotation.y = side < 0 ? Math.PI / 2 : -Math.PI / 2;
      const posts = new Builder().box(0x374151, 0.4, 7.5, 0.4, side * (H + EXPRESS.walk + 3), 0, mid - 4).box(0x374151, 0.4, 7.5, 0.4, side * (H + EXPRESS.walk + 3), 0, mid + 4).build('billboard posts');
      this.add(z0, board);
      this.add(z0, posts);
    }
    // Direction signs
    if (z0 === 300 || z0 === 2800) {
      const toward = z0 < 2000 ? ['THIRD MAINLAND BRIDGE', 'Ikeja · Oworonshoki · Lekki toll'] : ['IKEJA · OWORONSHOKI', 'Roundabout ahead: turn back for Lagos Island'];
      const board = sign(toward[0], toward[1], 14, 3.2, '#166534');
      board.position.set(-H / 2 - 0.5, 7.6, z0 + 10);
      // Over the southbound lanes, facing the drivers coming down
      board.rotation.y = Math.PI;
      this.add(z0, board);
      this.add(z0, new Builder().box(0x6b7280, 0.3, 7.6, 0.3, -H - 0.2, 0, z0 + 10).box(0x6b7280, H + 0.6, 0.3, 0.3, -H / 2, 7.6, z0 + 10).build('sign gantry'));
    }
  }

  /** Shops, offices and houses along one stretch, both sides, facing the road */
  private buildFrontage(b: Builder, z0: number, z1: number): void {
    const front = EXPRESS.half + EXPRESS.walk;
    for (const side of [-1, 1]) {
      let z = z0 + this.rand() * 3;
      while (z < z1 - 6) {
        const width = Math.min(z1 - z - 1, 9 + this.rand() * 15);
        if (width < 6) break;
        // A place of its own stands here: go on past it
        const place = roadsideAt(side, z, z + width);
        if (place) {
          z = place.z + place.length / 2 + 3;
          continue;
        }
        const depth = 10 + this.rand() * 12;
        // Towers near the island and near the mainland centre; low shops and houses between
        const tall = (z < 700 || z > 3300) && this.rand() < 0.25;
        const floors = tall ? 8 + Math.floor(this.rand() * 12) : 1 + Math.floor(this.rand() * 4);
        const height = floors * 3.2;
        const setback = 1 + this.rand() * 3;
        const near = side * (front + setback);
        const cx = near + (side * depth) / 2;
        const cz = z + width / 2;
        const wall = tall ? (this.rand() < 0.5 ? 0x93c5fd : 0x94a3b8) : WALLS[Math.floor(this.rand() * WALLS.length)];
        b.box(wall, depth, height, width, cx, 0, cz);
        // Windows on the face to the road, a lit one here and there
        const faceX = near - side * 0.02;
        for (let f = 0; f < floors; f++) {
          for (let w = 1.4; w < width - 1; w += 2.4) {
            const lit = this.rand() < 0.3;
            b.box(lit ? 0xfde68a : 0x1e293b, 0.05, 1.3, 1.3, faceX, f * 3.2 + 1.1, z + w, { glow: lit });
          }
        }
        if (!tall) {
          // A shop sign over the ground floor, and a roof
          b.box(SIGNS[Math.floor(this.rand() * SIGNS.length)], 0.1, 0.9, width * 0.8, faceX - side * 0.04, 2.5, cz);
          b.box(ROOFS[Math.floor(this.rand() * ROOFS.length)], depth + 0.6, 0.3, width + 0.6, cx, height, cz);
        } else {
          b.box(0x334155, depth - 1, 1.2, width - 1, cx, height, cz);
        }
        this.solid('Expressway building', Math.min(near, near + side * depth), Math.max(near, near + side * depth), z, z + width, height, true);
        z += width + 1 + this.rand() * 4;
      }
    }
  }

  /** A footbridge right across the road, stairs going up on both pavements */
  private footbridge(b: Builder, z: number): void {
    const H = EXPRESS.half;
    const deck = 6.2;
    b.box(0x2563eb, H * 2 + 6, 0.35, 2.6, 0, deck, z);
    for (const side of [-1, 1]) b.box(0x93c5fd, H * 2 + 6, 1.1, 0.08, 0, deck + 0.35, z + side * 1.25);
    for (const side of [-1, 1]) {
      const x = side * (H + 2.2);
      // A tower of stairs on each pavement
      b.box(0x1e3a8a, 2.4, deck, 3, x, 0, z);
      for (let s = 0; s < 8; s++) b.box(0x64748b, 2.2, 0.15, 0.6, x, s * 0.8, z - 1.8 - s * 0.55);
      this.solid('Footbridge stairs', x - 1.2, x + 1.2, z - 6.2, z + 1.5, deck, false);
    }
    // Its middle stands on the median
    b.box(0x1e3a8a, 0.6, deck, 0.6, 0, 0.16, z);
  }

  private buildLagoon(): void {
    const water = new THREE.Mesh(
      new THREE.PlaneGeometry(1600, EXPRESS.lagoonTo - EXPRESS.lagoonFrom + 60),
      new THREE.MeshStandardMaterial({ color: 0x1f6f8b, metalness: 0.35, roughness: 0.25 }),
    );
    water.rotation.x = -Math.PI / 2;
    water.position.set(0, -3.2, (EXPRESS.lagoonFrom + EXPRESS.lagoonTo) / 2);
    water.name = 'Lagos Lagoon';
    // Drawn whenever any part of the bridge is
    this.add(EXPRESS.lagoonFrom, water);
    const near = water.clone();
    this.add(Math.floor(EXPRESS.pylon / CHUNK) * CHUNK, near);
    const far = water.clone();
    this.add(Math.floor((EXPRESS.lagoonTo - 50) / CHUNK) * CHUNK, far);
    // The shore on each side, with a few fishing canoes
    const b = new Builder();
    for (const z of [EXPRESS.lagoonFrom, EXPRESS.lagoonTo]) b.box(0xc2a878, 520, 3.2, 20, 0, -3.2, z + (z === EXPRESS.lagoonFrom ? -10 : 10));
    for (let i = 0; i < 14; i++) {
      const x = (this.rand() < 0.5 ? -1 : 1) * (40 + this.rand() * 300);
      const z = EXPRESS.lagoonFrom + 80 + this.rand() * (EXPRESS.lagoonTo - EXPRESS.lagoonFrom - 160);
      b.box(0x78350f, 1.2, 0.5, 6, x, -3.2, z, { yaw: this.rand() * Math.PI });
    }
    this.add(Math.floor((EXPRESS.lagoonFrom + 300) / CHUNK) * CHUNK, b.build('lagoon shores'));
  }

  private buildToll(): void {
    const z = EXPRESS.toll;
    const H = EXPRESS.half;
    const b = new Builder();
    b.box(0xe5e7eb, H * 2 + 4, 0.7, 10, 0, 6.4, z);
    b.box(0x16a34a, H * 2 + 4, 0.25, 10.2, 0, 7.1, z);
    for (const x of [-(H + 1.2), 0, H + 1.2]) for (const dz of [-3.5, 3.5]) b.cylinder(0x9ca3af, 0.3, 6.4, x, 0, z + dz);
    // Booths on the shoulders, with a barrier arm each
    for (const side of [-1, 1]) {
      b.box(0xf8fafc, 1.6, 2.6, 4, side * (H + 1.3), 0, z).box(0x1e293b, 0.05, 0.9, 2.6, side * (H + 0.48), 1.2, z);
      b.box(0xdc2626, 0.1, 0.1, 3, side * (H - 1), 1.1, z + 2.4);
      this.solid('Toll booth', side * (H + 0.5) - 0.8, side * (H + 0.5) + 0.8, z - 2, z + 2, 2.6);
    }
    this.solid('Toll plaza column', -0.3, 0.3, z - 3.8, z + 3.8, 6.4);
    this.add(Math.floor(z / CHUNK) * CHUNK, b.build('toll plaza'));
    for (const dz of [-5.15, 5.15]) {
      const board = sign('LEKKI TOLL PLAZA', 'eTag lanes · cars ₦400 · pay as you pass', 18, 2.2, '#166534');
      board.position.set(0, 6.75, z + dz);
      // Each face to the traffic coming at it
      board.rotation.y = dz < 0 ? Math.PI : 0;
      this.add(Math.floor(z / CHUNK) * CHUNK, board);
    }
  }

  /** The tower of the cable-stayed bridge, an A over the road, with its cables fanned to the deck */
  private buildPylon(): void {
    const z = EXPRESS.pylon;
    const H = EXPRESS.half;
    const top = 62;
    const legs = new THREE.Group();
    const concrete = new THREE.MeshStandardMaterial({ color: 0xe7e5e4, roughness: 0.6 });
    for (const side of [-1, 1]) {
      const footX = side * (H + 1.6);
      const len = Math.hypot(footX, top);
      const leg = new THREE.Mesh(new THREE.BoxGeometry(1.6, len, 2.4), concrete);
      leg.position.set(footX / 2, top / 2, z);
      leg.rotation.z = side * Math.atan2(Math.abs(footX), top);
      legs.add(leg);
      this.solid('Bridge tower', footX - 0.9, footX + 0.9, z - 1.3, z + 1.3, 30);
    }
    const crown = new THREE.Mesh(new THREE.BoxGeometry(2.4, 8, 2.8), concrete);
    crown.position.set(0, top + 3, z);
    legs.add(crown);
    const cable = new THREE.MeshStandardMaterial({ color: 0xf8fafc, metalness: 0.6, roughness: 0.3 });
    for (let i = 1; i <= 9; i++) {
      for (const dir of [-1, 1]) {
        for (const side of [-1, 1]) {
          const from = new THREE.Vector3(0, top - i * 2.2, z);
          const to = new THREE.Vector3(side * (H + 0.4), 1, z + dir * i * 11);
          const length = from.distanceTo(to);
          const c = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, length, 5), cable);
          c.position.copy(from).add(to).multiplyScalar(0.5);
          c.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), to.clone().sub(from).normalize());
          legs.add(c);
        }
      }
    }
    legs.name = 'Cable-stayed tower';
    this.add(Math.floor(z / CHUNK) * CHUNK, legs);
    // Seen from further along the bridge too
    for (const near of [z - CHUNK, z + CHUNK]) this.add(Math.floor(near / CHUNK) * CHUNK, legs.clone());
  }

  /** The roundabout at the end, round an island with a monument on it */
  private buildRoundabout(): void {
    const { z, island, road } = EXPRESS.ring;
    const b = new Builder();
    b.cylinder(0x2b2f36, road, 0.02, 0, 0, z, { sides: 48 });
    b.cylinder(0xe5e7eb, island + 0.3, 0.22, 0, 0, z, { sides: 48 });
    b.cylinder(0x4d7c0f, island, 0.25, 0, 0, z, { sides: 48 });
    b.box(0xd6d3d1, 3, 1.2, 3, 0, 0.25, z).box(0xe7e5e4, 1.4, 12, 1.4, 0, 1.45, z).box(0xfacc15, 1.6, 0.5, 1.6, 0, 13.45, z, { glow: true });
    for (let a = 0; a < Math.PI * 2; a += Math.PI / 6) b.cylinder(0x166534, 1.2, 3.5, Math.sin(a) * (island - 3), 0.25, z + Math.cos(a) * (island - 3), { topRadius: 0.2, sides: 6 });
    b.box(0x8b7d62, 520, 0.02, road * 2 + 40, 0, -0.06, z);
    this.solid('Roundabout island', -island, island, z - island, z + island, 1.2, true);
    // The edge of the paving, all round outside the ring: a kerb
    for (let a = 0; a < Math.PI * 2; a += Math.PI / 24) {
      const x = Math.sin(a) * (road + 0.5);
      const zz = z + Math.cos(a) * (road + 0.5);
      if (Math.cos(a) < -0.85 && Math.abs(x) < EXPRESS.half + 1) continue; // where the expressway comes in
      b.box(0xe5e7eb, 2.4, 0.5, 2.4, x, 0, zz, { yaw: a });
      this.solid('Roundabout kerb', x - 1.2, x + 1.2, zz - 1.2, zz + 1.2, 0.7);
    }
    this.add(Math.floor((z - road) / CHUNK) * CHUNK, b.build('roundabout'));
  }
}
