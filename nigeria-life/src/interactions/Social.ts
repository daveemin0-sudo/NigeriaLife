import * as THREE from 'three';
import type { Actor } from './Actor';
import { InteractionDirector, type PerformResult } from './InteractionDirector';
import type { NavGrid } from './NavGrid';
import { Sequence, steps } from './Sequence';
import { BackendService } from '../backend/BackendService';
import { showGameToast } from '../ui/GameToast';

export type SocialKind = 'wave' | 'greet' | 'handshake' | 'chat';

/** How well someone knows the player. It decides how they answer. */
export type Standing = 'stranger' | 'acquaintance' | 'friend';

export interface SocialOptions {
  /** Floor map of the room, so walking up to someone goes round the furniture */
  nav?: NavGrid | null;
  /** The usual place to stand to speak to this person (the customer's side of a counter) */
  standAt?: THREE.Vector3;
}

const ACQUAINTANCE_AT = 8;
const FRIEND_AT = 30;
/** What each kind of contact adds, and how soon it counts again with the same person (game seconds) */
const WARMTH: Record<SocialKind, number> = { wave: 1, greet: 2, handshake: 4, chat: 5 };
const COUNTS_AGAIN_AFTER = 20;

const LINES = {
  wave: {
    stranger: ['Good day.', 'Hello.', 'Afternoon.'],
    acquaintance: ['How far!', 'Hello o!', 'Ah, na you!', 'Wetin dey!'],
    friend: ['My person!', 'Ah! My guy!', 'See who I dey see!'],
  },
  greet: {
    stranger: ['Good day to you.', 'You are welcome.', 'Good afternoon.'],
    acquaintance: ['How body? Hope work dey go well.', 'Ah, good to see you again.', 'How family?'],
    friend: ['My guy! Long time o!', 'Na you I dey find since!', 'You do well to greet. How far?'],
  },
  handshake: {
    stranger: ['Nice to meet you.', 'Pleased to meet you.'],
    acquaintance: ['Good to see you again.', 'We meet again. I dey happy.'],
    friend: ['My person! How family?', 'Correct! We dey together.'],
  },
  chatOpen: ['How far? How today dey go?', 'Abeg, wetin dey happen for this area?', 'How market today?'],
  chatReply: {
    stranger: ['I dey o. We dey manage.', 'Nothing much. Lagos na Lagos.', 'E dey go. No wahala.'],
    acquaintance: ['Fuel don cost again, you hear?', 'Rain go fall this evening, carry umbrella.', 'Traffic for Third Mainland no be here.'],
    friend: ['Come, make I tell you gist…', 'You never hear? Big owambe dey this Saturday!', 'I keep something for you, no worry.'],
  },
  chatFollow: ['Na so! Thank you o.', 'Ehn ehn? Tell me more.', 'True talk.'],
  chatClose: {
    stranger: ['Okay. Go well.', 'Alright. Safe journey.'],
    acquaintance: ['We go talk again. Greet your people.', 'No dulling. See you around.'],
    friend: ['Anytime, my person. Call me!', 'We go see for weekend. No forget!'],
  },
};

const pick = (lines: string[]) => lines[Math.floor(Math.random() * lines.length)];
const lastCounted = new Map<string, number>();

function familiarityKey(actor: Actor): string {
  return actor.id;
}

export function standingWith(actor: Actor): Standing {
  const level = BackendService.getInstance().familiarity(familiarityKey(actor));
  return level >= FRIEND_AT ? 'friend' : level >= ACQUAINTANCE_AT ? 'acquaintance' : 'stranger';
}

