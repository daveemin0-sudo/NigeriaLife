import type { PlotBuilding, Tenancy } from './types';

/**
 * The clock that building work, rents and takings run on.
 *
 * It is the same for every player and it does not stop when someone leaves the game: a
 * building started today is further along tomorrow whether or not its owner was playing.
 * A game hour is the length it is everywhere else in the game (the day turns once every ten
 * minutes), so an hour of work is 25 seconds of real time.
 *
 * Nothing is counted up and stored. How far along a building is, whether it is finished and
 * what it has earned are all worked out from when things began.
 */
export const MS_PER_GAME_HOUR = 25_000;
export const MS_PER_GAME_DAY = MS_PER_GAME_HOUR * 24;
/** Rent between players is paid a week of game time at a go */
export const MS_PER_RENT_WEEK = MS_PER_GAME_DAY * 7;

export const worldNow = () => Date.now();

/** Game hours of work done on a building so far. */
export function hoursDone(building: PlotBuilding, now = worldNow()): number {
  return Math.min(building.hoursNeeded, Math.max(0, (now - building.startedAt) / MS_PER_GAME_HOUR));
}

/** The moment a building is, or will be, finished. */
export const finishedAt = (building: PlotBuilding) => building.startedAt + building.hoursNeeded * MS_PER_GAME_HOUR;

export const isFinished = (building: PlotBuilding, now = worldNow()) => now >= finishedAt(building);

/** Game days of takings a finished building is holding, up to `cap` days. */
export function daysHeld(building: PlotBuilding, cap: number, now = worldNow()): number {
  if (!isFinished(building, now)) return 0;
  const since = Math.max(building.collectedAt ?? 0, finishedAt(building));
  return Math.min(cap, Math.max(0, (now - since) / MS_PER_GAME_DAY));
}

/** Is someone living in or running this building as a paid-up tenant right now? */
export const isLet = (tenancy: Tenancy | undefined | null, now = worldNow()): tenancy is Tenancy & { tenantId: string; paidUntil: number } =>
  !!tenancy && !!tenancy.tenantId && (tenancy.paidUntil ?? 0) > now;
