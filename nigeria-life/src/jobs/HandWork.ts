import type * as THREE from 'three';
import { payeNote, takeHome } from '../life/Tax';
import { Activity } from '../life/Activity';
import { ShiftSkill } from './ShiftSkill';
import type { Actor } from '../interactions/Actor';
import type { ArmPose, LegPose } from '../interactions/Poses';
import type { PlaceHost } from '../destinations/PlaceActions';
import { Sequence, steps } from '../interactions/Sequence';
import { Employment, type WorkResult } from './Employment';
import { OnlineAccount } from '../online/OnlineAccount';

/**
 * Work that is done by hand at a place: someone in charge who takes people on, and a job of
 * carrying things one at a time from where they are stacked to where they are wanted. Crates
 * to a lorry at the port, blocks to a wall on a building site.
 *
 * The place says where things are lifted and set down and what happens to them; this does the
 * rest the same way everywhere: being taken on, the terms, the walk with each thing in the
 * hands, being paid once when the last is down and not at all if the worker walks off, and
 * moving up a grade as the work adds up. The record of it all is `Employment`.
 *
 * On a game server the server checks and pays the work: it is told when the work starts (and
 * refuses if the player is not taken on or not at the workplace), and when the last thing is
 * down it times the work by its own clock, checks the player is still there, and pays from its
 * own record of their grade. The game then shows what the server paid.
 */

/**
 * A shift: the work done back to back, in the trade's clothes, until it is done. The worker does not
 * leave the place until then (the game asks `Shifts.current` before letting anyone out), unless they
 * tell the one in charge they are ending it. Each piece is paid as it is finished, as before.
 */
export const Shifts = {
  current: null as null | { employer: string; boss: string; place: string; done: number; total: number; earned: number },
  /** Into the work clothes for a trade, or (null) back out of them (set by the game) */
  dress: null as null | ((trade: string | null) => void),
  /** Sent from the phone to work for this employer: taken straight to whoever is in charge on arrival */
  arriving: null as string | null,
  /** How many rounds make a shift, if not SHIFT_PIECES (a test that looks at one round sets 1) */
  pieces: null as number | null,
};

/** How many rounds of work make a shift */
export const SHIFT_PIECES = 4;

export interface HandWorkWords {
  /** Who is in charge, as their card names them: "Foreman Sunday" */
  boss: string;
  /** How they are spoken of in a sentence: "the foreman" */
  theBoss: string;
  /** What they are when they speak: "Foreman" */
  says: string;
  /** Where they are in charge: "Loading bay, Apapa Port" */
  role: string;
  /** How the offer of work begins: "We take hands on by the lorry" */
  offer: string;
  /** What someone just taken on is told to get on with: "The lorry is at the bay." */
  ready: string;
  /** One piece of work, and the word for work done: "load", "loaded" */
  piece: string;
  done: string;
}

/** One task in a piece of work done at a desk or counter: go there, face it, and do it */
export interface WorkRound {
  stand: THREE.Vector3;
  face: number | THREE.Vector3;
  arms: ArmPose;
  legs?: LegPose;
  seconds: number;
  /** What was just done, said as it is finished */
  done?(actor: Actor): void;
}

export interface HandWorkOptions {
  /** The employer's id in `Employment` */
  employerId: string;
  /** What the work is called while it is being done: "load the lorry" */
  name: string;
  words: HandWorkWords;
  /** How many things are carried for one piece of work (when the work is carrying) */
  count?: number;
  /** Where to stand to lift the i-th thing, which way to face, and what lifting it does */
  lift?(index: number): { stand: THREE.Vector3; face: number | THREE.Vector3; take(actor: Actor): void };
  /** Where to stand to set it down, which way to face, and what setting it down does */
  set?(index: number): { stand: THREE.Vector3; face: number | THREE.Vector3; put(actor: Actor): void };
  /** Or the tasks that make up one piece of work, done in turn (at a till, a bedside, a desk) */
  rounds?: WorkRound[];
  /** Why the work cannot start just now, in the words of whoever is in charge; null if it can */
  cannotStart?(): string | null;
  began?(): void;
  /** It is over: paid for, or given up part-way (things go back where they were) */
  ended(paid: boolean, host: PlaceHost): void;
  /** How long it may take before it is given up as abandoned */
  maxSeconds?: number;
  /** How many rounds make a shift here (SHIFT_PIECES if not said); 0 for work done a piece at a time */
  shiftPieces?: number;
}

