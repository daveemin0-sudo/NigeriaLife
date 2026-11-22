import type { FabricKind } from '../graphics/people/GarmentFabrics';

/**
 * How the player has made each garment their own: its colours, its cloth, a pattern or print, the thread,
 * and its condition. Kept apart from three other things on purpose:
 * - the clothing definitions (WARDROBE_CATALOGUE: what an item is and costs),
 * - the garment geometry and materials (the character build and GarmentFabrics),
 * - what is worn (CharacterConfig's topId / bottomId / shoesId / headwearId: the equipment).
 * A style belongs to a slot, not to an item, so the same garment model is drawn in any colour, cloth and
 * pattern with no extra geometry; saved outfits keep the equipment and the styles together.
 */

export type GarmentSlot = 'top' | 'bottom' | 'shoes' | 'hat';
export const GARMENT_SLOTS: GarmentSlot[] = ['top', 'bottom', 'shoes', 'hat'];

export type PatternKind = 'plain' | 'stripes' | 'pinstripe' | 'check' | 'camo' | 'ankara' | 'graphic' | 'logo';
export type Condition = 'clean' | 'worn' | 'dirty' | 'damaged';
export type LogoShape = 'none' | 'circle' | 'shield' | 'star' | 'badge';

export interface PatternStyle {
  kind: PatternKind;
  /** Second and third colours (stripes, check, camo, ankara; a print's ink) */
  colour2?: string;
  colour3?: string;
  /** Size of the repeat or the print, 0.5 to 2 */
  scale?: number;
  /** Stripes and checks: 0 across, 45 diagonal, 90 up and down */
  angle?: number;
  /** A print's place on the chest, -1 to 1 each way */
  x?: number;
  y?: number;
  /** A graphic print's design (GRAPHICS id) */
  design?: string;
  /** A custom logo: up to 12 letters, in a shape */
  text?: string;
  shape?: LogoShape;
}

export interface GarmentStyle {
  /** Main colour, '#rrggbb' (the item's own colour when not set) */
  colour?: string;
  /** The cloth (one the garment can be made in; its usual cloth when not set) */
  fabric?: FabricKind;
  pattern?: PatternStyle;
  /** Thread colour for the topstitching ('' or unset: the cloth's own) */
  stitch?: string;
  condition?: Condition;
}

export type ClothingStyles = Partial<Record<GarmentSlot, GarmentStyle>>;

// ------------------------------------------------------------------------------------- Accessories (prepared)
export type AccessorySlot = 'watch' | 'chain' | 'glasses' | 'bracelet' | 'belt' | 'headwear';
/** Where each accessory will be worn on the skeleton (rigid pieces on a bone), for the accessory models to come */
export const ACCESSORY_SLOTS: Record<AccessorySlot, { label: string; bone: string; colourable: boolean }> = {
  watch: { label: 'Watch', bone: 'hand_l', colourable: true },
  chain: { label: 'Chain', bone: 'neck_01', colourable: true },
  glasses: { label: 'Glasses', bone: 'head', colourable: true },
  bracelet: { label: 'Bracelet', bone: 'hand_r', colourable: true },
  belt: { label: 'Belt', bone: 'pelvis', colourable: true },
  headwear: { label: 'Headwear', bone: 'head', colourable: true },
};
export interface AccessoryChoice {
  /** The item worn (a catalogue id), and its colour */
  id: string;
  colour?: string;
}
export type Accessories = Partial<Record<AccessorySlot, AccessoryChoice>>;

// ------------------------------------------------------------------------------------- Saved outfits
export interface OutfitEquipment {
  topId?: string;
  bottomId?: string;
  shoesId?: string;
  headwearId?: string;
  bagId?: string;
  accessoryId?: string;
}
export interface SavedOutfit {
  id: string;
  name: string;
  equipment: OutfitEquipment;
  styles: ClothingStyles;
  accessories?: Accessories;
  savedAt: number;
}
export const MAX_OUTFITS = 12;

