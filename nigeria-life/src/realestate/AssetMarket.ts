import { BackendService } from '../backend/BackendService';
import { Registry, MY_ID } from './Registry';
import {
  assetKey,
  type AssetKind,
  type AssetRef,
  type Listing,
  type Negotiation,
  type Outcome,
  type RegistryState,
  type Sale,
  type Title,
} from './types';

/** Taken from what a seller receives on a sale between players: the agent and the land registry. */
export const SALE_FEE_RATE = 0.02;
const MAX_PRICE = 1_000_000_000_000;

/** What the market needs to know about a kind of asset. Land and vehicles each supply one. */
export interface AssetProvider {
  kind: AssetKind;
  /** A name for receipts and messages */
  describe(id: string): string;
  /** Does an asset with this id exist at all? */
  exists(id: string, state: RegistryState): boolean;
  /** What the state sells it for the first time, or null if the state does not sell it */
  firstPrice(id: string, state: RegistryState): number | null;
  /** Why its owner may not sell it right now (a building half built on it, say), or null */
  cannotSell(id: string, state: RegistryState): string | null;
}

const fail = (reason: string): Outcome => ({ ok: false, reason });
const naira = (amount: number) => `₦${Math.round(amount).toLocaleString()}`;
const whole = (amount: number) => Number.isInteger(amount) && amount > 0 && amount <= MAX_PRICE;

/**
 * Buying and selling between players, and first sales by the state.
 *
 * A listing is only an asking price. Nothing changes hands until a price has been agreed by
 * both sides and the buyer's money has actually been taken; that last step checks everything
 * again, against the registry as it is at that instant, and does the whole transfer or none of it.
 */
export class AssetMarket {
  private static instance: AssetMarket | null = null;
  private readonly registry = Registry.get();
  private readonly backend = BackendService.getInstance();
  private readonly providers = new Map<AssetKind, AssetProvider>();
  private settling = false;

  private constructor() {
    // Things can be agreed, and money can become due, while this player is looking elsewhere or away
    this.registry.subscribe(() => void this.settleMine());
  }

  public static get(): AssetMarket {
    if (!AssetMarket.instance) AssetMarket.instance = new AssetMarket();
    return AssetMarket.instance;
  }

  public provide(provider: AssetProvider): void {
    this.providers.set(provider.kind, provider);
  }

  public describe(asset: AssetRef): string {
    return this.providers.get(asset.kind)?.describe(asset.id) ?? asset.id;
  }

  // --- Reading (from this tab's view of the registry; for screens) ---------------------------

  public get me(): string {
    return MY_ID;
  }

  public funds(): number {
    const data = this.backend.getData();
    return data.walletCash + data.bank.balance;
  }

  public title(asset: AssetRef): Title | null {
    return this.registry.peek().titles[assetKey(asset)] ?? null;
  }

  public ownerOf(asset: AssetRef): string | null {
    return this.title(asset)?.ownerId ?? null;
  }

  public isMine(asset: AssetRef): boolean {
    return this.ownerOf(asset) === MY_ID;
  }

  public nameOf(playerId: string | null): string {
    if (playerId === null) return 'The state';
    if (playerId === MY_ID) return 'You';
    return this.registry.peek().players[playerId]?.name ?? 'Another player';
  }

  /** The listing an asset is on the market under, if it is. */
  public listingFor(asset: AssetRef): Listing | null {
    const key = assetKey(asset);
    return Object.values(this.registry.peek().listings).find((listing) => assetKey(listing.asset) === key && (listing.status === 'active' || listing.status === 'pending')) ?? null;
  }

  public listings(filter: (listing: Listing) => boolean = () => true): Listing[] {
    return Object.values(this.registry.peek().listings)
      .filter((listing) => (listing.status === 'active' || listing.status === 'pending') && filter(listing))
      .sort((a, b) => b.updatedAt - a.updatedAt);
  }

  /** Every listing there has ever been, open or closed, by id. */
  public allListings(): Record<string, Listing> {
    return this.registry.peek().listings;
  }

  public negotiationsOn(listingId: string): Negotiation[] {
    return Object.values(this.registry.peek().negotiations).filter((n) => n.listingId === listingId).sort((a, b) => b.updatedAt - a.updatedAt);
  }

  /** Every negotiation this player is part of, newest first. */
  public myNegotiations(): Negotiation[] {
    return Object.values(this.registry.peek().negotiations).filter((n) => n.buyerId === MY_ID || n.sellerId === MY_ID).sort((a, b) => b.updatedAt - a.updatedAt);
  }

