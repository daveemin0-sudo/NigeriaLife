import * as THREE from 'three';
import { Builder } from '../world/kit/ArchKit';
import { EXPRESS, ROADSIDE, SIDE_PLACES, sideFront } from '../world/expressway/layout';
import { PlaceActions } from '../destinations/PlaceActions';
import type { InteractiveObject } from '../world/World';
import { Album, AGAMAS } from './Album';

/**
 * Agama lizards on the walls of Lagos: the orange-headed males doing their push-ups in the
 * sun, one on the front of nearly every building along the expressway and its side streets.
 * Walk up and catch one; get too close without catching it and it darts further up the wall.
 * Caught ones are counted in the album, and stay caught.
 */

const OUTDOOR = new Set(['lagoon-beach', 'lagoon-marina', 'private-airfield', 'ikeja-golf']);

function lizard(): THREE.Group {
  const b = new Builder();
  // Body slate-blue, head and tail tip orange: a male agama in his colours
  b.box(0x2c3e78, 0.12, 0.06, 0.26, 0, 0, 0);
  b.box(0x3b4f96, 0.1, 0.05, 0.12, 0, 0.01, -0.17);
  b.box(0xf97316, 0.1, 0.07, 0.1, 0, 0.005, 0.17);
  b.box(0xfb923c, 0.06, 0.04, 0.05, 0, 0.01, 0.24);
  b.cone(0x3b4f96, 0.03, 0.34, 0, 0.02, -0.4, 6, { pitch: -Math.PI / 2 });
  b.box(0xf97316, 0.03, 0.03, 0.08, 0, 0.02, -0.55);
  for (const [x, z] of [[-0.09, 0.08], [0.09, 0.08], [-0.09, -0.1], [0.09, -0.1]]) b.box(0x1e293b, 0.08, 0.025, 0.03, x, -0.01, z);
  const g = b.build('agama', { roughness: 0.55 });
  g.scale.setScalar(1.7);
  return g;
}

interface Agama { id: string; holder: THREE.Group; body: THREE.Object3D; up: number; bob: number; dart: number; darted: boolean; at: THREE.Vector3 }

export class Agamas {
  public readonly group = new THREE.Group();
  public readonly interactive: InteractiveObject[] = [];
  private readonly all: Agama[] = [];
  private time = 0;

  constructor() {
    this.group.name = 'agamas';
    const spots: Array<{ id: string; at: THREE.Vector3; normal: THREE.Vector3 }> = [];
    // The fronts along the expressway: a little off the door, at head height and above
    ROADSIDE.forEach((place, i) => {
      if (OUTDOOR.has(place.id)) return;
      // Clear of the shopfront panels that stand a little proud of the wall
      const faceX = place.side * (EXPRESS.half + EXPRESS.walk + 2) - place.side * 0.2;
      const along = (i % 2 ? 1 : -1) * Math.min(place.length / 2 - 3, place.length * 0.3);
      spots.push({ id: `agama-${place.id}`, at: new THREE.Vector3(faceX, 1.5 + (i % 3) * 0.5, place.z + along), normal: new THREE.Vector3(-place.side, 0, 0) });
    });
    // The side streets
    for (const place of SIDE_PLACES) {
      const f = sideFront(place.id);
      if (!f) continue;
      spots.push({ id: `agama-${place.id}`, at: new THREE.Vector3(f.x + 3, 1.7, f.faceZ - place.side * 0.2), normal: new THREE.Vector3(0, 0, -place.side) });
    }
    for (const spot of spots.slice(0, AGAMAS)) this.add(spot.id, spot.at, spot.normal);
  }

  private add(id: string, at: THREE.Vector3, normal: THREE.Vector3): void {
    const holder = new THREE.Group();
    holder.position.copy(at);
    // Flat on the wall, belly to it, head up
    holder.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(new THREE.Vector3().crossVectors(normal, new THREE.Vector3(0, 1, 0)), normal, new THREE.Vector3(0, 1, 0)));
    const body = lizard();
    holder.add(body);
    holder.name = id;
    holder.visible = !Album.get().hasAgama(id);
    this.group.add(holder);
    const a: Agama = { id, holder, body, up: 0, bob: Math.random() * 6, dart: 0, darted: false, at: at.clone() };
    this.all.push(a);
    const stand = at.clone().addScaledVector(normal, 1.1).setY(0);
    this.interactive.push({ mesh: holder, id, name: 'Agama lizard', category: 'Catch it for your album', description: 'An agama doing push-ups on the wall. Catch it!', interactionPoint: stand });
    PlaceActions.register(id, {
      label: () => (Album.get().hasAgama(id) ? '🦎 Already caught' : `🦎 Catch the agama (${Album.get().agamas}/${AGAMAS})`),
      run: (host) => {
        if (Album.get().hasAgama(id)) return;
        const target = () => holder.getWorldPosition(new THREE.Vector3());
        host.director.perform({
          id: 'catch an agama', actor: host.actor, point: stand, target, animation: { arms: 'reach' }, seconds: 0.9, effectAt: 0.6, ifStuck: 'snap',
          effect: () => {
            holder.visible = false;
            Album.get().foundAgama(id);
          },
        });
      },
    });
  }

  /** Push-ups, and a dash up the wall when someone comes too near without catching it */
  public update(delta: number, player: THREE.Vector3): void {
    this.time += delta;
    for (const a of this.all) {
      if (!a.holder.visible) continue;
      const near = Math.abs(a.at.z - player.z) < 40 && Math.abs(a.at.x - player.x) < 40;
      if (!near) continue;
      a.bob += delta;
      // A burst of push-ups every few seconds
      const phase = a.bob % 4;
      a.body.position.z = phase < 1.2 ? Math.max(0, Math.sin(phase * Math.PI * 4)) * 0.05 : 0;
      const close = a.at.distanceTo(new THREE.Vector3(player.x, a.at.y, player.z));
      if (!a.darted && close < 2.2) {
        a.darted = true;
        a.dart = 0.5;
      }
      if (a.dart > 0) {
        a.dart -= delta;
        a.up = Math.min(1.2, a.up + delta * 2.6);
        a.holder.position.y = a.at.y + a.up;
      }
    }
  }
}
