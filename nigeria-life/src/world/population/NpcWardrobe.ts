import { FABRIC_CHOICES, type ClothingStyles, type Condition, type GarmentStyle, type PatternKind, type PatternStyle } from '../../player/ClothingStyle';
import type { FabricKind } from '../../graphics/people/GarmentFabrics';
import type { StreetLook } from '../../graphics/people/SkinnedCharacter';
import type { FashionProfile } from './FashionDistricts';

/**
 * The city's wardrobe: what each street person wears, and when.
 *
 * Everyone has a wardrobe profile made from their own number (so the same person is dressed the same way at
 * every meeting and in every session): the styles they lean to, their colours and a signature colour, the
 * shoes they like, how they keep their clothes, and a few outfits for each purpose (work, everyday, an evening
 * out, an occasion, sport). Their occupation decides the work clothes, their district the taste, the day of
 * the week and the hour which outfit is on, and the weather at the moment they dress how it is adjusted.
 *
 * People dress twice a day at most, at their own hours: in the morning before they go out, and (some of them)
 * again in the evening. A change never happens in front of the player: it waits until they are out of sight.
 * Only the rain is met at once, and only by those who carry a cap.
 *
 * Everything here is data and arithmetic (no three.js): the outfits are the existing garment models, footwear
 * and cloths, as a street look the renderer already knows how to dress.
 */

export type Gender = 'male' | 'female';
export type Purpose = 'work' | 'casual' | 'evening' | 'occasion' | 'sport';
export type DressWeather = 'hot' | 'mild' | 'rain' | 'harmattan';
export type DayPart = 'morning' | 'afternoon' | 'evening' | 'night';

/** An occupation's place in the wardrobe: the days it works, and whether it is out in the weather */
export interface OccupationInfo {
  id: string;
  label: string;
  /** Days of the week it works (0 Sunday .. 6 Saturday) */
  workdays: number[];
  /** Out of doors all day (puts a cap on in the rain, keeps practical shoes) */
  outdoor: boolean;
  /** Keeps clothes clean (0) or works them hard (1): how worn and dirty work clothes get */
  wear: number;
}

export const OCCUPATIONS: Record<string, OccupationInfo> = {};
/** Adds an occupation (or replaces one). Its work outfits are the templates that name it. */
export function registerOccupation(o: OccupationInfo): void {
  OCCUPATIONS[o.id] = o;
}
const MON_FRI = [1, 2, 3, 4, 5];
const MON_SAT = [1, 2, 3, 4, 5, 6];
const EVERY_DAY = [0, 1, 2, 3, 4, 5, 6];
for (const o of [
  { id: 'office', label: 'Office worker', workdays: MON_FRI, outdoor: false, wear: 0 },
  { id: 'student', label: 'Student', workdays: MON_FRI, outdoor: false, wear: 0.2 },
  { id: 'mechanic', label: 'Mechanic', workdays: MON_SAT, outdoor: true, wear: 1 },
  { id: 'construction', label: 'Construction worker', workdays: MON_SAT, outdoor: true, wear: 0.9 },
  { id: 'security', label: 'Security', workdays: EVERY_DAY, outdoor: true, wear: 0.1 },
  { id: 'market_trader', label: 'Market trader', workdays: MON_SAT, outdoor: true, wear: 0.5 },
  { id: 'driver', label: 'Driver', workdays: MON_SAT, outdoor: true, wear: 0.35 },
  { id: 'shopkeeper', label: 'Shopkeeper', workdays: MON_SAT, outdoor: false, wear: 0.15 },
  { id: 'fitness', label: 'Fitness enthusiast', workdays: [], outdoor: true, wear: 0.2 },
  { id: 'hawker', label: 'Hawker', workdays: MON_SAT, outdoor: true, wear: 0.6 },
  { id: 'casual', label: 'Out and about', workdays: [], outdoor: false, wear: 0.25 },
  { id: 'elder', label: 'Elder', workdays: [], outdoor: false, wear: 0 },
  { id: 'nightlife', label: 'Night owl', workdays: [], outdoor: false, wear: 0 },
] satisfies OccupationInfo[]) registerOccupation(o);

/** The crowd's roles (src/world/population/Routines.ts) and workplaces, as occupations */
export function occupationFor(role: string | undefined, workKind: string | undefined, r: number): string {
  switch (role) {
    case 'office':
      if (workKind === 'hotel' || workKind === 'bank') return r < 0.25 ? 'security' : 'office';
      return r < 0.1 ? 'security' : 'office';
    case 'trader':
      return workKind === 'shop' || workKind === 'food' ? 'shopkeeper' : 'market_trader';
    case 'artisan':
      if (workKind === 'site') return 'construction';
      if (workKind === 'transit') return 'driver';
      return r < 0.5 ? 'mechanic' : 'construction';
    case 'student':
      return 'student';
    case 'hawker':
      return 'hawker';
    case 'owl':
      return 'nightlife';
    case 'elder':
      return 'elder';
    case 'idler':
      return r < 0.18 ? 'fitness' : r < 0.32 ? 'driver' : 'casual';
    default:
      // No life of their own (a bus queue, a group by a door): mostly people on their way somewhere
      return r < 0.3 ? 'office' : r < 0.4 ? 'student' : r < 0.47 ? 'shopkeeper' : 'casual';
  }
}

// ---------------------------------------------------------------------------------------------
// Garments, colours, outfit templates
// ---------------------------------------------------------------------------------------------

/** The garment model each style name comes to (as the renderer maps them), for its cloths */
const GARMENT: Record<string, string> = {
  casual_tee: 'tee', tee_oversized: 'tee_oversized', polo_shirt: 'polo', button_shirt: 'shirt', hoodie: 'hoodie',
  jeans: 'jeans_straight', jeans_slim: 'jeans_slim', jeans_baggy: 'jeans_baggy', cargo_pants: 'cargo', chinos: 'chinos',
  shorts: 'shorts', cargo_shorts: 'cargo_shorts',
  sneakers: 'sneaker', oxfords: 'formal', loafers: 'formal', heels: 'formal', boots: 'boot', sandals: 'slides',
  cap: 'cap', bucket_hat: 'bucket', beanie: 'beanie',
};
/** Tops that are a whole look of their own (gowns, overalls, native sets, a suit): never swapped for the weather */
const SET_TOPS = new Set(['senator', 'kaftan', 'agbada', 'ankara_gown', 'buba_iro', 'blue_dress', 'mechanic_overalls', 'lecturer_suit']);
const ONE_PIECE = new Set(['ankara_gown', 'buba_iro', 'blue_dress', 'mechanic_overalls']);

