import { BackendService } from '../backend/BackendService';
import { cannotBuild, type Rect, type Zone } from '../world/plan/CityPlan';
import { AssetMarket, type AssetProvider } from './AssetMarket';
import { BUILDING_TYPES, buildingType, demolitionCost, footprintAt, refundOnCancel, MAX_DAYS_HELD, type BuildingType } from './BuildingCatalogue';
import { LAGOS_PLOTS, plotArea, statePrice, type PlotDef } from './PlotCatalogue';
import { Registry, MY_ID } from './Registry';
import { assetKey, STAGES, type ConstructionStage, type Listing, type Outcome, type PlotBuilding, type RegistryState } from './types';

export type PlotStatus = 'available' | 'owned' | 'listed' | 'negotiating' | 'reserved' | 'building' | 'developed';

export const STATUS_LABEL: Record<PlotStatus, string> = {
  available: 'For sale by Lagos State',
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

/** What the world tells the land office: where things are, and how the clock is running. */
export interface LandWorld {
  districtAt(x: number, z: number): { id: string; name: string };
  zones(): Zone[];
  /** Buildings already standing near a plot, not counting what is on the plot itself */
  buildingsNear(rect: Rect): Rect[];
}

const fail = (reason: string): Outcome => ({ ok: false, reason });
const naira = (amount: number) => `₦${Math.round(amount).toLocaleString()}`;

/** How far along a building is, as one of the stages it is drawn in. */
export function stageOf(building: PlotBuilding): ConstructionStage {
  if (building.finishedAt) return 'finished';
  const done = building.hoursNeeded > 0 ? building.hoursDone / building.hoursNeeded : 1;
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

/**
 * The land office: every plot in the city, who owns each, what stands on it and what may be
 * done with it. It reads ownership from the shared registry and money from the player's
 * account; it keeps no copy of either.
 */
export class Land {
  private static instance: Land | null = null;
  private readonly registry = Registry.get();
  private readonly market = AssetMarket.get();
  private readonly backend = BackendService.getInstance();
  private world: LandWorld | null = null;
  private all: Plot[] = [];
  /** Game hours of work and of takings not yet written to the registry */
  private unsaved = new Map<string, number>();

  private constructor() {
    this.market.provide(this.provider());
  }

  public static get(): Land {
    if (!Land.instance) Land.instance = new Land();
    return Land.instance;
  }

  public connect(world: LandWorld): void {
    this.world = world;
    this.all = LAGOS_PLOTS.map((def) => {
      const district = world.districtAt((def.rect.minX + def.rect.maxX) / 2, (def.rect.minZ + def.rect.maxZ) / 2);
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
        return building && !building.finishedAt ? 'Building work is under way on it. Finish the building or stop the work first.' : null;
      },
    };
  }

  // --- Reading ----------------------------------------------------------------------------------

  public plots(): Plot[] {
    return this.all;
  }

  public plot(id: string): Plot | null {
    return this.all.find((entry) => entry.id === id) ?? null;
  }

  /** The plot a point on the ground is in, if it is in one. */
  public plotAt(x: number, z: number): Plot | null {
    return this.all.find((entry) => x >= entry.rect.minX && x <= entry.rect.maxX && z >= entry.rect.minZ && z <= entry.rect.maxZ) ?? null;
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

  public status(plotId: string, state: RegistryState = this.registry.peek()): PlotStatus {
    const title = state.titles[assetKey({ kind: 'plot', id: plotId })];
    if (!title || title.ownerId === null) return 'available';
    const key = assetKey({ kind: 'plot', id: plotId });
    const listing = Object.values(state.listings).find((entry) => assetKey(entry.asset) === key && (entry.status === 'active' || entry.status === 'pending'));
    if (listing?.status === 'pending') return 'reserved';
    if (listing) return Object.values(state.negotiations).some((n) => n.listingId === listing.id && n.status === 'open') ? 'negotiating' : 'listed';
    const building = state.buildings[plotId];
    if (building) return building.finishedAt ? 'developed' : 'building';
    return 'owned';
  }

  /** What it would cost to buy now: the state's price, or an owner's asking price, or nothing if it is not for sale. */
  public askingPrice(plotId: string): number | null {
    const status = this.status(plotId);
    if (status === 'available') return this.plot(plotId)?.statePrice ?? null;
    return this.listingFor(plotId)?.askingPrice ?? null;
  }

  /** Does the player have somewhere of their own to live on their land? */
  public hasHome(): boolean {
    return this.myPlots().some((entry) => {
      const building = this.building(entry.id);
      return !!building?.finishedAt && !!buildingType(building.typeId)?.home;
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
    if (state.titles[assetKey({ kind: 'plot', id: plotId })]?.ownerId !== MY_ID) return 'Only the owner of the land can build on it.';
    if (state.buildings[plotId]) return 'There is already a building on this plot. Pull it down first.';
    const key = assetKey({ kind: 'plot', id: plotId });
    if (Object.values(state.listings).some((entry) => assetKey(entry.asset) === key && entry.status === 'pending')) return 'A sale of this plot has been agreed. Nothing can be built until it completes or falls through.';
    if (!plot.uses.includes(type.use)) return `This plot is for ${plot.uses.join(' and ')} use only.`;
    if (type.floors > plot.maxFloors) return `No more than ${plot.maxFloors} floors may be built here.`;
    return cannotBuild(footprintAt(type, x, z, turns), plot.rect, this.world.zones(), this.world.buildingsNear(plot.rect));
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
        cost: type.cost, hoursNeeded: type.hours, hoursDone: 0, startedAt: Date.now(),
      };
      return { ok: true };
    });
  }

  /** Stops work on an unfinished building. Half the money for the work not yet done comes back. */
  public async cancelBuilding(plotId: string): Promise<Outcome & { refund?: number }> {
    return this.registry.transact((state): Outcome & { refund?: number } => {
      const building = state.buildings[plotId];
      if (!building) return fail('Nothing is being built there.');
      if (state.titles[assetKey({ kind: 'plot', id: plotId })]?.ownerId !== MY_ID) return fail('That is not your land.');
      if (building.finishedAt) return fail('That building is finished. It can be pulled down, not cancelled.');
      const type = buildingType(building.typeId);
      const refund = type ? refundOnCancel(type, building.hoursDone + (this.unsaved.get(plotId) ?? 0)) : 0;
      delete state.buildings[plotId];
      this.unsaved.delete(plotId);
      if (refund > 0) this.backend.processTransaction({ type: 'CONSTRUCTION_REFUND', amount: refund, description: `Work stopped at ${this.plot(plotId)?.name ?? 'your plot'}`, source: 'bank' });
      return { ok: true, refund };
    });
  }

  /** Pulls down a finished building, leaving the plot empty. Costs a tenth of what it cost to build. */
  public async demolish(plotId: string): Promise<Outcome> {
    return this.registry.transact((state): Outcome => {
      const building = state.buildings[plotId];
      if (!building || !building.finishedAt) return fail('There is no finished building there.');
      if (state.titles[assetKey({ kind: 'plot', id: plotId })]?.ownerId !== MY_ID) return fail('That is not your land.');
      const type = buildingType(building.typeId);
      const cost = type ? demolitionCost(type) : 0;
      if (cost > 0) {
        if (this.market.funds() < cost) return fail(`Pulling it down costs ${naira(cost)} and you have ${naira(this.market.funds())} in all.`);
        const paid = this.backend.processTransaction({ type: 'CONSTRUCTION_COST', amount: cost, description: `Demolition at ${this.plot(plotId)?.name ?? 'your plot'}`, source: 'bank', funding: 'split' });
        if (!paid.success) return fail('The payment did not go through, so nothing was pulled down.');
      }
      delete state.buildings[plotId];
      this.unsaved.delete(plotId);
      return { ok: true };
    });
  }

  // --- Time passing -------------------------------------------------------------------------------

  /**
   * Work goes on, and finished buildings earn, while their owner is in the game. Called with
   * the game hours that have just passed. Progress is written to the registry when it
   * amounts to something another player could see: about every game hour, and at each stage.
   */
  public update(gameHours: number): void {
    if (gameHours <= 0) return;
    const state = this.registry.peek();
    let due = false;
    for (const plot of this.all) {
      const building = state.buildings[plot.id];
      if (!building || state.titles[assetKey({ kind: 'plot', id: plot.id })]?.ownerId !== MY_ID) continue;
      const pending = (this.unsaved.get(plot.id) ?? 0) + gameHours;
      this.unsaved.set(plot.id, pending);
      if (building.finishedAt) {
        if (pending >= 1) due = true;
        continue;
      }
      const before = stageOf(building);
      const after = stageOf({ ...building, hoursDone: building.hoursDone + pending });
      if (pending >= 1 || after !== before || building.hoursDone + pending >= building.hoursNeeded) due = true;
    }
    if (due) void this.flush();
  }

  private flushing = false;

  /** Writes the work and takings that have built up into the registry. */
  public async flush(): Promise<void> {
    if (this.flushing) return;
    this.flushing = true;
    try {
      await this.registry.transact((state) => {
        for (const [plotId, hours] of Array.from(this.unsaved)) {
          const building = state.buildings[plotId];
          if (!building || state.titles[assetKey({ kind: 'plot', id: plotId })]?.ownerId !== MY_ID) {
            this.unsaved.delete(plotId);
            continue;
          }
          if (building.finishedAt) {
            building.hoursHeld = Math.min(MAX_DAYS_HELD * 24, (building.hoursHeld ?? 0) + hours);
          } else {
            building.hoursDone = Math.min(building.hoursNeeded, building.hoursDone + hours);
            if (building.hoursDone >= building.hoursNeeded) building.finishedAt = Date.now();
          }
          this.unsaved.delete(plotId);
        }
      });
    } finally {
      this.flushing = false;
    }
  }

  /** What a finished building has earned its owner and not yet paid over, after its upkeep. */
  public takings(plotId: string): number {
    const building = this.building(plotId);
    const type = building ? buildingType(building.typeId) : null;
    if (!building?.finishedAt || !type) return 0;
    const days = ((building.hoursHeld ?? 0) + (this.unsaved.get(plotId) ?? 0)) / 24;
    return Math.max(0, Math.floor((Math.min(MAX_DAYS_HELD, days) * (type.incomePerDay - type.upkeepPerDay)) / 100) * 100);
  }

  /** Pays a building's takings into its owner's bank account. */
  public async collect(plotId: string): Promise<Outcome & { amount?: number }> {
    await this.flush();
    return this.registry.transact((state): Outcome & { amount?: number } => {
      const building = state.buildings[plotId];
      const type = building ? buildingType(building.typeId) : null;
      if (!building?.finishedAt || !type) return fail('There is no finished building there.');
      if (state.titles[assetKey({ kind: 'plot', id: plotId })]?.ownerId !== MY_ID) return fail('That is not your building.');
      const days = Math.min(MAX_DAYS_HELD, (building.hoursHeld ?? 0) / 24);
      const amount = Math.max(0, Math.floor((days * (type.incomePerDay - type.upkeepPerDay)) / 100) * 100);
      if (amount <= 0) return fail(type.incomePerDay > 0 ? 'Nothing has come in yet.' : 'This building does not earn money.');
      const credited = this.backend.processTransaction({ type: 'BUSINESS_INCOME', amount, description: `${type.name} at ${this.plot(plotId)?.name ?? 'your plot'}`, source: 'bank' });
      if (!credited.success) return fail('The money could not be paid in.');
      building.hoursHeld = 0;
      return { ok: true, amount };
    });
  }
}
