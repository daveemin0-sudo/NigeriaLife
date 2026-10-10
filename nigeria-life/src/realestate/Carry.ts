import { PROFILE_ID } from '../backend/Profile';
import { Registry, MY_ID } from './Registry';
import { assetKey, type PlotBuilding, type RegistryState, type VehicleRecord } from './types';

const LOCAL_KEY = 'nigeria_life_world_registry_v1';
const LOCAL_LOCK = 'nigeria_life_world_registry';

export interface Carried {
  /** Plots that came across, by id */
  plots: string[];
  vehicles: number;
  /** Plots that could not come because someone on the server already owns them. They stay in this browser. */
  stayed: string[];
}

function readLocal(): RegistryState | null {
  try {
    const text = localStorage.getItem(LOCAL_KEY);
    return text ? (JSON.parse(text) as RegistryState) : null;
  } catch {
    return null;
  }
}

/**
 * Brings what this player owns in this browser's own registry with them to the world server
 * they have joined: their plots, the buildings on them, and their vehicles.
 *
 * A plot comes across only if nobody on the server owns it yet; otherwise it stays where it
 * was, still theirs when they play in this browser alone. What does come across is taken out
 * of the browser's registry, so it exists in one world, not two.
 *
 * Returns what happened, or null if there was nothing to bring.
 */
export async function carryToServer(): Promise<Carried | null> {
  const registry = Registry.get();
  if (!registry.shared) return null;
  const local = readLocal();
  const localId = `local:${PROFILE_ID}`;
  if (!local?.titles) return null;

  const mine = Object.entries(local.titles).filter(([, title]) => title?.ownerId === localId);
  const myPlots = mine.filter(([key]) => key.startsWith('plot:')).map(([key, title]) => ({ id: key.slice(5), paid: title.history?.[title.history.length - 1]?.price ?? 0 }));
  const myVehicles = mine.filter(([key]) => key.startsWith('vehicle:')).map(([key, title]) => ({ id: key.slice(8), paid: title.history?.[title.history.length - 1]?.price ?? 0 }));
  if (myPlots.length === 0 && myVehicles.length === 0) return null;

  await registry.ready;
  const result: Carried = { plots: [], vehicles: 0, stayed: [] };
  const carriedVehicles: string[] = [];

  const saved = await registry.transact((state) => {
    const now = Date.now();
    for (const plot of myPlots) {
      const key = assetKey({ kind: 'plot', id: plot.id });
      const title = state.titles[key];
      if (title && title.ownerId !== null) {
        if (title.ownerId !== MY_ID) result.stayed.push(plot.id);
        continue;
      }
      const saleId = Registry.nextId(state, 'sale');
      const history = title?.history ?? [];
      history.push({ at: now, from: null, to: MY_ID, price: plot.paid, saleId });
      state.titles[key] = { ownerId: MY_ID, history };
      state.sales.push({ id: saleId, asset: { kind: 'plot', id: plot.id }, sellerId: null, buyerId: MY_ID, price: plot.paid, fee: 0, at: now });
      const building: PlotBuilding | undefined = local.buildings?.[plot.id];
      // The building comes as it stands: started when it was started, so as far along as it was
      if (building && !state.buildings[plot.id]) state.buildings[plot.id] = { ...building, builderId: MY_ID };
      result.plots.push(plot.id);
    }
    for (const vehicle of myVehicles) {
      const record: VehicleRecord | undefined = local.vehicles?.[vehicle.id];
      if (!record) continue;
      const id = state.vehicles[vehicle.id] ? Registry.nextId(state, 'car') : vehicle.id;
      state.vehicles[id] = { ...record, id };
      const saleId = Registry.nextId(state, 'sale');
      state.titles[assetKey({ kind: 'vehicle', id })] = { ownerId: MY_ID, history: [{ at: now, from: null, to: MY_ID, price: vehicle.paid, saleId }] };
      state.sales.push({ id: saleId, asset: { kind: 'vehicle', id }, sellerId: null, buyerId: MY_ID, price: vehicle.paid, fee: 0, at: now });
      carriedVehicles.push(vehicle.id);
      result.vehicles++;
    }
    return { ok: true };
  });
  // The server never took it: nothing has moved, and it is tried again next time
  if (!saved || (saved as { ok?: boolean }).ok === false) return null;

  // What came across leaves the browser's own registry
  const leave = () => {
    const fresh = readLocal();
    if (!fresh) return;
    for (const plotId of result.plots) {
      const key = assetKey({ kind: 'plot', id: plotId });
      delete fresh.titles[key];
      delete fresh.buildings?.[plotId];
      delete fresh.tenancies?.[plotId];
      for (const listing of Object.values(fresh.listings ?? {})) {
        if (assetKey(listing.asset) === key && (listing.status === 'active' || listing.status === 'pending')) listing.status = 'withdrawn';
      }
    }
    for (const vehicleId of carriedVehicles) {
      delete fresh.titles[assetKey({ kind: 'vehicle', id: vehicleId })];
      delete fresh.vehicles?.[vehicleId];
    }
    localStorage.setItem(LOCAL_KEY, JSON.stringify(fresh));
  };
  try {
    if (navigator.locks?.request) await navigator.locks.request(LOCAL_LOCK, leave);
    else leave();
  } catch (error) {
    console.warn('What was carried to the server could not be cleared from this browser', error);
  }
  return result;
}
