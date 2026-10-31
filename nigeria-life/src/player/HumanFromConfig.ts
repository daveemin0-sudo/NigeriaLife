import {
  type CharacterConfig,
  ATTIRE_PRESETS,
  type AttireStyle,
  WARDROBE_CATALOGUE,
} from './CharacterCustomization';
import { HumanMeshBuilder, type HumanRig, type Outfit, type Hairstyle } from '../graphics/HumanMeshBuilder';

/**
 * Builds the body for a character's chosen look. Supports both legacy attire presets
 * and the complete modular wardrobe system (independently selectable tops, bottoms,
 * shoes, headwear, bags, and accessories).
 */
export function createHumanForConfig(config: CharacterConfig): HumanRig {
  const isFemale = config.gender === 'female';

  // 1. Resolve Modular Top / Outfit
  let outfit: Outfit = isFemale ? 'blue_dress' : 'agbada';
  let outfitColor = isFemale ? 0x2563eb : 0x008751;

  let topSecond: number | undefined;
  if (config.topId) {
    const topItem = WARDROBE_CATALOGUE.find((i) => i.id === config.topId);
    if (topItem) {
      outfit = topItem.styleKey as Outfit;
      outfitColor = topItem.color;
      topSecond = topItem.secondaryColor;
    }
  } else {
    const rawAttire = (config.attire as string || '').toLowerCase().replace(/[\s_-]+/g, '');
    const attirePreset =
      ATTIRE_PRESETS[config.attire] ||
      ATTIRE_PRESETS[rawAttire as AttireStyle] ||
      ATTIRE_PRESETS['agbada_green'];

    outfitColor = attirePreset.color;
    if (rawAttire === 'agbadagreen' || rawAttire === 'agbada') {
      outfit = 'agbada';
    } else if (rawAttire === 'senatornavy' || rawAttire === 'senator' || rawAttire === 'whitegold' || rawAttire === 'white_gold') {
      outfit = 'senator';
    } else if (rawAttire === 'supereagles' || rawAttire === 'super_eagles') {
      outfit = 'casual_tee';
    } else if (rawAttire === 'ankaragold' || rawAttire === 'ankara_gold') {
      outfit = 'agbada';
    } else if (rawAttire === 'engineervest' || rawAttire === 'engineer_vest') {
      outfit = 'engineer_vest';
    } else if (rawAttire === 'bluedress' || rawAttire === 'blue_dress') {
      outfit = 'blue_dress';
    } else if (rawAttire === 'peplumgown' || rawAttire === 'peplum_gown' || rawAttire === 'peplumskirt' || rawAttire === 'peplum_skirt' || rawAttire === 'ankaraskirt' || rawAttire === 'ankara_skirt') {
      outfit = 'peplum_skirt';
    } else {
      outfit = isFemale ? 'blue_dress' : 'agbada';
    }
  }

  // 2. Resolve Modular Bottoms / Trousers
  let trousersHex = 0xffffff;
  if (config.bottomId) {
    const bottomItem = WARDROBE_CATALOGUE.find((i) => i.id === config.bottomId);
    if (bottomItem) {
      trousersHex = bottomItem.color;
    }
  } else if (config.trousersColor) {
    const parsed = parseInt(config.trousersColor.replace('#', '0x'), 16);
    if (!Number.isNaN(parsed)) trousersHex = parsed;
  }

  // 3. Resolve Modular Shoes / Footwear
  let shoeColor: number | undefined;
  let shoeStyle: any = isFemale ? 'heels' : 'loafers';
  if (config.shoesId) {
    const shoeItem = WARDROBE_CATALOGUE.find((i) => i.id === config.shoesId);
    if (shoeItem) {
      shoeColor = shoeItem.color;
      shoeStyle = shoeItem.styleKey;
    }
  }

  // 4. Resolve Modular Headwear & Hair
  let hairstyle: Hairstyle = isFemale ? 'bob_wig' : 'fila';
  let hairColor = '#171717';

  if (config.headwearId) {
    const headItem = WARDROBE_CATALOGUE.find((i) => i.id === config.headwearId);
    if (headItem) {
      hairstyle = headItem.styleKey as Hairstyle;
      hairColor = '#' + headItem.color.toString(16).padStart(6, '0');
    }
  } else {
    const rawHeadwear = (config.headwear as string || '').toLowerCase().replace(/[\s_-]+/g, '');
    if (rawHeadwear === 'filacream' || rawHeadwear === 'fila') {
      hairstyle = 'fila';
      hairColor = '#fef08a';
    } else if (rawHeadwear === 'igboredcap') {
      hairstyle = 'fila';
      hairColor = '#dc2626';
    } else if (rawHeadwear === 'afrohair' || rawHeadwear === 'afro') {
      hairstyle = 'afro';
    } else if (rawHeadwear === 'braids') {
      hairstyle = 'braids';
    } else if (rawHeadwear === 'bobwig' || rawHeadwear === 'bob_wig') {
      hairstyle = 'bob_wig';
    } else if (rawHeadwear === 'gele') {
      hairstyle = 'gele';
    } else if (rawHeadwear === 'hardhat') {
      hairstyle = 'hardhat';
    } else if (rawHeadwear === 'none') {
      hairstyle = 'fade';
    }
  }

  // 5. Resolve Modular Bags & Backpacks
  let bagStyle: any = 'none';
  let bagColor: number | undefined;
  if (config.bagId) {
    const bagItem = WARDROBE_CATALOGUE.find((i) => i.id === config.bagId);
    if (bagItem) {
      bagStyle = bagItem.styleKey;
      bagColor = bagItem.color;
    }
  }

  // 6. Resolve Accessories (Shades, Gold Chain, Coral Beads)
  let hasShades = Boolean(config.hasShades);
  let hasGoldChain = Boolean(config.hasGoldChain);
  let hasCoralBeads = Boolean(config.hasCoralBeads);

  if (config.accessoryId === 'acc_designer_shades') hasShades = true;
  if (config.accessoryId === 'acc_cuban_chain') hasGoldChain = true;
  if (config.accessoryId === 'acc_coral_beads') hasCoralBeads = true;

  // What is worn on the head: a hat over the hair, or a hairstyle (the wardrobe's names for them)
  const HEADWEAR: Record<string, { hat?: 'fila' | 'gele' | 'hardhat' | 'cap'; hair?: Hairstyle }> = {
    fila_cream: { hat: 'fila' }, fila: { hat: 'fila' }, igbo_red_cap: { hat: 'fila' }, gele: { hat: 'gele' }, hardhat: { hat: 'hardhat' },
    afro_hair: { hair: 'afro' }, afro: { hair: 'afro' }, braids: { hair: 'box_braids' }, bob_wig: { hair: 'bob_wig' },
  };
  const worn = HEADWEAR[hairstyle] ?? (hairstyle === 'fade' ? {} : { hair: hairstyle });
  const hairChosen = (config.hair as Hairstyle | undefined) ?? worn.hair ?? (isFemale ? 'box_braids' : 'low_cut');
  const hatColour = worn.hat ? parseInt(hairColor.slice(1), 16) : undefined;
  hairstyle = worn.hat ?? hairChosen;
  hairColor = config.hairColor ?? '#0b0908';

  return HumanMeshBuilder.createHuman({
    gender: config.gender || 'male',
    username: config.name || 'Bayo',
    skinTone: config.skinTone,
    outfit,
    outfitColor,
    trousersColor: trousersHex,
    shoeColor,
    shoeStyle,
    bagStyle,
    bagColor,
    hairstyle,
    hair: hairChosen,
    hairColor,
    hatColor: hatColour,
    headShape: config.headShape,
    beard: config.gender === 'male' ? config.beard : 'none',
    build: config.build,
    secondaryColor: topSecond,
    accentColor: topSecond,
    hasShades,
    hasGoldChain,
    hasCoralBeads,
  });
}

