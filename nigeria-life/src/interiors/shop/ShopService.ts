import * as THREE from 'three';
import { RENDER_LAYERS } from '../InteriorTypes';
import type { Actor } from '../../interactions/Actor';
import { InteractionDirector } from '../../interactions/InteractionDirector';
import { NavGrid } from '../../interactions/NavGrid';
import { Sequence, steps, type EndReason } from '../../interactions/Sequence';
import { BackendService } from '../../backend/BackendService';
import { SoundEngine } from '../../audio/SoundEngine';
import { showGameToast } from '../../ui/GameToast';
import { type Product, type ShelfSectionDef, SHOP_SECTIONS, findProduct, sectionOf } from './ShopCatalog';
import {
  type Basket, type CheckoutCounter, type ShelfUnit,
  createBasket, createBasketStack, createCheckoutCounter, createProductMesh, createShelfUnit, createShoppingBag,
  BASKET_LIMIT, COUNTER, SHELF,
} from './ShopProps';

/** Layout of the shop floor, relative to the room centre. */
export const SHOP = {
  room: { width: 18, length: 16, height: 4.5 },
  shelves: {
    drinks: new THREE.Vector3(-4.3, 0, -7.25),
    food: new THREE.Vector3(4.3, 0, -7.25),
    snacks: new THREE.Vector3(-4.3, 0, -1.6),
    household: new THREE.Vector3(4.3, 0, -1.6),
  } as Record<string, THREE.Vector3>,
  baskets: { position: new THREE.Vector3(-4, 0, 6.8), stand: new THREE.Vector3(-4, 0, 5.7) },
  till: {
    position: new THREE.Vector3(5, 0, 4.2),
    customer: new THREE.Vector3(4.3, 0, 5.45),
    cashier: new THREE.Vector3(5, 0, 3.05),
    /** Along the counter top: where the basket is put down, where scanned things go, where the bag stands */
    basket: new THREE.Vector3(3.9, COUNTER.height, 4.2),
    scanned: new THREE.Vector3(4.8, COUNTER.height, 4.1),
    bag: new THREE.Vector3(5.3, COUNTER.height, 4.35),
  },
};

const naira = (amount: number) => `₦${amount.toLocaleString()}`;

export type PayMethod = 'cash' | 'card';

/** One thing in the basket. It is not the player's until the sale is settled. */
export interface BasketLine {
  uid: number;
  product: Product;
  mesh: THREE.Mesh;
  /** The unit on the shelf this one stands for; it reappears if the thing is put back */
  shelfUnit: THREE.Mesh;
}

/** A trip to the till, from putting the basket down to walking away with the bag. */
export interface Sale {
  method: PayMethod;
  total: number;
  count: number;
  scanned: number;
  running: number;
  /** Money taken and goods handed over. Both happen together, once. */
  settled: boolean;
  short: boolean;
  sequence: Sequence | null;
}

export interface ShopResult {
  ok: boolean;
  reason?: string;
}

export interface Receipt {
  total: number;
  count: number;
  method: PayMethod;
}

/**
 * Runs Everyday Supermarket: taking things off the shelves into a basket, putting them back,
 * and the till, where the cashier rings each thing up, bags it and hands the bag over.
 * Nothing in the basket belongs to the player. Money and goods change hands in one moment,
 * when the bag is handed over, and that moment can only happen once per sale.
 */
export class ShopService {
  public readonly nav: NavGrid;
  /** Where everything stands, for anything that needs to find its way around the shop */
  public readonly layout = SHOP;
  public lines: BasketLine[] = [];
  public sale: Sale | null = null;
  /** The last completed sale, shown for a few seconds */
  public receipt: Receipt | null = null;
  /** Called whenever the basket or the sale changes, so the screen can follow */
  public onChange: (() => void) | null = null;

