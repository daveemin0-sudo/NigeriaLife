export interface Item {
  id: string;
  name: string;
  category: 'food' | 'tool' | 'document' | 'key' | 'gadget' | 'medicine' | 'luxury' | 'electronics';
  icon: string;
  description: string;
  price: number;
  quantity: number;
  usable: boolean;
  energyRestore?: number;
}

export interface PlayerStats {
  health: number;       // 0 to 100
  energy: number;       // 0 to 100
  hunger: number;       // 0 to 100
  streetCred: number;   // 0 to 100 (Reputation)
}

export interface BankAccount {
  accountNumber: string;
  bankName: string;
  balance: number;
  transactions: {
    id: string;
    type: 'credit' | 'debit';
    amount: number;
    description: string;
    timestamp: string;
  }[];
}

export interface BusinessUpgrade {
  id: string;
  name: string;
  cost: number;
  bonusIncomePerCycle: number;
  purchased: boolean;
  description: string;
}

export type PropertyType =
  | 'room'
  | 'self-contained'
  | 'apartment'
  | 'duplex'
  | 'luxury apartment'
  | 'house'
  | 'shop'
  | 'office'
  | 'warehouse'
  | 'land';

export type PropertyStatus = 'available' | 'rented' | 'owned' | 'unavailable' | 'unowned' | 'purchased';

export interface RealEstateProperty {
  id: string;
  cityId: string;
  districtId: string;
  type: PropertyType;
  name: string;
  position: { x: number; y: number; z: number };
  streetPosition: { x: number; y: number; z: number };
  purchasePrice: number;
  rentalPriceMonthly: number;
  status: PropertyStatus;
  ownerId: string;
  level: number;
  bedrooms: number;
  businessCompatible: boolean;
  description: string;
  features: string[];
  icon: string;
  safeBalance: number;
  buildingId?: string;
  location?: string;
  perks?: string[];
}

export type BusinessType =
  | 'restaurant'
  | 'supermarket'
  | 'pharmacy'
  | 'fashion shop'
  | 'phone shop'
  | 'mechanic'
  | 'salon'
  | 'barbershop'
  | 'hotel'
  | 'logistics'
  | 'filling station'
  | 'tech company'
  | 'transport business';

export interface BusinessEnterprise {
  id: string;
  name: string;
  cityId?: string;
  districtId?: string;
  propertyId?: string;
  type?: BusinessType;
  ownerId?: string;
  category: string;
  icon: string;
  purchasePrice: number;
  baseIncomePerCycle: number;
  income?: number;
  operatingCost?: number;
  owned: boolean;
  pendingRevenue: number;
  level: number;
  status?: 'open' | 'closed';
  position?: { x: number; y: number; z: number };
  streetPosition?: { x: number; y: number; z: number };
  revenueEst?: string;
  upgrades: BusinessUpgrade[];
  buildingId?: string;
}

export type TransactionType =
  // Money in
  | 'JOB_SALARY'
  | 'BUSINESS_INCOME'
  | 'QUEST_REWARD'
  | 'TRANSFER_IN'
  | 'WINNINGS'
  | 'BONUS'
  | 'LOAN_DISBURSEMENT'
  | 'INVESTMENT_SALE'
  | 'PROPERTY_SALE'
  | 'ITEM_SALE'
  // Money out
  | 'INVESTMENT_PURCHASE'
  | 'PROPERTY_PURCHASE'
  | 'RENT_PAYMENT'
  | 'BUSINESS_PURCHASE'
  | 'SHOP_PURCHASE'
  | 'FOOD_PURCHASE'
  | 'MEDICAL_BILL'
  | 'TRAVEL_COST'
  // Land, vehicles and buildings: bought, sold and built
  | 'ASSET_PURCHASE'
  | 'ASSET_SALE'
  | 'CONSTRUCTION_COST'
  | 'CONSTRUCTION_REFUND'
  | 'TRANSFER_OUT'
  | 'LOAN_REPAYMENT'
  // Moves between the player's own bank account and wallet
  | 'ATM_WITHDRAWAL'
  | 'ATM_DEPOSIT';

export interface TransactionRecord {
  id: string;
  playerId: string;
  type: TransactionType;
  amount: number;
  timestamp: string;
  description: string;
  source: 'wallet' | 'bank';
}

export interface JobListing {
  id: string;
  title: string;
  salary: number;
  workplace: string;
  districtId: string;
  businessId?: string;
  shiftDuration: number;
  requiredLevel: number;
  icon: string;
  description: string;
}

export interface ActiveJobShift {
  jobId: string;
  startTime: number;
  duration: number;
  completed: boolean;
}

export interface CareerProfile {
  title: string;
  rankLevel: number;
  xp: number;
  completedGigs: number;
  bonusMultiplier: number;
}

export type OriginDestiny = 'nepo' | 'lapo' | 'tech_bro';

/** Bump when the saved shape changes, and add a step to migrateAccount() in SaveSchema.ts */
export const SAVE_SCHEMA_VERSION = 2;

export type SavedCityId = 'lagos' | 'abuja' | 'port_harcourt';

/** Where the player was standing, so a reload puts them back there */
export interface SavedWorldState {
  cityId: SavedCityId;
  x: number;
  z: number;
  rotationY: number;
  hour: number; // Time of day, 0 to 24
  day: number; // Whole days played since the start date
  inTransit?: boolean; // Saved mid-journey: the trip is paid for, so a reload completes the arrival
}

