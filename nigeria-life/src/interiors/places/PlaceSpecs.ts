import type { Builder } from '../../world/kit/ArchKit';
import type { PlaceSpec, StationChoice } from './PlaceInterior';
import type { Item } from '../../backend/types';
import { SUPERMARKET_SPEC } from './SupermarketRoom';

/**
 * The insides of the places along the expressway: each laid out for what is done there, with
 * prices as they are in Lagos today. The door is at +z; the back wall at -z.
 */

// --- Furniture ---------------------------------------------------------------------------------

const counter = (b: Builder, x: number, z: number, w: number, colour = 0x7c4a1e, top = 0xe7e5e4, d = 0.9) => b.box(colour, w, 1.05, d, x, 0, z).box(top, w + 0.1, 0.06, d + 0.1, x, 1.05, z);
const table = (b: Builder, x: number, z: number, top = 0x92400e, chairs = 4, chair = 0x1f2937) => {
  b.cylinder(0x3f3f46, 0.07, 0.72, x, 0, z).cylinder(top, 0.62, 0.05, x, 0.72, z, { sides: 18 });
  for (let i = 0; i < chairs; i++) {
    const a = (i / chairs) * Math.PI * 2;
    b.box(chair, 0.42, 0.45, 0.42, x + Math.sin(a) * 0.95, 0, z + Math.cos(a) * 0.95).box(chair, 0.42, 0.5, 0.06, x + Math.sin(a) * 1.15, 0.45, z + Math.cos(a) * 1.15, { yaw: a });
  }
};
const bench = (b: Builder, x: number, z: number, len: number, colour = 0x78350f) => b.box(colour, len, 0.08, 0.4, x, 0.45, z).box(colour, 0.08, 0.45, 0.35, x - len / 2 + 0.2, 0, z).box(colour, 0.08, 0.45, 0.35, x + len / 2 - 0.2, 0, z);
const shelf = (b: Builder, x: number, z: number, w: number, goods: number[], yaw = 0) => {
  b.box(0x57534e, w, 2.1, 0.5, x, 0, z, { yaw });
  for (let row = 0; row < 3; row++) for (let i = 0; i < Math.floor(w / 0.35); i++) b.box(goods[(i + row) % goods.length], 0.26, 0.32, 0.3, x - w / 2 + 0.2 + i * 0.35, 0.25 + row * 0.62, z + 0.05, { yaw });
};
const plant = (b: Builder, x: number, z: number) => b.cylinder(0x78350f, 0.28, 0.5, x, 0, z).dome(0x15803d, 0.55, x, 0.5, z).cone(0x16a34a, 0.35, 1.1, x, 0.7, z, 6);
const screen = (b: Builder, x: number, z: number, w: number, h: number, y = 1.4, glow = 0x22c55e) => b.box(0x0a0a0a, w + 0.2, h + 0.2, 0.12, x, y - 0.1, z).box(glow, w, h, 0.02, x, y, z + 0.07, { glow: true });
const stage = (b: Builder, x: number, z: number, w: number, d: number, colour = 0x1f2937) => b.box(colour, w, 0.7, d, x, 0, z).box(0x111827, w, 0.05, d, x, 0.7, z);
const desk = (b: Builder, x: number, z: number, colour = 0xd6d3d1) => b.box(colour, 1.6, 0.75, 0.75, x, 0, z).box(0x0f172a, 0.6, 0.4, 0.05, x, 0.78, z - 0.2).box(0x38bdf8, 0.54, 0.32, 0.02, x, 0.82, z - 0.17, { glow: true }).box(0x1f2937, 0.5, 0.5, 0.5, x, 0, z + 0.75);
const bottles = (b: Builder, x: number, z: number, w: number) => {
  b.box(0x1c1917, w, 2.4, 0.4, x, 0, z);
  for (let r = 0; r < 3; r++) for (let i = 0; i < Math.floor(w / 0.25); i++) b.cylinder([0xfacc15, 0x16a34a, 0xdc2626, 0x7c2d12, 0xe0f2fe][(i + r) % 5], 0.06, 0.32, x - w / 2 + 0.15 + i * 0.25, 0.55 + r * 0.6, z + 0.1, { glow: r === 1, sides: 8 });
};
const pile = (b: Builder, x: number, z: number, colour: number, r = 0.35) => b.dome(colour, r, x, 0.92, z);
const sack = (b: Builder, x: number, z: number, colour = 0xf5f5f4) => b.cylinder(colour, 0.32, 0.75, x, 0, z, { topRadius: 0.24, sides: 10 }).box(0x166534, 0.4, 0.18, 0.02, x, 0.35, z + 0.3);
/** A market stall: a table under a canopy, with what it sells piled on it */
const stall = (b: Builder, x: number, z: number, canopy: number, goods: (b: Builder, x: number, z: number) => void) => {
  b.box(0x92400e, 2.4, 0.9, 1.1, x, 0, z);
  for (const dx of [-1.15, 1.15]) for (const dz of [-0.5, 0.5]) b.cylinder(0x3f3f46, 0.035, 2.4, x + dx, 0, z + dz);
  b.box(canopy, 2.8, 0.06, 1.6, x, 2.4, z, { pitch: 0.12 });
  goods(b, x, z);
};
/** A goat: body, legs, head, little horns */
const goat = (b: Builder, x: number, z: number, yaw: number, coat = 0xe7e5e4) => {
  const f = { x: Math.sin(yaw), z: Math.cos(yaw) };
  b.box(coat, 0.32, 0.36, 0.75, x, 0.42, z, { yaw });
  for (const [dx, dz] of [[-0.11, 0.28], [0.11, 0.28], [-0.11, -0.28], [0.11, -0.28]]) b.box(0x57534e, 0.07, 0.42, 0.07, x + dx * f.z + dz * f.x, 0, z + dz * f.z - dx * f.x);
  b.box(coat, 0.2, 0.26, 0.3, x + f.x * 0.5, 0.68, z + f.z * 0.5, { yaw }).box(0x44403c, 0.04, 0.14, 0.04, x + f.x * 0.45 + f.z * 0.06, 0.92, z + f.z * 0.45 - f.x * 0.06, { yaw }).box(0x44403c, 0.04, 0.14, 0.04, x + f.x * 0.45 - f.z * 0.06, 0.92, z + f.z * 0.45 + f.x * 0.06, { yaw });
};
const pews = (b: Builder, rows: number, z0: number, span: number) => {
  for (let r = 0; r < rows; r++) for (const side of [-1, 1]) {
    const x = side * (span / 2 + 0.8);
    b.box(0x78350f, span, 0.45, 0.5, x, 0, z0 + r * 1.4).box(0x78350f, span, 0.6, 0.08, x, 0.45, z0 + r * 1.4 + 0.25);
  }
};

const item = (id: string, name: string, icon: string, price: number, category: Item['category'] = 'food', usable = false, energyRestore?: number): Omit<Item, 'quantity'> => ({ id, name, icon, price, category, usable, description: `Bought at the market. ${name}.`, energyRestore });
const buy = (label: string, price: number, it: Omit<Item, 'quantity'>, said: string, note = 'Into your bag'): StationChoice => ({ label, price, note, item: it, said, arms: 'reach', seconds: 1.8 });
const need = (changes: Record<string, number>) => (backend: { modifyNeed(n: never, v: number): void }) => { for (const [k, v] of Object.entries(changes)) backend.modifyNeed(k as never, v); };

// --- The places ----------------------------------------------------------------------------------

const MARKET: PlaceSpec = {
  key: 'balogun-market', name: 'Balogun Market', district: 'Lagos Island · market', room: { width: 32, length: 26, height: 6, floor: 0x8b8378, wall: 0xd6c7a1 },
  sign: { text: 'BALOGUN MARKET', sub: 'Pepper · Rice · Meat · Fish · Goats · Cloth', bg: '#b45309' },
  build: (b) => {
    // Rows of stalls down the hall, each its own trade
    stall(b, -11, -8, 0xdc2626, (b, x, z) => { pile(b, x - 0.7, z, 0xdc2626); pile(b, x, z, 0xef4444, 0.3); pile(b, x + 0.7, z, 0xf97316, 0.3); });
    stall(b, -5, -8, 0x16a34a, (b, x, z) => { sack(b, x - 0.8, z - 0.9); sack(b, x, z - 0.9, 0xfef3c7); pile(b, x - 0.4, z, 0xfef9c3); pile(b, x + 0.5, z, 0xa16207); });
    stall(b, 1, -8, 0xf59e0b, (b, x, z) => { for (let i = 0; i < 5; i++) b.box(0x78350f, 0.18, 0.18, 0.7, x - 0.9 + i * 0.4, 0.92, z, { yaw: 0.3 }); b.box(0xfacc15, 0.9, 0.2, 0.3, x + 0.6, 0.92, z + 0.2); });
    stall(b, 7, -8, 0x7f1d1d, (b, x, z) => { for (let i = 0; i < 4; i++) b.box(0xb91c1c, 0.3, 0.55, 0.12, x - 0.8 + i * 0.5, 1.6, z - 0.3); b.box(0x9f1239, 1.6, 0.12, 0.6, x, 0.92, z); });
    stall(b, -11, -1, 0x0369a1, (b, x, z) => { for (let i = 0; i < 6; i++) b.box(i % 2 ? 0x78350f : 0x94a3b8, 0.5, 0.06, 0.16, x - 0.9 + (i % 3) * 0.6, 0.94 + Math.floor(i / 3) * 0.08, z - 0.2 + Math.floor(i / 3) * 0.3, { yaw: 0.4 }); });
    stall(b, -5, -1, 0xea580c, (b, x, z) => { for (let i = 0; i < 6; i++) b.box([0xf59e0b, 0xdc2626, 0x15803d, 0xfacc15][i % 4], 0.22, 0.16, 0.16, x - 0.8 + i * 0.32, 0.92, z); b.box(0xfde047, 0.5, 0.3, 0.3, x + 0.6, 0.92, z + 0.3); });
    stall(b, 1, -1, 0xca8a04, (b, x, z) => { for (let i = 0; i < 4; i++) b.cylinder(i % 2 ? 0xb91c1c : 0xfacc15, 0.14, 0.45, x - 0.75 + i * 0.5, 0.92, z, { sides: 8 }); });
    stall(b, 7, -1, 0x7c3aed, (b, x, z) => { for (let i = 0; i < 5; i++) b.box([0xe11d48, 0x0ea5e9, 0xfacc15, 0x10b981, 0x7c3aed][i], 0.4, 0.25, 0.9, x - 0.9 + i * 0.45, 0.92, z); });
    // The goat pen, with goats in it, and a coop of chickens beside it
    b.box(0x78350f, 6, 0.9, 0.08, 10, 0, 6).box(0x78350f, 6, 0.9, 0.08, 10, 0, 10).box(0x78350f, 0.08, 0.9, 4, 7, 0, 8).box(0x78350f, 0.08, 0.9, 4, 13, 0, 8);
    goat(b, 9, 7.2, 0.6); goat(b, 11.2, 8.4, -1.2, 0xf5f5f4); goat(b, 9.6, 9.1, 2.4, 0x78350f); goat(b, 12, 6.9, 0.2, 0x292524);
    b.box(0xa16207, 1.6, 1, 1, 4.5, 0, 8).box(0xf5f5f4, 0.25, 0.3, 0.35, 4.2, 1, 8).box(0xb45309, 0.25, 0.3, 0.35, 4.8, 1, 8.1);
    // Baskets down the aisle
    for (let i = 0; i < 6; i++) b.cylinder(0xa16207, 0.35, 0.35, -12 + i * 1.2, 0, 7, { sides: 10 }).dome([0xdc2626, 0xf97316, 0xfacc15][i % 3], 0.3, -12 + i * 1.2, 0.35, 7);
  },
  staff: [
    { name: 'Mama Bisi', title: 'Pepper & tomato seller', at: [-11, -9.4], facing: 0, outfit: 0xdb2777, gender: 'female', says: 'Customer! Fresh pepper, rodo, tatashe, tomato. I go do you well!' },
    { name: 'Alhaji Sani', title: 'Grains seller', at: [-5, -9.4], facing: 0, outfit: 0xf5f5f4, gender: 'male', says: 'Rice, beans, garri, all na original. Buy by mudu or bag.' },
    { name: 'Iya Rasheed', title: 'Yam & plantain seller', at: [1, -9.4], facing: 0, outfit: 0xf59e0b, gender: 'female', says: 'Abuja yam, big one! Plantain, ripe and unripe.' },
    { name: 'Musa the butcher', title: 'Butcher', at: [7, -9.4], facing: 0, outfit: 0x991b1b, gender: 'male', says: 'Fresh beef, goat meat, shaki, ponmo! Kilo or portion.' },
    { name: 'Mama Ebi', title: 'Fish seller', at: [-11, -2.4], facing: 0, outfit: 0x0e7490, gender: 'female', says: 'Smoked catfish, panla, fresh croaker. Come and see.' },
    { name: 'Mama Ngozi', title: 'Spice seller', at: [-5, -2.4], facing: 0, outfit: 0xea580c, gender: 'female', says: 'Curry, thyme, Maggi, crayfish, ogiri. Everything for your soup.' },
    { name: 'Oga Femi', title: 'Oil seller', at: [1, -2.4], facing: 0, outfit: 0x15803d, gender: 'male', says: 'Palm oil, groundnut oil, by litre or keg.' },
    { name: 'Alhaja Kudi', title: 'Cloth seller', at: [7, -2.4], facing: 0, outfit: 0x7c3aed, gender: 'female', says: 'Original lace, Ankara, aso-oke. Owambe ready!' },
    { name: 'Baba Sule', title: 'Goat seller', at: [10, 11], facing: Math.PI, outfit: 0xf8fafc, gender: 'male', says: 'Healthy goat! Ram for Sallah. Chicken too.' },
  ],
  regulars: [{ at: [-8, 3], facing: 2.4, outfit: 0x2563eb }, { at: [-2, 4], facing: 0.8, outfit: 0xec4899, gender: 'female' }, { at: [3, 2.6], facing: -1, outfit: 0x16a34a }, { at: [-12, 9], facing: 3.1, outfit: 0xfacc15, gender: 'female' }],
  stations: [
    { id: 'pepper', name: '🌶️ Pepper & tomatoes', at: [-11, -8], stand: [-11, -6.6], who: 'Mama Bisi', role: 'Pepper & tomato seller', text: 'Wetin you want? I go add jara for you.', choices: [
      buy('A paint bucket of tomatoes', 8000, item('mkt_tomato', 'Paint bucket of tomatoes', '🍅', 8000), 'Mama Bisi tied the tomatoes in a black nylon and added two for jara.'),
      buy('Rodo and tatashe pepper, a paint', 6000, item('mkt_pepper', 'Paint of pepper (rodo & tatashe)', '🌶️', 6000), 'Hot rodo and red tatashe. Your stew go sweet.'),
      buy('Onions, a small bag', 5000, item('mkt_onion', 'Small bag of onions', '🧅', 5000), 'Big red onions, tied up.'),
    ] },
    { id: 'grains', name: '🍚 Rice, beans & garri', at: [-5, -8], stand: [-5, -6.6], who: 'Alhaji Sani', role: 'Grains seller', text: 'Mudu or bag?', choices: [
      buy('A mudu of rice', 3500, item('mkt_rice_mudu', 'Mudu of rice', '🍚', 3500), 'Measured with the mudu, heaped, poured into your bag.'),
      buy('A 50 kg bag of rice', 95000, item('mkt_rice_bag', '50 kg bag of rice', '🌾', 95000), 'A whole bag. The boy carried it to the gate for you.'),
      buy('Beans, a paint', 9000, item('mkt_beans', 'Paint of beans (oloyin)', '🫘', 9000), 'Sweet oloyin beans, no weevils.'),
      buy('Garri, a paint', 4500, item('mkt_garri', 'Paint of garri', '🥣', 4500), 'Yellow Ijebu garri, crunchy.'),
    ] },
    { id: 'yam', name: '🍠 Yam & plantain', at: [1, -8], stand: [1, -6.6], who: 'Iya Rasheed', role: 'Yam & plantain seller', text: 'Fine yam! Choose the one you like.', choices: [
      buy('A big tuber of yam', 6000, item('mkt_yam', 'Tuber of yam', '🍠', 6000), 'A fat Abuja yam, heavy in your hand.'),
      buy('A bunch of plantain', 5000, item('mkt_plantain', 'Bunch of plantain', '🍌', 5000), 'Ripe plantain for dodo.'),
    ] },
    { id: 'meat', name: '🥩 Meat', at: [7, -8], stand: [7, -6.6], who: 'Musa the butcher', role: 'Butcher', text: 'Which one? I go cut am for you.', choices: [
      buy('Beef, a kilo', 9000, item('mkt_beef', 'Kilo of beef', '🥩', 9000), 'Chop chop chop: cut, weighed, wrapped.'),
      buy('Goat meat, a kilo', 11000, item('mkt_goatmeat', 'Kilo of goat meat', '🍖', 11000), 'Fresh goat meat for pepper soup.'),
      buy('Shaki and ponmo', 4000, item('mkt_shaki', 'Shaki and ponmo', '🍖', 4000), 'Assorted, the way you like it.'),
    ] },
    { id: 'fish', name: '🐟 Fish', at: [-11, -1], stand: [-11, 0.4], who: 'Mama Ebi', role: 'Fish seller', text: 'Smoked or fresh?', choices: [
      buy('Smoked catfish', 6000, item('mkt_catfish', 'Smoked catfish', '🐟', 6000), 'Smoked catfish, dry and sweet-smelling.'),
      buy('Fresh croaker, a kilo', 7000, item('mkt_croaker', 'Kilo of fresh croaker', '🐠', 7000), 'Cleaned and wrapped in leaves.'),
    ] },
    { id: 'spice', name: '🧂 Spices & Maggi', at: [-5, -1], stand: [-5, 0.4], who: 'Mama Ngozi', role: 'Spice seller', text: 'For soup or stew?', choices: [
      buy('Curry and thyme', 600, item('mkt_curry', 'Curry and thyme', '🧂', 600), 'Two sachets each, curry and thyme.'),
      buy('A pack of Maggi', 1800, item('mkt_maggi', 'Pack of Maggi cubes', '🧂', 1800), 'A full pack of Maggi.'),
      buy('Ground crayfish', 3000, item('mkt_crayfish', 'Cup of ground crayfish', '🦐', 3000), 'Crayfish, ground fine.'),
    ] },
    { id: 'oil', name: '🛢️ Oil', at: [1, -1], stand: [1, 0.4], who: 'Oga Femi', role: 'Oil seller', text: 'Palm oil or groundnut oil?', choices: [
      buy('Palm oil, 5 litres', 12000, item('mkt_palmoil', '5 litres of palm oil', '🛢️', 12000), 'Red palm oil, filled to the brim.'),
      buy('Groundnut oil, 5 litres', 18000, item('mkt_groundnut', '5 litres of groundnut oil', '🛢️', 18000), 'Clear groundnut oil in a keg.'),
    ] },
    { id: 'cloth', name: '🧵 Cloth', at: [7, -1], stand: [7, 0.4], who: 'Alhaja Kudi', role: 'Cloth seller', text: 'Original! Feel am.', choices: [
      buy('Ankara, six yards', 18000, item('mkt_ankara', 'Ankara, six yards', '🧵', 18000, 'luxury'), 'Bright Ankara, folded and bagged.'),
      buy('Swiss lace, five yards', 120000, item('mkt_lace', 'Swiss lace, five yards', '👗', 120000, 'luxury'), 'Heavy original lace. Owambe ready.'),
      { label: 'Haggle for fun', note: 'Social +12', arms: 'talk', seconds: 3, effect: need({ social: 12, fun: 6 }), said: '"Last price?" "Oya bring ₦15,000." Everybody laughed.' },
    ] },
    { id: 'goats', name: '🐐 Goats & chickens', at: [10, 8], stand: [10, 11], who: 'Baba Sule', role: 'Goat seller', text: 'For Sallah, for party, for pepper soup?', choices: [
      buy('A live chicken', 15000, item('mkt_chicken', 'Live chicken', '🐔', 15000), 'Baba Sule tied its legs. It is complaining in your hand.'),
      buy('A goat', 90000, item('mkt_goat', 'Live goat', '🐐', 90000), 'A healthy goat on a rope. It follows you, bleating.'),
      buy('A big ram', 250000, item('mkt_ram', 'Big ram', '🐏', 250000), 'A ram with curled horns. Sallah don land!'),
    ] },
  ],
};

