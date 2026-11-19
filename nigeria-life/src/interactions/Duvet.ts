import * as THREE from 'three';
import { RENDER_LAYERS } from '../interiors/InteriorTypes';
import { duvet } from '../world/kit/SoftKit';

/**
 * The bed's own duvet near a sleeper's feet: the cloth the bed was made with, so the one pulled
 * over the sleeper is the same colour and pattern. `feet` is in `parent`'s space. Null for a bed
 * with no duvet of its own (an old mattress).
 */
export function bedDuvetNear(parent: THREE.Object3D, feet: { x: number; z: number }): THREE.Mesh | null {
  let top: THREE.Object3D = parent;
  while (top.parent) top = top.parent;
  const at = parent.localToWorld(new THREE.Vector3(feet.x, 0, feet.z));
  let best: THREE.Mesh | null = null;
  let bestDistance = 2.6;
  const here = new THREE.Vector3();
  top.traverse((child) => {
    if (!(child instanceof THREE.Mesh) || child.name !== 'bed duvet' || !child.visible) return;
    child.getWorldPosition(here);
    const distance = Math.hypot(here.x - at.x, here.z - at.z);
    if (distance < bestDistance) {
      bestDistance = distance;
      best = child;
    }
  });
  return best;
}

/**
 * The duvet over someone asleep in a bed: from their feet to their chest, soft and draped down
 * the sides, the turned-down sheet under their chin, so the head and shoulders show and the rest
 * is under the covers. It is cut from the bed's own cloth (`like`) when the bed has one.
 * `feet` is where their feet are and `facing` the way the foot of the bed points, both in the
 * parent's own space; `top` is how high the mattress is.
 */
export function duvetOver(parent: THREE.Object3D, feet: { x: number; z: number }, facing: number, top: number, cut: THREE.Mesh | number | null = null): THREE.Group {
  const like = cut instanceof THREE.Mesh ? cut : null;
  const cover = new THREE.Group();
  cover.name = 'duvet';
  const cloth = like
    ? (like.material as THREE.Material).clone()
    : new THREE.MeshStandardMaterial({ color: typeof cut === 'number' ? cut : 0x9f1d2c, roughness: 0.9, side: THREE.DoubleSide });
  const sheet = new THREE.MeshStandardMaterial({ color: 0xf8f6f0, roughness: 0.85 });
  // As wide as the bed's own duvet lies (it hangs `drop` down each side)
  const drop = 0.34;
  let width = 1.3;
  if (like) {
    like.geometry.computeBoundingBox();
    const box = like.geometry.boundingBox;
    if (box) width = Math.max(0.8, box.max.x - box.min.x - 2 * 0.28);
  }
  const length = 1.5;
  // Laid along the bed, local +z toward the foot: raised over the body, plumped, its sides draped down
  const body = new THREE.Mesh(duvet(width, length, drop, { folds: 5, puff: 0.09, seed: 7 }), cloth);
  // High enough over the body that the toes, pointing up, stay under it
  body.position.set(0, 0.32, 0.05);
  body.castShadow = true;
  body.receiveShadow = true;
  // The sheet turned down over its head edge, a soft roll across the chest
  const fold = new THREE.Mesh(new THREE.CapsuleGeometry(0.075, Math.max(0.4, width - 0.12), 4, 12), sheet);
  fold.rotation.z = Math.PI / 2;
  fold.position.set(0, 0.36, 0.05 - length / 2 + 0.04);
  cover.add(body, fold);
  // From the feet back up to the chest: the head is the other way from the foot of the bed
  // Its foot end a hand past the feet
  const back = 0.6;
  cover.position.set(feet.x - Math.sin(facing) * back, top, feet.z - Math.cos(facing) * back);
  cover.rotation.y = facing;
  cover.traverse((child) => child.layers.set(RENDER_LAYERS.INTERIOR));
  parent.add(cover);
  return cover;
}
