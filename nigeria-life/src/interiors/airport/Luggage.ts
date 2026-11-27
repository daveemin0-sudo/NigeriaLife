import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';

/**
 * The bags people carry through a Nigerian airport, shaped like the real things, not boxes: hard-shell
 * rollers with ribs, a zip seam, corner wheels and a pull handle; Ghana-must-go bags in their checked
 * cloth with webbing handles; soft duffels; cartons taped and tied with rope. Each kind is one
 * instanced mesh, so a hall full of bags is a handful of draws.
 *
 * Every bag stands with its origin on the floor under its middle. A roller's front (ribbed) face is +z,
 * its handle and wheels at the back (-z); lying on a belt it is turned onto its back.
 */
export type BagKind = 'roller' | 'rollerLying' | 'ghana' | 'duffel' | 'carton' | 'trolley';

const SHELL = 1;
const DARK = 0.07;
const GREY = 0.45;

/** Paints every vertex of a geometry one shade (the instance colour multiplies it) */
function shade(geo: THREE.BufferGeometry, v: number): THREE.BufferGeometry {
  const g = geo.index ? geo.toNonIndexed() : geo;
  if (!g.getAttribute('uv')) g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(g.getAttribute('position').count * 2), 2));
  const n = g.getAttribute('position').count;
  const c = new Float32Array(n * 3).fill(v);
  g.setAttribute('color', new THREE.BufferAttribute(c, 3));
  return g;
}

function box(w: number, h: number, d: number, x: number, y: number, z: number, v: number): THREE.BufferGeometry {
  const g = new THREE.BoxGeometry(w, h, d);
  g.translate(x, y, z);
  return shade(g, v);
}

function wheel(x: number, z: number): THREE.BufferGeometry {
  const g = new THREE.CylinderGeometry(0.032, 0.032, 0.03, 10);
  g.rotateZ(Math.PI / 2);
  g.translate(x, 0.032, z);
  return shade(g, DARK);
}

/** A hard-shell roller, upright, its handle out (pulled) or in */
function roller(handleOut: boolean): THREE.BufferGeometry {
  const w = 0.42, h = 0.6, d = 0.25, lift = 0.06;
  const parts: THREE.BufferGeometry[] = [];
  const body = new RoundedBoxGeometry(w, h, d, 3, 0.045);
  body.translate(0, lift + h / 2, 0);
  parts.push(shade(body, SHELL));
  // Ribs down the front and back shells
  for (const x of [-0.12, -0.04, 0.04, 0.12]) {
    parts.push(box(0.022, h - 0.12, 0.012, x, lift + h / 2, d / 2 + 0.002, 0.82));
    parts.push(box(0.022, h - 0.12, 0.012, x, lift + h / 2, -d / 2 - 0.002, 0.82));
  }
  // The zip seam all round the middle, and the carry handle on top
  parts.push(box(w + 0.006, h - 0.04, 0.016, 0, lift + h / 2, 0, DARK));
  parts.push(box(0.16, 0.025, 0.035, 0, lift + h + 0.02, 0, DARK));
  // Four spinner wheels
  for (const x of [-w / 2 + 0.05, w / 2 - 0.05]) for (const z of [-d / 2 + 0.05, d / 2 - 0.05]) parts.push(wheel(x, z), box(0.04, 0.03, 0.04, x, 0.06, z, DARK));
  // The telescopic handle at the back
  const top = handleOut ? lift + h + 0.42 : lift + h + 0.03;
  for (const x of [-0.11, 0.11]) parts.push(box(0.022, top - (lift + h - 0.1), 0.022, x, (top + lift + h - 0.1) / 2, -d / 2 + 0.03, GREY));
  parts.push(box(0.26, 0.035, 0.035, 0, top, -d / 2 + 0.03, DARK));
  return mergeGeometries(parts, false)!;
}

/** A roller on its back on the belt, wheels toward the outside */
function rollerLying(): THREE.BufferGeometry {
  const g = roller(false);
  g.rotateX(-Math.PI / 2);
  // Back (handle side) now down: lift so the back shell rests on y = 0
  g.translate(0, 0.14, 0.35);
  return g;
}