export interface PhoneMessage {
  from: 'me' | 'them';
  text: string;
  /** When it was sent, as the game's clock read then */
  at: string;
}

export interface PhoneThread {
  messages: PhoneMessage[];
  unread: number;
}

export interface PlayerAccount {
  schemaVersion: number;
  id: string;
  username: string;
  phoneNumber: string;
  originDestiny?: OriginDestiny;
  destinyTitle?: string;
  walletCash: number;   // Physical cash in pocket (Naira ₦)
  bank: BankAccount;
  stats: PlayerStats;
  inventory: Item[];
  businesses: BusinessEnterprise[];
  properties: RealEstateProperty[];
  career: CareerProfile;
  transactionHistory: TransactionRecord[];
  activeJobShift?: ActiveJobShift | null;
  activeHousingId?: string;
  activeLoan?: {
    lender: string;
    amount: number; // Outstanding balance still owed
    weeklyRepayment: number;
  };
  /** Timed payouts already collected: claim key -> when it was last collected (ms since epoch) */
  claims: Record<string, number>;
  /** How well each person knows the player, 0 (stranger) to 100, by the person's id */
  relationships: Record<string, number>;
  /** Shares held, by ticker: how many units and what was paid for them in all */
  investments: Record<string, { units: number; spent: number }>;
  /** Text conversations with people the player has met, by the person's id, oldest first */
  threads: Record<string, PhoneThread>;
  /** When business revenue was last accrued (ms since epoch) */
  lastRevenueAt?: number;
  worldState?: SavedWorldState;
  createdAt: string;
}

export const DEFAULT_BUSINESSES: BusinessEnterprise[] = [
  {
    id: 'biz_mama_put',
    name: 'Mama Put Special Bukateria',
    category: 'Restaurant & Catering',
    buildingId: 'mama-put',
    icon: '🍲',
    purchasePrice: 180000,
    baseIncomePerCycle: 12000,
    owned: false,
    pendingRevenue: 0,
    level: 1,
    upgrades: [
      {
        id: 'upg_cook',
        name: 'Hire Experienced Buka Cook',
        cost: 40000,
        bonusIncomePerCycle: 5500,
        purchased: false,
        description: 'Increases cooking speed and reduces customer waiting time.',
      },
      {
        id: 'upg_canopy',
        name: 'VIP Outdoor Canopies & Seating',
        cost: 65000,
        bonusIncomePerCycle: 9000,
        purchased: false,
        description: 'Attracts affluent bankers and civil servants for lunch.',
      },
      {
        id: 'upg_delivery',
        name: 'Bike Delivery for Broad St Offices',
        cost: 110000,
        bonusIncomePerCycle: 16000,
        purchased: false,
        description: 'Delivers takeaway party Jollof to office workers.',
      },
    ],
  },
  {
    id: 'biz_pos_kiosk',
    name: 'KudiPoint & NaijaPay POS Terminal Agency',
    category: 'Fintech & Agency Banking',
    buildingId: 'bet-shop',
    icon: '💳',
    purchasePrice: 75000,
    baseIncomePerCycle: 6500,
    owned: false,
    pendingRevenue: 0,
    level: 1,
    upgrades: [
      {
        id: 'upg_solar',
        name: 'Mini Solar Inverter & Battery',
        cost: 25000,
        bonusIncomePerCycle: 3500,
        purchased: false,
        description: 'Zero blackout downtime during NEPA power failure.',
      },
      {
        id: 'upg_float',
        name: '₦500,000 Cash Float Expansion',
        cost: 50000,
        bonusIncomePerCycle: 7000,
        purchased: false,
        description: 'Never run out of physical cash during rush hour.',
      },
    ],
  },
  {
    id: 'biz_bet_lounge',
    name: 'NaijaBet Mega Sports Viewing Lounge',
    category: 'Sports & Entertainment',
    buildingId: 'bet-shop',
    icon: '⚽',
    purchasePrice: 350000,
    baseIncomePerCycle: 26000,
    owned: false,
    pendingRevenue: 0,
    level: 1,
    upgrades: [
      {
        id: 'upg_screens',
        name: '4K Ultra-HD Wall Screens & DSTV',
        cost: 85000,
        bonusIncomePerCycle: 13000,
        purchased: false,
        description: 'Attracts packed crowds for Champions League & Premier League matches.',
      },
      {
        id: 'upg_gen',
        name: 'Soundproof 15kVA Diesel Generator',
        cost: 140000,
        bonusIncomePerCycle: 22000,
        purchased: false,
        description: 'Guarantees uninterrupted match viewing and slip ticket printing.',
      },
    ],
  },
  {
    id: 'biz_danfo_fleet',
    name: 'Broad Street Danfo Transport Fleet',
    category: 'Logistics & Transit',
    buildingId: 'danfo-stop',
    icon: '🚌',
    purchasePrice: 550000,
    baseIncomePerCycle: 42000,
    owned: false,
    pendingRevenue: 0,
    level: 1,
    upgrades: [
      {
        id: 'upg_route',
        name: 'Express Lekki-Epe Expressway Permit',
        cost: 120000,
        bonusIncomePerCycle: 19000,
        purchased: false,
        description: 'Permits non-stop high fare express trips to Lekki Phase 1 and Ajah.',
      },
      {
        id: 'upg_bus2',
        name: 'Second Yellow Danfo Bus Acquisition',
        cost: 260000,
        bonusIncomePerCycle: 36000,
        purchased: false,
        description: 'Doubles passenger transport capacity across Lagos Island.',
      },
    ],
  },
  {
    id: 'biz_oando',
    name: 'NaijaPetro Fuel Forecourt & Station Mart',
    category: 'Energy & Retail',
    buildingId: 'fuel-station',
    icon: '⛽',
    purchasePrice: 1800000,
    baseIncomePerCycle: 125000,
    owned: false,
    pendingRevenue: 0,
    level: 1,
    upgrades: [
      {
        id: 'upg_pumps',
        name: 'Automated Digital Fuel Dispensers',
        cost: 320000,
        bonusIncomePerCycle: 45000,
        purchased: false,
        description: 'Faster pumping speed and zero spillage loss during morning rush.',
      },
      {
        id: 'upg_mart',
        name: '24/7 Cold Beverage & Snack Mart',
        cost: 240000,
        bonusIncomePerCycle: 38000,
        purchased: false,
        description: 'High margin snack and energy drink sales to motorists.',
      },
    ],
  },
  {
    id: 'biz_pharmacy',
    name: 'Yaba Central Community Pharmacy',
    category: 'Healthcare & Wellness',
    buildingId: 'pharmacy',
    icon: '💊',
    purchasePrice: 420000,
    baseIncomePerCycle: 34000,
    owned: false,
    pendingRevenue: 0,
    level: 1,
    upgrades: [
      {
        id: 'upg_coldchain',
        name: 'Solar Vaccine & Insulin Cold Storage',
        cost: 110000,
        bonusIncomePerCycle: 18000,
        purchased: false,
        description: 'Preserves critical medications during NEPA power blackouts.',
      },
    ],
  },
  {
    id: 'biz_slot',
    name: 'Slot Gadgets & Device Repair Clinic',
    category: 'Electronics & Tech',
    buildingId: 'slot-gadgets',
    icon: '📱',
    purchasePrice: 650000,
    baseIncomePerCycle: 52000,
    owned: false,
    pendingRevenue: 0,
    level: 1,
    upgrades: [
      {
        id: 'upg_accessories',
        name: 'Direct Hong Kong Accessory Import Line',
        cost: 180000,
        bonusIncomePerCycle: 28000,
        purchased: false,
        description: 'Guarantees bulk wholesale profit on fast chargers and power banks.',
      },
    ],
  },
  {
    id: 'biz_barber',
    name: 'Fresh Cut Executive Barbershop',
    category: 'Grooming & Lifestyle',
    buildingId: 'barber-shop',
    icon: '💈',
    purchasePrice: 220000,
    baseIncomePerCycle: 19000,
    owned: false,
    pendingRevenue: 0,
    level: 1,
    upgrades: [
      {
        id: 'upg_clipper',
        name: 'Wireless Cordless High-Torque Clippers',
        cost: 45000,
        bonusIncomePerCycle: 7500,
        purchased: false,
        description: 'Cuts hair faster with ultra precision.',
      },
    ],
  },
  {
    id: 'biz_mechanic',
    name: "God's Grace Auto Repair & Overhaul",
    category: 'Automotive Repairs',
    buildingId: 'mechanic',
    icon: '🔧',
    purchasePrice: 480000,
    baseIncomePerCycle: 38000,
    owned: false,
    pendingRevenue: 0,
    level: 1,
    upgrades: [
      {
        id: 'upg_scanner',
        name: 'OBD-II Wireless Diagnostic Computer',
        cost: 95000,
        bonusIncomePerCycle: 16000,
        purchased: false,
        description: 'Instantly diagnoses check-engine fault codes for German/Japanese cars.',
      },
    ],
  },
];

