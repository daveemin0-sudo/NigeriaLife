import { type CharacterConfig, ATTIRE_PRESETS } from './CharacterCustomization';
import { HumanMeshBuilder, type HumanRig } from '../graphics/HumanMeshBuilder';

/**
 * Builds the body for a character's chosen look. The player and every other player seen
 * online are built the same way, so they share one set of animations.
 */
export function createHumanForConfig(config: CharacterConfig): HumanRig {
  const isFemale = config.gender === 'female';
  const attirePreset = ATTIRE_PRESETS[config.attire] || ATTIRE_PRESETS['agbada_green'];

  const outfit = config.attire === 'blue_dress'
    ? 'blue_dress'
    : config.attire === 'engineer_vest'
    ? 'engineer_vest'
    : config.attire === 'senator_navy'
    ? 'senator'
    : isFemale ? 'blue_dress' : 'engineer_vest';

  const hairstyle = config.headwear === 'hardhat'
    ? 'hardhat'
    : config.headwear === 'braids'
    ? 'braids'
    : config.headwear === 'bob_wig'
    ? 'bob_wig'
    : config.headwear === 'gele'
    ? 'gele'
    : config.headwear === 'fila_cream'
    ? 'fila'
    : isFemale ? 'bob_wig' : 'hardhat';

  return HumanMeshBuilder.createHuman({
    gender: config.gender || 'male',
    username: config.name || 'Bayo',
    skinTone: config.skinTone,
    outfit,
    outfitColor: attirePreset.color,
    hairstyle,
  });
}