  private readonly group: THREE.Group;
  private readonly origin: THREE.Vector3;
  private readonly director = InteractionDirector.get();
  private readonly backend = BackendService.getInstance();
  private readonly shelves = new Map<string, { unit: ShelfUnit; position: THREE.Vector3; stand: THREE.Vector3 }>();
  private readonly counter: CheckoutCounter;
  private cashier!: Actor;
  private basket: Basket | null = null;
  private bagOnCounter: THREE.Group | null = null;
  private bagInHand: THREE.Group | null = null;
  private picking = false;
  private leaving = false;
  private nextUid = 1;
  private receiptTimer = 0;

  constructor(group: THREE.Group, origin: THREE.Vector3) {
    this.group = group;
    this.origin = origin.clone();
    this.nav = new NavGrid(origin, SHOP.room.width, SHOP.room.length);

    for (const section of SHOP_SECTIONS) {
      const position = SHOP.shelves[section.id];
      const unit = createShelfUnit(section, section.id === 'drinks');
      unit.group.position.copy(position);
      this.group.add(unit.group);
      this.nav.blockRect(position.x, position.z, SHELF.width / 2, SHELF.depth / 2);
      this.shelves.set(section.id, {
        unit,
        position,
        stand: new THREE.Vector3(position.x, 0, position.z + SHELF.depth / 2 + 0.8),
      });
    }

    const stack = createBasketStack();
    stack.position.copy(SHOP.baskets.position);
    this.group.add(stack);
    this.nav.blockRect(SHOP.baskets.position.x, SHOP.baskets.position.z, 0.3, 0.22);

    this.counter = createCheckoutCounter();
    this.counter.group.position.copy(SHOP.till.position);
    this.group.add(this.counter.group);
    this.nav.blockRect(SHOP.till.position.x, SHOP.till.position.z, COUNTER.width / 2, COUNTER.depth / 2);
  }

  public setStaff(cashier: Actor): void {
    this.cashier = cashier;
  }

  public shelfMesh(sectionId: string): THREE.Group {
    return this.shelves.get(sectionId)!.unit.group;
  }

  public shelfStand(sectionId: string): THREE.Vector3 {
    return this.world(this.shelves.get(sectionId)!.stand);
  }

  public get counterMesh(): THREE.Group {
    return this.counter.group;
  }

  private world(local: THREE.Vector3): THREE.Vector3 {
    return new THREE.Vector3(this.origin.x + local.x, 0, this.origin.z + local.z);
  }

  private setLayer(object: THREE.Object3D, mask: number): void {
    object.traverse((child) => { child.layers.mask = mask; });
  }

  private toRoom(object: THREE.Object3D, local: THREE.Vector3): void {
    this.group.add(object);
    object.position.copy(local);
    object.rotation.set(0, 0, 0);
    object.traverse((child) => child.layers.set(RENDER_LAYERS.INTERIOR));
  }

  private changed(): void {
    this.onChange?.();
  }

  // --- What the screen asks ----------------------------------------------------------------

  public get sections(): ShelfSectionDef[] {
    return SHOP_SECTIONS;
  }

  public get total(): number {
    return this.lines.reduce((sum, line) => sum + line.product.price, 0);
  }

  /** In the middle of taking something or putting it back. */
  public get busy(): boolean {
    return this.picking;
  }

  public stockLeft(productId: string): number {
    const section = sectionOf(productId);
    const units = section ? this.shelves.get(section.id)?.unit.stock.get(productId) : undefined;
    return units ? units.filter((unit) => unit.visible).length : 0;
  }

  public funds(method: PayMethod): number {
    const data = this.backend.getData();
    return method === 'cash' ? data.walletCash : data.bank.balance;
  }

  /** Why this cannot go in the basket right now, or null if it can. */
  public cannotAdd(product: Product): string | null {
    if (this.sale) return 'You are at the till. Finish paying, or cancel, first.';
    if (this.picking) return 'One thing at a time.';
    if (this.lines.length >= BASKET_LIMIT) return `Your basket is full (${BASKET_LIMIT} things). Pay for these first.`;
    if (this.stockLeft(product.id) === 0) return `${product.name} has sold out.`;
    return null;
  }

