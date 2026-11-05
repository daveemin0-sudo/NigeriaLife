import * as THREE from 'three';
import { BackendService } from '../backend/BackendService';
import type { Item } from '../backend/types';
import { PlaceActions, type PlaceHost } from '../destinations/PlaceActions';
import { PlaceOpeners } from '../interiors/places/PlaceInterior';
import { Figure } from '../interiors/places/Worship';
import type { HumanConfig } from '../graphics/HumanMeshBuilder';
import { Sequence, steps } from '../interactions/Sequence';
import { Activity } from '../life/Activity';
import { OnlineAccount } from '../online/OnlineAccount';
import { showGameToast } from '../ui/GameToast';
import type { InteractiveObject } from '../world/World';
import { Fridge } from './Fridge';
import type { HomePlan } from './HomePlan';

/**
 * Home staff: a cook, a cleaner, a driver, and a gateman hired for the player's home and paid
 * every day from the bank.
 *
 * Each hired staff member is seen inside the home (`Figure`) and does their job:
 * - Cook (Mama Chidinma): cooks Nigerian meals and puts them in the home fridge (`Fridge.get().put`).
 * - Cleaner (Sisi Blessing): sweeps and mops the home and raises the player's hygiene.
 * - Driver (Sunday Okafor): stands by the entrance/carport and ties into the "Your car" ride (`RideService`).
 * - Gateman (Musa Danjuma): stands guard by the front door, salutes when you come home, and boosts social/cred.
 */

export type StaffRoleId = 'cook' | 'cleaner' | 'driver' | 'gateman';

export interface StaffRoleSpec {
  id: StaffRoleId;
  title: string;
  name: string;
  icon: string;
  dailyWage: number;
  duty: string;
  summary: string;
  greeting: string;
  look: HumanConfig;
}

export const STAFF_ROLES: readonly StaffRoleSpec[] = [
  {
    id: 'cook',
    title: 'Home Cook',
    name: 'Mama Chidinma',
    icon: '🍲',
    dailyWage: 4_500,
    duty: 'Stocks the fridge with fresh home-cooked meals every day',
    summary: 'Prepares smoky Party Jollof, Egusi Soup & Pounded Yam, and Fried Rice & Dodo and puts them straight into your home fridge.',
    greeting: 'Nne, food don ready! Check the fridge when you are hungry.',
    look: {
      gender: 'female',
      username: 'Mama Chidinma',
      skinTone: '#5c3a21',
      hairstyle: 'gele',
      outfit: 'chef_attire',
      outfitColor: 0xf8fafc,
      secondaryColor: 0xd97706,
    },
  },
  {
    id: 'cleaner',
    title: 'House Cleaner',
    name: 'Sisi Blessing',
    icon: '🧹',
    dailyWage: 3_500,
    duty: 'Keeps the home spotless and raises your hygiene',
    summary: 'Sweeps the parlour, mops the tiles, scrubs the bathroom, and keeps your hygiene high whenever you are at home.',
    greeting: 'Every corner dey shine like glass today! Rest well.',
    look: {
      gender: 'female',
      username: 'Sisi Blessing',
      skinTone: '#6b4423',
      hairstyle: 'braids',
      outfit: 'casual_blouse',
      outfitColor: 0x0ea5e9,
      trousersColor: 0x1e293b,
    },
  },
  {
    id: 'driver',
    title: 'Personal Driver',
    name: 'Sunday Okafor',
    icon: '🚘',
    dailyWage: 6_000,
    duty: 'Brings your car round and drives you anywhere for free ("Your car" ride)',
    summary: 'Waits by the entrance and carport. Ties into the "Your car" ride in Ride and on the map so you ride across Lagos for free.',
    greeting: 'Oga, the car is washed and the tank is full. Where are we heading?',
    look: {
      gender: 'male',
      username: 'Sunday Okafor',
      skinTone: '#3f2718',
      hairstyle: 'fade',
      outfit: 'suit',
      outfitColor: 0x0f172a,
      secondaryColor: 0xf8fafc,
      hasTie: true,
    },
  },
  {
    id: 'gateman',
    title: 'Compound Gateman',
    name: 'Musa Danjuma',
    icon: '🛡️',
    dailyWage: 3_000,
    duty: 'Stands watch at the front door day and night',
    summary: 'Watches the compound gate and front entrance round the clock, salutes when you step in, and keeps your compound respected.',
    greeting: 'Twale Oga! Compound dey kampe, nobody fit try rubbish here!',
    look: {
      gender: 'male',
      username: 'Musa Danjuma',
      skinTone: '#3b2416',
      hairstyle: 'police_cap',
      outfit: 'security_uniform',
      outfitColor: 0x1e3a5f,
      trousersColor: 0x0f172a,
    },
  },
];