  public mySales(): Sale[] {
    return this.registry.peek().sales.filter((sale) => sale.buyerId === MY_ID || sale.sellerId === MY_ID).sort((a, b) => b.at - a.at);
  }

  /** Negotiations waiting on this player to answer. */
  public waitingOnMe(): number {
    return this.myNegotiations().filter((n) => n.status === 'open' && ((n.awaiting === 'seller' && n.sellerId === MY_ID) || (n.awaiting === 'buyer' && n.buyerId === MY_ID))).length;
  }

  // --- Who is here ----------------------------------------------------------------------------

  /** Puts this player's name in the registry, so a listing can say who is selling. */
  public async introduce(name: string): Promise<void> {
    await this.registry.transact((state) => {
      const card = state.players[MY_ID];
      if (card && card.name === name && Date.now() - card.seenAt < 60_000) return;
      state.players[MY_ID] = { id: MY_ID, name, seenAt: Date.now() };
    });
    await this.settleMine();
  }

  // --- First sale by the state ------------------------------------------------------------------

  /** Buys something nobody owns yet, from the state, at the state's price. */
  public async buyFromState(asset: AssetRef): Promise<Outcome> {
    return this.registry.transact((state): Outcome => {
      const provider = this.providers.get(asset.kind);
      if (!provider || !provider.exists(asset.id, state)) return fail('That is not for sale.');
      const key = assetKey(asset);
      const title = state.titles[key];
      if (title && title.ownerId !== null) {
        return fail(title.ownerId === MY_ID ? 'You already own this.' : `This belongs to ${state.players[title.ownerId]?.name ?? 'another player'}. It can only be bought from them.`);
      }
      const price = provider.firstPrice(asset.id, state);
      if (price === null || !whole(price)) return fail('The state is not selling this.');
      if (this.funds() < price) return fail(`The price is ${naira(price)} and you have ${naira(this.funds())} in all.`);

      const paid = this.backend.processTransaction({ type: 'ASSET_PURCHASE', amount: price, description: `Bought ${provider.describe(asset.id)} from the state`, source: 'bank', funding: 'split' });
      if (!paid.success) return fail('The payment did not go through, so nothing was bought.');

      const saleId = Registry.nextId(state, 'sale');
      const history = title?.history ?? [];
      history.push({ at: Date.now(), from: null, to: MY_ID, price, saleId });
      state.titles[key] = { ownerId: MY_ID, history };
      state.sales.push({ id: saleId, asset, sellerId: null, buyerId: MY_ID, price, fee: 0, at: Date.now() });
      return { ok: true };
    });
  }

  // --- Listings ---------------------------------------------------------------------------------

  private cannotList(state: RegistryState, asset: AssetRef): string | null {
    const provider = this.providers.get(asset.kind);
    if (!provider || !provider.exists(asset.id, state)) return 'That cannot be sold here.';
    if (state.titles[assetKey(asset)]?.ownerId !== MY_ID) return 'Only the owner can put this up for sale.';
    return provider.cannotSell(asset.id, state);
  }

  public async list(asset: AssetRef, askingPrice: number, description = ''): Promise<Outcome & { listingId?: string }> {
    return this.registry.transact((state): Outcome & { listingId?: string } => {
      const blocked = this.cannotList(state, asset);
      if (blocked) return fail(blocked);
      if (!whole(askingPrice)) return fail('Enter an asking price in whole naira.');
      const key = assetKey(asset);
      const already = Object.values(state.listings).find((listing) => assetKey(listing.asset) === key && (listing.status === 'active' || listing.status === 'pending'));
      if (already) return fail('This is already listed for sale.');

      const id = Registry.nextId(state, 'listing');
      const now = Date.now();
      state.listings[id] = { id, asset, sellerId: MY_ID, askingPrice, description: description.trim().slice(0, 200), status: 'active', createdAt: now, updatedAt: now };
      return { ok: true, listingId: id };
    });
  }

  public async editListing(listingId: string, askingPrice: number, description: string): Promise<Outcome> {
    return this.registry.transact((state): Outcome => {
      const listing = state.listings[listingId];
      if (!listing || listing.sellerId !== MY_ID) return fail('That is not your listing.');
      if (listing.status !== 'active') return fail(listing.status === 'pending' ? 'A sale has been agreed and is being completed; it cannot be changed now.' : 'That listing is closed.');
      if (!whole(askingPrice)) return fail('Enter an asking price in whole naira.');
      listing.askingPrice = askingPrice;
      listing.description = description.trim().slice(0, 200);
      listing.updatedAt = Date.now();
      return { ok: true };
    });
  }

