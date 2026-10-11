import { BackendService } from '../backend/BackendService';
import { profileKey } from '../backend/Profile';
import { OPERATOR, MOTOR_PARKS, COACH_ROUTES, type CoachRoute } from './CoachTimetable';

/**
 * Going between the three cities by road, as one thing with one record: a coach ticket.
 *
 * A ticket is bought once, for one coach, from the city the player is in. The coach is
 * boarded at that city's motor park and nowhere else, and the ticket is used when the coach
 * has pulled in at the other end. Nothing else moves a player between cities by road: no
 * button pays a fare and reports an arrival.
 *
 * The operator is SwiftRoute, made up for the game.
 */

export { OPERATOR, MOTOR_PARKS, COACH_ROUTES, type CoachCity, type CoachRoute } from './CoachTimetable';

export type CoachTicketState = 'booked' | 'boarded' | 'arrived' | 'cancelled';

export interface CoachTicket {
  id: string;
  route: CoachRoute;
  state: CoachTicketState;
  seat: number;
}

export interface CoachResult {
  ok: boolean;
  reason?: string;
}

/** What is given back if a ticket is handed in before boarding */
export const COACH_REFUND_SHARE = 0.8;

const STORE = 'nigeria_life_coach_v1';

export class CoachService {
  private static instance: CoachService | null = null;
  private readonly backend = BackendService.getInstance();
  private current: CoachTicket | null = null;
  private listeners: Array<() => void> = [];
  /** Told the moment the passenger is up the steps of the coach: the journey is theirs to run from here */
  public onBoarded: ((ticket: CoachTicket) => void) | null = null;

  public static get(): CoachService {
    if (!CoachService.instance) CoachService.instance = new CoachService();
    return CoachService.instance;
  }

  private constructor() {
    try {
      const saved = JSON.parse(localStorage.getItem(profileKey(STORE)) || 'null') as CoachTicket | null;
      if (saved && saved.route && COACH_ROUTES.some((route) => route.coach === saved.route.coach)) this.current = saved;
    } catch {
      // A ticket that cannot be read back is not honoured; the money was recorded when it was bought
    }
  }

  private changed(): void {
    try {
      if (this.current) localStorage.setItem(profileKey(STORE), JSON.stringify(this.current));
      else localStorage.removeItem(profileKey(STORE));
    } catch {
      // Storage shut off: the ticket still holds until the page is closed
    }
    for (const listener of this.listeners) listener();
  }

  public subscribe(listener: () => void): void {
    this.listeners.push(listener);
  }

  /** The ticket the player holds for a coach not yet ridden, if any. */
  public get ticket(): CoachTicket | null {
    return this.current && this.current.state !== 'arrived' && this.current.state !== 'cancelled' ? this.current : null;
  }

  public routesFrom(city: string): CoachRoute[] {
    return COACH_ROUTES.filter((route) => route.from === city);
  }

  /** "SR 12 Lagos to Abuja". */
  public describe(route: CoachRoute): string {
    return `${route.coach} ${MOTOR_PARKS[route.from].city} to ${MOTOR_PARKS[route.to].city}`;
  }

  /** Why a ticket for this coach cannot be bought right now, or null if it can. */
  public cannotBuy(route: CoachRoute, city: string): string | null {
    if (route.from !== city) return `${route.coach} leaves from ${MOTOR_PARKS[route.from].city}, and you are not there.`;
    const held = this.ticket;
    if (held) return `You already hold a ticket: ${this.describe(held.route)}. Ride it, or hand it back at the ticket window first.`;
    const data = this.backend.getData();
    if (data.walletCash + data.bank.balance < route.fare) return `${this.describe(route)} is ₦${route.fare.toLocaleString()}. You do not have it.`;
    return null;
  }

  /** Buys a ticket. The fare is taken once, here, and nowhere else. */
  public buy(route: CoachRoute, city: string): CoachResult {
    const refusal = this.cannotBuy(route, city);
    if (refusal) return { ok: false, reason: refusal };
    if (!this.backend.pay(route.fare, `${OPERATOR} coach ${this.describe(route)}`, 'TRAVEL_COST')) {
      return { ok: false, reason: `${this.describe(route)} is ₦${route.fare.toLocaleString()}. You do not have it.` };
    }
    this.current = {
      id: `${route.coach.replace(' ', '')}-${Date.now().toString(36)}`,
      route,
      state: 'booked',
      seat: 1 + Math.floor(Math.random() * 44),
    };
    this.changed();
    return { ok: true };
  }

  /** Hands the ticket back before boarding, for most of the fare. */
  public handBack(): CoachResult {
    const held = this.ticket;
    if (!held) return { ok: false, reason: 'You hold no ticket.' };
    if (held.state !== 'booked') return { ok: false, reason: 'You are on the coach: the ticket can no longer be handed back.' };
    const refund = Math.round(held.route.fare * COACH_REFUND_SHARE);
    this.backend.processTransaction({ type: 'PURCHASE_REFUND', amount: refund, description: `${OPERATOR} refund, ${this.describe(held.route)}` });
    held.state = 'cancelled';
    this.changed();
    return { ok: true, reason: `₦${refund.toLocaleString()} given back.` };
  }

  /** Up the steps of the coach, at the park it leaves from. From here the journey runs and cannot be undone. */
  public board(city: string): CoachResult {
    const held = this.ticket;
    if (!held) return { ok: false, reason: 'You hold no ticket. Buy one at the ticket window.' };
    if (held.route.from !== city) return { ok: false, reason: `Your ticket is for ${this.describe(held.route)}. That coach leaves from ${MOTOR_PARKS[held.route.from].name}.` };
    if (held.state === 'boarded') return { ok: true };
    held.state = 'boarded';
    this.changed();
    this.onBoarded?.(held);
    return { ok: true };
  }

  /** Pulled in and off the coach: the ticket is used. Returns the journey that was made. */
  public arrive(): CoachTicket | null {
    const held = this.current;
    if (!held || held.state !== 'boarded') return null;
    held.state = 'arrived';
    this.changed();
    return held;
  }

  public status(): Record<string, unknown> {
    const held = this.current;
    return held ? { id: held.id, coach: held.route.coach, from: held.route.from, to: held.route.to, fare: held.route.fare, state: held.state, seat: held.seat, active: !!this.ticket } : { active: false };
  }
}