export const COLOURS: Record<string, string[]> = {
  officeShirt: ['#f8fafc', '#dbeafe', '#bfdbfe', '#fce7f3', '#ede9fe', '#fef3c7', '#e2e8f0'],
  dark: ['#0f172a', '#1e293b', '#111827', '#1f2937', '#374151', '#292524'],
  chino: ['#1e3a5f', '#334155', '#0f172a', '#d6c7a1', '#a8a29e', '#57534e', '#3f6212', '#78716c'],
  denim: ['#1e3a8a', '#1d4ed8', '#243b6b', '#3b5b8c', '#111827', '#475569', '#5b7fb5'],
  cargo: ['#4d5b2a', '#57534e', '#a8926a', '#1f2937', '#6b705c'],
  native: ['#0f172a', '#f5f5f4', '#7f1d1d', '#0f766e', '#78350f', '#1e3a8a', '#e7e5e4', '#4a044e', '#365314', '#b08d57'],
  hivis: ['#f97316', '#facc15', '#a3e635'],
  bright: ['#dc2626', '#16a34a', '#2563eb', '#f59e0b', '#db2777', '#7c3aed', '#0ea5e9', '#f97316', '#10b981'],
  ankara: ['#eab308', '#dc2626', '#16a34a', '#1d4ed8', '#db2777', '#7c2d12', '#ea580c', '#0d9488', '#7c3aed'],
  uniform: ['#0f172a', '#1e293b', '#1e3a8a', '#3f3f46'],
  overalls: ['#1e40af', '#1e3a8a', '#334155', '#3f6212', '#9a3412'],
  driver: ['#f8fafc', '#bfdbfe', '#0ea5e9', '#1e3a8a', '#e2e8f0'],
  evening: ['#7f1d1d', '#111827', '#db2777', '#f8fafc', '#0f766e', '#b08d57', '#7c3aed', '#1e3a8a'],
  business: ['#0f172a', '#1e3a5f', '#7f1d1d', '#065f46', '#374151', '#111827'],
  camo: ['#4d5b2a', '#6b705c', '#a8926a', '#3f3a2a'],
  sneakers: ['#f8fafc', '#111827', '#e5e7eb', '#374151', '#f5f0e6'],
  formal: ['#111827', '#3b2314', '#1c1917', '#5c3a1e'],
  boots: ['#5c3a1e', '#111827', '#8b5e34', '#3f3a2a'],
  sandals: ['#111827', '#3b2314', '#1e3a8a', '#7f1d1d', '#f8fafc'],
  hats: ['#111827', '#1e3a8a', '#f8fafc', '#4d5b2a', '#a8926a', '#7f1d1d'],
};

/** A source of colour: the wearer's own palette ('palette'), the colour of the top ('match'), or a named list */
type ColourSource = 'palette' | 'match' | string;

/** A style's leanings: formal, premium, young, traditional, practical (0..1 each) */
interface Axes { f: number; p: number; y: number; t: number; pr: number }

/** An outfit as a pattern for people to fill in with their own colours and choices */
export interface OutfitTemplate {
  id: string;
  g: 'm' | 'f' | 'a';
  top: string;
  /** What is worn below (options, the first most usual); none: matching trousers, or the top is a whole garment */
  bottom?: string[];
  shoes: string[];
  hats?: string[];
  hatChance?: number;
  /** Who wears it for what: 'occupation:purpose' or '*:purpose' */
  uses: string[];
  ax: Axes;
  /** 0 light (a tee and shorts) .. 1 warm (a hoodie, long sleeves and trousers) */
  warm: number;
  topC: ColourSource;
  bottomC?: ColourSource;
  /** Patterns on the top (or on the whole garment), weighed */
  pat?: Array<[PatternKind, number]>;
  /** A pattern on the bottom (a wrapper's ankara) */
  bottomPat?: Array<[PatternKind, number]>;
  /** How it is kept, weighed (work clothes); else the wearer's own care decides */
  cond?: Partial<Record<Condition, number>>;
  /** A fixed word on the chest (SECURITY) */
  logo?: string;
  /** The colour is the employer's, the same every day */
  uniform?: boolean;
  /** A matching set (a uniform, a native suit, a two-piece): worn as it is whatever the weather, and a set's pattern runs top and bottom */
  set?: boolean;
  weight?: number;
}

