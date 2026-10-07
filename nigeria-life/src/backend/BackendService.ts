import {
  type PlayerAccount,
  type Item,
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
}
