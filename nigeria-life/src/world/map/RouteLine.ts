import * as THREE from 'three';
import type { WayPoint } from '../plan/Wayfinder';

/**
 * The way to a place, drawn on the map of the real city: a blue line along the streets from
 * where the player stands to the door they would arrive at. It is drawn over everything, as
 * a line on a map is, so no building hides a stretch of it.
 */

const HEIGHT = 0.9;

/** A flat band along a line of points, with a round join at each point so corners have no notch. */
function band(points: WayPoint[], width: number): THREE.BufferGeometry {
  const at: number[] = [];
  const half = width / 2;
  for (let i = 0; i + 1 < points.length; i++) {
    const a = points[i];
    const b = points[i + 1];
    const length = Math.hypot(b.x - a.x, b.z - a.z);
    if (length < 1e-3) continue;
    const nx = (-(b.z - a.z) / length) * half;
    const nz = ((b.x - a.x) / length) * half;
    at.push(a.x + nx, HEIGHT, a.z + nz, b.x + nx, HEIGHT, b.z + nz, b.x - nx, HEIGHT, b.z - nz);
    at.push(a.x + nx, HEIGHT, a.z + nz, b.x - nx, HEIGHT, b.z - nz, a.x - nx, HEIGHT, a.z - nz);
  }
  const SIDES = 10;
  for (const point of points) {
    for (let s = 0; s < SIDES; s++) {
      const one = (s / SIDES) * Math.PI * 2;
      const two = ((s + 1) / SIDES) * Math.PI * 2;
      at.push(point.x, HEIGHT, point.z, point.x + Math.cos(one) * half, HEIGHT, point.z + Math.sin(one) * half, point.x + Math.cos(two) * half, HEIGHT, point.z + Math.sin(two) * half);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(at, 3));
  return geometry;
}

export class RouteLine {
  public readonly group = new THREE.Group();
  private readonly edge: THREE.Mesh;
  private readonly line: THREE.Mesh;
  private readonly from: THREE.Mesh;
  /** The points of the way on show, or none */
  public points: WayPoint[] = [];

  constructor() {
    const drawnOver = (color: number, order: number) => {
      const mesh = new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshBasicMaterial({ color, depthTest: false, depthWrite: false, side: THREE.DoubleSide }));
      mesh.renderOrder = order;
      mesh.frustumCulled = false;
      return mesh;
    };
    this.edge = drawnOver(0xffffff, 20);
    this.line = drawnOver(0x1a66ff, 21);
    // Where the walk starts: a white-rimmed blue spot under the player
    this.from = drawnOver(0x1a66ff, 22);
    this.from.geometry = new THREE.CircleGeometry(2.4, 24).rotateX(-Math.PI / 2);
    const rim = drawnOver(0xffffff, 21);
    rim.geometry = new THREE.CircleGeometry(3.2, 24).rotateX(-Math.PI / 2);
    this.from.add(rim);
    this.group.add(this.edge, this.line, this.from);
    this.group.visible = false;
  }

  /** Puts a way on show (its first point is where it starts), or takes it away. */
  public set(points: WayPoint[] | null): void {
    this.points = points && points.length > 1 ? points : [];
    this.edge.geometry.dispose();
    this.line.geometry.dispose();
    if (this.points.length === 0) {
      this.edge.geometry = new THREE.BufferGeometry();
      this.line.geometry = new THREE.BufferGeometry();
      this.group.visible = false;
      return;
    }
    this.edge.geometry = band(this.points, 3.4);
    this.line.geometry = band(this.points, 2.0);
    this.from.position.set(this.points[0].x, HEIGHT, this.points[0].z);
  }
}
