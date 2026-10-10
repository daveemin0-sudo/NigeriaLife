import { BackendService } from '../backend/BackendService';
import { showGameToast } from '../ui/GameToast';
import { AssetMarket, type AssetProvider } from './AssetMarket';
import { Registry, MY_ID } from './Registry';
import { assetKey, type AssetRef, type Listing, type RegistryState } from './types';

export type DeedKind = 'property' | 'business';

/**
 * Apartments, houses and businesses that are bought outright.
 *
 * Each player's saved game has always had its own list of these, so two players could both
 * "own" the same flat. Now a home or a business bought outright has a title in the shared
 * registry like any plot of land: one owner, and it can be listed, bargained over and sold to
 * another player. A lease from a landlord is not ownership and stays in the tenant's own game.
 *
 * The saved game still holds what the player's home or business is like (its key, its
 * upgrades, its takings). This class keeps the two in step: what the registry says a player
 * owns, their game gives them; what it says they no longer own, their game takes back.
 */
export class Deeds {
  private static instance: Deeds | null = null;
  private readonly registry = Registry.get();
  private readonly market = AssetMarket.get();
  private readonly backend = BackendService.getInstance();
  private working = false;
  private again = false;

  private constructor() {
    this.market.provide(this.provider('property'));
    this.market.provide(this.provider('business'));
    this.backend.setDeedHooks(
      (kind, id) => this.cannotBuyFromMarket(kind, id),
      () => void this.reconcile()
    );
    this.registry.subscribe(() => void this.reconcile());
    void this.reconcile();
  }

  public static get(): Deeds {
    if (!Deeds.instance) Deeds.instance = new Deeds();
    return Deeds.instance;
  }

  private nameOf(kind: DeedKind, id: string): string {
    const data = this.backend.getData();
    return (kind === 'property' ? data.properties.find((p) => p.id === id)?.name : data.businesses.find((b) => b.id === id)?.name) ?? 'it';
  }

  private provider(kind: DeedKind): AssetProvider {
    return {
      kind,
      describe: (id) => this.nameOf(kind, id),
      exists: (id) => this.nameOf(kind, id) !== 'it',
      // The open market sells these through the player's own game, which then claims the title
      firstPrice: () => null,
      cannotSell: () => null,
    };
  }

  // --- Reading ----------------------------------------------------------------------------------

  public ownerOf(kind: DeedKind, id: string): string | null {
    return this.market.ownerOf({ kind, id });
  }

  /** Is this owned by a player other than this one? */
  public takenBy(kind: DeedKind, id: string): string | null {
    const owner = this.ownerOf(kind, id);
    return owner && owner !== MY_ID ? owner : null;
  }

  public listingFor(kind: DeedKind, id: string): Listing | null {
    return this.market.listingFor({ kind, id });
  }

  /** What other players have put up for sale of this kind. */
  public forSale(kind: DeedKind): Listing[] {
    return this.market.listings((listing) => listing.asset.kind === kind);
  }

  /** Why this cannot be bought on the open market: because a player owns it. Their price is theirs to name. */
  private cannotBuyFromMarket(kind: DeedKind, id: string): string | null {
    const taken = this.takenBy(kind, id);
    return taken ? `${this.nameOf(kind, id)} belongs to ${this.market.nameOf(taken)}. It can only be bought from them.` : null;
  }

  // --- Keeping the saved game and the registry in step ------------------------------------------

  /**
   * Compares what this player's game says they own with what the registry says, and settles
   * every difference. Safe to run at any time and any number of times.
   */
  public async reconcile(): Promise<void> {
    if (this.working) {
      this.again = true;
      return;
    }
    this.working = true;
    try {
      do {
        this.again = false;
        // Most of the time the two already agree, and there is nothing to lock the registry for
        if (this.differs(this.registry.peek())) await this.registry.transact((state) => this.settle(state));
      } while (this.again);
    } finally {
      this.working = false;
    }
  }

  /** Does what this game holds differ from what the registry says this player owns? */
  private differs(state: RegistryState): boolean {
    const deeds = this.backend.deedsHeld();
    const held = new Set(deeds.map((deed) => assetKey(deed)));
    for (const key of held) if (state.titles[key]?.ownerId !== MY_ID) return true;
    // What is installed in a business this player owns is on record, so it can be sold with it
    for (const deed of deeds) {
      if (deed.kind === 'business' && (state.fittings[assetKey(deed)] ?? []).join() !== this.backend.businessFittings(deed.id).join()) return true;
    }
    for (const [key, title] of Object.entries(state.titles)) {
      if (title.ownerId === MY_ID && !held.has(key) && (key.startsWith('property:') || key.startsWith('business:'))) return true;
    }
    return false;
  }

  private settle(state: RegistryState): void {
    const held = this.backend.deedsHeld();
    const heldKeys = new Set(held.map((deed) => assetKey(deed)));
    const now = Date.now();

    for (const deed of held) {
      const key = assetKey(deed);
      const title = state.titles[key];
      if (!title || title.ownerId === null) {
        // Bought on the open market (or owned since before there was a registry): the title is claimed
        const saleId = Registry.nextId(state, 'sale');
        const price = this.backend.deedPrice(deed.kind, deed.id);
        const history = title?.history ?? [];
        history.push({ at: now, from: null, to: MY_ID, price, saleId });
        state.titles[key] = { ownerId: MY_ID, history };
        state.sales.push({ id: saleId, asset: deed, sellerId: null, buyerId: MY_ID, price, fee: 0, at: now });
      } else if (title.ownerId !== MY_ID) {
        // Someone else holds the title. If this player sold it to them, the money has come
        // separately. If they never held the title (two players bought the same thing at
        // once and the other was first), what they paid comes back.
        // Judged by the latest transfer only: this player may have owned and sold it long ago
        const sold = title.history[title.history.length - 1]?.from === MY_ID;
        const name = this.nameOf(deed.kind, deed.id);
        this.backend.surrenderDeed(deed.kind, deed.id, !sold);
        if (!sold) showGameToast(`${name} had already gone to ${state.players[title.ownerId]?.name ?? 'another player'}. Your money has been returned.`, 'warning', 5200);
        continue;
      }
      // What is installed in a business this player owns is kept on record, so it is sold with it
      if (deed.kind === 'business') {
        const fitted = this.backend.businessFittings(deed.id);
        if (fitted.length > 0) state.fittings[key] = fitted;
        else delete state.fittings[key];
      }
    }

    // Titles this player holds that their game does not know about yet: bought from another player
    for (const [key, title] of Object.entries(state.titles)) {
      if (title.ownerId !== MY_ID || heldKeys.has(key)) continue;
      const [kind, id] = [key.slice(0, key.indexOf(':')), key.slice(key.indexOf(':') + 1)];
      if (kind !== 'property' && kind !== 'business') continue;
      // Sold back to the open market in this game a moment ago: the title is given up
      if (this.backend.deedJustReleased(kind, id)) {
        title.ownerId = null;
        for (const listing of Object.values(state.listings)) {
          if (assetKey(listing.asset) === key && listing.status === 'active') listing.status = 'withdrawn';
        }
        delete state.fittings[key];
        continue;
      }
      this.backend.grantDeed(kind, id, state.fittings[key] ?? []);
    }
  }

  /** Puts something this player owns outright on the player market. */
  public list(asset: AssetRef, askingPrice: number, description = '') {
    return this.market.list(asset, askingPrice, description);
  }
}
