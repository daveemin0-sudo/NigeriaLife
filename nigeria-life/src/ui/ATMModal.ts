import { BackendService } from '../backend/BackendService';
import type { PlayerAccount } from '../backend/types';
import { showGameToast } from './GameToast';
import { SoundEngine } from '../audio/SoundEngine';
import { UIStateManager } from './UIStateManager';

export class ATMModal {
  private container: HTMLDivElement;
  private backend: BackendService;
  public isOpen: boolean = false;
  /** Called when cash has actually been dispensed or paid in, so it can be shown at the machine */
  public onCashMoved?: (kind: 'withdraw' | 'deposit') => void;

  constructor() {
    this.backend = BackendService.getInstance();
    this.container = document.createElement('div');
    this.container.id = 'atm-modal';
    this.container.style.display = 'none';

    document.body.appendChild(this.container);

    this.backend.subscribe(this.onDataUpdate.bind(this));
  }

  public open(): void {
    this.isOpen = true;
    this.container.style.display = 'flex';
    this.render(this.backend.getData());
    UIStateManager.getInstance().pushModal('atm');
  }

  public close(): void {
    this.isOpen = false;
    this.container.style.display = 'none';
    UIStateManager.getInstance().popModal('atm');
  }

  private onDataUpdate(data: PlayerAccount): void {
    if (this.isOpen) {
      this.render(data);
    }
  }

  private render(data: PlayerAccount): void {
    this.container.innerHTML = `
      <div class="modal-backdrop"></div>
      <div class="creator-dialog atm-dialog">
        <header class="atm-header">
          <div class="atm-brand">
            <span class="atm-logo">🏦</span>
            <div>
              <h3>EKO COMMERCIAL BANK</h3>
              <span class="atm-sub">Automated Teller Machine • Broad St. Gallery</span>
            </div>
          </div>
          <button class="dialog-close-btn" id="atm-close-btn">&times;</button>
        </header>

        <div class="atm-screen">
          <div class="atm-account-info">
            <div class="info-row">
              <span>Cardholder: <strong>${data.username}</strong></span>
              <span>Acct: <strong>${data.bank.accountNumber}</strong></span>
            </div>
            <div class="balance-display">
              <span class="balance-label">Available Bank Balance:</span>
              <span class="balance-amount">₦${data.bank.balance.toLocaleString()}</span>
            </div>
            <div class="wallet-hint">
              <span>Pocket Cash in Wallet: <strong>₦${data.walletCash.toLocaleString()}</strong></span>
            </div>
          </div>

          <!-- Quick Cash Operations -->
          <div class="atm-section-title">Quick Cash Withdrawal</div>
          <div class="atm-grid">
            <button class="atm-btn" data-withdraw="5000">Withdraw ₦5,000</button>
            <button class="atm-btn" data-withdraw="10000">Withdraw ₦10,000</button>
            <button class="atm-btn" data-withdraw="20000">Withdraw ₦20,000</button>
            <button class="atm-btn" data-withdraw="50000">Withdraw ₦50,000</button>
          </div>

          <div class="atm-section-title">Cash Deposit (POS / Branch)</div>
          <div class="atm-grid">
            <button class="atm-btn deposit-btn" data-deposit="5000">Deposit ₦5,000</button>
            <button class="atm-btn deposit-btn" data-deposit="10000">Deposit ₦10,000</button>
          </div>

          <!-- Recent Transactions -->
          <div class="atm-section-title">Mini Statement</div>
          <div class="atm-transactions">
            ${data.bank.transactions
              .slice(0, 3)
              .map(
                (tx) => `
              <div class="atm-tx-row">
                <span class="tx-desc">${tx.description}</span>
                <span class="tx-time">${tx.timestamp}</span>
                <span class="tx-amount ${tx.type}">${tx.type === 'credit' ? '+' : '-'}₦${tx.amount.toLocaleString()}</span>
              </div>
            `
              )
              .join('')}
          </div>
        </div>

        <footer class="atm-footer">
          <button class="btn-save" id="atm-exit-btn">Eject Card & Exit</button>
        </footer>
      </div>
    `;

    this.setupEvents();
  }

  private setupEvents(): void {
    const closeBtn = document.getElementById('atm-close-btn');
    if (closeBtn) closeBtn.onclick = () => this.close();

    const exitBtn = document.getElementById('atm-exit-btn');
    if (exitBtn) exitBtn.onclick = () => this.close();

    const backdrop = this.container.querySelector('.modal-backdrop');
    if (backdrop) (backdrop as HTMLElement).onclick = () => this.close();

    // Withdrawals
    const withdrawBtns = this.container.querySelectorAll('[data-withdraw]');
    withdrawBtns.forEach((btn) => {
      (btn as HTMLElement).onclick = () => {
        const amount = Number((btn as HTMLElement).getAttribute('data-withdraw'));
        const success = this.backend.withdrawFromATM(amount);
        if (success) {
          SoundEngine.getInstance().playTransactionSuccess();
          showGameToast(`💸 Dispensing ₦${amount.toLocaleString()} cash from ATM! Check your wallet.`, 'success');
          this.onCashMoved?.('withdraw');
        } else {
          showGameToast('❌ Insufficient funds in bank account!', 'error');
        }
      };
    });

    // Deposits
    const depositBtns = this.container.querySelectorAll('[data-deposit]');
    depositBtns.forEach((btn) => {
      (btn as HTMLElement).onclick = () => {
        const amount = Number((btn as HTMLElement).getAttribute('data-deposit'));
        const success = this.backend.depositToBank(amount);
        if (success) {
          SoundEngine.getInstance().playTransactionSuccess();
          showGameToast(`✅ Deposited ₦${amount.toLocaleString()} cash into your bank account!`, 'success');
          this.onCashMoved?.('deposit');
        } else {
          showGameToast('❌ Not enough cash in your pocket wallet!', 'error');
        }
      };
    });
  }
}
