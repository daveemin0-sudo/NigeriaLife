/**
 * Tax, as Nigeria has it from 1 January 2026 (the Nigeria Tax Act 2025), made simple for the game.
 * The game server imports this file too, so it imports nothing and uses no TypeScript-only syntax.
 *
 * PAYE. An employer takes income tax out of wages before paying them, and the payslip says how
 * much. The law's bands are for a year: the first ₦800,000 is free, then 15%, 18%, 21%, 23% and
 * 25%. A payslip here is worked out a month at a time, on a twelfth of each band, over all the
 * month's wages so far, so twenty short shifts are taxed as one month's pay of the same size
 * would be. Rent relief: a fifth of the home rent paid in the month, up to a twelfth of
 * ₦500,000, comes off the wages before the bands. Gigs and tips are cash in hand: no payslip.
 *
 * VAT. 7.5%. As in Nigerian shops it is already in the shelf price, so nothing costs more; the
 * receipt shows the part that is VAT. Basic food, medicine and books are zero-rated. Home rent,
 * land and houses, shared transport and fuel are exempt. Moving money, loans, wages, investments,
 * and a private sale between two people carry none.
 */

export const PAYE_BANDS: ReadonlyArray<{ upTo: number; rate: number }> = [
  { upTo: 800_000, rate: 0 },
  { upTo: 3_000_000, rate: 0.15 },
  { upTo: 12_000_000, rate: 0.18 },
  { upTo: 25_000_000, rate: 0.21 },
  { upTo: 50_000_000, rate: 0.23 },
  { upTo: Infinity, rate: 0.25 },
];
export const RENT_RELIEF_SHARE = 0.2;
export const RENT_RELIEF_CAP = 500_000;
export const VAT_RATE = 0.075;

export interface Payslip {
  /** The Lagos month it is for, 'YYYY-MM' */
  month: string;
  /** The day it was paid, as a label ('Thu 5 Nov') */
  date: string;
  employer: string;
  title: string;
  gross: number;
  /** Rent relief taken off the month's wages before the bands */
  relief: number;
  paye: number;
  net: number;
  /** The month's wages and PAYE so far, this payslip included */
  monthGross: number;
  monthPaye: number;
  /** The rate the last naira of this pay was taxed at */
  rate: number;
  /** Where the PAYE goes */
  office: string;
}

/** What the game keeps: this month's and this year's figures, and the latest payslips */
export interface TaxBook {
  month: string;
  gross: number;
  paye: number;
  /** Home rent paid this month (for the relief) */
  rent: number;
  year: string;
  yearGross: number;
  yearPaye: number;
  yearVat: number;
  /** Newest last */
  slips: Payslip[];
}

export const MAX_SLIPS = 20;

/** Income tax on a year's taxable income, at the law's bands */
export function yearlyPaye(taxable: number): number {
  let tax = 0;
  let from = 0;
  for (const band of PAYE_BANDS) {
    if (taxable <= from) break;
    tax += (Math.min(taxable, band.upTo) - from) * band.rate;
    from = band.upTo;
  }
  return tax;
}

/** The rate on the next naira of a year's taxable income */
export function rateAt(yearTaxable: number): number {
  return (PAYE_BANDS.find((band) => yearTaxable < band.upTo) ?? PAYE_BANDS[PAYE_BANDS.length - 1]).rate;
}

/** The bands for one month: a twelfth of each */
export function monthBands(): Array<{ from: number; upTo: number; rate: number }> {
  let from = 0;
  return PAYE_BANDS.map((band) => {
    const upTo = band.upTo === Infinity ? Infinity : Math.round(band.upTo / 12);
    const out = { from, upTo, rate: band.rate };
    from = upTo;
    return out;
  });
}

/** Rent relief for a month in which this much home rent was paid */
export function monthRelief(rentPaid: number): number {
  return Math.min(Math.round(Math.max(0, rentPaid) * RENT_RELIEF_SHARE), Math.round(RENT_RELIEF_CAP / 12));
}

/** PAYE due on all of a month's wages, after relief */
export function monthPaye(gross: number, relief: number): number {
  return Math.round(yearlyPaye(Math.max(0, gross - relief) * 12) / 12);
}

/**
 * One payslip: the PAYE on `gross` given what was already earned and taken this month. The
 * month's tax is worked out on all of it and what was taken before comes off, so the bands
 * apply to the month as a whole and the sum of the payslips is the month's tax.
 */
export function workPayslip(gross: number, month: { gross: number; paye: number; rent: number }): Pick<Payslip, 'gross' | 'relief' | 'paye' | 'net' | 'monthGross' | 'monthPaye' | 'rate'> {
  const monthGross = month.gross + gross;
  const relief = monthRelief(month.rent);
  const paye = Math.max(0, Math.min(gross, monthPaye(monthGross, relief) - month.paye));
  return { gross, relief, paye, net: gross - paye, monthGross, monthPaye: month.paye + paye, rate: rateAt(Math.max(0, monthGross - relief) * 12) };
}

const n = (amount: number) => `₦${Math.round(amount).toLocaleString('en-NG')}`;

/** What reached the pocket, in words: '₦9,180 after ₦1,620 PAYE', or just the pay when none was taken */
export function takeHome(slip: Pick<Payslip, 'net' | 'paye'>): string {
  return slip.paye > 0 ? `${n(slip.net)} after ${n(slip.paye)} PAYE` : n(slip.net);
}

