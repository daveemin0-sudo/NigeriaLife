import * as THREE from 'three';
import { Builder } from '../world/kit/ArchKit';
import type { Obstruction } from '../world/plan/CityPlan';
import { between, junctionsOf, strip, type GridRoad } from '../world/plan/GridRoads';

export type { GridRoad } from '../world/plan/GridRoads';

/**
 * The drawing of a planned city's road grid (src/world/plan/GridRoads.ts has the roads): the
 * asphalt and its markings, medians and kerbs, pavements, zebras at the junctions, and lamps, in
 * a few merged meshes, each city in its own style.
 */

export interface GridStyle {
  asphalt: number;
  /** Lane dashes and edge lines */
  line: number;
  /** The centre line where there is no median: white in Abuja, yellow in Port Harcourt */
  centre: number;
  medianTop: number;
  kerb: number;
  /** Painted kerbs: every other two metres this colour (black and yellow in Port Harcourt) */
  kerbStripe?: number;
  pavement: number;
  /** The pavement's height above the road */
  top: number;
  lamp: 'twin' | 'single';
  /** An open drain along the kerb, as Port Harcourt's roads have */
  drain?: boolean;
}

/**
 * The roads drawn: asphalt and its markings, medians and kerbs, pavements, the junctions with
 * a zebra on each side, and the lamps. Everything is merged into a few meshes; the lamps and the
 * medians' ends are solid. Returns the drawing and what stands on the ground.
 */