  /** Why the basket cannot be paid for this way right now, or null if it can. */
  public cannotPay(method: PayMethod): string | null {
    if (this.sale) return 'You are already at the till.';
    if (this.picking) return 'Finish what you are doing first.';
    if (this.lines.length === 0) return 'Your basket is empty. Take something from the shelves first.';
    const have = this.funds(method);
    if (have < this.total) {
      const where = method === 'cash' ? 'cash on you' : 'in your bank account';
      return `Your shopping comes to ${naira(this.total)} and you have ${naira(have)} ${where}. Put something back or pay another way.`;
    }
    return null;
  }

  // --- Shelves -----------------------------------------------------------------------------

  /**
   * Take one of something off its shelf and put it in the basket. The first time, the player
   * fetches a basket from the stack by the door. Nothing is added unless the hand reaches the shelf.
   */
  public addToBasket(productId: string): ShopResult {
    const product = findProduct(productId);
    const section = product ? sectionOf(product.id) : null;
    const shelf = section ? this.shelves.get(section.id) : null;
    const player = this.director.player;
    if (!product || !shelf || !player) return { ok: false, reason: 'The shop does not stock that.' };
    const blocked = this.cannotAdd(product);
    if (blocked) return { ok: false, reason: blocked };
    if (this.director.interrupt(player) === 'locked') return { ok: false, reason: 'Finish what you are doing first.' };
    this.putBagAway();

    const take = new Sequence(`shop: take ${product.id}`, [player]);
    if (!this.basket) {
      take.add(
        steps.walk(player, this.world(SHOP.baskets.stand), { nav: this.nav, speed: 5 }),
        steps.face(player, this.world(SHOP.baskets.position)),
        steps.animate(player, { arms: 'reach' }, 0.6, [{ at: 0.55, run: () => this.takeBasket(player) }])
      );
    }
    take.add(
      steps.walk(player, this.world(shelf.stand), { nav: this.nav, speed: 5 }),
      steps.face(player, this.world(shelf.position)),
      steps.animate(player, { arms: 'reach' }, 0.7, [{ at: 0.55, run: () => this.takeFromShelf(product) }])
    );
    take.onEnd(() => {
      this.picking = false;
      this.changed();
    });
    this.picking = true;
    if (!this.director.run(take)) {
      this.picking = false;
      return { ok: false, reason: 'Finish what you are doing first.' };
    }
    this.changed();
    return { ok: true };
  }

  private takeBasket(player: Actor): void {
    if (this.basket) return;
    this.basket = createBasket();
    player.carry(this.basket.group);
  }

  private takeFromShelf(product: Product): boolean {
    const section = sectionOf(product.id);
    const units = section ? this.shelves.get(section.id)?.unit.stock.get(product.id) : undefined;
    const unit = units?.find((entry) => entry.visible);
    if (!unit || !this.basket || this.lines.length >= BASKET_LIMIT) return false;
    unit.visible = false;
    const mesh = createProductMesh(product);
    this.basket.group.add(mesh);
    this.lines.push({ uid: this.nextUid++, product, mesh, shelfUnit: unit });
    this.repack();
    this.changed();
    return true;
  }

  /** Lays the basket's contents out in its slots, in order. */
  private repack(): void {
    if (!this.basket) return;
    const mask = this.basket.group.layers.mask;
    this.lines.forEach((line, index) => {
      if (line.mesh.parent !== this.basket!.group) this.basket!.group.add(line.mesh);
      const slot = this.basket!.slot(index);
      line.mesh.position.set(slot.x, slot.y + (line.mesh.userData.height as number) / 2, slot.z);
      line.mesh.rotation.set(0, 0, 0);
      line.mesh.visible = true;
      line.mesh.layers.mask = mask;
    });
  }

