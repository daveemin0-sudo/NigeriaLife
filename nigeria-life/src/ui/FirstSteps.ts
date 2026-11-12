/**
 * A new player's first five minutes, played in the street: out onto Broad Street, an elder who
 * calls them over, a day's work found through him and done by hand, the first pay, something to
 * eat, a room to look at, and then a reason to keep it all in an account.
 *
 * One slim line says the next thing worth doing, a marker floats over the person or door it is
 * about, and "Take me" walks there. Nothing is ever forced: every step is ticked by what the player
 * really did, in any order, and the line simply shows the first thing not yet done. ✕ ends the
 * guide for good. Progress is kept in this life's storage (it travels in the account save) and the
 * end of it, finished or skipped, is kept on the game server, so a returning player never sees it.
 */
import { profileKey } from '../backend/Profile';
import { Activity } from '../life/Activity';

const KEY = profileKey('nl_first_steps_v1');

/** The people and places the guide points at (their interactive ids) */
export const GUIDE_TARGETS = {
  elder: 'community-elder',
  site: 'eko-plaza-site-supervisor',
  sitePallet: 'eko-plaza-site-blocks',
  port: 'apapa-port-foreman',
  portBay: 'apapa-port-loading-bay',
  suya: 'suya-master',
  estate: 'villa-compound',
} as const;

export interface FirstStepsHost {
  /** Where the player is */
  position(): { x: number; z: number };
  /** How many times the player has been paid for work */
  timesPaid(): number;
  /** Has the player a home of their own (rented, bought or built)? */
  hasHome(): boolean;
  /** Has the player been taken on at this workplace? */
  employed(employer: string): boolean;
  /** Is the building site working at this hour? (it keeps day hours; the port never shuts) */
  siteOpen(): boolean;
  /** Where a person or door stands (null if not in this city) */
  where(id: string): { x: number; z: number } | null;
  /** Walk the player there and open its card */
  walkTo(id: string): void;
  /** Float the guide's marker over this person or door, or take it away */
  mark(id: string | null): void;
  /** Which way a person or door is from where the camera looks: degrees clockwise from straight ahead (null if not in this city) */
  bearing(id: string): number | null;
  /** Is the player at work this moment (carrying blocks, loading the lorry)? */
  working(): boolean;
  /** Is a window open over the game (the phone, a conversation, a shop)? */
  windowOpen(): boolean;
  /** Is the list of homes to let on the screen? */
  lookingAtRooms(): boolean;
  /** Opens the homes the player can pay for now, cheapest first */
  seeRooms(): void;
  /** Has the player met Chief Alabi (the first conversation finished)? */
  metElder(): boolean;
  /** Chief Alabi calls out to the player, over his head */
  elderCalls(text: string): void;
  /** Is the player on a guest account (true), a named one (false), or is there no game server (null)? */
  guest(): boolean | null;
  /** Opens the sign-up screen; `later` is called if the player chooses to stay a guest */
  signUp(later: () => void): void;
  /** Says something to the player */
  say(text: string): void;
  /** On a touch screen? (the words for moving differ) */
  touch(): boolean;
  /** The guide is over (finished or skipped): told to the game server, where it is kept for good */
  ended(how: 'done' | 'skipped'): void;
}

type StepId = 'move' | 'elder' | 'hire' | 'work' | 'eat' | 'home' | 'keep';

interface Kept {
  v: 2;
  /** Steps ticked for good, whatever is true later (a walk, a meal, a look at the rooms) */
  ticked: StepId[];
}

interface Step {
  id: StepId;
  text(host: FirstStepsHost): string;
  /** Who or what the marker floats over */
  target?(host: FirstStepsHost): string | null;
  /** A button beside the words that is not "Take me" */
  button?: { label: string; run(guide: FirstSteps): void };
  /** The button once the player is at the place (instead of "Take me"); with no `run` it walks up and opens the card */
  there?: { label: string | ((host: FirstStepsHost) => string); run?(guide: FirstSteps): void };
  /** True once it is done (ticked steps stay done) */
  done(host: FirstStepsHost): boolean;
}