const buka = (key: string, name: string, district: string, sub: string): PlaceSpec => ({
  key, name, district, room: { width: 16, length: 14, height: 4, floor: 0xd6d3d1, wall: 0xfacc15 },
  sign: { text: name.toUpperCase(), sub, bg: '#15803d' },
  build: (b) => {
    counter(b, 0, -5, 8, 0x15803d);
    for (let i = 0; i < 4; i++) b.cylinder(0x52525b, 0.35, 0.45, -3 + i * 2, 1.1, -5.1, { sides: 12 }).cylinder([0x1c1917, 0xfacc15, 0x15803d, 0x7c2d12][i], 0.3, 0.05, -3 + i * 2, 1.55, -5.1);
    for (const [x, z] of [[-4.5, 0], [0, 0], [4.5, 0], [-4.5, 3.5], [0, 3.5], [4.5, 3.5]]) { b.box(0x92400e, 2.2, 0.75, 0.9, x, 0, z); bench(b, x, z - 0.9, 2.2); bench(b, x, z + 0.9, 2.2); }
  },
  staff: [{ name: 'Iya Shitta', title: 'Owner', at: [0, -6], facing: 0, outfit: 0x15803d, gender: 'female', chef: true, says: 'Sit down! Amala dey hot, gbegiri dey sweet!' }],
  regulars: [{ at: [-4.5, -0.9], facing: 0, outfit: 0x2563eb, sit: true }, { at: [4.5, 0.9], facing: Math.PI, outfit: 0xf97316, sit: true, gender: 'female' }, { at: [0, 4.4], facing: Math.PI, outfit: 0x16a34a, sit: true }],
  stations: [
    { id: 'counter', name: '🍲 Order at the counter', at: [0, -5], stand: [0, -3.8], who: 'Iya Shitta', role: name, text: 'Wetin I go give you?', choices: [
      { label: 'Amala, ewedu, gbegiri and assorted meat', price: 4500, note: 'Hunger +65', sit: true, seconds: 5, effect: need({ hunger: 65, fun: 5 }), said: 'Hot amala, soft and black, with gbegiri. Your hand smelt of it for hours.' },
      { label: 'Amala with goat meat', price: 6000, note: 'Hunger +70', sit: true, seconds: 5, effect: need({ hunger: 70 }), said: 'Goat meat in pepper sauce over amala. Correct!' },
      { label: 'A cold zobo', price: 800, note: 'Takeaway', arms: 'reach', effect: need({ hunger: 6 }), said: 'Cold zobo with ginger.' },
      buy('Takeaway pack of amala for later', 4500, item('buka_takeaway', 'Takeaway amala & ewedu', '🥡', 4500, 'food', true, 20), 'Packed in nylon and foil, still hot.'),
    ] },
  ],
});

const MARINA_TOWERS: PlaceSpec = {
  key: 'marina-towers', name: 'Marina Towers', district: 'Marina · offices', room: { width: 22, length: 18, height: 5, floor: 0xe5e7eb, wall: 0x1e3a8a },
  sign: { text: 'MARINA TOWERS', sub: 'Offices · Banks · Shops', bg: '#1e3a8a' },
  build: (b) => {
    counter(b, -5, -5, 5, 0x0f172a, 0xf8fafc);
    for (const x of [5, 8]) b.box(0x9ca3af, 2.2, 3.2, 0.2, x, 0, -8.8).box(0xd4d4d8, 0.04, 3, 0.22, x, 0, -8.8);
    for (const [x, z] of [[-6, 3], [0, 3]]) b.box(0x166534, 2.4, 0.45, 0.9, x, 0, z).box(0x166534, 2.4, 0.6, 0.2, x, 0.45, z - 0.4);
    plant(b, -9.5, -7.5); plant(b, 9.5, 6);
  },
  staff: [{ name: 'Ada', title: 'Receptionist', at: [-5, -6], facing: 0, outfit: 0x1e3a8a, gender: 'female', says: 'Good afternoon, welcome to Marina Towers.' }],
  regulars: [{ at: [-6, 3.1], facing: Math.PI, outfit: 0x374151, sit: true }, { at: [2, -2], facing: 0.5, outfit: 0x0f172a }],
  stations: [
    { id: 'reception', name: '🏢 Reception', at: [-5, -5], stand: [-5, -3.6], who: 'Ada', role: 'Receptionist', text: 'Who are you here to see?', choices: [
      { label: 'Rent office space for my business', note: 'Opens Business', open: 'app:business' },
      { label: 'Meet a client in the lobby', note: 'Social +15', arms: 'shake', seconds: 3, effect: need({ social: 15 }), said: 'Firm handshake, good gist. They will call you.' },
    ] },
    { id: 'lifts', name: '🛗 Lifts to the top floor', at: [6.5, -8.5], stand: [6.5, -7.2], who: 'Lift', role: 'Floor 20', text: 'Going up.', choices: [
      { label: 'See Lagos from the top', note: 'Fun +12', arms: 'rest', seconds: 4, effect: need({ fun: 12 }), said: 'The lagoon, the bridge, the island lit like gold.' },
    ] },
  ],
};

const venue = (key: string, name: string, district: string, sub: string, bg: string, floor: number, wall: number, extra: (b: Builder) => void, staff: PlaceSpec['staff'], stations: PlaceSpec['stations'], regulars: PlaceSpec['regulars'] = [], size: [number, number] = [20, 18]): PlaceSpec => ({
  key, name, district, room: { width: size[0], length: size[1], height: 5, floor, wall }, sign: { text: name.toUpperCase(), sub, bg }, build: extra, staff, stations, regulars,
});

