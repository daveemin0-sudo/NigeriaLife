import * as THREE from 'three';
import { Builder } from '../../world/kit/ArchKit';
import { HumanMeshBuilder } from '../../graphics/HumanMeshBuilder';
import { bakeToGeometry } from '../../graphics/MeshBaker';
import { Sequence, steps } from '../../interactions/Sequence';
import type { PlaceHost } from '../../destinations/PlaceActions';
import { PlaceOpeners, type PlaceInterior, type PlaceSpec } from './PlaceInterior';
import { Supermarket, SUPERMARKET, LINES, BAYS, BAY_CARTONS, FRONT_BAYS, lineOf, bayCapacity, type Bay } from '../../business/Supermarket';
import { Companies, ROLES, type Staffer } from '../../business/Companies';
import { BackendService } from '../../backend/BackendService';

/**
 * Naija Fresh Supermarket, inside: eight shelf bays (four by the tills, four at the back), the
 * stockroom at the back right where the cartons the owner orders are stacked, the office desk
 * where stock is ordered, and the tills by the door. Before anyone buys it, it is the seller's
 * shop, full, and a visitor can take things off the shelves and pay at the till. The owner lays
 * it out, orders stock and carries the cartons out; their staff work in it.
 */

const W = 28;
const L = 22;
/** The bays' middles: the front row nearer the door and the tills */
const BAY_AT: Array<[number, number]> = [[-9, 2], [-3, 2], [3, 2], [9, 2], [-9, -5], [-3, -5], [3, -5], [9, -5]];
const BAY_W = 4.4;
const SLOTS = 12;
const ROWS = 3;
const STOCKROOM: [number, number] = [10.5, -9];
const DESK: [number, number] = [-11, -8.5];
const TILLS: Array<[number, number]> = [[-8, 7], [-4, 7]];
const PEOPLE = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.65 });

const word = (n: number, one: string) => `${n} ${one}${n === 1 ? '' : 's'}`;

function person(gender: 'male' | 'female', outfit: number, i: number): THREE.BufferGeometry | null {
  const female = gender === 'female';
  const rig = HumanMeshBuilder.createHuman({ gender, username: '', lod: 'street', outfitColor: outfit, outfit: female ? 'casual_blouse' : i % 3 ? 'casual_tee' : 'senator', hairstyle: female ? 'braids' : 'short_crop' });
  rig.nameTag.visible = false;
  return bakeToGeometry(rig.group);
}

class SupermarketView {
  private readonly market = Supermarket.get();
  private readonly companies = Companies.get();
  private readonly backend = BackendService.getInstance();
  private shelves: THREE.Group | null = null;
  private back: THREE.Group | null = null;
  private staff: THREE.Mesh[] = [];
  private staffShape = '';
  private room: PlaceInterior;

  constructor(room: PlaceInterior) {
    this.room = room;
    this.addCards();
    this.market.subscribe(() => this.draw());
    this.companies.subscribe(() => this.drawStaff());
    this.backend.subscribe(() => {
      this.drawStaff();
      if (this.ownedWas !== this.market.owned()) this.draw();
    });
    this.draw();
    this.drawStaff();
  }

  private ownedWas: boolean | null = null;

  private bays(): readonly Bay[] {
    return this.market.owned() ? this.market.bays() : Supermarket.showroom();
  }