export const DEFAULT_PROPERTIES: RealEstateProperty[] = [
  // 1. Mainland
  {
    id: 'prop_mainland_room',
    cityId: 'lagos',
    districtId: 'mainland',
    type: 'room',
    name: 'Maryland Self-Contained Boys Quarters',
    position: { x: -35, y: 0.5, z: -45 },
    streetPosition: { x: -24, y: 0, z: -45 },
    purchasePrice: 1800000,
    rentalPriceMonthly: 25000,
    status: 'available',
    ownerId: 'npc_landlord_maryland',
    level: 1,
    bedrooms: 1,
    businessCompatible: false,
    description: 'Cozy self-contained room in Maryland with separate prepaid meter and private bathroom.',
    features: ['Prepaid NEPA Meter', 'Private Water Tap', 'Gated Compound'],
    icon: '🏠',
    safeBalance: 0,
    location: 'Maryland, Lagos Mainland',
  },
  {
    id: 'prop_mainland_apt',
    cityId: 'lagos',
    districtId: 'mainland',
    type: 'apartment',
    name: 'Anthony Village 3-Bedroom Family Flat',
    position: { x: -45, y: 0.5, z: -55 },
    streetPosition: { x: -28, y: 0, z: -50 },
    purchasePrice: 18500000,
    rentalPriceMonthly: 120000,
    status: 'available',
    ownerId: 'npc_landlord_anthony',
    level: 1,
    bedrooms: 3,
    businessCompatible: false,
    description: 'Spacious 3-bedroom flat in a quiet residential avenue with dedicated parking and security.',
    features: ['Dedicated Car Park', 'Overhead Water Tank', 'Night Security Guard'],
    icon: '🏢',
    safeBalance: 0,
    location: 'Anthony Village, Lagos Mainland',
  },
  {
    id: 'prop_mainland_shop',
    cityId: 'lagos',
    districtId: 'mainland',
    type: 'shop',
    name: 'Ikorodu Road Corner Trade Shop',
    position: { x: -20, y: 0.5, z: -40 },
    streetPosition: { x: -20, y: 0, z: -42 },
    purchasePrice: 4500000,
    rentalPriceMonthly: 45000,
    status: 'available',
    ownerId: 'npc_landlord_ikorodu',
    level: 1,
    bedrooms: 0,
    businessCompatible: true,
    description: 'High-footfall commercial lock-up shop fronting the bustling Ikorodu Road arterial.',
    features: ['Roller Iron Shutter', 'Constant Foot Traffic', 'Signboard Space'],
    icon: '🏪',
    safeBalance: 0,
    location: 'Ikorodu Road, Mainland',
  },

  // 2. Yaba
  {
    id: 'prop_yaba_student',
    cityId: 'lagos',
    districtId: 'yaba',
    type: 'self-contained',
    name: 'Unilag Student Studio Apartment',
    position: { x: -10, y: 0.5, z: -25 },
    streetPosition: { x: -10, y: 0, z: -25 },
    purchasePrice: 3500000,
    rentalPriceMonthly: 40000,
    status: 'available',
    ownerId: 'npc_yaba_hostel',
    level: 1,
    bedrooms: 1,
    businessCompatible: false,
    description: 'Walking distance to University of Lagos & Yabatech. Perfect student base with reading alcove.',
    features: ['Study Table & Chair', 'Borehole Water', 'Close to Campus'],
    icon: '🏠',
    safeBalance: 0,
    location: 'Akoka / Yaba, Lagos',
  },
  {
    id: 'prop_yaba_tech_office',
    cityId: 'lagos',
    districtId: 'yaba',
    type: 'office',
    name: 'CcHub Cluster Co-Working Office',
    position: { x: -18, y: 0.5, z: -20 },
    streetPosition: { x: -15, y: 0, z: -20 },
    purchasePrice: 28000000,
    rentalPriceMonthly: 180000,
    status: 'available',
    ownerId: 'npc_cchub_ventures',
    level: 2,
    bedrooms: 0,
    businessCompatible: true,
    description: 'Glass-partitioned tech workspace on Herbert Macaulay Way with high-speed fiber internet.',
    features: ['Starlink Fibre Link', 'Rooftop Solar Inverter', 'Meeting Room Access'],
    icon: '🏢',
    safeBalance: 0,
    location: 'Herbert Macaulay Way, Yaba',
  },

  // 3. Ikeja
  {
    id: 'prop_ikeja_apt',
    cityId: 'lagos',
    districtId: 'ikeja',
    type: 'apartment',
    name: 'Allen Avenue Executive 2-Bed Residence',
    position: { x: -15, y: 0.5, z: -110 },
    streetPosition: { x: 0, y: 0, z: -95 },
    purchasePrice: 35000000,
    rentalPriceMonthly: 220000,
    status: 'available',
    ownerId: 'npc_ikeja_holdings',
    level: 2,
    bedrooms: 2,
    businessCompatible: false,
    description: 'Prime Allen Avenue apartment. Easy access to Ikeja City Mall and Government Secretariat.',
    features: ['Standby Generator', 'Swimming Pool', 'CCTV Surveillance'],
    icon: '🏢',
    safeBalance: 0,
    location: 'Allen Avenue, Ikeja',
  },
  {
    id: 'prop_ikeja_tech_hub',
    cityId: 'lagos',
    districtId: 'ikeja',
    type: 'office',
    name: 'Computer Village Otigba Tech Office',
    position: { x: 5, y: 0.5, z: -100 },
    streetPosition: { x: 12, y: 0, z: -95 },
    purchasePrice: 45000000,
    rentalPriceMonthly: 300000,
    status: 'available',
    ownerId: 'npc_otigba_trust',
    level: 2,
    bedrooms: 0,
    businessCompatible: true,
    description: 'High-earning commercial office right in the buzzing heart of Computer Village electronics market.',
    features: ['Direct Market Access', 'High-Security Iron Doors', 'Bulk Wholesale Storage'],
    icon: '🏢',
    safeBalance: 0,
    location: 'Otigba Street, Computer Village, Ikeja',
  },

  // 4. Surulere
  {
    id: 'prop_surulere_terrace',
    cityId: 'lagos',
    districtId: 'surulere',
    type: 'house',
    name: 'Bode Thomas 3-Bedroom Terrace House',
    position: { x: -55, y: 0.5, z: 10 },
    streetPosition: { x: -55, y: 0, z: 15 },
    purchasePrice: 48000000,
    rentalPriceMonthly: 280000,
    status: 'available',
    ownerId: 'npc_surulere_heritage',
    level: 2,
    bedrooms: 3,
    businessCompatible: false,
    description: 'Charming colonial-style family terrace house near National Stadium and Adeniran Ogunsanya Mall.',
    features: ['Private Front Courtyard', 'Borehole Water Purification', 'Interlocked Compound'],
    icon: '🏡',
    safeBalance: 0,
    location: 'Bode Thomas, Surulere',
  },

  // 5. Victoria Island
  {
    id: 'prop_vi_luxury_apt',
    cityId: 'lagos',
    districtId: 'victoria_island',
    type: 'luxury apartment',
    name: 'Victoria Island Waterfront Luxury Flat',
    position: { x: 10, y: 0.5, z: 85 },
    streetPosition: { x: 0, y: 0, z: 85 },
    purchasePrice: 95000000,
    rentalPriceMonthly: 650000,
    status: 'available',
    ownerId: 'npc_eko_living',
    level: 3,
    bedrooms: 2,
    businessCompatible: false,
    description: 'High-end designer flat facing Five Cowries Creek. Seconds away from Quilox and Eko Hotel.',
    features: ['Creek Waterfront View', 'Underground Valet Parking', '24/7 Central Chiller AC'],
    icon: '🏢',
    safeBalance: 0,
    location: 'Victoria Island Waterfront, Lagos',
  },
  {
    id: 'prop_vi_office_suite',
    cityId: 'lagos',
    districtId: 'victoria_island',
    type: 'office',
    name: 'Adeola Odeku Corporate Tower Suite',
    position: { x: 25, y: 0.5, z: 95 },
    streetPosition: { x: 14, y: 0, z: 95 },
    purchasePrice: 120000000,
    rentalPriceMonthly: 850000,
    status: 'available',
    ownerId: 'npc_vi_towers',
    level: 3,
    bedrooms: 0,
    businessCompatible: true,
    description: 'Executive corporate office overlooking Adeola Odeku. Houses multinational fintechs and oil firms.',
    features: ['High-Speed Elevators', 'Executive Boardroom', 'Concierge Reception'],
    icon: '🏢',
    safeBalance: 0,
    location: 'Adeola Odeku, Victoria Island',
  },

  // 6. Lekki Phase 1
  {
    id: 'prop_lekki_duplex',
    cityId: 'lagos',
    districtId: 'lekki',
    type: 'duplex',
    name: 'Lekki Phase 1 Gated 4-Bed Duplex',
    position: { x: 65, y: 0.5, z: 25 },
    streetPosition: { x: 55, y: 0, z: 0 },
    purchasePrice: 165000000,
    rentalPriceMonthly: 1200000,
    status: 'available',
    ownerId: 'npc_lekki_properties',
    level: 3,
    bedrooms: 4,
    businessCompatible: false,
    description: 'Luxurious 4-bedroom detached duplex in a private security estate off Admiralty Way with swimming pool.',
    features: ['Private Swimming Pool', 'Armed MOPOL Guard Gate', 'Boys Quarters Attached', 'Full Solar Array'],
    icon: '🏡',
    safeBalance: 0,
    location: 'Admiralty Way, Lekki Phase 1',
  },
  {
    id: 'prop_lekki_boutique',
    cityId: 'lagos',
    districtId: 'lekki',
    type: 'shop',
    name: 'Admiralty Way Designer Boutique Shop',
    position: { x: 75, y: 0.5, z: 15 },
    streetPosition: { x: 65, y: 0, z: 0 },
    purchasePrice: 32000000,
    rentalPriceMonthly: 250000,
    status: 'available',
    ownerId: 'npc_lekki_retail',
    level: 2,
    bedrooms: 0,
    businessCompatible: true,
    description: 'Sleek glass boutique storefront near Nike Art Gallery with affluent pedestrian traffic.',
    features: ['Floor-to-Ceiling Display Glass', 'Designer Track Lighting', 'High Affluence Shoppers'],
    icon: '🏪',
    safeBalance: 0,
    location: 'Admiralty Way, Lekki',
  },

  // 7. Ajah
  {
    id: 'prop_ajah_duplex',
    cityId: 'lagos',
    districtId: 'ajah',
    type: 'duplex',
    name: 'Crown Estate Developing 4-Bed Duplex',
    position: { x: 125, y: 0.5, z: 60 },
    streetPosition: { x: 90, y: 0, z: 25 },
    purchasePrice: 42000000,
    rentalPriceMonthly: 280000,
    status: 'available',
    ownerId: 'npc_ajah_developers',
    level: 1,
    bedrooms: 4,
    businessCompatible: false,
    description: 'Modern 4-bedroom duplex currently completing roof framing. High appreciation upside!',
    features: ['Rapid Equity Appreciation', 'Spacious 600sqm Plot', 'Perimeter Wall Erected'],
    icon: '🏡',
    safeBalance: 0,
    location: 'Crown Estate, Ajah Peninsula',
  },
  {
    id: 'prop_ajah_land',
    cityId: 'lagos',
    districtId: 'ajah',
    type: 'land',
    name: 'Lekki-Epe Expressway Dry Title Land Plot',
    position: { x: 140, y: 0.5, z: 75 },
    streetPosition: { x: 95, y: 0, z: 25 },
    purchasePrice: 1800000,
    rentalPriceMonthly: 0,
    status: 'available',
    ownerId: 'npc_ajah_landowners',
    level: 1,
    bedrooms: 0,
    businessCompatible: true,
    description: '100% dry virgin land with Governor’s Consent title. Ready for residential or warehouse development.',
    features: ['Governor’s Consent Deed', '100% Dry Sand Soil', 'Direct Expressway Access'],
    icon: '🌳',
    safeBalance: 0,
    location: 'Lekki-Epe Expressway, Ajah',
  },

  // 8. Eko Atlantic
  {
    id: 'prop_eko_penthouse',
    cityId: 'lagos',
    districtId: 'eko_atlantic',
    type: 'luxury apartment',
    name: 'Eko Atlantic Marina Skyline Penthouse',
    position: { x: -25, y: 0.5, z: 125 },
    streetPosition: { x: -25, y: 0, z: 95 },
    purchasePrice: 380000000,
    rentalPriceMonthly: 2500000,
    status: 'available',
    ownerId: 'npc_eko_atlantic_residences',
    level: 4,
    bedrooms: 3,
    businessCompatible: false,
    description: 'The pinnacle of West African luxury. Unobstructed panoramic views over the Atlantic Ocean.',
    features: ['Atlantic Ocean Panoramic Horizon', 'Private Helipad Access', 'Smart Touch Automation', 'Zero Power Cuts'],
    icon: '🏢',
    safeBalance: 0,
    location: 'Eko Atlantic City, Marina Boulevard',
  },
  {
    id: 'prop_eko_corp_hq',
    cityId: 'lagos',
    districtId: 'eko_atlantic',
    type: 'office',
    name: 'Financial Centre Executive Suite',
    position: { x: -15, y: 0.5, z: 135 },
    streetPosition: { x: -25, y: 0, z: 95 },
    purchasePrice: 290000000,
    rentalPriceMonthly: 1900000,
    status: 'available',
    ownerId: 'npc_eko_financial_centre',
    level: 4,
    bedrooms: 0,
    businessCompatible: true,
    description: 'Ultra-prestigious corporate headquarters suite inside the Eko Atlantic International Financial Centre.',
    features: ['Direct Fibre Internet Backbone', 'Dedicated Private Banking Wing', 'Diplomatic Grade Security'],
    icon: '🏢',
    safeBalance: 0,
    location: 'Financial Boulevard, Eko Atlantic',
  },

  // 9. Lagos Island
  {
    id: 'prop_villa_estate',
    cityId: 'lagos',
    districtId: 'lagos_island',
    type: 'duplex',
    name: 'Victoria Residence Estate Duplex',
    position: { x: 0, y: 0.5, z: 20 },
    streetPosition: { x: 0, y: 0, z: 20 },
    purchasePrice: 1200000,
    rentalPriceMonthly: 120000,
    status: 'available',
    ownerId: 'npc_broad_st_estates',
    level: 2,
    bedrooms: 3,
    businessCompatible: false,
    description: 'Gated executive duplex with electronic courtyard gates, standby generator, and private cash vault.',
    features: ['Unlimited Free Energy & Hunger Rest', 'Electronic Gate Keycard', '+50 Street Cred & Respect', 'Cash Vault Safe'],
    icon: '🏡',
    safeBalance: 0,
    location: 'Broad Street Extension, Lagos Island',
    buildingId: 'villa-compound',
    perks: ['Unlimited 100% Free Energy & Hunger Rest', 'Electronic Compound Gate Key', '+50 Street Cred'],
  },
  {
    id: 'prop_palm_view',
    cityId: 'lagos',
    districtId: 'lagos_island',
    type: 'apartment',
    name: 'Palm View 2-Bedroom Residential Flat',
    position: { x: -15, y: 0.5, z: 10 },
    streetPosition: { x: -15, y: 0, z: 10 },
    purchasePrice: 850000,
    rentalPriceMonthly: 65000,
    status: 'available',
    ownerId: 'npc_palm_view_realty',
    level: 1,
    bedrooms: 2,
    businessCompatible: false,
    description: 'Top-floor apartment balcony overlooking Broad Street with dedicated 2,500L GeePee water storage.',
    features: ['Top-Floor Balcony View', '2,500L GeePee Water Tank', '+25 Street Cred'],
    icon: '🏢',
    safeBalance: 0,
    location: 'Tejuosho Block, Lagos Island',
    buildingId: 'palm-view-flats',
  },

  // 10. Banana Island (Ikoyi Billionaire Haven)
  {
    id: 'prop_banana_island_villa',
    cityId: 'lagos',
    districtId: 'ikoyi',
    type: 'luxury apartment',
    name: 'Banana Island Waterfront Horizon Villa',
    position: { x: 35, y: 0.5, z: 45 },
    streetPosition: { x: 35, y: 0, z: 40 },
    purchasePrice: 450000000,
    rentalPriceMonthly: 4500000,
    status: 'available',
    ownerId: 'npc_banana_island_trust',
    level: 5,
    bedrooms: 6,
    businessCompatible: false,
    description: 'The pinnacle of West African billionaire luxury. Features private yacht jetty berth, bulletproof glass, and 24/7 dedicated private estate microgrid power.',
    features: ['Private Yacht Jetty Berth', '24/7 Microgrid Power', 'Bulletproof Floor-to-Ceiling Glass', 'Smart Home AI Automation'],
    icon: '🏰',
    safeBalance: 0,
    location: 'Zone E Waterfront, Banana Island, Ikoyi',
    perks: ['Billionaire Odogwu Status', '100% Free Health & Energy Recovery', '+100 Street Cred'],
  },

  // 11. Abuja FCT (Federal Capital Territory)
  {
    id: 'prop_gwarinpa_duplex',
    cityId: 'abuja',
    districtId: 'gwarinpa',
    type: 'duplex',
    name: 'Gwarinpa 4-Bedroom Detached Duplex',
    position: { x: -85, y: 0.5, z: -35 },
    streetPosition: { x: -85, y: 0, z: -35 },
    purchasePrice: 45000000,
    rentalPriceMonthly: 450000,
    status: 'available',
    ownerId: 'npc_abuja_housing',
    level: 2,
    bedrooms: 4,
    businessCompatible: true,
    description: 'Spacious modern family duplex in Gwarinpa Estate with paved interlocked compound, standby generator house, and pure borehole water.',
    features: ['4 En-Suite Bedrooms', 'Dedicated Generator House', 'Security Gatehouse', 'Deep Aquifer Borehole'],
    icon: '🏡',
    safeBalance: 0,
    location: '1st Avenue, Gwarinpa Estate, Abuja',
    perks: ['FCT Residency Permit', '100% Energy Sleep', '+35 Street Cred'],
  },
  {
    id: 'prop_maitama_penthouse',
    cityId: 'abuja',
    districtId: 'maitama',
    type: 'luxury apartment',
    name: 'Maitama Diplomatic Luxury Penthouse',
    position: { x: 45, y: 0.5, z: -45 },
    streetPosition: { x: 45, y: 0, z: -45 },
    purchasePrice: 180000000,
    rentalPriceMonthly: 1200000,
    status: 'available',
    ownerId: 'npc_maitama_diplomatic',
    level: 4,
    bedrooms: 3,
    businessCompatible: false,
    description: 'Elite penthouse overlooking Millennium Park and Aso Rock with private rooftop infinity pool, dedicated elevator, and 24/7 solar backup.',
    features: ['Aso Rock Panoramic Vista', 'Rooftop Infinity Pool', 'Diplomatic Security Patrol', 'High-Speed Private Lift'],
    icon: '🏢',
    safeBalance: 0,
    location: 'Maitama Diplomatic Zone, Abuja',
    perks: ['Diplomatic Elite Status', '100% Energy Sleep', '+80 Street Cred'],
  },
  {
    id: 'prop_wuse_office',
    cityId: 'abuja',
    districtId: 'wuse',
    type: 'office',
    name: 'Aminu Kano Corporate Office Suite',
    position: { x: -45, y: 0.5, z: -45 },
    streetPosition: { x: -45, y: 0, z: -45 },
    purchasePrice: 65000000,
    rentalPriceMonthly: 600000,
    status: 'available',
    ownerId: 'npc_wuse_commercial',
    level: 3,
    bedrooms: 0,
    businessCompatible: true,
    description: 'Prime corporate suite on buzzing Aminu Kano Crescent in Wuse 2. Prestigious location for legal consultancies, tech startups, and government contractors.',
    features: ['Aminu Kano Frontage', 'Gigabit Fibre Backbone', 'Executive Conference Room'],
    icon: '🏢',
    safeBalance: 0,
    location: 'Aminu Kano Crescent, Wuse 2, Abuja',
    perks: ['Corporate Headquarters Presence', '+45 Street Cred'],
  },

  // 12. Port Harcourt (Garden City)
  {
    id: 'prop_gra_duplex',
    cityId: 'port_harcourt',
    districtId: 'old_gra',
    type: 'duplex',
    name: 'Old GRA 5-Bedroom Executive Mansion',
    position: { x: 0, y: 0.5, z: 45 },
    streetPosition: { x: 0, y: 0, z: 45 },
    purchasePrice: 95000000,
    rentalPriceMonthly: 850000,
    status: 'available',
    ownerId: 'npc_ph_estates',
    level: 3,
    bedrooms: 5,
    businessCompatible: true,
    description: 'Stately executive villa in quiet Old GRA with Olympic swimming pool, private guardhouse, and standby Perkins 100kVA soundproof generator.',
    features: ['5 En-Suite Bedrooms', 'Olympic Swimming Pool', 'Armed MOPOL Guardhouse', '24/7 Soundproof Perkins Power'],
    icon: '🏰',
    safeBalance: 0,
    location: 'Forces Avenue, Old GRA, Port Harcourt',
    perks: ['Garden City Landlord', '100% Energy Sleep', '+60 Street Cred'],
  },
  {
    id: 'prop_dline_apartment',
    cityId: 'port_harcourt',
    districtId: 'd_line',
    type: 'apartment',
    name: 'Aba Road Serviced 2-Bedroom Flat',
    position: { x: -25, y: 0.5, z: 0 },
    streetPosition: { x: -25, y: 0, z: 0 },
    purchasePrice: 32000000,
    rentalPriceMonthly: 320000,
    status: 'available',
    ownerId: 'npc_dline_realty',
    level: 2,
    bedrooms: 2,
    businessCompatible: false,
    description: 'Serviced apartment right in the heart of D-Line commercial activity. Walking distance to Genesis Centre, shopping plazas, and banking hubs.',
    features: ['Water Treatment Plant', 'Dedicated Paved Parking', 'Prepaid Smart Meter', 'Proximity to Trans-Amadi'],
    icon: '🏢',
    safeBalance: 0,
    location: 'Aba Road Corridor, D-Line, Port Harcourt',
    perks: ['Trans-Amadi Access', '100% Energy Sleep', '+30 Street Cred'],
  },
];

