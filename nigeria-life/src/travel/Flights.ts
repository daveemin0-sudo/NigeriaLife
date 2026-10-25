import { BackendService } from '../backend/BackendService';
import { profileKey } from '../backend/Profile';

/**
 * Flying between the three cities, as one thing with one record: a booking.
 *
 * A booking is bought once, for one flight, from the city the player is in. It then goes
 * through the airport the way a passenger does (checked in at the desk, cleared at security,
 * boarded at the aircraft) and ends when the flight has landed. Nothing else moves a player
 * between cities by air: no button pays a fare and reports an arrival.
 *
 * The airline is NigeriaLife Air, made up for the game.
 */

export const AIRLINE = 'NigeriaLife Air';

export type FlightCity = 'lagos' | 'abuja' | 'port_harcourt';

export const AIRPORTS: Record<FlightCity, { code: string; name: string; city: string }> = {
  lagos: { code: 'LOS', name: 'Murtala Muhammed Airport', city: 'Lagos' },
  abuja: { code: 'ABV', name: 'Nnamdi Azikiwe Airport', city: 'Abuja' },
  port_harcourt: { code: 'PHC', name: 'Port Harcourt Airport', city: 'Port Harcourt' },
};

export interface FlightRoute {
  flight: string;
  from: FlightCity;
  to: FlightCity;
  fare: number;
  /** How long it is in the air, in minutes on the timetable */
  minutes: number;
  /** The gate it leaves from at its own airport */
  gate: 1 | 2;
}

/** The timetable. Every route has a flight each way, with its own number. */
export const ROUTES: FlightRoute[] = [
  { flight: 'NL 204', from: 'lagos', to: 'abuja', fare: 4_200_000, minutes: 55, gate: 1 },
  { flight: 'NL 310', from: 'lagos', to: 'port_harcourt', fare: 3_600_000, minutes: 60, gate: 2 },
  { flight: 'NL 205', from: 'abuja', to: 'lagos', fare: 4_200_000, minutes: 55, gate: 1 },
  { flight: 'NL 420', from: 'abuja', to: 'port_harcourt', fare: 3_900_000, minutes: 50, gate: 2 },
  { flight: 'NL 311', from: 'port_harcourt', to: 'lagos', fare: 3_600_000, minutes: 60, gate: 1 },
  { flight: 'NL 421', from: 'port_harcourt', to: 'abuja', fare: 3_900_000, minutes: 50, gate: 2 },
];

/** Where the passenger has got to. */
export type BookingState = 'booked' | 'checked-in' | 'cleared' | 'boarded' | 'arrived' | 'cancelled';

/** Where the flight itself has got to, as a departures board would put it. */
export type FlightStatus =
  | 'Scheduled'
  | 'Boarding'
  | 'Boarding closed'
  | 'Taxiing'
  | 'Taking off'
  | 'In flight'
  | 'Approaching'
  | 'Landing'
  | 'Arrived'
  | 'Cancelled';

export interface Booking {
  id: string;
  route: FlightRoute;
  state: BookingState;
  status: FlightStatus;
  /** The seat printed on the boarding pass */
  seat: string;
}

export interface FlightResult {
  ok: boolean;
  reason?: string;
}

/** What is given back if a ticket is handed in before check-in */
export const REFUND_SHARE = 0.8;

const STORE = 'nigeria_life_flight_v1';

export class FlightService {
  private static instance: FlightService | null = null;
  private readonly backend = BackendService.getInstance();
  private current: Booking | null = null;
  private listeners: Array<() => void> = [];
  /** Told the moment the passenger is through the aircraft door: the flight is theirs to run from here */
  public onBoarded: ((booking: Booking) => void) | null = null;

  public static get(): FlightService {
    if (!FlightService.instance) FlightService.instance = new FlightService();
    return FlightService.instance;
  }

  private constructor() {
    try {
      const saved = JSON.parse(localStorage.getItem(profileKey(STORE)) || 'null') as Booking | null;
      if (saved && saved.route && ROUTES.some((route) => route.flight === saved.route.flight)) this.current = saved;
    } catch {
      // A ticket that cannot be read back is not honoured; the money was recorded when it was bought
    }
  }

  private changed(): void {
    try {
      if (this.current) localStorage.setItem(profileKey(STORE), JSON.stringify(this.current));
      else localStorage.removeItem(profileKey(STORE));
    } catch {
      // Storage shut off: the booking still holds until the page is closed
    }
    for (const listener of this.listeners) listener();
  }

  public subscribe(listener: () => void): void {
    this.listeners.push(listener);
  }

  /** The ticket the player holds for a flight not yet flown, if any. */
  public get booking(): Booking | null {
    return this.current && this.current.state !== 'arrived' && this.current.state !== 'cancelled' ? this.current : null;
  }

  public routesFrom(city: string): FlightRoute[] {
    return ROUTES.filter((route) => route.from === city);
  }

  public routeAtGate(city: string, gate: number): FlightRoute | null {
    return ROUTES.find((route) => route.from === city && route.gate === gate) ?? null;
  }