/** The checked cloth bag: big, soft-cornered, a zip along the top and webbing handles */
function ghana(): THREE.BufferGeometry {
  const w = 0.7, h = 0.42, d = 0.34;
  const parts: THREE.BufferGeometry[] = [];
  const body = new RoundedBoxGeometry(w, h, d, 3, 0.07);
  body.translate(0, h / 2, 0);
  // Its faces bulge a little, as a full cloth bag does
  const pos = body.getAttribute('position');
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i) - h / 2, z = pos.getZ(i);
    const bulge = (1 - (x / (w / 2)) ** 2) * (1 - (y / (h / 2)) ** 2) * 0.04;
    pos.setZ(i, z + Math.sign(z) * bulge);
  }
  body.computeVertexNormals();
  parts.push(shade(body, SHELL));
  parts.push(box(w - 0.1, 0.02, 0.03, 0, h + 0.005, 0, DARK));
  for (const z of [-0.06, 0.06]) {
    parts.push(box(0.04, 0.1, 0.012, -0.12, h + 0.04, z, 0.18));
    parts.push(box(0.04, 0.1, 0.012, 0.12, h + 0.04, z, 0.18));
    parts.push(box(0.28, 0.03, 0.012, 0, h + 0.09, z, 0.18));
  }
  return mergeGeometries(parts, false)!;
}

/** A soft duffel: a rounded tube with its end panels and a strap */
function duffel(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  const body = new THREE.CapsuleGeometry(0.16, 0.36, 4, 12);
  body.rotateZ(Math.PI / 2);
  body.scale(1, 0.95, 0.9);
  body.translate(0, 0.16, 0);
  parts.push(shade(body, SHELL));
  // Stitched end panels in the bag's own cloth, a shade deeper
  parts.push(box(0.02, 0.3, 0.27, -0.245, 0.16, 0, 0.72), box(0.02, 0.3, 0.27, 0.245, 0.16, 0, 0.72));
  parts.push(box(0.44, 0.02, 0.025, 0, 0.32, 0, DARK));
  parts.push(box(0.04, 0.12, 0.02, -0.1, 0.36, 0, DARK), box(0.04, 0.12, 0.02, 0.1, 0.36, 0, DARK), box(0.24, 0.025, 0.02, 0, 0.42, 0, DARK));
  return mergeGeometries(parts, false)!;
}

/** A carton, taped and tied with rope both ways: half the belt at Lagos arrivals */
function carton(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  parts.push(box(0.55, 0.4, 0.42, 0, 0.2, 0, SHELL));
  parts.push(box(0.56, 0.006, 0.07, 0, 0.402, 0, 0.92)); // tape
  parts.push(box(0.012, 0.41, 0.43, 0.08, 0.2, 0, 0.35), box(0.56, 0.41, 0.012, 0, 0.2, -0.05, 0.35)); // rope
  return mergeGeometries(parts, false)!;
}

/** An airport luggage trolley: the push bar and its basket frame at the back (-z), the load bed in front */
function trolley(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  const steel = 0.75;
  parts.push(box(0.56, 0.03, 0.82, 0, 0.17, 0.08, steel));
  for (const x of [-0.26, 0.26]) {
    parts.push(box(0.03, 0.03, 0.86, x, 0.19, 0.08, steel));
    // The back frame rising to the push bar, leaning back a little
    const post = new THREE.BoxGeometry(0.03, 0.92, 0.03);
    post.rotateX(-0.18);
    post.translate(x, 0.62, -0.38);
    parts.push(shade(post, steel));
  }
  parts.push(box(0.6, 0.04, 0.04, 0, 1.06, -0.47, DARK)); // push bar (rubber grip)
  for (const y of [0.45, 0.72]) parts.push(box(0.52, 0.02, 0.02, 0, y, -0.33 - (y - 0.45) * 0.18, steel));
  for (const [x, z] of [[-0.22, 0.42], [0.22, 0.42], [-0.22, -0.3], [0.22, -0.3]]) parts.push(wheel(x, z), box(0.03, 0.12, 0.03, x, 0.1, z, DARK));
  return mergeGeometries(parts, false)!;
}

