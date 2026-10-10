import { BackendService } from '../backend/BackendService';
import { cannotBuild, type Rect, type Zone } from '../world/plan/CityPlan';
import { AssetMarket, type AssetProvider } from './AssetMarket';
import { BUILDING_TYPES, buildingType, demolitionCost, footprintAt, refundOnCancel, MAX_DAYS_HELD, type BuildingType } from './BuildingCatalogue';
import { ALL_PLOTS, plotArea, statePrice, type PlotDef } from './PlotCatalogue';
import { Registry, MY_ID } from './Registry';
import { daysHeld, hoursDone, isFinished, isLet, worldNow, MS_PER_RENT_WEEK } from './WorldClock';
import { assetKey, STAGES, type ConstructionStage, type Listing, type Outcome, type PlotBuilding, type RegistryState, type Tenancy } from './types';

export type PlotStatus = 'available' | 'owned' | 'listed' | 'negotiating' | 'reserved' | 'building' | 'developed';

export const STATUS_LABEL: Record<PlotStatus, string> = {
  available: 'For sale by the state',
  owned: 'Privately owned, not for sale',
  listed: 'For sale by owner',
  negotiating: 'For sale, offers being considered',
  reserved: 'Sale agreed, being completed',
  building: 'Under construction',
  developed: 'Developed',
};

export interface Plot extends PlotDef {
  /** The map's district id, which sets the price band */
  districtId: string;
  neighbourhood: string;
  area: number;
  /** What the state asks for it while nobody owns it */
  statePrice: number;
}

/** What the world tells the land office about a city: where things are. */
export interface LandWorld {
  districtAt(city: string, x: number, z: number): { id: string; name: string };
  zones(city: string): Zone[];
  /** Buildings already standing near a plot, not counting what is on the plot itself */
  buildingsNear(city: string, rect: Rect): Rect[];
}

const fail = (reason: string): Outcome => ({ ok: false, reason });
const naira = (amount: number) => `₦${Math.round(amount).toLocaleString()}`;
const titleKey = (plotId: string) => assetKey({ kind: 'plot', id: plotId });

/** How far along a building is, as one of the stages it is drawn in. */
export function stageOf(building: PlotBuilding, now = worldNow()): ConstructionStage {
  if (isFinished(building, now)) return 'finished';
  const done = building.hoursNeeded > 0 ? hoursDone(building, now) / building.hoursNeeded : 1;
  if (done < 0.12) return 'cleared';
  if (done < 0.38) return 'foundation';
  if (done < 0.74) return 'structure';
  return 'exterior';
}

export const STAGE_LABEL: Record<ConstructionStage, string> = {
  cleared: 'Site cleared',
  foundation: 'Foundation',
  structure: 'Frame going up',
  exterior: 'Walls and roof',
  finished: 'Finished',
};
void STAGES;

/** The longest a tenant can be paid up ahead */
const MAX_WEEKS_AHEAD = 4;

/**
 * The land office: every plot in every city, who owns each, what stands on it, who lives in
 * or runs it, and what may be done with it. It reads ownership from the shared registry and
 * money from the player's account; it keeps no copy of either.
 */
export class Land {
  private static instance: Land | null = null;
  private readonly registry = Registry.get();
  private readonly market = AssetMarket.get();
  private readonly backend = BackendService.getInstance();
  private world: LandWorld | null = null;
  private all: Plot[] = [];

  private constructor() {
    this.market.provide(this.provider());
  }

  public static get(): Land {
    if (!Land.instance) Land.instance = new Land();
    return Land.instance;
  }

  public connect(world: LandWorld): void {
    this.world = world;
    this.all = ALL_PLOTS.map((def) => {
      const district = world.districtAt(def.city, (def.rect.minX + def.rect.maxX) / 2, (def.rect.minZ + def.rect.maxZ) / 2);
      return { ...def, districtId: district.id, neighbourhood: district.name, area: plotArea(def), statePrice: statePrice(def, district.id) };
    });
  }

  private provider(): AssetProvider {
    return {
      kind: 'plot',
      describe: (id) => {
        const plot = this.plot(id);
        return plot ? `${plot.name}, ${plot.neighbourhood}` : 'a plot of land';
      },
      exists: (id) => this.plot(id) !== null,
      firstPrice: (id) => this.plot(id)?.statePrice ?? null,
      cannotSell: (id, state) => {
        const building = state.buildings[id];
        return building && !isFinished(building) ? 'Building work is under way on it. Finish the building or stop the work first.' : null;
      },
    };
  }

