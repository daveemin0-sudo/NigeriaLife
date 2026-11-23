import { BackendService } from '../../backend/BackendService';
import { DestinationRegistry } from '../../destinations/DestinationRegistry';
import type { DestinationDefinition, TransportOption } from '../../destinations/DestinationTypes';
import { showGameToast } from '../../ui/GameToast';
import { SoundEngine } from '../../audio/SoundEngine';

export type RideStage = 'idle' | 'driver_coming' | 'driver_here' | 'on_trip';

export interface ActiveRide {
  destination: DestinationDefinition;
  vehicle: TransportOption;
  fare: number;
  stage: RideStage;
  /** Seconds until the driver reaches the player */
  eta: number;
  /** What that was when the driver set off */
  etaAtStart: number;
  paid: boolean;
  /** The player is on their way to the door */
  boarding: boolean;
  /** How long the driver has waited at the kerb */
  waited: number;
  /** How long the walk to the door has taken, and the most it should */
  boardingFor: number;
  boardingLimit: number;
  /** A vehicle was sent up the road, and its own progress is the time left */
  sent: boolean;
  /** A test run: no vehicle comes up the road, the trip starts when the time is up */
  instant: boolean;
  /** Instead of the usual set-down at the place */
  arrived?: () => void;
  /** Instead of the usual trip */
  start?: (done: () => void) => void;
}

export interface RideResult {
  ok: boolean;
  reason?: string;
}

/** What the game does for a ride. */
export interface RideWorld {
  where(): 'street' | 'inside' | 'driving' | 'transit';
  cityId(): string;
  /** Plays the journey and calls `arrived` when it ends */
  startJourney(destination: DestinationDefinition, vehicle: TransportOption, arrived: () => void): void;
  /** Puts the player down outside the destination */
  arriveAt(destination: DestinationDefinition): void;
  /** Sends the vehicle up the road to the kerb by the player: seconds until it stops, or null if no road is near */
  sendDriver?(vehicle: TransportOption): number | null;
  /** Seconds until the vehicle that was sent stops at the kerb */
  driverEta?(): number;
  /** The player walks to the door and it opens, then `inside`; returns the most that should take, in seconds */
  walkToDriver?(inside: () => void): number;
  /** The vehicle goes from the street (the player got in, or the ride is off) */
  driverLeaves?(): void;
}

const PICKUP_SECONDS = 6;
/** How long a driver waits at the kerb before going, at no charge */
const WAITS_SECONDS = 90;
/** The ways of getting about that can be booked from a phone */
const BOOKABLE = new Set(['keke', 'taxi', 'bike']);

/**
 * Booking a ride from the phone. A ride is one thing with one state: a driver is on the way,
 * or the trip is under way, or there is no ride. The fare is taken once, when the driver
 * arrives and the player gets in; cancelling before that costs nothing.
 */
export class RideService {
  /** What the law does to fares (cheaper transport), set by the game */
  public static fareFactor: () => number = () => 1;
  /** The player's own car, if they have one: their driver takes them in it, for nothing (set by the game) */
  public static ownCar: () => { name: string; body: string; paint?: number } | null = () => null;
  /** The name of the hired home driver, if the player has hired one (set by HomeStaff) */
  public static driverName: () => string | null = () => null;

  /** Your own car as a way of getting there: free, your driver at the wheel */
  public static ownOption(destination: DestinationDefinition): TransportOption | null {
    const car = RideService.ownCar();
    if (!car) return null;
    const taxi = destination.transportAvailability.find((option) => option.mode === 'taxi');
    const driver = RideService.driverName();
    return {
      mode: 'car',
      label: `Your ${car.name}`,
      icon: '🚘',
      fare: 0,
      travelTimeSec: taxi?.travelTimeSec ?? 60,
      description: driver
        ? `Your own car. ${driver}, your home driver, brings it round and drives you. Free.`
        : 'Your own car. Your driver brings it round and drives you. Free.',
    };
  }
  public ride: ActiveRide | null = null;
  public onChange: (() => void) | null = null;
  private readonly backend = BackendService.getInstance();
  private world: RideWorld | null = null;

  public connect(world: RideWorld): void {
    this.world = world;
  }

  /** Places in this city a driver will take the player to. */
  public destinations(): DestinationDefinition[] {
    const city = this.world?.cityId() ?? 'lagos';
    return DestinationRegistry.getInstance().getAll().filter((dest) => dest.city === city);
  }

