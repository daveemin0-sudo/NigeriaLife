import * as THREE from 'three';
import { BackendService } from '../backend/BackendService';
import { showGameToast } from '../ui/GameToast';
import { UIStateManager } from '../ui/UIStateManager';
import { profileKey } from '../backend/Profile';
import { RENDER_LAYERS } from '../interiors/InteriorTypes';
import { buildFurniture, FURNITURE, type FurnitureKind } from './FurnitureModels';
import { EXTRA_ITEMS, PRICE_FIXES } from './CatalogueExtras';
import { CatalogueSheet } from '../ui/CatalogueSheet';
import { FurnitureThumbs } from '../ui/FurnitureThumbs';

export interface CatalogueItem {
  id: string;
  name: string;
  category: 'appliances' | 'furniture' | 'power' | 'decor';
  price: number;
  icon: string;
  description: string;
  modelType: string;
  /** Added lately: shown under New */
  isNew?: boolean;
}

export const CATALOGUE_ITEMS: CatalogueItem[] = [
  {
    id: 'tiger_gen',
    name: 'Tiger "I-pass-my-neighbour" Generator',
    category: 'power',
    price: 85000,
    icon: '⚡',
    description: 'Iconic Nigerian compact 950W generator. Keeps fan and TV running when NEPA strikes.',
    modelType: 'generator_small',
  },
  {
    id: 'mikano_gen',
    name: 'Mikano 20kVA Silent Soundproof Generator',
    category: 'power',
    price: 1200000,
    icon: '🔋',
    description: 'Industrial heavy-duty diesel generator with automatic changeover. Powers all ACs smoothly.',
    modelType: 'generator_big',
  },
  {
    id: 'smart_tv_75',
    name: '75" 4K Smart OLED TV & Soundbar',
    category: 'appliances',
    price: 450000,
    icon: '📺',
    description: 'Crystal-clear 4K display for streaming Super Eagles and Nollywood classics with stadium sound.',
    modelType: 'tv_75',
  },
  {
    id: 'lontor_fan',
    name: 'Lontor Rechargeable Standing Fan',
    category: 'appliances',
    price: 38000,
    icon: '🌪️',
    description: '16-inch high speed oscillating fan with 12-hour backup battery and night lamp.',
    modelType: 'standing_fan',
  },
  {
    id: 'deep_freezer',
    name: 'Haier Thermocool Inverter Deep Freezer',
    category: 'appliances',
    price: 260000,
    icon: '🧊',
    description: 'Heavy cooling chest freezer. Keeps meat, fish, and chilled Chapman frozen for 100 hours.',
    modelType: 'freezer',
  },
  {
    id: 'water_drum',
    name: '200L Blue Plastic Water Drum & Red Bucket',
    category: 'decor',
    price: 18000,
    icon: '🪣',
    description: 'The undefeated symbol of Nigerian household readiness. Borehole water on tap.',
    modelType: 'drum_bucket',
  },
  {
    id: 'gas_cooker',
    name: '4-Burner Gas Cooker + 12.5kg Cylinder',
    category: 'appliances',
    price: 110000,
    icon: '🍳',
    description: 'Stainless steel cooker with oven and regulator for cooking party jollof and fried plantain.',
    modelType: 'cooker',
  },
  {
    id: 'emerald_sofa',
    name: 'Royal Emerald Velvet Sectional Sofa',
    category: 'furniture',
    price: 320000,
    icon: '🛋️',
    description: 'Deep, plush 3-seater luxury couch with golden embroidery cushions.',
    modelType: 'sofa_emerald',
  },
  {
    id: 'ankara_rug',
    name: 'Circular Orange & Gold Heritage Rug',
    category: 'decor',
    price: 45000,
    icon: '⭕',
    description: 'Handwoven circular floor rug featuring traditional African concentric circle motifs.',
    modelType: 'rug_circle',
  },
  {
    id: 'king_bed',
    name: 'King-Size Royal Bed & Orthopedic Mattress',
    category: 'furniture',
    price: 280000,
    icon: '🛏️',
    description: 'Solid mahogany frame with royal purple duvet and luxury memory foam pillows.',
    modelType: 'king_bed',
  },
  {
    id: 'inverter_solar',
    name: '5kVA Solar Inverter & Tubular Batteries',
    category: 'power',
    price: 650000,
    icon: '☀️',
    description: 'Silent uninterrupted 24/7 green power system. Say goodbye to blackouts permanently.',
    modelType: 'solar_inverter',
  },
  {
    id: 'majesty_palm',
    name: 'Indoor Majesty Palm in Ceramic Pot',
    category: 'decor',
    price: 12000,
    icon: '🪴',
    description: 'Fresh tropical green plant adding oxygen and elegance to the living room.',
    modelType: 'potted_plant',
  },
  {
    id: 'armchair_tan',
    name: 'Tan Leather Armchair',
    category: 'furniture',
    price: 95000,
    icon: '💺',
    description: 'A deep single seat with wide arms. Somewhere to sit that is yours alone.',
    modelType: 'armchair',
  },
  {
    id: 'bookshelf_oak',
    name: 'Oak Bookshelf',
    category: 'furniture',
    price: 70000,
    icon: '📚',
    description: 'Five shelves, already full of books.',
    modelType: 'bookshelf',
  },
  {
    id: 'wardrobe_double',
    name: 'Double Wardrobe with Mirror',
    category: 'furniture',
    price: 140000,
    icon: '🚪',
    description: 'Two doors, a long mirror and room for everything.',
    modelType: 'wardrobe',
  },
  {
    id: 'floor_lamp',
    name: 'Standing Lamp',
    category: 'decor',
    price: 22000,
    icon: '💡',
    description: 'A warm shade on a tall stem, for a corner.',
    modelType: 'floor_lamp',
  },
  {
    id: 'split_ac',
    name: 'Panasonic 2.5HP Inverter Split AC',
    category: 'appliances',
    price: 185000,
    icon: '❄️',
    description: 'Rapid turbo-cooling wall unit with silent inverter compressor and digital temp display.',
    modelType: 'split_ac',
  },
  {
    id: 'wall_clock',
    name: 'Eko Vintage Brass Wall Clock',
    category: 'decor',
    price: 16000,
    icon: '🕰️',
    description: 'Classic silent sweep wall clock with polished brass trim and clear hour markings.',
    modelType: 'wall_clock',
  },
  {
    id: 'wall_art',
    name: 'Benin Bronze Heritage Framed Canvas',
    category: 'decor',
    price: 48000,
    icon: '🖼️',
    description: 'Stunning framed gallery canvas depicting traditional Edo bronze artwork and symbols.',
    modelType: 'wall_art',
  },
  {
    id: 'wall_mirror',
    name: 'Ornate Gilded Wall Mirror',
    category: 'decor',
    price: 32000,
    icon: '🪞',
    description: 'Gilded accent wall mirror that catches the light and adds depth to any room.',
    modelType: 'wall_mirror',
  },
  {
    id: 'sectional_sofa',
    name: 'L-Shaped Velvet Sectional Couch',
    category: 'furniture',
    price: 480000,
    icon: '🛋️',
    description: 'Spacious 5-seater corner sectional sofa with plush charcoal velvet cushions and golden throw pillows.',
    modelType: 'sectional_sofa',
  },
  {
    id: 'queen_canopy_bed',
    name: 'Royal Four-Poster Canopy Bed',
    category: 'furniture',
    price: 390000,
    icon: '🛏️',
    description: 'Mahogany four-poster bed draped in sheer golden fabric with deep luxury orthopedic mattress.',
    modelType: 'queen_canopy_bed',
  },
  {
    id: 'dining_table_6',
    name: 'Mahogany 6-Seater Dining Suite',
    category: 'furniture',
    price: 240000,
    icon: '🪑',
    description: 'Polished mahogany dining table with beveled glass top and six high-back cushioned chairs.',
    modelType: 'dining_table_6',
  },
  {
    id: 'dining_table_10',
    name: 'Grand Carrara Marble 10-Seater Dining Set',
    category: 'furniture',
    price: 850000,
    icon: '🏛️',
    description: 'Massive white Carrara marble dining table with golden pedestal supports and 10 executive dining chairs.',
    modelType: 'dining_table_10',
  },
  {
    id: 'double_door_fridge',
    name: 'Smart French-Door Inverter Refrigerator',
    category: 'appliances',
    price: 620000,
    icon: '🧊',
    description: 'Stainless steel double-door refrigerator with filtered ice/water dispenser and digital touch panel.',
    modelType: 'double_door_fridge',
  },
  {
    id: 'kerosene_stove',
    name: 'Butterfly Brass Kerosene Stove',
    category: 'appliances',
    price: 24000,
    icon: '🔥',
    description: 'The undefeated Lagos student & emergency backup cooking stove with circular brass wick burner.',
    modelType: 'kerosene_stove',
  },
  {
    id: 'bathtub',
    name: 'Freestanding Deep Acrylic Soaking Tub',
    category: 'appliances',
    price: 310000,
    icon: '🛁',
    description: 'Modern oval soaking bathtub with floor-mounted polished chrome gooseneck mixer tap.',
    modelType: 'bathtub',
  },
  {
    id: 'jacuzzi_spa',
    name: 'Hydromassage Octagonal Jacuzzi Spa',
    category: 'appliances',
    price: 980000,
    icon: '🫧',
    description: 'Luxury 6-person hot tub with teak surround, underwater LED mood lighting, and hydrotherapy jets.',
    modelType: 'jacuzzi_spa',
  },
  {
    id: 'toilet_wc',
    name: 'Ceramic Dual-Flush Porcelain Toilet',
    category: 'appliances',
    price: 95000,
    icon: '🚽',
    description: 'Water-saving dual-flush close-coupled ceramic toilet with soft-close antibacterial lid.',
    modelType: 'toilet_wc',
  },
  {
    id: 'ps5_station',
    name: 'PS5 Pro RGB Gaming Battlestation',
    category: 'appliances',
    price: 580000,
    icon: '🎮',
    description: 'PlayStation 5 console, dual haptic controllers, charging dock, and 32" curved gaming monitor with RGB glow.',
    modelType: 'ps5_station',
  },
  {
    id: 'snooker_table',
    name: 'Championship Green Baize Snooker Table',
    category: 'furniture',
    price: 750000,
    icon: '🎱',
    description: 'Full-size regulation billiard & snooker table with carved mahogany legs, balls triangle, and cues.',
    modelType: 'snooker_table',
  },
  {
    id: 'grand_piano',
    name: 'Gloss Ebony Baby Grand Piano',
    category: 'furniture',
    price: 2400000,
    icon: '🎹',
    description: 'Concert-grade baby grand piano in high-gloss black finish with opened lid prop and leather bench.',
    modelType: 'grand_piano',
  },
  {
    id: 'executive_desk',
    name: 'Executive Mahogany Pedestal Desk',
    category: 'furniture',
    price: 220000,
    icon: '💼',
    description: 'Substantial solid mahogany executive office desk with side filing drawers and brass banker lamp.',
    modelType: 'executive_desk',
  },
  {
    id: 'dual_pc_setup',
    name: 'Dual-Monitor Developer Workstation',
    category: 'appliances',
    price: 480000,
    icon: '🖥️',
    description: 'Dual 27" 4K coding displays on articulating monitor arm with mechanical keyboard and RGB tower.',
    modelType: 'dual_pc_setup',
  },
  {
    id: 'bronze_ife_head',
    name: 'Authentic Royal Ife Bronze Sculpture',
    category: 'decor',
    price: 160000,
    icon: '👑',
    description: 'Museum-grade bronze casting of the ancient Ooni of Ife crowned head, mounted on a green serpentine marble base.',
    modelType: 'bronze_ife_head',
  },
  {
    id: 'home_gym',
    name: 'Treadmill & Dumbbell Home Fitness Center',
    category: 'appliances',
    price: 520000,
    icon: '🏋️',
    description: 'Motorized cardio running treadmill paired with an A-frame rack of cast iron dumbbells.',
    modelType: 'home_gym',
  },
  {
    id: 'pool_lounger',
    name: 'Teak Outdoor Poolside Sun Lounger',
    category: 'furniture',
    price: 85000,
    icon: '🏖️',
    description: 'Waterproof teak wood adjustable sunbed with vibrant turquoise marine cushion.',
    modelType: 'pool_lounger',
  },
  {
    id: 'washing_machine',
    name: 'Inverter Front-Loading Washing Machine',
    category: 'appliances',
    price: 340000,
    icon: '🧺',
    description: 'Quiet energy-saving automatic washing machine with fast steam wash and spin dry cycles.',
    modelType: 'washing_machine',
  },
  {
    id: 'chaise_longue',
    name: 'Imperial Velvet Chaise Longue',
    category: 'furniture',
    price: 210000,
    icon: '🛋️',
    description: 'Elegant contoured single-arm daybed with plush amber velvet and dark mahogany turned legs.',
    modelType: 'chaise_longue',
  },
  {
    id: 'ottoman',
    name: 'Embroidered Royal Blue Ottoman',
    category: 'furniture',
    price: 65000,
    icon: '🪑',
    description: 'Deep royal blue velvet padded footstool with tufted buttons and concealed storage space.',
    modelType: 'ottoman',
  },
  {
    id: 'velvet_looveseat',
    name: 'Ruby Red Velvet Loveseat',
    category: 'furniture',
    price: 260000,
    icon: '🛋️',
    description: 'Romantic 2-seater plush loveseat with crimson velvet upholstery and golden piping.',
    modelType: 'velvet_looveseat',
  },
  {
    id: 'bunk_bed',
    name: 'Solid Timber Twin Bunk Bed',
    category: 'furniture',
    price: 195000,
    icon: '🛏️',
    description: 'Sturdy twin-tier hardwood bunk bed with integrated safety rails and access ladder.',
    modelType: 'bunk_bed',
  },
  {
    id: 'single_bed',
    name: 'Solid Teak Single Bed & Mattress',
    category: 'furniture',
    price: 120000,
    icon: '🛏️',
    description: 'Durable teak wood frame with breathable orthopedic medium-firm foam mattress.',
    modelType: 'single_bed',
  },
  {
    id: 'walkin_closet',
    name: 'Modular Walk-in Wardrobe Unit',
    category: 'furniture',
    price: 380000,
    icon: '🚪',
    description: 'Expansive multi-compartment wardrobe with integrated shoe racks, hangers, and LED lights.',
    modelType: 'walkin_closet',
  },
  {
    id: 'nightstand',
    name: 'Carved Mahogany Bedside Nightstand',
    category: 'furniture',
    price: 45000,
    icon: '🪑',
    description: 'Two-drawer bedside table with brushed brass knobs and cable management recess.',
    modelType: 'nightstand',
  },
  {
    id: 'kitchen_island',
    name: 'Granite Countertop Kitchen Prep Island',
    category: 'furniture',
    price: 340000,
    icon: '🍳',
    description: 'Heavy polished granite kitchen island with storage cabinets and two bar stools.',
    modelType: 'kitchen_island',
  },
  {
    id: 'microwave_oven',
    name: 'Digital Inverter Convection Microwave',
    category: 'appliances',
    price: 85000,
    icon: '🍲',
    description: '32-litre stainless steel microwave with grill, defrost presets, and child lock.',
    modelType: 'microwave_oven',
  },
  {
    id: 'blender_toaster',
    name: 'Commercial Blender & 4-Slice Toaster Set',
    category: 'appliances',
    price: 55000,
    icon: '🍹',
    description: 'Heavy-duty 2200W bean and smoothie blender paired with a stainless crumb-tray toaster.',
    modelType: 'blender_toaster',
  },
  {
    id: 'rain_shower',
    name: 'Thermostatic Rainfall Shower Tower',
    category: 'appliances',
    price: 165000,
    icon: '🚿',
    description: 'Ceiling-mounted 12" monsoon rain head with handheld wand and massage body jets.',
    modelType: 'rain_shower',
  },
  {
    id: 'bathroom_vanity',
    name: 'Marble Floating Double Vanity Sink',
    category: 'appliances',
    price: 240000,
    icon: '🪞',
    description: 'Wall-hung Italian Carrara marble vanity with dual ceramic basins and soft-close drawers.',
    modelType: 'bathroom_vanity',
  },
  {
    id: 'home_cinema',
    name: '4K Laser Cinema Projector & Screen',
    category: 'appliances',
    price: 1450000,
    icon: '🎬',
    description: 'Ultra-short throw 4K laser projector with 120" ambient light rejecting motorized screen.',
    modelType: 'home_cinema',
  },
  {
    id: 'hifi_soundbar',
    name: 'Dolby Atmos 7.1.4 Wireless Soundbar',
    category: 'appliances',
    price: 290000,
    icon: '🔊',
    description: 'True immersive audio with up-firing height drivers and dedicated wireless subwoofer.',
    modelType: 'hifi_soundbar',
  },
  {
    id: 'ergonomic_chair',
    name: 'Executive Ergonomic Lumbar Mesh Chair',
    category: 'furniture',
    price: 135000,
    icon: '💺',
    description: 'Full breathable mesh task chair with 4D adjustable armrests and dynamic lumbar support.',
    modelType: 'ergonomic_chair',
  },
  {
    id: 'creator_ringlight',
    name: '18" Studio Bi-Colour Ring Light & Stand',
    category: 'appliances',
    price: 42000,
    icon: '💡',
    description: 'Professional video illumination with cold/warm color temperature dials and smartphone clamp.',
    modelType: 'creator_ringlight',
  },
  {
    id: 'persian_rug',
    name: 'Royal Isfahan Silk-Blend Persian Carpet',
    category: 'decor',
    price: 185000,
    icon: '🧿',
    description: 'Intricately patterned 3m x 2m rectangular area rug with classical medallions and floral borders.',
    modelType: 'persian_rug',
  },
  {
    id: 'crystal_chandelier',
    name: 'Bohemian Crystal Tiered Chandelier',
    category: 'decor',
    price: 420000,
    icon: '✨',
    description: 'Spectacular multi-tier pendant chandelier with faceted crystal prisms that refract radiant light.',
    modelType: 'crystal_chandelier',
  },
  {
    id: 'curtains_velvet',
    name: 'Golden Thread Embroidered Velvet Drapes',
    category: 'decor',
    price: 78000,
    icon: '🪟',
    description: 'Full-length blackout velvet curtains with hand-embroidered gold filigree border trim.',
    modelType: 'curtains_velvet',
  },
  {
    id: 'outdoor_fountain',
    name: 'Tiered Stone Courtyard Cascade Fountain',
    category: 'decor',
    price: 320000,
    icon: '⛲',
    description: 'Three-tier carved limestone water feature with recirculating pump and gentle ambient sound.',
    modelType: 'outdoor_fountain',
  },
  {
    id: 'wine_wall',
    name: 'Climate-Controlled Glass Wine Display',
    category: 'furniture',
    price: 680000,
    icon: '🍷',
    description: 'Frameless glass refrigerated cellar cabinet holding 72 bottles under soft amber LED lighting.',
    modelType: 'wine_wall',
  },
  {
    id: 'massage_chair',
    name: 'Zero-Gravity 4D AI Shiatsu Massage Chair',
    category: 'furniture',
    price: 1150000,
    icon: '💆',
    description: 'Full-body robotic massage recliner with body scan, heated rollers, and calf acupressure.',
    modelType: 'massage_chair',
  },
  {
    id: 'drinks_trolley',
    name: 'Art Deco Brass & Smoked Glass Drinks Trolley',
    category: 'furniture',
    price: 145000,
    icon: '🍸',
    description: 'Two-tier rolling hospitality bar cart with brass guardrails, crystal decanter holder, and stemware rack.',
    modelType: 'drinks_trolley',
  },
  {
    id: 'vintage_gramophone',
    name: 'Vintage Brass Horn Gramophone & Vinyl Deck',
    category: 'appliances',
    price: 210000,
    icon: '🎺',
    description: 'Polished mahogany cabinet phonograph with flared brass acoustic horn playing classic highlife records.',
    modelType: 'vintage_gramophone',
  },
  {
    id: 'calabar_chest',
    name: 'Hand-Carved Calabar Mahogany Hope Chest',
    category: 'furniture',
    price: 165000,
    icon: '🧰',
    description: 'Artisan carved solid mahogany trunk featuring intricate geometric relief motifs and brass latches.',
    modelType: 'calabar_chest',
  },
  {
    id: 'benin_bronze_leopard',
    name: 'Benin Royal Court Bronze Leopard Figurine',
    category: 'decor',
    price: 420000,
    icon: '🐆',
    description: 'Lost-wax cast bronze statuette of the royal Benin ceremonial leopard on an ebony pedestal.',
    modelType: 'benin_bronze_leopard',
  },
  {
    id: 'smart_mirror',
    name: 'Touchscreen Smart Vanity Mirror with Weather HUD',
    category: 'appliances',
    price: 285000,
    icon: '🪞',
    description: 'Backlit two-way glass mirror with integrated digital clock, Lagos weather ticker, and Bluetooth audio.',
    modelType: 'smart_mirror',
  },
];

