import type { Zone } from '../world/plan/CityPlan';

/**
 * The round map in the corner while driving: the roads round the car, turned so the way it is
 * going is always up, the car as an arrow in the middle, north marked on the rim, and the way to
 * where it is going (when the arrows on the road are showing it) drawn over the roads. Drawn on a
 * small canvas from the city's own plan, a few times a second: nothing is rendered twice.
 */
export class MiniMap {
  private readonly el: HTMLDivElement;
  private readonly canvas: HTMLCanvasElement;
  private readonly g: CanvasRenderingContext2D | null;
  private shown = false;
  private drawnAt = 0;
  /** Metres from the middle to the rim */
  private readonly reach = 120;

  constructor() {
    this.el = document.createElement('div');
    this.el.id = 'nl-minimap';
    this.el.className = 'nl-minimap';
    this.el.setAttribute('aria-hidden', 'true');
    this.canvas = document.createElement('canvas');
    const px = Math.round(150 * Math.min(2, window.devicePixelRatio || 1));
    this.canvas.width = this.canvas.height = px;
    this.g = this.canvas.getContext('2d');
    const north = document.createElement('span');
    north.className = 'nl-minimap-north';
    north.textContent = 'N';
    this.el.append(this.canvas, north);
    document.body.appendChild(this.el);
  }

  public show(on: boolean): void {
    if (on === this.shown) return;
    this.shown = on;
    this.el.classList.toggle('is-on', on);
  }

  /** Draws the map round (x, z), the car heading `heading` (forward is (sin, cos)); `route` is the way ahead, if any */
  public update(x: number, z: number, heading: number, roads: readonly Zone[], route?: ReadonlyArray<{ x: number; z: number }> | null): void {
    if (!this.shown || !this.g) return;
    const now = performance.now();
    if (now - this.drawnAt < 90) return;
    this.drawnAt = now;
    const g = this.g;
    const size = this.canvas.width;
    const half = size / 2;
    const scale = half / this.reach;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, size, size);
    g.fillStyle = '#e9e4d6';
    g.fillRect(0, 0, size, size);
    // The world turned so the car's way is up and its right is to the right: for a point d from the
    // car, ahead = d . (sin h, cos h) goes up the screen, right = d . (-cos h, sin h) goes across it
    const sin = Math.sin(heading);
    const cos = Math.cos(heading);
    const ta = -cos * scale;
    const tb = -sin * scale;
    const tc = sin * scale;
    const td = -cos * scale;
    g.setTransform(ta, tb, tc, td, half - (ta * x + tc * z), half - (tb * x + td * z));
    const near = (r: Zone) => r.maxX > x - this.reach * 1.5 && r.minX < x + this.reach * 1.5 && r.maxZ > z - this.reach * 1.5 && r.minZ < z + this.reach * 1.5;
    // Pavements first, then the roads over them
    g.fillStyle = '#d4cfc2';
    for (const r of roads) if (r.kind === 'walkway' && near(r)) g.fillRect(r.minX, r.minZ, r.maxX - r.minX, r.maxZ - r.minZ);
    g.fillStyle = '#ffffff';
    for (const r of roads) if (r.kind === 'carriageway' && near(r)) g.fillRect(r.minX - 1.2, r.minZ - 1.2, r.maxX - r.minX + 2.4, r.maxZ - r.minZ + 2.4);
    g.fillStyle = '#4b5563';
    for (const r of roads) if (r.kind === 'carriageway' && near(r)) g.fillRect(r.minX, r.minZ, r.maxX - r.minX, r.maxZ - r.minZ);
    if (route && route.length > 1) {
      g.strokeStyle = '#22c55e';
      g.lineWidth = 3.2 / scale;
      g.lineJoin = 'round';
      g.lineCap = 'round';
      g.beginPath();
      g.moveTo(route[0].x, route[0].z);
      for (const p of route) g.lineTo(p.x, p.z);
      g.stroke();
    }
    // The car: an arrow pointing up, in the middle
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.fillStyle = '#16a34a';
    g.strokeStyle = '#ffffff';
    g.lineWidth = Math.max(2, size / 75);
    g.beginPath();
    const a = size / 15;
    g.moveTo(half, half - a * 1.2);
    g.lineTo(half + a * 0.8, half + a);
    g.lineTo(half, half + a * 0.5);
    g.lineTo(half - a * 0.8, half + a);
    g.closePath();
    g.fill();
    g.stroke();
    // North (+z) on the rim, where it lies from here
    const n = this.el.querySelector<HTMLElement>('.nl-minimap-north');
    if (n) n.style.transform = `translate(calc(-50% + ${(sin * 62).toFixed(1)}px), calc(-50% + ${(-cos * 62).toFixed(1)}px))`;
  }
}