// ------------------------------------------------------------------------------------- What may go with what
/** The cloths each garment model can be made in, its usual one first */
export const FABRIC_CHOICES: Record<string, FabricKind[]> = {
  // Skirts, dresses, tunics and the robe (the first is the cloth each is built in)
  mini: ['denim', 'twill', 'cotton', 'jersey'],
  knee: ['cotton', 'twill', 'denim'],
  maxi: ['cotton', 'jersey'],
  pleated: ['twill', 'cotton'],
  pencil: ['twill', 'cotton', 'jersey'],
  iro: ['cotton', 'canvas'],
  sundress: ['cotton', 'jersey'],
  evening: ['jersey', 'cotton'],
  gown: ['cotton', 'jersey'],
  peplum: ['cotton', 'jersey'],
  buba: ['cotton', 'jersey'],
  kaftan: ['cotton', 'twill'],
  senator: ['cotton', 'twill', 'oxford'],
  agbada: ['cotton', 'twill', 'canvas'],
  gele: ['canvas', 'cotton'],
  fila: ['twill', 'cotton', 'canvas'],
  kufi: ['rib', 'cotton'],
  tee: ['jersey', 'cotton', 'pique'],
  tee_oversized: ['jersey', 'cotton', 'fleece'],
  polo: ['pique', 'jersey', 'cotton'],
  shirt: ['oxford', 'cotton', 'twill', 'denim'],
  hoodie: ['fleece', 'jersey', 'cotton'],
  jeans_slim: ['denim', 'twill', 'canvas'],
  jeans_straight: ['denim', 'twill', 'canvas'],
  jeans_baggy: ['denim', 'twill', 'canvas'],
  cargo: ['twill', 'canvas', 'denim', 'cotton'],
  chinos: ['twill', 'cotton', 'canvas'],
  shorts: ['twill', 'denim', 'canvas', 'cotton', 'jersey'],
  cargo_shorts: ['twill', 'canvas', 'denim'],
  cap: ['twill', 'canvas', 'denim', 'leather'],
  bucket: ['twill', 'canvas', 'denim', 'fleece'],
  beanie: ['rib', 'fleece', 'jersey'],
  sneaker: ['canvas', 'leather'],
  formal: ['leather'],
  boot: ['leather', 'canvas'],
  slides: ['rubber', 'leather'],
};
/** The usual cloth of a slot's plain shell (a style with no model of its own) */
export const SLOT_FABRIC: Record<GarmentSlot, FabricKind> = { top: 'cotton', bottom: 'twill', shoes: 'leather', hat: 'twill' };

export function fabricChoices(slot: GarmentSlot, variant: string): FabricKind[] {
  return FABRIC_CHOICES[variant] ?? [SLOT_FABRIC[slot]];
}

/** Patterns a garment can take: prints and logos on tops (chest) only; smooth leather and rubber stay plain */
export function patternChoices(slot: GarmentSlot, fabric: FabricKind): PatternKind[] {
  if (fabric === 'leather' || fabric === 'rubber') return ['plain'];
  const woven: PatternKind[] = ['plain', 'stripes', 'pinstripe', 'check', 'camo', 'ankara'];
  return slot === 'top' ? [...woven, 'graphic', 'logo'] : woven;
}

