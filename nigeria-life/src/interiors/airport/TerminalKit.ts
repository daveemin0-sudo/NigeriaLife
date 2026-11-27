import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { assetUrl } from '../../assets/assetUrl';

/**
 * What the airport terminal is made of: real surfaces (polished marble, brushed metal, wood
 * veneer, leather, concrete, terrazzo; CC0 textures from ambientCG, sized for phones), glass,
 * lit signs, soft pools of light on the floor and contact shadows under things. Every part of
 * one area is merged into one mesh per material, so a whole check-in hall costs a handful of draws.
 */

const loader = new THREE.TextureLoader();
const textures = new Map<string, THREE.Texture>();

function texture(name: string, colour: boolean, repeat: number): THREE.Texture {
  const key = `${name}|${repeat}`;
  let tex = textures.get(key);
  if (!tex) {
    tex = loader.load(assetUrl(`textures/airport/${name}.jpg`));
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(repeat, repeat);
    tex.anisotropy = 4;
    if (colour) tex.colorSpace = THREE.SRGBColorSpace;
    textures.set(key, tex);
  }
  return tex;
}

/** A surface from the texture set, repeated this many times across one unit of its UVs */
function surface(set: string, repeat: number, options: THREE.MeshStandardMaterialParameters): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    map: texture(`${set}-color`, true, repeat),
    normalMap: texture(`${set}-normal`, false, repeat),
    roughnessMap: texture(`${set}-rough`, false, repeat),
    ...options,
  });
}

const plain = (color: number, roughness = 0.6, metalness = 0) => new THREE.MeshStandardMaterial({ color, roughness, metalness });

/** The terminal's materials, made once and shared by every part */
export const M = {
  /** Polished grey marble: the hall floor (the plane is given world-scaled UVs) */
  floor: (() => {
    // Honed, not mirror: a mirror-polished floor showed the sky as dark bands and streaks
    const m = surface('marble', 1, { color: 0xf1ebe1, roughness: 0.55, metalness: 0 });
    m.normalMap = null;
    m.envMapIntensity = 0.35;
    return m;
  })(),
  /** The grout between floor tiles */
  joint: plain(0x8d8a84, 0.9),
  /** The same stone, dark: borders and strips */
  floorDark: surface('marble', 1, { color: 0x3b4048, roughness: 0.45, metalness: 0, envMapIntensity: 0.4 }),
  terrazzo: surface('terrazzo', 1, { roughness: 0.35 }),
  carpet: surface('concrete', 1, { color: 0x6b7a8f, roughness: 1, metalness: 0, envMapIntensity: 0.2 }),
  apron: surface('concrete', 1, { color: 0x9a9a96, roughness: 0.95 }),
  metal: surface('metal', 1, { color: 0xd6dade, roughness: 0.38, metalness: 0.85 }),
  metalDark: surface('metal', 1, { color: 0x4b5563, roughness: 0.4, metalness: 0.8 }),
  wood: surface('wood', 1, { color: 0xc9a77f, roughness: 0.45 }),
  woodDark: surface('wood', 1, { color: 0x6b4a2e, roughness: 0.5 }),
  leather: surface('leather', 1, { color: 0x3a3a3c, roughness: 0.55 }),
  leatherTan: surface('leather', 1, { color: 0xb98a5e, roughness: 0.5 }),
  /** A lit ceiling panel */
  lamp: new THREE.MeshBasicMaterial({ color: 0xfff8ea }),
  plaster: plain(0xf2efe9, 0.85),
  plasterWarm: plain(0xe7dccb, 0.85),
  solid: plain(0xf8f8f6, 0.35),
  steel: plain(0xc3c8ce, 0.28, 0.9),
  chrome: plain(0xe8ebef, 0.12, 1),
  black: plain(0x15171a, 0.45, 0.2),
  rubber: plain(0x1c1d20, 0.9),
  screen: plain(0x0b0f17, 0.15, 0.4),
  green: plain(0x0f7a46, 0.5),
  red: plain(0xb3261e, 0.5),
  yellow: plain(0xf2b705, 0.5),
  plantPot: plain(0x2f3338, 0.6),
  leaf: plain(0x2f7d3a, 0.75),
  leafLight: plain(0x4f9e45, 0.75),
  glass: new THREE.MeshStandardMaterial({ color: 0xbcd8e4, roughness: 0.04, metalness: 0.25, transparent: true, opacity: 0.2, depthWrite: false, side: THREE.DoubleSide }),
  glassShelf: new THREE.MeshStandardMaterial({ color: 0xdff1f7, roughness: 0.05, metalness: 0.1, transparent: true, opacity: 0.35, depthWrite: false }),
};

/** World-scaled UVs on a flat floor plane laid in x and z, one texture tile every `tile` metres */
export function floorPlane(width: number, length: number, tile: number): THREE.PlaneGeometry {
  const geo = new THREE.PlaneGeometry(width, length);
  geo.rotateX(-Math.PI / 2);
  const uv = geo.getAttribute('uv') as THREE.BufferAttribute;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, (uv.getX(i) * width) / tile, (uv.getY(i) * length) / tile);
  return geo;
}

