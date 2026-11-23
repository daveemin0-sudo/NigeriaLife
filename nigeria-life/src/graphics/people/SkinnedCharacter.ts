import * as THREE from 'three';
import { ClothRig } from './ClothRig';
import { makePosture, POSTURE } from './Posture';
import { AssetManager } from '../../assets/AssetManager';
import { WARDROBE_CATALOGUE, type CharacterConfig } from '../../player/CharacterCustomization';
import { makeClothMaterial, makeSkinMaterial } from './CharacterSurfaces';
import type { Pattern } from './Fabrics';
import { fabricMaterial, setGarmentLines, type FabricKind } from './GarmentFabrics';
import { CONDITION_LOOK, FABRIC_CHOICES, SLOT_FABRIC, styleKey, type ClothingStyles, type GarmentSlot } from '../../player/ClothingStyle';
import type { PoseState } from '../../interactions/Poses';

/**
 * Production skinned-human runtime:
 * - Loads Mixamo / Quaternius GLBs via AssetManager (SkeletonUtils clones)
 * - AnimationMixer with cross-fades (idle / walk / run / sit)
 * - Skin + outfit colour mapping onto authored materials
 * - PersonBuilder remains the procedural fallback elsewhere
 */

export type SkinnedAnimState =
  | 'idle' | 'walk' | 'run' | 'sprint' | 'sit' | 'sit_talk' | 'drive' | 'dance' | 'talk' | 'phone_call'
  | 'interact' | 'pickup' | 'push' | 'kneel' | 'fix' | 'lie' | 'crouch_walk' | 'walk_formal';

export interface SkinnedCharacterHandle {
  root: THREE.Group;
  mixer: THREE.AnimationMixer;
  play: (state: SkinnedAnimState, fade?: number) => void;
  /** Acts out what the interaction system asks of the body (sit, lie, kneel, eat, reach, wave, ...) */
  applyPose: (pose: PoseState) => void;
  update: (delta: number) => void;
  /** Holds the action at this many seconds in, with the everyday posture and the cloth over it (for baking a still) */
  poseAt: (seconds: number) => void;
  applyAppearance: (config: CharacterConfig) => void;
  dispose: () => void;
  /** Approximate height after normalize (metres) */
  height: number;
}

const ANIM_ALIASES: Record<SkinnedAnimState, string[]> = {
  idle: ['idle', 'Idle', 'Idle_Loop', 'standing'],
  walk: ['walk', 'Walk', 'Walking', 'Walk_Forward'],
  run: ['run', 'Run', 'Running', 'Sprint'],
  sit: ['sit', 'Sit', 'SitDown', 'Sitting'],
  drive: ['drive', 'Drive', 'Driving', 'Sit', 'SitDown'],
  dance: ['dance', 'Dance', 'Victory'],
  talk: ['talk', 'Talk', 'agree', 'Talking'],
  phone_call: ['phone', 'Phone', 'talk', 'Talk', 'agree'],
  sprint: ['sprint', 'run', 'Run'],
  sit_talk: ['sit_talk', 'sit', 'Sit'],
  interact: ['interact', 'talk'],
  pickup: ['pickup', 'interact'],
  push: ['push', 'idle'],
  kneel: ['kneel', 'fix', 'sit'],
  fix: ['fix', 'kneel', 'interact'],
  lie: ['fall'],
  crouch_walk: ['crouch_walk', 'walk'],
  walk_formal: ['walk_formal', 'walk'],
};

/**
 * The clip that acts out a pose from the interaction system. Legs decide first (sitting, lying,
 * kneeling); the arms then pick among what the legs allow. Gestures the clip library does not
 * have (wave, clap, praise, takbir) use the nearest it does: a reach, or talking hands.
 */
export function clipForPose(pose: PoseState): SkinnedAnimState {
  const talking = ['talk', 'greet', 'palms', 'preach', 'praise', 'clap', 'pray', 'takbir', 'drum', 'eat'].includes(pose.arms);
  switch (pose.legs) {
    case 'walk':
      return pose.arms === 'carry' ? 'push' : 'walk';
    case 'sit':
      return talking ? 'sit_talk' : 'sit';
    case 'lie':
      return 'lie';
    case 'kneel':
      return pose.arms === 'reach' ? 'fix' : 'kneel';
    case 'bow':
      return 'pickup';
    case 'prostrate':
      return 'kneel';
    case 'dance':
      return 'dance';
    default:
      if (pose.arms === 'carry') return 'push';
      if (pose.arms === 'reach' || pose.arms === 'shake' || pose.arms === 'wave') return 'interact';
      if (talking) return 'talk';
      return 'idle';
  }
}

function findClip(actions: Map<string, THREE.AnimationAction>, state: SkinnedAnimState): THREE.AnimationAction | null {
  // An emote with no clip of its own (zanku, salute, ...) is looked up by its own name, then idle
  for (const name of ANIM_ALIASES[state] ?? [state]) {
    const hit = actions.get(name.toLowerCase());
    if (hit) return hit;
  }
  return actions.get('idle') || actions.values().next().value || null;
}

