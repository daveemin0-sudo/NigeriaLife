import { BackendService } from '../backend/BackendService';
import type { VehicleConfig, VehicleType } from '../world/DrivableVehicle';
import { AssetMarket, type AssetProvider } from './AssetMarket';
import { Registry, MY_ID } from './Registry';
import { assetKey, type Listing, type Outcome, type RegistryState, type VehicleRecord } from './types';

/**
 * Vehicles a player can own. A dealer sells them new; after that a vehicle is one particular
 * machine with its own plate, mileage and condition, and it belongs to exactly one player
 * until that player sells it to another through the market.
 *
 * Prices follow what each costs in Nigeria in 2025, new or clean foreign-used, in naira.
 */
export interface VehicleModel {
  id: string;
  name: string;
  icon: string;
  type: VehicleType;
  price: number;
  blurb: string;
  drive: Omit<VehicleConfig, 'id' | 'name' | 'type'>;
}

export const VEHICLE_MODELS: VehicleModel[] = [
  {
    id: 'okada', name: 'Boxer Okada', icon: '🏍️', type: 'okada', price: 1_850_000, blurb: 'A motorbike: quick through go-slow, nothing between you and the weather.',
    drive: { maxSpeed: 28, reverseSpeed: 6, acceleration: 24, braking: 22, turnSpeed: 4.2, friction: 2.5, hornText: '📢 PEEP-PEEP!' },
  },
  {
    id: 'keke', name: 'King Keke', icon: '🛺', type: 'keke', price: 5_800_000, blurb: 'A three-wheeler: slow, cheap to run, turns in its own length.',
    drive: { maxSpeed: 18, reverseSpeed: 7, acceleration: 17, braking: 18, turnSpeed: 3.4, friction: 2.8, hornText: '📢 PII-PII!' },
  },
  {
    id: 'sedan', name: 'Toyota Corolla Tokunbo', icon: '🚗', type: 'sedan', price: 19_500_000, blurb: 'The king of Lagos roads. Reliable, cold AC, trusted by ride-hailers and civil servants.',
    drive: { maxSpeed: 30, reverseSpeed: 9, acceleration: 20, braking: 20, turnSpeed: 3.0, friction: 2.1, hornText: '📢 PEEP-PEEP!' },
  },
  {
    id: 'danfo', name: 'Danfo Bus', icon: '🚐', type: 'danfo', price: 28_000_000, blurb: 'Fourteen seats and a sliding door. The working commercial backbone of Lagos.',
    drive: { maxSpeed: 24, reverseSpeed: 8, acceleration: 15, braking: 16, turnSpeed: 2.3, friction: 2.2, hornText: '📢 PAA-PAA!' },
  },
  {
    id: 'suv', name: 'Prado TXL SUV', icon: '🚙', type: 'suv', price: 120_000_000, blurb: 'Big, black, high clearance. Potholes on Ikorodu road disappear under its tires.',
    drive: { maxSpeed: 32, reverseSpeed: 10, acceleration: 22, braking: 20, turnSpeed: 2.6, friction: 2.0, hornText: '📢 POM-POM!' },
  },
  {
    id: 'ambulance', name: 'LASAMBUS Emergency Rescue Van', icon: '🚑', type: 'ambulance', price: 65_000_000, blurb: 'Lagos State Emergency high-roof responder van with siren strobe lightbar.',
    drive: { maxSpeed: 34, reverseSpeed: 10, acceleration: 23, braking: 24, turnSpeed: 2.5, friction: 2.1, hornText: '🚨 WEE-WOO!' },
  },
  {
    id: 'luxury_sedan', name: 'Mercedes-Maybach S680', icon: '🚘', type: 'luxury_sedan', price: 780_000_000, blurb: 'Obsidian black VIP flagship sedan with panoramic glass and vertical waterfall grille.',
    drive: { maxSpeed: 38, reverseSpeed: 12, acceleration: 28, braking: 26, turnSpeed: 2.8, friction: 1.8, hornText: '📢 HONK-HONK!' },
  },
  {
    id: 'electric_car', name: 'Tesla Model S Plaid EV', icon: '⚡', type: 'electric_car', price: 290_000_000, blurb: 'Instant electric torque, continuous LED lightbars, zero fuel visits required.',
    drive: { maxSpeed: 42, reverseSpeed: 14, acceleration: 36, braking: 30, turnSpeed: 3.2, friction: 1.7, hornText: '🔔 CHIME-CHIME!' },
  },
  {
    id: 'gwagon', name: 'Mercedes-AMG G63 G-Wagon', icon: '🦾', type: 'gwagon', price: 480_000_000, blurb: 'Matte black V8 Biturbo, Panamericana grille, side exhausts and bull bar. Billionaires row signature.',
    drive: { maxSpeed: 36, reverseSpeed: 11, acceleration: 30, braking: 25, turnSpeed: 2.4, friction: 1.9, hornText: '📢 BOOM-BOOM!' },
  },
  {
    id: 'sports_car', name: 'Porsche 911 GT3 Supercar', icon: '🏎️', type: 'sports_car', price: 650_000_000, blurb: 'Rosso Corsa Crimson, carbon aero splitter, GT wing spoiler and quad titanium exhausts.',
    drive: { maxSpeed: 46, reverseSpeed: 14, acceleration: 38, braking: 32, turnSpeed: 3.8, friction: 1.6, hornText: '📢 BEEP-BEEP!' },
  },
  {
    id: 'superbike', name: 'Power Bike 650', icon: '🏍️', type: 'okada', price: 6_500_000, blurb: 'A big 650cc bike for the express: fast, loud, not for the go-slow.',
    drive: { maxSpeed: 40, reverseSpeed: 6, acceleration: 34, braking: 26, turnSpeed: 4.4, friction: 2.3, hornText: '📢 PEEP-PEEP!' },
  },
  {
    id: 'corolla_2008', name: 'Toyota Corolla 2008 "Big Daddy"', icon: '🚗', type: 'sedan', price: 9_800_000, blurb: 'The car every Lagos uncle has driven. Cheap to fix, cheap to fuel.',
    drive: { maxSpeed: 30, reverseSpeed: 9, acceleration: 20, braking: 20, turnSpeed: 3.0, friction: 2.1, hornText: '📢 PEEP-PEEP!', body: 'corolla_2008', paint: 0xb91c1c },
  },
  {
    id: 'corolla_2020', name: 'Toyota Corolla 2020', icon: '🚗', type: 'sedan', price: 32_000_000, blurb: 'Sharp new face, quiet cabin, ride-hailing favourite.',
    drive: { maxSpeed: 30, reverseSpeed: 9, acceleration: 20, braking: 20, turnSpeed: 3.0, friction: 2.1, hornText: '📢 PEEP-PEEP!', body: 'corolla_2020', paint: 0xf8fafc },
  },
  {
    id: 'camry', name: 'Toyota Camry 2018', icon: '🚗', type: 'sedan', price: 38_000_000, blurb: '"Muscle" Camry: big, soft, respected at any gate.',
    drive: { maxSpeed: 30, reverseSpeed: 9, acceleration: 20, braking: 20, turnSpeed: 3.0, friction: 2.1, hornText: '📢 PEEP-PEEP!', body: 'camry', paint: 0x1e3a8a },
  },
  {
    id: 'accord', name: 'Honda Accord 2019', icon: '🚗', type: 'sedan', price: 42_000_000, blurb: "Low and sleek. The young professional's choice.",
    drive: { maxSpeed: 30, reverseSpeed: 9, acceleration: 20, braking: 20, turnSpeed: 3.0, friction: 2.1, hornText: '📢 PEEP-PEEP!', body: 'accord', paint: 0x6b7280 },
  },
  {
    id: 'lexus_rx', name: 'Lexus RX 350', icon: '🚙', type: 'suv', price: 85_000_000, blurb: "Smooth, silent, the madam's car of choice from Lekki to GRA.",
    drive: { maxSpeed: 32, reverseSpeed: 10, acceleration: 22, braking: 20, turnSpeed: 2.6, friction: 2.0, hornText: '📢 POM-POM!', body: 'lexus_rx', paint: 0xe5e7eb },
  },
  {
    id: 'highlander', name: 'Toyota Highlander', icon: '🚙', type: 'suv', price: 72_000_000, blurb: 'Seven seats for the family, school runs to Owambe.',
    drive: { maxSpeed: 32, reverseSpeed: 10, acceleration: 22, braking: 20, turnSpeed: 2.6, friction: 2.0, hornText: '📢 POM-POM!', body: 'highlander', paint: 0x78350f },
  },
  {
    id: 'range_rover', name: 'Range Rover Autobiography', icon: '🚙', type: 'suv', price: 420_000_000, blurb: 'Floating roof, upright stance, the arrival car.',
    drive: { maxSpeed: 38, reverseSpeed: 12, acceleration: 28, braking: 26, turnSpeed: 2.8, friction: 1.8, hornText: '📢 HONK-HONK!', body: 'range_rover', paint: 0x14532d },
  },
  {
    id: 'cayenne', name: 'Porsche Cayenne Turbo', icon: '🚙', type: 'suv', price: 380_000_000, blurb: 'A sports car you can take the family in.',
    drive: { maxSpeed: 36, reverseSpeed: 11, acceleration: 30, braking: 25, turnSpeed: 2.4, friction: 1.9, hornText: '📢 BOOM-BOOM!', body: 'cayenne', paint: 0x9ca3af },
  },
  {
    id: 'bmw_7', name: 'BMW 7 Series', icon: '🚘', type: 'luxury_sedan', price: 520_000_000, blurb: 'Big kidney grille, back-seat business class.',
    drive: { maxSpeed: 38, reverseSpeed: 12, acceleration: 28, braking: 26, turnSpeed: 2.8, friction: 1.8, hornText: '📢 HONK-HONK!', body: 'bmw_7', paint: 0x0f172a },
  },
  {
    id: 'panamera', name: 'Porsche Panamera', icon: '🚘', type: 'electric_car', price: 480_000_000, blurb: 'Four doors, all of them fast.',
    drive: { maxSpeed: 42, reverseSpeed: 14, acceleration: 36, braking: 30, turnSpeed: 3.2, friction: 1.7, hornText: '📢 HONK-HONK!', body: 'panamera', paint: 0x334155 },
  },
  {
    id: 'porsche_911', name: 'Porsche 911 Carrera S', icon: '🏎️', type: 'sports_car', price: 420_000_000, blurb: 'The classic shape: round lamps, rear engine, pure driving.',
    drive: { maxSpeed: 46, reverseSpeed: 14, acceleration: 38, braking: 32, turnSpeed: 3.8, friction: 1.6, hornText: '📢 BEEP-BEEP!', body: 'porsche_911', paint: 0xf8fafc },
  },
  {
    id: 'urus', name: 'Lamborghini Urus', icon: '🚙', type: 'suv', price: 650_000_000, blurb: 'A super SUV: Lambo noise on Lagos roads.',
    drive: { maxSpeed: 36, reverseSpeed: 11, acceleration: 30, braking: 25, turnSpeed: 2.4, friction: 1.9, hornText: '📢 BOOM-BOOM!', body: 'urus', paint: 0xeab308 },
  },
  {
    id: 'cullinan', name: 'Rolls-Royce Cullinan', icon: '🚙', type: 'gwagon', price: 1_450_000_000, blurb: 'The tallest, quietest, most expensive arrival there is.',
    drive: { maxSpeed: 38, reverseSpeed: 12, acceleration: 28, braking: 26, turnSpeed: 2.8, friction: 1.8, hornText: '📢 HONK-HONK!', body: 'cullinan', paint: 0x1f2937 },
  },
  {
    id: 'huracan', name: 'Lamborghini Huracán', icon: '🏎️', type: 'sports_car', price: 720_000_000, blurb: 'Sharp wedge, V10 scream. Everyone at the junction turns round.',
    drive: { maxSpeed: 46, reverseSpeed: 14, acceleration: 38, braking: 32, turnSpeed: 3.8, friction: 1.6, hornText: '📢 BEEP-BEEP!', body: 'huracan', paint: 0x84cc16 },
  },
  {
    id: 'aventador', name: 'Lamborghini Aventador SVJ', icon: '🏎️', type: 'sports_car', price: 1_250_000_000, blurb: 'V12, a wing, doors that go up. Banana Island money.',
    drive: { maxSpeed: 58, reverseSpeed: 14, acceleration: 48, braking: 38, turnSpeed: 3.6, friction: 1.5, hornText: '📢 VROOM!', body: 'aventador', paint: 0xf97316 },
  },
  {
    id: 'chiron', name: 'Bugatti Chiron', icon: '🏎️', type: 'sports_car', price: 4_800_000_000, blurb: 'The fastest thing on any Nigerian road. Billionaires only.',
    drive: { maxSpeed: 58, reverseSpeed: 14, acceleration: 48, braking: 38, turnSpeed: 3.6, friction: 1.5, hornText: '📢 VROOM!', body: 'chiron', paint: 0x1d4ed8 },
  },
];

