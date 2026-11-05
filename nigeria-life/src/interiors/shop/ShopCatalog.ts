import type { Item } from '../../backend/types';

/** How a product looks on the shelf and in the basket. */
export type ProductShape = 'box' | 'bottle' | 'can' | 'loaf' | 'pack';

export interface Product {
  id: string;
  name: string;
  icon: string;
  description: string;
  price: number;
  shape: ProductShape;
  color: number;
  /** What ends up in the player's bag when it is paid for */
  item: Omit<Item, 'quantity'>;
}

export interface ShelfSectionDef {
  id: string;
  name: string;
  icon: string;
  blurb: string;
  products: Product[];
}

function product(
  id: string,
  name: string,
  icon: string,
  price: number,
  shape: ProductShape,
  color: number,
  description: string,
  category: Item['category'],
  energyRestore?: number
): Product {
  return {
    id, name, icon, description, price, shape, color,
    item: {
      id: `shop_${id}`,
      name,
      category,
      icon,
      description,
      price,
      usable: category === 'food',
      ...(energyRestore !== undefined ? { energyRestore } : {}),
    },
  };
}

/** Everything Everyday Supermarket sells, shelf by shelf. */
export const SHOP_SECTIONS: ShelfSectionDef[] = [
  {
    id: 'drinks',
    name: 'Cold drinks fridge',
    icon: '🥤',
    blurb: 'Water, malt and soft drinks, kept cold.',
    products: [
      product('water', 'Bottled water', '💧', 300, 'bottle', 0x7dd3fc, 'A cold 75cl bottle of table water.', 'food', 6),
      product('malt', 'Malt drink', '🍺', 600, 'can', 0x78350f, 'Rich, dark and sweet. Ice cold.', 'food', 14),
      product('zobo', 'Zobo bottle', '🧃', 500, 'bottle', 0x9f1239, 'Chilled hibiscus drink with ginger.', 'food', 12),
      product('cola', 'Cola', '🥤', 500, 'can', 0xdc2626, 'A cold can of cola.', 'food', 10),
    ],
  },
  {
    id: 'food',
    name: 'Food shelf',
    icon: '🍞',
    blurb: 'Bread, noodles and things for the house.',
    products: [
      product('bread', 'Sliced bread', '🍞', 1400, 'loaf', 0xf59e0b, 'A soft family loaf, baked this morning.', 'food', 30),
      product('noodles', 'Noodles (pack of 5)', '🍜', 2200, 'pack', 0xfacc15, 'Five packs of instant noodles.', 'food', 45),
      product('milk', 'Tin milk', '🥛', 900, 'can', 0xe2e8f0, 'Evaporated milk for tea and pap.', 'food', 12),
      product('cereal', 'Golden cereal', '🥣', 2800, 'box', 0xea580c, 'Maize and soya cereal. Just add hot water.', 'food', 40),
    ],
  },
  {
    id: 'snacks',
    name: 'Snacks shelf',
    icon: '🍪',
    blurb: 'Quick bites for the road.',
    products: [
      product('gala', 'Sausage roll', '🌭', 300, 'pack', 0xb91c1c, 'The traffic classic. Beef sausage roll.', 'food', 10),
      product('chinchin', 'Chin-chin', '🍪', 700, 'pack', 0xd97706, 'Crunchy fried dough in a sealed pack.', 'food', 14),
      product('plantain_chips', 'Plantain chips', '🍌', 500, 'pack', 0xeab308, 'Thin, salted, ripe plantain chips.', 'food', 12),
      product('biscuits', 'Cabin biscuits', '🍘', 400, 'box', 0x1d4ed8, 'A box of plain cabin biscuits.', 'food', 9),
    ],
  },
  {
    id: 'household',
    name: 'Household & gadgets',
    icon: '🔦',
    blurb: 'For when NEPA takes light.',
    products: [
      product('torch', 'Rechargeable torch', '🔦', 2500, 'box', 0x16a34a, 'Bright LED torch with a solar strip.', 'tool'),
      product('power_bank', 'Power bank 20,000mAh', '🔋', 8500, 'box', 0x0f172a, 'Keeps a phone alive for three days.', 'gadget'),
      product('charger', 'Fast charger', '🔌', 3000, 'box', 0xf8fafc, 'A 25W charger and cable.', 'gadget'),
      product('umbrella', 'Umbrella', '☂️', 3500, 'bottle', 0x7c3aed, 'A folding umbrella for rainy season.', 'tool'),
    ],
  },
];

export function findProduct(id: string): Product | null {
  for (const section of SHOP_SECTIONS) {
    const found = section.products.find((entry) => entry.id === id);
    if (found) return found;
  }
  return null;
}

export function sectionOf(productId: string): ShelfSectionDef | null {
  return SHOP_SECTIONS.find((section) => section.products.some((entry) => entry.id === productId)) ?? null;
}