export const TEMPLATES: OutfitTemplate[] = [];
/** Templates by gender, occupation and purpose (worked out once each) */
const USES = new Map<string, OutfitTemplate[]>();
/** Adds an outfit template (for a new occupation, a new district taste, an event) */
export function registerTemplate(t: OutfitTemplate): void {
  TEMPLATES.push(t);
  USES.clear();
}
const ax = (f: number, p: number, y: number, t: number, pr: number): Axes => ({ f, p, y, t, pr });
for (const t of [
  // --- Everyday
  { id: 'tee_jeans', g: 'm', top: 'casual_tee', bottom: ['jeans', 'jeans_slim', 'jeans_baggy'], shoes: ['sneakers', 'sandals'], hats: ['cap'], hatChance: 0.18, uses: ['*:casual', 'student:work', 'shopkeeper:work', 'driver:work', 'hawker:work'], ax: ax(0.2, 0.4, 0.6, 0, 0.5), warm: 0.4, topC: 'palette', bottomC: 'denim', pat: [['plain', 0.72], ['stripes', 0.16], ['graphic', 0.12]] },
  { id: 'tee_shorts', g: 'm', top: 'casual_tee', bottom: ['shorts', 'cargo_shorts'], shoes: ['sandals', 'sneakers'], hats: ['cap', 'bucket_hat'], hatChance: 0.3, uses: ['*:casual', 'hawker:work'], ax: ax(0.05, 0.25, 0.6, 0, 0.85), warm: 0.1, topC: 'palette', bottomC: 'chino', pat: [['plain', 0.8], ['stripes', 0.2]] },
  { id: 'oversized_street', g: 'a', top: 'tee_oversized', bottom: ['jeans_baggy', 'cargo_pants', 'jeans_slim'], shoes: ['sneakers'], hats: ['cap', 'bucket_hat'], hatChance: 0.38, uses: ['*:casual', 'student:work', '*:evening'], ax: ax(0.1, 0.5, 1, 0, 0.2), warm: 0.45, topC: 'palette', bottomC: 'denim', pat: [['plain', 0.45], ['graphic', 0.35], ['camo', 0.1], ['stripes', 0.1]] },
  { id: 'hoodie_jeans', g: 'a', top: 'hoodie', bottom: ['jeans', 'jeans_baggy', 'cargo_pants', 'jeans_slim'], shoes: ['sneakers', 'boots'], hats: ['beanie', 'cap'], hatChance: 0.28, uses: ['*:casual', 'student:work'], ax: ax(0.15, 0.5, 0.9, 0, 0.3), warm: 1, topC: 'palette', bottomC: 'denim', pat: [['plain', 0.85], ['camo', 0.15]] },
  { id: 'polo_chinos', g: 'm', top: 'polo_shirt', bottom: ['chinos', 'jeans'], shoes: ['sneakers', 'loafers', 'oxfords'], uses: ['*:casual', 'office:work', 'shopkeeper:work', 'driver:work', '*:evening'], ax: ax(0.55, 0.6, 0.3, 0, 0.2), warm: 0.45, topC: 'palette', bottomC: 'chino', pat: [['plain', 0.8], ['stripes', 0.2]] },
  { id: 'shirt_casual', g: 'm', top: 'button_shirt', bottom: ['jeans', 'chinos', 'jeans_slim'], shoes: ['sneakers', 'loafers'], uses: ['*:casual', '*:evening'], ax: ax(0.5, 0.6, 0.4, 0, 0.2), warm: 0.6, topC: 'palette', bottomC: 'denim', pat: [['plain', 0.4], ['check', 0.4], ['stripes', 0.2]] },
  { id: 'cargo_tee', g: 'm', top: 'casual_tee', bottom: ['cargo_pants'], shoes: ['boots', 'sneakers'], hats: ['cap'], hatChance: 0.25, uses: ['*:casual', 'hawker:work', 'mechanic:casual'], ax: ax(0.1, 0.3, 0.5, 0, 0.7), warm: 0.5, topC: 'palette', bottomC: 'cargo', pat: [['plain', 0.7], ['camo', 0.3]] },
  { id: 'ankara_shirt', g: 'a', top: 'ankara_shirt', bottom: ['chinos', 'jeans', 'jeans_slim'], shoes: ['loafers', 'sneakers', 'sandals'], uses: ['*:casual', 'office:occasion', '*:occasion', 'market_trader:work', 'shopkeeper:work', '*:evening'], ax: ax(0.5, 0.5, 0.4, 0.9, 0.4), warm: 0.4, topC: 'ankara', bottomC: 'dark', pat: [['ankara', 1]] },
  { id: 'senator', g: 'm', top: 'button_shirt', bottom: ['chinos'], shoes: ['oxfords', 'loafers', 'sandals'], uses: ['office:occasion', '*:occasion', 'elder:casual', 'elder:work', '*:evening'], ax: ax(0.75, 0.6, 0.2, 1, 0.2), warm: 0.7, topC: 'native', bottomC: 'match', pat: [['plain', 0.85], ['pinstripe', 0.15]], set: true },
  { id: 'kaftan', g: 'a', top: 'kaftan', bottom: ['chinos'], shoes: ['sandals', 'loafers'], uses: ['elder:casual', 'elder:work', '*:occasion', 'market_trader:work', '*:casual'], ax: ax(0.55, 0.45, 0.1, 1, 0.5), warm: 0.7, topC: 'native', bottomC: 'match', pat: [['plain', 0.55], ['stripes', 0.3], ['pinstripe', 0.15]], set: true },
  // --- Work
  { id: 'office_shirt', g: 'm', top: 'button_shirt', bottom: ['chinos'], shoes: ['oxfords', 'loafers'], uses: ['office:work'], ax: ax(0.9, 0.6, 0.2, 0, 0.05), warm: 0.6, topC: 'officeShirt', bottomC: 'dark', pat: [['plain', 0.6], ['pinstripe', 0.25], ['check', 0.15]], weight: 2 },
  { id: 'office_suit', g: 'a', top: 'button_shirt', bottom: ['chinos'], shoes: ['oxfords', 'heels'], uses: ['office:work', '*:occasion'], ax: ax(1, 0.85, 0.15, 0, 0), warm: 0.9, topC: 'business', bottomC: 'match', set: true, weight: 0.8 },
  { id: 'security', g: 'a', top: 'polo_shirt', bottom: ['chinos'], shoes: ['boots', 'oxfords'], hats: ['cap'], hatChance: 0.55, uses: ['security:work'], ax: ax(0.7, 0.4, 0.3, 0, 0.5), warm: 0.6, topC: 'uniform', bottomC: 'match', logo: 'SECURITY', uniform: true, set: true },
  { id: 'mechanic', g: 'a', top: 'button_shirt', bottom: ['cargo_pants'], shoes: ['boots', 'sneakers'], uses: ['mechanic:work', 'construction:work'], ax: ax(0.2, 0.2, 0.4, 0, 1), warm: 0.8, topC: 'overalls', bottomC: 'match', cond: { dirty: 0.55, worn: 0.35, damaged: 0.1 }, uniform: true, set: true },
  { id: 'construction', g: 'a', top: 'casual_tee', bottom: ['cargo_pants', 'jeans'], shoes: ['boots'], hats: ['cap'], hatChance: 0.35, uses: ['construction:work'], ax: ax(0.1, 0.2, 0.4, 0, 1), warm: 0.5, topC: 'hivis', bottomC: 'cargo', pat: [['stripes', 1]], cond: { dirty: 0.45, worn: 0.45, damaged: 0.1 }, uniform: true, weight: 1.6 },
  { id: 'driver_polo', g: 'a', top: 'polo_shirt', bottom: ['chinos'], shoes: ['loafers', 'sandals'], hats: ['cap'], hatChance: 0.25, uses: ['driver:work'], ax: ax(0.55, 0.4, 0.3, 0, 0.4), warm: 0.45, topC: 'driver', bottomC: 'dark' },
  { id: 'driver_tee', g: 'm', top: 'casual_tee', bottom: ['jeans', 'chinos'], shoes: ['sandals', 'sneakers'], hats: ['cap'], hatChance: 0.5, uses: ['driver:work'], ax: ax(0.15, 0.25, 0.5, 0, 0.75), warm: 0.4, topC: 'palette', bottomC: 'denim', cond: { clean: 0.6, worn: 0.4 } },
  // --- Sport
  { id: 'sport_shorts', g: 'a', top: 'casual_tee', bottom: ['shorts'], shoes: ['sneakers'], hats: ['cap', 'beanie'], hatChance: 0.25, uses: ['*:sport', 'fitness:casual'], ax: ax(0.05, 0.5, 0.7, 0, 0.5), warm: 0.1, topC: 'bright', bottomC: 'dark', pat: [['plain', 0.6], ['stripes', 0.4]] },
  { id: 'sport_hoodie', g: 'a', top: 'hoodie', bottom: ['shorts', 'cargo_pants'], shoes: ['sneakers'], uses: ['*:sport'], ax: ax(0.05, 0.5, 0.7, 0, 0.4), warm: 0.8, topC: 'bright', bottomC: 'dark', weight: 0.6 },
  // --- Women
  { id: 'blouse_jeans', g: 'f', top: 'casual_blouse', bottom: ['jeans_slim', 'jeans'], shoes: ['sneakers', 'sandals', 'heels'], uses: ['*:casual', 'shopkeeper:work', '*:evening'], ax: ax(0.35, 0.5, 0.5, 0.1, 0.4), warm: 0.35, topC: 'palette', bottomC: 'denim', pat: [['plain', 0.6], ['ankara', 0.2], ['stripes', 0.2]] },
  { id: 'tee_jeans_f', g: 'f', top: 'casual_tee', bottom: ['jeans_slim', 'jeans'], shoes: ['sneakers'], hats: ['cap'], hatChance: 0.15, uses: ['*:casual', 'student:work'], ax: ax(0.15, 0.4, 0.8, 0, 0.4), warm: 0.4, topC: 'palette', bottomC: 'denim', pat: [['plain', 0.75], ['stripes', 0.15], ['graphic', 0.1]] },
  { id: 'office_shirt_f', g: 'f', top: 'button_shirt', bottom: ['chinos'], shoes: ['heels', 'loafers'], uses: ['office:work'], ax: ax(0.85, 0.6, 0.3, 0, 0.05), warm: 0.6, topC: 'officeShirt', bottomC: 'dark', pat: [['plain', 0.8], ['pinstripe', 0.2]] },
  { id: 'polo_jeans_f', g: 'f', top: 'polo_shirt', bottom: ['jeans_slim', 'chinos'], shoes: ['sneakers'], uses: ['shopkeeper:work', '*:casual', 'driver:work'], ax: ax(0.45, 0.5, 0.45, 0, 0.3), warm: 0.45, topC: 'palette', bottomC: 'denim' },
  // Women's native wear and evening (as two-piece sets on the garments there are: gowns, skirts and dresses need models of their own)
  { id: 'ankara_set_f', g: 'f', top: 'casual_blouse', bottom: ['chinos'], shoes: ['sandals', 'heels'], uses: ['market_trader:work', 'hawker:work', '*:occasion', 'elder:casual', 'elder:work', '*:evening', '*:casual'], ax: ax(0.45, 0.4, 0.3, 1, 0.6), warm: 0.4, topC: 'ankara', bottomC: 'match', pat: [['ankara', 1]], set: true, weight: 1.3 },
  { id: 'ankara_long_set_f', g: 'f', top: 'kaftan', bottom: ['chinos'], shoes: ['sandals', 'heels'], uses: ['*:occasion', 'office:occasion', 'elder:casual', 'elder:work'], ax: ax(0.65, 0.55, 0.15, 1, 0.3), warm: 0.6, topC: 'ankara', bottomC: 'match', pat: [['ankara', 1]], set: true },
  { id: 'evening_f', g: 'f', top: 'button_shirt', bottom: ['jeans_slim', 'chinos'], shoes: ['heels'], uses: ['*:evening', 'nightlife:evening'], ax: ax(0.6, 0.7, 0.7, 0, 0), warm: 0.5, topC: 'evening', bottomC: 'dark', weight: 1.4 },
  { id: 'office_polo_f', g: 'f', top: 'polo_shirt', bottom: ['chinos'], shoes: ['loafers', 'heels'], uses: ['office:work', 'shopkeeper:work'], ax: ax(0.65, 0.55, 0.3, 0, 0.1), warm: 0.45, topC: 'officeShirt', bottomC: 'dark' },
  { id: 'tee_cargo_f', g: 'f', top: 'casual_tee', bottom: ['cargo_pants', 'shorts'], shoes: ['sandals', 'sneakers'], hats: ['bucket_hat', 'cap'], hatChance: 0.2, uses: ['*:casual', 'hawker:work', 'market_trader:work'], ax: ax(0.1, 0.25, 0.5, 0, 0.85), warm: 0.35, topC: 'palette', bottomC: 'cargo' },
] satisfies OutfitTemplate[]) registerTemplate(t as OutfitTemplate);