CATALOGUE_ITEMS.push(...EXTRA_ITEMS);
for (const item of CATALOGUE_ITEMS) if (PRICE_FIXES[item.id]) item.price = PRICE_FIXES[item.id];

/** A piece of furniture standing in the home. */
export interface PlacedItem {
  uid: string;
  id: string;
  modelType: string;
  /** Where its middle is, measured from the middle of the home */
  x: number;
  z: number;
  /** Quarter turns from facing the front of the home */
  turns: number;
  mesh: THREE.Group;
}

/** A piece being put down: where it would go, which way round, and whether it is one being moved. */
export interface Placing {
  item: CatalogueItem;
  x: number;
  z: number;
  turns: number;
  moving: PlacedItem | null;
  /** Taken out of storage: it was paid for when it was bought */
  stored?: boolean;
}

/** What the home tells the furniture about itself. */
export interface RoomForFurniture {
  halfWidth: number;
  halfLength: number;
  /** What the home came with that stands on the floor (its own furniture, the inner walls), as rectangles */
  solids(): Array<{ x: number; z: number; halfWidth: number; halfLength: number }>;
  block(x: number, z: number, halfWidth: number, halfLength: number): void;
  unblock(x: number, z: number, halfWidth: number, halfLength: number): void;
  /** Places that must stay open: inside the front door, and where the player comes in */
  keepClear: Array<{ x: number; z: number }>;
}

