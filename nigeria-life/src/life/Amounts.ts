/**
 * Amounts of money as people type them: 2500, 2,500, ₦2.5m, 3 billion, 1tn.
 * Always a whole number, and never past what a JavaScript number holds exactly.
 */

/** 999 trillion and a bit: the largest amount the game accepts */
export const MOST_AMOUNT = 999_999_999_999_999;

const SCALE: Record<string, number> = {
  k: 1e3, thousand: 1e3,
  m: 1e6, mil: 1e6, million: 1e6,
  b: 1e9, bn: 1e9, billion: 1e9,
  t: 1e12, tn: 1e12, trillion: 1e12,
};

/** The amount typed, or NaN if it is not a whole amount above zero that the game can hold */
export function parseAmount(typed: string): number {
  const text = typed.toLowerCase().replace(/[₦$£,\s]/g, '').replace(/^ngn/, '');
  const match = /^(\d+(?:\.\d+)?|\.\d+)([a-z]*)$/.exec(text);
  if (!match) return NaN;
  const scale = match[2] ? SCALE[match[2]] : 1;
  if (!scale) return NaN;
  const exact = Number(match[1]) * scale;
  // Part of a naira cannot be paid: 1.5 is refused, 1.5m is fine
  if (Math.abs(exact - Math.round(exact)) > 1e-6) return NaN;
  const amount = Math.round(exact);
  return amount > 0 && amount <= MOST_AMOUNT ? amount : NaN;
}

/** A large amount in words: 2,500,000,000 is "2.5 billion" (nothing under a million needs it) */
export function amountInWords(amount: number): string {
  for (const [size, word] of [[1e12, 'trillion'], [1e9, 'billion'], [1e6, 'million']] as const) {
    if (amount >= size) return `${Number((amount / size).toFixed(2))} ${word}`;
  }
  return '';
}
