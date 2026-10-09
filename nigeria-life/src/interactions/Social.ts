import type { Actor } from './Actor';
import { InteractionDirector, type PerformResult } from './InteractionDirector';
import { Sequence, steps } from './Sequence';

const GREETINGS = ['How far!', 'Hello o!', 'Good day!', 'Ah, my person!', 'Wetin dey!'];

/**
 * One character waves at another, and the other waves back.
 * Whoever is seated waves from their seat; whoever is standing turns to face first.
 * Someone in the middle of a job (a waiter carrying a plate) finishes the job instead of replying.
 */
export function waveAt(from: Actor, to: Actor): PerformResult {
  const director = InteractionDirector.get();
  const result = director.perform({
    id: 'wave',
    actor: from,
    target: from.hold ? undefined : () => to.worldPosition(),
    animation: { arms: 'wave' },
    seconds: 1.9,
  });
  if (!result.ok) return result;

  if (to.busy) return result;
  const reply = new Sequence('wave back', [to]).add(steps.wait(0.55));
  if (!to.hold) reply.add(steps.face(to, () => from.worldPosition()));
  reply.add(
    steps.call('greet', () => to.say(`👋 ${GREETINGS[Math.floor(Math.random() * GREETINGS.length)]}`, 2.4)),
    steps.animate(to, { arms: 'wave' }, 1.7)
  );
  if (!to.hold) reply.add(steps.face(to, to.homeYaw));
  director.run(reply);
  return result;
}
