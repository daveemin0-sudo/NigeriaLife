import * as THREE from 'three';
import { Kit, M, signMesh, type SignStyle } from '../airport/TerminalKit';
import type { PlaceInterior } from '../places/PlaceInterior';

/**
 * The parts a mall is made of, shared by every mall in the game: shopfronts of glass between
 * slim frames with the shop's lit name over them, a gallery's edge with its glass balustrade,
 * planters, benches, lit ceiling panels, and the floor laid in real stone with world-sized tiles.
 */

/** Lit shop signs: white letters on the brand's colour, a thin light line under them */
export const brandSign = (bg: string, fg = '#ffffff'): SignStyle => ({ bg, fg, density: 120, accent: 'rgba(255,255,255,0.55)' });

/**
 * A shopfront along a line: glass between frames, a doorway left open, and the shop's name lit
 * over it. `from` and `to` are the ends of the front (room coordinates), `facing` the way the front
 * looks out (toward the walkway), `door` the doorway's middle along the front and its width.
 */
export function shopfront(
  k: Kit, group: THREE.Group, from: [number, number], to: [number, number], facing: number,
  name: string[], style: SignStyle, door: { at: number; width: number } | null, height = 3.6, fascia = 1.1,
): void {
  const dx = to[0] - from[0];
  const dz = to[1] - from[1];
  const len = Math.hypot(dx, dz);
  const ux = dx / len;
  const uz = dz / len;
  const yaw = Math.atan2(ux, uz) + Math.PI / 2;
  const at = (t: number): [number, number] => [from[0] + ux * t, from[1] + uz * t];
  // Frames every 1.8 m, and at the doorway's sides
  const posts: number[] = [];
  for (let t = 0; t <= len + 0.01; t += len / Math.max(1, Math.round(len / 1.8))) posts.push(t);
  if (door) posts.push(door.at - door.width / 2, door.at + door.width / 2);
  for (const t of posts) {
    const [x, z] = at(t);
    k.box(M.metalDark, 0.08, height, 0.1, x, 0, z, yaw);
  }
  // The glass, in panes either side of the doorway; a low kick plate under it
  const spans: Array<[number, number]> = door ? [[0, door.at - door.width / 2], [door.at + door.width / 2, len]] : [[0, len]];
  for (const [a, b] of spans) {
    if (b - a < 0.05) continue;
    const [x, z] = at((a + b) / 2);
    k.box(M.glass, b - a, height - 0.2, 0.02, x, 0.2, z, yaw);
    k.box(M.metalDark, b - a, 0.2, 0.06, x, 0, z, yaw);
  }
  // Over the door, the transom; over the whole front, the fascia with the name
  const [mx, mz] = at(len / 2);
  k.box(M.metalDark, len, 0.12, 0.14, mx, height, mz, yaw);
  k.box(M.black, len, fascia, 0.3, mx, height + 0.12, mz, yaw);
  const sign = signMesh(name, Math.min(len - 0.6, Math.max(3, name[0].length * 0.42)), fascia * 0.72, style);
  sign.position.set(mx + Math.sin(facing) * 0.17, height + 0.12 + fascia / 2, mz + Math.cos(facing) * 0.17);
  sign.rotation.y = facing;
  group.add(sign);
}

/** A planter: a stone box with a tall plant and grasses */
export function planter(k: Kit, x: number, z: number, w = 1.2, d = 1.2, tall = true): void {
  k.box(M.floorDark, w, 0.55, d, x, 0, z);
  k.box(M.leaf, w - 0.15, 0.08, d - 0.15, x, 0.55, z);
  if (tall) {
    k.cyl(M.woodDark, 0.05, 0.07, 1.6, x, 0.6, z, 8);
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2;
      k.box(i % 2 ? M.leafLight : M.leaf, 0.12, 0.9, 0.5, x + Math.sin(a) * 0.25, 1.6, z + Math.cos(a) * 0.25, a, 0.7);
    }
  } else {
    for (let i = 0; i < 6; i++) k.box(i % 2 ? M.leafLight : M.leaf, 0.3, 0.4, 0.3, x + ((i % 3) - 1) * (w / 3.5), 0.6, z + (i < 3 ? -1 : 1) * (d / 5));
  }
}

