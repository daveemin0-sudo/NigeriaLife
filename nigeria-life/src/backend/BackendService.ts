import {
  type PlayerAccount,
  type PlayerStats,
  type Item,
  type OriginDestiny,
  type JobListing,
  type TransactionRecord,
  type TransactionType,
  type SavedWorldState,
  DEFAULT_JOBS,
} from './types';
import { TransactionService, type ProcessTransactionRequest, type TransactionResult } from './TransactionService';
import { createFreshAccount, parseSavedAccount } from './SaveSchema';
import { WorldDataManager } from '../world/data/WorldDataManager';
import { emitGameEvent } from '../game/GameEvents';

type ListenerCallback = (data: PlayerAccount) => void;

/** Businesses pay out once per cycle while the game is open */
const REVENUE_CYCLE_MS = 45000;

export class BackendService {
  private static instance: BackendService;
  private readonly STORAGE_KEY = 'nigeria_life_account_data_v1';
  private readonly BACKUP_KEY = 'nigeria_life_account_data_v1__backup';
  private data: PlayerAccount;
  /** The exact save text this tab last wrote or loaded. If storage holds anything else, another tab has saved. */
  private lastSavedText: string | null = null;
  /** Money movements this tab made in the last few seconds, kept so a save from another tab cannot erase them */
  private recentTransactions: { record: TransactionRecord; at: number }[] = [];
  private listeners: ListenerCallback[] = [];
  private passiveInterval: number | null = null;
  private txService = TransactionService.getInstance();

  /** Set when the saved game needed repair or could not be read; shown to the player once at startup */
  public loadNotice: string | null = null;

  private constructor() {
    this.data = this.loadAtStartup();
    this.syncPropertiesToWorld();
    this.startPassiveIncomeTimer();

    window.addEventListener('storage', (e) => {
      if (e.key === this.STORAGE_KEY) {
        this.syncFromStorage();
      }
    });
  }

  public static getInstance(): BackendService {
    if (!BackendService.instance) {
      BackendService.instance = new BackendService();
    }
    return BackendService.instance;
  }

  private readStoredText(): string | null {
    try {
      return localStorage.getItem(this.STORAGE_KEY);
    } catch (e) {
      console.warn('Saved game storage is unavailable', e);
      return null;
    }
  }

  private loadAtStartup(): PlayerAccount {
    const stored = this.readStoredText();
    this.lastSavedText = stored;
    if (!stored) return createFreshAccount();

    const loaded = parseSavedAccount(stored);
    if (!loaded) {
      this.keepBackup(stored);
      console.warn('Saved game was unreadable. A copy was kept and a new account started.');
      this.loadNotice = '⚠️ Your saved game could not be read. A backup copy was kept and a new game started.';
      return createFreshAccount();
    }

    if (loaded.repaired.length > 0) {
      this.keepBackup(stored);
      console.warn('Saved game had invalid values that were reset:', loaded.repaired);
      this.loadNotice = `⚠️ Your saved game had ${loaded.repaired.length} damaged value(s) that were reset. A backup of the original was kept.`;
    }

    // Revenue only accrues while the game is open: carry over at most one cycle from the last session.
    const now = Date.now();
    loaded.account.lastRevenueAt = Math.max(loaded.account.lastRevenueAt ?? now, now - REVENUE_CYCLE_MS);
    return loaded.account;
  }

  private keepBackup(raw: string): void {
    try {
      localStorage.setItem(this.BACKUP_KEY, raw);
    } catch {
      // Storage full or unavailable
    }
  }