export const PATTERN_LABELS: Record<PatternKind, string> = {
  plain: 'Plain', stripes: 'Stripes', pinstripe: 'Pinstripe', check: 'Check', camo: 'Camouflage', ankara: 'Ankara', graphic: 'Graphic print', logo: 'Your logo',
};
export const FABRIC_LABELS: Record<FabricKind, string> = {
  jersey: 'Cotton jersey', pique: 'Piqué', oxford: 'Oxford', denim: 'Denim', twill: 'Twill', rib: 'Rib knit', fleece: 'Fleece', canvas: 'Canvas', leather: 'Leather', rubber: 'Rubber', cotton: 'Cotton',
};
export const CONDITION_LABELS: Record<Condition, string> = { clean: 'Clean', worn: 'Worn in', dirty: 'Dirty', damaged: 'Damaged' };
/** How each condition is drawn: wear fades, dirt and damage are their own */
export const CONDITION_LOOK: Record<Condition, { wear: number; dirt: number; damage: number }> = {
  clean: { wear: 0, dirt: 0, damage: 0 },
  worn: { wear: 0.55, dirt: 0.12, damage: 0 },
  dirty: { wear: 0.3, dirt: 1, damage: 0 },
  damaged: { wear: 0.7, dirt: 0.3, damage: 1 },
};

/** Original graphic prints (our own designs) */
export const GRAPHICS: { id: string; label: string }[] = [
  { id: 'eko_sun', label: 'Eko sunrise' },
  { id: 'lagos_234', label: 'Lagos 234' },
  { id: 'palm', label: 'Palm' },
  { id: 'danfo', label: 'Danfo' },
  { id: 'adire', label: 'Adire' },
  { id: 'bridge', label: 'Third Mainland' },
];
export const LOGO_SHAPES: { id: LogoShape; label: string }[] = [
  { id: 'none', label: 'Letters' }, { id: 'circle', label: 'Circle' }, { id: 'shield', label: 'Shield' }, { id: 'star', label: 'Star' }, { id: 'badge', label: 'Badge' },
];

/** Colour palettes for the swatches (the colour picker allows any colour) */
export const PALETTES: { id: string; label: string; colours: string[] }[] = [
  { id: 'everyday', label: 'Everyday', colours: ['#f8fafc', '#111827', '#6b7280', '#1e3a8a', '#1e293b', '#d6c7a1', '#7c5a3c', '#14532d'] },
  { id: 'naija', label: 'Naija brights', colours: ['#008751', '#facc15', '#ea580c', '#db2777', '#7c3aed', '#0e7490', '#b91c1c', '#16a34a'] },
  { id: 'earth', label: 'Earth', colours: ['#8b5e34', '#a16207', '#57534e', '#3f6212', '#78350f', '#c2410c', '#e7d8c9', '#44403c'] },
  { id: 'soft', label: 'Soft', colours: ['#fbcfe8', '#bfdbfe', '#bbf7d0', '#fef08a', '#e9d5ff', '#fed7aa', '#e2e8f0', '#ccfbf1'] },
  { id: 'denim', label: 'Denim', colours: ['#1e3a8a', '#2b4a7e', '#3b5b8c', '#5b7bab', '#111827', '#9ca3af', '#f8fafc', '#334155'] },
];
export const STITCH_COLOURS = ['', '#c8902e', '#f8fafc', '#111827', '#b91c1c', '#facc15', '#1e3a8a'];

// ------------------------------------------------------------------------------------- Reading saved data safely
const HEX = /^#[0-9a-f]{6}$/i;
const hex = (v: unknown): string | undefined => (typeof v === 'string' && HEX.test(v) ? v.toLowerCase() : undefined);
const num = (v: unknown, lo: number, hi: number): number | undefined => (typeof v === 'number' && Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : undefined);
const oneOf = <T extends string>(v: unknown, list: readonly T[]): T | undefined => (list.includes(v as T) ? (v as T) : undefined);
const PATTERNS: PatternKind[] = ['plain', 'stripes', 'pinstripe', 'check', 'camo', 'ankara', 'graphic', 'logo'];
const CONDITIONS: Condition[] = ['clean', 'worn', 'dirty', 'damaged'];
const FABRICS: FabricKind[] = ['jersey', 'pique', 'oxford', 'denim', 'twill', 'rib', 'fleece', 'canvas', 'leather', 'rubber', 'cotton'];
const SHAPES: LogoShape[] = ['none', 'circle', 'shield', 'star', 'badge'];

