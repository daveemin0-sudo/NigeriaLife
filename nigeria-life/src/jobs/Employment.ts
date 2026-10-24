import { BackendService } from '../backend/BackendService';
import { profileKey } from '../backend/Profile';
import { emitGameEvent } from '../game/GameEvents';

/**
 * Being employed somewhere: taken on at a real workplace, doing its work there, paid for each
 * piece of work at the rate of the grade reached, and moving up a grade as the work adds up.
 *
 * The work itself is done in the world (crates carried at the port, say). This is the record
 * of it: who the player works for, how much they have done, and what that is worth.
 */

export { EMPLOYERS, WORKSITES } from './employers';
export type { Grade, Employer } from './employers';
import { EMPLOYERS, type Grade, type Employer } from './employers';


interface Service {
  /** The game day they were taken on */
  since: number;
  done: number;
}

export interface WorkResult {
  ok: boolean;
  reason?: string;
  pay?: number;
  /** The grade just reached, if this piece of work earned one */
  promoted?: Grade;
}

const STORE = 'nigeria_life_employment_v1';
/** Jobs left, kept for the CV */
const PAST = 'nigeria_life_employment_past_v1';

export interface PastJob {
  employer: string;
  title: string;
  trade: string;
  since: number;
  until: number;
  done: number;
}

export class Employment {
  private static instance: Employment | null = null;
  private readonly backend = BackendService.getInstance();
  private records: { [employerId: string]: Service } = {};
  private history: PastJob[] = [];
  private listeners: Array<() => void> = [];
  /** The day on the game's calendar, for the date someone was taken on */
  public today: () => number = () => 1;

  public static get(): Employment {
    if (!Employment.instance) Employment.instance = new Employment();
    return Employment.instance;
  }

  private constructor() {
    try {
      const saved = JSON.parse(localStorage.getItem(profileKey(STORE)) || '{}');
      for (const employer of EMPLOYERS) {
        const record = saved?.[employer.id];
        if (record && Number.isFinite(record.done)) this.records[employer.id] = { since: Number(record.since) || 1, done: Math.max(0, Math.floor(record.done)) };
      }
    } catch {
      // A record that cannot be read back is as if they had never worked there
    }
    try {
      const past = JSON.parse(localStorage.getItem(profileKey(PAST)) || '[]');
      if (Array.isArray(past)) this.history = past.filter((j) => j && typeof j.employer === 'string').slice(0, 30);
    } catch {
      // No past jobs kept
    }
  }

  /** The jobs held before, latest first */
  public past(): readonly PastJob[] {
    return this.history;
  }

  private changed(): void {
    try {
      localStorage.setItem(profileKey(STORE), JSON.stringify(this.records));
    } catch {
      // Storage shut off: the job holds until the page is closed
    }
    for (const listener of this.listeners) listener();
  }

  public subscribe(listener: () => void): void {
    this.listeners.push(listener);
  }

  public employer(id: string): Employer | null {
    return EMPLOYERS.find((one) => one.id === id) ?? null;
  }

  public isEmployed(id: string): boolean {
    return !!this.records[id];
  }

  /** How many pieces of work have been done there. */
  public done(id: string): number {
    return this.records[id]?.done ?? 0;
  }

  public since(id: string): number | null {
    return this.records[id]?.since ?? null;
  }

  /** The grade someone who has done this much work is on. */
  public grade(id: string): Grade | null {
    const employer = this.employer(id);
    if (!employer) return null;
    const done = this.done(id);
    const skills = this.backend.getSkills();
    const skillLevel = employer.skill ? (skills[employer.skill] ?? 1) : 10;
    return [...employer.grades].reverse().find((grade) => {
      const workMet = done >= grade.from;
      const skillMet = grade.skillReq ? skillLevel >= grade.skillReq : true;
      return workMet && skillMet;
    }) ?? employer.grades[0];
  }

