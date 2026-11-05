/**
 * Fuel at today's Lagos prices: how big each kind of vehicle's tank is, what filling it costs
 * at the pump, how far a tank goes, and where the filling stations are.
 */

/** Petrol at the pump, per litre */
export const PETROL_PER_LITRE = 950;
/** A jerry can brought out to a car that has run dry, per litre: dearer than the pump */
export const JERRY_CAN_PER_LITRE = 1900;
export const JERRY_CAN_LITRES = 10;

/** Litres in a full tank, by vehicle type */
const TANKS: Record<string, number> = {
  okada: 12,
  keke: 8,
  sedan: 50,
  luxury_sedan: 80,
  sports_car: 70,
  suv: 80,
  gwagon: 100,
  danfo: 70,
  ambulance: 80,
  electric_car: 0,
};

/** Kilometres a litre goes, by vehicle type */
const ECONOMY: Record<string, number> = { okada: 35, keke: 30, sedan: 13, luxury_sedan: 9, sports_car: 7, suv: 8, gwagon: 6, danfo: 8, ambulance: 8 };

/** A full charge for an electric car */
export const FULL_CHARGE = 25000;

export function tankLitres(type: string): number {
  return TANKS[type] ?? 60;
}

/** What the law does to the pump price (a fuel subsidy), set by the game */
export const petrolPolicy = { factor: (): number => 1 };

/** What it costs to fill from this much (0 to 100) to full */
export function fillCost(type: string, fuel: number): number {
  const missing = Math.max(0, 100 - fuel) / 100;
  if (type === 'electric_car') return Math.round((FULL_CHARGE * missing) / 50) * 50;
  return Math.round((tankLitres(type) * missing * PETROL_PER_LITRE * petrolPolicy.factor()) / 50) * 50;
}

/** How far what is in the tank goes */
export function rangeKm(type: string, fuel: number): number {
  if (type === 'electric_car') return Math.round(5 * fuel);
  return Math.round((tankLitres(type) * fuel) / 100 * (ECONOMY[type] ?? 10));
}

/** What a jerry can puts in this tank, as a share of it (0 to 100) */
export function jerryCanShare(type: string): number {
  return Math.min(100, (JERRY_CAN_LITRES / Math.max(1, tankLitres(type))) * 100);
}

export interface Station {
  id: string;
  name: string;
  /** The forecourt, where a vehicle stands to be filled */
  x: number;
  z: number;
  city: string;
}

/** The filling stations of Lagos: the one on Broad Street, and those along the expressway */
export const STATIONS: Station[] = [
  { id: 'fuel-station', name: 'NaijaPetro, Broad Street', x: -18, z: 78.2, city: 'lagos' },
];

/** Within this many metres of a station's forecourt, a vehicle can be filled */
export const FORECOURT = 22;

export function stationNear(x: number, z: number, city: string, within = FORECOURT): Station | null {
  let best: Station | null = null;
  let bestD = within;
  for (const s of STATIONS) {
    if (s.city !== city) continue;
    const d = Math.hypot(s.x - x, s.z - z);
    if (d <= bestD) {
      best = s;
      bestD = d;
    }
  }
  return best;
}

export function nearestStation(x: number, z: number, city: string): { station: Station; metres: number } | null {
  let best: { station: Station; metres: number } | null = null;
  for (const s of STATIONS) {
    if (s.city !== city) continue;
    const metres = Math.hypot(s.x - x, s.z - z);
    if (!best || metres < best.metres) best = { station: s, metres };
  }
  return best;
}