  // --- Reading ----------------------------------------------------------------------------------

  public plots(city?: string): Plot[] {
    return city ? this.all.filter((entry) => entry.city === city) : this.all;
  }

  public plot(id: string): Plot | null {
    return this.all.find((entry) => entry.id === id) ?? null;
  }

  public ownerOf(plotId: string): string | null {
    return this.market.ownerOf({ kind: 'plot', id: plotId });
  }

  public isMine(plotId: string): boolean {
    return this.ownerOf(plotId) === MY_ID;
  }

  public myPlots(): Plot[] {
    return this.all.filter((entry) => this.isMine(entry.id));
  }

  public listingFor(plotId: string): Listing | null {
    return this.market.listingFor({ kind: 'plot', id: plotId });
  }

  public building(plotId: string): PlotBuilding | null {
    return this.registry.peek().buildings[plotId] ?? null;
  }

  /** The finished building on a plot and its design, or null if there is none or it is still going up. */
  private finishedOn(plotId: string, state: RegistryState = this.registry.peek()): { building: PlotBuilding; type: BuildingType } | null {
    const building = state.buildings[plotId];
    const type = building ? buildingType(building.typeId) : null;
    return building && type && isFinished(building) ? { building, type } : null;
  }

  public status(plotId: string, state: RegistryState = this.registry.peek()): PlotStatus {
    const key = titleKey(plotId);
    const title = state.titles[key];
    if (!title || title.ownerId === null) return 'available';
    const listing = Object.values(state.listings).find((entry) => assetKey(entry.asset) === key && (entry.status === 'active' || entry.status === 'pending'));
    if (listing?.status === 'pending') return 'reserved';
    if (listing) return Object.values(state.negotiations).some((n) => n.listingId === listing.id && n.status === 'open') ? 'negotiating' : 'listed';
    const building = state.buildings[plotId];
    if (building) return isFinished(building) ? 'developed' : 'building';
    return 'owned';
  }

  /** What it would cost to buy now: the state's price, or an owner's asking price, or nothing if it is not for sale. */
  public askingPrice(plotId: string): number | null {
    const status = this.status(plotId);
    if (status === 'available') return this.plot(plotId)?.statePrice ?? null;
    return this.listingFor(plotId)?.askingPrice ?? null;
  }

  /** Does the player have somewhere of their own to live on land: a house they own and have not let, or one they rent? */
  public hasHome(): boolean {
    const state = this.registry.peek();
    return this.all.some((entry) => {
      const built = this.finishedOn(entry.id, state);
      if (!built || !built.type.home) return false;
      const tenancy = state.tenancies[entry.id];
      if (isLet(tenancy)) return tenancy.tenantId === MY_ID;
      return state.titles[titleKey(entry.id)]?.ownerId === MY_ID;
    });
  }

  /** The designs the rules for this plot allow. */
  public designsFor(plotId: string): Array<{ type: BuildingType; why: string | null }> {
    const plot = this.plot(plotId);
    if (!plot) return [];
    const width = plot.rect.maxX - plot.rect.minX;
    const depth = plot.rect.maxZ - plot.rect.minZ;
    return BUILDING_TYPES.map((type) => {
      let why: string | null = null;
      if (!plot.uses.includes(type.use)) why = `This plot is for ${plot.uses.join(' and ')} use only`;
      else if (type.floors > plot.maxFloors) why = `No more than ${plot.maxFloors} floors may be built here`;
      else {
        const fits = (w: number, d: number) => w + 2 <= width && d + 2 <= depth;
        if (!fits(type.width, type.depth) && !fits(type.depth, type.width)) why = 'The plot is too small for it';
      }
      return { type, why };
    });
  }

  // --- Buying from the state ----------------------------------------------------------------------

  public buyFromState(plotId: string): Promise<Outcome> {
    return this.market.buyFromState({ kind: 'plot', id: plotId });
  }

  // --- Building -----------------------------------------------------------------------------------

