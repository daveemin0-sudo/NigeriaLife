import * as THREE from 'three';
import { RENDER_LAYERS, type InteriorNPCDef } from '../InteriorTypes';
import { InteriorNPCMesh } from '../InteriorNPCMesh';
import type { Actor } from '../../interactions/Actor';
import { InteractionDirector } from '../../interactions/InteractionDirector';
import { NavGrid } from '../../interactions/NavGrid';
import { Sequence, steps } from '../../interactions/Sequence';
import { BackendService } from '../../backend/BackendService';
import { emitGameEvent } from '../../game/GameEvents';
import { showGameToast } from '../../ui/GameToast';
import { type Dish, findDish } from './BukaMenu';
import {
  type Meal, createMeal, createBukaTable, createPassTable,
  TABLE_RADIUS, TABLE_TOP, CHAIR_DISTANCE,
} from './BukaProps';

/** Layout of the dining room, relative to the room centre. */
const TABLES = [new THREE.Vector3(4, 0, 2), new THREE.Vector3(4, 0, -4), new THREE.Vector3(-4, 0, 4)];
const COUNTER = { x: -4, z: -5, halfWidth: 2.4, halfLength: 0.7 };
const STOVE = { x: -4, z: -8.5, halfWidth: 1.8, halfLength: 0.7 };
const PASS = new THREE.Vector3(-0.9, 0, -5);
export const COUNTER_FRONT = new THREE.Vector3(-4, 0, -3.4);
export const WAITER_POST = new THREE.Vector3(1.0, 0, -2.4);
export const COOK_POST = new THREE.Vector3(-4, 0, -6.6);

const BITE_SECONDS = 1.7;

interface Seat {
  id: string;
  table: number;
  /** Where the sitter is, where they stand before sitting, and which way they face */
  chair: THREE.Vector3;
  stand: THREE.Vector3;
  yaw: number;
  /** Where their plate goes, and where the waiter stands to put it there */
  plate: THREE.Vector3;
  service: THREE.Vector3;
}

export type OrderStage = 'going_to_seat' | 'waiting' | 'eating' | 'finished';

export interface BukaOrder {
  dish: Dish;
  seat: Seat;
  stage: OrderStage;
  paid: boolean;
  bitesLeft: number;
  meal: Meal | null;
  /** The plate is sitting on the pass, ready for the waiter */
  ready: boolean;
}

/** Who the customer is waiting on, for the on-screen order status. */
export type OrderProgress = 'seating' | 'cooking' | 'on_the_pass' | 'on_its_way' | 'eating' | 'finished';

export interface OrderResult {
  ok: boolean;
  reason?: string;
}

interface Diner {
  npc: InteriorNPCMesh;
  seat: Seat;
  meal: Meal;
  /** Seconds until they switch between eating and resting */
  timer: number;
}

/**
 * Runs the buka's table service: taking an order, seating the customer, the cook plating up,
 * the waiter carrying the plate over, eating, paying and clearing away. Every step is a
 * visible action built from the shared interaction steps; this class only decides what
 * happens next and keeps the order honest (charged once, and only when the food arrives).
 */
export class BukaService {
  public readonly nav: NavGrid;
  public order: BukaOrder | null = null;
  /** Called whenever the order changes, so the screen can show where things stand */
  public onChange: (() => void) | null = null;

  private readonly group: THREE.Group;
  private readonly origin: THREE.Vector3;
  private readonly director = InteractionDirector.get();
  private readonly backend = BackendService.getInstance();
  private seats: Seat[] = [];
  private tables: THREE.Group[] = [];
  private diners: Diner[] = [];
  private waiter!: Actor;
  private cook!: Actor;
  private biteTimer = 0;
  private finishTimer = 0;
  private ateSomething = false;
  /** A used plate left on a table, waiting for the waiter */
  private leftover: { meal: Meal; seat: Seat } | null = null;
  private playerInside = false;
  private playerSeat: Seat | null = null;

