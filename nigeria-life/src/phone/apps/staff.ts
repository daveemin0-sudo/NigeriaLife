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
let styled = false;

const style = (): void => {
  if (styled || typeof document === 'undefined') return;
  styled = true;
  const el = document.createElement('style');
  el.id = 'nl-staff-style';
  el.textContent = `
    .st-root { padding: 4px 2px 68px; display: flex; flex-direction: column; gap: 10px; color: var(--lx-ink, #0f172a); font-family: var(--lx-font, system-ui); }
    .st-hero {
      padding: 12px 14px; border-radius: 16px;
      background: linear-gradient(135deg, #0f172a 0%, #1e3a5f 55%, #0b7a43 100%);
      color: #fff; box-shadow: var(--lx-shadow-sm, 0 4px 12px rgba(0,0,0,.08));
    }
    .st-hero-top { display: flex; justify-content: space-between; align-items: baseline; gap: 8px; }
    .st-hero-tag { font-size: 10px; font-weight: 900; letter-spacing: .12em; text-transform: uppercase; color: #86efac; }
    .st-hero-badge { font-size: 11px; font-weight: 900; color: #fef08a; background: rgba(0,0,0,.28); padding: 2px 8px; border-radius: 999px; }
    .st-hero h3 { margin: 4px 0 2px; font-size: 16px; font-weight: 900; letter-spacing: -.02em; }
    .st-hero p { margin: 0; font-size: 11px; color: rgba(255,255,255,.86); line-height: 1.35; }
    .st-stats {
      margin-top: 8px; padding-top: 8px; border-top: 1px solid rgba(255,255,255,.16);
      display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; font-size: 11px;
    }
    .st-stats div b { display: block; font-size: 13px; font-weight: 900; color: #fde68a; font-variant-numeric: tabular-nums; }
    .st-card {
      padding: 12px; border-radius: 14px;
      background: var(--lx-surface-solid, #fff); border: 1px solid var(--lx-line, rgba(0,0,0,.08));
      box-shadow: var(--lx-shadow-sm, 0 4px 12px rgba(0,0,0,.08));
      display: flex; flex-direction: column; gap: 6px; color: var(--lx-ink, #0f172a);
    }
    .st-card.hired { border-color: #16a34a; }
    .st-card-top { display: flex; justify-content: space-between; align-items: flex-start; gap: 8px; }
    .st-person { display: flex; align-items: center; gap: 8px; }
    .st-icon {
      width: 34px; height: 34px; border-radius: 10px;
      display: grid; place-items: center; font-size: 18px;
      background: var(--lx-surface-2, #f1f5f9); flex-shrink: 0;
    }
    .st-name { font-size: 13px; font-weight: 900; color: var(--lx-ink, #0f172a); }
    .st-role { font-size: 11px; font-weight: 700; color: var(--lx-dim, #64748b); }
    .st-wage {
      padding: 3px 8px; border-radius: 999px; font-size: 10px; font-weight: 900;
      background: #fef3c7; color: #92400e; white-space: nowrap; font-variant-numeric: tabular-nums;
    }
    .st-wage.on { background: #dcfce7; color: #166534; }
    .st-duty { font-size: 11px; font-weight: 800; color: var(--lx-brand, #0b7a43); }
    .st-desc { font-size: 11px; color: var(--lx-dim, #64748b); line-height: 1.35; }
    .st-actions { display: flex; gap: 6px; flex-wrap: wrap; margin-top: 2px; }
    .st-btn {
      flex: 1; padding: 8px 10px; border-radius: 10px; border: 0;
      background: var(--lx-brand, #0b7a43); color: #fff;
      font-family: inherit; font-size: 11px; font-weight: 800; cursor: pointer;
    }
    .st-btn:disabled { opacity: .45; cursor: not-allowed; }
    .st-btn-sec {
      padding: 8px 10px; border-radius: 10px;
      border: 1px solid var(--lx-line, rgba(0,0,0,.14));
      background: var(--lx-surface-2, #f1f5f9); color: var(--lx-ink, #0f172a);
      font-family: inherit; font-size: 11px; font-weight: 800; cursor: pointer;
    }
    .st-btn-danger {
      padding: 8px 10px; border-radius: 10px;
      border: 1px solid #fecaca; background: #fef2f2; color: #991b1b;
      font-family: inherit; font-size: 11px; font-weight: 800; cursor: pointer;
    }
  `;
  document.head.appendChild(el);
};

function renderStaffCard(spec: StaffRoleSpec, hired: boolean, bankBalance: number): string {
  const canAfford = bankBalance >= spec.dailyWage;
  let dutyBtn = '';
  if (hired) {
    if (spec.id === 'cook') {
      dutyBtn = `<button class="st-btn" data-act="cook-now" data-role="cook">🍲 Cook Meal into Fridge</button>`;
    } else if (spec.id === 'cleaner') {
      dutyBtn = `<button class="st-btn" data-act="clean-now" data-role="cleaner">🧹 Tidy Home (+30% Hygiene)</button>`;
    } else if (spec.id === 'driver') {
      dutyBtn = `<button class="st-btn" data-act="call-driver" data-role="driver">🚘 Call Sunday (Your Car)</button>`;
    } else {
      dutyBtn = `<button class="st-btn" data-act="check-gate" data-role="gateman">🛡️ Compound Check (+15% Social)</button>`;
    }
  }
  return `
    <div class="st-card ${hired ? 'hired' : ''}" data-staff-card="${esc(spec.id)}">
      <div class="st-card-top">
        <div class="st-person">
          <div class="st-icon">${spec.icon}</div>
          <div>
            <div class="st-name">${esc(spec.name)}</div>
            <div class="st-role">${esc(spec.title)}</div>
          </div>
        </div>
        <span class="st-wage ${hired ? 'on' : ''}">${hired ? `Active · ${naira(spec.dailyWage)}/day` : `${naira(spec.dailyWage)}/day`}</span>
      </div>
      <div class="st-duty">${esc(spec.duty)}</div>
      <div class="st-desc">${esc(spec.summary)}</div>
      <div class="st-actions">
        ${
          hired
            ? `${dutyBtn}<button class="st-btn-danger" data-act="dismiss" data-role="${esc(spec.id)}">Let go</button>`
            : `<button class="st-btn" data-act="hire" data-role="${esc(spec.id)}" ${canAfford ? '' : 'disabled'}>${
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
    style();
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
        <div class="st-root">
          <div class="st-hero">
            <div class="st-hero-top">
              <span class="st-hero-tag">Lagos Home Staff</span>
              <span class="st-hero-badge">${hired.length}/4 Hired</span>
            </div>
            <h3>Domestic Staff & Chauffeur</h3>
            <p>Hire a cook, cleaner, personal driver, or gateman for your home. Paid every day from your bank account.</p>
            <div class="st-stats">
              <div>Daily Bank Pay<b>${naira(dailyTotal)}</b></div>
              <div>Bank Balance<b>${naira(bank)}</b></div>
              <div>Fridge Meals<b>${fridgeCount}</b></div>
            </div>
          </div>
          ${chips('staff-tab', tab, [
            ['all', `All Staff (${STAFF_ROLES.length})`],
            ['working', `Working Now (${hired.length})`],
          ])}
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

