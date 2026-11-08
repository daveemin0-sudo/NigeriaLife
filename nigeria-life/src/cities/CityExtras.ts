import * as THREE from 'three';
import type { Obstruction, Rect } from '../world/plan/CityPlan';
import { buildTownscape, type TownBuilding } from '../world/kit/Townscape';
import { between, junctionsOf, type GridRoad } from '../world/plan/GridRoads';
import { footprintOf } from './BlockFiller';
import { clickBox } from '../world/landmarks/Landmark';
import { PlaceActions, type PlaceHost } from '../destinations/PlaceActions';
import type { InteractiveObject } from '../world/World';
import { townRoomKey, type TownRoomKind } from '../interiors/places/PlaceSpecs';
import { plantTrees, type AbujaPlace as CityPlace } from './AbujaDistricts';

/**
 * What a planned city (Abuja, Port Harcourt) does the same way: its ordinary buildings drawn a
 * square at a time and left out beyond the view; a door at each of its known places, into its
 * room or with something to do on open ground; trees down its pavements.
 */

/** The squares of the city its buildings are drawn in, so what is behind the view's far end is left out */
export interface CityTile {
  group: THREE.Object3D;
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

export function tiledTown(prefix: string, buildings: TownBuilding[], size = 160): { tiles: CityTile[]; obstructions: Obstruction[]; footprints: Rect[] } {
  const groups = new Map<string, TownBuilding[]>();
  for (const b of buildings) {
    const key = `${Math.floor(b.x / size)},${Math.floor(b.z / size)}`;
    groups.set(key, [...(groups.get(key) ?? []), b]);
  }
  const tiles: CityTile[] = [];
  const obstructions: Obstruction[] = [];
  for (const [key, list] of groups) {
    const town = buildTownscape(`${prefix} blocks ${key}`, list);
    obstructions.push(...town.obstructions);
    const [i, j] = key.split(',').map(Number);
    tiles.push({ group: town.group, minX: i * size, maxX: (i + 1) * size, minZ: j * size, maxZ: (j + 1) * size });
  }
  return { tiles, obstructions, footprints: buildings.map(footprintOf) };
}

/** Squares further than `sight` from the player are not drawn (the view ends at 300 m) */
export function cullTiles(tiles: readonly CityTile[], viewer: { x: number; z: number }, sight = 320): void {
  for (const t of tiles) {
    const dx = Math.max(t.minX - viewer.x, 0, viewer.x - t.maxX);
    const dz = Math.max(t.minZ - viewer.z, 0, viewer.z - t.maxZ);
    t.group.visible = Math.hypot(dx, dz) < sight;
  }
}

/** Something to do on open ground (a park, a square, a jetty), acted out where the player stands */
export interface OpenGround {
  label: string;
  who: string;
  role: string;
  text: string;
  choices: Array<{ label: string; note: string; price?: number; arms: 'wave' | 'reach' | 'rest'; seconds: number; needs: Record<string, number>; said: string }>;
}

const TOWN_ROOM: Partial<Record<TownBuilding['kind'], TownRoomKind>> = { shops: 'shops', office: 'office', hotel: 'hotel', bank: 'bank', market: 'market' };
const TOWN_WORDS: Record<TownRoomKind, { name: string; category: string; label: string }> = {
  shops: { name: 'Supermarket', category: 'Shop', label: '🛒 Into the shop' },
  office: { name: 'Office block', category: 'Office', label: '🏢 Into the office block' },
  hotel: { name: 'Hotel', category: 'Hotel', label: '🏨 Into the lobby' },
  bank: { name: 'Bank branch', category: 'Bank', label: '🏦 Into the bank' },
  market: { name: 'Market', category: 'Market', label: '🛍️ Into the market' },
};

/**
 * A door on the front of every shop, office, hotel, bank and market along a city's streets (the
 * homes stay private): walked up to, it goes into that kind of room and back out at this door.
 */
export function townDoors(group: THREE.Group, list: InteractiveObject[], buildings: readonly TownBuilding[], cityId: string): number {
  let n = 0;
  for (const b of buildings) {
    const kind = TOWN_ROOM[b.kind];
    if (!kind) continue;
    const r = footprintOf(b);
    // The middle of its street front, and where to stand outside it
    const front = b.faces === 'north' ? { x: b.x, z: r.minZ, dx: 0, dz: -1 } : b.faces === 'south' ? { x: b.x, z: r.maxZ, dx: 0, dz: 1 } : b.faces === 'west' ? { x: r.minX, z: b.z, dx: -1, dz: 0 } : { x: r.maxX, z: b.z, dx: 1, dz: 0 };
    const stand = new THREE.Vector3(front.x + front.dx * 1.6, 0, front.z + front.dz * 1.6);
    const id = `door-${cityId}-${n++}`;
    const mesh = clickBox(3, 3, 3);
    mesh.position.set(front.x + front.dx * 0.6, 1.5, front.z + front.dz * 0.6);
    group.add(mesh);
    const words = TOWN_WORDS[kind];
    const room = `roadside-${townRoomKey(cityId, kind)}`;
    list.push({ mesh, id, name: b.name ?? words.name, category: words.category, description: `${b.name ?? words.name} on this street.`, interactionPoint: stand.clone() });
    PlaceActions.register(id, { label: () => words.label, run: (host) => host.enter(room, stand) });
  }
  return n;
}

/**
 * A door at each place: a click box over its front, a card at the stand. One with a room goes
 * into it (and comes back out at the stand); one on open ground has its own things to do there.
 */
export function placeDoors(group: THREE.Group, list: InteractiveObject[], places: readonly CityPlace[], cityId: string, open: Record<string, OpenGround> = {}): void {
  for (const place of places) {
    const id = place.inside ? `roadside-${place.key}` : `${cityId}-${place.key}`;
    const mesh = clickBox(4, 4, 4);
    mesh.position.set(place.door.x, 2, place.door.z);
    group.add(mesh);
    const stand = new THREE.Vector3(place.stand.x, 0, place.stand.z);
    list.push({ mesh, id, name: place.name, category: place.category, description: place.description, interactionPoint: stand.clone() });
    if (place.inside) {
      const words = place.category === 'Hospital' ? '🏥 Go in to the hospital' : place.category === 'Hotel' ? '🏨 Into the lobby' : place.category === 'Market' ? '🛍️ Into the market' : place.category === 'Mall' ? '🛒 Into the mall' : place.key === 'millennium-tower' ? '🛗 Up to the observation deck' : '🚪 Go inside';
      PlaceActions.register(id, { label: () => words, run: (host) => host.enter(id, stand) });
      continue;
    }
    const ground = open[place.key];
    if (!ground) continue;
    const at = new THREE.Vector3(place.door.x, 0, place.door.z);
    const act = (host: PlaceHost, c: OpenGround['choices'][number]) => host.director.perform({
      id: c.label, actor: host.actor, point: stand, target: at, animation: { arms: c.arms }, seconds: c.seconds, effectAt: 0.8, ifStuck: 'snap',
      effect: () => {
        if (c.price && !host.backend.pay(c.price, `${place.name}: ${c.label}`)) {
          host.say(`That is ₦${c.price.toLocaleString()} and you do not have it.`, 'warning');
          return false;
        }
        for (const [k, v] of Object.entries(c.needs)) host.backend.modifyNeed(k as never, v);
        host.say(c.said, 'success');
        return true;
      },
    });
    PlaceActions.register(id, {
      label: () => ground.label,
      run: (host) => host.ask({ who: ground.who, role: ground.role, text: ground.text, choices: ground.choices.map((c) => ({ label: c.label, note: c.price ? `₦${c.price.toLocaleString()} · ${c.note}` : c.note, pick: () => act(host, c) })) }),
    });
  }
}

/** Trees down every road's pavements, clear of the buildings and the places kept out */
export function avenueTrees(roads: readonly GridRoad[], footprints: readonly Rect[], keepOut: readonly Rect[], kind: 'shade' | 'palm', every = 24, more: Array<{ x: number; z: number; s: number }> = [], name = 'trees'): THREE.Group {
  const points: Array<{ x: number; z: number; s: number }> = [];
  const junctions = junctionsOf(roads);
  const free = (x: number, z: number) =>
    !footprints.some((f) => x > f.minX - 1.5 && x < f.maxX + 1.5 && z > f.minZ - 1.5 && z < f.maxZ + 1.5) &&
    !keepOut.some((k) => x > k.minX && x < k.maxX && z > k.minZ && z < k.maxZ);
  let n = 0;
  for (const road of roads) {
    if (road.drawn) continue;
    for (const [a, b] of between(road, junctions, 10)) {
      for (let u = a + 6; u < b - 4; u += every) {
        for (const side of [-1, 1]) {
          const off = side * (road.halfRoad + road.walk + 1.6);
          const p = road.axis === 'z' ? { x: road.fixed + off, z: u } : { x: u, z: road.fixed + off };
          if (free(p.x, p.z)) points.push({ ...p, s: 0.85 + ((n++ * 37) % 10) / 25 });
        }
      }
    }
  }
  return plantTrees([...points, ...more], kind, name);
}
