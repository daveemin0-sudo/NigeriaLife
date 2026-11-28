import * as THREE from 'three';
import type { PlaceHost } from '../destinations/PlaceActions';
import { InteractionDirector } from './InteractionDirector';

/**
 * People who speak first. Step up to a desk, a counter or a person on duty and they greet you
 * and ask what you want, in a card you read and answer: "Welcome, sir. How may I help you?"
 * Walk away and come back, and they greet you again.
 *
 * The game fills in the hooks: where the player is, a way to put a card in front of them, and
 * whether to call them sir or ma.
 */
export const Talk = {
  playerAt: (): THREE.Vector3 | null => null,
  withHost: (_run: (host: PlaceHost) => void): void => undefined,
  woman: (): boolean => false,
  hour: (): number => 12,
  /** A cab from where the player stands to a point in this city, paid when it comes (set by the game) */
  rideTo: null as ((point: THREE.Vector3, name: string, fare: number) => void) | null,
  /** The card on screen now (the thing the player has walked up to use), by its id (set by the game) */
  cardOn: (): string | null => null,
  /** When the player last used something (performance.now()): nobody talks over it */
  actedAt: 0,
};

export const sir = (): string => (Talk.woman() ? 'ma' : 'sir');
export const Sir = (): string => (Talk.woman() ? 'Ma' : 'Sir');
/** What a Lagos hustler calls you */
export const oga = (): string => (Talk.woman() ? 'Madam' : 'Oga');
export const ogaMi = (): string => (Talk.woman() ? 'Mummy' : 'Oga mi');
export const goodDay = (): string => {
  const h = Talk.hour();
  return h < 12 ? 'Good morning' : h < 16 ? 'Good afternoon' : 'Good evening';
};
export const naira = (n: number): string => `₦${n.toLocaleString('en-NG')}`;

/** A place where someone greets the player who stops there: a point on the floor and how near counts. */
export interface TalkSpot {
  id: string;
  x: number;
  z: number;
  radius: number;
  open: (host: PlaceHost) => void;
  /** Only when this holds (a desk that is shut, a flight not yet called) */
  when?: () => boolean;
}

/** Seconds the player must stand at a spot before being greeted, so walking past is not stopped */
const DWELL = 0.5;
/** And how much further they must go before they are greeted there again */
const REARM = 1.6;

export class Greeters {
  private readonly spots: TalkSpot[];
  private readonly origin: THREE.Vector3;
  private readonly armed = new Map<string, boolean>();
  private readonly dwell = new Map<string, number>();
  private readonly last = new THREE.Vector3();
  private seen = false;

  /** `origin`: where the spots' coordinates are measured from (a hall's origin), or the world's */
  constructor(spots: TalkSpot[], origin: THREE.Vector3 = new THREE.Vector3()) {
    this.spots = spots;
    this.origin = origin;
  }

  public add(spot: TalkSpot): void {
    this.spots.push(spot);
  }

  /** Opens a spot's conversation now (the person was tapped), and does not greet again until the player has gone */
  public open(id: string): boolean {
    const spot = this.spots.find((s) => s.id === id);
    if (!spot) return false;
    this.armed.set(id, false);
    Talk.withHost((host) => spot.open(host));
    return true;
  }

  /** Not to greet at this spot until the player has gone and come back (they have just been served there) */
  public quiet(id: string): void {
    this.armed.set(id, false);
  }

  public tick(delta: number): void {
    const at = Talk.playerAt();
    if (!at) return;
    const director = InteractionDirector.get();
    const player = director.player;
    // Not while a card is open, or while the player is walking somewhere, sitting, eating, praying
    const busy = !!document.getElementById('game-dialogue-overlay') || !!player?.busy || !!player?.hold || !!player?.scripted || performance.now() - Talk.actedAt < 2500;
    // Come up to use something else (its card is showing): the person beside it waits to be spoken to
    // (a person's own card, or a counter's, is no reason to wait: a gate, a seat or a machine is)
    const shown = Talk.cardOn();
    const card = shown && !shown.startsWith('interior_npc_') && !(shown.startsWith('place_') && !shown.includes('_sit_')) ? shown : null;
    // Greeted when they stop there, not when they walk past
    const speed = this.seen && delta > 0 ? Math.hypot(at.x - this.last.x, at.z - this.last.z) / delta : 0;
    this.last.copy(at);
    this.seen = true;
    const passing = speed > 0.9;
    for (const spot of this.spots) {
      const d = Math.hypot(at.x - (this.origin.x + spot.x), at.z - (this.origin.z + spot.z));
      if (d > spot.radius + REARM) {
        this.armed.set(spot.id, true);
        this.dwell.set(spot.id, 0);
        continue;
      }
      // Already talking or being served here: not greeted again until they have gone away and come back
      if (d <= spot.radius && busy) this.armed.set(spot.id, false);
      if (d > spot.radius || busy || passing || (card && card !== spot.id) || this.armed.get(spot.id) === false || (spot.when && !spot.when())) {
        this.dwell.set(spot.id, 0);
        continue;
      }
      const t = (this.dwell.get(spot.id) ?? 0) + delta;
      this.dwell.set(spot.id, t);
      if (t >= DWELL) {
        this.armed.set(spot.id, false);
        this.dwell.set(spot.id, 0);
        Talk.withHost((host) => spot.open(host));
        return;
      }
    }
  }
}

/** A greeting in front of what someone says, unless they already open with one */
export function greeted(text: string): string {
  const said = text.trim().replace(/^["“]/, '');
  // Already a greeting: say good morning first only where they do not say it themselves
  if (/^(good (morning|afternoon|evening|day)|hello|hi\b|e (kaaro|kaasan|kaale)|sannu)/i.test(said)) return text;
  if (/\bwelcome\b/i.test(said.slice(0, 60)) || /^(ehen|ah\b|oya|customer|oga|madam|aunty|my (dear|friend|guy))/i.test(said)) return `${goodDay()}, ${sir()}! ${text}`;
  return `${goodDay()}, ${sir()}! You are welcome. ${text}`;
}

/**
 * A person asking for a tip, the Lagos way. "Give" pays them from the cash in hand; saying no
 * nicely costs nothing and they still bless you.
 */
export function tipChoices(host: PlaceHost, who: string, amounts: number[], thanks: string, noWahala: string, labels: string[] = []): Array<{ label: string; note?: string; pick: () => void }> {
  return [
    ...amounts.map((amount, i) => ({
      label: labels[i] ?? `Give ${naira(amount)}`,
      note: 'Cash · Social +3',
      pick: () => {
        if (!host.backend.spendCash(amount, `Tip for ${who}`, 'TRANSFER_OUT')) {
          host.say(`You check your pocket: not up to ${naira(amount)} in cash. "${noWahala}"`, 'info');
          return;
        }
        host.backend.modifyNeed('social', 3);
        host.say(`${who}: "${thanks}"`, 'success');
      },
    })),
    {
      label: labels[amounts.length] ?? 'I no get change today',
      note: 'Free',
      pick: () => host.say(`${who}: "${noWahala}"`, 'info'),
    },
  ];
}
