import { profileKey } from '../backend/Profile';
import { cleanOutfits, cleanStyles, type Accessories, type ClothingStyles, type SavedOutfit } from './ClothingStyle';
export type Gender = 'male' | 'female';
export type HeadwearType = 'fila_cream' | 'igbo_red_cap' | 'afro_hair' | 'braids' | 'bob_wig' | 'gele' | 'hardhat' | 'none';
export type AttireStyle =
  | 'agbada_green'
  | 'agbada'
  | 'senator_navy'
  | 'super_eagles'
  | 'white_gold'
  | 'ankara_gold'
  | 'engineer_vest'
  | 'blue_dress'
  | 'peplum_gown'
  | 'ankara_skirt';
export type EmoteType = 'idle' | 'walk' | 'run' | 'zanku' | 'groove' | 'dance' | 'salute' | 'talk' | 'phone_call';

export type ClothingCategory = 'top' | 'bottom' | 'shoes' | 'headwear' | 'bag' | 'accessory';

export interface ModularClothingItem {
  id: string;
  name: string;
  category: ClothingCategory;
  price: number;
  color: number;
  secondaryColor?: number;
  styleKey: string;
  description: string;
  icon: string;
  gender?: Gender | 'unisex';
}

export const WARDROBE_CATALOGUE: ModularClothingItem[] = [
  // === Hats with their own models (worn over the hair) ===
  { id: 'head_cap_black', name: 'Black Baseball Cap', category: 'headwear', price: 5500, color: 0x111827, styleKey: 'cap', description: 'Six-panel cotton twill cap with a curved brim.', icon: '🧢', gender: 'unisex' },
  { id: 'head_bucket_khaki', name: 'Khaki Bucket Hat', category: 'headwear', price: 6500, color: 0xc2b280, styleKey: 'bucket_hat', description: 'Soft twill bucket hat for the Lagos sun.', icon: '👒', gender: 'unisex' },
  { id: 'head_beanie_grey', name: 'Grey Rib Beanie', category: 'headwear', price: 4500, color: 0x6b7280, styleKey: 'beanie', description: 'Rib-knit beanie with a turned-up cuff.', icon: '🧶', gender: 'unisex' },
  // Traditional headwear with their own models
  { id: 'head_gele_gold', name: 'Gold Aso-Oke Gele', category: 'headwear', price: 15000, color: 0xd4a017, styleKey: 'gele', description: 'A stiff aso-oke head tie, fanned up and out at the back.', icon: '👑', gender: 'female' },
  { id: 'head_fila_wine', name: 'Wine Abeti-Aja Fila', category: 'headwear', price: 9000, color: 0x7f1d1d, styleKey: 'fila', description: 'The soft Yoruba cap worn leaning to one side, its flaps folded up.', icon: '🎩', gender: 'male' },
  { id: 'head_kufi_white', name: 'White Kufi Cap', category: 'headwear', price: 5000, color: 0xf5f5f4, styleKey: 'kufi', description: 'A low round knitted cap.', icon: '🧢', gender: 'male' },
  // Skirts, dresses and native tops with their own models (Stage 4.5)
  { id: 'bottom_mini_denim', name: 'Denim Mini Skirt', category: 'bottom', price: 9000, color: 0x1e3a8a, styleKey: 'mini_skirt', description: 'A short flared denim skirt.', icon: '👗', gender: 'female' },
  { id: 'bottom_pleated_navy', name: 'Navy Pleated Skirt', category: 'bottom', price: 11000, color: 0x1e3a5f, styleKey: 'pleated_skirt', description: 'Knee-length knife pleats in twill.', icon: '👗', gender: 'female' },
  { id: 'bottom_pencil_black', name: 'Black Pencil Skirt', category: 'bottom', price: 12000, color: 0x111827, styleKey: 'pencil_skirt', description: 'A fitted knee-length office skirt.', icon: '👗', gender: 'female' },
  { id: 'bottom_maxi_cream', name: 'Cream Maxi Skirt', category: 'bottom', price: 13000, color: 0xf5f0e6, styleKey: 'maxi_skirt', description: 'A flowing ankle-length cotton skirt.', icon: '👗', gender: 'female' },
  { id: 'bottom_iro_ankara', name: 'Ankara Iro Wrapper', category: 'bottom', price: 18000, color: 0x0d9488, secondaryColor: 0xfacc15, styleKey: 'iro', description: 'A wax-print wrapper tied and rolled at the waist, its end lapped over the front.', icon: '👗', gender: 'female' },
  { id: 'top_sundress_yellow', name: 'Yellow Sundress', category: 'top', price: 18000, color: 0xfacc15, styleKey: 'sundress', description: 'A light knee-length dress with short sleeves.', icon: '👗', gender: 'female' },
  { id: 'top_evening_gown_wine', name: 'Wine Evening Gown', category: 'top', price: 55000, color: 0x7f1d1d, styleKey: 'evening_gown', description: 'Sleeveless, close to the figure, flaring to the floor.', icon: '👗', gender: 'female' },
  { id: 'top_peplum_ankara', name: 'Ankara Peplum Blouse', category: 'top', price: 14000, color: 0xdb2777, secondaryColor: 0xfde68a, styleKey: 'peplum_top', description: 'A fitted wax-print blouse with a flared peplum: half of an ankara two-piece.', icon: '👚', gender: 'female' },
  { id: 'top_buba_lace', name: 'Lace Buba', category: 'top', price: 20000, color: 0xf5f0e6, styleKey: 'buba', description: 'A loose blouse with wide sleeves, worn over an iro.', icon: '👚', gender: 'female' },
  { id: 'top_senator_midnight', name: 'Navy Senator Top', category: 'top', price: 30000, color: 0x1e3a8a, styleKey: 'senator', description: 'A tunic to mid-thigh with a standing collar, buttoned at the side.', icon: '👔', gender: 'male' },
  // === 0. CLOTHES OF LAGOS TODAY, CUT FROM REAL CLOTH ===
  { id: 'top_white_tee', name: 'Plain White T-Shirt', category: 'top', price: 6500, color: 0xf8fafc, styleKey: 'tshirt', description: 'Heavy cotton crew-neck tee. Goes with everything.', icon: '👕', gender: 'unisex' },
  { id: 'top_black_tee', name: 'Black Oversized T-Shirt', category: 'top', price: 7500, color: 0x111827, styleKey: 'tshirt', description: 'Thick black cotton, a relaxed cut.', icon: '👕', gender: 'unisex' },
  { id: 'top_green_tee', name: 'Lagos Green Tee', category: 'top', price: 7000, color: 0x15803d, styleKey: 'tshirt', description: 'Soft jersey tee in deep Naija green.', icon: '👕', gender: 'unisex' },
  { id: 'top_polo_navy', name: 'Navy Polo Shirt', category: 'top', price: 11000, color: 0x1e3a8a, styleKey: 'polo_shirt', description: 'Pique cotton polo with a two-button placket and a collar.', icon: '👕', gender: 'unisex' },
  { id: 'top_polo_white', name: 'White Polo Shirt', category: 'top', price: 10500, color: 0xf8fafc, styleKey: 'polo_shirt', description: 'Classic white pique polo — the Lagos office-casual staple.', icon: '👕', gender: 'unisex' },
  { id: 'top_polo_forest', name: 'Forest Green Polo', category: 'top', price: 11000, color: 0x166534, styleKey: 'polo_shirt', description: 'Forest pique polo with a clean collar and short sleeves.', icon: '👕', gender: 'unisex' },
  { id: 'top_polo_wine', name: 'Wine Polo Shirt', category: 'top', price: 11000, color: 0x7f1d1d, styleKey: 'polo_shirt', description: 'Wine-red polo for Friday hangouts and Sunday lunch.', icon: '👕', gender: 'unisex' },
  { id: 'top_check_shirt', name: 'Blue Check Shirt', category: 'top', price: 14500, color: 0x1d4ed8, styleKey: 'button_shirt', description: 'Long-sleeved cotton shirt in a crisp check, buttoned down the front.', icon: '👔', gender: 'unisex' },
  { id: 'top_white_oxford', name: 'White Oxford Button-Up', category: 'top', price: 13500, color: 0xf8fafc, styleKey: 'button_shirt', description: 'Crisp white long-sleeve oxford — bank / interview ready.', icon: '👔', gender: 'unisex' },
  { id: 'top_sky_oxford', name: 'Sky Blue Button-Up', category: 'top', price: 13500, color: 0x38bdf8, styleKey: 'button_shirt', description: 'Light blue oxford shirt for Victoria Island weekdays.', icon: '👔', gender: 'unisex' },
  { id: 'top_ankara_shirt', name: 'Ankara Print Shirt', category: 'top', price: 16000, color: 0xea580c, secondaryColor: 0x0e7490, styleKey: 'ankara_shirt', description: 'Short-sleeved wax-print shirt, bold rings of colour.', icon: '👔', gender: 'unisex' },
  { id: 'top_hoodie_grey', name: 'Grey Pullover Hoodie', category: 'top', price: 19500, color: 0x6b7280, styleKey: 'hoodie', description: 'Fleece-lined knit hoodie with its hood down.', icon: '🧥', gender: 'unisex' },
  { id: 'top_eagles_jersey', name: 'Super Eagles Home Jersey', category: 'top', price: 22000, color: 0x15803d, secondaryColor: 0xf8fafc, styleKey: 'jersey', description: 'The green-and-white home kit, worn with white shorts.', icon: '⚽', gender: 'unisex' },
  { id: 'top_navy_suit', name: 'Navy Two-Piece Suit', category: 'top', price: 95000, color: 0x1e293b, styleKey: 'suit', description: 'Tailored wool suit, white shirt and tie.', icon: '🤵', gender: 'unisex' },
  { id: 'top_kaftan_white', name: 'White Senator Kaftan', category: 'top', price: 28000, color: 0xf5f5f4, secondaryColor: 0xe5b84b, styleKey: 'kaftan', description: 'Knee-length kaftan with an embroidered gold placket and band collar.', icon: '👘', gender: 'male' },
  { id: 'top_kaftan_wine', name: 'Wine Senator Kaftan', category: 'top', price: 28000, color: 0x7f1d1d, secondaryColor: 0xe5b84b, styleKey: 'kaftan', description: 'Deep wine kaftan for owambe Saturdays.', icon: '👘', gender: 'male' },
  { id: 'top_agbada_royal', name: 'Royal Blue Aso-Oke Agbada', category: 'top', price: 120000, color: 0x1e3a8a, secondaryColor: 0xe5b84b, styleKey: 'agbada', description: 'Hand-woven aso-oke agbada over a kaftan, gold embroidery at the neck.', icon: '👘', gender: 'male' },
  { id: 'top_ankara_gown', name: 'Ankara Maxi Gown', category: 'top', price: 38000, color: 0xdb2777, secondaryColor: 0xfacc15, styleKey: 'ankara_gown', description: 'Floor-length wax-print gown with short sleeves.', icon: '👗', gender: 'female' },
  { id: 'top_lace_buba', name: 'Lace Buba & Iro', category: 'top', price: 65000, color: 0x7c3aed, secondaryColor: 0xe5b84b, styleKey: 'buba_iro', description: 'Lace blouse over an aso-oke wrapper: the owambe classic.', icon: '👘', gender: 'female' },
  { id: 'top_red_bodycon', name: 'Red Bodycon Dress', category: 'top', price: 26000, color: 0xb91c1c, styleKey: 'bodycon', description: 'A fitted knee-length dress, sleeveless.', icon: '👗', gender: 'female' },
  { id: 'top_denim_jumpsuit', name: 'Denim Jumpsuit', category: 'top', price: 31000, color: 0x1e3a8a, styleKey: 'jumpsuit', description: 'One piece, sleeveless, belted.', icon: '👖', gender: 'female' },
  // === 1. TOPS & SHIRTS ===
  {
    id: 'top_agbada_emerald',
    name: 'Emerald Yoruba Agbada Tunic',
    category: 'top',
    price: 18000,
    color: 0x008751,
    styleKey: 'agbada',
    description: 'Majestic hand-stitched Yoruba Agbada with embroidered bib across the chest.',
    icon: '👘',
    gender: 'unisex',
  },
  {
    id: 'top_senator_navy',
    name: 'Navy Royal Senator Tunic',
    category: 'top',
    price: 14000,
    color: 0x1e3a8a,
    styleKey: 'senator',
    description: 'Crisp Nigerian VIP senator tunic with mandarin collar and pocket square.',
    icon: '👔',
    gender: 'unisex',
  },
  {
    id: 'top_white_kaftan',
    name: 'Owambe White Kaftan Shirt',
    category: 'top',
    price: 12000,
    color: 0xffffff,
    styleKey: 'senator',
    description: 'Pristine Sunday best Kaftan top suited for high-society Lagos parties.',
    icon: '✨',
    gender: 'unisex',
  },
  {
    id: 'top_ankara_gold',
    name: 'Ankara Wax Geometric Shirt',
    category: 'top',
    price: 9500,
    color: 0xd97706,
    styleKey: 'agbada',
    description: 'Vibrant golden amber African wax print shirt with bronze woven trim.',
    icon: '🎨',
    gender: 'unisex',
  },
  {
    id: 'top_super_eagles',
    name: 'Retro 1994 Eagles Jersey',
    category: 'top',
    price: 7500,
    color: 0x10b981,
    styleKey: 'casual_tee',
    description: 'Iconic Nigerian national football team retro jersey with chevron accents.',
    icon: '⚽',
    gender: 'unisex',
  },
  {
    id: 'top_corporate_shirt',
    name: 'Victoria Island Oxford Shirt',
    category: 'top',
    price: 8000,
    color: 0x60a5fa,
    styleKey: 'button_shirt',
    description: 'Tailored sky blue formal button-down shirt for banking and tech executives.',
    icon: '👔',
    gender: 'unisex',
  },
  {
    id: 'top_street_hoodie',
    name: 'Lekki Black Streetwear Hoodie',
    category: 'top',
    price: 11000,
    color: 0x18181b,
    styleKey: 'hoodie',
    description: 'Heavyweight oversized cotton hoodie popular among Lagos nightlife trendsetters.',
    icon: '🧥',
    gender: 'unisex',
  },
  {
    id: 'top_engineer_vest',
    name: 'Port Harcourt Safety Vest',
    category: 'top',
    price: 4500,
    color: 0xf97316,
    styleKey: 'engineer_vest',
    description: 'High-visibility safety orange reflective vest for oil, gas and building sites.',
    icon: '🦺',
    gender: 'unisex',
  },
  {
    id: 'top_royal_dress',
    name: 'Sapphire Peplum Gown Top',
    category: 'top',
    price: 15000,
    color: 0x2563eb,
    styleKey: 'peplum_skirt',
    description: 'Graceful royal sapphire peplum bodice with ruffled flare at the waist.',
    icon: '👗',
    gender: 'female',
  },
  {
    id: 'top_casual_blouse',
    name: 'Coral Silk Wrap Blouse',
    category: 'top',
    price: 8500,
    color: 0xf43f5e,
    styleKey: 'casual_blouse',
    description: 'Breezy lightweight silk blouse designed for stylish Sunday brunches.',
    icon: '👚',
    gender: 'female',
  },

  // === 2. TROUSERS, SKIRTS & BOTTOMS ===
  {
    id: 'bottom_senator_navy',
    name: 'Navy Senator Trousers',
    category: 'bottom',
    price: 8500,
    color: 0x1e3a8a,
    styleKey: 'trousers',
    description: 'Sharp tailored navy formal trousers with ironed front pleats.',
    icon: '👖',
    gender: 'unisex',
  },
  {
    id: 'bottom_white_pants',
    name: 'White Kaftan Trousers',
    category: 'bottom',
    price: 7000,
    color: 0xfafafa,
    styleKey: 'trousers',
    description: 'Classic white straight-cut trousers for Sunday best and traditional attire.',
    icon: '👖',
    gender: 'unisex',
  },
  {
    id: 'bottom_black_slacks',
    name: 'Executive Slim-Fit Slacks',
    category: 'bottom',
    price: 9000,
    color: 0x18181b,
    styleKey: 'trousers',
    description: 'Midnight black bespoke corporate trousers for meetings and upscale dining.',
    icon: '👖',
    gender: 'unisex',
  },
  {
    id: 'bottom_blue_jeans',
    name: 'Indigo Stonewash Denim Jeans',
    category: 'bottom',
    price: 6500,
    color: 0x1e40af,
    styleKey: 'jeans',
    description: 'Durable stretch denim jeans built for everyday street movement.',
    icon: '👖',
    gender: 'unisex',
  },
  {
    id: 'bottom_black_jeans',
    name: 'Black Slim Jeans',
    category: 'bottom',
    price: 7000,
    color: 0x18181b,
    styleKey: 'jeans',
    description: 'Slim black denim for nights out on the Island.',
    icon: '👖',
    gender: 'unisex',
  },
  {
    id: 'bottom_beige_chinos',
    name: 'Khaki Chinos Trousers',
    category: 'bottom',
    price: 7500,
    color: 0xd4a373,
    styleKey: 'trousers',
    description: 'Versatile smart-casual chinos suitable for both office and weekend.',
    icon: '👖',
    gender: 'unisex',
  },
  {
    id: 'bottom_navy_chinos',
    name: 'Navy Chinos',
    category: 'bottom',
    price: 7500,
    color: 0x1e3a5f,
    styleKey: 'trousers',
    description: 'Navy cotton chinos — pairs with any polo.',
    icon: '👖',
    gender: 'unisex',
  },
  {
    id: 'bottom_ankara_skirt',
    name: 'Ankara Wax Blossom Skirt',
    category: 'bottom',
    price: 10000,
    color: 0xa855f7,
    styleKey: 'skirt',
    description: 'Vibrant royal purple African wax print long skirt with ornate side drape.',
    icon: '👗',
    gender: 'female',
  },
  {
    id: 'bottom_cargo_pants',
    name: 'Streetwear Utility Cargo Pants',
    category: 'bottom',
    price: 8500,
    color: 0x3f3f46,
    styleKey: 'trousers',
    description: 'Multi-pocket tactical street cargos for urban mobility.',
    icon: '👖',
    gender: 'unisex',
  },
  {
    id: 'bottom_cocktail_skirt',
    name: 'Royal Blue Evening Skirt',
    category: 'bottom',
    price: 12000,
    color: 0x1d4ed8,
    styleKey: 'skirt',
    description: 'Elegant tailored formal skirt matching the Sapphire Peplum top.',
    icon: '👗',
    gender: 'female',
  },

  // === 3. SHOES & FOOTWEAR ===
  {
    id: 'shoes_leather_loafers',
    name: 'Italian Bit Loafers',
    category: 'shoes',
    price: 16000,
    color: 0x2a1a10,
    styleKey: 'loafers',
    description: 'Deep mahogany leather slip-on loafers with metallic gold horsebit bar.',
    icon: '👞',
    gender: 'unisex',
  },
  {
    id: 'shoes_white_sneakers',
    name: 'Clean White Street Kickz',
    category: 'shoes',
    price: 12500,
    color: 0xffffff,
    styleKey: 'sneakers',
    description: 'Low-top white leather sneakers with padded rubber soles for active walking.',
    icon: '👟',
    gender: 'unisex',
  },
  {
    id: 'shoes_black_oxfords',
    name: 'Polished Black Oxford Shoes',
    category: 'shoes',
    price: 14000,
    color: 0x0f0f0f,
    styleKey: 'oxfords',
    description: 'Mirror-shine formal cap-toe dress shoes for corporate and gala events.',
    icon: '👞',
    gender: 'unisex',
  },
  {
    id: 'shoes_chelsea_boots',
    name: 'Brown Suede Chelsea Boots',
    category: 'shoes',
    price: 18000,
    color: 0x5c4033,
    styleKey: 'boots',
    description: 'Premium ankle-high suede boots with elastic side gussets.',
    icon: '👢',
    gender: 'unisex',
  },
  {
    id: 'shoes_slide_sandals',
    name: 'Leather Slide Sandals',
    category: 'shoes',
    price: 5000,
    color: 0x3d2817,
    styleKey: 'sandals',
    description: 'Relaxed hand-crafted Nigerian leather slides for casual downtime.',
    icon: '🩴',
    gender: 'unisex',
  },
  {
    id: 'shoes_stiletto_heels',
    name: 'Ruby Red Stiletto Heels',
    category: 'shoes',
    price: 15000,
    color: 0xb91c1c,
    styleKey: 'heels',
    description: 'Sleek 4-inch crimson stiletto high heels crafted for evening events.',
    icon: '👠',
    gender: 'female',
  },

  // === 4. BAGS & BACKPACKS ===
  {
    id: 'bag_crossbody',
    name: 'Lagos Hustler Leather Crossbody',
    category: 'bag',
    price: 9500,
    color: 0x1c1917,
    styleKey: 'crossbody',
    description: 'Everyday chest pouch keeping phones, cash and smart cards secure.',
    icon: '👝',
    gender: 'unisex',
  },
  {
    id: 'bag_briefcase',
    name: 'Executive Leather Briefcase',
    category: 'bag',
    price: 24000,
    color: 0x451a03,
    styleKey: 'briefcase',
    description: 'Top-grain dark brown leather attache case for land deeds and contracts.',
    icon: '💼',
    gender: 'unisex',
  },
  {
    id: 'bag_tech_backpack',
    name: 'Waterproof Tech Bro Backpack',
    category: 'bag',
    price: 14000,
    color: 0x27272a,
    styleKey: 'backpack',
    description: 'Multi-compartment commuter bag with laptop sleeve and power bank port.',
    icon: '🎒',
    gender: 'unisex',
  },
  {
    id: 'bag_owambe_clutch',
    name: 'Sparkling Gold Owambe Clutch',
    category: 'bag',
    price: 16500,
    color: 0xd97706,
    styleKey: 'clutch',
    description: 'Metallic champagne gold evening clutch with jewel clasp.',
    icon: '👛',
    gender: 'female',
  },

  // === 5. HEADWEAR & ACCESSORIES ===
  {
    id: 'head_fila_cream',
    name: 'Cream Yoruba Fila (Aso-Oke)',
    category: 'headwear',
    price: 4500,
    color: 0xfef08a,
    styleKey: 'fila_cream',
    description: 'Traditional folded Yoruba cap woven with cream and gold threads.',
    icon: '👑',
    gender: 'unisex',
  },
  {
    id: 'head_igbo_red',
    name: 'Igbo Ozo Red Chieftaincy Cap',
    category: 'headwear',
    price: 6000,
    color: 0xdc2626,
    styleKey: 'igbo_red_cap',
    description: 'Prestigious crimson woolen cap symbolizing chieftaincy honor.',
    icon: '🎩',
    gender: 'unisex',
  },
  {
    id: 'head_gele_royal',
    name: 'Royal Purple Pleated Gele',
    category: 'headwear',
    price: 8500,
    color: 0x7c3aed,
    styleKey: 'gele',
    description: 'Sculpted multi-tiered royal head-tie that turns heads at weddings.',
    icon: '👑',
    gender: 'female',
  },
  {
    id: 'head_afro_fade',
    name: 'Clean Barber Fade / Afro',
    category: 'headwear',
    price: 2500,
    color: 0x171717,
    styleKey: 'afro_hair',
    description: 'Sharp razor edge lineup fade with natural afro crown.',
    icon: '💈',
    gender: 'unisex',
  },
  {
    id: 'head_box_braids',
    name: 'Waist-Length Box Braids',
    category: 'headwear',
    price: 6500,
    color: 0x171717,
    styleKey: 'braids',
    description: 'Neatly parted long box braids with glossy sheen.',
    icon: '💇‍♀️',
    gender: 'female',
  },
  {
    id: 'head_bob_wig',
    name: 'Sleek Bone-Straight Bob Wig',
    category: 'headwear',
    price: 12000,
    color: 0x171717,
    styleKey: 'bob_wig',
    description: 'Silky smooth lace-front bob cut framing the jawline.',
    icon: '💇‍♀️',
    gender: 'female',
  },
  {
    id: 'head_safety_hardhat',
    name: 'Site Supervisor Safety Hardhat',
    category: 'headwear',
    price: 3500,
    color: 0xeab308,
    styleKey: 'hardhat',
    description: 'OSHA-compliant yellow hardhat for construction and industrial sites.',
    icon: '⛑️',
    gender: 'unisex',
  },
  {
    id: 'acc_designer_shades',
    name: 'Cartier Gold-Rim Sunglasses',
    category: 'accessory',
    price: 18000,
    color: 0x18181b,
    styleKey: 'shades',
    description: 'Luxury polarized dark lenses with gold temple arms.',
    icon: '🕶️',
    gender: 'unisex',
  },
  {
    id: 'acc_cuban_chain',
    name: '18K Miami Cuban Link Chain',
    category: 'accessory',
    price: 45000,
    color: 0xfacc15,
    styleKey: 'gold_chain',
    description: 'Heavy solid gold Cuban chain with custom commemorative medallion.',
    icon: '🥇',
    gender: 'unisex',
  },
  {
    id: 'acc_coral_beads',
    name: 'Benin Royal Coral Neck Beads',
    category: 'accessory',
    price: 28000,
    color: 0xe11d48,
    styleKey: 'coral_beads',
    description: 'Authentic crimson cylindrical coral beads for royalty and ceremonies.',
    icon: '📿',
    gender: 'unisex',
  },
];

