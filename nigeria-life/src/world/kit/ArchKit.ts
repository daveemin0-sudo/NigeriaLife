import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { Obstruction } from '../plan/CityPlan';

/**
 * The building kit: the one way large structures are put together.
 *
 * A landmark is described as parts (walls, slabs, columns, roofs, stands, tanks, containers)
 * added to a `Builder`. The builder bakes each part's colour into its vertices and merges
 * everything into one mesh, so a whole stadium or terminal costs the graphics card one draw
 * call instead of hundreds. Parts that glow (windows at night, floodlights) go into a second
 * mesh. Things that move are kept out and made separately.
 *
 * Because the result is one mesh, it cannot be measured for the city plan the way a hand-built
 * group is. So each part says whether it stands on the ground, and the builder keeps the
 * list of what does: those are the building's footprints, handed to the plan directly.
 */

const colour = new THREE.Color();

function paint(geometry: THREE.BufferGeometry, hex: number): THREE.BufferGeometry {
  colour.setHex(hex);
  const count = geometry.attributes.position.count;
  const colours = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    colours[i * 3] = colour.r;
    colours[i * 3 + 1] = colour.g;
    colours[i * 3 + 2] = colour.b;
  }
  geometry.setAttribute('color', new THREE.BufferAttribute(colours, 3));
  return geometry;
}

export interface PartOptions {
  /** Turn about the vertical axis, radians */
  yaw?: number;
  /** Tilt about the x axis (ramps, sloping stands), radians */
  pitch?: number;
  /** Tilt about the z axis, radians */
  roll?: number;
  /** A body people and cars cannot pass through. Recorded as a footprint for the city plan. */
  solid?: boolean;
  /** Lit from within: stays bright at night */
  glow?: boolean;
}

export class Builder {
  private solidParts: THREE.BufferGeometry[] = [];
  private glowParts: THREE.BufferGeometry[] = [];
  private readonly matrix = new THREE.Matrix4();
  private readonly euler = new THREE.Euler();
  private readonly quaternion = new THREE.Quaternion();
  private readonly one = new THREE.Vector3(1, 1, 1);
  /** What stands on the ground, in the builder's own coordinates */
  public readonly footprints: Array<{ minX: number; maxX: number; minZ: number; maxZ: number; height: number }> = [];

  private originX = 0;
  private originZ = 0;

  /**
   * Says where the drawing's origin is. A place designed in the coordinates of the city it
   * was first built for can then be put down anywhere: its parts are given as drawn, and come
   * out measured from this point.
   */
  public around(x: number, z: number): this {
    this.originX = x;
    this.originZ = z;
    return this;
  }

  private place(geometry: THREE.BufferGeometry, hex: number, x: number, y: number, z: number, options: PartOptions): void {
    // Every part is flattened to the same kind of geometry so they can be merged
    const flat = geometry.index ? geometry.toNonIndexed() : geometry;
    flat.deleteAttribute('uv');
    this.euler.set(options.pitch ?? 0, options.yaw ?? 0, options.roll ?? 0, 'YXZ');
    this.matrix.compose(new THREE.Vector3(x - this.originX, y, z - this.originZ), this.quaternion.setFromEuler(this.euler), this.one);
    flat.applyMatrix4(this.matrix);
    paint(flat, hex);
    (options.glow ? this.glowParts : this.solidParts).push(flat);
    if (flat !== geometry) geometry.dispose();
  }

  /** A box, given by its size and the point at the middle of its base. */
  public box(hex: number, width: number, height: number, depth: number, x: number, baseY: number, z: number, options: PartOptions = {}): this {
    this.place(new THREE.BoxGeometry(width, height, depth), hex, x, baseY + height / 2, z, options);
    if (options.solid) {
      const turned = Math.abs(Math.sin(options.yaw ?? 0)) > 0.7;
      const w = turned ? depth : width;
      const d = turned ? width : depth;
      this.footprints.push({ minX: x - w / 2 - this.originX, maxX: x + w / 2 - this.originX, minZ: z - d / 2 - this.originZ, maxZ: z + d / 2 - this.originZ, height });
    }
    return this;
  }

  /** An upright cylinder (a column, a tank, a mast), by its radius and the middle of its base. */
  public cylinder(hex: number, radius: number, height: number, x: number, baseY: number, z: number, options: PartOptions & { topRadius?: number; sides?: number } = {}): this {
    this.place(new THREE.CylinderGeometry(options.topRadius ?? radius, radius, height, options.sides ?? 14), hex, x, baseY + height / 2, z, options);
    if (options.solid) this.footprints.push({ minX: x - radius - this.originX, maxX: x + radius - this.originX, minZ: z - radius - this.originZ, maxZ: z + radius - this.originZ, height });
    return this;
  }

  /** A cone or pyramid (a roof, a spire), by its base radius and the middle of its base. */
  public cone(hex: number, radius: number, height: number, x: number, baseY: number, z: number, sides = 4, options: PartOptions = {}): this {
    this.place(new THREE.ConeGeometry(radius, height, sides), hex, x, baseY + height / 2, z, options);
    return this;
  }

  /** A dome or half-ball. */
  public dome(hex: number, radius: number, x: number, baseY: number, z: number, options: PartOptions = {}): this {
    this.place(new THREE.SphereGeometry(radius, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), hex, x, baseY, z, options);
    return this;
  }