function classifyMaterial(name: string): 'skin' | 'hair' | 'cloth' | 'other' {
  const n = name.toLowerCase();
  if (/skin|body|face|flesh|arm|leg|head|beta_surface|limb/.test(n)) return 'skin';
  if (/hair|brow|beard|scalp/.test(n)) return 'hair';
  if (/cloth|shirt|pant|jean|dress|shoe|boot|jacket|tee|polo|fabric|outfit|casual|suit|mat/.test(n)) return 'cloth';
  // Quaternius multi-mesh often uses Cube004_* with generic mat names — treat non-skin as cloth
  if (/cube|material|lambert|phong|standard/.test(n)) return 'cloth';
  return 'other';
}

function outfitPattern(styleKey: string | undefined): Pattern {
  const k = (styleKey || '').toLowerCase();
  if (k.includes('polo')) return 'pique';
  if (k.includes('denim') || k.includes('jean')) return 'denim';
  if (k.includes('ankara')) return 'ankara';
  if (k.includes('aso') || k.includes('agbada') || k.includes('kaftan') || k.includes('senator')) return 'aso_oke';
  if (k.includes('gold')) return 'gold_chain';
  return 'cotton';
}

/** Normalize authored humanoids so feet sit on y=0 and height ≈ 1.75m */
function normalizeGroundAndScale(root: THREE.Group, targetHeight = 1.75): number {
  root.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(root);
  const size = new THREE.Vector3();
  box.getSize(size);
  if (size.y < 0.01) return targetHeight;
  const scale = targetHeight / size.y;
  root.scale.multiplyScalar(scale);
  root.updateMatrixWorld(true);
  const box2 = new THREE.Box3().setFromObject(root);
  root.position.y -= box2.min.y;
  return targetHeight;
}

// ---------------------------------------------------------------------------------------------
// Garment layout (docs/CHARACTER-PIPELINE.md, "Garment layout"): the body is split into pieces
// named Body_c<mask>, one mask digit per garment in GARMENTS' order. A piece is hidden when a garment
// that is shown has a 1 in its digit, so skin never shows through clothes and nothing is left bare.
/** Tops with long sleeves (a robe or gown is drawn as its long-sleeved top until flowing cloth is modelled) */
const LONG_SLEEVES = new Set(['button_shirt', 'hoodie', 'suit', 'kaftan', 'senator', 'agbada', 'ankara_gown', 'gown', 'traditional_gown', 'corporate_shirt', 'native_attire', 'boubou', 'abaya', 'hijab_dress', 'lecturer_suit', 'mechanic_overalls', 'security_uniform']);
/** Tops that come with their own bottom in the same cloth (dresses, gowns, a jumpsuit) */
const ONE_PIECE: Record<string, 'long' | 'short'> = { bodycon: 'short', ankara_gown: 'long', gown: 'long', traditional_gown: 'long', evening_gown: 'long', sundress: 'short', jumpsuit: 'long', boubou: 'long', abaya: 'long', hijab_dress: 'long', royal_dress: 'long', dress: 'short', blue_dress: 'short', mechanic_overalls: 'long', nurse_scrubs: 'long' };
/** Bottoms cut above the knee */
const SHORT_BOTTOMS = new Set(['skirt', 'peplum_skirt', 'shorts', 'cargo_shorts']);

/**
 * The garment models the build makes (Outfit_<kind>__<variant>: each its own shape, collar, cuffs, pockets),
 * and which style wears which. A style without a model of its own wears its kind's plain shell.
 */
const KINDS = ['Top_Short', 'Top_Long', 'Bottom_Long', 'Bottom_Short', 'Shoes'] as const;
const VARIANTS: Record<string, string[]> = {
  Top_Short: ['tee', 'tee_oversized', 'polo', 'peplum', 'buba'],
  Top_Long: ['shirt', 'hoodie', 'kaftan', 'senator'],
  Bottom_Long: ['jeans_slim', 'jeans_straight', 'jeans_baggy', 'cargo', 'chinos'],
  Bottom_Short: ['shorts', 'cargo_shorts'],
  Hat: ['cap', 'bucket', 'beanie', 'gele', 'fila', 'kufi'],
  Skirt: ['mini', 'knee', 'maxi', 'pleated', 'pencil', 'iro'],
  Dress: ['sundress', 'evening', 'gown'],
  Robe: ['agbada'],
  Shoes: ['sneaker', 'formal', 'boot'],
  Feet: ['slides'],
};
/** Shoes by style: in shoes (sneakers, formal shoes, boots), or bare-footed in slides */
const SHOE_VARIANT: Record<string, string> = { sneakers: 'sneaker', trainers: 'sneaker', oxfords: 'formal', loafers: 'formal', heels: 'formal', formal: 'formal', boots: 'boot' };
const FEET_VARIANT: Record<string, string> = { sandals: 'slides', slides: 'slides', slippers: 'slides' };
const TOP_VARIANT: Record<string, string> = { tshirt: 'tee', casual_tee: 'tee', jersey: 'tee', tee_oversized: 'tee_oversized', graphic_tee: 'tee_oversized', polo_shirt: 'polo', button_shirt: 'shirt', corporate_shirt: 'shirt', hoodie: 'hoodie', peplum_top: 'peplum', peplum_skirt: 'peplum', buba: 'buba', buba_iro: 'buba', kaftan: 'kaftan', senator: 'senator' };
/** Skirts (a bottom of their own: never trouser legs), dresses and gowns (one garment), the agbada (a robe over the rest) */
const SKIRT_VARIANT: Record<string, string> = { mini_skirt: 'mini', skirt: 'knee', knee_skirt: 'knee', peplum_skirt: 'knee', maxi_skirt: 'maxi', long_skirt: 'maxi', pleated_skirt: 'pleated', pencil_skirt: 'pencil', iro: 'iro' };
const DRESS_VARIANT: Record<string, string> = { sundress: 'sundress', dress: 'sundress', blue_dress: 'sundress', bodycon: 'sundress', evening_gown: 'evening', ankara_gown: 'gown', gown: 'gown', traditional_gown: 'gown', royal_dress: 'gown', boubou: 'gown' };
const ROBE_VARIANT: Record<string, string> = { agbada: 'agbada' };
/** Cut for the men's body. On a woman the plain long-sleeved top is drawn until women's cuts exist; the item, what she owns and her saved outfits stay as they are */
const MENS_CUT = new Set(['agbada', 'kaftan', 'senator']);
/** How far each skirt reaches (what of the legs it covers): a mini covers none of the leg pieces */
const SKIRT_LEGS: Record<string, 'long' | 'short' | 'none'> = { mini: 'none', knee: 'short', pleated: 'short', pencil: 'short', maxi: 'long', iro: 'long' };
const BOTTOM_VARIANT: Record<string, string> = { jeans: 'jeans_straight', jeans_slim: 'jeans_slim', jeans_straight: 'jeans_straight', jeans_baggy: 'jeans_baggy', cargo_pants: 'cargo', trousers: 'chinos', chinos: 'chinos', shorts: 'shorts', cargo_shorts: 'cargo_shorts' };
const HAT_VARIANT: Record<string, string> = { cap: 'cap', bucket_hat: 'bucket', beanie: 'beanie', gele: 'gele', fila: 'fila', kufi: 'kufi' };