  /** Takes a listing off the market. Every offer on it lapses. Nothing was sold. */
  public async withdraw(listingId: string): Promise<Outcome> {
    return this.registry.transact((state): Outcome => {
      const listing = state.listings[listingId];
      if (!listing || listing.sellerId !== MY_ID) return fail('That is not your listing.');
      if (listing.status === 'sold' || listing.status === 'withdrawn') return fail('That listing is already closed.');
      const now = Date.now();
      for (const negotiation of Object.values(state.negotiations)) {
        if (negotiation.listingId !== listingId || (negotiation.status !== 'open' && negotiation.status !== 'accepted')) continue;
        negotiation.status = 'rejected';
        negotiation.updatedAt = now;
        negotiation.history.push({ by: 'seller', action: 'reject', amount: negotiation.amount, at: now, note: 'The listing was withdrawn' });
      }
      listing.status = 'withdrawn';
      listing.pendingNegotiationId = undefined;
      listing.updatedAt = now;
      return { ok: true };
    });
  }

  // --- Offers -----------------------------------------------------------------------------------

  /** A buyer's offer on a listing. A buyer has one negotiation per listing; offering again raises or lowers it. */
  public async offer(listingId: string, amount: number): Promise<Outcome & { negotiationId?: string }> {
    return this.registry.transact((state): Outcome & { negotiationId?: string } => {
      const listing = state.listings[listingId];
      if (!listing || listing.status === 'sold' || listing.status === 'withdrawn') return fail('That listing is no longer on the market.');
      if (listing.status === 'pending') return fail('A sale has already been agreed on this and is being completed.');
      if (listing.sellerId === MY_ID) return fail('You cannot make an offer on your own listing.');
      if (!whole(amount)) return fail('Enter an offer in whole naira.');
      if (this.funds() < amount) return fail(`You have ${naira(this.funds())} in all, so you cannot offer ${naira(amount)}.`);

      const now = Date.now();
      const existing = Object.values(state.negotiations).find((n) => n.listingId === listingId && n.buyerId === MY_ID && n.status === 'open');
      if (existing) {
        existing.amount = amount;
        existing.awaiting = 'seller';
        existing.updatedAt = now;
        existing.history.push({ by: 'buyer', action: 'counter', amount, at: now });
        return { ok: true, negotiationId: existing.id };
      }
      const id = Registry.nextId(state, 'offer');
      state.negotiations[id] = {
        id, listingId, asset: listing.asset, buyerId: MY_ID, sellerId: listing.sellerId, amount, awaiting: 'seller', status: 'open',
        history: [{ by: 'buyer', action: 'offer', amount, at: now }], createdAt: now, updatedAt: now,
      };
      return { ok: true, negotiationId: id };
    });
  }

  private side(negotiation: Negotiation): 'buyer' | 'seller' | null {
    return negotiation.buyerId === MY_ID ? 'buyer' : negotiation.sellerId === MY_ID ? 'seller' : null;
  }

  /** Answers the price on the table with a different one. Only the side whose turn it is can. */
  public async counter(negotiationId: string, amount: number): Promise<Outcome> {
    return this.registry.transact((state): Outcome => {
      const negotiation = state.negotiations[negotiationId];
      const side = negotiation ? this.side(negotiation) : null;
      if (!negotiation || !side) return fail('That is not your negotiation.');
      if (negotiation.status !== 'open') return fail('That negotiation is closed.');
      if (state.listings[negotiation.listingId]?.status !== 'active') return fail('That listing is no longer open to offers.');
      if (negotiation.awaiting !== side) return fail('It is the other side\'s turn to answer.');
      if (!whole(amount)) return fail('Enter a price in whole naira.');
      if (amount === negotiation.amount) return fail('That is the price already on the table. Accept it, or name a different one.');
      if (side === 'buyer' && this.funds() < amount) return fail(`You have ${naira(this.funds())} in all, so you cannot offer ${naira(amount)}.`);
      const now = Date.now();
      negotiation.amount = amount;
      negotiation.awaiting = side === 'buyer' ? 'seller' : 'buyer';
      negotiation.updatedAt = now;
      negotiation.history.push({ by: side, action: 'counter', amount, at: now });
      return { ok: true };
    });
  }

