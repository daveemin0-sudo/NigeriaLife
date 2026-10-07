import type { TransactionRecord, TransactionType, PlayerAccount } from './types';

export interface ProcessTransactionRequest {
  type: TransactionType;
  amount: number; // positive number
  description: string;
  source?: 'wallet' | 'bank'; // Defaults to wallet, or falls back to bank if specified
  allowCreditBank?: boolean;
}

export interface TransactionResult {
  success: boolean;
  message: string;
  record?: TransactionRecord;
  newBalance?: number;
}

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
   * Centralized transaction execution.
   * Ensures no negative balance, writes to transaction history, and returns a verified receipt.
   */
  public process(
    data: PlayerAccount,
    req: ProcessTransactionRequest
  ): TransactionResult {
    const { type, amount, description, source = 'wallet' } = req;

    if (amount < 0) {
      return { success: false, message: 'Invalid transaction amount: cannot be negative.' };
    }

    const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const txId = `tx_${Date.now()}_${Math.floor(Math.random() * 1000)}`;

    // Inflow transactions (credits)
    if (
      type === 'JOB_SALARY' ||
      type === 'BUSINESS_INCOME' ||
      type === 'ATM_DEPOSIT'
    ) {
      if (source === 'bank' || type === 'BUSINESS_INCOME') {
        data.bank.balance += amount;
      } else {
        data.walletCash += amount;
      }

      const record: TransactionRecord = {
        id: txId,
        playerId: data.id,
        type,
        amount,
        timestamp,
        description,
        source: source === 'bank' || type === 'BUSINESS_INCOME' ? 'bank' : 'wallet',
      };

      if (!Array.isArray(data.transactionHistory)) {
        data.transactionHistory = [];
      }
      data.transactionHistory.unshift(record);
      if (data.transactionHistory.length > 50) data.transactionHistory.pop();

      // Also mirror to bank account transactions if bank source
      if (record.source === 'bank') {
        data.bank.transactions.unshift({
          id: txId,
          type: 'credit',
          amount,
          description,
          timestamp,
        });
        if (data.bank.transactions.length > 25) data.bank.transactions.pop();
      }

      return {
        success: true,
        message: `Credited ₦${amount.toLocaleString()} (${description})`,
        record,
        newBalance: record.source === 'bank' ? data.bank.balance : data.walletCash,
      };
    }

    // Outflow transactions (debits: purchases, rent, travel)
    let actualSource: 'wallet' | 'bank' = source;

    if (actualSource === 'bank') {
      if (data.bank.balance < amount) {
        // Check if wallet can cover
        if (data.walletCash >= amount) {
          actualSource = 'wallet';
        } else {
          return {
            success: false,
            message: `Not enough money. Required: ₦${amount.toLocaleString()}, Bank: ₦${data.bank.balance.toLocaleString()}, Wallet: ₦${data.walletCash.toLocaleString()}`,
          };
        }
      }
    } else {
      // Trying wallet first
      if (data.walletCash < amount) {
        // Check if bank has enough
        if (data.bank.balance >= amount) {
          actualSource = 'bank';
        } else {
          return {
            success: false,
            message: `Not enough money. Required: ₦${amount.toLocaleString()}, Wallet: ₦${data.walletCash.toLocaleString()}, Bank: ₦${data.bank.balance.toLocaleString()}`,
          };
        }
      }
    }

    // Deduct
    if (actualSource === 'bank') {
      data.bank.balance -= amount;
    } else {
      data.walletCash -= amount;
    }

    const record: TransactionRecord = {
      id: txId,
      playerId: data.id,
      type,
      amount,
      timestamp,
      description,
      source: actualSource,
    };

    if (!Array.isArray(data.transactionHistory)) {
      data.transactionHistory = [];
    }
    data.transactionHistory.unshift(record);
    if (data.transactionHistory.length > 50) data.transactionHistory.pop();

    if (actualSource === 'bank') {
      data.bank.transactions.unshift({
        id: txId,
        type: 'debit',
        amount,
        description,
        timestamp,
      });
      if (data.bank.transactions.length > 25) data.bank.transactions.pop();
    }

    return {
      success: true,
      message: `Paid ₦${amount.toLocaleString()} from ${actualSource} (${description})`,
      record,
      newBalance: actualSource === 'bank' ? data.bank.balance : data.walletCash,
    };
  }
}