/** The garment a part of the model belongs to (its own node, or the node it is a part of; low-detail copies too) */
export function garmentOf(obj: THREE.Object3D): { kind: string; variant: string } | null {
  for (const o of [obj, obj.parent]) {
    const m = o ? /^(?:LOD_)?Outfit_(Top_Short|Top_Long|Bottom_Long|Bottom_Short|Shoes|Hat|Feet|Skirt|Dress|Robe)(?:__([a-z_]+))?$/.exec(o.name) : null;
    if (m) return { kind: m[1], variant: m[2] ?? '' };
  }
  return null;
}

/** Is this garment (kind, variant) worn in this dress? */
export function wears(dress: Dress, garment: { kind: string; variant: string }): boolean {
  if (garment.kind === 'Hat') return !!dress.variants.hat && garment.variant === dress.variants.hat;
  if (garment.kind === 'Feet') return !!dress.variants.feet && garment.variant === dress.variants.feet;
  if (garment.kind === 'Skirt') return !!dress.variants.skirt && garment.variant === dress.variants.skirt;
  if (garment.kind === 'Dress') return !!dress.variants.dress && garment.variant === dress.variants.dress;
  if (garment.kind === 'Robe') return !!dress.variants.robe && garment.variant === dress.variants.robe;
  // Under a dress no top or trousers; under a skirt no trouser legs (the body under them is still hidden by `shown`)
  if (dress.variants.dress && (garment.kind.startsWith('Top') || garment.kind.startsWith('Bottom'))) return false;
  if (dress.variants.skirt && garment.kind.startsWith('Bottom')) return false;
  const i = KINDS.indexOf(garment.kind as (typeof KINDS)[number]);
  if (i < 0 || !dress.shown[i]) return false;
  const want = garment.kind.startsWith('Top') ? dress.variants.top : garment.kind.startsWith('Bottom') ? dress.variants.bottom : garment.kind === 'Shoes' ? dress.variants.shoes : '';
  const modelled = !!want && (VARIANTS[garment.kind] ?? []).includes(want);
  return modelled ? garment.variant === want : garment.variant === '';
}
/** The skin colour the build bakes in, and the tone it stands for: other tones scale from it */
const BAKED_SKIN = new THREE.Color(0.62, 0.44, 0.33);
const BAKED_TONE = new THREE.Color('#7a4b33');

/** What someone wears, resolved: from the player's wardrobe or from a street person's look */
interface Garments {
  topStyle: string;
  topHex: number;
  bottomStyle: string;
  bottomHex: number;
  shoesHex: number;
  skinTone?: string;
  hairColor?: string;
  /** Headwear (cap, bucket_hat, beanie) and its colour, if any */
  hatStyle?: string;
  /** Footwear style (sneakers, oxfords, loafers, boots, sandals...) */
  shoesStyle?: string;
  hatHex?: number;
  /** The wearer's own colours, cloth, patterns, thread and condition per slot (the player's customisation) */
  styles?: ClothingStyles;
}

/** A street person's look (the crowd's HumanConfig fields the skinned model can show) */
export interface StreetLook {
  gender: 'male' | 'female';
  skinTone?: string;
  hairColor?: string;
  outfit?: string;
  outfitColor?: number;
  trousersColor?: number;
  shoeColor?: number;
  /** What is worn below (jeans, jeans_slim, jeans_baggy, cargo_pants, chinos, shorts, cargo_shorts) and on the head */
  bottom?: string;
  hat?: string;
  hatColor?: number;
  /** Footwear style (sneakers, oxfords, loafers, boots, sandals) */
  shoes?: string;
  /** Customised colours, cloth, patterns, thread and condition per slot */
  styles?: ClothingStyles;
}