export const HOME_COOKED_MEALS: ReadonlyArray<Omit<Item, 'quantity'>> = [
  {
    id: 'staff_jollof_chicken',
    name: 'Mama Chidinma’s Party Jollof & Chicken',
    category: 'food',
    icon: '🍲',
    description: 'Home-cooked smoky firewood jollof rice with peppered chicken and sweet dodo, made fresh in your kitchen.',
    price: 3_500,
    usable: true,
    energyRestore: 55,
  },
  {
    id: 'staff_egusi_pounded_yam',
    name: 'Hot Egusi Soup & Pounded Yam',
    category: 'food',
    icon: '🥣',
    description: 'Rich melon-seed soup with assorted meat and smooth pounded yam cooked by Mama Chidinma.',
    price: 4_000,
    usable: true,
    energyRestore: 60,
  },
  {
    id: 'staff_fried_rice_dodo',
    name: 'Special Fried Rice & Sweet Dodo',
    category: 'food',
    icon: '🍛',
    description: 'Fragrant Nigerian fried rice with liver, green peas, golden plantain and grilled turkey.',
    price: 3_500,
    usable: true,
    energyRestore: 50,
  },
];

export interface HiredStaffEntry {
  role: StaffRoleId;
  hiredAt: number;
  paidDay: number;
  mealsCooked: number;
  tidiesDone: number;
}

interface HomeStaffSave {
  hired: Partial<Record<StaffRoleId, HiredStaffEntry>>;
  lastPaidDay: number;
  lastRealDay: number;
}

interface LiveStaffFigure {
  role: StaffRoleId;
  spec: StaffRoleSpec;
  figure: Figure;
  card: InteractiveObject;
  points: Array<[number, number]>;
  pointIndex: number;
  stepTimer: number;
}

const REAL_DAY_MS = 86_400_000;

export class HomeStaff {
  private static instance: HomeStaff | null = null;
  public static now: () => number = () => Date.now();
  public static currentDay: () => number = () => 1;

  private state: HomeStaffSave;
  private readonly listeners = new Set<() => void>();
  private homeGroup: THREE.Group | null = null;
  private homePlan: HomePlan | null = null;
  private homeInteractive: InteractiveObject[] | null = null;
  private readonly liveFigures = new Map<StaffRoleId, LiveStaffFigure>();
  private hygieneTimer = 0;

  public static get(): HomeStaff {
    if (!HomeStaff.instance) HomeStaff.instance = new HomeStaff();
    return HomeStaff.instance;
  }

  private constructor() {
    this.state = this.load();
    void this.syncFromServer();
  }

  private storageKey(): string {
    return `nl_home_staff_v1:${Activity.player()}`;
  }

  private realDayNow(): number {
    return Math.floor(HomeStaff.now() / REAL_DAY_MS);
  }

