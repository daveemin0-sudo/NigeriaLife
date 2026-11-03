import { BackendService } from '../backend/BackendService';
import { OnlineAccount } from './OnlineAccount';

/**
 * A gig the server prices and times. Returns null when this browser is not on a server,
 * so the caller pays the way it always has. Online, the first call clocks in and the next
 * one, once the server's clock allows, pays. The naira amount is never sent.
 */
export async function settleGig(gig: string, energy: number): Promise<null | { ok: true; pay: number } | { ok: false; reason: string; clockedIn?: boolean }> {
  const online = OnlineAccount.get();
  if (!online) return null;
  const backend = BackendService.getInstance();
  if (energy > 0 && backend.getData().stats.energy < energy) {
    return { ok: false, reason: `You are too exhausted for this work (need ${energy}% Energy). Eat or rest first.` };
  }
  const shift = online.rememberedGig(gig);
  if (!shift) {
    const started = await online.startGig(gig);
    if (!started.ok || !started.shift) return { ok: false, reason: started.reason ?? 'That work could not be started.' };
    return { ok: false, clockedIn: true, reason: 'You are clocked in. Finish the work, then collect the pay.' };
  }
  const finished = await online.finishGig(shift);
  if (!finished.ok) {
    if (/not started|already paid|given up/i.test(finished.reason ?? '')) online.forgetGig(gig);
    return { ok: false, reason: finished.reason ?? 'That pay did not go through.' };
  }
  online.forgetGig(gig);
  if (energy > 0) backend.modifyNeed('energy', -energy);
  return { ok: true, pay: finished.pay ?? 0 };
}

/** One catalogue payout (a quest, a set, a case, a lizard). Null when offline. */
export async function claimCatalogue(path: string, body: Record<string, unknown>): Promise<null | { ok: boolean; pay?: number; reason?: string; replay?: boolean }> {
  const online = OnlineAccount.get();
  if (!online) return null;
  return online.request(path, body);
}