export const vehicleModel = (id: string): VehicleModel | null => VEHICLE_MODELS.find((model) => model.id === id) ?? null;

const fail = (reason: string): Outcome => ({ ok: false, reason });
const naira = (amount: number) => `₦${Math.round(amount).toLocaleString()}`;

function newPlate(serial: number): string {
  const letters = 'ABCDEFGHJKLMNPRSTUVWXYZ';
  const pick = (seed: number) => letters[seed % letters.length];
  return `LAG-${String(100 + ((serial * 37) % 900))}-${pick(serial * 7)}${pick(serial * 13 + 5)}`;
}

/** A rough guide to what a used vehicle is worth, shown to sellers and buyers. Nobody has to keep to it. */
export function guidePrice(model: VehicleModel, record: VehicleRecord): number {
  const wear = Math.max(0.35, (record.condition / 100) * Math.max(0.5, 1 - record.mileage / 4000));
  return Math.round((model.price * 0.85 * wear) / 10_000) * 10_000;
}

export class Garage {
  private static instance: Garage | null = null;
  private readonly registry = Registry.get();
  private readonly market = AssetMarket.get();
  private readonly backend = BackendService.getInstance();

  private constructor() {
    this.market.provide(this.provider());
  }

  public static get(): Garage {
    if (!Garage.instance) Garage.instance = new Garage();
    return Garage.instance;
  }

