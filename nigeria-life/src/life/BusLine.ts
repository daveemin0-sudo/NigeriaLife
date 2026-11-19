import * as THREE from 'three';
import { BackendService } from '../backend/BackendService';
import { profileKey } from '../backend/Profile';

/**
 * A bus the player owns, on a city route. It runs while they are away: takings accrue from
 * the last time they were counted, and a bus is drawn on the road in the city it serves.
 */

const KEY = 'nl-bus-line';
const BUS_PRICE = 4_500_000;
const SERVICE = 80_000;
const DRIVER_WAGE = 8_000;
const CONDUCTOR_WAGE = 5_000;

export interface BusRoute {
  id: string;
  cityId: string;
  name: string;
  fare: number;
  /** Passengers an hour when the crew is on and the bus is fit */
  anHour: number;
  from: { x: number; z: number };
  to: { x: number; z: number };
}

export const BUS_ROUTES: BusRoute[] = [
  { id: 'brt-ikorodu', cityId: 'lagos', name: 'BRT · CMS to Ikorodu', fare: 400, anHour: 80, from: { x: -8, z: 40 }, to: { x: 12, z: -180 } },
  { id: 'nyanya-wuse', cityId: 'abuja', name: 'Nyanya to Wuse', fare: 300, anHour: 60, from: { x: 40, z: -80 }, to: { x: -160, z: 180 } },
  { id: 'mile1-rumuokoro', cityId: 'port_harcourt', name: 'Mile 1 to Rumuokoro', fare: 250, anHour: 70, from: { x: -80, z: 20 }, to: { x: 40, z: 160 } },
];

export interface OwnedBus {
  id: string;
  routeId: string;
  driver: boolean;
  conductor: boolean;
  /** 0 to 100. Drops as the days pass. Under 20 it does not run. */
  condition: number;
  servicedOn: number;
}

interface Book {
  buses: OwnedBus[];
  /** Takings not yet paid in */
  purse: number;
  countedAt: number;
}

const empty = (): Book => ({ buses: [], purse: 0, countedAt: Date.now() });

export class BusLine {
  private static inst: BusLine | null = null;
  private book: Book = empty();
  private group: THREE.Group | null = null;
  private city = '';

  public static get(): BusLine {
    if (!BusLine.inst) BusLine.inst = new BusLine();
    return BusLine.inst;
  }

  private constructor() {
    try {
      const raw = localStorage.getItem(profileKey(KEY));
      if (raw) this.book = { ...empty(), ...(JSON.parse(raw) as Book) };
    } catch {
      this.book = empty();
    }
  }

  public buses(): OwnedBus[] {
    return this.book.buses;
  }

  public purse(): number {
    this.settle();
    return this.book.purse;
  }

  public route(id: string): BusRoute | undefined {
    return BUS_ROUTES.find((r) => r.id === id);
  }

  public buy(routeId: string): { ok: boolean; message: string } {
    const route = this.route(routeId);
    if (!route) return { ok: false, message: 'That route is not running.' };
    if (this.book.buses.some((b) => b.routeId === routeId)) return { ok: false, message: 'You already have a bus on that route.' };
    const paid = BackendService.getInstance().processTransaction({
      type: 'ASSET_PURCHASE',
      amount: BUS_PRICE,
      description: `Bus for ${route.name}`,
      source: 'bank',
    });
    if (!paid.success) return { ok: false, message: `A bus is ₦${BUS_PRICE.toLocaleString()} and you do not have it.` };
    this.book.buses.push({
      id: `bus_${Date.now().toString(36)}`,
      routeId,
      driver: false,
      conductor: false,
      condition: 100,
      servicedOn: Date.now(),
    });
    this.save();
    return { ok: true, message: `${route.name} has your bus. Hire a driver and a conductor and it starts taking fares.` };
  }

  public hire(busId: string, who: 'driver' | 'conductor'): { ok: boolean; message: string } {
    const bus = this.book.buses.find((b) => b.id === busId);
    if (!bus) return { ok: false, message: 'That bus is not yours.' };
    if (bus[who]) return { ok: false, message: `The ${who} is already on.` };
    const wage = who === 'driver' ? DRIVER_WAGE : CONDUCTOR_WAGE;
    const paid = BackendService.getInstance().processTransaction({
      type: 'BUSINESS_EXPENSE',
      amount: wage,
      description: `${who} for the day`,
      source: 'bank',
    });
    if (!paid.success) return { ok: false, message: `The ${who} wants ₦${wage.toLocaleString()} for the day.` };
    bus[who] = true;
    this.save();
    return { ok: true, message: `The ${who} is on the bus.` };
  }

