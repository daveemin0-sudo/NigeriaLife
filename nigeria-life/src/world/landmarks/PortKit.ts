import * as THREE from 'three';
import { Builder, signBoard } from '../kit/ArchKit';

/**
 * The things a container port is made of, made to look like the real ones: shipping containers (ribbed
 * steel walls, doors with locking bars at one end, a company's name, a box number), a container ship (a
 * hull that narrows to a bow, red below the waterline, a white superstructure with its bridge and funnel,
 * boxes in bays on deck, lifeboats), a ship-to-shore crane's detail (braced legs, a trussed boom,
 * cables), and a yard truck with its cab and wheels. Containers are drawn as one instanced batch per
 * colour, so a yard of them costs a few draw calls.
 */

export const BOX_W = 2.44;
export const BOX_H = 2.6;
export const BOX_L = 6.1;

/** Container liveries: the colour, and a name painted on the side (lines of our own, not real ones) */
export const LIVERIES: Array<{ hex: number; name: string }> = [
  { hex: 0x1d4ed8, name: 'EKO LINE' },
  { hex: 0xb91c1c, name: 'GULF STAR' },
  { hex: 0x15803d, name: 'NAIJA CARGO' },
  { hex: 0xea580c, name: 'ATLANTIC' },
  { hex: 0x64748b, name: 'LAGOS SHIPPING' },
  { hex: 0xe5e7eb, name: 'TRANSAFRIQUE' },
  { hex: 0xca8a04, name: 'NIGER DELTA' },
  { hex: 0x0e7490, name: 'BIGHT LINE' },
];

const css = (hex: number) => `#${hex.toString(16).padStart(6, '0')}`;
const shadeOf = (hex: number, by: number) => {
  const c = new THREE.Color(hex);
  return `rgb(${Math.round(Math.min(255, Math.max(0, c.r * 255 * by)))}, ${Math.round(Math.min(255, Math.max(0, c.g * 255 * by)))}, ${Math.round(Math.min(255, Math.max(0, c.b * 255 * by)))})`;
};

/**
 * One container's look as a single texture: the long side (top half: corrugated, rails top and bottom,
 * the line's name and a box number), the door end (bottom left: two doors, four locking bars, handles)
 * and the roof (bottom middle). Its geometry's faces each take their part of it.
 */