  /**
   * Tabs of one browser share this save. If another tab has written since we last looked, take
   * its version before changing anything, so the tabs never overwrite each other's progress.
   * Money this tab moved in the same instant, which the other tab had not seen yet, is carried over.
   */
  private syncFromStorage(): boolean {
    const stored = this.readStoredText();
    if (stored === null || stored === this.lastSavedText) return false;

    const loaded = parseSavedAccount(stored);
    this.lastSavedText = stored;
    if (!loaded) return false;

    const now = Date.now();
    this.recentTransactions = this.recentTransactions.filter((t) => now - t.at < 10000);
    const known = new Set(loaded.account.transactionHistory.map((t) => t.id));
    const unseen = this.recentTransactions.filter((t) => !known.has(t.record.id));

    this.data = loaded.account;
    for (const t of unseen) {
      this.txService.apply(this.data, t.record);
    }
    this.syncPropertiesToWorld();
    if (unseen.length > 0) {
      this.saveData();
    } else {
      this.notifyListeners();
    }
    return true;
  }

  /** Replace the whole account, for example from an imported backup. The data is validated like any save. */
  public replaceAccount(rawAccount: unknown): boolean {
    const loaded = parseSavedAccount(JSON.stringify(rawAccount));
    if (!loaded) return false;
    this.data = loaded.account;
    this.recentTransactions = [];
    this.syncPropertiesToWorld();
    this.saveData();
    return true;
  }

  public syncPropertiesToWorld(): void {
    const worldMgr = WorldDataManager.getInstance();
    for (const prop of this.data.properties) {
      const mappedStatus = prop.status === 'unowned' ? 'available' : prop.status === 'purchased' ? 'owned' : prop.status;
      worldMgr.updatePropertyStatus(prop.id, mappedStatus, prop.ownerId);
    }
  }

  public processTransaction(req: ProcessTransactionRequest): TransactionResult {
    this.syncFromStorage();
    const res = this.txService.process(this.data, req);
    if (res.success) {
      const at = Date.now();
      for (const record of res.records) {
        this.recentTransactions.push({ record, at });
      }
      this.saveData();
    }
    return res;
  }

  public getTransactionHistory(): TransactionRecord[] {
    return this.data.transactionHistory || [];
  }

  private startPassiveIncomeTimer(): void {
    if (this.passiveInterval) return;
    this.passiveInterval = window.setInterval(() => this.accrueBusinessRevenue(), 5000);
  }

  /**
   * Adds one payout per elapsed cycle to each owned business. Cycles are counted from a saved
   * timestamp, so two tabs open on the same account cannot both pay out the same cycle.
   */
  private accrueBusinessRevenue(): void {
    this.syncFromStorage();
    const now = Date.now();
    const last = this.data.lastRevenueAt ?? now;
    const cycles = Math.floor((now - last) / REVENUE_CYCLE_MS);
    if (cycles < 1) {
      this.data.lastRevenueAt = last;
      return;
    }
    this.data.lastRevenueAt = last + cycles * REVENUE_CYCLE_MS;

    let revenueGenerated = false;
    for (const biz of this.data.businesses) {
      if (biz.owned) {
        let cycleEarnings = biz.baseIncomePerCycle;
        for (const upg of biz.upgrades) {
          if (upg.purchased) {
            cycleEarnings += upg.bonusIncomePerCycle;
          }
        }
        biz.pendingRevenue += cycleEarnings * cycles;
        revenueGenerated = true;
      }
    }
    if (revenueGenerated) {
      this.saveData();
    }
  }

  private saveData(): void {
    try {
      const text = JSON.stringify(this.data);
      localStorage.setItem(this.STORAGE_KEY, text);
      this.lastSavedText = text;
    } catch (e) {
      console.warn('Could not write the saved game', e);
    }
    this.notifyListeners();
  }

