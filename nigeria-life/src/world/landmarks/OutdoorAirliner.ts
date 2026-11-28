import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { buildAirliner, type AirlinerType, type Livery } from '../../interiors/airport/Airliner';
import { bakeToGeometry } from '../../graphics/MeshBaker';

/**
 * The airliners seen from the city, at their real size and in the same shape as the ones seen
 * from inside the terminal, but drawn in a few meshes rather than dozens: the painted fuselage
 * (its livery, windows and name), everything else in one mesh coloured as it is, and the logo
 * on the fin. Aircraft that never move are merged together; one that flies keeps its propellers
 * apart, so they can turn.
 */

const rest = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.4, metalness: 0.25, side: THREE.DoubleSide, name: 'airframe (baked)' });

interface Pieces {
  fuselage: { geometry: THREE.BufferGeometry; material: THREE.Material };
  mark: { geometry: THREE.BufferGeometry; material: THREE.Material } | null;
  rest: THREE.BufferGeometry | null;
  props: Array<{ geometry: THREE.BufferGeometry; at: THREE.Vector3 }>;
  doorSill: number;
  doorAlong: number;
  length: number;
}

/** One aircraft taken apart into what can be drawn together; `props` apart, or baked in where it stands still */
function pieces(type: AirlinerType, livery: Livery, keepProps: boolean, place: THREE.Matrix4): Pieces {
  const handle = buildAirliner(type, livery);
  const root = handle.group;
  root.updateMatrixWorld(true);
  const fuselage = root.getObjectByName('fuselage') as THREE.Mesh;
  const marks: THREE.Mesh[] = [];
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.isMesh && m.material instanceof THREE.MeshBasicMaterial && m.material.map) marks.push(m);
  });
  const exclude: THREE.Object3D[] = [fuselage, ...marks, ...(keepProps ? handle.props : [])];
  const baked = bakeToGeometry(root, { exclude });
  baked?.applyMatrix4(place);
  const fg = fuselage.geometry.clone().applyMatrix4(fuselage.matrixWorld).applyMatrix4(place);
  const mg = marks.length ? mergeGeometries(marks.map((m) => {
    const g = m.geometry.clone().applyMatrix4(m.matrixWorld).applyMatrix4(place);
    return g.index ? g.toNonIndexed() : g;
  }), false) : null;
  const props = keepProps
    ? handle.props.map((p) => ({ geometry: bakeToGeometry(p, { space: p })!, at: p.position.clone() }))
    : [];
  return {
    fuselage: { geometry: fg, material: fuselage.material as THREE.Material },
    mark: mg && marks.length ? { geometry: mg, material: marks[0].material as THREE.Material } : null,
    rest: baked,
    props,
    doorSill: handle.spec.doorSill,
    doorAlong: handle.spec.length / 2 - handle.spec.l1,
    length: handle.spec.length,
  };
}

/** Aircraft are not buildings of the street: the city plan leaves them out (the airport gives their bodies footprints) */
function airside(group: THREE.Group): void {
  group.traverse((o) => {
    if ((o as THREE.Mesh).isMesh) o.userData.surface = true;
  });
}

export interface FlyingAirliner {
  group: THREE.Group;
  /** The propellers, to be turned about their own x axis */
  props: THREE.Mesh[];
  /** Height of the forward door's sill; how far ahead of the middle the door is; the length */
  doorSill: number;
  doorAlong: number;
  length: number;
}

/** An aircraft that moves (nose toward +x, standing at its origin), its propellers free to turn */
export function flyingAirliner(type: AirlinerType, livery: Livery): FlyingAirliner {
  const p = pieces(type, livery, true, new THREE.Matrix4());
  const group = new THREE.Group();
  group.name = `airliner ${livery.reg}`;
  group.add(new THREE.Mesh(p.fuselage.geometry, p.fuselage.material));
  if (p.rest) group.add(new THREE.Mesh(p.rest, rest));
  if (p.mark) group.add(new THREE.Mesh(p.mark.geometry, p.mark.material));
  const props = p.props.map((prop) => {
    const m = new THREE.Mesh(prop.geometry, rest);
    m.position.copy(prop.at);
    group.add(m);
    return m;
  });
  airside(group);
  return { group, props, doorSill: p.doorSill, doorAlong: p.doorAlong, length: p.length };
}

/** Aircraft standing still, each where `places` puts it, all of one livery: three meshes however many */
export function parkedAirliners(type: AirlinerType, livery: Livery, places: THREE.Matrix4[]): THREE.Group {
  const group = new THREE.Group();
  group.name = 'parked airliners';
  const all = places.map((place) => pieces(type, livery, false, place));
  if (!all.length) return group;
  const flat = (g: THREE.BufferGeometry) => (g.index ? g.toNonIndexed() : g);
  const strip = (g: THREE.BufferGeometry, keep: string[]) => {
    for (const name of Object.keys(g.attributes)) if (!keep.includes(name)) g.deleteAttribute(name);
    return g;
  };
  group.add(new THREE.Mesh(mergeGeometries(all.map((p) => strip(flat(p.fuselage.geometry), ['position', 'normal', 'uv'])), false), all[0].fuselage.material));
  const rests = all.map((p) => p.rest).filter((g): g is THREE.BufferGeometry => !!g);
  if (rests.length) group.add(new THREE.Mesh(mergeGeometries(rests, false), rest));
  const marks = all.map((p) => p.mark).filter((m): m is NonNullable<Pieces['mark']> => !!m);
  if (marks.length) group.add(new THREE.Mesh(mergeGeometries(marks.map((m) => strip(m.geometry, ['position', 'normal', 'uv'])), false), marks[0].material));
  airside(group);
  return group;
}
