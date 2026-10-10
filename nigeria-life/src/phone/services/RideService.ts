import { BackendService } from '../../backend/BackendService';
import { DestinationRegistry } from '../../destinations/DestinationRegistry';
import type { DestinationDefinition, TransportOption } from '../../destinations/DestinationTypes';
import { showGameToast } from '../../ui/GameToast';

export type RideStage = 'idle' | 'driver_coming' | 'on_trip';

export interface ActiveRide {
  destination: DestinationDefinition;
  vehicle: TransportOption;
  fare: number;
  stage: RideStage;
  /** Seconds until the driver reaches the player */
  eta: number;
  paid: boolean;
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
}

const PICKUP_SECONDS = 6;
/** The ways of getting about that can be booked from a phone */
const BOOKABLE = new Set(['keke', 'taxi', 'bike']);

/**
 * Booking a ride from the phone. A ride is one thing with one state: a driver is on the way,
 * or the trip is under way, or there is no ride. The fare is taken once, when the driver
 * arrives and the player gets in; cancelling before that costs nothing.
 */
export class RideService {
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
    return destination.transportAvailability.filter((option) => BOOKABLE.has(option.mode));
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

  public book(destinationId: string, mode: string): RideResult {
    const destination = DestinationRegistry.getInstance().getById(destinationId);
    const vehicle = destination?.transportAvailability.find((option) => option.mode === mode);
    if (!destination || !vehicle || !BOOKABLE.has(vehicle.mode)) return { ok: false, reason: 'That ride is not available.' };
    const blocked = this.cannotBook(vehicle);
    if (blocked) return { ok: false, reason: blocked };

    this.ride = { destination, vehicle, fare: vehicle.fare, stage: 'driver_coming', eta: PICKUP_SECONDS, paid: false };
    this.changed();
    return { ok: true };
  }

  /** Cancels a ride the driver has not reached yet. Nothing has been charged. */
  public cancel(): RideResult {
    if (!this.ride) return { ok: false, reason: 'There is no ride to cancel.' };
    if (this.ride.stage !== 'driver_coming') return { ok: false, reason: 'The trip has started.' };
    this.ride = null;
    this.changed();
    return { ok: true };
  }

  public update(delta: number): void {
    const ride = this.ride;
    if (!ride || ride.stage !== 'driver_coming' || !this.world) return;

    // The driver only finds someone who is waiting on the street
    if (this.world.where() !== 'street') {
      this.ride = null;
      showGameToast('Your driver could not find you on the street, so the ride was cancelled. You were not charged.', 'warning', 4200);
      this.changed();
      return;
    }

    const before = Math.ceil(ride.eta);
    ride.eta -= delta;
    if (ride.eta > 0) {
      if (Math.ceil(ride.eta) !== before) this.changed();
      return;
    }

    // The driver is here. Getting in is when the fare is paid: once, or not at all.
    const paid = this.backend.pay(ride.fare, `${ride.vehicle.label} to ${ride.destination.name}`, 'TRAVEL_COST');
    if (!paid) {
      this.ride = null;
      showGameToast(`You could not pay the ₦${ride.fare.toLocaleString()} fare, so the driver left. You were not charged.`, 'warning', 4200);
      this.changed();
      return;
    }
    ride.paid = true;
    ride.stage = 'on_trip';
    this.changed();
    this.world.startJourney(ride.destination, ride.vehicle, () => {
      if (this.ride !== ride) return;
      this.ride = null;
      this.world?.arriveAt(ride.destination);
      this.changed();
    });
  }

  private changed(): void {
    this.onChange?.();
  }
}