export interface HandWork {
  /** Being done now */
  readonly working: boolean;
  /** How many things have been set down in the piece of work in hand */
  readonly setDown: number;
  /** How many pieces of work have been paid for here since the game was opened */
  readonly paid: number;
  /** The stars the last paid piece of work was rated */
  readonly stars: number;
  /** What the rate is for the grade the worker is on (or would start on) */
  rate(): number;
  /** The terms, as the one in charge states them */
  terms(): string;
  /** What the card of the one in charge says on its button */
  bossLabel(): string;
  /** Speaking to the one in charge: to be taken on, to hear how it stands, or to leave */
  askBoss(host: PlaceHost): void;
  /** Starting a piece of work, if the worker may */
  start(host: PlaceHost): void;
  /** On a shift here now */
  readonly onShift: boolean;
  /** Starting a shift: the rounds done back to back in work clothes (taken on first if need be) */
  startShift(host: PlaceHost): void;
}

const capital = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

/** What a good tap does, in the words of the trade */
const SKILL_WORD: Record<string, string> = {
  fitness: 'Lift!', cooking: 'Serve!', coding: 'Type!', craft: 'Fix!', charisma: 'Sell!', music: 'On the beat!', driving: 'Steady!', academics: 'Focus!', hustle: 'Hustle!',
};

