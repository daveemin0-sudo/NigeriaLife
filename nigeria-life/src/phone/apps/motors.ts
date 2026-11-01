import { BackendService } from '../../backend/BackendService';
import {
  Motors,
  LUXURY_CARS,
  TUNING_OPTIONS,
  type LuxuryCarSpec,
  type TuningOptionSpec,
} from '../../vehicles/Motors';
import { chips, esc, naira } from '../../ui/kit/html';
import type { PhoneApp } from '../PhoneApp';

let syncedAt = 0;
let styled = false;

const style = (): void => {
  if (styled || typeof document === 'undefined') return;
  styled = true;
  const el = document.createElement('style');
  el.id = 'nl-motors-style';
  el.textContent = `
    .mt-root { padding: 4px 2px 68px; display: flex; flex-direction: column; gap: 10px; color: var(--lx-ink, #0f172a); font-family: var(--lx-font, system-ui); }
    .mt-hero {
      padding: 12px 14px; border-radius: 16px;
      background: linear-gradient(135deg, #090d16 0%, #0f172a 55%, #1e293b 100%);
      color: #fff; box-shadow: var(--lx-shadow-sm, 0 4px 12px rgba(0,0,0,.15));
      border: 1px solid rgba(56, 189, 248, 0.2);
    }
    .mt-hero-top { display: flex; justify-content: space-between; align-items: baseline; gap: 8px; }
    .mt-hero-tag { font-size: 10px; font-weight: 900; letter-spacing: .12em; text-transform: uppercase; color: #38bdf8; }
    .mt-hero-badge { font-size: 11px; font-weight: 900; color: #f8fafc; background: rgba(56, 189, 248, 0.2); padding: 2px 8px; border-radius: 999px; border: 1px solid rgba(56, 189, 248, 0.4); }
    .mt-hero h3 { margin: 4px 0 2px; font-size: 16px; font-weight: 900; letter-spacing: -.02em; }
    .mt-hero p { margin: 0; font-size: 11px; color: rgba(255,255,255,.8); line-height: 1.35; }
    .mt-stats {
      margin-top: 8px; padding-top: 8px; border-top: 1px solid rgba(255,255,255,.15);
      display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; font-size: 11px;
    }
    .mt-stats div b { display: block; font-size: 13px; font-weight: 900; color: #38bdf8; font-variant-numeric: tabular-nums; }
    .mt-card {
      background: var(--lx-card-bg, #fff);
      border: 1px solid var(--lx-border, #e2e8f0);
      border-radius: 14px; padding: 12px;
      display: flex; flex-direction: column; gap: 8px;
    }
    .mt-head { display: flex; justify-content: space-between; align-items: flex-start; gap: 6px; }
    .mt-title-name { font-size: 14px; font-weight: 900; color: var(--lx-ink, #0f172a); }
    .mt-meta { font-size: 11px; font-weight: 800; color: #0284c7; }
    .mt-desc { font-size: 11px; color: var(--lx-muted, #64748b); line-height: 1.4; }
    .mt-specs-grid {
      display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px;
      background: #f8fafc; padding: 8px 10px; border-radius: 10px;
      border: 1px solid #e2e8f0; font-size: 10px; font-weight: 700; color: #64748b;
    }
    .mt-specs-grid div b { display: block; font-size: 12px; font-weight: 900; color: #0f172a; }
    .mt-pills { display: flex; gap: 6px; flex-wrap: wrap; margin-top: 2px; }
    .mt-pill {
      font-size: 10px; font-weight: 800; padding: 3px 7px; border-radius: 999px;
      background: #f1f5f9; color: #475569;
    }
    .mt-pill.cyan { background: #e0f2fe; color: #0369a1; border: 1px solid #bae6fd; }
    .mt-pill.green { background: #dcfce7; color: #166534; border: 1px solid #bbf7d0; }
    .mt-pill.gold { background: #fef3c7; color: #92400e; border: 1px solid #fde68a; }
    .mt-btn {
      width: 100%; padding: 9px 12px; border-radius: 10px; font-size: 12px; font-weight: 800;
      border: none; cursor: pointer; transition: transform .05s ease, opacity .15s;
      background: linear-gradient(135deg, #0284c7, #0369a1); color: #fff;
    }
    .mt-btn:active { transform: scale(0.98); }
    .mt-btn.secondary { background: #f1f5f9; color: #334155; }
    .mt-btn:disabled { opacity: .5; cursor: not-allowed; }
  `;
  document.head.appendChild(el);
};

