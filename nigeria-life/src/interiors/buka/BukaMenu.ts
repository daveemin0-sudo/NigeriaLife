/** One dish on the buka's menu. Hunger, energy and health are what the whole plate gives. */
export interface Dish {
  id: string;
  name: string;
  /** Short form the staff call out */
  short: string;
  icon: string;
  description: string;
  price: number;
  hunger: number;
  energy: number;
  health: number;
  /** Mouthfuls it takes to clear the plate */
  bites: number;
  look: 'rice_orange' | 'rice_yellow' | 'swallow_dark' | 'swallow_yellow' | 'skewers';
}

export const BUKA_MENU: Dish[] = [
  {
    id: 'jollof_rice',
    name: 'Jollof rice & chicken',
    short: 'Jollof',
    icon: '🍛',
    description: 'Smoky firewood jollof, fried plantain and a piece of chicken.',
    price: 1800,
    hunger: 55,
    energy: 25,
    health: 8,
    bites: 6,
    look: 'rice_orange',
  },
  {
    id: 'fried_rice',
    name: 'Fried rice & plantain',
    short: 'Fried rice',
    icon: '🍚',
    description: 'Fried rice with mixed vegetables, liver and sweet dodo.',
    price: 1700,
    hunger: 50,
    energy: 25,
    health: 8,
    bites: 6,
    look: 'rice_yellow',
  },
  {
    id: 'amala',
    name: 'Amala & ewedu',
    short: 'Amala',
    icon: '🥣',
    description: 'Hot amala with ewedu, gbegiri and goat meat.',
    price: 2200,
    hunger: 65,
    energy: 30,
    health: 12,
    bites: 7,
    look: 'swallow_dark',
  },
  {
    id: 'eba',
    name: 'Eba & egusi',
    short: 'Eba',
    icon: '🍲',
    description: 'Yellow garri eba with egusi soup and assorted meat.',
    price: 2000,
    hunger: 60,
    energy: 30,
    health: 10,
    bites: 7,
    look: 'swallow_yellow',
  },
  {
    id: 'suya',
    name: 'Suya',
    short: 'Suya',
    icon: '🍢',
    description: 'Spiced beef suya with onions and pepper. A light bite.',
    price: 1200,
    hunger: 30,
    energy: 15,
    health: 4,
    bites: 4,
    look: 'skewers',
  },
];

export function findDish(id: string): Dish | null {
  return BUKA_MENU.find((dish) => dish.id === id) ?? null;
}
