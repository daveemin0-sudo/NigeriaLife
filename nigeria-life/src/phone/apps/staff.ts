import { BackendService } from '../../backend/BackendService';
import { Fridge } from '../../housing/Fridge';
import { HomeStaff, STAFF_ROLES, type StaffRoleId, type StaffRoleSpec } from '../../housing/HomeStaff';
import { chips, empty, esc, naira } from '../../ui/kit/html';
import type { PhoneApp } from '../PhoneApp';

/**
 * Staff app on the phone: hire a cook, a cleaner, a driver, or a gateman for the player's home,
 * paid every day from the bank.
 */

let syncedAt = 0;

function renderStaffCard(spec: StaffRoleSpec, hired: boolean, bankBalance: number): string {
  const canAfford = bankBalance >= spec.dailyWage;
  let dutyBtn = '';
  if (hired) {
    if (spec.id === 'cook') {
      dutyBtn = `<button class="nl-btn nl-btn--primary nl-btn--block" data-act="cook-now" data-role="cook">🍲 Cook Meal into Fridge</button>`;
    } else if (spec.id === 'cleaner') {
      dutyBtn = `<button class="nl-btn nl-btn--primary nl-btn--block" data-act="clean-now" data-role="cleaner">🧹 Tidy Home (+30% Hygiene)</button>`;
    } else if (spec.id === 'driver') {
      dutyBtn = `<button class="nl-btn nl-btn--primary nl-btn--block" data-act="call-driver" data-role="driver">🚘 Call Sunday (Your Car)</button>`;
    } else {
      dutyBtn = `<button class="nl-btn nl-btn--primary nl-btn--block" data-act="check-gate" data-role="gateman">🛡️ Compound Check (+15% Social)</button>`;
    }
  }
  return `
    <div class="nl-card ${hired ? 'nl-card--live' : ''}" data-staff-card="${esc(spec.id)}">
      <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:8px;">
        <div style="display:flex; align-items:center; gap:10px;">
          <div style="font-size:26px; width:40px; height:40px; border-radius:10px; background:var(--nl-surface-2); display:grid; place-items:center;">${spec.icon}</div>
          <div>
            <div class="nl-card-title">${esc(spec.name)}</div>
            <div class="nl-card-line" style="margin-top:1px;"><span class="nl-tag">${esc(spec.title)}</span></div>
          </div>
        </div>
        <span class="nl-tag ${hired ? 'nl-tag--good' : 'nl-tag--warn'}">${hired ? `Active · ${naira(spec.dailyWage)}/day` : `${naira(spec.dailyWage)}/day`}</span>
      </div>
      <div class="nl-card-line" style="font-weight:700; color:var(--nl-accent); margin-top:4px;">${esc(spec.duty)}</div>
      <div class="nl-card-line">${esc(spec.summary)}</div>
      <div style="margin-top:6px;">
        ${
          hired
            ? `${dutyBtn}<button class="nl-btn nl-btn--danger nl-btn--block" style="margin-top:4px;" data-act="dismiss" data-role="${esc(spec.id)}">Let go</button>`
            : `<button class="nl-btn nl-btn--primary nl-btn--block" data-act="hire" data-role="${esc(spec.id)}" ${canAfford ? '' : 'disabled'}>${
                canAfford ? `Hire ${esc(spec.name)} (${naira(spec.dailyWage)}/day from bank)` : `Need ${naira(spec.dailyWage)} in bank`
              }</button>`
        }
      </div>
    </div>
  `;
}

export const staffApp: PhoneApp = {
  id: 'staff',
  name: 'Staff',
  icon: '🧹',
  tint: ['#0f766e', '#1e3a5f'],
  purpose: 'Cook, cleaner, driver and gateman for your home',
  badge: () => HomeStaff.get().hiredList().length,
  render(host) {
    const staff = HomeStaff.get();
    if (Date.now() - syncedAt > 8_000) {
      syncedAt = Date.now();
      void staff.syncFromServer();
    }
    const tab = host.get<'all' | 'working'>('staff-tab', 'all');
    const hired = staff.hiredList();
    const dailyTotal = staff.dailyWageTotal();
    const bank = BackendService.getInstance().getData().bank.balance;
    const fridgeCount = Fridge.get().count();

    const listToShow = tab === 'working'
      ? STAFF_ROLES.filter((s) => staff.isHired(s.id))
      : STAFF_ROLES;

    return {
      title: 'Staff',
      body: `
        <div class="nl-hero nl-hero--green">
          <span class="nl-hero-label">Lagos Home Staff · Domestic Estate</span>
          <span class="nl-hero-value">${hired.length}/4 Staff Hired</span>
          <span class="nl-hero-sub">Daily Payroll: <strong>${naira(dailyTotal)}/day</strong> · Bank: <strong>${naira(bank)}</strong> · Fridge: <strong>${fridgeCount} Meals</strong></span>
          <div class="nl-hero-actions">
            <button class="nl-btn nl-btn--glass" data-set="staff-tab" data-value="all">📋 All Staff (${STAFF_ROLES.length})</button>
            <button class="nl-btn nl-btn--glass" data-set="staff-tab" data-value="working">👥 Working (${hired.length})</button>
          </div>
        </div>
        <div class="nl-section">Domestic Personnel</div>
        ${chips('staff-tab', tab, [
          ['all', `All Staff (${STAFF_ROLES.length})`],
          ['working', `Working Now (${hired.length})`],
        ])}
        <div class="nl-list" style="margin-top:8px;">
          ${
            listToShow.length === 0
              ? empty('🧹', 'No home staff hired yet', 'Hire Mama Chidinma, Sisi Blessing, Sunday Okafor, or Musa Danjuma from the All Staff tab.')
              : listToShow.map((spec) => renderStaffCard(spec, staff.isHired(spec.id), bank)).join('')
          }
        </div>
      `,
    };
  },
  act(host, action, el) {
    const staff = HomeStaff.get();
    const role = (el.dataset.role ?? '') as StaffRoleId;

    if (action === 'hire' && role) {
      void staff.hire(role).then((res) => {
        host.say(res.message, res.ok ? 'good' : 'bad');
        host.refresh();
      });
      return;
    }
    if (action === 'dismiss' && role) {
      void staff.dismiss(role).then((res) => {
        host.say(res.message, res.ok ? 'info' : 'bad');
        host.refresh();
      });
      return;
    }
    if (action === 'cook-now') {
      if (!staff.isHired('cook')) return;
      const meal = staff.stockMealInFridge();
      host.say(`🍲 Mama Chidinma cooked ${meal.name} and put it in your home fridge!`, 'good');
      host.refresh();
      return;
    }
    if (action === 'clean-now') {
      if (!staff.isHired('cleaner')) return;
      staff.performCleaning(30);
      host.say('🧹 Sisi Blessing tidied the house! Hygiene +30%.', 'good');
      host.refresh();
      return;
    }
    if (action === 'call-driver') {
      if (!staff.isHired('driver')) return;
      host.say('🚘 Sunday Okafor is ready with "Your car" (Free)! Pick your destination.', 'good');
      host.openApp('ride');
      return;
    }
    if (action === 'check-gate') {
      if (!staff.isHired('gateman')) return;
      const backend = BackendService.getInstance();
      backend.restoreNeed('social', 15);
      backend.addStreetCred(3);
      host.say('🛡️ Musa Danjuma salutes at the gate! Social +15%, Street Cred +3.', 'good');
      host.refresh();
    }
  },
};

