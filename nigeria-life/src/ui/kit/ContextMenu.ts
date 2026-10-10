import { PointerScope } from '../../game/PointerScope';
import { esc } from './html';

/** One line of a menu. */
export interface MenuItem {
  id: string;
  icon: string;
  label: string;
  /** A second line: what it shows, or, when it cannot be chosen, why not */
  note?: string;
  /** Cannot be chosen right now. `note` should say why. */
  disabled?: boolean;
  /** What choosing it does. The menu closes first. */
  run?: () => void;
  /** Choosing it opens these instead */
  items?: MenuItem[];
}

export interface MenuOptions {
  title: string;
  subtitle?: string;
  /** Extra HTML under the title (a row of meters, say) */
  header?: string;
  items: MenuItem[];
  /** A row of small buttons under the list, for the few things wanted from anywhere */
  quick?: MenuItem[];
  /** Where on the screen it belongs: it opens beside this point and stays on screen */
  anchor: { x: number; y: number };
}

/**
 * A menu that opens beside something in the world. It closes on a click anywhere else, on
 * Escape, or when something is chosen; the click that closes it does nothing else, so it
 * never also walks the character somewhere or turns the camera. Arrow keys move through it.
 */
export class ContextMenu {
  private readonly el: HTMLDivElement;
  private options: MenuOptions | null = null;
  /** The chain of submenus that have been opened, innermost last */
  private path: MenuItem[] = [];
  /**
   * Has a press begun on the menu since it opened? On a touch screen the tap that opens the
   * menu is followed by a mouse click at the same spot, which is now on the menu. A click only
   * counts if its own press was on the menu.
   */
  private pressedHere = false;

  constructor(id: string) {
    this.el = document.createElement('div');
    this.el.id = id;
    this.el.className = 'nl-menu nl-light';
    this.el.setAttribute('role', 'menu');
    this.el.tabIndex = -1;
    this.el.hidden = true;
    document.body.appendChild(this.el);

    this.el.addEventListener('pointerdown', () => { this.pressedHere = true; });
    this.el.addEventListener('click', (event) => this.onClick(event));
    this.el.addEventListener('keydown', (event) => this.onKey(event));

    // A press anywhere else puts the menu away, and that press does nothing more
    document.addEventListener('pointerdown', (event) => {
      if (!this.isOpen || this.el.contains(event.target as Node)) return;
      this.close();
      if (PointerScope.isGameView(event.target)) PointerScope.ignoreThisPress();
    }, true);
    document.addEventListener('keydown', (event) => {
      if (!this.isOpen || event.key !== 'Escape') return;
      event.preventDefault();
      event.stopPropagation();
      if (this.path.length > 0) this.up();
      else this.close();
    }, true);
  }

  public get isOpen(): boolean {
    return !this.el.hidden;
  }

  public open(options: MenuOptions): void {
    this.options = options;
    this.path = [];
    this.pressedHere = false;
    this.el.hidden = false;
    this.render();
    this.place(options.anchor);
    // The keyboard is on the menu from here; the arrow keys pick the first line
    this.el.focus({ preventScroll: true });
  }

  public close(): void {
    if (this.el.hidden) return;
    this.el.hidden = true;
    this.options = null;
    this.path = [];
  }

  private current(): MenuItem[] {
    return this.path.length > 0 ? this.path[this.path.length - 1].items ?? [] : this.options?.items ?? [];
  }

  /** Everything that can be chosen on the page now showing */
  private choices(): MenuItem[] {
    return this.path.length > 0 ? this.current() : [...this.current(), ...(this.options?.quick ?? [])];
  }

  private up(): void {
    this.path.pop();
    this.render();
    this.focusFirst();
  }

