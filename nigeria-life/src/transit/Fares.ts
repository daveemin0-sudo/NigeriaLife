/**
 * Fares on Broad Street: where people wait for a ride, what each kind of vehicle charges a
 * passenger and how many it seats. The game server pays fares by this too (a fare is paid only
 * at a stop, and a stop gives no more riders than a vehicle seats in the time the queue takes
 * to fill again), so it imports nothing and uses no TypeScript-only syntax.
 */

/** Where people wait for a danfo: on the kerb of Broad Street, west side for southbound, east for northbound */
export const BUS_STOPS: ReadonlyArray<{ z: number; side: -1 | 1 }> = [
  { z: -20, side: -1 },
  { z: 60, side: -1 },
  { z: 40, side: 1 },
  { z: -90, side: 1 },
];

/** The stop a vehicle standing here is pulled up at, or -1 */
export function stopAt(x: number, z: number): number {
  return BUS_STOPS.findIndex((stop) => Math.sign(x) === stop.side && Math.abs(x) > 3 && Math.abs(z - stop.z) < 9);
}

/** What one passenger pays */
export function fareOf(type: string): number {
  return type === 'danfo' ? 350 : type === 'keke' ? 250 : type === 'ambulance' ? 1200 : 500;
}

/** How many passengers it seats */
export function seatsOf(type: string): number {
  return type === 'danfo' ? 8
    : type === 'keke' ? 3
      : type === 'suv' || type === 'gwagon' ? 5
        : type === 'sedan' || type === 'luxury_sedan' || type === 'electric_car' ? 4
          : type === 'ambulance' ? 2 : 1;
}

/** The kinds of vehicle a passenger may pay to ride in */
export const FARE_VEHICLES = ['danfo', 'keke', 'sedan', 'luxury_sedan', 'electric_car', 'suv', 'gwagon', 'sports_car', 'okada', 'ambulance'];

/** How long a stop's queue takes to fill again after its riders have gone, ms */
export const QUEUE_REFILL_MS = 120_000;