/** A bench of wood slats on steel legs, `length` long, facing `yaw` */
export function bench(k: Kit, x: number, z: number, length: number, yaw: number, back = false): void {
  const s = Math.sin(yaw);
  const c = Math.cos(yaw);
  for (const t of [-length / 2 + 0.2, length / 2 - 0.2]) k.box(M.metalDark, 0.06, 0.42, 0.45, x + c * t, 0, z - s * t, yaw);
  k.box(M.wood, length, 0.06, 0.48, x, 0.42, z, yaw);
  if (back) k.box(M.wood, length, 0.4, 0.05, x - s * 0.24, 0.5, z - c * 0.24, yaw, -0.12);
}

/**
 * The edge of a gallery a storey up, seen from below: its slab and white fascia, the glass
 * balustrade on top, and the columns that hold it, between `from` and `to` along its edge. The
 * slab runs back `depth` behind the edge (the side opposite `out`).
 */
export function galleryEdge(k: Kit, from: [number, number], to: [number, number], out: number, depth: number, level: number, columns = 7): void {
  const dx = to[0] - from[0];
  const dz = to[1] - from[1];
  const len = Math.hypot(dx, dz);
  const yaw = Math.atan2(dx, dz) + Math.PI / 2;
  const bx = -Math.sin(out);
  const bz = -Math.cos(out);
  const mx = (from[0] + to[0]) / 2;
  const mz = (from[1] + to[1]) / 2;
  // The slab (its underside lit by downlights) and the fascia along its edge
  k.box(M.solid, len, 0.45, depth, mx + bx * depth / 2, level - 0.45, mz + bz * depth / 2, yaw);
  k.box(M.plaster, len, 0.04, depth - 0.2, mx + bx * depth / 2, level - 0.49, mz + bz * depth / 2, yaw);
  k.box(M.solid, len + 0.1, 0.75, 0.12, mx, level - 0.6, mz, yaw);
  for (let t = 1; t < len; t += 3) {
    const lx = from[0] + (dx / len) * t + bx * depth * 0.4;
    const lz = from[1] + (dz / len) * t + bz * depth * 0.4;
    k.cyl(M.lamp, 0.12, 0.12, 0.02, lx, level - 0.52, lz, 10);
  }
  // The floor upstairs and the glass balustrade with its steel top rail
  k.box(M.plaster, len, 0.02, depth, mx + bx * depth / 2, level, mz + bz * depth / 2, yaw);
  k.box(M.glass, len, 1.05, 0.02, mx, level, mz, yaw);
  k.box(M.steel, len, 0.05, 0.08, mx, level + 1.05, mz, yaw);
  // Round white columns down to the floor
  const n = Math.max(1, Math.round(len / columns));
  for (let i = 0; i <= n; i++) {
    const t = (i / n) * len;
    k.cyl(M.solid, 0.32, 0.32, level - 0.45, from[0] + (dx / len) * t + bx * 0.5, 0, from[1] + (dz / len) * t + bz * 0.5, 20);
  }
}

/** Lit panels in the ceiling in a grid, as one mesh of the lamp material */
export function ceilingPanels(k: Kit, minX: number, maxX: number, minZ: number, maxZ: number, y: number, step = 4, size: [number, number] = [1.2, 1.2]): void {
  for (let x = minX + step / 2; x < maxX; x += step) for (let z = minZ + step / 2; z < maxZ; z += step) k.box(M.lamp, size[0], 0.04, size[1], x, y, z);
}

/** Replaces the room's plain floor with real stone, a tile every `tile` metres, and drops its stock ceiling lamps */
export function realFloor(room: PlaceInterior, width: number, length: number, material: THREE.Material = M.floor, tile = 2): void {
  const g = room.group;
  const floor = g.getObjectByName('interior_floor_mesh') as THREE.Mesh | undefined;
  if (floor) {
    const geo = floor.geometry as THREE.BufferGeometry;
    const uv = geo.getAttribute('uv') as THREE.BufferAttribute;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, (uv.getX(i) * width) / tile, (uv.getY(i) * length) / tile);
    uv.needsUpdate = true;
    floor.material = material;
  }
  // The stock fittings each carry a point light: dozens in a big room. Lit panels and a few lights instead.
  const lamps: THREE.Object3D[] = [];
  g.traverse((o) => { if (o.name === 'ceiling_light') lamps.push(o); });
  for (const l of lamps) l.parent?.remove(l);
}