function applyGarmentLayout(scene: THREE.Object3D, cfg: CharacterConfig, gender: 'male' | 'female'): void {
  const find = (id?: string) => (id ? WARDROBE_CATALOGUE.find((i) => i.id === id) : undefined);
  const top = find(cfg.topId);
  const bottom = find(cfg.bottomId);
  const shoes = find(cfg.shoesId);
  const hat = find(cfg.headwearId);
  applyGarments(scene, {
    topStyle: top?.styleKey ?? '',
    topHex: top?.color ?? 0xf8fafc,
    bottomStyle: bottom?.styleKey ?? '',
    bottomHex: bottom?.color ?? (typeof cfg.trousersColor === 'string' ? new THREE.Color(cfg.trousersColor).getHex() : 0x1e293b),
    shoesHex: shoes?.color ?? 0x111827,
    shoesStyle: shoes?.styleKey,
    hatStyle: hat?.styleKey,
    hatHex: hat?.color,
    skinTone: cfg.skinTone,
    hairColor: cfg.hairColor,
    styles: cfg.clothingStyles,
  }, gender);
}

/** The garment models the player's items come to (top, bottom, shoes or bare feet in slides, hat; '' for a plain shell or none) */
export function playerGarments(cfg: CharacterConfig): { top: string; bottom: string; shoes: string; hat: string; onePiece: boolean } {
  const find = (id?: string) => (id ? WARDROBE_CATALOGUE.find((i) => i.id === id) : undefined);
  const top = find(cfg.topId)?.styleKey ?? '';
  const d = dressOf({ topStyle: top, topHex: 0, bottomStyle: find(cfg.bottomId)?.styleKey ?? '', bottomHex: 0, shoesHex: 0, shoesStyle: find(cfg.shoesId)?.styleKey, hatStyle: find(cfg.headwearId)?.styleKey }, cfg.gender === 'female' ? 'female' : 'male');
  return { top: d.variants.dress || d.variants.robe || d.variants.top, bottom: d.variants.skirt || d.variants.bottom, shoes: d.variants.feet || d.variants.shoes, hat: d.variants.hat, onePiece: !!ONE_PIECE[top] || !!d.variants.dress };
}

/** Dresses a skinned model as a street person looks (their outfit style and colours) */
export function applyStreetLook(scene: THREE.Object3D, look: StreetLook): void {
  applyGarments(scene, streetGarments(look), look.gender);
}

/** What a look comes to on the model: which garments show (in GARMENTS order) and each part's colour */
export interface Dress {
  shown: boolean[];
  /** The garment models worn on top, below and on the head ('' for a kind's plain shell, or none) */
  variants: { top: string; bottom: string; hat: string; shoes: string; feet: string; skirt: string; dress: string; robe: string };
  /** Everything about the cut of the clothes, as one key (the same key, the same garments) */
  key: string;
  hatColour: THREE.Color;
  /** The garments shown, as the 5-digit mask the build writes (TopShort TopLong BottomLong BottomShort Shoes) */
  mask: string;
  skin: THREE.Color;
  hair: THREE.Color;
  top: THREE.Color;
  bottom: THREE.Color;
  shoes: THREE.Color;
}

/** A slot's colour: the wearer's own if they set one, else the item's */
const styledHex = (g: Garments, slot: GarmentSlot, hex: number | undefined): number | undefined => {
  const c = g.styles?.[slot]?.colour;
  return c ? parseInt(c.slice(1), 16) : hex;
};

