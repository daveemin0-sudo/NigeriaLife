import {
  type PlayerAccount,
  type PlayerStats,
  type Item,
  type OriginDestiny,
  type JobListing,
  type TransactionRecord,
  INITIAL_PLAYER_DATA,
  DEFAULT_BUSINESSES,
  DEFAULT_PROPERTIES,
  DEFAULT_CAREER,
  DEFAULT_JOBS,
} from './types';
import { TransactionService, type ProcessTransactionRequest, type TransactionResult } from './TransactionService';
import { WorldDataManager } from '../world/data/WorldDataManager';

type ListenerCallback = (data: PlayerAccount) => void;

export class BackendService {
  private static instance: BackendService;
  private readonly STORAGE_KEY = 'nigeria_life_account_data_v1';
  private data: PlayerAccount;
  private listeners: ListenerCallback[] = [];
  private passiveInterval: number | null = null;
  private txService = TransactionService.getInstance();

  private constructor() {
    this.data = this.loadData();
    this.syncPropertiesToWorld();
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
            health: typeof parsed.stats?.health === 'number' ? parsed.stats.health : 100,
          },
          inventory,
          businesses,
          properties,
          career,
          transactionHistory: Array.isArray(parsed.transactionHistory)
            ? parsed.transactionHistory
            : INITIAL_PLAYER_DATA.transactionHistory,
          activeJobShift: parsed.activeJobShift || null,
          activeHousingId: parsed.activeHousingId,
        };
      }
    } catch (e) {
      console.warn('Failed to load saved data, initializing defaults', e);
    }
    return { ...INITIAL_PLAYER_DATA };
  }

  public syncPropertiesToWorld(): void {
    const worldMgr = WorldDataManager.getInstance();
    for (const prop of this.data.properties) {
      const mappedStatus = prop.status === 'unowned' ? 'available' : prop.status === 'purchased' ? 'owned' : prop.status;
      worldMgr.updatePropertyStatus(prop.id, mappedStatus, prop.ownerId);
    }
  }

  public processTransaction(req: ProcessTransactionRequest): TransactionResult {
    const res = this.txService.process(this.data, req);
    if (res.success) {
      this.saveData();
    }
    return res;
  }

  public getTransactionHistory(): TransactionRecord[] {
    return this.data.transactionHistory || [];
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

  private vitalsAccumulator = 0;
  private lastStarveWarningTime = 0;

  public updateVitals(delta: number, isSprinting: boolean, isDriving: boolean): { collapsed: boolean; stats: PlayerStats; starvedWarning: boolean } {
    this.vitalsAccumulator += delta;
    if (this.vitalsAccumulator < 1.0) {
      return { collapsed: false, stats: this.data.stats, starvedWarning: false };
    }
    const elapsed = this.vitalsAccumulator;
    this.vitalsAccumulator = 0;

    // Base hunger drain: ~1 point every 30 seconds
    const hungerDrain = (isSprinting ? 0.07 : isDriving ? 0.02 : 0.035) * elapsed;
    this.data.stats.hunger = Math.max(0, this.data.stats.hunger - hungerDrain);

    // Energy drain
    if (isSprinting) {
      this.data.stats.energy = Math.max(0, this.data.stats.energy - 0.35 * elapsed);
    } else if (!isDriving) {
      this.data.stats.energy = Math.max(0, this.data.stats.energy - 0.02 * elapsed);
    }

    let starvedWarning = false;
    const now = Date.now();
    if (this.data.stats.hunger <= 15 && now - this.lastStarveWarningTime > 45000) {
      this.lastStarveWarningTime = now;
      starvedWarning = true;
    }

    // Health drain when starving (hunger is 0)
    let collapsed = false;
    if (this.data.stats.hunger <= 0) {
      this.data.stats.health = Math.max(0, this.data.stats.health - 0.15 * elapsed);
      if (this.data.stats.health <= 0) {
        collapsed = true;
        this.data.stats.health = 50;
        this.data.stats.hunger = 40;
        this.data.stats.energy = 50;
        const clinicBill = 2500;
        if (this.data.walletCash >= clinicBill) {
          this.data.walletCash -= clinicBill;
        } else if (this.data.bank.balance >= clinicBill) {
          this.data.bank.balance -= clinicBill;
        }
      }
    } else if (this.data.stats.hunger >= 50 && this.data.stats.energy >= 40 && this.data.stats.health < 100) {
      // Natural health regen when nourished
      this.data.stats.health = Math.min(100, this.data.stats.health + 0.05 * elapsed);
    }

    this.notifyListeners();
    return { collapsed, stats: this.data.stats, starvedWarning };
  }

  public consumeFood(foodName: string, hungerRestore: number, energyRestore: number, healthRestore: number = 10, price?: number): { success: boolean; message: string } {
    if (price && price > 0) {
      if (this.data.walletCash < price && this.data.bank.balance < price) {
        return { success: false, message: `Insufficient funds! ${foodName} costs ₦${price.toLocaleString()}.` };
      }
      if (this.data.walletCash >= price) {
        this.data.walletCash -= price;
      } else {
        this.data.bank.balance -= price;
      }
    }
    this.data.stats.hunger = Math.min(100, this.data.stats.hunger + hungerRestore);
    this.data.stats.energy = Math.min(100, this.data.stats.energy + energyRestore);
    this.data.stats.health = Math.min(100, this.data.stats.health + healthRestore);
    this.saveData();
    return {
      success: true,
      message: `Chowed down! Enjoyed ${foodName}. +${hungerRestore}% Hunger, +${energyRestore}% Energy!`
    };
  }

  public restAtHome(): { success: boolean; message: string } {
    this.data.stats.energy = 100;
    this.data.stats.health = 100;
    this.data.stats.hunger = Math.min(100, this.data.stats.hunger + 15);
    this.saveData();
    return {
      success: true,
      message: 'Restful sleep in your apartment! Energy & Health restored to 100%.'
    };
  }

  public restoreEnergy(amount: number = 100): void {
    this.data.stats.energy = Math.min(100, this.data.stats.energy + amount);
    this.data.stats.hunger = Math.min(100, this.data.stats.hunger + amount);
    this.saveData();
  }

  public restoreHealth(amount: number = 100): void {
    this.data.stats.health = Math.min(100, this.data.stats.health + amount);
    this.data.stats.energy = Math.min(100, this.data.stats.energy + amount);
    this.saveData();
  }

  public depleteEnergy(amount: number): boolean {
    if (this.data.stats.energy < amount) {
      return false;
    }
    this.data.stats.energy = Math.max(0, this.data.stats.energy - amount);
    this.saveData();
    return true;
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

  public buyProperty(propId: string, rentMode: boolean = false): { success: boolean; message: string } {
    const prop = this.data.properties.find((p) => p.id === propId);
    if (!prop) return { success: false, message: 'Property not found' };
    if (prop.status === 'owned') {
      return { success: false, message: 'You already own this property!' };
    }

    const price = rentMode ? prop.rentalPriceMonthly : prop.purchasePrice;
    const txType = rentMode ? 'RENT_PAYMENT' : 'PROPERTY_PURCHASE';
    const txDesc = rentMode ? `Monthly Rent: ${prop.name}` : `Title Deed: ${prop.name}`;

    const txRes = this.processTransaction({
      type: txType,
      amount: price,
      description: txDesc,
      source: this.data.bank.balance >= price ? 'bank' : 'wallet',
    });

    if (!txRes.success) {
      return { success: false, message: txRes.message };
    }

    prop.status = rentMode ? 'rented' : 'owned';
    prop.ownerId = this.data.id;
    if (rentMode) {
      this.data.activeHousingId = prop.id;
    }

    // Sync WorldDataManager so World Map & Street Mode reflect ownership immediately
    WorldDataManager.getInstance().updatePropertyStatus(prop.id, prop.status, prop.ownerId);

    // Add smart keycard to inventory bag
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
        ? `Lease confirmed! Welcome to ${prop.name}. Smart keycard added to your bag.`
        : `Deed of Ownership Signed! You are now the official landlord of ${prop.name}!`,
    };
  }

  public rentProperty(propId: string): { success: boolean; message: string } {
    return this.buyProperty(propId, true);
  }

  public restAtProperty(propId: string): { success: boolean; message: string } {
    const prop = this.data.properties.find((p) => p.id === propId);
    if (!prop || (prop.status !== 'owned' && prop.status !== 'rented')) {
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

  // === JOB SYSTEM ===

  public getJobs(): JobListing[] {
    return DEFAULT_JOBS;
  }

  public getJobById(id: string): JobListing | undefined {
    return DEFAULT_JOBS.find((j) => j.id === id);
  }

  public startJobShift(jobId: string): { success: boolean; message: string } {
    const job = this.getJobById(jobId);
    if (!job) return { success: false, message: 'Job listing not found.' };

    if (this.data.activeJobShift && !this.data.activeJobShift.completed) {
      const elapsed = Date.now() - this.data.activeJobShift.startTime;
      if (elapsed < this.data.activeJobShift.duration * 1000) {
        const remaining = Math.max(0, Math.ceil((this.data.activeJobShift.duration * 1000 - elapsed) / 1000));
        return { success: false, message: `You already have an active shift in progress (${remaining}s remaining)!` };
      }
    }

    if (this.data.stats.energy < 15) {
      return { success: false, message: 'You are too exhausted! Eat some food or rest to regain energy.' };
    }

    this.data.stats.energy = Math.max(0, this.data.stats.energy - 15);
    this.data.activeJobShift = {
      jobId,
      startTime: Date.now(),
      duration: job.shiftDuration,
      completed: false,
    };

    this.saveData();
    return {
      success: true,
      message: `Shift started for ${job.title}! Shift duration: ${job.shiftDuration}s. Hustle hard!`,
    };
  }

  public getActiveJobShift(): { job: JobListing; progress: number; remainingSecs: number; isReady: boolean } | null {
    if (!this.data.activeJobShift) return null;
    const job = this.getJobById(this.data.activeJobShift.jobId);
    if (!job) return null;

    const elapsedMs = Date.now() - this.data.activeJobShift.startTime;
    const totalMs = this.data.activeJobShift.duration * 1000;
    const progress = Math.min(1.0, elapsedMs / totalMs);
    const remainingSecs = Math.max(0, Math.ceil((totalMs - elapsedMs) / 1000));
    const isReady = elapsedMs >= totalMs;

    return { job, progress, remainingSecs, isReady };
  }

  public completeJobShift(): { success: boolean; reward: number; message: string } {
    const shiftInfo = this.getActiveJobShift();
    if (!shiftInfo) return { success: false, reward: 0, message: 'No active job shift.' };
    if (!shiftInfo.isReady) {
      return { success: false, reward: 0, message: `Shift still ongoing! ${shiftInfo.remainingSecs}s remaining.` };
    }

    const { job } = shiftInfo;
    const txRes = this.processTransaction({
      type: 'JOB_SALARY',
      amount: job.salary,
      description: `Completed Shift: ${job.title}`,
      source: 'wallet',
    });

    this.addJobExperience(25);
    this.addStreetCred(10);
    this.data.activeJobShift = null;
    this.saveData();

    return {
      success: true,
      reward: job.salary,
      message: `Shift completed! Earned ₦${job.salary.toLocaleString()} cash in your pocket (${txRes.message}) and gained XP!`,
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
        name: 'Aura Pro Max 1TB Gold',
        category: 'gadget',
        icon: '📱',
        description: 'Top-tier smartphone with custom gold chassis and NaijaPay VIP.',
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
