import type { Hairstyle, Outfit } from '../graphics/HumanMeshBuilder';

/**
 * What a trade wears on shift: the clothes put on when a shift starts and taken off when it ends.
 * A hard hat and a hi-vis vest at the refinery and on the docks, scrubs on the ward, whites in the
 * kitchen, a suit at the bank.
 */
export interface Uniform {
  outfit: Outfit;
  colour: number;
  trousers?: number;
  /** A hat over the hair (a hard hat, a chef's toque, a cap) */
  hat?: Hairstyle;
  hatColour?: number;
}

const RULES: Array<[RegExp, Uniform]> = [
  [/refinery|petrochemical|hse|health, safety/i, { outfit: 'engineer_vest', colour: 0xf97316, trousers: 0x1e3a8a, hat: 'hardhat', hatColour: 0xf8fafc }],
  [/dock|building|ramp|ground handling|haulage|tanker/i, { outfit: 'engineer_vest', colour: 0xfacc15, trousers: 0x1f2937, hat: 'hardhat', hatColour: 0xfacc15 }],
  [/mechanic|phone repair/i, { outfit: 'mechanic_overalls', colour: 0x1e40af, trousers: 0x1e40af }],
  [/nursing|clinical/i, { outfit: 'nurse_scrubs', colour: 0x0ea5e9, trousers: 0x0ea5e9 }],
  [/laborator/i, { outfit: 'doctor_coat', colour: 0xf8fafc, trousers: 0x334155 }],
  [/culinary|fast food|hospitality|cuisine/i, { outfit: 'chef_attire', colour: 0xf8fafc, trousers: 0x111827, hat: 'chef_toque', hatColour: 0xf8fafc }],
  [/traffic enforcement/i, { outfit: 'traffic_warden', colour: 0xfacc15, trousers: 0x7f1d1d, hat: 'cap', hatColour: 0x7f1d1d }],
  [/security|border/i, { outfit: 'security_uniform', colour: 0x0f172a, trousers: 0x0f172a, hat: 'police_cap', hatColour: 0x0f172a }],
  [/flight operations|airspace|radar/i, { outfit: 'pilot_uniform', colour: 0xf8fafc, trousers: 0x0f172a, hat: 'pilot_cap', hatColour: 0x0f172a }],
  [/in-flight|ticketing|customer service/i, { outfit: 'suit', colour: 0x7f1d1d, trousers: 0x111827 }],
  [/banking|software|fintech|higher education|radio|content|wholesale|supermarket|retail/i, { outfit: 'suit', colour: 0x0f172a, trousers: 0x0f172a }],
  [/football|fitness|athlet/i, { outfit: 'jersey', colour: 0x15803d, trousers: 0xf8fafc }],
  [/hair|barber|interior|event|wedding/i, { outfit: 'polo_shirt', colour: 0x111827, trousers: 0x111827 }],
  [/music|dj|nightlife/i, { outfit: 'hoodie', colour: 0x111827, trousers: 0x111827, hat: 'cap', hatColour: 0x111827 }],
  [/transit/i, { outfit: 'polo_shirt', colour: 0xfacc15, trousers: 0x1f2937 }],
];

/** The work clothes for a trade (the employer's `trade` in `jobs/employers.ts`) */
export function uniformFor(trade: string | null | undefined): Uniform {
  for (const [rule, uniform] of RULES) if (trade && rule.test(trade)) return uniform;
  return { outfit: 'polo_shirt', colour: 0x166534, trousers: 0x1f2937 };
}