function dressOf(raw: Garments, gender: 'male' | 'female'): Dress {
  const g: Garments = raw.styles
    ? { ...raw, topHex: styledHex(raw, 'top', raw.topHex)!, bottomHex: styledHex(raw, 'bottom', raw.bottomHex)!, shoesHex: styledHex(raw, 'shoes', raw.shoesHex)!, hatHex: styledHex(raw, 'hat', raw.hatHex) }
    : raw;
  const onePiece = ONE_PIECE[g.topStyle];
  const dressV = DRESS_VARIANT[g.topStyle] ?? '';
  // An old buba-and-iro look is the buba over its wrapper
  const skirtV = dressV || (onePiece && !dressV) ? '' : SKIRT_VARIANT[g.topStyle === 'buba_iro' ? 'iro' : g.bottomStyle] ?? '';
  const plainTop = gender === 'female' && MENS_CUT.has(g.topStyle);
  const robeV = plainTop ? '' : ROBE_VARIANT[g.topStyle] ?? '';
  const sleeves: 'short' | 'long' | 'none' = dressV === 'evening' ? 'none' : LONG_SLEEVES.has(g.topStyle) ? 'long' : 'short';
  const legs: 'long' | 'short' | 'none' = dressV ? (dressV === 'sundress' ? 'short' : 'long') : skirtV ? SKIRT_LEGS[skirtV] : onePiece ?? (SHORT_BOTTOMS.has(g.bottomStyle) ? 'short' : 'long');
  const feet = FEET_VARIANT[g.shoesStyle ?? ''] ?? '';
  // In slides the feet are bare (no shoes drawn, the foot itself seen)
  const shown = [sleeves === 'short', sleeves === 'long', legs === 'long', legs === 'short', !feet];
  const variants = {
    top: dressV || plainTop ? '' : TOP_VARIANT[g.topStyle] ?? '',
    bottom: onePiece || dressV || skirtV ? '' : BOTTOM_VARIANT[g.bottomStyle] ?? '',
    hat: HAT_VARIANT[g.hatStyle ?? ''] ?? '',
    shoes: SHOE_VARIANT[g.shoesStyle ?? ''] ?? '',
    feet,
    skirt: skirtV,
    dress: dressV,
    robe: robeV,
  };
  const mask = shown.map((b) => (b ? '1' : '0')).join('');
  return {
    shown,
    variants,
    key: `${mask}|${variants.top}|${variants.bottom}|${variants.hat}|${variants.shoes}|${variants.feet}|${skirtV}|${dressV}|${robeV}`,
    hatColour: new THREE.Color(g.hatHex ?? 0x111827),
    mask,
    skin: new THREE.Color(g.skinTone || (gender === 'female' ? '#7a4b33' : '#5c3a28')),
    hair: new THREE.Color(g.hairColor || '#0b0908'),
    top: new THREE.Color(g.topHex),
    bottom: new THREE.Color(onePiece ? g.topHex : g.bottomHex),
    shoes: new THREE.Color(g.shoesHex),
  };
}

const streetGarments = (look: StreetLook): Garments => ({
  topStyle: look.outfit ?? '',
  topHex: look.outfitColor ?? 0xf8fafc,
  // A skirt outfit is a top over a skirt; otherwise what they wear below, if it is said
  bottomStyle: SHORT_BOTTOMS.has(look.outfit ?? '') ? look.outfit! : look.bottom ?? '',
  hatStyle: look.hat,
  hatHex: look.hatColor,
  shoesStyle: look.shoes,
  bottomHex: look.trousersColor ?? look.outfitColor ?? 0x1e293b,
  shoesHex: look.shoeColor ?? 0x111827,
  skinTone: look.skinTone,
  hairColor: look.hairColor,
  styles: look.styles,
});

/** A street person's look as the model shows it (for drawing them without a model of their own, far off) */
export function streetDress(look: StreetLook): Dress {
  return dressOf(streetGarments(look), look.gender);
}

/**
 * Garment materials already made, by everything that decides them (the body, the cut of the whole dress, the
 * part's own material and the look on it): people dressed alike share them, and dressing someone again in a
 * look seen before makes nothing new. Kept to a bounded number, the least recently used let go.
 */
const MATERIALS = new Map<string, THREE.Material>();
const MATERIALS_KEPT = 600;
function cachedMaterial(key: string, make: () => THREE.Material): THREE.Material {
  const hit = MATERIALS.get(key);
  if (hit) {
    MATERIALS.delete(key);
    MATERIALS.set(key, hit);
    return hit;
  }
  const m = make();
  MATERIALS.set(key, m);
  if (MATERIALS.size > MATERIALS_KEPT) MATERIALS.delete(MATERIALS.keys().next().value as string);
  return m;
}
/** How many garment materials are kept (for the tests) */
export function garmentMaterialsKept(): number {
  return MATERIALS.size;
}

/** The slot each cloth role belongs to */
const ROLE_SLOT: Record<string, GarmentSlot> = { Cloth_Top: 'top', Cloth_Bottom: 'bottom', Cloth_Shoes: 'shoes', Sole: 'shoes', Cloth_Hat: 'hat' };