function containerTexture(hex: number, name: string, seed: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 256;
  const g = canvas.getContext('2d')!;
  // Side: corrugation, light and dark ridges
  g.fillStyle = css(hex);
  g.fillRect(0, 0, 512, 128);
  for (let x = 0; x < 512; x += 10) {
    g.fillStyle = shadeOf(hex, 1.18);
    g.fillRect(x, 6, 3, 116);
    g.fillStyle = shadeOf(hex, 0.72);
    g.fillRect(x + 6, 6, 2, 116);
  }
  // Top and bottom rails, corner posts
  g.fillStyle = shadeOf(hex, 0.55);
  g.fillRect(0, 0, 512, 6);
  g.fillRect(0, 122, 512, 6);
  g.fillRect(0, 0, 8, 128);
  g.fillRect(504, 0, 8, 128);
  // The line's name, big, and a box number up in the corner
  g.fillStyle = hex === 0xe5e7eb ? '#1e293b' : 'rgba(255,255,255,0.92)';
  g.font = '900 44px Arial, sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(name, 256, 66, 460);
  g.font = '700 13px monospace';
  g.textAlign = 'right';
  g.fillText(`${name.slice(0, 3).toUpperCase()}U ${String(100000 + ((seed * 7919) % 899999)).slice(0, 6)} 4`, 496, 18);

  // Door end
  g.fillStyle = css(hex);
  g.fillRect(0, 128, 128, 128);
  g.fillStyle = shadeOf(hex, 0.6);
  g.fillRect(0, 128, 128, 6);
  g.fillRect(0, 250, 128, 6);
  g.fillRect(0, 128, 6, 128);
  g.fillRect(122, 128, 6, 128);
  g.fillRect(62, 134, 4, 116);
  for (let y = 140; y < 248; y += 8) {
    g.fillStyle = shadeOf(hex, 0.85);
    g.fillRect(8, y, 112, 2);
  }
  // Four locking bars with their handles
  for (const x of [20, 46, 82, 108]) {
    g.fillStyle = '#9ca3af';
    g.fillRect(x - 2, 136, 4, 112);
    g.fillStyle = '#4b5563';
    g.fillRect(x - 5, 186, 10, 4);
  }
  // Roof: plain, a little dirty
  g.fillStyle = shadeOf(hex, 0.8);
  g.fillRect(128, 128, 256, 128);
  for (let x = 128; x < 384; x += 14) {
    g.fillStyle = shadeOf(hex, 0.7);
    g.fillRect(x, 128, 2, 128);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

let containerGeo: THREE.BufferGeometry | null = null;
/** A container, long along z, its base at y = 0; each face mapped to its part of the texture */
export function containerGeometry(): THREE.BufferGeometry {
  if (containerGeo) return containerGeo;
  const geo = new THREE.BoxGeometry(BOX_W, BOX_H, BOX_L);
  geo.translate(0, BOX_H / 2, 0);
  const uv = geo.getAttribute('uv') as THREE.BufferAttribute;
  // Faces in BoxGeometry's order: +x, -x, +y, -y, +z, -z (four vertices each)
  const regions: Array<[number, number, number, number]> = [
    [0, 1, 0.5, 1], [0, 1, 0.5, 1], // the long sides
    [0.25, 0.75, 0, 0.5], [0.25, 0.75, 0, 0.5], // roof and floor
    [0, 0.25, 0, 0.5], [0, 0.25, 0, 0.5], // the door ends
  ];
  for (let face = 0; face < 6; face++) {
    const [u0, u1, v0, v1] = regions[face];
    for (let k = 0; k < 4; k++) {
      const i = face * 4 + k;
      uv.setXY(i, u0 + uv.getX(i) * (u1 - u0), v0 + uv.getY(i) * (v1 - v0));
    }
  }
  containerGeo = geo;
  return geo;
}

const containerMaterials = new Map<number, THREE.MeshStandardMaterial>();
/** The material of a container in this livery (one shared per livery) */
export function containerMaterial(livery: number): THREE.MeshStandardMaterial {
  const index = ((livery % LIVERIES.length) + LIVERIES.length) % LIVERIES.length;
  let m = containerMaterials.get(index);
  if (!m) {
    const { hex, name } = LIVERIES[index];
    m = new THREE.MeshStandardMaterial({ map: containerTexture(hex, name, index + 3), roughness: 0.62, metalness: 0.3 });
    m.name = `container ${name}`;
    containerMaterials.set(index, m);
  }
  return m;
}

/** A single container in a livery (one that moves: on a crane, on a truck) */
export function containerMesh(livery: number): THREE.Mesh {
  const mesh = new THREE.Mesh(containerGeometry(), containerMaterial(livery));
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.name = 'container';
  return mesh;
}

/**
 * Collects still containers (a yard, a ship's deck) and draws them as one instanced batch per livery.
 * `put` takes the middle of the box's base and its turn about the vertical.
 */
export class ContainerStacks {
  private readonly byLivery = new Map<number, THREE.Matrix4[]>();
  private readonly q = new THREE.Quaternion();
  private readonly up = new THREE.Vector3(0, 1, 0);

  public put(livery: number, x: number, baseY: number, z: number, yaw = 0): this {
    const index = ((livery % LIVERIES.length) + LIVERIES.length) % LIVERIES.length;
    const list = this.byLivery.get(index) ?? [];
    this.q.setFromAxisAngle(this.up, yaw);
    list.push(new THREE.Matrix4().compose(new THREE.Vector3(x, baseY, z), this.q, new THREE.Vector3(1, 1, 1)));
    this.byLivery.set(index, list);
    return this;
  }

  public build(name: string): THREE.Group {
    const group = new THREE.Group();
    group.name = name;
    for (const [livery, list] of this.byLivery) {
      const mesh = new THREE.InstancedMesh(containerGeometry(), containerMaterial(livery), list.length);
      list.forEach((m, i) => mesh.setMatrixAt(i, m));
      mesh.instanceMatrix.needsUpdate = true;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.computeBoundingSphere();
      group.add(mesh);
    }
    return group;
  }
}

/** A hull plan (x across, z along) from the stern at z = -half to a bow at z = +half */
function hullShape(halfWidth: number, half: number, inset = 0): THREE.Shape {
  const w = halfWidth - inset;
  const s = new THREE.Shape();
  // The shape is drawn in (x, -z) so that, extruded and stood up, its bow points to +z
  s.moveTo(-w, half - inset * 0.5);
  s.lineTo(-w + 1.2, half - 0.2 - inset * 0.5);
  s.lineTo(w - 1.2, half - 0.2 - inset * 0.5);
  s.lineTo(w, half - inset * 0.5);
  s.lineTo(w, -half * 0.45);
  s.quadraticCurveTo(w, -half + 3, 0, -half + inset);
  s.quadraticCurveTo(-w, -half + 3, -w, -half * 0.45);
  s.lineTo(-w, half - inset * 0.5);
  return s;
}

/** A slab of the hull, height h, standing on y = baseY */
function hullSlab(halfWidth: number, half: number, h: number, inset = 0): THREE.BufferGeometry {
  const geo = new THREE.ExtrudeGeometry(hullShape(halfWidth, half, inset), { depth: h, bevelEnabled: false, curveSegments: 10 });
  // Extruded along z: stood up so that depth is height, and the drawn (x, -z) becomes (x, z)
  geo.rotateX(-Math.PI / 2);
  return geo;
}

/**
 * A container ship, built round its own middle with its bow to the south (+z): red below the waterline,
 * dark blue above, a white line along the deck edge; a white superstructure aft with its bridge, bridge
 * wings, funnel in the line's colours, mast and radar; lifeboats; boxes on deck in bays between
 * lashing bridges; anchors at the bow and the name on bow and stern.
 */
export function containerShip(name: string, random: () => number, deckBoxes = new ContainerStacks(), at: [number, number] = [0, 0]): { ship: THREE.Group; deckBoxes: ContainerStacks } {
  const b = new Builder();
  const HALF_W = 5.2;
  const HALF_L = 24;
  // The hull: 1.6 m of red under the waterline, then the dark topsides, then the deck edge
  b.shape(0x8b1e1e, hullSlab(HALF_W, HALF_L, 1.7), 0, -0.6, 0);
  b.shape(0x1e293b, hullSlab(HALF_W, HALF_L, 3.9), 0, 1.1, 0);
  b.shape(0xf8fafc, hullSlab(HALF_W + 0.04, HALF_L + 0.04, 0.18), 0, 4.95, 0);
  b.shape(0x57534e, hullSlab(HALF_W - 0.25, HALF_L - 0.25, 0.1), 0, 5.0, 0, {});
  // The forecastle at the bow, raised a little, with a breakwater
  // (where the hull is still full width, so nothing stands out past its sides as it narrows)
  b.box(0x1e293b, 9.8, 1.2, 3.2, 0, 5.1, 11.6).box(0xe5e7eb, 9.4, 0.9, 0.25, 0, 6.3, 10.1);
  // Anchors in their hawse pipes, each side of the bow, flush with the narrowing hull
  for (const s of [-1, 1]) b.box(0x111827, 0.15, 1.1, 1.2, s * 3.9, 2.9, 15.5, { yaw: -s * 0.35 }).box(0x374151, 0.2, 0.4, 0.4, s * 3.8, 4.2, 16);
  // The superstructure aft: five decks, windows all round, the bridge on top with wings
  b.box(0xf8fafc, 9, 9.5, 6.6, 0, 5.1, -16.6);
  for (let deck = 0; deck < 4; deck++) b.windows(0x1e3a5f, 6, 1, 8.4, 5.9 + deck * 2.2, 1.6, 0, -13.26, 0);
  b.box(0xf8fafc, 12.4, 2.1, 3.4, 0, 14.6, -15.2).box(0x0f172a, 11.6, 0.8, 0.08, 0, 15.6, -13.48, { glow: true });
  b.box(0xe5e7eb, 12.8, 0.25, 3.8, 0, 16.7, -15.2);
  // The funnel in the line's colours (green, white, green), a little behind the bridge
  b.box(0x0b7a43, 3.2, 4.2, 3.6, 0, 14.6, -19).box(0xf8fafc, 3.25, 1.2, 3.65, 0, 16.2, -19).box(0x111827, 3.25, 0.6, 3.65, 0, 18.8, -19);
  // Mast with radar and lights
  b.cylinder(0xe5e7eb, 0.12, 5, 0, 16.9, -15.6).box(0xe5e7eb, 2.6, 0.12, 0.12, 0, 20.6, -15.6).box(0x9ca3af, 1.6, 0.18, 0.3, 0, 21.6, -15.6);
  b.box(0xfef3c7, 0.2, 0.2, 0.2, 0, 22, -15.6, { glow: true });
  // Lifeboats on davits each side of the superstructure
  for (const s of [-1, 1]) {
    // Hung out over the side, clear of the superstructure, on their davit arms
    b.tube(0xf97316, 0.75, 0.6, 5, s * 5.6, 9.6, -17, { yaw: Math.PI / 2, sides: 10 });
    for (const dz of [-19, -15]) b.box(0xf8fafc, 0.15, 2.2, 0.15, s * 4.7, 9.2, dz).box(0xf8fafc, 1.2, 0.15, 0.15, s * 5.2, 11.3, dz);
  }
  // Boxes on deck: bays of three rows across and up to four high, lashing bridges between the bays (the
  // boxes go into the stacks given, placed where the ship will be: the yard's batches draw them too)
  for (let bay = 0; bay < 4; bay++) {
    const z = -9 + bay * 6.5;
    b.box(0x9ca3af, 9.6, 2.6, 0.25, 0, 5.1, z - 3.3).box(0x6b7280, 9.6, 0.15, 0.6, 0, 7.7, z - 3.3);
    for (let column = 0; column < 3; column++) {
      // The bay nearest the crane is part unloaded
      const high = bay === 1 ? Math.floor(random() * 2) : 1 + Math.floor(random() * 4);
      for (let level = 0; level < high; level++) deckBoxes.put(Math.floor(random() * LIVERIES.length), at[0] + (column - 1) * 2.7, 5.1 + level * BOX_H, at[1] + z);
    }
  }
  const ship = b.build('cargo ship', { roughness: 0.55, metalness: 0.2 });
  // The name on both sides of the bow, and on the stern with the port of registry
  for (const s of [-1, 1]) {
    const plate = signBoard([name], 7, 0.9, '#1e293b', '#f8fafc');
    plate.position.set(s * (HALF_W + 0.03), 4.0, 15);
    plate.rotation.y = s * Math.PI / 2;
    ship.add(plate);
  }
  const stern = signBoard([name, 'LAGOS'], 6, 1.6, '#1e293b', '#f8fafc');
  stern.position.set(0, 3.2, -HALF_L - 0.05);
  stern.rotation.y = Math.PI;
  ship.add(stern);
  return { ship, deckBoxes };
}

/**
 * A ship-to-shore crane's detail, added to the builder already holding its legs and boom: cross-bracing
 * between the legs, a trussed underside to the boom, a ladder up a leg, warning stripes at the foot of
 * each leg, and the machinery house.
 */
export function craneDetail(b: Builder, legsX: [number, number], zc: number, boomY: number, colour: number): void {
  const [xa, xb] = legsX;
  const span = xb - xa;
  // Cross-bracing in each pair of legs (the x-y frame either side), and between the pairs (the z frame)
  for (const dz of [-5, 5]) {
    for (const [y0, y1] of [[4.6, 13], [13, 19.5]] as const) {
      const rise = y1 - y0;
      const len = Math.hypot(span, rise);
      const tilt = Math.atan2(rise, span);
      b.box(colour, len, 0.35, 0.35, (xa + xb) / 2, (y0 + y1) / 2 - 0.175, zc + dz, { roll: tilt });
      b.box(colour, len, 0.35, 0.35, (xa + xb) / 2, (y0 + y1) / 2 - 0.175, zc + dz, { roll: -tilt });
    }
  }
  // The boom's underside: a truss of diagonals under the girder, out over the water and back over the yard
  const from = -36;
  const to = 4;
  for (let x = from; x < to; x += 2.5) {
    b.box(0xeab308, 2.9, 0.12, 0.12, x + 1.25, boomY - 1.95, zc - 0.7, { roll: 0.55 });
    b.box(0xeab308, 2.9, 0.12, 0.12, x + 1.25, boomY - 1.95, zc + 0.7, { roll: -0.55 });
  }
  b.box(0xeab308, to - from, 0.2, 0.2, (from + to) / 2, boomY - 2.6, zc - 0.7).box(0xeab308, to - from, 0.2, 0.2, (from + to) / 2, boomY - 2.6, zc + 0.7);
  // A ladder up the landward leg, and black and yellow warning stripes at the feet
  for (let y = 0.6; y < 19; y += 0.45) b.box(0xe5e7eb, 0.5, 0.05, 0.05, xb + 0.55, y, zc - 5);
  b.box(0xe5e7eb, 0.05, 19, 0.05, xb + 0.3, 0, zc - 5).box(0xe5e7eb, 0.05, 19, 0.05, xb + 0.8, 0, zc - 5);
  for (const x of [xa, xb]) {
    for (const dz of [-5, 5]) {
      for (let k = 0; k < 4; k++) b.box(k % 2 ? 0x111827 : 0xfacc15, 0.95, 0.3, 0.95, x, 0.3 + k * 0.3, zc + dz);
    }
  }
  // The machinery house on the back of the boom, with its vents
  b.box(0xe5e7eb, 7, 3.4, 5, 3, boomY + 0.7, zc).box(0x94a3b8, 6.6, 0.2, 4.6, 3, boomY + 4.1, zc);
  for (let k = -2; k <= 2; k++) b.box(0x64748b, 0.8, 1.2, 0.05, 3 + k * 1.2, boomY + 1.8, zc + 2.52);
}

/**
 * A yard truck (a terminal tractor) with its trailer: a short cab with windows on one side, exhaust
 * stack, chassis, the trailer's frame for a box, and real wheels. Built round the middle of its length,
 * cab toward +x.
 */
export function yardTruck(): THREE.Group {
  const b = new Builder();
  // Chassis and trailer frame
  b.box(0x1f2937, 9.4, 0.35, 2.1, -0.3, 0.55, 0);
  b.box(0x374151, 6.4, 0.2, 2.3, -1, 0.9, 0);
  for (const z of [-1.05, 1.05]) b.box(0x4b5563, 6.4, 0.25, 0.15, -1, 1.0, z);
  // The cab: offset to one side, as terminal tractors are, with big windows
  b.box(0xfacc15, 2.2, 2.3, 1.5, 3.4, 0.9, -0.35);
  b.box(0x1e3a5f, 0.05, 1.0, 1.2, 4.51, 2.0, -0.35).box(0x1e3a5f, 1.6, 1.0, 0.05, 3.4, 2.0, 0.41).box(0x1e3a5f, 1.6, 1.0, 0.05, 3.4, 2.0, -1.11);
  b.box(0x111827, 2.3, 0.15, 1.6, 3.4, 3.2, -0.35);
  b.cylinder(0x374151, 0.09, 1.8, 2.6, 1.6, 0.7).box(0xfacc15, 1.6, 0.6, 2.1, 3.6, 0.55, 0.35);
  b.box(0xf97316, 0.4, 0.15, 0.4, 3.4, 3.35, -0.35, { glow: true });
  // Wheels: tyres with hubs, two at the front, four at the back of the trailer
  const wheel = (x: number, z: number) => {
    b.cylinder(0x111827, 0.5, 0.38, x, 0.5 - 0.19, z, { pitch: Math.PI / 2, sides: 16 });
    b.cylinder(0x9ca3af, 0.24, 0.4, x, 0.5 - 0.2, z, { pitch: Math.PI / 2, sides: 10 });
  };
  for (const z of [-1.0, 1.0]) {
    wheel(3.2, z);
    wheel(-3.0, z);
    wheel(-4.0, z);
  }
  return b.build('yard tractor', { roughness: 0.6, metalness: 0.25 });
}