  constructor(group: THREE.Group, origin: THREE.Vector3, roomWidth: number, roomLength: number) {
    this.group = group;
    this.origin = origin.clone();
    this.nav = new NavGrid(origin, roomWidth, roomLength);

    this.nav.blockRect(COUNTER.x, COUNTER.z, COUNTER.halfWidth, COUNTER.halfLength);
    this.nav.blockRect(STOVE.x, STOVE.z, STOVE.halfWidth, STOVE.halfLength);
    this.nav.blockRect(PASS.x, PASS.z, 0.5, 0.45);
    this.group.add(createPassTable(PASS));

    TABLES.forEach((center, tableIndex) => {
      const table = createBukaTable(center);
      this.tables.push(table);
      this.group.add(table);
      this.nav.blockDisc(center.x, center.z, TABLE_RADIUS);
      for (let i = 0; i < 4; i++) {
        const angle = (i * Math.PI) / 2;
        const dir = new THREE.Vector3(Math.cos(angle), 0, Math.sin(angle));
        const side = new THREE.Vector3(Math.cos(angle + 0.66), 0, Math.sin(angle + 0.66));
        this.nav.blockDisc(center.x + dir.x * CHAIR_DISTANCE, center.z + dir.z * CHAIR_DISTANCE, 0.28);
        this.seats.push({
          id: `buka:table${tableIndex + 1}:seat${i + 1}`,
          table: tableIndex,
          chair: center.clone().addScaledVector(dir, CHAIR_DISTANCE),
          stand: center.clone().addScaledVector(dir, CHAIR_DISTANCE + 0.78),
          yaw: Math.atan2(-dir.x, -dir.z),
          plate: center.clone().addScaledVector(dir, 0.62).setY(TABLE_TOP + 0.012),
          service: center.clone().addScaledVector(side, TABLE_RADIUS + 0.4),
        });
      }
    });
  }

  private world(local: THREE.Vector3): THREE.Vector3 {
    return new THREE.Vector3(this.origin.x + local.x, 0, this.origin.z + local.z);
  }

  private toInteriorLayer(object: THREE.Object3D): void {
    object.traverse((child) => child.layers.set(RENDER_LAYERS.INTERIOR));
  }

  public setStaff(waiter: Actor, cook: Actor): void {
    this.waiter = waiter;
    this.cook = cook;
    this.waiter.speed = 2.6;
    this.cook.speed = 2.2;
  }

  public tableMesh(tableIndex: number): THREE.Group {
    return this.tables[tableIndex];
  }

  /** Where the player stands to talk to someone seated at this table seat. */
  public seatApproach(seatIndex: number): THREE.Vector3 {
    return this.world(this.seats[seatIndex].service);
  }

  /** Seats a regular customer who is already eating when the player walks in. */
  public addDiner(def: InteriorNPCDef, seatIndex: number, dishId: string, eaten: number): InteriorNPCMesh {
    const seat = this.seats[seatIndex];
    const npc = new InteriorNPCMesh({ ...def, relativePosition: seat.chair.clone(), rotationY: seat.yaw });
    this.group.add(npc.group);
    this.director.reserve(seat.id, npc.actor);

    const meal = createMeal(findDish(dishId)!);
    meal.group.position.copy(seat.plate);
    meal.setRemaining(1 - eaten);
    this.group.add(meal.group);

    // Seated for good: the seat holds them, and nothing they do afterwards stands them up
    npc.actor.hold = { release: () => undefined };
    npc.actor.homeYaw = seat.yaw;
    npc.actor.setScripted(true);
    npc.actor.pose = { legs: 'sit', arms: 'rest' };
    this.diners.push({ npc, seat, meal, timer: 1 + Math.random() * 4 });
    return npc;
  }

  // --- Ordering ----------------------------------------------------------------------------

  /** Why this dish cannot be ordered right now, or null if it can. */
  public cannotOrder(dish: Dish): string | null {
    if (this.order) return 'You already have an order. Finish it or cancel it first.';
    const cash = this.backend.getData().walletCash;
    if (cash < dish.price) {
      return `${dish.name} is ₦${dish.price.toLocaleString()}. You have ₦${cash.toLocaleString()} cash, so you need ₦${(dish.price - cash).toLocaleString()} more.`;
    }
    if (!this.pickSeat()) return 'Every seat is taken right now.';
    return null;
  }