export const motorsApp: PhoneApp = {
  id: 'motors',
  name: 'Motors',
  icon: '🏎️',
  tint: ['#0f172a', '#1e293b'],
  purpose: 'Luxury car dealership, custom pearlescent wraps, Stage 2 turbo remaps & VIP sirens.',
  badge: () => 0,
  render: (host) => {
    style();
    const motors = Motors.get();
    const now = Date.now();
    if (now - syncedAt > 10_000) {
      syncedAt = now;
      void motors.syncOnline().then(() => host.refresh());
    }

    const be = BackendService.getInstance();
    const bankBal = be.getData().bank.balance;
    const cashBal = be.getData().walletCash;
    const totalFunds = bankBal + cashBal;

    const owned = motors.owned();
    const active = motors.activeVehicle();

    const tab = host.get<'showroom' | 'tuning' | 'fleet'>('mt.tab', 'showroom');

    let content = '';

    if (tab === 'showroom') {
      content = motors.models().map((model: LuxuryCarSpec) => {
        const canAfford = totalFunds >= model.price;
        return `
          <div class="mt-card" data-model-card="${esc(model.id)}">
            <div class="mt-head">
              <div>
                <div class="mt-title-name">${esc(model.icon)} ${esc(model.name)}</div>
                <div class="mt-meta">${esc(model.brand)} · ${esc(model.badge)}</div>
              </div>
              <span class="mt-pill cyan">${naira(model.price)}</span>
            </div>
            <div class="mt-desc">${esc(model.description)}</div>
            <div class="mt-specs-grid">
              <div>Top Speed<b>${model.topSpeedKmh} km/h</b></div>
              <div>Power<b>${model.horsepower} HP</b></div>
              <div>0-100 km/h<b>${model.accelSeconds}s</b></div>
            </div>
            <div style="margin-top:4px;">
              <button class="mt-btn" data-act="buy-car" data-model="${esc(model.id)}" ${canAfford ? '' : 'disabled'}>
                ${canAfford ? `🔑 Purchase Vehicle (${naira(model.price)})` : `Need ${naira(model.price - totalFunds)} More`}
              </button>
            </div>
          </div>
        `;
      }).join('');
    } else if (tab === 'tuning') {
      if (!active) {
        content = `
          <div class="mt-card" style="text-align:center; padding:24px 16px;">
            <div style="font-size:32px;">🏎️</div>
            <div style="font-weight:900; margin-top:8px;">No Vehicle in Fleet</div>
            <div class="mt-desc" style="margin-top:4px;">Purchase a luxury vehicle from the Showroom to unlock bespoke tuning packages.</div>
          </div>
        `;
      } else {
        const model = LUXURY_CARS[active.modelId] ?? LUXURY_CARS.gwagon;
        const tuningSpecs = motors.tuningOptions();

        const activeWrapName = active.wrap ? TUNING_OPTIONS[active.wrap]?.name : 'Factory OEM Paint';
        const activeTurboName = active.turbo ? TUNING_OPTIONS[active.turbo]?.name : 'Factory Turbo';
        const activeRimsName = active.rims ? TUNING_OPTIONS[active.rims]?.name : 'Standard Factory Alloys';

        content = `
          <div class="mt-card" style="background:#f0f9ff; border-color:#bae6fd;">
            <div class="mt-head">
              <div>
                <div class="mt-title-name">Selected: ${esc(model.name)}</div>
                <div class="mt-meta">Active Spec: ${esc(activeWrapName)} · ${esc(activeTurboName)} · ${esc(activeRimsName)}</div>
              </div>
              <span class="mt-pill green">${active.hasVipSiren ? '🚨 VIP Siren Equipped' : 'Civic Mode'}</span>
            </div>
          </div>
          ${tuningSpecs.map((opt: TuningOptionSpec) => {
            const canAfford = totalFunds >= opt.price;
            let installed = false;
            if (opt.category === 'wrap' && active.wrap === opt.id) installed = true;
            if (opt.category === 'turbo' && active.turbo === opt.id) installed = true;
            if (opt.category === 'rims' && active.rims === opt.id) installed = true;
            if (opt.category === 'siren' && active.hasVipSiren) installed = true;

            return `
              <div class="mt-card" data-tuning-card="${esc(opt.id)}">
                <div class="mt-head">
                  <div>
                    <div class="mt-title-name">${esc(opt.icon)} ${esc(opt.name)}</div>
                    <div class="mt-meta">Category: ${esc(opt.category.toUpperCase())}${opt.bonusHp ? ` · +${opt.bonusHp} HP` : ''}${opt.bonusSpeed ? ` · +${opt.bonusSpeed} km/h` : ''}</div>
                  </div>
                  <span class="mt-pill ${installed ? 'green' : 'cyan'}">${installed ? '✓ Installed' : naira(opt.price)}</span>
                </div>
                <div class="mt-desc">${esc(opt.description)}</div>
                <div style="margin-top:4px;">
                  ${
                    installed
                      ? `<button class="mt-btn secondary" disabled>✓ Active On Vehicle</button>`
                      : `<button class="mt-btn" data-act="tune-car" data-car="${esc(active.vehicleId)}" data-option="${esc(opt.id)}" ${canAfford ? '' : 'disabled'}>
                          ${canAfford ? `🔧 Install (${naira(opt.price)})` : `Need ${naira(opt.price)}`}
                        </button>`
                  }
                </div>
              </div>
            `;
          }).join('')}
        `;
      }
    } else {
      // My Fleet Tab
      content = owned.length === 0
        ? `
          <div class="mt-card" style="text-align:center; padding:24px 16px;">
            <div style="font-size:32px;">🚗</div>
            <div style="font-weight:900; margin-top:8px;">Your Fleet is Empty</div>
            <div class="mt-desc" style="margin-top:4px;">Browse the Showroom tab to acquire high-performance luxury vehicles.</div>
          </div>
        `
        : owned.map((rec) => {
            const model = LUXURY_CARS[rec.modelId] ?? LUXURY_CARS.gwagon;
            const isSelected = active?.vehicleId === rec.vehicleId;
            const wrapName = rec.wrap ? TUNING_OPTIONS[rec.wrap]?.name : 'Factory OEM';
            const turboName = rec.turbo ? TUNING_OPTIONS[rec.turbo]?.name : 'Stock Turbo';
            const extraHp = (rec.turbo ? TUNING_OPTIONS[rec.turbo]?.bonusHp ?? 0 : 0);
            const totalHp = model.horsepower + extraHp;

            return `
              <div class="mt-card" data-fleet-card="${esc(rec.vehicleId)}">
                <div class="mt-head">
                  <div>
                    <div class="mt-title-name">${esc(model.icon)} ${esc(model.name)}</div>
                    <div class="mt-meta">${esc(wrapName)} · ${esc(turboName)} · ${totalHp} HP</div>
                  </div>
                  ${isSelected ? `<span class="mt-pill green">Active Beast</span>` : ''}
                </div>
                <div class="mt-pills">
                  <span class="mt-pill cyan">Top Speed: ${model.topSpeedKmh + (rec.turbo ? TUNING_OPTIONS[rec.turbo]?.bonusSpeed ?? 0 : 0)} km/h</span>
                  ${rec.hasVipSiren ? `<span class="mt-pill gold">🚨 VIP Convoy Siren Active</span>` : ''}
                </div>
                <div style="margin-top:4px;">
                  ${
                    isSelected
                      ? `<button class="mt-btn secondary" disabled>Selected Active Vehicle</button>`
                      : `<button class="mt-btn" data-act="select-car" data-car="${esc(rec.vehicleId)}">Select for Tuning &amp; Driving</button>`
                  }
                </div>
              </div>
            `;
          }).join('');
    }

    return {
      title: 'Motors',
      body: `
        <div class="mt-root">
          <div class="mt-hero">
            <div class="mt-hero-top">
              <span class="mt-hero-tag">Eko Auto Salon</span>
              <span class="mt-hero-badge">${owned.length} Owned</span>
            </div>
            <h3>Luxury Motors &amp; Tuning</h3>
            <p>High-society luxury SUVs, supercars, pearlescent wraps, and Stage 2 turbo remaps.</p>
            <div class="mt-stats">
              <div>Active<b>${active ? esc(LUXURY_CARS[active.modelId]?.name.split(' ')[0]!) : 'None'}</b></div>
              <div>Fleet<b>${owned.length} Cars</b></div>
              <div>Funds<b>${naira(totalFunds)}</b></div>
            </div>
          </div>
          ${chips('mt.tab', tab, [
            ['showroom', 'Showroom'],
            ['tuning', 'Tuning Bay'],
            ['fleet', `My Fleet (${owned.length})`],
          ])}
          ${content}
        </div>
      `,
    };
  },
  async act(host, action, el) {
    const motors = Motors.get();
    if (action === 'buy-car') {
      const modelId = el.dataset.model ?? '';
      const res = await motors.buy(modelId);
      host.say(res.message, res.ok ? 'good' : 'bad');
      host.refresh();
      return;
    }
    if (action === 'tune-car') {
      const carId = el.dataset.car ?? '';
      const optionId = el.dataset.option ?? '';
      const res = await motors.tune(carId, optionId);
      host.say(res.message, res.ok ? 'good' : 'bad');
      host.refresh();
      return;
    }
    if (action === 'select-car') {
      const carId = el.dataset.car ?? '';
      motors.setActiveVehicle(carId);
      host.say('Selected vehicle for tuning and driving.', 'good');
      host.refresh();
    }
  },
};