/**
 * Parts gathered by material and merged into one mesh each when built. Positions are given by the
 * middle of a part's base, as a person would measure furniture on a floor plan.
 */
export class Kit {
  private readonly parts = new Map<THREE.Material, THREE.BufferGeometry[]>();
  private readonly matrix = new THREE.Matrix4();
  private readonly quat = new THREE.Quaternion();
  private readonly euler = new THREE.Euler();
  private readonly one = new THREE.Vector3(1, 1, 1);
  private readonly at = new THREE.Vector3();

  /** Any geometry, its own origin placed at this point and turned */
  public geo(material: THREE.Material, geometry: THREE.BufferGeometry, x: number, y: number, z: number, yaw = 0, pitch = 0, roll = 0): this {
    const flat = geometry.index ? geometry.toNonIndexed() : geometry;
    if (!flat.getAttribute('uv')) {
      const count = flat.getAttribute('position').count;
      flat.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(count * 2), 2));
    }
    this.euler.set(pitch, yaw, roll, 'YXZ');
    this.matrix.compose(this.at.set(x, y, z), this.quat.setFromEuler(this.euler), this.one);
    flat.applyMatrix4(this.matrix);
    const list = this.parts.get(material) ?? [];
    list.push(flat);
    this.parts.set(material, list);
    if (flat !== geometry) geometry.dispose();
    return this;
  }

  /** A box by its size and the middle of its base */
  public box(material: THREE.Material, w: number, h: number, d: number, x: number, y: number, z: number, yaw = 0, pitch = 0, roll = 0): this {
    const geo = new THREE.BoxGeometry(w, h, d);
    geo.translate(0, h / 2, 0);
    return this.geo(material, geo, x, y, z, yaw, pitch, roll);
  }

  /** A box with its edges rounded off: counters, cushions, kiosks */
  public soft(material: THREE.Material, w: number, h: number, d: number, x: number, y: number, z: number, radius = 0.05, yaw = 0): this {
    const r = Math.min(radius, w / 2 - 0.001, d / 2 - 0.001);
    const shape = new THREE.Shape();
    shape.moveTo(-w / 2 + r, -d / 2);
    shape.lineTo(w / 2 - r, -d / 2);
    shape.quadraticCurveTo(w / 2, -d / 2, w / 2, -d / 2 + r);
    shape.lineTo(w / 2, d / 2 - r);
    shape.quadraticCurveTo(w / 2, d / 2, w / 2 - r, d / 2);
    shape.lineTo(-w / 2 + r, d / 2);
    shape.quadraticCurveTo(-w / 2, d / 2, -w / 2, d / 2 - r);
    shape.lineTo(-w / 2, -d / 2 + r);
    shape.quadraticCurveTo(-w / 2, -d / 2, -w / 2 + r, -d / 2);
    const bevel = Math.min(r * 0.6, h / 3);
    const geo = new THREE.ExtrudeGeometry(shape, { depth: Math.max(0.001, h - bevel * 2), bevelEnabled: bevel > 0.002, bevelThickness: bevel, bevelSize: bevel * 0.8, bevelSegments: 2, curveSegments: 3 });
    geo.rotateX(-Math.PI / 2);
    geo.translate(0, bevel, 0);
    // Texture across the top as a person sees it, about a metre to a tile
    const uv = geo.getAttribute('uv') as THREE.BufferAttribute;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 0.8, uv.getY(i) * 0.8);
    return this.geo(material, geo, x, y, z, yaw);
  }

  /** An upright cylinder by its middle of base */
  public cyl(material: THREE.Material, radiusTop: number, radiusBottom: number, h: number, x: number, y: number, z: number, sides = 16, pitch = 0, roll = 0): this {
    const geo = new THREE.CylinderGeometry(radiusTop, radiusBottom, h, sides);
    geo.translate(0, h / 2, 0);
    return this.geo(material, geo, x, y, z, 0, pitch, roll);
  }

  /** A cylinder lying along x, by its middle */
  public rod(material: THREE.Material, radius: number, length: number, x: number, y: number, z: number, yaw = 0, sides = 10): this {
    const geo = new THREE.CylinderGeometry(radius, radius, length, sides);
    geo.rotateZ(Math.PI / 2);
    return this.geo(material, geo, x, y, z, yaw);
  }

  public get empty(): boolean {
    return this.parts.size === 0;
  }

  /** One mesh per material, under a group of this name */
  public build(name: string, shadows = false): THREE.Group {
    const group = new THREE.Group();
    group.name = name;
    for (const [material, list] of this.parts) {
      const merged = mergeGeometries(list, false);
      for (const g of list) g.dispose();
      if (!merged) continue;
      merged.computeBoundingSphere();
      const mesh = new THREE.Mesh(merged, material);
      mesh.name = `${name} · ${(material as THREE.MeshStandardMaterial).name || material.type}`;
      mesh.receiveShadow = true;
      mesh.castShadow = shadows;
      group.add(mesh);
    }
    this.parts.clear();
    return group;
  }
}

// --- Light and shade drawn on the floor ---------------------------------------------------------

