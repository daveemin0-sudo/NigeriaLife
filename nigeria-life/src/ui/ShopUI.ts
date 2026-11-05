import type { ShopService, PayMethod } from '../interiors/shop/ShopService';
import { BackendService } from '../backend/BackendService';
import { UIStateManager } from './UIStateManager';

const naira = (amount: number) => `₦${amount.toLocaleString()}`;

type View = { kind: 'shelf'; sectionId: string } | { kind: 'basket' };

/**
 * The supermarket's two pieces of screen: a sheet for looking along a shelf and through the
 * basket, and a status line that says what is in the basket or how the till is getting on.
 * Taking, putting back and paying are all acted out in the shop; this only asks for them.
 */
export class ShopUI {
  private readonly service: ShopService;
  private readonly sheet: HTMLDivElement;
  private readonly status: HTMLDivElement;
  private view: View = { kind: 'basket' };
  private note = '';
  private open_ = false;

  constructor(service: ShopService) {
    this.service = service;

    this.sheet = document.createElement('div');
    this.sheet.id = 'shop-sheet';
    this.sheet.className = 'buka-menu shop-sheet';
    this.sheet.style.display = 'none';
    this.sheet.setAttribute('role', 'dialog');
    this.sheet.setAttribute('aria-label', 'Everyday Supermarket');
    document.body.appendChild(this.sheet);

    this.status = document.createElement('div');
    this.status.id = 'shop-status';
    this.status.className = 'buka-order-status';
    this.status.style.display = 'none';
    document.body.appendChild(this.status);

    const ui = UIStateManager.getInstance();
    ui.registerModal('shop-sheet', { id: 'shop-sheet', close: () => this.close(), isOpen: () => this.open_ });
    ui.onModeChange(() => this.renderStatus());
    service.onChange = () => {
      if (this.open_) this.renderSheet();
      this.renderStatus();
    };
  }

  public get isOpen(): boolean {
    return this.open_;
  }

  /** Look along one shelf. */
  public openShelf(sectionId: string): void {
    this.show({ kind: 'shelf', sectionId });
  }

  /** Look through the basket, and pay for it. */
  public openBasket(): void {
    this.show({ kind: 'basket' });
  }

  private show(view: View): void {
    this.view = view;
    this.note = '';
    this.open_ = true;
    this.renderSheet();
    this.sheet.style.display = 'flex';
    UIStateManager.getInstance().pushModal('shop-sheet');
  }

  public close(): void {
    if (!this.open_) return;
    this.open_ = false;
    this.sheet.style.display = 'none';
    UIStateManager.getInstance().popModal('shop-sheet');
  }