export const DEFAULT_JOBS: JobListing[] = [
  {
    id: 'job_shop_assistant',
    title: 'Trade Shop Assistant',
    salary: 4500,
    workplace: 'Balogun Wholesale Market',
    districtId: 'lagos_island',
    shiftDuration: 10,
    requiredLevel: 1,
    icon: '🏪',
    description: 'Assist customers with fabric bales, count cash change, and arrange storefront shelves.',
  },
  {
    id: 'job_mechanic',
    title: 'Auto Mechanic Apprentice',
    salary: 6000,
    workplace: "God's Grace Auto Repair",
    districtId: 'lagos_island',
    shiftDuration: 12,
    requiredLevel: 1,
    icon: '🔧',
    description: 'Change motor oil, bleed brakes, and help master mechanic overhaul Japanese engines.',
  },
  {
    id: 'job_danfo_driver',
    title: 'Danfo Commercial Driver',
    salary: 8000,
    workplace: 'Broad Street Danfo Terminus',
    districtId: 'lagos_island',
    shiftDuration: 15,
    requiredLevel: 1,
    icon: '🚌',
    description: 'Navigate Lagos traffic rush hour, honk at stubborn kekes, and collect passenger fares.',
  },
  {
    id: 'job_food_seller',
    title: 'Buka Kitchen Cook Assistant',
    salary: 5000,
    workplace: 'Mama Put Special Bukateria',
    districtId: 'lagos_island',
    shiftDuration: 10,
    requiredLevel: 1,
    icon: '🍲',
    description: 'Stir steaming hot Amala, dish spicy party Jollof rice, and serve lunchtime bankers.',
  },
  {
    id: 'job_office_worker',
    title: 'Corporate Office Clerk',
    salary: 12000,
    workplace: 'Eko Commercial Bank Tower',
    districtId: 'lagos_island',
    shiftDuration: 18,
    requiredLevel: 2,
    icon: '🏢',
    description: 'Sort bank trade vouchers, verify customer BVN documents, and prepare executive tea.',
  },
  {
    id: 'job_software_dev',
    title: 'Junior Software Engineer',
    salary: 25000,
    workplace: 'Co-Creation Hub (CcHub)',
    districtId: 'yaba',
    shiftDuration: 20,
    requiredLevel: 2,
    icon: '💻',
    description: 'Write TypeScript microservices, push clean pull requests, and debug fintech API payment hooks.',
  },
  {
    id: 'job_construction',
    title: 'Site Framing Artisan',
    salary: 8500,
    workplace: 'Crown Luxury Estate Site',
    districtId: 'ajah',
    shiftDuration: 14,
    requiredLevel: 1,
    icon: '👷',
    description: 'Mix Dangote cement mortar, stack 9-inch hollow blocks, and hoist roof timber rafters.',
  },
  {
    id: 'job_security',
    title: 'Estate Security Officer',
    salary: 6500,
    workplace: 'Victoria Residence Estate Gate',
    districtId: 'lagos_island',
    shiftDuration: 12,
    requiredLevel: 1,
    icon: '👮',
    description: 'Screen incoming vehicles, verify visitor passes, and maintain quiet residential peace.',
  },
];

