import { BackendService } from '../backend/BackendService';
import { Registry, MY_ID } from '../realestate/Registry';
import type { OfficeId, Politician, PoliticsState, RegistryState } from '../realestate/types';

/**
 * Government by the players. Each week there is an election for Governor of Lagos, Senator for
 * Lagos Central and President. Anyone can stand, for the party's nomination fee; they campaign
 * with rallies and are voted for at the polling unit, one vote a player a week. When the week
 * turns, whoever has the most votes takes office and their policy is the law for everyone until
 * the next one. A governor names commissioners; office holders and their cabinet are paid.
 *
 * It lives in the shared registry, so every player sees the same government.
 */

export const OFFICES: Array<{ id: OfficeId; icon: string; title: string; seat: string; fee: number; pay: number }> = [
  { id: 'governor', icon: '🏛️', title: 'Governor of Lagos', seat: 'Lagos State House, Alausa', fee: 50_000_000, pay: 15_000_000 },
  { id: 'senator', icon: '⚖️', title: 'Senator, Lagos Central', seat: 'National Assembly', fee: 20_000_000, pay: 8_000_000 },
  { id: 'president', icon: '🇳🇬', title: 'President of Nigeria', seat: 'Aso Rock', fee: 100_000_000, pay: 30_000_000 },
];

export interface Policy {
  id: string;
  office: OfficeId;
  name: string;
  /** What it does, in a line */
  does: string;
}

export const POLICIES: Policy[] = [
  { id: 'min_wage', office: 'governor', name: 'Minimum wage raise', does: 'Everyone earns 15% more per shift' },
  { id: 'cheap_transport', office: 'governor', name: 'Cheaper transport', does: 'Keke, danfo, okada and cabs cost 30% less' },
  { id: 'clean_lagos', office: 'governor', name: 'Clean Lagos', does: 'Street hawkers sell 10% cheaper' },
  { id: 'toll_free', office: 'senator', name: 'Toll-free roads', does: 'No toll on the expressway' },
  { id: 'business_tax_cut', office: 'senator', name: 'Business tax cut', does: 'Every business earns 10% more' },
  { id: 'fuel_subsidy', office: 'president', name: 'Fuel subsidy', does: 'Petrol is 20% cheaper at the pump' },
  { id: 'youth_fund', office: 'president', name: 'Youth fund', does: '₦50,000 for every player once a week at Government House' },
];

export const CABINET_ROLES = ['Commissioner for Finance', 'Commissioner for Works', 'Commissioner for Transport', 'Commissioner for Health', 'Commissioner for Environment'];
export const COMMISSIONER_PAY = 2_000_000;
export const YOUTH_FUND = 50_000;
export const RALLY = { cost: 500_000, votes: 5 };

/** The people who stand every week whoever else does, with the votes of the city's own people */
const STANDING: Record<OfficeId, Array<{ id: string; name: string; slogan: string; policy: string }>> = {
  governor: [
    { id: 'npc:adeyemi', name: 'Hon. Kunle Adeyemi', slogan: 'Eko o ni baje!', policy: 'cheap_transport' },
    { id: 'npc:bakare', name: 'Chief (Mrs) Funmi Bakare', slogan: 'Work must pay', policy: 'min_wage' },
  ],
  senator: [{ id: 'npc:okafor', name: 'Sen. Emeka Okafor', slogan: 'Roads for all', policy: 'toll_free' }],
  president: [{ id: 'npc:musa', name: 'Alh. Ibrahim Musa', slogan: 'One Nigeria, one people', policy: 'fuel_subsidy' }],
};

const WEEK = 7 * 24 * 3600 * 1000;
const EPOCH = Date.UTC(2026, 0, 1);

export class Politics {
  private static instance: Politics | null = null;
  public static get(): Politics {
    return (this.instance ??= new Politics());
  }

  /** The clock (a test moves it on a week) */
  public now: () => number = () => Date.now();
  private readonly registry = Registry.get();
  private readonly backend = BackendService.getInstance();

  public week(at = this.now()): number {
    return Math.floor((at - EPOCH) / WEEK);
  }

  /** When this week's election closes */
  public closesAt(): number {
    return EPOCH + (this.week() + 1) * WEEK;
  }

  public state(): PoliticsState {
    return this.registry.peek().politics ?? this.blank(this.week());
  }