export function createHandWork(options: HandWorkOptions): HandWork {
  const jobs = Employment.get();
  const id = options.employerId;
  const employer = jobs.employer(id);
  const words = options.words;
  const effort = employer?.energy ?? 0;
  let working = false;
  let setDown = 0;
  let paid = 0;
  let lastStars = 0;
  /** The shift being worked here, and whether the piece just finished was paid, and for how much */
  let shift: { done: number; total: number; earned: number } | null = null;
  let piecePaid = 0;
  const piecesNow = () => options.shiftPieces ?? Shifts.pieces ?? SHIFT_PIECES;
  const naira = (n: number) => `₦${Math.round(n).toLocaleString()}`;

  const endShift = (host: PlaceHost, line?: string, tone: 'success' | 'info' | 'warning' = 'success') => {
    if (!shift) return;
    const s = shift;
    shift = null;
    Shifts.current = null;
    Shifts.dress?.(null);
    host.say(line ?? `🦺 Shift over at ${employer?.name ?? 'work'}: ${s.done} round${s.done === 1 ? '' : 's'} done, ${naira(s.earned)} earned. Back into your own clothes.`, tone);
  };

  const rate = () => (jobs.grade(id) ?? employer?.grades[0])?.pay ?? 0;
  const terms = () => (employer?.grades ?? []).map((grade) => `₦${grade.pay.toLocaleString()} a ${words.piece}${grade.from ? ` once you have done ${grade.from}` : ' to start'}`).join(', ');

  const doTheWork = (host: PlaceHost) => {
    const actor = host.actor;
    working = true;
    setDown = 0;
    options.began?.();
    // Skill on the job: a sweep for each part of the work, rated in stars at the end
    const skill = ShiftSkill.get();
    skill.begin(SKILL_WORD[employer?.skill ?? ''] ?? 'Tap in the green!', options.rounds?.length ?? options.count ?? 1);
    let sweep: { end(): void } | null = null;
    const work = new Sequence(options.name, [actor]);
    work.maxSeconds = options.maxSeconds ?? 150;
    const online = OnlineAccount.get();
    let serverShift: string | null = null;
    if (online) {
      work.add(steps.settle(`${words.theBoss} notes the start`, async () => {
        const started = await online.startWork(id);
        if (!started.ok || !started.shift) {
          host.say(started.reason ?? `${capital(words.theBoss)} cannot start you just now.`, 'warning');
          return false;
        }
        serverShift = started.shift;
        return true;
      }));
    }
    (options.rounds ?? []).forEach((round, i) => {
      work.add(
        steps.walk(actor, round.stand, { speed: 3.2 }),
        steps.face(actor, round.face),
        steps.call('the sweep starts', () => { sweep = skill.round(); }),
        steps.animate(actor, { arms: round.arms, legs: round.legs ?? 'stand' }, round.seconds, [{
          at: 0.95,
          run: () => {
            sweep?.end();
            sweep = null;
            round.done?.(actor);
            setDown = i + 1;
          },
        }]),
        steps.animate(actor, { arms: 'rest', legs: 'stand' }, 0.05)
      );
    });
    for (let i = 0; i < (options.rounds ? 0 : options.count ?? 0); i++) {
      const from = options.lift!(i);
      const to = options.set!(i);
      work.add(
        steps.walk(actor, from.stand, { speed: 3.6 }),
        steps.face(actor, from.face),
        steps.animate(actor, { arms: 'reach' }, 0.7, [{ at: 0.6, run: () => { from.take(actor); sweep = skill.round(); } }]),
        steps.walk(actor, to.stand, { speed: 3 }),
        steps.face(actor, to.face),
        steps.animate(actor, { arms: 'reach' }, 0.7, [{
          at: 0.6,
          run: () => {
            sweep?.end();
            sweep = null;
            to.put(actor);
            setDown = i + 1;
          },
        }])
      );
    }
    // Paid when the last thing is down, and only then
    const announce = (result: WorkResult, rated?: { stars: number; tip: number }, fromServer = false): boolean => {
      if (!result.ok) {
        host.say(result.reason ?? `${capital(words.theBoss)} will not pay for that.`, 'warning');
        return false;
      }
      paid += 1;
      piecePaid = result.pay ?? 0;
      // The stars, and the tip they earn. Online, the server already added the tip to the wage.
      const score = rated ?? skill.finish(result.pay ?? 0);
      const stars = '★'.repeat(score.stars) + '☆'.repeat(3 - score.stars);
      if (!fromServer && score.tip > 0) host.backend.processTransaction({ type: 'BONUS', amount: score.tip, description: `Tip for a ${score.stars}-star ${words.piece}` });
      if (score.stars === 3) Activity.emit({ kind: 'acted', id: 'three-star shift' });
      lastStars = score.stars;
      if (score.tip > 0) setTimeout(() => host.say(`${stars} ${score.stars === 3 ? 'Perfect work!' : 'Good work.'} ${capital(words.theBoss)} tips you ₦${score.tip.toLocaleString()}.`, 'success'), 1800);
      // The wage as it reaches the hand: after PAYE, which the payslip shows
      const wage = result.slip ? takeHome(result.slip) : `₦${result.pay!.toLocaleString()}`;
      host.say(result.promoted
        ? `${capital(words.theBoss)} pays you ${wage} and makes you ${result.promoted.title.toLowerCase()}: ₦${result.promoted.pay.toLocaleString()} a ${words.piece} from now on.`
        : `${capital(words.theBoss)} pays you ${wage} for the ${words.piece}. Energy -${effort}%.`, 'success');
      const note = result.slip ? payeNote(result.slip) : null;
      if (note) setTimeout(() => host.say(note, 'info'), score.tip > 0 ? 3600 : 1800);
      if (result.docked) setTimeout(() => host.say(`${result.docked}: ${words.theBoss} docked a fifth of the pay. Eat, rest and wash before the next ${words.piece}.`, 'warning'), 1200);
      return true;
    };
    if (online) {
      work.add(steps.settle(`paid for the ${words.piece}`, async () => {
        const rated = skill.finish(rate());
        // Starving, worn out or unwashed: the server docks a fifth (the game can only own up to it)
        const poor = host.backend.poorShape();
        const finished = await online.finishWork(serverShift ?? '', rated.stars, !!poor);
        if (!finished.ok) return announce({ ok: false, reason: finished.reason });
        const tip = finished.tip ?? 0;
        return announce(jobs.settledByServer(id, finished.pay ?? rate(), finished.done ?? 0, finished.slip, finished.docked ? poor ?? 'You worked in poor shape' : undefined), { stars: rated.stars, tip }, true);
      }));
    } else {
      work.add(steps.call(`paid for the ${words.piece}`, () => announce(jobs.complete(id))));
    }
    piecePaid = 0;
    work.onEnd((reason) => {
      if (reason !== 'done') skill.finish(0);
      working = false;
      options.ended(reason === 'done', host);
      if (!shift) return;
      // On a shift: the next piece straight after, till the shift is done (or the worker is spent)
      const wasPaid = reason === 'done' && piecePaid > 0;
      if (!wasPaid) {
        endShift(host, `🦺 You walked off in the middle of a round: the shift is over (${shift.done} of ${shift.total} rounds done, ${naira(shift.earned)} earned).`, 'warning');
        return;
      }
      shift.done += 1;
      shift.earned += piecePaid;
      if (Shifts.current) Object.assign(Shifts.current, { done: shift.done, earned: shift.earned });
      if (shift.done >= shift.total) {
        endShift(host);
        return;
      }
      const tired = jobs.cannotWork(id);
      if (tired) {
        endShift(host, `${tired} ${capital(words.theBoss)} sends you off early: ${shift.done} of ${shift.total} done, ${naira(shift.earned)} earned.`, 'warning');
        return;
      }
      host.say(`🦺 ${shift.done} of ${shift.total} rounds done. Next round...`, 'info');
      setTimeout(() => {
        if (shift && !working) doTheWork(host);
      }, 1600);
    });
    if (!host.director.run(work)) {
      working = false;
      options.ended(false, host);
      if (shift) endShift(host, 'The shift could not start just now.', 'info');
    }
  };

  /** Taken on (if not already) and the shift begun, once the one in charge has been spoken to */
  const beginShift = (host: PlaceHost) => {
    if (working || shift) return;
    if (!jobs.isEmployed(id)) return;
    const notNow = options.cannotStart?.() ?? null;
    if (notNow) {
      host.say(notNow, 'info');
      return;
    }
    const tooTired = jobs.cannotWork(id);
    if (tooTired) {
      host.say(tooTired, 'warning');
      return;
    }
    if (host.director.interrupt(host.actor) === 'locked') return;
    if (piecesNow() <= 0) {
      doTheWork(host);
      return;
    }
    shift = { done: 0, total: piecesNow(), earned: 0 };
    Shifts.current = { employer: id, boss: words.boss, place: employer?.place ?? employer?.name ?? '', done: 0, total: piecesNow(), earned: 0 };
    Shifts.dress?.(employer?.trade ?? null);
    host.say(`🦺 On shift at ${employer?.name ?? 'work'}, in work clothes: ${piecesNow()} rounds of work back to back, ${naira(rate())} each. You stay till it is done, or tell ${words.theBoss} you are ending it.`, 'info');
    doTheWork(host);
  };

  const api: HandWork = {
    get working() { return working; },
    get setDown() { return setDown; },
    get paid() { return paid; },
    get stars() { return lastStars; },
    rate,
    terms,
    bossLabel: () => {
      const grade = jobs.grade(id);
      return jobs.isEmployed(id) && grade ? `🧑‍🏭 ${grade.title}: ${jobs.done(id)} ${words.done}` : `🧑‍🏭 Ask ${words.theBoss} for work`;
    },
    askBoss: (host) => {
      const name = employer?.name ?? 'here';
      const shiftWords = piecesNow() > 0 ? `A shift is ${piecesNow()} rounds of work back to back, in work clothes; you stay till it is done.` : '';
      if (!jobs.isEmployed(id)) {
        // No paper, no job: said plainly before any offer, with where the paper is got
        const paper = jobs.paperNeeded(id);
        if (paper) {
          host.ask({
            who: words.boss,
            role: words.role,
            text: `${name} only takes on people with ${paper}. Get it in Courses on your phone, then come back and the work is yours.`,
            choices: [{ label: 'All right', pick: () => undefined }],
          });
          return;
        }
        const take = (thenWork: boolean) => {
          const taken = jobs.apply(id);
          host.say(taken.ok ? `You are taken on at ${name} as a ${(jobs.grade(id)?.title ?? 'hand').toLowerCase()}. ${words.ready}` : taken.reason ?? '', taken.ok ? 'success' : 'warning');
          if (taken.ok && thenWork) setTimeout(() => beginShift(host), 900);
        };
        host.ask({
          who: words.boss,
          role: words.role,
          text: `${words.offer}: ${terms()}. Each ${words.piece} takes ${effort}% of your strength. ${shiftWords} Do you want the work?`,
          choices: [
            ...(piecesNow() > 0 ? [{ label: 'Take the job and start a shift now', note: `${piecesNow()} × ${naira(rate())}`, pick: () => take(true) }] : []),
            { label: 'Take the job', pick: () => take(false) },
            { label: 'Not today', pick: () => undefined },
          ],
        });
        return;
      }
      const grade = jobs.grade(id)!;
      const next = jobs.nextGrade(id);
      if (shift) {
        const s = shift;
        host.ask({
          who: words.boss,
          role: words.role,
          text: `You are on shift: ${s.done} of ${s.total} done, ${naira(s.earned)} so far. Finish it and you can go.`,
          choices: [
            { label: 'Carry on with the shift', pick: () => { if (shift && !working) doTheWork(host); } },
            { label: 'End the shift now', note: 'What is done is paid; nothing more', pick: () => endShift(host, `🦺 You end the shift early: ${s.done} of ${s.total} done, ${naira(s.earned)} earned.`, 'info') },
          ],
        });
        return;
      }
      host.ask({
        who: words.boss,
        role: words.role,
        text: `${grade.title}, ${jobs.done(id)} ${words.done}, ₦${grade.pay.toLocaleString()} a ${words.piece}. ${next ? `${next.from - jobs.done(id)} more and you are ${next.title.toLowerCase()} on ₦${next.pay.toLocaleString()}.` : 'You are at the top of my book.'} ${shiftWords}`,
        choices: [
          ...(piecesNow() > 0 ? [{ label: 'Start a shift', note: `${piecesNow()} × ${naira(rate())}`, pick: () => beginShift(host) }] : []),
          { label: 'Carry on', pick: () => undefined },
          {
            label: 'Leave the job',
            note: 'Start again from the bottom if you come back',
            pick: () => {
              jobs.resign(id);
              host.say(`You have left the job at ${name}.`, 'info');
            },
          },
        ],
      });
    },
    get onShift() { return shift !== null; },
    startShift: (host) => {
      if (working || shift) return;
      // Not taken on yet: the one in charge offers the job (and the shift) there and then
      if (!jobs.isEmployed(id)) {
        host.say(`${words.says}: "You want to work here? Ask me for work first."`, 'info');
        setTimeout(() => api.askBoss(host), 700);
        return;
      }
      beginShift(host);
    },
    start: (host) => {
      if (working) return;
      if (!jobs.isEmployed(id)) {
        host.say(`${words.says}: "You want to work here? Ask me for work first."`, 'info');
        setTimeout(() => api.askBoss(host), 700);
        return;
      }
      const notNow = options.cannotStart?.() ?? null;
      if (notNow) {
        host.say(notNow, 'info');
        return;
      }
      const tooTired = jobs.cannotWork(id);
      if (tooTired) {
        host.say(tooTired, 'warning');
        return;
      }
      if (host.director.interrupt(host.actor) === 'locked') return;
      doTheWork(host);
    },
  };
  return api;
}