/** The work Chief Alabi points to: Amaka's site by day, the port (which never shuts) by night */
const workPlace = (host: FirstStepsHost) => (host.siteOpen() ? { boss: GUIDE_TARGETS.site, employer: 'eko-plaza-site', who: 'Supervisor Amaka' } : { boss: GUIDE_TARGETS.port, employer: 'apapa-port', who: 'Foreman Sunday at the port' });

const STEPS: Step[] = [
  {
    id: 'move',
    text: (host) => (host.touch() ? 'Broad Street, Lagos Island. Drag the round stick to walk' : 'Broad Street, Lagos Island. Walk with W A S D or the arrow keys'),
    done: () => false,
  },
  {
    id: 'elder',
    text: () => 'Chief Alabi is calling you. Go and greet him',
    target: () => GUIDE_TARGETS.elder,
    there: { label: 'Greet him' },
    done: (host) => host.metElder(),
  },
  {
    id: 'hire',
    text: (host) => `${workPlace(host).who} is taking hands today. Ask for work`,
    target: (host) => workPlace(host).boss,
    there: { label: 'Ask for work' },
    done: (host) => (host.siteOpen() && host.employed('eko-plaza-site')) || host.employed('apapa-port') || host.timesPaid() > 0,
  },
  {
    id: 'work',
    text: (host) => (host.employed('eko-plaza-site') && host.siteOpen() ? 'Lay a course: carry the six blocks to the wall' : host.employed('apapa-port') ? 'Load the lorry: carry the crates to the bay' : `${workPlace(host).who} is taking hands. Ask for work`),
    there: { label: (host) => ((host.employed('eko-plaza-site') && host.siteOpen()) || host.employed('apapa-port') ? 'Start work' : 'Ask for work') },
    target: (host) => (host.employed('eko-plaza-site') && host.siteOpen() ? GUIDE_TARGETS.sitePallet : host.employed('apapa-port') ? GUIDE_TARGETS.portBay : workPlace(host).boss),
    done: (host) => host.timesPaid() > 0,
  },
  {
    id: 'eat',
    text: () => 'You have earned it: suya from Mallam Bisi',
    target: () => GUIDE_TARGETS.suya,
    there: { label: 'Buy suya' },
    button: { label: 'Not hungry', run: (guide) => guide.tick('eat') },
    done: () => false,
  },
  {
    id: 'home',
    text: () => 'Somewhere to sleep tonight: the estate office lets rooms',
    target: () => GUIDE_TARGETS.estate,
    there: { label: 'See rooms', run: (guide) => guide.seeRooms() },
    done: (host) => host.hasHome(),
  },
  {
    id: 'keep',
    text: () => 'Keep your money and your life on any phone: choose a name',
    button: { label: 'Save my life', run: (guide) => guide.signUp() },
    done: (host) => host.guest() !== true,
  },
];

function read(): Kept | 'done' | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw === null) return null;
    if (raw === 'done' || raw === 'skipped') return 'done';
    const kept = JSON.parse(raw);
    if (kept && kept.v === 2 && Array.isArray(kept.ticked)) return { v: 2, ticked: kept.ticked.filter((id: string) => STEPS.some((s) => s.id === id)) };
    // The older five-step guide kept a number: past its first step, the walk is done
    return { v: 2, ticked: Number(raw) >= 2 ? ['move'] : [] };
  } catch {
    return null;
  }
}

/** Has this life never been played: no guide begun, never paid, no home? */
export function isFreshLife(host: Pick<FirstStepsHost, 'timesPaid' | 'hasHome'>): boolean {
  try {
    if (localStorage.getItem(KEY) !== null) return false;
  } catch {
    return false;
  }
  return host.timesPaid() === 0 && !host.hasHome();
}

/** Would the guide run for this life: new, or part-way through it? */
export function guideWouldRun(host: Pick<FirstStepsHost, 'timesPaid' | 'hasHome'>): boolean {
  const kept = read();
  if (kept === 'done') return false;
  return kept !== null || (host.timesPaid() === 0 && !host.hasHome());
}

/** The guide is over on this life (finished or skipped), as this device knows it */
export function guideOver(): boolean {
  return read() === 'done';
}