  public vehiclesFor(destination: DestinationDefinition): TransportOption[] {
    const own = RideService.ownOption(destination);
    return [...(own ? [own] : []), ...destination.transportAvailability.filter((option) => BOOKABLE.has(option.mode))];
  }

  public funds(): number {
    const data = this.backend.getData();
    return data.walletCash + data.bank.balance;
  }

  /** Why a ride cannot be booked right now, or null if it can. */
  public cannotBook(vehicle?: TransportOption): string | null {
    if (!this.world) return 'Rides are not available.';
    if (this.ride) return 'You already have a ride booked.';
    const where = this.world.where();
    if (where === 'inside') return 'Step outside first: the driver picks you up on the street.';
    if (where === 'driving') return 'You are driving. Park and get out first.';
    if (where === 'transit') return 'You are already on a journey.';
    if (vehicle && this.funds() < vehicle.fare) {
      return `The fare is ₦${vehicle.fare.toLocaleString()} and you have ₦${this.funds().toLocaleString()} in all.`;
    }
    return null;
  }

  /** A ride stays in this city. Another city is a flight or a coach. */
  private otherCity(destination: DestinationDefinition): string | null {
    const here = this.world?.cityId();
    if (!here || destination.city === here) return null;
    const names: Record<string, string> = { lagos: 'Lagos', abuja: 'Abuja', port_harcourt: 'Port Harcourt' };
    return `That is in ${names[destination.city] ?? destination.city}. You go there by air or by coach.`;
  }

  public book(destinationId: string, mode: string): RideResult {
    const destination = DestinationRegistry.getInstance().getById(destinationId);
    const vehicle = !destination ? undefined : mode === 'car' ? RideService.ownOption(destination) ?? undefined : destination.transportAvailability.find((option) => option.mode === mode);
    if (!destination || !vehicle || (vehicle.mode !== 'car' && !BOOKABLE.has(vehicle.mode))) return { ok: false, reason: 'That ride is not available.' };
    const elsewhere = this.otherCity(destination);
    if (elsewhere) return { ok: false, reason: elsewhere };
    const blocked = this.cannotBook(vehicle);
    if (blocked) return { ok: false, reason: blocked };

    this.begin(destination, vehicle, Math.round(vehicle.fare * RideService.fareFactor()));
    return { ok: true };
  }

  /** A driver is on the way: up the road to the kerb where there is one */
  private begin(destination: DestinationDefinition, vehicle: TransportOption, fare: number, arrived?: () => void, start?: (done: () => void) => void): ActiveRide {
    const instant = !!(window as unknown as { __nlInstantPickup?: boolean }).__nlInstantPickup;
    const ride: ActiveRide = { destination, vehicle, fare, stage: 'driver_coming', eta: PICKUP_SECONDS, etaAtStart: PICKUP_SECONDS, paid: false, boarding: false, waited: 0, boardingFor: 0, boardingLimit: 0, sent: false, instant, arrived, start };
    this.ride = ride;
    if (!instant && this.world?.where() === 'street') {
      const seconds = this.world.sendDriver?.(vehicle) ?? null;
      if (seconds !== null) {
        ride.eta = ride.etaAtStart = seconds;
        ride.sent = true;
      }
    }
    this.changed();
    return ride;
  }

  /**
   * A ride from the map or to a station, at this fare: it comes to the kerb and is paid on getting in, as any other.
   * Called from indoors it starts straight away. False (and the player is told why) if it cannot be had.
   */
  public journey(destination: DestinationDefinition, vehicle: TransportOption, arrived: () => void, start?: (done: () => void) => void): boolean {
    if (!this.world) return false;
    const elsewhere = this.otherCity(destination);
    const where = this.world.where();
    const blocked = elsewhere
      ?? (this.ride ? 'You already have a ride booked.' : null)
      ?? (where === 'driving' ? 'You are driving. Park and get out first.' : null)
      ?? (where === 'transit' ? 'You are already on a journey.' : null)
      ?? (this.funds() < vehicle.fare ? `The fare is ₦${vehicle.fare.toLocaleString()} and you have ₦${this.funds().toLocaleString()} in all.` : null);
    if (blocked) {
      showGameToast(blocked, 'warning', 3600);
      return false;
    }
    const ride = this.begin(destination, vehicle, vehicle.fare, arrived, start);
    if (where === 'inside' || ride.instant) this.climbIn(ride);
    return true;
  }

