import { BackendService } from '../backend/BackendService';
import type { Actor } from '../interactions/Actor';
import { InteractionDirector } from '../interactions/InteractionDirector';
import { STREET_VENDORS, buyFromVendor, type StreetVendor } from '../world/StreetVendors';
import { UIStateManager } from './UIStateManager';

const naira = (amount: number) => `₦${amount.toLocaleString()}`;

/**
 * What a street seller has, as a short list. Picking something starts the hand-over in the
 * street; the list itself sells nothing.
 */
export class VendorUI {
  private readonly sheet: HTMLDivElement;
  private readonly getCustomer: () => Actor;
  private open_ = false;

  constructor(getCustomer: () => Actor) {
    this.getCustomer = getCustomer;
    this.sheet = document.createElement('div');
    this.sheet.id = 'vendor-sheet';
    this.sheet.className = 'buka-menu';
    this.sheet.style.display = 'none';
    this.sheet.setAttribute('role', 'dialog');
    this.sheet.setAttribute('aria-label', 'Street seller');
    document.body.appendChild(this.sheet);
    UIStateManager.getInstance().registerModal('vendor-sheet', { id: 'vendor-sheet', close: () => this.close(), isOpen: () => this.open_ });
  }

  public get isOpen(): boolean {
    return this.open_;
  }

  /** Is this clickable person someone who sells things? */
  public static sells(objectId: string): boolean {
    return objectId in STREET_VENDORS;
  }

  public open(objectId: string): void {
    const vendor = STREET_VENDORS[objectId];
    const person = InteractionDirector.get().actorFor(objectId);
    if (!vendor || !person) return;
    this.open_ = true;
    this.render(vendor, person);
    this.sheet.style.display = 'flex';
    UIStateManager.getInstance().pushModal('vendor-sheet');
  }

  public close(): void {
    if (!this.open_) return;
    this.open_ = false;
    this.sheet.style.display = 'none';
    UIStateManager.getInstance().popModal('vendor-sheet');
  }

  private render(vendor: StreetVendor, person: Actor, note = ''): void {
    const cash = BackendService.getInstance().getData().walletCash;
    this.sheet.innerHTML = '';

    const head = document.createElement('div');
    head.className = 'buka-menu-head';
    const titles = document.createElement('div');
    titles.className = 'buka-menu-titles';
    const title = document.createElement('span');
    title.className = 'buka-menu-title';
    title.textContent = `${vendor.name} · ${vendor.stall}`;
    const sub = document.createElement('span');
    sub.className = 'buka-menu-sub';
    sub.textContent = `You have ${naira(cash)} cash · You pay as it is handed to you`;
    titles.append(title, sub);
    const close = document.createElement('button');
    close.className = 'buka-menu-close';
    close.id = 'vendor-sheet-close';
    close.setAttribute('aria-label', 'Close');
    close.textContent = '×';
    close.addEventListener('click', () => this.close());
    head.append(titles, close);

    const list = document.createElement('div');
    list.className = 'buka-menu-list';
    for (const entry of vendor.goods) {
      const short = cash < entry.price;
      const row = document.createElement('button');
      row.className = short ? 'buka-dish buka-dish-short' : 'buka-dish';
      row.dataset.good = entry.id;
      const icon = document.createElement('span');
      icon.className = 'buka-dish-icon';
      icon.textContent = entry.icon;
      const text = document.createElement('span');
      text.className = 'buka-dish-text';
      const name = document.createElement('span');
      name.className = 'buka-dish-name';
      name.textContent = entry.name;
      const desc = document.createElement('span');
      desc.className = 'buka-dish-desc';
      desc.textContent = short ? `You need ${naira(entry.price - cash)} more` : entry.description;
      text.append(name, desc);
      const price = document.createElement('span');
      price.className = 'buka-dish-price';
      price.textContent = naira(entry.price);
      row.append(icon, text, price);
      row.addEventListener('click', () => {
        const result = buyFromVendor(person, this.getCustomer(), entry);
        if (result.ok) this.close();
        else this.render(vendor, person, result.reason && result.reason !== 'busy' ? result.reason : 'Finish what you are doing first.');
      });
      list.appendChild(row);
    }

    this.sheet.append(head, list);
    if (note) {
      const noteEl = document.createElement('div');
      noteEl.className = 'buka-menu-note';
      noteEl.id = 'vendor-sheet-note';
      noteEl.setAttribute('role', 'alert');
      noteEl.textContent = note;
      this.sheet.appendChild(noteEl);
    }
  }
}
