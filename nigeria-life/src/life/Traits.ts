/**
 * Traits: one per character, picked once and kept for good (like the origin).
 *
 * Each trait changes how fast some needs drain, how fast some skills grow, or what some things
 * cost. Most carry a small cost too, so no trait is simply the best. Shared by the game and the
 * server (which only stores the id and refuses a change), so it imports nothing.
 */

export type TraitId =
  | 'iron_belle'
  | 'never_dull'
  | 'owambe_spirit'
  | 'gist_master'
  | 'neat_and_fresh'
  | 'traffic_bladder'
  | 'bookworm'
  | 'hustler_dna'
  | 'kitchen_general'
  | 'motor_park_connect'
  | 'gym_bro'
  | 'born_talent';

export type NeedKey = 'hunger' | 'energy' | 'fun' | 'social' | 'hygiene' | 'bladder';
export type SkillKey = 'coding' | 'charisma' | 'music' | 'hustle' | 'fitness' | 'cooking' | 'craft' | 'driving' | 'academics';
/** What a price change applies to: food bought, and fares and fuel on the road */
export type PriceKey = 'food' | 'transport';

export interface Trait {
  id: TraitId;
  name: string;
  icon: string;
  /** One line a player reads when choosing */
  blurb: string;
  /** Multiplies how fast a need drains: 0.7 is 30% slower, 1.15 is 15% faster */
  needs?: Partial<Record<NeedKey, number>>;
  /** Multiplies skill points gained: 1.5 is half as much again */
  skills?: Partial<Record<SkillKey, number>>;
  /** Multiplies what is paid: 0.8 is 20% cheaper */
  prices?: Partial<Record<PriceKey, number>>;
}

export const TRAITS: readonly Trait[] = [
  { id: 'iron_belle', name: 'Iron Belle', icon: '🍲', blurb: 'One plate of rice carries you till evening. Hunger drains 30% slower.', needs: { hunger: 0.7 } },
  { id: 'never_dull', name: 'Never Dull', icon: '⚡', blurb: 'You run on pure Lagos energy. Energy drains 25% slower, but hunger drains 10% faster.', needs: { energy: 0.75, hunger: 1.1 } },
  { id: 'owambe_spirit', name: 'Owambe Spirit', icon: '💃', blurb: 'Life is a party. Fun drains 30% slower, and social 15% slower.', needs: { fun: 0.7, social: 0.85 } },
  { id: 'gist_master', name: 'Gist Master', icon: '🗣️', blurb: 'Everybody knows you. Social drains 35% slower, and charisma grows 50% faster.', needs: { social: 0.65 }, skills: { charisma: 1.5 } },
  { id: 'neat_and_fresh', name: 'Neat & Fresh', icon: '🧼', blurb: 'Always looking clean. Hygiene drains 35% slower.', needs: { hygiene: 0.65 } },
  { id: 'traffic_bladder', name: 'Third Mainland Bladder', icon: '🚌', blurb: 'Two hours in go-slow, no wahala. Bladder drains 40% slower.', needs: { bladder: 0.6 } },
  { id: 'bookworm', name: 'Bookworm', icon: '📚', blurb: 'Academics and coding grow 50% faster, but fun drains 15% faster.', skills: { academics: 1.5, coding: 1.5 }, needs: { fun: 1.15 } },
  { id: 'hustler_dna', name: 'Hustler DNA', icon: '💼', blurb: 'Every day na hustle. Hustle and craft grow 50% faster, but energy drains 10% faster.', skills: { hustle: 1.5, craft: 1.5 }, needs: { energy: 1.1 } },
  { id: 'kitchen_general', name: 'Kitchen General', icon: '👩🏾‍🍳', blurb: 'Cooking grows 50% faster, and food costs 10% less.', skills: { cooking: 1.5 }, prices: { food: 0.9 } },
  { id: 'motor_park_connect', name: 'Motor Park Connect', icon: '🛺', blurb: 'The agberos know you. Fares and fuel cost 20% less, and driving grows 50% faster.', prices: { transport: 0.8 }, skills: { driving: 1.5 } },
  { id: 'gym_bro', name: 'Gym Bro', icon: '💪', blurb: 'Fitness grows 50% faster and energy drains 10% slower, but hunger drains 15% faster.', skills: { fitness: 1.5 }, needs: { energy: 0.9, hunger: 1.15 } },
  { id: 'born_talent', name: 'Born Talent', icon: '🎤', blurb: 'Music grows 50% faster, and fun drains 20% slower.', skills: { music: 1.5 }, needs: { fun: 0.8 } },
];

export const TRAIT_IDS: readonly TraitId[] = TRAITS.map((t) => t.id);

export function isTraitId(value: unknown): value is TraitId {
  return typeof value === 'string' && (TRAIT_IDS as readonly string[]).includes(value);
}

export function traitById(id: unknown): Trait | null {
  return TRAITS.find((t) => t.id === id) ?? null;
}

/** How fast this need drains with this trait (1 without one) */
export function needRate(trait: unknown, need: NeedKey): number {
  return traitById(trait)?.needs?.[need] ?? 1;
}

/** How much of each skill point gained counts, with this trait (1 without one) */
export function skillRate(trait: unknown, skill: string): number {
  return traitById(trait)?.skills?.[skill as SkillKey] ?? 1;
}

/** What a price becomes with this trait: whole naira, never below 1 for something that cost something */
export function tradePrice(trait: unknown, kind: PriceKey, amount: number): number {
  const rate = traitById(trait)?.prices?.[kind] ?? 1;
  if (rate === 1 || amount <= 0) return amount;
  return Math.max(1, Math.round(amount * rate));
}