  /** Walk back to the shelf and put one thing back. */
  public putBack(uid: number): ShopResult {
    const line = this.lines.find((entry) => entry.uid === uid);
    const section = line ? sectionOf(line.product.id) : null;
    const shelf = section ? this.shelves.get(section.id) : null;
    const player = this.director.player;
    if (!line || !shelf || !player) return { ok: false, reason: 'That is not in your basket.' };
    if (this.sale) return { ok: false, reason: 'You are at the till. Cancel first if you want to change your basket.' };
    if (this.picking) return { ok: false, reason: 'One thing at a time.' };
    if (this.director.interrupt(player) === 'locked') return { ok: false, reason: 'Finish what you are doing first.' };

    const back = new Sequence(`shop: put back ${line.product.id}`, [player]).add(
      steps.walk(player, this.world(shelf.stand), { nav: this.nav, speed: 5 }),
      steps.face(player, this.world(shelf.position)),
      steps.animate(player, { arms: 'reach' }, 0.7, [{
        at: 0.55,
        run: () => {
          const index = this.lines.indexOf(line);
          if (index === -1) return false;
          this.lines.splice(index, 1);
          line.mesh.removeFromParent();
          line.shelfUnit.visible = true;
          this.repack();
          this.changed();
        },
      }])
    );
    back.onEnd(() => {
      this.picking = false;
      this.changed();
    });
    this.picking = true;
    if (!this.director.run(back)) {
      this.picking = false;
      return { ok: false, reason: 'Finish what you are doing first.' };
    }
    this.changed();
    return { ok: true };
  }

  // --- The till ----------------------------------------------------------------------------

  /**
   * Take the basket to the till. The cashier rings up each thing, says the total, bags it and
   * hands the bag over; the money is taken and the goods become the player's at that hand-over.
   * Walking away at any point before it leaves everything unpaid and still in the basket.
   */
  public checkout(method: PayMethod): ShopResult {
    const player = this.director.player;
    if (!player || !this.cashier || !this.basket) return { ok: false, reason: this.cannotPay(method) ?? 'The till is closed.' };
    const blocked = this.cannotPay(method);
    if (blocked) return { ok: false, reason: blocked };
    if (this.director.interrupt(player) === 'locked') return { ok: false, reason: 'Finish what you are doing first.' };
    if (!this.director.reserve('shop:till', player)) return { ok: false, reason: 'Someone is at the till. Give them a moment.' };
    this.putBagAway();

    const sale: Sale = { method, total: this.total, count: this.lines.length, scanned: 0, running: 0, settled: false, short: false, sequence: null };
    const lines = [...this.lines];
    const till = SHOP.till;
    const cashier = this.cashier;

    const sequence = new Sequence('shop: checkout', [player, cashier]);
    sequence.closeUp = true;
    sequence.add(
      steps.walk(player, this.world(till.customer), { nav: this.nav, speed: 5 }),
      steps.face(player, this.world(till.cashier)),
      steps.animate(player, { arms: 'reach' }, 0.7, [{ at: 0.55, run: () => this.basketToCounter(player) }]),
      steps.call('greet', () => cashier.say('Welcome! Let me ring these up.')),
      steps.face(cashier, this.world(till.basket)),
      ...lines.map((line, index) =>
        steps.animate(cashier, { arms: 'reach' }, 0.6, [{ at: 0.5, run: () => this.scan(sale, line, index) }])
      ),
      steps.face(cashier, () => player.worldPosition()),
      steps.call('total', () => cashier.say(`That is ${naira(sale.total)}.`)),
      steps.wait(0.5),
      // The customer offers the money: the last check that it is still there
      steps.animate(player, { arms: 'reach' }, 0.7, [{ at: 0.5, run: () => this.offerPayment(sale) }]),
      steps.face(cashier, this.world(till.bag)),
      steps.animate(cashier, { arms: 'reach' }, 0.8, [{ at: 0.5, run: () => this.packBag(sale, lines) }]),
      steps.face(cashier, () => player.worldPosition()),
      steps.animate(cashier, { arms: 'reach' }, 0.7, [{ at: 0.55, run: () => this.handOver(sale, lines, player) }]),
      steps.call('thanks', () => cashier.say('Thank you! Come again.')),
      steps.wait(0.5)
    );
    sale.sequence = sequence;
    sequence.onEnd((reason) => this.endSale(sale, reason));
    this.sale = sale;
    if (!this.director.run(sequence)) {
      this.sale = null;
      this.director.release('shop:till', player);
      return { ok: false, reason: 'Finish what you are doing first.' };
    }
    this.changed();
    return { ok: true };
  }