/** Takes out the room's stock ceiling lamps (seen from above they are pale slabs, and each carries a point light), and lights it with a few */
export function relight(room: PlaceInterior, lights: Array<[number, number, number]>): void {
  const lamps: THREE.Object3D[] = [];
  room.group.traverse((o) => { if (o.name === 'ceiling_light') lamps.push(o); });
  for (const l of lamps) l.parent?.remove(l);
  for (const [x, y, z] of lights) {
    const light = new THREE.PointLight(0xfff3df, 2.2, 28, 1.2);
    light.position.set(x, y, z);
    room.group.add(light);
  }
}

/** A flat area of a different floor laid over the stone (a shop's wood, a supermarket's tiles) */
export function floorArea(group: THREE.Group, material: THREE.MeshStandardMaterial, minX: number, maxX: number, minZ: number, maxZ: number, tile = 1.5): void {
  const w = maxX - minX;
  const l = maxZ - minZ;
  const geo = new THREE.PlaneGeometry(w, l);
  geo.rotateX(-Math.PI / 2);
  const uv = geo.getAttribute('uv') as THREE.BufferAttribute;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, (uv.getX(i) * w) / tile, (uv.getY(i) * l) / tile);
  const mat = material.clone();
  mat.polygonOffset = true;
  mat.polygonOffsetFactor = -2;
  mat.polygonOffsetUnits = -2;
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set((minX + maxX) / 2, 0.006, (minZ + maxZ) / 2);
  mesh.receiveShadow = true;
  mesh.name = 'floor area';
  group.add(mesh);
}

/** A sign hung from the ceiling on two rods, readable from both sides */
export function hangingSign(group: THREE.Group, k: Kit, lines: string[], width: number, height: number, style: SignStyle, x: number, y: number, z: number, yaw: number, ceiling: number): void {
  for (const side of [-1, 1]) {
    k.box(M.steel, 0.02, ceiling - y - height / 2, 0.02, x + Math.cos(yaw) * side * width * 0.4, y + height / 2, z - Math.sin(yaw) * side * width * 0.4);
  }
  for (const flip of [0, Math.PI]) {
    const s = signMesh(lines, width, height, style);
    s.position.set(x + Math.sin(yaw + flip) * 0.012, y, z + Math.cos(yaw + flip) * 0.012);
    s.rotation.y = yaw + flip;
    group.add(s);
  }
}

/** A dining chair at a seat: a padded seat and a curved padded back on four slim chrome legs */
export function diningChair(k: Kit, s: { x: number; z: number; yaw: number; top: number }, cushion: THREE.Material = M.leather, frame: THREE.Material = M.chrome): void {
  const fx = Math.sin(s.yaw);
  const fz = Math.cos(s.yaw);
  const c = Math.cos(s.yaw);
  const sn = Math.sin(s.yaw);
  const seat = s.top - 0.07;
  for (const [lx, lz] of [[-0.19, -0.18], [0.19, -0.18], [-0.19, 0.17], [0.19, 0.17]]) {
    k.cyl(frame, 0.014, 0.012, seat, s.x + c * lx + fx * lz, 0, s.z - sn * lx + fz * lz, 6);
  }
  k.soft(cushion, 0.46, 0.07, 0.44, s.x, seat, s.z, 0.05, s.yaw);
  // The back: two posts and a padded panel, leaning back a little
  for (const lx of [-0.19, 0.19]) k.cyl(frame, 0.012, 0.012, 0.5, s.x + c * lx - fx * 0.2, seat + 0.05, s.z - sn * lx - fz * 0.2, 6);
  k.box(cushion, 0.44, 0.34, 0.05, s.x - fx * 0.22, seat + 0.18, s.z - fz * 0.22, s.yaw, -0.1);
}

/** A table: a wooden top with a dark edge on two chrome pedestals with round feet */
export function diningTable(k: Kit, x: number, z: number, w: number, d: number, yaw: number, top: THREE.Material = M.wood): void {
  k.soft(top, w, 0.045, d, x, 0.715, z, 0.04, yaw);
  k.soft(M.woodDark, w + 0.02, 0.015, d + 0.02, x, 0.705, z, 0.04, yaw);
  const c = Math.cos(yaw);
  const s = Math.sin(yaw);
  const legs = w >= 1.5 ? [-w / 4, w / 4] : [0];
  for (const t of legs) {
    k.cyl(M.chrome, 0.04, 0.04, 0.7, x + c * t, 0.01, z - s * t, 10);
    k.cyl(M.chrome, 0.22, 0.24, 0.02, x + c * t, 0, z - s * t, 18);
  }
}
