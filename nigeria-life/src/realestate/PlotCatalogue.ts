import type { Rect } from '../world/plan/CityPlan';
import type { LandUse } from './BuildingCatalogue';

/**
 * The parcels of land in Lagos that can be owned.
 *
 * A plot is a fixed piece of the map: its id and its boundary never change, whoever owns it
 * and whatever is built on it. Nothing else in the city is for sale as land: roads, pavements
 * and the ground the landmarks stand on are not plots, and the generated streets are built
 * around these parcels, never on them.
 *
 * Every plot fronts a street, so a building on it has a door people can walk to.
 */

export interface PlotDef {
  id: string;
  name: string;
  /** The street it fronts */
  street: string;
  /** Which edge of the plot is on that street */
  frontage: 'north' | 'south' | 'east' | 'west';
  rect: Rect;
  /** What may be built here */
  uses: LandUse[];
  /** How tall a building here may be */
  maxFloors: number;
}

const plot = (id: string, name: string, street: string, frontage: PlotDef['frontage'], minX: number, maxX: number, minZ: number, maxZ: number, uses: LandUse[], maxFloors: number): PlotDef => ({
  id, name, street, frontage, rect: { minX, maxX, minZ, maxZ }, uses, maxFloors,
});

const HOMES: LandUse[] = ['residential'];
const TRADE: LandUse[] = ['commercial'];
const MIXED: LandUse[] = ['residential', 'commercial'];

export const LAGOS_PLOTS: PlotDef[] = [
  // Kakawa Street, east side: the Lekki end of the island
  plot('lag-kakawa-e1', '12 Kakawa Street', 'Kakawa Street', 'west', 50.5, 66.5, 14, 30, MIXED, 6),
  plot('lag-kakawa-e2', '18 Kakawa Street', 'Kakawa Street', 'west', 50.5, 64.5, 34, 48, MIXED, 6),
  plot('lag-kakawa-e3', '24 Kakawa Street', 'Kakawa Street', 'west', 50.5, 64.5, 52, 70, MIXED, 6),
  plot('lag-kakawa-e4', '5 Kakawa Street', 'Kakawa Street', 'west', 50.5, 64.5, -40, -24, MIXED, 5),
  plot('lag-kakawa-e5', '1 Kakawa Street', 'Kakawa Street', 'west', 50.5, 66.5, -101, -86, TRADE, 6),
  // Kakawa Street, west side: backing on to the Broad Street blocks
  plot('lag-kakawa-w1', '11 Kakawa Street', 'Kakawa Street', 'east', 22.5, 37.5, 14, 28, MIXED, 5),
  plot('lag-kakawa-w2', '7 Kakawa Street', 'Kakawa Street', 'east', 25.5, 37.5, -38, -26, HOMES, 3),
  plot('lag-kakawa-w3', '31 Kakawa Street', 'Kakawa Street', 'east', 26.5, 37.5, 50, 66, MIXED, 6),
  // Odunlami Street, the mainland side
  plot('lag-odunlami-w1', '9 Odunlami Street', 'Odunlami Street', 'east', -66.5, -52.5, -52, -38, MIXED, 4),
  plot('lag-odunlami-w2', '15 Odunlami Street', 'Odunlami Street', 'east', -66.5, -52.5, -34, -20, HOMES, 3),
  plot('lag-odunlami-w3', '2 Odunlami Street', 'Odunlami Street', 'east', -66.5, -52.5, -112, -98, MIXED, 4),
  // Martins Street
  plot('lag-martins-n1', '40 Martins Street', 'Martins Street', 'south', 60, 76, -84, -70, TRADE, 5),
  plot('lag-martins-s1', '63 Martins Street', 'Martins Street', 'north', 96, 110, -54, -42, HOMES, 2),
  plot('lag-martins-n2', '8 Martins Street', 'Martins Street', 'south', -100, -86, -82, -70, MIXED, 3),
  // Nnamdi Azikiwe Street, along the north of the island
  plot('lag-azikiwe-s1', '20 Nnamdi Azikiwe Street', 'Nnamdi Azikiwe Street', 'north', 52, 68, -117, -103, TRADE, 5),
  plot('lag-azikiwe-s2', '34 Nnamdi Azikiwe Street', 'Nnamdi Azikiwe Street', 'north', 72, 86, -117, -105, HOMES, 3),
];

/**
 * What land costs, in the game's own money, for each square metre of plot.
 *
 * These are prices in NigeriaLife's economy, set against what a shift of work pays and what
 * a business earns in the game. They are not valuations of real land. The order between
 * neighbourhoods follows the city as people know it: the island and the waterfront dear,
 * the mainland and the outskirts cheaper. Change a figure here and every price follows.
 *
 * Keyed by the district ids the map already uses.
 */
export const LAND_PRICE_PER_SQM: Record<string, number> = {
  banana_island: 90_000, // no plots yet: the district is not on the map
  eko_atlantic: 45_000,
  victoria_island: 32_000,
  lekki: 24_000,
  lagos_island: 20_000,
  ikeja: 12_000,
  yaba: 11_000,
  surulere: 9_000,
  mainland: 8_000,
  airport: 7_000,
  port_apapa: 6_500,
  ajah: 5_000,
};
export const DEFAULT_LAND_PRICE_PER_SQM = 8_000;

/** Land the law lets businesses use is worth a little more than land for homes only. */
export const COMMERCIAL_PREMIUM = 1.15;

export const plotArea = (def: PlotDef) => (def.rect.maxX - def.rect.minX) * (def.rect.maxZ - def.rect.minZ);

/** The state's price for a plot nobody has bought yet. */
export function statePrice(def: PlotDef, districtId: string): number {
  const perSqm = LAND_PRICE_PER_SQM[districtId] ?? DEFAULT_LAND_PRICE_PER_SQM;
  const premium = def.uses.includes('commercial') ? COMMERCIAL_PREMIUM : 1;
  return Math.round((plotArea(def) * perSqm * premium) / 50_000) * 50_000;
}
