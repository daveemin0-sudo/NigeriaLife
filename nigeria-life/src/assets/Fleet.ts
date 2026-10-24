import { BackendService } from '../backend/BackendService';
import { profileKey } from '../backend/Profile';

/**
 * Private jets and yachts. Bought outright at what they cost (in naira at about ₦1,600 to the
 * dollar), kept at the private airfield and the marina, each with the name its owner paints
 * on it and a colour of their choosing. A jet flies its owner to another city; a yacht takes
 * them out on the lagoon.
 */
export type FleetKind = 'jet' | 'yacht';

export interface FleetModel {
  id: string;
  kind: FleetKind;
  name: string;
  price: number;
  blurb: string;
  /** Overall length, metres, for drawing and for the berth */
  length: number;
  /** Seats (jet) or guests (yacht) */
  seats: number;
}

export const FLEET_MODELS: FleetModel[] = [
  { id: 'hondajet', kind: 'jet', name: 'HondaJet Elite', price: 11_500_000_000, length: 13, seats: 6, blurb: 'A light jet with its engines over the wings. Lagos to Abuja in an hour.' },
  { id: 'phenom', kind: 'jet', name: 'Embraer Phenom 300E', price: 17_000_000_000, length: 15.6, seats: 8, blurb: 'The best-selling light jet in the world. Quiet, quick, roomy.' },
  { id: 'challenger', kind: 'jet', name: 'Bombardier Challenger 350', price: 43_000_000_000, length: 20.9, seats: 10, blurb: 'Super-midsize: stand up in the cabin, fly coast to coast.' },
  { id: 'g650', kind: 'jet', name: 'Gulfstream G650ER', price: 112_000_000_000, length: 30.4, seats: 16, blurb: 'The jet of presidents and billionaires. Lagos to London non-stop.' },
  { id: 'global7500', kind: 'jet', name: 'Bombardier Global 7500', price: 120_000_000_000, length: 33.8, seats: 19, blurb: 'Four rooms in the sky, a bed, a shower. The biggest of them all.' },
  { id: 'speedboat', kind: 'yacht', name: 'Lagos Speedboat 35', price: 480_000_000, length: 11, seats: 8, blurb: 'Twin outboards, white leather, spray in your face.' },
  { id: 'sunseeker', kind: 'yacht', name: 'Sunseeker Manhattan 55', price: 4_000_000_000, length: 17, seats: 12, blurb: 'A flybridge, three cabins, a party on the sun deck.' },
  { id: 'azimut', kind: 'yacht', name: 'Azimut Grande 27', price: 13_000_000_000, length: 27, seats: 20, blurb: 'A proper motor yacht: crew, a jacuzzi, sunsets on the lagoon.' },
  { id: 'superyacht', kind: 'yacht', name: 'Benetti Oasis 40m Superyacht', price: 64_000_000_000, length: 40, seats: 30, blurb: 'Pool on the stern, beach club, helipad. Banana Island has nothing like it.' },
];

export const FLEET_COLOURS: Array<{ id: string; name: string; hex: number }> = [
  { id: 'white', name: 'Pearl white', hex: 0xf8fafc },
  { id: 'black', name: 'Gloss black', hex: 0x111827 },
  { id: 'gold', name: 'Gold', hex: 0xd4af37 },
  { id: 'green', name: 'Naija green', hex: 0x15803d },
  { id: 'navy', name: 'Navy', hex: 0x1e3a8a },
  { id: 'red', name: 'Red', hex: 0xb91c1c },
  { id: 'silver', name: 'Silver', hex: 0x9ca3af },
  { id: 'purple', name: 'Royal purple', hex: 0x6d28d9 },
];

export interface OwnedCraft {
  uid: string;
  modelId: string;
  /** What is painted on it */
  name: string;
  colour: string;
}

export const fleetModel = (id: string): FleetModel | null => FLEET_MODELS.find((m) => m.id === id) ?? null;
export const fleetColour = (id: string): number => FLEET_COLOURS.find((c) => c.id === id)?.hex ?? 0xf8fafc;

/** How many of each kind fit: stands at the airfield, berths at the marina */
export const FLEET_SPACES: Record<FleetKind, number> = { jet: 4, yacht: 4 };

export class Fleet {
  private static instance: Fleet | null = null;
  public static get(): Fleet {
    return (this.instance ??= new Fleet());
  }

  private readonly key = profileKey('nigeria_life_fleet_v1');
  private owned: OwnedCraft[] = [];
  private listeners = new Set<() => void>();

  private constructor() {
    try {
      const saved = JSON.parse(localStorage.getItem(this.key) || '[]');
      if (Array.isArray(saved)) this.owned = saved.filter((c) => c && fleetModel(c.modelId)).slice(0, 12);
    } catch {
      // Nothing owned that can be read back
    }
  }

  public onChange(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private changed(): void {
    try {
      localStorage.setItem(this.key, JSON.stringify(this.owned));
    } catch {
      // Kept until the page is closed
    }
    for (const listener of this.listeners) listener();
  }

  public mine(kind?: FleetKind): OwnedCraft[] {
    return this.owned.filter((c) => !kind || fleetModel(c.modelId)?.kind === kind);
  }

  /** Buys one. Returns why not, or null. */
  public buy(modelId: string, name: string, colour: string): string | null {
    const model = fleetModel(modelId);
    if (!model) return 'That is not for sale.';
    if (this.mine(model.kind).length >= FLEET_SPACES[model.kind]) return model.kind === 'jet' ? 'Your stands at the airfield are full. Sell a jet first.' : 'Your berths at the marina are full. Sell a yacht first.';
    const painted = cleanName(name) || defaultName();
    const backend = BackendService.getInstance();
    const paid = backend.processTransaction({ type: 'ASSET_PURCHASE', amount: model.price, description: `${model.name} "${painted}"`, source: 'bank', funding: 'split' });
    if (!paid.success) return `${model.name} is ₦${model.price.toLocaleString()}. You do not have it.`;
    this.owned.push({ uid: `${modelId}-${Date.now().toString(36)}`, modelId, name: painted, colour: FLEET_COLOURS.some((c) => c.id === colour) ? colour : 'white' });
    this.changed();
    return null;
  }

  /** Paints a new name or colour on one */
  public repaint(uid: string, name: string, colour: string): boolean {
    const craft = this.owned.find((c) => c.uid === uid);
    if (!craft) return false;
    craft.name = cleanName(name) || craft.name;
    if (FLEET_COLOURS.some((c) => c.id === colour)) craft.colour = colour;
    this.changed();
    return true;
  }

  /** Sells one back for 70% of its price */
  public sell(uid: string): number {
    const at = this.owned.findIndex((c) => c.uid === uid);
    if (at < 0) return 0;
    const model = fleetModel(this.owned[at].modelId)!;
    const value = Math.round(model.price * 0.7);
    this.owned.splice(at, 1);
    BackendService.getInstance().processTransaction({ type: 'ASSET_SALE', amount: value, description: `Sold ${model.name}` });
    this.changed();
    return value;
  }
}

function cleanName(name: string): string {
  return name.replace(/[^\p{L}\p{N} .'&-]/gu, '').trim().slice(0, 16).toUpperCase();
}

function defaultName(): string {
  try {
    const data = BackendService.getInstance().getData();
    return cleanName(data.username || 'NAIJA ONE') || 'NAIJA ONE';
  } catch {
    return 'NAIJA ONE';
  }
}