  private pickSeat(preferTable?: number): Seat | null {
    const player = this.director.player;
    if (!player) return null;
    const here = player.worldPosition();
    let best: Seat | null = null;
    let bestScore = Infinity;
    for (const seat of this.seats) {
      if (this.director.isTaken(seat.id)) continue;
      const tableInUse = this.seats.some((other) => other.table === seat.table && this.director.isTaken(other.id));
      // Prefer the table asked for, then an empty table, then the shortest walk
      let score = here.distanceTo(this.world(seat.stand));
      if (tableInUse) score += 40;
      if (preferTable !== undefined && seat.table !== preferTable) score += 100;
      if (score < bestScore) {
        bestScore = score;
        best = seat;
      }
    }
    return best;
  }

  /**
   * Places an order. Nothing is charged here: the customer pays when the plate reaches the table.
   */
  public placeOrder(dishId: string, preferTable?: number): OrderResult {
    const dish = findDish(dishId);
    const player = this.director.player;
    if (!dish || !player || !this.waiter) return { ok: false, reason: 'That is not on the menu.' };
    const blocked = this.cannotOrder(dish);
    if (blocked) return { ok: false, reason: blocked };
    if (this.director.interrupt(player) === 'locked') return { ok: false, reason: 'Finish what you are doing first.' };

    const seat = this.pickSeat(preferTable)!;
    this.director.reserve(seat.id, player);
    const order: BukaOrder = { dish, seat, stage: 'going_to_seat', paid: false, bitesLeft: dish.bites, meal: null, ready: false };
    this.order = order;
    this.ateSomething = false;

    // 1. The customer walks to the table and sits down
    const tableCenter = this.world(TABLES[seat.table]);
    const sitDown = new Sequence('sit at table', [player]).add(
      steps.walk(player, this.world(seat.stand), { nav: this.nav }),
      steps.face(player, tableCenter),
      steps.slide(player, this.world(seat.chair), 0.45, { legs: 'stand', arms: 'rest' }),
      steps.setPose(player, { legs: 'sit', arms: 'rest' }),
      steps.wait(0.3)
    );
    sitDown.onEnd((reason) => {
      if (this.order !== order) return;
      if (reason !== 'done') {
        this.endOrder('You did not sit down, so the order was cancelled. You were not charged.');
        return;
      }
      player.yaw = seat.yaw;
      this.playerSeat = seat;
      player.hold = { release: (instant) => this.standUp(instant) };
      player.setScripted(true);
      player.pose = { legs: 'sit', arms: 'rest' };
      order.stage = 'waiting';
      this.changed();
    });
    this.director.run(sitDown);

    // 2. The cook plates the food and puts it on the pass
    this.cook.say(`${dish.short}, one!`);
    this.director.perform([
      {
        id: 'plate up',
        actor: this.cook,
        // Dishes it out of the warmer first
        point: this.world(new THREE.Vector3(COUNTER.x + 1.2, 0, COUNTER.z - 1.1)),
        target: this.world(new THREE.Vector3(COUNTER.x + 1.2, 0, COUNTER.z)),
        nav: this.nav,
        ifStuck: 'snap',
        animation: { arms: 'reach' },
        seconds: 1.6,
      },
      {
        id: 'to the pass',
        actor: this.cook,
        point: this.world(new THREE.Vector3(PASS.x, 0, PASS.z - 1.15)),
        target: this.world(PASS),
        nav: this.nav,
        ifStuck: 'snap',
        animation: { arms: 'reach' },
        seconds: 0.9,
        effect: () => {
          if (this.order !== order) return false;
          order.meal = createMeal(dish);
          order.meal.group.position.set(PASS.x, 1.04, PASS.z);
          this.toInteriorLayer(order.meal.group);
          this.group.add(order.meal.group);
          order.ready = true;
          this.cook.say('Order up!');
          this.changed();
        },
      },
      {
        id: 'back to the pots',
        actor: this.cook,
        point: this.world(COOK_POST),
        target: this.cook.homeYaw,
        nav: this.nav,
        ifStuck: 'snap',
        animation: { arms: 'rest' },
        seconds: 0.1,
      },
    ]);

    // 3. The waiter collects the plate and carries it to the table
    const serve = new Sequence('serve table', [this.waiter]).add(
      steps.call('acknowledge', () => this.waiter.say('Coming, sah!')),
      steps.walk(this.waiter, this.world(new THREE.Vector3(PASS.x, 0, PASS.z + 1.15)), { nav: this.nav, ifStuck: 'snap' }),
      steps.face(this.waiter, this.world(PASS)),
      steps.until('plate on the pass', () => order.ready, 20),
      steps.animate(this.waiter, { arms: 'reach' }, 0.8, [{
        at: 0.6,
        run: () => {
          if (this.order !== order || !order.meal) return false;
          order.ready = false;
          this.waiter.carry(order.meal.group);
          this.changed();
        },
      }]),
      steps.walk(this.waiter, this.world(seat.service), { nav: this.nav, speed: 2.2, ifStuck: 'snap' }),
      steps.until('customer seated', () => order.stage === 'waiting', 45),
      steps.face(this.waiter, this.world(seat.plate)),
      steps.animate(this.waiter, { arms: 'reach' }, 0.9, [{ at: 0.55, run: () => this.putPlateDown(order) }]),
      steps.call('enjoy', () => this.waiter.say('Enjoy your meal!')),
      steps.wait(0.5),
      ...this.goHomeSteps()
    );
    serve.onEnd((reason) => {
      if (reason === 'done') return;
      this.waiterGaveUp(order);
      // If the delivery itself broke down, the customer is not left waiting for ever
      if (this.order === order && !order.paid) {
        this.endOrder('The kitchen could not serve your order. You were not charged.');
      }
    });
    this.director.run(serve);

    this.changed();
    return { ok: true };
  }

