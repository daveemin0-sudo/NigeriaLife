import { BackendService } from '../../backend/BackendService';
import type { Item } from '../../backend/types';
import { SHOP_SECTIONS } from '../../interiors/shop/ShopCatalog';
import { SoundEngine } from '../../audio/SoundEngine';
import { showGameToast } from '../../ui/GameToast';

/** Something that can be ordered to wherever the player is. */
export interface Deliverable {
  id: string;
  name: string;
  icon: string;
  description: string;
  price: number;
  group: string;
  item: Omit<Item, 'quantity'>;
}

export type Shop = 'food' | 'market';

export interface Order {
  shop: Shop;
  lines: Array<{ thing: Deliverable; quantity: number }>;
  goods: number;
  fee: number;
  total: number;
  /** Seconds until the rider arrives */
  eta: number;
  seconds: number;
}

export interface OrderResult {
  ok: boolean;
  reason?: string;
}

const FEES: Record<Shop, number> = { food: 400, market: 600 };
const RIDER_SECONDS: Record<Shop, number> = { food: 18, market: 26 };
export const BASKET_LIMIT = 10;

function meal(id: string, name: string, icon: string, price: number, energy: number, description: string): Deliverable {
  return {
    id, name, icon, description, price, group: 'Hot food',
    item: { id: `meal_${id}`, name, category: 'food', icon, description, price, usable: true, energyRestore: energy },
  };
}

/** QuickChop's kitchen: cooked food, packed to eat when the player chooses. */
const MEALS: Deliverable[] = [
  meal('jollof_pack', 'Party jollof & plantain, packed', '🍛', 4500, 46, 'Smoky jollof with fried plantain and chicken, in a takeaway pack.'),
  meal('suya_pack', 'Beef suya & chapman', '🥩', 3800, 40, 'Peppered beef suya, onions and a cold chapman.'),
  meal('pepper_soup', 'Catfish pepper soup', '🐟', 5500, 50, 'Fresh catfish in hot pepper soup, sealed in a bowl.'),
  meal('moimoi_pap', 'Moi moi & pap', '🥣', 2200, 30, 'Steamed bean pudding with warm pap.'),
  meal('shawarma', 'Chicken shawarma', '🌯', 3000, 34, 'Grilled chicken, cabbage and cream in a toasted wrap.'),
];

/** What Everyday Supermarket will send round: the same shelves as the shop on Broad Street. */
const GROCERIES: Deliverable[] = SHOP_SECTIONS.flatMap((section) =>
  section.products.map((product) => ({
    id: product.id,
    name: product.name,
    icon: product.icon,
    description: product.description,
    price: product.price,
    group: section.name,
    item: product.item,
  }))
);

/**
 * Ordering things to be brought to the player. There is one order at a time. Nothing is
 * charged when it is placed: the player pays the rider on arrival, and gets the goods in the
 * same moment, once. If the money is not there then, the rider takes everything back.
 */
export class DeliveryService {
  public order: Order | null = null;
  public basket: Record<Shop, Map<string, number>> = { food: new Map(), market: new Map() };
  public onChange: (() => void) | null = null;
  private readonly backend = BackendService.getInstance();
  private inTransit: () => boolean = () => false;

  /** Riders do not chase a player who is in a cab or on a flight; they wait until the journey ends. */
  public connect(inTransit: () => boolean): void {
    this.inTransit = inTransit;
  }

  public catalogue(shop: Shop): Deliverable[] {
    return shop === 'food' ? MEALS : GROCERIES;
  }

  public fee(shop: Shop): number {
    return FEES[shop];
  }

  private find(shop: Shop, id: string): Deliverable | null {
    return this.catalogue(shop).find((entry) => entry.id === id) ?? null;
  }

  public basketLines(shop: Shop): Array<{ thing: Deliverable; quantity: number }> {
    const lines: Array<{ thing: Deliverable; quantity: number }> = [];
    for (const [id, quantity] of this.basket[shop]) {
      const thing = this.find(shop, id);
      if (thing && quantity > 0) lines.push({ thing, quantity });
    }
    return lines;
  }