  /** The side whose turn it is turns the price down and ends the negotiation; a seller can end one at any time. */
  public async reject(negotiationId: string): Promise<Outcome> {
    return this.registry.transact((state): Outcome => {
      const negotiation = state.negotiations[negotiationId];
      const side = negotiation ? this.side(negotiation) : null;
      if (!negotiation || !side) return fail('That is not your negotiation.');
      if (negotiation.status !== 'open') return fail('That negotiation is closed.');
      const now = Date.now();
      negotiation.status = side === 'buyer' ? 'cancelled' : 'rejected';
      negotiation.updatedAt = now;
      negotiation.history.push({ by: side, action: side === 'buyer' ? 'cancel' : 'reject', amount: negotiation.amount, at: now });
      return { ok: true };
    });
  }

  /**
   * Agrees to the price on the table. Only the side it was put to can agree.
   *
   * When the buyer agrees, the sale is completed there and then. When the seller agrees, the
   * asset is held for that buyer and the sale completes as soon as the buyer's game takes
   * the payment, which is at once if they are playing. Until then no one else can buy it.
   */
  public async accept(negotiationId: string): Promise<Outcome> {
    const agreed = await this.registry.transact((state): Outcome & { mine?: boolean } => {
      const negotiation = state.negotiations[negotiationId];
      const side = negotiation ? this.side(negotiation) : null;
      if (!negotiation || !side) return fail('That is not your negotiation.');
      if (negotiation.status !== 'open') return fail('That negotiation is closed.');
      if (negotiation.awaiting !== side) return fail('You cannot accept your own price. It is the other side\'s turn to answer.');
      const listing = state.listings[negotiation.listingId];
      if (!listing || listing.status !== 'active') return fail(listing?.status === 'pending' ? 'Another sale has already been agreed on this.' : 'That listing is no longer on the market.');
      if (state.titles[assetKey(listing.asset)]?.ownerId !== listing.sellerId) return fail('The seller no longer owns this.');
      const now = Date.now();
      negotiation.status = 'accepted';
      negotiation.updatedAt = now;
      negotiation.history.push({ by: side, action: 'accept', amount: negotiation.amount, at: now });
      listing.status = 'pending';
      listing.pendingNegotiationId = negotiation.id;
      listing.updatedAt = now;
      return { ok: true, mine: side === 'buyer' };
    });
    if (!agreed.ok) return agreed;
    // The buyer agreed: this is the buyer's game, so the money can be taken now
    return agreed.mine ? this.complete(negotiationId) : { ok: true };
  }

  /** A seller who agreed a price lets the buyer go if the payment has not come, and the listing is open again. */
  public async release(negotiationId: string): Promise<Outcome> {
    return this.registry.transact((state): Outcome => {
      const negotiation = state.negotiations[negotiationId];
      if (!negotiation || negotiation.sellerId !== MY_ID) return fail('That is not your sale.');
      if (negotiation.status !== 'accepted') return fail('That sale is not waiting for payment.');
      const listing = state.listings[negotiation.listingId];
      const now = Date.now();
      negotiation.status = 'cancelled';
      negotiation.updatedAt = now;
      negotiation.history.push({ by: 'seller', action: 'cancel', amount: negotiation.amount, at: now, note: 'The buyer did not pay' });
      if (listing && listing.status === 'pending' && listing.pendingNegotiationId === negotiation.id) {
        listing.status = 'active';
        listing.pendingNegotiationId = undefined;
        listing.updatedAt = now;
      }
      return { ok: true };
    });
  }

  // --- The sale itself --------------------------------------------------------------------------