/** A style as saved, made safe (bad or old values dropped, numbers kept in range) */
export function cleanStyle(raw: unknown): GarmentStyle | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const r = raw as Record<string, unknown>;
  const out: GarmentStyle = {};
  const colour = hex(r.colour);
  if (colour) out.colour = colour;
  const fabric = oneOf(r.fabric, FABRICS);
  if (fabric) out.fabric = fabric;
  if (typeof r.stitch === 'string' && (r.stitch === '' || HEX.test(r.stitch))) out.stitch = r.stitch.toLowerCase();
  const condition = oneOf(r.condition, CONDITIONS);
  if (condition) out.condition = condition;
  const p = r.pattern as Record<string, unknown> | undefined;
  const kind = p && oneOf(p.kind, PATTERNS);
  if (p && kind) {
    out.pattern = { kind };
    const set = <K extends keyof PatternStyle>(k: K, v: PatternStyle[K] | undefined) => { if (v !== undefined) out.pattern![k] = v; };
    set('colour2', hex(p.colour2));
    set('colour3', hex(p.colour3));
    set('scale', num(p.scale, 0.5, 2));
    set('angle', num(p.angle, 0, 90));
    set('x', num(p.x, -1, 1));
    set('y', num(p.y, -1, 1));
    if (typeof p.design === 'string' && GRAPHICS.some((g) => g.id === p.design)) out.pattern.design = p.design;
    if (typeof p.text === 'string') out.pattern.text = cleanLogoText(p.text);
    set('shape', oneOf(p.shape, SHAPES));
  }
  return out;
}

export function cleanStyles(raw: unknown): ClothingStyles {
  const out: ClothingStyles = {};
  if (!raw || typeof raw !== 'object') return out;
  for (const slot of GARMENT_SLOTS) {
    const s = cleanStyle((raw as Record<string, unknown>)[slot]);
    if (s && Object.keys(s).length) out[slot] = s;
  }
  return out;
}