const SPECS: PlaceSpec[] = [
  MARKET,
  buka('amala-shitta', 'Amala Shitta', 'Surulere · buka', 'Amala · Ewedu · Gbegiri · Assorted'),
  MARINA_TOWERS,
  venue('freedom-park', 'Freedom Park', 'Lagos Island · arts', 'Arts · Music · History', '#92400e', 0x4d7c0f, 0xb45309, (b) => {
    stage(b, 0, -6, 10, 4, 0x57534e);
    b.box(0xf8fafc, 11, 0.3, 5, 0, 4.2, -6);
    for (let r = 0; r < 4; r++) bench(b, 0, -1 + r * 1.6, 8);
    for (let i = 0; i < 4; i++) b.box([0xdc2626, 0x2563eb, 0xfacc15, 0x16a34a][i], 0.1, 1.6, 1.2, -9.8, 1, -5 + i * 3);
    counter(b, 7, 6, 3, 0xb45309);
  }, [
    { name: 'The band', title: 'Highlife band', at: [-2, -6.5], facing: 0, outfit: 0xf8fafc, gender: 'male', says: 'We dey play till late!' },
    { name: 'Bimpe', title: 'Food seller', at: [7, 5], facing: Math.PI, outfit: 0xdb2777, gender: 'female', says: 'Asun, small chops, cold Chapman!' },
  ], [
    { id: 'show', name: '🎭 Watch the show', at: [0, -4], stand: [0, -0.2], who: 'Gate attendant', role: 'Freedom Park', text: 'Live band tonight.', choices: [
      { label: 'Sit and watch the band', price: 5000, note: 'Fun +35, Social +10', sit: true, seconds: 6, effect: need({ fun: 35, social: 10 }), said: 'Highlife, then Afrobeat. The crowd sang every word.' },
      { label: 'Dance in front of the stage', note: 'Fun +25', dance: true, seconds: 8, effect: need({ fun: 25 }), said: 'You danced like nobody was watching. Everybody was.' },
    ] },
    { id: 'art', name: '🖼️ Art exhibition', at: [-9.5, 0], stand: [-8, 0], who: 'Curator', role: 'Freedom Park', text: 'The old prison, and the artists who remember it.', choices: [{ label: 'Walk round the exhibition', note: 'Fun +12', arms: 'rest', seconds: 4, effect: need({ fun: 12 }), said: 'Paintings, sculptures, and the old cells. Lagos history up close.' }] },
    { id: 'food', name: '🍢 Food & drinks', at: [7, 6], stand: [7, 4.6], who: 'Bimpe', role: 'Food seller', text: 'Wetin you go chop?', choices: [{ label: 'Asun and a cold Chapman', price: 6500, note: 'Hunger +40', sit: true, seconds: 4, effect: need({ hunger: 40 }), said: 'Peppered goat meat and a cold Chapman.' }] },
  ], [{ at: [-2, -1], facing: Math.PI, outfit: 0x2563eb, sit: true }, { at: [2, 0.6], facing: Math.PI, outfit: 0xf97316, sit: true, gender: 'female' }]),
  venue('ivory-rooftop', 'Ivory Rooftop', 'Victoria Island · lounge', 'Sky lounge · Cocktails · Sunset DJ', '#111827', 0x292524, 0x0f172a, (b) => {
    counter(b, 0, -6, 8, 0x111827, 0xd4af37); bottles(b, 0, -7.8, 8);
    for (const [x, z] of [[-6, 0], [-2, 2], [2, 2], [6, 0]]) { b.box(0xf8fafc, 2.2, 0.45, 0.9, x, 0, z).box(0xf8fafc, 2.2, 0.55, 0.2, x, 0.45, z + 0.4); b.cylinder(0xd4af37, 0.4, 0.5, x, 0, z - 1.1, { sides: 12 }); }
    b.box(0x111827, 2, 1.2, 1, 7, 0, -4).box(0x22d3ee, 1.8, 0.1, 0.8, 7, 1.2, -4, { glow: true });
  }, [
    { name: 'Tobi', title: 'Bartender', at: [0, -7], facing: 0, outfit: 0x111827, gender: 'male', tie: true, says: 'Good evening. What are we drinking?' },
    { name: 'DJ Kaywise', title: 'DJ', at: [7, -4.8], facing: 0, outfit: 0xf59e0b, gender: 'male', says: 'Amapiano or Afrobeats?' },
  ], [
    { id: 'bar', name: '🍸 The bar', at: [0, -6], stand: [0, -4.6], who: 'Tobi', role: 'Bartender', text: 'Cocktail or a bottle?', choices: [
      { label: 'A cocktail', price: 25000, note: 'Fun +20, Social +15', effect: need({ fun: 20, social: 15 }), said: 'A smoky old fashioned with the whole of Lagos lit below.' },
      { label: 'Bottle service at a table', price: 350000, note: 'Social +40, Fun +30', sit: true, seconds: 5, effect: need({ social: 40, fun: 30 }), said: 'Sparklers came out. Everybody on the roof knows your name now.' },
    ] },
    { id: 'sofa', name: '🌇 Sit by the edge', at: [-6, 0], stand: [-6, -0.5], who: 'Host', role: 'Ivory Rooftop', text: 'Best view in Lagos.', choices: [{ label: 'Sit and watch the city', note: 'Fun +10', sit: true, seconds: 5, effect: need({ fun: 10 }), said: 'Orange sky over the lagoon. Beautiful.' }] },
    { id: 'floor', name: '💃 Dance', at: [5, -2], stand: [5, -2], who: 'DJ Kaywise', role: 'DJ', text: 'Oya, enter the floor!', choices: [{ label: 'Dance', note: 'Fun +25', dance: true, seconds: 8, effect: need({ fun: 25, social: 8 }), said: 'The DJ shouted your name.' }] },
  ], [{ at: [2, 2.2], facing: Math.PI, outfit: 0xf8fafc, sit: true, gender: 'female' }, { at: [-2, 2.2], facing: Math.PI, outfit: 0xdc2626, sit: true }]),
  venue('the-library', 'The Library', 'Ikoyi · fine dining', 'Speakeasy · Private dining', '#78350f', 0x3f2a1d, 0x1c1917, (b) => {
    for (const x of [-8, -4, 0, 4, 8]) { b.box(0x3b2416, 3.4, 3.6, 0.5, x, 0, -8.6); for (let r = 0; r < 4; r++) for (let i = 0; i < 9; i++) b.box([0x7f1d1d, 0x1e3a8a, 0x14532d, 0xa16207][(i + r) % 4], 0.3, 0.6, 0.3, x - 1.4 + i * 0.35, 0.3 + r * 0.85, -8.4); }
    for (const [x, z] of [[-5, -2], [0, -2], [5, -2], [-2.5, 3], [2.5, 3]]) table(b, x, z, 0x1c1917, 2, 0x7f1d1d);
    counter(b, 7.5, 6, 3, 0x1c1917, 0xd4af37);
  }, [{ name: 'Mr Olu', title: 'Maître d', at: [-7.5, 6], facing: Math.PI / 2, outfit: 0x111827, gender: 'male', tie: true, says: 'Welcome. Your table is ready.' }], [
    { id: 'dine', name: '🍽️ Private dining', at: [0, -2], stand: [0, -1.05], who: 'Mr Olu', role: 'Maître d', text: 'Three courses, or just a glass?', choices: [
      { label: 'A private dinner, three courses', price: 85000, note: 'Hunger +60, Social +20', sit: true, seconds: 6, effect: need({ hunger: 60, social: 20 }), said: 'Seafood, steak, and a dessert you will talk about for a week.' },
      { label: 'A glass of wine', price: 30000, note: 'Fun +12', sit: true, seconds: 4, effect: need({ fun: 12 }), said: 'Quiet, cool, expensive. You feel like a chairman.' },
    ] },
    { id: 'books', name: '📚 The shelves', at: [0, -8.4], stand: [0, -7.2], who: 'The Library', role: 'Shelves', text: 'Books from floor to ceiling.', choices: [{ label: 'Read for a while', note: 'Fun +8', arms: 'carry', seconds: 4, effect: need({ fun: 8 }), said: 'A first edition of Things Fall Apart. Careful with it.' }] },
  ], [{ at: [5, -1.05], facing: Math.PI, outfit: 0xf8fafc, sit: true, gender: 'female' }]),
  venue('i-fitness', 'i-Fitness', 'Ikoyi · gym', 'Gym · Classes · Trainers', '#ea580c', 0x27272a, 0xf8fafc, (b) => {
    for (let i = 0; i < 5; i++) b.box(0x111827, 0.9, 1.3, 2, -8 + i * 2.2, 0, -6).box(0xef4444, 0.92, 0.12, 2, -8 + i * 2.2, 1.3, -6);
    for (let i = 0; i < 4; i++) b.box(0x52525b, 1.6, 0.4, 0.6, 4 + (i % 2) * 2.5, 0, 0 + Math.floor(i / 2) * 2.5).cylinder(0x18181b, 0.25, 0.1, 3.4 + (i % 2) * 2.5, 0.6, Math.floor(i / 2) * 2.5, { pitch: Math.PI / 2 });
    b.box(0x1f2937, 0.4, 1.8, 6, 9.6, 0, 1); counter(b, -6, 6, 3, 0xea580c);
  }, [{ name: 'Coach Tunde', title: 'Trainer', at: [0, -3], facing: 0, outfit: 0xea580c, gender: 'male', says: 'Oya, ten more! Pain is temporary!' }], [
    { id: 'treadmill', name: '🏃 Treadmill', at: [-8, -6], stand: [-8, -6], who: 'Coach Tunde', role: 'Trainer', text: 'Day pass?', choices: [{ label: 'Run for half an hour (day pass)', price: 15000, note: 'Health +10, Fitness', arms: 'swing', seconds: 6, effect: (be) => { need({ health: 10, energy: -20 })(be as never); (be as unknown as { addSkillExp(s: string, n: number): void }).addSkillExp('fitness', 2); }, said: 'Five kilometres. Your legs are shaking. Fitness up.' }] },
    { id: 'weights', name: '🏋️ Weights', at: [4, 0], stand: [4, 1.1], who: 'Coach Tunde', role: 'Trainer', text: 'Bench or squat?', choices: [{ label: 'Lift with the trainer', price: 15000, note: 'Health +10, Fitness', arms: 'carry', seconds: 6, effect: (be) => { need({ health: 10, energy: -20 })(be as never); (be as unknown as { addSkillExp(s: string, n: number): void }).addSkillExp('fitness', 2); }, said: 'The coach shouted till the last rep. Fitness up.' }] },
    { id: 'desk', name: '💳 Membership', at: [-6, 6], stand: [-6, 4.7], who: 'Front desk', role: 'i-Fitness', text: 'Monthly membership?', choices: [{ label: 'Monthly membership', price: 120000, note: 'Health +15', effect: need({ health: 15 }), said: 'Card on your phone. See you every morning by six.' }] },
  ], [{ at: [-5.8, -6], facing: Math.PI, outfit: 0x2563eb }, { at: [6.5, 2.5], facing: 0, outfit: 0xdb2777, gender: 'female' }]),
  venue('lekki-conservation', 'Lekki Conservation Centre', 'Lekki · nature park', 'Canopy walk · Nature trail', '#166534', 0x3f6212, 0x166534, (b) => {
    for (let i = 0; i < 14; i++) { const x = -9 + (i * 7) % 18; const z = -8 + Math.floor(i / 3) * 3.5; b.cylinder(0x57534e, 0.3, 5, x, 0, z).dome(i % 2 ? 0x15803d : 0x166534, 2, x, 4.4, z); }
    b.box(0xa16207, 1.4, 0.2, 16, 0, 0.4, 0);
    for (const [x, z] of [[-6, 6], [6, 6]]) b.box(0xb91c1c, 2.4, 0.03, 2.4, x, 0.02, z);
    counter(b, 7, -7, 3, 0x78350f);
  }, [{ name: 'Ranger Chuks', title: 'Ranger', at: [7, -8], facing: 0, outfit: 0x166534, gender: 'male', says: 'Welcome to the forest! Mind the monkeys.' }], [
    { id: 'canopy', name: '🌳 Canopy walk', at: [7, -7], stand: [7, -5.7], who: 'Ranger Chuks', role: 'Lekki Conservation Centre', text: 'Forty metres up. Ready?', choices: [{ label: 'Do the canopy walk', price: 10000, note: 'Fun +35', arms: 'wave', seconds: 6, effect: need({ fun: 35, energy: -10 }), said: 'Forty metres up on a swinging bridge. Your legs shook; the view was worth it.' }] },
    { id: 'picnic', name: '🧺 Picnic', at: [-6, 6], stand: [-6, 6], who: 'Ranger Chuks', role: 'Lekki Conservation Centre', text: 'Spread your mat.', choices: [{ label: 'A picnic on the grass', price: 15000, note: 'Hunger +30, Social +20, Fun +15', sit: true, seconds: 6, effect: need({ hunger: 30, social: 20, fun: 15 }), said: 'Jollof, chicken, a cold drink and good gist under the trees.' }] },
    { id: 'boardwalk', name: '🐒 The boardwalk', at: [0, 0], stand: [0.9, 0], who: 'Monkeys', role: 'The forest', text: 'A monkey watches you.', choices: [{ label: 'Walk the boardwalk', price: 3000, note: 'Fun +10', arms: 'rest', seconds: 5, effect: need({ fun: 10 }), said: 'A monkey stole a biscuit from a child. Everybody laughed.' }] },
  ], [{ at: [6, 6.4], facing: Math.PI, outfit: 0xfacc15, sit: true, gender: 'female' }], [22, 22]),
  venue('dangote-refinery', 'Dangote Refinery Visitors Centre', 'Lekki Free Zone', 'Tours · Control room · HR · Canteen', '#0f172a', 0xd4d4d8, 0x166534, (b) => {
    for (let i = 0; i < 4; i++) screen(b, -7 + i * 3.5, -8.7, 3, 1.6, 2, [0x22c55e, 0x38bdf8, 0xf59e0b, 0x22c55e][i]);
    for (let i = 0; i < 4; i++) desk(b, -7 + i * 3.5, -5.5);
    counter(b, 6, 5, 4, 0x166534); desk(b, -6, 4); b.box(0x9ca3af, 2, 2.6, 2, 0, 0, 0).cylinder(0xe5e7eb, 0.6, 2.4, 0, 2.6, 0);
  }, [
    { name: 'Engr. Bello', title: 'Control room engineer', at: [0, -6.3], facing: 0, outfit: 0xf8fafc, gender: 'male', says: 'Six hundred and fifty thousand barrels a day. All from here.' },
    { name: 'Mrs Okon', title: 'HR officer', at: [-6, 3.2], facing: 0, outfit: 0x1e3a8a, gender: 'female', says: 'We are hiring. Bring your CV.' },
    { name: 'Mama Canteen', title: 'Canteen', at: [6, 4], facing: 0, outfit: 0xf59e0b, gender: 'female', chef: true, says: 'Rice, stew and plantain!' },
  ], [
    { id: 'tour', name: '🦺 Plant tour', at: [0, 0], stand: [0, 1.6], who: 'Security', role: 'Dangote Refinery', text: 'Hard hat on.', choices: [{ label: 'Tour the plant in a hard hat', note: 'Free · Fun +15', arms: 'rest', seconds: 5, effect: need({ fun: 15 }), said: 'Columns taller than buildings, and the flare roaring like a jet.' }] },
    { id: 'control', name: '🖥️ Control room', at: [0, -5.5], stand: [0, -4.4], who: 'Engr. Bello', role: 'Control room', text: 'Everything in the plant, on these screens.', choices: [{ label: 'Watch the control room', note: 'Free · Fun +8', arms: 'rest', seconds: 4, effect: need({ fun: 8 }), said: 'Green lights everywhere. The plant is running smooth.' }] },
    { id: 'hr', name: '💼 HR: apply for a job', at: [-6, 4], stand: [-6, 5.6], who: 'Mrs Okon', role: 'HR officer', text: 'We are hiring.', choices: [{ label: 'See the jobs', note: 'Opens Jobs', open: 'app:jobs' }] },
    { id: 'canteen', name: '🍛 Staff canteen', at: [6, 5], stand: [6, 6.4], who: 'Mama Canteen', role: 'Canteen', text: 'Big portion?', choices: [{ label: 'Rice, stew and plantain', price: 3500, note: 'Hunger +45', sit: true, seconds: 5, effect: need({ hunger: 45 }), said: 'Big portion, hot stew. Factory food is real food.' }] },
  ]),
  venue('radio-house', 'Naija Radio House', 'Ikeja · NaijaFM 99.1', 'On air', '#b91c1c', 0x27272a, 0xf8fafc, (b) => {
    b.box(0x111827, 4, 0.9, 1.2, 0, 0, -5).box(0x22d3ee, 3.6, 0.05, 0.9, 0, 0.92, -5, { glow: true });
    for (const x of [-1, 1]) b.cylinder(0x18181b, 0.03, 0.6, x, 0.92, -4.6).cylinder(0x52525b, 0.08, 0.15, x, 1.5, -4.6);
    b.box(0xdc2626, 1.4, 0.4, 0.06, 0, 2.6, -8.7, { glow: true }); counter(b, -5, 5, 3, 0xb91c1c); b.box(0x7f1d1d, 9, 3, 0.15, 0, 0, -2.8);
  }, [{ name: 'DJ Spinall', title: 'Presenter', at: [1, -5.8], facing: 0, outfit: 0xfacc15, gender: 'male', says: 'You dey listen to NaijaFM 99.1!' }, { name: 'Funke', title: 'Producer', at: [-5, 4], facing: 0, outfit: 0x7c3aed, gender: 'female', says: 'Shout-out? Song request?' }], [
    { id: 'studio', name: '🎙️ In the studio', at: [-1, -5], stand: [-1, -4], who: 'DJ Spinall', role: 'Presenter', text: 'Come sit, we dey live!', choices: [{ label: 'Be a guest on the show', note: 'Social +30', sit: true, arms: 'talk', seconds: 6, effect: need({ social: 30 }), said: 'Twenty minutes of gist on air. Your phone started ringing.' }] },
    { id: 'desk', name: '📻 Request a song', at: [-5, 5], stand: [-5, 6.3], who: 'Funke', role: 'Producer', text: 'Which song, and who for?', choices: [{ label: 'Request a song with a shout-out', price: 5000, note: 'Fun +10, Social +10', effect: need({ fun: 10, social: 10 }), said: '"This one goes out to all my people for Lagos!" The DJ said your name.' }] },
  ]),
  venue('viewing-centre', 'Oga Sunday Viewing Centre', 'Mushin · football', 'EPL · La Liga · AFCON live', '#14532d', 0x52525b, 0x166534, (b) => {
    screen(b, 0, -6.8, 6, 3.4, 2.2);
    for (let r = 0; r < 4; r++) for (let i = 0; i < 6; i++) b.box([0xdc2626, 0x2563eb, 0xf8fafc][(i + r) % 3], 0.5, 0.45, 0.5, -3.75 + i * 1.5, 0, -2 + r * 1.6);
    counter(b, 5, 5, 2.4, 0x14532d);
  }, [{ name: 'Oga Sunday', title: 'Owner', at: [5, 4], facing: 0, outfit: 0x14532d, gender: 'male', says: 'Arsenal dey play! Pay at the door.' }], [
    { id: 'match', name: '⚽ Watch the match', at: [0, -2], stand: [-0.75, -2], who: 'Oga Sunday', role: 'Viewing centre', text: 'Na ₦1,000.', choices: [{ label: 'Sit and watch the match', price: 1000, note: 'Fun +25, Social +15', sit: true, arms: 'rest', seconds: 8, effect: need({ fun: 25, social: 15 }), said: 'Last-minute goal. The whole hall stood on the chairs.' }] },
    { id: 'snacks', name: '🍢 Suya & malt', at: [5, 5], stand: [5, 6.3], who: 'Oga Sunday', role: 'Viewing centre', text: 'Half-time chop?', choices: [{ label: 'Suya and a cold malt', price: 4000, note: 'Hunger +30', effect: need({ hunger: 30 }), said: 'Suya and a cold malt for half-time.' }] },
  ], [{ at: [-2.25, -0.4], facing: Math.PI, outfit: 0xdc2626, sit: true }, { at: [0.75, 1.2], facing: Math.PI, outfit: 0x2563eb, sit: true }, { at: [2.25, -2], facing: Math.PI, outfit: 0xfacc15, sit: true }], [16, 16]),
  venue('polling-unit', 'Polling Unit 001 & NIN Centre', 'Lagos Island Civic Centre', 'INEC · NIMC', '#166534', 0xe5e7eb, 0xf8fafc, (b) => {
    for (const x of [-5, 0]) b.box(0x92400e, 2.6, 0.78, 1, x, 0, -4).box(0xf8fafc, 0.6, 0.6, 0.6, x + 0.8, 0.78, -4.1);
    for (let i = 0; i < 3; i++) b.box(0x166534, 1.1, 2, 0.08, 5 + i * 1.4, 0, -6).box(0x166534, 0.08, 2, 1, 4.45 + i * 1.4, 0, -5.5);
    b.box(0xf8fafc, 0.6, 0.7, 0.6, 7.5, 0, -2).box(0x15803d, 0.62, 0.08, 0.62, 7.5, 0.7, -2);
    for (let i = 0; i < 6; i++) b.box(0x2563eb, 0.45, 0.45, 0.45, -6 + i * 1, 0, 3);
  }, [
    { name: 'Mr Adebayo', title: 'INEC officer', at: [-5, -5], facing: 0, outfit: 0x166534, gender: 'male', says: 'Bring your voter card. One man, one vote.' },
    { name: 'Miss Halima', title: 'NIMC officer', at: [0, -5], facing: 0, outfit: 0x1e3a8a, gender: 'female', says: 'NIN enrolment: fingerprints, photo, and you are done.' },
  ], [
    { id: 'inec', name: '🆔 Voter registration', at: [-5, -4], stand: [-5, -2.8], who: 'Mr Adebayo', role: 'INEC', text: 'Register to vote, or check your name.', choices: [
      buy('Register and collect a Permanent Voter Card', 0, { id: 'pvc', name: 'Permanent Voter Card (PVC)', icon: '🆔', price: 0, category: 'document', usable: false, description: 'Your voter card. Keep it safe for election day.' }, 'Thumbprint, photo, and the PVC is in your hand.', 'Free'),
      { label: 'Check my name on the register', note: 'Free', arms: 'reach', effect: () => {}, said: 'Your name is on the register, page 14.' },
    ] },
    { id: 'nin', name: '🧾 NIN enrolment', at: [0, -4], stand: [0, -2.8], who: 'Miss Halima', role: 'NIMC', text: 'Fingerprints and photo, please.', choices: [
      buy('Enrol for my NIN', 0, { id: 'nin_slip', name: 'NIN slip (National Identity Number)', icon: '🧾', price: 0, category: 'document', usable: false, description: 'Your National Identity Number. Banks and SIM cards ask for it.' }, 'Ten fingers, one photo, and your NIN slip is printed.', 'Free'),
    ] },
    { id: 'ballot', name: '🗳️ The ballot box', at: [7.5, -2], stand: [7.5, -0.8], who: 'Presiding officer', role: 'INEC', text: 'Into the booth, one ballot per office.', choices: [{ label: 'Vote in this week\'s election', note: 'Governor, Senator, President', open: 'vote' }] },
  ], [{ at: [-6, 3], facing: 0, outfit: 0xf97316, sit: true }, { at: [-3, 3], facing: 0, outfit: 0xdb2777, sit: true, gender: 'female' }], [18, 14]),
  venue('afrika-shrine', 'New Afrika Shrine', 'Ikeja · Afrobeat', 'Live Afrobeat · Thursday jam', '#7f1d1d', 0x44403c, 0x7f1d1d, (b) => {
    stage(b, 0, -7, 12, 4, 0x1f2937);
    for (let i = 0; i < 5; i++) b.box([0xdc2626, 0x16a34a, 0x2563eb, 0xf97316, 0x7c3aed][i], 0.1, 3, 3, -11.7, 1, -6 + i * 3.2);
    for (let i = 0; i < 6; i++) b.box([0xef4444, 0x22c55e, 0x3b82f6][i % 3], 0.4, 0.4, 0.4, -5 + i * 2, 4.4, -7, { glow: true });
    counter(b, 8, 6, 4, 0x7f1d1d); bottles(b, 8, 7.8, 4);
  }, [
    { name: 'The band', title: 'Afrobeat band', at: [0, -7.5], facing: 0, outfit: 0xf59e0b, gender: 'male', says: 'Water no get enemy!' },
    { name: 'Bayo', title: 'Barman', at: [8, 7], facing: Math.PI, outfit: 0x111827, gender: 'male', says: 'Cold one?' },
  ], [
    { id: 'floor', name: '🎷 The Thursday jam', at: [0, -3], stand: [0, -2], who: 'Gateman', role: 'New Afrika Shrine', text: 'The band never stops.', choices: [{ label: 'Pay the gate and dance', price: 5000, note: 'Fun +40, Social +20', dance: true, seconds: 10, effect: need({ fun: 40, social: 20 }), said: 'Horns, drums and a crowd dancing till morning.' }] },
    { id: 'bar', name: '🍺 The bar', at: [8, 6], stand: [8, 4.6], who: 'Bayo', role: 'Barman', text: 'Wetin you go drink?', choices: [{ label: 'A cold drink', price: 4000, note: 'Social +8', effect: need({ social: 8 }), said: 'A cold drink and a stranger who became a friend.' }] },
  ], [{ at: [-3, -2], facing: 0, outfit: 0xdc2626 }, { at: [3, -1], facing: 0, outfit: 0xfacc15, gender: 'female' }, { at: [1, 0], facing: 0.4, outfit: 0x16a34a }], [24, 20]),
  venue('redemption-cathedral', 'Redemption Cathedral', 'Island · church', 'Sunday service 8 am & 11 am', '#7f1d1d', 0xe7e5e4, 0xf5f5f4, (b) => {
    pews(b, 6, -3, 7);
    stage(b, 0, -8, 8, 3, 0x7f1d1d);
    b.box(0xfacc15, 0.3, 2.6, 0.3, 0, 0.7, -9).box(0xfacc15, 1.6, 0.3, 0.3, 0, 2.5, -9, { glow: true });
    b.box(0x78350f, 0.8, 1.1, 0.6, 0, 0.7, -7.2); b.box(0xd4af37, 0.6, 0.5, 0.5, 6, 0, 7);
  }, [{ name: 'Pastor Daniel', title: 'Pastor', at: [0, -7.8], facing: 0, outfit: 0x111827, gender: 'male', tie: true, says: 'Welcome to the house of God!' }, { name: 'Sister Grace', title: 'Usher', at: [6, 6], facing: Math.PI, outfit: 0xf8fafc, gender: 'female', says: 'Welcome, sit anywhere.' }], [
    { id: 'pew', name: '⛪ Join the service', at: [-4.3, -3], stand: [-4.3, -2.5], who: 'Sister Grace', role: 'Usher', text: 'Come and sit down.', choices: [{ label: 'Sit through the service', note: 'Social +20, Fun +10', sit: true, arms: 'rest', seconds: 8, effect: need({ social: 20, fun: 10 }), said: 'The choir lifted the roof. You feel light.' }] },
    { id: 'offering', name: '🙏 Offering box', at: [6, 7], stand: [6, 5.8], who: 'Sister Grace', role: 'Usher', text: 'Give what you can.', choices: [{ label: 'Give an offering', price: 2000, note: 'Social +8', effect: need({ social: 8 }), said: 'God bless you! Your offering is received.' }, { label: 'Give a big seed', price: 50000, note: 'Social +20', effect: need({ social: 20 }), said: 'The pastor prayed for you by name.' }] },
  ], [{ at: [4.3, -3], facing: Math.PI, outfit: 0xdb2777, sit: true, gender: 'female' }, { at: [-4.3, -0.2], facing: Math.PI, outfit: 0x2563eb, sit: true }], [20, 22]),
  venue('central-mosque', 'Lagos Central Mosque', 'Lagos Island · mosque', 'Jumat prayers Friday 1 pm', '#15803d', 0x065f46, 0xf8fafc, (b) => {
    for (let r = 0; r < 4; r++) for (let i = 0; i < 7; i++) b.box([0x991b1b, 0x15803d, 0x1e3a8a][(i + r) % 3], 1, 0.03, 1.8, -6 + i * 2, 0.01, -5 + r * 2.4);
    b.box(0xd4af37, 1.6, 3, 0.3, 0, 0, -8.8); for (let i = 0; i < 5; i++) b.cylinder(0xcbd5e1, 0.05, 0.6, -8 + i * 0.6, 0.6, 7.5).box(0x9ca3af, 3.4, 0.6, 0.6, -6.8, 0, 7.8);
  }, [{ name: 'Imam Abdullahi', title: 'Imam', at: [0, -8], facing: 0, outfit: 0xf8fafc, gender: 'male', says: 'Assalamu alaikum. You are welcome.' }], [
    { id: 'pray', name: '🕌 Pray', at: [0, -5], stand: [0, -5], who: 'Imam Abdullahi', role: 'Imam', text: 'Shoes off, and pray in peace.', choices: [{ label: 'Pray', note: 'Social +15, Fun +8', sit: true, arms: 'greet', seconds: 6, effect: need({ social: 15, fun: 8 }), said: 'You prayed in peace. The noise of the road is far away.' }] },
    { id: 'wudu', name: '🚰 Ablution taps', at: [-6.8, 7.8], stand: [-6.8, 6.6], who: 'Ablution', role: 'Lagos Central Mosque', text: 'Wash before you pray.', choices: [{ label: 'Wash', note: 'Hygiene +20', arms: 'reach', seconds: 3, effect: need({ hygiene: 20 }), said: 'Cool water on your hands, face and feet.' }] },
  ], [{ at: [-4, -2.6], facing: Math.PI, outfit: 0xf8fafc, sit: true }, { at: [4, -2.6], facing: Math.PI, outfit: 0xe7e5e4, sit: true }]),
  venue('sankofa-motors', 'Sankofa Motors', 'Mainland · car showroom', 'New & tokunbo', '#0f172a', 0xf8fafc, 0x0f172a, (b) => {
    for (const x of [-7, 0, 7]) b.cylinder(0xd4d4d8, 2.6, 0.12, x, 0, -3, { sides: 24 });
    desk(b, -6, 6); desk(b, 6, 6);
  }, [{ name: 'Mr Kunle', title: 'Sales manager', at: [-6, 5], facing: 0, outfit: 0x0f172a, gender: 'male', tie: true, says: 'Welcome! Which one is catching your eye?' }], [
    { id: 'sales', name: '🚗 Talk to sales', at: [-6, 6], stand: [-6, 7.4], who: 'Mr Kunle', role: 'Sales manager', text: 'Corolla or Chiron, we have it.', choices: [{ label: 'See every car and buy', note: 'Opens Cars', open: 'app:garage' }] },
  ], [{ at: [2, 0], facing: -0.6, outfit: 0xf8fafc }], [24, 18]),
  venue('shopwell-mall', 'The Palms Mall', 'Lekki · mall', 'Supermarket · Food court · Cinema', '#dc2626', 0xf1f5f9, 0xf8fafc, (b) => {
    for (let i = 0; i < 4; i++) shelf(b, -8 + i * 3.5, -6, 2.8, [0xdc2626, 0xfacc15, 0x2563eb, 0x16a34a, 0xf8fafc]);
    for (const x of [-6, -3]) counter(b, x, 0, 1.6, 0xdc2626);
    counter(b, 7, -3, 4, 0xf59e0b); for (const [x, z] of [[5, 2], [8, 2], [5, 5.5], [8, 5.5]]) table(b, x, z, 0xf8fafc, 2, 0xdc2626);
    screen(b, -5, 8.7, 4, 1.4, 2.4, 0x7c3aed);
  }, [{ name: 'Cashier Nkem', title: 'Cashier', at: [-6, -1], facing: Math.PI, outfit: 0xdc2626, gender: 'female', says: 'Next customer!' }, { name: 'Chef Ali', title: 'Shawarma', at: [7, -4], facing: 0, outfit: 0xf8fafc, gender: 'male', chef: true, says: 'Shawarma with double sausage?' }], [
    { id: 'shelves', name: '🛒 Shop the shelves', at: [-3, -6], stand: [-3, -4.8], who: 'Supermarket', role: 'The Palms', text: 'Everything under one roof.', choices: [{ label: 'Shop', note: 'Opens Shopping', open: 'app:shopping' }] },
    { id: 'food', name: '🌯 Food court', at: [7, -3], stand: [7, -1.7], who: 'Chef Ali', role: 'Shawarma', text: 'Wetin you want?', choices: [{ label: 'Shawarma and a Coke', price: 5500, note: 'Hunger +45', sit: true, seconds: 5, effect: need({ hunger: 45 }), said: 'Double sausage, extra cream. Correct shawarma.' }] },
    { id: 'cinema', name: '🎬 Cinema', at: [-5, 8.6], stand: [-5, 7.4], who: 'Box office', role: 'Cinema', text: 'Nollywood blockbuster at 7.', choices: [{ label: 'A ticket and popcorn', price: 7000, note: 'Fun +30', sit: true, arms: 'rest', seconds: 8, effect: need({ fun: 30 }), said: 'Funke Akindele had the whole hall laughing.' }] },
  ], [{ at: [5, 2.95], facing: Math.PI, outfit: 0x2563eb, sit: true }, { at: [-3, -3], facing: 0, outfit: 0xec4899, gender: 'female' }], [24, 20]),
  venue('eko-grand-hotel', 'Eko Grand Hotel', 'Mainland · hotel', '★★★★★ · Rooms · Restaurant', '#b45309', 0xf5f5f4, 0xe7d3b3, (b) => {
    counter(b, -5, -6, 6, 0xb45309, 0xf8fafc);
    b.cylinder(0xfacc15, 0.1, 1.2, 0, 3.8, 0).dome(0xfde68a, 0.9, 0, 3.4, 0, { glow: true });
    b.box(0x0284c7, 6, 0.1, 4, 6, 0.01, 5, { glow: true });
    for (const [x, z] of [[-6, 3], [-3, 3]]) table(b, x, z, 0xf8fafc, 4, 0xb45309);
    b.box(0x7c2d12, 2.4, 0.6, 2, 6, 0, -6).box(0xf8fafc, 2.2, 0.2, 1.8, 6, 0.6, -6);
  }, [{ name: 'Front desk', title: 'Receptionist', at: [-5, -7], facing: 0, outfit: 0xb45309, gender: 'female', says: 'Welcome to Eko Grand. How can we help?' }], [
    { id: 'reception', name: '🛎️ Reception', at: [-5, -6], stand: [-5, -4.6], who: 'Front desk', role: 'Eko Grand Hotel', text: 'A room for the night?', choices: [{ label: 'Check in for the night', price: 85000, note: 'Energy full', arms: 'reach', effect: (be) => { (be as unknown as { rest(e: number, h: number): void }).rest(100, 20); need({ hygiene: 60 })(be as never); }, said: 'Cold AC, soft bed, hot shower. You slept like a king.' }] },
    { id: 'restaurant', name: '🍽️ Restaurant', at: [-6, 3], stand: [-6, 3.95], who: 'Waiter', role: 'Eko Grand Hotel', text: 'Lunch?', choices: [{ label: 'Seafood okra and pounded yam', price: 18000, note: 'Hunger +60', sit: true, seconds: 6, effect: need({ hunger: 60, fun: 10 }), said: 'Seafood okra, five-star style.' }] },
    { id: 'pool', name: '🏊 The pool', at: [6, 5], stand: [3.5, 5], who: 'Pool attendant', role: 'Eko Grand Hotel', text: 'Towel?', choices: [{ label: 'A swim', price: 10000, note: 'Fun +25, Hygiene +20', arms: 'swing', seconds: 6, effect: need({ fun: 25, hygiene: 20 }), said: 'Cool water, warm sun. You floated for an hour.' }] },
  ], [{ at: [-3, 3.95], facing: Math.PI, outfit: 0x0f172a, sit: true }], [22, 20]),
  venue('police-command', 'Lagos State Police Command', 'Ikeja · police', 'Police is your friend · 112', '#1d4ed8', 0x94a3b8, 0x1e293b, (b) => {
    counter(b, -4, -5, 5, 0x1e3a8a); desk(b, 4, -4);
    for (const x of [6, 8]) b.box(0x3f3f46, 0.08, 3, 3, x, 0, 5);
    for (let i = 0; i < 4; i++) b.box(0x3f3f46, 0.45, 0.45, 0.45, -6 + i, 0, 4);
  }, [{ name: 'Sgt. Danladi', title: 'Desk sergeant', at: [-4, -6], facing: 0, outfit: 0x0f172a, gender: 'male', cap: true, says: 'Yes? Wetin happen?' }], [
    { id: 'desk', name: '👮 Front desk', at: [-4, -5], stand: [-4, -3.6], who: 'Sgt. Danladi', role: 'Desk sergeant', text: 'State your business.', choices: [
      { label: 'Report a crime', note: 'Free', arms: 'talk', seconds: 3, effect: () => {}, said: 'The sergeant writes it down: "We go look into am."' },
      buy('Police character certificate', 3500, { id: 'police_cert', name: 'Police character certificate', icon: '📜', price: 3500, category: 'document', usable: false, description: 'A clean police report, for jobs and visas.' }, 'Stamped and signed. A clean report.', 'For jobs and visas'),
    ] },
    { id: 'escort', name: '🚨 Escorts & convoys', at: [4, -4], stand: [4, -2.6], who: 'Inspector Bello', role: 'Escort desk', text: 'For a big man moving round Lagos: we follow you, sirens on, and the road clears.', choices: [
      { label: 'A police escort, three days', note: '₦450,000 · a patrol van', open: 'escort:escort' },
      { label: 'A full convoy, three days', note: '₦3,600,000 · outriders, patrol van, two jeeps', open: 'escort:convoy' },
    ] },
  ], [{ at: [-5, 4], facing: Math.PI, outfit: 0xf97316, sit: true }], [18, 16]),
  venue('efcc-office', 'EFCC Zonal Office', 'Ikoyi · government', 'Economic and Financial Crimes Commission', '#166534', 0xe5e7eb, 0xd6d3d1, (b) => {
    counter(b, 0, -5, 6, 0x166534); for (let i = 0; i < 3; i++) desk(b, -5 + i * 5, 2);
  }, [{ name: 'Officer Musa', title: 'EFCC officer', at: [0, -6], facing: 0, outfit: 0x166534, gender: 'male', says: 'Where did the money come from?' }], [
    { id: 'enquiries', name: '🏛️ Enquiries', at: [0, -5], stand: [0, -3.6], who: 'Officer Musa', role: 'EFCC', text: 'Petition or enquiry?', choices: [
      { label: 'Ask if there is a file on me', note: 'Free', arms: 'talk', seconds: 3, effect: () => {}, said: '"No file on you for now. Make you keep am so."' },
      { label: 'Write a petition', note: 'Social +5', arms: 'reach', seconds: 4, effect: need({ social: 5 }), said: 'Petition stamped and received.' },
    ] },
  ]),
  venue('government-house', 'Lagos State Government House', 'Alausa · government', 'Office of the Governor', '#166534', 0xe7e5e4, 0xf8fafc, (b) => {
    counter(b, 0, -6, 6, 0x166534, 0xd4af37);
    for (let f = 0; f < 3; f++) b.box(f === 1 ? 0xffffff : 0x16a34a, 0.8, 1.6, 0.05, -0.8 + f * 0.8, 3, -8.8);
    for (const x of [-7, 7]) b.cylinder(0xf8fafc, 0.4, 5, x, 0, -4);
    for (let i = 0; i < 6; i++) b.box(0x7c2d12, 0.5, 0.45, 0.5, -3 + i * 1.2, 0, 3);
  }, [{ name: 'Chief of Staff', title: 'Chief of Staff', at: [0, -7], facing: 0, outfit: 0x111827, gender: 'male', tie: true, says: 'His Excellency is in a meeting.' }], [
    { id: 'house', name: '🏛️ Lagos State House', at: [0, -6], stand: [0, -4.6], who: 'Chief of Staff', role: 'Government House', text: 'Laws, the cabinet and the election.', choices: [{ label: 'Open the State House', note: 'Pay is collected here', open: 'house' }] },
  ]),
];