  /** The player goes to the vehicle at the kerb and gets in; the fare is paid as they do */
  public getIn(): RideResult {
    const ride = this.ride;
    if (!ride || ride.stage !== 'driver_here') return { ok: false, reason: 'Your driver is not here yet.' };
    if (ride.boarding) return { ok: true };
    if (ride.fare > this.funds()) return { ok: false, reason: `The fare is ₦${ride.fare.toLocaleString()} and you have ₦${this.funds().toLocaleString()} in all.` };
    ride.boarding = true;
    ride.boardingFor = 0;
    const limit = this.world?.walkToDriver?.(() => this.climbIn(ride)) ?? 0;
    ride.boardingLimit = Number.isFinite(limit) ? limit : 0;
    this.changed();
    if (ride.boardingLimit <= 0) this.climbIn(ride);
    return { ok: true };
  }

  /** In the seat: the fare is taken, once, and the trip begins */
  private climbIn(ride: ActiveRide): void {
    if (this.ride !== ride || ride.stage === 'on_trip') return;
    const paid = ride.fare <= 0 || this.backend.pay(ride.fare, `${ride.vehicle.label} to ${ride.destination.name}`, 'TRAVEL_COST');
    this.world?.driverLeaves?.();
    if (!paid) {
      this.ride = null;
      showGameToast(`You could not pay the ₦${ride.fare.toLocaleString()} fare, so the driver left. You were not charged.`, 'warning', 4200);
      this.changed();
      return;
    }
    ride.paid = true;
    ride.boarding = false;
    ride.stage = 'on_trip';
    this.changed();
    const done = () => {
      if (this.ride !== ride) return;
      this.ride = null;
      if (ride.arrived) ride.arrived();
      else this.world?.arriveAt(ride.destination);
      this.changed();
    };
    if (ride.start) ride.start(done);
    else this.world?.startJourney(ride.destination, ride.vehicle, done);
  }

  /** The trip was turned back: it is over without reaching the destination (the fare stays paid) */
  public endTrip(): void {
    if (this.ride?.stage !== 'on_trip') return;
    this.ride = null;
    this.changed();
  }

  /** Cancels a ride the driver has not reached yet. Nothing has been charged. */
  public cancel(): RideResult {
    if (!this.ride) return { ok: false, reason: 'There is no ride to cancel.' };
    if (this.ride.stage === 'on_trip' || this.ride.boarding) return { ok: false, reason: 'The trip has started.' };
    this.ride = null;
    this.world?.driverLeaves?.();
    this.changed();
    return { ok: true };
  }

  /** The ride is off with nothing charged, and the player is told why */
  private callOff(why: string): void {
    this.ride = null;
    this.world?.driverLeaves?.();
    showGameToast(why, 'warning', 4200);
    this.changed();
  }

  public update(delta: number): void {
    const ride = this.ride;
    if (!ride || ride.stage === 'on_trip' || !this.world) return;

    // The driver only finds someone who is waiting on the street
    if (this.world.where() !== 'street') {
      this.callOff('Your driver could not find you on the street, so the ride was cancelled. You were not charged.');
      return;
    }

    if (ride.stage === 'driver_coming') {
      const before = Math.ceil(ride.eta);
      const sent = ride.sent ? this.world.driverEta?.() : undefined;
      ride.eta = sent ?? ride.eta - delta;
      if (ride.eta > 0) {
        if (Math.ceil(ride.eta) !== before) this.changed();
        return;
      }
      ride.eta = 0;
      // No road for a vehicle to come along here: the driver meets the player and the trip simply starts
      if (ride.instant || !ride.sent) {
        this.climbIn(ride);
        return;
      }
      ride.stage = 'driver_here';
      ride.waited = 0;
      // The bar on the street says so and offers Get in; the driver gives a toot
      SoundEngine.getInstance().playVehicleHorn(ride.vehicle.mode === 'bike' ? 'okada' : ride.vehicle.mode === 'keke' ? 'keke' : 'sedan');
      this.changed();
      return;
    }

    if (ride.boarding) {
      // If the walk is broken off or blocked, they are still helped in
      ride.boardingFor += delta;
      if (ride.boardingFor > ride.boardingLimit) this.climbIn(ride);
      return;
    }
    ride.waited += delta;
    if (ride.waited > WAITS_SECONDS) this.callOff('Your driver waited and had to go. You were not charged.');
  }

  private changed(): void {
    this.onChange?.();
  }
}
