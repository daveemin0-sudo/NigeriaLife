import { DEFAULT_BUSINESSES, type PlayerAccount } from './types';

/**
 * What homes, offices and businesses cost, close to what they sell and let for in 2025, in
 * naira: buy price and rent a month. Applied to every account when it is read, so an old save
 * gets today's prices too. What a player already owns stays theirs; only the price tags move.
 */
export const PROPERTY_PRICES: Record<string, { buy: number; rent: number }> = {
  // Lagos mainland
  prop_mushin_room: { buy: 9_500_000, rent: 35_000 },
  prop_mainland_room: { buy: 18_000_000, rent: 55_000 },
  prop_mainland_apt: { buy: 75_000_000, rent: 250_000 },
  prop_mainland_shop: { buy: 45_000_000, rent: 150_000 },
  prop_yaba_student: { buy: 38_000_000, rent: 120_000 },
  prop_magodo_estate: { buy: 280_000_000, rent: 800_000 },
  prop_yaba_tech_office: { buy: 180_000_000, rent: 650_000 },
  prop_ikeja_apt: { buy: 120_000_000, rent: 450_000 },
  prop_ikeja_tech_hub: { buy: 220_000_000, rent: 750_000 },
  prop_surulere_terrace: { buy: 150_000_000, rent: 400_000 },
  prop_palm_view: { buy: 65_000_000, rent: 200_000 },
  prop_villa_estate: { buy: 350_000_000, rent: 1_100_000 },
  // The islands and Lekki
  prop_vi_luxury_apt: { buy: 650_000_000, rent: 2_500_000 },
  prop_vi_office_suite: { buy: 900_000_000, rent: 3_500_000 },
  prop_lekki_duplex: { buy: 420_000_000, rent: 1_500_000 },
  prop_ikoyi_mansion: { buy: 1_800_000_000, rent: 6_000_000 },
  prop_lekki_boutique: { buy: 250_000_000, rent: 900_000 },
  prop_ajah_duplex: { buy: 160_000_000, rent: 450_000 },
  prop_ajah_land: { buy: 45_000_000, rent: 0 },
  prop_eko_penthouse: { buy: 3_200_000_000, rent: 9_000_000 },
  prop_eko_corp_hq: { buy: 2_800_000_000, rent: 8_000_000 },
  prop_banana_island_villa: { buy: 6_500_000_000, rent: 18_000_000 },
  // Abuja
  prop_gwarinpa_duplex: { buy: 180_000_000, rent: 450_000 },
  prop_kubwa_flat: { buy: 35_000_000, rent: 110_000 },
  prop_maitama_penthouse: { buy: 1_200_000_000, rent: 4_000_000 },
  prop_wuse_residence: { buy: 350_000_000, rent: 1_200_000 },
  prop_wuse_office: { buy: 600_000_000, rent: 2_000_000 },
  prop_asokoro_mansion: { buy: 2_500_000_000, rent: 7_500_000 },
  // Port Harcourt
  prop_gra_duplex: { buy: 450_000_000, rent: 1_300_000 },
  prop_dline_apartment: { buy: 60_000_000, rent: 180_000 },
  prop_rumuokoro_flat: { buy: 25_000_000, rent: 80_000 },
  prop_woji_estate: { buy: 150_000_000, rent: 400_000 },
  prop_peter_odili_mansion: { buy: 1_500_000_000, rent: 4_500_000 },
};

/** Businesses for sale: what the going concern costs, and what it takes in a cycle, scaled to match */
export const BUSINESS_PRICES: Record<string, number> = {
  biz_pos_kiosk: 2_500_000,
  biz_barber: 6_000_000,
  biz_mama_put: 8_000_000,
  biz_pharmacy: 25_000_000,
  biz_mechanic: 18_000_000,
  biz_slot: 30_000_000,
  biz_bet_lounge: 40_000_000,
  biz_danfo_fleet: 60_000_000,
  biz_oando: 450_000_000,
  biz_supermarket: 20_000_000,
};

/**
 * What a business takes in one payout, as a share of its price: about 4% of the price in a game
 * day before staff, wages, rent and tax. A fully staffed ₦8m buka nets about ₦300k a game day
 * after wages and tax, and pays for itself in about 25 game days (four hours or so of play).
 */
export const TAKINGS_PER_PAYOUT = 0.003;

export function applyRealPrices(account: PlayerAccount): PlayerAccount {
  for (const p of account.properties ?? []) {
    const price = PROPERTY_PRICES[p.id];
    if (!price) continue;
    p.purchasePrice = price.buy;
    p.rentalPriceMonthly = price.rent;
    if ('weeklyRent' in p) (p as { weeklyRent?: number }).weeklyRent = Math.round(price.rent / 4);
  }
  for (const b of account.businesses ?? []) {
    const price = BUSINESS_PRICES[b.id];
    const original = DEFAULT_BUSINESSES.find((d) => d.id === b.id);
    if (!price || !original) continue;
    // What a going concern of that price takes, a payout every 45 seconds (13 or so a game day);
    // its upgrades cost and add in the same proportion as they did on the old price tags
    b.purchasePrice = price;
    b.baseIncomePerCycle = Math.round(price * TAKINGS_PER_PAYOUT);
    const scale = price / original.purchasePrice;
    for (const u of b.upgrades ?? []) {
      const was = original.upgrades.find((o) => o.id === u.id);
      if (!was) continue;
      u.cost = Math.round((was.cost * scale) / 1000) * 1000;
      u.bonusIncomePerCycle = Math.round((b.baseIncomePerCycle * was.bonusIncomePerCycle) / original.baseIncomePerCycle);
    }
  }
  return account;
}