function radial(inner: string, outer: string): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d')!;
  const grad = g.createRadialGradient(64, 64, 4, 64, 64, 64);
  grad.addColorStop(0, inner);
  grad.addColorStop(1, outer);
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

let poolMaterial: THREE.MeshBasicMaterial | null = null;
let shadeMaterial: THREE.MeshBasicMaterial | null = null;

/** A soft pool of light on the floor, as under a skylight or a row of downlights */
export function lightPool(width: number, length: number, x: number, z: number, strength = 0.22): THREE.Mesh {
  poolMaterial ??= new THREE.MeshBasicMaterial({ map: radial('rgba(255,247,230,1)', 'rgba(255,247,230,0)'), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
  const mat = poolMaterial.clone();
  mat.opacity = strength;
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, length), mat);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.set(x, 0.015, z);
  mesh.renderOrder = 1;
  mesh.name = 'light pool';
  return mesh;
}

/** The soft dark patch on the floor under a counter, a seat or a person standing */
export function contactShade(width: number, length: number, x: number, z: number, darkness = 0.45, yaw = 0): THREE.Mesh {
  shadeMaterial ??= new THREE.MeshBasicMaterial({ map: radial('rgba(0,0,0,1)', 'rgba(0,0,0,0)'), transparent: true, depthWrite: false });
  const mat = shadeMaterial.clone();
  mat.opacity = darkness;
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, length), mat);
  mesh.rotation.set(-Math.PI / 2, 0, yaw);
  mesh.position.set(x, 0.012, z);
  mesh.name = 'contact shade';
  return mesh;
}

// --- Signs -------------------------------------------------------------------------------------

export interface SignStyle {
  bg: string;
  fg: string;
  /** Pixels per metre */
  density?: number;
  font?: string;
  align?: CanvasTextAlign;
  accent?: string;
}

/** A lit sign: lines of text on a panel, drawn once into a texture */
export function signMesh(lines: string[], width: number, height: number, style: SignStyle): THREE.Mesh {
  const density = style.density ?? 160;
  const c = document.createElement('canvas');
  c.width = Math.max(64, Math.round(width * density));
  c.height = Math.max(32, Math.round(height * density));
  const g = c.getContext('2d')!;
  g.fillStyle = style.bg;
  g.fillRect(0, 0, c.width, c.height);
  if (style.accent) {
    g.fillStyle = style.accent;
    g.fillRect(0, c.height - Math.max(4, c.height * 0.06), c.width, Math.max(4, c.height * 0.06));
  }
  const rows = lines.length;
  const size = Math.min(c.height / (rows * 1.35), (c.width / Math.max(...lines.map((l) => l.length), 1)) * 1.7);
  g.font = `${style.font ?? '700'} ${Math.round(size)}px "Outfit", "Segoe UI", Arial, sans-serif`;
  g.fillStyle = style.fg;
  g.textBaseline = 'middle';
  g.textAlign = style.align ?? 'center';
  const x = g.textAlign === 'left' ? c.height * 0.25 : c.width / 2;
  lines.forEach((line, i) => g.fillText(line, x, (c.height / (rows + 0)) * (i + 0.5)));
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, height), new THREE.MeshBasicMaterial({ map: tex, toneMapped: false }));
  mesh.name = `sign ${lines[0]}`;
  return mesh;
}

/** The yellow-on-charcoal wayfinding style used by Nigerian airports */
export const WAYFINDING: SignStyle = { bg: '#22262c', fg: '#ffcc1a', density: 150 };

/**
 * Every floor shade and light pool under `root`, each a mesh of its own, merged into one mesh
 * of each kind: their strength moves into the vertex colours' alpha. Forty shades were forty draws.
 */
export function mergeFloorDecals(root: THREE.Object3D): void {
  root.updateWorldMatrix(true, true);
  const inverse = new THREE.Matrix4().copy(root.matrixWorld).invert();
  for (const kind of ['contact shade', 'light pool']) {
    const found: THREE.Mesh[] = [];
    root.traverse((o) => { if (o.name === kind && (o as THREE.Mesh).isMesh) found.push(o as THREE.Mesh); });
    if (found.length < 2) continue;
    const parts = found.map((mesh) => {
      const geo = mesh.geometry.clone().applyMatrix4(new THREE.Matrix4().multiplyMatrices(inverse, mesh.matrixWorld));
      const strength = (mesh.material as THREE.MeshBasicMaterial).opacity;
      const n = geo.attributes.position.count;
      const colour = new Float32Array(n * 4);
      for (let i = 0; i < n; i++) colour.set([1, 1, 1, strength], i * 4);
      geo.setAttribute('color', new THREE.BufferAttribute(colour, 4));
      return geo;
    });
    const merged = mergeGeometries(parts, false);
    if (!merged) continue;
    const material = (found[0].material as THREE.MeshBasicMaterial).clone();
    material.opacity = 1;
    material.vertexColors = true;
    const mesh = new THREE.Mesh(merged, material);
    mesh.name = kind;
    mesh.renderOrder = found[0].renderOrder;
    for (const m of found) {
      m.removeFromParent();
      m.geometry.dispose();
      (m.material as THREE.Material).dispose();
    }
    root.add(mesh);
  }
}
