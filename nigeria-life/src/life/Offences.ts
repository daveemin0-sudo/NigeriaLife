/**
 * The police: what a player can be arrested for, how long they sit in the cell (real minutes),
 * what their bail is, and the record it leaves. A record lapses after thirty days without
 * another offence on it; while it stands, the employers that vet their staff (a bank, an
 * airline, the airport, a hospital ward, LASTMA, the university) will not take them on.
 *
 * The game server imports this file too, so it imports nothing and uses no TypeScript-only syntax.
 */

export interface Offence {
  id: string;
  /** What the charge sheet says */
  name: string;
  /** Real minutes in the cell, first time */
  minutes: number;
  bail: number;
}

export const OFFENCES: Record<string, Offence> = {
  'no-papers': { id: 'no-papers', name: 'Driving without vehicle papers', minutes: 5, bail: 20_000 },
  'ran-checkpoint': { id: 'ran-checkpoint', name: 'Running a police checkpoint', minutes: 10, bail: 50_000 },
  bribery: { id: 'bribery', name: 'Offering a bribe to a police officer', minutes: 5, bail: 30_000 },
};

/** A record entry lapses this long after it was made */
export const RECORD_LASTS_MS = 30 * 24 * 3_600_000;
/** What it costs to try a bribe in the cell, and the chance the officer takes it */
export const BRIBE = 10_000;
export const BRIBE_TAKEN = 0.5;

export interface RecordEntry {
  offence: string;
  at: number;
}

export interface Custody {
  offence: string;
  since: number;
  until: number;
  bail: number;
}

/** Entries still standing at `now` */
export function standing(record: RecordEntry[], now: number): RecordEntry[] {
  return record.filter((r) => now - r.at < RECORD_LASTS_MS);
}

/** The cell time and bail for an offence, longer and dearer with every offence still on the record (up to three times) */
export function sentence(offenceId: string, record: RecordEntry[], now: number): { minutes: number; bail: number } {
  const offence = OFFENCES[offenceId];
  const prior = standing(record, now).length;
  const factor = Math.min(3, 1 + prior * 0.5);
  return { minutes: Math.round(offence.minutes * factor), bail: Math.round((offence.bail * factor) / 1000) * 1000 };
}

/** The trades that will not take on someone with a record standing */
export function vetsStaff(trade: string): boolean {
  return /bank|aviation|airspace|airport & border|in-flight|flight operations|nursing|clinical|traffic enforcement|higher education/i.test(trade);
}

/** When a record clears: the day its last standing entry lapses */
export function clearsAt(record: RecordEntry[], now: number): number | null {
  const left = standing(record, now);
  return left.length ? Math.max(...left.map((r) => r.at)) + RECORD_LASTS_MS : null;
}