/** Counts a meeting toward how well this person knows the player. Says so when they become closer. */
function warmTo(person: Actor, kind: SocialKind): void {
  const director = InteractionDirector.get();
  const key = `${person.id}:${kind}`;
  const last = lastCounted.get(key);
  if (last !== undefined && director.time - last < COUNTS_AGAIN_AFTER) return;
  lastCounted.set(key, director.time);

  const before = standingWith(person);
  BackendService.getInstance().addFamiliarity(familiarityKey(person), WARMTH[kind]);
  const after = standingWith(person);
  if (after !== before) {
    const short = person.name.split('(')[0].trim();
    showGameToast(
      after === 'friend' ? `${short} now counts you as a friend.` : `${short} knows your face now.`,
      'success',
      3200
    );
  }
}

/** Where to stand to be `distance` away from someone, on the side the walker is coming from. */
export function spotNear(person: Actor, walker: Actor, distance: number): THREE.Vector3 {
  const there = person.worldPosition();
  const here = walker.worldPosition();
  const dx = here.x - there.x;
  const dz = here.z - there.z;
  const length = Math.hypot(dx, dz) || 1;
  return new THREE.Vector3(there.x + (dx / length) * distance, 0, there.z + (dz / length) * distance);
}

/** Steps that bring `from` over to `to`, unless they are seated or already close enough. */
function approach(from: Actor, to: Actor, distance: number, options: SocialOptions) {
  if (from.hold) return [];
  const here = from.worldPosition();
  const there = to.worldPosition();
  if (Math.hypot(here.x - there.x, here.z - there.z) <= distance + 0.6) return [];
  const spot = options.standAt ?? spotNear(to, from, distance);
  return [steps.walk(from, spot, { nav: options.nav, speed: options.nav ? 5 : undefined, ifStuck: 'snap' })];
}

const busyReason = (person: Actor) => `${person.name.split('(')[0].trim()} is busy right now.`;

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

  if (to.engaged) return result;
  const standing = standingWith(to);
  const reply = new Sequence('wave back', [to]).asCasual().add(steps.wait(0.55));
  if (!to.hold) reply.add(steps.face(to, () => from.worldPosition()));
  reply.add(
    steps.call('greet', () => { to.say(`👋 ${pick(LINES.wave[standing])}`, 2.4); warmTo(to, 'wave'); }),
    steps.animate(to, { arms: 'wave' }, 1.7)
  );
  if (!to.hold) reply.add(steps.face(to, to.homeYaw));
  director.run(reply);
  return result;
}

/**
 * A spoken greeting with a small bow. A stranger answers formally; someone who knows the
 * player answers warmly, and a friend waves.
 */
export function greet(from: Actor, to: Actor): PerformResult {
  const director = InteractionDirector.get();
  const result = director.perform({
    id: 'greet',
    actor: from,
    target: from.hold ? undefined : () => to.worldPosition(),
    animation: { arms: 'greet' },
    seconds: 1.5,
    effectAt: 0.25,
    effect: () => from.say('Good day o!', 2),
  });
  if (!result.ok) return result;

  if (to.engaged) return result;
  const standing = standingWith(to);
  const reply = new Sequence('greet back', [to]).asCasual().add(steps.wait(0.8));
  if (!to.hold) reply.add(steps.face(to, () => from.worldPosition()));
  reply.add(
    steps.call('answer', () => { to.say(pick(LINES.greet[standing]), 2.6); warmTo(to, 'greet'); }),
    steps.animate(to, { arms: standing === 'friend' ? 'wave' : 'greet' }, 1.5)
  );
  if (!to.hold) reply.add(steps.face(to, to.homeYaw));
  director.run(reply);
  return result;
}

/** Why these two cannot shake hands right now, or null if they can. */
export function cannotShakeHands(from: Actor, to: Actor, options: SocialOptions = {}): string | null {
  const short = to.name.split('(')[0].trim();
  if (to.engaged) return busyReason(to);
  if (to.hold) return `${short} is sitting down. Greet them instead.`;
  if (from.hold) return 'Stand up first.';
  if (options.nav) {
    const spot = spotNear(to, from, 0.85);
    if (!options.nav.isFree(spot.x, spot.z)) return `There is a counter between you and ${short}. Greet them instead.`;
  }
  return null;
}

