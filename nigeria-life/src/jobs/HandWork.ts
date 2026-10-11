import type * as THREE from 'three';
import type { Actor } from '../interactions/Actor';
import type { PlaceHost } from '../destinations/PlaceActions';
import { Sequence, steps } from '../interactions/Sequence';
import { Employment } from './Employment';

/**
 * Work that is done by hand at a place: someone in charge who takes people on, and a job of
 * carrying things one at a time from where they are stacked to where they are wanted. Crates
 * to a lorry at the port, blocks to a wall on a building site.
 *
 * The place says where things are lifted and set down and what happens to them; this does the
 * rest the same way everywhere: being taken on, the terms, the walk with each thing in the
 * hands, being paid once when the last is down and not at all if the worker walks off, and
 * moving up a grade as the work adds up. The record of it all is `Employment`.
 */

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

export interface HandWorkOptions {
  /** The employer's id in `Employment` */
  employerId: string;
  /** What the work is called while it is being done: "load the lorry" */
  name: string;
  words: HandWorkWords;
  /** How many things are carried for one piece of work */
  count: number;
  /** Where to stand to lift the i-th thing, which way to face, and what lifting it does */
  lift(index: number): { stand: THREE.Vector3; face: number | THREE.Vector3; take(actor: Actor): void };
  /** Where to stand to set it down, which way to face, and what setting it down does */
  set(index: number): { stand: THREE.Vector3; face: number | THREE.Vector3; put(actor: Actor): void };
  /** Why the work cannot start just now, in the words of whoever is in charge; null if it can */
  cannotStart?(): string | null;
  began?(): void;
  /** It is over: paid for, or given up part-way (things go back where they were) */
  ended(paid: boolean, host: PlaceHost): void;
  /** How long it may take before it is given up as abandoned */
  maxSeconds?: number;
}

export interface HandWork {
  /** Being done now */
  readonly working: boolean;
  /** How many things have been set down in the piece of work in hand */
  readonly setDown: number;
  /** How many pieces of work have been paid for here since the game was opened */
  readonly paid: number;
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
}

const capital = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

export function createHandWork(options: HandWorkOptions): HandWork {
  const jobs = Employment.get();
  const id = options.employerId;
  const employer = jobs.employer(id);
  const words = options.words;
  const effort = employer?.energy ?? 0;
  let working = false;
  let setDown = 0;
  let paid = 0;

  const rate = () => (jobs.grade(id) ?? employer?.grades[0])?.pay ?? 0;
  const terms = () => (employer?.grades ?? []).map((grade) => `₦${grade.pay.toLocaleString()} a ${words.piece}${grade.from ? ` once you have done ${grade.from}` : ' to start'}`).join(', ');

  const doTheWork = (host: PlaceHost) => {
    const actor = host.actor;
    working = true;
    setDown = 0;
    options.began?.();
    const work = new Sequence(options.name, [actor]);
    work.maxSeconds = options.maxSeconds ?? 150;
    for (let i = 0; i < options.count; i++) {
      const from = options.lift(i);
      const to = options.set(i);
      work.add(
        steps.walk(actor, from.stand, { speed: 3.6 }),
        steps.face(actor, from.face),
        steps.animate(actor, { arms: 'reach' }, 0.7, [{ at: 0.6, run: () => from.take(actor) }]),
        steps.walk(actor, to.stand, { speed: 3 }),
        steps.face(actor, to.face),
        steps.animate(actor, { arms: 'reach' }, 0.7, [{
          at: 0.6,
          run: () => {
            to.put(actor);
            setDown = i + 1;
          },
        }])
      );
    }
    // Paid when the last thing is down, and only then
    work.add(steps.call(`paid for the ${words.piece}`, () => {
      const result = jobs.complete(id);
      if (!result.ok) {
        host.say(result.reason ?? `${capital(words.theBoss)} will not pay for that.`, 'warning');
        return false;
      }
      paid += 1;
      host.say(result.promoted
        ? `${capital(words.theBoss)} pays you ₦${result.pay!.toLocaleString()} and makes you ${result.promoted.title.toLowerCase()}: ₦${result.promoted.pay.toLocaleString()} a ${words.piece} from now on.`
        : `${capital(words.theBoss)} pays you ₦${result.pay!.toLocaleString()} for the ${words.piece}. Energy -${effort}%.`, 'success');
    }));
    work.onEnd((reason) => {
      working = false;
      options.ended(reason === 'done', host);
    });
    if (!host.director.run(work)) {
      working = false;
      options.ended(false, host);
    }
  };

  return {
    get working() { return working; },
    get setDown() { return setDown; },
    get paid() { return paid; },
    rate,
    terms,
    bossLabel: () => {
      const grade = jobs.grade(id);
      return jobs.isEmployed(id) && grade ? `🧑‍🏭 ${grade.title}: ${jobs.done(id)} ${words.done}` : `🧑‍🏭 Ask ${words.theBoss} for work`;
    },
    askBoss: (host) => {
      const name = employer?.name ?? 'here';
      if (!jobs.isEmployed(id)) {
        host.ask({
          who: words.boss,
          role: words.role,
          text: `${words.offer}: ${terms()}. Each ${words.piece} takes ${effort}% of your strength. Do you want the work?`,
          choices: [
            {
              label: 'Take the job',
              pick: () => {
                const taken = jobs.apply(id);
                host.say(taken.ok ? `You are taken on at ${name} as a ${(jobs.grade(id)?.title ?? 'hand').toLowerCase()}. ${words.ready}` : taken.reason ?? '', taken.ok ? 'success' : 'warning');
              },
            },
            { label: 'Not today', pick: () => undefined },
          ],
        });
        return;
      }
      const grade = jobs.grade(id)!;
      const next = jobs.nextGrade(id);
      host.ask({
        who: words.boss,
        role: words.role,
        text: `${grade.title}, ${jobs.done(id)} ${words.done}, ₦${grade.pay.toLocaleString()} a ${words.piece}. ${next ? `${next.from - jobs.done(id)} more and you are ${next.title.toLowerCase()} on ₦${next.pay.toLocaleString()}.` : 'You are at the top of my book.'}`,
        choices: [
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
    start: (host) => {
      if (working) return;
      if (!jobs.isEmployed(id)) {
        host.say(`${words.says}: "I do not know you. Ask me for work first."`, 'info');
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
}