function applyGarments(scene: THREE.Object3D, g: Garments, gender: 'male' | 'female'): void {
  const dress = dressOf(g, gender);
  const onePiece = ONE_PIECE[g.topStyle];
  const topHex = dress.top.getHex();
  const bottomHex = onePiece ? topHex : dress.bottom.getHex();
  const shoesHex = dress.shoes.getHex();
  // The garment model worn in each slot, and its usual cloth (the parts in that cloth are the garment's body;
  // others, such as rib collars and cuffs, are its trims)
  const variantOf: Record<GarmentSlot, string> = { top: dress.variants.dress || dress.variants.robe || dress.variants.top, bottom: dress.variants.skirt || dress.variants.bottom, shoes: dress.variants.feet || dress.variants.shoes, hat: dress.variants.hat };
  const mainFabric = (slot: GarmentSlot): FabricKind => FABRIC_CHOICES[variantOf[slot]]?.[0] ?? SLOT_FABRIC[slot];

  // Skin: the player's tone, scaled from the tone the build's colour stands for
  const tone = new THREE.Color(g.skinTone || (gender === 'female' ? '#7a4b33' : '#5c3a28'));
  const skinMul = new THREE.Color(
    Math.min(1, (BAKED_SKIN.r * tone.r) / BAKED_TONE.r),
    Math.min(1, (BAKED_SKIN.g * tone.g) / BAKED_TONE.g),
    Math.min(1, (BAKED_SKIN.b * tone.b) / BAKED_TONE.b),
  );
  const hair = new THREE.Color(g.hairColor || '#0b0908');

  // One material per role, shared by every piece that uses it (the pieces were cloned with the scene)
  const made = new Map<string, THREE.Material>();
  // Cloth by fabric: each part names its cloth (Cloth_Top:pique, Cloth_Bottom:denim...); a plain shell takes its kind's usual one
  const DEFAULT_FABRIC: Record<string, FabricKind> = { Cloth_Top: 'cotton', Cloth_Bottom: 'twill', Cloth_Hat: 'twill', Cloth_Shoes: 'leather', Sole: 'rubber' };
  const colourOf: Record<string, THREE.Color> = {
    Cloth_Top: new THREE.Color(topHex),
    Cloth_Bottom: new THREE.Color(bottomHex),
    Cloth_Hat: dress.hatColour,
    Cloth_Shoes: new THREE.Color(shoesHex),
  };
  const restyle = (m: THREE.Material): THREE.Material => {
    const hit = made.get(m.name);
    if (hit) return hit;
    const [role, kind] = m.name.split(':');
    let next: THREE.Material;
    if (role in DEFAULT_FABRIC) {
      const builtFabric = (kind as FabricKind) || DEFAULT_FABRIC[role];
      const slot = ROLE_SLOT[role];
      const style = g.styles?.[slot];
      // The garment's body takes the chosen cloth, pattern and thread; trims keep their cloth, in the garment's colour
      const body = role !== 'Sole' && builtFabric === mainFabric(slot);
      const choices = FABRIC_CHOICES[variantOf[slot]] ?? [SLOT_FABRIC[slot]];
      const fabric = body && style?.fabric && choices.includes(style.fabric) ? style.fabric : builtFabric;
      // A sole is white rubber or dark leather, whatever the shoe's colour
      const colour = role === 'Sole' ? new THREE.Color(builtFabric === 'leather' ? 0x2a1d14 : 0xeeeeea) : colourOf[role];
      const condition = CONDITION_LOOK[style?.condition ?? 'clean'];
      const look = {
        kind: fabric,
        colour,
        stitch: body && style?.stitch ? new THREE.Color(style.stitch) : undefined,
        wear: condition.wear,
        dirt: condition.dirt,
        damage: role === 'Sole' ? 0 : condition.damage,
        pattern: body && style?.pattern && style.pattern.kind !== 'plain' && fabric !== 'leather' && fabric !== 'rubber' ? style.pattern : undefined,
      };
      const key = `${gender}|${dress.key}|${m.name}|${colour.getHexString()}|${body ? styleKey(style) : `trim|${style?.condition ?? ''}`}`;
      next = cachedMaterial(key, () => fabricMaterial(m, look));
    } else {
      // Skin and hair by their colour, anything else as it is: shared by everyone who looks the same
      const tint = m.name === 'Skin_Body' ? skinMul : m.name === 'Hair' ? hair : null;
      next = cachedMaterial(`plain|${m.name}|${tint ? tint.getHexString() : ''}`, () => {
        const plain = m.clone() as THREE.MeshStandardMaterial;
        if (tint) plain.color.copy(tint);
        return plain;
      });
    }
    made.set(m.name, next);
    return next;
  };

  scene.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    // The garments worn (never the low-detail copies: those are only baked), the body pieces they do not cover,
    // and the hair under a hat
    const lod = obj.name.startsWith('LOD_') || !!obj.parent?.name.startsWith('LOD_');
    const garment = lod ? null : garmentOf(obj);
    if (garment && /^Outfit_/.test(obj.name)) obj.visible = wears(dress, garment);
    const piece = /^Body_c([01]{5})$/.exec(obj.name);
    if (piece) obj.visible = ![...piece[1]].some((bit, i) => bit === '1' && dress.shown[i]);
    if (/^Hair/.test(obj.name)) obj.visible = !dress.variants.hat;
    if (!mesh.isMesh || !mesh.material) return;
    mesh.material = Array.isArray(mesh.material) ? mesh.material.map(restyle) : restyle(mesh.material);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
  });
  // Where each worn garment's hems and sleeve ends are, so its stitching runs along them
  scene.traverse((obj) => {
    const mesh = obj as THREE.SkinnedMesh;
    if (!mesh.isSkinnedMesh || !mesh.visible || obj.name.startsWith('LOD_')) return;
    const garment = garmentOf(obj);
    if (!garment) return;
    const lines = linesOf(mesh, garment.kind);
    for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) setGarmentLines(material, lines);
  });
}