  public service(busId: string): { ok: boolean; message: string } {
    const bus = this.book.buses.find((b) => b.id === busId);
    if (!bus) return { ok: false, message: 'That bus is not yours.' };
    const paid = BackendService.getInstance().processTransaction({
      type: 'BUSINESS_EXPENSE',
      amount: SERVICE,
      description: 'Bus service',
      source: 'bank',
    });
    if (!paid.success) return { ok: false, message: `A service is ₦${SERVICE.toLocaleString()}.` };
    bus.condition = 100;
    bus.servicedOn = Date.now();
    this.save();
    return { ok: true, message: 'Serviced. It will run clean for a while.' };
  }

  public collect(): { ok: boolean; message: string; amount: number } {
    this.settle();
    const amount = Math.round(this.book.purse);
    if (amount < 1) return { ok: false, message: 'Nothing in the purse yet.', amount: 0 };
    BackendService.getInstance().processTransaction({
      type: 'BUSINESS_INCOME',
      amount,
      description: 'Bus takings',
      source: 'bank',
    });
    this.book.purse = 0;
    this.save();
    return { ok: true, message: `₦${amount.toLocaleString()} paid into the bank.`, amount };
  }

  /** Fares since the last count. A bus with no crew, or one that is worn out, earns nothing. */
  public settle(): void {
    const now = Date.now();
    const hours = Math.min(48, Math.max(0, (now - this.book.countedAt) / 3_600_000));
    if (hours < 1 / 60) return;
    for (const bus of this.book.buses) {
      const days = (now - bus.servicedOn) / 86_400_000;
      bus.condition = Math.max(0, Math.round(100 - days * 8));
      const route = this.route(bus.routeId);
      if (!route || !bus.driver || !bus.conductor || bus.condition < 20) continue;
      this.book.purse += route.fare * route.anHour * hours * (bus.condition / 100);
    }
    this.book.countedAt = now;
    this.save();
  }

  /** Draw each bus that serves this city, moving along its route. `stamp` is the city and the bus ids. */
  public draw(scene: THREE.Scene, stamp: string, hour: number): void {
    const cityId = stamp.split(':')[0];
    if (!this.group) {
      this.group = new THREE.Group();
      this.group.name = 'bus-line';
      scene.add(this.group);
    }
    if (this.city !== stamp) {
      this.city = stamp;
      this.group.clear();
      for (const bus of this.book.buses) {
        const route = this.route(bus.routeId);
        if (!route || route.cityId !== cityId) continue;
        const mesh = new THREE.Group();
        mesh.name = bus.id;
        const body = new THREE.Mesh(new THREE.BoxGeometry(2.4, 2.6, 8), new THREE.MeshStandardMaterial({ color: 0x1d4ed8, roughness: 0.5 }));
        body.position.y = 1.5;
        const roof = new THREE.Mesh(new THREE.BoxGeometry(2.3, 0.3, 7.6), new THREE.MeshStandardMaterial({ color: 0xf8fafc }));
        roof.position.y = 2.9;
        mesh.add(body, roof);
        this.group.add(mesh);
      }
    }
    const t = (Math.sin((hour / 24) * Math.PI * 2) + 1) / 2;
    for (const child of this.group.children) {
      const bus = this.book.buses.find((b) => b.id === child.name);
      const route = bus ? this.route(bus.routeId) : undefined;
      if (!route) continue;
      child.position.set(
        route.from.x + (route.to.x - route.from.x) * t,
        0,
        route.from.z + (route.to.z - route.from.z) * t,
      );
      child.lookAt(route.to.x, 0, route.to.z);
    }
  }

  private save(): void {
    try {
      localStorage.setItem(profileKey(KEY), JSON.stringify(this.book));
    } catch {
      // The next open of the app counts again
    }
  }
}

export const BUS_PRICE_NAIRA = BUS_PRICE;
export const BUS_SERVICE_NAIRA = SERVICE;
export const BUS_DRIVER_WAGE = DRIVER_WAGE;
export const BUS_CONDUCTOR_WAGE = CONDUCTOR_WAGE;