export interface CharacterConfig {
  name: string;
  gender: Gender;
  skinTone: string;       // Hex color string (e.g. '#4a2e1d')
  attire: AttireStyle;
  headwear: HeadwearType;
  hasShades: boolean;
  hasGoldChain: boolean;
  hasCoralBeads?: boolean;
  trousersColor: string;
  // Modular Wardrobe slots:
  topId?: string;
  bottomId?: string;
  shoesId?: string;
  headwearId?: string;
  bagId?: string;
  accessoryId?: string;
  ownedClothingIds?: string[];
  /** The look editor: the head's shape, the hair (worn under any hat), its colour, a beard, the build */
  headShape?: 'round' | 'oval' | 'long' | 'square' | 'heart' | 'diamond';
  hair?: string;
  hairColor?: string;
  beard?: 'none' | 'stubble' | 'moustache' | 'goatee' | 'full' | 'chinstrap';
  build?: 'slim' | 'average' | 'broad';
  /** Clothing customisation per slot (colours, cloth, pattern, thread, condition): see ClothingStyle.ts */
  clothingStyles?: ClothingStyles;
  /** Saved outfits (the items worn and their styles together) */
  outfits?: SavedOutfit[];
  /** Accessories per slot (watch, chain, glasses, bracelet, belt, headwear): kept for the accessory models to come */
  accessories?: Accessories;
}