/** Where a garment's hem and sleeve ends are, from its shape at rest; knees and hips from the skeleton (kept on the geometry) */
function linesOf(mesh: THREE.SkinnedMesh, kind: string) {
  const geo = mesh.geometry;
  const bones = mesh.skeleton?.bones ?? [];
  const bind = (name: string): THREE.Vector3 | null => {
    const i = bones.findIndex((b) => b.name === name);
    return i < 0 ? null : new THREE.Vector3().setFromMatrixPosition(mesh.skeleton.boneInverses[i].clone().invert());
  };
  let shape = geo.userData.garmentShape as { minY: number; maxX: number } | undefined;
  if (!shape) {
    const pos = geo.getAttribute('position');
    let minY = Infinity, maxX = 0;
    for (let i = 0; i < pos.count; i++) {
      minY = Math.min(minY, pos.getY(i));
      maxX = Math.max(maxX, Math.abs(pos.getX(i)));
    }
    shape = { minY, maxX };
    geo.userData.garmentShape = shape;
  }
  const shoulder = bind('upperarm_l') ?? bind('upperarm_r');
  const elbow = bind('lowerarm_l') ?? bind('lowerarm_r');
  const knee = bind('calf_l');
  const chest = bind('spine_03');
  const neck = bind('neck_01');
  const hip = bind('thigh_l');
  const top = kind.startsWith('Top');
  // Skirts, dresses and robes hem at their lowest edge, as trousers do
  const bottom = kind.startsWith('Bottom') || kind === 'Skirt' || kind === 'Dress' || kind === 'Robe';
  // A shoe's sole is this thick (sneakers thick rubber, formal shoes a thin leather sole), at rest
  const soleThickness: Record<string, number> = { sneaker: 0.029, formal: 0.015, boot: 0.022 };
  const variant = garmentOf(mesh)?.variant ?? '';
  return {
    hemY: top || bottom ? shape.minY : -1000,
    // (a ribbed cuff finishes a hoodie's sleeve: no hem stitching under it, which would show inside a bent arm's cuff)
    sleeveX: top && variant !== 'hoodie' ? shape.maxX : -1,
    elbowX: kind === 'Top_Long' && elbow ? Math.abs(elbow.x) : -1,
    // (the shell's lowest point is under the ground by the shoe's own thickness, about 4 cm)
    soleY: kind === 'Shoes' ? shape.minY + 0.042 + (soleThickness[variant] ?? 0.02) : -1000,
    shoulderX: shoulder ? Math.abs(shoulder.x) : 10,
    // A chest print sits a little below the collarbones
    chestY: chest && neck ? chest.y + (neck.y - chest.y) * 0.45 : undefined,
    noSideSeam: kind === 'Skirt' || kind === 'Dress' || kind === 'Robe',
    // (knee creases are for trouser legs: a skirt, gown or robe hangs free of the knee)
    kneeY: kind === 'Skirt' || kind === 'Dress' || kind === 'Robe' ? -1000 : knee?.y ?? 0.5,
    hipY: hip?.y ?? 0.95,
  };
}

/**
 * Load a gender-specific skinned human GLB. Returns null if the asset is missing
 * (caller should keep PersonBuilder visible).
 */