  /** Why this design cannot go at this spot on this plot, or null if it can. Used live by the preview. */
  public cannotPlace(plotId: string, typeId: string, x: number, z: number, turns: number, state: RegistryState = this.registry.peek()): string | null {
    const plot = this.plot(plotId);
    const type = buildingType(typeId);
    if (!plot || !type || !this.world) return 'That cannot be built.';
    if (state.titles[titleKey(plotId)]?.ownerId !== MY_ID) return 'Only the owner of the land can build on it.';
    if (state.buildings[plotId]) return 'There is already a building on this plot. Pull it down first.';
    const key = titleKey(plotId);
    if (Object.values(state.listings).some((entry) => assetKey(entry.asset) === key && entry.status === 'pending')) return 'A sale of this plot has been agreed. Nothing can be built until it completes or falls through.';
    if (!plot.uses.includes(type.use)) return `This plot is for ${plot.uses.join(' and ')} use only.`;
    if (type.floors > plot.maxFloors) return `No more than ${plot.maxFloors} floors may be built here.`;
    return cannotBuild(footprintAt(type, x, z, turns), plot.rect, this.world.zones(plot.city), this.world.buildingsNear(plot.city, plot.rect));
  }

  /** Starts building. The cost is taken once, here, and the site appears on the plot. */
  public async startBuilding(plotId: string, typeId: string, x: number, z: number, turns: number): Promise<Outcome> {
    return this.registry.transact((state): Outcome => {
      const blocked = this.cannotPlace(plotId, typeId, x, z, turns, state);
      if (blocked) return fail(blocked);
      const type = buildingType(typeId)!;
      if (this.market.funds() < type.cost) return fail(`A ${type.name.toLowerCase()} costs ${naira(type.cost)} to build and you have ${naira(this.market.funds())} in all.`);
      const paid = this.backend.processTransaction({ type: 'CONSTRUCTION_COST', amount: type.cost, description: `Building a ${type.name.toLowerCase()} at ${this.plot(plotId)!.name}`, source: 'bank', funding: 'split' });
      if (!paid.success) return fail('The payment did not go through, so no work was started.');
      state.buildings[plotId] = {
        plotId, typeId, x: Math.round(x * 2) / 2, z: Math.round(z * 2) / 2, turns: ((turns % 4) + 4) % 4, builderId: MY_ID,
        cost: type.cost, hoursNeeded: type.hours, startedAt: worldNow(),
      };
      return { ok: true };
    });
  }

  /** Stops work on an unfinished building. Half the money for the work not yet done comes back. */
  public async cancelBuilding(plotId: string): Promise<Outcome & { refund?: number }> {
    return this.registry.transact((state): Outcome & { refund?: number } => {
      const building = state.buildings[plotId];
      if (!building) return fail('Nothing is being built there.');
      if (state.titles[titleKey(plotId)]?.ownerId !== MY_ID) return fail('That is not your land.');
      if (isFinished(building)) return fail('That building is finished. It can be pulled down, not cancelled.');
      const type = buildingType(building.typeId);
      const refund = type ? refundOnCancel(type, hoursDone(building)) : 0;
      delete state.buildings[plotId];
      if (refund > 0) this.backend.processTransaction({ type: 'CONSTRUCTION_REFUND', amount: refund, description: `Work stopped at ${this.plot(plotId)?.name ?? 'your plot'}`, source: 'bank' });
      return { ok: true, refund };
    });
  }

  /** Pulls down a finished building, leaving the plot empty. Costs a tenth of what it cost to build. */
  public async demolish(plotId: string): Promise<Outcome> {
    return this.registry.transact((state): Outcome => {
      const built = this.finishedOn(plotId, state);
      if (!built) return fail('There is no finished building there.');
      if (state.titles[titleKey(plotId)]?.ownerId !== MY_ID) return fail('That is not your land.');
      if (isLet(state.tenancies[plotId])) return fail('It is let to a tenant. It cannot be pulled down until they have gone.');
      const cost = demolitionCost(built.type);
      if (cost > 0) {
        if (this.market.funds() < cost) return fail(`Pulling it down costs ${naira(cost)} and you have ${naira(this.market.funds())} in all.`);
        const paid = this.backend.processTransaction({ type: 'CONSTRUCTION_COST', amount: cost, description: `Demolition at ${this.plot(plotId)?.name ?? 'your plot'}`, source: 'bank', funding: 'split' });
        if (!paid.success) return fail('The payment did not go through, so nothing was pulled down.');
      }
      delete state.buildings[plotId];
      delete state.tenancies[plotId];
      return { ok: true };
    });
  }

  // --- Takings ------------------------------------------------------------------------------------

