import * as THREE from 'three';
import { PlaceActions, type PlaceHost } from '../../destinations/PlaceActions';
import { InteractionDirector } from '../../interactions/InteractionDirector';
import type { NavGrid } from '../../interactions/NavGrid';
import { Sequence, steps } from '../../interactions/Sequence';
import { BackendService } from '../../backend/BackendService';
import { showGameToast } from '../../ui/GameToast';
import type { InteractiveObject } from '../../world/World';

/**
 * What the player can do in the terminal besides flying: sit down on any free seat (the gate
 * benches, the café chairs, the lounge armchairs), buy food at the café and eat it at a table,
 * buy snacks and gadgets at the shop, pay into the lounge and rest there, use the toilets.
 * Money moves at the hand-over, and everything is acted out where it happens.
 *
 * Positions are in the hall's coordinates; the hall's origin turns them into the world's.
 */
export interface AirportSeat {
  id: string;
  x: number;
  z: number;
  /** The way the sitter faces */
  yaw: number;
  /** The top of the cushion the hips rest on */
  top: number;
  kind: 'gate' | 'cafe' | 'lounge';
  /** For a café chair: the middle of its table (where the plate goes) */
  table?: [number, number];
}

interface MenuItem {
  name: string;
  price: number;
  hunger: number;
  energy?: number;
  /** What the plate on the table looks like: its food colour, and whether it is a drink */
  colour: number;
  drink?: boolean;
}

const CAFE_MENU: MenuItem[] = [
  { name: 'Jollof rice and chicken', price: 4500, hunger: 60, colour: 0xd9481c },
  { name: 'Fried rice, dodo and turkey', price: 6000, hunger: 70, colour: 0xc9a227 },
  { name: 'Meat pie', price: 1500, hunger: 20, colour: 0xd8a25a },
  { name: 'Puff-puff (six)', price: 800, hunger: 15, colour: 0xb8742f },
  { name: 'Hot coffee', price: 2500, hunger: 3, energy: 20, colour: 0x3b2314, drink: true },
  { name: 'Chilled zobo', price: 1000, hunger: 5, energy: 5, colour: 0x7a1030, drink: true },
  { name: 'Chapman', price: 2000, hunger: 5, energy: 8, colour: 0xc2410c, drink: true },
  { name: 'Bottled water', price: 500, hunger: 0, energy: 3, colour: 0xbfe3ff, drink: true },
];

const SHOP_STOCK: Array<{ id: string; name: string; icon: string; price: number; category: 'food' | 'gadget' | 'luxury'; energy?: number; said: string }> = [
  { id: 'sausage_roll', name: 'Sausage roll', icon: '🥐', price: 700, category: 'food', energy: 10, said: 'One sausage roll, still warm.' },
  { id: 'chin_chin', name: 'Pack of chin-chin', icon: '🍪', price: 1200, category: 'food', energy: 12, said: 'Chin-chin, the crunchy one.' },
  { id: 'plantain_chips', name: 'Plantain chips', icon: '🍌', price: 1000, category: 'food', energy: 10, said: 'Plantain chips, salted.' },
  { id: 'malt_drink', name: 'Malt drink', icon: '🥤', price: 900, category: 'food', energy: 15, said: 'Chilled from the fridge.' },
  { id: 'water_bottle', name: 'Bottle of water', icon: '💧', price: 500, category: 'food', energy: 5, said: 'Cold water.' },
  { id: 'power_bank', name: 'Power bank (10,000 mAh)', icon: '🔋', price: 18000, category: 'gadget', said: 'Fully charged, ready for the flight.' },
  { id: 'phone_charger', name: 'Phone charger and cable', icon: '🔌', price: 7500, category: 'gadget', said: 'Fast charger, two-pin plug.' },
  { id: 'adire_scarf', name: 'Adire scarf', icon: '🧣', price: 15000, category: 'luxury', said: 'Hand-dyed in Abeokuta. A good gift.' },
];

const naira = (n: number) => `₦${n.toLocaleString('en-NG')}`;

export class AirportServices {
  private readonly director = InteractionDirector.get();
  private readonly backend = BackendService.getInstance();
  private readonly plate: THREE.Group;
  private readonly plateFood: THREE.MeshStandardMaterial;
  private readonly origin: THREE.Vector3;
  private readonly nav: NavGrid;
  private readonly seats: AirportSeat[];

