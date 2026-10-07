import {
  type PlayerAccount,
  type Item,
  type OriginDestiny,
  INITIAL_PLAYER_DATA,
  DEFAULT_BUSINESSES,
  DEFAULT_PROPERTIES,
  DEFAULT_CAREER,
} from './types';

type ListenerCallback = (data: PlayerAccount) => void;

export class BackendService {
  private static instance: BackendService;
  private readonly STORAGE_KEY = 'nigeria_life_account_data_v1';
  private data: PlayerAccount;
  private listeners: ListenerCallback[] = [];
  private passiveInterval: number | null = null;

  private constructor() {
    this.data = this.loadData();
    this.startPassiveIncomeTimer();
  }

  public static getInstance(): BackendService {
    if (!BackendService.instance) {
      BackendService.instance = new BackendService();
    }
    return BackendService.instance;
  }

  private loadData(): PlayerAccount {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        const inventory =
          Array.isArray(parsed.inventory) && parsed.inventory.length > 0
            ? parsed.inventory
            : INITIAL_PLAYER_DATA.inventory;

        // Merge businesses while preserving saved ownership/revenue
        const businesses = (parsed.businesses && Array.isArray(parsed.businesses))
          ? DEFAULT_BUSINESSES.map((def) => {
              const saved = parsed.businesses.find((b: any) => b.id === def.id);
              if (!saved) return def;
              return {
                ...def,
                ...saved,
                upgrades: def.upgrades.map((uDef) => {
                  const savedUpg = saved.upgrades?.find((u: any) => u.id === uDef.id);
                  return savedUpg ? { ...uDef, ...savedUpg } : uDef;
                }),
              };
            })
          : DEFAULT_BUSINESSES;

        // Merge properties while preserving saved status
        const properties = (parsed.properties && Array.isArray(parsed.properties))
          ? DEFAULT_PROPERTIES.map((def) => {
              const saved = parsed.properties.find((p: any) => p.id === def.id);
              return saved ? { ...def, ...saved } : def;
            })
          : DEFAULT_PROPERTIES;

        const career = parsed.career ? { ...DEFAULT_CAREER, ...parsed.career } : DEFAULT_CAREER;

        return {
          ...INITIAL_PLAYER_DATA,
          ...parsed,
          walletCash:
            typeof parsed.walletCash === 'number' ? parsed.walletCash : INITIAL_PLAYER_DATA.walletCash,
          bank: {
            ...INITIAL_PLAYER_DATA.bank,
            ...(parsed.bank || {}),
            transactions:
              Array.isArray(parsed.bank?.transactions) && parsed.bank.transactions.length > 0
                ? parsed.bank.transactions
                : INITIAL_PLAYER_DATA.bank.transactions,
          },
          stats: {
            ...INITIAL_PLAYER_DATA.stats,
            ...(parsed.stats || {}),
          },
          inventory,
          businesses,
          properties,
          career,
        };
      }
    } catch (e) {
      console.warn('Failed to load saved data, initializing defaults', e);
    }
    return { ...INITIAL_PLAYER_DATA };
  }

  private startPassiveIncomeTimer(): void {
    if (this.passiveInterval) return;
    // Every 45 seconds, generate revenue for owned businesses
    this.passiveInterval = window.setInterval(() => {
      let revenueGenerated = false;
      for (const biz of this.data.businesses) {
        if (biz.owned) {
          let cycleEarnings = biz.baseIncomePerCycle;
          for (const upg of biz.upgrades) {
            if (upg.purchased) {
              cycleEarnings += upg.bonusIncomePerCycle;
            }
          }
          biz.pendingRevenue += cycleEarnings;
          revenueGenerated = true;
        }
      }
      if (revenueGenerated) {
        this.saveData();
      }
    }, 45000);
  }

  private saveData(): void {
    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.data));
    } catch {
      // Storage error
    }
    this.notifyListeners();
  }

  public subscribe(callback: ListenerCallback): () => void {
    this.listeners.push(callback);
    callback(this.getData());
    return () => {
      this.listeners = this.listeners.filter((cb) => cb !== callback);
    };
  }

  private notifyListeners(): void {
    for (const listener of this.listeners) {
      listener(this.getData());
    }
  }

  public getData(): PlayerAccount {
    return { ...this.data };
  }

  // === MONEY & TRANSACTIONS ===

  public spendCash(amount: number, _description?: string): boolean {
    if (this.data.walletCash < amount) {
      return false;
    }
    this.data.walletCash -= amount;
    this.saveData();
    return true;
  }

  public addCash(amount: number): void {
    this.data.walletCash += amount;
    this.saveData();
  }

  public withdrawFromATM(amount: number): boolean {
    if (this.data.bank.balance < amount) {
      return false;
    }
    this.data.bank.balance -= amount;
    this.data.walletCash += amount;
    this.data.bank.transactions.unshift({
      id: `tx_${Date.now()}`,
      type: 'debit',
      amount,
      description: 'ATM Cash Withdrawal',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    });
    this.saveData();
    return true;
  }

  public depositToBank(amount: number): boolean {
    if (this.data.walletCash < amount) {
      return false;
    }
    this.data.walletCash -= amount;
    this.data.bank.balance += amount;
    this.data.bank.transactions.unshift({
      id: `tx_${Date.now()}`,
      type: 'credit',
      amount,
      description: 'Cash Deposit at POS / Branch',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    });
    this.saveData();
    return true;
  }

  // === INVENTORY SYSTEM ===

  public addItem(item: Omit<Item, 'quantity'>, quantity: number = 1): void {
    const existing = this.data.inventory.find((i) => i.id === item.id);
    if (existing) {
      existing.quantity += quantity;
    } else {
      this.data.inventory.push({ ...item, quantity });
    }
    this.saveData();
  }

  public useItem(itemId: string): { success: boolean; message: string } {
    const itemIndex = this.data.inventory.findIndex((i) => i.id === itemId);
    if (itemIndex === -1) {
      return { success: false, message: 'Item not found in bag' };
    }

    const item = this.data.inventory[itemIndex];
    if (!item.usable) {
      return { success: false, message: `${item.name} cannot be consumed directly.` };
    }

    // Effect logic
    if (item.category === 'food' && item.energyRestore) {
      this.data.stats.energy = Math.min(100, this.data.stats.energy + item.energyRestore);
      this.data.stats.hunger = Math.min(100, this.data.stats.hunger + item.energyRestore * 1.2);
    }

    // Decrement quantity
    item.quantity -= 1;
    if (item.quantity <= 0) {
      this.data.inventory.splice(itemIndex, 1);
    }

    this.saveData();
    return { success: true, message: `Used ${item.name}! Restored energy.` };
  }

  public restoreEnergy(amount: number = 100): void {
    this.data.stats.energy = Math.min(100, this.data.stats.energy + amount);
    this.data.stats.hunger = Math.min(100, this.data.stats.hunger + amount);
    this.saveData();
  }

  public addStreetCred(amount: number): void {
    this.data.stats.streetCred = Math.min(100, this.data.stats.streetCred + amount);
    this.saveData();
  }

  public updateUsername(newName: string): void {
    this.data.username = newName;
    this.saveData();
  }

  // === BUSINESS & ENTERPRISE SYSTEM ===

  public buyBusiness(bizId: string): { success: boolean; message: string } {
    const biz = this.data.businesses.find((b) => b.id === bizId);
    if (!biz) return { success: false, message: 'Business enterprise not found' };
    if (biz.owned) return { success: false, message: 'You already own this enterprise!' };

    // Check bank or cash
    if (this.data.bank.balance >= biz.purchasePrice) {
      this.data.bank.balance -= biz.purchasePrice;
      this.data.bank.transactions.unshift({
        id: `tx_${Date.now()}`,
        type: 'debit',
        amount: biz.purchasePrice,
        description: `Acquisition: ${biz.name}`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      });
    } else if (this.data.walletCash >= biz.purchasePrice) {
      this.data.walletCash -= biz.purchasePrice;
    } else {
      return {
        success: false,
        message: `Insufficient funds! Need ₦${biz.purchasePrice.toLocaleString()} in bank or cash.`,
      };
    }

    biz.owned = true;
    biz.pendingRevenue = 0;
    this.data.stats.streetCred = Math.min(100, this.data.stats.streetCred + 25);
    this.saveData();
    return {
      success: true,
      message: `Congratulations! You now own ${biz.name}! Passive income has started.`,
    };
  }

  public upgradeBusiness(bizId: string, upgradeId: string): { success: boolean; message: string } {
    const biz = this.data.businesses.find((b) => b.id === bizId);
    if (!biz || !biz.owned) return { success: false, message: 'You must own this enterprise first' };

    const upg = biz.upgrades.find((u) => u.id === upgradeId);
    if (!upg) return { success: false, message: 'Upgrade not found' };
    if (upg.purchased) return { success: false, message: 'Upgrade already installed' };

    if (this.data.bank.balance >= upg.cost) {
      this.data.bank.balance -= upg.cost;
      this.data.bank.transactions.unshift({
        id: `tx_${Date.now()}`,
        type: 'debit',
        amount: upg.cost,
        description: `Business Upgrade: ${upg.name}`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      });
    } else if (this.data.walletCash >= upg.cost) {
      this.data.walletCash -= upg.cost;
    } else {
      return {
        success: false,
        message: `Insufficient funds! Need ₦${upg.cost.toLocaleString()}`,
      };
    }

    upg.purchased = true;
    biz.level += 1;
    this.data.stats.streetCred = Math.min(100, this.data.stats.streetCred + 10);
    this.saveData();
    return {
      success: true,
      message: `Upgrade installed: ${upg.name}! +₦${upg.bonusIncomePerCycle.toLocaleString()} revenue per cycle.`,
    };
  }

  public collectBusinessRevenue(bizId?: string): { totalCollected: number; message: string } {
    let total = 0;
    if (bizId) {
      const biz = this.data.businesses.find((b) => b.id === bizId);
      if (biz && biz.owned && biz.pendingRevenue > 0) {
        total = biz.pendingRevenue;
        biz.pendingRevenue = 0;
      }
    } else {
      for (const biz of this.data.businesses) {
        if (biz.owned && biz.pendingRevenue > 0) {
          total += biz.pendingRevenue;
          biz.pendingRevenue = 0;
        }
      }
    }

    if (total <= 0) {
      return { totalCollected: 0, message: 'No pending profits to collect yet. Check back soon!' };
    }

    // Direct credit to bank account
    this.data.bank.balance += total;
    this.data.bank.transactions.unshift({
      id: `tx_${Date.now()}`,
      type: 'credit',
      amount: total,
      description: 'Lagos Enterprise Profit Payout',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    });

    this.saveData();
    return {
      totalCollected: total,
      message: `₦${total.toLocaleString()} business profits successfully credited to your bank account!`,
    };
  }

  // === REAL ESTATE & PROPERTY SYSTEM ===

  public buyProperty(propId: string, rentMode: boolean): { success: boolean; message: string } {
    const prop = this.data.properties.find((p) => p.id === propId);
    if (!prop) return { success: false, message: 'Property not found' };
    if (prop.status === 'purchased') {
      return { success: false, message: 'You already outright own this luxury property!' };
    }

    const price = rentMode ? prop.rentalPriceMonthly : prop.purchasePrice;

    if (this.data.bank.balance >= price) {
      this.data.bank.balance -= price;
      this.data.bank.transactions.unshift({
        id: `tx_${Date.now()}`,
        type: 'debit',
        amount: price,
        description: rentMode ? `Monthly Rent: ${prop.name}` : `Title Deed: ${prop.name}`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      });
    } else if (this.data.walletCash >= price) {
      this.data.walletCash -= price;
    } else {
      return {
        success: false,
        message: `Insufficient funds! Need ₦${price.toLocaleString()}`,
      };
    }

    prop.status = rentMode ? 'rented' : 'purchased';

    // Add key to inventory bag
    this.addItem({
      id: `key_${prop.id}`,
      name: `${prop.name} Smart Keycard`,
      category: 'key',
      icon: '🔑',
      description: `Official master key and electronic access fob for ${prop.name}.`,
      price: 5000,
      usable: true,
    });

    this.data.stats.streetCred = Math.min(100, this.data.stats.streetCred + (rentMode ? 25 : 50));
    this.saveData();

    return {
      success: true,
      message: rentMode
        ? `Lease confirmed! Welcome to ${prop.name}. Keycard added to bag.`
        : `Deed of Ownership Signed! You are now the official landlord of ${prop.name}!`,
    };
  }

  public restAtProperty(propId: string): { success: boolean; message: string } {
    const prop = this.data.properties.find((p) => p.id === propId);
    if (!prop || prop.status === 'unowned') {
      return { success: false, message: 'You must own or lease this property to rest here!' };
    }

    this.data.stats.energy = 100;
    this.data.stats.hunger = 100;
    this.saveData();

    return {
      success: true,
      message: 'AC on blast, standby generator humming! Recharged 100% Energy & 100% Hunger.',
    };
  }

  // === CAREER PROGRESSION ===

  public addJobExperience(xpGained: number): { leveledUp: boolean; newTitle: string } {
    this.data.career.xp += xpGained;
    this.data.career.completedGigs += 1;

    let leveledUp = false;
    if (this.data.career.xp >= 300 && this.data.career.rankLevel < 3) {
      this.data.career.rankLevel = 3;
      this.data.career.title = 'Lagos Island Chief / Executive';
      this.data.career.bonusMultiplier = 1.5;
      this.data.stats.streetCred = Math.min(100, this.data.stats.streetCred + 30);
      leveledUp = true;
    } else if (this.data.career.xp >= 100 && this.data.career.rankLevel < 2) {
      this.data.career.rankLevel = 2;
      this.data.career.title = 'Senior Hustler / Supervisor';
      this.data.career.bonusMultiplier = 1.25;
      this.data.stats.streetCred = Math.min(100, this.data.stats.streetCred + 15);
      leveledUp = true;
    }

    this.saveData();
    return { leveledUp, newTitle: this.data.career.title };
  }

  // === VIRAL ORIGIN DESTINY (Nepo vs. Lapo vs. Tech Bro) ===

  public applyOriginDestiny(destiny: OriginDestiny): { title: string; message: string } {
    this.data.originDestiny = destiny;

    if (destiny === 'nepo') {
      this.data.destinyTitle = 'Banana Island Billionaire Heir';
      this.data.walletCash = 2500000;
      this.data.bank.balance = 10000000;
      this.data.stats.energy = 100;
      this.data.stats.hunger = 100;
      this.data.stats.streetCred = 35;
      this.data.activeLoan = undefined;

      this.addItem({
        id: 'amex_black',
        name: 'Centurion Black Amex Card',
        category: 'key',
        icon: '💳',
        description: 'Unlimited limit titanium card accepted at Quilox and Eko Atlantic.',
        price: 5000000,
        usable: false,
      });
      this.addItem({
        id: 'cartier_shades',
        name: 'Cartier Gold Frame Sunglasses',
        category: 'gadget',
        icon: '🕶️',
        description: 'Bespoke designer sunglasses for Ikoyi and Banana Island high life.',
        price: 1200000,
        usable: false,
      });
      this.addItem({
        id: 'iphone_promax',
        name: 'iPhone 16 Pro Max 1TB Gold',
        category: 'gadget',
        icon: '📱',
        description: 'Top-tier smartphone with custom gold chassis and OPay VIP.',
        price: 2400000,
        usable: true,
      });
      this.addItem({
        id: 'penthouse_pass',
        name: 'Banana Island Penthouse Access Card',
        category: 'key',
        icon: '🔑',
        description: 'Exclusive keycard for private waterfront infinity pool and elevator.',
        price: 10000000,
        usable: false,
      });

      this.data.bank.transactions.unshift({
        id: `tx_nepo_${Date.now()}`,
        type: 'credit',
        amount: 10000000,
        description: 'Family Trust Fund Quarterly Dividend',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      });

      this.saveData();
      return {
        title: '🌟 Nepo Spawn: Banana Island Heir',
        message: 'Born with a platinum spoon! ₦2,500,000 cash, ₦10,000,000 in bank, Cartier shades & Penthouse card unlocked!',
      };
    } else if (destiny === 'lapo') {
      this.data.destinyTitle = 'Mainland Grassroots Hustler';
      this.data.walletCash = 2500;
      this.data.bank.balance = 1000;
      this.data.stats.energy = 90;
      this.data.stats.hunger = 50;
      this.data.stats.streetCred = 80;
      this.data.activeLoan = {
        lender: 'Lapo Microfinance Bank',
        amount: 50000,
        weeklyRepayment: 7500,
      };

      this.addItem({
        id: 'lapo_loan_slip',
        name: 'Lapo Microfinance Loan Agreement',
        category: 'document',
        icon: '📄',
        description: '₦50,000 seed loan document. Weekly repayment: ₦7,500.',
        price: 50000,
        usable: false,
      });
      this.addItem({
        id: 'danfo_pass',
        name: 'Danfo Weekly Commuter Slip',
        category: 'document',
        icon: '🎫',
        description: 'Yellow bus ticket across Oshodi, Ojota, and Broad Street.',
        price: 1500,
        usable: false,
      });
      this.addItem({
        id: 'pure_water_pack',
        name: 'Bag of Chilled Pure Water (20 Sachets)',
        category: 'food',
        icon: '💧',
        description: 'Street-ready cold pure water bag for quenching heat or reselling.',
        price: 400,
        usable: true,
        energyRestore: 25,
      });

      this.saveData();
      return {
        title: '⚡ Lapo Spawn: Mainland Street Hustler',
        message: 'Grassroots grit! Starting with ₦2,500 cash, ₦50,000 Lapo microloan, and maximum +80 Street Cred! Time to hustle to the top!',
      };
    } else {
      this.data.destinyTitle = 'Yaba Tech Bro & Startup Founder';
      this.data.walletCash = 150000;
      this.data.bank.balance = 750000;
      this.data.stats.energy = 95;
      this.data.stats.hunger = 80;
      this.data.stats.streetCred = 50;
      this.data.activeLoan = undefined;

      this.addItem({
        id: 'macbook_m3',
        name: 'Apple MacBook Pro M3 Max (36GB)',
        category: 'gadget',
        icon: '💻',
        description: 'Heavyweight dev machine for remote contract work and smart contracts.',
        price: 3500000,
        usable: false,
      });
      this.addItem({
        id: 'otigba_solar_powerbank',
        name: 'Otigba 30,000mAh Solar Power Bank',
        category: 'tool',
        icon: '🔋',
        description: 'Never get shut down when NEPA strikes in Yaba or Ikeja.',
        price: 25000,
        usable: false,
      });
      this.addItem({
        id: 'usd_card',
        name: 'Geegpay Virtual USD Visa Card',
        category: 'key',
        icon: '💳',
        description: 'Direct dollar card for AWS, GitHub, and Silicon Valley remittances.',
        price: 15000,
        usable: false,
      });

      this.data.bank.transactions.unshift({
        id: `tx_tech_${Date.now()}`,
        type: 'credit',
        amount: 750000,
        description: 'Remote San Francisco Seed Retainer',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      });

      this.saveData();
      return {
        title: '💻 Tech Bro Spawn: Yaba Startup Founder',
        message: 'Funded! ₦150,000 pocket cash, ₦750,000 bank, M3 MacBook Pro & USD Visa Card ready for code deployment!',
      };
    }
  }
}
