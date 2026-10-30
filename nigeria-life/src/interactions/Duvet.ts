import * as THREE from 'three';
import { RENDER_LAYERS } from '../interiors/InteriorTypes';

/**
 * The duvet over someone asleep in a bed: from their feet to their chest, the turned-down edge
 * under their chin, so the head and shoulders show and the rest is under the covers.
 * `feet` is where their feet are and `facing` the way the foot of the bed points, both in the
 * parent's own space; `top` is how high the mattress is.
 */
export function duvetOver(parent: THREE.Object3D, feet: { x: number; z: number }, facing: number, top: number, colour = 0xf3efe6): THREE.Group {
  const cover = new THREE.Group();
  cover.name = 'duvet';
  const cloth = new THREE.MeshStandardMaterial({ color: colour, roughness: 0.92 });
  const sheet = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.85 });
  // Laid along the bed: local +z toward the foot. The body under it, its sides draped down
  const body = new THREE.Mesh(new THREE.BoxGeometry(1.32, 0.16, 1.36), cloth);
  body.position.set(0, 0.24, 0.02);
  const sides = new THREE.Mesh(new THREE.BoxGeometry(1.42, 0.26, 1.3), cloth);
  sides.position.set(0, 0.1, 0.05);
  // The turned-down white edge across the chest
  const fold = new THREE.Mesh(new THREE.BoxGeometry(1.36, 0.2, 0.2), sheet);
  fold.position.set(0, 0.28, -0.68);
  cover.add(sides, body, fold);
  // From the feet back up to the chest: the head is the other way from the foot of the bed
  const back = 0.66;
  cover.position.set(feet.x - Math.sin(facing) * back, top, feet.z - Math.cos(facing) * back);
  cover.rotation.y = facing;
  cover.traverse((child) => child.layers.set(RENDER_LAYERS.INTERIOR));
  parent.add(cover);
  return cover;
}
