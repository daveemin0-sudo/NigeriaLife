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
 * Prices are in the game's own money and are not real showroom prices.
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
    id: 'okada', name: 'Boxer Okada', icon: '🏍️', type: 'okada', price: 280_000, blurb: 'A motorbike: quick through go-slow, nothing between you and the weather.',
    drive: { maxSpeed: 28, reverseSpeed: 6, acceleration: 24, braking: 22, turnSpeed: 4.2, friction: 2.5, hornText: '📢 PEEP-PEEP!' },
  },
  {
    id: 'keke', name: 'King Keke', icon: '🛺', type: 'keke', price: 650_000, blurb: 'A three-wheeler: slow, cheap to run, turns in its own length.',
    drive: { maxSpeed: 18, reverseSpeed: 7, acceleration: 17, braking: 18, turnSpeed: 3.4, friction: 2.8, hornText: '📢 PII-PII!' },
  },
  {
    id: 'danfo', name: 'Danfo Bus', icon: '🚐', type: 'danfo', price: 4_800_000, blurb: 'Fourteen seats and a sliding door. The working vehicle of Lagos.',
    drive: { maxSpeed: 24, reverseSpeed: 8, acceleration: 15, braking: 16, turnSpeed: 2.3, friction: 2.2, hornText: '📢 PAA-PAA!' },
  },
  {
    id: 'suv', name: 'Prado SUV', icon: '🚙', type: 'suv', price: 9_500_000, blurb: 'Big, black and fast. People move out of its way.',
    drive: { maxSpeed: 32, reverseSpeed: 10, acceleration: 22, braking: 20, turnSpeed: 2.6, friction: 2.0, hornText: '📢 POM-POM!' },
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

  /** Records driving done in a vehicle: distance on the clock and the wear that goes with it. Only its owner can. */
  public async addMileage(id: string, kilometres: number, parkedAt?: { x: number; z: number; yaw: number }): Promise<void> {
    if (kilometres <= 0 && !parkedAt) return;
    await this.registry.transact((state) => {
      const record = state.vehicles[id];
      if (!record || state.titles[assetKey({ kind: 'vehicle', id })]?.ownerId !== MY_ID) return;
      record.mileage = Math.round((record.mileage + kilometres) * 10) / 10;
      record.condition = Math.max(20, Math.round((record.condition - kilometres * 0.2) * 10) / 10);
      if (parkedAt) record.parkedAt = { x: Math.round(parkedAt.x * 10) / 10, z: Math.round(parkedAt.z * 10) / 10, yaw: Math.round(parkedAt.yaw * 100) / 100 };
    });
  }
}