  private el<K extends keyof HTMLElementTagNameMap>(tag: K, className: string, text?: string): HTMLElementTagNameMap[K] {
    const node = document.createElement(tag);
    node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  private renderSheet(): void {
    const service = this.service;
    const data = BackendService.getInstance().getData();
    const view = this.view;
    const section = view.kind === 'shelf' ? service.sections.find((entry) => entry.id === view.sectionId) : null;
    this.sheet.innerHTML = '';

    // Title, money, close
    const head = this.el('div', 'buka-menu-head');
    const titles = this.el('div', 'buka-menu-titles');
    titles.append(
      this.el('span', 'buka-menu-title', section ? `${section.icon} ${section.name}` : '🧺 Your basket'),
      this.el('span', 'buka-menu-sub', `Cash ${naira(data.walletCash)} · Bank ${naira(data.bank.balance)} · You pay at the till`)
    );
    const close = this.el('button', 'buka-menu-close', '×');
    close.id = 'shop-sheet-close';
    close.setAttribute('aria-label', 'Close');
    close.addEventListener('click', () => this.close());
    head.append(titles, close);

    // Shelves and the basket, one tap apart
    const tabs = this.el('div', 'shop-tabs');
    for (const entry of service.sections) {
      const tab = this.el('button', section?.id === entry.id ? 'shop-tab shop-tab-on' : 'shop-tab', `${entry.icon} ${entry.name}`);
      tab.dataset.section = entry.id;
      tab.addEventListener('click', () => { this.view = { kind: 'shelf', sectionId: entry.id }; this.note = ''; this.renderSheet(); });
      tabs.appendChild(tab);
    }
    const basketTab = this.el('button', view.kind === 'basket' ? 'shop-tab shop-tab-on' : 'shop-tab', `🧺 Basket (${service.lines.length})`);
    basketTab.id = 'shop-tab-basket';
    basketTab.addEventListener('click', () => { this.view = { kind: 'basket' }; this.note = ''; this.renderSheet(); });
    tabs.appendChild(basketTab);

    const list = this.el('div', 'buka-menu-list');
    const waiting = service.busy || service.sale !== null;

    if (section) {
      for (const product of section.products) {
        const left = service.stockLeft(product.id);
        const row = this.el('button', left === 0 ? 'buka-dish buka-dish-short' : 'buka-dish');
        row.dataset.product = product.id;
        row.disabled = waiting;
        const text = this.el('span', 'buka-dish-text');
        text.append(
          this.el('span', 'buka-dish-name', product.name),
          this.el('span', 'buka-dish-desc', left === 0 ? 'Sold out' : `${product.description} ${left} on the shelf.`)
        );
        row.append(this.el('span', 'buka-dish-icon', product.icon), text, this.el('span', 'buka-dish-price', naira(product.price)));
        row.addEventListener('click', () => {
          const result = service.addToBasket(product.id);
          this.note = result.ok ? `Taking ${product.name} from the shelf…` : result.reason ?? 'That cannot go in the basket right now.';
          this.renderSheet();
        });
        list.appendChild(row);
      }
    } else if (service.lines.length === 0) {
      list.appendChild(this.el('div', 'shop-empty', 'Nothing in your basket yet. Pick a shelf above and take what you want.'));
    } else {
      for (const line of service.lines) {
        const row = this.el('button', 'buka-dish shop-line');
        row.dataset.line = String(line.uid);
        row.disabled = waiting;
        const text = this.el('span', 'buka-dish-text');
        text.append(this.el('span', 'buka-dish-name', line.product.name), this.el('span', 'buka-dish-desc', 'Tap to put it back on the shelf'));
        row.append(this.el('span', 'buka-dish-icon', line.product.icon), text, this.el('span', 'buka-dish-price', naira(line.product.price)));
        row.addEventListener('click', () => {
          const result = service.putBack(line.uid);
          this.note = result.ok ? `Putting the ${line.product.name} back…` : result.reason ?? 'That cannot be put back right now.';
          this.renderSheet();
        });
        list.appendChild(row);
      }
    }

    this.sheet.append(head, tabs, list);

    // Total and the two ways to pay
    if (service.lines.length > 0) {
      const total = this.el('div', 'shop-total');
      const label = this.el('span', 'shop-total-label', `${service.lines.length} item${service.lines.length === 1 ? '' : 's'} in your basket`);
      const amount = this.el('span', 'shop-total-amount', naira(service.total));
      amount.id = 'shop-total-amount';
      total.append(label, amount);

      const payRow = this.el('div', 'shop-pay-row');
      const methods: Array<[PayMethod, string, string]> = [['cash', 'shop-pay-cash', '💵 Pay cash'], ['card', 'shop-pay-card', '💳 Pay by card']];
      for (const [method, id, text] of methods) {
        const pay = this.el('button', 'shop-pay-btn', `${text} · ${naira(service.total)}`);
        pay.id = id;
        pay.disabled = waiting;
        pay.addEventListener('click', () => {
          const result = service.checkout(method);
          if (result.ok) {
            this.close();
          } else {
            this.note = result.reason ?? 'You cannot pay right now.';
            this.renderSheet();
          }
        });
        payRow.appendChild(pay);
      }
      this.sheet.append(total, payRow);
    }

    if (this.note) {
      const noteEl = this.el('div', 'buka-menu-note', this.note);
      noteEl.id = 'shop-sheet-note';
      noteEl.setAttribute('role', 'status');
      this.sheet.appendChild(noteEl);
    }
  }

  private renderStatus(): void {
    const service = this.service;
    const inside = UIStateManager.getInstance().isMode('interior');
    const sale = service.sale;
    const count = service.lines.length;
    if (!inside || (!sale && !service.receipt && count === 0 && !service.busy)) {
      this.status.style.display = 'none';
      return;
    }

    this.status.innerHTML = '';
    const text = this.el('span', 'buka-status-text');
    let icon = '🧺';
    let state = 'basket';

    if (sale) {
      icon = '🧾';
      state = sale.settled ? 'paid' : 'till';
      const line = sale.settled
        ? 'Paid. Here is your bag'
        : sale.scanned === 0
        ? 'Taking your basket to Bolanle'
        : sale.scanned < sale.count
        ? `Bolanle has rung up ${sale.scanned} of ${sale.count} · ${naira(sale.running)}`
        : `All rung up · ${sale.method === 'cash' ? 'paying cash' : 'paying by card'}`;
      text.append(this.el('span', 'buka-status-name', `At the till · ${naira(sale.total)}`), this.el('span', 'buka-status-line', line));
    } else if (service.receipt) {
      icon = '🛍️';
      state = 'receipt';
      const receipt = service.receipt;
      text.append(
        this.el('span', 'buka-status-name', `Paid ${naira(receipt.total)} ${receipt.method === 'cash' ? 'cash' : 'by card'}`),
        this.el('span', 'buka-status-line', `${receipt.count} item${receipt.count === 1 ? '' : 's'} in your bag`)
      );
    } else {
      text.append(
        this.el('span', 'buka-status-name', count === 0 ? 'Taking a basket' : `Basket · ${count} item${count === 1 ? '' : 's'}`),
        this.el('span', 'buka-status-line', count === 0 ? 'From the stack by the door' : `Comes to ${naira(service.total)} · not paid for yet`)
      );
    }

    this.status.dataset.state = state;
    this.status.append(this.el('span', 'buka-status-icon', icon), text);

    if (sale && !sale.settled) {
      const cancel = this.el('button', 'buka-status-btn', 'Cancel');
      cancel.id = 'shop-status-cancel';
      cancel.addEventListener('click', () => service.cancelCheckout());
      this.status.appendChild(cancel);
    } else if (!sale && !service.receipt && count > 0) {
      const basket = this.el('button', 'buka-status-btn', 'Basket & pay');
      basket.id = 'shop-status-basket';
      basket.addEventListener('click', () => this.openBasket());
      this.status.appendChild(basket);
    }
    this.status.style.display = 'flex';
  }
}