  /** Who a building's takings belong to: its tenant while it is let, otherwise its owner. */
  public occupier(plotId: string, state: RegistryState = this.registry.peek()): string | null {
    const tenancy = state.tenancies[plotId];
    if (isLet(tenancy)) return tenancy.tenantId;
    return state.titles[titleKey(plotId)]?.ownerId ?? null;
  }

  /** What a finished building has earned and not yet paid over, after its upkeep. */
  public takings(plotId: string, state: RegistryState = this.registry.peek()): number {
    const built = this.finishedOn(plotId, state);
    if (!built) return 0;
    const days = daysHeld(built.building, MAX_DAYS_HELD);
    return Math.max(0, Math.floor((days * (built.type.incomePerDay - built.type.upkeepPerDay)) / 100) * 100);
  }

  /** Pays a building's takings into the bank account of whoever is running it. */
  public async collect(plotId: string): Promise<Outcome & { amount?: number }> {
    return this.registry.transact((state): Outcome & { amount?: number } => {
      const built = this.finishedOn(plotId, state);
      if (!built) return fail('There is no finished building there.');
      if (this.occupier(plotId, state) !== MY_ID) return fail(isLet(state.tenancies[plotId]) ? 'It is let: the takings are the tenant\'s.' : 'That is not your building.');
      const amount = this.takings(plotId, state);
      if (amount <= 0) return fail(built.type.incomePerDay > 0 ? 'Nothing has come in yet.' : 'This building does not earn money.');
      const credited = this.backend.processTransaction({ type: 'BUSINESS_INCOME', amount, description: `${built.type.name} at ${this.plot(plotId)?.name ?? 'your plot'}`, source: 'bank' });
      if (!credited.success) return fail('The money could not be paid in.');
      built.building.collectedAt = worldNow();
      return { ok: true, amount };
    });
  }

  // --- Letting to another player ------------------------------------------------------------------

  public tenancy(plotId: string): Tenancy | null {
    return this.registry.peek().tenancies[plotId] ?? null;
  }

  /** The buildings this player is renting from other players. */
  public myTenancies(): Tenancy[] {
    return Object.values(this.registry.peek().tenancies).filter((tenancy) => isLet(tenancy) && tenancy.tenantId === MY_ID);
  }

  /** Buildings other players are offering to let. */
  public toLet(): Tenancy[] {
    const state = this.registry.peek();
    return Object.values(state.tenancies).filter((tenancy) => !isLet(tenancy) && !tenancy.ending && this.finishedOn(tenancy.plotId, state) !== null);
  }

  /** The owner offers a finished building to let at a weekly rent, or changes the rent asked of the next tenant. */
  public async offerToLet(plotId: string, rentPerWeek: number): Promise<Outcome> {
    return this.registry.transact((state): Outcome => {
      if (state.titles[titleKey(plotId)]?.ownerId !== MY_ID) return fail('Only the owner can let it.');
      if (!this.finishedOn(plotId, state)) return fail('There is no finished building there to let.');
      if (!Number.isInteger(rentPerWeek) || rentPerWeek <= 0 || rentPerWeek > 1_000_000_000) return fail('Enter a weekly rent in whole naira.');
      const current = state.tenancies[plotId];
      if (isLet(current)) return fail('It already has a tenant. The rent can be changed when they have gone.');
      state.tenancies[plotId] = { plotId, rentPerWeek };
      return { ok: true };
    });
  }

  /** The owner stops offering it, or gives a sitting tenant notice: they stay until what they have paid for runs out. */
  public async stopLetting(plotId: string): Promise<Outcome & { notice?: boolean }> {
    return this.registry.transact((state): Outcome & { notice?: boolean } => {
      if (state.titles[titleKey(plotId)]?.ownerId !== MY_ID) return fail('Only the owner can do that.');
      const tenancy = state.tenancies[plotId];
      if (!tenancy) return fail('It is not to let.');
      if (isLet(tenancy)) {
        tenancy.ending = true;
        return { ok: true, notice: true };
      }
      delete state.tenancies[plotId];
      return { ok: true, notice: false };
    });
  }