/** The mart at each filling station */
const mart = (key: string, name: string): PlaceSpec => venue(key, name, 'Filling station · mart', 'Petrol · Shop · Air', '#15803d', 0xf1f5f9, 0xf8fafc, (b) => {
  for (let i = 0; i < 3; i++) shelf(b, -4 + i * 3, -3, 2.4, [0x2563eb, 0xfacc15, 0xdc2626, 0x16a34a]);
  counter(b, 3, 2, 3, 0x15803d);
}, [{ name: 'Cashier', title: 'Mart cashier', at: [3, 1], facing: 0, outfit: 0x15803d, gender: 'female', says: 'Anything else?' }], [
  { id: 'shelf', name: '🛒 The shelves', at: [-1, -3], stand: [-1, -1.8], who: 'Cashier', role: name, text: 'Water, snacks, engine oil.', choices: [
    buy('Bottled water', 300, item('mart_water', 'Bottled water', '💧', 300, 'food', true, 5), 'Cold bottled water.'),
    buy('Meat pie and a drink', 2500, item('mart_pie', 'Meat pie and a drink', '🥧', 2500, 'food', true, 15), 'Warm meat pie.'),
    buy('Engine oil, 4 litres', 9500, { id: 'engine_oil', name: 'Engine oil, 4 litres', icon: '🛢️', price: 9500, category: 'tool', usable: false, description: 'For your car, at the next service.' }, 'A can of engine oil.'),
  ] },
], [], [12, 10]);


