/**
 * A new player's first few minutes: one slim line on the screen that says the next thing to do,
 * with a button that does it, from a name of their own to their first pay. Each step is ticked
 * by what the player really did in the game (never by pressing "next"), it can be skipped, and
 * once it is done or skipped it never comes back on this device.
 */
import { profileKey } from '../backend/Profile';

const KEY = profileKey('nl_first_steps_v1');
/** The name every new life has until the player gives their own */
const STARTER_NAME = 'Bayo';

export interface FirstStepsHost {
  /** The player's name as it stands */
  name(): string;
  /** Where the player is */
  position(): { x: number; z: number };
  /** Is the phone open? */
  phoneOpen(): boolean;
  /** Is a shift under way or waiting to be paid? */
  onShift(): boolean;
  /** How many times the player has been paid for work */
  timesPaid(): number;
  /** Has the player a home of their own (rented, bought or built)? */
  hasHome(): boolean;
  /** Opens the look and name editor */
  openLook(): void;
  /** Opens the phone on one of its apps */
  openApp(app: string): void;
  /** Says something to the player */
  say(text: string): void;
  /** On a touch screen? (the words for moving differ) */
  touch(): boolean;
}

interface Step {
  text(host: FirstStepsHost): string;
  /** The button beside the words, if the step has one */
  button?: { label: string; run(host: FirstStepsHost): void };
  /** Which button on the screen to draw the eye to */
  point?: string;
  done(host: FirstStepsHost, since: { x: number; z: number; walked: number; lookOpened: boolean; phoneSeen: boolean }): boolean;
}

const STEPS: Step[] = [
  {
    text: () => 'Give yourself a name and a look',
    button: { label: 'Choose', run: (host) => host.openLook() },
    done: (host, since) => host.name() !== STARTER_NAME || since.lookOpened,
  },
  {
    text: (host) => (host.touch() ? 'Walk: drag the round stick, bottom left' : 'Walk with the arrow keys or W A S D'),
    // A few metres on foot, however the pavement runs (a kerb or a stall may be in the way of a straight line)
    done: (_host, since) => since.walked > 3,
  },
  {
    text: () => 'Open your phone: everything is in it',
    point: '#nav-btn-phone',
    done: (host, since) => since.phoneSeen || host.phoneOpen(),
  },
  {
    text: () => 'Take your first shift: Jobs, then "Take shift"',
    button: { label: 'Open Jobs', run: (host) => host.openApp('jobs') },
    done: (host) => host.onShift() || host.timesPaid() > 0,
  },
  {
    text: () => 'When the shift is done, collect your pay in Jobs',
    button: { label: 'Open Jobs', run: (host) => host.openApp('jobs') },
    done: (host) => host.timesPaid() > 0,
  },
];

/** Has this life never been played: no step taken yet, never paid, no home? */
export function isFreshLife(host: Pick<FirstStepsHost, 'timesPaid' | 'hasHome'>): boolean {
  try {
    if (localStorage.getItem(KEY) !== null) return false;
  } catch {
    return false;
  }
  return host.timesPaid() === 0 && !host.hasHome();
}

export class FirstSteps {
  private readonly el: HTMLDivElement;
  private readonly host: FirstStepsHost;
  private step = 0;
  private timer = 0;
  private readonly since = { x: 0, z: 0, walked: 0, lookOpened: false, phoneSeen: false };

  /** Starts the guide if this life is new; does nothing for a life already under way */
  public static begin(host: FirstStepsHost): FirstSteps | null {
    let kept: string | null = null;
    try {
      kept = localStorage.getItem(KEY);
    } catch {
      return null;
    }
    if (kept === 'done') return null;
    if (kept === null && !isFreshLife(host)) return null;
    return new FirstSteps(host, Math.min(STEPS.length - 1, Math.max(0, Number(kept) || 0)));
  }

  private constructor(host: FirstStepsHost, step: number) {
    this.host = host;
    this.step = step;
    this.el = document.createElement('div');
    this.el.id = 'nl-first-steps';
    this.el.setAttribute('role', 'status');
    this.el.addEventListener('click', (event) => {
      const target = (event.target as HTMLElement).closest<HTMLElement>('[data-fs]');
      if (!target) return;
      event.stopPropagation();
      if (target.dataset.fs === 'skip') this.finish(false);
      else if (target.dataset.fs === 'do') {
        if (this.step === 0) this.since.lookOpened = true;
        STEPS[this.step].button?.run(this.host);
      }
    });
    document.body.appendChild(this.el);
    this.arm();
    this.timer = window.setInterval(() => this.check(), 500);
  }

  /** Where this step is measured from, and its line on the screen */
  private arm(): void {
    const at = this.host.position();
    this.since.x = at.x;
    this.since.z = at.z;
    this.since.walked = 0;
    this.save(String(this.step));
    const step = STEPS[this.step];
    this.el.innerHTML = `
      <span class="fs-n">${this.step + 1}/${STEPS.length}</span>
      <span class="fs-text">${step.text(this.host)}</span>
      ${step.button ? `<button type="button" class="fs-do" data-fs="do">${step.button.label}</button>` : ''}
      <button type="button" class="fs-skip" data-fs="skip" aria-label="Skip the guide">✕</button>`;
    document.querySelectorAll('.fs-point').forEach((e) => e.classList.remove('fs-point'));
    if (step.point) document.querySelector(step.point)?.classList.add('fs-point');
  }

  private check(): void {
    if (this.host.phoneOpen()) this.since.phoneSeen = true;
    // How far they have walked since the step began (a ride or a door is a jump, not a walk)
    const at = this.host.position();
    const stride = Math.hypot(at.x - this.since.x, at.z - this.since.z);
    if (stride < 6) this.since.walked += stride;
    this.since.x = at.x;
    this.since.z = at.z;
    // More than one step can be done at once (a name given at sign-up, a shift already taken)
    let moved = false;
    while (this.step < STEPS.length && STEPS[this.step].done(this.host, this.since)) {
      this.step += 1;
      moved = true;
    }
    if (this.step >= STEPS.length) {
      this.finish(true);
      return;
    }
    if (moved) this.arm();
  }

  private finish(earned: boolean): void {
    window.clearInterval(this.timer);
    document.querySelectorAll('.fs-point').forEach((e) => e.classList.remove('fs-point'));
    this.el.remove();
    this.save('done');
    if (earned) this.host.say('🎉 Your first pay. Next: a room of your own (Phone, then Property), and food before you get hungry.');
  }

  private save(value: string): void {
    try {
      localStorage.setItem(KEY, value);
    } catch {
      // Kept for this visit only
    }
  }
}
