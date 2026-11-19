/**
 * Driving with fingers: steering on the left (a slider: a finger a little off the middle steers a
 * little, at either end fully; let go and the wheel comes back), the pedals on the right (hold GAS
 * to go, BRAKE to slow, stop, and then reverse), a horn and a Get out button above them, and the
 * speed in the middle. Shown on touch screens while driving, in place of the stick.
 */
export interface DriveHooks {
  keys: Record<string, boolean>;
  /** A finger on the steering slider: -1 full left to +1 full right; null when it is let go */
  steer(amount: number | null): void;
  speed(): number;
  fuel(): number;
  honk(): void;
  getOut(): void;
  refuel(): void;
  name(): string;
  /** The car stereo: starts or stops the music; says whether it is on */
  music(): boolean;
  /** Behind the car, or over its bonnet */
  view(): void;
  musicOn(): boolean;
}

export class DriveControls {
  private readonly el: HTMLDivElement;
  private readonly hooks: DriveHooks;
  private frame = 0;
  private held = new Map<number, string>();
  /** The finger on the steering slider, or -1 */
  private steerFinger = -1;
  private steerOff: () => void = () => undefined;

  constructor(hooks: DriveHooks) {
    this.hooks = hooks;
    this.el = document.createElement('div');
    this.el.id = 'drive-controls';
    this.el.className = 'drive-controls';
    this.el.innerHTML = `
      <div class="drive-top"><span class="drive-name" data-name></span><span class="drive-fuel" data-fuel></span><button class="drive-chip" data-music aria-label="Car stereo">🎵</button><button class="drive-chip" data-view aria-label="Camera view">👁 View</button><button class="drive-chip" data-refuel>⛽ Refuel</button></div>
      <div class="drive-steer" aria-label="Steering">
        <button class="drive-arrow" data-side="left" aria-label="Steer left">◀</button>
        <span class="drive-steer-knob" aria-hidden="true"></span>
        <button class="drive-arrow" data-side="right" aria-label="Steer right">▶</button>
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
    // The steering slider: the wheel goes where the finger is across the pad
    const pad = this.el.querySelector<HTMLElement>('.drive-steer')!;
    const knob = pad.querySelector<HTMLElement>('.drive-steer-knob')!;
    const arrows = { left: pad.querySelector<HTMLElement>('[data-side="left"]')!, right: pad.querySelector<HTMLElement>('[data-side="right"]')! };
    const steerTo = (event: PointerEvent) => {
      const box = pad.getBoundingClientRect();
      const half = box.width / 2;
      // Full lock a little before the very edge, and a small dead middle so a resting thumb is straight ahead
      let amount = Math.max(-1, Math.min(1, (event.clientX - (box.left + half)) / (half * 0.8)));
      if (Math.abs(amount) < 0.08) amount = 0;
      // Finer round the middle, where lane changes are made; the ends are still full lock
      this.hooks.steer(Math.sign(amount) * Math.pow(Math.abs(amount), 1.5));
      knob.style.transform = `translateX(${Math.round(amount * (half - 28))}px)`;
      arrows.left.classList.toggle('is-down', amount < 0);
      arrows.right.classList.toggle('is-down', amount > 0);
    };
    const steerOff = (event?: PointerEvent) => {
      if (event && event.pointerId !== this.steerFinger) return;
      this.steerFinger = -1;
      this.hooks.steer(null);
      knob.style.transform = '';
      arrows.left.classList.remove('is-down');
      arrows.right.classList.remove('is-down');
    };
    this.steerOff = () => steerOff();
    pad.addEventListener('pointerdown', (event) => {
      event.preventDefault();
      this.steerFinger = event.pointerId;
      pad.setPointerCapture?.(event.pointerId);
      steerTo(event);
    });
    pad.addEventListener('pointermove', (event) => {
      if (event.pointerId === this.steerFinger) steerTo(event);
    });
    pad.addEventListener('pointerup', steerOff);
    pad.addEventListener('pointercancel', steerOff);
    pad.addEventListener('lostpointercapture', steerOff);

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
      else if ('view' in target.dataset) this.hooks.view();
      else if ('music' in target.dataset) {
        const on = this.hooks.music();
        target.classList.toggle('is-on', on);
      }
    });
  }

  /** Shown while driving (the style sheet shows it on touch screens only) */
  public show(on: boolean): void {
    this.el.classList.toggle('is-on', on);
    cancelAnimationFrame(this.frame);
    if (!on) {
      this.steerOff();
      for (const key of new Set(this.held.values())) this.hooks.keys[key] = false;
      this.held.clear();
      this.el.querySelectorAll('.is-down').forEach((b) => b.classList.remove('is-down'));
      return;
    }
    const name = this.el.querySelector('[data-name]')!;
    name.textContent = this.hooks.name();
    const speed = this.el.querySelector('[data-speed]')!;
    const fuel = this.el.querySelector('[data-fuel]')!;
    this.el.querySelector('[data-music]')?.classList.toggle('is-on', this.hooks.musicOn());
    const tick = () => {
      speed.textContent = String(Math.round(Math.abs(this.hooks.speed()) * 3.6));
      fuel.textContent = `⛽ ${Math.round(this.hooks.fuel())}%`;
      this.frame = requestAnimationFrame(tick);
    };
    tick();
  }
}