export const WALL_COLOURS: Array<{ id: string; name: string; hex: number }> = [
  { id: 'ochre', name: 'Ochre', hex: 0xd97706 },
  { id: 'cream', name: 'Cream', hex: 0xf1dfb8 },
  { id: 'sage', name: 'Sage green', hex: 0x84a98c },
  { id: 'sky', name: 'Sky blue', hex: 0x7fb3d5 },
  { id: 'rose', name: 'Dusty rose', hex: 0xd8a7a0 },
  { id: 'slate', name: 'Slate', hex: 0x64748b },
  { id: 'emerald', name: 'Royal Emerald', hex: 0x065f46 },
  { id: 'terracotta', name: 'Terracotta Earth', hex: 0xc2410c },
  { id: 'ivory', name: 'Warm Ivory', hex: 0xfffff0 },
  { id: 'peach', name: 'Coral Peach', hex: 0xfb923c },
  { id: 'gold', name: 'Imperial Gold', hex: 0xeab308 },
  { id: 'navy', name: 'Midnight Navy', hex: 0x1e3a8a },
];
export const PAINT_PRICE = 15000;

export const FLOOR_STYLES: Array<{ id: string; name: string; hex: number; roughness: number }> = [
  { id: 'ceramic_white', name: 'Polished Ceramic', hex: 0xf1f5f9, roughness: 0.2 },
  { id: 'parquet_wood', name: 'Warm Hardwood Parquet', hex: 0x78350f, roughness: 0.45 },
  { id: 'terrazzo', name: 'Lagos Terrazzo Tile', hex: 0xd1d5db, roughness: 0.35 },
  { id: 'marble_black', name: 'Nero Black Marble', hex: 0x1e293b, roughness: 0.15 },
  { id: 'royal_maroon', name: 'Royal Maroon Velvet Carpet', hex: 0x881337, roughness: 0.8 },
  { id: 'calacatta_gold', name: 'Calacatta White & Gold Marble', hex: 0xf8fafc, roughness: 0.12 },
  { id: 'grey_granite', name: 'Polished Grey Granite', hex: 0x64748b, roughness: 0.25 },
  { id: 'chevron_oak', name: 'Dark Chevron Oak Timber', hex: 0x451a03, roughness: 0.4 },
];
export const FLOOR_PRICE = 25000;