/** The red-white-blue check of the cloth, drawn once */
let ghanaMap: THREE.CanvasTexture | null = null;
function checkCloth(): THREE.CanvasTexture {
  if (ghanaMap) return ghanaMap;
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d')!;
  g.fillStyle = '#f2efe6';
  g.fillRect(0, 0, 128, 128);
  const band = (colour: string, alpha: number, at: number, size: number) => {
    g.globalAlpha = alpha;
    g.fillStyle = colour;
    g.fillRect(at, 0, size, 128);
    g.fillRect(0, at, 128, size);
  };
  band('#1d3f8f', 0.85, 0, 26);
  band('#1d3f8f', 0.85, 64, 26);
  band('#b3261e', 0.7, 34, 10);
  band('#b3261e', 0.7, 98, 10);
  band('#111827', 0.3, 50, 4);
  band('#111827', 0.3, 114, 4);
  g.globalAlpha = 1;
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(2.2, 1.4);
  ghanaMap = tex;
  return tex;
}

let shared: Record<BagKind, { geo: THREE.BufferGeometry; mat: THREE.Material }> | null = null;
function kinds(): Record<BagKind, { geo: THREE.BufferGeometry; mat: THREE.Material }> {
  if (shared) return shared;
  const hard = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.32, metalness: 0.05, name: 'bag shell' });
  const soft = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, metalness: 0, name: 'bag cloth' });
  const cloth = new THREE.MeshStandardMaterial({ vertexColors: true, map: checkCloth(), roughness: 0.8, metalness: 0, name: 'ghana-must-go' });
  const card = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, metalness: 0, name: 'carton' });
  const metal = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.4, metalness: 0.6, name: 'trolley' });
  shared = {
    roller: { geo: roller(true), mat: hard },
    rollerLying: { geo: rollerLying(), mat: hard },
    ghana: { geo: ghana(), mat: cloth },
    duffel: { geo: duffel(), mat: soft },
    carton: { geo: carton(), mat: card },
    trolley: { geo: trolley(), mat: metal },
  };
  return shared;
}

/** The colours bags come in (a carton is always cardboard, a Ghana-must-go bag its cloth) */
export const BAG_COLOURS = [0x1f2937, 0x111827, 0x7f1d1d, 0x1e3a8a, 0x0f766e, 0x6b7280, 0xb45309, 0x9d174d, 0x4c1d95, 0xd4d4d8, 0x14532d, 0xc2410c];
export const CARTON = 0xc49a6c;

/** Bags drawn this frame: begin, add each, end */
export class LuggageBatch {
  public readonly group = new THREE.Group();
  private readonly meshes = new Map<BagKind, THREE.InstancedMesh>();
  private readonly counts = new Map<BagKind, number>();
  private readonly colour = new THREE.Color();

  constructor(capacity: Partial<Record<BagKind, number>>) {
    this.group.name = 'interior_npc_luggage';
    const k = kinds();
    for (const kind of Object.keys(capacity) as BagKind[]) {
      const mesh = new THREE.InstancedMesh(k[kind].geo, k[kind].mat, capacity[kind]!);
      mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(capacity[kind]! * 3).fill(1), 3);
      mesh.frustumCulled = false;
      mesh.castShadow = false;
      mesh.receiveShadow = true;
      mesh.count = 0;
      mesh.name = `luggage · ${kind}`;
      this.meshes.set(kind, mesh);
      this.group.add(mesh);
    }
  }

  public begin(): void {
    for (const kind of this.meshes.keys()) this.counts.set(kind, 0);
  }

  public add(kind: BagKind, matrix: THREE.Matrix4, colour: number): void {
    const mesh = this.meshes.get(kind);
    if (!mesh) return;
    const i = this.counts.get(kind) ?? 0;
    if (i >= mesh.instanceMatrix.count) return;
    mesh.setMatrixAt(i, matrix);
    mesh.setColorAt(i, this.colour.setHex(kind === 'carton' ? CARTON : kind === 'ghana' || kind === 'trolley' ? 0xffffff : colour));
    this.counts.set(kind, i + 1);
  }

  public end(): void {
    for (const [kind, mesh] of this.meshes) {
      mesh.count = this.counts.get(kind) ?? 0;
      mesh.visible = mesh.count > 0;
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    }
  }
}