export const DEFAULT_CHARACTER_CONFIG: CharacterConfig = {
  name: 'Bayo',
  gender: 'male',
  skinTone: '#4a2e1d',
  attire: 'senator_navy',
  headwear: 'none',
  hasShades: false,
  hasGoldChain: false,
  hasCoralBeads: false,
  trousersColor: '#1e3a5f',
  // Start in everyday Lagos streetwear — polo + chinos (wardrobe can switch to agbada anytime)
  topId: 'top_polo_navy',
  bottomId: 'bottom_navy_chinos',
  shoesId: 'shoes_white_sneakers',
  headwearId: undefined,
  bagId: undefined,
  accessoryId: undefined,
  ownedClothingIds: [
    'top_polo_navy',
    'top_polo_white',
    'top_polo_forest',
    'top_white_tee',
    'top_black_tee',
    'top_check_shirt',
    'top_white_oxford',
    'bottom_navy_chinos',
    'bottom_blue_jeans',
    'bottom_beige_chinos',
    'shoes_white_sneakers',
    'shoes_leather_loafers',
    'top_agbada_emerald',
    'bottom_white_pants',
    'head_fila_cream',
  ],
};

export const ATTIRE_PRESETS: Record<AttireStyle, { name: string; color: number; label: string; trousers: string }> = {
  agbada_green: {
    name: 'Emerald Agbada',
    color: 0x008751, // Nigerian national green
    label: 'Traditional Yoruba Emerald Agbada with embroidery',
    trousers: '#ffffff',
  },
  agbada: {
    name: 'Emerald Agbada',
    color: 0x008751, // Nigerian national green
    label: 'Traditional Yoruba Emerald Agbada with embroidery',
    trousers: '#ffffff',
  },
  senator_navy: {
    name: 'Navy Senator Suit',
    color: 0x1e3a8a, // Deep royal navy
    label: 'Modern Lagos VIP Senator Suit with gold collar pin',
    trousers: '#1e3a8a',
  },
  super_eagles: {
    name: 'Super Eagles Retro 1994',
    color: 0x10b981, // Vibrant chevron jersey green
    label: 'Iconic Super Eagles National Team Jersey',
    trousers: '#111827',
  },
  white_gold: {
    name: 'Pure White & Gold Kaftan',
    color: 0xffffff,
    label: 'Pristine Sunday Best / Owambe White Kaftan',
    trousers: '#ffffff',
  },
  ankara_gold: {
    name: 'Ankara Wax Pattern',
    color: 0xd97706, // Amber gold print
    label: 'African Ankara fabric with rich gold and bronze accents',
    trousers: '#18181b',
  },
  engineer_vest: {
    name: 'Site Engineer Hardhat & Vest',
    color: 0xf97316, // Safety orange vest
    label: 'Port Harcourt / Lagos Oil & Gas Construction Gear',
    trousers: '#ea580c',
  },
  blue_dress: {
    name: 'Royal Blue Cocktail Gown',
    color: 0x2563eb, // Royal sapphire blue
    label: 'Elegant sleeveless Lagos party and owambe gown',
    trousers: '#1e3a8a',
  },
  peplum_gown: {
    name: 'Ruby Peplum Dress',
    color: 0xdc2626, // Crimson ruby
    label: 'Chic tailored peplum dress with gold accents',
    trousers: '#991b1b',
  },
  ankara_skirt: {
    name: 'Ankara Blossom Skirt',
    color: 0xa855f7, // Royal purple
    label: 'Vibrant tailored African wax print skirt set',
    trousers: '#1e1b4b',
  },
};

