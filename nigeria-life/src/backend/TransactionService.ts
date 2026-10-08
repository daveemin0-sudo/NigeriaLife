import type { TransactionRecord, TransactionType, PlayerAccount } from './types';

export interface ProcessTransactionRequest {
  type: TransactionType;
  amount: number; // positive whole Naira
  description: string;
  /** Pocket a debit draws from first, or the pocket a credit lands in. Defaults to wallet. */
  source?: 'wallet' | 'bank';
  /**
   * How a debit is funded when the first pocket is short:
   * - 'fallback' (default): the other pocket pays the whole amount if it can
   * - 'strict': only the named pocket may pay
   * - 'split': the first pocket pays what it can, the other pays the rest
   */
  funding?: 'fallback' | 'strict' | 'split';
}

export interface TransactionResult {
  success: boolean;
  message: string;
  /** Ledger entries written; a payment split across wallet and bank writes one per pocket */
  records: TransactionRecord[];
  newBalance?: number;
}

const CREDIT_TYPES: ReadonlySet<TransactionType> = new Set<TransactionType>([
  'JOB_SALARY',
  'BUSINESS_INCOME',
  'QUEST_REWARD',
  'TRANSFER_IN',
  'WINNINGS',
  'BONUS',
  'LOAN_DISBURSEMENT',
]);

const MAX_HISTORY = 50;
const MAX_BANK_STATEMENT = 25;

export class TransactionService {
  private static instance: TransactionService;

  private constructor() {}

  public static getInstance(): TransactionService {
    if (!TransactionService.instance) {
      TransactionService.instance = new TransactionService();
    }
    return TransactionService.instance;
  }

  /**
   * The only place player money changes.
   * Rejects bad amounts, never lets a pocket go negative, and records every movement in the ledger.
   */
  public process(data: PlayerAccount, req: ProcessTransactionRequest): TransactionResult {
    const { type, description, source = 'wallet', funding = 'fallback' } = req;

    if (typeof req.amount !== 'number' || !Number.isFinite(req.amount) || req.amount <= 0) {
      return { success: false, message: 'Invalid transaction amount.', records: [] };
    }
    const amount = Math.round(req.amount);
    if (amount <= 0) {
      return { success: false, message: 'Invalid transaction amount.', records: [] };
    }

    if (type === 'ATM_WITHDRAWAL' || type === 'ATM_DEPOSIT') {
      return this.moveBetweenPockets(data, type, amount, description);
    }

    if (CREDIT_TYPES.has(type)) {
      const pocket = source === 'bank' || type === 'BUSINESS_INCOME' ? 'bank' : 'wallet';
      const record = this.createRecord(data, type, amount, description, pocket);
      this.apply(data, record);
      return {
        success: true,
        message: `Credited ₦${amount.toLocaleString()} (${description})`,
        records: [record],
        newBalance: pocket === 'bank' ? data.bank.balance : data.walletCash,
      };
    }

    // Debits: purchases, rent, fares, transfers out
    const first = source;
    const other = first === 'wallet' ? 'bank' : 'wallet';
    const balanceOf = (pocket: 'wallet' | 'bank') => (pocket === 'bank' ? data.bank.balance : data.walletCash);
    const shortMessage = `Not enough money. Required: ₦${amount.toLocaleString()}, Wallet: ₦${data.walletCash.toLocaleString()}, Bank: ₦${data.bank.balance.toLocaleString()}`;

    let fromFirst = 0;
    let fromOther = 0;
    if (balanceOf(first) >= amount) {
      fromFirst = amount;
    } else if (funding === 'fallback' && balanceOf(other) >= amount) {
      fromOther = amount;
    } else if (funding === 'split' && balanceOf(first) + balanceOf(other) >= amount) {
      fromFirst = balanceOf(first);
      fromOther = amount - fromFirst;
    } else {
      return { success: false, message: shortMessage, records: [] };
    }

    const records: TransactionRecord[] = [];
    for (const [pocket, part] of [[first, fromFirst], [other, fromOther]] as const) {
      if (part <= 0) continue;
      const record = this.createRecord(data, type, part, description, pocket);
      this.apply(data, record);
      records.push(record);
    }

    const paidFrom = fromFirst > 0 && fromOther > 0 ? 'wallet and bank' : fromFirst > 0 ? first : other;
    return {
      success: true,
      message: `Paid ₦${amount.toLocaleString()} from ${paidFrom} (${description})`,
      records,
      newBalance: fromOther > 0 ? balanceOf(other) : balanceOf(first),
    };
  }

  private moveBetweenPockets(
    data: PlayerAccount,
    type: 'ATM_WITHDRAWAL' | 'ATM_DEPOSIT',
    amount: number,
    description: string
  ): TransactionResult {
    if (type === 'ATM_WITHDRAWAL' && data.bank.balance < amount) {
      return {
        success: false,
        message: `Insufficient bank balance. Available: ₦${data.bank.balance.toLocaleString()}`,
        records: [],
      };
    }
    if (type === 'ATM_DEPOSIT' && data.walletCash < amount) {
      return {
        success: false,
        message: `Insufficient cash. In wallet: ₦${data.walletCash.toLocaleString()}`,
        records: [],
      };
    }

    const record = this.createRecord(data, type, amount, description, 'bank');
    this.apply(data, record);
    return type === 'ATM_WITHDRAWAL'
      ? { success: true, message: `Withdrew ₦${amount.toLocaleString()}`, records: [record], newBalance: data.walletCash }
      : { success: true, message: `Deposited ₦${amount.toLocaleString()}`, records: [record], newBalance: data.bank.balance };
  }

  private createRecord(
    data: PlayerAccount,
    type: TransactionType,
    amount: number,
    description: string,
    pocket: 'wallet' | 'bank'
  ): TransactionRecord {
    return {
      id: `tx_${Date.now()}_${Math.floor(Math.random() * 1000000)}`,
      playerId: data.id,
      type,
      amount,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      description,
      source: pocket,
    };
  }

  /**
   * Moves the money for one ledger entry, then writes the entry and its bank statement line.
   * Also used to carry an entry over to a copy of the account that has not seen it (two tabs of
   * the same browser acting in the same instant). A balance is never taken below zero.
   */
  public apply(data: PlayerAccount, record: TransactionRecord): void {
    const { type, amount } = record;
    let bankDirection: 'credit' | 'debit' | null = null;

    if (type === 'ATM_WITHDRAWAL') {
      data.bank.balance -= amount;
      data.walletCash += amount;
      bankDirection = 'debit';
    } else if (type === 'ATM_DEPOSIT') {
      data.walletCash -= amount;
      data.bank.balance += amount;
      bankDirection = 'credit';
    } else {
      const signed = CREDIT_TYPES.has(type) ? amount : -amount;
      if (record.source === 'bank') {
        data.bank.balance += signed;
        bankDirection = signed > 0 ? 'credit' : 'debit';
      } else {
        data.walletCash += signed;
      }
    }
    data.walletCash = Math.max(0, data.walletCash);
    data.bank.balance = Math.max(0, data.bank.balance);

    if (!Array.isArray(data.transactionHistory)) {
      data.transactionHistory = [];
    }
    data.transactionHistory.unshift(record);
    if (data.transactionHistory.length > MAX_HISTORY) data.transactionHistory.length = MAX_HISTORY;

    if (bankDirection) {
      data.bank.transactions.unshift({
        id: record.id,
        type: bankDirection,
        amount,
        description: record.description,
        timestamp: record.timestamp,
      });
      if (data.bank.transactions.length > MAX_BANK_STATEMENT) data.bank.transactions.length = MAX_BANK_STATEMENT;
    }
  }
}
