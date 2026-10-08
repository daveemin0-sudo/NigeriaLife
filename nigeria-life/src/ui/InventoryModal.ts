import { BackendService } from '../backend/BackendService';
import type { PlayerAccount } from '../backend/types';
import { showGameToast } from './GameToast';
import { UIStateManager } from './UIStateManager';

export class InventoryModal {
  private container: HTMLDivElement;
  private backend: BackendService;
  public isOpen: boolean = false;
  public onOpenATM?: () => void;

  constructor() {
    this.backend = BackendService.getInstance();
    this.container = document.createElement('div');
    this.container.id = 'inventory-modal';
    this.container.style.display = 'none';

    document.body.appendChild(this.container);

    this.backend.subscribe(this.onDataUpdate.bind(this));
  }

  public open(): void {
    this.isOpen = true;
    this.container.style.display = 'flex';
    this.render(this.backend.getData());
    UIStateManager.getInstance().pushModal('inventory');
  }

  public close(): void {
    this.isOpen = false;
    this.container.style.display = 'none';
    UIStateManager.getInstance().popModal('inventory');
  }

  public toggle(): void {
    if (this.isOpen) this.close();
    else this.open();
  }

  private onDataUpdate(data: PlayerAccount): void {
    if (this.isOpen) {
      this.render(data);
    }
  }

  private render(data: PlayerAccount): void {
    this.container.innerHTML = `
      <div class="modal-backdrop"></div>
      <div class="creator-dialog inventory-dialog">
        <header class="dialog-header">
          <div class="dialog-title-wrap">
            <span class="dialog-badge">PLAYER INVENTORY • LAGOS BAG</span>
            <h2>🎒 Pocket & Backpack</h2>
            <p>Physical cash, ATM cards, snacks, and street gear.</p>
          </div>
          <button class="dialog-close-btn" id="inv-close-btn">&times;</button>
        </header>

        <!-- Finances Quick Summary Bar -->
        <div class="inv-finances-bar">
          <div class="fin-card">
            <span class="fin-label">Pocket Cash</span>
            <span class="fin-value cash-val">₦${data.walletCash.toLocaleString()}</span>
          </div>
          <div class="fin-card">
            <span class="fin-label">Bank Account</span>
            <span class="fin-value bank-val">₦${data.bank.balance.toLocaleString()}</span>
          </div>
          <div class="fin-card">
            <span class="fin-label">Street Cred</span>
            <span class="fin-value cred-val">⭐ ${data.stats.streetCred}/100</span>
          </div>
        </div>

        <div class="dialog-body">
          <div class="items-grid">
            ${
              data.inventory.length === 0
                ? `<div class="empty-inv">Your bag is empty. Visit Mama Put or the street hawker!</div>`
                : data.inventory
                    .map(
                      (item) => `
                <div class="inv-item-card">
                  <div class="inv-item-top">
                    <span class="inv-item-icon">${item.icon}</span>
                    <span class="inv-item-qty">x${item.quantity}</span>
                  </div>
                  <h4 class="inv-item-name">${item.name}</h4>
                  <p class="inv-item-desc">${item.description}</p>
                  <div class="inv-item-footer">
                    ${
                      item.usable
                        ? `<button class="inv-btn-use" data-item-id="${item.id}">
                            ${item.category === 'food' ? 'Eat / Consume' : 'Use'}
                          </button>`
                        : `<span class="inv-badge-passive">Key Item</span>`
                    }
                  </div>
                </div>
              `
                    )
                    .join('')
            }
          </div>
        </div>

        <footer class="dialog-footer">
          <button class="btn-save" id="inv-done-btn">Close Bag [Esc]</button>
        </footer>
      </div>
    `;

    this.setupEvents();
  }

  private setupEvents(): void {
    const closeBtn = document.getElementById('inv-close-btn');
    if (closeBtn) closeBtn.onclick = () => this.close();

    const doneBtn = document.getElementById('inv-done-btn');
    if (doneBtn) doneBtn.onclick = () => this.close();

    const backdrop = this.container.querySelector('.modal-backdrop');
    if (backdrop) (backdrop as HTMLElement).onclick = () => this.close();

    // Use buttons
    const useButtons = this.container.querySelectorAll('.inv-btn-use');
    useButtons.forEach((btn) => {
      (btn as HTMLElement).onclick = () => {
        const itemId = (btn as HTMLElement).getAttribute('data-item-id')!;
        if (itemId === 'atm_card' && this.onOpenATM) {
          this.close();
          this.onOpenATM();
          return;
        }
        const res = this.backend.useItem(itemId);
        showGameToast(res.message, res.success ? 'success' : 'error');
      };
    });
  }
}