  /** Step away from the till before paying. Nothing has been charged. */
  public cancelCheckout(): void {
    if (this.sale && !this.sale.settled) this.sale.sequence?.cancel();
  }

  private basketToCounter(player: Actor): boolean {
    if (!this.basket) return false;
    if (player.carried === this.basket.group) player.letGo();
    this.toRoom(this.basket.group, SHOP.till.basket);
    return true;
  }

  private scan(sale: Sale, line: BasketLine, index: number): boolean {
    if (this.sale !== sale) return false;
    const spot = SHOP.till.scanned;
    this.toRoom(line.mesh, new THREE.Vector3(
      spot.x + (index % 4) * 0.17 - 0.25,
      spot.y + (line.mesh.userData.height as number) / 2,
      spot.z - Math.floor(index / 4) * 0.2
    ));
    sale.scanned += 1;
    sale.running += line.product.price;
    this.counter.setDisplay(naira(sale.running));
    SoundEngine.getInstance().playClickSound();
    this.changed();
    return true;
  }

  private offerPayment(sale: Sale): boolean {
    if (this.sale !== sale) return false;
    if (this.funds(sale.method) < sale.total) {
      sale.short = true;
      this.cashier.say('Ah! The money no complete.');
      return false;
    }
    return true;
  }

  private packBag(sale: Sale, lines: BasketLine[]): boolean {
    if (this.sale !== sale) return false;
    this.bagOnCounter = createShoppingBag();
    this.toRoom(this.bagOnCounter, SHOP.till.bag);
    for (const line of lines) line.mesh.visible = false;
    return true;
  }

  /**
   * The bag changes hands. This is the sale: the money is taken, and what was in the basket
   * goes into the player's bag. If the money is not there, neither happens.
   */
  private handOver(sale: Sale, lines: BasketLine[], player: Actor): boolean {
    if (this.sale !== sale || sale.settled) return false;
    const description = `Everyday Supermarket: ${sale.count} item${sale.count === 1 ? '' : 's'}`;
    const paid = sale.method === 'cash'
      ? this.backend.spendCash(sale.total, description, 'SHOP_PURCHASE')
      : this.backend.processTransaction({ type: 'SHOP_PURCHASE', amount: sale.total, description, source: 'bank', funding: 'strict' }).success;
    if (!paid) {
      sale.short = true;
      this.cashier.say('Ah! The money no complete.');
      return false;
    }
    sale.settled = true;

    const counts = new Map<Product, number>();
    for (const line of lines) counts.set(line.product, (counts.get(line.product) ?? 0) + 1);
    for (const [product, count] of counts) this.backend.addItem(product.item, count);

    for (const line of lines) line.mesh.removeFromParent();
    this.lines = this.lines.filter((line) => !lines.includes(line));
    this.basket?.group.removeFromParent();
    this.basket = null;

    // The bag goes from the counter into the player's hand
    const bag = this.bagOnCounter ?? createShoppingBag();
    this.bagOnCounter = null;
    player.root.add(bag);
    bag.position.set(0.36, 0.42, 0.08);
    bag.rotation.set(0, 0, 0);
    this.setLayer(bag, player.root.layers.mask);
    this.bagInHand = bag;

    this.receipt = { total: sale.total, count: sale.count, method: sale.method };
    this.receiptTimer = 6;
    this.counter.setDisplay('PAID');
    SoundEngine.getInstance().playTransactionSuccess();
    showGameToast(
      `Paid ${naira(sale.total)} ${sale.method === 'cash' ? 'in cash' : 'by card'}. ${sale.count} item${sale.count === 1 ? ' is' : 's are'} in your bag.`,
      'success',
      3600
    );
    this.changed();
    return true;
  }