  private blank(week: number): PoliticsState {
    return { week, holders: {}, candidates: {}, voted: {}, cabinet: [], claims: {} };
  }

  /** The city's own candidates for a week: the same names, a different few votes each week */
  private standing(office: OfficeId, week: number): Record<string, Politician> {
    const out: Record<string, Politician> = {};
    STANDING[office].forEach((p, i) => {
      const votes = 2 + ((week * 7 + i * 13 + office.length) % 6);
      out[p.id] = { ...p, votes };
    });
    return out;
  }

  /** Brings the government up to this week: a week that has ended is counted and its winners take office */
  private settle(state: RegistryState): PoliticsState {
    const week = this.week();
    const p = (state.politics ??= this.blank(week));
    p.holders ??= {};
    p.candidates ??= {};
    p.voted ??= {};
    p.cabinet ??= [];
    p.claims ??= {};
    if (p.week < week) {
      for (const office of OFFICES) {
        const running = { ...this.standing(office.id, p.week), ...(p.candidates[office.id] ?? {}) };
        const winner = Object.values(running).sort((a, b) => b.votes - a.votes)[0];
        if (winner) {
          const changed = p.holders[office.id]?.id !== winner.id;
          p.holders[office.id] = { ...winner, since: changed ? week : p.holders[office.id]?.since ?? week };
          // A new governor brings a new cabinet
          if (office.id === 'governor' && changed) p.cabinet = [];
        }
      }
      p.week = week;
      p.candidates = {};
      p.voted = {};
    }
    return p;
  }

  /** Counts a finished week if no one has yet. Any game may do it; it comes out the same. */
  public async refresh(): Promise<void> {
    if (this.state().week >= this.week()) return;
    await this.registry.transact((state) => {
      this.settle(state);
      return { ok: true };
    });
  }

  /** Who is standing for an office this week, the city's own and the players, most votes first */
  public candidates(office: OfficeId): Politician[] {
    const p = this.state();
    const players = p.week === this.week() ? p.candidates[office] ?? {} : {};
    return Object.values({ ...this.standing(office, this.week()), ...players }).sort((a, b) => b.votes - a.votes);
  }

  public holder(office: OfficeId): (Politician & { since: number }) | null {
    return this.state().holders[office] ?? null;
  }

  /** The policies in force now */
  public inForce(): Set<string> {
    const out = new Set<string>();
    for (const office of OFFICES) {
      const h = this.holder(office.id);
      if (h) out.add(h.policy);
    }
    return out;
  }

  public has(policy: string): boolean {
    return this.inForce().has(policy);
  }

  public hasVoted(office: OfficeId): boolean {
    const p = this.state();
    return p.week === this.week() && (p.voted[office] ?? []).includes(MY_ID);
  }

  public isStanding(office: OfficeId): boolean {
    const p = this.state();
    return p.week === this.week() && !!p.candidates[office]?.[MY_ID];
  }

  /** Stands for office: the nomination fee is paid, and the player is on the ballot with a slogan and a policy */
  public async stand(office: OfficeId, name: string, slogan: string, policy: string): Promise<{ ok: boolean; reason?: string }> {
    const o = OFFICES.find((x) => x.id === office);
    if (!o) return { ok: false, reason: 'There is no such office.' };
    if (!POLICIES.some((x) => x.id === policy && x.office === office)) return { ok: false, reason: 'Choose one of the policies for this office.' };
    return this.registry.transact((state) => {
      const p = this.settle(state);
      const list = (p.candidates[office] ??= {});
      if (list[MY_ID]) return { ok: false, reason: 'You are already standing.' };
      if (!this.backend.pay(o.fee, `Nomination form, ${o.title}`, 'SHOP_PURCHASE')) return { ok: false, reason: `The nomination form for ${o.title} is ₦${o.fee.toLocaleString()}. You do not have it.` };
      list[MY_ID] = { id: MY_ID, name: name.slice(0, 32), slogan: slogan.trim().slice(0, 60) || 'Vote for me', policy, votes: 0 };
      return { ok: true };
    });
  }

