import type { CatalogueItem } from './HouseDecorationSystem';
import { BED_FINISHES, SOFA_FINISHES } from './MoreFurniture';

/**
 * Pieces for every pocket, so a first room can be furnished for little and a big house for a
 * lot: televisions from 24 to 65 inches, a foam mattress and plastic chairs, walls to split a
 * room, and every sofa and bed in several colours. Marked new so the catalogue shows them first.
 */

const SOFA_PRICE: Record<string, number> = { navy: 260000, mustard: 260000, grey: 240000, cream: 280000, leather: 420000, brown: 450000, pink: 270000, teal: 260000 };

export const EXTRA_ITEMS: CatalogueItem[] = [
  // Televisions
  { id: 'tv_24', name: '24" TV on a side table', category: 'appliances', price: 75000, icon: '📺', description: 'A small set for a first room. Football, news and music, same as any big screen.', modelType: 'tv_24', isNew: true },
  { id: 'tv_32', name: '32" LED TV', category: 'appliances', price: 120000, icon: '📺', description: 'The set most rooms in Lagos have. Sits on a small wooden table.', modelType: 'tv_32', isNew: true },
  { id: 'tv_43', name: '43" Smart TV', category: 'appliances', price: 280000, icon: '📺', description: 'Smart TV on a low console. Big enough for the whole parlour to watch the match.', modelType: 'tv_43', isNew: true },
  { id: 'tv_55', name: '55" 4K Smart TV', category: 'appliances', price: 520000, icon: '📺', description: 'Sharp 4K picture on a wide console. Nollywood like cinema.', modelType: 'tv_55', isNew: true },
  { id: 'tv_65', name: '65" QLED TV', category: 'appliances', price: 950000, icon: '📺', description: 'Very big, very bright. The neighbours will come and watch.', modelType: 'tv_65', isNew: true },

  // A first room
  { id: 'foam_mattress', name: 'Foam mattress', category: 'furniture', price: 45000, icon: '🛏️', description: 'A good foam on the floor. Where most people sleep in their first room.', modelType: 'foam_mattress', isNew: true },
  { id: 'plastic_set', name: 'Plastic table & 2 chairs', category: 'furniture', price: 22000, icon: '🪑', description: 'White plastic table and chairs. Eat, sit, receive visitors.', modelType: 'plastic_set', isNew: true },
  { id: 'plastic_set_red', name: 'Red plastic table & 2 chairs', category: 'furniture', price: 22000, icon: '🪑', description: 'The red ones from the party rental, now your own.', modelType: 'plastic_set_red', isNew: true },
  { id: 'nightstand_lamp', name: 'Bedside table & lamp', category: 'furniture', price: 38000, icon: '🛋️', description: 'Two drawers and a small lamp for reading at night.', modelType: 'nightstand', isNew: true },

  // Walls to split a room
  { id: 'partition_wall', name: 'Partition wall, 2 m', category: 'decor', price: 60000, icon: '🧱', description: 'A plastered wall to split a room. Place several end to end and turn them to make a new room.', modelType: 'partition_wall', isNew: true },
  { id: 'partition_wall_short', name: 'Partition wall, 1 m', category: 'decor', price: 35000, icon: '🧱', description: 'A short length of wall, for corners and doorways.', modelType: 'partition_wall_short', isNew: true },

  // Sofas in every colour
  ...SOFA_FINISHES.flatMap((f): CatalogueItem[] => [
    { id: `sofa3_${f.id}`, name: `3-seater sofa · ${f.name}`, category: 'furniture', price: SOFA_PRICE[f.id] ?? 260000, icon: '🛋️', description: `A full three-seater in ${f.name.toLowerCase()}. Sit on it to rest or watch TV.`, modelType: `sofa3_${f.id}`, isNew: true },
    { id: `sofa2_${f.id}`, name: `2-seater sofa · ${f.name}`, category: 'furniture', price: Math.round((SOFA_PRICE[f.id] ?? 260000) * 0.65), icon: '🛋️', description: `A loveseat in ${f.name.toLowerCase()}, for a small parlour.`, modelType: `sofa2_${f.id}`, isNew: true },
    { id: `armchair_${f.id}`, name: `Armchair · ${f.name}`, category: 'furniture', price: Math.round((SOFA_PRICE[f.id] ?? 260000) * 0.35), icon: '💺', description: `One deep armchair in ${f.name.toLowerCase()}.`, modelType: `armchair_${f.id}`, isNew: true },
  ]),

  // Beds in every colour
  ...BED_FINISHES.flatMap((f): CatalogueItem[] => [
    { id: `double_bed_${f.id}`, name: `Double bed · ${f.name}`, category: 'furniture', price: 160000, icon: '🛏️', description: `A wooden double bed made up in ${f.name.toLowerCase()}.`, modelType: `double_bed_${f.id}`, isNew: true },
    { id: `king_bed_${f.id}`, name: `King bed · ${f.name}`, category: 'furniture', price: 300000, icon: '🛏️', description: `A wide king bed made up in ${f.name.toLowerCase()}, with a tall headboard.`, modelType: `king_bed_${f.id}`, isNew: true },
  ]),
];

/** Prices that were out of line with the rest */
export const PRICE_FIXES: Record<string, number> = {
  // A 75-inch set cannot cost less than a 55-inch one
  smart_tv_75: 1650000,
};