  /** Records where the player is standing and the time of day, and writes the save. */
  public saveWorldState(state: SavedWorldState): void {
    this.syncFromStorage();
    this.data.worldState = state;
    this.saveData();
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

  /** Pay from the cash in the player's pocket only. */
  public spendCash(amount: number, description: string = 'Cash purchase', type: TransactionType = 'SHOP_PURCHASE'): boolean {
    return this.processTransaction({ type, amount, description, source: 'wallet', funding: 'strict' }).success;
  }

  /** Pay from the wallet first and take any shortfall from the bank account. */
  public pay(amount: number, description: string, type: TransactionType = 'SHOP_PURCHASE'): boolean {
    return this.processTransaction({ type, amount, description, source: 'wallet', funding: 'split' }).success;
  }

  public addCash(amount: number, description: string = 'Cash received', type: TransactionType = 'BONUS'): boolean {
    return this.processTransaction({ type, amount, description, source: 'wallet' }).success;
  }

  public withdrawFromATM(amount: number): boolean {
    return this.processTransaction({ type: 'ATM_WITHDRAWAL', amount, description: 'ATM Cash Withdrawal' }).success;
  }

  public depositToBank(amount: number): boolean {
    return this.processTransaction({ type: 'ATM_DEPOSIT', amount, description: 'Cash Deposit at POS / Branch' }).success;
  }

  /**
   * A payout the player may collect once per cooldown (for example a daily bonus).
   * The cooldown is real time for now; the game has no day counter yet.
   */
  public claimTimedPayout(
    key: string,
    amount: number,
    description: string,
    cooldownMs: number
  ): { success: boolean; waitMs: number } {
    this.syncFromStorage();
    const lastClaim = this.data.claims[key] ?? 0;
    const waitMs = lastClaim + cooldownMs - Date.now();
    if (waitMs > 0) {
      return { success: false, waitMs };
    }
    if (!this.addCash(amount, description, 'BONUS')) {
      return { success: false, waitMs: 0 };
    }
    this.data.claims[key] = Date.now();
    this.saveData();
    return { success: true, waitMs: 0 };
  }

  /**
   * One-off paid work (a street hustle or minigame). It costs energy, pays cash, and counts as a work shift.
   */
  public performGig(pay: number, energyCost: number, description: string): { success: boolean; message: string } {
    this.syncFromStorage();
    if (this.data.stats.energy < energyCost) {
      return {
        success: false,
        message: `You are too exhausted for this work (need ${energyCost}% Energy). Eat or rest first.`,
      };
    }
    const res = this.processTransaction({ type: 'JOB_SALARY', amount: pay, description, source: 'wallet' });
    if (!res.success) {
      return { success: false, message: res.message };
    }
    this.data.stats.energy = Math.max(0, this.data.stats.energy - energyCost);
    this.saveData();
    emitGameEvent('work_shift');
    return { success: true, message: `Earned ₦${pay.toLocaleString()} cash. Energy -${energyCost}%` };
  }

  // === LOANS ===

  /** Borrow from a lender. Only one loan can be open at a time, and it is repaid with interest. */
  public takeLoan(lender: string, principal: number, repayTotal: number): { success: boolean; message: string } {
    this.syncFromStorage();
    if (this.data.activeLoan) {
      return {
        success: false,
        message: `You still owe ₦${this.data.activeLoan.amount.toLocaleString()} to ${this.data.activeLoan.lender}. Clear it before borrowing again.`,
      };
    }
    const res = this.processTransaction({
      type: 'LOAN_DISBURSEMENT',
      amount: principal,
      description: `Loan from ${lender}`,
      source: 'wallet',
    });
    if (!res.success) {
      return { success: false, message: res.message };
    }
    this.data.activeLoan = { lender, amount: Math.round(repayTotal), weeklyRepayment: Math.round(repayTotal / 8) };
    this.saveData();
    return {
      success: true,
      message: `₦${principal.toLocaleString()} disbursed. You owe ${lender} ₦${Math.round(repayTotal).toLocaleString()}.`,
    };
  }

  /** Pay off the whole outstanding loan from the wallet and bank. */
  public repayLoan(): { success: boolean; message: string } {
    this.syncFromStorage();
    const loan = this.data.activeLoan;
    if (!loan) {
      return { success: false, message: 'You have no outstanding loan.' };
    }
    const res = this.processTransaction({
      type: 'LOAN_REPAYMENT',
      amount: loan.amount,
      description: `Loan repayment to ${loan.lender}`,
      source: 'wallet',
      funding: 'split',
    });
    if (!res.success) {
      return {
        success: false,
        message: `You owe ₦${loan.amount.toLocaleString()} to ${loan.lender} and cannot cover it yet.`,
      };
    }
    this.data.activeLoan = undefined;
    this.saveData();
    return { success: true, message: `Loan of ₦${loan.amount.toLocaleString()} to ${loan.lender} fully repaid.` };
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
    // Only food is used up. Phones, cards and keys are kept, not eaten.
    if (!item.usable || item.category !== 'food') {
      return { success: false, message: `${item.name} cannot be consumed directly.` };
    }

    const restore = item.energyRestore ?? 0;
    this.data.stats.energy = Math.min(100, this.data.stats.energy + restore);
    this.data.stats.hunger = Math.min(100, this.data.stats.hunger + restore * 1.2);

    // Decrement quantity
    item.quantity -= 1;
    if (item.quantity <= 0) {
      this.data.inventory.splice(itemIndex, 1);
    }

    this.saveData();
    emitGameEvent('eat');
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
        // Treated on credit if the patient cannot pay
        this.processTransaction({ type: 'MEDICAL_BILL', amount: 2500, description: 'Emergency clinic treatment' });
      }
    } else if (this.data.stats.hunger >= 50 && this.data.stats.energy >= 40 && this.data.stats.health < 100) {
      // Natural health regen when nourished
      this.data.stats.health = Math.min(100, this.data.stats.health + 0.05 * elapsed);
    }

