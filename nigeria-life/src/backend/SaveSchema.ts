import {
  type PlayerAccount,
  type Item,
  type PropertyStatus,
  type TransactionRecord,
  type SavedWorldState,
  INITIAL_PLAYER_DATA,
  DEFAULT_BUSINESSES,
  DEFAULT_PROPERTIES,
  DEFAULT_CAREER,
  SAVE_SCHEMA_VERSION,
} from './types';

export interface LoadedAccount {
  account: PlayerAccount;
  /** Paths of saved values that were the wrong type or out of range and had to be replaced */
  repaired: string[];
  savedVersion: number;
}

const ITEM_CATEGORIES: ReadonlySet<string> = new Set([
  'food', 'tool', 'document', 'key', 'gadget', 'medicine', 'luxury', 'electronics',
]);
const PROPERTY_STATUSES: ReadonlySet<string> = new Set([
  'available', 'rented', 'owned', 'unavailable', 'unowned', 'purchased',
]);
const SAVED_CITIES: ReadonlySet<string> = new Set(['lagos', 'abuja', 'port_harcourt']);

type Raw = Record<string, any>;
const isRecord = (v: unknown): v is Raw => typeof v === 'object' && v !== null && !Array.isArray(v);

export function createFreshAccount(): PlayerAccount {
  return structuredClone(INITIAL_PLAYER_DATA);
}

/**
 * Rebuilds an account from untrusted saved JSON. Every field is type-checked and clamped,
 * static catalogue data (prices, names) always comes from code, and anything unusable falls
 * back to the default for that one field instead of discarding the whole save.
 */
