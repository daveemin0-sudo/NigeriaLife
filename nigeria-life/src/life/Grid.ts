/**
 * NEPA: when each part of the country has light. Since 2024 Nigeria's electricity regulator puts
 * every feeder in a band by the hours of supply it should get a day: Band A at least 20, B 16,
 * C 12, D 8, E 4. Each area here is in one band (a few estates make their own power), and has a
 * plan for each day: so many hours with light, the rest in one to three cuts, at times that
 * differ from day to day. The plan comes from the area and the date alone, so everyone in the
 * same area has light at the same time, on any device, with nothing sent between them.
 *
 * It imports nothing and uses no TypeScript-only syntax, so the game server can use it too.
 */

export type Band = 'A' | 'B' | 'C' | 'D' | 'E';

/** The fewest hours of light a day each band is meant to get */
export const BAND_HOURS: Record<Band, number> = { A: 20, B: 16, C: 12, D: 8, E: 4 };

/** Each area's band, by district id (src/world/data/*MapData.ts); 'own' makes its own power */
const AREA_BAND: Record<string, Band | 'own'> = {
  // Lagos
  banana_island: 'own',
  eko_atlantic: 'own',
  ikoyi: 'A',
  victoria_island: 'A',
  airport: 'A',
  lekki: 'B',
  ikeja: 'B',
  magodo: 'B',
  lagos_island: 'C',
  yaba: 'C',
  surulere: 'C',
  port_apapa: 'C',
  ajah: 'D',
  mainland: 'D',
  mushin: 'E',
  // Abuja
  maitama: 'A',
  asokoro: 'A',
  cbd_abuja: 'A',
  airport_abuja: 'A',
  wuse: 'B',
  garki: 'B',
  jabi: 'B',
  gwarinpa: 'C',
  // Port Harcourt
  old_gra: 'B',
  airport_ph: 'B',
  trans_amadi: 'C',
  d_line: 'C',
  township: 'C',
  choba_uniport: 'D',
  rumuokoro: 'D',
};

/** Areas named the way people say them */
const AREA_NAMES: Record<string, string> = {
  banana_island: 'Banana Island', eko_atlantic: 'Eko Atlantic', ikoyi: 'Ikoyi', victoria_island: 'Victoria Island', airport: 'the airport', lekki: 'Lekki', ikeja: 'Ikeja', magodo: 'Magodo',
  lagos_island: 'Lagos Island', yaba: 'Yaba', surulere: 'Surulere', port_apapa: 'Apapa', ajah: 'Ajah', mainland: 'the Mainland', mushin: 'Mushin',
  maitama: 'Maitama', asokoro: 'Asokoro', cbd_abuja: 'the Central Area', airport_abuja: 'the airport', wuse: 'Wuse', garki: 'Garki', jabi: 'Jabi', gwarinpa: 'Gwarinpa',
  old_gra: 'Old GRA', airport_ph: 'the airport', trans_amadi: 'Trans-Amadi', d_line: 'D-Line', township: 'Township', choba_uniport: 'Choba', rumuokoro: 'Rumuokoro',
};

/** A city's areas not listed are in this band */
const CITY_BAND: Record<string, Band> = { lagos: 'C', abuja: 'B', port_harcourt: 'C' };

export function bandOf(area: string, city = 'lagos'): Band | 'own' {
  return AREA_BAND[area] ?? CITY_BAND[city] ?? 'C';
}

export function areaName(area: string): string {
  return AREA_NAMES[area] ?? area.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * The area a home is in, finer than its district where its address says so: Mushin and Magodo
 * are both on the Mainland, and get very different light.
 */
export function homeArea(districtId: string, location = ''): string {
  const where = location.toLowerCase();
  if (/mushin|olosha|ojuelegba|ajegunle|oshodi/.test(where)) return 'mushin';
  if (/magodo|gra ikeja|ikeja gra/.test(where)) return 'magodo';
  if (/banana island/.test(where)) return 'banana_island';
  if (/ikoyi/.test(where)) return 'ikoyi';
  return districtId;
}

/** A small, fixed random number source: the same seed gives the same numbers everywhere */
function seeded(seed: string): () => number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  let state = h >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const plans = new Map<string, boolean[]>();

/**
 * One day's light in an area, hour by hour (true: light). A band's hours are the least it gets;
 * a day gives up to three more. What is left is cut, in one to three cuts at times of their own.
 */
export function dayPlan(area: string, day: number, city = 'lagos'): boolean[] {
  const key = `${city}:${area}:${day}`;
  const known = plans.get(key);
  if (known) return known;
  const band = bandOf(area, city);
  const hours: boolean[] = new Array(24).fill(true);
  if (band !== 'own') {
    const random = seeded(key);
    const on = Math.min(23, BAND_HOURS[band] + Math.floor(random() * 4));
    const off = 24 - on;
    const cuts = Math.max(1, Math.min(off, 1 + Math.floor(random() * 3)));
    // The cuts' lengths, each at least an hour, and the light between them
    const lengths = split(off, cuts, random);
    const gaps = split(on, cuts, random);
    let at = Math.floor(random() * 24);
    for (let i = 0; i < cuts; i++) {
      for (let h = 0; h < lengths[i]; h++) hours[(at + h) % 24] = false;
      at += lengths[i] + gaps[i];
    }
  }
  if (plans.size > 400) plans.clear();
  plans.set(key, hours);
  return hours;
}

/** `total` in `parts` whole pieces, each at least one, at random */
function split(total: number, parts: number, random: () => number): number[] {
  const out = new Array(parts).fill(1);
  for (let left = total - parts; left > 0; left--) out[Math.floor(random() * parts)] += 1;
  return out;
}

/** Light in an area at a game day and hour */
export function hasLight(area: string, day: number, hour: number, city = 'lagos'): boolean {
  return dayPlan(area, day, city)[Math.max(0, Math.min(23, Math.floor(hour)))];
}

/** Hours of light in an area on a day */
export function hoursOfLight(area: string, day: number, city = 'lagos'): number {
  return dayPlan(area, day, city).filter(Boolean).length;
}

/** When the light next changes (comes or goes), as a game day and whole hour; null if it never does in two days */
export function nextChange(area: string, day: number, hour: number, city = 'lagos'): { day: number; hour: number } | null {
  const now = hasLight(area, day, hour, city);
  let d = day;
  let h = Math.floor(hour) + 1;
  for (let i = 0; i < 48; i++, h++) {
    if (h >= 24) {
      h = 0;
      d += 1;
    }
    if (hasLight(area, d, h, city) !== now) return { day: d, hour: h };
  }
  return null;
}

/** 'about 4 hours a day', 'its own power' */
export function bandWords(area: string, city = 'lagos'): string {
  const band = bandOf(area, city);
  return band === 'own' ? 'its own power, day and night' : `Band ${band}, at least ${BAND_HOURS[band]} hours of light a day`;
}

/** '7 pm', '12 am' */
export function hourWords(hour: number): string {
  const h = Math.floor(hour) % 24;
  return `${h % 12 === 0 ? 12 : h % 12} ${h < 12 ? 'am' : 'pm'}`;
}