  /** The trip to the till is over, one way or the other. */
  private endSale(sale: Sale, reason: EndReason): void {
    if (this.sale !== sale) return;
    this.sale = null;
    const player = this.director.player;
    if (player) this.director.release('shop:till', player);

    if (!sale.settled) {
      // Nothing was charged: whatever reached the counter goes back in the basket
      this.bagOnCounter?.removeFromParent();
      this.bagOnCounter = null;
      this.counter.setDisplay('WELCOME');
      if (!this.leaving && this.basket && player) {
        player.carry(this.basket.group);
        this.repack();
        if (sale.short) {
          showGameToast(`You could not pay ${naira(sale.total)}, so nothing was charged. Put something back or pay another way.`, 'warning', 4600);
        } else if (reason === 'cancelled') {
          showGameToast('You stepped away from the till. Nothing was charged.', 'info', 3200);
        } else {
          showGameToast('The till could not finish your sale. Nothing was charged.', 'warning', 3600);
        }
      }
    }

    if (!this.leaving && this.cashier && !this.cashier.busy) {
      this.director.run(new Sequence('cashier back to the till', [this.cashier]).asCasual().add(steps.face(this.cashier, this.cashier.homeYaw)));
    }
    this.changed();
  }

  /** The carrier bag goes into the backpack: its contents are already in the inventory. */
  private putBagAway(): void {
    this.bagInHand?.removeFromParent();
    this.bagInHand = null;
  }

  // --- Each frame --------------------------------------------------------------------------

  public update(delta: number): void {
    if (this.receipt) {
      this.receiptTimer -= delta;
      if (this.receiptTimer <= 0) {
        this.receipt = null;
        this.counter.setDisplay('WELCOME');
        this.changed();
      }
    }
  }

  // --- Coming and going --------------------------------------------------------------------

  public playerEntered(): void {
    this.counter.setDisplay('WELCOME');
    this.changed();
  }

  /**
   * The player has left the shop. An unpaid basket stays behind: everything in it goes back
   * on the shelves and nothing is charged or kept.
   */
  public playerLeft(): void {
    this.leaving = true;
    const hadUnpaid = this.lines.length > 0;
    this.sale?.sequence?.cancel();
    this.sale = null;
    this.leaving = false;
    this.picking = false;

    for (const line of this.lines) {
      line.mesh.removeFromParent();
      line.shelfUnit.visible = true;
    }
    this.lines = [];
    const player = this.director.player;
    if (player) {
      if (this.basket && player.carried === this.basket.group) player.letGo();
      this.director.release('shop:till', player);
    }
    this.basket?.group.removeFromParent();
    this.basket = null;
    this.bagOnCounter?.removeFromParent();
    this.bagOnCounter = null;
    this.putBagAway();
    this.receipt = null;

    // Shelves are full again for the next visit
    for (const shelf of this.shelves.values()) {
      for (const units of shelf.unit.stock.values()) units.forEach((unit) => { unit.visible = true; });
    }
    if (this.cashier) {
      this.director.forceFree(this.cashier);
      this.cashier.yaw = this.cashier.homeYaw;
    }
    this.counter.setDisplay('WELCOME');
    if (hadUnpaid) showGameToast('You left your basket behind. Nothing was charged.', 'info', 3200);
    this.changed();
  }
}