/** Prints the street wears: a few fixed designs and inks, so the city never draws more than a handful */
const NPC_PRINTS_LIGHT_INK = [
  { design: 'eko_sun', colour2: '#facc15', colour3: '#f8fafc' },
  { design: 'lagos_234', colour2: '#f8fafc', colour3: '#16a34a' },
  { design: 'palm', colour2: '#f8fafc', colour3: '#f59e0b' },
];
const NPC_PRINTS_DARK_INK = [
  { design: 'danfo', colour2: '#111827', colour3: '#facc15' },
  { design: 'bridge', colour2: '#111827', colour3: '#dc2626' },
];
const LOGO_INK = { colour2: '#f8fafc', colour3: '#facc15' };

// ---------------------------------------------------------------------------------------------
// The profile
// ---------------------------------------------------------------------------------------------

export interface WardrobeProfile {
  seed: number;
  gender: Gender;
  occupation: string;
  /** Where they live and where they work, as tastes */
  home: FashionProfile;
  work: FashionProfile;
  homeDistrict: string;
  workDistrict: string;
  /** Their own leanings (the district's, shifted by their own taste) */
  formality: number;
  youth: number;
  tradition: number;
  premium: number;
  /** Their colours, and the one they wear most */
  palette: string[];
  signature: string;
  /** The shoes they reach for when they can choose */
  shoePref: 'sneakers' | 'formal' | 'sandals' | 'boots';
  /** 0 careless .. 1 always pressed and clean */
  care: number;
  /** When they dress in the morning, and (if they change) in the evening, in hours */
  dressHour: number;
  eveningHour: number;
  changesEvening: boolean;
  goesOut: boolean;
  churchgoer: boolean;
  nativeFriday: boolean;
  /** Carries a cap and puts it on when the rain starts */
  capInBag: boolean;
  skinTone: string;
  hairColor: string;
}

