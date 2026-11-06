/**
 * Trade between cities: goods bought where they are made, carried, and sold where they are
 * dear. Each city's motor park has a goods shed where traders buy and sell (the park is where
 * goods go between cities in Nigeria, in the coaches' boots). A good is cheapest where it comes
 * from; its price moves a little from day to day, the same for everyone (from the good, the city
 * and the day); a shed buys back at nine tenths of its own price, so trading in one place loses
 * and the profit is in the journey. A player carries 120 kg at most.
 *
 * The game server buys and sells by this too, so it imports nothing and uses no TypeScript-only syntax.
 */

export type TradeCity = 'lagos' | 'abuja' | 'port_harcourt';

export interface Good {
  id: string;
  name: string;
  /** What one is: a bag, a keg, a bale */
  unit: string;
  kg: number;
  /** Where it comes from */
  from: TradeCity;
  /** Its price in each city on an ordinary day, ₦ */
  price: Record<TradeCity, number>;
}

export const GOODS: Good[] = [
  { id: 'crayfish', name: 'Dried crayfish', unit: '10 kg bag', kg: 10, from: 'port_harcourt', price: { port_harcourt: 38_000, lagos: 61_000, abuja: 66_000 } },
  { id: 'palm_oil', name: 'Palm oil', unit: '25 litre keg', kg: 25, from: 'port_harcourt', price: { port_harcourt: 42_000, lagos: 56_000, abuja: 59_000 } },
  { id: 'periwinkle', name: 'Periwinkle', unit: '5 kg basket', kg: 5, from: 'port_harcourt', price: { port_harcourt: 9_000, lagos: 15_500, abuja: 16_000 } },
  { id: 'yam', name: 'Yam tubers', unit: 'bundle of ten', kg: 30, from: 'abuja', price: { abuja: 18_000, lagos: 31_000, port_harcourt: 29_000 } },
  { id: 'beans', name: 'Honey beans', unit: '50 kg bag', kg: 50, from: 'abuja', price: { abuja: 70_000, lagos: 96_000, port_harcourt: 94_000 } },
  { id: 'shea', name: 'Shea butter', unit: '5 kg tub', kg: 5, from: 'abuja', price: { abuja: 9_000, lagos: 15_000, port_harcourt: 14_500 } },
  { id: 'ankara', name: 'Ankara fabric', unit: 'bale of ten pieces', kg: 8, from: 'lagos', price: { lagos: 45_000, abuja: 66_000, port_harcourt: 63_000 } },
  { id: 'accessories', name: 'Phone accessories', unit: 'carton', kg: 6, from: 'lagos', price: { lagos: 120_000, abuja: 162_000, port_harcourt: 158_000 } },
];

export const CARRY_KG = 120;
/** What a shed pays for a good, as a share of its own price */
export const BUY_BACK = 0.9;
/** Goods sold in another city must have had time to get there (a coach, a flight) */
export const TRAVEL_MS = 4 * 60_000;

/** The goods shed at each city's motor park, where trade is done (the park's site and a radius round it) */
export const TRADE_SHEDS: Record<TradeCity, { name: string; x: number; z: number; radius: number }> = {
  lagos: { name: 'Jibowu Motor Park goods shed', x: 92.5, z: -69.6, radius: 32 },
  abuja: { name: 'Utako Motor Park goods shed', x: 15, z: 35, radius: 32 },
  port_harcourt: { name: 'Waterlines Motor Park goods shed', x: 14.5, z: 38, radius: 32 },
};

export const CITY_NAMES: Record<TradeCity, string> = { lagos: 'Lagos', abuja: 'Abuja', port_harcourt: 'Port Harcourt' };

export function goodById(id: string): Good | null {
  return GOODS.find((g) => g.id === id) ?? null;
}

/** The game's day (day 0 is Wed 7 Oct 2026) at a moment, by the Lagos calendar */
export function tradeDay(ms: number): number {
  const lagos = ms + 3_600_000;
  return Math.floor((lagos - Date.UTC(2026, 9, 7)) / 86_400_000);
}

/** How far a price is off its ordinary level on a day, -6% to +6% */
function drift(goodId: string, city: string, day: number): number {
  let h = 2166136261;
  for (const c of `${goodId}:${city}:${day}`) h = Math.imul(h ^ c.charCodeAt(0), 16777619) >>> 0;
  return ((h % 1000) / 1000 - 0.5) * 0.12;
}

/** What a good costs at a city's shed on a day */
export function buyPrice(good: Good, city: TradeCity, day: number): number {
  return Math.round((good.price[city] * (1 + drift(good.id, city, day))) / 50) * 50;
}

/** What a city's shed pays for a good on a day */
export function sellPrice(good: Good, city: TradeCity, day: number): number {
  return Math.round((buyPrice(good, city, day) * BUY_BACK) / 50) * 50;
}

/** The shed a player standing here is at, or null */
export function shedAt(city: string, x: number, z: number): TradeCity | null {
  const shed = TRADE_SHEDS[city as TradeCity];
  return shed && Math.hypot(x - shed.x, z - shed.z) <= shed.radius ? (city as TradeCity) : null;
}

export interface CargoLine {
  good: string;
  qty: number;
  /** What was paid for them in all */
  paid: number;
  /** Where and when the last of them was bought */
  city: TradeCity;
  at: number;
}

export function cargoKg(cargo: CargoLine[]): number {
  return cargo.reduce((sum, line) => sum + (goodById(line.good)?.kg ?? 0) * line.qty, 0);
}