  /**
   * The moment the plate touches the table: this is where the customer pays.
   * If the money is not there any more, the plate goes back and nothing is charged.
   */
  private putPlateDown(order: BukaOrder): boolean {
    if (this.order !== order || !order.meal || order.paid) return false;
    const paid = this.backend.spendCash(order.dish.price, `${order.dish.name} at Mama Put`, 'FOOD_PURCHASE');
    if (!paid) {
      this.waiter.say('Ah! The money no complete.');
      this.endOrder(`You could not pay ₦${order.dish.price.toLocaleString()} for the ${order.dish.name}, so it went back to the kitchen.`);
      return false;
    }
    order.paid = true;
    this.waiter.letGo();
    order.meal.group.position.copy(order.seat.plate);
    order.meal.group.rotation.set(0, 0, 0);
    this.group.add(order.meal.group);
    order.stage = 'eating';
    this.biteTimer = BITE_SECONDS * 0.6;
    const player = this.director.player;
    if (player) player.pose = { legs: 'sit', arms: 'eat' };
    showGameToast(`Paid ₦${order.dish.price.toLocaleString()} for ${order.dish.name}.`, 'success', 3200);
    this.changed();
    return true;
  }

  private goHomeSteps() {
    return [
      steps.walk(this.waiter, this.world(WAITER_POST), { nav: this.nav, ifStuck: 'snap' }),
      steps.face(this.waiter, this.waiter.homeYaw),
    ];
  }

  /** The waiter's delivery was cut short: take any plate back and return to his post. */
  private waiterGaveUp(order: BukaOrder): void {
    if (order.meal && !order.paid) {
      const meal = order.meal;
      order.meal = null;
      order.ready = false;
      if (this.playerInside && this.waiter.carried === meal.group) {
        // Walk it back to the kitchen
        const takeBack = new Sequence('take plate back', [this.waiter]).add(
          steps.walk(this.waiter, this.world(new THREE.Vector3(PASS.x, 0, PASS.z + 1.15)), { nav: this.nav, ifStuck: 'snap' }),
          steps.face(this.waiter, this.world(PASS)),
          steps.animate(this.waiter, { arms: 'reach' }, 0.7, [{ at: 0.5, run: () => { this.waiter.letGo(); meal.dispose(); } }]),
          ...this.goHomeSteps()
        );
        takeBack.onEnd(() => {
          if (this.waiter.carried === meal.group) this.waiter.letGo();
          meal.dispose();
        });
        if (this.director.run(takeBack)) return;
      }
      if (this.waiter.carried === meal.group) this.waiter.letGo();
      meal.dispose();
    }
    if (this.playerInside && !this.waiter.busy) {
      this.director.run(new Sequence('waiter back to post', [this.waiter]).add(...this.goHomeSteps()));
    }
  }