export function sanitizeAccount(saved: Raw, repaired: string[] = []): PlayerAccount {
  const base = createFreshAccount();

  // A value that is simply absent (older save) takes the default silently; a wrong one is reported.
  const num = (value: unknown, fallback: number, path: string, min = -Infinity, max = Infinity): number => {
    if (typeof value === 'number' && Number.isFinite(value)) {
      if (value < min || value > max) {
        repaired.push(path);
        return Math.min(max, Math.max(min, value));
      }
      return value;
    }
    if (value !== undefined && value !== null) repaired.push(path);
    return fallback;
  };
  const str = (value: unknown, fallback: string, path: string): string => {
    if (typeof value === 'string' && value.length > 0) return value;
    if (value !== undefined && value !== null) repaired.push(path);
    return fallback;
  };
  const list = (value: unknown, path: string): Raw[] | null => {
    if (Array.isArray(value)) return value.filter(isRecord);
    if (value !== undefined && value !== null) repaired.push(path);
    return null;
  };

  const bank = isRecord(saved.bank) ? saved.bank : {};
  const stats = isRecord(saved.stats) ? saved.stats : {};
  const career = isRecord(saved.career) ? saved.career : {};

  const bankRows = list(bank.transactions, 'bank.transactions');
  const inventoryRows = list(saved.inventory, 'inventory');
  const historyRows = list(saved.transactionHistory, 'transactionHistory');
  const savedBusinesses = list(saved.businesses, 'businesses') || [];
  const savedProperties = list(saved.properties, 'properties') || [];

  const inventory: Item[] = inventoryRows
    ? inventoryRows
        .filter((i) => typeof i.id === 'string' && typeof i.name === 'string' && Number.isFinite(i.quantity) && i.quantity >= 1)
        .map((i) => ({
          id: i.id,
          name: i.name,
          category: ITEM_CATEGORIES.has(i.category) ? i.category : 'tool',
          icon: typeof i.icon === 'string' ? i.icon : '📦',
          description: typeof i.description === 'string' ? i.description : '',
          price: num(i.price, 0, `inventory.${i.id}.price`, 0),
          quantity: Math.floor(i.quantity),
          usable: i.usable === true,
          ...(typeof i.energyRestore === 'number' && Number.isFinite(i.energyRestore) ? { energyRestore: i.energyRestore } : {}),
        }))
    : base.inventory;

  const transactionHistory: TransactionRecord[] = historyRows
    ? historyRows
        .filter((t) => typeof t.id === 'string' && typeof t.type === 'string' && Number.isFinite(t.amount))
        .slice(0, 50)
        .map((t) => ({
          id: t.id,
          playerId: typeof t.playerId === 'string' ? t.playerId : base.id,
          type: t.type,
          amount: t.amount,
          timestamp: typeof t.timestamp === 'string' ? t.timestamp : '',
          description: typeof t.description === 'string' ? t.description : '',
          source: t.source === 'bank' ? 'bank' : 'wallet',
        }))
    : base.transactionHistory;

  const shift = saved.activeJobShift;
  const loan = saved.activeLoan;
  const world = saved.worldState;

  const claims: Record<string, number> = {};
  if (isRecord(saved.claims)) {
    for (const [key, at] of Object.entries(saved.claims)) {
      if (typeof at === 'number' && Number.isFinite(at)) claims[key] = at;
    }
  }

  let worldState: SavedWorldState | undefined;
  if (isRecord(world) && SAVED_CITIES.has(world.cityId) && Number.isFinite(world.x) && Number.isFinite(world.z)) {
    worldState = {
      cityId: world.cityId,
      x: Math.min(400, Math.max(-400, world.x)),
      z: Math.min(400, Math.max(-400, world.z)),
      rotationY: Number.isFinite(world.rotationY) ? world.rotationY : 0,
      hour: num(world.hour, 13.3, 'worldState.hour', 0, 24),
      day: Math.floor(num(world.day, 0, 'worldState.day', 0)),
      ...(world.inTransit === true ? { inTransit: true } : {}),
    };
  } else if (world !== undefined && world !== null) {
    repaired.push('worldState');
  }

  return {
    schemaVersion: SAVE_SCHEMA_VERSION,
    id: str(saved.id, base.id, 'id'),
    username: str(saved.username, base.username, 'username'),
    phoneNumber: str(saved.phoneNumber, base.phoneNumber, 'phoneNumber'),
    originDestiny: ['nepo', 'lapo', 'tech_bro'].includes(saved.originDestiny) ? saved.originDestiny : undefined,
    destinyTitle: typeof saved.destinyTitle === 'string' ? saved.destinyTitle : undefined,
    walletCash: Math.round(num(saved.walletCash, base.walletCash, 'walletCash', 0)),
    bank: {
      accountNumber: str(bank.accountNumber, base.bank.accountNumber, 'bank.accountNumber'),
      bankName: str(bank.bankName, base.bank.bankName, 'bank.bankName'),
      balance: Math.round(num(bank.balance, base.bank.balance, 'bank.balance', 0)),
      transactions: bankRows
        ? bankRows
            .filter((t) => typeof t.id === 'string' && Number.isFinite(t.amount))
            .slice(0, 25)
            .map((t) => ({
              id: t.id,
              type: t.type === 'debit' ? 'debit' : 'credit',
              amount: t.amount,
              description: typeof t.description === 'string' ? t.description : '',
              timestamp: typeof t.timestamp === 'string' ? t.timestamp : '',
            }))
        : base.bank.transactions,
    },
    stats: {
      health: num(stats.health, 100, 'stats.health', 0, 100),
      energy: num(stats.energy, base.stats.energy, 'stats.energy', 0, 100),
      hunger: num(stats.hunger, base.stats.hunger, 'stats.hunger', 0, 100),
      streetCred: num(stats.streetCred, base.stats.streetCred, 'stats.streetCred', 0, 100),
    },
    inventory,
    businesses: DEFAULT_BUSINESSES.map((def) => {
      const s = savedBusinesses.find((b) => b.id === def.id);
      if (!s) return structuredClone(def);
      const savedUpgrades = list(s.upgrades, `businesses.${def.id}.upgrades`) || [];
      return {
        ...structuredClone(def),
        owned: s.owned === true,
        pendingRevenue: Math.round(num(s.pendingRevenue, 0, `businesses.${def.id}.pendingRevenue`, 0)),
        level: num(s.level, def.level, `businesses.${def.id}.level`, 1),
        upgrades: def.upgrades.map((uDef) => ({
          ...uDef,
          purchased: savedUpgrades.some((u) => u.id === uDef.id && u.purchased === true),
        })),
      };
    }),
    properties: DEFAULT_PROPERTIES.map((def) => {
      const s = savedProperties.find((p) => p.id === def.id);
      if (!s) return structuredClone(def);
      return {
        ...structuredClone(def),
        status: (PROPERTY_STATUSES.has(s.status) ? s.status : def.status) as PropertyStatus,
        ownerId: typeof s.ownerId === 'string' ? s.ownerId : def.ownerId,
        level: num(s.level, def.level, `properties.${def.id}.level`, 1),
        safeBalance: Math.round(num(s.safeBalance, def.safeBalance, `properties.${def.id}.safeBalance`, 0)),
      };
    }),
    career: {
      title: str(career.title, DEFAULT_CAREER.title, 'career.title'),
      rankLevel: num(career.rankLevel, DEFAULT_CAREER.rankLevel, 'career.rankLevel', 1, 3),
      xp: num(career.xp, DEFAULT_CAREER.xp, 'career.xp', 0),
      completedGigs: num(career.completedGigs, DEFAULT_CAREER.completedGigs, 'career.completedGigs', 0),
      bonusMultiplier: num(career.bonusMultiplier, DEFAULT_CAREER.bonusMultiplier, 'career.bonusMultiplier', 1, 1.5),
    },
    transactionHistory,
    activeJobShift:
      isRecord(shift) && typeof shift.jobId === 'string' && Number.isFinite(shift.startTime) && Number.isFinite(shift.duration)
        ? { jobId: shift.jobId, startTime: shift.startTime, duration: shift.duration, completed: shift.completed === true }
        : null,
    activeHousingId: typeof saved.activeHousingId === 'string' ? saved.activeHousingId : undefined,
    activeLoan:
      isRecord(loan) && typeof loan.lender === 'string' && Number.isFinite(loan.amount) && loan.amount > 0
        ? {
            lender: loan.lender,
            amount: Math.round(loan.amount),
            weeklyRepayment: Number.isFinite(loan.weeklyRepayment) ? loan.weeklyRepayment : 0,
          }
        : undefined,
    claims,
    lastRevenueAt: Number.isFinite(saved.lastRevenueAt) ? saved.lastRevenueAt : undefined,
    worldState,
    createdAt: str(saved.createdAt, base.createdAt, 'createdAt'),
  };
}

/**
 * Parses a saved account string. Returns null when the text is not a usable save at all
 * (the caller keeps a backup copy and starts a new account).
 */
export function parseSavedAccount(json: string): LoadedAccount | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    return null;
  }
  if (!isRecord(parsed)) return null;

  // Saves written before versioning existed count as version 1.
  const savedVersion = typeof parsed.schemaVersion === 'number' ? parsed.schemaVersion : 1;

  // Version 1 -> 2 only added fields (claims, lastRevenueAt, worldState), which sanitizeAccount
  // fills with defaults. A future shape change converts `parsed` here, one step per version.

  const repaired: string[] = [];
  const account = sanitizeAccount(parsed, repaired);
  return { account, repaired, savedVersion };
}