/** What is given back for a piece that is sold on */
export const SELL_SHARE = 0.5;
const GRID = 0.25;

export class HouseDecorationSystem {
  private static instance: HouseDecorationSystem;
  private backend: BackendService;
  public placedItemsGroup: THREE.Group;
  private storageKey = profileKey('nigeria_life_placed_furniture_v1');
  private lookKey = profileKey('nigeria_life_home_look_v1');
  private storeKey = profileKey('nigeria_life_furniture_storage_v1');
  /** Pieces the player owns that are put away, not standing in the home (catalogue ids) */
  public stored: string[] = [];
  public isBuyMode: boolean = false;
  public onFurniturePlaced?: (item: CatalogueItem) => void;

  /** Everything standing in the home that the player put there */
  public readonly placed: PlacedItem[] = [];
  /** The piece being put down now, if any */
  public placing: Placing | null = null;
  /** The colour the walls are painted */
  public wallColour = 'ochre';
  /** The style of flooring fitted */
  public floorStyle = 'ceramic_white';
  /** Told when furniture is added, moved or taken away */
  public onChanged: (() => void) | null = null;
  /** Told whenever the piece being put down moves, turns, lands or is given up */
  public onPlacingChanged: (() => void) | null = null;
  /** Told to paint the walls */
  public onPaint: ((hex: number) => void) | null = null;
  /** Told to fit the floor */
  public onFloor: ((hex: number, roughness: number) => void) | null = null;
  /** Where a new piece first appears: in front of the player */
  public startAt: (() => { x: number; z: number }) | null = null;

  private room: RoomForFurniture | null = null;
  private ghost: THREE.Group | null = null;
  private ghostMark: THREE.Mesh | null = null;
  private sizes = new Map<string, { width: number; depth: number }>();

  private constructor() {
    this.backend = BackendService.getInstance();
    this.backend.propertyFittingsProvider = () => this.exportFittings();
    this.backend.onPropertyFittingsGranted = (_id, fittings) => this.importFittings(fittings);
    this.backend.onPropertySoldToAgent = () => this.clearPlaced();
    this.placedItemsGroup = new THREE.Group();
    this.loadSavedFurniture();
    try {
      const stored = JSON.parse(localStorage.getItem(this.storeKey) || '[]');
      if (Array.isArray(stored)) this.stored = stored.filter((id) => typeof id === 'string' && CATALOGUE_ITEMS.some((item) => item.id === id));
    } catch {
      // Nothing put away that can be read back
    }
    try {
      const look = JSON.parse(localStorage.getItem(this.lookKey) || 'null');
      if (look && WALL_COLOURS.some((colour) => colour.id === look.wall)) this.wallColour = look.wall;
      if (look && FLOOR_STYLES.some((f) => f.id === look.floor)) this.floorStyle = look.floor;
    } catch {
      // A look that cannot be read back is the one the home came with
    }
  }

  public static getInstance(): HouseDecorationSystem {
    if (!HouseDecorationSystem.instance) {
      HouseDecorationSystem.instance = new HouseDecorationSystem();
    }
    return HouseDecorationSystem.instance;
  }

  // =========================================================================
  // THE HOME IT FURNISHES
  // =========================================================================