// --- Ikeja, on Ikorodu Road ----------------------------------------------------------------------

const gadget = (id: string, name: string, icon: string, price: number) => buy(name, price, { id, name, icon, price, category: 'gadget', usable: false, description: `Bought at Computer Village. ${name}, sealed, with warranty.` }, `${name}: unboxed, checked, sealed again in front of you. Warranty card stamped.`, 'Sealed, with warranty');
/** A glass counter of gadgets with its seller behind it */
const glassCase = (b: Builder, x: number, z: number, goods: number) => {
  b.box(0x1f2937, 3, 0.9, 1, x, 0, z).box(0xbfe3ff, 3, 0.25, 1, x, 0.9, z);
  for (let i = 0; i < 5; i++) b.box(goods, 0.25, 0.05, 0.45, x - 1.1 + i * 0.55, 0.95, z);
  b.box(0x0f172a, 3, 1.6, 0.3, x, 1.2, z - 1.4);
};

const IKEJA: PlaceSpec[] = [
  venue('computer-village', 'Computer Village', 'Ikeja · Otigba', 'Phones · Laptops · Audio · Watches · Consoles · Repairs', '#1d4ed8', 0xd4d4d8, 0xbfdbfe, (b) => {
    glassCase(b, -8, -6, 0x111827); glassCase(b, -2, -6, 0x94a3b8); glassCase(b, 4, -6, 0xf8fafc); glassCase(b, 10, -6, 0x27272a);
    b.box(0x78350f, 2.4, 0.9, 1, -8, 0, 3).box(0x22d3ee, 0.6, 0.02, 0.4, -8, 0.92, 3, { glow: true });
    for (let i = 0; i < 6; i++) b.box([0xdc2626, 0x2563eb, 0xfacc15][i % 3], 0.1, 0.9, 2.6, -13.8, 2.6, -8 + i * 3);
  }, [
    { name: 'Emeka Phones', title: 'Phone dealer', at: [-8, -7.2], facing: 0, outfit: 0x2563eb, gender: 'male', says: 'Customer! Original phones, UK-used and new. Come check.' },
    { name: 'Tunde Laptops', title: 'Laptop dealer', at: [-2, -7.2], facing: 0, outfit: 0x111827, gender: 'male', says: 'Laptops for school, for work, for gaming.' },
    { name: 'Chioma', title: 'Audio & watches', at: [4, -7.2], facing: 0, outfit: 0xdb2777, gender: 'female', says: 'Earbuds, headphones, smartwatches. All original.' },
    { name: 'Gamer Joe', title: 'Consoles', at: [10, -7.2], facing: 0, outfit: 0x7c3aed, gender: 'male', says: 'PS5? FIFA? I get am.' },
    { name: 'Engineer Sola', title: 'Phone repairer', at: [-8, 1.8], facing: 0, outfit: 0xf59e0b, gender: 'male', says: 'Broken screen? Water damage? I go fix am now now.' },
  ], [
    { id: 'phones', name: '📱 Phones', at: [-8, -6], stand: [-8, -4.7], who: 'Emeka Phones', role: 'Phone dealer', text: 'Which one you want?', choices: [
      gadget('ph_starter', 'Starter Android phone', '📱', 115000), gadget('ph_mid', 'Mid-range phone', '📱', 340000), gadget('ph_camera', 'Camera flagship phone', '📱', 1450000), gadget('ph_promax', 'Pro Max flagship phone', '📱', 2650000), gadget('ph_fold', 'Foldable phone', '📱', 3100000),
    ] },
    { id: 'laptops', name: '💻 Laptops & tablets', at: [-2, -6], stand: [-2, -4.7], who: 'Tunde Laptops', role: 'Laptop dealer', text: 'For work or for school?', choices: [
      gadget('lt_student', 'Student laptop', '💻', 480000), gadget('lt_pro', 'Pro laptop', '💻', 2800000), gadget('tb_tablet', 'Tablet', '📲', 450000),
    ] },
    { id: 'audio', name: '🎧 Audio & watches', at: [4, -6], stand: [4, -4.7], who: 'Chioma', role: 'Audio & watches', text: 'Earbuds or a watch?', choices: [
      gadget('au_wired', 'Wired earpiece', '🎧', 4500), gadget('au_buds', 'Wireless earbuds', '🎧', 32000), gadget('au_anc', 'Noise-cancelling earbuds', '🎧', 290000), gadget('wt_band', 'Fitness band', '⌚', 32000), gadget('wt_smart', 'Smartwatch', '⌚', 210000),
    ] },
    { id: 'consoles', name: '🎮 Consoles', at: [10, -6], stand: [10, -4.7], who: 'Gamer Joe', role: 'Consoles', text: 'You wan play?', choices: [
      gadget('cn_stick', 'Retro game stick', '🎮', 48000), gadget('cn_hand', 'Handheld console', '🎮', 520000), gadget('cn_next', 'Next-gen console', '🎮', 980000),
    ] },
    { id: 'repair', name: '🔧 Phone repairs', at: [-8, 3], stand: [-8, 4.3], who: 'Engineer Sola', role: 'Phone repairer', text: 'Wetin happen to your phone?', choices: [
      { label: 'Replace my cracked screen', price: 35000, note: 'While you wait', arms: 'reach', seconds: 5, effect: () => {}, said: 'Twenty minutes, one tiny screwdriver, and your screen is like new.' },
      buy('A power bank, 20,000 mAh', 25000, { id: 'powerbank', name: 'Power bank, 20,000 mAh', icon: '🔋', price: 25000, category: 'gadget', usable: false, description: 'For when NEPA takes light.' }, 'Charged and tested.'),
    ] },
  ], [{ at: [0, 0], facing: 2, outfit: 0x16a34a }, { at: [6, 1], facing: -1, outfit: 0xec4899, gender: 'female' }], [30, 20]),
  venue('ikeja-city-mall', 'Ikeja City Mall', 'Ikeja · Alausa', 'Supermarket · Cinema · Food court', '#dc2626', 0xf1f5f9, 0xf8fafc, (b) => {
    for (let i = 0; i < 5; i++) shelf(b, -10 + i * 3.4, -7, 2.8, [0xdc2626, 0xfacc15, 0x16a34a, 0x2563eb, 0xf8fafc]);
    for (const x of [-8, -5, -2]) counter(b, x, -1, 1.6, 0xdc2626);
    counter(b, 8, -2, 4, 0xf97316); for (const [x, z] of [[6, 3], [9, 3], [6, 6], [9, 6]]) table(b, x, z, 0xf8fafc, 2, 0xf97316);
    screen(b, -6, 8.7, 5, 1.6, 2.4, 0x7c3aed);
  }, [{ name: 'Cashier Bola', title: 'Cashier', at: [-5, -2], facing: Math.PI, outfit: 0xdc2626, gender: 'female', says: 'Next!' }, { name: 'Food court', title: 'Grill', at: [8, -3], facing: 0, outfit: 0xf8fafc, gender: 'male', chef: true, says: 'Chicken and chips?' }], [
    { id: 'groceries', name: '🛒 Supermarket', at: [-3, -7], stand: [-3, -5.8], who: 'Supermarket', role: 'Ikeja City Mall', text: 'Fill your trolley.', choices: [
      buy('A week of groceries', 45000, item('groceries_week', 'A week of groceries', '🛒', 45000, 'food', true, 30), 'Rice, bread, eggs, milk, noodles, drinks: the trolley is full.'),
      { label: 'Shop the shelves', note: 'Opens Shopping', open: 'app:shopping' },
    ] },
    { id: 'food', name: '🍗 Food court', at: [8, -2], stand: [8, -0.7], who: 'Grill', role: 'Food court', text: 'What will it be?', choices: [{ label: 'Chicken and chips with a Coke', price: 6000, note: 'Hunger +45', sit: true, seconds: 5, effect: need({ hunger: 45 }), said: 'Hot chicken, crispy chips, cold Coke.' }] },
    { id: 'cinema', name: '🎬 Cinema', at: [-6, 8.6], stand: [-6, 7.4], who: 'Box office', role: 'Cinema', text: 'Next show in ten minutes.', choices: [{ label: 'A ticket and popcorn', price: 7000, note: 'Fun +30', sit: true, arms: 'rest', seconds: 8, effect: need({ fun: 30 }), said: 'The whole hall screamed at the twist.' }] },
  ], [{ at: [6, 3.95], facing: Math.PI, outfit: 0x2563eb, sit: true }, { at: [-8, -4], facing: 0, outfit: 0xf59e0b, gender: 'female' }], [26, 20]),
  venue('allen-lounge', 'Allen Lounge', 'Ikeja · Allen Avenue', 'Afrobeats · Shisha · Small chops', '#db2777', 0x1c1917, 0x111827, (b) => {
    counter(b, 0, -6, 8, 0x111827, 0xdb2777); bottles(b, 0, -7.8, 8);
    for (const [x, z] of [[-6, 2], [-2, 4], [2, 4], [6, 2]]) { b.box(0x7c3aed, 2.2, 0.45, 0.9, x, 0, z).box(0x7c3aed, 2.2, 0.55, 0.2, x, 0.45, z + 0.4); b.cylinder(0x111827, 0.4, 0.5, x, 0, z - 1.1, { sides: 12 }).cylinder(0x22d3ee, 0.08, 0.6, x + 0.2, 0.5, z - 1.1, { glow: true }); }
    b.box(0x22d3ee, 6, 0.05, 4, 0, 0.01, -2, { glow: true });
  }, [{ name: 'Barman Ike', title: 'Barman', at: [0, -7], facing: 0, outfit: 0x111827, gender: 'male', says: 'What are we drinking tonight?' }], [
    { id: 'bar', name: '🍾 The bar', at: [0, -6], stand: [0, -4.7], who: 'Barman Ike', role: 'Allen Lounge', text: 'Bottle or cocktail?', choices: [
      { label: 'A cocktail', price: 15000, note: 'Fun +20', effect: need({ fun: 20, social: 10 }), said: 'A cold cocktail and the bass in your chest.' },
      { label: 'A bottle at a table', price: 250000, note: 'Social +35', sit: true, seconds: 5, effect: need({ social: 35, fun: 25 }), said: 'The sparklers came out to your table.' },
    ] },
    { id: 'shisha', name: '💨 Shisha & small chops', at: [-6, 2], stand: [-6, 1.5], who: 'Waitress', role: 'Allen Lounge', text: 'Flavour?', choices: [{ label: 'Shisha and a small chops platter', price: 27000, note: 'Fun +20, Hunger +30', sit: true, seconds: 6, effect: need({ fun: 20, hunger: 30, social: 10 }), said: 'Mint shisha, puff-puff, samosa and spring rolls.' }] },
    { id: 'floor', name: '💃 The dance floor', at: [0, -2], stand: [0, -2], who: 'DJ', role: 'Allen Lounge', text: 'Oya shake body!', choices: [{ label: 'Dance', note: 'Fun +30', dance: true, seconds: 8, effect: need({ fun: 30, social: 10 }), said: 'The DJ played your song. You owned the floor.' }] },
  ], [{ at: [-2, 4.4], facing: Math.PI, outfit: 0xf8fafc, sit: true, gender: 'female' }, { at: [1, -2], facing: 0.6, outfit: 0xfacc15 }], [20, 18]),
  venue('oshodi-interchange', 'Oshodi Transport Interchange', 'Oshodi · terminal', 'BRT · Danfo · Interstate', '#1d4ed8', 0xd4d4d8, 0xe0f2fe, (b) => {
    for (const x of [-6, 0, 6]) counter(b, x, -6, 3, 0x1d4ed8, 0xf8fafc);
    screen(b, 0, -8.7, 10, 1.4, 3.2, 0xfacc15);
    for (let r = 0; r < 3; r++) bench(b, -4 + r * 4, 3, 3, 0x9ca3af);
    counter(b, 9, 5, 2.4, 0xf59e0b);
  }, [
    { name: 'Ticket clerk', title: 'BRT tickets', at: [-6, -7], facing: 0, outfit: 0x1d4ed8, gender: 'female', says: 'Cowry card or ticket?' },
    { name: 'Interstate clerk', title: 'Interstate buses', at: [6, -7], facing: 0, outfit: 0x15803d, gender: 'male', says: 'Abuja, Port Harcourt, everywhere.' },
    { name: 'Mama Puff', title: 'Snacks', at: [9, 4], facing: 0, outfit: 0xf59e0b, gender: 'female', says: 'Puff-puff, hot!' },
  ], [
    { id: 'brt', name: '🚌 BRT to the island', at: [-6, -6], stand: [-6, -4.7], who: 'Ticket clerk', role: 'BRT tickets', text: 'CMS, Obalende, TBS.', choices: [{ label: 'Take the BRT to Lagos Island', note: 'To Broad Street', open: 'bus-island' }] },
    { id: 'interstate', name: '🚍 Interstate buses', at: [6, -6], stand: [6, -4.7], who: 'Interstate clerk', role: 'Interstate buses', text: 'Where you dey go?', choices: [{ label: 'Buses to Abuja and Port Harcourt', note: 'Tickets', open: 'interstate' }] },
    { id: 'snacks', name: '🍩 Puff-puff', at: [9, 5], stand: [9, 6.3], who: 'Mama Puff', role: 'Snacks', text: 'How many?', choices: [buy('A nylon of puff-puff', 1000, item('puffpuff', 'Nylon of puff-puff', '🍩', 1000, 'food', true, 12), 'Ten hot puff-puff in a nylon.')] },
  ], [{ at: [-4, 3.3], facing: Math.PI, outfit: 0x2563eb, sit: true }, { at: [4, 3.3], facing: Math.PI, outfit: 0xdb2777, sit: true, gender: 'female' }, { at: [1, -2], facing: 0, outfit: 0xf97316 }], [22, 18]),
  venue('lasuth', 'LASUTH', 'Ikeja · teaching hospital', 'A&E 24 hours · Clinics · Pharmacy', '#dc2626', 0xf1f5f9, 0xe0f2fe, (b) => {
    counter(b, -5, -6, 5, 0xf8fafc, 0x93c5fd); shelf(b, 6, -7, 4, [0xf8fafc, 0x22c55e, 0xdc2626]); counter(b, 6, -5, 4, 0x16a34a, 0xf8fafc);
    for (let i = 0; i < 3; i++) b.box(0xf8fafc, 1.1, 0.6, 2.2, -6 + i * 3, 0, 4).box(0x93c5fd, 1, 0.15, 2, -6 + i * 3, 0.6, 4);
  }, [
    { name: 'Nurse Amaka', title: 'Nurse', at: [-5, -7], facing: 0, outfit: 0x5eead4, gender: 'female', says: 'Your card, please. The doctor will see you.' },
    { name: 'Pharmacist Bayo', title: 'Pharmacist', at: [6, -6], facing: 0, outfit: 0xf8fafc, gender: 'male', says: 'Prescription?' },
  ], [
    { id: 'clinic', name: '🩺 See a doctor', at: [-5, -6], stand: [-5, -4.7], who: 'Nurse Amaka', role: 'LASUTH', text: 'What is the problem?', choices: [{ label: 'Consultation and treatment', price: 15000, note: 'Health +30', sit: true, seconds: 5, effect: need({ health: 30 }), said: 'The doctor checked you well and wrote a prescription.' }] },
    { id: 'pharmacy', name: '💊 Pharmacy', at: [6, -5], stand: [6, -3.7], who: 'Pharmacist Bayo', role: 'Pharmacy', text: 'What do you need?', choices: [
      buy('Malaria treatment', 6500, { id: 'malaria_pack', name: 'Malaria treatment pack', icon: '💊', price: 6500, category: 'medicine', usable: true, description: 'Three days of tablets. Finish the dose.' }, 'Three days of tablets. Finish the dose.'),
      buy('Paracetamol', 1000, { id: 'paracetamol', name: 'Paracetamol', icon: '💊', price: 1000, category: 'medicine', usable: true, description: 'For headache and fever.' }, 'A strip of paracetamol.'),
    ] },
    { id: 'ward', name: '🛏️ Admission', at: [-3, 4], stand: [-3, 2.4], who: 'Nurse Amaka', role: 'Ward', text: 'Stay the night and rest.', choices: [{ label: 'Admitted overnight', price: 45000, note: 'Health +80, Energy full', sit: true, seconds: 6, effect: (be) => { need({ health: 80 })(be as never); (be as unknown as { rest(e: number, h: number): void }).rest(100, 20); }, said: 'Drip, rest, good care. You walk out strong.' }] },
  ], [{ at: [-6, 4], facing: 0, outfit: 0x60a5fa, sit: true }], [20, 18]),
  venue('ladipo-auto', 'Ladipo Auto Market', 'Mushin · auto parts', 'Parts · Mechanics · Panel beaters', '#78350f', 0x57534e, 0xd6d3d1, (b) => {
    b.box(0x7f1d1d, 2, 1.3, 4.4, -4, 0, -3).box(0x1e3a8a, 2, 1.3, 4.4, 2, 0, -3);
    for (let i = 0; i < 12; i++) b.cylinder(0x111111, 0.4, 0.25, 7 + (i % 3) * 0.9, Math.floor(i / 3) * 0.25, 4);
    shelf(b, -7, -7.5, 4, [0x52525b, 0xa16207, 0x111827]);
  }, [
    { name: 'Oga Mechanic', title: 'Mechanic', at: [-1, -3], facing: 0, outfit: 0x1e40af, gender: 'male', says: 'Bring your motor. I go fix am sharp sharp.' },
    { name: 'Alhaji Parts', title: 'Parts seller', at: [-7, -6.5], facing: Math.PI, outfit: 0xf8fafc, gender: 'male', says: 'Original or tokunbo?' },
  ], [
    { id: 'mechanic', name: '🔧 The mechanic', at: [-1, -3], stand: [-1, -1.6], who: 'Oga Mechanic', role: 'Mechanic', text: 'Which motor?', choices: [{ label: 'Service and repair my vehicles', note: 'As good as new', open: 'repair' }] },
    { id: 'parts', name: '⚙️ Spare parts', at: [-7, -7.5], stand: [-7, -6.2], who: 'Alhaji Parts', role: 'Parts seller', text: 'Wetin you need?', choices: [
      buy('A new tyre', 85000, { id: 'tyre', name: 'New tyre', icon: '🛞', price: 85000, category: 'tool', usable: false, description: 'A new tyre for your car.' }, 'Rolled to your car.'),
      buy('A car battery', 120000, { id: 'battery', name: 'Car battery', icon: '🔋', price: 120000, category: 'tool', usable: false, description: 'Starts first time, every time.' }, 'Tested on the spot.'),
    ] },
  ], [], [20, 18]),
  venue('ikeja-gra', 'Ikeja GRA Estate Office', 'Ikeja GRA', 'Houses to rent and buy', '#14532d', 0xe7e5e4, 0xfef3c7, (b) => {
    desk(b, -3, -4); desk(b, 3, -4); plant(b, -7, -6); plant(b, 7, -6);
    for (let i = 0; i < 3; i++) b.box([0xfef3c7, 0xe2e8f0, 0xfecaca][i], 2, 1.4, 0.1, -4 + i * 4, 2, -7.9);
  }, [{ name: 'Mrs Adeyemi', title: 'Estate agent', at: [-3, -5], facing: 0, outfit: 0x14532d, gender: 'female', says: 'Welcome to the GRA. Duplex, bungalow or flat?' }], [
    { id: 'agent', name: '🏡 Estate agent', at: [-3, -4], stand: [-3, -2.6], who: 'Mrs Adeyemi', role: 'Estate agent', text: 'Rent or buy?', choices: [{ label: 'See houses to rent and buy', note: 'Opens Houses', open: 'app:property' }] },
  ], [{ at: [6, 1.5], facing: -Math.PI / 2, outfit: 0xf59e0b, gender: 'female' }], [18, 16]),
  venue('chop-express', 'Chop Express', 'Ikeja · fast food', 'Rice · Chicken · Meat pie · Ice cream', '#dc2626', 0xf8fafc, 0xfde68a, (b) => {
    counter(b, 0, -5, 8, 0xdc2626, 0xfacc15); screen(b, 0, -6.8, 6, 1.2, 2.6, 0xfacc15);
    for (const [x, z] of [[-4, 1], [0, 1], [4, 1], [-4, 4], [4, 4]]) table(b, x, z, 0xfacc15, 2, 0xdc2626);
  }, [{ name: 'Server Kemi', title: 'Server', at: [0, -6], facing: 0, outfit: 0xdc2626, gender: 'female', says: 'Welcome to Chop Express! What can I get you?' }], [
    { id: 'counter', name: '🍗 Order', at: [0, -5], stand: [0, -3.7], who: 'Server Kemi', role: 'Chop Express', text: 'Eat in or takeaway?', choices: [
      { label: 'Jollof rice and chicken', price: 4800, note: 'Hunger +55', sit: true, seconds: 5, effect: need({ hunger: 55 }), said: 'Party jollof and a big chicken thigh.' },
      buy('A meat pie', 1500, item('meatpie', 'Meat pie', '🥧', 1500, 'food', true, 12), 'Hot meat pie in a paper bag.'),
      { label: 'Ice cream', price: 2500, note: 'Fun +8', effect: need({ fun: 8, hunger: 8 }), said: 'Vanilla with chocolate sauce.' },
    ] },
  ], [{ at: [-4, 1.95], facing: Math.PI, outfit: 0x2563eb, sit: true }, { at: [4, 4.95], facing: Math.PI, outfit: 0xec4899, sit: true, gender: 'female' }], [16, 14]),
  venue('faith-arena', 'Faith Arena', 'Ikeja · church', 'Sunday 7, 9 & 11 am', '#1e3a8a', 0xe7e5e4, 0xdbeafe, (b) => {
    pews(b, 8, -4, 9);
    stage(b, 0, -10, 14, 4, 0x1e3a8a);
    for (let i = 0; i < 8; i++) b.box(0xf8fafc, 0.5, 1.2, 0.5, -5 + i * 1.4, 0.7, -11);
    screen(b, -9, -11.8, 5, 2.4, 3.4, 0x38bdf8); screen(b, 9, -11.8, 5, 2.4, 3.4, 0x38bdf8);
    b.box(0xd4af37, 0.6, 0.5, 0.5, 9, 0, 9);
  }, [{ name: 'Pastor Ade', title: 'Senior pastor', at: [0, -10], facing: 0, outfit: 0x111827, gender: 'male', tie: true, says: 'Welcome home! Somebody shout Hallelujah!' }, { name: 'Usher Tolu', title: 'Usher', at: [9, 8], facing: Math.PI, outfit: 0x1e3a8a, gender: 'female', says: 'Welcome, follow me.' }], [
    { id: 'service', name: '⛪ The service', at: [-5.3, -4], stand: [-5.3, -3.5], who: 'Usher Tolu', role: 'Usher', text: 'Sit down, the choir is starting.', choices: [
      { label: 'Sit through the service', note: 'Social +25, Fun +15', sit: true, arms: 'rest', seconds: 8, effect: need({ social: 25, fun: 15 }), said: 'A choir of hundreds. The roof nearly came off.' },
      { label: 'Dance in praise', note: 'Fun +20', dance: true, seconds: 8, effect: need({ fun: 20, social: 10 }), said: 'The whole church danced.' },
    ] },
    { id: 'offering', name: '🙏 Offering', at: [9, 9], stand: [9, 7.7], who: 'Usher Tolu', role: 'Usher', text: 'Sow a seed.', choices: [{ label: 'Give an offering', price: 5000, note: 'Social +10', effect: need({ social: 10 }), said: 'The pastor blessed the offering.' }, { label: 'Pay your tithe', price: 100000, note: 'Social +25', effect: need({ social: 25 }), said: 'Recorded, with a receipt and a prayer.' }] },
  ], [{ at: [5.3, -4], facing: Math.PI, outfit: 0xdb2777, sit: true, gender: 'female' }, { at: [-5.3, -1.2], facing: Math.PI, outfit: 0x2563eb, sit: true }, { at: [5.3, -1.2], facing: Math.PI, outfit: 0xf8fafc, sit: true }], [24, 26]),
  venue('mmia-terminal', 'Murtala Muhammed International Airport', 'Ikeja · LOS', 'Departures · Arrivals', '#0b7a43', 0xf1f5f9, 0xe2e8f0, (b) => {
    for (let i = 0; i < 4; i++) counter(b, -9 + i * 4, -7, 3, 0x0b7a43, 0xf8fafc);
    screen(b, 0, -11.8, 12, 2, 3.6, 0xfacc15);
    b.box(0x9ca3af, 0.8, 2.2, 0.3, 6, 0, 0).box(0x9ca3af, 0.8, 2.2, 0.3, 8, 0, 0).box(0x9ca3af, 2.8, 0.3, 0.3, 7, 2.2, 0);
    shelf(b, -9, 6, 4, [0xd4af37, 0x7c3aed, 0xdc2626]); counter(b, -9, 4, 3, 0x7c3aed);
    for (const [x, z] of [[6, 7], [9, 7]]) { b.box(0x1f2937, 2.2, 0.45, 0.9, x, 0, z).box(0x1f2937, 2.2, 0.6, 0.2, x, 0.45, z + 0.4); }
  }, [
    { name: 'Check-in agent', title: 'Check-in', at: [-9, -8], facing: 0, outfit: 0x0b7a43, gender: 'female', says: 'Passport and ticket, please.' },
    { name: 'FAAN officer', title: 'Security', at: [7, -1.2], facing: 0, outfit: 0x0f172a, gender: 'male', cap: true, says: 'Belt, phone and keys in the tray.' },
    { name: 'Duty free', title: 'Duty free', at: [-9, 3], facing: 0, outfit: 0x7c3aed, gender: 'female', says: 'Perfume? Chocolate?' },
  ], [
    { id: 'checkin', name: '🛫 Check-in & flights', at: [-9, -7], stand: [-9, -5.7], who: 'Check-in agent', role: 'Check-in', text: 'Where are you flying to?', choices: [
      { label: 'Through to departures: check-in, security, your gate', note: 'With your ticket', open: 'airside' },
      { label: 'Buy a ticket to Abuja or Port Harcourt', note: 'Tickets', open: 'interstate' },
    ] },
    { id: 'security', name: '🛃 Security', at: [7, 0], stand: [7, 1.4], who: 'FAAN officer', role: 'Security', text: 'Step through.', choices: [{ label: 'Go through security', note: 'Free', arms: 'rest', seconds: 3, effect: () => {}, said: 'Beep? No beep. You are clear.' }] },
    { id: 'dutyfree', name: '🛍️ Duty free', at: [-9, 4], stand: [-9, 2.7], who: 'Duty free', role: 'Duty free', text: 'Tax free!', choices: [
      buy('A bottle of perfume', 120000, { id: 'perfume', name: 'Bottle of perfume', icon: '🧴', price: 120000, category: 'luxury', usable: false, description: 'Duty free, from Murtala Muhammed.' }, 'Gift-wrapped.'),
      buy('A box of chocolates', 8000, item('chocolates', 'Box of chocolates', '🍫', 8000, 'food', true, 10), 'For somebody special.'),
    ] },
    { id: 'lounge', name: '🛋️ Business lounge', at: [6, 7], stand: [6, 6.5], who: 'Lounge host', role: 'Lounge', text: 'Welcome to the lounge.', choices: [{ label: 'Relax in the lounge', price: 40000, note: 'Energy +40, Hunger +30', sit: true, seconds: 6, effect: need({ energy: 40, hunger: 30 }), said: 'Soft chair, cold drink, quiet. Your flight is on time.' }] },
  ], [{ at: [-5, -4], facing: Math.PI, outfit: 0x2563eb }, { at: [9, 7.4], facing: Math.PI, outfit: 0x111827, sit: true }, { at: [2, 3], facing: 0.4, outfit: 0xdb2777, gender: 'female' }], [26, 24]),
];


