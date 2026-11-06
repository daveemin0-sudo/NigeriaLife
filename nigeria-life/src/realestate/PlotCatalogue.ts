import type { Rect } from '../world/plan/CityPlan.ts';
import type { LandUse } from './BuildingCatalogue.ts';

/**
 * The parcels of land that can be owned, in every city.
 *
 * A plot is a fixed piece of the map: its id and its boundary never change, whoever owns it
 * and whatever is built on it. Nothing else in a city is for sale as land: roads, pavements
 * and the ground the landmarks stand on are not plots, and the generated streets are built
 * around these parcels, never on them.
 *
 * Every plot fronts a street, so a building on it has a door people can walk to.
 */

export type PlotCity = 'lagos' | 'abuja' | 'port_harcourt';

export interface PlotDef {
  id: string;
  city: PlotCity;
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

const plotIn = (city: PlotCity) => (id: string, name: string, street: string, frontage: PlotDef['frontage'], minX: number, maxX: number, minZ: number, maxZ: number, uses: LandUse[], maxFloors: number): PlotDef => ({
  id, city, name, street, frontage, rect: { minX, maxX, minZ, maxZ }, uses, maxFloors,
});
const plot = plotIn('lagos');
const abuja = plotIn('abuja');
const ph = plotIn('port_harcourt');

const HOMES: LandUse[] = ['residential'];
const TRADE: LandUse[] = ['commercial'];
const MIXED: LandUse[] = ['residential', 'commercial'];

// Zoning: towers may go up on a few plots, in the business districts (Lagos Island, Abuja's
// central boulevard, Aba Road in Port Harcourt); everywhere else keeps to a few floors.
export const LAGOS_PLOTS: PlotDef[] = [
  // Kakawa Street, east side: the Lekki end of the island
  plot('lag-kakawa-e1', '12 Kakawa Street', 'Kakawa Street', 'west', 50.5, 66.5, 14, 30, MIXED, 40),
  plot('lag-kakawa-e2', '18 Kakawa Street', 'Kakawa Street', 'west', 50.5, 64.5, 34, 48, MIXED, 6),
  plot('lag-kakawa-e3', '24 Kakawa Street', 'Kakawa Street', 'west', 50.5, 64.5, 52, 70, MIXED, 30),
  plot('lag-kakawa-e4', '5 Kakawa Street', 'Kakawa Street', 'west', 50.5, 64.5, -40, -24, MIXED, 5),
  plot('lag-kakawa-e5', '1 Kakawa Street', 'Kakawa Street', 'west', 50.5, 66.5, -101, -86, TRADE, 40),
  // Kakawa Street, west side: backing on to the Broad Street blocks
  plot('lag-kakawa-w1', '11 Kakawa Street', 'Kakawa Street', 'east', 22.5, 37.5, 14, 28, MIXED, 20),
  plot('lag-kakawa-w2', '7 Kakawa Street', 'Kakawa Street', 'east', 25.5, 37.5, -38, -26, HOMES, 3),
  plot('lag-kakawa-w3', '31 Kakawa Street', 'Kakawa Street', 'east', 26.5, 37.5, 50, 66, MIXED, 6),
  // Odunlami Street, the mainland side
  plot('lag-odunlami-w1', '9 Odunlami Street', 'Odunlami Street', 'east', -66.5, -52.5, -52, -38, MIXED, 4),
  plot('lag-odunlami-w2', '15 Odunlami Street', 'Odunlami Street', 'east', -80.5, -52.5, -34, -10, HOMES, 3),
  plot('lag-odunlami-w3', '2 Odunlami Street', 'Odunlami Street', 'east', -66.5, -52.5, -112, -98, MIXED, 4),
  // Martins Street
  plot('lag-martins-n1', '40 Martins Street', 'Martins Street', 'south', 60, 76, -84, -70, TRADE, 25),
  plot('lag-martins-s1', '63 Martins Street', 'Martins Street', 'north', 70, 84, -54, -42, HOMES, 2),
  plot('lag-martins-n2', '8 Martins Street', 'Martins Street', 'south', -100, -86, -82, -70, MIXED, 3),
  // Nnamdi Azikiwe Street, along the north of the island
  plot('lag-azikiwe-s1', '20 Nnamdi Azikiwe Street', 'Nnamdi Azikiwe Street', 'north', 52, 68, -117, -103, TRADE, 30),
  plot('lag-azikiwe-s2', '34 Nnamdi Azikiwe Street', 'Nnamdi Azikiwe Street', 'north', 72, 86, -117, -105, HOMES, 3),
  // Banana Island: large plots for low houses behind the estate gate
  plot('lag-banana-e1', '2 Banana Island Road', 'Banana Island Road', 'west', 119.5, 154.5, -44, -20, HOMES, 3),
  plot('lag-banana-e2', '6 Banana Island Road', 'Banana Island Road', 'west', 119.5, 154.5, -18, 6, HOMES, 3),
  plot('lag-banana-w1', '1 Banana Island Road', 'Banana Island Road', 'east', 84.5, 104.5, -47, -25, HOMES, 3),
  plot('lag-banana-w2', '9 Banana Island Road', 'Banana Island Road', 'east', 84.5, 104.5, -10, 12, MIXED, 3),
];

/** Abuja: plots along the capital boulevard, between the landmarks. */
export const ABUJA_PLOTS: PlotDef[] = [
  abuja('abj-boulevard-e1', '14 Shehu Shagari Way', 'Shehu Shagari Way', 'west', 14.5, 30.5, -62, -46, MIXED, 20),
  abuja('abj-boulevard-e2', '40 Shehu Shagari Way', 'Shehu Shagari Way', 'west', 14.5, 30.5, 52, 68, MIXED, 5),
  abuja('abj-boulevard-w1', '11 Shehu Shagari Way', 'Shehu Shagari Way', 'east', -30.5, -14.5, -62, -46, MIXED, 20),
  abuja('abj-boulevard-w2', '37 Shehu Shagari Way', 'Shehu Shagari Way', 'east', -30.5, -14.5, 52, 68, HOMES, 3),
  abuja('abj-boulevard-w3', '25 Shehu Shagari Way', 'Shehu Shagari Way', 'east', -30.5, -14.5, -6, 10, TRADE, 20),
];

/** Port Harcourt: plots along Aba Road. */
export const PORT_HARCOURT_PLOTS: PlotDef[] = [
  ph('phc-aba-e1', '22 Aba Road', 'Aba Road', 'west', 14, 28, -8, 8, MIXED, 15),
  ph('phc-aba-e2', '58 Aba Road', 'Aba Road', 'west', 14, 28, 62, 78, HOMES, 3),
  ph('phc-aba-w1', '17 Aba Road', 'Aba Road', 'east', -30, -14, -24, -8, MIXED, 4),
  ph('phc-aba-w2', '49 Aba Road', 'Aba Road', 'east', -30, -14, 44, 60, HOMES, 3),
];

export const ALL_PLOTS: PlotDef[] = [...LAGOS_PLOTS, ...ABUJA_PLOTS, ...PORT_HARCOURT_PLOTS];

/** Who sells land nobody has bought yet, in each city. */
export const STATE_NAME: Record<PlotCity, string> = {
  lagos: 'Lagos State',
  abuja: 'the FCT Administration',
  port_harcourt: 'Rivers State',
};

export const CITY_NAME: Record<PlotCity, string> = { lagos: 'Lagos', abuja: 'Abuja', port_harcourt: 'Port Harcourt' };

/**
 * What land costs, in naira, for each square metre of plot: close to what land sells for in
 * these neighbourhoods in 2025, so a plot on Banana Island costs what it does. The order between
 * neighbourhoods follows the cities as people know them: the islands and the diplomatic
 * quarters dear, the mainland and the outskirts cheaper. Change a figure here and every
 * price follows.
 *
 * Keyed by the district ids the maps already use.
 */
export const LAND_PRICE_PER_SQM: Record<string, number> = {
  // Lagos
  banana_island: 2_500_000,
  eko_atlantic: 1_400_000,
  victoria_island: 1_000_000,
  lagos_island: 650_000,
  lekki: 550_000,
  ikeja: 400_000,
  airport: 380_000,
  yaba: 300_000,
  surulere: 240_000,
  port_apapa: 260_000,
  mainland: 160_000,
  ajah: 130_000,
  // Abuja
  maitama: 1_100_000,
  asokoro: 1_000_000,
  cbd_abuja: 800_000,
  wuse: 550_000,
  garki: 450_000,
  jabi: 420_000,
  gwarinpa: 180_000,
  airport_abuja: 140_000,
  // Port Harcourt
  old_gra: 350_000,
  d_line: 250_000,
  trans_amadi: 230_000,
  township: 140_000,
  choba_uniport: 90_000,
  airport_ph: 70_000,
};
export const DEFAULT_LAND_PRICE_PER_SQM = 160_000;

/** Land the law lets businesses use is worth a little more than land for homes only. */
export const COMMERCIAL_PREMIUM = 1.15;

export const plotArea = (def: PlotDef) => (def.rect.maxX - def.rect.minX) * (def.rect.maxZ - def.rect.minZ);

/**
 * How fast land rises in each neighbourhood, a share a year: fastest where the city is still
 * spreading (the Lekki to Ajah axis, Gwarinpa, the airport roads), slowest where it is long
 * built up and already dear. In-game estimates, not valuations.
 */
export const LAND_GROWTH_PER_YEAR: Record<string, number> = {
  banana_island: 0.08, eko_atlantic: 0.12, victoria_island: 0.08, lagos_island: 0.07, lekki: 0.18, ikeja: 0.12,
  airport: 0.1, yaba: 0.14, surulere: 0.12, port_apapa: 0.06, mainland: 0.15, ajah: 0.22,
  maitama: 0.07, asokoro: 0.07, cbd_abuja: 0.06, wuse: 0.09, garki: 0.08, jabi: 0.1, gwarinpa: 0.16, airport_abuja: 0.18,
  old_gra: 0.08, d_line: 0.1, trans_amadi: 0.09, township: 0.06, choba_uniport: 0.15, airport_ph: 0.18,
};
export const DEFAULT_LAND_GROWTH = 0.1;

/** What land bought for `base` on day 0 of the game's calendar is worth on `day` (to the nearest ₦50,000) */
export function priceOnDay(base: number, districtId: string, day: number): number {
  const rate = LAND_GROWTH_PER_YEAR[districtId] ?? DEFAULT_LAND_GROWTH;
  return Math.round((base * Math.pow(1 + rate, Math.max(0, day) / 365)) / 50_000) * 50_000;
}

/**
 * Omo-onile: in these neighbourhoods a family who say the land was theirs come to the site
 * before the first block is laid and ask a "foundation levy", this share of what the building
 * costs. Where land is long titled and policed (the islands' estates, the diplomatic quarters)
 * nobody comes.
 */
export const OMO_ONILE_SHARE: Record<string, number> = {
  mainland: 0.04, ajah: 0.05, lekki: 0.03, surulere: 0.03, yaba: 0.02, ikeja: 0.02, port_apapa: 0.03, lagos_island: 0.015,
  gwarinpa: 0.02, airport_abuja: 0.03, jabi: 0.01,
  d_line: 0.02, trans_amadi: 0.02, township: 0.02, choba_uniport: 0.03, airport_ph: 0.03,
};
/** The least a family asks, and the most (a tower's share would be far beyond what is ever paid) */
export const OMO_ONILE_FLOOR = 50_000;
export const OMO_ONILE_CAP = 25_000_000;

/** The state's price for a plot nobody has bought yet. */
export function statePrice(def: PlotDef, districtId: string): number {
  const perSqm = LAND_PRICE_PER_SQM[districtId] ?? DEFAULT_LAND_PRICE_PER_SQM;
  const premium = def.uses.includes('commercial') ? COMMERCIAL_PREMIUM : 1;
  return Math.round((plotArea(def) * perSqm * premium) / 50_000) * 50_000;
}