  private render(): void {
    const options = this.options;
    if (!options) return;
    const inside = this.path[this.path.length - 1];
    this.el.innerHTML = `
      <div class="nl-menu-head">
        ${inside ? '<button class="nl-menu-back" data-menu-back aria-label="Back">‹</button>' : ''}
        <div>
          <strong id="${this.el.id}-title">${esc(inside ? inside.label : options.title)}</strong>
          ${!inside && options.subtitle ? `<small>${esc(options.subtitle)}</small>` : ''}
        </div>
      </div>
      ${!inside && options.header ? options.header : ''}
      <div class="nl-menu-list">
        ${this.current().map((item) => `
          <button class="nl-menu-item" role="menuitem" data-menu-item="${esc(item.id)}" aria-disabled="${item.disabled ? 'true' : 'false'}">
            <span class="nl-menu-icon">${item.icon}</span>
            <span class="nl-menu-text">
              <span class="nl-menu-label">${esc(item.label)}</span>
              ${item.note ? `<span class="nl-menu-why">${esc(item.note)}</span>` : ''}
            </span>
            ${item.items && !item.disabled ? '<span class="nl-menu-more">›</span>' : ''}
          </button>`).join('')}
      </div>
      ${!inside && options.quick?.length ? `
        <div class="nl-menu-quick">
          ${options.quick.map((item) => `
            <button class="nl-menu-item" role="menuitem" data-menu-item="${esc(item.id)}" aria-disabled="${item.disabled ? 'true' : 'false'}" ${item.note ? `title="${esc(item.note)}"` : ''}>
              <span class="nl-menu-icon">${item.icon}</span>
              <span class="nl-menu-label">${esc(item.label)}</span>
            </button>`).join('')}
        </div>` : ''}
    `;
  }

  /** Beside the point it was opened from, moved in from any edge it would cross. */
  private place(anchor: { x: number; y: number }): void {
    // Its laid-out size, not the size it is drawn at while it is still growing into place
    const width = this.el.offsetWidth;
    const height = this.el.offsetHeight;
    const gap = 14;
    let x = anchor.x + gap;
    if (x + width > window.innerWidth - 10) x = anchor.x - gap - width;
    let y = anchor.y - height / 3;
    x = Math.max(10, Math.min(x, window.innerWidth - width - 10));
    y = Math.max(10, Math.min(y, window.innerHeight - height - 10));
    this.el.style.left = `${Math.round(x)}px`;
    this.el.style.top = `${Math.round(y)}px`;
  }

  private buttons(): HTMLElement[] {
    return Array.from(this.el.querySelectorAll<HTMLElement>('.nl-menu-item'));
  }

  private focusFirst(): void {
    const first = this.buttons().find((button) => button.getAttribute('aria-disabled') !== 'true') ?? this.buttons()[0];
    first?.focus({ preventScroll: true });
  }

  private onClick(event: MouseEvent): void {
    // The keyboard (and anything that calls click() itself) has no press: detail is 0
    if (!this.pressedHere && event.detail !== 0) return;
    const target = event.target as HTMLElement;
    if (target.closest('[data-menu-back]')) return this.up();
    const button = target.closest<HTMLElement>('[data-menu-item]');
    if (!button) return;
    const item = this.choices().find((entry) => entry.id === button.dataset.menuItem);
    // Something that cannot be chosen says why and stays where it is
    if (!item || item.disabled) return;
    if (item.items) {
      this.path.push(item);
      this.render();
      this.focusFirst();
      return;
    }
    this.close();
    item.run?.();
  }

  private onKey(event: KeyboardEvent): void {
    const buttons = this.buttons();
    const at = buttons.indexOf(document.activeElement as HTMLElement);
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      const next = at < 0 ? (event.key === 'ArrowDown' ? 0 : buttons.length - 1) : (at + (event.key === 'ArrowDown' ? 1 : -1) + buttons.length) % buttons.length;
      buttons[next]?.focus({ preventScroll: true });
    } else if (event.key === 'ArrowLeft' && this.path.length > 0) {
      event.preventDefault();
      this.up();
    } else if (event.key === 'ArrowRight' && at >= 0) {
      const item = this.choices()[at];
      if (item?.items && !item.disabled) {
        event.preventDefault();
        buttons[at].click();
      }
    }
    // Keys pressed in the menu are for the menu, not for walking
    event.stopPropagation();
  }
}
