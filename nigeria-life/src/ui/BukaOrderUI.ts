import type { BukaService } from '../interiors/buka/BukaService';
import { BUKA_MENU } from '../interiors/buka/BukaMenu';
import { BackendService } from '../backend/BackendService';
import { UIStateManager } from './UIStateManager';

const naira = (amount: number) => `₦${amount.toLocaleString()}`;

/**
 * The buka's two pieces of screen: the menu you order from, and a small status line that
 * says where your order has got to. What actually happens is shown in the room itself.
 */
export class BukaOrderUI {
  private readonly service: BukaService;
  private readonly sheet: HTMLDivElement;
  private readonly status: HTMLDivElement;
  private preferTable: number | undefined;
  private open_ = false;

  constructor(service: BukaService) {
    this.service = service;

    this.sheet = document.createElement('div');
    this.sheet.id = 'buka-menu';
    this.sheet.className = 'buka-menu';
    this.sheet.style.display = 'none';
    this.sheet.setAttribute('role', 'dialog');
    this.sheet.setAttribute('aria-label', 'Mama Put menu');
    document.body.appendChild(this.sheet);

    this.status = document.createElement('div');
    this.status.id = 'buka-order-status';
    this.status.className = 'buka-order-status';
    this.status.style.display = 'none';
    document.body.appendChild(this.status);

    const ui = UIStateManager.getInstance();
    ui.registerModal('buka-menu', { id: 'buka-menu', close: () => this.close(), isOpen: () => this.open_ });
    ui.onModeChange(() => this.renderStatus());
    service.onChange = () => this.renderStatus();
  }

  public get isOpen(): boolean {
    return this.open_;
  }

  /** Opens the menu. `preferTable` seats the customer at a particular table. */
  public open(preferTable?: number): void {
    this.preferTable = preferTable;
    this.open_ = true;
    this.renderMenu();
    this.sheet.style.display = 'flex';
    UIStateManager.getInstance().pushModal('buka-menu');
  }

  public close(): void {
    if (!this.open_) return;
    this.open_ = false;
    this.sheet.style.display = 'none';
    UIStateManager.getInstance().popModal('buka-menu');
  }

  private renderMenu(note = ''): void {
    const cash = BackendService.getInstance().getData().walletCash;
    this.sheet.innerHTML = '';

    const head = document.createElement('div');
    head.className = 'buka-menu-head';
    const titles = document.createElement('div');
    titles.className = 'buka-menu-titles';
    const title = document.createElement('span');
    title.className = 'buka-menu-title';
    title.textContent = 'Mama Put menu';
    const sub = document.createElement('span');
    sub.className = 'buka-menu-sub';
    sub.id = 'buka-menu-cash';
    sub.textContent = `You have ${naira(cash)} cash · You pay when the food reaches your table`;
    titles.append(title, sub);
    const close = document.createElement('button');
    close.className = 'buka-menu-close';
    close.id = 'buka-menu-close';
    close.setAttribute('aria-label', 'Close menu');
    close.textContent = '×';
    close.addEventListener('click', () => this.close());
    head.append(titles, close);

    const list = document.createElement('div');
    list.className = 'buka-menu-list';
    for (const dish of BUKA_MENU) {
      const short = cash < dish.price;
      const row = document.createElement('button');
      row.className = short ? 'buka-dish buka-dish-short' : 'buka-dish';
      row.dataset.dish = dish.id;

      const icon = document.createElement('span');
      icon.className = 'buka-dish-icon';
      icon.textContent = dish.icon;
      const text = document.createElement('span');
      text.className = 'buka-dish-text';
      const name = document.createElement('span');
      name.className = 'buka-dish-name';
      name.textContent = dish.name;
      const desc = document.createElement('span');
      desc.className = 'buka-dish-desc';
      desc.textContent = short ? `You need ${naira(dish.price - cash)} more` : dish.description;
      text.append(name, desc);
      const price = document.createElement('span');
      price.className = 'buka-dish-price';
      price.textContent = naira(dish.price);

      row.append(icon, text, price);
      row.addEventListener('click', () => {
        const result = this.service.placeOrder(dish.id, this.preferTable);
        if (result.ok) this.close();
        else this.renderMenu(result.reason ?? 'That cannot be ordered right now.');
      });
      list.appendChild(row);
    }

    this.sheet.append(head, list);
    if (note) {
      const noteEl = document.createElement('div');
      noteEl.className = 'buka-menu-note';
      noteEl.id = 'buka-menu-note';
      noteEl.setAttribute('role', 'alert');
      noteEl.textContent = note;
      this.sheet.appendChild(noteEl);
    }
  }

  private renderStatus(): void {
    const order = this.service.order;
    const progress = this.service.progress();
    const inside = UIStateManager.getInstance().isMode('interior');
    if (!order || !progress || !inside) {
      this.status.style.display = 'none';
      return;
    }

    const lines: Record<typeof progress, string> = {
      seating: 'Taking your seat…',
      cooking: 'Mama Nkechi is dishing it up',
      on_the_pass: 'Ready on the counter. Segun is collecting it',
      on_its_way: 'Segun is bringing it to your table',
      eating: `Eating · ${order.bitesLeft} of ${order.dish.bites} mouthfuls left`,
      finished: 'All finished. Plate clean!',
    };

    this.status.innerHTML = '';
    this.status.dataset.progress = progress;
    const icon = document.createElement('span');
    icon.className = 'buka-status-icon';
    icon.textContent = order.dish.icon;
    const text = document.createElement('span');
    text.className = 'buka-status-text';
    const name = document.createElement('span');
    name.className = 'buka-status-name';
    name.textContent = `${order.dish.name} · ${order.paid ? 'paid' : naira(order.dish.price)}`;
    const line = document.createElement('span');
    line.className = 'buka-status-line';
    line.textContent = lines[progress];
    text.append(name, line);
    this.status.append(icon, text);

    if (progress !== 'finished') {
      const stop = document.createElement('button');
      stop.className = 'buka-status-btn';
      stop.id = 'buka-order-stop';
      stop.textContent = order.paid ? 'Stand up' : 'Cancel order';
      stop.addEventListener('click', () => this.service.cancelOrder());
      this.status.appendChild(stop);
    }
    this.status.style.display = 'flex';
  }
}