  private provider(): AssetProvider {
    return {
      kind: 'vehicle',
      describe: (id) => {
        const record = this.registry.peek().vehicles[id];
        const model = record ? vehicleModel(record.modelId) : null;
        return model && record ? `${model.name} (${record.plate})` : 'a vehicle';
      },
      exists: (id, state) => !!state.vehicles[id],
      // A particular vehicle is never sold by the state: new ones come from the dealer
      firstPrice: () => null,
      cannotSell: () => null,
    };
  }

  // --- Reading ----------------------------------------------------------------------------------

  public record(id: string): VehicleRecord | null {
    return this.registry.peek().vehicles[id] ?? null;
  }

  public ownerOf(id: string): string | null {
    return this.market.ownerOf({ kind: 'vehicle', id });
  }

  /** The vehicles this player owns, as the registry has them now. */
  public mine(state: RegistryState = this.registry.peek()): VehicleRecord[] {
    return Object.values(state.vehicles).filter((record) => state.titles[assetKey({ kind: 'vehicle', id: record.id })]?.ownerId === MY_ID);
  }

  public listingFor(id: string): Listing | null {
    return this.market.listingFor({ kind: 'vehicle', id });
  }

  /** Vehicles other players have put up for sale. */
  public forSale(): Listing[] {
    return this.market.listings((listing) => listing.asset.kind === 'vehicle');
  }