  /**
   * Closes the books on the current order: the kitchen stops, an unpaid plate goes back,
   * a paid one is left for clearing. Does not move the customer.
   */
  private closeOrder(message?: string): BukaOrder | null {
    const order = this.order;
    if (!order) return null;
    this.order = null;

    if (order.paid) {
      if (order.meal) this.leftover = { meal: order.meal, seat: order.seat };
      order.meal = null;
    } else {
      const cooking = this.cook.sequence;
      if (cooking && !cooking.ended && cooking.name.startsWith('plate up')) cooking.cancel();
      const serving = this.waiter.sequence;
      // Cancelling the delivery makes the waiter take the plate back (see its end handler)
      if (serving && !serving.ended && serving.name === 'serve table') serving.cancel();
      else this.waiterGaveUp(order);
      if (this.playerInside && !this.cook.busy) {
        this.director.perform({
          id: 'cook back to the pots', actor: this.cook, point: this.world(COOK_POST), target: this.cook.homeYaw,
          nav: this.nav, ifStuck: 'snap', animation: { arms: 'rest' }, seconds: 0.1,
        });
      }
    }
    if (message && this.playerInside) showGameToast(message, order.paid ? 'info' : 'warning', 4200);
    this.changed();
    return order;
  }

  /** Ends the order and gets the customer up from the table. */
  private endOrder(message?: string): void {
    const order = this.closeOrder(message);
    const player = this.director.player;
    if (!order || !player) return;
    if (player.hold) {
      this.rise(false);
      return;
    }
    // Not seated yet: stop walking to the table and give the seat up
    const walking = player.sequence;
    if (walking && !walking.ended && walking.name === 'sit at table') walking.cancel();
    this.director.release(order.seat.id, player);
    this.playerSeat = null;
  }

  /** The customer cancels from the screen. */
  public cancelOrder(): void {
    if (this.order) this.endOrder(this.leavingMessage(this.order));
  }

  private leavingMessage(order: BukaOrder): string | undefined {
    if (!order.paid) return 'Order cancelled. You were not charged.';
    if (order.stage === 'eating') return 'You left the rest of your meal.';
    return undefined;
  }

  /** The seat lets go of the player: they moved off, are leaving, or the room is closing. */
  private standUp(instant = false): void {
    if (this.order) this.closeOrder(this.leavingMessage(this.order));
    this.rise(instant);
  }

  private rise(instant: boolean): void {
    const player = this.director.player;
    const seat = this.playerSeat;
    this.playerSeat = null;
    if (!player) return;
    player.hold = null;
    if (seat) this.director.release(seat.id, player);
    if (instant || !seat) {
      player.setScripted(false);
      return;
    }
    // Getting out of a chair cannot be interrupted, but it is quick
    const rise = new Sequence('stand up', [player]).locked().add(
      steps.setPose(player, { legs: 'stand', arms: 'rest' }),
      steps.slide(player, this.world(seat.stand), 0.45)
    );
    if (!this.director.run(rise)) player.setScripted(false);
  }