  /**
   * Completes an agreed sale: takes the buyer's money, moves the title, and sets aside the
   * seller's money, as one step. It runs in the buyer's game, because that is where the
   * buyer's money is. Everything is checked again here, and if any check fails nothing moves.
   * Running it twice does nothing the second time.
   */
  public async complete(negotiationId: string): Promise<Outcome> {
    return this.registry.transact((state): Outcome => {
      const negotiation = state.negotiations[negotiationId];
      if (!negotiation || negotiation.buyerId !== MY_ID) return fail('That is not your purchase.');
      if (negotiation.status === 'completed') return { ok: true };
      if (negotiation.status !== 'accepted') return fail('No price has been agreed on that.');
      const listing = state.listings[negotiation.listingId];
      const key = assetKey(negotiation.asset);
      const title = state.titles[key];
      const now = Date.now();

      const abandon = (reason: string): Outcome => {
        // An agreed sale that cannot go through is recorded as failed, and the listing opens again.
        // This is a change to the registry, so it is written: report it through the state, not as a refusal.
        negotiation.status = 'failed';
        negotiation.updatedAt = now;
        negotiation.history.push({ by: 'buyer', action: 'fail', amount: negotiation.amount, at: now, note: reason });
        if (listing && listing.status === 'pending' && listing.pendingNegotiationId === negotiation.id) {
          listing.status = 'active';
          listing.pendingNegotiationId = undefined;
          listing.updatedAt = now;
        }
        this.lastFailure = reason;
        return { ok: true };
      };
      this.lastFailure = null;

      if (!listing || listing.status !== 'pending' || listing.pendingNegotiationId !== negotiation.id) return abandon('The listing was withdrawn or sold before the sale could complete.');
      if (!title || title.ownerId !== listing.sellerId) return abandon('The seller no longer owns it.');
      if (state.sales.some((sale) => sale.negotiationId === negotiation.id)) return abandon('This sale was already recorded.');
      const blocked = this.providers.get(negotiation.asset.kind)?.cannotSell(negotiation.asset.id, state);
      if (blocked) return abandon(blocked);
      const price = negotiation.amount;
      if (!whole(price)) return abandon('The agreed price is not valid.');
      if (this.funds() < price) return abandon(`You have ${naira(this.funds())} in all, which does not cover the agreed ${naira(price)}.`);

      const what = this.describe(negotiation.asset);
      const paid = this.backend.processTransaction({ type: 'ASSET_PURCHASE', amount: price, description: `Bought ${what} from ${state.players[listing.sellerId]?.name ?? 'another player'}`, source: 'bank', funding: 'split' });
      if (!paid.success) return abandon('The payment did not go through.');

      const fee = Math.round(price * SALE_FEE_RATE);
      const saleId = Registry.nextId(state, 'sale');
      title.history.push({ at: now, from: listing.sellerId, to: MY_ID, price, saleId });
      title.ownerId = MY_ID;
      state.sales.push({ id: saleId, asset: negotiation.asset, sellerId: listing.sellerId, buyerId: MY_ID, price, fee, listingId: listing.id, negotiationId: negotiation.id, at: now });
      const payoutId = Registry.nextId(state, 'payout');
      state.payouts[payoutId] = { id: payoutId, toId: listing.sellerId, amount: price - fee, reason: `Sale of ${what}`, saleId, createdAt: now };

      negotiation.status = 'completed';
      negotiation.updatedAt = now;
      negotiation.history.push({ by: 'buyer', action: 'complete', amount: price, at: now });
      listing.status = 'sold';
      listing.pendingNegotiationId = undefined;
      listing.updatedAt = now;
      // Everyone else who was bidding is told it has gone
      for (const other of Object.values(state.negotiations)) {
        if (other.listingId !== listing.id || other.id === negotiation.id || other.status !== 'open') continue;
        other.status = 'rejected';
        other.updatedAt = now;
        other.history.push({ by: 'seller', action: 'reject', amount: other.amount, at: now, note: 'Sold to another buyer' });
      }
      return { ok: true };
    }).then((result) => (result.ok && this.lastFailure ? fail(this.lastFailure) : result));
  }

  private lastFailure: string | null = null;

  /**
   * Does what is waiting on this player's game: pays for anything a seller has agreed to
   * sell them, and receives any money they are owed. Called whenever the registry changes
   * and when the game starts, so it does not matter who was online when.
   */
  public async settleMine(): Promise<void> {
    if (this.settling) return;
    this.settling = true;
    try {
      const state = this.registry.peek();
      const toPay = Object.values(state.negotiations).filter((n) => n.buyerId === MY_ID && n.status === 'accepted');
      for (const negotiation of toPay) await this.complete(negotiation.id);

      if (Object.values(this.registry.peek().payouts).some((payout) => payout.toId === MY_ID && !payout.claimedAt)) {
        await this.registry.transact((fresh) => {
          for (const payout of Object.values(fresh.payouts)) {
            if (payout.toId !== MY_ID || payout.claimedAt) continue;
            const credited = this.backend.processTransaction({ type: payout.kind === 'rent' ? 'RENT_INCOME' : 'ASSET_SALE', amount: payout.amount, description: payout.reason, source: 'bank' });
            if (credited.success) payout.claimedAt = Date.now();
          }
        });
      }
    } finally {
      this.settling = false;
    }
  }
}
