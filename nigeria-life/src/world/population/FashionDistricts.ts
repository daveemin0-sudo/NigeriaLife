import { LAGOS_DISTRICTS } from '../data/LagosMapData';
import { ABUJA_DISTRICTS } from '../data/AbujaMapData';
import { PH_DISTRICTS } from '../data/PortHarcourtMapData';
import type { DistrictData } from '../data/WorldDataTypes';

/**
 * How people dress in each part of a city. Every district has a taste (how formal, how premium, how young,
 * how traditional, how practical) and the colours worn there. People still pick their own clothes inside it:
 * the taste only weighs their choices.
 */
export interface FashionProfile {
  id: string;
  label: string;
  /** 0 street wear .. 1 business dress */
  formality: number;
  /** 0 budget .. 1 premium (clean, neutral, closed shoes) */
  premium: number;
  /** Student and street-youth taste: oversized tees, hoodies, baggy jeans, caps, prints */
  youth: number;
  /** Native wear: ankara, senator, kaftan, buba and iro */
  tradition: number;
  /** Market practicality: slides, shorts, worn clothes, a hat against the sun */
  practical: number;
  /** The colours worn here */
  palette: string[];
}

const P = {
  business: ['#0f172a', '#1e293b', '#f8fafc', '#bfdbfe', '#6b7280', '#7f1d1d', '#111827', '#a16207'],
  premium: ['#f5f0e6', '#111827', '#f8fafc', '#4d5b2a', '#b08d57', '#9caf88', '#1e3a5f', '#e8c4b8'],
  youth: ['#f8fafc', '#111827', '#dc2626', '#2563eb', '#16a34a', '#f59e0b', '#7c3aed', '#db2777', '#0ea5e9'],
  market: ['#eab308', '#dc2626', '#16a34a', '#ea580c', '#1d4ed8', '#db2777', '#f8fafc', '#7c2d12'],
  everyday: ['#f8fafc', '#1e3a8a', '#166534', '#7f1d1d', '#0f172a', '#f97316', '#38bdf8', '#facc15', '#6b7280'],
  industrial: ['#1e3a8a', '#334155', '#f97316', '#f8fafc', '#57534e', '#111827', '#0f766e'],
  capital: ['#0f172a', '#f5f5f4', '#065f46', '#1e3a8a', '#78350f', '#e7e5e4', '#4a044e', '#6b7280'],
};

/** The fashion profiles, by id. Districts point at one; more can be added without touching the engine. */
export const FASHION: Record<string, FashionProfile> = {};
export function registerFashion(f: FashionProfile): void {
  FASHION[f.id] = f;
}
const def = (id: string, label: string, formality: number, premium: number, youth: number, tradition: number, practical: number, palette: string[]) =>
  registerFashion({ id, label, formality, premium, youth, tradition, practical, palette });

def('business', 'Business district', 0.85, 0.65, 0.15, 0.35, 0.1, P.business);
def('premium_business', 'Premium business', 0.8, 0.9, 0.2, 0.25, 0.05, P.premium);
def('premium_casual', 'Premium casual', 0.4, 0.85, 0.45, 0.25, 0.1, P.premium);
def('student', 'Student quarter', 0.2, 0.3, 0.95, 0.2, 0.3, P.youth);
def('market', 'Market district', 0.2, 0.2, 0.3, 0.8, 0.85, P.market);
def('everyday', 'Everyday mainland', 0.35, 0.35, 0.45, 0.4, 0.5, P.everyday);
def('island_mixed', 'Island business and markets', 0.6, 0.5, 0.3, 0.5, 0.5, P.business.concat(P.market.slice(0, 4)));
def('tech', 'Tech and gadgets', 0.45, 0.5, 0.65, 0.25, 0.35, P.youth.concat(P.business.slice(0, 3)));
def('industrial', 'Port and industry', 0.35, 0.25, 0.3, 0.3, 0.8, P.industrial);
def('capital_formal', 'Capital, formal', 0.85, 0.7, 0.15, 0.6, 0.1, P.capital);
def('capital_residential', 'Capital, residential', 0.45, 0.6, 0.4, 0.55, 0.3, P.capital.concat(P.everyday.slice(0, 4)));
def('nightlife', 'Nightlife strip', 0.45, 0.5, 0.75, 0.3, 0.2, P.youth.concat(['#111827', '#7f1d1d']));

/** Each district's profile (by the map's district ids); a district not listed takes its zone's */
const DISTRICT_FASHION: Record<string, string> = {
  // Lagos
  banana_island: 'premium_casual',
  ikeja: 'tech',
  airport: 'business',
  mainland: 'everyday',
  yaba: 'student',
  surulere: 'everyday',
  port_apapa: 'industrial',
  lagos_island: 'island_mixed',
  victoria_island: 'business',
  eko_atlantic: 'premium_business',
  lekki: 'premium_casual',
  ajah: 'everyday',
  // Abuja
  cbd_abuja: 'capital_formal',
  maitama: 'capital_formal',
  asokoro: 'capital_formal',
  wuse: 'market',
  airport_abuja: 'business',
  garki: 'capital_residential',
  gwarinpa: 'capital_residential',
  jabi: 'premium_casual',
  // Port Harcourt
  airport_ph: 'business',
  trans_amadi: 'industrial',
  old_gra: 'premium_casual',
  d_line: 'nightlife',
  choba_uniport: 'student',
  township: 'market',
};
const ZONE_FASHION: Record<string, string> = {
  Mainland: 'everyday', Island: 'island_mixed', Peninsula: 'premium_casual', Industrial: 'industrial',
  Special: 'business', Diplomatic: 'capital_formal', Garden: 'capital_residential', 'High-Density': 'market',
};

const DISTRICTS: Record<string, DistrictData[]> = { lagos: LAGOS_DISTRICTS, abuja: ABUJA_DISTRICTS, port_harcourt: PH_DISTRICTS };

/** The district a point is in (else the nearest), as the map has them */
export function districtOf(city: string, x: number, z: number): DistrictData {
  const list = DISTRICTS[city] ?? LAGOS_DISTRICTS;
  const inside = list.find((d) => x >= d.bounds.minX && x <= d.bounds.maxX && z >= d.bounds.minZ && z <= d.bounds.maxZ);
  if (inside) return inside;
  let best = list[0];
  let bestD = Infinity;
  for (const d of list) {
    const dd = (d.center.x - x) ** 2 + (d.center.z - z) ** 2;
    if (dd < bestD) {
      bestD = dd;
      best = d;
    }
  }
  return best;
}

/** The fashion of a district (by id) */
export function fashionOfDistrict(d: Pick<DistrictData, 'id' | 'zone'>): FashionProfile {
  return FASHION[DISTRICT_FASHION[d.id] ?? ZONE_FASHION[d.zone] ?? 'everyday'] ?? FASHION.everyday;
}

/** The fashion where a point is */
export function fashionAt(city: string, x: number, z: number): { district: string; fashion: FashionProfile } {
  const d = districtOf(city, x, z);
  return { district: d.id, fashion: fashionOfDistrict(d) };
}

/** A workplace's own pull on what is worn there, whatever the district (a market is a market) */
export function fashionOfWorkplace(kind: string | undefined, around: FashionProfile): FashionProfile {
  if (kind === 'market' || kind === 'stall' || kind === 'foodstall') return around.practical >= 0.6 ? around : FASHION.market;
  if ((kind === 'bank' || kind === 'office') && around.formality < 0.6) return { ...around, formality: Math.max(around.formality, 0.65) };
  return around;
}