  private load(): HomeStaffSave {
    if (OnlineAccount.get() !== null) {
      return { hired: {}, lastPaidDay: 1, lastRealDay: this.realDayNow() };
    }
    try {
      const raw = localStorage.getItem(this.storageKey());
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<HomeStaffSave>;
        return {
          hired: parsed.hired ?? {},
          lastPaidDay: typeof parsed.lastPaidDay === 'number' ? parsed.lastPaidDay : 1,
          lastRealDay: typeof parsed.lastRealDay === 'number' ? parsed.lastRealDay : this.realDayNow(),
        };
      }
    } catch {
      /* ignore */
    }
    return { hired: {}, lastPaidDay: 1, lastRealDay: this.realDayNow() };
  }

  private save(): void {
    if (OnlineAccount.get() === null) {
      try {
        localStorage.setItem(this.storageKey(), JSON.stringify(this.state));
      } catch {
        /* ignore */
      }
    }
    for (const cb of this.listeners) cb();
  }

  public onChange(cb: () => void): () => void {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  }

  public roleSpec(role: StaffRoleId): StaffRoleSpec {
    return STAFF_ROLES.find((r) => r.id === role)!;
  }

  public isHired(role: StaffRoleId): boolean {
    return Boolean(this.state.hired[role]);
  }

  public hiredList(): Array<{ spec: StaffRoleSpec; entry: HiredStaffEntry }> {
    const out: Array<{ spec: StaffRoleSpec; entry: HiredStaffEntry }> = [];
    for (const spec of STAFF_ROLES) {
      const entry = this.state.hired[spec.id];
      if (entry) out.push({ spec, entry });
    }
    return out;
  }

  public dailyWageTotal(): number {
    return this.hiredList().reduce((sum, item) => sum + item.spec.dailyWage, 0);
  }

  public async syncFromServer(): Promise<void> {
    const online = OnlineAccount.get();
    if (!online) return;
    const res = (await online.request('/staff')) as {
      ok?: boolean;
      hired?: Array<{ role: StaffRoleId; hiredAt: number; paidDay: number }>;
    } | null;
    if (!res?.ok || !Array.isArray(res.hired)) return;
    const next: Partial<Record<StaffRoleId, HiredStaffEntry>> = {};
    for (const row of res.hired) {
      if (!STAFF_ROLES.some((r) => r.id === row.role)) continue;
      const prev = this.state.hired[row.role];
      next[row.role] = {
        role: row.role,
        hiredAt: row.hiredAt,
        paidDay: row.paidDay,
        mealsCooked: prev?.mealsCooked ?? 1,
        tidiesDone: prev?.tidiesDone ?? 1,
      };
    }
    this.state.hired = next;
    this.save();
    this.refreshHomeFigures();
  }

  /**
   * Hire a staff member for the player's home. Their first day's wage is paid straight from the
   * bank, they appear in the home immediately, and they perform their initial duty right away.
   */
  public async hire(role: StaffRoleId): Promise<{ ok: boolean; message: string }> {
    const spec = this.roleSpec(role);
    if (!spec) return { ok: false, message: 'Unknown staff role.' };
    if (this.isHired(role)) {
      return { ok: false, message: `${spec.name} (${spec.title}) is already working at your home.` };
    }

    const backend = BackendService.getInstance();
    const bankBalance = backend.getData().bank.balance;
    if (bankBalance < spec.dailyWage) {
      return {
        ok: false,
        message: `Home staff are paid from your bank account. You need ₦${spec.dailyWage.toLocaleString()} in the bank to hire ${spec.name}.`,
      };
    }

    const day = Math.max(1, HomeStaff.currentDay());
    const now = HomeStaff.now();
    const online = OnlineAccount.get();
    if (online) {
      const srv = (await online.request('/staff/hire', { role, day, now })) as {
        ok?: boolean;
        reason?: string;
        wallet?: { cash: number; bank: number };
      } | null;
      if (!srv?.ok) {
        return { ok: false, message: srv?.reason ?? `Could not hire ${spec.name}.` };
      }
      if (srv.wallet) backend.applyServerWallet(srv.wallet);
    } else {
      const paid = backend.processTransaction({
        type: 'RENT_PAYMENT',
        amount: spec.dailyWage,
        description: `Home Staff Wage: ${spec.name} (${spec.title})`,
        source: 'bank',
        funding: 'strict',
      });
      if (!paid.success) {
        return {
          ok: false,
          message: `Your bank needs ₦${spec.dailyWage.toLocaleString()} to hire ${spec.name}.`,
        };
      }
    }

    this.state.hired[role] = {
      role,
      hiredAt: now,
      paidDay: day,
      mealsCooked: 0,
      tidiesDone: 0,
    };
    this.state.lastPaidDay = Math.max(this.state.lastPaidDay, day);
    this.state.lastRealDay = this.realDayNow();

    // Perform their opening job immediately so the player gets the benefit right away
    let perkNote = '';
    if (role === 'cook') {
      const meal = this.stockMealInFridge();
      perkNote = ` ${spec.name} stocked ${meal.name} in your fridge!`;
    } else if (role === 'cleaner') {
      this.performCleaning(25);
      perkNote = ` ${spec.name} tidied the house (+25% Hygiene)!`;
    } else if (role === 'driver') {
      perkNote = ` ${spec.name} is ready with "Your car" in the Ride app (free trips)!`;
    } else if (role === 'gateman') {
      backend.restoreNeed('social', 15);
      backend.addStreetCred(5);
      perkNote = ` ${spec.name} is on guard at your front door (+15% Social, +5 Street Cred)!`;
    }

    this.save();
    this.refreshHomeFigures();
    Activity.emit({ kind: 'acted', id: `hire_${role}` });
    const msg = `${spec.icon} Hired ${spec.name} (${spec.title}) for ₦${spec.dailyWage.toLocaleString()}/day from your bank.${perkNote}`;
    return { ok: true, message: msg };
  }

  /** Let a staff member go. */
  public async dismiss(role: StaffRoleId): Promise<{ ok: boolean; message: string }> {
    const spec = this.roleSpec(role);
    if (!spec || !this.isHired(role)) {
      return { ok: false, message: 'That staff member is not currently hired.' };
    }
    const online = OnlineAccount.get();
    if (online) {
      await online.request('/staff/dismiss', { role });
    }
    delete this.state.hired[role];
    this.save();
    this.refreshHomeFigures();
    const msg = `Let ${spec.name} (${spec.title}) go.`;
    return { ok: true, message: msg };
  }

  /**
   * Cook puts a fresh meal into the player's home fridge (`Fridge.get().put`).
   */
  public stockMealInFridge(): Omit<Item, 'quantity'> {
    const entry = this.state.hired.cook;
    const index = (entry?.mealsCooked ?? 0) % HOME_COOKED_MEALS.length;
    const meal = HOME_COOKED_MEALS[index];
    Fridge.get().put({ ...meal }, 1);
    if (entry) {
      entry.mealsCooked += 1;
      this.save();
    }
    const fig = this.liveFigures.get('cook')?.figure;
    fig?.say(`Fresh ${meal.name} is in the fridge!`, 3.5);
    return meal;
  }

  /**
   * Cleaner raises the player's hygiene.
   */
  public performCleaning(amount = 30): number {
    const backend = BackendService.getInstance();
    const before = backend.getData().stats.hygiene ?? 50;
    backend.restoreNeed('hygiene', amount);
    const after = backend.getData().stats.hygiene ?? 50;
    const entry = this.state.hired.cleaner;
    if (entry) {
      entry.tidiesDone += 1;
      this.save();
    }
    const fig = this.liveFigures.get('cleaner')?.figure;
    fig?.say('Every room is sparkling clean!', 3.2);
    return Math.max(0, after - before);
  }

  /**
   * Called each new day (or when the player advances time by a day). Pays each hired staff member
   * from the player's bank account, runs their daily job (cook stocks the fridge, cleaner raises
   * hygiene, gateman boosts social), or lets them go if the bank is short.
   */
  public async onNewDay(day?: number): Promise<{ paidTotal: number; paidRoles: StaffRoleId[]; unpaidRoles: StaffRoleId[] }> {
    const targetDay = typeof day === 'number' && Number.isFinite(day)
      ? Math.max(1, Math.trunc(day))
      : Math.max(this.state.lastPaidDay + 1, HomeStaff.currentDay());

    const list = this.hiredList();
    if (list.length === 0) {
      this.state.lastPaidDay = targetDay;
      this.state.lastRealDay = this.realDayNow();
      this.save();
      return { paidTotal: 0, paidRoles: [], unpaidRoles: [] };
    }

    const backend = BackendService.getInstance();
    let paidTotal = 0;
    const paidRoles: StaffRoleId[] = [];
    const unpaidRoles: StaffRoleId[] = [];

    const online = OnlineAccount.get();
    if (online) {
      const srv = (await online.request('/staff/pay-day', { day: targetDay })) as {
        ok?: boolean;
        paid?: number;
        paidRoles?: StaffRoleId[];
        unpaidRoles?: StaffRoleId[];
        wallet?: { cash: number; bank: number };
      } | null;
      if (srv?.ok && srv.wallet) {
        backend.applyServerWallet(srv.wallet);
        paidTotal = srv.paid ?? 0;
        for (const r of srv.paidRoles ?? []) {
          paidRoles.push(r);
          if (this.state.hired[r]) this.state.hired[r]!.paidDay = targetDay;
        }
        for (const r of srv.unpaidRoles ?? []) {
          unpaidRoles.push(r);
          delete this.state.hired[r];
        }
      }
    } else {
      for (const { spec, entry } of list) {
        const daysDue = Math.max(1, targetDay - entry.paidDay);
        const due = spec.dailyWage * daysDue;
        const tx = backend.processTransaction({
          type: 'RENT_PAYMENT',
          amount: due,
          description: `Daily Home Staff Wage: ${spec.name} (${spec.title})`,
          source: 'bank',
          funding: 'strict',
        });
        if (tx.success) {
          paidTotal += due;
          paidRoles.push(spec.id);
          entry.paidDay = targetDay;
        } else {
          unpaidRoles.push(spec.id);
          delete this.state.hired[spec.id];
        }
      }
    }

    // Daily jobs performed by paid staff
    if (paidRoles.includes('cook')) {
      this.stockMealInFridge();
    }
    if (paidRoles.includes('cleaner')) {
      this.performCleaning(25);
    }
    if (paidRoles.includes('gateman')) {
      backend.restoreNeed('social', 10);
    }

    this.state.lastPaidDay = targetDay;
    this.state.lastRealDay = this.realDayNow();
    this.save();
    this.refreshHomeFigures();

    if (paidTotal > 0) {
      showGameToast(`🏦 Paid ₦${paidTotal.toLocaleString()} from bank for your home staff.`, 'info', 3600);
    }
    if (unpaidRoles.length > 0) {
      const names = unpaidRoles.map((r) => this.roleSpec(r).name).join(', ');
      showGameToast(`⚠️ Bank balance could not cover daily wages for ${names}, so they left.`, 'warning', 4500);
    }

    return { paidTotal, paidRoles, unpaidRoles };
  }

  /**
   * Attaches and refreshes the 3D `Figure`s for all hired staff inside `ResidentialInterior`.
   */
  public syncHome(group: THREE.Group, plan: HomePlan | null, interactiveList: InteractiveObject[]): void {
    this.homeGroup = group;
    this.homePlan = plan;
    this.homeInteractive = interactiveList;
    this.refreshHomeFigures();
  }

  private spotsFor(role: StaffRoleId, plan: HomePlan | null): { start: [number, number]; facing: number; route: Array<[number, number]> } {
    const cooker = plan?.spots.cooker ?? { x: -11.5, z: 8.2 };
    const fridge = plan?.spots.fridge ?? { x: -14.0, z: 10.2 };
    const sofa = plan?.spots.sofa ?? { x: -7.5, z: 2.5 };
    const entrance = plan?.entrance ?? { x: 0, z: 11 };

    if (role === 'cook') {
      const a: [number, number] = [cooker.x + 0.9, cooker.z + 0.95];
      const b: [number, number] = [fridge.x + 1.05, fridge.z + 0.65];
      return { start: a, facing: 0, route: [a, b] };
    }
    if (role === 'cleaner') {
      const a: [number, number] = [sofa.x + 2.2, sofa.z - 0.5];
      const b: [number, number] = [sofa.x - 1.2, sofa.z + 1.8];
      const c: [number, number] = [entrance.x - 1.5, entrance.z - 3.2];
      return { start: a, facing: Math.PI / 2, route: [a, b, c] };
    }
    if (role === 'driver') {
      const a: [number, number] = [entrance.x - 2.3, entrance.z - 1.5];
      const b: [number, number] = [entrance.x - 3.4, entrance.z - 1.5];
      return { start: a, facing: 0, route: [a, b] };
    }
    // gateman
    const gateSpot: [number, number] = [entrance.x + 1.9, entrance.z - 1.1];
    return { start: gateSpot, facing: Math.PI, route: [gateSpot] };
  }

  public refreshHomeFigures(): void {
    const group = this.homeGroup;
    const interactiveList = this.homeInteractive;
    if (!group || !interactiveList) return;
    const origin = group.position;

    for (const spec of STAFF_ROLES) {
      const hired = this.isHired(spec.id);
      const cardId = `staff_home_${spec.id}`;
      const existingCardIdx = interactiveList.findIndex((o) => o.id === cardId);
      let live = this.liveFigures.get(spec.id);

      if (!hired) {
        if (live) {
          live.figure.root.visible = false;
        }
        if (existingCardIdx >= 0) interactiveList.splice(existingCardIdx, 1);
        PlaceActions.unregister(cardId);
        continue;
      }

      const layout = this.spotsFor(spec.id, this.homePlan);
      if (!live || live.figure.root.parent !== group) {
        if (live) live.figure.root.removeFromParent();
        const figure = new Figure(group, `staff_${spec.id}`, spec.name, spec.look, layout.start, layout.facing);
        figure.root.userData.staffRole = spec.id;
        const card: InteractiveObject = {
          id: cardId,
          name: `${spec.name} (${spec.title})`,
          category: 'Home Staff',
          description: `${spec.duty}. Paid ₦${spec.dailyWage.toLocaleString()}/day from your bank.`,
          mesh: figure.root,
          interactionPoint: new THREE.Vector3(origin.x + layout.start[0], 0, origin.z + layout.start[1] + 0.9),
        };
        live = {
          role: spec.id,
          spec,
          figure,
          card,
          points: layout.route,
          pointIndex: 0,
          stepTimer: 2.5,
        };
        this.liveFigures.set(spec.id, live);
      } else {
        live.figure.root.visible = true;
        live.points = layout.route;
        live.figure.place(layout.start[0], layout.start[1], layout.facing);
        live.card.interactionPoint.set(origin.x + layout.start[0], 0, origin.z + layout.start[1] + 0.9);
      }

      if (existingCardIdx < 0) {
        interactiveList.push(live.card);
      }
      this.registerStaffAction(cardId, live);
    }
  }

  private registerStaffAction(cardId: string, live: LiveStaffFigure): void {
    const { spec, figure } = live;
    PlaceActions.register(cardId, {
      label: () => {
        if (spec.id === 'cook') return `🍲 Speak to ${spec.name} · Cook a meal into the fridge`;
        if (spec.id === 'cleaner') return `🧹 Speak to ${spec.name} · Tidy up & boost hygiene`;
        if (spec.id === 'driver') return `🚘 Speak to ${spec.name} · Take "Your car" ride`;
        return `🛡️ Speak to ${spec.name} · Check compound security`;
      },
      run: (host: PlaceHost) => {
        const player = host.actor;
        if (!this.homeGroup || host.director.interrupt(player) === 'locked') return;
        const origin = this.homeGroup.position;
        const [fx, fz] = figure.where();
        const standWorld = new THREE.Vector3(origin.x + fx, 0, origin.z + fz + 1.0);
        const figWorld = new THREE.Vector3(origin.x + fx, 0, origin.z + fz);

        const seq = new Sequence(`speak to ${spec.name}`, [player, figure.actor]).add(
          steps.walk(player, standWorld, { ifStuck: 'snap' }),
          steps.face(player, figWorld),
          steps.face(figure.actor, standWorld),
          steps.call('greet', () => figure.say(spec.greeting, 2.6)),
          steps.animate(figure.actor, { arms: spec.id === 'gateman' ? 'wave' : 'talk' }, 1.2),
          steps.call('staff job', () => {
            if (spec.id === 'cook') {
              const meal = this.stockMealInFridge();
              host.say(`🍲 ${spec.name} cooked ${meal.name} and put it in your fridge!`, 'success');
            } else if (spec.id === 'cleaner') {
              this.performCleaning(35);
              host.say(`🧹 ${spec.name} freshened up the house! Hygiene +35%.`, 'success');
            } else if (spec.id === 'driver') {
              host.say(`🚘 ${spec.name}: "Where to, Oga? Pick any place in Ride and select Your car (Free)!"`, 'success');
              PlaceOpeners.open('app:ride', host);
            } else {
              host.backend.restoreNeed('social', 15);
              host.backend.addStreetCred(3);
              host.say(`🛡️ ${spec.name} salutes sharply! Social +15%, Street Cred +3.`, 'success');
            }
          }),
        );
        void figWorld;
        host.director.run(seq);
      },
    });
  }

  /**
   * Ticks the staff figures while the player is inside the home, and checks real-day wage ticks.
   */
  public tick(delta: number, inHome = false): void {
    const realDay = this.realDayNow();
    if (realDay > this.state.lastRealDay) {
      const daysElapsed = realDay - this.state.lastRealDay;
      this.state.lastRealDay = realDay;
      void this.onNewDay(this.state.lastPaidDay + daysElapsed);
    }

    if (!inHome || !this.homeGroup) return;
    const origin = this.homeGroup.position;

    // If cleaner is hired and player is at home, gently raise hygiene over time
    if (this.isHired('cleaner')) {
      this.hygieneTimer += delta;
      if (this.hygieneTimer >= 6) {
        this.hygieneTimer = 0;
        const stats = BackendService.getInstance().getData().stats;
        if ((stats.hygiene ?? 50) < 100) {
          BackendService.getInstance().restoreNeed('hygiene', 4);
        }
      }
    }

    for (const live of this.liveFigures.values()) {
      if (!this.isHired(live.role) || !live.figure.root.visible) continue;
      live.figure.tick(delta);
      const [fx, fz] = live.figure.where();
      live.card.interactionPoint.set(origin.x + fx, 0, origin.z + fz + 0.9);

      if (live.points.length > 1 && !live.figure.walking) {
        live.stepTimer -= delta;
        if (live.stepTimer <= 0) {
          live.pointIndex = (live.pointIndex + 1) % live.points.length;
          const next = live.points[live.pointIndex];
          live.stepTimer = 4.0;
          live.figure.walk([next], () => {
            if (live.role === 'cook') live.figure.pose('stand', 'reach');
            else if (live.role === 'cleaner') live.figure.pose('stand', 'wave');
            else live.figure.pose('stand', 'rest');
          });
        }
      }
    }
  }
}