  /** The grade above the one they are on, if there is one. */
  public nextGrade(id: string): Grade | null {
    const employer = this.employer(id);
    const now = this.grade(id);
    if (!employer || !now) return null;
    return employer.grades[employer.grades.indexOf(now) + 1] ?? null;
  }

  /** Everywhere the player works. */
  public jobs(): Array<{ employer: Employer; grade: Grade; next: Grade | null; done: number; since: number }> {
    return EMPLOYERS.filter((employer) => this.isEmployed(employer.id)).map((employer) => ({
      employer,
      grade: this.grade(employer.id)!,
      next: this.nextGrade(employer.id),
      done: this.done(employer.id),
      since: this.records[employer.id].since,
    }));
  }

  /** Taken on. Someone who worked there before and left starts again from the bottom. */
  public apply(id: string): { ok: boolean; reason?: string } {
    const employer = this.employer(id);
    if (!employer) return { ok: false, reason: 'Nobody is hiring there.' };
    if (this.isEmployed(id)) return { ok: false, reason: `You already work at ${employer.name}.` };
    this.records[id] = { since: this.today(), done: 0 };
    this.changed();
    return { ok: true };
  }

  public resign(id: string): boolean {
    if (!this.records[id]) return false;
    const employer = this.employer(id);
    if (employer) {
      this.history.unshift({ employer: employer.name, title: this.grade(id)?.title ?? employer.trade, trade: employer.trade, since: this.records[id].since, until: this.today(), done: this.records[id].done });
      this.history = this.history.slice(0, 30);
      try {
        localStorage.setItem(profileKey(PAST), JSON.stringify(this.history));
      } catch {
        // Not kept
      }
    }
    delete this.records[id];
    this.changed();
    return true;
  }

  /** Why a piece of work cannot be started now, or null if it can. */
  public cannotWork(id: string): string | null {
    const employer = this.employer(id);
    if (!employer) return 'There is no work there.';
    if (!this.isEmployed(id)) return `You do not work at ${employer.name}. Ask to be taken on first.`;
    if (this.backend.getData().stats.energy < employer.energy) return `You are too tired for it (it takes ${employer.energy}% energy). Eat or rest first.`;
    return null;
  }

  /**
   * One piece of work is finished. It is paid for here, once, at the rate of the grade they
   * were on when they did it; it takes its energy, counts toward the next grade and counts
   * for the player's career.
   */
  /**
   * A piece of work the game server has checked and paid (it holds the money and the count of
   * work done): the record here catches up and the work's energy is spent. Nothing is paid here.
   */
  public settledByServer(id: string, pay: number, done: number): WorkResult {
    const employer = this.employer(id);
    const record = this.records[id];
    const grade = this.grade(id);
    if (!employer || !record || !grade) return { ok: false, reason: 'You do not work there.' };
    this.backend.modifyNeed('energy', -employer.energy);
    this.backend.addJobExperience(employer.xp);
    if (employer.skill) this.backend.addSkillXp(employer.skill, 1);
    record.done = Math.max(record.done + 1, done);
    const now = this.grade(id)!;
    this.changed();
    emitGameEvent('work_shift');
    return { ok: true, pay, promoted: now !== grade ? now : undefined };
  }

  public complete(id: string): WorkResult {
    const employer = this.employer(id);
    const record = this.records[id];
    const grade = this.grade(id);
    if (!employer || !record || !grade) return { ok: false, reason: 'You do not work there.' };
    const paid = this.backend.performGig(grade.pay, employer.energy, `${grade.title}, ${employer.name}`);
    if (!paid.success) return { ok: false, reason: paid.message };
    this.backend.addJobExperience(employer.xp);
    if (employer.skill) {
      this.backend.addSkillXp(employer.skill, 1);
    }
    record.done += 1;
    const now = this.grade(id)!;
    this.changed();
    return { ok: true, pay: grade.pay, promoted: now !== grade ? now : undefined };
  }
}