/** How the guide ended on this life, as this device knows it (null: not over) */
export function guideEnded(): 'done' | 'skipped' | null {
  try {
    const raw = localStorage.getItem(KEY);
    return raw === 'done' || raw === 'skipped' ? raw : null;
  } catch {
    return null;
  }
}

/** Kept as over on this life: it ended here, or the game server said so (it ended on another device) */
export function keepGuideOver(how: 'done' | 'skipped' = 'done'): void {
  try {
    localStorage.setItem(KEY, how);
  } catch {
    // Kept for this visit only
  }
}

export class FirstSteps {
  private readonly el: HTMLDivElement;
  private readonly host: FirstStepsHost;
  private readonly ticked = new Set<StepId>();
  private current: Step | null = null;
  private marked: string | null = null;
  private shown = '';
  private timer = 0;
  private last = { x: 0, z: 0 };
  private walked = 0;
  private calls = 0;
  private lastCall = 0;
  private stopListening: (() => void) | null = null;
  private over = false;

  /**
   * Starts the guide for a life that is new or part-way through it; does nothing for a life
   * already under way or one whose guide is over (here or, as the server says, anywhere).
   */
  public static begin(host: FirstStepsHost): FirstSteps | null {
    const kept = read();
    if (kept === 'done') return null;
    if (kept === null && (host.timesPaid() > 0 || host.hasHome())) return null;
    return new FirstSteps(host, kept?.ticked ?? []);
  }

  private constructor(host: FirstStepsHost, ticked: StepId[]) {
    this.host = host;
    for (const id of ticked) this.ticked.add(id);
    this.el = document.createElement('div');
    this.el.id = 'nl-first-steps';
    this.el.setAttribute('role', 'status');
    this.el.addEventListener('click', (event) => {
      const target = (event.target as HTMLElement).closest<HTMLElement>('[data-fs]');
      if (!target || !this.current) return;
      event.stopPropagation();
      const act = target.dataset.fs;
      if (act === 'skip') this.finish(false);
      else if (act === 'go') {
        const id = this.current.target?.(this.host);
        if (id) this.host.walkTo(id);
      } else if (act === 'do') this.current.button?.run(this);
      else if (act === 'there') {
        const id = this.current.target?.(this.host);
        if (this.current.there?.run) this.current.there.run(this);
        else if (id) this.host.walkTo(id);
      }
    });
    document.body.appendChild(this.el);
    // Food bought or eaten anywhere counts (suya wrapped for later, a plate at a buka, the fridge)
    this.stopListening = Activity.get().on((event) => {
      if (event.kind === 'need' && event.need === 'hunger' && event.delta > 0) this.tick('eat');
      else if (event.kind === 'money' && event.type === 'FOOD_PURCHASE' && event.amount < 0) this.tick('eat');
    });
    const at = host.position();
    this.last = { x: at.x, z: at.z };
    this.save();
    this.check();
    this.timer = window.setInterval(() => this.check(), 500);
  }

  /** The step on the line now, for tests and the game */
  public get step(): StepId | null {
    return this.current?.id ?? null;
  }

  public get isOver(): boolean {
    return this.over;
  }

  /** Ticks a step for good (a look at the rooms, a meal, "not hungry", "later") */
  public tick(id: StepId): void {
    if (this.over || this.ticked.has(id)) return;
    this.ticked.add(id);
    this.save();
    this.check();
  }

  /** The homes within the player's means; a look at them is the step done (renting is their choice) */
  public seeRooms(): void {
    this.host.seeRooms();
    this.tick('home');
  }

  /** The sign-up screen, from the last step; "Play as a guest for now" ticks it */
  public signUp(): void {
    this.host.signUp(() => this.tick('keep'));
  }

  private isDone(step: Step): boolean {
    return this.ticked.has(step.id) || step.done(this.host);
  }