  public basketCount(shop: Shop): number {
    let count = 0;
    for (const quantity of this.basket[shop].values()) count += quantity;
    return count;
  }

  public basketTotal(shop: Shop): number {
    return this.basketLines(shop).reduce((sum, line) => sum + line.thing.price * line.quantity, 0);
  }

  public funds(): number {
    const data = this.backend.getData();
    return data.walletCash + data.bank.balance;
  }

  public add(shop: Shop, id: string): OrderResult {
    if (!this.find(shop, id)) return { ok: false, reason: 'That is not on sale.' };
    if (this.basketCount(shop) >= BASKET_LIMIT) return { ok: false, reason: `One rider carries ${BASKET_LIMIT} things at most.` };
    this.basket[shop].set(id, (this.basket[shop].get(id) ?? 0) + 1);
    this.changed();
    return { ok: true };
  }

  public remove(shop: Shop, id: string): void {
    const left = (this.basket[shop].get(id) ?? 0) - 1;
    if (left > 0) this.basket[shop].set(id, left);
    else this.basket[shop].delete(id);
    this.changed();
  }

  /** Why this basket cannot be ordered right now, or null if it can. */
  public cannotOrder(shop: Shop): string | null {
    if (this.order) return 'A rider is already on the way with an order. Wait for it, or cancel it.';
    if (this.basketCount(shop) === 0) return 'Your basket is empty.';
    const total = this.basketTotal(shop) + FEES[shop];
    if (this.funds() < total) {
      return `That comes to ₦${total.toLocaleString()} with delivery, and you have ₦${this.funds().toLocaleString()} in all.`;
    }
    return null;
  }

  /** Sends the basket off. Nothing is charged yet. */
  public place(shop: Shop): OrderResult {
    const blocked = this.cannotOrder(shop);
    if (blocked) return { ok: false, reason: blocked };
    const lines = this.basketLines(shop);
    const goods = this.basketTotal(shop);
    this.order = { shop, lines, goods, fee: FEES[shop], total: goods + FEES[shop], eta: RIDER_SECONDS[shop], seconds: RIDER_SECONDS[shop] };
    this.basket[shop] = new Map();
    this.changed();
    return { ok: true };
  }

  /** Calls the rider back. Nothing was charged. */
  public cancel(): OrderResult {
    if (!this.order) return { ok: false, reason: 'There is no order to cancel.' };
    this.order = null;
    this.changed();
    return { ok: true };
  }

  public update(delta: number): void {
    const order = this.order;
    if (!order) return;
    if (order.eta <= 0 && this.inTransit()) return;

    const before = Math.ceil(order.eta);
    order.eta -= delta;
    if (order.eta > 0) {
      if (Math.ceil(order.eta) !== before) this.changed();
      return;
    }
    if (this.inTransit()) return;

    // The rider is here: money for goods, in one go
    this.order = null;
    const from = order.shop === 'food' ? 'QuickChop' : 'Everyday Supermarket';
    const paid = this.backend.pay(order.total, `${from} delivery`, order.shop === 'food' ? 'FOOD_PURCHASE' : 'SHOP_PURCHASE');
    if (!paid) {
      showGameToast(`The rider arrived, but you could not pay ₦${order.total.toLocaleString()}. The order went back and nothing was charged.`, 'warning', 5000);
      this.changed();
      return;
    }
    let count = 0;
    for (const line of order.lines) {
      this.backend.addItem(line.thing.item, line.quantity);
      count += line.quantity;
    }
    SoundEngine.getInstance().playTransactionSuccess();
    showGameToast(`Your ${from} rider has arrived. Paid ₦${order.total.toLocaleString()}; ${count} item${count === 1 ? ' is' : 's are'} in your bag.`, 'success', 4600);
    this.changed();
  }

  private changed(): void {
    this.onChange?.();
  }
}