export const SKIN_TONES = [
  { name: 'Rich Melanin', hex: '#311d11' },
  { name: 'Warm Mahogany', hex: '#4a2e1d' },
  { name: 'Deep Bronze', hex: '#633d26' },
  { name: 'Golden Honey', hex: '#7c4d30' },
  { name: 'Caramel Glow', hex: '#9a633c' },
];

export const HEADWEAR_OPTIONS: { id: HeadwearType; name: string }[] = [
  { id: 'hardhat', name: 'Safety Hardhat (Site Engineer)' },
  { id: 'bob_wig', name: 'Sleek Bob Hair / Wig' },
  { id: 'braids', name: 'Long Box Braids' },
  { id: 'gele', name: 'Grand Royal Gele' },
  { id: 'fila_cream', name: 'Cream Fila (Yoruba Cap)' },
  { id: 'igbo_red_cap', name: 'Igbo Red Chief Cap' },
  { id: 'afro_hair', name: 'Clean Fade / Afro' },
  { id: 'none', name: 'Natural Hair / No Headwear' },
];

export class CharacterStorage {
  private static STORAGE_KEY = profileKey('nigeria_life_character_v2');

  public static load(): CharacterConfig {
    try {
      const saved = localStorage.getItem(this.STORAGE_KEY);
      if (saved) {
        const cfg: CharacterConfig = { ...DEFAULT_CHARACTER_CONFIG, ...JSON.parse(saved) };
        // Customisation read safely (an old or damaged save never breaks the look)
        cfg.clothingStyles = cleanStyles(cfg.clothingStyles);
        cfg.outfits = cleanOutfits(cfg.outfits);
        return cfg;
      }
    } catch {
      // Fallback to default
    }
    return { ...DEFAULT_CHARACTER_CONFIG };
  }

  public static save(config: CharacterConfig): void {
    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(config));
    } catch {
      // Ignore storage errors
    }
  }
}
