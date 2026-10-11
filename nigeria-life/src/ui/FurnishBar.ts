import { HouseDecorationSystem } from '../housing/HouseDecorationSystem';
import { showGameToast } from './GameToast';
import { esc, naira } from './kit/html';
import { draw } from './kit/StableView';

/**
 * Choosing where a piece of furniture stands. The piece is shown in the room, seen through,
 * on a patch of floor that is green where it may stand and red where it may not. It can be
 * moved (the arrows, or a tap on the floor), turned, and looked at before anything is paid.
 * A new piece is paid for when it is put down; moving one already owned costs nothing.
 */
export class FurnishBar {
  private readonly el: HTMLDivElement;
  private readonly decor = HouseDecorationSystem.getInstance();

  constructor() {
    this.el = document.createElement('div');
    this.el.id = 'furnish-bar';
    this.el.className = 'nl-buildbar nl-light';
    this.el.setAttribute('role', 'dialog');
    this.el.setAttribute('aria-label', 'Place furniture');
    this.el.hidden = true;
    document.body.appendChild(this.el);
    this.el.addEventListener('click', (event) => this.onClick(event));
    window.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && this.isOpen) this.decor.cancel();
    });
    this.decor.onPlacingChanged = () => this.render();
  }

  public get isOpen(): boolean {
    return !this.el.hidden;
  }

  public render(): void {
    const placing = this.decor.placing;
    if (!placing) {
      this.el.hidden = true;
      return;
    }
    this.el.hidden = false;
    const blocked = this.decor.blocked();
    const size = this.decor.footprint(placing.item.modelType, placing.turns);
    const hint = placing.moving ? 'It can stand here. Tap the floor where you want it, or use the arrows.' : 'It can stand here. Tap the floor where you want it, or use the arrows. You pay when you place it.';
    draw(this.el, `
      <div class="nl-buildbar-head">
        <strong>${esc(placing.item.icon)} ${esc(placing.item.name)}</strong>
        <span>${size.width.toFixed(1)} m × ${size.depth.toFixed(1)} m${placing.moving ? ' · moving' : ''}</span>
      </div>
      <div class="nl-buildbar-say ${blocked ? 'is-bad' : 'is-good'}" id="furnish-bar-say" role="status">${blocked ? esc(blocked) : hint}</div>
      <div class="nl-buildbar-row">
        <div class="nl-buildbar-pad" aria-label="Move the furniture">
          <button class="nl-btn nl-btn--sm" data-move="0,-1" aria-label="Move back">↑</button>
          <button class="nl-btn nl-btn--sm" data-move="-1,0" aria-label="Move left">←</button>
          <button class="nl-btn nl-btn--sm" data-move="1,0" aria-label="Move right">→</button>
          <button class="nl-btn nl-btn--sm" data-move="0,1" aria-label="Move forward">↓</button>
        </div>
        <button class="nl-btn nl-btn--sm" id="furnish-bar-turn" data-turn>⟳ Turn</button>
        <button class="nl-btn nl-btn--sm" id="furnish-bar-cancel" data-cancel>Cancel</button>
        <button class="nl-btn nl-btn--primary" id="furnish-bar-confirm" data-confirm ${blocked ? 'disabled' : ''}>${placing.moving ? 'Put it here' : `Place · ${naira(placing.item.price)}`}</button>
      </div>
    `);
  }

  private onClick(event: MouseEvent): void {
    const target = (event.target as HTMLElement).closest<HTMLElement>('[data-move],[data-turn],[data-cancel],[data-confirm]');
    const placing = this.decor.placing;
    if (!target || !placing || (target as HTMLButtonElement).disabled) return;
    if (target.dataset.move) {
      const [dx, dz] = target.dataset.move.split(',').map(Number);
      this.decor.moveTo(placing.x + dx * 0.25, placing.z + dz * 0.25);
    } else if ('turn' in target.dataset) {
      this.decor.turn();
    } else if ('cancel' in target.dataset) {
      this.decor.cancel();
    } else if ('confirm' in target.dataset) {
      const placed = this.decor.confirm();
      if (!placed.ok) {
        showGameToast(placed.reason ?? 'It cannot go there.', 'warning', 3600);
        this.render();
      }
    }
  }
}