  /** The home says how big it is and where people can stand. What is already placed is made solid in it. */
  public attach(room: RoomForFurniture): void {
    this.room = room;
    for (const item of this.placed) this.solidify(item, true);
    this.onPaint?.(this.wallHex());
    const fi = this.floorInfo();
    this.onFloor?.(fi.hex, fi.roughness);
  }

  public wallHex(): number {
    return WALL_COLOURS.find((colour) => colour.id === this.wallColour)?.hex ?? WALL_COLOURS[0].hex;
  }

  public floorInfo(): { hex: number; roughness: number } {
    const style = FLOOR_STYLES.find((f) => f.id === this.floorStyle) ?? FLOOR_STYLES[0];
    return { hex: style.hex, roughness: style.roughness };
  }

  public kind(modelType: string): FurnitureKind {
    return FURNITURE[modelType] ?? { solid: true, use: 'none' };
  }

  public catalogueItem(id: string): CatalogueItem | null {
    return CATALOGUE_ITEMS.find((item) => item.id === id) ?? null;
  }

  /** How much floor a piece takes, turned as given. */
  public footprint(modelType: string, turns: number): { width: number; depth: number } {
    let size = this.sizes.get(modelType);
    if (!size) {
      const box = new THREE.Box3().setFromObject(this.createFurniture3DMesh(modelType));
      size = { width: Math.max(0.3, box.max.x - box.min.x), depth: Math.max(0.3, box.max.z - box.min.z) };
      this.sizes.set(modelType, size);
    }
    return turns % 2 === 0 ? size : { width: size.depth, depth: size.width };
  }

  /** The way a piece faces, as a step along the floor. */
  public facing(turns: number): { x: number; z: number } {
    return { x: Math.round(Math.sin((turns * Math.PI) / 2)), z: Math.round(Math.cos((turns * Math.PI) / 2)) };
  }

  private solidify(item: PlacedItem, solid: boolean): void {
    if (!this.room || !this.kind(item.modelType).solid) return;
    const size = this.footprint(item.modelType, item.turns);
    if (solid) this.room.block(item.x, item.z, size.width / 2, size.depth / 2);
    else this.room.unblock(item.x, item.z, size.width / 2, size.depth / 2);
  }

  private dress(mesh: THREE.Group, x: number, z: number, turns: number, modelType?: string): void {
    const elevation = (modelType ? this.kind(modelType).elevation : undefined) ?? 0;
    mesh.position.set(x, elevation, z);
    mesh.rotation.y = (turns * Math.PI) / 2;
    mesh.traverse((child) => child.layers.set(RENDER_LAYERS.INTERIOR));
  }

  // =========================================================================
  // PUTTING A PIECE DOWN
  // =========================================================================

  /** Starts putting a new piece down. Nothing is paid until it is placed. */
  public beginPlacing(itemId: string, options: { stored?: boolean } = {}): boolean {
    const item = this.catalogueItem(itemId);
    if (!item || !this.room) return false;
    if (options.stored && !this.stored.includes(itemId)) return false;
    this.cancel();
    this.closeCatalogueModal();
    const at = this.startAt?.() ?? { x: 0, z: 4 };
    this.placing = { item, x: this.snap(at.x), z: this.snap(at.z), turns: 0, moving: null, stored: !!options.stored };
    this.showGhost();
    return true;
  }

  /** Picks up a piece already in the home, to put it somewhere else. Costs nothing. */
  public pickUp(uid: string): boolean {
    const moving = this.placed.find((item) => item.uid === uid);
    const item = moving && this.catalogueItem(moving.id);
    if (!moving || !item || !this.room) return false;
    this.cancel();
    this.solidify(moving, false);
    moving.mesh.visible = false;
    this.placing = { item, x: moving.x, z: moving.z, turns: moving.turns, moving };
    this.showGhost();
    this.onChanged?.();
    return true;
  }

  private snap(value: number): number {
    return Math.round(value / GRID) * GRID;
  }

  /** Moves the piece being put down to a point on the floor, measured from the middle of the home. */
  public moveTo(x: number, z: number): boolean {
    if (!this.placing) return false;
    this.placing.x = this.snap(x);
    this.placing.z = this.snap(z);
    this.showGhost();
    return true;
  }

  public turn(): void {
    if (!this.placing) return;
    this.placing.turns = (this.placing.turns + 1) % 4;
    this.showGhost();
  }

  /** Why the piece cannot go where it is, or null if it can. */
  public blocked(): string | null {
    const placing = this.placing;
    const room = this.room;
    if (!placing || !room) return 'Nothing is being placed.';
    const size = this.footprint(placing.item.modelType, placing.turns);
    const minX = placing.x - size.width / 2;
    const maxX = placing.x + size.width / 2;
    const minZ = placing.z - size.depth / 2;
    const maxZ = placing.z + size.depth / 2;
    if (minX < -room.halfWidth + 0.2 || maxX > room.halfWidth - 0.2 || minZ < -room.halfLength + 0.2 || maxZ > room.halfLength - 0.2) return 'That is through the wall.';
    for (const point of room.keepClear) {
      if (point.x > minX - 0.9 && point.x < maxX + 0.9 && point.z > minZ - 0.9 && point.z < maxZ + 0.9) return 'That would block the way in.';
    }
    if (this.kind(placing.item.modelType).solid) {
      // Pieces may touch, and stand against a wall; they may not stand in one another
      const overlaps = (x: number, z: number, halfWidth: number, halfLength: number) =>
        x - halfWidth < maxX - 0.02 && x + halfWidth > minX + 0.02 && z - halfLength < maxZ - 0.02 && z + halfLength > minZ + 0.02;
      for (const solid of room.solids()) {
        if (overlaps(solid.x, solid.z, solid.halfWidth, solid.halfLength)) return 'Something is already standing there.';
      }
      for (const other of this.placed) {
        if (other === placing.moving || !this.kind(other.modelType).solid) continue;
        const theirs = this.footprint(other.modelType, other.turns);
        if (overlaps(other.x, other.z, theirs.width / 2, theirs.depth / 2)) return 'Something is already standing there.';
      }
    }
    if (!placing.moving && !placing.stored) {
      const data = this.backend.getData();
      if (data.walletCash + data.bank.balance < placing.item.price) return `You need ₦${placing.item.price.toLocaleString()} for it.`;
    }
    return null;
  }