/**
 * The player walks up, both turn to each other, and they shake hands.
 * Both are part of it, so neither wanders off half-way; either can still be called away.
 */
export function shakeHands(from: Actor, to: Actor, options: SocialOptions = {}): PerformResult {
  const director = InteractionDirector.get();
  const blocked = cannotShakeHands(from, to, options);
  if (blocked) return { ok: false, reason: blocked };
  if (director.interrupt(from) === 'locked') return { ok: false, reason: 'busy' };
  // One handshake at a time with any one person
  const claim = `handshake:${to.id}`;
  if (!director.reserve(claim, from)) return { ok: false, reason: busyReason(to) };

  const standing = standingWith(to);
  const sequence = new Sequence('handshake', [from, to]).add(
    steps.walk(from, () => spotNear(to, from, 0.85), { nav: options.nav, speed: options.nav ? 5 : undefined, ifStuck: 'fail' }),
    steps.face(to, () => from.worldPosition()),
    steps.face(from, () => to.worldPosition()),
    steps.setPose(to, { arms: 'shake' }),
    steps.animate(from, { arms: 'shake' }, 1.7, [{
      at: 0.45,
      run: () => { to.say(pick(LINES.handshake[standing]), 2.4); warmTo(to, 'handshake'); },
    }]),
    steps.setPose(to, { arms: 'rest' }),
    steps.wait(0.3),
    steps.face(to, to.homeYaw)
  );
  sequence.onEnd(() => director.release(claim, from));
  if (!director.run(sequence)) {
    director.release(claim, from);
    return { ok: false, reason: 'busy' };
  }
  return { ok: true, sequence };
}

/**
 * A short conversation: the player walks over, they face each other and trade a few lines.
 * What the other person has to say depends on how well they know the player.
 */
export function chatWith(from: Actor, to: Actor, options: SocialOptions = {}): PerformResult {
  const director = InteractionDirector.get();
  if (to.engaged) return { ok: false, reason: busyReason(to) };
  // Someone seated talks from their seat; someone standing drops what they were doing
  if (!from.hold && director.interrupt(from) === 'locked') return { ok: false, reason: 'busy' };

  const standing = standingWith(to);
  const faceOther = (who: Actor, other: Actor) => (who.hold ? [] : [steps.face(who, () => other.worldPosition())]);
  const sequence = new Sequence('chat', [from, to]).add(
    ...approach(from, to, 1.4, options),
    ...faceOther(from, to),
    ...faceOther(to, from),
    steps.animate(from, { arms: 'talk' }, 1.6, [{ at: 0.05, run: () => from.say(pick(LINES.chatOpen), 1.8) }]),
    steps.animate(to, { arms: 'talk' }, 1.9, [{ at: 0.05, run: () => to.say(pick(LINES.chatReply[standing]), 2.1) }]),
    steps.animate(from, { arms: 'talk' }, 1.4, [{ at: 0.05, run: () => from.say(pick(LINES.chatFollow), 1.6) }]),
    steps.animate(to, { arms: 'talk' }, 1.7, [{
      at: 0.05,
      run: () => { to.say(pick(LINES.chatClose[standing]), 2.2); warmTo(to, 'chat'); },
    }]),
    ...(to.hold ? [] : [steps.face(to, to.homeYaw)])
  );
  if (!director.run(sequence)) return { ok: false, reason: 'busy' };
  return { ok: true, sequence };
}

/** A gesture made toward someone the game cannot direct (another player online). */
export function gestureToward(kind: 'wave' | 'greet', from: Actor, where: THREE.Vector3): PerformResult {
  return InteractionDirector.get().perform({
    id: kind,
    actor: from,
    target: from.hold ? undefined : where,
    animation: { arms: kind },
    seconds: kind === 'wave' ? 1.9 : 1.5,
  });
}
