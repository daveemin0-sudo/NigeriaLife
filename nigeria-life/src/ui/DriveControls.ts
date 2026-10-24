/**
 * Driving with fingers: steering on the left (hold ◀ or ▶), the pedals on the right (hold GAS to
 * go, BRAKE to slow and then reverse), a horn and a Get out button above them, and the speed in
 * the middle. Shown on touch screens while driving, in place of the stick.
 */
export interface DriveHooks {
  keys: Record<string, boolean>;
  speed(): number;
  fuel(): number;
  honk(): void;
  getOut(): void;
  refuel(): void;
  name(): string;
}

export class DriveControls {
  private readonly el: HTMLDivElement;
  private readonly hooks: DriveHooks;
  private frame = 0;
  private held = new Map<number, string>();

  constructor(hooks: DriveHooks) {
    this.hooks = hooks;
    this.el = document.createElement('div');
    this.el.id = 'drive-controls';
    this.el.className = 'drive-controls';
    this.el.innerHTML = `
      <div class="drive-top"><span class="drive-name" data-name></span><span class="drive-fuel" data-fuel></span><button class="drive-chip" data-refuel>⛽ Refuel</button></div>
      <div class="drive-steer" aria-label="Steering">
        <button class="drive-arrow" data-key="a" aria-label="Steer left">◀</button>
        <span class="drive-steer-knob" aria-hidden="true"></span>
        <button class="drive-arrow" data-key="d" aria-label="Steer right">▶</button>
      </div>
      <div class="drive-speed"><b data-speed>0</b><span>km/h</span></div>
      <div class="drive-right">
        <div class="drive-row">
          <button class="drive-horn" data-horn aria-label="Horn">HORN</button>
          <button class="drive-out" data-out>🚪 Get out</button>
        </div>
        <div class="drive-row">
          <button class="drive-pedal drive-brake" data-key="s" aria-label="Brake">BRAKE</button>
          <button class="drive-pedal drive-gas" data-key="w" aria-label="Gas">GAS</button>
        </div>
      </div>`;
    document.body.appendChild(this.el);

    // Held buttons press their key for as long as a finger is on them
    const press = (event: PointerEvent) => {
      const target = (event.target as HTMLElement).closest<HTMLElement>('[data-key]');
      if (!target) return;
      event.preventDefault();
      const key = target.dataset.key!;
      this.held.set(event.pointerId, key);
      this.hooks.keys[key] = true;
      target.classList.add('is-down');
      target.setPointerCapture?.(event.pointerId);
    };
    const release = (event: PointerEvent) => {
      const key = this.held.get(event.pointerId);
      if (!key) return;
      this.held.delete(event.pointerId);
      if (![...this.held.values()].includes(key)) {
        this.hooks.keys[key] = false;
        this.el.querySelector(`[data-key="${key}"]`)?.classList.remove('is-down');
      }
    };
    this.el.addEventListener('pointerdown', press);
    this.el.addEventListener('pointerup', release);
    this.el.addEventListener('pointercancel', release);
    this.el.addEventListener('lostpointercapture', release);
    this.el.addEventListener('contextmenu', (event) => event.preventDefault());
    this.el.addEventListener('click', (event) => {
      const target = (event.target as HTMLElement).closest<HTMLElement>('button');
      if (!target) return;
      if ('horn' in target.dataset) this.hooks.honk();
      else if ('out' in target.dataset) this.hooks.getOut();
      else if ('refuel' in target.dataset) this.hooks.refuel();
    });
  }

  /** Shown while driving (the style sheet shows it on touch screens only) */
  public show(on: boolean): void {
    this.el.classList.toggle('is-on', on);
    cancelAnimationFrame(this.frame);
    if (!on) {
      for (const key of new Set(this.held.values())) this.hooks.keys[key] = false;
      this.held.clear();
      this.el.querySelectorAll('.is-down').forEach((b) => b.classList.remove('is-down'));
      return;
    }
    const name = this.el.querySelector('[data-name]')!;
    name.textContent = this.hooks.name();
    const speed = this.el.querySelector('[data-speed]')!;
    const fuel = this.el.querySelector('[data-fuel]')!;
    const tick = () => {
      speed.textContent = String(Math.round(Math.abs(this.hooks.speed()) * 3.6));
      fuel.textContent = `⛽ ${Math.round(this.hooks.fuel())}%`;
      this.frame = requestAnimationFrame(tick);
    };
    tick();
  }
}
