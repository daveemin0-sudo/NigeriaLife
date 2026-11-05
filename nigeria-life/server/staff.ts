import type { DatabaseSync } from 'node:sqlite';
import type { Economy } from './economy.ts';

/**
 * Home staff on the server: hiring a cook, cleaner, driver, or gateman for the player's home,
 * and paying their wages every day from the bank.
 */

export type StaffRoleId = 'cook' | 'cleaner' | 'driver' | 'gateman';

export interface ServerStaffRole {
  id: StaffRoleId;
  title: string;
  name: string;
  dailyWage: number;
}

export const SERVER_STAFF_ROLES: Record<StaffRoleId, ServerStaffRole> = {
  cook: { id: 'cook', title: 'Home Cook', name: 'Mama Chidinma', dailyWage: 4_500 },
  cleaner: { id: 'cleaner', title: 'House Cleaner', name: 'Sisi Blessing', dailyWage: 3_500 },
  driver: { id: 'driver', title: 'Personal Driver', name: 'Sunday Okafor', dailyWage: 6_000 },
  gateman: { id: 'gateman', title: 'Compound Gateman', name: 'Musa Danjuma', dailyWage: 3_000 },
};

export interface HiredStaffRow {
  role: StaffRoleId;
  hiredAt: number;
  paidDay: number;
}

export class ServerStaff {
  private readonly db: DatabaseSync;
  private readonly economy: Economy;

  constructor(db: DatabaseSync, economy: Economy) {
    this.db = db;
    this.economy = economy;
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS home_staff (
        user_id  TEXT    NOT NULL,
        role     TEXT    NOT NULL,
        hired_at INTEGER NOT NULL,
        paid_day INTEGER NOT NULL,
        PRIMARY KEY (user_id, role)
      );
    `);
  }

  public snapshot(userId: string): { ok: true; hired: HiredStaffRow[]; dailyTotal: number } {
    const rows = this.db
      .prepare('SELECT role, hired_at, paid_day FROM home_staff WHERE user_id = ? ORDER BY hired_at ASC')
      .all(userId) as Array<{ role: StaffRoleId; hired_at: number; paid_day: number }>;
    const hired = rows
      .filter((r) => r.role in SERVER_STAFF_ROLES)
      .map((r) => ({ role: r.role, hiredAt: r.hired_at, paidDay: r.paid_day }));
    const dailyTotal = hired.reduce((sum, r) => sum + SERVER_STAFF_ROLES[r.role].dailyWage, 0);
    return { ok: true, hired, dailyTotal };
  }

  public hire(
    userId: string,
    raw: { role?: unknown; day?: unknown; now?: unknown },
  ):
    | { ok: true; role: StaffRoleId; paid: number; wallet: { cash: number; bank: number }; snapshot: ReturnType<ServerStaff['snapshot']> }
    | { ok: false; reason: string } {
    const roleId = String(raw.role ?? '').trim() as StaffRoleId;
    const spec = SERVER_STAFF_ROLES[roleId];
    if (!spec) return { ok: false, reason: 'That staff role does not exist.' };
    const existing = this.db.prepare('SELECT 1 FROM home_staff WHERE user_id = ? AND role = ?').get(userId, roleId);
    if (existing) return { ok: false, reason: `${spec.name} (${spec.title}) is already working at your home.` };

    const now = typeof raw.now === 'number' && Number.isFinite(raw.now) ? Math.trunc(raw.now) : Date.now();
    const day = typeof raw.day === 'number' && Number.isFinite(raw.day) ? Math.max(1, Math.trunc(raw.day)) : 1;
    const paid = this.economy.holdFee(
      userId,
      spec.dailyWage,
      `Home staff wage (${spec.title}: ${spec.name})`,
      `staff_hire:${userId}:${roleId}:${now}`,
    );
    if (!paid.ok) {
      return { ok: false, reason: `Your bank needs ₦${spec.dailyWage.toLocaleString()} for ${spec.name}'s first day.` };
    }

    this.db
      .prepare('INSERT INTO home_staff (user_id, role, hired_at, paid_day) VALUES (?, ?, ?, ?)')
      .run(userId, roleId, now, day);
    return {
      ok: true,
      role: roleId,
      paid: spec.dailyWage,
      wallet: paid.wallet!,
      snapshot: this.snapshot(userId),
    };
  }

  public dismiss(
    userId: string,
    raw: { role?: unknown },
  ): { ok: true; role: StaffRoleId; snapshot: ReturnType<ServerStaff['snapshot']> } | { ok: false; reason: string } {
    const roleId = String(raw.role ?? '').trim() as StaffRoleId;
    const spec = SERVER_STAFF_ROLES[roleId];
    if (!spec) return { ok: false, reason: 'That staff role does not exist.' };
    this.db.prepare('DELETE FROM home_staff WHERE user_id = ? AND role = ?').run(userId, roleId);
    return { ok: true, role: roleId, snapshot: this.snapshot(userId) };
  }

  public payDay(
    userId: string,
    raw: { day?: unknown },
  ):
    | {
        ok: true;
        paid: number;
        paidRoles: StaffRoleId[];
        unpaidRoles: StaffRoleId[];
        wallet: { cash: number; bank: number };
        snapshot: ReturnType<ServerStaff['snapshot']>;
      }
    | { ok: false; reason: string } {
    const day = typeof raw.day === 'number' && Number.isFinite(raw.day) ? Math.max(1, Math.trunc(raw.day)) : 1;
    const rows = this.db
      .prepare('SELECT role, paid_day FROM home_staff WHERE user_id = ? ORDER BY hired_at ASC')
      .all(userId) as Array<{ role: StaffRoleId; paid_day: number }>;

    let paidTotal = 0;
    const paidRoles: StaffRoleId[] = [];
    const unpaidRoles: StaffRoleId[] = [];

    for (const row of rows) {
      const spec = SERVER_STAFF_ROLES[row.role];
      if (!spec || day <= row.paid_day) continue;
      const daysDue = Math.max(1, day - row.paid_day);
      const amount = spec.dailyWage * daysDue;
      const debit = this.economy.holdFee(
        userId,
        amount,
        `Daily home staff wage (${spec.title}: ${spec.name})`,
        `staff_wage:${userId}:${row.role}:${day}`,
      );
      if (debit.ok) {
        paidTotal += amount;
        paidRoles.push(row.role);
        this.db.prepare('UPDATE home_staff SET paid_day = ? WHERE user_id = ? AND role = ?').run(day, userId, row.role);
      } else {
        unpaidRoles.push(row.role);
        this.db.prepare('DELETE FROM home_staff WHERE user_id = ? AND role = ?').run(userId, row.role);
      }
    }

    return {
      ok: true,
      paid: paidTotal,
      paidRoles,
      unpaidRoles,
      wallet: this.economy.wallet(userId),
      snapshot: this.snapshot(userId),
    };
  }
}
