import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';

/**
 * Shapes with soft edges, for things that are not boxes: a mattress with rounded corners, a duvet
 * that drapes over the edge of the bed in folds, a plump pillow, a padded headboard, cushions, turned
 * wooden legs, a lamp's stem, the curve of a bath or a toilet bowl. Each is a BufferGeometry, made
 * round its own middle (or, for the lathe shapes, standing on y = 0), to be given to the building
 * kit's `shape()` or put in a mesh of its own.
 */

/** A box with rounded edges and corners, centred on its middle */
export function soft(width: number, height: number, depth: number, radius: number, segments = 3): THREE.BufferGeometry {
  const r = Math.min(radius, width / 2 - 0.001, height / 2 - 0.001, depth / 2 - 0.001);
  return new RoundedBoxGeometry(width, height, depth, segments, Math.max(0.001, r));
}

/**
 * A pillow or a cushion: a rounded slab, fuller in the middle than at its edges. Centred on its
 * middle, `width` across, `height` thick, `depth` front to back.
 */
export function pillow(width: number, height: number, depth: number): THREE.BufferGeometry {
  const g = new THREE.SphereGeometry(1, 24, 14);
  const p = g.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i);
    const y = p.getY(i);
    const z = p.getZ(i);
    // Squared off at the sides, plump at the middle, thinner at the corners
    const sx = Math.sign(x) * Math.pow(Math.abs(x), 0.55);
    const sz = Math.sign(z) * Math.pow(Math.abs(z), 0.55);
    const swell = 1 - 0.35 * Math.max(Math.abs(sx), Math.abs(sz)) ** 3;
    p.setXYZ(i, (sx * width) / 2, (y * height * swell) / 2, (sz * depth) / 2);
  }
  g.computeVertexNormals();
  return g;
}

/**
 * A duvet or bedspread over a mattress: flat and a little puffed on top, hanging over both sides
 * and the foot in soft folds. `width` and `length` are the top it lies on; `drop` how far it hangs.
 * The head end (−z) is folded back. Its top surface is at y = 0, centred on the middle of the top.
 */
export function duvet(width: number, length: number, drop: number, options: { folds?: number; puff?: number; seed?: number } = {}): THREE.BufferGeometry {
  const folds = options.folds ?? 5;
  const puff = options.puff ?? 0.035;
  const seed = options.seed ?? 1;
  const across = 40;
  const along = 40;
  const W = width + drop * 2;
  const L = length + drop;
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  const hw = width / 2;
  for (let j = 0; j <= along; j++) {
    for (let i = 0; i <= across; i++) {
      // Laid out flat: u across (−W/2..W/2), v along from the head (0..L)
      const u = -W / 2 + (W * i) / across;
      const v = (L * j) / along;
      const outX = Math.max(0, Math.abs(u) - hw);
      const outZ = Math.max(0, v - length);
      let x = Math.sign(u) * Math.min(Math.abs(u), hw);
      let z = -length / 2 + Math.min(v, length);
      let y = 0;
      if (outX > 0 || outZ > 0) {
        // Over the edge: down the side, a little out from it, in folds that deepen toward the hem
        const out = Math.max(outX, outZ);
        const t = out / drop;
        y = -Math.min(out, drop);
        const wave = Math.sin((outZ > 0 ? u : v) * folds * 1.7 + seed) * 0.035 * t + Math.sin((outZ > 0 ? u : v) * folds * 0.6 + seed * 2) * 0.02 * t;
        if (outX >= outZ) x = Math.sign(u) * (hw + 0.025 + t * 0.03 + wave);
        if (outZ > outX) z = length / 2 + 0.025 + t * 0.03 + wave;
        if (outX > 0 && outZ > 0) {
          // The corner: rounded off, falling where the two sides meet
          x = Math.sign(u) * (hw + 0.025 + t * 0.03);
          z = length / 2 + 0.025 + t * 0.03;
        }
      } else {
        // On top: puffed, quilted a little, with a few soft creases
        const nx = (u + hw) / width;
        const nz = v / length;
        const edge = Math.min(nx, 1 - nx, nz * 2, 1 - nz) * 4;
        y = puff * Math.min(1, edge) + Math.sin(nx * 9 + seed) * Math.sin(nz * 7 + seed * 0.7) * 0.008;
      }
      positions.push(x, y, z);
      uvs.push(i / across * (W / 1.2), j / along * (L / 1.2));
    }
  }
  const row = across + 1;
  for (let j = 0; j < along; j++) {
    for (let i = 0; i < across; i++) {
      const a = j * row + i;
      const b = a + 1;
      const c = a + row;
      const d = c + 1;
      indices.push(a, c, b, b, c, d);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  g.setIndex(indices);
  g.computeVertexNormals();
  return g;
}

/** A turned shape (a leg, a lamp's stem, a vase, a basin), from its profile: [radius, height] from the bottom up */
export function turned(profile: Array<[number, number]>, sides = 20): THREE.BufferGeometry {
  return new THREE.LatheGeometry(profile.map(([r, y]) => new THREE.Vector2(Math.max(0.0005, r), y)), sides);
}

/**
 * A bowl (a bath, a basin, a toilet pan): a smooth outside up to a rolled rim, and inside, walls that
 * curve down to a flat bottom. Turned round, then stretched to `width` by `depth`, standing on y = 0,
 * `height` tall. `wall` is how thick the rim is, as a share of the half-width.
 */
export function basin(width: number, depth: number, height: number, wall = 0.08, sides = 40): THREE.BufferGeometry {
  const h = height;
  const w = 1 - wall;
  const profile: Array<[number, number]> = [
    [0.86, 0], [0.97, 0.06 * h], [1.0, 0.2 * h], [1.0, 0.92 * h], [0.995, 0.985 * h], [0.97, h], [w + 0.01, h], [w, 0.97 * h],
    [w - 0.02, 0.7 * h], [w - 0.08, 0.42 * h], [w - 0.2, 0.22 * h], [w - 0.4, 0.13 * h], [0, 0.11 * h],
  ];
  const g = turned(profile, sides);
  g.scale(width / 2, 1, depth / 2);
  g.computeVertexNormals();
  return g;
}

/** A thin curved panel (a headboard with a soft top, a chair back): a rounded box bent a little about y */
export function curvedPanel(width: number, height: number, thickness: number, bend: number, radius = 0.03): THREE.BufferGeometry {
  const g = soft(width, height, thickness, radius, 3);
  const p = g.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i);
    p.setZ(i, p.getZ(i) - bend * (1 - (2 * x / width) ** 2));
  }
  g.computeVertexNormals();
  return g;
}