export async function loadSkinnedCharacter(
  gender: 'male' | 'female',
  config: CharacterConfig,
): Promise<SkinnedCharacterHandle | null> {
  const url = `/models/characters/human_${gender}.glb`;
  const scene = await AssetManager.getInstance().instantiate(url);
  if (!scene) return null;

  const root = new THREE.Group();
  root.name = `skinned_${gender}`;
  root.add(scene);

  // Strip pack props (guns, bats, etc.) — keep only the skinned body. The far-away copies (LOD_) are
  // never drawn on a model: BakedPeople bakes them into posed frames.
  scene.traverse((obj) => {
    if (obj.name.startsWith('LOD_')) {
      obj.visible = false;
      return;
    }
    const mesh = obj as THREE.Mesh;
    if (!mesh.isMesh) return;
    if (mesh.type === 'SkinnedMesh') return;
    const n = mesh.name.toLowerCase();
    if (/axe|guitar|knife|pistol|rifle|shotgun|smg|spear|bat|gun|weapon|sword|shield/.test(n)) {
      mesh.visible = false;
    }
  });

  // An everyday posture (shoulders and hips brought in, set before the body is measured)
  const posture = makePosture(root, scene, POSTURE[gender === 'female' ? 'female' : 'male']);
  // Hanging cloth (skirts, gowns, tunics, the agbada) follows the legs through its own bones, after the posture
  const clothRig = ClothRig.attach(scene);
  const height = normalizeGroundAndScale(root, gender === 'female' ? 1.68 : 1.78);

  const mixer = new THREE.AnimationMixer(scene);
  const actions = new Map<string, THREE.AnimationAction>();
  const clips: THREE.AnimationClip[] = scene.userData.animations || [];
  for (const clip of clips) {
    actions.set(clip.name.toLowerCase(), mixer.clipAction(clip));
  }

  // Lying down is the end of the fall clip, held: where its feet end up is measured once, so a
  // sleeper's feet can be put where the bed asks (the interaction system puts the root at the feet)
  const lieFeet = new THREE.Vector3();
  const fall = actions.get('fall');
  if (fall) {
    fall.setLoop(THREE.LoopOnce, 1);
    fall.clampWhenFinished = true;
    fall.reset().setEffectiveWeight(1).play();
    fall.time = fall.getClip().duration;
    mixer.update(0);
    scene.updateMatrixWorld(true);
    const l = scene.getObjectByName('foot_l'), r = scene.getObjectByName('foot_r');
    if (l && r) {
      const a = root.worldToLocal(l.getWorldPosition(new THREE.Vector3()));
      const b = root.worldToLocal(r.getWorldPosition(new THREE.Vector3()));
      lieFeet.set((a.x + b.x) / 2, 0, (a.z + b.z) / 2);
    }
    fall.stop();
  }
  const groundY = root.position.y;

  let current: THREE.AnimationAction | null = null;
  let currentState: string = 'idle';
  const play = (state: SkinnedAnimState, fade = 0.25) => {
    const next = findClip(actions, state);
    if (!next || next === current) return;
    currentState = next.getClip().name.toLowerCase();
    next.reset().setEffectiveTimeScale(1).setEffectiveWeight(1).fadeIn(fade).play();
    if (next === fall) next.time = fall.getClip().duration; // straight to lying, held
    if (current) current.fadeOut(fade);
    current = next;
    // Lying: feet where the bed asks; any other pose stands where the body is
    scene.position.set(state === 'lie' ? -lieFeet.x / root.scale.x : 0, scene.position.y, state === 'lie' ? -lieFeet.z / root.scale.z : 0);
  };
  const applyPose = (pose: PoseState) => {
    const state = clipForPose(pose);
    play(state, 0.3);
    // A bed's mattress (or any raised surface lain on) lifts the sleeper onto it
    root.position.y = groundY + (state === 'lie' && pose.height ? pose.height : 0);
  };

  const applyAppearance = (cfg: CharacterConfig) => {
    // Universal Base Characters build (body pieces + garment shells on one skeleton): its own path
    if (scene.getObjectByName('Outfit_Top_Short')) {
      applyGarmentLayout(scene, cfg, gender);
      return;
    }
    const skinHex = cfg.skinTone || (gender === 'female' ? '#7a4b33' : '#5c3a28');
    const hairHex = cfg.hairColor || '#0b0908';
    const topItem = WARDROBE_CATALOGUE.find((i) => i.id === cfg.topId);
    const bottomItem = WARDROBE_CATALOGUE.find((i) => i.id === cfg.bottomId);
    const outfitCol = topItem?.color ?? 0x1e3a8a;
    const trousersCol =
      bottomItem?.color ??
      (typeof cfg.trousersColor === 'string' ? new THREE.Color(cfg.trousersColor).getHex() : 0x1e3a5f);
    const pattern = outfitPattern(topItem?.styleKey || cfg.attire);
    const skinMat = makeSkinMaterial(skinHex);
    const hairMat = new THREE.MeshStandardMaterial({ color: new THREE.Color(hairHex), roughness: 0.92 });
    const topMat = makeClothMaterial(outfitCol, pattern, topItem?.secondaryColor ?? 0xe5b84b);
    const bottomMat = makeClothMaterial(trousersCol, pattern === 'denim' ? 'denim' : 'cotton', trousersCol);

    let clothIndex = 0;
    const meshCount = { n: 0 };
    scene.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (!mesh.isMesh || !mesh.material) return;
      meshCount.n += 1;
      const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      const multiPart = mesh.name.startsWith('Cube') || mats.length > 1;
      const replaced = mats.map((m, i) => {
        const name = `${mesh.name}|${(m as THREE.Material).name || ''}|${i}`;
        const kind = classifyMaterial(name);
        const hasMap = !!(m as THREE.MeshStandardMaterial).map;

        // Multi-mesh Quaternius bodies: swap dedicated skin/cloth mats
        if (multiPart && !hasMap) {
          if (kind === 'skin') return skinMat;
          if (kind === 'hair') return hairMat;
          clothIndex += 1;
          return clothIndex <= 2 ? topMat : bottomMat;
        }

        // Textured authored characters (e.g. Matt): keep maps, tint toward Nigerian skin / outfit
        if (m instanceof THREE.MeshStandardMaterial || m instanceof THREE.MeshPhysicalMaterial) {
          const next = m.clone();
          if (hasMap) {
            // Warm the albedo toward configured melanin without destroying authored paint
            next.color.lerp(new THREE.Color(skinHex), 0.35);
            next.roughness = Math.min(0.9, Math.max(0.45, next.roughness ?? 0.6));
            next.metalness = Math.min(next.metalness ?? 0, 0.08);
          } else if (kind === 'skin') {
            return skinMat;
          } else {
            clothIndex += 1;
            next.color.copy(new THREE.Color(clothIndex <= 2 ? outfitCol : trousersCol));
          }
          return next;
        }
        return m;
      });
      mesh.material = replaced.length === 1 ? replaced[0] : replaced;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
    });
  };

  applyAppearance(config);
  play('idle', 0);

  return {
    root,
    mixer,
    play: (state: SkinnedAnimState, fade?: number) => {
      // The game's own movement takes the body back from a pose: standing on the ground again
      root.position.y = groundY;
      play(state, fade);
    },
    applyPose,
    update: (delta: number) => {
      posture.restore();
      mixer.update(delta);
      posture.apply(currentState);
      clothRig?.apply(delta);
    },
    poseAt: (seconds: number) => {
      // This action alone, at this moment (no fade from the last one), before the posture goes over it
      posture.restore();
      if (current) {
        mixer.stopAllAction();
        current.reset().setEffectiveTimeScale(1).setEffectiveWeight(1).play();
        current.time = seconds;
        mixer.update(0);
      }
      posture.apply(currentState);
      clothRig?.apply();
    },
    applyAppearance,
    dispose: () => {
      mixer.stopAllAction();
      root.traverse((o) => {
        const m = o as THREE.Mesh;
        if (m.isMesh) {
          m.geometry?.dispose?.();
        }
      });
    },
    height,
  };
}