/** Letters, numbers, spaces and a few marks; at most 12 */
export function cleanLogoText(text: string): string {
  return text.replace(/[^A-Za-z0-9 &.!'’-]/g, '').slice(0, 12);
}

export function cleanOutfits(raw: unknown): SavedOutfit[] {
  if (!Array.isArray(raw)) return [];
  const ids = (e: Record<string, unknown>): OutfitEquipment => {
    const out: OutfitEquipment = {};
    for (const k of ['topId', 'bottomId', 'shoesId', 'headwearId', 'bagId', 'accessoryId'] as const) if (typeof e[k] === 'string') out[k] = e[k] as string;
    return out;
  };
  return raw
    .filter((o): o is Record<string, unknown> => !!o && typeof o === 'object' && typeof (o as Record<string, unknown>).id === 'string')
    .slice(0, MAX_OUTFITS)
    .map((o) => ({
      id: String(o.id).slice(0, 40),
      name: outfitName(String(o.name ?? 'Outfit')),
      equipment: ids((o.equipment as Record<string, unknown>) ?? {}),
      styles: cleanStyles(o.styles),
      accessories: (o.accessories && typeof o.accessories === 'object' ? (o.accessories as Accessories) : undefined),
      savedAt: typeof o.savedAt === 'number' ? o.savedAt : 0,
    }));
}

export function outfitName(name: string): string {
  const n = name.replace(/[<>"`]/g, '').trim().slice(0, 24);
  return n || 'Outfit';
}

// ------------------------------------------------------------------------------------- Outfits (pure: config in, config out)
interface Wearer extends OutfitEquipment {
  clothingStyles?: ClothingStyles;
  outfits?: SavedOutfit[];
  accessories?: Accessories;
  ownedClothingIds?: string[];
}

const EQUIPMENT_KEYS = ['topId', 'bottomId', 'shoesId', 'headwearId', 'bagId', 'accessoryId'] as const;

/** Saves what is worn now (items and their styles) as a new outfit; null when the wardrobe is full */
export function saveOutfit<T extends Wearer>(cfg: T, name: string, now = Date.now()): { cfg: T; outfit: SavedOutfit } | null {
  const outfits = cfg.outfits ?? [];
  if (outfits.length >= MAX_OUTFITS) return null;
  const equipment: OutfitEquipment = {};
  for (const k of EQUIPMENT_KEYS) if (cfg[k]) equipment[k] = cfg[k];
  const outfit: SavedOutfit = {
    id: `o${now.toString(36)}${Math.floor(Math.random() * 1e4).toString(36)}`,
    name: outfitName(name),
    equipment,
    styles: JSON.parse(JSON.stringify(cfg.clothingStyles ?? {})),
    accessories: cfg.accessories ? JSON.parse(JSON.stringify(cfg.accessories)) : undefined,
    savedAt: now,
  };
  return { cfg: { ...cfg, outfits: [...outfits, outfit] }, outfit };
}

/** Writes what is worn now over an existing outfit (keeping its name) */
export function updateOutfit<T extends Wearer>(cfg: T, id: string, now = Date.now()): T {
  return {
    ...cfg,
    outfits: (cfg.outfits ?? []).map((o) => {
      if (o.id !== id) return o;
      const equipment: OutfitEquipment = {};
      for (const k of EQUIPMENT_KEYS) if (cfg[k]) equipment[k] = cfg[k];
      return { ...o, equipment, styles: JSON.parse(JSON.stringify(cfg.clothingStyles ?? {})), accessories: cfg.accessories, savedAt: now };
    }),
  };
}

export function renameOutfit<T extends Wearer>(cfg: T, id: string, name: string): T {
  return { ...cfg, outfits: (cfg.outfits ?? []).map((o) => (o.id === id ? { ...o, name: outfitName(name) } : o)) };
}

export function deleteOutfit<T extends Wearer>(cfg: T, id: string): T {
  return { ...cfg, outfits: (cfg.outfits ?? []).filter((o) => o.id !== id) };
}

/**
 * Puts an outfit on: its items (only those still owned; a slot whose item is gone keeps what is worn) and
 * its styles. Returns the new config and the items that could not be worn.
 */
export function equipOutfit<T extends Wearer>(cfg: T, id: string): { cfg: T; missing: string[] } {
  const outfit = (cfg.outfits ?? []).find((o) => o.id === id);
  if (!outfit) return { cfg, missing: [] };
  const owned = new Set(cfg.ownedClothingIds ?? []);
  const next: T = { ...cfg };
  const missing: string[] = [];
  for (const k of EQUIPMENT_KEYS) {
    const want = outfit.equipment[k];
    if (want && !owned.has(want)) { missing.push(want); continue; }
    // (headwear, bags and accessories left off in the outfit come off)
    (next as OutfitEquipment)[k] = want ?? (k === 'topId' || k === 'bottomId' || k === 'shoesId' ? cfg[k] : undefined);
  }
  next.clothingStyles = JSON.parse(JSON.stringify(outfit.styles ?? {}));
  if (outfit.accessories) next.accessories = JSON.parse(JSON.stringify(outfit.accessories));
  return { cfg: next, missing };
}

/** A stable short key for a style (materials and print textures are cached by it) */
export function styleKey(s: GarmentStyle | undefined): string {
  if (!s) return '';
  const p = s.pattern;
  return [s.colour ?? '', s.fabric ?? '', s.stitch ?? '', s.condition ?? '',
    p ? [p.kind, p.colour2 ?? '', p.colour3 ?? '', p.scale ?? '', p.angle ?? '', p.x ?? '', p.y ?? '', p.design ?? '', p.text ?? '', p.shape ?? ''].join(',') : ''].join('|');
}