/** A number from 0 to 1 that is always the same for this number and purpose */
export function h01(id: number, salt: number): number {
  let h = Math.imul(id ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul(salt + 0x632be59b, 0xc2b2ae35);
  h ^= h >>> 15;
  h = Math.imul(h, 0x2c1b3c6d);
  h ^= h >>> 12;
  return (h >>> 0) / 4294967296;
}
export function strHash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}
/** The person's own number: their city and their place in its crowd */
export function personSeed(city: string, id: number): number {
  return (strHash(city) ^ Math.imul(id + 1, 0x9e3779b1)) >>> 0;
}
const pickOf = <T>(list: readonly T[], r: number): T => list[Math.min(list.length - 1, Math.floor(r * list.length))];
function weighted<T>(items: readonly T[], weight: (t: T) => number, r: number): T {
  let total = 0;
  for (const t of items) total += Math.max(0, weight(t));
  let x = r * total;
  for (const t of items) {
    x -= Math.max(0, weight(t));
    if (x < 0) return t;
  }
  return items[items.length - 1];
}
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

export interface PersonFacts {
  gender: Gender;
  occupation: string;
  home: FashionProfile;
  work?: FashionProfile;
  homeDistrict?: string;
  workDistrict?: string;
  skinTone: string;
  hairColor: string;
}

export function makeProfile(seed: number, f: PersonFacts): WardrobeProfile {
  const r = (salt: number) => h01(seed, salt);
  const occ = f.occupation;
  const home = f.home;
  const work = f.work ?? home;
  const elder = occ === 'elder';
  // Their own leanings: the district's taste, pulled by their own
  const youth = elder ? 0.05 : clamp01(lerp(home.youth, r(1), 0.5) + (occ === 'student' ? 0.35 : 0) + (occ === 'nightlife' ? 0.2 : 0));
  const tradition = clamp01(lerp(home.tradition, r(2), 0.45) + (elder ? 0.4 : 0));
  const formality = clamp01(lerp(home.formality, r(3), 0.4) + (occ === 'office' ? 0.15 : 0) - (occ === 'student' ? 0.15 : 0));
  const premium = clamp01(lerp(home.premium, r(4), 0.35));
  // Four colours of their district's, and a signature colour (sometimes a bright of their own)
  const pal = home.palette;
  const start = Math.floor(r(5) * pal.length);
  const palette = [0, 2, 3, 5].map((k) => pal[(start + k) % pal.length]);
  const signature = r(6) < 0.3 ? pickOf(COLOURS.bright, r(7)) : pal[(start + 1) % pal.length];
  const shoeR = r(8);
  const shoePref = formality > 0.6 && shoeR < 0.6 ? 'formal' : home.practical > 0.6 && shoeR < 0.55 ? 'sandals' : shoeR < 0.12 ? 'boots' : 'sneakers';
  const info = OCCUPATIONS[occ];
  const care = clamp01(lerp(0.55, r(9), 0.6) + premium * 0.3 - (info?.wear ?? 0.3) * 0.2 + (elder ? 0.25 : 0));
  const goesOut = occ === 'nightlife' || (!elder && r(10) < 0.25 + youth * 0.45);
  return {
    seed,
    gender: f.gender,
    occupation: occ,
    home,
    work,
    homeDistrict: f.homeDistrict ?? home.id,
    workDistrict: f.workDistrict ?? f.homeDistrict ?? work.id,
    formality,
    youth,
    tradition,
    premium,
    palette,
    signature,
    shoePref,
    care,
    dressHour: 5.4 + r(11) * 2.2,
    eveningHour: 17.6 + r(12) * 2.4,
    changesEvening: occ === 'nightlife' || goesOut || r(13) < 0.28,
    goesOut,
    churchgoer: r(14) < (elder ? 0.85 : 0.5),
    nativeFriday: (occ === 'office' || occ === 'shopkeeper') && r(15) < 0.35 + tradition * 0.4,
    capInBag: (info?.outdoor ?? false) ? r(16) < 0.6 : r(16) < 0.3,
    skinTone: f.skinTone,
    hairColor: f.hairColor,
  };
}

// ---------------------------------------------------------------------------------------------
// Outfits
// ---------------------------------------------------------------------------------------------

/** One outfit, worked out: the garments, each one's colour, and its cloth, pattern and condition */
export interface NpcOutfit {
  template: string;
  purpose: Purpose;
  top: string;
  bottom?: string;
  shoes: string;
  hat?: string;
  topColour: string;
  bottomColour: string;
  shoeColour: string;
  hatColour: string;
  styles: ClothingStyles;
  /** A matching set: never broken up for the weather */
  set: boolean;
  /** What the weather did to it (none, a hat for the rain, a warm layer...) */
  adjusted?: string;
}