export function buildGrid(name: string, roads: readonly GridRoad[], style: GridStyle): { group: THREE.Group; obstructions: Obstruction[] } {
  const junctions = junctionsOf(roads);
  const ground = new Builder();
  const things = new Builder();
  const glow = new Builder();
  const group = new THREE.Group();
  group.name = name;
  // A part along a road: `a` to `b` along it, `c` to `d` across, `y` up, `h` high
  const along = (b: Builder, road: GridRoad, hex: number, a: number, e: number, c: number, d: number, y: number, h: number, opts: { solid?: boolean; glow?: boolean } = {}) => {
    const r = strip(road, a, e, c, d);
    if (r.maxX - r.minX < 0.01 || r.maxZ - r.minZ < 0.01) return;
    // Paint and asphalt are flat sheets (two triangles, not a box's twelve)
    if (h <= 0.015 && !opts.solid) b.ground(hex, r.maxX - r.minX, r.maxZ - r.minZ, (r.minX + r.maxX) / 2, y + h, (r.minZ + r.maxZ) / 2);
    else b.box(hex, r.maxX - r.minX, h, r.maxZ - r.minZ, (r.minX + r.maxX) / 2, y, (r.minZ + r.maxZ) / 2, opts);
  };
  for (const road of roads) {
    if (road.drawn) continue;
    const mine = junctions.filter((j) => j.ns === road || j.ew === road);
    const reach = mine.map((j) => (road.axis === 'z' ? j.z : j.x));
    const lo = Math.min(road.from, road.to, ...reach);
    const hi = Math.max(road.from, road.to, ...reach);
    // The asphalt, the whole length, under everything
    along(ground, road, style.asphalt, lo, hi, -road.halfRoad, road.halfRoad, 0.0, 0.012);
    // The median and the lane dashes stop short of the crossings; the pavements run up to the other road
    const runs = between(road, junctions, 6);
    const walks = between(road, junctions);
    for (const [a, b] of runs) {
      // The median: raised and planted, its ends nosed in white; or a centre line
      if (road.median > 0) {
        along(things, road, style.kerb, a + 2, b - 2, -road.median, road.median, 0, 0.2);
        along(things, road, style.medianTop, a + 2.2, b - 2.2, -road.median + 0.15, road.median - 0.15, 0.2, 0.04);
      } else {
        for (let u = a + 3; u < b - 3; u += 6) along(ground, road, style.centre, u, u + 3, -0.08, 0.08, 0.013, 0.004);
        if (style.centre !== style.line) along(ground, road, style.centre, a + 1, b - 1, 0.14, 0.24, 0.013, 0.004);
      }
      // Dashes between the lanes each way, and the solid edge lines
      const dividers: number[] = [];
      for (let i = 0; i + 1 < road.lanes.length; i++) dividers.push((road.lanes[i] + road.lanes[i + 1]) / 2);
      for (const side of [-1, 1]) {
        for (const d of dividers) for (let u = a + 4; u < b - 4; u += 10) along(ground, road, style.line, u, u + 4, side * d - 0.07, side * d + 0.07, 0.013, 0.004);
        along(ground, road, style.line, a + 1, b - 1, side * (road.halfRoad - 0.45), side * (road.halfRoad - 0.3), 0.013, 0.004);
      }
    }
    for (const [a, b] of walks) {
      for (const side of [-1, 1]) {
        const inner = side * road.halfRoad;
        // The kerb, painted in stripes where the city paints them, then the pavement behind it
        if (style.kerbStripe) {
          for (let u = a; u < b; u += 4) {
            along(things, road, style.kerb, u, Math.min(b, u + 2), inner, inner + side * 0.25, 0, style.top + 0.02);
            along(things, road, style.kerbStripe, Math.min(b, u + 2), Math.min(b, u + 4), inner, inner + side * 0.25, 0, style.top + 0.02);
          }
        } else along(things, road, style.kerb, a, b, inner, inner + side * 0.25, 0, style.top + 0.02);
        const back = inner + side * 0.25;
        if (style.drain) {
          // An open drain behind the kerb, its slab covers every few metres
          along(things, road, 0x57534e, a, b, back, back + side * 0.7, 0, 0.05);
          for (let u = a + 1; u < b - 1; u += 6) along(things, road, 0x9ca3af, u, u + 1.2, back, back + side * 0.7, style.top - 0.04, 0.06);
          along(things, road, style.pavement, a, b, back + side * 0.7, side * (road.halfRoad + road.walk), 0, style.top);
        } else along(things, road, style.pavement, a, b, back, side * (road.halfRoad + road.walk), 0, style.top);
        // The lamps on the pavement's kerb side
        const every = road.lampEvery ?? 34;
        if (every > 0 && style.lamp === 'single') {
          for (let u = a + every / 2; u < b - 4; u += every) {
            const x = side * (road.halfRoad + 0.7);
            const p = road.axis === 'z' ? { x: road.fixed + x, z: u } : { x: u, z: road.fixed + x };
            things.cylinder(0x6b7280, 0.1, 7.5, p.x, style.top, p.z, { sides: 8, solid: true });
            const arm = road.axis === 'z' ? { x: p.x - side * 0.9, z: p.z } : { x: p.x, z: p.z - side * 0.9 };
            things.box(0x6b7280, road.axis === 'z' ? 1.9 : 0.1, 0.1, road.axis === 'z' ? 0.1 : 1.9, (p.x + arm.x) / 2, style.top + 7.4, (p.z + arm.z) / 2);
            glow.box(0xfff3c4, 0.6, 0.12, 0.3, arm.x, style.top + 7.32, arm.z, { glow: true });
          }
        }
      }
    }
    // Twin lamps down a median
    const every = road.lampEvery ?? 34;
    if (every > 0 && style.lamp === 'twin' && road.median > 0) {
      for (const [a, b] of runs) {
        for (let u = a + every / 2; u < b - 4; u += every) {
          const p = road.axis === 'z' ? { x: road.fixed, z: u } : { x: u, z: road.fixed };
          things.cylinder(0x64748b, 0.16, 10, p.x, 0.2, p.z, { sides: 10, solid: true });
          for (const s of [-1, 1]) {
            const head = road.axis === 'z' ? { x: p.x + s * 2.2, z: p.z } : { x: p.x, z: p.z + s * 2.2 };
            things.box(0x64748b, road.axis === 'z' ? 4.4 : 0.14, 0.14, road.axis === 'z' ? 0.14 : 4.4, p.x, 9.9, p.z);
            glow.box(0xfffbeb, road.axis === 'z' ? 0.8 : 0.4, 0.2, road.axis === 'z' ? 0.4 : 0.8, head.x, 9.72, head.z, { glow: true });
          }
        }
      }
    }
  }
  // The junctions: a zebra across each road coming in, and a stop line before it
  for (const j of junctions) {
    if (j.ns.drawn || j.ew.drawn) continue;
    for (const [road, other] of [[j.ns, j.ew], [j.ew, j.ns]] as Array<[GridRoad, GridRoad]>) {
      const at = road.axis === 'z' ? j.z : j.x;
      for (const s of [-1, 1]) {
        const mid = at + s * (other.halfRoad + other.walk / 2);
        for (let c = -road.halfRoad + 0.6; c < road.halfRoad - 0.4; c += 1.2) along(ground, road, 0xf8fafc, mid - other.walk / 2 + 0.2, mid + other.walk / 2 - 0.2, c, c + 0.6, 0.014, 0.004);
        // The stop line across the lanes coming toward the junction on this side
        const stop = at + s * (other.halfRoad + other.walk + 1.2);
        // The lanes coming toward the junction from this side: along z they keep to x = s, along x to z = -s
        const lanesSide = road.axis === 'z' ? s : -s;
        along(ground, road, 0xf8fafc, stop - 0.2, stop + 0.2, lanesSide > 0 ? road.median : -road.halfRoad + 0.4, lanesSide > 0 ? road.halfRoad - 0.4 : -road.median, 0.014, 0.004);
      }
    }
  }
  group.add(ground.build(`${name} asphalt`, { roughness: 0.92 }), things.build(`${name} kerbs and lamps`, { roughness: 0.8 }), glow.build(`${name} lamps lit`));
  const obstructions = [...things.obstructions(name, 0, 0)];
  for (const mesh of group.children) mesh.traverse((o) => { if ((o as THREE.Mesh).isMesh) (o as THREE.Mesh).receiveShadow = true; });
  return { group, obstructions };
}
