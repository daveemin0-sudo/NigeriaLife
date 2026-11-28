import * as THREE from 'three';
import { NavGrid } from '../../interactions/NavGrid';
import { Solids } from './Solids';
import type { Obstruction } from './CityPlan';

/**
 * One reusable collision path for streets and rooms.
 *
 * Footprints from the Builder (and explicit occupy/block calls) are the source of truth.
 * Street movers query a Solids spatial grid; rooms fill a NavGrid from the same footprints.
 * New floor-standing mass is solid by default; passable ground dressing opts out.
 */

/** Tall enough to stop a walker (chairs, benches, low counters included). */
export const MIN_SOLID_HEIGHT = 0.4;
/** Floor rugs, markings, puddles and similar stay walkable. */
export const PASSABLE_MAX_HEIGHT = 0.12;
/** Half-width of a walking person when sliding along solids. */
export const WALKER_RADIUS = 0.35;

export type Footprint = { minX: number; maxX: number; minZ: number; maxZ: number; height: number };

/**
 * Whether a Builder part should record a solid footprint.
 * Explicit `solid: true/false` wins; otherwise floor-standing mass above knee height is solid,
 * and glow / elevated trim / thin floor dressing is not.
 */
export function shouldSolidify(height: number, baseY: number, options: { solid?: boolean; glow?: boolean }): boolean {
  if (options.solid === false) return false;
  if (options.solid === true) return true;
  if (options.glow) return false;
  if (height <= PASSABLE_MAX_HEIGHT) return false;
  // Only things that stand on (or very near) the floor block by default
  if (baseY > 0.12) return false;
  return height >= MIN_SOLID_HEIGHT;
}

/** Footprints that are tall enough to block a walker. */
export function solidFootprints(footprints: ReadonlyArray<Footprint>): Footprint[] {
  const out: Footprint[] = [];
  for (const f of footprints) {
    if (f.height < MIN_SOLID_HEIGHT) continue;
    if (f.maxX - f.minX < 1e-4 || f.maxZ - f.minZ < 1e-4) continue;
    out.push(f);
  }
  return out;
}

/** Obstructions for Solids / the city plan, moved into world space. */
export function obstructionsFromFootprints(
  footprints: ReadonlyArray<Footprint>,
  owner: string,
  atX = 0,
  atZ = 0,
): Obstruction[] {
  return solidFootprints(footprints).map((part) => ({
    owner,
    structure: part.height >= 2.4 && Math.min(part.maxX - part.minX, part.maxZ - part.minZ) >= 0.9,
    height: part.height,
    minX: part.minX + atX,
    maxX: part.maxX + atX,
    minZ: part.minZ + atZ,
    maxZ: part.maxZ + atZ,
  }));
}

/** A street Solids grid from room-local footprints (world origin at room centre). */
export function solidsFromFootprints(footprints: ReadonlyArray<Footprint>, atX = 0, atZ = 0, owner = 'furniture'): Solids {
  return new Solids(obstructionsFromFootprints(footprints, owner, atX, atZ));
}

/**
 * Marks furniture on a room NavGrid from footprints in room-local space.
 * Does not allocate per call beyond the NavGrid's own cells.
 */
export function blockNavFromFootprints(nav: NavGrid, footprints: ReadonlyArray<Footprint>): number {
  let n = 0;
  for (const f of solidFootprints(footprints)) {
    const hw = (f.maxX - f.minX) / 2;
    const hl = (f.maxZ - f.minZ) / 2;
    nav.blockRect((f.minX + f.maxX) / 2, (f.minZ + f.maxZ) / 2, hw, hl);
    n += 1;
  }
  return n;
}

/**
 * Builds a room NavGrid and fills it from footprints. Clear spots (stands, door, spawn)
 * are opened so activities stay reachable.
 */
export function buildRoomNav(
  origin: THREE.Vector3,
  width: number,
  length: number,
  footprints: ReadonlyArray<Footprint>,
  clearSpots: ReadonlyArray<{ x: number; z: number; radius?: number }> = [],
): { nav: NavGrid; solids: number } {
  const nav = new NavGrid(origin, width, length);
  const solids = blockNavFromFootprints(nav, footprints);
  for (const spot of clearSpots) {
    const r = spot.radius ?? 0.45;
    nav.clearRect(spot.x, spot.z, r, r);
  }
  return { nav, solids };
}

/**
 * Nearest free point around (x, z) on a Solids grid, searching rings without per-frame alloc
 * beyond the returned result. Used when a player spawns or stands inside a solid.
 */
export function closestFreeOnSolids(
  solids: Solids,
  x: number,
  z: number,
  radius = WALKER_RADIUS,
  into: { x: number; z: number } = { x: 0, z: 0 },
): { x: number; z: number } {
  if (!solids.at(x, z, radius)) {
    into.x = x;
    into.z = z;
    return into;
  }
  for (let ring = 1; ring <= 24; ring++) {
    const step = 0.35;
    const reach = ring * step;
    let bestX = x;
    let bestZ = z;
    let bestD = Infinity;
    for (let i = 0; i < ring * 8; i++) {
      const a = (i / (ring * 8)) * Math.PI * 2;
      const px = x + Math.cos(a) * reach;
      const pz = z + Math.sin(a) * reach;
      if (solids.at(px, pz, radius)) continue;
      const d = (px - x) * (px - x) + (pz - z) * (pz - z);
      if (d < bestD) {
        bestD = d;
        bestX = px;
        bestZ = pz;
      }
    }
    if (bestD < Infinity) {
      into.x = bestX;
      into.z = bestZ;
      return into;
    }
  }
  into.x = x;
  into.z = z;
  return into;
}