  /** Puts the piece down where it is. A new piece is paid for here, once. */
  public confirm(): { ok: boolean; reason?: string } {
    const placing = this.placing;
    if (!placing) return { ok: false, reason: 'Nothing is being placed.' };
    const reason = this.blocked();
    if (reason) return { ok: false, reason };

    let item = placing.moving;
    if (item) {
      item.x = placing.x;
      item.z = placing.z;
      item.turns = placing.turns;
      item.mesh.visible = true;
    } else {
      if (placing.stored) {
        // Out of storage: already the player's
        const at = this.stored.indexOf(placing.item.id);
        if (at < 0) return { ok: false, reason: 'It is no longer in storage.' };
        this.stored.splice(at, 1);
        this.saveStored();
      } else if (!this.backend.pay(placing.item.price, `Furnishing: ${placing.item.name}`)) {
        // Wallet first, bank covers any shortfall
        return { ok: false, reason: `You need ₦${placing.item.price.toLocaleString()} for it.` };
      }
      item = {
        uid: `${placing.item.id}_${Date.now().toString(36)}${Math.floor(Math.random() * 1296).toString(36)}`,
        id: placing.item.id,
        modelType: placing.item.modelType,
        x: placing.x,
        z: placing.z,
        turns: placing.turns,
        mesh: this.createFurniture3DMesh(placing.item.modelType),
      };
      this.placed.push(item);
      this.placedItemsGroup.add(item.mesh);
    }
    this.dress(item.mesh, item.x, item.z, item.turns, item.modelType);
    this.solidify(item, true);
    const wasNew = !placing.moving && !placing.stored;
    this.placing = null;
    this.hideGhost();
    this.save();
    this.onChanged?.();
    this.onPlacingChanged?.();
    if (wasNew) {
      showGameToast(`${placing.item.name} is in place. ₦${placing.item.price.toLocaleString()} paid.`, 'success');
      this.onFurniturePlaced?.(placing.item);
    } else if (placing.stored) {
      showGameToast(`${placing.item.name} is out of storage and in place.`, 'success');
    }
    this.backToCatalogue(true);
    return { ok: true };
  }

  /** Gives up putting the piece down. A piece that was being moved goes back where it was. */
  public cancel(): void {
    const placing = this.placing;
    if (!placing) return;
    if (placing.moving) {
      placing.moving.mesh.visible = true;
      this.solidify(placing.moving, true);
    }
    this.placing = null;
    this.hideGhost();
    if (placing.moving) this.onChanged?.();
    this.onPlacingChanged?.();
    this.backToCatalogue(false);
  }

  /**
   * Takes in pieces that are already the player's, free: what a home came with, handed over so
   * it can be moved, put away or sold like anything bought. A piece is left out if a solid piece
   * of the player's own already stands where it would go, or one with its id is already placed.
   */
  public adopt(pieces: Array<{ uid?: string; id: string; x: number; z: number; turns: number }>): number {
    let taken = 0;
    const overlaps = (x: number, z: number, w: number, d: number) => this.placed.some((other) => {
      if (!this.kind(other.modelType).solid) return false;
      const o = this.footprint(other.modelType, other.turns);
      return Math.abs(other.x - x) * 2 < o.width + w - 0.05 && Math.abs(other.z - z) * 2 < o.depth + d - 0.05;
    });
    for (const piece of pieces) {
      const entry = this.catalogueItem(piece.id);
      if (!entry) continue;
      if (piece.uid && this.placed.some((item) => item.uid === piece.uid)) continue;
      const size = this.footprint(entry.modelType, piece.turns);
      if (this.kind(entry.modelType).solid && overlaps(piece.x, piece.z, size.width, size.depth)) continue;
      const item: PlacedItem = {
        uid: piece.uid ?? `${piece.id}_came_${taken.toString(36)}${Date.now().toString(36)}`,
        id: piece.id,
        modelType: entry.modelType,
        x: piece.x,
        z: piece.z,
        turns: piece.turns,
        mesh: this.createFurniture3DMesh(entry.modelType),
      };
      this.dress(item.mesh, item.x, item.z, item.turns, item.modelType);
      this.placed.push(item);
      this.placedItemsGroup.add(item.mesh);
      if (this.room) this.solidify(item, true);
      taken++;
    }
    if (taken) {
      this.save();
      this.onChanged?.();
    }
    return taken;
  }

  /** Sells a piece on, for part of what it cost new. */
  public sell(uid: string): { ok: boolean; refund: number } {
    const index = this.placed.findIndex((item) => item.uid === uid);
    if (index < 0) return { ok: false, refund: 0 };
    if (this.placing?.moving?.uid === uid) this.cancel();
    const item = this.placed[index];
    const refund = this.resaleValue(item);
    this.solidify(item, false);
    item.mesh.removeFromParent();
    this.placed.splice(index, 1);
    this.backend.processTransaction({ type: 'ITEM_SALE', amount: refund, description: `Sold: ${this.catalogueItem(item.id)?.name ?? 'furniture'}` });
    this.save();
    this.onChanged?.();
    return { ok: true, refund };
  }

  /** Puts a piece away: out of the home, into storage, to be placed again later for nothing. */
  public putAway(uid: string): boolean {
    const index = this.placed.findIndex((item) => item.uid === uid);
    if (index < 0) return false;
    if (this.placing?.moving?.uid === uid) this.cancel();
    const item = this.placed[index];
    this.solidify(item, false);
    item.mesh.removeFromParent();
    this.placed.splice(index, 1);
    this.stored.push(item.id);
    this.saveStored();
    this.save();
    this.onChanged?.();
    return true;
  }

  private saveStored(): void {
    try {
      localStorage.setItem(this.storeKey, JSON.stringify(this.stored));
    } catch {
      // Storage full or shut off: what is put away is remembered until the page is closed
    }
  }

  public resaleValue(item: PlacedItem): number {
    return Math.round((this.catalogueItem(item.id)?.price ?? 0) * SELL_SHARE);
  }