    this.notifyListeners();
    return { collapsed, stats: this.data.stats, starvedWarning };
  }

  public consumeFood(foodName: string, hungerRestore: number, energyRestore: number, healthRestore: number = 10, price?: number): { success: boolean; message: string } {
    if (price !== undefined && price !== 0) {
      const paid = this.processTransaction({ type: 'FOOD_PURCHASE', amount: price, description: foodName });
      if (!paid.success) {
        return { success: false, message: `Insufficient funds! ${foodName} costs ₦${price.toLocaleString()}.` };
      }
    }
    this.data.stats.hunger = Math.min(100, this.data.stats.hunger + hungerRestore);
    this.data.stats.energy = Math.min(100, this.data.stats.energy + energyRestore);
    this.data.stats.health = Math.min(100, this.data.stats.health + healthRestore);
    this.saveData();
    emitGameEvent('eat');
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
    const paid = this.processTransaction({
      type: 'BUSINESS_PURCHASE',
      amount: biz.purchasePrice,
      description: `Acquisition: ${biz.name}`,
      source: 'bank',
    });
    if (!paid.success) {
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

    const paid = this.processTransaction({
      type: 'BUSINESS_PURCHASE',
      amount: upg.cost,
      description: `Business Upgrade: ${upg.name}`,
      source: 'bank',
    });
    if (!paid.success) {
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
    this.processTransaction({
      type: 'BUSINESS_INCOME',
      amount: total,
      description: 'Lagos Enterprise Profit Payout',
      source: 'bank',
    });

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
    emitGameEvent('work_shift');

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

  /** The origin sets the starting balances, so it can be chosen once per account. */
  public applyOriginDestiny(destiny: OriginDestiny): { title: string; message: string; applied: boolean } {
    this.syncFromStorage();
    if (this.data.originDestiny) {
      return {
        applied: false,
        title: 'Destiny already chosen',
        message: `You are already living as ${this.data.destinyTitle || 'your chosen origin'}. An origin cannot be changed once picked.`,
      };
    }
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
        applied: true,
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
        applied: true,
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
        applied: true,
        title: '💻 Tech Bro Spawn: Yaba Startup Founder',
        message: 'Funded! ₦150,000 pocket cash, ₦750,000 bank, M3 MacBook Pro & USD Visa Card ready for code deployment!',
      };
    }
  }
}