/** Said once a month, on the first payslip that has PAYE on it: the free part is used up */
export function payeNote(slip: Pick<Payslip, 'paye' | 'monthPaye' | 'rate' | 'relief' | 'month'>): string | null {
  if (slip.paye <= 0 || slip.monthPaye !== slip.paye) return null;
  const free = monthBands()[0].upTo + slip.relief;
  return `The first ${n(free)} of your wages in ${monthLabel(slip.month).split(' ')[0]} was tax-free. PAYE is now taken at ${Math.round(slip.rate * 100)}%: see Bank, then Tax.`;
}

/** Home rent, which earns relief: a lease's first month and its Saturday rent, not a shop's or a wage */
export function isHomeRent(description: string): boolean {
  return /^(Saturday rent|Rent and arrears|Rent owed|Monthly Rent):/i.test(description);
}

export type VatClass = 'standard' | 'zero' | 'exempt' | 'none';

/** How VAT treats a payment, from its kind and what it was for */
export function vatClass(type: string, description: string): VatClass {
  const d = description.toLowerCase();
  switch (type) {
    case 'SHOP_PURCHASE':
      if (/petrol|diesel|fuel/.test(d)) return 'exempt';
      return /pharmac|chemist|medicine|drug|book/.test(d) ? 'zero' : 'standard';
    case 'FOOD_PURCHASE':
      // A buka, a mama put or a market stall sells basic food; a restaurant, hotel or lounge sells a service
      return /restaurant|hotel|lounge|club|bar\b|grill|room service|date with/.test(d) ? 'standard' : 'zero';
    case 'MEDICAL_BILL':
      return 'zero';
    case 'TRAVEL_COST':
      return 'exempt';
    case 'RENT_PAYMENT':
      if (isHomeRent(description)) return 'exempt';
      return /shop|store|office|kiosk|stall|warehouse|plot/.test(d) ? 'standard' : 'none';
    case 'PROPERTY_PURCHASE':
      return 'exempt';
    case 'ASSET_PURCHASE':
      // Bought from another player is a private sale
      if (/^bought .* from (?!the state)/.test(d)) return 'none';
      return /plot|land|acre|house|flat|duplex|building|estate|c of o/.test(d) ? 'exempt' : 'standard';
    case 'CONSTRUCTION_COST':
      return 'standard';
    default:
      return 'none';
  }
}

/** The VAT inside a price that includes it, or 0 */
export function vatIn(type: string, description: string, amount: number): number {
  return vatClass(type, description) === 'standard' ? Math.round((amount * VAT_RATE) / (1 + VAT_RATE)) : 0;
}

/** Where PAYE goes: the revenue service of the state the work is in */
export function taxOffice(city: string): string {
  if (city === 'abuja') return 'FCT Internal Revenue Service';
  if (city === 'port_harcourt') return 'Rivers State Internal Revenue Service';
  return 'Lagos State Internal Revenue Service';
}

const pad = (n: number) => String(n).padStart(2, '0');

/** The month of a game day (day 0 is Wed 7 Oct 2026), 'YYYY-MM' */
export function monthOfDay(day: number): string {
  const date = new Date(2026, 9, 7 + day);
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}`;
}

/** 'Thu 5 Nov' for a game day */
export function labelOfDay(day: number): string {
  return new Date(2026, 9, 7 + day).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }).replace(',', '');
}

const LAGOS_MONTH = new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Lagos', year: 'numeric', month: '2-digit' });
const LAGOS_DATE = new Intl.DateTimeFormat('en-GB', { timeZone: 'Africa/Lagos', weekday: 'short', day: 'numeric', month: 'short' });

/** The month in Lagos at a moment, 'YYYY-MM' */
export function lagosMonth(ms: number): string {
  const parts = LAGOS_MONTH.formatToParts(new Date(ms));
  return `${parts.find((p) => p.type === 'year')?.value}-${parts.find((p) => p.type === 'month')?.value}`;
}

/** 'Thu 5 Nov', in Lagos */
export function lagosDate(ms: number): string {
  return LAGOS_DATE.format(new Date(ms)).replace(',', '');
}

/** When a Lagos month began, ms (Lagos is UTC+1 all year) */
export function lagosMonthStart(month: string): number {
  const [y, m] = month.split('-').map(Number);
  return Date.UTC(y, m - 1, 1) - 3_600_000;
}

/** 'November 2026' */
export function monthLabel(month: string): string {
  const [y, m] = month.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
}

export function emptyBook(month: string): TaxBook {
  return { month, gross: 0, paye: 0, rent: 0, year: month.slice(0, 4), yearGross: 0, yearPaye: 0, yearVat: 0, slips: [] };
}

/** The book moved on to `month`: the month's figures start again in a new month, the year's in a new year */
export function rollBook(book: TaxBook | undefined, month: string): TaxBook {
  const b = book ?? emptyBook(month);
  if (b.year !== month.slice(0, 4)) {
    b.year = month.slice(0, 4);
    b.yearGross = 0;
    b.yearPaye = 0;
    b.yearVat = 0;
  }
  if (b.month !== month) {
    b.month = month;
    b.gross = 0;
    b.paye = 0;
    b.rent = 0;
  }
  return b;
}