  /**
   * A tube lying on its side along x, its front toward +x: a fuselage, an engine, a tank on a
   * lorry. Given by its middle. The two ends may differ, which makes a nose or a tail cone.
   */
  public tube(hex: number, radiusBack: number, radiusFront: number, length: number, x: number, y: number, z: number, options: PartOptions & { sides?: number } = {}): this {
    const tube = new THREE.CylinderGeometry(radiusFront, radiusBack, length, options.sides ?? 16);
    tube.rotateZ(-Math.PI / 2);
    this.place(tube, hex, x, y, z, options);
    return this;
  }

  /** A flat ring painted on the ground: a centre circle, a helipad mark. */
  public ring(hex: number, inner: number, outer: number, x: number, y: number, z: number): this {
    const ring = new THREE.RingGeometry(inner, outer, 40);
    ring.rotateX(-Math.PI / 2);
    this.place(ring, hex, x, y, z, {});
    return this;
  }

  /** A flat sheet on the ground: tarmac, paint, grass, water. Never solid. */
  public ground(hex: number, width: number, depth: number, x: number, y: number, z: number, options: PartOptions = {}): this {
    const sheet = new THREE.PlaneGeometry(width, depth);
    sheet.rotateX(-Math.PI / 2);
    this.place(sheet, hex, x, y, z, options);
    return this;
  }

  /**
   * A wall of windows on one face of a building: `columns` by `rows` panes set just proud of
   * the wall. `facing` is the way the wall looks: 0 toward +z, π/2 toward +x, and so on.
   */
  public windows(hex: number, columns: number, rows: number, wallWidth: number, baseY: number, wallHeight: number, x: number, z: number, facing: number, options: PartOptions = {}): this {
    const paneW = (wallWidth / columns) * 0.62;
    const paneH = (wallHeight / rows) * 0.56;
    const alongX = Math.abs(Math.cos(facing)) > 0.5; // the wall runs along x when it faces ±z
    for (let c = 0; c < columns; c++) {
      for (let r = 0; r < rows; r++) {
        const along = -wallWidth / 2 + ((c + 0.5) * wallWidth) / columns;
        const y = baseY + ((r + 0.5) * wallHeight) / rows - paneH / 2;
        this.box(hex, alongX ? paneW : 0.08, paneH, alongX ? 0.08 : paneW, x + (alongX ? along : 0), y, z + (alongX ? 0 : along), options);
      }
    }
    return this;
  }

  /**
   * Says a block of ground is taken, without drawing anything: for a body made of many small
   * parts (a stand of stepped tiers, a stack of containers) that is one thing to walk round.
   */
  public occupy(minX: number, maxX: number, minZ: number, maxZ: number, height: number): this {
    this.footprints.push({ minX: minX - this.originX, maxX: maxX - this.originX, minZ: minZ - this.originZ, maxZ: maxZ - this.originZ, height });
    return this;
  }

  /** Finishes the building: one mesh for everything, and one for what glows if anything does. */
  public build(name: string): THREE.Group {
    const group = new THREE.Group();
    group.name = name;
    if (this.solidParts.length > 0) {
      const mesh = new THREE.Mesh(mergeGeometries(this.solidParts), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, metalness: 0.04 }));
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      // Measured for the city plan through its footprints, not through this one big mesh
      mesh.userData.surface = true;
      group.add(mesh);
      for (const part of this.solidParts) part.dispose();
    }
    if (this.glowParts.length > 0) {
      const mesh = new THREE.Mesh(mergeGeometries(this.glowParts), new THREE.MeshBasicMaterial({ vertexColors: true }));
      mesh.userData.surface = true;
      group.add(mesh);
      for (const part of this.glowParts) part.dispose();
    }
    this.solidParts = [];
    this.glowParts = [];
    return group;
  }

  /** The footprints as the city plan wants them, moved to where the building stands. */
  public obstructions(owner: string, atX: number, atZ: number): Obstruction[] {
    return this.footprints.map((part) => ({
      owner,
      // A wall counts as a building; a bollard or a low kerb is street furniture
      structure: part.height >= 2.4 && Math.min(part.maxX - part.minX, part.maxZ - part.minZ) >= 0.9,
      height: part.height,
      minX: part.minX + atX, maxX: part.maxX + atX, minZ: part.minZ + atZ, maxZ: part.maxZ + atZ,
    }));
  }
}

/** A board with writing on it, for names over doors and signs at gates. It reads from the front only: put something behind it. */
export function signBoard(lines: string[], width: number, height: number, background = '#0f172a', ink = '#f8fafc'): THREE.Mesh {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = Math.max(64, Math.round((1024 * height) / width));
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = background;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = ink;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  lines.forEach((line, index) => {
    let size = Math.round((canvas.height / lines.length) * (index === 0 ? 0.62 : 0.44));
    ctx.font = `800 ${size}px system-ui, sans-serif`;
    while (ctx.measureText(line).width > canvas.width - 40 && size > 14) {
      size -= 2;
      ctx.font = `800 ${size}px system-ui, sans-serif`;
    }
    ctx.fillText(line, canvas.width / 2, ((index + 0.5) * canvas.height) / lines.length);
  });
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, height), new THREE.MeshBasicMaterial({ map: texture }));
  mesh.userData.surface = true;
  return mesh;
}