  // --- Buying new -----------------------------------------------------------------------------------

  /** Buys a new vehicle from the dealer. It is made, registered to the buyer and paid for in one step. */
  public async buyNew(modelId: string): Promise<Outcome & { vehicleId?: string }> {
    return this.registry.transact((state): Outcome & { vehicleId?: string } => {
      const model = vehicleModel(modelId);
      if (!model) return fail('The dealer does not sell that.');
      if (this.market.funds() < model.price) return fail(`A ${model.name} is ${naira(model.price)} and you have ${naira(this.market.funds())} in all.`);
      const paid = this.backend.processTransaction({ type: 'ASSET_PURCHASE', amount: model.price, description: `New ${model.name} from Ojota Motors`, source: 'bank', funding: 'split' });
      if (!paid.success) return fail('The payment did not go through, so nothing was bought.');

      const id = Registry.nextId(state, 'car');
      const now = Date.now();
      state.vehicles[id] = { id, modelId: model.id, condition: 100, mileage: 0, plate: newPlate(state.serial), boughtNewAt: now };
      const saleId = Registry.nextId(state, 'sale');
      state.titles[assetKey({ kind: 'vehicle', id })] = { ownerId: MY_ID, history: [{ at: now, from: null, to: MY_ID, price: model.price, saleId }] };
      state.sales.push({ id: saleId, asset: { kind: 'vehicle', id }, sellerId: null, buyerId: MY_ID, price: model.price, fee: 0, at: now });
      return { ok: true, vehicleId: id };
    });
  }

  /** Records what is in a vehicle's tank. Only its owner can. */
  public async setFuel(id: string, fuel: number): Promise<void> {
    await this.registry.transact((state) => {
      const record = state.vehicles[id];
      if (!record || state.titles[assetKey({ kind: 'vehicle', id })]?.ownerId !== MY_ID) return;
      record.fuel = Math.round(Math.max(0, Math.min(100, fuel)) * 10) / 10;
    });
  }

  /** Records driving done in a vehicle: distance on the clock and the wear that goes with it. Only its owner can. */
  public async addMileage(id: string, kilometres: number, parkedAt?: { x: number; z: number; yaw: number; city?: string }): Promise<void> {
    if (kilometres <= 0 && !parkedAt) return;
    await this.registry.transact((state) => {
      const record = state.vehicles[id];
      if (!record || state.titles[assetKey({ kind: 'vehicle', id })]?.ownerId !== MY_ID) return;
      record.mileage = Math.round((record.mileage + kilometres) * 10) / 10;
      record.condition = Math.max(20, Math.round((record.condition - kilometres * 0.2) * 10) / 10);
      if (parkedAt) record.parkedAt = { x: Math.round(parkedAt.x * 10) / 10, z: Math.round(parkedAt.z * 10) / 10, yaw: Math.round(parkedAt.yaw * 100) / 100, city: parkedAt.city ?? 'lagos' };
    });
  }
}