function templatesFor(gender: Gender, occupation: string, purpose: Purpose): OutfitTemplate[] {
  const key = `${gender}|${occupation}|${purpose}`;
  let list = USES.get(key);
  if (list) return list;
  const g = gender === 'male' ? 'm' : 'f';
  const fits = (t: OutfitTemplate) => t.g === 'a' || t.g === g;
  list = TEMPLATES.filter((t) => fits(t) && t.uses.includes(`${occupation}:${purpose}`));
  // Uniformed work keeps to its own; otherwise anyone's outfits for the purpose join in
  const own = list.length > 0 && purpose === 'work';
  if (!own) list = list.concat(TEMPLATES.filter((t) => fits(t) && t.uses.includes(`*:${purpose}`) && !list!.includes(t)));
  if (!list.length) list = TEMPLATES.filter((t) => fits(t) && t.uses.includes('*:casual'));
  USES.set(key, list);
  return list;
}

/** How well a template suits this person for this purpose (their leanings against the style's) */
function suits(p: WardrobeProfile, t: OutfitTemplate, purpose: Purpose): number {
  const taste = purpose === 'work' ? p.work : p.home;
  const target: Axes = {
    f: purpose === 'evening' ? Math.max(p.formality, 0.45) : lerp(p.formality, taste.formality, 0.4),
    p: p.premium,
    y: p.youth,
    t: p.tradition,
    pr: taste.practical,
  };
  let s = t.weight ?? 1;
  // The occupation's own outfits come first
  if (t.uses.includes(`${p.occupation}:${purpose}`)) s *= 3;
  for (const k of ['f', 'p', 'y', 't', 'pr'] as const) s *= Math.max(0.06, 1 - Math.abs(t.ax[k] - target[k]) * 0.95);
  return s;
}

const SALT: Record<Purpose, number> = { work: 100, casual: 200, evening: 300, occasion: 400, sport: 500 };
/** How many outfits each person keeps for each purpose (they rotate day by day) */
export const OUTFITS_PER_PURPOSE: Record<Purpose, number> = { work: 2, casual: 3, evening: 2, occasion: 2, sport: 2 };