export const DEFAULT_CAREER: CareerProfile = {
  title: 'Street Hustler',
  rankLevel: 1,
  xp: 0,
  completedGigs: 0,
  bonusMultiplier: 1.0,
};

export const INITIAL_PLAYER_DATA: PlayerAccount = {
  schemaVersion: SAVE_SCHEMA_VERSION,
  id: 'usr_eko_001',
  username: 'Bayo',
  phoneNumber: '08023456789',
  walletCash: 25000, // ₦25,000 cash in pocket
  bank: {
    accountNumber: '0234891102',
    bankName: 'Eko Commercial Bank',
    balance: 150000, // ₦150,000 in bank
    transactions: [
      {
        id: 'tx_01',
        type: 'credit',
        amount: 150000,
        description: 'Monthly Allowance / Freelance Pay',
        timestamp: 'Today, 08:30 AM',
      },
    ],
  },
  stats: {
    health: 100,
    energy: 100,
    hunger: 80,
    streetCred: 25,
  },
  inventory: [
    {
      id: 'phone_01',
      name: 'Naija Smart Phone',
      category: 'gadget',
      icon: '📱',
      description: 'Dual-SIM smartphone with NaijaPay, Chat, and Music.',
      price: 95000,
      quantity: 1,
      usable: true,
    },
    {
      id: 'atm_card',
      name: 'Verve / Mastercard Debit Card',
      category: 'tool',
      icon: '💳',
      description: 'Official Eko Commercial Bank ATM debit card with chip & PIN.',
      price: 1000,
      quantity: 1,
      usable: true,
    },
    {
      id: 'gala_snack',
      name: 'Beef Gala Sausage Roll',
      category: 'food',
      icon: '🌭',
      description: 'The legendary King of highway and street snacks.',
      price: 200,
      quantity: 2,
      usable: true,
      energyRestore: 25,
    },
  ],
  businesses: DEFAULT_BUSINESSES,
  properties: DEFAULT_PROPERTIES,
  career: DEFAULT_CAREER,
  transactionHistory: [
    {
      id: 'tx_init_01',
      playerId: 'usr_eko_001',
      type: 'JOB_SALARY',
      amount: 150000,
      timestamp: 'Today, 08:30 AM',
      description: 'Monthly Allowance / Freelance Pay',
      source: 'bank',
    },
  ],
  activeJobShift: null,
  claims: {},
  relationships: {},
  investments: {},
  threads: {},
  createdAt: new Date().toISOString(),
};