  private showGhost(): void {
    const placing = this.placing;
    if (!placing) return;
    if (!this.ghost || this.ghost.userData.modelType !== placing.item.modelType) {
      this.hideGhost();
      this.ghost = this.createFurniture3DMesh(placing.item.modelType);
      this.ghost.userData.modelType = placing.item.modelType;
      // Seen through, so what is behind it and under it can be judged
      this.ghost.traverse((child) => {
        const mesh = child as THREE.Mesh;
        if (!mesh.isMesh) return;
        const material = (mesh.material as THREE.Material).clone();
        material.transparent = true;
        material.opacity = 0.72;
        mesh.material = material;
      });
      this.ghostMark = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.4, depthWrite: false }));
      this.ghostMark.rotation.x = -Math.PI / 2;
      this.placedItemsGroup.add(this.ghost, this.ghostMark);
    }
    this.dress(this.ghost, placing.x, placing.z, placing.turns, placing.item.modelType);
    const size = this.footprint(placing.item.modelType, placing.turns);
    if (this.ghostMark) {
      this.ghostMark.position.set(placing.x, 0.03, placing.z);
      this.ghostMark.scale.set(size.width + 0.2, size.depth + 0.2, 1);
      this.ghostMark.layers.set(RENDER_LAYERS.INTERIOR);
      // Green where it may stand, red where it may not
      (this.ghostMark.material as THREE.MeshBasicMaterial).color.setHex(this.blocked() ? 0xdc2626 : 0x16a34a);
    }
    this.onPlacingChanged?.();
  }

  private hideGhost(): void {
    this.ghost?.removeFromParent();
    this.ghostMark?.removeFromParent();
    this.ghost = null;
    this.ghostMark = null;
  }

  // =========================================================================
  // THE WALLS & FLOORS
  // =========================================================================

  /** Paints the walls another colour. Painting them the colour they are costs nothing and does nothing. */
  public paintWalls(colourId: string): { ok: boolean; reason?: string } {
    const colour = WALL_COLOURS.find((one) => one.id === colourId);
    if (!colour) return { ok: false, reason: 'No such colour.' };
    if (colour.id === this.wallColour) return { ok: false, reason: `The walls are ${colour.name.toLowerCase()} already.` };
    if (!this.backend.pay(PAINT_PRICE, `Painting the walls ${colour.name.toLowerCase()}`)) {
      return { ok: false, reason: `Painting costs ₦${PAINT_PRICE.toLocaleString()}. You do not have it.` };
    }
    this.wallColour = colour.id;
    try {
      localStorage.setItem(this.lookKey, JSON.stringify({ wall: colour.id, floor: this.floorStyle }));
    } catch {
      // Storage shut off: the colour holds until the page is closed
    }
    this.onPaint?.(colour.hex);
    this.backend.notifyDeedChanged();
    return { ok: true };
  }

  /** Fits a different style of flooring. Fitting the style already fitted costs nothing and does nothing. */
  public paintFloor(styleId: string): { ok: boolean; reason?: string } {
    const style = FLOOR_STYLES.find((one) => one.id === styleId);
    if (!style) return { ok: false, reason: 'No such flooring.' };
    if (style.id === this.floorStyle) return { ok: false, reason: `The floor is ${style.name.toLowerCase()} already.` };
    if (!this.backend.pay(FLOOR_PRICE, `Fitting ${style.name.toLowerCase()} flooring`)) {
      return { ok: false, reason: `Flooring costs ₦${FLOOR_PRICE.toLocaleString()}. You do not have it.` };
    }
    this.floorStyle = style.id;
    try {
      localStorage.setItem(this.lookKey, JSON.stringify({ wall: this.wallColour, floor: style.id }));
    } catch {
      // Storage shut off: the flooring holds until the page is closed
    }
    this.onFloor?.(style.hex, style.roughness);
    this.backend.notifyDeedChanged();
    return { ok: true };
  }

  /** Serializes placed furniture to accompany a property deed transfer */
  public exportFittings(): string[] {
    const list = this.placed.map((item) => JSON.stringify({
      uid: item.uid,
      id: item.id,
      modelType: item.modelType,
      x: item.x,
      z: item.z,
      turns: item.turns,
    }));
    list.push(JSON.stringify({ type: 'look', wall: this.wallColour, floor: this.floorStyle }));
    return list;
  }

  /** Populates furniture into the home from an inherited deed transfer */
  public importFittings(fittings: string[]): void {
    this.clearPlaced();
    for (const entry of fittings) {
      try {
        const parsed = JSON.parse(entry);
        if (parsed?.type === 'look') {
          if (parsed.wall && WALL_COLOURS.some((c) => c.id === parsed.wall)) {
            this.wallColour = parsed.wall;
            this.onPaint?.(this.wallHex());
          }
          if (parsed.floor && FLOOR_STYLES.some((f) => f.id === parsed.floor)) {
            this.floorStyle = parsed.floor;
            const fi = this.floorInfo();
            this.onFloor?.(fi.hex, fi.roughness);
          }
          try {
            localStorage.setItem(this.lookKey, JSON.stringify({ wall: this.wallColour, floor: this.floorStyle }));
          } catch {
            // Storage unavailable
          }
          continue;
        }
        if (!parsed || !parsed.modelType) continue;
        const item: PlacedItem = {
          uid: parsed.uid ?? `${parsed.id}_${Date.now().toString(36)}`,
          id: parsed.id,
          modelType: parsed.modelType,
          x: parsed.x ?? 0,
          z: parsed.z ?? 4,
          turns: parsed.turns ?? 0,
          mesh: this.createFurniture3DMesh(parsed.modelType),
        };
        this.dress(item.mesh, item.x, item.z, item.turns, item.modelType);
        this.placed.push(item);
        this.placedItemsGroup.add(item.mesh);
        this.solidify(item, true);
      } catch {
        // Skip malformed fitting
      }
    }
    this.save();
    this.onChanged?.();
  }

  /** Clears placed furniture when ownership is relinquished */
  public clearPlaced(): void {
    for (const item of this.placed) {
      this.solidify(item, false);
      item.mesh.removeFromParent();
    }
    this.placed.length = 0;
    this.wallColour = 'ochre';
    this.floorStyle = 'ceramic_white';
    try {
      localStorage.setItem(this.lookKey, JSON.stringify({ wall: this.wallColour, floor: this.floorStyle }));
    } catch {
      // Storage unavailable
    }
    this.onPaint?.(this.wallHex());
    const fi = this.floorInfo();
    this.onFloor?.(fi.hex, fi.roughness);
    this.save();
    this.onChanged?.();
  }

  // =========================================================================
  // THE CATALOGUE
  // =========================================================================

  private sheet: CatalogueSheet | null = null;
  /** The piece being put down was chosen in the catalogue: it opens again once it is down */
  private fromSheet = false;

  private catalogue(): CatalogueSheet {
    if (!this.sheet) {
      this.sheet = new CatalogueSheet({
        items: () => CATALOGUE_ITEMS,
        kind: (modelType) => this.kind(modelType),
        footprint: (modelType, turns) => this.footprint(modelType, turns),
        money: () => {
          const data = this.backend.getData();
          return data.walletCash + data.bank.balance;
        },
        stored: () => this.stored,
        begin: (id, stored) => {
          const ok = this.beginPlacing(id, { stored });
          if (ok) this.fromSheet = true;
          return ok;
        },
        walls: () => WALL_COLOURS,
        floors: () => FLOOR_STYLES,
        wallNow: () => this.wallColour,
        floorNow: () => this.floorStyle,
        paintPrice: PAINT_PRICE,
        floorPrice: FLOOR_PRICE,
        paint: (id) => this.paintWalls(id),
        fitFloor: (id) => this.paintFloor(id),
        opened: () => UIStateManager.getInstance().pushModal('house-catalogue'),
        closed: () => UIStateManager.getInstance().popModal('house-catalogue'),
      });
    }
    return this.sheet;
  }

  /** Opens the catalogue: a sheet from the bottom of the screen with the home above it */
  public openCatalogueModal(): void {
    FurnitureThumbs.build ??= (modelType) => this.createFurniture3DMesh(modelType);
    this.catalogue().open();
  }

  public closeCatalogueModal(): void {
    this.sheet?.close();
  }

  public isCatalogueOpen(): boolean {
    return !!this.sheet?.isOpen;
  }

  /** A piece chosen in the catalogue is down, or was given up: back to the catalogue (or on to the next picked) */
  private backToCatalogue(placed: boolean): void {
    if (!this.fromSheet) return;
    this.fromSheet = false;
    this.sheet?.placingEnded(placed);
  }

  public createFurniture3DMesh(modelType: string): THREE.Group {
    const made = buildFurniture(modelType);
    if (made) return made;
    const group = new THREE.Group();

    if (modelType === 'generator_small') {
      // Tiger "I-pass-my-neighbour" generator (Red fuel tank, black frame)
      const frame = new THREE.Mesh(
        new THREE.BoxGeometry(0.8, 0.7, 0.6),
        new THREE.MeshStandardMaterial({ color: 0x18181b, roughness: 0.6 })
      );
      frame.position.y = 0.35;
      group.add(frame);

      const tank = new THREE.Mesh(
        new THREE.BoxGeometry(0.7, 0.2, 0.5),
        new THREE.MeshStandardMaterial({ color: 0xdc2626, roughness: 0.3 }) // Red tank
      );
      tank.position.y = 0.75;
      group.add(tank);

      const pullCord = new THREE.Mesh(
        new THREE.CylinderGeometry(0.12, 0.12, 0.08, 12),
        new THREE.MeshStandardMaterial({ color: 0xf59e0b })
      );
      pullCord.rotation.z = Math.PI / 2;
      pullCord.position.set(0.42, 0.4, 0);
      group.add(pullCord);
    } else if (modelType === 'generator_big') {
      // Mikano Silent Soundproof 20kVA (Large green canopy with exhaust)
      const body = new THREE.Mesh(
        new THREE.BoxGeometry(2.4, 1.6, 1.2),
        new THREE.MeshStandardMaterial({ color: 0x15803d, roughness: 0.4, metalness: 0.3 })
      );
      body.position.y = 0.8;
      group.add(body);

      const exhaust = new THREE.Mesh(
        new THREE.CylinderGeometry(0.1, 0.1, 0.8, 12),
        new THREE.MeshStandardMaterial({ color: 0x09090b, metalness: 0.8 })
      );
      exhaust.position.set(0.8, 1.8, 0);
      group.add(exhaust);
    } else if (modelType === 'standing_fan') {
      // Lontor standing fan
      const base = new THREE.Mesh(
        new THREE.CylinderGeometry(0.35, 0.4, 0.08, 16),
        new THREE.MeshStandardMaterial({ color: 0x0284c7 })
      );
      base.position.y = 0.04;
      group.add(base);

      const pole = new THREE.Mesh(
        new THREE.CylinderGeometry(0.04, 0.04, 1.4, 8),
        new THREE.MeshStandardMaterial({ color: 0x0f172a })
      );
      pole.position.y = 0.74;
      group.add(pole);

      const cage = new THREE.Mesh(
        new THREE.CylinderGeometry(0.42, 0.42, 0.08, 16),
        new THREE.MeshStandardMaterial({ color: 0x38bdf8, wireframe: true })
      );
      cage.rotation.x = Math.PI / 2;
      cage.position.set(0, 1.45, 0.05);
      group.add(cage);
    } else if (modelType === 'rug_circle') {
      // Circular Orange & White rug matching Image 5
      const outerRing = new THREE.Mesh(
        new THREE.RingGeometry(1.4, 2.5, 32),
        new THREE.MeshStandardMaterial({ color: 0xf97316, roughness: 0.9, side: THREE.DoubleSide })
      );
      outerRing.rotation.x = -Math.PI / 2;
      outerRing.position.y = 0.02;
      group.add(outerRing);

      const innerDisc = new THREE.Mesh(
        new THREE.CircleGeometry(1.4, 32),
        new THREE.MeshStandardMaterial({ color: 0xfef3c7, roughness: 0.9 })
      );
      innerDisc.rotation.x = -Math.PI / 2;
      innerDisc.position.y = 0.022;
      group.add(innerDisc);
    } else if (modelType === 'drum_bucket') {
      // Blue drum & red bucket
      const drum = new THREE.Mesh(
        new THREE.CylinderGeometry(0.65, 0.65, 1.5, 16),
        new THREE.MeshStandardMaterial({ color: 0x0284c7, roughness: 0.5 })
      );
      drum.position.y = 0.75;
      group.add(drum);

      const bucket = new THREE.Mesh(
        new THREE.CylinderGeometry(0.35, 0.28, 0.6, 16),
        new THREE.MeshStandardMaterial({ color: 0xef4444, roughness: 0.4 })
      );
      bucket.position.set(0.85, 0.3, 0);
      group.add(bucket);
    } else if (modelType === 'freezer') {
      // White Haier Thermocool chest freezer
      const freezer = new THREE.Mesh(
        new THREE.BoxGeometry(1.6, 1.1, 0.9),
        new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.3 })
      );
      freezer.position.y = 0.55;
      group.add(freezer);
    } else if (modelType === 'cooker') {
      // Gas cooker & red cylinder
      const stove = new THREE.Mesh(
        new THREE.BoxGeometry(1.1, 1.1, 0.9),
        new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.4 })
      );
      stove.position.y = 0.55;
      group.add(stove);

      const cyl = new THREE.Mesh(
        new THREE.CylinderGeometry(0.24, 0.24, 0.8, 14),
        new THREE.MeshStandardMaterial({ color: 0xdc2626, roughness: 0.5 })
      );
      cyl.position.set(0.9, 0.4, 0);
      group.add(cyl);
    } else if (modelType === 'potted_plant') {
      // Potted palm
      const pot = new THREE.Mesh(
        new THREE.CylinderGeometry(0.32, 0.22, 0.6, 14),
        new THREE.MeshStandardMaterial({ color: 0xfef08a })
      );
      pot.position.y = 0.3;
      group.add(pot);

      for (let i = 0; i < 5; i++) {
        const leaf = new THREE.Mesh(
          new THREE.ConeGeometry(0.12, 1.1, 5),
          new THREE.MeshStandardMaterial({ color: 0x16a34a, roughness: 0.6 })
        );
        leaf.rotation.z = 0.35 * (i % 2 === 0 ? 1 : -1);
        leaf.rotation.y = (i * Math.PI) / 2.5;
        leaf.position.set(0, 0.9, 0);
        group.add(leaf);
      }
    } else {
      // Generic luxury prop
      const prop = new THREE.Mesh(
        new THREE.BoxGeometry(1.2, 0.9, 0.8),
        new THREE.MeshStandardMaterial({ color: 0x059669 })
      );
      prop.position.y = 0.45;
      group.add(prop);
    }

    return group;
  }

  private save(): void {
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(this.placed.map((item) => ({
        uid: item.uid, id: item.id, modelType: item.modelType, position: { x: item.x, y: 0, z: item.z }, turns: item.turns,
      }))));
    } catch {
      // Storage full or shut off: the furniture stays until the page is closed
    }
    this.backend.notifyDeedChanged();
  }

  private loadSavedFurniture(): void {
    try {
      const saved = JSON.parse(localStorage.getItem(this.storageKey) || '[]');
      saved.forEach((entry: any, index: number) => {
        if (!entry || !entry.modelType) return;
        const item: PlacedItem = {
          // Pieces bought before furniture could be moved have no name of their own or way round
          uid: entry.uid ?? `${entry.id}_old${index}`,
          id: entry.id,
          modelType: entry.modelType,
          x: entry.position?.x ?? 0,
          z: entry.position?.z ?? 4,
          turns: entry.turns ?? 0,
          mesh: this.createFurniture3DMesh(entry.modelType),
        };
        this.dress(item.mesh, item.x, item.z, item.turns, item.modelType);
        this.placed.push(item);
        this.placedItemsGroup.add(item.mesh);
      });
    } catch {
      // Ignore errors
    }
  }
}