  constructor(group: THREE.Group, origin: THREE.Vector3, nav: NavGrid, seats: AirportSeat[]) {
    this.origin = origin;
    this.nav = nav;
    this.seats = seats;
    // The plate (or cup) that comes to the table with the order
    this.plate = new THREE.Group();
    this.plate.name = 'served plate';
    const dish = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.1, 0.02, 20), new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.3 }));
    this.plateFood = new THREE.MeshStandardMaterial({ color: 0xd9481c, roughness: 0.8 });
    const food = new THREE.Mesh(new THREE.SphereGeometry(0.09, 14, 8).scale(1, 0.38, 1), this.plateFood);
    food.position.y = 0.03;
    const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.04, 0.12, 14), this.plateFood);
    cup.name = 'cup';
    cup.position.set(0.12, 0.06, 0);
    this.plate.add(dish, food, cup);
    this.plate.visible = false;
    group.add(this.plate);
  }

  private world(x: number, z: number): THREE.Vector3 {
    return new THREE.Vector3(this.origin.x + x, 0, this.origin.z + z);
  }

  /** The nearest free seat of a kind to a point in the hall (not one the crowd or anyone else is in) */
  private freeSeat(kind: AirportSeat['kind'], near: [number, number]): AirportSeat | null {
    let best: AirportSeat | null = null;
    let bestD = Infinity;
    for (const s of this.seats) {
      if (s.kind !== kind || this.director.isTaken(s.id)) continue;
      const d = (s.x - near[0]) ** 2 + (s.z - near[1]) ** 2;
      if (d < bestD) {
        bestD = d;
        best = s;
      }
    }
    return best;
  }

  // --- Sitting -------------------------------------------------------------------------------------

  /**
   * Walks to the seat and sits on it, staying there until the player gets up (or does something
   * else). `then` runs seated: eating a meal, resting in the lounge.
   */
  public sitOn(seat: AirportSeat, then: Array<ReturnType<typeof steps.wait>> = []): boolean {
    const player = this.director.player;
    if (!player || this.director.interrupt(player) === 'locked') return false;
    if (!this.director.reserve(seat.id, player)) return false;
    const fx = Math.sin(seat.yaw), fz = Math.cos(seat.yaw);
    const front = this.world(seat.x + fx * 0.6, seat.z + fz * 0.6);
    const on = this.world(seat.x - fx * 0.04, seat.z - fz * 0.04);
    const pose = { legs: 'sit' as const, arms: 'rest' as const, height: seat.top };
    const sit = new Sequence(`sit (${seat.kind})`, [player]).add(
      steps.walk(player, front, { nav: this.nav, ifStuck: 'snap' }),
      steps.face(player, seat.yaw),
      steps.slide(player, on, 0.45),
      steps.setPose(player, pose),
      steps.wait(0.25),
      ...then,
    );
    sit.onEnd((reason) => {
      if (reason !== 'done') {
        this.director.release(seat.id, player);
        this.plate.visible = false;
        return;
      }
      player.yaw = seat.yaw;
      player.setScripted(true);
      player.pose = { ...pose };
      player.hold = {
        release: (instant) => {
          player.hold = null;
          this.director.release(seat.id, player);
          this.plate.visible = false;
          if (instant) {
            player.setScripted(false);
            return;
          }
          const rise = new Sequence('get up', [player]).locked().add(steps.setPose(player, { legs: 'stand', arms: 'rest' }), steps.slide(player, front, 0.5));
          if (!this.director.run(rise)) player.setScripted(false);
        },
      };
    });
    const ok = this.director.run(sit);
    if (!ok) this.director.release(seat.id, player);
    return ok;
  }

  // --- The café --------------------------------------------------------------------------------------

  private cafeMenu(host: PlaceHost): void {
    host.ask({
      who: 'Blessing',
      role: 'Barista · Buka Express Café',
      text: 'Welcome! What will you have? I will bring it to your table.',
      choices: CAFE_MENU.map((m) => ({
        label: `${m.name} · ${naira(m.price)}`,
        note: m.drink ? 'A drink, at a table' : `Hunger +${m.hunger}`,
        pick: () => this.buyMeal(host, m),
      })),
    });
  }

  /** Order at the counter, pay as it is handed over, carry it to a free table and eat it there */
  private buyMeal(host: PlaceHost, m: MenuItem): void {
    if (!this.backend.canPay(m.price)) {
      host.say(`That is ${naira(m.price)}. You do not have enough on you.`, 'warning');
      return;
    }
    const seat = this.freeSeat('cafe', [-24.4, -6]);
    if (!seat || !seat.table) {
      host.say('Every table is taken just now. Try again in a minute.', 'info');
      return;
    }
    const player = this.director.player;
    if (!player || this.director.interrupt(player) === 'locked') return;
    const order = new Sequence('order at the café', [player]).add(
      steps.walk(player, this.world(-24.45, -5.4), { nav: this.nav, ifStuck: 'snap' }),
      steps.face(player, -Math.PI / 2),
      steps.animate(player, { arms: 'talk' }, 1.2),
      // The plate comes across the counter: that is when it is paid for
      steps.animate(player, { arms: 'reach' }, 0.9),
      steps.call('paid at the hand-over', () => {
        if (!this.backend.pay(m.price, `${m.name} at Buka Express Café`, 'FOOD_PURCHASE')) {
          host.say('The payment did not go through.', 'warning');
          return false;
        }
        host.say(`🍽️ ${m.name}, ${naira(m.price)} paid. You carry it to a table.`, 'success');
      }),
    );
    order.onEnd((reason) => {
      if (reason !== 'done') return;
      // To the table, and eat it there
      const [tx, tz] = seat.table!;
      const toward = Math.atan2(seat.x - tx, seat.z - tz);
      this.plateFood.color.setHex(m.colour);
      const cup = this.plate.getObjectByName('cup');
      const food = this.plate.children[1];
      if (cup) cup.visible = !!m.drink;
      food.visible = !m.drink;
      this.sitOn(seat, [
        steps.call('the plate down', () => {
          this.plate.position.set(tx + Math.sin(toward) * 0.32, 0.77, tz + Math.cos(toward) * 0.32);
          this.plate.visible = true;
        }),
        steps.animate(player, { arms: 'eat' }, m.drink ? 4 : 7),
        steps.call('eaten', () => {
          if (m.hunger) this.backend.modifyNeed('hunger', m.hunger);
          if (m.energy) this.backend.modifyNeed('energy', m.energy);
          this.backend.modifyNeed('fun', 2);
          this.plate.visible = false;
          showGameToast(m.drink ? `🥤 That ${m.name.toLowerCase()} hit the spot.` : `😋 You finish the ${m.name.toLowerCase()}. Hunger +${m.hunger}.`, 'success', 2600);
        }),
        steps.setPose(player, { arms: 'rest' }),
      ]);
    });
    this.director.run(order);
  }

  // --- The shop --------------------------------------------------------------------------------------

  private shopMenu(host: PlaceHost): void {
    host.ask({
      who: 'Sule',
      role: 'Cashier · Naija Mart',
      text: 'What do you need for the journey?',
      choices: SHOP_STOCK.map((s) => ({
        label: `${s.icon} ${s.name} · ${naira(s.price)}`,
        note: s.category === 'food' ? 'Into your bag' : s.category === 'gadget' ? 'Gadget' : 'Gift',
        pick: () => this.buy(host, s),
      })),
    });
  }

  private buy(host: PlaceHost, s: (typeof SHOP_STOCK)[number]): void {
    if (!this.backend.canPay(s.price)) {
      host.say(`That is ${naira(s.price)}. You do not have enough on you.`, 'warning');
      return;
    }
    const result = this.director.perform([
      {
        id: 'pay at the till', actor: host.actor, point: this.world(-5.45, -3.2), target: Math.PI / 2, animation: { arms: 'reach' }, seconds: 1.4, effectAt: 0.7, ifStuck: 'snap', nav: this.nav,
        effect: () => {
          if (!this.backend.pay(s.price, `${s.name} at Naija Mart`, 'SHOP_PURCHASE')) return false;
          this.backend.addItem({ id: s.id, name: s.name, icon: s.icon, category: s.category, price: s.price, usable: s.category === 'food', energyRestore: s.energy, description: s.said });
          host.say(`${s.icon} ${s.name}: ${naira(s.price)} paid. ${s.said}`, 'success');
        },
      },
    ]);
    if (!result.ok && result.reason) host.say(result.reason, 'info');
  }

  // --- The lounge and the toilets ----------------------------------------------------------------------

  private lounge(host: PlaceHost): void {
    const fee = 40000;
    const seat = this.freeSeat('lounge', [-21, -15]);
    if (!seat) {
      host.say('The lounge is full just now.', 'info');
      return;
    }
    if (!this.backend.canPay(fee)) {
      host.say(`Entry is ${naira(fee)}. You do not have enough on you.`, 'warning');
      return;
    }
    const player = this.director.player;
    if (!player || this.director.interrupt(player) === 'locked') return;
    const pay = new Sequence('into the lounge', [player]).add(
      steps.walk(player, this.world(-21, -11.9), { nav: this.nav, ifStuck: 'snap' }),
      steps.face(player, Math.PI),
      steps.animate(player, { arms: 'reach' }, 1.0),
      steps.call('paid', () => {
        if (!this.backend.pay(fee, 'NigeriaLife Air Executive Lounge', 'SHOP_PURCHASE')) return false;
        host.say(`🥂 Welcome to the lounge. ${naira(fee)} paid. Ifeoma shows you to an armchair.`, 'success');
      }),
    );
    pay.onEnd((reason) => {
      if (reason !== 'done') return;
      this.sitOn(seat, [
        steps.wait(3),
        steps.call('rested', () => {
          this.backend.modifyNeed('energy', 100);
          this.backend.modifyNeed('health', 100);
          this.backend.modifyNeed('hunger', 30);
          showGameToast('🥂 Chilled Chapman and small chops. Health and energy restored.', 'success', 3000);
        }),
      ]);
    });
    this.director.run(pay);
  }

  private toilets(host: PlaceHost, door: { leaf: THREE.Object3D }): void {
    const actor = host.actor;
    const result = this.director.perform([
      {
        id: 'into the toilets', actor, point: this.world(-26.8, -1.0), target: this.world(-28, -1.0), animation: { arms: 'reach' }, seconds: 0.7, effectAt: 0.6, ifStuck: 'snap', nav: this.nav,
        effect: () => {
          door.leaf.rotation.y = 1.3;
          actor.root.visible = false;
        },
      },
      {
        id: 'in the toilets', actor, animation: { arms: 'rest' }, seconds: 3.4, effectAt: 0.95,
        effect: () => {
          this.backend.relieveBladder();
          this.backend.modifyNeed('hygiene', 4);
          host.say('🚻 *Flush* You wash your hands under the tap and come out.', 'success');
        },
      },
    ], { locked: true });
    result.sequence?.onEnd(() => {
      actor.root.visible = true;
      door.leaf.rotation.y = 0;
    });
    if (!result.ok && result.reason) host.say(result.reason, 'info');
  }

  /**
   * The cards to walk up to, and what pressing each one does: a sit-down card at every row of gate
   * seats and every café table, the café counter, the shop's till, the lounge desk, the toilets.
   */
  public register(list: InteractiveObject[], mesh: THREE.Object3D, toiletDoor: { leaf: THREE.Object3D }): void {
    const card = (id: string, name: string, category: string, description: string, x: number, z: number) =>
      list.push({ mesh, id, name, category, description, interactionPoint: this.world(x, z) });

    // Sit-down cards: one for each row of gate seats, one for each café table
    const rows = new Map<string, AirportSeat[]>();
    for (const s of this.seats) {
      if (s.kind === 'lounge') continue;
      const key = s.kind === 'gate' ? `gate_${Math.round(s.x / 3.4)}_${Math.round(s.z)}` : `cafe_${s.table![0]}_${s.table![1]}`;
      rows.set(key, [...(rows.get(key) ?? []), s]);
    }
    let n = 0;
    for (const [key, seats] of rows) {
      const id = `airport_sit_${n++}`;
      const mx = seats.reduce((a, s) => a + s.x, 0) / seats.length;
      const mz = seats.reduce((a, s) => a + s.z, 0) / seats.length;
      const gate = key.startsWith('gate');
      // The card sits in front of the row (or beside the table), where the player walks up
      const yaw = seats[0].yaw;
      const px = gate ? mx + Math.sin(yaw) * 0.9 : mx;
      const pz = gate ? mz + Math.cos(yaw) * 0.9 : mz + 1.3;
      card(id, gate ? 'Gate seats' : 'Café table', gate ? 'Airport seating' : 'Buka Express Café', gate ? 'Sit down and wait for your flight.' : 'Sit at a table.', px, pz);
      PlaceActions.register(id, {
        label: () => '🪑 Sit down',
        run: (host) => {
          const player = this.director.player;
          const here = player ? [player.root.position.x - this.origin.x, player.root.position.z - this.origin.z] as [number, number] : [mx, mz] as [number, number];
          const free = seats.filter((s) => !this.director.isTaken(s.id)).sort((a, b) => (a.x - here[0]) ** 2 + (a.z - here[1]) ** 2 - ((b.x - here[0]) ** 2 + (b.z - here[1]) ** 2))[0];
          if (!free) {
            host.say('Every seat here is taken. Try the next row.', 'info');
            return;
          }
          if (!this.sitOn(free)) host.say('You cannot sit down just now.', 'info');
        },
      });
    }

    card('airport_cafe_counter', 'Buka Express Café', 'Food and drinks', 'Jollof, fried rice, meat pie, puff-puff, coffee, zobo, Chapman. Eat at a table.', -24.45, -5.4);
    PlaceActions.register('airport_cafe_counter', { label: () => '🍽️ Order food and drinks', run: (host) => this.cafeMenu(host) });
    card('airport_shop_till', 'Naija Mart', 'Airport shop', 'Snacks, drinks, power banks, chargers and gifts.', -5.45, -3.2);
    PlaceActions.register('airport_shop_till', { label: () => '🛒 Buy something', run: (host) => this.shopMenu(host) });
    PlaceActions.register('airport_vip_lounge', { label: () => '🥂 Pay into the lounge (₦40,000)', run: (host) => this.lounge(host) });
    card('airport_toilets', 'Toilets', 'Facilities', 'Ladies and gents, airside.', -26.8, -1.0);
    PlaceActions.register('airport_toilets', { label: () => '🚻 Use the toilets', run: (host) => this.toilets(host, toiletDoor) });
  }
}
