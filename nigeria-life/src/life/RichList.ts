/**
 * The Naija Rich List: what the player is worth, everything counted (cash, bank, businesses at
 * what they cost, land, cars, homes, investments), ranked among Lagos's big names. The names are
 * made up; their fortunes run from a buka chain to a cement empire, so there is always someone
 * next to pass. Online, the players' own list comes from the world server.
 */

export interface Worth {
  money: number;
  businesses: number;
  land: number;
  vehicles: number;
  homes: number;
  investments: number;
}

export interface Tycoon {
  name: string;
  trade: string;
  worth: number;
  icon: string;
}

export const TYCOONS: Tycoon[] = [
  { name: 'Alhaji Sani Garba-Kura', trade: 'Cement, sugar and refining', worth: 2_400_000_000_000, icon: '🏭' },
  { name: 'Chief (Mrs) Folake Adeyemi-Cole', trade: 'Oil and gas', worth: 1_100_000_000_000, icon: '🛢️' },
  { name: 'Dr Ikenna Obiora', trade: 'Telecoms', worth: 780_000_000_000, icon: '📡' },
  { name: 'Otunba Kunle Ajose', trade: 'Banking', worth: 520_000_000_000, icon: '🏦' },
  { name: 'Hajia Zainab Lawan-Idris', trade: 'Shipping out of Apapa', worth: 310_000_000_000, icon: '🚢' },
  { name: 'Engr Tobi Ige-Martins', trade: 'Fintech', worth: 190_000_000_000, icon: '💳' },
  { name: 'Mrs Nneka Eze-Dike', trade: 'Fashion and retail', worth: 96_000_000_000, icon: '👗' },
  { name: 'Prince Bode Akinwale', trade: 'Banana Island property', worth: 64_000_000_000, icon: '🏝️' },
  { name: 'Mr Emeka Nwosu-Ibe', trade: 'Ladipo auto parts', worth: 31_000_000_000, icon: '🔧' },
  { name: 'Chief Gbenga Alade', trade: 'Haulage', worth: 18_000_000_000, icon: '🚛' },
  { name: 'Mama Ronke Shittu', trade: 'A chain of bukas', worth: 7_500_000_000, icon: '🍲' },
  { name: 'DJ Kaycee Eko', trade: 'Music and nightlife', worth: 3_200_000_000, icon: '🎧' },
  { name: 'Tunde "Big Tee" Ogundipe', trade: 'Owambe events', worth: 1_400_000_000, icon: '🎉' },
  { name: 'Iya Basira Ogunleye', trade: 'Balogun textiles', worth: 620_000_000, icon: '🧵' },
  { name: 'Musa Yakasai', trade: 'A keke fleet at Oshodi', worth: 240_000_000, icon: '🛺' },
  { name: 'Ngozi Umeh', trade: 'POS agents across Surulere', worth: 95_000_000, icon: '🏧' },
  { name: 'Segun Bamidele', trade: 'A betting shop in Yaba', worth: 48_000_000, icon: '⚽' },
];

interface RichListApi {
  worth: () => Worth;
  total(w?: Worth): number;
  standing(total?: number): { rank: number; above: Tycoon | null; gap: number; below: Tycoon | null };
}

export const RichList: RichListApi = {
  /** What the player owns, by kind (set by the game) */
  worth: (): Worth => ({ money: 0, businesses: 0, land: 0, vehicles: 0, homes: 0, investments: 0 }),

  total(w: Worth = RichList.worth()): number {
    return w.money + w.businesses + w.land + w.vehicles + w.homes + w.investments;
  },

  /** The list with the player in their place: their rank, who is just above and what it takes to pass them */
  standing(total = RichList.total()): { rank: number; above: Tycoon | null; gap: number; below: Tycoon | null } {
    const above = [...TYCOONS].reverse().find((t) => t.worth > total) ?? null;
    const below = TYCOONS.find((t) => t.worth <= total) ?? null;
    const rank = TYCOONS.filter((t) => t.worth > total).length + 1;
    return { rank, above, gap: above ? above.worth - total : 0, below };
  },
};

/** ₦2.4tn, ₦780bn, ₦31bn, ₦620m, ₦95k */
export function short(n: number): string {
  const a = Math.abs(n);
  const f = (v: number, unit: string) => `₦${v >= 100 ? Math.round(v) : v >= 10 ? v.toFixed(1).replace(/\.0$/, '') : v.toFixed(2).replace(/\.?0+$/, '')}${unit}`;
  if (a >= 1e12) return f(n / 1e12, 'tn');
  if (a >= 1e9) return f(n / 1e9, 'bn');
  if (a >= 1e6) return f(n / 1e6, 'm');
  if (a >= 1e3) return f(n / 1e3, 'k');
  return `₦${Math.round(n)}`;
}