  /** The goods on the shelves and the cartons in the stockroom, as they are now */
  public draw(): void {
    this.ownedWas = this.market.owned();
    const g = this.room.group;
    for (const old of [this.shelves, this.back]) {
      if (!old) continue;
      g.remove(old);
      old.traverse((o) => { if (o instanceof THREE.Mesh) { o.geometry.dispose(); (o.material as THREE.Material).dispose(); } });
    }
    const b = new Builder();
    this.bays().forEach((bay, i) => {
      const line = lineOf(bay.line);
      const [x, z] = BAY_AT[i];
      // The line's colour along the top, so a shelf can be told from across the shop
      if (line) b.box(line.colours[0], BAY_W, 0.25, 0.08, x, 2.15, z + 0.32);
      if (!line || bay.units <= 0) return;
      const filled = Math.round((bay.units / bayCapacity(line)) * SLOTS * ROWS);
      for (let n = 0; n < filled; n++) {
        const row = Math.floor(n / SLOTS);
        const slot = n % SLOTS;
        b.box(line.colours[(slot + row) % line.colours.length], 0.3, 0.42, 0.34, x - BAY_W / 2 + 0.22 + slot * 0.36, 0.22 + row * 0.66, z + 0.12);
      }
    });
    this.shelves = b.build('supermarket goods', { roughness: 0.6 });
    g.add(this.shelves);

    // The stockroom: what the owner has ordered, carton on carton, a pile for each line
    const s = new Builder();
    if (this.market.owned()) {
      let pile = 0;
      for (const line of LINES) {
        const cartons = Math.min(9, this.market.cartonsInBack(line.id));
        if (!cartons) continue;
        const px = STOCKROOM[0] - 2.4 + (pile % 4) * 1.3;
        const pz = STOCKROOM[1] - 1 + Math.floor(pile / 4) * 1.2;
        for (let c = 0; c < cartons; c++) s.box(0xa16207, 0.9, 0.5, 0.8, px, (c % 3) * 0.5, pz + Math.floor(c / 3) * 0.02).box(line.colours[0], 0.92, 0.12, 0.82, px, (c % 3) * 0.5 + 0.3, pz);
        pile += 1;
      }
    }
    s.box(0x78350f, 5.6, 0.15, 2.6, STOCKROOM[0] - 0.5, 0, STOCKROOM[1] - 0.4);
    this.back = s.build('supermarket stockroom', { roughness: 0.8 });
    g.add(this.back);
  }

  /** The people working here: the seller's two before it is sold, the owner's staff after */
  private drawStaff(): void {
    const owned = this.market.owned();
    const staff: Array<Pick<Staffer, 'role' | 'gender'>> = owned ? [...this.companies.staff(SUPERMARKET)] : [{ role: 'cashier', gender: 'female' }, { role: 'stacker', gender: 'male' }];
    const shape = `${owned}:${staff.map((s) => `${s.role}${s.gender}`).join(',')}`;
    if (shape === this.staffShape) return;
    this.staffShape = shape;
    for (const m of this.staff) { this.room.group.remove(m); m.geometry.dispose(); }
    this.staff = [];
    const used: Record<string, number> = {};
    staff.forEach((s, i) => {
      const n = (used[s.role] = (used[s.role] ?? -1) + 1);
      const spot: [number, number, number] | undefined = ({
        cashier: [TILLS[n % 2][0], TILLS[n % 2][1] + 1.1, Math.PI],
        stacker: [BAY_AT[(n * 3 + 1) % BAYS][0] + 1.2, BAY_AT[(n * 3 + 1) % BAYS][1] + 0.9, Math.PI],
        security: [3 + n * 1.2, L / 2 - 1.4, Math.PI],
        cleaner: [0, -1.5, Math.PI / 2],
        manager: [DESK[0], DESK[1] - 1.1, 0],
      } as Record<string, [number, number, number]>)[s.role];
      if (!spot) return;
      const geo = person(s.gender, ROLES[s.role].outfit, i);
      if (!geo) return;
      const mesh = new THREE.Mesh(geo, PEOPLE);
      mesh.position.set(spot[0], 0, spot[1]);
      mesh.rotation.y = spot[2];
      mesh.name = `supermarket ${s.role}`;
      this.room.group.add(mesh);
      this.staff.push(mesh);
    });
  }

  private stand(bay: number): [number, number] {
    return [BAY_AT[bay][0], BAY_AT[bay][1] + 1.3];
  }

