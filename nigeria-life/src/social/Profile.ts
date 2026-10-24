import { BackendService } from '../backend/BackendService';
import { Employment } from '../jobs/Employment';
import { Ties } from './Ties';

/**
 * What other players see of this one: a card and a CV, built from the game's own records and
 * never from anything typed in. The criminal record is shown only if its owner allows it.
 */
export interface PublicProfile {
  v: 1;
  name: string;
  /** When they started playing (ISO date) */
  since: string;
  level: number;
  tier: string;
  /** Street cred, 0 to 100 */
  cred: number;
  /** The look, so the card can show a face of the right colour */
  skin?: string;
  outfit?: number;
  work: Array<{ title: string; place: string; trade: string; done: number; current: boolean }>;
  hustle: { done: number; rating: number | null; ratings: number; roles: Record<string, number> };
  education: string[];
  /** Null: kept private */
  record: string[] | null;
  family: string[];
  bae: string | null;
}

export function tierOf(level: number): string {
  return level >= 20 ? 'Platinum' : level >= 10 ? 'Gold' : level >= 5 ? 'Silver' : 'Bronze';
}

/** Credibility in words, from street cred */
export function credibility(cred: number): string {
  return cred >= 70 ? 'Highly trusted' : cred >= 40 ? 'Trusted' : cred >= 15 ? 'Building' : 'New';
}

export function levelOf(xp: number): number {
  return 1 + Math.floor(Math.sqrt(Math.max(0, xp) / 120));
}

export function myProfile(myId: string, look?: { skin?: string; outfit?: number }): PublicProfile {
  const data = BackendService.getInstance().getData();
  const ties = Ties.get();
  const employment = Employment.get();
  const level = levelOf(data.career?.xp ?? 0);
  const work = [
    ...employment.jobs().map((j) => ({ title: j.grade.title, place: j.employer.name, trade: j.employer.trade, done: j.done, current: true })),
    ...employment.past().map((j) => ({ title: j.title, place: j.employer, trade: j.trade, done: j.done, current: false })),
  ].slice(0, 8);
  const education = data.inventory
    .filter((item) => item.category === 'document' && /cert|degree|diploma|transcript|registration|licen[cs]e/i.test(item.name))
    .map((item) => item.name)
    .filter((name, i, all) => all.indexOf(name) === i)
    .slice(0, 6);
  const record = data.transactionHistory
    .filter((t) => /bail|fine|police|efcc|court/i.test(t.description) && t.type !== 'TRANSFER_IN')
    .map((t) => `${t.description} · ${new Date(t.timestamp).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`)
    .slice(0, 6);
  return {
    v: 1,
    name: data.username,
    since: data.createdAt,
    level,
    tier: tierOf(level),
    cred: Math.round(data.stats.streetCred ?? 0),
    skin: look?.skin,
    outfit: look?.outfit,
    work,
    hustle: ties.hustle(myId),
    education,
    record: ties.recordPublic ? record : null,
    family: ties.family().map((f) => f.name),
    bae: ties.bae()?.name ?? null,
  };
}

/** A profile that came over the wire, made safe to show: every field the right kind and length */
export function cleanProfile(raw: unknown): PublicProfile | null {
  if (!raw || typeof raw !== 'object') return null;
  const p = raw as Record<string, unknown>;
  const str = (v: unknown, n = 60) => (typeof v === 'string' ? v.slice(0, n) : '');
  const num = (v: unknown, lo: number, hi: number) => (typeof v === 'number' && Number.isFinite(v) ? Math.max(lo, Math.min(hi, v)) : lo);
  const list = (v: unknown, n: number, len = 80) => (Array.isArray(v) ? v.slice(0, n).map((x) => str(x, len)).filter(Boolean) : []);
  const hustle = (p.hustle && typeof p.hustle === 'object' ? p.hustle : {}) as Record<string, unknown>;
  const roles: Record<string, number> = {};
  if (hustle.roles && typeof hustle.roles === 'object') for (const [k, v] of Object.entries(hustle.roles as object).slice(0, 10)) roles[str(k, 20)] = num(v, 0, 1e6);
  const level = Math.round(num(p.level, 1, 999));
  return {
    v: 1,
    name: str(p.name, 32),
    since: str(p.since, 40),
    level,
    tier: tierOf(level),
    cred: Math.round(num(p.cred, 0, 100)),
    skin: str(p.skin, 12) || undefined,
    outfit: typeof p.outfit === 'number' ? p.outfit : undefined,
    work: Array.isArray(p.work) ? p.work.slice(0, 8).map((w) => {
      const j = (w ?? {}) as Record<string, unknown>;
      return { title: str(j.title, 60), place: str(j.place, 60), trade: str(j.trade, 40), done: Math.round(num(j.done, 0, 1e6)), current: !!j.current };
    }) : [],
    hustle: { done: Math.round(num(hustle.done, 0, 1e6)), rating: typeof hustle.rating === 'number' ? num(hustle.rating, 1, 5) : null, ratings: Math.round(num(hustle.ratings, 0, 1e6)), roles },
    education: list(p.education, 6),
    record: p.record === null ? null : list(p.record, 6, 120),
    family: list(p.family, 12, 32),
    bae: p.bae ? str(p.bae, 32) : null,
  };
}