  /** The waiter collects a used plate and takes it back to the kitchen. */
  private clearTable(): void {
    const leftover = this.leftover;
    if (!leftover) return;
    this.leftover = null;
    const { meal, seat } = leftover;
    const clear = new Sequence('clear table', [this.waiter]).add(
      steps.wait(0.8),
      steps.walk(this.waiter, this.world(seat.service), { nav: this.nav, ifStuck: 'snap' }),
      steps.face(this.waiter, this.world(seat.plate)),
      steps.animate(this.waiter, { arms: 'reach' }, 0.8, [{ at: 0.55, run: () => this.waiter.carry(meal.group) }]),
      steps.walk(this.waiter, this.world(new THREE.Vector3(PASS.x, 0, PASS.z + 1.15)), { nav: this.nav, speed: 2.2, ifStuck: 'snap' }),
      steps.face(this.waiter, this.world(PASS)),
      steps.animate(this.waiter, { arms: 'reach' }, 0.7, [{ at: 0.5, run: () => { this.waiter.letGo(); meal.dispose(); } }]),
      ...this.goHomeSteps()
    );
    // However it ends, the plate does not linger in his hands or on the table
    clear.onEnd(() => {
      if (this.waiter.carried === meal.group) this.waiter.letGo();
      meal.dispose();
    });
    this.director.run(clear);
  }

  // --- Each frame --------------------------------------------------------------------------

  public update(delta: number): void {
    // Regulars eat a little, rest a little
    for (const diner of this.diners) {
      diner.timer -= delta;
      if (diner.timer > 0 || diner.npc.actor.busy) continue;
      const eating = diner.npc.actor.pose.arms === 'eat';
      diner.npc.actor.pose = { legs: 'sit', arms: eating ? (Math.random() < 0.4 ? 'talk' : 'rest') : 'eat' };
      diner.timer = eating ? 2.5 + Math.random() * 4 : 3 + Math.random() * 3;
    }

    const order = this.order;
    const player = this.director.player;
    // A used plate is cleared once the customer is up from the table
    if (!order && this.leftover && !this.waiter.busy && !player?.hold && player?.sequence?.name !== 'stand up') this.clearTable();
    if (!order || !player) return;

    if (order.stage === 'eating') {
      // Keep eating after anything that borrowed the arms for a moment (a wave)
      if (!player.busy && player.pose.arms !== 'eat') player.pose = { legs: 'sit', arms: 'eat' };
      this.biteTimer -= delta;
      if (this.biteTimer > 0) return;
      this.biteTimer = BITE_SECONDS;
      order.bitesLeft -= 1;
      const share = 1 / order.dish.bites;
      this.backend.eatBite(order.dish.hunger * share, order.dish.energy * share, order.dish.health * share);
      if (!this.ateSomething) {
        this.ateSomething = true;
        emitGameEvent('eat');
      }
      order.meal?.setRemaining(order.bitesLeft / order.dish.bites);
      if (order.bitesLeft <= 0) {
        order.stage = 'finished';
        this.finishTimer = 1.4;
        player.pose = { legs: 'sit', arms: 'rest' };
      }
      this.changed();
    } else if (order.stage === 'finished') {
      this.finishTimer -= delta;
      if (this.finishTimer <= 0) this.endOrder();
    }
  }

  private changed(): void {
    this.onChange?.();
  }

  public progress(): OrderProgress | null {
    const order = this.order;
    if (!order) return null;
    if (order.stage === 'eating' || order.stage === 'finished') return order.stage;
    if (order.meal && this.waiter.carried === order.meal.group) return 'on_its_way';
    if (order.ready) return 'on_the_pass';
    return order.stage === 'going_to_seat' ? 'seating' : 'cooking';
  }

  // --- Coming and going --------------------------------------------------------------------

  public playerEntered(): void {
    this.playerInside = true;
    this.changed();
  }

  /** The player has left the building: nothing keeps running in an empty room. */
  public playerLeft(): void {
    this.playerInside = false;
    const order = this.order;
    this.order = null;
    const player = this.director.player;
    if (player) {
      for (const seat of this.seats) this.director.release(seat.id, player);
    }
    this.playerSeat = null;
    for (const staff of [this.waiter, this.cook]) {
      if (!staff) continue;
      this.director.forceFree(staff);
      staff.yaw = staff.homeYaw;
    }
    if (this.waiter) this.waiter.setWorldPosition(this.origin.x + WAITER_POST.x, this.origin.z + WAITER_POST.z);
    if (this.cook) this.cook.setWorldPosition(this.origin.x + COOK_POST.x, this.origin.z + COOK_POST.z);
    order?.meal?.dispose();
    this.leftover?.meal.dispose();
    this.leftover = null;
    this.changed();
  }
}