  /** One carton from the stockroom to a shelf, carried by the player */
  private carry(bay: number, host: PlaceHost): void {
    const why = this.market.cannotStack(bay);
    if (why) {
      host.say(why, 'info');
      return;
    }
    if (host.director.interrupt(host.actor) === 'locked') return;
    const line = lineOf(this.market.bays()[bay].line)!;
    const carton = new THREE.Group();
    const box = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.4, 0.5), new THREE.MeshStandardMaterial({ color: 0xa16207, roughness: 0.8 }));
    const band = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.1, 0.52), new THREE.MeshStandardMaterial({ color: line.colours[0] }));
    band.position.y = 0.1;
    carton.add(box, band);
    const work = new Sequence(`stack shelf ${bay + 1}`, [host.actor]);
    work.maxSeconds = 60;
    const [sx, sz] = this.stand(bay);
    work.add(
      steps.walk(host.actor, this.room.at(STOCKROOM[0], STOCKROOM[1] + 1.6), { speed: 3.4 }),
      steps.face(host.actor, this.room.at(STOCKROOM[0], STOCKROOM[1])),
      steps.animate(host.actor, { arms: 'reach' }, 0.8, [{ at: 0.7, run: () => host.actor.carry(carton) }]),
      steps.walk(host.actor, this.room.at(sx, sz), { speed: 3 }),
      steps.face(host.actor, this.room.at(BAY_AT[bay][0], BAY_AT[bay][1])),
      steps.animate(host.actor, { arms: 'reach' }, 1.6, [{
        at: 0.85,
        run: () => {
          host.actor.letGo();
          const moved = this.market.stack(bay);
          const now = this.market.bays()[bay];
          host.say(moved > 0 ? `${line.name} stacked on shelf ${bay + 1}: ${Math.ceil(now.units / line.units)} of ${BAY_CARTONS} cartons.` : 'That shelf filled up before you got there.', 'success');
        },
      }])
    );
    work.onEnd(() => {
      if (host.actor.carried === carton) host.actor.letGo();
    });
    host.director.run(work);
  }

  private chooseLine(bay: number, host: PlaceHost): void {
    const front = bay < FRONT_BAYS;
    host.ask({
      who: `Shelf ${bay + 1}`,
      role: front ? 'By the tills: drinks and snacks sell best here' : 'At the back: staples sell a little better here',
      text: 'What goes on this shelf? Whatever is on it now goes to the stockroom.',
      choices: [
        ...LINES.map((line) => ({
          label: `${line.icon} ${line.name}`,
          note: `${word(this.market.cartonsInBack(line.id), 'carton')} in the back${line.impulse ? ' · sells best by the tills' : ''}`,
          pick: () => {
            this.market.layOut(bay, line.id);
            if (this.market.inBack(line.id) > 0) this.carry(bay, host);
            else host.say(`Shelf ${bay + 1} is for ${line.name.toLowerCase()} now. Order some at the office desk.`, 'info');
          },
        })),
        { label: 'Leave it as it is', pick: () => undefined },
      ],
    });
  }

  private addCards(): void {
    for (let i = 0; i < BAYS; i++) {
      const [x, z] = BAY_AT[i];
      this.room.addCard({
        id: `supermarket_bay_${i}`,
        name: `🛒 Shelf ${i + 1}`,
        description: i < FRONT_BAYS ? 'A shelf by the tills.' : 'A shelf at the back of the shop.',
        at: [x, z],
        stand: this.stand(i),
        label: () => {
          const bay = this.bays()[i];
          const line = lineOf(bay.line);
          if (!this.market.owned()) return line ? `🛒 ${line.name}: take one (₦${line.retail.toLocaleString()})` : '🛒 Empty shelf';
          return line ? `🛒 Shelf ${i + 1}: ${line.name} · ${Math.ceil(bay.units / line.units)} of ${BAY_CARTONS} cartons` : `🛒 Shelf ${i + 1}: empty, choose what goes here`;
        },
        run: (host) => {
          const bay = this.bays()[i];
          const line = lineOf(bay.line);
          if (!this.market.owned()) {
            if (!line) return;
            // A shopper: one off the shelf, paid for there and then
            host.director.perform({
              id: `take ${line.name}`, actor: host.actor, point: this.room.at(...this.stand(i)), target: this.room.at(x, z), animation: { arms: 'reach' }, seconds: 1.4, effectAt: 0.6, ifStuck: 'snap',
              effect: () => {
                if (!host.backend.pay(line.retail, `${line.name}, Naija Fresh`, 'FOOD_PURCHASE')) {
                  host.say(`That is ₦${line.retail.toLocaleString()}. You do not have it.`, 'warning');
                  return false;
                }
                host.backend.addItem({ id: `nf_${line.id}`, name: `${line.name} (one)`, icon: line.icon, price: line.retail, category: ['drinks', 'snacks', 'noodles', 'rice', 'bread', 'frozen', 'oil'].includes(line.id) ? 'food' : 'tool', usable: ['drinks', 'snacks', 'bread'].includes(line.id), description: `From Naija Fresh Supermarket, ₦${line.retail.toLocaleString()}.`, energyRestore: line.id === 'drinks' || line.id === 'snacks' ? 8 : undefined });
                host.say(`${line.name}: paid ₦${line.retail.toLocaleString()} at the shelf scanner, into your bag.`, 'success');
                return true;
              },
            });
            return;
          }
          if (!line) {
            this.chooseLine(i, host);
            return;
          }
          const why = this.market.cannotStack(i);
          host.ask({
            who: `Shelf ${i + 1}: ${line.name}`,
            role: `${Math.ceil(bay.units / line.units)} of ${BAY_CARTONS} cartons · ${word(this.market.cartonsInBack(line.id), 'carton')} in the back`,
            text: i < FRONT_BAYS ? 'By the tills.' : 'At the back of the shop.',
            choices: [
              { label: `Carry a carton out from the back`, note: why ?? `${line.carton}`, pick: () => this.carry(i, host) },
              { label: 'Put something else here', note: 'What is on it goes to the back', pick: () => this.chooseLine(i, host) },
              { label: 'Leave it', pick: () => undefined },
            ],
          });
        },
      });
    }

    // The office desk: the wholesaler's number, or, before it is sold, the agent selling it
    this.room.addCard({
      id: 'supermarket_desk',
      name: '📋 The office',
      description: 'Where the stock is ordered.',
      at: DESK,
      stand: [DESK[0], DESK[1] + 1.4],
      label: () => (this.market.owned() ? '📋 Order stock from the wholesaler' : '📋 This supermarket is for sale'),
      run: (host) => {
        if (!this.market.owned()) {
          const biz = this.backend.getData().businesses.find((b) => b.id === SUPERMARKET);
          host.ask({
            who: 'Mr Adewale', role: 'Selling the business',
            text: `The shop, the shelves, the tills and the stockroom: ₦${(biz?.purchasePrice ?? 0).toLocaleString()}. You order your own stock and lay it out as you like.`,
            choices: [{ label: 'See it in the Business app', pick: () => PlaceOpeners.open(`app:business:b:${SUPERMARKET}`) }, { label: 'Not now', pick: () => undefined }],
          });
          return;
        }
        host.ask({
          who: 'Wholesaler', role: 'On the phone from Trade Fair',
          text: 'What do you need? We deliver to your stockroom today.',
          choices: [
            ...LINES.map((line) => ({
              label: `${line.icon} ${line.name}`,
              note: `₦${line.cost.toLocaleString()} a ${line.carton} · ${word(this.market.cartonsInBack(line.id), 'carton')} in the back`,
              pick: () => host.ask({
                who: 'Wholesaler', role: line.name,
                text: `How many? ₦${line.cost.toLocaleString()} for each ${line.carton}; it sells for ₦${(line.units * line.retail).toLocaleString()} on the shelf.`,
                choices: [2, 4, 8].map((n) => ({
                  label: `${n} cartons`,
                  note: `₦${(n * line.cost).toLocaleString()}`,
                  pick: () => {
                    host.director.perform({
                      id: 'order stock', actor: host.actor, point: this.room.at(DESK[0], DESK[1] + 1.4), target: this.room.at(DESK[0], DESK[1]), animation: { arms: 'talk' }, seconds: 1.6, effectAt: 0.9, ifStuck: 'snap',
                      effect: () => {
                        const done = this.market.order(line.id, n);
                        host.say(done.ok ? `${n} cartons of ${line.name.toLowerCase()} delivered to the stockroom: ₦${done.cost!.toLocaleString()}.` : done.reason ?? '', done.ok ? 'success' : 'warning');
                        return done.ok;
                      },
                    });
                  },
                })),
              }),
            })),
            { label: 'Nothing today', pick: () => undefined },
          ],
        });
      },
    });

    // The tills: a week's shopping in one go, while it is still somebody else's shop
    this.room.addCard({
      id: 'supermarket_till',
      name: '🧾 The tills',
      description: 'Pay here.',
      at: TILLS[0],
      stand: [TILLS[0][0], TILLS[0][1] - 1.3],
      label: () => (this.market.owned() ? `🧾 Your tills: ₦${this.companies.takenToday(SUPERMARKET).toLocaleString()} taken today` : '🧾 A week of groceries · ₦45,000'),
      run: (host) => {
        if (this.market.owned()) {
          host.say(`₦${this.companies.takenToday(SUPERMARKET).toLocaleString()} through the tills today. The takings are in the Business app.`, 'info');
          return;
        }
        host.director.perform({
          id: 'groceries', actor: host.actor, point: this.room.at(TILLS[0][0], TILLS[0][1] - 1.3), target: this.room.at(TILLS[0][0], TILLS[0][1]), animation: { arms: 'carry' }, seconds: 2.2, effectAt: 0.7, ifStuck: 'snap',
          effect: () => {
            if (!host.backend.pay(45000, 'A week of groceries, Naija Fresh', 'FOOD_PURCHASE')) {
              host.say('That is ₦45,000. You do not have it.', 'warning');
              return false;
            }
            host.backend.addItem({ id: 'groceries_week', name: 'A week of groceries', icon: '🛒', price: 45000, category: 'food', usable: true, description: 'Rice, bread, eggs, milk, noodles and drinks.', energyRestore: 30 });
            host.say('Rice, bread, eggs, milk, noodles, drinks: bagged and paid.', 'success');
            return true;
          },
        });
      },
    });
  }
}