// --- The outdoor places, gone into: the beach, the golf clubhouse, the yacht club, the jet terminal --

/** A beach umbrella with a lounger under it */
const umbrella = (b: Builder, x: number, z: number, colour: number) => {
  b.cylinder(0x78350f, 0.05, 2.3, x, 0, z).cone(colour, 1.4, 0.8, x, 2.1, z, 10);
  b.box(0xf8fafc, 0.7, 0.3, 1.8, x + 1.1, 0, z, { pitch: -0.12 });
};
const palm = (b: Builder, x: number, z: number) => {
  b.cylinder(0x92400e, 0.22, 5.5, x, 0, z, { topRadius: 0.16 });
  for (let f = 0; f < 6; f++) b.box(0x16a34a, 0.35, 0.08, 2.6, x + Math.sin(f) * 1, 5.5, z + Math.cos(f) * 1, { yaw: f, pitch: -0.4 });
};

const OUTDOOR: PlaceSpec[] = [
  venue('lagoon-beach', 'Elegushi Beach', 'Lekki · beach', 'Beach bar · Cabanas · Horses · Beach party', '#0e7490', 0xe8d5a3, 0x7dd3fc, (b) => {
    // The water at the back, the wash of the waves along it
    b.box(0x0ea5e9, 30, 0.05, 6, 0, 0.01, -9.5);
    for (let i = 0; i < 6; i++) b.box(0xf8fafc, 4, 0.03, 0.15, -12 + i * 5, 0.06, -6.6 + (i % 2) * 0.3);
    for (let i = 0; i < 6; i++) umbrella(b, -10 + i * 4, -3, [0xdc2626, 0xfacc15, 0x16a34a, 0x2563eb, 0xf97316, 0xdb2777][i]);
    // Cabanas: a curtained bed under a white roof
    for (const x of [-9, -4]) b.box(0xf8fafc, 3, 0.1, 3, x, 2.6, 4).box(0xfef3c7, 2.4, 0.5, 2, x, 0, 4).box(0xf8fafc, 0.08, 2.6, 0.08, x - 1.4, 0, 2.6).box(0xf8fafc, 0.08, 2.6, 0.08, x + 1.4, 0, 2.6);
    // The bar hut, the DJ's table and speakers, palms, and the horses
    counter(b, 8, 4, 4, 0xb45309); b.cone(0xd6b46a, 3.6, 1.4, 8, 2.6, 3.5, 4);
    b.box(0x111827, 2, 0.9, 0.8, -1, 0, -1).box(0x22d3ee, 1.8, 0.04, 0.6, -1, 0.91, -1, { glow: true }).box(0x111827, 0.8, 1.6, 0.8, -3, 0, -1).box(0x111827, 0.8, 1.6, 0.8, 1, 0, -1);
    palm(b, -12.5, 8); palm(b, 12.5, -4); palm(b, 12, 8);
    for (const [x, c] of [[-11, 0x78350f], [-9.5, 0xf5f5f4]] as Array<[number, number]>) b.box(c, 0.5, 0.8, 1.8, x, 1, 8).box(c, 0.3, 0.7, 0.5, x, 1.6, 8.9, { pitch: -0.5 }).box(0x44403c, 0.12, 1, 0.12, x - 0.15, 0, 7.4).box(0x44403c, 0.12, 1, 0.12, x + 0.15, 0, 8.6);
  }, [
    { name: 'Kunle', title: 'Beach bar', at: [8, 3], facing: 0, outfit: 0xf97316, gender: 'male', says: 'Coconut, Chapman, suya! Cold cold!' },
    { name: 'DJ Spinz', title: 'DJ', at: [-1, -1.8], facing: 0, outfit: 0x7c3aed, gender: 'male', says: 'Beach party every evening! Amapiano till the sun goes down.' },
    { name: 'Baba Horse', title: 'Horse rides', at: [-10.3, 6.4], facing: 0, outfit: 0xf8fafc, gender: 'male', says: 'Ride along the water! Small money.' },
  ], [
    { id: 'bar', name: '🥥 The beach bar', at: [8, 4], stand: [8, 5.3], who: 'Kunle', role: 'Beach bar', text: 'Wetin you go take?', choices: [
      buy('Fresh coconut water', 1500, item('coconut', 'Fresh coconut', '🥥', 1500, 'food', true, 10), 'Cold coconut water, straight from the nut.'),
      { label: 'Suya and a cold drink', price: 4500, note: 'Hunger +35', sit: true, seconds: 4, effect: need({ hunger: 35, fun: 5 }), said: 'Hot suya with yaji, and a cold drink with it.' },
      { label: 'A Chapman in the shade', price: 3000, note: 'Fun +10', effect: need({ fun: 10, hunger: 5 }), said: 'Chapman with cucumber, cold as ice.' },
    ] },
    { id: 'lounger', name: '🏖️ Loungers by the water', at: [-6, -3], stand: [-4.9, -1.8], who: 'Beach attendant', role: 'Elegushi Beach', text: 'Lounger or a cabana?', choices: [
      { label: 'Lie on a lounger by the water', price: 3000, note: 'Fun +30, Energy +10', sit: true, seconds: 6, effect: need({ fun: 30, energy: 10 }), said: 'Breeze, waves, Afrobeats. You needed this.' },
      { label: 'Rent a cabana for the day', price: 25000, note: 'Fun +35, Social +20', sit: true, seconds: 6, effect: need({ fun: 35, social: 20, energy: 15 }), said: 'Curtains, cushions, your own waiter. Big man things.' },
    ] },
    { id: 'horse', name: '🐎 Horse ride', at: [-10.3, 8], stand: [-8.8, 7], who: 'Baba Horse', role: 'Horse rides', text: 'Once along the water and back?', choices: [
      { label: 'Ride a horse along the shore', price: 5000, note: 'Fun +30', arms: 'wave', seconds: 7, effect: need({ fun: 30 }), said: 'Trotting along the water, the wind in your face. Baba Horse held the rope.' },
    ] },
    { id: 'party', name: '🎶 The beach party', at: [-1, -1], stand: [-1, 0.6], who: 'DJ Spinz', role: 'DJ', text: 'Oya, enter the party!', choices: [
      { label: 'Dance on the sand', note: 'Free · Fun +30, Social +15', dance: true, seconds: 8, effect: need({ fun: 30, social: 15 }), said: 'Shoes off, sand everywhere, the whole beach dancing.' },
    ] },
  ], [{ at: [-8.9, -3], facing: Math.PI, outfit: 0xdc2626, sit: true }, { at: [-0.9, -3], facing: Math.PI, outfit: 0xdb2777, sit: true, gender: 'female' }, { at: [2, 0.3], facing: 2.6, outfit: 0xfacc15 }, { at: [-4, 4.2], facing: Math.PI, outfit: 0x0ea5e9, sit: true, gender: 'female' }], [28, 22]),

  venue('ikeja-golf', 'Ikeja Golf Club', 'Ikeja · golf', 'Clubhouse · Pro shop · Putting green · 9 holes', '#14532d', 0x92400e, 0xfef3c7, (b) => {
    // The putting green with its flag, the bar, the pro shop's racks of clubs, the honours board
    b.cylinder(0x4d7c0f, 3.6, 0.06, -5, 0, -2, { sides: 24 }).cylinder(0x111111, 0.12, 0.07, -4, 0, -1.4, { sides: 10 }).cylinder(0xf8fafc, 0.03, 1.6, -4, 0, -1.4).box(0xdc2626, 0.03, 0.35, 0.5, -4, 1.25, -1.15);
    counter(b, 7, -6, 5, 0x78350f, 0xd4af37); bottles(b, 7, -7.8, 5);
    for (let i = 0; i < 3; i++) { b.box(0x1f2937, 1.6, 1.2, 0.5, 6 + i * 1.8, 0, 5); for (let j = 0; j < 5; j++) b.cylinder(0xd1d5db, 0.025, 1.1, 5.5 + i * 1.8 + j * 0.25, 1.1, 5); }
    b.box(0x78350f, 3.6, 2.2, 0.1, -6, 1.2, -8.9).box(0xd4af37, 3.2, 0.2, 0.12, -6, 2.9, -8.9);
    for (const [x, z] of [[-7, 5], [-3, 5]]) table(b, x, z, 0xf8fafc, 4, 0x166534);
  }, [
    { name: 'Mr Oduya', title: 'Club secretary', at: [-6, -7.2], facing: 0, outfit: 0x14532d, gender: 'male', tie: true, says: 'Members and their guests. Green fee for visitors.' },
    { name: 'Musa', title: 'Caddie', at: [-1, -3], facing: -1.2, outfit: 0xfacc15, gender: 'male', says: 'Oga, I sabi this course. Every hole.' },
    { name: 'Barman Tayo', title: 'Clubhouse bar', at: [7, -7], facing: 0, outfit: 0x111827, gender: 'male', says: 'Chapman? Pepper soup?' },
  ], [
    { id: 'course', name: '⛳ Nine holes', at: [-6, -8], stand: [-6, -6.4], who: 'Mr Oduya', role: 'Club secretary', text: 'Guests pay a green fee. Musa will caddie for you.', choices: [
      { label: 'Play nine holes with a caddie', price: 50000, note: 'Fun +40 · Fitness', arms: 'swing', seconds: 7, effect: (be) => { need({ fun: 40, energy: -15 })(be as never); (be as unknown as { addSkillExp(s: string, n: number): void }).addSkillExp('fitness', 1); }, said: 'Two birdies and one ball in the bush. Musa carried the bag and read every green.' },
      { label: 'Become a member', price: 3500000, note: 'Social +30 · a year', arms: 'shake', seconds: 3, effect: need({ social: 30 }), item: { id: 'golf_membership', name: 'Ikeja Golf Club membership card', icon: '⛳', price: 3500000, category: 'document', usable: false, description: 'A member of the Ikeja Golf Club. Your name is on the board.' }, said: 'Welcome to the club. Your name goes on the members’ board.' },
    ] },
    { id: 'green', name: '🏌️ The putting green', at: [-5, -2], stand: [-6.6, -0.6], who: 'Musa', role: 'Caddie', text: 'Practise your putting, free for anybody.', choices: [
      { label: 'Practise putting', note: 'Free · Fun +10', arms: 'swing', seconds: 5, effect: need({ fun: 10 }), said: 'Ten putts. Seven in the hole. Not bad at all.' },
    ] },
    { id: 'bar', name: '🍲 The clubhouse bar', at: [7, -6], stand: [7, -4.7], who: 'Barman Tayo', role: 'Clubhouse bar', text: 'After the round?', choices: [
      { label: 'Pepper soup and a Chapman', price: 9000, note: 'Hunger +40, Social +15', sit: true, seconds: 5, effect: need({ hunger: 40, social: 15 }), said: 'Goat meat pepper soup, and the gist of the nineteenth hole.' },
      { label: 'A drink with the members', price: 6000, note: 'Social +20', effect: need({ social: 20 }), said: 'A retired general told you about the 1985 club championship. Twice.' },
    ] },
    { id: 'shop', name: '🏷️ The pro shop', at: [7.8, 5], stand: [7.8, 3.7], who: 'Pro shop', role: 'Ikeja Golf Club', text: 'Clubs, balls, gloves.', choices: [
      buy('A set of golf clubs and a bag', 450000, { id: 'golf_clubs', name: 'Golf clubs and bag', icon: '🏌️', price: 450000, category: 'luxury', usable: false, description: 'Irons, woods, a putter and a leather bag.' }, 'A full set in a leather bag, carried to your car.', 'Into your bag'),
      buy('A box of golf balls', 15000, { id: 'golf_balls', name: 'Box of golf balls', icon: '⚪', price: 15000, category: 'luxury', usable: false, description: 'A dozen new balls.' }, 'A dozen new balls.', 'Into your bag'),
    ] },
  ], [{ at: [-7, 5.95], facing: Math.PI, outfit: 0xf8fafc, sit: true }, { at: [-3, 4.05], facing: 0, outfit: 0x1e3a8a, sit: true }], [24, 20]),

  venue('lagoon-marina', 'Eko Marina Yacht Club', 'Lagoon · marina', 'Berths · Fuel · Chandlery · Bar on the deck', '#0e7490', 0xe2e8f0, 0xf8fafc, (b) => {
    // Glass across the back, the lagoon beyond it
    b.box(0x0ea5e9, 22, 2.6, 0.1, 0, 0.8, -8.9, { glow: true });
    for (let i = 0; i < 6; i++) b.box(0xf8fafc, 0.06, 2.4, 0.05, -9 + i * 3.6, 1, -8.8);
    counter(b, -6, -6, 4, 0x0e7490, 0xf8fafc);
    shelf(b, 7, 6, 4, [0xf97316, 0xfacc15, 0x0ea5e9, 0xf8fafc]);
    counter(b, 6, -6, 4, 0x78350f, 0xd4af37); bottles(b, 6, -7.8, 4);
    // A model yacht in a glass case, and the deck tables
    b.box(0x111827, 2, 0.9, 0.8, 0, 0, 0).box(0xf8fafc, 1.6, 0.3, 0.4, 0, 0.95, 0).cylinder(0xd1d5db, 0.02, 0.9, 0, 1.25, 0);
    for (const [x, z] of [[3, 1.5], [6, 1.5]]) table(b, x, z, 0xf8fafc, 2, 0x0e7490);
  }, [
    { name: 'Captain Bassey', title: 'Harbour master', at: [-6, -7], facing: 0, outfit: 0xf8fafc, gender: 'male', cap: true, says: 'Welcome aboard. Your berth is ready.' },
    { name: 'Ifeoma', title: 'Chandlery', at: [7, 5], facing: Math.PI, outfit: 0x0e7490, gender: 'female', says: 'Life jackets, ropes, caps, sunscreen.' },
    { name: 'Barman Femi', title: 'Deck bar', at: [6, -7], facing: 0, outfit: 0x111827, gender: 'male', says: 'Something cold on the deck?' },
  ], [
    { id: 'harbour', name: '⚓ The harbour master', at: [-6, -6], stand: [-6, -4.7], who: 'Captain Bassey', role: 'Harbour master', text: 'Your yacht, or a ride on the water?', choices: [
      { label: 'My yachts: take one out, or buy one', note: 'Berthed at the pier', open: 'yachts' },
      { label: 'A speedboat ride round the lagoon', price: 40000, note: 'Fun +35', sit: true, seconds: 7, effect: need({ fun: 35, social: 10 }), said: 'Thirty knots under Third Mainland Bridge, spray in your face. The captain waved at every yacht.' },
    ] },
    { id: 'chandlery', name: '🧭 The chandlery', at: [7, 6], stand: [7, 4.7], who: 'Ifeoma', role: 'Chandlery', text: 'For the water?', choices: [
      buy('A life jacket', 25000, { id: 'life_jacket', name: 'Life jacket', icon: '🦺', price: 25000, category: 'tool', usable: false, description: 'Orange, with a whistle. Wear it on the water.' }, 'An orange life jacket, your size.', 'Into your bag'),
      buy('A captain’s cap', 15000, { id: 'captain_cap', name: 'Captain’s cap', icon: '🧢', price: 15000, category: 'luxury', usable: false, description: 'White, with gold braid.' }, 'White with gold braid. Captain!', 'Into your bag'),
    ] },
    { id: 'deck', name: '🍹 The deck bar', at: [6, -6], stand: [6, -4.7], who: 'Barman Femi', role: 'Deck bar', text: 'Cold one, with the view?', choices: [
      { label: 'A cold drink on the deck', price: 8000, note: 'Fun +15, Social +10', sit: true, seconds: 5, effect: need({ fun: 15, social: 10 }), said: 'The sun going down over the lagoon, a cold drink in your hand.' },
    ] },
  ], [{ at: [3, 2.45], facing: Math.PI, outfit: 0xf8fafc, sit: true }, { at: [-2, -3], facing: 0.5, outfit: 0x1e3a8a }], [24, 20]),

  venue('private-airfield', 'Eko Executive Terminal', 'Lagoon · private airfield', 'Private jets · Charter · Lounge', '#1e3a8a', 0xf1f5f9, 0x1e3a8a, (b) => {
    // Glass onto the apron at the back, the handling desk, leather seats, a bar, the crew room door
    b.box(0x7dd3fc, 22, 2.8, 0.1, 0, 0.6, -8.9, { glow: true });
    counter(b, -6, -6, 4, 0x1e3a8a, 0xf8fafc);
    for (const [x, z] of [[2, 1], [5, 1], [2, 4], [5, 4]]) b.box(0x3b2416, 1, 0.45, 1, x, 0, z).box(0x3b2416, 1, 0.55, 0.2, x, 0.45, z + 0.4);
    counter(b, 7, -6, 3, 0x111827, 0xd4af37); bottles(b, 7, -7.8, 3);
    b.box(0x78350f, 1.2, 2.2, 0.1, -9.8, 0, 6);
  }, [
    { name: 'Chidi', title: 'Ground handler', at: [-6, -7], facing: 0, outfit: 0x1e3a8a, gender: 'male', says: 'Your crew is ready when you are, sir.' },
    { name: 'Lounge host', title: 'Lounge', at: [7, -7], facing: 0, outfit: 0x111827, gender: 'female', says: 'Champagne while you wait?' },
  ], [
    { id: 'handling', name: '🛩️ Ground handling', at: [-6, -6], stand: [-6, -4.7], who: 'Chidi', role: 'Ground handler', text: 'Your own jet, or a seat on a flight?', choices: [
      { label: 'My jets: fly one, or buy one', note: 'On the stands outside', open: 'jets' },
      { label: 'Book a flight or a charter', note: 'Abuja, Port Harcourt', open: 'interstate' },
    ] },
    { id: 'lounge', name: '🛋️ The lounge', at: [3.5, 2.5], stand: [3.5, 0.2], who: 'Lounge host', role: 'Lounge', text: 'Sit down, relax.', choices: [
      { label: 'Relax in the lounge', price: 20000, note: 'Energy +30, Fun +10', sit: true, seconds: 6, effect: need({ energy: 30, fun: 10 }), said: 'Leather seats, cold AC, a jet taxiing past the glass.' },
    ] },
    { id: 'bar', name: '🥂 The bar', at: [7, -6], stand: [7, -4.7], who: 'Lounge host', role: 'Bar', text: 'Champagne?', choices: [
      { label: 'A glass of champagne', price: 35000, note: 'Fun +15, Social +10', effect: need({ fun: 15, social: 10 }), said: 'Cold champagne. The big men in the lounge nodded at you.' },
    ] },
  ], [{ at: [5, 1.3], facing: Math.PI, outfit: 0x111827, sit: true }], [24, 20]),
];


