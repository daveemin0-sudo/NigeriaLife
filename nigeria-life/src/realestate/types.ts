/**
 * The things that are kept apart on purpose:
 *
 *   a PLOT is a parcel of land. It has a fixed place and boundary and never moves or changes shape;
 *   a BUILDING is a structure standing on a plot. It can be built, finished, pulled down and replaced;
 *   a LISTING is an owner offering one asset for sale at an asking price;
 *   a NEGOTIATION is one buyer and the seller exchanging offers on a listing;
 *   a SALE is the completed transfer of money and ownership, recorded once;
 *   a CONSTRUCTION PROJECT is a building on its way up.
 *
 * Ownership of everything that can be traded lives in one registry shared by every player in
 * this browser. A player's own saved game holds their money and nothing about who owns what.
 */

export type AssetKind = 'plot' | 'vehicle';

export interface AssetRef {
  kind: AssetKind;
  id: string;
}

export const assetKey = (asset: AssetRef) => `${asset.kind}:${asset.id}`;

/** Who owns an asset now, and everyone who has owned it. `null` is the state: land not yet sold to anyone. */
export interface Title {
  ownerId: string | null;
  history: Array<{
    at: number;
    from: string | null;
    to: string;
    price: number;
    saleId: string;
  }>;
}

export type ListingStatus = 'active' | 'pending' | 'sold' | 'withdrawn';

export interface Listing {
  id: string;
  asset: AssetRef;
  sellerId: string;
  askingPrice: number;
  description: string;
  status: ListingStatus;
  /** The negotiation that has been agreed and is waiting for the buyer's payment, while status is `pending` */
  pendingNegotiationId?: string;
  createdAt: number;
  updatedAt: number;
}

export type NegotiationStatus = 'open' | 'accepted' | 'completed' | 'rejected' | 'cancelled' | 'failed';

export interface OfferStep {
  by: 'buyer' | 'seller';
  action: 'offer' | 'counter' | 'accept' | 'reject' | 'cancel' | 'complete' | 'fail';
  amount: number;
  at: number;
  note?: string;
}

export interface Negotiation {
  id: string;
  listingId: string;
  asset: AssetRef;
  buyerId: string;
  sellerId: string;
  /** The price on the table */
  amount: number;
  /** Who has to answer it. Only they can accept. */
  awaiting: 'buyer' | 'seller';
  status: NegotiationStatus;
  history: OfferStep[];
  createdAt: number;
  updatedAt: number;
}

export interface Sale {
  id: string;
  asset: AssetRef;
  /** `null` for a first sale by the state */
  sellerId: string | null;
  buyerId: string;
  price: number;
  /** Taken from what the seller receives */
  fee: number;
  listingId?: string;
  negotiationId?: string;
  at: number;
}

/** Money the game owes a player, waiting for them to be in the game to receive it. Paid once. */
export interface Payout {
  id: string;
  toId: string;
  amount: number;
  reason: string;
  saleId?: string;
  createdAt: number;
  claimedAt?: number;
}

export type ConstructionStage = 'cleared' | 'foundation' | 'structure' | 'exterior' | 'finished';

export const STAGES: ConstructionStage[] = ['cleared', 'foundation', 'structure', 'exterior', 'finished'];

/** A building standing, or going up, on a plot. One per plot. It belongs to whoever owns the plot. */
export interface PlotBuilding {
  plotId: string;
  /** Which design, from the building catalogue */
  typeId: string;
  /** Where on the plot its centre is, in world metres */
  x: number;
  z: number;
  /** Quarter turns, 0 to 3 */
  turns: number;
  /** Who started it */
  builderId: string;
  cost: number;
  /** Game hours of work needed, and done so far */
  hoursNeeded: number;
  hoursDone: number;
  startedAt: number;
  finishedAt?: number;
  /** Game hours of rent or takings a finished building is holding for its owner */
  hoursHeld?: number;
}

export interface VehicleRecord {
  id: string;
  /** Which model, from the vehicle catalogue */
  modelId: string;
  /** 0 to 100 */
  condition: number;
  /** Kilometres driven */
  mileage: number;
  plate: string;
  boughtNewAt: number;
  /** Where its owner last left it */
  parkedAt?: { x: number; z: number; yaw: number };
}

export interface PlayerCard {
  id: string;
  name: string;
  seenAt: number;
}

export interface RegistryState {
  version: 1;
  /** Counter for ids made in this registry */
  serial: number;
  players: Record<string, PlayerCard>;
  titles: Record<string, Title>;
  listings: Record<string, Listing>;
  negotiations: Record<string, Negotiation>;
  sales: Sale[];
  payouts: Record<string, Payout>;
  buildings: Record<string, PlotBuilding>;
  vehicles: Record<string, VehicleRecord>;
}

export const emptyRegistry = (): RegistryState => ({
  version: 1,
  serial: 0,
  players: {},
  titles: {},
  listings: {},
  negotiations: {},
  sales: [],
  payouts: {},
  buildings: {},
  vehicles: {},
});

export interface Outcome {
  ok: boolean;
  /** Why not, in words the player can read */
  reason?: string;
}
