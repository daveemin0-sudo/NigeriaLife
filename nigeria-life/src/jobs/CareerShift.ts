import type { ArmPose } from '../interactions/Poses';
import type { BackendService } from '../backend/BackendService';
import { OnlineAccount } from '../online/OnlineAccount';
import { showGameToast } from '../ui/GameToast';
import { SoundEngine } from '../audio/SoundEngine';

/**
 * A career shift from the phone is an hour at the workplace, in the trade's clothes, doing the work.
 * The card on screen says what is being done and how long is left. Walking out, or ending it, pays
 * for the time the server's clock has counted. The full wage waits until the hour is up.
 */

export interface CareerPost {
  /** The room the shift is worked in (`interior_place_…`), when it is indoors */
  interior?: string;
  /** A roadside workplace, when the job is not inside a room */
  outdoor?: { x: number; z: number; radius: number };
  /** Sent to `ride:roadside-${go}` when there is a door on the road */
  go?: string;
  trade: string;
  boss: string;
  tasks: string[];
}

export const CAREER_POSTS: Record<string, CareerPost> = {
  job_shop_assistant: {
    interior: 'interior_place_balogun-market',
    go: 'balogun-market',
    trade: 'Wholesale Trade',
    boss: 'Alhaji Danjuma',
    tasks: ['Heaving a bale of lace off the pile', 'Measuring a cut for a customer', 'Counting the cash into the till'],
  },
  job_mechanic: {
    interior: 'interior_place_ladipo-auto',
    go: 'ladipo-auto',
    trade: 'Motor mechanic',
    boss: 'Baba Ladipo',
    tasks: ['Draining the old oil', 'Bleeding the brakes', 'Tightening the sump plug'],
  },
  job_danfo_driver: {
    outdoor: { x: 9, z: 40, radius: 28 },
    trade: 'Commercial transit',
    boss: 'the union man',
    tasks: ['Calling the next stop', 'Taking the fare and giving change', 'Pulling off when the bus is full'],
  },
  job_food_seller: {
    interior: 'interior_place_amala-shitta',
    go: 'amala-shitta',
    trade: 'Culinary Arts',
    boss: 'Mama Shitta',
    tasks: ['Stirring the pot', 'Dishing a plate of amala', 'Wiping the next table'],
  },
  job_office_worker: {
    interior: 'interior_place_marina-towers',
    go: 'marina-towers',
    trade: 'Corporate Banking',
    boss: 'Mr Eze',
    tasks: ['Taking a deposit at the window', 'Running the notes through the counter', 'Printing the receipt'],
  },
  job_software_dev: {
    outdoor: { x: -10, z: -25, radius: 30 },
    trade: 'Software Engineering',
    boss: 'the floor lead',
    tasks: ['Writing a payment service', 'Reading a failing test', 'Pushing the fix'],
  },
  job_construction: {
    outdoor: { x: 16.2, z: 64.5, radius: 28 },
    trade: 'Building work',
    boss: 'the foreman',
    tasks: ['Mixing a bag of cement', 'Laying the next course of blocks', 'Checking the line is straight'],
  },
  job_security: {
    outdoor: { x: 15, z: 75, radius: 30 },
    trade: 'Security',
    boss: 'the sergeant',
    tasks: ['Checking a visitor’s pass', 'Watching the gate', 'Logging the car that just left'],
  },
};

interface Hooks {
  backend: BackendService;
  interiorId(): string | null;
  street(): { x: number; z: number } | null;
  dress(trade: string | null): void;
  pose(arms: ArmPose): void;
  /** Standing still, so a work pose does not fight a walk */
  still(): boolean;
  /** A cab to a roadside door, or to a point on the street */
  go(post: CareerPost, name: string): void;
}

const ARMS: ArmPose[] = ['reach', 'carry', 'talk'];