function colourFrom(src: ColourSource | undefined, p: WardrobeProfile, r: number, r2: number, top: string): string {
  if (!src || src === 'palette') return r2 < 0.45 ? p.signature : pickOf(p.palette, r);
  if (src === 'match') return top;
  return pickOf(COLOURS[src] ?? COLOURS.dark, r);
}
const lum = (hex: string): number => {
  const n = parseInt(hex.slice(1), 16);
  return (0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
};
/** A second colour that shows against the first */
function contrast(main: string, p: WardrobeProfile, r: number): string {
  const options = p.palette.concat(['#f8fafc', '#111827']).filter((c) => Math.abs(lum(c) - lum(main)) > 0.3);
  return options.length ? pickOf(options, r) : lum(main) > 0.5 ? '#111827' : '#f8fafc';
}

function patternFor(kind: PatternKind, main: string, p: WardrobeProfile, rr: (s: number) => number, slot: string): PatternStyle | undefined {
  switch (kind) {
    case 'stripes':
      return { kind, colour2: contrast(main, p, rr(1)), scale: [0.8, 1, 1.4][Math.floor(rr(2) * 3)], angle: 0 };
    case 'pinstripe':
      return { kind, colour2: lum(main) > 0.5 ? '#334155' : '#e5e7eb', scale: 1, angle: 90 };
    case 'check':
      return { kind, colour2: contrast(main, p, rr(3)), colour3: pickOf(p.palette, rr(4)), scale: [0.8, 1, 1.2][Math.floor(rr(5) * 3)], angle: 0 };
    case 'camo':
      return { kind, colour2: pickOf(COLOURS.camo, rr(6)), colour3: '#3f3a2a', scale: 1 };
    case 'ankara':
      return { kind, colour2: pickOf(COLOURS.ankara, rr(7)), colour3: pickOf(COLOURS.ankara, rr(8)), scale: [0.8, 1, 1.25][Math.floor(rr(9) * 3)] };
    case 'graphic': {
      if (slot !== 'top') return undefined;
      const set = lum(main) < 0.45 ? NPC_PRINTS_LIGHT_INK : NPC_PRINTS_DARK_INK;
      return { kind, ...pickOf(set, rr(10)), scale: 1, x: 0, y: 0 };
    }
    default:
      return undefined;
  }
}

function conditionFor(t: OutfitTemplate, purpose: Purpose, p: WardrobeProfile, r: number): Condition {
  if (purpose === 'occasion' || purpose === 'evening') return 'clean';
  if (t.cond && purpose === 'work') return weighted(Object.entries(t.cond) as Array<[Condition, number]>, ([, w]) => w, r)[0];
  // Their own care: the careless wear things in
  return r > p.care + 0.15 ? 'worn' : 'clean';
}

/** Their cloth for a garment: its usual one most of the time */
function fabricFor(style: string, r: number): FabricKind | undefined {
  const choices = FABRIC_CHOICES[GARMENT[style] ?? ''];
  if (!choices) return undefined;
  return r < 0.62 ? choices[0] : pickOf(choices, (r - 0.62) / 0.38);
}

/** The shoes they put on (their own preference, where the outfit allows it) */
function shoesFor(t: OutfitTemplate, p: WardrobeProfile, r: number): string {
  const pref = p.shoePref === 'formal' ? ['oxfords', 'loafers', 'heels'] : [p.shoePref];
  const liked = t.shoes.filter((s) => pref.includes(s) && (p.gender === 'female' || s !== 'heels'));
  const allowed = t.shoes.filter((s) => p.gender === 'female' || s !== 'heels');
  const list = allowed.length ? allowed : ['sneakers'];
  if (liked.length && r < 0.65) return liked[0];
  return r < 0.8 ? list[0] : pickOf(list, (r - 0.8) / 0.2);
}

const shoeColours = (shoes: string) => (shoes === 'sneakers' ? COLOURS.sneakers : shoes === 'boots' ? COLOURS.boots : shoes === 'sandals' ? COLOURS.sandals : COLOURS.formal);

/** One of a person's outfits for a purpose (the same person, purpose and number: the same outfit) */
export function buildOutfit(p: WardrobeProfile, purpose: Purpose, index: number): NpcOutfit {
  const base = SALT[purpose] + index * 13;
  const r = (salt: number) => h01(p.seed, base + salt);
  const list = templatesFor(p.gender, p.occupation, purpose);
  // The outfits for a purpose are different templates where there is a choice
  const firstPick = weighted(list, (t) => suits(p, t, purpose), h01(p.seed, SALT[purpose]));
  const t = index === 0 || list.length < 2
    ? firstPick
    : weighted(list, (x) => suits(p, x, purpose) * (x === firstPick ? 0.25 : 1), r(1));
  // A uniform is the employer's colour: the same every day
  const cr = (salt: number) => (t.uniform ? h01(p.seed, 900 + salt) : r(salt));
  const topColour = colourFrom(t.topC, p, cr(2), cr(3), '');
  const bottom = t.bottom ? pickOf(t.bottom, r(4)) : undefined;
  let bottomColour = colourFrom(t.bottomC ?? 'match', p, cr(5), 1, topColour);
  // Denim below a denim-coloured top reads as a boiler suit: a darker wash
  if (bottomColour === topColour && t.bottomC === 'denim') bottomColour = '#111827';
  const shoes = shoesFor(t, p, r(6));
  const shoeColour = pickOf(shoeColours(shoes), r(7));
  const hat = t.hats && r(8) < (t.hatChance ?? 0) + (purpose === 'casual' ? p.youth * 0.12 : 0) ? pickOf(t.hats, r(9)) : undefined;
  const hatColour = r(10) < 0.4 ? topColour : pickOf(COLOURS.hats, r(11));
  const condition = conditionFor(t, purpose, p, r(12));

  const rr = (s: number) => r(20 + s);
  const patKind = t.logo ? 'logo' : t.pat ? weighted(t.pat, ([, w]) => w, r(13))[0] : 'plain';
  let topPattern: PatternStyle | undefined;
  let topMain = topColour;
  // A guard's word across the chest, below the polo's short placket
  if (patKind === 'logo') topPattern = { kind: 'logo', text: t.logo, shape: 'none', ...LOGO_INK, scale: 1, x: 0, y: -0.3 };
  else if (patKind === 'camo') {
    topMain = pickOf(COLOURS.camo, rr(11));
    topPattern = patternFor('camo', topMain, p, rr, 'top');
  } else if (patKind !== 'plain') topPattern = patternFor(patKind, topColour, p, rr, 'top');
  // Construction's high-visibility tee: a silver band
  if (t.id === 'construction') topPattern = { kind: 'stripes', colour2: '#d1d5db', scale: 2, angle: 0 };

  const top: GarmentStyle = { colour: topMain, fabric: fabricFor(t.top, r(14)), pattern: topPattern, condition };
  const styles: ClothingStyles = { top };
  if (ONE_PIECE.has(t.top)) styles.bottom = { colour: topMain, pattern: topPattern && topPattern.kind !== 'logo' && topPattern.kind !== 'graphic' ? topPattern : undefined, condition };
  else {
    const bp = t.bottomPat ? weighted(t.bottomPat, ([, w]) => w, r(15))[0] : 'plain';
    // A two-piece set carries its pattern on both pieces (the same print, top and bottom)
    const setPattern = t.set && topPattern && (topPattern.kind === 'ankara' || topPattern.kind === 'pinstripe') ? topPattern : undefined;
    styles.bottom = {
      colour: bottomColour,
      fabric: bottom ? fabricFor(bottom, r(16)) : undefined,
      pattern: setPattern ?? (bp !== 'plain' ? patternFor(bp, bottomColour, p, (s) => r(40 + s), 'bottom') : undefined),
      // Jeans often carry the gold thread of denim
      stitch: bottom && bottom.startsWith('jeans') && r(17) < 0.4 ? '#c8962e' : undefined,
      condition,
    };
  }
  styles.shoes = { colour: shoeColour, fabric: fabricFor(shoes, r(18)), condition: condition === 'damaged' ? 'worn' : condition };
  if (hat) styles.hat = { colour: hatColour, fabric: fabricFor(hat, r(19)), condition: condition === 'damaged' ? 'worn' : condition };
  return { template: t.id, purpose, top: t.top, bottom, shoes, hat, topColour: topMain, bottomColour: ONE_PIECE.has(t.top) ? topMain : bottomColour, shoeColour, hatColour, styles, set: !!t.set };
}

// ---------------------------------------------------------------------------------------------
// Weather
// ---------------------------------------------------------------------------------------------

/** The weather as clothes see it, at the hour someone dresses */
export function dressWeather(weather: string, hour: number): DressWeather {
  if (weather === 'rainy' || weather === 'thunderstorm') return 'rain';
  // Harmattan mornings are cold and dusty; by afternoon it is hot again
  if (weather === 'harmattan') return hour < 11 ? 'harmattan' : 'hot';
  // A sunny morning means a hot day: people dress for it (not for a night out)
  if ((weather === 'sunny' || weather === 'clear') && hour < 19) return 'hot';
  return 'mild';
}

const clone = (o: NpcOutfit): NpcOutfit => ({ ...o, styles: { ...o.styles } });

/** An outfit as worn in this weather (the same person's same clothes, with a warm layer, closed shoes or a hat) */
export function forWeather(o: NpcOutfit, w: DressWeather, p: WardrobeProfile): NpcOutfit {
  if (w === 'mild') return o;
  const r = (s: number) => h01(p.seed, 700 + s);
  const out = clone(o);
  const notes: string[] = [];
  const free = !o.set && !SET_TOPS.has(o.top) && o.purpose !== 'work' && o.purpose !== 'occasion';
  const outdoor = OCCUPATIONS[p.occupation]?.outdoor ?? false;
  const coverHead = (kind: string) => {
    out.hat = kind;
    out.hatColour = pickOf(COLOURS.hats, r(9));
    out.styles.hat = { colour: out.hatColour, fabric: fabricFor(kind, r(10)) };
    notes.push(kind);
  };
  if (w === 'rain') {
    if (out.shoes === 'sandals') {
      out.shoes = outdoor && o.purpose === 'work' ? 'boots' : 'sneakers';
      out.shoeColour = pickOf(shoeColours(out.shoes), r(1));
      out.styles.shoes = { colour: out.shoeColour, fabric: fabricFor(out.shoes, r(2)) };
      notes.push('closed shoes');
    }
    if (free && out.top !== 'hoodie' && r(3) < 0.45) {
      out.top = 'hoodie';
      out.styles.top = { colour: out.topColour, fabric: 'fleece', condition: o.styles.top?.condition };
      notes.push('hoodie');
    }
    if (free && (out.bottom === 'shorts' || out.bottom === 'cargo_shorts')) {
      out.bottom = out.bottom === 'shorts' ? 'jeans' : 'cargo_pants';
      out.styles.bottom = { ...o.styles.bottom, fabric: fabricFor(out.bottom, r(4)), pattern: undefined };
      notes.push('long trousers');
    }
    if (!out.hat && (outdoor || r(5) < 0.4) && (!o.set || o.purpose === 'work') && !SET_TOPS.has(o.top)) coverHead(r(6) < 0.6 ? 'cap' : 'bucket_hat');
  } else if (w === 'harmattan') {
    if (free && out.top !== 'hoodie' && r(3) < 0.5) {
      out.top = 'hoodie';
      out.styles.top = { colour: out.topColour, fabric: r(7) < 0.7 ? 'fleece' : 'jersey', condition: o.styles.top?.condition };
      notes.push('hoodie');
    }
    if (free && (out.bottom === 'shorts' || out.bottom === 'cargo_shorts')) {
      out.bottom = out.bottom === 'shorts' ? 'jeans' : 'cargo_pants';
      out.styles.bottom = { ...o.styles.bottom, fabric: fabricFor(out.bottom, r(4)), pattern: undefined };
      notes.push('long trousers');
    }
    if (!out.hat && free && r(8) < 0.35) coverHead('beanie');
  } else if (w === 'hot') {
    if (free && out.top === 'hoodie' && r(18) < 0.75) {
      out.top = p.youth > 0.6 ? 'tee_oversized' : 'casual_tee';
      out.styles.top = { colour: out.topColour, fabric: 'jersey', condition: o.styles.top?.condition };
      notes.push('tee');
    }
    if (free && p.gender === 'male' && o.purpose === 'casual' && (out.bottom === 'jeans' || out.bottom === 'chinos') && r(11) < 0.3) {
      out.bottom = 'shorts';
      out.styles.bottom = { ...o.styles.bottom, fabric: fabricFor('shorts', r(12)), pattern: undefined, stitch: undefined };
      notes.push('shorts');
    }
    if (free && o.purpose === 'casual' && out.shoes === 'sneakers' && p.premium < 0.6 && r(13) < 0.25) {
      out.shoes = 'sandals';
      out.shoeColour = pickOf(COLOURS.sandals, r(14));
      out.styles.shoes = { colour: out.shoeColour, fabric: fabricFor('sandals', r(15)) };
      notes.push('slides');
    }
    if (!out.hat && outdoor && p.home.practical > 0.5 && r(16) < 0.3 && !SET_TOPS.has(o.top)) coverHead(r(17) < 0.5 ? 'bucket_hat' : 'cap');
  }
  if (!notes.length) return o;
  out.adjusted = `${w}: ${notes.join(', ')}`;
  return out;
}

// ---------------------------------------------------------------------------------------------
// The day
// ---------------------------------------------------------------------------------------------

export function dayPart(hour: number): DayPart {
  const h = ((hour % 24) + 24) % 24;
  return h >= 5 && h < 12 ? 'morning' : h >= 12 && h < 17 ? 'afternoon' : h >= 17 && h < 21 ? 'evening' : 'night';
}

/**
 * Which dressing a moment belongs to: day * 2 for the morning's, + 1 for the evening's (only for those who
 * change). The small hours belong to the night before.
 */
export function slotOf(p: WardrobeProfile, hour: number, day: number): number {
  let d = day;
  let h = hour;
  if (h < 4.5) {
    d -= 1;
    h += 24;
  }
  const evening = p.occupation === 'nightlife' || (p.changesEvening && h >= p.eveningHour);
  return d * 2 + (evening ? 1 : 0);
}

/** What a dressing is for: work on a working day, native wear on Friday or to church on Sunday, else their own */
export function purposeOf(p: WardrobeProfile, slot: number, weekdayOfSlotDay: number, works: boolean): Purpose {
  if (slot % 2 === 1) return p.goesOut ? 'evening' : 'casual';
  const info = OCCUPATIONS[p.occupation];
  const workday = works && !!info?.workdays.includes(weekdayOfSlotDay);
  if (workday) {
    if (weekdayOfSlotDay === 5 && p.nativeFriday) return 'occasion';
    return 'work';
  }
  if (weekdayOfSlotDay === 0 && p.churchgoer) return 'occasion';
  if (p.occupation === 'fitness') return 'sport';
  return 'casual';
}

/** Which of their outfits for a purpose they put on that day */
export function rotationOf(p: WardrobeProfile, purpose: Purpose, slot: number): number {
  return Math.floor(h01(p.seed ^ Math.imul(Math.floor(slot / 2) + 7, 7919), SALT[purpose] + 1) * OUTFITS_PER_PURPOSE[purpose]);
}

/** An outfit as a street look the renderer dresses */
export function toStreetLook(p: WardrobeProfile, o: NpcOutfit): StreetLook {
  const hex = (c: string) => parseInt(c.slice(1), 16);
  return {
    gender: p.gender,
    skinTone: p.skinTone,
    hairColor: p.hairColor,
    outfit: o.top,
    bottom: o.bottom,
    shoes: o.shoes,
    hat: o.hat,
    outfitColor: hex(o.topColour),
    trousersColor: hex(o.bottomColour),
    shoeColor: hex(o.shoeColour),
    hatColor: o.hat ? hex(o.hatColour) : undefined,
    styles: o.styles,
  };
}

/** Everything that tells two outfits apart (for counting how varied a crowd is) */
export function outfitSignature(o: NpcOutfit): string {
  const pat = o.styles.top?.pattern;
  return [o.top, o.bottom ?? '', o.shoes, o.hat ?? '', o.topColour, o.bottomColour, o.shoeColour, pat ? `${pat.kind}${pat.colour2 ?? ''}${pat.design ?? ''}` : ''].join('|');
}