  /** A rally: paid for, and it wins over a few of the city's voters */
  public async rally(office: OfficeId): Promise<{ ok: boolean; reason?: string }> {
    return this.registry.transact((state) => {
      const p = this.settle(state);
      const me = p.candidates[office]?.[MY_ID];
      if (!me) return { ok: false, reason: 'You are not standing for this office.' };
      if (!this.backend.pay(RALLY.cost, 'Campaign rally', 'SHOP_PURCHASE')) return { ok: false, reason: `A rally costs ₦${RALLY.cost.toLocaleString()}.` };
      me.votes += RALLY.votes;
      return { ok: true };
    });
  }

  /** One vote, this week, for this office; only at the polling unit (the caller sees to that) */
  public async vote(office: OfficeId, candidate: string): Promise<{ ok: boolean; reason?: string }> {
    return this.registry.transact((state) => {
      const p = this.settle(state);
      const voted = (p.voted[office] ??= []);
      if (voted.includes(MY_ID)) return { ok: false, reason: 'You have voted for this office this week.' };
      const players = (p.candidates[office] ??= {});
      let who = players[candidate];
      if (!who) {
        // A vote for one of the city's own: they stand on the ballot from now on with that vote
        const npc = this.standing(office, p.week)[candidate];
        if (!npc) return { ok: false, reason: 'That candidate is not standing.' };
        who = players[candidate] = { ...npc };
      }
      who.votes += 1;
      voted.push(MY_ID);
      return { ok: true };
    });
  }

  /** The governor names a player to the cabinet */
  public async appoint(id: string, name: string, role: string): Promise<{ ok: boolean; reason?: string }> {
    return this.registry.transact((state) => {
      const p = this.settle(state);
      if (p.holders.governor?.id !== MY_ID) return { ok: false, reason: 'Only the governor names commissioners.' };
      if (!CABINET_ROLES.includes(role)) return { ok: false, reason: 'There is no such post.' };
      p.cabinet = p.cabinet.filter((c) => c.role !== role && c.id !== id);
      p.cabinet.push({ id, name: name.slice(0, 32), role });
      return { ok: true };
    });
  }

  /** What this player may collect at Government House this week: their pay in office, and the youth fund */
  public due(): Array<{ key: string; label: string; amount: number }> {
    return this.dueIn(this.state());
  }

  private dueIn(p: PoliticsState): Array<{ key: string; label: string; amount: number }> {
    const week = this.week();
    const out: Array<{ key: string; label: string; amount: number }> = [];
    for (const office of OFFICES) if (p.holders[office.id]?.id === MY_ID) out.push({ key: `${office.id}:${MY_ID}`, label: `Your pay as ${office.title}`, amount: office.pay });
    const seat = p.cabinet.find((c) => c.id === MY_ID);
    if (seat) out.push({ key: `cabinet:${MY_ID}`, label: `Your pay as ${seat.role}`, amount: COMMISSIONER_PAY });
    if (this.has('youth_fund')) out.push({ key: `youth:${MY_ID}`, label: 'The youth fund', amount: YOUTH_FUND });
    return out.filter((d) => (p.claims[d.key] ?? -1) < week);
  }

  public async collect(): Promise<{ ok: boolean; amount: number; reason?: string }> {
    return this.registry.transact((state) => {
      const p = this.settle(state);
      const week = p.week;
      let amount = 0;
      for (const d of this.dueIn(p)) {
        if ((p.claims[d.key] ?? -1) >= week) continue;
        p.claims[d.key] = week;
        amount += d.amount;
      }
      if (!amount) return { ok: false, amount: 0, reason: 'There is nothing for you to collect this week.' };
      this.backend.processTransaction({ type: 'JOB_SALARY', amount, description: 'Government House: pay and grants', source: 'bank' });
      return { ok: true, amount };
    });
  }
}

/** Multipliers the policies in force put on prices and pay */
export const Policies = {
  pay: (): number => (Politics.get().has('min_wage') ? 1.15 : 1),
  transport: (): number => (Politics.get().has('cheap_transport') ? 0.7 : 1),
  hawkers: (): number => (Politics.get().has('clean_lagos') ? 0.9 : 1),
  petrol: (): number => (Politics.get().has('fuel_subsidy') ? 0.8 : 1),
  toll: (): number => (Politics.get().has('toll_free') ? 0 : 1),
  business: (): number => (Politics.get().has('business_tax_cut') ? 1.1 : 1),
};