export const CareerShift = {
  hooks: null as Hooks | null,
  /** They have stood at the post during this shift, so leaving it is leaving the shift */
  arrived: false,
  /** The door may open: the shift is being paid off */
  releasing: false,
  lineAt: 0,
  task: 0,
  posing: false,
  settling: false,
  /** Which buttons are on the card, so a tick does not rebuild them under a finger */
  shown: '' as '' | 'go' | 'work' | 'done',

  started(jobId: string): void {
    this.arrived = false;
    this.releasing = false;
    this.task = 0;
    this.lineAt = 0;
    this.posing = false;
    this.shown = '';
    const post = CAREER_POSTS[jobId];
    const shift = this.hooks?.backend.getActiveJobShift();
    if (post && shift && shift.job.shiftDuration >= 3600) {
      this.hooks?.go(post, shift.job.workplace);
    }
    this.paint();
  },

  /** Why the player may not walk out, or null if the door is free */
  lock(): string | null {
    if (this.releasing || !this.arrived) return null;
    const shift = this.hooks?.backend.getActiveJobShift();
    const post = shift ? CAREER_POSTS[shift.job.id] : null;
    if (!shift || !post?.interior) return null;
    if (this.hooks?.interiorId() !== post.interior) return null;
    return `🦺 You are on shift at ${shift.job.workplace}, in your work clothes. End the shift on the card to leave. You are paid for the time worked.`;
  },

  tick(): void {
    const hooks = this.hooks;
    if (!hooks) return;
    const shift = hooks.backend.getActiveJobShift();
    if (!shift) {
      this.clear();
      return;
    }
    const post = CAREER_POSTS[shift.job.id];
    if (!post) {
      this.paint();
      return;
    }
    const here = this.atPost(post);
    if (here && hooks.still() && !this.arrived) {
      this.arrived = true;
      hooks.dress(post.trade);
    }
    if (this.arrived && !here && !this.releasing) {
      void this.settle(true);
      return;
    }
    if (here && !hooks.backend.getActiveJobShift()?.isReady && hooks.still()) {
      const now = Date.now();
      if (now - this.lineAt > 8000) {
        this.lineAt = now;
        this.task = (this.task + 1) % post.tasks.length;
        hooks.pose(ARMS[this.task % ARMS.length]);
        this.posing = true;
      }
    }
    this.paint();
  },

  line(): string {
    const shift = this.hooks?.backend.getActiveJobShift();
    const post = shift ? CAREER_POSTS[shift.job.id] : null;
    if (!shift || !post) return '';
    return post.tasks[this.task % post.tasks.length];
  },

  async collect(): Promise<void> {
    const shift = this.hooks?.backend.getActiveJobShift();
    if (shift && shift.job.shiftDuration >= 3600 && !this.atPost(CAREER_POSTS[shift.job.id]) && !shift.isReady) {
      showGameToast('Get to the workplace. The shift is running.', 'info');
      return;
    }
    if (shift && shift.job.shiftDuration >= 3600 && !this.arrived && shift.isReady) {
      showGameToast('That wage is paid at the workplace. You were not there for the shift.', 'warning');
      this.hooks?.backend.abandonJobShift();
      this.clear();
      return;
    }
    await this.settle(false);
  },

  async endEarly(): Promise<void> {
    this.releasing = true;
    await this.settle(true);
  },

  atPost(post: CareerPost | undefined): boolean {
    if (!post || !this.hooks) return false;
    if (post.interior) return this.hooks.interiorId() === post.interior;
    const street = this.hooks.street();
    if (!street || !post.outdoor || this.hooks.interiorId()) return false;
    const spot = post.outdoor;
    return Math.hypot(street.x - spot.x, street.z - spot.z) <= spot.radius;
  },

  async settle(early: boolean): Promise<void> {
    const hooks = this.hooks;
    if (!hooks || this.settling) return;
    this.settling = true;
    const stop = () => { this.settling = false; };
    const shiftInfo = hooks.backend.getActiveJobShift();
    if (!shiftInfo) {
      this.clear();
      return;
    }
    if (!early && !shiftInfo.isReady) {
      stop();
      showGameToast(`Shift still going. ${left(shiftInfo.remainingSecs)} left.`, 'info');
      return;
    }
    const online = OnlineAccount.get();
    if (!online) {
      const result = early ? hooks.backend.cashOutJobShift() : hooks.backend.completeJobShift();
      if (result.success && result.reward > 0) SoundEngine.getInstance().playTransactionSuccess();
      showGameToast(result.message, result.success ? 'success' : 'warning');
      this.clear();
      return;
    }
    const gigId = `career:${shiftInfo.job.id}`;
    let shift = online.rememberedGig(gigId);
    if (!shift) {
      const opened = await online.openGig(gigId);
      if (opened.status === 0) {
        this.releasing = false;
        stop();
        showGameToast('The server could not be reached, so this shift cannot be paid yet.', 'warning');
        return;
      }
      if (typeof opened.shift === 'string' && opened.shift) shift = opened.shift;
    }
    if (!shift) {
      hooks.backend.abandonJobShift();
      showGameToast('There is no shift on the books to collect.', 'warning');
      this.clear();
      return;
    }
    const finished = await online.finishGig(shift, early);
    if (!finished.ok) {
      const reason = finished.reason ?? '';
      if ((finished as { status?: number }).status === 0) {
        this.releasing = false;
        stop();
        showGameToast('The server could not be reached, so this shift cannot be paid yet.', 'warning');
        return;
      }
      if (/faster than anyone|barely started/.test(reason)) {
        this.releasing = false;
        stop();
        showGameToast(reason, 'warning');
        return;
      }
      online.forgetGig(gigId);
      hooks.backend.abandonJobShift();
      showGameToast(reason || 'There is no shift on the books to collect.', 'warning');
      this.clear();
      return;
    }
    online.forgetGig(gigId);
    const noted = hooks.backend.noteServerJobShift(finished.pay ?? 0, finished.slip);
    if (noted.success) SoundEngine.getInstance().playTransactionSuccess();
    const portion = early ? ` You left early, so this is the time worked.` : '';
    showGameToast(`${noted.message}${portion}`, noted.success ? 'success' : 'warning', 5000);
    this.clear();
  },

  paint(): void {
    const shift = this.hooks?.backend.getActiveJobShift();
    let card = document.getElementById('career-shift-card');
    if (!shift) {
      card?.remove();
      return;
    }
    if (!card) {
      card = document.createElement('div');
      card.id = 'career-shift-card';
      card.innerHTML = `<div class="career-shift-title"></div><div class="career-shift-doing"></div><div class="career-shift-time"></div><div class="career-shift-actions"></div>`;
      document.body.appendChild(card);
      card.addEventListener('click', (event) => {
        const button = (event.target as HTMLElement).closest('button');
        if (!button) return;
        if (button.dataset.career === 'end') void this.endEarly();
        else if (button.dataset.career === 'collect') void this.collect();
        else if (button.dataset.career === 'go') {
          const current = this.hooks?.backend.getActiveJobShift();
          const post = current ? CAREER_POSTS[current.job.id] : null;
          if (post && current) this.hooks?.go(post, current.job.workplace);
        }
      });
    }
    const post = CAREER_POSTS[shift.job.id];
    const title = card.querySelector('.career-shift-title');
    const doing = card.querySelector('.career-shift-doing');
    const time = card.querySelector('.career-shift-time');
    const actions = card.querySelector('.career-shift-actions');
    if (title) title.textContent = `${shift.job.icon} On shift · ${shift.job.title}`;
    let mode: 'go' | 'work' | 'done' = 'work';
    if (!this.arrived && post && shift.job.shiftDuration >= 3600) mode = 'go';
    else if (shift.isReady) mode = 'done';
    if (mode === 'go') {
      if (doing) doing.textContent = `Get to ${shift.job.workplace}. The hour has started, and the work is there.`;
      if (time) time.textContent = `${left(shift.remainingSecs)} left`;
    } else if (mode === 'done') {
      if (doing) doing.textContent = 'The hour is done.';
      if (time) time.textContent = `Collect the wage at ${shift.job.workplace}.`;
    } else {
      if (doing) doing.textContent = post && this.arrived ? post.tasks[this.task % post.tasks.length] : shift.job.workplace;
      if (time) time.textContent = this.arrived
        ? `${left(shift.remainingSecs)} left · in your work clothes at ${shift.job.workplace}`
        : `${left(shift.remainingSecs)} left · ${shift.job.workplace}`;
    }
    if (actions && this.shown !== mode) {
      this.shown = mode;
      actions.innerHTML = mode === 'go'
        ? `<button type="button" data-career="go">Go to work</button><button type="button" data-career="end">End shift</button>`
        : mode === 'done'
          ? `<button type="button" data-career="collect" id="career-shift-collect">Collect</button>`
          : `<button type="button" data-career="end">End shift · paid for time worked</button>`;
    }
  },

  clear(): void {
    if (this.posing) this.hooks?.pose('rest');
    if (this.arrived) this.hooks?.dress(null);
    this.arrived = false;
    this.releasing = false;
    this.posing = false;
    this.settling = false;
    this.shown = '';
    document.getElementById('career-shift-card')?.remove();
  },
};

function left(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return rest ? `${minutes} min ${rest}s` : `${minutes} min`;
}