  /**
   * Takes a building that is to let, or pays for another week of one already rented. The
   * week's rent leaves the tenant's account and is set aside for whoever owns the building.
   */
  public async payRent(plotId: string): Promise<Outcome & { paidUntil?: number }> {
    return this.registry.transact((state): Outcome & { paidUntil?: number } => {
      const tenancy = state.tenancies[plotId];
      const built = this.finishedOn(plotId, state);
      const ownerId = state.titles[titleKey(plotId)]?.ownerId ?? null;
      if (!tenancy || !built || !ownerId) return fail('That is not to let.');
      if (ownerId === MY_ID) return fail('You own it. You cannot be your own tenant.');
      const now = worldNow();
      const sitting = isLet(tenancy, now);
      if (sitting && tenancy.tenantId !== MY_ID) return fail('Someone else is the tenant.');
      if (tenancy.ending) return fail(sitting ? 'The owner has given notice. The tenancy ends when what you have paid for runs out.' : 'The owner is no longer letting it.');
      const from = sitting ? tenancy.paidUntil! : now;
      if (from + MS_PER_RENT_WEEK > now + MAX_WEEKS_AHEAD * MS_PER_RENT_WEEK) return fail(`Rent can be paid up to ${MAX_WEEKS_AHEAD} weeks ahead.`);
      const rent = tenancy.rentPerWeek;
      if (this.market.funds() < rent) return fail(`The rent is ${naira(rent)} a week and you have ${naira(this.market.funds())} in all.`);
      const paid = this.backend.processTransaction({ type: 'RENT_PAYMENT', amount: rent, description: `A week's rent for the ${built.type.name.toLowerCase()} at ${this.plot(plotId)?.name ?? 'a plot'}`, source: 'bank', funding: 'split' });
      if (!paid.success) return fail('The payment did not go through, so nothing was rented.');

      if (!sitting) {
        tenancy.tenantId = MY_ID;
        tenancy.since = now;
        // A new tenant starts with an empty till: what was there is the owner's
        built.building.collectedAt = now;
      }
      tenancy.paidUntil = from + MS_PER_RENT_WEEK;
      const payoutId = Registry.nextId(state, 'payout');
      state.payouts[payoutId] = { id: payoutId, toId: ownerId, amount: rent, reason: `Rent for the ${built.type.name.toLowerCase()} at ${this.plot(plotId)?.name ?? 'your plot'}`, kind: 'rent', createdAt: now };
      return { ok: true, paidUntil: tenancy.paidUntil };
    });
  }

  /** A tenant gives the building up now. What they have paid is not returned. */
  public async leaveTenancy(plotId: string): Promise<Outcome> {
    return this.registry.transact((state): Outcome => {
      const tenancy = state.tenancies[plotId];
      if (!isLet(tenancy) || tenancy.tenantId !== MY_ID) return fail('You are not the tenant there.');
      const built = state.buildings[plotId];
      if (built) built.collectedAt = worldNow();
      if (tenancy.ending) delete state.tenancies[plotId];
      else state.tenancies[plotId] = { plotId, rentPerWeek: tenancy.rentPerWeek };
      return { ok: true };
    });
  }

  private renewing = false;

  /**
   * Called now and then while the game runs. A tenant whose week is nearly up pays for the
   * next one if they can; a tenancy that has run out is cleared so the building can be let again.
   */
  public async keepUp(): Promise<void> {
    if (this.renewing) return;
    const state = this.registry.peek();
    const now = worldNow();
    const dueSoon = Object.values(state.tenancies).filter((tenancy) => isLet(tenancy, now) && tenancy.tenantId === MY_ID && !tenancy.ending && tenancy.paidUntil - now < MS_PER_RENT_WEEK / 7);
    const lapsed = Object.values(state.tenancies).filter((tenancy) => !!tenancy.tenantId && !isLet(tenancy, now));
    if (dueSoon.length === 0 && lapsed.length === 0) return;
    this.renewing = true;
    try {
      for (const tenancy of dueSoon) {
        if (this.market.funds() >= tenancy.rentPerWeek) await this.payRent(tenancy.plotId);
      }
      if (lapsed.length > 0) {
        await this.registry.transact((fresh) => {
          for (const tenancy of Object.values(fresh.tenancies)) {
            if (!tenancy.tenantId || isLet(tenancy)) continue;
            const built = fresh.buildings[tenancy.plotId];
            if (built) built.collectedAt = Math.max(built.collectedAt ?? 0, tenancy.paidUntil ?? 0);
            if (tenancy.ending) delete fresh.tenancies[tenancy.plotId];
            else fresh.tenancies[tenancy.plotId] = { plotId: tenancy.plotId, rentPerWeek: tenancy.rentPerWeek };
          }
        });
      }
    } finally {
      this.renewing = false;
    }
  }
}
