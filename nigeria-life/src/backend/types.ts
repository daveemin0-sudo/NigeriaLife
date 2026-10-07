export interface Item {
  id: string;
  name: string;
  category: 'food' | 'tool' | 'document' | 'key' | 'gadget';
  icon: string;
  description: string;
  price: number;
  quantity: number;
  usable: boolean;
  energyRestore?: number;
}

export interface PlayerStats {
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

export interface BusinessEnterprise {
  id: string;
  name: string;
  category: string;
  buildingId: string;
  icon: string;
  purchasePrice: number;
  baseIncomePerCycle: number;
  owned: boolean;
  pendingRevenue: number;
  level: number;
  upgrades: BusinessUpgrade[];
}

export interface RealEstateProperty {
  id: string;
  name: string;
  type: 'residential' | 'commercial';
  location: string;
  buildingId: string;
  icon: string;
  purchasePrice: number;
  rentalPriceMonthly: number;
  status: 'unowned' | 'rented' | 'purchased';
  perks: string[];
  safeBalance: number;
}

export interface CareerProfile {
  title: string;
  rankLevel: number;
  xp: number;
  completedGigs: number;
  bonusMultiplier: number;
}

export type OriginDestiny = 'nepo' | 'lapo' | 'tech_bro';

export interface PlayerAccount {
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
  activeLoan?: {
    lender: string;
    amount: number;
    weeklyRepayment: number;
  };
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
    name: 'Moniepoint & OPay POS Terminal Agency',
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
    name: 'Bet9ja Sports Viewing Lounge',
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
    name: 'Oando Fuel Forecourt & Station Mart',
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
  {
    id: 'prop_villa_estate',
    name: 'Victoria Residence Estate Duplex',
    type: 'residential',
    location: 'Broad Street Extension, Lagos Island',
    buildingId: 'villa-compound',
    icon: '🏡',
    purchasePrice: 1200000,
    rentalPriceMonthly: 120000,
    status: 'unowned',
    perks: [
      'Unlimited 100% Free Energy & Hunger Rest in your bedroom',
      'Electronic Compound Gate Key for courtyard entry',
      '+50 Street Cred & Respect across Lagos Island',
      'Private Master Bedroom Cash Vault with 0% tax',
    ],
    safeBalance: 0,
  },
  {
    id: 'prop_palm_view',
    name: 'Palm View 2-Bedroom Residential Flat',
    type: 'residential',
    location: 'Tejuosho Block, Lagos Island',
    buildingId: 'palm-view-flats',
    icon: '🏢',
    purchasePrice: 850000,
    rentalPriceMonthly: 65000,
    status: 'unowned',
    perks: [
      'Quiet top-floor balcony overlooking Broad Street',
      'Dedicated GeePee 2,500L private water connection',
      '+25 Street Cred in the neighborhood',
    ],
    safeBalance: 0,
  },
  {
    id: 'prop_island_office',
    name: 'Broad Street Commercial Plaza Suite',
    type: 'commercial',
    location: 'Marina Financial Corridor, Lagos',
    buildingId: 'lagos-bank',
    icon: '🏢',
    purchasePrice: 650000,
    rentalPriceMonthly: 60000,
    status: 'unowned',
    perks: [
      '+30% Pay on all tech and freelance remote jobs',
      'Dedicated Starlink Satellite Internet connection',
      'Executive conference desk to host business partners',
    ],
    safeBalance: 0,
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
  id: 'usr_eko_001',
  username: 'Bayo',
  phoneNumber: '08023456789',
  walletCash: 25000, // ₦25,000 cash in pocket
  bank: {
    accountNumber: '0234891102',
    bankName: 'Eko Commercial Bank (GTCO)',
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
      description: 'Dual-SIM smartphone with OPay, WhatsApp, and Music.',
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
  createdAt: new Date().toISOString(),
};
