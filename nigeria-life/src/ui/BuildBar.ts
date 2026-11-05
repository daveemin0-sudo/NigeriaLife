import { buildingType, footprintAt, type BuildingType } from '../realestate/BuildingCatalogue';
import { Land, type Plot } from '../realestate/Land';
import type { PlotWorld } from '../realestate/PlotWorld';
import { showGameToast } from './GameToast';
import { esc, naira } from './kit/html';
import { draw } from './kit/StableView';

/**
 * Choosing where a building stands on a plot. The design is shown on the ground as a ghost,
 * green where it may stand and red where it may not, and it can be moved, turned and looked
 * at from the street before anything is paid for. Confirming is what starts the work.
 */
export class BuildBar {
  private readonly el: HTMLDivElement;
  private readonly land = Land.get();
  private plot: Plot | null = null;
  private type: BuildingType | null = null;
  private x = 0;
  private z = 0;
  private turns = 0;
  private busy = false;
  private readonly plots: PlotWorld;

  constructor(plots: PlotWorld) {
    this.plots = plots;
    this.el = document.createElement('div');
    this.el.id = 'build-bar';
    this.el.className = 'nl-buildbar nl-light';
    this.el.setAttribute('role', 'dialog');
    this.el.setAttribute('aria-label', 'Place a building');
    this.el.hidden = true;
    document.body.appendChild(this.el);
    this.el.addEventListener('click', (event) => this.onClick(event));
    window.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && this.isOpen) this.close();
    });
  }

  public get isOpen(): boolean {
    return !this.el.hidden;
  }

  /** What is being placed and where, for anything that needs to know (and for tests). */
  public get placing(): { plotId: string; typeId: string; x: number; z: number; turns: number; blocked: string | null } | null {
    if (!this.plot || !this.type) return null;
    return { plotId: this.plot.id, typeId: this.type.id, x: this.x, z: this.z, turns: this.turns, blocked: this.blocked() };
  }

  public open(plotId: string, typeId: string): void {
    const plot = this.land.plot(plotId);
    const type = buildingType(typeId);
    if (!plot || !type) return;
    this.plot = plot;
    this.type = type;
    this.x = (plot.rect.minX + plot.rect.maxX) / 2;
    this.z = (plot.rect.minZ + plot.rect.maxZ) / 2;
    // Turned to fit, if it only fits one way round
    const width = plot.rect.maxX - plot.rect.minX;
    const depth = plot.rect.maxZ - plot.rect.minZ;
    this.turns = type.width + 2 <= width && type.depth + 2 <= depth ? 0 : 1;
    this.el.hidden = false;
    this.render();
  }

  public close(): void {
    if (this.el.hidden) return;
    this.el.hidden = true;
    this.plot = null;
    this.type = null;
    this.plots.clearPreview();
  }

  private blocked(): string | null {
    if (!this.plot || !this.type) return 'Nothing to place.';
    return this.land.cannotPlace(this.plot.id, this.type.id, this.x, this.z, this.turns);
  }

  /** Moves the design to a point on the ground. Used when the plot itself is clicked. Returns true if it took the click. */
  public moveTo(x: number, z: number): boolean {
    if (!this.isOpen || !this.plot) return false;
    const { rect } = this.plot;
    if (x < rect.minX || x > rect.maxX || z < rect.minZ || z > rect.maxZ) return false;
    this.x = Math.round(x * 2) / 2;
    this.z = Math.round(z * 2) / 2;
    this.render();
    return true;
  }

  private render(): void {
    if (!this.plot || !this.type) return;
    const blocked = this.blocked();
    this.plots.showPreview(this.plot, this.type, this.x, this.z, this.turns, blocked === null);
    const foot = footprintAt(this.type, this.x, this.z, this.turns);
    draw(this.el, `
      <div class="nl-buildbar-head">
        <strong>${this.type.icon} ${esc(this.type.name)}</strong>
        <span>${foot.maxX - foot.minX} m × ${foot.maxZ - foot.minZ} m on ${esc(this.plot.name)}</span>
      </div>
      <div class="nl-buildbar-say ${blocked ? 'is-bad' : 'is-good'}" id="build-bar-say" role="status">${blocked ? esc(blocked) : 'It can stand here. Move it, turn it, or click the plot where you want it.'}</div>
      <div class="nl-buildbar-row">
        <div class="nl-buildbar-pad" aria-label="Move the building">
          <button class="nl-btn nl-btn--sm" data-move="0,-1" aria-label="Move north">↑</button>
          <button class="nl-btn nl-btn--sm" data-move="-1,0" aria-label="Move west">←</button>
          <button class="nl-btn nl-btn--sm" data-move="1,0" aria-label="Move east">→</button>
          <button class="nl-btn nl-btn--sm" data-move="0,1" aria-label="Move south">↓</button>
        </div>
        <button class="nl-btn nl-btn--sm" id="build-bar-turn" data-turn>⟳ Turn</button>
        <button class="nl-btn nl-btn--sm" id="build-bar-cancel" data-cancel>Cancel</button>
        <button class="nl-btn nl-btn--primary" id="build-bar-confirm" data-confirm ${blocked || this.busy ? 'disabled' : ''}>Build · ${naira(this.type.cost)}</button>
      </div>
    `);
  }

  private onClick(event: MouseEvent): void {
    const target = (event.target as HTMLElement).closest<HTMLElement>('[data-move],[data-turn],[data-cancel],[data-confirm]');
    if (!target || (target as HTMLButtonElement).disabled) return;
    if (target.dataset.move) {
      const [dx, dz] = target.dataset.move.split(',').map(Number);
      this.x += dx * 0.5;
      this.z += dz * 0.5;
      this.render();
    } else if ('turn' in target.dataset) {
      this.turns = (this.turns + 1) % 4;
      this.render();
    } else if ('cancel' in target.dataset) {
      this.close();
    } else if ('confirm' in target.dataset) {
      void this.confirm();
    }
  }

  private async confirm(): Promise<void> {
    if (!this.plot || !this.type || this.busy) return;
    this.busy = true;
    const type = this.type;
    const plot = this.plot;
    const result = await this.land.startBuilding(plot.id, type.id, this.x, this.z, this.turns);
    this.busy = false;
    if (!result.ok) {
      showGameToast(result.reason ?? 'That could not be built.', 'warning', 4200);
      this.render();
      return;
    }
    this.close();
    showGameToast(`Work has started on your ${type.name.toLowerCase()} at ${plot.name}. ${naira(type.cost)} paid.`, 'success', 4600);
  }
}