export const SUPERMARKET_SPEC: PlaceSpec = {
  key: 'naija-fresh',
  name: 'Naija Fresh Supermarket',
  district: 'Ikeja · Ikorodu Road',
  room: { width: W, length: L, height: 4.5, floor: 0xf1f5f9, wall: 0xf8fafc },
  sign: { text: 'NAIJA FRESH SUPERMARKET', sub: 'Groceries · Drinks · Household', bg: '#16a34a' },
  build: (b) => {
    // The shelf units, their goods drawn separately as stock comes and goes
    for (const [x, z] of BAY_AT) b.box(0x57534e, BAY_W, 2.1, 0.5, x, 0, z - 0.1).box(0x78716c, BAY_W, 0.04, 0.42, x, 0.18, z + 0.1).box(0x78716c, BAY_W, 0.04, 0.42, x, 0.84, z + 0.1).box(0x78716c, BAY_W, 0.04, 0.42, x, 1.5, z + 0.1);
    // Tills by the door
    for (const [x, z] of TILLS) b.box(0x16a34a, 2.2, 1, 0.8, x, 0, z).box(0x1f2937, 0.4, 0.3, 0.3, x + 0.6, 1, z).box(0x111827, 1.6, 0.04, 0.6, x - 0.3, 1.01, z);
    // The office desk and the stockroom's door frame
    b.box(0xd6d3d1, 1.8, 0.75, 0.8, DESK[0], 0, DESK[1]).box(0x0f172a, 0.6, 0.4, 0.05, DESK[0], 0.78, DESK[1] - 0.2).box(0x38bdf8, 0.5, 0.3, 0.02, DESK[0], 0.82, DESK[1] - 0.17, { glow: true });
    b.box(0x78716c, 0.2, 3, 0.2, STOCKROOM[0] - 3.6, 0, STOCKROOM[1] + 1).box(0x78716c, 0.2, 3, 0.2, STOCKROOM[0] + 3, 0, STOCKROOM[1] + 1).box(0x78716c, 6.8, 0.25, 0.2, STOCKROOM[0] - 0.3, 3, STOCKROOM[1] + 1);
    // Trolleys and baskets by the door
    for (let i = 0; i < 4; i++) b.box(0x9ca3af, 0.6, 0.9, 0.9, 8 + i * 0.5, 0, L / 2 - 1.6);
    b.box(0xdc2626, 0.5, 0.25, 0.35, 5.5, 0, L / 2 - 1.5).box(0xdc2626, 0.5, 0.25, 0.35, 5.5, 0.25, L / 2 - 1.5);
  },
  staff: [],
  regulars: [
    { at: [-6, 3.6], facing: Math.PI, outfit: 0x2563eb, gender: 'female' },
    { at: [6, -3.4], facing: 0.4, outfit: 0xf97316 },
    { at: [-6, 7.8], facing: Math.PI, outfit: 0xdb2777, gender: 'female' },
  ],
  stations: [],
  attach: (room) => {
    new SupermarketView(room);
  },
};