  private check(): void {
    if (this.over) return;
    // How far they have walked (a ride or a door is a jump, not a walk)
    const at = this.host.position();
    const stride = Math.hypot(at.x - this.last.x, at.z - this.last.z);
    if (stride < 6) this.walked += stride;
    this.last = { x: at.x, z: at.z };
    if (this.walked > 3) this.tick('move');
    // The list of homes, however it was opened (the estate office, the phone)
    if (this.host.lookingAtRooms()) this.tick('home');
    if (this.over) return;
    // Steps done out of order stay done: the first not yet done is the one shown
    for (const step of STEPS) if (!this.ticked.has(step.id) && step.id !== 'keep' && step.done(this.host)) {
      this.ticked.add(step.id);
      this.save();
    }
    const next = STEPS.find((step) => !this.isDone(step)) ?? null;
    if (!next) {
      // Not in the middle of something they are reading: it ends when they are back in the street
      if (!this.host.windowOpen()) this.finish(true);
      return;
    }
    this.show(next);
    // Chief Alabi calls out when the player comes near, a few times at most, until they come over
    if (next.id === 'elder') {
      const elder = this.host.where(GUIDE_TARGETS.elder);
      const now = performance.now();
      if (elder && this.calls < 3 && now - this.lastCall > 14_000 && Math.hypot(elder.x - at.x, elder.z - at.z) < 45) {
        this.calls += 1;
        this.lastCall = now;
        this.host.elderCalls(['My child! Come, greet your elder.', 'You, the new face! Come here small.', 'Ehen! Do not pass me like that o.'][this.calls - 1]);
      }
    }
  }

  /** The line for this step: its words, how far, "Take me" or its own button, ✕ */
  private show(step: Step): void {
    const target = step.target?.(this.host) ?? null;
    const there = target ? this.host.where(target) : null;
    const at = this.host.position();
    const metres = there ? Math.round(Math.hypot(there.x - at.x, there.z - at.z)) : null;
    const n = STEPS.indexOf(step) + 1;
    const near = metres !== null && metres <= 6;
    const turn = target && !near ? this.host.bearing(target) : null;
    const busy = step.id === 'work' && this.host.working();
    const html = `
      <span class="fs-n">${n}/${STEPS.length}</span>
      <span class="fs-text">${step.text(this.host)}${metres !== null && !near ? ` <em class="fs-far">${turn !== null ? `<i class="fs-way" style="transform:rotate(${Math.round(turn / 15) * 15}deg)">↑</i>` : '·'} ${metres} m</em>` : ''}</span>
      ${step.button ? `<button type="button" class="fs-do" data-fs="do">${step.button.label}</button>` : ''}
      ${there && !near ? `<button type="button" class="fs-do fs-go" data-fs="go">Take me</button>` : ''}
      ${near && step.there && !busy ? `<button type="button" class="fs-do fs-there" data-fs="there">${typeof step.there.label === 'string' ? step.there.label : step.there.label(this.host)}</button>` : ''}
      <button type="button" class="fs-skip" data-fs="skip" aria-label="End the guide">✕</button>`;
    // Drawn again only when what it says has changed
    if (step !== this.current || this.shown !== html) {
      this.el.innerHTML = html;
      this.shown = html;
      this.el.dataset.step = step.id;
    }
    // The marker follows the step, and a step whose place changes (the site knocks off: the port)
    if (step !== this.current || target !== this.marked) {
      this.marked = target;
      this.host.mark(target);
    }
    this.current = step;
  }

  /** Taken away without a word: the game server says it ended on another device */
  public dismiss(how: 'done' | 'skipped'): void {
    if (this.over) return;
    this.over = true;
    window.clearInterval(this.timer);
    this.stopListening?.();
    this.host.mark(null);
    this.el.remove();
    keepGuideOver(how);
  }

  private finish(earned: boolean): void {
    if (this.over) return;
    this.over = true;
    window.clearInterval(this.timer);
    this.stopListening?.();
    this.host.mark(null);
    this.el.remove();
    keepGuideOver(earned ? 'done' : 'skipped');
    this.host.ended(earned ? 'done' : 'skipped');
    if (earned) this.host.say('🎉 That is your first day in Lagos. Today\'s hustle, the life ladder and the whole city are yours now.');
  }

  private save(): void {
    try {
      localStorage.setItem(KEY, JSON.stringify({ v: 2, ticked: [...this.ticked] } satisfies Kept));
    } catch {
      // Kept for this visit only
    }
  }
}