// --- The side streets off Ikorodu Road: Allen Avenue and Obafemi Awolowo Way --------------------

/** A barber's chair: a black seat on a chrome post, a mirror on the wall in front */
const barberChair = (b: Builder, x: number, z: number) => {
  b.cylinder(0xd1d5db, 0.25, 0.4, x, 0, z).box(0x111827, 0.7, 0.2, 0.7, x, 0.45, z).box(0x111827, 0.7, 0.7, 0.15, x, 0.65, z + 0.3);
  b.box(0xbfdbfe, 1, 1.2, 0.05, x, 1.1, z - 1.3).box(0x78350f, 1.2, 0.1, 0.4, x, 0.95, z - 1.15);
};

const SIDE: PlaceSpec[] = [
  venue('allen-salon', 'Allen Hair & Barbing Salon', 'Allen Avenue · salon', 'Braids · Fades · Nails', '#db2777', 0xf5f5f4, 0xfbcfe8, (b) => {
    for (const x of [-5, -2.5]) barberChair(b, x, -4);
    for (const x of [2.5, 5]) barberChair(b, x, -4);
    table(b, -4, 3, 0xf8fafc, 2, 0xdb2777);
    bench(b, 3, 4.5, 4, 0x111827);
  }, [
    { name: 'Oga Kaka', title: 'Barber', at: [-3.7, -3.3], facing: 0, outfit: 0x111827, gender: 'male', says: 'Low cut? Punk? Skin fade? Sit down, I go do you well.' },
    { name: 'Aunty Joy', title: 'Stylist', at: [3.7, -3.3], facing: 0, outfit: 0xdb2777, gender: 'female', says: 'Braids, wash and set, nails. Sit down, my dear.' },
  ], [
    { id: 'barber', name: '💈 The barber’s chair', at: [-2.5, -4], stand: [-2.5, -2.8], who: 'Oga Kaka', role: 'Barber', text: 'Which cut?', choices: [
      { label: 'A low cut and a shave', price: 5000, note: 'Hygiene +15', sit: true, seconds: 6, effect: need({ hygiene: 15, social: 5 }), said: 'Clippers buzzing, a hot towel, a clean shave. You look fresh.' },
      { label: 'A skin fade with a design', price: 8000, note: 'Hygiene +15, Social +10', sit: true, seconds: 7, effect: need({ hygiene: 15, social: 10 }), said: 'A sharp fade and a line cut into the side. Everybody will ask who cut it.' },
    ] },
    { id: 'braids', name: '💇 Braids & styling', at: [2.5, -4], stand: [2.5, -2.8], who: 'Aunty Joy', role: 'Stylist', text: 'What are we doing today?', choices: [
      { label: 'Knotless braids', price: 35000, note: 'Social +20', sit: true, seconds: 9, effect: need({ social: 20, fun: 5 }), said: 'Three hours of gist and Nollywood on the TV, and long knotless braids.' },
      { label: 'A wash and set', price: 12000, note: 'Hygiene +20', sit: true, seconds: 6, effect: need({ hygiene: 20, social: 5 }), said: 'Washed, conditioned, set and shining.' },
    ] },
    { id: 'nails', name: '💅 Nails', at: [-4, 3], stand: [-4, 4.2], who: 'Aunty Joy', role: 'Stylist', text: 'Manicure? Pedicure? Both?', choices: [
      { label: 'A manicure and pedicure', price: 15000, note: 'Hygiene +15, Fun +10', sit: true, seconds: 6, effect: need({ hygiene: 15, fun: 10 }), said: 'Filed, polished, done. Gold on the tips.' },
    ] },
  ], [{ at: [5, -3.6], facing: Math.PI, outfit: 0x2563eb, sit: true }, { at: [2, 4.4], facing: Math.PI, outfit: 0xfacc15, sit: true, gender: 'female' }], [16, 14]),

  venue('allen-suya', 'Mai Suya Spot', 'Allen Avenue · suya', 'Suya · Kilishi · Cold drinks', '#b45309', 0x57534e, 0xfed7aa, (b) => {
    // The grill, its coals glowing, sticks of meat on it
    b.box(0x111827, 3, 0.9, 1, 0, 0, -3.5).box(0xf97316, 2.8, 0.05, 0.8, 0, 0.9, -3.5, { glow: true });
    for (let i = 0; i < 8; i++) b.box(0x7c2d12, 0.08, 0.06, 0.6, -1.2 + i * 0.34, 1, -3.5);
    for (const [x, z] of [[-3, 2], [0, 2], [3, 2]]) table(b, x, z, 0xf8fafc, 2, 0xdc2626);
  }, [{ name: 'Mai Suya', title: 'Suya man', at: [0, -4.4], facing: 0, outfit: 0xf8fafc, gender: 'male', says: 'Hot suya! Plenty yaji, plenty onions!' }], [
    { id: 'grill', name: '🍢 The grill', at: [0, -3.5], stand: [0, -2.2], who: 'Mai Suya', role: 'Suya man', text: 'How much suya?', choices: [
      { label: 'Suya with onions and yaji', price: 2500, note: 'Hunger +25', sit: true, seconds: 4, effect: need({ hunger: 25, fun: 5 }), said: 'Wrapped in newspaper, hot, peppery. You ate it at the table under the lights.' },
      buy('Suya and kilishi to take away', 6000, item('suya_pack', 'Suya and kilishi, wrapped', '🍢', 6000, 'food', true, 18), 'Wrapped in newspaper and foil, still smoking.'),
      { label: 'A cold Chapman', price: 3000, note: 'Fun +8', effect: need({ fun: 8, hunger: 4 }), said: 'Cold Chapman in a tall glass.' },
    ] },
  ], [{ at: [-3, 2.95], facing: Math.PI, outfit: 0x16a34a, sit: true }, { at: [3, 1.05], facing: 0, outfit: 0xdb2777, sit: true, gender: 'female' }], [14, 12]),

  venue('allen-bank', 'Eko Commercial Bank, Allen', 'Allen Avenue · bank', 'Allen Avenue branch · ATM', '#1e3a8a', 0xe5e7eb, 0xf8fafc, (b) => {
    counter(b, 0, -5, 9, 0x1e3a8a, 0xf8fafc);
    b.box(0xbfe3ff, 9, 1, 0.04, 0, 1.11, -5);
    for (const x of [-7.5, -6.3]) b.box(0x334155, 0.9, 1.8, 0.5, x, 0, 6.6).box(0x38bdf8, 0.5, 0.4, 0.02, x, 1.2, 6.34, { glow: true });
    desk(b, 6, 3);
    for (let i = 0; i < 4; i++) b.box(0x1e3a8a, 0.5, 0.45, 0.5, -3 + i, 0, 2);
  }, [
    { name: 'Teller', title: 'Teller', at: [-2, -6], facing: 0, outfit: 0x1e3a8a, gender: 'female', says: 'Next customer, please.' },
    { name: 'Mr Ajayi', title: 'Account officer', at: [6, 2.2], facing: 0, outfit: 0x0f172a, gender: 'male', tie: true, says: 'Accounts, loans, cards. How can I help?' },
  ], [
    { id: 'teller', name: '🏦 The teller', at: [-2, -5], stand: [-2, -3.7], who: 'Teller', role: 'Eko Commercial Bank', text: 'Paying in or taking out?', choices: [
      { label: 'Pay ₦10,000 cash into my account', note: 'From your wallet', arms: 'reach', seconds: 2.5, effect: (be) => { be.depositToBank(10000); }, said: 'Counted, stamped, and the teller hands back your slip.' },
      { label: 'See my account', note: 'Opens Bank', open: 'app:bank' },
    ] },
    { id: 'atm', name: '🏧 Cash machines', at: [-6.9, 6.6], stand: [-6.9, 5.3], who: 'ATM', role: 'Eko Commercial Bank', text: 'Insert your card.', choices: [{ label: 'Use the cash machine', note: 'Opens Bank', open: 'app:bank' }] },
    { id: 'officer', name: '💼 Account officer', at: [6, 3], stand: [6, 4.4], who: 'Mr Ajayi', role: 'Account officer', text: 'A loan, a new card, or a business account?', choices: [{ label: 'Loans and accounts', note: 'Opens Bank', open: 'app:bank' }] },
  ], [{ at: [-1, 2.05], facing: Math.PI, outfit: 0xf59e0b, sit: true }], [20, 16]),

  venue('awolowo-fashion', 'Awolowo Way Fashion House', 'Obafemi Awolowo Way · fashion', 'Bespoke · Agbada · Kaftan · Ankara', '#7c3aed', 0xf5f5f4, 0xede9fe, (b) => {
    // The cutting table with cloth on it, sewing machines, mannequins in finished pieces
    b.box(0x78350f, 3.6, 0.9, 1.6, 0, 0, -3).box(0x7c3aed, 1.6, 0.05, 1, -0.6, 0.9, -3).box(0xfacc15, 1, 0.05, 0.8, 1, 0.9, -3);
    for (const x of [-5, -3]) b.box(0x1f2937, 0.8, 0.75, 0.6, x, 0, -6).box(0x9ca3af, 0.3, 0.3, 0.4, x, 0.75, -6);
    for (const [x, c] of [[4, 0x15803d], [5.4, 0xdc2626], [6.8, 0xf8fafc]] as Array<[number, number]>) b.cylinder(0x111827, 0.04, 1, x, 0, -5).box(c, 0.6, 1.1, 0.4, x, 1, -5).box(0xe7d3b3, 0.2, 0.25, 0.2, x, 2.1, -5);
  }, [
    { name: 'Mr Tunji', title: 'Tailor', at: [0, -4], facing: 0, outfit: 0x7c3aed, gender: 'male', says: 'Let me take your measurement. Agbada? Kaftan?' },
    { name: 'Bimbo', title: 'Seamstress', at: [-4, -6.7], facing: 0, outfit: 0xdb2777, gender: 'female', says: 'Your owambe outfit, sharp sharp.' },
  ], [
    { id: 'tailor', name: '🧵 Get measured', at: [0, -3], stand: [0, -1.6], who: 'Mr Tunji', role: 'Tailor', text: 'Stand straight. What are we sewing?', choices: [
      buy('A kaftan, sewn to measure', 45000, { id: 'kaftan', name: 'Kaftan, sewn to measure', icon: '👔', price: 45000, category: 'luxury', usable: false, description: 'A plain kaftan with fine embroidery at the neck.' }, 'Measured, cut and sewn. It fits like it was made for you, because it was.', 'Ready while you wait'),
      buy('An agbada, embroidered', 120000, { id: 'agbada', name: 'Agbada, embroidered', icon: '🥻', price: 120000, category: 'luxury', usable: false, description: 'Three pieces, heavy embroidery. Chairman of the occasion.' }, 'Three pieces, gold embroidery. You will be the chairman of the occasion.', 'Ready while you wait'),
      buy('An Ankara dress for owambe', 35000, { id: 'ankara_dress', name: 'Ankara dress', icon: '👗', price: 35000, category: 'luxury', usable: false, description: 'Bright Ankara, cut to your shape.' }, 'Bright Ankara with a peplum. Owambe ready!', 'Ready while you wait'),
    ] },
  ], [{ at: [3, 1], facing: -0.6, outfit: 0xf59e0b, gender: 'female' }], [18, 14]),

  venue('awolowo-pharmacy', 'Awolowo Way Pharmacy', 'Obafemi Awolowo Way · pharmacy', 'Medicines · Checks · Advice', '#16a34a', 0xf1f5f9, 0xdcfce7, (b) => {
    shelf(b, -3, -5.2, 5, [0xf8fafc, 0x22c55e, 0xdc2626, 0x2563eb]); counter(b, 0, -3, 5, 0x16a34a, 0xf8fafc);
    b.box(0x1f2937, 0.5, 0.45, 0.5, 4, 0, 2).box(0xf8fafc, 0.4, 0.3, 0.3, 4.6, 0.8, 2);
  }, [{ name: 'Pharmacist Nkechi', title: 'Pharmacist', at: [0, -4], facing: 0, outfit: 0xf8fafc, gender: 'female', says: 'What do you need? Any prescription?' }], [
    { id: 'counter', name: '💊 The counter', at: [0, -3], stand: [0, -1.7], who: 'Pharmacist Nkechi', role: 'Pharmacist', text: 'Tell me how you feel.', choices: [
      buy('Malaria treatment', 6500, { id: 'malaria_pack', name: 'Malaria treatment pack', icon: '💊', price: 6500, category: 'medicine', usable: true, description: 'Three days of tablets. Finish the dose.' }, 'Three days of tablets. Finish the dose.'),
      buy('Paracetamol', 1000, { id: 'paracetamol', name: 'Paracetamol', icon: '💊', price: 1000, category: 'medicine', usable: true, description: 'For headache and fever.' }, 'A strip of paracetamol.'),
      buy('Multivitamins, a month', 4500, { id: 'multivitamins', name: 'Multivitamins', icon: '💊', price: 4500, category: 'medicine', usable: true, description: 'One a day.' }, 'A month of multivitamins.'),
    ] },
    { id: 'check', name: '🩺 Blood pressure check', at: [4, 2], stand: [4, 3.3], who: 'Pharmacist Nkechi', role: 'Pharmacist', text: 'Sit down, roll up your sleeve.', choices: [
      { label: 'Check my blood pressure', price: 2000, note: 'Health +5', sit: true, seconds: 4, effect: need({ health: 5 }), said: '120 over 80. Very good. Reduce the salt anyway.' },
    ] },
  ], [{ at: [-2, 1.5], facing: Math.PI, outfit: 0x2563eb }], [14, 12]),

  venue('awolowo-school', 'Ikeja Computer School', 'Obafemi Awolowo Way · training', 'Coding · Design · Office skills', '#1d4ed8', 0xe5e7eb, 0xdbeafe, (b) => {
    for (let r = 0; r < 2; r++) for (let i = 0; i < 3; i++) desk(b, -4 + i * 4, -1 + r * 3.2);
    b.box(0xf8fafc, 6, 2, 0.08, 0, 1, -7.4).box(0x111827, 6.2, 0.1, 0.1, 0, 3, -7.4);
    counter(b, 6, 5.5, 3, 0x1d4ed8);
  }, [
    { name: 'Mr Okeke', title: 'Instructor', at: [0, -6.5], facing: 0, outfit: 0x1d4ed8, gender: 'male', says: 'Today: functions, loops, and your first website.' },
    { name: 'Front desk', title: 'Admissions', at: [6, 4.5], facing: 0, outfit: 0x0f172a, gender: 'female', says: 'Courses start every Monday. Weekend classes too.' },
  ], [
    { id: 'class', name: '💻 A class', at: [0, -1], stand: [0, -0.25], who: 'Mr Okeke', role: 'Instructor', text: 'Which course?', choices: [
      { label: 'A week of coding', price: 50000, note: 'Coding +2', sit: true, seconds: 8, effect: (be) => { (be as unknown as { addSkillExp(s: string, n: number): void }).addSkillExp('coding', 2); need({ energy: -15 })(be as never); }, said: 'Functions, loops, a page that works. The instructor nodded at your code.' },
      { label: 'Graphic design class', price: 40000, note: 'Craft +2', sit: true, seconds: 8, effect: (be) => { (be as unknown as { addSkillExp(s: string, n: number): void }).addSkillExp('craft', 2); need({ energy: -10 })(be as never); }, said: 'A logo, a flyer, a poster for an owambe. Clients will pay for this.' },
      { label: 'Office skills: spreadsheets and typing', price: 25000, note: 'Academics +1', sit: true, seconds: 7, effect: (be) => { (be as unknown as { addSkillExp(s: string, n: number): void }).addSkillExp('academics', 1); }, said: 'Formulas, tables, forty words a minute.' },
    ] },
    { id: 'admissions', name: '📝 Admissions', at: [6, 5.5], stand: [6, 6.8], who: 'Front desk', role: 'Admissions', text: 'A certificate when you finish.', choices: [
      buy('A certificate of completion', 15000, { id: 'cert_computer', name: 'Ikeja Computer School certificate', icon: '📜', price: 15000, category: 'document', usable: false, description: 'Completed coursework. Employers like to see it.' }, 'Signed, sealed, framed.', 'For your CV'),
    ] },
  ], [{ at: [-4, -0.25], facing: Math.PI, outfit: 0xf97316, sit: true }, { at: [4, 2.95], facing: Math.PI, outfit: 0xdb2777, sit: true, gender: 'female' }], [20, 16]),
];

export const PLACE_SPECS: PlaceSpec[] = [...SPECS, ...IKEJA, ...OUTDOOR, ...SIDE, SUPERMARKET_SPEC, mart('station-island', 'NaijaPetro Mart, Island'), mart('station-bridge', 'NaijaPetro Mart, Bridge End'), mart('station-mainland', 'NaijaPetro Mart, Mainland'), mart('station-ikeja', 'NaijaPetro Mart, Ikeja')];