  /** "NL 204 Lagos to Abuja". */
  public describe(route: FlightRoute): string {
    return `${route.flight} ${AIRPORTS[route.from].city} to ${AIRPORTS[route.to].city}`;
  }

  // --- Buying and handing back ------------------------------------------------------------

  /** Why a ticket for this flight cannot be bought right now, or null if it can. */
  public cannotBook(route: FlightRoute, city: string): string | null {
    if (route.from !== city) return `${route.flight} leaves from ${AIRPORTS[route.from].city}, and you are not there.`;
    const held = this.booking;
    if (held) return `You already hold a ticket: ${this.describe(held.route)}. Fly it, or hand it back at the desk first.`;
    const data = this.backend.getData();
    if (data.walletCash + data.bank.balance < route.fare) return `${this.describe(route)} is ₦${route.fare.toLocaleString()}. You do not have it.`;
    return null;
  }

  /** Buys a ticket. The fare is taken once, here, and nowhere else. */
  public book(route: FlightRoute, city: string): FlightResult {
    const refusal = this.cannotBook(route, city);
    if (refusal) return { ok: false, reason: refusal };
    if (!this.backend.pay(route.fare, `${AIRLINE} ${this.describe(route)}`, 'TRAVEL_COST')) {
      return { ok: false, reason: `${this.describe(route)} is ₦${route.fare.toLocaleString()}. You do not have it.` };
    }
    const row = 4 + Math.floor(Math.random() * 18);
    this.current = {
      id: `${route.flight.replace(' ', '')}-${Date.now().toString(36)}`,
      route,
      state: 'booked',
      status: 'Scheduled',
      seat: `${row}${'ACDF'[Math.floor(Math.random() * 4)]}`,
    };
    this.changed();
    return { ok: true };
  }

  /** Hands the ticket back before check-in, for most of the fare. */
  public cancel(): FlightResult {
    const held = this.booking;
    if (!held) return { ok: false, reason: 'You hold no ticket.' };
    if (held.state !== 'booked') return { ok: false, reason: 'You have checked in: the ticket can no longer be handed back.' };
    const refund = Math.round(held.route.fare * REFUND_SHARE);
    this.backend.processTransaction({ type: 'PURCHASE_REFUND', amount: refund, description: `${AIRLINE} refund, ${this.describe(held.route)}` });
    held.state = 'cancelled';
    held.status = 'Cancelled';
    this.changed();
    return { ok: true, reason: `₦${refund.toLocaleString()} given back.` };
  }

  // --- Through the airport ----------------------------------------------------------------

  private step(city: string, from: BookingState, to: BookingState, tooSoon: string): FlightResult {
    const held = this.booking;
    if (!held) return { ok: false, reason: 'You hold no ticket. Buy one at the ticket desk.' };
    if (held.route.from !== city) return { ok: false, reason: `Your ticket is for ${this.describe(held.route)}. That flight leaves from ${AIRPORTS[held.route.from].city}.` };
    if (held.state === to) return { ok: true };
    if (held.state !== from) return { ok: false, reason: tooSoon };
    held.state = to;
    this.changed();
    return { ok: true };
  }

  public checkIn(city: string): FlightResult {
    return this.step(city, 'booked', 'checked-in', 'You are already past the desk.');
  }

  public clearSecurity(city: string): FlightResult {
    return this.step(city, 'checked-in', 'cleared', this.booking?.state === 'booked' ? 'Check in at the desk first: security wants to see a boarding pass.' : 'You are already through.');
  }

  /** Through the aircraft door. From here the flight runs and cannot be undone. */
  public board(city: string): FlightResult {
    const before = this.booking?.state;
    const result = this.step(city, 'cleared', 'boarded', before === 'boarded' ? 'You are on board.' : 'You have not been through check-in and security.');
    if (result.ok && before === 'cleared' && this.current) {
      this.current.status = 'Boarding closed';
      this.changed();
      this.onBoarded?.(this.current);
    }
    return result;
  }

  /** The flight's own progress, set by whatever is flying it. */
  public setStatus(status: FlightStatus): void {
    if (!this.current || this.current.status === status) return;
    this.current.status = status;
    this.changed();
  }

  /** Landed and off the aircraft: the ticket is used. Returns the flight that was flown. */
  public arrive(): Booking | null {
    const held = this.current;
    if (!held || held.state !== 'boarded') return null;
    held.state = 'arrived';
    held.status = 'Arrived';
    this.changed();
    return held;
  }

  /** A passenger who has checked in is expected at the aircraft of this airport. */
  public expectedAt(city: string): boolean {
    const held = this.booking;
    return !!held && held.route.from === city && (held.state === 'checked-in' || held.state === 'cleared');
  }

  public status(): Record<string, unknown> {
    const held = this.current;
    return held ? { id: held.id, flight: held.route.flight, from: held.route.from, to: held.route.to, fare: held.route.fare, state: held.state, status: held.status, seat: held.seat, active: !!this.booking } : { active: false };
  }
}
