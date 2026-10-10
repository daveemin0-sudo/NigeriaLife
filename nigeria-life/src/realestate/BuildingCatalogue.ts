/**
 * What can be built on a plot.
 *
 * One table drives everything about a design: how much ground it needs, how tall it is, what
 * it costs, how long it takes, what kind of land it is allowed on, what it earns and what it
 * costs to keep. The construction system, the preview, the finished building in the world and
 * the money all read this table; there is no separate code per building.
 *
 * Every figure is an in-game price in the game's own economy, where a shift of work pays a
 * few thousand naira. None of them is a real construction cost.
 */

export type LandUse = 'residential' | 'commercial';

export type BuildingLook = 'house' | 'block' | 'shopfront' | 'glass';

export interface BuildingType {
  id: string;
  name: string;
  icon: string;
  use: LandUse;
  /** Footprint in metres, before any turning */
  width: number;
  depth: number;
  floors: number;
  floorHeight: number;
  look: BuildingLook;
  /** Wall colour of the finished building */
  colour: number;
  /** What it costs to build, paid once when work starts */
  cost: number;
  /** Game hours of work from an empty plot to a finished building */
  hours: number;
  /** What it brings in for each game day it stands finished: rent from tenants, or takings */
  incomePerDay: number;
  /** What it costs to keep for each game day */
  upkeepPerDay: number;
  /** A finished one of these is somewhere the owner can live */
  home: boolean;
  blurb: string;
}

export const BUILDING_TYPES: BuildingType[] = [
  {
    id: 'bungalow', name: 'Bungalow', icon: '🏠', use: 'residential', width: 8, depth: 9, floors: 1, floorHeight: 3.2, look: 'house', colour: 0xf3e2b3,
    cost: 450_000, hours: 8, incomePerDay: 0, upkeepPerDay: 800, home: true, blurb: 'Three rooms on one floor with a pitched roof. Yours to live in.',
  },
  {
    id: 'duplex', name: 'Duplex', icon: '🏡', use: 'residential', width: 8, depth: 10, floors: 2, floorHeight: 3.2, look: 'house', colour: 0xf1f1ec,
    cost: 1_200_000, hours: 14, incomePerDay: 0, upkeepPerDay: 1_800, home: true, blurb: 'Two storeys with a balcony. Yours to live in.',
  },
  {
    id: 'apartments', name: 'Apartment block', icon: '🏢', use: 'residential', width: 10, depth: 12, floors: 4, floorHeight: 3.1, look: 'block', colour: 0xe9c46a,
    cost: 3_500_000, hours: 26, incomePerDay: 42_000, upkeepPerDay: 9_000, home: true, blurb: 'Eight flats let to tenants, with one kept for you.',
  },
  {
    id: 'shop', name: 'Shop', icon: '🏪', use: 'commercial', width: 6, depth: 7, floors: 1, floorHeight: 3.6, look: 'shopfront', colour: 0xfde68a,
    cost: 300_000, hours: 6, incomePerDay: 9_000, upkeepPerDay: 1_500, home: false, blurb: 'A single lock-up shop with a roller shutter and a signboard.',
  },
  {
    id: 'restaurant', name: 'Restaurant', icon: '🍽️', use: 'commercial', width: 8, depth: 9, floors: 1, floorHeight: 3.8, look: 'shopfront', colour: 0xf0d9c0,
    cost: 650_000, hours: 9, incomePerDay: 17_000, upkeepPerDay: 4_000, home: false, blurb: 'A dining room and a kitchen behind it, with an awning over the door.',
  },
  {
    id: 'supermarket', name: 'Supermarket', icon: '🛒', use: 'commercial', width: 12, depth: 10, floors: 1, floorHeight: 4.6, look: 'shopfront', colour: 0xe2e8f0,
    cost: 1_500_000, hours: 14, incomePerDay: 36_000, upkeepPerDay: 9_000, home: false, blurb: 'One tall floor of shelves behind a wide glass front.',
  },
  {
    id: 'office', name: 'Office block', icon: '🏬', use: 'commercial', width: 10, depth: 10, floors: 5, floorHeight: 3.5, look: 'glass', colour: 0x7fb2e0,
    cost: 4_200_000, hours: 30, incomePerDay: 54_000, upkeepPerDay: 13_000, home: false, blurb: 'Five floors of offices let to companies, or a headquarters for your own.',
  },
  {
    id: 'hotel', name: 'Hotel', icon: '🏨', use: 'commercial', width: 12, depth: 12, floors: 6, floorHeight: 3.3, look: 'block', colour: 0xb7d3c6,
    cost: 8_000_000, hours: 40, incomePerDay: 110_000, upkeepPerDay: 30_000, home: false, blurb: 'Forty rooms, a lobby and a porch for cars to pull up under.',
  },
];

export const buildingType = (id: string): BuildingType | null => BUILDING_TYPES.find((type) => type.id === id) ?? null;

/** The ground a design covers when it is put down at a point, turned by quarter turns. */
export function footprintAt(type: BuildingType, x: number, z: number, turns: number) {
  const sideways = Math.abs(turns) % 2 === 1;
  const width = sideways ? type.depth : type.width;
  const depth = sideways ? type.width : type.depth;
  return { minX: x - width / 2, maxX: x + width / 2, minZ: z - depth / 2, maxZ: z + depth / 2 };
}

/** What comes back if work is stopped part-way: half of the money for the work not yet done. */
export function refundOnCancel(type: BuildingType, hoursDone: number): number {
  const left = Math.max(0, 1 - hoursDone / type.hours);
  return Math.round((type.cost * left * 0.5) / 1000) * 1000;
}

/** Pulling down a finished building costs a tenth of what it cost to put up. */
export const demolitionCost = (type: BuildingType) => Math.round((type.cost * 0.1) / 1000) * 1000;

/** The most takings a building holds for its owner before it stops piling up: a week. */
export const MAX_DAYS_HELD = 7;
