import * as THREE from 'three';
import type { InteractiveObject } from '../World';
import type { Obstruction, Rect } from '../plan/CityPlan';
import type { StreetDoor } from '../Buildings';
import type { PlaceAction, PlaceHost } from '../../destinations/PlaceActions';
import { Builder } from '../kit/ArchKit';

/** A landmark's things are used through the same contract as anything else in the world. */
export type LandmarkHost = PlaceHost;
export type LandmarkAction = PlaceAction;

/**
 * A large place in the city that is a place in its own right: a stadium, a port, an airport.
 *
 * It is built at world scale from the building kit, around its own origin, so the same
 * design can be put down in another city. It tells the city what ground it takes (so nothing
 * is generated there), what it puts in the way (for the city plan), where its ways in are
 * (which must be reachable on foot), and what can be done there.
 */
export interface Landmark {
  id: string;
  name: string;
  /** The ground it occupies. The generated city keeps clear of it. */
  zone: Rect;
  group: THREE.Group;
  obstructions: Obstruction[];
  /** Things here that can be walked up to and used */
  interactive: InteractiveObject[];
  /** What each of those does, by its id */
  actions: Record<string, LandmarkAction>;
  /** Ways in, which the city plan checks can be walked to */
  doors: Array<{ name: string; x: number; z: number }>;
  /** Doors that lead to a room inside, by the id of the room's building */
  streetDoors?: StreetDoor[];
  /** Called every frame while its city is being shown. `hour` is the game clock, 0 to 24. */
  update?(delta: number, hour: number): void;
  /** What is going on there now, in plain values, for anything that wants to show or check it. */
  status?(): Record<string, unknown>;
}

/** A standing figure in one piece, for workers and officials who belong to a place. */
export function figure(shirt: number, trousers = 0x1f2937, skin = 0x6b4226, hat?: number): THREE.Group {
  const builder = new Builder()
    .box(trousers, 0.42, 0.8, 0.26, 0, 0, 0)
    .box(shirt, 0.5, 0.62, 0.3, 0, 0.8, 0)
    .box(skin, 0.3, 0.3, 0.3, 0, 1.43, 0);
  if (hat !== undefined) builder.box(hat, 0.36, 0.14, 0.36, 0, 1.73, 0);
  return builder.build('figure');
}

/** A box that is not drawn: it only marks what to click to reach something. */
export function clickBox(width: number, height: number, depth: number): THREE.Mesh {
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(width, height, depth),
    new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false })
  );
  mesh.position.y = height / 2;
  return mesh;
}

/**
 * A line something drives along: corner to corner, at a steady speed. The yard tractor's
 * round, a lorry coming in through the gate, an aircraft taxiing.
 */
export class Route {
  private readonly points: Array<[number, number]>;
  private readonly lengths: number[] = [];
  public readonly length: number;

  constructor(points: Array<[number, number]>, closed = false) {
    this.points = closed ? [...points, points[0]] : points;
    let total = 0;
    for (let i = 1; i < this.points.length; i++) {
      const piece = Math.hypot(this.points[i][0] - this.points[i - 1][0], this.points[i][1] - this.points[i - 1][1]);
      this.lengths.push(piece);
      total += piece;
    }
    this.length = total;
  }

  /** Puts `object` the given distance along the line, turned the way it is going. Its front is its +x. */
  public place(object: THREE.Object3D, distance: number): void {
    let left = Math.max(0, Math.min(this.length, distance));
    for (let i = 0; i < this.lengths.length; i++) {
      if (left <= this.lengths[i] || i === this.lengths.length - 1) {
        const [ax, az] = this.points[i];
        const [bx, bz] = this.points[i + 1];
        const t = this.lengths[i] > 0 ? Math.min(1, left / this.lengths[i]) : 0;
        object.position.x = ax + (bx - ax) * t;
        object.position.z = az + (bz - az) * t;
        const want = Math.atan2(-(bz - az), bx - ax);
        // Corners are turned, not snapped
        const diff = Math.atan2(Math.sin(want - object.rotation.y), Math.cos(want - object.rotation.y));
        object.rotation.y += diff * 0.2;
        return;
      }
      left -= this.lengths[i];
    }
  }
}
